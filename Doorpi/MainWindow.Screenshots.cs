using System.Drawing;
using System.Drawing.Imaging;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Media.Imaging;
using Doorpi.ProfileSync;
using Doorpi.Storage;

namespace Doorpi;

public partial class MainWindow
{
    private static readonly JsonSerializerOptions ScreenshotJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };
    private static readonly object ScreenshotGalleryLock = new();
    private static readonly SemaphoreSlim ScreenshotGalleryMutationGate = new(1, 1);
    private ControlProfile[]? _screenshotProfiles;
    private ControlBindingRoute[] _screenshotRoutes = Array.Empty<ControlBindingRoute>();
    private long?[,] _screenshotPressedAt = new long?[0, 0];
    private int _screenshotCaptureInProgress;
    private static readonly object ScreenshotShareLock = new();
    private CancellationTokenSource? _screenshotShareCancellation;
    private BrowserWindowSession? _screenshotShareBrowser;
    private ScreenshotShareReturnOverlay? _screenshotShareOverlay;
    private Thread? _screenshotShareInputThread;
    private volatile bool _screenshotShareActive;

    private sealed class ScreenshotGalleryDocument
    {
        public int SchemaVersion { get; set; } = 1;
        public string RootDirectory { get; set; } = "";
        public List<GameScreenshotRecord> Items { get; set; } = new();
    }

    private sealed class GameScreenshotRecord
    {
        public string Id { get; set; } = "";
        public string GameId { get; set; } = "";
        public string GameName { get; set; } = "";
        public string ImagePath { get; set; } = "";
        public string ThumbnailPath { get; set; } = "";
        public DateTimeOffset CapturedAtUtc { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
    }

    private sealed record ScreenshotLibraryMovedFile(string SourcePath, string DestinationPath);
    private sealed record ScreenshotLibraryMovePlan(string SourcePath, string DestinationPath);

    private static string ScreenshotCatalogPath(string userDataFolder)
        => Path.Combine(userDataFolder, "screenshots.json");

    private static string DefaultScreenshotRoot()
    {
        string pictures = Environment.GetFolderPath(Environment.SpecialFolder.MyPictures);
        if (string.IsNullOrWhiteSpace(pictures)) pictures = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return Path.Combine(pictures, "Doorpi", "Screenshots");
    }

    private static string ScreenshotRootSelectionPath(string screenshotRoot)
    {
        string fullRoot = FullScreenshotPath(screenshotRoot);
        var screenshotsDirectory = new DirectoryInfo(fullRoot);
        if (string.Equals(screenshotsDirectory.Name, "Screenshots", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(screenshotsDirectory.Parent?.Name, "Doorpi", StringComparison.OrdinalIgnoreCase) &&
            screenshotsDirectory.Parent?.Parent is DirectoryInfo selectedLocation)
            return selectedLocation.FullName;
        return fullRoot;
    }

    private static string ManagedScreenshotRoot(string selectedLocation)
        => Path.Combine(FullScreenshotPath(selectedLocation), "Doorpi", "Screenshots");

    private static ScreenshotGalleryDocument LoadScreenshotGallery(string userDataFolder)
    {
        string path = ScreenshotCatalogPath(userDataFolder);
        if (!StateStorage.Exists(path))
            return new ScreenshotGalleryDocument { RootDirectory = DefaultScreenshotRoot() };

        string json = StateStorage.ReadAllText(path);
        ScreenshotGalleryDocument? result = JsonSerializer.Deserialize<ScreenshotGalleryDocument>(json, ScreenshotJsonOptions);
        if (result == null || result.SchemaVersion != 1 || result.Items == null)
            throw new InvalidDataException("A galeria de capturas está corrompida.");
        if (string.IsNullOrWhiteSpace(result.RootDirectory)) result.RootDirectory = DefaultScreenshotRoot();
        return result;
    }

    private static void SaveScreenshotGallery(string userDataFolder, ScreenshotGalleryDocument document)
    {
        string path = ScreenshotCatalogPath(userDataFolder);
        StateStorage.WriteAllText(path, JsonSerializer.Serialize(document, ScreenshotJsonOptions), keepBackup: true);
    }

    private bool IsScreenshotUserActive(string userId, string userDataFolder)
        => string.Equals(currentUserId, userId, StringComparison.OrdinalIgnoreCase) &&
           string.Equals(currentUserDataFolder, userDataFolder, StringComparison.OrdinalIgnoreCase);

    private void SendScreenshotLibraryMoveProgress(bool active, int completed, int total, string? error = null)
    {
        void Send()
        {
            try
            {
                webView?.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(new
                {
                    type = "screenshotLibraryMoveProgress", active, completed, total, error
                }));
            }
            catch (Exception ex) { Debug.WriteLine("[Screenshots] Could not report library move progress: " + ex.Message); }
        }

        if (Dispatcher.CheckAccess()) Send();
        else _ = Dispatcher.BeginInvoke(new Action(Send));
    }

    private void SendScreenshotOperationError(string message)
    {
        try
        {
            webView?.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(new
            {
                type = "screenshotOperationError", message
            }));
        }
        catch (Exception ex) { Debug.WriteLine("[Screenshots] Could not report gallery operation error: " + ex.Message); }
    }

    private static string FullScreenshotPath(string path)
    {
        string fullPath = Path.GetFullPath(path);
        string root = Path.GetPathRoot(fullPath) ?? "";
        return fullPath.Length > root.Length
            ? fullPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            : fullPath;
    }

    private static bool ScreenshotPathIsWithin(string path, string root)
    {
        string fullPath = FullScreenshotPath(path);
        string fullRoot = FullScreenshotPath(root);
        if (string.Equals(fullPath, fullRoot, StringComparison.OrdinalIgnoreCase)) return true;
        string relative = Path.GetRelativePath(fullRoot, fullPath);
        return !Path.IsPathRooted(relative) && relative != ".." &&
               !relative.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal) &&
               !relative.StartsWith(".." + Path.AltDirectorySeparatorChar, StringComparison.Ordinal);
    }

    private static string UniqueScreenshotDestination(string path)
    {
        if (!File.Exists(path)) return path;
        string directory = Path.GetDirectoryName(path) ?? throw new IOException("Destino de captura inválido.");
        string name = Path.GetFileNameWithoutExtension(path);
        string extension = Path.GetExtension(path);
        for (int suffix = 2; ; suffix++)
        {
            string candidate = Path.Combine(directory, $"{name} ({suffix}){extension}");
            if (!File.Exists(candidate)) return candidate;
        }
    }

    private static List<ScreenshotLibraryMovedFile> MoveScreenshotLibraryFiles(
        string oldRoot,
        IReadOnlyList<ScreenshotLibraryMovePlan> files,
        IProgress<(int Completed, int Total)>? progress)
    {
        var moved = new List<ScreenshotLibraryMovedFile>(files.Count);
        try
        {
            for (int index = 0; index < files.Count; index++)
            {
                ScreenshotLibraryMovePlan plan = files[index];
                string source = Path.GetFullPath(plan.SourcePath);
                if (!ScreenshotPathIsWithin(source, oldRoot) ||
                    string.Equals(source, FullScreenshotPath(oldRoot), StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("Uma imagem está fora da pasta configurada da galeria.");

                string destination = Path.GetFullPath(plan.DestinationPath);
                string destinationDirectory = Path.GetDirectoryName(destination) ?? throw new IOException("Destino de captura inválido.");
                Directory.CreateDirectory(destinationDirectory);
                destination = UniqueScreenshotDestination(destination);
                string movedTo = MoveScreenshotLibraryFile(source, destination);
                moved.Add(new ScreenshotLibraryMovedFile(source, movedTo));
                progress?.Report((index + 1, files.Count));
            }

            RemoveEmptyScreenshotDirectories(oldRoot, moved);
            return moved;
        }
        catch
        {
            RollbackScreenshotLibraryFiles(moved);
            throw;
        }
    }

    private static void RollbackScreenshotLibraryFiles(IReadOnlyList<ScreenshotLibraryMovedFile> moved)
    {
        for (int index = moved.Count - 1; index >= 0; index--)
        {
            ScreenshotLibraryMovedFile file = moved[index];
            try
            {
                if (!File.Exists(file.DestinationPath)) continue;
                if (File.Exists(file.SourcePath))
                    throw new IOException("O arquivo de origem já existe durante a reversão.");
                Directory.CreateDirectory(Path.GetDirectoryName(file.SourcePath)!);
                MoveScreenshotLibraryFile(file.DestinationPath, file.SourcePath);
            }
            catch (Exception ex) { Debug.WriteLine("[Screenshots] Could not roll back moved file: " + ex.Message); }
        }
    }

    private static string MoveScreenshotLibraryFile(string sourcePath, string destinationPath)
    {
        string source = Path.GetFullPath(sourcePath);
        string destination = UniqueScreenshotDestination(Path.GetFullPath(destinationPath));
        if (string.Equals(source, destination, StringComparison.OrdinalIgnoreCase)) return source;
        Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
        string sourceVolume = Path.GetPathRoot(source) ?? "";
        string destinationVolume = Path.GetPathRoot(destination) ?? "";
        if (string.Equals(sourceVolume, destinationVolume, StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                File.Move(source, destination);
                return destination;
            }
            catch (IOException) when (File.Exists(source) && !File.Exists(destination))
            {
                // Mount points can cross volumes even when their textual roots match.
            }
        }

        string temporary = destination + ".doorpi-move-" + Guid.NewGuid().ToString("N") + ".tmp";
        bool destinationCreated = false;
        try
        {
            File.Copy(source, temporary);
            File.Move(temporary, destination);
            destinationCreated = true;
            File.Delete(source);
            return destination;
        }
        catch
        {
            try { if (File.Exists(temporary)) File.Delete(temporary); } catch { }
            if (destinationCreated && File.Exists(source))
            {
                try { File.Delete(destination); } catch { }
            }
            throw;
        }
    }

    private static void RemoveEmptyScreenshotDirectories(string root, IReadOnlyList<ScreenshotLibraryMovedFile> moved)
    {
        if (!Directory.Exists(root)) return;
        try
        {
            string normalizedRoot = FullScreenshotPath(root);
            var candidateDirectories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (ScreenshotLibraryMovedFile file in moved)
            {
                string? directory = Path.GetDirectoryName(file.SourcePath);
                while (!string.IsNullOrWhiteSpace(directory) &&
                       !string.Equals(FullScreenshotPath(directory), normalizedRoot, StringComparison.OrdinalIgnoreCase) &&
                       ScreenshotPathIsWithin(directory, normalizedRoot))
                {
                    candidateDirectories.Add(directory);
                    directory = Path.GetDirectoryName(directory);
                }
            }
            foreach (string directory in candidateDirectories.OrderByDescending(path => path.Length))
            {
                try
                {
                    if (Directory.Exists(directory) && !Directory.EnumerateFileSystemEntries(directory).Any())
                        Directory.Delete(directory);
                }
                catch { }
            }
        }
        catch (Exception ex) { Debug.WriteLine("[Screenshots] Could not clean old screenshot folders: " + ex.Message); }
    }

    private static ScreenshotLibraryMovePlan[] ScreenshotFilesRegisteredInGallery(
        ScreenshotGalleryDocument catalog,
        string oldRoot,
        string newRoot)
    {
        var files = new Dictionary<string, ScreenshotLibraryMovePlan>(StringComparer.OrdinalIgnoreCase);
        foreach (GameScreenshotRecord item in catalog.Items)
        {
            string gameFolder = SafeScreenshotFolderName(item.GameName);
            AddExistingImage(item.ImagePath, Path.Combine(newRoot, gameFolder, Path.GetFileName(item.ImagePath)));
            string thumbnailPath = item.ThumbnailPath;
            if (string.IsNullOrWhiteSpace(thumbnailPath))
            {
                string folder = Path.GetDirectoryName(item.ImagePath) ?? "";
                thumbnailPath = Path.Combine(folder, ".thumbnails", Path.GetFileNameWithoutExtension(item.ImagePath) + ".jpg");
            }
            AddExistingImage(thumbnailPath, Path.Combine(newRoot, gameFolder, ".thumbnails", Path.GetFileName(thumbnailPath)));
        }
        return files.Values.OrderBy(plan => plan.SourcePath, StringComparer.OrdinalIgnoreCase).ToArray();

        void AddExistingImage(string sourcePath, string destinationPath)
        {
            if (string.IsNullOrWhiteSpace(sourcePath) || string.IsNullOrWhiteSpace(destinationPath)) return;
            try
            {
                string fullSource = Path.GetFullPath(sourcePath);
                string fullDestination = Path.GetFullPath(destinationPath);
                if (!ScreenshotPathIsWithin(fullSource, oldRoot) || !File.Exists(fullSource) ||
                    string.Equals(fullSource, fullDestination, StringComparison.OrdinalIgnoreCase)) return;
                files.TryAdd(fullSource, new ScreenshotLibraryMovePlan(fullSource, fullDestination));
            }
            catch { }
        }
    }

    private static string MoveScreenshotFile(string sourcePath, string destinationPath)
    {
        string source = Path.GetFullPath(sourcePath);
        string destination = Path.GetFullPath(destinationPath);
        if (string.Equals(source, destination, StringComparison.OrdinalIgnoreCase)) return source;
        Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
        destination = UniqueScreenshotDestination(destination);
        File.Move(source, destination);
        return destination;
    }

    private void ProcessScreenshotShortcut(XInputSnapshot snapshot)
    {
        if (!_gameSessionActive || _gameIsMinimized || string.IsNullOrWhiteSpace(_activeSessionGameId))
        {
            _screenshotProfiles = null;
            return;
        }

        EnsureControlRuntimeProfilesLoaded();
        var profiles = Volatile.Read(ref _controlRuntimeProfiles);
        if (!ReferenceEquals(_screenshotProfiles, profiles))
        {
            _screenshotRoutes = profiles
                .Where(profile => profile.Enabled && !profile.IsBuiltIn && IsGlobalControlProfile(profile))
                .SelectMany(profile => profile.Bindings
                    .Where(binding => binding.Enabled && binding.Action is { Type: "system", SystemCommand: "screenshot" })
                    .SelectMany(binding => EnumerateControlBindingRoutes(profile, binding)))
                .ToArray();
            _screenshotPressedAt = new long?[XInputControllerHub.SlotCount, _screenshotRoutes.Length];
            _screenshotProfiles = profiles;
        }

        long now = Environment.TickCount64;
        bool capture = false;
        for (int slot = 0; slot < XInputControllerHub.SlotCount; slot++)
        {
            for (int index = 0; index < _screenshotRoutes.Length; index++)
            {
                var route = _screenshotRoutes[index];
                bool connected = (snapshot.ConnectedMask & (1 << slot)) != 0;
                bool active = connected && IsControlChordActive(snapshot.Slots[slot], route.ControllerButtons, route.Profile.MouseDeadZone);
                ref long? pressedAt = ref _screenshotPressedAt[slot, index];
                if (!active)
                {
                    capture |= connected && pressedAt.HasValue && route.Trigger == "release";
                    pressedAt = null;
                }
                else if (pressedAt == null)
                {
                    pressedAt = now;
                    capture |= route.Trigger is "press" or "hold";
                }
                else if (route.Trigger == "long-press" && pressedAt != long.MaxValue &&
                         now - pressedAt.Value >= route.LongPressDurationMs)
                {
                    capture = true;
                    pressedAt = long.MaxValue; // Fired; wait for this chord to be released.
                }
            }
        }
        if (capture) _ = CaptureActiveGameScreenshotAsync();
    }

    private async Task CaptureActiveGameScreenshotAsync()
    {
        if (Interlocked.Exchange(ref _screenshotCaptureInProgress, 1) != 0) return;

        try
        {
        string targetUserId = currentUserId;
        string targetUserDataFolder = currentUserDataFolder;
        string gameId = _activeSessionGameId;
        string gameName = string.IsNullOrWhiteSpace(_activeSessionGameName) ? "Jogo" : _activeSessionGameName.Trim();
        IntPtr gameWindow = _currentGameHwnd != IntPtr.Zero ? _currentGameHwnd : GetForegroundWindow();
        if (string.IsNullOrWhiteSpace(targetUserId) || string.IsNullOrWhiteSpace(targetUserDataFolder) ||
            string.IsNullOrWhiteSpace(gameId) || gameWindow == IntPtr.Zero)
        {
            Debug.WriteLine("[Screenshots] Capture ignored because there is no active game window/session.");
            return;
        }

        string catalogPath = ScreenshotCatalogPath(targetUserDataFolder);
        long targetCatalogRevision = StateStorage.GetRevision(catalogPath);
            byte[] png = await Task.Run(() => DxgiDesktopCapture.CapturePng(gameWindow)).ConfigureAwait(false);

            // A sessão guarda o usuário de destino antes do await. Se houve troca de perfil,
            // a captura transitória é descartada e nunca aparece no perfil ativo incorreto.
            if (!string.Equals(currentUserId, targetUserId, StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(currentUserDataFolder, targetUserDataFolder, StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(_activeSessionGameId, gameId, StringComparison.OrdinalIgnoreCase)) return;

            string? savedPath = null;
            await ScreenshotGalleryMutationGate.WaitAsync().ConfigureAwait(false);
            try
            {
                if (!string.Equals(currentUserId, targetUserId, StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(currentUserDataFolder, targetUserDataFolder, StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(_activeSessionGameId, gameId, StringComparison.OrdinalIgnoreCase)) return;

                lock (ScreenshotGalleryLock)
                {
                    long latestCatalogRevision = StateStorage.GetRevision(catalogPath);
                    if (latestCatalogRevision != targetCatalogRevision)
                        Debug.WriteLine("[Screenshots] Gallery changed during capture; merging into the current catalog revision.");
                    ScreenshotGalleryDocument catalog = LoadScreenshotGallery(targetUserDataFolder);
                    string storedRoot = FullScreenshotPath(catalog.RootDirectory);
                    string captureRoot = ManagedScreenshotRoot(ScreenshotRootSelectionPath(storedRoot));
                    if (!string.Equals(storedRoot, captureRoot, StringComparison.OrdinalIgnoreCase))
                    {
                        List<ScreenshotLibraryMovedFile> migrated = MoveScreenshotLibraryFiles(
                            storedRoot,
                            ScreenshotFilesRegisteredInGallery(catalog, storedRoot, captureRoot),
                            progress: null);
                        try
                        {
                            var migratedPaths = migrated.ToDictionary(file => FullScreenshotPath(file.SourcePath), file => file.DestinationPath,
                                StringComparer.OrdinalIgnoreCase);
                            foreach (GameScreenshotRecord existing in catalog.Items)
                            {
                                if (migratedPaths.TryGetValue(FullScreenshotPath(existing.ImagePath), out string? migratedImagePath))
                                    existing.ImagePath = migratedImagePath;
                                if (!string.IsNullOrWhiteSpace(existing.ThumbnailPath) &&
                                    migratedPaths.TryGetValue(FullScreenshotPath(existing.ThumbnailPath), out string? migratedThumbnailPath))
                                    existing.ThumbnailPath = migratedThumbnailPath;
                            }
                            catalog.RootDirectory = captureRoot;
                            SaveScreenshotGallery(targetUserDataFolder, catalog);
                        }
                        catch
                        {
                            RollbackScreenshotLibraryFiles(migrated);
                            throw;
                        }
                    }

                    string folder = Path.Combine(Path.GetFullPath(catalog.RootDirectory), SafeScreenshotFolderName(gameName));
                    Directory.CreateDirectory(folder);
                    string id = Guid.NewGuid().ToString("N");
                    string fileName = DateTime.Now.ToString("yyyyMMdd-HHmmss-fff") + "-" + id[..8] + ".png";
                    string imagePath = Path.Combine(folder, fileName);
                    File.WriteAllBytes(imagePath, png);

                    var dims = DxgiDesktopCapture.ReadPngDimensions(png);
                    string thumbnailPath = Path.Combine(folder, ".thumbnails", Path.GetFileNameWithoutExtension(fileName) + ".jpg");
                    Directory.CreateDirectory(Path.GetDirectoryName(thumbnailPath)!);
                    CreateScreenshotThumbnail(png, thumbnailPath);

                    catalog.Items.Add(new GameScreenshotRecord
                    {
                        Id = id,
                        GameId = gameId,
                        GameName = gameName,
                        ImagePath = imagePath,
                        ThumbnailPath = thumbnailPath,
                        CapturedAtUtc = DateTimeOffset.UtcNow,
                        Width = dims.Width,
                        Height = dims.Height
                    });
                    SaveScreenshotGallery(targetUserDataFolder, catalog);
                    savedPath = imagePath;
                }
            }
            finally
            {
                ScreenshotGalleryMutationGate.Release();
            }

            if (savedPath != null)
            {
                try { new System.Media.SoundPlayer(Path.Combine(AppContext.BaseDirectory, "wwwroot", "sounds", "screenshot.wav")).Play(); }
                catch (Exception ex) { Debug.WriteLine("[Screenshots] Capture sound failed: " + ex.Message); }
                _ = Dispatcher.BeginInvoke(() =>
                {
                    try
                    {
                        webView?.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(new
                        {
                            type = "screenshotSaved",
                            gameName,
                            imagePath = savedPath
                        }));
                    }
                    catch { }
                });
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Screenshots] Capture failed: " + ex.Message);
            _ = Dispatcher.BeginInvoke(() =>
            {
                try { webView?.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "screenshotError", message = ex.Message })); }
                catch { }
            });
        }
        finally
        {
            Volatile.Write(ref _screenshotCaptureInProgress, 0);
        }
    }

    private static string SafeScreenshotFolderName(string gameName)
    {
        var invalid = Path.GetInvalidFileNameChars().ToHashSet();
        string safe = new string(gameName.Select(c => invalid.Contains(c) || char.IsControl(c) ? '_' : c).ToArray()).Trim().TrimEnd('.');
        if (string.IsNullOrWhiteSpace(safe)) safe = "Jogo";
        if (safe.Length > 100) safe = safe[..100].TrimEnd();
        return safe;
    }

    private static void CreateScreenshotThumbnail(byte[] png, string outputPath)
    {
        using var input = new MemoryStream(png);
        using var source = new Bitmap(input);
        int width = Math.Min(1600, source.Width);
        int height = Math.Max(1, (int)Math.Round(source.Height * (width / (double)source.Width)));
        using var thumb = new Bitmap(width, height, PixelFormat.Format24bppRgb);
        using (Graphics graphics = Graphics.FromImage(thumb))
        {
            graphics.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighQuality;
            graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
            graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
            graphics.DrawImage(source, 0, 0, width, height);
        }
        var codec = ImageCodecInfo.GetImageEncoders().First(item => item.FormatID == ImageFormat.Jpeg.Guid);
        using var parameters = new EncoderParameters(1);
        parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 92L);
        string tempPath = outputPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            thumb.Save(tempPath, codec, parameters);
            File.Move(tempPath, outputPath, overwrite: true);
        }
        finally
        {
            try { if (File.Exists(tempPath)) File.Delete(tempPath); } catch { }
        }
    }

    private static string ScreenshotThumbnailData(GameScreenshotRecord item)
    {
        if (!File.Exists(item.ImagePath)) return "";

        string thumbnailPath = item.ThumbnailPath;
        if (string.IsNullOrWhiteSpace(thumbnailPath))
        {
            string folder = Path.GetDirectoryName(item.ImagePath) ?? "";
            thumbnailPath = Path.Combine(folder, ".thumbnails", Path.GetFileNameWithoutExtension(item.ImagePath) + ".jpg");
        }

        int targetWidth = Math.Min(1600, Math.Max(1, item.Width));
        bool regenerate = !File.Exists(thumbnailPath);
        if (!regenerate)
        {
            try
            {
                using var current = new Bitmap(thumbnailPath);
                regenerate = current.Width < targetWidth;
            }
            catch { regenerate = true; }
        }

        try
        {
            if (regenerate)
            {
                string? folder = Path.GetDirectoryName(thumbnailPath);
                if (!string.IsNullOrWhiteSpace(folder)) Directory.CreateDirectory(folder);
                CreateScreenshotThumbnail(File.ReadAllBytes(item.ImagePath), thumbnailPath);
            }
            return File.Exists(thumbnailPath)
                ? "data:image/jpeg;base64," + Convert.ToBase64String(File.ReadAllBytes(thumbnailPath))
                : "";
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Screenshots] Could not prepare gallery preview: " + ex.Message);
            return "";
        }
    }

    private async Task ChangeScreenshotRootAsync(
        string selectedFolder,
        string targetUserId,
        string targetUserDataFolder,
        long revisionWhenPickerOpened)
    {
        string catalogPath = ScreenshotCatalogPath(targetUserDataFolder);
        await ScreenshotGalleryMutationGate.WaitAsync().ConfigureAwait(true);
        bool progressShown = false;
        string? progressError = null;
        int progressTotal = 0;
        List<ScreenshotLibraryMovedFile> moved = new();
        try
        {
            if (!IsScreenshotUserActive(targetUserId, targetUserDataFolder)) return;

            ScreenshotGalleryDocument catalog;
            long migrationRevision;
            lock (ScreenshotGalleryLock)
            {
                migrationRevision = StateStorage.GetRevision(catalogPath);
                if (migrationRevision != revisionWhenPickerOpened)
                    Debug.WriteLine("[Screenshots] Gallery changed while selecting a new root; migrating the latest catalog contents.");
                catalog = LoadScreenshotGallery(targetUserDataFolder);
            }

            string oldRoot = FullScreenshotPath(catalog.RootDirectory);
            string newRoot = ManagedScreenshotRoot(selectedFolder);
            if (string.Equals(oldRoot, newRoot, StringComparison.OrdinalIgnoreCase)) return;
            ScreenshotLibraryMovePlan[] files = await Task.Run(() =>
                ScreenshotFilesRegisteredInGallery(catalog, oldRoot, newRoot)).ConfigureAwait(true);

            if (!IsScreenshotUserActive(targetUserId, targetUserDataFolder)) return;
            if (StateStorage.GetRevision(catalogPath) != migrationRevision)
                throw new InvalidOperationException("A biblioteca mudou enquanto o novo local era preparado. Tente novamente.");

            if (files.Length == 0)
            {
                lock (ScreenshotGalleryLock)
                {
                    if (!IsScreenshotUserActive(targetUserId, targetUserDataFolder) ||
                        StateStorage.GetRevision(catalogPath) != migrationRevision)
                        throw new InvalidOperationException("A biblioteca mudou antes de confirmar o novo local. Tente novamente.");
                    catalog.RootDirectory = newRoot;
                    SaveScreenshotGallery(targetUserDataFolder, catalog);
                }
                SendScreenshotGallery();
                return;
            }

            progressShown = true;
            progressTotal = files.Length;
            SendScreenshotLibraryMoveProgress(true, 0, progressTotal);
            await Dispatcher.InvokeAsync(static () => { }, System.Windows.Threading.DispatcherPriority.Render);

            var progress = new Progress<(int Completed, int Total)>(value =>
                SendScreenshotLibraryMoveProgress(true, value.Completed, value.Total));
            moved = await Task.Run(() => MoveScreenshotLibraryFiles(oldRoot, files, progress)).ConfigureAwait(true);

            if (!IsScreenshotUserActive(targetUserId, targetUserDataFolder))
            {
                await Task.Run(() => RollbackScreenshotLibraryFiles(moved)).ConfigureAwait(true);
                moved.Clear();
                return;
            }

            lock (ScreenshotGalleryLock)
            {
                if (!IsScreenshotUserActive(targetUserId, targetUserDataFolder) ||
                    StateStorage.GetRevision(catalogPath) != migrationRevision)
                    throw new InvalidOperationException("A biblioteca mudou durante a movimentação. Os arquivos foram restaurados ao local anterior.");

                var movedPaths = moved.ToDictionary(file => FullScreenshotPath(file.SourcePath), file => file.DestinationPath,
                    StringComparer.OrdinalIgnoreCase);
                foreach (GameScreenshotRecord item in catalog.Items)
                {
                    string imagePath = FullScreenshotPath(item.ImagePath);
                    if (movedPaths.TryGetValue(imagePath, out string? movedImage)) item.ImagePath = movedImage;
                    if (!string.IsNullOrWhiteSpace(item.ThumbnailPath))
                    {
                        string thumbnailPath = FullScreenshotPath(item.ThumbnailPath);
                        if (movedPaths.TryGetValue(thumbnailPath, out string? movedThumbnail)) item.ThumbnailPath = movedThumbnail;
                    }
                }
                catalog.RootDirectory = newRoot;
                SaveScreenshotGallery(targetUserDataFolder, catalog);
            }

            SendScreenshotGallery();
        }
        catch (Exception ex)
        {
            if (moved.Count > 0)
            {
                await Task.Run(() => RollbackScreenshotLibraryFiles(moved)).ConfigureAwait(true);
                moved.Clear();
            }
            progressError = ex.Message;
            Debug.WriteLine("[Screenshots] Could not change screenshot root: " + ex);
        }
        finally
        {
            if (progressShown) SendScreenshotLibraryMoveProgress(false, progressTotal, progressTotal, progressError);
            else if (!string.IsNullOrWhiteSpace(progressError)) SendScreenshotOperationError(progressError);
            ScreenshotGalleryMutationGate.Release();
        }
    }

    private async Task MoveScreenshotToGameFolderAsync(string id)
    {
        string targetUserId = currentUserId;
        string targetUserDataFolder = currentUserDataFolder;
        string catalogPath = ScreenshotCatalogPath(targetUserDataFolder);
        long revisionWhenPickerOpened = StateStorage.GetRevision(catalogPath);
        string rootWhenPickerOpened = LoadScreenshotGallery(targetUserDataFolder).RootDirectory;
        string? selectedFolder = await ShowDoorpiFileBrowserAsync(
            "Mover captura para a pasta de outro jogo",
            selectFolder: true,
            source: "screenshotMove",
            initialPath: rootWhenPickerOpened).ConfigureAwait(true);
        if (string.IsNullOrWhiteSpace(selectedFolder) || !IsScreenshotUserActive(targetUserId, targetUserDataFolder)) return;

        await ScreenshotGalleryMutationGate.WaitAsync().ConfigureAwait(true);
        bool changed = false;
        string? error = null;
        try
        {
            if (!IsScreenshotUserActive(targetUserId, targetUserDataFolder)) return;
            lock (ScreenshotGalleryLock)
            {
                if (StateStorage.GetRevision(catalogPath) != revisionWhenPickerOpened)
                    Debug.WriteLine("[Screenshots] Gallery changed while selecting a game folder; validating against the latest items.");

                ScreenshotGalleryDocument catalog = LoadScreenshotGallery(targetUserDataFolder);
                GameScreenshotRecord? item = catalog.Items.FirstOrDefault(entry => entry.Id == id);
                if (item == null || !File.Exists(item.ImagePath))
                {
                    error = "A captura não está mais disponível.";
                }
                else
                {
                    string root = FullScreenshotPath(catalog.RootDirectory);
                    string destinationFolder = FullScreenshotPath(selectedFolder);
                    var destinationGame = catalog.Items
                        .GroupBy(entry => FullScreenshotPath(Path.Combine(root, SafeScreenshotFolderName(entry.GameName))),
                            StringComparer.OrdinalIgnoreCase)
                        .FirstOrDefault(group => string.Equals(group.Key, destinationFolder, StringComparison.OrdinalIgnoreCase))?
                        .OrderByDescending(entry => entry.CapturedAtUtc)
                        .FirstOrDefault();
                    if (!ScreenshotPathIsWithin(destinationFolder, root) ||
                        string.Equals(destinationFolder, root, StringComparison.OrdinalIgnoreCase) ||
                        destinationGame == null || !Directory.Exists(destinationFolder))
                    {
                        error = "No explorador, selecione uma das pastas de jogo desta galeria.";
                    }
                    else
                    {

                string imageSource = Path.GetFullPath(item.ImagePath);
                string oldImagePath = item.ImagePath;
                string oldThumbnailPath = item.ThumbnailPath;
                string oldGameId = item.GameId;
                string oldGameName = item.GameName;
                string imageDestination = Path.Combine(destinationFolder, Path.GetFileName(imageSource));
                string imageMovedTo = imageSource;
                string thumbnailMovedTo = item.ThumbnailPath;
                try
                {
                    imageMovedTo = MoveScreenshotFile(imageSource, imageDestination);
                    if (!string.IsNullOrWhiteSpace(item.ThumbnailPath))
                    {
                        string thumbnailDestination = Path.Combine(destinationFolder, ".thumbnails", Path.GetFileName(item.ThumbnailPath));
                        thumbnailMovedTo = File.Exists(item.ThumbnailPath)
                            ? MoveScreenshotFile(item.ThumbnailPath, thumbnailDestination)
                            : thumbnailDestination;
                    }

                    item.ImagePath = imageMovedTo;
                    item.ThumbnailPath = thumbnailMovedTo;
                    item.GameId = destinationGame.GameId;
                    item.GameName = destinationGame.GameName;
                    SaveScreenshotGallery(targetUserDataFolder, catalog);
                    changed = true;
                }
                catch
                {
                    item.ImagePath = oldImagePath;
                    item.ThumbnailPath = oldThumbnailPath;
                    item.GameId = oldGameId;
                    item.GameName = oldGameName;
                    try
                    {
                        if (!string.Equals(imageMovedTo, imageSource, StringComparison.OrdinalIgnoreCase) && File.Exists(imageMovedTo))
                        {
                            Directory.CreateDirectory(Path.GetDirectoryName(imageSource)!);
                            File.Move(imageMovedTo, imageSource);
                        }
                        if (!string.IsNullOrWhiteSpace(oldThumbnailPath) &&
                            !string.Equals(thumbnailMovedTo, oldThumbnailPath, StringComparison.OrdinalIgnoreCase) &&
                            File.Exists(thumbnailMovedTo))
                        {
                            Directory.CreateDirectory(Path.GetDirectoryName(oldThumbnailPath)!);
                            File.Move(thumbnailMovedTo, oldThumbnailPath);
                        }
                    }
                    catch (Exception rollbackError)
                    {
                        Debug.WriteLine("[Screenshots] Could not roll back a moved capture: " + rollbackError.Message);
                    }
                    throw;
                }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            error = ex.Message;
            Debug.WriteLine("[Screenshots] Could not move screenshot to game folder: " + ex);
        }
        finally { ScreenshotGalleryMutationGate.Release(); }

        if (error != null) SendScreenshotOperationError(error);
        if (changed && IsScreenshotUserActive(targetUserId, targetUserDataFolder)) SendScreenshotGallery();
    }

    private bool IsScreenshotShareSessionActive(CancellationTokenSource session)
    {
        lock (ScreenshotShareLock)
        {
            return _screenshotShareActive &&
                   ReferenceEquals(_screenshotShareCancellation, session) &&
                   !session.IsCancellationRequested;
        }
    }

    private bool TryBeginScreenshotShareSession(out CancellationTokenSource? session)
    {
        lock (ScreenshotShareLock)
        {
            if (_screenshotShareActive)
            {
                session = null;
                return false;
            }

            session = new CancellationTokenSource();
            _screenshotShareCancellation = session;
            _screenshotShareBrowser = null;
            _screenshotShareOverlay = null;
            _screenshotShareInputThread = null;
            _screenshotShareActive = true;
            return true;
        }
    }

    private bool TrySetScreenshotShareBrowser(CancellationTokenSource session, BrowserWindowSession browser)
    {
        lock (ScreenshotShareLock)
        {
            if (!_screenshotShareActive || !ReferenceEquals(_screenshotShareCancellation, session))
                return false;
            _screenshotShareBrowser = browser;
            return true;
        }
    }

    private bool IsScreenshotShareTargetCurrent(string userId, string userDataFolder, string id, string imagePath)
    {
        if (!IsScreenshotUserActive(userId, userDataFolder)) return false;
        try
        {
            lock (ScreenshotGalleryLock)
            {
                GameScreenshotRecord? item = LoadScreenshotGallery(userDataFolder).Items
                    .FirstOrDefault(entry => entry.Id == id);
                return item != null &&
                       string.Equals(FullScreenshotPath(item.ImagePath), FullScreenshotPath(imagePath), StringComparison.OrdinalIgnoreCase) &&
                       File.Exists(item.ImagePath);
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Screenshots] Could not validate a share target: " + ex.Message);
            return false;
        }
    }

    private async Task CopyScreenshotToClipboardAsync(string[] imagePaths, CancellationToken cancellationToken)
    {
        Exception? lastFailure = null;
        string[] paths = imagePaths.Select(Path.GetFullPath).ToArray();
        string fullImagePath = paths[0];
        for (int attempt = 0; attempt < 4; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                if (paths.Length > 1)
                {
                    await Dispatcher.InvokeAsync(() => NativeImageClipboard.SetFiles(paths));
                    return;
                }
                byte[] png = await File.ReadAllBytesAsync(fullImagePath, cancellationToken).ConfigureAwait(true);
                await Dispatcher.InvokeAsync(() =>
                {
                    var image = BitmapFrame.Create(
                        new Uri(fullImagePath, UriKind.Absolute),
                        BitmapCreateOptions.PreservePixelFormat,
                        BitmapCacheOption.OnLoad);
                    image.Freeze();

                    // Chromium reads images from Windows as PNG and CF_DIBV5.
                    // WPF's DataObject often advertises only a legacy CF_BITMAP
                    // when it contains a FileDrop too, which leaves X with a
                    // perfectly valid clipboard that it cannot attach. Publish
                    // the same formats Chromium itself writes, plus the file.
                    NativeImageClipboard.SetScreenshot(png, image, fullImagePath);
                });
                return;
            }
            catch (Exception ex) when (attempt < 3)
            {
                lastFailure = ex;
                await Task.Delay(80, cancellationToken).ConfigureAwait(true);
            }
        }

        throw new InvalidOperationException("Não foi possível colocar a captura na área de transferência.", lastFailure);
    }

    private static class NativeImageClipboard
    {
        private const uint GmemMoveable = 0x0002;
        private const uint CfDibV5 = 17;
        private const uint CfHdrop = 15;
        private const uint BiBitFields = 3;
        private const uint LcsSrgb = 0x73524742;
        private const uint LcsGmImages = 4;

        [StructLayout(LayoutKind.Sequential, Pack = 1)]
        private struct BitmapV5Header
        {
            public uint Size;
            public int Width;
            public int Height;
            public ushort Planes;
            public ushort BitCount;
            public uint Compression;
            public uint SizeImage;
            public int XPelsPerMeter;
            public int YPelsPerMeter;
            public uint ClrUsed;
            public uint ClrImportant;
            public uint RedMask;
            public uint GreenMask;
            public uint BlueMask;
            public uint AlphaMask;
            public uint CsType;
            [MarshalAs(UnmanagedType.ByValArray, SizeConst = 9)]
            public int[] Endpoints;
            public uint GammaRed;
            public uint GammaGreen;
            public uint GammaBlue;
            public uint Intent;
            public uint ProfileData;
            public uint ProfileSize;
            public uint Reserved;
        }

        public static void SetScreenshot(byte[] png, BitmapSource source, string filePath)
        {
            if (png.Length == 0) throw new InvalidDataException("A captura PNG está vazia.");
            if (!OpenClipboard(IntPtr.Zero))
                throw new ExternalException("A área de transferência está ocupada.");

            try
            {
                if (!EmptyClipboard())
                    throw new ExternalException("Não foi possível limpar a área de transferência.");

                uint pngFormat = RegisterClipboardFormat("PNG");
                if (pngFormat == 0 || !SetClipboardBytes(pngFormat, png))
                    throw new ExternalException("Não foi possível registrar a imagem PNG na área de transferência.");

                // Keep an exact image format for Chromium and a file-drop path
                // for sites that prefer to treat pasted media as a local file.
                if (!SetDibV5(source))
                    throw new ExternalException("Não foi possível registrar a imagem bitmap na área de transferência.");
                _ = SetClipboardBytes(CfHdrop, BuildFileDrop(new[] { filePath }));
            }
            finally
            {
                CloseClipboard();
            }
        }

        private static bool SetDibV5(BitmapSource source)
        {
            BitmapSource normalized = source.Format == System.Windows.Media.PixelFormats.Bgra32
                ? source
                : new FormatConvertedBitmap(source, System.Windows.Media.PixelFormats.Bgra32, null, 0);
            if (normalized.CanFreeze && !normalized.IsFrozen) normalized.Freeze();

            int width = normalized.PixelWidth;
            int height = normalized.PixelHeight;
            if (width <= 0 || height <= 0) return false;
            int stride = checked(width * 4);
            byte[] pixels = new byte[checked(stride * height)];
            normalized.CopyPixels(pixels, stride, 0);

            int headerSize = Marshal.SizeOf<BitmapV5Header>();
            nint memory = GlobalAlloc(GmemMoveable, (nuint)checked(headerSize + pixels.Length));
            if (memory == 0) return false;
            try
            {
                nint pointer = GlobalLock(memory);
                if (pointer == 0) return false;
                try
                {
                    var header = new BitmapV5Header
                    {
                        Size = (uint)headerSize,
                        Width = width,
                        Height = -height, // top-down, matching BitmapSource pixel order
                        Planes = 1,
                        BitCount = 32,
                        Compression = BiBitFields,
                        SizeImage = (uint)pixels.Length,
                        RedMask = 0x00FF0000,
                        GreenMask = 0x0000FF00,
                        BlueMask = 0x000000FF,
                        AlphaMask = 0xFF000000,
                        CsType = LcsSrgb,
                        Endpoints = new int[9],
                        Intent = LcsGmImages
                    };
                    Marshal.StructureToPtr(header, pointer, false);
                    Marshal.Copy(pixels, 0, pointer + headerSize, pixels.Length);
                }
                finally { GlobalUnlock(memory); }

                if (SetClipboardData(CfDibV5, memory) == 0) return false;
                memory = 0; // Clipboard owns this HGLOBAL after SetClipboardData.
                return true;
            }
            finally
            {
                if (memory != 0) GlobalFree(memory);
            }
        }

        private static bool SetClipboardBytes(uint format, byte[] bytes)
        {
            nint memory = GlobalAlloc(GmemMoveable, (nuint)bytes.Length);
            if (memory == 0) return false;
            try
            {
                nint pointer = GlobalLock(memory);
                if (pointer == 0) return false;
                try { Marshal.Copy(bytes, 0, pointer, bytes.Length); }
                finally { GlobalUnlock(memory); }

                if (SetClipboardData(format, memory) == 0) return false;
                memory = 0; // Clipboard owns this HGLOBAL after SetClipboardData.
                return true;
            }
            finally
            {
                if (memory != 0) GlobalFree(memory);
            }
        }

        public static void SetFiles(string[] paths)
        {
            if (!OpenClipboard(IntPtr.Zero)) throw new ExternalException("A área de transferência está ocupada.");
            try
            {
                if (!EmptyClipboard() || !SetClipboardBytes(CfHdrop, BuildFileDrop(paths)))
                    throw new ExternalException("Não foi possível copiar os arquivos para a área de transferência.");
            }
            finally { CloseClipboard(); }
        }

        private static byte[] BuildFileDrop(string[] filePaths)
        {
            // DROPFILES: pFiles, POINT, fNC, fWide followed by double-NUL UTF-16 paths.
            byte[] path = System.Text.Encoding.Unicode.GetBytes(string.Join("\0", filePaths) + "\0\0");
            byte[] drop = new byte[20 + path.Length];
            BitConverter.GetBytes(20u).CopyTo(drop, 0);
            BitConverter.GetBytes(1).CopyTo(drop, 16);
            Buffer.BlockCopy(path, 0, drop, 20, path.Length);
            return drop;
        }

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool OpenClipboard(IntPtr window);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool CloseClipboard();

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool EmptyClipboard();

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern uint RegisterClipboardFormat(string format);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern nint SetClipboardData(uint format, nint memory);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern nint GlobalAlloc(uint flags, nuint bytes);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern nint GlobalLock(nint memory);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GlobalUnlock(nint memory);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern nint GlobalFree(nint memory);
    }

    private void ShowScreenshotShareOverlay(CancellationTokenSource session)
    {
        if (!IsScreenshotShareSessionActive(session)) return;

        ScreenshotShareReturnOverlay overlay = new(
            () => _ = EndScreenshotShareSessionAsync(session, closeLaunchedBrowser: true),
            IsPortugueseUi());
        ScreenshotShareReturnOverlay? previous;
        lock (ScreenshotShareLock)
        {
            if (!_screenshotShareActive || !ReferenceEquals(_screenshotShareCancellation, session))
            {
                return;
            }
            previous = _screenshotShareOverlay;
            _screenshotShareOverlay = overlay;
        }

        try { previous?.CloseForReturn(); } catch { }
        overlay.Show();
    }

    private void StartScreenshotShareInputMode(CancellationTokenSource session)
    {
        if (!IsScreenshotShareSessionActive(session)) return;

        void PreparePointer()
        {
            EnsureCursorVisible();
            _mainScreenMouseVisible = true;
            CenterCursorOnScreen();
            UpdateHoverStateInWebView();
        }
        if (Dispatcher.CheckAccess()) PreparePointer();
        else Dispatcher.Invoke(PreparePointer);

        var inputThread = new Thread(() =>
            SharedGamepadControllerLoop(
                () => IsScreenshotShareSessionActive(session),
                () => _ = EndScreenshotShareSessionAsync(session, closeLaunchedBrowser: true),
                handleXboxButton: true,
                shouldAcceptInput: () => IsScreenshotShareSessionActive(session)))
        {
            IsBackground = true,
            Name = "Doorpi.ScreenshotShareInput"
        };

        lock (ScreenshotShareLock)
        {
            if (!_screenshotShareActive || !ReferenceEquals(_screenshotShareCancellation, session)) return;
            _screenshotShareInputThread = inputThread;
        }
        inputThread.Start();
    }

    private async Task MonitorScreenshotShareBrowserAsync(BrowserWindowSession browser, CancellationTokenSource session)
    {
        try
        {
            await browser.WaitForClosedAsync(session.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException) { return; }
        catch (Exception ex)
        {
            Debug.WriteLine("[Screenshots] Could not monitor the share browser: " + ex.Message);
            return;
        }

        await EndScreenshotShareSessionAsync(session, closeLaunchedBrowser: false).ConfigureAwait(false);
    }

    private async Task TryPasteScreenshotIntoBrowserAsync(
        BrowserWindowSession browser,
        CancellationTokenSource session,
        string targetUserId,
        string targetUserDataFolder,
        string[] ids,
        string[] imagePaths)
    {
        try
        {
            // Chromium receives --start-fullscreen at launch; maximize the
            // window as a fallback for browsers without that launch option.
            await browser.PrepareShareWindowAsync(session.Token).ConfigureAwait(true);

            // The title is a readiness hint, not a DOM or login check. A single
            // paste avoids attaching duplicates; manual paste remains available.
            bool pageReady = await browser.WaitForSharePageAsync(session.Token).ConfigureAwait(true);
            if (!pageReady) return;
            await Task.Delay(1000, session.Token).ConfigureAwait(true);
            if (!IsScreenshotShareSessionActive(session) ||
                !ids.Select((id, index) => IsScreenshotShareTargetCurrent(targetUserId, targetUserDataFolder, id, imagePaths[index])).All(valid => valid)) return;

            // Do not steal focus or inject a paste into another application if
            // the user has already switched windows while the page was loading.
            if (!await browser.IsShareWindowForegroundAsync().ConfigureAwait(true)) return;
            if (!IsScreenshotShareSessionActive(session) ||
                !ids.Select((id, index) => IsScreenshotShareTargetCurrent(targetUserId, targetUserDataFolder, id, imagePaths[index])).All(valid => valid)) return;

            // Send the chord through the same input path as customized controls,
            // which also supports browsers running elevated.
            SendConfiguredKeyEvent(0x11, keyUp: false); // Ctrl down
            SendConfiguredKeyEvent(0x56, keyUp: false); // V down
            SendConfiguredKeyEvent(0x56, keyUp: true);  // V up
            SendConfiguredKeyEvent(0x11, keyUp: true);  // Ctrl up
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            // The image remains on the clipboard, which is the intended manual
            // fallback for a slow page or a sign-in screen.
            Debug.WriteLine("[Screenshots] Automatic X paste was not available: " + ex.Message);
        }
    }

    private async Task EndScreenshotShareSessionAsync(CancellationTokenSource session, bool closeLaunchedBrowser)
    {
        BrowserWindowSession? browser;
        ScreenshotShareReturnOverlay? overlay;
        Thread? inputThread;
        lock (ScreenshotShareLock)
        {
            if (!_screenshotShareActive || !ReferenceEquals(_screenshotShareCancellation, session)) return;

            _screenshotShareActive = false;
            _screenshotShareCancellation = null;
            browser = _screenshotShareBrowser;
            overlay = _screenshotShareOverlay;
            inputThread = _screenshotShareInputThread;
            _screenshotShareBrowser = null;
            _screenshotShareOverlay = null;
            _screenshotShareInputThread = null;
        }

        try { session.Cancel(); } catch { }
        if (inputThread != null && inputThread != Thread.CurrentThread && inputThread.IsAlive)
        {
            try { inputThread.Join(120); } catch { }
        }

        await Dispatcher.InvokeAsync(() =>
        {
            try { overlay?.CloseForReturn(); } catch { }
            try { _desktopVkb?.Close(); } catch { }
            _desktopVkb = null;
            ReleaseAllStuckKeys();
        });

        bool browserStillOpen = false;
        if (closeLaunchedBrowser && browser != null)
        {
            try
            {
                await browser.CloseAsync().ConfigureAwait(false);
                browserStillOpen = await browser.IsLaunchedWindowOpenAsync().ConfigureAwait(false);
            }
            catch (Exception ex) { Debug.WriteLine("[Screenshots] Could not close the share browser: " + ex.Message); }
        }

        await Dispatcher.InvokeAsync(() =>
        {
            EnsureCursorVisible();
            EnsureCursorHidden();
            _mainScreenMouseVisible = false;
            _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
            try { SetCursorPos(0, 0); } catch { }
            FocusDoorpiMainWebView(onlyIfFocusLost: false);
            if (browserStillOpen)
                SendScreenshotOperationError(IsPortugueseUi()
                    ? "O navegador ainda está aberto. Confirme o fechamento na janela de postagem."
                    : "The browser is still open. Confirm closing it in the posting window.");
        });
    }

    private void StopScreenshotShareSessionForShutdown()
    {
        CancellationTokenSource? session;
        BrowserWindowSession? browser;
        ScreenshotShareReturnOverlay? overlay;
        Thread? inputThread;
        lock (ScreenshotShareLock)
        {
            if (!_screenshotShareActive) return;

            _screenshotShareActive = false;
            session = _screenshotShareCancellation;
            browser = _screenshotShareBrowser;
            overlay = _screenshotShareOverlay;
            inputThread = _screenshotShareInputThread;
            _screenshotShareCancellation = null;
            _screenshotShareBrowser = null;
            _screenshotShareOverlay = null;
            _screenshotShareInputThread = null;
        }

        try { session?.Cancel(); } catch { }
        if (inputThread != null && inputThread != Thread.CurrentThread && inputThread.IsAlive)
        {
            try { inputThread.Join(120); } catch { }
        }

        void CloseOverlay()
        {
            try { overlay?.CloseForReturn(); } catch { }
        }
        if (Dispatcher.CheckAccess()) CloseOverlay();
        else _ = Dispatcher.BeginInvoke(new Action(CloseOverlay));
        if (browser != null) _ = browser.CloseAsync();
    }

    private async Task ShareScreenshotToXAsync(string[] ids)
    {
        string targetUserId = currentUserId;
        string targetUserDataFolder = currentUserDataFolder;
        string[] imagePaths;
        try
        {
            lock (ScreenshotGalleryLock)
            {
                var items = LoadScreenshotGallery(targetUserDataFolder).Items;
                imagePaths = ids.Select(id => items.FirstOrDefault(entry => entry.Id == id)?.ImagePath ?? "").ToArray();
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Screenshots] Could not load a screenshot for sharing: " + ex.Message);
            SendScreenshotOperationError(IsPortugueseUi()
                ? "Não foi possível preparar esta captura para postagem."
                : "This screenshot could not be prepared for posting.");
            return;
        }

        if (ids.Length is < 1 or > 4 || ids.Distinct(StringComparer.Ordinal).Count() != ids.Length ||
            imagePaths.Any(path => string.IsNullOrWhiteSpace(path) || !File.Exists(path)))
        {
            SendScreenshotOperationError(IsPortugueseUi()
                ? "A imagem desta captura não está mais disponível."
                : "The image for this screenshot is no longer available.");
            return;
        }

        if (!TryBeginScreenshotShareSession(out CancellationTokenSource? session) || session == null)
        {
            SendScreenshotOperationError(IsPortugueseUi()
                ? "Já existe uma janela de postagem aberta."
                : "A posting window is already open.");
            return;
        }

        try
        {
            await CopyScreenshotToClipboardAsync(imagePaths, session.Token).ConfigureAwait(true);
            if (!ids.Select((id, index) => IsScreenshotShareTargetCurrent(targetUserId, targetUserDataFolder, id, imagePaths[index])).All(valid => valid))
            {
                await EndScreenshotShareSessionAsync(session, closeLaunchedBrowser: false).ConfigureAwait(true);
                return;
            }

            BrowserWindowSession browser = await BrowserWindowSession.OpenAsync(
                "https://x.com/compose/post", session.Token, fullscreen: true).ConfigureAwait(true);
            if (!TrySetScreenshotShareBrowser(session, browser) ||
                !ids.Select((id, index) => IsScreenshotShareTargetCurrent(targetUserId, targetUserDataFolder, id, imagePaths[index])).All(valid => valid))
            {
                await browser.CloseAsync().ConfigureAwait(true);
                await EndScreenshotShareSessionAsync(session, closeLaunchedBrowser: false).ConfigureAwait(true);
                return;
            }

            ShowScreenshotShareOverlay(session);
            StartScreenshotShareInputMode(session);
            _ = MonitorScreenshotShareBrowserAsync(browser, session);
            _ = TryPasteScreenshotIntoBrowserAsync(
                browser, session, targetUserId, targetUserDataFolder, ids, imagePaths);
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            Debug.WriteLine("[Screenshots] Could not start X sharing: " + ex);
            SendScreenshotOperationError(IsPortugueseUi()
                ? "Não foi possível abrir a janela de postagem."
                : "The posting window could not be opened.");
            await EndScreenshotShareSessionAsync(session, closeLaunchedBrowser: true).ConfigureAwait(true);
        }
    }

    private async Task<bool> TryHandleScreenshotWebMessageAsync(string action, JsonElement root)
    {
        if (action == "requestScreenshotGallery")
        {
            SendScreenshotGallery();
            return true;
        }

        if (action == "chooseScreenshotFolder")
        {
            string targetUserId = currentUserId;
            string targetUserDataFolder = currentUserDataFolder;
            string catalogPath = ScreenshotCatalogPath(targetUserDataFolder);
            long targetCatalogRevision = StateStorage.GetRevision(catalogPath);
            string current = ScreenshotRootSelectionPath(LoadScreenshotGallery(targetUserDataFolder).RootDirectory);
            string? selectedFolder = await ShowDoorpiFileBrowserAsync(
                "Local de salvamento das capturas",
                selectFolder: true,
                source: "screenshotGalleryRoot",
                initialPath: current).ConfigureAwait(true);
            if (!string.IsNullOrWhiteSpace(selectedFolder))
                await ChangeScreenshotRootAsync(selectedFolder, targetUserId, targetUserDataFolder, targetCatalogRevision).ConfigureAwait(true);
            return true;
        }

        if (action == "deleteScreenshot")
        {
            string id = GetString(root, "id");
            string targetUserId = currentUserId;
            string targetUserDataFolder = currentUserDataFolder;
            string catalogPath = ScreenshotCatalogPath(targetUserDataFolder);
            long targetCatalogRevision = StateStorage.GetRevision(catalogPath);
            await ScreenshotGalleryMutationGate.WaitAsync().ConfigureAwait(true);
            try
            {
                if (!IsScreenshotUserActive(targetUserId, targetUserDataFolder)) return true;
                lock (ScreenshotGalleryLock)
                {
                    if (StateStorage.GetRevision(catalogPath) != targetCatalogRevision)
                        Debug.WriteLine("[Screenshots] Gallery changed before deletion; applying the request to its latest revision.");
                    ScreenshotGalleryDocument catalog = LoadScreenshotGallery(targetUserDataFolder);
                    GameScreenshotRecord? item = catalog.Items.FirstOrDefault(entry => entry.Id == id);
                    if (item != null)
                    {
                        TryDeleteScreenshotFile(item.ImagePath);
                        TryDeleteScreenshotFile(item.ThumbnailPath);
                        catalog.Items.Remove(item);
                        SaveScreenshotGallery(targetUserDataFolder, catalog);
                    }
                }
            }
            finally { ScreenshotGalleryMutationGate.Release(); }
            if (IsScreenshotUserActive(targetUserId, targetUserDataFolder)) SendScreenshotGallery();
            return true;
        }

        if (action == "moveScreenshot")
        {
            string id = GetString(root, "id");
            await MoveScreenshotToGameFolderAsync(id).ConfigureAwait(true);
            return true;
        }

        if (action == "shareScreenshotToX")
        {
            string[] ids = root.TryGetProperty("ids", out JsonElement entries) && entries.ValueKind == JsonValueKind.Array
                ? entries.EnumerateArray().Where(entry => entry.ValueKind == JsonValueKind.String).Select(entry => entry.GetString() ?? "").ToArray()
                : new[] { GetString(root, "id") };
            await ShareScreenshotToXAsync(ids).ConfigureAwait(true);
            return true;
        }

        if (action == "requestScreenshotImage")
        {
            string id = GetString(root, "id");
            string targetUserId = currentUserId;
            string targetUserDataFolder = currentUserDataFolder;
            ScreenshotGalleryDocument catalog = LoadScreenshotGallery(targetUserDataFolder);
            GameScreenshotRecord? item = catalog.Items.FirstOrDefault(entry => entry.Id == id);
            string? data = item != null && File.Exists(item.ImagePath)
                ? "data:image/png;base64," + Convert.ToBase64String(await File.ReadAllBytesAsync(item.ImagePath).ConfigureAwait(true))
                : null;
            if (!string.Equals(currentUserId, targetUserId, StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(currentUserDataFolder, targetUserDataFolder, StringComparison.OrdinalIgnoreCase)) return true;
            webView?.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "screenshotImage", id, data }));
            return true;
        }

        return false;
    }

    private void SendScreenshotGallery()
    {
        string user = currentUserId;
        string dataFolder = currentUserDataFolder;
        long revision = StateStorage.GetRevision(ScreenshotCatalogPath(dataFolder));
        ScreenshotGalleryDocument catalog = LoadScreenshotGallery(dataFolder);
        var items = catalog.Items
            .Where(item => File.Exists(item.ImagePath))
            .OrderByDescending(item => item.CapturedAtUtc)
            .Select(item => new
            {
                item.Id, item.GameId, item.GameName, item.CapturedAtUtc, item.Width, item.Height,
                thumbnail = ScreenshotThumbnailData(item)
            }).ToArray();
        if (!string.Equals(currentUserId, user, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(currentUserDataFolder, dataFolder, StringComparison.OrdinalIgnoreCase) ||
            StateStorage.GetRevision(ScreenshotCatalogPath(dataFolder)) != revision) return;
        webView?.CoreWebView2?.PostWebMessageAsJson(JsonSerializer.Serialize(new
        {
            type = "screenshotGalleryState", rootDirectory = ScreenshotRootSelectionPath(catalog.RootDirectory), items
        }, ScreenshotJsonOptions));
    }

    private static void TryDeleteScreenshotFile(string path)
    {
        try { if (!string.IsNullOrWhiteSpace(path) && File.Exists(path)) File.Delete(path); }
        catch (Exception ex) { Debug.WriteLine("[Screenshots] Could not delete image: " + ex.Message); }
    }

    private static class DxgiDesktopCapture
    {
        private const uint D3D11CreateDeviceBgraSupport = 0x20;
        private const uint D3D11UsageStaging = 3;
        private const uint D3D11CpuAccessRead = 0x20000;
        private const uint DxgiFormatB8G8R8A8Unorm = 87;
        private static readonly Guid IidFactory1 = new("770aae78-f26f-4dba-a829-253c83d1b387");
        private static readonly Guid IidD3D11Texture2D = new("6f15aaf2-d208-4e89-9ab4-489535d34f9c");
        private static readonly Guid IidDxgiOutput1 = new("00cddea8-939b-4b83-a340-a685226666cc");

        [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] private struct Point { public int X, Y; }
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct OutputDesc
        {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
            public Rect DesktopCoordinates;
            public int AttachedToDesktop;
            public int Rotation;
            public IntPtr Monitor;
        }
        [StructLayout(LayoutKind.Sequential)] private struct SampleDesc { public uint Count, Quality; }
        [StructLayout(LayoutKind.Sequential)]
        private struct TextureDesc
        {
            public uint Width, Height, MipLevels, ArraySize, Format;
            public SampleDesc Sample;
            public uint Usage, BindFlags, CpuAccessFlags, MiscFlags;
        }
        [StructLayout(LayoutKind.Sequential)] private struct MappedResource { public IntPtr Data; public uint RowPitch, DepthPitch; }

        [DllImport("dxgi.dll", ExactSpelling = true)] private static extern int CreateDXGIFactory1(ref Guid iid, out IntPtr factory);
        [DllImport("d3d11.dll", ExactSpelling = true)]
        private static extern int D3D11CreateDevice(IntPtr adapter, int driverType, IntPtr software, uint flags,
            [In] uint[] featureLevels, uint featureLevelCount, uint sdkVersion, out IntPtr device, out uint featureLevel, out IntPtr context);
        [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr hwnd, out Rect rect);
        [DllImport("user32.dll")] private static extern bool ClientToScreen(IntPtr hwnd, ref Point point);

        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate int EnumAdapterDelegate(IntPtr self, uint index, out IntPtr adapter);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate int EnumOutputDelegate(IntPtr self, uint index, out IntPtr output);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate int GetOutputDescDelegate(IntPtr self, out OutputDesc desc);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate int DuplicateOutputDelegate(IntPtr self, IntPtr device, out IntPtr duplication);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate int AcquireFrameDelegate(IntPtr self, uint timeoutMs, IntPtr frameInfo, out IntPtr resource);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate int ReleaseFrameDelegate(IntPtr self);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate void GetTextureDescDelegate(IntPtr self, out TextureDesc desc);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate int CreateTexture2DDelegate(IntPtr self, ref TextureDesc desc, IntPtr initialData, out IntPtr texture);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate void CopyResourceDelegate(IntPtr self, IntPtr destination, IntPtr source);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate int MapDelegate(IntPtr self, IntPtr resource, uint subresource, uint mapType, uint flags, out MappedResource mapped);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate void UnmapDelegate(IntPtr self, IntPtr resource, uint subresource);

        private static T Method<T>(IntPtr instance, int slot) where T : Delegate
            => Marshal.GetDelegateForFunctionPointer<T>(Marshal.ReadIntPtr(Marshal.ReadIntPtr(instance), slot * IntPtr.Size));

        public static byte[] CapturePng(IntPtr gameWindow)
        {
            if (gameWindow == IntPtr.Zero) gameWindow = GetForegroundWindow();
            IntPtr factory = IntPtr.Zero, adapter = IntPtr.Zero, output = IntPtr.Zero, device = IntPtr.Zero;
            IntPtr context = IntPtr.Zero, output1 = IntPtr.Zero, duplication = IntPtr.Zero;
            IntPtr frameInfo = IntPtr.Zero, resource = IntPtr.Zero, sourceTexture = IntPtr.Zero, staging = IntPtr.Zero;
            OutputDesc selectedOutputDesc = default;
            try
            {
                Guid factoryIid = IidFactory1;
                int hr = CreateDXGIFactory1(ref factoryIid, out factory);
                Marshal.ThrowExceptionForHR(hr);
                IntPtr targetMonitor = gameWindow == IntPtr.Zero ? IntPtr.Zero : MonitorFromWindow(gameWindow, 2);
                for (uint ai = 0; ; ai++)
                {
                    IntPtr candidateAdapter;
                    hr = Method<EnumAdapterDelegate>(factory, 12)(factory, ai, out candidateAdapter);
                    if (hr < 0) break;
                    for (uint oi = 0; ; oi++)
                    {
                        IntPtr candidateOutput;
                        hr = Method<EnumOutputDelegate>(candidateAdapter, 7)(candidateAdapter, oi, out candidateOutput);
                        if (hr < 0) break;
                        Method<GetOutputDescDelegate>(candidateOutput, 7)(candidateOutput, out OutputDesc desc);
                        if (targetMonitor == IntPtr.Zero || targetMonitor == desc.Monitor)
                        {
                            adapter = candidateAdapter; output = candidateOutput; candidateAdapter = IntPtr.Zero; candidateOutput = IntPtr.Zero;
                            selectedOutputDesc = desc;
                            break;
                        }
                        Marshal.Release(candidateOutput);
                    }
                    if (candidateAdapter != IntPtr.Zero) Marshal.Release(candidateAdapter);
                    if (adapter != IntPtr.Zero) break;
                }
                if (adapter == IntPtr.Zero || output == IntPtr.Zero) throw new InvalidOperationException("Não foi possível localizar o monitor do jogo.");

                uint[] levels = { 0xb100, 0xb000, 0xa100, 0xa000 };
                hr = D3D11CreateDevice(adapter, 0, IntPtr.Zero, D3D11CreateDeviceBgraSupport, levels, (uint)levels.Length, 7, out device, out _, out context);
                Marshal.ThrowExceptionForHR(hr);
                Guid outputIid = IidDxgiOutput1;
                hr = Marshal.QueryInterface(output, ref outputIid, out output1);
                Marshal.ThrowExceptionForHR(hr);
                hr = Method<DuplicateOutputDelegate>(output1, 22)(output1, device, out duplication);
                Marshal.ThrowExceptionForHR(hr);

                frameInfo = Marshal.AllocHGlobal(64);
                Marshal.StructureToPtr(default(MappedResource), frameInfo, false);
                hr = Method<AcquireFrameDelegate>(duplication, 8)(duplication, 1000, frameInfo, out resource);
                Marshal.ThrowExceptionForHR(hr);
                Guid textureIid = IidD3D11Texture2D;
                hr = Marshal.QueryInterface(resource, ref textureIid, out sourceTexture);
                Marshal.ThrowExceptionForHR(hr);
                Method<GetTextureDescDelegate>(sourceTexture, 10)(sourceTexture, out TextureDesc descTexture);
                if (descTexture.Format != DxgiFormatB8G8R8A8Unorm) throw new NotSupportedException("O formato de cor do monitor não é compatível com PNG SDR nesta captura.");

                TextureDesc stagingDesc = descTexture;
                stagingDesc.Usage = D3D11UsageStaging; stagingDesc.BindFlags = 0; stagingDesc.CpuAccessFlags = D3D11CpuAccessRead; stagingDesc.MiscFlags = 0;
                // ID3D11Device::CreateTexture2D is vtable slot 5: IUnknown uses 0-2,
                // then CreateBuffer and CreateTexture1D use slots 3 and 4. Calling
                // slot 9 invokes a different function signature and can corrupt memory.
                hr = Method<CreateTexture2DDelegate>(device, 5)(device, ref stagingDesc, IntPtr.Zero, out staging);
                Marshal.ThrowExceptionForHR(hr);
                Method<CopyResourceDelegate>(context, 47)(context, staging, sourceTexture);
                hr = Method<MapDelegate>(context, 14)(context, staging, 0, 1, 0, out MappedResource mapped);
                Marshal.ThrowExceptionForHR(hr);
                try
                {
                    using var bitmap = new Bitmap((int)descTexture.Width, (int)descTexture.Height, PixelFormat.Format32bppArgb);
                    var bounds = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
                    BitmapData locked = bitmap.LockBits(bounds, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                    try
                    {
                        int rowBytes = checked((int)descTexture.Width * 4);
                        byte[] row = new byte[rowBytes];
                        for (int y = 0; y < bitmap.Height; y++)
                        {
                            Marshal.Copy(IntPtr.Add(mapped.Data, checked((int)(mapped.RowPitch * y))), row, 0, rowBytes);
                            Marshal.Copy(row, 0, IntPtr.Add(locked.Scan0, y * locked.Stride), rowBytes);
                        }
                    }
                    finally { bitmap.UnlockBits(locked); }
                    Rect crop = GameClientCrop(gameWindow, selectedOutputDesc, bitmap.Width, bitmap.Height);
                    Bitmap outputBitmap = crop.Right > crop.Left && crop.Bottom > crop.Top
                        ? bitmap.Clone(new Rectangle(crop.Left, crop.Top, crop.Right - crop.Left, crop.Bottom - crop.Top), PixelFormat.Format32bppArgb)
                        : (Bitmap)bitmap.Clone();
                    using var stream = new MemoryStream();
                    using (outputBitmap) outputBitmap.Save(stream, ImageFormat.Png);
                    return stream.ToArray();
                }
                finally { Method<UnmapDelegate>(context, 15)(context, staging, 0); }
            }
            finally
            {
                if (duplication != IntPtr.Zero) { try { Method<ReleaseFrameDelegate>(duplication, 14)(duplication); } catch { } }
                if (frameInfo != IntPtr.Zero) Marshal.FreeHGlobal(frameInfo);
                foreach (IntPtr item in new[] { staging, sourceTexture, resource, duplication, output1, context, device, output, adapter, factory })
                    if (item != IntPtr.Zero) Marshal.Release(item);
            }
        }

        public static (int Width, int Height) ReadPngDimensions(byte[] png)
        {
            using var stream = new MemoryStream(png);
            using var bitmap = new Bitmap(stream);
            return (bitmap.Width, bitmap.Height);
        }

        private static Rect GameClientCrop(IntPtr window, OutputDesc output, int width, int height)
        {
            if (window == IntPtr.Zero || !GetClientRect(window, out Rect client)) return new Rect();
            var topLeft = new Point { X = client.Left, Y = client.Top };
            var bottomRight = new Point { X = client.Right, Y = client.Bottom };
            if (!ClientToScreen(window, ref topLeft) || !ClientToScreen(window, ref bottomRight)) return new Rect();
            int left = Math.Max(0, topLeft.X - output.DesktopCoordinates.Left);
            int top = Math.Max(0, topLeft.Y - output.DesktopCoordinates.Top);
            int right = Math.Min(width, bottomRight.X - output.DesktopCoordinates.Left);
            int bottom = Math.Min(height, bottomRight.Y - output.DesktopCoordinates.Top);
            return right > left && bottom > top ? new Rect { Left = left, Top = top, Right = right, Bottom = bottom } : new Rect();
        }
    }
}
