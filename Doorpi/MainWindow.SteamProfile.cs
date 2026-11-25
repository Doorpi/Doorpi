using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;
using Doorpi.Steam;
using Doorpi.Storage;

namespace Doorpi;

public partial class MainWindow
{
    private sealed class SteamImportProgress(Action<string> report) : IProgress<string> { public void Report(string message) => report(message); }
    private (string Directory, long Generation, (long, long, long) Revisions, SteamProfileData? Data)? _steamPresentationCache;
    private SteamProfileData? ReadSteamPresentation(string directory, long generation)
    {
        var revisions = (StateStorage.GetRevision(Path.Combine(directory, "steam-account.json")),
            StateStorage.GetRevision(Path.Combine(directory, "steam-games.json")),
            StateStorage.GetRevision(Path.Combine(directory, "steam-achievements.json")));
        if (_steamPresentationCache is { } cached && cached.Directory == directory &&
            cached.Generation == generation && cached.Revisions == revisions) return cached.Data;
        var data = SteamProfileStore.Read(directory);
        _steamPresentationCache = (directory, generation, revisions, data);
        return data;
    }
    private readonly SemaphoreSlim _steamImportGate = new(1, 1);
    private static readonly HttpClient SteamHttpClient = new(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(30) };

    private async Task<bool> TryHandleSteamProfileMessageAsync(string action, JsonElement root, Action<bool>? automaticCompletion = null, bool recentOnly = false)
    {
        if (action == "steamGameHeader")
        {
            if (root.TryGetProperty("appId", out var id) && id.TryGetInt32(out int appId) && appId > 0)
                await SendSteamGameHeaderAsync(appId);
            return true;
        }
        if (action is not ("steamConnect" or "steamProfileStatus" or "steamProfileAchievements" or "steamPasteKey" or "steamSaveManualKey" or "steamPasteAccount" or "steamDisconnect" or "steamImport")) return false;
        if (action == "steamConnect") { await BeginSteamConnectAsync(root); return true; }
        string owner = currentUserId;
        if (string.IsNullOrWhiteSpace(owner)) return true;
        string directory = Path.Combine(dataFolder, "users", ProfileSync.GoogleOAuthClient.SafeProfileId(owner));
        string userPath = Path.Combine(directory, "user.json");
        long generation = _themeProfileGeneration;
        long capturedUserRevision = StateStorage.GetRevision(userPath);
        string operationAccount = "";
        bool operationStarted = false;
        SteamProfileData? statusData = null;
        bool statusLoaded = false;
        void Status(string message, bool busy = false)
        {
            if (!statusLoaded) { statusData = ReadSteamPresentation(directory, generation); statusLoaded = true; }
            var data = statusData;
            var summaries = busy ? null : data?.Games.OrderByDescending(game => game.PlaytimeMinutes).Take(20).Select(game => new { game.Name, game.PlaytimeMinutes, unlocked = game.Achievements.Count(item => item.Unlocked), total = game.Achievements.Count, achievements = game.Achievements.Where(item => item.Unlocked).OrderByDescending(item => item.UnlockTimeUnix).Take(5).Select(item => item.Name).ToArray() }).ToArray();
            PostProfileSyncMessage(new { type = "steamProfileStatus", profileId = owner, hasKey = SteamProfileStore.HasKey(directory), account = SteamProfileStore.ReadConnectedAccount(directory), steamId = data?.SteamId ?? "", displayName = data?.DisplayName ?? "", gameCount = data?.Games.Count ?? 0, achievementCount = data?.Games.Sum(game => game.Achievements.Count(item => item.Unlocked)) ?? 0,
                completedGames = data?.Games.Count(game => game.Achievements.Count > 0 && game.Achievements.All(item => item.Unlocked)) ?? 0,
                medals = SteamMedals.Count(data?.Games.SelectMany(game => game.Achievements) ?? Enumerable.Empty<SteamAchievementData>()),
                achievementGames = data?.Games.Count(game => game.Achievements.Count > 0) ?? 0,
                achievementIndex = busy ? null : data?.Games.OrderBy(game => game.Name).Select(game => new { game.AppId, game.Name, game.PlaytimeMinutes, game.LastPlayedUnix, medals = SteamMedals.Count(game.Achievements), unlocked = game.Achievements.Count(item => item.Unlocked), total = game.Achievements.Count, previewIcons = SteamMedals.InDisplayOrder(game.Achievements).Take(6).Select(item => new { item.IconFile, item.IconUrl }), checkedUtc = game.AchievementsCheckedUtc }).ToArray(),
                games = summaries, busy, message, manualKeyRequired = _steamManualKeyFallback.Contains(owner) });
        }
        try
        {
            if (action == "steamProfileAchievements")
            {
                int appId = root.TryGetProperty("appId", out var appValue) && appValue.TryGetInt32(out var parsedApp) ? parsedApp : 0;
                int offset = root.TryGetProperty("offset", out var offsetValue) && offsetValue.TryGetInt32(out var parsedOffset) ? Math.Max(0, parsedOffset) : 0;
                string requestId = root.TryGetProperty("requestId", out var requestValue) ? requestValue.GetString() ?? "" : "";
                var game = ReadSteamPresentation(directory, generation)?.Games.FirstOrDefault(game => game.AppId == appId);
                var items = SteamMedals.InDisplayOrder(game?.Achievements ?? []).Skip(offset).Take(40)
                    .Select(item => new { item.Name, item.Description, item.Unlocked, item.UnlockTimeUnix, item.IconFile, item.IconUrl, item.GlobalUnlockPercent }).ToArray();
                PostProfileSyncMessage(new { type = "steamProfileAchievements", profileId = owner, requestId, appId, offset, total = game?.Achievements.Count ?? 0, items });
                return true;
            }
            if (action == "steamProfileStatus")
            {
                string operationPath = Path.Combine(directory, "steam-sync-operation.json");
                var operation = StateStorage.Exists(operationPath) ? JsonSerializer.Deserialize<SteamSyncOperation>(StateStorage.ReadAllText(operationPath)) : null;
                bool running = _steamImportGate.CurrentCount == 0;
                Status(running && operation != null ? operation.Message : SteamProfileStore.HasKey(directory) ? "Conexão salva neste Windows. Atualize para consultar horas e conquistas." : "Escolha Configurar Steam, entre na sua conta e clique na chave.", running);
                return true;
            }
            if (action == "steamPasteAccount")
            {
                string accountText = await Dispatcher.InvokeAsync(() => System.Windows.Clipboard.ContainsText() ? System.Windows.Clipboard.GetText().Trim() : "");
                string account = SteamWebApiClient.ParseAccount(accountText);
                PostProfileSyncMessage(new { type = "steamProfileStatus", profileId = owner, account, hasKey = SteamProfileStore.HasKey(directory), busy = false, message = "Perfil preenchido. Importe para consultar os dados públicos." });
                return true;
            }
            if (!_steamImportGate.Wait(0)) { Status("Já existe uma importação Steam em andamento.", true); return true; }
            try
            {
                if (action is "steamPasteKey" or "steamSaveManualKey")
                {
                    string key = action == "steamSaveManualKey"
                        ? root.TryGetProperty("key", out var manualKey) && manualKey.ValueKind == JsonValueKind.String ? manualKey.GetString()?.Trim() ?? "" : ""
                        : await Dispatcher.InvokeAsync(() => System.Windows.Clipboard.ContainsText() ? System.Windows.Clipboard.GetText().Trim() : "");
                    if (generation != _themeProfileGeneration || !string.Equals(owner, currentUserId, StringComparison.Ordinal)) throw new OperationCanceledException("O perfil mudou. Cole a chave novamente no perfil desejado.");
                    StateStorage.ExecuteTransaction(() =>
                    {
                        long actual = StateStorage.GetRevision(userPath);
                        if (actual != capturedUserRevision) throw new StorageConflictException(userPath, capturedUserRevision, actual);
                        SteamProfileStore.SaveKey(directory, key);
                        _steamManualKeyFallback.Remove(owner);
                    });
                    Status("Chave Steam salva somente neste computador. Informe seu perfil e importe os dados.");
                    return true;
                }
                if (action == "steamDisconnect")
                {
                    SteamProfileStore.DeleteKey(directory);
                    Status("Chave removida deste computador. Histórico e conquistas importados foram preservados.");
                    return true;
                }
                string account = root.TryGetProperty("account", out var accountValue) ? accountValue.GetString() ?? "" : "";
                if (string.IsNullOrWhiteSpace(account)) account = SteamProfileStore.ReadConnectedAccount(directory);
                if (account.Length > 2048) throw new InvalidDataException("Endereço de perfil inválido.");
                var names = SteamProfileStore.DataNames.Concat(new[] { "user.json", "games.json", "game-history.json", "steam-credentials.json", "steam-connection.json" }).Select(name => Path.Combine(directory, name)).ToArray();
                var before = StateStorage.ReadSnapshot(names);
                string keyValue = SteamProfileStore.ReadKey(directory);
                var previous = SteamProfileStore.Read(directory);
                operationAccount = account;
                if (automaticCompletion == null) SaveSteamOperation(directory, account, true, "Consultando perfil e biblioteca Steam...");
                operationStarted = automaticCompletion == null;
                if (automaticCompletion == null) NotifySteamOperation(owner, "Consultando a Steam. Você pode continuar usando o Doorpi.", true);
                Status("Consultando perfil e biblioteca Steam...", true);
                string lastProgress = "Importação concluída.";
                int progressActive = 1;
                DateTimeOffset lastProgressSaved = DateTimeOffset.MinValue;
                var progress = new SteamImportProgress(message =>
                {
                    lastProgress = message;
                    if (automaticCompletion != null) return;
                    if (DateTimeOffset.UtcNow - lastProgressSaved < TimeSpan.FromSeconds(1)) return;
                    lastProgressSaved = DateTimeOffset.UtcNow;
                    StateStorage.ExecuteTransaction(() =>
                    {
                        if (owner != currentUserId || generation != _themeProfileGeneration || StateStorage.GetRevision(userPath) != capturedUserRevision) throw new OperationCanceledException("O perfil mudou durante a consulta Steam.");
                        SaveSteamOperation(directory, account, true, message);
                    });
                    NotifySteamOperation(owner, message, true);
                    _ = Dispatcher.InvokeAsync(() => { if (Volatile.Read(ref progressActive) != 0 && owner == currentUserId) Status(message, true); });
                });
                using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(45));
                int? targetApp = root.TryGetProperty("appId", out var targetValue) && targetValue.TryGetInt32(out int targetId) && targetId > 0 ? targetId : null;
                string historyPath = Path.Combine(directory, "game-history.json"), gamesPath = Path.Combine(directory, "games.json");
                var history = before.Documents[historyPath] is { } historyJson ? JsonSerializer.Deserialize<List<GameHistoryEntry>>(historyJson) ?? throw new InvalidDataException("Histórico inválido.") : new();
                var library = before.Documents[gamesPath] is { } gamesJson ? JsonSerializer.Deserialize<List<GameModel>>(gamesJson) ?? throw new InvalidDataException("Biblioteca inválida.") : new();
                var localGames = history.Where(game => game.SteamAppId > 0).GroupBy(game => game.SteamAppId)
                    .ToDictionary(group => group.Key, group => group.First().Name);
                foreach (var game in library)
                {
                    int id = SteamHistoryImport.AppIdFromUrl(game.LaunchUrl);
                    if (id > 0) localGames[id] = game.Name;
                }
                SteamProfileData imported;
                try { imported = await new SteamWebApiClient(SteamHttpClient).ImportAsync(account, keyValue, previous, progress, timeout.Token, targetApp, recentOnly, localGames).ConfigureAwait(false); }
                finally { Interlocked.Exchange(ref progressActive, 0); }
                if (generation != _themeProfileGeneration || !string.Equals(owner, currentUserId, StringComparison.Ordinal)) throw new OperationCanceledException("O perfil mudou durante a importação. Nenhuma alteração foi aplicada.");
                SteamHistoryImport.Apply(imported, history, library);
                var writes = SteamProfileStore.BuildWrites(directory, imported);
                writes[Path.Combine(directory, "steam-connection.json")] = JsonSerializer.Serialize(imported.SteamId);
                writes[historyPath] = JsonSerializer.Serialize(history);
                if (before.Documents[gamesPath] != null) writes[gamesPath] = JsonSerializer.Serialize(library);
                if (automaticCompletion == null) writes[Path.Combine(directory, "steam-sync-operation.json")] = JsonSerializer.Serialize(new SteamSyncOperation { Pending = imported.RetryRequired, Account = account, Message = lastProgress, UpdatedUtc = DateTimeOffset.UtcNow });
                StateStorage.WriteBatchIfRevision(writes, before.Revisions);
                automaticCompletion?.Invoke(!imported.RetryRequired);
                if (automaticCompletion == null) NotifySteamOperation(owner, lastProgress, false);
                statusData = imported;
                statusLoaded = true;
                ScheduleProfileSync(owner);
                ResumeProfileSyncArtworkDownloads(owner, initialDelayMs: 2000);
                await Dispatcher.InvokeAsync(() =>
                {
                    if (owner != currentUserId) return;
                    Status($"{lastProgress} {imported.Games.Count} jogos; {imported.Games.Sum(game => game.Achievements.Count(item => item.Unlocked))} conquistas desbloqueadas.");
                    LoadGamesIntoUI();
                    // Steam progress/completion must not reset the profile view.
                });
            }
            finally { _steamImportGate.Release(); }
        }
        catch (Exception exception) when (exception is InvalidDataException or InvalidOperationException or IOException or HttpRequestException or JsonException or CryptographicException or OperationCanceledException or FormatException)
        {
            // Do not expose HTTP request URLs, keys, encrypted envelopes or stack traces to the UI.
            string message = exception is StorageConflictException ? "Os dados locais mudaram durante a consulta. Importe novamente; nenhuma alteração foi aplicada."
                : exception is CryptographicException ? "Não foi possível abrir a chave neste Windows. Cole sua chave Steam novamente."
                : exception is FileNotFoundException ? "Configure primeiro sua chave Steam."
                : exception is HttpRequestException or JsonException or FormatException ? "Não foi possível consultar a Steam. Os dados anteriores foram preservados."
                : exception is OperationCanceledException ? "Importação cancelada por troca de perfil ou tempo limite. Dados anteriores preservados."
                : exception.Message;
            if (operationStarted && StateStorage.GetRevision(userPath) == capturedUserRevision)
            {
                SaveSteamOperation(directory, operationAccount, true, message);
                NotifySteamOperation(owner, message + " Nova tentativa no próximo login ou pela atualização manual.", false);
            }
            try { Status(message); } catch { PostProfileSyncMessage(new { type = "steamProfileStatus", profileId = owner, busy = false, message = "Não foi possível ler os dados Steam armazenados. Eles não foram substituídos." }); }
        }
        return true;
    }
}
