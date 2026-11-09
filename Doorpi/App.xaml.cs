using System;
using System.Linq;
using System.Diagnostics;
using System.Threading;
using System.Windows;
using System.IO;
using System.Threading.Tasks;

namespace Doorpi
{
    public partial class App : Application
    {
        private Mutex? _instance;
        protected override void OnStartup(StartupEventArgs e)
        {
            LocalTestMode.Configure();
            DoorpiBootDiagnostics.CleanupReleaseLogs();
            DoorpiBootDiagnostics.Log("app-onstartup");
            if (DoorpiBootDiagnostics.ShouldAbortCurrentSession(out string reason))
            {
                DoorpiBootDiagnostics.Log("app-abort", reason);
                Shutdown();
                return;
            }
            base.OnStartup(e);
            ShutdownMode = ShutdownMode.OnExplicitShutdown;
            _ = StartApplicationAsync(e.Args);
        }

        private async Task StartApplicationAsync(string[] args)
        {
            try { await StartApplicationCoreAsync(args); }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("startup-orchestration-failed", ex.ToString());
                try { if (BootConfiguration.IsConfigured) WindowsShellEnvironment.EnsureExplorerStarted(); } catch { }
                MessageBox.Show("O Doorpi não iniciou para preservar os dados.\n\n" + ex.Message,
                    "Doorpi — recuperação", MessageBoxButton.OK, MessageBoxImage.Error);
                Shutdown(1);
            }
        }

        private async Task StartApplicationCoreAsync(string[] args)
        {
            bool shellEntry = !LocalTestMode.Enabled && BootStartupSelection.IsShellEntry(args, BootConfiguration.IsConfigured, WindowsShellEnvironment.IsExplorerRunning());
            var selection = shellEntry
                ? BootStartupSelection.Read(args, Path.Combine(DoorpiPaths.DataFolder, BootStartupSelection.FileName))
                : new BootStartupSelection(BootStartupPath.Supervised, "ordinary");
            BootStartupTrace.Initialize(DoorpiPaths.LogsFolder, selection.Source is "argument" or "experiment" ||
                args.Any(arg => arg.Equals("--doorpi-boot-trace", StringComparison.OrdinalIgnoreCase)));
            DoorpiBootDiagnostics.Log("startup-route", $"shellEntry={shellEntry} path={selection.Path} source={selection.Source} issue={selection.Issue}");
            if (!await BootProcessHandoff.WaitAsync(args))
            {
                DoorpiBootDiagnostics.Log("startup-parent-handoff-failed");
                Shutdown(1);
                return;
            }
            bool bootstrap = shellEntry && selection.Path == BootStartupPath.Supervised;
            _instance = new Mutex(false, $@"Local\Doorpi.{(LocalTestMode.Enabled ? "LocalTest" : bootstrap ? "Supervisor" : "Main")}.{Process.GetCurrentProcess().SessionId}");
            bool acquired;
            try { acquired = _instance.WaitOne(0); }
            catch (AbandonedMutexException) { acquired = true; }
            if (!acquired) { _instance.Dispose(); _instance = null; Shutdown(); return; }
            if (HandoffInterruptedUpdate()) return;
            // Import and integrity checks complete before any UI reports startup health.
            await Task.Run(() => Doorpi.Storage.StateStorage.Initialize(DoorpiPaths.AppDataFolder));
            if (shellEntry && selection.Path == BootStartupPath.Direct)
            {
                await RunDirectShellStartupAsync(args);
                return;
            }
            if (bootstrap)
            {
                ShutdownMode = ShutdownMode.OnExplicitShutdown;
                _ = RunShellBootstrapAsync();
                return;
            }
            try
            {
                CreateMainWindow();
            }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("main-window-start-failed", ex.ToString());
                Shutdown(1);
            }
        }

        protected override void OnExit(ExitEventArgs e)
        {
            try { BootStartupTrace.FlushAsync().Wait(TimeSpan.FromMilliseconds(500)); } catch { }
            if (_instance != null) { _instance.ReleaseMutex(); _instance.Dispose(); }
            base.OnExit(e);
        }

        private void CreateMainWindow()
        {
            MainWindow = new MainWindow();
            if (LocalTestMode.Enabled) MainWindow.Title = "Doorpi — TESTE SQLITE ISOLADO";
            ShutdownMode = ShutdownMode.OnMainWindowClose;
            MainWindow.Show();
        }

        private bool HandoffInterruptedUpdate()
        {
            var state = new Doorpi.UpdateCore.UpdateStateStore(
                Path.Combine(DoorpiPaths.AppDataFolder, "updates", "state.json")).Load();
            string signal = Environment.GetEnvironmentVariable("DOORPI_UPDATE_HEALTH_SIGNAL") ?? "";
            if (!Doorpi.UpdateCore.UpdateStartupPolicy.IsRecoveryRequired(state, signal)) return false;
            string folder = AppContext.BaseDirectory;
            string updater = Path.Combine(folder, "Updater", "Updater.exe");
            if (!System.IO.File.Exists(updater)) updater = Path.Combine(folder, "Updater.exe");
            if (!System.IO.File.Exists(updater))
                throw new InvalidDataException("Uma atualização foi interrompida. O atualizador compatível precisa restaurar os dados antes de iniciar.");
            var start = new ProcessStartInfo(updater)
            {
                WorkingDirectory = Path.GetDirectoryName(updater)!, UseShellExecute = false, CreateNoWindow = true
            };
            start.ArgumentList.Add("--mode"); start.ArgumentList.Add("update-doorpi");
            start.ArgumentList.Add("--parent-pid"); start.ArgumentList.Add(Environment.ProcessId.ToString());
            start.ArgumentList.Add("--install-folder"); start.ArgumentList.Add(folder);
            start.Environment.Remove("DOORPI_UPDATE_HEALTH_SIGNAL");
            Process.Start(start)?.Dispose();
            DoorpiBootDiagnostics.Log("storage-recovery-handoff", state?.OperationId ?? "");
            Shutdown();
            return true;
        }
    }
}
