using System.Diagnostics;
using Doorpi;
using System.Text.Json;

if (args.Contains("--doorpi-test-wait-target")) { await Task.Delay(700); return 0; }

if (args.Contains("--doorpi-main"))
{
    if (!BootSessionClient.IsManaged) return 20;
    string mode = Environment.GetEnvironmentVariable("DOORPI_TEST_MODE")!;
    if (mode == "crash") return 11;
    if (mode == "timeout") { await Task.Delay(15000); return 21; }
    if (mode == "slow-ready") await Task.Delay(700);
    BootSessionClient.PresentationPrepared();
    var wait = Stopwatch.StartNew();
    while (!BootSessionClient.IsPresentationReleased() && wait.Elapsed < TimeSpan.FromSeconds(5)) await Task.Delay(10);
    if (!BootSessionClient.IsPresentationReleased()) return 22;
    if (mode == "must-skip" && !BootSessionClient.SkipIntro) return 23;
    if (mode == "restart" && BootSessionClient.SkipIntro) return 24;
    BootSessionClient.InteractiveReady();
    if (mode == "instant-exit") return 0;
    await Task.Delay(150);
    if (mode == "restart") { BootSessionClient.RequestRestart(); await Task.Delay(15000); }
    if (mode == "detach") { _ = BootSessionClient.DetachForUpdateAsync(); await Task.Delay(100); }
    return 0;
}

void Assert(bool value, string name) { if (!value) throw new Exception(name); Console.WriteLine("PASS " + name); }
var fixture = Path.GetFullPath(Path.Combine("artifacts", "boot-startup-tests", Guid.NewGuid().ToString("N")));
Directory.CreateDirectory(fixture);
string experiment = Path.Combine(fixture, BootStartupSelection.FileName);
Assert(BootStartupSelection.Read(Array.Empty<string>(), experiment).Path == BootStartupPath.Supervised, "default remains supervised");
File.WriteAllText(experiment, "{\"schemaVersion\":1,\"path\":\"direct\"}");
Assert(BootStartupSelection.Read(Array.Empty<string>(), experiment).Path == BootStartupPath.Direct, "explicit experiment selects direct path");
Assert(BootStartupSelection.Read(new[] { "--doorpi-boot-path=supervised" }, experiment).Path == BootStartupPath.Supervised, "argument overrides experiment");
Assert(BootStartupSelection.Read(new[] { "--doorpi-boot-path=direct", "--doorpi-boot-path=supervised" }, experiment).Path == BootStartupPath.Supervised, "ambiguous arguments preserve supervised path");
foreach (var invalid in new[] { "{bad", "{}", "null", "{\"schemaVersion\":1e100,\"path\":\"direct\"}", "{\"schemaVersion\":2,\"path\":\"direct\"}" })
{
    File.WriteAllText(experiment, invalid);
    Assert(BootStartupSelection.Read(Array.Empty<string>(), experiment).Path == BootStartupPath.Supervised, "invalid experiment cannot silently remove bootstrap");
}
Assert(!BootStartupSelection.IsShellEntry(Array.Empty<string>(), true, true), "manual reopen stays ordinary");
Assert(BootStartupSelection.IsShellEntry(new[] { "--doorpi-shell-bootstrap" }, true, true), "legacy shell command retained");
Assert(!BootStartupSelection.IsShellEntry(new[] { "--doorpi-main", "--doorpi-boot-path=direct" }, true, false), "child cannot recursively enter experiment");
Assert(!BootStartupSelection.IsShellEntry(new[] { "--doorpi-webview-recovery" }, true, false), "recovery bypasses shell entry");
Assert(!BootStartupSelection.IsShellEntry(new[] { "--doorpi-boot-path=direct" }, false, false), "experiment does not enable immersive mode");

var local = new InProcessBootSession(false);
BootSessionClient.InProcess = local;
Assert(BootSessionClient.IsPresentationManaged && !BootSessionClient.IsManaged, "direct handoff is distinct from process supervision");
BootSessionClient.PresentationPrepared();
BootSessionClient.InteractiveReady();
Assert(local.Prepared.IsCompleted && !local.Ready.IsCompleted && !BootSessionClient.IsPresentationReleased(), "direct session requires native release before readiness");
local.Release(); BootSessionClient.InteractiveReady();
Assert(local.Ready.IsCompleted && BootSessionClient.IsPresentationReleased(), "same-process intro handoff completes");
BootSessionClient.InProcess = new(true);
Assert(BootSessionClient.SkipIntro, "direct resume skips repeated intro");
BootSessionClient.InProcess = null;

var paused = new BootStartupBudget(TimeSpan.FromMilliseconds(200));
await paused.WaitAsync(Task.Delay(450), () => false);
Assert(true, "direct readiness budget pauses while locked");
var sharedBudget = new BootStartupBudget(TimeSpan.FromMilliseconds(350));
await sharedBudget.WaitAsync(Task.Delay(150), () => true);
bool exhausted = false;
try { await sharedBudget.WaitAsync(Task.Delay(800), () => true); } catch (TimeoutException) { exhausted = true; }
Assert(exhausted, "presentation and ready share one direct startup budget");

Assert(!await BootProcessHandoff.WaitAsync(new[] { BootProcessHandoff.ArgumentPrefix + Environment.ProcessId }), "restart cannot wait on itself");
Assert(!await BootProcessHandoff.WaitAsync(new[] { BootProcessHandoff.ArgumentPrefix + "invalid" }), "invalid restart parent rejected");
using (var target = Process.Start(new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = false, ArgumentList = { "--doorpi-test-wait-target" } })!)
{
    Assert(await BootProcessHandoff.WaitAsync(new[] { BootProcessHandoff.ArgumentPrefix + target.Id }) && target.HasExited,
        "restart waits for same-executable process exit before mutex acquisition");
}

var latestProbe = new LatestStartupProbe();
int oldProbes = 0, failures = 0, successes = 0;
var obsolete = latestProbe.ScheduleAsync(150, () => { oldProbes++; return Task.FromResult(false); },
    _ => Task.CompletedTask, _ => { failures++; return Task.CompletedTask; });
await latestProbe.ScheduleAsync(0, () => Task.FromResult(true), _ => { successes++; return Task.CompletedTask; }, _ => Task.CompletedTask);
await obsolete;
Assert(oldProbes == 0 && failures == 0 && successes == 1, "new health watch supersedes old delayed watch");
var lateFailure = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
var inflight = latestProbe.ScheduleAsync(0, () => lateFailure.Task, _ => Task.CompletedTask, _ => { failures++; return Task.CompletedTask; });
await latestProbe.ScheduleAsync(0, () => Task.FromResult(true), _ => Task.CompletedTask, _ => Task.CompletedTask);
lateFailure.SetResult(false); await inflight;
Assert(failures == 0, "obsolete in-flight failure cannot request restart");
Func<bool>? deferredValidity = null;
await latestProbe.ScheduleAsync(0, () => Task.FromResult(false), _ => Task.CompletedTask, current => { deferredValidity = current; return Task.CompletedTask; });
await latestProbe.ScheduleAsync(0, () => Task.FromResult(true), _ => Task.CompletedTask, _ => Task.CompletedTask);
Assert(deferredValidity != null && !deferredValidity(), "queued UI recovery can recheck validity before acting");
await latestProbe.ScheduleAsync(0, () => Task.FromResult(true), current => { deferredValidity = current; return Task.CompletedTask; }, _ => Task.CompletedTask);
latestProbe.Cancel();
Assert(deferredValidity != null && !deferredValidity(), "recovery cancels pending health actions");
Assert(!BootLaunchPolicy.RequiresInProcessPreparation(true, false, true), "manual reopen with Explorer does not show shell preparation");
Assert(BootLaunchPolicy.RequiresInProcessPreparation(true, false, false), "direct legacy shell without Explorer still prepares Windows");
Assert(!BootLaunchPolicy.RequiresInProcessPreparation(true, true, false), "managed presentation does not create a second native prelude when Explorer disappears");
Assert(!BootLaunchPolicy.RequiresInProcessPreparation(false, false, false), "ordinary launch is not treated as immersive boot");
Assert(BootConfiguration.IsDoorpiShell(@"""C:\Apps\Doorpi.exe"" --doorpi-shell-bootstrap"), "recognize own shell");
Assert(!BootConfiguration.IsDoorpiShell("explorer.exe") && !BootConfiguration.IsDoorpiShell(@"""C:\Doorpi\Other.exe"""), "preserve unrelated shells");
using (var one = new BootSessionSignals())
using (var two = new BootSessionSignals())
{
    one.Ready.Set();
    Assert(one.Token != two.Token && !two.Ready.WaitOne(0), "attempts have isolated signals");
}

async Task<Experience> Run(string[] modes, int expectedAttempts, TimeSpan? timeout = null)
{
    var ui = new Experience(modes);
    await new BootSessionSupervisor(Environment.ProcessPath!, ui, timeout ?? TimeSpan.FromSeconds(10), TimeSpan.FromMilliseconds(15)).RunAsync();
    Assert(ui.Attempts == expectedAttempts, string.Join("/", modes) + " bounded attempts");
    return ui;
}
var healthy = await Run(new[] { "healthy" }, 1);
Assert(healthy.Releases == 1 && healthy.Recoveries == 0 && healthy.Transfers == 1 && healthy.TransferredBeforeRelease,
    "foreground handoff precedes native release and clean interactive exit");
await Run(new[] { "instant-exit" }, 1);
var failed = await Run(new[] { "crash" }, 3);
Assert(failed.Recoveries == 1, "three failures offer desktop recovery");
var timedOut = await Run(new[] { "timeout" }, 3, TimeSpan.FromMilliseconds(400));
Assert(timedOut.Recoveries == 1, "startup timeout is not success");
var recovered = await Run(new[] { "restart", "must-skip" }, 2);
Assert(recovered.Recoveries == 0, "supervised recovery skips already-presented intro");
var detached = await Run(new[] { "detach" }, 1);
Assert(detached.Recoveries == 0, "update detach does not restart the child");
var resumed = new Experience(new[] { "must-skip" });
await new BootSessionSupervisor(Environment.ProcessPath!, resumed, introAlreadyPresented: true).RunAsync();
Assert(resumed.Attempts == 1 && resumed.Recoveries == 0, "update resume skips intro in a fresh supervisor");
var locked = new Experience(new[] { "slow-ready" }) { PauseStartup = true };
await new BootSessionSupervisor(Environment.ProcessPath!, locked, TimeSpan.FromMilliseconds(400), TimeSpan.FromMilliseconds(15)).RunAsync();
Assert(locked.Attempts == 1 && locked.Recoveries == 0, "locked session does not exhaust startup timeout");
BootStartupTrace.Initialize(fixture, true);
BootStartupTrace.Record("test-event");
using (BootStartupTrace.Measure("fixture")) { await Task.Delay(10); }
await BootStartupTrace.FlushAsync();
var trace = Directory.GetFiles(fixture, "boot-trace-*.jsonl").Single();
var entries = File.ReadAllLines(trace).Select(line => JsonDocument.Parse(line)).ToArray();
Assert(entries.Length == 4 && entries.Select(entry => entry.RootElement.GetProperty("sequence").GetInt32()).SequenceEqual(new[] { 1, 2, 3, 4 }), "trace retains ordered records and phase timing");
Assert(entries.All(entry => entry.RootElement.GetProperty("runId").GetString() == BootStartupTrace.RunId), "trace has one correlation id");
foreach (var entry in entries) entry.Dispose();
Console.WriteLine("Boot process integration checks passed. No shell/registry configuration changed.");
return 0;

sealed class Experience(string[] modes) : IBootExperience
{
    internal int Attempts, Releases, Recoveries, Transfers;
    internal bool TransferredBeforeRelease;
    internal bool PauseStartup;
    private DateTime _pausedUntil;
    public bool IsSessionAvailable => !PauseStartup || DateTime.UtcNow >= _pausedUntil;
    public Task ShowPreparingAsync(bool recovering)
    {
        Environment.SetEnvironmentVariable("DOORPI_TEST_MODE", modes[Math.Min(Attempts++, modes.Length - 1)]);
        _pausedUntil = DateTime.UtcNow.AddSeconds(2);
        return Task.CompletedTask;
    }
    public void TransferForegroundTo(int processId) { Transfers++; }
    public Task ReleasePresentationAsync() { if (Releases == 0) TransferredBeforeRelease = Transfers > 0; Releases++; return Task.CompletedTask; }
    public Task<BootRecoveryChoice> RecoverAsync() { Recoveries++; return Task.FromResult(BootRecoveryChoice.Desktop); }
}

namespace Doorpi
{
    internal static class DoorpiBootDiagnostics
    {
        internal static void Log(string stage, string extra = "") => BootStartupTrace.Record(stage, extra);
    }
}
