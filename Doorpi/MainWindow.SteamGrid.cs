using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using Doorpi.Storage;
using Microsoft.Web.WebView2.Core;

namespace Doorpi;

public partial class MainWindow
{
    private const string SteamGridCopyPrefix = "doorpi_steamgrid_copy:";

    private static bool HasSteamGridKeyFormat(string key) => key.Length == 32 && key.All(char.IsAsciiLetterOrDigit);

    private static async Task<string> ValidateSteamGridKeyAsync(string key)
    {
        if (!HasSteamGridKeyFormat(key)) return "steamGridKeyInvalid";

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        using var request = new HttpRequestMessage(HttpMethod.Get, "https://www.steamgriddb.com/api/v2/grids/steam/620?limit=1");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        try
        {
            using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) return "steamGridKeyInvalid";
            if (!response.IsSuccessStatusCode) return "steamGridKeyUnavailable";

            using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync(timeout.Token));
            if (payload.RootElement is not { ValueKind: JsonValueKind.Object } result ||
                !result.TryGetProperty("success", out var success) || success.ValueKind != JsonValueKind.True ||
                !result.TryGetProperty("data", out var images) || images.ValueKind != JsonValueKind.Array)
                return "steamGridKeyUnavailable";

            bool foundImage = images.EnumerateArray().Any(image => image.ValueKind == JsonValueKind.Object &&
                image.TryGetProperty("url", out var url) && url.ValueKind == JsonValueKind.String &&
                Uri.TryCreate(url.GetString(), UriKind.Absolute, out var imageUri) && imageUri.Scheme == Uri.UriSchemeHttps);
            return foundImage ? "" : "steamGridKeyUnavailable";
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or OperationCanceledException or JsonException)
        {
            return "steamGridKeyUnavailable";
        }
    }

    private async Task SaveSteamGridKeyAsync(JsonElement root)
    {
        string requestId = GetStr(root, "requestId");
        string owner = GetStr(root, "profileId");
        void Reply(string reason) => PostProfileSyncMessage(new { type = "steamGridKeySaved", requestId, profileId = owner, reason });

        if (owner.Length == 0 || owner != currentUserId) { Reply("steamGridKeyProfileChanged"); return; }
        long generation = _themeProfileGeneration;
        string profilePath = Path.Combine(dataFolder, "users", owner, "user.json");
        long revision = StateStorage.GetRevision(profilePath);
        string key = GetStr(root, "key").Trim();
        string reason = await ValidateSteamGridKeyAsync(key);
        if (reason.Length > 0) { Reply(reason); return; }

        try
        {
            bool saved = false;
            StateStorage.ExecuteTransaction(() =>
            {
                if (owner != currentUserId || generation != _themeProfileGeneration || StateStorage.GetRevision(profilePath) != revision) return;
                var users = LoadUserProfiles();
                var profile = users.FirstOrDefault(user => user.Id == owner);
                if (profile == null) return;
                profile.SteamGridApiKey = key;
                SaveUserProfiles(users);
                saved = true;
            });
            if (!saved) { Reply("steamGridKeyProfileChanged"); return; }
            ScheduleProfileSync(owner);
            Reply("");
        }
        catch (Exception ex) when (ex is IOException or InvalidOperationException or Microsoft.Data.Sqlite.SqliteException or System.Security.Cryptography.CryptographicException)
        {
            Reply("steamGridKeySaveFailed");
        }
    }

    private sealed class SteamGridBrowser(string owner, long generation, string requestId, string texts)
    {
        public string Owner { get; } = owner;
        public long Generation { get; } = generation;
        public string RequestId { get; } = requestId;
        public string Texts { get; } = texts;
        public CoreWebView2? Core { get; set; }
        public SteamGridNavigation Navigation { get; } = new();
        public ulong PendingNavigationId { get; set; }
        public TaskCompletionSource? PendingNavigation { get; set; }
        public long PopupGeneration { get; set; }
        public long? ReturningFromPopup { get; set; }
        public bool KeyCopied { get; set; }
    }

    private SteamGridBrowser? _steamGridBrowser;

    private bool IsCurrentSteamGridBrowser(SteamGridBrowser browser) =>
        _steamGridBrowser == browser && browser.Owner == currentUserId && browser.Generation == _themeProfileGeneration;

    private bool IsSteamGridBrowserVisible() => !_ytClosing && _steamGridBrowser is { } browser &&
        IsCurrentSteamGridBrowser(browser) && _ytWebView?.Visibility == Visibility.Visible;

    private async Task ReturnToSteamGridKeyAfterPopupAsync(SteamGridBrowser browser, long popupGeneration, long keyPageRevision)
    {
        browser.ReturningFromPopup = popupGeneration;
        try
        {
            // Give the site's opener callback a chance to update its existing page.
            await Task.Delay(650);
            if (browser.PendingNavigation is { } pending)
                await Task.WhenAny(pending.Task, Task.Delay(2000));
            if (!IsCurrentSteamGridBrowser(browser) || browser.PopupGeneration != popupGeneration ||
                _popupWindow != null || browser.Core is not { } opener ||
                !ReferenceEquals(opener, _ytWebView?.CoreWebView2)) return;

            browser.Navigation.MarkKeyPageRequested();
            if (browser.Navigation.NeedsKeyPageAfterPopup(keyPageRevision, opener.Source))
                opener.Navigate(SteamGridNavigation.KeyPage);
        }
        catch (Exception ex) when (ex is InvalidOperationException or COMException)
        {
            LogWebViewDiagnostic("SteamGridDB popup return failed: " + ex.GetType().Name);
        }
        finally
        {
            if (browser.ReturningFromPopup == popupGeneration) browser.ReturningFromPopup = null;
        }
    }

    private async Task OpenSteamGridBrowserAsync(JsonElement root)
    {
        string requestId = GetStr(root, "requestId");
        if (requestId.Length == 0 || _steamGridBrowser != null) return;
        if (_ytWebView != null) CloseYouTubeInline();
        string texts = root.TryGetProperty("texts", out var labels) && labels.ValueKind == JsonValueKind.Object
            ? JsonSerializer.Serialize(new { copy = GetStr(labels, "copy"), back = GetStr(labels, "back"), open = GetStr(labels, "open"), clipboardError = GetStr(labels, "clipboardError") })
            : "{}";
        var browser = new SteamGridBrowser(currentUserId, _themeProfileGeneration, requestId, texts);
        _steamGridBrowser = browser;
        try
        {
            await OpenWebViewInlineAsync(SteamGridNavigation.KeyPage, appName: "SteamGridDB", steamGridBrowser: browser);
        }
        catch (Exception ex) when (ex is InvalidOperationException or IOException or COMException)
        {
            if (_steamGridBrowser != browser) return;
            if (_ytWebView != null) CloseYouTubeInline();
            _steamGridBrowser = null;
            PostProfileSyncMessage(new { type = "steamGridKeyInput", requestId, reason = "steamGridKeyOpenFailed" });
        }
    }

    private async Task AttachSteamGridBrowserAsync(CoreWebView2 core, SteamGridBrowser browser)
    {
        browser.Core = core;
        core.NavigationStarting += (_, e) =>
        {
            if (!IsCurrentSteamGridBrowser(browser)) return;
            browser.PendingNavigationId = e.NavigationId;
            browser.PendingNavigation ??= new(TaskCreationOptions.RunContinuationsAsynchronously);
            browser.Navigation.ObserveNavigation(e.Uri, e.IsUserInitiated);
        };

        bool wasOnKeyPage = false;
        void ReturnToKeyPage(bool loadedDocument)
        {
            if (!IsCurrentSteamGridBrowser(browser)) return;
            bool isKeyPage = SteamGridNavigation.IsKeyPage(core.Source);
            if (isKeyPage && (loadedDocument || !wasOnKeyPage)) browser.Navigation.MarkKeyPageReady();
            wasOnKeyPage = isKeyPage;
            if (_popupWindow == null && browser.ReturningFromPopup == null && browser.Navigation.ShouldRedirect(core.Source))
                core.Navigate(SteamGridNavigation.KeyPage);
        }
        core.NavigationCompleted += (_, e) =>
        {
            if (browser.PendingNavigationId == e.NavigationId)
            {
                browser.PendingNavigation?.TrySetResult();
                browser.PendingNavigation = null;
            }
            if (e.IsSuccess) ReturnToKeyPage(loadedDocument: true);
        };
        core.SourceChanged += (_, e) =>
        {
            if (!e.IsNewDocument) ReturnToKeyPage(loadedDocument: false);
        };

        core.WebMessageReceived += (sender, e) =>
        {
            if (!IsCurrentSteamGridBrowser(browser) || !ReferenceEquals(core, _ytWebView?.CoreWebView2) ||
                !SteamGridNavigation.IsSitePage(e.Source, out _) || !SteamGridNavigation.IsSitePage(core.Source, out _)) return;
            string message;
            try { message = e.TryGetWebMessageAsString(); }
            catch (ArgumentException) { return; }

            if (message == "doorpi_steamgrid_key_page_ready" &&
                SteamGridNavigation.IsKeyPage(e.Source) && SteamGridNavigation.IsKeyPage(core.Source))
            {
                browser.Navigation.MarkKeyPageReady();
                return;
            }

            if (message == "doorpi_steamgrid_back") { CloseYouTubeInline(); return; }
            if (message == "doorpi_steamgrid_open")
            {
                browser.Navigation.MarkKeyPageRequested();
                core.Navigate(SteamGridNavigation.KeyPage);
                return;
            }
            if (!SteamGridNavigation.IsKeyPage(e.Source) || !SteamGridNavigation.IsKeyPage(core.Source) ||
                !message.StartsWith(SteamGridCopyPrefix, StringComparison.Ordinal)) return;
            string key = message[SteamGridCopyPrefix.Length..];
            if (browser.KeyCopied || !HasSteamGridKeyFormat(key)) return;
            try { Clipboard.SetText(key); }
            catch (ExternalException) { core.PostWebMessageAsString("doorpi_steamgrid_clipboard_error"); return; }
            browser.KeyCopied = true;
            CloseYouTubeInline();
            PostProfileSyncMessage(new { type = "steamGridKeyInput", requestId = browser.RequestId, text = key });
        };

        using var stream = typeof(MainWindow).Assembly.GetManifestResourceStream("Doorpi.SteamGridConnect.js")!;
        using var reader = new StreamReader(stream);
        string script = "(() => { const labels = " + browser.Texts + ";\n" + await reader.ReadToEndAsync() + "\n})();";
        await core.AddScriptToExecuteOnDocumentCreatedAsync(script);
    }
}
