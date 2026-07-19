using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;

namespace Doorpi
{
    public partial class MainWindow
    {
        private const string WebViewProfileSchemaVersion = "2";
        private const string GenericWebViewEnvironmentKind = "webapps";
        private const string YouTubeWebViewEnvironmentKind = "youtube";

        private readonly object _webViewProfileStorageLock = new();
        private readonly object _mediaWebViewEnvironmentLock = new();
        private bool _webViewProfileStorageReady;
        private string _webViewProfileStorageError = "";
        private Task<CoreWebView2Environment>? _genericMediaWebViewEnvironmentTask;
        private Task<CoreWebView2Environment>? _youtubeMediaWebViewEnvironmentTask;
        private CancellationTokenSource? _mediaWebViewGlobalWarmupCts;
        private Window? _mediaWebViewGlobalWarmupHost;
        private WebView2? _mediaWebViewGlobalWarmupView;
        private int _mediaWebViewWarmedEnvironmentMask;
        private int _mediaWebViewPrewarmStarted;

        private string WebViewProfileSchemaMarkerPath =>
            Path.Combine(DoorpiPaths.BrowserProfilesFolder, ".profile-schema-v2");

        private string WebViewProfileIndexPath =>
            Path.Combine(DoorpiPaths.BrowserProfilesFolder, "profiles-v2.json");

        private string GenericWebViewUserDataFolder =>
            Path.Combine(DoorpiPaths.BrowserProfilesFolder, GenericWebViewEnvironmentKind);

        private string YouTubeWebViewUserDataFolder =>
            Path.Combine(DoorpiPaths.BrowserProfilesFolder, YouTubeWebViewEnvironmentKind);

        private string StoreInstallerWebViewRoot =>
            Path.Combine(DoorpiPaths.BrowserProfilesFolder, "store-installer-temp");

        private sealed class StoredWebViewProfile
        {
            public string ProfileName { get; set; } = "";
            public string OwnerUserId { get; set; } = "";
            public string AppKey { get; set; } = "";
            public string EnvironmentKind { get; set; } = GenericWebViewEnvironmentKind;
            public bool PendingDeletion { get; set; }
        }

        private sealed record MediaWebViewProfileIdentity(
            string ProfileName,
            string OwnerUserId,
            string AppKey,
            string EnvironmentKind);

        private void InitializeWebViewProfileStorage()
        {
            lock (_webViewProfileStorageLock)
            {
                if (_webViewProfileStorageReady) return;
                if (!string.IsNullOrWhiteSpace(_webViewProfileStorageError))
                    throw new InvalidOperationException(_webViewProfileStorageError);

                try
                {
                    string root = Path.GetFullPath(DoorpiPaths.BrowserProfilesFolder);
                    string expected = Path.GetFullPath(Path.Combine(DoorpiPaths.DataFolder, "browser-profiles"));
                    if (!string.Equals(root, expected, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidOperationException("A raiz dos perfis WebView2 não corresponde à pasta de dados esperada.");

                    if (!File.Exists(WebViewProfileSchemaMarkerPath) ||
                        !string.Equals(File.ReadAllText(WebViewProfileSchemaMarkerPath).Trim(), WebViewProfileSchemaVersion, StringComparison.Ordinal))
                    {
                        DeleteDirectoryCompletely(root);
                        Directory.CreateDirectory(root);
                        Directory.CreateDirectory(GenericWebViewUserDataFolder);
                        Directory.CreateDirectory(YouTubeWebViewUserDataFolder);
                        Directory.CreateDirectory(StoreInstallerWebViewRoot);
                        SafeWriteAllText(WebViewProfileIndexPath, "[]");
                        SafeWriteAllText(WebViewProfileSchemaMarkerPath, WebViewProfileSchemaVersion);
                        Debug.WriteLine("[WebViewProfiles] Estrutura Chromium legada removida; schema v2 criado.");
                    }
                    else
                    {
                        Directory.CreateDirectory(root);
                        Directory.CreateDirectory(GenericWebViewUserDataFolder);
                        Directory.CreateDirectory(YouTubeWebViewUserDataFolder);
                        try { DeleteDirectoryCompletely(StoreInstallerWebViewRoot); }
                        catch (Exception ex)
                        {
                            Debug.WriteLine("[StoreInstall] Pasta temporária ainda em uso; nova limpeza será tentada depois: " + ex.Message);
                        }
                        Directory.CreateDirectory(StoreInstallerWebViewRoot);
                    }

                    _webViewProfileStorageReady = true;
                }
                catch (Exception ex)
                {
                    _webViewProfileStorageError =
                        "Não foi possível limpar e inicializar os perfis Chromium do Doorpi: " + ex.Message;
                    Debug.WriteLine("[WebViewProfiles] " + _webViewProfileStorageError);
                    throw new InvalidOperationException(_webViewProfileStorageError, ex);
                }
            }
        }

        private static void DeleteDirectoryCompletely(string path)
        {
            if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path)) return;

            Exception? lastError = null;
            for (int attempt = 0; attempt < 6; attempt++)
            {
                try
                {
                    foreach (string file in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
                    {
                        try { File.SetAttributes(file, FileAttributes.Normal); } catch { }
                    }

                    Directory.Delete(path, recursive: true);
                    return;
                }
                catch (Exception ex)
                {
                    lastError = ex;
                    GC.Collect();
                    GC.WaitForPendingFinalizers();
                    Thread.Sleep(120 + (attempt * 120));
                }
            }

            throw new IOException($"A pasta '{path}' continuou em uso após as tentativas de limpeza.", lastError);
        }

        private Task<CoreWebView2Environment> GetMediaWebViewEnvironmentAsync(bool isYouTube)
        {
            InitializeWebViewProfileStorage();

            lock (_mediaWebViewEnvironmentLock)
            {
                ref Task<CoreWebView2Environment>? environmentTask = ref isYouTube
                    ? ref _youtubeMediaWebViewEnvironmentTask
                    : ref _genericMediaWebViewEnvironmentTask;

                if (environmentTask != null) return environmentTask;

                string renderModeVariable = isYouTube
                    ? "DOORPI_YOUTUBE_WEBVIEW_RENDER_MODE"
                    : "DOORPI_WEBVIEW_RENDER_MODE";
                string extraArgsVariable = isYouTube
                    ? "DOORPI_YOUTUBE_WEBVIEW_EXTRA_ARGS"
                    : "DOORPI_MEDIA_WEBVIEW_EXTRA_ARGS";
                string browserArgs = BuildWebViewAdditionalArguments(
                    renderModeVariable,
                    defaultRenderMode: "hardware",
                    extraArgsVariable);
                string userDataFolder = isYouTube
                    ? YouTubeWebViewUserDataFolder
                    : GenericWebViewUserDataFolder;
                bool extensionsEnabled = !isYouTube;
                var options = new CoreWebView2EnvironmentOptions(browserArgs)
                {
                    AreBrowserExtensionsEnabled = extensionsEnabled
                };

                LogWebViewDiagnostic(
                    $"shared-environment-create kind={(isYouTube ? YouTubeWebViewEnvironmentKind : GenericWebViewEnvironmentKind)} " +
                    $"folder={userDataFolder} extensions={extensionsEnabled} args={browserArgs}");

                Task<CoreWebView2Environment> created =
                    CoreWebView2Environment.CreateAsync(null, userDataFolder, options);
                environmentTask = created;
                _ = created.ContinueWith(task =>
                {
                    if (!task.IsFaulted && !task.IsCanceled) return;
                    lock (_mediaWebViewEnvironmentLock)
                    {
                        if (isYouTube && ReferenceEquals(_youtubeMediaWebViewEnvironmentTask, created))
                            _youtubeMediaWebViewEnvironmentTask = null;
                        else if (!isYouTube && ReferenceEquals(_genericMediaWebViewEnvironmentTask, created))
                            _genericMediaWebViewEnvironmentTask = null;
                    }
                }, TaskScheduler.Default);
                return created;
            }
        }

        private static CoreWebView2ControllerOptions CreateMediaWebViewControllerOptions(
            CoreWebView2Environment environment,
            string profileName)
        {
            var options = environment.CreateCoreWebView2ControllerOptions();
            options.ProfileName = profileName;
            options.IsInPrivateModeEnabled = false;
            options.DefaultBackgroundColor = System.Drawing.Color.Black;
            return options;
        }

        private async Task EnsureWebViewWithProfileAsync(
            WebView2 view,
            CoreWebView2Environment environment,
            string profileName)
        {
            if (string.IsNullOrWhiteSpace(profileName))
                throw new InvalidOperationException("O perfil WebView2 ativo não foi definido.");

            var controllerOptions = CreateMediaWebViewControllerOptions(environment, profileName);
            await view.EnsureCoreWebView2Async(environment, controllerOptions);
        }

        private MediaWebViewProfileIdentity ResolveMediaWebViewProfile(string url, bool isYouTube)
        {
            MediaAppModel? media = null;
            try
            {
                media = LoadMediaApps().FirstOrDefault(app =>
                    string.Equals(app.Url, url, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(app.Id, url, StringComparison.OrdinalIgnoreCase));
            }
            catch { }

            string ownerUserId = !string.IsNullOrWhiteSpace(media?.OwnerUserId)
                ? media.OwnerUserId
                : (string.IsNullOrWhiteSpace(currentUserId) ? "default" : currentUserId);
            string appKey;
            if (_isGenericBrowserMode)
            {
                appKey = DoorpiBrowserAppId;
            }
            else if (media != null)
            {
                appKey = GetMediaAppKey(media);
            }
            else if (isYouTube)
            {
                appKey = "youtube";
            }
            else
            {
                var nativeApp = _nativeApps.FirstOrDefault(app => IsSameCanonicalWebUrl(url, app.Url));
                appKey = nativeApp != default
                    ? nativeApp.Id
                    : Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(url)))[..10].ToLowerInvariant();
            }

            string environmentKind = isYouTube
                ? YouTubeWebViewEnvironmentKind
                : GenericWebViewEnvironmentKind;
            string profileName = BuildStableWebViewProfileName(ownerUserId, appKey);
            return new MediaWebViewProfileIdentity(
                profileName,
                ownerUserId,
                appKey,
                environmentKind);
        }

        private static string BuildStableWebViewProfileName(string ownerUserId, string appKey)
        {
            static string HashToken(string value)
            {
                string normalized = (value ?? "").Trim().ToLowerInvariant();
                return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalized)))
                    [..20]
                    .ToLowerInvariant();
            }

            return $"u_{HashToken(ownerUserId)}_a_{HashToken(appKey)}";
        }

        private void RegisterMediaWebViewProfile(MediaWebViewProfileIdentity identity)
        {
            lock (_webViewProfileStorageLock)
            {
                var profiles = LoadStoredWebViewProfilesUnsafe();
                var existing = profiles.FirstOrDefault(profile =>
                    string.Equals(profile.ProfileName, identity.ProfileName, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(profile.EnvironmentKind, identity.EnvironmentKind, StringComparison.OrdinalIgnoreCase));
                if (existing == null)
                {
                    profiles.Add(new StoredWebViewProfile
                    {
                        ProfileName = identity.ProfileName,
                        OwnerUserId = identity.OwnerUserId,
                        AppKey = identity.AppKey,
                        EnvironmentKind = identity.EnvironmentKind
                    });
                }
                else
                {
                    existing.OwnerUserId = identity.OwnerUserId;
                    existing.AppKey = identity.AppKey;
                    existing.PendingDeletion = false;
                }

                SaveStoredWebViewProfilesUnsafe(profiles);
            }
        }

        private List<StoredWebViewProfile> LoadStoredWebViewProfilesUnsafe()
        {
            try
            {
                if (!File.Exists(WebViewProfileIndexPath)) return new List<StoredWebViewProfile>();
                return JsonSerializer.Deserialize<List<StoredWebViewProfile>>(
                           File.ReadAllText(WebViewProfileIndexPath)) ??
                       new List<StoredWebViewProfile>();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[WebViewProfiles] Falha ao ler índice: " + ex.Message);
                return new List<StoredWebViewProfile>();
            }
        }

        private void SaveStoredWebViewProfilesUnsafe(List<StoredWebViewProfile> profiles)
        {
            SafeWriteAllText(
                WebViewProfileIndexPath,
                JsonSerializer.Serialize(profiles, IndentedJsonOptions));
        }

        private async Task DeleteMediaWebViewProfileAsync(MediaAppModel media)
        {
            string ownerUserId = string.IsNullOrWhiteSpace(media.OwnerUserId)
                ? currentUserId
                : media.OwnerUserId;
            string appKey = GetMediaAppKey(media);
            await DeleteRegisteredWebViewProfilesAsync(profile =>
                string.Equals(profile.OwnerUserId, ownerUserId, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(profile.AppKey, appKey, StringComparison.OrdinalIgnoreCase));
        }

        private Task DeleteWebViewProfilesForOwnerAsync(string ownerUserId) =>
            DeleteRegisteredWebViewProfilesAsync(profile =>
                string.Equals(profile.OwnerUserId, ownerUserId, StringComparison.OrdinalIgnoreCase));

        private async Task DeleteRegisteredWebViewProfilesAsync(Func<StoredWebViewProfile, bool> predicate)
        {
            List<StoredWebViewProfile> targets;
            lock (_webViewProfileStorageLock)
            {
                var profiles = LoadStoredWebViewProfilesUnsafe();
                targets = profiles.Where(predicate).ToList();
                foreach (var target in targets) target.PendingDeletion = true;
                SaveStoredWebViewProfilesUnsafe(profiles);
            }

            foreach (var target in targets)
                await DeleteRegisteredWebViewProfileAsync(target);
        }

        private async Task DeleteRegisteredWebViewProfileAsync(StoredWebViewProfile target)
        {
            try
            {
                if (!Dispatcher.CheckAccess())
                {
                    await Dispatcher.InvokeAsync(() => DeleteRegisteredWebViewProfileAsync(target)).Task.Unwrap();
                    return;
                }

                bool isYouTube = string.Equals(
                    target.EnvironmentKind,
                    YouTubeWebViewEnvironmentKind,
                    StringComparison.OrdinalIgnoreCase);
                CoreWebView2Environment environment = await GetMediaWebViewEnvironmentAsync(isYouTube);
                var deleteView = new WebView2();
                try { deleteView.DefaultBackgroundColor = System.Drawing.Color.Black; } catch { }
                var host = new Window
                {
                    Width = 1,
                    Height = 1,
                    Left = -32000,
                    Top = -32000,
                    Opacity = 0,
                    ShowActivated = false,
                    ShowInTaskbar = false,
                    WindowStyle = WindowStyle.None,
                    Content = deleteView
                };

                try
                {
                    host.Show();
                    await EnsureWebViewWithProfileAsync(deleteView, environment, target.ProfileName);
                    await deleteView.CoreWebView2.Profile.ClearBrowsingDataAsync();
                    deleteView.CoreWebView2.Profile.Delete();
                }
                finally
                {
                    host.Content = null;
                    try { deleteView.Dispose(); } catch { }
                    try { host.Close(); } catch { }
                }

                lock (_webViewProfileStorageLock)
                {
                    var profiles = LoadStoredWebViewProfilesUnsafe();
                    profiles.RemoveAll(profile =>
                        string.Equals(profile.ProfileName, target.ProfileName, StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(profile.EnvironmentKind, target.EnvironmentKind, StringComparison.OrdinalIgnoreCase));
                    SaveStoredWebViewProfilesUnsafe(profiles);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[WebViewProfiles] Falha ao excluir perfil {target.ProfileName}: {ex.Message}");
            }
        }

        private async Task RetryPendingWebViewProfileDeletionsAsync(CancellationToken cancellationToken)
        {
            List<StoredWebViewProfile> pending;
            lock (_webViewProfileStorageLock)
            {
                pending = LoadStoredWebViewProfilesUnsafe()
                    .Where(profile => profile.PendingDeletion)
                    .ToList();
            }

            foreach (var profile in pending)
            {
                cancellationToken.ThrowIfCancellationRequested();
                await DeleteRegisteredWebViewProfileAsync(profile);
            }
        }

        private async Task PrewarmMediaWebViewEnvironmentsAsync(int delayMilliseconds = 1800)
        {
            if (Interlocked.Exchange(ref _mediaWebViewPrewarmStarted, 1) == 1) return;

            var cts = new CancellationTokenSource();
            _mediaWebViewGlobalWarmupCts = cts;
            try
            {
                if (delayMilliseconds > 0)
                    await Task.Delay(delayMilliseconds, cts.Token);

                await WarmMediaWebViewEnvironmentAsync(isYouTube: false, cts.Token);
                await Task.Delay(120, cts.Token);
                await WarmMediaWebViewEnvironmentAsync(isYouTube: true, cts.Token);
                await RetryPendingWebViewProfileDeletionsAsync(cts.Token);
                LogWebViewDiagnostic("shared-environments-controllers-prewarmed");
            }
            catch (OperationCanceledException)
            {
                Debug.WriteLine("[WebViewProfiles] Aquecimento global cancelado para priorizar o web app aberto.");
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[WebViewProfiles] Falha no pré-aquecimento: " + ex.Message);
            }
            finally
            {
                DisposeMediaWebViewGlobalWarmupHost();
                if (ReferenceEquals(_mediaWebViewGlobalWarmupCts, cts))
                    _mediaWebViewGlobalWarmupCts = null;
                cts.Dispose();
                Interlocked.Exchange(ref _mediaWebViewPrewarmStarted, 0);
            }
        }

        private async Task WarmMediaWebViewEnvironmentAsync(
            bool isYouTube,
            CancellationToken cancellationToken)
        {
            int environmentBit = isYouTube ? 2 : 1;
            if ((Volatile.Read(ref _mediaWebViewWarmedEnvironmentMask) & environmentBit) != 0)
                return;

            cancellationToken.ThrowIfCancellationRequested();
            CoreWebView2Environment environment = await GetMediaWebViewEnvironmentAsync(isYouTube);
            cancellationToken.ThrowIfCancellationRequested();
            var stopwatch = Stopwatch.StartNew();

            var view = new WebView2();
            try { view.DefaultBackgroundColor = System.Drawing.Color.Black; } catch { }
            var host = new Window
            {
                Width = 1,
                Height = 1,
                Left = -32000,
                Top = -32000,
                Opacity = 0,
                ShowActivated = false,
                ShowInTaskbar = false,
                WindowStyle = WindowStyle.None,
                Content = view
            };

            _mediaWebViewGlobalWarmupHost = host;
            _mediaWebViewGlobalWarmupView = view;
            try
            {
                host.Show();
                await view.EnsureCoreWebView2Async(environment);
                cancellationToken.ThrowIfCancellationRequested();
                MarkMediaWebViewEnvironmentWarmed(isYouTube);
                LogWebViewDiagnostic(
                    $"shared-environment-controller-prewarmed kind={(isYouTube ? YouTubeWebViewEnvironmentKind : GenericWebViewEnvironmentKind)} elapsedMs={stopwatch.ElapsedMilliseconds}");
            }
            finally
            {
                if (ReferenceEquals(_mediaWebViewGlobalWarmupHost, host))
                    DisposeMediaWebViewGlobalWarmupHost();
                else
                {
                    host.Content = null;
                    try { view.Dispose(); } catch { }
                    try { host.Close(); } catch { }
                }
            }
        }

        private void MarkMediaWebViewEnvironmentWarmed(bool isYouTube)
        {
            int environmentBit = isYouTube ? 2 : 1;
            Interlocked.Or(ref _mediaWebViewWarmedEnvironmentMask, environmentBit);
        }

        private void CancelMediaWebViewGlobalWarmup()
        {
            try { _mediaWebViewGlobalWarmupCts?.Cancel(); } catch { }
            if (Dispatcher.CheckAccess())
                DisposeMediaWebViewGlobalWarmupHost();
            else
                _ = Dispatcher.BeginInvoke(DisposeMediaWebViewGlobalWarmupHost);
        }

        private void DisposeMediaWebViewGlobalWarmupHost()
        {
            var host = _mediaWebViewGlobalWarmupHost;
            var view = _mediaWebViewGlobalWarmupView;
            _mediaWebViewGlobalWarmupHost = null;
            _mediaWebViewGlobalWarmupView = null;
            try { if (host != null) host.Content = null; } catch { }
            try { view?.Dispose(); } catch { }
            try { host?.Close(); } catch { }
        }

        private string CreateStoreInstallerWebViewProfilePath(string storeId)
        {
            InitializeWebViewProfileStorage();
            Directory.CreateDirectory(StoreInstallerWebViewRoot);
            return Path.Combine(
                StoreInstallerWebViewRoot,
                $"{SafePathSegment(storeId)}-{Guid.NewGuid():N}");
        }

        private void ScheduleStoreInstallerWebViewProfileCleanup(string profilePath)
        {
            if (string.IsNullOrWhiteSpace(profilePath)) return;
            _ = Task.Run(async () =>
            {
                for (int attempt = 0; attempt < 12; attempt++)
                {
                    try
                    {
                        await Task.Delay(250 + (attempt * 250)).ConfigureAwait(false);
                        string fullPath = Path.GetFullPath(profilePath);
                        string root = Path.GetFullPath(StoreInstallerWebViewRoot)
                            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) +
                            Path.DirectorySeparatorChar;
                        if (!fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase)) return;
                        if (Directory.Exists(fullPath)) Directory.Delete(fullPath, recursive: true);
                        return;
                    }
                    catch (Exception ex)
                    {
                        if (attempt == 11)
                            Debug.WriteLine("[StoreInstall] Perfil temporário será limpo no próximo boot: " + ex.Message);
                    }
                }
            });
        }

        private void ClearMediaWebViewEnvironmentReferences()
        {
            CancelMediaWebViewGlobalWarmup();
            lock (_mediaWebViewEnvironmentLock)
            {
                _genericMediaWebViewEnvironmentTask = null;
                _youtubeMediaWebViewEnvironmentTask = null;
            }
        }
    }
}
