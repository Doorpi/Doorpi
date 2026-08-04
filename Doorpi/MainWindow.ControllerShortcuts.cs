using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows;

namespace Doorpi
{
    public partial class MainWindow
    {
        private enum NativeTaskSwitcherOriginKind
        {
            None,
            Game,
            Executable,
            Store,
            Web
        }

        private volatile bool _globalControllerShortcutMonitorActive;
        private Thread? _globalControllerShortcutMonitorThread;
        private long _globalDoorpiReturnGeneration;

        private int _nativeTaskSwitcherActive;
        private DateTime _nativeTaskSwitcherStartedUtc;
        private IntPtr _nativeTaskSwitcherInitialForeground;
        private bool _nativeTaskSwitcherWasVisible;
        private NativeTaskSwitcherOriginKind _nativeTaskSwitcherOriginKind;
        private ExecutableAppSession? _nativeTaskSwitcherOriginExecutableSession;
        private long _nativeTaskSwitcherActivationSuppressUntilUtcTicks;

        private void StartGlobalControllerShortcutMonitor()
        {
            if (_globalControllerShortcutMonitorActive &&
                _globalControllerShortcutMonitorThread?.IsAlive == true)
            {
                return;
            }

            _globalControllerShortcutMonitorActive = true;
            _globalControllerShortcutMonitorThread = new Thread(GlobalControllerShortcutMonitorLoop)
            {
                IsBackground = true,
                Name = "DoorpiGlobalControllerShortcuts",
                Priority = ThreadPriority.AboveNormal
            };
            _globalControllerShortcutMonitorThread.Start();
        }

        private void StopGlobalControllerShortcutMonitor()
        {
            _globalControllerShortcutMonitorActive = false;
            Interlocked.Increment(ref _globalDoorpiReturnGeneration);
            EndNativeTaskSwitcher(cancelSelection: true);
        }

        private void GlobalControllerShortcutMonitorLoop()
        {
            var buttonTracker = new XInputButtonTracker();
            buttonTracker.Update(XInputControllerHub.Read());

            while (_globalControllerShortcutMonitorActive)
            {
                bool continuousAnalogActive = false;
                try
                {
                    var snapshot = XInputControllerHub.Read();
                    buttonTracker.Update(snapshot);
                    continuousAnalogActive = ProcessConfiguredControlBindings(snapshot);

                    if (Volatile.Read(ref _nativeTaskSwitcherActive) == 1)
                    {
                        ProcessNativeTaskSwitcherInput(buttonTracker);
                        Thread.Sleep(8);
                        continue;
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[GlobalControllerShortcuts] " + ex.Message);
                }

                // Interpolate configured pointer/scroll output at the same cadence
                // used by Doorpi's native mouse loop. XInput remains cached at its
                // normal sampling rate, so this smooths output without over-polling
                // the controller or increasing idle CPU usage.
                Thread.Sleep(continuousAnalogActive ? 1 : 8);
            }
        }

        private void QueueGlobalDoorpiReturnVerification()
        {
            long generation = Interlocked.Increment(ref _globalDoorpiReturnGeneration);
            QueueGlobalDoorpiReturnVerification(generation, 700, allowSessionAction: true);
        }

        private void QueueGlobalDoorpiReturnVerification(
            long generation,
            int delayMilliseconds,
            bool allowSessionAction)
        {
            _ = Task.Run(async () =>
            {
                await Task.Delay(delayMilliseconds).ConfigureAwait(false);
                if (!_globalControllerShortcutMonitorActive ||
                    generation != Interlocked.Read(ref _globalDoorpiReturnGeneration) ||
                    Volatile.Read(ref _nativeTaskSwitcherActive) == 1)
                {
                    return;
                }

                await Dispatcher.InvokeAsync(() =>
                    VerifyGlobalDoorpiReturn(generation, allowSessionAction));
            });
        }

        private void VerifyGlobalDoorpiReturn(long generation, bool allowSessionAction)
        {
            if (generation != Interlocked.Read(ref _globalDoorpiReturnGeneration) ||
                Volatile.Read(ref _nativeTaskSwitcherActive) == 1)
            {
                return;
            }

            if (allowSessionAction)
            {
                if (IsStoreInstallFlowActive())
                {
                    RequestStoreInstallCancelConfirmation();
                    QueueGlobalDoorpiReturnVerification(
                        generation,
                        700,
                        allowSessionAction: false);
                    return;
                }

                if (_gameSessionActive && !_gameIsMinimized &&
                    CanMinimizeCurrentGameSession())
                {
                    MinimizeCurrentGameAndRestoreDoorpi();
                    QueueGlobalDoorpiReturnVerification(
                        generation,
                        700,
                        allowSessionAction: false);
                    return;
                }

                var executableSession = ActiveExecutableAppSession;
                if (executableSession != null && !executableSession.DoorpiSuspended)
                {
                    ReturnToDoorpiFromMediaExeSession(executableSession.SessionId);
                    QueueGlobalDoorpiReturnVerification(
                        generation,
                        700,
                        allowSessionAction: false);
                    return;
                }

                if (_isStoreLauncherSession &&
                    !_storePausedByDoorpi &&
                    CanMinimizeStoreSession())
                {
                    MinimizeStoreSessionAndShowMenu();
                    QueueGlobalDoorpiReturnVerification(
                        generation,
                        700,
                        allowSessionAction: false);
                    return;
                }

                if (_systemControllerActive)
                {
                    if (!RequestCloseDoorpiFileExplorerLaunch())
                        ExitDesktopMode();

                    QueueGlobalDoorpiReturnVerification(
                        generation,
                        700,
                        allowSessionAction: false);
                    return;
                }

                if (_isGenericBrowserMode && _genericBrowserCaptureWebAppUrl)
                {
                    CloseYouTubeInline(skipStoreCompletion: true);
                    QueueGlobalDoorpiReturnVerification(
                        generation,
                        700,
                        allowSessionAction: false);
                    return;
                }

                if (_webAppWindow != null &&
                    _webAppWindow.WindowState != WindowState.Minimized)
                {
                    ClosePopupWindowAndDispose();
                    _webAppWindow.WindowState = WindowState.Minimized;
                    QueueGlobalDoorpiReturnVerification(
                        generation,
                        700,
                        allowSessionAction: false);
                    return;
                }
            }

            if (IsDoorpiMainWindowForeground())
            {
                RestoreMainUiControllerOwnership();
                return;
            }

            // Última garantia: não infere nem troca a janela da sessão. Apenas usa
            // o mesmo retorno ao Doorpi já empregado pelos fluxos atuais.
            FocusDoorpiKeepSession();
        }

        private void BeginNativeTaskSwitcher()
        {
            if (Interlocked.CompareExchange(ref _nativeTaskSwitcherActive, 1, 0) != 0)
                return;

            Interlocked.Increment(ref _globalDoorpiReturnGeneration);
            _nativeTaskSwitcherStartedUtc = DateTime.UtcNow;
            _nativeTaskSwitcherInitialForeground = GetForegroundWindow();
            _nativeTaskSwitcherWasVisible = false;
            CaptureNativeTaskSwitcherOrigin(_nativeTaskSwitcherInitialForeground);
            Interlocked.Exchange(
                ref _nativeTaskSwitcherActivationSuppressUntilUtcTicks,
                DateTime.UtcNow.AddSeconds(3).Ticks);

            try
            {
                SendInputs(new[]
                {
                    KeyboardInput(VK_MENU),
                    KeyboardInput(VK_TAB),
                    KeyboardInput(VK_TAB, keyUp: true)
                });
            }
            catch
            {
                EndNativeTaskSwitcher(cancelSelection: true);
            }
        }

        private void ProcessNativeTaskSwitcherInput(XInputButtonTracker buttonTracker)
        {
            if (buttonTracker.ReturnShortcutJustPressed)
            {
                EndNativeTaskSwitcher(cancelSelection: true);
                QueueGlobalDoorpiReturnVerification();
                return;
            }

            IntPtr foreground = GetForegroundWindow();
            bool switcherVisible = IsNativeTaskSwitcherVisible();
            _nativeTaskSwitcherWasVisible |= switcherVisible ||
                                             LooksLikeAltTabSwitcher(foreground);

            var elapsed = DateTime.UtcNow - _nativeTaskSwitcherStartedUtc;
            bool foregroundChanged =
                elapsed.TotalMilliseconds >= 900 &&
                foreground != IntPtr.Zero &&
                foreground != _nativeTaskSwitcherInitialForeground &&
                !LooksLikeAltTabSwitcher(foreground);
            bool visibleSwitcherClosed =
                elapsed.TotalMilliseconds >= 300 &&
                _nativeTaskSwitcherWasVisible &&
                !switcherVisible &&
                !LooksLikeAltTabSwitcher(foreground);

            if (foregroundChanged || visibleSwitcherClosed)
            {
                EndNativeTaskSwitcher(cancelSelection: false, synchronizeSelection: true);
                return;
            }

            if (elapsed.TotalSeconds >= 15)
                EndNativeTaskSwitcher(cancelSelection: true);
        }

        private void CaptureNativeTaskSwitcherOrigin(IntPtr foreground)
        {
            _nativeTaskSwitcherOriginKind = NativeTaskSwitcherOriginKind.None;
            _nativeTaskSwitcherOriginExecutableSession = null;

            if (foreground == IntPtr.Zero || IsDoorpiMainWindowForeground())
                return;

            if (_gameSessionActive && IsForegroundOwnedByCurrentGame())
            {
                _nativeTaskSwitcherOriginKind = NativeTaskSwitcherOriginKind.Game;
                return;
            }

            if (_isStoreLauncherSession && IsForegroundOwnedByActiveStore())
            {
                _nativeTaskSwitcherOriginKind = NativeTaskSwitcherOriginKind.Store;
                return;
            }

            if (IsForegroundOwnedByActiveWebApp())
            {
                _nativeTaskSwitcherOriginKind = NativeTaskSwitcherOriginKind.Web;
                return;
            }

            var executableSession = FindExecutableSessionForWindow(foreground);
            if (executableSession == null && IsForegroundOwnedByActiveMediaExe())
                executableSession = ActiveExecutableAppSession;
            if (executableSession != null)
            {
                _nativeTaskSwitcherOriginKind = NativeTaskSwitcherOriginKind.Executable;
                _nativeTaskSwitcherOriginExecutableSession = executableSession;
            }
        }

        private ExecutableAppSession? FindExecutableSessionForWindow(IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero)
                return null;

            GetWindowProcessId(hwnd, out uint pidRaw);
            int processId = (int)pidRaw;
            foreach (var session in _executableAppSessions.Values)
            {
                if (session.SnapshotAttachedWindowHandles().Contains(hwnd) ||
                    (processId > 0 && session.ContainsProcessGroupId(processId)))
                {
                    return session;
                }

                try
                {
                    if (processId > 0 &&
                        session.Process != null &&
                        !SafeHasExited(session.Process) &&
                        session.Process.Id == processId)
                    {
                        return session;
                    }
                }
                catch { }
            }

            return null;
        }

        private void SynchronizeNativeTaskSwitcherSelection(
            IntPtr initialForeground,
            IntPtr selectedForeground,
            NativeTaskSwitcherOriginKind originKind,
            ExecutableAppSession? originExecutableSession)
        {
            Interlocked.Exchange(
                ref _nativeTaskSwitcherActivationSuppressUntilUtcTicks,
                0);

            if (selectedForeground == IntPtr.Zero)
                return;

            bool selectedDoorpi = IsDoorpiProcessWindow(selectedForeground);
            if (selectedDoorpi)
            {
                if (initialForeground != selectedForeground)
                {
                    MarkNativeTaskSwitcherOriginMinimized(
                        originKind,
                        originExecutableSession);
                }
                return;
            }

            ResumeNativeTaskSwitcherSelectedSession(selectedForeground);
        }

        private static bool IsDoorpiProcessWindow(IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero)
                return false;

            try
            {
                GetWindowProcessId(hwnd, out uint pidRaw);
                return pidRaw == (uint)Environment.ProcessId;
            }
            catch { return false; }
        }

        private void MarkNativeTaskSwitcherOriginMinimized(
            NativeTaskSwitcherOriginKind originKind,
            ExecutableAppSession? originExecutableSession)
        {
            Interlocked.Exchange(
                ref _executionLockSuppressUntilUtcTicks,
                DateTime.UtcNow.AddSeconds(3).Ticks);
            if (originKind != NativeTaskSwitcherOriginKind.None)
                SuspendExecutionLockWatch();
            else
                ClearExecutionLock();

            switch (originKind)
            {
                case NativeTaskSwitcherOriginKind.Game:
                    if (_gameSessionActive)
                    {
                        _gameIsMinimized = true;
                        _gameIsRunningAndDoorpiHidden = false;
                        MarkStorePausedBecauseChildGameReturnedToDoorpi();
                        _mainUiGamepadSuspendedForGame = false;
                        _launcherMouseActive = false;
                        Interlocked.Exchange(ref _mainUiGamepadSuppressUntilUtcTicks, 0);
                    }
                    break;

                case NativeTaskSwitcherOriginKind.Executable:
                    if (originExecutableSession != null)
                    {
                        SetActiveExecutableAppSession(originExecutableSession);
                        originExecutableSession.ControllerActive = false;
                        originExecutableSession.MouseModeActive = false;
                        originExecutableSession.MouseInputTemporarilyDisabled = false;
                        originExecutableSession.DoorpiSuspended = true;
                        try { originExecutableSession.WatcherCts?.Cancel(); } catch { }
                    }
                    break;

                case NativeTaskSwitcherOriginKind.Store:
                    if (_isStoreLauncherSession)
                    {
                        _storePausedByDoorpi = true;
                        _storeMouseModeActive = false;
                        _storeMouseInputTemporarilyDisabled = false;
                        _mainUiGamepadSuspendedForGame = false;
                        Interlocked.Exchange(ref _mainUiGamepadSuppressUntilUtcTicks, 0);
                    }
                    break;

                case NativeTaskSwitcherOriginKind.Web:
                    StopMediaControllerMode();
                    RequestMediaMouseInputAbort();
                    if (_webAppWindow != null)
                        _webAppWindow.WindowState = WindowState.Minimized;
                    break;
            }

            ClearExecutionLock();
            SendGameLaunchStatus("gameLaunchDone");
            RestoreMainUiControllerOwnership();
            webView?.Focus();
            System.Windows.Input.Keyboard.Focus(webView);
            SendRuntimeSessionsToUI();
        }

        private void ResumeNativeTaskSwitcherSelectedSession(IntPtr selectedForeground)
        {
            if (_gameSessionActive && IsForegroundOwnedByCurrentGame())
            {
                ResumeExecutionLockWatch();
                if (_gameIsMinimized)
                    MarkCurrentGameForegroundRestored();
                else
                {
                    _gameIsRunningAndDoorpiHidden = true;
                    ClearExecutionLock();
                    SendRuntimeSessionsToUI();
                }
                return;
            }

            var executableSession = FindExecutableSessionForWindow(selectedForeground);
            if (executableSession != null)
            {
                ReactivateExecutableSessionSelectedByTaskSwitcher(executableSession);
                return;
            }

            if (_isStoreLauncherSession && IsForegroundOwnedByActiveStore())
            {
                ResumeExecutionLockWatch();
                _storePausedByDoorpi = false;
                ClearExecutionLock();
                ReactivateStoreControlsForForeground();
                return;
            }

            if (IsForegroundOwnedByActiveWebApp())
            {
                ResumeExecutionLockWatch();
                ClearExecutionLock();
                StartMediaControllerMode();
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
                SendRuntimeSessionsToUI();
            }
        }

        private void ReactivateExecutableSessionSelectedByTaskSwitcher(
            ExecutableAppSession session)
        {
            SetActiveExecutableAppSession(session);
            _mediaExeCurrentUrl = session.Url;

            var media = FindMediaAppForExecutableSession(session.Url);
            var process = FindAliveMediaExeProcess(session.Url, session.Process);
            if (process != null)
            {
                session.Process = process;
                try { session.AddProcessGroupId(process.Id); } catch { }
                ExpandMediaExeProcessGroup(session);
            }

            InitializeMediaExeMouseModeForSession(session, media);
            session.GamepadDisabled = !session.MouseModeRequested;
            session.DoorpiSuspended = false;
            session.WatcherPaused = false;
            session.MouseInputTemporarilyDisabled = false;
            int sessionId = NextExecutableAppSessionId(session);

            if (process != null)
            {
                try { session.WatcherCts?.Cancel(); } catch { }
                session.WatcherCts = new CancellationTokenSource();
                StartMediaExeWatcher(
                    process,
                    session.Url,
                    media?.Name ??
                    Path.GetFileNameWithoutExtension(session.ExecutablePath) ??
                    "Aplicativo",
                    session.WatcherCts.Token);
            }

            EnsureMediaExeShortcutThread(sessionId);
            if (session.MouseModeRequested)
                StartMediaExeMouseModeForSession(sessionId, centerCursor: false);

            ResumeExecutionLockWatch();
            ClearExecutionLock();
            SendRuntimeSessionsToUI();
        }

        private static void TapNativeKey(ushort key)
        {
            SendInputs(new[]
            {
                KeyboardInput(key),
                KeyboardInput(key, keyUp: true)
            });
        }

        private static bool IsNativeTaskSwitcherVisible()
        {
            bool found = false;
            try
            {
                EnumWindows((hWnd, _) =>
                {
                    if (IsWindowVisible(hWnd) && LooksLikeAltTabSwitcher(hWnd))
                    {
                        found = true;
                        return false;
                    }
                    return true;
                }, IntPtr.Zero);
            }
            catch { }
            return found;
        }

        private void EndNativeTaskSwitcher(
            bool cancelSelection,
            bool synchronizeSelection = false)
        {
            if (Interlocked.Exchange(ref _nativeTaskSwitcherActive, 0) == 0)
                return;

            IntPtr initialForeground = _nativeTaskSwitcherInitialForeground;
            NativeTaskSwitcherOriginKind originKind = _nativeTaskSwitcherOriginKind;
            ExecutableAppSession? originExecutableSession =
                _nativeTaskSwitcherOriginExecutableSession;

            try
            {
                if (cancelSelection)
                    TapNativeKey(0x1B);
            }
            catch { }
            finally
            {
                try { SendKey(VK_MENU, keyUp: true); } catch { }
                _nativeTaskSwitcherOriginKind = NativeTaskSwitcherOriginKind.None;
                _nativeTaskSwitcherOriginExecutableSession = null;
            }

            if (synchronizeSelection)
            {
                _ = Task.Run(async () =>
                {
                    await Task.Delay(140).ConfigureAwait(false);
                    IntPtr selectedForeground = GetForegroundWindow();
                    await Dispatcher.InvokeAsync(() =>
                        SynchronizeNativeTaskSwitcherSelection(
                            initialForeground,
                            selectedForeground,
                            originKind,
                            originExecutableSession));
                });
            }
            else
            {
                Interlocked.Exchange(
                    ref _nativeTaskSwitcherActivationSuppressUntilUtcTicks,
                    0);
            }
        }
    }
}
