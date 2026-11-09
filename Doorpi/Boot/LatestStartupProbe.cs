using System;
using System.Threading;
using System.Threading.Tasks;

namespace Doorpi;

internal sealed class LatestStartupProbe
{
    private long _generation;
    internal void Cancel() => Interlocked.Increment(ref _generation);
    internal async Task ScheduleAsync(int delayMs, Func<Task<bool>> probe,
        Func<Func<bool>, Task> healthy, Func<Func<bool>, Task> failed)
    {
        long generation = Interlocked.Increment(ref _generation);
        bool Current() => generation == Interlocked.Read(ref _generation);
        await Task.Delay(Math.Max(0, delayMs)).ConfigureAwait(false);
        if (!Current()) return;
        bool result = await probe().ConfigureAwait(false);
        if (!Current()) return;
        await (result ? healthy(Current) : failed(Current)).ConfigureAwait(false);
    }
}
