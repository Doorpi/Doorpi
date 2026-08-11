using Microsoft.Web.WebView2.Wpf;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Windows;

namespace Doorpi
{
    public partial class MainWindow
    {
        private sealed class GameWindowSession
        {
            public bool Active;
            public bool DoorpiHiddenBehindGame;
            public bool MinimizedToDoorpi;
            public bool ForceDoorpiReturnOnClose;
            public bool LaunchCancelled;
            public Process? PendingLaunchProcess;
            public IntPtr GameHwnd = IntPtr.Zero;
            public IntPtr LauncherHwnd = IntPtr.Zero;
            public IntPtr LastVisibleWindowBeforeMinimize = IntPtr.Zero;
            public bool LauncherMouseActive;
            public string LockedProcessName = "";
            public string ActiveGameId = "";
            public string ActiveGameName = "";
            public string ParentKind = "";
            public DateTime StartedUtc = DateTime.MinValue;
            public long InitialPlaytimeMinutes = -1;
            public int LastCheckpointElapsedMinutes;
            public long LastCheckpointElapsedSeconds;
            public string PlaytimeSessionId = "";
            public CancellationTokenSource? LaunchMonitorCts;
            public bool FocusFallbackPromptVisible;
            public DateTime LastFocusFallbackPromptUtc = DateTime.MinValue;
        }

        private sealed class ExecutableAppSession
        {
            private readonly object _processTrackingLock = new();
            private readonly HashSet<int> _processGroupIds = new();
            private readonly HashSet<int> _baselineProcessIds = new();
            private readonly HashSet<IntPtr> _attachedWindowHandles = new();
            private readonly HashSet<IntPtr> _focusedWindowHandles = new();

            public string Key = "";
            public Process? Process;
            public string Url = "";
            public bool ControllerActive;
            public bool MouseModeActive;
            public bool WatcherPaused;
            public bool GamepadDisabled;
            public bool MouseModeRequested;
            public bool MouseModeInitialized;
            public bool MouseInputTemporarilyDisabled;
            public bool DoorpiSuspended;
            public CancellationTokenSource? WatcherCts;
            public Thread? ControllerThread;
            public Thread? ShortcutThread;
            public int ControllerThreadSessionId;
            public int ShortcutThreadSessionId;
            public string ProcessGroupRootDirectory = "";
            public string ProcessGroupExeName = "";
            public string ExecutablePath = "";
            public bool CloseProcessOnReturn;
            public bool AllowControllerInput = true;
            public int SessionId;

            public int ProcessGroupCount
            {
                get { lock (_processTrackingLock) return _processGroupIds.Count; }
            }

            public int BaselineProcessCount
            {
                get { lock (_processTrackingLock) return _baselineProcessIds.Count; }
            }

            public void ResetProcessTracking(IEnumerable<int> baselineProcessIds)
            {
                lock (_processTrackingLock)
                {
                    _processGroupIds.Clear();
                    _baselineProcessIds.Clear();
                    _baselineProcessIds.UnionWith(baselineProcessIds);
                    _attachedWindowHandles.Clear();
                }
            }

            public void ReplaceBaselineProcessIds(IEnumerable<int> baselineProcessIds)
            {
                lock (_processTrackingLock)
                {
                    _baselineProcessIds.Clear();
                    _baselineProcessIds.UnionWith(baselineProcessIds);
                }
            }

            public bool ContainsProcessGroupId(int processId)
            {
                lock (_processTrackingLock) return _processGroupIds.Contains(processId);
            }

            public bool IsBaselineProcess(int processId)
            {
                lock (_processTrackingLock) return _baselineProcessIds.Contains(processId);
            }

            public bool AddProcessGroupId(int processId)
            {
                lock (_processTrackingLock) return _processGroupIds.Add(processId);
            }

            public int[] SnapshotProcessGroupIds()
            {
                lock (_processTrackingLock)
                {
                    var snapshot = new int[_processGroupIds.Count];
                    _processGroupIds.CopyTo(snapshot);
                    return snapshot;
                }
            }

            public bool AddAttachedWindowHandle(IntPtr hwnd)
            {
                lock (_processTrackingLock) return _attachedWindowHandles.Add(hwnd);
            }

            public IntPtr[] SnapshotAttachedWindowHandles()
            {
                lock (_processTrackingLock)
                {
                    var snapshot = new IntPtr[_attachedWindowHandles.Count];
                    _attachedWindowHandles.CopyTo(snapshot);
                    return snapshot;
                }
            }

            public bool AddFocusedWindowHandle(IntPtr hwnd)
            {
                lock (_processTrackingLock) return _focusedWindowHandles.Add(hwnd);
            }
        }

        private sealed class WebAppSession
        {
            public Window? Window;
            public WebView2? WebView;
            public string Url = "";
            public bool IsClosing;
            public bool IsYouTube;
            public bool CanUseXInputEx = true;
            public volatile bool MouseActive;
            public bool VkbIsOpen;
            public bool VkbHasFocus;
            public volatile WebView2? VkbOwnerView;
            public Window? PopupWindow;
            public WebView2? PopupWebView;
            public Thread? ControllerThread;
        }

        private sealed class DesktopControlSession
        {
            public bool Active;
            public Thread? ControllerThread;
        }

        private GameWindowSession? _gameSession;
        private readonly ConcurrentDictionary<string, ExecutableAppSession> _executableAppSessions = new(StringComparer.OrdinalIgnoreCase);
        private string _activeExecutableAppSessionKey = "";
        private int _executableAppSessionSerial;
        private WebAppSession? _webAppSession;
        // Cached on the UI thread and consumed by the controller/focus workers.
        // Never make those workers dereference the WPF Window: DispatcherObject
        // access throws off-thread and used to silently disable the fast pointer path.
        private long _activeWebAppWindowHandleValue;
        private DesktopControlSession? _desktopControlSession;

        private readonly object _gameLaunchMonitorLock = new();
        private readonly object _sessionPlaytimeLock = new();
        private System.Threading.Timer? _playtimeCheckpointTimer;
        private static readonly TimeSpan PlaytimeCheckpointInterval = TimeSpan.FromMinutes(1);

        private bool _executionLockActive;
        private string _executionLockKind = "";
        private string _executionLockChannel = "";
        private string _executionLockId = "";
        private string _executionLockUrl = "";
        private string _executionLockAppType = "";
        private CancellationTokenSource? _executionLockFocusCts;
        private long _executionLockSuppressUntilUtcTicks;
        private bool _executionLockWatchSuspended;

        private GameWindowSession EnsureGameSession()
            => _gameSession ??= new GameWindowSession();

        private static string NormalizeExecutableSessionKey(string? url)
            => string.IsNullOrWhiteSpace(url) ? "__active__" : url.Trim();

        private ExecutableAppSession? ActiveExecutableAppSession
        {
            get
            {
                if (!string.IsNullOrWhiteSpace(_activeExecutableAppSessionKey) &&
                    _executableAppSessions.TryGetValue(_activeExecutableAppSessionKey, out var active))
                    return active;

                return null;
            }
        }

        private ExecutableAppSession GetOrCreateExecutableAppSession(string? url, bool activate)
        {
            string key = NormalizeExecutableSessionKey(url ?? _activeExecutableAppSessionKey);
            var session = _executableAppSessions.GetOrAdd(
                key,
                static sessionKey => new ExecutableAppSession
                {
                    Key = sessionKey,
                    Url = sessionKey == "__active__" ? "" : sessionKey
                });

            if (activate)
                SetActiveExecutableAppSession(session);

            return session;
        }

        private ExecutableAppSession EnsureExecutableAppSession(string? url = null)
            => GetOrCreateExecutableAppSession(url, activate: true);

        private ExecutableAppSession? GetExecutableAppSession(string? url)
        {
            string key = NormalizeExecutableSessionKey(url);
            return _executableAppSessions.TryGetValue(key, out var session) ? session : null;
        }

        private void ActivateExecutableAppSession(string? url)
        {
            string key = NormalizeExecutableSessionKey(url);
            if (_executableAppSessions.TryGetValue(key, out var session))
                SetActiveExecutableAppSession(session);
            else
            {
                var previous = ActiveExecutableAppSession;
                if (previous != null && !string.Equals(previous.Key, key, StringComparison.OrdinalIgnoreCase))
                    ReleaseExecutableForegroundOwnership(previous);
                _activeExecutableAppSessionKey = key;
            }
        }

        private void SetActiveExecutableAppSession(ExecutableAppSession session)
        {
            var previous = ActiveExecutableAppSession;
            if (previous != null && !ReferenceEquals(previous, session))
                ReleaseExecutableForegroundOwnership(previous);

            _activeExecutableAppSessionKey = session.Key;
        }

        private static void ReleaseExecutableForegroundOwnership(ExecutableAppSession session)
        {
            // A sessao continua viva, mas deixa de possuir a entrada.
            session.ControllerActive = false;
            session.MouseModeActive = false;
            session.MouseInputTemporarilyDisabled = true;
            session.DoorpiSuspended = true;
        }

        private bool IsActiveExecutableAppSession(ExecutableAppSession? session)
            => session != null &&
               string.Equals(_activeExecutableAppSessionKey, session.Key, StringComparison.OrdinalIgnoreCase) &&
               _executableAppSessions.TryGetValue(session.Key, out var current) &&
               ReferenceEquals(current, session);

        private ExecutableAppSession? GetExecutableAppSessionBySessionId(int sessionId)
            => _executableAppSessions.Values.FirstOrDefault(session => session.SessionId == sessionId);

        private WebAppSession EnsureWebAppSession()
            => _webAppSession ??= new WebAppSession();

        private DesktopControlSession EnsureDesktopControlSession()
            => _desktopControlSession ??= new DesktopControlSession();

        private bool HasAnyPendingSession()
        {
            bool game = _gameSession is { Active: true } ||
                        (_gameSession?.PendingLaunchProcess != null &&
                         !SafeHasExited(_gameSession.PendingLaunchProcess));

            bool exe = false;
            foreach (var session in _executableAppSessions.Values)
            {
                var aliveProcess = FindAliveMediaExeProcess(session.Url, session.Process);
                if (aliveProcess != null)
                    session.Process = aliveProcess;

                if (session.ControllerActive || aliveProcess != null)
                {
                    exe = true;
                    break;
                }
            }

            bool web = _webAppSession is { Window: not null } ||
                       _webAppSession is { WebView: not null } ||
                       _webAppSession is { MouseActive: true };

            bool store = _isStoreLauncherSession && IsActiveStoreLauncherProcessAlive();
            bool storeInstall = IsStoreInstallFlowActive();
            bool gpuUpdater = IsGpuUpdaterSessionActive();

            return game || exe || web || store || storeInstall || gpuUpdater;
        }

        private bool HasAnyBlockingExternalSession()
        {
            bool game = _gameSession is { Active: true } && !_gameIsMinimized;

            bool exe = false;
            foreach (var session in _executableAppSessions.Values)
            {
                var aliveProcess = FindAliveMediaExeProcess(session.Url, session.Process);
                if (aliveProcess != null)
                    session.Process = aliveProcess;

                if (aliveProcess != null && !session.DoorpiSuspended)
                {
                    exe = true;
                    break;
                }
            }

            bool web = _webAppSession is { Window: not null } &&
                       _webAppWindow?.WindowState != WindowState.Minimized;

            bool store = _isStoreLauncherSession &&
                         !_storePausedByDoorpi &&
                         IsActiveStoreLauncherProcessAlive();
            bool storeInstall = IsStoreInstallFlowActive();
            bool gpuUpdater = IsGpuUpdaterSessionActive();

            return game || exe || web || store || storeInstall || gpuUpdater;
        }

        private bool ShouldMuteDoorpiAudio()
            => HasAnyPendingSession();

        private void ClearGameWindowSession()
        {
            StopPlaytimeCheckpointTimer();
            StopGameLaunchStoreMouseMode();
            ResetSteamAccountSelectionInputState();
            ResetGameMinimizeGrace();
            try { _gameSession?.LaunchMonitorCts?.Cancel(); } catch { }
            _gameSession = null;
        }

        private void ClearExecutableAppSession(ExecutableAppSession? session)
        {
            bool closedConfiguredEmulator =
                session != null &&
                FindConfiguredEmulatorByExecutablePath(session.Url) != null;
            try { session?.WatcherCts?.Cancel(); } catch { }

            if (session != null)
            {
                session.ControllerActive = false;
                session.MouseModeActive = false;
                _executableAppSessions.TryRemove(session.Key, out _);

                if (string.Equals(_activeExecutableAppSessionKey, session.Key, StringComparison.OrdinalIgnoreCase))
                    _activeExecutableAppSessionKey = "";
            }

            if (closedConfiguredEmulator)
                ScheduleEmulatorLibraryReconcileAfterExternalMutation();
        }

        private void ClearExecutableAppSession()
            => ClearExecutableAppSession(ActiveExecutableAppSession);

        private void ClearWebAppSession()
        {
            Interlocked.Exchange(ref _activeWebAppWindowHandleValue, 0);
            _webAppSession = null;
        }

        private int NextExecutableAppSessionId()
        {
            var session = EnsureExecutableAppSession();
            return NextExecutableAppSessionId(session);
        }

        private int NextExecutableAppSessionId(ExecutableAppSession session)
        {
            session.SessionId = Interlocked.Increment(ref _executableAppSessionSerial);
            return session.SessionId;
        }

        private int _mediaExeSessionId
        {
            get => ActiveExecutableAppSession?.SessionId ?? 0;
            set => EnsureExecutableAppSession().SessionId = value;
        }

        private Process? _mediaExeProcess
        {
            get => ActiveExecutableAppSession?.Process;
            set
            {
                if (value == null && ActiveExecutableAppSession == null) return;
                EnsureExecutableAppSession().Process = value;
            }
        }

        private bool _mediaExeWatcherPaused
        {
            get => ActiveExecutableAppSession?.WatcherPaused == true;
            set => EnsureExecutableAppSession().WatcherPaused = value;
        }

        private CancellationTokenSource? _mediaExeWatcherCts
        {
            get => ActiveExecutableAppSession?.WatcherCts;
            set => EnsureExecutableAppSession().WatcherCts = value;
        }

        private string _mediaExeCurrentUrl
        {
            get => ActiveExecutableAppSession?.Url ?? "";
            set
            {
                var session = EnsureExecutableAppSession(value);
                session.Url = value ?? "";
            }
        }

        private bool _mediaExeGamepadDisabled
        {
            get => ActiveExecutableAppSession?.GamepadDisabled == true;
            set => EnsureExecutableAppSession().GamepadDisabled = value;
        }

        private bool _mediaExeMouseModeRequested
        {
            get => ActiveExecutableAppSession?.MouseModeRequested == true;
            set => EnsureExecutableAppSession().MouseModeRequested = value;
        }

        private bool _mediaExeMouseModeInitialized
        {
            get => ActiveExecutableAppSession?.MouseModeInitialized == true;
            set => EnsureExecutableAppSession().MouseModeInitialized = value;
        }

        private bool _mediaExeMouseInputTemporarilyDisabled
        {
            get => ActiveExecutableAppSession?.MouseInputTemporarilyDisabled == true;
            set => EnsureExecutableAppSession().MouseInputTemporarilyDisabled = value;
        }

        private bool _doorpiSuspendedForMedia
        {
            get => ActiveExecutableAppSession?.DoorpiSuspended == true;
            set => EnsureExecutableAppSession().DoorpiSuspended = value;
        }

        private bool _mediaExeModeActive
        {
            get => ActiveExecutableAppSession?.MouseModeActive == true;
            set => EnsureExecutableAppSession().MouseModeActive = value;
        }

        private Thread? _mediaExeThread
        {
            get => ActiveExecutableAppSession?.ControllerThread;
            set => EnsureExecutableAppSession().ControllerThread = value;
        }

        private Thread? _mediaExeShortcutThread
        {
            get => ActiveExecutableAppSession?.ShortcutThread;
            set => EnsureExecutableAppSession().ShortcutThread = value;
        }

        private Thread? _systemControllerThread
        {
            get => _desktopControlSession?.ControllerThread;
            set => EnsureDesktopControlSession().ControllerThread = value;
        }

        private bool _systemControllerActive
        {
            get => _desktopControlSession?.Active == true;
            set => EnsureDesktopControlSession().Active = value;
        }

        private bool _gameSessionActive
        {
            get => _gameSession?.Active == true;
            set => EnsureGameSession().Active = value;
        }

        private bool _gameIsRunningAndDoorpiHidden
        {
            get => _gameSession?.DoorpiHiddenBehindGame == true;
            set => EnsureGameSession().DoorpiHiddenBehindGame = value;
        }

        private bool _gameIsMinimized
        {
            get => _gameSession?.MinimizedToDoorpi == true;
            set => EnsureGameSession().MinimizedToDoorpi = value;
        }

        private bool _forceDoorpiReturnOnGameClose
        {
            get => _gameSession?.ForceDoorpiReturnOnClose == true;
            set => EnsureGameSession().ForceDoorpiReturnOnClose = value;
        }

        private bool _launchCancelled
        {
            get => _gameSession?.LaunchCancelled == true;
            set => EnsureGameSession().LaunchCancelled = value;
        }

        private Process? _pendingLaunchProcess
        {
            get => _gameSession?.PendingLaunchProcess;
            set => EnsureGameSession().PendingLaunchProcess = value;
        }

        private IntPtr _currentGameHwnd
        {
            get => _gameSession?.GameHwnd ?? IntPtr.Zero;
            set => EnsureGameSession().GameHwnd = value;
        }

        private IntPtr _currentLauncherHwnd
        {
            get => _gameSession?.LauncherHwnd ?? IntPtr.Zero;
            set => EnsureGameSession().LauncherHwnd = value;
        }

        private IntPtr _lastVisibleWindowBeforeMinimize
        {
            get => _gameSession?.LastVisibleWindowBeforeMinimize ?? IntPtr.Zero;
            set => EnsureGameSession().LastVisibleWindowBeforeMinimize = value;
        }

        private string _lockedGameProcessName
        {
            get => _gameSession?.LockedProcessName ?? "";
            set => EnsureGameSession().LockedProcessName = value ?? "";
        }

        private DateTime _sessionStartUtc
        {
            get => _gameSession?.StartedUtc ?? DateTime.MinValue;
            set => EnsureGameSession().StartedUtc = value;
        }

        private string _activeSessionGameId
        {
            get => _gameSession?.ActiveGameId ?? "";
            set => EnsureGameSession().ActiveGameId = value ?? "";
        }

        private string _activeSessionGameName
        {
            get => _gameSession?.ActiveGameName ?? "";
            set => EnsureGameSession().ActiveGameName = value ?? "";
        }

        private string _gameSessionParentKind
        {
            get => _gameSession?.ParentKind ?? "";
            set => EnsureGameSession().ParentKind = value ?? "";
        }

        private CancellationTokenSource? _gameLaunchMonitorCts
        {
            get => _gameSession?.LaunchMonitorCts;
            set => EnsureGameSession().LaunchMonitorCts = value;
        }

        private bool _launcherMouseActive
        {
            get => _gameSession?.LauncherMouseActive == true;
            set => EnsureGameSession().LauncherMouseActive = value;
        }

        private Window? _webAppWindow
        {
            get => _webAppSession?.Window;
            set => EnsureWebAppSession().Window = value;
        }

        private WebView2? _ytWebView
        {
            get => _webAppSession?.WebView;
            set => EnsureWebAppSession().WebView = value;
        }

        private string _currentWebAppUrl
        {
            get => _webAppSession?.Url ?? "";
            set => EnsureWebAppSession().Url = value ?? "";
        }

        private bool _ytClosing
        {
            get => _webAppSession?.IsClosing == true;
            set => EnsureWebAppSession().IsClosing = value;
        }

        private bool _isCurrentSiteYouTube
        {
            get => _webAppSession?.IsYouTube == true;
            set => EnsureWebAppSession().IsYouTube = value;
        }

        private bool _canUseXInputEx
        {
            get => _webAppSession?.CanUseXInputEx != false;
            set => EnsureWebAppSession().CanUseXInputEx = value;
        }

        private bool _mediaMouseActive
        {
            get => _webAppSession?.MouseActive == true;
            set => EnsureWebAppSession().MouseActive = value;
        }

        private bool _vkbIsOpen
        {
            get => _webAppSession?.VkbIsOpen == true;
            set => EnsureWebAppSession().VkbIsOpen = value;
        }

        private WebView2? _vkbOwnerView
        {
            get => _webAppSession?.VkbOwnerView;
            set => EnsureWebAppSession().VkbOwnerView = value;
        }

        private Window? _popupWindow
        {
            get => _webAppSession?.PopupWindow;
            set => EnsureWebAppSession().PopupWindow = value;
        }

        private WebView2? _popupWebView
        {
            get => _webAppSession?.PopupWebView;
            set => EnsureWebAppSession().PopupWebView = value;
        }

        private Thread? _mediaControllerThread
        {
            get => _webAppSession?.ControllerThread;
            set => EnsureWebAppSession().ControllerThread = value;
        }

        private bool _vkbHasFocus
        {
            get => _webAppSession?.VkbHasFocus == true;
            set => EnsureWebAppSession().VkbHasFocus = value;
        }
    }
}
