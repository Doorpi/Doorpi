using System;
using System.Threading.Tasks;
using System.Windows;
using System.Runtime.InteropServices;

namespace Doorpi;

public partial class App
{
    private async Task RunShellBootstrapAsync()
    {
        while (true)
        {
            var experience = new NativeBootExperience();
            bool retry = false;
            try
            {
                await experience.ShowPreparingAsync(false);
                await PrepareCompatibilityShellAsync();
                string executable = Environment.ProcessPath ?? throw new InvalidOperationException("Executable path unavailable.");
                await new BootSessionSupervisor(executable, experience,
                    introAlreadyPresented: Array.Exists(Environment.GetCommandLineArgs(), a => a == "--doorpi-resume-session")).RunAsync();
            }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("boot-supervisor-failed", ex.ToString());
                // Even a failed native prelude must leave the Windows desktop available.
                try { WindowsShellEnvironment.EnsureExplorerStarted(); }
                catch (Exception shellError) { DoorpiBootDiagnostics.Log("boot-desktop-fallback-failed", shellError.Message); }
                try { retry = await experience.RecoverAsync() == BootRecoveryChoice.Retry; } catch { }
            }
            finally
            {
                try { await experience.ReleasePresentationAsync(); }
                catch (Exception ex) { DoorpiBootDiagnostics.Log("boot-prelude-close-failed", ex.Message); }
            }
            if (retry) continue;
            Shutdown();
            return;
        }
    }

    private static async Task PrepareCompatibilityShellAsync()
    {
        using var phase = BootStartupTrace.Measure("explorer-compatibility");
        WindowsShellEnvironment.EnsureExplorerStarted();
        if (!await WindowsShellEnvironment.WaitUntilReadyAsync(TimeSpan.FromSeconds(35)))
        {
            DoorpiBootDiagnostics.Log("boot-shell-not-ready");
            throw new TimeoutException("Windows shell did not become ready.");
        }
        DoorpiBootDiagnostics.Log("boot-explorer-available", "graphicsReadiness=not-inferred");
    }

    private sealed class NativeBootExperience : IBootExperience
    {
        private BootIntroWindow? _window;
        public bool IsSessionAvailable => !DoorpiBootDiagnostics.IsWorkstationLocked();
        public void TransferForegroundTo(int processId)
        {
            bool allowed = AllowSetForegroundWindow((uint)processId);
            DoorpiBootDiagnostics.Log("boot-focus-transfer", $"pid={processId} allowed={allowed}");
        }
        [DllImport("user32.dll")] private static extern bool AllowSetForegroundWindow(uint processId);
        public async Task ShowPreparingAsync(bool recovering)
        {
            _window ??= BootIntroWindow.CreateOnDedicatedThread();
            await _window.ShowPreparingAsync(recovering);
        }
        public async Task ReleasePresentationAsync()
        {
            if (_window == null) return;
            var window = _window;
            _window = null;
            await window.FadeOutAndCloseAsync();
        }
        public async Task<BootRecoveryChoice> RecoverAsync()
        {
            _window ??= BootIntroWindow.CreateOnDedicatedThread();
            return await _window.ShowRecoveryAsync();
        }
    }
}
