using Microsoft.Web.WebView2.Wpf;
using System;
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
            public string ParentKind = "";
            public DateTime StartedUtc = DateTime.MinValue;
            public CancellationTokenSource? LaunchMonitorCts;
        }

        private sealed class ExecutableAppSession
        {
            public string Key = "";
            public Process? Process;
            public string Url = "";
            public bool ControllerActive;
            public bool WatcherPaused;
            public bool GamepadDisabled;
            public bool DoorpiSuspended;
            public CancellationTokenSource? WatcherCts;
            public Thread? ControllerThread;
            public int SessionId;
        }

        private sealed class WebAppSession
        {
            public Window? Window;
            public WebView2? WebView;
            public string Url = "";
            public bool IsClosing;
            public bool IsYouTube;
            public bool CanUseXInputEx = true;
            public bool MouseActive;
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
        private readonly Dictionary<string, ExecutableAppSession> _executableAppSessions = new(StringComparer.OrdinalIgnoreCase);
        private string _activeExecutableAppSessionKey = "";
        private WebAppSession? _webAppSession;
        private DesktopControlSession? _desktopControlSession;

        private readonly object _gameLaunchMonitorLock = new();

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

        private ExecutableAppSession EnsureExecutableAppSession(string? url = null)
        {
            string key = NormalizeExecutableSessionKey(url ?? _activeExecutableAppSessionKey);
            if (!_executableAppSessions.TryGetValue(key, out var session))
            {
                session = new ExecutableAppSession { Key = key, Url = key == "__active__" ? "" : key };
                _executableAppSessions[key] = session;
            }

            _activeExecutableAppSessionKey = key;
            return session;
        }

        private ExecutableAppSession? GetExecutableAppSession(string? url)
        {
            string key = NormalizeExecutableSessionKey(url);
            return _executableAppSessions.TryGetValue(key, out var session) ? session : null;
        }

        private void ActivateExecutableAppSession(string? url)
        {
            _activeExecutableAppSessionKey = NormalizeExecutableSessionKey(url);
        }

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
                if (session.ControllerActive ||
                    (session.Process != null && !SafeHasExited(session.Process)))
                {
                    exe = true;
                    break;
                }
            }

            bool web = _webAppSession is { Window: not null } ||
                       _webAppSession is { WebView: not null } ||
                       _webAppSession is { MouseActive: true };

            bool store = _isStoreLauncherSession && IsActiveStoreLauncherProcessAlive();

            return game || exe || web || store;
        }

        private bool HasAnyBlockingExternalSession()
        {
            bool game = _gameSession is { Active: true } && !_gameIsMinimized;

            bool exe = false;
            foreach (var session in _executableAppSessions.Values)
            {
                if (session.Process != null &&
                    !SafeHasExited(session.Process) &&
                    !session.DoorpiSuspended)
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

            return game || exe || web || store;
        }

        private bool ShouldMuteDoorpiAudio()
            => HasAnyPendingSession();

        private void ClearGameWindowSession()
        {
            try { _gameSession?.LaunchMonitorCts?.Cancel(); } catch { }
            _gameSession = null;
        }

        private void ClearExecutableAppSession()
        {
            var session = ActiveExecutableAppSession;
            try { session?.WatcherCts?.Cancel(); } catch { }

            if (session != null)
                _executableAppSessions.Remove(session.Key);

            _activeExecutableAppSessionKey = "";
        }

        private void ClearWebAppSession()
        {
            _webAppSession = null;
        }

        private int NextExecutableAppSessionId()
        {
            var session = EnsureExecutableAppSession();
            return Interlocked.Increment(ref session.SessionId);
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

        private bool _doorpiSuspendedForMedia
        {
            get => ActiveExecutableAppSession?.DoorpiSuspended == true;
            set => EnsureExecutableAppSession().DoorpiSuspended = value;
        }

        private bool _mediaExeModeActive
        {
            get => ActiveExecutableAppSession?.ControllerActive == true;
            set => EnsureExecutableAppSession().ControllerActive = value;
        }

        private Thread? _mediaExeThread
        {
            get => ActiveExecutableAppSession?.ControllerThread;
            set => EnsureExecutableAppSession().ControllerThread = value;
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
