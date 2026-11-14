using System;
using System.Threading.Tasks;
using System.Windows;
using System.Runtime.InteropServices;

namespace Doorpi;

public partial class App
{
    private async Task RunShellBootstrapAsync(bool prepareInChild = false)
    {
        while (true)
        {
            var experience = new NativeBootExperience(showPreparation: !prepareInChild);
            bool retry = false;
            try
            {
                if (!prepareInChild)
                {
                    await experience.ShowPreparingAsync(false);
                    await PrepareCompatibilityShellAsync();
                }
                string executable = Environment.ProcessPath ?? throw new InvalidOperationException("Executable path unavailable.");
                await new BootSessionSupervisor(executable, experience,
                    startupTimeout: prepareInChild ? TimeSpan.FromSeconds(125) : null,
                    introAlreadyPresented: Array.Exists(Environment.GetCommandLineArgs(), a => a == "--doorpi-resume-session"),
                    prepareInChild: prepareInChild).RunAsync();
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

    private sealed class NativeBootExperience(bool showPreparation = true) : IBootExperience
    {
        private BootIntroWindow? _window;
        public bool IsSessionAvailable => !DoorpiBootDiagnostics.IsWorkstationLocked();
        public void TransferForegroundTo(int processId)
        {
            if (!showPreparation) return; // The child already owns both presentation windows.
            bool allowed = AllowSetForegroundWindow((uint)processId);
            DoorpiBootDiagnostics.Log("boot-focus-transfer", $"pid={processId} allowed={allowed}");
        }
        [DllImport("user32.dll")] private static extern bool AllowSetForegroundWindow(uint processId);
        public async Task ShowPreparingAsync(bool recovering)
        {
            if (!showPreparation)
            {
                await ReleasePresentationAsync(); // Close a previous recovery before retry.
                return;
            }
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
            var choice = await _window.ShowRecoveryAsync();
            // A monitored child can fail before Explorer preparation (including
            // storage validation). Desktop must work in that case too.
            if (choice == BootRecoveryChoice.Desktop) WindowsShellEnvironment.EnsureExplorerStarted();
            return choice;
        }
    }
}
