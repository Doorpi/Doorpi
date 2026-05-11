using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Text.Json.Nodes;

namespace Doorpi
{
    // ========================= MODELS =========================
    public class MediaAppModel
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Url { get; set; } = "";
        public string Type { get; set; } = "browser"; // "browser" | "webview"
        public bool MultiUser { get; set; } = true;
        public string OwnerUserId { get; set; } = "";
        public string ShareMode { get; set; } = "private"; // "private" | "all" | "user"
        public string SharedWithUserId { get; set; } = "";
        public string SharedWithUserName { get; set; } = "";
        public bool IsSharedFromOtherUser { get; set; }
        public string SharedFromUserName { get; set; } = "";
        public string GridImage { get; set; } = "";
        public string GridStaticImage { get; set; } = "";
        public string GridHorizontalImage { get; set; } = "";
        public string GridHorizontalStaticImage { get; set; } = "";
        public string HeroImage { get; set; } = "";
        public string HeroStaticImage { get; set; } = "";
        public string LogoImage { get; set; } = "";
        public string LogoStaticImage { get; set; } = "";

        public DateTime LastPlayed { get; set; } = DateTime.MinValue;
        public DateTime DateAdded { get; set; } = DateTime.Now;
    }

    public class InstalledApp
    {
        public string Name { get; set; } = "";
        public string Path { get; set; } = "";
        public string LaunchUrl { get; set; } = "";
        public string Date { get; set; } = "";
        public int Size { get; set; }
        public string IconBase64 { get; set; } = "";
        public bool IsAdded { get; set; }
        public string AddedTo { get; set; } = "";
        public string Source { get; set; } = "";
    }

    public class UserProfile
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string PhotoBase64 { get; set; } = "";
        public string SteamGridApiKey { get; set; } = "";
        public DateTime DateCreated { get; set; } = DateTime.Now;
        public DateTime LastUsed { get; set; } = DateTime.MinValue;
    }

    public class BrowserExtensionModel
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string SourceUrl { get; set; } = "";
        public string InstalledPath { get; set; } = "";
        public DateTime DateInstalled { get; set; } = DateTime.Now;
    }

    public class AppCacheModel
    {
        public HashSet<string> WindowsFingerprint { get; set; } = new();
        public Dictionary<string, long> FolderTimestamps { get; set; } = new(StringComparer.OrdinalIgnoreCase);


        public HashSet<string> SteamFingerprint { get; set; } = new();
        public HashSet<string> EpicFingerprint { get; set; } = new();
        public HashSet<string> GogFingerprint { get; set; } = new();
        public HashSet<string> RiotFingerprint { get; set; } = new();
        public List<InstalledApp> WindowsApps { get; set; } = new();
        public List<InstalledApp> FolderApps { get; set; } = new();
        public List<InstalledApp> SteamApps { get; set; } = new();
        public List<InstalledApp> EpicApps { get; set; } = new();
        public List<InstalledApp> GogApps { get; set; } = new();
        public List<InstalledApp> RiotApps { get; set; } = new();
    }

    public class FolderStats
    {
        public string Path { get; set; } = "";
        public int SubfolderCount { get; set; }
        public int ExeCount { get; set; }
    }

    // ========================= MAIN WINDOW =========================

    public partial class MainWindow : Window
    {
        private static readonly HttpClient httpClient = new HttpClient();
        private static readonly HttpClient downloadClient = new HttpClient();

        private readonly string dataFolder;
        private readonly string gridFolder;
        private readonly string heroFolder;
        private readonly string gridHorizontalFolder;
        private readonly string logoFolder;
        private readonly string iconCacheFolder;
        private readonly string profilesFile;
        private readonly string currentUserFile;
        private string currentUserId = "";
        private string currentUserDataFolder = "";
        private string userFile;
        private string mediaFile;

        private string _currentToastTitle = "";
        private string _currentToastSub = "";

        private string _extBtnTitle = "Adicionar extensão ao Doorpi";
        private string _extBtnSub = "Instalar via Doorpi Browser";
        private string _extToastTitle = "Doorpi";
        private string _extToastSub = "Extensão enviada ao Doorpi!";
        private string _extInstalledTitle = "Já instalada no Doorpi";
        private string _extInstalledSub = "Em uso no seu navegador";
        private string GetStr(JsonElement root, string propName, string fallback = "")
        {
            return root.TryGetProperty(propName, out var prop) ? (prop.GetString() ?? fallback) : fallback;
        }

        private string gamesFile;
        private string foldersFile;
        private string appCacheFile;

        private readonly List<FileSystemWatcher> _folderWatchers = new();
        private volatile bool _windowsCacheInvalid = false;
        private volatile bool _pollingActive = false;
        private readonly SemaphoreSlim _cacheLock = new SemaphoreSlim(1, 1);
        private DateTime _lastCacheBuilt = DateTime.MinValue;

        private bool _mainScreenMouseVisible = false;
        private POINT _lastKnownCursorPos;
        private System.Threading.Timer? _mouseIdleTimer;
        private System.Threading.Timer? _mousePollTimer;
        private const int MOUSE_IDLE_MS = 3000;

        [DllImport("user32.dll")] private static extern bool GetCursorPos(out POINT lpPoint);
        [DllImport("user32.dll")] private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
        [DllImport("xinput1_4.dll", EntryPoint = "XInputGetState")]
        private static extern int XInputGetState(int dwUserIndex, out XINPUT_STATE pState); [StructLayout(LayoutKind.Sequential)]
        private struct POINT { public int X; public int Y; }
        [StructLayout(LayoutKind.Sequential)]
        private struct XINPUT_STATE { public uint dwPacketNumber; public XINPUT_GAMEPAD Gamepad; }
        [StructLayout(LayoutKind.Sequential)]
        private struct XINPUT_GAMEPAD
        {
            public ushort wButtons;
            public byte bLeftTrigger;
            public byte bRightTrigger;
            public short sThumbLX;
            public short sThumbLY;
            public short sThumbRX;
            public short sThumbRY;
        }

        private System.Windows.Threading.DispatcherTimer? _desktopControllerTimer;
        private ushort _desktopPrevButtons = 0;
        private byte _desktopPrevLT = 0;
        private byte _desktopPrevRT = 0;

        // ========================= CONSTRUTOR =========================

        public MainWindow()
        {
            InitializeComponent();

            dataFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data");
            gridFolder = Path.Combine(dataFolder, "images", "grid");
            heroFolder = Path.Combine(dataFolder, "images", "hero");
            gridHorizontalFolder = Path.Combine(dataFolder, "images", "grid-horizontal");
            logoFolder = Path.Combine(dataFolder, "images", "logo");
            iconCacheFolder = Path.Combine(dataFolder, "iconcache");

            profilesFile = Path.Combine(dataFolder, "users.json");
            currentUserFile = Path.Combine(dataFolder, "current-user.json");
            userFile = Path.Combine(dataFolder, "user.json");
            gamesFile = Path.Combine(dataFolder, "games.json");
            foldersFile = Path.Combine(dataFolder, "folders.json");
            appCacheFile = Path.Combine(dataFolder, "appcache.json");
            mediaFile = Path.Combine(dataFolder, "media.json");

            Directory.CreateDirectory(Path.Combine(dataFolder, "extensions"));
            Directory.CreateDirectory(Path.Combine(dataFolder, "users"));
            Directory.CreateDirectory(dataFolder);
            Directory.CreateDirectory(gridFolder);
            Directory.CreateDirectory(heroFolder);
            Directory.CreateDirectory(gridHorizontalFolder);
            Directory.CreateDirectory(logoFolder);
            Directory.CreateDirectory(iconCacheFolder);

            InitializeUserStorage();

            InitializeAsync();

            EnsureCursorHidden();
            StartMainScreenMouseWatch();
        }
        private void EnsureCursorHidden()
        {
            while (ShowCursor(false) >= 0) { }
        }

        private void EnsureCursorVisible()
        {
            while (ShowCursor(true) < 0) { }
        }

        private void StartMainScreenMouseWatch()
        {
            GetCursorPos(out _lastKnownCursorPos);

            _mouseIdleTimer = new System.Threading.Timer(_ =>
            {
                if (_ytWebView != null) return;
                Dispatcher.Invoke(() =>
                {
                    if (!_mainScreenMouseVisible) return;
                    EnsureCursorHidden();
                    _mainScreenMouseVisible = false;
                });
            }, null, Timeout.Infinite, Timeout.Infinite);

            _mousePollTimer = new System.Threading.Timer(_ =>
            {
                if (_ytWebView != null) return;
                if (!GetCursorPos(out var pt)) return;
                if (pt.X == _lastKnownCursorPos.X && pt.Y == _lastKnownCursorPos.Y) return;

                _lastKnownCursorPos = pt;
                Dispatcher.Invoke(() =>
                {
                    if (!_mainScreenMouseVisible)
                    {
                        EnsureCursorVisible();
                        _mainScreenMouseVisible = true;
                    }
                });
                _mouseIdleTimer?.Change(MOUSE_IDLE_MS, Timeout.Infinite);
            }, null, 0, 100);
        }

        private void StopMainScreenMouseWatch()
        {
            _mousePollTimer?.Change(Timeout.Infinite, Timeout.Infinite);
            _mouseIdleTimer?.Change(Timeout.Infinite, Timeout.Infinite);
            _mousePollTimer?.Dispose(); _mousePollTimer = null;
            _mouseIdleTimer?.Dispose(); _mouseIdleTimer = null;
        }
        // ========================= INICIALIZAÇÃO =========================

        async void InitializeAsync()
        {
            await webView.EnsureCoreWebView2Async(null);
            webView.CoreWebView2.OpenDevToolsWindow();

            string folderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");

            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "app.local", folderPath, CoreWebView2HostResourceAccessKind.Allow);
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "data.local", dataFolder, CoreWebView2HostResourceAccessKind.Allow);

            webView.CoreWebView2.Navigate("https://app.local/index.html");
            webView.CoreWebView2.WebMessageReceived += WebView_WebMessageReceived;
            webView.CoreWebView2.NavigationCompleted += (s, e) =>
            {
                if (NeedsSetup())
                {
                    Dispatcher.InvokeAsync(() =>
                        webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"showSetup\"}"));
                }
                else
                {
                    SendUsersToUI(requireSelection: true);
                }

                Dispatcher.InvokeAsync(() =>
                {
                    Topmost = true; Activate(); Topmost = false; webView.Focus();
                });
            };

            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;

            StartWatchers();
            _ = Task.Run(WatchWindowsRegistry);
        }
        private HashSet<string> GetSteamFingerprint()
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Valve\Steam")
                             ?? Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Valve\Steam");

                if (key?.GetValue("InstallPath") is not string steamPath) return keys;

                string configPath = Path.Combine(steamPath, "steamapps", "libraryfolders.vdf");
                if (!File.Exists(configPath)) return keys;

                var matches = Regex.Matches(File.ReadAllText(configPath), @"""path""\s+""([^""]+)""");
                foreach (Match match in matches)
                {
                    string appsPath = Path.Combine(
                        match.Groups[1].Value.Replace(@"\\", @"\"), "steamapps");

                    if (!Directory.Exists(appsPath)) continue;

                    foreach (var acf in Directory.GetFiles(appsPath, "appmanifest_*.acf"))
                    {
                        var fi = new FileInfo(acf);
                        keys.Add($"{fi.Name}|{fi.LastWriteTimeUtc.Ticks}");
                    }
                }
            }
            catch (Exception ex) { Debug.WriteLine("SteamFingerprint: " + ex.Message); }
            return keys;
        }

        private HashSet<string> GetEpicFingerprint()
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                string manifestPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                    "Epic", "EpicGamesLauncher", "Data", "Manifests");

                if (!Directory.Exists(manifestPath)) return keys;

                foreach (var file in Directory.GetFiles(manifestPath, "*.item"))
                {
                    var fi = new FileInfo(file);
                    keys.Add($"{fi.Name}|{fi.LastWriteTimeUtc.Ticks}");
                }
            }
            catch (Exception ex) { Debug.WriteLine("EpicFingerprint: " + ex.Message); }
            return keys;
        }

        private HashSet<string> GetGogFingerprint()
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\GOG.com\Games");
                if (key == null) return keys;
                foreach (var sub in key.GetSubKeyNames()) keys.Add(sub);
            }
            catch (Exception ex) { Debug.WriteLine("GogFingerprint: " + ex.Message); }
            return keys;
        }
        // ========================= WATCHERS =========================
        private void InitializeUserStorage()
        {
            Directory.CreateDirectory(dataFolder);
            Directory.CreateDirectory(Path.Combine(dataFolder, "users"));

            var users = LoadUserProfiles();
            if (users.Count == 0 && File.Exists(userFile))
            {
                try
                {
                    var legacy = JsonSerializer.Deserialize<UserProfile>(File.ReadAllText(userFile));
                    if (legacy != null && !string.IsNullOrWhiteSpace(legacy.Name))
                    {
                        legacy.Id = MakeUserId(legacy.Name);
                        legacy.DateCreated = DateTime.Now;
                        legacy.LastUsed = DateTime.Now;
                        users.Add(legacy);
                        SaveUserProfiles(users);
                        currentUserId = legacy.Id;
                        File.WriteAllText(currentUserFile, legacy.Id);
                        SetActiveUser(legacy, migrateLegacyFiles: true);
                        return;
                    }
                }
                catch { }
            }

            currentUserId = File.Exists(currentUserFile) ? File.ReadAllText(currentUserFile).Trim() : "";
            var current = users.FirstOrDefault(u => string.Equals(u.Id, currentUserId, StringComparison.OrdinalIgnoreCase))
                          ?? users.OrderByDescending(u => u.LastUsed).FirstOrDefault();
            if (current != null) SetActiveUser(current, migrateLegacyFiles: false);
            else SetActiveUser(new UserProfile { Id = "default", Name = "" }, migrateLegacyFiles: false);
        }

        private List<UserProfile> LoadUserProfiles()
        {
            if (!File.Exists(profilesFile)) return new List<UserProfile>();
            try
            {
                var users = JsonSerializer.Deserialize<List<UserProfile>>(File.ReadAllText(profilesFile)) ?? new();
                foreach (var user in users.Where(u => string.IsNullOrWhiteSpace(u.Id)))
                    user.Id = MakeUserId(user.Name);
                return users;
            }
            catch { return new List<UserProfile>(); }
        }

        private void SaveUserProfiles(List<UserProfile> users)
        {
            File.WriteAllText(profilesFile, JsonSerializer.Serialize(users, new JsonSerializerOptions { WriteIndented = true }));
        }

        private static string MakeUserId(string name)
        {
            var clean = new string((name ?? "").Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(clean)) clean = "user";
            string suffix = Convert.ToHexString(Guid.NewGuid().ToByteArray())[..8].ToLowerInvariant();
            return $"{clean}-{suffix}";
        }

        private static string SafePathSegment(string value)
        {
            var clean = string.Concat((value ?? "").Where(c => !Path.GetInvalidFileNameChars().Contains(c))).Trim();
            return string.IsNullOrWhiteSpace(clean) ? "default" : clean;
        }

        private void SetActiveUser(UserProfile profile, bool migrateLegacyFiles)
        {
            if (string.IsNullOrWhiteSpace(profile.Id)) profile.Id = MakeUserId(profile.Name);
            currentUserId = profile.Id;
            currentUserDataFolder = Path.Combine(dataFolder, "users", currentUserId);
            Directory.CreateDirectory(currentUserDataFolder);

            userFile = Path.Combine(currentUserDataFolder, "user.json");
            gamesFile = Path.Combine(currentUserDataFolder, "games.json");
            foldersFile = Path.Combine(currentUserDataFolder, "folders.json");
            appCacheFile = Path.Combine(currentUserDataFolder, "appcache.json");
            mediaFile = Path.Combine(currentUserDataFolder, "media.json");

            if (migrateLegacyFiles)
            {
                CopyLegacyFile("games.json", gamesFile);
                CopyLegacyFile("folders.json", foldersFile);
                CopyLegacyFile("appcache.json", appCacheFile);
                CopyLegacyFile("media.json", mediaFile);
            }

            if (!File.Exists(gamesFile)) File.WriteAllText(gamesFile, "[]");
            if (!File.Exists(foldersFile)) File.WriteAllText(foldersFile, "[]");
            if (!File.Exists(mediaFile)) File.WriteAllText(mediaFile, "[]");

            SaveUserProfile(profile);
            MirrorCurrentUserDataFiles();
            File.WriteAllText(currentUserFile, currentUserId);
            File.WriteAllText(Path.Combine(dataFolder, "user.json"),
                JsonSerializer.Serialize(profile, new JsonSerializerOptions { WriteIndented = true }));
        }

        private void MirrorCurrentUserDataFiles()
        {
            try
            {
                if (File.Exists(gamesFile)) File.Copy(gamesFile, Path.Combine(dataFolder, "games.json"), true);
                if (File.Exists(foldersFile)) File.Copy(foldersFile, Path.Combine(dataFolder, "folders.json"), true);
                if (File.Exists(mediaFile))
                {
                    File.WriteAllText(Path.Combine(dataFolder, "media.json"),
                        JsonSerializer.Serialize(LoadMediaApps(), new JsonSerializerOptions { WriteIndented = true }));
                }
            }
            catch (Exception ex) { Debug.WriteLine("[Users] Falha ao espelhar dados atuais: " + ex.Message); }
        }

        private void CopyLegacyFile(string fileName, string target)
        {
            try
            {
                string source = Path.Combine(dataFolder, fileName);
                if (File.Exists(source) && !File.Exists(target)) File.Copy(source, target);
            }
            catch (Exception ex) { Debug.WriteLine($"[Users] Falha ao migrar {fileName}: {ex.Message}"); }
        }

        private void SendUsersToUI(bool requireSelection)
        {
            var users = LoadUserProfiles().OrderByDescending(u => u.LastUsed).ToList();
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "usersList",
                    users,
                    currentUserId,
                    requireSelection
                })));
        }

        private void ClearHomeUi()
        {
            Dispatcher.Invoke(() =>
            {
                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"clearGamesGrid\"}");
                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"clearMediaGrid\"}");
                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"nativeAppsLoaded\",\"apps\":[]}");
            });
        }

        private void LoadCurrentUserIntoUI()
        {
            ClearHomeUi();


            var user = LoadUserProfile();
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "currentUserUpdated",
                    user = user
                })));

            LoadGamesIntoUI();
            var apps = LoadMediaApps();
            if (apps.Any()) SendMediaAppsToUI(apps);
            _ = Task.Run(() => UpdateAppCacheAsync());
        }

        private void SwitchToUser(string userId)
        {
            var users = LoadUserProfiles();
            var user = users.FirstOrDefault(u => string.Equals(u.Id, userId, StringComparison.OrdinalIgnoreCase));
            if (user == null) return;

            user.LastUsed = DateTime.Now;
            SaveUserProfiles(users);
            SetActiveUser(user, migrateLegacyFiles: false);
            RestartWatchers();

            _ = Task.Run(async () => {
                // PASSANDO AS VARIAVEIS:
                await InitializeNativeAppsAsync(currentUserId, mediaFile);
                Dispatcher.Invoke(() => LoadCurrentUserIntoUI());
            });
        }

        private void EnterDesktopMode()
        {
            WindowState = WindowState.Minimized;
            ShowTouchKeyboard();
            StartDesktopControllerMode();
        }

        private void ShowTouchKeyboard()
        {
            try
            {
                string tabTip = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonProgramFiles),
                    "microsoft shared", "ink", "TabTip.exe");
                Process.Start(new ProcessStartInfo(File.Exists(tabTip) ? tabTip : "osk.exe") { UseShellExecute = true });
            }
            catch (Exception ex) { Debug.WriteLine("[DesktopMode] teclado: " + ex.Message); }
        }

        private void StartDesktopControllerMode()
        {
            _desktopControllerTimer ??= new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromMilliseconds(16) };
            _desktopControllerTimer.Tick -= DesktopControllerTick;
            _desktopControllerTimer.Tick += DesktopControllerTick;
            _desktopPrevButtons = 0;
            _desktopPrevLT = 0;
            _desktopPrevRT = 0;
            _desktopControllerTimer.Start();
        }

        private void StopDesktopControllerMode()
        {
            _desktopControllerTimer?.Stop();
            _desktopPrevButtons = 0;
            _desktopPrevLT = 0;
            _desktopPrevRT = 0;
        }

        private void DesktopControllerTick(object? sender, EventArgs e)
        {
            if (XInputGetState(0, out var state) != 0) return;
            var gp = state.Gamepad;

            int dx = AxisToCursorDelta(gp.sThumbLX, 16);
            int dy = AxisToCursorDelta(gp.sThumbLY, 16, invert: true);
            if ((dx != 0 || dy != 0) && GetCursorPos(out var pt)) SetCursorPos(pt.X + dx, pt.Y + dy);

            bool Pressed(ushort mask) => (gp.wButtons & mask) != 0 && (_desktopPrevButtons & mask) == 0;
            const ushort DPAD_UP = 0x0001, DPAD_DOWN = 0x0002, DPAD_LEFT = 0x0004, DPAD_RIGHT = 0x0008;
            const ushort START = 0x0010, BACK = 0x0020, A = 0x1000, B = 0x2000, X = 0x4000, Y = 0x8000;

            if (Pressed(START) && (gp.wButtons & BACK) != 0)
            {
                StopDesktopControllerMode();
                WindowState = WindowState.Maximized;
                Activate();
                ForceFocus();
                _desktopPrevButtons = gp.wButtons;
                _desktopPrevLT = gp.bLeftTrigger;
                _desktopPrevRT = gp.bRightTrigger;
                return;
            }

            if (Pressed(A) || (gp.bRightTrigger > 80 && _desktopPrevRT <= 80))
            {
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
            }
            if (Pressed(B) || (gp.bLeftTrigger > 80 && _desktopPrevLT <= 80))
            {
                const uint RIGHTDOWN = 0x0008, RIGHTUP = 0x0010;
                mouse_event(RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                mouse_event(RIGHTUP, 0, 0, 0, UIntPtr.Zero);
            }
            if (Pressed(X)) ShowTouchKeyboard();
            if (Pressed(Y)) SendVirtualKey(0x09);
            if (Pressed(DPAD_UP)) SendVirtualKey(0x26);
            if (Pressed(DPAD_DOWN)) SendVirtualKey(0x28);
            if (Pressed(DPAD_LEFT)) SendVirtualKey(0x25);
            if (Pressed(DPAD_RIGHT)) SendVirtualKey(0x27);
            if (Pressed(START)) SendVirtualKey(0x0D);

            _desktopPrevButtons = gp.wButtons;
            _desktopPrevLT = gp.bLeftTrigger;
            _desktopPrevRT = gp.bRightTrigger;
        }

        private static int AxisToCursorDelta(short rawValue, int maxPixels, bool invert = false)
        {
            const int deadZone = 8000;
            int value = rawValue;
            if (Math.Abs(value) <= deadZone) return 0;

            double normalized = Math.Clamp(value / 32767.0, -1.0, 1.0);
            if (invert) normalized = -normalized;

            double magnitude = Math.Abs(normalized);
            double curved = Math.Sign(normalized) * magnitude * magnitude;
            return (int)Math.Round(curved * maxPixels);
        }

        private static void SendVirtualKey(byte vk)
        {
            const uint KEYEVENTF_KEYUP = 0x0002;
            keybd_event(vk, 0, 0, UIntPtr.Zero);
            keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        }

        private UserProfile LoadUserProfile()
        {
            if (!File.Exists(userFile)) return new UserProfile();
            try { return JsonSerializer.Deserialize<UserProfile>(File.ReadAllText(userFile)) ?? new UserProfile(); }
            catch { return new UserProfile(); }
        }

        private void SaveUserProfile(UserProfile profile)
        {
            if (string.IsNullOrWhiteSpace(profile.Id)) profile.Id = currentUserId;
            File.WriteAllText(userFile, JsonSerializer.Serialize(profile,
                new JsonSerializerOptions { WriteIndented = true }));
            File.WriteAllText(Path.Combine(dataFolder, "user.json"), JsonSerializer.Serialize(profile,
                new JsonSerializerOptions { WriteIndented = true }));
        }

        private string GetSteamGridApiKey() => LoadUserProfile().SteamGridApiKey;

        private async Task<string> SgdbGetStringAsync(string url)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            var key = GetSteamGridApiKey();
            if (!string.IsNullOrEmpty(key))
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);

            var response = await httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        }

        private bool NeedsSetup()
        {
            var users = LoadUserProfiles();
            return users.Count == 0 || users.All(u => string.IsNullOrWhiteSpace(u.Name) || string.IsNullOrWhiteSpace(u.SteamGridApiKey));
        }

        private void StartWatchers()
        {
            foreach (var folder in GetWatchedFolderPaths())
            {
                AddFolderWatcher(folder);
            }
        }

        private void RestartWatchers()
        {
            foreach (var watcher in _folderWatchers)
            {
                try { watcher.EnableRaisingEvents = false; watcher.Dispose(); } catch { }
            }
            _folderWatchers.Clear();
            StartWatchers();
        }

        private void AddFolderWatcher(string path)
        {
            if (!Directory.Exists(path)) return;
            var w = new FileSystemWatcher(path)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.DirectoryName,
                EnableRaisingEvents = true
            };
            // Cache invalidation é checada pelo timestamp no Diff, o watcher agora só existe
            // se futuramente você quiser plugar eventos em realtime na UI.
            _folderWatchers.Add(w);
        }

        private async Task WatchWindowsRegistry()
        {
            var lastPrint = GetWindowsRegistryFingerprint();
            while (true)
            {
                await Task.Delay(30_000);
                var current = GetWindowsRegistryFingerprint();
                if (!current.SetEquals(lastPrint))
                {
                    _windowsCacheInvalid = true;
                    lastPrint = current;
                }
            }
        }

        // ========================= ICON CACHE =========================

        private string GetCachedIcon(string exePath)
        {
            if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath)) return "";
            try
            {
                var info = new FileInfo(exePath);
                string key = $"{exePath}|{info.LastWriteTimeUtc.Ticks}";
                string hash = Convert.ToHexString(
                    System.Security.Cryptography.MD5.HashData(
                        System.Text.Encoding.UTF8.GetBytes(key)))[..12];

                string iconPath = Path.Combine(iconCacheFolder, $"{hash}.b64");

                if (File.Exists(iconPath))
                    return File.ReadAllText(iconPath);

                string b64 = ExtractIcon(exePath);
                if (!string.IsNullOrEmpty(b64))
                    File.WriteAllText(iconPath, b64);

                return b64;
            }
            catch { return ""; }
        }

        private static readonly List<(string Id, string Name, string SgdbQuery, string Url, string Type, bool MultiUser)> _nativeApps = new()
        {
            ("youtube",     "YouTube",      "YouTube (Website)",         "https://www.youtube.com/tv",   "webview", true ),
            ("netflix",     "Netflix",      "Netflix (Website)",         "https://www.netflix.com",      "browser", true ),
            ("twitch",      "Twitch",       "Twitch (Website)",          "https://www.twitch.tv",        "browser", false),
            ("kick",        "Kick",         "Kick (Website)",            "https://www.kick.com",         "browser", false),
            ("disneyplus",  "Disney +",      "Disney + (Website)",     "https://www.disneyplus.com",   "browser", true ),
            ("primevideo",  "Prime Vídeo",  "Prime Video (Website)",     "https://www.primevideo.com",   "browser", true ),
            ("appletv",     "Apple TV",    "Apple TV (Website)",   "https://tv.apple.com",         "browser", true ),
            ("max",         "Max",          "HBO Max (Website)",         "https://www.max.com",          "browser", true ),
            ("crunchyroll", "Crunchyroll",  "Crunchyroll (Website)",     "https://www.crunchyroll.com",  "browser", true ),
        };


        // ========================= MEDIA APPS =========================

        private async Task<(string?, string?, string?, string?)> FetchMediaAppAssetsAsync(string name, string sgdbQuery)
        {
            var queries = new[]
            {
                sgdbQuery,
                name,
                name + " streaming",
                name + " platform",
            };

            foreach (var query in queries)
            {
                var result = await TryFetchByName(query);
                if (result.Item1 != null)
                {
                    Debug.WriteLine($"[Media] Achou '{name}' com query: '{query}'");
                    return result;
                }
                await Task.Delay(150);
            }

            Debug.WriteLine($"[Media] Não encontrou assets para '{name}' em nenhuma query");
            return (null, null, null, null);
        }

        // Parâmetros foram adicionados para isolar a tarefa
        private async Task InitializeNativeAppsAsync(string targetUserId, string targetMediaFile)
        {
            var existing = LoadMediaAppsForUser(targetUserId);
            var existingById = existing.ToDictionary(a => a.Id, StringComparer.OrdinalIgnoreCase);
            var apps = new List<MediaAppModel>();

            foreach (var app in _nativeApps)
            {
                var (id, name, query, url, type, multiUser) = app;
                if (targetUserId == currentUserId) PostProgress(id, "active");

                var existingEntry = existingById.TryGetValue(id, out var prev) ? prev : new MediaAppModel();

                if (!string.IsNullOrEmpty(existingEntry.GridImage) && !string.IsNullOrEmpty(existingEntry.HeroImage))
                {
                    if (targetUserId == currentUserId) PostProgress(id, "done");
                    apps.Add(existingEntry);
                    continue;
                }

                string localGrid = Directory.GetFiles(gridFolder, id + ".*").FirstOrDefault();
                string localHorizontal = Directory.GetFiles(gridHorizontalFolder, id + "_h.*").FirstOrDefault();
                string localHero = Directory.GetFiles(heroFolder, id + ".*").FirstOrDefault();
                string localLogo = Directory.GetFiles(logoFolder, id + "_logo.*").FirstOrDefault();

                if (localGrid != null && localHero != null)
                {
                    apps.Add(new MediaAppModel
                    {
                        Id = id,
                        Name = name,
                        Url = url,
                        Type = type,
                        MultiUser = multiUser,
                        OwnerUserId = targetUserId, // 🔹 Usa targetUserId
                        ShareMode = existingEntry.ShareMode,
                        SharedWithUserId = existingEntry.SharedWithUserId,
                        SharedWithUserName = existingEntry.SharedWithUserName,
                        GridImage = $"https://data.local/images/grid/{Path.GetFileName(localGrid)}",
                        GridHorizontalImage = localHorizontal != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(localHorizontal)}" : "",
                        HeroImage = $"https://data.local/images/hero/{Path.GetFileName(localHero)}",
                        LogoImage = localLogo != null ? $"https://data.local/images/logo/{Path.GetFileName(localLogo)}" : "",
                        DateAdded = existingEntry.DateAdded == DateTime.MinValue ? DateTime.Now : existingEntry.DateAdded
                    });
                    if (targetUserId == currentUserId) PostProgress(id, "done");
                    continue;
                }

                var (gridUrl, horizontalUrl, heroUrl, logoUrl) = await FetchMediaAppAssetsAsync(name, query);

                var gridDlTask = !string.IsNullOrEmpty(gridUrl) ? DownloadImageAsync(gridUrl, gridFolder, id) : Task.FromResult<string?>(null);
                var hDlTask = !string.IsNullOrEmpty(horizontalUrl) ? DownloadImageAsync(horizontalUrl, gridHorizontalFolder, id + "_h") : Task.FromResult<string?>(null);
                var heroDlTask = !string.IsNullOrEmpty(heroUrl) ? DownloadImageAsync(heroUrl, heroFolder, id) : Task.FromResult<string?>(null);
                var logoDlTask = !string.IsNullOrEmpty(logoUrl) ? DownloadImageAsync(logoUrl, logoFolder, id + "_logo") : Task.FromResult<string?>(null);

                await Task.WhenAll(gridDlTask, hDlTask, heroDlTask, logoDlTask);

                apps.Add(new MediaAppModel
                {
                    Id = id,
                    Name = name,
                    Url = url,
                    Type = type,
                    MultiUser = multiUser,
                    OwnerUserId = targetUserId, // 🔹 Usa targetUserId
                    ShareMode = existingEntry.ShareMode,
                    SharedWithUserId = existingEntry.SharedWithUserId,
                    SharedWithUserName = existingEntry.SharedWithUserName,
                    GridImage = gridDlTask.Result != null ? $"https://data.local/images/grid/{Path.GetFileName(gridDlTask.Result)}" : existingEntry.GridImage,
                    GridHorizontalImage = hDlTask.Result != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(hDlTask.Result)}" : existingEntry.GridHorizontalImage,
                    HeroImage = heroDlTask.Result != null ? $"https://data.local/images/hero/{Path.GetFileName(heroDlTask.Result)}" : existingEntry.HeroImage,
                    LogoImage = logoDlTask.Result != null ? $"https://data.local/images/logo/{Path.GetFileName(logoDlTask.Result)}" : existingEntry.LogoImage,
                    GridStaticImage = existingEntry.GridStaticImage,
                    GridHorizontalStaticImage = existingEntry.GridHorizontalStaticImage,
                    HeroStaticImage = existingEntry.HeroStaticImage,
                    LogoStaticImage = existingEntry.LogoStaticImage,
                    LastPlayed = existingEntry.LastPlayed,
                    DateAdded = existingEntry.DateAdded == DateTime.MinValue ? DateTime.Now : existingEntry.DateAdded
                });

                if (targetUserId == currentUserId) PostProgress(id, "done");
                await Task.Delay(200);
            }

            var nativeIds = _nativeApps.Select(a => a.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
            apps.AddRange(existing.Where(a => !a.IsSharedFromOtherUser && !nativeIds.Contains(a.Id)));

            // 🔹 Salva forçando as variáveis isoladas do loop corrente
            await Task.Run(() => SaveMediaAppsForSpecificUser(apps, targetUserId, targetMediaFile));

            if (targetUserId == currentUserId) SendMediaAppsToUI(apps);
        }
        private void PostProgress(string appId, string state)
        {
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(new { type = "nativeAppProgress", appId, state })));
        }

        private List<MediaAppModel> LoadMediaApps()
        {
            var own = LoadMediaAppsForUser(currentUserId);
            var users = LoadUserProfiles();
            var current = users.FirstOrDefault(u => string.Equals(u.Id, currentUserId, StringComparison.OrdinalIgnoreCase));
            var visible = new List<MediaAppModel>();

            foreach (var app in own)
            {
                if (string.IsNullOrWhiteSpace(app.OwnerUserId)) app.OwnerUserId = currentUserId;
                if (app.ShareMode == "user")
                {
                    app.SharedWithUserName = users.FirstOrDefault(u => string.Equals(u.Id, app.SharedWithUserId, StringComparison.OrdinalIgnoreCase))?.Name ?? app.SharedWithUserName;
                }
                visible.Add(app);
            }

            foreach (var user in users.Where(u => !string.Equals(u.Id, currentUserId, StringComparison.OrdinalIgnoreCase)))
            {
                foreach (var app in LoadMediaAppsForUser(user.Id))
                {
                    bool sharedToCurrent = app.ShareMode == "all" ||
                        (app.ShareMode == "user" && string.Equals(app.SharedWithUserId, currentUserId, StringComparison.OrdinalIgnoreCase));
                    if (!sharedToCurrent) continue;

                    var clone = CloneMediaApp(app);
                    clone.IsSharedFromOtherUser = true;
                    clone.SharedFromUserName = user.Name;
                    clone.OwnerUserId = string.IsNullOrWhiteSpace(clone.OwnerUserId) ? user.Id : clone.OwnerUserId;
                    var localSame = visible.FirstOrDefault(a =>
                        string.Equals(a.Id, clone.Id, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(a.Url, clone.Url, StringComparison.OrdinalIgnoreCase));
                    if (localSame != null)
                    {
                        localSame.IsSharedFromOtherUser = true;
                        localSame.SharedFromUserName = user.Name;
                        localSame.OwnerUserId = clone.OwnerUserId;
                        localSame.ShareMode = clone.ShareMode;
                        localSame.SharedWithUserId = clone.SharedWithUserId;
                        localSame.SharedWithUserName = clone.SharedWithUserName;
                        continue;
                    }
                    visible.Add(clone);
                }
            }

            return visible;
        }

        private List<MediaAppModel> LoadMediaAppsForUser(string userId)
        {
            string file = string.Equals(userId, currentUserId, StringComparison.OrdinalIgnoreCase)
                ? mediaFile
                : Path.Combine(dataFolder, "users", userId, "media.json");
            if (!File.Exists(file)) return new List<MediaAppModel>();
            try
            {
                // USANDO O SAFE READ:
                var apps = JsonSerializer.Deserialize<List<MediaAppModel>>(SafeReadAllText(file)) ?? new List<MediaAppModel>();
                foreach (var app in apps.Where(a => string.IsNullOrWhiteSpace(a.OwnerUserId)))
                    app.OwnerUserId = userId;
                return apps;
            }
            catch { return new List<MediaAppModel>(); }
        }
        private static void SafeWriteAllText(string path, string content)
        {
            for (int i = 0; i < 5; i++)
            {
                try { File.WriteAllText(path, content); return; }
                catch (IOException) { System.Threading.Thread.Sleep(50); }
            }
            File.WriteAllText(path, content);
        }

        private static string SafeReadAllText(string path)
        {
            for (int i = 0; i < 5; i++)
            {
                try { return File.ReadAllText(path); }
                catch (IOException) { System.Threading.Thread.Sleep(50); }
            }
            return File.ReadAllText(path);
        }

        private static void SafeCopy(string source, string dest)
        {
            for (int i = 0; i < 5; i++)
            {
                try { File.Copy(source, dest, true); return; }
                catch (IOException) { System.Threading.Thread.Sleep(50); }
            }
            File.Copy(source, dest, true);
        }
        private void SaveMediaAppsForSpecificUser(List<MediaAppModel> apps, string targetUserId, string targetMediaFile)
        {
            apps = apps
                .Where(a => !a.IsSharedFromOtherUser)
                .Select(a =>
                {
                    a.OwnerUserId = string.IsNullOrWhiteSpace(a.OwnerUserId) ? targetUserId : a.OwnerUserId;
                    return a;
                })
                .ToList();

            // USANDO O SAFE WRITE:
            SafeWriteAllText(targetMediaFile,
                JsonSerializer.Serialize(apps, new JsonSerializerOptions { WriteIndented = true }));

            if (targetUserId == currentUserId)
            {
                SafeWriteAllText(Path.Combine(dataFolder, "media.json"),
                    JsonSerializer.Serialize(LoadMediaApps(), new JsonSerializerOptions { WriteIndented = true }));
            }
        }

        private void SaveMediaApps(List<MediaAppModel> apps)
        {
            SaveMediaAppsForSpecificUser(apps, currentUserId, mediaFile);
        }

        private static MediaAppModel CloneMediaApp(MediaAppModel app)
        {
            var json = JsonSerializer.Serialize(app);
            return JsonSerializer.Deserialize<MediaAppModel>(json) ?? app;
        }
        private async Task InjectInstalledExtensionsAsync(CoreWebView2 cw)
        {
            try
            {
                var installed = LoadBrowserExtensions();
                var payload = installed.Select(e => new
                {
                    id = e.Id,
                    name = e.Name,
                    version = GetExtensionVersion(e)   // para o futuro update-checker
                }).ToArray();
                string json = System.Text.Json.JsonSerializer.Serialize(payload);
                await cw.ExecuteScriptAsync($"window.__doorpiSetInstalledExtensions?.({json})");
            }
            catch (Exception ex) { Debug.WriteLine($"[Extensions] inject: {ex.Message}"); }
        }

        private string GetExtensionVersion(BrowserExtensionModel ext)
        {
            try
            {
                string manifestPath = Path.Combine(ext.InstalledPath, "manifest.json");
                if (!File.Exists(manifestPath))
                {
                    var vFolder = Directory.GetDirectories(ext.InstalledPath)
                        .FirstOrDefault(d => File.Exists(Path.Combine(d, "manifest.json")));
                    if (vFolder != null) manifestPath = Path.Combine(vFolder, "manifest.json");
                }
                if (File.Exists(manifestPath))
                {
                    var node = System.Text.Json.Nodes.JsonNode.Parse(File.ReadAllText(manifestPath));
                    return node?["version"]?.ToString() ?? "";
                }
            }
            catch { }
            return "";
        }
        private string extensionsFile => Path.Combine(dataFolder, "extensions", "extensions.json");

        private List<BrowserExtensionModel> LoadBrowserExtensions()
        {
            if (!File.Exists(extensionsFile)) return new List<BrowserExtensionModel>();
            try { return JsonSerializer.Deserialize<List<BrowserExtensionModel>>(File.ReadAllText(extensionsFile)) ?? new(); }
            catch { return new List<BrowserExtensionModel>(); }
        }

        private void SaveBrowserExtensions(List<BrowserExtensionModel> extensions)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(extensionsFile)!);
            File.WriteAllText(extensionsFile, JsonSerializer.Serialize(extensions, new JsonSerializerOptions { WriteIndented = true }));
        }

        private static string ParseChromeExtensionId(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return "";
            var match = Regex.Match(input, @"[a-p]{32}", RegexOptions.IgnoreCase);
            return match.Success ? match.Value.ToLowerInvariant() : "";
        }
        private static string GetExtensionName(string extFolder)
        {
            try
            {
                string manifestPath = Path.Combine(extFolder, "manifest.json");
                if (!File.Exists(manifestPath))
                {
                    var versionFolder = Directory.GetDirectories(extFolder).FirstOrDefault(d => File.Exists(Path.Combine(d, "manifest.json")));
                    if (versionFolder != null) manifestPath = Path.Combine(versionFolder, "manifest.json");
                }

                if (File.Exists(manifestPath))
                {
                    var manifestNode = JsonNode.Parse(File.ReadAllText(manifestPath));
                    string name = manifestNode?["name"]?.ToString() ?? "";

                    // Resolve a tag de internacionalização do Chrome (ex: __MSG_appName__)
                    if (name.StartsWith("__MSG_") && name.EndsWith("__"))
                    {
                        string msgKey = name.Substring(6, name.Length - 8);
                        string localesDir = Path.Combine(Path.GetDirectoryName(manifestPath)!, "_locales");

                        if (Directory.Exists(localesDir))
                        {
                            string[] targetLangs = { "en", "en_US", "pt_BR", "pt" };
                            string? msgFile = null;

                            foreach (var lang in targetLangs)
                            {
                                string path = Path.Combine(localesDir, lang, "messages.json");
                                if (File.Exists(path)) { msgFile = path; break; }
                            }

                            if (msgFile == null)
                            {
                                var firstDir = Directory.GetDirectories(localesDir).FirstOrDefault();
                                if (firstDir != null) msgFile = Path.Combine(firstDir, "messages.json");
                            }

                            if (msgFile != null && File.Exists(msgFile))
                            {
                                var msgNode = JsonNode.Parse(File.ReadAllText(msgFile));
                                string localizedName = msgNode?[msgKey]?["message"]?.ToString() ?? "";
                                if (!string.IsNullOrWhiteSpace(localizedName)) return localizedName;
                            }
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(name)) return name;
                }
            }
            catch { }

            // Se tudo falhar, devolve o nome da pasta em vez de quebrar
            return Path.GetFileName(extFolder);
        }
        private async Task InstallChromeExtensionAsync(string sourceUrl)
        {
            string id = ParseChromeExtensionId(sourceUrl);
            if (string.IsNullOrWhiteSpace(id)) throw new InvalidOperationException("Link da Chrome Web Store inválido.");

            string extRoot = Path.Combine(dataFolder, "extensions", id);
            string tempRoot = Path.Combine(Path.GetTempPath(), "doorpi-ext-" + id + "-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempRoot);

            try
            {
                // Força a versão 999 para garantir compatibilidade futura e força download do CRX
                string crxUrl = $"https://clients2.google.com/service/update2/crx?response=redirect&os=win&arch=x64&os_arch=x86_64&nacl_arch=x86-64&prod=chromecrx&prodchannel=&prodversion=999.0.0.0&acceptformat=crx2,crx3&x=id%3D{id}%26installsource%3Dondemand%26uc";

                using var req = new HttpRequestMessage(HttpMethod.Get, crxUrl);
                req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");

                var response = await downloadClient.SendAsync(req);
                response.EnsureSuccessStatusCode();
                byte[] crxBytes = await response.Content.ReadAsByteArrayAsync();

                if (crxBytes.Length < 1024)
                    throw new InvalidOperationException("Arquivo baixado muito pequeno, verifique a URL da extensão.");

                // Busca o cabeçalho do ZIP (PK\x03\x04)
                int zipOffset = FindZipOffset(crxBytes);
                if (zipOffset < 0)
                    throw new InvalidOperationException("Não foi possível encontrar a estrutura ZIP dentro do arquivo CRX.");

                string zipPath = Path.Combine(tempRoot, id + ".zip");
                byte[] zipData = new byte[crxBytes.Length - zipOffset];
                Buffer.BlockCopy(crxBytes, zipOffset, zipData, 0, zipData.Length);
                await File.WriteAllBytesAsync(zipPath, zipData);

                // Extração
                ZipFile.ExtractToDirectory(zipPath, tempRoot, overwriteFiles: true);

                // Busca profunda pelo manifest.json (às vezes fica em subpastas dependendo da extensão)
                var manifestFiles = Directory.EnumerateFiles(tempRoot, "manifest.json", SearchOption.AllDirectories).ToList();

                if (manifestFiles.Count == 0)
                {
                    string filesFound = string.Join(", ", Directory.GetFiles(tempRoot, "*", SearchOption.AllDirectories).Select(Path.GetFileName));
                    throw new InvalidOperationException($"Extensão extraída, mas nenhum 'manifest.json' foi encontrado. Arquivos na pasta: {filesFound}");
                }

                string manifest = manifestFiles[0];
                string extensionFolder = Path.GetDirectoryName(manifest)!;

                // Instala
                if (Directory.Exists(extRoot)) Directory.Delete(extRoot, true);
                Directory.CreateDirectory(Path.GetDirectoryName(extRoot)!);
                Directory.Move(extensionFolder, extRoot);

                // Registrar
                string name = GetExtensionName(extRoot);
                if (string.IsNullOrWhiteSpace(name)) name = id;

                var extensions = LoadBrowserExtensions();
                extensions.RemoveAll(e => string.Equals(e.Id, id, StringComparison.OrdinalIgnoreCase));
                extensions.Add(new BrowserExtensionModel { Id = id, Name = name, SourceUrl = sourceUrl, InstalledPath = extRoot, DateInstalled = DateTime.Now });
                SaveBrowserExtensions(extensions);
            }
            finally
            {
                try { if (Directory.Exists(tempRoot)) Directory.Delete(tempRoot, true); } catch { }
            }
        }

        private static int FindZipOffset(byte[] bytes)
        {
            for (int i = 0; i < bytes.Length - 3; i++)
            {
                if (bytes[i] == 0x50 && bytes[i + 1] == 0x4B && bytes[i + 2] == 0x03 && bytes[i + 3] == 0x04)
                    return i;
            }
            return -1;
        }

        private void SendExtensionsToUI(string status = "", string message = "")
        {
            var extensions = LoadBrowserExtensions();
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "extensionsList",
                    extensions,
                    status,
                    message
                })));
        }

        private void SendMediaAppsToUI(List<MediaAppModel> apps)
        {
            var sortedApps = apps
                .OrderByDescending(a => a.LastPlayed > a.DateAdded ? a.LastPlayed : a.DateAdded)
                .ToList();

            var payload = new { type = "nativeAppsLoaded", apps = sortedApps };
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(payload)));
        }
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd); [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        public void ForceFocus()
        {
            Dispatcher.BeginInvoke(() =>
            {
                var hwnd = new System.Windows.Interop.WindowInteropHelper(this).Handle;
                ShowWindow(hwnd, 3);
                SetForegroundWindow(hwnd);
                Activate();
                webView?.Focus();

                webView?.CoreWebView2.ExecuteScriptAsync("window.focusFeaturedCard();");
            });
        }

        private void WatchAndRefocus(Process process)
        {
            if (process == null) return;
            Task.Run(() =>
            {
                try { process.WaitForExit(); } catch { }
                ForceFocus();
            });
        }

        private void OpenInBrowser(string url)
        {
            Process? proc = null;
            try
            {
                proc = Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch (Exception ex) { Debug.WriteLine($"[OpenInBrowser] Erro: {ex.Message}"); }

            if (proc != null) WatchAndRefocus(proc);
        }

        // ========================= STEAM =========================

        private List<InstalledApp> GetSteamGames()
        {
            var list = new List<InstalledApp>();
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Valve\Steam")
                             ?? Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Valve\Steam");

                if (key?.GetValue("InstallPath") is string steamPath)
                {
                    string configPath = Path.Combine(steamPath, "steamapps", "libraryfolders.vdf");
                    if (!File.Exists(configPath)) return list;

                    var content = File.ReadAllText(configPath);
                    var matches = Regex.Matches(content, @"""path""\s+""([^""]+)""");

                    foreach (Match match in matches)
                    {
                        string libraryPath = match.Groups[1].Value.Replace(@"\\", @"\");
                        string appsPath = Path.Combine(libraryPath, "steamapps");
                        if (!Directory.Exists(appsPath)) continue;

                        foreach (var acfFile in Directory.GetFiles(appsPath, "appmanifest_*.acf"))
                        {
                            var acfContent = File.ReadAllText(acfFile);
                            string name = Regex.Match(acfContent, @"""name""\s+""([^""]+)""").Groups[1].Value;
                            string appId = Regex.Match(acfContent, @"""appid""\s+""([^""]+)""").Groups[1].Value;
                            string installDir = Regex.Match(acfContent, @"""installdir""\s+""([^""]+)""").Groups[1].Value;

                            if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(appId)) continue;

                            string iconBase64 = "";

                            string iconHash = Regex.Match(acfContent, @"""(?:clienticon|icon)""\s+""([a-fA-F0-9]+)""").Groups[1].Value;
                            if (!string.IsNullOrEmpty(iconHash))
                            {
                                string icoPath = Path.Combine(steamPath, "steam", "games", $"{iconHash}.ico");
                                if (File.Exists(icoPath)) iconBase64 = GetCachedIcon(icoPath);
                            }

                            if (string.IsNullOrEmpty(iconBase64) && !string.IsNullOrEmpty(installDir))
                            {
                                string gameFolder = Path.Combine(libraryPath, "steamapps", "common", installDir);
                                if (Directory.Exists(gameFolder))
                                {
                                    try
                                    {
                                        var exeFiles = new DirectoryInfo(gameFolder)
                                            .GetFiles("*.exe", SearchOption.AllDirectories)
                                            .Where(f => !f.Name.Contains("crash", StringComparison.OrdinalIgnoreCase) &&
                                                        !f.Name.Contains("unins", StringComparison.OrdinalIgnoreCase) &&
                                                        !f.Name.Contains("setup", StringComparison.OrdinalIgnoreCase) &&
                                                        !f.Name.Contains("redist", StringComparison.OrdinalIgnoreCase))
                                            .ToList();

                                        if (exeFiles.Any())
                                        {
                                            string cleanGameName = NormalizeGameName(name);
                                            string cleanFolderName = NormalizeGameName(installDir);

                                            var bestExe =
                                                exeFiles.FirstOrDefault(f => {
                                                    string c = NormalizeGameName(Path.GetFileNameWithoutExtension(f.Name));
                                                    return c == cleanGameName || c == cleanFolderName;
                                                })
                                                ?? exeFiles.FirstOrDefault(f => IsNameSimilar(Path.GetFileNameWithoutExtension(f.Name), name))
                                                ?? exeFiles.OrderByDescending(f => f.Length).FirstOrDefault();

                                            if (bestExe != null) iconBase64 = GetCachedIcon(bestExe.FullName);
                                        }
                                    }
                                    catch { }
                                }
                            }

                            if (string.IsNullOrEmpty(iconBase64))
                            {
                                string libraryCachePath = Path.Combine(steamPath, "appcache", "librarycache", $"{appId}_icon.jpg");
                                if (File.Exists(libraryCachePath))
                                    iconBase64 = Convert.ToBase64String(File.ReadAllBytes(libraryCachePath));
                            }

                            list.Add(new InstalledApp
                            {
                                Name = name,
                                LaunchUrl = $"steam://run/{appId}",
                                Path = appId,
                                IconBase64 = iconBase64,
                                Source = "Steam"
                            });
                        }
                    }
                }
            }
            catch (Exception ex) { Debug.WriteLine("Erro Steam: " + ex.Message); }
            return list;
        }
        // ========================= RIOT GAMES =========================

        private HashSet<string> GetRiotFingerprint()
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                var paths = new[] { @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" };
                foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
                    foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                    {
                        using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                        foreach (var rel in paths)
                        {
                            using var key = baseKey.OpenSubKey(rel);
                            if (key == null) continue;
                            foreach (var name in key.GetSubKeyNames())
                            {
                                using var sub = key.OpenSubKey(name);
                                if (sub == null) continue;

                                string uninstallString = sub.GetValue("UninstallString") as string ?? "";

                                // É da Riot se tiver o executável e o parâmetro de produto
                                if (uninstallString.Contains("RiotClientServices.exe", StringComparison.OrdinalIgnoreCase) &&
                                    uninstallString.Contains("-product=", StringComparison.OrdinalIgnoreCase))
                                {
                                    keys.Add(name);
                                }
                            }
                        }
                    }
            }
            catch (Exception ex) { Debug.WriteLine("RiotFingerprint: " + ex.Message); }
            return keys;
        }

        private List<InstalledApp> GetRiotGames()
        {
            var list = new List<InstalledApp>();
            try
            {
                var paths = new[] { @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" };
                foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
                    foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                    {
                        using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                        foreach (var rel in paths)
                        {
                            using var key = baseKey.OpenSubKey(rel);
                            if (key == null) continue;
                            foreach (var name in key.GetSubKeyNames())
                            {
                                using var sub = key.OpenSubKey(name);
                                if (sub == null) continue;

                                string publisher = sub.GetValue("Publisher") as string ?? "";
                                bool isRiot = publisher.Contains("Riot Games", StringComparison.OrdinalIgnoreCase) ||
                                              name.StartsWith("Riot Game ", StringComparison.OrdinalIgnoreCase);

                                if (!isRiot) continue;

                                string displayName = sub.GetValue("DisplayName") as string ?? "";
                                string uninstallString = sub.GetValue("UninstallString") as string ?? "";
                                string displayIcon = sub.GetValue("DisplayIcon") as string ?? "";

                                // Ignora o próprio Riot Client (é só um launcher)
                                if (displayName.Equals("Riot Client", StringComparison.OrdinalIgnoreCase)) continue;
                                if (string.IsNullOrWhiteSpace(uninstallString)) continue;

                                // Verifica se é um jogo suportado pelo Riot Client
                                if (!uninstallString.Contains("RiotClientServices.exe", StringComparison.OrdinalIgnoreCase) ||
                                    !uninstallString.Contains("-product=", StringComparison.OrdinalIgnoreCase))
                                    continue;

                                // ==========================================================
                                string launchCmd = uninstallString.Replace("--uninstall-", "--launch-").Replace("\"", "").Trim();
                                string launchUrl = $"riot:{launchCmd}";
                                // ==========================================================

                                // Extrai o nome do produto para manter compatibilidade no path
                                string product = name;
                                var match = Regex.Match(launchCmd, @"--launch-product=([^\s]+)");
                                if (match.Success) product = match.Groups[1].Value;

                                string iconBase64 = "";
                                string cleanIconPath = displayIcon.Split(',')[0].Replace("\"", "").Trim();
                                if (File.Exists(cleanIconPath))
                                    iconBase64 = GetCachedIcon(cleanIconPath);

                                list.Add(new InstalledApp
                                {
                                    Name = displayName,
                                    LaunchUrl = launchUrl,
                                    Path = product,
                                    Source = "Riot",
                                    IconBase64 = iconBase64
                                });
                            }
                        }
                    }
            }
            catch (Exception ex) { Debug.WriteLine("Erro Riot: " + ex.Message); }

            // Garante que não duplique (caso exista no LocalMachine e no CurrentUser simultaneamente)
            return list.GroupBy(a => a.LaunchUrl).Select(g => g.First()).ToList();
        }
        // ========================= EPIC =========================

        private List<InstalledApp> GetEpicGames()
        {
            var list = new List<InstalledApp>();
            try
            {
                string manifestPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                    "Epic", "EpicGamesLauncher", "Data", "Manifests");

                if (!Directory.Exists(manifestPath)) return list;

                foreach (var file in Directory.GetFiles(manifestPath, "*.item"))
                {
                    var json = File.ReadAllText(file);
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    string name = root.GetProperty("DisplayName").GetString() ?? "";
                    string appName = root.GetProperty("AppName").GetString() ?? "";
                    string namespaceStr = root.GetProperty("CatalogNamespace").GetString() ?? "";
                    string catalogItemId = root.GetProperty("CatalogItemId").GetString() ?? "";
                    string installLocation = root.GetProperty("InstallLocation").GetString() ?? "";
                    string launchExe = root.TryGetProperty("LaunchExecutable", out var exeProp)
                                                ? exeProp.GetString() ?? "" : "";

                    string iconBase64 = "";
                    if (!string.IsNullOrEmpty(installLocation) && !string.IsNullOrEmpty(launchExe))
                    {
                        string exePath = Path.Combine(installLocation, launchExe);
                        if (File.Exists(exePath)) iconBase64 = GetCachedIcon(exePath);
                    }

                    list.Add(new InstalledApp
                    {
                        Name = name,
                        LaunchUrl = $"com.epicgames.launcher://apps/{namespaceStr}%3A{catalogItemId}%3A{appName}?action=launch&silent=true",
                        Path = appName,
                        IconBase64 = iconBase64,
                        Source = "Epic"
                    });
                }
            }
            catch { }
            return list;
        }

        // ========================= GOG =========================

        private List<InstalledApp> GetGOGGames()
        {
            var list = new List<InstalledApp>();
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\GOG.com\Games");
                if (key == null) return list;

                foreach (var subKeyName in key.GetSubKeyNames())
                {
                    using var gameKey = key.OpenSubKey(subKeyName);
                    if (gameKey == null) continue;

                    string name = gameKey.GetValue("gameName") as string ?? "";
                    string folderPath = (gameKey.GetValue("path") as string ?? "").Replace("\"", "").Trim();
                    string finalPath = "";

                    if (!string.IsNullOrEmpty(folderPath) && Directory.Exists(folderPath))
                    {
                        var shortcuts = Directory.GetFiles(folderPath, "*.lnk", SearchOption.TopDirectoryOnly)
                            .Where(f => {
                                string fn = Path.GetFileName(f).ToLower();
                                return !fn.Contains("galaxy") && !fn.Contains("uninstall") &&
                                       !fn.Contains("manual") && !fn.Contains("support");
                            }).ToList();

                        if (shortcuts.Any())
                        {
                            finalPath = shortcuts.FirstOrDefault(s =>
                                Path.GetFileName(s).StartsWith("Launch", StringComparison.OrdinalIgnoreCase))
                                ?? shortcuts.First();
                        }
                    }

                    if (string.IsNullOrEmpty(finalPath))
                    {
                        string exePath = (gameKey.GetValue("launchCommand") as string ??
                                          gameKey.GetValue("exe") as string ??
                                          gameKey.GetValue("EXE") as string ?? "")
                                          .Replace("\"", "").Trim();

                        if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath) &&
                            !exePath.ToLower().Contains("unins"))
                            finalPath = exePath;
                    }

                    if (string.IsNullOrEmpty(finalPath) && !string.IsNullOrEmpty(folderPath) && Directory.Exists(folderPath))
                    {
                        var bestExe = new DirectoryInfo(folderPath)
                            .GetFiles("*.exe", SearchOption.AllDirectories)
                            .Where(f => {
                                string fn = f.Name.ToLower();
                                return !fn.Contains("unins") && !fn.Contains("setup") &&
                                       !fn.Contains("config") && f.Length > 1024 * 1024 * 2;
                            })
                            .OrderByDescending(f => f.Length)
                            .FirstOrDefault();

                        if (bestExe != null) finalPath = bestExe.FullName;
                    }

                    if (!string.IsNullOrEmpty(finalPath))
                    {
                        list.Add(new InstalledApp
                        {
                            Name = name,
                            Path = finalPath,
                            Source = "GOG",
                            IconBase64 = GetCachedIcon(finalPath)
                        });
                    }
                }
            }
            catch (Exception ex) { Debug.WriteLine("Erro GOG: " + ex.Message); }
            return list;
        }

        // ========================= PASTAS VIGIADAS =========================

        private List<FolderStats> LoadFoldersData()
        {
            if (!File.Exists(foldersFile)) return new List<FolderStats>();
            try
            {
                string json = File.ReadAllText(foldersFile);
                try
                {
                    var data = JsonSerializer.Deserialize<List<FolderStats>>(json);
                    if (data != null && data.Count > 0 && !string.IsNullOrEmpty(data[0].Path))
                        return data;
                }
                catch { }

                var oldPaths = JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
                var migratedData = oldPaths.Select(path => GetFolderStats(path)).ToList();

                SaveFoldersData(migratedData);
                return migratedData;
            }
            catch { return new List<FolderStats>(); }
        }

        private void SaveFoldersData(List<FolderStats> folders)
        {
            File.WriteAllText(foldersFile, JsonSerializer.Serialize(folders, new JsonSerializerOptions { WriteIndented = true }));
            File.WriteAllText(Path.Combine(dataFolder, "folders.json"), JsonSerializer.Serialize(folders, new JsonSerializerOptions { WriteIndented = true }));
        }

        private List<string> GetWatchedFolderPaths()
        {
            return LoadFoldersData().Select(f => f.Path).ToList();
        }

        private bool IsFolderForbidden(string path)
        {
            return false;
        }

        private FolderStats GetFolderStats(string path)
        {
            var stats = new FolderStats { Path = path };
            if (!Directory.Exists(path)) return stats;

            try
            {
                var options = new EnumerationOptions { IgnoreInaccessible = true, RecurseSubdirectories = true };
                stats.SubfolderCount = Directory.EnumerateDirectories(path, "*", options).Count();
                stats.ExeCount = Directory.EnumerateFiles(path, "*.exe", options).Count();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[FolderStats] Erro ao varrer {path}: {ex.Message}");
            }
            return stats;
        }

        private void SendFoldersToUI()
        {
            var stats = LoadFoldersData();
            var payload = new { type = "foldersList", folders = stats };
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(payload)));
        }

        private void DeleteWatchedFolder(string path)
        {
            var folders = LoadFoldersData();
            folders.RemoveAll(f => string.Equals(f.Path, path, StringComparison.OrdinalIgnoreCase));
            SaveFoldersData(folders);

            var dead = _folderWatchers
                .Where(w => string.Equals(w.Path, path, StringComparison.OrdinalIgnoreCase))
                .ToList();
            foreach (var w in dead) { w.EnableRaisingEvents = false; w.Dispose(); }
            foreach (var w in dead) _folderWatchers.Remove(w);
        }

        // ========================= LÓGICA OTIMIZADA DE DIFF DE PASTAS =========================

        private (List<InstalledApp> Apps, Dictionary<string, long> Timestamps, bool Changed) ScanWatchedFoldersOptimized(AppCacheModel cache, Action<string, int>? onProgress = null)
        {
            bool changed = false;
            var currentApps = cache.FolderApps ?? new List<InstalledApp>();
            var currentTimestamps = cache.FolderTimestamps ?? new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);

            var newTimestamps = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
            var newFolderApps = new List<InstalledApp>();

            var options = new EnumerationOptions { IgnoreInaccessible = true, RecurseSubdirectories = true };
            string[] junkTerms = { "unins", "crash", "setup", "redist", "update", "cefsubproc", "prereq", "vc_redist", "dxwebsetup", "support" };

            foreach (var rootFolder in GetWatchedFolderPaths())
            {
                if (!Directory.Exists(rootFolder)) continue;
                onProgress?.Invoke(rootFolder, -1);
                int foundInRoot = 0;

                try
                {
                    // Pega apenas as pastas da "Raiz" (Ex: D:\Games\Stellar Blade). Elas representam 1 jogo cada.
                    var gameDirs = Directory.GetDirectories(rootFolder, "*", SearchOption.TopDirectoryOnly).ToList();

                    foreach (var gameDir in gameDirs)
                    {
                        var dirInfo = new DirectoryInfo(gameDir);
                        long lastWrite = dirInfo.LastWriteTimeUtc.Ticks;
                        newTimestamps[gameDir] = lastWrite;

                        if (currentTimestamps.TryGetValue(gameDir, out long oldWrite) && oldWrite == lastWrite)
                        {
                            var appsInDir = currentApps.Where(a => a.Path.StartsWith(gameDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)).ToList();
                            newFolderApps.AddRange(appsInDir);
                            foundInRoot += appsInDir.Count;
                        }
                        else
                        {
                            changed = true;
                            string expectedName = dirInfo.Name;

                            // Pega TODOS os executáveis dentro da pasta e de todas as subpastas dela de uma vez
                            var exes = new DirectoryInfo(gameDir).GetFiles("*.exe", options)
                                .Where(f => !junkTerms.Any(j => f.Name.Contains(j, StringComparison.OrdinalIgnoreCase)))
                                .ToList();

                            if (exes.Count > 0)
                            {
                                FileInfo? bestExe = null;
                                string cleanExpected = NormalizeGameName(expectedName);

                                // 1. Prioridade MAX: O Nome do Arquivo bate com a pasta?
                                bestExe = exes.FirstOrDefault(f =>
                                    NormalizeGameName(Path.GetFileNameWithoutExtension(f.Name)) == cleanExpected ||
                                    IsNameSimilar(Path.GetFileNameWithoutExtension(f.Name), expectedName));

                                // 2. Prioridade ALTA: Os Metadados batem com a pasta?
                                if (bestExe == null)
                                {
                                    foreach (var exe in exes)
                                    {
                                        try
                                        {
                                            var fi = FileVersionInfo.GetVersionInfo(exe.FullName);
                                            if (NormalizeGameName(fi.ProductName ?? "") == cleanExpected ||
                                                NormalizeGameName(fi.FileDescription ?? "") == cleanExpected ||
                                                IsNameSimilar(fi.ProductName ?? "", expectedName) ||
                                                IsNameSimilar(fi.FileDescription ?? "", expectedName))
                                            {
                                                bestExe = exe;
                                                break;
                                            }
                                        }
                                        catch { }
                                    }
                                }

                                // 3. Fallback: Pega o maior executável (Sempre será o jogo verdadeiro e nunca o CEF)
                                if (bestExe == null)
                                {
                                    bestExe = exes.OrderByDescending(f => f.Length).First();
                                }

                                // Define o nome bonitinho a partir dos metadados (se tiver)
                                string finalName = expectedName;
                                try
                                {
                                    var fi = FileVersionInfo.GetVersionInfo(bestExe.FullName);
                                    if (!string.IsNullOrWhiteSpace(fi.ProductName)) finalName = fi.ProductName;
                                    else if (!string.IsNullOrWhiteSpace(fi.FileDescription)) finalName = fi.FileDescription;
                                }
                                catch { }

                                newFolderApps.Add(new InstalledApp
                                {
                                    Name = finalName,
                                    Path = bestExe.FullName,
                                    Source = "Folder",
                                    IconBase64 = GetCachedIcon(bestExe.FullName)
                                });
                                foundInRoot++;
                            }
                        }
                    }

                    // Arquivos soltos diretamente na raiz da pasta vigiada (Jogos que não estão dentro de subpastas)
                    var rootExes = new DirectoryInfo(rootFolder).GetFiles("*.exe", SearchOption.TopDirectoryOnly)
                        .Where(f => !junkTerms.Any(j => f.Name.Contains(j, StringComparison.OrdinalIgnoreCase)))
                        .ToList();

                    foreach (var rootExe in rootExes)
                    {
                        long lastWrite = rootExe.LastWriteTimeUtc.Ticks;
                        string key = rootExe.FullName;
                        newTimestamps[key] = lastWrite;

                        if (currentTimestamps.TryGetValue(key, out long oldWrite) && oldWrite == lastWrite)
                        {
                            var app = currentApps.FirstOrDefault(a => string.Equals(a.Path, key, StringComparison.OrdinalIgnoreCase));
                            if (app != null) { newFolderApps.Add(app); foundInRoot++; }
                        }
                        else
                        {
                            changed = true;
                            string finalName = Path.GetFileNameWithoutExtension(rootExe.Name);
                            try
                            {
                                var fi = FileVersionInfo.GetVersionInfo(rootExe.FullName);
                                if (!string.IsNullOrWhiteSpace(fi.ProductName)) finalName = fi.ProductName;
                                else if (!string.IsNullOrWhiteSpace(fi.FileDescription)) finalName = fi.FileDescription;
                            }
                            catch { }

                            newFolderApps.Add(new InstalledApp { Name = finalName, Path = rootExe.FullName, Source = "Folder", IconBase64 = GetCachedIcon(rootExe.FullName) });
                            foundInRoot++;
                        }
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[ScanOptimized] Erro: {ex.Message}"); }
                onProgress?.Invoke(rootFolder, foundInRoot);
            }

            if (!changed && (currentTimestamps.Count != newTimestamps.Count || !currentTimestamps.Keys.All(k => newTimestamps.ContainsKey(k)))) changed = true;
            return (newFolderApps, newTimestamps, changed);
        }

        // ========================= WINDOWS APPS (scan) =========================
        private string? FindMainExecutable(string folderPath, string expectedName, EnumerationOptions options)
        {
            if (string.IsNullOrEmpty(folderPath) || !Directory.Exists(folderPath)) return null;

            // Filtro turbinado contra lixos de engines
            string[] junkTerms = { "unins", "crash", "setup", "redist", "update", "cefsubproc", "prereq", "vc_redist", "dxwebsetup", "support" };

            var exes = new DirectoryInfo(folderPath)
                .GetFiles("*.exe", options)
                .Where(f => !junkTerms.Any(j => f.Name.Contains(j, StringComparison.OrdinalIgnoreCase)))
                .ToList();

            if (exes.Count == 0) return null;

            string cleanExpected = NormalizeGameName(expectedName);

            // 1. Prioridade MAX: O Nome do Arquivo bate?
            var byName = exes.FirstOrDefault(f =>
                NormalizeGameName(Path.GetFileNameWithoutExtension(f.Name)) == cleanExpected ||
                IsNameSimilar(Path.GetFileNameWithoutExtension(f.Name), expectedName));
            if (byName != null) return byName.FullName;

            // 2. Prioridade ALTA: Os Metadados batem? (Independente do tamanho!)
            foreach (var exe in exes)
            {
                try
                {
                    var fi = FileVersionInfo.GetVersionInfo(exe.FullName);
                    if (NormalizeGameName(fi.ProductName ?? "") == cleanExpected ||
                        NormalizeGameName(fi.FileDescription ?? "") == cleanExpected ||
                        IsNameSimilar(fi.ProductName ?? "", expectedName) ||
                        IsNameSimilar(fi.FileDescription ?? "", expectedName))
                    {
                        return exe.FullName;
                    }
                }
                catch { }
            }

            // 3. Fallback: Retorna o MAIOR executável da pasta (seu sistema de antes)
            return exes.OrderByDescending(f => f.Length).First().FullName;
        }

        private List<InstalledApp> ScanWindowsApps()
        {
            var list = new List<InstalledApp>();
            var paths = new[]
            {
        @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
    };

            var options = new EnumerationOptions { IgnoreInaccessible = true, RecurseSubdirectories = true, MaxRecursionDepth = 3 };

            var ignoredLaunchers = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    { "Steam", "Epic Games Launcher", "GOG Galaxy", "Battle.net", "Origin", "EA app", "Ubisoft Connect", "Rockstar Games Launcher", "Riot Client" };

            foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
            {
                foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                {
                    using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                    foreach (var rel in paths)
                    {
                        using var key = baseKey.OpenSubKey(rel);
                        if (key == null) continue;

                        foreach (var name in key.GetSubKeyNames())
                        {
                            try
                            {
                                using var sub = key.OpenSubKey(name);
                                if (sub == null) continue;

                                var displayName = sub.GetValue("DisplayName") as string;
                                if (string.IsNullOrWhiteSpace(displayName) || IsSystemComponent(displayName, sub)) continue;
                                if (ignoredLaunchers.Contains(displayName.Trim())) continue;

                                var publisher = sub.GetValue("Publisher") as string;
                                if (publisher != null && publisher.Contains("Riot Games", StringComparison.OrdinalIgnoreCase)) continue;
                                if (name.StartsWith("Riot Game ", StringComparison.OrdinalIgnoreCase)) continue;

                                string folder = GetAppFolder(sub);
                                if (string.IsNullOrEmpty(folder) || !Directory.Exists(folder)) continue;
                                if (folder.Contains(@"\steamapps\", StringComparison.OrdinalIgnoreCase)) continue;

                                // CHAMA A FUNÇÃO INTELIGENTE
                                string exePath = FindMainExecutable(folder, displayName, options);
                                if (exePath == null) continue;

                                list.Add(new InstalledApp
                                {
                                    Name = displayName,
                                    Path = exePath,
                                    Source = "Windows",
                                    IconBase64 = GetCachedIcon(exePath)
                                });
                            }
                            catch { }
                        }
                    }
                }
            }
            return list;
        }

        // ========================= CACHE DE APPS =========================

        private void SaveAppCache(AppCacheModel cache)
        {
            File.WriteAllText(appCacheFile, JsonSerializer.Serialize(cache,
                new JsonSerializerOptions { WriteIndented = true }));
        }

        private AppCacheModel? LoadAppCache()
        {
            if (!File.Exists(appCacheFile)) return null;
            try { return JsonSerializer.Deserialize<AppCacheModel>(File.ReadAllText(appCacheFile)); }
            catch { return null; }
        }

        private HashSet<string> GetWindowsRegistryFingerprint()
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var paths = new[]
            {
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
            };
            foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
                foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                {
                    using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                    foreach (var rel in paths)
                    {
                        using var key = baseKey.OpenSubKey(rel);
                        if (key == null) continue;
                        foreach (var n in key.GetSubKeyNames()) keys.Add(n);
                    }
                }
            return keys;
        }

        // ========================= ENVIO DE APPS PRO UI =========================
        private void PostScanProgress(string folderPath, int foundCount)
        {
            string folderName = Path.GetFileName(folderPath.TrimEnd(Path.DirectorySeparatorChar, '/'));
            if (string.IsNullOrEmpty(folderName)) folderName = folderPath;

            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(new
                    {
                        type = "scanProgress",
                        folder = folderPath,
                        folderName,
                        foundCount
                    })));
        }
        private async Task UpdateAppCacheAsync()
        {
            await _cacheLock.WaitAsync();
            try
            {


                var cache = LoadAppCache() ?? new AppCacheModel();

                var steamPrint = GetSteamFingerprint();
                var epicPrint = GetEpicFingerprint();
                var gogPrint = GetGogFingerprint();
                var riotPrint = GetRiotFingerprint();
                var winPrint = GetWindowsRegistryFingerprint();

                bool steamStale = !steamPrint.SetEquals(cache.SteamFingerprint) || !cache.SteamApps.Any();
                bool epicStale = !epicPrint.SetEquals(cache.EpicFingerprint) || !cache.EpicApps.Any();
                bool gogStale = !gogPrint.SetEquals(cache.GogFingerprint) || !cache.GogApps.Any();
                bool riotStale = !riotPrint.SetEquals(cache.RiotFingerprint) || !cache.RiotApps.Any();
                bool windowsStale = _windowsCacheInvalid
                                 || !winPrint.SetEquals(cache.WindowsFingerprint)
                                 || !cache.WindowsApps.Any();
                var riotTask = Task.Run(() =>
    riotStale
        ? (GetRiotGames(), true)
        : (cache.RiotApps, false));

                var steamTask = Task.Run(() =>
                    steamStale
                        ? (GetSteamGames().Select(a => { a.Source = "Steam"; return a; }).ToList(), true)
                        : (cache.SteamApps, false));

                var epicTask = Task.Run(() =>
                    epicStale
                        ? (GetEpicGames().Select(a => { a.Source = "Epic"; return a; }).ToList(), true)
                        : (cache.EpicApps, false));

                var gogTask = Task.Run(() =>
                    gogStale
                        ? (GetGOGGames().Select(a => { a.Source = "GOG"; return a; }).ToList(), true)
                        : (cache.GogApps, false));

                var winTask = Task.Run(() =>
                    windowsStale
                        ? (ScanWindowsApps(), true)
                        : (cache.WindowsApps, false));

                var folderTask = Task.Run(() =>
                {
                    var result = ScanWatchedFoldersOptimized(cache, PostScanProgress);
                    result.Apps.ForEach(a => a.Source = "Folder");
                    return result;
                });

                await Task.WhenAll(steamTask, epicTask, gogTask, riotTask, winTask, folderTask);

                var (steamApps, steamChanged) = steamTask.Result;
                var (epicApps, epicChanged) = epicTask.Result;
                var (gogApps, gogChanged) = gogTask.Result;
                var (riotApps, riotChanged) = riotTask.Result;
                var (windowsApps, windowsChanged) = winTask.Result;
                (List<InstalledApp> folderApps, Dictionary<string, long> folderTimestamps, bool folderChanged) = folderTask.Result;

                bool anythingChanged = steamChanged || epicChanged || gogChanged || riotChanged || windowsChanged || folderChanged;


                if (anythingChanged)
                {
                    if (steamChanged) { cache.SteamApps = steamApps; cache.SteamFingerprint = steamPrint; }
                    if (epicChanged) { cache.EpicApps = epicApps; cache.EpicFingerprint = epicPrint; }
                    if (gogChanged) { cache.GogApps = gogApps; cache.GogFingerprint = gogPrint; }
                    if (riotChanged) { cache.RiotApps = riotApps; cache.RiotFingerprint = riotPrint; }
                    if (windowsChanged)
                    {
                        cache.WindowsApps = windowsApps; cache.WindowsFingerprint = winPrint;
                        _windowsCacheInvalid = false;
                    }
                    if (folderChanged) { cache.FolderApps = folderApps; cache.FolderTimestamps = folderTimestamps; }

                    SaveAppCache(cache);
                }

                _lastCacheBuilt = DateTime.Now;
            }
            finally
            {
                _cacheLock.Release();
            }
        }

        private void SendInstalledAppsToUI()
        {
            var cache = LoadAppCache() ?? new AppCacheModel();
            var existingMap = BuildExistingAppsMap(); // Agora é um Map
            var finalList = BuildFinalList(cache.SteamApps, cache.EpicApps, cache.GogApps, cache.RiotApps, cache.WindowsApps, cache.FolderApps, existingMap);

            var payload = new { type = "installedAppsList", apps = finalList };
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(payload)));
        }

        private Dictionary<string, string> BuildExistingAppsMap()
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            // Lê os Jogos
            foreach (var g in LoadGames())
            {
                if (!string.IsNullOrEmpty(g.LaunchUrl)) map[g.LaunchUrl] = "game";
                else if (!string.IsNullOrEmpty(g.Path)) map[Path.GetFullPath(g.Path)] = "game";
            }

            // Lê as Mídias
            foreach (var m in LoadMediaApps())
            {
                if (m.Type == "exe" && !string.IsNullOrEmpty(m.Url))
                {
                    map[m.Url] = "media";
                    try { if (Path.IsPathRooted(m.Url)) map[Path.GetFullPath(m.Url)] = "media"; } catch { }
                }
            }
            return map;
        }

        private List<InstalledApp> BuildFinalList(
            List<InstalledApp> steam,
            List<InstalledApp> epic,
            List<InstalledApp> gog,
            List<InstalledApp> riot,
            List<InstalledApp> windows,
            List<InstalledApp> folders,
            Dictionary<string, string> existingMap)
        {
            var all = new List<InstalledApp>();
            all.AddRange(steam);
            all.AddRange(epic);
            all.AddRange(gog);
            all.AddRange(riot);
            all.AddRange(windows);
            all.AddRange(folders);

            foreach (var app in all)
            {
                string key = !string.IsNullOrEmpty(app.LaunchUrl) ? app.LaunchUrl : Path.GetFullPath(app.Path);

                // Reutiliza sua chave original IsAdded e alimenta o AddedTo
                if (existingMap.TryGetValue(key, out string addedToType))
                {
                    app.IsAdded = true;
                    app.AddedTo = addedToType;
                }
                else
                {
                    app.IsAdded = false;
                    app.AddedTo = "";
                }
            }

            return all
                .OrderBy(a => GetSourcePriority(a.Source))
                .GroupBy(a => NormalizeGameName(a.Name))
                .Select(g => g.First())
                .OrderBy(a => a.Name)
                .ToList();
        }

        private HashSet<string> BuildExistingGamesSet()
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var g in LoadGames())
            {
                if (!string.IsNullOrEmpty(g.LaunchUrl)) set.Add(g.LaunchUrl);
                else if (!string.IsNullOrEmpty(g.Path)) set.Add(Path.GetFullPath(g.Path));
            }
            return set;
        }

        private List<InstalledApp> BuildFinalList(
            List<InstalledApp> steam,
            List<InstalledApp> epic,
            List<InstalledApp> gog,
            List<InstalledApp> riot,
            List<InstalledApp> windows,
            List<InstalledApp> folders,
            HashSet<string> existingGames)
        {
            var all = new List<InstalledApp>();
            all.AddRange(steam);
            all.AddRange(epic);
            all.AddRange(gog);
            all.AddRange(riot);
            all.AddRange(windows);
            all.AddRange(folders);

            foreach (var app in all)
            {
                if (!string.IsNullOrEmpty(app.LaunchUrl))
                    app.IsAdded = existingGames.Contains(app.LaunchUrl);
                else
                    app.IsAdded = existingGames.Contains(Path.GetFullPath(app.Path));
            }

            return all
                .OrderBy(a => GetSourcePriority(a.Source))
                .GroupBy(a => NormalizeGameName(a.Name))
                .Select(g => g.First())
                .OrderBy(a => a.Name)
                .ToList();
        }

        // ========================= WEBVIEW MESSAGES =========================

        private void DeleteGameImages(GameModel game)
        {
            var imageUrls = new[]
            {
                game.GridImage,
                game.GridStaticImage,
                game.GridHorizontalImage,
                game.GridHorizontalStaticImage,
                game.HeroImage,
                game.HeroStaticImage,
                game.LogoImage,
                game.LogoStaticImage,
            };

            foreach (var url in imageUrls)
            {
                if (string.IsNullOrEmpty(url)) continue;

                try
                {
                    var uri = new Uri(url);
                    string relativePath = uri.AbsolutePath.TrimStart('/');
                    string fullPath = Path.Combine(dataFolder, relativePath.Replace('/', Path.DirectorySeparatorChar));

                    if (File.Exists(fullPath))
                    {
                        File.Delete(fullPath);
                        Debug.WriteLine($"[deleteGame] Imagem deletada: {fullPath}");
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[deleteGame] Erro ao deletar imagem {url}: {ex.Message}");
                }
            }
        }

        private void DeleteMediaImages(MediaAppModel media)
        {
            var imageUrls = new[]
            {
        media.GridImage, media.GridStaticImage, media.GridHorizontalImage,
        media.GridHorizontalStaticImage, media.HeroImage, media.HeroStaticImage,
        media.LogoImage, media.LogoStaticImage,
    };

            foreach (var url in imageUrls)
            {
                if (string.IsNullOrEmpty(url)) continue;
                try
                {
                    var uri = new Uri(url);
                    string relativePath = uri.AbsolutePath.TrimStart('/');
                    string fullPath = Path.Combine(dataFolder, relativePath.Replace('/', Path.DirectorySeparatorChar));

                    if (File.Exists(fullPath)) File.Delete(fullPath);
                }
                catch { /* Ignora se imagem não existir */ }
            }
        }
        private async Task PollInstalledAppsAsync()
        {
            // Snapshot dos fingerprints no momento em que o modal abriu
            var lastSteam = GetSteamFingerprint();
            var lastEpic = GetEpicFingerprint();
            var lastGog = GetGogFingerprint();
            var lastRiot = GetRiotFingerprint();
            var lastWin = GetWindowsRegistryFingerprint();

            while (_pollingActive)
            {
                await Task.Delay(5_000); // checa a cada 5 segundos
                if (!_pollingActive) break;

                var curSteam = GetSteamFingerprint();
                var curEpic = GetEpicFingerprint();
                var curGog = GetGogFingerprint();
                var curRiot = GetRiotFingerprint();
                var curWin = GetWindowsRegistryFingerprint();

                bool changed = !curSteam.SetEquals(lastSteam)
                            || !curEpic.SetEquals(lastEpic)
                            || !curGog.SetEquals(lastGog)
                            || !curRiot.SetEquals(lastRiot)
                            || !curWin.SetEquals(lastWin);

                if (changed)
                {
                    lastSteam = curSteam;
                    lastEpic = curEpic;
                    lastGog = curGog;
                    lastRiot = curRiot;
                    lastWin = curWin;

                    await UpdateAppCacheAsync();
                    var cache = LoadAppCache() ?? new AppCacheModel();
                    var existingMap = BuildExistingAppsMap();
                    var apps = BuildFinalList(
                        cache.SteamApps, cache.EpicApps, cache.GogApps, cache.RiotApps,
                        cache.WindowsApps, cache.FolderApps, existingMap);

                    Dispatcher.Invoke(() =>
                        webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new { type = "installedAppsUpdated", apps })));
                }
            }
        }

        // ========================= AUTO-ADD PLATAFORMAS =========================

        private async Task AutoAddPlatformGamesAsync()
        {

            if (LoadGames().Any()) return;

            var cache = LoadAppCache() ?? new AppCacheModel();

            var platformGames = cache.SteamApps
                .Concat(cache.EpicApps)
                .Concat(cache.GogApps)
                .Where(a => !string.IsNullOrEmpty(a.Name)
                            && !a.Name.Contains("Steamworks", StringComparison.OrdinalIgnoreCase)
                            && !a.Name.Contains("Unreal Engine", StringComparison.OrdinalIgnoreCase))
                .Take(12)
                .ToList();

            if (!platformGames.Any()) return;


            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(new { type = "showLoadingCards", count = platformGames.Count, tab = "games" })));

            await AddMultipleGamesAsync(platformGames);


            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"clearLoadingCards\"}"));
        }
        private async Task AddWebMediaAppAsync(string name, string url)
        {
            try
            {
                var existing = LoadMediaApps();
                if (existing.Any(a => string.Equals(a.Url, url, StringComparison.OrdinalIgnoreCase)))
                {
                    Dispatcher.Invoke(() =>
                        webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                    return;
                }

                string id = "web_" + Convert.ToHexString(
                    System.Security.Cryptography.MD5.HashData(
                        System.Text.Encoding.UTF8.GetBytes(url)))[..10].ToLower();

                var (gridUrl, horizontalUrl, heroUrl, logoUrl) = await FetchSteamGridAssetsAsync(name);

                string safeName = id;
                string? localGrid = gridUrl != null ? await DownloadImageAsync(gridUrl, gridFolder, safeName) : null;
                string? localHorizontal = horizontalUrl != null ? await DownloadImageAsync(horizontalUrl, gridHorizontalFolder, safeName + "_h") : null;
                string? localHero = heroUrl != null ? await DownloadImageAsync(heroUrl, heroFolder, safeName) : null;
                string? localLogo = logoUrl != null ? await DownloadImageAsync(logoUrl, logoFolder, safeName + "_logo") : null;

                var app = new MediaAppModel
                {
                    Id = id,
                    Name = name,
                    Url = url,
                    Type = "browser",
                    MultiUser = true,
                    OwnerUserId = currentUserId,
                    ShareMode = "private",
                    GridImage = localGrid != null ? $"https://data.local/images/grid/{Path.GetFileName(localGrid)}" : "",
                    GridHorizontalImage = localHorizontal != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(localHorizontal)}" : "",
                    HeroImage = localHero != null ? $"https://data.local/images/hero/{Path.GetFileName(localHero)}" : "",
                    LogoImage = localLogo != null ? $"https://data.local/images/logo/{Path.GetFileName(localLogo)}" : "",
                    DateAdded = DateTime.Now
                };

                existing.Add(app);
                SaveMediaApps(existing);
                SendMediaAppsToUI(existing);
            }
            finally
            {
                Dispatcher.Invoke(() =>
                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
            }
        }

        private async Task AddMultipleMediaAppsAsync(List<InstalledApp> selectedApps)
        {
            try
            {
                var existing = LoadMediaApps();

                foreach (var app in selectedApps)
                {
                    string key = !string.IsNullOrWhiteSpace(app.LaunchUrl) ? app.LaunchUrl : (app.Path ?? "");
                    if (string.IsNullOrWhiteSpace(key)) continue;
                    if (existing.Any(a => string.Equals(a.Url, key, StringComparison.OrdinalIgnoreCase)))
                        continue;

                    string id = "exe_" + Convert.ToHexString(
                        System.Security.Cryptography.MD5.HashData(
                            System.Text.Encoding.UTF8.GetBytes(key)))[..10].ToLower();

                    string? gridUrl = null;
                    string? horizontalUrl = null;
                    string? heroUrl = null;
                    string? logoUrl = null;

                    try
                    {
                        (gridUrl, horizontalUrl, heroUrl, logoUrl) = await FetchSteamGridAssetsAsync(app.Name);
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[MediaExe] Arte não encontrada para {app.Name}: {ex.Message}");
                    }

                    string safeName = id;
                    string? localGrid = null;
                    string? localHorizontal = null;
                    string? localHero = null;
                    string? localLogo = null;

                    try
                    {
                        localGrid = gridUrl != null ? await DownloadImageAsync(gridUrl, gridFolder, safeName) : null;
                        localHorizontal = horizontalUrl != null ? await DownloadImageAsync(horizontalUrl, gridHorizontalFolder, safeName + "_h") : null;
                        localHero = heroUrl != null ? await DownloadImageAsync(heroUrl, heroFolder, safeName) : null;
                        localLogo = logoUrl != null ? await DownloadImageAsync(logoUrl, logoFolder, safeName + "_logo") : null;
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[MediaExe] Download de arte falhou para {app.Name}: {ex.Message}");
                    }

                    existing.Add(new MediaAppModel
                    {
                        Id = id,
                        Name = app.Name,
                        Url = key,         // path do exe — usado no launch
                        Type = "exe",
                        MultiUser = false,
                        OwnerUserId = currentUserId,
                        ShareMode = "private",
                        GridImage = localGrid != null ? $"https://data.local/images/grid/{Path.GetFileName(localGrid)}" : "",
                        GridHorizontalImage = localHorizontal != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(localHorizontal)}" : "",
                        HeroImage = localHero != null ? $"https://data.local/images/hero/{Path.GetFileName(localHero)}" : "",
                        LogoImage = localLogo != null ? $"https://data.local/images/logo/{Path.GetFileName(localLogo)}" : "",
                        DateAdded = DateTime.Now
                    });

                    SaveMediaApps(existing);
                }

                SendMediaAppsToUI(existing);
            }
            finally
            {
                Dispatcher.Invoke(() =>
                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
            }
        }

        private async void WebView_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            var jsonMessage = e.TryGetWebMessageAsString();
            if (string.IsNullOrEmpty(jsonMessage)) return;

            try
            {
                using var doc = JsonDocument.Parse(jsonMessage);
                var root = doc.RootElement;
                if (!root.TryGetProperty("action", out var actionElement)) return;
                string action = actionElement.GetString() ?? "";

                if (action == "requestInstalledApps")
                {
                    _ = Task.Run(async () => {
                        try
                        {

                            if ((DateTime.Now - _lastCacheBuilt).TotalSeconds > 60)
                                await UpdateAppCacheAsync();

                            SendInstalledAppsToUI();
                        }
                        finally
                        {
                            Dispatcher.Invoke(() =>
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                        }
                    });
                }

                else if (action == "addSelectedGames" && root.TryGetProperty("games", out var gamesElement))
                {
                    var selectedApps = JsonSerializer.Deserialize<List<InstalledApp>>(gamesElement.GetRawText());
                    if (selectedApps != null && selectedApps.Any())
                    {

                        webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new { type = "showLoadingCards", count = selectedApps.Count, tab = "games" }));

                        _ = Task.Run(async () => await AddMultipleGamesAsync(selectedApps));
                    }
                }
                else if (action == "launch" && root.TryGetProperty("path", out var pathElement))
                {
                    string errorMsg = GetStr(root, "errorMsg", "Erro ao iniciar jogo: ");
                    LaunchGame(pathElement.GetString(), errorMsg);
                }
                else if (action == "startAppPolling")
                {
                    _pollingActive = true;
                    _ = Task.Run(PollInstalledAppsAsync);
                }
                else if (action == "stopAppPolling")
                {
                    _pollingActive = false;
                }
                else if (action == "addWebApp")
                {
                    string name = GetStr(root, "name");
                    string url = GetStr(root, "url");
                    if (!string.IsNullOrEmpty(name) && !string.IsNullOrEmpty(url))
                        _ = Task.Run(async () => await AddWebMediaAppAsync(name, url));
                }
                else if (action == "addSelectedMediaApps" && root.TryGetProperty("apps", out var mediaAppsEl))
                {
                    var selectedApps = JsonSerializer.Deserialize<List<InstalledApp>>(mediaAppsEl.GetRawText());
                    if (selectedApps != null && selectedApps.Any())
                        _ = Task.Run(async () => await AddMultipleMediaAppsAsync(selectedApps));
                }
                else if (action == "browseManualMedia")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Select Executable");
                    string dialogFilter = GetStr(root, "dialogFilter", "Executables (*.exe)|*.exe");
                    string loadTitle = GetStr(root, "loadingTitle", "Adding");
                    string loadSub = GetStr(root, "loadingSub", "Fetching covers...");
                    string errMsg = GetStr(root, "errorMsg", "Error: ");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        try
                        {
                            var dlg = new Microsoft.Win32.OpenFileDialog { Filter = dialogFilter, Title = dialogTitle };
                            if (dlg.ShowDialog() == true)
                            {
                                string filePath = dlg.FileName;
                                string cleanName = GetGameNameFromFile(filePath) ?? Path.GetFileNameWithoutExtension(filePath);
                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                { type = "updateLoadingText", title = loadTitle, subtitle = loadSub }));
                                await AddMultipleMediaAppsAsync(new List<InstalledApp>
                {
                    new InstalledApp { Name = cleanName, Path = filePath, IconBase64 = GetCachedIcon(filePath) }
                });
                                await webView.CoreWebView2.ExecuteScriptAsync("closeModal();");
                            }
                            else
                            {
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show(errMsg + ex.Message);
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                        }
                    });
                }
                else if (action == "browseManual")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Select Executable");
                    string dialogFilter = GetStr(root, "dialogFilter", "Executables (*.exe)|*.exe");
                    string loadTitle = GetStr(root, "loadingTitle", "Adding");
                    string loadSub = GetStr(root, "loadingSub", "Fetching covers...");
                    string errMsg = GetStr(root, "errorMsg", "Error: ");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        try
                        {
                            var dlg = new Microsoft.Win32.OpenFileDialog
                            {
                                Filter = dialogFilter,
                                Title = dialogTitle
                            };
                            if (dlg.ShowDialog() == true)
                            {
                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "updateLoadingText",
                                    title = loadTitle,
                                    subtitle = loadSub
                                }));
                                string filePath = dlg.FileName;
                                string cleanName = GetGameNameFromFile(filePath) ?? Path.GetFileNameWithoutExtension(filePath);
                                var manualApp = new List<InstalledApp>
                                {
                                    new InstalledApp { Name = cleanName, Path = filePath, IconBase64 = GetCachedIcon(filePath) }
                                };
                                await AddMultipleGamesAsync(manualApp);
                                await webView.CoreWebView2.ExecuteScriptAsync("closeModal();");
                            }
                            else
                            {
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show(errMsg + ex.Message);
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                        }
                    });
                }
                else if (action == "requestFolders")
                {
                    _ = Task.Run(() => {
                        try { SendFoldersToUI(); }
                        finally { Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}")); }
                    });
                }
                else if (action == "pickFolder")
                {
                    string dialogTitle = GetStr(root, "dialogTitle");
                    string forbiddenMsg = GetStr(root, "forbiddenMsg");
                    string forbiddenTitle = GetStr(root, "forbiddenTitle");
                    string loadTitle = GetStr(root, "loadingTitle");
                    string loadSub = GetStr(root, "loadingSub");
                    string errMsg = GetStr(root, "errorMsg");

                    await Dispatcher.InvokeAsync(() =>
                    {
                        try
                        {
                            var dlg = new Microsoft.Win32.OpenFolderDialog
                            {
                                Title = dialogTitle,
                                Multiselect = false
                            };

                            if (dlg.ShowDialog() == true)
                            {
                                string selectedPath = dlg.FolderName;
                                if (IsFolderForbidden(selectedPath))
                                {
                                    System.Windows.MessageBox.Show(forbiddenMsg, forbiddenTitle, MessageBoxButton.OK, MessageBoxImage.Warning);
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                                    return;
                                }

                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "updateLoadingText",
                                    title = loadTitle,
                                    subtitle = loadSub
                                }));

                                var folders = LoadFoldersData();
                                if (!folders.Any(f => string.Equals(f.Path, selectedPath, StringComparison.OrdinalIgnoreCase)))
                                {
                                    var placeholder = new FolderStats { Path = selectedPath };
                                    folders.Add(placeholder);
                                    SaveFoldersData(folders);
                                    AddFolderWatcher(selectedPath);
                                }

                                _ = Task.Run(async () => {
                                    try
                                    {
                                        await UpdateAppCacheAsync();
                                        SendFoldersToUI();
                                        SendInstalledAppsToUI();
                                    }
                                    finally
                                    {
                                        Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                                    }
                                });
                            }
                            else
                            {
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show(errMsg + ex.Message);
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                        }
                    });
                }
                else if (action == "editFolder" && root.TryGetProperty("path", out var oldPathEl))
                {
                    string oldPath = oldPathEl.GetString() ?? "";
                    string dialogTitle = GetStr(root, "dialogTitle");
                    string forbiddenMsg = GetStr(root, "forbiddenMsg");
                    string forbiddenTitle = GetStr(root, "forbiddenTitle");
                    string loadTitle = GetStr(root, "loadingTitle");
                    string loadSub = GetStr(root, "loadingSub");
                    string errMsg = GetStr(root, "errorMsg");

                    await Dispatcher.InvokeAsync(() =>
                    {
                        try
                        {
                            var dlg = new Microsoft.Win32.OpenFolderDialog
                            {
                                Title = dialogTitle,
                                Multiselect = false
                            };

                            if (dlg.ShowDialog() == true)
                            {
                                string newPath = dlg.FolderName;

                                if (IsFolderForbidden(newPath))
                                {
                                    System.Windows.MessageBox.Show(forbiddenMsg, forbiddenTitle, MessageBoxButton.OK, MessageBoxImage.Warning);
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                                    return;
                                }

                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "updateLoadingText",
                                    title = loadTitle,
                                    subtitle = loadSub
                                }));

                                var folders = LoadFoldersData();
                                int idx = folders.FindIndex(f => string.Equals(f.Path, oldPath, StringComparison.OrdinalIgnoreCase));
                                var placeholder = new FolderStats { Path = newPath };

                                if (idx >= 0) folders[idx] = placeholder;
                                else folders.Add(placeholder);

                                SaveFoldersData(folders);

                                var dead = _folderWatchers.Where(w => string.Equals(w.Path, oldPath, StringComparison.OrdinalIgnoreCase)).ToList();
                                foreach (var w in dead) { w.EnableRaisingEvents = false; w.Dispose(); }
                                foreach (var w in dead) _folderWatchers.Remove(w);
                                AddFolderWatcher(newPath);
                                _ = Task.Run(async () => {
                                    try
                                    {
                                        await UpdateAppCacheAsync();
                                        SendFoldersToUI();
                                        SendInstalledAppsToUI();
                                    }
                                    finally
                                    {
                                        Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                                    }
                                });
                            }
                            else
                            {
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show(errMsg + ex.Message);
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                        }
                    });
                }
                else if (action == "deleteFolder" && root.TryGetProperty("path", out var delPathEl))
                {
                    string delPath = delPathEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(delPath))
                    {
                        DeleteWatchedFolder(delPath);

                        _ = Task.Run(async () => {
                            try
                            {
                                await UpdateAppCacheAsync();
                                SendFoldersToUI();
                                SendInstalledAppsToUI();
                            }
                            finally
                            {
                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                            }
                        });
                    }
                    else
                    {
                        webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                    }
                }
                else if (action == "saveStaticFrame")
                {
                    string gameId = root.GetProperty("gameId").GetString() ?? "";
                    string imageType = root.GetProperty("imageType").GetString() ?? "";
                    string base64 = root.GetProperty("base64").GetString() ?? "";

                    if (!string.IsNullOrEmpty(gameId) && !string.IsNullOrEmpty(base64))
                    {
                        string cleanBase64 = base64.Contains(",") ? base64.Split(',')[1] : base64;
                        byte[] imageBytes = Convert.FromBase64String(cleanBase64);

                        var games = LoadGames();

                        var game = games.FirstOrDefault(g => g.Path == gameId || g.LaunchUrl == gameId);

                        if (game != null)
                        {
                            string safeName = string.Concat(game.Name.Where(c => !Path.GetInvalidFileNameChars().Contains(c)));
                            string fileName = $"{safeName}_{imageType}.png";
                            string folder = gridFolder;
                            string folderUrlName = "grid";

                            if (imageType == "HeroStatic") { folder = heroFolder; folderUrlName = "hero"; }
                            else if (imageType == "LogoStatic") { folder = logoFolder; folderUrlName = "logo"; }
                            else if (imageType == "HorizontalStatic") { folder = gridHorizontalFolder; folderUrlName = "grid-horizontal"; }

                            string fullPath = Path.Combine(folder, fileName);
                            File.WriteAllBytes(fullPath, imageBytes);
                            string staticUrl = $"https://data.local/images/{folderUrlName}/{fileName}";

                            if (imageType == "GridStatic") game.GridStaticImage = staticUrl;
                            else if (imageType == "HorizontalStatic") game.GridHorizontalStaticImage = staticUrl;
                            else if (imageType == "HeroStatic") game.HeroStaticImage = staticUrl;
                            else if (imageType == "LogoStatic") game.LogoStaticImage = staticUrl;

                            SaveGames(games);
                            var response = new { type = "staticSaved", gameId, imageType, newUrl = staticUrl };
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(response));
                        }
                        else
                        {
                            var mediaApps = LoadMediaApps();
                            var mediaApp = mediaApps.FirstOrDefault(a => a.Id == gameId);

                            if (mediaApp != null)
                            {
                                string fileName = $"{mediaApp.Id}_{imageType}.png";
                                string folder = gridFolder;
                                string folderUrlName = "grid";

                                if (imageType == "HeroStatic") { folder = heroFolder; folderUrlName = "hero"; }
                                else if (imageType == "LogoStatic") { folder = logoFolder; folderUrlName = "logo"; }
                                else if (imageType == "HorizontalStatic") { folder = gridHorizontalFolder; folderUrlName = "grid-horizontal"; }

                                string fullPath = Path.Combine(folder, fileName);
                                File.WriteAllBytes(fullPath, imageBytes);
                                string staticUrl = $"https://data.local/images/{folderUrlName}/{fileName}";

                                if (imageType == "GridStatic") mediaApp.GridStaticImage = staticUrl;
                                else if (imageType == "HorizontalStatic") mediaApp.GridHorizontalStaticImage = staticUrl;
                                else if (imageType == "HeroStatic") mediaApp.HeroStaticImage = staticUrl;
                                else if (imageType == "LogoStatic") mediaApp.LogoStaticImage = staticUrl;

                                SaveMediaApps(mediaApps);
                                var response = new { type = "staticSaved", gameId, imageType, newUrl = staticUrl };
                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(response));
                            }
                        }
                    }
                }
                else if (action == "deleteGame" && root.TryGetProperty("gameId", out var delGameIdEl))
                {
                    string gameId = delGameIdEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(gameId))
                    {
                        var games = LoadGames();
                        var game = games.FirstOrDefault(g =>
                            string.Equals(g.Path, gameId, StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(g.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase));

                        if (game != null)
                        {
                            DeleteGameImages(game);
                            games.Remove(game);
                            SaveGames(games);
                            Debug.WriteLine($"[deleteGame] Jogo Removido: {gameId}");
                        }
                        else
                        {
                            // MÍDIAS - Se não for um Jogo, tenta achar em Mídia e apaga!
                            if (gameId.Equals("youtube", StringComparison.OrdinalIgnoreCase)) return;

                            var medias = LoadMediaApps();
                            var media = medias.FirstOrDefault(m => string.Equals(m.Id, gameId, StringComparison.OrdinalIgnoreCase) || string.Equals(m.Url, gameId, StringComparison.OrdinalIgnoreCase));

                            if (media != null)
                            {
                                // 1. Remove Imagens e Salva no media.json
                                DeleteMediaImages(media);
                                medias.Remove(media);
                                SaveMediaApps(medias);
                                Debug.WriteLine($"[deleteGame] Mídia Removida: {gameId}");

                                // 2. Lógica para apagar o Cache (browser-profiles)
                                try
                                {
                                    // Identifica se a mídia era um App Nativo para achar o nome da pasta
                                    var nativeApp = _nativeApps.FirstOrDefault(a => media.Url.Contains(a.Id));

                                    // Evita apagar cache de "apps web customizados", pois eles dividem a mesma pasta "default"
                                    if (nativeApp != default && nativeApp.Id != "youtube")
                                    {
                                        string profileName;
                                        if (nativeApp.MultiUser)
                                        {
                                            profileName = $"shared-{nativeApp.Id}";
                                        }
                                        else
                                        {
                                            var profile = LoadUserProfile();
                                            string safeName = string.IsNullOrWhiteSpace(profile.Name)
                                                ? "default"
                                                : string.Concat(profile.Name.Where(c => !Path.GetInvalidFileNameChars().Contains(c)));

                                            profileName = $"{safeName}-{nativeApp.Id}";
                                        }

                                        string cachePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "browser-profiles", profileName);

                                        if (Directory.Exists(cachePath))
                                        {
                                            // Força o Garbage Collector a soltar arquivos do WebView antes de deletar
                                            GC.Collect();
                                            GC.WaitForPendingFinalizers();

                                            Directory.Delete(cachePath, true);
                                            Debug.WriteLine($"[deleteGame] Cache físico apagado: {profileName}");
                                        }
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Debug.WriteLine($"[deleteGame] Erro ao tentar apagar o cache: {ex.Message}");
                                }
                            }
                        }
                    }
                }
                else if (action == "editGame" &&
                         root.TryGetProperty("gameId", out var editIdEl) &&
                         root.TryGetProperty("newName", out var editNameEl))
                {
                    string gameId = editIdEl.GetString() ?? "";
                    string newName = editNameEl.GetString() ?? "";

                    if (!string.IsNullOrEmpty(gameId) && !string.IsNullOrEmpty(newName))
                    {
                        var games = LoadGames();
                        var game = games.FirstOrDefault(g =>
                            string.Equals(g.Path, gameId, StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(g.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase));

                        if (game != null)
                        {
                            game.Name = newName;
                            SaveGames(games);
                            Debug.WriteLine($"[editGame] '{game.Path}' renomeado para: {newName}");
                        }
                        else
                        {
                            // MÍDIAS - Se não for um Jogo, edita o nome na lista de Mídia
                            if (gameId.Equals("youtube", StringComparison.OrdinalIgnoreCase)) return;

                            var medias = LoadMediaApps();
                            var media = medias.FirstOrDefault(m => string.Equals(m.Id, gameId, StringComparison.OrdinalIgnoreCase) || string.Equals(m.Url, gameId, StringComparison.OrdinalIgnoreCase));
                            if (media != null)
                            {
                                media.Name = newName;
                                SaveMediaApps(medias); // Atualiza e salva o media.json
                                Debug.WriteLine($"[editGame] Mídia renomeada para: {newName}");
                            }
                        }
                    }
                }
                else if (action == "saveSetupUsers" && root.TryGetProperty("users", out var setupUsersEl))
                {
                    int activeIndex = root.TryGetProperty("activeIndex", out var activeEl) ? activeEl.GetInt32() : 0;
                    var incoming = setupUsersEl.EnumerateArray().ToList();
                    var existingUsers = LoadUserProfiles();
                    bool wasEmpty = existingUsers.Count == 0 || existingUsers.All(u => string.IsNullOrWhiteSpace(u.Name));
                    var savedProfiles = new List<(UserProfile Profile, List<string> Folders)>();

                    foreach (var userEl in incoming)
                    {
                        var profile = new UserProfile
                        {
                            Id = MakeUserId(GetStr(userEl, "name")),
                            Name = GetStr(userEl, "name"),
                            PhotoBase64 = GetStr(userEl, "photoBase64"),
                            SteamGridApiKey = GetStr(userEl, "apiKey"),
                            DateCreated = DateTime.Now,
                            LastUsed = DateTime.Now,
                        };

                        var folders = userEl.TryGetProperty("folders", out var fEl)
                            ? JsonSerializer.Deserialize<List<string>>(fEl.GetRawText()) ?? new()
                            : new List<string>();

                        existingUsers.Add(profile);
                        string userDir = Path.Combine(dataFolder, "users", profile.Id);
                        Directory.CreateDirectory(userDir);
                        File.WriteAllText(Path.Combine(userDir, "user.json"),
                            JsonSerializer.Serialize(profile, new JsonSerializerOptions { WriteIndented = true }));
                        File.WriteAllText(Path.Combine(userDir, "games.json"), "[]");
                        File.WriteAllText(Path.Combine(userDir, "media.json"), "[]");
                        File.WriteAllText(Path.Combine(userDir, "folders.json"),
                            JsonSerializer.Serialize(folders.Select(p => new FolderStats { Path = p }).ToList(),
                                new JsonSerializerOptions { WriteIndented = true }));

                        savedProfiles.Add((profile, folders));
                    }

                    SaveUserProfiles(existingUsers.Where(u => !string.IsNullOrWhiteSpace(u.Name)).ToList());

                    if (savedProfiles.Count > 0)
                    {
                        activeIndex = Math.Clamp(activeIndex, 0, savedProfiles.Count - 1);
                        var active = savedProfiles[activeIndex].Profile;
                        SetActiveUser(active, migrateLegacyFiles: wasEmpty && File.Exists(Path.Combine(dataFolder, "games.json")));
                        RestartWatchers();

                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                foreach (var item in savedProfiles)
                                {
                                    string mediaPath = Path.Combine(dataFolder, "users", item.Profile.Id, "media.json");
                                    await InitializeNativeAppsAsync(item.Profile.Id, mediaPath);
                                }

                                await UpdateAppCacheAsync();

                                // Bloqueia a auto-importação para novos usuários criados posteriormente.
                                // A importação só ocorre no setup inicial do programa (wasEmpty).
                                if (wasEmpty)
                                {
                                    await AutoAddPlatformGamesAsync();
                                }

                                Dispatcher.Invoke(() =>
                                {
                                    LoadCurrentUserIntoUI();
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideSystemLoading\"}");
                                });
                            }
                            catch (Exception ex)
                            {
                                Debug.WriteLine("[SetupBatch] Erro: " + ex.Message);
                                Dispatcher.Invoke(() =>
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideSystemLoading\"}"));
                            }
                        });
                    }
                }
                else if (action == "saveUserProfile")
                {
                    bool createNew = root.TryGetProperty("createNew", out var createEl) && createEl.GetBoolean();
                    bool isPrimary = root.TryGetProperty("isPrimary", out var isPrimEl) && isPrimEl.GetBoolean();
                    bool isLast = root.TryGetProperty("isLast", out var isLastEl) && isLastEl.GetBoolean();
                    bool skipTasks = root.TryGetProperty("skipTasks", out var skipEl) && skipEl.GetBoolean();

                    string requestedId = GetStr(root, "userId");
                    var profile = new UserProfile
                    {
                        Id = createNew ? "" : (!string.IsNullOrWhiteSpace(requestedId) ? requestedId : currentUserId),
                        Name = GetStr(root, "name"),
                        PhotoBase64 = GetStr(root, "photoBase64"),
                        SteamGridApiKey = GetStr(root, "apiKey"),
                        DateCreated = DateTime.Now,
                        LastUsed = DateTime.Now,
                    };

                    var users = LoadUserProfiles();
                    var existingUser = !createNew
                        ? users.FirstOrDefault(u => string.Equals(u.Id, profile.Id, StringComparison.OrdinalIgnoreCase))
                        : null;

                    if (existingUser != null)
                    {
                        existingUser.Name = profile.Name;
                        existingUser.PhotoBase64 = profile.PhotoBase64;
                        existingUser.SteamGridApiKey = profile.SteamGridApiKey;
                        existingUser.LastUsed = DateTime.Now;
                        profile.DateCreated = existingUser.DateCreated;
                        profile = existingUser;
                    }
                    else
                    {
                        profile.Id = MakeUserId(profile.Name);
                        users.Add(profile);
                    }
                    SaveUserProfiles(users);

                    bool isFirstEver = users.Count == 1;
                    SetActiveUser(profile, migrateLegacyFiles: isFirstEver && !createNew);
                    RestartWatchers();
                    SaveUserProfile(profile);

                    if (root.TryGetProperty("folders", out var foldersEl))
                    {
                        var paths = JsonSerializer.Deserialize<List<string>>(foldersEl.GetRawText()) ?? new();
                        var existing = LoadFoldersData();
                        foreach (var path in paths)
                        {
                            if (!existing.Any(f => string.Equals(f.Path, path, StringComparison.OrdinalIgnoreCase)))
                            {
                                existing.Add(new FolderStats { Path = path });
                                AddFolderWatcher(path);
                            }
                        }
                        SaveFoldersData(existing);
                    }

                    if (!skipTasks)
                    {
                        // CAPTURA AS VARIÁVEIS ANTES DO TASK.RUN PRA CONGELAR O CONTEXTO!
                        string taskUserId = profile.Id;
                        string taskMediaFile = Path.Combine(dataFolder, "users", taskUserId, "media.json");

                        _ = Task.Run(async () => {
                            try
                            {
                                await InitializeNativeAppsAsync(taskUserId, taskMediaFile);

                                if (isPrimary)
                                {
                                    await UpdateAppCacheAsync();
                                    await AutoAddPlatformGamesAsync();
                                }

                                if (isLast)
                                {
                                    Dispatcher.Invoke(() => {
                                        LoadCurrentUserIntoUI();
                                        webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideSystemLoading\"}");
                                    });
                                }
                            }
                            catch (Exception ex) { Debug.WriteLine("[Setup] Erro: " + ex.Message); }
                        });
                    }
                }
                else if (action == "requestUsers")
                {
                    SendUsersToUI(requireSelection: false);
                }
                else if (action == "selectUser")
                {
                    string userId = GetStr(root, "userId");
                    if (!string.IsNullOrWhiteSpace(userId)) SwitchToUser(userId);
                }
                else if (action == "requestExtensions")
                {
                    SendExtensionsToUI();
                }
                else if (action == "installExtension")
                {
                    string url = GetStr(root, "url");
                    string successMsg = GetStr(root, "successMsg", "Extensão instalada com sucesso.");

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await InstallChromeExtensionAsync(url);
                            SendExtensionsToUI("success", successMsg);
                        }
                        catch (Exception ex)
                        {
                            SendExtensionsToUI("error", ex.Message);
                        }
                    });
                }
                else if (action == "openExtensionStore")
                {
                    _extBtnTitle = GetStr(root, "extBtnTitle", "Adicionar extensão ao Doorpi");
                    _extBtnSub = GetStr(root, "extBtnSub", "Instalar via Doorpi Browser");
                    _extToastTitle = GetStr(root, "toastTitle", "Doorpi");
                    _extToastSub = GetStr(root, "toastSub", "Extensão enviada ao Doorpi!");
                    _extInstalledTitle = GetStr(root, "extInstalledTitle", "Já instalada no Doorpi");
                    _extInstalledSub = GetStr(root, "extInstalledSub", "Em uso no seu navegador");

                    string hl = System.Globalization.CultureInfo.CurrentUICulture.Name.Replace('_', '-');
                    string cwsUrl = $"https://chromewebstore.google.com/category/extensions?hl={hl}";

                    _ = Dispatcher.InvokeAsync(async () =>
                        await OpenWebViewInlineAsync(cwsUrl, false));
                }
                else if (action == "updateAppSharing")
                {
                    string appId = GetStr(root, "appId");
                    string shareMode = GetStr(root, "shareMode", "private");
                    string sharedWithUserId = GetStr(root, "sharedWithUserId");
                    var users = LoadUserProfiles();
                    var apps = LoadMediaAppsForUser(currentUserId);
                    var app = apps.FirstOrDefault(a => string.Equals(a.Id, appId, StringComparison.OrdinalIgnoreCase) ||
                                                       string.Equals(a.Url, appId, StringComparison.OrdinalIgnoreCase));
                    if (app != null && !app.IsSharedFromOtherUser)
                    {
                        app.OwnerUserId = currentUserId;
                        app.ShareMode = shareMode is "all" or "user" ? shareMode : "private";
                        app.SharedWithUserId = app.ShareMode == "user" ? sharedWithUserId : "";
                        app.SharedWithUserName = app.ShareMode == "user"
                            ? users.FirstOrDefault(u => string.Equals(u.Id, sharedWithUserId, StringComparison.OrdinalIgnoreCase))?.Name ?? ""
                            : "";
                        SaveMediaApps(apps);
                        SendMediaAppsToUI(LoadMediaApps());
                    }
                }
                else if (action == "pickProfilePhoto")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Select profile photo");
                    string dialogFilter = GetStr(root, "dialogFilter", "Images (*.png;*.jpg;*.jpeg;*.webp;*.gif)|*.png;*.jpg;*.jpeg;*.webp;*.gif");

                    await Dispatcher.InvokeAsync(() =>
                    {
                        var dlg = new Microsoft.Win32.OpenFileDialog
                        {
                            Title = dialogTitle,
                            Filter = dialogFilter
                        };
                        if (dlg.ShowDialog() == true)
                        {
                            string b64 = Convert.ToBase64String(File.ReadAllBytes(dlg.FileName));
                            webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new { type = "profilePhotoSelected", base64 = b64 }));
                        }
                    });
                }
                else if (action == "openUrl" && root.TryGetProperty("url", out var urlEl))
                {
                    string url = urlEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(url))
                        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                }
                else if (action == "launchMediaApp" && root.TryGetProperty("url", out var mediaUrlEl))
                {
                    _currentToastTitle = GetStr(root, "toastTitle", "Copiado!");
                    _currentToastSub = GetStr(root, "toastSub", "Retornando...");

                    string mediaUrl = mediaUrlEl.GetString() ?? "";
                    string appType = root.TryGetProperty("appType", out var atEl)
                                      ? (atEl.GetString() ?? "browser") : "browser";

                    if (!string.IsNullOrEmpty(mediaUrl))
                    {
                        var medias = LoadMediaApps();
                        var media = medias.FirstOrDefault(m => m.Url == mediaUrl || m.Id == mediaUrl);
                        if (media != null)
                        {
                            media.LastPlayed = DateTime.Now;
                            SaveMediaApps(medias);

                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                            {
                                type = "updateFeaturedCard",
                                tab = "media",
                                id = media.Id
                            }));
                        }

                        if (appType == "webview" || appType == "browser")
                            _ = Dispatcher.InvokeAsync(async () => await OpenWebViewInlineAsync(mediaUrl, mediaUrl.Contains("youtube.com")));
                        else if (appType == "exe")
                        {

                            Dispatcher.Invoke(() =>
                            {
                                try
                                {
                                    if (File.Exists(mediaUrl))
                                    {
                                        var proc = Process.Start(new ProcessStartInfo
                                        {
                                            FileName = mediaUrl,
                                            UseShellExecute = true,
                                            WorkingDirectory = Path.GetDirectoryName(mediaUrl)
                                        });
                                        if (proc != null) WatchAndRefocus(proc);
                                    }
                                    else if (!string.IsNullOrWhiteSpace(mediaUrl))
                                    {
                                        EnsureLauncherRunning(mediaUrl);
                                        var proc = Process.Start(new ProcessStartInfo(mediaUrl) { UseShellExecute = true });
                                        if (proc != null) WatchAndRefocus(proc);
                                    }
                                }
                                catch (Exception ex) { Debug.WriteLine($"[launchMediaApp/exe] {ex.Message}"); }
                            });
                        }
                        else
                            Dispatcher.Invoke(() => OpenInBrowser(mediaUrl));
                    }
                }
                else if (action == "pickFolderForSetup")
                {
                    string dialogTitle = GetStr(root, "dialogTitle");
                    string forbiddenMsg = GetStr(root, "forbiddenMsg");
                    string forbiddenTitle = GetStr(root, "forbiddenTitle");

                    await Dispatcher.InvokeAsync(() =>
                    {
                        var dlg = new Microsoft.Win32.OpenFolderDialog { Title = dialogTitle };
                        if (dlg.ShowDialog() == true)
                        {
                            string path = dlg.FolderName;
                            if (IsFolderForbidden(path))
                            {
                                System.Windows.MessageBox.Show(forbiddenMsg, forbiddenTitle,
                                    MessageBoxButton.OK, MessageBoxImage.Warning);
                                return;
                            }
                            webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new { type = "setupFolderAdded", path }));
                        }
                    });
                }
                else if (action == "readClipboard")
                {
                    await Dispatcher.InvokeAsync(() =>
                    {
                        string text = System.Windows.Clipboard.GetText();
                        webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new { type = "clipboardText", text }));
                    });
                }
                else if (action == "systemMouseMove")
                {
                    int dx = root.TryGetProperty("dx", out var dxEl) ? dxEl.GetInt32() : 0;
                    int dy = root.TryGetProperty("dy", out var dyEl) ? dyEl.GetInt32() : 0;
                    Dispatcher.Invoke(() =>
                    {
                        if (GetCursorPos(out var pt))
                            SetCursorPos(pt.X + dx, pt.Y + dy);
                    });
                }
                else if (action == "systemMouseClick")
                {
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                }
                else if (action == "systemMouseRightClick")
                {
                    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
                    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
                    mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                    mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
                }
                else if (action == "enterDesktopMode")
                {
                    Dispatcher.Invoke(EnterDesktopMode);
                }
                else if (action == "detectBrowsers")
                {
                    var candidates = new[]
                    {
                        new { name = "Google Chrome", exe = "chrome.exe",   path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),    "Google", "Chrome", "Application", "chrome.exe") },
                        new { name = "Google Chrome", exe = "chrome.exe",   path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe") },
                        new { name = "Microsoft Edge", exe = "msedge.exe",  path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe") },
                        new { name = "Brave",          exe = "brave.exe",   path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BraveSoftware", "Brave-Browser", "Application", "brave.exe") },
                        new { name = "Firefox",        exe = "firefox.exe", path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),    "Mozilla Firefox", "firefox.exe") },
                        new { name = "Firefox",        exe = "firefox.exe", path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Mozilla Firefox", "firefox.exe") },
                    };

                    var found = candidates
                        .Where(b => File.Exists(b.path))
                        .GroupBy(b => b.exe)
                        .Select(g => g.First())
                        .ToList();

                    var json = JsonSerializer.Serialize(new { type = "browsersDetected", browsers = found });
                    webView.CoreWebView2.PostWebMessageAsString(json);
                }
            }
            catch (Exception ex) { Debug.WriteLine($"Erro no WebView Message: {ex.Message}"); }
        }

        // ========================= ADICIONAR JOGOS =========================

        private async Task AddMultipleGamesAsync(List<InstalledApp> selectedApps)
        {
            var existingGames = LoadGames();
            bool isFirstGame = existingGames.Count == 0;
            bool dbChanged = false;

            foreach (var app in selectedApps)
            {
                if (existingGames.Any(g => g.Path.Equals(app.Path, StringComparison.OrdinalIgnoreCase)))
                    continue;

                string? steamAppId = null;
                if (!string.IsNullOrEmpty(app.LaunchUrl) && app.LaunchUrl.StartsWith("steam://run/"))
                    steamAppId = app.LaunchUrl.Replace("steam://run/", "").Trim();

                var (gridUrl, gridHorizontalUrl, heroUrl, logoUrl) = await FetchSteamGridAssetsAsync(app.Name, steamAppId);
                await Task.Delay(150);
                string safeName = app.Path.GetHashCode().ToString();
                string? localGrid = null, localGridHorizontal = null, localHero = null, localLogo = null;

                if (!string.IsNullOrEmpty(gridHorizontalUrl)) localGridHorizontal = await DownloadImageAsync(gridHorizontalUrl, gridHorizontalFolder, safeName + "_h");
                if (!string.IsNullOrEmpty(gridUrl)) localGrid = await DownloadImageAsync(gridUrl, gridFolder, safeName);
                if (!string.IsNullOrEmpty(heroUrl)) localHero = await DownloadImageAsync(heroUrl, heroFolder, safeName);
                if (!string.IsNullOrEmpty(logoUrl)) localLogo = await DownloadImageAsync(logoUrl, logoFolder, safeName + "_logo");

                var game = new GameModel
                {
                    Name = app.Name,
                    Path = app.Path,
                    LaunchUrl = app.LaunchUrl,
                    GridImage = localGrid != null ? $"https://data.local/images/grid/{Path.GetFileName(localGrid)}" : "",
                    GridHorizontalImage = localGridHorizontal != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(localGridHorizontal)}" : "",
                    HeroImage = localHero != null ? $"https://data.local/images/hero/{Path.GetFileName(localHero)}" : "",
                    LogoImage = localLogo != null ? $"https://data.local/images/logo/{Path.GetFileName(localLogo)}" : "",
                    LastPlayed = DateTime.MinValue,
                    DateAdded = DateTime.Now
                };

                existingGames.Add(game);
                dbChanged = true;
                SaveGames(existingGames);

                Dispatcher.Invoke(() => SendGameToUI(game, isFirstGame));
                if (isFirstGame) isFirstGame = false;
            }
            Dispatcher.Invoke(() => LoadGamesIntoUI());

            if (dbChanged) SaveGames(existingGames);
            Dispatcher.Invoke(() =>
            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"clearLoadingCards\"}"));
        }

        // ========================= STEAMGRID =========================

        private string PrepareSearchName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return name;
            if (name.Trim().Contains(" ")) return name.Trim();

            string result = Regex.Replace(name, @"([a-z])([A-Z])", "$1 $2");
            result = Regex.Replace(result, @"([A-Z])([A-Z][a-z])", "$1 $2");
            result = Regex.Replace(result, @"([a-zA-Z])(\d)", "$1 $2");
            result = Regex.Replace(result, @"(\d)([a-zA-Z])", "$1 $2");
            return Regex.Replace(result, @"\s+", " ").Trim();
        }

        private async Task<(string?, string?, string?, string?)> FetchSteamGridAssetsAsync(string gameName, string? steamAppId = null)
        {


            string treatedName = PrepareSearchName(gameName);
            Debug.WriteLine($"[SGDB] Nome original: {gameName} | Tratado: {treatedName}");

            if (!string.IsNullOrEmpty(steamAppId))
            {
                var steam = await TryFetchFromSteamCDN(steamAppId);
                if (steam.Item1 != null) return steam;

                var byId = await TryFetchBySteamAppId(steamAppId);
                if (byId.Item1 != null) return byId;
            }
            return await TryFetchByName(treatedName);
        }

        private async Task<(string?, string?, string?, string?)> TryFetchFromSteamCDN(string appId)
        {
            try
            {
                string grid = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/library_600x900.jpg";
                string horizontal = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/header.jpg";
                string hero = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/library_hero.jpg";
                string logo = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/logo.png";

                var response = await httpClient.SendAsync(new HttpRequestMessage(HttpMethod.Head, grid));
                if (!response.IsSuccessStatusCode) return (null, null, null, null);

                return (grid, horizontal, hero, logo);
            }
            catch { return (null, null, null, null); }
        }

        private async Task<(string?, string?, string?, string?)> TryFetchBySteamAppId(string steamAppId)
        {
            try
            {
                var json = await SgdbGetStringAsync($"https://www.steamgriddb.com/api/v2/games/steam/{steamAppId}");


                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.GetProperty("success").GetBoolean()) return (null, null, null, null);

                int id = doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
                return await FetchAssetsByGameId(id);
            }
            catch { return (null, null, null, null); }
        }

        private async Task<(string?, string?, string?, string?)> TryFetchByName(string gameName)
        {
            try
            {
                string safe = Uri.EscapeDataString(gameName);
                var json = await SgdbGetStringAsync($"https://www.steamgriddb.com/api/v2/search/autocomplete/{safe}");

                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.GetProperty("success").GetBoolean()) return (null, null, null, null);

                var results = doc.RootElement.GetProperty("data");
                if (results.GetArrayLength() == 0) return (null, null, null, null);

                foreach (var game in results.EnumerateArray().Take(10))
                {
                    int id = game.GetProperty("id").GetInt32();
                    var assets = await FetchAssetsByGameId(id);
                    if (assets.Item1 != null) return assets;
                    await Task.Delay(150);
                }

                return (null, null, null, null);
            }
            catch { return (null, null, null, null); }
        }

        private async Task<(string?, string?, string?, string?)> FetchAssetsByGameId(int id)
        {
            string? grid = await GetFirstImageUrl($"grids/game/{id}?dimensions=600x900,342x482,660x930&types=static,animated&sort=score")
                        ?? await GetFirstImageUrl($"grids/game/{id}?dimensions=600x900&types=static,animated&sort=score&styles=alternate,blurred,white_logo,material,no_logo")
                        ?? await GetFirstImageUrl($"grids/game/{id}?types=static,animated&sort=score&nsfw=any&humor=any")
                        ?? await GetFirstImageUrl($"grids/game/{id}?nsfw=any&humor=any");

            if (string.IsNullOrEmpty(grid)) return (null, null, null, null);

            var horizontalTask = GetFirstImageUrl($"grids/game/{id}?dimensions=460x215,920x430&types=static,animated&sort=score");
            var heroTask = GetFirstImageUrl($"heroes/game/{id}?types=static,animated&sort=score");
            var logoTask = GetFirstImageUrl($"logos/game/{id}?types=static,animated&sort=score");

            await Task.WhenAll(horizontalTask, heroTask, logoTask);

            string? horizontal = horizontalTask.Result ?? heroTask.Result;
            string? hero = heroTask.Result;
            string? logo = logoTask.Result;

            return (grid, horizontal, hero, logo);
        }

        private async Task<string?> GetFirstImageUrl(string endpoint)
        {
            try
            {
                string url = $"https://www.steamgriddb.com/api/v2/{endpoint}";
                var json = await SgdbGetStringAsync(url);


                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.GetProperty("success").GetBoolean()) return null;

                var data = doc.RootElement.GetProperty("data");
                if (data.GetArrayLength() == 0) return null;

                return data[0].GetProperty("url").GetString();
            }
            catch (Exception ex) { Debug.WriteLine("Erro ao buscar imagem: " + ex.Message); return null; }
        }

        private async Task<string?> DownloadImageAsync(string url, string folder, string name)
        {
            for (int attempt = 1; attempt <= 3; attempt++)
            {
                try
                {
                    var response = await downloadClient.GetAsync(url);
                    if (!response.IsSuccessStatusCode)
                    {
                        Debug.WriteLine($"[Download] tentativa {attempt} | HTTP {(int)response.StatusCode} | {url}");
                        if (attempt < 3) await Task.Delay(800 * attempt);
                        continue;
                    }

                    var bytes = await response.Content.ReadAsByteArrayAsync();
                    string ext = Path.GetExtension(url).Split('?')[0].ToLower();

                    if (string.IsNullOrEmpty(ext))
                    {
                        string contentType = response.Content.Headers.ContentType?.MediaType ?? "";
                        ext = contentType switch
                        {
                            "image/png" => ".png",
                            "image/jpeg" => ".jpg",
                            "image/webp" => ".webp",
                            _ => ".png"
                        };
                    }

                    string fileName = name + ext;
                    string fullPath = Path.Combine(folder, fileName);
                    await File.WriteAllBytesAsync(fullPath, bytes);
                    return fullPath;
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[Download ERRO] tentativa {attempt} | {url} | {ex.Message}");
                    if (attempt < 3) await Task.Delay(800 * attempt);
                }
            }
            return null;
        }

        // ========================= LAUNCH =========================

        private void LaunchGame(string? identifier, string errorMsg)
        {
            if (string.IsNullOrEmpty(identifier)) return;
            try
            {
                var games = LoadGames();
                var game = games.FirstOrDefault(g => g.Path == identifier || g.LaunchUrl == identifier);

                if (game != null)
                {
                    game.LastPlayed = DateTime.Now;
                    SaveGames(games);
                    LoadGamesIntoUI();

                    Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "updateFeaturedCard",
                        tab = "games",
                        id = identifier
                    })));

                    Process? launched = null;

                    if (!string.IsNullOrWhiteSpace(game.LaunchUrl) &&
                        game.LaunchUrl.StartsWith("goggalaxy://", StringComparison.OrdinalIgnoreCase))
                    {
                        string gogClientPath = "";
                        using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\GOG.com\GalaxyClient\paths"))
                            gogClientPath = (key?.GetValue("client") as string ?? "").Replace("\"", "").Trim();

                        string gameId = game.LaunchUrl.Replace("goggalaxy://launch/", "").Trim();

                        if (File.Exists(gogClientPath))
                        {
                            launched = Process.Start(new ProcessStartInfo
                            {
                                FileName = gogClientPath,
                                Arguments = $"/command=launch /gameId={gameId}",
                                UseShellExecute = true
                            });
                        }
                        else
                        {
                            launched = Process.Start(new ProcessStartInfo(game.LaunchUrl) { UseShellExecute = true });
                        }
                    }
                    else if (!string.IsNullOrWhiteSpace(game.LaunchUrl) &&
                                                 game.LaunchUrl.StartsWith("riot:", StringComparison.OrdinalIgnoreCase))
                    {
                        string cmd = game.LaunchUrl.Substring(5).Trim();
                        string exePath = "";
                        string args = "";

                        // Separa o Path do Executável dos Argumentos (Com Aspas)
                        if (cmd.StartsWith("\""))
                        {
                            int endQuote = cmd.IndexOf("\"", 1);
                            if (endQuote > 0)
                            {
                                exePath = cmd.Substring(1, endQuote - 1);
                                args = cmd.Substring(endQuote + 1).Trim();
                            }
                        }
                        // Separa o Path (Sem Aspas)
                        else
                        {
                            int exeIndex = cmd.IndexOf(".exe", StringComparison.OrdinalIgnoreCase);
                            if (exeIndex > 0)
                            {
                                exePath = cmd.Substring(0, exeIndex + 4).Trim();
                                args = cmd.Substring(exeIndex + 4).Trim();
                            }
                        }

                        if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
                        {
                            launched = Process.Start(new ProcessStartInfo
                            {
                                FileName = exePath,
                                Arguments = args,
                                UseShellExecute = true,
                                WorkingDirectory = Path.GetDirectoryName(exePath)
                            });
                        }
                    }
                    else if (!string.IsNullOrWhiteSpace(game.LaunchUrl))
                    {
                        EnsureLauncherRunning(game.LaunchUrl);
                        launched = Process.Start(new ProcessStartInfo(game.LaunchUrl) { UseShellExecute = true });
                    }
                    else if (File.Exists(game.Path))
                    {
                        launched = Process.Start(new ProcessStartInfo
                        {
                            FileName = game.Path,
                            UseShellExecute = true,
                            WorkingDirectory = Path.GetDirectoryName(game.Path)
                        });
                    }

                    if (launched != null) WatchAndRefocus(launched);
                }
            }
            catch (Exception ex) { System.Windows.MessageBox.Show(errorMsg + ex.Message); }
        }

        private void EnsureLauncherRunning(string launchUrl)
        {
            try
            {
                string processName = "";
                string exePath = "";

                if (launchUrl.StartsWith("steam://", StringComparison.OrdinalIgnoreCase))
                {
                    processName = "steam";
                    using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam"))
                        exePath = key?.GetValue("SteamExe") as string ?? "";

                    if (!string.IsNullOrEmpty(exePath) && !exePath.Contains(@"\"))
                    {
                        using var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
                        var installPath = key?.GetValue("SteamPath") as string;
                        if (!string.IsNullOrEmpty(installPath))
                            exePath = Path.Combine(installPath, "steam.exe");
                    }
                }
                else if (launchUrl.StartsWith("com.epicgames.launcher://", StringComparison.OrdinalIgnoreCase))
                {
                    processName = "EpicGamesLauncher";
                    using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\EpicGames\Unreal Engine"))
                    {
                        string? installRoot = key?.GetValue("INSTALLS") as string;
                        if (!string.IsNullOrEmpty(installRoot))
                            exePath = Path.Combine(installRoot, "Launcher", "Portal", "Binaries", "Win64", "EpicGamesLauncher.exe");
                    }

                    if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
                    {
                        using var keyUn = Registry.LocalMachine.OpenSubKey(
                            @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\EpicGamesLauncher");
                        exePath = keyUn?.GetValue("DisplayIcon") as string ?? "";
                    }
                }
                else if (launchUrl.StartsWith("goggalaxy://", StringComparison.OrdinalIgnoreCase))
                {
                    processName = "GalaxyClient";
                    using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\GOG.com\GalaxyClient\paths");
                    if (key != null) exePath = key.GetValue("client") as string ?? "";
                }

                if (string.IsNullOrEmpty(processName)) return;

                if (Process.GetProcessesByName(processName).Length == 0 && !string.IsNullOrEmpty(exePath))
                {
                    exePath = exePath.Split(',')[0].Replace("\"", "").Trim();
                    if (File.Exists(exePath))
                    {
                        Process.Start(new ProcessStartInfo(exePath)
                        {
                            UseShellExecute = true,
                            WindowStyle = ProcessWindowStyle.Minimized
                        });
                        System.Threading.Thread.Sleep(3000);
                    }
                }
            }
            catch (Exception ex) { Debug.WriteLine("Erro ao garantir launcher: " + ex.Message); }
        }

        // ========================= GAMES DB =========================

        private void SaveGames(List<GameModel> games)
        {
            File.WriteAllText(gamesFile, JsonSerializer.Serialize(games,
                new JsonSerializerOptions { WriteIndented = true }));
            File.WriteAllText(Path.Combine(dataFolder, "games.json"), JsonSerializer.Serialize(games,
                new JsonSerializerOptions { WriteIndented = true }));
        }

        private List<GameModel> LoadGames()
        {
            if (!File.Exists(gamesFile)) return new List<GameModel>();
            string json = File.ReadAllText(gamesFile);
            return JsonSerializer.Deserialize<List<GameModel>>(json) ?? new List<GameModel>();
        }

        private void LoadGamesIntoUI()
        {
            var allGames = LoadGames();
            if (allGames.Count == 0) return;

            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"clearGamesGrid\"}");
            var featured = allGames.OrderByDescending(g => g.LastPlayed).FirstOrDefault();

            if (featured != null)
            {
                SendGameToUI(featured, isFeatured: true);

                var others = allGames.Where(g => g.Path != featured.Path || g.LaunchUrl != featured.LaunchUrl).ToList();

                var sortedOthers = others
                    .OrderByDescending(g => (DateTime.Now - g.DateAdded).TotalHours < 48)
                    .ThenByDescending(g => g.LastPlayed)
                    .ThenByDescending(g => g.DateAdded)
                    .Take(11)
                    .ToList();

                foreach (var game in sortedOthers)
                {
                    SendGameToUI(game, isFeatured: false);
                }
            }
        }

        private void SendGameToUI(GameModel game, bool isFeatured = false)
        {
            var data = new
            {
                type = "newGame",
                name = game.Name,
                path = game.Path,
                launchUrl = game.LaunchUrl,
                imageData = game.GridImage,
                staticImageData = game.GridStaticImage,
                horizontalImage = game.GridHorizontalImage,
                staticHorizontalImage = game.GridHorizontalStaticImage,
                hero = game.HeroImage,
                staticHero = game.HeroStaticImage,
                logo = game.LogoImage,
                staticLogo = game.LogoStaticImage,
                isFeatured = isFeatured,
                isNew = (DateTime.Now - game.DateAdded).TotalHours < 48
            };
            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(data));
        }

        // ========================= HELPERS =========================

        private string? GetGameNameFromFile(string exePath)
        {
            try
            {
                FileVersionInfo fi = FileVersionInfo.GetVersionInfo(exePath);
                if (!string.IsNullOrWhiteSpace(fi.ProductName)) return fi.ProductName;
                if (!string.IsNullOrWhiteSpace(fi.FileDescription)) return fi.FileDescription;
            }
            catch { }
            return null;
        }

        private bool IsSystemComponent(string name, RegistryKey key)
        {
            var nameLower = name.ToLower();
            string[] blacklist =
            {
                "microsoft .net", "visual c++", "windows driver", "update for",
                "redistributable", "sdk", "library", "directx", "web-deploy",
                "security update", "language pack", "kb", "microsoft windows"
            };
            if (blacklist.Any(term => nameLower.Contains(term))) return true;
            if (Convert.ToInt32(key.GetValue("SystemComponent") ?? 0) == 1) return true;
            if (key.GetValue("DisplayIcon") == null && key.GetValue("InstallLocation") == null) return true;
            return false;
        }

        private string GetAppFolder(RegistryKey key)
        {
            var location = key.GetValue("InstallLocation") as string;
            if (!string.IsNullOrWhiteSpace(location) && Directory.Exists(location)) return location;

            var icon = key.GetValue("DisplayIcon") as string;
            if (!string.IsNullOrWhiteSpace(icon))
            {
                var path = icon.Split(',')[0].Replace("\"", "").Trim();
                if (File.Exists(path)) return Path.GetDirectoryName(path) ?? "";
                if (Directory.Exists(path)) return path;
            }
            return "";
        }

        private string ExtractIcon(string filePath)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath)) return "";

                if (filePath.EndsWith(".ico", StringComparison.OrdinalIgnoreCase))
                {
                    using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                    var decoder = new System.Windows.Media.Imaging.IconBitmapDecoder(
                        fs,
                        System.Windows.Media.Imaging.BitmapCreateOptions.PreservePixelFormat,
                        System.Windows.Media.Imaging.BitmapCacheOption.OnLoad);

                    var bestFrame = decoder.Frames.OrderByDescending(f => f.PixelWidth).FirstOrDefault();
                    if (bestFrame != null)
                    {
                        var encoder = new System.Windows.Media.Imaging.PngBitmapEncoder();
                        encoder.Frames.Add(bestFrame);
                        using var ms = new MemoryStream();
                        encoder.Save(ms);
                        return Convert.ToBase64String(ms.ToArray());
                    }
                }

                using var icon = System.Drawing.Icon.ExtractAssociatedIcon(filePath);
                if (icon != null)
                {
                    using var ms = new MemoryStream();
                    using var bitmap = icon.ToBitmap();
                    bitmap.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
                    return Convert.ToBase64String(ms.ToArray());
                }
            }
            catch { }
            return "";
        }

        private int GetSourcePriority(string source) => source switch
        {
            "Steam" => 1,
            "Epic" => 1,
            "GOG" => 1,
            "Riot" => 1,
            "Folder" => 2,
            "Windows" => 3,
            _ => 4
        };

        private string NormalizeGameName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "";
            return new string(name.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        }

        private bool IsNameSimilar(string exeName, string folderName)
        {
            if (string.IsNullOrEmpty(exeName) || string.IsNullOrEmpty(folderName)) return false;
            string cleanExe = new string(exeName.Where(char.IsLetterOrDigit).ToArray()).ToLower();
            string cleanFolder = new string(folderName.Where(char.IsLetterOrDigit).ToArray()).ToLower();
            if (cleanExe.Length < 3) return cleanExe == cleanFolder;
            return cleanExe.Contains(cleanFolder) || cleanFolder.Contains(cleanExe);
        }
    }
}