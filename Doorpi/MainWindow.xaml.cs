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
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
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
        public bool DisableGamepadControlConfigured { get; set; } = false;

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
        public string AddState { get; set; } = "";
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

        [JsonPropertyName("storeAutoAdd")]
        public Dictionary<string, bool>? StoreAutoAdd { get; set; }
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
        public HashSet<string> UbisoftFingerprint { get; set; } = new();
        public HashSet<string> EaFingerprint { get; set; } = new();
        public HashSet<string> BattleNetFingerprint { get; set; } = new();
        public HashSet<string> AmazonFingerprint { get; set; } = new();
        public HashSet<string> XboxFingerprint { get; set; } = new();
        public int XboxFilterVersion { get; set; }
        public List<AutoAddSuppression> AutoAddSuppressions { get; set; } = new();
        public List<InstalledApp> WindowsApps { get; set; } = new();
        public List<InstalledApp> FolderApps { get; set; } = new();
        public List<InstalledApp> SteamApps { get; set; } = new();
        public List<InstalledApp> EpicApps { get; set; } = new();
        public List<InstalledApp> GogApps { get; set; } = new();
        public List<InstalledApp> RiotApps { get; set; } = new();
        public List<InstalledApp> UbisoftApps { get; set; } = new();
        public List<InstalledApp> EaApps { get; set; } = new();
        public List<InstalledApp> BattleNetApps { get; set; } = new();
        public List<InstalledApp> AmazonApps { get; set; } = new();
        public List<InstalledApp> XboxApps { get; set; } = new();
    }

    public class AutoAddSuppression
    {
        public string Key { get; set; } = "";
        public string Source { get; set; } = "";
        public string Name { get; set; } = "";
        public bool MissingSinceDeletion { get; set; }
        public DateTime DeletedAt { get; set; } = DateTime.Now;
    }

    public class FolderStats
    {
        public string Path { get; set; } = "";
        public int SubfolderCount { get; set; }
        public int ExeCount { get; set; }
        public long EstimatedMs { get; set; } = -1; 
    }

    public class LibraryBootstrapState
    {
        public bool PlatformAutoAddCompleted { get; set; }
        public DateTime LastRun { get; set; } = DateTime.MinValue;
        public DateTime CompletedAt { get; set; } = DateTime.MinValue;
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
        private readonly object _gamesFileLock = new();

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
        private string libraryBootstrapFile;

        private readonly List<FileSystemWatcher> _folderWatchers = new();
        private volatile bool _windowsCacheInvalid = false;
        private volatile bool _pollingActive = false;
        private int _libraryBootstrapRunning = 0;
        private int _userSwitchInProgress = 0;
        private bool _interactiveUserSessionStarted = false;

        private readonly SemaphoreSlim _cacheLock = new SemaphoreSlim(1, 1);
        private DateTime _lastCacheBuilt = DateTime.MinValue;

        private bool _mainScreenMouseVisible = false;
        private POINT _lastKnownCursorPos;
        private System.Threading.Timer? _mouseIdleTimer;
        private System.Threading.Timer? _mousePollTimer;
        private const int MOUSE_IDLE_MS = 3000;
        private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);

        [DllImport("user32.dll")]
        private static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        private static extern void SwitchToThisWindow(IntPtr hWnd, bool fUnknown);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool IsChild(IntPtr hWndParent, IntPtr hWnd);

        private const uint WM_SYSCOMMAND = 0x0112;
        private const uint WM_CLOSE = 0x0010;
        private const int SC_MINIMIZE = 0xF020;
        private const int SC_RESTORE = 0xF120;
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left, Top, Right, Bottom;
            public int Width => Right - Left;
            public int Height => Bottom - Top;
        }
        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        private const int GWL_STYLE = -16;
        private const int WS_THICKFRAME = 0x00040000;
        private const int WS_MAXIMIZEBOX = 0x00010000;
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
        [DllImport("winmm.dll")]
        private static extern uint timeBeginPeriod(uint uPeriod);

        [DllImport("winmm.dll")]
        private static extern uint timeEndPeriod(uint uPeriod);

        private const uint TH32CS_SNAPPROCESS = 0x00000002;
        private static readonly IntPtr INVALID_HANDLE_VALUE = new IntPtr(-1);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr CreateToolhelp32Snapshot(uint dwFlags, uint th32ProcessID);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern bool Process32FirstW(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern bool Process32NextW(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr hObject);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct PROCESSENTRY32
        {
            public uint dwSize;
            public uint cntUsage;
            public uint th32ProcessID;
            public IntPtr th32DefaultHeapID;
            public uint th32ModuleID;
            public uint cntThreads;
            public uint th32ParentProcessID;
            public int pcPriClassBase;
            public uint dwFlags;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
            public string szExeFile;
        }

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        private static extern bool IsWindow(IntPtr hWnd);

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

        private long _userShellInteractionUntil = 0;



        // ========================= CONSTRUTOR =========================
        private void ResetCursorForMainScreen()
        {
            // Nunca sequestre o mouse se a janela do Doorpi não estiver realmente ativa
            if (!IsDoorpiMainWindowForeground()) return;

            EnsureCursorVisible();  // Normaliza o contador do Windows
            EnsureCursorHidden();   // Oculta o cursor visualmente
            _mainScreenMouseVisible = false;
            _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
            SetCursorPos(0, 0);     // Estaciona no topo
        }
        public MainWindow()
        {
            RegisterProtocolAndAppId();
            DiscordRpcManager.Instance.Initialize();
            _ = LoadEasyListAsync();
            DiscordRpcManager.Instance.RegisterNativeApps(
    _nativeApps.Select(a => (a.Id, a.Name, a.Url)).ToList());

            this.Closing += (s, e) =>
            {
                CleanupAndExit();
                Application.Current.Shutdown();
                Environment.Exit(0);
            };
            InitializeComponent();


            this.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#020309"));
            webView.DefaultBackgroundColor = System.Drawing.Color.Transparent;
            SourceInitialized += (_, _) =>
            {
                _mainWindowHandle = new System.Windows.Interop.WindowInteropHelper(this).Handle;
                InitializeSmtc();
            };
            this.Activated += (s, e) =>
            {
                if (DateTime.UtcNow.Ticks < Interlocked.Read(ref _returnFromExternalModeSuppressUntil))
                    return;

                bool hasBlockingSession = HasAnyBlockingExternalSession();
                bool shouldMuteDoorpiAudio = ShouldMuteDoorpiAudio();

                if (IsMediaAppAlive())
                {
                    MonitorBackgroundAppDeath();
                }
                else
                {
                    _backgroundAppMonitorCts?.Cancel();
                }

                if (_executionLockWatchSuspended)
                {
                    webView?.Focus();
                    Keyboard.Focus(webView);
                    webView?.CoreWebView2?.ExecuteScriptAsync(
                        "window.isDoorpiFocused = true; window.isMediaAppActive = false; window._doorpiGameInputSuppressedUntil = 0; window.focusFeaturedCard?.();");

                    if (webView?.CoreWebView2 != null)
                        webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new
                            {
                                type = "windowFocused",
                                appAlive = shouldMuteDoorpiAudio,
                                hasBlockingSession,
                                hasLiveExternalSession = shouldMuteDoorpiAudio,
                                shouldMuteDoorpiAudio
                            }));
                    SendRuntimeSessionsToUI();
                    return;
                }

                if (_gameSessionActive &&
                    !_gameIsMinimized &&
                    !string.IsNullOrWhiteSpace(_activeSessionGameId))
                {
                    ShowExecutionLockForGame();
                    SendRuntimeSessionsToUI();
                    return;
                }

                if (!_executionLockActive &&
                    _isStoreLauncherSession &&
                    !(_gameSessionActive &&
                      string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase)) &&
                    !_storePausedByDoorpi &&
                    !IsStoreChildGameBlockingStoreControls() &&
                    IsActiveStoreLauncherProcessAlive())
                {
                    ScheduleStoreExecutionLockIfDoorpiStillForeground();
                    return;
                }

                if (!_executionLockActive &&
                    !string.IsNullOrWhiteSpace(_mediaExeCurrentUrl) &&
                    !_doorpiSuspendedForMedia &&
                    FindAliveMediaExeProcess(_mediaExeCurrentUrl, _mediaExeProcess) != null)
                {
                    ShowExecutionLockForMediaExe();
                    return;
                }

                webView?.Focus();
                Keyboard.Focus(webView);
                webView?.CoreWebView2?.ExecuteScriptAsync(
                    "window.isDoorpiFocused = true; window.isMediaAppActive = false; window._doorpiGameInputSuppressedUntil = 0; window.focusFeaturedCard?.();");

                if (webView?.CoreWebView2 != null)
                    webView.CoreWebView2.PostWebMessageAsString(
                        JsonSerializer.Serialize(new
                        {
                            type = "windowFocused",
                            appAlive = shouldMuteDoorpiAudio,
                            hasBlockingSession,
                            hasLiveExternalSession = shouldMuteDoorpiAudio,
                            shouldMuteDoorpiAudio
                        }));
                SendRuntimeSessionsToUI();
            };
            this.Deactivated += (s, e) =>
            {

                if (DateTime.UtcNow.Ticks < Interlocked.Read(ref _returnFromExternalModeSuppressUntil))
                    return;
                try
                {
                    var core = webView?.CoreWebView2;
                    if (core != null)
                        core.PostWebMessageAsString("{\"type\":\"windowLostFocus\"}");
                }
                catch (ObjectDisposedException) { }
                catch (InvalidOperationException) { }
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
            libraryBootstrapFile = Path.Combine(dataFolder, "library-bootstrap.json");

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

                if (GetCursorInfo(out pci))
                {
                    // Carrega a "barrinha de texto" do sistema
                    IntPtr textCursorHandle = LoadCursor(IntPtr.Zero, IDC_IBEAM);

                    // Em sessões externas o ShowCursor pode oscilar durante foco/click.
                    // O handle do cursor continua sendo a fonte mais estável para IBEAM.
                    return pci.hCursor != IntPtr.Zero && pci.hCursor == textCursorHandle;
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
                Dispatcher.Invoke(() =>
                {
                    if (ShouldMainScreenMouseWatchYield()) return;

                    // A REGRA DE OURO: Só mexe no mouse se o Doorpi estiver em primeiro plano!
                    if (!IsDoorpiMainWindowForeground()) return;

                    if (!_mainScreenMouseVisible) return;
                    _mainScreenMouseVisible = false;

                    // 1. Oculta o cursor visualmente no Windows
                    EnsureCursorHidden();

                    // 2. Estaciona o ponteiro invisível no canto (0, 0)
                    _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                    SetCursorPos(0, 0);
                });
            }, null, Timeout.Infinite, Timeout.Infinite);

            _mousePollTimer = new System.Threading.Timer(_ =>
            {
                if (!GetCursorPos(out var pt)) return;

                // Compara se o usuário mexeu o mouse fisicamente
                if (pt.X == _lastKnownCursorPos.X && pt.Y == _lastKnownCursorPos.Y) return;

                _lastKnownCursorPos = pt;
                Dispatcher.Invoke(() =>
                {
                    if (ShouldMainScreenMouseWatchYield()) return;

                    // Só reage ao movimento se o Doorpi estiver em foco
                    if (!IsDoorpiMainWindowForeground()) return;

                    if (!_mainScreenMouseVisible)
                    {
                        // Exibe o cursor novamente quando movido físico
                        EnsureCursorVisible();
                        _mainScreenMouseVisible = true;
                    }
                });
                _mouseIdleTimer?.Change(MOUSE_IDLE_MS, Timeout.Infinite);
            }, null, 0, 100);
        }

        private bool ShouldMainScreenMouseWatchYield()
        {
            return _systemControllerActive ||
                   _mediaExeModeActive ||
                   _isStoreLauncherSession ||
                   _gameSessionActive;
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
            webView.CoreWebView2.Settings.AreHostObjectsAllowed = false;
            webView.CoreWebView2.PermissionRequested += OnWebViewPermissionRequested;
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

            timeBeginPeriod(1);
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
            if (users.Count > 0) SaveUserProfiles(users);
            if (users.Count == 0 && File.Exists(userFile))
            {
                try
                {
                    var legacy = JsonSerializer.Deserialize<UserProfile>(File.ReadAllText(userFile));
                    if (legacy != null && !string.IsNullOrWhiteSpace(legacy.Name))
                    {
                        UnprotectUserProfile(legacy);
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
                foreach (var user in users)
                    UnprotectUserProfile(user);
                return users;
            }
            catch { return new List<UserProfile>(); }
        }

        private void SaveUserProfiles(List<UserProfile> users)
        {
            var storageUsers = users.Select(CloneUserProfileForStorage).ToList();
            File.WriteAllText(profilesFile, JsonSerializer.Serialize(storageUsers, new JsonSerializerOptions { WriteIndented = true }));
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

        private const string ProtectedValuePrefix = "dpapi:";
        private static readonly byte[] ProtectedValueEntropy =
            System.Text.Encoding.UTF8.GetBytes("Doorpi.LocalUserSecret.v1");

        private static string ProtectLocalUserSecret(string value)
        {
            if (string.IsNullOrEmpty(value) || value.StartsWith(ProtectedValuePrefix, StringComparison.Ordinal))
                return value ?? "";

            try
            {
                var bytes = System.Text.Encoding.UTF8.GetBytes(value);
                var protectedBytes = ProtectedData.Protect(bytes, ProtectedValueEntropy, DataProtectionScope.CurrentUser);
                return ProtectedValuePrefix + Convert.ToBase64String(protectedBytes);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Secrets] Falha ao proteger segredo local: " + ex.Message);
                return value;
            }
        }

        private static string UnprotectLocalUserSecret(string value)
        {
            if (string.IsNullOrEmpty(value) || !value.StartsWith(ProtectedValuePrefix, StringComparison.Ordinal))
                return value ?? "";

            try
            {
                var payload = Convert.FromBase64String(value[ProtectedValuePrefix.Length..]);
                var bytes = ProtectedData.Unprotect(payload, ProtectedValueEntropy, DataProtectionScope.CurrentUser);
                return System.Text.Encoding.UTF8.GetString(bytes);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Secrets] Falha ao descriptografar segredo local: " + ex.Message);
                return "";
            }
        }

        private static UserProfile CloneUserProfileForStorage(UserProfile profile)
        {
            var json = JsonSerializer.Serialize(profile);
            var clone = JsonSerializer.Deserialize<UserProfile>(json) ?? new UserProfile();
            clone.SteamGridApiKey = ProtectLocalUserSecret(clone.SteamGridApiKey);
            return clone;
        }

        private static void UnprotectUserProfile(UserProfile profile)
        {
            profile.SteamGridApiKey = UnprotectLocalUserSecret(profile.SteamGridApiKey);
        }

        private static void WriteUserProfileFile(string path, UserProfile profile)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, JsonSerializer.Serialize(CloneUserProfileForStorage(profile),
                new JsonSerializerOptions { WriteIndented = true }));
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
            libraryBootstrapFile = Path.Combine(currentUserDataFolder, "library-bootstrap.json");
            storesFile = Path.Combine(currentUserDataFolder, "stores.json");

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
            if (!File.Exists(storesFile)) File.WriteAllText(storesFile, "[]");

            SaveUserProfile(profile);
            MirrorCurrentUserDataFiles();
            File.WriteAllText(currentUserFile, currentUserId);
            WriteUserProfileFile(Path.Combine(dataFolder, "user.json"), profile);
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
            _interactiveUserSessionStarted = true;
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
            _ = Task.Run(InitializeStoreLaunchersAsync);
            ResumePendingPlatformArtworkIfNeeded();
            bool bootstrapStarted = StartLibraryBootstrapIfNeeded();
            if (!bootstrapStarted)
            {
                _ = Task.Run(async () =>
                {
                    await Task.Delay(1800).ConfigureAwait(false);
                    await UpdatePlatformCacheFastAsync().ConfigureAwait(false);
                    if (ShouldRefreshFullAppCacheOnIdle())
                    {
                        await UpdateAppCacheAsync().ConfigureAwait(false);
                        SendInstalledAppsToUI();
                    }
                });
            }


            _ = Task.Run(async () =>
            {
                var folders = LoadFoldersData();
                bool changed = false;
                foreach (var f in folders.Where(x => x.EstimatedMs == -1))
                {
                    var newStats = GetFolderStats(f.Path);
                    f.SubfolderCount = newStats.SubfolderCount;
                    f.ExeCount = newStats.ExeCount;
                    f.EstimatedMs = newStats.EstimatedMs;
                    changed = true;
                }
                if (changed)
                {
                    SaveFoldersData(folders);
                    SendFoldersToUI();
                }
            });
            // ------------------------
        }

        private void SwitchToUser(string userId)
        {
            if (Interlocked.Exchange(ref _userSwitchInProgress, 1) == 1)
                return;

            var users = LoadUserProfiles();
            var user = users.FirstOrDefault(u => string.Equals(u.Id, userId, StringComparison.OrdinalIgnoreCase));
            if (user == null)
            {
                Interlocked.Exchange(ref _userSwitchInProgress, 0);
                return;
            }

            user.LastUsed = DateTime.Now;
            SaveUserProfiles(users);

            bool isRealAccountSwitch =
                _interactiveUserSessionStarted &&
                !string.Equals(currentUserId, user.Id, StringComparison.OrdinalIgnoreCase);

            if (isRealAccountSwitch)
            {
                Dispatcher.Invoke(() =>
                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "userSwitchStart",
                        mode = "switch"
                    })));
            }

            _ = Task.Run(async () =>
            {
                try
                {
                    if (isRealAccountSwitch)
                        await Task.Delay(150).ConfigureAwait(false);

                    List<Task> closeTasks = new();
                    if (isRealAccountSwitch)
                    {
                        await Dispatcher.InvokeAsync(() =>
                        {
                            closeTasks = BeginLogoutCurrentSessionsForUserSwitch();
                        });

                        await WaitForUserLogoutSessionsToCloseAsync(closeTasks).ConfigureAwait(false);
                        await Task.Delay(350).ConfigureAwait(false);
                    }

                    SetActiveUser(user, migrateLegacyFiles: false);
                    RestartWatchers();
                    await InitializeNativeAppsAsync(currentUserId, mediaFile, silent: true).ConfigureAwait(false);

                    Dispatcher.Invoke(() =>
                    {
                        LoadCurrentUserIntoUI();
                        webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "userSwitchComplete",
                            mode = isRealAccountSwitch ? "switch" : "initial",
                            showTransition = isRealAccountSwitch,
                            restartAudio = isRealAccountSwitch
                        }));
                    });
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[Users] Falha ao trocar usuario: " + ex.Message);
                    try
                    {
                        Dispatcher.Invoke(() =>
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                            {
                                type = "userSwitchComplete",
                                mode = isRealAccountSwitch ? "switch" : "initial",
                                showTransition = isRealAccountSwitch,
                                restartAudio = false
                            })));
                    }
                    catch { }
                }
                finally
                {
                    Interlocked.Exchange(ref _userSwitchInProgress, 0);
                }
            });
        }

        private List<Task> BeginLogoutCurrentSessionsForUserSwitch()
        {
            var closeTasks = new List<Task>();

            try { _backgroundAppMonitorCts?.Cancel(); } catch { }
            try { _desktopVkb?.Close(); _desktopVkb = null; } catch { }
            try { ClearExecutionLock(); } catch { }

            CloseCurrentGameForUserSwitch();
            closeTasks.AddRange(CloseCurrentStoreForUserSwitch());
            CloseCurrentWebAppForUserSwitch();
            CloseExecutableAppsForUserSwitch();

            try { ClearExecutionLock(); } catch { }
            try { SendGameLaunchStatus("gameLaunchDone"); } catch { }
            try { SendRuntimeSessionsToUI(); } catch { }
            try { ForceFocus(); } catch { }

            return closeTasks;
        }

        private void CloseCurrentGameForUserSwitch()
        {
            bool hadGameSession = _gameSession != null;
            if (!hadGameSession) return;

            var killed = new HashSet<int>();

            void Kill(Process? process)
            {
                if (process == null) return;
                try
                {
                    if (SafeHasExited(process)) return;
                    if (!killed.Add(process.Id)) return;
                    process.Kill(true);
                    process.WaitForExit(1800);
                }
                catch
                {
                    try
                    {
                        if (!SafeHasExited(process))
                            process.Kill();
                    }
                    catch { }
                }
            }

            try
            {
                if (!string.IsNullOrWhiteSpace(_lockedGameProcessName))
                {
                    foreach (var process in Process.GetProcessesByName(_lockedGameProcessName))
                        Kill(process);
                }
            }
            catch { }

            try { Kill(_pendingLaunchProcess); } catch { }

            try
            {
                if (_currentGameHwnd != IntPtr.Zero)
                {
                    GetWindowThreadProcessId(_currentGameHwnd, out uint pidRaw);
                    if (pidRaw != 0)
                        Kill(Process.GetProcessById((int)pidRaw));
                }
            }
            catch { }

            try
            {
                if (_gameSessionActive || !string.IsNullOrWhiteSpace(_activeSessionGameId))
                    CommitActiveSession();
            }
            catch { }

            ClearGameWindowSession();
            _storeChildGameActive = false;
            _storeChildGameStoreId = "";
            _storeChildGameId = "";
        }

        private List<Task> CloseCurrentStoreForUserSwitch()
        {
            var closeTasks = new List<Task>();
            if (!_isStoreLauncherSession) return closeTasks;

            string? launcherExe = _storeLauncherExe;
            HashSet<int> processIds = new();
            try { processIds = GetStoreLauncherProcessIdsForClose(); } catch { }

            try { CloseStoreSessionCompletely(); } catch { }

            if (!string.IsNullOrWhiteSpace(launcherExe))
            {
                closeTasks.Add(Task.Run(() =>
                {
                    try { KillLauncherProcessTree(launcherExe, processIds); } catch { }
                }));
            }

            return closeTasks;
        }

        private void CloseCurrentWebAppForUserSwitch()
        {
            try
            {
                if (_ytWebView != null || _webAppWindow != null || _popupWindow != null)
                    CloseYouTubeInline(skipStoreCompletion: true);
            }
            catch
            {
                try { _popupWindow?.Close(); } catch { }
                try { _webAppWindow?.Close(); } catch { }
                try { _ytWebView?.Dispose(); } catch { }
                try { _popupWebView?.Dispose(); } catch { }
                ClearWebAppSession();
            }
        }

        private void CloseExecutableAppsForUserSwitch()
        {
            var sessions = _executableAppSessions.Values.ToList();

            foreach (var session in sessions)
            {
                try { session.WatcherCts?.Cancel(); } catch { }
                try
                {
                    if (!string.IsNullOrWhiteSpace(session.Url))
                    {
                        var process = FindAliveMediaExeProcess(session.Url, session.Process);
                        KillMediaExeProcessTree(session.Url, process ?? session.Process);
                    }
                }
                catch { }
            }

            _executableAppSessions.Clear();
            _activeExecutableAppSessionKey = "";
        }

        private async Task WaitForUserLogoutSessionsToCloseAsync(List<Task> closeTasks)
        {
            if (closeTasks.Count > 0)
            {
                var allCloseTasks = Task.WhenAll(closeTasks);
                await Task.WhenAny(allCloseTasks, Task.Delay(5000)).ConfigureAwait(false);
            }

            var deadline = DateTime.UtcNow.AddSeconds(5);
            while (DateTime.UtcNow < deadline)
            {
                bool hasPendingSession = false;
                try
                {
                    hasPendingSession = Dispatcher.Invoke(HasAnyPendingSession);
                }
                catch { }

                if (!hasPendingSession) break;
                await Task.Delay(150).ConfigureAwait(false);
            }
        }
        private const uint KEYEVENTF_UNICODE = 0x0004;
        private DesktopVkbWindow _desktopVkb;

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
        private const ushort MOUSE_MODE_SHORTCUT_MASK = 0x03C0; // L3 + R3 + L1 + R1

        private static bool IsMouseModeShortcutPressed(ushort buttons)
            => (buttons & MOUSE_MODE_SHORTCUT_MASK) == MOUSE_MODE_SHORTCUT_MASK;

        private void SharedGamepadControllerLoop(
            Func<bool> isActive,
            Action onExitCombo,
            bool handleXboxButton = true,
            Func<bool>? shouldAcceptInput = null,
            Action? onMouseModeShortcut = null)
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
                bool acceptsInputNow = shouldAcceptInput?.Invoke() ?? true;
                if (acceptsInputNow &&
                    aDoubleClickPending &&
                    (DateTime.Now - lastAReleaseTime).TotalMilliseconds > 300)
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

                        acceptsInputNow = shouldAcceptInput?.Invoke() ?? true;
                        if (!acceptsInputNow)
                        {
                            if (isClicking)
                            {
                                SendMouse(0, 0, 0x0004); // MOUSEEVENTF_LEFTUP
                                isClicking = false;
                            }

                            aDoubleClickPending = false;
                            prevButtons = btn;
                            Thread.Sleep(25);
                            continue;
                        }

                        bool Pressed(ushort m) => (btn & m) != 0 && (prevButtons & m) == 0;
                        bool Released(ushort m) => (btn & m) == 0 && (prevButtons & m) != 0;

                        if (onMouseModeShortcut != null &&
                            IsMouseModeShortcutPressed(btn) &&
                            !IsMouseModeShortcutPressed(prevButtons))
                        {
                            onMouseModeShortcut.Invoke();
                            prevButtons = btn;
                            Thread.Sleep(120);
                            continue;
                        }

                        // ── Botão Xbox = Voltar/Minimizar Modo Mídia Exe/Dialog ──
                        bool xboxBtn = (btn & 0x0400) != 0;
                        if (handleXboxButton && xboxBtn)
                        {
                            onExitCombo?.Invoke();
                            if (!isActive()) break;

                            prevButtons = btn;
                            Thread.Sleep(10);
                            continue;
                        }

                        bool vkbIsOpen = false;
                        Dispatcher.Invoke(() => vkbIsOpen = _desktopVkb?.IsVisible == true);

                        // NOVO: evita que uma iteração extra em modo mouse envie
                        // eventos para o Doorpi depois que o app fechou
                        if (!isActive()) break;

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

                Thread.Sleep(1);
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
                () => _mediaExeModeActive && _mediaExeSessionId == sessionId,
                () =>
                {
                    if (_mediaExeSessionId != sessionId) return;

                    bool vkbWasOpen = false;
                    Dispatcher.Invoke(() =>
                    {
                        vkbWasOpen = _desktopVkb?.IsVisible == true;
                        if (vkbWasOpen)
                        {
                            _desktopVkb?.Close();
                            _desktopVkb = null;
                        }
                    });
                    if (vkbWasOpen) return;

                    _mediaExeModeActive = false;
                    _mediaExeWatcherCts?.Cancel();
                    _doorpiSuspendedForMedia = true;
                    SuspendExecutionLockWatch();
                    if (_isStoreLauncherSession)
                    {
                        _storePausedByDoorpi = true;
                        _storeControllerActive = false;
                    }

                    EnsureCursorHidden();
                    _mainScreenMouseVisible = false;
                    _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                    try { SetCursorPos(0, 0); } catch { }

                    Interlocked.Exchange(ref _returnFromExternalModeSuppressUntil, DateTime.UtcNow.AddMilliseconds(350).Ticks);

                    if (_mediaExeProcess != null && !_mediaExeProcess.HasExited)
                    {
                        IntPtr hwnd = FindVisibleWindowForProcess(_mediaExeProcess.Id);
                        if (hwnd != IntPtr.Zero) ShowWindow(hwnd, 6);
                    }

                    SendGameLaunchStatus("gameLaunchDone");

                    Dispatcher.Invoke(() =>
                    {
                        _desktopVkb?.Close();
                        _desktopVkb = null;
                        EnsureCursorVisible();
                        EnsureCursorHidden();
                        _mainScreenMouseVisible = false;
                        _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                        SetCursorPos(0, 0);
                        FocusDoorpiKeepSession();
                    });
                },
                shouldAcceptInput: IsForegroundOwnedByActiveMediaExe,
                onMouseModeShortcut: () => ToggleMediaExeMouseModeForSession(sessionId)
            );
        }

        private static bool ShouldStartMouseMode(MediaAppModel? media)
            => media?.DisableGamepadControl != true;

        private void InitializeMediaExeMouseModeForSession(MediaAppModel? media)
        {
            if (_mediaExeMouseModeInitialized) return;

            _mediaExeMouseModeRequested = ShouldStartMouseMode(media);
            _mediaExeMouseModeInitialized = true;
        }

        private void StartMediaExeMouseModeForSession(int sessionId, bool centerCursor)
        {
            if (_mediaExeSessionId != sessionId ||
                _mediaExeProcess == null ||
                SafeHasExited(_mediaExeProcess))
            {
                return;
            }

            _mediaExeMouseModeRequested = true;
            _mediaExeMouseModeInitialized = true;
            _mediaExeGamepadDisabled = false;

            if (_mediaExeModeActive && _mediaExeThread?.IsAlive == true)
                return;

            _mediaExeModeActive = true;
            Dispatcher.Invoke(() =>
            {
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
                if (centerCursor) CenterCursorOnScreen();
                UpdateHoverStateInWebView();
            });

            _mediaExeThread = new Thread(() => MediaExeControllerLoop(sessionId)) { IsBackground = true };
            _mediaExeThread.Start();
            SendRuntimeSessionsToUI();
        }

        private void StopMediaExeMouseModeForSession(int sessionId)
        {
            if (_mediaExeSessionId != sessionId)
                return;

            _mediaExeMouseModeRequested = false;
            _mediaExeMouseModeInitialized = true;
            _mediaExeGamepadDisabled = true;
            _mediaExeModeActive = false;

            Dispatcher.Invoke(() =>
            {
                _desktopVkb?.Close();
                _desktopVkb = null;
                EnsureCursorHidden();
                _mainScreenMouseVisible = false;
                _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                try { SetCursorPos(0, 0); } catch { }
            });

            SendRuntimeSessionsToUI();
        }

        private void ToggleMediaExeMouseModeForSession(int sessionId)
        {
            if (_mediaExeMouseModeRequested || _mediaExeModeActive)
                StopMediaExeMouseModeForSession(sessionId);
            else
                StartMediaExeMouseModeForSession(sessionId, centerCursor: true);
        }

        private void MediaExeShortcutLoop(int sessionId)
        {
            ushort prevButtons = 0;

            while (_mediaExeSessionId == sessionId &&
                   _mediaExeProcess != null &&
                   !SafeHasExited(_mediaExeProcess))
            {
                try
                {
                    if (XInputGetStateSecret(0, out var state) == 0)
                    {
                        ushort btn = state.Gamepad.wButtons;
                        bool shortcutPressed = IsMouseModeShortcutPressed(btn) && !IsMouseModeShortcutPressed(prevButtons);

                        if (!_mediaExeModeActive &&
                            shortcutPressed &&
                            IsForegroundOwnedByActiveMediaExe())
                        {
                            ToggleMediaExeMouseModeForSession(sessionId);
                        }

                        prevButtons = btn;
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[MediaExeShortcutLoop] {ex.Message}"); }

                Thread.Sleep(25);
            }
        }

        private void EnsureMediaExeShortcutThread(int sessionId)
        {
            if (_mediaExeShortcutThread?.IsAlive == true) return;

            _mediaExeShortcutThread = new Thread(() => MediaExeShortcutLoop(sessionId))
            {
                IsBackground = true
            };
            _mediaExeShortcutThread.Start();
        }

        private void StoreLauncherShortcutLoop(int sessionId)
        {
            ushort prevButtons = 0;
            while (_isStoreLauncherSession &&
                   !_storePausedByDoorpi &&
                   !IsStoreChildGameBlockingStoreControls() &&
                   _storeSessionId == sessionId)
            {
                try
                {
                    if (XInputGetStateSecret(0, out var state) == 0)
                    {
                        ushort btn = state.Gamepad.wButtons;
                        bool xboxPressed = (btn & 0x0400) != 0 && (prevButtons & 0x0400) == 0;
                        if (xboxPressed)
                        {
                            Dispatcher.Invoke(MinimizeStoreSessionAndShowMenu);
                            break;
                        }

                        bool mouseShortcutPressed = IsMouseModeShortcutPressed(btn) && !IsMouseModeShortcutPressed(prevButtons);
                        if (mouseShortcutPressed &&
                            IsForegroundOwnedByActiveStore())
                        {
                            ToggleStoreMouseModeForSession(sessionId);
                        }

                        prevButtons = btn;
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[StoreShortcutLoop] {ex.Message}"); }

                Thread.Sleep(10);
            }
        }

        private void EnsureStoreShortcutThread(int sessionId)
        {
            if (_storeShortcutThread?.IsAlive == true) return;

            _storeShortcutThread = new Thread(() => StoreLauncherShortcutLoop(sessionId))
            {
                IsBackground = true
            };
            _storeShortcutThread.Start();
        }

        private void StartStoreMouseModeForSession(int sessionId, bool centerCursor)
        {
            if (!_isStoreLauncherSession ||
                _storeSessionId != sessionId ||
                _storePausedByDoorpi ||
                IsStoreChildGameBlockingStoreControls() ||
                !IsActiveStoreLauncherProcessAlive())
            {
                return;
            }

            _storeMouseModeRequested = true;
            _storeGamepadDisabled = false;

            if (_storeControllerActive && _storeControllerThread?.IsAlive == true)
                return;

            _storeControllerActive = true;
            Dispatcher.Invoke(() =>
            {
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
                if (centerCursor) CenterCursorOnScreen();
                UpdateHoverStateInWebView();
            });

            _storeControllerThread = new Thread(() => StoreExeControllerLoop(sessionId)) { IsBackground = true };
            _storeControllerThread.Start();
            SendRuntimeSessionsToUI();
        }

        private void StopStoreMouseModeForSession(int sessionId)
        {
            if (_storeSessionId != sessionId || !_isStoreLauncherSession)
                return;

            _storeMouseModeRequested = false;
            _storeGamepadDisabled = true;
            _storeControllerActive = false;

            Dispatcher.Invoke(() =>
            {
                _desktopVkb?.Close();
                _desktopVkb = null;
                EnsureCursorHidden();
                _mainScreenMouseVisible = false;
                _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                try { SetCursorPos(0, 0); } catch { }
            });

            SendRuntimeSessionsToUI();
        }

        private void ToggleStoreMouseModeForSession(int sessionId)
        {
            if (_storeMouseModeRequested || _storeControllerActive)
                StopStoreMouseModeForSession(sessionId);
            else
                StartStoreMouseModeForSession(sessionId, centerCursor: true);
        }

        private void StoreExeControllerLoop(int sessionId)
        {
            SharedGamepadControllerLoop(
                () => _storeControllerActive &&
                      _storeSessionId == sessionId &&
                      _isStoreLauncherSession &&
                      !_storePausedByDoorpi &&
                      !IsStoreChildGameBlockingStoreControls(),
                () =>
                {
                    if (_storeSessionId != sessionId) return;

                    bool vkbWasOpen = false;
                    Dispatcher.Invoke(() =>
                    {
                        vkbWasOpen = _desktopVkb?.IsVisible == true;
                        if (vkbWasOpen)
                        {
                            _desktopVkb?.Close();
                            _desktopVkb = null;
                        }
                    });
                    if (vkbWasOpen) return;

                    Dispatcher.Invoke(MinimizeStoreSessionAndShowMenu);
                },
                handleXboxButton: false,
                shouldAcceptInput: IsForegroundOwnedByActiveStore,
                onMouseModeShortcut: () => ToggleStoreMouseModeForSession(sessionId)
            );
        }

        private void StartDialogControllerMode()
        {
            if (_dialogModeActive) return;
            _dialogModeActive = true;

            // Garante que o cursor apareça para o usuário interagir com o dialog
            EnsureCursorVisible();
            _mainScreenMouseVisible = true;

            new Thread(() =>
            {
                SharedGamepadControllerLoop(
                    () => _dialogModeActive,
                    () => SendVirtualKey(0x1B)
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

            // Reesconde o cursor ao voltar pro Doorpi
            ResetCursorForMainScreen();
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

        private MediaAppModel? FindMediaAppByUrlOrId(string urlOrId)
            => LoadMediaApps().FirstOrDefault(m =>
                string.Equals(m.Url, urlOrId, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(m.Id, urlOrId, StringComparison.OrdinalIgnoreCase));

        private static string ResolveMediaExecutableUrl(MediaAppModel? media, string urlOrId)
            => !string.IsNullOrWhiteSpace(media?.Url) ? media!.Url : urlOrId;

        private Dictionary<int, int> SnapshotParentProcessIds()
        {
            var parents = new Dictionary<int, int>();
            IntPtr snapshot = IntPtr.Zero;

            try
            {
                snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
                if (snapshot == IntPtr.Zero || snapshot == INVALID_HANDLE_VALUE)
                    return parents;

                var entry = new PROCESSENTRY32 { dwSize = (uint)Marshal.SizeOf<PROCESSENTRY32>() };
                if (!Process32FirstW(snapshot, ref entry))
                    return parents;

                do
                {
                    parents[(int)entry.th32ProcessID] = (int)entry.th32ParentProcessID;
                }
                while (Process32NextW(snapshot, ref entry));
            }
            catch { }
            finally
            {
                if (snapshot != IntPtr.Zero && snapshot != INVALID_HANDLE_VALUE)
                {
                    try { CloseHandle(snapshot); } catch { }
                }
            }

            return parents;
        }

        private static bool HasAncestorInGroup(int pid, IReadOnlyDictionary<int, int> parentIds, ISet<int> groupIds)
        {
            var seen = new HashSet<int>();
            int current = pid;

            while (parentIds.TryGetValue(current, out int parentPid) &&
                   parentPid > 0 &&
                   seen.Add(parentPid))
            {
                if (groupIds.Contains(parentPid))
                    return true;

                current = parentPid;
            }

            return false;
        }

        private static bool ProcessPathBelongsToMediaRoot(Process process, string mediaUrl, string rootDirectory)
        {
            try
            {
                string processPath = SafeProcessPath(process);
                if (string.IsNullOrWhiteSpace(processPath)) return false;

                if (File.Exists(mediaUrl) && PathsEqual(processPath, mediaUrl))
                    return true;

                if (!string.IsNullOrWhiteSpace(rootDirectory))
                {
                    string fullProcessPath = Path.GetFullPath(processPath);
                    string fullRoot = Path.GetFullPath(rootDirectory).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
                    return fullProcessPath.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase);
                }
            }
            catch { }

            return false;
        }

        private void InitializeMediaExeProcessGroup(string mediaUrl, Process? rootProcess, HashSet<int>? baselineProcessIds = null)
        {
            if (string.IsNullOrWhiteSpace(mediaUrl)) return;

            var session = EnsureExecutableAppSession(mediaUrl);
            session.ProcessGroupIds.Clear();
            session.BaselineProcessIds = baselineProcessIds != null
                ? new HashSet<int>(baselineProcessIds)
                : SnapshotProcessIds();
            session.ProcessGroupRootDirectory = "";
            session.ProcessGroupExeName = "";

            try
            {
                if (File.Exists(mediaUrl))
                {
                    session.ProcessGroupRootDirectory = Path.GetDirectoryName(Path.GetFullPath(mediaUrl)) ?? "";
                    session.ProcessGroupExeName = Path.GetFileNameWithoutExtension(mediaUrl);
                }
            }
            catch { }

            try
            {
                if (rootProcess != null && !SafeHasExited(rootProcess))
                    session.ProcessGroupIds.Add(rootProcess.Id);
            }
            catch { }

            ExpandMediaExeProcessGroup(session);
        }

        private void ExpandMediaExeProcessGroup(ExecutableAppSession? session)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.Url))
                return;

            if (session.ProcessGroupIds.Count == 0)
            {
                try
                {
                    if (session.Process != null && !SafeHasExited(session.Process))
                        session.ProcessGroupIds.Add(session.Process.Id);
                }
                catch { }
            }

            var parentIds = SnapshotParentProcessIds();
            Process[] processes;
            try { processes = Process.GetProcesses(); }
            catch { return; }

            bool changed;
            do
            {
                changed = false;
                foreach (var process in processes)
                {
                    int pid;
                    try { pid = process.Id; } catch { continue; }
                    if (session.ProcessGroupIds.Contains(pid)) continue;

                    bool isDescendant = HasAncestorInGroup(pid, parentIds, session.ProcessGroupIds);
                    bool isNewRelatedProcess =
                        !session.BaselineProcessIds.Contains(pid) &&
                        (ProcessPathBelongsToMediaRoot(process, session.Url, session.ProcessGroupRootDirectory) ||
                         (!string.IsNullOrWhiteSpace(session.ProcessGroupExeName) &&
                          string.Equals(SafeProcessName(process), session.ProcessGroupExeName, StringComparison.OrdinalIgnoreCase)));

                    if (isDescendant || isNewRelatedProcess)
                    {
                        session.ProcessGroupIds.Add(pid);
                        changed = true;
                    }
                }
            }
            while (changed);
        }

        private List<Process> GetMediaExeProcessGroup(string mediaUrl, Process? knownProcess)
        {
            var media = FindMediaAppByUrlOrId(mediaUrl);
            string resolvedUrl = ResolveMediaExecutableUrl(media, mediaUrl);
            var session = GetExecutableAppSession(resolvedUrl) ?? GetExecutableAppSession(mediaUrl);

            if (session == null)
                return new List<Process>();

            if (knownProcess != null)
            {
                try
                {
                    if (!SafeHasExited(knownProcess))
                        session.ProcessGroupIds.Add(knownProcess.Id);
                }
                catch { }
            }

            ExpandMediaExeProcessGroup(session);

            var result = new List<Process>();
            foreach (int pid in session.ProcessGroupIds.ToArray())
            {
                try
                {
                    var process = Process.GetProcessById(pid);
                    if (!SafeHasExited(process))
                        result.Add(process);
                }
                catch { }
            }

            return result;
        }

        private IEnumerable<Process> EnumerateMediaExeProcesses(string mediaUrl, Process? knownProcess)
        {
            var result = new List<Process>();
            var seen = new HashSet<int>();

            bool AddSeen(Process process)
            {
                try { return seen.Add(process.Id); }
                catch { return false; }
            }

            try
            {
                if (knownProcess != null && !SafeHasExited(knownProcess) && AddSeen(knownProcess))
                    result.Add(knownProcess);
            }
            catch { }

            if (string.IsNullOrWhiteSpace(mediaUrl))
                return result;

            string processName = "";
            string fullPath = "";

            try
            {
                if (File.Exists(mediaUrl))
                {
                    fullPath = Path.GetFullPath(mediaUrl);
                    processName = Path.GetFileNameWithoutExtension(mediaUrl);
                }
            }
            catch { }

            if (string.IsNullOrWhiteSpace(processName))
                return result;

            Process[] processes;
            try { processes = Process.GetProcessesByName(processName); }
            catch { return result; }

            // Primeiro: correspondência forte por caminho, quando o Windows permite ler MainModule.
            foreach (var process in processes)
            {
                bool matchesPath = false;
                try
                {
                    string processPath = SafeProcessPath(process);
                    matchesPath = !string.IsNullOrWhiteSpace(processPath) && PathsEqual(processPath, fullPath);
                }
                catch { }

                if (matchesPath && AddSeen(process))
                    result.Add(process);
            }

            // Depois: fallback por nome do exe. Apps em tray podem não expor caminho/janela, mas
            // ainda mantêm o processo principal com o mesmo nome.
            foreach (var process in processes)
            {
                if (!AddSeen(process)) continue;
                result.Add(process);
            }

            return result;
        }

        private Process? FindAliveMediaExeProcess(string mediaUrl, Process? knownProcess)
        {
            return GetMediaExeProcessGroup(mediaUrl, knownProcess).FirstOrDefault()
                   ?? EnumerateMediaExeProcesses(mediaUrl, knownProcess).FirstOrDefault();
        }

        private static string FirstNonEmpty(params string?[] values)
            => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? "";

        private static string MediaGridVisual(MediaAppModel? media)
            => FirstNonEmpty(media?.GridImage, media?.GridStaticImage, media?.GridHorizontalImage, media?.GridHorizontalStaticImage);

        private static string MediaHeroVisual(MediaAppModel? media)
            => FirstNonEmpty(media?.HeroImage, media?.HeroStaticImage, media?.GridHorizontalImage, media?.GridImage, media?.GridStaticImage);

        private void KillMediaExeProcessTree(string mediaUrl, Process? knownProcess)
        {
            var killed = new HashSet<int>();

            void Kill(Process? process)
            {
                if (process == null) return;
                try
                {
                    if (SafeHasExited(process)) return;
                    int pid = process.Id;
                    if (!killed.Add(pid)) return;
                    process.Kill(true);
                }
                catch { }
            }

            var groupProcesses = GetMediaExeProcessGroup(mediaUrl, knownProcess);
            var targets = groupProcesses.Count > 0
                ? groupProcesses
                : EnumerateMediaExeProcesses(mediaUrl, knownProcess).ToList();

            foreach (var process in targets)
                Kill(process);
        }

        private async Task TryMaximizeExternalWindowAsync(
            Process proc,
            string mediaUrl,
            CancellationToken token = default,
            bool requireControllerActive = true)
        {
            bool isSteamStoreLaunch =
                _isStoreLauncherSession &&
                IsSteamStoreWindowLookup(_activeStoreId ?? "", mediaUrl);
            bool isBattleNetStoreLaunch =
                _isStoreLauncherSession &&
                IsBattleNetStoreWindowLookup(_activeStoreId ?? "", mediaUrl);
            bool isGogStoreLaunch =
                _isStoreLauncherSession &&
                IsGogStoreWindowLookup(_activeStoreId ?? "", mediaUrl);
            int maxAttempts = (isSteamStoreLaunch || isBattleNetStoreLaunch || isGogStoreLaunch) ? 1800 : 600;
            bool steamInteractiveWindowFocused = false;
            bool battleNetInteractiveWindowFocused = false;
            bool gogInteractiveWindowFocused = false;

            for (int i = 0; i < maxAttempts; i++)
            {
                // CRÍTICO: Para imediatamente se saímos do modo (botão Xbox)
                if (token.IsCancellationRequested || (requireControllerActive && !_mediaExeModeActive)) return;

                await Task.Delay(200);
                try
                {
                    Process? targetProc = proc;
                    bool canResolveTargetLater =
                        _isStoreLauncherSession &&
                        (IsSteamStoreWindowLookup(_activeStoreId ?? "", mediaUrl) ||
                         IsBattleNetStoreWindowLookup(_activeStoreId ?? "", mediaUrl) ||
                         IsGogStoreWindowLookup(_activeStoreId ?? "", mediaUrl));
                    if (!canResolveTargetLater && SafeHasExited(targetProc))
                    {
                        targetProc = FindRunningProcessForExe(mediaUrl);
                        if (targetProc == null) continue;
                    }

                    IntPtr hwnd;
                    if (_isStoreLauncherSession &&
                        IsSteamStoreWindowLookup(_activeStoreId ?? "", mediaUrl))
                    {
                        if (!TryFindSteamWindow(out var steamProc, out var steamHwnd))
                        {
                            if (!steamInteractiveWindowFocused &&
                                TryFindSteamInteractiveWindow(out _, out var steamInteractiveHwnd))
                            {
                                FocusExternalWindow(steamInteractiveHwnd);
                                steamInteractiveWindowFocused = true;

                                _ = Dispatcher.BeginInvoke(() =>
                                {
                                    EnsureCursorVisible();
                                    _mainScreenMouseVisible = true;
                                    UpdateHoverStateInWebView();
                                });
                            }
                            continue;
                        }

                        targetProc = steamProc;
                        hwnd = steamHwnd;
                    }
                    else if (_isStoreLauncherSession &&
                             IsBattleNetStoreWindowLookup(_activeStoreId ?? "", mediaUrl))
                    {
                        if (!TryFindBattleNetWindow(out var battleNetProc, out var battleNetHwnd))
                        {
                            if (!battleNetInteractiveWindowFocused &&
                                TryFindBattleNetInteractiveWindow(out _, out var battleNetInteractiveHwnd))
                            {
                                FocusExternalWindow(battleNetInteractiveHwnd);
                                battleNetInteractiveWindowFocused = true;

                                _ = Dispatcher.BeginInvoke(() =>
                                {
                                    EnsureCursorVisible();
                                    _mainScreenMouseVisible = true;
                                    UpdateHoverStateInWebView();
                                });
                            }
                            continue;
                        }

                        targetProc = battleNetProc;
                        hwnd = battleNetHwnd;
                    }
                    else if (_isStoreLauncherSession &&
                             IsGogStoreWindowLookup(_activeStoreId ?? "", mediaUrl))
                    {
                        if (!TryFindGogWindow(mediaUrl, out var gogProc, out var gogHwnd))
                        {
                            if (!gogInteractiveWindowFocused &&
                                TryFindGogInteractiveWindow(out _, out var gogInteractiveHwnd))
                            {
                                FocusExternalWindow(gogInteractiveHwnd);
                                gogInteractiveWindowFocused = true;

                                _ = Dispatcher.BeginInvoke(() =>
                                {
                                    EnsureCursorVisible();
                                    _mainScreenMouseVisible = true;
                                    UpdateHoverStateInWebView();
                                });
                            }
                            continue;
                        }

                        targetProc = gogProc;
                        hwnd = gogHwnd;
                    }
                    else
                    {
                        if (SafeHasExited(targetProc))
                        {
                            targetProc = FindRunningProcessForExe(mediaUrl);
                            if (targetProc == null) continue;
                        }

                        hwnd = targetProc.MainWindowHandle;
                        if (hwnd == IntPtr.Zero) hwnd = FindVisibleWindowForProcess(targetProc.Id);
                    }

                    if (hwnd != IntPtr.Zero)
                    {
                        if (token.IsCancellationRequested || (requireControllerActive && !_mediaExeModeActive)) return;

                        ShowWindow(hwnd, 3); // SW_MAXIMIZE
                        FocusExternalWindow(hwnd);
                        return;
                    }
                }
                catch { }
            }
        }
        private void StartMediaExeWatcher(Process proc, string mediaUrl, string appName, CancellationToken token)
        {
            var session = GetExecutableAppSession(mediaUrl);
            if (session == null || session.ProcessGroupIds.Count == 0)
                InitializeMediaExeProcessGroup(mediaUrl, proc);

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
                        if (_mediaExeWatcherPaused) { await Task.Delay(100, token); continue; }

                        if ((DateTime.UtcNow - startTime).TotalMinutes > 3)
                        {
                            SendGameLaunchStatus("gameLaunchFailed", appName, "", "", "timeout");
                            ReturnToDoorpiFromMedia(mediaUrl);
                            return;
                        }

                        IntPtr activeHwnd = IntPtr.Zero;
                        var processes = Process.GetProcessesByName(exeName);

                        foreach (var p in processes)
                        {
                            IntPtr h = FindVisibleWindowForProcess(p.Id);
                            if (h != IntPtr.Zero) { activeHwnd = h; break; }
                        }

                        if (activeHwnd != IntPtr.Zero)
                        {
                            hasStarted = true;
                            SendGameLaunchStatus("gameLaunchReady");

                            await EnsureMinimumAnimationTimeAsync(token);
                            if (token.IsCancellationRequested || (!_mediaExeModeActive && !_mediaExeGamepadDisabled)) return;

                            await Task.Delay(300, token);
                            if (token.IsCancellationRequested || (!_mediaExeModeActive && !_mediaExeGamepadDisabled)) return;

                            Dispatcher.Invoke(() =>
                            {
                                if (this.Topmost) this.Topmost = false;
                                // Empurra o Doorpi para o fundo da pilha Z-order, atrás de todos os apps
                                SetWindowPos(_mainWindowHandle, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);

                            });

                            SendGameLaunchStatus("gameLaunchDone");
                            DiscordRpcManager.Instance.UpdateState("media", mediaUrl, appName);

                            break;
                        }

                        await Task.Delay(500, token);
                    }

                    // ==============================================================
                    // FASE 2: APP EM EXECUÇÃO (Retorno Imediato ao Fechar)
                    // ==============================================================
                    int missingCount = 0;
                    while (!token.IsCancellationRequested)
                    {
                        if (_storePausedByDoorpi)
                        {
                            missingCount = 0;
                            await Task.Delay(200, token);
                            continue;
                        }

                        var processList = GetMediaExeProcessGroup(mediaUrl, proc);
                        if (processList.Count == 0)
                        {
                            try { processList = Process.GetProcessesByName(exeName).ToList(); }
                            catch { processList = new List<Process>(); }
                        }
                        bool hasActiveWindow = false;

                        foreach (var p in processList)
                        {
                            IntPtr h = FindVisibleWindowForProcess(p.Id);

                            // A MÁGICA: A janela precisa existir (h != Zero) E NÃO ESTAR MINIMIZADA (!IsIconic)
                            if (h != IntPtr.Zero && !IsIconic(h))
                            {
                                hasActiveWindow = true;
                                break;
                            }
                        }

                        // DEPOIS — 2 checks × 200ms = 400ms máximo, mais tolerante que 1 check
                        if (!hasActiveWindow)
                        {
                            bool mediaProcessStillAlive = processList.Any(p =>
                            {
                                try { return !SafeHasExited(p); } catch { return false; }
                            });
                            if (!mediaProcessStillAlive)
                            {
                                try { mediaProcessStillAlive = FindRunningProcessForExe(mediaUrl) != null; } catch { }
                            }

                            if (mediaProcessStillAlive)
                            {
                                Dispatcher.Invoke(() => FinalizeMediaExeTraySession(mediaUrl));
                                return;
                            }

                            missingCount++;
                            if (missingCount >= 2)
                            {
                                ReturnToDoorpiFromMedia(mediaUrl);
                                return;
                            }
                        }
                        else
                        {
                            missingCount = 0;
                        }

                        await Task.Delay(200, token);
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[Watcher] {ex.Message}"); }
            });
        }

        private void FinalizeMediaExeTraySession(string mediaUrl)
        {
            var media = FindMediaAppByUrlOrId(mediaUrl);
            string resolvedUrl = ResolveMediaExecutableUrl(media, mediaUrl);

            ActivateExecutableAppSession(resolvedUrl);
            _mediaExeCurrentUrl = resolvedUrl;

            var process = FindAliveMediaExeProcess(resolvedUrl, _mediaExeProcess);

            try { _mediaExeWatcherCts?.Cancel(); } catch { }
            try { _desktopVkb?.Close(); } catch { }
            _desktopVkb = null;

            _mediaExeModeActive = false;
            _mediaExeGamepadDisabled = true;
            _mediaExeMouseModeRequested = false;
            _mediaExeMouseModeInitialized = false;
            _mediaExeWatcherPaused = false;
            _doorpiSuspendedForMedia = false;

            KillMediaExeProcessTree(resolvedUrl, process);
            ClearExecutableAppSession();
            ClearExecutionLock();
            SendRuntimeSessionsToUI();
            ForceFocus();
        }

        // Helper para centralizar a volta ao Doorpi

        // DEPOIS
        private void ReturnToDoorpiFromMedia(string? mediaUrl = null)
        {
            if (!string.IsNullOrWhiteSpace(mediaUrl))
            {
                var media = FindMediaAppByUrlOrId(mediaUrl);
                string resolvedUrl = ResolveMediaExecutableUrl(media, mediaUrl);
                ActivateExecutableAppSession(resolvedUrl);
                _mediaExeCurrentUrl = resolvedUrl;
                mediaUrl = resolvedUrl;
            }

            int capturedSession = _mediaExeSessionId;
            string capturedUrl = _mediaExeCurrentUrl;

            // ── Para imediatamente a Thread do Mouse, mas MANTÉM as variáveis de processo VIVAS ──
            _mediaExeModeActive = false;
            _mediaExeGamepadDisabled = !_mediaExeMouseModeRequested;
            _doorpiSuspendedForMedia = false;

            EnsureCursorHidden();
            _mainScreenMouseVisible = false;
            _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
            try { SetCursorPos(0, 0); } catch { }

            Interlocked.Exchange(ref _returnFromExternalModeSuppressUntil,
                DateTime.UtcNow.AddMilliseconds(350).Ticks);

            SendGameLaunchStatus("gameLaunchDone");

            Dispatcher.Invoke(() =>
            {
                if (!string.IsNullOrWhiteSpace(capturedUrl))
                    ActivateExecutableAppSession(capturedUrl);

                if (_mediaExeSessionId != capturedSession) return;

                _desktopVkb?.Close();
                _desktopVkb = null;

                var aliveProcess = FindAliveMediaExeProcess(capturedUrl, _mediaExeProcess);
                bool processStillAlive = aliveProcess != null;
                if (processStillAlive)
                {
                    _mediaExeProcess = aliveProcess;
                }
                else
                {
                    ClearExecutableAppSession();
                }

                EnsureCursorVisible();
                EnsureCursorHidden();
                _mainScreenMouseVisible = false;
                _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                SetCursorPos(0, 0);

                if (processStillAlive)
                {
                    ShowMediaExeExecutionLockAfterReturningToDoorpi(capturedUrl);
                    return;
                }

                if (WindowState != WindowState.Maximized) WindowState = WindowState.Maximized;
                if (GetBootMode() == 2) this.Topmost = true;

                SetWindowPos(_mainWindowHandle, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
                Activate();
                ForceFocus();
                webView?.CoreWebView2?.ExecuteScriptAsync(
                    "window.isMediaAppActive = false; window.focusFeaturedCard?.();");
                SendRuntimeSessionsToUI();
            });
        }

        private void ShowMediaExeExecutionLockAfterReturningToDoorpi(string mediaUrl)
        {
            _mainUiGamepadSuspendedForGame = false;
            Interlocked.Exchange(ref _mainUiGamepadSuppressUntilUtcTicks, 0);
            Interlocked.Exchange(ref _focusRestoredAtTicks, DateTime.UtcNow.Ticks);
            Interlocked.Exchange(ref _executionLockSuppressUntilUtcTicks, 0);
            ReleaseAllStuckKeys();

            _ = Dispatcher.BeginInvoke(async () =>
            {
                var hwnd = _mainWindowHandle != IntPtr.Zero
                    ? _mainWindowHandle
                    : new System.Windows.Interop.WindowInteropHelper(this).Handle;

                if (WindowState != WindowState.Maximized) WindowState = WindowState.Maximized;
                if (GetBootMode() == 2) this.Topmost = true;

                this.Show();
                SetForegroundWindow(hwnd);
                Activate();

                EnsureCursorVisible();
                EnsureCursorHidden();
                _mainScreenMouseVisible = false;
                _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                try { SetCursorPos(0, 0); } catch { }

                webView?.Focus();
                Keyboard.Focus(webView);

                webView?.CoreWebView2?.ExecuteScriptAsync(
                    "window.isDoorpiFocused = true; window.isMediaAppActive = false; window.isGameLaunchActive = false; window._doorpiGameInputSuppressedUntil = 0; window._doorpiOfficialReturnSuppressUntil = 0;");
                webView?.CoreWebView2?.PostWebMessageAsString(
                    JsonSerializer.Serialize(new
                    {
                        type = "windowFocused",
                        appAlive = true,
                        hasBlockingSession = true,
                        hasLiveExternalSession = true,
                        shouldMuteDoorpiAudio = true
                    }));

                SendRuntimeSessionsToUI();
                DiscordRpcManager.Instance.UpdateState("menu");

                await Task.Delay(180);
                if (!string.IsNullOrWhiteSpace(mediaUrl))
                    ActivateExecutableAppSession(mediaUrl);
                ShowExecutionLockForMediaExe(mediaUrl);
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
        private void EnterMediaExeMode(Process proc, string url, string appName, string heroImg, string gridImg, HashSet<int>? baselineProcessIds = null)
        {
            ActivateExecutableAppSession(url);
            if (_mediaExeModeActive) return;

            _mediaExeWatcherCts?.Cancel();
            _mediaExeWatcherCts = new CancellationTokenSource();

            int sessionId = NextExecutableAppSessionId();

            _mediaExeProcess = proc;
            _mediaExeCurrentUrl = url;
            InitializeMediaExeProcessGroup(url, proc, baselineProcessIds);
            _mediaExeMouseModeRequested = true;
            _mediaExeMouseModeInitialized = true;
            _mediaExeGamepadDisabled = false;
            _mediaExeModeActive = true;
            _mediaExeWatcherPaused = false;
            _doorpiSuspendedForMedia = false;

            Dispatcher.Invoke(() =>
            {
                while (ShowCursor(true) < 0) { }
                _mainScreenMouseVisible = true;
                CenterCursorOnScreen();
                UpdateHoverStateInWebView(); // Devolve controle do hover se for Mídia
            });

            SendGameLaunchStatus("gameLaunching", appName, heroImg, gridImg, "app");
            _ = TryMaximizeExternalWindowAsync(proc, url, _mediaExeWatcherCts.Token);
            StartMediaExeWatcher(proc, url, appName, _mediaExeWatcherCts.Token);
            EnsureMediaExeShortcutThread(sessionId);

            _mediaExeThread = new Thread(() => MediaExeControllerLoop(sessionId)) { IsBackground = true };
            _mediaExeThread.Start();
            SendRuntimeSessionsToUI();
        }
        private void ExitMediaExeMode()
        {
            if (!_mediaExeModeActive && _mediaExeProcess == null) return;
            _mediaExeWatcherCts?.Cancel();
            ClearExecutableAppSession();


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
                DateTime.UtcNow.AddMilliseconds(350).Ticks);
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
            bool prevR2 = false;

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
                        Dispatcher.Invoke(() => vkbIsOpen = _desktopVkb?.IsVisible == true);

                        // NOVO: evita que uma iteração extra em modo mouse envie
                        // eventos para o Doorpi depois que o app fechou
                        if (!_systemControllerActive) break;


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

                  


                        bool r2Down = gp.bRightTrigger > 128;
                        bool r2Pressed = r2Down && !prevR2;
                        bool r2Released = !r2Down && prevR2;
                        prevR2 = r2Down;

                        // GATILHO (R2) - PRESSIONOU
                        if (r2Pressed)
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

                        // GATILHO (R2) - SOLTOU
                        if (r2Released)
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

                        // Fechar Modo Desktop apenas com o botão Xbox
                        bool isXboxButton = (btn & 0x0400) != 0;

                        if (isXboxButton)
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
            try
            {
                var profile = JsonSerializer.Deserialize<UserProfile>(File.ReadAllText(userFile)) ?? new UserProfile();
                UnprotectUserProfile(profile);
                return profile;
            }
            catch { return new UserProfile(); }
        }

        private void SaveUserProfile(UserProfile profile)
        {
            if (string.IsNullOrWhiteSpace(profile.Id)) profile.Id = currentUserId;
            WriteUserProfileFile(userFile, profile);
            WriteUserProfileFile(Path.Combine(dataFolder, "user.json"), profile);
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

                // Uma única tentativa de foco após o explorer inicializar
                _ = Task.Run(async () =>
                {
                    await Task.Delay(2500);
                    Dispatcher.Invoke(() =>
                    {
                        if (!_systemControllerActive && !_gameSessionActive &&
                            !_dialogModeActive && string.IsNullOrEmpty(_mediaExeCurrentUrl))
                        {
                            SetForegroundWindow(_mainWindowHandle);
                            Activate();
                        }
                    });
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

        private string FindNativeAssetUrl(string appId, string assetName)
        {
            var nativeAssetsRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "native-assets", appId);
            foreach (var ext in new[] { ".webp", ".png", ".jpg", ".jpeg", ".gif" })
            {
                var path = Path.Combine(nativeAssetsRoot, assetName + ext);
                if (File.Exists(path))
                    return $"https://app.local/native-assets/{appId}/{assetName}{ext}";
            }
            return "";
        }

        private MediaAppModel BuildNativeMediaApp(
            string id,
            string name,
            string url,
            string type,
            bool multiUser,
            string targetUserId,
            MediaAppModel existingEntry)
        {
            string localGrid = FindNativeAssetUrl(id, "grid");
            string localHorizontal = FindNativeAssetUrl(id, "grid-horizontal");
            string localHero = FindNativeAssetUrl(id, "hero");
            string localLogo = FindNativeAssetUrl(id, "logo");

            return new MediaAppModel
            {
                Id = id,
                Name = name,
                Url = url,
                Type = type,
                MultiUser = multiUser,
                OwnerUserId = targetUserId,
                ShareMode = existingEntry.ShareMode,
                SharedWithUserId = existingEntry.SharedWithUserId,
                SharedWithUserIds = existingEntry.SharedWithUserIds,
                SharedWithUserName = existingEntry.SharedWithUserName,
                SharedWithUserNames = existingEntry.SharedWithUserNames,
                DisableGamepadControl = existingEntry.DisableGamepadControl,
                GridImage = !string.IsNullOrEmpty(localGrid) ? localGrid : existingEntry.GridImage,
                GridHorizontalImage = !string.IsNullOrEmpty(localHorizontal) ? localHorizontal : existingEntry.GridHorizontalImage,
                HeroImage = !string.IsNullOrEmpty(localHero) ? localHero : existingEntry.HeroImage,
                LogoImage = !string.IsNullOrEmpty(localLogo) ? localLogo : existingEntry.LogoImage,
                GridStaticImage = existingEntry.GridStaticImage,
                GridHorizontalStaticImage = existingEntry.GridHorizontalStaticImage,
                HeroStaticImage = existingEntry.HeroStaticImage,
                LogoStaticImage = existingEntry.LogoStaticImage,
                LastPlayed = existingEntry.LastPlayed,
                DateAdded = existingEntry.DateAdded == DateTime.MinValue ? DateTime.Now : existingEntry.DateAdded
            };
        }


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
                apps.Add(BuildNativeMediaApp(id, name, url, type, multiUser, targetUserId, existingEntry));

                if (targetUserId == currentUserId) PostProgress(id, "done");
            }

            var nativeIds = _nativeApps.Select(a => a.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
            apps.AddRange(existing.Where(a => !a.IsSharedFromOtherUser && !nativeIds.Contains(a.Id)));

            await Task.Run(() => SaveMediaAppsForSpecificUser(apps, targetUserId, targetMediaFile)).ConfigureAwait(false);

            if (!silent && targetUserId == currentUserId)
                _ = Dispatcher.BeginInvoke(() => SendMediaAppsToUI(apps));
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
            bool canFallbackToRoot = string.Equals(userId, currentUserId, StringComparison.OrdinalIgnoreCase);
            string fallbackFile = Path.Combine(dataFolder, "media.json");
            if (!File.Exists(file))
            {
                if (!canFallbackToRoot || !File.Exists(fallbackFile)) return new List<MediaAppModel>();
                file = fallbackFile;
            }
            try
            {
                var apps = JsonSerializer.Deserialize<List<MediaAppModel>>(SafeReadAllText(file)) ?? new List<MediaAppModel>();
                foreach (var app in apps.Where(a => string.IsNullOrWhiteSpace(a.OwnerUserId)))
                    app.OwnerUserId = userId;
                foreach (var app in apps.Where(a => a.ShareMode == "user"))
                    ApplySharedUserNames(app);

                if (canFallbackToRoot &&
                    string.Equals(file, fallbackFile, StringComparison.OrdinalIgnoreCase) &&
                    apps.Count > 0)
                {
                    try { SafeWriteAllText(mediaFile, JsonSerializer.Serialize(apps, new JsonSerializerOptions { WriteIndented = true })); } catch { }
                }

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
        private CancellationTokenSource? _backgroundAppMonitorCts;
        private void MonitorBackgroundAppDeath()
        {
            _backgroundAppMonitorCts?.Cancel();
            _backgroundAppMonitorCts = new CancellationTokenSource();
            var token = _backgroundAppMonitorCts.Token;

            Task.Run(async () =>
            {
                try
                {
                    while (!token.IsCancellationRequested)
                    {
                        await Task.Delay(2000, token); // Dá uma olhadinha a cada 2 segundos

                        bool isYtActive = false;
                        Dispatcher.Invoke(() => isYtActive = _ytWebView != null && _ytWebView.Visibility == Visibility.Visible);

                        // Se o app não está mais na memória (foi finalizado de vez na bandeja)
                        if (!isYtActive && !IsMediaAppAlive())
                        {
                            Dispatcher.Invoke(() =>
                            {
                                bool shouldMuteDoorpiAudio = ShouldMuteDoorpiAudio();
                                webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "appProcessDied",
                                    hasPendingSession = shouldMuteDoorpiAudio,
                                    hasLiveExternalSession = shouldMuteDoorpiAudio,
                                    shouldMuteDoorpiAudio,
                                    hasBlockingSession = HasAnyBlockingExternalSession()
                                }));
                            });
                            break;
                        }
                    }
                }
                catch (TaskCanceledException) { }
            });
        }


        private bool IsMediaAppAlive()
        {
            foreach (var session in _executableAppSessions.Values.ToArray())
            {
                try
                {
                    if (session.Process != null && !session.Process.HasExited)
                        return true;
                }
                catch { }

                if (string.IsNullOrEmpty(session.Url)) continue;

                try
                {
                    // Busca APENAS pelo nome do processo. Se ele existir na memória
                    // (mesmo sem janela, na bandeja do Windows), consideramos que está vivo!
                    string exeName = Path.GetFileNameWithoutExtension(session.Url);
                    if (!string.IsNullOrEmpty(exeName))
                    {
                        var processes = Process.GetProcessesByName(exeName);
                        if (processes.Length > 0)
                        {
                            return true;
                        }
                    }
                }
                catch { }
            }

            return false;
        }

        private void SendRuntimeSessionsToUI()
        {
            try
            {
                var running = new List<object>();
                bool hasDoorpiParentActiveGame =
                    _gameSession is { Active: true } &&
                    string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase);

                if (_gameSession is { Active: true } && !string.IsNullOrWhiteSpace(_activeSessionGameId))
                {
                    running.Add(new
                    {
                        channel = "games",
                        id = _activeSessionGameId,
                        kind = "game",
                        status = _gameIsMinimized ? "minimized" : "running"
                    });
                }

                foreach (var session in _executableAppSessions.Values.ToArray())
                {
                    var aliveProcess = FindAliveMediaExeProcess(session.Url, session.Process);
                    if (aliveProcess != null)
                        session.Process = aliveProcess;

                    if (aliveProcess == null || string.IsNullOrWhiteSpace(session.Url)) continue;

                    var media = LoadMediaApps().FirstOrDefault(m =>
                        string.Equals(m.Url, session.Url, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(m.Id, session.Url, StringComparison.OrdinalIgnoreCase));

                    running.Add(new
                    {
                        channel = "media",
                        url = session.Url,
                        kind = "exe",
                        status = session.DoorpiSuspended ? "minimized" : (session.ControllerActive ? "active" : "running"),
                        name = media?.Name ?? Path.GetFileNameWithoutExtension(session.Url) ?? "Aplicativo",
                        heroImage = MediaHeroVisual(media),
                        gridImage = MediaGridVisual(media)
                    });
                }

                if (_webAppSession is { WebView: not null } && !string.IsNullOrWhiteSpace(_currentWebAppUrl))
                {
                    running.Add(new
                    {
                        channel = "media",
                        url = _currentWebAppUrl,
                        kind = "web",
                        status = _webAppWindow?.WindowState == WindowState.Minimized ? "minimized" : "running"
                    });
                }

                if (!hasDoorpiParentActiveGame &&
                    _isStoreLauncherSession &&
                    !string.IsNullOrWhiteSpace(_activeStoreId))
                {
                    running.Add(new
                    {
                        channel = "stores",
                        id = _activeStoreId,
                        url = _activeStoreId,
                        kind = "store",
                        status = _storePausedByDoorpi ? "minimized" : "running"
                    });
                }

                webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "runtimeSessionsChanged",
                    hasPendingSession = ShouldMuteDoorpiAudio(),
                    hasLiveExternalSession = ShouldMuteDoorpiAudio(),
                    shouldMuteDoorpiAudio = ShouldMuteDoorpiAudio(),
                    hasBlockingSession = HasAnyBlockingExternalSession(),
                    running
                }));
            }
            catch { }
        }

        private void CloseRunningItem(string id, string url, string channel, string appType)
        {
            if (string.Equals(channel, "games", StringComparison.OrdinalIgnoreCase))
            {
                if (!_gameSessionActive || string.IsNullOrWhiteSpace(_activeSessionGameId))
                    return;

                bool hadStoreChildContext = _storeChildGameActive &&
                    string.Equals(_gameSessionParentKind, "store", StringComparison.OrdinalIgnoreCase);
                string storeChildStoreId = hadStoreChildContext ? _storeChildGameStoreId : "";

                if (hadStoreChildContext)
                {
                    if (IsGogStoreId(storeChildStoreId))
                        _gogBackInputPendingOnStoreResume = true;

                    CloseStoreChildLayerArtifacts();
                    CommitActiveSession();
                    ClearGameWindowSession();

                    _storeChildGameActive = false;
                    _storeChildGameStoreId = "";
                    _storeChildGameId = "";
                    _storeAttachedProcessIds.Clear();
                    _storeAttachedWindowHandles.Clear();

                    if (_isStoreLauncherSession)
                    {
                        _storePausedByDoorpi = true;
                        ResumeStoreSession();
                    }
                    else
                    {
                        ForceFocus();
                    }

                    SendRuntimeSessionsToUI();
                    return;
                }

                bool killedAny = false;
                try
                {
                    if (!string.IsNullOrWhiteSpace(_lockedGameProcessName))
                    {
                        foreach (var p in Process.GetProcessesByName(_lockedGameProcessName))
                        {
                            try
                            {
                                if (hadStoreChildContext && IsProcessActiveStoreLauncher(p))
                                    continue;

                                p.Kill(true);
                                killedAny = true;
                            }
                            catch { }
                        }
                    }

                    if (_pendingLaunchProcess != null &&
                        !SafeHasExited(_pendingLaunchProcess) &&
                        (!hadStoreChildContext || !IsProcessActiveStoreLauncher(_pendingLaunchProcess)))
                    {
                        _pendingLaunchProcess.Kill(true);
                        killedAny = true;
                    }
                }
                catch { }

                if (hadStoreChildContext && !killedAny)
                {
                    if (IsGogStoreId(storeChildStoreId))
                        _gogBackInputPendingOnStoreResume = true;
                    ResumeStoreSession();
                    SendRuntimeSessionsToUI();
                    return;
                }

                CommitActiveSession();
                ClearGameWindowSession();

                // Sempre limpar contexto de store-child ao fechar jogo via Doorpi.
                _storeChildGameActive = false;
                _storeChildGameStoreId = "";
                _storeChildGameId = "";

                if (hadStoreChildContext && _isStoreLauncherSession)
                {
                    if (IsGogStoreId(storeChildStoreId))
                        _gogBackInputPendingOnStoreResume = true;
                    _storePausedByDoorpi = true;
                    ResumeStoreSession();
                }
                else
                {
                    ForceFocus();
                }
                SendRuntimeSessionsToUI();
                return;
            }

            if (string.Equals(channel, "stores", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(appType, "store", StringComparison.OrdinalIgnoreCase))
            {
                CloseStoreSessionCompletely();
                return;
            }

            if (string.Equals(appType, "webview", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(appType, "browser", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrWhiteSpace(url) &&
                    string.Equals(_currentWebAppUrl, url, StringComparison.OrdinalIgnoreCase))
                {
                    CloseYouTubeInline();
                    SendRuntimeSessionsToUI();
                }
                return;
            }

            if (!string.IsNullOrWhiteSpace(url))
            {
                var media = FindMediaAppByUrlOrId(url);
                string mediaUrl = ResolveMediaExecutableUrl(media, url);
                var session = GetExecutableAppSession(mediaUrl) ?? GetExecutableAppSession(url);
                var process = FindAliveMediaExeProcess(mediaUrl, session?.Process);
                if (session != null || process != null || File.Exists(mediaUrl))
                {
                    try { session?.WatcherCts?.Cancel(); } catch { }
                    KillMediaExeProcessTree(mediaUrl, process);

                    if (session != null)
                    {
                        _executableAppSessions.Remove(session.Key);
                        if (string.Equals(_activeExecutableAppSessionKey, session.Key, StringComparison.OrdinalIgnoreCase))
                            _activeExecutableAppSessionKey = "";
                    }
                    else if (string.Equals(_mediaExeCurrentUrl, mediaUrl, StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(_mediaExeCurrentUrl, url, StringComparison.OrdinalIgnoreCase))
                    {
                        ClearExecutableAppSession();
                    }

                    ClearExecutionLock();
                    ForceFocus();
                    SendRuntimeSessionsToUI();
                }
            }
        }
        private long _focusRestoredAtTicks = 0;
        private long _ignoreGameForegroundRestoreUntilUtcTicks = 0;
        public void ForceFocus()
        {
            // Se o jogo foi minimizado pelo usuário (Xbox button) e ainda está vivo,
            // preserva a sessão — fechar um webapp não deve destruir o contexto do jogo.
            bool hasLockedGameProcess = !string.IsNullOrWhiteSpace(_lockedGameProcessName);
            bool preserveGameSession = !string.IsNullOrEmpty(_activeSessionGameId) && (
                IsLockedGameProcessAlive() ||
                (!hasLockedGameProcess && IsPendingLaunchProcessAlive()) ||
                IsLastVisibleWindowStillValid()
            );

            if (!preserveGameSession)
            {
                CommitActiveSession();
                ClearGameWindowSession();
            }
            else
            {
                // Jogo minimizado e vivo: só sinaliza que o Doorpi está visível
                _gameIsRunningAndDoorpiHidden = false;
                // _gameIsMinimized, _currentGameHwnd, _gameSessionActive, 
                // _activeSessionGameId e _lockedGameProcessName ficam intactos
            }

            ClearExecutionLock();

            if (_mediaExeModeActive) _mediaExeModeActive = false;
            if (_systemControllerActive) StopSystemControllerMode();
            _launcherMouseActive = false;

            _mainUiGamepadSuspendedForGame = false;
            Interlocked.Exchange(ref _mainUiGamepadSuppressUntilUtcTicks, 0);
            Interlocked.Exchange(ref _focusRestoredAtTicks, DateTime.UtcNow.Ticks);

            SendGameLaunchStatus("gameLaunchDone");
            ReleaseAllStuckKeys();

            bool hasBlockingSession = HasAnyBlockingExternalSession();
            bool shouldMuteDoorpiAudio = ShouldMuteDoorpiAudio();

            Dispatcher.BeginInvoke(() =>
            {
                var hwnd = _mainWindowHandle != IntPtr.Zero
                    ? _mainWindowHandle
                    : new System.Windows.Interop.WindowInteropHelper(this).Handle;

                if (WindowState != WindowState.Maximized) WindowState = WindowState.Maximized;
                if (GetBootMode() == 2) this.Topmost = true;

                this.Show();
                SetForegroundWindow(hwnd);
                Activate();

                EnsureCursorVisible();
                EnsureCursorHidden();
                _mainScreenMouseVisible = false;
                _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                SetCursorPos(0, 0);

                webView?.Focus();
                Keyboard.Focus(webView);

                webView?.CoreWebView2?.ExecuteScriptAsync(
                    "window.isDoorpiFocused = true; window.isMediaAppActive = false; window.isGameLaunchActive = false; window._doorpiGameInputSuppressedUntil = 0; window.focusFeaturedCard?.();");
                webView?.CoreWebView2?.PostWebMessageAsString(
                    JsonSerializer.Serialize(new
                    {
                        type = "windowFocused",
                        appAlive = shouldMuteDoorpiAudio,
                        hasBlockingSession,
                        hasLiveExternalSession = shouldMuteDoorpiAudio,
                        shouldMuteDoorpiAudio
                    }));
                SendRuntimeSessionsToUI();
                DiscordRpcManager.Instance.UpdateState("menu");
            });
        }
        private void FocusDoorpiKeepSession()
        {
          
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

                if (WindowState != WindowState.Maximized) WindowState = WindowState.Maximized;
                if (GetBootMode() == 2) this.Topmost = true;

                this.Show();
                SetForegroundWindow(hwnd);
                Activate();

                EnsureCursorVisible();
                EnsureCursorHidden();
                _mainScreenMouseVisible = false;
                _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                SetCursorPos(0, 0);

                webView?.Focus();
                Keyboard.Focus(webView);

                webView?.CoreWebView2?.ExecuteScriptAsync(
                    "window.isDoorpiFocused = true; window.isMediaAppActive = false; window.isGameLaunchActive = false; window._doorpiGameInputSuppressedUntil = 0; window.focusFeaturedCard?.();");
                bool shouldMuteDoorpiAudio = ShouldMuteDoorpiAudio();
                webView?.CoreWebView2?.PostWebMessageAsString(
                    JsonSerializer.Serialize(new
                    {
                        type = "windowFocused",
                        appAlive = shouldMuteDoorpiAudio,
                        hasBlockingSession = false,
                        hasLiveExternalSession = shouldMuteDoorpiAudio,
                        shouldMuteDoorpiAudio
                    }));
                try { webView?.CoreWebView2?.PostWebMessageAsString("{\"type\":\"officialReturnToDoorpi\"}"); } catch { }
                SendRuntimeSessionsToUI();
                DiscordRpcManager.Instance.UpdateState("menu");

            });
        }

        private void MinimizeCurrentGameAndRestoreDoorpi()
        {
            Debug.WriteLine("\n=======================================================");
            Debug.WriteLine("[DEBUG MINIMIZE] INICIANDO MINIMIZAÇÃO DA SESSÃO");

            Interlocked.Exchange(ref _executionLockSuppressUntilUtcTicks, DateTime.UtcNow.AddSeconds(2).Ticks);
            Interlocked.Exchange(ref _ignoreGameForegroundRestoreUntilUtcTicks, DateTime.UtcNow.AddSeconds(2).Ticks);
            _gameIsMinimized = true;
            _gameIsRunningAndDoorpiHidden = false;
            MarkStorePausedBecauseChildGameReturnedToDoorpi();
            _mainUiGamepadSuspendedForGame = false;
            _launcherMouseActive = false;
            SuspendExecutionLockWatch();
            SendGameLaunchStatus("gameLaunchDone");
            try { webView?.CoreWebView2?.PostWebMessageAsString("{\"type\":\"officialReturnToDoorpi\"}"); } catch { }
            Interlocked.Exchange(ref _mainUiGamepadSuppressUntilUtcTicks, 0);
            SendRuntimeSessionsToUI();

            // Minimiza a janela da sessão atual: jogo real, launcher conhecido, ou pending-process.
            IntPtr targetHwnd = _currentGameHwnd;
            if (targetHwnd == IntPtr.Zero &&
                _currentLauncherHwnd != IntPtr.Zero &&
                (IsWindowVisible(_currentLauncherHwnd) || IsIconic(_currentLauncherHwnd)))
            {
                targetHwnd = _currentLauncherHwnd;
            }

            if (targetHwnd == IntPtr.Zero && IsPendingLaunchProcessAlive() && _pendingLaunchProcess != null)
            {
                try
                {
                    targetHwnd = FindAnyWindowForProcess(_pendingLaunchProcess.Id);
                    if (targetHwnd == IntPtr.Zero) targetHwnd = _pendingLaunchProcess.MainWindowHandle;
                }
                catch { }
            }

            if (targetHwnd != IntPtr.Zero)
            {
                // PostMessage SC_MINIMIZE é mais confiável para DX9/DX11 fullscreen exclusivo;
                // ShowWindowAsync fica como fallback caso a janela não processe WM_SYSCOMMAND.
                if (!PostMessage(targetHwnd, WM_SYSCOMMAND, new IntPtr(SC_MINIMIZE), IntPtr.Zero))
                    ShowWindowAsync(targetHwnd, 6);

                _lastVisibleWindowBeforeMinimize = targetHwnd;
            }

            DiscordRpcManager.Instance.UpdateState("menu");


            Task.Run(async () =>
            {
                await Task.Delay(500);
                Dispatcher.Invoke(() => FocusDoorpiKeepSession());
            });

            Debug.WriteLine("=======================================================\n");
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
            "leagueclient", "leagueclientux", "leagueclientuxrender",
            "eadesktop", "eabackgroundservice", "origin", "battle.net", "battle.net helper",
            "ubisoftconnect", "upc", "rockstarservice", "rockstarlauncher",
            "redprelauncher", "2klauncher", "t2gp"
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
        private HashSet<IntPtr> SnapshotVisibleWindows()
        {
            var set = new HashSet<IntPtr>();
            EnumWindows((hWnd, _) =>
            {
                if (IsWindowVisible(hWnd)) set.Add(hWnd);
                return true;
            }, IntPtr.Zero);
            return set;
        }
        private List<IntPtr> FindGameplayWindows(HashSet<IntPtr> snapshot)
        {
            var result = new List<IntPtr>();
            var shell = GetShellWindow();

            EnumWindows((hWnd, _) =>
            {
                if (hWnd == _mainWindowHandle || hWnd == shell) return true;
                if (snapshot.Contains(hWnd)) return true;
                if (!IsGameplayWindow(hWnd)) return true;

                // Ignora processos com "Launcher" no nome
                try
                {
                    GetWindowThreadProcessId(hWnd, out uint pid);
                    var proc = Process.GetProcessById((int)pid);
                    if (SafeProcessName(proc).Contains("Launcher", StringComparison.OrdinalIgnoreCase) ||
                        SafeProcessPath(proc).Contains("Launcher", StringComparison.OrdinalIgnoreCase))
                        return true;
                }
                catch { }

                result.Add(hWnd);
                return true;
            }, IntPtr.Zero);

            return result;
        }

        private bool IsGameplayWindow(IntPtr hWnd)
        {
            if (!IsWindowVisible(hWnd) || IsIconic(hWnd)) return false;
            if (hWnd == _mainWindowHandle) return false;
            if (hWnd == GetShellWindow()) return false;
            if (!GetWindowRect(hWnd, out RECT r)) return false;

            int w = r.Width;
            int h = r.Height;
            if (w <= 0 || h <= 0) return false;

            int screenW = (int)System.Windows.SystemParameters.PrimaryScreenWidth;
            int screenH = (int)System.Windows.SystemParameters.PrimaryScreenHeight;

            double coverage = (double)(w * h) / (double)(screenW * screenH);
            return coverage >= 0.80;
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

            _gameIsRunningAndDoorpiHidden = false;
            _gameSessionActive = true;
            _gameIsMinimized = false;
            _currentGameHwnd = IntPtr.Zero;
            _currentLauncherHwnd = IntPtr.Zero;
            _lockedGameProcessName = "";  // ← NOVO: limpa sessão anterior

            // Fotografa as janelas existentes ANTES do jogo abrir qualquer coisa.
            var windowSnapshot = SnapshotVisibleWindows();
            SendRuntimeSessionsToUI();

            _ = Task.Run(() => MonitorGameLaunchAsync(game, windowSnapshot, cts.Token));
        }
        private void TryFocusAndMaximizeNewWindow(HashSet<IntPtr> snapshot, HashSet<IntPtr> alreadyProcessed)
        {
            var shell = GetShellWindow();
            int screenW = (int)SystemParameters.PrimaryScreenWidth;
            int screenH = (int)SystemParameters.PrimaryScreenHeight;

            EnumWindows((hWnd, _) =>
            {
                if (hWnd == _mainWindowHandle || hWnd == shell) return true;
                if (snapshot.Contains(hWnd) || alreadyProcessed.Contains(hWnd)) return true;
                if (!IsWindowVisible(hWnd) || IsIconic(hWnd)) return true;

                // Ignora janelinhas minúsculas de background
                if (!GetWindowRect(hWnd, out RECT r) || r.Width < 300 || r.Height < 300) return true;

                // 1. TRAVA GLOBAL DE LAUNCHER
                try
                {
                    GetWindowThreadProcessId(hWnd, out uint pid);
                    var proc = Process.GetProcessById((int)pid);
                    string procName = SafeProcessName(proc);
                    string procPath = SafeProcessPath(proc);

                    if (procName.Contains("Launcher", StringComparison.OrdinalIgnoreCase) ||
                        procPath.Contains("Launcher", StringComparison.OrdinalIgnoreCase) ||
                        procName.Contains("Splash", StringComparison.OrdinalIgnoreCase))
                    {
                        alreadyProcessed.Add(hWnd);
                        _currentLauncherHwnd = hWnd;
                        return true;
                    }
                }
                catch { }

                // 2. VERIFICA COBERTURA DA TELA (Hands Off para jogos já grandes/fullscreen)
                double coverage = (double)(r.Width * r.Height) / (double)(screenW * screenH);

                if (coverage >= 0.80)
                {
                    alreadyProcessed.Add(hWnd);
                    return false; // Achou a janela principal, para de procurar.
                }

                // 3. Dá pra redimensionar?
                int style = GetWindowLong(hWnd, GWL_STYLE);
                bool canResize = (style & WS_THICKFRAME) != 0 || (style & WS_MAXIMIZEBOX) != 0;

                if (!canResize)
                {
                    // Se é menor que 80% da tela e NÃO tem botão de maximizar...
                    // É um Launcher de janela fixa ou caixa de diálogo
                    alreadyProcessed.Add(hWnd);
                    return true;
                }

                // 4. MAXIMIZAÇÃO SEGURA (É janela de jogo, dá pra esticar)
                alreadyProcessed.Add(hWnd);

                // Doorpi vai pra trás
                SetWindowPos(_mainWindowHandle, HWND_NOTOPMOST, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);

                FocusExternalWindow(hWnd);

                // Pede com educação pro Windows maximizar a janela
                SetWindowPos(hWnd, HWND_TOP, 0, 0, screenW, screenH, 0);
                ShowWindow(hWnd, 3);

                return false; // Achou a janela e maximizou, fim!
            }, IntPtr.Zero);
        }
        private async Task MonitorGameLaunchAsync(GameModel game, HashSet<IntPtr> windowSnapshot, CancellationToken token)
        {
            try
            {
                bool doorpiHidden = false;
                var alreadyProcessed = new HashSet<IntPtr>();
                int missingChecks = 0;
                var startedUtc = DateTime.UtcNow;

                string lockedProcessName = "";

                while (!token.IsCancellationRequested && !_launchCancelled)
                {
                    // --- MÁGICA: PAUSA ABSOLUTA DA BUSCA SE TIVER MINIMIZADO ---
                    if (_gameIsMinimized)
                    {
                        bool canTreatForegroundAsRestore =
                            DateTime.UtcNow.Ticks >= Interlocked.Read(ref _ignoreGameForegroundRestoreUntilUtcTicks) &&
                            !IsDoorpiMainWindowForeground();

                        if (canTreatForegroundAsRestore && IsForegroundOwnedByCurrentGame())
                        {
                            Dispatcher.Invoke(MarkCurrentGameForegroundRestored);
                            continue;
                        }

                        await Task.Delay(500, token).ConfigureAwait(false);
                        continue;
                    }

                    if (!doorpiHidden && (DateTime.UtcNow - startedUtc).TotalMinutes > 4)
                    {
                        Dispatcher.Invoke(() => ForceFocus());
                        return;
                    }

                    var candidates = FindGameplayWindows(windowSnapshot);

                    if (candidates.Count > 0)
                    {
                        missingChecks = 0;
                        _currentGameHwnd = candidates[0];

                        // LOCK-ON: Salva o nome do processo da tela de jogo quando ela aparece
                        if (string.IsNullOrEmpty(lockedProcessName))
                        {
                            try
                            {
                                GetWindowThreadProcessId(candidates[0], out uint pidRaw);
                                var proc = Process.GetProcessById((int)pidRaw);
                                lockedProcessName = SafeProcessName(proc);
                                _lockedGameProcessName = lockedProcessName; // ← NOVO: promove para classe
                                _currentLauncherHwnd = IntPtr.Zero;         // ← NOVO: esquece o launcher
                                _pendingLaunchProcess = null;               // jogo real identificado: launcher intermediário deixa de ser referência
                            }
                            catch { }
                        }

                        if (!doorpiHidden)
                        {
                            if (_launchCancelled) return;

                            SendGameLaunchStatus("gameLaunchReady", game.Name, game.HeroImage ?? "", game.GridImage ?? "");

                            await EnsureMinimumAnimationTimeAsync(token).ConfigureAwait(false);
                            if (token.IsCancellationRequested || _launchCancelled) return;

                            doorpiHidden = true;
                            _gameIsRunningAndDoorpiHidden = true;

                            SendDoorpiToBackground();
                            Dispatcher.Invoke(() =>
                            {
                                if (GetWindowRect(candidates[0], out RECT r))
                                {
                                    int screenW = (int)SystemParameters.PrimaryScreenWidth;
                                    int screenH = (int)SystemParameters.PrimaryScreenHeight;
                                    double coverage = (double)(r.Width * r.Height) / (double)(screenW * screenH);
                                    if (coverage < 0.80)
                                        FocusExternalWindow(candidates[0]);

                                }

                            });

                            SendGameLaunchStatus("gameLaunchDone");
                            DiscordRpcManager.Instance.UpdateState("game", game.Name);

                        }
                    }
                    else if (!doorpiHidden)
                    {
                        // Qualquer janela nova: tenta foco + fullscreen/maximize
                        Dispatcher.Invoke(() => TryFocusAndMaximizeNewWindow(windowSnapshot, alreadyProcessed));
                    }
                    else if (doorpiHidden)
                    {
                        // A TELA DE JOGO SUMIU: Verifica se o processo travado ainda está vivo
                        bool isProcessStillAlive = false;

                        if (!string.IsNullOrEmpty(lockedProcessName))
                        {
                            // Busca se existe QUALQUER processo com esse nome rodando (The witcher troca de um pro outro)
                            if (Process.GetProcessesByName(lockedProcessName).Length > 0)
                            {
                                isProcessStillAlive = true;
                            }
                        }

                        if (isProcessStillAlive)
                        {
                            // O executável está vivo (trocando de tela, piscando DirectX, etc). 
                            // Reseta os checks e aguarda a nova janela aparecer!
                            missingChecks = 0;
                        }
                        else
                        {
                            missingChecks++;
                            if (!string.IsNullOrEmpty(lockedProcessName) && missingChecks >= 2)
                            {
                                Dispatcher.Invoke(() => ForceFocus());
                                return;
                            }

                            if (missingChecks == 4)
                            {
                                Dispatcher.Invoke(() =>
                                {
                                    _gameIsRunningAndDoorpiHidden = false;
                                    if (IsForegroundDoorpi())
                                        ShowExecutionLockForGame();
                                    SendRuntimeSessionsToUI();
                                });
                            }

                            if (missingChecks >= 8)
                            {
                                Dispatcher.Invoke(() => ForceFocus());
                                return;
                            }
                        }
                    }

                    await Task.Delay(300, token).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex) { Debug.WriteLine($"[GameLaunchMonitor] {ex.Message}"); }
        }
        // ── Session tracking ──────────────────────────────────────────────────────
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
                    reason,
                    hasPendingSession = ShouldMuteDoorpiAudio(),
                    hasLiveExternalSession = ShouldMuteDoorpiAudio(),
                    shouldMuteDoorpiAudio = ShouldMuteDoorpiAudio(),
                    hasBlockingSession = HasAnyBlockingExternalSession()
                }));
            });
        }

        private void ClearExecutionLock()
        {
            try { _executionLockFocusCts?.Cancel(); } catch { }
            _executionLockFocusCts?.Dispose();
            _executionLockFocusCts = null;

            _executionLockActive = false;
            _executionLockKind = "";
            _executionLockChannel = "";
            _executionLockId = "";
            _executionLockUrl = "";
            _executionLockAppType = "";
            try
            {
                webView?.CoreWebView2?.PostWebMessageAsString("{\"type\":\"executionLockCleared\"}");
            }
            catch { }
        }

        private void SuspendExecutionLockWatch()
        {
            _executionLockWatchSuspended = true;
            ClearExecutionLock();
            try { webView?.CoreWebView2?.PostWebMessageAsString("{\"type\":\"officialReturnToDoorpi\"}"); } catch { }
        }

        private void ResumeExecutionLockWatch()
        {
            _executionLockWatchSuspended = false;
        }

        private bool IsForegroundDoorpi()
        {
            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero) return false;
                if (foreground == _mainWindowHandle) return true;

                GetWindowThreadProcessId(foreground, out var pidRaw);
                return pidRaw == Environment.ProcessId;
            }
            catch { return false; }
        }

        private bool IsForegroundOwnedByExecutablePath(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return false;
            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero) return false;
                GetWindowThreadProcessId(foreground, out var pidRaw);
                if (pidRaw == 0) return false;

                using var process = Process.GetProcessById((int)pidRaw);
                var foregroundPath = SafeProcessPath(process);
                if (!string.IsNullOrWhiteSpace(foregroundPath) && PathsEqual(foregroundPath, path))
                    return true;

                var exeName = Path.GetFileNameWithoutExtension(path);
                return !string.IsNullOrWhiteSpace(exeName) &&
                       string.Equals(SafeProcessName(process), exeName, StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        private bool IsForegroundExternalInteractiveWindow(out IntPtr foreground, out Process? process)
        {
            foreground = IntPtr.Zero;
            process = null;

            try
            {
                foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero || foreground == GetShellWindow()) return false;
                if (_mainWindowHandle != IntPtr.Zero && (foreground == _mainWindowHandle || IsChild(_mainWindowHandle, foreground))) return false;
                if (!IsWindowVisible(foreground) || IsIconic(foreground)) return false;
                if (!GetWindowRect(foreground, out RECT rect) || rect.Width < 80 || rect.Height < 80) return false;

                GetWindowThreadProcessId(foreground, out var pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId) return false;

                process = Process.GetProcessById((int)pidRaw);
                return true;
            }
            catch { return false; }
        }

        private static bool TextMatchesAppName(string haystack, string appName)
        {
            if (string.IsNullOrWhiteSpace(haystack) || string.IsNullOrWhiteSpace(appName))
                return false;

            foreach (var token in Regex.Split(appName, @"[^\p{L}\p{Nd}]+")
                         .Where(t => t.Length >= 3)
                         .Take(4))
            {
                if (haystack.Contains(token, StringComparison.OrdinalIgnoreCase))
                    return true;
            }

            return false;
        }

        private bool IsForegroundOwnedByActiveStore()
        {
            if (IsForegroundOwnedBySteamInteractiveWindow())
                return true;

            if (IsForegroundOwnedByBattleNetInteractiveWindow())
                return true;

            if (IsForegroundOwnedByGogInteractiveWindow())
                return true;

            if (IsForegroundOwnedByStoreAuxiliaryWindow())
                return true;

            try
            {
                if (_storeLauncherProcess != null &&
                    !SafeHasExited(_storeLauncherProcess) &&
                    IsForegroundOwnedByProcess(_storeLauncherProcess.Id))
                    return true;
            }
            catch { }

            if (!string.IsNullOrWhiteSpace(_storeLauncherExe) &&
                TryFindStoreWindow(_activeStoreId ?? "", _storeLauncherExe, out var storeProc, out var storeHwnd))
            {
                try
                {
                    var foreground = GetForegroundWindow();
                    if (foreground == storeHwnd) return true;

                    GetWindowThreadProcessId(foreground, out var pidRaw);
                    if (pidRaw != 0 && pidRaw == (uint)storeProc.Id) return true;
                }
                catch { }
            }

            return !string.IsNullOrWhiteSpace(_storeLauncherExe) &&
                   IsForegroundOwnedByExecutablePath(_storeLauncherExe);
        }

        private bool IsForegroundOwnedByStoreAuxiliaryWindow()
        {
            if (!_isStoreLauncherSession ||
                _storePausedByDoorpi ||
                IsStoreChildGameBlockingStoreControls())
            {
                return false;
            }

            if (!IsForegroundExternalInteractiveWindow(out var foreground, out var process) ||
                process == null)
            {
                return false;
            }

            try
            {
                var processName = SafeProcessName(process);
                if (string.IsNullOrWhiteSpace(processName))
                    return false;

                bool knownAuxiliaryProcess = IsStoreAuxiliaryProcessName(processName);
                if (!knownAuxiliaryProcess && _storeWindowSnapshot.Contains(foreground))
                    return false;

                if (!knownAuxiliaryProcess && _shellProcessNames.Contains(processName))
                    return false;

                return true;
            }
            catch { return false; }
            finally
            {
                try { process.Dispose(); } catch { }
            }
        }

        private bool TryRequestCloseStoreChildGameWindow()
        {
            var hwnd = ResolveCurrentGameWindow();
            if (hwnd == IntPtr.Zero)
                return false;

            try
            {
                GetWindowThreadProcessId(hwnd, out uint pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId)
                    return false;

                using var process = Process.GetProcessById((int)pidRaw);
                if (IsProcessActiveStoreLauncher(process))
                    return false;

                return PostMessage(hwnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
            }
            catch { return false; }
        }

        private bool IsProcessActiveStoreLauncher(Process process)
        {
            try
            {
                if (process.Id == SafeProcessId(_storeLauncherProcess))
                    return true;

                var processPath = SafeProcessPath(process);
                if (!string.IsNullOrWhiteSpace(processPath) &&
                    !string.IsNullOrWhiteSpace(_storeLauncherExe) &&
                    PathsEqual(processPath, _storeLauncherExe))
                {
                    return true;
                }

                var launcherName = !string.IsNullOrWhiteSpace(_storeLauncherExe)
                    ? Path.GetFileNameWithoutExtension(_storeLauncherExe)
                    : _storeProcessGroupExeName;

                return !string.IsNullOrWhiteSpace(launcherName) &&
                       string.Equals(SafeProcessName(process), launcherName, StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        private static bool IsStoreAuxiliaryProcessName(string processName)
        {
            if (string.IsNullOrWhiteSpace(processName)) return false;

            return _storeAuxiliaryProcessNames.Contains(processName);
        }

        private static readonly HashSet<string> _storeAuxiliaryProcessNames = new(StringComparer.OrdinalIgnoreCase)
        {
            "chrome", "msedge", "firefox", "brave", "opera", "opera_gx", "vivaldi",
            "browser", "iexplore", "systemsettings", "applicationframehost",
            "rundll32", "control", "controlpanel"
        };

        private bool IsForegroundOwnedByCurrentGame()
        {
            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero) return false;

                if (_currentGameHwnd != IntPtr.Zero && foreground == _currentGameHwnd)
                    return true;

                GetWindowThreadProcessId(foreground, out var pidRaw);
                if (pidRaw == 0) return false;

                using var process = Process.GetProcessById((int)pidRaw);
                var processName = SafeProcessName(process);
                if (!string.IsNullOrWhiteSpace(_lockedGameProcessName) &&
                    string.Equals(processName, _lockedGameProcessName, StringComparison.OrdinalIgnoreCase))
                {
                    _currentGameHwnd = foreground;
                    return true;
                }
            }
            catch { }

            return false;
        }

        private void MarkCurrentGameForegroundRestored()
        {
            if (!_gameSessionActive || !_gameIsMinimized) return;

            _gameIsMinimized = false;
            _gameIsRunningAndDoorpiHidden = true;

            if (_storeChildGameActive && _isStoreLauncherSession)
            {
                _storePausedByDoorpi = true;
                _storeControllerActive = false;
            }

            ClearExecutionLock();
            SendGameLaunchStatus("gameLaunchDone");
            SendRuntimeSessionsToUI();
        }

        private bool IsForegroundOwnedByActiveMediaExe()
        {
            try
            {
                if (_mediaExeProcess != null &&
                    !SafeHasExited(_mediaExeProcess) &&
                    IsForegroundOwnedByProcess(_mediaExeProcess.Id))
                    return true;
            }
            catch { }

            if (!string.IsNullOrWhiteSpace(_mediaExeCurrentUrl) &&
                IsForegroundOwnedByExecutablePath(_mediaExeCurrentUrl))
            {
                return true;
            }

            if (!IsForegroundExternalInteractiveWindow(out _, out var foregroundProcess) || foregroundProcess == null)
                return false;

            try
            {
                var media = LoadMediaApps().FirstOrDefault(m =>
                    string.Equals(m.Url, _mediaExeCurrentUrl, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(m.Id, _mediaExeCurrentUrl, StringComparison.OrdinalIgnoreCase));

                string foregroundPath = SafeProcessPath(foregroundProcess);
                string foregroundName = SafeProcessName(foregroundProcess);
                string foregroundTitle = GetWindowTitle(GetForegroundWindow());
                string haystack = $"{foregroundName} {foregroundTitle} {foregroundPath}";

                if (File.Exists(_mediaExeCurrentUrl) && !string.IsNullOrWhiteSpace(foregroundPath))
                {
                    string sessionDir = Path.GetDirectoryName(Path.GetFullPath(_mediaExeCurrentUrl)) ?? "";
                    string foregroundDir = Path.GetDirectoryName(Path.GetFullPath(foregroundPath)) ?? "";
                    if (!string.IsNullOrWhiteSpace(sessionDir) &&
                        foregroundDir.StartsWith(sessionDir, StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }

                return TextMatchesAppName(haystack, media?.Name ?? "");
            }
            catch { return false; }
        }

        private void StartExecutionLockFocusMonitor()
        {
            try { _executionLockFocusCts?.Cancel(); } catch { }
            _executionLockFocusCts?.Dispose();
            _executionLockFocusCts = new CancellationTokenSource();
            var token = _executionLockFocusCts.Token;

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(250, token).ConfigureAwait(false);

                    while (!token.IsCancellationRequested)
                    {
                        if (!_executionLockActive)
                            return;

                        string kind = _executionLockKind;
                        bool foregroundReturned =
                            (kind == "exe" && IsForegroundOwnedByActiveMediaExe()) ||
                            (kind == "store" && IsForegroundOwnedByActiveStore()) ||
                            (kind == "game" && _currentGameHwnd != IntPtr.Zero && GetForegroundWindow() == _currentGameHwnd);

                        if (foregroundReturned)
                        {
                            Dispatcher.Invoke(() =>
                            {
                                if (!_executionLockActive) return;
                                ReactivateControlsForForegroundSession();
                            });
                            return;
                        }

                        await Task.Delay(250, token).ConfigureAwait(false);
                    }
                }
                catch (OperationCanceledException) { }
                catch (Exception ex) { Debug.WriteLine("[ExecutionLock] Focus monitor: " + ex.Message); }
            });
        }

        private void ReactivateControlsForForegroundSession()
        {
            string kind = _executionLockKind;
            ClearExecutionLock();

            if (kind == "exe")
            {
                var media = LoadMediaApps().FirstOrDefault(m => string.Equals(m.Url, _mediaExeCurrentUrl, StringComparison.OrdinalIgnoreCase) ||
                                                                string.Equals(m.Id, _mediaExeCurrentUrl, StringComparison.OrdinalIgnoreCase));
                InitializeMediaExeMouseModeForSession(media);
                _mediaExeGamepadDisabled = !_mediaExeMouseModeRequested;
                _doorpiSuspendedForMedia = false;
                _mediaExeWatcherPaused = false;
                int sessionId = NextExecutableAppSessionId();

                if (_mediaExeProcess != null && !SafeHasExited(_mediaExeProcess))
                {
                    InitializeMediaExeProcessGroup(_mediaExeCurrentUrl, _mediaExeProcess);
                    _mediaExeWatcherCts?.Cancel();
                    _mediaExeWatcherCts = new CancellationTokenSource();
                    StartMediaExeWatcher(
                        _mediaExeProcess,
                        _mediaExeCurrentUrl,
                        media?.Name ?? Path.GetFileNameWithoutExtension(_mediaExeCurrentUrl) ?? "Aplicativo",
                        _mediaExeWatcherCts.Token);
                }

                EnsureMediaExeShortcutThread(sessionId);

                if (_mediaExeMouseModeRequested)
                    StartMediaExeMouseModeForSession(sessionId, centerCursor: false);

                SendRuntimeSessionsToUI();
                return;
            }

            if (kind == "store")
            {
                ReactivateStoreControlsForForeground();
                return;
            }

            if (kind == "game")
            {
                _gameIsRunningAndDoorpiHidden = true;
                SendRuntimeSessionsToUI();
            }
        }

        private void ShowExecutionLock(string kind, string name, string id, string url, string channel, string appType, string heroImage = "", string gridImage = "")
        {
            if (_executionLockWatchSuspended)
                return;

            if (DateTime.UtcNow.Ticks < Interlocked.Read(ref _executionLockSuppressUntilUtcTicks))
                return;

            if (string.IsNullOrWhiteSpace(name) &&
                string.IsNullOrWhiteSpace(id) &&
                string.IsNullOrWhiteSpace(url))
            {
                ClearExecutionLock();
                return;
            }

            // Nunca abrir EM EXECUÇÃO sem alvo acionável.
            // Isso previne overlay "vazia" em corridas de Alt+Tab.
            if (string.IsNullOrWhiteSpace(id) && string.IsNullOrWhiteSpace(url))
            {
                ClearExecutionLock();
                return;
            }

            _executionLockActive = true;
            _executionLockKind = kind;
            _executionLockChannel = channel;
            _executionLockId = id;
            _executionLockUrl = url;
            _executionLockAppType = appType;

            _mediaExeModeActive = false;
            _storeControllerActive = false;
            StopMediaControllerMode();
            _launcherMouseActive = false;
            EnsureCursorHidden();
            _mainScreenMouseVisible = false;

            SendGameLaunchStatus("gameLaunchDone");
            try
            {
                webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "executionLock",
                    kind,
                    name,
                    id,
                    url,
                    channel,
                    appType,
                    heroImage,
                    gridImage
                }));
            }
            catch { }
            SendRuntimeSessionsToUI();
            StartExecutionLockFocusMonitor();
        }

        private bool ShowExecutionLockForGame()
        {
            if (string.IsNullOrWhiteSpace(_activeSessionGameId)) return false;

            var game = LoadGames().FirstOrDefault(g =>
                string.Equals(g.LaunchUrl, _activeSessionGameId, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(g.Path, _activeSessionGameId, StringComparison.OrdinalIgnoreCase));

            ShowExecutionLock(
                "game",
                game?.Name ?? "Jogo",
                _activeSessionGameId,
                "",
                "games",
                "game",
                game?.HeroImage ?? "",
                game?.GridImage ?? "");
            return true;
        }

        private bool ShowExecutionLockForStore()
        {
            if (!_isStoreLauncherSession || string.IsNullOrWhiteSpace(_activeStoreId)) return false;
            if (!IsForegroundDoorpi()) return false;
            if (IsStoreMainWindowLookupAwaited(_activeStoreId ?? "", _storeLauncherExe ?? "") &&
                !_storeLauncherWindowSeen)
            {
                return false;
            }
            if (_storeLauncherWindowSeen && !HasActiveStoreLauncherWindow())
            {
                FinalizeStoreTraySession();
                return false;
            }
            if (_gameSessionActive &&
                string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            var store = LoadStoreLaunchers().FirstOrDefault(s => string.Equals(s.Id, _activeStoreId, StringComparison.OrdinalIgnoreCase));
            ShowExecutionLock(
                "store",
                store?.Name ?? _activeStoreId ?? "Loja",
                _activeStoreId ?? "",
                _activeStoreId ?? "",
                "stores",
                "store",
                store?.HeroImage ?? "",
                store?.GridImage ?? "");
            return true;
        }

        private void ScheduleStoreExecutionLockIfDoorpiStillForeground()
        {
            _ = Dispatcher.BeginInvoke(async () =>
            {
                await Task.Delay(250);

                bool hasDoorpiParentActiveGame =
                    _gameSessionActive &&
                    string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase);

                if (_executionLockActive ||
                    _executionLockWatchSuspended ||
                    hasDoorpiParentActiveGame ||
                    !_isStoreLauncherSession ||
                    _storePausedByDoorpi ||
                    IsStoreChildGameBlockingStoreControls() ||
                    !IsActiveStoreLauncherProcessAlive() ||
                    !IsForegroundDoorpi())
                {
                    return;
                }

                ShowExecutionLockForStore();
            });
        }

        private bool ShowExecutionLockForMediaExe(string? mediaUrlOverride = null)
        {
            string mediaUrl = !string.IsNullOrWhiteSpace(mediaUrlOverride)
                ? mediaUrlOverride!
                : _mediaExeCurrentUrl;

            if (string.IsNullOrWhiteSpace(mediaUrl))
                return false;

            var media = FindMediaAppByUrlOrId(mediaUrl);
            mediaUrl = ResolveMediaExecutableUrl(media, mediaUrl);
            ActivateExecutableAppSession(mediaUrl);
            _mediaExeCurrentUrl = mediaUrl;

            var aliveProcess = FindAliveMediaExeProcess(mediaUrl, _mediaExeProcess);
            if (aliveProcess == null)
                return false;

            _mediaExeProcess = aliveProcess;

            ShowExecutionLock(
                "exe",
                media?.Name ?? Path.GetFileNameWithoutExtension(mediaUrl) ?? "Aplicativo",
                "",
                mediaUrl,
                "media",
                "exe",
                MediaHeroVisual(media),
                MediaGridVisual(media));
            return true;
        }

        private bool ShowExecutionLockForCurrentSession()
        {
            if (_gameSessionActive && !string.IsNullOrWhiteSpace(_activeSessionGameId))
                return ShowExecutionLockForGame();

            if (!string.IsNullOrWhiteSpace(_mediaExeCurrentUrl) &&
                FindAliveMediaExeProcess(_mediaExeCurrentUrl, _mediaExeProcess) != null)
            {
                return ShowExecutionLockForMediaExe();
            }

            if (_isStoreLauncherSession &&
                !_storePausedByDoorpi &&
                !IsStoreChildGameBlockingStoreControls() &&
                IsActiveStoreLauncherProcessAlive())
            {
                return ShowExecutionLockForStore();
            }

            return false;
        }

        private void RequestExecutionLockFromRuntime(string kind, string channel, string id, string url)
        {
            if (_executionLockWatchSuspended)
                return;

            if (DateTime.UtcNow.Ticks < Interlocked.Read(ref _executionLockSuppressUntilUtcTicks))
                return;

            // Prioridade absoluta: se existe sessão de jogo ativa em primeiro plano lógico,
            // sempre usar o contexto do jogo (mesmo que o runtime candidate venha da loja).
            if (_gameSessionActive &&
                !string.IsNullOrWhiteSpace(_activeSessionGameId))
            {
                ShowExecutionLockForGame();
                return;
            }

            if (_executionLockActive)
                return;

            bool wantsGame = string.Equals(kind, "game", StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(channel, "games", StringComparison.OrdinalIgnoreCase);
            bool wantsStore = string.Equals(kind, "store", StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(channel, "stores", StringComparison.OrdinalIgnoreCase);
            bool wantsMedia = string.Equals(channel, "media", StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(kind, "exe", StringComparison.OrdinalIgnoreCase) ||
                              string.Equals(kind, "web", StringComparison.OrdinalIgnoreCase);

            if (wantsGame &&
                _gameSessionActive &&
                !string.IsNullOrWhiteSpace(_activeSessionGameId))
            {
                ShowExecutionLockForGame();
                return;
            }

            if (wantsStore &&
                !(_gameSessionActive &&
                  string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase)) &&
                _isStoreLauncherSession &&
                !_storePausedByDoorpi &&
                !IsStoreChildGameBlockingStoreControls() &&
                IsActiveStoreLauncherProcessAlive())
            {
                ShowExecutionLockForStore();
                return;
            }

            if (wantsMedia)
            {
                if (!string.IsNullOrWhiteSpace(url))
                {
                    var session = GetExecutableAppSession(url);
                    if (session != null)
                    {
                        ActivateExecutableAppSession(url);
                        if (ShowExecutionLockForMediaExe()) return;
                    }
                }

                if (!string.IsNullOrWhiteSpace(_mediaExeCurrentUrl) &&
                    FindAliveMediaExeProcess(_mediaExeCurrentUrl, _mediaExeProcess) != null &&
                    ShowExecutionLockForMediaExe())
                {
                    return;
                }
            }

            // Fallback resiliente: tenta a sessão ativa conhecida.
            ShowExecutionLockForCurrentSession();
        }

        private IntPtr ResolveCurrentGameWindow()
        {
            IntPtr hwnd = _currentGameHwnd;
            if (hwnd != IntPtr.Zero && (IsWindowVisible(hwnd) || IsIconic(hwnd)))
                return hwnd;

            if (!string.IsNullOrWhiteSpace(_lockedGameProcessName))
            {
                foreach (var process in Process.GetProcessesByName(_lockedGameProcessName))
                {
                    try
                    {
                        hwnd = FindAnyWindowForProcess(process.Id);
                        if (hwnd == IntPtr.Zero) hwnd = process.MainWindowHandle;
                        if (hwnd != IntPtr.Zero)
                        {
                            _currentGameHwnd = hwnd;
                            return hwnd;
                        }
                    }
                    catch { }
                }
            }

            if (IsPendingLaunchProcessAlive())
            {
                try
                {
                    hwnd = FindAnyWindowForProcess(_pendingLaunchProcess!.Id);
                    if (hwnd == IntPtr.Zero) hwnd = _pendingLaunchProcess.MainWindowHandle;
                    if (hwnd != IntPtr.Zero) return hwnd;
                }
                catch { }
            }

            if (IsLastVisibleWindowStillValid())
                return _lastVisibleWindowBeforeMinimize;

            return IntPtr.Zero;
        }

        private void RestoreExecutionLockSession()
        {
            ResumeExecutionLockWatch();

            string kind = _executionLockKind;
            string id = _executionLockId;
            string url = _executionLockUrl;
            ClearExecutionLock();

            if (kind == "game" && !string.IsNullOrWhiteSpace(id))
            {
                var hwnd = ResolveCurrentGameWindow();
                if (hwnd != IntPtr.Zero)
                {
                    RestoreGameCleanly(hwnd);
                    _gameIsMinimized = false;
                    _gameIsRunningAndDoorpiHidden = true;
                    SendGameLaunchStatus("gameLaunchDone");
                    SendRuntimeSessionsToUI();
                }
                else
                {
                    _gameIsRunningAndDoorpiHidden = false;
                    SendGameLaunchStatus("gameLaunchDone");
                    SendRuntimeSessionsToUI();
                    if (IsForegroundDoorpi())
                        ShowExecutionLockForGame();
                }
                return;
            }

            if (kind == "store")
            {
                ResumeStoreSession();
                return;
            }

            if (kind == "exe" && !string.IsNullOrWhiteSpace(url))
            {
                var media = FindMediaAppByUrlOrId(url);
                string mediaUrl = ResolveMediaExecutableUrl(media, url);
                ActivateExecutableAppSession(mediaUrl);
                _mediaExeCurrentUrl = mediaUrl;

                var aliveProcess = FindAliveMediaExeProcess(mediaUrl, _mediaExeProcess);
                HashSet<int>? baselineBeforeLaunch = null;
                if (aliveProcess == null && File.Exists(mediaUrl))
                {
                    try
                    {
                        baselineBeforeLaunch = SnapshotProcessIds();
                        aliveProcess = Process.Start(new ProcessStartInfo
                        {
                            FileName = mediaUrl,
                            UseShellExecute = true,
                            WorkingDirectory = Path.GetDirectoryName(mediaUrl),
                            WindowStyle = ProcessWindowStyle.Maximized
                        });
                    }
                    catch { }
                }

                if (aliveProcess != null)
                {
                    _mediaExeProcess = aliveProcess;
                    InitializeMediaExeProcessGroup(mediaUrl, aliveProcess, baselineBeforeLaunch);

                    var hwnd = FindAnyWindowForProcess(aliveProcess.Id);
                    if (hwnd == IntPtr.Zero) hwnd = aliveProcess.MainWindowHandle;
                    if (hwnd != IntPtr.Zero)
                    {
                        if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
                        ShowWindow(hwnd, 3);
                        FocusExternalWindow(hwnd);
                    }
                    else if (File.Exists(mediaUrl))
                    {
                        try
                        {
                            Process.Start(new ProcessStartInfo
                            {
                                FileName = mediaUrl,
                                UseShellExecute = true,
                                WorkingDirectory = Path.GetDirectoryName(mediaUrl),
                                WindowStyle = ProcessWindowStyle.Maximized
                            });
                        }
                        catch { }
                    }

                    InitializeMediaExeMouseModeForSession(media);
                    _mediaExeGamepadDisabled = !_mediaExeMouseModeRequested;
                    _doorpiSuspendedForMedia = false;
                    _mediaExeWatcherPaused = false;
                    int sessionId = NextExecutableAppSessionId();

                    _mediaExeWatcherCts?.Cancel();
                    _mediaExeWatcherCts = new CancellationTokenSource();
                    StartMediaExeWatcher(
                        aliveProcess,
                        mediaUrl,
                        media?.Name ?? Path.GetFileNameWithoutExtension(mediaUrl) ?? "Aplicativo",
                        _mediaExeWatcherCts.Token);

                    EnsureMediaExeShortcutThread(sessionId);

                    if (_mediaExeMouseModeRequested)
                        StartMediaExeMouseModeForSession(sessionId, centerCursor: false);
                }
                return;
            }
        }

        private void CloseExecutionLockSession()
        {
            string kind = _executionLockKind;
            string id = _executionLockId;
            string url = _executionLockUrl;
            string channel = _executionLockChannel;
            string appType = _executionLockAppType;

            bool shouldCloseStoreChildGame =
                _gameSessionActive &&
                _storeChildGameActive &&
                string.Equals(_gameSessionParentKind, "store", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(_activeSessionGameId);

            if (shouldCloseStoreChildGame)
            {
                kind = "game";
                channel = "games";
                appType = "game";
                id = _activeSessionGameId;
                url = "";
            }

            ClearExecutionLock();

            // Blindagem: sessão de jogo com pai Doorpi nunca pode ser fechada
            // por contexto de loja que tenha "vazado" para o lock atual.
            if (_gameSessionActive &&
                string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(_activeSessionGameId) &&
                !string.Equals(kind, "game", StringComparison.OrdinalIgnoreCase))
            {
                kind = "game";
                channel = "games";
                appType = "game";
                id = _activeSessionGameId;
                url = "";
            }

            CloseRunningItem(id, url, channel, appType);
        }


        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int vKey);

        private void ReleaseAllStuckKeys()
        {
            try
            {
                byte[] keys =
                {
                    0x10, 0x11,             // Shift, Ctrl
                    0x1B, 0x0D, 0x08, 0x09  // Esc, Enter, Backspace, Tab
                };

                foreach (var vk in keys)
                {
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
        private bool IsForegroundStealer(int gamePid)
        {
            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero) return true; // Sem janela focada, recupera o foco pro jogo

                if (foreground == GetShellWindow()) return true;

                var doorpi = _mainWindowHandle;
                if (doorpi != IntPtr.Zero && foreground == doorpi) return false;

                GetWindowThreadProcessId(foreground, out var pidRaw);
                if (pidRaw == 0) return true;
                if (pidRaw == gamePid) return false; // O próprio jogo está focado

                var process = Process.GetProcessById((int)pidRaw);
                string name = SafeProcessName(process).ToLowerInvariant();

                // 1. Desktop / Barra de tarefas / Explorador de arquivos
                if (_shellProcessNames.Contains(name)) return true;

                // 2. Processos conhecidos de Overlays e Launchers que costumam roubar foco no boot
                var knownStealers = new HashSet<string>
                {
                    "steam", "steamwebhelper", "epicgameslauncher", "epicwebhelper",
                    "eosoverlayrenderer", "gameoverlayui", "uplayoverlay", "igoproxy64",
                    "origin", "galaxyclient", "goggalaxy", "redprelauncher", "2klauncher", "t2gp"
                };

                if (knownStealers.Contains(name)) return true;

                // Qualquer outro processo (Discord, Chrome, etc.) assume-se Alt+Tab intencional do usuário
                return false;
            }
            catch { return false; }
        }
        private void SendDoorpiToBackground()
        {
            Dispatcher.BeginInvoke(() =>
            {
                if (!_gameSessionActive) return;
                if (this.Topmost) this.Topmost = false;

                SetWindowPos(_mainWindowHandle, HWND_NOTOPMOST, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
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

        private GameWindowCandidate? FindAlreadyRunningGameWindow(GameModel game)
        {
            string directExePath = GetDirectGameExePath(game);

            if (!string.IsNullOrWhiteSpace(directExePath) && File.Exists(directExePath))
            {
                string directProcessName = Path.GetFileNameWithoutExtension(directExePath);
                foreach (var process in Process.GetProcessesByName(directProcessName))
                {
                    try
                    {
                        string processPath = SafeProcessPath(process);
                        if (!string.IsNullOrWhiteSpace(processPath) && !PathsEqual(processPath, directExePath))
                            continue;

                        IntPtr hwnd = FindAnyWindowForProcess(process.Id);
                        if (hwnd == IntPtr.Zero) hwnd = process.MainWindowHandle;
                        if (hwnd == IntPtr.Zero) continue;

                        return new GameWindowCandidate
                        {
                            Hwnd = hwnd,
                            ProcessId = process.Id,
                            ProcessName = SafeProcessName(process),
                            Score = 250
                        };
                    }
                    catch { }
                }
            }

            var context = new GameLaunchMonitorContext
            {
                Game = game,
                BaselineProcessIds = SnapshotProcessIds(),
                LaunchedProcess = null,
                LaunchedProcessId = 0,
                DirectExePath = directExePath,
                NameTokens = BuildGameNameTokens(game),
                StartedUtc = DateTime.UtcNow
            };

            var candidate = FindBestGameWindowCandidate(context);
            return candidate?.Score >= 80 ? candidate : null;
        }

        private bool TryAdoptAlreadyRunningGame(GameModel game, string gameId)
        {
            var candidate = FindAlreadyRunningGameWindow(game);
            if (candidate == null || candidate.Hwnd == IntPtr.Zero)
                return false;

            bool bindToActiveStoreContext = IsGameOwnedByActiveStore(game);

            _gameSessionActive = true;
            _gameIsMinimized = false;
            _gameIsRunningAndDoorpiHidden = true;
            _currentGameHwnd = candidate.Hwnd;
            _currentLauncherHwnd = IntPtr.Zero;
            _lastVisibleWindowBeforeMinimize = candidate.Hwnd;
            _pendingLaunchProcess = null;
            _lockedGameProcessName = candidate.ProcessName;
            _activeSessionGameId = gameId;
            _gameSessionParentKind = bindToActiveStoreContext ? "store" : "doorpi";
            _forceDoorpiReturnOnGameClose = !bindToActiveStoreContext;
            _storeChildGameActive = bindToActiveStoreContext;
            _storeChildGameStoreId = bindToActiveStoreContext ? (_activeStoreId ?? "") : "";
            _storeChildGameId = bindToActiveStoreContext ? gameId : "";
            _sessionStartUtc = DateTime.UtcNow;

            if (bindToActiveStoreContext)
            {
                MarkStoreChildGameAsPlayed(game, gameId);
                _storeControllerActive = false;
                _storePausedByDoorpi = false;
                _storeAttachedProcessIds.Add(candidate.ProcessId);
                _storeAttachedWindowHandles.Add(candidate.Hwnd);
                CaptureStoreAttachedSessionArtifacts();
            }

            lock (_gameLaunchMonitorLock)
            {
                _gameLaunchMonitorCts?.Cancel();
                _gameLaunchMonitorCts?.Dispose();
                _gameLaunchMonitorCts = new CancellationTokenSource();
                _launchAnimationStartedUtc = DateTime.UtcNow.AddMilliseconds(-MINIMUM_LAUNCH_ANIMATION_MS);

                if (bindToActiveStoreContext)
                {
                    _ = Task.Run(() => MonitorStoreChildGameAsync(game, candidate.ProcessName, _gameLaunchMonitorCts.Token));
                }
                else
                {
                    var snapshot = SnapshotVisibleWindows();
                    snapshot.Remove(candidate.Hwnd);
                    _ = Task.Run(() => MonitorGameLaunchAsync(game, snapshot, _gameLaunchMonitorCts.Token));
                }
            }

            RestoreGameCleanly(candidate.Hwnd);
            SendGameLaunchStatus("gameLaunchDone");
            DiscordRpcManager.Instance.UpdateState("game", game.Name);
            SendRuntimeSessionsToUI();
            return true;
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

            // 1. Origem do Processo (O Jogo ser um processo NOVO é a maior pista de todas)
            if (pid == context.LaunchedProcessId) score += 50;
            if (!context.BaselineProcessIds.Contains(pid)) score += 40;
            if (context.SeenCandidatePids.Contains(pid)) score += 15;

            // 2. Caminho Direto
            if (!string.IsNullOrWhiteSpace(context.DirectExePath) && !string.IsNullOrWhiteSpace(exePath))
            {
                if (PathsEqual(context.DirectExePath, exePath)) score += 150;
                else
                {
                    var gameDir = Path.GetDirectoryName(context.DirectExePath) ?? "";
                    if (!string.IsNullOrWhiteSpace(gameDir) && exePath.StartsWith(gameDir, StringComparison.OrdinalIgnoreCase))
                        score += 60;
                }
            }

            // 3. HEURÍSTICA INTELIGENTE (Resolve o problema do "Dandara" e do "Witcher")
            string firstToken = context.NameTokens.FirstOrDefault() ?? "";
            if (!string.IsNullOrEmpty(firstToken))
            {
                // O nome do executável COMEÇA com a primeira palavra do jogo? Bônus GIGANTE!
                if (exeName.StartsWith(firstToken, StringComparison.OrdinalIgnoreCase)) score += 45;

                // O título da janela tem a primeira palavra do jogo?
                if (title.Contains(firstToken, StringComparison.OrdinalIgnoreCase)) score += 25;
            }

            // Título Exato 100%
            if (!string.IsNullOrWhiteSpace(title) && string.Equals(title, context.Game.Name, StringComparison.OrdinalIgnoreCase))
            {
                score += 60;
            }

            // Tokens Normais (Procurando outras palavras soltas)
            int tokenMatches = context.NameTokens.Count(t => haystack.Contains(t, StringComparison.OrdinalIgnoreCase));
            score += tokenMatches * 20;
            if (tokenMatches >= Math.Min(2, Math.Max(1, context.NameTokens.Length))) score += 25;

            // 4. Bônus por Ser uma Janela Real e Pesada
            if (!string.IsNullOrWhiteSpace(title)) score += 10;

            try
            {
                var mb = process.WorkingSet64 / 1024 / 1024;
                if (mb > 200) score += 15;
                if (mb > 800) score += 20; // Jogos pesados consomem RAM
            }
            catch (Exception ex) when (ex is UnauthorizedAccessException || ex is System.ComponentModel.Win32Exception) { }
            catch { }

            // Penalidade SEVERA para evitar que os Launchers finjam ser o jogo
            if (isLauncher) score -= 60;

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
            try { return process.MainModule?.FileName ?? ""; }
            catch (Exception ex) when (ex is UnauthorizedAccessException || ex is System.ComponentModel.Win32Exception) { return ""; }
            catch { return ""; }
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

                try
                {
                    var process = Process.GetProcessById((int)pidRaw);
                    return _shellProcessNames.Contains(SafeProcessName(process));
                }
                catch (Exception ex) when (ex is UnauthorizedAccessException || ex is System.ComponentModel.Win32Exception)
                {

                    return false;
                }
            }
            catch { return true; }
        }
        private void RestoreGameCleanly(IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero) return;

            // 1. Tira o Doorpi do modo "Sempre no topo"
            if (this.Topmost) this.Topmost = false;

            // 2. Doorpi vai pra trás sem roubar o foco (HWND_NOTOPMOST)
            SetWindowPos(_mainWindowHandle, HWND_NOTOPMOST, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);

            // 3. Restaura o jogo de forma limpa e padrão do Windows
            if (IsIconic(hwnd)) ShowWindow(hwnd, 9); // SW_RESTORE
            else ShowWindow(hwnd, 5);                // SW_SHOW

            // 4. Puxa o foco
            SwitchToThisWindow(hwnd, true);
            SetForegroundWindow(hwnd);
            BringWindowToTop(hwnd);
        }

        private void FocusExternalWindow(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero) return;
            try
            {
                if (IsIconic(hWnd)) ShowWindow(hWnd, 9); // SW_RESTORE
                else ShowWindow(hWnd, 5);
                BringWindowToTop(hWnd);
                SwitchToThisWindow(hWnd, true);
                SetForegroundWindow(hWnd);
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

        private List<InstalledApp> GetSteamGames(bool includeIcons = true)
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
                            string gameFolder = !string.IsNullOrEmpty(installDir)
                                ? Path.Combine(libraryPath, "steamapps", "common", installDir)
                                : "";

                            string iconHash = Regex.Match(acfContent, @"""(?:clienticon|icon)""\s+""([a-fA-F0-9]+)""").Groups[1].Value;
                            if (includeIcons && !string.IsNullOrEmpty(iconHash))
                            {
                                string icoPath = Path.Combine(steamPath, "steam", "games", $"{iconHash}.ico");
                                if (File.Exists(icoPath)) iconBase64 = GetCachedIcon(icoPath);
                            }

                            if (includeIcons && string.IsNullOrEmpty(iconBase64) && !string.IsNullOrEmpty(installDir))
                            {
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

                            if (includeIcons && string.IsNullOrEmpty(iconBase64))
                            {
                                string libraryCachePath = Path.Combine(steamPath, "appcache", "librarycache", $"{appId}_icon.jpg");
                                if (File.Exists(libraryCachePath))
                                    iconBase64 = Convert.ToBase64String(File.ReadAllBytes(libraryCachePath));
                            }

                            list.Add(new InstalledApp
                            {
                                Name = name,
                                LaunchUrl = $"steam://run/{appId}",
                                Path = Directory.Exists(gameFolder) ? gameFolder : appId,
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

        private List<InstalledApp> GetEpicGames(bool includeIcons = true)
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
                    string exePath = !string.IsNullOrEmpty(installLocation) && !string.IsNullOrEmpty(launchExe)
                        ? Path.Combine(installLocation, launchExe)
                        : "";

                    string iconBase64 = "";
                    if (includeIcons && !string.IsNullOrEmpty(installLocation) && !string.IsNullOrEmpty(launchExe))
                    {
                        if (File.Exists(exePath)) iconBase64 = GetCachedIcon(exePath);
                    }

                    list.Add(new InstalledApp
                    {
                        Name = name,
                        LaunchUrl = $"com.epicgames.launcher://apps/{namespaceStr}%3A{catalogItemId}%3A{appName}?action=launch&silent=true",
                        Path = File.Exists(exePath) ? exePath : appName,
                        IconBase64 = iconBase64,
                        Source = "Epic"
                    });
                }
            }
            catch { }
            return list;
        }

        // ========================= GOG =========================

        private List<InstalledApp> GetGOGGames(bool includeIcons = true)
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
                    if (string.IsNullOrWhiteSpace(name))
                        name = gameKey.GetValue("name") as string ?? subKeyName;
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
                            LaunchUrl = $"goggalaxy://launch/{subKeyName}",
                            Path = finalPath,
                            Source = "GOG",
                            IconBase64 = includeIcons ? GetCachedIcon(finalPath) : ""
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
            string fallbackFile = Path.Combine(dataFolder, "folders.json");
            string fileToRead = File.Exists(foldersFile)
                ? foldersFile
                : (File.Exists(fallbackFile) ? fallbackFile : foldersFile);
            if (!File.Exists(fileToRead)) return new List<FolderStats>();
            try
            {
                string json = File.ReadAllText(fileToRead);
                try
                {
                    var data = JsonSerializer.Deserialize<List<FolderStats>>(json);
                    if (data != null && data.Count > 0 && !string.IsNullOrEmpty(data[0].Path))
                    {
                        if (!string.Equals(fileToRead, foldersFile, StringComparison.OrdinalIgnoreCase))
                        {
                            try { SaveFoldersData(data); } catch { }
                        }
                        return data;
                    }
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

            return new FolderStats
            {
                Path = path,
                SubfolderCount = 0,
                ExeCount = 0,
                EstimatedMs = 0
            };
        }
        private async Task RecalculateFolderStatsAsync(string path)
        {
            var stats = await Task.Run(() => GetFolderStats(path)).ConfigureAwait(false);
            var folders = LoadFoldersData();
            var index = folders.FindIndex(f => string.Equals(f.Path, path, StringComparison.OrdinalIgnoreCase));
            if (index >= 0)
            {
                folders[index] = stats;
                SaveFoldersData(folders);
                SendFoldersToUI();
            }
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
            string fallbackFile = Path.Combine(dataFolder, "appcache.json");
            string fileToRead = File.Exists(appCacheFile)
                ? appCacheFile
                : (File.Exists(fallbackFile) ? fallbackFile : appCacheFile);
            if (!File.Exists(fileToRead)) return null;
            try
            {
                var cache = JsonSerializer.Deserialize<AppCacheModel>(File.ReadAllText(fileToRead));
                if (cache != null &&
                    !string.Equals(fileToRead, appCacheFile, StringComparison.OrdinalIgnoreCase))
                {
                    try { SaveAppCache(cache); } catch { }
                }
                return cache;
            }
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
                var ubisoftPrint = GetUbisoftFingerprint();
                var eaPrint = GetEaFingerprint();
                var battleNetPrint = GetBattleNetFingerprint();
                var amazonPrint = GetAmazonFingerprint();
                var xboxPrint = GetXboxFingerprint();
                var winPrint = GetWindowsRegistryFingerprint();

                bool steamStale = !steamPrint.SetEquals(cache.SteamFingerprint) || !cache.SteamApps.Any();
                bool epicStale = !epicPrint.SetEquals(cache.EpicFingerprint) || !cache.EpicApps.Any();
                bool gogStale = !gogPrint.SetEquals(cache.GogFingerprint) || !cache.GogApps.Any();
                bool riotStale = !riotPrint.SetEquals(cache.RiotFingerprint) || !cache.RiotApps.Any();
                bool ubisoftStale = !ubisoftPrint.SetEquals(cache.UbisoftFingerprint) || !cache.UbisoftApps.Any();
                bool eaStale = !eaPrint.SetEquals(cache.EaFingerprint) || !cache.EaApps.Any();
                bool battleNetStale = !battleNetPrint.SetEquals(cache.BattleNetFingerprint) || !cache.BattleNetApps.Any();
                bool amazonStale = !amazonPrint.SetEquals(cache.AmazonFingerprint) || !cache.AmazonApps.Any();
                bool xboxStale = !xboxPrint.SetEquals(cache.XboxFingerprint) || !cache.XboxApps.Any();
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

                var ubisoftTask = Task.Run(() =>
                    ubisoftStale
                        ? (GetUbisoftGames().Select(a => { a.Source = "Ubisoft"; return a; }).ToList(), true)
                        : (cache.UbisoftApps, false));

                var eaTask = Task.Run(() =>
                    eaStale
                        ? (GetEaGames().Select(a => { a.Source = "EA"; return a; }).ToList(), true)
                        : (cache.EaApps, false));

                var battleNetTask = Task.Run(() =>
                    battleNetStale
                        ? (GetBattleNetGames().Select(a => { a.Source = "Battle.net"; return a; }).ToList(), true)
                        : (cache.BattleNetApps, false));

                var amazonTask = Task.Run(() =>
                    amazonStale
                        ? (GetAmazonGames().Select(a => { a.Source = "Amazon"; return a; }).ToList(), true)
                        : (cache.AmazonApps, false));

                var xboxTask = Task.Run(() =>
                    xboxStale
                        ? (GetXboxGames().Select(a => { a.Source = "Xbox"; return a; }).ToList(), true)
                        : (cache.XboxApps, false));

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

                await Task.WhenAll(steamTask, epicTask, gogTask, riotTask, ubisoftTask, eaTask, battleNetTask, amazonTask, xboxTask, winTask, folderTask);

                var (steamApps, steamChanged) = steamTask.Result;
                var (epicApps, epicChanged) = epicTask.Result;
                var (gogApps, gogChanged) = gogTask.Result;
                var (riotApps, riotChanged) = riotTask.Result;
                var (ubisoftApps, ubisoftChanged) = ubisoftTask.Result;
                var (eaApps, eaChanged) = eaTask.Result;
                var (battleNetApps, battleNetChanged) = battleNetTask.Result;
                var (amazonApps, amazonChanged) = amazonTask.Result;
                var (xboxApps, xboxChanged) = xboxTask.Result;
                var (windowsApps, windowsChanged) = winTask.Result;
                (List<InstalledApp> folderApps, Dictionary<string, long> folderTimestamps, bool folderChanged) = folderTask.Result;

                if (cache.XboxFilterVersion < 2)
                {
                    cache.XboxFilterVersion = 2;
                    xboxChanged = true;
                }

                bool anythingChanged = steamChanged || epicChanged || gogChanged || riotChanged
                    || ubisoftChanged || eaChanged || battleNetChanged || amazonChanged || xboxChanged
                    || windowsChanged || folderChanged;


                if (anythingChanged)
                {
                    if (steamChanged) { cache.SteamApps = steamApps; cache.SteamFingerprint = steamPrint; }
                    if (epicChanged) { cache.EpicApps = epicApps; cache.EpicFingerprint = epicPrint; }
                    if (gogChanged) { cache.GogApps = gogApps; cache.GogFingerprint = gogPrint; }
                    if (riotChanged) { cache.RiotApps = riotApps; cache.RiotFingerprint = riotPrint; }
                    if (ubisoftChanged) { cache.UbisoftApps = ubisoftApps; cache.UbisoftFingerprint = ubisoftPrint; }
                    if (eaChanged) { cache.EaApps = eaApps; cache.EaFingerprint = eaPrint; }
                    if (battleNetChanged) { cache.BattleNetApps = battleNetApps; cache.BattleNetFingerprint = battleNetPrint; }
                    if (amazonChanged) { cache.AmazonApps = amazonApps; cache.AmazonFingerprint = amazonPrint; }
                    if (xboxChanged) { cache.XboxApps = xboxApps; cache.XboxFingerprint = xboxPrint; }
                    if (windowsChanged)
                    {
                        cache.WindowsApps = windowsApps; cache.WindowsFingerprint = winPrint;
                        _windowsCacheInvalid = false;
                    }
                    if (folderChanged) { cache.FolderApps = folderApps; cache.FolderTimestamps = folderTimestamps; }

                    RefreshAutoAddSuppressions(cache);
                    SaveAppCache(cache);
                }
                else if (RefreshAutoAddSuppressions(cache))
                {
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
            var finalList = BuildFinalList(
                cache.SteamApps, cache.EpicApps, cache.GogApps, cache.RiotApps,
                cache.UbisoftApps, cache.EaApps, cache.BattleNetApps, cache.AmazonApps, cache.XboxApps,
                cache.WindowsApps, cache.FolderApps, existingMap);

            var payload = new { type = "installedAppsList", apps = finalList };
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(payload)));
        }

        private static bool IsPlatformSource(string source)
        {
            return source.Equals("Steam", StringComparison.OrdinalIgnoreCase)
                || source.Equals("Epic", StringComparison.OrdinalIgnoreCase)
                || source.Equals("GOG", StringComparison.OrdinalIgnoreCase)
                || source.Equals("Riot", StringComparison.OrdinalIgnoreCase)
                || source.Equals("Ubisoft", StringComparison.OrdinalIgnoreCase)
                || source.Equals("EA", StringComparison.OrdinalIgnoreCase)
                || source.Equals("Battle.net", StringComparison.OrdinalIgnoreCase)
                || source.Equals("Amazon", StringComparison.OrdinalIgnoreCase)
                || source.Equals("Xbox", StringComparison.OrdinalIgnoreCase);
        }

        private static string NormalizeAutoAddKey(string key)
        {
            if (string.IsNullOrWhiteSpace(key)) return "";
            try
            {
                if (Path.IsPathRooted(key)) key = Path.GetFullPath(key);
            }
            catch { }
            return key.Trim();
        }

        private static string AutoAddKeyForApp(InstalledApp app)
            => NormalizeAutoAddKey(!string.IsNullOrWhiteSpace(app.LaunchUrl) ? app.LaunchUrl : app.Path);

        private static string AutoAddKeyForGame(GameModel game)
            => NormalizeAutoAddKey(!string.IsNullOrWhiteSpace(game.LaunchUrl) ? game.LaunchUrl : game.Path);

        private static IEnumerable<string> AutoAddKeysForApp(InstalledApp app)
            => new[] { app.LaunchUrl, app.Path }
                .Select(NormalizeAutoAddKey)
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .Distinct(StringComparer.OrdinalIgnoreCase);

        private static IEnumerable<string> AutoAddKeysForGame(GameModel game)
            => new[] { game.LaunchUrl, game.Path }
                .Select(NormalizeAutoAddKey)
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .Distinct(StringComparer.OrdinalIgnoreCase);

        private static bool InstalledAppMatchesGame(InstalledApp app, GameModel game)
        {
            var gameKeys = AutoAddKeysForGame(game).ToHashSet(StringComparer.OrdinalIgnoreCase);
            return AutoAddKeysForApp(app).Any(gameKeys.Contains);
        }

        private List<InstalledApp> CollectCachedPlatformApps(AppCacheModel cache)
        {
            return cache.SteamApps
                .Concat(cache.EpicApps)
                .Concat(cache.GogApps)
                .Concat(cache.RiotApps)
                .Concat(cache.UbisoftApps)
                .Concat(cache.EaApps)
                .Concat(cache.BattleNetApps)
                .Concat(cache.AmazonApps)
                .Concat(cache.XboxApps)
                .Where(a => IsPlatformSource(a.Source))
                .ToList();
        }

        private static bool IsPlatformManagedLaunchUrl(string launchUrl)
        {
            if (string.IsNullOrWhiteSpace(launchUrl)) return false;
            return launchUrl.StartsWith("steam://", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("com.epicgames.launcher://", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("goggalaxy://", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("uplay://", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("origin2://", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("origin://", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("battlenet://", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("amazon-games://", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("xbox://", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("ms-xbl-", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("riotclient://", StringComparison.OrdinalIgnoreCase);
        }

        private List<GameModel> ReconcileDoorpiGamesWithPlatformCache(AppCacheModel cache)
        {
            var installedKeys = CollectCachedPlatformApps(cache)
                .SelectMany(AutoAddKeysForApp)
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (installedKeys.Count == 0) return new List<GameModel>();

            var games = LoadGames();
            var removed = games
                .Where(g =>
                    (g.AutoAddedByBootstrap || IsPlatformManagedLaunchUrl(g.LaunchUrl)) &&
                    !AutoAddKeysForGame(g).Any(installedKeys.Contains))
                .ToList();

            if (removed.Count == 0) return removed;

            foreach (var game in removed)
            {
                DeleteGameImages(game);
                games.Remove(game);
            }

            SaveGames(games);
            return removed;
        }

        private void PublishRemovedGamesToUI(List<GameModel> removedGames)
        {
            if (removedGames.Count == 0) return;

            LoadGamesIntoUI();
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "gamesRemoved",
                    games = removedGames.Select(g => new
                    {
                        g.Name,
                        g.LaunchUrl,
                        g.Path
                    }).ToList()
                })));
            SendInstalledAppsToUI();
        }

        private int CountPendingPlatformArtwork()
            => LoadGames().Count(g => g.AutoAddedByBootstrap && g.IsPendingArtwork);

        private void ResumePendingPlatformArtworkIfNeeded()
        {
            int pending = CountPendingPlatformArtwork();
            if (pending <= 0) return;

            ShowPreparingGameSkeletons(Math.Clamp(pending, 1, 12));
            StartStoreArtworkRefresh();
        }

        private bool RefreshAutoAddSuppressions(AppCacheModel cache)
        {
            cache.AutoAddSuppressions ??= new List<AutoAddSuppression>();
            if (cache.AutoAddSuppressions.Count == 0) return false;

            var installedKeys = CollectCachedPlatformApps(cache)
                .SelectMany(AutoAddKeysForApp)
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            bool changed = false;
            for (int i = cache.AutoAddSuppressions.Count - 1; i >= 0; i--)
            {
                var suppression = cache.AutoAddSuppressions[i];
                string key = NormalizeAutoAddKey(suppression.Key);
                if (string.IsNullOrWhiteSpace(key))
                {
                    cache.AutoAddSuppressions.RemoveAt(i);
                    changed = true;
                    continue;
                }

                bool installed = installedKeys.Contains(key);
                if (!installed)
                {
                    if (!suppression.MissingSinceDeletion)
                    {
                        suppression.MissingSinceDeletion = true;
                        changed = true;
                    }
                    continue;
                }

                if (suppression.MissingSinceDeletion)
                {
                    cache.AutoAddSuppressions.RemoveAt(i);
                    changed = true;
                }
            }

            return changed;
        }

        private bool IsAutoAddSuppressed(InstalledApp app, AppCacheModel cache)
        {
            var appKeys = AutoAddKeysForApp(app).ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (appKeys.Count == 0) return false;
            return cache.AutoAddSuppressions?.Any(s =>
                !s.MissingSinceDeletion &&
                appKeys.Contains(NormalizeAutoAddKey(s.Key))) == true;
        }

        private void ClearAutoAddSuppressionForApp(InstalledApp app)
        {
            var cache = LoadAppCache() ?? new AppCacheModel();
            var appKeys = AutoAddKeysForApp(app).ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (appKeys.Count == 0 || cache.AutoAddSuppressions == null) return;

            int removed = cache.AutoAddSuppressions.RemoveAll(s =>
                appKeys.Contains(NormalizeAutoAddKey(s.Key)));
            if (removed > 0) SaveAppCache(cache);
        }

        private void SuppressAutoAddForDeletedGame(GameModel game)
        {
            string key = AutoAddKeyForGame(game);
            if (string.IsNullOrWhiteSpace(key)) return;

            var cache = LoadAppCache() ?? new AppCacheModel();
            var match = CollectCachedPlatformApps(cache)
                .FirstOrDefault(a => AutoAddKeysForApp(a).Contains(key, StringComparer.OrdinalIgnoreCase));
            if (match == null) return;

            cache.AutoAddSuppressions ??= new List<AutoAddSuppression>();
            if (!cache.AutoAddSuppressions.Any(s =>
                string.Equals(NormalizeAutoAddKey(s.Key), key, StringComparison.OrdinalIgnoreCase)))
            {
                cache.AutoAddSuppressions.Add(new AutoAddSuppression
                {
                    Key = key,
                    Source = match.Source,
                    Name = game.Name,
                    MissingSinceDeletion = false,
                    DeletedAt = DateTime.Now
                });
                SaveAppCache(cache);
            }
        }

        private Dictionary<string, string> BuildExistingAppsMap()
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            // Lê os Jogos
            foreach (var g in LoadGames())
            {
                string state = g.IsPendingArtwork ? "preparing-game" : "game";
                foreach (var key in AutoAddKeysForGame(g))
                    map[key] = state;
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
            List<InstalledApp> ubisoft,
            List<InstalledApp> ea,
            List<InstalledApp> battleNet,
            List<InstalledApp> amazon,
            List<InstalledApp> xbox,
            List<InstalledApp> windows,
            List<InstalledApp> folders,
            Dictionary<string, string> existingMap)
        {
            var all = new List<InstalledApp>();
            all.AddRange(steam);
            all.AddRange(epic);
            all.AddRange(gog);
            all.AddRange(riot);
            all.AddRange(ubisoft);
            all.AddRange(ea);
            all.AddRange(battleNet);
            all.AddRange(amazon);
            all.AddRange(xbox);
            all.AddRange(windows);
            all.AddRange(folders);

            foreach (var app in all)
            {
                var appKeys = AutoAddKeysForApp(app).ToList();

                // Reutiliza sua chave original IsAdded e alimenta o AddedTo
                if (appKeys.Select(k => existingMap.TryGetValue(k, out string addedToType) ? addedToType : null)
                    .FirstOrDefault(v => !string.IsNullOrEmpty(v)) is string addedToType)
                {
                    app.IsAdded = true;
                    app.AddedTo = addedToType;
                    app.AddState = addedToType == "preparing-game" ? "preparing" : "added";
                }
                else
                {
                    app.IsAdded = false;
                    app.AddedTo = "";
                    app.AddState = "";
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
                foreach (var key in AutoAddKeysForGame(g))
                    set.Add(key);
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
            List<InstalledApp> ubisoft,
            List<InstalledApp> ea,
            List<InstalledApp> battleNet,
            List<InstalledApp> amazon,
            List<InstalledApp> xbox,
            List<InstalledApp> windows,
            List<InstalledApp> folders,
            HashSet<string> existingGames)
        {
            var all = new List<InstalledApp>();
            all.AddRange(steam);
            all.AddRange(epic);
            all.AddRange(gog);
            all.AddRange(riot);
            all.AddRange(ubisoft);
            all.AddRange(ea);
            all.AddRange(battleNet);
            all.AddRange(amazon);
            all.AddRange(xbox);
            all.AddRange(windows);
            all.AddRange(folders);

            foreach (var app in all)
            {
                app.IsAdded = AutoAddKeysForApp(app).Any(existingGames.Contains);
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
            var lastUbisoft = GetUbisoftFingerprint();
            var lastEa = GetEaFingerprint();
            var lastBattleNet = GetBattleNetFingerprint();
            var lastAmazon = GetAmazonFingerprint();
            var lastXbox = GetXboxFingerprint();
            var lastWin = GetWindowsRegistryFingerprint();

            while (_pollingActive)
            {
                await Task.Delay(5_000); // checa a cada 5 segundos
                if (!_pollingActive) break;

                var curSteam = GetSteamFingerprint();
                var curEpic = GetEpicFingerprint();
                var curGog = GetGogFingerprint();
                var curRiot = GetRiotFingerprint();
                var curUbisoft = GetUbisoftFingerprint();
                var curEa = GetEaFingerprint();
                var curBattleNet = GetBattleNetFingerprint();
                var curAmazon = GetAmazonFingerprint();
                var curXbox = GetXboxFingerprint();
                var curWin = GetWindowsRegistryFingerprint();

                bool changed = !curSteam.SetEquals(lastSteam)
                            || !curEpic.SetEquals(lastEpic)
                            || !curGog.SetEquals(lastGog)
                            || !curRiot.SetEquals(lastRiot)
                            || !curUbisoft.SetEquals(lastUbisoft)
                            || !curEa.SetEquals(lastEa)
                            || !curBattleNet.SetEquals(lastBattleNet)
                            || !curAmazon.SetEquals(lastAmazon)
                            || !curXbox.SetEquals(lastXbox)
                            || !curWin.SetEquals(lastWin);

                if (changed)
                {
                    lastSteam = curSteam;
                    lastEpic = curEpic;
                    lastGog = curGog;
                    lastRiot = curRiot;
                    lastUbisoft = curUbisoft;
                    lastEa = curEa;
                    lastBattleNet = curBattleNet;
                    lastAmazon = curAmazon;
                    lastXbox = curXbox;
                    lastWin = curWin;

                    await UpdateAppCacheAsync();
                    var cache = LoadAppCache() ?? new AppCacheModel();
                    var existingMap = BuildExistingAppsMap();
                    var apps = BuildFinalList(
                        cache.SteamApps, cache.EpicApps, cache.GogApps, cache.RiotApps,
                        cache.UbisoftApps, cache.EaApps, cache.BattleNetApps, cache.AmazonApps, cache.XboxApps,
                        cache.WindowsApps, cache.FolderApps, existingMap);

                    Dispatcher.Invoke(() =>
                        webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new { type = "installedAppsUpdated", apps })));
                }
            }
        }

        // ========================= AUTO-ADD PLATAFORMAS =========================

        private LibraryBootstrapState LoadLibraryBootstrapState()
        {
            if (!File.Exists(libraryBootstrapFile)) return new LibraryBootstrapState();
            try
            {
                return JsonSerializer.Deserialize<LibraryBootstrapState>(File.ReadAllText(libraryBootstrapFile)) ?? new LibraryBootstrapState();
            }
            catch { return new LibraryBootstrapState(); }
        }

        private void SaveLibraryBootstrapState(LibraryBootstrapState state)
        {
            try
            {
                File.WriteAllText(libraryBootstrapFile, JsonSerializer.Serialize(state, new JsonSerializerOptions { WriteIndented = true }));
            }
            catch (Exception ex) { Debug.WriteLine("[Bootstrap] Falha ao salvar estado: " + ex.Message); }
        }

        private bool IsCurrentUserSystemOwner()
        {
            var firstUser = LoadUserProfiles()
                .Where(u => !string.IsNullOrWhiteSpace(u.Id))
                .OrderBy(u => u.DateCreated)
                .FirstOrDefault();
            return firstUser != null && string.Equals(firstUser.Id, currentUserId, StringComparison.OrdinalIgnoreCase);
        }

        private static string StableAssetName(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) value = Guid.NewGuid().ToString("N");
            return Convert.ToHexString(
                System.Security.Cryptography.MD5.HashData(
                    System.Text.Encoding.UTF8.GetBytes(value))).ToLowerInvariant()[..16];
        }

        private static string? ExtractSteamAppId(InstalledApp app)
        {
            if (!string.IsNullOrEmpty(app.LaunchUrl) && app.LaunchUrl.StartsWith("steam://run/", StringComparison.OrdinalIgnoreCase))
                return app.LaunchUrl.Replace("steam://run/", "").Trim();

            return app.Source.Equals("Steam", StringComparison.OrdinalIgnoreCase) && Regex.IsMatch(app.Path ?? "", @"^\d+$")
                ? app.Path
                : null;
        }

        private static (string Grid, string Horizontal, string Hero, string Logo) BuildSteamCdnAssets(string appId)
        {
            return (
                $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/library_600x900.jpg",
                $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/header.jpg",
                $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/library_hero.jpg",
                $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/logo.png"
            );
        }

        private async Task<bool> RemoteImageExistsAsync(string url)
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                using var request = new HttpRequestMessage(HttpMethod.Head, url);
                using var response = await httpClient.SendAsync(request, cts.Token).ConfigureAwait(false);
                return response.IsSuccessStatusCode;
            }
            catch { return false; }
        }

        private async Task<bool> SteamCdnHasRequiredArtworkAsync(string appId)
        {
            var assets = BuildSteamCdnAssets(appId);
            var gridTask = RemoteImageExistsAsync(assets.Grid);
            var heroTask = RemoteImageExistsAsync(assets.Hero);
            await Task.WhenAll(gridTask, heroTask).ConfigureAwait(false);
            return gridTask.Result && heroTask.Result;
        }

        private async Task WaitForGameSessionIdleAsync()
        {
            while (_gameSessionActive || _gameIsRunningAndDoorpiHidden)
                await Task.Delay(1500).ConfigureAwait(false);
        }

        private async Task<bool> UpdatePlatformCacheFastAsync()
        {
            List<GameModel> removedGames = new();
            await _cacheLock.WaitAsync();
            try
            {
                var cache = LoadAppCache() ?? new AppCacheModel();
                cache.SteamApps = GetSteamGames(includeIcons: false).Select(a => { a.Source = "Steam"; return a; }).ToList();
                cache.EpicApps = GetEpicGames(includeIcons: false).Select(a => { a.Source = "Epic"; return a; }).ToList();
                cache.GogApps = GetGOGGames(includeIcons: false).Select(a => { a.Source = "GOG"; return a; }).ToList();
                cache.RiotApps = GetRiotGames().Select(a => { a.Source = "Riot"; return a; }).ToList();
                cache.UbisoftApps = GetUbisoftGames(includeIcons: false).Select(a => { a.Source = "Ubisoft"; return a; }).ToList();
                cache.EaApps = GetEaGames(includeIcons: false).Select(a => { a.Source = "EA"; return a; }).ToList();
                cache.BattleNetApps = GetBattleNetGames(includeIcons: false).Select(a => { a.Source = "Battle.net"; return a; }).ToList();
                cache.AmazonApps = GetAmazonGames(includeIcons: false).Select(a => { a.Source = "Amazon"; return a; }).ToList();
                cache.XboxApps = GetXboxGames(includeIcons: false).Select(a => { a.Source = "Xbox"; return a; }).ToList();
                cache.SteamFingerprint = GetSteamFingerprint();
                cache.EpicFingerprint = GetEpicFingerprint();
                cache.GogFingerprint = GetGogFingerprint();
                cache.RiotFingerprint = GetRiotFingerprint();
                cache.UbisoftFingerprint = GetUbisoftFingerprint();
                cache.EaFingerprint = GetEaFingerprint();
                cache.BattleNetFingerprint = GetBattleNetFingerprint();
                cache.AmazonFingerprint = GetAmazonFingerprint();
                cache.XboxFingerprint = GetXboxFingerprint();
                cache.XboxFilterVersion = 2;
                RefreshAutoAddSuppressions(cache);
                SaveAppCache(cache);
                removedGames = ReconcileDoorpiGamesWithPlatformCache(cache);
            }
            finally
            {
                _cacheLock.Release();
            }

            PublishRemovedGamesToUI(removedGames);
            return removedGames.Count > 0;
        }

        private bool ShouldRefreshFullAppCacheOnIdle()
        {
            try
            {
                var cache = LoadAppCache();
                if (cache == null) return true;

                bool hasWatchedFolders = GetWatchedFolderPaths()
                    .Any(path => !string.IsNullOrWhiteSpace(path) && Directory.Exists(path));
                if (hasWatchedFolders &&
                    ((cache.FolderApps?.Count ?? 0) == 0 ||
                     (cache.FolderTimestamps?.Count ?? 0) == 0))
                {
                    return true;
                }

                var winPrint = GetWindowsRegistryFingerprint();
                if (!winPrint.SetEquals(cache.WindowsFingerprint) ||
                    (cache.WindowsApps?.Count ?? 0) == 0)
                {
                    return true;
                }
            }
            catch
            {
                return true;
            }

            return false;
        }

        private async Task<bool> UpsertAutoAddedPlatformGamesAsync(List<InstalledApp> platformGames)
        {
            var games = LoadGames();
            bool changed = false;

            foreach (var app in platformGames)
            {
                string key = !string.IsNullOrEmpty(app.LaunchUrl) ? app.LaunchUrl : app.Path;
                if (string.IsNullOrWhiteSpace(key)) continue;
                if (games.Any(g => InstalledAppMatchesGame(app, g)))
                    continue;

                string? steamAppId = ExtractSteamAppId(app);
                bool steamReady = !string.IsNullOrEmpty(steamAppId)
                                  && await SteamCdnHasRequiredArtworkAsync(steamAppId).ConfigureAwait(false);
                var steamAssets = steamReady ? BuildSteamCdnAssets(steamAppId!) : ("", "", "", "");

                games.Add(new GameModel
                {
                    Name = app.Name,
                    Path = app.Path,
                    LaunchUrl = app.LaunchUrl,
                    GridImage = steamAssets.Item1,
                    GridHorizontalImage = steamAssets.Item2,
                    HeroImage = steamAssets.Item3,
                    LogoImage = steamAssets.Item4,
                    LastPlayed = DateTime.MinValue,
                    DateAdded = DateTime.Now,
                    IsPendingArtwork = !steamReady,
                    AutoAddedByBootstrap = true,
                    ArtworkSource = steamReady ? "steam-cdn" : "pending"
                });
                changed = true;
            }

            if (changed) SaveGames(games);
            return changed;
        }

        private async Task CacheSteamCdnImagesForExistingGamesAsync()
        {
            var games = LoadGames();
            bool changed = false;

            foreach (var game in games.Where(g => g.AutoAddedByBootstrap && g.ArtworkSource == "steam-cdn" && !g.IsPendingArtwork).ToList())
            {
                await WaitForGameSessionIdleAsync().ConfigureAwait(false);

                if (!string.IsNullOrEmpty(game.GridImage) && game.GridImage.StartsWith("https://data.local/", StringComparison.OrdinalIgnoreCase))
                    continue;

                string? appId = !string.IsNullOrEmpty(game.LaunchUrl) && game.LaunchUrl.StartsWith("steam://run/", StringComparison.OrdinalIgnoreCase)
                    ? game.LaunchUrl.Replace("steam://run/", "").Trim()
                    : null;
                if (string.IsNullOrWhiteSpace(appId)) continue;

                var safeName = "steam_" + StableAssetName(appId);
                var assets = BuildSteamCdnAssets(appId);

                var gridTask = DownloadImageAsync(assets.Grid, gridFolder, safeName);
                var horizontalTask = DownloadImageAsync(assets.Horizontal, gridHorizontalFolder, safeName + "_h");
                var heroTask = DownloadImageAsync(assets.Hero, heroFolder, safeName);
                var logoTask = DownloadImageAsync(assets.Logo, logoFolder, safeName + "_logo");

                await Task.WhenAll(gridTask, horizontalTask, heroTask, logoTask).ConfigureAwait(false);

                if (gridTask.Result == null || heroTask.Result == null)
                {
                    game.GridImage = "";
                    game.GridHorizontalImage = "";
                    game.HeroImage = "";
                    game.LogoImage = "";
                    game.IsPendingArtwork = true;
                    game.ArtworkSource = "pending";
                    changed = true;
                    SaveGames(games);
                    continue;
                }

                game.GridImage = $"https://data.local/images/grid/{Path.GetFileName(gridTask.Result)}";
                if (horizontalTask.Result != null) game.GridHorizontalImage = $"https://data.local/images/grid-horizontal/{Path.GetFileName(horizontalTask.Result)}";
                game.HeroImage = $"https://data.local/images/hero/{Path.GetFileName(heroTask.Result)}";
                if (logoTask.Result != null) game.LogoImage = $"https://data.local/images/logo/{Path.GetFileName(logoTask.Result)}";
                game.ArtworkSource = "steam-cdn-local";
                changed = true;
                SaveGames(games);
                _ = Dispatcher.BeginInvoke(() => LoadGamesIntoUI());
            }

            if (changed) SaveGames(games);
        }

        private async Task EnrichPendingPlatformArtworkAsync()
        {
            var games = LoadGames();
            bool changed = false;

            foreach (var game in games.Where(g => g.AutoAddedByBootstrap && g.IsPendingArtwork).ToList())
            {
                try
                {
                    await WaitForGameSessionIdleAsync().ConfigureAwait(false);

                    var (gridUrl, horizontalUrl, heroUrl, logoUrl) = await FetchSteamGridAssetsAsync(game.Name).ConfigureAwait(false);
                    if (string.IsNullOrEmpty(gridUrl) || string.IsNullOrEmpty(heroUrl))
                    {
                        game.GridImage = "";
                        game.GridHorizontalImage = "";
                        game.HeroImage = "";
                        game.LogoImage = "";
                        game.IsPendingArtwork = false;
                        game.ArtworkSource = "no-art";
                        changed = true;
                        SaveGames(games);
                        _ = Dispatcher.BeginInvoke(() => LoadGamesIntoUI());
                        continue;
                    }

                    string safeName = "auto_" + StableAssetName(game.LaunchUrl + game.Path + game.Name);
                    var gridTask = DownloadImageAsync(gridUrl, gridFolder, safeName);
                    var hTask = !string.IsNullOrEmpty(horizontalUrl) ? DownloadImageAsync(horizontalUrl, gridHorizontalFolder, safeName + "_h") : Task.FromResult<string?>(null);
                    var heroTask = DownloadImageAsync(heroUrl, heroFolder, safeName);
                    var logoTask = !string.IsNullOrEmpty(logoUrl) ? DownloadImageAsync(logoUrl, logoFolder, safeName + "_logo") : Task.FromResult<string?>(null);

                    await Task.WhenAll(gridTask, hTask, heroTask, logoTask).ConfigureAwait(false);

                    if (gridTask.Result == null || heroTask.Result == null)
                    {
                        game.GridImage = "";
                        game.GridHorizontalImage = "";
                        game.HeroImage = "";
                        game.LogoImage = "";
                        game.IsPendingArtwork = false;
                        game.ArtworkSource = "no-art";
                        changed = true;
                        SaveGames(games);
                        _ = Dispatcher.BeginInvoke(() => LoadGamesIntoUI());
                        continue;
                    }

                    game.GridImage = $"https://data.local/images/grid/{Path.GetFileName(gridTask.Result)}";
                    game.GridHorizontalImage = hTask.Result != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(hTask.Result)}" : game.GridImage;
                    game.HeroImage = $"https://data.local/images/hero/{Path.GetFileName(heroTask.Result)}";
                    game.LogoImage = logoTask.Result != null ? $"https://data.local/images/logo/{Path.GetFileName(logoTask.Result)}" : "";
                    game.IsPendingArtwork = false;
                    game.ArtworkSource = "steamgrid-local";
                    changed = true;

                    SaveGames(games);
                    _ = Dispatcher.BeginInvoke(() => LoadGamesIntoUI());
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[Artwork] Falha ao enriquecer {game.Name}: {ex.Message}");
                }
            }

            if (changed) SaveGames(games);
        }

        private bool StartLibraryBootstrapIfNeeded()
        {
            if (!IsCurrentUserSystemOwner()) return false;

            var state = LoadLibraryBootstrapState();
            if (state.PlatformAutoAddCompleted) return false;

            if (Interlocked.CompareExchange(ref _libraryBootstrapRunning, 1, 0) != 0) return true;


            var existingCount = LoadGames().Count;
            if (existingCount == 0)
            {
                var cache = LoadAppCache();
                int estimate = Math.Clamp(
                    (cache?.SteamApps?.Count ?? 0) +
                    (cache?.EpicApps?.Count ?? 0) +
                    (cache?.GogApps?.Count ?? 0) +
                    (cache?.UbisoftApps?.Count ?? 0) +
                    (cache?.EaApps?.Count ?? 0) +
                    (cache?.BattleNetApps?.Count ?? 0) +
                    (cache?.AmazonApps?.Count ?? 0) +
                    (cache?.XboxApps?.Count ?? 0), 4, 12);

                Dispatcher.Invoke(() =>
                    webView.CoreWebView2.PostWebMessageAsString(
                        JsonSerializer.Serialize(new { type = "bootstrapStarted", count = estimate })));
            }

            _ = Task.Run(async () =>
            {
                try { await RunLibraryBootstrapAsync().ConfigureAwait(false); }
                catch (Exception ex) { Debug.WriteLine("[Bootstrap] Erro: " + ex.Message); }
                finally { Interlocked.Exchange(ref _libraryBootstrapRunning, 0); }
            });
            return true;
        }

        private async Task RunLibraryBootstrapAsync()
        {
            var state = LoadLibraryBootstrapState();
            state.LastRun = DateTime.Now;
            SaveLibraryBootstrapState(state);

            await UpdatePlatformCacheFastAsync().ConfigureAwait(false);

            var cache = LoadAppCache() ?? new AppCacheModel();
            var platformGames = cache.SteamApps
                .Concat(cache.EpicApps)
                .Concat(cache.GogApps)
                .Concat(cache.RiotApps)
                .Concat(cache.UbisoftApps)
                .Concat(cache.EaApps)
                .Concat(cache.BattleNetApps)
                .Concat(cache.AmazonApps)
                .Concat(cache.XboxApps)
                .Where(a => !string.IsNullOrWhiteSpace(a.Name))
                .Where(a => !a.Name.Contains("Steamworks", StringComparison.OrdinalIgnoreCase))
                .Where(a => !a.Name.Contains("Unreal Engine", StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (!state.PlatformAutoAddCompleted)
            {
                if (await UpsertAutoAddedPlatformGamesAsync(platformGames).ConfigureAwait(false))
                    _ = Dispatcher.BeginInvoke(() => LoadGamesIntoUI());

                state.PlatformAutoAddCompleted = true;
                state.CompletedAt = DateTime.Now;
                SaveLibraryBootstrapState(state);
                SendInstalledAppsToUI();
            }

            try
            {
                await UpdateAppCacheAsync().ConfigureAwait(false);
                SendInstalledAppsToUI();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Bootstrap] Cache completo: " + ex.Message);
            }

            await CacheSteamCdnImagesForExistingGamesAsync().ConfigureAwait(false);
            await EnrichPendingPlatformArtworkAsync().ConfigureAwait(false);
            SendInstalledAppsToUI();
        }

        private async Task AutoAddPlatformGamesAsync()
        {
            await RunLibraryBootstrapAsync().ConfigureAwait(false);
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
            if (!IsTrustedMainWebMessageSource(e.Source))
            {
                Debug.WriteLine("[WebView] Mensagem ignorada de origem não confiável: " + e.Source);
                return;
            }

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
                          
                            SendInstalledAppsToUI();

 
                            if ((DateTime.Now - _lastCacheBuilt).TotalSeconds > 60)
                            {
                                await UpdateAppCacheAsync().ConfigureAwait(false);
                                var cache = LoadAppCache() ?? new AppCacheModel();
                                var removedGames = ReconcileDoorpiGamesWithPlatformCache(cache);
                                PublishRemovedGamesToUI(removedGames);

                               
                                SendInstalledAppsToUI();
                            }
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine("[InstalledApps] Falha ao atualizar lista: " + ex.Message);
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
                    Dispatcher.Invoke(() =>
                    {
                        CleanupAndExit();
                        Application.Current.Shutdown();
                        Environment.Exit(0);
                    });
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
                else if (action == "openTaskbarSettings")
                {
                    try
                    {
                        // Abre as configurações da Barra de Tarefas
                        Process.Start(new ProcessStartInfo("ms-settings:taskbar") { UseShellExecute = true });

                        // Minimiza o Doorpi e assume o controle como Mouse/Teclado
                        Dispatcher.Invoke(EnterDesktopMode);

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
                                        IntPtr fgHwnd = GetForegroundWindow();
                                        if (fgHwnd != IntPtr.Zero) ShowWindow(fgHwnd, 3); // Maximiza a janela de Configurações

                                        // Move o mouse para uma área segura
                                        int safeX = (int)SystemParameters.PrimaryScreenWidth - 20;
                                        int safeY = (int)SystemParameters.PrimaryScreenHeight / 2;
                                        SetCursorPos(safeX, safeY);

                                        // Envia Clique Esquerdo para roubar foco UWP
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
                                    Dispatcher.Invoke(() =>
                                    {
                                        if (_systemControllerActive) ExitDesktopMode();
                                    });
                                    break;
                                }
                            }
                        });
                    }
                    catch (Exception ex) { Debug.WriteLine($"Erro ao abrir config de Barra de Tarefas: {ex.Message}"); }
                }
                else if (action == "openXboxGameBarSettings")
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo("ms-settings:gaming-gamebar") { UseShellExecute = true });
                        Dispatcher.Invoke(EnterDesktopMode);

                        _ = Task.Run(async () =>
                        {
                            for (int i = 0; i < 20; i++)
                            {
                                await Task.Delay(500);
                                if (Process.GetProcessesByName("SystemSettings").Length > 0)
                                {
                                    Dispatcher.Invoke(() =>
                                    {
                                        IntPtr fgHwnd = GetForegroundWindow();
                                        if (fgHwnd != IntPtr.Zero) ShowWindow(fgHwnd, 3);
                                        int safeX = (int)SystemParameters.PrimaryScreenWidth - 20;
                                        int safeY = (int)SystemParameters.PrimaryScreenHeight / 2;
                                        SetCursorPos(safeX, safeY);
                                        SendMouse(0, 0, 0x0002);
                                        SendMouse(0, 0, 0x0004);
                                    });
                                    break;
                                }
                            }

                            while (_systemControllerActive)
                            {
                                await Task.Delay(1000);
                                if (Process.GetProcessesByName("SystemSettings").Length == 0)
                                {
                                    Dispatcher.Invoke(() => { if (_systemControllerActive) ExitDesktopMode(); });
                                    break;
                                }
                            }
                        });
                    }
                    catch (Exception ex) { Debug.WriteLine($"Erro ao abrir Xbox Game Bar settings: {ex.Message}"); }
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
                else if (action == "cancelGameLaunch")
                {
                    _launchCancelled = true;
                    _lockedGameProcessName = "";  // ← NOVO
                    _gameIsMinimized = false;
                    _currentGameHwnd = IntPtr.Zero;

                    lock (_gameLaunchMonitorLock)
                    {
                        _gameLaunchMonitorCts?.Cancel();
                    }

                    _gameSessionActive = false;
                    _gameIsRunningAndDoorpiHidden = false;

                    try { _pendingLaunchProcess?.Kill(entireProcessTree: true); } catch { }
                    _pendingLaunchProcess = null;

                    SendGameLaunchStatus("gameLaunchDone");
                    Dispatcher.Invoke(ForceFocus);
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
                    string errMsg = GetStr(root, "errorMsg");

                    await Dispatcher.InvokeAsync(() =>
                    {
                        try
                        {
                            var dlg = new Microsoft.Win32.OpenFolderDialog { Title = dialogTitle, Multiselect = false };

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

                                var folders = LoadFoldersData();
                                if (!folders.Any(f => string.Equals(f.Path, selectedPath, StringComparison.OrdinalIgnoreCase)))
                                {
                                    var placeholder = new FolderStats { Path = selectedPath, EstimatedMs = -1 };
                                    folders.Add(placeholder);
                                    SaveFoldersData(folders);
                                    AddFolderWatcher(selectedPath);
                                }

                                SendFoldersToUI();
                                PostScanProgress(selectedPath, 0); // Texto atualiza na hora

                                // Escaneamento em Background
                                _ = Task.Run(async () =>
                                {
                                    try
                                    {
                                        await RecalculateFolderStatsAsync(selectedPath);
                                        await UpdateAppCacheAsync();
                                        SendInstalledAppsToUI();
                                    }
                                    catch (Exception ex) { Debug.WriteLine("[pickFolder] Erro: " + ex.Message); }
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
                    string errMsg = GetStr(root, "errorMsg");

                    await Dispatcher.InvokeAsync(() =>
                    {
                        try
                        {
                            var dlg = new Microsoft.Win32.OpenFolderDialog { Title = dialogTitle, Multiselect = false };

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

                                var folders = LoadFoldersData();
                                int idx = folders.FindIndex(f => string.Equals(f.Path, oldPath, StringComparison.OrdinalIgnoreCase));
                                var placeholder = new FolderStats { Path = newPath, EstimatedMs = -1 };

                                if (idx >= 0) folders[idx] = placeholder;
                                else folders.Add(placeholder);

                                SaveFoldersData(folders);

                                var dead = _folderWatchers.Where(w => string.Equals(w.Path, oldPath, StringComparison.OrdinalIgnoreCase)).ToList();
                                foreach (var w in dead) { w.EnableRaisingEvents = false; w.Dispose(); }
                                foreach (var w in dead) _folderWatchers.Remove(w);
                                AddFolderWatcher(newPath);

                                SendFoldersToUI();
                                PostScanProgress(newPath, 0); // Texto atualiza na hora

                                _ = Task.Run(async () =>
                                {
                                    try
                                    {
                                        await RecalculateFolderStatsAsync(newPath);
                                        await UpdateAppCacheAsync();
                                        SendInstalledAppsToUI();
                                    }
                                    catch (Exception ex) { Debug.WriteLine("[editFolder] Erro: " + ex.Message); }
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
                        SendFoldersToUI(); // Atualiza a tela instantaneamente

                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await UpdateAppCacheAsync();
                                SendInstalledAppsToUI();
                            }
                            catch (Exception ex) { Debug.WriteLine("[deleteFolder] Erro: " + ex.Message); }
                            finally
                            {
                              
                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                            }
                        });
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
                        WriteUserProfileFile(Path.Combine(userDir, "user.json"), profile);
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
                            string userToken = SafeBrowserProfileToken(userToRemove.Name);
                            string[] profilePrefixes =
                            {
                                $"{userToRemove.Id}-",
                                $"{userToRemove.Id}_",
                                $"{userToken}-",
                                $"{userToken}_",
                                $"{safeName}-",
                                $"{safeName}_"
                            };
                            string profilesDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "browser-profiles");
                            if (Directory.Exists(profilesDir))
                            {
                                foreach (var dir in Directory.GetDirectories(profilesDir))
                                {
                                    string dirName = Path.GetFileName(dir);
                                    if (profilePrefixes.Any(prefix => dirName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))
                                    {
                                        ForceDeleteDirectory(dir);
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
                else if (action == "openStore" && root.TryGetProperty("storeId", out var storeIdEl))
                {
                    string storeId = storeIdEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(storeId))
                        _ = Dispatcher.InvokeAsync(async () => await OpenStoreAsync(storeId));
                }
                else if (action == "closeStore")
                {
                    CloseStoreSessionCompletely();
                }
                else if (action == "resumeStore")
                {
                    if (!TryRestoreStoreChildGameSession())
                        ResumeStoreSession();
                }
                else if (action == "requestStoreAutoAddSettings")
                {
                    SendStoreAutoAddSettingsToUI();
                }
                else if (action == "setStoreGamepadControl"
                         && root.TryGetProperty("storeId", out var storeGamepadStoreIdEl)
                         && root.TryGetProperty("disabled", out var storeGamepadDisabledEl))
                {
                    string storeId = storeGamepadStoreIdEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(storeId))
                    {
                        SaveStoreGamepadControlSetting(storeId, storeGamepadDisabledEl.GetBoolean());
                    }
                }
                else if (action == "setStoreAutoAdd"
                         && root.TryGetProperty("store", out var storeKeyEl)
                         && root.TryGetProperty("enabled", out var storeEnabledEl))
                {
                    string storeKey = storeKeyEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(storeKey))
                    {
                        SaveStoreAutoAddSetting(storeKey, storeEnabledEl.GetBoolean());
                        SendStoreAutoAddSettingsToUI();
                    }
                }
                else if (action == "launchMediaApp" && root.TryGetProperty("url", out var mediaUrlEl))
                {
                    ResumeExecutionLockWatch();

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


                        SuspendMainUiGamepadForGameLaunch();

                        if (appType == "webview" || appType == "browser")
                        {
                            if (_mediaExeModeActive) _mediaExeModeActive = false;

                            string mediaName = media?.Name ?? "App";
                            string heroImg = media?.HeroImage ?? "";
                            string gridImg = media?.GridImage ?? "";

                            DiscordRpcManager.Instance.UpdateState("media", mediaUrl, mediaName);

                            SendGameLaunchStatus("gameLaunching", mediaName, heroImg, gridImg, "app");
                            Dispatcher.Invoke(() =>
                            {
                                EnsureCursorVisible();
                                _mainScreenMouseVisible = true;
                                CenterCursorOnScreen();
                            });
                            _ = Dispatcher.InvokeAsync(async () => await OpenWebViewInlineAsync(mediaUrl, mediaUrl.Contains("youtube.com"), mediaName, heroImg, gridImg));
                        }
                        else if (appType == "exe")
                        {
                            Dispatcher.Invoke(() =>
                            {
                                try
                                {
                                    ActivateExecutableAppSession(mediaUrl);

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
                                            _mediaExeModeActive = false;

                                            InitializeMediaExeMouseModeForSession(media);
                                            _mediaExeGamepadDisabled = !_mediaExeMouseModeRequested;

                                            // ── MÁGICA: Zera o temporizador de segurança para pular os 3 segundos de carregamento artificial ──
                                            _launchAnimationStartedUtc = DateTime.MinValue;

                                            // Restaura e foca
                                            if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
                                            ShowWindow(hwnd, 3);
                                            FocusExternalWindow(hwnd);

                                            // SEMPRE cancela e recria o watcher, pois o antigo deu return ao minimizar!
                                            _mediaExeWatcherCts?.Cancel();
                                            _mediaExeWatcherCts = new CancellationTokenSource();
                                            _mediaExeProcess = existingProc;
                                            _mediaExeCurrentUrl = mediaUrl;
                                            InitializeMediaExeProcessGroup(mediaUrl, existingProc);
                                            StartMediaExeWatcher(existingProc, mediaUrl, mediaName, _mediaExeWatcherCts.Token);
                                            int sessionId = NextExecutableAppSessionId();
                                            EnsureMediaExeShortcutThread(sessionId);

                                            // Liga o modo controle novamente
                                            if (_mediaExeMouseModeRequested)
                                                StartMediaExeMouseModeForSession(sessionId, centerCursor: true);

                                            return;
                                        }
                                    }

                                    // ── Lança um processo novo ────────────────────────────────────
                                    if (_mediaExeModeActive) _mediaExeModeActive = false;
                                    _mediaExeWatcherCts?.Cancel();

                                    Process? proc = null;
                                    HashSet<int>? baselineBeforeLaunch = null;
                                    if (File.Exists(mediaUrl))
                                    {
                                        baselineBeforeLaunch = SnapshotProcessIds();
                                        proc = Process.Start(new ProcessStartInfo
                                        {
                                            FileName = mediaUrl,
                                            UseShellExecute = true,
                                            WorkingDirectory = Path.GetDirectoryName(mediaUrl),
                                            WindowStyle = ProcessWindowStyle.Maximized
                                        });
                                    }
                                    else if (!string.IsNullOrWhiteSpace(mediaUrl))
                                    {
                                        EnsureLauncherRunning(mediaUrl);
                                        baselineBeforeLaunch = SnapshotProcessIds();
                                        proc = Process.Start(new ProcessStartInfo(mediaUrl) { UseShellExecute = true });
                                    }

                                    if (proc != null)
                                    {
                                        _mediaExeMouseModeRequested = ShouldStartMouseMode(media);
                                        _mediaExeMouseModeInitialized = true;
                                        _mediaExeGamepadDisabled = !_mediaExeMouseModeRequested;

                                        if (_mediaExeMouseModeRequested)
                                        {
                                            EnterMediaExeMode(proc, mediaUrl, mediaName, heroImg, gridImg, baselineBeforeLaunch);
                                        }
                                        else
                                        {
                                            SendGameLaunchStatus("gameLaunching", mediaName, heroImg, gridImg, "app");
                                            _mediaExeWatcherCts = new CancellationTokenSource();
                                            _mediaExeProcess = proc;
                                            _mediaExeCurrentUrl = mediaUrl;
                                            InitializeMediaExeProcessGroup(mediaUrl, proc, baselineBeforeLaunch);
                                            _mediaExeWatcherPaused = false;
                                            _doorpiSuspendedForMedia = false;
                                            int sessionId = NextExecutableAppSessionId();

                                            StartMediaExeWatcher(proc, mediaUrl, mediaName, _mediaExeWatcherCts.Token);
                                            EnsureMediaExeShortcutThread(sessionId);
                                        }
                                    }
                                }
                                catch (Exception ex) { Debug.WriteLine($"[launchMediaApp/exe] {ex.Message}"); }
                            });
                        }
                    }
                }

                else if (action == "closeRunningItem")
                {
                    string id = GetStr(root, "id");
                    string url = GetStr(root, "url");
                    string channel = GetStr(root, "channel");
                    string appType = GetStr(root, "appType");

                    await Dispatcher.InvokeAsync(() => CloseRunningItem(id, url, channel, appType));
                }
                else if (action == "restoreExecutionLock")
                {
                    await Dispatcher.InvokeAsync(RestoreExecutionLockSession);
                }
                else if (action == "closeExecutionLock")
                {
                    await Dispatcher.InvokeAsync(CloseExecutionLockSession);
                }
                else if (action == "requestExecutionLockFromRuntime")
                {
                    string kind = GetStr(root, "kind");
                    string channel = GetStr(root, "channel");
                    string id = GetStr(root, "id");
                    string url = GetStr(root, "url");
                    await Dispatcher.InvokeAsync(() => RequestExecutionLockFromRuntime(kind, channel, id, url));
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

        private static bool IsTrustedMainWebMessageSource(string source)
        {
            try
            {
                if (!Uri.TryCreate(source, UriKind.Absolute, out var uri))
                    return false;

                return string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
                       string.Equals(uri.Host, "app.local", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
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

        private static bool IsGogLaunchUrl(string? launchUrl)
            => !string.IsNullOrWhiteSpace(launchUrl) &&
               launchUrl.StartsWith("goggalaxy://", StringComparison.OrdinalIgnoreCase);

        private static bool TryStartLocalGamePath(GameModel game, out Process? launched)
        {
            launched = null;

            string path = (game.Path ?? "").Replace("\"", "").Trim();
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
                return false;

            var startInfo = new ProcessStartInfo
            {
                FileName = path,
                UseShellExecute = true
            };

            string? dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrWhiteSpace(dir) && Directory.Exists(dir))
                startInfo.WorkingDirectory = dir;

            launched = Process.Start(startInfo);
            return true;
        }

        private static bool TryStartShellAppsFolderLaunch(string launchUrl, out Process? launched)
        {
            launched = null;
            if (string.IsNullOrWhiteSpace(launchUrl)) return false;

            string raw = launchUrl.Trim();
            const string shellPrefix = "shell:AppsFolder\\";

            try
            {
                if (raw.StartsWith(shellPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    launched = Process.Start(new ProcessStartInfo(raw) { UseShellExecute = true });
                    return true;
                }

                int shellIndex = raw.IndexOf(shellPrefix, StringComparison.OrdinalIgnoreCase);
                if (shellIndex < 0) return false;

                string args = raw.Substring(shellIndex).Trim();
                string exePart = raw.Substring(0, shellIndex).Trim().Trim('"');
                if (string.IsNullOrWhiteSpace(exePart) ||
                    !exePart.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                {
                    exePart = "explorer.exe";
                }

                launched = Process.Start(new ProcessStartInfo
                {
                    FileName = exePart,
                    Arguments = args,
                    UseShellExecute = true
                });
                return true;
            }
            catch
            {
                launched = null;
                return false;
            }
        }

        private void LaunchGame(string? identifier, string errorMsg)
        {
            if (string.IsNullOrEmpty(identifier)) return;

            try
            {
                ResumeExecutionLockWatch();

                if (_mediaExeModeActive) _mediaExeModeActive = false;

                var games = LoadGames();
                var game = games.FirstOrDefault(g => g.Path == identifier || g.LaunchUrl == identifier);

                if (game != null)
                {
                    // ── Verifica estado atual da sessão ────────────────────────────────────
                    bool gameAlive = IsLockedGameProcessAlive();
                    bool isSameGame = (_gameSessionActive || gameAlive)
                        && string.Equals(_activeSessionGameId, identifier, StringComparison.OrdinalIgnoreCase);
                    bool differentGameRunning = (_gameSessionActive || gameAlive)
                        && !string.IsNullOrEmpty(_activeSessionGameId)
                        && !isSameGame;

                    // Trava: não permite lançar um segundo jogo simultaneamente
                    if (differentGameRunning)
                    {
                        SendGameLaunchStatus("gameLaunchDone");
                        webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "gameAlreadyRunning",
                            currentGameId = _activeSessionGameId
                        }));
                        return;
                    }

                    if (TryAdoptAlreadyRunningGame(game, identifier))
                    {
                        game.LastPlayed = DateTime.Now;
                        SaveGames(games);
                        LoadGamesIntoUI();
                        webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "updateFeaturedCard",
                            tab = "games",
                            id = identifier
                        }));
                        return;
                    }

                    SendGameLaunchStatus("gameLaunching", game.Name, game.HeroImage ?? "", game.GridImage ?? "");

                    game.LastPlayed = DateTime.Now;
                    SaveGames(games);
                    LoadGamesIntoUI();

                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "updateFeaturedCard",
                        tab = "games",
                        id = identifier
                    }));

                    // ── Restauração: mesmo jogo ainda está vivo ────────────────────────────
                    if (isSameGame)
                    {
                        Debug.WriteLine($"\n[RESTORE] Restaurando: {game.Name}");

                        _gameSessionActive = true;  // re-estabelece se foi perdida via ForceFocus
                        _gameIsMinimized = false;

                        _ = Task.Run(async () =>
                        {
                            // Aguarda o controle soltar os botões
                            int waitTimeout = 0;
                            while (waitTimeout < 150)
                            {
                                if (XInputGetStateSecret(0, out var state) == 0 && state.Gamepad.wButtons == 0) break;
                                await Task.Delay(10);
                                waitTimeout++;
                            }
                            await Task.Delay(300);

                            Dispatcher.Invoke(() =>
                            {
                                ReleaseAllStuckKeys();
                                EnsureCursorVisible();
                                _mainScreenMouseVisible = true;
                                CenterCursorOnScreen();

                                // Busca a janela: primeiro pelo handle salvo, depois pelo nome do processo
                                IntPtr hwndToRestore = _currentGameHwnd;
                                if (hwndToRestore != IntPtr.Zero && !IsWindowVisible(hwndToRestore) && !IsIconic(hwndToRestore))
                                    hwndToRestore = IntPtr.Zero; // handle inválido, limpa

                                // 1. Tenta pelo processo travado (jogo real já identificado)
                                if (hwndToRestore == IntPtr.Zero && !string.IsNullOrEmpty(_lockedGameProcessName))
                                {
                                    foreach (var p in Process.GetProcessesByName(_lockedGameProcessName))
                                    {
                                        try
                                        {
                                            var h = FindAnyWindowForProcess(p.Id); // ← sem exigência de título
                                            if (h == IntPtr.Zero) h = p.MainWindowHandle;
                                            if (h != IntPtr.Zero) { hwndToRestore = h; _currentGameHwnd = h; break; }
                                        }
                                        catch { }
                                    }
                                }

                                // 2. Fallback: processo do launcher original (estágio antes do jogo abrir)
                                if (hwndToRestore == IntPtr.Zero && IsPendingLaunchProcessAlive())
                                {
                                    try
                                    {
                                        var h = FindAnyWindowForProcess(_pendingLaunchProcess!.Id);
                                        if (h == IntPtr.Zero) h = _pendingLaunchProcess.MainWindowHandle;
                                        if (h != IntPtr.Zero) hwndToRestore = h;
                                    }
                                    catch { }
                                }

                                // 3. Fallback final: última janela visível antes de minimizar
                                if (hwndToRestore == IntPtr.Zero && IsLastVisibleWindowStillValid())
                                    hwndToRestore = _lastVisibleWindowBeforeMinimize;
                                // Os três cases do restore, dentro do Dispatcher.Invoke:

                                if (hwndToRestore != IntPtr.Zero && (IsWindowVisible(hwndToRestore) || IsIconic(hwndToRestore)))
                                {
                                    Debug.WriteLine($"[RESTORE] Janela encontrada: {hwndToRestore}");
                                    RestoreGameCleanly(hwndToRestore);
                                    DiscordRpcManager.Instance.UpdateState("game", game.Name);

                                    _gameIsMinimized = false;          // ← permite monitor continuar rastreando

                                    if (string.IsNullOrWhiteSpace(_lockedGameProcessName))
                                    {
                                        _gameIsRunningAndDoorpiHidden = false;
                                        SendGameLaunchStatus("gameLaunching", game.Name,
                                            game.HeroImage ?? "", game.GridImage ?? "", "restore");
                                    }
                                    else
                                    {
                                        _gameIsRunningAndDoorpiHidden = true;
                                        SendGameLaunchStatus("gameLaunchDone");
                                    }
                                }
                                else if (_lastVisibleWindowBeforeMinimize != IntPtr.Zero)
                                {
                                    IntPtr fb = _lastVisibleWindowBeforeMinimize;
                                    RestoreGameCleanly(fb);
                                    _gameIsMinimized = false;          // ← idem
                                    if (string.IsNullOrWhiteSpace(_lockedGameProcessName))
                                    {
                                        _gameIsRunningAndDoorpiHidden = false;
                                        SendGameLaunchStatus("gameLaunching", game.Name,
                                            game.HeroImage ?? "", game.GridImage ?? "", "restore");
                                    }
                                    else
                                    {
                                        _gameIsRunningAndDoorpiHidden = true;
                                        SendGameLaunchStatus("gameLaunchDone");
                                    }
                                }
                                else
                                {
                                    // Processo não encontrado — pode ter crashado.
                                    // Reseta o flag para o monitor detectar a morte e chamar ForceFocus.
                                    _gameIsMinimized = false;          // ← monitor retoma e detecta crash em ~1.2 s
                                    _gameIsRunningAndDoorpiHidden = false;
                                    SendGameLaunchStatus("gameLaunching", game.Name,
                                        game.HeroImage ?? "", game.GridImage ?? "", "restore");
                                }
                            });
                        });

                        return;
                    }
                    // ==============================================================

                    // 1. TRAVA A TELA DE "ABRINDO" IMEDIATAMENTE NA UI

                    // 2. AVISA O WATCHDOG PARA NÃO INTERFERIR ANTES MESMO DO JOGO ABRIR
                    bool bindToActiveStoreContext = IsGameOwnedByActiveStore(game);

                    _gameSessionActive = true;
                    _activeSessionGameId = identifier;
                    _gameSessionParentKind = bindToActiveStoreContext ? "store" : "doorpi";
                    _forceDoorpiReturnOnGameClose = !bindToActiveStoreContext;
                    _storeChildGameActive = bindToActiveStoreContext;
                    _storeChildGameStoreId = bindToActiveStoreContext ? (_activeStoreId ?? "") : "";
                    _storeChildGameId = bindToActiveStoreContext ? identifier : "";
                    if (bindToActiveStoreContext)
                        _storePausedByDoorpi = false;
                    SuspendMainUiGamepadForGameLaunch();

                    var processSnapshot = SnapshotProcessIds();
                    _launchCancelled = false;
                    _pendingLaunchProcess = null;
                    // 3. JOGA A TENTATIVA DE ABRIR O LAUNCHER PARA SEGUNDO PLANO
                    _ = Task.Run(() =>
                    {
                        try
                        {
                            Process? launched = null;
                            bool launchAttempted = false;

                            if (IsGogLaunchUrl(game.LaunchUrl))
                            {
                                launchAttempted = TryStartLocalGamePath(game, out launched);
                            }
                            else if (!string.IsNullOrWhiteSpace(game.LaunchUrl) &&
                                                         game.LaunchUrl.StartsWith("riot:", StringComparison.OrdinalIgnoreCase))
                            {
                                string cmd = game.LaunchUrl.Substring(5).Trim();
                                string exePath = "";
                                string args = "";

                                if (cmd.StartsWith("\""))
                                {
                                    int endQuote = cmd.IndexOf("\"", 1);
                                    if (endQuote > 0)
                                    {
                                        exePath = cmd.Substring(1, endQuote - 1);
                                        args = cmd.Substring(endQuote + 1).Trim();
                                    }
                                }
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
                            // Substituir este bloco no método LaunchGame (linha ~2745 no seu código)
                            else if (!string.IsNullOrWhiteSpace(game.LaunchUrl))
                            {
                                EnsureLauncherRunning(game.LaunchUrl);
                                launchAttempted = true;

                                // INTERCEPTA O JOGO DA STEAM PARA LANÇAR DE FORMA DIRETA E SILENCIOSA
                                if (game.LaunchUrl.StartsWith("steam://run/", StringComparison.OrdinalIgnoreCase))
                                {
                                    string steamExe = GetSteamExePath();
                                    string appId = game.LaunchUrl.Replace("steam://run/", "").Trim();

                                    if (!string.IsNullOrEmpty(steamExe) && File.Exists(steamExe))
                                    {
                                        // -applaunch abre o jogo direto. 
                                        // -silent garante que nenhuma janela extra da Steam (como de propaganda ou biblioteca) apareça.
                                        launched = Process.Start(new ProcessStartInfo
                                        {
                                            FileName = steamExe,
                                            Arguments = $"-applaunch {appId} -silent",
                                            UseShellExecute = true,
                                            WindowStyle = ProcessWindowStyle.Minimized
                                        });
                                    }
                                    else
                                    {
                                        // Fallback caso não ache o exe da steam
                                        launched = Process.Start(new ProcessStartInfo(game.LaunchUrl) { UseShellExecute = true });
                                    }
                                }
                                else
                                {
                                    if (TryStartShellAppsFolderLaunch(game.LaunchUrl, out var shellLaunched))
                                    {
                                        launched = shellLaunched;
                                    }
                                    else
                                    {
                                        // Outros launchers (Epic, Riot, etc) continuam iguais
                                        launched = Process.Start(new ProcessStartInfo(game.LaunchUrl) { UseShellExecute = true });
                                    }
                                }
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
                                _pendingLaunchProcess = launched;
                                _sessionStartUtc = DateTime.UtcNow;
                                StartGameLaunchMonitor(game, launched, processSnapshot);
                                Dispatcher.Invoke(() =>
                                {
                                    EnsureCursorVisible();
                                    _mainScreenMouseVisible = true;
                                    CenterCursorOnScreen();
                                });
                            }
                            else
                            {
                                Dispatcher.Invoke(() => ForceFocus());
                            }
                        }
                        catch (Exception ex)
                        {
                            Dispatcher.Invoke(() => {
                                System.Windows.MessageBox.Show(errorMsg + ex.Message);
                                ForceFocus();
                            });
                        }
                    });
                }
            }
            catch (Exception ex) { System.Windows.MessageBox.Show(errorMsg + ex.Message); ForceFocus(); }
        }
        private bool IsLockedGameProcessAlive()
        {
            if (string.IsNullOrEmpty(_lockedGameProcessName)) return false;
            try { return Process.GetProcessesByName(_lockedGameProcessName).Length > 0; }
            catch { return false; }
        }
        private bool IsPendingLaunchProcessAlive()
        {
            try { return _pendingLaunchProcess != null && !_pendingLaunchProcess.HasExited; }
            catch { return false; }
        }

        private bool IsLastVisibleWindowStillValid()
        {
            if (_lastVisibleWindowBeforeMinimize == IntPtr.Zero) return false;
            try
            {
                if (!IsWindowVisible(_lastVisibleWindowBeforeMinimize) && !IsIconic(_lastVisibleWindowBeforeMinimize))
                    return false;

                GetWindowThreadProcessId(_lastVisibleWindowBeforeMinimize, out uint pidRaw);
                if (pidRaw == 0) return false;

                if (!string.IsNullOrWhiteSpace(_lockedGameProcessName))
                {
                    using var process = Process.GetProcessById((int)pidRaw);
                    return string.Equals(SafeProcessName(process), _lockedGameProcessName, StringComparison.OrdinalIgnoreCase);
                }

                if (IsPendingLaunchProcessAlive() && _pendingLaunchProcess != null)
                    return _pendingLaunchProcess.Id == (int)pidRaw;

                return _currentGameHwnd != IntPtr.Zero && _lastVisibleWindowBeforeMinimize == _currentGameHwnd;
            }
            catch { return false; }
        }

        // Versão sem exigência de título (para jogos DirectX antigos)
        private IntPtr FindAnyWindowForProcess(int pid)
        {
            IntPtr withTitle = IntPtr.Zero;
            IntPtr withoutTitle = IntPtr.Zero;

            EnumWindows((hWnd, _) =>
            {
                GetWindowThreadProcessId(hWnd, out uint wpid);
                if ((int)wpid != pid || !IsWindowVisible(hWnd)) return true;

                if (GetWindowTextLength(hWnd) > 0)
                {
                    withTitle = hWnd;
                    return false; // janela com título tem prioridade
                }
                else if (withoutTitle == IntPtr.Zero && GetWindowRect(hWnd, out RECT r) && r.Width > 100 && r.Height > 100)
                {
                    withoutTitle = hWnd;
                }
                return true;
            }, IntPtr.Zero);

            return withTitle != IntPtr.Zero ? withTitle : withoutTitle;
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
                    exePath = GetSteamExePath(); // Usa o novo helper
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
                        string args = processName == "steam" ? "-silent" : ""; // Inicia a Steam silenciada

                        Process.Start(new ProcessStartInfo
                        {
                            FileName = exePath,
                            Arguments = args,
                            UseShellExecute = true,
                            WindowStyle = ProcessWindowStyle.Hidden, // Esconde a janela
                            CreateNoWindow = true
                        });

                        // Dá um tempinho um pouco maior pra Steam fazer o login silencioso antes do jogo tentar abrir
                        System.Threading.Thread.Sleep(processName == "steam" ? 4000 : 3000);
                    }
                }
            }
            catch (Exception ex) { Debug.WriteLine("Erro ao garantir launcher: " + ex.Message); }
        }

        // ========================= GAMES DB =========================


        private void SaveGames(List<GameModel> games)
        {
            lock (_gamesFileLock)
            {
                string json = JsonSerializer.Serialize(games, new JsonSerializerOptions { WriteIndented = true });
                SafeWriteAllText(gamesFile, json);
                SafeWriteAllText(Path.Combine(dataFolder, "games.json"), json);
            }
        }

        private List<GameModel> LoadGames()
        {
            lock (_gamesFileLock)
            {
                string fallbackFile = Path.Combine(dataFolder, "games.json");
                string fileToRead = File.Exists(gamesFile)
                    ? gamesFile
                    : (File.Exists(fallbackFile) ? fallbackFile : gamesFile);
                if (!File.Exists(fileToRead)) return new List<GameModel>();

                string json = SafeReadAllText(fileToRead);
                var games = JsonSerializer.Deserialize<List<GameModel>>(json) ?? new List<GameModel>();
                if (games.Count > 0 &&
                    !string.Equals(fileToRead, gamesFile, StringComparison.OrdinalIgnoreCase))
                {
                    try { SaveGames(games); } catch { }
                }
                return games;
            }
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
            var allGames = LoadGames()
                .Where(g => !g.IsPendingArtwork)
                .ToList();

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

        private string GetSteamExePath()
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
                string exePath = key?.GetValue("SteamExe") as string ?? "";

                if (!string.IsNullOrEmpty(exePath) && !exePath.Contains(@"\"))
                {
                    var installPath = key?.GetValue("SteamPath") as string;
                    if (!string.IsNullOrEmpty(installPath))
                        exePath = Path.Combine(installPath, "steam.exe");
                }

                // A Steam costuma gravar no registro usando barras invertidas padrão web (/)
                return exePath.Replace("/", "\\");
            }
            catch { return ""; }
        }

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

            if (hwnd == IntPtr.Zero) return false;

            var foreground = GetForegroundWindow();
            if (foreground == hwnd) return true;
            if (foreground != IntPtr.Zero && IsChild(hwnd, foreground)) return true;

            try
            {
                if (Dispatcher.Invoke(() => IsActive || IsKeyboardFocusWithin || webView.IsKeyboardFocusWithin))
                    return true;
            }
            catch { }

            try
            {
                if (foreground != IntPtr.Zero)
                {
                    GetWindowThreadProcessId(foreground, out var pidRaw);
                    if (pidRaw == Environment.ProcessId)
                        return true;
                }
            }
            catch { }

            return false;
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
            ushort prevButtons = 0;

            // Variáveis de controle para o Combo (L1 + R1 + Select)
            bool isHoldingMinimizeCombo = false;
            DateTime minimizeComboStartTime = DateTime.MinValue;

            while (_mainUiGamepadActive)
            {
                try
                {
                    bool foregroundOk = IsDoorpiMainWindowForeground() ||
                                            (DateTime.UtcNow.Ticks - Interlocked.Read(ref _focusRestoredAtTicks))
                                            < TimeSpan.FromSeconds(2).Ticks;

                    bool isLaunchingOrRunning = _executionLockActive
                        || (_gameSessionActive && !_gameIsMinimized)
                        || _mediaExeModeActive
                        || _launcherMouseActive
                        || _systemControllerActive
                        || IsMainUiGamepadSuspendedForGame();

                    if (_systemControllerActive || _dialogModeActive || _launcherMouseActive || !foregroundOk || isLaunchingOrRunning)
                    {
                        // QUANDO O JOGO ESTÁ RODANDO
                        if (_gameSessionActive && !_gameIsMinimized)
                        {
                            if (XInputGetStateSecret(0, out var snap) == 0)
                            {
                                ushort snapBtn = snap.Gamepad.wButtons;

                                // 1. Botão Xbox (Minimiza instantâneo)
                                if ((snapBtn & 0x0400) != 0 && (prevButtons & 0x0400) == 0)
                                {
                                    Dispatcher.Invoke(() => MinimizeCurrentGameAndRestoreDoorpi());
                                }

                                // 2. Combo: L1 (0x0100) + R1 (0x0200) + Select (0x0020) = 0x0320
                                if ((snapBtn & 0x0320) == 0x0320)
                                {
                                    if (!isHoldingMinimizeCombo)
                                    {
                                        isHoldingMinimizeCombo = true;
                                        minimizeComboStartTime = DateTime.UtcNow;
                                    }
                                    // Se segurou por 1 segundo (1000ms)
                                    else if ((DateTime.UtcNow - minimizeComboStartTime).TotalMilliseconds >= 1000)
                                    {
                                        isHoldingMinimizeCombo = false; // Reseta para não disparar múltiplas vezes
                                        Dispatcher.Invoke(() => MinimizeCurrentGameAndRestoreDoorpi());
                                    }
                                }
                                else
                                {
                                    isHoldingMinimizeCombo = false; // Soltou algum botão, cancela a contagem
                                }

                                prevButtons = snapBtn;
                            }
                        }
                        else
                        {
                            moveState = 0; currentDir = null;
                            if (XInputGetStateSecret(0, out var snap) == 0)
                                prevButtons = snap.Gamepad.wButtons;
                        }

                        Thread.Sleep(50);
                        continue;
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

                    // Abre o seletor apenas com o botão Select
                    if (DateTime.UtcNow.Ticks > Interlocked.Read(ref _returnFromExternalModeSuppressUntil))
                    {
                        if (BtnPressed(0x0020))
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

                    prevButtons = btn;
                }
                catch (Exception ex) { Debug.WriteLine($"[MainUiGamepad] {ex.Message}"); }
                Thread.Sleep(10);
            }
        }
        private void CenterCursorOnScreen()
        {
            int centerX = (int)(System.Windows.SystemParameters.PrimaryScreenWidth / 2);
            int centerY = (int)(System.Windows.SystemParameters.PrimaryScreenHeight / 2);
            SetCursorPos(centerX, centerY);
        }
        private void CleanupAndExit()
        {
            DiscordRpcManager.Instance.Dispose();
            // 1. Força o fechamento de todas as janelas secundárias
            try { _webAppWindow?.Close(); } catch { }
            try { _popupWindow?.Close(); } catch { }
            try { _desktopVkb?.Close(); } catch { }

            // 2. Destrói as instâncias do WebView2 (Mata os processos filhos no Windows)
            try { _ytWebView?.Dispose(); } catch { }
            try { _popupWebView?.Dispose(); } catch { }
            try { webView?.Dispose(); } catch { }

            // 3. Cancela as threads de monitoramento ativas
            try { _mediaExeWatcherCts?.Cancel(); } catch { }
            try { lock (_gameLaunchMonitorLock) { _gameLaunchMonitorCts?.Cancel(); } } catch { }

            // 4. Limpa recursos de hardware (seu código original)
            StopMainScreenMouseWatch();
            ReleaseAllStuckKeys();
            timeEndPeriod(1);

            // (Opcional) Se quiser garantir que processos executáveis de mídia morram junto:
            // try { if (_mediaExeProcess != null && !_mediaExeProcess.HasExited) _mediaExeProcess.Kill(true); } catch { }
        }
        private int GetSourcePriority(string source) => source switch
        {
            "Steam" => 1,
            "Epic" => 1,
            "GOG" => 1,
            "Riot" => 1,
            "Ubisoft" => 1,
            "EA" => 1,
            "Battle.net" => 1,
            "Amazon" => 1,
            "Xbox" => 1,
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
