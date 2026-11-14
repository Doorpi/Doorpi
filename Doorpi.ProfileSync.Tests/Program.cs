using Doorpi.ProfileSync;
using Doorpi.Storage;

string root = Path.GetFullPath(Path.Combine(args.FirstOrDefault() ?? "artifacts/backend-audit/sync-tests", Guid.NewGuid().ToString("N")));
StateStorage.Initialize(root);
string data = Path.Combine(root, "Data");
string a = Path.Combine(data, "users", "a");
string b = Path.Combine(data, "users", "b");
string userA = Path.Combine(a, "user.json"), historyA = Path.Combine(a, "game-history.json"), controlsA = Path.Combine(a, "controls.json");
string userB = Path.Combine(b, "user.json"), controlsB = Path.Combine(b, "controls.json");
string baselineA = Path.Combine(a, "profile-sync-base.json"), stateA = Path.Combine(a, "profile-sync-state.json");
string pendingA = Path.Combine(a, "profile-sync-pending-remote.json");
var oldProfile = new CloudProfileV1 { ProfileId = "a", ProfileName = "old", SchemaVersion = 3 };
var incoming = new CloudProfileV1 { ProfileId = "a", ProfileName = "cloud", SchemaVersion = 3 };
var store = new ProfileSyncLocalStore(a);
string localCatalog = Path.Combine(a, "appcache.json"), localLibrary = Path.Combine(a, "games.json");
StateStorage.WriteAllText(localCatalog, "{\"SteamApps\":[{\"Name\":\"This PC only\",\"Path\":\"D:/local/game.exe\"}]}");
StateStorage.WriteAllText(localLibrary, "[{\"Id\":\"local-game\",\"Name\":\"This PC only\",\"Path\":\"D:/local/game.exe\"}]");
var machineBefore = StateStorage.ReadSnapshot(new[] { localCatalog, localLibrary });
StateStorage.WriteBatch(new Dictionary<string, string?>
{
    [userA] = "{\"name\":\"old\"}", [historyA] = "[]", [controlsA] = "{\"profiles\":[]}",
    [userB] = "{\"name\":\"B\"}", [controlsB] = "{\"profiles\":[{\"id\":\"B\"}]}"
});
await store.SaveSynchronizedAsync(new ProfileSyncState { ProfileId = "a", LastSyncedContentHash = "old" }, oldProfile);
await store.SavePendingAsync(new ProfileSyncState { ProfileId = "a", LastSyncedContentHash = "old", PendingAction = ProfileSyncAction.DownloadRemote }, incoming);
Check((await store.LoadBaseSnapshotAsync())?.ProfileName == "old", "pending download does not advance merge base");
var interrupted = new ProfileSyncState { ProfileId = "a", PendingAction = ProfileSyncAction.DownloadRemote, PendingLocalContentHash = ProfileSyncSerializer.ComputeContentHash(oldProfile) };
Check(ProfileSyncRecovery.Evaluate(interrupted, incoming, oldProfile, incoming) == PendingProfileRecovery.ApplyRemote, "interruption after remote upload resumes exact pending payload without merging increments again");
Check(ProfileSyncRecovery.Evaluate(interrupted, incoming, new CloudProfileV1 { ProfileName = "new-local-edit" }, incoming) == PendingProfileRecovery.Conflict, "interrupted upload protects subsequent local edits");
Check(ProfileSyncRecovery.Evaluate(interrupted, incoming, oldProfile, oldProfile) == PendingProfileRecovery.None, "upload not accepted remotely follows normal merge");
await store.SavePendingAsync(interrupted, incoming);
Check((await new ProfileSyncLocalStore(a).LoadStateAsync()).PendingLocalContentHash == interrupted.PendingLocalContentHash, "interrupted upload intent survives store restart");
string[] observed = [userA, historyA, controlsA, baselineA, stateA, pendingA, pendingA + ".bak"];
var before = StateStorage.ReadSnapshot(observed);
var writes = new Dictionary<string, string?> { [userA] = "{\"name\":\"cloud\"}", [historyA] = "[{\"name\":\"remote\"}]", [controlsA] = "{\"profiles\":[{\"id\":\"remote\"}]}" };
StateStorage.WriteAllText(historyA, "[{\"name\":\"new-local-edit\"}]");
bool conflict = false;
try { await store.SaveSynchronizedAsync(new ProfileSyncState { ProfileId = "a", LastSyncedContentHash = "new" }, incoming, localWrites: writes, expectedRevisions: before.Revisions); }
catch (StorageConflictException) { conflict = true; }
Check(conflict, "concurrent local edit rejects stale cloud apply");
Check(StateStorage.ReadAllText(userA).Contains("old") && !StateStorage.ReadAllText(controlsA).Contains("remote"), "rejected apply leaves profile and controls unchanged");
Check(StateStorage.ReadAllText(historyA).Contains("new-local-edit"), "rejected apply preserves concurrent history edit");
Check((await store.LoadBaseSnapshotAsync())?.ProfileName == "old" && await store.LoadPendingRemoteAsync() != null, "rejected apply preserves old base and pending recovery");
var latest = StateStorage.ReadSnapshot(observed);
await store.SaveSynchronizedAsync(new ProfileSyncState { ProfileId = "a", LastSyncedContentHash = "new" }, incoming, localWrites: writes, expectedRevisions: latest.Revisions);
Check(StateStorage.ReadAllText(userA).Contains("cloud") && StateStorage.ReadAllText(historyA).Contains("remote") && StateStorage.ReadAllText(controlsA).Contains("remote"), "successful apply commits all profile data");
Check((await store.LoadBaseSnapshotAsync())?.ProfileName == "cloud" && await store.LoadPendingRemoteAsync() == null, "successful apply commits base and clears pending atomically");
Check(StateStorage.ReadAllText(userB).Contains("B") && StateStorage.ReadAllText(controlsB).Contains("B"), "explicit profile owner keeps another user unchanged");
Check(machineBefore.Revisions.All(item => StateStorage.GetRevision(item.Key) == item.Value), "cloud profile apply does not rewrite installed catalog or local library");
Check(machineBefore.Documents.All(item => StateStorage.ReadAllText(item.Key) == item.Value), "different cloud history preserves machine-specific applications and executable paths");
for (int i = 0; i < 12; i++) await store.CreateBackupAsync(incoming, "retention-" + i);
Check(StateStorage.EnumerateDocuments(Path.Combine(a, "sync-backups"), "cloud-profile.json").Count == 10, "backup retention keeps ten SQL snapshots");
Check(!Directory.Exists(a) || !Directory.EnumerateFiles(a, "*.json", SearchOption.AllDirectories).Any(), "profile writes and backups do not create JSON files");
Console.WriteLine("PASS: 16 profile sync storage, machine isolation and interruption recovery checks");
Console.WriteLine("Database test root: " + root);

static void Check(bool condition, string description)
{
    if (!condition) throw new InvalidOperationException("FAIL: " + description);
    Console.WriteLine("PASS: " + description);
}
