namespace Doorpi;

internal enum BrowserPermissionAppKind { Internal, Streaming, RegisteredApp, Browser, Utility }

internal static class BrowserPermissionPolicy
{
    internal static BrowserPermissionAppKind Classify(bool utility, bool genericBrowser, bool integratedStreaming, bool registered)
        => utility ? BrowserPermissionAppKind.Utility
        : genericBrowser ? BrowserPermissionAppKind.Browser
        : integratedStreaming ? BrowserPermissionAppKind.Streaming
        : registered ? BrowserPermissionAppKind.RegisteredApp
        : BrowserPermissionAppKind.Internal;

    internal static bool CanAsk(BrowserPermissionAppKind kind)
        => kind is BrowserPermissionAppKind.RegisteredApp or BrowserPermissionAppKind.Browser;
}
