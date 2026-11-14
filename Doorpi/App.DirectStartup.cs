using System;
using System.Diagnostics;
using System.Threading.Tasks;

namespace Doorpi;

public partial class App
{
    private async Task RunCoordinatedShellStartupAsync(string[] args)
    {
        var experience = new NativeBootExperience();
        bool monitored = BootSessionClient.IsManaged;
        string path = monitored ? "monitored-child" : "direct";
        var session = new InProcessBootSession(BootSessionClient.SkipIntro);
        BootSessionClient.InProcess = session;
        try
        {
            await experience.ShowPreparingAsync(false);
            if (!await PrepareApplicationStateAsync()) return;
            // Controlled comparison: same Explorer preparation as the current
            // bootstrap. Its availability is not a claim about Chromium's GPU.
            await PrepareCompatibilityShellAsync();
            var budget = new BootStartupBudget(TimeSpan.FromSeconds(90));
            CreateMainWindow();
            await budget.WaitAsync(session.Prepared, () => experience.IsSessionAvailable);
            await budget.WaitAsync(BootSessionClient.WaitForSupervisorPresentationAsync(), () => experience.IsSessionAvailable);
            await experience.ReleasePresentationAsync();
            session.Release();
            DoorpiBootDiagnostics.Log("boot-presentation-released", "path=" + path);
            await budget.WaitAsync(session.Ready, () => experience.IsSessionAvailable);
            DoorpiBootDiagnostics.Log("boot-interactive-ready", "path=" + path);
        }
        catch (Exception ex)
        {
            DoorpiBootDiagnostics.Log("boot-coordinated-failed", $"path={path} {ex}");
            if (MainWindow is Doorpi.MainWindow window) window.SuspendStartupForRecovery();
            if (monitored && BootSessionClient.RequestRestart())
            {
                Shutdown(1);
                return; // The external monitor owns retry budgets and recovery UI.
            }
            bool retry = false;
            try { retry = await experience.RecoverAsync() == BootRecoveryChoice.Retry; } catch { }
            if (retry)
            {
                var start = new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = false };
                start.ArgumentList.Add("--doorpi-shell-bootstrap");
                start.ArgumentList.Add(BootStartupSelection.ArgumentPrefix + "direct");
                start.ArgumentList.Add(BootProcessHandoff.ArgumentPrefix + Environment.ProcessId);
                if (session.Released || session.SkipIntro) start.ArgumentList.Add("--doorpi-resume-session");
                BootStartupTrace.ConfigureChild(start);
                try { Process.Start(start)?.Dispose(); }
                catch (Exception startError) { DoorpiBootDiagnostics.Log("boot-direct-retry-failed", startError.Message); }
            }
            else
            {
                try { WindowsShellEnvironment.EnsureExplorerStarted(); }
                catch (Exception shellError) { DoorpiBootDiagnostics.Log("boot-direct-desktop-failed", shellError.Message); }
            }
            Shutdown(1);
        }
        finally
        {
            try { await experience.ReleasePresentationAsync(); } catch { }
        }
    }
}
