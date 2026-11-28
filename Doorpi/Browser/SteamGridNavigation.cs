namespace Doorpi;

internal sealed class SteamGridNavigation
{
    public const string KeyPage = "https://www.steamgriddb.com/profile/preferences/api";
    private bool _waitingForAuthReturn;
    private bool _retriedHome;
    public long KeyPageRevision { get; private set; }

    public void MarkKeyPageReady() => KeyPageRevision++;

    public bool NeedsKeyPageAfterPopup(long revisionBeforeLogin, string currentUrl) =>
        KeyPageRevision == revisionBeforeLogin || !IsKeyPage(currentUrl);

    public void ObserveNavigation(string? url, bool userInitiated = false)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return;
        if (IsSteamHost(uri) ||
            (userInitiated && IsSitePage(url, out _) && IsAuthenticationStep(uri)))
            _waitingForAuthReturn = true;
    }

    public bool ShouldRedirect(string url)
    {
        if (!IsSitePage(url, out var uri)) return false;
        if (IsAuthenticationStep(uri))
        {
            // The key page can send a signed-out user straight to the sign-in form.
            if (!_retriedHome) _waitingForAuthReturn = true;
            return false;
        }
        if (IsKeyPage(url))
        {
            _waitingForAuthReturn = false;
            return false;
        }

        if (!_waitingForAuthReturn && (_retriedHome || uri.AbsolutePath != "/")) return false;
        MarkKeyPageRequested();
        return true;
    }

    public bool ShouldReturnFromPopup(string url, bool closedBySite)
    {
        if (!_waitingForAuthReturn) return false;
        if (IsSitePage(url, out var uri)) return closedBySite || !IsAuthenticationStep(uri);

        // The opener can receive the login result before the popup changes its reported URL.
        return closedBySite && (url == "about:blank" ||
            (uri != null && uri.Scheme == Uri.UriSchemeHttps && IsSteamHost(uri)));
    }

    public void MarkKeyPageRequested()
    {
        _waitingForAuthReturn = false;
        _retriedHome = true;
    }

    public static bool IsSitePage(string? url, out Uri uri) =>
        Uri.TryCreate(url, UriKind.Absolute, out uri!) && uri.Scheme == Uri.UriSchemeHttps && uri.IsDefaultPort &&
        uri.Host is "www.steamgriddb.com" or "steamgriddb.com";

    public static bool IsKeyPage(string url) => IsSitePage(url, out var uri) &&
        uri.AbsolutePath.TrimEnd('/') == "/profile/preferences/api";

    private static bool IsSteamHost(Uri uri) => uri.IsDefaultPort &&
        uri.Host is "steamcommunity.com" or "www.steamcommunity.com" or "login.steampowered.com" or "store.steampowered.com";

    private static bool IsAuthenticationStep(Uri uri)
    {
        string lastSegment = uri.Segments[^1].TrimEnd('/').ToLowerInvariant();
        if (lastSegment is "success" or "complete" or "completed") return false;
        string section = uri.Segments.Length > 1 ? uri.Segments[1].TrimEnd('/').ToLowerInvariant() : "";
        return section is "auth" or "login" or "signin" or "sign-in" or "register" or "registration" or
            "signup" or "sign-up" or "onboarding" or "verify";
    }
}
