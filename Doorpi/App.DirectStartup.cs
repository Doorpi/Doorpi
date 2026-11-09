using System;
using System.Diagnostics;
using System.Threading.Tasks;

namespace Doorpi;

public partial class App
{
    private async Task RunDirectShellStartupAsync(string[] args)
    {
        var experience = new NativeBootExperience();
        var session = new InProcessBootSession(Array.Exists(args, arg => arg.Equals("--doorpi-resume-session", StringComparison.OrdinalIgnoreCase)));
        BootSessionClient.InProcess = session;
        try
        {
            await experience.ShowPreparingAsync(false);
            // Controlled comparison: same Explorer preparation as the current
            // bootstrap. Its availability is not a claim about Chromium's GPU.
            await PrepareCompatibilityShellAsync();
            var budget = new BootStartupBudget(TimeSpan.FromSeconds(90));
            CreateMainWindow();
            await budget.WaitAsync(session.Prepared, () => experience.IsSessionAvailable);
            await experience.ReleasePresentationAsync();
            session.Release();
            DoorpiBootDiagnostics.Log("boot-presentation-released", "path=direct");
            await budget.WaitAsync(session.Ready, () => experience.IsSessionAvailable);
            DoorpiBootDiagnostics.Log("boot-interactive-ready", "path=direct");
        }
        catch (Exception ex)
        {
            DoorpiBootDiagnostics.Log("boot-direct-failed", ex.ToString());
            if (MainWindow is Doorpi.MainWindow window) window.SuspendStartupForRecovery();
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
