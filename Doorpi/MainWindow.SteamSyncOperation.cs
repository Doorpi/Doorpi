using System.IO;
using System.Text.Json;
using Doorpi.Storage;
using Doorpi.Steam;
namespace Doorpi;
public partial class MainWindow
{
    private sealed class SteamSyncOperation
    {
        public bool Pending { get; set; }
        public string Account { get; set; } = "";
        public string Message { get; set; } = "";
        public DateTimeOffset UpdatedUtc { get; set; }
    }
    private readonly HashSet<string> _steamResumeAttempts = new(StringComparer.OrdinalIgnoreCase);
    private sealed class SteamRefreshQueue
    {
        public string Account { get; set; } = "";
        public DateTimeOffset LastDiscovery { get; set; }
        public DateTimeOffset LastFull { get; set; }
        public Dictionary<int, SteamRefreshJob> Games { get; set; } = new();
    }
    private sealed record SteamRefreshJob(DateTimeOffset Due, bool FollowUp);
    private readonly System.Windows.Threading.DispatcherTimer _steamRefreshTimer = new();
    private bool _steamRefreshRunning;
    private void ScheduleSteamRefresh(TimeSpan delay)
    {
        _steamRefreshTimer.Stop();
        _steamRefreshTimer.Tick -= OnSteamRefreshTick;
        _steamRefreshTimer.Tick += OnSteamRefreshTick;
        _steamRefreshTimer.Interval = delay < TimeSpan.FromSeconds(1) ? TimeSpan.FromSeconds(1) : delay;
        _steamRefreshTimer.Start();
    }
    private static SteamRefreshQueue ReadRefreshQueue(string path, string account)
    {
        var queue = StateStorage.Exists(path)
            ? JsonSerializer.Deserialize<SteamRefreshQueue>(StateStorage.ReadAllText(path)) ?? throw new InvalidDataException("Fila Steam inválida.")
            : new SteamRefreshQueue();
        return queue.Account == account ? queue : new SteamRefreshQueue { Account = account, LastFull = DateTimeOffset.UtcNow };
    }
    private void QueueSteamAfterGameplay(string owner, string gameId)
    {
        var appId = SteamHistoryImport.AppIdFromUrl(gameId);
        if (appId <= 0 && !string.IsNullOrEmpty(gameId))
        {
            var match = LoadGames().FirstOrDefault(game => string.Equals(game.Path, gameId, StringComparison.OrdinalIgnoreCase));
            if (match != null) appId = SteamHistoryImport.AppIdFromUrl(match.LaunchUrl);
        }
        if (appId > 0) QueueSteamGames(owner, [appId], finishedAppId: appId);
    }
    private void QueueSteamGames(string owner, IReadOnlyCollection<int> ids, int? finishedAppId = null)
    {
        if (ids.Count == 0 || string.IsNullOrWhiteSpace(owner)) return;
        string directory = Path.Combine(dataFolder, "users", ProfileSync.GoogleOAuthClient.SafeProfileId(owner));
        string account = SteamProfileStore.ReadConnectedAccount(directory);
        if (string.IsNullOrEmpty(account) || !SteamProfileStore.HasKey(directory)) return;
        string path = Path.Combine(directory, "steam-refresh-queue.json");
        StateStorage.ExecuteTransaction(() =>
        {
            var queue = ReadRefreshQueue(path, account);
            var now = DateTimeOffset.UtcNow;
            foreach (int id in ids) queue.Games[id] = new(id == finishedAppId ? now : now.AddSeconds(8), false);
            StateStorage.WriteAllText(path, JsonSerializer.Serialize(queue));
        });
        Dispatcher.InvokeAsync(() =>
        {
            if (owner != currentUserId) return;
            if (finishedAppId.HasValue) _ = ProcessSteamRefreshAsync(finishedAppId);
            else ScheduleSteamRefresh(TimeSpan.FromSeconds(8));
        });
    }
    private async void OnSteamRefreshTick(object? sender, EventArgs args)
        => await ProcessSteamRefreshAsync();

    private async Task ProcessSteamRefreshAsync(int? finishedAppId = null)
    {
        _steamRefreshTimer.Stop();
        if (_steamRefreshRunning) { ScheduleSteamRefresh(TimeSpan.FromSeconds(15)); return; }
        string owner = currentUserId;
        if (string.IsNullOrWhiteSpace(owner)) return;
        _steamRefreshRunning = true;
        try
        {
            string directory = Path.Combine(dataFolder, "users", ProfileSync.GoogleOAuthClient.SafeProfileId(owner));
            string account = SteamProfileStore.ReadConnectedAccount(directory);
            if (string.IsNullOrEmpty(account) || !SteamProfileStore.HasKey(directory)) return;
            if (IsGameplayBackgroundMode || _gameIsRunningAndDoorpiHidden || _gameIsMinimized || _steamImportGate.CurrentCount == 0)
            { ScheduleSteamRefresh(TimeSpan.FromSeconds(30)); return; }
            string path = Path.Combine(directory, "steam-refresh-queue.json");
            long revision = StateStorage.GetRevision(path);
            long generation = _themeProfileGeneration;
            var queue = ReadRefreshQueue(path, account);
            var now = DateTimeOffset.UtcNow;
            var next = finishedAppId is int id && queue.Games.TryGetValue(id, out var job) && job.Due <= now
                ? new KeyValuePair<int, SteamRefreshJob>(id, job)
                : queue.Games.OrderBy(pair => pair.Value.Due).FirstOrDefault();
            int appId = next.Value?.Due <= now ? next.Key : 0;
            bool full = now - queue.LastFull >= TimeSpan.FromDays(30);
            if (appId == 0 && !full && now - queue.LastDiscovery < TimeSpan.FromHours(6))
            {
                var discoveryDue = queue.LastDiscovery.AddHours(6);
                ScheduleSteamRefresh((next.Value != null && next.Value.Due < discoveryDue ? next.Value.Due : discoveryDue) - now);
                return;
            }
            bool success = false;
            using var request = JsonDocument.Parse(JsonSerializer.Serialize(new { account, appId }));
            await TryHandleSteamProfileMessageAsync("steamImport", request.RootElement, ok => success = ok, appId == 0 && !full);
            if (owner != currentUserId || generation != _themeProfileGeneration) { ScheduleSteamRefresh(TimeSpan.FromSeconds(10)); return; }
            if (!success && appId == 0) { ScheduleSteamRefresh(TimeSpan.FromMinutes(10)); return; }
            if (appId > 0)
            {
                if (!success) queue.Games[appId] = next.Value! with { Due = now.AddHours(1) };
                else if (next.Value!.FollowUp) queue.Games.Remove(appId);
                else queue.Games[appId] = new(DateTimeOffset.UtcNow.AddMinutes(3), true);
            }
            else { queue.LastDiscovery = now; if (full) queue.LastFull = now; }
            StateStorage.WriteBatchIfRevision(new Dictionary<string,string?> { [path] = JsonSerializer.Serialize(queue) },
                new Dictionary<string,long> { [path] = revision });
            ScheduleSteamRefresh(TimeSpan.FromSeconds(3));
        }
        catch (StorageConflictException) { ScheduleSteamRefresh(TimeSpan.FromSeconds(1)); }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine("[Steam] Refresh deferred: " + ex.GetType().Name);
            ScheduleSteamRefresh(TimeSpan.FromMinutes(10));
        }
        finally { _steamRefreshRunning = false; }
    }
    private void SaveSteamOperation(string directory, string account, bool pending, string message)
        => StateStorage.WriteAllText(Path.Combine(directory, "steam-sync-operation.json"), JsonSerializer.Serialize(new SteamSyncOperation { Pending = pending, Account = account, Message = message, UpdatedUtc = DateTimeOffset.UtcNow }), keepBackup: false);
    private void NotifySteamOperation(string owner, string message, bool pending)
        => PostProfileSyncMessage(new { type = "doorpiNotification", id = "steam-import-" + owner, category = "profile-sync", profileId = owner, title = pending ? "Sincronizando Steam" : "Sincronização Steam", message, persistent = true });
    private void ResumePendingSteamImport(string owner)
    {
        ScheduleSteamRefresh(TimeSpan.FromSeconds(15));
        if (string.IsNullOrWhiteSpace(owner) || !_steamResumeAttempts.Add(owner)) return;
        string directory = Path.Combine(dataFolder, "users", ProfileSync.GoogleOAuthClient.SafeProfileId(owner));
        string path = Path.Combine(directory, "steam-sync-operation.json");
        if (!StateStorage.Exists(path) || !SteamProfileStore.HasKey(directory)) return;
        try
        {
            var operation = JsonSerializer.Deserialize<SteamSyncOperation>(StateStorage.ReadAllText(path));
            if (operation?.Pending != true) return;
            _ = Dispatcher.InvokeAsync(async () =>
            {
                await Task.Delay(2500);
                if (currentUserId != owner) return;
                NotifySteamOperation(owner, "Sincronização anterior interrompida. Retomando; os dados anteriores foram preservados.", true);
                using var request = JsonDocument.Parse(JsonSerializer.Serialize(new { account = operation.Account }));
                await TryHandleSteamProfileMessageAsync("steamImport", request.RootElement);
            });
        }
        catch (Exception exception) when (exception is IOException or JsonException)
        { NotifySteamOperation(owner, "Não foi possível recuperar a sincronização. Solicite uma atualização manual.", false); }
    }
}
