using System;
using System.Diagnostics;
using System.Threading.Tasks;

namespace Doorpi;

// The same presentation/ready handshake without a second Doorpi process.
// This is startup coordination, not an out-of-process crash supervisor.
internal sealed class InProcessBootSession
{
    private readonly TaskCompletionSource _prepared = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource _ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
    internal Task Prepared => _prepared.Task;
    internal Task Ready => _ready.Task;
    internal bool Released { get; private set; }
    internal bool SkipIntro { get; }
    internal InProcessBootSession(bool skipIntro) => SkipIntro = skipIntro;
    internal void MarkPrepared() => _prepared.TrySetResult();
    internal void Release() => Released = true;
    internal void MarkReady() { if (Released) _ready.TrySetResult(); }
}

internal sealed class BootStartupBudget
{
    private readonly TimeSpan _limit;
    private TimeSpan _used;
    private readonly Stopwatch _interval = Stopwatch.StartNew();
    private bool _wasAvailable = true;
    internal BootStartupBudget(TimeSpan limit) => _limit = limit;
    internal async Task WaitAsync(Task milestone, Func<bool> sessionAvailable)
    {
        Account(sessionAvailable);
        while (!milestone.IsCompleted)
        {
            if (_used >= _limit) throw new TimeoutException("Doorpi startup did not confirm readiness.");
            await Task.Delay(100);
            Account(sessionAvailable);
        }
        await milestone;
    }
    private void Account(Func<bool> available)
    {
        if (_wasAvailable) _used += _interval.Elapsed;
        _interval.Restart();
        _wasAvailable = available();
    }
}
