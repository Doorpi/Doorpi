using Microsoft.Win32;
using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;

namespace Doorpi
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        private const string ShellBootstrapArg = "--doorpi-shell-bootstrap";
        private const string MainProcessArg = "--doorpi-main";
        private const string WebViewRecoveryArg = "--doorpi-webview-recovery";

        protected override void OnStartup(StartupEventArgs e)
        {
            DoorpiBootDiagnostics.CleanupReleaseLogs();
            DoorpiBootDiagnostics.Log("app-onstartup", $"args={string.Join(" ", e.Args)}");

            if (DoorpiBootDiagnostics.ShouldAbortCurrentSession(out string reason))
            {
                DoorpiBootDiagnostics.Log("app-abort", reason);
                Shutdown();
                return;
            }

            base.OnStartup(e);

            if (ShouldRunShellBootstrap(e.Args))
            {
                ShutdownMode = ShutdownMode.OnExplicitShutdown;
                _ = RunShellBootstrapAsync();
                return;
            }

            StartMainWindow();
        }

        private void StartMainWindow()
        {
            ShutdownMode = ShutdownMode.OnMainWindowClose;
            var window = new MainWindow();
            MainWindow = window;
            window.Show();
        }

        private static bool ShouldRunShellBootstrap(string[] args)
        {
            if (HasArg(args, MainProcessArg) || HasArg(args, WebViewRecoveryArg))
                return false;

            if (!IsConsoleShellConfigured())
                return false;

            if (HasArg(args, ShellBootstrapArg))
                return true;

            // Compatibility for users that still have the old shell value without
            // --doorpi-shell-bootstrap written in Winlogon.
            return !IsExplorerRunning();
        }

        private async Task RunShellBootstrapAsync()
        {
            BootIntroWindow? bootstrapWindow = null;
            try
            {
                DoorpiBootDiagnostics.Log("shell-bootstrap-start");
                bootstrapWindow = BootIntroWindow.CreateOnDedicatedThread();
                await bootstrapWindow.RunIntroAsync();

                EnsureExplorerStarted();
                bool shellReady = await WaitForExplorerShellReadyAsync(TimeSpan.FromSeconds(35));
                DoorpiBootDiagnostics.Log("shell-bootstrap-shell-ready", $"ready={shellReady}");

                var mainProcess = StartMainDoorpiProcess();
                if (mainProcess != null)
                    await WaitForMainDoorpiWindowAsync(mainProcess, TimeSpan.FromSeconds(24));

                if (bootstrapWindow != null)
                {
                    await bootstrapWindow.FadeOutAndCloseAsync();
                    bootstrapWindow = null;
                }

                DoorpiBootDiagnostics.Log("shell-bootstrap-complete");
            }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("shell-bootstrap-error", ex.ToString());
                try
                {
                    bootstrapWindow ??= BootIntroWindow.CreateOnDedicatedThread();
                    await bootstrapWindow.RunIntroAsync();
                    StartMainWindow();
                    return;
                }
                catch { }
            }

            Shutdown();
        }

        private static Process? StartMainDoorpiProcess()
        {
            try
            {
                string exe = Process.GetCurrentProcess().MainModule?.FileName ??
                    Environment.ProcessPath ??
                    "";
                if (string.IsNullOrWhiteSpace(exe))
                    return null;

                var process = Process.Start(new ProcessStartInfo
                {
                    FileName = exe,
                    Arguments = MainProcessArg,
                    UseShellExecute = true,
                    WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
                });
                DoorpiBootDiagnostics.Log("shell-bootstrap-main-started", $"pid={process?.Id ?? 0}");
                return process;
            }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("shell-bootstrap-main-start-error", ex.Message);
                return null;
            }
        }

        private static void EnsureExplorerStarted()
        {
            if (IsExplorerRunning())
            {
                DoorpiBootDiagnostics.Log("shell-bootstrap-explorer-skip", "already-running");
                return;
            }

            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    UseShellExecute = true
                });
                DoorpiBootDiagnostics.Log("shell-bootstrap-explorer-started");
            }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("shell-bootstrap-explorer-error", ex.Message);
            }
        }

        private static async Task<bool> WaitForExplorerShellReadyAsync(TimeSpan timeout)
        {
            var sw = Stopwatch.StartNew();
            var stable = Stopwatch.StartNew();
            bool wasReady = false;

            while (sw.Elapsed < timeout)
            {
                bool ready = IsExplorerRunning() && IsExplorerShellSurfaceReady() && TryFlushDwm();
                if (ready)
                {
                    if (!wasReady)
                    {
                        wasReady = true;
                        stable.Restart();
                    }
                    else if (stable.ElapsedMilliseconds >= 1600)
                    {
                        return true;
                    }
                }
                else
                {
                    wasReady = false;
                    stable.Restart();
                }

                await Task.Delay(100).ConfigureAwait(false);
            }

            return false;
        }

        private static async Task WaitForMainDoorpiWindowAsync(Process process, TimeSpan timeout)
        {
            var sw = Stopwatch.StartNew();
            while (sw.Elapsed < timeout)
            {
                try
                {
                    if (process.HasExited)
                        return;

                    process.Refresh();
                    if (process.MainWindowHandle != IntPtr.Zero)
                        return;
                }
                catch
                {
                    return;
                }

                await Task.Delay(100).ConfigureAwait(false);
            }
        }

        private static bool IsConsoleShellConfigured()
        {
            try
            {
                using var winlogonKey = Registry.CurrentUser.OpenSubKey(
                    @"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon");
                return winlogonKey?.GetValue("Shell") is string shell &&
                    shell.IndexOf("Doorpi", StringComparison.OrdinalIgnoreCase) >= 0;
            }
            catch
            {
                return false;
            }
        }

        private static bool IsExplorerRunning()
        {
            try { return Process.GetProcessesByName("explorer").Length > 0; }
            catch { return false; }
        }

        private static bool IsExplorerShellSurfaceReady()
        {
            try
            {
                if (FindWindow("Shell_TrayWnd", null) != IntPtr.Zero)
                    return true;

                return GetShellWindow() != IntPtr.Zero;
            }
            catch
            {
                return false;
            }
        }

        private static bool TryFlushDwm()
        {
            try { return DwmFlush() >= 0; }
            catch { return true; }
        }

        private static bool HasArg(string[] args, string expected)
            => args.Any(arg => string.Equals(arg, expected, StringComparison.OrdinalIgnoreCase));

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern IntPtr FindWindow(string? lpClassName, string? lpWindowName);

        [DllImport("user32.dll")]
        private static extern IntPtr GetShellWindow();

        [DllImport("dwmapi.dll", PreserveSig = true)]
        private static extern int DwmFlush();
    }
}
