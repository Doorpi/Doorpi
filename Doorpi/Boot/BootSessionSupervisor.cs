using System;
using System.Diagnostics;
using System.Threading.Tasks;

namespace Doorpi;

internal enum BootRecoveryChoice { Retry, Desktop }
internal interface IBootExperience
{
    bool IsSessionAvailable => true;
    Task ShowPreparingAsync(bool recovering);
    Task ReleasePresentationAsync();
    void TransferForegroundTo(int processId) { }
    Task<BootRecoveryChoice> RecoverAsync();
}

// The supervisor owns only the Doorpi child. Never terminate an entire process
// tree: a game's lifetime must not be tied to the shell UI's lifetime.
internal sealed class BootSessionSupervisor
{
    private readonly string _executable;
    private readonly IBootExperience _experience;
    private readonly TimeSpan _startupTimeout;
    private readonly TimeSpan _pollInterval;
    private readonly bool _introAlreadyPresented;
    internal BootSessionSupervisor(string executable, IBootExperience experience,
        TimeSpan? startupTimeout = null, TimeSpan? pollInterval = null, bool introAlreadyPresented = false)
    {
        _executable = executable; _experience = experience;
        _startupTimeout = startupTimeout ?? TimeSpan.FromSeconds(90);
        _pollInterval = pollInterval ?? TimeSpan.FromMilliseconds(250);
        _introAlreadyPresented = introAlreadyPresented;
    }

    internal async Task RunAsync()
    {
        int failures = 0;
        bool introPresented = _introAlreadyPresented;
        while (true)
        {
            await _experience.ShowPreparingAsync(failures > 0 || introPresented);
            try
            {
                using var signals = new BootSessionSignals();
                var start = new ProcessStartInfo(_executable)
                {
                    UseShellExecute = false,
                    WorkingDirectory = System.IO.Path.GetDirectoryName(_executable)!
                };
                start.ArgumentList.Add("--doorpi-main");
                signals.Configure(start, introPresented);
                using var child = Process.Start(start) ?? throw new InvalidOperationException("Doorpi process did not start.");
                try
                {
                    DoorpiBootDiagnostics.Log("boot-child-started", $"pid={child.Id} attempt={failures + 1}");
                    var elapsed = Stopwatch.StartNew();
                    bool ready = false, released = false;
                    while (true)
                    {
                        // The main UI deliberately waits for unlock. Time spent on
                        // the secure desktop is not a failed startup attempt.
                        if (_experience.IsSessionAvailable) elapsed.Start();
                        else elapsed.Stop();
                        if (signals.Detach.WaitOne(0))
                        {
                            DoorpiBootDiagnostics.Log("boot-supervisor-detached", "update-handoff");
                            await _experience.ReleasePresentationAsync();
                            return;
                        }
                        if (signals.Restart.WaitOne(0))
                        {
                            await StopOwnedChildAsync(child);
                            throw new InvalidOperationException("Interface requested recovery.");
                        }
                        // Consume readiness before exit status: a user may close the
                        // now-interactive setup between two supervisor samples.
                        if (!ready && released && signals.Ready.WaitOne(0))
                        {
                            ready = true;
                            DoorpiBootDiagnostics.Log("boot-interactive-ready", $"pid={child.Id} elapsedMs={elapsed.ElapsedMilliseconds}");
                            BootStartupTrace.RecordProcess(Environment.ProcessId, "DoorpiSupervisor");
                        }
                        if (child.HasExited)
                        {
                            if (ready && child.ExitCode == 0) return; // Deliberate exit/shutdown.
                            throw new InvalidOperationException($"Doorpi exited before handoff or with code {child.ExitCode}.");
                        }
                        if (!released && signals.Presentation.WaitOne(0))
                        {
                            _experience.TransferForegroundTo(child.Id);
                            await _experience.ReleasePresentationAsync();
                            signals.Released.Set();
                            released = true;
                            introPresented = true;
                            DoorpiBootDiagnostics.Log("boot-presentation-released");
                        }
                        if (!ready && elapsed.Elapsed >= _startupTimeout)
                        {
                            await StopOwnedChildAsync(child);
                            throw new TimeoutException("Doorpi did not confirm an interactive interface.");
                        }
                        // Reset the crash budget only after a sustained healthy session.
                        if (ready && elapsed.Elapsed >= TimeSpan.FromMinutes(2)) failures = 0;
                        await Task.Delay(_pollInterval);
                    }
                }
                catch
                {
                    await StopOwnedChildAsync(child);
                    throw;
                }
            }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("boot-attempt-failed", ex.ToString());
                failures++;
                if (failures < 3)
                {
                    await Task.Delay(TimeSpan.FromSeconds(failures));
                    continue;
                }
                if (await _experience.RecoverAsync() == BootRecoveryChoice.Desktop) return;
                failures = 0; // Explicit user retry opens a new bounded budget.
            }
        }
    }

    private static async Task StopOwnedChildAsync(Process child)
    {
        if (child.HasExited) return;
        child.Kill(entireProcessTree: false);
        await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10));
    }
}
