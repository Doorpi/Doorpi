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
using System.Windows.Controls;
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
        public string LaunchCommand { get; set; } = "";
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
        public string AssetQuery { get; set; } = "";
        public string IconBase64 { get; set; } = "";
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
        public bool IsAdminLocked { get; set; } = false;
        public string AdminLockReason { get; set; } = "";
        public string EmulatorId { get; set; } = "";
        public string RomPath { get; set; } = "";
        public List<string> EmulatorDiscPaths { get; set; } = new();
        public string LaunchCommand { get; set; } = "";
        public string EmulatorDetectedName { get; set; } = "";
    }

    public class SteamGridArtworkResult
    {
        // A URL original é a que será salva ao escolher a arte. Thumb é somente
        // para o seletor: no caso de animações, o SteamGridDB entrega WebM menor.
        public string Url { get; set; } = "";
        public string Thumb { get; set; } = "";
        public bool IsAnimated { get; set; }
    }

    public class UserProfile
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string PhotoBase64 { get; set; } = "";
        public string PhotoSource { get; set; } = "";
        public string PhotoSourceUrl { get; set; } = "";
        public int PhotoSteamGridAssetId { get; set; }
        public double PhotoCropX { get; set; }
        public double PhotoCropY { get; set; }
        public double PhotoZoom { get; set; } = 1;
        public string SteamGridApiKey { get; set; } = "";
        public string PinCode { get; set; } = "";
        public bool IsAdmin { get; set; } = false;
        public List<string> AdminBlockedStoreIds { get; set; } = new();
        public bool SteamForceAccountSelection { get; set; } = false;
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
        public HashSet<string> XboxFingerprint { get; set; } = new();
#if false
        // Fora do beta: Microsoft Store serÃ¡ retomada depois com fluxo dedicado.
        public HashSet<string> MicrosoftStoreFingerprint { get; set; } = new();
#endif
        public int XboxFilterVersion { get; set; }
        public List<AutoAddSuppression> AutoAddSuppressions { get; set; } = new();
        public List<InstalledApp> WindowsApps { get; set; } = new();
        public List<InstalledApp> FolderApps { get; set; } = new();
        public List<InstalledApp> SteamApps { get; set; } = new();
        public List<InstalledApp> EpicApps { get; set; } = new();
        public List<InstalledApp> GogApps { get; set; } = new();
        public List<InstalledApp> RiotApps { get; set; } = new();
        public List<InstalledApp> XboxApps { get; set; } = new();
#if false
        // Fora do beta: Microsoft Store serÃ¡ retomada depois com fluxo dedicado.
        public List<InstalledApp> MicrosoftStoreApps { get; set; } = new();
#endif
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
        private static readonly JsonSerializerOptions IndentedJsonOptions = new()
        {
            WriteIndented = true
        };

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
        private readonly object _gameHistoryFileLock = new();
        private readonly object _artworkReplacementLock = new();
        private readonly Dictionary<string, HashSet<string>> _pendingArtworkCleanup =
            new(StringComparer.OrdinalIgnoreCase);
        private string gameHistoryFile = "";

        private string _currentToastTitle = "";
        private bool _useNativeBootIntro = false;
        private BootIntroWindow? _nativeBootIntroWindow;
        private int _nativeBootIntroVisualComplete = 0;
        private int _nativeBootIntroHandoffComplete = 0;
        private int _nativeBootIntroPreparingShown = 0;
        private int _homeNavigationCompleted = 0;
        private int _homeWebViewHealthy = 0;
        private int _initialUserGateReleased = 0;
        private readonly DateTime _processStartedUtc = DateTime.UtcNow;
        private int _homeWebViewHealthGeneration = 0;
        private int _homeWebViewSelfRestartStarted = 0;
        private string _currentToastSub = "";

        private string _vkbStrBackspace = "Apagar";
        private string _vkbStrEnter = "Enter";
        private string _vkbStrClose = "Fechar";
        private string _vkbStrShift = "MaiÃºsc";
        private string _vkbStrSpace = "EspaÃ§o";
        private string _vkbStrSym = "&123";
        private string _vkbStrAbc = "ABC";

        private string _extBtnTitle = "Adicionar extensÃ£o ao Doorpi";
        private string _extBtnSub = "Instalar via Doorpi Browser";
        private string _extToastTitle = "Doorpi";
        private string _extToastSub = "ExtensÃ£o enviada ao Doorpi!";
        private string _extInstalledTitle = "JÃ¡ instalada no Doorpi";
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
        private string displaySettingsFile;

        private readonly List<FileSystemWatcher> _folderWatchers = new();
        private volatile bool _windowsCacheInvalid = false;
        private volatile bool _pollingActive = false;
        private int _libraryBootstrapRunning = 0;
        private int _userSwitchInProgress = 0;
        private bool _interactiveUserSessionStarted = false;
        private IntPtr _lastExternalForegroundAttachmentHwnd = IntPtr.Zero;
        private volatile bool _gameLaunchStoreMouseModeActive = false;
        private int _gameLaunchStoreMouseModeSessionId = 0;
        private string _gameLaunchStoreMouseModeStoreId = "";
        private IntPtr _gameLaunchStoreMouseModeHwnd = IntPtr.Zero;
        private int _gameLaunchStoreMouseModeProcessId = 0;
        private Thread? _gameLaunchStoreMouseModeThread;

        private readonly SemaphoreSlim _cacheLock = new SemaphoreSlim(1, 1);
        private DateTime _lastCacheBuilt = DateTime.MinValue;
        private string _lastPlatformIconHydrationCacheFile = "";
        private readonly object _watchedFolderRefreshScheduleLock = new();
        private CancellationTokenSource? _watchedFolderRefreshScheduleCts;
        private bool _watchedFolderRefreshRunning;
        private bool _watchedFolderRefreshPendingAfterRun;
        private string _watchedFolderRefreshPendingReason = "";
        private int _watchedFolderRefreshPendingDelayMs = 1400;
        private DateTime _lastWatchedFolderRefreshCompletedUtc = DateTime.MinValue;

        private bool _mainScreenMouseVisible = false;
        private POINT _lastKnownCursorPos;
        private System.Threading.Timer? _mouseIdleTimer;
        private System.Threading.Timer? _mousePollTimer;
        private const int MOUSE_IDLE_MS = 3000;
        private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);

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

        [DllImport("user32.dll")]
        private static extern bool IsZoomed(IntPtr hWnd);

        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left, Top, Right, Bottom;
            public int Width => Right - Left;
            public int Height => Bottom - Top;
        }
        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("dwmapi.dll")]
        private static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

        private const int GWL_STYLE = -16;
        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_TOOLWINDOW = 0x00000080;
        private const int WS_THICKFRAME = 0x00040000;
        private const int WS_MAXIMIZEBOX = 0x00010000;
        private const int DWMWA_CLOAKED = 14;
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

        private static uint GetWindowProcessId(IntPtr hWnd, out uint processId) =>
            GetWindowThreadProcessId(hWnd, out processId);

        [DllImport("user32.dll")]
        private static extern bool IsWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool IsHungAppWindow(IntPtr hWnd);

        // Windows already waits before flagging a window as unresponsive. Keep a
        // second grace period so slow games and installers are never terminated on a brief stall.
        private static readonly TimeSpan HUNG_WINDOW_RECOVERY_GRACE = TimeSpan.FromSeconds(7);

        private static bool IsWindowMarkedNotResponding(IntPtr hwnd)
        {
            try
            {
                return hwnd != IntPtr.Zero && IsWindow(hwnd) && IsHungAppWindow(hwnd);
            }
            catch
            {
                return false;
            }
        }

        // ========================= DETECÃ‡ÃƒO DO CURSOR (I-BEAM) =========================
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

        private const int IDC_IBEAM = 32513; // CÃ³digo oficial da "barrinha de texto" no Windows
        private const int CURSOR_SHOWING = 0x00000001;

        // ========================= TECLADO TOUCH (COM INTEROP) =========================

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr FindWindow(string? lpClassName, string? lpWindowName);
        [DllImport("user32.dll")] private static extern bool GetCursorPos(out POINT lpPoint);

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT { public int X; public int Y; }

        // ========================= WIN32 SENDINPUT (NOVO MOUSE/TECLADO) =========================
        [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
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
        private const ushort VK_MENU = 0x12;
        private const ushort VK_TAB = 0x09;
        private const uint MOUSEEVENTF_LEFTUP_SHARED = 0x0004;
        private const uint MOUSEEVENTF_RIGHTUP_SHARED = 0x0010;
        private const uint MOUSEEVENTF_XUP_SHARED = 0x0100;




        // ========================= CONSTRUTOR =========================
        private void ResetCursorForMainScreen()
        {
            // Nunca sequestre o mouse se a janela do Doorpi nÃ£o estiver realmente ativa
            if (!IsDoorpiMainWindowForeground()) return;

            EnsureCursorVisible();  // Normaliza o contador do Windows
            EnsureCursorHidden();   // Oculta o cursor visualmente
            _mainScreenMouseVisible = false;
            _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
            SetCursorPos(0, 0);     // Estaciona no topo
        }
        public MainWindow()
        {
            _useNativeBootIntro = ShouldUseNativeBootIntro();
            StartNativeBootIntroIfNeeded();
            DoorpiBootDiagnostics.Log("mainwindow-constructor-start");
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
                DoorpiBootDiagnostics.Log("mainwindow-source-initialized", $"hwnd=0x{_mainWindowHandle.ToInt64():X}");
                InitializeSmtc();
            };
            this.Activated += (s, e) =>
            {
                ResumeGameplayBackgroundMode();
                if (DateTime.UtcNow.Ticks < Interlocked.Read(ref _returnFromExternalModeSuppressUntil))
                    return;

                // O Alt+Tab aberto pelo controle decide a transição depois que o
                // Windows confirma a janela escolhida. Não reconstrua "Em execução"
                // no intervalo entre a ativação do Doorpi e essa confirmação.
                if (Volatile.Read(ref _nativeTaskSwitcherActive) == 1 ||
                    DateTime.UtcNow.Ticks <
                    Interlocked.Read(ref _nativeTaskSwitcherActivationSuppressUntilUtcTicks))
                {
                    return;
                }

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

                if (TryStartPendingInstalledStoreAutoOpen())
                    return;

                if (IsGpuUpdaterSessionActive())
                {
                    webView?.Focus();
                    Keyboard.Focus(webView);
                    webView?.CoreWebView2?.PostWebMessageAsString(
                        "{\"type\":\"gpuUpdaterDoorpiActivated\"}");
                    ShowGpuUpdaterExecutionLock(focusActions: true);
                    SendRuntimeSessionsToUI();
                    return;
                }

                if (IsStoreInstallFlowActive())
                {
                    ShowExecutionLockForStoreInstall();
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

                if (!_executionLockActive && WasWebAppRecentlyDeactivatedToDoorpi())
                {
                    ShowExecutionLockForWebApp();
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
                    if (IsActiveXboxStoreSession())
                    {
                        FocusDoorpiForXboxStoreReturn(hasBlockingSession, shouldMuteDoorpiAudio);
                        ShowExecutionLockForStore();
                        SendRuntimeSessionsToUI();
                        return;
                    }

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

                if (!_executionLockActive && HasActiveWebAppWindow())
                {
                    ShowExecutionLockForWebApp();
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

            dataFolder = DoorpiPaths.DataFolder;
            MigrateLegacyDataFolderIfNeeded();
            gridFolder = Path.Combine(dataFolder, "images", "grid");
            heroFolder = Path.Combine(dataFolder, "images", "hero");
            gridHorizontalFolder = Path.Combine(dataFolder, "images", "grid-horizontal");
            logoFolder = Path.Combine(dataFolder, "images", "logo");
            iconCacheFolder = Path.Combine(dataFolder, "iconcache");

            profilesFile = Path.Combine(dataFolder, "users.json");
            currentUserFile = Path.Combine(dataFolder, "current-user.json");
            userFile = Path.Combine(dataFolder, "user.json");
            gamesFile = Path.Combine(dataFolder, "games.json");
            gameHistoryFile = Path.Combine(dataFolder, "game-history.json");
            foldersFile = Path.Combine(dataFolder, "folders.json");
            appCacheFile = Path.Combine(dataFolder, "appcache.json");
            mediaFile = Path.Combine(dataFolder, "media.json");
            libraryBootstrapFile = Path.Combine(dataFolder, "library-bootstrap.json");
            displaySettingsFile = Path.Combine(dataFolder, "display-settings.json");

            Directory.CreateDirectory(Path.Combine(dataFolder, "extensions"));
            Directory.CreateDirectory(Path.Combine(dataFolder, "intros"));
            Directory.CreateDirectory(Path.Combine(dataFolder, "users"));
            Directory.CreateDirectory(dataFolder);
            try { InitializeWebViewProfileStorage(); }
            catch (Exception ex) { Debug.WriteLine("[WebViewProfiles] Inicialização adiada após falha: " + ex.Message); }
            Directory.CreateDirectory(gridFolder);
            Directory.CreateDirectory(heroFolder);
            Directory.CreateDirectory(gridHorizontalFolder);
            Directory.CreateDirectory(logoFolder);
            Directory.CreateDirectory(iconCacheFolder);

            InitializeUserStorage();

            DoorpiBootDiagnostics.Log("mainwindow-constructor-ready", $"bootMode={GetBootMode()} locked={DoorpiBootDiagnostics.IsWorkstationLocked()}");
            StartDoorpiRuntimeWhenSessionUnlocked();
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
        private bool ShouldUseNativeBootIntro()
        {
            return RequiresConsoleShellStartupGate();
        }

        private static bool WasStartedByShellBootstrap()
            => Environment.GetCommandLineArgs().Any(arg =>
                string.Equals(arg, "--doorpi-main", StringComparison.OrdinalIgnoreCase));

        private bool RequiresConsoleShellStartupGate()
            => GetBootMode() == 2 && !WasStartedByShellBootstrap();

        private void StartNativeBootIntroIfNeeded()
        {
            if (!_useNativeBootIntro)
                return;

            try
            {
                _nativeBootIntroWindow = BootIntroWindow.CreateOnDedicatedThread();
                _ = RunNativeBootIntroAsync();
            }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("native-intro-start-error", ex.Message);
                _useNativeBootIntro = false;
            }
        }

        private async Task RunNativeBootIntroAsync()
        {
            try
            {
                if (_nativeBootIntroWindow == null)
                    return;

                await _nativeBootIntroWindow.RunIntroAsync();
            }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("native-intro-run-error", ex.Message);
            }
            finally
            {
                Interlocked.Exchange(ref _nativeBootIntroVisualComplete, 1);
                TryCompleteNativeBootIntroHandoff();
            }
        }

        private void TryCompleteNativeBootIntroHandoff()
        {
            if (!_useNativeBootIntro)
                return;

            if (Volatile.Read(ref _nativeBootIntroHandoffComplete) == 1)
                return;

            if (Volatile.Read(ref _nativeBootIntroVisualComplete) == 0)
                return;

            bool homeReady = Volatile.Read(ref _homeNavigationCompleted) == 1;
            bool webViewReady = Volatile.Read(ref _homeWebViewHealthy) == 1;
            bool shellReady = !RequiresConsoleShellStartupGate() || Volatile.Read(ref _consoleShellExplorerReady) == 1;

            if (!homeReady || !webViewReady || !shellReady)
            {
                if (Interlocked.Exchange(ref _nativeBootIntroPreparingShown, 1) == 0)
                {
                    Dispatcher.InvokeAsync(() => _nativeBootIntroWindow?.ShowPreparingSystem());
                }
                DoorpiBootDiagnostics.Log("native-intro-waiting", $"homeReady={homeReady} webViewReady={webViewReady} shellReady={shellReady}");
                return;
            }

            if (Interlocked.Exchange(ref _nativeBootIntroHandoffComplete, 1) == 1)
                return;

            _ = Dispatcher.InvokeAsync(async () =>
            {
                DoorpiBootDiagnostics.Log("native-intro-handoff-complete");
                try
                {
                    if (_nativeBootIntroWindow != null)
                    {
                        await _nativeBootIntroWindow.PlayReleaseAsync();
                        await _nativeBootIntroWindow.FadeOutAndCloseAsync();
                        _nativeBootIntroWindow = null;
                    }
                }
                catch (Exception ex)
                {
                    DoorpiBootDiagnostics.Log("native-intro-close-error", ex.Message);
                }

                FocusDoorpiMainWebView(onlyIfFocusLost: false);
            });
        }

        private void TryReleaseInitialUserGate(string reason)
        {
            if (!Dispatcher.CheckAccess())
            {
                Dispatcher.InvokeAsync(() => TryReleaseInitialUserGate(reason));
                return;
            }

            bool homeReady = Volatile.Read(ref _homeNavigationCompleted) == 1;
            bool webViewReady = Volatile.Read(ref _homeWebViewHealthy) == 1;
            bool shellReady = !RequiresConsoleShellStartupGate() || Volatile.Read(ref _consoleShellExplorerReady) == 1;

            if (!homeReady || !webViewReady || !shellReady)
            {
                DoorpiBootDiagnostics.Log("initial-user-gate-waiting", $"reason={reason} homeReady={homeReady} webViewReady={webViewReady} shellReady={shellReady}");
                return;
            }

            if (Interlocked.Exchange(ref _initialUserGateReleased, 1) == 1)
                return;

            DoorpiBootDiagnostics.Log("initial-user-gate-release", reason);
            if (NeedsSetup())
            {
                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"showSetup\"}");
            }
            else
            {
                // O ultimo perfil salvo serve apenas para localizar arquivos neste
                // ponto; ainda nao existe uma sessao interativa escolhida.
                ClearHomeUi();
                SendUsersToUI(requireSelection: true);
            }
        }

        private void RequestNativeBootIntroSkip()
        {
            if (!_useNativeBootIntro)
                return;

            DoorpiBootDiagnostics.Log("native-intro-skip");
            _nativeBootIntroWindow?.RequestSkip();
            Interlocked.Exchange(ref _nativeBootIntroVisualComplete, 1);
            TryCompleteNativeBootIntroHandoff();
        }

        private void NotifyNativeBootIntroCompleteToWeb()
        {
            const string message = "{\"type\":\"nativeBootIntroComplete\"}";
            try { webView?.CoreWebView2?.PostWebMessageAsString(message); } catch { }
            try
            {
                webView?.CoreWebView2?.ExecuteScriptAsync(
                    "window.__doorpiNativeIntroComplete=true; window.postMessage({type:'nativeBootIntroComplete'}, '*');");
            }
            catch { }
        }

        private void SendDoorpiNotification(string category, string name = "", string title = "", string message = "", bool persistent = false)
        {
            try
            {
                Dispatcher.BeginInvoke(() =>
                {
                    try
                    {
                        webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "doorpiNotification",
                            category,
                            name,
                            title,
                            message,
                            persistent
                        }));
                    }
                    catch { }
                });
            }
            catch { }
        }

        private double LoadLayoutScale()
        {
            try
            {
                if (!File.Exists(displaySettingsFile)) return 1.0;
                using var doc = JsonDocument.Parse(File.ReadAllText(displaySettingsFile));
                if (doc.RootElement.TryGetProperty("layoutScale", out var scaleEl) &&
                    scaleEl.TryGetDouble(out var scale))
                {
                    return Math.Clamp(scale, 0.25, 1.80);
                }
            }
            catch { }
            return 1.0;
        }

        private void SaveLayoutScale(double scale)
        {
            try
            {
                Directory.CreateDirectory(dataFolder);
                var safe = Math.Clamp(scale, 0.25, 1.80);
                File.WriteAllText(displaySettingsFile, JsonSerializer.Serialize(new
                {
                    layoutScale = safe
                }, IndentedJsonOptions));
                ApplyLayoutScaleToWebView(safe);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DisplaySettings] Falha ao salvar: " + ex.Message);
            }
        }

        private void ApplyLayoutScaleToWebView(double scale)
        {
            try
            {
                var safe = Math.Clamp(scale, 0.25, 1.80);
                if (Dispatcher.CheckAccess())
                {
                    webView.ZoomFactor = safe;
                }
                else
                {
                    Dispatcher.Invoke(() => webView.ZoomFactor = safe);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DisplaySettings] Falha ao aplicar zoom: " + ex.Message);
            }
        }

        private void SendDisplaySettingsToUI()
        {
            try
            {
                webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "displaySettings",
                    layoutScale = LoadLayoutScale(),
                    systemDpiScale = VisualTreeHelper.GetDpi(this).DpiScaleX
                }));
            }
            catch { }
        }

        private void NotifySteamGridArtworkFallback(string appName, bool foundArtworkUrl, bool downloadedMainArtwork)
        {
            if (!foundArtworkUrl)
            {
                SendDoorpiNotification("steamgrid-art-not-found", appName);
                return;
            }

            if (!downloadedMainArtwork)
                SendDoorpiNotification("steamgrid-download-failed", appName);
        }

        private void StartDoorpiRuntimeWhenSessionUnlocked()
        {
            if (!DoorpiBootDiagnostics.IsWorkstationLocked())
            {
                StartDoorpiRuntimeOnce("session-unlocked");
                return;
            }

            DoorpiBootDiagnostics.Log("initialize-delayed-session-locked");
            _ = Task.Run(async () =>
            {
                while (DoorpiBootDiagnostics.IsWorkstationLocked())
                    await Task.Delay(500).ConfigureAwait(false);

                await Dispatcher.InvokeAsync(() =>
                {
                    DoorpiBootDiagnostics.Log("initialize-resuming-after-unlock");
                    StartDoorpiRuntimeOnce("session-unlock-detected");
                });
            });
        }

        private void StartDoorpiRuntimeOnce(string reason)
        {
            if (Interlocked.Exchange(ref _initializeStarted, 1) == 1)
                return;

            DoorpiBootDiagnostics.Log("initialize-runtime-start", reason);
            InitializeAsync();
            StartGlobalControllerShortcutMonitor();
            StartMainUiGamepadNavigation();
            EnsureCursorHidden();
            StartMainScreenMouseWatch();
        }

        private bool IsForegroundWindowNativeWindows()
        {
            try
            {
                IntPtr hwnd = GetForegroundWindow();
                if (hwnd == IntPtr.Zero) return false;

                GetWindowProcessId(hwnd, out uint pid);
                var proc = Process.GetProcessById((int)pid);
                string name = proc.ProcessName.ToLowerInvariant();

                var nativeProcesses = new HashSet<string>
        {
            "explorer",                   // File Explorer, Desktop, Barra de Tarefas
            "shellexperiencehost",         // Menu Iniciar, Central de AÃ§Ã£o
            "startmenuexperiencehost",     // Menu Iniciar (Win11)
            "searchhost",                 // Pesquisa do Windows (Win11)
            "searchapp",                  // Pesquisa do Windows (Win10)
            "systemsettings",             // ConfiguraÃ§Ãµes
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
                    Debug.WriteLine("[TipTab] Nenhum executÃ¡vel de teclado nativo encontrado.");
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

                    // Em sessÃµes externas o ShowCursor pode oscilar durante foco/click.
                    // O handle do cursor continua sendo a fonte mais estÃ¡vel para IBEAM.
                    return pci.hCursor != IntPtr.Zero && pci.hCursor == textCursorHandle;
                }
            }
            catch { }
            return false;
        }

        private bool IsSystemCursorHidden()
        {
            try
            {
                var pci = new CURSORINFO();
                pci.cbSize = Marshal.SizeOf(typeof(CURSORINFO));
                return GetCursorInfo(out pci) && (pci.flags & CURSOR_SHOWING) == 0;
            }
            catch { return false; }
        }

        private void EnsureCursorHidden()
        {
            while (ShowCursor(false) >= 0) { }
        }

        private void EnsureCursorVisible()
        {
            while (ShowCursor(true) < 0) { }
        }

        private static void ApplyProductionWebViewSettings(CoreWebView2 core, bool allowDefaultContextMenus = false)
        {
            var settings = core.Settings;
            settings.AreHostObjectsAllowed = false;
            settings.AreDevToolsEnabled = false;
            settings.AreDefaultContextMenusEnabled = allowDefaultContextMenus;
            settings.AreBrowserAcceleratorKeysEnabled = false;
            settings.IsStatusBarEnabled = false;
            settings.IsZoomControlEnabled = false;
        }

        private void ReleaseMouseButtons()
        {
            try
            {
                SendMouse(0, 0, MOUSEEVENTF_LEFTUP_SHARED);
            }
            catch { }
        }

        private void StartMainScreenMouseWatch()
        {
            GetCursorPos(out _lastKnownCursorPos);

            _mouseIdleTimer = new System.Threading.Timer(_ =>
            {
                Dispatcher.Invoke(() =>
                {
                    if (ShouldMainScreenMouseWatchYield()) return;

                    // A REGRA DE OURO: SÃ³ mexe no mouse se o Doorpi estiver em primeiro plano!
                    if (!IsDoorpiMainWindowForeground()) return;

                    if (!_mainScreenMouseVisible) return;
                    _mainScreenMouseVisible = false;

                    // 1. Oculta o cursor visualmente no Windows
                    EnsureCursorHidden();

                    // 2. Estaciona o ponteiro invisÃ­vel no canto (0, 0)
                    _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                    SetCursorPos(0, 0);
                });
            }, null, Timeout.Infinite, Timeout.Infinite);

            _mousePollTimer = new System.Threading.Timer(_ =>
            {
                if (!GetCursorPos(out var pt)) return;

                // Compara se o usuÃ¡rio mexeu o mouse fisicamente
                if (pt.X == _lastKnownCursorPos.X && pt.Y == _lastKnownCursorPos.Y) return;

                _lastKnownCursorPos = pt;
                Dispatcher.Invoke(() =>
                {
                    if (ShouldMainScreenMouseWatchYield()) return;

                    // SÃ³ reage ao movimento se o Doorpi estiver em foco
                    if (!IsDoorpiMainWindowForeground()) return;

                    if (!_mainScreenMouseVisible)
                    {
                        // Exibe o cursor novamente quando movido fÃ­sico
                        EnsureCursorVisible();
                        _mainScreenMouseVisible = true;
                    }
                });
                _mouseIdleTimer?.Change(MOUSE_IDLE_MS, Timeout.Infinite);
            }, null, 0, 100);
        }

        private bool ShouldMainScreenMouseWatchYield()
        {
            return IsAnyControllerMouseKeyboardSessionActive() ||
                   _launcherMouseActive ||
                   _dialogModeActive ||
                   _systemControllerActive ||
                   _mediaExeModeActive ||
                   _isStoreLauncherSession ||
                   _ytWebView != null ||
                   _webAppWindow != null ||
                   _popupWindow != null ||
                   _gameSessionActive ||
                   IsGpuUpdaterSessionActive();
        }

        private void StopMainScreenMouseWatch()
        {
            _mousePollTimer?.Change(Timeout.Infinite, Timeout.Infinite);
            _mouseIdleTimer?.Change(Timeout.Infinite, Timeout.Infinite);
            _mousePollTimer?.Dispose(); _mousePollTimer = null;
            _mouseIdleTimer?.Dispose(); _mouseIdleTimer = null;
        }
        // ========================= INICIALIZAÃ‡ÃƒO =========================

        async void InitializeAsync()

        {

            // Configura o navegador para permitir Ã¡udio automÃ¡tico (autoplay) sem interaÃ§Ã£o do usuÃ¡rio
            DoorpiBootDiagnostics.Log("initialize-start", $"bootMode={GetBootMode()}");
            if (RequiresConsoleShellStartupGate())
            {
                StartConsoleShellExplorerStartupForIntro();
                await WaitForConsoleShellReadyBeforeHomeWebViewAsync();
            }
            else if (GetBootMode() == 2)
            {
                Interlocked.Exchange(ref _consoleShellExplorerReady, 1);
                Interlocked.Exchange(ref _consoleShellIntroSkippable, 1);
                DoorpiBootDiagnostics.Log("console-shell-main-after-bootstrap");
            }

            string homeRenderMode = "hardware";
            string homeBrowserArgs = BuildWebViewAdditionalArguments(
                "DOORPI_HOME_WEBVIEW_RENDER_MODE",
                homeRenderMode,
                "DOORPI_HOME_WEBVIEW_EXTRA_ARGS");
            DoorpiBootDiagnostics.Log("home-webview-args", homeBrowserArgs);
            DoorpiBootDiagnostics.Log("home-webview-runtime", GetAvailableWebView2RuntimeVersion());
            string homeTrailerExtensionPath = GetBundledHomeTrailerExtensionPath();
            var environmentStartedAt = Stopwatch.StartNew();
            var options = new CoreWebView2EnvironmentOptions(homeBrowserArgs)
            {
                AreBrowserExtensionsEnabled = true
            };
            var environment = await CoreWebView2Environment.CreateAsync(null, null, options);
            DoorpiBootDiagnostics.Log("home-webview-environment-created", $"elapsedMs={environmentStartedAt.ElapsedMilliseconds}");

            // Inicializa o WebView2 usando essas opÃ§Ãµes
            var ensureStartedAt = Stopwatch.StartNew();
            await webView.EnsureCoreWebView2Async(environment);
            DoorpiBootDiagnostics.Log("home-webview-core-created", $"elapsedMs={ensureStartedAt.ElapsedMilliseconds}");
            DoorpiBootDiagnostics.Log("webview-ready", $"bootMode={GetBootMode()}");
            ApplyLayoutScaleToWebView(LoadLayoutScale());
            int bootMode = GetBootMode();
            bool consoleShellExplorerReadyForUi =
                !RequiresConsoleShellStartupGate() ||
                Volatile.Read(ref _consoleShellExplorerReady) == 1;
            bool consoleShellIntroSkippableForUi =
                !RequiresConsoleShellStartupGate() ||
                Volatile.Read(ref _consoleShellIntroSkippable) == 1;
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(
                $"window.__doorpiBootMode = {bootMode}; window.__doorpiUseNativeIntro = false; window.__doorpiNativeIntroComplete = true; window.__doorpiConsoleShellExplorerReady = {(consoleShellExplorerReadyForUi ? "true" : "false")}; window.__doorpiConsoleShellIntroSkippable = {(consoleShellIntroSkippableForUi ? "true" : "false")};");
            bool homeTrailerExtensionReady = await InstallHomeTrailerExtensionAsync(
                webView.CoreWebView2,
                homeTrailerExtensionPath);
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(
                $"window.__doorpiHomeTrailerExtensionReady = {(homeTrailerExtensionReady ? "true" : "false")};");
            ApplyProductionWebViewSettings(webView.CoreWebView2);
            webView.CoreWebView2.PermissionRequested += OnWebViewPermissionRequested;
            webView.CoreWebView2.ProcessFailed += OnMainWebViewProcessFailed;
            string folderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");

            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "app.local", folderPath, CoreWebView2HostResourceAccessKind.Allow);
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "data.local", dataFolder, CoreWebView2HostResourceAccessKind.Allow);

            webView.CoreWebView2.Navigate("https://app.local/index.html");
            webView.CoreWebView2.WebMessageReceived += WebView_WebMessageReceived;
            webView.CoreWebView2.NavigationCompleted += (s, e) =>

            {
                Interlocked.Exchange(ref _homeNavigationCompleted, 1);
                DoorpiBootDiagnostics.Log("home-navigation-completed", $"success={e.IsSuccess} status={e.WebErrorStatus}");
                StartHomeWebViewHealthWatch("navigation-completed", 2200);
                TryCompleteNativeBootIntroHandoff();
                UpdateHoverStateInWebView();
                SendBootModeToUI();
                SendDisplaySettingsToUI();
                if (consoleShellExplorerReadyForUi || Volatile.Read(ref _consoleShellExplorerReady) == 1)
                {
                    try { webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"consoleShellExplorerReady\"}"); } catch { }
                    try { _ = webView.CoreWebView2.ExecuteScriptAsync("window.__doorpiConsoleShellExplorerReady=true; window.dispatchEvent(new CustomEvent('doorpi:console-shell-ready'));"); } catch { }
                }
                if (consoleShellIntroSkippableForUi || Volatile.Read(ref _consoleShellIntroSkippable) == 1)
                {
                    try { webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"consoleShellIntroSkippable\"}"); } catch { }
                }

                TryReleaseInitialUserGate("navigation-completed");
                Dispatcher.InvokeAsync(() =>
                {
                    ReleaseDoorpiTopmost();
                    Activate();
                    webView.Focus();
                });

                // A tela de perfis ja esta interativa neste ponto. Reconciliação
                // de bibliotecas, updates e criacao de controladores WebView sao
                // tarefas da sessao escolhida e nao podem competir com ela.
                if (_interactiveUserSessionStarted)
                {
                    ScheduleEmulatorLibraryReconcile();
                    BeginStartupUpdateCheck();
                }
            };

            // ConfiguraÃ§Ãµes de ProduÃ§Ã£o

            _ = timeBeginPeriod(1);
            StartWatchers();
            _ = Task.Run(WatchWindowsRegistry);
            DoorpiBootDiagnostics.Log("initialize-watchers-started");
            StartHomeWebViewHealthWatch("initialize-complete", RequiresConsoleShellStartupGate() ? 9000 : 4500);
        }

        private static string GetAvailableWebView2RuntimeVersion()
        {
            try
            {
                return CoreWebView2Environment.GetAvailableBrowserVersionString() ?? "";
            }
            catch (Exception ex)
            {
                return "error:" + ex.GetType().Name + ":" + ex.Message;
            }
        }

        private void StartHomeWebViewHealthWatch(string reason, int delayMs)
        {
            Interlocked.Increment(ref _homeWebViewHealthGeneration);
            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(Math.Max(0, delayMs)).ConfigureAwait(false);

                    bool healthy = await ProbeHomeWebViewAsync(reason).ConfigureAwait(false);
                    if (healthy)
                    {
                        Interlocked.Exchange(ref _homeWebViewHealthy, 1);
                        await Dispatcher.InvokeAsync(() =>
                        {
                            TryCompleteNativeBootIntroHandoff();
                            TryReleaseInitialUserGate("webview-healthy:" + reason);
                        });
                        return;
                    }

                    await RequestHomeWebViewSelfRestartAsync(reason).ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    DoorpiBootDiagnostics.Log("home-webview-health-error", $"{reason} {ex.GetType().Name}:{ex.Message}");
                }
            });
        }

        private async Task<bool> ProbeHomeWebViewAsync(string reason)
        {
            var sw = Stopwatch.StartNew();
            try
            {
                var probeTask = Dispatcher.InvokeAsync(async () =>
                {
                    if (webView?.CoreWebView2 == null)
                        return "no-core";

                    return await webView.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify({ready:document.readyState,href:location.href,body:!!document.body,app:!!document.getElementById('doorpi-app-ui'),ts:Date.now()})");
                }).Task.Unwrap();

                var completed = await Task.WhenAny(probeTask, Task.Delay(RequiresConsoleShellStartupGate() ? 5500 : 3500)).ConfigureAwait(false);
                if (completed != probeTask)
                {
                    DoorpiBootDiagnostics.Log("home-webview-health-timeout", $"reason={reason} elapsedMs={sw.ElapsedMilliseconds}");
                    return false;
                }

                string result = await probeTask.ConfigureAwait(false);
                bool healthy =
                    !string.IsNullOrWhiteSpace(result) &&
                    !result.Contains("no-core", StringComparison.OrdinalIgnoreCase) &&
                    result.Contains("https://app.local/index.html", StringComparison.OrdinalIgnoreCase) &&
                    result.Contains("\\\"body\\\":true", StringComparison.OrdinalIgnoreCase);
                DoorpiBootDiagnostics.Log("home-webview-health", $"reason={reason} healthy={healthy} elapsedMs={sw.ElapsedMilliseconds} result={result}");
                return healthy;
            }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("home-webview-health-failed", $"reason={reason} elapsedMs={sw.ElapsedMilliseconds} {ex.GetType().Name}:{ex.Message}");
                return false;
            }
        }

        private async Task RequestHomeWebViewSelfRestartAsync(string reason)
        {
            if (!RequiresConsoleShellStartupGate())
                return;

            if (Environment.GetCommandLineArgs().Any(arg => string.Equals(arg, "--doorpi-webview-recovery", StringComparison.OrdinalIgnoreCase)))
            {
                DoorpiBootDiagnostics.Log("home-webview-restart-skip", $"reason={reason} alreadyRecovery=true");
                return;
            }

            if (Volatile.Read(ref _consoleShellExplorerReady) == 0)
            {
                DoorpiBootDiagnostics.Log("home-webview-restart-wait-shell", reason);
                StartHomeWebViewHealthWatch("restart-after-shell:" + reason, 4000);
                return;
            }

            if ((DateTime.UtcNow - _processStartedUtc).TotalMinutes > 3 ||
                _gameSessionActive ||
                _mediaExeModeActive ||
                _isStoreLauncherSession ||
                _ytWebView != null ||
                _webAppWindow != null)
            {
                DoorpiBootDiagnostics.Log("home-webview-restart-skip", $"reason={reason} activeSession=true");
                return;
            }

            if (Interlocked.Exchange(ref _homeWebViewSelfRestartStarted, 1) == 1)
                return;

            DoorpiBootDiagnostics.Log("home-webview-self-restart", reason);
            await Dispatcher.InvokeAsync(() =>
            {
                try
                {
                    string exe = Process.GetCurrentProcess().MainModule?.FileName ?? Environment.ProcessPath ?? "";
                    if (string.IsNullOrWhiteSpace(exe))
                        return;

                    Process.Start(new ProcessStartInfo
                    {
                        FileName = exe,
                        Arguments = "--doorpi-webview-recovery",
                        UseShellExecute = true,
                        WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
                    });
                }
                catch (Exception ex)
                {
                    DoorpiBootDiagnostics.Log("home-webview-self-restart-error", ex.Message);
                    return;
                }

                try { Application.Current.Shutdown(); } catch { }
                Environment.Exit(0);
            });
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
        private void MigrateLegacyDataFolderIfNeeded()
        {
            try
            {
                string legacy = Path.GetFullPath(DoorpiPaths.LegacyDataFolder);
                string target = Path.GetFullPath(dataFolder);
                if (string.Equals(legacy.TrimEnd('\\'), target.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))
                    return;
                if (!Directory.Exists(legacy))
                    return;

                Directory.CreateDirectory(target);
                CopyDirectoryContentIfMissing(legacy, target);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DataMigration] Falha ao migrar dados locais: " + ex.Message);
            }
        }

        private static void CopyDirectoryContentIfMissing(string source, string destination)
        {
            Directory.CreateDirectory(destination);
            foreach (var directory in Directory.GetDirectories(source, "*", SearchOption.AllDirectories))
            {
                string relative = Path.GetRelativePath(source, directory);
                Directory.CreateDirectory(Path.Combine(destination, relative));
            }

            foreach (var file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
            {
                string relative = Path.GetRelativePath(source, file);
                string dest = Path.Combine(destination, relative);
                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
                if (!File.Exists(dest))
                    File.Copy(file, dest);
            }
        }

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
                        legacy.IsAdmin = true;
                        legacy.DateCreated = DateTime.Now;
                        legacy.LastUsed = DateTime.Now;
                        users.Add(legacy);
                        SaveUserProfiles(users);
                        currentUserId = legacy.Id;
                        DurableFileStore.WriteAllText(currentUserFile, legacy.Id, keepBackup: true);
                        SetActiveUser(legacy, migrateLegacyFiles: true, startSessionTasks: false);
                        return;
                    }
                }
                catch { }
            }

            currentUserId = ReadCurrentUserId();
            var current = users.FirstOrDefault(u => string.Equals(u.Id, currentUserId, StringComparison.OrdinalIgnoreCase))
                          ?? users.OrderByDescending(u => u.LastUsed).FirstOrDefault();
            if (current != null) SetActiveUser(current, migrateLegacyFiles: false, startSessionTasks: false);
            else SetActiveUser(new UserProfile { Id = "default", Name = "" }, migrateLegacyFiles: false, startSessionTasks: false);
        }

        private List<UserProfile> LoadUserProfiles()
        {
            if (TryLoadUserProfilesFile(profilesFile, out List<UserProfile> users))
                return users;

            string backupFile = profilesFile + ".bak";
            if (TryLoadUserProfilesFile(backupFile, out users))
            {
                DoorpiBootDiagnostics.Log(
                    "user-index-recovered",
                    $"primary={profilesFile}; backup={backupFile}; users={users.Count}");
                return users;
            }

            if (File.Exists(profilesFile) || File.Exists(backupFile))
            {
                DoorpiBootDiagnostics.Log(
                    "user-index-unreadable",
                    $"primaryExists={File.Exists(profilesFile)}; backupExists={File.Exists(backupFile)}");
            }

            users = RecoverUserProfilesFromDirectories();
            if (users.Count > 0)
            {
                DoorpiBootDiagnostics.Log(
                    "user-index-rebuilt",
                    $"users={users.Count}; source=per-user-metadata");
                return users;
            }
            return new List<UserProfile>();
        }

        private List<UserProfile> RecoverUserProfilesFromDirectories()
        {
            string usersDirectory = Path.Combine(dataFolder, "users");
            if (!Directory.Exists(usersDirectory)) return new List<UserProfile>();

            var recovered = new Dictionary<string, UserProfile>(StringComparer.OrdinalIgnoreCase);
            foreach (string directory in Directory.EnumerateDirectories(usersDirectory))
            {
                string directoryId = Path.GetFileName(directory);
                UserProfile? profile = TryLoadSingleUserProfile(Path.Combine(directory, "user.json"))
                    ?? TryLoadSingleUserProfile(Path.Combine(directory, "user.json.bak"));
                if (profile == null || string.IsNullOrWhiteSpace(profile.Name)) continue;

                profile.Id = string.IsNullOrWhiteSpace(profile.Id) ? directoryId : profile.Id.Trim();
                if (!string.Equals(profile.Id, directoryId, StringComparison.OrdinalIgnoreCase))
                {
                    DoorpiBootDiagnostics.Log(
                        "user-profile-directory-mismatch",
                        $"directory={directoryId}; profile={profile.Id}");
                    continue;
                }

                if (!recovered.TryGetValue(profile.Id, out UserProfile? existing) ||
                    profile.LastUsed > existing.LastUsed)
                {
                    recovered[profile.Id] = profile;
                }
            }

            var users = recovered.Values
                .OrderBy(user => user.DateCreated == DateTime.MinValue ? DateTime.MaxValue : user.DateCreated)
                .ThenBy(user => user.Id, StringComparer.OrdinalIgnoreCase)
                .ToList();
            EnsureOneAdmin(users);
            return users;
        }

        private static UserProfile? TryLoadSingleUserProfile(string path)
        {
            if (!File.Exists(path)) return null;
            try
            {
                string json = SafeReadAllText(path);
                if (string.IsNullOrWhiteSpace(json) || json.IndexOf('\0') >= 0) return null;
                UserProfile? profile = JsonSerializer.Deserialize<UserProfile>(json);
                if (profile == null) return null;
                UnprotectUserProfile(profile);
                profile.PinCode = NormalizePinCode(profile.PinCode);
                profile.AdminBlockedStoreIds ??= new List<string>();
                return profile;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
            {
                DoorpiBootDiagnostics.Log("user-profile-read-failed", $"path={path}; error={ex.Message}");
                return null;
            }
        }

        private static bool TryLoadUserProfilesFile(string path, out List<UserProfile> users)
        {
            users = new List<UserProfile>();
            if (!File.Exists(path)) return false;
            try
            {
                string json = SafeReadAllText(path);
                if (string.IsNullOrWhiteSpace(json) || json.IndexOf('\0') >= 0) return false;
                users = JsonSerializer.Deserialize<List<UserProfile>>(json) ?? new List<UserProfile>();
                foreach (var user in users.Where(user => string.IsNullOrWhiteSpace(user.Id)))
                    user.Id = MakeUserId(user.Name);
                foreach (var user in users)
                {
                    UnprotectUserProfile(user);
                    user.PinCode = NormalizePinCode(user.PinCode);
                    user.AdminBlockedStoreIds ??= new List<string>();
                }
                EnsureOneAdmin(users);
                return true;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
            {
                DoorpiBootDiagnostics.Log("user-index-read-failed", $"path={path}; error={ex.Message}");
                users = new List<UserProfile>();
                return false;
            }
        }

        private string ReadCurrentUserId()
        {
            foreach (string path in new[] { currentUserFile, currentUserFile + ".bak" })
            {
                try
                {
                    if (!File.Exists(path)) continue;
                    string id = SafeReadAllText(path).Trim();
                    if (!string.IsNullOrWhiteSpace(id) && id.IndexOf('\0') < 0)
                        return id;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    DoorpiBootDiagnostics.Log("current-user-read-failed", $"path={path}; error={ex.Message}");
                }
            }
            return "";
        }

        private static void EnsureOneAdmin(List<UserProfile> users)
        {
            if (users.Count == 0) return;
            if (users.Any(u => u.IsAdmin)) return;

            var first = users
                .Where(u => !string.IsNullOrWhiteSpace(u.Name))
                .OrderBy(u => u.DateCreated == DateTime.MinValue ? DateTime.MaxValue : u.DateCreated)
                .ThenBy(u => u.LastUsed == DateTime.MinValue ? DateTime.MaxValue : u.LastUsed)
                .FirstOrDefault()
                ?? users.First();
            first.IsAdmin = true;
        }

        private bool IsCurrentUserAdmin()
            => LoadUserProfiles().Any(u =>
                string.Equals(u.Id, currentUserId, StringComparison.OrdinalIgnoreCase) && u.IsAdmin);

        private UserProfile? GetAdminPolicyUser()
        {
            var users = LoadUserProfiles();
            return users.FirstOrDefault(u => u.IsAdmin)
                   ?? users.OrderBy(u => u.DateCreated).FirstOrDefault();
        }

        private static string NormalizeStorePolicyKey(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            value = value.Trim();
            return value switch
            {
                "Epic Games" => "Epic",
                "GOG Galaxy" => "GOG",
                "Riot Games" => "Riot",
                _ => value
            };
        }

        private HashSet<string> GetAdminBlockedStoreIds()
        {
            var admin = GetAdminPolicyUser();
            return (admin?.AdminBlockedStoreIds ?? new List<string>())
                .Select(NormalizeStorePolicyKey)
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        private bool IsStoreBlockedForCurrentUser(string storeIdOrSource)
        {
            if (IsCurrentUserAdmin()) return false;
            var key = NormalizeStorePolicyKey(storeIdOrSource);
            return !string.IsNullOrWhiteSpace(key) && GetAdminBlockedStoreIds().Contains(key);
        }

        private bool IsSteamAccountSelectionForced()
            => GetAdminPolicyUser()?.SteamForceAccountSelection == true;

        private void SaveAdminStorePolicy(string storeId, bool blockedForNonAdmins, bool? forceSteamAccountSelection = null)
        {
            if (!IsCurrentUserAdmin()) return;

            var users = LoadUserProfiles();
            var admin = users.FirstOrDefault(u => u.IsAdmin)
                        ?? users.OrderBy(u => u.DateCreated).FirstOrDefault();
            if (admin == null) return;

            admin.AdminBlockedStoreIds ??= new List<string>();
            string key = NormalizeStorePolicyKey(storeId);
            admin.AdminBlockedStoreIds.RemoveAll(s => string.Equals(NormalizeStorePolicyKey(s), key, StringComparison.OrdinalIgnoreCase));
            if (blockedForNonAdmins && !string.IsNullOrWhiteSpace(key))
                admin.AdminBlockedStoreIds.Add(key);

            if (forceSteamAccountSelection.HasValue)
                admin.SteamForceAccountSelection = forceSteamAccountSelection.Value;

            SaveUserProfiles(users);
            if (string.Equals(admin.Id, currentUserId, StringComparison.OrdinalIgnoreCase))
                SaveUserProfile(admin);
        }

        private void SaveUserProfiles(List<UserProfile> users)
        {
            EnsureOneAdmin(users);
            var storageUsers = users.Select(CloneUserProfileForStorage).ToList();
            DurableFileStore.WriteAllText(
                profilesFile,
                JsonSerializer.Serialize(storageUsers, IndentedJsonOptions),
                keepBackup: true);
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

        private static string NormalizePinCode(string value)
        {
            var pin = new string((value ?? "").Where(char.IsDigit).Take(4).ToArray());
            return pin.Length == 0 || pin.Length == 4 ? pin : "";
        }

        private static UserProfile CloneUserProfileForStorage(UserProfile profile)
        {
            var json = JsonSerializer.Serialize(profile);
            var clone = JsonSerializer.Deserialize<UserProfile>(json) ?? new UserProfile();
            clone.SteamGridApiKey = ProtectLocalUserSecret(clone.SteamGridApiKey);
            clone.PinCode = ProtectLocalUserSecret(clone.PinCode);
            return clone;
        }

        private static void UnprotectUserProfile(UserProfile profile)
        {
            profile.SteamGridApiKey = UnprotectLocalUserSecret(profile.SteamGridApiKey);
            profile.PinCode = UnprotectLocalUserSecret(profile.PinCode);
        }

        private static void WriteUserProfileFile(string path, UserProfile profile)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            DurableFileStore.WriteAllText(
                path,
                JsonSerializer.Serialize(CloneUserProfileForStorage(profile), IndentedJsonOptions),
                keepBackup: true);
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

        private void SetActiveUser(
            UserProfile profile,
            bool migrateLegacyFiles,
            bool startSessionTasks = true)
        {
            if (string.IsNullOrWhiteSpace(profile.Id)) profile.Id = MakeUserId(profile.Name);
            currentUserId = profile.Id;
            currentUserDataFolder = Path.Combine(dataFolder, "users", currentUserId);
            Directory.CreateDirectory(currentUserDataFolder);
            ResetControlConfigurationForActiveUser();

            userFile = Path.Combine(currentUserDataFolder, "user.json");
            gamesFile = Path.Combine(currentUserDataFolder, "games.json");
            gameHistoryFile = Path.Combine(currentUserDataFolder, "game-history.json");
            foldersFile = Path.Combine(currentUserDataFolder, "folders.json");
            appCacheFile = Path.Combine(currentUserDataFolder, "appcache.json");
            mediaFile = Path.Combine(currentUserDataFolder, "media.json");
            libraryBootstrapFile = Path.Combine(currentUserDataFolder, "library-bootstrap.json");
            storesFile = Path.Combine(currentUserDataFolder, "stores.json");

            if (migrateLegacyFiles)
            {
                CopyLegacyFile("games.json", gamesFile);
                CopyLegacyFile("game-history.json", gameHistoryFile);
                CopyLegacyFile("folders.json", foldersFile);
                CopyLegacyFile("appcache.json", appCacheFile);
                CopyLegacyFile("media.json", mediaFile);
            }

            if (!File.Exists(gamesFile)) SafeWriteAllText(gamesFile, "[]");
            InitializeGameHistoryForActiveUser();
            if (!File.Exists(foldersFile)) SafeWriteAllText(foldersFile, "[]");
            if (!File.Exists(mediaFile)) SafeWriteAllText(mediaFile, "[]");
            if (!File.Exists(storesFile)) SafeWriteAllText(storesFile, "[]");

            SaveUserProfile(profile);
            if (startSessionTasks)
            {
                ScheduleProfileSync(profile.Id, notifyFailure: true, delayMs: 150);
                ResumeProfileSyncArtworkDownloads(profile.Id);
            }
            MirrorCurrentUserDataFiles();
            DurableFileStore.WriteAllText(currentUserFile, currentUserId, keepBackup: true);
            WriteUserProfileFile(Path.Combine(dataFolder, "user.json"), profile);
        }

        private void MirrorCurrentUserDataFiles()
        {
            try
            {
                if (File.Exists(gamesFile))
                    SafeWriteAllText(Path.Combine(dataFolder, "games.json"), SafeReadAllText(gamesFile));
                if (File.Exists(gameHistoryFile))
                    SafeWriteAllText(Path.Combine(dataFolder, "game-history.json"), SafeReadAllText(gameHistoryFile));
                if (File.Exists(foldersFile))
                    SafeWriteAllText(Path.Combine(dataFolder, "folders.json"), SafeReadAllText(foldersFile));
                if (File.Exists(mediaFile))
                {
                    SafeWriteAllText(Path.Combine(dataFolder, "media.json"),
                        JsonSerializer.Serialize(LoadMediaApps(), IndentedJsonOptions));
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
            var users = LoadUserProfiles().OrderByDescending(u => u.LastUsed).Select(UserProfilePickerPayload).ToList();
            bool sessionActive = _interactiveUserSessionStarted;
            bool effectiveRequireSelection = requireSelection || !sessionActive;
            string activeUserId = sessionActive ? currentUserId : "";
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "usersList",
                    users,
                    currentUserId = activeUserId,
                    sessionActive,
                    requireSelection = effectiveRequireSelection
                })));
        }

        private void SendUsersDataToUI()
        {
            var users = LoadUserProfiles().OrderByDescending(u => u.LastUsed).Select(UserProfilePickerPayload).ToList();
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "usersData",
                    users,
                    currentUserId
                })));
        }

        private static object UserProfilePickerPayload(UserProfile user) => new
        {
            user.Id,
            user.Name,
            user.PhotoBase64,
            user.PhotoSource,
            user.PhotoSourceUrl,
            user.PhotoSteamGridAssetId,
            user.PhotoCropX,
            user.PhotoCropY,
            user.PhotoZoom,
            user.IsAdmin,
            HasPin = !string.IsNullOrWhiteSpace(user.PinCode)
        };

        private void PostUserTransitionStart(string mode, UserProfile user, bool showTransition = true)
        {
            void Send() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "userSwitchStart",
                    mode,
                    showTransition,
                    user = UserProfilePickerPayload(user)
                }));

            if (Dispatcher.CheckAccess()) Send();
            else Dispatcher.Invoke(Send);
        }

        private void PostUserTransitionComplete(string mode, bool showTransition, bool restartAudio, bool waitForHomeReady = true)
        {
            void Send() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "userSwitchComplete",
                    mode,
                    showTransition,
                    restartAudio,
                    waitForHomeReady
                }));

            if (Dispatcher.CheckAccess()) Send();
            else Dispatcher.Invoke(Send);
        }

        private int _consoleShellExplorerStartupStarted = 0;
        private int _consoleShellIntroSkippable = 0;
        private int _consoleShellExplorerReady = 0;
        private int _consoleShellPostIntroFocusRunning = 0;
        private int _initializeStarted = 0;

        private void StartConsoleShellExplorerStartupForIntro()
        {
            if (!RequiresConsoleShellStartupGate())
                return;

            if (Interlocked.Exchange(ref _consoleShellExplorerStartupStarted, 1) == 1)
                return;

            DoorpiBootDiagnostics.Log("console-shell-start");
            _ = Task.Run(async () =>
            {
                try
                {
                    bool explorerAlreadyRunning = await WaitForExplorerAlreadyRunningInFirstSecondAsync().ConfigureAwait(false);
                    DoorpiBootDiagnostics.Log("console-shell-first-second", $"explorerAlreadyRunning={explorerAlreadyRunning}");

                    if (explorerAlreadyRunning)
                    {
                        await Dispatcher.InvokeAsync(MarkConsoleShellIntroSkippable);
                    }
                    else
                    {
                        await Dispatcher.InvokeAsync(EnsureExplorerIsRunningInBackstage);
                    }

                    bool ready = await WaitForExplorerProcessReadyAsync().ConfigureAwait(false);
                    DoorpiBootDiagnostics.Log("console-shell-explorer-process-ready", $"ready={ready}");
                    if (!ready)
                    {
                        DoorpiBootDiagnostics.Log("console-shell-explorer-ready-fallback");
                    }

                    await Dispatcher.InvokeAsync(() =>
                    {
                        ReleaseDoorpiTopmost();
                        FocusDoorpiMainWebView(onlyIfFocusLost: false);
                        MarkConsoleShellExplorerReady();
                    });
                }
                catch (Exception ex)
                {
                    DoorpiBootDiagnostics.Log("console-shell-error", ex.Message);
                    Debug.WriteLine("[Boot] Falha ao preparar explorer para intro: " + ex.Message);
                }
            });
        }

        private async Task<bool> WaitForExplorerAlreadyRunningInFirstSecondAsync()
        {
            for (int i = 0; i < 10; i++)
            {
                if (IsExplorerProcessRunning())
                    return true;

                await Task.Delay(100).ConfigureAwait(false);
            }

            return IsExplorerProcessRunning();
        }

        private bool IsExplorerProcessRunning()
        {
            try { return Process.GetProcessesByName("explorer").Length > 0; }
            catch { return false; }
        }

        private async Task<bool> WaitForConsoleShellPassiveStabilizationAsync(int settleMs)
        {
            var startedAt = DateTime.UtcNow;
            bool sawExplorer = false;
            while ((DateTime.UtcNow - startedAt).TotalMilliseconds < 12000)
            {
                if (IsExplorerProcessRunning())
                {
                    sawExplorer = true;
                    _ = Dispatcher.BeginInvoke(new Action(MarkConsoleShellIntroSkippable));
                    break;
                }
                await Task.Delay(100).ConfigureAwait(false);
            }

            if (!sawExplorer)
                return false;

            await Task.Delay(settleMs).ConfigureAwait(false);
            return true;
        }

        private void MarkConsoleShellExplorerReady()
        {
            if (Interlocked.Exchange(ref _consoleShellExplorerReady, 1) == 1)
                return;

            DoorpiBootDiagnostics.Log("console-shell-explorer-ready");
            TryCompleteNativeBootIntroHandoff();
            TryReleaseInitialUserGate("console-shell-ready");
            if (webView?.CoreWebView2 != null)
            {
                StartHomeWebViewHealthWatch("console-shell-ready", 2500);
            }
            try
            {
                webView?.CoreWebView2?.PostWebMessageAsString(
                    "{\"type\":\"consoleShellExplorerReady\"}");
            }
            catch { }
            try
            {
                webView?.CoreWebView2?.ExecuteScriptAsync(
                    "window.__doorpiConsoleShellExplorerReady=true; window.dispatchEvent(new CustomEvent('doorpi:console-shell-ready'));");
            }
            catch { }
        }

        private async Task WaitForConsoleShellReadyBeforeHomeWebViewAsync()
        {
            if (!RequiresConsoleShellStartupGate())
                return;

            if (Volatile.Read(ref _consoleShellExplorerReady) == 1)
                return;

            DoorpiBootDiagnostics.Log("home-webview-wait-shell-start");
            var sw = Stopwatch.StartNew();
            while (sw.ElapsedMilliseconds < 22000)
            {
                if (Volatile.Read(ref _consoleShellExplorerReady) == 1)
                {
                    DoorpiBootDiagnostics.Log("home-webview-wait-shell-ready", $"elapsedMs={sw.ElapsedMilliseconds}");
                    return;
                }

                await Task.Delay(100);
            }

            DoorpiBootDiagnostics.Log("home-webview-wait-shell-timeout", $"elapsedMs={sw.ElapsedMilliseconds}");
        }

        private void MarkConsoleShellIntroSkippable()
        {
            if (Interlocked.Exchange(ref _consoleShellIntroSkippable, 1) == 1)
                return;

            DoorpiBootDiagnostics.Log("console-shell-intro-skippable");
            try
            {
                webView?.CoreWebView2?.PostWebMessageAsString(
                    "{\"type\":\"consoleShellIntroSkippable\"}");
            }
            catch { }
        }

        private async Task<bool> WaitForExplorerProcessReadyAsync()
        {
            bool sawExplorerProcess = false;
            int shellReadySamples = 0;

            for (int i = 0; i < 70; i++)
            {
                try
                {
                    if (Process.GetProcessesByName("explorer").Length > 0)
                    {
                        sawExplorerProcess = true;
                        if (IsExplorerShellSurfaceReady())
                        {
                            shellReadySamples++;
                            if (shellReadySamples >= 3)
                            {
                                await Task.Delay(700).ConfigureAwait(false);
                                return true;
                            }
                        }
                        else
                        {
                            shellReadySamples = 0;
                        }
                    }
                }
                catch { }

                await Task.Delay(100).ConfigureAwait(false);
            }

            if (sawExplorerProcess)
            {
                await Task.Delay(2200).ConfigureAwait(false);
                return true;
            }

            return false;
        }

        private bool IsExplorerShellSurfaceReady()
        {
            try
            {
                if (FindWindow("Shell_TrayWnd", null) != IntPtr.Zero)
                    return true;

                var shell = GetShellWindow();
                return shell != IntPtr.Zero && shell != _mainWindowHandle;
            }
            catch
            {
                return false;
            }
        }

        private async Task WaitForConsoleShellReadyForUserTransitionAsync()
        {
            if (!RequiresConsoleShellStartupGate())
                return;

            if (Volatile.Read(ref _consoleShellExplorerReady) == 1)
                return;

            await WaitForExplorerProcessReadyAsync().ConfigureAwait(false);

            await Dispatcher.InvokeAsync(() =>
            {
                ReleaseDoorpiTopmost();
                FocusDoorpiMainWebView(onlyIfFocusLost: false);
            });
        }

        private void RestoreDoorpiFocusAfterIntroHandoff()
        {
            if (!RequiresConsoleShellStartupGate())
                return;

            if (Interlocked.Exchange(ref _consoleShellPostIntroFocusRunning, 1) == 1)
                return;

            _ = Task.Run(async () =>
            {
                try
                {
                    int[] delays = { 0, 180, 420 };
                    foreach (int delay in delays)
                    {
                        if (delay > 0)
                            await Task.Delay(delay).ConfigureAwait(false);

                        await Dispatcher.InvokeAsync(() =>
                        {
                            ReleaseDoorpiTopmost();
                            FocusDoorpiMainWebView(onlyIfFocusLost: false);
                        });
                    }
                }
                finally
                {
                    Interlocked.Exchange(ref _consoleShellPostIntroFocusRunning, 0);
                }
            });
        }

        private void FocusDoorpiMainWebView(bool onlyIfFocusLost)
        {
            if (WindowState == WindowState.Minimized)
                WindowState = WindowState.Maximized;

            this.Show();
            var hwnd = _mainWindowHandle != IntPtr.Zero
                ? _mainWindowHandle
                : new System.Windows.Interop.WindowInteropHelper(this).Handle;

            if (onlyIfFocusLost && GetForegroundWindow() == hwnd)
                return;

            if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
            else ShowWindow(hwnd, 5);

            SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
            BringWindowToTop(hwnd);
            SwitchToThisWindow(hwnd, true);
            SetForegroundWindow(hwnd);
            Activate();
            webView?.Focus();
            Keyboard.Focus(webView);
            NotifyDoorpiWebFocusRestored();
        }

        private void NotifyDoorpiWebFocusRestored()
        {
            try
            {
                webView?.CoreWebView2?.ExecuteScriptAsync(@"
                    (() => {
                        window._isDoorpiFocused = true;
                        window.isDoorpiFocused = true;
                        try { window.dispatchEvent(new Event('doorpi:native-focus-restored')); } catch {}
                        try {
                            if (window._isIntroComplete) {
                                window._startSystemAudio?.(true);
                            }
                        } catch {}
                    })();
                ");
            }
            catch { }
        }

        private object BuildCurrentUserPayload(UserProfile user)
        {
            var blockedStores = GetAdminBlockedStoreIds();
            return new
            {
                type = "currentUserUpdated",
                user = new
                {
                    user.Id,
                    user.Name,
                    user.PhotoBase64,
                    user.PhotoSource,
                    user.PhotoSourceUrl,
                    user.PhotoSteamGridAssetId,
                    user.PhotoCropX,
                    user.PhotoCropY,
                    user.PhotoZoom,
                    user.IsAdmin,
                    user.DateCreated,
                    user.LastUsed,
                    HasSteamGridApiKey = !string.IsNullOrWhiteSpace(user.SteamGridApiKey),
                    HasPin = !string.IsNullOrWhiteSpace(user.PinCode)
                },
                currentUserId,
                isAdmin = IsCurrentUserAdmin(),
                blockedStoreIds = blockedStores.ToList(),
                steamForceAccountSelection = IsSteamAccountSelectionForced()
            };
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
            RecoverInterruptedGameplaySession();
            ArmMainUiGamepadStartupGrace(RequiresConsoleShellStartupGate() ? 8000 : 2000);
            StartHomeWebViewHealthWatch("user-session-loaded", RequiresConsoleShellStartupGate() ? 5000 : 2500);
            ClearHomeUi();

            var user = LoadUserProfile();
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(BuildCurrentUserPayload(user))));

            LoadGamesIntoUI();
            // O usuário ativo já está definido aqui. A chamada feita durante a
            // criação do WebView pode ocorrer cedo demais e apontar para outro
            // diretório de perfil.
            ScheduleEmulatorLibraryReconcile(force: true);
            var apps = LoadMediaApps();
            if (apps.Count > 0) SendMediaAppsToUI(apps);
            BeginStartupUpdateCheck();
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

            bool isInitialLogin = !_interactiveUserSessionStarted;
            bool shouldShowTransition = isInitialLogin || isRealAccountSwitch;
            string transitionMode = isRealAccountSwitch ? "switch" : "initial";

            if (shouldShowTransition)
                PostUserTransitionStart(transitionMode, user);

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

                    // Criar os controladores WebView durante a transicao evita a
                    // pausa de ~250 ms que antes acontecia depois que o seletor de
                    // perfis ja aceitava navegacao.
                    Task mediaPrewarmTask = shouldShowTransition
                        ? Dispatcher.InvokeAsync(() =>
                            PrewarmMediaWebViewEnvironmentsAsync(delayMilliseconds: 0)).Task.Unwrap()
                        : Task.CompletedTask;

                    await SynchronizeNativeAppsAsync(
                        currentUserId,
                        mediaFile,
                        addMissingApps: false,
                        silent: true).ConfigureAwait(false);

                    await Dispatcher.InvokeAsync(LoadCurrentUserIntoUI);
                    await WaitForConsoleShellReadyForUserTransitionAsync().ConfigureAwait(false);
                    await mediaPrewarmTask.ConfigureAwait(false);

                    PostUserTransitionComplete(
                        transitionMode,
                        showTransition: shouldShowTransition,
                        restartAudio: shouldShowTransition,
                        waitForHomeReady: shouldShowTransition);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[Users] Falha ao trocar usuario: " + ex.Message);
                    try
                    {
                        PostUserTransitionComplete(
                            transitionMode,
                            showTransition: shouldShowTransition,
                            restartAudio: false,
                            waitForHomeReady: false);
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
                    GetWindowProcessId(_currentGameHwnd, out uint pidRaw);
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

        private void ResetCurrentUserContext()
        {
            currentUserId = "";
            currentUserDataFolder = "";
            userFile = Path.Combine(dataFolder, "user.json");
            gamesFile = Path.Combine(dataFolder, "games.json");
            gameHistoryFile = Path.Combine(dataFolder, "game-history.json");
            foldersFile = Path.Combine(dataFolder, "folders.json");
            appCacheFile = Path.Combine(dataFolder, "appcache.json");
            mediaFile = Path.Combine(dataFolder, "media.json");
            libraryBootstrapFile = Path.Combine(dataFolder, "library-bootstrap.json");
            displaySettingsFile = Path.Combine(dataFolder, "display-settings.json");
            storesFile = Path.Combine(dataFolder, "stores.json");
        }

        private void DeleteCurrentUserRootFiles()
        {
            try
            {
                if (File.Exists(currentUserFile)) File.Delete(currentUserFile);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Users] Falha ao limpar current-user.json: {ex.Message}");
            }

            string[] ghostFiles = { "user.json", "games.json", "game-history.json", "folders.json", "appcache.json", "media.json" };
            foreach (var file in ghostFiles)
            {
                try
                {
                    string fp = Path.Combine(dataFolder, file);
                    if (File.Exists(fp)) File.Delete(fp);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[Users] Falha ao limpar {file}: {ex.Message}");
                }
            }
        }

        private async Task HandleDeleteCurrentUserAsync()
        {
            if (Interlocked.Exchange(ref _userSwitchInProgress, 1) == 1)
                return;

            try
            {
                var users = LoadUserProfiles();
                var userToRemove = users.FirstOrDefault(u => string.Equals(u.Id, currentUserId, StringComparison.OrdinalIgnoreCase));
                if (userToRemove == null) return;
                if (userToRemove.IsAdmin)
                {
                    Dispatcher.Invoke(() =>
                        webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "adminPolicyBlocked",
                            kind = "admin-delete",
                            name = userToRemove.Name,
                            storeId = ""
                        })));
                    return;
                }

                Dispatcher.Invoke(() =>
                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "userSwitchStart",
                        mode = "delete"
                    })));

                Dispatcher.Invoke(() =>
                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"closeNavMenu\"}"));

                await Task.Delay(150).ConfigureAwait(false);

                List<Task> closeTasks = new();
                await Dispatcher.InvokeAsync(() =>
                {
                    closeTasks = BeginLogoutCurrentSessionsForUserSwitch();
                });

                await WaitForUserLogoutSessionsToCloseAsync(closeTasks).ConfigureAwait(false);
                await Task.Delay(350).ConfigureAwait(false);

                users = LoadUserProfiles();
                userToRemove = users.FirstOrDefault(u => string.Equals(u.Id, currentUserId, StringComparison.OrdinalIgnoreCase));

                if (userToRemove != null)
                {
                    await DeleteWebViewProfilesForOwnerAsync(userToRemove.Id).ConfigureAwait(false);
                    users.RemoveAll(u => string.Equals(u.Id, userToRemove.Id, StringComparison.OrdinalIgnoreCase));
                    SaveUserProfiles(users);

                    try
                    {
                        ForceDeleteDirectory(Path.Combine(dataFolder, "users", userToRemove.Id));
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"Erro ao deletar pasta do usuÃ¡rio: {ex.Message}");
                    }

                }

                StopWatchers();
                ResetCurrentUserContext();
                DeleteCurrentUserRootFiles();
                _interactiveUserSessionStarted = false;

                if (users.Count > 0)
                {
                    ClearHomeUi();
                    SendUsersToUI(requireSelection: true);
                }
                else
                {
                    ClearHomeUi();
                    Dispatcher.Invoke(() =>
                        webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"showSetup\"}"));
                }

                Dispatcher.Invoke(() =>
                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "userSwitchComplete",
                        mode = "delete",
                        showTransition = true,
                        restartAudio = true
                    })));
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Users] Falha ao excluir usuario: " + ex.Message);
                try
                {
                    Dispatcher.Invoke(() =>
                        webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "userSwitchComplete",
                            mode = "delete",
                            showTransition = true,
                            restartAudio = false
                        })));
                }
                catch { }
            }
            finally
            {
                Interlocked.Exchange(ref _userSwitchInProgress, 0);
            }
        }
        private const uint KEYEVENTF_UNICODE = 0x0004;
        private DesktopVkbWindow? _desktopVkb;

        private const int MINIMUM_LAUNCH_ANIMATION_MS = 3000;
        private const int GAME_WINDOW_DETECTION_TIMEOUT_MS = 4 * 60 * 1000;
        private const int EXTERNAL_SESSION_MINIMIZE_GRACE_MS = 2500;
        private const int STORE_SUSPICIOUS_WINDOW_CLOSED_GRACE_MS = 6000;
        private DateTime _launchAnimationStartedUtc = DateTime.MinValue;
        private long _gameMinimizeAllowedAfterUtcTicks;
        private volatile bool _dialogModeActive = false;
        private int _dialogControllerGeneration;

        // ========================= FOCUS GUARD DE TRANSIÃ‡ÃƒO =========================


        /// <summary>
        /// Aguarda atÃ© que o tempo mÃ­nimo de animaÃ§Ã£o de seguranÃ§a tenha passado desde "gameLaunching".
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
        private const double CONTROLLER_MOUSE_BASE_SPEED = 700.0;
        private const double CONTROLLER_NATIVE_MOUSE_BASE_SPEED = 900.0;
        private const double CONTROLLER_MOUSE_SENSITIVITY_SCALE = 0.92;
        private long _mediaExeMouseModeShortcutSuppressUntilTicks = 0;

        private struct AggregatedGamepadState
        {
            public bool Connected;
            public ushort Buttons;
            public bool LeftTrigger;
            public double ThumbLX, ThumbLY, ThumbRX, ThumbRY;
            public XInputSnapshot? Source;
        }

        private AggregatedGamepadState GetAggregatedGamepadState()
        {
            return GetUnifiedControllerInput();
        }

        // All controller-facing modes consume the same XInput-only snapshot. Physical
        // slots remain available in Source solely for per-controller edges/chords.
        private AggregatedGamepadState GetUnifiedControllerInput()
        {
            var snapshot = XInputControllerHub.Read();
            return new AggregatedGamepadState
            {
                Connected = snapshot.Connected,
                Buttons = snapshot.Buttons,
                LeftTrigger = snapshot.LeftTrigger,
                ThumbLX = snapshot.ThumbLX,
                ThumbLY = snapshot.ThumbLY,
                ThumbRX = snapshot.ThumbRX,
                ThumbRY = snapshot.ThumbRY,
                Source = snapshot
            };
        }

        private AggregatedGamepadState GetNativeDialogControllerInput()
        {
            return GetUnifiedControllerInput();
        }

        private async Task WaitForPrimaryControllerReleaseAsync()
        {
            const int timeoutMs = 2500;
            const int pollMs = 10;

            for (int elapsed = 0; elapsed < timeoutMs; elapsed += pollMs)
            {
                if ((GetUnifiedControllerInput().Buttons & XI_A) == 0)
                    return;

                await Task.Delay(pollMs).ConfigureAwait(true);
            }
        }

        private void SharedGamepadControllerLoop(
              Func<bool> isActive,
              Action onExitCombo,
              bool handleXboxButton = true,
              Func<bool>? shouldAcceptInput = null,
              Func<bool>? shouldAcceptMouseModeShortcut = null,
              Action? onMouseModeShortcut = null,
              Func<ushort, bool>? mouseModeShortcutPredicate = null,
              bool instantPrimaryClick = false,
              Func<AggregatedGamepadState>? inputProvider = null)
        {
            var sw = Stopwatch.StartNew();
            var buttonTracker = new XInputButtonTracker();
            var initialInput = inputProvider?.Invoke() ?? GetUnifiedControllerInput();
            buttonTracker.Update(initialInput.Source ?? XInputControllerHub.Read());

            double remainderX = 0, remainderY = 0;
            bool isClicking = false, aWasOnTextField = false, aDragOccurred = false;
            double clickAccumX = 0, clickAccumY = 0;
            bool dragBrokeThreshold = false;
            bool ignoreNextBRelease = false;
            bool aDoubleClickPending = false;
            DateTime lastAReleaseTime = DateTime.MinValue;

            bool isHoldingX = false;
            DateTime xPressTime = DateTime.MinValue, lastBackspaceFired = DateTime.MinValue;
            bool ownsDesktopVkb = false;

            var prevAnalogActive = new Dictionary<VkbHoldAction, bool> {
                { VkbHoldAction.MoveUp, false }, { VkbHoldAction.MoveDown, false },
                { VkbHoldAction.MoveLeft, false }, { VkbHoldAction.MoveRight, false },
                { VkbHoldAction.CursorLeft, false }, { VkbHoldAction.CursorRight, false },
                { VkbHoldAction.ToggleLayer, false }
            };

            while (isActive())
            {
                if (ownsDesktopVkb && _desktopVkb == null)
                    ownsDesktopVkb = false;

                // A session that opened the C# VKB keeps exclusive controller
                // ownership while it is visible, even if the overlay temporarily
                // changes the underlying store/app mouse or focus state.
                bool acceptsInputNow = ownsDesktopVkb || (shouldAcceptInput?.Invoke() ?? true);
                if (acceptsInputNow && aDoubleClickPending && (DateTime.Now - lastAReleaseTime).TotalMilliseconds > 300)
                {
                    aDoubleClickPending = false;
                    bool vkbAlreadyExisted = _desktopVkb != null;
                    OpenMediaExeVkb(autoPositioned: true);
                    if (!vkbAlreadyExisted && _desktopVkb != null)
                        ownsDesktopVkb = true;
                }

                try
                {
                    double dt = sw.Elapsed.TotalSeconds;
                    sw.Restart();
                    // Preserve elapsed time when a slow launcher stalls this thread.
                    // Replacing a long frame with 16 ms made the pointer appear to
                    // freeze exactly while stores were doing their heaviest work.
                    dt = Math.Clamp(dt, 0, 0.05);

                    bool anyMouseShortcut = false;
                    bool anyReturnShortcut = false;

                    bool vkbIsOpen = _desktopVkb != null;
                    bool customProfileOwnsDefaultButtons = !vkbIsOpen &&
                        GetCustomAssignedRuntimeControlProfile(GetActiveControlTargetKey()) != null;
                    bool configuredRuntimeOwnsAnalog = !vkbIsOpen &&
                        ConfiguredControlRuntimeOwnsAnalog(GetActiveControlTargetKey());
                    bool anyVkbUp = false, anyVkbDown = false, anyVkbLeft = false, anyVkbRight = false, anyVkbToggleLayer = false;

                    bool anyAPressed = false, anyAReleased = false;
                    bool anyBPressed = false, anyBReleased = false;
                    bool anyXPressed = false, anyXReleased = false;
                    bool anyYPressed = false;
                    bool anyStartPressed = false, anyL3Pressed = false;
                    bool anyLBPressed = false, anyRBPressed = false;

                    double totalMlx = 0, totalMly = 0, totalScrollY = 0;

                    var input = inputProvider?.Invoke() ?? GetUnifiedControllerInput();
                    ushort btn = input.Buttons;
                    buttonTracker.Update(input.Source ?? XInputControllerHub.Read());
                    if (buttonTracker.TaskSwitcherShortcutJustPressed ||
                        Volatile.Read(ref _nativeTaskSwitcherActive) == 1)
                    {
                        if (isClicking)
                        {
                            SendMouse(0, 0, 0x0004);
                            isClicking = false;
                        }
                        Thread.Sleep(8);
                        continue;
                    }
                    bool Pressed(ushort m) => buttonTracker.AnyPressed(m);
                    bool Released(ushort m) => buttonTracker.ReleasedGlobally(m);

                    anyMouseShortcut = mouseModeShortcutPredicate != null
                        ? buttonTracker.AnyPredicateJustPressed(mouseModeShortcutPredicate)
                        : buttonTracker.MouseModeShortcutJustPressed;
                    anyReturnShortcut = handleXboxButton && buttonTracker.ReturnShortcutJustPressed;

                    anyAPressed = Pressed(XI_A);
                    anyAReleased = Released(XI_A);
                    anyBPressed = Pressed(XI_B);
                    anyBReleased = Released(XI_B);
                    anyXPressed = Pressed(XI_X);
                    anyXReleased = Released(XI_X);
                    anyYPressed = Pressed(XI_Y);
                    anyStartPressed = Pressed(XI_START);
                    anyL3Pressed = Pressed(XI_L3);
                    anyLBPressed = Pressed(XI_L1);
                    anyRBPressed = Pressed(XI_R1);

                    if (vkbIsOpen)
                    {
                        // Keep enough margin for stick drift, but accept virtual/remote
                        // controllers (Steam Input, Parsec, etc.) that may not expose
                        // the full [-1, 1] axis range.
                        const double DEAD = 0.45;
                        if ((btn & XI_DPAD_UP) != 0) anyVkbUp = true;
                        else if ((btn & XI_DPAD_DOWN) != 0) anyVkbDown = true;
                        else if ((btn & XI_DPAD_LEFT) != 0) anyVkbLeft = true;
                        else if ((btn & XI_DPAD_RIGHT) != 0) anyVkbRight = true;
                        else if (input.ThumbLY > DEAD) anyVkbUp = true;
                        else if (input.ThumbLY < -DEAD) anyVkbDown = true;
                        else if (input.ThumbLX < -DEAD) anyVkbLeft = true;
                        else if (input.ThumbLX > DEAD) anyVkbRight = true;
                        anyVkbToggleLayer = input.LeftTrigger;

                        bool curX = (btn & XI_X) != 0;
                        if (anyXPressed)
                        {
                            isHoldingX = true; xPressTime = DateTime.Now;
                            SendVirtualKey(0x08); lastBackspaceFired = DateTime.Now;
                        }
                        else if (curX && isHoldingX && (DateTime.Now - xPressTime).TotalMilliseconds > 450 && (DateTime.Now - lastBackspaceFired).TotalMilliseconds > 40)
                        {
                            SendVirtualKey(0x08); lastBackspaceFired = DateTime.Now;
                        }
                        else if (!curX && isHoldingX) isHoldingX = false;
                    }
                    else
                    {
                        if (!configuredRuntimeOwnsAnalog)
                        {
                            double configuredMouseDeadZone = GetActiveControlMouseDeadZone(0.15);
                            if (Math.Sqrt(input.ThumbLX * input.ThumbLX + input.ThumbLY * input.ThumbLY) > configuredMouseDeadZone)
                            {
                                totalMlx = input.ThumbLX;
                                totalMly = input.ThumbLY;
                            }
                            if (Math.Abs(input.ThumbRY) > configuredMouseDeadZone) totalScrollY = input.ThumbRY;
                        }
                    }

                    if (!isActive()) break;

                    bool acceptsMouseShortcut = shouldAcceptMouseModeShortcut?.Invoke() ?? acceptsInputNow;
                    if (onMouseModeShortcut != null && anyMouseShortcut && acceptsMouseShortcut)
                    {
                        onMouseModeShortcut.Invoke();
                        Thread.Sleep(120);
                        continue;
                    }

                    if (anyReturnShortcut)
                    {
                        onExitCombo?.Invoke();
                        if (!isActive()) break;
                        Thread.Sleep(10);
                        continue;
                    }

                    if (!acceptsInputNow)
                    {
                        if (isClicking)
                        {
                            SendMouse(0, 0, 0x0004);
                            isClicking = false;
                        }
                        aDoubleClickPending = false;
                        Thread.Sleep(8);
                        continue;
                    }

                    if (vkbIsOpen)
                    {
                        void HandleHold(bool isDown, VkbHoldAction action)
                        {
                            bool wasDown = prevAnalogActive[action];
                            if (isDown && !wasDown) Dispatcher.Invoke(() => _desktopVkb?.BeginHold(action));
                            else if (!isDown && wasDown) Dispatcher.Invoke(() => _desktopVkb?.EndHold(action));
                            prevAnalogActive[action] = isDown;
                        }

                        HandleHold(anyVkbUp, VkbHoldAction.MoveUp);
                        HandleHold(anyVkbDown, VkbHoldAction.MoveDown);
                        HandleHold(anyVkbLeft, VkbHoldAction.MoveLeft);
                        HandleHold(anyVkbRight, VkbHoldAction.MoveRight);
                        HandleHold(false, VkbHoldAction.CursorLeft);
                        HandleHold(false, VkbHoldAction.CursorRight);
                        HandleHold(anyVkbToggleLayer, VkbHoldAction.ToggleLayer);

                        if (anyAPressed) Dispatcher.Invoke(() => _desktopVkb?.BeginHold(VkbHoldAction.Press));
                        if (anyAReleased) Dispatcher.Invoke(() => _desktopVkb?.EndHold(VkbHoldAction.Press));

                        if (anyBPressed)
                        {
                            Dispatcher.Invoke(() => { _desktopVkb?.Close(); _desktopVkb = null; });
                            ignoreNextBRelease = true;
                        }

                        if (anyYPressed) SendUnicodeString(" ");
                        if (anyStartPressed) SendVirtualKey(0x0D);
                        if (anyL3Pressed) Dispatcher.Invoke(() => _desktopVkb?.ToggleShift());
                    }
                    else
                    {
                        if (totalScrollY != 0)
                        {
                            int scroll = (int)(totalScrollY * 3000 * GetActiveControlScrollSensitivity() * dt);
                            if (scroll != 0) SendMouse(0, 0, 0x0800, (uint)scroll);
                        }

                        if (!customProfileOwnsDefaultButtons && anyAPressed)
                        {
                            aWasOnTextField = IsCursorOnTextField();
                            aDragOccurred = false; isClicking = true;
                            clickAccumX = 0; clickAccumY = 0; dragBrokeThreshold = false;
                            SendMouse(0, 0, 0x0002);
                            if (instantPrimaryClick)
                            {
                                SendMouse(0, 0, 0x0004);
                                isClicking = false;
                                if (aWasOnTextField && IsCursorOnTextField())
                                {
                                    aDoubleClickPending = true;
                                    lastAReleaseTime = DateTime.Now;
                                }
                                aWasOnTextField = false;
                                aDragOccurred = false;
                            }
                        }

                        double mag = Math.Sqrt(totalMlx * totalMlx + totalMly * totalMly);
                        if (mag > 1.0) { totalMlx /= mag; totalMly /= mag; }

                        if (totalMlx != 0 || totalMly != 0)
                        {
                            double baseSensitivity = CONTROLLER_NATIVE_MOUSE_BASE_SPEED *
                                                     CONTROLLER_MOUSE_SENSITIVITY_SCALE *
                                                     GetActiveControlMouseSensitivity();
                            TryShapeControllerPointerVector(totalMlx, totalMly, 0, out double curvedX, out double curvedY);
                            double mx = curvedX * baseSensitivity * dt + remainderX;
                            double my = -curvedY * baseSensitivity * dt + remainderY;
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
                                    SendMouse((int)clickAccumX, (int)clickAccumY, MOUSEEVENTF_MOVE | MOUSEEVENTF_MOVE_NOCOALESCE);
                                    }
                                }
                                else
                                {
                                    if (isClicking) aDragOccurred = true;
                                    uint moveFlags = MOUSEEVENTF_MOVE;
                                    if (isClicking)
                                        moveFlags |= MOUSEEVENTF_MOVE_NOCOALESCE;
                                    SendMouse(dx, dy, moveFlags);
                                }
                            }
                        }
                        else { remainderX = 0; remainderY = 0; }

                        if (!customProfileOwnsDefaultButtons && anyAReleased)
                        {
                            isClicking = false;
                            SendMouse(0, 0, 0x0004);

                            if (aWasOnTextField && !aDragOccurred && IsCursorOnTextField())
                            {
                                if (aDoubleClickPending && (DateTime.Now - lastAReleaseTime).TotalMilliseconds <= 300)
                                {
                                    aDoubleClickPending = false;
                                    Task.Run(async () => {
                                        await Task.Delay(100);
                                        SendMouse(0, 0, 0x0008);
                                        SendMouse(0, 0, 0x0010);
                                    });
                                }
                                else
                                {
                                    aDoubleClickPending = true;
                                    lastAReleaseTime = DateTime.Now;
                                }
                            }
                            aWasOnTextField = false; aDragOccurred = false;
                        }

                        if (ignoreNextBRelease)
                        {
                            // The press that closed the C# VKB owns the whole B cycle.
                            // Keep suppressing while B is held and consume its release,
                            // otherwise the release is emitted as MB4 and navigates back.
                            if ((btn & XI_B) == 0)
                                ignoreNextBRelease = false;
                        }
                        else if (!customProfileOwnsDefaultButtons)
                        {
                            if (anyBPressed) SendMouse(0, 0, 0x0080, 0x0001);
                            if (anyBReleased) SendMouse(0, 0, 0x0100, 0x0001);
                        }

                        if (instantPrimaryClick && anyStartPressed) SendVirtualKey(0x0D);
                        if (!customProfileOwnsDefaultButtons && anyXPressed) SendMouse(0, 0, 0x0008);
                        if (!customProfileOwnsDefaultButtons && anyXReleased) SendMouse(0, 0, 0x0010);
                        if (anyYPressed)
                        {
                            bool vkbAlreadyExisted = _desktopVkb != null;
                            OpenMediaExeVkb(autoPositioned: false);
                            if (!vkbAlreadyExisted && _desktopVkb != null)
                                ownsDesktopVkb = true;
                        }
                        if (anyLBPressed) SendVirtualKey(0x25);
                        if (anyRBPressed) SendVirtualKey(0x27);
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[SharedGamepadLoop] {ex.Message}"); }

                // XInputControllerHub publishes a new snapshot every 8 ms. Running
                // this loop at 1 ms only reprocessed the same state and competed
                // with store launchers on slower CPUs.
                Thread.Sleep(8);
            }

            if (isClicking) SendMouse(0, 0, 0x0004);
        }

        private void MediaExeControllerLoop(int sessionId)
        {
            SharedGamepadControllerLoop(
                () => IsMediaExeLogicalSessionActive(sessionId),
                () =>
                {
                    ReturnToDoorpiFromMediaExeSession(sessionId);
                },
                handleXboxButton: false,
                shouldAcceptInput: () =>
                {
                    var current = GetExecutableAppSessionBySessionId(sessionId);
                    return IsActiveExecutableAppSession(current) &&
                           current!.MouseModeActive &&
                           !current.MouseInputTemporarilyDisabled;
                }
            );

            var session = GetExecutableAppSessionBySessionId(sessionId);
            if (session != null)
                session.ControllerActive = false;
        }

        private static bool ShouldStartMouseMode(MediaAppModel? media)
            => media?.DisableGamepadControl != true;

        private void InitializeMediaExeMouseModeForSession(MediaAppModel? media)
        {
            var session = ActiveExecutableAppSession;
            if (session != null)
                InitializeMediaExeMouseModeForSession(session, media);
        }

        private static void InitializeMediaExeMouseModeForSession(ExecutableAppSession session, MediaAppModel? media)
        {
            if (session.MouseModeInitialized) return;

            session.MouseModeRequested = ShouldStartMouseMode(media);
            session.MouseModeInitialized = true;
        }

        private void StartMediaExeMouseModeForSession(int sessionId, bool centerCursor)
        {
            var session = GetExecutableAppSessionBySessionId(sessionId);
            if (!IsActiveExecutableAppSession(session)) return;

            if (!IsMediaExeLogicalSessionActive(sessionId))
                return;

            session!.MouseModeRequested = true;
            session.MouseModeInitialized = true;
            session.GamepadDisabled = false;
            session.MouseInputTemporarilyDisabled = false;

            Dispatcher.Invoke(() =>
            {
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
                if (centerCursor) CenterCursorOnScreen();
                UpdateHoverStateInWebView();
            });

            session.MouseModeActive = true;
            EnsureMediaExeControllerThread(sessionId);
            SendRuntimeSessionsToUI();
        }

        private bool IsMediaExeLogicalSessionActive(int sessionId)
        {
            var session = GetExecutableAppSessionBySessionId(sessionId);
            return session != null &&
                   IsActiveExecutableAppSession(session) &&
                   !string.IsNullOrWhiteSpace(session.Url);
        }

        private void EnsureMediaExeControllerThread(int sessionId)
        {
            var session = GetExecutableAppSessionBySessionId(sessionId);
            if (session == null || !IsActiveExecutableAppSession(session))
                return;

            if (session.ControllerThread?.IsAlive == true &&
                session.ControllerThreadSessionId == sessionId)
                return;

            session.ControllerActive = true;
            session.ControllerThreadSessionId = sessionId;
            session.ControllerThread = new Thread(() => MediaExeControllerLoop(sessionId))
            {
                IsBackground = true
            };
            session.ControllerThread.Start();
        }

        private void StopMediaExeMouseModeForSession(int sessionId)
        {
            var session = GetExecutableAppSessionBySessionId(sessionId);
            if (!IsActiveExecutableAppSession(session)) return;

            session!.MouseModeInitialized = true;
            session.MouseInputTemporarilyDisabled = true;

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
            Interlocked.Exchange(ref _mediaExeMouseModeShortcutSuppressUntilTicks,
                DateTime.UtcNow.AddMilliseconds(650).Ticks);

            var session = GetExecutableAppSessionBySessionId(sessionId);
            if (!IsActiveExecutableAppSession(session)) return;

            if (!session!.MouseInputTemporarilyDisabled && session.MouseModeActive)
                StopMediaExeMouseModeForSession(sessionId);
            else
                StartMediaExeMouseModeForSession(sessionId, centerCursor: true);
        }

        private void ReturnToDoorpiFromMediaExeSession(int sessionId)
        {
            var executableSession = GetExecutableAppSessionBySessionId(sessionId);
            if (!IsActiveExecutableAppSession(executableSession)) return;

            bool closeProcessOnReturn = executableSession!.CloseProcessOnReturn;
            string capturedUrl = executableSession.Url;
            var capturedProcess = executableSession.Process;

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

            if (vkbWasOpen && !closeProcessOnReturn)
                return;

            executableSession.MouseModeActive = false;
            executableSession.MouseInputTemporarilyDisabled = false;
            executableSession.ControllerActive = false;
            executableSession.DoorpiSuspended = true;
            executableSession.WatcherCts?.Cancel();
            SuspendExecutionLockWatch();

            if (_isStoreLauncherSession)
            {
                _storePausedByDoorpi = true;
                _storeMouseModeActive = false;
                _storeMouseInputTemporarilyDisabled = false;
            }

            EnsureCursorHidden();
            _mainScreenMouseVisible = false;
            _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
            try { SetCursorPos(0, 0); } catch { }

            Interlocked.Exchange(ref _returnFromExternalModeSuppressUntil, DateTime.UtcNow.AddMilliseconds(350).Ticks);

            var process = FindAliveMediaExeProcess(capturedUrl, capturedProcess);
            if (closeProcessOnReturn)
            {
                try { KillMediaExeProcessTree(capturedUrl, process ?? capturedProcess); } catch { }
                ClearExecutionLock();
                ClearExecutableAppSession(executableSession);
            }
            else if (process != null && !SafeHasExited(process))
            {
                try { MinimizeProcessWindows(process); }
                catch
                {
                    IntPtr hwnd = FindVisibleWindowForProcess(process.Id);
                    if (hwnd != IntPtr.Zero) ShowWindow(hwnd, 6);
                }
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
        }

        private void MediaExeShortcutLoop(int sessionId)
        {
            var buttonTracker = new XInputButtonTracker();
            var initialInput = GetUnifiedControllerInput();
            buttonTracker.Update(initialInput.Source ?? XInputControllerHub.Read());

            DateTime nextProcessCheckUtc = DateTime.MinValue;

            while (IsMediaExeLogicalSessionActive(sessionId))
            {
                try
                {
                    var input = GetUnifiedControllerInput();
                    buttonTracker.Update(input.Source ?? XInputControllerHub.Read());
                    bool anyReturnShortcut = buttonTracker.ReturnShortcutJustPressed;
                    bool anyMouseShortcut = buttonTracker.MouseModeShortcutJustPressed;

                    if (anyReturnShortcut)
                    {
                        ReturnToDoorpiFromMediaExeSession(sessionId);
                        Thread.Sleep(100);
                        continue;
                    }

                    if (anyMouseShortcut &&
                        GetExecutableAppSessionBySessionId(sessionId)?.AllowControllerInput == true &&
                        DateTime.UtcNow.Ticks >= Interlocked.Read(ref _mediaExeMouseModeShortcutSuppressUntilTicks) &&
                        IsForegroundOwnedByActiveMediaExe())
                    {
                        ToggleMediaExeMouseModeForSession(sessionId);
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[MediaExeShortcutLoop] {ex.Message}"); }

                Thread.Sleep(8);
            }
        }

        private void EnsureMediaExeShortcutThread(int sessionId)
        {
            var session = GetExecutableAppSessionBySessionId(sessionId);
            if (session == null || !IsActiveExecutableAppSession(session))
                return;

            if (session.ShortcutThread?.IsAlive == true &&
                session.ShortcutThreadSessionId == sessionId)
                return;

            session.ShortcutThreadSessionId = sessionId;
            session.ShortcutThread = new Thread(() => MediaExeShortcutLoop(sessionId)) { IsBackground = true };
            session.ShortcutThread.Start();
        }

        private void StoreLauncherShortcutLoop(int sessionId)
        {
            var buttonTracker = new XInputButtonTracker();
            var initialInput = GetUnifiedControllerInput();
            buttonTracker.Update(initialInput.Source ?? XInputControllerHub.Read());

            while (IsStoreShortcutSessionActive(sessionId))
            {
                try
                {
                    var input = GetUnifiedControllerInput();
                    buttonTracker.Update(input.Source ?? XInputControllerHub.Read());
                    bool anyReturnShortcut = buttonTracker.ReturnShortcutJustPressed;
                    bool anyMouseShortcut = buttonTracker.MouseModeShortcutJustPressed;

                    if (anyReturnShortcut)
                    {
                        bool minimized = false;
                        Dispatcher.Invoke(() =>
                        {
                            if (CanMinimizeStoreSession())
                            {
                                MinimizeStoreSessionAndShowMenu();
                                minimized = true;
                            }
                        });
                        if (minimized)
                            break;
                    }

                    if (anyMouseShortcut &&
                        DateTime.UtcNow.Ticks >= Interlocked.Read(ref _storeMouseModeShortcutSuppressUntilTicks) &&
                        IsStoreControllerContextActive(sessionId))
                    {
                        ToggleStoreMouseModeForSession(sessionId);
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[StoreShortcutLoop] {ex.Message}"); }

                Thread.Sleep(10);
            }
        }

        private void EnsureStoreShortcutThread(int sessionId)
        {
            if (!IsStoreShortcutSessionActive(sessionId))
                return;

            if (_storeShortcutThread?.IsAlive == true &&
                _storeShortcutThreadSessionId == sessionId)
                return;

            _storeShortcutThreadSessionId = sessionId;
            _storeShortcutThread = new Thread(() => StoreLauncherShortcutLoop(sessionId)) { IsBackground = true };
            _storeShortcutThread.Start();
        }

        private bool IsStoreShortcutSessionActive(int sessionId)
        {
            return _isStoreLauncherSession &&
                   !_storePausedByDoorpi &&
                   _storeSessionId == sessionId;
        }

        private bool IsStoreLogicalSessionActive(int sessionId)
        {
            return _isStoreLauncherSession &&
                   !_storePausedByDoorpi &&
                   !IsStoreChildGameBlockingStoreControls() &&
                   _storeSessionId == sessionId;
        }

        private bool IsStoreControllerContextActive(int sessionId)
        {
            // Lojas podem abrir autenticação, checkout ou suporte em outro
            // processo. A sessão lógica continua dona do controle nessas janelas;
            // o Doorpi e jogos filhos permanecem fronteiras explícitas.
            return IsStoreLogicalSessionActive(sessionId) && !IsForegroundDoorpi();
        }

        private void EnsureStoreControllerThread(int sessionId)
        {
            if (!IsStoreLogicalSessionActive(sessionId))
                return;

            if (_storeControllerThread?.IsAlive == true &&
                _storeControllerThreadSessionId == sessionId)
                return;

            _storeControllerThreadSessionId = sessionId;
            _storeControllerThread = new Thread(() => StoreExeControllerLoop(sessionId)) { IsBackground = true };
            _storeControllerThread.Start();
        }

        private void StartStoreMouseModeForSession(int sessionId, bool centerCursor)
        {
            if (!IsStoreLogicalSessionActive(sessionId))
            {
                return;
            }

            _mainUiOwnsDirectionalNavigation = false;
            _storeMouseModeRequested = true;
            _storeGamepadDisabled = false;
            _storeMouseModeActive = true;
            _storeMouseInputTemporarilyDisabled = false;
            Dispatcher.Invoke(() =>
            {
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
                if (centerCursor) CenterCursorOnScreen();
                UpdateHoverStateInWebView();
            });

            EnsureStoreShortcutThread(sessionId);
            EnsureStoreControllerThread(sessionId);
            SendRuntimeSessionsToUI();
        }

        private void StopStoreMouseModeForSession(int sessionId)
        {
            if (_storeSessionId != sessionId || !_isStoreLauncherSession)
                return;

            _storeMouseInputTemporarilyDisabled = true;

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

        private void BeginSteamAccountSelectionInput(string steamExe)
        {
            _steamAccountSelectionWindowGuardActive = true;

            bool canOwnStoreSession =
                !_isStoreLauncherSession ||
                string.Equals(_activeStoreId, "Steam", StringComparison.OrdinalIgnoreCase);
            if (!canOwnStoreSession)
                return;

            if (!_isStoreLauncherSession)
            {
                _steamAccountSelectionStoreSessionActive = true;
                _isStoreLauncherSession = true;
                _storePausedByDoorpi = false;
                _activeStoreId = "Steam";
                _storeSessionKind = "exe";
                _storeLauncherExe = steamExe;
                _storeMouseModeInitialized = true;
                _storeLauncherWindowSeen = true;
                _storeTrayCloseInProgress = false;
                _storeTransitionOverlayActive = false;
                _storeProcessSnapshot = SnapshotProcessIds();
                _storeProcessGroupIds = new();
                _storeAttachedProcessIds = new();
                _storeAttachedWindowHandles = new();
                _storeWindowSnapshot = SnapshotVisibleWindows();
            }
            else
            {
                _steamAccountSelectionStoreSessionActive = false;
                if (string.IsNullOrWhiteSpace(_storeLauncherExe))
                    _storeLauncherExe = steamExe;
            }

            try
            {
                _storeLauncherProcess = FindSteamClientProcess(steamExe);
                if (_storeLauncherProcess != null)
                    InitializeStoreLauncherProcessGroup(_storeLauncherProcess);
            }
            catch { }

            int sessionId = Interlocked.Increment(ref _storeSessionId);
            _steamAccountSelectionControlsActive = true;
            _storeMouseModeRequested = true;
            _storeMouseModeActive = true;
            _storeGamepadDisabled = false;
            _storeMouseInputTemporarilyDisabled = false;

            Dispatcher.Invoke(() =>
            {
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
                CenterCursorOnScreen();
                UpdateHoverStateInWebView();
            });

            EnsureStoreShortcutThread(sessionId);
            EnsureStoreControllerThread(sessionId);
            SendRuntimeSessionsToUI();
        }

        private void StopSteamAccountSelectionControlsForGame()
        {
            if (!_steamAccountSelectionControlsActive && !_steamAccountSelectionStoreSessionActive)
                return;

            _steamAccountSelectionControlsActive = false;
            _storeMouseModeRequested = false;
            _storeMouseModeActive = false;
            _storeGamepadDisabled = true;
            _storeMouseInputTemporarilyDisabled = false;
            Interlocked.Increment(ref _storeSessionId);

            Dispatcher.Invoke(() =>
            {
                _desktopVkb?.Close();
                _desktopVkb = null;
                EnsureCursorHidden();
                _mainScreenMouseVisible = false;
                _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                try { SetCursorPos(0, 0); } catch { }
            });

            if (_steamAccountSelectionStoreSessionActive)
            {
                _steamAccountSelectionStoreSessionActive = false;
                _isStoreLauncherSession = false;
                _storePausedByDoorpi = false;
                _storeLauncherExe = null;
                _storeSessionKind = "";
                _activeStoreId = null;
                _storeLauncherProcess = null;
                _storeMouseModeInitialized = false;
                _storeMinimizeState = StoreMinimizeState.Opening;
                _storeLauncherWindowSeen = false;
                _storeProcessSnapshot = new();
                _storeProcessGroupIds = new();
                _storeAttachedProcessIds = new();
                _storeAttachedWindowHandles = new();
                ClearStorePendingChildWindows();
                _storeWindowSnapshot = new();
            }

            SendRuntimeSessionsToUI();
        }

        private void ResetSteamAccountSelectionInputState()
        {
            _steamAccountSelectionWindowGuardActive = false;
            StopSteamAccountSelectionControlsForGame();
        }

        private void ToggleStoreMouseModeForSession(int sessionId)
        {
            Interlocked.Exchange(ref _storeMouseModeShortcutSuppressUntilTicks,
                DateTime.UtcNow.AddMilliseconds(650).Ticks);

            if (!_storeMouseInputTemporarilyDisabled && _storeMouseModeActive)
                StopStoreMouseModeForSession(sessionId);
            else
                StartStoreMouseModeForSession(sessionId, centerCursor: true);
        }

        private bool ShouldStartMouseModeForStoreLaunch(string storeId)
        {
            try
            {
                var store = LoadStoreLaunchers().FirstOrDefault(s =>
                    string.Equals(s.Id, storeId, StringComparison.OrdinalIgnoreCase));
                return ShouldStartMouseMode(store);
            }
            catch { return false; }
        }

        private bool TryFindLaunchStoreWindow(string storeId, out Process process, out IntPtr hwnd)
        {
            process = null!;
            hwnd = IntPtr.Zero;

            if (string.IsNullOrWhiteSpace(storeId))
                return false;

            string? exe = ResolveStoreLauncherExe(storeId);
            if (string.IsNullOrWhiteSpace(exe) && !storeId.Equals("Riot", StringComparison.OrdinalIgnoreCase))
                return false;

            return TryFindStoreWindow(storeId, exe ?? "", out process, out hwnd);
        }

        private bool TryFindLaunchStoreInteractiveWindow(string storeId, out Process process, out IntPtr hwnd)
        {
            process = null!;
            hwnd = IntPtr.Zero;

            if (string.IsNullOrWhiteSpace(storeId))
                return false;

            if (string.Equals(storeId, "Steam", StringComparison.OrdinalIgnoreCase))
                return TryFindSteamInteractiveWindow(out process, out hwnd) ||
                       TryFindSteamWindow(out process, out hwnd);

            if (string.Equals(storeId, "GOG", StringComparison.OrdinalIgnoreCase))
            {
                string exe = ResolveStoreLauncherExe(storeId) ?? "";
                return TryFindGogInteractiveWindow(out process, out hwnd) ||
                       TryFindGogWindow(exe, out process, out hwnd);
            }

            if (IsEpicStoreId(storeId))
            {
                string exe = ResolveStoreLauncherExe(storeId) ?? "";
                return !string.IsNullOrWhiteSpace(exe) &&
                       TryFindEpicWindow(exe, out process, out hwnd);
            }

            if (string.Equals(storeId, "Xbox", StringComparison.OrdinalIgnoreCase))
            {
                string exe = ResolveStoreLauncherExe(storeId) ?? "";
                return TryFindXboxStoreWindow(exe, out process, out hwnd);
            }

            return TryFindLaunchStoreWindow(storeId, out process, out hwnd);
        }

        private bool IsForegroundOwnedByLaunchStoreWindow(string storeId)
        {
            try
            {
                if (!TryFindLaunchStoreWindow(storeId, out var storeProcess, out var storeHwnd))
                    return false;

                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero)
                    return false;

                if (foreground == storeHwnd)
                    return true;

                GetWindowProcessId(foreground, out uint pidRaw);
                return pidRaw != 0 && pidRaw == (uint)storeProcess.Id;
            }
            catch { return false; }
        }

        private bool IsForegroundOwnedByGameLaunchStoreMouseTarget()
        {
            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero)
                    return false;

                if (_gameLaunchStoreMouseModeHwnd != IntPtr.Zero &&
                    foreground == _gameLaunchStoreMouseModeHwnd)
                {
                    return true;
                }

                if (_gameLaunchStoreMouseModeProcessId <= 0)
                    return false;

                GetWindowProcessId(foreground, out uint pidRaw);
                return pidRaw != 0 && (int)pidRaw == _gameLaunchStoreMouseModeProcessId;
            }
            catch { return false; }
        }

        private void StartGameLaunchStoreMouseMode(string storeId, IntPtr hwnd, bool force = false)
        {
            if (!force && !ShouldStartMouseModeForStoreLaunch(storeId))
                return;

            if (_gameLaunchStoreMouseModeActive &&
                string.Equals(_gameLaunchStoreMouseModeStoreId, storeId, StringComparison.OrdinalIgnoreCase))
            {
                SetGameLaunchStoreMouseModeTarget(hwnd);
                return;
            }

            StopGameLaunchStoreMouseMode(hideCursor: false);

            int sessionId = Interlocked.Increment(ref _gameLaunchStoreMouseModeSessionId);
            _gameLaunchStoreMouseModeStoreId = storeId;
            _gameLaunchStoreMouseModeActive = true;
            SetGameLaunchStoreMouseModeTarget(hwnd);

            Dispatcher.Invoke(() =>
            {
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
                if (hwnd != IntPtr.Zero) CenterCursorOnScreen();
                UpdateHoverStateInWebView();
            });

            _gameLaunchStoreMouseModeThread = new Thread(() =>
                SharedGamepadControllerLoop(
                    () => _gameLaunchStoreMouseModeActive &&
                          _gameLaunchStoreMouseModeSessionId == sessionId &&
                          _gameSessionActive &&
                          string.IsNullOrWhiteSpace(_lockedGameProcessName),
                    () => { },
                    handleXboxButton: false,
                    shouldAcceptInput: IsForegroundOwnedByGameLaunchStoreMouseTarget))
            {
                IsBackground = true
            };
            _gameLaunchStoreMouseModeThread.Start();
        }

        private void SetGameLaunchStoreMouseModeTarget(IntPtr hwnd)
        {
            _gameLaunchStoreMouseModeHwnd = hwnd;
            _gameLaunchStoreMouseModeProcessId = 0;

            if (hwnd == IntPtr.Zero)
                return;

            try
            {
                GetWindowProcessId(hwnd, out uint pidRaw);
                if (pidRaw != 0)
                    _gameLaunchStoreMouseModeProcessId = (int)pidRaw;
            }
            catch { }
        }

        private void StopGameLaunchStoreMouseMode(bool hideCursor = true)
        {
            if (!_gameLaunchStoreMouseModeActive && string.IsNullOrWhiteSpace(_gameLaunchStoreMouseModeStoreId))
                return;

            _gameLaunchStoreMouseModeActive = false;
            _gameLaunchStoreMouseModeStoreId = "";
            _gameLaunchStoreMouseModeHwnd = IntPtr.Zero;
            _gameLaunchStoreMouseModeProcessId = 0;
            Interlocked.Increment(ref _gameLaunchStoreMouseModeSessionId);

            if (!hideCursor)
                return;

            Dispatcher.Invoke(() =>
            {
                _desktopVkb?.Close();
                _desktopVkb = null;
                EnsureCursorHidden();
                _mainScreenMouseVisible = false;
                _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                try { SetCursorPos(0, 0); } catch { }
            });
        }

        private bool TryActivateLaunchStoreMouseModeForGame(GameModel game)
        {
            string storeId = StorePolicyKeyForGame(game);
            if (string.IsNullOrWhiteSpace(storeId))
                return false;

            if (!TryFindLaunchStoreInteractiveWindow(storeId, out _, out var hwnd))
                return false;

            RestoreAndCenterInteractiveLauncherWindow(hwnd);
            StartGameLaunchStoreMouseMode(storeId, hwnd, force: true);
            return true;
        }

        private void RestoreAndCenterInteractiveLauncherWindow(IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero)
                return;

            ShowWindow(hwnd, 1);

            try
            {
                if (GetWindowRect(hwnd, out RECT rect))
                {
                    int width = Math.Max(320, rect.Width);
                    int height = Math.Max(240, rect.Height);
                    int screenW = (int)SystemParameters.PrimaryScreenWidth;
                    int screenH = (int)SystemParameters.PrimaryScreenHeight;
                    int x = Math.Max(0, (screenW - width) / 2);
                    int y = Math.Max(0, (screenH - height) / 2);
                    SetWindowPos(hwnd, HWND_TOP, x, y, 0, 0, SWP_NOSIZE);
                }
            }
            catch { }

            FocusExternalWindow(hwnd);
        }

        private bool TryActivateDirectRiotClientInputForGame(GameModel game)
        {
            if (!IsDirectRiotGameLaunch(game) ||
                !string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (_gameLaunchStoreMouseModeActive &&
                string.Equals(_gameLaunchStoreMouseModeStoreId, "Riot", StringComparison.OrdinalIgnoreCase))
            {
                if (_gameLaunchStoreMouseModeHwnd != IntPtr.Zero &&
                    IsWindow(_gameLaunchStoreMouseModeHwnd))
                {
                    return true;
                }

                StopGameLaunchStoreMouseMode(hideCursor: false);
            }

            if (!TryFindRiotWindow(out _, out var hwnd))
                return false;

            RestoreAndCenterInteractiveLauncherWindow(hwnd);
            StartGameLaunchStoreMouseMode("Riot", hwnd, force: true);
            return true;
        }

        private void StoreExeControllerLoop(int sessionId)
        {
            bool StoreCanReceiveMouseInput()
            {
                return _storeMouseModeActive &&
                       !_storeMouseInputTemporarilyDisabled &&
                       IsStoreControllerContextActive(sessionId);
            }

            SharedGamepadControllerLoop(
                () => IsStoreLogicalSessionActive(sessionId),
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
                shouldAcceptInput: StoreCanReceiveMouseInput
            );

        }

        private void StartDialogControllerMode()
        {
            if (_dialogModeActive) return;
            int generation = Interlocked.Increment(ref _dialogControllerGeneration);
            _dialogModeActive = true;

            // Garante que o cursor apareÃ§a para o usuÃ¡rio interagir com o dialog
            EnsureCursorVisible();
            _mainScreenMouseVisible = true;

            new Thread(() =>
            {
                SharedGamepadControllerLoop(
                    () => _dialogModeActive &&
                          Volatile.Read(ref _dialogControllerGeneration) == generation,
                    () => SendVirtualKey(0x1B),
                    instantPrimaryClick: true,
                    inputProvider: GetNativeDialogControllerInput
                );
            })
            { IsBackground = true }.Start();
        }

        private long _nativeDialogInputShieldToken;

        private void SetNativeDialogInputShield(bool enabled)
        {
            try { if (webView != null) webView.IsHitTestVisible = !enabled; } catch { }
            try { if (_ytWebView != null) _ytWebView.IsHitTestVisible = !enabled; } catch { }
        }

        private void NotifyNativeDialogReturned(string source = "nativeDialog")
        {
            try
            {
                string payload = JsonSerializer.Serialize(new
                {
                    type = "nativeDialogReturned",
                    source
                });
                webView?.CoreWebView2?.PostWebMessageAsString(payload);
                _ytWebView?.CoreWebView2?.PostWebMessageAsString(payload);
            }
            catch { }
        }

        private void NotifyNativeDialogOpened(string source = "nativeDialog")
        {
            try
            {
                string payload = JsonSerializer.Serialize(new
                {
                    type = "nativeDialogOpened",
                    source
                });
                webView?.CoreWebView2?.PostWebMessageAsString(payload);
                _ytWebView?.CoreWebView2?.PostWebMessageAsString(payload);
            }
            catch { }
        }

        private void BeginNativeDialogInputShield(string source)
        {
            Interlocked.Increment(ref _nativeDialogInputShieldToken);
            SetNativeDialogInputShield(true);
            NotifyNativeDialogOpened(source);
            try
            {
                webView?.CoreWebView2?.ExecuteScriptAsync("try{window._doorpiNativeDialogActive=true;window._doorpiSuppressNativeDialogPointer?.(6000);}catch(e){}");
                _ytWebView?.CoreWebView2?.ExecuteScriptAsync("try{window._doorpiNativeDialogActive=true;window._doorpiSuppressNativeDialogPointer?.(6000);}catch(e){}");
            }
            catch { }
        }

        private void EndNativeDialogInputShield(string source = "nativeDialog")
        {
            long token = Interlocked.Read(ref _nativeDialogInputShieldToken);
            try
            {
                webView?.CoreWebView2?.ExecuteScriptAsync("try{window._doorpiNativeDialogActive=false;}catch(e){}");
                _ytWebView?.CoreWebView2?.ExecuteScriptAsync("try{window._doorpiNativeDialogActive=false;}catch(e){}");
            }
            catch { }
            NotifyNativeDialogReturned(source);

            try
            {
                webView?.Focus();
                if (webView != null) Keyboard.Focus(webView);
            }
            catch { }

            _ = Task.Run(async () =>
            {
                await Task.Delay(650).ConfigureAwait(false);
                Dispatcher.Invoke(() =>
                {
                    if (Interlocked.Read(ref _nativeDialogInputShieldToken) != token)
                        return;
                    SetNativeDialogInputShield(false);
                });
            });
        }

        private void CenterOwnedDialogSoon()
        {
            Task.Run(async () =>
            {
                for (int i = 0; i < 12 && _dialogModeActive; i++)
                {
                    await Task.Delay(80).ConfigureAwait(false);
                    if (!_dialogModeActive) return;
                    if (TryCenterOwnedCommonDialog())
                        return;
                }
            });
        }

        private bool TryCenterOwnedCommonDialog()
        {
            IntPtr dialogHwnd = FindOwnedCommonDialogWindow();
            if (dialogHwnd == IntPtr.Zero || !GetWindowRect(dialogHwnd, out RECT rect))
                return false;

            int width = Math.Max(420, rect.Width);
            int height = Math.Max(260, rect.Height);

            int ownerLeft;
            int ownerTop;
            int ownerWidth;
            int ownerHeight;

            try
            {
                var ownerTopLeft = PointToScreen(new Point(0, 0));
                ownerLeft = (int)ownerTopLeft.X;
                ownerTop = (int)ownerTopLeft.Y;
                ownerWidth = (int)(ActualWidth > 0 ? ActualWidth : SystemParameters.PrimaryScreenWidth);
                ownerHeight = (int)(ActualHeight > 0 ? ActualHeight : SystemParameters.PrimaryScreenHeight);
            }
            catch
            {
                ownerLeft = 0;
                ownerTop = 0;
                ownerWidth = (int)SystemParameters.PrimaryScreenWidth;
                ownerHeight = (int)SystemParameters.PrimaryScreenHeight;
            }

            int x = ownerLeft + Math.Max(0, (ownerWidth - width) / 2);
            int y = ownerTop + Math.Max(0, (ownerHeight - height) / 2);

            SetWindowPos(dialogHwnd, HWND_TOP, x, y, 0, 0, SWP_NOSIZE);
            SetCursorPos(x + Math.Min(width - 40, Math.Max(40, width / 2)), y + Math.Min(height - 40, Math.Max(40, height / 2)));
            return true;
        }

        private IntPtr FindOwnedCommonDialogWindow()
        {
            int currentPid = Environment.ProcessId;
            IntPtr found = IntPtr.Zero;

            EnumWindows((hWnd, _) =>
            {
                if (!IsWindowVisible(hWnd)) return true;

                GetWindowProcessId(hWnd, out uint windowPid);
                if ((int)windowPid != currentPid) return true;

                var className = new StringBuilder(128);
                if (GetClassName(hWnd, className, className.Capacity) <= 0) return true;
                if (!string.Equals(className.ToString(), "#32770", StringComparison.Ordinal)) return true;

                if (!GetWindowRect(hWnd, out RECT dialogRect) || dialogRect.Width < 300 || dialogRect.Height < 180)
                    return true;

                found = hWnd;
                return false;
            }, IntPtr.Zero);

            return found;
        }

        private void StopDialogControllerMode()
        {
            if (!_dialogModeActive) return;
            _dialogModeActive = false;
            Interlocked.Increment(ref _dialogControllerGeneration);
            ReleaseMouseButtons();
            Interlocked.Exchange(ref _returnFromExternalModeSuppressUntil,
                DateTime.UtcNow.AddMilliseconds(220).Ticks);

            Dispatcher.Invoke(() => {
                _desktopVkb?.Close();
                _desktopVkb = null;
            });

            // Reesconde o cursor ao voltar pro Doorpi
            ResetCursorForMainScreen();
        }

        // Helper para abrir o VKB sem duplicar cÃ³digo
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

                // SeguranÃ§a mÃ¡xima: ForÃ§a sempre exibir numa posiÃ§Ã£o segura independente de onde foi chamado
                _desktopVkb.SetFixedPosition();
                _desktopVkb.Show();
            });
        }
        // Retorna a primeira janela visÃ­vel de um processo por PID
        private IntPtr FindVisibleWindowForProcess(int pid)
        {
            IntPtr result = IntPtr.Zero;
            EnumWindows((hWnd, _) =>
            {
                GetWindowProcessId(hWnd, out uint wpid);
                if ((int)wpid == pid && IsWindowVisible(hWnd))
                {
                    // Verifica se a janela tem um tÃ­tulo (janelas de sistema/renderizaÃ§Ã£o Electron geralmente nÃ£o tÃªm)
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

        private bool IsValidExternalAppWindow(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero) return false;
            if ((!IsWindowVisible(hWnd) && !IsIconic(hWnd)) || IsWindowCloaked(hWnd)) return false;
            if (!GetWindowRect(hWnd, out RECT rect)) return false;
            if (rect.Width < 240 || rect.Height < 160) return false;

            GetWindowProcessId(hWnd, out uint pidRaw);
            if (pidRaw == 0 || pidRaw == Environment.ProcessId) return false;

            try
            {
                var process = Process.GetProcessById((int)pidRaw);
                string processName = SafeProcessName(process);
                if (_shellProcessNames.Contains(processName)) return false;
                if (_knownLauncherProcessNames.Contains(processName)) return false;
            }
            catch { return false; }

            return true;
        }

        private bool WindowOrProcessMatchesAppName(IntPtr hWnd, Process process, string appName)
        {
            if (string.IsNullOrWhiteSpace(appName)) return false;

            string normalizedAppName = NormalizeGameName(appName);
            if (normalizedAppName.Length < 3) return false;

            string title = GetWindowTitle(hWnd);
            string processName = SafeProcessName(process);
            string processPath = SafeProcessPath(process);
            string fileName = Path.GetFileNameWithoutExtension(processPath);
            string haystack = NormalizeGameName($"{title} {processName} {fileName} {processPath}");

            if (haystack.Contains(normalizedAppName, StringComparison.OrdinalIgnoreCase))
                return true;

            var tokens = appName
                .Split(new[] { ' ', '-', '_', '.', ':', '(', ')', '[', ']' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(NormalizeGameName)
                .Where(t => t.Length >= 3)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            if (tokens.Length == 0) return false;
            int matches = tokens.Count(t => haystack.Contains(t, StringComparison.OrdinalIgnoreCase));
            return matches >= Math.Min(2, tokens.Length);
        }

        private bool TryFindMediaExeWindowCandidate(
            ExecutableAppSession? session,
            string mediaUrl,
            string appName,
            bool allowNewWindowFallback,
            out Process? process,
            out IntPtr hwnd)
        {
            process = null;
            hwnd = IntPtr.Zero;

            var knownProcess = session?.Process;
            foreach (var p in GetMediaExeProcessGroup(mediaUrl, knownProcess)
                         .Concat(EnumerateMediaExeProcesses(mediaUrl, knownProcess))
                         .GroupBy(p =>
                         {
                             try { return p.Id; } catch { return -1; }
                         })
                         .Where(g => g.Key > 0)
                         .Select(g => g.First()))
            {
                try
                {
                    var h = FindVisibleWindowForProcess(p.Id);
                    if (h != IntPtr.Zero)
                    {
                        process = p;
                        hwnd = h;
                        return true;
                    }
                }
                catch { }
            }

            Process? bestNameProcess = null;
            IntPtr bestNameHwnd = IntPtr.Zero;
            foreach (var hWnd in EnumerateTopLevelWindows())
            {
                if (!IsValidExternalAppWindow(hWnd)) continue;

                GetWindowProcessId(hWnd, out uint pidRaw);
                Process candidate;
                try { candidate = Process.GetProcessById((int)pidRaw); }
                catch { continue; }

                if (!WindowOrProcessMatchesAppName(hWnd, candidate, appName))
                {
                    candidate.Dispose();
                    continue;
                }

                bestNameProcess = candidate;
                bestNameHwnd = hWnd;
                break;
            }

            if (bestNameProcess != null && bestNameHwnd != IntPtr.Zero)
            {
                process = bestNameProcess;
                hwnd = bestNameHwnd;
                return true;
            }

            if (allowNewWindowFallback && session != null && session.BaselineProcessCount > 0)
            {
                foreach (var hWnd in EnumerateTopLevelWindows())
                {
                    if (!IsValidExternalAppWindow(hWnd)) continue;

                    GetWindowProcessId(hWnd, out uint pidRaw);
                    int pid = (int)pidRaw;
                    if (session.IsBaselineProcess(pid)) continue;

                    Process candidate;
                    try { candidate = Process.GetProcessById(pid); }
                    catch { continue; }

                    string processName = SafeProcessName(candidate);
                    if (IsStoreAuxiliaryProcessName(processName) || IsProcessActiveStoreLauncher(candidate))
                    {
                        candidate.Dispose();
                        continue;
                    }

                    process = candidate;
                    hwnd = hWnd;
                    return true;
                }
            }

            return false;
        }

        // Varre os processos em execuÃ§Ã£o e retorna o que corresponde ao exePath
        private Process? FindRunningProcessForExe(string exePath)
        {
            if (string.IsNullOrWhiteSpace(exePath) || !File.Exists(exePath)) return null;
            try
            {
                string fullPath = Path.GetFullPath(exePath);
                string name = Path.GetFileNameWithoutExtension(exePath);
                var processes = Process.GetProcessesByName(name);

                // Primeiro tenta achar um processo que corresponda ao caminho exato e tenha janela visÃ­vel
                foreach (var p in processes)
                {
                    try
                    {
                        if (PathsEqual(SafeProcessPath(p), fullPath) && FindVisibleWindowForProcess(p.Id) != IntPtr.Zero)
                            return p;
                    }
                    catch { }
                }

                // Se nÃ£o achou com janela visÃ­vel, retorna qualquer um com o caminho exato
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

        private static string ResolveMediaLaunchCommand(MediaAppModel? media, string urlOrId)
            => !string.IsNullOrWhiteSpace(media?.LaunchCommand)
                ? media!.LaunchCommand.Trim()
                : ResolveMediaExecutableUrl(media, urlOrId);

        private MediaAppModel? FindMediaAppForExecutableSession(string urlOrId)
        {
            var direct = FindMediaAppByUrlOrId(urlOrId);
            if (direct != null) return direct;

            return LoadMediaApps().FirstOrDefault(media =>
            {
                string executable = LaunchCommand.ExecutablePathOrName(media.LaunchCommand);
                return !string.IsNullOrWhiteSpace(executable) &&
                       string.Equals(executable, urlOrId, StringComparison.OrdinalIgnoreCase);
            });
        }

        private static string ResolveMediaExecutablePath(MediaAppModel? media, string urlOrId)
            => LaunchCommand.ExecutablePathOrName(ResolveMediaLaunchCommand(media, urlOrId));

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

        private static bool HasAncestorInGroup(int pid, Dictionary<int, int> parentIds, HashSet<int> groupIds)
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

        private static bool HasAncestorInExecutableGroup(
            int pid,
            Dictionary<int, int> parentIds,
            ExecutableAppSession session)
        {
            var seen = new HashSet<int>();
            int current = pid;

            while (parentIds.TryGetValue(current, out int parentPid) &&
                   parentPid > 0 &&
                   seen.Add(parentPid))
            {
                if (session.ContainsProcessGroupId(parentPid))
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

        private void InitializeMediaExeProcessGroup(
            string mediaUrl,
            Process? rootProcess,
            HashSet<int>? baselineProcessIds = null,
            string? executablePath = null)
        {
            if (string.IsNullOrWhiteSpace(mediaUrl)) return;

            var session = GetOrCreateExecutableAppSession(mediaUrl, activate: false);
            session.ResetProcessTracking(baselineProcessIds ?? SnapshotProcessIds());
            session.ProcessGroupRootDirectory = "";
            session.ProcessGroupExeName = "";
            session.ExecutablePath = executablePath ?? ResolveMediaExecutablePath(FindMediaAppForExecutableSession(mediaUrl), mediaUrl);

            try
            {
                if (File.Exists(session.ExecutablePath))
                {
                    session.ExecutablePath = Path.GetFullPath(session.ExecutablePath);
                    session.ProcessGroupRootDirectory = Path.GetDirectoryName(session.ExecutablePath) ?? "";
                    session.ProcessGroupExeName = Path.GetFileNameWithoutExtension(session.ExecutablePath);
                }
                else if (!string.IsNullOrWhiteSpace(session.ExecutablePath))
                    session.ProcessGroupExeName = Path.GetFileNameWithoutExtension(session.ExecutablePath);
            }
            catch { }

            try
            {
                if (rootProcess != null && !SafeHasExited(rootProcess))
                    session.AddProcessGroupId(rootProcess.Id);
            }
            catch { }

            ExpandMediaExeProcessGroup(session);
        }

        private void ExpandMediaExeProcessGroup(ExecutableAppSession? session)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.Url))
                return;

            if (session.ProcessGroupCount == 0)
            {
                try
                {
                    if (session.Process != null && !SafeHasExited(session.Process))
                        session.AddProcessGroupId(session.Process.Id);
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
                    if (session.ContainsProcessGroupId(pid)) continue;

                    bool isDescendant = HasAncestorInExecutableGroup(pid, parentIds, session);
                    bool isNewRelatedProcess =
                        !session.IsBaselineProcess(pid) &&
                        (ProcessPathBelongsToMediaRoot(process, session.ExecutablePath, session.ProcessGroupRootDirectory) ||
                         (!string.IsNullOrWhiteSpace(session.ProcessGroupExeName) &&
                          string.Equals(SafeProcessName(process), session.ProcessGroupExeName, StringComparison.OrdinalIgnoreCase)));

                    if (isDescendant || isNewRelatedProcess)
                    {
                        changed |= session.AddProcessGroupId(pid);
                    }
                }
            }
            while (changed);

            if (TryFindProtocolLaunchedMediaWindow(session, out var adoptedProcess, out var adoptedHwnd) &&
                adoptedProcess != null)
            {
                try
                {
                    session.AddProcessGroupId(adoptedProcess.Id);
                    session.AddAttachedWindowHandle(adoptedHwnd);
                    session.Process ??= adoptedProcess;
                }
                catch { }
            }
        }

        private bool TryFindProtocolLaunchedMediaWindow(ExecutableAppSession? session, out Process? process, out IntPtr hwnd)
        {
            process = null;
            hwnd = IntPtr.Zero;

            if (session == null || session.BaselineProcessCount == 0)
                return false;

            foreach (var hWnd in EnumerateTopLevelWindows())
            {
                try
                {
                    if (!IsWindowVisible(hWnd) || IsIconic(hWnd))
                        continue;

                    GetWindowProcessId(hWnd, out uint pidRaw);
                    int pid = (int)pidRaw;
                    if (pid <= 0 || pid == Environment.ProcessId)
                        continue;

                    if (session.IsBaselineProcess(pid))
                        continue;

                    Process candidate;
                    try { candidate = Process.GetProcessById(pid); }
                    catch { continue; }

                    if (SafeHasExited(candidate))
                        continue;

                    string processName = SafeProcessName(candidate);
                    if (_knownLauncherProcessNames.Contains(processName) ||
                        IsStoreAuxiliaryProcessName(processName) ||
                        IsProcessActiveStoreLauncher(candidate))
                    {
                        continue;
                    }

                    if (!GetWindowRect(hWnd, out RECT rect) || rect.Width <= 0 || rect.Height <= 0)
                        continue;

                    process = candidate;
                    hwnd = hWnd;
                    return true;
                }
                catch { }
            }

            return false;
        }

        private List<Process> GetMediaExeProcessGroup(string mediaUrl, Process? knownProcess)
        {
            var media = FindMediaAppForExecutableSession(mediaUrl);
            string resolvedUrl = ResolveMediaExecutableUrl(media, mediaUrl);
            var session = GetExecutableAppSession(resolvedUrl) ?? GetExecutableAppSession(mediaUrl);

            if (session == null)
                return new List<Process>();

            if (knownProcess != null)
            {
                try
                {
                    if (!SafeHasExited(knownProcess))
                        session.AddProcessGroupId(knownProcess.Id);
                }
                catch { }
            }

            ExpandMediaExeProcessGroup(session);

            var result = new List<Process>();
            foreach (int pid in session.SnapshotProcessGroupIds())
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

        private List<Process> EnumerateMediaExeProcesses(string mediaUrl, Process? knownProcess)
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
                var media = FindMediaAppForExecutableSession(mediaUrl);
                string executablePath = ResolveMediaExecutablePath(media, mediaUrl);
                if (File.Exists(executablePath))
                {
                    fullPath = Path.GetFullPath(executablePath);
                    processName = Path.GetFileNameWithoutExtension(executablePath);
                }
                else if (!string.IsNullOrWhiteSpace(executablePath))
                    processName = Path.GetFileNameWithoutExtension(executablePath);
            }
            catch { }

            if (string.IsNullOrWhiteSpace(processName))
                return result;

            Process[] processes;
            try { processes = Process.GetProcessesByName(processName); }
            catch { return result; }

            // Primeiro: correspondÃªncia forte por caminho, quando o Windows permite ler MainModule.
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

            // Depois: fallback por nome do exe. Apps em tray podem nÃ£o expor caminho/janela, mas
            // ainda mantÃªm o processo principal com o mesmo nome.
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

            try
            {
                var media = FindMediaAppByUrlOrId(mediaUrl);
                string resolvedUrl = ResolveMediaExecutableUrl(media, mediaUrl);
                var session = GetExecutableAppSession(resolvedUrl) ?? GetExecutableAppSession(mediaUrl);
                if (session != null)
                    CloseStoreAttachedWindows(session.SnapshotAttachedWindowHandles());
            }
            catch { }

            foreach (var process in targets)
                Kill(process);
        }

        private async Task TryMaximizeExternalWindowAsync(
            Process proc,
            string mediaUrl,
            bool requireControllerActive = true,
            CancellationToken token = default)
        {
            string mediaExecutablePath = ResolveMediaExecutablePath(FindMediaAppForExecutableSession(mediaUrl), mediaUrl);
            var targetSession = GetExecutableAppSession(mediaUrl);
            bool isSteamStoreLaunch =
                _isStoreLauncherSession &&
                IsSteamStoreWindowLookup(_activeStoreId ?? "", mediaUrl);
            bool isGogStoreLaunch =
                _isStoreLauncherSession &&
                IsGogStoreWindowLookup(_activeStoreId ?? "", mediaUrl);
            int maxAttempts = (isSteamStoreLaunch || isGogStoreLaunch) ? 1800 : 600;
            var focusedSteamInteractiveWindows = new HashSet<IntPtr>();
            bool gogInteractiveWindowFocused = false;

            for (int i = 0; i < maxAttempts; i++)
            {
                // CRÃTICO: Para imediatamente se saÃ­mos do modo (botÃ£o Xbox)
                if (token.IsCancellationRequested ||
                    (requireControllerActive &&
                     (!IsActiveExecutableAppSession(targetSession) || targetSession?.MouseModeActive != true))) return;

                await Task.Delay(200, token);
                try
                {
                    Process? targetProc = proc;
                    bool canResolveTargetLater =
                        _isStoreLauncherSession &&
                        (IsSteamStoreWindowLookup(_activeStoreId ?? "", mediaUrl) ||
                         IsGogStoreWindowLookup(_activeStoreId ?? "", mediaUrl));
                    if (!canResolveTargetLater && SafeHasExited(targetProc))
                    {
                        targetProc = FindRunningProcessForExe(mediaExecutablePath);
                        if (targetProc == null) continue;
                    }

                    IntPtr hwnd;
                    if (_isStoreLauncherSession &&
                        IsSteamStoreWindowLookup(_activeStoreId ?? "", mediaUrl))
                    {
                        if (!TryFindSteamWindow(out var steamProc, out var steamHwnd))
                        {
                            if (TryFindNewSteamInteractiveWindow(focusedSteamInteractiveWindows, out var steamInteractiveHwnd))
                            {
                                focusedSteamInteractiveWindows.Add(steamInteractiveHwnd);
                                FocusExternalWindowGracefullyDuringStoreLaunch(steamInteractiveHwnd, token);

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
                            targetProc = FindRunningProcessForExe(mediaExecutablePath);
                            if (targetProc == null) continue;
                        }

                        hwnd = targetProc.MainWindowHandle;
                        if (hwnd == IntPtr.Zero) hwnd = FindVisibleWindowForProcess(targetProc.Id);
                    }

                    if (hwnd != IntPtr.Zero)
                    {
                        if (token.IsCancellationRequested ||
                            (requireControllerActive &&
                             (!IsActiveExecutableAppSession(targetSession) || targetSession?.MouseModeActive != true))) return;

                        ShowWindow(hwnd, 3); // SW_MAXIMIZE
                        FocusExternalWindow(hwnd);
                        return;
                    }
                }
                catch { }
            }
        }

        private void FocusExternalWindowGracefullyDuringStoreLaunch(IntPtr hwnd, CancellationToken token)
        {
            if (hwnd == IntPtr.Zero)
                return;

            FocusExternalWindow(hwnd);

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(350, token).ConfigureAwait(false);
                    if (token.IsCancellationRequested)
                        return;

                    if (GetForegroundWindow() == hwnd)
                        return;

                    if (!IsForegroundDoorpi())
                        return;

                    if (!IsWindowVisible(hwnd))
                        return;

                    FocusExternalWindow(hwnd);
                }
                catch { }
            }, token);
        }

        private void StartMediaExeWatcher(Process? proc, string mediaUrl, string appName, CancellationToken token)
        {
            var watchedSession = GetOrCreateExecutableAppSession(mediaUrl, activate: false);
            if (watchedSession.ProcessGroupCount == 0)
                InitializeMediaExeProcessGroup(mediaUrl, proc);

            _ = Task.Run(async () =>
            {
                try
                {
                    string executablePath = ResolveMediaExecutablePath(FindMediaAppForExecutableSession(mediaUrl), mediaUrl);
                    string exeName = Path.GetFileNameWithoutExtension(executablePath);
                    bool hasStarted = false;
                    DateTime startTime = DateTime.UtcNow;

                    // ==============================================================
                    // FASE 1: AGUARDANDO O APP ABRIR (Alta TolerÃ¢ncia - AtÃ© 3 Minutos)
                    // ==============================================================
                    while (!hasStarted && !token.IsCancellationRequested)
                    {
                        if (watchedSession.WatcherPaused) { await Task.Delay(100, token); continue; }

                        if ((DateTime.UtcNow - startTime).TotalMinutes > 3)
                        {
                            if (IsActiveExecutableAppSession(watchedSession))
                                SendGameLaunchStatus("gameLaunchFailed", appName, "", "", "timeout");
                            ReturnToDoorpiFromMedia(watchedSession);
                            return;
                        }

                        bool foundWindow = TryFindMediaExeWindowCandidate(
                            watchedSession,
                            mediaUrl,
                            appName,
                            allowNewWindowFallback: true,
                            out var activeProcess,
                            out var activeHwnd);

                        if (foundWindow && activeHwnd != IntPtr.Zero)
                        {
                            if (activeProcess != null)
                            {
                                proc = activeProcess;
                                watchedSession.Process = activeProcess;
                                try { watchedSession.AddProcessGroupId(activeProcess.Id); } catch { }
                            }

                            hasStarted = true;
                            if (IsActiveExecutableAppSession(watchedSession))
                                SendGameLaunchStatus("gameLaunchReady");

                            await EnsureMinimumAnimationTimeAsync(token);
                            if (token.IsCancellationRequested || (!watchedSession.MouseModeActive && !watchedSession.GamepadDisabled)) return;

                            await Task.Delay(300, token);
                            if (token.IsCancellationRequested || (!watchedSession.MouseModeActive && !watchedSession.GamepadDisabled)) return;

                            Dispatcher.Invoke(() =>
                            {
                                if (!IsActiveExecutableAppSession(watchedSession)) return;
                                if (this.Topmost) this.Topmost = false;
                                // Empurra o Doorpi para o fundo da pilha Z-order, atrÃ¡s de todos os apps
                                SetWindowPos(_mainWindowHandle, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                                FocusExternalWindow(activeHwnd);

                            });

                            if (IsActiveExecutableAppSession(watchedSession))
                            {
                                SendGameLaunchStatus("gameLaunchDone");
                                DiscordRpcManager.Instance.UpdateState("media", mediaUrl, appName);
                            }

                            break;
                        }

                        await Task.Delay(500, token);
                    }

                    // ==============================================================
                    // FASE 2: APP EM EXECUÃ‡ÃƒO (Retorno Imediato ao Fechar)
                    // ==============================================================
                    int missingCount = 0;
                    DateTime unresponsiveSinceUtc = DateTime.MinValue;
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
                        IntPtr activeWindowHwnd = IntPtr.Zero;

                        foreach (var p in processList)
                        {
                            IntPtr h = FindVisibleWindowForProcess(p.Id);

                            // A MÃGICA: A janela precisa existir (h != Zero) E NÃƒO ESTAR MINIMIZADA (!IsIconic)
                            if (h != IntPtr.Zero && !IsIconic(h))
                            {
                                proc = p;
                                watchedSession.Process = p;
                                try
                                {
                                    watchedSession.AddProcessGroupId(p.Id);
                                    watchedSession.AddAttachedWindowHandle(h);
                                }
                                catch { }

                                hasActiveWindow = true;
                                activeWindowHwnd = h;
                                break;
                            }
                        }

                        if (hasActiveWindow && IsWindowMarkedNotResponding(activeWindowHwnd))
                        {
                            if (unresponsiveSinceUtc == DateTime.MinValue)
                            {
                                unresponsiveSinceUtc = DateTime.UtcNow;
                                Debug.WriteLine($"[MediaWatcher] Unresponsive window detected: {appName}");
                            }
                            else if (DateTime.UtcNow - unresponsiveSinceUtc >= HUNG_WINDOW_RECOVERY_GRACE)
                            {
                                Debug.WriteLine($"[MediaWatcher] Recovering unresponsive app: {appName}");
                                KillMediaExeProcessTree(mediaUrl, proc);
                                await Task.Delay(350, token).ConfigureAwait(false);
                                ReturnToDoorpiFromMedia(watchedSession);
                                return;
                            }
                        }
                        else
                        {
                            unresponsiveSinceUtc = DateTime.MinValue;
                        }

                        if (!hasActiveWindow)
                        {
                            if (TryFindMediaExeWindowCandidate(
                                    watchedSession,
                                    mediaUrl,
                                    appName,
                                    allowNewWindowFallback: true,
                                    out var inheritedProcess,
                                    out var inheritedHwnd) &&
                                inheritedProcess != null &&
                                inheritedHwnd != IntPtr.Zero &&
                                !IsIconic(inheritedHwnd))
                            {
                                proc = inheritedProcess;
                                watchedSession.Process = inheritedProcess;
                                try
                                {
                                    watchedSession.AddProcessGroupId(inheritedProcess.Id);
                                    watchedSession.AddAttachedWindowHandle(inheritedHwnd);
                                }
                                catch { }

                                hasActiveWindow = true;
                                activeWindowHwnd = inheritedHwnd;
                                missingCount = 0;
                            }
                        }

                        // DEPOIS â€” 2 checks Ã— 200ms = 400ms mÃ¡ximo, mais tolerante que 1 check
                        if (!hasActiveWindow)
                        {
                            bool mediaProcessStillAlive = processList.Any(p =>
                            {
                                try { return !SafeHasExited(p); } catch { return false; }
                            });
                            if (!mediaProcessStillAlive)
                            {
                                try { mediaProcessStillAlive = FindRunningProcessForExe(executablePath) != null; } catch { }
                            }

                            if (mediaProcessStillAlive)
                            {
                                Dispatcher.Invoke(() => FinalizeMediaExeTraySession(watchedSession));
                                return;
                            }

                            missingCount++;
                            if (missingCount >= 2)
                            {
                                ReturnToDoorpiFromMedia(watchedSession);
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
            }, token);
        }

        private void FinalizeMediaExeTraySession(ExecutableAppSession session)
        {
            string mediaUrl = session.Url;
            var media = FindMediaAppByUrlOrId(mediaUrl);
            string resolvedUrl = ResolveMediaExecutableUrl(media, mediaUrl);

            var process = FindAliveMediaExeProcess(resolvedUrl, session.Process);
            session.MouseModeActive = false;
            session.ControllerActive = false;
            session.GamepadDisabled = !session.MouseModeRequested;
            session.MouseInputTemporarilyDisabled = false;
            session.WatcherPaused = false;
            session.DoorpiSuspended = true;

            if (process != null)
                session.Process = process;

            if (!IsActiveExecutableAppSession(session))
            {
                SendRuntimeSessionsToUI();
                return;
            }

            try { _desktopVkb?.Close(); } catch { }
            _desktopVkb = null;

            ClearExecutionLock();
            SendRuntimeSessionsToUI();
            ForceFocus();
        }

        private Process? StartMediaExecutable(string mediaUrl)
        {
            try
            {
                var media = FindMediaAppForExecutableSession(mediaUrl);
                string command = ResolveMediaLaunchCommand(media, mediaUrl);
                return string.IsNullOrWhiteSpace(command)
                    ? null
                    : LaunchCommand.Start(command, ProcessWindowStyle.Maximized);
            }
            catch { return null; }
        }

        private async Task<(Process? Process, IntPtr Hwnd)> WaitForMediaExeWindowAsync(
            string mediaUrl,
            string appName,
            int attempts,
            int delayMs,
            bool allowNewWindowFallback,
            CancellationToken token = default)
        {
            for (int i = 0; i < attempts && !token.IsCancellationRequested; i++)
            {
                var session = GetExecutableAppSession(mediaUrl);
                if (TryFindMediaExeWindowCandidate(session, mediaUrl, appName, allowNewWindowFallback, out var candidateProcess, out var candidateHwnd) &&
                    candidateProcess != null &&
                    candidateHwnd != IntPtr.Zero)
                {
                    return (candidateProcess, candidateHwnd);
                }

                var alive = FindAliveMediaExeProcess(mediaUrl, session?.Process);
                if (alive != null)
                {
                    var hwnd = FindAnyWindowForProcess(alive.Id);
                    if (hwnd == IntPtr.Zero) hwnd = alive.MainWindowHandle;
                    if (hwnd != IntPtr.Zero)
                        return (alive, hwnd);
                }

                await Task.Delay(delayMs, token).ConfigureAwait(false);
            }

            return (null, IntPtr.Zero);
        }

        private async Task<(Process? Process, IntPtr Hwnd)> RestoreMediaExeWindowWithFallbacksAsync(
            string mediaUrl,
            string appName,
            CancellationToken token = default)
        {
            string executablePath = ResolveMediaExecutablePath(FindMediaAppForExecutableSession(mediaUrl), mediaUrl);
            var found = await WaitForMediaExeWindowAsync(mediaUrl, appName, 16, 125, allowNewWindowFallback: false, token).ConfigureAwait(false);
            if (found.Hwnd != IntPtr.Zero)
                return found;

            var session = GetOrCreateExecutableAppSession(mediaUrl, activate: false);
            var aliveBeforeRelaunch = FindAliveMediaExeProcess(mediaUrl, session.Process);
            if (aliveBeforeRelaunch != null && !string.IsNullOrWhiteSpace(executablePath))
            {
                session.ReplaceBaselineProcessIds(SnapshotProcessIds());
                StartMediaExecutable(mediaUrl);
                found = await WaitForMediaExeWindowAsync(mediaUrl, appName, 24, 125, allowNewWindowFallback: true, token).ConfigureAwait(false);
                if (found.Hwnd != IntPtr.Zero)
                    return found;
            }

            if (!string.IsNullOrWhiteSpace(executablePath))
            {
                try { KillMediaExeProcessTree(mediaUrl, aliveBeforeRelaunch); } catch { }
                await Task.Delay(250, token).ConfigureAwait(false);
                var baselineBeforeLaunch = SnapshotProcessIds();
                var relaunched = StartMediaExecutable(mediaUrl);
                if (relaunched != null)
                {
                    InitializeMediaExeProcessGroup(mediaUrl, relaunched, baselineBeforeLaunch, executablePath);
                    session.Process = relaunched;
                }

                found = await WaitForMediaExeWindowAsync(mediaUrl, appName, 32, 125, allowNewWindowFallback: true, token).ConfigureAwait(false);
                if (found.Hwnd != IntPtr.Zero)
                    return found;
            }

            return (FindAliveMediaExeProcess(mediaUrl, session.Process), IntPtr.Zero);
        }

        // Helper para centralizar a volta ao Doorpi

        // DEPOIS
        private void ReturnToDoorpiFromMedia(string? mediaUrl = null)
        {
            ExecutableAppSession? session = ActiveExecutableAppSession;
            if (!string.IsNullOrWhiteSpace(mediaUrl))
            {
                var media = FindMediaAppByUrlOrId(mediaUrl);
                string resolvedUrl = ResolveMediaExecutableUrl(media, mediaUrl);
                session = GetExecutableAppSession(resolvedUrl) ?? GetExecutableAppSession(mediaUrl);
            }

            if (session != null)
                ReturnToDoorpiFromMedia(session);
        }

        private void ReturnToDoorpiFromMedia(ExecutableAppSession session)
        {
            int capturedSession = session.SessionId;
            string capturedUrl = session.Url;
            bool ownsForeground = IsActiveExecutableAppSession(session);

            // -- Para imediatamente a Thread do Mouse, mas MANTÃ‰M as variÃ¡veis de processo VIVAS --
            session.MouseModeActive = false;
            session.ControllerActive = false;
            session.GamepadDisabled = !session.MouseModeRequested;
            session.DoorpiSuspended = false;

            var aliveProcess = FindAliveMediaExeProcess(capturedUrl, session.Process);
            bool processStillAlive = aliveProcess != null;
            if (processStillAlive)
                session.Process = aliveProcess;
            else
                ClearExecutableAppSession(session);

            if (!ownsForeground)
            {
                SendRuntimeSessionsToUI();
                return;
            }

            EnsureCursorHidden();
            _mainScreenMouseVisible = false;
            _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
            try { SetCursorPos(0, 0); } catch { }

            Interlocked.Exchange(ref _returnFromExternalModeSuppressUntil,
                DateTime.UtcNow.AddMilliseconds(350).Ticks);

            SendGameLaunchStatus("gameLaunchDone");

            Dispatcher.Invoke(() =>
            {
                if (processStillAlive &&
                    (!IsActiveExecutableAppSession(session) || session.SessionId != capturedSession))
                    return;
                if (!processStillAlive &&
                    !string.IsNullOrWhiteSpace(_activeExecutableAppSessionKey) &&
                    !string.Equals(_activeExecutableAppSessionKey, session.Key, StringComparison.OrdinalIgnoreCase))
                    return;

                _desktopVkb?.Close();
                _desktopVkb = null;

                EnsureCursorVisible();
                EnsureCursorHidden();
                _mainScreenMouseVisible = false;
                _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                SetCursorPos(0, 0);

                if (processStillAlive)
                {
                    RestoreDoorpiAfterMinimizingMediaExe();
                    return;
                }

                if (WindowState != WindowState.Maximized) WindowState = WindowState.Maximized;
                ReleaseDoorpiTopmost();

                SetWindowPos(_mainWindowHandle, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
                Activate();
                ForceFocus();
                webView?.CoreWebView2?.ExecuteScriptAsync(
                    "window.isMediaAppActive = false; window.focusFeaturedCard?.();");
                SendRuntimeSessionsToUI();
            });
        }

        private void RestoreDoorpiAfterMinimizingMediaExe()
        {
            _mainUiGamepadSuspendedForGame = false;
            Interlocked.Exchange(ref _mainUiGamepadSuppressUntilUtcTicks, 0);
            Interlocked.Exchange(ref _focusRestoredAtTicks, DateTime.UtcNow.Ticks);
            Interlocked.Exchange(ref _executionLockSuppressUntilUtcTicks, 0);
            ReleaseAllStuckKeys();

            _ = Dispatcher.BeginInvoke(() =>
            {
                var hwnd = _mainWindowHandle != IntPtr.Zero
                    ? _mainWindowHandle
                    : new System.Windows.Interop.WindowInteropHelper(this).Handle;

                if (WindowState != WindowState.Maximized) WindowState = WindowState.Maximized;
                ReleaseDoorpiTopmost();

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
                        hasBlockingSession = false,
                        hasLiveExternalSession = true,
                        shouldMuteDoorpiAudio = true
                    }));

                SendRuntimeSessionsToUI();
                DiscordRpcManager.Instance.UpdateState("menu");
            });
        }
        private void MinimizeAllWindowsExcept(IntPtr excludeHwnd)
        {
            IntPtr doorpiHwnd = _mainWindowHandle;
            IntPtr shellWindow = GetShellWindow(); // Desktop/Barra de tarefas

            EnumWindows((hWnd, _) =>
            {
                // NÃ£o minimiza: o prÃ³prio Doorpi, o novo App, ou a Ã¡rea de trabalho/barra de tarefas
                if (hWnd == excludeHwnd || hWnd == doorpiHwnd || hWnd == shellWindow)
                    return true;

                if (IsWindowVisible(hWnd))
                {
                    // Verifica se a janela tem tÃ­tulo (evita minimizar processos invisÃ­veis do sistema)
                    if (GetWindowTextLength(hWnd) > 0)
                    {
                        // SW_MINIMIZE = 6
                        ShowWindow(hWnd, 6);
                    }
                }
                return true;
            }, IntPtr.Zero);
        }
        private void EnterMediaExeMode(
            Process proc,
            string url,
            string appName,
            string heroImg,
            string gridImg,
            HashSet<int>? baselineProcessIds = null,
            string? executablePath = null,
            bool closeProcessOnReturn = false,
            bool allowControllerInput = true)
        {
            _mainUiOwnsDirectionalNavigation = false;
            ActivateExecutableAppSession(url);
            var executableSession = EnsureExecutableAppSession(url);
            if (executableSession.MouseModeActive) return;

            executableSession.WatcherCts?.Cancel();
            executableSession.WatcherCts = new CancellationTokenSource();

            int sessionId = NextExecutableAppSessionId(executableSession);

            executableSession.Process = proc;
            executableSession.Url = url;
            InitializeMediaExeProcessGroup(url, proc, baselineProcessIds, executablePath);
            executableSession.MouseModeRequested = allowControllerInput;
            executableSession.MouseModeInitialized = true;
            executableSession.GamepadDisabled = !allowControllerInput;
            executableSession.MouseModeActive = true;
            executableSession.MouseInputTemporarilyDisabled = !allowControllerInput;
            executableSession.WatcherPaused = false;
            executableSession.DoorpiSuspended = false;
            executableSession.CloseProcessOnReturn = closeProcessOnReturn;
            executableSession.AllowControllerInput = allowControllerInput;

            Dispatcher.Invoke(() =>
            {
                while (ShowCursor(true) < 0) { }
                _mainScreenMouseVisible = true;
                if (allowControllerInput)
                {
                    CenterCursorOnScreen();
                    UpdateHoverStateInWebView(); // Devolve controle do hover se for MÃ­dia
                }
            });

            SendGameLaunchStatus("gameLaunching", appName, heroImg, gridImg, "app");
            _ = TryMaximizeExternalWindowAsync(proc, url, token: executableSession.WatcherCts.Token);
            StartMediaExeWatcher(proc, url, appName, executableSession.WatcherCts.Token);
            EnsureMediaExeShortcutThread(sessionId);
            if (allowControllerInput)
                EnsureMediaExeControllerThread(sessionId);
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
            TryRouteInputThroughElevatedBridgeIfNeeded();
            if (TrySendElevatedUnicodeString(text)) return;

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
            SendInputs(inputs.ToArray());
        }
        private void EnterDesktopMode()
        {
            _mainUiOwnsDirectionalNavigation = false;
            // Se estÃ¡vamos no topo protegendo o fundo, liberamos a prioridade
            ReleaseDoorpiTopmost();

            // Garante que o explorer esteja vivo para o usuÃ¡rio usar o PC
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

                ReleaseDoorpiTopmost();

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
            var buttonTracker = new XInputButtonTracker();
            var initialInput = GetUnifiedControllerInput();
            buttonTracker.Update(initialInput.Source ?? XInputControllerHub.Read());

            double remainderX = 0, remainderY = 0;
            bool aWasOnTextField = false, aDragOccurred = false;
            bool aDoubleClickPending = false;
            DateTime lastAReleaseTime = DateTime.MinValue;

            bool isHoldingX = false;
            DateTime xPressTime = DateTime.MinValue, lastBackspaceFired = DateTime.MinValue;

            var prevAnalogActive = new Dictionary<VkbHoldAction, bool> {
                { VkbHoldAction.MoveUp, false }, { VkbHoldAction.MoveDown, false },
                { VkbHoldAction.MoveLeft, false }, { VkbHoldAction.MoveRight, false },
                { VkbHoldAction.CursorLeft, false }, { VkbHoldAction.CursorRight, false },
                { VkbHoldAction.ToggleLayer, false }
            };

            bool ignoreNextBRelease = false;
            bool isClicking = false;
            double clickAccumX = 0, clickAccumY = 0;
            bool dragBrokeThreshold = false;

            while (_systemControllerActive)
            {
                if (aDoubleClickPending && (DateTime.Now - lastAReleaseTime).TotalMilliseconds > 300)
                {
                    aDoubleClickPending = false;
                    if (IsForegroundWindowNativeWindows()) OpenNativeTouchKeyboard();
                    else Dispatcher.Invoke(() =>
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
                            _desktopVkb.OnCloseRequested += () => { _desktopVkb?.Close(); _desktopVkb = null; };
                            _desktopVkb.SetFixedPosition();
                            _desktopVkb.Show();
                        }
                    });
                }

                try
                {
                    double dt = sw.Elapsed.TotalSeconds;
                    sw.Restart();
                    dt = Math.Clamp(dt, 0, 0.05);

                    bool vkbIsOpen = _desktopVkb != null;
                    if (!_systemControllerActive) break;

                    bool anyVkbUp = false, anyVkbDown = false, anyVkbLeft = false, anyVkbRight = false, anyVkbToggleLayer = false;
                    bool anyAPressed = false, anyAReleased = false, anyBPressed = false, anyBReleased = false;
                    bool anyXPressed = false, anyXReleased = false, anyYPressed = false;
                    bool anyStartPressed = false, anyL3Pressed = false, anyUpPressed = false;
                    bool anyRBHeld = false;
                    bool anyReturnShortcut = false;

                    double totalMlx = 0, totalMly = 0, totalScrollY = 0;

                    var input = GetUnifiedControllerInput();
                    ushort btn = input.Buttons;
                    buttonTracker.Update(input.Source ?? XInputControllerHub.Read());
                    if (buttonTracker.TaskSwitcherShortcutJustPressed ||
                        Volatile.Read(ref _nativeTaskSwitcherActive) == 1)
                    {
                        if (isClicking)
                        {
                            SendMouse(0, 0, 0x0004);
                            isClicking = false;
                        }
                        Thread.Sleep(8);
                        continue;
                    }
                    bool Pressed(ushort m) => buttonTracker.AnyPressed(m);
                    bool Released(ushort m) => buttonTracker.ReleasedGlobally(m);

                    anyReturnShortcut = buttonTracker.ReturnShortcutJustPressed;
                    anyAPressed = Pressed(XI_A);
                    anyAReleased = Released(XI_A);
                    anyBPressed = Pressed(XI_B);
                    anyBReleased = Released(XI_B);
                    anyXPressed = Pressed(XI_X);
                    anyXReleased = Released(XI_X);
                    anyYPressed = Pressed(XI_Y);
                    anyStartPressed = Pressed(XI_START);
                    anyL3Pressed = Pressed(XI_L3);
                    anyUpPressed = Pressed(XI_R3);

                    if (vkbIsOpen)
                    {
                        const double DEAD = 0.45;
                        if ((btn & XI_DPAD_UP) != 0) anyVkbUp = true;
                        else if ((btn & XI_DPAD_DOWN) != 0) anyVkbDown = true;
                        else if ((btn & XI_DPAD_LEFT) != 0) anyVkbLeft = true;
                        else if ((btn & XI_DPAD_RIGHT) != 0) anyVkbRight = true;
                        else if (input.ThumbLY > DEAD) anyVkbUp = true;
                        else if (input.ThumbLY < -DEAD) anyVkbDown = true;
                        else if (input.ThumbLX < -DEAD) anyVkbLeft = true;
                        else if (input.ThumbLX > DEAD) anyVkbRight = true;
                        anyVkbToggleLayer = input.LeftTrigger;

                        bool curX = (btn & XI_X) != 0;
                        if (anyXPressed)
                        {
                            isHoldingX = true; xPressTime = DateTime.Now;
                            SendVirtualKey(0x08); lastBackspaceFired = DateTime.Now;
                        }
                        else if (curX && isHoldingX && (DateTime.Now - xPressTime).TotalMilliseconds > 450 && (DateTime.Now - lastBackspaceFired).TotalMilliseconds > 40)
                        {
                            SendVirtualKey(0x08); lastBackspaceFired = DateTime.Now;
                        }
                        else if (!curX && isHoldingX) isHoldingX = false;
                    }
                    else
                    {
                        anyRBHeld = (btn & XI_R1) != 0;
                        if (anyRBHeld)
                        {
                            if (Math.Abs(input.ThumbRY) > 0.15) totalScrollY = input.ThumbRY;
                        }
                        else
                        {
                            // Native Windows windows follow the same mouse convention as
                            // web apps and executable sessions: the left stick moves the cursor.
                            double configuredMouseDeadZone = GetActiveControlMouseDeadZone(0.15);
                            if (Math.Sqrt(input.ThumbLX * input.ThumbLX + input.ThumbLY * input.ThumbLY) > configuredMouseDeadZone)
                            {
                                totalMlx = input.ThumbLX;
                                totalMly = input.ThumbLY;
                            }
                        }
                    }

                    if (anyReturnShortcut)
                    {
                        if (RequestCloseDoorpiFileExplorerLaunch())
                            break;
                        ExitDesktopMode();
                        break;
                    }

                    if (vkbIsOpen)
                    {
                        void HandleHold(bool isDown, VkbHoldAction action)
                        {
                            bool wasDown = prevAnalogActive[action];
                            if (isDown && !wasDown) Dispatcher.Invoke(() => _desktopVkb?.BeginHold(action));
                            else if (!isDown && wasDown) Dispatcher.Invoke(() => _desktopVkb?.EndHold(action));
                            prevAnalogActive[action] = isDown;
                        }

                        HandleHold(anyVkbUp, VkbHoldAction.MoveUp);
                        HandleHold(anyVkbDown, VkbHoldAction.MoveDown);
                        HandleHold(anyVkbLeft, VkbHoldAction.MoveLeft);
                        HandleHold(anyVkbRight, VkbHoldAction.MoveRight);
                        HandleHold(false, VkbHoldAction.CursorLeft);
                        HandleHold(false, VkbHoldAction.CursorRight);
                        HandleHold(anyVkbToggleLayer, VkbHoldAction.ToggleLayer);

                        if (anyAPressed) Dispatcher.Invoke(() => _desktopVkb?.BeginHold(VkbHoldAction.Press));
                        if (anyAReleased) Dispatcher.Invoke(() => _desktopVkb?.EndHold(VkbHoldAction.Press));

                        if (anyBPressed)
                        {
                            Dispatcher.Invoke(() => { _desktopVkb?.Close(); _desktopVkb = null; });
                            ignoreNextBRelease = true;
                        }

                        if (anyYPressed) SendUnicodeString(" ");
                        if (anyStartPressed) SendVirtualKey(0x0D);
                        if (anyL3Pressed) Dispatcher.Invoke(() => _desktopVkb?.ToggleShift());
                        if (anyUpPressed) Dispatcher.Invoke(() => _desktopVkb?.TogglePosition());
                    }
                    else
                    {
                        if (anyRBHeld && Math.Abs(totalScrollY) > 0.15)
                        {
                            int scroll = (int)(totalScrollY * 3000 * dt);
                            if (scroll != 0) SendMouse(0, 0, 0x0800, (uint)scroll);
                        }

                        if (anyAPressed)
                        {
                            aWasOnTextField = IsCursorOnTextField();
                            aDragOccurred = false;
                            isClicking = true;
                            clickAccumX = 0; clickAccumY = 0; dragBrokeThreshold = false;
                            SendMouse(0, 0, 0x0002);
                        }

                        if (!anyRBHeld)
                        {
                            double mag = Math.Sqrt(totalMlx * totalMlx + totalMly * totalMly);
                            if (mag > 1.0) { totalMlx /= mag; totalMly /= mag; }

                            if (totalMlx != 0 || totalMly != 0)
                            {
                                double baseSensitivity = CONTROLLER_NATIVE_MOUSE_BASE_SPEED *
                                                         CONTROLLER_MOUSE_SENSITIVITY_SCALE *
                                                         GetActiveControlMouseSensitivity();
                                TryShapeControllerPointerVector(totalMlx, totalMly, 0, out double curvedX, out double curvedY);
                                double moveX = curvedX * baseSensitivity * dt + remainderX;
                                double moveY = -curvedY * baseSensitivity * dt + remainderY;
                                int deltaX = (int)moveX; int deltaY = (int)moveY;
                                remainderX = moveX - deltaX; remainderY = moveY - deltaY;

                                if (deltaX != 0 || deltaY != 0)
                                {
                                    if (isClicking && !dragBrokeThreshold)
                                    {
                                        clickAccumX += deltaX; clickAccumY += deltaY;
                                        if (Math.Abs(clickAccumX) > 5 || Math.Abs(clickAccumY) > 5)
                                        {
                                            dragBrokeThreshold = true; aDragOccurred = true;
                                            SendMouse((int)clickAccumX, (int)clickAccumY, MOUSEEVENTF_MOVE | MOUSEEVENTF_MOVE_NOCOALESCE);
                                        }
                                    }
                                    else
                                    {
                                        if (isClicking) aDragOccurred = true;
                                        uint moveFlags = MOUSEEVENTF_MOVE;
                                        if (isClicking)
                                            moveFlags |= MOUSEEVENTF_MOVE_NOCOALESCE;
                                        SendMouse(deltaX, deltaY, moveFlags);
                                    }
                                }
                            }
                            else { remainderX = 0; remainderY = 0; }
                        }

                        if (anyAReleased)
                        {
                            isClicking = false;
                            SendMouse(0, 0, 0x0004);

                            if (aWasOnTextField && !aDragOccurred && IsCursorOnTextField())
                            {
                                if (aDoubleClickPending && (DateTime.Now - lastAReleaseTime).TotalMilliseconds <= 300)
                                {
                                    aDoubleClickPending = false;
                                    Task.Run(async () => {
                                        await Task.Delay(100);
                                        SendMouse(0, 0, 0x0008);
                                        SendMouse(0, 0, 0x0010);
                                    });
                                }
                                else
                                {
                                    aDoubleClickPending = true;
                                    lastAReleaseTime = DateTime.Now;
                                }
                            }

                            aWasOnTextField = false; aDragOccurred = false;
                        }

                        if (ignoreNextBRelease)
                        {
                            // Consume both the press and release that closed the C# VKB.
                            // Releasing B must not leak into the desktop as an MB4 event.
                            if ((btn & XI_B) == 0)
                                ignoreNextBRelease = false;
                        }
                        else
                        {
                            if (anyBPressed) SendMouse(0, 0, 0x0080, 0x0001);
                            if (anyBReleased) SendMouse(0, 0, 0x0100, 0x0001);
                        }

                        if (anyXPressed) SendMouse(0, 0, 0x0008);
                        if (anyXReleased) SendMouse(0, 0, 0x0010);

                        if (anyYPressed)
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
                                    _desktopVkb.OnCloseRequested += () => { _desktopVkb?.Close(); _desktopVkb = null; };
                                    _desktopVkb.SetFixedPosition();
                                    _desktopVkb.Show();
                                }
                            });
                        }
                    }

                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[Modo Desktop] Erro na leitura do controle: {ex.Message}");
                }

                Thread.Sleep(10);
            }

            if (isClicking) SendMouse(0, 0, 0x0004);
        }
        private void UpdateHoverStateInWebView()
        {

        }
        private void SendMouse(int dx, int dy, uint flags, uint data = 0)
        {
            TryRouteInputThroughElevatedBridgeIfNeeded();
            if (TrySendElevatedMouse(dx, dy, flags, data)) return;

            var input = new INPUT { type = INPUT_MOUSE };
            input.U.mi = new MOUSEINPUT { dx = dx, dy = dy, dwFlags = flags, mouseData = data };
            SendInputs(new[] { input });
        }

        private void SyncKey(bool pressed, bool released, ushort vk)
        {
            if (pressed)
            {
                TryRouteInputThroughElevatedBridgeIfNeeded();
                if (TrySendElevatedVirtualKey(vk)) return;

                var input = new INPUT { type = INPUT_KEYBOARD };
                input.U.ki = new KEYBDINPUT { wVk = vk };
                SendInputs(new[] { input });
            }
            else if (released)
            {
                TryRouteInputThroughElevatedBridgeIfNeeded();
                if (TrySendElevatedVirtualKey(vk)) return;

                var input = new INPUT { type = INPUT_KEYBOARD };
                input.U.ki = new KEYBDINPUT { wVk = vk, dwFlags = KEYEVENTF_KEYUP };
                SendInputs(new[] { input });
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

        private void SendVirtualKey(byte vk)
        {
            TryRouteInputThroughElevatedBridgeIfNeeded();
            if (TrySendElevatedVirtualKey(vk)) return;

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
            ScheduleProfileSync(profile.Id);
        }
        // ========================= INICIAR COM O WINDOWS =========================

        private const string AutoStartRegKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
        private const string AutoStartAppName = "Doorpi";

        // ========================= COMPORTAMENTO DE INICIALIZAÃ‡ÃƒO =========================

        // ========================= COMPORTAMENTO DE INICIALIZAÃ‡ÃƒO =========================

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

                // 2. Verifica se estamos no Modo PadrÃ£o (Run)
                using var runKey = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run");
                if (runKey?.GetValue("Doorpi") is string runVal && !string.IsNullOrWhiteSpace(runVal))
                {
                    return 1; // Iniciar com Windows (PadrÃ£o)
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
                // Chave responsÃ¡vel pelo som de InicializaÃ§Ã£o/Logon
                using var soundKey = Registry.CurrentUser.CreateSubKey(@"AppEvents\Schemes\Apps\.Default\SystemStart\.Current");

                // Limpa as chaves para evitar conflitos
                runKey?.DeleteValue("Doorpi", false);
                if (winlogonKey?.GetValue("Shell") != null) winlogonKey.DeleteValue("Shell", false);

                if (mode == 1) // Iniciar com Windows (PadrÃ£o)
                {
                    runKey?.SetValue("Doorpi", $"\"{exePath}\"");

                    // Restaura o som padrÃ£o do Windows deletando o mute
                    if (soundKey?.GetValue("") as string == "")
                        soundKey.DeleteValue("", false);

                    Debug.WriteLine($"[BootMode] Ativado Modo PadrÃ£o");
                }
                else if (mode == 2) // Modo Console (Shell Imersivo)
                {
                    winlogonKey?.SetValue("Shell", $"\"{exePath}\" --doorpi-shell-bootstrap");

                    // Muta o som de Boot do Windows (O Windows tentarÃ¡ tocar uma string vazia)
                    soundKey?.SetValue("", "");

                    Debug.WriteLine($"[BootMode] Ativado Modo Console");
                }
            }
            catch (Exception ex) { Debug.WriteLine($"[BootMode] Erro ao gravar registro: {ex.Message}"); }
        }

        private void EnsureExplorerIsRunningInBackstage()
        {
            // Se o explorer jÃ¡ estiver rodando, nÃ£o fazemos nada
            if (Process.GetProcessesByName("explorer").Length > 0)
            {
                DoorpiBootDiagnostics.Log("ensure-explorer-skip", "already-running");
                ReleaseDoorpiTopmost();
                return;
            }

            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    UseShellExecute = true
                });

                // Uma Ãºnica tentativa de foco apÃ³s o explorer inicializar
                _ = Task.Run(async () =>
                {
                    await Task.Delay(2500);
                    Dispatcher.Invoke(() =>
                    {
                        bool bootstrapStillActive =
                            _useNativeBootIntro &&
                            _nativeBootIntroWindow != null &&
                            Volatile.Read(ref _nativeBootIntroHandoffComplete) == 0;

                        if (!bootstrapStillActive &&
                            !_systemControllerActive && !_gameSessionActive &&
                            !_dialogModeActive && string.IsNullOrEmpty(_mediaExeCurrentUrl))
                        {
                            SetForegroundWindow(_mainWindowHandle);
                            Activate();
                            ReleaseDoorpiTopmost();
                        }
                    });
                });

                DoorpiBootDiagnostics.Log("ensure-explorer-started");
                Debug.WriteLine("[Boot] Explorer.exe iniciado em background com sucesso.");
            }
            catch (Exception ex)
            {
                ReleaseDoorpiTopmost();
                DoorpiBootDiagnostics.Log("ensure-explorer-error", ex.Message);
                Debug.WriteLine($"[Boot] Erro ao iniciar explorer: {ex.Message}");
            }
        }
        private void ReleaseDoorpiTopmost()
        {
            try
            {
                if (this.Topmost) this.Topmost = false;
                if (_mainWindowHandle != IntPtr.Zero)
                {
                    SetWindowPos(_mainWindowHandle, HWND_NOTOPMOST, 0, 0, 0, 0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                }
            }
            catch { }
        }
        private void SendBootModeToUI()
        {
            int mode = GetBootMode();
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(new { type = "bootModeState", mode })));
        }
        private string GetSteamGridApiKey() => LoadUserProfile().SteamGridApiKey;

        private const int SteamGridRequestTimeoutMs = 2500;
        private const int ArtworkDownloadTimeoutMs = 3500;
        // A escolha manual pode apontar para WebPs animados grandes (alguns heroes
        // do SteamGridDB passam de 40 MB). O timeout curto acima continua valendo
        // para preenchimento automático, mas não deve cancelar uma escolha explícita.
        private const int SelectedArtworkDownloadTimeoutMs = 120000;
        private const long MaxArtworkDownloadBytes = 100L * 1024L * 1024L;

        private async Task<string> SgdbGetStringAsync(string url, int timeoutMs = SteamGridRequestTimeoutMs)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            var key = GetSteamGridApiKey();
            if (!string.IsNullOrEmpty(key))
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);

            using var timeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs));
            var response = await httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                timeout.Token).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync(timeout.Token).ConfigureAwait(false);
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

        private void StopWatchers()
        {
            foreach (var watcher in _folderWatchers)
            {
                try { watcher.EnableRaisingEvents = false; watcher.Dispose(); } catch { }
            }
            _folderWatchers.Clear();
        }

        private void RestartWatchers()
        {
            StopWatchers();
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
            // Cache invalidation Ã© checada pelo timestamp no Diff, o watcher agora sÃ³ existe
            // se futuramente vocÃª quiser plugar eventos em realtime na UI.
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

        private string GetCachedImageAsPngBase64(string imagePath)
        {
            if (string.IsNullOrEmpty(imagePath) || !File.Exists(imagePath)) return "";
            try
            {
                var info = new FileInfo(imagePath);
                string key = $"img|{imagePath}|{info.LastWriteTimeUtc.Ticks}|{info.Length}";
                string hash = Convert.ToHexString(
                    System.Security.Cryptography.MD5.HashData(
                        System.Text.Encoding.UTF8.GetBytes(key)))[..12];

                string iconPath = Path.Combine(iconCacheFolder, $"{hash}.b64");

                if (File.Exists(iconPath))
                    return File.ReadAllText(iconPath);

                using var image = System.Drawing.Image.FromFile(imagePath);
                using var ms = new MemoryStream();
                image.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
                string b64 = Convert.ToBase64String(ms.ToArray());
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
            (DoorpiBrowserAppId, "Browser", "Google (Website)",          "https://www.google.com",       "browser", false),
            ("disneyplus",  "Disney +",      "Disney + (Website)",     "https://www.disneyplus.com",   "browser", true ),
            ("primevideo",  "Prime V\u00EDdeo",  "Prime Video (Website)",     "https://www.primevideo.com",   "browser", true ),
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
            string assetQuery,
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
            string resolvedName = ResolveNativeMediaAppName(id, name, existingEntry.Name);

            return new MediaAppModel
            {
                Id = id,
                Name = resolvedName,
                Url = !string.IsNullOrWhiteSpace(existingEntry.Url) ? existingEntry.Url : url,
                Type = type,
                AssetQuery = !string.IsNullOrWhiteSpace(existingEntry.AssetQuery) ? existingEntry.AssetQuery : assetQuery,
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

        private static string ResolveNativeMediaAppName(string id, string defaultName, string existingName)
        {
            if (string.IsNullOrWhiteSpace(existingName))
                return defaultName;

            // Corrige automaticamente apenas os valores antigos do Prime Video que
            // foram persistidos a partir do literal com encoding corrompido.
            string trimmedName = existingName.Trim();
            bool isBrokenPrimeVideoName = id.Equals("primevideo", StringComparison.OrdinalIgnoreCase)
                && trimmedName.StartsWith("Prime V", StringComparison.OrdinalIgnoreCase)
                && (trimmedName.Contains('\u00C3')
                    || trimmedName.Contains('\u00C2')
                    || trimmedName.Contains('\uFFFD'));

            return isBrokenPrimeVideoName ? defaultName : existingName;
        }


        // ========================= MEDIA APPS =========================

        private async Task<(string?, string?, string?, string?)> FetchMediaAppAssetsAsync(
            string name,
            string sgdbQuery,
            int preferredArtworkIndex = 0)
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
                var result = await TryFetchByName(query, preferredArtworkIndex);
                if (result.Item1 != null)
                {
                    Debug.WriteLine($"[Media] Achou '{name}' com query: '{query}'");
                    return result;
                }
                await Task.Delay(150);
            }

            Debug.WriteLine($"[Media] NÃ£o encontrou assets para '{name}' em nenhuma query");
            return (null, null, null, null);
        }

        // Adiciona todo o catálogo apenas na criação da conta. Nas sincronizações
        // seguintes, apps removidos pelo usuário permanecem removidos; somente o
        // YouTube é obrigatório porque não pode ser adicionado manualmente.
        private async Task SynchronizeNativeAppsAsync(
            string targetUserId,
            string targetMediaFile,
            bool addMissingApps,
            bool silent = false)
        {
            var existing = LoadMediaAppsForUser(targetUserId);
            var existingById = existing.ToDictionary(a => a.Id, StringComparer.OrdinalIgnoreCase);
            var apps = new List<MediaAppModel>();

            foreach (var app in _nativeApps)
            {
                var (id, name, query, url, type, multiUser) = app;
                bool alreadyExists = existingById.TryGetValue(id, out var prev);
                bool isRequiredYouTube = id.Equals("youtube", StringComparison.OrdinalIgnoreCase);
                if (!alreadyExists && !addMissingApps && !isRequiredYouTube)
                    continue;

                if (targetUserId == currentUserId) PostProgress(id, "active");
                var existingEntry = alreadyExists ? prev! : new MediaAppModel();
                if (id.Equals(DoorpiBrowserAppId, StringComparison.OrdinalIgnoreCase) &&
                    string.IsNullOrWhiteSpace(existingEntry.GridImage) &&
                    string.IsNullOrWhiteSpace(existingEntry.HeroImage) &&
                    string.IsNullOrWhiteSpace(FindNativeAssetUrl(id, "grid")))
                {
                    try
                    {
                        var (gridUrl, horizontalUrl, heroUrl, logoUrl) = await FetchMediaAppAssetsAsync(name, query).ConfigureAwait(false);
                        string safeName = id;
                        string? localGrid = gridUrl != null ? await DownloadImageAsync(gridUrl, gridFolder, safeName).ConfigureAwait(false) : null;
                        string? localHorizontal = horizontalUrl != null ? await DownloadImageAsync(horizontalUrl, gridHorizontalFolder, safeName + "_h").ConfigureAwait(false) : null;
                        string? localHero = heroUrl != null ? await DownloadImageAsync(heroUrl, heroFolder, safeName).ConfigureAwait(false) : null;
                        string? localLogo = logoUrl != null ? await DownloadImageAsync(logoUrl, logoFolder, safeName + "_logo").ConfigureAwait(false) : null;

                        existingEntry.GridImage = localGrid != null ? $"https://data.local/images/grid/{Path.GetFileName(localGrid)}" : existingEntry.GridImage;
                        existingEntry.GridHorizontalImage = localHorizontal != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(localHorizontal)}" : existingEntry.GridHorizontalImage;
                        existingEntry.HeroImage = localHero != null ? $"https://data.local/images/hero/{Path.GetFileName(localHero)}" : existingEntry.HeroImage;
                        existingEntry.LogoImage = localLogo != null ? $"https://data.local/images/logo/{Path.GetFileName(localLogo)}" : existingEntry.LogoImage;
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine("[Media] Arte do Browser nao encontrada: " + ex.Message);
                    }
                }
                apps.Add(BuildNativeMediaApp(id, name, query, url, type, multiUser, targetUserId, existingEntry));

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
            if (!File.Exists(file) && !File.Exists(file + ".bak"))
            {
                if (!canFallbackToRoot ||
                    (!File.Exists(fallbackFile) && !File.Exists(fallbackFile + ".bak")))
                {
                    return new List<MediaAppModel>();
                }
                file = fallbackFile;
            }
            try
            {
                bool recoveredFromBackup = false;
                if (!TryDeserializeJsonFile(file, options: null, out List<MediaAppModel>? apps))
                {
                    recoveredFromBackup = TryDeserializeJsonFile(
                        file + ".bak",
                        options: null,
                        out apps);
                }
                apps ??= new List<MediaAppModel>();
                foreach (var app in apps.Where(a => string.IsNullOrWhiteSpace(a.OwnerUserId)))
                    app.OwnerUserId = userId;
                foreach (var app in apps.Where(a => a.ShareMode == "user"))
                    ApplySharedUserNames(app);

                bool repairedExecutablePath = false;
                foreach (var app in apps.Where(a =>
                             string.Equals(a.Type, "exe", StringComparison.OrdinalIgnoreCase) &&
                             !string.IsNullOrWhiteSpace(a.Url) &&
                             Path.IsPathRooted(a.Url)))
                {
                    string resolved = ResolveCurrentVersionedExecutablePath(app.Url);
                    if (!File.Exists(resolved) || string.Equals(app.Url, resolved, StringComparison.OrdinalIgnoreCase))
                        continue;

                    app.Url = resolved;
                    repairedExecutablePath = true;
                }

                if (repairedExecutablePath || recoveredFromBackup)
                {
                    try { SafeWriteAllText(file, JsonSerializer.Serialize(apps, IndentedJsonOptions)); } catch { }
                }
                if (recoveredFromBackup)
                    DoorpiBootDiagnostics.Log("media-apps-recovered", $"path={file}");

                if (canFallbackToRoot &&
                    string.Equals(file, fallbackFile, StringComparison.OrdinalIgnoreCase) &&
                    apps.Count > 0)
                {
                    try { SafeWriteAllText(mediaFile, JsonSerializer.Serialize(apps, IndentedJsonOptions)); } catch { }
                }

                return apps;
            }
            catch { return new List<MediaAppModel>(); }
        }
        private static void SafeWriteAllText(string path, string content)
        {
            for (int i = 0; i < 5; i++)
            {
                try
                {
                    DurableFileStore.WriteAllText(path, content, ShouldKeepRecoveryBackup(path));
                    return;
                }
                catch (IOException) { System.Threading.Thread.Sleep(50); }
            }
            DurableFileStore.WriteAllText(path, content, ShouldKeepRecoveryBackup(path));
        }

        private static bool ShouldKeepRecoveryBackup(string path)
        {
            string name = Path.GetFileName(path);
            return name.Equals("users.json", StringComparison.OrdinalIgnoreCase) ||
                   name.Equals("user.json", StringComparison.OrdinalIgnoreCase) ||
                   name.Equals("games.json", StringComparison.OrdinalIgnoreCase) ||
                   name.Equals("game-history.json", StringComparison.OrdinalIgnoreCase) ||
                   name.Equals("controls.json", StringComparison.OrdinalIgnoreCase) ||
                   name.Equals("folders.json", StringComparison.OrdinalIgnoreCase) ||
                   name.Equals("media.json", StringComparison.OrdinalIgnoreCase) ||
                   name.Equals("stores.json", StringComparison.OrdinalIgnoreCase);
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

        private static bool TryDeserializeJsonFile<T>(
            string path,
            JsonSerializerOptions? options,
            out T? value)
        {
            value = default;
            if (!File.Exists(path)) return false;
            try
            {
                string json = SafeReadAllText(path);
                if (string.IsNullOrWhiteSpace(json) || json.IndexOf('\0') >= 0) return false;
                value = JsonSerializer.Deserialize<T>(json, options);
                return value != null;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
            {
                DoorpiBootDiagnostics.Log("json-state-read-failed", $"path={path}; error={ex.Message}");
                value = default;
                return false;
            }
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
                JsonSerializer.Serialize(apps, IndentedJsonOptions));

            if (targetUserId == currentUserId)
            {
                SafeWriteAllText(Path.Combine(dataFolder, "media.json"),
                    JsonSerializer.Serialize(apps, IndentedJsonOptions));
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

        private static string GetExtensionDescription(BrowserExtensionModel ext)
        {
            try
            {
                string manifestPath = ResolveExtensionManifestPath(ext);
                if (string.IsNullOrWhiteSpace(manifestPath) || !File.Exists(manifestPath)) return "";

                var manifest = JsonNode.Parse(File.ReadAllText(manifestPath));
                string description = manifest?["description"]?.ToString() ?? "";
                if (!description.StartsWith("__MSG_", StringComparison.OrdinalIgnoreCase) || !description.EndsWith("__"))
                    return description;

                string messageKey = description.Substring(6, description.Length - 8);
                string localesDirectory = Path.Combine(Path.GetDirectoryName(manifestPath) ?? ext.InstalledPath, "_locales");
                if (!Directory.Exists(localesDirectory)) return "";

                string defaultLocale = manifest?["default_locale"]?.ToString() ?? "";
                var localeCandidates = new[] { "pt_BR", "pt", defaultLocale, "en", "en_US" }
                    .Where(locale => !string.IsNullOrWhiteSpace(locale))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                foreach (string locale in localeCandidates)
                {
                    string messagesPath = Path.Combine(localesDirectory, locale, "messages.json");
                    if (!File.Exists(messagesPath)) continue;
                    var messages = JsonNode.Parse(File.ReadAllText(messagesPath));
                    string localized = messages?[messageKey]?["message"]?.ToString() ?? "";
                    if (!string.IsNullOrWhiteSpace(localized)) return localized;
                }
            }
            catch { }
            return "";
        }

        private static string GetExtensionIconDataUrl(BrowserExtensionModel ext)
        {
            try
            {
                string iconPath = ResolveExtensionIconPath(ext);
                if (string.IsNullOrWhiteSpace(iconPath) || !File.Exists(iconPath)) return "";
                var file = new FileInfo(iconPath);
                if (file.Length <= 0 || file.Length > 2 * 1024 * 1024) return "";

                string mimeType = Path.GetExtension(iconPath).ToLowerInvariant() switch
                {
                    ".svg" => "image/svg+xml",
                    ".jpg" or ".jpeg" => "image/jpeg",
                    ".webp" => "image/webp",
                    ".gif" => "image/gif",
                    ".ico" => "image/x-icon",
                    ".bmp" => "image/bmp",
                    _ => "image/png"
                };
                return $"data:{mimeType};base64,{Convert.ToBase64String(File.ReadAllBytes(iconPath))}";
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
            File.WriteAllText(extensionsFile, JsonSerializer.Serialize(extensions, IndentedJsonOptions));
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

                    // Resolve a tag de internacionalizaÃ§Ã£o do Chrome (ex: __MSG_appName__)
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
                        string? availableVersion = updateCheck.Attribute("version")?.Value;
                        if (!string.IsNullOrEmpty(availableVersion) && IsNewerVersion(availableVersion, currentVersion))
                        {
                            updates[ext.Id] = availableVersion;
                        }
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[Extensions] Erro ao checar {ext.Id}: {ex.Message}"); }
            }

            // --- AQUI Ã‰ O PONTO CRUCIAL ---
            // Atualizamos a memÃ³ria da classe com os resultados encontrados
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
                Debug.WriteLine($"[Extensions] Erro na comparaÃ§Ã£o de versÃ£o: {ex.Message}");
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

                // Tenta deletar os arquivos fÃ­sicos
                if (!string.IsNullOrEmpty(ext.InstalledPath) && Directory.Exists(ext.InstalledPath))
                {
                    try
                    {
                        // ForÃ§a o Garbage Collector a soltar possÃ­veis handles antes de deletar
                        GC.Collect();
                        GC.WaitForPendingFinalizers();

                        Directory.Delete(ext.InstalledPath, true);
                    }
                    catch (IOException ex)
                    {
                        // Ã‰ normal dar erro de IO se o WebView2 estiver rodando com a extensÃ£o ativa.
                        // Como jÃ¡ removemos do JSON, ela nÃ£o serÃ¡ carregada da prÃ³xima vez.
                        Debug.WriteLine($"[Extensions] Arquivo travado, serÃ¡ ignorado no prÃ³ximo boot. Erro: {ex.Message}");
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[Extensions] Erro ao deletar pasta fÃ­sica: {ex.Message}");
                    }
                }
            }
        }
        private async Task InstallChromeExtensionAsync(string sourceUrl)
        {
            string id = ParseChromeExtensionId(sourceUrl);
            if (string.IsNullOrWhiteSpace(id)) throw new InvalidOperationException("Link da Chrome Web Store invÃ¡lido.");

            string extRoot = Path.Combine(dataFolder, "extensions", id);
            string tempRoot = Path.Combine(Path.GetTempPath(), "doorpi-ext-" + id + "-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempRoot);

            try
            {
                // ForÃ§a a versÃ£o 999 para garantir compatibilidade futura e forÃ§a download do CRX
                string crxUrl = $"https://clients2.google.com/service/update2/crx?response=redirect&os=win&arch=x64&os_arch=x86_64&nacl_arch=x86-64&prod=chromecrx&prodchannel=&prodversion=999.0.0.0&acceptformat=crx2,crx3&x=id%3D{id}%26installsource%3Dondemand%26uc";

                using var req = new HttpRequestMessage(HttpMethod.Get, crxUrl);
                req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");

                var response = await downloadClient.SendAsync(req);
                response.EnsureSuccessStatusCode();
                byte[] crxBytes = await response.Content.ReadAsByteArrayAsync();

                if (crxBytes.Length < 1024)
                    throw new InvalidOperationException("Arquivo baixado muito pequeno, verifique a URL da extensÃ£o.");

                // Busca o cabeÃ§alho do ZIP (PK\x03\x04)
                int zipOffset = FindZipOffset(crxBytes);
                if (zipOffset < 0)
                    throw new InvalidOperationException("NÃ£o foi possÃ­vel encontrar a estrutura ZIP dentro do arquivo CRX.");

                string zipPath = Path.Combine(tempRoot, id + ".zip");
                byte[] zipData = new byte[crxBytes.Length - zipOffset];
                Buffer.BlockCopy(crxBytes, zipOffset, zipData, 0, zipData.Length);
                await File.WriteAllBytesAsync(zipPath, zipData);

                // ExtraÃ§Ã£o
                ZipFile.ExtractToDirectory(zipPath, tempRoot, overwriteFiles: true);

                // Busca profunda pelo manifest.json (Ã s vezes fica em subpastas dependendo da extensÃ£o)
                var manifestFiles = Directory.EnumerateFiles(tempRoot, "manifest.json", SearchOption.AllDirectories).ToList();

                if (manifestFiles.Count == 0)
                {
                    string filesFound = string.Join(", ", Directory.GetFiles(tempRoot, "*", SearchOption.AllDirectories).Select(Path.GetFileName));
                    throw new InvalidOperationException($"ExtensÃ£o extraÃ­da, mas nenhum 'manifest.json' foi encontrado. Arquivos na pasta: {filesFound}");
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
                Name = GetExtensionName(e.InstalledPath),
                Description = GetExtensionDescription(e),
                IconDataUrl = GetExtensionIconDataUrl(e),
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
                Debug.WriteLine($"[Intro] Manifest invÃ¡lido {manifestPath}: {ex.Message}");
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
                File.WriteAllText(ActiveIntroFile, JsonSerializer.Serialize(new { enabled = false }, IndentedJsonOptions));
                return;
            }

            File.WriteAllText(ActiveIntroFile, JsonSerializer.Serialize(new
            {
                enabled = true,
                manifest = $"{id}/manifest.json"
            }, IndentedJsonOptions));
        }

        private void SendMediaAppsToUI(List<MediaAppModel> apps)
        {
            if (!_interactiveUserSessionStarted) return;
            if (apps.Count == 0) return;

            foreach (MediaAppModel app in apps.Where(app => string.IsNullOrWhiteSpace(app.IconBase64)))
                app.IconBase64 = ResolveMediaIconBase64(app);

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
                        await Task.Delay(2000, token); // DÃ¡ uma olhadinha a cada 2 segundos

                        bool isYtActive = false;
                        Dispatcher.Invoke(() => isYtActive = _ytWebView != null && _ytWebView.Visibility == Visibility.Visible);

                        // Se o app nÃ£o estÃ¡ mais na memÃ³ria (foi finalizado de vez na bandeja)
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
                    // Busca APENAS pelo nome do processo. Se ele existir na memÃ³ria
                    // (mesmo sem janela, na bandeja do Windows), consideramos que estÃ¡ vivo!
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
            if (DeferHomeUiRefreshWhileGameplay()) return;
            try
            {
                var running = new List<object>();
                bool hasDoorpiParentActiveGame =
                    _gameSession is { Active: true } &&
                    string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase);

                if (_gameSession is { Active: true } && !string.IsNullOrWhiteSpace(_activeSessionGameId))
                {
                    bool hasConfirmedGameWindow = HasConfirmedGameWindow();
                    string gameStatus = _gameIsMinimized
                        ? "minimized"
                        : ((_gameIsRunningAndDoorpiHidden || hasConfirmedGameWindow) ? "running" : "launching");

                    running.Add(new
                    {
                        channel = "games",
                        id = _activeSessionGameId,
                        kind = "game",
                        status = gameStatus
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
                    var emulator = FindConfiguredEmulatorByExecutablePath(session.Url);

                    running.Add(new
                    {
                        channel = "media",
                        id = media?.Id ?? "",
                        url = session.Url,
                        kind = "exe",
                        appType = emulator != null ? "emulator" : "exe",
                        status = session.DoorpiSuspended ? "minimized" : (session.MouseModeActive ? "active" : "running"),
                        name = emulator?.Name ?? media?.Name ?? Path.GetFileNameWithoutExtension(session.Url) ?? "Aplicativo",
                        heroImage = MediaHeroVisual(media),
                        gridImage = emulator?.GridImage ?? MediaGridVisual(media)
                    });
                }

                if (_webAppSession is { WebView: not null } && !string.IsNullOrWhiteSpace(_currentWebAppUrl))
                {
                    var media = FindMediaAppByUrlOrId(_currentWebAppUrl);
                    running.Add(new
                    {
                        channel = "media",
                        id = media?.Id ?? "",
                        url = _currentWebAppUrl,
                        kind = "web",
                        appType = string.IsNullOrWhiteSpace(media?.Type) ? "webview" : media!.Type,
                        status = _webAppWindow?.WindowState == WindowState.Minimized ? "minimized" : "running",
                        name = media?.Name ?? (_isGenericBrowserMode ? "Browser" : "Web App"),
                        heroImage = MediaHeroVisual(media),
                        gridImage = MediaGridVisual(media)
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

                if (IsStoreInstallFlowActive() &&
                    !string.IsNullOrWhiteSpace(_pendingStoreInstallId))
                {
                    var (storeInstallHero, storeInstallGrid) = StoreInstallExecutionVisuals();
                    running.Add(new
                    {
                        channel = "stores",
                        id = _pendingStoreInstallId,
                        url = _pendingStoreInstallUrl,
                        kind = "storeInstall",
                        appType = "storeInstall",
                        status = "running",
                        name = StoreInstallExecutionName(),
                        heroImage = storeInstallHero,
                        gridImage = storeInstallGrid
                    });
                }

                var gpuUpdaterRuntime = BuildGpuUpdaterRuntimeSession();
                if (gpuUpdaterRuntime != null)
                    running.Add(gpuUpdaterRuntime);

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

                    ResumeExecutionLockWatch();
                    SendGameLaunchStatus("gameLaunchDone");
                    BeginStoreTransitionOverlay("returning");
                    CommitActiveSession();
                    ClearGameWindowSession();
                    _gameIsMinimized = false;
                    _gameIsRunningAndDoorpiHidden = false;

                    _storeChildGameActive = false;
                    _storeChildGameStoreId = "";
                    _storeChildGameId = "";

                    if (_isStoreLauncherSession)
                    {
                        _ = CloseStoreChildLayerAndResumeStoreAsync(storeChildStoreId);
                    }
                    else
                    {
                        EndStoreTransitionOverlay();
                        ForceFocus();
                    }

                    SendRuntimeSessionsToUI();
                    return;
                }

                string lockedGameProcessName = _lockedGameProcessName;
                Process? pendingLaunchProcess = _pendingLaunchProcess;
                int confirmedGameProcessId = 0;
                try
                {
                    if (_currentGameHwnd != IntPtr.Zero)
                    {
                        GetWindowProcessId(_currentGameHwnd, out uint pidRaw);
                        confirmedGameProcessId = (int)pidRaw;
                    }
                }
                catch { }

                _ = Task.Run(() =>
                {
                    try
                    {
                        bool killedConfirmedProcess = false;

                        if (confirmedGameProcessId > 0)
                        {
                            try
                            {
                                using var process = Process.GetProcessById(confirmedGameProcessId);
                                if (!SafeHasExited(process))
                                {
                                    process.Kill(entireProcessTree: true);
                                    killedConfirmedProcess = true;
                                }
                            }
                            catch { }
                        }

                        // Fallback somente por nome EXATO. Busca por substring poderia
                        // encerrar launchers ou aplicativos alheios com nomes parecidos.
                        if (!killedConfirmedProcess && !string.IsNullOrWhiteSpace(lockedGameProcessName))
                        {
                            foreach (var process in Process.GetProcessesByName(lockedGameProcessName))
                            {
                                try
                                {
                                    if (!SafeHasExited(process))
                                    {
                                        process.Kill(entireProcessTree: true);
                                        killedConfirmedProcess = true;
                                    }
                                }
                                catch { }
                                finally { try { process.Dispose(); } catch { } }
                            }
                        }

                        if (!killedConfirmedProcess &&
                            pendingLaunchProcess != null &&
                            !SafeHasExited(pendingLaunchProcess))
                        {
                            try { pendingLaunchProcess.Kill(entireProcessTree: true); } catch { }
                        }
                    }
                    catch { }
                });

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
                string executablePath = ResolveMediaExecutablePath(media, mediaUrl);
                var session = GetExecutableAppSession(mediaUrl) ?? GetExecutableAppSession(url);
                var process = FindAliveMediaExeProcess(mediaUrl, session?.Process);
                if (session != null || process != null || !string.IsNullOrWhiteSpace(executablePath))
                {
                    Interlocked.Exchange(ref _executionLockSuppressUntilUtcTicks,
                        DateTime.UtcNow.AddSeconds(3).Ticks);
                    try { session?.WatcherCts?.Cancel(); } catch { }

                    _ = Task.Run(() =>
                    {
                        try { KillMediaExeProcessTree(mediaUrl, process); } catch { }
                    });

                    if (session != null)
                        ClearExecutableAppSession(session);
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

        private bool IsShellTaskbarForeground()
        {
            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero)
                    return false;

                if (_mainWindowHandle != IntPtr.Zero &&
                    (foreground == _mainWindowHandle || IsChild(_mainWindowHandle, foreground)))
                {
                    return false;
                }

                string className = GetWindowClassName(foreground);
                return string.Equals(className, "Shell_TrayWnd", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(className, "Shell_SecondaryTrayWnd", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(className, "NotifyIconOverflowWindow", StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        private void ScheduleDoorpiRefocusIfTaskbarStealsFocus()
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    int[] delays = { 90, 240, 420 };
                    foreach (int delay in delays)
                    {
                        await Task.Delay(delay).ConfigureAwait(false);
                        await Dispatcher.InvokeAsync(() =>
                        {
                            if (IsShellTaskbarForeground())
                                FocusDoorpiMainWebView(onlyIfFocusLost: false);
                        });
                    }
                }
                catch { }
            });
        }

        private void RestoreMainUiControllerOwnership()
        {
            // A Home voltou a ser a superficie interativa. Nenhum controlador de
            // mouse de uma janela externa pode continuar consumindo o direcional.
            RequestMediaMouseInputAbort();
            StopMediaControllerMode();
            foreach (var session in _executableAppSessions.Values)
                ReleaseExecutableForegroundOwnership(session);
            StopGameLaunchStoreMouseMode();
            _launcherMouseActive = false;
            _storeMouseModeActive = false;
            _storeMouseInputTemporarilyDisabled = false;
            _mainUiGamepadSuspendedForGame = false;
            _mainUiOwnsDirectionalNavigation = true;
            Interlocked.Exchange(ref _mainUiGamepadSuppressUntilUtcTicks, 0);
            Interlocked.Exchange(ref _focusRestoredAtTicks, DateTime.UtcNow.Ticks);
            if (Dispatcher.CheckAccess())
                CloseGenericBrowserDownloadsPopup();
            else
                _ = Dispatcher.BeginInvoke(CloseGenericBrowserDownloadsPopup);
        }

        public void ForceFocus()
        {
            ResumeGameplayBackgroundMode();
            // Se o jogo foi minimizado pelo usuÃ¡rio (Xbox button) e ainda estÃ¡ vivo,
            // preserva a sessÃ£o â€” fechar um webapp nÃ£o deve destruir o contexto do jogo.
            bool hasLockedGameProcess = !string.IsNullOrWhiteSpace(_lockedGameProcessName);
            bool preserveGameSession = !string.IsNullOrEmpty(_activeSessionGameId) && (
                IsLockedGameProcessAlive() ||
                (!hasLockedGameProcess && IsPendingLaunchProcessAlive()) ||
                IsLastVisibleWindowStillValid()
            );
            bool closeDirectRiotClient = !preserveGameSession && IsActiveDirectRiotGameSession();

            if (!preserveGameSession)
            {
                CommitActiveSession();
                ClearGameWindowSession();
                if (closeDirectRiotClient)
                    _ = Task.Run(KillRiotClientProcesses);
            }
            else
            {
                // Jogo minimizado e vivo: sÃ³ sinaliza que o Doorpi estÃ¡ visÃ­vel
                _gameIsRunningAndDoorpiHidden = false;
                // _gameIsMinimized, _currentGameHwnd, _gameSessionActive, 
                // _activeSessionGameId e _lockedGameProcessName ficam intactos
            }

            ClearExecutionLock();
            ClearGameFocusFallbackPrompt();
            RestoreMainUiControllerOwnership();
            if (_systemControllerActive) StopSystemControllerMode();

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
                ReleaseDoorpiTopmost();

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
                ScheduleDoorpiRefocusIfTaskbarStealsFocus();
            });
        }
        private void FocusDoorpiKeepSession(bool forceAboveHungGame = false)
        {
            ResumeGameplayBackgroundMode();
            RestoreMainUiControllerOwnership();

            SendGameLaunchStatus("gameLaunchDone");
            ReleaseAllStuckKeys();

            Dispatcher.BeginInvoke(() =>
            {
                var hwnd = _mainWindowHandle != IntPtr.Zero
                    ? _mainWindowHandle
                    : new System.Windows.Interop.WindowInteropHelper(this).Handle;

                if (WindowState != WindowState.Maximized) WindowState = WindowState.Maximized;
                if (forceAboveHungGame)
                {
                    this.Topmost = true;
                    SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                }
                else
                {
                    ReleaseDoorpiTopmost();
                }

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
                ScheduleDoorpiRefocusIfTaskbarStealsFocus();

                if (forceAboveHungGame)
                {
                    _ = Task.Run(async () =>
                    {
                        await Task.Delay(1000).ConfigureAwait(false);
                        await Dispatcher.InvokeAsync(ReleaseDoorpiTopmost);
                    });
                }

            });
        }

        private void MinimizeCurrentGameAndRestoreDoorpi()
        {
            if (!CanMinimizeCurrentGameSession())
                return;

            ResumeGameplayBackgroundMode();

            Debug.WriteLine("\n=======================================================");
            Debug.WriteLine("[DEBUG MINIMIZE] INICIANDO MINIMIZAÃ‡ÃƒO DA SESSÃƒO");

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

            // Minimiza a janela da sessÃ£o atual: jogo real, launcher conhecido, ou pending-process.
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
                // PostMessage SC_MINIMIZE Ã© mais confiÃ¡vel para DX9/DX11 fullscreen exclusivo;
                // ShowWindowAsync tambem e enviado sempre: PostMessage pode retornar true
                // mesmo quando uma janela travada nunca processara o WM_SYSCOMMAND.
                PostMessage(targetHwnd, WM_SYSCOMMAND, new IntPtr(SC_MINIMIZE), IntPtr.Zero);
                ShowWindowAsync(targetHwnd, 6);

                _lastVisibleWindowBeforeMinimize = targetHwnd;
            }

            bool targetWasHung = targetHwnd != IntPtr.Zero && IsWindowMarkedNotResponding(targetHwnd);

            DiscordRpcManager.Instance.UpdateState("menu");


            Task.Run(async () =>
            {
                await Task.Delay(500);
                Dispatcher.Invoke(() => FocusDoorpiKeepSession(targetWasHung));
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
            "goggalaxy", "riot client", "riotclientservices", "riotclientux", "riotclientuxrender",
            "leagueclient", "leagueclientux", "leagueclientuxrender",
            "rockstarservice", "rockstarlauncher",
            "redprelauncher", "2klauncher", "t2gp", "gameoverlayui",
            "xbox", "xboxapp", "xboxpcapp", "gamingapp", "gamingservices",
            "gamingservicesnet", "gamingoverlay", "gamebar", "gamebarftserver",
            "winstore.app", "storeexperiencehost", "storepurchaseapp", "windowsstore"
        };

        private static readonly string[] _gameWindowIgnoredNameFragments =
        {
            "launcher", "bootstrapper", "updater", "installer", "setup",
            "patcher", "overlay", "webhelper", "store", "loja", "shop"
        };

        private static bool HasIgnoredGameWindowNameFragment(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            return _gameWindowIgnoredNameFragments.Any(fragment =>
                value.Contains(fragment, StringComparison.OrdinalIgnoreCase));
        }

        private static readonly HashSet<string> _shellProcessNames = new(StringComparer.OrdinalIgnoreCase)
        {
            "explorer", "shellexperiencehost", "startmenuexperiencehost", "searchhost",
            "searchapp", "taskmgr", "applicationframehost", "textinputhost"
        };

        private static readonly HashSet<string> _steamClientProcessNames = new(StringComparer.OrdinalIgnoreCase)
        {
            "steam", "steamwebhelper", "gameoverlayui"
        };

        private static bool IsSteamClientProcessName(string processName)
            => !string.IsNullOrWhiteSpace(processName) &&
               _steamClientProcessNames.Contains(processName);

        private bool ShouldIgnoreSteamAccountSelectionWindow(Process process)
            => _steamAccountSelectionWindowGuardActive &&
               IsSteamClientProcessName(SafeProcessName(process));

        private void CloseVisibleSteamWindowsAfterGameLaunch(IntPtr gameHwnd = default)
        {
            try
            {
                foreach (var hwnd in EnumerateTopLevelWindows())
                {
                    if (hwnd == IntPtr.Zero ||
                        hwnd == _mainWindowHandle ||
                        hwnd == gameHwnd ||
                        !IsWindow(hwnd) ||
                        !IsWindowVisible(hwnd))
                    {
                        continue;
                    }

                    GetWindowProcessId(hwnd, out uint pidRaw);
                    if (pidRaw == 0 || pidRaw == Environment.ProcessId)
                        continue;

                    using var process = Process.GetProcessById((int)pidRaw);
                    string processName = SafeProcessName(process);
                    if (!string.Equals(processName, "steam", StringComparison.OrdinalIgnoreCase) &&
                        !string.Equals(processName, "steamwebhelper", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    PostMessage(hwnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Steam] Falha ao fechar janelas visiveis apos launch: " + ex.Message);
            }
        }

        private bool ShouldAlwaysIgnoreGameWindowProcess(Process process)
        {
            try
            {
                var processName = SafeProcessName(process);
                if (string.IsNullOrWhiteSpace(processName))
                    return true;

                if (_shellProcessNames.Contains(processName))
                    return true;

                if (_knownLauncherProcessNames.Contains(processName))
                    return true;

                var processPath = SafeProcessPath(process);
                var exeName = Path.GetFileNameWithoutExtension(processPath);
                var haystack = $"{processName} {exeName}".ToLowerInvariant();
                if (HasIgnoredGameWindowNameFragment(haystack))
                    return true;

                return false;
            }
            catch { return true; }
        }

        private Process? FindSteamClientProcess(string steamExe)
        {
            if (!string.IsNullOrWhiteSpace(steamExe))
            {
                try
                {
                    var running = FindRunningProcessForExe(steamExe);
                    if (running != null)
                        return running;
                }
                catch { }
            }

            try
            {
                return Process.GetProcessesByName("steam").FirstOrDefault();
            }
            catch { return null; }
        }

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
        private List<GameWindowCandidate> FindGameplayWindowCandidates(HashSet<IntPtr> snapshot, GameLaunchMonitorContext context)
        {
            var result = new List<GameWindowCandidate>();
            var shell = GetShellWindow();

            EnumWindows((hWnd, _) =>
            {
                if (hWnd == _mainWindowHandle || hWnd == shell) return true;
                if (snapshot.Contains(hWnd)) return true;
                if (!IsPotentialGameWindow(hWnd)) return true;

                try
                {
                    GetWindowProcessId(hWnd, out uint pid);
                    var proc = Process.GetProcessById((int)pid);
                    int score = ScoreGameWindowCandidate(context, proc, hWnd);
                    if (score < 80) return true;

                    context.SeenCandidatePids.Add((int)pid);
                    result.Add(new GameWindowCandidate
                    {
                        Hwnd = hWnd,
                        ProcessId = (int)pid,
                        ProcessName = SafeProcessName(proc),
                        Score = score
                    });
                }
                catch { }

                return true;
            }, IntPtr.Zero);

            return result
                .OrderByDescending(candidate => candidate.Score)
                .ToList();
        }

        private List<IntPtr> FindGameplayWindows(HashSet<IntPtr> snapshot, GameLaunchMonitorContext context)
            => FindGameplayWindowCandidates(snapshot, context)
                .Select(candidate => candidate.Hwnd)
                .ToList();

        private GameWindowCandidate? TryScoreGameWindowCandidate(GameLaunchMonitorContext context, IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero || !IsWindow(hWnd))
                return null;

            try
            {
                GetWindowProcessId(hWnd, out uint pidRaw);
                var pid = (int)pidRaw;
                if (pid <= 0 || pid == Environment.ProcessId)
                    return null;

                var process = Process.GetProcessById(pid);
                var score = ScoreGameWindowCandidate(context, process, hWnd);
                if (score <= 0)
                    return null;

                return new GameWindowCandidate
                {
                    Hwnd = hWnd,
                    ProcessId = pid,
                    ProcessName = SafeProcessName(process),
                    Score = score
                };
            }
            catch { return null; }
        }

        private bool ShouldPromoteGameWindowCandidate(GameWindowCandidate candidate, GameWindowCandidate? current)
        {
            if (candidate.Hwnd == IntPtr.Zero)
                return false;

            if (current == null ||
                current.Hwnd == IntPtr.Zero ||
                !IsWindow(current.Hwnd) ||
                !IsWindowVisible(current.Hwnd) ||
                IsIconic(current.Hwnd))
            {
                return true;
            }

            if (candidate.Hwnd == current.Hwnd)
                return false;

            return candidate.Score >= 120 && candidate.Score >= current.Score + 25;
        }

        private void AdoptGameWindowCandidate(GameWindowCandidate candidate, GameModel game)
        {
            _currentGameHwnd = candidate.Hwnd;
            _lockedGameProcessName = candidate.ProcessName;
            _currentLauncherHwnd = IntPtr.Zero;
            _pendingLaunchProcess = null;
            _lastVisibleWindowBeforeMinimize = candidate.Hwnd;

            if (string.Equals(StorePolicyKeyForGame(game), "Steam", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(_storeChildGameStoreId, "Steam", StringComparison.OrdinalIgnoreCase))
            {
                CloseVisibleSteamWindowsAfterGameLaunch(candidate.Hwnd);
            }

            StopGameLaunchStoreMouseMode();
            DelayGameMinimizeAvailability();
            StopSteamAccountSelectionControlsForGame();

            if (_storeChildGameActive &&
                string.Equals(_gameSessionParentKind, "store", StringComparison.OrdinalIgnoreCase))
            {
                ClearStorePendingChildWindows();
                _storeMinimizeState = StoreMinimizeState.StoreChildGameValid;
                _storeAttachedProcessIds.Add(candidate.ProcessId);
                _storeAttachedWindowHandles.Add(candidate.Hwnd);
                CaptureStoreAttachedSessionArtifacts();
            }
        }

        private bool IsPotentialGameWindow(IntPtr hWnd)
        {
            if (!IsWindowVisible(hWnd) || IsIconic(hWnd)) return false;
            if (hWnd == _mainWindowHandle) return false;
            if (hWnd == GetShellWindow()) return false;
            if (!GetWindowRect(hWnd, out RECT r)) return false;

            int w = r.Width;
            int h = r.Height;
            if (w <= 0 || h <= 0) return false;

            return w >= 160 && h >= 120;
        }

        private bool IsGameplayWindow(IntPtr hWnd)
        {
            if (!IsPotentialGameWindow(hWnd)) return false;
            if (!GetWindowRect(hWnd, out RECT r)) return false;

            int w = r.Width;
            int h = r.Height;
            int screenW = (int)System.Windows.SystemParameters.PrimaryScreenWidth;
            int screenH = (int)System.Windows.SystemParameters.PrimaryScreenHeight;

            double coverage = (double)(w * h) / (double)(screenW * screenH);
            return coverage >= 0.80;
        }

        private void StartGameLaunchMonitor(
            GameModel game,
            Process? launched,
            HashSet<int> baselineProcessIds,
            HashSet<IntPtr> baselineWindowHandles)
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
            _lockedGameProcessName = "";  // ? NOVO: limpa sessÃ£o anterior

            SendRuntimeSessionsToUI();

            _ = Task.Run(() => MonitorGameLaunchAsync(
                game,
                baselineWindowHandles,
                baselineProcessIds,
                launched,
                cts.Token));
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

                // Ignora janelinhas minÃºsculas de background
                if (!GetWindowRect(hWnd, out RECT r) || r.Width < 300 || r.Height < 300) return true;

                // 1. TRAVA GLOBAL DE LAUNCHER
                try
                {
                    GetWindowProcessId(hWnd, out uint pid);
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

                // 2. VERIFICA COBERTURA DA TELA (Hands Off para jogos jÃ¡ grandes/fullscreen)
                double coverage = (double)(r.Width * r.Height) / (double)(screenW * screenH);

                if (coverage >= 0.80)
                {
                    alreadyProcessed.Add(hWnd);
                    return false; // Achou a janela principal, para de procurar.
                }

                // 3. DÃ¡ pra redimensionar?
                int style = GetWindowLong(hWnd, GWL_STYLE);
                bool canResize = (style & WS_THICKFRAME) != 0 || (style & WS_MAXIMIZEBOX) != 0;

                if (!canResize)
                {
                    // Se Ã© menor que 80% da tela e NÃƒO tem botÃ£o de maximizar...
                    // Ã‰ um Launcher de janela fixa ou caixa de diÃ¡logo
                    alreadyProcessed.Add(hWnd);
                    return true;
                }

                // 4. MAXIMIZAÃ‡ÃƒO SEGURA (Ã‰ janela de jogo, dÃ¡ pra esticar)
                alreadyProcessed.Add(hWnd);

                // Doorpi vai pra trÃ¡s
                SetWindowPos(_mainWindowHandle, HWND_NOTOPMOST, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);

                FocusExternalWindow(hWnd);

                // Pede com educaÃ§Ã£o pro Windows maximizar a janela
                SetWindowPos(hWnd, HWND_TOP, 0, 0, screenW, screenH, 0);
                ShowWindow(hWnd, 3);

                return false; // Achou a janela e maximizou, fim!
            }, IntPtr.Zero);
        }
        private async Task MonitorGameLaunchAsync(
            GameModel game,
            HashSet<IntPtr> windowSnapshot,
            HashSet<int>? baselineProcessIds,
            Process? launched,
            CancellationToken token)
        {
            try
            {
                bool doorpiHidden = false;
                var alreadyProcessed = new HashSet<IntPtr>();
                int missingChecks = 0;
                var startedUtc = DateTime.UtcNow;
                var stableMonitorEligibleUtc = DateTime.MaxValue;
                string lockedProcessName = "";
                var context = new GameLaunchMonitorContext
                {
                    Game = game,
                    BaselineProcessIds = baselineProcessIds ?? SnapshotProcessIds(),
                    LaunchedProcess = launched,
                    LaunchedProcessId = SafeProcessId(launched),
                    DirectExePath = GetDirectGameExePath(game),
                    NameTokens = BuildGameNameTokens(game),
                    StartedUtc = startedUtc
                };

                while (!token.IsCancellationRequested && !_launchCancelled)
                {
                    // --- MÃGICA: PAUSA ABSOLUTA DA BUSCA SE TIVER MINIMIZADO ---
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

                    // Once the confirmed gameplay window has remained stable long
                    // enough, checking that one HWND is substantially cheaper than
                    // enumerating and scoring every top-level window three times a
                    // second. If it disappears, the full discovery path below runs
                    // again and can adopt a replacement window/process.
                    if (doorpiHidden &&
                        DateTime.UtcNow >= stableMonitorEligibleUtc &&
                        _currentGameHwnd != IntPtr.Zero &&
                        IsWindow(_currentGameHwnd))
                    {
                        missingChecks = 0;
                        await Task.Delay(1000, token).ConfigureAwait(false);
                        continue;
                    }

                    var candidates = FindGameplayWindowCandidates(windowSnapshot, context);

                    if (candidates.Count > 0)
                    {
                        var bestCandidate = candidates[0];
                        var currentCandidate = TryScoreGameWindowCandidate(context, _currentGameHwnd);
                        bool promoted = ShouldPromoteGameWindowCandidate(bestCandidate, currentCandidate);
                        if (promoted)
                        {
                            AdoptGameWindowCandidate(bestCandidate, game);
                            lockedProcessName = bestCandidate.ProcessName;
                        }
                        else if (string.IsNullOrWhiteSpace(lockedProcessName) && currentCandidate != null)
                        {
                            // Another launch path may have found the game window first. It
                            // still needs full adoption so a visible launcher can no longer
                            // keep the session in its intermediate mouse/launch state.
                            AdoptGameWindowCandidate(currentCandidate, game);
                            lockedProcessName = currentCandidate.ProcessName;
                        }

                        missingChecks = 0;

                        if (!doorpiHidden)
                        {
                            if (_launchCancelled) return;

                            SendGameLaunchStatus("gameLaunchReady", game.Name, game.HeroImage ?? "", game.GridImage ?? "");

                            await EnsureMinimumAnimationTimeAsync(token).ConfigureAwait(false);
                            if (token.IsCancellationRequested || _launchCancelled) return;

                            doorpiHidden = true;
                            stableMonitorEligibleUtc = DateTime.UtcNow.AddSeconds(10);
                            _gameIsRunningAndDoorpiHidden = true;
                            ConfirmActiveSessionClock();

                            SendDoorpiToBackground();
                            Dispatcher.Invoke(() =>
                            {
                                if (GetWindowRect(_currentGameHwnd, out RECT r))
                                {
                                    int screenW = (int)SystemParameters.PrimaryScreenWidth;
                                    int screenH = (int)SystemParameters.PrimaryScreenHeight;
                                    double coverage = (double)(r.Width * r.Height) / (double)(screenW * screenH);
                                    if (coverage < 0.80)
                                        FocusExternalWindow(_currentGameHwnd);

                                }

                            });

                            SendGameLaunchStatus("gameLaunchDone");
                            VerifyGameFocusOrPromptAsync(_currentGameHwnd, game);
                            DiscordRpcManager.Instance.UpdateState("game", game.Name);

                        }
                        else if (_gameSession?.FocusFallbackPromptVisible == true && IsForegroundOwnedByCurrentGame())
                        {
                            Dispatcher.Invoke(() =>
                            {
                                _gameIsRunningAndDoorpiHidden = true;
                                ClearGameFocusFallbackPrompt();
                                SendRuntimeSessionsToUI();
                            });
                        }
                    }
                    else if (!doorpiHidden)
                    {
                        if (IsDirectRiotGameLaunch(game) &&
                            string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase))
                        {
                            bool riotUiActive = Dispatcher.Invoke(() => TryActivateDirectRiotClientInputForGame(game));
                            if (riotUiActive)
                            {
                                startedUtc = DateTime.UtcNow;
                                await Task.Delay(300, token).ConfigureAwait(false);
                                continue;
                            }
                        }

                        if (Dispatcher.Invoke(() => TryActivateLaunchStoreMouseModeForGame(game)))
                        {
                            startedUtc = DateTime.UtcNow;
                            await Task.Delay(300, token).ConfigureAwait(false);
                            continue;
                        }

                        // Qualquer janela nova: tenta foco + fullscreen/maximize
                        Dispatcher.Invoke(() => TryFocusAndMaximizeNewWindow(windowSnapshot, alreadyProcessed));

                        bool hasIntermediateLaunchUi =
                            _gameLaunchStoreMouseModeActive ||
                            alreadyProcessed.Any(hwnd =>
                                IsWindow(hwnd) && (IsWindowVisible(hwnd) || IsIconic(hwnd)));
                        if (hasIntermediateLaunchUi)
                        {
                            // Um launcher/dialogo valido ja iniciou. Timeout volta a ser
                            // relevante apenas se toda a UI intermediaria desaparecer.
                            startedUtc = DateTime.UtcNow;
                        }
                        else if ((DateTime.UtcNow - startedUtc).TotalMilliseconds > GAME_WINDOW_DETECTION_TIMEOUT_MS)
                        {
                            Dispatcher.Invoke(() => CancelUnresolvedGameLaunch(game));
                            return;
                        }
                    }
                    else if (doorpiHidden)
                    {
                        // A TELA DE JOGO SUMIU: Verifica se o processo travado ainda estÃ¡ vivo
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
                            // O executÃ¡vel estÃ¡ vivo (trocando de tela, piscando DirectX, etc).
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

        private void CancelUnresolvedGameLaunch(GameModel? game = null)
        {
            bool hadStoreChildContext =
                _storeChildGameActive &&
                string.Equals(_gameSessionParentKind, "store", StringComparison.OrdinalIgnoreCase);

            string storeId = hadStoreChildContext ? _storeChildGameStoreId : "";
            bool closeDirectRiotClient =
                !hadStoreChildContext &&
                IsDirectRiotGameLaunch(game) &&
                string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase);

            _launchCancelled = true;
            ResetGameMinimizeGrace();

            try
            {
                if (_pendingLaunchProcess != null &&
                    !SafeHasExited(_pendingLaunchProcess) &&
                    (!hadStoreChildContext || !IsProcessActiveStoreLauncher(_pendingLaunchProcess)))
                {
                    _pendingLaunchProcess.Kill(entireProcessTree: true);
                }
            }
            catch { }

            try
            {
                lock (_gameLaunchMonitorLock)
                {
                    _gameLaunchMonitorCts?.Cancel();
                }
            }
            catch { }

            ClearGameFocusFallbackPrompt();
            _gameIsMinimized = false;
            _gameIsRunningAndDoorpiHidden = false;
            _currentGameHwnd = IntPtr.Zero;
            _currentLauncherHwnd = IntPtr.Zero;
            _pendingLaunchProcess = null;
            _lockedGameProcessName = "";
            ClearGameWindowSession();
            if (closeDirectRiotClient)
                _ = Task.Run(KillRiotClientProcesses);
            _storeChildGameActive = false;
            _storeChildGameStoreId = "";
            _storeChildGameId = "";

            if (hadStoreChildContext &&
                _isStoreLauncherSession &&
                string.Equals(_activeStoreId, storeId, StringComparison.OrdinalIgnoreCase))
            {
                DelayStorePendingChildClosedGrace();
                _storeMinimizeState = StoreMinimizeState.StoreReturningToValid;
            }

            ForceFocus();
            SendGameLaunchStatus(
                "gameLaunchFailed",
                game?.Name ?? "",
                game?.HeroImage ?? "",
                game?.GridImage ?? "",
                "timeout");
            SendRuntimeSessionsToUI();
        }
        // -- Session tracking ------------------------------------------------------
        private void StartActiveSessionClock(bool confirmed = false)
        {
            lock (_sessionPlaytimeLock)
            {
                GameWindowSession session = EnsureGameSession();
                session.StartedUtc = DateTime.MinValue;
                session.InitialPlaytimeMinutes = -1;
                session.LastCheckpointElapsedMinutes = 0;
                session.LastCheckpointElapsedSeconds = 0;
                session.PlaytimeSessionId = "";
                try
                {
                    _playtimeCheckpointTimer?.Change(
                        Timeout.InfiniteTimeSpan,
                        Timeout.InfiniteTimeSpan);
                }
                catch (ObjectDisposedException) { }
            }

            if (confirmed)
                ConfirmActiveSessionClock();
        }

        private void QueueActiveSessionCheckpoint()
        {
            PersistActiveSessionJournal();
        }

        private void StopPlaytimeCheckpointTimer()
        {
            lock (_sessionPlaytimeLock)
            {
                try
                {
                    _playtimeCheckpointTimer?.Change(Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
                }
                catch (ObjectDisposedException) { }
            }
        }

        private void CommitActiveSession()
            => PersistActiveSessionPlaytime(finalize: true);

        private void PersistActiveSessionPlaytime(bool finalize)
        {
            if (finalize)
                FinalizeActiveSessionPlaytime();
            else
                PersistActiveSessionJournal();
        }

        private void PersistDeletedGameSessionCheckpoint(
            GameWindowSession session,
            string gameName,
            int elapsedMinutes)
        {
            var history = LoadGameHistory();
            string key = NormalizeGameName(gameName);
            var entry = history.FirstOrDefault(item => NormalizeGameName(item.Name) == key);
            if (entry == null)
            {
                entry = new GameHistoryEntry
                {
                    Name = gameName,
                    FirstPlayed = DateTime.Now
                };
                history.Add(entry);
            }

            if (session.InitialPlaytimeMinutes < 0)
                session.InitialPlaytimeMinutes = Math.Max(0, entry.TotalPlaytimeMinutes);

            long desiredTotal = SaturatingAddPlaytimeMinutes(
                session.InitialPlaytimeMinutes,
                elapsedMinutes);
            entry.TotalPlaytimeMinutes = Math.Max(entry.TotalPlaytimeMinutes, desiredTotal);
            entry.LastSessionMinutes = elapsedMinutes;
            entry.LastPlayed = DateTime.Now;
            SaveGameHistory(history);
        }



        private void SendGameLaunchStatus(string type, string gameName = "", string heroImage = "", string gridImage = "", string reason = "")
        {
            if (IsGameplayBackgroundMode)
            {
                Interlocked.Exchange(ref _homeUiRefreshPendingAfterGameplay, 1);
                return;
            }

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

                GetWindowProcessId(foreground, out var pidRaw);
                return pidRaw == Environment.ProcessId;
            }
            catch { return false; }
        }

        private bool IsForegroundAllowedForExternalSessionInput()
        {
            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero)
                    return false;

                if (_mainWindowHandle != IntPtr.Zero &&
                    (foreground == _mainWindowHandle || IsChild(_mainWindowHandle, foreground)))
                {
                    return false;
                }

                if (foreground != _lastExternalForegroundAttachmentHwnd)
                {
                    _lastExternalForegroundAttachmentHwnd = foreground;
                    CaptureForegroundExternalWindowForActiveSession(foreground);
                }

                return true;
            }
            catch { return false; }
        }

        private void CaptureForegroundExternalWindowForActiveSession(IntPtr foreground)
        {
            if (foreground == IntPtr.Zero ||
                foreground == GetShellWindow() ||
                foreground == _mainWindowHandle ||
                (_mainWindowHandle != IntPtr.Zero && IsChild(_mainWindowHandle, foreground)))
            {
                return;
            }

            try
            {
                if (!IsWindowVisible(foreground))
                    return;

                GetWindowProcessId(foreground, out var pidRaw);
                int pid = (int)pidRaw;
                if (pid <= 0 || pid == Environment.ProcessId)
                    return;

                using var process = Process.GetProcessById(pid);
                if (SafeHasExited(process))
                    return;

                string processName = SafeProcessName(process);
                if (string.IsNullOrWhiteSpace(processName) ||
                    _shellProcessNames.Contains(processName))
                {
                    return;
                }

                if (_isStoreLauncherSession &&
                    !_storePausedByDoorpi &&
                    !IsStoreChildGameBlockingStoreControls() &&
                    !_storeWindowSnapshot.Contains(foreground) &&
                    !IsProcessActiveStoreLauncher(process))
                {
                    _storeAttachedWindowHandles.Add(foreground);
                    if (!_storeProcessSnapshot.Contains(pid))
                        _storeAttachedProcessIds.Add(pid);
                    return;
                }

                var session = ActiveExecutableAppSession;
                if (session != null &&
                    _mediaExeModeActive &&
                    _mediaExeSessionId == session.SessionId &&
                    !session.IsBaselineProcess(pid))
                {
                    session.AddProcessGroupId(pid);
                    session.AddAttachedWindowHandle(foreground);
                }
            }
            catch { }
        }

        private bool IsForegroundOwnedByExecutablePath(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return false;
            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero) return false;
                GetWindowProcessId(foreground, out var pidRaw);
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

                GetWindowProcessId(foreground, out var pidRaw);
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

                    GetWindowProcessId(foreground, out var pidRaw);
                    if (pidRaw != 0 && pidRaw == (uint)storeProc.Id) return true;
                }
                catch { }
            }

            return !string.IsNullOrWhiteSpace(_storeLauncherExe) &&
                   IsForegroundOwnedByExecutablePath(_storeLauncherExe);
        }

        private bool IsForegroundOwnedByActiveStoreMainWindow()
        {
            if (!_isStoreLauncherSession ||
                _storePausedByDoorpi ||
                string.IsNullOrWhiteSpace(_activeStoreId))
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
                if (IsProcessActiveStoreLauncher(process))
                    return true;

                if (!string.IsNullOrWhiteSpace(_storeLauncherExe) &&
                    TryFindStoreWindow(_activeStoreId ?? "", _storeLauncherExe, out var storeProc, out var storeHwnd))
                {
                    if (foreground == storeHwnd)
                        return true;

                    GetWindowProcessId(foreground, out var pidRaw);
                    return pidRaw != 0 && pidRaw == (uint)storeProc.Id;
                }

                return false;
            }
            catch { return false; }
            finally
            {
                try { process.Dispose(); } catch { }
            }
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
                GetWindowProcessId(hwnd, out uint pidRaw);
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

                GetWindowProcessId(foreground, out var pidRaw);
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

        private static string GetWindowClassName(IntPtr hWnd)
        {
            try
            {
                var builder = new StringBuilder(256);
                return GetClassName(hWnd, builder, builder.Capacity) > 0 ? builder.ToString() : "";
            }
            catch { return ""; }
        }

        private static bool LooksLikeAltTabSwitcher(IntPtr hWnd)
        {
            var className = GetWindowClassName(hWnd);
            if (string.IsNullOrWhiteSpace(className)) return false;

            return className.Contains("TaskSwitcher", StringComparison.OrdinalIgnoreCase) ||
                   className.Contains("Multitasking", StringComparison.OrdinalIgnoreCase) ||
                   className.Contains("XamlExplorerHost", StringComparison.OrdinalIgnoreCase);
        }

        private bool IsShellLikeWindow(IntPtr hWnd)
        {
            try
            {
                if (hWnd == IntPtr.Zero || hWnd == GetShellWindow())
                    return true;

                GetWindowProcessId(hWnd, out var pidRaw);
                if (pidRaw == 0) return true;

                using var process = Process.GetProcessById((int)pidRaw);
                return _shellProcessNames.Contains(SafeProcessName(process));
            }
            catch { return false; }
        }

        private bool IsRestorableGameWindow(IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero) return false;
            try
            {
                return IsWindow(hwnd) && (IsWindowVisible(hwnd) || IsIconic(hwnd));
            }
            catch { return false; }
        }

        private bool HasConfirmedGameWindow()
        {
            if (string.IsNullOrWhiteSpace(_lockedGameProcessName))
                return false;

            if (IsRestorableGameWindow(_currentGameHwnd))
                return true;

            try
            {
                foreach (var process in Process.GetProcessesByName(_lockedGameProcessName))
                {
                    try
                    {
                        var hwnd = FindAnyWindowForProcess(process.Id);
                        if (hwnd == IntPtr.Zero) hwnd = process.MainWindowHandle;
                        if (IsRestorableGameWindow(hwnd))
                        {
                            _currentGameHwnd = hwnd;
                            return true;
                        }
                    }
                    catch { }
                }
            }
            catch { }

            return false;
        }

        private bool CanMinimizeCurrentGameSession()
        {
            if (!_gameSessionActive || _gameIsMinimized)
                return false;

            // Uma janela que ja foi confirmada como jogo continua sendo uma rota valida
            // de volta para a Home mesmo se deixou de responder. Nesse caso ignoramos
            // as travas de transicao/grace: o botao Xbox e sempre a saida de emergencia.
            bool confirmed = HasConfirmedGameWindow();
            if (confirmed && IsWindowMarkedNotResponding(_currentGameHwnd))
                return true;

            if (_storeChildGameActive &&
                _isStoreLauncherSession &&
                !_storePausedByDoorpi &&
                TryGetForegroundActiveStoreMainWindow(out _))
            {
                return false;
            }

            if (_storeChildGameActive &&
                string.Equals(_gameSessionParentKind, "store", StringComparison.OrdinalIgnoreCase))
            {
                _storeMinimizeState = confirmed
                    ? StoreMinimizeState.StoreChildGameValid
                    : StoreMinimizeState.StorePendingChild;
            }

            return confirmed && !IsGameMinimizeGraceActive();
        }

        private void DelayGameMinimizeAvailability(int delayMs = EXTERNAL_SESSION_MINIMIZE_GRACE_MS)
        {
            Interlocked.Exchange(ref _gameMinimizeAllowedAfterUtcTicks,
                DateTime.UtcNow.AddMilliseconds(delayMs).Ticks);
        }

        private bool IsGameMinimizeGraceActive()
            => Interlocked.Read(ref _gameMinimizeAllowedAfterUtcTicks) > DateTime.UtcNow.Ticks;

        private void ResetGameMinimizeGrace()
            => Interlocked.Exchange(ref _gameMinimizeAllowedAfterUtcTicks, 0);

        private void ClearGameFocusFallbackPrompt()
        {
            if (_gameSession != null)
                _gameSession.FocusFallbackPromptVisible = false;

            try { webView?.CoreWebView2?.PostWebMessageAsString("{\"type\":\"hideGameFocusFallbackPrompt\"}"); } catch { }
        }

        private void ShowGameFocusFallbackPrompt(GameModel? game = null)
        {
            if (!_gameSessionActive || string.IsNullOrWhiteSpace(_activeSessionGameId))
                return;

            var hwnd = ResolveCurrentGameWindow();
            if (!IsRestorableGameWindow(hwnd))
                return;

            var session = EnsureGameSession();
            var now = DateTime.UtcNow;
            if (session.FocusFallbackPromptVisible)
                return;
            if ((now - session.LastFocusFallbackPromptUtc).TotalMilliseconds < 1200)
                return;

            game ??= LoadGames().FirstOrDefault(g =>
                string.Equals(g.LaunchUrl, _activeSessionGameId, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(g.Path, _activeSessionGameId, StringComparison.OrdinalIgnoreCase));

            session.FocusFallbackPromptVisible = true;
            session.LastFocusFallbackPromptUtc = now;
            _gameIsRunningAndDoorpiHidden = false;

            try
            {
                webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "gameFocusFallbackPrompt",
                    id = _activeSessionGameId,
                    name = game?.Name ?? "Jogo",
                    heroImage = game?.HeroImage ?? "",
                    gridImage = game?.GridImage ?? ""
                }));
            }
            catch { }

            SendRuntimeSessionsToUI();
        }

        private bool TryGetHungCurrentGameWindow(out IntPtr hwnd)
        {
            hwnd = ResolveCurrentGameWindow();
            return IsRestorableGameWindow(hwnd) && IsWindowMarkedNotResponding(hwnd);
        }

        private void ShowHungGameRestorePrompt(GameModel? game = null)
        {
            if (!_gameSessionActive || string.IsNullOrWhiteSpace(_activeSessionGameId))
                return;

            game ??= LoadGames().FirstOrDefault(g =>
                string.Equals(g.LaunchUrl, _activeSessionGameId, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(g.Path, _activeSessionGameId, StringComparison.OrdinalIgnoreCase));

            _gameIsMinimized = true;
            _gameIsRunningAndDoorpiHidden = false;
            SuspendExecutionLockWatch();

            try
            {
                webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "gameHungRestorePrompt",
                    id = _activeSessionGameId,
                    name = game?.Name ?? _activeSessionGameName ?? "Jogo"
                }));
            }
            catch { }

            SendGameLaunchStatus("gameLaunchDone");
            SendRuntimeSessionsToUI();
        }

        private async void VerifyGameFocusOrPromptAsync(IntPtr hwnd, GameModel game, int delayMs = 700)
        {
            if (hwnd == IntPtr.Zero) return;

            try
            {
                await Task.Delay(delayMs).ConfigureAwait(false);
                bool focusRetried = false;
                Dispatcher.Invoke(() =>
                {
                    if (!_gameSessionActive || _gameIsMinimized)
                        return;

                    if (IsForegroundOwnedByCurrentGame())
                    {
                        _gameIsRunningAndDoorpiHidden = true;
                        ClearGameFocusFallbackPrompt();
                        SendGameLaunchStatus("gameLaunchDone");
                        SendRuntimeSessionsToUI();
                        return;
                    }

                    if (IsForegroundDoorpi() && IsRestorableGameWindow(hwnd))
                    {
                        FocusExternalWindow(hwnd);
                        focusRetried = true;
                    }
                });

                if (focusRetried)
                    await Task.Delay(500).ConfigureAwait(false);

                Dispatcher.Invoke(() =>
                {
                    if (!_gameSessionActive || _gameIsMinimized)
                        return;

                    if (IsForegroundOwnedByCurrentGame())
                    {
                        _gameIsRunningAndDoorpiHidden = true;
                        ClearGameFocusFallbackPrompt();
                        SendGameLaunchStatus("gameLaunchDone");
                        SendRuntimeSessionsToUI();
                        return;
                    }

                    if (IsForegroundDoorpi() && IsRestorableGameWindow(hwnd))
                    {
                        _gameIsRunningAndDoorpiHidden = false;
                        ShowGameFocusFallbackPrompt(game);
                    }
                });
            }
            catch { }
        }

        private static INPUT KeyboardInput(ushort key, bool keyUp = false)
        {
            var input = new INPUT { type = INPUT_KEYBOARD };
            input.U.ki = new KEYBDINPUT
            {
                wVk = key,
                dwFlags = keyUp ? KEYEVENTF_KEYUP : 0
            };
            return input;
        }

        private static void SendKey(ushort key, bool keyUp = false)
        {
            var inputs = new[] { KeyboardInput(key, keyUp) };
            SendInputs(inputs);
        }

        private static void SendInputs(INPUT[] inputs)
        {
            uint sent = SendInput((uint)inputs.Length, inputs, INPUT.Size);
            if (sent != inputs.Length)
            {
                int error = Marshal.GetLastWin32Error();
                Debug.WriteLine($"[Input] SendInput enviou {sent}/{inputs.Length} eventos. Win32Error={error}");
            }
        }

        private void BeginManualGameWindowRestore()
        {
            if (!_gameSessionActive)
                return;

            if (TryGetHungCurrentGameWindow(out _))
            {
                ShowHungGameRestorePrompt();
                return;
            }

            ClearGameFocusFallbackPrompt();
            SendGameLaunchStatus("gameLaunchDone");
            ReleaseAllStuckKeys();

            _ = Task.Run(async () =>
            {
                bool directRestoreSucceeded = false;
                bool altDown = false;
                try
                {
                    // O botao Xbox ja restaura pelo HWND confirmado. Fazemos a mesma
                    // tentativa aqui antes de recorrer ao Alt+Tab, cuja ordem Z pode
                    // selecionar um mini-launcher intermediario em vez do jogo.
                    Dispatcher.Invoke(() =>
                    {
                        var hwnd = ResolveCurrentGameWindow();
                        if (IsRestorableGameWindow(hwnd))
                            RestoreGameCleanly(hwnd);
                    });

                    await Task.Delay(900).ConfigureAwait(false);
                    directRestoreSucceeded = IsForegroundOwnedByCurrentGame();
                    if (directRestoreSucceeded)
                        return;

                    SendKey(VK_MENU);
                    altDown = true;
                    await Task.Delay(80).ConfigureAwait(false);
                    SendKey(VK_TAB);
                    await Task.Delay(70).ConfigureAwait(false);
                    SendKey(VK_TAB, keyUp: true);

                    var started = DateTime.UtcNow;
                    while ((DateTime.UtcNow - started).TotalSeconds < 12)
                    {
                        await Task.Delay(180).ConfigureAwait(false);

                        var elapsed = DateTime.UtcNow - started;
                        var foreground = GetForegroundWindow();
                        if (foreground != IntPtr.Zero &&
                            elapsed.TotalMilliseconds >= 900 &&
                            !IsForegroundDoorpi() &&
                            !LooksLikeAltTabSwitcher(foreground) &&
                            !IsShellLikeWindow(foreground))
                        {
                            break;
                        }
                    }
                }
                catch { }
                finally
                {
                    if (altDown)
                    {
                        try { SendKey(VK_MENU, keyUp: true); } catch { }
                    }

                    await Task.Delay(450).ConfigureAwait(false);
                    Dispatcher.Invoke(() =>
                    {
                        if (!_gameSessionActive) return;

                        if (directRestoreSucceeded || IsForegroundOwnedByCurrentGame())
                        {
                            _gameIsMinimized = false;
                            _gameIsRunningAndDoorpiHidden = true;
                            ClearExecutionLock();
                            ClearGameFocusFallbackPrompt();
                            SendGameLaunchStatus("gameLaunchDone");
                            SendRuntimeSessionsToUI();
                        }
                        else if (IsForegroundDoorpi())
                        {
                            _gameIsRunningAndDoorpiHidden = false;
                            ShowExecutionLockForGame();
                        }
                    });
                }
            });
        }

        private void MarkCurrentGameForegroundRestored()
        {
            if (!_gameSessionActive || !_gameIsMinimized) return;

            _gameIsMinimized = false;
            _gameIsRunningAndDoorpiHidden = true;

            if (_storeChildGameActive && _isStoreLauncherSession)
            {
                _storePausedByDoorpi = true;
                _storeMouseModeActive = false;
            }

            ClearExecutionLock();
            ClearGameFocusFallbackPrompt();
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

        private bool HasActiveWebAppWindow()
        {
            try
            {
                IntPtr hwnd = new(Interlocked.Read(ref _activeWebAppWindowHandleValue));
                return _webAppSession is { WebView: not null } &&
                       hwnd != IntPtr.Zero &&
                       IsWindow(hwnd) &&
                       !IsIconic(hwnd) &&
                       !string.IsNullOrWhiteSpace(_currentWebAppUrl);
            }
            catch { return false; }
        }

        private bool WasWebAppRecentlyDeactivatedToDoorpi()
        {
            if (!HasActiveWebAppWindow())
                return false;

            long ticks = Interlocked.Read(ref _lastWebAppDeactivatedUtcTicks);
            if (ticks <= 0) return false;

            return DateTime.UtcNow.Ticks - ticks <= TimeSpan.FromMilliseconds(1500).Ticks;
        }

        private bool IsForegroundOwnedByActiveWebApp()
        {
            try
            {
                if (!HasActiveWebAppWindow())
                    return false;

                IntPtr hwnd = new(Interlocked.Read(ref _activeWebAppWindowHandleValue));
                return hwnd != IntPtr.Zero && GetForegroundWindow() == hwnd;
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
                            (kind == "web" && IsForegroundOwnedByActiveWebApp()) ||
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

            if (kind == "web")
            {
                StartMediaControllerMode();
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
                SendRuntimeSessionsToUI();
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

            // Nunca abrir EM EXECUÃ‡ÃƒO sem alvo acionÃ¡vel.
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
            _storeMouseModeActive = false;
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
            if (_storeTransitionOverlayActive) return false;
            if (string.IsNullOrWhiteSpace(_activeSessionGameId)) return false;
            if (!_gameIsMinimized && !_gameIsRunningAndDoorpiHidden && !HasConfirmedGameWindow()) return false;

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
            if (_storeTransitionOverlayActive) return false;
            if (!_isStoreLauncherSession || string.IsNullOrWhiteSpace(_activeStoreId)) return false;
            if (!IsForegroundDoorpi()) return false;
            if (ShouldCloseRiotStoreBecauseOnlyServiceRemains())
            {
                CloseStoreSessionCompletely();
                return false;
            }
            if (IsStoreMainWindowLookupAwaited(_activeStoreId ?? "", _storeLauncherExe ?? "") &&
                !_storeLauncherWindowSeen)
            {
                return false;
            }
            if (_storeLauncherWindowSeen && !HasActiveStoreLauncherWindow())
            {
                if (ShouldDeferEpicTrayCloseForPotentialChildLaunch())
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

        private bool ShowExecutionLockForMediaExe(string? mediaUrlOverride = null, bool showInDoorpiWhenForeground = false)
        {
            string mediaUrl = !string.IsNullOrWhiteSpace(mediaUrlOverride)
                ? mediaUrlOverride!
                : _mediaExeCurrentUrl;

            if (string.IsNullOrWhiteSpace(mediaUrl))
                return false;

            var media = FindMediaAppByUrlOrId(mediaUrl);
            var emulator = FindConfiguredEmulatorByExecutablePath(mediaUrl);
            mediaUrl = ResolveMediaExecutableUrl(media, mediaUrl);
            ActivateExecutableAppSession(mediaUrl);
            _mediaExeCurrentUrl = mediaUrl;

            var targetSession = GetExecutableAppSession(mediaUrl);
            var aliveProcess = FindAliveMediaExeProcess(mediaUrl, targetSession?.Process);
            if (aliveProcess == null)
                return false;

            if (targetSession != null)
                targetSession.Process = aliveProcess;
            var hwnd = FindAnyWindowForProcess(aliveProcess.Id);
            if (hwnd == IntPtr.Zero) hwnd = aliveProcess.MainWindowHandle;
            if (!showInDoorpiWhenForeground && hwnd != IntPtr.Zero && IsForegroundDoorpi())
            {
                bool shouldTryFocus = targetSession?.AddFocusedWindowHandle(hwnd) ?? true;
                if (shouldTryFocus)
                {
                    FocusExternalWindow(hwnd);
                    _ = Dispatcher.BeginInvoke(async () =>
                    {
                        await Task.Delay(650);
                        if (IsActiveExecutableAppSession(targetSession) &&
                            IsForegroundDoorpi() &&
                            FindAliveMediaExeProcess(mediaUrl, targetSession?.Process) != null)
                            ShowExecutionLockForMediaExe(mediaUrl);
                    });
                    return false;
                }
            }

            ShowExecutionLock(
                "exe",
                emulator?.Name ?? media?.Name ?? Path.GetFileNameWithoutExtension(ResolveMediaExecutablePath(media, mediaUrl)) ?? "Aplicativo",
                "",
                mediaUrl,
                "media",
                emulator != null ? "emulator" : "exe",
                MediaHeroVisual(media),
                emulator?.GridImage ?? MediaGridVisual(media));
            return true;
        }

        private bool ShowExecutionLockForWebApp()
        {
            if (!HasActiveWebAppWindow())
                return false;

            var media = FindMediaAppByUrlOrId(_currentWebAppUrl);
            string appType = string.IsNullOrWhiteSpace(media?.Type) ? "webview" : media!.Type;

            ShowExecutionLock(
                "web",
                media?.Name ?? (_isGenericBrowserMode ? "Browser" : "Web App"),
                "",
                _currentWebAppUrl,
                "media",
                appType,
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

            if (HasActiveWebAppWindow())
                return ShowExecutionLockForWebApp();

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

            // Prioridade absoluta: se existe sessÃ£o de jogo ativa em primeiro plano lÃ³gico,
            // sempre usar o contexto do jogo (mesmo que o runtime candidate venha da loja).
            if (_gameSessionActive &&
                !string.IsNullOrWhiteSpace(_activeSessionGameId))
            {
                ShowExecutionLockForGame();
                return;
            }

            if (_executionLockActive)
                return;

            bool wantsGpuUpdater = string.Equals(kind, "gpuUpdater", StringComparison.OrdinalIgnoreCase) ||
                                   string.Equals(channel, "gpu", StringComparison.OrdinalIgnoreCase);
            if (wantsGpuUpdater && IsGpuUpdaterSessionActive())
            {
                ShowGpuUpdaterExecutionLock();
                return;
            }

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
                if (string.Equals(kind, "web", StringComparison.OrdinalIgnoreCase) ||
                    (!string.IsNullOrWhiteSpace(url) &&
                     string.Equals(_currentWebAppUrl, url, StringComparison.OrdinalIgnoreCase)))
                {
                    if (ShowExecutionLockForWebApp()) return;
                }

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

            // Fallback resiliente: tenta a sessÃ£o ativa conhecida.
            ShowExecutionLockForCurrentSession();
        }

        private IntPtr ResolveCurrentGameWindow()
        {
            IntPtr hwnd = _currentGameHwnd;
            if (hwnd != IntPtr.Zero && (IsWindowVisible(hwnd) || IsIconic(hwnd)))
            {
                if (string.IsNullOrWhiteSpace(_lockedGameProcessName) ||
                    IsWindowOwnedByProcessName(hwnd, _lockedGameProcessName))
                {
                    return hwnd;
                }

                hwnd = IntPtr.Zero;
            }

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

        private bool IsWindowOwnedByProcessName(IntPtr hwnd, string processName)
        {
            if (hwnd == IntPtr.Zero || string.IsNullOrWhiteSpace(processName))
                return false;

            try
            {
                GetWindowProcessId(hwnd, out uint pidRaw);
                if (pidRaw == 0) return false;

                using var process = Process.GetProcessById((int)pidRaw);
                return string.Equals(SafeProcessName(process), processName, StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        private async void RestoreExecutionLockSession()
        {
            // Capture the target before waiting for the controller release. Runtime
            // refreshes are allowed to update/clear the visible lock in the meantime.
            string kind = _executionLockKind;
            string id = _executionLockId;
            string url = _executionLockUrl;

            // Keep the execution lock in front until A/R2 is physically released.
            // Otherwise the release is delivered to the window being restored.
            await WaitForPrimaryControllerReleaseAsync();
            await Task.Delay(50);

            if (string.Equals(kind, "gpuUpdater", StringComparison.OrdinalIgnoreCase))
            {
                ResumeExecutionLockWatch();
                RestoreGpuUpdaterFromExecutionLock();
                return;
            }

            if (string.Equals(kind, "game", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(id))
            {
                var game = LoadGames().FirstOrDefault(g =>
                    string.Equals(g.LaunchUrl, id, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(g.Path, id, StringComparison.OrdinalIgnoreCase));

                if (TryGetHungCurrentGameWindow(out _))
                {
                    ShowHungGameRestorePrompt(game);
                    return;
                }

                // Do not let the Activated/runtime watchers rebuild EM EXECUCAO while
                // focus is being transferred. This mirrors the card restore path that
                // is already reliable after minimizing with the Xbox shortcut.
                Interlocked.Exchange(ref _executionLockSuppressUntilUtcTicks,
                    DateTime.UtcNow.AddSeconds(3).Ticks);
                SuspendExecutionLockWatch();
                ReleaseAllStuckKeys();
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
                CenterCursorOnScreen();

                var hwnd = ResolveCurrentGameWindow();
                if (hwnd != IntPtr.Zero)
                {
                    RestoreGameCleanly(hwnd);
                    _gameIsMinimized = false;
                    _gameIsRunningAndDoorpiHidden = true;
                    SendGameLaunchStatus("gameLaunchDone");
                    SendRuntimeSessionsToUI();
                    ResumeExecutionLockWatch();

                    if (game != null)
                        VerifyGameFocusOrPromptAsync(hwnd, game);
                }
                else
                {
                    _gameIsRunningAndDoorpiHidden = false;
                    SendGameLaunchStatus("gameLaunchDone");
                    SendRuntimeSessionsToUI();
                    ResumeExecutionLockWatch();
                    if (IsForegroundDoorpi())
                        ShowExecutionLockForGame();
                }
                return;
            }

            ResumeExecutionLockWatch();
            ClearExecutionLock();

            if (kind == "store")
            {
                ResumeStoreSession();
                return;
            }

            if (kind == "storeInstall")
            {
                RestoreStoreInstallFromExecutionLock();
                return;
            }

            if (kind == "web" && !string.IsNullOrWhiteSpace(url))
            {
                if (_webAppWindow != null &&
                    string.Equals(_currentWebAppUrl, url, StringComparison.OrdinalIgnoreCase))
                {
                    _webAppWindow.WindowState = WindowState.Maximized;
                    _webAppWindow.Activate();
                    _ytWebView?.Focus();
                    _ytWebView?.CoreWebView2?.ExecuteScriptAsync("window.focus();");
                    StartMediaControllerMode();
                    EnsureCursorVisible();
                    _mainScreenMouseVisible = true;
                    SendGameLaunchStatus("gameLaunchDone");
                    SendRuntimeSessionsToUI();
                }
                return;
            }

            if (kind == "exe" && !string.IsNullOrWhiteSpace(url))
            {
                var media = FindMediaAppByUrlOrId(url);
                var emulator = FindConfiguredEmulatorByExecutablePath(url);
                string mediaUrl = ResolveMediaExecutableUrl(media, url);
                ActivateExecutableAppSession(mediaUrl);
                _mediaExeCurrentUrl = mediaUrl;
                var executableSession = EnsureExecutableAppSession(mediaUrl);

                var aliveProcess = FindAliveMediaExeProcess(mediaUrl, executableSession.Process);
                string executablePath = ResolveMediaExecutablePath(media, mediaUrl);

                if (emulator != null)
                {
                    if (aliveProcess == null)
                    {
                        ForceFocus();
                        SendRuntimeSessionsToUI();
                        return;
                    }

                    executableSession.Process = aliveProcess;
                    var restoredEmulator = await WaitForMediaExeWindowAsync(
                        mediaUrl,
                        emulator.Name,
                        attempts: 20,
                        delayMs: 100,
                        allowNewWindowFallback: true);
                    if (restoredEmulator.Process != null)
                    {
                        aliveProcess = restoredEmulator.Process;
                        executableSession.Process = restoredEmulator.Process;
                    }

                    IntPtr emulatorHwnd = restoredEmulator.Hwnd;
                    if (emulatorHwnd == IntPtr.Zero)
                    {
                        foreach (var candidate in GetMediaExeProcessGroup(mediaUrl, aliveProcess))
                        {
                            emulatorHwnd = FindAnyWindowForProcess(candidate.Id);
                            if (emulatorHwnd != IntPtr.Zero) break;
                        }
                    }

                    if (emulatorHwnd != IntPtr.Zero)
                    {
                        if (IsIconic(emulatorHwnd)) ShowWindow(emulatorHwnd, 9);
                        ShowWindow(emulatorHwnd, 3);
                        FocusExternalWindow(emulatorHwnd);
                    }

                    executableSession.MouseModeRequested = false;
                    executableSession.MouseModeInitialized = true;
                    executableSession.GamepadDisabled = true;
                    executableSession.MouseInputTemporarilyDisabled = true;
                    executableSession.MouseModeActive = true;
                    executableSession.DoorpiSuspended = false;
                    executableSession.WatcherPaused = false;
                    int emulatorSessionId = NextExecutableAppSessionId(executableSession);

                    executableSession.WatcherCts?.Cancel();
                    executableSession.WatcherCts = new CancellationTokenSource();
                    StartMediaExeWatcher(aliveProcess, mediaUrl, emulator.Name, executableSession.WatcherCts.Token);
                    EnsureMediaExeShortcutThread(emulatorSessionId);
                    SendRuntimeSessionsToUI();
                    return;
                }

                HashSet<int>? baselineBeforeLaunch = null;
                if (aliveProcess == null && !string.IsNullOrWhiteSpace(executablePath))
                {
                    baselineBeforeLaunch = SnapshotProcessIds();
                    aliveProcess = StartMediaExecutable(mediaUrl);
                }

                if (aliveProcess != null)
                {
                    executableSession.Process = aliveProcess;
                    InitializeMediaExeProcessGroup(mediaUrl, aliveProcess, baselineBeforeLaunch, executablePath);

                    var restored = await RestoreMediaExeWindowWithFallbacksAsync(
                        mediaUrl,
                        emulator?.Name ?? media?.Name ?? Path.GetFileNameWithoutExtension(executablePath) ?? "Aplicativo");
                    if (restored.Process != null)
                    {
                        aliveProcess = restored.Process;
                        executableSession.Process = restored.Process;
                        try
                        {
                            var session = GetExecutableAppSession(mediaUrl);
                            session?.AddProcessGroupId(restored.Process.Id);
                        }
                        catch { }
                    }

                    var hwnd = restored.Hwnd;
                    if (hwnd != IntPtr.Zero)
                    {
                        if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
                        ShowWindow(hwnd, 3);
                        FocusExternalWindow(hwnd);
                    }

                    InitializeMediaExeMouseModeForSession(executableSession, media);
                    executableSession.GamepadDisabled = !executableSession.MouseModeRequested;
                    executableSession.DoorpiSuspended = false;
                    executableSession.WatcherPaused = false;
                    int sessionId = NextExecutableAppSessionId(executableSession);

                    executableSession.WatcherCts?.Cancel();
                    executableSession.WatcherCts = new CancellationTokenSource();
                    StartMediaExeWatcher(
                        aliveProcess,
                        mediaUrl,
                        emulator?.Name ?? media?.Name ?? Path.GetFileNameWithoutExtension(executablePath) ?? "Aplicativo",
                        executableSession.WatcherCts.Token);

                    EnsureMediaExeShortcutThread(sessionId);

                    if (executableSession.MouseModeRequested)
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

            var configuredEmulator =
                string.Equals(appType, "emulator", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(kind, "exe", StringComparison.OrdinalIgnoreCase)
                    ? FindConfiguredEmulatorByExecutablePath(url)
                    : null;

            if (configuredEmulator != null)
            {
                string emulatorUrl = configuredEmulator.ExecutablePath;
                ActivateExecutableAppSession(emulatorUrl);
                var emulatorSession = GetExecutableAppSession(emulatorUrl);
                var emulatorProcess = FindAliveMediaExeProcess(emulatorUrl, emulatorSession?.Process);
                try { emulatorSession?.WatcherCts?.Cancel(); } catch { }
                try { KillMediaExeProcessTree(emulatorUrl, emulatorProcess ?? emulatorSession?.Process); } catch { }

                if (emulatorSession != null)
                    _executableAppSessions.TryRemove(emulatorSession.Key, out _);
                if (string.Equals(_activeExecutableAppSessionKey, emulatorSession?.Key, StringComparison.OrdinalIgnoreCase))
                    _activeExecutableAppSessionKey = "";

                ClearExecutionLock();
                ScheduleEmulatorLibraryReconcileAfterExternalMutation();
                ForceFocus();
                SendRuntimeSessionsToUI();
                return;
            }

            bool shouldCloseStoreChildGame =
                _gameSessionActive &&
                _storeChildGameActive &&
                string.Equals(_gameSessionParentKind, "store", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(_activeSessionGameId);

            if (shouldCloseStoreChildGame)
            {
                channel = "games";
                appType = "game";
                id = _activeSessionGameId;
                url = "";
            }

            if (string.Equals(kind, "gpuUpdater", StringComparison.OrdinalIgnoreCase))
            {
                ClearExecutionLock();
                CloseGpuUpdaterFromExecutionLock();
                return;
            }

            if (string.Equals(kind, "exe", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(appType, "exe", StringComparison.OrdinalIgnoreCase))
            {
                Interlocked.Exchange(ref _executionLockSuppressUntilUtcTicks,
                    DateTime.UtcNow.AddSeconds(3).Ticks);
            }

            ClearExecutionLock();

            if (string.Equals(kind, "storeInstall", StringComparison.OrdinalIgnoreCase))
            {
                CancelStoreInstall();
                return;
            }

            // Blindagem: sessÃ£o de jogo com pai Doorpi nunca pode ser fechada
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
                        SendInputs(new[] { input });
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

                GetWindowProcessId(foreground, out var pidRaw);
                if (pidRaw == 0) return true;
                if (pidRaw == gamePid) return false; // O prÃ³prio jogo estÃ¡ focado

                var process = Process.GetProcessById((int)pidRaw);
                string name = SafeProcessName(process).ToLowerInvariant();

                // 1. Desktop / Barra de tarefas / Explorador de arquivos
                if (_shellProcessNames.Contains(name)) return true;

                // 2. Processos conhecidos de Overlays e Launchers que costumam roubar foco no boot
                var knownStealers = new HashSet<string>
                {
                    "steam", "steamwebhelper", "epicgameslauncher", "epicwebhelper",
                    "eosoverlayrenderer", "gameoverlayui",
                    "galaxyclient", "goggalaxy", "redprelauncher", "2klauncher", "t2gp"
                };

                if (knownStealers.Contains(name)) return true;

                // Qualquer outro processo (Discord, Chrome, etc.) assume-se Alt+Tab intencional do usuÃ¡rio
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
                ScheduleGameplayBackgroundMode();
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
                if (!string.IsNullOrWhiteSpace(game.LaunchCommand))
                {
                    string configuredExecutable = LaunchCommand.ExecutablePathOrName(game.LaunchCommand);
                    if (!string.IsNullOrWhiteSpace(configuredExecutable) && File.Exists(configuredExecutable))
                        return Path.GetFullPath(configuredExecutable);
                }

                if (!string.IsNullOrWhiteSpace(game.Path) && File.Exists(game.Path))
                    return Path.GetFullPath(game.Path);

                if (!string.IsNullOrWhiteSpace(game.LaunchUrl) &&
                    game.LaunchUrl.StartsWith("riot:", StringComparison.OrdinalIgnoreCase))
                {
                    return "";
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

            string configuredExecutable = LaunchCommand.ExecutablePathOrName(game.LaunchCommand);
            var raw = $"{game.Name} {Path.GetFileNameWithoutExtension(game.Path ?? "")} {Path.GetFileNameWithoutExtension(configuredExecutable)}";
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
                GetWindowProcessId(hWnd, out var pidRaw);
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
            _activeSessionGameName = game.Name;
            _gameSessionParentKind = bindToActiveStoreContext ? "store" : "doorpi";
            _forceDoorpiReturnOnGameClose = !bindToActiveStoreContext;
            _storeChildGameActive = bindToActiveStoreContext;
            _storeChildGameStoreId = bindToActiveStoreContext ? (_activeStoreId ?? "") : "";
            _storeChildGameId = bindToActiveStoreContext ? gameId : "";
            StartActiveSessionClock(confirmed: true);
            DelayGameMinimizeAvailability();

            if (bindToActiveStoreContext)
            {
                MarkStoreChildGameAsPlayed(game, gameId);
                _storeMouseModeActive = false;
                _storePausedByDoorpi = false;
                ClearStorePendingChildWindows();
                _storeMinimizeState = StoreMinimizeState.StoreChildGameValid;
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
                    _ = Task.Run(() => MonitorGameLaunchAsync(game, snapshot, SnapshotProcessIds(), null, _gameLaunchMonitorCts.Token));
                }
            }

            RestoreGameCleanly(candidate.Hwnd);
            SendGameLaunchStatus("gameLaunchDone");
            VerifyGameFocusOrPromptAsync(candidate.Hwnd, game);
            DiscordRpcManager.Instance.UpdateState("game", game.Name);
            SendRuntimeSessionsToUI();
            return true;
        }

        private List<IntPtr> EnumerateTopLevelWindows()
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
            if (ShouldAlwaysIgnoreGameWindowProcess(process)) return 0;
            if (ShouldIgnoreSteamAccountSelectionWindow(process)) return 0;
            if (!IsPotentialGameWindow(hWnd)) return 0;

            var score = 0;
            var pid = SafeProcessId(process);
            var title = GetWindowTitle(hWnd);
            var exePath = SafeProcessPath(process);
            var exeName = Path.GetFileNameWithoutExtension(exePath);
            var haystack = $"{processName} {exeName} {title} {exePath}".ToLowerInvariant();
            if (HasIgnoredGameWindowNameFragment(haystack)) return 0;

            if (!GetWindowRect(hWnd, out RECT rect)) return 0;
            int screenW = (int)System.Windows.SystemParameters.PrimaryScreenWidth;
            int screenH = (int)System.Windows.SystemParameters.PrimaryScreenHeight;
            double coverage = screenW > 0 && screenH > 0
                ? (double)(rect.Width * rect.Height) / (double)(screenW * screenH)
                : 0;
            bool foregroundOwned = GetForegroundWindow() == hWnd;
            bool cursorHidden = foregroundOwned && IsSystemCursorHidden();
            bool smallWindow = coverage < 0.18 || rect.Width < 520 || rect.Height < 320;
            long workingSetMb = 0;
            bool strongNameSignal = false;
            bool knownGamePathSignal = false;
            bool baselineProcess = context.BaselineProcessIds.Contains(pid);

            // 1. Origem do Processo (O Jogo ser um processo NOVO Ã© a maior pista de todas)
            if (pid == context.LaunchedProcessId) score += 50;
            if (!baselineProcess) score += 40;
            if (context.SeenCandidatePids.Contains(pid)) score += 15;

            // 2. Caminho Direto
            if (!string.IsNullOrWhiteSpace(context.DirectExePath) && !string.IsNullOrWhiteSpace(exePath))
            {
                if (PathsEqual(context.DirectExePath, exePath))
                {
                    score += 150;
                    knownGamePathSignal = true;
                }
                else
                {
                    var gameDir = Path.GetDirectoryName(context.DirectExePath) ?? "";
                    if (!string.IsNullOrWhiteSpace(gameDir) && exePath.StartsWith(gameDir, StringComparison.OrdinalIgnoreCase))
                    {
                        score += 60;
                        knownGamePathSignal = true;
                    }
                }
            }

            // 3. HEURÃSTICA INTELIGENTE (Resolve o problema do "Dandara" e do "Witcher")
            string firstToken = context.NameTokens.FirstOrDefault() ?? "";
            if (!string.IsNullOrEmpty(firstToken))
            {
                // O nome do executÃ¡vel COMEÃ‡A com a primeira palavra do jogo? BÃ´nus GIGANTE!
                if (exeName.StartsWith(firstToken, StringComparison.OrdinalIgnoreCase))
                {
                    score += 60;
                    strongNameSignal = true;
                }

                if (processName.StartsWith(firstToken, StringComparison.OrdinalIgnoreCase))
                {
                    score += 45;
                    strongNameSignal = true;
                }

                // O tÃ­tulo da janela tem a primeira palavra do jogo?
                if (title.Contains(firstToken, StringComparison.OrdinalIgnoreCase))
                {
                    score += 35;
                    strongNameSignal = true;
                }
            }

            // TÃ­tulo Exato 100%
            if (!string.IsNullOrWhiteSpace(title) && string.Equals(title, context.Game.Name, StringComparison.OrdinalIgnoreCase))
            {
                score += 80;
                strongNameSignal = true;
            }

            // Tokens Normais (Procurando outras palavras soltas)
            int tokenMatches = context.NameTokens.Count(t => haystack.Contains(t, StringComparison.OrdinalIgnoreCase));
            score += tokenMatches * 20;
            if (tokenMatches >= Math.Min(2, Math.Max(1, context.NameTokens.Length)))
            {
                score += 35;
                strongNameSignal = true;
            }

            // 4. BÃ´nus por Ser uma Janela Real e Pesada
            if (!string.IsNullOrWhiteSpace(title)) score += 10;
            if (IsZoomed(hWnd)) score += 100;
            if (coverage >= 0.80) score += 120;
            else if (coverage >= 0.45) score += 35;
            else if (coverage >= 0.18) score += 15;
            if (foregroundOwned) score += 25;
            if (cursorHidden) score += 35;

            try
            {
                workingSetMb = process.WorkingSet64 / 1024 / 1024;
                if (workingSetMb > 180) score += 15;
                if (workingSetMb > 400) score += 25;
                if (workingSetMb > 800) score += 35; // Jogos pesados consomem RAM
            }
            catch (Exception ex) when (ex is UnauthorizedAccessException || ex is System.ComponentModel.Win32Exception) { }
            catch { }

            bool directPathMatch =
                !string.IsNullOrWhiteSpace(context.DirectExePath) &&
                !string.IsNullOrWhiteSpace(exePath) &&
                PathsEqual(context.DirectExePath, exePath);
            if (baselineProcess &&
                pid != context.LaunchedProcessId &&
                !strongNameSignal &&
                !knownGamePathSignal &&
                !directPathMatch)
            {
                return 0;
            }

            bool trustedSmallWindow =
                strongNameSignal &&
                (workingSetMb >= 180 ||
                 foregroundOwned ||
                 cursorHidden ||
                 pid == context.LaunchedProcessId ||
                 directPathMatch);

            if (smallWindow && !trustedSmallWindow)
                return 0;

            if (smallWindow && score < 95)
                return 0;

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
                _ = GetWindowText(hWnd, builder, builder.Capacity);
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
                GetWindowProcessId(foreground, out var foregroundPid);
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

                GetWindowProcessId(foreground, out var pidRaw);
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

            // 2. Doorpi vai pra trÃ¡s sem roubar o foco (HWND_NOTOPMOST)
            SetWindowPos(_mainWindowHandle, HWND_NOTOPMOST, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);

            // 3. Restaura o jogo de forma limpa e padrÃ£o do Windows
            if (IsIconic(hwnd)) ShowWindow(hwnd, 9); // SW_RESTORE
            else ShowWindow(hwnd, 5);                // SW_SHOW

            // 4. Puxa o foco
            SwitchToThisWindow(hwnd, true);
            SetForegroundWindow(hwnd);
            BringWindowToTop(hwnd);
            ScheduleGameplayBackgroundMode();
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

                            if (includeIcons && string.IsNullOrEmpty(iconBase64))
                            {
                                string libraryCachePath = Path.Combine(steamPath, "appcache", "librarycache", $"{appId}_icon.jpg");
                                if (File.Exists(libraryCachePath))
                                    iconBase64 = GetCachedImageAsPngBase64(libraryCachePath);
                            }

                            if (includeIcons && string.IsNullOrEmpty(iconBase64))
                            {
                                string libraryCacheFolder = Path.Combine(steamPath, "appcache", "librarycache", appId);
                                string[] preferredAssets =
                                {
                                    "library_600x900.jpg",
                                    "header.jpg",
                                    "logo.png"
                                };

                                foreach (var asset in preferredAssets)
                                {
                                    string assetPath = Path.Combine(libraryCacheFolder, asset);
                                    if (!File.Exists(assetPath)) continue;
                                    iconBase64 = GetCachedImageAsPngBase64(assetPath);
                                    if (!string.IsNullOrEmpty(iconBase64)) break;
                                }

                                if (string.IsNullOrEmpty(iconBase64) && Directory.Exists(libraryCacheFolder))
                                {
                                    string? fallbackAsset = Directory.EnumerateFiles(libraryCacheFolder, "*.*", SearchOption.TopDirectoryOnly)
                                        .Where(path => path.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
                                                       path.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) ||
                                                       path.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase))
                                        .OrderByDescending(path =>
                                            Path.GetFileName(path).Contains("library", StringComparison.OrdinalIgnoreCase) ? 3 :
                                            Path.GetFileName(path).Contains("header", StringComparison.OrdinalIgnoreCase) ? 2 :
                                            Path.GetFileName(path).Contains("logo", StringComparison.OrdinalIgnoreCase) ? 1 : 0)
                                        .ThenByDescending(path =>
                                        {
                                            try { return new FileInfo(path).Length; }
                                            catch { return 0; }
                                        })
                                        .FirstOrDefault();
                                    if (!string.IsNullOrEmpty(fallbackAsset))
                                        iconBase64 = GetCachedImageAsPngBase64(fallbackAsset);
                                }
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

        private static bool IsRiotClientCatalogEntry(string displayName, string registryName, string commandOrProduct)
        {
            return displayName.Equals("Riot Client", StringComparison.OrdinalIgnoreCase) ||
                   registryName.Equals("Riot Client", StringComparison.OrdinalIgnoreCase) ||
                   commandOrProduct.Equals("riot_client", StringComparison.OrdinalIgnoreCase) ||
                   commandOrProduct.Equals("-product=riot_client", StringComparison.OrdinalIgnoreCase) ||
                   commandOrProduct.Equals("--launch-product=riot_client", StringComparison.OrdinalIgnoreCase) ||
                   commandOrProduct.Equals("--uninstall-product=riot_client", StringComparison.OrdinalIgnoreCase);
        }

        private static bool TryParseRiotGameRegistryName(string registryName, out string product, out string patchline)
        {
            product = "";
            patchline = "live";
            const string prefix = "Riot Game ";
            if (string.IsNullOrWhiteSpace(registryName) ||
                !registryName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return false;

            string raw = registryName[prefix.Length..].Trim();
            if (string.IsNullOrWhiteSpace(raw)) return false;

            int dot = raw.IndexOf('.');
            product = dot > 0 ? raw[..dot] : raw;
            patchline = dot > 0 && dot < raw.Length - 1 ? raw[(dot + 1)..] : "live";
            return !string.IsNullOrWhiteSpace(product) &&
                   !IsRiotClientCatalogEntry("", registryName, product);
        }

        private static string RiotDisplayNameFromProduct(string product, string displayName)
        {
            if (!string.IsNullOrWhiteSpace(displayName) &&
                !displayName.StartsWith("Riot Game ", StringComparison.OrdinalIgnoreCase))
                return displayName.Trim();

            return product switch
            {
                "league_of_legends" => "League of Legends",
                "teamfighttactics" => "Teamfight Tactics",
                "valorant" => "VALORANT",
                _ => Regex.Replace(product.Replace('_', ' '), @"\b\p{Ll}", m => m.Value.ToUpperInvariant()).Trim()
            };
        }

        private bool TryResolveRiotGameLaunch(
            string registryName,
            string displayName,
            string uninstallString,
            out string product,
            out string patchline)
        {
            if (TryParseRiotGameRegistryName(registryName, out product, out patchline) &&
                Regex.IsMatch(product, @"^[a-z0-9_]+$", RegexOptions.IgnoreCase))
            {
                product = product.ToLowerInvariant();
                patchline = patchline.ToLowerInvariant();
                return true;
            }

            product = "";
            patchline = "live";
            string command = uninstallString ?? "";
            var productMatch = Regex.Match(
                command,
                "--(?:uninstall|launch)-product(?:=|\\s+)(?<product>[^\\s\\\"]+)",
                RegexOptions.IgnoreCase);
            if (productMatch.Success)
            {
                product = productMatch.Groups["product"].Value.Trim('"', ' ');
                var patchlineMatch = Regex.Match(
                    command,
                    "--(?:uninstall|launch)-patchline(?:=|\\s+)(?<patchline>[^\\s\\\"]+)",
                    RegexOptions.IgnoreCase);
                if (patchlineMatch.Success)
                    patchline = patchlineMatch.Groups["patchline"].Value.Trim('"', ' ');
            }
            else
            {
                string identity = NormalizeGameName($"{registryName} {displayName}");
                product = identity.Contains("valorant", StringComparison.OrdinalIgnoreCase) ? "valorant"
                    : identity.Contains("leagueoflegends", StringComparison.OrdinalIgnoreCase) ? "league_of_legends"
                    : identity.Contains("teamfighttactics", StringComparison.OrdinalIgnoreCase) ? "teamfighttactics"
                    : identity.Contains("legendsofruneterra", StringComparison.OrdinalIgnoreCase) ? "legendsof_runeterra"
                    : identity.Contains("2xko", StringComparison.OrdinalIgnoreCase) ? "2xko"
                    : "";
            }

            product = product.ToLowerInvariant();
            patchline = patchline.ToLowerInvariant();
            return !string.IsNullOrWhiteSpace(product) &&
                !IsRiotClientCatalogEntry(displayName, registryName, product);
        }

        private List<(string Product, string Patchline, string IconPath, string MarkerPath)> GetRiotMetadataGames()
        {
            var games = new List<(string Product, string Patchline, string IconPath, string MarkerPath)>();
            try
            {
                string metadataRoot = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                    "Riot Games", "Metadata");
                if (!Directory.Exists(metadataRoot)) return games;

                foreach (string directory in Directory.EnumerateDirectories(metadataRoot))
                {
                    string id = Path.GetFileName(directory).Trim();
                    int separator = id.IndexOf('.');
                    if (separator <= 0 || separator == id.Length - 1) continue;

                    string product = id[..separator].Trim().ToLowerInvariant();
                    string patchline = id[(separator + 1)..].Trim().ToLowerInvariant();
                    string markerPath = Path.Combine(directory, $"{id}.product_settings.yaml");
                    if (!File.Exists(markerPath) ||
                        product is "riot_client" or "riotclient" ||
                        !Regex.IsMatch(product, @"^[a-z0-9_]+$", RegexOptions.IgnoreCase))
                        continue;

                    games.Add((
                        product,
                        string.IsNullOrWhiteSpace(patchline) ? "live" : patchline,
                        Path.Combine(directory, $"{id}.ico"),
                        markerPath));
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("RiotMetadata: " + ex.Message);
            }

            // Um produto pode registrar live e PBE. O modal mostra uma entrada por
            // jogo e prioriza a instalaÃ§Ã£o live, sem duplicar o mesmo tÃ­tulo.
            return games
                .GroupBy(game => game.Product, StringComparer.OrdinalIgnoreCase)
                .Select(group => group
                    .OrderBy(game => game.Patchline.Equals("live", StringComparison.OrdinalIgnoreCase) ? 0 : 1)
                    .First())
                .ToList();
        }

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

                                string displayName = sub.GetValue("DisplayName") as string ?? "";
                                string uninstallString = sub.GetValue("UninstallString") as string ?? "";

                                if (TryResolveRiotGameLaunch(name, displayName, uninstallString, out var productFromName, out var patchlineFromName))
                                {
                                    keys.Add($"Riot Game {productFromName}.{patchlineFromName}");
                                }
                            }
                        }
                    }
            }
            catch (Exception ex) { Debug.WriteLine("RiotFingerprint: " + ex.Message); }

            foreach (var metadataGame in GetRiotMetadataGames())
            {
                try
                {
                    var marker = new FileInfo(metadataGame.MarkerPath);
                    keys.Add($"Riot Metadata {metadataGame.Product}.{metadataGame.Patchline}|{marker.LastWriteTimeUtc.Ticks}|{marker.Length}");
                }
                catch { }
            }

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

                                string displayName = sub.GetValue("DisplayName") as string ?? "";
                                string uninstallString = sub.GetValue("UninstallString") as string ?? "";
                                string displayIcon = sub.GetValue("DisplayIcon") as string ?? "";

                                if (!TryResolveRiotGameLaunch(name, displayName, uninstallString, out var product, out var patchline))
                                    continue;

                                string? riotExe = ResolveRiotExe();
                                if (string.IsNullOrWhiteSpace(riotExe)) continue;

                                string iconBase64 = "";
                                string cleanIconPath = displayIcon.Split(',')[0].Replace("\"", "").Trim();
                                if (File.Exists(cleanIconPath)) iconBase64 = GetCachedIcon(cleanIconPath);
                                else if (File.Exists(riotExe)) iconBase64 = GetCachedIcon(riotExe);

                                list.Add(new InstalledApp
                                {
                                    Name = RiotDisplayNameFromProduct(product, displayName),
                                    LaunchUrl = $"riot:{riotExe} --launch-product={product} --launch-patchline={patchline}",
                                    Path = product,
                                    Source = "Riot",
                                    IconBase64 = iconBase64
                                });
                            }
                        }
                    }
            }
            catch (Exception ex) { Debug.WriteLine("Erro Riot: " + ex.Message); }

            // As instalaÃ§Ãµes modernas da Riot registram os jogos em ProgramData,
            // nÃ£o em Uninstall. Esse Ã© o mesmo catÃ¡logo que o Riot Client usa.
            string? riotExeFromMetadata = ResolveRiotExe();
            if (!string.IsNullOrWhiteSpace(riotExeFromMetadata))
            {
                foreach (var metadataGame in GetRiotMetadataGames())
                {
                    string launchUrl = $"riot:{riotExeFromMetadata} --launch-product={metadataGame.Product} --launch-patchline={metadataGame.Patchline}";
                    if (list.Any(app => string.Equals(app.LaunchUrl, launchUrl, StringComparison.OrdinalIgnoreCase)))
                        continue;

                    string iconBase64 = File.Exists(metadataGame.IconPath)
                        ? GetCachedIcon(metadataGame.IconPath)
                        : GetCachedIcon(riotExeFromMetadata);
                    list.Add(new InstalledApp
                    {
                        Name = RiotDisplayNameFromProduct(metadataGame.Product, ""),
                        LaunchUrl = launchUrl,
                        Path = metadataGame.Product,
                        Source = "Riot",
                        IconBase64 = iconBase64
                    });
                }
            }

            // Garante que nÃ£o duplique (caso exista no LocalMachine e no CurrentUser simultaneamente)
            return list.GroupBy(a => a.LaunchUrl, StringComparer.OrdinalIgnoreCase).Select(g => g.First()).ToList();
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

                        if (shortcuts.Count > 0)
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
                            !exePath.Contains("unins", StringComparison.OrdinalIgnoreCase))
                            finalPath = exePath;
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
            string[] candidates =
            {
                foldersFile,
                foldersFile + ".bak",
                fallbackFile,
                fallbackFile + ".bak"
            };

            foreach (string fileToRead in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                if (!File.Exists(fileToRead)) continue;
                try
                {
                    string json = SafeReadAllText(fileToRead);
                    if (string.IsNullOrWhiteSpace(json) || json.IndexOf('\0') >= 0) continue;
                    try
                    {
                        var data = JsonSerializer.Deserialize<List<FolderStats>>(json);
                        if (data != null && (data.Count == 0 || !string.IsNullOrEmpty(data[0].Path)))
                        {
                            if (!string.Equals(fileToRead, foldersFile, StringComparison.OrdinalIgnoreCase))
                            {
                                try { SaveFoldersData(data); } catch { }
                                DoorpiBootDiagnostics.Log("folders-recovered", $"path={fileToRead}");
                            }
                            return data;
                        }
                    }
                    catch (JsonException) { }

                    var oldPaths = JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
                    var migratedData = oldPaths.Select(path => GetFolderStats(path)).ToList();
                    SaveFoldersData(migratedData);
                    return migratedData;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
                {
                    DoorpiBootDiagnostics.Log("folders-read-failed", $"path={fileToRead}; error={ex.Message}");
                }
            }
            return new List<FolderStats>();
        }

        private void SaveFoldersData(List<FolderStats> folders)
        {
            string json = JsonSerializer.Serialize(folders, IndentedJsonOptions);
            SafeWriteAllText(foldersFile, json);
            SafeWriteAllText(Path.Combine(dataFolder, "folders.json"), json);
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

        // ========================= LÃ“GICA OTIMIZADA DE DIFF DE PASTAS =========================

        private (List<InstalledApp> Apps, Dictionary<string, long> Timestamps, bool Changed) ScanWatchedFoldersOptimized(
            AppCacheModel cache,
            Action<string, int>? onProgress = null,
            bool forceFullScan = false)
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

                        if (!forceFullScan &&
                            currentTimestamps.TryGetValue(gameDir, out long oldWrite) &&
                            oldWrite == lastWrite)
                        {
                            var appsInDir = currentApps.Where(a => a.Path.StartsWith(gameDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)).ToList();
                            newFolderApps.AddRange(appsInDir);
                            foundInRoot += appsInDir.Count;
                        }
                        else
                        {
                            changed = true;
                            string expectedName = dirInfo.Name;

                            // Pega TODOS os executÃ¡veis dentro da pasta e de todas as subpastas dela de uma vez
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

                                // 3. Fallback: Pega o maior executÃ¡vel (Sempre serÃ¡ o jogo verdadeiro e nunca o CEF)
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

                    // Arquivos soltos diretamente na raiz da pasta vigiada (Jogos que nÃ£o estÃ£o dentro de subpastas)
                    var rootExes = new DirectoryInfo(rootFolder).GetFiles("*.exe", SearchOption.TopDirectoryOnly)
                        .Where(f => !junkTerms.Any(j => f.Name.Contains(j, StringComparison.OrdinalIgnoreCase)))
                        .ToList();

                    foreach (var rootExe in rootExes)
                    {
                        long lastWrite = rootExe.LastWriteTimeUtc.Ticks;
                        string key = rootExe.FullName;
                        newTimestamps[key] = lastWrite;

                        if (!forceFullScan &&
                            currentTimestamps.TryGetValue(key, out long oldWrite) &&
                            oldWrite == lastWrite)
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

            // 3. Fallback: Retorna o MAIOR executÃ¡vel da pasta (seu sistema de antes)
            return exes.OrderByDescending(f => f.Length).First().FullName;
        }

        private List<InstalledApp> ScanWindowsApps(bool riotOnly = false)
        {
            var list = new List<InstalledApp>();
            var paths = new[]
            {
        @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
    };

            var options = new EnumerationOptions { IgnoreInaccessible = true, RecurseSubdirectories = true, MaxRecursionDepth = 3 };

            var ignoredLaunchers = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    { "Steam", "Epic Games Launcher", "GOG Galaxy", "Riot Client", "Xbox", "Rockstar Games Launcher" };

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
                                string uninstallString = sub.GetValue("UninstallString") as string ?? "";
                                bool isRiotEntry = publisher?.Contains("Riot Games", StringComparison.OrdinalIgnoreCase) == true ||
                                    name.StartsWith("Riot Game ", StringComparison.OrdinalIgnoreCase);
                                if (isRiotEntry)
                                {
                                    // A Riot continua sendo encontrada pelo detector de programas do
                                    // Windows, mas nunca Ã© adicionada como .exe genÃ©rico: o modal
                                    // recebe o comando oficial do Riot Client e a fonte correta.
                                    if (!TryResolveRiotGameLaunch(name, displayName, uninstallString, out var riotProduct, out var riotPatchline))
                                        continue;

                                    string? riotExe = ResolveRiotExe();
                                    if (string.IsNullOrWhiteSpace(riotExe)) continue;

                                    string displayIcon = sub.GetValue("DisplayIcon") as string ?? "";
                                    string iconPath = displayIcon.Split(',')[0].Replace("\"", "").Trim();
                                    string iconBase64 = File.Exists(iconPath)
                                        ? GetCachedIcon(iconPath)
                                        : GetCachedIcon(riotExe);
                                    list.Add(new InstalledApp
                                    {
                                        Name = RiotDisplayNameFromProduct(riotProduct, displayName),
                                        Path = riotProduct,
                                        LaunchUrl = $"riot:{riotExe} --launch-product={riotProduct} --launch-patchline={riotPatchline}",
                                        Source = "Riot",
                                        IconBase64 = iconBase64
                                    });
                                    continue;
                                }

                                if (riotOnly) continue;

                                string folder = GetAppFolder(sub);
                                if (string.IsNullOrEmpty(folder) || !Directory.Exists(folder)) continue;
                                if (folder.Contains(@"\steamapps\", StringComparison.OrdinalIgnoreCase)) continue;

                                // CHAMA A FUNÃ‡ÃƒO INTELIGENTE
                                string? exePath = FindMainExecutable(folder, displayName, options);
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

        private static string ResolveCurrentVersionedAppDirectory(string? originalDirectory)
        {
            if (string.IsNullOrWhiteSpace(originalDirectory)) return "";

            string path = Environment.ExpandEnvironmentVariables(originalDirectory.Trim().Trim('"'));
            try { path = Path.GetFullPath(path); } catch { }

            try
            {
                var directory = new DirectoryInfo(path);
                if (!directory.Name.StartsWith("app-", StringComparison.OrdinalIgnoreCase) || directory.Parent == null)
                    return path;

                var searchOptions = new EnumerationOptions
                {
                    IgnoreInaccessible = true,
                    RecurseSubdirectories = true,
                    MaxRecursionDepth = 3
                };
                var candidates = new List<(string Path, Version Version, DateTime LastWrite)>();

                foreach (string candidateDirectory in Directory.EnumerateDirectories(
                             directory.Parent.FullName,
                             "app-*",
                             SearchOption.TopDirectoryOnly))
                {
                    if (!Directory.EnumerateFiles(candidateDirectory, "*.exe", searchOptions).Any())
                        continue;

                    string directoryName = Path.GetFileName(candidateDirectory);
                    string versionText = directoryName.Length > 4 ? directoryName[4..] : "";
                    if (!Version.TryParse(versionText, out var version))
                        version = new Version(0, 0);

                    DateTime lastWrite = DateTime.MinValue;
                    try { lastWrite = Directory.GetLastWriteTimeUtc(candidateDirectory); } catch { }
                    candidates.Add((candidateDirectory, version, lastWrite));
                }

                return candidates
                    .OrderByDescending(candidate => candidate.Version)
                    .ThenByDescending(candidate => candidate.LastWrite)
                    .Select(candidate => candidate.Path)
                    .FirstOrDefault() ?? path;
            }
            catch
            {
                return path;
            }
        }

        private static string ResolveCurrentVersionedExecutablePath(string? originalPath)
        {
            if (string.IsNullOrWhiteSpace(originalPath)) return "";

            string path = Environment.ExpandEnvironmentVariables(originalPath.Trim().Trim('"'));
            try { path = Path.GetFullPath(path); } catch { }

            try
            {
                var executableDirectory = Directory.GetParent(path);
                if (executableDirectory == null ||
                    !executableDirectory.Name.StartsWith("app-", StringComparison.OrdinalIgnoreCase) ||
                    executableDirectory.Parent == null)
                {
                    return path;
                }

                string relativeExecutable = Path.GetRelativePath(executableDirectory.FullName, path);
                var candidates = new List<(string Path, Version Version, DateTime LastWrite)>();

                foreach (string directory in Directory.EnumerateDirectories(executableDirectory.Parent.FullName, "app-*", SearchOption.TopDirectoryOnly))
                {
                    string candidate = Path.Combine(directory, relativeExecutable);
                    if (!File.Exists(candidate)) continue;

                    string versionText = Path.GetFileName(directory)[4..];
                    if (!Version.TryParse(versionText, out var version))
                        version = new Version(0, 0);

                    DateTime lastWrite = DateTime.MinValue;
                    try { lastWrite = File.GetLastWriteTimeUtc(candidate); } catch { }
                    candidates.Add((candidate, version, lastWrite));
                }

                return candidates
                    .OrderByDescending(candidate => candidate.Version)
                    .ThenByDescending(candidate => candidate.LastWrite)
                    .Select(candidate => candidate.Path)
                    .FirstOrDefault() ?? path;
            }
            catch
            {
                return path;
            }
        }

        private bool RepairCachedExecutablePaths(AppCacheModel cache)
        {
            bool changed = false;
            foreach (var app in cache.WindowsApps.Concat(cache.FolderApps))
            {
                string original = app.Path ?? "";
                if (string.IsNullOrWhiteSpace(original) || !Path.IsPathRooted(original) || File.Exists(original))
                    continue;

                string resolved = ResolveCurrentVersionedExecutablePath(original);
                if (!File.Exists(resolved) || string.Equals(original, resolved, StringComparison.OrdinalIgnoreCase))
                    continue;

                app.Path = resolved;
                if (string.Equals(app.LaunchUrl, original, StringComparison.OrdinalIgnoreCase))
                    app.LaunchUrl = resolved;
                app.IconBase64 = GetCachedIcon(resolved);
                changed = true;
            }

            return changed;
        }

        private static bool HasMissingCachedExecutable(IEnumerable<InstalledApp> apps)
        {
            return apps.Any(app =>
                !string.IsNullOrWhiteSpace(app.Path) &&
                Path.IsPathRooted(app.Path) &&
                !File.Exists(app.Path));
        }

        // ========================= CACHE DE APPS =========================

        private void SaveAppCache(AppCacheModel cache)
        {
            File.WriteAllText(appCacheFile, JsonSerializer.Serialize(cache,
                IndentedJsonOptions));
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
                        foreach (var n in key.GetSubKeyNames())
                        {
                            using var sub = key.OpenSubKey(n);
                            string version = sub?.GetValue("DisplayVersion") as string ?? "";
                            string icon = sub?.GetValue("DisplayIcon") as string ?? "";
                            string location = sub?.GetValue("InstallLocation") as string ?? "";
                            keys.Add($"{hive}|{view}|{rel}|{n}|{version}|{icon}|{location}");
                        }
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
                bool cachePathsRepaired = RepairCachedExecutablePaths(cache);

                var steamPrint = GetSteamFingerprint();
                var epicPrint = GetEpicFingerprint();
                var gogPrint = GetGogFingerprint();
                var riotPrint = GetRiotFingerprint();
                var xboxPrint = GetXboxFingerprint();
                var winPrint = GetWindowsRegistryFingerprint();

                bool steamStale = !steamPrint.SetEquals(cache.SteamFingerprint) || cache.SteamApps.Count == 0;
                bool epicStale = !epicPrint.SetEquals(cache.EpicFingerprint) || cache.EpicApps.Count == 0;
                bool gogStale = !gogPrint.SetEquals(cache.GogFingerprint) || cache.GogApps.Count == 0;
                bool riotStale = !riotPrint.SetEquals(cache.RiotFingerprint) || cache.RiotApps.Count == 0;
                bool xboxStale = !xboxPrint.SetEquals(cache.XboxFingerprint) || cache.XboxApps.Count == 0;
                bool windowsStale = _windowsCacheInvalid
                                 || !winPrint.SetEquals(cache.WindowsFingerprint)
                                 || cache.WindowsApps.Count == 0
                                 || HasMissingCachedExecutable(cache.WindowsApps);
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

                await Task.WhenAll(steamTask, epicTask, gogTask, riotTask, xboxTask, winTask, folderTask);

                var (steamApps, steamChanged) = steamTask.Result;
                var (epicApps, epicChanged) = epicTask.Result;
                var (gogApps, gogChanged) = gogTask.Result;
                var (riotApps, riotChanged) = riotTask.Result;
                var (xboxApps, xboxChanged) = xboxTask.Result;
                var (windowsApps, windowsChanged) = winTask.Result;
                (List<InstalledApp> folderApps, Dictionary<string, long> folderTimestamps, bool folderChanged) = folderTask.Result;

                if (cache.XboxFilterVersion < 2)
                {
                    cache.XboxFilterVersion = 2;
                    xboxChanged = true;
                }

                bool anythingChanged = cachePathsRepaired || steamChanged || epicChanged || gogChanged || riotChanged || xboxChanged
                    || windowsChanged || folderChanged;


                if (anythingChanged)
                {
                    if (steamChanged) { cache.SteamApps = steamApps; cache.SteamFingerprint = steamPrint; }
                    if (epicChanged) { cache.EpicApps = epicApps; cache.EpicFingerprint = epicPrint; }
                    if (gogChanged) { cache.GogApps = gogApps; cache.GogFingerprint = gogPrint; }
                    if (riotChanged) { cache.RiotApps = riotApps; cache.RiotFingerprint = riotPrint; }
                    if (xboxChanged) { cache.XboxApps = xboxApps; cache.XboxFingerprint = xboxPrint; }
                    if (windowsChanged)
                    {
                        cache.WindowsApps = windowsApps; cache.WindowsFingerprint = winPrint;
                        _windowsCacheInvalid = false;
                    }
                    if (folderChanged) { cache.FolderApps = folderApps; cache.FolderTimestamps = folderTimestamps; }

                    RepairCachedExecutablePaths(cache);

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

        private void ScheduleWatchedFolderRefresh(
            string reason,
            int delayMs = 1400,
            bool requireAfterRunning = false)
        {
            CancellationTokenSource scheduleCts;
            lock (_watchedFolderRefreshScheduleLock)
            {
                if (_watchedFolderRefreshRunning)
                {
                    if (requireAfterRunning)
                    {
                        _watchedFolderRefreshPendingAfterRun = true;
                        _watchedFolderRefreshPendingReason = reason;
                        _watchedFolderRefreshPendingDelayMs = Math.Min(
                            _watchedFolderRefreshPendingDelayMs,
                            Math.Max(0, delayMs));
                    }
                    Debug.WriteLine($"[WatchedFolders] Varredura já ativa; gatilho agrupado: {reason}.");
                    return;
                }

                if (!requireAfterRunning &&
                    (DateTime.UtcNow - _lastWatchedFolderRefreshCompletedUtc).TotalSeconds < 8)
                {
                    Debug.WriteLine($"[WatchedFolders] Varredura recente; gatilho ignorado: {reason}.");
                    return;
                }

                try { _watchedFolderRefreshScheduleCts?.Cancel(); }
                catch { }
                try { _watchedFolderRefreshScheduleCts?.Dispose(); }
                catch { }

                scheduleCts = new CancellationTokenSource();
                _watchedFolderRefreshScheduleCts = scheduleCts;
            }

            _ = RunScheduledWatchedFolderRefreshAsync(
                scheduleCts,
                reason,
                Math.Max(0, delayMs));
        }

        private async Task RunScheduledWatchedFolderRefreshAsync(
            CancellationTokenSource scheduleCts,
            string reason,
            int delayMs)
        {
            try
            {
                await Task.Delay(delayMs, scheduleCts.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            lock (_watchedFolderRefreshScheduleLock)
            {
                if (!ReferenceEquals(_watchedFolderRefreshScheduleCts, scheduleCts) ||
                    _watchedFolderRefreshRunning)
                    return;

                _watchedFolderRefreshScheduleCts = null;
                _watchedFolderRefreshRunning = true;
            }

            try
            {
                Debug.WriteLine($"[WatchedFolders] Atualizando após {reason}.");
                await RefreshWatchedFoldersAfterFileActivityAsync().ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[WatchedFolders] Falha na atualização após {reason}: {ex.Message}");
            }
            finally
            {
                bool runPending;
                string pendingReason;
                int pendingDelayMs;
                lock (_watchedFolderRefreshScheduleLock)
                {
                    _watchedFolderRefreshRunning = false;
                    _lastWatchedFolderRefreshCompletedUtc = DateTime.UtcNow;
                    runPending = _watchedFolderRefreshPendingAfterRun;
                    pendingReason = _watchedFolderRefreshPendingReason;
                    pendingDelayMs = _watchedFolderRefreshPendingDelayMs;
                    _watchedFolderRefreshPendingAfterRun = false;
                    _watchedFolderRefreshPendingReason = "";
                    _watchedFolderRefreshPendingDelayMs = 1400;
                }
                scheduleCts.Dispose();
                if (runPending)
                {
                    ScheduleWatchedFolderRefresh(
                        pendingReason,
                        pendingDelayMs,
                        requireAfterRunning: true);
                }
            }
        }

        private async Task ReconcileMissingWatchedFolderGamesAfterFileOperationAsync()
        {
            List<GameModel> removedGames = new();
            try
            {
                await _cacheLock.WaitAsync().ConfigureAwait(false);
                try
                {
                    removedGames.AddRange(await Task.Run(ReconcileMissingWatchedFolderGames)
                        .ConfigureAwait(false));
                }
                finally
                {
                    _cacheLock.Release();
                }

                if (removedGames.Count > 0)
                    PublishRemovedGamesToUI(removedGames);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[WatchedFolders] Falha na reconciliação imediata: " + ex.Message);
            }
        }

        private async Task RefreshWatchedFoldersAfterFileActivityAsync()
        {
            List<GameModel> removedGames = new();
            await _cacheLock.WaitAsync().ConfigureAwait(false);
            try
            {
                var cache = LoadAppCache() ?? new AppCacheModel();
                var result = await Task.Run(() =>
                    ScanWatchedFoldersOptimized(cache, PostScanProgress, forceFullScan: true))
                    .ConfigureAwait(false);
                result.Apps.ForEach(app => app.Source = "Folder");
                cache.FolderApps = result.Apps;
                cache.FolderTimestamps = result.Timestamps;
                RefreshAutoAddSuppressions(cache);
                SaveAppCache(cache);
                _lastCacheBuilt = DateTime.Now;

                removedGames.AddRange(ReconcileDoorpiGamesWithPlatformCache(cache));
                removedGames.AddRange(ReconcileMissingWatchedFolderGames());
            }
            finally
            {
                _cacheLock.Release();
            }

            if (removedGames.Count > 0)
                PublishRemovedGamesToUI(removedGames);
            else
                SendInstalledAppsToUI();
        }

        private List<GameModel> ReconcileMissingWatchedFolderGames()
        {
            var watchedFolders = GetWatchedFolderPaths()
                .Where(path => !string.IsNullOrWhiteSpace(path))
                .Select(path =>
                {
                    try { return Path.TrimEndingDirectorySeparator(Path.GetFullPath(path)); }
                    catch { return ""; }
                })
                .Where(path => !string.IsNullOrWhiteSpace(path))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (watchedFolders.Count == 0) return new List<GameModel>();

            var games = LoadGames();
            var removed = games
                .Where(game => TryGetMissingWatchedGamePath(game, watchedFolders, out _))
                .ToList();

            if (removed.Count == 0) return removed;

            foreach (GameModel game in removed)
            {
                DeleteGameImages(game);
                games.Remove(game);
            }
            SaveGames(games);
            return removed;
        }

        private static bool TryGetMissingWatchedGamePath(
            GameModel game,
            IReadOnlyCollection<string> watchedFolders,
            out string missingPath)
        {
            missingPath = "";
            string candidate = !string.IsNullOrWhiteSpace(game.Path)
                ? game.Path
                : game.LaunchUrl;
            candidate = candidate.Trim().Trim('"');
            if (string.IsNullOrWhiteSpace(candidate) || !Path.IsPathRooted(candidate))
                return false;

            string fullPath;
            try { fullPath = Path.GetFullPath(candidate); }
            catch { return false; }
            if (File.Exists(fullPath) || Directory.Exists(fullPath))
                return false;

            bool belongsToWatchedFolder = watchedFolders.Any(root =>
                fullPath.Equals(root, StringComparison.OrdinalIgnoreCase) ||
                fullPath.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase));
            if (!belongsToWatchedFolder)
                return false;

            missingPath = fullPath;
            return true;
        }

        private void SendInstalledAppsToUI()
        {
            var cache = LoadAppCache() ?? new AppCacheModel();
            bool cacheChanged = RefreshLightStoreCachesForInstalledAppsModal(cache);
            if (!string.Equals(_lastPlatformIconHydrationCacheFile, appCacheFile, StringComparison.OrdinalIgnoreCase))
            {
                _lastPlatformIconHydrationCacheFile = appCacheFile;
                cacheChanged |= HydrateMissingPlatformIcons(cache);
            }
            if (RepairCachedExecutablePaths(cache))
                cacheChanged = true;
            if (cacheChanged)
                SaveAppCache(cache);

            var availableWindowsApps = cache.WindowsApps
                .Where(app => string.IsNullOrWhiteSpace(app.Path) || !Path.IsPathRooted(app.Path) || File.Exists(app.Path))
                .ToList();
            var availableFolderApps = cache.FolderApps
                .Where(app => string.IsNullOrWhiteSpace(app.Path) || !Path.IsPathRooted(app.Path) || File.Exists(app.Path))
                .ToList();

            var existingMap = BuildExistingAppsMap(); // Agora Ã© um Map
            var finalList = BuildFinalList(
                cache.SteamApps, cache.EpicApps, cache.GogApps, cache.RiotApps,
                cache.XboxApps,
                availableWindowsApps, availableFolderApps, existingMap);
            finalList.AddRange(BuildEmulatorInstalledApps());
            finalList = finalList.OrderBy(app => app.Name, StringComparer.CurrentCultureIgnoreCase).ToList();

            var payload = new { type = "installedAppsList", apps = finalList };
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(payload)));
        }

        private async Task RefreshRiotAppsForModalAsync()
        {
            await _cacheLock.WaitAsync().ConfigureAwait(false);
            try
            {
                var cache = LoadAppCache() ?? new AppCacheModel();
                var currentApps = GetRiotGames()
                    .Concat(ScanWindowsApps(riotOnly: true)
                        .Where(app => app.Source.Equals("Riot", StringComparison.OrdinalIgnoreCase)))
                    .GroupBy(app => app.LaunchUrl, StringComparer.OrdinalIgnoreCase)
                    .Select(group => group.First())
                    .ToList();
                var currentFingerprint = GetRiotFingerprint();
                bool appsChanged = InstalledAppListChanged(cache.RiotApps, currentApps);
                bool fingerprintChanged = !currentFingerprint.SetEquals(cache.RiotFingerprint);
                if (!appsChanged && !fingerprintChanged) return;

                cache.RiotApps = currentApps;
                cache.RiotFingerprint = currentFingerprint;
                RefreshAutoAddSuppressions(cache);
                SaveAppCache(cache);
                Debug.WriteLine($"[InstalledApps] Cache Riot atualizado para o modal: {currentApps.Count} jogo(s).");
            }
            finally
            {
                _cacheLock.Release();
            }
        }

        private bool RefreshLightStoreCachesForInstalledAppsModal(AppCacheModel cache)
        {
            bool changed = false;

            bool RefreshStore(
                string source,
                List<InstalledApp> cachedApps,
                HashSet<string> cachedFingerprint,
                Func<HashSet<string>> getFingerprint,
                Func<List<InstalledApp>> getApps,
                Action<List<InstalledApp>> setApps,
                Action<HashSet<string>> setFingerprint,
                bool refreshEmptyCacheWhenFingerprintPresent = false)
            {
                var currentFingerprint = getFingerprint();
                bool mustRebuildEmptyCache = refreshEmptyCacheWhenFingerprintPresent &&
                    cachedApps.Count == 0 &&
                    currentFingerprint.Count > 0;
                if (!mustRebuildEmptyCache && currentFingerprint.SetEquals(cachedFingerprint))
                    return false;

                var currentApps = getApps();
                foreach (var app in currentApps) app.Source = source;

                bool storeChanged = InstalledAppListChanged(cachedApps, currentApps);
                if (storeChanged)
                    setApps(currentApps);

                setFingerprint(currentFingerprint);
                return true;
            }

            try
            {
                changed |= RefreshStore(
                    "Steam",
                    cache.SteamApps,
                    cache.SteamFingerprint,
                    GetSteamFingerprint,
                    () => GetSteamGames(includeIcons: true),
                    apps => cache.SteamApps = apps,
                    fingerprint => cache.SteamFingerprint = fingerprint);

                changed |= RefreshStore(
                    "Epic",
                    cache.EpicApps,
                    cache.EpicFingerprint,
                    GetEpicFingerprint,
                    () => GetEpicGames(includeIcons: true),
                    apps => cache.EpicApps = apps,
                    fingerprint => cache.EpicFingerprint = fingerprint);

                changed |= RefreshStore(
                    "GOG",
                    cache.GogApps,
                    cache.GogFingerprint,
                    GetGogFingerprint,
                    () => GetGOGGames(includeIcons: true),
                    apps => cache.GogApps = apps,
                    fingerprint => cache.GogFingerprint = fingerprint);


                changed |= RefreshStore(
                    "Riot",
                    cache.RiotApps,
                    cache.RiotFingerprint,
                    GetRiotFingerprint,
                    GetRiotGames,
                    apps => cache.RiotApps = apps,
                    fingerprint => cache.RiotFingerprint = fingerprint,
                    refreshEmptyCacheWhenFingerprintPresent: true);

                changed |= RefreshStore(
                    "Xbox",
                    cache.XboxApps,
                    cache.XboxFingerprint,
                    GetXboxFingerprint,
                    () => GetXboxGames(includeIcons: true),
                    apps => cache.XboxApps = apps,
                    fingerprint => cache.XboxFingerprint = fingerprint);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[InstalledApps] Falha ao atualizar caches leves de lojas: " + ex.Message);
            }

            return changed;
        }

        private static bool IsPlatformSource(string source)
        {
            return source.Equals("Steam", StringComparison.OrdinalIgnoreCase)
                || source.Equals("Epic", StringComparison.OrdinalIgnoreCase)
                || source.Equals("GOG", StringComparison.OrdinalIgnoreCase)
                || source.Equals("Riot", StringComparison.OrdinalIgnoreCase)
                || source.Equals("Xbox", StringComparison.OrdinalIgnoreCase);
        }

        private static bool MergeMissingIconsByAppKey(List<InstalledApp> target, IEnumerable<InstalledApp> source)
        {
            var iconByKey = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var app in source)
            {
                if (string.IsNullOrWhiteSpace(app.IconBase64)) continue;
                foreach (var key in AutoAddKeysForApp(app))
                {
                    if (!iconByKey.ContainsKey(key))
                        iconByKey[key] = app.IconBase64;
                }
            }

            bool changed = false;
            foreach (var app in target)
            {
                if (!string.IsNullOrWhiteSpace(app.IconBase64)) continue;
                foreach (var key in AutoAddKeysForApp(app))
                {
                    if (!iconByKey.TryGetValue(key, out var icon) || string.IsNullOrWhiteSpace(icon)) continue;
                    app.IconBase64 = icon;
                    changed = true;
                    break;
                }
            }
            return changed;
        }

        private bool HydrateMissingPlatformIcons(AppCacheModel cache)
        {
            bool changed = false;
            try
            {
                if (cache.SteamApps.Any(a => string.IsNullOrWhiteSpace(a.IconBase64)))
                    changed |= MergeMissingIconsByAppKey(cache.SteamApps, GetSteamGames(includeIcons: true));
                if (cache.EpicApps.Any(a => string.IsNullOrWhiteSpace(a.IconBase64)))
                    changed |= MergeMissingIconsByAppKey(cache.EpicApps, GetEpicGames(includeIcons: true));
                if (cache.GogApps.Any(a => string.IsNullOrWhiteSpace(a.IconBase64)))
                    changed |= MergeMissingIconsByAppKey(cache.GogApps, GetGOGGames(includeIcons: true));
                if (cache.RiotApps.Any(a => string.IsNullOrWhiteSpace(a.IconBase64)))
                    changed |= MergeMissingIconsByAppKey(cache.RiotApps, GetRiotGames());
                if (cache.XboxApps.Any(a => string.IsNullOrWhiteSpace(a.IconBase64)))
                    changed |= MergeMissingIconsByAppKey(cache.XboxApps, GetXboxGames(includeIcons: true));
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[InstalledApps] Falha ao hidratar Ã­cones leves: " + ex.Message);
            }
            return changed;
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

        private static bool IsDoorpiInternalExecutable(string? path)
        {
            if (string.IsNullOrWhiteSpace(path)) return false;

            try
            {
                string candidate = path.Trim().Trim('"');

                // Identificadores lógicos de plataformas (por exemplo, "valorant" ou
                // "league_of_legends") não são caminhos de executáveis. Resolvê-los
                // com Path.GetFullPath os transforma em caminhos relativos ao processo
                // e pode fazê-los parecer arquivos internos do Doorpi.
                if (!Path.IsPathRooted(candidate))
                    return false;

                string fullPath = Path.GetFullPath(candidate);
                string fileName = Path.GetFileName(fullPath);

                var internalExecutables = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "Doorpi.exe",
                    "Updater.exe",
                    "DoorpiInputBridge.exe",
                    "DoorpiWindowsUpdateHelper.exe"
                };

                if (internalExecutables.Contains(fileName))
                    return true;

                string currentExe = Process.GetCurrentProcess().MainModule?.FileName ?? "";
                if (!string.IsNullOrWhiteSpace(currentExe) &&
                    PathsEqual(fullPath, Path.GetFullPath(currentExe)))
                    return true;

                string baseDir = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory)
                    .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                    + Path.DirectorySeparatorChar;

                return fullPath.StartsWith(baseDir, StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        private bool IsDoorpiInternalName(string? name)
        {
            if (string.IsNullOrWhiteSpace(name)) return false;

            string normalized = NormalizeGameName(name);
            return normalized.StartsWith("doorpi", StringComparison.OrdinalIgnoreCase)
                || normalized.Equals("updater", StringComparison.OrdinalIgnoreCase)
                || normalized.Equals("doorpiinputbridge", StringComparison.OrdinalIgnoreCase)
                || normalized.Equals("doorpiwindowsupdatehelper", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsDoorpiInternalLaunchUrl(string? launchUrl)
        {
            if (string.IsNullOrWhiteSpace(launchUrl)) return false;
            string value = launchUrl.Trim();
            return value.StartsWith("doorpi:", StringComparison.OrdinalIgnoreCase)
                || value.StartsWith("doorpi://", StringComparison.OrdinalIgnoreCase);
        }

        private bool IsDoorpiInternalApp(InstalledApp app)
            => IsDoorpiInternalName(app.Name)
               || IsDoorpiInternalExecutable(app.Path)
               || IsDoorpiInternalLaunchUrl(app.LaunchUrl);

        private static bool IsAutoAddEligiblePlatformGame(InstalledApp app)
        {
            string haystack = $"{app.Name} {app.Path} {app.LaunchUrl}".Trim();
            if (string.IsNullOrWhiteSpace(haystack)) return false;

            string[] deniedFragments =
            {
                "steamworks",
                "common redistributables",
                "unreal engine"
            };

            return !deniedFragments.Any(fragment =>
                haystack.Contains(fragment, StringComparison.OrdinalIgnoreCase));
        }

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
                || launchUrl.StartsWith("xbox://", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("ms-xbl-", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("riotclient://", StringComparison.OrdinalIgnoreCase)
                || launchUrl.StartsWith("riot:", StringComparison.OrdinalIgnoreCase);
        }

        private static string StorePolicyKeyFromLaunchUrl(string launchUrl)
        {
            if (string.IsNullOrWhiteSpace(launchUrl)) return "";
            if (launchUrl.StartsWith("steam://", StringComparison.OrdinalIgnoreCase)) return "Steam";
            if (launchUrl.StartsWith("com.epicgames.launcher://", StringComparison.OrdinalIgnoreCase)) return "Epic";
            if (launchUrl.StartsWith("goggalaxy://", StringComparison.OrdinalIgnoreCase)) return "GOG";
            if (launchUrl.StartsWith("xbox://", StringComparison.OrdinalIgnoreCase) ||
                launchUrl.StartsWith("ms-xbl-", StringComparison.OrdinalIgnoreCase)) return "Xbox";
            if (launchUrl.StartsWith("riotclient://", StringComparison.OrdinalIgnoreCase) ||
                launchUrl.StartsWith("riot:", StringComparison.OrdinalIgnoreCase)) return "Riot";
            return "";
        }

        private string StorePolicyKeyForGame(GameModel game)
        {
            if (!string.IsNullOrWhiteSpace(game.Source))
                return NormalizeStorePolicyKey(game.Source);
            return StorePolicyKeyFromLaunchUrl(game.LaunchUrl);
        }

        private bool IsGameBlockedForCurrentUser(GameModel game)
        {
            var storeKey = StorePolicyKeyForGame(game);
            return !string.IsNullOrWhiteSpace(storeKey) && IsStoreBlockedForCurrentUser(storeKey);
        }

        private void SendAdminPolicyBlocked(string kind, string name, string storeId)
        {
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "adminPolicyBlocked",
                    kind,
                    name,
                    storeId = NormalizeStorePolicyKey(storeId)
                })));
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

            // LÃª os Jogos
            foreach (var g in LoadGames())
            {
                string state = g.IsPendingArtwork ? "preparing-game" : "game";
                foreach (var key in AutoAddKeysForGame(g))
                    map[key] = state;
            }

            // LÃª as MÃ­dias
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
            all.AddRange(xbox);
            all.AddRange(windows);
            all.AddRange(folders);
            all = all
                .Where(app => !IsDoorpiInternalApp(app))
                .Where(IsAutoAddEligiblePlatformGame)
                .ToList();

            foreach (var app in all)
            {
                var appKeys = AutoAddKeysForApp(app).ToList();
                app.IsAdminLocked = IsStoreBlockedForCurrentUser(app.Source);
                app.AdminLockReason = app.IsAdminLocked ? "blocked-store" : "";

                // Reutiliza sua chave original IsAdded e alimenta o AddedTo
                if (appKeys.Select(k => existingMap.TryGetValue(k, out var mappedType) ? mappedType : null)
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
                    // Se o WebView2 estiver segurando arquivos (travando a exclusÃ£o),
                    // NÃ³s movemos e renomeamos a pasta. Isso a desconecta da conta,
                    // resolvendo o bug. O Windows apagarÃ¡ esse "lixo" quando fechar o app.
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
            all.AddRange(xbox);
            all.AddRange(windows);
            all.AddRange(folders);
            all = all
                .Where(app => !IsDoorpiInternalApp(app))
                .Where(IsAutoAddEligiblePlatformGame)
                .ToList();

            foreach (var app in all)
            {
                app.IsAdded = AutoAddKeysForApp(app).Any(existingGames.Contains);
                app.IsAdminLocked = IsStoreBlockedForCurrentUser(app.Source);
                app.AdminLockReason = app.IsAdminLocked ? "blocked-store" : "";
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
            // Grids de jogos pertencem ao historico permanente do perfil. Hero e logo
            // continuam sendo dados da biblioteca ativa e podem ser descartados.
            var imageUrls = new[]
            {
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
                catch { /* Ignora se imagem nÃ£o existir */ }
            }
        }
        private async Task PollInstalledAppsAsync()
        {
            // Snapshot dos fingerprints no momento em que o modal abriu
            var lastSteam = GetSteamFingerprint();
            var lastEpic = GetEpicFingerprint();
            var lastGog = GetGogFingerprint();
            var lastRiot = GetRiotFingerprint();
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
                var curXbox = GetXboxFingerprint();
                var curWin = GetWindowsRegistryFingerprint();

                bool changed = !curSteam.SetEquals(lastSteam)
                            || !curEpic.SetEquals(lastEpic)
                            || !curGog.SetEquals(lastGog)
                            || !curRiot.SetEquals(lastRiot)
                            || !curXbox.SetEquals(lastXbox)
                            || !curWin.SetEquals(lastWin);

                if (changed)
                {
                    lastSteam = curSteam;
                    lastEpic = curEpic;
                    lastGog = curGog;
                    lastRiot = curRiot;
                    lastXbox = curXbox;
                    lastWin = curWin;

                    await UpdateAppCacheAsync();
                    var cache = LoadAppCache() ?? new AppCacheModel();
                    var existingMap = BuildExistingAppsMap();
                    var apps = BuildFinalList(
                        cache.SteamApps, cache.EpicApps, cache.GogApps, cache.RiotApps,
                        cache.XboxApps,
                        cache.WindowsApps, cache.FolderApps, existingMap);
                    apps.AddRange(BuildEmulatorInstalledApps());
                    apps = apps.OrderBy(app => app.Name, StringComparer.CurrentCultureIgnoreCase).ToList();

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
                File.WriteAllText(libraryBootstrapFile, JsonSerializer.Serialize(state, IndentedJsonOptions));
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

                var steamTask = Task.Run(() => GetSteamGames(includeIcons: true)
                    .Select(a => { a.Source = "Steam"; return a; }).ToList());
                var epicTask = Task.Run(() => GetEpicGames(includeIcons: true)
                    .Select(a => { a.Source = "Epic"; return a; }).ToList());
                var gogTask = Task.Run(() => GetGOGGames(includeIcons: true)
                    .Select(a => { a.Source = "GOG"; return a; }).ToList());
                var riotTask = Task.Run(() => GetRiotGames()
                    .Select(a => { a.Source = "Riot"; return a; }).ToList());
                var xboxTask = Task.Run(() => GetXboxGames(includeIcons: true)
                    .Select(a => { a.Source = "Xbox"; return a; }).ToList());

                await Task.WhenAll(steamTask, epicTask, gogTask, riotTask, xboxTask).ConfigureAwait(false);

                cache.SteamApps = steamTask.Result;
                cache.EpicApps = epicTask.Result;
                cache.GogApps = gogTask.Result;
                cache.RiotApps = riotTask.Result;
                cache.XboxApps = xboxTask.Result;
                cache.SteamFingerprint = GetSteamFingerprint();
                cache.EpicFingerprint = GetEpicFingerprint();
                cache.GogFingerprint = GetGogFingerprint();
                cache.RiotFingerprint = GetRiotFingerprint();
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

        private Task<bool> UpsertAutoAddedPlatformGamesAsync(List<InstalledApp> platformGames)
        {
            var games = LoadGames();
            bool changed = false;

            foreach (var app in platformGames)
            {
                if (!IsAutoAddEligiblePlatformGame(app))
                    continue;

                string key = !string.IsNullOrEmpty(app.LaunchUrl) ? app.LaunchUrl : app.Path;
                if (string.IsNullOrWhiteSpace(key)) continue;
                if (games.Any(g => InstalledAppMatchesGame(app, g)))
                    continue;

                string? steamAppId = ExtractSteamAppId(app);
                bool steamReady = !string.IsNullOrEmpty(steamAppId);
                var steamAssets = steamReady ? BuildSteamCdnAssets(steamAppId!) : ("", "", "", "");

                games.Add(new GameModel
                {
                    Name = app.Name,
                    Path = app.Path,
                    LaunchUrl = app.LaunchUrl,
                    GridImage = steamAssets.Item1,
                    GridHorizontalImage = steamAssets.Item2,
                    GridSourceUrl = steamAssets.Item1,
                    GridHorizontalSourceUrl = steamAssets.Item2,
                    HeroSourceUrl = steamAssets.Item3,
                    HeroImage = steamAssets.Item3,
                    LogoImage = steamAssets.Item4,
                    IconBase64 = app.IconBase64,
                    LastPlayed = DateTime.MinValue,
                    DateAdded = DateTime.Now,
                    IsPendingArtwork = !steamReady,
                    AutoAddedByBootstrap = true,
                    ArtworkSource = steamReady ? "steam-cdn" : "pending",
                    Source = NormalizeStorePolicyKey(app.Source)
                });
                changed = true;
            }

            if (changed) SaveGames(games);
            return Task.FromResult(changed);
        }

        private bool RemoveIneligibleAutoAddedPlatformGames()
        {
            var games = LoadGames();
            var removed = games
                .Where(g => g.AutoAddedByBootstrap)
                .Where(g => !IsAutoAddEligiblePlatformGame(new InstalledApp
                {
                    Name = g.Name,
                    Path = g.Path,
                    LaunchUrl = g.LaunchUrl,
                    Source = g.Source
                }))
                .ToList();

            if (removed.Count == 0)
                return false;

            foreach (var game in removed)
            {
                DeleteGameImages(game);
                games.Remove(game);
            }

            SaveGames(games);
            return true;
        }

#if false
        // Fora do beta: Microsoft Store precisa de launch/tracking prÃ³prio antes do auto-add.
        private Task<bool> UpsertAutoAddedMicrosoftStoreAppsAsync(List<InstalledApp> storeApps)
        {
            var mediaApps = LoadMediaApps();
            bool changed = false;

            foreach (var app in storeApps)
            {
                string key = !string.IsNullOrWhiteSpace(app.LaunchUrl) ? app.LaunchUrl : app.Path;
                if (string.IsNullOrWhiteSpace(key)) continue;

                var appKeys = AutoAddKeysForApp(app).ToHashSet(StringComparer.OrdinalIgnoreCase);
                if (mediaApps.Any(m => appKeys.Contains(NormalizeAutoAddKey(m.Url))))
                    continue;

                string id = "exe_" + Convert.ToHexString(
                    MD5.HashData(Encoding.UTF8.GetBytes(key)))[..10].ToLowerInvariant();

                mediaApps.Add(new MediaAppModel
                {
                    Id = id,
                    Name = app.Name,
                    Url = key,
                    Type = "exe",
                    MultiUser = false,
                    OwnerUserId = currentUserId,
                    ShareMode = "private",
                    DateAdded = DateTime.Now
                });
                changed = true;
            }

            if (changed)
            {
                SaveMediaApps(mediaApps);
                SendMediaAppsToUI(mediaApps);
            }

            return Task.FromResult(changed);
        }
#endif

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
                    game.GridStaticImage = "";
                    game.GridHorizontalImage = "";
                    game.GridHorizontalStaticImage = "";
                    game.HeroImage = "";
                    game.HeroStaticImage = "";
                    game.LogoImage = "";
                    game.LogoStaticImage = "";
                    game.IsPendingArtwork = true;
                    game.ArtworkSource = "pending";
                    changed = true;
                    SaveGames(games);
                    continue;
                }

                game.GridImage = $"https://data.local/images/grid/{Path.GetFileName(gridTask.Result)}";
                game.GridStaticImage = "";
                if (horizontalTask.Result != null)
                {
                    game.GridHorizontalImage = $"https://data.local/images/grid-horizontal/{Path.GetFileName(horizontalTask.Result)}";
                    game.GridHorizontalStaticImage = "";
                }
                game.GridSourceUrl = assets.Grid;
                game.GridHorizontalSourceUrl = assets.Horizontal;
                game.HeroSourceUrl = assets.Hero;
                game.HeroImage = $"https://data.local/images/hero/{Path.GetFileName(heroTask.Result)}";
                game.HeroStaticImage = "";
                if (logoTask.Result != null)
                {
                    game.LogoImage = $"https://data.local/images/logo/{Path.GetFileName(logoTask.Result)}";
                    game.LogoStaticImage = "";
                }
                game.ArtworkSource = "steam-cdn-local";
                changed = true;
                SaveGames(games);
                _ = Dispatcher.BeginInvoke(() => SendGameUpdateToUI(game));
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
                        game.GridStaticImage = "";
                        game.GridHorizontalImage = "";
                        game.GridHorizontalStaticImage = "";
                        game.HeroImage = "";
                        game.HeroStaticImage = "";
                        game.LogoImage = "";
                        game.LogoStaticImage = "";
                        game.IsPendingArtwork = false;
                        game.ArtworkSource = "no-art";
                        changed = true;
                        SaveGames(games);
                        _ = Dispatcher.BeginInvoke(() => SendGameUpdateToUI(game));
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
                        game.GridStaticImage = "";
                        game.GridHorizontalImage = "";
                        game.GridHorizontalStaticImage = "";
                        game.HeroImage = "";
                        game.HeroStaticImage = "";
                        game.LogoImage = "";
                        game.LogoStaticImage = "";
                        game.IsPendingArtwork = false;
                        game.ArtworkSource = "no-art";
                        changed = true;
                        SaveGames(games);
                        _ = Dispatcher.BeginInvoke(() => SendGameUpdateToUI(game));
                        continue;
                    }

                    game.GridImage = $"https://data.local/images/grid/{Path.GetFileName(gridTask.Result)}";
                    game.GridStaticImage = "";
                    game.GridHorizontalImage = hTask.Result != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(hTask.Result)}" : game.GridImage;
                    game.GridHorizontalStaticImage = "";
                    game.GridSourceUrl = gridUrl;
                    game.GridHorizontalSourceUrl = !string.IsNullOrWhiteSpace(horizontalUrl) ? horizontalUrl : gridUrl;
                    game.HeroSourceUrl = heroUrl;
                    game.HeroImage = $"https://data.local/images/hero/{Path.GetFileName(heroTask.Result)}";
                    game.HeroStaticImage = "";
                    game.LogoImage = logoTask.Result != null ? $"https://data.local/images/logo/{Path.GetFileName(logoTask.Result)}" : "";
                    game.LogoStaticImage = "";
                    game.IsPendingArtwork = false;
                    game.ArtworkSource = "steamgrid-local";
                    changed = true;

                    SaveGames(games);
                    _ = Dispatcher.BeginInvoke(() => SendGameUpdateToUI(game));
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
                    (cache?.RiotApps?.Count ?? 0) +
                    (cache?.XboxApps?.Count ?? 0), 4, 12);

                Dispatcher.Invoke(() =>
                    webView.CoreWebView2.PostWebMessageAsString(
                        JsonSerializer.Serialize(new { type = "bootstrapStarted", count = estimate })));
            }

            _ = Task.Run(async () =>
            {
                try { await RunLibraryBootstrapAsync().ConfigureAwait(false); }
                catch (Exception ex)
                {
                    Debug.WriteLine("[Bootstrap] Erro: " + ex.Message);
                    _ = Dispatcher.BeginInvoke(() => LoadGamesIntoUI());
                }
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
            if (RemoveIneligibleAutoAddedPlatformGames())
                _ = Dispatcher.BeginInvoke(() => LoadGamesIntoUI());

            var cache = LoadAppCache() ?? new AppCacheModel();
            var platformGames = cache.SteamApps
                .Concat(cache.EpicApps)
                .Concat(cache.GogApps)
                .Concat(cache.RiotApps)
                .Concat(cache.XboxApps)
                .Where(a => !string.IsNullOrWhiteSpace(a.Name))
                .Where(IsAutoAddEligiblePlatformGame)
                .ToList();

            if (!state.PlatformAutoAddCompleted)
            {
                await UpsertAutoAddedPlatformGamesAsync(platformGames).ConfigureAwait(false);
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
                var existing = LoadMediaAppsForUser(currentUserId);
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

                NotifySteamGridArtworkFallback(name, gridUrl != null, localGrid != null);

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
                var existing = LoadMediaAppsForUser(currentUserId);

                foreach (var app in selectedApps)
                {
                    if (IsDoorpiInternalApp(app))
                        continue;

                    string key = !string.IsNullOrWhiteSpace(app.LaunchUrl) ? app.LaunchUrl : (app.Path ?? "");
                    if (string.IsNullOrWhiteSpace(key)) continue;
                    if (Path.IsPathRooted(key))
                    {
                        key = ResolveCurrentVersionedExecutablePath(key);
                        if (!File.Exists(key)) continue;
                        app.Path = key;
                    }
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
                        Debug.WriteLine($"[MediaExe] Arte nÃ£o encontrada para {app.Name}: {ex.Message}");
                    }

                    string safeName = id;

                    // DOWNLOAD EM PARALELO DOS 4 ASSETS
                    var tGrid = gridUrl != null ? DownloadImageAsync(gridUrl, gridFolder, safeName) : Task.FromResult<string?>(null);
                    var tHoriz = horizontalUrl != null ? DownloadImageAsync(horizontalUrl, gridHorizontalFolder, safeName + "_h") : Task.FromResult<string?>(null);
                    var tHero = heroUrl != null ? DownloadImageAsync(heroUrl, heroFolder, safeName) : Task.FromResult<string?>(null);
                    var tLogo = logoUrl != null ? DownloadImageAsync(logoUrl, logoFolder, safeName + "_logo") : Task.FromResult<string?>(null);

                    await Task.WhenAll(tGrid, tHoriz, tHero, tLogo);

                    NotifySteamGridArtworkFallback(app.Name, gridUrl != null, tGrid.Result != null);

                    string iconBase64 = !string.IsNullOrWhiteSpace(app.IconBase64)
                        ? app.IconBase64
                        : (!string.IsNullOrWhiteSpace(app.Path) && File.Exists(app.Path) ? GetCachedIcon(app.Path) : "");

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
                        IconBase64 = iconBase64,
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
            string jsonMessage;
            try
            {
                jsonMessage = e.TryGetWebMessageAsString();
            }
            catch (ArgumentException)
            {
                // postMessage(objeto) chega como JSON, não como string. Aceitar os
                // dois formatos evita derrubar o handler por uma mensagem válida.
                jsonMessage = e.WebMessageAsJson;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[WebView] Falha ao ler mensagem: " + ex.Message);
                return;
            }
            if (string.IsNullOrEmpty(jsonMessage)) return;
            if (!IsTrustedMainWebMessageSource(e.Source))
            {
                Debug.WriteLine("[WebView] Mensagem ignorada de origem nÃ£o confiÃ¡vel: " + e.Source);
                return;
            }

            try
            {
                using var doc = JsonDocument.Parse(jsonMessage);
                var root = doc.RootElement;
                if (!root.TryGetProperty("action", out var actionElement)) return;
                string action = actionElement.GetString() ?? "";

                if (await TryHandleProfileSyncWebMessageAsync(action, root).ConfigureAwait(true))
                    return;

                if (await TryHandleControlConfigurationWebMessageAsync(action, root).ConfigureAwait(true))
                    return;

                if (await TryHandleDoorpiFileBrowserMessageAsync(action, root).ConfigureAwait(true))
                    return;

                if (action == "requestInstalledApps")
                {
                    bool cachedOnly = root.TryGetProperty("cachedOnly", out var cachedOnlyElement)
                                      && cachedOnlyElement.ValueKind == JsonValueKind.True;
                    bool refreshRiot = root.TryGetProperty("refreshRiot", out var refreshRiotElement)
                                       && refreshRiotElement.ValueKind == JsonValueKind.True;
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            if (refreshRiot)
                                await RefreshRiotAppsForModalAsync().ConfigureAwait(false);

                            SendInstalledAppsToUI();

 
                            if (!cachedOnly && (DateTime.Now - _lastCacheBuilt).TotalSeconds > 60)
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
                            // requestInstalledApps é uma consulta leve do modal. Ela não
                            // abre o loading global e, portanto, não pode enviar hideLoading.
                            // Notificamos apenas o encerramento do indicador inline.
                            Dispatcher.Invoke(() =>
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"installedAppsRequestCompleted\"}"));
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
                    _vkbStrShift = GetStr(root, "vkbShift", "MaiÃºsc");
                    _vkbStrSpace = GetStr(root, "vkbSpace", "EspaÃ§o");
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

                                SendExtensionsToUI("success", "ExtensÃ£o atualizada! TerÃ¡ efeito ao abrir um app.");
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
                else if (action == "requestDisplaySettings")
                {
                    SendDisplaySettingsToUI();
                }
                else if (action == "saveDisplaySettings")
                {
                    var layoutScale = root.TryGetProperty("layoutScale", out var scaleEl) && scaleEl.TryGetDouble(out var scale)
                        ? scale
                        : 1.0;
                    SaveLayoutScale(layoutScale);
                    SendDisplaySettingsToUI();
                }
                else if (action == "introSystemReadyForFocus")
                {
                    RestoreDoorpiFocusAfterIntroHandoff();
                }
                else if (action == "nativeIntroSkip")
                {
                    Dispatcher.Invoke(RequestNativeBootIntroSkip);
                }
                else if (action == "doorpiHomeInteractiveReady")
                {
                    string mode = GetStr(root, "mode");
                    string activeTag = GetStr(root, "activeTag");
                    string activeId = GetStr(root, "activeId");
                    string activeClass = GetStr(root, "activeClass");
                    DoorpiBootDiagnostics.Log(
                        "home-interactive-ready",
                        $"mode={mode} active={activeTag}#{activeId}.{activeClass}");

                    _ = Dispatcher.InvokeAsync(() =>
                    {
                        bool tutorialFinished = string.Equals(
                            mode,
                            "first-run-tutorial-finished",
                            StringComparison.OrdinalIgnoreCase);
                        FocusDoorpiMainWebView(onlyIfFocusLost: !tutorialFinished);
                    });
                }
                else if (action == "requestUpdateStatus")
                {
                    SendCachedUpdateStatusToUI();
                }
                else if (action == "checkSystemUpdates")
                {
                    _ = Task.Run(() => CheckForUpdatesAsync(userInitiated: true));
                }
                else if (action == "startSystemUpdate")
                {
                    _ = Task.Run(StartSystemUpdateAsync);
                }
                else if (action == "requestWindowsUpdateStatus")
                {
                    SendCachedWindowsUpdateStatusToUI();
                }
                else if (action == "checkWindowsUpdates")
                {
                    _ = Task.Run(() => RefreshWindowsUpdateStatusAsync(scan: true));
                }
                else if (action == "startWindowsUpdateInstall")
                {
                    _ = Task.Run(StartWindowsUpdateInstallAsync);
                }
                else if (action == "requestGpuUpdateStatus")
                {
                    SendCachedGpuUpdateStatusToUI();
                }
                else if (action == "requestBluetoothStatus")
                {
                    RequestBluetoothStatus();
                }
                else if (action == "setBluetoothEnabled")
                {
                    bool enabled = root.TryGetProperty("enabled", out var enabledElement) && enabledElement.GetBoolean();
                    SetBluetoothEnabled(enabled);
                }
                else if (action == "startBluetoothDiscovery")
                {
                    StartBluetoothDiscovery();
                }
                else if (action == "stopBluetoothDiscovery")
                {
                    StopBluetoothDiscovery();
                }
                else if (action == "pairBluetoothDevice")
                {
                    PairBluetoothDevice(GetStr(root, "deviceId"));
                }
                else if (action == "removeBluetoothDevice")
                {
                    RemoveBluetoothDevice(GetStr(root, "deviceId"));
                }
                else if (action == "respondBluetoothPairing")
                {
                    bool accepted = root.TryGetProperty("accepted", out var acceptedElement) && acceptedElement.GetBoolean();
                    GetBluetoothManager().RespondToPairing(accepted, GetStr(root, "pin"));
                }
                else if (action == "requestWifiStatus")
                {
                    RequestWifiStatus();
                }
                else if (action == "setWifiEnabled")
                {
                    bool enabled = root.TryGetProperty("enabled", out var enabledElement) && enabledElement.GetBoolean();
                    SetWifiEnabled(enabled);
                }
                else if (action == "scanWifiNetworks")
                {
                    ScanWifiNetworks();
                }
                else if (action == "connectWifiNetwork")
                {
                    ConnectWifiNetwork(GetStr(root, "networkId"), GetStr(root, "password"));
                }
                else if (action == "disconnectWifi")
                {
                    DisconnectWifi();
                }
                else if (action == "forgetWifiNetwork")
                {
                    ForgetWifiNetwork(GetStr(root, "networkId"));
                }
                else if (action == "requestSoundStatus")
                {
                    RequestSoundStatus();
                }
                else if (action == "setDefaultSoundDevice")
                {
                    SetDefaultSoundDevice(GetStr(root, "deviceId"));
                }
                else if (action == "setSystemVolume")
                {
                    int volume = root.TryGetProperty("volume", out var volumeElement) ? volumeElement.GetInt32() : 0;
                    SetSystemVolume(volume);
                }
                else if (action == "openGpuUpdater")
                {
                    string updaterId = GetStr(root, "updaterId");
                    _ = Task.Run(() => OpenGpuUpdater(updaterId));
                }
                else if (action == "closeAllSessionsForGpuUpdater")
                {
                    string updaterId = GetStr(root, "updaterId");
                    _ = Task.Run(() => CloseSessionsAndOpenGpuUpdaterAsync(updaterId));
                }
                else if (action == "gpuUpdaterRestartNoticeRendered")
                {
                    ConfirmGpuRestartNoticeRendered();
                }
                else if (action == "addGpuUpdater")
                {
                    _ = AddGpuUpdaterFromDialogAsync();
                }
                else if (action == "removeGpuUpdater")
                {
                    string updaterId = GetStr(root, "updaterId");
                    _ = Task.Run(() => RemoveGpuUpdater(updaterId));
                }
                else if (action == "setBootMode" && root.TryGetProperty("mode", out var modeEl))
                {
                    SetBootMode(modeEl.GetInt32());
                    SendBootModeToUI();
                }
                else if (action == "openWindowsUpdateSettings")
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo("ms-settings:windowsupdate") { UseShellExecute = true });
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
                    catch (Exception ex) { Debug.WriteLine($"Erro ao abrir Windows Update: {ex.Message}"); }
                }
                else if (action == "openTaskbarSettings")
                {
                    try
                    {
                        // Abre as configuraÃ§Ãµes da Barra de Tarefas
                        Process.Start(new ProcessStartInfo("ms-settings:taskbar") { UseShellExecute = true });

                        // Minimiza o Doorpi e assume o controle como Mouse/Teclado
                        Dispatcher.Invoke(EnterDesktopMode);

                        _ = Task.Run(async () =>
                        {
                            bool appFound = false;

                            // Aguarda atÃ© 10 segundos para a janela de ConfiguraÃ§Ãµes abrir
                            for (int i = 0; i < 20; i++)
                            {
                                await Task.Delay(500);
                                if (Process.GetProcessesByName("SystemSettings").Length > 0)
                                {
                                    appFound = true;
                                    Dispatcher.Invoke(() =>
                                    {
                                        IntPtr fgHwnd = GetForegroundWindow();
                                        if (fgHwnd != IntPtr.Zero) ShowWindow(fgHwnd, 3); // Maximiza a janela de ConfiguraÃ§Ãµes

                                        // Move o mouse para uma Ã¡rea segura
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

                            // Monitora a cada segundo atÃ© o usuÃ¡rio fechar a janela
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
                        // Abre a janela de OpÃ§Ãµes de Entrada
                        Process.Start(new ProcessStartInfo("ms-settings:signinoptions") { UseShellExecute = true });

                        // Minimiza o Doorpi e assume o controle como Mouse/Teclado
                        Dispatcher.Invoke(EnterDesktopMode);

                        // O "_ =" descarta o aviso do compilador indicando que Ã© um Fire-And-Forget intencional
                        _ = Task.Run(async () =>
                        {
                            bool appFound = false;

                            // Aguarda atÃ© 10 segundos para a janela de ConfiguraÃ§Ãµes abrir
                            for (int i = 0; i < 20; i++)
                            {
                                await Task.Delay(500);
                                if (Process.GetProcessesByName("SystemSettings").Length > 0)
                                {
                                    appFound = true;

                                    Dispatcher.Invoke(() =>
                                    {
                                        // ForÃ§a a janela a maximizar
                                        IntPtr fgHwnd = GetForegroundWindow();
                                        if (fgHwnd != IntPtr.Zero)
                                        {
                                            ShowWindow(fgHwnd, 3);
                                        }

                                        // Joga o mouse pro canto direito (Ã¡rea vazia segura) na metade da tela
                                        int safeX = (int)SystemParameters.PrimaryScreenWidth - 20;
                                        int safeY = (int)SystemParameters.PrimaryScreenHeight / 2;
                                        SetCursorPos(safeX, safeY);

                                        // Envia um Clique Esquerdo RÃ¡pido para roubar o foco do UWP
                                        // (0x0002 = MOUSEEVENTF_LEFTDOWN | 0x0004 = MOUSEEVENTF_LEFTUP)
                                        SendMouse(0, 0, 0x0002);
                                        SendMouse(0, 0, 0x0004);
                                    });
                                    break;
                                }
                            }

                            if (!appFound) return;

                            // Monitora a cada segundo atÃ© o usuÃ¡rio fechar a janela
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
                    if (selectedApps != null && selectedApps.Count > 0)
                    {

                        webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new { type = "showLoadingCards", count = selectedApps.Count, tab = "games" }));

                        _ = Task.Run(async () => await AddMultipleGamesAsync(selectedApps));
                    }
                }
                else if (action == "launch" && root.TryGetProperty("path", out var pathElement))
                {
                    string errorMsg = GetStr(root, "errorMsg", "Erro ao iniciar jogo: ");
                    string discPath = GetStr(root, "discPath");
                    LaunchGame(pathElement.GetString(), errorMsg, discPath);
                }
                else if (action == "cancelGameLaunch")
                {
                    _launchCancelled = true;
                    ResetGameMinimizeGrace();
                    _lockedGameProcessName = "";  // ? NOVO
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
                    ClearGameFocusFallbackPrompt();
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
                    if (selectedApps != null && selectedApps.Count > 0)
                        _ = Task.Run(async () => await AddMultipleMediaAppsAsync(selectedApps));
                }
                else if (action == "browseManualMedia")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Select Executable");
                    string dialogFilter = GetStr(root, "dialogFilter", "Arquivos iniciÃ¡veis (*.exe;*.bat;*.cmd;*.lnk;*.url)|*.exe;*.bat;*.cmd;*.lnk;*.url|Todos os arquivos (*.*)|*.*");
                    string loadTitle = GetStr(root, "loadingTitle", "Adding");
                    string loadSub = GetStr(root, "loadingSub", "Fetching covers...");
                    string errMsg = GetStr(root, "errorMsg", "Error: ");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        try
                        {
                            string? selectedFile = await ShowDoorpiFileBrowserAsync(
                                dialogTitle, false, dialogFilter, "manualMedia");

                            if (!string.IsNullOrWhiteSpace(selectedFile))
                            {
                                string filePath = selectedFile;
                                string filePathJson = JsonSerializer.Serialize(filePath);
                                await webView.CoreWebView2.ExecuteScriptAsync(
                                    $"window.newGameIdsThisSession?.add({filePathJson}); window.AppStore?.mutations?.markNew?.({filePathJson});");
                                string cleanName = GetGameNameFromFile(filePath) ?? Path.GetFileNameWithoutExtension(filePath);
                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                { type = "updateLoadingText", title = loadTitle, subtitle = loadSub }));
                                await webView.CoreWebView2.ExecuteScriptAsync(
                                    "window._doorpiSuppressNativeDialogPointer?.(900); window.resetDoorpiGamepadInputState?.(); window.showLoadingCards?.(1, 'media'); closeModal();");
                                await AddMultipleMediaAppsAsync(new List<InstalledApp>
                                {
                                    new InstalledApp { Name = cleanName, Path = filePath, IconBase64 = GetCachedIcon(filePath) }
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
                    }).Task.Unwrap();
                }
                else if (action == "browseManual")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Select Executable");
                    string dialogFilter = GetStr(root, "dialogFilter", "Arquivos iniciÃ¡veis (*.exe;*.bat;*.cmd;*.lnk;*.url)|*.exe;*.bat;*.cmd;*.lnk;*.url|Todos os arquivos (*.*)|*.*");
                    string loadTitle = GetStr(root, "loadingTitle", "Adding");
                    string loadSub = GetStr(root, "loadingSub", "Fetching covers...");
                    string errMsg = GetStr(root, "errorMsg", "Error: ");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        try
                        {
                            string? selectedFile = await ShowDoorpiFileBrowserAsync(
                                dialogTitle, false, dialogFilter, "manualGame");

                            if (!string.IsNullOrWhiteSpace(selectedFile))
                            {
                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "updateLoadingText",
                                    title = loadTitle,
                                    subtitle = loadSub
                                }));
                                string filePath = selectedFile;
                                string filePathJson = JsonSerializer.Serialize(filePath);
                                await webView.CoreWebView2.ExecuteScriptAsync(
                                    $"window.newGameIdsThisSession?.add({filePathJson}); window.AppStore?.mutations?.markNew?.({filePathJson});");
                                string cleanName = GetGameNameFromFile(filePath) ?? Path.GetFileNameWithoutExtension(filePath);
                                var manualApp = new List<InstalledApp>
                                {
                                    new InstalledApp { Name = cleanName, Path = filePath, IconBase64 = GetCachedIcon(filePath) }
                                };
                                await webView.CoreWebView2.ExecuteScriptAsync(
                                    "window._doorpiSuppressNativeDialogPointer?.(900); window.resetDoorpiGamepadInputState?.(); window.showLoadingCards?.(1, 'games'); closeModal();");
                                await AddMultipleGamesAsync(manualApp);
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
                    }).Task.Unwrap();
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

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        try
                        {
                            string? selectedFolder = await ShowDoorpiFileBrowserAsync(
                                dialogTitle, true, source: "watchedFolder");

                            if (!string.IsNullOrWhiteSpace(selectedFolder))
                            {
                                string selectedPath = selectedFolder;
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
                    }).Task.Unwrap();
                }
                else if (action == "editFolder" && root.TryGetProperty("path", out var oldPathEl))
                {
                    string oldPath = oldPathEl.GetString() ?? "";
                    string dialogTitle = GetStr(root, "dialogTitle");
                    string forbiddenMsg = GetStr(root, "forbiddenMsg");
                    string forbiddenTitle = GetStr(root, "forbiddenTitle");
                    string errMsg = GetStr(root, "errorMsg");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        try
                        {
                            string? selectedFolder = await ShowDoorpiFileBrowserAsync(
                                dialogTitle, true, source: "editWatchedFolder", initialPath: oldPath);

                            if (!string.IsNullOrWhiteSpace(selectedFolder))
                            {
                                string newPath = selectedFolder;
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
                    }).Task.Unwrap();
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
                    string sourceUrl = GetStr(root, "sourceUrl");

                    if (!string.IsNullOrEmpty(gameId) && !string.IsNullOrEmpty(base64))
                    {
                        string cleanBase64 = base64.Contains(',') ? base64.Split(',')[1] : base64;
                        byte[] imageBytes = Convert.FromBase64String(cleanBase64);

                        var games = LoadGames();

                        var game = games.FirstOrDefault(g => g.Path == gameId || g.LaunchUrl == gameId);

                        if (game != null)
                        {
                            string safeName = string.Concat(game.Name.Where(c => !Path.GetInvalidFileNameChars().Contains(c)));
                            string sourceFingerprint = StableAssetName(
                                !string.IsNullOrWhiteSpace(sourceUrl)
                                    ? sourceUrl
                                    : gameId + imageType + DateTime.UtcNow.Ticks);
                            string fileName = $"{safeName}_{imageType}_{sourceFingerprint}.png";
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
                            CompletePendingArtworkReplacement(gameId, imageType);
                            var response = new { type = "staticSaved", gameId, imageType, newUrl = staticUrl };
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(response));
                        }
                        else
                        {
                            var mediaApps = LoadMediaApps();
                            var mediaApp = mediaApps.FirstOrDefault(a => a.Id == gameId);

                            if (mediaApp != null)
                            {
                                string sourceFingerprint = StableAssetName(
                                    !string.IsNullOrWhiteSpace(sourceUrl)
                                        ? sourceUrl
                                        : gameId + imageType + DateTime.UtcNow.Ticks);
                                string fileName = $"{mediaApp.Id}_{imageType}_{sourceFingerprint}.png";
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
                                CompletePendingArtworkReplacement(gameId, imageType);
                                var response = new { type = "staticSaved", gameId, imageType, newUrl = staticUrl };
                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(response));
                            }
                            else
                            {
                                var stores = LoadStoreLaunchers();
                                var store = stores.FirstOrDefault(s =>
                                    string.Equals(s.Id, gameId, StringComparison.OrdinalIgnoreCase) ||
                                    string.Equals(s.Url, gameId, StringComparison.OrdinalIgnoreCase));

                                if (store != null)
                                {
                                    string safeStoreId = StableAssetName(store.Id);
                                    string sourceFingerprint = StableAssetName(
                                        !string.IsNullOrWhiteSpace(sourceUrl)
                                            ? sourceUrl
                                            : gameId + imageType + DateTime.UtcNow.Ticks);
                                    string fileName = $"{safeStoreId}_{imageType}_{sourceFingerprint}.png";
                                    string folder = gridFolder;
                                    string folderUrlName = "grid";

                                    if (imageType == "HeroStatic") { folder = heroFolder; folderUrlName = "hero"; }
                                    else if (imageType == "LogoStatic") { folder = logoFolder; folderUrlName = "logo"; }
                                    else if (imageType == "HorizontalStatic") { folder = gridHorizontalFolder; folderUrlName = "grid-horizontal"; }

                                    string fullPath = Path.Combine(folder, fileName);
                                    File.WriteAllBytes(fullPath, imageBytes);
                                    string staticUrl = $"https://data.local/images/{folderUrlName}/{fileName}";

                                    if (imageType == "GridStatic") store.GridStaticImage = staticUrl;
                                    else if (imageType == "HorizontalStatic") store.GridHorizontalStaticImage = staticUrl;
                                    else if (imageType == "HeroStatic") store.HeroStaticImage = staticUrl;
                                    else if (imageType == "LogoStatic") store.LogoStaticImage = staticUrl;

                                    SaveStoreLaunchers(stores);
                                    CompletePendingArtworkReplacement(gameId, imageType);
                                    var response = new { type = "staticSaved", gameId, imageType, newUrl = staticUrl };
                                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(response));
                                }
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
                                if (!string.IsNullOrWhiteSpace(game.EmulatorId))
                                    SuppressEmulatorGame(game);
                                DeleteGameImages(game);
                                DeleteManagedTrailer(game.TrailerSource);
                                games.Remove(game);
                                SaveGames(games);
                                Debug.WriteLine($"[deleteGame] Jogo Removido: {gameId}");

                                // Puxa o 13Âº da fila para preencher o buraco, apÃ³s a animaÃ§Ã£o do Front terminar (350ms)
                                _ = Task.Run(async () =>
                                {
                                    await Task.Delay(350);
                                    Dispatcher.Invoke(() => LoadGamesIntoUI());
                                });
                            }
                        }
                        else
                        {
                            // MÃDIAS
                            if (gameId.Equals("youtube", StringComparison.OrdinalIgnoreCase)) return;

                            var medias = LoadMediaAppsForUser(currentUserId);
                            var media = medias.FirstOrDefault(m => string.Equals(m.Id, gameId, StringComparison.OrdinalIgnoreCase) || string.Equals(m.Url, gameId, StringComparison.OrdinalIgnoreCase));

                            if (media != null)
                            {
                                DeleteMediaImages(media);
                                await DeleteMediaWebViewProfileAsync(media);
                                medias.Remove(media);
                                SaveMediaApps(medias);
                                Debug.WriteLine($"[deleteGame] MÃ­dia Removida: {gameId}");

                                // Atualiza a fila de mÃ­dia para preencher o buraco
                                _ = Task.Run(async () =>
                                {
                                    await Task.Delay(350);
                                    Dispatcher.Invoke(() => SendMediaAppsToUI(LoadMediaApps()));
                                });
                            }
                        }
                    }
                }
                else if (action == "searchSteamGridArtwork")
                {
                    string requestId = GetStr(root, "requestId");
                    string query = GetStr(root, "query");
                    string category = GetStr(root, "category");

                    _ = Task.Run(async () =>
                    {
                        var images = await FetchSteamGridImageListAsync(query, category).ConfigureAwait(false);
                        Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new
                            {
                                type = "steamGridArtworkResults",
                                requestId,
                                query,
                                category,
                                images
                            })));
                    });
                }
                else if (action == "searchProfilePhotoGames")
                {
                    string requestId = GetStr(root, "requestId");
                    string query = GetStr(root, "query");
                    string apiKey = GetStr(root, "apiKey");
                    if (string.IsNullOrWhiteSpace(apiKey)) apiKey = GetSteamGridApiKey();

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            var games = await SearchProfilePhotoGameSuggestionsAsync(
                                query,
                                apiKey,
                                CancellationToken.None).ConfigureAwait(false);
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "profilePhotoGameSuggestions",
                                    requestId,
                                    query,
                                    games = games.Select(game => new { id = game.Id, name = game.Name }).ToList()
                                })));
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine("[ProfilePhoto] Autocomplete falhou: " + ex.Message);
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "profilePhotoGameSuggestions",
                                    requestId,
                                    query,
                                    games = Array.Empty<object>()
                                })));
                        }
                    });
                }
                else if (action == "searchProfilePhotoArtwork")
                {
                    string requestId = GetStr(root, "requestId");
                    string query = GetStr(root, "query");
                    string apiKey = GetStr(root, "apiKey");
                    bool suggestions = root.TryGetProperty("suggestions", out var suggestionsEl) && suggestionsEl.GetBoolean();
                    if (string.IsNullOrWhiteSpace(apiKey)) apiKey = GetSteamGridApiKey();

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            var result = await SearchProfilePhotoArtworkAsync(
                                query,
                                apiKey,
                                suggestions,
                                CancellationToken.None).ConfigureAwait(false);
                            var squares = result.Squares.Select(item => new
                            {
                                id = item.Id,
                                url = item.Url,
                                thumb = item.Thumb,
                                score = item.Score,
                                width = item.Width,
                                height = item.Height,
                                shape = item.Shape,
                                gameName = item.GameName
                            }).ToList();
                            var verticals = result.Verticals.Select(item => new
                            {
                                id = item.Id,
                                url = item.Url,
                                thumb = item.Thumb,
                                score = item.Score,
                                width = item.Width,
                                height = item.Height,
                                shape = item.Shape,
                                gameName = item.GameName
                            }).ToList();
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "profilePhotoArtworkResults",
                                    requestId,
                                    query,
                                    suggestions,
                                    squares,
                                    verticals
                                })));
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine("[ProfilePhoto] Pesquisa falhou: " + ex.Message);
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "profilePhotoArtworkResults",
                                    requestId,
                                    query,
                                    suggestions,
                                    squares = Array.Empty<object>(),
                                    verticals = Array.Empty<object>(),
                                    error = "profile-photo-search-failed"
                                })));
                        }
                    });
                }
                else if (action == "loadProfilePhotoSource")
                {
                    string requestId = GetStr(root, "requestId");
                    string url = GetStr(root, "url");
                    string source = GetStr(root, "source", "url");
                    int assetId = root.TryGetProperty("assetId", out var assetIdEl) && assetIdEl.TryGetInt32(out int parsedAssetId)
                        ? parsedAssetId
                        : 0;

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            int lastPercent = -1;
                            long lastProgressAt = 0;
                            void ReportProgress(long receivedBytes, long? totalBytes)
                            {
                                int? percent = totalBytes is > 0
                                    ? Math.Clamp((int)Math.Round(receivedBytes * 100d / totalBytes.Value), 0, 100)
                                    : null;
                                long now = Environment.TickCount64;
                                if (percent.HasValue)
                                {
                                    if (percent.Value != 100 && lastPercent >= 0 &&
                                        percent.Value < lastPercent + 4 && now - lastProgressAt < 180)
                                        return;
                                    lastPercent = percent.Value;
                                }
                                else if (receivedBytes > 0 && now - lastProgressAt < 180)
                                {
                                    return;
                                }

                                lastProgressAt = now;
                                _ = Dispatcher.BeginInvoke(new Action(() =>
                                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                    {
                                        type = "profilePhotoSourceProgress",
                                        requestId,
                                        receivedBytes,
                                        totalBytes,
                                        percent
                                    }))));
                            }

                            var loaded = await DownloadProfilePhotoSourceAsync(
                                url,
                                ReportProgress,
                                CancellationToken.None).ConfigureAwait(false);
                            string dataUrl = $"data:{loaded.Mime};base64,{Convert.ToBase64String(loaded.Bytes)}";
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "profilePhotoSourceLoaded",
                                    requestId,
                                    dataUrl,
                                    source,
                                    sourceUrl = url,
                                    assetId
                                })));
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine("[ProfilePhoto] Fonte rejeitada: " + ex.Message);
                            string error = ex is InvalidDataException ? ex.Message : "profile-photo-download-failed";
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new { type = "profilePhotoSourceFailed", requestId, error })));
                        }
                    });
                }
                else if (action == "pickProfilePhotoSource")
                {
                    string requestId = GetStr(root, "requestId");
                    string dialogTitle = GetStr(root, "dialogTitle", "Select profile photo");
                    await Dispatcher.InvokeAsync(async () =>
                    {
                        string? selectedFile = await ShowDoorpiFileBrowserAsync(
                            dialogTitle,
                            false,
                            "Static images (*.png;*.jpg;*.jpeg;*.webp)|*.png;*.jpg;*.jpeg;*.webp",
                            "profilePhoto");
                        if (string.IsNullOrWhiteSpace(selectedFile))
                        {
                            webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new { type = "profilePhotoSourceCanceled", requestId }));
                            return;
                        }

                        try
                        {
                            var info = new FileInfo(selectedFile);
                            if (info.Length > ProfilePhotoMaxBytes)
                                throw new InvalidDataException("profile-photo-too-large");
                            byte[] bytes = File.ReadAllBytes(selectedFile);
                            if (!TryGetStaticProfilePhotoMime(bytes, out string mime))
                                throw new InvalidDataException("profile-photo-invalid-format");
                            string dataUrl = $"data:{mime};base64,{Convert.ToBase64String(bytes)}";
                            webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "profilePhotoSourceLoaded",
                                    requestId,
                                    dataUrl,
                                    source = "local",
                                    sourceUrl = "",
                                    assetId = 0
                                }));
                        }
                        catch (Exception ex)
                        {
                            string error = ex is InvalidDataException ? ex.Message : "profile-photo-read-failed";
                            webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new { type = "profilePhotoSourceFailed", requestId, error }));
                        }
                    }).Task.Unwrap();
                }
                else if (action == "pickArtworkImage")
                {
                    string requestId = GetStr(root, "requestId");
                    string category = GetStr(root, "category");
                    string dialogTitle = GetStr(root, "dialogTitle", "Select image");
                    string dialogFilter = GetStr(root, "dialogFilter", "Images (*.png;*.jpg;*.jpeg;*.webp;*.gif)|*.png;*.jpg;*.jpeg;*.webp;*.gif");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        string? selectedFile = await ShowDoorpiFileBrowserAsync(
                            dialogTitle, false, dialogFilter, "artworkImage");

                        if (!string.IsNullOrWhiteSpace(selectedFile))
                        {
                            string ext = ExtensionForImagePath(selectedFile);
                            string mime = ext is ".jpg" or ".jpeg" ? "image/jpeg" :
                                ext == ".webp" ? "image/webp" :
                                ext == ".gif" ? "image/gif" : "image/png";
                            string b64 = Convert.ToBase64String(File.ReadAllBytes(selectedFile));
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                            {
                                type = "artworkImagePicked",
                                requestId,
                                category,
                                path = selectedFile,
                                preview = $"data:{mime};base64,{b64}"
                            }));
                        }
                        else
                        {
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                            {
                                type = "artworkImagePickCanceled",
                                requestId,
                                category
                            }));
                        }
                    }).Task.Unwrap();
                }
                else if (action == "applyArtworkSelection" &&
                         root.TryGetProperty("gameId", out var artworkIdEl) &&
                         root.TryGetProperty("images", out var artworkImagesEl))
                {
                    string gameId = artworkIdEl.GetString() ?? "";
                    bool isMedia = root.TryGetProperty("isMedia", out var artworkMediaEl) && artworkMediaEl.GetBoolean();
                    bool isStore = root.TryGetProperty("isStore", out var artworkStoreEl) && artworkStoreEl.GetBoolean();
                    bool localFiles = root.TryGetProperty("localFiles", out var localFilesEl) && localFilesEl.GetBoolean();
                    string requestId = GetStr(root, "requestId");
                    string artworkGameName = GetStr(root, "gameName");
                    var imagesClone = artworkImagesEl.Clone();

                    if (!string.IsNullOrWhiteSpace(gameId))
                    {
                        _ = Task.Run(async () =>
                        {
                            void ReportArtworkProgress(string category, long receivedBytes, long? totalBytes)
                            {
                                Dispatcher.BeginInvoke(() =>
                                    webView.CoreWebView2.PostWebMessageAsString(
                                        JsonSerializer.Serialize(new
                                        {
                                            type = "artworkDownloadProgress",
                                            requestId,
                                            category,
                                            receivedBytes,
                                            totalBytes
                                        })));
                            }

                            var result = isStore
                                ? await SaveSelectedStoreArtworkAsync(
                                    gameId,
                                    imagesClone,
                                    localFiles,
                                    ReportArtworkProgress).ConfigureAwait(false)
                                : await SaveSelectedArtworkAsync(
                                    gameId,
                                    artworkGameName,
                                    isMedia,
                                    imagesClone,
                                    localFiles,
                                    ReportArtworkProgress).ConfigureAwait(false);
                            var pendingStaticTypes = GetPendingArtworkTypes(gameId);
                            Dispatcher.Invoke(() =>
                            {
                                if (isStore) SendStoresToUI(LoadStoreLaunchers());
                                else if (isMedia)
                                {
                                    var updatedMedia = LoadMediaApps().FirstOrDefault(app =>
                                        string.Equals(app.Id, gameId, StringComparison.OrdinalIgnoreCase) ||
                                        string.Equals(app.Url, gameId, StringComparison.OrdinalIgnoreCase));
                                    if (updatedMedia != null) SendMediaAppUpdateToUI(updatedMedia, gameId);
                                }
                                else
                                {
                                    var updatedGame = LoadGames().FirstOrDefault(game =>
                                        string.Equals(game.Path, gameId, StringComparison.OrdinalIgnoreCase) ||
                                        string.Equals(game.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase));
                                    if (updatedGame != null) SendGameUpdateToUI(updatedGame);
                                }

                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "artworkSelectionApplied",
                                    requestId,
                                    gameId,
                                    isMedia,
                                    isStore,
                                    images = result,
                                    pendingStaticTypes
                                }));
                            });
                        });
                    }
                }
                else if (action == "applyHistoryArtworkSelection" &&
                         root.TryGetProperty("images", out var historyArtworkImagesEl))
                {
                    string gameName = GetStr(root, "gameName");
                    string requestId = GetStr(root, "requestId");
                    var imagesClone = historyArtworkImagesEl.Clone();

                    if (!string.IsNullOrWhiteSpace(gameName))
                    {
                        _ = Task.Run(async () =>
                        {
                            var result = await SaveSelectedHistoryArtworkAsync(gameName, imagesClone).ConfigureAwait(false);
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "artworkSelectionApplied",
                                    requestId,
                                    gameName,
                                    isHistory = true,
                                    images = result
                                })));
                        });
                    }
                }
                else if (action == "deleteGameHistory")
                {
                    string gameName = GetStr(root, "gameName");
                    string profileId = currentUserId;
                    if (!string.IsNullOrWhiteSpace(gameName) && !string.IsNullOrWhiteSpace(profileId))
                    {
                        _ = Task.Run(() =>
                        {
                            bool removed = DeleteGameHistoryEntry(profileId, gameName);
                            Dispatcher.Invoke(() =>
                            {
                                if (removed) LoadGamesIntoUI();
                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "gameHistoryDeleted",
                                    profileId,
                                    gameName,
                                    removed
                                }));
                            });
                        });
                    }
                }
                else if (await TryHandleEmulatorMessageAsync(action, root))
                {
                }
                else if (action == "browseEditLaunchCommand")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Selecionar programa ou atalho");
                    string initialPath = GetStr(root, "initialPath");
                    await Dispatcher.InvokeAsync(async () =>
                    {
                        string? selectedFile = await ShowDoorpiFileBrowserAsync(
                            dialogTitle,
                            false,
                            "Arquivos iniciaveis (*.exe;*.com;*.bat;*.cmd;*.lnk;*.url)|*.exe;*.com;*.bat;*.cmd;*.lnk;*.url|Todos os arquivos (*.*)|*.*",
                            "editLaunchCommand",
                            initialPath);
                        webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "editLaunchCommandSelected",
                            path = selectedFile ?? ""
                        }));
                    }).Task.Unwrap();
                }
                else if (action == "browseGameTrailer")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Selecionar trailer");
                    string initialPath = GetStr(root, "initialPath");
                    await Dispatcher.InvokeAsync(async () =>
                    {
                        string? selectedFile = await ShowDoorpiFileBrowserAsync(
                            dialogTitle,
                            false,
                            "Vídeos compatíveis (*.mp4;*.webm;*.mov;*.m4v;*.ogv;*.ogg)|*.mp4;*.webm;*.mov;*.m4v;*.ogv;*.ogg|Todos os arquivos (*.*)|*.*",
                            "gameTrailer",
                            initialPath);
                        webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "gameTrailerSelected",
                            path = selectedFile ?? ""
                        }));
                    }).Task.Unwrap();
                }
                else if (action == "editGame" && root.TryGetProperty("gameId", out var editIdEl))
                {
                    string gameId = editIdEl.GetString() ?? "";
                    bool hasNewName = root.TryGetProperty("newName", out var editNameEl);
                    string newName = hasNewName ? (editNameEl.GetString() ?? "") : "";
                    bool hasNewLaunchCommand = root.TryGetProperty("newLaunchCommand", out var editCommandEl);
                    string newLaunchCommand = hasNewLaunchCommand ? (editCommandEl.GetString() ?? "").Trim() : "";
                    bool hasNewUrl = root.TryGetProperty("newUrl", out var editUrlEl);
                    string newUrl = hasNewUrl ? (editUrlEl.GetString() ?? "").Trim() : "";
                    bool hasDisableGamepad = root.TryGetProperty("disableGamepadControl", out var dgcEl);
                    bool hasNewTrailerSource = root.TryGetProperty("newTrailerSource", out var trailerSourceEl);
                    string newTrailerSource = hasNewTrailerSource ? (trailerSourceEl.GetString() ?? "").Trim() : "";
                    string newTrailerType = root.TryGetProperty("newTrailerType", out var trailerTypeEl)
                        ? (trailerTypeEl.GetString() ?? "").Trim().ToLowerInvariant()
                        : "";

                    if (!string.IsNullOrEmpty(gameId))
                    {
                        var games = LoadGames();
                        var game = games.FirstOrDefault(g =>
                            string.Equals(g.Path, gameId, StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(g.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase));

                        if (game != null)
                        {
                            bool changed = false;
                            if (hasNewName && !string.IsNullOrEmpty(newName))
                            {
                                game.Name = newName;
                                changed = true;
                                Debug.WriteLine($"[editGame] '{game.Path}' renomeado para: {newName}");
                            }
                            if (hasNewLaunchCommand && !string.IsNullOrWhiteSpace(newLaunchCommand))
                            {
                                string defaultTarget = !string.IsNullOrWhiteSpace(game.LaunchUrl) ? game.LaunchUrl.Trim() : game.Path.Trim();
                                game.LaunchCommand = string.Equals(newLaunchCommand, defaultTarget, StringComparison.OrdinalIgnoreCase)
                                    ? ""
                                    : newLaunchCommand;
                                changed = true;
                                Debug.WriteLine($"[editGame] Comando atualizado para: {game.Name}");
                            }
                            if (hasNewTrailerSource)
                            {
                                var savedTrailer = await SaveGameTrailerAsync(
                                    gameId,
                                    newTrailerSource,
                                    newTrailerType,
                                    game.TrailerSource).ConfigureAwait(true);
                                if (savedTrailer.Success)
                                {
                                    game.TrailerSource = savedTrailer.Source;
                                    game.TrailerType = savedTrailer.Type;
                                    changed = true;
                                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                    {
                                        type = "gameTrailerUpdated",
                                        gameId,
                                        source = savedTrailer.Source,
                                        trailerType = savedTrailer.Type
                                    }));
                                }
                                else
                                {
                                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                    {
                                        type = "gameTrailerUpdateFailed",
                                        gameId
                                    }));
                                }
                            }
                            if (changed)
                            {
                                SaveGames(games);
                                SendGameUpdateToUI(game);
                            }
                        }
                        else
                        {
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
                                    Debug.WriteLine($"[editGame] MÃ­dia renomeada para: {newName}");
                                }
                                if (hasDisableGamepad)
                                {
                                    media.DisableGamepadControl = dgcEl.GetBoolean();
                                    changed = true;
                                    Debug.WriteLine($"[editGame] DisableGamepadControl={media.DisableGamepadControl} para: {gameId}");
                                }
                                if (hasNewLaunchCommand &&
                                    string.Equals(media.Type, "exe", StringComparison.OrdinalIgnoreCase) &&
                                    !string.IsNullOrWhiteSpace(newLaunchCommand))
                                {
                                    media.LaunchCommand = string.Equals(newLaunchCommand, media.Url.Trim(), StringComparison.OrdinalIgnoreCase)
                                        ? ""
                                        : newLaunchCommand;
                                    changed = true;
                                    Debug.WriteLine($"[editGame] Comando atualizado para o app: {media.Name}");
                                }
                                if (hasNewUrl &&
                                    (string.Equals(media.Type, "browser", StringComparison.OrdinalIgnoreCase) ||
                                     string.Equals(media.Type, "webview", StringComparison.OrdinalIgnoreCase)) &&
                                    Uri.TryCreate(newUrl, UriKind.Absolute, out var parsedUrl) &&
                                    (parsedUrl.Scheme == Uri.UriSchemeHttp || parsedUrl.Scheme == Uri.UriSchemeHttps))
                                {
                                    media.Url = newUrl;
                                    changed = true;
                                    Debug.WriteLine($"[editGame] URL atualizada para o Web App: {media.Name}");
                                }
                                if (changed)
                                {
                                    SaveMediaApps(medias);
                                    SendMediaAppUpdateToUI(media, gameId);
                                }
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
                    var savedProfiles = new List<(UserProfile Profile, List<string> Folders, bool SyncConnected, bool ImportCloud)>();

                    foreach (var userEl in incoming)
                    {
                        bool isFirstAdmin = !existingUsers.Any(u => u.IsAdmin) && savedProfiles.Count == 0;
                        string requestedProfileId = NormalizeProfileSyncId(GetStr(userEl, "id"));
                        var profile = new UserProfile
                        {
                            Id = string.IsNullOrWhiteSpace(requestedProfileId)
                                ? MakeUserId(GetStr(userEl, "name"))
                                : requestedProfileId,
                            Name = GetStr(userEl, "name"),
                            PhotoBase64 = GetStr(userEl, "photoBase64"),
                            PhotoSource = GetStr(userEl, "photoSource"),
                            PhotoSourceUrl = GetStr(userEl, "photoSourceUrl"),
                            PhotoSteamGridAssetId = userEl.TryGetProperty("photoSteamGridAssetId", out var setupPhotoAssetEl) && setupPhotoAssetEl.TryGetInt32(out int setupPhotoAssetId) ? setupPhotoAssetId : 0,
                            PhotoCropX = userEl.TryGetProperty("photoCropX", out var setupPhotoCropXEl) && setupPhotoCropXEl.TryGetDouble(out double setupPhotoCropX) ? setupPhotoCropX : 0,
                            PhotoCropY = userEl.TryGetProperty("photoCropY", out var setupPhotoCropYEl) && setupPhotoCropYEl.TryGetDouble(out double setupPhotoCropY) ? setupPhotoCropY : 0,
                            PhotoZoom = userEl.TryGetProperty("photoZoom", out var setupPhotoZoomEl) && setupPhotoZoomEl.TryGetDouble(out double setupPhotoZoom) ? setupPhotoZoom : 1,
                            SteamGridApiKey = GetStr(userEl, "apiKey"),
                            PinCode = NormalizePinCode(GetStr(userEl, "pin")),
                            IsAdmin = isFirstAdmin,
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
                                IndentedJsonOptions));

                        bool syncConnected = userEl.TryGetProperty("syncConnected", out var syncConnectedEl) && syncConnectedEl.GetBoolean();
                        bool importCloud = userEl.TryGetProperty("importCloud", out var importCloudEl) && importCloudEl.GetBoolean();
                        savedProfiles.Add((profile, folders, syncConnected, importCloud));
                    }

                    SaveUserProfiles(existingUsers.Where(u => !string.IsNullOrWhiteSpace(u.Name)).ToList());

                    if (savedProfiles.Count > 0)
                    {
                        activeIndex = Math.Clamp(activeIndex, 0, savedProfiles.Count - 1);
                        var active = savedProfiles[activeIndex].Profile;
                        SetActiveUser(active, migrateLegacyFiles: wasEmpty && File.Exists(Path.Combine(dataFolder, "games.json")));
                        RestartWatchers();
                        PostUserTransitionStart("initial", active);

                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                var activeSync = savedProfiles[activeIndex];
                                if (activeSync.SyncConnected)
                                    await CompletePendingSetupProfileSyncAsync(activeSync.Profile.Id, activeSync.ImportCloud)
                                        .ConfigureAwait(false);

                                // O Segredo 1: Executa a validaÃ§Ã£o das mÃ­dias simultaneamente para TODOS os usuÃ¡rios
                                await Dispatcher.InvokeAsync(LoadCurrentUserIntoUI);
                                await WaitForConsoleShellReadyForUserTransitionAsync().ConfigureAwait(false);
                                _ = Dispatcher.BeginInvoke(() =>
                                {
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideSystemLoading\"}");
                                });
                                PostUserTransitionComplete("initial", showTransition: true, restartAudio: true, waitForHomeReady: true);

                                _ = Task.Run(async () =>
                                {
                                    try
                                    {
                                        var initTasks = new List<Task>();
                                        foreach (var item in savedProfiles)
                                        {
                                            string mediaPath = Path.Combine(dataFolder, "users", item.Profile.Id, "media.json");
                                            bool isActive = string.Equals(item.Profile.Id, currentUserId, StringComparison.OrdinalIgnoreCase);
                                            initTasks.Add(SynchronizeNativeAppsAsync(
                                                item.Profile.Id,
                                                mediaPath,
                                                addMissingApps: true,
                                                silent: !isActive));
                                        }

                                        await Task.WhenAll(initTasks).ConfigureAwait(false);
                                    }
                                    catch (Exception ex)
                                    {
                                        Debug.WriteLine("[SetupBatch] Inicializacao em background falhou: " + ex.Message);
                                    }
                                });
                            }
                            catch (Exception ex)
                            {
                                Debug.WriteLine("[SetupBatch] Erro: " + ex.Message);
                                _ = Dispatcher.BeginInvoke(() =>
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideSystemLoading\"}"));
                                try { PostUserTransitionComplete("initial", showTransition: true, restartAudio: false, waitForHomeReady: true); } catch { }
                            }
                        });
                    }
                }
                else if (action == "deleteCurrentUser")
                {
                    await HandleDeleteCurrentUserAsync();
                }
                else if (action == "saveUserProfile")
                {
                    bool createNew = root.TryGetProperty("createNew", out var createEl) && createEl.GetBoolean();
                    bool isPrimary = root.TryGetProperty("isPrimary", out var isPrimEl) && isPrimEl.GetBoolean();
                    bool isLast = root.TryGetProperty("isLast", out var isLastEl) && isLastEl.GetBoolean();
                    bool skipTasks = root.TryGetProperty("skipTasks", out var skipEl) && skipEl.GetBoolean();
                    bool hasPin = root.TryGetProperty("pin", out _);
                    bool hasApiKey = root.TryGetProperty("apiKey", out _);
                    bool hasPhotoMetadata = root.TryGetProperty("photoSource", out _) ||
                                            root.TryGetProperty("photoSourceUrl", out _) ||
                                            root.TryGetProperty("photoSteamGridAssetId", out _) ||
                                            root.TryGetProperty("photoCropX", out _) ||
                                            root.TryGetProperty("photoCropY", out _) ||
                                            root.TryGetProperty("photoZoom", out _);
                    string requestedPin = hasPin ? NormalizePinCode(GetStr(root, "pin")) : "";

                    string requestedId = GetStr(root, "userId");
                    var profile = new UserProfile
                    {
                        Id = createNew ? "" : (!string.IsNullOrWhiteSpace(requestedId) ? requestedId : currentUserId),
                        Name = GetStr(root, "name"),
                        PhotoBase64 = GetStr(root, "photoBase64"),
                        PhotoSource = GetStr(root, "photoSource"),
                        PhotoSourceUrl = GetStr(root, "photoSourceUrl"),
                        PhotoSteamGridAssetId = root.TryGetProperty("photoSteamGridAssetId", out var photoAssetEl) && photoAssetEl.TryGetInt32(out int photoAssetId) ? photoAssetId : 0,
                        PhotoCropX = root.TryGetProperty("photoCropX", out var photoCropXEl) && photoCropXEl.TryGetDouble(out double photoCropX) ? photoCropX : 0,
                        PhotoCropY = root.TryGetProperty("photoCropY", out var photoCropYEl) && photoCropYEl.TryGetDouble(out double photoCropY) ? photoCropY : 0,
                        PhotoZoom = root.TryGetProperty("photoZoom", out var photoZoomEl) && photoZoomEl.TryGetDouble(out double photoZoom) ? photoZoom : 1,
                        SteamGridApiKey = hasApiKey ? GetStr(root, "apiKey") : "",
                        PinCode = requestedPin,
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
                        if (hasPhotoMetadata)
                        {
                            existingUser.PhotoSource = profile.PhotoSource;
                            existingUser.PhotoSourceUrl = profile.PhotoSourceUrl;
                            existingUser.PhotoSteamGridAssetId = profile.PhotoSteamGridAssetId;
                            existingUser.PhotoCropX = profile.PhotoCropX;
                            existingUser.PhotoCropY = profile.PhotoCropY;
                            existingUser.PhotoZoom = profile.PhotoZoom;
                        }
                        if (hasApiKey) existingUser.SteamGridApiKey = profile.SteamGridApiKey;
                        if (hasPin) existingUser.PinCode = requestedPin;
                        existingUser.LastUsed = DateTime.Now;
                        profile.DateCreated = existingUser.DateCreated;
                        profile = existingUser;
                    }
                    else
                    {
                        profile.Id = MakeUserId(profile.Name);
                        profile.IsAdmin = users.Count == 0 || !users.Any(u => u.IsAdmin);
                        users.Add(profile);
                    }

                    SaveUserProfiles(users);

                    bool isFirstEver = users.Count == 1;
                    bool shouldShowInitialTransition = isFirstEver && isLast && !skipTasks;
                    SetActiveUser(profile, migrateLegacyFiles: isFirstEver && !createNew);
                    RestartWatchers();
                    SaveUserProfile(profile);
                    if (shouldShowInitialTransition)
                        PostUserTransitionStart("initial", profile);

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
                                await SynchronizeNativeAppsAsync(
                                    taskUserId,
                                    taskMediaFile,
                                    addMissingApps: existingUser == null);
                                if (isLast)
                                {
                                    await Dispatcher.InvokeAsync(LoadCurrentUserIntoUI);
                                    await WaitForConsoleShellReadyForUserTransitionAsync().ConfigureAwait(false);
                                    Dispatcher.Invoke(() =>
                                    {
                                        webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideSystemLoading\"}");
                                    });
                                    if (shouldShowInitialTransition)
                                        PostUserTransitionComplete("initial", showTransition: true, restartAudio: true);
                                }
                            }
                            catch (Exception ex)
                            {
                                Debug.WriteLine("[Setup] Erro: " + ex.Message);
                                if (shouldShowInitialTransition)
                                {
                                    try { PostUserTransitionComplete("initial", showTransition: true, restartAudio: false, waitForHomeReady: false); } catch { }
                                }
                            }
                        });
                    }
                    else
                    {
                        Dispatcher.Invoke(() =>
                        {
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(BuildCurrentUserPayload(profile)));
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
                    if (!string.IsNullOrWhiteSpace(userId))
                    {
                        var requestedUser = LoadUserProfiles()
                            .FirstOrDefault(u => string.Equals(u.Id, userId, StringComparison.OrdinalIgnoreCase));
                        if (requestedUser != null && !string.IsNullOrWhiteSpace(requestedUser.PinCode))
                        {
                            string pin = NormalizePinCode(GetStr(root, "pin"));
                            if (!string.Equals(pin, requestedUser.PinCode, StringComparison.Ordinal))
                            {
                                Dispatcher.Invoke(() =>
                                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                    {
                                        type = "userPinRejected",
                                        userId
                                    })));
                                return;
                            }
                        }
                        SwitchToUser(userId);
                    }
                }
                else if (action == "recoverUserPin")
                {
                    string userId = GetStr(root, "userId");
                    string userName = GetStr(root, "userName");
                    string newPin = NormalizePinCode(GetStr(root, "pin"));
                    var users = LoadUserProfiles();
                    var requestedUser = users.FirstOrDefault(u =>
                        string.Equals(u.Id, userId, StringComparison.OrdinalIgnoreCase));

                    string? reason = null;
                    if (requestedUser == null)
                        reason = "pinRecoveryFailed";
                    else if (!string.Equals(userName, requestedUser.Name, StringComparison.Ordinal))
                        reason = "pinRecoveryInvalidName";
                    else if (newPin.Length != 4)
                        reason = "pinRecoveryInvalidPin";

                    if (reason != null)
                    {
                        Dispatcher.Invoke(() =>
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                            {
                                type = "userPinRecoveryRejected",
                                reason,
                                userId
                            })));
                        return;
                    }

                    requestedUser!.PinCode = newPin;
                    requestedUser.LastUsed = DateTime.Now;
                    SaveUserProfiles(users);
                    SwitchToUser(requestedUser.Id);
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
                    string successMsg = GetStr(root, "successMsg", "ExtensÃ£o instalada com sucesso.");

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
                            SendExtensionsToUI("success", "ExtensÃ£o removida. As mudanÃ§as terÃ£o efeito na prÃ³xima vez que abrir um app.");
                        }
                        catch (Exception ex)
                        {
                            SendExtensionsToUI("error", "Erro ao remover: " + ex.Message);
                        }
                    });
                }
                else if (action == "openExtensionStore")
                {
                    _extBtnTitle = GetStr(root, "extBtnTitle", "Adicionar extensÃ£o ao Doorpi");
                    _extBtnSub = GetStr(root, "extBtnSub", "Instalar via Doorpi Browser");
                    _extToastTitle = GetStr(root, "toastTitle", "Doorpi");
                    _extToastSub = GetStr(root, "toastSub", "ExtensÃ£o enviada ao Doorpi!");
                    _extInstalledTitle = GetStr(root, "extInstalledTitle", "JÃ¡ instalada no Doorpi");
                    _extInstalledSub = GetStr(root, "extInstalledSub", "Em uso no seu navegador");

                    string hl = System.Globalization.CultureInfo.CurrentUICulture.Name.Replace('_', '-');
                    string cwsUrl = $"https://chromewebstore.google.com/category/extensions?hl={hl}";

                    _ = Dispatcher.InvokeAsync(async () =>
                        await OpenWebViewInlineAsync(cwsUrl, false));
                }
                else if (action == "openWebAppBrowserCapture")
                {
                    _ = Dispatcher.InvokeAsync(async () =>
                    {
                        BeginGenericBrowserWebAppUrlCapture();
                        await OpenWebViewInlineAsync(DoorpiBrowserHomeUrl, false, "Browser", "", "", true);
                    });
                }
                else if (action == "openTrailerBrowserCapture")
                {
                    string searchUrl = GetStr(root, "url", "https://www.youtube.com/");
                    if (!Uri.TryCreate(searchUrl, UriKind.Absolute, out var parsedSearch) ||
                        (parsedSearch.Scheme != Uri.UriSchemeHttp && parsedSearch.Scheme != Uri.UriSchemeHttps))
                        searchUrl = "https://www.youtube.com/";
                    _ = Dispatcher.InvokeAsync(async () =>
                    {
                        BeginGenericBrowserUrlCapture("gameTrailer");
                        await OpenWebViewInlineAsync(searchUrl, false, "Buscar trailer", "", "", true);
                    });
                }
                else if (action == "openImageBrowserCapture")
                {
                    string target = GetStr(root, "target", "profilePhoto");
                    if (target != "profilePhoto" && target != "historyArtwork")
                        target = "profilePhoto";
                    _ = Dispatcher.InvokeAsync(async () =>
                    {
                        BeginGenericBrowserUrlCapture(target);
                        await OpenWebViewInlineAsync(DoorpiBrowserHomeUrl, false, "Browser", "", "", true);
                    });
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
                        SaveMediaApps(apps);
                        SendUsersDataToUI();
                        SendMediaAppsToUI(LoadMediaApps());
                    }
                }
                else if (action == "pickProfilePhoto")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Select profile photo");
                    string dialogFilter = GetStr(root, "dialogFilter", "Images (*.png;*.jpg;*.jpeg;*.webp;*.gif)|*.png;*.jpg;*.jpeg;*.webp;*.gif");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        string? selectedFile = await ShowDoorpiFileBrowserAsync(
                            dialogTitle, false, dialogFilter, "legacyProfilePhoto");

                        if (!string.IsNullOrWhiteSpace(selectedFile))
                        {
                            string b64 = Convert.ToBase64String(File.ReadAllBytes(selectedFile));
                            webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new { type = "profilePhotoSelected", base64 = b64 }));
                        }
                    }).Task.Unwrap();
                }
                else if (action == "openUrl" && root.TryGetProperty("url", out var urlEl))
                {
                    string url = urlEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(url))
                        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                }
                else if (action == "openStoreDownloadSite")
                {
                    string storeId = GetStr(root, "storeId");
                    string url = GetStr(root, "url");
                    string name = GetStr(root, "name");
                    if (HasBlockingSessionForStoreDownload())
                    {
                        PromptStoreDownloadBlockedBySessions(storeId, url, name);
                        return;
                    }
                    _ = Dispatcher.InvokeAsync(async () => await OpenStoreDownloadSiteAsync(storeId, url, name));
                }
                else if (action == "closeAllSessionsForStoreDownload")
                {
                    string storeId = GetStr(root, "storeId");
                    string url = GetStr(root, "url");
                    string name = GetStr(root, "name");
                    _ = Task.Run(async () => await CloseSessionsAndOpenStoreDownloadAsync(storeId, url, name));
                }
                else if (action == "openStore" && root.TryGetProperty("storeId", out var storeIdEl))
                {
                    string storeId = storeIdEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(storeId))
                        _ = Dispatcher.InvokeAsync(async () => await OpenStoreAsync(storeId));
                }
                else if (action == "requestStores")
                {
                    SendStoresToUI(LoadStoreLaunchers());
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
                else if (action == "setAdminStorePolicy"
                         && root.TryGetProperty("storeId", out var adminStoreIdEl))
                {
                    string storeId = adminStoreIdEl.GetString() ?? "";
                    bool? blocked = root.TryGetProperty("blockedForNonAdmins", out var blockedEl)
                        ? blockedEl.GetBoolean()
                        : null;
                    bool? forceSteam = root.TryGetProperty("steamForceAccountSelection", out var forceSteamEl)
                        ? forceSteamEl.GetBoolean()
                        : null;

                    if (!string.IsNullOrWhiteSpace(storeId) && IsCurrentUserAdmin())
                    {
                        var currentBlocked = GetAdminBlockedStoreIds();
                        SaveAdminStorePolicy(
                            storeId,
                            blocked ?? currentBlocked.Contains(NormalizeStorePolicyKey(storeId)),
                            forceSteam);
                        SendStoresToUI(LoadStoreLaunchers());
                        LoadGamesIntoUI();
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
                        var medias = LoadMediaAppsForUser(currentUserId);
                        bool isExecutableApp = string.Equals(appType, "exe", StringComparison.OrdinalIgnoreCase);
                        string resolvedRequestedMediaUrl = isExecutableApp
                            ? ResolveCurrentVersionedExecutablePath(mediaUrl)
                            : mediaUrl;
                        var media = medias.FirstOrDefault(m =>
                            string.Equals(m.Url, mediaUrl, StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(m.Id, mediaUrl, StringComparison.OrdinalIgnoreCase) ||
                            (isExecutableApp && string.Equals(m.Url, resolvedRequestedMediaUrl, StringComparison.OrdinalIgnoreCase)));

                        if (isExecutableApp)
                        {
                            string executableUrl = !string.IsNullOrWhiteSpace(media?.Url) ? media!.Url : resolvedRequestedMediaUrl;
                            string resolvedExecutable = ResolveCurrentVersionedExecutablePath(executableUrl);
                            bool hasConfiguredCommand = !string.IsNullOrWhiteSpace(media?.LaunchCommand);

                            if (!hasConfiguredCommand && Path.IsPathRooted(executableUrl) && !File.Exists(resolvedExecutable))
                            {
                                Debug.WriteLine($"[launchMediaApp/exe] ExecutÃ¡vel nÃ£o encontrado: {executableUrl}");
                                return;
                            }

                            if (!hasConfiguredCommand && File.Exists(resolvedExecutable))
                            {
                                mediaUrl = resolvedExecutable;
                                if (media != null && !string.Equals(media.Url, resolvedExecutable, StringComparison.OrdinalIgnoreCase))
                                    media.Url = resolvedExecutable;
                            }
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


                            _ = Dispatcher.InvokeAsync(() => SendMediaAppsToUI(LoadMediaApps()));
                        }


                        SuspendMainUiGamepadForGameLaunch();

                        if (appType == "webview" || appType == "browser")
                        {
                            if (_mediaExeModeActive) _mediaExeModeActive = false;

                            string mediaName = media?.Name ?? "App";
                            string heroImg = media?.HeroImage ?? "";
                            string gridImg = media?.GridImage ?? "";
                            string logoImg = !string.IsNullOrWhiteSpace(media?.LogoStaticImage)
                                ? media!.LogoStaticImage
                                : media?.LogoImage ?? "";

                            DiscordRpcManager.Instance.UpdateState("media", mediaUrl, mediaName);

                            SendGameLaunchStatus("gameLaunching", mediaName, heroImg, gridImg, "app");
                            Dispatcher.Invoke(() =>
                            {
                                EnsureCursorVisible();
                                _mainScreenMouseVisible = true;
                                CenterCursorOnScreen();
                            });
                            bool isGenericBrowser = string.Equals(media?.Id, DoorpiBrowserAppId, StringComparison.OrdinalIgnoreCase);
                            bool isDoorpiYouTubeTv = IsDoorpiYouTubeTvApp(media, mediaUrl);
                            _ = Dispatcher.InvokeAsync(async () => await OpenWebViewInlineAsync(mediaUrl, isDoorpiYouTubeTv, mediaName, heroImg, gridImg, isGenericBrowser, logoImg));
                        }
                        else if (appType == "exe")
                        {
                            Dispatcher.Invoke(() =>
                            {
                                try
                                {
                                    string configuredCommand = ResolveMediaLaunchCommand(media, mediaUrl);
                                    string executablePath = ResolveMediaExecutablePath(media, mediaUrl);
                                    ActivateExecutableAppSession(mediaUrl);
                                    var executableSession = EnsureExecutableAppSession(mediaUrl);

                                    string mediaName = media?.Name ?? "App";
                                    string heroImg = media?.HeroImage ?? "";
                                    string gridImg = media?.GridImage ?? "";

                                    // -- JÃ¡ estÃ¡ rodando? Restaura em vez de relanÃ§ar -------------
                                    Process? existingProc = null;

                                    if (executableSession.Process != null && !SafeHasExited(executableSession.Process))
                                    {
                                        existingProc = executableSession.Process;
                                    }
                                    else if (File.Exists(executablePath))
                                    {
                                        existingProc = FindRunningProcessForExe(executablePath);
                                    }
                                    if (existingProc != null)
                                    {
                                        IntPtr hwnd = IntPtr.Zero;
                                        if (TryFindMediaExeWindowCandidate(
                                                executableSession,
                                                mediaUrl,
                                                mediaName,
                                                allowNewWindowFallback: true,
                                                out var windowProcess,
                                                out var windowHandle) &&
                                            windowProcess != null)
                                        {
                                            existingProc = windowProcess;
                                            hwnd = windowHandle;
                                        }

                                        if (hwnd == IntPtr.Zero)
                                        {
                                            hwnd = FindVisibleWindowForProcess(existingProc.Id);
                                            if (hwnd == IntPtr.Zero)
                                                hwnd = FindAnyWindowForProcess(existingProc.Id);
                                        }

                                        if (hwnd != IntPtr.Zero)
                                        {
                                            executableSession.MouseModeActive = false;

                                            InitializeMediaExeMouseModeForSession(executableSession, media);
                                            executableSession.GamepadDisabled = !executableSession.MouseModeRequested;

                                            // -- MÃGICA: Zera o temporizador de seguranÃ§a para pular os 3 segundos de carregamento artificial --
                                            _launchAnimationStartedUtc = DateTime.MinValue;

                                            // Restaura e foca
                                            if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
                                            ShowWindow(hwnd, 3);
                                            FocusExternalWindow(hwnd);

                                            // SEMPRE cancela e recria o watcher, pois o antigo deu return ao minimizar!
                                            executableSession.WatcherCts?.Cancel();
                                            executableSession.WatcherCts = new CancellationTokenSource();
                                            executableSession.Process = existingProc;
                                            executableSession.Url = mediaUrl;
                                            executableSession.DoorpiSuspended = false;
                                            executableSession.WatcherPaused = false;
                                            InitializeMediaExeProcessGroup(mediaUrl, existingProc, executablePath: executablePath);
                                            StartMediaExeWatcher(existingProc, mediaUrl, mediaName, executableSession.WatcherCts.Token);
                                            int sessionId = NextExecutableAppSessionId(executableSession);
                                            EnsureMediaExeShortcutThread(sessionId);

                                            // Liga o modo controle novamente
                                            if (executableSession.MouseModeRequested)
                                                StartMediaExeMouseModeForSession(sessionId, centerCursor: true);

                                            SendRuntimeSessionsToUI();

                                            return;
                                        }
                                    }

                                    // -- LanÃ§a um processo novo ------------------------------------
                                    executableSession.MouseModeActive = false;
                                    executableSession.WatcherCts?.Cancel();

                                    Process? proc = null;
                                    HashSet<int>? baselineBeforeLaunch = SnapshotProcessIds();
                                    if (!string.IsNullOrWhiteSpace(configuredCommand))
                                        proc = LaunchCommand.Start(configuredCommand, ProcessWindowStyle.Maximized);

                                    if (proc != null || baselineBeforeLaunch != null)
                                    {
                                        executableSession.MouseModeRequested = ShouldStartMouseMode(media);
                                        executableSession.MouseModeInitialized = true;
                                        executableSession.GamepadDisabled = !executableSession.MouseModeRequested;

                                        if (proc != null && executableSession.MouseModeRequested)
                                        {
                                            EnterMediaExeMode(proc, mediaUrl, mediaName, heroImg, gridImg, baselineBeforeLaunch, executablePath);
                                        }
                                        else
                                        {
                                            SendGameLaunchStatus("gameLaunching", mediaName, heroImg, gridImg, "app");
                                            executableSession.WatcherCts = new CancellationTokenSource();
                                            executableSession.Process = proc;
                                            executableSession.Url = mediaUrl;
                                            InitializeMediaExeProcessGroup(mediaUrl, proc, baselineBeforeLaunch, executablePath);
                                            executableSession.WatcherPaused = false;
                                            executableSession.DoorpiSuspended = false;
                                            int sessionId = NextExecutableAppSessionId(executableSession);

                                            StartMediaExeWatcher(proc, mediaUrl, mediaName, executableSession.WatcherCts.Token);
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
                else if (action == "manualGameWindowRestore")
                {
                    await Dispatcher.InvokeAsync(BeginManualGameWindowRestore);
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

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        string? selectedFolder = await ShowDoorpiFileBrowserAsync(
                            dialogTitle, true, source: "setupFolder");
                        string selectedPath = "";

                        if (!string.IsNullOrWhiteSpace(selectedFolder))
                        {
                            string path = selectedFolder;
                            if (IsFolderForbidden(path))
                            {
                                System.Windows.MessageBox.Show(forbiddenMsg, forbiddenTitle,
                                    MessageBoxButton.OK, MessageBoxImage.Warning);
                            }
                            else
                            {
                                selectedPath = path;
                            }
                        }
                        webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new { type = "setupFolderDialogClosed", path = selectedPath }));
                    }).Task.Unwrap();
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
                if (IsDoorpiInternalApp(app))
                    continue;

                if (!string.IsNullOrWhiteSpace(app.Source) && IsStoreBlockedForCurrentUser(app.Source))
                    continue;

                bool isEmulatorGame = !string.IsNullOrWhiteSpace(app.EmulatorId) &&
                    !string.IsNullOrWhiteSpace(app.RomPath);
                var appEmulatorPaths = (app.EmulatorDiscPaths?.Count > 0
                        ? app.EmulatorDiscPaths
                        : new List<string> { app.RomPath })
                    .Select(NormalizeEmulatorRomPath)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                bool alreadyExists = isEmulatorGame
                    ? existingGames.Any(game =>
                        game.EmulatorId.Equals(app.EmulatorId, StringComparison.OrdinalIgnoreCase) &&
                        (game.EmulatorDiscPaths?.Count > 0 ? game.EmulatorDiscPaths : new List<string> { game.RomPath })
                            .Select(NormalizeEmulatorRomPath)
                            .Any(appEmulatorPaths.Contains))
                    : existingGames.Any(game => InstalledAppMatchesGame(app, game));
                if (alreadyExists) continue;

                EmulatorConfigModel? emulatorConfig = null;
                if (isEmulatorGame)
                {
                    emulatorConfig = LoadEmulatorConfigs().FirstOrDefault(item =>
                        item.Id.Equals(app.EmulatorId, StringComparison.OrdinalIgnoreCase));
                    if (emulatorConfig == null || (!File.Exists(app.RomPath) && !Directory.Exists(app.RomPath)))
                        continue;
                }

                string? steamAppId = null;
                if (!string.IsNullOrEmpty(app.LaunchUrl) && app.LaunchUrl.StartsWith("steam://run/", StringComparison.OrdinalIgnoreCase))
                    steamAppId = app.LaunchUrl.Replace("steam://run/", "").Trim();


                var (gridUrl, gridHorizontalUrl, heroUrl, logoUrl) = await FetchSteamGridAssetsAsync(app.Name, steamAppId).ConfigureAwait(false);

                string safeName = StableAssetName(!string.IsNullOrWhiteSpace(app.LaunchUrl) ? app.LaunchUrl : app.Path);

                // DOWNLOAD EM PARALELO DOS 4 ASSETS
                var tGrid = gridUrl != null ? DownloadImageAsync(gridUrl, gridFolder, safeName) : Task.FromResult<string?>(null);
                var tHoriz = gridHorizontalUrl != null ? DownloadImageAsync(gridHorizontalUrl, gridHorizontalFolder, safeName + "_h") : Task.FromResult<string?>(null);
                var tHero = heroUrl != null ? DownloadImageAsync(heroUrl, heroFolder, safeName) : Task.FromResult<string?>(null);
                var tLogo = logoUrl != null ? DownloadImageAsync(logoUrl, logoFolder, safeName + "_logo") : Task.FromResult<string?>(null);

                await Task.WhenAll(tGrid, tHoriz, tHero, tLogo).ConfigureAwait(false);

                NotifySteamGridArtworkFallback(app.Name, gridUrl != null, tGrid.Result != null);

                string iconBase64 = !string.IsNullOrWhiteSpace(app.IconBase64)
                    ? app.IconBase64
                    : (!string.IsNullOrWhiteSpace(app.Path) && File.Exists(app.Path) ? GetCachedIcon(app.Path) : "");

                var game = new GameModel
                {
                    Name = app.Name,
                    Path = app.Path,
                    LaunchUrl = app.LaunchUrl,
                    GridImage = tGrid.Result != null ? $"https://data.local/images/grid/{Path.GetFileName(tGrid.Result)}" : "",
                    GridHorizontalImage = tHoriz.Result != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(tHoriz.Result)}" : "",
                    GridSourceUrl = gridUrl ?? "",
                    GridHorizontalSourceUrl = gridHorizontalUrl ?? "",
                    HeroSourceUrl = heroUrl ?? "",
                    HeroImage = tHero.Result != null ? $"https://data.local/images/hero/{Path.GetFileName(tHero.Result)}" : "",
                    LogoImage = tLogo.Result != null ? $"https://data.local/images/logo/{Path.GetFileName(tLogo.Result)}" : "",
                    IconBase64 = iconBase64,
                    LastPlayed = DateTime.MinValue,
                    DateAdded = DateTime.Now,
                    Source = isEmulatorGame ? "emulator" : NormalizeStorePolicyKey(app.Source),
                    EmulatorId = isEmulatorGame ? app.EmulatorId : "",
                    RomPath = isEmulatorGame ? app.RomPath : "",
                    EmulatorDiscPaths = isEmulatorGame
                        ? (app.EmulatorDiscPaths?.Where(File.Exists).Distinct(StringComparer.OrdinalIgnoreCase).ToList()
                           ?? new List<string>())
                        : new List<string>(),
                    EmulatorDetectedName = isEmulatorGame
                        ? (string.IsNullOrWhiteSpace(app.EmulatorDetectedName) ? app.Name : app.EmulatorDetectedName)
                        : "",
                    LaunchCommand = isEmulatorGame ? app.LaunchCommand : ""
                };

                existingGames.Add(game);
                if (isEmulatorGame)
                {
                    foreach (string discPath in app.EmulatorDiscPaths?.Count > 0
                                 ? app.EmulatorDiscPaths
                                 : new List<string> { app.RomPath })
                        UnsuppressEmulatorGame(app.EmulatorId, discPath);
                }
                dbChanged = true;
            }

            if (dbChanged)
            {
                SaveGames(existingGames);
                _ = Dispatcher.BeginInvoke(() => LoadGamesIntoUI());
            }

            _ = Dispatcher.BeginInvoke(() =>
                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"clearLoadingCards\"}"));
        }
        // ========================= STEAMGRID =========================

        private string PrepareSearchName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return name;
            if (name.Trim().Contains(' ')) return name.Trim();

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

        private async Task<List<int>> ResolveSteamGridGameIdsAsync(string gameName)
        {
            try
            {
                string safe = Uri.EscapeDataString(PrepareSearchName(gameName));
                var json = await SgdbGetStringAsync($"https://www.steamgriddb.com/api/v2/search/autocomplete/{safe}");
                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.GetProperty("success").GetBoolean()) return new List<int>();

                var results = doc.RootElement.GetProperty("data");
                if (results.GetArrayLength() == 0) return new List<int>();
                return results.EnumerateArray()
                    .Take(1)
                    .Select(item => item.GetProperty("id").GetInt32())
                    .Distinct()
                    .ToList();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[SGDB] Resolve id falhou: " + ex.Message);
                return new List<int>();
            }
        }

        private async Task<List<SteamGridArtworkResult>> FetchSteamGridImageListAsync(string query, string category)
        {
            var ids = await ResolveSteamGridGameIdsAsync(query).ConfigureAwait(false);
            if (ids.Count == 0) return new List<SteamGridArtworkResult>();

            var artworks = new List<SteamGridArtworkResult>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (int gameId in ids)
            {
                foreach (string endpoint in SteamGridArtworkEndpoints(gameId, category))
                {
                    foreach (var artwork in await FetchSteamGridArtworkEndpointAsync(endpoint, category).ConfigureAwait(false))
                    {
                        if (!seen.Add(artwork.Url)) continue;
                        artworks.Add(artwork);
                        if (artworks.Count >= 36) return artworks;
                    }
                }
            }

            return artworks;
        }

        private static IEnumerable<string> SteamGridArtworkEndpoints(int gameId, string category)
        {
            if (category == "vertical")
            {
                yield return $"grids/game/{gameId}?dimensions=600x900,342x482,660x930&types=static,animated&sort=score&nsfw=false&humor=any";
                yield return $"grids/game/{gameId}?dimensions=600x900&types=static,animated&sort=score&nsfw=false&humor=any";
                yield return $"grids/game/{gameId}?types=static,animated&sort=score&nsfw=false&humor=any";
            }
            else if (category == "horizontal")
            {
                yield return $"grids/game/{gameId}?dimensions=460x215,920x430&types=static,animated&sort=score&nsfw=false&humor=any";
                yield return $"grids/game/{gameId}?dimensions=920x430&types=static,animated&sort=score&nsfw=false&humor=any";
                yield return $"grids/game/{gameId}?dimensions=460x215&types=static,animated&sort=score&nsfw=false&humor=any";
                yield return $"grids/game/{gameId}?types=static,animated&sort=score&nsfw=false&humor=any";
            }
            else if (category == "banner")
            {
                yield return $"heroes/game/{gameId}?types=static,animated&sort=score&nsfw=false&humor=any";
            }
            else if (category == "logo")
            {
                yield return $"logos/game/{gameId}?types=static,animated&sort=score&nsfw=false&humor=any";
            }
        }

        private async Task<List<SteamGridArtworkResult>> FetchSteamGridArtworkEndpointAsync(string endpoint, string category)
        {
            try
            {
                var json = await SgdbGetStringAsync($"https://www.steamgriddb.com/api/v2/{endpoint}");
                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.GetProperty("success").GetBoolean()) return new List<SteamGridArtworkResult>();

                var results = new List<SteamGridArtworkResult>();
                foreach (var item in doc.RootElement.GetProperty("data").EnumerateArray())
                {
                    // Defesa em profundidade: mesmo que uma resposta de cache ou da API
                    // ignore o filtro da URL, o Doorpi nunca entrega arte marcada como NSFW.
                    if (SteamGridArtworkIsNsfw(item)) continue;
                    if (!SteamGridArtworkMatchesCategory(item, category)) continue;
                    if (!item.TryGetProperty("url", out var urlEl)) continue;

                    string url = urlEl.GetString() ?? "";
                    if (string.IsNullOrWhiteSpace(url)) continue;
                    string thumb = item.TryGetProperty("thumb", out var thumbEl)
                        ? thumbEl.GetString() ?? ""
                        : "";
                    if (string.IsNullOrWhiteSpace(thumb)) thumb = url;

                    bool isAnimated = thumb.EndsWith(".webm", StringComparison.OrdinalIgnoreCase)
                        || url.EndsWith(".webm", StringComparison.OrdinalIgnoreCase);
                    if (item.TryGetProperty("type", out var typeEl))
                        isAnimated |= string.Equals(typeEl.GetString(), "animated", StringComparison.OrdinalIgnoreCase);

                    results.Add(new SteamGridArtworkResult
                    {
                        Url = url,
                        Thumb = thumb,
                        IsAnimated = isAnimated
                    });
                }

                return results;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[SGDB] Lista de imagens falhou: " + ex.Message);
                return new List<SteamGridArtworkResult>();
            }
        }

        private static bool SteamGridArtworkMatchesCategory(JsonElement item, string category)
        {
            if (category is "banner" or "logo") return true;
            if (!item.TryGetProperty("width", out var widthEl) ||
                !item.TryGetProperty("height", out var heightEl) ||
                !widthEl.TryGetInt32(out int width) ||
                !heightEl.TryGetInt32(out int height) ||
                width <= 0 || height <= 0)
            {
                return true;
            }

            double ratio = width / (double)height;
            return category == "horizontal"
                ? ratio >= 1.85 && ratio <= 2.35
                : ratio < 1.0;
        }

        private static bool SteamGridArtworkIsNsfw(JsonElement item)
            => item.TryGetProperty("nsfw", out var nsfwEl) &&
               nsfwEl.ValueKind == JsonValueKind.True;

        private async Task<(string?, string?, string?, string?)> TryFetchFromSteamCDN(string appId)
        {
            try
            {
                string grid = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/library_600x900.jpg";
                string horizontal = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/header.jpg";
                string hero = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/library_hero.jpg";
                string logo = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/logo.png";

                using var timeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(1200));
                var response = await httpClient.SendAsync(
                    new HttpRequestMessage(HttpMethod.Head, grid),
                    HttpCompletionOption.ResponseHeadersRead,
                    timeout.Token).ConfigureAwait(false);
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

        private async Task<(string?, string?, string?, string?)> TryFetchByName(
            string gameName,
            int preferredArtworkIndex = 0)
        {
            try
            {
                string safe = Uri.EscapeDataString(gameName);
                var json = await SgdbGetStringAsync($"https://www.steamgriddb.com/api/v2/search/autocomplete/{safe}");

                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.GetProperty("success").GetBoolean()) return (null, null, null, null);

                var results = doc.RootElement.GetProperty("data");
                if (results.GetArrayLength() == 0) return (null, null, null, null);

                int id = results[0].GetProperty("id").GetInt32();
                return await FetchAssetsByGameId(id, preferredArtworkIndex).ConfigureAwait(false);
            }
            catch { return (null, null, null, null); }
        }

        private async Task<(string?, string?, string?, string?)> FetchAssetsByGameId(
            int id,
            int preferredArtworkIndex = 0)
        {
            var gridTask = GetFirstImageUrl(
                $"grids/game/{id}?dimensions=600x900,342x482,660x930&types=static&sort=score&nsfw=false",
                preferredArtworkIndex);
            var horizontalTask = GetFirstImageUrl(
                $"grids/game/{id}?dimensions=460x215,920x430&types=static&sort=score&nsfw=false",
                preferredArtworkIndex);
            var heroTask = GetFirstImageUrl(
                $"heroes/game/{id}?types=static&sort=score&nsfw=false",
                preferredArtworkIndex);
            var logoTask = GetFirstImageUrl(
                $"logos/game/{id}?types=static&sort=score&nsfw=false",
                preferredArtworkIndex);

            await Task.WhenAll(gridTask, horizontalTask, heroTask, logoTask).ConfigureAwait(false);

            string? grid = gridTask.Result;

            if (string.IsNullOrEmpty(grid)) return (null, null, null, null);

            string? horizontal = horizontalTask.Result ?? heroTask.Result;
            string? hero = heroTask.Result;
            string? logo = logoTask.Result;

            return (grid, horizontal, hero, logo);
        }

        private async Task<string?> GetFirstImageUrl(string endpoint, int preferredArtworkIndex = 0)
        {
            try
            {
                string url = $"https://www.steamgriddb.com/api/v2/{endpoint}";
                var json = await SgdbGetStringAsync(url);


                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.GetProperty("success").GetBoolean()) return null;

                var data = doc.RootElement.GetProperty("data");
                var urls = new List<string>();
                foreach (var item in data.EnumerateArray())
                {
                    if (SteamGridArtworkIsNsfw(item)) continue;
                    if (item.TryGetProperty("url", out var urlEl) &&
                        !string.IsNullOrWhiteSpace(urlEl.GetString()))
                    {
                        urls.Add(urlEl.GetString()!);
                    }
                }
                if (urls.Count == 0) return null;
                return preferredArtworkIndex >= 0 && preferredArtworkIndex < urls.Count
                    ? urls[preferredArtworkIndex]
                    : urls[0];
            }
            catch (Exception ex) { Debug.WriteLine("Erro ao buscar imagem: " + ex.Message); return null; }
        }

        private async Task<string?> TryGetSteamGridImageUrlByIdAsync(int gridId)
        {
            foreach (string endpoint in new[] { $"grids/id/{gridId}", $"grids/{gridId}" })
            {
                try
                {
                    var json = await SgdbGetStringAsync($"https://www.steamgriddb.com/api/v2/{endpoint}").ConfigureAwait(false);
                    using var doc = JsonDocument.Parse(json);
                    if (!doc.RootElement.TryGetProperty("success", out var successEl) || !successEl.GetBoolean())
                        continue;
                    if (!doc.RootElement.TryGetProperty("data", out var dataEl))
                        continue;

                    if (dataEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in dataEl.EnumerateArray())
                            if (!SteamGridArtworkIsNsfw(item) && item.TryGetProperty("url", out var urlEl))
                                return urlEl.GetString();
                    }
                    else if (dataEl.ValueKind == JsonValueKind.Object &&
                             !SteamGridArtworkIsNsfw(dataEl) &&
                             dataEl.TryGetProperty("url", out var urlEl))
                    {
                        return urlEl.GetString();
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[SGDB] Grid por ID {gridId} falhou em {endpoint}: {ex.Message}");
                }
            }

            return null;
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

        private (string Folder, string UrlFolder, string Suffix) ArtworkTargetForCategory(string category)
            => category switch
            {
                "horizontal" => (gridHorizontalFolder, "grid-horizontal", "_h"),
                "banner" => (heroFolder, "hero", "_hero"),
                "logo" => (logoFolder, "logo", "_logo"),
                _ => (gridFolder, "grid", "_grid")
            };

        private static string ExtensionForImagePath(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            return ext is ".png" or ".jpg" or ".jpeg" or ".webp" or ".gif" ? ext : ".png";
        }

        private async Task<string?> CopyLocalArtworkAsync(string sourcePath, string folder, string name)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(sourcePath) || !File.Exists(sourcePath)) return null;
                Directory.CreateDirectory(folder);
                string fullPath = Path.Combine(folder, name + ExtensionForImagePath(sourcePath));
                await using var source = new FileStream(sourcePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                await using var target = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None);
                await source.CopyToAsync(target);
                return fullPath;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Artwork] Copia local falhou: " + ex.Message);
                return null;
            }
        }

        private static readonly HashSet<string> SupportedTrailerExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".mp4", ".webm", ".mov", ".m4v", ".ogv", ".ogg"
        };

        private void DeleteManagedTrailer(string source)
        {
            try
            {
                if (!Uri.TryCreate(source, UriKind.Absolute, out var uri) ||
                    !uri.Host.Equals("data.local", StringComparison.OrdinalIgnoreCase) ||
                    !uri.AbsolutePath.Contains("/trailers/", StringComparison.OrdinalIgnoreCase))
                    return;

                string root = Path.GetFullPath(dataFolder).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
                string relative = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'))
                    .Replace('/', Path.DirectorySeparatorChar);
                string fullPath = Path.GetFullPath(Path.Combine(dataFolder, relative));
                if (fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase) && File.Exists(fullPath))
                    File.Delete(fullPath);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Trailer] Não foi possível remover o arquivo anterior: " + ex.Message);
            }
        }

        private async Task<(bool Success, string Source, string Type)> SaveGameTrailerAsync(
            string gameId,
            string requestedSource,
            string requestedType,
            string previousSource)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(requestedSource))
                {
                    DeleteManagedTrailer(previousSource);
                    return (true, "", "");
                }

                if (requestedType.Equals("local", StringComparison.OrdinalIgnoreCase))
                {
                    string sourcePath = Path.GetFullPath(requestedSource);
                    string extension = Path.GetExtension(sourcePath).ToLowerInvariant();
                    if (!File.Exists(sourcePath) || !SupportedTrailerExtensions.Contains(extension))
                        return (false, "", "");

                    string trailerFolder = Path.Combine(dataFolder, "users", currentUserId, "trailers");
                    Directory.CreateDirectory(trailerFolder);
                    string hash = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(gameId)))[..16].ToLowerInvariant();
                    string destination = Path.Combine(trailerFolder, hash + extension);

                    if (string.Equals(sourcePath, destination, StringComparison.OrdinalIgnoreCase))
                    {
                        string existingSource = $"https://data.local/users/{Uri.EscapeDataString(currentUserId)}/trailers/{Uri.EscapeDataString(Path.GetFileName(destination))}";
                        return (true, existingSource, "local");
                    }

                    await using (var sourceStream = new FileStream(sourcePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                    await using (var destinationStream = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None))
                        await sourceStream.CopyToAsync(destinationStream).ConfigureAwait(false);

                    string savedSource = $"https://data.local/users/{Uri.EscapeDataString(currentUserId)}/trailers/{Uri.EscapeDataString(Path.GetFileName(destination))}";
                    if (!string.Equals(previousSource, savedSource, StringComparison.OrdinalIgnoreCase))
                        DeleteManagedTrailer(previousSource);
                    return (true, savedSource, "local");
                }

                if (!Uri.TryCreate(requestedSource, UriKind.Absolute, out var remoteUri) ||
                    (remoteUri.Scheme != Uri.UriSchemeHttp && remoteUri.Scheme != Uri.UriSchemeHttps))
                    return (false, "", "");

                bool isYoutube = remoteUri.Host.Contains("youtube.com", StringComparison.OrdinalIgnoreCase) ||
                                 remoteUri.Host.Equals("youtu.be", StringComparison.OrdinalIgnoreCase);
                DeleteManagedTrailer(previousSource);
                return (true, remoteUri.AbsoluteUri, isYoutube ? "youtube" : "url");
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Trailer] Falha ao salvar: " + ex.Message);
                return (false, "", "");
            }
        }

        private static void ApplyArtworkUrlToGame(GameModel game, string category, string url)
        {
            if (category == "horizontal")
            {
                game.GridHorizontalImage = url;
                game.GridHorizontalStaticImage = "";
                game.GridHorizontalSourceUrl = IsRemoteArtworkUrl(url) ? url : "";
            }
            else if (category == "banner")
            {
                game.HeroImage = url;
                game.HeroStaticImage = "";
                game.HeroSourceUrl = IsRemoteArtworkUrl(url) ? url : "";
            }
            else if (category == "logo") { game.LogoImage = url; game.LogoStaticImage = ""; }
            else
            {
                game.GridImage = url;
                game.GridStaticImage = "";
                game.GridSourceUrl = IsRemoteArtworkUrl(url) ? url : "";
            }
        }

        private static void ApplyArtworkUrlToMedia(MediaAppModel media, string category, string url)
        {
            if (category == "horizontal") { media.GridHorizontalImage = url; media.GridHorizontalStaticImage = ""; }
            else if (category == "banner") { media.HeroImage = url; media.HeroStaticImage = ""; }
            else if (category == "logo") { media.LogoImage = url; media.LogoStaticImage = ""; }
            else { media.GridImage = url; media.GridStaticImage = ""; }
        }

        private static void ApplyArtworkUrlToStore(MediaAppModel store, string category, string url)
        {
            if (category == "horizontal") { store.GridHorizontalImage = url; store.GridHorizontalStaticImage = ""; }
            else if (category == "banner") { store.HeroImage = url; store.HeroStaticImage = ""; }
            else if (category == "logo") { store.LogoImage = url; store.LogoStaticImage = ""; }
            else { store.GridImage = url; store.GridStaticImage = ""; }
        }

        private static string StaticTypeForArtworkCategory(string category)
            => category switch
            {
                "horizontal" => "HorizontalStatic",
                "banner" => "HeroStatic",
                "logo" => "LogoStatic",
                _ => "GridStatic"
            };

        private static IEnumerable<string> ArtworkUrlsForCategory(GameModel game, string category)
            => category switch
            {
                "horizontal" => new[] { game.GridHorizontalImage, game.GridHorizontalStaticImage },
                "banner" => new[] { game.HeroImage, game.HeroStaticImage },
                "logo" => new[] { game.LogoImage, game.LogoStaticImage },
                _ => new[] { game.GridImage, game.GridStaticImage }
            };

        private static IEnumerable<string> ArtworkUrlsForCategory(MediaAppModel app, string category)
            => category switch
            {
                "horizontal" => new[] { app.GridHorizontalImage, app.GridHorizontalStaticImage },
                "banner" => new[] { app.HeroImage, app.HeroStaticImage },
                "logo" => new[] { app.LogoImage, app.LogoStaticImage },
                _ => new[] { app.GridImage, app.GridStaticImage }
            };

        private static string ArtworkReplacementKey(string entityId, string imageType)
            => entityId + "\n" + imageType;

        private void QueuePendingArtworkReplacement(string entityId, string imageType, IEnumerable<string> oldUrls)
        {
            string key = ArtworkReplacementKey(entityId, imageType);
            lock (_artworkReplacementLock)
            {
                if (!_pendingArtworkCleanup.TryGetValue(key, out var pending))
                {
                    pending = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    _pendingArtworkCleanup[key] = pending;
                }

                foreach (string url in oldUrls.Where(url => !string.IsNullOrWhiteSpace(url)))
                    pending.Add(url);
            }
        }

        private List<string> GetPendingArtworkTypes(string entityId)
        {
            string prefix = entityId + "\n";
            lock (_artworkReplacementLock)
            {
                return _pendingArtworkCleanup.Keys
                    .Where(key => key.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    .Select(key => key[prefix.Length..])
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }
        }

        private void CompletePendingArtworkReplacement(string entityId, string imageType)
        {
            HashSet<string>? oldUrls = null;
            lock (_artworkReplacementLock)
            {
                string key = ArtworkReplacementKey(entityId, imageType);
                if (_pendingArtworkCleanup.TryGetValue(key, out oldUrls))
                    _pendingArtworkCleanup.Remove(key);
            }

            if (oldUrls != null)
                CleanupSupersededHomeArtwork(oldUrls);
        }

        private void CleanupSupersededHomeArtwork(IEnumerable<string> urls)
        {
            foreach (string url in urls
                .Where(url => !string.IsNullOrWhiteSpace(url))
                .Distinct(StringComparer.OrdinalIgnoreCase))
            {
                try
                {
                    if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
                        !uri.Host.Equals("data.local", StringComparison.OrdinalIgnoreCase))
                        continue;

                    // Qualquer referência JSON, inclusive as artes dedicadas do histórico
                    // de todos os perfis, torna o arquivo permanente e impede sua remoção.
                    bool referenced = Directory.EnumerateFiles(dataFolder, "*.json", SearchOption.AllDirectories)
                        .Any(file =>
                        {
                            try
                            {
                                return SafeReadAllText(file).Contains(url, StringComparison.OrdinalIgnoreCase);
                            }
                            catch
                            {
                                return true;
                            }
                        });
                    if (referenced) continue;

                    string relativePath = Uri.UnescapeDataString(uri.AbsolutePath).TrimStart('/');
                    string fullPath = Path.GetFullPath(Path.Combine(
                        dataFolder,
                        relativePath.Replace('/', Path.DirectorySeparatorChar)));
                    string dataRoot = Path.GetFullPath(dataFolder)
                        .TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
                    if (!fullPath.StartsWith(dataRoot, StringComparison.OrdinalIgnoreCase))
                        continue;

                    if (File.Exists(fullPath))
                    {
                        File.Delete(fullPath);
                        Debug.WriteLine($"[Artwork] Arte substituída removida: {fullPath}");
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[Artwork] Falha ao limpar arte substituída '{url}': {ex.Message}");
                }
            }
        }


        private async Task<Dictionary<string, string>> SaveSelectedStoreArtworkAsync(
            string storeId,
            JsonElement imagesEl,
            bool localFiles,
            Action<string, long, long?>? reportProgress = null)
        {
            var patch = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            string safeName = "store_edit_" + StableAssetName(storeId + DateTime.UtcNow.Ticks);

            var selected = imagesEl.EnumerateObject()
                .Where(p => !string.IsNullOrWhiteSpace(p.Value.GetString()))
                .Select(p => (Category: p.Name, Value: p.Value.GetString() ?? ""))
                .ToList();

            if (selected.Count == 0) return patch;

            var stores = LoadStoreLaunchers();
            var store = stores.FirstOrDefault(s =>
                string.Equals(s.Id, storeId, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(s.Url, storeId, StringComparison.OrdinalIgnoreCase));
            if (store == null) return patch;
            var immediateCleanup = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var item in selected)
            {
                var target = ArtworkTargetForCategory(item.Category);
                string? local = localFiles
                    ? await CopyLocalArtworkAsync(item.Value, target.Folder, safeName + target.Suffix).ConfigureAwait(false)
                    : await DownloadImageAsync(
                        item.Value,
                        target.Folder,
                        safeName + target.Suffix,
                        SelectedArtworkDownloadTimeoutMs,
                        (received, total) => reportProgress?.Invoke(
                            item.Category,
                            received,
                            total)).ConfigureAwait(false);
                if (local == null) continue;

                string url = $"https://data.local/images/{target.UrlFolder}/{Path.GetFileName(local)}";
                var oldUrls = ArtworkUrlsForCategory(store, item.Category).ToList();
                ApplyArtworkUrlToStore(store, item.Category, url);
                if (IsLocalFileAnimated(local))
                    QueuePendingArtworkReplacement(storeId, StaticTypeForArtworkCategory(item.Category), oldUrls);
                else
                    immediateCleanup.UnionWith(oldUrls);
                patch[item.Category] = url;
            }

            if (patch.Count > 0)
            {
                SaveStoreLaunchers(stores);
                CleanupSupersededHomeArtwork(immediateCleanup);
            }
            return patch;
        }

        private async Task<Dictionary<string, string>> SaveSelectedArtworkAsync(
            string entityId,
            string entityName,
            bool isMedia,
            JsonElement imagesEl,
            bool localFiles,
            Action<string, long, long?>? reportProgress = null)
        {
            var patch = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            string safeName = "edit_" + StableAssetName(entityId + DateTime.UtcNow.Ticks);

            var selected = imagesEl.EnumerateObject()
                .Where(p => !string.IsNullOrWhiteSpace(p.Value.GetString()))
                .Select(p => (Category: p.Name, Value: p.Value.GetString() ?? ""))
                .ToList();

            if (selected.Count == 0) return patch;

            if (!isMedia)
            {
                var games = LoadGames();
                var game = games.FirstOrDefault(g =>
                    string.Equals(g.Path, entityId, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(g.LaunchUrl, entityId, StringComparison.OrdinalIgnoreCase));
                string normalizedEntityName = NormalizeGameName(entityName);
                if (!string.IsNullOrWhiteSpace(normalizedEntityName) &&
                    (game == null || NormalizeGameName(game.Name) != normalizedEntityName))
                {
                    game = games.FirstOrDefault(g => NormalizeGameName(g.Name) == normalizedEntityName);
                }
                if (game == null) return patch;
                var immediateCleanup = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (var item in selected)
                {
                    var target = ArtworkTargetForCategory(item.Category);
                    string? local = localFiles
                        ? await CopyLocalArtworkAsync(item.Value, target.Folder, safeName + target.Suffix).ConfigureAwait(false)
                        : await DownloadImageAsync(
                            item.Value,
                            target.Folder,
                            safeName + target.Suffix,
                            SelectedArtworkDownloadTimeoutMs,
                            (received, total) => reportProgress?.Invoke(
                                item.Category,
                                received,
                                total)).ConfigureAwait(false);
                    if (local == null) continue;
                    string url = $"https://data.local/images/{target.UrlFolder}/{Path.GetFileName(local)}";
                    var oldUrls = ArtworkUrlsForCategory(game, item.Category).ToList();
                    ApplyArtworkUrlToGame(game, item.Category, url);
                    if (IsLocalFileAnimated(local))
                        QueuePendingArtworkReplacement(entityId, StaticTypeForArtworkCategory(item.Category), oldUrls);
                    else
                        immediateCleanup.UnionWith(oldUrls);
                    if (!localFiles && item.Category == "vertical") game.GridSourceUrl = item.Value;
                    if (!localFiles && item.Category == "horizontal") game.GridHorizontalSourceUrl = item.Value;
                    if (!localFiles && item.Category == "banner") game.HeroSourceUrl = item.Value;
                    patch[item.Category] = url;
                }

                if (patch.Count > 0)
                {
                    SaveGames(games);
                    CleanupSupersededHomeArtwork(immediateCleanup);
                }
            }
            else
            {
                var medias = LoadMediaAppsForUser(currentUserId);
                var media = medias.FirstOrDefault(m =>
                    string.Equals(m.Id, entityId, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(m.Url, entityId, StringComparison.OrdinalIgnoreCase));
                if (media == null || media.IsSharedFromOtherUser) return patch;
                var immediateCleanup = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (var item in selected)
                {
                    var target = ArtworkTargetForCategory(item.Category);
                    string? local = localFiles
                        ? await CopyLocalArtworkAsync(item.Value, target.Folder, safeName + target.Suffix).ConfigureAwait(false)
                        : await DownloadImageAsync(
                            item.Value,
                            target.Folder,
                            safeName + target.Suffix,
                            SelectedArtworkDownloadTimeoutMs,
                            (received, total) => reportProgress?.Invoke(
                                item.Category,
                                received,
                                total)).ConfigureAwait(false);
                    if (local == null) continue;
                    string url = $"https://data.local/images/{target.UrlFolder}/{Path.GetFileName(local)}";
                    var oldUrls = ArtworkUrlsForCategory(media, item.Category).ToList();
                    ApplyArtworkUrlToMedia(media, item.Category, url);
                    if (IsLocalFileAnimated(local))
                        QueuePendingArtworkReplacement(entityId, StaticTypeForArtworkCategory(item.Category), oldUrls);
                    else
                        immediateCleanup.UnionWith(oldUrls);
                    patch[item.Category] = url;
                }

                if (patch.Count > 0)
                {
                    SaveMediaApps(medias);
                    CleanupSupersededHomeArtwork(immediateCleanup);
                }
            }

            return patch;
        }

        private Task<Dictionary<string, string>> SaveSelectedHistoryArtworkAsync(string gameName, JsonElement imagesEl)
        {
            var patch = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            string profileId = currentUserId;

            var selected = imagesEl.EnumerateObject()
                .Where(property => property.Name is "vertical" or "horizontal" or "banner")
                .Select(property => (Category: property.Name, Value: property.Value.GetString() ?? ""))
                .Where(item => Uri.TryCreate(item.Value, UriKind.Absolute, out var uri) &&
                               (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
                .ToList();

            if (selected.Count == 0) return Task.FromResult(patch);

            lock (_gameHistoryFileLock)
            {
                string historyPath = Path.Combine(dataFolder, "users", profileId, "game-history.json");
                List<GameHistoryEntry> history;
                try
                {
                    history = File.Exists(historyPath)
                        ? JsonSerializer.Deserialize<List<GameHistoryEntry>>(SafeReadAllText(historyPath)) ?? new()
                        : new List<GameHistoryEntry>();
                }
                catch
                {
                    return Task.FromResult(patch);
                }

                string key = NormalizeGameName(gameName);
                var entry = history.FirstOrDefault(item => NormalizeGameName(item.Name) == key);
                if (entry == null) return Task.FromResult(patch);

                foreach (var item in selected)
                {
                    if (item.Category == "vertical")
                    {
                        entry.ShowcaseVerticalImageUrl = item.Value;
                        entry.ShowcaseVerticalLocalImage = "";
                    }
                    else if (item.Category == "horizontal")
                    {
                        entry.HistoryHorizontalImageUrl = item.Value;
                        entry.HistoryHorizontalLocalImage = "";
                    }
                    else
                    {
                        entry.ProfileBannerImageUrl = item.Value;
                        entry.ProfileBannerLocalImage = "";
                    }

                    patch[item.Category] = item.Value;
                    patch[item.Category + "SourceUrl"] = item.Value;
                }

                string json = JsonSerializer.Serialize(history, IndentedJsonOptions);
                SafeWriteAllText(historyPath, json);
                if (string.Equals(profileId, currentUserId, StringComparison.OrdinalIgnoreCase))
                    SafeWriteAllText(Path.Combine(dataFolder, "game-history.json"), json);
            }

            ScheduleProfileSync(profileId, notifyFailure: true, delayMs: 100);
            _ = CacheSelectedHistoryArtworkAsync(profileId, gameName, selected);
            return Task.FromResult(patch);
        }

        private bool DeleteGameHistoryEntry(string profileId, string gameName)
        {
            string key = NormalizeGameName(gameName);
            if (string.IsNullOrWhiteSpace(key)) return false;

            lock (_gameHistoryFileLock)
            {
                string historyPath = Path.Combine(dataFolder, "users", profileId, "game-history.json");
                List<GameHistoryEntry> history;
                try
                {
                    history = File.Exists(historyPath)
                        ? JsonSerializer.Deserialize<List<GameHistoryEntry>>(SafeReadAllText(historyPath)) ?? new()
                        : new List<GameHistoryEntry>();
                }
                catch
                {
                    return false;
                }

                int previousCount = history.Count;
                history.RemoveAll(entry =>
                    NormalizeGameName(entry.Name) == key);
                if (history.Count == previousCount) return false;

                string json = JsonSerializer.Serialize(history, IndentedJsonOptions);
                SafeWriteAllText(historyPath, json);
                if (string.Equals(profileId, currentUserId, StringComparison.OrdinalIgnoreCase))
                    SafeWriteAllText(Path.Combine(dataFolder, "game-history.json"), json);
            }

            ResetLibraryPlaytimeForDeletedHistory(
                profileId,
                new HashSet<string>(StringComparer.Ordinal) { key });
            ScheduleProfileSync(profileId, notifyFailure: true, delayMs: 100);
            return true;
        }

        private void ResetLibraryPlaytimeForDeletedHistory(
            string profileId,
            IReadOnlySet<string> removedHistoryKeys)
        {
            if (removedHistoryKeys.Count == 0) return;

            lock (_gamesFileLock)
            {
                string profileGamesPath = Path.Combine(dataFolder, "users", profileId, "games.json");
                if (!File.Exists(profileGamesPath)) return;

                List<GameModel> games;
                try
                {
                    games = JsonSerializer.Deserialize<List<GameModel>>(SafeReadAllText(profileGamesPath)) ?? new();
                }
                catch
                {
                    return;
                }

                bool changed = false;
                foreach (GameModel game in games)
                {
                    string gameKey = NormalizeGameName(game.Name);
                    if (!removedHistoryKeys.Contains(gameKey)) continue;
                    if (game.TotalPlaytimeMinutes == 0 &&
                        game.LastSessionMinutes == 0 &&
                        game.LastPlayed <= DateTime.MinValue) continue;

                    game.TotalPlaytimeMinutes = 0;
                    game.LastSessionMinutes = 0;
                    game.LastPlayed = DateTime.MinValue;
                    changed = true;
                }

                if (!changed) return;
                string json = JsonSerializer.Serialize(games, IndentedJsonOptions);
                SafeWriteAllText(profileGamesPath, json);
                if (string.Equals(profileId, currentUserId, StringComparison.OrdinalIgnoreCase))
                    SafeWriteAllText(Path.Combine(dataFolder, "games.json"), json);
            }
        }

        private async Task CacheSelectedHistoryArtworkAsync(
            string profileId,
            string gameName,
            IReadOnlyList<(string Category, string Value)> selected)
        {
            try
            {
                foreach (var item in selected)
                {
                    await DownloadProfileHistoryArtworkAsync(
                            profileId,
                            gameName,
                            item.Category,
                            item.Value,
                            "")
                        .ConfigureAwait(false);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[ProfileSync] Falha ao armazenar arte selecionada em cache: " + ex.Message);
            }
        }

        private async Task<string?> DownloadImageAsync(
            string url,
            string folder,
            string name,
            int timeoutMs = ArtworkDownloadTimeoutMs,
            Action<long, long?>? reportProgress = null)
        {
            string? temporaryPath = null;
            try
            {
                using var timeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs));
                using var response = await downloadClient.GetAsync(
                    url,
                    HttpCompletionOption.ResponseHeadersRead,
                    timeout.Token).ConfigureAwait(false);

                if (!response.IsSuccessStatusCode)
                {
                    Debug.WriteLine($"[Download] HTTP {(int)response.StatusCode} | {url}");
                    return null;
                }

                long? declaredLength = response.Content.Headers.ContentLength;
                if (declaredLength > MaxArtworkDownloadBytes)
                {
                    Debug.WriteLine($"[Download] Arte excede o limite de {MaxArtworkDownloadBytes} bytes | {url}");
                    return null;
                }
                reportProgress?.Invoke(0, declaredLength);

                string ext = Uri.TryCreate(url, UriKind.Absolute, out var uri)
                    ? Path.GetExtension(uri.AbsolutePath).ToLowerInvariant()
                    : Path.GetExtension(url).Split('?')[0].ToLowerInvariant();

                if (string.IsNullOrEmpty(ext))
                {
                    string contentType = response.Content.Headers.ContentType?.MediaType ?? "";
                    ext = contentType switch
                    {
                        "image/png" => ".png",
                        "image/jpeg" => ".jpg",
                        "image/webp" => ".webp",
                        "image/gif" => ".gif",
                        _ => ".png"
                    };
                }

                Directory.CreateDirectory(folder);
                string fileName = name + ext;
                string fullPath = Path.Combine(folder, fileName);
                temporaryPath = fullPath + ".download";

                await using (var source = await response.Content
                    .ReadAsStreamAsync(timeout.Token)
                    .ConfigureAwait(false))
                await using (var target = new FileStream(
                    temporaryPath,
                    FileMode.Create,
                    FileAccess.Write,
                    FileShare.None,
                    81920,
                    useAsync: true))
                {
                    var buffer = new byte[81920];
                    long total = 0;
                    var progressClock = Stopwatch.StartNew();
                    while (true)
                    {
                        int read = await source.ReadAsync(buffer.AsMemory(), timeout.Token).ConfigureAwait(false);
                        if (read == 0) break;

                        total += read;
                        if (total > MaxArtworkDownloadBytes)
                            throw new InvalidDataException(
                                $"Arte excede o limite de {MaxArtworkDownloadBytes} bytes.");

                        await target.WriteAsync(buffer.AsMemory(0, read), timeout.Token).ConfigureAwait(false);

                        if (progressClock.ElapsedMilliseconds >= 90 ||
                            (declaredLength.HasValue && total >= declaredLength.Value))
                        {
                            reportProgress?.Invoke(total, declaredLength);
                            progressClock.Restart();
                        }
                    }

                    reportProgress?.Invoke(total, declaredLength ?? total);
                }

                File.Move(temporaryPath, fullPath, overwrite: true);
                temporaryPath = null;
                return fullPath;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Download ERRO] {url} | {ex.Message}");
                return null;
            }
            finally
            {
                if (!string.IsNullOrWhiteSpace(temporaryPath))
                {
                    try
                    {
                        if (File.Exists(temporaryPath)) File.Delete(temporaryPath);
                    }
                    catch { }
                }
            }
        }

        // ========================= LAUNCH =========================

        private static bool IsGogLaunchUrl(string? launchUrl)
            => !string.IsNullOrWhiteSpace(launchUrl) &&
               launchUrl.StartsWith("goggalaxy://", StringComparison.OrdinalIgnoreCase);

        private static bool IsRiotLaunchUrl(string? launchUrl)
            => !string.IsNullOrWhiteSpace(launchUrl) &&
               (launchUrl.StartsWith("riot:", StringComparison.OrdinalIgnoreCase) ||
                launchUrl.StartsWith("riotclient://", StringComparison.OrdinalIgnoreCase));

        private static bool IsDirectRiotGameLaunch(GameModel? game)
            => IsRiotLaunchUrl(game?.LaunchUrl);

        private bool IsActiveDirectRiotGameSession()
            => string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase) &&
               IsRiotLaunchUrl(_activeSessionGameId);

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

        private void LaunchGame(string? identifier, string errorMsg, string? requestedDiscPath = null)
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
                    if (IsGameBlockedForCurrentUser(game))
                    {
                        SendAdminPolicyBlocked("game", game.Name, StorePolicyKeyForGame(game));
                        SendGameLaunchStatus("gameLaunchDone");
                        return;
                    }

                    string launchCommandForSession = game.LaunchCommand;
                    if (!string.IsNullOrWhiteSpace(game.EmulatorId) &&
                        !string.IsNullOrWhiteSpace(requestedDiscPath))
                    {
                        string normalizedRequestedDisc = NormalizeEmulatorRomPath(requestedDiscPath);
                        var allowedDiscs = (game.EmulatorDiscPaths?.Count > 0
                                ? game.EmulatorDiscPaths
                                : new List<string> { game.RomPath })
                            .Where(File.Exists)
                            .ToList();
                        string? selectedDisc = allowedDiscs.FirstOrDefault(path =>
                            NormalizeEmulatorRomPath(path).Equals(normalizedRequestedDisc, StringComparison.OrdinalIgnoreCase));
                        if (selectedDisc == null)
                        {
                            SendGameLaunchStatus("gameLaunchDone");
                            return;
                        }

                        var emulatorConfig = LoadEmulatorConfigs().FirstOrDefault(config =>
                            config.Id.Equals(game.EmulatorId, StringComparison.OrdinalIgnoreCase));
                        if (emulatorConfig == null)
                        {
                            SendGameLaunchStatus("gameLaunchDone");
                            return;
                        }
                        launchCommandForSession = ExpandEmulatorLaunchTemplate(emulatorConfig, selectedDisc, selectedDisc);
                    }

                    // -- Verifica estado atual da sessÃ£o ------------------------------------
                    bool gameAlive = IsLockedGameProcessAlive();
                    bool isSameGame = (_gameSessionActive || gameAlive)
                        && string.Equals(_activeSessionGameId, identifier, StringComparison.OrdinalIgnoreCase);
                    bool differentGameRunning = (_gameSessionActive || gameAlive)
                        && !string.IsNullOrEmpty(_activeSessionGameId)
                        && !isSameGame;

                    // Trava: nÃ£o permite lanÃ§ar um segundo jogo simultaneamente
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

                    // -- RestauraÃ§Ã£o: mesmo jogo ainda estÃ¡ vivo ----------------------------
                    if (isSameGame)
                    {
                        Debug.WriteLine($"\n[RESTORE] Restaurando: {game.Name}");

                        if (TryGetHungCurrentGameWindow(out _))
                        {
                            ShowHungGameRestorePrompt(game);
                            return;
                        }

                        _gameSessionActive = true;  // re-estabelece se foi perdida via ForceFocus
                        _gameIsMinimized = false;

                        _ = Task.Run(async () =>
                        {
                            // Aguarda todos os controles soltarem os botÃµes
                            await WaitForPrimaryControllerReleaseAsync();
                            await Task.Delay(50);

                            Dispatcher.Invoke(() =>
                            {
                                ReleaseAllStuckKeys();
                                EnsureCursorVisible();
                                _mainScreenMouseVisible = true;
                                CenterCursorOnScreen();

                                // Busca a janela: primeiro pelo handle salvo, depois pelo nome do processo
                                IntPtr hwndToRestore = ResolveCurrentGameWindow();
                                if (hwndToRestore != IntPtr.Zero && !IsWindowVisible(hwndToRestore) && !IsIconic(hwndToRestore))
                                    hwndToRestore = IntPtr.Zero; // handle invÃ¡lido, limpa

                                // 1. Tenta pelo processo travado (jogo real jÃ¡ identificado)
                                if (hwndToRestore == IntPtr.Zero && !string.IsNullOrEmpty(_lockedGameProcessName))
                                {
                                    foreach (var p in Process.GetProcessesByName(_lockedGameProcessName))
                                    {
                                        try
                                        {
                                            var h = FindAnyWindowForProcess(p.Id); // ? sem exigÃªncia de tÃ­tulo
                                            if (h == IntPtr.Zero) h = p.MainWindowHandle;
                                            if (h != IntPtr.Zero) { hwndToRestore = h; _currentGameHwnd = h; break; }
                                        }
                                        catch { }
                                    }
                                }

                                // 2. Fallback: processo do launcher original (estÃ¡gio antes do jogo abrir)
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

                                // 3. Fallback final: Ãºltima janela visÃ­vel antes de minimizar
                                if (hwndToRestore == IntPtr.Zero && IsLastVisibleWindowStillValid())
                                    hwndToRestore = _lastVisibleWindowBeforeMinimize;
                                // Os trÃªs cases do restore, dentro do Dispatcher.Invoke:

                                if (hwndToRestore != IntPtr.Zero && (IsWindowVisible(hwndToRestore) || IsIconic(hwndToRestore)))
                                {
                                    Debug.WriteLine($"[RESTORE] Janela encontrada: {hwndToRestore}");
                                    RestoreGameCleanly(hwndToRestore);
                                    DiscordRpcManager.Instance.UpdateState("game", game.Name);

                                    _gameIsMinimized = false;          // ? permite monitor continuar rastreando

                                    if (string.IsNullOrWhiteSpace(_lockedGameProcessName))
                                    {
                                        _gameIsRunningAndDoorpiHidden = false;
                                        SendGameLaunchStatus("gameLaunching", game.Name,
                                            game.HeroImage ?? "", game.GridImage ?? "", "restore");
                                    }
                                    else
                                    {
                                        _gameIsRunningAndDoorpiHidden = false;
                                        SendGameLaunchStatus("gameLaunchDone");
                                        VerifyGameFocusOrPromptAsync(hwndToRestore, game);
                                    }
                                }
                                else if (IsLastVisibleWindowStillValid())
                                {
                                    IntPtr fb = _lastVisibleWindowBeforeMinimize;
                                    RestoreGameCleanly(fb);
                                    _gameIsMinimized = false;          // ? idem
                                    if (string.IsNullOrWhiteSpace(_lockedGameProcessName))
                                    {
                                        _gameIsRunningAndDoorpiHidden = false;
                                        SendGameLaunchStatus("gameLaunching", game.Name,
                                            game.HeroImage ?? "", game.GridImage ?? "", "restore");
                                    }
                                    else
                                    {
                                        _gameIsRunningAndDoorpiHidden = false;
                                        SendGameLaunchStatus("gameLaunchDone");
                                        VerifyGameFocusOrPromptAsync(fb, game);
                                    }
                                }
                                else
                                {
                                    // Processo nÃ£o encontrado â€” pode ter crashado.
                                    // Reseta o flag para o monitor detectar a morte e chamar ForceFocus.
                                    _gameIsMinimized = false;          // ? monitor retoma e detecta crash em ~1.2 s
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

                    // 2. AVISA O WATCHDOG PARA NÃƒO INTERFERIR ANTES MESMO DO JOGO ABRIR
                    bool bindToActiveStoreContext = IsGameOwnedByActiveStore(game);

                    _gameSessionActive = true;
                    _activeSessionGameId = identifier;
                    _activeSessionGameName = game.Name;
                    _gameSessionParentKind = bindToActiveStoreContext ? "store" : "doorpi";
                    _forceDoorpiReturnOnGameClose = !bindToActiveStoreContext;
                    _storeChildGameActive = bindToActiveStoreContext;
                    _storeChildGameStoreId = bindToActiveStoreContext ? (_activeStoreId ?? "") : "";
                    _storeChildGameId = bindToActiveStoreContext ? identifier : "";
                    if (bindToActiveStoreContext)
                    {
                        _storePausedByDoorpi = false;
                        _storeMinimizeState = StoreMinimizeState.StorePendingChild;
                    }
                    SuspendMainUiGamepadForGameLaunch();

                    // Os dois baselines precisam ser capturados antes de Process.Start.
                    // Mini-launchers podem criar a janela real do jogo imediatamente;
                    // fotografar as janelas depois faria o monitor ignorar esse HWND.
                    var processSnapshot = SnapshotProcessIds();
                    var windowSnapshot = SnapshotVisibleWindows();
                    _launchCancelled = false;
                    _pendingLaunchProcess = null;
                    // 3. JOGA A TENTATIVA DE ABRIR O LAUNCHER PARA SEGUNDO PLANO
                    _ = Task.Run(() =>
                    {
                        try
                        {
                            Process? launched = null;
                            bool launchAttempted = false;

                            if (!string.IsNullOrWhiteSpace(launchCommandForSession))
                            {
                                launchAttempted = true;
                                launched = LaunchCommand.Start(launchCommandForSession);
                            }
                            else if (IsGogLaunchUrl(game.LaunchUrl))
                            {
                                launchAttempted = TryStartLocalGamePath(game, out launched);
                            }
                            else if (!string.IsNullOrWhiteSpace(game.LaunchUrl) &&
                                                         game.LaunchUrl.StartsWith("riot:", StringComparison.OrdinalIgnoreCase))
                            {
                                string cmd = game.LaunchUrl.Substring(5).Trim();
                                string exePath = "";
                                string args = "";

                                if (cmd.StartsWith('"'))
                                {
                                    int endQuote = cmd.IndexOf('"', 1);
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
                            // Substituir este bloco no mÃ©todo LaunchGame (linha ~2745 no seu cÃ³digo)
                            else if (!string.IsNullOrWhiteSpace(game.LaunchUrl))
                            {
                                bool isSteamRunLaunch = game.LaunchUrl.StartsWith("steam://run/", StringComparison.OrdinalIgnoreCase);
                                if (!isSteamRunLaunch || !IsSteamAccountSelectionForced())
                                    EnsureLauncherRunning(game.LaunchUrl);
                                launchAttempted = true;

                                // INTERCEPTA O JOGO DA STEAM PARA LANÃ‡AR DE FORMA DIRETA E SILENCIOSA
                                if (isSteamRunLaunch)
                                {
                                    string steamExe = GetSteamExePath();
                                    string appId = game.LaunchUrl.Replace("steam://run/", "").Trim();
                                    bool forceAccountSelection = IsSteamAccountSelectionForced();

                                    if (!string.IsNullOrEmpty(steamExe) && File.Exists(steamExe))
                                    {
                                        if (forceAccountSelection)
                                        {
                                            _steamAccountSelectionWindowGuardActive = true;
                                            StopSteamForAccountSelection(steamExe);
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
                                            // -applaunch abre o jogo direto. 
                                            // -silent garante que nenhuma janela extra da Steam (como de propaganda ou biblioteca) apareÃ§a.
                                            launched = Process.Start(new ProcessStartInfo
                                            {
                                                FileName = steamExe,
                                                Arguments = $"-applaunch {appId} -silent",
                                                UseShellExecute = true,
                                                WindowStyle = ProcessWindowStyle.Minimized
                                            });
                                        }
                                    }
                                    else
                                    {
                                        // Fallback caso nÃ£o ache o exe da steam
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
                                StartActiveSessionClock();
                                StartGameLaunchMonitor(game, launched, processSnapshot, windowSnapshot);
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

                GetWindowProcessId(_lastVisibleWindowBeforeMinimize, out uint pidRaw);
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

        // VersÃ£o sem exigÃªncia de tÃ­tulo (para jogos DirectX antigos)
        private IntPtr FindAnyWindowForProcess(int pid)
        {
            IntPtr withTitle = IntPtr.Zero;
            IntPtr withoutTitle = IntPtr.Zero;

            EnumWindows((hWnd, _) =>
            {
                GetWindowProcessId(hWnd, out uint wpid);
                if ((int)wpid != pid || !IsWindowVisible(hWnd)) return true;

                if (GetWindowTextLength(hWnd) > 0)
                {
                    withTitle = hWnd;
                    return false; // janela com tÃ­tulo tem prioridade
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

                        // DÃ¡ um tempinho um pouco maior pra Steam fazer o login silencioso antes do jogo tentar abrir
                        System.Threading.Thread.Sleep(processName == "steam" ? 4000 : 3000);
                    }
                }
            }
            catch (Exception ex) { Debug.WriteLine("Erro ao garantir launcher: " + ex.Message); }
        }

        private void StopSteamForAccountSelection(string steamExe)
        {
            try
            {
                foreach (var name in new[] { "steam", "steamwebhelper" })
                {
                    foreach (var process in Process.GetProcessesByName(name))
                    {
                        try { process.Kill(entireProcessTree: true); }
                        catch { }
                    }
                }

                var deadline = DateTime.UtcNow.AddSeconds(10);
                while (DateTime.UtcNow < deadline)
                {
                    bool alive = Process.GetProcessesByName("steam").Length > 0 ||
                                 Process.GetProcessesByName("steamwebhelper").Length > 0;
                    if (!alive) break;
                    System.Threading.Thread.Sleep(150);
                }

            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Steam] Falha ao encerrar para seleÃ§Ã£o de conta: " + ex.Message);
            }
        }

        // ========================= GAMES DB =========================


        private void InitializeGameHistoryForActiveUser()
        {
            bool historyExists = File.Exists(gameHistoryFile);
            if (!historyExists)
            {
                List<GameModel> legacyGames = new();
                try
                {
                    if (File.Exists(gamesFile))
                        legacyGames = JsonSerializer.Deserialize<List<GameModel>>(SafeReadAllText(gamesFile)) ?? new();
                }
                catch { }

                var migrated = legacyGames
                    .Where(HasGameBeenPlayed)
                    .GroupBy(g => NormalizeGameName(g.Name))
                    .Where(g => !string.IsNullOrWhiteSpace(g.Key))
                    .Select(group =>
                    {
                        var ordered = group.OrderByDescending(g => g.LastPlayed).ToList();
                        var newest = ordered[0];
                        var oldestPlayed = group
                            .Where(g => g.LastPlayed > DateTime.MinValue)
                            .Select(g => g.LastPlayed)
                            .DefaultIfEmpty(DateTime.MinValue)
                            .Min();
                        return new GameHistoryEntry
                        {
                            Name = newest.Name,
                            TotalPlaytimeMinutes = SaturatingSumPlaytimeMinutes(group.Select(g => g.TotalPlaytimeMinutes)),
                            LastSessionMinutes = newest.LastSessionMinutes,
                            FirstPlayed = oldestPlayed,
                            LastPlayed = group.Max(g => g.LastPlayed),
                            GridImage = FirstNotBlank(ordered.Select(g => g.GridImage)),
                            GridStaticImage = FirstNotBlank(ordered.Select(g => g.GridStaticImage)),
                            GridHorizontalImage = FirstNotBlank(ordered.Select(g => g.GridHorizontalImage)),
                            GridHorizontalStaticImage = FirstNotBlank(ordered.Select(g => g.GridHorizontalStaticImage)),
                            ShowcaseVerticalImageUrl = FirstNotBlank(ordered.Select(g => g.GridSourceUrl)),
                            ShowcaseVerticalLocalImage = FirstNotBlank(ordered.Select(g => g.GridStaticImage).Concat(ordered.Select(g => g.GridImage))),
                            HistoryHorizontalImageUrl = FirstNotBlank(ordered.Select(g => g.GridHorizontalSourceUrl)),
                            HistoryHorizontalLocalImage = FirstNotBlank(ordered.Select(g => g.GridHorizontalStaticImage).Concat(ordered.Select(g => g.GridHorizontalImage))),
                            ProfileBannerImageUrl = FirstNotBlank(ordered.Select(g => g.HeroSourceUrl)
                                .Concat(ordered.Select(g => IsRemoteArtworkUrl(g.HeroImage) ? g.HeroImage : ""))),
                            ProfileBannerLocalImage = FirstNotBlank(ordered.Select(g => g.HeroStaticImage).Concat(ordered.Select(g => g.HeroImage))),
                            IconBase64 = FirstNotBlank(ordered.Select(g => g.IconBase64)),
                            Source = FirstNotBlank(ordered.Select(g => g.Source))
                        };
                    })
                    .ToList();

                SaveGameHistory(migrated);
            }

            // Reaplica horas antigas quando um titulo foi removido e cadastrado novamente.
            try
            {
                if (File.Exists(gamesFile))
                {
                    var games = JsonSerializer.Deserialize<List<GameModel>>(SafeReadAllText(gamesFile)) ?? new();
                    SaveGames(games);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[GameHistory] Falha ao reconciliar biblioteca: " + ex.Message);
            }
        }

        private static bool HasGameBeenPlayed(GameModel game)
            => game.TotalPlaytimeMinutes >= 1;

        private static string FirstNotBlank(IEnumerable<string> values)
            => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "";

        private static bool IsRemoteArtworkUrl(string value)
            => Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
               (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps) &&
               !uri.Host.Equals("data.local", StringComparison.OrdinalIgnoreCase);

        private static bool EnsureDedicatedHistoryArtwork(GameHistoryEntry entry)
        {
            bool changed = false;
            if (string.IsNullOrWhiteSpace(entry.ShowcaseVerticalLocalImage))
            {
                entry.ShowcaseVerticalLocalImage = FirstNotBlank(new[] { entry.GridStaticImage, entry.GridImage });
                changed |= !string.IsNullOrWhiteSpace(entry.ShowcaseVerticalLocalImage);
            }
            if (string.IsNullOrWhiteSpace(entry.ShowcaseVerticalImageUrl))
            {
                string candidate = FirstNotBlank(new[] { entry.GridImage, entry.GridStaticImage });
                if (IsRemoteArtworkUrl(candidate))
                {
                    entry.ShowcaseVerticalImageUrl = candidate;
                    changed = true;
                }
            }
            if (string.IsNullOrWhiteSpace(entry.HistoryHorizontalLocalImage))
            {
                entry.HistoryHorizontalLocalImage = FirstNotBlank(new[] { entry.GridHorizontalStaticImage, entry.GridHorizontalImage });
                changed |= !string.IsNullOrWhiteSpace(entry.HistoryHorizontalLocalImage);
            }
            if (string.IsNullOrWhiteSpace(entry.HistoryHorizontalImageUrl))
            {
                string candidate = FirstNotBlank(new[] { entry.GridHorizontalImage, entry.GridHorizontalStaticImage });
                if (IsRemoteArtworkUrl(candidate))
                {
                    entry.HistoryHorizontalImageUrl = candidate;
                    changed = true;
                }
            }
            if (string.IsNullOrWhiteSpace(entry.ProfileBannerImageUrl) &&
                IsRemoteArtworkUrl(entry.ProfileBannerLocalImage))
            {
                entry.ProfileBannerImageUrl = entry.ProfileBannerLocalImage;
                changed = true;
            }
            return changed;
        }

        private List<GameHistoryEntry> LoadGameHistory()
        {
            lock (_gameHistoryFileLock)
            {
                if (!File.Exists(gameHistoryFile) && !File.Exists(gameHistoryFile + ".bak"))
                    return new List<GameHistoryEntry>();
                try
                {
                    bool recoveredFromBackup = false;
                    if (!TryDeserializeJsonFile(
                            gameHistoryFile,
                            options: null,
                            out List<GameHistoryEntry>? loaded))
                    {
                        recoveredFromBackup = TryDeserializeJsonFile(
                            gameHistoryFile + ".bak",
                            options: null,
                            out loaded);
                    }
                    loaded ??= new List<GameHistoryEntry>();
                    var history = loaded
                        .Where(entry => !string.IsNullOrWhiteSpace(entry.Name) && entry.TotalPlaytimeMinutes >= 1)
                        .ToList();
                    bool migrated = recoveredFromBackup || history.Count != loaded.Count;
                    foreach (var entry in history)
                        migrated |= EnsureDedicatedHistoryArtwork(entry);
                    if (migrated)
                    {
                        string json = JsonSerializer.Serialize(history, IndentedJsonOptions);
                        SafeWriteAllText(gameHistoryFile, json);
                        string currentMirror = Path.Combine(dataFolder, "game-history.json");
                        if (!string.Equals(gameHistoryFile, currentMirror, StringComparison.OrdinalIgnoreCase))
                            SafeWriteAllText(currentMirror, json);
                        if (recoveredFromBackup)
                            DoorpiBootDiagnostics.Log("game-history-recovered", $"path={gameHistoryFile}");
                    }
                    return history;
                }
                catch
                {
                    return new List<GameHistoryEntry>();
                }
            }
        }

        private void SaveGameHistory(List<GameHistoryEntry> history)
        {
            lock (_gameHistoryFileLock)
            {
                var ordered = history
                    .Where(entry => !string.IsNullOrWhiteSpace(entry.Name) && entry.TotalPlaytimeMinutes >= 1)
                    .OrderByDescending(entry => entry.LastPlayed)
                    .ThenBy(entry => entry.Name, StringComparer.CurrentCultureIgnoreCase)
                    .ToList();
                string json = JsonSerializer.Serialize(ordered, IndentedJsonOptions);
                SafeWriteAllText(gameHistoryFile, json);

                string currentMirror = Path.Combine(dataFolder, "game-history.json");
                if (!string.Equals(gameHistoryFile, currentMirror, StringComparison.OrdinalIgnoreCase))
                    SafeWriteAllText(currentMirror, json);
            }
            ScheduleProfileSync(currentUserId);
        }

        private void MergeGamesWithHistory(List<GameModel> games)
        {
            var history = LoadGameHistory();
            var byName = history
                .GroupBy(entry => NormalizeGameName(entry.Name))
                .Where(group => !string.IsNullOrWhiteSpace(group.Key))
                .ToDictionary(group => group.Key, group => group.OrderByDescending(entry => entry.LastPlayed).First());

            foreach (var gameGroup in games
                .Where(game => !string.IsNullOrWhiteSpace(game.Name))
                .GroupBy(game => NormalizeGameName(game.Name)))
            {
                if (string.IsNullOrWhiteSpace(gameGroup.Key)) continue;
                var group = gameGroup.ToList();
                bool played = group.Any(HasGameBeenPlayed);

                if (!byName.TryGetValue(gameGroup.Key, out var entry))
                {
                    if (!played) continue;
                    var newest = group.OrderByDescending(game => game.LastPlayed).First();
                    entry = new GameHistoryEntry
                    {
                        Name = newest.Name,
                        TotalPlaytimeMinutes = SaturatingSumPlaytimeMinutes(group.Select(game => game.TotalPlaytimeMinutes)),
                        LastSessionMinutes = newest.LastSessionMinutes,
                        FirstPlayed = newest.LastPlayed > DateTime.MinValue ? newest.LastPlayed : DateTime.Now,
                        LastPlayed = newest.LastPlayed,
                        ShowcaseVerticalImageUrl = FirstNotBlank(group.Select(game => game.GridSourceUrl)),
                        ShowcaseVerticalLocalImage = FirstNotBlank(group.Select(game => game.GridStaticImage).Concat(group.Select(game => game.GridImage))),
                        HistoryHorizontalImageUrl = FirstNotBlank(group.Select(game => game.GridHorizontalSourceUrl)),
                        HistoryHorizontalLocalImage = FirstNotBlank(group.Select(game => game.GridHorizontalStaticImage).Concat(group.Select(game => game.GridHorizontalImage))),
                        ProfileBannerImageUrl = FirstNotBlank(group.Select(game => game.HeroSourceUrl)
                            .Concat(group.Select(game => IsRemoteArtworkUrl(game.HeroImage) ? game.HeroImage : ""))),
                        ProfileBannerLocalImage = FirstNotBlank(group.Select(game => game.HeroStaticImage).Concat(group.Select(game => game.HeroImage)))
                    };
                    history.Add(entry);
                    byName[gameGroup.Key] = entry;
                }

                var latestGame = group.OrderByDescending(game => game.LastPlayed).First();
                long currentTotal = group.Max(game => Math.Max(0, game.TotalPlaytimeMinutes));
                if (currentTotal > entry.TotalPlaytimeMinutes)
                {
                    entry.TotalPlaytimeMinutes = currentTotal;
                    entry.LastSessionMinutes = latestGame.LastSessionMinutes;
                }
                if (latestGame.LastPlayed > entry.LastPlayed)
                {
                    entry.LastPlayed = latestGame.LastPlayed;
                    entry.LastSessionMinutes = latestGame.LastSessionMinutes;
                }
                if (entry.FirstPlayed == DateTime.MinValue && entry.LastPlayed > DateTime.MinValue)
                    entry.FirstPlayed = entry.LastPlayed;

                entry.Name = latestGame.Name;
                entry.GridImage = FirstNotBlank(new[] { entry.GridImage }.Concat(group.Select(game => game.GridImage)));
                entry.GridStaticImage = FirstNotBlank(new[] { entry.GridStaticImage }.Concat(group.Select(game => game.GridStaticImage)));
                entry.GridHorizontalImage = FirstNotBlank(new[] { entry.GridHorizontalImage }.Concat(group.Select(game => game.GridHorizontalImage)));
                entry.GridHorizontalStaticImage = FirstNotBlank(new[] { entry.GridHorizontalStaticImage }.Concat(group.Select(game => game.GridHorizontalStaticImage)));
                if (string.IsNullOrWhiteSpace(entry.ShowcaseVerticalImageUrl))
                    entry.ShowcaseVerticalImageUrl = FirstNotBlank(group.Select(game => game.GridSourceUrl));
                if (string.IsNullOrWhiteSpace(entry.ShowcaseVerticalLocalImage))
                    entry.ShowcaseVerticalLocalImage = FirstNotBlank(group.Select(game => game.GridStaticImage).Concat(group.Select(game => game.GridImage)));
                if (string.IsNullOrWhiteSpace(entry.HistoryHorizontalImageUrl))
                    entry.HistoryHorizontalImageUrl = FirstNotBlank(group.Select(game => game.GridHorizontalSourceUrl));
                if (string.IsNullOrWhiteSpace(entry.HistoryHorizontalLocalImage))
                    entry.HistoryHorizontalLocalImage = FirstNotBlank(group.Select(game => game.GridHorizontalStaticImage).Concat(group.Select(game => game.GridHorizontalImage)));
                if (string.IsNullOrWhiteSpace(entry.ProfileBannerImageUrl))
                    entry.ProfileBannerImageUrl = FirstNotBlank(group.Select(game => game.HeroSourceUrl)
                        .Concat(group.Select(game => IsRemoteArtworkUrl(game.HeroImage) ? game.HeroImage : "")));
                if (string.IsNullOrWhiteSpace(entry.ProfileBannerLocalImage))
                    entry.ProfileBannerLocalImage = FirstNotBlank(group.Select(game => game.HeroStaticImage).Concat(group.Select(game => game.HeroImage)));
                entry.IconBase64 = FirstNotBlank(group.Select(game => game.IconBase64).Append(entry.IconBase64));
                entry.Source = FirstNotBlank(group.Select(game => game.Source).Append(entry.Source));

                foreach (var game in group)
                {
                    game.TotalPlaytimeMinutes = entry.TotalPlaytimeMinutes;
                    game.LastSessionMinutes = entry.LastSessionMinutes;
                    if (entry.LastPlayed > game.LastPlayed) game.LastPlayed = entry.LastPlayed;
                }
            }

            SaveGameHistory(history);
        }

        private void RecordDeletedGameSession(string gameName, int sessionMinutes)
        {
            if (sessionMinutes < 1) return;
            var history = LoadGameHistory();
            string key = NormalizeGameName(gameName);
            var entry = history.FirstOrDefault(item => NormalizeGameName(item.Name) == key);
            if (entry == null)
            {
                entry = new GameHistoryEntry
                {
                    Name = gameName,
                    FirstPlayed = DateTime.Now
                };
                history.Add(entry);
            }

            entry.TotalPlaytimeMinutes = SaturatingAddPlaytimeMinutes(entry.TotalPlaytimeMinutes, sessionMinutes);
            entry.LastSessionMinutes = sessionMinutes;
            entry.LastPlayed = DateTime.Now;
            SaveGameHistory(history);
        }

        private static long SaturatingAddPlaytimeMinutes(long current, long increment)
        {
            current = Math.Max(0, current);
            increment = Math.Max(0, increment);
            return current > long.MaxValue - increment ? long.MaxValue : current + increment;
        }

        private static long SaturatingSumPlaytimeMinutes(IEnumerable<long> values)
        {
            long total = 0;
            foreach (long value in values)
                total = SaturatingAddPlaytimeMinutes(total, value);
            return total;
        }


        private void SaveGames(List<GameModel> games)
        {
            lock (_gamesFileLock)
            {
                MergeGamesWithHistory(games);
                string json = JsonSerializer.Serialize(games, IndentedJsonOptions);
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
                if (!File.Exists(fileToRead) &&
                    !File.Exists(fileToRead + ".bak") &&
                    !File.Exists(fallbackFile) &&
                    !File.Exists(fallbackFile + ".bak"))
                {
                    return new List<GameModel>();
                }

                bool recoveredFromBackup = false;
                if (!TryDeserializeJsonFile(fileToRead, options: null, out List<GameModel>? games))
                {
                    recoveredFromBackup = TryDeserializeJsonFile(
                        fileToRead + ".bak",
                        options: null,
                        out games);
                }
                if (games == null)
                {
                    string mirror = Path.Combine(dataFolder, "games.json");
                    if (!string.Equals(fileToRead, mirror, StringComparison.OrdinalIgnoreCase))
                    {
                        recoveredFromBackup = TryDeserializeJsonFile(mirror, options: null, out games) ||
                                              TryDeserializeJsonFile(mirror + ".bak", options: null, out games);
                    }
                }
                games ??= new List<GameModel>();
                if (games.Count > 0 &&
                    (recoveredFromBackup ||
                     !string.Equals(fileToRead, gamesFile, StringComparison.OrdinalIgnoreCase)))
                {
                    try { SaveGames(games); } catch { }
                }
                if (recoveredFromBackup)
                    DoorpiBootDiagnostics.Log("games-recovered", $"path={fileToRead}");
                return games;
            }
        }

        // 1. NOVA FUNÃ‡ÃƒO AUXILIAR: Detecta se o jogo Ã© realmente novo ou se Ã© um falso-positivo de migraÃ§Ã£o
        private bool IsGameActuallyNew(DateTime dateAdded, DateTime lastPlayed)
        {
            // Se a data for nula/mÃ­nima (arquivos de save antigos sem data), nÃ£o Ã© novo
            if (dateAdded <= DateTime.MinValue.AddDays(1)) return false;

            // Se jÃ¡ passou de 48 horas reais, definitivamente nÃ£o Ã© novo
            if ((DateTime.Now - dateAdded).TotalHours >= 48) return false;

            // A MÃGICA AQUI: Se o jogo foi jogado ANTES de ser "adicionado",
            // significa que Ã© um jogo legado que o sistema tentou colocar a data de hoje. Tira o badge!
            if (lastPlayed > DateTime.MinValue && lastPlayed < dateAdded.AddMinutes(-5)) return false;

            return true;
        }

        private static string FormatEmulatorDisplayName(string emulatorId)
        {
            string id = (emulatorId ?? "").Trim();
            if (string.IsNullOrWhiteSpace(id)) return "";

            var catalog = EmulatorCatalog.FirstOrDefault(item =>
                item.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
            if (catalog != null && !string.IsNullOrWhiteSpace(catalog.Name))
                return catalog.Name;

            return string.Join(" ", Regex.Split(id, @"[-_\s]+")
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Select(part => part.Length <= 4
                    ? part.ToUpperInvariant()
                    : char.ToUpperInvariant(part[0]) + part[1..]));
        }

        private Dictionary<string, string> LoadEmulatorDisplayNames()
            => LoadEmulatorConfigs()
                .Where(config => !string.IsNullOrWhiteSpace(config.Id))
                .GroupBy(config => config.Id, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    group => group.Key,
                    group =>
                    {
                        string configuredName = group
                            .Select(config => config.Name)
                            .FirstOrDefault(name => !string.IsNullOrWhiteSpace(name)) ?? "";
                        return !string.IsNullOrWhiteSpace(configuredName)
                            ? configuredName
                            : FormatEmulatorDisplayName(group.Key);
                    },
                    StringComparer.OrdinalIgnoreCase);

        private object MapGameToAnonObject(
            GameModel game,
            bool isFeatured,
            IReadOnlyDictionary<string, string>? emulatorNames = null)
        {
            string localGridPath = string.IsNullOrEmpty(game.GridImage) ? "" :
                Path.Combine(dataFolder,
                    new Uri(game.GridImage).AbsolutePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            string iconBase64 = ResolveGameIconBase64(game);

            return new
            {
                id = !string.IsNullOrEmpty(game.LaunchUrl) ? game.LaunchUrl : game.Path,
                name = game.Name,
                path = game.Path,
                launchUrl = game.LaunchUrl,
                launchCommand = game.LaunchCommand,
                emulatorId = game.EmulatorId,
                emulatorName = !string.IsNullOrWhiteSpace(game.EmulatorId) &&
                               emulatorNames != null &&
                               emulatorNames.TryGetValue(game.EmulatorId, out string? configuredEmulatorName)
                    ? configuredEmulatorName
                    : FormatEmulatorDisplayName(game.EmulatorId),
                emulatorDiscPaths = game.EmulatorDiscPaths,
                type = "game",
                imageData = game.GridImage,
                staticImageData = game.GridStaticImage,
                horizontalImage = game.GridHorizontalImage,
                staticHorizontalImage = game.GridHorizontalStaticImage,
                hero = game.HeroImage,
                staticHero = game.HeroStaticImage,
                logo = game.LogoImage,
                staticLogo = game.LogoStaticImage,
                trailerSource = game.TrailerSource,
                trailerType = game.TrailerType,
                iconBase64,
                totalPlaytimeMinutes = game.TotalPlaytimeMinutes,
                lastSessionMinutes = game.LastSessionMinutes,
                lastPlayed = game.LastPlayed,
                hasBeenPlayed = HasGameBeenPlayed(game),
                source = StorePolicyKeyForGame(game),
                isAdminLocked = IsGameBlockedForCurrentUser(game),
                adminLockReason = "blocked-store",
                isFeatured = isFeatured,
                isNew = false, // <--- CORREÃ‡ÃƒO APLICADA
                isAnimated = IsLocalFileAnimated(localGridPath),
            };
        }

        private void LoadGamesIntoUI()
        {
            if (!_interactiveUserSessionStarted) return;
            var allGames = LoadGames();
            var emulatorNames = LoadEmulatorDisplayNames();

            var featured = allGames
                .Where(g => g.LastPlayed > DateTime.MinValue)
                .OrderByDescending(g => g.LastPlayed)
                .FirstOrDefault()
                ?? allGames.OrderByDescending(g => g.DateAdded).FirstOrDefault();

            var sortedGames = new List<object>();

            if (featured != null)
            {
                // Adiciona o Featured primeiro (posiÃ§Ã£o 0)
                sortedGames.Add(MapGameToAnonObject(featured, true, emulatorNames));


                var others = allGames.Where(g => g != featured)
                    .OrderByDescending(g => g.LastPlayed > g.DateAdded ? g.LastPlayed : g.DateAdded)
                    .Take(11);

                foreach (var game in others)
                {
                    sortedGames.Add(MapGameToAnonObject(game, false, emulatorNames));
                }
            }

            var payload = new { type = "renderGames", games = sortedGames };

            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(payload))
            );
        }
        private void SendGameUpdateToUI(GameModel game)
        {
            string gameId = !string.IsNullOrWhiteSpace(game.LaunchUrl) ? game.LaunchUrl : game.Path;
            if (string.IsNullOrWhiteSpace(gameId)) return;

            var payload = new
            {
                type = "gameUpdated",
                gameId,
                game = MapGameToAnonObject(game, isFeatured: false, LoadEmulatorDisplayNames())
            };
            void PostUpdate() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(payload));

            if (Dispatcher.CheckAccess()) PostUpdate();
            else Dispatcher.Invoke(PostUpdate);
        }

        private void SendMediaAppUpdateToUI(MediaAppModel app, string? existingId = null)
        {
            string appId = !string.IsNullOrWhiteSpace(existingId)
                ? existingId
                : (!string.IsNullOrWhiteSpace(app.Id) ? app.Id : app.Url);
            if (string.IsNullOrWhiteSpace(appId)) return;

            if (string.IsNullOrWhiteSpace(app.IconBase64))
                app.IconBase64 = ResolveMediaIconBase64(app);

            void PostUpdate() => webView.CoreWebView2.PostWebMessageAsString(
                JsonSerializer.Serialize(new
                {
                    type = "mediaUpdated",
                    appId,
                    app
                }));

            if (Dispatcher.CheckAccess()) PostUpdate();
            else Dispatcher.Invoke(PostUpdate);
        }

        private string ResolveMediaIconBase64(MediaAppModel app)
        {
            if (!string.IsNullOrWhiteSpace(app.IconBase64)) return app.IconBase64;

            if (string.Equals(app.Type, "exe", StringComparison.OrdinalIgnoreCase))
            {
                foreach (string candidate in new[]
                         {
                             ResolveMediaExecutablePath(app, app.Url),
                             LaunchCommand.ExecutablePathOrName(app.LaunchCommand)
                         })
                {
                    string resolved = ResolveCurrentVersionedExecutablePath(candidate);
                    if (!File.Exists(resolved)) continue;
                    string icon = GetCachedIcon(resolved);
                    if (!string.IsNullOrWhiteSpace(icon)) return icon;
                }
            }

            try
            {
                string mediaKey = NormalizeAutoAddKey(app.Url);
                if (string.IsNullOrWhiteSpace(mediaKey)) return "";

                AppCacheModel? cache = LoadAppCache();
                if (cache == null) return "";
                InstalledApp? match = cache.WindowsApps
                    .Concat(cache.FolderApps)
                    .Concat(cache.SteamApps)
                    .Concat(cache.EpicApps)
                    .Concat(cache.GogApps)
                    .Concat(cache.RiotApps)
                    .Concat(cache.XboxApps)
                    .FirstOrDefault(candidate =>
                        !string.IsNullOrWhiteSpace(candidate.IconBase64) &&
                        AutoAddKeysForApp(candidate).Contains(mediaKey, StringComparer.OrdinalIgnoreCase));
                return match?.IconBase64 ?? "";
            }
            catch
            {
                return "";
            }
        }

        private string ResolveGameIconBase64(GameModel game)
        {
            if (!string.IsNullOrWhiteSpace(game.IconBase64)) return game.IconBase64;

            foreach (string candidate in new[]
                     {
                         game.Path,
                         LaunchCommand.ExecutablePathOrName(game.LaunchCommand)
                     })
            {
                string resolved = ResolveCurrentVersionedExecutablePath(candidate);
                if (!File.Exists(resolved)) continue;
                string icon = GetCachedIcon(resolved);
                if (!string.IsNullOrWhiteSpace(icon)) return icon;
            }

            try
            {
                AppCacheModel? cache = LoadAppCache();
                if (cache == null) return "";
                InstalledApp? match = cache.WindowsApps
                    .Concat(cache.FolderApps)
                    .Concat(cache.SteamApps)
                    .Concat(cache.EpicApps)
                    .Concat(cache.GogApps)
                    .Concat(cache.RiotApps)
                    .Concat(cache.XboxApps)
                    .FirstOrDefault(app =>
                        !string.IsNullOrWhiteSpace(app.IconBase64) && InstalledAppMatchesGame(app, game));
                return match?.IconBase64 ?? "";
            }
            catch
            {
                return "";
            }
        }
        private void SendGameToUI(GameModel game, bool isFeatured = false)
        {
            string localGridPath = string.IsNullOrEmpty(game.GridImage) ? "" :
                Path.Combine(dataFolder,
                    new Uri(game.GridImage).AbsolutePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            string iconBase64 = ResolveGameIconBase64(game);
            var emulatorNames = LoadEmulatorDisplayNames();

            var data = new
            {
                type = "newGame",
                name = game.Name,
                path = game.Path,
                launchUrl = game.LaunchUrl,
                launchCommand = game.LaunchCommand,
                emulatorId = game.EmulatorId,
                emulatorName = !string.IsNullOrWhiteSpace(game.EmulatorId) &&
                               emulatorNames.TryGetValue(game.EmulatorId, out string? configuredEmulatorName)
                    ? configuredEmulatorName
                    : FormatEmulatorDisplayName(game.EmulatorId),
                emulatorDiscPaths = game.EmulatorDiscPaths,
                imageData = game.GridImage,
                staticImageData = game.GridStaticImage,
                horizontalImage = game.GridHorizontalImage,
                staticHorizontalImage = game.GridHorizontalStaticImage,
                hero = game.HeroImage,
                staticHero = game.HeroStaticImage,
                logo = game.LogoImage,
                staticLogo = game.LogoStaticImage,
                trailerSource = game.TrailerSource,
                trailerType = game.TrailerType,
                iconBase64,
                totalPlaytimeMinutes = game.TotalPlaytimeMinutes,
                lastSessionMinutes = game.LastSessionMinutes,
                lastPlayed = game.LastPlayed,
                hasBeenPlayed = HasGameBeenPlayed(game),
                source = StorePolicyKeyForGame(game),
                isAdminLocked = IsGameBlockedForCurrentUser(game),
                adminLockReason = "blocked-store",
                isFeatured = isFeatured,
                isNew = false, // <--- CORREÃ‡ÃƒO APLICADA
                isAnimated = IsLocalFileAnimated(localGridPath)
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

                if (!string.IsNullOrEmpty(exePath) && !exePath.Contains('\\'))
                {
                    var installPath = key?.GetValue("SteamPath") as string;
                    if (!string.IsNullOrEmpty(installPath))
                        exePath = Path.Combine(installPath, "steam.exe");
                }

                // A Steam costuma gravar no registro usando barras invertidas padrÃ£o web (/)
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
            if (!string.IsNullOrWhiteSpace(location))
            {
                string resolvedLocation = ResolveCurrentVersionedAppDirectory(location);
                if (Directory.Exists(resolvedLocation)) return resolvedLocation;
            }

            var icon = key.GetValue("DisplayIcon") as string;
            if (!string.IsNullOrWhiteSpace(icon))
            {
                string path = Environment.ExpandEnvironmentVariables(icon.Split(',')[0].Replace("\"", "").Trim());
                string folder = Directory.Exists(path) ? path : Path.GetDirectoryName(path) ?? "";
                string resolvedFolder = ResolveCurrentVersionedAppDirectory(folder);
                if (Directory.Exists(resolvedFolder)) return resolvedFolder;
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
        private volatile bool _mainUiOwnsDirectionalNavigation = true;
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
                    GetWindowProcessId(foreground, out var pidRaw);
                    if (pidRaw == Environment.ProcessId)
                        return true;
                }
            }
            catch { }

            return false;
        }

        private void SuspendMainUiGamepadForGameLaunch(int milliseconds = 15000)
        {
            _mainUiOwnsDirectionalNavigation = false;
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
            ArmMainUiGamepadStartupGrace(RequiresConsoleShellStartupGate() ? 12000 : 3000);
            _mainUiGamepadActive = true;
            _mainUiGamepadThread = new Thread(MainUiGamepadLoop) { IsBackground = true };
            _mainUiGamepadThread.Start();
        }



        private long _returnFromExternalModeSuppressUntil = 0;

        private long _mainUiGamepadStartupGraceUntilUtcTicks = 0;

        private readonly struct MainUiGamepadSnapshot
        {
            public MainUiGamepadSnapshot(
                double axisX,
                double axisY,
                ushort buttons)
            {
                AxisX = axisX;
                AxisY = axisY;
                Buttons = buttons;
            }

            public double AxisX { get; }
            public double AxisY { get; }
            public ushort Buttons { get; }
        }

        private bool TryReadMainUiGamepadSnapshot(out MainUiGamepadSnapshot snapshot)
        {
            var input = GetUnifiedControllerInput();
            if (!input.Connected)
            {
                snapshot = default;
                return false;
            }

            snapshot = new MainUiGamepadSnapshot(
                input.ThumbLX,
                input.ThumbLY,
                input.Buttons);
            return true;
        }

        private void ArmMainUiGamepadStartupGrace(int milliseconds)
        {
            Interlocked.Exchange(
                ref _mainUiGamepadStartupGraceUntilUtcTicks,
                DateTime.UtcNow.AddMilliseconds(milliseconds).Ticks);
        }

        private bool IsMainUiGamepadStartupSensitivePhase()
        {
            if (!RequiresConsoleShellStartupGate())
                return false;

            if (!_interactiveUserSessionStarted)
                return true;

            if (Volatile.Read(ref _homeNavigationCompleted) == 0)
                return true;

            if (Volatile.Read(ref _userSwitchInProgress) == 1)
                return true;

            if (_useNativeBootIntro && Volatile.Read(ref _nativeBootIntroHandoffComplete) == 0)
                return true;

            return DateTime.UtcNow.Ticks < Interlocked.Read(ref _mainUiGamepadStartupGraceUntilUtcTicks);
        }

        private void PostMainUiControllerSnapshot(XInputSnapshot snapshot, ushort pressedButtons)
        {
            const ushort actionMask = 0xFFF0; // All buttons/triggers, excluding D-pad.
            string payload = JsonSerializer.Serialize(new
            {
                type = "nativeControllerSnapshot",
                connected = snapshot.Connected,
                buttons = snapshot.Buttons & actionMask,
                pressed = pressedButtons & actionMask,
                dpad = snapshot.Buttons & 0x000F,
                controlCaptureSuppressed = IsControlCaptureActive(),
                leftX = snapshot.ThumbLX,
                leftY = snapshot.ThumbLY,
                rightX = snapshot.ThumbRX,
                rightY = snapshot.ThumbRY
            });

            Dispatcher.BeginInvoke(() =>
            {
                try { webView?.CoreWebView2?.PostWebMessageAsString(payload); }
                catch { }
            });
        }

        private void MainUiGamepadLoop()
        {
            const int INITIAL_DELAY_MS = 400;
            const int REPEAT_DELAY_MS = 80;
            const double AXIS_THRESHOLD = 0.6;

            int moveState = 0;
            string? currentDir = null;
            DateTime lastMoveTime = DateTime.MinValue;
            bool hadPreviousInput = false;
            var buttonTracker = new XInputButtonTracker();
            var initialSnapshot = XInputControllerHub.Read();
            buttonTracker.Update(initialSnapshot);
            ushort lastPostedButtons = ushort.MaxValue;
            bool lastPostedConnected = !initialSnapshot.Connected;
            long lastControllerPostAt = long.MinValue;
            double lastPostedRightX = 0;
            double lastPostedRightY = 0;
            double lastPostedLeftX = 0;
            double lastPostedLeftY = 0;
            ushort lastPostedDpad = ushort.MaxValue;
            bool controlEditorOwnedInputLastFrame = false;

            while (_mainUiGamepadActive)
            {
                bool startupSensitivePhase = IsMainUiGamepadStartupSensitivePhase();
                try
                {
                    var controllerSnapshot = XInputControllerHub.Read();
                    buttonTracker.Update(controllerSnapshot);
                    if (buttonTracker.TaskSwitcherShortcutJustPressed ||
                        Volatile.Read(ref _nativeTaskSwitcherActive) == 1)
                    {
                        moveState = 0;
                        currentDir = null;
                        Thread.Sleep(8);
                        continue;
                    }

                    if (IsGameplayBackgroundMode)
                    {
                        moveState = 0;
                        currentDir = null;
                        hadPreviousInput = true;
                        if (buttonTracker.ReturnShortcutJustPressed)
                            Dispatcher.Invoke(MinimizeCurrentGameAndRestoreDoorpi);
                        Thread.Sleep(16);
                        continue;
                    }
                    ushort actionButtons = (ushort)(controllerSnapshot.Buttons & 0xFFF0);
                    ushort dpadButtons = (ushort)(controllerSnapshot.Buttons & 0x000F);
                    long nowTicks = Environment.TickCount64;
                    bool rightAnalogActive = Math.Abs(controllerSnapshot.ThumbRX) > 0.12 ||
                                             Math.Abs(controllerSnapshot.ThumbRY) > 0.12;
                    bool rightAnalogChanged = Math.Abs(controllerSnapshot.ThumbRX - lastPostedRightX) > 0.04 ||
                                              Math.Abs(controllerSnapshot.ThumbRY - lastPostedRightY) > 0.04;
                    bool leftAnalogActive = Math.Abs(controllerSnapshot.ThumbLX) > 0.12 ||
                                            Math.Abs(controllerSnapshot.ThumbLY) > 0.12;
                    bool leftAnalogChanged = Math.Abs(controllerSnapshot.ThumbLX - lastPostedLeftX) > 0.04 ||
                                             Math.Abs(controllerSnapshot.ThumbLY - lastPostedLeftY) > 0.04;
                    if (buttonTracker.PressedButtons != 0 ||
                        actionButtons != lastPostedButtons ||
                        dpadButtons != lastPostedDpad ||
                        controllerSnapshot.Connected != lastPostedConnected ||
                        rightAnalogChanged ||
                        leftAnalogChanged ||
                        (rightAnalogActive && nowTicks - lastControllerPostAt >= 32) ||
                        (leftAnalogActive && nowTicks - lastControllerPostAt >= 32) ||
                        lastControllerPostAt == long.MinValue ||
                        nowTicks - lastControllerPostAt >= 250)
                    {
                        PostMainUiControllerSnapshot(controllerSnapshot, buttonTracker.PressedButtons);
                        lastPostedButtons = actionButtons;
                        lastPostedConnected = controllerSnapshot.Connected;
                        lastPostedRightX = controllerSnapshot.ThumbRX;
                        lastPostedRightY = controllerSnapshot.ThumbRY;
                        lastPostedLeftX = controllerSnapshot.ThumbLX;
                        lastPostedLeftY = controllerSnapshot.ThumbLY;
                        lastPostedDpad = dpadButtons;
                        lastControllerPostAt = nowTicks;
                    }
                    if (IsControlCaptureActive())
                    {
                        moveState = 0;
                        currentDir = null;
                        hadPreviousInput = true;
                        Thread.Sleep(8);
                        continue;
                    }
                    bool foregroundOk = IsDoorpiMainWindowForeground() ||
                                            (DateTime.UtcNow.Ticks - Interlocked.Read(ref _focusRestoredAtTicks))
                                            < TimeSpan.FromSeconds(2).Ticks;
                    bool controlEditorOwnsInput = _controlEditorOpen && foregroundOk;
                    if (controlEditorOwnsInput != controlEditorOwnedInputLastFrame)
                    {
                        moveState = 0;
                        currentDir = null;
                        hadPreviousInput = false;
                        controlEditorOwnedInputLastFrame = controlEditorOwnsInput;
                    }

                    // Quando o overlay "Em execucao" esta no Doorpi, este loop e o
                    // unico dono da navegacao direcional. O JS continua responsavel
                    // apenas pelos botoes de acao, evitando dois movimentos por input.
                    bool executionLockOwnsMainUiInput = _executionLockActive && foregroundOk;
                    bool mainUiOwnsDirectionalNavigation =
                        (_mainUiOwnsDirectionalNavigation || controlEditorOwnsInput) && foregroundOk;
                    bool isLaunchingOrRunning = !executionLockOwnsMainUiInput &&
                        ((_gameSessionActive && !_gameIsMinimized)
                         || _mediaMouseActive
                         || _mediaExeModeActive
                         || _launcherMouseActive
                         || _systemControllerActive
                         || IsMainUiGamepadSuspendedForGame());

                    if ((_dialogModeActive && !controlEditorOwnsInput) ||
                        !foregroundOk ||
                        (!mainUiOwnsDirectionalNavigation &&
                         (_systemControllerActive || _launcherMouseActive || isLaunchingOrRunning)))
                    {
                        // QUANDO O JOGO ESTÃ RODANDO
                        if (_gameSessionActive && !_gameIsMinimized)
                        {
                            if (buttonTracker.ReturnShortcutJustPressed)
                                Dispatcher.Invoke(MinimizeCurrentGameAndRestoreDoorpi);
                        }
                        else
                        {
                            moveState = 0; currentDir = null;
                        }

                        // O Guide pode ser um pulso curto, especialmente no controle
                        // local enquanto um controle virtual do Parsec ocupa outro slot.
                        Thread.Sleep(8);
                        continue;
                    }

                    if (!TryReadMainUiGamepadSnapshot(out var input))
                    {
                        hadPreviousInput = false;
                        Thread.Sleep(startupSensitivePhase ? 18 : 10);
                        continue;
                    }

                    if (!hadPreviousInput)
                    {
                        moveState = 0;
                        currentDir = null;
                    }

                    double ax = input.AxisX;
                    double ay = input.AxisY;
                    ushort btn = input.Buttons;

                    if (DateTime.UtcNow.Ticks < Interlocked.Read(ref _returnFromExternalModeSuppressUntil))
                    {
                        hadPreviousInput = true;
                        Thread.Sleep(startupSensitivePhase ? 18 : 10);
                        continue;
                    }

                    // Abre o painel rapido apenas com o botao Select
                    if (DateTime.UtcNow.Ticks > Interlocked.Read(ref _returnFromExternalModeSuppressUntil))
                    {
                        if (!controlEditorOwnsInput &&
                            !buttonTracker.TaskSwitcherShortcutJustPressed &&
                            buttonTracker.AnyPressed(0x0020))
                        {
                            Dispatcher.BeginInvoke(() =>
                            {
                                if (webView?.CoreWebView2 != null)
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"openQuickPanel\"}");
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

                    hadPreviousInput = true;
                }
                catch (Exception ex) { Debug.WriteLine($"[MainUiGamepad] {ex.Message}"); }
                Thread.Sleep(startupSensitivePhase ? 18 : 10);
            }
        }
        private void CenterCursorOnScreen()
        {
            int centerX = (int)(System.Windows.SystemParameters.PrimaryScreenWidth / 2);
            int centerY = (int)(System.Windows.SystemParameters.PrimaryScreenHeight / 2);
            SetCursorPos(centerX, centerY);
        }
        private int _cleanupAndExitStarted;


        private void CleanupAndExit()
        {
            if (Interlocked.Exchange(ref _cleanupAndExitStarted, 1) == 1) return;

            // O fechamento normal e o encerramento de sessão do Windows também
            // preservam a fração já completada desde o último checkpoint periódico.
            try { CommitActiveSession(); } catch { }
            try { _playtimeCheckpointTimer?.Dispose(); } catch { }
            _playtimeCheckpointTimer = null;

            DiscordRpcManager.Instance.Dispose();
            DisposeBluetoothManager();
            DisposeWifiManager();
            DisposeSoundManager();
            // 1. ForÃ§a o fechamento de todas as janelas secundÃ¡rias
            try { _storeDownloadWindow?.Close(); } catch { }
            try { _webAppWindow?.Close(); } catch { }
            try { _popupWindow?.Close(); } catch { }
            try { _desktopVkb?.Close(); } catch { }

            // 2. DestrÃ³i as instÃ¢ncias do WebView2 (Mata os processos filhos no Windows)
            try { CloseGenericBrowserExtensionsPopup(); } catch { }
            try { _genericBrowserExtensionPopupView?.Dispose(); } catch { }
            try { _ytWebView?.Dispose(); } catch { }
            try { _popupWebView?.Dispose(); } catch { }
            try { webView?.Dispose(); } catch { }
            ClearMediaWebViewEnvironmentReferences();
            _genericBrowserEnvironment = null;

            // 3. Cancela as threads de monitoramento ativas
            _mainUiGamepadActive = false;
            StopGlobalControllerShortcutMonitor();
            foreach (var session in _executableAppSessions.Values)
            {
                try { session.WatcherCts?.Cancel(); } catch { }
                session.ControllerActive = false;
            }
            try { lock (_gameLaunchMonitorLock) { _gameLaunchMonitorCts?.Cancel(); } } catch { }

            // 4. Limpa recursos de hardware (seu cÃ³digo original)
            StopMainScreenMouseWatch();
            ReleaseAllStuckKeys();
            _ = timeEndPeriod(1);

            // (Opcional) Se quiser garantir que processos executÃ¡veis de mÃ­dia morram junto:
            // try { if (_mediaExeProcess != null && !_mediaExeProcess.HasExited) _mediaExeProcess.Kill(true); } catch { }
        }
        private int GetSourcePriority(string source) => source switch
        {
            "Steam" => 1,
            "Epic" => 1,
            "GOG" => 1,
            "Riot" => 1,
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
