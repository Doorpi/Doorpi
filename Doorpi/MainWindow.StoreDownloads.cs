using Microsoft.Web.WebView2.Core;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;

namespace Doorpi
{
    public partial class MainWindow
    {
        private StoreDownloadWindow? _storeDownloadWindow;
        private CancellationTokenSource? _storeInstallMonitorCts;
        private string _pendingStoreInstallId = "";
        private string _pendingStoreInstallName = "";
        private string _pendingStoreInstallUrl = "";
        private string _pendingStoreInstallerPath = "";
        private Process? _pendingStoreInstallerProcess;
        private HashSet<int> _storeInstallBaselineProcessIds = new();
        private HashSet<int> _storeInstallerFocusedProcessIds = new();
        private HashSet<IntPtr> _storeInstallerFocusedWindowHandles = new();
        private readonly object _storeInstallerFocusLock = new();
        private DateTime _storeInstallerLaunchedAtUtc = DateTime.MinValue;
        private CancellationTokenSource? _storeDownloadIntentCts;
        private volatile bool _storeInstallInputActive;
        private Thread? _storeInstallInputThread;
        private string _storeInstallCancelPromptInputMode = "";
        private volatile bool _storeInstallGuideMonitorActive;
        private Thread? _storeInstallGuideMonitorThread;
        private bool _storeInstallCancelConfirmationVisible;
        private bool _storeInstallRetryScreenFromLiveInstaller;
        private string _pendingInstalledStoreAutoOpenId = "";
        private string _pendingInstalledStoreAutoOpenName = "";

        private async Task OpenStoreDownloadSiteAsync(string storeId, string url, string storeName)
        {
            if (string.IsNullOrWhiteSpace(storeId) || string.IsNullOrWhiteSpace(url)) return;

            await Dispatcher.InvokeAsync(() =>
            {
                StopStoreInstallMonitor();
                CloseStoreDownloadWindow(markHandedOff: true);

                _pendingStoreInstallId = storeId;
                _pendingStoreInstallName = string.IsNullOrWhiteSpace(storeName) ? storeId : storeName;
                _pendingStoreInstallUrl = url;
                _pendingStoreInstallerPath = "";
                _pendingStoreInstallerProcess = null;
                _storeInstallBaselineProcessIds = new HashSet<int>();
                _storeInstallerFocusedProcessIds = new HashSet<int>();
                lock (_storeInstallerFocusLock)
                    _storeInstallerFocusedWindowHandles = new HashSet<IntPtr>();
                _storeInstallerLaunchedAtUtc = DateTime.MinValue;
                _storeInstallCancelPromptInputMode = "";
                _storeInstallCancelConfirmationVisible = false;
                _storeInstallRetryScreenFromLiveInstaller = false;
                _pendingInstalledStoreAutoOpenId = "";
                _pendingInstalledStoreAutoOpenName = "";
                StopStoreDownloadIntentTimeout();
                SendRuntimeSessionsToUI();
            });

            try
            {
                string profilePath = Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory,
                    "Data",
                    "browser-profiles",
                    "store-installer",
                    SafePathSegment(storeId));

                string downloadFolder = Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory,
                    "Data",
                    "store-installers",
                    SafePathSegment(storeId));

                var environment = await CoreWebView2Environment.CreateAsync(null, profilePath);

                await Dispatcher.InvokeAsync(async () =>
                {
                    _storeDownloadWindow = new StoreDownloadWindow(_pendingStoreInstallName, downloadFolder);

                    _storeDownloadWindow.DownloadProgress += (path, percent) =>
                    {
                        StopStoreDownloadIntentTimeout();
                        _pendingStoreInstallerPath = path;
                        if (_pendingStoreInstallerProcess == null)
                            StopStoreInstallInputMode(preserveCursor: true);
                    };
                    _storeDownloadWindow.DownloadIntent += () =>
                    {
                        _ = Dispatcher.InvokeAsync(StartStoreDownloadIntentTimeout);
                    };
                    _storeDownloadWindow.DownloadCompleted += path =>
                    {
                        StopStoreDownloadIntentTimeout();
                        _pendingStoreInstallerPath = path;
                        if (_storeInstallCancelConfirmationVisible)
                            return;

                        _ = Dispatcher.InvokeAsync(async () => await LaunchDownloadedStoreInstallerAsync(path));
                    };
                    _storeDownloadWindow.DownloadFailed += reason =>
                    {
                        _ = Dispatcher.InvokeAsync(() => FailStoreInstall(reason, canRetry: true));
                    };
                    _storeDownloadWindow.BrowserClosedBeforeDownload += () =>
                    {
                        _ = Dispatcher.InvokeAsync(() => FailStoreInstall("O download nao foi iniciado.", canRetry: true));
                    };
                    _storeDownloadWindow.RetryRequested += () =>
                    {
                        _ = Dispatcher.InvokeAsync(RetryStoreInstall);
                    };
                    _storeDownloadWindow.ContinueRequested += () =>
                    {
                        _ = Dispatcher.InvokeAsync(ContinueStoreInstallAfterCancelPrompt);
                    };
                    _storeDownloadWindow.CancelRequested += () =>
                    {
                        _ = Dispatcher.InvokeAsync(CancelStoreInstall);
                    };

                    _storeDownloadWindow.Show();
                    _storeDownloadWindow.Activate();
                    await _storeDownloadWindow.InitializeAsync(environment, url);

                    StartStoreInstallGuideMonitor();
                    StartStoreInstallInputMode(centerCursor: true);
                    _storeDownloadWindow.Activate();
                    EnsureCursorVisible();
                    SendRuntimeSessionsToUI();
                });
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[StoreInstall] Falha ao abrir site: " + ex.Message);
                await Dispatcher.InvokeAsync(() => FailStoreInstall("Nao foi possivel abrir o site da loja.", canRetry: true));
            }
        }

        private async Task LaunchDownloadedStoreInstallerAsync(string installerPath)
        {
            if (string.IsNullOrWhiteSpace(installerPath) || !File.Exists(installerPath))
            {
                FailStoreInstall("O instalador baixado nao foi encontrado.", canRetry: true);
                return;
            }

            string ext = Path.GetExtension(installerPath).ToLowerInvariant();
            if (ext != ".exe" && ext != ".msi")
            {
                FailStoreInstall("O arquivo baixado nao e um instalador suportado.", canRetry: true);
                return;
            }

            try
            {
                StartStoreInstallGuideMonitor();
                _storeInstallCancelConfirmationVisible = false;
                _storeInstallRetryScreenFromLiveInstaller = false;
                _storeDownloadWindow?.ShowInstalling();

                await StartElevatedInputBridgeAsync();
                await Task.Delay(1200);

                _storeInstallBaselineProcessIds = GetCurrentProcessIds();
                _storeInstallerLaunchedAtUtc = DateTime.UtcNow;
                _pendingStoreInstallerProcess = Process.Start(new ProcessStartInfo(installerPath)
                {
                    UseShellExecute = true,
                    WorkingDirectory = Path.GetDirectoryName(installerPath) ?? ""
                });

                if (_pendingStoreInstallerProcess == null)
                {
                    FailStoreInstall("Nao foi possivel abrir o instalador.", canRetry: true);
                    return;
                }

                StartStoreInstallInputMode(centerCursor: false);
                EnsureCursorVisible();
                ScheduleStoreInstallerFocusOnce(_pendingStoreInstallerProcess.Id);
                FocusNewStoreInstallWindowsOnce(baselineProcessIds: _storeInstallBaselineProcessIds, launchedAtUtc: _storeInstallerLaunchedAtUtc);
                StartStoreInstallMonitor();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[StoreInstall] Falha ao executar instalador: " + ex.Message);
                FailStoreInstall("Nao foi possivel abrir o instalador.", canRetry: true);
            }
        }

        private void StartStoreInstallMonitor()
        {
            StopStoreInstallMonitor();
            string storeId = _pendingStoreInstallId;
            var installer = _pendingStoreInstallerProcess;
            var baselineProcessIds = _storeInstallBaselineProcessIds;
            DateTime installerLaunchedAt = _storeInstallerLaunchedAtUtc;
            _storeInstallMonitorCts = new CancellationTokenSource();
            var token = _storeInstallMonitorCts.Token;

            _ = Task.Run(async () =>
            {
                DateTime startedAt = DateTime.UtcNow;
                DateTime noInstallerActivitySince = DateTime.MinValue;
                DateTime installedAndInstallerClosedSince = DateTime.MinValue;
                const int installerExitGraceMs = 4500;
                const int storeAutoLaunchWatchMs = 3500;

                while (!token.IsCancellationRequested)
                {
                    await Task.Delay(300, token).ConfigureAwait(false);

                    bool installed = IsStoreLauncherInstalled(storeId);
                    FocusNewStoreInstallWindowsOnce(baselineProcessIds, installerLaunchedAt);
                    int activeInstallerPid = FindActiveStoreInstallerProcessId(storeId, baselineProcessIds, installerLaunchedAt);
                    bool installerActive = activeInstallerPid > 0;
                    bool primaryInstallerExited = false;
                    try { primaryInstallerExited = installer != null && installer.HasExited; }
                    catch { primaryInstallerExited = true; }

                    if (installed && !installerActive && primaryInstallerExited)
                    {
                        if (TryFindInstalledStoreRuntime(storeId, out _, out _))
                        {
                            Dispatcher.Invoke(() => CompleteStoreInstall(openStoreAfterInstall: true));
                            return;
                        }

                        if (installedAndInstallerClosedSince == DateTime.MinValue)
                            installedAndInstallerClosedSince = DateTime.UtcNow;

                        if ((DateTime.UtcNow - installedAndInstallerClosedSince).TotalMilliseconds >= storeAutoLaunchWatchMs)
                        {
                            Dispatcher.Invoke(() => CompleteStoreInstall(openStoreAfterInstall: false));
                            return;
                        }

                        continue;
                    }

                    if (installerActive)
                    {
                        Dispatcher.Invoke(() => ScheduleStoreInstallerFocusOnce(activeInstallerPid));
                        noInstallerActivitySince = DateTime.MinValue;
                        continue;
                    }

                    if (noInstallerActivitySince == DateTime.MinValue)
                        noInstallerActivitySince = DateTime.UtcNow;

                    if (primaryInstallerExited &&
                        (DateTime.UtcNow - noInstallerActivitySince).TotalMilliseconds >= installerExitGraceMs)
                    {
                        Dispatcher.Invoke(() => FailStoreInstall("A instalacao foi cancelada ou nao foi concluida.", canRetry: true));
                        return;
                    }

                    if ((DateTime.UtcNow - startedAt).TotalMinutes >= 20)
                    {
                        Dispatcher.Invoke(() => FailStoreInstall("A instalacao demorou demais para ser confirmada.", canRetry: true));
                        return;
                    }
                }
            }, token);
        }

        private void CompleteStoreInstall(bool openStoreAfterInstall = false)
        {
            StopStoreInstallMonitor();
            StopStoreInstallGuideMonitor();
            _storeDownloadWindow?.ShowInstallSuccess();
            SendStoresToUI(LoadStoreLaunchers());

            _ = Task.Run(async () =>
            {
                await Task.Delay(openStoreAfterInstall ? 650 : 1600).ConfigureAwait(false);
                Dispatcher.Invoke(() =>
                {
                    string completedStoreId = _pendingStoreInstallId;
                    string completedStoreName = _pendingStoreInstallName;
                    CloseStoreDownloadWindow(markHandedOff: true);
                    StopStoreInstallInputMode();
                    DeletePendingStoreInstaller();
                    _pendingStoreInstallerProcess = null;
                    ClearPendingStoreInstall();
                    SendRuntimeSessionsToUI();
                    if (openStoreAfterInstall && !string.IsNullOrWhiteSpace(completedStoreId))
                    {
                        QueueInstalledStoreAutoOpen(completedStoreId, completedStoreName);
                        if (IsForegroundDoorpi())
                            TryStartPendingInstalledStoreAutoOpen();
                    }
                    else
                    {
                        ForceFocus();
                    }
                });
            });
        }

        private void FailStoreInstall(string message, bool canRetry)
        {
            StopStoreInstallMonitor();
            StopStoreDownloadIntentTimeout();
            StopStoreInstallGuideMonitor();
            StopStoreInstallInputMode(preserveCursor: true);
            ClearExecutionLock();
            _storeInstallCancelPromptInputMode = "";
            _storeInstallCancelConfirmationVisible = false;
            _storeDownloadWindow?.ShowInstallError(message, canRetry);
            _storeDownloadWindow?.Activate();
            SendRuntimeSessionsToUI();
        }

        private void RetryStoreInstall()
        {
            StopStoreDownloadIntentTimeout();
            StartStoreInstallGuideMonitor();
            _storeInstallCancelConfirmationVisible = false;

            if (_storeInstallRetryScreenFromLiveInstaller)
            {
                _storeInstallRetryScreenFromLiveInstaller = false;
                TerminateActiveStoreInstallers();
            }

            if (!string.IsNullOrWhiteSpace(_pendingStoreInstallerPath) && File.Exists(_pendingStoreInstallerPath))
            {
                _ = LaunchDownloadedStoreInstallerAsync(_pendingStoreInstallerPath);
                return;
            }

            if (!string.IsNullOrWhiteSpace(_pendingStoreInstallUrl))
            {
                StartStoreInstallGuideMonitor();
                StartStoreInstallInputMode(centerCursor: true);
                _storeDownloadWindow?.HideOverlayAndFocusSite();
            }
        }

        private void CancelStoreInstall()
        {
            string installerPathToDelete = _pendingStoreInstallerPath;
            var windowToClose = _storeDownloadWindow;

            StopStoreInstallMonitor();
            StopStoreDownloadIntentTimeout();
            StopStoreInstallGuideMonitor();
            TerminateActiveStoreInstallersAsync(installerPathToDelete);

            try
            {
                windowToClose?.MarkHandedOff();
                windowToClose?.Hide();
            }
            catch { }

            _storeDownloadWindow = null;
            StopStoreInstallInputMode();
            DeletePendingStoreInstaller();
            ClearPendingStoreInstall();
            ClearExecutionLock();
            SendRuntimeSessionsToUI();
            ForceFocus();

            _ = Dispatcher.InvokeAsync(() =>
            {
                try { windowToClose?.CancelActiveDownload(); } catch { }
                try { windowToClose?.Close(); } catch { }
            }, System.Windows.Threading.DispatcherPriority.Background);
        }

        private void RequestStoreInstallCancelConfirmation()
        {
            if (_storeDownloadWindow == null)
                return;

            if (_storeInstallCancelConfirmationVisible || _storeInstallRetryScreenFromLiveInstaller)
                return;

            _storeInstallCancelPromptInputMode = DetermineStoreInstallInputMode();

            if (string.Equals(_storeInstallCancelPromptInputMode, "installer", StringComparison.OrdinalIgnoreCase))
            {
                _storeInstallRetryScreenFromLiveInstaller = true;
                _storeDownloadWindow.ShowInstallError("A instalacao ainda esta aberta. Tente novamente ou cancele para fechar o setup.", canRetry: true);
                _storeDownloadWindow.Activate();
                StopStoreInstallMonitor();
                StopStoreInstallGuideMonitor();
                StopStoreInstallInputMode(preserveCursor: true);
                ClearExecutionLock();
                SendRuntimeSessionsToUI();
                return;
            }

            _storeInstallCancelConfirmationVisible = true;
            _storeDownloadWindow.ShowCancelConfirmation();
            _storeDownloadWindow.Activate();
            StopStoreInstallInputMode(preserveCursor: true);
            ClearExecutionLock();
            SendRuntimeSessionsToUI();
        }

        private void ContinueStoreInstallAfterCancelPrompt()
        {
            if (_storeDownloadWindow == null)
                return;

            string mode = _storeInstallCancelPromptInputMode;
            _storeInstallCancelPromptInputMode = "";
            _storeInstallCancelConfirmationVisible = false;
            _storeDownloadWindow.RestoreAfterCancelConfirmation();
            _storeDownloadWindow.Activate();
            StartStoreInstallGuideMonitor();

            if (string.Equals(mode, "browser", StringComparison.OrdinalIgnoreCase))
            {
                StartStoreInstallInputMode(centerCursor: false);
                EnsureCursorVisible();
                return;
            }

            if (string.Equals(mode, "installer", StringComparison.OrdinalIgnoreCase))
            {
                StartStoreInstallInputMode(centerCursor: false);
                int installerPid = ResolveActiveStoreInstallerProcessId();
                if (installerPid > 0)
                    ScheduleStoreInstallerFocusOnce(installerPid);
                return;
            }

            if (string.Equals(mode, "download", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(_pendingStoreInstallerPath) &&
                File.Exists(_pendingStoreInstallerPath) &&
                _pendingStoreInstallerProcess == null)
            {
                _ = LaunchDownloadedStoreInstallerAsync(_pendingStoreInstallerPath);
            }
        }

        private string DetermineStoreInstallInputMode()
        {
            if (_pendingStoreInstallerProcess != null)
            {
                try
                {
                    if (!_pendingStoreInstallerProcess.HasExited)
                        return "installer";
                }
                catch { return "installer"; }
            }

            if (ResolveActiveStoreInstallerProcessId() > 0)
                return "installer";

            if (string.IsNullOrWhiteSpace(_pendingStoreInstallerPath))
                return "browser";

            return "download";
        }

        private void StopStoreInstallMonitor()
        {
            try { _storeInstallMonitorCts?.Cancel(); } catch { }
            try { _storeInstallMonitorCts?.Dispose(); } catch { }
            _storeInstallMonitorCts = null;
        }

        private void StartStoreDownloadIntentTimeout()
        {
            if (!string.IsNullOrWhiteSpace(_pendingStoreInstallerPath))
                return;

            StopStoreDownloadIntentTimeout();
            _storeDownloadIntentCts = new CancellationTokenSource();
            var token = _storeDownloadIntentCts.Token;

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(10), token).ConfigureAwait(false);
                    if (token.IsCancellationRequested) return;
                    if (!string.IsNullOrWhiteSpace(_pendingStoreInstallerPath)) return;

                    Dispatcher.Invoke(() =>
                        FailStoreInstall("O download nao iniciou corretamente. Tente novamente ou cancele.", canRetry: true));
                }
                catch (OperationCanceledException) { }
            }, token);
        }

        private void StopStoreDownloadIntentTimeout()
        {
            try { _storeDownloadIntentCts?.Cancel(); } catch { }
            try { _storeDownloadIntentCts?.Dispose(); } catch { }
            _storeDownloadIntentCts = null;
        }

        private void CloseStoreDownloadWindow(bool markHandedOff)
        {
            try
            {
                if (markHandedOff) _storeDownloadWindow?.MarkHandedOff();
                _storeDownloadWindow?.Close();
            }
            catch { }
            _storeDownloadWindow = null;
        }

        private void ClearPendingStoreInstall()
        {
            _pendingStoreInstallId = "";
            _pendingStoreInstallName = "";
            _pendingStoreInstallUrl = "";
            _pendingStoreInstallerPath = "";
            _pendingStoreInstallerProcess = null;
            _storeInstallBaselineProcessIds = new HashSet<int>();
            _storeInstallerFocusedProcessIds = new HashSet<int>();
            lock (_storeInstallerFocusLock)
                _storeInstallerFocusedWindowHandles = new HashSet<IntPtr>();
            _storeInstallerLaunchedAtUtc = DateTime.MinValue;
            _storeInstallCancelPromptInputMode = "";
            _storeInstallCancelConfirmationVisible = false;
            _storeInstallRetryScreenFromLiveInstaller = false;
            StopStoreInstallGuideMonitor();
            StopStoreDownloadIntentTimeout();
        }

        private void DeletePendingStoreInstaller()
        {
            DeleteStoreInstallerFile(_pendingStoreInstallerPath);
        }

        private void DeleteStoreInstallerFile(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return;
            try
            {
                string fullPath = Path.GetFullPath(path);
                string expectedRoot = Path.GetFullPath(Path.Combine(
                    AppDomain.CurrentDomain.BaseDirectory,
                    "Data",
                    "store-installers"));

                if (!fullPath.StartsWith(expectedRoot, StringComparison.OrdinalIgnoreCase))
                    return;

                if (File.Exists(fullPath))
                    File.Delete(fullPath);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[StoreInstall] Falha ao apagar instalador baixado: " + ex.Message);
            }
        }

        private void StartStoreInstallInputMode(bool centerCursor)
        {
            if (_storeInstallInputActive && _storeInstallInputThread?.IsAlive == true)
                return;

            _storeInstallInputActive = true;
            Dispatcher.Invoke(() =>
            {
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
                if (centerCursor) CenterCursorOnScreen();
                UpdateHoverStateInWebView();
            });

            _storeInstallInputThread = new Thread(() =>
                SharedGamepadControllerLoop(
                    () => _storeInstallInputActive,
                    () => { },
                    handleXboxButton: false,
                    shouldAcceptInput: () => true))
            {
                IsBackground = true
            };
            _storeInstallInputThread.Start();
        }

        private void StopStoreInstallInputMode(bool preserveCursor = false)
        {
            _storeInstallInputActive = false;
            StopElevatedInputBridge();
            Dispatcher.Invoke(() =>
            {
                _desktopVkb?.Close();
                _desktopVkb = null!;
                if (preserveCursor)
                {
                    EnsureCursorVisible();
                    _mainScreenMouseVisible = true;
                    try { GetCursorPos(out _lastKnownCursorPos); } catch { }
                    return;
                }

                EnsureCursorHidden();
                _mainScreenMouseVisible = false;
                _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
                try { SetCursorPos(0, 0); } catch { }
            });
        }

        private void StartStoreInstallGuideMonitor()
        {
            if (_storeInstallGuideMonitorActive && _storeInstallGuideMonitorThread?.IsAlive == true)
                return;

            _storeInstallGuideMonitorActive = true;
            _storeInstallGuideMonitorThread = new Thread(StoreInstallGuideMonitorLoop)
            {
                IsBackground = true,
                Name = "StoreInstallGuideMonitor"
            };
            _storeInstallGuideMonitorThread.Start();
        }

        private void StopStoreInstallGuideMonitor()
        {
            _storeInstallGuideMonitorActive = false;
        }

        private void StoreInstallGuideMonitorLoop()
        {
            const ushort guideButton = 0x0400;
            ushort previousButtons = 0;
            try
            {
                if (XInputGetStateSecret(0, out var initialState) == 0)
                    previousButtons = initialState.Gamepad.wButtons;
            }
            catch { }

            while (_storeInstallGuideMonitorActive)
            {
                try
                {
                    if (XInputGetStateSecret(0, out var state) == 0)
                    {
                        ushort buttons = state.Gamepad.wButtons;
                        bool pressed = (buttons & guideButton) != 0 && (previousButtons & guideButton) == 0;
                        previousButtons = buttons;

                        if (pressed)
                        {
                            Dispatcher.Invoke(
                                RequestStoreInstallCancelConfirmation,
                                System.Windows.Threading.DispatcherPriority.Send);
                            Thread.Sleep(90);
                            continue;
                        }
                    }
                }
                catch { }

                Thread.Sleep(8);
            }
        }

        private void TerminateActiveStoreInstallers()
        {
            TerminateStoreInstallerProcessIds(CaptureActiveStoreInstallerProcessIds(), waitForExitMs: 250);
        }

        private void TerminateActiveStoreInstallersAsync(string installerPathToDelete = "")
        {
            var processIds = CaptureActiveStoreInstallerProcessIds();
            _ = Task.Run(() =>
            {
                TerminateStoreInstallerProcessIds(processIds, waitForExitMs: 250);
                DeleteStoreInstallerFile(installerPathToDelete);
            });
        }

        private HashSet<int> CaptureActiveStoreInstallerProcessIds()
        {
            var processIds = new HashSet<int>();
            int activePid = ResolveActiveStoreInstallerProcessId();
            if (activePid > 0)
                processIds.Add(activePid);

            try
            {
                if (_pendingStoreInstallerProcess != null && !_pendingStoreInstallerProcess.HasExited)
                    processIds.Add(_pendingStoreInstallerProcess.Id);
            }
            catch { }

            return processIds;
        }

        private static void TerminateStoreInstallerProcessIds(HashSet<int> processIds, int waitForExitMs)
        {
            foreach (int pid in processIds)
            {
                try
                {
                    using var process = Process.GetProcessById(pid);
                    if (process.HasExited) continue;

                    try { process.CloseMainWindow(); } catch { }
                    if (!process.WaitForExit(waitForExitMs))
                    {
                        try { process.Kill(entireProcessTree: true); } catch { }
                    }
                }
                catch { }
            }
        }

        private void FocusNewStoreInstallWindowsOnce(HashSet<int> baselineProcessIds, DateTime launchedAtUtc)
        {
            if (!IsStoreInstallFlowActive())
                return;

            try
            {
                int currentPid = Environment.ProcessId;
                var candidates = new List<IntPtr>();

                EnumWindows((hwnd, _) =>
                {
                    try
                    {
                        if (hwnd == IntPtr.Zero) return true;
                        if (!IsWindowVisible(hwnd) && !IsIconic(hwnd)) return true;
                        if (!GetWindowRect(hwnd, out RECT rect) || rect.Width < 120 || rect.Height < 80) return true;

                        GetWindowThreadProcessId(hwnd, out uint pidRaw);
                        int pid = (int)pidRaw;
                        if (pid <= 0 || pid == currentPid) return true;
                        if (baselineProcessIds.Contains(pid)) return true;

                        using var process = Process.GetProcessById(pid);
                        if (process.HasExited) return true;

                        DateTime startTimeUtc = DateTime.MinValue;
                        try { startTimeUtc = process.StartTime.ToUniversalTime(); } catch { }
                        if (startTimeUtc != DateTime.MinValue &&
                            launchedAtUtc != DateTime.MinValue &&
                            startTimeUtc < launchedAtUtc.AddSeconds(-3))
                        {
                            return true;
                        }

                        string text = $"{SafeProcessName(process)} {SafeProcessPath(process)}".ToLowerInvariant();
                        if (text.Contains("doorpiinputbridge") || text.Contains("doorpi.exe"))
                            return true;

                        bool shouldFocus;
                        lock (_storeInstallerFocusLock)
                            shouldFocus = _storeInstallerFocusedWindowHandles.Add(hwnd);

                        if (shouldFocus)
                            candidates.Add(hwnd);
                    }
                    catch { }

                    return true;
                }, IntPtr.Zero);

                foreach (var hwnd in candidates)
                    ScheduleStoreInstallerWindowFocusOnce(hwnd);
            }
            catch { }
        }

        private void ScheduleStoreInstallerWindowFocusOnce(IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero) return;

            _ = Task.Run(async () =>
            {
                await Task.Delay(120).ConfigureAwait(false);

                try
                {
                    Dispatcher.Invoke(() =>
                    {
                        if (!IsStoreInstallFlowActive())
                            return;

                        if (!IsWindowVisible(hwnd) && !IsIconic(hwnd))
                            return;

                        if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
                        else ShowWindow(hwnd, 5);
                        BringWindowToTop(hwnd);
                        SetForegroundWindow(hwnd);
                    });
                }
                catch { }
            });
        }

        private static HashSet<int> GetCurrentProcessIds()
        {
            try { return Process.GetProcesses().Select(p => p.Id).ToHashSet(); }
            catch { return new HashSet<int>(); }
        }

        private void ScheduleStoreInstallerFocusOnce(int processId)
        {
            if (processId <= 0) return;
            if (!_storeInstallerFocusedProcessIds.Add(processId)) return;

            _ = Task.Run(async () =>
            {
                for (int attempt = 0; attempt < 16; attempt++)
                {
                    if (!_storeInstallInputActive) return;
                    await Task.Delay(250).ConfigureAwait(false);

                    bool focused = false;
                    try
                    {
                        Dispatcher.Invoke(() =>
                        {
                            IntPtr hwnd = FindVisibleWindowForProcess(processId);
                            if (hwnd == IntPtr.Zero) return;
                            if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
                            else ShowWindow(hwnd, 5);
                            BringWindowToTop(hwnd);
                            SetForegroundWindow(hwnd);
                            focused = true;
                        });
                    }
                    catch { }

                    if (focused) return;
                }
            });
        }

        private int ResolveActiveStoreInstallerProcessId()
        {
            try
            {
                int activeInstaller = FindActiveStoreInstallerProcessId(
                    _pendingStoreInstallId,
                    _storeInstallBaselineProcessIds,
                    _storeInstallerLaunchedAtUtc);
                if (activeInstaller > 0)
                    return activeInstaller;
            }
            catch { }

            try
            {
                if (_pendingStoreInstallerProcess != null && !_pendingStoreInstallerProcess.HasExited)
                    return _pendingStoreInstallerProcess.Id;
            }
            catch { }

            return 0;
        }

        private bool IsStoreInstallFlowActive()
            => _storeDownloadWindow != null ||
               !string.IsNullOrWhiteSpace(_pendingStoreInstallId) ||
               !string.IsNullOrWhiteSpace(_pendingStoreInstallerPath) ||
               _pendingStoreInstallerProcess != null;

        private bool ShowExecutionLockForStoreInstall()
        {
            if (!IsStoreInstallFlowActive() || string.IsNullOrWhiteSpace(_pendingStoreInstallId))
                return false;

            StopStoreInstallGuideMonitor();
            StopStoreInstallInputMode();
            string name = StoreInstallExecutionName();
            var (heroImage, gridImage) = StoreInstallExecutionVisuals();

            ShowExecutionLock(
                "storeInstall",
                name,
                _pendingStoreInstallId,
                _pendingStoreInstallUrl,
                "stores",
                "storeInstall",
                heroImage,
                gridImage);
            return true;
        }

        private string StoreInstallExecutionName()
        {
            string storeName = string.IsNullOrWhiteSpace(_pendingStoreInstallName)
                ? _pendingStoreInstallId
                : _pendingStoreInstallName;

            return string.IsNullOrWhiteSpace(storeName)
                ? "Instalando loja"
                : $"Instalando loja - {storeName}";
        }

        private (string HeroImage, string GridImage) StoreInstallExecutionVisuals()
        {
            try
            {
                var store = LoadStoreLaunchers().FirstOrDefault(s =>
                    string.Equals(s.Id, _pendingStoreInstallId, StringComparison.OrdinalIgnoreCase));

                if (store == null)
                    return ("", "");

                string grid = FirstNonEmpty(
                    store.LogoStaticImage,
                    store.LogoImage,
                    store.GridStaticImage,
                    store.GridImage,
                    store.GridHorizontalStaticImage,
                    store.GridHorizontalImage);

                string hero = FirstNonEmpty(
                    store.HeroStaticImage,
                    store.HeroImage,
                    store.GridHorizontalStaticImage,
                    store.GridHorizontalImage,
                    store.GridStaticImage,
                    store.GridImage);

                return (hero, grid);
            }
            catch
            {
                return ("", "");
            }
        }

        private void RestoreStoreInstallFromExecutionLock()
        {
            if (_storeDownloadWindow == null)
                return;

            ClearExecutionLock();
            _storeDownloadWindow.Activate();
            StartStoreInstallGuideMonitor();

            string mode = DetermineStoreInstallInputMode();
            if (string.Equals(mode, "browser", StringComparison.OrdinalIgnoreCase))
            {
                StartStoreInstallInputMode(centerCursor: false);
                EnsureCursorVisible();
                return;
            }

            if (string.Equals(mode, "installer", StringComparison.OrdinalIgnoreCase))
            {
                StartStoreInstallInputMode(centerCursor: false);
                int installerPid = ResolveActiveStoreInstallerProcessId();
                if (installerPid > 0)
                    ScheduleStoreInstallerFocusOnce(installerPid);
            }
        }

        private void QueueInstalledStoreAutoOpen(string storeId, string storeName)
        {
            _pendingInstalledStoreAutoOpenId = storeId;
            _pendingInstalledStoreAutoOpenName = storeName;
        }

        private bool TryStartPendingInstalledStoreAutoOpen()
        {
            string storeId = _pendingInstalledStoreAutoOpenId;
            if (string.IsNullOrWhiteSpace(storeId))
                return false;

            _pendingInstalledStoreAutoOpenId = "";
            _pendingInstalledStoreAutoOpenName = "";
            _ = Dispatcher.InvokeAsync(async () => await OpenStoreAsync(storeId));
            return true;
        }

        private bool TryFindInstalledStoreRuntime(string storeId, out Process? process, out IntPtr hwnd)
        {
            process = null;
            hwnd = IntPtr.Zero;

            if (string.IsNullOrWhiteSpace(storeId))
                return false;

            string? exe = ResolveStoreLauncherExe(storeId);
            if (string.IsNullOrWhiteSpace(exe))
                return false;

            try
            {
                if (TryFindStoreWindow(storeId, exe, out var windowProcess, out var windowHwnd))
                {
                    process = windowProcess;
                    hwnd = windowHwnd;
                    return true;
                }
            }
            catch { }

            try
            {
                var running = FindRunningProcessForExe(exe);
                if (running != null && !SafeHasExited(running))
                {
                    process = running;
                    return true;
                }
            }
            catch { }

            return false;
        }

        private int FindActiveStoreInstallerProcessId(string storeId, HashSet<int> baselineProcessIds, DateTime launchedAtUtc)
        {
            string normalizedStore = (storeId ?? "").ToLowerInvariant();
            int currentPid = Environment.ProcessId;

            foreach (var process in Process.GetProcesses())
            {
                try
                {
                    if (process.Id == currentPid) continue;
                    if (baselineProcessIds.Contains(process.Id)) continue;
                    if (process.HasExited) continue;

                    DateTime startTimeUtc = DateTime.MinValue;
                    try { startTimeUtc = process.StartTime.ToUniversalTime(); } catch { }
                    if (startTimeUtc != DateTime.MinValue &&
                        launchedAtUtc != DateTime.MinValue &&
                        startTimeUtc < launchedAtUtc.AddSeconds(-3))
                    {
                        continue;
                    }

                    string name = process.ProcessName ?? "";
                    string title = "";
                    string path = "";
                    try { title = process.MainWindowTitle ?? ""; } catch { }
                    try { path = process.MainModule?.FileName ?? ""; } catch { }

                    if (LooksLikeStoreInstallerProcess(normalizedStore, name, title, path))
                        return process.Id;

                    IntPtr hwnd = FindVisibleWindowForProcess(process.Id);
                    if (hwnd != IntPtr.Zero && LooksLikeStoreInstallerWindow(normalizedStore, name, title, path))
                        return process.Id;
                }
                catch { }
                finally
                {
                    try { process.Dispose(); } catch { }
                }
            }

            return 0;
        }

        private static bool LooksLikeStoreInstallerProcess(string storeId, string name, string title, string path)
        {
            string text = $"{name} {title} {path}".ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(text)) return false;

            bool hasInstallerSignal =
                text.Contains("setup") ||
                text.Contains("installer") ||
                text.Contains("install") ||
                text.Contains("bootstrap") ||
                text.Contains("msiexec") ||
                text.Contains("update");

            if (!hasInstallerSignal) return false;

            if (string.IsNullOrWhiteSpace(storeId)) return true;
            if (storeId == "gog" && (text.Contains("gog") || text.Contains("galaxy"))) return true;
            if (storeId == "steam" && text.Contains("steam")) return true;
            if (storeId == "epic" && (text.Contains("epic") || text.Contains("unreal"))) return true;
            if (storeId == "riot" && riotInstallerText(text)) return true;
            if (storeId == "xbox" && (text.Contains("xbox") || text.Contains("gaming") || text.Contains("microsoft"))) return true;

            return text.Contains(storeId);

            static bool riotInstallerText(string value)
                => value.Contains("riot") || value.Contains("2xko");
        }

        private static bool LooksLikeStoreInstallerWindow(string storeId, string name, string title, string path)
        {
            string text = $"{name} {title} {path}".ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(text)) return false;
            if (text.Contains("doorpiinputbridge") || text.Contains("doorpi.exe")) return false;

            bool hasInstallerSignal =
                text.Contains("setup") ||
                text.Contains("installer") ||
                text.Contains("install") ||
                text.Contains("instalador") ||
                text.Contains("bootstrap") ||
                text.Contains("wizard") ||
                text.Contains("msiexec");

            if (hasInstallerSignal) return true;

            if (storeId == "gog")
            {
                return (text.Contains("gog") || text.Contains("galaxy")) &&
                       (text.Contains("temp") || text.Contains("appdata") || text.Contains("setup"));
            }

            if (storeId == "steam")
                return text.Contains("steam") && hasInstallerSignal;

            if (storeId == "epic")
                return (text.Contains("epic") || text.Contains("unreal")) && hasInstallerSignal;

            if (storeId == "riot")
                return (text.Contains("riot") || text.Contains("2xko")) && hasInstallerSignal;

            if (storeId == "xbox")
                return (text.Contains("xbox") || text.Contains("gaming") || text.Contains("microsoft")) && hasInstallerSignal;

            return false;
        }

    }
}
