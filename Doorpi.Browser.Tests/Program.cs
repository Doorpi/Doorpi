using Doorpi;

var directory = Path.GetFullPath(Path.Combine(args.FirstOrDefault() ?? "artifacts/browser-permission-tests", Guid.NewGuid().ToString("N")));
Directory.CreateDirectory(directory);
var file = Path.Combine(directory, "permissions.json");
var store = new BrowserPermissionStore(file);
int checks = 0;
void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
    checks++;
}
void Throws(Action action, string message)
{
    bool threw = false;
    try { action(); } catch { threw = true; }
    Check(threw, message);
}

Check(BrowserPermissionStore.NormalizeOrigin("https://EXAMPLE.com:443/path?x=1#test") == "https://example.com", "Canonical origin");
Check(BrowserPermissionStore.NormalizeOrigin("https://example.com:8443/other") == "https://example.com:8443", "Nondefault port isolated");
Check(BrowserPermissionStore.NormalizeOrigin("http://localhost:8080/test") == "http://localhost:8080", "Loopback development origin");
foreach (var invalid in new[] { "file:///tmp/page", "https://user:pass@example.com", "data:text/html,test", "http://example.com", "https://", "" })
    Check(BrowserPermissionStore.NormalizeOrigin(invalid) == null, "Rejected origin: " + invalid);

foreach (var kind in new[] { BrowserPermissionAppKind.Internal, BrowserPermissionAppKind.Streaming, BrowserPermissionAppKind.Utility })
    Check(!BrowserPermissionPolicy.CanAsk(kind), "Noninteractive context blocked");
Check(BrowserPermissionPolicy.CanAsk(BrowserPermissionAppKind.Browser), "Generic browser can ask");
Check(BrowserPermissionPolicy.CanAsk(BrowserPermissionAppKind.RegisteredApp), "Registered app can ask");
Check(BrowserPermissionPolicy.Classify(false, false, true, true) == BrowserPermissionAppKind.Streaming, "Integrated streaming is not made eligible by appearing in media storage");
Check(BrowserPermissionPolicy.Classify(false, true, true, true) == BrowserPermissionAppKind.Browser, "Generic browser is distinguished from integrated streaming");
Check(BrowserPermissionPolicy.Classify(true, true, false, true) == BrowserPermissionAppKind.Utility, "Utility/capture context remains blocked");
Check(BrowserPermissionPolicy.Classify(false, false, false, false) == BrowserPermissionAppKind.Internal, "Unregistered context remains blocked");

const string origin = "https://calls.example";
store.Save("alice", "calls", "Calls", origin, BrowserPermissionResource.Camera, true);
Check(store.Find("alice", "calls", origin, BrowserPermissionResource.Camera)?.Allowed == true, "Explicit grant saved");
Check(store.Find("bob", "calls", origin, BrowserPermissionResource.Camera) == null, "Shared app does not share authorization between users");
Check(store.Find("alice", "browser", origin, BrowserPermissionResource.Camera) == null, "App isolation");
Check(store.Find("alice", "calls", "https://other.example", BrowserPermissionResource.Camera) == null, "Site isolation");
Check(store.Find("alice", "calls", "https://calls.example:8443", BrowserPermissionResource.Camera) == null, "Port isolation");
Check(store.Find("alice", "calls", origin, BrowserPermissionResource.Microphone) == null, "Resource isolation");

store.Save("alice", "calls", "Calls", origin, BrowserPermissionResource.Microphone, false);
store.Save("bob", "calls", "Calls", origin, BrowserPermissionResource.Camera, true);
var reopened = new BrowserPermissionStore(file);
Check(reopened.Find("alice", "calls", origin, BrowserPermissionResource.Camera)?.Allowed == true, "Grant survives process restart");
Check(reopened.Find("alice", "calls", origin, BrowserPermissionResource.Microphone)?.Allowed == false, "Explicit denial survives process restart");
Check(reopened.List("alice").Length == 2 && reopened.List("bob").Length == 1, "Settings only list active user's decisions");
var aliceCamera = reopened.Find("alice", "calls", origin, BrowserPermissionResource.Camera)!;
Check(reopened.Revoke("bob", aliceCamera.Id) == null, "Forged cross-user revocation rejected");
Check(reopened.Revoke("alice", aliceCamera.Id)?.Allowed == true, "Grant revoked");
Check(new BrowserPermissionStore(file).Find("alice", "calls", origin, BrowserPermissionResource.Camera) == null, "Revocation persisted; next use asks again");
Check(reopened.Find("alice", "calls", origin, BrowserPermissionResource.Microphone)?.Allowed == false, "Revocation preserves other resource");
Check(reopened.Find("bob", "calls", origin, BrowserPermissionResource.Camera)?.Allowed == true, "Revocation preserves other user");

store = new BrowserPermissionStore(file);
store.Save("alice", "calls", "Calls", origin, BrowserPermissionResource.Camera, false);
store.Save("alice", "calls", "Calls", origin, BrowserPermissionResource.Camera, true);
Check(store.List("alice").Count(item => item.Resource == BrowserPermissionResource.Camera) == 1, "Replacing a decision creates no duplicates");
Check(File.Exists(file + ".bak"), "Atomic persistence keeps backup");
var sqliteRoot = Path.Combine(directory, "sqlite-state");
Doorpi.Storage.StateStorage.Initialize(sqliteRoot);
var sqliteFile = Path.Combine(sqliteRoot, "Data", "web-permissions.json");
var sqliteStore = new BrowserPermissionStore(sqliteFile);
sqliteStore.Save("alice", "calls", "Calls", origin, BrowserPermissionResource.Camera, true);
sqliteStore.Save("bob", "calls", "Calls", origin, BrowserPermissionResource.Microphone, false);
Check(new BrowserPermissionStore(sqliteFile).Find("alice", "calls", origin, BrowserPermissionResource.Camera)?.Allowed == true, "SQLite grant survives store restart");
Check(new BrowserPermissionStore(sqliteFile).Find("bob", "calls", origin, BrowserPermissionResource.Microphone)?.Allowed == false, "SQLite denial survives store restart");
Check(new BrowserPermissionStore(sqliteFile).Find("bob", "calls", origin, BrowserPermissionResource.Camera) == null, "SQLite permissions preserve user boundary");
Check(Doorpi.Storage.StateStorage.Exists(sqliteFile + ".bak"), "SQLite keeps recoverable permission revision");
Check(!File.Exists(sqliteFile), "SQLite permission writes do not create a JSON file");
sqliteStore.List("alice");
var anotherSqliteStore = new BrowserPermissionStore(sqliteFile);
anotherSqliteStore.Save("charlie", "calls", "Calls", origin, BrowserPermissionResource.Camera, true);
sqliteStore.Save("alice", "calls", "Calls", origin, BrowserPermissionResource.Microphone, false);
Check(new BrowserPermissionStore(sqliteFile).Find("charlie", "calls", origin, BrowserPermissionResource.Camera)?.Allowed == true, "Stale store reloads revision before writing and preserves another writer's decision");
var sqliteCamera = anotherSqliteStore.Find("alice", "calls", origin, BrowserPermissionResource.Camera)!;
anotherSqliteStore.Revoke("alice", sqliteCamera.Id);
Check(sqliteStore.Find("alice", "calls", origin, BrowserPermissionResource.Camera) == null, "SQLite cache observes another store's revocation");
Throws(() => store.Save("alice", "calls", "Calls", "https://calls.example/path", BrowserPermissionResource.Camera, true), "Store rejects noncanonical identity");
Throws(() => store.Save("", "calls", "Calls", origin, BrowserPermissionResource.Camera, true), "Store rejects empty user");

var corruptFile = Path.Combine(directory, "corrupt.json");
File.WriteAllText(corruptFile, "{broken");
var corrupt = new BrowserPermissionStore(corruptFile);
Throws(() => corrupt.Find("alice", "calls", origin, BrowserPermissionResource.Camera), "Corrupt store does not grant");
Throws(() => corrupt.Save("alice", "calls", "Calls", origin, BrowserPermissionResource.Camera, true), "Corrupt store is not silently replaced");
Check(File.ReadAllText(corruptFile) == "{broken", "Corrupt original preserved");
var futureFile = Path.Combine(directory, "future.json");
File.WriteAllText(futureFile, "{\"SchemaVersion\":2,\"Decisions\":[]}");
Throws(() => new BrowserPermissionStore(futureFile).List("alice"), "Unknown schema rejected");
var incompleteFile = Path.Combine(directory, "incomplete.json");
File.WriteAllText(incompleteFile, "{}");
Throws(() => new BrowserPermissionStore(incompleteFile).List("alice"), "Missing schema/decisions rejected instead of resetting data");
var validDocument = File.ReadAllText(file);
var missingResource = validDocument.Replace("\"Resource\":0,", "").Replace("\"Resource\":1,", "");
File.WriteAllText(incompleteFile, missingResource);
Throws(() => new BrowserPermissionStore(incompleteFile).List("alice"), "Incomplete decision cannot become an implicit camera grant");

// A failed atomic write must not update the in-memory authorization either.
var failedFile = Path.Combine(directory, "blocked", "permissions.json");
var failed = new BrowserPermissionStore(failedFile);
Check(failed.List("alice").Length == 0, "Empty store initialized before failure");
File.WriteAllText(Path.GetDirectoryName(failedFile)!, "not a directory");
Throws(() => failed.Save("alice", "calls", "Calls", origin, BrowserPermissionResource.Camera, true), "Write failure reported");
Check(failed.Find("alice", "calls", origin, BrowserPermissionResource.Camera) == null, "Write failure does not grant from memory");

async Task ThrowsAsync(Func<Task> action, string message)
{
    bool threw = false;
    try { await action(); } catch { threw = true; }
    Check(threw, message);
}
var requestStore = new BrowserPermissionStore(Path.Combine(directory, "requests.json"));
var service = new BrowserPermissionService(requestStore);
var request = new BrowserPermissionRequest("alice", "chat", "Chat", origin, BrowserPermissionResource.Camera);
var promptStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
var answer = new TaskCompletionSource<bool?>(TaskCreationOptions.RunContinuationsAsynchronously);
int prompts = 0;
var first = service.DecideAsync(request, () => true, _ => { prompts++; promptStarted.SetResult(); return answer.Task; }, default);
await promptStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
var second = service.DecideAsync(request, () => true, _ => { prompts++; return Task.FromResult<bool?>(false); }, default);
answer.SetResult(true);
Check((await Task.WhenAll(first, second)).All(value => value) && prompts == 1, "Concurrent duplicate requests share the saved decision without overlapping prompts");
Check(!await service.DecideAsync(request, () => false, _ => throw new Exception("Should not prompt"), default), "Changed user/context cannot reuse an existing grant");

var transient = request with { Origin = "https://transient.example" };
bool current = true;
Check(!await service.DecideAsync(transient, () => current, _ => { current = false; return Task.FromResult<bool?>(true); }, default), "Navigation/profile change invalidates an answer");
Check(requestStore.Find(transient.UserId, transient.AppKey, transient.Origin, transient.Resource) == null, "Invalidated prompt does not persist a grant");
Check(!await service.DecideAsync(transient, () => true, _ => Task.FromResult<bool?>(null), default), "Closing dialog denies current request");
Check(requestStore.Find(transient.UserId, transient.AppKey, transient.Origin, transient.Resource) == null, "Closing dialog does not save a permanent denial");

using var cancellation = new CancellationTokenSource();
var cancellationStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
var cancelled = service.DecideAsync(transient, () => true, async token =>
{
    cancellationStarted.SetResult();
    await Task.Delay(Timeout.InfiniteTimeSpan, token);
    return true;
}, cancellation.Token);
await cancellationStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
using var queuedCancellation = new CancellationTokenSource();
var queued = service.DecideAsync(transient, () => true, _ => throw new Exception("Cancelled queue must not prompt"), queuedCancellation.Token);
queuedCancellation.Cancel();
await ThrowsAsync(async () => await queued, "Queued request can be cancelled");
cancellation.Cancel();
await ThrowsAsync(async () => await cancelled, "Owner/navigation cancellation releases pending prompt");
Check(requestStore.Find(transient.UserId, transient.AppKey, transient.Origin, transient.Resource) == null, "Cancelled request does not persist authorization");
Check(!await service.DecideAsync(transient, () => true, _ => Task.FromResult<bool?>(false), default), "Queue remains usable after cancellation; explicit block applied");
Check(requestStore.Find(transient.UserId, transient.AppKey, transient.Origin, transient.Resource)?.Allowed == false, "Explicit block saved");
Check(!await service.DecideAsync(transient, () => true, _ => throw new Exception("Saved block must not prompt"), default), "Saved block suppresses repeated prompts");
string resourceRoot = Path.GetFullPath(Path.Combine(directory, "private-data"));
Check(LocalStateResourcePolicy.ResolveStateView("games.json", true, "alice", resourceRoot) == Path.Combine(resourceRoot, "users", "alice", "games.json"), "Home view resolves the current owner explicitly");
Check(LocalStateResourcePolicy.ResolveStateView("users/bob/games.json", true, "alice", resourceRoot) == null, "Home cannot request another user's state view");
Check(LocalStateResourcePolicy.ResolveStateView("games.json", false, "alice", resourceRoot) == null, "External page cannot read local state");
Check(LocalStateResourcePolicy.ResolveStateView("users.json", true, "alice", resourceRoot) == null, "User index is never published as a resource view");
Check(LocalStateResourcePolicy.ResolveStateView("users/alice/profile-sync-base.json", true, "alice", resourceRoot) == null, "Sync snapshots are private");
foreach (string privatePath in new[] { "../storage/doorpi.db", "images/../users/alice/user.json", "images/../../storage/doorpi.db", "images/../users/bob/photo.png", "images/a.png:secret", "images/..\\users\\alice\\user.json", "users/bob/trailers/a.mp4" })
    Check(LocalStateResourcePolicy.ResolveAsset(privatePath, true, "alice", resourceRoot) == null, "Blocked resource escape: " + privatePath);
Check(LocalStateResourcePolicy.ResolveAsset("images/grid/a.png", false, "alice", resourceRoot) != null, "External apps retain access to public image assets");
Check(LocalStateResourcePolicy.ResolveAsset("users/alice/trailers/a.mp4", true, "alice", resourceRoot) != null, "Current owner may load a local trailer");
Check(LocalStateResourcePolicy.ResolveAsset("users/alice/trailers/a.mp4", false, "alice", resourceRoot) == null, "External page cannot fetch private trailers");
Console.WriteLine($"PASS: {checks} browser permission and private resource boundary checks. No devices, registry or user profiles accessed.");
