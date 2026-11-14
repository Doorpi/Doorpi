using Microsoft.Web.WebView2.Core;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;

namespace Doorpi;

public partial class MainWindow
{
    private readonly ConditionalWeakTable<CoreWebView2, BrowserPermissionContext> _webPermissionContexts = new();
    private readonly List<WeakReference<BrowserPermissionContext>> _webPermissionOwners = new();
    private BrowserPermissionStore? _webPermissions;
    private BrowserPermissionStore WebPermissions => _webPermissions ??= new(Path.Combine(DoorpiPaths.DataFolder, "web-permissions.json"));
    private BrowserPermissionService? _webPermissionService;
    private BrowserPermissionService WebPermissionService => _webPermissionService ??= new(WebPermissions);

    private BrowserPermissionContext CreateMediaPermissionContext(MediaWebViewProfileIdentity profile, string name, bool genericBrowser, bool utility)
    {
        bool integratedStreaming = _nativeApps.Any(app => app.Id != DoorpiBrowserAppId && app.Id == profile.AppKey);
        bool registered = LoadMediaApps().Any(app => GetMediaAppKey(app) == profile.AppKey);
        var kind = BrowserPermissionPolicy.Classify(utility, genericBrowser, integratedStreaming, registered);
        return new BrowserPermissionContext(currentUserId, profile.AppKey,
            string.IsNullOrWhiteSpace(name) ? profile.AppKey : name,
            BrowserPermissionPolicy.CanAsk(kind), _webAppWindow ?? this);
    }

    private BrowserPermissionContext? CloneWebPermissionContext(CoreWebView2? parent, Window owner)
        => parent != null && _webPermissionContexts.TryGetValue(parent, out var context)
            ? new(context.UserId, context.AppKey, context.AppName, context.CanAsk, owner) : null;

    private async Task ConfigureWebPermissionsAsync(CoreWebView2 core, BrowserPermissionContext? context = null)
    {
        core.PermissionRequested -= OnWebViewPermissionRequested;
        core.PermissionRequested += OnWebViewPermissionRequested;
        // The home has never used Doorpi's permission store. Keep new profile
        // inspection and persistence work off its startup path.
        if (context == null) return;
        _webPermissionContexts.Remove(core);
        _webPermissionContexts.Add(core, context);
        _webPermissionOwners.RemoveAll(reference => !reference.TryGetTarget(out var item) || item.Closed);
        _webPermissionOwners.Add(new(context));
        core.NavigationStarting += (_, _) => context.Navigating();
        if (context.Owner.TryGetTarget(out var owner)) owner.Closed += (_, _) => context.Close();
        // Old blanket denials (and any native grants) must not bypass Doorpi's
        // per-user policy through Chromium's own persisted permission cache.
        foreach (var setting in await core.Profile.GetNonDefaultPermissionSettingsAsync())
            if (setting.PermissionKind is CoreWebView2PermissionKind.Camera or CoreWebView2PermissionKind.Microphone
                or CoreWebView2PermissionKind.Geolocation or CoreWebView2PermissionKind.Notifications)
                await core.Profile.SetPermissionStateAsync(setting.PermissionKind, setting.PermissionOrigin, CoreWebView2PermissionState.Default);
    }

    private bool IsCurrentPermissionContext(BrowserPermissionContext context, long navigationVersion)
        => !context.Closed && context.CanAsk && context.UserId == currentUserId &&
           !string.IsNullOrWhiteSpace(context.UserId) && context.NavigationVersion == navigationVersion &&
           context.Owner.TryGetTarget(out var owner) && owner.IsVisible;

    private async void OnWebViewPermissionRequested(object? sender, CoreWebView2PermissionRequestedEventArgs e)
    {
        e.State = CoreWebView2PermissionState.Deny;
        e.SavesInProfile = false;
        if (sender is not CoreWebView2 core || !_webPermissionContexts.TryGetValue(core, out var context) ||
            e.PermissionKind is not (CoreWebView2PermissionKind.Camera or CoreWebView2PermissionKind.Microphone)) return;
        long version = context.NavigationVersion;
        if (!IsCurrentPermissionContext(context, version)) return;
        string? origin = BrowserPermissionStore.NormalizeOrigin(e.Uri);
        if (origin == null) return;
        var resource = e.PermissionKind == CoreWebView2PermissionKind.Camera
            ? BrowserPermissionResource.Camera : BrowserPermissionResource.Microphone;
        var deferral = e.GetDeferral();
        using var cancellation = CancellationTokenSource.CreateLinkedTokenSource(context.Navigation.Token);
        try
        {
            bool allowed = await WebPermissionService.DecideAsync(
                new(context.UserId, context.AppKey, context.AppName, origin, resource),
                () => IsCurrentPermissionContext(context, version),
                token => ShowWebPermissionPromptAsync(context, origin, resource, token), cancellation.Token);
            if (allowed) e.State = CoreWebView2PermissionState.Allow;
        }
        catch (OperationCanceledException) { }
        catch (Exception ex) { Debug.WriteLine("[WebPermissions] Request denied: " + ex.Message); }
        finally
        {
            try { deferral.Dispose(); }
            catch (Exception ex) { Debug.WriteLine("[WebPermissions] Closed request: " + ex.Message); }
        }
    }

    private async Task<bool?> ShowWebPermissionPromptAsync(BrowserPermissionContext context, string origin,
        BrowserPermissionResource resource, CancellationToken cancellationToken)
    {
        if (!context.Owner.TryGetTarget(out var owner) || !owner.IsActive || !owner.IsVisible ||
            owner.WindowState == WindowState.Minimized) return null;
        var prompt = new BrowserPermissionDialog(context.AppName, origin, resource, IsPortugueseUi()) { Owner = owner };
        bool wasEnabled = owner.IsEnabled;
        try
        {
            BrowserPermissionDialog.CaptureInput();
            ReleaseConfiguredControlOutputs();
            ReleaseAllStuckKeys();
            SendMouse(0, 0, 0x0004);
            SendMouse(0, 0, 0x0010);
            _desktopVkb?.Close(); _desktopVkb = null;
            owner.IsEnabled = false;
            using var cancelPrompt = cancellationToken.Register(() => Dispatcher.BeginInvoke(new Action(prompt.Cancel)));
            cancellationToken.ThrowIfCancellationRequested();
            return await prompt.AskAsync();
        }
        finally
        {
            BrowserPermissionDialog.ReleaseInput();
            if (!context.Closed)
            {
                owner.IsEnabled = wasEnabled;
                if (prompt.ReturnFocusToOwner && context.UserId == currentUserId &&
                    owner.IsVisible && owner.WindowState != WindowState.Minimized) owner.Activate();
            }
        }
    }

    private async Task<bool> TryHandleWebPermissionSettingsAsync(string action, JsonElement root)
    {
        if (action is not ("requestWebPermissions" or "revokeWebPermission")) return false;
        string user = currentUserId;
        string requestId = GetStr(root, "requestId");
        if (string.IsNullOrWhiteSpace(user)) return true;
        try
        {
            var store = WebPermissions;
            if (action == "revokeWebPermission")
            {
                string id = GetStr(root, "id");
                var revoked = await Task.Run(() => store.Revoke(user, id));
                if (revoked?.Allowed == true)
                {
                    foreach (var reference in _webPermissionOwners.ToArray())
                    {
                        if (!reference.TryGetTarget(out var context) || context.Closed ||
                            context.UserId != user || context.AppKey != revoked.AppKey) continue;
                        context.Close();
                        if (context.Owner.TryGetTarget(out var owner) && owner != this) owner.Close();
                    }
                }
            }
            var records = await Task.Run(() => store.List(user));
            if (currentUserId != user) return true;
            PostWebPermissionSettings(new
            {
                type = "webPermissionsState", requestId, profileId = user, ok = true,
                decisions = records.Select(item => new { id = item.Id, appName = item.AppName, origin = item.Origin,
                    resource = item.Resource == BrowserPermissionResource.Camera ? "camera" : "microphone", allowed = item.Allowed })
            });
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[WebPermissions] Settings failed: " + ex.Message);
            if (currentUserId == user) PostWebPermissionSettings(new { type = "webPermissionsState", requestId, profileId = user, ok = false });
        }
        return true;
    }

    private void PostWebPermissionSettings(object state)
    {
        try { webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(state)); }
        catch (Exception ex) { Debug.WriteLine("[WebPermissions] Settings response failed: " + ex.Message); }
    }
}
