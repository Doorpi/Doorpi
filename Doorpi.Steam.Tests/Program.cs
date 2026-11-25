using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using Doorpi;
using Doorpi.ProfileSync;
using Doorpi.Steam;
using Doorpi.Storage;

int checks = 0;
SteamAchievementData[] mixedUnlocks = [
    new() { Name="locked rare", GlobalUnlockPercent=0.1 },
    new() { Name="earned common", Unlocked=true, GlobalUnlockPercent=70 },
    new() { Name="unknown" },
    new() { Name="earned rare", Unlocked=true, GlobalUnlockPercent=1 },
    new() { Name="locked common", GlobalUnlockPercent=60 }
];
Check(SteamMedals.InDisplayOrder(mixedUnlocks).Select(item=>item.Name).SequenceEqual(
    new[] {"earned rare","earned common","locked rare","locked common","unknown"}), "Earned trophies must precede locked trophies in rarity order");
Check(SteamMedals.InDisplayOrder(mixedUnlocks.Where(item=>!item.Unlocked)).First().Name=="locked rare", "Locked-only collection must start with rarest");
void Check(bool value, string message) { if (!value) throw new Exception(message); checks++; }
async Task Reject<T>(Func<Task> operation, string message) where T : Exception
{ try { await operation(); } catch (T) { checks++; return; } throw new Exception(message); }
const string id = "76561198000000000", key = "0123456789abcdef0123456789abcdef";
Check(SteamWebApiClient.ParseAccount("https://steamcommunity.com/profiles/" + id) == id, "SteamID URL parsing failed");
Check(SteamWebApiClient.ParseAccount("https://steamcommunity.com/id/my-profile/") == "my-profile", "Vanity URL parsing failed");
await Reject<InvalidDataException>(() => Task.FromResult(SteamWebApiClient.ParseAccount("https://steamcommunity.com.evil.test/id/foo")), "Lookalike domain accepted");
await Reject<InvalidDataException>(() => Task.FromResult(SteamWebApiClient.ParseAccount("http://steamcommunity.com/id/foo")), "Insecure profile URL accepted");
Check(!SteamWebApiClient.IsValidKey("not a key"), "Malformed key accepted");
string captureMessage = SteamConnectionCapture.Prefix + JsonSerializer.Serialize(new {nonce="session",key,account=id});
Check(SteamConnectionCapture.Parse("https://steamcommunity.com/dev/apikey",captureMessage,"session")?.Account == id, "Official-page capture rejected");
Check(SteamConnectionCapture.Parse("https://steamcommunity.com.evil.test/dev/apikey",captureMessage,"session") == null, "Lookalike capture origin accepted");
Check(SteamConnectionCapture.Parse("https://steamcommunity.com/profiles/"+id,captureMessage,"session") == null, "Capture accepted outside the key page");
Check(SteamConnectionCapture.Parse("https://steamcommunity.com/dev/apikey",captureMessage,"other-session") == null, "Stale capture session accepted");
Check(SteamConnectionCapture.Parse("https://steamcommunity.com/dev/apikey",SteamConnectionCapture.Prefix+"{}","session") == null, "Malformed capture accepted");
var handler = new FixtureHandler(key);
using var client = new HttpClient(handler);
var imported = await new SteamWebApiClient(client).ImportAsync(id, key, null, null, CancellationToken.None);
Check(imported.Games.Count == 2 && imported.DisplayName == "Steam Player", "Steam profile import failed");
Check(imported.Games[0].PlaytimeMinutes == 7200, "Steam minutes were incorrectly converted");
Check(imported.Games[0].Achievements.Single().Unlocked, "Unlocked achievement was not imported");
Check(imported.Games[0].Achievements.Single().IconFile == new string('a',40)+".jpg", "Missing Steam artwork");
Check(handler.Calls == 5, "Never-played game caused achievement requests");
Check(imported.Games[0].Achievements.Single().GlobalUnlockPercent == 0.5, "Global percentages did not match API identity");
using (var percent = JsonDocument.Parse("\"0.5\"")) Check(SteamMedals.ParsePercent(percent.RootElement) == 0.5, "Steam string percentages were not classified");
using (var percent = JsonDocument.Parse("\"invalid\"")) Check(SteamMedals.ParsePercent(percent.RootElement) == null, "Invalid rarity became a iron trophy");
Check(SteamMedals.Classify(0) == "gold" && SteamMedals.Classify(5) == "gold" && SteamMedals.Classify(5.01) == "silver" && SteamMedals.Classify(15) == "silver" && SteamMedals.Classify(15.01) == "bronze" && SteamMedals.Classify(30) == "bronze" && SteamMedals.Classify(30.01) == "iron" && SteamMedals.Classify(100) == "iron" && SteamMedals.Classify(null) == null && SteamMedals.Classify(double.NaN) == null, "Medal thresholds incorrect");
handler.Calls = 0;
await new SteamWebApiClient(client).ImportAsync(id, key, imported, null, CancellationToken.None);
Check(handler.Calls == 2, "Unchanged fresh achievements were downloaded again");
handler.Calls = 0;
var targeted = await new SteamWebApiClient(client).ImportAsync(id, key, imported, null, CancellationToken.None, 582660);
Check(handler.Calls == 1 && targeted.Games.Count == 2 && targeted.Games.First(g => g.AppId == 582660).Achievements.Single().IconFile != null, "Targeted refresh lost cached data or fetched the entire library");
handler.Mode = "recent";
handler.Calls = 0;
var recent = await new SteamWebApiClient(client).ImportAsync(id, key, imported, null, CancellationToken.None, recentOnly: true);
Check(handler.Calls == 2 && recent.Games.Count == 2, "Recent refresh lost dormant games or reloaded the catalog");
handler.Mode = "unlisted";
var unlisted = await new SteamWebApiClient(client).ImportAsync(id, key, imported, null, CancellationToken.None, 123);
Check(unlisted.Games.Any(game => game.AppId == 123 && game.Achievements.Single().Unlocked), "New game with player stats was skipped");
handler.Mode = "";
handler.Mode = "shared-hours";
var shared = await new SteamWebApiClient(client).ImportAsync(id, key, imported, null, CancellationToken.None,
    localGames: new Dictionary<int,string> { [1593500] = "God of War" });
Check(shared.Games.Single(game => game.AppId == 1593500).PlaytimeMinutes == 86, "Borrowed game lifetime playtime lost");
handler.Mode = "";
Check(shared.Games.Single(game => game.AppId == 1593500).Achievements.Single().Unlocked, "Installed shared title absent from owned list was skipped");
Check(shared.Games.Single(game => game.AppId == 1593500).Achievements.Single().IconUrl?.Contains("steamstatic.com/") == true, "Original schema icon URL was lost");
var history = new List<GameHistoryEntry> { new() { Name = "Black Desert", TotalPlaytimeMinutes = 1200 } };
var library = new List<GameModel> { new() { Name = "Black Desert", LaunchUrl = "steam://rungameid/582660", Path = "D:/local/game.exe", TotalPlaytimeMinutes = 1200 } };
SteamHistoryImport.Apply(imported, history, library);
Check(history.Single().TotalPlaytimeMinutes == 7200 && library.Single().TotalPlaytimeMinutes == 7200, "20h Doorpi / 120h Steam did not keep 120h");
Check(history[0].ShowcaseVerticalImageUrl.EndsWith("/582660/library_600x900.jpg") && history[0].HistoryHorizontalImageUrl.EndsWith("/582660/header.jpg"), "Steam history did not receive portable artwork URLs");
var remoteOnly = new List<GameHistoryEntry>();
SteamHistoryImport.Apply(imported, remoteOnly, new());
Check(remoteOnly.Single().ProfileBannerImageUrl.EndsWith("/582660/library_hero.jpg"), "Uninstalled Steam game has no banner");
var customArt = new GameHistoryEntry { SteamAppId = 582660, ShowcaseVerticalImageUrl = "https://example.invalid/custom.jpg", HistoryHorizontalLocalImage = "https://data.local/images/custom.jpg", ProfileBannerImageUrl = "https://example.invalid/banner.jpg" };
Check(!SteamHistoryArtwork.FillMissing(customArt) && customArt.ShowcaseVerticalImageUrl.Contains("custom"), "Steam backfill overwrote selected artwork");
Check(SteamHistoryArtwork.Fallback("https://cdn.cloudflare.steamstatic.com/steam/apps/582660/library_600x900.jpg")!.EndsWith("/header.jpg") && SteamHistoryArtwork.Fallback("https://example.invalid/library_hero.jpg") == null, "Steam image fallback accepted an unrelated host");
Check(library.Single().Path == "D:/local/game.exe" && library.Count == 1, "Steam import changed machine-specific installations");
var ambiguous = new List<GameHistoryEntry> { new() { Name = "Black Desert", TotalPlaytimeMinutes = 20 }, new() { Name = "Black Desert", TotalPlaytimeMinutes = 30 } };
SteamHistoryImport.Apply(imported, ambiguous, new());
Check(ambiguous.Count == 2 && ambiguous.Sum(item => item.TotalPlaytimeMinutes) == 50, "Ambiguous history names were merged or duplicated automatically");
SteamHistoryImport.Apply(imported, history, library);
Check(history.Single().TotalPlaytimeMinutes == 7200 && history.Count == 1, "Repeated import accumulated playtime or duplicated history");
history[0].TotalPlaytimeMinutes = 9000;
SteamHistoryImport.Apply(imported, history, library);
Check(history[0].TotalPlaytimeMinutes == 9000 && library[0].TotalPlaytimeMinutes == 9000, "Lower Steam total replaced higher Doorpi total");
library[0].TotalPlaytimeMinutes = 10000;
SteamHistoryImport.Apply(imported, history, library);
Check(history[0].TotalPlaytimeMinutes == 10000, "Higher library total was not reconciled into history before profile totals");
var old = SteamProfileMerge.Merge(null, imported)!;
var lower = SteamProfileMerge.Merge(null, imported)!;
lower.Games[0].PlaytimeMinutes = 5; lower.Games[0].Achievements.Clear();
var merged = SteamProfileMerge.Merge(old, lower)!;
Check(merged.Games.Single(game => game.AppId == 582660).PlaytimeMinutes == 7200 && merged.Games.Single(game => game.AppId == 582660).Achievements.Single().Unlocked, "Partial/restricted Steam data destroyed saved achievements");
handler.Mode = "private";
await Reject<InvalidOperationException>(() => new SteamWebApiClient(client).ImportAsync(id, key, imported, null, CancellationToken.None), "Private library became an empty collection");
handler.Mode = "incomplete";
await Reject<InvalidDataException>(() => new SteamWebApiClient(client).ImportAsync(id, key, imported, null, CancellationToken.None), "Incomplete Steam response was accepted");
handler.Mode = "rate-limit";
await Reject<InvalidOperationException>(() => new SteamWebApiClient(client).ImportAsync(id, key, imported, null, CancellationToken.None), "Rate limit was ignored");
handler.Mode = "malformed";
await Reject<InvalidDataException>(() => new SteamWebApiClient(client).ImportAsync(id, key, imported, null, CancellationToken.None), "Malformed response did not produce a recoverable import error");
handler.Mode = "ok";
using (var cancel = new CancellationTokenSource())
{
    cancel.Cancel();
    await Reject<OperationCanceledException>(() => new SteamWebApiClient(client).ImportAsync(id, key, imported, null, cancel.Token), "Cancellation was ignored");
}

string root = Path.Combine(AppContext.BaseDirectory, "test-data", Guid.NewGuid().ToString("N"), "Doorpi");
StateStorage.Initialize(root);
string directory = Path.Combine(root, "Data", "users", "alice");
StateStorage.WriteBatch(SteamProfileStore.BuildWrites(directory, imported));
SteamProfileStore.SaveKey(directory, key);
Check(SteamProfileStore.ReadKey(directory) == key, "Protected Steam credential could not be recovered");
SteamProfileStore.SaveConnection(directory,key,id);
Check(SteamProfileStore.ReadKey(directory) == key && SteamProfileStore.ReadConnectedAccount(directory) == id, "Automatic connection did not persist key and account together");
Check(!StateStorage.ReadAllText(Path.Combine(directory, "steam-credentials.json")).Contains(key), "Steam key stored as plaintext");
Check(SteamProfileStore.Read(directory)!.Games[0].Achievements.Count == 1, "Normalized Steam rows did not round-trip");
Check(SteamProfileStore.Read(directory)!.Games[0].Achievements[0].GlobalUnlockPercent == 0.5, "SQLite persistence lost the global percentage");
var noPercent = SteamProfileMerge.Merge(null, imported)!;
noPercent.Games[0].Achievements[0].GlobalUnlockPercent = null;
Check(SteamProfileMerge.Merge(imported, noPercent)!.Games.Single(game => game.AppId == 582660).Achievements[0].GlobalUnlockPercent == 0.5, "Unavailable percentages erased known data");
Check(!Directory.Exists(directory), "Steam state wrote physical JSON files");
SteamProfileStore.DeleteKey(directory);
Check(SteamProfileStore.ReadConnectedAccount(directory) == "", "Removing credentials left the local connection active");
Check(!SteamProfileStore.HasKey(directory) && SteamProfileStore.Read(directory)!.Games.Count == 2, "Disconnect deleted imported profile data");
var snapshot = ProfileSyncSnapshotFactory.Create(new UserProfile { Id = "alice", Name = "Alice" }, history, "device", DateTimeOffset.UtcNow);
snapshot.Steam = imported;
string json = ProfileSyncSerializer.SerializeProfile(snapshot);
Check(!json.Contains(key) && !json.Contains("D:/local") && !json.Contains("steam-credentials"), "Cloud profile leaked local key or installation path");
Check(ProfileSyncSerializer.DeserializeProfile(json)!.Steam!.Games[0].Achievements.Single().Unlocked, "Cloud format lost achievements");
Check(ProfileSyncSerializer.DeserializeProfile(json)!.Games[0].ShowcaseVerticalImageUrl.Contains("steamstatic.com"), "Cloud profile lost Steam history artwork");
var baseline = ProfileSyncSerializer.DeserializeProfile(json)!;
var left = ProfileSyncSerializer.DeserializeProfile(json)!;
var right = ProfileSyncSerializer.DeserializeProfile(json)!;
baseline.Games[0].TotalPlaytimeSeconds = 20 * 3600;
left.Games[0].TotalPlaytimeSeconds = right.Games[0].TotalPlaytimeSeconds = 120 * 3600;
var cloudMerge = ProfileSyncEngine.MergeThreeWay(baseline, left, right);
Check(cloudMerge.MergedProfile.Games[0].TotalPlaytimeSeconds == 120 * 3600, "Two PCs importing the same Steam total double-counted hours");
Check(!cloudMerge.HasConflicts, "Identical Steam imports caused a cloud conflict");
Check(ProfileSyncEngine.Evaluate(left, baseline, ProfileSyncSerializer.ComputeContentHash(baseline)).Action == ProfileSyncAction.UploadLocal, "Preserved higher hours cannot be uploaded after applying an older remote baseline");
var changed = ProfileSyncSerializer.DeserializeProfile(json)!;
changed.Steam!.Games[0].Achievements[0].Unlocked = false;
Check(ProfileSyncSerializer.ComputeContentHash(changed) != ProfileSyncSerializer.ComputeContentHash(snapshot), "Achievement changes were invisible to cloud hashing");
Check(ProfileSyncEngine.Compare(snapshot, changed).Differences.Any(item => item.Kind == ProfileDifferenceKind.SteamProfile), "Cloud comparison ignored achievement changes");
var otherAccount = ProfileSyncSerializer.DeserializeProfile(json)!;
otherAccount.Steam!.SteamId = "76561198000000001";
Check(ProfileSyncEngine.MergeThreeWay(baseline, snapshot, otherAccount).HasConflicts, "Different Steam accounts were silently combined");
var oldFormat = new CloudProfileV1 { SchemaVersion = 5 };
Check(!ProfileSyncSerializer.SerializeProfile(oldFormat).Contains("\"steam\":"), "Old cloud format was polluted with a new empty Steam field");
await Reject<InvalidDataException>(() => Task.Run(() => SteamProfileStore.Validate(new SteamProfileData { SteamId = id, Games = new() { new() { AppId = 1, PlaytimeMinutes = -1 } } })), "Negative remote playtime was accepted");
Check(StateStorage.CheckIntegrity() == "ok", "Steam writes violated SQLite integrity");
Console.WriteLine($"PASS: {checks} Steam integration checks; HTTP fixtures, no live account used.");

sealed class FixtureHandler(string expectedKey) : HttpMessageHandler
{
    public int Calls;
    public string Mode = "ok";
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        Calls++;
        if (request.RequestUri!.Host != "api.steampowered.com" || request.RequestUri.Scheme != "https" || request.RequestUri.Query.Contains(expectedKey) || request.Headers.GetValues("x-webapi-key").Single() != expectedKey)
            throw new Exception("Steam credential escaped its authorized HTTPS header");
        string body;
        if (Mode == "rate-limit") return Task.FromResult(new HttpResponseMessage(HttpStatusCode.TooManyRequests));
        if (Mode == "malformed") return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") });
        if (request.RequestUri.AbsolutePath.Contains("GetPlayerSummaries")) body = "{\"response\":{\"players\":[{\"personaname\":\"Steam Player\",\"avatarfull\":\"https://avatars.steamstatic.com/avatar.jpg\"}]}}";
        else if (Mode == "shared-hours" && request.RequestUri.AbsolutePath.Contains("GetRecentlyPlayedGames")) body = """{"response":{"games":[{"appid":1593500,"playtime_forever":86,"playtime_2weeks":7}]}}""";
        else if (request.RequestUri.AbsolutePath.Contains("GetRecentlyPlayedGames")) body = """{"response":{"total_count":1,"games":[{"appid":582660,"name":"Black Desert","playtime_forever":7200}]}}""";
        else if (Mode == "unlisted" && request.RequestUri.AbsolutePath.Contains("GetOwnedGames")) body = """{"response":{"game_count":0}}""";
        else if (Mode == "unlisted" && request.RequestUri.AbsolutePath.Contains("GetPlayerAchievements")) body = """{"playerstats":{"gameName":"New game","success":true,"achievements":[{"apiname":"ACH_ONE","achieved":1}]}}""";
        else if (request.RequestUri.AbsolutePath.Contains("GetOwnedGames")) body = Mode == "private" ? "{\"response\":{}}" : Mode == "incomplete" ? "{\"response\":{\"game_count\":2}}" : "{\"response\":{\"game_count\":2,\"games\":[{\"appid\":582660,\"name\":\"Black Desert\",\"playtime_forever\":7200},{\"appid\":10,\"name\":\"Never Played\",\"playtime_forever\":0}]}}";
        else if(request.RequestUri.AbsolutePath.Contains("GetSchemaForGame")) body = "{\"game\":{\"availableGameStats\":{\"achievements\":[{\"name\":\"ACH_ONE\",\"icon\":\"https://cdn.steamstatic.com/steamcommunity/public/images/apps/582660/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg\"}]}}}";
        else if(request.RequestUri.AbsolutePath.Contains("GetGlobalAchievementPercentagesForApp")) body = "{\"achievementpercentages\":{\"achievements\":[{\"name\":\"ACH_ONE\",\"percent\":0.5}]}}";
        else body = "{\"playerstats\":{\"success\":true,\"achievements\":[{\"apiname\":\"ACH_ONE\",\"name\":\"First achievement\",\"achieved\":1,\"unlocktime\":1700000000}]}}";
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) });
    }
}
