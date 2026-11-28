using Doorpi.Steam;
using Doorpi.Storage;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows.Threading;

namespace Doorpi;
public partial class MainWindow
{
    private void StartSteamCacheMonitor()
    {
        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
        var processed = new Dictionary<string,DateTime>(StringComparer.OrdinalIgnoreCase);
        string priorIdentity = "";

        bool busy = false;
        string steam = GetSteamInstallPath();
        if (string.IsNullOrEmpty(steam)) steam = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Steam");
        string root = Path.Combine(steam, "appcache", "stats");
        timer.Tick += async (_, _) =>
        {
            if (busy || !_interactiveUserSessionStarted || string.IsNullOrWhiteSpace(currentUserId)) return;
            busy = true;
            try
            {
                string owner = currentUserId;
                long generation = _themeProfileGeneration;
                string directory = Path.Combine(dataFolder, "users", ProfileSync.GoogleOAuthClient.SafeProfileId(owner));
                string account = SteamProfileStore.ReadConnectedAccount(directory);
                if (!ulong.TryParse(account, out var steamId)) return;
                string identity = owner + "/" + account + "/" + generation;
                if (priorIdentity != identity) { processed.Clear(); priorIdentity = identity; }
                if (!CatalogOwnerMatches || _registeredSteamGames.Count == 0) return;
                var active = CurrentTrophySession();
                if(active.App<=0 || !active.Official) return;
                var session = _localSession;
                if (session == null) return;
                var registered = _registeredSteamGames;
                var ready = _localCatalogs.Keys.Concat(ReadSteamPresentation(directory,generation)?.Games.Where(g=>g.AchievementsCheckedUtc.HasValue).Select(g=>g.AppId) ?? []).ToHashSet();
                string prefix = "UserGameStats_" + (uint)steamId + "_";
                var revs = new[]{"user.json","steam-connection.json"}.Select(key => Path.Combine(directory,key)).ToDictionary(path => path, path => StateStorage.GetRevision(path));
                var changes = await Task.Run(() =>
                {
                    var results = new List<(FileInfo? File, int App, List<SteamAchievementData> Items)>();
                    if (!Directory.Exists(root)) return results;
                    foreach (var file in new DirectoryInfo(root).EnumerateFiles(prefix + active.App + ".bin"))
                    {
                        if (processed.GetValueOrDefault(file.Name) == file.LastWriteTimeUtc) continue;
                        if (!int.TryParse(Path.GetFileNameWithoutExtension(file.Name)[prefix.Length..], out int id) || !registered.ContainsKey(id) || !ready.Contains(id)) continue;
                        string schema = Path.Combine(root, $"UserGameStatsSchema_{id}.bin");
                        if (!File.Exists(schema)) continue;
                        try { results.Add((file,id,SteamCachedAchievements.ReadUnlocked(file.FullName,schema,id))); }
                        catch (IOException) { continue; }
                        catch (InvalidDataException) { continue; }
                    }
                    return results;
                });
                if (changes.Count == 0 || !CatalogOwnerMatches || owner != currentUserId ||
                    generation != _themeProfileGeneration || session != _localSession || active != CurrentTrophySession()) return;

                bool changed = false;
                bool applied = false;
                string? completedGameName = null;
                StateStorage.ExecuteTransaction(() =>
                {
                    StateStorage.WriteBatchIfRevision(new Dictionary<string,string?>(), revs);
                    var profile = SteamProfileStore.Read(directory);
                    if (profile?.SteamId != account) return;
                    applied = true;
                    foreach (var entry in changes)
                    {
                        var game = profile.Games.FirstOrDefault(g => g.AppId == entry.App);
                        if (entry.Items.Count == 0) continue;
                        if (game == null)
                        {
                            if (!registered.TryGetValue(entry.App,out var identified)) continue;
                            var catalog=_localCatalogs.GetValueOrDefault(entry.App)?.Achievements;
                            if(catalog==null) continue;
                            game = new() { AppId = entry.App, Name = identified.Name, AchievementsCheckedUtc=DateTimeOffset.UtcNow,
                                Achievements=catalog.Select(a=>new SteamAchievementData{AppId=entry.App, ApiName=a.ApiName, Name=a.Name, Description=a.Description, IconUrl=a.IconUrl,GlobalUnlockPercent=a.GlobalUnlockPercent}).ToList() };
                            profile.Games.Add(game);
                        }
                        var requirements = _localCatalogs.GetValueOrDefault(entry.App) ?? game;
                        if (requirements.AchievementsCheckedUtc != null && requirements.Achievements.Count > 0)
                        {
                            var earnedInSession = entry.Items.Where(item => session.HasSessionTimestamp(item.UnlockTimeUnix))
                                .Select(item => item.ApiName).ToHashSet(StringComparer.Ordinal);
                            if (earnedInSession.Count > 0)
                            {
                                var earnedBefore = EarnedTrophyIds(requirements, game, ReadLocalTrophies(LocalTrophyLedger(directory)));
                                var observed = entry.Items.Select(item => item.ApiName).ToHashSet(StringComparer.Ordinal);
                                if (ReachedFullTrophySet(requirements, earnedBefore, observed, earnedInSession))
                                    completedGameName = game.Name;
                            }
                        }
                        foreach (var item in entry.Items)
                        {
                            var existing = game.Achievements.FirstOrDefault(a => a.ApiName == item.ApiName);
                            if (existing?.Unlocked == true) continue;
                            if (existing == null) game.Achievements.Add(item);
                            else { existing.Unlocked = true; existing.UnlockTimeUnix = item.UnlockTimeUnix; }
                            changed = true;

                        }
                    }
                    if (changed) StateStorage.WriteBatch(SteamProfileStore.BuildWrites(directory,profile));
                });
                if (!applied) return;
                foreach (var entry in changes) if (entry.File != null) processed[entry.File.Name] = entry.File.LastWriteTimeUtc;
                if (changed)
                {
                    ScheduleProfileSync(owner);
                    PublishTrophyChange(owner);
                    if (completedGameName != null)
                        ShowLocalPlatinum(completedGameName);
                }
            }
            catch (Exception ex) { Debug.WriteLine("[Steam cache] " + ex.Message); }
            finally { busy = false; }
        };
        timer.Start();
        Closed += (_, _) => timer.Stop();
    }

    private void PublishTrophyChange(string owner)
        => PostProfileSyncMessage(new { type = "doorpiTrophiesChanged", profileId = owner });
}
