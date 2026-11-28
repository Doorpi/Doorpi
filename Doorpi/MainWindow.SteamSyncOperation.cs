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
        public string Phase { get; set; } = "";
        public int Current { get; set; }
        public int Total { get; set; }
        public int Percent { get; set; }
        public bool FirstSync { get; set; }
        public DateTimeOffset UpdatedUtc { get; set; }
    }
    private readonly HashSet<string> _steamResumeAttempts = new(StringComparer.OrdinalIgnoreCase);
    private sealed class SteamRefreshQueue
    {
        public string Account { get; set; } = "";
        public DateTimeOffset LastDiscovery { get; set; }
        public DateTimeOffset LastFull { get; set; }

    }

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
    private async void OnSteamRefreshTick(object? sender, EventArgs args)
        => await ProcessSteamRefreshAsync();

    private async Task ProcessSteamRefreshAsync()
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
            bool full = now - queue.LastFull >= TimeSpan.FromDays(30);
            if (!full && now - queue.LastDiscovery < TimeSpan.FromHours(6))
            {
                ScheduleSteamRefresh(queue.LastDiscovery.AddHours(6) - now);
                return;
            }
            bool success = false;
            using var request = JsonDocument.Parse(JsonSerializer.Serialize(new { account }));
            await TryHandleSteamProfileMessageAsync("steamImport", request.RootElement, ok => success = ok, !full);
            if (owner != currentUserId || generation != _themeProfileGeneration) { ScheduleSteamRefresh(TimeSpan.FromSeconds(10)); return; }
            if (!success) { ScheduleSteamRefresh(TimeSpan.FromMinutes(10)); return; }
            queue.LastDiscovery = now;
            if (full) queue.LastFull = now;
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
    private void SaveSteamOperation(string directory, string account, bool pending, string message,
        SteamImportProgressUpdate? progress = null, bool firstSync = false)
        => StateStorage.WriteAllText(Path.Combine(directory, "steam-sync-operation.json"), JsonSerializer.Serialize(new SteamSyncOperation
        {
            Pending = pending, Account = account, Message = message, Phase = progress?.Phase ?? "",
            Current = progress?.Current ?? 0, Total = progress?.Total ?? 0,
            Percent = Math.Clamp(progress?.Percent ?? 0, 0, 100), FirstSync = firstSync,
            UpdatedUtc = DateTimeOffset.UtcNow
        }), keepBackup: false);
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
                long revision = StateStorage.GetRevision(path);
                long generation = _themeProfileGeneration;
                using var request = JsonDocument.Parse(JsonSerializer.Serialize(new { account = operation.Account }));
                bool complete=false;
                await TryHandleSteamProfileMessageAsync("steamImport", request.RootElement, ok=>complete=ok);
                if (complete && currentUserId==owner && generation==_themeProfileGeneration)
                {
                    operation.Pending=false;
                    operation.Phase="complete";
                    operation.Percent=100;
                    try { StateStorage.WriteBatchIfRevision(new Dictionary<string,string?>{[path]=JsonSerializer.Serialize(operation)},new Dictionary<string,long>{[path]=revision}); }
                    catch(StorageConflictException) { }
                }
            });
        }
        catch (Exception exception) when (exception is IOException or JsonException)
        { NotifySteamOperation(owner, "Não foi possível recuperar a sincronização. Solicite uma atualização manual.", false); }
    }
}
