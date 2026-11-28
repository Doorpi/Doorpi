using System.IO;
using System.Text.Json;
using Doorpi.Storage;
using Doorpi.Steam;
using System.Windows.Threading;

namespace Doorpi;
public partial class MainWindow
{
    private bool _trophyServicesStarted;
    private string _trophySessionOwner="";
    private long _trophySessionGeneration=-1;
    private LocalTrophySession? _localSession;
    private Dictionary<int,GameModel> _registeredSteamGames = new();
    private Dictionary<int,SteamGameData> _localCatalogs = new();
    private Dictionary<string,(int App,bool Official)> _sessionTrophyIds = new(StringComparer.OrdinalIgnoreCase);
    private (int App,bool Official) _recentTrophySession;
    private DateTimeOffset _recentTrophyUntil;
    private (int App,bool Official) CurrentTrophySession()
    {
        if (!CatalogOwnerMatches || _trophySessionOwner!=currentUserId || _trophySessionGeneration!=_themeProfileGeneration) return default;
        if (_gameSessionActive)
        {
            var identifier = _activeSessionGameId ?? "";
            var explicitApp=SteamHistoryImport.AppIdFromUrl(identifier);
            _recentTrophySession=explicitApp>0 ? (explicitApp,true) : _sessionTrophyIds.GetValueOrDefault(identifier);
            _recentTrophyUntil=DateTimeOffset.UtcNow.AddSeconds(20);
        }
        return DateTimeOffset.UtcNow <= _recentTrophyUntil ? _recentTrophySession : default;
    }
    private string _catalogOwner = "";
    private long _catalogGeneration = -1;
    private bool CatalogOwnerMatches => _interactiveUserSessionStarted && _catalogOwner == currentUserId && _catalogGeneration == _themeProfileGeneration;
    private void StartLibraryTrophies()
    {
        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        bool busy=false;
        var nextScan=DateTimeOffset.MinValue;
        var retry=new Dictionary<int,DateTimeOffset>();
        long scannedRevision=-1;
        var probes=new Dictionary<string,int>();
        timer.Tick += async (_,_) =>
        {
            if(busy || !_interactiveUserSessionStarted || string.IsNullOrEmpty(currentUserId)) return;
            busy=true;
            try
            {
                var owner=currentUserId;
                var generation=_themeProfileGeneration;
                string dir=Path.Combine(dataFolder,"users",ProfileSync.GoogleOAuthClient.SafeProfileId(owner));
                string cache=Path.Combine(dir,"local-steam-catalogs.json");
                if(!CatalogOwnerMatches)
                {
                    _catalogOwner=owner; _catalogGeneration=generation; _registeredSteamGames=new(); _localCatalogs=new();
                    _sessionTrophyIds.Clear(); _recentTrophySession=default; _recentTrophyUntil=default;
                    retry.Clear();nextScan=DateTimeOffset.MinValue;scannedRevision=-1;
                    var index=Path.Combine(dir,"local-steam-scan-v1.json");
                    probes=StateStorage.Exists(index) ? JsonSerializer.Deserialize<Dictionary<string,int>>(StateStorage.ReadAllText(index)) ?? throw new InvalidDataException() : new();
                    if(StateStorage.Exists(cache)) { _localCatalogs=ReadProfileCatalogs(dir)!; ScheduleProfileSync(owner); }
                }
                var userPath=Path.Combine(dir,"user.json");
                var revision=StateStorage.GetRevision(userPath);
                var gamesPath=Path.Combine(dir,"games.json");
                var libraryRevision=StateStorage.GetRevision(gamesPath);
                bool Current() => _interactiveUserSessionStarted && currentUserId==owner && generation==_themeProfileGeneration && StateStorage.GetRevision(userPath)==revision && StateStorage.GetRevision(gamesPath)==libraryRevision;
                if(libraryRevision!=scannedRevision || DateTimeOffset.UtcNow>=nextScan)
                {
                    bool repaired=SteamProfileStore.ArchiveUnverifiedCacheRows(dir);
                    if(repaired) { ScheduleProfileSync(owner); PublishTrophyChange(owner); }
                    var games=LoadGames().ToArray();
                    var indexPath=Path.Combine(dir,"local-steam-scan-v1.json");
                    var indexRevision=StateStorage.GetRevision(indexPath);
                    var refreshed=new Dictionary<string,int>();
                    var sessions=new Dictionary<string,(int App,bool Official)>(StringComparer.OrdinalIgnoreCase);
                    var discovered=await Task.Run(() =>
                    {
                        var ids=new Dictionary<int,GameModel>();
                        foreach(var game in games)
                        {
                            try
                            {
                                bool store=LocalSteamCatalog.IsStoreGame(game);
                                var steamId=SteamHistoryImport.AppIdFromUrl(game.LaunchUrl);
                                if(store && steamId==0) continue;
                                long stamp=0;
                                if(!store)
                                {
                                    var file=new FileInfo(game.Path);
                                    if(!file.Exists) continue;
                                    stamp=file.LastWriteTimeUtc.Ticks;
                                }
                                var signature=JsonSerializer.Serialize(new[]{game.Id,game.Path,game.LaunchUrl,game.Source,stamp.ToString()});
                                if(!probes.TryGetValue(signature,out int id)) id=steamId>0 ? steamId : LocalSteamCatalog.Identify(game);
                                refreshed[signature]=id;
                                if(id<=0) continue;
                                if(!ids.ContainsKey(id) || !store) ids[id]=game;
                                foreach(var alias in new[]{game.Id,game.Path,game.LaunchUrl})
                                    if(!string.IsNullOrEmpty(alias)) sessions[alias]=(id,store);
                            }
                            catch(Exception ex) when(ex is IOException or UnauthorizedAccessException or ArgumentException) { }
                        }
                        return ids;
                    });
                    if(!Current()) return;
                    bool changed = sessions.Count != _sessionTrophyIds.Count ||
                        sessions.Any(entry => !_sessionTrophyIds.TryGetValue(entry.Key, out var prior) || prior != entry.Value);
                    if(!StateStorage.Exists(indexPath) || probes.Count!=refreshed.Count || refreshed.Any(p=>!probes.TryGetValue(p.Key,out var value) || value!=p.Value))
                        StateStorage.WriteBatchIfRevision(new Dictionary<string,string?>{[indexPath]=JsonSerializer.Serialize(refreshed)},new Dictionary<string,long>{[indexPath]=indexRevision,[userPath]=revision,[gamesPath]=libraryRevision});
                    probes=refreshed;scannedRevision=libraryRevision;_sessionTrophyIds=sessions;
                    _registeredSteamGames=discovered;
                    nextScan=DateTimeOffset.UtcNow.AddSeconds(30);
                    if(changed) PublishTrophyChange(owner);
                }
                var officialData=ReadSteamPresentation(dir,generation);
                var candidate=_registeredSteamGames.FirstOrDefault(pair=>!(LocalSteamCatalog.IsStoreGame(pair.Value) && officialData?.Games.Any(g=>g.AppId==pair.Key && g.AchievementsCheckedUtc.HasValue)==true) && retry.GetValueOrDefault(pair.Key)<=DateTimeOffset.UtcNow &&
                    (!_localCatalogs.TryGetValue(pair.Key,out var c) || c.AchievementsCheckedUtc<DateTimeOffset.UtcNow.AddDays(-7)));
                if(candidate.Key==0) return;
                retry[candidate.Key]=DateTimeOffset.UtcNow.AddHours(1);
                long cacheRevision=StateStorage.GetRevision(cache);
                SteamGameData fetched;
                var install=GetSteamInstallPath();
                if(string.IsNullOrEmpty(install)) install=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Steam");
                string schema=Path.Combine(install,"appcache","stats",$"UserGameStatsSchema_{candidate.Key}.bin");
                try { fetched=await LocalSteamCatalog.FetchAsync(SteamHttpClient,candidate.Key,candidate.Value.Name); }
                catch(Exception ex) when(File.Exists(schema) && ex is System.Net.Http.HttpRequestException or InvalidDataException or TaskCanceledException)
                {
                    var schemaItems=await Task.Run(()=>SteamCachedAchievements.ReadCatalog(schema,candidate.Key));
                    if(schemaItems.Count==0) return;
                    fetched=new(){AppId=candidate.Key,Name=candidate.Value.Name,AchievementsCheckedUtc=DateTimeOffset.UtcNow.AddDays(-7),Achievements=schemaItems};
                }
                if(!Current())return;
                var catalogs=ProfileSync.ProfileSyncEngine.MergeCatalogs(ReadProfileCatalogs(dir),new(){[candidate.Key]=fetched})!;
                StateStorage.WriteBatchIfRevision(new Dictionary<string,string?>{[cache]=JsonSerializer.Serialize(catalogs)},new Dictionary<string,long>{[cache]=cacheRevision,[userPath]=revision,[gamesPath]=libraryRevision});
                _localCatalogs=catalogs;ScheduleProfileSync(owner);PublishTrophyChange(owner);
            }
            catch(Exception ex){System.Diagnostics.Debug.WriteLine("[Local catalog] "+ex.Message);}
            finally{busy=false;}
        };
        var watch=new DispatcherTimer{Interval=TimeSpan.FromSeconds(2)};
        bool watching=false;
        watch.Tick+=async (_,_) =>
        {
            if(watching || !CatalogOwnerMatches || string.IsNullOrWhiteSpace(currentUserId))return;
            string owner=currentUserId;
            long generation = _themeProfileGeneration;
            string dir=Path.Combine(dataFolder,"users",ProfileSync.GoogleOAuthClient.SafeProfileId(owner));
            string userPath=Path.Combine(dir,"user.json");
            long revision=StateStorage.GetRevision(userPath);
            try
            {
                watching=true;
                var active=CurrentTrophySession();
                foreach(var (id,game) in _registeredSteamGames)
                {
                    if(active.App!=id || active.Official) continue;
                    var catalog=_localCatalogs.GetValueOrDefault(id) ?? ReadSteamPresentation(dir,generation)?.Games.Find(g=>g.AppId==id && g.AchievementsCheckedUtc.HasValue);
                    if(catalog==null)continue;
                    var session=_localSession;
                    if(session==null)continue;
                    var observed=new Dictionary<string,long>();
                    var samples=await Task.Run(()=> LocalTrophySession.Sources(id).Select(path=>(Path:path,Data:LocalTrophySession.Read(path))).ToArray());
                    if(!CatalogOwnerMatches || currentUserId!=owner || generation!=_themeProfileGeneration || session!=_localSession || CurrentTrophySession()!=active || StateStorage.GetRevision(userPath)!=revision) return;
                    var official = ReadSteamPresentation(dir, generation)?.Games.Find(g => g.AppId == id);
                    catalog = _localCatalogs.GetValueOrDefault(id) ?? (official?.AchievementsCheckedUtc != null ? official : null);
                    if (catalog == null) continue;
                    foreach(var sample in samples)
                        foreach(var (key,stamp) in session.Observe(sample.Path,sample.Data))
                            if(catalog.Achievements.Any(a=>a.ApiName==key)) observed[key]=stamp;
                    var added=observed.Keys.ToArray();
                    if(added.Length==0) continue;
                    string ledgerPath=LocalTrophyLedger(dir);
                    long ledgerRevision=StateStorage.GetRevision(ledgerPath);
                    var ledger=ReadLocalTrophies(ledgerPath);
                    var fresh = added.Where(key => !ledger.ContainsKey(id + "/" + key)).ToHashSet(StringComparer.Ordinal);
                    if(fresh.Count>0)
                    {
                        var earnedBefore = EarnedTrophyIds(catalog, official, ledger);
                        bool platinum = ReachedFullTrophySet(catalog, earnedBefore, fresh, fresh);
                        foreach (string key in fresh)
                            ledger.Add(id + "/" + key, observed[key]);
                        StateStorage.WriteBatchIfRevision(new Dictionary<string,string?>{[ledgerPath]=JsonSerializer.Serialize(ledger)},new Dictionary<string,long>{[ledgerPath]=ledgerRevision,[userPath]=revision});
                        ScheduleProfileSync(owner);PublishTrophyChange(owner);
                        ShowLocalTrophy(game.Name, catalog.Achievements.Where(a=>fresh.Contains(a.ApiName)), followedByPlatinum: platinum);
                    }
                    session.Acknowledge(added);

                }
            }
            catch(Exception ex){System.Diagnostics.Debug.WriteLine("[Local trophies] "+ex.Message);}
            finally{watching=false;}
        };
        watch.Start();
        Closed+=(_,_)=>watch.Stop();
        timer.Start();
        Closed+=(_,_)=>timer.Stop();
    }

    private static HashSet<string> EarnedTrophyIds(SteamGameData catalog, SteamGameData? official,
        IReadOnlyDictionary<string, long> ledger)
    {
        var ids = (official?.Achievements ?? []).Where(item => item.Unlocked)
            .Select(item => item.ApiName).ToHashSet(StringComparer.Ordinal);
        foreach (var item in catalog.Achievements)
        {
            if (ledger.ContainsKey(catalog.AppId + "/" + item.ApiName))
                ids.Add(item.ApiName);
        }
        return ids;
    }

    private static bool ReachedFullTrophySet(SteamGameData catalog, IReadOnlySet<string> earnedBefore,
        IReadOnlySet<string> observed, IReadOnlySet<string> earnedInSession)
    {
        bool earnedLastTrophyInSession = false;
        foreach (var item in catalog.Achievements)
        {
            if (earnedBefore.Contains(item.ApiName)) continue;
            if (!observed.Contains(item.ApiName)) return false;
            earnedLastTrophyInSession |= earnedInSession.Contains(item.ApiName);
        }
        return earnedLastTrophyInSession;
    }

    private static Dictionary<int,SteamGameData>? ReadProfileCatalogs(string directory)
    {
        string path=Path.Combine(directory,"local-steam-catalogs.json");
        return StateStorage.Exists(path) ? JsonSerializer.Deserialize<Dictionary<int,SteamGameData>>(StateStorage.ReadAllText(path)) ?? throw new InvalidDataException("Catálogo inválido.") : null;
    }

    private List<SteamGameData> ProfileTrophyGames(string directory,SteamProfileData? profile)
    {
        var official=(profile?.Games ?? []).ToDictionary(g=>g.AppId);
        var catalogs=official.Values.Where(g=>g.AchievementsCheckedUtc.HasValue && g.Name!=$"Steam {g.AppId}").ToDictionary(g=>g.AppId);
        foreach(var (app,catalog) in ReadProfileCatalogs(directory) ?? new()) catalogs[app]=catalog;
        var ledger=ReadLocalTrophies(LocalTrophyLedger(directory));
        var games=new List<SteamGameData>();
        foreach(var (app,catalog) in catalogs)
        {
            var projection=new SteamGameData {AppId=app,Name=catalog.Name,AchievementsCheckedUtc=catalog.AchievementsCheckedUtc,
                Achievements=catalog.Achievements.Select(a=>
                {
                    bool earned=ledger.TryGetValue(app+"/"+a.ApiName,out var stamp);
                    return new SteamAchievementData{AppId=app,ApiName=a.ApiName,Name=a.Name,Description=a.Description,IconUrl=a.IconUrl,
                        IconFile=a.IconFile,GlobalUnlockPercent=a.GlobalUnlockPercent,Unlocked=earned,UnlockTimeUnix=stamp};
                }).ToList()};
            games.Add(SteamProfileMerge.CombineDoorpiTrophies(projection,official.GetValueOrDefault(app),false));
        }
        return games;
    }
}
