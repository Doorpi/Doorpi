using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;

namespace Doorpi
{
    public partial class MainWindow
    {
        private GpuUpdateManager? _gpuUpdateManager;
        private GpuUpdateStatus? _lastGpuUpdateStatus;
        private int _gpuArtworkRefreshRunning;
        private int _gpuUpdaterSessionSequence;
        private GpuUpdaterSession? _gpuUpdaterSession;
        private TaskCompletionSource<bool>? _gpuRestartNoticeRendered;
        private readonly object _gpuUpdaterSessionLock = new();

        private static readonly TimeSpan GpuUpdaterLaunchTimeout = TimeSpan.FromMinutes(3);
        private static readonly TimeSpan GpuUpdaterUnconfirmedWindowGap = TimeSpan.FromSeconds(7);
        private static readonly TimeSpan GpuUpdaterUnknownDriverWindowGap = TimeSpan.FromSeconds(2.5);
        private static readonly TimeSpan GpuUpdaterConfirmedQuietWindow = TimeSpan.FromMilliseconds(650);
        private static readonly JsonSerializerOptions GpuStatusJsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        private sealed class GpuUpdaterSession
        {
            public int Id { get; init; }
            public string Path { get; init; } = "";
            public string Name { get; init; } = "";
            public string ImageUrl { get; init; } = "";
            public DateTime StartedAtUtc { get; set; }
            public List<GpuAdapterInfo> InitialAdapters { get; set; } = new();
            public string ConfirmedDriverSignature { get; set; } = "";
            public bool HasKnownDriverBaseline { get; set; }
            public Dictionary<string, int> MissingDriverPollCounts { get; } = new(StringComparer.OrdinalIgnoreCase);
            public HashSet<string> RemovedDriverKeys { get; } = new(StringComparer.OrdinalIgnoreCase);
            public Process? LaunchedProcess { get; set; }
            public CancellationTokenSource Cancellation { get; } = new();
            public object StateLock { get; } = new();
            public HashSet<int> BaselineProcessIds { get; set; } = new();
            public HashSet<IntPtr> BaselineWindowHandles { get; set; } = new();
            public HashSet<int> ObservedProcessIds { get; } = new();
            public HashSet<IntPtr> ObservedWindowHandles { get; } = new();
            public HashSet<IntPtr> FocusedWindowHandles { get; } = new();
            public Thread? InputThread { get; set; }
            public bool InputActive { get; set; }
            public int ProcessAdoptionRunning;
            public volatile bool SuppressInputUntilConfirmReleased;
            public bool FirstWindowSeen { get; set; }
            public bool WaitingGapVisible { get; set; }
            public bool FinalizingVisible { get; set; }
            public bool DoorpiRestartStarted { get; set; }
            public DateTime? NoTrackedWindowSinceUtc { get; set; }
            public bool Finished { get; set; }
        }

        private string GpuUpdaterConfigPath => Path.Combine(dataFolder, "gpu-updaters.json");
        private GpuUpdateManager GpuUpdates => _gpuUpdateManager ??= new GpuUpdateManager(GpuUpdaterConfigPath);

        private void RefreshGpuUpdateStatus()
        {
            try
            {
                _lastGpuUpdateStatus = GpuUpdates.Refresh();
                SendGpuUpdateStatusToUI(_lastGpuUpdateStatus);
                _ = EnsureGpuUpdaterArtworkAsync(_lastGpuUpdateStatus);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[GpuUpdate] Refresh falhou: " + ex.Message);
                SendGpuUpdateStatusToUI(new GpuUpdateStatus
                {
                    Status = "error",
                    Message = "Não foi possível ler dados de placa de vídeo.",
                    LastCheckedAt = DateTimeOffset.Now
                });
            }
        }

        private void SendCachedGpuUpdateStatusToUI() => _ = Task.Run(RefreshGpuUpdateStatus);

        private void SendGpuUpdateStatusToUI(GpuUpdateStatus status)
        {
            try
            {
                var payload = new
                {
                    type = "gpuUpdateStatus",
                    status = status.Status,
                    message = status.Message,
                    lastCheckedAt = status.LastCheckedAt == DateTimeOffset.MinValue
                        ? ""
                        : status.LastCheckedAt.ToString("O"),
                    adapters = status.Adapters,
                    updaters = status.Updaters
                };

                Dispatcher.Invoke(() =>
                    webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(payload, GpuStatusJsonOptions)));
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[GpuUpdate] Send status falhou: " + ex.Message);
            }
        }

        private async Task AddGpuUpdaterFromDialogAsync()
        {
            await Dispatcher.InvokeAsync(() =>
            {
                try
                {
                    var dialog = new Microsoft.Win32.OpenFileDialog
                    {
                        Filter = "Executáveis (*.exe)|*.exe",
                        Title = "Selecionar atualizador de placa de vídeo"
                    };

                    bool? result;
                    StartDialogControllerMode();
                    try { result = dialog.ShowDialog(); }
                    finally { StopDialogControllerMode(); }

                    if (result == true)
                    {
                        GpuUpdates.AddManualUpdater(dialog.FileName);
                        RefreshGpuUpdateStatus();
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[GpuUpdate] Add dialog falhou: " + ex.Message);
                }
            });
        }

        private void RemoveGpuUpdater(string id)
        {
            try
            {
                GpuUpdates.RemoveUpdater(id);
                RefreshGpuUpdateStatus();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[GpuUpdate] Remove falhou: " + ex.Message);
            }
        }

        private void OpenGpuUpdater(string id)
        {
            try
            {
                var updater = GpuUpdates.FindUpdater(id);
                if (updater == null || string.IsNullOrWhiteSpace(updater.Path) || !File.Exists(updater.Path))
                {
                    RefreshGpuUpdateStatus();
                    return;
                }

                bool hasBlockingSession = Dispatcher.CheckAccess()
                    ? HasAnyPendingSession()
                    : Dispatcher.Invoke(HasAnyPendingSession);
                if (hasBlockingSession)
                {
                    PromptGpuUpdaterBlockedBySessions(updater);
                    return;
                }

                Dispatcher.Invoke(() => _ = LaunchGpuUpdaterAsync(updater));
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[GpuUpdate] Open falhou: " + ex.Message);
            }
        }

        private void PromptGpuUpdaterBlockedBySessions(GpuUpdaterApp updater)
        {
            void Send() => webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(new
            {
                type = "gpuUpdaterBlockedBySessions",
                updaterId = updater.Id,
                name = updater.Name
            }));

            try
            {
                if (Dispatcher.CheckAccess()) Send();
                else Dispatcher.Invoke(Send);
            }
            catch { }
        }

        private async Task CloseSessionsAndOpenGpuUpdaterAsync(string updaterId)
        {
            GpuUpdaterApp? updater = GpuUpdates.FindUpdater(updaterId);
            if (updater == null || string.IsNullOrWhiteSpace(updater.Path) || !File.Exists(updater.Path))
            {
                RefreshGpuUpdateStatus();
                return;
            }

            List<Task> closeTasks = new();
            await Dispatcher.InvokeAsync(() =>
            {
                if (IsStoreInstallFlowActive())
                    CancelStoreInstall();
                if (IsGpuUpdaterSessionActive())
                    CloseGpuUpdaterFromExecutionLock();
                closeTasks = BeginLogoutCurrentSessionsForUserSwitch();
            });

            await WaitForUserLogoutSessionsToCloseAsync(closeTasks).ConfigureAwait(false);
            await Dispatcher.InvokeAsync(() => _ = LaunchGpuUpdaterAsync(updater));
        }

        private async Task EnsureGpuUpdaterArtworkAsync(GpuUpdateStatus status)
        {
            if (Interlocked.Exchange(ref _gpuArtworkRefreshRunning, 1) == 1)
                return;

            try
            {
                bool changed = false;
                foreach (var updater in status.Updaters)
                {
                    if (string.IsNullOrWhiteSpace(updater.Id) || !string.IsNullOrWhiteSpace(updater.ImageUrl))
                        continue;

                    string query = BuildGpuUpdaterArtworkQuery(updater);
                    if (string.IsNullOrWhiteSpace(query)) continue;

                    try
                    {
                        var (gridUrl, horizontalUrl, heroUrl, _) = await FetchSteamGridAssetsAsync(query).ConfigureAwait(false);
                        string? sourceUrl = horizontalUrl ?? heroUrl ?? gridUrl;
                        if (string.IsNullOrWhiteSpace(sourceUrl)) continue;

                        string safeName = "gpu_updater_" + StableGpuArtworkName(updater.Id);
                        string? local = await DownloadImageAsync(sourceUrl, gridHorizontalFolder, safeName).ConfigureAwait(false);
                        string imageUrl = local != null
                            ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(local)}"
                            : sourceUrl;

                        if (GpuUpdates.SetUpdaterImage(updater.Id, imageUrl))
                            changed = true;
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine("[GpuUpdate] Artwork falhou: " + ex.Message);
                    }
                }

                if (changed) RefreshGpuUpdateStatus();
            }
            finally
            {
                Interlocked.Exchange(ref _gpuArtworkRefreshRunning, 0);
            }
        }

        private static string BuildGpuUpdaterArtworkQuery(GpuUpdaterApp updater)
        {
            string name = updater.Name ?? "";
            string vendor = (updater.Vendor ?? "").ToLowerInvariant();
            if (name.Contains("NVCleanstall", StringComparison.OrdinalIgnoreCase)) return "NVCleanstall";
            if (name.Contains("GeForce Experience", StringComparison.OrdinalIgnoreCase)) return "NVIDIA GeForce Experience";
            if (name.Contains("NVIDIA", StringComparison.OrdinalIgnoreCase) || vendor == "nvidia") return "NVIDIA App";
            if (name.Contains("AMD", StringComparison.OrdinalIgnoreCase) ||
                name.Contains("Adrenalin", StringComparison.OrdinalIgnoreCase) || vendor == "amd") return "AMD Software Adrenalin";
            if (name.Contains("Arc", StringComparison.OrdinalIgnoreCase)) return "Intel Arc Control";
            if (name.Contains("Intel", StringComparison.OrdinalIgnoreCase) || vendor == "intel") return "Intel Driver Support Assistant";
            return name;
        }

        private static string StableGpuArtworkName(string value)
        {
            foreach (char c in Path.GetInvalidFileNameChars()) value = value.Replace(c, '_');
            return value.Replace(':', '_').Replace('\\', '_').Replace('/', '_').ToLowerInvariant();
        }

        private void SendGpuUpdaterEvent(string type, object? details = null)
        {
            void Send()
            {
                if (webView?.CoreWebView2 == null) return;
                var payload = new Dictionary<string, object?> { ["type"] = type };
                if (details != null)
                {
                    foreach (var property in details.GetType().GetProperties())
                        payload[property.Name] = property.GetValue(details);
                }
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(payload));
            }

            if (Dispatcher.CheckAccess()) Send();
            else Dispatcher.BeginInvoke(Send);
        }

        private async Task LaunchGpuUpdaterAsync(GpuUpdaterApp updater)
        {
            EndGpuUpdaterSession(focusDoorpi: false, notifyUi: false);

            string path = updater.Path;
            string name = string.IsNullOrWhiteSpace(updater.Name)
                ? Path.GetFileNameWithoutExtension(path)
                : updater.Name;
            string imageUrl = !string.IsNullOrWhiteSpace(updater.ImageUrl)
                ? updater.ImageUrl
                : updater.IconDataUrl ?? "";

            var session = new GpuUpdaterSession
            {
                Id = Interlocked.Increment(ref _gpuUpdaterSessionSequence),
                Path = path,
                Name = name,
                ImageUrl = imageUrl
            };

            lock (_gpuUpdaterSessionLock) _gpuUpdaterSession = session;
            SendRuntimeSessionsToUI();

            SendGameLaunchStatus("gameLaunching", name, imageUrl, imageUrl, "app");
            try
            {
                await Dispatcher.InvokeAsync(() => { }, DispatcherPriority.Render);
                await Task.Delay(180, session.Cancellation.Token);
            }
            catch (OperationCanceledException) { return; }

            try
            {
                await StartElevatedInputBridgeAsync();
                if (!IsCurrentGpuUpdaterSession(session)) return;

                await Task.Delay(250, session.Cancellation.Token);
                session.BaselineProcessIds = CaptureGpuUpdaterProcessIds();
                session.BaselineWindowHandles = CaptureGpuUpdaterWindowHandles();
                session.InitialAdapters = GpuUpdates.ReadAdaptersOnly();
                session.HasKnownDriverBaseline = session.InitialAdapters.Any(adapter =>
                    !string.IsNullOrWhiteSpace(adapter.DriverVersion));
                session.StartedAtUtc = DateTime.UtcNow;

                session.LaunchedProcess = Process.Start(new ProcessStartInfo
                {
                    FileName = path,
                    UseShellExecute = true,
                    WorkingDirectory = Path.GetDirectoryName(path) ?? "",
                    WindowStyle = ProcessWindowStyle.Normal,
                    ErrorDialog = true
                });

                if (session.LaunchedProcess == null)
                {
                    FailGpuUpdaterSession(session, "closed");
                    return;
                }

                lock (session.StateLock)
                    session.ObservedProcessIds.Add(session.LaunchedProcess.Id);

                _ = MonitorGpuUpdaterSessionAsync(session);
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                Debug.WriteLine("[GpuUpdate] Launch falhou: " + ex.Message);
                FailGpuUpdaterSession(session, "closed");
            }
        }

        private async Task MonitorGpuUpdaterSessionAsync(GpuUpdaterSession session)
        {
            var token = session.Cancellation.Token;
            DateTime lastDriverCheckUtc = DateTime.MinValue;
            DateTime lastProcessAdoptionUtc = DateTime.MinValue;

            try
            {
                while (!token.IsCancellationRequested && IsCurrentGpuUpdaterSession(session))
                {
                    await Task.Delay(50, token).ConfigureAwait(false);

                    // A enumeracao da cadeia de processos pode ser cara. A janela deve
                    // ganhar input assim que aparece, antes dessa manutencao secundaria.
                    List<IntPtr> visibleWindows = ObserveGpuUpdaterWindows(session);
                    bool hasVisibleUi = visibleWindows.Count > 0;
                    bool hasTrackedWindow = HasLiveTrackedGpuUpdaterWindow(session);

                    if (hasVisibleUi)
                    {
                        session.NoTrackedWindowSinceUtc = null;

                        if (session.FinalizingVisible || session.WaitingGapVisible)
                        {
                            session.FinalizingVisible = false;
                            session.WaitingGapVisible = false;
                            ShowGpuUpdaterExecutionLock(session);
                        }

                        if (!session.FirstWindowSeen)
                            ActivateGpuUpdaterSession(session, visibleWindows[0]);
                        else
                            StartGpuUpdaterInput(session, centerCursor: false);
                    }
                    else if (session.FirstWindowSeen)
                    {
                        if (hasTrackedWindow)
                            session.NoTrackedWindowSinceUtc = null;
                        else
                            session.NoTrackedWindowSinceUtc ??= DateTime.UtcNow;
                    }

                    if ((DateTime.UtcNow - lastProcessAdoptionUtc).TotalMilliseconds >= 750)
                    {
                        lastProcessAdoptionUtc = DateTime.UtcNow;
                        QueueGpuUpdaterProcessAdoption(session);
                    }

                    if ((DateTime.UtcNow - lastDriverCheckUtc).TotalMilliseconds >= 750)
                    {
                        lastDriverCheckUtc = DateTime.UtcNow;
                        List<GpuAdapterInfo> currentAdapters = GpuUpdates.ReadAdaptersOnly();
                        if (TryConfirmGpuDriverReplacement(session, currentAdapters, out string currentSignature))
                        {
                            session.ConfirmedDriverSignature = currentSignature;
                            RefreshGpuUpdateStatus();
                        }
                    }

                    bool driverConfirmed = !string.IsNullOrWhiteSpace(session.ConfirmedDriverSignature);
                    if (!hasVisibleUi && driverConfirmed && session.FirstWindowSeen)
                    {
                        session.WaitingGapVisible = false;
                        if (!session.FinalizingVisible)
                            session.FinalizingVisible = true;

                        if (session.NoTrackedWindowSinceUtc.HasValue &&
                            DateTime.UtcNow - session.NoTrackedWindowSinceUtc.Value >= GpuUpdaterConfirmedQuietWindow)
                        {
                            await RestartDoorpiAfterGpuUpdateAsync(session).ConfigureAwait(false);
                            return;
                        }
                    }
                    else if (!hasVisibleUi && !driverConfirmed && session.FirstWindowSeen && !session.WaitingGapVisible)
                    {
                        session.WaitingGapVisible = true;
                    }
                    else if (!hasVisibleUi && session.FirstWindowSeen && session.NoTrackedWindowSinceUtc.HasValue &&
                             !session.HasKnownDriverBaseline &&
                             DateTime.UtcNow - session.NoTrackedWindowSinceUtc.Value >= GpuUpdaterUnknownDriverWindowGap)
                    {
                        Debug.WriteLine("[GpuUpdate] Reinicio por fallback: placa ou versao inicial nao identificada.");
                        await RestartDoorpiAfterGpuUpdateAsync(session).ConfigureAwait(false);
                        return;
                    }
                    else if (!hasVisibleUi && session.FirstWindowSeen && session.NoTrackedWindowSinceUtc.HasValue &&
                             DateTime.UtcNow - session.NoTrackedWindowSinceUtc.Value >= GpuUpdaterUnconfirmedWindowGap)
                    {
                        if (session.RemovedDriverKeys.Count > 0)
                        {
                            Debug.WriteLine("[GpuUpdate] Reinicio apos remocao detectada sem versao final legivel.");
                            await RestartDoorpiAfterGpuUpdateAsync(session).ConfigureAwait(false);
                            return;
                        }

                        Debug.WriteLine("[GpuUpdate] Sessao encerrada sem evidencia de reinstalacao do driver.");
                        Dispatcher.Invoke(() => EndGpuUpdaterSession(focusDoorpi: true, notifyUi: true));
                        return;
                    }

                    if (!session.FirstWindowSeen && DateTime.UtcNow - session.StartedAtUtc >= GpuUpdaterLaunchTimeout)
                    {
                        FailGpuUpdaterSession(session, "timeout");
                        return;
                    }

                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                Debug.WriteLine("[GpuUpdate] Monitor falhou: " + ex.Message);
                if (IsCurrentGpuUpdaterSession(session))
                    Dispatcher.Invoke(() => EndGpuUpdaterSession(focusDoorpi: true, notifyUi: true));
            }
        }

        private void ActivateGpuUpdaterSession(GpuUpdaterSession session, IntPtr hwnd)
        {
            if (!IsCurrentGpuUpdaterSession(session) || session.FirstWindowSeen) return;
            session.FirstWindowSeen = true;

            // A primeira janela valida inicia a sessao imediatamente. O mesmo overlay
            // apenas troca de "procurando" para "em execucao", sem um estado vazio.
            ShowGpuUpdaterExecutionLock(session);
            StartGpuUpdaterInput(session, centerCursor: false);

            Dispatcher.Invoke(() =>
            {
                if (!IsCurrentGpuUpdaterSession(session)) return;
                lock (session.StateLock) session.FocusedWindowHandles.Add(hwnd);
                if (Topmost) Topmost = false;
                SetWindowPos(_mainWindowHandle, HWND_NOTOPMOST, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
                ShowWindow(hwnd, 5);
                BringWindowToTop(hwnd);
                SetForegroundWindow(hwnd);
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
                CenterCursorOnScreen();
            });
        }

        private void AdoptGpuUpdaterProcessChain(GpuUpdaterSession session)
        {
            Dictionary<int, int> parentIds;
            try { parentIds = SnapshotParentProcessIds(); }
            catch { parentIds = new Dictionary<int, int>(); }

            HashSet<int> observed;
            lock (session.StateLock) observed = new HashSet<int>(session.ObservedProcessIds);

            foreach (Process process in Process.GetProcesses())
            {
                try
                {
                    if (process.Id == Environment.ProcessId || process.HasExited) continue;

                    bool alreadyObserved = observed.Contains(process.Id);
                    bool childOfObserved = HasAncestorInGroup(process.Id, parentIds, observed);
                    bool newProcess = !session.BaselineProcessIds.Contains(process.Id) &&
                                      ProcessStartedForGpuUpdater(process, session.StartedAtUtc);
                    bool hasNewWindow = TryFindNewGpuUpdaterWindowForProcess(session, process.Id, out _);

                    if (!alreadyObserved && !childOfObserved &&
                        !(newProcess && hasNewWindow && LooksLikeGpuUpdaterActivity(process)))
                    {
                        continue;
                    }

                    lock (session.StateLock) session.ObservedProcessIds.Add(process.Id);
                    observed.Add(process.Id);
                }
                catch { }
                finally { try { process.Dispose(); } catch { } }
            }

            lock (session.StateLock)
                session.ObservedProcessIds.RemoveWhere(pid => !IsGpuUpdaterProcessAlive(pid));
        }

        private void QueueGpuUpdaterProcessAdoption(GpuUpdaterSession session)
        {
            if (Interlocked.CompareExchange(ref session.ProcessAdoptionRunning, 1, 0) != 0) return;

            _ = Task.Run(() =>
            {
                try
                {
                    if (IsCurrentGpuUpdaterSession(session))
                        AdoptGpuUpdaterProcessChain(session);
                }
                finally
                {
                    Interlocked.Exchange(ref session.ProcessAdoptionRunning, 0);
                }
            });
        }

        private List<IntPtr> ObserveGpuUpdaterWindows(GpuUpdaterSession session)
        {
            var visible = new List<IntPtr>();
            try
            {
                EnumWindows((hwnd, _) =>
                {
                    try
                    {
                        if (!IsNewValidGpuUpdaterWindow(session, hwnd, out int pid)) return true;

                        bool firstObservation;
                        lock (session.StateLock)
                        {
                            firstObservation = session.ObservedWindowHandles.Add(hwnd);
                            session.ObservedProcessIds.Add(pid);
                        }

                        visible.Add(hwnd);
                        if (firstObservation && session.FirstWindowSeen)
                            FocusGpuUpdaterWindowOnce(session, hwnd);
                    }
                    catch { }
                    return true;
                }, IntPtr.Zero);
            }
            catch { }

            lock (session.StateLock)
                session.ObservedWindowHandles.RemoveWhere(hwnd => !visible.Contains(hwnd));
            return visible;
        }

        private bool IsNewValidGpuUpdaterWindow(GpuUpdaterSession session, IntPtr hwnd, out int pid)
        {
            pid = 0;
            if (session.BaselineWindowHandles.Contains(hwnd)) return false;
            if (!IsValidGpuUpdaterExternalWindow(hwnd, out pid)) return false;

            lock (session.StateLock)
            {
                if (session.ObservedProcessIds.Contains(pid)) return true;
            }

            if (session.BaselineProcessIds.Contains(pid)) return false;
            try
            {
                using Process process = Process.GetProcessById(pid);
                return ProcessStartedForGpuUpdater(process, session.StartedAtUtc);
            }
            catch { return false; }
        }

        private bool IsValidGpuUpdaterExternalWindow(IntPtr hwnd, out int pid)
        {
            pid = 0;
            try
            {
                if (hwnd == IntPtr.Zero || !IsWindow(hwnd) || !IsWindowVisible(hwnd) || IsIconic(hwnd) ||
                    hwnd == _mainWindowHandle || hwnd == GetShellWindow() || IsWindowCloaked(hwnd)) return false;
                if (_mainWindowHandle != IntPtr.Zero && IsChild(_mainWindowHandle, hwnd)) return false;
                if (!GetWindowRect(hwnd, out RECT rect) || rect.Width < 120 || rect.Height < 80) return false;

                GetWindowProcessId(hwnd, out uint pidRaw);
                pid = (int)pidRaw;
                if (pid <= 0 || pid == Environment.ProcessId) return false;

                using Process process = Process.GetProcessById(pid);
                if (process.HasExited) return false;
                string identity = $"{SafeProcessName(process)} {SafeProcessPath(process)}";
                return !identity.Contains("DoorpiInputBridge", StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        private bool TryFindNewGpuUpdaterWindowForProcess(GpuUpdaterSession session, int processId, out IntPtr hwnd)
        {
            IntPtr found = IntPtr.Zero;
            try
            {
                EnumWindows((candidate, _) =>
                {
                    if (IsNewValidGpuUpdaterWindow(session, candidate, out int pid) && pid == processId)
                    {
                        found = candidate;
                        return false;
                    }
                    return true;
                }, IntPtr.Zero);
            }
            catch { }
            hwnd = found;
            return hwnd != IntPtr.Zero;
        }

        private static bool ProcessStartedForGpuUpdater(Process process, DateTime launchedAtUtc)
        {
            if (launchedAtUtc == DateTime.MinValue) return true;
            try { return process.StartTime.ToUniversalTime() >= launchedAtUtc.AddSeconds(-3); }
            catch { return true; }
        }

        private bool LooksLikeGpuUpdaterActivity(Process process)
        {
            string name = SafeProcessName(process);
            string path = SafeProcessPath(process);
            string title = "";
            try
            {
                IntPtr hwnd = FindAnyWindowForProcess(process.Id);
                if (hwnd != IntPtr.Zero) title = GetWindowTitle(hwnd);
            }
            catch { }

            string text = $"{name} {path} {title}".ToLowerInvariant();
            if (text.Contains("doorpi")) return false;
            return text.Contains("nvidia") || text.Contains("nvclean") || text.Contains("geforce") ||
                   text.Contains("amd") || text.Contains("radeon") || text.Contains("adrenalin") ||
                   text.Contains("intel") || text.Contains("arc") || text.Contains("driver") ||
                   text.Contains("setup") || text.Contains("installer") || text.Contains("install") ||
                   text.Contains("update") || text.Contains("updat") || text.Contains("bootstrap") ||
                   text.Contains("extract") || text.Contains("7z") || text.Contains("msiexec");
        }

        private static bool IsGpuUpdaterProcessAlive(int pid)
        {
            try { using Process process = Process.GetProcessById(pid); return !process.HasExited; }
            catch { return false; }
        }

        private HashSet<int> CaptureGpuUpdaterProcessIds()
        {
            var ids = new HashSet<int>();
            foreach (Process process in Process.GetProcesses())
            {
                try { ids.Add(process.Id); }
                catch { }
                finally { try { process.Dispose(); } catch { } }
            }
            return ids;
        }

        private HashSet<IntPtr> CaptureGpuUpdaterWindowHandles()
        {
            var handles = new HashSet<IntPtr>();
            try
            {
                EnumWindows((hwnd, lParam) =>
                {
                    if (IsValidGpuUpdaterExternalWindow(hwnd, out int _)) handles.Add(hwnd);
                    return true;
                }, IntPtr.Zero);
            }
            catch { }
            return handles;
        }

        private void FocusGpuUpdaterWindowOnce(GpuUpdaterSession session, IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero) return;
            lock (session.StateLock)
            {
                if (!session.FocusedWindowHandles.Add(hwnd)) return;
            }

            Dispatcher.BeginInvoke(() =>
            {
                if (!IsCurrentGpuUpdaterSession(session)) return;
                if (!IsWindowVisible(hwnd)) return;
                ShowWindow(hwnd, 5);
                BringWindowToTop(hwnd);
                SetForegroundWindow(hwnd);
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
            });
        }

        private void StartGpuUpdaterInput(GpuUpdaterSession session, bool centerCursor)
        {
            if (!IsCurrentGpuUpdaterSession(session)) return;
            Dispatcher.Invoke(() =>
            {
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
                if (centerCursor) CenterCursorOnScreen();
            });

            if (session.InputActive && session.InputThread?.IsAlive == true) return;
            session.InputActive = true;

            session.InputThread = new Thread(() =>
                SharedGamepadControllerLoop(
                    () => session.InputActive && IsCurrentGpuUpdaterSession(session),
                    () => { },
                    handleXboxButton: false,
                    shouldAcceptInput: () => ShouldAcceptGpuUpdaterInput(session)))
            {
                IsBackground = true,
                Name = "Doorpi GPU updater input"
            };
            session.InputThread.Start();
        }

        private bool ShouldAcceptGpuUpdaterInput(GpuUpdaterSession session)
        {
            if (!session.FirstWindowSeen || !IsCurrentGpuUpdaterSession(session)) return false;

            if (session.SuppressInputUntilConfirmReleased)
            {
                bool confirmStillPressed =
                    XInputGetStateSecret(0, out var state) == 0 &&
                    (state.Gamepad.wButtons & 0x1000) != 0;
                if (confirmStillPressed) return false;

                session.SuppressInputUntilConfirmReleased = false;
                return false;
            }

            return GetForegroundWindow() != _mainWindowHandle;
        }

        private static bool HasLiveTrackedGpuUpdaterWindow(GpuUpdaterSession session)
        {
            lock (session.StateLock)
                return session.ObservedWindowHandles.Any(IsWindow);
        }

        private bool TryConfirmGpuDriverReplacement(
            GpuUpdaterSession session,
            IReadOnlyCollection<GpuAdapterInfo> currentAdapters,
            out string currentSignature)
        {
            if (TryGetChangedGpuDriverSignature(session, currentAdapters, out currentSignature))
                return true;

            foreach (GpuAdapterInfo initial in session.InitialAdapters.Where(adapter =>
                         !string.IsNullOrWhiteSpace(adapter.DriverVersion)))
            {
                string key = BuildGpuAdapterSessionKey(initial);
                GpuAdapterInfo? current = FindMatchingGpuAdapter(initial, currentAdapters);
                bool driverAvailable = current != null && !string.IsNullOrWhiteSpace(current.DriverVersion);

                if (!driverAvailable)
                {
                    int missingPolls = session.MissingDriverPollCounts.TryGetValue(key, out int count)
                        ? count + 1
                        : 1;
                    session.MissingDriverPollCounts[key] = missingPolls;
                    if (missingPolls >= 2)
                    {
                        if (session.RemovedDriverKeys.Add(key))
                            Debug.WriteLine("[GpuUpdate] Driver removido durante a sessao: " + key);
                    }
                    continue;
                }

                session.MissingDriverPollCounts[key] = 0;
                if (!session.RemovedDriverKeys.Contains(key)) continue;

                currentSignature = BuildGpuDriverSignature(currentAdapters);
                if (string.IsNullOrWhiteSpace(currentSignature))
                    currentSignature = $"reinstalled:{key}:{current!.DriverVersion}";
                Debug.WriteLine("[GpuUpdate] Driver reinstalado durante a sessao: " + currentSignature);
                return true;
            }

            currentSignature = "";
            return false;
        }

        private bool TryGetChangedGpuDriverSignature(
            GpuUpdaterSession session,
            IReadOnlyCollection<GpuAdapterInfo> currentAdapters,
            out string currentSignature)
        {
            currentSignature = "";
            if (session.InitialAdapters.Count == 0 || currentAdapters.Count == 0)
                return false;

            foreach (GpuAdapterInfo current in currentAdapters)
            {
                if (string.IsNullOrWhiteSpace(current.DriverVersion))
                    continue;

                GpuAdapterInfo? initial = session.InitialAdapters.FirstOrDefault(candidate =>
                    string.Equals(candidate.Vendor, current.Vendor, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(candidate.Name, current.Name, StringComparison.OrdinalIgnoreCase));

                if (initial == null)
                {
                    List<GpuAdapterInfo> sameVendor = session.InitialAdapters
                        .Where(candidate => string.Equals(candidate.Vendor, current.Vendor, StringComparison.OrdinalIgnoreCase))
                        .ToList();
                    if (sameVendor.Count == 1)
                        initial = sameVendor[0];
                }

                if (initial == null || string.IsNullOrWhiteSpace(initial.DriverVersion))
                    continue;
                if (string.Equals(initial.DriverVersion, current.DriverVersion, StringComparison.OrdinalIgnoreCase))
                    continue;

                currentSignature = BuildGpuDriverSignature(currentAdapters);
                return !string.IsNullOrWhiteSpace(currentSignature);
            }

            return false;
        }

        private static GpuAdapterInfo? FindMatchingGpuAdapter(
            GpuAdapterInfo initial,
            IReadOnlyCollection<GpuAdapterInfo> currentAdapters)
        {
            if (!string.IsNullOrWhiteSpace(initial.DeviceId))
            {
                GpuAdapterInfo? byDevice = currentAdapters.FirstOrDefault(candidate =>
                    string.Equals(candidate.Vendor, initial.Vendor, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(candidate.DeviceId, initial.DeviceId, StringComparison.OrdinalIgnoreCase));
                if (byDevice != null) return byDevice;
            }

            GpuAdapterInfo? byName = currentAdapters.FirstOrDefault(candidate =>
                string.Equals(candidate.Vendor, initial.Vendor, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(candidate.Name, initial.Name, StringComparison.OrdinalIgnoreCase));
            if (byName != null) return byName;

            List<GpuAdapterInfo> sameVendor = currentAdapters
                .Where(candidate => string.Equals(candidate.Vendor, initial.Vendor, StringComparison.OrdinalIgnoreCase))
                .ToList();
            return sameVendor.Count == 1 ? sameVendor[0] : null;
        }

        private static string BuildGpuAdapterSessionKey(GpuAdapterInfo adapter)
        {
            string identity = !string.IsNullOrWhiteSpace(adapter.DeviceId) ? adapter.DeviceId : adapter.Name;
            return $"{adapter.Vendor}:{identity}";
        }

        private static string BuildGpuDriverSignature(IEnumerable<GpuAdapterInfo> adapters)
        {
            return string.Join("|", adapters
                .Where(adapter => !string.IsNullOrWhiteSpace(adapter.DriverVersion))
                .Select(adapter => $"{adapter.Vendor}:{adapter.Name}:{adapter.DriverVersion}")
                .OrderBy(value => value, StringComparer.OrdinalIgnoreCase));
        }

        private bool IsCurrentGpuUpdaterSession(GpuUpdaterSession session)
        {
            lock (_gpuUpdaterSessionLock)
                return ReferenceEquals(_gpuUpdaterSession, session) && !session.Finished;
        }

        private bool IsGpuUpdaterSessionActive()
        {
            lock (_gpuUpdaterSessionLock)
                return _gpuUpdaterSession is { Finished: false };
        }

        private void ShowGpuUpdaterExecutionLock(
            GpuUpdaterSession? requestedSession = null,
            bool focusActions = false)
        {
            GpuUpdaterSession? session = requestedSession;
            if (session == null)
            {
                lock (_gpuUpdaterSessionLock)
                    session = _gpuUpdaterSession is { Finished: false } active ? active : null;
            }
            if (session == null || !IsCurrentGpuUpdaterSession(session)) return;

            void Show()
            {
                _executionLockActive = true;
                _executionLockKind = "gpuUpdater";
                _executionLockChannel = "gpu";
                _executionLockId = session.Path;
                _executionLockUrl = session.Path;
                _executionLockAppType = "gpuUpdater";

                webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "executionLock",
                    kind = "gpuUpdater",
                    name = session.Name,
                    id = session.Path,
                    url = session.Path,
                    channel = "gpu",
                    appType = "gpuUpdater",
                    heroImage = session.ImageUrl,
                    gridImage = session.ImageUrl,
                    focusActions
                }));
                SendRuntimeSessionsToUI();
            }

            if (Dispatcher.CheckAccess()) Show();
            else Dispatcher.Invoke(Show);
        }

        private void RestoreGpuUpdaterFromExecutionLock()
        {
            GpuUpdaterSession? session;
            lock (_gpuUpdaterSessionLock)
                session = _gpuUpdaterSession is { Finished: false } active ? active : null;
            if (session == null) return;

            IntPtr hwnd;
            lock (session.StateLock)
            {
                hwnd = session.ObservedWindowHandles.FirstOrDefault(candidate =>
                    IsWindow(candidate) && IsWindowVisible(candidate) && !IsIconic(candidate));
            }
            if (hwnd == IntPtr.Zero) return;

            // O mesmo A que aciona "Retomar" nao pode virar um clique na janela externa.
            session.SuppressInputUntilConfirmReleased = true;
            ShowWindow(hwnd, 5);
            BringWindowToTop(hwnd);
            SetForegroundWindow(hwnd);
            EnsureCursorVisible();
            _mainScreenMouseVisible = true;
            StartGpuUpdaterInput(session, centerCursor: false);
        }

        private void CloseGpuUpdaterFromExecutionLock()
        {
            GpuUpdaterSession? session;
            lock (_gpuUpdaterSessionLock)
                session = _gpuUpdaterSession is { Finished: false } active ? active : null;
            if (session == null) return;

            HashSet<int> processIds;
            bool waitingOnlyForGrace;
            lock (session.StateLock)
            {
                processIds = session.ObservedProcessIds
                    .Where(IsGpuUpdaterProcessAlive)
                    .ToHashSet();
                waitingOnlyForGrace =
                    session.NoTrackedWindowSinceUtc.HasValue &&
                    processIds.Count == 0 &&
                    !session.ObservedWindowHandles.Any(IsWindow);
            }

            EndGpuUpdaterSession(focusDoorpi: true, notifyUi: true);
            if (waitingOnlyForGrace) return;

            _ = Task.Run(() => TerminateStoreInstallerProcessIds(processIds, waitForExitMs: 800));
        }

        private object? BuildGpuUpdaterRuntimeSession()
        {
            GpuUpdaterSession? session;
            lock (_gpuUpdaterSessionLock)
                session = _gpuUpdaterSession is { Finished: false } active ? active : null;
            if (session == null) return null;

            return new
            {
                channel = "gpu",
                id = session.Path,
                url = session.Path,
                kind = "gpuUpdater",
                appType = "gpuUpdater",
                status = session.FirstWindowSeen ? "running" : "launching",
                name = session.Name,
                heroImage = session.ImageUrl,
                gridImage = session.ImageUrl
            };
        }

        private void FailGpuUpdaterSession(GpuUpdaterSession session, string reason)
        {
            if (!IsCurrentGpuUpdaterSession(session)) return;
            SendGameLaunchStatus("gameLaunchFailed", session.Name, session.ImageUrl, session.ImageUrl, reason);
            EndGpuUpdaterSession(focusDoorpi: true, notifyUi: false);
        }

        private void EndGpuUpdaterSession(bool focusDoorpi, bool notifyUi)
        {
            GpuUpdaterSession? session;
            lock (_gpuUpdaterSessionLock)
            {
                session = _gpuUpdaterSession;
                if (session == null || session.Finished) return;
                session.Finished = true;
                _gpuUpdaterSession = null;
            }

            session.InputActive = false;
            try { session.Cancellation.Cancel(); } catch { }
            try { StopElevatedInputBridge(); } catch { }
            try { session.LaunchedProcess?.Dispose(); } catch { }
            try { _desktopVkb?.Close(); } catch { }
            _desktopVkb = null;

            if (string.Equals(_executionLockKind, "gpuUpdater", StringComparison.OrdinalIgnoreCase))
                ClearExecutionLock();

            if (focusDoorpi)
            {
                Dispatcher.Invoke(() =>
                {
                    ResetCursorForMainScreen();
                    ForceFocus();
                });
            }

            if (notifyUi)
                SendGpuUpdaterEvent("gpuUpdaterSessionEnded", new
                {
                    driverChanged = !string.IsNullOrWhiteSpace(session.ConfirmedDriverSignature)
                });

            SendRuntimeSessionsToUI();

            try { session.Cancellation.Dispose(); } catch { }
        }

        private async Task RestartDoorpiAfterGpuUpdateAsync(GpuUpdaterSession session)
        {
            lock (session.StateLock)
            {
                if (session.DoorpiRestartStarted) return;
                session.DoorpiRestartStarted = true;
            }

            Debug.WriteLine("[GpuUpdate] Reinicio do Doorpi solicitado ao final da sessao.");

            var noticeRendered = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            _gpuRestartNoticeRendered = noticeRendered;
            await Dispatcher.InvokeAsync(() =>
            {
                ForceFocus();
                SendGpuUpdaterEvent("gpuUpdaterRestarting", new
                {
                    name = session.Name,
                    imageUrl = session.ImageUrl
                });
            });

            try
            {
                await Task.WhenAny(noticeRendered.Task, Task.Delay(1000, session.Cancellation.Token)).ConfigureAwait(false);
                await Task.Delay(1200, session.Cancellation.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException) { return; }
            finally { _gpuRestartNoticeRendered = null; }
            if (!IsCurrentGpuUpdaterSession(session)) return;

            await Dispatcher.InvokeAsync(() =>
            {
                session.InputActive = false;
                try { StopElevatedInputBridge(); } catch { }
                ReleaseAllStuckKeys();
                EndGpuUpdaterSession(focusDoorpi: false, notifyUi: false);
            });

            Task restartTask = await Dispatcher.InvokeAsync(RestartMainDomAfterGpuUpdateAsync);
            await restartTask.ConfigureAwait(false);
        }

        private void ConfirmGpuRestartNoticeRendered()
            => _gpuRestartNoticeRendered?.TrySetResult(true);

        private async Task RestartMainDomAfterGpuUpdateAsync()
        {
            if (webView?.Parent is not System.Windows.Controls.Panel parent)
                throw new InvalidOperationException("Container principal do WebView2 nao encontrado.");

            var oldWebView = webView;
            var gpuProcessIds = new HashSet<int>();
            try
            {
                gpuProcessIds = oldWebView.CoreWebView2.Environment
                    .GetProcessInfos()
                    .Where(info => info.Kind == Microsoft.Web.WebView2.Core.CoreWebView2ProcessKind.Gpu)
                    .Select(info => info.ProcessId)
                    .ToHashSet();
            }
            catch { }

            int index = parent.Children.IndexOf(oldWebView);
            if (index < 0) index = parent.Children.Count;
            parent.Children.Remove(oldWebView);
            try { oldWebView.Dispose(); } catch { }

            foreach (int processId in gpuProcessIds)
            {
                try
                {
                    using Process process = Process.GetProcessById(processId);
                    if (!process.HasExited) process.Kill(entireProcessTree: false);
                }
                catch { }
            }

            await Task.Delay(350);

            var replacement = new Microsoft.Web.WebView2.Wpf.WebView2
            {
                Name = "webView",
                DefaultBackgroundColor = System.Drawing.Color.Transparent
            };
            parent.Children.Insert(index, replacement);
            webView = replacement;
            StopWatchers();
            ResetCurrentUserContext();
            _interactiveUserSessionStarted = false;

            var options = new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions(
                "--autoplay-policy=no-user-gesture-required");
            var environment = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(null, null, options);
            await webView.EnsureCoreWebView2Async(environment);
            webView.CoreWebView2.Settings.AreHostObjectsAllowed = false;
            webView.CoreWebView2.PermissionRequested += OnWebViewPermissionRequested;
            webView.CoreWebView2.ProcessFailed += OnMainWebViewProcessFailed;

            string folderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "app.local", folderPath, Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind.Allow);
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "data.local", dataFolder, Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind.Allow);
            webView.CoreWebView2.WebMessageReceived += WebView_WebMessageReceived;
            webView.CoreWebView2.NavigationCompleted += (_, _) =>
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
                    Topmost = true;
                    Activate();
                    Topmost = false;
                    webView.Focus();
                    System.Windows.Input.Keyboard.Focus(webView);
                    EnsureCursorHidden();
                    _mainScreenMouseVisible = false;
                });
            };

            webView.CoreWebView2.Navigate("https://app.local/index.html");
        }

        private void OnMainWebViewProcessFailed(
            object? sender,
            Microsoft.Web.WebView2.Core.CoreWebView2ProcessFailedEventArgs e)
        {
            if (e.ProcessFailedKind ==
                Microsoft.Web.WebView2.Core.CoreWebView2ProcessFailedKind.GpuProcessExited)
            {
                Debug.WriteLine("[GpuUpdate] Processo GPU do WebView2 foi reiniciado pelo runtime.");
                return;
            }

            if (e.ProcessFailedKind is
                Microsoft.Web.WebView2.Core.CoreWebView2ProcessFailedKind.RenderProcessExited or
                Microsoft.Web.WebView2.Core.CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
            {
                Debug.WriteLine("[GpuUpdate] WebView2 degradado: " + e.ProcessFailedKind);
            }
        }

    }
}
