using Doorpi;
using Doorpi.Storage;
using System.Text.Json;

string root = Path.Combine(AppContext.BaseDirectory, "test-data", Guid.NewGuid().ToString("N"), "Doorpi");
StateStorage.Initialize(root);
var app = new MainWindow(root);
int checks = 0;
void Check(bool condition, string description) { if (!condition) throw new Exception(description); checks++; }
void Reject<T>(Action action, string description) where T : Exception
{ try { action(); } catch (T) { checks++; return; } throw new Exception(description); }

app.SelectUser("alice");
app.Save(new() { new() { Name = "Original", Path = "original.exe", TotalPlaytimeMinutes = 5 } });
var download = app.Load();
var edit = app.Load();
edit.Add(new() { Name = "New", Path = "new.exe" });
app.Save(edit);
long historyBeforeConflict = StateStorage.GetRevision(app.HistoryPath);
download[0].Name = "Stale rename";
Reject<StorageConflictException>(() => app.Save(download), "A stale whole-library snapshot overwrote an acknowledged edit.");
Check(app.Load().Any(game => game.Name == "New"), "Concurrent item was lost.");
Check(StateStorage.GetRevision(app.HistoryPath) == historyBeforeConflict, "A failed library commit partly updated history.");

var alice = app.Load();
app.SelectUser("bob");
app.Save(new() { new() { Name = "Bob", Path = "bob.exe" } });
Reject<OperationCanceledException>(() => app.Save(alice), "Alice's delayed snapshot wrote into Bob.");
Check(app.Load().Single().Name == "Bob", "Bob's library changed after rejected cross-owner commit.");

app.SelectUser("alice");
var history = app.History();
history[0].TotalPlaytimeMinutes = 12;
app.SelectUser("bob");
app.SaveHistory(history);
Check(app.History().Count == 0, "A captured Alice history wrote into Bob's current path.");
app.SelectUser("alice");
Check(app.History().Single().TotalPlaytimeMinutes == 12, "Captured history did not retain its explicit owner.");

var art = app.Load();
var unrelatedBefore = StateStorage.ReadEntities(app.GamesPath).Single(row => JsonSerializer.Deserialize<GameModel>(row.Payload)!.Name == "New");
long historyBeforeArt = StateStorage.GetRevision(app.HistoryPath);
art[0].GridImage = "https://example.invalid/new-cover.png";
app.SaveArt(art, art[0]);
Check(app.Load()[0].GridImage.EndsWith("new-cover.png"), "Artwork patch was not committed.");
Check(StateStorage.GetRevision(app.HistoryPath) == historyBeforeArt, "Artwork patch unnecessarily rewrote play history.");
Check(StateStorage.ReadEntities(app.GamesPath).Single(row => row.Id == unrelatedBefore.Id).Payload == unrelatedBefore.Payload,
    "Artwork patch rewrote an unrelated entity.");
var laterEdit = app.Load(); laterEdit.Add(new() { Name = "Later", Path = "later.exe" }); app.Save(laterEdit);
Reject<StorageConflictException>(() => app.Save(art), "Artwork snapshot adopted another writer's revision.");

var related = app.Load();
string config = Path.Combine(root, "Data", "users", "alice", "emulators.json");
StateStorage.WriteAllText(config, "[]");
long oldConfigurationRevision = StateStorage.GetRevision(config);
StateStorage.WriteAllText(config, "[{\"Id\":\"emu\",\"Name\":\"New configuration\"}]");
long beforeRelated = StateStorage.GetRevision(app.GamesPath);
Reject<StorageConflictException>(() => app.SaveRelated(related, config, "[]", oldConfigurationRevision),
    "A stale related configuration was accepted.");
Check(StateStorage.GetRevision(app.GamesPath) == beforeRelated, "Related configuration conflict changed the library.");
Check(StateStorage.ReadAllText(config).Contains("New configuration"), "Configuration conflict lost acknowledged data.");
Check(StateStorage.CheckIntegrity() == "ok", "Consumer operations violated SQLite integrity.");
var catalog = app.Catalog();
catalog.SteamApps.Add(new() { Name = "Only Alice's PC", Path = "D:/alice/game.exe" });
catalog.SteamFingerprint.Add("fingerprint");
catalog.AutoAddSuppressions.Add(new() { Key = "suppressed" });
app.SaveCatalog(catalog);
var loadedCatalog = app.Catalog();
Check(loadedCatalog.SteamApps.Single().Path == "D:/alice/game.exe", "Production catalog reader lost executable path.");
Check(loadedCatalog.SteamFingerprint.Contains("fingerprint") && loadedCatalog.AutoAddSuppressions.Single().Key == "suppressed", "Catalog migration lost fingerprints or suppressions.");
var staleCatalog = app.Catalog();
loadedCatalog.SteamApps[0].Name = "Updated"; app.SaveCatalog(loadedCatalog);
Reject<StorageConflictException>(() => app.SaveCatalog(staleCatalog), "Stale scan overwrote a newer catalog.");
app.SelectUser("bob");
Reject<OperationCanceledException>(() => app.SaveCatalog(loadedCatalog), "Alice's delayed catalog wrote into Bob.");
Check(app.Catalog().SteamApps.Count == 0, "Machine catalog leaked between profile scopes.");
Console.WriteLine($"PASS: {checks} checks of production library/history consumers; WPF and network boundaries are stubbed.");

namespace Doorpi
{
    // Only host context and the notification/network boundary are substituted.
    // Persistence consumers and snapshot ownership logic compile directly from production source.
    public partial class MainWindow
    {
        private readonly string dataFolder;
        private string currentUserId = "";
        private string gamesFile = "";
        private readonly object _gamesFileLock = new();
        private readonly object _gameHistoryFileLock = new();
        private static readonly JsonSerializerOptions IndentedJsonOptions = new() { WriteIndented = true };
        public MainWindow(string root) { dataFolder = Path.Combine(root, "Data"); }
        public string GamesPath => gamesFile;
        public string HistoryPath => Path.Combine(dataFolder, "users", currentUserId, "game-history.json");
        public void SelectUser(string id) { currentUserId = id; gamesFile = Path.Combine(dataFolder, "users", id, "games.json"); }
        public AppCacheModel Catalog() => LoadVersionedAppCache(Path.Combine(dataFolder, "users", currentUserId, "appcache.json"), currentUserId);
        public void SaveCatalog(AppCacheModel cache) => SaveVersionedAppCache(cache);
        public List<GameModel> Load() => LoadGames();
        public void Save(List<GameModel> games) => SaveGames(games);
        public List<GameHistoryEntry> History() => LoadGameHistory();
        public void SaveHistory(List<GameHistoryEntry> history) => SaveGameHistory(history);
        public void SaveArt(List<GameModel> games, GameModel item) => SaveGameArtwork(games, item);
        public void SaveRelated(List<GameModel> games, string path, string content, long revision)
            => SaveGames(games, new Dictionary<string, string?> { [path] = content }, new Dictionary<string, long> { [path] = revision });
        private static bool IsRemoteArtworkUrl(string value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https";
        private void ScheduleProfileSync(string profileId) { }
    }
}
