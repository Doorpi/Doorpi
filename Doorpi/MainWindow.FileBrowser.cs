using System.Collections.Concurrent;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace Doorpi
{
    public partial class MainWindow
    {
        private sealed class DoorpiFileBrowserSession
        {
            public string Id { get; init; } = "";
            public string Source { get; init; } = "fileBrowser";
            public bool SelectFolder { get; init; }
            public bool Standalone { get; init; }
            public bool ReturnToBrowserOnClose { get; init; }
            public string FilterLabel { get; init; } = "";
            public HashSet<string> Extensions { get; init; } = new(StringComparer.OrdinalIgnoreCase);
            public TaskCompletionSource<string?> Completion { get; } =
                new(TaskCreationOptions.RunContinuationsAsynchronously);
        }

        private sealed record DoorpiFileBrowserEntry(
            [property: JsonPropertyName("name")] string Name,
            [property: JsonPropertyName("path")] string Path,
            [property: JsonPropertyName("isDirectory")] bool IsDirectory,
            [property: JsonPropertyName("isDrive")] bool IsDrive,
            [property: JsonPropertyName("size")] long Size,
            [property: JsonPropertyName("modifiedUtc")] DateTime ModifiedUtc,
            [property: JsonPropertyName("extension")] string Extension);

        private sealed record DoorpiMoveFile(string Source, string Target, long Length);
        private sealed record DoorpiMovePlan(
            List<string> Directories,
            List<DoorpiMoveFile> Files,
            long TotalBytes);

        private DoorpiFileBrowserSession? _doorpiFileBrowserSession;
        private readonly ConcurrentDictionary<string, (string Kind, string DataUrl)> _doorpiFileBrowserVisualCache =
            new(StringComparer.OrdinalIgnoreCase);
        private readonly SemaphoreSlim _doorpiFileBrowserVisualGate = new(4, 4);
        private static readonly HashSet<string> DoorpiFileBrowserImageExtensions = new(
            new[] { ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp" },
            StringComparer.OrdinalIgnoreCase);
        private static readonly HashSet<string> DoorpiFileBrowserViewableImageExtensions = new(
            new[] { ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg", ".avif", ".ico" },
            StringComparer.OrdinalIgnoreCase);
        private static readonly HashSet<string> DoorpiFileBrowserLaunchExtensions = new(
            new[] { ".exe", ".bat", ".cmd", ".com", ".lnk", ".url" },
            StringComparer.OrdinalIgnoreCase);
        private static readonly HashSet<string> DoorpiFileBrowserArchiveExtensions = new(
            new[] { ".zip", ".rar", ".7z" },
            StringComparer.OrdinalIgnoreCase);
        private const string DoorpiFileBrowserImageHost = "doorpi-image.local";
        private bool _doorpiFileBrowserImageResourceHandlerRegistered;
        private string _doorpiFileBrowserImagePath = "";
        private string _doorpiFileBrowserImageRequestId = "";
        private readonly List<Stream> _doorpiFileBrowserImageResponseStreams = new();

        private async Task<string?> ShowDoorpiFileBrowserAsync(
            string title,
            bool selectFolder,
            string filter = "",
            string source = "fileBrowser",
            string? initialPath = null)
        {
            if (!Dispatcher.CheckAccess())
            {
                return await Dispatcher.InvokeAsync(() =>
                    ShowDoorpiFileBrowserAsync(title, selectFolder, filter, source, initialPath)).Task.Unwrap();
            }

            if (_doorpiFileBrowserSession != null)
                CloseDoorpiFileBrowser(_doorpiFileBrowserSession, null);

            string sessionId = Guid.NewGuid().ToString("N");
            var (filterLabel, extensions) = ParseDoorpiFileBrowserFilter(filter);
            var session = new DoorpiFileBrowserSession
            {
                Id = sessionId,
                Source = source,
                SelectFolder = selectFolder,
                FilterLabel = filterLabel,
                Extensions = extensions
            };
            _doorpiFileBrowserSession = session;

            var (startPath, initialSelection) = ResolveDoorpiFileBrowserStart(initialPath);
            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
            {
                type = "doorpiFileBrowserOpen",
                sessionId,
                title,
                mode = selectFolder ? "folder" : "file",
                filterLabel,
                startPath,
                initialSelection,
                winRarAvailable = FindDoorpiWinRarPath() != null
            }));

            string? result = await session.Completion.Task;
            return result;
        }

        private void OpenDoorpiFileExplorer(
            string? initialPath = null,
            bool returnToBrowserOnClose = false)
        {
            if (!Dispatcher.CheckAccess())
            {
                Dispatcher.Invoke(() => OpenDoorpiFileExplorer(initialPath, returnToBrowserOnClose));
                return;
            }

            if (_doorpiFileBrowserSession != null)
                CloseDoorpiFileBrowser(_doorpiFileBrowserSession, null);

            string sessionId = Guid.NewGuid().ToString("N");
            var session = new DoorpiFileBrowserSession
            {
                Id = sessionId,
                Source = "fileExplorer",
                SelectFolder = false,
                Standalone = true,
                ReturnToBrowserOnClose = returnToBrowserOnClose,
                FilterLabel = "Todos os arquivos"
            };
            _doorpiFileBrowserSession = session;
            var (startPath, initialSelection) = ResolveDoorpiFileBrowserStart(initialPath);
            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
            {
                type = "doorpiFileBrowserOpen",
                sessionId,
                title = "Explorador de arquivos",
                mode = "explorer",
                filterLabel = "Todos os arquivos",
                startPath,
                initialSelection,
                winRarAvailable = FindDoorpiWinRarPath() != null
            }));
        }

        private static (string StartPath, string InitialSelection) ResolveDoorpiFileBrowserStart(string? requestedPath)
        {
            string candidate = requestedPath ?? "";
            try
            {
                if (Directory.Exists(candidate))
                    return (Path.GetFullPath(candidate), "");

                string fileCandidate = File.Exists(candidate)
                    ? candidate
                    : LaunchCommand.ExecutablePathOrName(candidate);
                if (File.Exists(fileCandidate))
                {
                    string fullFile = Path.GetFullPath(fileCandidate);
                    return (Path.GetDirectoryName(fullFile) ?? "", fullFile);
                }
            }
            catch { }

            // Uma seleção nova sempre começa na visão de unidades/atalhos.
            return ("", "");
        }

        private static (string Label, HashSet<string> Extensions) ParseDoorpiFileBrowserFilter(string filter)
        {
            var extensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(filter))
                return ("Todos os arquivos", extensions);

            string[] parts = filter.Split('|', StringSplitOptions.TrimEntries);
            string label = parts.Length > 0 ? parts[0] : "";
            string patterns = parts.Length > 1 ? parts[1] : filter;

            // O primeiro grupo representa o filtro ativo do diálogo original. Um grupo
            // posterior "*.*" é apenas a alternativa "Todos os arquivos" do Windows.
            foreach (string rawPattern in patterns.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                string pattern = rawPattern.Trim();
                if (pattern is "*" or "*.*")
                {
                    extensions.Clear();
                    break;
                }

                if (pattern.StartsWith("*.", StringComparison.Ordinal))
                    extensions.Add(pattern[1..].ToLowerInvariant());
                else if (pattern.StartsWith(".", StringComparison.Ordinal))
                    extensions.Add(pattern.ToLowerInvariant());
            }

            return (string.IsNullOrWhiteSpace(label) ? patterns : label, extensions);
        }

        private async Task<bool> TryHandleDoorpiFileBrowserMessageAsync(string action, JsonElement root)
        {
            if (action is not ("openDoorpiFileExplorer" or "doorpiFileBrowserNavigate" or
                               "doorpiFileBrowserConfirm" or "doorpiFileBrowserCancel" or
                               "doorpiFileBrowserVisualRequest" or "doorpiFileBrowserOperation" or
                               "doorpiFileBrowserCopyPath" or "doorpiFileBrowserReadClipboard" or
                               "doorpiFileBrowserViewImage" or "doorpiFileBrowserCloseImage"))
                return false;

            if (action == "openDoorpiFileExplorer")
            {
                OpenDoorpiFileExplorer(GetStr(root, "initialPath"));
                return true;
            }

            string sessionId = GetStr(root, "sessionId");
            DoorpiFileBrowserSession? session = _doorpiFileBrowserSession;
            if (session == null || !string.Equals(session.Id, sessionId, StringComparison.Ordinal))
                return true;

            if (action == "doorpiFileBrowserCancel")
            {
                CloseDoorpiFileBrowser(session, null);
                return true;
            }

            string requestedPath = GetStr(root, "path");
            if (action == "doorpiFileBrowserCloseImage")
            {
                ClearDoorpiFileBrowserImageMapping();
                return true;
            }
            if (action == "doorpiFileBrowserViewImage")
            {
                ShowDoorpiFileBrowserImage(session, requestedPath);
                return true;
            }
            if (action == "doorpiFileBrowserCopyPath")
            {
                try
                {
                    if (!string.IsNullOrWhiteSpace(requestedPath))
                        System.Windows.Clipboard.SetText(requestedPath);
                    PostDoorpiFileBrowserOperationResult(session.Id, "copyPath", true, "Caminho copiado.", requestedPath);
                }
                catch (Exception ex)
                {
                    PostDoorpiFileBrowserOperationResult(session.Id, "copyPath", false, ex.Message, requestedPath);
                }
                return true;
            }

            if (action == "doorpiFileBrowserReadClipboard")
            {
                string text = "";
                try { text = System.Windows.Clipboard.GetText(); } catch { }
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "doorpiFileBrowserClipboard",
                    sessionId = session.Id,
                    text
                }));
                return true;
            }

            if (action == "doorpiFileBrowserOperation")
            {
                await HandleDoorpiFileBrowserOperationAsync(session, root);
                return true;
            }
            if (action == "doorpiFileBrowserVisualRequest")
            {
                bool isDirectory = root.TryGetProperty("isDirectory", out var directoryElement) &&
                                   directoryElement.ValueKind == JsonValueKind.True;
                await SendDoorpiFileBrowserVisualAsync(session, requestedPath, isDirectory);
                return true;
            }

            if (action == "doorpiFileBrowserConfirm")
            {
                string? selectedPath = ValidateDoorpiFileBrowserSelection(session, requestedPath);
                if (selectedPath == null)
                {
                    PostDoorpiFileBrowserError(session.Id, "A seleção não está mais disponível.");
                    return true;
                }

                CloseDoorpiFileBrowser(session, selectedPath);
                return true;
            }

            await SendDoorpiFileBrowserDirectoryAsync(session, requestedPath);
            return true;
        }

        private string? ValidateDoorpiFileBrowserSelection(DoorpiFileBrowserSession session, string requestedPath)
        {
            try
            {
                string fullPath = Path.GetFullPath(requestedPath);
                if (session.SelectFolder)
                    return Directory.Exists(fullPath) ? fullPath : null;

                if (!File.Exists(fullPath))
                    return null;

                if (session.Extensions.Count > 0 && !session.Extensions.Contains(Path.GetExtension(fullPath)))
                    return null;

                return fullPath;
            }
            catch
            {
                return null;
            }
        }

        private void ShowDoorpiFileBrowserImage(DoorpiFileBrowserSession session, string requestedPath)
        {
            try
            {
                if (!session.Standalone)
                    throw new InvalidOperationException("Imagens só podem ser abertas no explorador de arquivos.");

                string path = Path.GetFullPath(requestedPath);
                if (!File.Exists(path) ||
                    !DoorpiFileBrowserViewableImageExtensions.Contains(Path.GetExtension(path)))
                    throw new FileNotFoundException("A imagem não está mais disponível.", path);

                ClearDoorpiFileBrowserImageMapping();
                EnsureDoorpiFileBrowserImageResourceHandler();
                _doorpiFileBrowserImagePath = path;
                _doorpiFileBrowserImageRequestId = Guid.NewGuid().ToString("N");

                string fileName = Path.GetFileName(path);
                string url = $"https://{DoorpiFileBrowserImageHost}/{_doorpiFileBrowserImageRequestId}/{Uri.EscapeDataString(fileName)}" +
                             $"?v={File.GetLastWriteTimeUtc(path).Ticks}";
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "doorpiFileBrowserImage",
                    sessionId = session.Id,
                    success = true,
                    path,
                    name = fileName,
                    url
                }));
            }
            catch (Exception ex)
            {
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "doorpiFileBrowserImage",
                    sessionId = session.Id,
                    success = false,
                    path = requestedPath,
                    message = FriendlyDoorpiFileBrowserOperationError(ex)
                }));
            }
        }

        private void EnsureDoorpiFileBrowserImageResourceHandler()
        {
            if (_doorpiFileBrowserImageResourceHandlerRegistered) return;
            webView.CoreWebView2.AddWebResourceRequestedFilter(
                $"https://{DoorpiFileBrowserImageHost}/*",
                CoreWebView2WebResourceContext.Image);
            webView.CoreWebView2.WebResourceRequested += OnDoorpiFileBrowserImageResourceRequested;
            _doorpiFileBrowserImageResourceHandlerRegistered = true;
        }

        private void OnDoorpiFileBrowserImageResourceRequested(
            object? sender,
            CoreWebView2WebResourceRequestedEventArgs e)
        {
            try
            {
                if (!Uri.TryCreate(e.Request.Uri, UriKind.Absolute, out Uri? uri) ||
                    !string.Equals(uri.Host, DoorpiFileBrowserImageHost, StringComparison.OrdinalIgnoreCase) ||
                    string.IsNullOrEmpty(_doorpiFileBrowserImageRequestId) ||
                    !uri.AbsolutePath.StartsWith(
                        $"/{_doorpiFileBrowserImageRequestId}/",
                        StringComparison.OrdinalIgnoreCase) ||
                    string.IsNullOrEmpty(_doorpiFileBrowserImagePath) ||
                    !File.Exists(_doorpiFileBrowserImagePath))
                    return;

                var stream = new FileStream(
                    _doorpiFileBrowserImagePath,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.ReadWrite | FileShare.Delete,
                    64 * 1024,
                    FileOptions.SequentialScan);
                _doorpiFileBrowserImageResponseStreams.Add(stream);
                string contentType = DoorpiFileBrowserImageContentType(
                    Path.GetExtension(_doorpiFileBrowserImagePath));
                string headers =
                    $"Content-Type: {contentType}\r\n" +
                    $"Content-Length: {stream.Length}\r\n" +
                    "Cache-Control: no-store\r\n" +
                    "X-Content-Type-Options: nosniff\r\n";
                e.Response = webView.CoreWebView2.Environment.CreateWebResourceResponse(
                    stream,
                    200,
                    "OK",
                    headers);
            }
            catch
            {
                // O onerror do visualizador apresenta uma mensagem amigável ao usuário.
            }
        }

        private static string DoorpiFileBrowserImageContentType(string extension) =>
            extension.ToLowerInvariant() switch
            {
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".webp" => "image/webp",
                ".gif" => "image/gif",
                ".bmp" => "image/bmp",
                ".svg" => "image/svg+xml",
                ".avif" => "image/avif",
                ".ico" => "image/x-icon",
                _ => "application/octet-stream"
            };

        private void ClearDoorpiFileBrowserImageMapping()
        {
            _doorpiFileBrowserImagePath = "";
            _doorpiFileBrowserImageRequestId = "";
            foreach (Stream stream in _doorpiFileBrowserImageResponseStreams)
            {
                try { stream.Dispose(); }
                catch { }
            }
            _doorpiFileBrowserImageResponseStreams.Clear();
        }

        private async Task SendDoorpiFileBrowserDirectoryAsync(DoorpiFileBrowserSession session, string requestedPath)
        {
            string path = Environment.ExpandEnvironmentVariables(requestedPath ?? "");
            string initialSelection = "";
            try
            {
                if (File.Exists(path))
                {
                    initialSelection = Path.GetFullPath(path);
                    path = Path.GetDirectoryName(initialSelection) ?? "";
                }
                var result = await Task.Run(() => ReadDoorpiFileBrowserDirectory(session, path));
                if (_doorpiFileBrowserSession?.Id != session.Id)
                    return;

                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "doorpiFileBrowserEntries",
                    sessionId = session.Id,
                    path = result.Path,
                    parentPath = result.ParentPath,
                    entries = result.Entries,
                    initialSelection
                }));
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[FileBrowser] Falha ao listar '" + path + "': " + ex.Message);
                PostDoorpiFileBrowserError(session.Id, FriendlyDoorpiFileBrowserError(ex));
            }
        }

        private (string Path, string? ParentPath, List<DoorpiFileBrowserEntry> Entries)
            ReadDoorpiFileBrowserDirectory(DoorpiFileBrowserSession session, string requestedPath)
        {
            if (string.IsNullOrWhiteSpace(requestedPath))
                return ("", null, ReadDoorpiFileBrowserRoots());

            string fullPath = Path.GetFullPath(requestedPath);
            if (!Directory.Exists(fullPath))
                throw new DirectoryNotFoundException("A pasta não existe mais.");

            var entries = new List<DoorpiFileBrowserEntry>();
            var directory = new DirectoryInfo(fullPath);
            var enumerationOptions = new EnumerationOptions
            {
                RecurseSubdirectories = false,
                IgnoreInaccessible = true,
                ReturnSpecialDirectories = false,
                AttributesToSkip = FileAttributes.Hidden | FileAttributes.System
            };

            foreach (DirectoryInfo child in directory.EnumerateDirectories("*", enumerationOptions))
            {
                try
                {
                    if (ShouldHideDoorpiFileBrowserEntry(child))
                        continue;

                    entries.Add(new DoorpiFileBrowserEntry(
                        child.Name,
                        child.FullName,
                        true,
                        false,
                        0,
                        child.LastWriteTimeUtc,
                        ""));
                }
                catch (UnauthorizedAccessException) { }
                catch (IOException) { }
            }

            if (!session.SelectFolder)
            {
                foreach (FileInfo file in directory.EnumerateFiles("*", enumerationOptions))
                {
                    try
                    {
                        if (ShouldHideDoorpiFileBrowserEntry(file))
                            continue;

                        string extension = file.Extension.ToLowerInvariant();
                        if (session.Extensions.Count > 0 && !session.Extensions.Contains(extension))
                            continue;

                        entries.Add(new DoorpiFileBrowserEntry(
                            file.Name,
                            file.FullName,
                            false,
                            false,
                            file.Length,
                            file.LastWriteTimeUtc,
                            extension));
                    }
                    catch (UnauthorizedAccessException) { }
                    catch (IOException) { }
                }
            }

            entries.Sort((left, right) =>
            {
                int kind = right.IsDirectory.CompareTo(left.IsDirectory);
                return kind != 0
                    ? kind
                    : StringComparer.CurrentCultureIgnoreCase.Compare(left.Name, right.Name);
            });

            DirectoryInfo? parent = directory.Parent;
            string parentPath = parent?.FullName ?? "";
            return (directory.FullName, parentPath, entries);
        }

        private static List<DoorpiFileBrowserEntry> ReadDoorpiFileBrowserRoots()
        {
            var entries = new List<DoorpiFileBrowserEntry>();

            void AddLocation(string name, string path)
            {
                if (!Directory.Exists(path) || entries.Any(item =>
                        string.Equals(item.Path, path, StringComparison.OrdinalIgnoreCase)))
                    return;

                entries.Add(new DoorpiFileBrowserEntry(name, path, true, false, 0, DateTime.MinValue, ""));
            }

            AddLocation("Área de Trabalho", Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
            AddLocation("Documentos", Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments));
            AddLocation("Downloads", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads"));
            AddLocation("Imagens", Environment.GetFolderPath(Environment.SpecialFolder.MyPictures));
            AddLocation("Arquivos de Programas", Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles));
            AddLocation("Arquivos de Programas (x86)", Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86));

            foreach (DriveInfo drive in DriveInfo.GetDrives().OrderBy(item => item.Name, StringComparer.OrdinalIgnoreCase))
            {
                string label = drive.Name;
                try
                {
                    if (drive.IsReady && !string.IsNullOrWhiteSpace(drive.VolumeLabel))
                        label = $"{drive.VolumeLabel} ({drive.Name.TrimEnd('\\')})";
                }
                catch { }

                entries.Add(new DoorpiFileBrowserEntry(label, drive.Name, true, true, 0, DateTime.MinValue, ""));
            }

            return entries;
        }

        private static bool ShouldHideDoorpiFileBrowserEntry(FileSystemInfo entry)
        {
            try
            {
                FileAttributes attributes = entry.Attributes;
                return (attributes & (FileAttributes.Hidden | FileAttributes.System)) != 0;
            }
            catch
            {
                // Se nem os atributos puderem ser lidos, a entrada também não seria
                // navegável de forma confiável.
                return true;
            }
        }

        private static string FriendlyDoorpiFileBrowserError(Exception ex) => ex switch
        {
            UnauthorizedAccessException => "Você não tem permissão para abrir esta pasta.",
            DirectoryNotFoundException => "Esta pasta não está mais disponível.",
            DriveNotFoundException => "Esta unidade não está disponível.",
            IOException => "Não foi possível ler esta pasta ou unidade.",
            _ => "Não foi possível abrir esta pasta."
        };

        private async Task SendDoorpiFileBrowserVisualAsync(
            DoorpiFileBrowserSession session,
            string requestedPath,
            bool isDirectoryHint)
        {
            if (string.IsNullOrWhiteSpace(requestedPath))
                return;

            await _doorpiFileBrowserVisualGate.WaitAsync();
            try
            {
                var visual = await Task.Run(() => GetDoorpiFileBrowserVisual(requestedPath, isDirectoryHint));
                if (_doorpiFileBrowserSession?.Id != session.Id)
                    return;

                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "doorpiFileBrowserVisual",
                    sessionId = session.Id,
                    path = requestedPath,
                    kind = visual.Kind,
                    dataUrl = visual.DataUrl
                }));
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[FileBrowser] Falha ao criar visual: " + ex.Message);
            }
            finally
            {
                _doorpiFileBrowserVisualGate.Release();
            }
        }

        private (string Kind, string DataUrl) GetDoorpiFileBrowserVisual(
            string requestedPath,
            bool isDirectoryHint)
        {
            try
            {
                string fullPath = Path.GetFullPath(requestedPath);
                bool existsAsDirectory = Directory.Exists(fullPath);
                bool existsAsFile = File.Exists(fullPath);
                bool isDirectory = existsAsDirectory || (!existsAsFile && isDirectoryHint);
                bool isFile = existsAsFile || (!existsAsDirectory && !isDirectoryHint);

                string extension = isFile ? Path.GetExtension(fullPath).ToLowerInvariant() : "";
                long stamp = 0;
                long length = 0;
                try
                {
                    stamp = isFile
                        ? File.GetLastWriteTimeUtc(fullPath).Ticks
                        : Directory.GetLastWriteTimeUtc(fullPath).Ticks;
                    length = existsAsFile ? new FileInfo(fullPath).Length : 0;
                }
                catch { }
                string cacheKey = $"{fullPath}|{stamp}|{length}|{isDirectory}";
                if (_doorpiFileBrowserVisualCache.TryGetValue(cacheKey, out var cached))
                    return cached;

                (string Kind, string DataUrl) visual = ("", "");
                if (isFile && DoorpiFileBrowserImageExtensions.Contains(extension))
                {
                    string preview = CreateDoorpiFileBrowserImagePreview(fullPath, extension, length);
                    if (!string.IsNullOrWhiteSpace(preview))
                        visual = ("preview", preview);
                }

                if (string.IsNullOrWhiteSpace(visual.DataUrl))
                {
                    string icon = CreateDoorpiFileBrowserShellIcon(
                        fullPath,
                        isDirectory,
                        existsAsDirectory || existsAsFile);
                    if (!string.IsNullOrWhiteSpace(icon))
                        visual = ("icon", icon);
                }

                if (!string.IsNullOrWhiteSpace(visual.DataUrl))
                {
                    if (_doorpiFileBrowserVisualCache.Count > 512)
                        _doorpiFileBrowserVisualCache.Clear();
                    _doorpiFileBrowserVisualCache[cacheKey] = visual;
                }

                return visual;
            }
            catch
            {
                return ("", "");
            }
        }

        private static string CreateDoorpiFileBrowserImagePreview(string path, string extension, long length)
        {
            try
            {
                using var source = Image.FromFile(path);
                const int maxWidth = 320;
                const int maxHeight = 200;
                double scale = Math.Min((double)maxWidth / source.Width, (double)maxHeight / source.Height);
                int width = Math.Max(1, (int)Math.Round(source.Width * scale));
                int height = Math.Max(1, (int)Math.Round(source.Height * scale));

                using var thumbnail = new Bitmap(width, height, PixelFormat.Format32bppArgb);
                using (Graphics graphics = Graphics.FromImage(thumbnail))
                {
                    graphics.CompositingQuality = CompositingQuality.HighQuality;
                    graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    graphics.SmoothingMode = SmoothingMode.HighQuality;
                    graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    graphics.DrawImage(source, 0, 0, width, height);
                }

                using var stream = new MemoryStream();
                thumbnail.Save(stream, ImageFormat.Png);
                return "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
            }
            catch
            {
                // GDI+ não decodifica WebP em todas as instalações. Para arquivos
                // pequenos, o próprio WebView consegue exibir o formato original.
                if (extension.Equals(".webp", StringComparison.OrdinalIgnoreCase) && length <= 8 * 1024 * 1024)
                {
                    try
                    {
                        return "data:image/webp;base64," + Convert.ToBase64String(File.ReadAllBytes(path));
                    }
                    catch { }
                }
                return "";
            }
        }

        private static string CreateDoorpiFileBrowserShellIcon(
            string path,
            bool isDirectory,
            bool exists)
        {
            var info = new DoorpiShellFileInfo();
            uint attributes = isDirectory ? FileAttributeDirectory : FileAttributeNormal;
            uint flags = ShgfiIcon | ShgfiLargeIcon;
            if (!exists)
                flags |= ShgfiUseFileAttributes;
            IntPtr result = SHGetFileInfo(path, attributes, ref info,
                (uint)Marshal.SizeOf<DoorpiShellFileInfo>(), flags);
            if (result == IntPtr.Zero || info.IconHandle == IntPtr.Zero)
                return "";

            try
            {
                using var borrowed = System.Drawing.Icon.FromHandle(info.IconHandle);
                using var icon = (System.Drawing.Icon)borrowed.Clone();
                using var bitmap = icon.ToBitmap();
                using var stream = new MemoryStream();
                bitmap.Save(stream, ImageFormat.Png);
                return "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
            }
            finally
            {
                DestroyIcon(info.IconHandle);
            }
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct DoorpiShellFileInfo
        {
            public IntPtr IconHandle;
            public int IconIndex;
            public uint Attributes;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string DisplayName;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string TypeName;
        }

        private const uint ShgfiIcon = 0x000000100;
        private const uint ShgfiLargeIcon = 0x000000000;
        private const uint ShgfiUseFileAttributes = 0x000000010;
        private const uint FileAttributeDirectory = 0x00000010;
        private const uint FileAttributeNormal = 0x00000080;

        [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr SHGetFileInfo(
            string path,
            uint fileAttributes,
            ref DoorpiShellFileInfo fileInfo,
            uint fileInfoSize,
            uint flags);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool DestroyIcon(IntPtr iconHandle);

        private delegate uint DoorpiCopyProgressRoutine(
            long totalFileSize,
            long totalBytesTransferred,
            long streamSize,
            long streamBytesTransferred,
            uint streamNumber,
            uint callbackReason,
            IntPtr sourceFile,
            IntPtr destinationFile,
            IntPtr data);

        private const uint CopyFileFailIfExists = 0x00000001;
        private const uint CopyFileNoBuffering = 0x00001000;
        private const uint CopyProgressContinue = 0;
        private const int ErrorCallNotImplemented = 120;
        private const long DoorpiLargeCopyThreshold = 256L * 1024 * 1024;

        [DllImport("kernel32.dll", EntryPoint = "CopyFileExW", CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CopyFileEx(
            string existingFileName,
            string newFileName,
            DoorpiCopyProgressRoutine? progressRoutine,
            IntPtr data,
            IntPtr cancel,
            uint copyFlags);

        private async Task HandleDoorpiFileBrowserOperationAsync(
            DoorpiFileBrowserSession session,
            JsonElement root)
        {
            string operation = GetStr(root, "operation");
            string path = GetStr(root, "path");
            string destination = GetStr(root, "destination");
            string currentPath = GetStr(root, "currentPath");
            string newName = GetStr(root, "newName");
            string conflictMode = GetStr(root, "conflictMode");

            try
            {
                string? resultPath = null;
                bool beginExternalFileControl = false;
                switch (operation)
                {
                    case "open":
                        if (!session.Standalone)
                            throw new InvalidOperationException("Arquivos só podem ser executados no explorador de arquivos.");
                        resultPath = await LaunchDoorpiExternalFileAsync(path);
                        beginExternalFileControl = true;
                        break;
                    case "rename":
                        resultPath = await Task.Run(() => RenameDoorpiFileBrowserEntry(path, newName));
                        break;
                    case "createFolder":
                        resultPath = await Task.Run(() => CreateDoorpiFileBrowserFolder(currentPath, newName));
                        break;
                    case "move":
                    {
                        long lastProgressAt = 0;
                        resultPath = await Task.Run(() => MoveDoorpiFileBrowserEntry(
                            path,
                            destination,
                            conflictMode,
                            (processed, total, currentName) =>
                            {
                                long now = Environment.TickCount64;
                                if (total > 0 && processed < total && now - lastProgressAt < 100)
                                    return;
                                lastProgressAt = now;
                                PostDoorpiFileBrowserProgress(
                                    session.Id,
                                    operation,
                                    processed,
                                    total,
                                    currentName);
                            }));
                        break;
                    }
                    case "recycle":
                        await Task.Run(() => RecycleDoorpiFileBrowserEntry(path));
                        break;
                    case "delete":
                        await Task.Run(() => DeleteDoorpiFileBrowserEntry(path));
                        break;
                    case "extractHere":
                    case "extractFolder":
                        resultPath = await Task.Run(() => ExtractDoorpiFileBrowserArchive(
                            path,
                            operation == "extractFolder",
                            false,
                            conflictMode));
                        break;
                    case "extractWinRarHere":
                    case "extractWinRarFolder":
                        resultPath = await Task.Run(() => ExtractDoorpiFileBrowserArchive(
                            path,
                            operation == "extractWinRarFolder",
                            true,
                            conflictMode));
                        break;
                    case "addGame":
                    case "addApp":
                        await AddDoorpiFileBrowserEntryToLibraryAsync(path, operation == "addApp");
                        break;
                    default:
                        throw new InvalidOperationException("Operação de arquivo desconhecida.");
                }

                if (operation is "rename" or "createFolder" or "move" or "recycle" or "delete" or
                    "extractHere" or "extractFolder" or "extractWinRarHere" or "extractWinRarFolder")
                    _doorpiFileBrowserVisualCache.Clear();

                string message = operation switch
                {
                    "open" => "Arquivo executado.",
                    "rename" => "Item renomeado.",
                    "createFolder" => "Pasta criada.",
                    "move" => "Item movido.",
                    "recycle" => "Item movido para a Lixeira.",
                    "delete" => "Item excluído permanentemente.",
                    "extractHere" or "extractFolder" or "extractWinRarHere" or "extractWinRarFolder" => "Arquivo descompactado.",
                    "addGame" => "Arquivo adicionado em Jogos.",
                    "addApp" => "Arquivo adicionado em Apps.",
                    _ => "Operação concluída."
                };
                PostDoorpiFileBrowserOperationResult(
                    session.Id,
                    operation,
                    true,
                    message,
                    currentPath,
                    resultPath ?? "");
                if (beginExternalFileControl)
                {
                    await Dispatcher.InvokeAsync(
                        () => { },
                        System.Windows.Threading.DispatcherPriority.Render);
                    await Task.Delay(120);
                    BeginDoorpiExternalFileControlMode();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[FileBrowser] Operação '{operation}' falhou: {ex}");
                PostDoorpiFileBrowserOperationResult(
                    session.Id,
                    operation,
                    false,
                    FriendlyDoorpiFileBrowserOperationError(ex),
                    currentPath);
            }
        }

        private static string RenameDoorpiFileBrowserEntry(string sourcePath, string newName)
        {
            string source = Path.GetFullPath(sourcePath);
            string cleanName = (newName ?? "").Trim();
            if (string.IsNullOrWhiteSpace(cleanName) || cleanName is "." or ".." ||
                cleanName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 ||
                !string.Equals(Path.GetFileName(cleanName), cleanName, StringComparison.Ordinal))
                throw new ArgumentException("Escolha um nome válido.");

            string? parent = Directory.GetParent(source.TrimEnd(Path.DirectorySeparatorChar))?.FullName;
            if (string.IsNullOrWhiteSpace(parent))
                throw new InvalidOperationException("Esta unidade não pode ser renomeada.");

            string target = Path.Combine(parent, cleanName);
            if (File.Exists(target) || Directory.Exists(target))
                throw new IOException("Já existe um item com esse nome.");

            if (Directory.Exists(source))
                Directory.Move(source, target);
            else if (File.Exists(source))
                File.Move(source, target);
            else
                throw new FileNotFoundException("O item não está mais disponível.", source);
            return target;
        }

        private static string CreateDoorpiFileBrowserFolder(string parentPath, string newName)
        {
            if (string.IsNullOrWhiteSpace(parentPath))
                throw new DirectoryNotFoundException("Abra uma unidade ou pasta antes de criar uma nova pasta.");
            string parent = Path.GetFullPath(parentPath);
            if (!Directory.Exists(parent))
                throw new DirectoryNotFoundException("Abra uma pasta válida antes de criar uma nova pasta.");

            string cleanName = (newName ?? "").Trim();
            if (string.IsNullOrWhiteSpace(cleanName) || cleanName is "." or ".." ||
                cleanName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 ||
                !string.Equals(Path.GetFileName(cleanName), cleanName, StringComparison.Ordinal) ||
                cleanName.EndsWith(".", StringComparison.Ordinal))
                throw new ArgumentException("Escolha um nome de pasta válido.");

            string target = Path.Combine(parent, cleanName);
            if (File.Exists(target) || Directory.Exists(target))
                throw new IOException("Já existe um item com esse nome.");

            Directory.CreateDirectory(target);
            return target;
        }

        private static string MoveDoorpiFileBrowserEntry(
            string sourcePath,
            string destinationPath,
            string conflictMode,
            Action<long, long, string>? progress)
        {
            string source = Path.GetFullPath(sourcePath).TrimEnd(Path.DirectorySeparatorChar);
            string destination = Path.GetFullPath(destinationPath).TrimEnd(Path.DirectorySeparatorChar);
            if (!Directory.Exists(destination))
                throw new DirectoryNotFoundException("Abra uma pasta válida para colar o item.");

            bool isDirectory = Directory.Exists(source);
            bool isFile = File.Exists(source);
            if (!isDirectory && !isFile)
                throw new FileNotFoundException("O item recortado não está mais disponível.", source);

            if (isDirectory && destination.StartsWith(source + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                throw new IOException("Uma pasta não pode ser movida para dentro dela mesma.");

            string target = Path.Combine(destination, Path.GetFileName(source));
            if (string.Equals(source, target, StringComparison.OrdinalIgnoreCase))
                throw new IOException("O item recortado já está nesta pasta.");
            bool targetExists = File.Exists(target) || Directory.Exists(target);
            bool replaceExisting = targetExists && string.Equals(conflictMode, "replace", StringComparison.OrdinalIgnoreCase);
            if (targetExists)
            {
                if (string.Equals(conflictMode, "keepBoth", StringComparison.OrdinalIgnoreCase))
                    target = CreateUniqueDoorpiFileBrowserPath(target, isDirectory);
                else if (!replaceExisting)
                    throw new IOException("Já existe um item com esse nome na pasta de destino.");
            }
            string finalTarget = target;
            string transferTarget = replaceExisting
                ? CreateDoorpiFileBrowserStagingPath(finalTarget)
                : finalTarget;

            bool sameVolume = string.Equals(
                Path.GetPathRoot(source),
                Path.GetPathRoot(transferTarget),
                StringComparison.OrdinalIgnoreCase);
            if (sameVolume)
            {
                if (isDirectory) Directory.Move(source, transferTarget);
                else File.Move(source, transferTarget);
                if (replaceExisting)
                {
                    try
                    {
                        FinalizeDoorpiFileBrowserReplacement(transferTarget, finalTarget, isDirectory);
                    }
                    catch
                    {
                        try
                        {
                            if (isDirectory && Directory.Exists(transferTarget)) Directory.Move(transferTarget, source);
                            else if (!isDirectory && File.Exists(transferTarget)) File.Move(transferTarget, source);
                        }
                        catch { }
                        throw;
                    }
                }
                progress?.Invoke(1, 1, Path.GetFileName(source));
                return finalTarget;
            }

            if (isDirectory)
            {
                DoorpiMovePlan plan = BuildDoorpiMovePlan(source, transferTarget);
                bool copied = false;
                try
                {
                    ExecuteDoorpiMovePlan(plan, progress);
                    copied = true;
                    if (replaceExisting)
                        FinalizeDoorpiFileBrowserReplacement(transferTarget, finalTarget, true);
                    Directory.Delete(source, true);
                }
                catch
                {
                    // Antes do fim da cópia, o destino parcial pode ser removido com
                    // segurança. Se a remoção da origem já começou, conservamos a
                    // cópia completa no destino para nunca transformar uma falha de
                    // limpeza em perda de dados.
                    if (!copied || (replaceExisting && Directory.Exists(source)))
                    {
                        try { if (Directory.Exists(transferTarget)) Directory.Delete(transferTarget, true); } catch { }
                    }
                    throw;
                }
            }
            else
            {
                long total = new FileInfo(source).Length;
                bool copied = false;
                try
                {
                    CopyDoorpiFileWithProgress(source, transferTarget, 0, total, progress);
                    copied = true;
                    if (replaceExisting)
                        FinalizeDoorpiFileBrowserReplacement(transferTarget, finalTarget, false);
                    File.Delete(source);
                }
                catch
                {
                    if (!copied || (replaceExisting && File.Exists(source)))
                    {
                        try { if (File.Exists(transferTarget)) File.Delete(transferTarget); } catch { }
                    }
                    throw;
                }
            }
            return finalTarget;
        }

        private static DoorpiMovePlan BuildDoorpiMovePlan(string source, string target)
        {
            var directories = new List<string> { target };
            var files = new List<DoorpiMoveFile>();
            long totalBytes = 0;

            void Walk(string currentSource, string currentTarget)
            {
                foreach (string directory in Directory.EnumerateDirectories(currentSource, "*", SearchOption.TopDirectoryOnly))
                {
                    if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0)
                        throw new IOException("A pasta contém um vínculo do sistema e não pode ser movida entre unidades com segurança.");
                    string childTarget = Path.Combine(currentTarget, Path.GetFileName(directory));
                    directories.Add(childTarget);
                    Walk(directory, childTarget);
                }
                foreach (string file in Directory.EnumerateFiles(currentSource, "*", SearchOption.TopDirectoryOnly))
                {
                    if ((File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0)
                        throw new IOException("A pasta contém um vínculo do sistema e não pode ser movida entre unidades com segurança.");
                    var info = new FileInfo(file);
                    files.Add(new DoorpiMoveFile(file, Path.Combine(currentTarget, info.Name), info.Length));
                    totalBytes = checked(totalBytes + info.Length);
                }
            }

            Walk(source, target);
            return new DoorpiMovePlan(directories, files, totalBytes);
        }

        private static void ExecuteDoorpiMovePlan(
            DoorpiMovePlan plan,
            Action<long, long, string>? progress)
        {
            foreach (string directory in plan.Directories)
                Directory.CreateDirectory(directory);

            long processed = 0;
            progress?.Invoke(0, plan.TotalBytes, "Preparando transferência");
            foreach (DoorpiMoveFile file in plan.Files)
            {
                CopyDoorpiFileWithProgress(file.Source, file.Target, processed, plan.TotalBytes, progress);
                processed += file.Length;
                try
                {
                    File.SetLastWriteTimeUtc(file.Target, File.GetLastWriteTimeUtc(file.Source));
                    File.SetAttributes(file.Target, File.GetAttributes(file.Source));
                }
                catch { }
            }
            progress?.Invoke(plan.TotalBytes, plan.TotalBytes, "Concluindo movimento");
        }

        private static void CopyDoorpiFileWithProgress(
            string source,
            string target,
            long alreadyProcessed,
            long totalBytes,
            Action<long, long, string>? progress)
        {
            try
            {
                CopyDoorpiFileWithWindows(source, target, alreadyProcessed, totalBytes, progress);
            }
            catch (DllNotFoundException)
            {
                DeletePartialDoorpiCopy(target);
                CopyDoorpiFileManaged(source, target, alreadyProcessed, totalBytes, progress);
            }
            catch (EntryPointNotFoundException)
            {
                DeletePartialDoorpiCopy(target);
                CopyDoorpiFileManaged(source, target, alreadyProcessed, totalBytes, progress);
            }
        }

        private static void CopyDoorpiFileWithWindows(
            string source,
            string target,
            long alreadyProcessed,
            long totalBytes,
            Action<long, long, string>? progress)
        {
            string currentName = Path.GetFileName(source);
            long fileLength = new FileInfo(source).Length;
            uint flags = CopyFileFailIfExists;
            if (fileLength >= DoorpiLargeCopyThreshold)
                flags |= CopyFileNoBuffering;

            DoorpiCopyProgressRoutine progressRoutine = (
                _, totalBytesTransferred, _, _, _, _, _, _, _) =>
            {
                try
                {
                    progress?.Invoke(
                        alreadyProcessed + totalBytesTransferred,
                        totalBytes,
                        currentName);
                }
                catch
                {
                    // Falhas apenas na atualizaÃ§Ã£o visual nÃ£o devem interromper
                    // uma cÃ³pia que o Windows jÃ¡ estÃ¡ executando.
                }
                return CopyProgressContinue;
            };

            bool copied = CopyFileEx(
                source,
                target,
                progressRoutine,
                IntPtr.Zero,
                IntPtr.Zero,
                flags);
            GC.KeepAlive(progressRoutine);

            if (copied)
                return;

            int error = Marshal.GetLastWin32Error();
            DeletePartialDoorpiCopy(target);
            if (error == ErrorCallNotImplemented)
            {
                CopyDoorpiFileManaged(source, target, alreadyProcessed, totalBytes, progress);
                return;
            }

            throw new IOException(
                $"O Windows nÃ£o conseguiu copiar '{currentName}'.",
                new Win32Exception(error));
        }

        private static void CopyDoorpiFileManaged(
            string source,
            string target,
            long alreadyProcessed,
            long totalBytes,
            Action<long, long, string>? progress)
        {
            const int bufferSize = 4 * 1024 * 1024;
            byte[] buffer = new byte[bufferSize];
            using var input = new FileStream(source, FileMode.Open, FileAccess.Read, FileShare.Read, bufferSize, FileOptions.SequentialScan);
            using var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None, bufferSize, FileOptions.SequentialScan);
            long copied = 0;
            int read;
            while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
            {
                output.Write(buffer, 0, read);
                copied += read;
                progress?.Invoke(alreadyProcessed + copied, totalBytes, Path.GetFileName(source));
            }
        }

        private static void DeletePartialDoorpiCopy(string target)
        {
            try
            {
                if (File.Exists(target))
                    File.Delete(target);
            }
            catch { }
        }

        private static string CreateUniqueDoorpiFileBrowserPath(string desiredPath, bool isDirectory)
        {
            string? parent = Path.GetDirectoryName(desiredPath);
            if (string.IsNullOrWhiteSpace(parent))
                throw new IOException("Não foi possível criar um nome alternativo neste local.");
            string extension = isDirectory ? "" : Path.GetExtension(desiredPath);
            string baseName = isDirectory
                ? Path.GetFileName(desiredPath)
                : Path.GetFileNameWithoutExtension(desiredPath);
            for (int index = 1; index < 10_000; index++)
            {
                string candidate = Path.Combine(parent, $"{baseName} ({index}){extension}");
                if (!File.Exists(candidate) && !Directory.Exists(candidate))
                    return candidate;
            }
            throw new IOException("Não foi possível encontrar um nome livre para o item.");
        }

        private static string CreateDoorpiFileBrowserStagingPath(string finalPath)
        {
            string? parent = Path.GetDirectoryName(finalPath);
            if (string.IsNullOrWhiteSpace(parent))
                throw new IOException("Não foi possível preparar a substituição neste local.");
            string name = Path.GetFileName(finalPath);
            string candidate;
            do
            {
                candidate = Path.Combine(parent, $".doorpi-replace-{Guid.NewGuid():N}-{name}");
            } while (File.Exists(candidate) || Directory.Exists(candidate));
            return candidate;
        }

        private static void FinalizeDoorpiFileBrowserReplacement(
            string stagedPath,
            string finalPath,
            bool isDirectory)
        {
            // A versão nova já está completa antes de remover definitivamente a
            // anterior. Isso evita perder o item existente por uma cópia interrompida.
            DeleteDoorpiFileBrowserEntry(finalPath);
            if (isDirectory) Directory.Move(stagedPath, finalPath);
            else File.Move(stagedPath, finalPath);
        }

        private static void RecycleDoorpiFileBrowserEntry(string path)
        {
            string fullPath = Path.GetFullPath(path);
            if (Directory.Exists(fullPath))
            {
                Microsoft.VisualBasic.FileIO.FileSystem.DeleteDirectory(
                    fullPath,
                    Microsoft.VisualBasic.FileIO.UIOption.OnlyErrorDialogs,
                    Microsoft.VisualBasic.FileIO.RecycleOption.SendToRecycleBin,
                    Microsoft.VisualBasic.FileIO.UICancelOption.ThrowException);
            }
            else if (File.Exists(fullPath))
            {
                Microsoft.VisualBasic.FileIO.FileSystem.DeleteFile(
                    fullPath,
                    Microsoft.VisualBasic.FileIO.UIOption.OnlyErrorDialogs,
                    Microsoft.VisualBasic.FileIO.RecycleOption.SendToRecycleBin,
                    Microsoft.VisualBasic.FileIO.UICancelOption.ThrowException);
            }
            else
            {
                throw new FileNotFoundException("O item não está mais disponível.", fullPath);
            }
        }

        private static void DeleteDoorpiFileBrowserEntry(string path)
        {
            string fullPath = Path.GetFullPath(path);
            if (Directory.Exists(fullPath)) Directory.Delete(fullPath, true);
            else if (File.Exists(fullPath)) File.Delete(fullPath);
            else throw new FileNotFoundException("O item não está mais disponível.", fullPath);
        }

        private static string ExtractDoorpiFileBrowserArchive(
            string archivePath,
            bool createFolder,
            bool forceWinRar,
            string conflictMode)
        {
            string archive = Path.GetFullPath(archivePath);
            if (!File.Exists(archive))
                throw new FileNotFoundException("O arquivo compactado não está mais disponível.", archive);

            string extension = Path.GetExtension(archive).ToLowerInvariant();
            if (!DoorpiFileBrowserArchiveExtensions.Contains(extension))
                throw new NotSupportedException("Este formato compactado ainda não é compatível.");

            string parent = Path.GetDirectoryName(archive) ?? throw new DirectoryNotFoundException();
            string finalDestination = createFolder
                ? Path.Combine(parent, Path.GetFileNameWithoutExtension(archive))
                : parent;
            bool destinationExists = createFolder &&
                                     (Directory.Exists(finalDestination) || File.Exists(finalDestination));
            bool replaceExisting = destinationExists &&
                                   string.Equals(conflictMode, "replace", StringComparison.OrdinalIgnoreCase);
            if (destinationExists)
            {
                if (string.Equals(conflictMode, "keepBoth", StringComparison.OrdinalIgnoreCase))
                    finalDestination = CreateUniqueDoorpiFileBrowserPath(finalDestination, true);
                else if (!replaceExisting)
                    throw new IOException("A pasta de destino já existe.");
            }
            string extractionDestination = replaceExisting
                ? CreateDoorpiFileBrowserStagingPath(finalDestination)
                : finalDestination;
            bool ownsExtractionDestination = createFolder &&
                                                !Directory.Exists(extractionDestination) &&
                                                !File.Exists(extractionDestination);
            bool extractionCompleted = false;
            try
            {
                Directory.CreateDirectory(extractionDestination);

                if (!forceWinRar && extension == ".zip")
                {
                    ZipFile.ExtractToDirectory(archive, extractionDestination, false);
                }
                else
                {
                    string winRar = FindDoorpiWinRarPath() ??
                                    throw new NotSupportedException("Instale o WinRAR para descompactar arquivos RAR ou 7Z.");
                    var startInfo = new ProcessStartInfo
                    {
                        FileName = winRar,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    startInfo.ArgumentList.Add("x");
                    startInfo.ArgumentList.Add("-o-");
                    startInfo.ArgumentList.Add("-ibck");
                    startInfo.ArgumentList.Add(archive);
                    startInfo.ArgumentList.Add(extractionDestination + Path.DirectorySeparatorChar);
                    using Process process = Process.Start(startInfo) ?? throw new IOException("Não foi possível iniciar o WinRAR.");
                    process.WaitForExit();
                    if (process.ExitCode != 0)
                        throw new IOException($"O WinRAR encerrou com o código {process.ExitCode}.");
                }

                extractionCompleted = true;
                if (replaceExisting)
                    FinalizeDoorpiFileBrowserReplacement(extractionDestination, finalDestination, true);
                return finalDestination;
            }
            catch
            {
                if (ownsExtractionDestination && !extractionCompleted)
                {
                    try { if (Directory.Exists(extractionDestination)) Directory.Delete(extractionDestination, true); } catch { }
                }
                throw;
            }
        }

        private static string? FindDoorpiWinRarPath()
        {
            string[] registryKeys =
            {
                @"HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\WinRAR.exe",
                @"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\WinRAR.exe"
            };
            foreach (string key in registryKeys)
            {
                try
                {
                    if (Registry.GetValue(key, "", null) is string value)
                    {
                        string candidate = value.Trim().Trim('"');
                        if (File.Exists(candidate)) return candidate;
                    }
                }
                catch { }
            }

            string[] candidates =
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "WinRAR", "WinRAR.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "WinRAR", "WinRAR.exe")
            };
            return candidates.FirstOrDefault(File.Exists);
        }

        private async Task AddDoorpiFileBrowserEntryToLibraryAsync(string path, bool mediaApp)
        {
            string fullPath = Path.GetFullPath(path);
            if (!File.Exists(fullPath) || !DoorpiFileBrowserLaunchExtensions.Contains(Path.GetExtension(fullPath)))
                throw new NotSupportedException("Este tipo de arquivo não pode ser adicionado à biblioteca.");

            string cleanName = GetGameNameFromFile(fullPath) ?? Path.GetFileNameWithoutExtension(fullPath);
            var item = new InstalledApp
            {
                Name = cleanName,
                Path = fullPath,
                IconBase64 = GetCachedIcon(fullPath)
            };
            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
            {
                type = "showLoadingCards",
                count = 1,
                tab = mediaApp ? "media" : "games"
            }));
            if (mediaApp)
                await Task.Run(async () => await AddMultipleMediaAppsAsync(new List<InstalledApp> { item }));
            else
                await Task.Run(async () => await AddMultipleGamesAsync(new List<InstalledApp> { item }));
        }

        private static string FriendlyDoorpiFileBrowserOperationError(Exception ex) => ex switch
        {
            UnauthorizedAccessException => "Você não tem permissão para concluir esta operação.",
            FileNotFoundException => ex.Message,
            DirectoryNotFoundException => ex.Message,
            NotSupportedException => ex.Message,
            ArgumentException => ex.Message,
            InvalidOperationException => ex.Message,
            IOException => ex.Message,
            _ => "Não foi possível concluir a operação."
        };

        private void PostDoorpiFileBrowserOperationResult(
            string sessionId,
            string operation,
            bool success,
            string message,
            string refreshPath = "",
            string resultPath = "")
        {
            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
            {
                type = "doorpiFileBrowserOperationResult",
                sessionId,
                operation,
                success,
                message,
                refreshPath,
                resultPath
            }));
        }

        private void PostDoorpiFileBrowserProgress(
            string sessionId,
            string operation,
            long processedBytes,
            long totalBytes,
            string currentName)
        {
            Dispatcher.BeginInvoke(() =>
            {
                if (_doorpiFileBrowserSession?.Id != sessionId)
                    return;
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "doorpiFileBrowserProgress",
                    sessionId,
                    operation,
                    processedBytes,
                    totalBytes,
                    currentName
                }));
            });
        }

        private void PostDoorpiFileBrowserError(string sessionId, string message)
        {
            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
            {
                type = "doorpiFileBrowserError",
                sessionId,
                message
            }));
        }

        private void CloseDoorpiFileBrowser(DoorpiFileBrowserSession session, string? result)
        {
            if (_doorpiFileBrowserSession?.Id != session.Id)
                return;

            _doorpiFileBrowserSession = null;
            ClearDoorpiFileBrowserImageMapping();
            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
            {
                type = "doorpiFileBrowserClose",
                sessionId = session.Id
            }));
            session.Completion.TrySetResult(result);
            if (session.Standalone)
                ScheduleWatchedFolderRefresh("fechamento do explorador de arquivos");
            if (session.ReturnToBrowserOnClose)
                RestoreGenericBrowserAfterDoorpiFileExplorerClose();
        }
    }
}
