using System;
using System.Threading;
using System.Windows;

namespace Doorpi;

internal sealed class BrowserPermissionContext
{
    internal BrowserPermissionContext(string userId, string appKey, string appName, bool canAsk, Window owner)
    {
        UserId = userId; AppKey = appKey; AppName = appName; CanAsk = canAsk;
        Owner = new WeakReference<Window>(owner);
    }
    internal string UserId { get; }
    internal string AppKey { get; }
    internal string AppName { get; }
    internal bool CanAsk { get; }
    internal WeakReference<Window> Owner { get; }
    internal bool Closed { get; private set; }
    internal long NavigationVersion { get; private set; }
    internal CancellationTokenSource Navigation { get; private set; } = new();
    internal void Navigating()
    {
        NavigationVersion++;
        Navigation.Cancel();
        Navigation.Dispose();
        Navigation = new();
    }
    internal void Close()
    {
        Closed = true;
        Navigation.Cancel();
    }
}
