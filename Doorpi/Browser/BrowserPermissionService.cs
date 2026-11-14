using System;
using System.Threading;
using System.Threading.Tasks;

namespace Doorpi;

internal sealed record BrowserPermissionRequest(string UserId, string AppKey, string AppName, string Origin, BrowserPermissionResource Resource);

// Callbacks run on the caller's synchronization context. Device/Window/WebView
// objects stay in the adapter; persistence and request sequencing are testable here.
internal sealed class BrowserPermissionService
{
    private readonly BrowserPermissionStore _store;
    private readonly SemaphoreSlim _queue = new(1, 1);
    internal BrowserPermissionService(BrowserPermissionStore store) => _store = store;

    internal async Task<bool> DecideAsync(BrowserPermissionRequest request, Func<bool> isCurrent,
        Func<CancellationToken, Task<bool?>> prompt, CancellationToken cancellationToken)
    {
        await _queue.WaitAsync(cancellationToken);
        try
        {
            if (!isCurrent()) return false;
            var saved = await Task.Run(() => _store.Find(request.UserId, request.AppKey, request.Origin, request.Resource), cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            if (!isCurrent()) return false;
            if (saved != null) return saved.Allowed;
            bool? allowed = await prompt(cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            if (allowed == null || !isCurrent()) return false;
            await Task.Run(() => _store.Save(request.UserId, request.AppKey, request.AppName, request.Origin, request.Resource, allowed.Value), cancellationToken);
            return isCurrent() && !cancellationToken.IsCancellationRequested && allowed.Value;
        }
        finally { _queue.Release(); }
    }
}
