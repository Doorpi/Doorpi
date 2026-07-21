using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Input;

namespace Doorpi
{
    public partial class MainWindow
    {
        private sealed class DoorpiFileExplorerLaunchSession
        {
            public Process? RootProcess { get; init; }
            public string RequestedPath { get; init; } = "";
            public string ExecutablePath { get; set; } = "";
            public string ExecutableName { get; set; } = "";
            public string RootDirectory { get; set; } = "";
            public HashSet<int> BaselineProcessIds { get; init; } = new();
            public HashSet<int> ProcessIds { get; } = new();
            public CancellationTokenSource Cancellation { get; } = new();
            public DateTime StartedUtc { get; init; } = DateTime.UtcNow;
            public int EmptyChecks { get; set; }
            public int Closing;
        }

        private static readonly HashSet<string> DoorpiFileExplorerExecutableExtensions = new(
            new[]
            {
                ".exe", ".msi", ".msix", ".msixbundle", ".appx", ".appxbundle",
                ".bat", ".cmd", ".com", ".lnk"
            },
            StringComparer.OrdinalIgnoreCase);

        private readonly object _doorpiFileExplorerLaunchLock = new();
        private DoorpiFileExplorerLaunchSession? _doorpiFileExplorerLaunchSession;

        private bool IsDoorpiFileExplorerLaunchActive()
        {
            lock (_doorpiFileExplorerLaunchLock)
                return _doorpiFileExplorerLaunchSession != null;
        }

        private async Task<string> LaunchDoorpiExternalFileAsync(string requestedPath)
        {
            string path = Path.GetFullPath(requestedPath);
            if (!File.Exists(path))
                throw new FileNotFoundException("O arquivo não está mais disponível.", path);
            if (!DoorpiFileExplorerExecutableExtensions.Contains(Path.GetExtension(path)))
                throw new NotSupportedException("Este tipo de arquivo ainda não pode ser executado pelo explorador.");

            lock (_doorpiFileExplorerLaunchLock)
            {
                if (_doorpiFileExplorerLaunchSession != null)
                    throw new InvalidOperationException("Encerre a tarefa aberta pelo explorador antes de iniciar outra.");
            }

            HashSet<int> baseline = SnapshotProcessIds();
            bool bridgeReady = await StartElevatedInputBridgeAsync();
            if (!bridgeReady)
                throw new InvalidOperationException("Autorize o Doorpi InputBridge para controlar este instalador.");

            Process? process;
            try
            {
                process = Process.Start(new ProcessStartInfo
                {
                    FileName = path,
                    UseShellExecute = true,
                    WorkingDirectory = Path.GetDirectoryName(path) ?? "",
                    WindowStyle = ProcessWindowStyle.Normal,
                    ErrorDialog = true
                });
            }
            catch
            {
                StopElevatedInputBridge();
                throw;
            }

            if (process == null)
            {
                StopElevatedInputBridge();
                throw new InvalidOperationException("O Windows não iniciou este arquivo.");
            }

            var session = new DoorpiFileExplorerLaunchSession
            {
                RootProcess = process,
                RequestedPath = path,
                ExecutablePath = path,
                ExecutableName = Path.GetFileNameWithoutExtension(path),
                RootDirectory = Path.GetDirectoryName(path) ?? "",
                BaselineProcessIds = baseline
            };
            try
            {
                session.ProcessIds.Add(process.Id);
                string actualPath = SafeProcessPath(process);
                if (!string.IsNullOrWhiteSpace(actualPath))
                {
                    session.ExecutablePath = actualPath;
                    session.ExecutableName = Path.GetFileNameWithoutExtension(actualPath);
                    session.RootDirectory = Path.GetDirectoryName(actualPath) ?? session.RootDirectory;
                }
            }
            catch { }

            lock (_doorpiFileExplorerLaunchLock)
                _doorpiFileExplorerLaunchSession = session;
            return path;
        }

        private void BeginDoorpiExternalFileControlMode()
        {
            DoorpiFileExplorerLaunchSession? session;
            lock (_doorpiFileExplorerLaunchLock)
                session = _doorpiFileExplorerLaunchSession;
            if (session == null) return;

            EnterDesktopMode();
            _ = MonitorDoorpiFileExplorerLaunchAsync(session);
        }

        private async Task MonitorDoorpiFileExplorerLaunchAsync(DoorpiFileExplorerLaunchSession session)
        {
            try
            {
                while (!session.Cancellation.IsCancellationRequested)
                {
                    await Task.Delay(350, session.Cancellation.Token).ConfigureAwait(false);
                    ExpandDoorpiFileExplorerProcessGroup(session);

                    if ((DateTime.UtcNow - session.StartedUtc).TotalSeconds < 2)
                        continue;

                    bool anyAlive = SnapshotAliveDoorpiFileExplorerProcesses(session).Count > 0;
                    session.EmptyChecks = anyAlive ? 0 : session.EmptyChecks + 1;
                    if (session.EmptyChecks >= 3)
                    {
                        RequestCloseDoorpiFileExplorerLaunch(killProcesses: false);
                        return;
                    }
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                Debug.WriteLine("[FileExplorerLaunch] Monitor falhou: " + ex.Message);
            }
        }

        private void ExpandDoorpiFileExplorerProcessGroup(DoorpiFileExplorerLaunchSession session)
        {
            Dictionary<int, int> parentIds = SnapshotParentProcessIds();
            HashSet<int> group;
            lock (session.ProcessIds)
                group = new HashSet<int>(session.ProcessIds);

            Process[] processes;
            try { processes = Process.GetProcesses(); }
            catch { return; }

            foreach (Process process in processes)
            {
                try
                {
                    int pid = process.Id;
                    if (pid == Environment.ProcessId || group.Contains(pid)) continue;

                    bool descendant = HasAncestorInGroup(pid, parentIds, group);
                    bool relatedNewProcess = !session.BaselineProcessIds.Contains(pid) &&
                        IsDoorpiFileExplorerRelatedProcess(process, session);
                    if (!descendant && !relatedNewProcess) continue;

                    lock (session.ProcessIds)
                        session.ProcessIds.Add(pid);
                    group.Add(pid);
                }
                catch { }
                finally
                {
                    try { process.Dispose(); } catch { }
                }
            }
        }

        private static bool IsDoorpiFileExplorerRelatedProcess(
            Process process,
            DoorpiFileExplorerLaunchSession session)
        {
            try
            {
                string processPath = SafeProcessPath(process);
                if (!string.IsNullOrWhiteSpace(processPath))
                {
                    if (PathsEqual(processPath, session.ExecutablePath)) return true;
                }

                return !string.IsNullOrWhiteSpace(session.ExecutableName) &&
                       string.Equals(
                           SafeProcessName(process),
                           session.ExecutableName,
                           StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        private static List<Process> SnapshotAliveDoorpiFileExplorerProcesses(
            DoorpiFileExplorerLaunchSession session)
        {
            int[] ids;
            lock (session.ProcessIds)
                ids = session.ProcessIds.ToArray();

            var result = new List<Process>();
            foreach (int pid in ids)
            {
                if (pid == Environment.ProcessId || session.BaselineProcessIds.Contains(pid)) continue;
                try
                {
                    var process = Process.GetProcessById(pid);
                    if (!process.HasExited) result.Add(process);
                    else process.Dispose();
                }
                catch { }
            }
            return result;
        }

        private bool RequestCloseDoorpiFileExplorerLaunch(bool killProcesses = true)
        {
            DoorpiFileExplorerLaunchSession? session;
            lock (_doorpiFileExplorerLaunchLock)
                session = _doorpiFileExplorerLaunchSession;
            if (session == null || Interlocked.Exchange(ref session.Closing, 1) == 1)
                return session != null;

            _systemControllerActive = false;
            try { session.Cancellation.Cancel(); } catch { }
            Dispatcher.BeginInvoke(() =>
            {
                try { _desktopVkb?.Close(); } catch { }
                _desktopVkb = null;
            });
            FocusDoorpiKeepSession();
            _ = Dispatcher.BeginInvoke(async () =>
            {
                try
                {
                    webView?.Focus();
                    Keyboard.Focus(webView);
                    if (webView?.CoreWebView2 != null)
                        await webView.CoreWebView2.ExecuteScriptAsync(
                            "window.DoorpiFileBrowser?.restoreFocus?.();");
                }
                catch { }
            }, System.Windows.Threading.DispatcherPriority.ContextIdle);

            _ = Task.Run(() =>
            {
                try
                {
                    if (killProcesses)
                        KillDoorpiFileExplorerProcessGroup(session);
                }
                finally
                {
                    StopElevatedInputBridge(gracefulTimeoutMilliseconds: 1500);
                    try { session.RootProcess?.Dispose(); } catch { }
                    try { session.Cancellation.Dispose(); } catch { }
                    lock (_doorpiFileExplorerLaunchLock)
                    {
                        if (ReferenceEquals(_doorpiFileExplorerLaunchSession, session))
                            _doorpiFileExplorerLaunchSession = null;
                    }
                }
            });
            return true;
        }

        private void KillDoorpiFileExplorerProcessGroup(DoorpiFileExplorerLaunchSession session)
        {
            ExpandDoorpiFileExplorerProcessGroup(session);
            var processes = SnapshotAliveDoorpiFileExplorerProcesses(session);
            foreach (Process process in processes)
            {
                try
                {
                    string name = SafeProcessName(process);
                    if (string.Equals(name, "Doorpi", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(name, "DoorpiInputBridge", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(name, "explorer", StringComparison.OrdinalIgnoreCase))
                        continue;
                    TrySendElevatedTerminateProcess(process.Id);
                }
                catch { }
            }
            foreach (Process process in processes)
            {
                try
                {
                    string name = SafeProcessName(process);
                    if (string.Equals(name, "Doorpi", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(name, "DoorpiInputBridge", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(name, "explorer", StringComparison.OrdinalIgnoreCase))
                        continue;
                    process.Kill(entireProcessTree: true);
                }
                catch { }
                finally { try { process.Dispose(); } catch { } }
            }
        }
    }
}
