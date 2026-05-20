using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Xml.Linq;

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
        public List<string> SharedWithUserIds { get; set; } = new();
        public string SharedWithUserName { get; set; } = "";
        public List<string> SharedWithUserNames { get; set; } = new();
        public bool IsSharedFromOtherUser { get; set; }
        public bool DisableGamepadControl { get; set; } = false;
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

        private string _vkbStrBackspace = "Apagar";
        private string _vkbStrEnter = "Enter";
        private string _vkbStrClose = "Fechar";
        private string _vkbStrShift = "Maiúsc";
        private string _vkbStrSpace = "Espaço";
        private string _vkbStrSym = "&123";
        private string _vkbStrAbc = "ABC";

        private string _extBtnTitle = "Adicionar extensão ao Doorpi";
        private string _extBtnSub = "Instalar via Doorpi Browser";
        private string _extToastTitle = "Doorpi";
        private string _extToastSub = "Extensão enviada ao Doorpi!";
        private string _extInstalledTitle = "Já instalada no Doorpi";
        private string _extInstalledSub = "Em uso no seu navegador";

        private static Dictionary<string, string> _latestUpdatesCache = new();
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
        private volatile int _mediaExeSessionId = 0;

        private readonly SemaphoreSlim _cacheLock = new SemaphoreSlim(1, 1);
        private DateTime _lastCacheBuilt = DateTime.MinValue;

        private bool _mainScreenMouseVisible = false;
        private POINT _lastKnownCursorPos;
        private System.Threading.Timer? _mouseIdleTimer;
        private System.Threading.Timer? _mousePollTimer;
        private const int MOUSE_IDLE_MS = 3000;



        [DllImport("Powrprof.dll", CharSet = CharSet.Auto, ExactSpelling = true)]
        private static extern bool SetSuspendState(bool hiberate, bool forceCritical, bool disableWakeEvent);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter,
    int X, int Y, int cx, int cy, uint uFlags);

        private static readonly IntPtr HWND_TOP = new IntPtr(0);
        private static readonly IntPtr HWND_BOTTOM = new IntPtr(1);
        private const uint SWP_NOMOVE = 0x0002;
        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOACTIVATE = 0x0010;

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        // ========================= DETECÇÃO DO CURSOR (I-BEAM) =========================
        [StructLayout(LayoutKind.Sequential)]
        private struct CURSORINFO
        {
            public int cbSize;
            public int flags;
            public IntPtr hCursor;
            public POINT ptScreenPos;
        }

        [DllImport("user32.dll")]
        private static extern bool GetCursorInfo(out CURSORINFO pci);

        [DllImport("user32.dll")]
        private static extern IntPtr LoadCursor(IntPtr hInstance, int lpCursorName);

        private const int IDC_IBEAM = 32513; // Código oficial da "barrinha de texto" no Windows
        private const int CURSOR_SHOWING = 0x00000001;

        // ========================= TECLADO TOUCH (COM INTEROP) =========================

        [System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
        [DllImport("user32.dll")] private static extern bool GetCursorPos(out POINT lpPoint);
        [DllImport("user32.dll")] private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
        [DllImport("xinput1_4.dll", EntryPoint = "XInputGetState")]
        private static extern int XInputGetState(int dwUserIndex, out XINPUT_STATE pState);
        [DllImport("xinput1_4.dll", EntryPoint = "#100")]
        private static extern int XInputGetStateSecret(int dwUserIndex, out XINPUT_STATE pState);
        [StructLayout(LayoutKind.Sequential)]
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

        // ========================= WIN32 SENDINPUT (NOVO MOUSE/TECLADO) =========================
        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT { public uint type; public InputUnion U; public static int Size => Marshal.SizeOf(typeof(INPUT)); }

        [StructLayout(LayoutKind.Explicit)]
        private struct InputUnion
        {
            [FieldOffset(0)] public MOUSEINPUT mi;
            [FieldOffset(0)] public KEYBDINPUT ki;
            [FieldOffset(0)] public HARDWAREINPUT hi;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

        [StructLayout(LayoutKind.Sequential)]
        private struct HARDWAREINPUT { public uint uMsg; public ushort wParamL; public ushort wParamH; }

        private const uint INPUT_MOUSE = 0;
        private const uint INPUT_KEYBOARD = 1;
        private const uint KEYEVENTF_KEYUP = 0x0002;

        private Process? _mediaExeProcess;
        private volatile bool _mediaExeWatcherPaused = false;
        private CancellationTokenSource? _mediaExeWatcherCts;
        private string _mediaExeCurrentUrl = "";
        private volatile bool _mediaExeGamepadDisabled = false;
        private volatile bool _doorpiSuspendedForMedia = false;
        private long _userShellInteractionUntil = 0;



        // ========================= CONSTRUTOR =========================
        private void ResetCursorForMainScreen()
        {
            EnsureCursorVisible();  // normaliza o contador do ShowCursor para 0
            EnsureCursorHidden();   // leva para -1 (escondido)
            _mainScreenMouseVisible = false;
            UpdateHoverStateInWebView(); // Mata o hover visual
        }
        public MainWindow()
        {
            this.Closing += (s, e) =>
            {
                StopMainScreenMouseWatch(); // Desliga os verificadores de mouse de segundo plano
                ReleaseAllStuckKeys();
                
            };
            InitializeComponent();


            this.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#020309"));
            webView.DefaultBackgroundColor = System.Drawing.Color.Transparent;
            SourceInitialized += (_, _) =>
            {
                _mainWindowHandle = new System.Windows.Interop.WindowInteropHelper(this).Handle;
            };
            this.Activated += (s, e) =>
            {

                if (DateTime.UtcNow.Ticks < Interlocked.Read(ref _returnFromExternalModeSuppressUntil))
                    return;

                if (_gameSessionActive)
                {
                    lock (_gameLaunchMonitorLock) { _gameLaunchMonitorCts?.Cancel(); }
                    ForceFocus();
                    return;
                }

                if (webView?.CoreWebView2 != null)
                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"windowFocused\"}");
            };

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
            Directory.CreateDirectory(Path.Combine(dataFolder, "intros"));
            Directory.CreateDirectory(Path.Combine(dataFolder, "users"));
            Directory.CreateDirectory(dataFolder);
            Directory.CreateDirectory(gridFolder);
            Directory.CreateDirectory(heroFolder);
            Directory.CreateDirectory(gridHorizontalFolder);
            Directory.CreateDirectory(logoFolder);
            Directory.CreateDirectory(iconCacheFolder);

            InitializeUserStorage();

            InitializeAsync();
            StartMainUiGamepadNavigation();
            EnsureCursorHidden();
            StartMainScreenMouseWatch();
            StartEmergencyEscapeWatchdog();
            StartGlobalFocusWatchdog();
            this.PreviewMouseDown += (s, e) =>
            {
                if (_systemControllerActive) ExitDesktopMode();
            };
            this.StateChanged += (s, e) =>
            {
                if (_systemControllerActive && this.WindowState != WindowState.Minimized)
                {
                    ExitDesktopMode();
                }
            };

        }
        private bool IsForegroundWindowNativeWindows()
        {
            try
            {
                IntPtr hwnd = GetForegroundWindow();
                if (hwnd == IntPtr.Zero) return false;

                GetWindowThreadProcessId(hwnd, out uint pid);
                var proc = Process.GetProcessById((int)pid);
                string name = proc.ProcessName.ToLowerInvariant();

                var nativeProcesses = new HashSet<string>
        {
            "explorer",                   // File Explorer, Desktop, Barra de Tarefas
            "shellexperiencehost",         // Menu Iniciar, Central de Ação
            "startmenuexperiencehost",     // Menu Iniciar (Win11)
            "searchhost",                 // Pesquisa do Windows (Win11)
            "searchapp",                  // Pesquisa do Windows (Win10)
            "systemsettings",             // Configurações
            "textinputhost",              // Hospedeiro de entrada de texto nativo
            "applicationframehost",       // Wrapper de apps UWP
            "lockapp",                    // Tela de bloqueio
            "cortana",
        };

                return nativeProcesses.Contains(name);
            }
            catch { return false; }
        }
        private void OpenNativeTouchKeyboard()
        {
            try
            {
                string textInputHost = Path.Combine(Environment.SystemDirectory, "TextInputHost.exe");
                string tabTip = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonProgramFiles),
                    "microsoft shared", "ink", "TabTip.exe");

                string? toLaunch = File.Exists(textInputHost) ? textInputHost
                                 : File.Exists(tabTip) ? tabTip
                                 : null;

                if (toLaunch != null)
                {
                    Process.Start(new ProcessStartInfo(toLaunch) { UseShellExecute = true });
                    Debug.WriteLine($"[TipTab] Teclado nativo aberto: {Path.GetFileName(toLaunch)}");
                }
                else
                {
                    Debug.WriteLine("[TipTab] Nenhum executável de teclado nativo encontrado.");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[TipTab] Falha: {ex.Message}");
            }
        }
        private bool IsCursorOnTextField()
        {
            try
            {
                var pci = new CURSORINFO();
                pci.cbSize = Marshal.SizeOf(typeof(CURSORINFO));

                if (GetCursorInfo(out pci) && pci.flags == CURSOR_SHOWING)
                {
                    // Carrega a "barrinha de texto" do sistema
                    IntPtr textCursorHandle = LoadCursor(IntPtr.Zero, IDC_IBEAM);

                    // Se o cursor atual for a barrinha, estamos em um campo de texto!
                    return pci.hCursor == textCursorHandle;
                }
            }
            catch { }
            return false;
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
                if (_mediaMouseActive) return;
                Dispatcher.Invoke(() =>
                {
                    if (!_mainScreenMouseVisible) return;
                    EnsureCursorHidden();
                    _mainScreenMouseVisible = false;
                    UpdateHoverStateInWebView();
                    SetCursorPos(-1, -1);
                });
            }, null, Timeout.Infinite, Timeout.Infinite);

            _mousePollTimer = new System.Threading.Timer(_ =>
            {
                if (_mediaMouseActive) return;
                if (!GetCursorPos(out var pt)) return;
                if (pt.X == _lastKnownCursorPos.X && pt.Y == _lastKnownCursorPos.Y) return;

                _lastKnownCursorPos = pt;
                Dispatcher.Invoke(() =>
                {
                    if (!_mainScreenMouseVisible)
                    {
                        EnsureCursorVisible();
                        _mainScreenMouseVisible = true;
                        UpdateHoverStateInWebView(); // Devolve o hover visual
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
           
            if (GetBootMode() == 2)
            {

                _ = Task.Run(async () =>
                {

                    await Task.Delay(1500);
                    Dispatcher.Invoke(() => EnsureExplorerIsRunningInBackstage());
                });
            }
            // Configura o navegador para permitir áudio automático (autoplay) sem interação do usuário
            var options = new CoreWebView2EnvironmentOptions("--autoplay-policy=no-user-gesture-required");
            var environment = await CoreWebView2Environment.CreateAsync(null, null, options);

            // Inicializa o WebView2 usando essas opções
            await webView.EnsureCoreWebView2Async(environment);
            string folderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");

            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "app.local", folderPath, CoreWebView2HostResourceAccessKind.Allow);
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "data.local", dataFolder, CoreWebView2HostResourceAccessKind.Allow);

            webView.CoreWebView2.Navigate("https://app.local/index.html");
            webView.CoreWebView2.WebMessageReceived += WebView_WebMessageReceived;
            webView.CoreWebView2.NavigationCompleted += (s, e) =>

            {
                UpdateHoverStateInWebView();
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

            // Configurações de Produção 


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

        private static string SafeIntroId(string value)
        {
            var clean = Regex.Replace(value ?? "", @"[^\p{L}\p{Nd}_-]+", "-").Trim('-').ToLowerInvariant();
            return string.IsNullOrWhiteSpace(clean) ? "intro" : clean;
        }

        private static string SafeBrowserProfileToken(string value)
        {
            var clean = Regex.Replace(value ?? "", @"[^\p{L}\p{Nd}]+", "_").Trim('_').ToLowerInvariant();
            return string.IsNullOrWhiteSpace(clean) ? "default" : clean;
        }

        private string GetUserProfileToken(string userId, IReadOnlyList<UserProfile>? users = null)
        {
            users ??= LoadUserProfiles();
            var user = users.FirstOrDefault(u => string.Equals(u.Id, userId, StringComparison.OrdinalIgnoreCase));
            return SafeBrowserProfileToken(!string.IsNullOrWhiteSpace(user?.Name) ? user.Name : userId);
        }

        private static string GetMediaAppKey(MediaAppModel app)
        {
            if (!string.IsNullOrWhiteSpace(app.Id)) return SafeBrowserProfileToken(app.Id);
            var source = !string.IsNullOrWhiteSpace(app.Url) ? app.Url : app.Name;
            if (string.IsNullOrWhiteSpace(source)) return "app";
            return Convert.ToHexString(System.Security.Cryptography.MD5.HashData(
                System.Text.Encoding.UTF8.GetBytes(source)))[..10].ToLowerInvariant();
        }

        private List<string> NormalizeSharedUserIds(MediaAppModel app)
        {
            var ids = new List<string>();
            if (app.SharedWithUserIds != null) ids.AddRange(app.SharedWithUserIds);
            if (!string.IsNullOrWhiteSpace(app.SharedWithUserId)) ids.Add(app.SharedWithUserId);
            return ids
                .Where(id => !string.IsNullOrWhiteSpace(id) && !string.Equals(id, app.OwnerUserId, StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(id => id, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private void ApplySharedUserNames(MediaAppModel app, IReadOnlyList<UserProfile>? users = null)
        {
            users ??= LoadUserProfiles();
            var ids = NormalizeSharedUserIds(app);
            app.SharedWithUserIds = ids;
            app.SharedWithUserId = ids.FirstOrDefault() ?? "";
            app.SharedWithUserNames = ids
                .Select(id => users.FirstOrDefault(u => string.Equals(u.Id, id, StringComparison.OrdinalIgnoreCase))?.Name ?? "")
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .ToList();
            app.SharedWithUserName = app.SharedWithUserNames.FirstOrDefault() ?? "";
        }

        private string GetBrowserProfileNameForMediaApp(MediaAppModel app)
        {
            var users = LoadUserProfiles();
            var owner = string.IsNullOrWhiteSpace(app.OwnerUserId) ? currentUserId : app.OwnerUserId;
            var appKey = GetMediaAppKey(app);

            if (app.ShareMode == "all")
                return SafePathSegment($"{GetUserProfileToken(owner, users)}_{appKey}_publico");

            if (app.ShareMode == "user" || app.IsSharedFromOtherUser)
            {
                var ids = NormalizeSharedUserIds(app);
                var participants = new[] { owner }
                    .Concat(ids)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(id => id, StringComparer.OrdinalIgnoreCase)
                    .Select(id => GetUserProfileToken(id, users));
                return SafePathSegment($"{string.Join("_", participants)}_{appKey}");
            }

            return SafePathSegment($"{owner}-{appKey}");
        }

        private string BrowserProfilesFolder =>
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "browser-profiles");

        private string GetBrowserProfilePath(string profileName) =>
            Path.Combine(BrowserProfilesFolder, profileName);

        private void CopyDirectoryContent(string source, string destination)
        {
            Directory.CreateDirectory(destination);
            foreach (var directory in Directory.GetDirectories(source, "*", SearchOption.AllDirectories))
            {
                Directory.CreateDirectory(directory.Replace(source, destination));
            }
            foreach (var file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
            {
                var dest = file.Replace(source, destination);
                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
                SafeCopy(file, dest);
            }
        }

        private void MoveOrCopyBrowserProfile(string sourceName, string destinationName)
        {
            if (string.Equals(sourceName, destinationName, StringComparison.OrdinalIgnoreCase)) return;
            var source = GetBrowserProfilePath(sourceName);
            var destination = GetBrowserProfilePath(destinationName);
            if (!Directory.Exists(source)) return;

            Directory.CreateDirectory(BrowserProfilesFolder);
            try
            {
                if (!Directory.Exists(destination))
                    Directory.Move(source, destination);
                else
                    CopyDirectoryContent(source, destination);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Sharing] Falha ao migrar perfil {sourceName} -> {destinationName}: {ex.Message}");
                try { CopyDirectoryContent(source, destination); } catch { }
            }
        }

        private IEnumerable<string> BrowserProfileCandidatesForApp(string appKey, IEnumerable<string> affectedUserIds)
        {
            var users = LoadUserProfiles();
            foreach (var userId in affectedUserIds.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                yield return SafePathSegment($"{userId}-{appKey}");
                yield return SafePathSegment($"{GetUserProfileToken(userId, users)}_{appKey}");
            }
            foreach (var user in users)
            {
                yield return SafePathSegment($"shared-{user.Id}-{appKey}");
                yield return SafePathSegment($"{GetUserProfileToken(user.Id, users)}_{appKey}_publico");
            }
        }

        private void DeleteBrowserProfiles(IEnumerable<string> profileNames, string exceptProfileName)
        {
            foreach (var profileName in profileNames.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(profileName) ||
                    string.Equals(profileName, exceptProfileName, StringComparison.OrdinalIgnoreCase))
                    continue;
                try
                {
                    var path = GetBrowserProfilePath(profileName);
                    if (Directory.Exists(path)) ForceDeleteDirectory(path);
                }
                catch (Exception ex) { Debug.WriteLine($"[Sharing] Falha ao remover perfil {profileName}: {ex.Message}"); }
            }
        }

        private void PrepareBrowserProfileForSharingChange(MediaAppModel before, MediaAppModel after)
        {
            try
            {
                var appKey = GetMediaAppKey(after);
                var beforeName = GetBrowserProfileNameForMediaApp(before);
                var afterName = GetBrowserProfileNameForMediaApp(after);
                var hadCurrentProfile = Directory.Exists(GetBrowserProfilePath(beforeName));
                MoveOrCopyBrowserProfile(beforeName, afterName);

                var legacyBeforeName = before.ShareMode == "private"
                    ? SafePathSegment($"{before.OwnerUserId}-{appKey}")
                    : SafePathSegment($"shared-{before.OwnerUserId}-{appKey}");
                if (!hadCurrentProfile)
                    MoveOrCopyBrowserProfile(legacyBeforeName, afterName);

                var users = LoadUserProfiles();
                var affected = after.ShareMode == "all"
                    ? users.Select(u => u.Id).ToList()
                    : new[] { after.OwnerUserId }.Concat(NormalizeSharedUserIds(after)).ToList();

                DeleteBrowserProfiles(BrowserProfileCandidatesForApp(appKey, affected), afterName);
                DeleteBrowserProfiles(new[] { beforeName, legacyBeforeName }, afterName);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Sharing] Falha ao preparar perfil de navegador: " + ex.Message);
            }
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

        private void SendUsersDataToUI()
        {
            var users = LoadUserProfiles().OrderByDescending(u => u.LastUsed).ToList();
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "usersData",
                    users,
                    currentUserId
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


            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"userSwitchStart\"}"));

            _ = Task.Run(async () =>
            {
                await Task.Delay(150);

                SetActiveUser(user, migrateLegacyFiles: false);
                RestartWatchers();
                await InitializeNativeAppsAsync(currentUserId, mediaFile, silent: true);

                Dispatcher.Invoke(() =>
                {
                    LoadCurrentUserIntoUI();
                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"userSwitchComplete\"}");
                });
            });
        }
        private Thread? _systemControllerThread;
        private volatile bool _systemControllerActive = false;
        private const uint KEYEVENTF_UNICODE = 0x0004;
        private DesktopVkbWindow _desktopVkb;

        private volatile bool _mediaExeModeActive = false;
        private Thread? _mediaExeThread;

        private const int MINIMUM_LAUNCH_ANIMATION_MS = 3000; 
        private DateTime _launchAnimationStartedUtc = DateTime.MinValue;
        private volatile bool _dialogModeActive = false;

        // ========================= FOCUS GUARD DE TRANSIÇÃO =========================


        /// <summary>
        /// Aguarda até que o tempo mínimo de animação de segurança tenha passado desde "gameLaunching".
        /// Garante que a tela de carregamento sempre seja exibida por pelo menos MINIMUM_LAUNCH_ANIMATION_MS.
        /// </summary>
        private async Task EnsureMinimumAnimationTimeAsync(CancellationToken token)
        {
            var elapsed = (DateTime.UtcNow - _launchAnimationStartedUtc).TotalMilliseconds;
            int remaining = MINIMUM_LAUNCH_ANIMATION_MS - (int)elapsed;
            if (remaining > 0)
            {
                try { await Task.Delay(remaining, token).ConfigureAwait(false); }
                catch (OperationCanceledException) { }
            }
        }
        // ========================= CONTROLE COMPARTILHADO (APP EXE & DIALOGS) =========================
        private void SharedGamepadControllerLoop(Func<bool> isActive, Action onExitCombo)
        {
            var sw = Stopwatch.StartNew();
            ushort prevButtons = 0;
            if (XInputGetStateSecret(0, out var initState) == 0)
                prevButtons = initState.Gamepad.wButtons;

            double remainderX = 0, remainderY = 0;

            bool isClicking = false, aWasOnTextField = false, aDragOccurred = false;
            double clickAccumX = 0, clickAccumY = 0;
            bool dragBrokeThreshold = false;
            bool ignoreNextBRelease = false;

            // ===== ESTADO DO DUPLO CLIQUE INTELIGENTE =====
            bool aDoubleClickPending = false;
            DateTime lastAReleaseTime = DateTime.MinValue;
            // ==============================================

            bool isHoldingX = false;
            DateTime xPressTime = DateTime.MinValue, lastBackspaceFired = DateTime.MinValue;

            var prevAnalogActive = new Dictionary<VkbHoldAction, bool> {
                { VkbHoldAction.MoveUp, false }, { VkbHoldAction.MoveDown, false },
                { VkbHoldAction.MoveLeft, false }, { VkbHoldAction.MoveRight, false },
                { VkbHoldAction.CursorLeft, false }, { VkbHoldAction.CursorRight, false },
                { VkbHoldAction.ToggleLayer, false }
            };

            while (isActive())
            {
                // Verifica se o tempo de tolerância do duplo clique expirou (Single Click confirmado)
                if (aDoubleClickPending && (DateTime.Now - lastAReleaseTime).TotalMilliseconds > 300)
                {
                    aDoubleClickPending = false;

                    // Como já garantimos que o clique original foi num campo de texto,
                    // abrimos o teclado independentemente de onde o mouse está agora.
                    OpenMediaExeVkb(autoPositioned: true);
                }

                try
                {
                    double dt = sw.Elapsed.TotalSeconds;
                    sw.Restart();
                    if (dt > 0.05) dt = 0.016;

                    if (XInputGetStateSecret(0, out var state) == 0)
                    {
                        var gp = state.Gamepad;
                        ushort btn = gp.wButtons;

                        bool Pressed(ushort m) => (btn & m) != 0 && (prevButtons & m) == 0;
                        bool Released(ushort m) => (btn & m) == 0 && (prevButtons & m) != 0;

                        // ── Start+Select ou botão Xbox = Voltar/Sair do modo ──
                        bool exitCombo = (btn & 0x0010) != 0 && (btn & 0x0020) != 0;
                        bool xboxBtn = (btn & 0x0400) != 0;
                        if (exitCombo || xboxBtn)
                        {
                            onExitCombo?.Invoke();
                            if (!isActive()) break;

                            prevButtons = btn;
                            Thread.Sleep(10);
                            continue;
                        }

                        // ── VKB aberto: redireciona analógico esquerdo para navegar ──
                        bool vkbIsOpen = false;
                        Dispatcher.Invoke(() => vkbIsOpen = _desktopVkb?.IsVisible == true);

                        if (vkbIsOpen)
                        {
                            double lx = gp.sThumbLX / 32767.0, ly = gp.sThumbLY / 32767.0;
                            const double DEAD = 0.6;
                            bool ltAnalog = gp.bLeftTrigger > 128;

                            void HandleHold(ushort mask, bool analogActive, VkbHoldAction action)
                            {
                                bool isDown = (btn & mask) != 0 || analogActive;
                                bool wasDown = (prevButtons & mask) != 0 || prevAnalogActive[action];
                                if (isDown && !wasDown) Dispatcher.Invoke(() => _desktopVkb.BeginHold(action));
                                else if (!isDown && wasDown) Dispatcher.Invoke(() => _desktopVkb.EndHold(action));
                                prevAnalogActive[action] = isDown;
                            }

                            HandleHold(0x0001, ly > DEAD, VkbHoldAction.MoveUp);
                            HandleHold(0x0002, ly < -DEAD, VkbHoldAction.MoveDown);
                            HandleHold(0x0004, lx < -DEAD, VkbHoldAction.MoveLeft);
                            HandleHold(0x0008, lx > DEAD, VkbHoldAction.MoveRight);
                            HandleHold(0x0100, false, VkbHoldAction.CursorLeft);
                            HandleHold(0x0200, false, VkbHoldAction.CursorRight);
                            HandleHold(0, ltAnalog, VkbHoldAction.ToggleLayer);

                            if (Pressed(0x1000)) Dispatcher.Invoke(() => _desktopVkb.BeginHold(VkbHoldAction.Press));
                            if (Released(0x1000)) Dispatcher.Invoke(() => _desktopVkb.EndHold(VkbHoldAction.Press));

                            // B fecha o VKB
                            if (Pressed(0x2000))
                            {
                                Dispatcher.Invoke(() => { _desktopVkb?.Close(); _desktopVkb = null; });
                                ignoreNextBRelease = true;
                            }

                            if (Pressed(0x8000)) SendUnicodeString(" ");  // Y = espaço
                            if (Pressed(0x0010)) SendVirtualKey(0x0D);    // Start = Enter
                            if (Pressed(0x0040)) Dispatcher.Invoke(() => _desktopVkb.ToggleShift()); // L3

                            // X = backspace com hold repeat
                            bool curX = (btn & 0x4000) != 0;
                            if (curX && !isHoldingX)
                            {
                                isHoldingX = true; xPressTime = DateTime.Now;
                                SendVirtualKey(0x08); lastBackspaceFired = DateTime.Now;
                            }
                            else if (curX && isHoldingX &&
                                     (DateTime.Now - xPressTime).TotalMilliseconds > 450 &&
                                     (DateTime.Now - lastBackspaceFired).TotalMilliseconds > 40)
                            {
                                SendVirtualKey(0x08); lastBackspaceFired = DateTime.Now;
                            }
                            else if (!curX) isHoldingX = false;
                        }
                        else
                        {
                            // ── MODO MOUSE ──────────────────────────────────────────────────

                            // Analógico esquerdo = mover mouse
                            double mlx = gp.sThumbLX / 32767.0;
                            double mly = gp.sThumbLY / 32767.0;
                            const double MDEAD = 0.15;
                            if (Math.Abs(mlx) < MDEAD) mlx = 0;
                            if (Math.Abs(mly) < MDEAD) mly = 0;

                            // Analógico direito = scroll vertical
                            double scrollY = gp.sThumbRY / 32767.0;
                            if (Math.Abs(scrollY) > 0.20)
                            {
                                int scroll = (int)(scrollY * 3000 * dt);
                                if (scroll != 0) SendMouse(0, 0, MOUSEEVENTF_WHEEL, (uint)scroll);
                            }

                            // A pressionado = botão esquerdo do mouse down
                            if (Pressed(0x1000))
                            {
                                IntPtr foregroundHwnd = GetForegroundWindow();
                                if (foregroundHwnd != IntPtr.Zero)
                                {
                                    FocusExternalWindow(foregroundHwnd);
                                }

                                aWasOnTextField = IsCursorOnTextField();
                                aDragOccurred = false; isClicking = true;
                                clickAccumX = 0; clickAccumY = 0; dragBrokeThreshold = false;
                                SendMouse(0, 0, MOUSEEVENTF_LEFTDOWN);
                            }

                            // Movimento do mouse
                            if (mlx != 0 || mly != 0)
                            {
                                const double BASE = 1800.0;
                                double cx = Math.Sign(mlx) * Math.Pow(Math.Abs(mlx), 2.2);
                                double cy = Math.Sign(mly) * Math.Pow(Math.Abs(mly), 2.2);
                                double mx = cx * BASE * dt + remainderX;
                                double my = -cy * BASE * dt + remainderY;
                                int dx = (int)mx, dy = (int)my;
                                remainderX = mx - dx; remainderY = my - dy;

                                if (dx != 0 || dy != 0)
                                {
                                    if (isClicking && !dragBrokeThreshold)
                                    {
                                        clickAccumX += dx; clickAccumY += dy;
                                        if (Math.Abs(clickAccumX) > 5 || Math.Abs(clickAccumY) > 5)
                                        {
                                            dragBrokeThreshold = true; aDragOccurred = true;
                                            SendMouse((int)clickAccumX, (int)clickAccumY, MOUSEEVENTF_MOVE);
                                        }
                                    }
                                    else
                                    {
                                        if (isClicking) aDragOccurred = true;
                                        SendMouse(dx, dy, MOUSEEVENTF_MOVE);
                                    }
                                }
                            }
                            else { remainderX = 0; remainderY = 0; }

                            // A solto = botão esquerdo up + tratamento Inteligente de IBEAM
                            if (Released(0x1000))
                            {
                                isClicking = false;
                                SendMouse(0, 0, 0x0004); // MOUSEEVENTF_LEFTUP

                                if (aWasOnTextField && !aDragOccurred && IsCursorOnTextField())
                                {
                                    if (aDoubleClickPending && (DateTime.Now - lastAReleaseTime).TotalMilliseconds <= 300)
                                    {
                                        // DUPLO CLIQUE CONFIRMADO!
                                        aDoubleClickPending = false;

                                        // Aguarda o Windows terminar de processar o duplo clique nativo (selecionar palavra) e abre o Menu de Contexto
                                        Task.Run(async () => {
                                            await Task.Delay(100);
                                            SendMouse(0, 0, 0x0008); // MOUSEEVENTF_RIGHTDOWN
                                            SendMouse(0, 0, 0x0010); // MOUSEEVENTF_RIGHTUP
                                        });
                                    }
                                    else
                                    {
                                        // PRIMEIRO CLIQUE: Aciona a contagem para abrir o VKB
                                        aDoubleClickPending = true;
                                        lastAReleaseTime = DateTime.Now;
                                    }
                                }

                                aWasOnTextField = false; aDragOccurred = false;
                            }

                            // B = Mouse Button 4 (voltar)
                            if (ignoreNextBRelease) { if ((btn & 0x2000) == 0) ignoreNextBRelease = false; }
                            else
                            {
                                if (Pressed(0x2000)) SendMouse(0, 0, MOUSEEVENTF_XDOWN, XBUTTON1);
                                if (Released(0x2000)) SendMouse(0, 0, MOUSEEVENTF_XUP, XBUTTON1);
                            }

                            // X (quadrado) = clique direito
                            if (Pressed(0x4000)) SendMouse(0, 0, MOUSEEVENTF_RIGHTDOWN);
                            if (Released(0x4000)) SendMouse(0, 0, MOUSEEVENTF_RIGHTUP);

                            // Y (triângulo) = abrir teclado virtual
                            if (Pressed(0x8000)) OpenMediaExeVkb(autoPositioned: false);

                            // LB/RB = navegar cursor em campos de texto
                            if (Pressed(0x0100)) SendVirtualKey(0x25); // cursor ←
                            if (Pressed(0x0200)) SendVirtualKey(0x27); // cursor →
                        }

                        prevButtons = btn;
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[SharedGamepadLoop] {ex.Message}"); }

                Thread.Sleep(10);
            }

            // GARANTIA ANTI-TRAVAMENTO DE MOUSE VIRTUAL
            if (isClicking)
            {
                SendMouse(0, 0, 0x0004); // MOUSEEVENTF_LEFTUP
            }
        }

        private void MediaExeControllerLoop(int sessionId)
        {
            SharedGamepadControllerLoop(
                () => _mediaExeModeActive,
                () =>
                {
                    if (_mediaExeSessionId != sessionId) return;

                    _mediaExeWatcherCts?.Cancel();
                    _mediaExeWatcherPaused = true;
                    Interlocked.Exchange(ref _returnFromExternalModeSuppressUntil,
                        DateTime.UtcNow.AddMilliseconds(800).Ticks);
                    _mediaExeModeActive = false;
                    _mediaExeProcess = null; // Encerra de fato a sessão
                    _mediaExeCurrentUrl = "";
                    _mediaExeGamepadDisabled = false;

                    SetCursorPos(0, 0);
                    
                    SendGameLaunchStatus("gameLaunchDone");
                    Dispatcher.Invoke(() =>
                    {
                        _desktopVkb?.Close();
                        _desktopVkb = null;
                        ResetCursorForMainScreen();
                        if (WindowState != WindowState.Maximized)
                            WindowState = WindowState.Maximized;
                        Activate();
                        webView?.Focus();
                        webView?.CoreWebView2?.ExecuteScriptAsync(
                            "window.isMediaAppActive = false; window.focusFeaturedCard?.();");
                    });
                }
            );
        }

        private void StartDialogControllerMode()
        {
            if (_dialogModeActive) return;
            _dialogModeActive = true;
            new Thread(() =>
            {
                SharedGamepadControllerLoop(
                    () => _dialogModeActive,
                    () =>
                    {
                        // Se pressionar o combo de sair durante o Dialog, enviamos ESC para fechá-lo
                        SendVirtualKey(0x1B); // VK_ESCAPE
                    }
                );
            })
            { IsBackground = true }.Start();
        }

        private void StopDialogControllerMode()
        {
            if (!_dialogModeActive) return;
            _dialogModeActive = false;
            
            Dispatcher.Invoke(() => {
                _desktopVkb?.Close();
                _desktopVkb = null;
            });
        }

        // Helper para abrir o VKB sem duplicar código
        private void OpenMediaExeVkb(bool autoPositioned)
        {
            Dispatcher.Invoke(() =>
            {
                if (_desktopVkb != null) return;

                _desktopVkb = new DesktopVkbWindow();
                _desktopVkb.SetLocalization(_vkbStrBackspace, _vkbStrEnter, _vkbStrClose,
                                            _vkbStrShift, _vkbStrSpace, _vkbStrSym, _vkbStrAbc);
                _desktopVkb.OnKeyPressed += txt =>
                {
                    if (txt == "BKSP") SendVirtualKey(0x08);
                    else if (txt == "ENTER") SendVirtualKey(0x0D);
                    else if (txt == "CURSOR_LEFT") SendVirtualKey(0x25);
                    else if (txt == "CURSOR_RIGHT") SendVirtualKey(0x27);
                    else SendUnicodeString(txt);
                };
                _desktopVkb.OnCloseRequested += () => { _desktopVkb?.Close(); _desktopVkb = null; };

                if (autoPositioned) { GetCursorPos(out var pt); _desktopVkb.AutoPosition(pt.Y); }
                else _desktopVkb.SetFixedPosition();

                _desktopVkb.Show();
            });
        }
        // Retorna a primeira janela visível de um processo por PID
        private IntPtr FindVisibleWindowForProcess(int pid)
        {
            IntPtr result = IntPtr.Zero;
            EnumWindows((hWnd, _) =>
            {
                GetWindowThreadProcessId(hWnd, out uint wpid);
                if ((int)wpid == pid && IsWindowVisible(hWnd))
                {
                    // Verifica se a janela tem um título (janelas de sistema/renderização Electron geralmente não têm)
                    int length = GetWindowTextLength(hWnd);
                    if (length > 0)
                    {
                        result = hWnd;
                        return false; // Achamos a janela real, para a busca
                    }
                }
                return true;
            }, IntPtr.Zero);
            return result;
        }

        // Varre os processos em execução e retorna o que corresponde ao exePath
        private Process? FindRunningProcessForExe(string exePath)
        {
            if (string.IsNullOrWhiteSpace(exePath) || !File.Exists(exePath)) return null;
            try
            {
                string fullPath = Path.GetFullPath(exePath);
                string name = Path.GetFileNameWithoutExtension(exePath);
                var processes = Process.GetProcessesByName(name);

                // Primeiro tenta achar um processo que corresponda ao caminho exato e tenha janela visível
                foreach (var p in processes)
                {
                    try
                    {
                        if (PathsEqual(SafeProcessPath(p), fullPath) && FindVisibleWindowForProcess(p.Id) != IntPtr.Zero)
                            return p;
                    }
                    catch { }
                }

                // Se não achou com janela visível, retorna qualquer um com o caminho exato
                foreach (var p in processes)
                {
                    try { if (PathsEqual(SafeProcessPath(p), fullPath)) return p; }
                    catch { }
                }
            }
            catch { }
            return null;
        }
        private async Task TryMaximizeExternalWindowAsync(Process proc, string mediaUrl, CancellationToken token = default)
        {
            for (int i = 0; i < 600; i++)
            {
                // CRÍTICO: Para imediatamente se saímos do modo (botão Xbox)
                if (token.IsCancellationRequested || !_mediaExeModeActive) return;

                await Task.Delay(200);
                try
                {
                    Process? targetProc = proc;
                    if (SafeHasExited(targetProc))
                    {
                        targetProc = FindRunningProcessForExe(mediaUrl);
                        if (targetProc == null) continue;
                    }

                    IntPtr hwnd = targetProc.MainWindowHandle;
                    if (hwnd == IntPtr.Zero) hwnd = FindVisibleWindowForProcess(targetProc.Id);

                    if (hwnd != IntPtr.Zero)
                    {
                        if (token.IsCancellationRequested || !_mediaExeModeActive) return;

                        // APENAS FOQUE E RESTAURE! Removido o "ShowWindow(hwnd, 3)" que quebrava o Discord.
                        // Deixe o app lidar com o próprio tamanho de janela.
                        FocusExternalWindow(hwnd);
                        return;
                    }
                }
                catch { }
            }
        }
        private void StartMediaExeWatcher(Process proc, string mediaUrl, string appName, CancellationToken token)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    string exeName = Path.GetFileNameWithoutExtension(mediaUrl);
                    bool hasStarted = false;
                    DateTime startTime = DateTime.UtcNow;

                    // ==============================================================
                    // FASE 1: AGUARDANDO O APP ABRIR (Alta Tolerância - Até 3 Minutos)
                    // ==============================================================
                    while (!hasStarted && !token.IsCancellationRequested)
                    {
                        if (_mediaExeWatcherPaused) { await Task.Delay(500, token); continue; }

                        if ((DateTime.UtcNow - startTime).TotalMinutes > 3)
                        {
                            SendGameLaunchStatus("gameLaunchFailed", appName, "", "", "timeout");
                            ReturnToDoorpiFromMedia();
                            return;
                        }

                        IntPtr activeHwnd = IntPtr.Zero;
                        var processes = Process.GetProcessesByName(exeName);

                        foreach (var p in processes)
                        {
                            IntPtr h = FindVisibleWindowForProcess(p.Id);
                            if (h != IntPtr.Zero) { activeHwnd = h; break; }
                        }

                        // DEPOIS:
                        if (activeHwnd != IntPtr.Zero)
                        {
                            hasStarted = true;
                            SendGameLaunchStatus("gameLaunchReady"); // Atualiza o texto na UI

                            // Garante o tempo mínimo de animação de segurança ANTES de minimizar o Doorpi.
                            // Isso previne que o Windows roube o foco para a taskbar durante transições rápidas.
                            await EnsureMinimumAnimationTimeAsync(token);
                            if (token.IsCancellationRequested || !_mediaExeModeActive) return;

                            // Tempo extra para o app renderizar completamente antes de esconder o Doorpi
                            await Task.Delay(300, token);
                            if (token.IsCancellationRequested || !_mediaExeModeActive) return;

                            Dispatcher.Invoke(() => WindowState = WindowState.Minimized);
                            SendGameLaunchStatus("gameLaunchDone"); // Para o guard e remove a tela de carregamento
                            break; // Avança para a Fase 2
                        }

                        await Task.Delay(500, token);
                    }

                    // ==============================================================
                    // FASE 2: APP EM EXECUÇÃO (Retorno Imediato ao Fechar)
                    // ==============================================================
                    int missingCount = 0;
                    while (!token.IsCancellationRequested)
                    {
                        if (_mediaExeWatcherPaused) { await Task.Delay(500, token); continue; }

                        IntPtr activeHwnd = IntPtr.Zero;
                        var processes = Process.GetProcessesByName(exeName);

                        foreach (var p in processes)
                        {
                            IntPtr h = FindVisibleWindowForProcess(p.Id);
                            if (h != IntPtr.Zero) { activeHwnd = h; break; }
                        }

                        if (activeHwnd == IntPtr.Zero)
                        {
                            missingCount++;
                            // 3 verificações de 300ms = 900ms para perceber que fechou (Retorno quase instantâneo)
                            if (missingCount >= 3)
                            {
                                ReturnToDoorpiFromMedia();
                                return;
                            }
                        }
                        else
                        {
                            missingCount = 0;
                        }

                        await Task.Delay(300, token);
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[Watcher] {ex.Message}"); }
            });
        }

        // Helper para centralizar a volta ao Doorpi

        private void ReturnToDoorpiFromMedia()
        {
            int capturedSession = _mediaExeSessionId;

            _mediaExeModeActive = false;
            _mediaExeProcess = null;
            _mediaExeCurrentUrl = "";
            _mediaExeGamepadDisabled = false;
            _doorpiSuspendedForMedia = false;

            Interlocked.Exchange(ref _returnFromExternalModeSuppressUntil,
                DateTime.UtcNow.AddMilliseconds(500).Ticks);
           
            SendGameLaunchStatus("gameLaunchDone");

            Dispatcher.BeginInvoke(() =>
            {
                // Se uma nova sessão foi iniciada entre a detecção de fechamento e este callback,
                // não interfira com ela
                if (_mediaExeSessionId != capturedSession) return;

                _desktopVkb?.Close();
                _desktopVkb = null;
                ResetCursorForMainScreen();
                if (WindowState != WindowState.Maximized) WindowState = WindowState.Maximized;
                Activate();
                ForceFocus();
                webView?.CoreWebView2?.ExecuteScriptAsync(
                    "window.isMediaAppActive = false; window.focusFeaturedCard?.();");
            });
        }
        private void MinimizeAllWindowsExcept(IntPtr excludeHwnd)
        {
            IntPtr doorpiHwnd = _mainWindowHandle;
            IntPtr shellWindow = GetShellWindow(); // Desktop/Barra de tarefas

            EnumWindows((hWnd, _) =>
            {
                // Não minimiza: o próprio Doorpi, o novo App, ou a área de trabalho/barra de tarefas
                if (hWnd == excludeHwnd || hWnd == doorpiHwnd || hWnd == shellWindow)
                    return true;

                if (IsWindowVisible(hWnd))
                {
                    // Verifica se a janela tem título (evita minimizar processos invisíveis do sistema)
                    if (GetWindowTextLength(hWnd) > 0)
                    {
                        // SW_MINIMIZE = 6
                        ShowWindow(hWnd, 6);
                    }
                }
                return true;
            }, IntPtr.Zero);
        }
        private void EnterMediaExeMode(Process proc, string url, string appName, string heroImg, string gridImg)
        {
            if (_mediaExeModeActive) return;

            _mediaExeWatcherCts?.Cancel();
            _mediaExeWatcherCts = new CancellationTokenSource();

            int sessionId = Interlocked.Increment(ref _mediaExeSessionId);

            _mediaExeProcess = proc;
            _mediaExeCurrentUrl = url;
            _mediaExeModeActive = true;
            _mediaExeWatcherPaused = false;

            Dispatcher.Invoke(() =>
            {
                while (ShowCursor(true) < 0) { }
                _mainScreenMouseVisible = true;
                UpdateHoverStateInWebView(); // Devolve controle do hover se for Mídia
            });

            SendGameLaunchStatus("gameLaunching", appName, heroImg, gridImg);
            _ = TryMaximizeExternalWindowAsync(proc, url, _mediaExeWatcherCts.Token);
            StartMediaExeWatcher(proc, url, appName, _mediaExeWatcherCts.Token);

            _mediaExeThread = new Thread(() => MediaExeControllerLoop(sessionId)) { IsBackground = true };
            _mediaExeThread.Start();
        }
        private void ExitMediaExeMode()
        {
            if (!_mediaExeModeActive && _mediaExeProcess == null) return;
            _mediaExeWatcherCts?.Cancel();
            _mediaExeWatcherPaused = true;
            _mediaExeModeActive = false;
            _mediaExeProcess = null;
            _mediaExeCurrentUrl = "";
            _mediaExeGamepadDisabled = false;
            _doorpiSuspendedForMedia = false;

           
            Dispatcher.Invoke(() =>
            {
                _desktopVkb?.Close();
                _desktopVkb = null;
                ResetCursorForMainScreen();
            });
        }
        private void SendUnicodeString(string text)
        {
            var inputs = new List<INPUT>();
            foreach (char c in text)
            {
                // Pressionar a tecla
                var down = new INPUT { type = INPUT_KEYBOARD };
                down.U.ki = new KEYBDINPUT { wScan = c, dwFlags = KEYEVENTF_UNICODE };
                inputs.Add(down);

                // Soltar a tecla
                var up = new INPUT { type = INPUT_KEYBOARD };
                up.U.ki = new KEYBDINPUT { wScan = c, dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP };
                inputs.Add(up);
            }
            SendInput((uint)inputs.Count, inputs.ToArray(), INPUT.Size);
        }
        private void EnterDesktopMode()
        {
            // Se estávamos no topo protegendo o fundo, liberamos a prioridade
            if (GetBootMode() == 2) this.Topmost = false;

            // Garante que o explorer esteja vivo para o usuário usar o PC
            EnsureExplorerIsRunningInBackstage();

            // 1. Minimiza o App
            WindowState = WindowState.Minimized;

            // 2. Calcula o meio exato do monitor
            int centerX = (int)(SystemParameters.PrimaryScreenWidth / 2);
            int centerY = (int)(SystemParameters.PrimaryScreenHeight / 2);

            // 3. Joga o ponteiro do mouse fisicamente para o centro
            SetCursorPos(centerX, centerY);

            // 4. Inicia a leitura do controle
            StartSystemControllerMode();
        }

        private void ExitDesktopMode()
        {
            if (!_systemControllerActive) return;

            Interlocked.Exchange(ref _returnFromExternalModeSuppressUntil,
                DateTime.UtcNow.AddMilliseconds(800).Ticks);
            _systemControllerActive = false;
           

            Dispatcher.Invoke(() => {
                _desktopVkb?.Close();
                _desktopVkb = null;

                WindowState = WindowState.Maximized;

                if (GetBootMode() == 2) this.Topmost = true;

                Activate();
                ForceFocus();
            });
        }
        private void StartSystemControllerMode()
        {
            if (_systemControllerActive) return;
            _systemControllerActive = true;
            _systemControllerThread = new Thread(SystemControllerLoop) { IsBackground = true };
            _systemControllerThread.Start();
        }

        private void StopSystemControllerMode()
        {
            _systemControllerActive = false;
           

        }

        private void SystemControllerLoop()
        {
            var sw = Stopwatch.StartNew();
            ushort prevButtons = 0;

            if (XInputGetStateSecret(0, out var initialState) == 0)
            {
                prevButtons = initialState.Gamepad.wButtons;
            }

            double speedMult = 1.0;
            double remainderX = 0, remainderY = 0;

            bool aWasOnTextField = false;
            bool aDragOccurred = false;

            // ===== ESTADO DO DUPLO CLIQUE INTELIGENTE =====
            bool aDoubleClickPending = false;
            DateTime lastAReleaseTime = DateTime.MinValue;
            // ==============================================

            bool isHoldingX = false;
            DateTime xPressTime = DateTime.MinValue;
            DateTime lastBackspaceFired = DateTime.MinValue;

            var prevAnalogActive = new Dictionary<VkbHoldAction, bool> {
                { VkbHoldAction.MoveUp, false },
                { VkbHoldAction.MoveDown, false },
                { VkbHoldAction.MoveLeft, false },
                { VkbHoldAction.MoveRight, false },
                { VkbHoldAction.CursorLeft, false },
                { VkbHoldAction.CursorRight, false },
                { VkbHoldAction.ToggleLayer, false }
            };

            bool ignoreNextBRelease = false;
            bool isClicking = false;
            double clickAccumX = 0;
            double clickAccumY = 0;
            bool dragBrokeThreshold = false;

            while (_systemControllerActive)
            {
                // Verifica se o tempo de tolerância do duplo clique expirou (Single Click confirmado)
                if (aDoubleClickPending && (DateTime.Now - lastAReleaseTime).TotalMilliseconds > 300)
                {
                    aDoubleClickPending = false;

                    // Sem re-checar se ainda é um IBEAM. Se passou de 300ms, aciona o teclado.
                    if (IsForegroundWindowNativeWindows())
                    {
                        OpenNativeTouchKeyboard();
                    }
                    else
                    {
                        Dispatcher.Invoke(() =>
                        {
                            if (_desktopVkb == null)
                            {
                                _desktopVkb = new DesktopVkbWindow();
                                _desktopVkb.SetLocalization(_vkbStrBackspace, _vkbStrEnter, _vkbStrClose, _vkbStrShift, _vkbStrSpace, _vkbStrSym, _vkbStrAbc);

                                _desktopVkb.OnKeyPressed += (txt) =>
                                {
                                    if (txt == "BKSP") SendVirtualKey(0x08);
                                    else if (txt == "ENTER") SendVirtualKey(0x0D);
                                    else if (txt == "CURSOR_LEFT") SendVirtualKey(0x25);
                                    else if (txt == "CURSOR_RIGHT") SendVirtualKey(0x27);
                                    else SendUnicodeString(txt);
                                };
                                _desktopVkb.OnCloseRequested += () =>
                                {
                                    _desktopVkb?.Close();
                                    _desktopVkb = null;
                                };

                                GetCursorPos(out var pt);
                                _desktopVkb.AutoPosition(pt.Y);
                                _desktopVkb.Show();
                            }
                        });
                    }
                }

                try
                {
                    double dt = sw.Elapsed.TotalSeconds;
                    sw.Restart();
                    if (dt > 0.05) dt = 0.016;

                    if (XInputGetStateSecret(0, out var state) == 0)
                    {
                        var gp = state.Gamepad;
                        ushort btn = gp.wButtons;

                        bool Pressed(ushort m) => (btn & m) != 0 && (prevButtons & m) == 0;
                        bool Released(ushort m) => (btn & m) == 0 && (prevButtons & m) != 0;

                        bool vkbIsOpen = false;
                        Dispatcher.Invoke(() => vkbIsOpen = _desktopVkb != null && _desktopVkb.IsVisible);

                        if (vkbIsOpen)
                        {
                            double lx = gp.sThumbLX / 32767.0;
                            double ly = gp.sThumbLY / 32767.0;
                            const double DEAD = 0.6;

                            bool upAnalog = ly > DEAD;
                            bool downAnalog = ly < -DEAD;
                            bool leftAnalog = lx < -DEAD;
                            bool rightAnalog = lx > DEAD;
                            bool ltAnalog = gp.bLeftTrigger > 128;

                            void HandleHold(ushort btnMask, bool isAnalogActive, VkbHoldAction action)
                            {
                                bool isDown = (btn & btnMask) != 0 || isAnalogActive;
                                bool wasDown = (prevButtons & btnMask) != 0 || prevAnalogActive[action];

                                if (isDown && !wasDown) Dispatcher.Invoke(() => _desktopVkb.BeginHold(action));
                                else if (!isDown && wasDown) Dispatcher.Invoke(() => _desktopVkb.EndHold(action));

                                prevAnalogActive[action] = isDown;
                            }

                            HandleHold(0x0001, upAnalog, VkbHoldAction.MoveUp);
                            HandleHold(0x0002, downAnalog, VkbHoldAction.MoveDown);
                            HandleHold(0x0004, leftAnalog, VkbHoldAction.MoveLeft);
                            HandleHold(0x0008, rightAnalog, VkbHoldAction.MoveRight);

                            HandleHold(0x0100, false, VkbHoldAction.CursorLeft);
                            HandleHold(0x0200, false, VkbHoldAction.CursorRight);
                            HandleHold(0, ltAnalog, VkbHoldAction.ToggleLayer);

                            if (Pressed(0x1000)) Dispatcher.Invoke(() => _desktopVkb.BeginHold(VkbHoldAction.Press));
                            if (Released(0x1000)) Dispatcher.Invoke(() => _desktopVkb.EndHold(VkbHoldAction.Press));

                            if (Pressed(0x2000))
                            {
                                Dispatcher.Invoke(() =>
                                {
                                    _desktopVkb?.Close();
                                    _desktopVkb = null;
                                });
                                ignoreNextBRelease = true;
                            }

                            if (Pressed(0x8000)) SendUnicodeString(" ");
                            if (Pressed(0x0010)) SendVirtualKey(0x0D);
                            if (Pressed(0x0040)) Dispatcher.Invoke(() => _desktopVkb.ToggleShift());
                            if (Pressed(0x0080)) Dispatcher.Invoke(() => _desktopVkb.TogglePosition());

                            bool currentX = (btn & 0x4000) != 0;
                            if (currentX && (prevButtons & 0x4000) == 0)
                            {
                                isHoldingX = true; xPressTime = DateTime.Now;
                                SendVirtualKey(0x08); lastBackspaceFired = DateTime.Now;
                            }
                            else if (currentX && isHoldingX)
                            {
                                if ((DateTime.Now - xPressTime).TotalMilliseconds > 450)
                                {
                                    if ((DateTime.Now - lastBackspaceFired).TotalMilliseconds > 40)
                                    {
                                        SendVirtualKey(0x08); lastBackspaceFired = DateTime.Now;
                                    }
                                }
                            }
                            else if (!currentX) isHoldingX = false;

                            prevButtons = btn;
                            Thread.Sleep(10);
                            continue;
                        }

                        // =========================================================
                        // MODO MOUSE (FORA DO TECLADO)
                        // =========================================================

                        double mlx = gp.sThumbRX / 32767.0;
                        double mly = gp.sThumbRY / 32767.0;
                        const double MDEAD = 0.15;
                        if (Math.Abs(mlx) < MDEAD) mlx = 0;
                        if (Math.Abs(mly) < MDEAD) mly = 0;

                        int deltaX = 0, deltaY = 0;

                        // GATILHO (A) - PRESSIONOU
                        if (Pressed(0x1000))
                        {
                            aWasOnTextField = IsCursorOnTextField();
                            aDragOccurred = false;

                            isClicking = true;
                            clickAccumX = 0; clickAccumY = 0; dragBrokeThreshold = false;

                            SendMouse(0, 0, MOUSEEVENTF_LEFTDOWN);
                        }

                        bool rbHeld = (btn & 0x0200) != 0;

                        if (rbHeld)
                        {
                            double scrollY = gp.sThumbRY / 32767.0;
                            if (Math.Abs(scrollY) > MDEAD)
                            {
                                int scroll = (int)(scrollY * 3000 * dt);
                                if (scroll != 0) SendMouse(0, 0, MOUSEEVENTF_WHEEL, (uint)scroll);
                            }
                            remainderX = 0; remainderY = 0; mlx = 0; mly = 0;
                        }
                        else
                        {
                            mlx = gp.sThumbRX / 32767.0; mly = gp.sThumbRY / 32767.0;
                            if (Math.Abs(mlx) < MDEAD) mlx = 0;
                            if (Math.Abs(mly) < MDEAD) mly = 0;

                            if (mlx != 0 || mly != 0)
                            {
                                const double BASE_SENSITIVITY = 1800.0;
                                double curveX = Math.Sign(mlx) * Math.Pow(Math.Abs(mlx), 2.2);
                                double curveY = Math.Sign(mly) * Math.Pow(Math.Abs(mly), 2.2);
                                double moveX = curveX * BASE_SENSITIVITY * dt + remainderX;
                                double moveY = -curveY * BASE_SENSITIVITY * dt + remainderY;
                                deltaX = (int)moveX; deltaY = (int)moveY;
                                remainderX = moveX - deltaX; remainderY = moveY - deltaY;

                                if (deltaX != 0 || deltaY != 0)
                                {
                                    if (isClicking && !dragBrokeThreshold)
                                    {
                                        clickAccumX += deltaX; clickAccumY += deltaY;
                                        if (Math.Abs(clickAccumX) > 5 || Math.Abs(clickAccumY) > 5)
                                        {
                                            dragBrokeThreshold = true; aDragOccurred = true;
                                            SendMouse((int)clickAccumX, (int)clickAccumY, MOUSEEVENTF_MOVE);
                                        }
                                    }
                                    else
                                    {
                                        if (isClicking) aDragOccurred = true;
                                        SendMouse(deltaX, deltaY, MOUSEEVENTF_MOVE);
                                    }
                                }
                            }
                            else { remainderX = 0; remainderY = 0; }
                        }

                        // GATILHO (A) - SOLTOU
                        if (Released(0x1000))
                        {
                            isClicking = false;
                            SendMouse(0, 0, 0x0004); // MOUSEEVENTF_LEFTUP

                            if (aWasOnTextField && !aDragOccurred && IsCursorOnTextField())
                            {
                                if (aDoubleClickPending && (DateTime.Now - lastAReleaseTime).TotalMilliseconds <= 300)
                                {
                                    // DUPLO CLIQUE CONFIRMADO!
                                    aDoubleClickPending = false;

                                    // Aguarda o Windows terminar de processar o duplo clique nativo e abre o Menu de Contexto
                                    Task.Run(async () => {
                                        await Task.Delay(100);
                                        SendMouse(0, 0, 0x0008); // MOUSEEVENTF_RIGHTDOWN
                                        SendMouse(0, 0, 0x0010); // MOUSEEVENTF_RIGHTUP
                                    });
                                }
                                else
                                {
                                    // PRIMEIRO CLIQUE: Aciona a contagem para abrir o VKB
                                    aDoubleClickPending = true;
                                    lastAReleaseTime = DateTime.Now;
                                }
                            }

                            aWasOnTextField = false; aDragOccurred = false;
                        }

                        // GATILHOS DE VOLTAR (B)
                        if (ignoreNextBRelease)
                        {
                            if ((btn & 0x2000) == 0) ignoreNextBRelease = false;
                        }
                        else
                        {
                            if (Pressed(0x2000)) SendMouse(0, 0, MOUSEEVENTF_XDOWN, XBUTTON1);
                            if (Released(0x2000)) SendMouse(0, 0, MOUSEEVENTF_XUP, XBUTTON1);
                        }

                        // Fechar Modo Desktop
                        bool isStartSelect = (btn & 0x0010) != 0 && (btn & 0x0020) != 0;
                        bool isXboxButton = (btn & 0x0400) != 0;

                        if (isStartSelect || isXboxButton)
                        {
                            ExitDesktopMode();
                            break;
                        }

                        if (Pressed(0x4000)) SendMouse(0, 0, MOUSEEVENTF_RIGHTDOWN);
                        if (Released(0x4000)) SendMouse(0, 0, MOUSEEVENTF_RIGHTUP);

                        // Botão Y (Abre teclado avulso)
                        if (Pressed(0x8000))
                        {
                            Dispatcher.Invoke(() =>
                            {
                                if (_desktopVkb == null)
                                {
                                    _desktopVkb = new DesktopVkbWindow();
                                    _desktopVkb.SetLocalization(_vkbStrBackspace, _vkbStrEnter, _vkbStrClose, _vkbStrShift, _vkbStrSpace, _vkbStrSym, _vkbStrAbc);

                                    _desktopVkb.OnKeyPressed += (txt) => {
                                        if (txt == "BKSP") SendVirtualKey(0x08);
                                        else if (txt == "ENTER") SendVirtualKey(0x0D);
                                        else if (txt == "CURSOR_LEFT") SendVirtualKey(0x25);
                                        else if (txt == "CURSOR_RIGHT") SendVirtualKey(0x27);
                                        else SendUnicodeString(txt);
                                    };
                                    _desktopVkb.OnCloseRequested += () =>
                                    {
                                        _desktopVkb?.Close();
                                        _desktopVkb = null;
                                    };

                                    _desktopVkb.SetFixedPosition();
                                    _desktopVkb.Show();
                                }
                            });
                        }

                        prevButtons = btn;
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[Modo Desktop] Erro na leitura do controle: {ex.Message}");
                }

                Thread.Sleep(10);
            }

            // GARANTIA ANTI-TRAVAMENTO DE MOUSE VIRTUAL
            if (isClicking)
            {
                SendMouse(0, 0, 0x0004); // MOUSEEVENTF_LEFTUP
            }
        }
        private void UpdateHoverStateInWebView()
        {
            if (webView?.CoreWebView2 != null)
            {
                if (_mainScreenMouseVisible)
                {
                    // Mouse Visível: Remove a trava e devolve o Hover
                    webView.CoreWebView2.ExecuteScriptAsync("let s=document.getElementById('doorpi-mouse-hider');if(s)s.remove();");
                }
                else
                {
                    // Mouse Oculto: Injeta pointer-events nulo para matar o Hover visualmente
                    webView.CoreWebView2.ExecuteScriptAsync("if(!document.getElementById('doorpi-mouse-hider')){let s=document.createElement('style');s.id='doorpi-mouse-hider';s.innerHTML='* { pointer-events: none !important; }';document.head.appendChild(s);}");
                }
            }
        }
        private void SendMouse(int dx, int dy, uint flags, uint data = 0)
        {
            var input = new INPUT { type = INPUT_MOUSE };
            input.U.mi = new MOUSEINPUT { dx = dx, dy = dy, dwFlags = flags, mouseData = data };
            SendInput(1, new[] { input }, INPUT.Size);
        }

        private void SyncKey(bool pressed, bool released, ushort vk)
        {
            if (pressed)
            {
                var input = new INPUT { type = INPUT_KEYBOARD };
                input.U.ki = new KEYBDINPUT { wVk = vk };
                SendInput(1, new[] { input }, INPUT.Size);
            }
            else if (released)
            {
                var input = new INPUT { type = INPUT_KEYBOARD };
                input.U.ki = new KEYBDINPUT { wVk = vk, dwFlags = KEYEVENTF_KEYUP };
                SendInput(1, new[] { input }, INPUT.Size);
            }
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
        // ========================= INICIAR COM O WINDOWS =========================

        private const string AutoStartRegKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
        private const string AutoStartAppName = "Doorpi";

        // ========================= COMPORTAMENTO DE INICIALIZAÇÃO =========================

        // ========================= COMPORTAMENTO DE INICIALIZAÇÃO =========================

        private int GetBootMode()
        {
            try
            {
                // 1. Verifica se estamos no Modo Console (Shell)
                using var winlogonKey = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon");
                if (winlogonKey?.GetValue("Shell") is string shellVal && !string.IsNullOrWhiteSpace(shellVal))
                {
                    return 2; // Modo Console Imersivo
                }

                // 2. Verifica se estamos no Modo Padrão (Run)
                using var runKey = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run");
                if (runKey?.GetValue("Doorpi") is string runVal && !string.IsNullOrWhiteSpace(runVal))
                {
                    return 1; // Iniciar com Windows (Padrão)
                }
            }
            catch (Exception ex) { Debug.WriteLine($"[BootMode] Erro ao ler registro: {ex.Message}"); }

            return 0; // Desativado
        }

        private void SetBootMode(int mode)
        {
            try
            {
                string exePath = Process.GetCurrentProcess().MainModule?.FileName
                                 ?? System.Reflection.Assembly.GetExecutingAssembly().Location;

                using var runKey = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                using var winlogonKey = Registry.CurrentUser.CreateSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon");
                // Chave responsável pelo som de Inicialização/Logon
                using var soundKey = Registry.CurrentUser.CreateSubKey(@"AppEvents\Schemes\Apps\.Default\SystemStart\.Current");

                // Limpa as chaves para evitar conflitos
                runKey?.DeleteValue("Doorpi", false);
                if (winlogonKey?.GetValue("Shell") != null) winlogonKey.DeleteValue("Shell", false);

                if (mode == 1) // Iniciar com Windows (Padrão)
                {
                    runKey?.SetValue("Doorpi", $"\"{exePath}\"");

                    // Restaura o som padrão do Windows deletando o mute
                    if (soundKey?.GetValue("") as string == "")
                        soundKey.DeleteValue("", false);

                    Debug.WriteLine($"[BootMode] Ativado Modo Padrão");
                }
                else if (mode == 2) // Modo Console (Shell Imersivo)
                {
                    winlogonKey?.SetValue("Shell", $"\"{exePath}\"");

                    // Muta o som de Boot do Windows (O Windows tentará tocar uma string vazia)
                    soundKey?.SetValue("", "");

                    Debug.WriteLine($"[BootMode] Ativado Modo Console");
                }
            }
            catch (Exception ex) { Debug.WriteLine($"[BootMode] Erro ao gravar registro: {ex.Message}"); }
        }

        private void EnsureExplorerIsRunningInBackstage()
        {
            // Se o explorer já estiver rodando, não fazemos nada
            if (Process.GetProcessesByName("explorer").Length > 0) return;

            try
            {
                this.Topmost = true;

                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    UseShellExecute = true
                });

                // Monitorar o foco durante o boot do explorer (ele demora e rouba o foco quando a barra de tarefas/desktop carrega)
                _ = Task.Run(async () =>
                {
                    // Monitora por até 15 segundos (150 iterações de 100ms)
                    for (int i = 0; i < 150; i++)
                    {
                        await Task.Delay(100);

                        bool inGracePeriod = DateTime.UtcNow.Ticks < Interlocked.Read(ref _userShellInteractionUntil);

                        Dispatcher.Invoke(() =>
                        {
                            // Só roubamos o foco de volta se estivermos no modo padrão da UI
                            if (!_systemControllerActive &&
                                !_gameSessionActive &&
                                !_dialogModeActive &&
                                string.IsNullOrEmpty(_mediaExeCurrentUrl))
                            {
                                if (!IsDoorpiMainWindowForeground() && !inGracePeriod)
                                {
                                    RestoreWindowFocusSilent();
                                }
                            }
                        });
                    }
                });

                Debug.WriteLine("[Boot] Explorer.exe iniciado em background com sucesso.");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Boot] Erro ao iniciar explorer: {ex.Message}");
            }
        }
        private void SendBootModeToUI()
        {
            int mode = GetBootMode();
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(new { type = "bootModeState", mode })));
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
        private async Task InitializeNativeAppsAsync(string targetUserId, string targetMediaFile, bool silent = false)
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

                // Troca GetFiles (Lento e aloca array inteiro na memória) por EnumerateFiles (Preguiçoso e rápido)
                string? localGrid = Directory.EnumerateFiles(gridFolder, id + ".*").FirstOrDefault();
                string? localHorizontal = Directory.EnumerateFiles(gridHorizontalFolder, id + "_h.*").FirstOrDefault();
                string? localHero = Directory.EnumerateFiles(heroFolder, id + ".*").FirstOrDefault();
                string? localLogo = Directory.EnumerateFiles(logoFolder, id + "_logo.*").FirstOrDefault();

                if (localGrid != null && localHero != null)
                {
                    apps.Add(new MediaAppModel
                    {
                        Id = id,
                        Name = name,
                        Url = url,
                        Type = type,
                        MultiUser = multiUser,
                        OwnerUserId = targetUserId,
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

                var (gridUrl, horizontalUrl, heroUrl, logoUrl) = await FetchMediaAppAssetsAsync(name, query).ConfigureAwait(false);

                var gridDlTask = !string.IsNullOrEmpty(gridUrl) ? DownloadImageAsync(gridUrl, gridFolder, id) : Task.FromResult<string?>(null);
                var hDlTask = !string.IsNullOrEmpty(horizontalUrl) ? DownloadImageAsync(horizontalUrl, gridHorizontalFolder, id + "_h") : Task.FromResult<string?>(null);
                var heroDlTask = !string.IsNullOrEmpty(heroUrl) ? DownloadImageAsync(heroUrl, heroFolder, id) : Task.FromResult<string?>(null);
                var logoDlTask = !string.IsNullOrEmpty(logoUrl) ? DownloadImageAsync(logoUrl, logoFolder, id + "_logo") : Task.FromResult<string?>(null);

                await Task.WhenAll(gridDlTask, hDlTask, heroDlTask, logoDlTask).ConfigureAwait(false);

                apps.Add(new MediaAppModel
                {
                    Id = id,
                    Name = name,
                    Url = url,
                    Type = type,
                    MultiUser = multiUser,
                    OwnerUserId = targetUserId,
                    ShareMode = existingEntry.ShareMode,
                    SharedWithUserId = existingEntry.SharedWithUserId,
                    SharedWithUserName = existingEntry.SharedWithUserName,
                    GridImage = gridDlTask.Result != null ? $"https://data.local/images/grid/{Path.GetFileName(gridDlTask.Result)}" : existingEntry.GridImage,
                    GridHorizontalImage = hDlTask.Result != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(hDlTask.Result)}" : existingEntry.GridHorizontalImage,
                    HeroImage = heroDlTask.Result != null ? $"https://data.local/images/hero/{Path.GetFileName(heroDlTask.Result)}" : existingEntry.HeroImage,
                    LogoImage = logoDlTask.Result != null ? $"https://data.local/images/logo/{Path.GetFileName(logoDlTask.Result)}" : existingEntry.LogoImage,
                    DateAdded = existingEntry.DateAdded == DateTime.MinValue ? DateTime.Now : existingEntry.DateAdded
                });

                if (targetUserId == currentUserId) PostProgress(id, "done");
                await Task.Delay(150).ConfigureAwait(false);
            }

            var nativeIds = _nativeApps.Select(a => a.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
            apps.AddRange(existing.Where(a => !a.IsSharedFromOtherUser && !nativeIds.Contains(a.Id)));

            await Task.Run(() => SaveMediaAppsForSpecificUser(apps, targetUserId, targetMediaFile)).ConfigureAwait(false);

            if (!silent && targetUserId == currentUserId)
                Dispatcher.BeginInvoke(() => SendMediaAppsToUI(apps));
        }
        private void PostProgress(string appId, string state)
        {

            Dispatcher.BeginInvoke(() =>
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
                    ApplySharedUserNames(app, users);
                }
                visible.Add(app);
            }

            foreach (var user in users.Where(u => !string.Equals(u.Id, currentUserId, StringComparison.OrdinalIgnoreCase)))
            {
                foreach (var app in LoadMediaAppsForUser(user.Id))
                {
                    if (string.IsNullOrWhiteSpace(app.OwnerUserId)) app.OwnerUserId = user.Id;
                    if (app.ShareMode == "user") ApplySharedUserNames(app, users);
                    bool sharedToCurrent = app.ShareMode == "all" ||
                        (app.ShareMode == "user" && NormalizeSharedUserIds(app).Contains(currentUserId, StringComparer.OrdinalIgnoreCase));
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
                foreach (var app in apps.Where(a => a.ShareMode == "user"))
                    ApplySharedUserNames(app);
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
                    if (a.ShareMode == "user") ApplySharedUserNames(a);
                    else
                    {
                        a.SharedWithUserId = "";
                        a.SharedWithUserIds = new List<string>();
                        a.SharedWithUserName = "";
                        a.SharedWithUserNames = new List<string>();
                    }
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
        private async Task CheckAndSendExtensionUpdatesAsync()
        {
            Debug.WriteLine("[Extensions] Iniciando checagem de updates...");
            var extensions = LoadBrowserExtensions();
            var updates = new Dictionary<string, string>();

            foreach (var ext in extensions)
            {
                try
                {
                    string currentVersion = GetExtensionVersion(ext);
                    string url = $"https://clients2.google.com/service/update2/crx?response=updatecheck&os=win&arch=x64&os_arch=x86_64&nacl_arch=x86-64&prod=chromecrx&prodchannel=&prodversion=999.0.0.0&acceptformat=crx2,crx3&x=id%3D{ext.Id}%26v%3D{currentVersion}%26installsource%3Dondemand%26uc";

                    var req = new HttpRequestMessage(HttpMethod.Get, url);
                    req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

                    var response = await httpClient.SendAsync(req);
                    string xmlContent = await response.Content.ReadAsStringAsync();

                    var doc = XDocument.Parse(xmlContent);
                    var updateCheck = doc.Descendants().FirstOrDefault(x => x.Name.LocalName == "updatecheck");

                    if (updateCheck != null)
                    {
                        string availableVersion = updateCheck.Attribute("version")?.Value;
                        if (!string.IsNullOrEmpty(availableVersion) && IsNewerVersion(availableVersion, currentVersion))
                        {
                            updates[ext.Id] = availableVersion;
                        }
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[Extensions] Erro ao checar {ext.Id}: {ex.Message}"); }
            }

            // --- AQUI É O PONTO CRUCIAL ---
            // Atualizamos a memória da classe com os resultados encontrados
            _latestUpdatesCache = updates;

            // Agora enviamos para a UI
            SendExtensionsToUI();

            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
            {
                type = "extensionUpdatesList",
                updates = _latestUpdatesCache
            })));
        }
        private bool IsNewerVersion(string available, string current)
        {
            try
            {
                var availParts = available.Split('.').Select(int.Parse).ToList();
                var currParts = current.Split('.').Select(int.Parse).ToList();

                // Compara parte por parte (ex: 2026 > 1)
                for (int i = 0; i < Math.Min(availParts.Count, currParts.Count); i++)
                {
                    if (availParts[i] > currParts[i]) return true;
                    if (availParts[i] < currParts[i]) return false;
                }
                return availParts.Count > currParts.Count;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Extensions] Erro na comparação de versão: {ex.Message}");
                return false;
            }
        }
        private void DeleteExtension(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return;

            var extensions = LoadBrowserExtensions();
            var ext = extensions.FirstOrDefault(e => string.Equals(e.Id, id, StringComparison.OrdinalIgnoreCase));

            if (ext != null)
            {
                // Remove do banco de dados (JSON)
                extensions.Remove(ext);
                SaveBrowserExtensions(extensions);

                // Tenta deletar os arquivos físicos
                if (!string.IsNullOrEmpty(ext.InstalledPath) && Directory.Exists(ext.InstalledPath))
                {
                    try
                    {
                        // Força o Garbage Collector a soltar possíveis handles antes de deletar
                        GC.Collect();
                        GC.WaitForPendingFinalizers();

                        Directory.Delete(ext.InstalledPath, true);
                    }
                    catch (IOException ex)
                    {
                        // É normal dar erro de IO se o WebView2 estiver rodando com a extensão ativa.
                        // Como já removemos do JSON, ela não será carregada da próxima vez.
                        Debug.WriteLine($"[Extensions] Arquivo travado, será ignorado no próximo boot. Erro: {ex.Message}");
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[Extensions] Erro ao deletar pasta física: {ex.Message}");
                    }
                }
            }
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
            var payload = extensions.Select(e => new {
                e.Id,
                e.Name,
                e.SourceUrl,
                e.InstalledPath,
                e.DateInstalled,
                Version = GetExtensionVersion(e)
            }).ToList();

            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
            {
                type = "extensionsList",
                extensions = payload,
                updates = _latestUpdatesCache, // <--- ENVIA O CACHE JUNTO
                status,
                message
            })));
        }

        private string IntroDataFolder => Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "intros");
        private string ActiveIntroFile => Path.Combine(IntroDataFolder, "active.json");

        private object? ReadIntroManifestPayload(string manifestPath, string source)
        {
            try
            {
                if (!File.Exists(manifestPath)) return null;
                using var doc = JsonDocument.Parse(File.ReadAllText(manifestPath));
                var root = doc.RootElement;
                var folderId = SafeIntroId(Path.GetFileName(Path.GetDirectoryName(manifestPath)) ?? "");
                var id = string.Equals(source, "installed", StringComparison.OrdinalIgnoreCase)
                    ? folderId
                    : SafeIntroId(GetStr(root, "id", folderId));
                return new
                {
                    id,
                    source,
                    name = GetStr(root, "name", id),
                    version = GetStr(root, "version", ""),
                    author = GetStr(root, "author", ""),
                    manifest = source == "builtin"
                        ? $"https://app.local/intros/{id}/manifest.json"
                        : $"{id}/manifest.json"
                };
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Intro] Manifest inválido {manifestPath}: {ex.Message}");
                return null;
            }
        }

        private string GetActiveIntroId()
        {
            try
            {
                if (!File.Exists(ActiveIntroFile)) return "doorpi-neon";
                using var doc = JsonDocument.Parse(File.ReadAllText(ActiveIntroFile));
                var root = doc.RootElement;
                if (root.TryGetProperty("enabled", out var enabled) && enabled.ValueKind == JsonValueKind.False)
                    return "";
                var id = GetStr(root, "id");
                if (!string.IsNullOrWhiteSpace(id)) return SafeIntroId(id);
                var manifest = GetStr(root, "manifest");
                var match = Regex.Match(manifest, @"(?:^|/)([^/]+)/manifest\.json$", RegexOptions.IgnoreCase);
                return match.Success ? SafeIntroId(match.Groups[1].Value) : "doorpi-neon";
            }
            catch { return "doorpi-neon"; }
        }

        private void SendIntrosToUI()
        {
            Directory.CreateDirectory(IntroDataFolder);
            var intros = new List<object>();

            foreach (var manifest in Directory.GetFiles(IntroDataFolder, "manifest.json", SearchOption.AllDirectories))
            {
                var folderId = SafeIntroId(Path.GetFileName(Path.GetDirectoryName(manifest)) ?? "");
                try
                {
                    using var doc = JsonDocument.Parse(File.ReadAllText(manifest));
                    var root = doc.RootElement;
                    var id = SafeIntroId(GetStr(root, "id", folderId));

                    intros.Add(new
                    {
                        id,
                        name = GetStr(root, "name", id),
                        version = GetStr(root, "version", ""),
                        author = GetStr(root, "author", ""),
                        manifest = $"{id}/manifest.json"
                    });
                }
                catch { }
            }

            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
            {
                type = "introsList",
                activeId = GetActiveIntroId(),
                intros
            })));
        }

        private void SetActiveIntro(string id)
        {
            Directory.CreateDirectory(IntroDataFolder);
            id = SafeIntroId(id);

            if (string.IsNullOrWhiteSpace(id) || id == "none")
            {
                File.WriteAllText(ActiveIntroFile, JsonSerializer.Serialize(new { enabled = false }, new JsonSerializerOptions { WriteIndented = true }));
                return;
            }

            File.WriteAllText(ActiveIntroFile, JsonSerializer.Serialize(new
            {
                enabled = true,
                manifest = $"{id}/manifest.json"
            }, new JsonSerializerOptions { WriteIndented = true }));
        }

        private void SendMediaAppsToUI(List<MediaAppModel> apps)
        {
            if (apps.Count == 0) return;

            var featured = apps
                .Where(a => a.LastPlayed > DateTime.MinValue)
                .OrderByDescending(a => a.LastPlayed)
                .FirstOrDefault()
                ?? apps.OrderByDescending(a => a.DateAdded).FirstOrDefault();

            var sortedApps = new List<MediaAppModel>();

            if (featured != null)
            {
                sortedApps.Add(featured);
                var others = apps.Where(a => a.Id != featured.Id)
                    .OrderByDescending(a => a.LastPlayed > a.DateAdded ? a.LastPlayed : a.DateAdded)
                    .Take(11)
                    .ToList();

                sortedApps.AddRange(others);
            }

            var payload = new { type = "nativeAppsLoaded", apps = sortedApps };
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(payload)));
        }


        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool IsIconic(IntPtr hWnd);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern int GetWindowTextLength(IntPtr hWnd);

        [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern IntPtr GetShellWindow();

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool BringWindowToTop(IntPtr hWnd);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

        [System.Runtime.InteropServices.DllImport("kernel32.dll")]
        private static extern uint GetCurrentThreadId();
        private void RestoreWindowFocusSilent()
        {
            Dispatcher.BeginInvoke(() =>
            {
                var hwnd = _mainWindowHandle != IntPtr.Zero
                    ? _mainWindowHandle
                    : new System.Windows.Interop.WindowInteropHelper(this).Handle;

                FocusExternalWindow(hwnd);
                Activate();
                webView?.Focus();
                Keyboard.Focus(webView);
            });
        }
        private long _focusRestoredAtTicks = 0;
        public void ForceFocus()
        {
            CommitActiveSession();
            _gameSessionActive = false;
            if (_mediaExeModeActive) ExitMediaExeMode();
            _mainUiGamepadSuspendedForGame = false;
            Interlocked.Exchange(ref _mainUiGamepadSuppressUntilUtcTicks, 0);
            Interlocked.Exchange(ref _focusRestoredAtTicks, DateTime.UtcNow.Ticks);

            SendGameLaunchStatus("gameLaunchDone");
            ReleaseAllStuckKeys();

            Dispatcher.BeginInvoke(() =>
            {
                var hwnd = _mainWindowHandle != IntPtr.Zero
                    ? _mainWindowHandle
                    : new System.Windows.Interop.WindowInteropHelper(this).Handle;

                FocusExternalWindow(hwnd);
                Activate();
                EnsureCursorHidden();
                _mainScreenMouseVisible = false;
                UpdateHoverStateInWebView(); // Garante a remoção do hover

                webView?.Focus();
                Keyboard.Focus(webView);

                webView?.CoreWebView2?.ExecuteScriptAsync(
                    "window.isMediaAppActive = false; window.focusFeaturedCard?.();");
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

        private CancellationTokenSource? _gameLaunchMonitorCts;
        private readonly object _gameLaunchMonitorLock = new();

        private sealed class GameLaunchMonitorContext
        {
            public required GameModel Game { get; init; }
            public required HashSet<int> BaselineProcessIds { get; init; }
            public Process? LaunchedProcess { get; init; }
            public int LaunchedProcessId { get; init; }
            public string DirectExePath { get; init; } = "";
            public string[] NameTokens { get; init; } = Array.Empty<string>();
            public DateTime StartedUtc { get; init; } = DateTime.UtcNow;
            public HashSet<int> SeenCandidatePids { get; } = new();
        }

        private sealed class GameWindowCandidate
        {
            public IntPtr Hwnd { get; init; }
            public int ProcessId { get; init; }
            public int Score { get; init; }
            public string ProcessName { get; init; } = "";
        }

        private static readonly HashSet<string> _knownLauncherProcessNames = new(StringComparer.OrdinalIgnoreCase)
{
    "steam", "steamwebhelper", "epicgameslauncher", "epicwebhelper", "galaxyclient",
    "goggalaxy", "riotclientservices", "riotclientux", "riotclientuxrender",
    "leagueclient", "leagueclientux", "leagueclientuxrender",          // ← NOVO
    "eadesktop", "eabackgroundservice", "origin", "battle.net", "battle.net helper",
    "ubisoftconnect", "upc", "rockstarservice", "rockstarlauncher"
};

        private static readonly HashSet<string> _shellProcessNames = new(StringComparer.OrdinalIgnoreCase)
        {
            "explorer", "shellexperiencehost", "startmenuexperiencehost", "searchhost",
            "searchapp", "taskmgr", "applicationframehost", "textinputhost"
        };

        private HashSet<int> SnapshotProcessIds()
        {
            try { return Process.GetProcesses().Select(p => p.Id).ToHashSet(); }
            catch { return new HashSet<int>(); }
        }

        private void StartGameLaunchMonitor(GameModel game, Process? launched, HashSet<int> baselineProcessIds)
        {
            CancellationTokenSource cts;
            lock (_gameLaunchMonitorLock)
            {
                _gameLaunchMonitorCts?.Cancel();
                _gameLaunchMonitorCts?.Dispose();
                _gameLaunchMonitorCts = new CancellationTokenSource();
                cts = _gameLaunchMonitorCts;
            }

            var context = new GameLaunchMonitorContext
            {
                Game = game,
                BaselineProcessIds = baselineProcessIds,
                LaunchedProcess = launched,
                LaunchedProcessId = SafeProcessId(launched),
                DirectExePath = GetDirectGameExePath(game),
                NameTokens = BuildGameNameTokens(game),
                StartedUtc = DateTime.UtcNow
            };

            _gameSessionActive = true; // ← arma o guard antes de qualquer BeginInvoke
            _ = Task.Run(() => MonitorGameLaunchAsync(context, cts.Token));
        }

        private async Task MonitorGameLaunchAsync(
          GameLaunchMonitorContext context, CancellationToken token)
        {
            try
            {
                bool gameSeen = false;
                bool doorpiHidden = false;
                DateTime gameFirstSeenUtc = DateTime.MinValue;
                int ghostChecks = 0;

                // Para processos diretos que disparam o evento de encerramento
                if (context.LaunchedProcess != null)
                {
                    try
                    {
                        if (!context.LaunchedProcess.HasExited)
                        {
                            context.LaunchedProcess.EnableRaisingEvents = true;
                            context.LaunchedProcess.Exited += (_, _) =>
                            {
                                if (!token.IsCancellationRequested)
                                    Dispatcher.BeginInvoke(() => ForceFocus());
                            };
                        }
                    }
                    catch { }
                }

                while (!token.IsCancellationRequested)
                {
                    var now = DateTime.UtcNow;
                    var elapsed = now - context.StartedUtc;

                    // O usuário pediu explicitamente: se o Doorpi recuperou o foco visual (Alt+Tab ou fechamento real),
                    // não perca tempo processando mais nada, assuma que o controle precisa ser restaurado imediatamente.
                    if (gameSeen && IsDoorpiMainWindowForeground())
                    {
                        ForceFocus();
                        return;
                    }

                    var candidate = FindBestGameWindowCandidate(context);

                    if (candidate != null && candidate.Score >= 55)
                    {
                        if (!gameSeen) { gameSeen = true; gameFirstSeenUtc = now; }
                        context.SeenCandidatePids.Add(candidate.ProcessId);
                        ghostChecks = 0; // A janela está na tela, zera o contador de "fantasma"

                        if (!doorpiHidden)
                        {
                            bool gameHasFocus = IsForegroundOwnedByProcess(candidate.ProcessId);
                            bool graceExpired = (now - gameFirstSeenUtc).TotalSeconds >= 3;

                            // DEPOIS:
                            if (gameHasFocus || graceExpired)
                            {
                                if (!gameHasFocus) FocusExternalWindow(candidate.Hwnd);

                                // Garante o tempo mínimo de animação ANTES de esconder o Doorpi.
                                // O guard continua ativo durante essa espera, impedindo o desktop de roubar o foco.
                                await EnsureMinimumAnimationTimeAsync(token);
                                if (token.IsCancellationRequested) return;

                                // O jogo assumiu — o guard não é mais necessário, o próprio jogo mantém o foco.
                           
                                doorpiHidden = true;
                                SendDoorpiToBackground();
                                SendGameLaunchStatus("gameLaunchReady");
                            }
                        }
                    }
                    else
                    {
                        if (!gameSeen)
                        {
                            bool procExited = context.LaunchedProcess != null && SafeHasExited(context.LaunchedProcess);

                            if (procExited && elapsed.TotalSeconds > 4 && IsForegroundDesktopOrShell())
                            {
                                SendGameLaunchStatus("gameLaunchFailed", context.Game.Name, context.Game.HeroImage, context.Game.GridImage, "crash");
                                ForceFocus();
                                return;
                            }

                            if (elapsed.TotalMinutes > 4)
                            {
                                SendGameLaunchStatus("gameLaunchFailed", context.Game.Name, context.Game.HeroImage, context.Game.GridImage, "timeout");
                                ForceFocus();
                                return;
                            }
                        }
                        else
                        {
                            ghostChecks++;
                            if (ghostChecks >= 2)
                            {
                                ForceFocus();
                                return;
                            }
                        }
                    }

                    await Task.Delay(gameSeen ? 150 : 200, token).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex) { Debug.WriteLine($"[GameLaunchMonitor] {ex.Message}"); }
        }

        // ── Session tracking ──────────────────────────────────────────────────────
        private DateTime _sessionStartUtc = DateTime.MinValue;
        private string _activeSessionGameId = "";

        private void CommitActiveSession()
        {
            if (_sessionStartUtc == DateTime.MinValue || string.IsNullOrEmpty(_activeSessionGameId))
                return;

            int sessionMinutes = (int)(DateTime.UtcNow - _sessionStartUtc).TotalMinutes;
            _sessionStartUtc = DateTime.MinValue;
            string gameId = _activeSessionGameId;
            _activeSessionGameId = "";

            if (sessionMinutes < 1) return; // ignora sessões abaixo de 1 minuto

            _ = Task.Run(() =>
            {
                var games = LoadGames();
                var game = games.FirstOrDefault(g =>
                    string.Equals(g.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(g.Path, gameId, StringComparison.OrdinalIgnoreCase));

                if (game == null) return;

                game.TotalPlaytimeMinutes += sessionMinutes;
                game.LastSessionMinutes = sessionMinutes;
                SaveGames(games);
                Debug.WriteLine($"[Session] {game.Name}: +{sessionMinutes}min (total: {game.TotalPlaytimeMinutes}min)");
            });
        }
        private void StartGlobalFocusWatchdog()
        {
            new Thread(() =>
            {
                while (true)
                {
                    Thread.Sleep(100); // 100ms é o balanço ideal (Zero CPU + Super Resposta)

                    try
                    {
                        if (_systemControllerActive) continue; // Usuário ativou modo mouse manual (Modo Desktop)

                        IntPtr fgHwnd = GetForegroundWindow();
                        GetWindowThreadProcessId(fgHwnd, out uint fgPid);
                        bool isDoorpiFg = (fgHwnd == _mainWindowHandle);
                        bool isDesktopOrShell = IsForegroundDesktopOrShell();

                        // O SEGREDO DO CONTROLE DO USUÁRIO E ALT+TAB:
                        bool isUserSwitching = (GetAsyncKeyState(0x12) & 0x8000) != 0 || // Alt
                                               (GetAsyncKeyState(0x5B) & 0x8000) != 0 || // Win L
                                               (GetAsyncKeyState(0x5C) & 0x8000) != 0 || // Win R
                                               (GetAsyncKeyState(0x09) & 0x8000) != 0;   // Tab

                        bool isClickingShell = isDesktopOrShell && (GetAsyncKeyState(0x01) & 0x8000) != 0;

                        if (isUserSwitching || isClickingShell)
                        {
                            Interlocked.Exchange(ref _userShellInteractionUntil, DateTime.UtcNow.AddMilliseconds(4000).Ticks);
                        }

                        bool inGracePeriod = DateTime.UtcNow.Ticks < Interlocked.Read(ref _userShellInteractionUntil);

                        bool hasMediaExeSession = !string.IsNullOrEmpty(_mediaExeCurrentUrl);
                        bool hasExternalWebAppSession = _mediaMouseActive && _webAppWindow != null;

                        // ============================================
                        // 1. MODO MEDIA EXE (Sessão Rastreamento Contínuo)
                        // ============================================
                        if (hasMediaExeSession)
                        {
                            if (isDoorpiFg)
                            {
                                if (_doorpiSuspendedForMedia)
                                {
                                    _doorpiSuspendedForMedia = false;
                                    if (_mediaExeModeActive) _mediaExeModeActive = false;

                                    Dispatcher.Invoke(() => {
                                        _desktopVkb?.Close();
                                        _desktopVkb = null;
                                        ResetCursorForMainScreen();
                                        if (WindowState != WindowState.Maximized) WindowState = WindowState.Maximized;
                                        Activate();
                                        webView?.Focus();
                                        Keyboard.Focus(webView);
                                        webView?.CoreWebView2?.ExecuteScriptAsync("window.isMediaAppActive = false; window.focusFeaturedCard?.();");
                                    });
                                }
                            }
                            else
                            {
                                if (!_doorpiSuspendedForMedia)
                                {
                                    _doorpiSuspendedForMedia = true;
                                    if (!_mediaExeGamepadDisabled)
                                    {
                                        _mediaExeModeActive = true;
                                        Dispatcher.Invoke(() => {
                                            EnsureCursorVisible();
                                            _mainScreenMouseVisible = true;
                                            UpdateHoverStateInWebView();
                                            webView?.CoreWebView2?.ExecuteScriptAsync("window.isMediaAppActive = true;");
                                        });

                                        if (_mediaExeThread == null || !_mediaExeThread.IsAlive)
                                        {
                                            int sessionId = Interlocked.Increment(ref _mediaExeSessionId);
                                            _mediaExeThread = new Thread(() => MediaExeControllerLoop(sessionId)) { IsBackground = true };
                                            _mediaExeThread.Start();
                                        }
                                    }
                                }
                            }
                            continue;
                        }

                        // ============================================
                        // 1.5 MODO WEB APP EXTERNO (Janela Dedicada)
                        // ============================================
                        if (hasExternalWebAppSession)
                        {
                            if (isDoorpiFg)
                            {
                                // O usuário voltou para a interface do Doorpi (Alt-tab ou clicou) enquanto o WebApp estava aberto.
                                // Isso finaliza a sessão web para liberar os controles reais ao Doorpi.
                                Dispatcher.Invoke(() => {
                                    StopMediaControllerMode();
                                    if (_webAppWindow != null && _webAppWindow.WindowState != WindowState.Minimized)
                                    {
                                        _webAppWindow.WindowState = WindowState.Minimized;
                                    }
                                    ForceFocus();
                                });
                            }
                            else if (isDesktopOrShell && !inGracePeriod)
                            {
                                // O WebApp perdeu foco para o Desktop. 
                                // O Watchdog força a janela do WebApp a voltar, prendendo o usuário nela de forma segura.
                                Dispatcher.Invoke(() => {
                                    if (_webAppWindow != null)
                                    {
                                        if (_webAppWindow.WindowState == WindowState.Minimized)
                                        {
                                            _webAppWindow.WindowState = WindowState.Maximized;
                                        }
                                        _webAppWindow.Activate();

                                        var webHwnd = new System.Windows.Interop.WindowInteropHelper(_webAppWindow).Handle;
                                        if (webHwnd != IntPtr.Zero) FocusExternalWindow(webHwnd);
                                    }
                                });
                            }
                            continue; // IMPORTANTE: Impede o watchdog de cair no Modo Global.
                        }

                        // ============================================
                        // 2. MODO GLOBAL E FALLBACKS (Tela Principal)
                        // ============================================
                        if (!_gameSessionActive && !_dialogModeActive)
                        {
                            if (isDesktopOrShell && !isDoorpiFg && !inGracePeriod)
                            {
                                Dispatcher.Invoke(() => RestoreWindowFocusSilent());
                            }
                        }
                    }
                    catch { }
                }
            })
            { IsBackground = true, Name = "GlobalFocusWatchdog" }.Start();
        }

        private void StartEmergencyEscapeWatchdog()
        {
            new Thread(() =>
            {
                int holdCount = 0;
                while (true)
                {
                    Thread.Sleep(100); // Lê o controle a cada 100ms
                    try
                    {
                        if (XInputGetStateSecret(0, out var state) == 0)
                        {
                            var btn = state.Gamepad.wButtons;

                            // Segurar Start + Select OU o botão do Xbox
                            bool exitCombo = (btn & 0x0010) != 0 && (btn & 0x0020) != 0;
                            bool xboxBtn = (btn & 0x0400) != 0;

                            if (exitCombo || xboxBtn)
                            {
                                holdCount++;

                                // Se segurar por 1 segundo (10 ciclos de 100ms)
                                if (holdCount >= 10)
                                {
                                    holdCount = 0;
                                    Dispatcher.Invoke(() =>
                                    {
                                        // Reseta todos os modos e força a volta pra casa
                                        if (_mediaExeModeActive) ExitMediaExeMode();
                                        if (_systemControllerActive) ExitDesktopMode();
                                        ForceFocus();
                                    });

                                    // Pausa para não floodar comandos
                                    Thread.Sleep(2000);
                                }
                            }
                            else
                            {
                                holdCount = 0; // Reseta se o usuário soltar os botões
                            }
                        }
                    }
                    catch { }
                }
            })
            { IsBackground = true, Name = "EmergencyEscapeWatchdog" }.Start();
        }
        private void SendGameLaunchStatus(string type, string gameName = "", string heroImage = "", string gridImage = "", string reason = "")
        {
            if (type == "gameLaunching")
            {
                _launchAnimationStartedUtc = DateTime.UtcNow;
            }

            Dispatcher.BeginInvoke(() =>
            {
                if (webView?.CoreWebView2 == null) return;
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type,
                    gameName,
                    heroImage,
                    gridImage,
                    reason
                }));
            });
        }


        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int vKey);

        private void ReleaseAllStuckKeys()
        {
            try
            {
                byte[] keys =
                {
                    0x10, 0x11, 0x12,       // Shift, Ctrl, Alt
                    0x5B, 0x5C,             // Win L / Win R
                    0x1B, 0x0D, 0x08, 0x09  // Esc, Enter, Backspace, Tab
                };

                foreach (var vk in keys)
                {
                    // O bit 0x8000 verifica se a tecla está ATUALMENTE pressionada para o Windows
                    if ((GetAsyncKeyState(vk) & 0x8000) != 0)
                    {
                        var input = new INPUT { type = INPUT_KEYBOARD };
                        input.U.ki = new KEYBDINPUT { wVk = vk, dwFlags = KEYEVENTF_KEYUP };
                        SendInput(1, new[] { input }, INPUT.Size);
                    }
                }
            }
            catch { }
        }

        private void SendDoorpiToBackground()
        {
            Dispatcher.BeginInvoke(() =>
            {
                // Se ForceFocus já foi chamado (ex: saiu do jogo antes do BeginInvoke executar),
                // _gameSessionActive já é false — descarta este push para não sobrepor o HWND_TOP.
                if (!_gameSessionActive) return;
                var hwnd = _mainWindowHandle;
                if (hwnd == IntPtr.Zero) return;
                SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
            });
        }

        private static int SafeProcessId(Process? process)
        {
            try { return process?.Id ?? 0; } catch { return 0; }
        }

        private static bool SafeHasExited(Process process)
        {
            try { return process.HasExited; } catch { return true; }
        }

        private static string GetDirectGameExePath(GameModel game)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(game.Path) && File.Exists(game.Path))
                    return Path.GetFullPath(game.Path);

                if (!string.IsNullOrWhiteSpace(game.LaunchUrl) &&
                    game.LaunchUrl.StartsWith("riot:", StringComparison.OrdinalIgnoreCase))
                {
                    var cmd = game.LaunchUrl.Substring(5).Trim();
                    if (cmd.StartsWith("\""))
                    {
                        var endQuote = cmd.IndexOf("\"", 1, StringComparison.Ordinal);
                        if (endQuote > 0)
                        {
                            var exePath = cmd.Substring(1, endQuote - 1);
                            if (File.Exists(exePath)) return Path.GetFullPath(exePath);
                        }
                    }
                    else
                    {
                        var exeIndex = cmd.IndexOf(".exe", StringComparison.OrdinalIgnoreCase);
                        if (exeIndex > 0)
                        {
                            var exePath = cmd.Substring(0, exeIndex + 4).Trim();
                            if (File.Exists(exePath)) return Path.GetFullPath(exePath);
                        }
                    }
                }
            }
            catch { }
            return "";
        }

        private static string[] BuildGameNameTokens(GameModel game)
        {
            var stop = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "the", "and", "for", "with", "edition", "deluxe", "ultimate", "demo",
                "remaster", "remastered", "definitive", "standard", "windows", "game"
            };

            var raw = $"{game.Name} {Path.GetFileNameWithoutExtension(game.Path ?? "")}";
            return Regex.Replace(raw, @"[^\p{L}\p{Nd}]+", " ")
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(t => t.Length >= 3 && !stop.Contains(t))
                .Select(t => t.ToLowerInvariant())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(8)
                .ToArray();
        }

        private GameWindowCandidate? FindBestGameWindowCandidate(GameLaunchMonitorContext context)
        {
            GameWindowCandidate? best = null;

            foreach (var hWnd in EnumerateTopLevelWindows())
            {
                GetWindowThreadProcessId(hWnd, out var pidRaw);
                var pid = (int)pidRaw;
                if (pid <= 0 || pid == Environment.ProcessId) continue;

                Process process;
                try { process = Process.GetProcessById(pid); }
                catch { continue; }

                var score = ScoreGameWindowCandidate(context, process, hWnd);
                if (score < 35) continue;

                var candidate = new GameWindowCandidate
                {
                    Hwnd = hWnd,
                    ProcessId = pid,
                    ProcessName = SafeProcessName(process),
                    Score = score
                };

                if (best == null || candidate.Score > best.Score)
                    best = candidate;
            }

            return best;
        }

        private IEnumerable<IntPtr> EnumerateTopLevelWindows()
        {
            var windows = new List<IntPtr>();
            var shell = GetShellWindow();
            var doorpi = _mainWindowHandle;

            EnumWindows((hWnd, _) =>
            {
                if (hWnd == IntPtr.Zero || hWnd == shell || hWnd == doorpi) return true;
                if (!IsWindowVisible(hWnd)) return true;
                windows.Add(hWnd);
                return true;
            }, IntPtr.Zero);

            return windows;
        }

        private int ScoreGameWindowCandidate(GameLaunchMonitorContext context, Process process, IntPtr hWnd)
        {
            var processName = SafeProcessName(process);
            if (string.IsNullOrWhiteSpace(processName)) return 0;
            if (_shellProcessNames.Contains(processName)) return 0;

            var score = 0;
            var pid = SafeProcessId(process);
            var title = GetWindowTitle(hWnd);
            var exePath = SafeProcessPath(process);
            var exeName = Path.GetFileNameWithoutExtension(exePath);
            var haystack = $"{processName} {exeName} {title} {exePath}".ToLowerInvariant();
            var isLauncher = _knownLauncherProcessNames.Contains(processName);

            if (pid == context.LaunchedProcessId) score += 30;
            if (!context.BaselineProcessIds.Contains(pid)) score += 28;
            if (context.SeenCandidatePids.Contains(pid)) score += 18;
            if (!string.IsNullOrWhiteSpace(title)) score += 8;

            if (!string.IsNullOrWhiteSpace(context.DirectExePath) &&
                !string.IsNullOrWhiteSpace(exePath))
            {
                if (PathsEqual(context.DirectExePath, exePath)) score += 120;
                else
                {
                    var gameDir = Path.GetDirectoryName(context.DirectExePath) ?? "";
                    if (!string.IsNullOrWhiteSpace(gameDir) &&
                        exePath.StartsWith(gameDir, StringComparison.OrdinalIgnoreCase))
                        score += 45;
                }
            }

            var tokenMatches = context.NameTokens.Count(t => haystack.Contains(t, StringComparison.OrdinalIgnoreCase));
            score += tokenMatches * 18;
            if (tokenMatches >= Math.Min(2, Math.Max(1, context.NameTokens.Length))) score += 22;

            try
            {
                var mb = process.WorkingSet64 / 1024 / 1024;
                if (mb > 450) score += 12;
                if (mb > 1400) score += 12;
            }
            catch { }

            if (isLauncher) score -= 30;
            return Math.Max(0, score);
        }

        private static bool PathsEqual(string a, string b)
        {
            try
            {
                return string.Equals(Path.GetFullPath(a).TrimEnd('\\'),
                    Path.GetFullPath(b).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
            }
        }

        private static string SafeProcessName(Process process)
        {
            try { return process.ProcessName ?? ""; } catch { return ""; }
        }

        private static string SafeProcessPath(Process process)
        {
            try { return process.MainModule?.FileName ?? ""; } catch { return ""; }
        }

        private static string GetWindowTitle(IntPtr hWnd)
        {
            try
            {
                var length = Math.Max(GetWindowTextLength(hWnd), 0);
                var builder = new System.Text.StringBuilder(length + 1);
                GetWindowText(hWnd, builder, builder.Capacity);
                return builder.ToString();
            }
            catch { return ""; }
        }

        private bool IsForegroundOwnedByProcess(int processId)
        {
            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero) return false;
                GetWindowThreadProcessId(foreground, out var foregroundPid);
                return foregroundPid == processId;
            }
            catch { return false; }
        }

        private bool IsForegroundDesktopOrShell()
        {
            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero || foreground == GetShellWindow()) return true;

                var doorpi = _mainWindowHandle;
                if (doorpi != IntPtr.Zero && foreground == doorpi) return false;

                GetWindowThreadProcessId(foreground, out var pidRaw);
                if (pidRaw == 0) return true;
                var process = Process.GetProcessById((int)pidRaw);
                return _shellProcessNames.Contains(SafeProcessName(process));
            }
            catch { return true; }
        }

        private void FocusExternalWindow(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero) return;
            try
            {
                if (IsIconic(hWnd)) ShowWindow(hWnd, 9); // SW_RESTORE
                else ShowWindow(hWnd, 5); // SW_SHOW

                // O Truque do TopMost: Eleva a janela acima de TUDO no Windows, 
                // rouba o foco naturalmente, e depois remove o status TopMost.
                // Sem simular teclado, sem travar inputs!
                SetWindowPos(hWnd, new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002); // HWND_TOPMOST, SWP_NOSIZE | SWP_NOMOVE
                SetWindowPos(hWnd, new IntPtr(-2), 0, 0, 0, 0, 0x0001 | 0x0002); // HWND_NOTOPMOST

                SetForegroundWindow(hWnd);
                BringWindowToTop(hWnd);
            }
            catch { }
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
        private void ForceDeleteDirectory(string path)
        {
            if (!Directory.Exists(path)) return;
            try
            {
                GC.Collect();
                GC.WaitForPendingFinalizers();
                Directory.Delete(path, true);
            }
            catch
            {
                try
                {
                    // Se o WebView2 estiver segurando arquivos (travando a exclusão),
                    // Nós movemos e renomeamos a pasta. Isso a desconecta da conta,
                    // resolvendo o bug. O Windows apagará esse "lixo" quando fechar o app.
                    string trashPath = path + "_deleted_" + Guid.NewGuid().ToString("N");
                    Directory.Move(path, trashPath);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[ForceDelete] Falha ao mover pasta travada: {ex.Message}");
                }
            }
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

            Dispatcher.BeginInvoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(new { type = "showLoadingCards", count = platformGames.Count, tab = "games" })));

            await AddMultipleGamesAsync(platformGames).ConfigureAwait(false);
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

                    string? gridUrl = null, horizontalUrl = null, heroUrl = null, logoUrl = null;

                    try
                    {
                        (gridUrl, horizontalUrl, heroUrl, logoUrl) = await FetchSteamGridAssetsAsync(app.Name);
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[MediaExe] Arte não encontrada para {app.Name}: {ex.Message}");
                    }

                    string safeName = id;

                    // DOWNLOAD EM PARALELO DOS 4 ASSETS
                    var tGrid = gridUrl != null ? DownloadImageAsync(gridUrl, gridFolder, safeName) : Task.FromResult<string?>(null);
                    var tHoriz = horizontalUrl != null ? DownloadImageAsync(horizontalUrl, gridHorizontalFolder, safeName + "_h") : Task.FromResult<string?>(null);
                    var tHero = heroUrl != null ? DownloadImageAsync(heroUrl, heroFolder, safeName) : Task.FromResult<string?>(null);
                    var tLogo = logoUrl != null ? DownloadImageAsync(logoUrl, logoFolder, safeName + "_logo") : Task.FromResult<string?>(null);

                    await Task.WhenAll(tGrid, tHoriz, tHero, tLogo);

                    existing.Add(new MediaAppModel
                    {
                        Id = id,
                        Name = app.Name,
                        Url = key,
                        Type = "exe",
                        MultiUser = false,
                        OwnerUserId = currentUserId,
                        ShareMode = "private",
                        GridImage = tGrid.Result != null ? $"https://data.local/images/grid/{Path.GetFileName(tGrid.Result)}" : "",
                        GridHorizontalImage = tHoriz.Result != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(tHoriz.Result)}" : "",
                        HeroImage = tHero.Result != null ? $"https://data.local/images/hero/{Path.GetFileName(tHero.Result)}" : "",
                        LogoImage = tLogo.Result != null ? $"https://data.local/images/logo/{Path.GetFileName(tLogo.Result)}" : "",
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
                    _ = Task.Run(async () =>
                    {
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
                if (action == "exitApp")
                {
                    ReleaseAllStuckKeys();
                    
                    Dispatcher.Invoke(() => Application.Current.Shutdown());
                }
                else if (action == "shutdownSystem")
                {
                    ReleaseAllStuckKeys();
                  
                    Process.Start(new ProcessStartInfo("shutdown.exe", "/s /t 0") { UseShellExecute = false, CreateNoWindow = true });
                    Dispatcher.Invoke(() => Application.Current.Shutdown());
                }
                else if (action == "restartSystem")
                {
                    ReleaseAllStuckKeys();
                  
                    Process.Start(new ProcessStartInfo("shutdown.exe", "/r /t 0") { UseShellExecute = false, CreateNoWindow = true });
                    Dispatcher.Invoke(() => Application.Current.Shutdown());
                }
                else if (action == "suspendSystem")
                {
                    ReleaseAllStuckKeys();
                  
                    SetSuspendState(false, true, true);
                }
                else if (action == "updateVkbTranslations")
                {
                    _vkbStrBackspace = GetStr(root, "vkbBackspace", "Apagar");
                    _vkbStrEnter = GetStr(root, "vkbEnter", "Enter");
                    _vkbStrClose = GetStr(root, "vkbClose", "Fechar");
                    _vkbStrShift = GetStr(root, "vkbShift", "Maiúsc");
                    _vkbStrSpace = GetStr(root, "vkbSpace", "Espaço");
                    _vkbStrSym = GetStr(root, "vkbSym", "&123");
                    _vkbStrAbc = GetStr(root, "vkbAbc", "ABC");


                    if (_desktopVkb != null)
                    {
                        Dispatcher.Invoke(() => _desktopVkb.SetLocalization(
                            _vkbStrBackspace, _vkbStrEnter, _vkbStrClose,
                            _vkbStrShift, _vkbStrSpace, _vkbStrSym, _vkbStrAbc));
                    }
                }
                else if (action == "updateExtension")
                {
                    string id = GetStr(root, "id");
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            var ext = LoadBrowserExtensions().FirstOrDefault(e => string.Equals(e.Id, id, StringComparison.OrdinalIgnoreCase));
                            if (ext != null)
                            {
                                // Baixa e sobrescreve
                                await InstallChromeExtensionAsync(ext.SourceUrl);

                                // Refaz a checagem (a bolinha vermelha vai sumir)
                                await CheckAndSendExtensionUpdatesAsync();

                                SendExtensionsToUI("success", "Extensão atualizada! Terá efeito ao abrir um app.");
                            }
                        }
                        catch (Exception ex)
                        {
                            SendExtensionsToUI("error", "Erro ao atualizar: " + ex.Message);
                        }
                    });
                }
                else if (action == "requestBootMode")
                {
                    SendBootModeToUI();
                }
                else if (action == "setBootMode" && root.TryGetProperty("mode", out var modeEl))
                {
                    SetBootMode(modeEl.GetInt32());
                    SendBootModeToUI();
                }
                else if (action == "openSignInOptions")
                {
                    try
                    {
                        // Abre a janela de Opções de Entrada
                        Process.Start(new ProcessStartInfo("ms-settings:signinoptions") { UseShellExecute = true });

                        // Minimiza o Doorpi e assume o controle como Mouse/Teclado
                        Dispatcher.Invoke(EnterDesktopMode);

                        // O "_ =" descarta o aviso do compilador indicando que é um Fire-And-Forget intencional
                        _ = Task.Run(async () =>
                        {
                            bool appFound = false;

                            // Aguarda até 10 segundos para a janela de Configurações abrir
                            for (int i = 0; i < 20; i++)
                            {
                                await Task.Delay(500);
                                if (Process.GetProcessesByName("SystemSettings").Length > 0)
                                {
                                    appFound = true;

                                    Dispatcher.Invoke(() =>
                                    {
                                        // Força a janela a maximizar
                                        IntPtr fgHwnd = GetForegroundWindow();
                                        if (fgHwnd != IntPtr.Zero)
                                        {
                                            ShowWindow(fgHwnd, 3);
                                        }

                                        // Joga o mouse pro canto direito (área vazia segura) na metade da tela
                                        int safeX = (int)SystemParameters.PrimaryScreenWidth - 20;
                                        int safeY = (int)SystemParameters.PrimaryScreenHeight / 2;
                                        SetCursorPos(safeX, safeY);

                                        // Envia um Clique Esquerdo Rápido para roubar o foco do UWP
                                        // (0x0002 = MOUSEEVENTF_LEFTDOWN | 0x0004 = MOUSEEVENTF_LEFTUP)
                                        SendMouse(0, 0, 0x0002);
                                        SendMouse(0, 0, 0x0004);
                                    });
                                    break;
                                }
                            }

                            if (!appFound) return;

                            // Monitora a cada segundo até o usuário fechar a janela
                            while (_systemControllerActive)
                            {
                                await Task.Delay(1000);
                                if (Process.GetProcessesByName("SystemSettings").Length == 0)
                                {
                                    // A janela fechou! Tira do modo Desktop e volta pro Doorpi
                                    Dispatcher.Invoke(() =>
                                    {
                                        if (_systemControllerActive)
                                        {
                                            ExitDesktopMode();
                                        }
                                    });
                                    break;
                                }
                            }
                        });
                    }
                    catch (Exception ex) { Debug.WriteLine($"Erro ao abrir config de contas: {ex.Message}"); }
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

                            StartDialogControllerMode();
                            bool? dialogResult = dlg.ShowDialog();
                            StopDialogControllerMode();

                            if (dialogResult == true)
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

                            StartDialogControllerMode();
                            bool? dialogResult = dlg.ShowDialog();
                            StopDialogControllerMode();

                            if (dialogResult == true)
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
                    _ = Task.Run(() =>
                    {
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

                            StartDialogControllerMode();
                            bool? dialogResult = dlg.ShowDialog();
                            StopDialogControllerMode();

                            if (dialogResult == true)
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

                                _ = Task.Run(async () =>
                                {
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

                            StartDialogControllerMode();
                            bool? dialogResult = dlg.ShowDialog();
                            StopDialogControllerMode();

                            if (dialogResult == true)
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
                                _ = Task.Run(async () =>
                                {
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

                        _ = Task.Run(async () =>
                        {
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
                    bool isMedia = root.TryGetProperty("isMedia", out var isMediaEl) && isMediaEl.GetBoolean();

                    if (!string.IsNullOrEmpty(gameId))
                    {
                        if (!isMedia)
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

                                // Puxa o 13º da fila para preencher o buraco, após a animação do Front terminar (350ms)
                                _ = Task.Run(async () =>
                                {
                                    await Task.Delay(350);
                                    Dispatcher.Invoke(() => LoadGamesIntoUI());
                                });
                            }
                        }
                        else
                        {
                            // MÍDIAS
                            if (gameId.Equals("youtube", StringComparison.OrdinalIgnoreCase)) return;

                            var medias = LoadMediaApps();
                            var media = medias.FirstOrDefault(m => string.Equals(m.Id, gameId, StringComparison.OrdinalIgnoreCase) || string.Equals(m.Url, gameId, StringComparison.OrdinalIgnoreCase));

                            if (media != null)
                            {
                                DeleteMediaImages(media);
                                medias.Remove(media);
                                SaveMediaApps(medias);
                                Debug.WriteLine($"[deleteGame] Mídia Removida: {gameId}");

                                // Apagar Cache físico do WebView2
                                try
                                {
                                    var nativeApp = _nativeApps.FirstOrDefault(a => media.Url.Contains(a.Id));
                                    if (nativeApp != default && nativeApp.Id != "youtube")
                                    {
                                        string profileName = nativeApp.MultiUser ? $"shared-{nativeApp.Id}" : $"{currentUserId}-{nativeApp.Id}";
                                        string cachePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "browser-profiles", profileName);

                                        if (Directory.Exists(cachePath))
                                        {
                                            GC.Collect();
                                            GC.WaitForPendingFinalizers();
                                            Directory.Delete(cachePath, true);
                                        }
                                    }
                                }
                                catch (Exception ex) { Debug.WriteLine($"[deleteGame] Erro cache: {ex.Message}"); }

                                // Atualiza a fila de mídia para preencher o buraco
                                _ = Task.Run(async () =>
                                {
                                    await Task.Delay(350);
                                    Dispatcher.Invoke(() => SendMediaAppsToUI(LoadMediaApps()));
                                });
                            }
                        }
                    }
                }
                else if (action == "editGame" && root.TryGetProperty("gameId", out var editIdEl))
                {
                    string gameId = editIdEl.GetString() ?? "";
                    bool hasNewName = root.TryGetProperty("newName", out var editNameEl);
                    string newName = hasNewName ? (editNameEl.GetString() ?? "") : "";
                    bool hasDisableGamepad = root.TryGetProperty("disableGamepadControl", out var dgcEl);

                    if (!string.IsNullOrEmpty(gameId))
                    {
                        var games = LoadGames();
                        var game = games.FirstOrDefault(g =>
                            string.Equals(g.Path, gameId, StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(g.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase));

                        if (game != null)
                        {
                            if (hasNewName && !string.IsNullOrEmpty(newName))
                            {
                                game.Name = newName;
                                SaveGames(games);
                                Debug.WriteLine($"[editGame] '{game.Path}' renomeado para: {newName}");
                            }
                        }
                        else
                        {
                            if (gameId.Equals("youtube", StringComparison.OrdinalIgnoreCase)) return;

                            var medias = LoadMediaAppsForUser(currentUserId);
                            var media = medias.FirstOrDefault(m =>
                                string.Equals(m.Id, gameId, StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(m.Url, gameId, StringComparison.OrdinalIgnoreCase));

                            if (media != null)
                            {
                                bool changed = false;
                                if (hasNewName && !string.IsNullOrEmpty(newName))
                                {
                                    media.Name = newName;
                                    changed = true;
                                    Debug.WriteLine($"[editGame] Mídia renomeada para: {newName}");
                                }
                                if (hasDisableGamepad)
                                {
                                    media.DisableGamepadControl = dgcEl.GetBoolean();
                                    changed = true;
                                    Debug.WriteLine($"[editGame] DisableGamepadControl={media.DisableGamepadControl} para: {gameId}");
                                }
                                if (changed) SaveMediaApps(medias);
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
                                // O Segredo 1: Executa a validação das mídias simultaneamente para TODOS os usuários
                                var initTasks = new List<Task>();
                                foreach (var item in savedProfiles)
                                {
                                    string mediaPath = Path.Combine(dataFolder, "users", item.Profile.Id, "media.json");
                                    initTasks.Add(InitializeNativeAppsAsync(item.Profile.Id, mediaPath, silent: true));
                                }

                                await Task.WhenAll(initTasks).ConfigureAwait(false);

                                if (wasEmpty)
                                {
                                    await UpdateAppCacheAsync().ConfigureAwait(false);
                                }

                                Dispatcher.BeginInvoke(() =>
                                {
                                    LoadCurrentUserIntoUI();
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideSystemLoading\"}");
                                });
                            }
                            catch (Exception ex)
                            {
                                Debug.WriteLine("[SetupBatch] Erro: " + ex.Message);
                                Dispatcher.BeginInvoke(() =>
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideSystemLoading\"}"));
                            }
                        });
                    }
                }
                else if (action == "deleteCurrentUser")
                {
                    var users = LoadUserProfiles();
                    var userToRemove = users.FirstOrDefault(u => string.Equals(u.Id, currentUserId, StringComparison.OrdinalIgnoreCase));

                    if (userToRemove != null)
                    {
                        users.Remove(userToRemove);
                        SaveUserProfiles(users);

                        // Apaga arquivos pessoais da conta
                        try
                        {
                            string userDir = Path.Combine(dataFolder, "users", userToRemove.Id);
                            if (Directory.Exists(userDir))
                            {
                                GC.Collect();
                                GC.WaitForPendingFinalizers();
                                Directory.Delete(userDir, true);
                            }
                        }
                        catch (Exception ex) { Debug.WriteLine($"Erro ao deletar pasta do usuário: {ex.Message}"); }

                        // Apaga todos os caches Webviews dessa conta em específico
                        try
                        {
                            string safeName = string.IsNullOrWhiteSpace(userToRemove.Name) ? "default" : string.Concat(userToRemove.Name.Where(c => !Path.GetInvalidFileNameChars().Contains(c)));
                            string profilesDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "browser-profiles");
                            if (Directory.Exists(profilesDir))
                            {
                                foreach (var dir in Directory.GetDirectories(profilesDir))
                                {
                                    if (Path.GetFileName(dir).StartsWith($"{safeName}-"))
                                    {
                                        Directory.Delete(dir, true);
                                    }
                                }
                            }
                        }
                        catch (Exception ex) { Debug.WriteLine($"Erro ao deletar caches do usuário: {ex.Message}"); }
                    }

                    if (users.Count > 0)
                    {
                        Dispatcher.Invoke(() =>
                        {
                            ClearHomeUi();
                            SendUsersToUI(requireSelection: true);
                        });
                    }
                    else
                    {
                        currentUserId = "";
                        if (File.Exists(currentUserFile)) File.Delete(currentUserFile);

                        // LIMPEZA DEFINITIVA PARA EVITAR O BUG DO "GHOST ACCOUNT":
                        // Deleta os arquivos da pasta raiz para forçar o sistema a abrir do absoluto zero.
                        if (File.Exists(Path.Combine(dataFolder, "user.json"))) File.Delete(Path.Combine(dataFolder, "user.json"));
                        if (File.Exists(Path.Combine(dataFolder, "games.json"))) File.Delete(Path.Combine(dataFolder, "games.json"));
                        if (File.Exists(Path.Combine(dataFolder, "folders.json"))) File.Delete(Path.Combine(dataFolder, "folders.json"));
                        if (File.Exists(Path.Combine(dataFolder, "appcache.json"))) File.Delete(Path.Combine(dataFolder, "appcache.json"));
                        if (File.Exists(Path.Combine(dataFolder, "media.json"))) File.Delete(Path.Combine(dataFolder, "media.json"));

                        Dispatcher.Invoke(() =>
                        {
                            ClearHomeUi();
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"showSetup\"}");
                        });
                    }


                    if (users.Count > 0)
                    {
                        // Sobraram contas? Volta pra tela de Trocar de Conta (Users List)
                        Dispatcher.Invoke(() =>
                        {
                            ClearHomeUi();
                            SendUsersToUI(requireSelection: true);
                        });
                    }
                    else
                    {
                        // Zerou os usuários? Limpa os arquivos bases e força a tela de Setup Inicial
                        currentUserId = "";
                        if (File.Exists(currentUserFile)) File.Delete(currentUserFile);

                        Dispatcher.Invoke(() =>
                        {
                            ClearHomeUi();
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"showSetup\"}");
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
                        // ----- LÓGICA INFALÍVEL DE RENOMEAR CACHES (Webview Profiles) -----
                        string oldSafeName = string.IsNullOrWhiteSpace(existingUser.Name) ? "default" : string.Concat(existingUser.Name.Where(c => !Path.GetInvalidFileNameChars().Contains(c)));
                        string newSafeName = string.IsNullOrWhiteSpace(profile.Name) ? "default" : string.Concat(profile.Name.Where(c => !Path.GetInvalidFileNameChars().Contains(c)));

                        if (!string.Equals(oldSafeName, newSafeName, StringComparison.OrdinalIgnoreCase))
                        {
                            try
                            {
                                string profilesDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "browser-profiles");
                                if (Directory.Exists(profilesDir))
                                {
                                    foreach (var dir in Directory.GetDirectories(profilesDir))
                                    {
                                        string dirName = Path.GetFileName(dir);
                                        if (dirName.StartsWith($"{oldSafeName}-", StringComparison.OrdinalIgnoreCase))
                                        {
                                            string suffix = dirName.Substring(oldSafeName.Length + 1);
                                            string newPath = Path.Combine(profilesDir, $"{newSafeName}-{suffix}");
                                            if (!Directory.Exists(newPath))
                                            {
                                                try { Directory.Move(dir, newPath); } catch { }
                                            }
                                        }
                                    }
                                }
                            }
                            catch (Exception ex) { Debug.WriteLine($"Erro ao renomear caches: {ex.Message}"); }
                        }
                        // --------------------------------------------------------

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
                        string taskUserId = profile.Id;
                        string taskMediaFile = Path.Combine(dataFolder, "users", taskUserId, "media.json");

                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await InitializeNativeAppsAsync(taskUserId, taskMediaFile);
                                if (isPrimary) { await UpdateAppCacheAsync(); await AutoAddPlatformGamesAsync(); }
                                if (isLast)
                                {
                                    Dispatcher.Invoke(() =>
                                    {
                                        LoadCurrentUserIntoUI();
                                        webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideSystemLoading\"}");
                                    });
                                }
                            }
                            catch (Exception ex) { Debug.WriteLine("[Setup] Erro: " + ex.Message); }
                        });
                    }
                    else
                    {
                        Dispatcher.Invoke(() =>
                        {
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                            {
                                type = "currentUserUpdated",
                                user = profile
                            }));
                        });
                    }
                }
                else if (action == "deleteCurrentUser")
                {
                    var users = LoadUserProfiles();
                    var userToRemove = users.FirstOrDefault(u => string.Equals(u.Id, currentUserId, StringComparison.OrdinalIgnoreCase));

                    if (userToRemove != null)
                    {
                        users.Remove(userToRemove);
                        SaveUserProfiles(users);

                        ForceDeleteDirectory(Path.Combine(dataFolder, "users", userToRemove.Id));

                      
                        try
                        {
                            string safeName = string.IsNullOrWhiteSpace(userToRemove.Name) ? "default" : string.Concat(userToRemove.Name.Where(c => !Path.GetInvalidFileNameChars().Contains(c)));
                            string profilesDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "browser-profiles");
                            if (Directory.Exists(profilesDir))
                            {
                                foreach (var dir in Directory.GetDirectories(profilesDir))
                                {
                                    if (Path.GetFileName(dir).StartsWith($"{safeName}-", StringComparison.OrdinalIgnoreCase))
                                    {
                                        ForceDeleteDirectory(dir);
                                    }
                                }
                            }
                        }
                        catch (Exception ex) { Debug.WriteLine($"Erro ao limpar caches do usuário: {ex.Message}"); }
                    }

                    if (users.Count > 0)
                    {
                        Dispatcher.Invoke(() =>
                        {
                            ClearHomeUi();
                            SendUsersToUI(requireSelection: true);
                        });
                    }
                    else
                    {
                        currentUserId = "";
                        if (File.Exists(currentUserFile)) File.Delete(currentUserFile);

                        // DELETA ARQUIVOS FANTASMAS DA RAIZ PARA IMPEDIR O BUG DE RESSURREIÇÃO
                        string[] ghostFiles = { "user.json", "games.json", "folders.json", "appcache.json", "media.json" };
                        foreach (var file in ghostFiles)
                        {
                            string fp = Path.Combine(dataFolder, file);
                            if (File.Exists(fp)) File.Delete(fp);
                        }

                        Dispatcher.Invoke(() =>
                        {
                            ClearHomeUi();
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"showSetup\"}");
                        });
                    }
                }
                else if (action == "requestUsers")
                {
                    SendUsersToUI(requireSelection: false);
                }
                else if (action == "requestUsersData")
                {
                    SendUsersDataToUI();
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
                else if (action == "requestIntros")
                {
                    SendIntrosToUI();
                }
                else if (action == "setActiveIntro")
                {
                    SetActiveIntro(GetStr(root, "id"));
                    SendIntrosToUI();
                }
                else if (action == "requestExtensionUpdates")
                {
                    _ = Task.Run(CheckAndSendExtensionUpdatesAsync);
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
                else if (action == "deleteExtension")
                {
                    string id = GetStr(root, "id");
                    _ = Task.Run(() =>
                    {
                        try
                        {
                            DeleteExtension(id);
                            SendExtensionsToUI("success", "Extensão removida. As mudanças terão efeito na próxima vez que abrir um app.");
                        }
                        catch (Exception ex)
                        {
                            SendExtensionsToUI("error", "Erro ao remover: " + ex.Message);
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
                    var users = LoadUserProfiles();
                    var sharedWithUserIds = new List<string>();
                    if (root.TryGetProperty("sharedWithUserIds", out var sharedIdsEl) && sharedIdsEl.ValueKind == JsonValueKind.Array)
                    {
                        sharedWithUserIds = sharedIdsEl.EnumerateArray()
                            .Select(e => e.GetString() ?? "")
                            .Where(id => !string.IsNullOrWhiteSpace(id) && !string.Equals(id, currentUserId, StringComparison.OrdinalIgnoreCase))
                            .Distinct(StringComparer.OrdinalIgnoreCase)
                            .ToList();
                    }
                    else
                    {
                        string sharedWithUserId = GetStr(root, "sharedWithUserId");
                        if (!string.IsNullOrWhiteSpace(sharedWithUserId) && !string.Equals(sharedWithUserId, currentUserId, StringComparison.OrdinalIgnoreCase))
                            sharedWithUserIds.Add(sharedWithUserId);
                    }

                    var apps = LoadMediaAppsForUser(currentUserId);
                    var app = apps.FirstOrDefault(a => string.Equals(a.Id, appId, StringComparison.OrdinalIgnoreCase) ||
                                                       string.Equals(a.Url, appId, StringComparison.OrdinalIgnoreCase));
                    if (app != null && !app.IsSharedFromOtherUser)
                    {
                        if (!string.Equals(app.Type, "browser", StringComparison.OrdinalIgnoreCase) &&
                            !string.Equals(app.Type, "webview", StringComparison.OrdinalIgnoreCase))
                            return;

                        var before = CloneMediaApp(app);
                        if (string.IsNullOrWhiteSpace(before.OwnerUserId)) before.OwnerUserId = currentUserId;
                        app.OwnerUserId = currentUserId;
                        app.ShareMode = shareMode is "all" or "user" ? shareMode : "private";
                        if (app.ShareMode == "user" && sharedWithUserIds.Count == 0)
                            app.ShareMode = "private";
                        app.SharedWithUserIds = app.ShareMode == "user" ? sharedWithUserIds : new List<string>();
                        app.SharedWithUserId = app.SharedWithUserIds.FirstOrDefault() ?? "";
                        app.SharedWithUserNames = app.ShareMode == "user"
                            ? app.SharedWithUserIds
                                .Select(id => users.FirstOrDefault(u => string.Equals(u.Id, id, StringComparison.OrdinalIgnoreCase))?.Name ?? "")
                                .Where(name => !string.IsNullOrWhiteSpace(name))
                                .ToList()
                            : new List<string>();
                        app.SharedWithUserName = app.SharedWithUserNames.FirstOrDefault() ?? "";
                        PrepareBrowserProfileForSharingChange(before, app);
                        SaveMediaApps(apps);
                        SendUsersDataToUI();
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

                        StartDialogControllerMode();
                        bool? dialogResult = dlg.ShowDialog();
                        StopDialogControllerMode();

                        if (dialogResult == true)
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


                            Dispatcher.InvokeAsync(() => SendMediaAppsToUI(LoadMediaApps()));
                        }

                        if (appType == "webview" || appType == "browser")
                        {
                            if (_mediaExeModeActive || _mediaExeProcess != null) ExitMediaExeMode();

                            string mediaName = media?.Name ?? "App";
                            string heroImg = media?.HeroImage ?? "";
                            string gridImg = media?.GridImage ?? "";
                            _ = Dispatcher.InvokeAsync(async () => await OpenWebViewInlineAsync(mediaUrl, mediaUrl.Contains("youtube.com"), mediaName, heroImg, gridImg));

                            // TESTE: mesmo modo gamepad dos apps exe (mouse nativo + VKB C#, sem watcher de processo)
       
                        }
                        else if (appType == "exe")
                        {
                            Dispatcher.Invoke(() =>
                            {
                                try
                                {
                                    string mediaName = media?.Name ?? "App";
                                    string heroImg = media?.HeroImage ?? "";
                                    string gridImg = media?.GridImage ?? "";

                                    // ── Já está rodando? Restaura em vez de relançar ─────────────
                                    Process? existingProc = null;

                                    if (_mediaExeProcess != null && !SafeHasExited(_mediaExeProcess) &&
                                        string.Equals(_mediaExeCurrentUrl, mediaUrl, StringComparison.OrdinalIgnoreCase))
                                    {
                                        existingProc = _mediaExeProcess;
                                    }
                                    else if (File.Exists(mediaUrl))
                                    {
                                        existingProc = FindRunningProcessForExe(mediaUrl);
                                    }

                                    if (existingProc != null)
                                    {
                                        IntPtr hwnd = FindVisibleWindowForProcess(existingProc.Id);

                                        if (hwnd != IntPtr.Zero)
                                        {
                                            if (_mediaExeProcess != null && _mediaExeProcess.Id != existingProc.Id)
                                                ExitMediaExeMode();

                                            _mediaExeWatcherCts?.Cancel();
                                            _mediaExeWatcherCts = new CancellationTokenSource();
                                            _mediaExeProcess = existingProc;
                                            _mediaExeCurrentUrl = mediaUrl;
                                            _mediaExeWatcherPaused = false;
                                            _mediaExeGamepadDisabled = (media?.DisableGamepadControl == true);

                                            SendGameLaunchStatus("gameLaunching", mediaName, heroImg, gridImg);

                                            if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
                                            ShowWindow(hwnd, 3);
                                            FocusExternalWindow(hwnd);

                                            StartMediaExeWatcher(existingProc, mediaUrl, mediaName, _mediaExeWatcherCts.Token);

                                            if (!_mediaExeGamepadDisabled && !_mediaExeModeActive)
                                            {
                                                _mediaExeModeActive = true;
                                                EnsureCursorVisible();
                                                int sessionId = Interlocked.Increment(ref _mediaExeSessionId);
                                                _mediaExeThread = new Thread(() => MediaExeControllerLoop(sessionId)) { IsBackground = true };
                                                _mediaExeThread.Start();
                                            }
                                            return;
                                        }
                                    }

                                    // ── Lança um processo novo ────────────────────────────────────
                                    if (_mediaExeModeActive || _mediaExeProcess != null) ExitMediaExeMode();
                                    _mediaExeWatcherCts?.Cancel();
                                    _mediaExeWatcherPaused = true;

                                    Process? proc = null;
                                    if (File.Exists(mediaUrl))
                                    {
                                        proc = Process.Start(new ProcessStartInfo
                                        {
                                            FileName = mediaUrl,
                                            UseShellExecute = true,
                                            WorkingDirectory = Path.GetDirectoryName(mediaUrl)
                                        });
                                    }
                                    else if (!string.IsNullOrWhiteSpace(mediaUrl))
                                    {
                                        EnsureLauncherRunning(mediaUrl);
                                        proc = Process.Start(new ProcessStartInfo(mediaUrl) { UseShellExecute = true });
                                    }

                                    if (proc != null)
                                    {
                                        _mediaExeGamepadDisabled = (media?.DisableGamepadControl == true);

                                        if (!_mediaExeGamepadDisabled)
                                        {
                                            EnterMediaExeMode(proc, mediaUrl, mediaName, heroImg, gridImg);
                                        }
                                        else
                                        {
                                            SendGameLaunchStatus("gameLaunching", mediaName, heroImg, gridImg);
                                            _mediaExeWatcherCts = new CancellationTokenSource();
                                            _mediaExeProcess = proc;
                                            _mediaExeCurrentUrl = mediaUrl;
                                            _mediaExeWatcherPaused = false;

                                            StartMediaExeWatcher(proc, mediaUrl, mediaName, _mediaExeWatcherCts.Token);
                                        }
                                    }
                                }
                                catch (Exception ex) { Debug.WriteLine($"[launchMediaApp/exe] {ex.Message}"); }
                            });
                        }
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

                        StartDialogControllerMode();
                        bool? dialogResult = dlg.ShowDialog();
                        StopDialogControllerMode();

                        if (dialogResult == true)
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


                var (gridUrl, gridHorizontalUrl, heroUrl, logoUrl) = await FetchSteamGridAssetsAsync(app.Name, steamAppId).ConfigureAwait(false);

                await Task.Delay(150).ConfigureAwait(false);

                string safeName = app.Path.GetHashCode().ToString();

                // DOWNLOAD EM PARALELO DOS 4 ASSETS
                var tGrid = gridUrl != null ? DownloadImageAsync(gridUrl, gridFolder, safeName) : Task.FromResult<string?>(null);
                var tHoriz = gridHorizontalUrl != null ? DownloadImageAsync(gridHorizontalUrl, gridHorizontalFolder, safeName + "_h") : Task.FromResult<string?>(null);
                var tHero = heroUrl != null ? DownloadImageAsync(heroUrl, heroFolder, safeName) : Task.FromResult<string?>(null);
                var tLogo = logoUrl != null ? DownloadImageAsync(logoUrl, logoFolder, safeName + "_logo") : Task.FromResult<string?>(null);

                await Task.WhenAll(tGrid, tHoriz, tHero, tLogo).ConfigureAwait(false);

                var game = new GameModel
                {
                    Name = app.Name,
                    Path = app.Path,
                    LaunchUrl = app.LaunchUrl,
                    GridImage = tGrid.Result != null ? $"https://data.local/images/grid/{Path.GetFileName(tGrid.Result)}" : "",
                    GridHorizontalImage = tHoriz.Result != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(tHoriz.Result)}" : "",
                    HeroImage = tHero.Result != null ? $"https://data.local/images/hero/{Path.GetFileName(tHero.Result)}" : "",
                    LogoImage = tLogo.Result != null ? $"https://data.local/images/logo/{Path.GetFileName(tLogo.Result)}" : "",
                    LastPlayed = DateTime.MinValue,
                    DateAdded = DateTime.Now
                };

                existingGames.Add(game);
                dbChanged = true;
            }

            if (dbChanged)
            {
                SaveGames(existingGames);
                Dispatcher.BeginInvoke(() => LoadGamesIntoUI());
            }

            Dispatcher.BeginInvoke(() =>
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

                // REDUZIDO DE 10 PARA 3: Se não achar nos 3 primeiros resultados, desiste mais rápido para não travar a fila
                foreach (var game in results.EnumerateArray().Take(3))
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

        private static bool IsLocalFileAnimated(string localFilePath)
        {
            if (string.IsNullOrEmpty(localFilePath) || !File.Exists(localFilePath))
                return false;
            try
            {
                var header = new byte[256];
                using var fs = new FileStream(localFilePath, FileMode.Open,
                                               FileAccess.Read, FileShare.Read);
                int read = fs.Read(header, 0, header.Length);

                // GIF: magic bytes G I F
                if (read >= 3 && header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46)
                    return true;

                // APNG: chunk acTL | WebP ANIM
                byte[] ACTL = { 0x61, 0x63, 0x54, 0x4C };
                byte[] ANIM = { 0x41, 0x4E, 0x49, 0x4D };
                for (int i = 0; i < read - 4; i++)
                {
                    if (header[i] == ACTL[0] && header[i + 1] == ACTL[1] &&
                        header[i + 2] == ACTL[2] && header[i + 3] == ACTL[3]) return true;
                    if (header[i] == ANIM[0] && header[i + 1] == ANIM[1] &&
                        header[i + 2] == ANIM[2] && header[i + 3] == ANIM[3]) return true;
                }
            }
            catch { }
            return false;
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
                if (_mediaExeModeActive || _mediaExeProcess != null) ExitMediaExeMode();

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

                    var processSnapshot = SnapshotProcessIds();
                    Process? launched = null;
                    bool launchAttempted = false;
                    SuspendMainUiGamepadForGameLaunch();

                    if (!string.IsNullOrWhiteSpace(game.LaunchUrl) &&
                        game.LaunchUrl.StartsWith("goggalaxy://", StringComparison.OrdinalIgnoreCase))
                    {
                        string gogClientPath = "";
                        using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\GOG.com\GalaxyClient\paths"))
                            gogClientPath = (key?.GetValue("client") as string ?? "").Replace("\"", "").Trim();

                        string gameId = game.LaunchUrl.Replace("goggalaxy://launch/", "").Trim();

                        if (File.Exists(gogClientPath))
                        {
                            launchAttempted = true;
                            launched = Process.Start(new ProcessStartInfo
                            {
                                FileName = gogClientPath,
                                Arguments = $"/command=launch /gameId={gameId}",
                                UseShellExecute = true
                            });
                        }
                        else
                        {
                            launchAttempted = true;
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
                            launchAttempted = true;
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
                        launchAttempted = true;
                        launched = Process.Start(new ProcessStartInfo(game.LaunchUrl) { UseShellExecute = true });
                    }
                    else if (File.Exists(game.Path))
                    {
                        launchAttempted = true;
                        launched = Process.Start(new ProcessStartInfo
                        {
                            FileName = game.Path,
                            UseShellExecute = true,
                            WorkingDirectory = Path.GetDirectoryName(game.Path)
                        });
                    }

                    if (launchAttempted)
                    {
                        StartGameLaunchMonitor(game, launched, processSnapshot);

                        _sessionStartUtc = DateTime.UtcNow;
                        _activeSessionGameId = identifier;
                        SendGameLaunchStatus("gameLaunching",
                            game.Name,
                            game.HeroImage ?? "",
                            game.GridImage ?? "");
                    }
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

        // 1. NOVA FUNÇÃO AUXILIAR: Detecta se o jogo é realmente novo ou se é um falso-positivo de migração
        private bool IsGameActuallyNew(DateTime dateAdded, DateTime lastPlayed)
        {
            // Se a data for nula/mínima (arquivos de save antigos sem data), não é novo
            if (dateAdded <= DateTime.MinValue.AddDays(1)) return false;

            // Se já passou de 48 horas reais, definitivamente não é novo
            if ((DateTime.Now - dateAdded).TotalHours >= 48) return false;

            // A MÁGICA AQUI: Se o jogo foi jogado ANTES de ser "adicionado", 
            // significa que é um jogo legado que o sistema tentou colocar a data de hoje. Tira o badge!
            if (lastPlayed > DateTime.MinValue && lastPlayed < dateAdded.AddMinutes(-5)) return false;

            return true;
        }

        private object MapGameToAnonObject(GameModel game, bool isFeatured)
        {
            string localGridPath = string.IsNullOrEmpty(game.GridImage) ? "" :
                Path.Combine(dataFolder,
                    new Uri(game.GridImage).AbsolutePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

            return new
            {
                id = !string.IsNullOrEmpty(game.LaunchUrl) ? game.LaunchUrl : game.Path,
                name = game.Name,
                path = game.Path,
                launchUrl = game.LaunchUrl,
                type = "game",
                imageData = game.GridImage,
                staticImageData = game.GridStaticImage,
                horizontalImage = game.GridHorizontalImage,
                staticHorizontalImage = game.GridHorizontalStaticImage,
                hero = game.HeroImage,
                staticHero = game.HeroStaticImage,
                logo = game.LogoImage,
                staticLogo = game.LogoStaticImage,
                isFeatured = isFeatured,
                isNew = false, // <--- CORREÇÃO APLICADA
                isAnimated = IsLocalFileAnimated(localGridPath),
            };
        }

        private void LoadGamesIntoUI()
        {
            var allGames = LoadGames();
            if (allGames.Count == 0) return;

            var featured = allGames
                .Where(g => g.LastPlayed > DateTime.MinValue)
                .OrderByDescending(g => g.LastPlayed)
                .FirstOrDefault()
                ?? allGames.OrderByDescending(g => g.DateAdded).FirstOrDefault();

            var sortedGames = new List<object>();

            if (featured != null)
            {
                // Adiciona o Featured primeiro (posição 0)
                sortedGames.Add(MapGameToAnonObject(featured, true));


                var others = allGames.Where(g => g != featured)
                    .OrderByDescending(g => g.LastPlayed > g.DateAdded ? g.LastPlayed : g.DateAdded)
                    .Take(11);

                foreach (var game in others)
                {
                    sortedGames.Add(MapGameToAnonObject(game, false));
                }
            }

            var payload = new { type = "renderGames", games = sortedGames };

            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(payload))
            );
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
                isNew = false // <--- CORREÇÃO APLICADA
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
        private Thread? _mainUiGamepadThread;
        private volatile bool _mainUiGamepadActive = false;
        private volatile bool _mainUiGamepadSuspendedForGame = false;
        private long _mainUiGamepadSuppressUntilUtcTicks = 0;
        private IntPtr _mainWindowHandle = IntPtr.Zero;
        private volatile bool _gameSessionActive = false;

        private bool IsDoorpiMainWindowForeground()
        {
            var hwnd = _mainWindowHandle;
            if (hwnd == IntPtr.Zero)
            {
                try
                {
                    Dispatcher.Invoke(() =>
                    {
                        _mainWindowHandle = new System.Windows.Interop.WindowInteropHelper(this).Handle;
                        hwnd = _mainWindowHandle;
                    });
                }
                catch { return false; }
            }

            return hwnd != IntPtr.Zero && GetForegroundWindow() == hwnd;
        }

        private void SuspendMainUiGamepadForGameLaunch(int milliseconds = 15000)
        {
            _mainUiGamepadSuspendedForGame = true;
            Interlocked.Exchange(ref _mainUiGamepadSuppressUntilUtcTicks,
                DateTime.UtcNow.AddMilliseconds(milliseconds).Ticks);
        }

        private bool IsMainUiGamepadSuspendedForGame()
        {
            if (!_mainUiGamepadSuspendedForGame) return false;

            var resumeAt = Interlocked.Read(ref _mainUiGamepadSuppressUntilUtcTicks);
            if (DateTime.UtcNow.Ticks < resumeAt) return true;
            if (!IsDoorpiMainWindowForeground()) return true;

            _mainUiGamepadSuspendedForGame = false;
            Interlocked.Exchange(ref _mainUiGamepadSuppressUntilUtcTicks, 0);
            return false;
        }

        private void StartMainUiGamepadNavigation()
        {
            if (_mainUiGamepadActive) return;
            _mainUiGamepadActive = true;
            _mainUiGamepadThread = new Thread(MainUiGamepadLoop) { IsBackground = true };
            _mainUiGamepadThread.Start();
        }
        private long _returnFromExternalModeSuppressUntil = 0;
        private void MainUiGamepadLoop()
        {
            const int INITIAL_DELAY_MS = 400;
            const int REPEAT_DELAY_MS = 80;
            const double AXIS_THRESHOLD = 0.6;

            int moveState = 0;
            string? currentDir = null;
            DateTime lastMoveTime = DateTime.MinValue;
            ushort prevButtons = 0; // ← NOVO

            while (_mainUiGamepadActive)
            {
                try
                {
                    bool foregroundOk = IsDoorpiMainWindowForeground() ||
                        (DateTime.UtcNow.Ticks - Interlocked.Read(ref _focusRestoredAtTicks))
                        < TimeSpan.FromSeconds(2).Ticks;
                    if (_systemControllerActive || _mediaExeModeActive || _dialogModeActive ||
                                            _mediaMouseActive || !foregroundOk || IsMainUiGamepadSuspendedForGame())
                    {
                        moveState = 0; currentDir = null;
                        if (XInputGetStateSecret(0, out var snap) == 0)
                            prevButtons = snap.Gamepad.wButtons;
                        Thread.Sleep(50); continue;
                    }
                    if (XInputGetStateSecret(0, out var state) != 0) { Thread.Sleep(10); continue; }

                    var gp = state.Gamepad;
                    double ax = gp.sThumbLX / 32767.0;
                    double ay = gp.sThumbLY / 32767.0;
                    ushort btn = gp.wButtons;
                    if (DateTime.UtcNow.Ticks < Interlocked.Read(ref _returnFromExternalModeSuppressUntil))
                    {
                        prevButtons = btn;
                        Thread.Sleep(10);
                        continue;
                    }
                    bool BtnPressed(ushort m) => (btn & m) != 0 && (prevButtons & m) == 0;


                    bool isStartHeld = (btn & 0x0010) != 0;  // Start/Menu
                    bool isSelectHeld = (btn & 0x0020) != 0; // Select/View
                    bool isXboxHeld = (btn & 0x0400) != 0;   // Botão Xbox

                    // 2. Prioridade Máxima: Se for o Combo de Emergência, ignore o resto do loop
                    if ((isStartHeld && isSelectHeld))
                    {
                        // Se estiver segurando o combo, não processamos comandos de navegação ou menu individual
                        prevButtons = btn;
                        Thread.Sleep(10);
                        continue;
                    }

                    // 3. Abre o seletor apenas se NÃO estiver segurando o outro botão do combo
                    // (Prevenindo que o Select sozinho dispare enquanto você tenta apertar Start+Select)
                    if (DateTime.UtcNow.Ticks > Interlocked.Read(ref _returnFromExternalModeSuppressUntil))
                    {
                        // Só abre se apertar Select (sem Start) ou o botão Xbox (que já checamos no pânico acima)
                        if ((BtnPressed(0x0020) && !isStartHeld) || BtnPressed(0x0400))

                        {
                            Dispatcher.BeginInvoke(() =>
                            {
                                if (webView?.CoreWebView2 != null)
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"openUserPicker\"}");
                            });
                        }
                    }

                    string? dir = null;
                    if (ax > AXIS_THRESHOLD || (btn & 0x0008) != 0) dir = "RIGHT";
                    else if (ax < -AXIS_THRESHOLD || (btn & 0x0004) != 0) dir = "LEFT";
                    else if (ay < -AXIS_THRESHOLD || (btn & 0x0002) != 0) dir = "DOWN";
                    else if (ay > AXIS_THRESHOLD || (btn & 0x0001) != 0) dir = "UP";

                    if (dir != null)
                    {
                        byte vk = dir switch { "RIGHT" => 0x27, "LEFT" => 0x25, "DOWN" => 0x28, _ => 0x26 };
                        var now = DateTime.Now;

                        if (dir != currentDir)
                        { SendVirtualKey(vk); lastMoveTime = now; moveState = 1; currentDir = dir; }
                        else if (moveState == 1 && (now - lastMoveTime).TotalMilliseconds > INITIAL_DELAY_MS)
                        { SendVirtualKey(vk); lastMoveTime = now; moveState = 2; }
                        else if (moveState == 2 && (now - lastMoveTime).TotalMilliseconds > REPEAT_DELAY_MS)
                        { SendVirtualKey(vk); lastMoveTime = now; }
                    }
                    else { moveState = 0; currentDir = null; }

                    prevButtons = btn; // ← NOVO
                }
                catch (Exception ex) { Debug.WriteLine($"[MainUiGamepad] {ex.Message}"); }
                Thread.Sleep(10);
            }
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