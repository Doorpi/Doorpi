using System.IO;
using System.Text.Json;
using Doorpi.Steam;
using Doorpi.Storage;
using Microsoft.Web.WebView2.Core;

namespace Doorpi;

public partial class MainWindow
{
    private sealed class SteamConnectAttempt(string owner, long generation, long revision)
    {
        public string Owner { get; } = owner;
        public long Generation { get; } = generation;
        public long Revision { get; } = revision;
        public string Nonce { get; } = Guid.NewGuid().ToString("N");
        public CoreWebView2? Core { get; set; }
        public bool Accepted { get; set; }
        public Dictionary<string,string> Texts { get; } = new();
        public string Text(string key) => Texts.GetValueOrDefault(key, key);
    }
    private SteamConnectAttempt? _steamConnectAttempt;
    private readonly HashSet<string> _steamManualKeyFallback = new(StringComparer.OrdinalIgnoreCase);
    private void EndSteamConnectAttempt(CoreWebView2? core)
    {
        var attempt = _steamConnectAttempt;
        if (attempt == null || (attempt.Core != null && !ReferenceEquals(attempt.Core, core))) return;
        if (!attempt.Accepted && IsSteamConnectCurrent(attempt))
        {
            _steamManualKeyFallback.Add(attempt.Owner);
            PostProfileSyncMessage(new { type = "steamProfileStatus", profileId = attempt.Owner, busy = false, manualKeyRequired = true,
                message = "Nenhuma chave foi extraída. Cole sua chave Steam manualmente no campo abaixo ou tente configurar novamente." });
        }
        _steamConnectAttempt = null;
    }
    private static readonly Lazy<string> SteamConnectScript = new(() => {
        using var stream = typeof(MainWindow).Assembly.GetManifestResourceStream("Doorpi.SteamConnect.js") ?? throw new InvalidOperationException("Script Steam indisponível.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    });
    private static readonly Lazy<string> SteamConnectStyles = new(() => {
        using var stream = typeof(MainWindow).Assembly.GetManifestResourceStream("Doorpi.SteamConnect.css") ?? throw new InvalidOperationException("Estilos Steam indisponíveis.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    });
    private bool IsSteamConnectCurrent(SteamConnectAttempt attempt) => ReferenceEquals(_steamConnectAttempt, attempt)
        && currentUserId == attempt.Owner && _themeProfileGeneration == attempt.Generation;

    private async Task BeginSteamConnectAsync(JsonElement request)
    {
        if (string.IsNullOrWhiteSpace(currentUserId)) return;
        string directory = Path.Combine(dataFolder, "users", ProfileSync.GoogleOAuthClient.SafeProfileId(currentUserId));
        var attempt = new SteamConnectAttempt(currentUserId, _themeProfileGeneration, StateStorage.GetRevision(Path.Combine(directory, "user.json")));
        if(request.TryGetProperty("texts",out var texts) && texts.ValueKind == JsonValueKind.Object)
            foreach(string key in new[]{"export","exporting","identifying","saving","unavailable","captureError","changed","openError","title"})
                if(texts.TryGetProperty(key,out var value) && value.ValueKind == JsonValueKind.String && value.GetString() is {Length:>0 and <=400} text) attempt.Texts[key]=text;
        _steamConnectAttempt = attempt;
        try { await OpenWebViewInlineAsync("https://steamcommunity.com/dev/apikey", appName:attempt.Text("title"), steamConnection:attempt); }
        catch (Exception ex) when (ex is InvalidOperationException or IOException or System.Runtime.InteropServices.COMException)
        {
            if (IsSteamConnectCurrent(attempt)) {
                _steamConnectAttempt = null;
                PostProfileSyncMessage(new {type="steamProfileStatus",profileId=attempt.Owner,busy=false,manualKeyRequired=true,message=attempt.Text("openError")});
            }
        }
    }
    private async Task AttachSteamConnectAsync(CoreWebView2 core, SteamConnectAttempt attempt)
    {
        if (!IsSteamConnectCurrent(attempt)) return;
        attempt.Core = core;
        core.WebMessageReceived += async (_, args) => {
            string message;
            try { message = args.TryGetWebMessageAsString(); } catch (ArgumentException) { return; }
            if (message == "doorpi_steam_manual:" + attempt.Nonce && !attempt.Accepted && IsSteamConnectCurrent(attempt)
                && ReferenceEquals(core, _ytWebView?.CoreWebView2) && SteamConnectionCapture.IsKeyPage(core.Source) && SteamConnectionCapture.IsKeyPage(args.Source))
            {
                _steamManualKeyFallback.Add(attempt.Owner);
                PostProfileSyncMessage(new { type = "steamProfileStatus", profileId = attempt.Owner, busy = false, manualKeyRequired = true, message = "Não foi possível detectar a chave automaticamente. Você pode fechar esta tela e colar a chave manualmente." });
                return;
            }
            if (!message.StartsWith(SteamConnectionCapture.Prefix, StringComparison.Ordinal) || attempt.Accepted || !IsSteamConnectCurrent(attempt)
                || !ReferenceEquals(core, _ytWebView?.CoreWebView2) || !SteamConnectionCapture.IsKeyPage(core.Source)) return;
            var capture = SteamConnectionCapture.Parse(args.Source, message, attempt.Nonce);
            if (capture == null) {
                core.PostWebMessageAsJson(JsonSerializer.Serialize(new {type="steamConnectResult",nonce=attempt.Nonce,message=attempt.Text("captureError")}));
                PostProfileSyncMessage(new {type="steamProfileStatus",profileId=attempt.Owner,busy=false,message=attempt.Text("captureError")});
                return;
            }
            attempt.Accepted = true;
            _steamManualKeyFallback.Remove(attempt.Owner);
            string directory = Path.Combine(dataFolder, "users", ProfileSync.GoogleOAuthClient.SafeProfileId(attempt.Owner));
            try {
                StateStorage.ExecuteTransaction(() => {
                    if (!IsSteamConnectCurrent(attempt)) throw new InvalidOperationException("Sessão alterada.");
                    string path = Path.Combine(directory,"user.json");
                    long actual = StateStorage.GetRevision(path);
                    if (actual != attempt.Revision) throw new StorageConflictException(path, attempt.Revision, actual);
                    SteamProfileStore.SaveConnection(directory, capture.Value.Key, capture.Value.Account);
                });
            } catch (Exception ex) when (ex is IOException or InvalidOperationException or System.Security.Cryptography.CryptographicException) {
                attempt.Accepted = false;
                core.PostWebMessageAsJson(JsonSerializer.Serialize(new {type="steamConnectResult",nonce=attempt.Nonce,message=attempt.Text("changed")}));
                PostProfileSyncMessage(new {type="steamProfileStatus",profileId=attempt.Owner,busy=false,message=attempt.Text("changed")});
                return;
            }
            // Persist before returning. Imported public data can finish afterwards.
            CloseYouTubeInline();
            if (currentUserId != attempt.Owner || _themeProfileGeneration != attempt.Generation) return;
            using var request = JsonDocument.Parse(JsonSerializer.Serialize(new {account=capture.Value.Account}));
            await TryHandleSteamProfileMessageAsync("steamImport",request.RootElement);
        };
        string script = "(()=>{const copy="+JsonSerializer.Serialize(attempt.Texts)+";const nonce="+JsonSerializer.Serialize(attempt.Nonce)+";const styles="+JsonSerializer.Serialize(SteamConnectStyles.Value)+";\n"+SteamConnectScript.Value+"\n})();";
        await core.AddScriptToExecuteOnDocumentCreatedAsync(script);
        // Also install after real DOM readiness: authentication redirects and a
        // restored document can bypass the document-created presentation path.
        core.DOMContentLoaded += async (_, _) => {
            if (!IsSteamConnectCurrent(attempt) || !SteamConnectionCapture.IsKeyPage(core.Source)) return;
            try { await core.ExecuteScriptAsync(script); }
            catch (Exception ex) when (ex is InvalidOperationException or System.Runtime.InteropServices.COMException) { }
        };
    }
}
