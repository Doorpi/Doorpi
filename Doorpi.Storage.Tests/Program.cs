using System.Diagnostics;
using System.Text.Json.Nodes;
using Doorpi.Storage;
using Microsoft.Data.Sqlite;

if (args.Length == 2 && args[0] == "--interrupt-transaction")
{
    string root = args[1];
    StateStorage.Initialize(root);
    StateStorage.ExecuteTransaction(root, () =>
    {
        StateStorage.WriteAllText(Path.Combine(root, "Data", "display-settings.json"), "{\"value\":\"interrupted\"}");
        Environment.Exit(23); // Own fixture process: SQLite must recover its uncommitted journal.
    });
    return;
}

var tests = new List<(string Name, Action Test)>();
// The Windows execution sandbox may deny atomic rename in its virtual %TEMP%.
// Keep fixtures beneath this build output, never beneath the real application data root.
string suiteRoot = Path.Combine(AppContext.BaseDirectory, "test-data", "doorpi-storage-tests-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(suiteRoot);
int assertions = 0;
void Assert(bool result, string message) { assertions++; if (!result) throw new Exception(message); }
void Throws<T>(Action action, string message) where T : Exception
{
    try { action(); } catch (T) { assertions++; return; }
    throw new Exception(message);
}
string Root(string name) { string root = Path.Combine(suiteRoot, name, "Doorpi"); Directory.CreateDirectory(Path.Combine(root, "Data")); return root; }
string Data(string root, string relative) => Path.Combine(root, "Data", relative.Replace('/', Path.DirectorySeparatorChar));
void Legacy(string path, string content) { Directory.CreateDirectory(Path.GetDirectoryName(path)!); File.WriteAllText(path, content); }
StorageDatabase Database(string root) => new(root);
object? Scalar(string root, string sql)
{
    using var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = Database(root).DatabasePath, Pooling = false }.ToString());
    connection.Open(); using var command = connection.CreateCommand(); command.CommandText = sql; return command.ExecuteScalar();
}
JsonArray Array(string json) => JsonNode.Parse(json) as JsonArray ?? throw new Exception("Expected array");

tests.Add(("ownership boundaries and bootstrap contracts", () =>
{
    string root = Root("ownership"); var policy = new StoragePathPolicy(root);
    foreach (string owned in new[] { "users.json", "users/a/games.json", "users/a/controls.json", "GoogleTokens/a/token.token.json", "browser-profiles/profiles-v2.json", "browser-profiles/.profile-schema-v2", "device-id.txt", "intros/active.json", "extensions/extensions.json" })
        Assert(policy.TryGetKey(Data(root, owned), out _, out _), "Owned path omitted: " + owned);
    foreach (string external in new[] { "browser-profiles/webapps/Default/Preferences", "extensions/ext/manifest.json", "intros/theme/manifest.json", "roms/metadata.json", "GoogleTokens/a/token.dpapi", "boot-startup-experiment.json", "google-oauth.local.json" })
        Assert(!policy.TryGetKey(Data(root, external), out _, out _), "External path captured: " + external);
    foreach (string bootstrap in new[] { "state.json", "manifest-state.json", "manifest-cache.json" })
        Assert(!policy.TryGetKey(Path.Combine(root, "updates", bootstrap), out _, out _), "Bootstrap protocol must remain physical");
    Assert(!policy.TryGetKey(Path.Combine(root, "..", "outside", "Data", "users.json"), out _, out _), "Path traversal escaped ownership");
}));

tests.Add(("idempotent import, backup recovery, raw text and provenance", () =>
{
    string root = Root("import");
    Legacy(Data(root, "users/a/games.json"), "corrupt{");
    Legacy(Data(root, "users/a/games.json.bak"), "[{\"Name\":\"Game\",\"Path\":\"C:/games/game.exe\",\"TotalPlaytimeMinutes\":7}]");
    Legacy(Data(root, "users.json"), "[{\"Id\":\"a\",\"Name\":\"Alice\"}]");
    Legacy(Data(root, "current-user.json"), "a");
    Legacy(Data(root, "device-id.txt"), "device-123");
    Legacy(Data(root, "extensions/vendor/manifest.json"), "not an internal document");
    var result = StateStorage.Initialize(root);
    Assert(result.ImportedDocuments == 4 && result.RecoveredFromBackup == 1, "Import counts incorrect");
    Assert(File.Exists(Path.Combine(result.BackupDirectory, "Data", "users", "a", "games.json")), "Original corrupt source was not retained");
    Assert(StateStorage.ReadAllText(Data(root, "current-user.json")) == "a", "Legacy current-user is raw text");
    Assert(StateStorage.ReadAllText(Data(root, "device-id.txt")) == "device-123", "Text document changed");
    var game = Array(StateStorage.ReadAllText(Data(root, "users/a/games.json")))[0]!;
    Assert(game["Id"]!.ToString().Length > 0 && game["TotalPlaytimeMinutes"]!.GetValue<int>() == 7, "Typed row failed import");
    Assert((long)Scalar(root, "SELECT count(*) FROM migration_provenance WHERE recovered=1")! == 1, "Recovery provenance missing");
    Assert((string)Scalar(root, "SELECT content FROM documents WHERE path='data/users/a/games.json'")! == "{}", "Document duplicates canonical collection");
    Assert(StateStorage.Initialize(root).AlreadyMigrated, "Import is not idempotent");
    Legacy(Data(root, "users/a/games.json.bak"), "[]");
    Assert(Array(StateStorage.ReadAllText(Data(root, "users/a/games.json"))).Count == 1, "Runtime reimported changed legacy source");
}));

tests.Add(("invalid source blocks cutover and rolls back complete import", () =>
{
    string root = Root("corrupt");
    Legacy(Data(root, "users.json"), "[{\"Id\":\"a\"}]");
    Legacy(Data(root, "users/a/games.json"), "not json");
    Throws<StorageMigrationException>(() => StateStorage.Initialize(root), "Corruption was treated as empty data");
    Assert((long)Scalar(root, "SELECT count(*) FROM documents")! == 0, "Partial import committed");
    Assert(File.ReadAllText(Data(root, "users/a/games.json")) == "not json", "Source was overwritten");
    Legacy(Data(root, "users/a/games.json.bak"), "[]");
    Assert(StateStorage.Initialize(root).RecoveredFromBackup == 1, "Failed migration cannot resume from repaired source");
}));

tests.Add(("semantic corruption uses valid backup rather than dropping entities", () =>
{
    string root = Root("semantic-corruption"); string path = Data(root, "users/a/games.json");
    Legacy(path, "[{\"Id\":\"same\",\"Name\":\"One\"},{\"Id\":\"same\",\"Name\":\"Two\"}]");
    Legacy(path + ".bak", "[{\"Id\":\"valid\",\"Name\":\"Restored\"}]");
    var result = StateStorage.Initialize(root);
    Assert(result.RecoveredFromBackup == 1, "Semantic corruption did not try the backup");
    Assert(Array(StateStorage.ReadAllText(path))[0]!["Id"]!.ToString() == "valid", "Semantic recovery lost the valid entity");
}));

tests.Add(("stable entity identity survives reorder and item patches", () =>
{
    string root = Root("identity"); string path = Data(root, "users/a/games.json"); StateStorage.Initialize(root);
    StateStorage.WriteAllText(path, "[{\"Name\":\"One\",\"Path\":\"one.exe\"},{\"Name\":\"Two\",\"Path\":\"two.exe\"}]");
    JsonArray first = Array(StateStorage.ReadAllText(path));
    string oneId = first[0]!["Id"]!.ToString(), twoId = first[1]!["Id"]!.ToString();
    StateStorage.WriteAllText(path, new JsonArray(first[1]!.DeepClone(), first[0]!.DeepClone()).ToJsonString());
    JsonArray reordered = Array(StateStorage.ReadAllText(path));
    Assert(reordered[0]!["Id"]!.ToString() == twoId && reordered[1]!["Id"]!.ToString() == oneId, "Reorder changed entity IDs");
    long revision = StateStorage.GetRevision(path);
    long unrelatedVersion = (long)Scalar(root, "SELECT version FROM games WHERE name='Two'")!;
    StateStorage.UpdateCollectionItem(path, oneId, "{\"Name\":\"Renamed\",\"TotalPlaytimeMinutes\":12}", revision);
    Assert(Array(StateStorage.ReadAllText(path))[1]!["Id"]!.ToString() == oneId, "Patch changed identity");
    Assert((long)Scalar(root, "SELECT playtime_minutes FROM games WHERE name='Renamed'")! == 12, "Typed columns not patched");
    Assert((long)Scalar(root, "SELECT version FROM games WHERE name='Two'")! == unrelatedVersion, "Patch rewrote unrelated entity");
    Throws<StorageConflictException>(() => StateStorage.UpdateCollectionItem(path, oneId, "{\"Name\":\"Lost\"}", revision), "Stale item patch succeeded");
    Throws<ArgumentException>(() => StateStorage.UpdateCollectionItem(path, oneId, "{\"OwnerUserId\":\"b\"}", StateStorage.GetRevision(path)), "Owner can be patched");
}));

tests.Add(("ambiguous legacy duplicates are preserved and recorded", () =>
{
    string root = Root("duplicates"); string path = Data(root, "users/a/games.json"); StateStorage.Initialize(root);
    StateStorage.WriteAllText(path, "[{\"Name\":\"Game\",\"Path\":\"same.exe\"},{\"Name\":\"Game\",\"Path\":\"same.exe\"}]");
    var games = Array(StateStorage.ReadAllText(path));
    Assert(games.Count == 2 && games[0]!["Id"]!.ToString() != games[1]!["Id"]!.ToString(), "Duplicate legacy items were lost");
    Assert((long)Scalar(root, "SELECT count(*) FROM identity_conflicts")! == 1, "Duplicate identity decision missing");
    Throws<InvalidDataException>(() => StateStorage.WriteAllText(path, "[{\"Id\":\"duplicate\"},{\"Id\":\"duplicate\"}]"), "Duplicate explicit IDs accepted");
    Assert(Array(StateStorage.ReadAllText(path)).Count == 2, "Invalid replacement damaged canonical data");
}));

tests.Add(("normalized controls, generic collections and cache arrays", () =>
{
    string root = Root("collections"); StateStorage.Initialize(root);
    string controls = Data(root, "users/a/controls.json");
    StateStorage.WriteAllText(controls, "{\"SchemaVersion\":8,\"Profiles\":[{\"Id\":\"p\",\"Name\":\"Profile\",\"Bindings\":[{\"Id\":\"b\",\"Trigger\":\"hold\",\"Action\":{\"Type\":\"keyboard\"}}]}],\"Assignments\":[{\"ProfileId\":\"p\",\"TargetKind\":\"media\",\"TargetId\":\"app\"}]}");
    var restored = JsonNode.Parse(StateStorage.ReadAllText(controls))!;
    Assert(restored["Profiles"]![0]!["Bindings"]![0]!["Id"]!.ToString() == "b", "Control binding failed reconstruction");
    Assert((long)Scalar(root, "SELECT count(*) FROM control_bindings")! == 1 && (long)Scalar(root, "SELECT count(*) FROM control_assignments")! == 1, "Controls are not normalized");
    Assert(JsonNode.Parse((string)Scalar(root, "SELECT payload FROM control_profiles")!)!["Bindings"]!.AsArray().Count == 0, "Binding list duplicated inside profile authority");
    string media = Data(root, "users/a/media.json"); StateStorage.WriteAllText(media, "[{\"Id\":\"m\",\"Name\":\"Music\"}]");
    Assert((long)Scalar(root, "SELECT count(*) FROM entities")! == 1, "Media catalog remains a document blob");
    string cache = Data(root, "users/a/appcache.json"); StateStorage.WriteAllText(cache, "{\"LastUpdated\":\"now\",\"SteamApps\":[{\"Name\":\"Cached\",\"Path\":\"cached.exe\"}],\"FolderPaths\":[\"C:/games\"]}");
    Assert((long)Scalar(root, "SELECT count(*) FROM nested_entities")! == 1 && (long)Scalar(root, "SELECT count(*) FROM installed_apps")! == 1, "Cache catalog and metadata were not separated");
    Assert(JsonNode.Parse(StateStorage.ReadAllText(cache))!["SteamApps"]![0]!["Name"]!.ToString() == "Cached", "Cache reconstruction failed");
    StateStorage.Delete(controls);
    Assert((long)Scalar(root, "SELECT count(*) FROM control_bindings")! == 0, "Foreign key cascade left orphan bindings");
    Assert(Database(root).CheckIntegrity() == "ok", "Foreign key integrity failed");
}));

tests.Add(("snapshot CAS rejects lost updates and commits related state atomically", () =>
{
    string root = Root("cas"); StateStorage.Initialize(root);
    string first = Data(root, "users/a/display-settings.json"), second = Data(root, "users/a/browser-settings.json");
    StateStorage.WriteBatch(new Dictionary<string, string?> { [first] = "{\"v\":1}", [second] = "{\"v\":1}" });
    var snapshot = StateStorage.ReadSnapshot(new[] { first, second });
    StateStorage.WriteAllText(second, "{\"v\":2}");
    Throws<StorageConflictException>(() => StateStorage.WriteBatchIfRevision(new Dictionary<string, string?> { [first] = "{\"v\":3}", [second] = "{\"v\":3}" }, snapshot.Revisions), "Stale snapshot committed");
    Assert(JsonNode.Parse(StateStorage.ReadAllText(first))!["v"]!.GetValue<int>() == 1, "Failed CAS partially wrote related state");
    var fresh = StateStorage.ReadSnapshot(new[] { first, second });
    StateStorage.WriteBatchIfRevision(new Dictionary<string, string?> { [first] = "{\"v\":4}", [second] = null }, fresh.Revisions);
    Assert(!StateStorage.Exists(second) && JsonNode.Parse(StateStorage.ReadAllText(first))!["v"]!.GetValue<int>() == 4, "Atomic write/delete failed");
    Throws<Exception>(() => StateStorage.ExecuteTransaction(root, () => { StateStorage.WriteAllText(first, "{\"v\":5}"); throw new Exception("fixture rollback"); }), "Exception did not escape transaction");
    Assert(JsonNode.Parse(StateStorage.ReadAllText(first))!["v"]!.GetValue<int>() == 4, "Ambient transaction did not roll back");
}));

tests.Add(("profile isolation, virtual deletion and logical enumeration", () =>
{
    string root = Root("isolation"); Legacy(Data(root, "games.json"), "[{\"Name\":\"Global\"}]"); StateStorage.Initialize(root);
    Assert(!StateStorage.Exists(Data(root, "users/b/games.json")), "Missing profile fell back to a global mirror");
    string path = Data(root, "users/a/games.json"); StateStorage.WriteAllText(path, "[]");
    Legacy(path, "[{\"Name\":\"Old physical file\"}]"); StateStorage.Delete(path);
    Assert(!StateStorage.Exists(path), "Deleted state resurrected legacy JSON");
    Throws<FileNotFoundException>(() => StateStorage.ReadAllText(path), "Deleted logical path fell back to physical file");
    string backupPath = Data(root, "users/a/sync-backups/backup-1/cloud-profile.json"); StateStorage.WriteAllText(backupPath, "{\"SchemaVersion\":5}");
    Assert(StateStorage.EnumerateDocuments(Data(root, "users/a/sync-backups")).Single().Equals(backupPath, StringComparison.OrdinalIgnoreCase), "Logical backup enumeration requires physical directories");
    StateStorage.DeletePrefix(Data(root, "users/a/sync-backups")); Assert(!StateStorage.Exists(backupPath), "Prefix deletion failed");
}));

tests.Add(("cross-owner payloads and SQL rows are rejected", () =>
{
    string root = Root("owner-constraints"); StateStorage.Initialize(root);
    string user = Data(root, "users/a/user.json"), games = Data(root, "users/a/games.json");
    Throws<InvalidDataException>(() => StateStorage.WriteAllText(user, "{\"Id\":\"b\",\"Name\":\"Other\"}"), "Wrong profile entity was written to target owner");
    Throws<InvalidDataException>(() => StateStorage.WriteAllText(games, "[{\"Name\":\"Other\",\"OwnerUserId\":\"b\"}]"), "Cross-owner payload was accepted");
    Throws<InvalidDataException>(() => StateStorage.WriteAllText(Data(root, "users/a/controls.json"), "{\"Profiles\":[{\"Id\":\"p\",\"OwnerUserId\":\"b\"}],\"Assignments\":[]}"), "Cross-owner control profile was accepted");
    StateStorage.WriteAllText(games, "[{\"Name\":\"Owned\",\"Path\":\"owned.exe\"}]");
    using var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = Database(root).DatabasePath, Pooling = false, ForeignKeys = true }.ToString());
    connection.Open(); using var command = connection.CreateCommand(); command.CommandText = "UPDATE games SET owner_id='b'";
    Throws<SqliteException>(() => command.ExecuteNonQuery(), "SQL constraint allowed entity owner to differ from source document owner");
}));

tests.Add(("bounded file inventories preserve scan uncertainty", () =>
{
    string root = Path.Combine(suiteRoot, "inventory"); Directory.CreateDirectory(root);
    for (int index = 0; index < 5; index++) File.WriteAllText(Path.Combine(root, index + ".rom"), "");
    var bounded = FileInventory.Scan(root, maxFiles: 3);
    Assert(bounded.Files.Count == 3 && !bounded.Complete, "Truncated inventory claimed completeness");
    var exact = FileInventory.Scan(root, maxFiles: 5);
    Assert(exact.Files.Count == 5 && exact.Complete, "Exact-size inventory was incorrectly marked incomplete");
    var missing = FileInventory.Scan(Path.Combine(root, "missing"));
    Assert(!missing.Complete && missing.UnavailableDirectories.Count == 1, "Unavailable root was reported as empty success");
    using var cancellation = new CancellationTokenSource(); cancellation.Cancel();
    Throws<OperationCanceledException>(() => FileInventory.Scan(root, cancellationToken: cancellation.Token), "Scan ignored cancellation");
}));

tests.Add(("consistent SQLite backup and updater checkpoint rollback", () =>
{
    string root = Root("backup"); string path = Data(root, "display-settings.json"); Legacy(path, "{\"v\":1}");
    var checkpoint = StorageMigration.Prepare(root, "operation-1"); Assert(!checkpoint.HadDatabase, "First cutover checkpoint misdetected database");
    StateStorage.WriteAllText(path, "{\"v\":2}"); StorageMigration.Restore(checkpoint);
    Assert(!File.Exists(Database(root).DatabasePath), "Rollback to legacy did not remove new schema");
    Assert(File.ReadAllText(path) == "{\"v\":1}", "Rollback altered legacy source");
    StateStorage.Initialize(root);
    var db = Database(root); string backup = Path.Combine(root, "snapshot.db"); db.BackupTo(backup);
    StateStorage.WriteAllText(path, "{\"v\":3}"); db.RestoreFrom(backup);
    Assert(JsonNode.Parse(db.ReadAllText(path))!["v"]!.GetValue<int>() == 1, "Online SQLite backup could not restore");
    Assert(StorageMigration.LoadCheckpoint(root, "operation-1") == checkpoint, "Checkpoint receipt cannot be recovered after process interruption");
    Throws<ArgumentException>(() => StorageMigration.GetBackupDirectory(root, "../escape"), "Checkpoint operation ID permits traversal");
}));

tests.Add(("uncommitted process interruption recovers previous state", () =>
{
    string root = Root("interruption"); string path = Data(root, "display-settings.json"); StateStorage.Initialize(root); StateStorage.WriteAllText(path, "{\"value\":\"before\"}");
    var start = new ProcessStartInfo("dotnet") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
    start.ArgumentList.Add(typeof(Program).Assembly.Location); start.ArgumentList.Add("--interrupt-transaction"); start.ArgumentList.Add(root);
    using var process = Process.Start(start) ?? throw new Exception("Fixture process failed to start");
    if (!process.WaitForExit(20000)) { process.Kill(entireProcessTree: true); throw new Exception("Fixture process timed out"); }
    Assert(process.ExitCode == 23, "Fixture did not exit at the intended transaction boundary: " + process.StandardError.ReadToEnd());
    Assert(JsonNode.Parse(StateStorage.ReadAllText(path))!["value"]!.ToString() == "before", "Uncommitted process crash left partial data");
    Assert(Database(root).CheckIntegrity() == "ok", "SQLite recovery integrity failed");
}));

tests.Add(("independent writers serialize and reject stale revision", () =>
{
    string root = Root("writers"); string path = Data(root, "display-settings.json"); StateStorage.Initialize(root); StateStorage.WriteAllText(path, "{\"v\":0}");
    long revision = StateStorage.GetRevision(path); int committed = 0, conflicts = 0;
    Parallel.For(0, 6, index =>
    {
        var database = Database(root);
        try { database.WriteBatchIfRevision(new Dictionary<string, string?> { [path] = "{\"v\":" + (index + 1) + "}" }, new Dictionary<string, long> { [path] = revision }); Interlocked.Increment(ref committed); }
        catch (StorageConflictException) { Interlocked.Increment(ref conflicts); }
    });
    Assert(committed == 1 && conflicts == 5, "Concurrent independent connections lost updates");
    string version = (string)Scalar(root, "SELECT sqlite_version()")!;
    Assert(Version.Parse(version) >= new Version(3, 53, 4), "Native SQLite runtime is older than the validated bundle");
    Console.WriteLine("SQLite native version: " + version + "; journal=" + Scalar(root, "PRAGMA journal_mode"));
}));

tests.Add(("pathless APIs use the explicitly configured fixture root", () =>
{
    string first = Root("configured-first"), second = Root("configured-second");
    StateStorage.Initialize(first); StateStorage.WriteAllText(Data(first, "display-settings.json"), "{\"v\":1}");
    StateStorage.Initialize(second); StateStorage.WriteAllText(Data(second, "display-settings.json"), "{\"v\":2}");
    StateStorage.ExecuteTransaction(() => StateStorage.WriteAllText(Data(second, "display-settings.json"), "{\"v\":3}"));
    string backup = Path.Combine(suiteRoot, "configured-snapshot.db"); StateStorage.CreateBackup(backup);
    using var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = backup, Mode = SqliteOpenMode.ReadOnly, Pooling = false }.ToString());
    connection.Open(); using var command = connection.CreateCommand(); command.CommandText = "SELECT content FROM documents WHERE path='data/display-settings.json'";
    Assert(JsonNode.Parse((string)command.ExecuteScalar()!)!["v"]!.GetValue<int>() == 3, "Pathless backup selected a different root");
    Assert(JsonNode.Parse(StateStorage.ReadAllText(Data(first, "display-settings.json")))!["v"]!.GetValue<int>() == 1, "Pathless transaction modified another root");
    Assert(StateStorage.CheckIntegrity() == "ok", "Configured fixture integrity failed");
}));

tests.Add(("collection imports preserve unchanged rows and version only changed entities", () =>
{
    string root = Root("incremental-import"), path = Data(root, "users/a/games.json");
    StateStorage.Initialize(root);
    StateStorage.WriteAllText(path, "[{\"Id\":\"one\",\"Name\":\"One\"},{\"Id\":\"two\",\"Name\":\"Two\"}]");
    long rowid = (long)Scalar(root, "SELECT rowid FROM games WHERE id='one'")!;
    StateStorage.WriteAllText(path, "[{\"Id\":\"one\",\"Name\":\"One\"},{\"Id\":\"two\",\"Name\":\"Changed\"}]");
    Assert((long)Scalar(root, "SELECT rowid FROM games WHERE id='one'")! == rowid, "Unchanged row was replaced");
    Assert((long)Scalar(root, "SELECT version FROM games WHERE id='one'")! == 1, "Unchanged entity version advanced");
    Assert((long)Scalar(root, "SELECT version FROM games WHERE id='two'")! == 2, "Changed entity version did not advance");
    var snapshot = StateStorage.ReadEntitySnapshot(path);
    Assert(snapshot.Revision == StateStorage.GetRevision(path) && snapshot.Entities.Count == 2, "Entity snapshot revision mismatch");
    Assert(snapshot.Entities[1].Payload.Contains("Changed"), "Entity snapshot returned stale data");
    StateStorage.WriteAllText(path, "[{\"Id\":\"two\",\"Name\":\"Changed\"}]");
    Assert((long)Scalar(root, "SELECT count(*) FROM games WHERE id='one'")! == 0, "Removed entity remained in SQL");
    Assert((long)Scalar(root, "SELECT ordinal FROM games WHERE id='two'")! == 0, "Reorder was not persisted");
    StateStorage.WriteAllText(path, "[]");
    Assert(StateStorage.ReadEntitySnapshot(path).Entities.Count == 0, "Empty import did not delete previous entities");
}));

tests.Add(("local catalog migration, incremental writes and rollback preserve machine data", () =>
{
    string root = Root("catalog-upgrade"), path = Data(root, "users/a/appcache.json");
    StateStorage.Initialize(root);
    string content = "{\"SteamFingerprint\":[\"fingerprint\"],\"FolderTimestamps\":{\"C:/games\":12},\"AutoAddSuppressions\":[{\"Key\":\"deleted\"}],\"SteamApps\":[{\"Name\":\"Local only\",\"Path\":\"C:/games/one.exe\",\"IconBase64\":\"icon\"}]}";
    StateStorage.WriteAllText(path, content);
    var cache = StateStorage.ReadAppCacheSnapshot(path);
    Assert(cache.Collections["SteamApps"].Count == 1 && cache.Collections["SteamFingerprint"].Count == 1, "Catalog snapshot lost apps or fingerprints");
    Assert(cache.MetadataJson.Contains("C:/games"), "Folder metadata was lost");
    StateStorage.WriteAllText(path, content);
    Assert((long)Scalar(root, "SELECT version FROM installed_apps")! == 1, "Unchanged catalog row was rewritten");
    // Reproduce the former schema-1 authority from a real collection payload.
    Scalar(root, "INSERT INTO nested_entities(source_path,collection_name,id,owner_id,ordinal,payload) SELECT source_path,collection_name,id,owner_id,ordinal,payload FROM installed_apps; DROP TABLE installed_apps; PRAGMA user_version=1;");
    var checkpoint = StorageMigration.Prepare(root, "schema-two");
    using (var old = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = Path.Combine(checkpoint.BackupDirectory, "doorpi.db"), Mode = SqliteOpenMode.ReadOnly, Pooling = false }.ToString()))
    {
        old.Open(); using var version = old.CreateCommand(); version.CommandText = "PRAGMA user_version";
        Assert((long)version.ExecuteScalar()! == 1, "Updater checkpoint upgraded the schema before backing it up");
    }
    var upgraded = Database(root).ReadAppCacheSnapshot(path);
    Assert(upgraded.Collections["SteamApps"].Single().Contains("Local only"), "Schema-1 migration lost the local catalog");
    Assert((long)Scalar(root, "PRAGMA user_version")! == 2, "Schema version did not advance");
    Assert((long)Scalar(root, "SELECT count(*) FROM nested_entities WHERE collection_name='SteamApps'")! == 0, "Duplicate catalog authority remains");
    Assert(Directory.GetFiles(Path.Combine(root, "storage", "schema-backups"), "*.db").Length > 0, "No pre-schema-upgrade backup was created");
    StorageMigration.Restore(checkpoint);
    Assert((long)Scalar(root, "PRAGMA user_version")! == 1, "Rollback did not restore the original schema");
    Assert(Database(root).ReadAppCacheSnapshot(path).Collections["SteamApps"].Count == 1, "Retry after rollback is not idempotent");
}));

tests.Add(("failed catalog schema upgrade rolls back and can resume", () =>
{
    string root = Root("catalog-failed-upgrade"), path = Data(root, "users/a/appcache.json");
    StateStorage.Initialize(root);
    StateStorage.WriteAllText(path, "{\"SteamApps\":[{\"Name\":\"Preserved\",\"Path\":\"one.exe\"}]}");
    Scalar(root, "INSERT INTO nested_entities(source_path,collection_name,id,owner_id,ordinal,payload) SELECT source_path,collection_name,id,owner_id,ordinal,payload FROM installed_apps; DELETE FROM installed_apps; PRAGMA user_version=1; CREATE TRIGGER fail_upgrade BEFORE INSERT ON installed_apps BEGIN SELECT RAISE(ABORT,'simulated upgrade failure'); END;");
    Throws<SqliteException>(() => Database(root).ReadAppCacheSnapshot(path), "Simulated migration failure was swallowed");
    Assert((long)Scalar(root, "PRAGMA user_version")! == 1, "Failed migration committed a new schema version");
    Assert((long)Scalar(root, "SELECT count(*) FROM nested_entities WHERE collection_name='SteamApps'")! == 1, "Failed migration removed its source");
    Scalar(root, "DROP TRIGGER fail_upgrade");
    Assert(Database(root).ReadAppCacheSnapshot(path).Collections["SteamApps"].Single().Contains("Preserved"), "Retry lost the source application");
}));

int failed = 0;
foreach (var test in tests)
{
    try { test.Test(); Console.WriteLine("PASS " + test.Name); }
    catch (Exception exception) { failed++; Console.Error.WriteLine("FAIL " + test.Name + ": " + exception); }
}
Console.WriteLine($"{tests.Count - failed}/{tests.Count} test groups passed; {assertions} assertions; fixtures: {suiteRoot}");
Environment.ExitCode = failed == 0 ? 0 : 1;
