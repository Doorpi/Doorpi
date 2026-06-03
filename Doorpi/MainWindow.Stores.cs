using Microsoft.Win32;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows;
using System.Xml.Linq;

namespace Doorpi
{
    public partial class MainWindow
    {
        private string? _activeStoreId;
        private bool _isStoreLauncherSession;
        private bool _storePausedByDoorpi;
        private string? _storeLauncherExe;
        private string _storeSessionKind = "";
        private Process? _storeLauncherProcess;
        private CancellationTokenSource? _storeLauncherWatcherCts;
        private Thread? _storeControllerThread;
        private Thread? _storeShortcutThread;
        private int _storeSessionId;
        private bool _storeControllerActive;
        private bool _storeGamepadDisabled;
        private bool _storeMouseModeRequested;
        private bool _storeMouseModeInitialized;
        private bool _storeLauncherWindowSeen;
        private bool _storeTrayCloseInProgress;
        private HashSet<string> _libraryKeysBeforeStore = new(StringComparer.OrdinalIgnoreCase);
        private HashSet<string> _storeKeysBeforeStore = new(StringComparer.OrdinalIgnoreCase);
        private HashSet<string> _storeKeysProcessedDuringSession = new(StringComparer.OrdinalIgnoreCase);
        private HashSet<int> _storeProcessSnapshot = new();
        private HashSet<int> _storeProcessGroupIds = new();
        private HashSet<IntPtr> _storeWindowSnapshot = new();
        private string _storeProcessGroupRootDirectory = "";
        private string _storeProcessGroupExeName = "";
        private CancellationTokenSource? _storeLibraryMonitorCts;
        private CancellationTokenSource? _storeChildGameDetectorCts;
        private readonly HashSet<string> _gogDiagnosticLogSeen = new(StringComparer.OrdinalIgnoreCase);
        private bool _storeChildGameActive;
        private string _storeChildGameStoreId = "";
        private string _storeChildGameId = "";
        private bool _gogBackInputPendingOnStoreResume;
        private long _storeChildDetectionSuppressUntilUtcTicks;
        private readonly object _storeLibraryMonitorLock = new();
        private int _storeArtworkRefreshRunning;
        private string storesFile = "";

        private static readonly List<(string Id, string Name, string SgdbQuery)> StoreLauncherCatalog = new()
        {
            ("Steam", "Steam", "Steam (Platform)"),
            ("Epic", "Epic Games", "Epic Games (Platform)"),
            ("GOG", "GOG", "GOG Galaxy (Platform)"),
            ("Ubisoft", "Ubisoft Connect", "Ubisoft Connect (Platform)"),
            ("EA", "EA App", "EA App (Platform)"),
            ("BattleNet", "Battle.net", "Battle.net (Platform)"),
            ("Amazon", "Amazon Games", "Amazon Games (Platform)"),
            ("Xbox", "Xbox", "Xbox (Platform)"),
        };

        private static readonly Dictionary<string, bool> DefaultStoreAutoAdd = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Steam"] = true,
            ["Epic"] = true,
            ["GOG"] = true,
            ["Ubisoft"] = true,
            ["EA"] = true,
            ["BattleNet"] = true,
            ["Amazon"] = true,
            ["Xbox"] = true,
        };

        private static readonly string[] XboxDeniedPackagePrefixes =
        {
            "Windows."
        };

        private static readonly string[] XboxDeniedPackageFragments =
        {
            "RawImage", ".File.", ".Input.", ".Widget", ".Photos", ".Store", ".Edge",
            ".WebView", ".DesktopAppInstaller", ".SecHealth", ".ScreenSketch", ".GetHelp",
            ".GamingOverlay", ".XboxIdentity", ".GamingApp", ".Zune", ".Bing", ".YourPhone",
            ".VCLibs", ".NET.", ".UI.", ".Services.", ".Language.", ".Accounts.", ".HEIF",
            ".Webp", ".MPEG", ".Paint", ".Calculator", ".Camera", ".Sound", ".Terminal",
            ".PowerAutomate", ".Teams", ".Office", ".OneDrive", ".Outlook", ".Skype",
            ".Copilot", ".CrossDevice", ".StartExperiences", ".Shell", ".LockApp",
            ".CredDialog", ".BioEnrollment", ".AsyncText", ".ECApp", ".Alarms", ".Maps",
            ".Weather", ".News", ".Solitaire", ".Clipchamp", ".ToDo", ".Whiteboard",
            "NVIDIA", "ControlPanel", "Client.CBS", "WebExperience", "HDRCalibration",
            "WindowsAppRuntime", "WinAppRuntime", "AppRuntime", "Runtime.Main",
            "StorePurchaseApp", "DesktopAppInstaller", "PeopleExperienceHost"
        };

        private static bool IsStoreMouseModeDisabledByDefault(string storeId)
            => storeId.Equals("Xbox", StringComparison.OrdinalIgnoreCase)
            || storeId.Equals("GOG", StringComparison.OrdinalIgnoreCase)
            || storeId.Equals("Ubisoft", StringComparison.OrdinalIgnoreCase);

        private sealed class StoreDefinition
        {
            public string Id { get; init; } = "";
            public string Name { get; init; } = "";
            public string WebUrl { get; init; } = "";
            public string SourceKey { get; init; } = "";
        }

        private static readonly StoreDefinition[] StoreCatalog =
        {
            new() { Id = "Steam", Name = "Steam", WebUrl = "https://store.steampowered.com", SourceKey = "Steam" },
            new() { Id = "Epic", Name = "Epic Games", WebUrl = "https://store.epicgames.com", SourceKey = "Epic" },
            new() { Id = "GOG", Name = "GOG", WebUrl = "https://www.gog.com", SourceKey = "GOG" },
            new() { Id = "Ubisoft", Name = "Ubisoft Connect", WebUrl = "https://store.ubisoft.com", SourceKey = "Ubisoft" },
            new() { Id = "EA", Name = "EA App", WebUrl = "https://www.ea.com/games", SourceKey = "EA" },
            new() { Id = "BattleNet", Name = "Battle.net", WebUrl = "https://battle.net/shop", SourceKey = "Battle.net" },
            new() { Id = "Amazon", Name = "Amazon Games", WebUrl = "https://gaming.amazon.com", SourceKey = "Amazon" },
            new() { Id = "Xbox", Name = "Xbox", WebUrl = "https://www.xbox.com", SourceKey = "Xbox" },
        };

        private Dictionary<string, bool> GetStoreAutoAddSettings()
        {
            var merged = new Dictionary<string, bool>(DefaultStoreAutoAdd, StringComparer.OrdinalIgnoreCase);
            var profile = LoadUserProfile();
            if (profile.StoreAutoAdd == null) return merged;
            foreach (var kv in profile.StoreAutoAdd)
                merged[kv.Key] = kv.Value;
            return merged;
        }

        private void SaveStoreAutoAddSetting(string storeKey, bool enabled)
        {
            var profile = LoadUserProfile();
            profile.StoreAutoAdd ??= new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
            profile.StoreAutoAdd[storeKey] = enabled;
            SaveUserProfile(profile);
        }

        private void SendStoreAutoAddSettingsToUI()
        {
            var settings = GetStoreAutoAddSettings();
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(new { type = "storeAutoAddSettings", storeAutoAdd = settings })));
        }

        private static bool IsStoreAutoAddEnabled(Dictionary<string, bool> settings, string source)
        {
            string key = source switch
            {
                "Battle.net" => "BattleNet",
                _ => source
            };
            return settings.TryGetValue(key, out bool on) && on;
        }

        private sealed class StoreRefreshResult
        {
            public List<InstalledApp> NewApps { get; init; } = new();
            public List<GameModel> RemovedGames { get; init; } = new();
        }

        private static string AppIdentityKey(InstalledApp app)
        {
            if (!string.IsNullOrEmpty(app.LaunchUrl)) return app.LaunchUrl;
            if (!string.IsNullOrEmpty(app.Path)) return NormalizeAutoAddKey(app.Path);
            return app.Name;
        }

        private HashSet<string> BuildLibraryKeySet()
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var g in LoadGames())
            {
                foreach (var key in AutoAddKeysForGame(g))
                    keys.Add(key);
            }
            return keys;
        }

        private List<InstalledApp> CollectAllCachedPlatformApps(AppCacheModel cache)
        {
            return cache.SteamApps
                .Concat(cache.EpicApps)
                .Concat(cache.GogApps)
                .Concat(cache.RiotApps)
                .Concat(cache.UbisoftApps)
                .Concat(cache.EaApps)
                .Concat(cache.BattleNetApps)
                .Concat(cache.AmazonApps)
                .Concat(cache.XboxApps)
                .ToList();
        }

        private List<InstalledApp> FindNewAppsComparedToSnapshot(AppCacheModel cache, HashSet<string> snapshot)
        {
            if (RefreshAutoAddSuppressions(cache)) SaveAppCache(cache);

            var libraryNow = BuildLibraryKeySet();
            var found = new List<InstalledApp>();
            foreach (var app in CollectAllCachedPlatformApps(cache))
            {
                string key = AppIdentityKey(app);
                if (string.IsNullOrWhiteSpace(key) || snapshot.Contains(key) || libraryNow.Contains(key)) continue;
                var appKeys = AutoAddKeysForApp(app).ToList();
                if (appKeys.Any(k => snapshot.Contains(k) || libraryNow.Contains(k))) continue;
                if (IsAutoAddSuppressed(app, cache)) continue;
                found.Add(app);
            }
            return found
                .GroupBy(a => AppIdentityKey(a), StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .ToList();
        }

        private static string StoreSourceKey(string storeId)
            => StoreCatalog.FirstOrDefault(s => string.Equals(s.Id, storeId, StringComparison.OrdinalIgnoreCase))?.SourceKey ?? storeId;

        private List<InstalledApp> GetInstalledAppsForStore(string storeId, bool includeIcons = false)
        {
            List<InstalledApp> apps = storeId switch
            {
                "Steam" => GetSteamGames(includeIcons),
                "Epic" => GetEpicGames(includeIcons),
                "GOG" => GetGOGGames(includeIcons),
                "Ubisoft" => GetUbisoftGames(includeIcons),
                "EA" => GetEaGames(includeIcons),
                "BattleNet" => GetBattleNetGames(includeIcons),
                "Amazon" => GetAmazonGames(includeIcons),
                "Xbox" => GetXboxGames(includeIcons),
                _ => new List<InstalledApp>()
            };

            string source = StoreSourceKey(storeId);
            foreach (var app in apps) app.Source = source;
            return apps;
        }

        private HashSet<string> BuildStoreAppKeySet(string storeId)
            => GetInstalledAppsForStore(storeId, includeIcons: false)
                .SelectMany(AutoAddKeysForApp)
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

        private HashSet<string> GetStoreFingerprintForStore(string storeId)
        {
            return storeId switch
            {
                "Steam" => GetSteamFingerprint(),
                "Epic" => GetEpicFingerprint(),
                "GOG" => GetGogFingerprint(),
                "Ubisoft" => GetUbisoftFingerprint(),
                "EA" => GetEaFingerprint(),
                "BattleNet" => GetBattleNetFingerprint(),
                "Amazon" => GetAmazonFingerprint(),
                "Xbox" => GetXboxFingerprint(),
                _ => new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            };
        }

        private static List<InstalledApp> GetCachedAppsForStore(AppCacheModel cache, string storeId)
        {
            return storeId switch
            {
                "Steam" => cache.SteamApps,
                "Epic" => cache.EpicApps,
                "GOG" => cache.GogApps,
                "Ubisoft" => cache.UbisoftApps,
                "EA" => cache.EaApps,
                "BattleNet" => cache.BattleNetApps,
                "Amazon" => cache.AmazonApps,
                "Xbox" => cache.XboxApps,
                _ => new List<InstalledApp>()
            };
        }

        private List<GameModel> RemoveDoorpiGamesMissingFromStore(
            string storeId,
            List<InstalledApp> previousApps,
            List<InstalledApp> currentApps)
        {
            var previousKeys = previousApps
                .SelectMany(AutoAddKeysForApp)
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var currentKeys = currentApps
                .SelectMany(AutoAddKeysForApp)
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var missingKeys = previousKeys
                .Where(k => !currentKeys.Contains(k))
                .ToList();

            missingKeys = missingKeys
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (missingKeys.Count == 0) return new List<GameModel>();
            var missingSet = missingKeys.ToHashSet(StringComparer.OrdinalIgnoreCase);

            var games = LoadGames();
            var removed = games
                .Where(g => AutoAddKeysForGame(g).Any(missingSet.Contains))
                .ToList();

            if (removed.Count == 0) return removed;

            foreach (var game in removed)
            {
                DeleteGameImages(game);
                games.Remove(game);
            }

            SaveGames(games);

            lock (_storeLibraryMonitorLock)
            {
                foreach (var game in removed)
                {
                    var key = AutoAddKeyForGame(game);
                    _storeKeysProcessedDuringSession.Remove(key);
                }
            }

            Debug.WriteLine($"[Store] {storeId}: {removed.Count} jogo(s) removido(s) do Doorpi porque sumiram da loja.");
            return removed;
        }

        private static bool InstalledAppListChanged(List<InstalledApp> current, List<InstalledApp> next)
        {
            var currentKeys = current
                .Select(a => $"{AppIdentityKey(a)}|{a.Name}")
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .OrderBy(k => k, StringComparer.OrdinalIgnoreCase)
                .ToList();
            var nextKeys = next
                .Select(a => $"{AppIdentityKey(a)}|{a.Name}")
                .Where(k => !string.IsNullOrWhiteSpace(k))
                .OrderBy(k => k, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return currentKeys.Count != nextKeys.Count || !currentKeys.SequenceEqual(nextKeys, StringComparer.OrdinalIgnoreCase);
        }

        private bool ReplaceCachedStoreApps(AppCacheModel cache, string storeId, List<InstalledApp> apps)
        {
            var fingerprint = GetStoreFingerprintForStore(storeId);
            bool changed = false;

            void ReplaceIfChanged(List<InstalledApp> target, HashSet<string> targetFingerprint, Action<List<InstalledApp>> setApps, Action<HashSet<string>> setFingerprint)
            {
                if (InstalledAppListChanged(target, apps))
                {
                    setApps(apps);
                    changed = true;
                }
                if (!fingerprint.SetEquals(targetFingerprint))
                {
                    setFingerprint(fingerprint);
                    changed = true;
                }
            }

            switch (storeId)
            {
                case "Steam": ReplaceIfChanged(cache.SteamApps, cache.SteamFingerprint, v => cache.SteamApps = v, v => cache.SteamFingerprint = v); break;
                case "Epic": ReplaceIfChanged(cache.EpicApps, cache.EpicFingerprint, v => cache.EpicApps = v, v => cache.EpicFingerprint = v); break;
                case "GOG": ReplaceIfChanged(cache.GogApps, cache.GogFingerprint, v => cache.GogApps = v, v => cache.GogFingerprint = v); break;
                case "Ubisoft": ReplaceIfChanged(cache.UbisoftApps, cache.UbisoftFingerprint, v => cache.UbisoftApps = v, v => cache.UbisoftFingerprint = v); break;
                case "EA": ReplaceIfChanged(cache.EaApps, cache.EaFingerprint, v => cache.EaApps = v, v => cache.EaFingerprint = v); break;
                case "BattleNet": ReplaceIfChanged(cache.BattleNetApps, cache.BattleNetFingerprint, v => cache.BattleNetApps = v, v => cache.BattleNetFingerprint = v); break;
                case "Amazon": ReplaceIfChanged(cache.AmazonApps, cache.AmazonFingerprint, v => cache.AmazonApps = v, v => cache.AmazonFingerprint = v); break;
                case "Xbox":
                    ReplaceIfChanged(cache.XboxApps, cache.XboxFingerprint, v => cache.XboxApps = v, v => cache.XboxFingerprint = v);
                    if (cache.XboxFilterVersion < 2)
                    {
                        cache.XboxFilterVersion = 2;
                        changed = true;
                    }
                    break;
            }

            return changed;
        }

        private async Task<StoreRefreshResult> RefreshStoreAppsAndFindChangesAsync(
            string storeId,
            HashSet<string> storeSnapshot,
            CancellationToken cancellationToken)
        {
            await _cacheLock.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                var apps = GetInstalledAppsForStore(storeId, includeIcons: false);
                cancellationToken.ThrowIfCancellationRequested();

                var cache = LoadAppCache() ?? new AppCacheModel();
                var previousApps = GetCachedAppsForStore(cache, storeId).ToList();
                bool cacheChanged = ReplaceCachedStoreApps(cache, storeId, apps);
                bool suppressionsChanged = RefreshAutoAddSuppressions(cache);
                if (cacheChanged || suppressionsChanged)
                {
                    SaveAppCache(cache);
                    _lastCacheBuilt = DateTime.Now;
                }

                var removedGames = RemoveDoorpiGamesMissingFromStore(storeId, previousApps, apps);
                var libraryNow = BuildLibraryKeySet();
                var found = new List<InstalledApp>();
                foreach (var app in apps)
                {
                    string key = AppIdentityKey(app);
                    if (string.IsNullOrWhiteSpace(key)) continue;
                    var appKeys = AutoAddKeysForApp(app).ToList();
                    if (appKeys.Any(k => storeSnapshot.Contains(k) || libraryNow.Contains(k))) continue;
                    if (IsAutoAddSuppressed(app, cache)) continue;

                    lock (_storeLibraryMonitorLock)
                    {
                        if (_storeKeysProcessedDuringSession.Contains(key)) continue;
                        _storeKeysProcessedDuringSession.Add(key);
                    }

                    found.Add(app);
                }

                return new StoreRefreshResult
                {
                    NewApps = found
                        .GroupBy(a => AppIdentityKey(a), StringComparer.OrdinalIgnoreCase)
                        .Select(g => g.First())
                        .ToList(),
                    RemovedGames = removedGames
                };
            }
            finally
            {
                _cacheLock.Release();
            }
        }

        private async Task ProcessNewStoreAppsAsync(string storeId, HashSet<string> storeSnapshot, CancellationToken cancellationToken)
        {
            var result = await RefreshStoreAppsAndFindChangesAsync(
                storeId,
                storeSnapshot,
                cancellationToken).ConfigureAwait(false);

            var newApps = result.NewApps;
            if (newApps.Count == 0 && result.RemovedGames.Count == 0) return;

            var settings = GetStoreAutoAddSettings();
            var toAutoAdd = newApps.Where(a => IsStoreAutoAddEnabled(settings, a.Source)).ToList();
            if (toAutoAdd.Count > 0) ShowPreparingGameSkeletons(toAutoAdd.Count);
            bool autoAdded = toAutoAdd.Count > 0 && await UpsertAutoAddedPlatformGamesAsync(toAutoAdd).ConfigureAwait(false);
            if (toAutoAdd.Count > 0) StartStoreArtworkRefresh();

            var payloadGames = newApps.Select(a => new
            {
                a.Name,
                a.LaunchUrl,
                a.Path,
                a.Source,
                a.IconBase64,
                autoAdded = IsStoreAutoAddEnabled(settings, a.Source)
            }).ToList();

            if (result.RemovedGames.Count > 0) Dispatcher.Invoke(() => LoadGamesIntoUI());
            SendInstalledAppsToUI();
            if (newApps.Count > 0)
            {
                Dispatcher.Invoke(() =>
                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "newGamesDetected",
                        games = payloadGames
                    })));
            }

            if (result.RemovedGames.Count > 0)
            {
                Dispatcher.Invoke(() =>
                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "gamesRemoved",
                        games = result.RemovedGames.Select(g => new
                        {
                            g.Name,
                            g.LaunchUrl,
                            g.Path
                        }).ToList()
                    })));
            }
        }

        private void StartStoreArtworkRefresh()
        {
            if (Interlocked.CompareExchange(ref _storeArtworkRefreshRunning, 1, 0) != 0) return;
            _ = Task.Run(async () =>
            {
                try
                {
                    await CacheSteamCdnImagesForExistingGamesAsync().ConfigureAwait(false);
                    await EnrichPendingPlatformArtworkAsync().ConfigureAwait(false);
                    SendInstalledAppsToUI();
                }
                catch (Exception ex) { Debug.WriteLine("[Store] Artwork em segundo plano: " + ex.Message); }
                finally { Interlocked.Exchange(ref _storeArtworkRefreshRunning, 0); }
            });
        }

        private void ShowPreparingGameSkeletons(int count)
        {
            if (count <= 0) return;
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(new { type = "bootstrapStarted", count })));
        }

        private void ClearPreparingGameSkeletons()
        {
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(new { type = "clearLoadingCards", tab = "games" })));
        }

        private void StartStoreLibraryMonitor(string storeId)
        {
            StopStoreLibraryMonitor();
            var cts = new CancellationTokenSource();
            _storeLibraryMonitorCts = cts;
            var snapshot = new HashSet<string>(_storeKeysBeforeStore, StringComparer.OrdinalIgnoreCase);

            _ = Task.Run(async () =>
            {
                try
                {
                    while (!cts.IsCancellationRequested)
                    {
                        await Task.Delay(TimeSpan.FromSeconds(12), cts.Token).ConfigureAwait(false);
                        await ProcessNewStoreAppsAsync(storeId, snapshot, cts.Token).ConfigureAwait(false);
                    }
                }
                catch (OperationCanceledException) { }
                catch (Exception ex) { Debug.WriteLine("[Store] Monitor leve: " + ex.Message); }
            });
        }

        private void StartStoreChildGameDetector(string storeId)
        {
            StopStoreChildGameDetector();
            var cts = new CancellationTokenSource();
            _storeChildGameDetectorCts = cts;

            _ = Task.Run(async () =>
            {
                try
                {
                    while (!cts.IsCancellationRequested)
                    {
                        await Task.Delay(TimeSpan.FromSeconds(1), cts.Token).ConfigureAwait(false);

                        if (!_isStoreLauncherSession ||
                            !string.Equals(_activeStoreId, storeId, StringComparison.OrdinalIgnoreCase) ||
                            _storePausedByDoorpi ||
                            string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase) ||
                            (_gameSessionActive && !_storeChildGameActive) ||
                            (_storeChildGameActive && !string.IsNullOrWhiteSpace(_lockedGameProcessName)))
                        {
                            continue;
                        }

                        if (DateTime.UtcNow.Ticks < Interlocked.Read(ref _storeChildDetectionSuppressUntilUtcTicks))
                            continue;

                        var candidate = FindStoreChildGameCandidate(storeId);
                        if (candidate != null)
                        {
                            Dispatcher.Invoke(() => BeginStoreChildGameSession(storeId, candidate));
                            continue;
                        }

                        if (!_storeChildGameActive && !_gameSessionActive)
                        {
                            var launcher = FindStoreChildLauncherCandidate(storeId);
                            if (launcher != null)
                                Dispatcher.Invoke(() => BeginStoreChildLauncherSession(storeId, launcher));
                        }
                    }
                }
                catch (OperationCanceledException) { }
                catch (Exception ex) { Debug.WriteLine("[Store] Detector de jogo filho: " + ex.Message); }
            });
        }

        private void StopStoreChildGameDetector()
        {
            var cts = _storeChildGameDetectorCts;
            _storeChildGameDetectorCts = null;
            try { cts?.Cancel(); } catch { }
            cts?.Dispose();
        }

        private void StopStoreLibraryMonitor()
        {
            var cts = _storeLibraryMonitorCts;
            _storeLibraryMonitorCts = null;
            try { cts?.Cancel(); } catch { }
            cts?.Dispose();
        }

        private sealed class StoreChildGameCandidate
        {
            public GameModel Game { get; init; } = new();
            public IntPtr Hwnd { get; init; }
            public int ProcessId { get; init; }
            public string ProcessName { get; init; } = "";
            public int Score { get; init; }
        }

        private List<(InstalledApp App, GameModel Game)> GetStoreChildGamePairs(string storeId)
        {
            List<InstalledApp> storeApps;
            try
            {
                var cache = LoadAppCache() ?? new AppCacheModel();
                storeApps = GetCachedAppsForStore(cache, storeId).ToList();
                var freshApps = GetInstalledAppsForStore(storeId, includeIcons: false);
                storeApps = storeApps
                    .Concat(freshApps)
                    .GroupBy(AppIdentityKey, StringComparer.OrdinalIgnoreCase)
                    .Select(group =>
                        group.OrderByDescending(a => File.Exists(a.Path) ? 1 : 0)
                             .ThenByDescending(a => a.Path?.Length ?? 0)
                             .First())
                    .ToList();
            }
            catch
            {
                return new();
            }

            var games = LoadGames();
            return storeApps
                .Select(app => new
                {
                    App = app,
                    Game = games.FirstOrDefault(g => InstalledAppMatchesGame(app, g))
                })
                .Where(x => x.Game != null)
                .Select(x => (x.App, x.Game!))
                .ToList();
        }

        private StoreChildGameCandidate? FindStoreChildGameCandidate(string storeId)
        {
            var candidates = GetStoreChildGamePairs(storeId);

            if (candidates.Count == 0) return null;

            StoreChildGameCandidate? best = null;
            foreach (var hWnd in EnumerateTopLevelWindows())
            {
                if (!IsGameplayWindow(hWnd)) continue;

                GetWindowThreadProcessId(hWnd, out uint pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId) continue;

                Process process;
                try { process = Process.GetProcessById((int)pidRaw); }
                catch { continue; }

                var processName = SafeProcessName(process);
                if (string.IsNullOrWhiteSpace(processName)) continue;
                if (_shellProcessNames.Contains(processName)) continue;

                var processPath = SafeProcessPath(process);
                if (!string.IsNullOrWhiteSpace(_storeLauncherExe) &&
                    !string.IsNullOrWhiteSpace(processPath) &&
                    PathsEqual(_storeLauncherExe, processPath))
                {
                    continue;
                }

                foreach (var pair in candidates)
                {
                    var context = BuildStoreChildGameMonitorContext(pair.Game, pair.App, process);
                    if (context.BaselineProcessIds.Contains((int)pidRaw) && _storeWindowSnapshot.Contains(hWnd))
                        continue;

                    int score = ScoreGameWindowCandidate(context, process, hWnd);
                    if (score < 80) continue;

                    if (best == null || score > best.Score)
                    {
                        best = new StoreChildGameCandidate
                        {
                            Game = pair.Game,
                            Hwnd = hWnd,
                            ProcessId = (int)pidRaw,
                            ProcessName = processName,
                            Score = score
                        };
                    }
                }
            }

            return best;
        }

        private StoreChildGameCandidate? FindStoreChildLauncherCandidate(string storeId)
        {
            var candidates = GetStoreChildGamePairs(storeId);
            if (candidates.Count == 0) return null;

            StoreChildGameCandidate? best = null;
            foreach (var hWnd in EnumerateTopLevelWindows())
            {
                if (hWnd == _mainWindowHandle || hWnd == GetShellWindow()) continue;
                if (_storeWindowSnapshot.Contains(hWnd)) continue;
                if (!IsWindowVisible(hWnd) || IsIconic(hWnd)) continue;
                if (!GetWindowRect(hWnd, out RECT rect) || rect.Width < 300 || rect.Height < 240) continue;

                GetWindowThreadProcessId(hWnd, out uint pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId) continue;

                Process process;
                try { process = Process.GetProcessById((int)pidRaw); }
                catch { continue; }

                var processName = SafeProcessName(process);
                if (string.IsNullOrWhiteSpace(processName)) continue;
                if (_shellProcessNames.Contains(processName)) continue;

                var processPath = SafeProcessPath(process);
                if (!string.IsNullOrWhiteSpace(_storeLauncherExe) &&
                    !string.IsNullOrWhiteSpace(processPath) &&
                    PathsEqual(_storeLauncherExe, processPath))
                {
                    continue;
                }

                foreach (var pair in candidates)
                {
                    var context = BuildStoreChildGameMonitorContext(pair.Game, pair.App, process);
                    if (context.BaselineProcessIds.Contains((int)pidRaw) && _storeWindowSnapshot.Contains(hWnd))
                        continue;

                    int score = Math.Max(
                        ScoreStoreChildGameProcessCandidate(pair.Game, pair.App, process),
                        ScoreStoreChildGameCandidate(pair.Game, pair.App, process, hWnd, rect));

                    if (score < 90) continue;

                    if (best == null || score > best.Score)
                    {
                        best = new StoreChildGameCandidate
                        {
                            Game = pair.Game,
                            Hwnd = hWnd,
                            ProcessId = (int)pidRaw,
                            ProcessName = processName,
                            Score = score
                        };
                    }
                }
            }

            return best;
        }

        private GameLaunchMonitorContext BuildStoreChildGameMonitorContext(GameModel game, InstalledApp app, Process process)
        {
            string directPath = "";
            if (!string.IsNullOrWhiteSpace(app.Path) && File.Exists(app.Path))
                directPath = app.Path;
            else if (!string.IsNullOrWhiteSpace(game.Path) && File.Exists(game.Path))
                directPath = game.Path;

            var tokens = BuildGameNameTokens(game);
            if (tokens.Length == 0)
                tokens = BuildGameNameTokens(new GameModel { Name = app.Name, Path = app.Path });

            return new GameLaunchMonitorContext
            {
                Game = game,
                BaselineProcessIds = _storeProcessSnapshot,
                LaunchedProcess = process,
                LaunchedProcessId = SafeProcessId(process),
                DirectExePath = directPath,
                NameTokens = tokens,
                StartedUtc = DateTime.UtcNow
            };
        }

        private int ScoreStoreChildGameProcessCandidate(GameModel game, InstalledApp app, Process process)
        {
            var processName = SafeProcessName(process);
            var processPath = SafeProcessPath(process);
            if (string.IsNullOrWhiteSpace(processName)) return 0;

            var exeName = Path.GetFileNameWithoutExtension(processPath);
            var haystack = $"{processName} {exeName} {processPath}".ToLowerInvariant();
            var score = 0;

            void ScorePath(string? path)
            {
                if (string.IsNullOrWhiteSpace(path) || string.IsNullOrWhiteSpace(processPath)) return;

                try
                {
                    if (File.Exists(path) && PathsEqual(path, processPath))
                    {
                        score += 180;
                        return;
                    }

                    var dir = File.Exists(path) ? Path.GetDirectoryName(path) : path;
                    if (!string.IsNullOrWhiteSpace(dir) &&
                        Path.IsPathRooted(dir) &&
                        processPath.StartsWith(Path.GetFullPath(dir), StringComparison.OrdinalIgnoreCase))
                    {
                        score += 95;
                    }
                }
                catch { }
            }

            ScorePath(app.Path);
            ScorePath(game.Path);

            var tokens = BuildGameNameTokens(game);
            if (tokens.Length == 0)
                tokens = BuildGameNameTokens(new GameModel { Name = app.Name, Path = app.Path });

            string firstToken = tokens.FirstOrDefault() ?? "";
            if (!string.IsNullOrWhiteSpace(firstToken))
            {
                if (exeName.StartsWith(firstToken, StringComparison.OrdinalIgnoreCase)) score += 55;
                if (processName.StartsWith(firstToken, StringComparison.OrdinalIgnoreCase)) score += 45;
            }

            int tokenMatches = tokens.Count(t => haystack.Contains(t, StringComparison.OrdinalIgnoreCase));
            score += tokenMatches * 20;
            if (tokenMatches >= Math.Min(2, Math.Max(1, tokens.Length))) score += 35;

            try
            {
                var mb = process.WorkingSet64 / 1024 / 1024;
                if (mb > 180) score += 15;
                if (mb > 700) score += 20;
            }
            catch { }

            return Math.Max(0, score);
        }

        private int ScoreStoreChildGameCandidate(GameModel game, InstalledApp app, Process process, IntPtr hWnd, RECT rect)
        {
            var processName = SafeProcessName(process);
            var processPath = SafeProcessPath(process);
            var exeName = Path.GetFileNameWithoutExtension(processPath);
            var title = GetWindowTitle(hWnd);
            var haystack = $"{processName} {exeName} {title} {processPath}".ToLowerInvariant();
            var score = 0;

            void ScorePath(string? path)
            {
                if (string.IsNullOrWhiteSpace(path) || string.IsNullOrWhiteSpace(processPath)) return;

                try
                {
                    if (File.Exists(path) && PathsEqual(path, processPath))
                    {
                        score += 160;
                        return;
                    }

                    var dir = File.Exists(path) ? Path.GetDirectoryName(path) : path;
                    if (!string.IsNullOrWhiteSpace(dir) &&
                        processPath.StartsWith(Path.GetFullPath(dir), StringComparison.OrdinalIgnoreCase))
                    {
                        score += 85;
                    }
                }
                catch { }
            }

            ScorePath(app.Path);
            ScorePath(game.Path);

            var tokens = BuildGameNameTokens(game);
            if (tokens.Length == 0)
            {
                var temp = new GameModel { Name = app.Name, Path = app.Path };
                tokens = BuildGameNameTokens(temp);
            }

            string firstToken = tokens.FirstOrDefault() ?? "";
            if (!string.IsNullOrWhiteSpace(firstToken))
            {
                if (exeName.StartsWith(firstToken, StringComparison.OrdinalIgnoreCase)) score += 50;
                if (processName.StartsWith(firstToken, StringComparison.OrdinalIgnoreCase)) score += 35;
                if (title.Contains(firstToken, StringComparison.OrdinalIgnoreCase)) score += 30;
            }

            if (!string.IsNullOrWhiteSpace(title) &&
                (string.Equals(title, game.Name, StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(title, app.Name, StringComparison.OrdinalIgnoreCase)))
            {
                score += 70;
            }

            int tokenMatches = tokens.Count(t => haystack.Contains(t, StringComparison.OrdinalIgnoreCase));
            score += tokenMatches * 18;
            if (tokenMatches >= Math.Min(2, Math.Max(1, tokens.Length))) score += 30;

            int screenW = (int)SystemParameters.PrimaryScreenWidth;
            int screenH = (int)SystemParameters.PrimaryScreenHeight;
            double coverage = screenW > 0 && screenH > 0
                ? (double)(rect.Width * rect.Height) / (double)(screenW * screenH)
                : 0;
            if (coverage >= 0.45) score += 20;
            if (coverage >= 0.80) score += 25;

            try
            {
                var mb = process.WorkingSet64 / 1024 / 1024;
                if (mb > 180) score += 12;
                if (mb > 700) score += 18;
            }
            catch { }

            return Math.Max(0, score);
        }

        private void BeginStoreChildGameSession(string storeId, StoreChildGameCandidate candidate)
        {
            string gameId = !string.IsNullOrWhiteSpace(candidate.Game.LaunchUrl)
                ? candidate.Game.LaunchUrl
                : candidate.Game.Path;
            if (string.IsNullOrWhiteSpace(gameId)) return;

            // Nunca reclassificar sessão já assumida pelo Doorpi.
            if (string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase))
                return;

            // Se a loja está pausada pelo Doorpi, ela não pode "capturar" contexto.
            if (_storePausedByDoorpi)
                return;

            // Só permitimos takeover da loja quando não existe jogo ativo
            // ou quando já estamos promovendo uma cadeia que era da própria loja.
            bool hasNonStoreOwnedActiveGame =
                _gameSessionActive &&
                !string.IsNullOrWhiteSpace(_activeSessionGameId) &&
                !string.Equals(_gameSessionParentKind, "store", StringComparison.OrdinalIgnoreCase);
            if (hasNonStoreOwnedActiveGame)
                return;

            bool promotingLauncherForSameGame =
                _storeChildGameActive &&
                _gameSessionActive &&
                string.IsNullOrWhiteSpace(_lockedGameProcessName) &&
                string.Equals(_storeChildGameId, gameId, StringComparison.OrdinalIgnoreCase);

            if (!_isStoreLauncherSession ||
                !string.Equals(_activeStoreId, storeId, StringComparison.OrdinalIgnoreCase) ||
                ((_gameSessionActive || _storeChildGameActive) && !promotingLauncherForSameGame))
            {
                return;
            }

            MarkStoreChildGameAsPlayed(candidate.Game, gameId);

            _storeControllerActive = false;

            CancellationTokenSource cts;
            lock (_gameLaunchMonitorLock)
            {
                _gameLaunchMonitorCts?.Cancel();
                _gameLaunchMonitorCts?.Dispose();
                _gameLaunchMonitorCts = new CancellationTokenSource();
                cts = _gameLaunchMonitorCts;
            }

            _storeChildGameActive = true;
            _storeChildGameStoreId = storeId;
            _storeChildGameId = gameId;
            _storePausedByDoorpi = false;

            _gameSessionActive = true;
            _gameIsMinimized = false;
            _gameIsRunningAndDoorpiHidden = true;
            _currentGameHwnd = candidate.Hwnd;
            _currentLauncherHwnd = IntPtr.Zero;
            _pendingLaunchProcess = null;
            _lastVisibleWindowBeforeMinimize = IntPtr.Zero;
            _lockedGameProcessName = candidate.ProcessName;
            _activeSessionGameId = gameId;
            _gameSessionParentKind = "store";
            _forceDoorpiReturnOnGameClose = false;
            _sessionStartUtc = DateTime.UtcNow;

            DiscordRpcManager.Instance.UpdateState("game", candidate.Game.Name);
            SendGameLaunchStatus("gameLaunchDone");
            if (IsForegroundDoorpi())
                ShowExecutionLockForGame();
            SendRuntimeSessionsToUI();
            _ = Task.Run(() => MonitorStoreChildGameAsync(candidate.Game, candidate.ProcessName, cts.Token));
        }

        private void BeginStoreChildLauncherSession(string storeId, StoreChildGameCandidate candidate)
        {
            if (!_isStoreLauncherSession ||
                !string.Equals(_activeStoreId, storeId, StringComparison.OrdinalIgnoreCase) ||
                _gameSessionActive ||
                _storeChildGameActive)
            {
                return;
            }

            string gameId = !string.IsNullOrWhiteSpace(candidate.Game.LaunchUrl)
                ? candidate.Game.LaunchUrl
                : candidate.Game.Path;
            if (string.IsNullOrWhiteSpace(gameId)) return;

            // Nunca reclassificar sessão já assumida pelo Doorpi.
            if (string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase))
                return;

            // Se a loja está pausada pelo Doorpi, ela não pode "capturar" contexto.
            if (_storePausedByDoorpi)
                return;

            Process? launcherProcess = null;
            try { launcherProcess = Process.GetProcessById(candidate.ProcessId); } catch { }

            MarkStoreChildGameAsPlayed(candidate.Game, gameId);

            _storeControllerActive = false;
            _storeChildGameActive = true;
            _storeChildGameStoreId = storeId;
            _storeChildGameId = gameId;
            _storePausedByDoorpi = false;

            _gameSessionActive = true;
            _gameIsMinimized = false;
            _gameIsRunningAndDoorpiHidden = true;
            _currentGameHwnd = IntPtr.Zero;
            _currentLauncherHwnd = candidate.Hwnd;
            _lastVisibleWindowBeforeMinimize = candidate.Hwnd;
            _pendingLaunchProcess = launcherProcess;
            _lockedGameProcessName = "";
            _activeSessionGameId = gameId;
            _gameSessionParentKind = "store";
            _forceDoorpiReturnOnGameClose = false;
            _sessionStartUtc = DateTime.UtcNow;

            DiscordRpcManager.Instance.UpdateState("game", candidate.Game.Name);
            SendGameLaunchStatus("gameLaunchDone");
            if (IsForegroundDoorpi())
                ShowExecutionLockForGame();
            SendRuntimeSessionsToUI();
        }

        private void MarkStoreChildGameAsPlayed(GameModel game, string gameId)
        {
            try
            {
                var games = LoadGames();
                var existing = games.FirstOrDefault(g =>
                    string.Equals(g.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(g.Path, gameId, StringComparison.OrdinalIgnoreCase) ||
                    InstalledAppMatchesGame(new InstalledApp
                    {
                        Name = game.Name,
                        Path = game.Path,
                        LaunchUrl = game.LaunchUrl
                    }, g));

                if (existing == null) return;

                existing.LastPlayed = DateTime.Now;
                SaveGames(games);
                LoadGamesIntoUI();

                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "updateFeaturedCard",
                    tab = "games",
                    id = gameId
                }));
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Store] Atualizar jogado recentemente: " + ex.Message);
            }
        }

        private async Task MonitorStoreChildGameAsync(GameModel game, string processName, CancellationToken token)
        {
            try
            {
                int missingChecks = 0;
                bool launchDoneSent = _currentGameHwnd != IntPtr.Zero;

                while (!token.IsCancellationRequested &&
                       _storeChildGameActive &&
                       string.Equals(_gameSessionParentKind, "store", StringComparison.OrdinalIgnoreCase))
                {
                    if (_gameIsMinimized)
                    {
                        bool canTreatForegroundAsRestore =
                            DateTime.UtcNow.Ticks >= Interlocked.Read(ref _ignoreGameForegroundRestoreUntilUtcTicks) &&
                            !IsDoorpiMainWindowForeground();

                        if (canTreatForegroundAsRestore && IsForegroundOwnedByCurrentGame())
                        {
                            Dispatcher.Invoke(MarkCurrentGameForegroundRestored);
                            continue;
                        }

                        missingChecks = 0;
                        await Task.Delay(500, token).ConfigureAwait(false);
                        continue;
                    }

                    bool alive = false;
                    try
                    {
                        alive = !string.IsNullOrWhiteSpace(processName) &&
                            Process.GetProcessesByName(processName).Length > 0;
                    }
                    catch { }

                    if (alive)
                    {
                        missingChecks = 0;
                        if (_currentGameHwnd == IntPtr.Zero || !IsWindowVisible(_currentGameHwnd) || IsIconic(_currentGameHwnd))
                        {
                            foreach (var proc in Process.GetProcessesByName(processName))
                            {
                                try
                                {
                                    var hwnd = FindAnyWindowForProcess(proc.Id);
                                    if (hwnd != IntPtr.Zero)
                                    {
                                        _currentGameHwnd = hwnd;
                                        Dispatcher.Invoke(() =>
                                        {
                                            _gameIsRunningAndDoorpiHidden = true;
                                            if (!launchDoneSent)
                                            {
                                                SendGameLaunchStatus("gameLaunchDone");
                                                launchDoneSent = true;
                                            }
                                            if (IsForegroundDoorpi())
                                                ShowExecutionLockForGame();
                                        });
                                        break;
                                    }
                                }
                                catch { }
                            }
                        }
                        else if (!launchDoneSent)
                        {
                            Dispatcher.Invoke(() =>
                            {
                                _gameIsRunningAndDoorpiHidden = true;
                                SendGameLaunchStatus("gameLaunchDone");
                                launchDoneSent = true;
                                if (IsForegroundDoorpi())
                                    ShowExecutionLockForGame();
                            });
                        }
                    }
                    else if (++missingChecks >= 4)
                    {
                        _gameIsRunningAndDoorpiHidden = false; 
                        Dispatcher.Invoke(() => HandleStoreChildGameClosed(game));
                        return;
                    }

                    await Task.Delay(300, token).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex) { Debug.WriteLine("[Store] Monitor jogo filho: " + ex.Message); }
        }

        private void HandleStoreChildGameClosed(GameModel game)
        {
            if (!_storeChildGameActive ||
                !string.Equals(_gameSessionParentKind, "store", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            string storeId = _storeChildGameStoreId;
            if (IsGogStoreId(storeId))
                _gogBackInputPendingOnStoreResume = true;

            // NOVO: sinaliza que o jogo não está mais oculto atrás do Doorpi,
            // impedindo que o Activated dispare ShowExecutionLockForGame durante a transição
            _gameIsRunningAndDoorpiHidden = false;

            // NOVO: suprime qualquer execution lock por 5s enquanto a loja retoma
            Interlocked.Exchange(ref _executionLockSuppressUntilUtcTicks,
                DateTime.UtcNow.AddSeconds(5).Ticks);
            // Evita redetectar launcher/jogo enquanto a loja retoma e estabiliza.
            Interlocked.Exchange(ref _storeChildDetectionSuppressUntilUtcTicks,
                DateTime.UtcNow.AddSeconds(4).Ticks);

            CommitActiveSession();
            ClearGameWindowSession();
            _storeChildGameActive = false;
            _storeChildGameStoreId = "";
            _storeChildGameId = "";
            SendRuntimeSessionsToUI();

            if (_isStoreLauncherSession &&
                string.Equals(_activeStoreId, storeId, StringComparison.OrdinalIgnoreCase))
            {
                _storePausedByDoorpi = true;
                ResumeStoreSession();
            }
            else
            {
                ForceFocus();
            }
        }

        private bool IsActiveGameFromStoreChild(string id)
            => _storeChildGameActive &&
               string.Equals(_gameSessionParentKind, "store", StringComparison.OrdinalIgnoreCase) &&
               !string.IsNullOrWhiteSpace(id) &&
               string.Equals(_storeChildGameId, id, StringComparison.OrdinalIgnoreCase);

        private bool IsStoreChildGameBlockingStoreControls()
            => _storeChildGameActive &&
               string.Equals(_gameSessionParentKind, "store", StringComparison.OrdinalIgnoreCase) &&
               _gameSessionActive &&
               !_gameIsMinimized;

        private bool IsGameOwnedByActiveStore(GameModel game)
        {
            if (!_isStoreLauncherSession ||
                string.IsNullOrWhiteSpace(_activeStoreId))
            {
                return false;
            }

            try
            {
                var pairs = GetStoreChildGamePairs(_activeStoreId);
                return pairs.Any(pair => InstalledAppMatchesGame(pair.App, game));
            }
            catch
            {
                return false;
            }
        }

        private void MarkStorePausedBecauseChildGameReturnedToDoorpi()
        {
            if (_storeChildGameActive &&
                _isStoreLauncherSession &&
                string.Equals(_gameSessionParentKind, "store", StringComparison.OrdinalIgnoreCase))
            {
                _storePausedByDoorpi = true;
            }
        }

        private bool IsActiveStoreLauncherProcessAlive()
        {
            try
            {
                if (_storeLauncherProcess != null && !SafeHasExited(_storeLauncherProcess))
                    return true;
            }
            catch { }

            if (string.IsNullOrWhiteSpace(_storeLauncherExe)) return false;

            if (IsBattleNetStoreWindowLookup(_activeStoreId ?? "", _storeLauncherExe))
                return IsBattleNetRelatedProcessAlive();

            if (IsGogStoreWindowLookup(_activeStoreId ?? "", _storeLauncherExe))
                return IsGogRelatedProcessAlive();

            try
            {
                string procName = Path.GetFileNameWithoutExtension(_storeLauncherExe);
                foreach (var process in Process.GetProcessesByName(procName))
                {
                    try
                    {
                        if (!process.HasExited && PathsEqual(SafeProcessPath(process), _storeLauncherExe))
                            return true;
                    }
                    catch { }
                }
            }
            catch { }

            return false;
        }

        private bool IsBattleNetRelatedProcessAlive()
        {
            try
            {
                foreach (var process in Process.GetProcesses())
                {
                    try
                    {
                        if (SafeHasExited(process)) continue;
                        string processName = SafeProcessName(process);
                        if (IsBattleNetProcessName(processName))
                            return true;
                    }
                    catch { }
                    finally
                    {
                        try { process.Dispose(); } catch { }
                    }
                }
            }
            catch { }

            return false;
        }

        private bool IsGogRelatedProcessAlive()
        {
            try
            {
                return SnapshotProcessNamesById().Values.Any(IsGogRelatedProcessName);
            }
            catch { return false; }
        }

        private void InitializeStoreLauncherProcessGroup(Process? rootProcess)
        {
            _storeProcessGroupIds.Clear();
            _storeProcessGroupRootDirectory = "";
            _storeProcessGroupExeName = "";

            try
            {
                if (!string.IsNullOrWhiteSpace(_storeLauncherExe) && File.Exists(_storeLauncherExe))
                {
                    _storeProcessGroupRootDirectory = Path.GetDirectoryName(Path.GetFullPath(_storeLauncherExe)) ?? "";
                    _storeProcessGroupExeName = Path.GetFileNameWithoutExtension(_storeLauncherExe);
                }
            }
            catch { }

            try
            {
                if (rootProcess != null && !SafeHasExited(rootProcess))
                    _storeProcessGroupIds.Add(rootProcess.Id);
            }
            catch { }

            ExpandStoreLauncherProcessGroup();
        }

        private void ExpandStoreLauncherProcessGroup()
        {
            if (string.IsNullOrWhiteSpace(_storeLauncherExe))
                return;

            if (_storeProcessGroupIds.Count == 0)
            {
                try
                {
                    if (_storeLauncherProcess != null && !SafeHasExited(_storeLauncherProcess))
                        _storeProcessGroupIds.Add(_storeLauncherProcess.Id);
                }
                catch { }
            }

            var parentIds = SnapshotParentProcessIds();
            Process[] processes;
            try { processes = Process.GetProcesses(); }
            catch { return; }

            bool changed;
            do
            {
                changed = false;
                foreach (var process in processes)
                {
                    int pid;
                    try { pid = process.Id; } catch { continue; }
                    if (_storeProcessGroupIds.Contains(pid)) continue;

                    bool hasStoreExeName =
                        !string.IsNullOrWhiteSpace(_storeProcessGroupExeName) &&
                        string.Equals(SafeProcessName(process), _storeProcessGroupExeName, StringComparison.OrdinalIgnoreCase);
                    bool isDescendant = HasAncestorInGroup(pid, parentIds, _storeProcessGroupIds);
                    bool isNewRelatedProcess =
                        !_storeProcessSnapshot.Contains(pid) &&
                        hasStoreExeName;

                    if (isDescendant || isNewRelatedProcess)
                    {
                        _storeProcessGroupIds.Add(pid);
                        changed = true;
                    }
                }
            }
            while (changed);
        }

        private HashSet<int> GetStoreLauncherProcessIdsForClose()
        {
            var ids = new HashSet<int>(_storeProcessGroupIds);

            try
            {
                if (_storeLauncherProcess != null && !SafeHasExited(_storeLauncherProcess))
                    ids.Add(_storeLauncherProcess.Id);
            }
            catch { }

            return ids;
        }

        private bool HasActiveStoreLauncherWindow()
        {
            if (string.IsNullOrWhiteSpace(_storeLauncherExe))
                return false;

            try
            {
                return TryFindStoreWindow(_activeStoreId ?? "", _storeLauncherExe, out _, out _);
            }
            catch { return false; }
        }

        private void FinalizeStoreTraySession()
        {
            if (_storeTrayCloseInProgress)
                return;

            if (!_isStoreLauncherSession || _storePausedByDoorpi || IsStoreChildGameBlockingStoreControls())
                return;

            if (!_storeLauncherWindowSeen || HasActiveStoreLauncherWindow())
                return;

            _storeTrayCloseInProgress = true;
            try
            {
                CloseStoreSessionCompletely();
            }
            finally
            {
                _storeTrayCloseInProgress = false;
            }
        }

        private void BeginStoreLauncherSession(string storeId)
        {
            _isStoreLauncherSession = true;
            _storePausedByDoorpi = false;
            _storeMouseModeRequested = false;
            _storeMouseModeInitialized = false;
            _storeLauncherWindowSeen = false;
            _storeTrayCloseInProgress = false;
            _activeStoreId = storeId;
            _storeProcessSnapshot = SnapshotProcessIds();
            _storeProcessGroupIds = new();
            _storeProcessGroupRootDirectory = "";
            _storeProcessGroupExeName = "";
            _storeWindowSnapshot = SnapshotVisibleWindows();
            if (string.Equals(storeId, "GOG", StringComparison.OrdinalIgnoreCase))
            {
                _gogDiagnosticLogSeen.Clear();
                ResetGogWindowLog();
            }
            _libraryKeysBeforeStore = BuildLibraryKeySet();
            _storeKeysBeforeStore = BuildStoreAppKeySet(storeId);
            lock (_storeLibraryMonitorLock)
                _storeKeysProcessedDuringSession = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            StartStoreLibraryMonitor(storeId);
            StartStoreChildGameDetector(storeId);
        }

        private async Task OpenStoreAsync(string storeId)
        {
            ResumeExecutionLockWatch();

            var store = StoreCatalog.FirstOrDefault(s => string.Equals(s.Id, storeId, StringComparison.OrdinalIgnoreCase));
            if (store == null) return;

            var card = LoadStoreLaunchers().FirstOrDefault(s => string.Equals(s.Id, storeId, StringComparison.OrdinalIgnoreCase));
            string heroImg = card?.HeroImage ?? "";
            string gridImg = card?.GridImage ?? "";

            if (_isStoreLauncherSession)
            {
                if (string.Equals(_activeStoreId, store.Id, StringComparison.OrdinalIgnoreCase))
                {
                    if (TryRestoreStoreChildGameSession())
                        return;

                    if (IsActiveStoreLauncherProcessAlive())
                    {
                        SendGameLaunchStatus("gameLaunching", store.Name, heroImg, gridImg, "storeRestore");
                        ResumeStoreSession();
                        return;
                    }

                    CloseStoreSessionCompletely();
                }
                else
                {
                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "storeAlreadyRunning",
                        currentStoreId = _activeStoreId
                    }));
                    return;
                }
            }

            SendGameLaunchStatus("gameLaunching", store.Name, heroImg, gridImg, "store");
            if (string.Equals(store.Id, "Xbox", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    await Dispatcher.InvokeAsync(() => { }, System.Windows.Threading.DispatcherPriority.Render);
                }
                catch { }
            }
            BeginStoreLauncherSession(store.Id);
            _storeLauncherExe = ResolveStoreLauncherExe(store.Id);

            SuspendMainUiGamepadForGameLaunch();
            if (string.Equals(store.Id, "Xbox", StringComparison.OrdinalIgnoreCase))
                TerminateXboxProcessesForFreshLaunch(_storeLauncherExe);

            if (!string.IsNullOrEmpty(_storeLauncherExe) && File.Exists(_storeLauncherExe))
            {
                _storeSessionKind = "exe";
                try
                {
                    var existing = FindRunningProcessForExe(_storeLauncherExe);
                    if (TryFindStoreWindow(store.Id, _storeLauncherExe, out var existingWindowProc, out _))
                    {
                        EnterStoreExeMode(existingWindowProc, store.Name, heroImg, gridImg);
                        return;
                    }

                    var proc = Process.Start(new ProcessStartInfo
                    {
                        FileName = _storeLauncherExe,
                        UseShellExecute = true,
                        WorkingDirectory = Path.GetDirectoryName(_storeLauncherExe) ?? "",
                        WindowStyle = ProcessWindowStyle.Maximized
                    });

                    if (proc == null)
                    {
                        await Task.Delay(800).ConfigureAwait(false);
                        proc = FindRunningProcessForExe(_storeLauncherExe);
                    }

                    if (proc == null)
                        proc = existing;

                    if (proc != null &&
                        IsStoreMainWindowLookupAwaited(store.Id, _storeLauncherExe ?? ""))
                    {
                        EnterStoreExeMode(proc, store.Name, heroImg, gridImg);
                        return;
                    }

                    for (int i = 0; i < 20; i++)
                    {
                        var visible = FindRunningStoreProcessWithWindow(_storeLauncherExe);
                        if (visible != null)
                        {
                            proc = visible;
                            break;
                        }

                        await Task.Delay(150).ConfigureAwait(false);
                    }

                    if (string.Equals(store.Id, "Xbox", StringComparison.OrdinalIgnoreCase) &&
                        !string.IsNullOrWhiteSpace(_storeLauncherExe))
                    {
                        if (!TryFindStoreWindow(store.Id, _storeLauncherExe, out _, out _))
                        {
                            RequestXboxMainWindow();
                            for (int i = 0; i < 20; i++)
                            {
                                if (TryFindStoreWindow(store.Id, _storeLauncherExe, out var xboxProc, out _))
                                {
                                    proc = xboxProc;
                                    break;
                                }
                                await Task.Delay(120).ConfigureAwait(false);
                            }
                        }
                    }

                    if (proc != null)
                    {
                        EnterStoreExeMode(proc, store.Name, heroImg, gridImg);
                        return;
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[Store] Falha ao abrir exe {store.Id}: {ex.Message}"); }
            }

            if (string.Equals(store.Id, "Xbox", StringComparison.OrdinalIgnoreCase))
            {
                _storeSessionKind = "exe";
                try
                {
                    RequestXboxMainWindow();
                    for (int i = 0; i < 30; i++)
                    {
                        if (TryFindStoreWindow(store.Id, _storeLauncherExe ?? "", out var xboxProc, out _))
                        {
                            EnterStoreExeMode(xboxProc, store.Name, heroImg, gridImg);
                            return;
                        }
                        await Task.Delay(120).ConfigureAwait(false);
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[Store] Falha ao abrir Xbox por protocolo: {ex.Message}"); }
            }

            _storeSessionKind = "web";
            _storeLauncherExe = null;
            await OpenWebViewInlineAsync(store.WebUrl, false, store.Name, heroImg, gridImg);
        }

        private bool TryRestoreStoreChildGameSession()
        {
            if (!_storeChildGameActive ||
                !_gameSessionActive ||
                string.IsNullOrWhiteSpace(_storeChildGameId))
            {
                return false;
            }

            var hwnd = ResolveCurrentGameWindow();
            if (hwnd != IntPtr.Zero)
            {
                _storePausedByDoorpi = true;
                _storeControllerActive = false;
                _gameIsMinimized = false;
                _gameIsRunningAndDoorpiHidden = true;
                ClearExecutionLock();
                RestoreGameCleanly(hwnd);
                SendGameLaunchStatus("gameLaunchDone");
                SendRuntimeSessionsToUI();
                return true;
            }

            if (IsForegroundDoorpi())
                ShowExecutionLockForGame();

            SendRuntimeSessionsToUI();
            return true;
        }

        private Process? FindRunningStoreProcessWithWindow(string exePath)
        {
            try
            {
                string storeId = _activeStoreId ?? "";
                if (TryFindStoreWindow(storeId, exePath, out var storeProc, out _))
                    return storeProc;

                if (IsStoreMainWindowLookupAwaited(storeId, exePath))
                    return null;

                string name = Path.GetFileNameWithoutExtension(exePath);
                foreach (var p in Process.GetProcessesByName(name))
                {
                    try
                    {
                        if (!PathsEqual(SafeProcessPath(p), exePath)) continue;
                        if (FindVisibleWindowForProcess(p.Id) != IntPtr.Zero)
                            return p;
                    }
                    catch { }
                }
            }
            catch { }

            return null;
        }

        private static bool IsSteamStoreWindowLookup(string storeId, string exePath)
            => string.Equals(storeId, "Steam", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(Path.GetFileNameWithoutExtension(exePath), "steam", StringComparison.OrdinalIgnoreCase);

        private static bool IsBattleNetStoreWindowLookup(string storeId, string exePath)
            => string.Equals(storeId, "BattleNet", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(storeId, "Battle.net", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(Path.GetFileNameWithoutExtension(exePath), "Battle.net Launcher", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(Path.GetFileNameWithoutExtension(exePath), "Battle.net", StringComparison.OrdinalIgnoreCase);

        private static bool IsGogStoreWindowLookup(string storeId, string exePath)
            => string.Equals(storeId, "GOG", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(Path.GetFileNameWithoutExtension(exePath), "GalaxyClient", StringComparison.OrdinalIgnoreCase);

        private static bool IsStoreMainWindowLookupAwaited(string storeId, string exePath)
            => IsSteamStoreWindowLookup(storeId, exePath) ||
               IsBattleNetStoreWindowLookup(storeId, exePath) ||
               IsGogStoreWindowLookup(storeId, exePath);

        private bool TryFindStoreWindow(string storeId, string exePath, out Process process, out IntPtr hwnd)
        {
            process = null!;
            hwnd = IntPtr.Zero;

            if (string.Equals(storeId, "Xbox", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(Path.GetFileNameWithoutExtension(exePath), "xboxpcapp", StringComparison.OrdinalIgnoreCase))
            {
                return TryFindXboxStoreWindow(exePath, out process, out hwnd);
            }

            if (IsSteamStoreWindowLookup(storeId, exePath))
            {
                return TryFindSteamWindow(out process, out hwnd);
            }

            if (IsBattleNetStoreWindowLookup(storeId, exePath))
            {
                return TryFindBattleNetWindow(out process, out hwnd);
            }

            if (IsGogStoreId(storeId))
            {
                LogGogLauncherDiagnostics(exePath);
                return TryFindGogWindow(exePath, out process, out hwnd);
            }

            var running = FindRunningStoreProcessWithWindowByExeOnly(exePath);
            if (running == null) return false;

            var window = FindVisibleWindowForProcess(running.Id);
            if (window == IntPtr.Zero) return false;

            process = running;
            hwnd = window;
            return true;
        }

        private void TerminateXboxProcessesForFreshLaunch(string? xboxExePath)
        {
            try
            {
                var killNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "xboxpcapp",
                    "gamingservicesui",
                    "xboxappservices"
                };

                foreach (var process in Process.GetProcesses())
                {
                    try
                    {
                        if (process.Id == Environment.ProcessId || SafeHasExited(process))
                            continue;

                        string processName = SafeProcessName(process);
                        bool shouldKill = killNames.Contains(processName);

                        if (!shouldKill && !string.IsNullOrWhiteSpace(xboxExePath))
                        {
                            var processPath = SafeProcessPath(process);
                            if (!string.IsNullOrWhiteSpace(processPath))
                                shouldKill = PathsEqual(processPath, xboxExePath);
                        }

                        if (!shouldKill) continue;

                        try
                        {
                            process.Kill(true);
                            process.WaitForExit(2000);
                        }
                        catch
                        {
                            try
                            {
                                process.Kill();
                                process.WaitForExit(1000);
                            }
                            catch { }
                        }
                    }
                    catch { }
                    finally
                    {
                        try { process.Dispose(); } catch { }
                    }
                }
            }
            catch { }
        }

        private bool TryFindXboxStoreWindow(string exePath, out Process process, out IntPtr hwnd)
        {
            process = null!;
            hwnd = IntPtr.Zero;

            Process? bestWindowOwner = null;
            IntPtr bestHwnd = IntPtr.Zero;
            int bestScore = 0;

            foreach (var candidateHwnd in EnumerateTopLevelWindows())
            {
                GetWindowThreadProcessId(candidateHwnd, out uint pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId) continue;

                Process candidateProcess;
                try { candidateProcess = Process.GetProcessById((int)pidRaw); }
                catch { continue; }

                string processName = SafeProcessName(candidateProcess);
                bool isXboxApp = string.Equals(processName, "xboxpcapp", StringComparison.OrdinalIgnoreCase);
                bool isFrameHost = string.Equals(processName, "applicationframehost", StringComparison.OrdinalIgnoreCase);
                bool isGamingUi = string.Equals(processName, "gamingservicesui", StringComparison.OrdinalIgnoreCase);
                if (!isXboxApp && !isFrameHost && !isGamingUi) continue;

                string title = GetWindowTitle(candidateHwnd);
                if (!GetWindowRect(candidateHwnd, out RECT rect)) continue;
                if (rect.Width < 320 || rect.Height < 220) continue;
                if (!IsWindowVisible(candidateHwnd) && !IsIconic(candidateHwnd)) continue;

                bool titleLooksXbox =
                    title.Contains("Xbox", StringComparison.OrdinalIgnoreCase) ||
                    title.Contains("Game Pass", StringComparison.OrdinalIgnoreCase);

                if (!isXboxApp && !titleLooksXbox) continue;

                int score = 0;
                if (isXboxApp) score += 60;
                if (isFrameHost) score += 25;
                if (isGamingUi) score += 15;
                if (!string.IsNullOrWhiteSpace(title)) score += 20;
                if (title.Equals("Xbox", StringComparison.OrdinalIgnoreCase)) score += 50;
                else if (titleLooksXbox) score += 35;
                if (rect.Width >= 700 && rect.Height >= 450) score += 20;
                else if (rect.Width >= 400 && rect.Height >= 300) score += 10;
                if (!IsIconic(candidateHwnd)) score += 8;

                if (score > bestScore)
                {
                    bestScore = score;
                    bestWindowOwner = candidateProcess;
                    bestHwnd = candidateHwnd;
                }
            }

            if (bestWindowOwner == null || bestHwnd == IntPtr.Zero || bestScore < 45)
                return false;

            process = FindRunningProcessForExe(exePath) ?? bestWindowOwner;
            hwnd = bestHwnd;
            return true;
        }

        private Process? FindRunningStoreProcessWithWindowByExeOnly(string exePath)
        {
            try
            {
                string name = Path.GetFileNameWithoutExtension(exePath);
                foreach (var p in Process.GetProcessesByName(name))
                {
                    try
                    {
                        if (!PathsEqual(SafeProcessPath(p), exePath)) continue;
                        if (FindVisibleWindowForProcess(p.Id) != IntPtr.Zero)
                            return p;
                    }
                    catch { }
                }
            }
            catch { }

            return null;
        }

        private bool TryFindSteamWindow(out Process process, out IntPtr hwnd)
        {
            process = null!;
            hwnd = IntPtr.Zero;
            Process? bestProcess = null;
            IntPtr bestHwnd = IntPtr.Zero;
            int bestScore = 0;

            foreach (var candidateHwnd in EnumerateTopLevelWindows())
            {
                GetWindowThreadProcessId(candidateHwnd, out uint pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId) continue;

                Process candidateProcess;
                try { candidateProcess = Process.GetProcessById((int)pidRaw); }
                catch { continue; }

                string processName = SafeProcessName(candidateProcess);
                bool isSteamProcess = string.Equals(processName, "steam", StringComparison.OrdinalIgnoreCase);
                bool isSteamWebHelper = string.Equals(processName, "steamwebhelper", StringComparison.OrdinalIgnoreCase);
                if (!isSteamProcess && !isSteamWebHelper) continue;

                string title = GetWindowTitle(candidateHwnd);
                string className = GetWindowClassNameSafe(candidateHwnd);
                if (!IsSteamMainWindowCandidate(candidateHwnd, title, className, allowIconic: _storeLauncherWindowSeen))
                    continue;

                int score = 0;
                if (isSteamProcess) score += 45;
                if (isSteamWebHelper) score += 35;
                if (!string.IsNullOrWhiteSpace(title)) score += 25;
                if (title.Equals("Steam", StringComparison.OrdinalIgnoreCase)) score += 80;
                else if (title.Contains("Steam", StringComparison.OrdinalIgnoreCase)) score += 50;
                if (!IsIconic(candidateHwnd)) score += 10;

                if (score > bestScore)
                {
                    bestScore = score;
                    bestProcess = candidateProcess;
                    bestHwnd = candidateHwnd;
                }
            }

            if (bestProcess == null || bestHwnd == IntPtr.Zero || bestScore < 45)
                return false;

            process = bestProcess;
            hwnd = bestHwnd;
            return true;
        }

        private bool TryFindSteamInteractiveWindow(out Process process, out IntPtr hwnd)
        {
            process = null!;
            hwnd = IntPtr.Zero;
            Process? bestProcess = null;
            IntPtr bestHwnd = IntPtr.Zero;
            int bestScore = 0;

            foreach (var candidateHwnd in EnumerateTopLevelWindows())
            {
                if (!IsWindowVisible(candidateHwnd) || IsIconic(candidateHwnd))
                    continue;

                GetWindowThreadProcessId(candidateHwnd, out uint pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId) continue;

                Process candidateProcess;
                try { candidateProcess = Process.GetProcessById((int)pidRaw); }
                catch { continue; }

                string processName = SafeProcessName(candidateProcess);
                bool isSteamProcess = string.Equals(processName, "steam", StringComparison.OrdinalIgnoreCase);
                bool isSteamWebHelper = string.Equals(processName, "steamwebhelper", StringComparison.OrdinalIgnoreCase);
                if (!isSteamProcess && !isSteamWebHelper) continue;

                string title = GetWindowTitle(candidateHwnd).Trim();
                string className = GetWindowClassNameSafe(candidateHwnd);
                int score = 0;

                if (isSteamProcess) score += 40;
                if (isSteamWebHelper) score += 35;
                if (!string.IsNullOrWhiteSpace(title)) score += 20;
                if (title.Contains("Steam", StringComparison.OrdinalIgnoreCase)) score += 35;
                if (string.Equals(className, "BootstrapUpdateUIClass", StringComparison.OrdinalIgnoreCase)) score += 45;
                if (title.Contains("iniciar a sessÃ£o", StringComparison.OrdinalIgnoreCase) ||
                    title.Contains("iniciando sessÃ£o", StringComparison.OrdinalIgnoreCase) ||
                    title.Contains("sessÃ£o no steam", StringComparison.OrdinalIgnoreCase) ||
                    title.Contains("sign in", StringComparison.OrdinalIgnoreCase) ||
                    title.Contains("signing in", StringComparison.OrdinalIgnoreCase) ||
                    title.Contains("login", StringComparison.OrdinalIgnoreCase))
                {
                    score += 45;
                }

                if (score > bestScore)
                {
                    bestScore = score;
                    bestProcess = candidateProcess;
                    bestHwnd = candidateHwnd;
                }
            }

            if (bestProcess == null || bestHwnd == IntPtr.Zero || bestScore < 35)
                return false;

            process = bestProcess;
            hwnd = bestHwnd;
            return true;
        }

        private bool TryFindBattleNetWindow(out Process process, out IntPtr hwnd)
        {
            process = null!;
            hwnd = IntPtr.Zero;
            Process? bestProcess = null;
            IntPtr bestHwnd = IntPtr.Zero;
            int bestScore = 0;

            foreach (var candidateHwnd in EnumerateTopLevelWindows())
            {
                GetWindowThreadProcessId(candidateHwnd, out uint pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId) continue;

                Process candidateProcess;
                try { candidateProcess = Process.GetProcessById((int)pidRaw); }
                catch { continue; }

                string processName = SafeProcessName(candidateProcess);
                if (!IsBattleNetProcessName(processName)) continue;

                string title = GetWindowTitle(candidateHwnd);
                string className = GetWindowClassNameSafe(candidateHwnd);
                if (!IsBattleNetMainWindowCandidate(candidateHwnd, processName, title, className, allowIconic: _storeLauncherWindowSeen))
                    continue;

                int score = 0;
                if (string.Equals(processName, "Battle.net", StringComparison.OrdinalIgnoreCase)) score += 65;
                if (string.Equals(processName, "Battle.net Launcher", StringComparison.OrdinalIgnoreCase)) score += 45;
                if (!string.IsNullOrWhiteSpace(title)) score += 25;
                if (title.Equals("Battle.net", StringComparison.OrdinalIgnoreCase)) score += 90;
                else if (title.Contains("Battle.net", StringComparison.OrdinalIgnoreCase)) score += 55;
                if (!IsIconic(candidateHwnd)) score += 10;

                if (score > bestScore)
                {
                    bestScore = score;
                    bestProcess = candidateProcess;
                    bestHwnd = candidateHwnd;
                }
            }

            if (bestProcess == null || bestHwnd == IntPtr.Zero || bestScore < 55)
                return false;

            process = bestProcess;
            hwnd = bestHwnd;
            return true;
        }

        private bool TryFindBattleNetInteractiveWindow(out Process process, out IntPtr hwnd)
        {
            process = null!;
            hwnd = IntPtr.Zero;
            Process? bestProcess = null;
            IntPtr bestHwnd = IntPtr.Zero;
            int bestScore = 0;

            foreach (var candidateHwnd in EnumerateTopLevelWindows())
            {
                if (!IsWindowVisible(candidateHwnd) || IsIconic(candidateHwnd))
                    continue;

                GetWindowThreadProcessId(candidateHwnd, out uint pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId) continue;

                Process candidateProcess;
                try { candidateProcess = Process.GetProcessById((int)pidRaw); }
                catch { continue; }

                string processName = SafeProcessName(candidateProcess);
                if (!IsBattleNetProcessName(processName)) continue;

                string title = GetWindowTitle(candidateHwnd).Trim();
                string className = GetWindowClassNameSafe(candidateHwnd);
                int score = 0;

                if (string.Equals(processName, "Battle.net", StringComparison.OrdinalIgnoreCase)) score += 55;
                if (string.Equals(processName, "Battle.net Launcher", StringComparison.OrdinalIgnoreCase)) score += 45;
                if (string.Equals(processName, "Battle.net Update Agent", StringComparison.OrdinalIgnoreCase)) score += 20;
                if (string.Equals(processName, "Agent", StringComparison.OrdinalIgnoreCase)) score += 20;
                if (!string.IsNullOrWhiteSpace(title)) score += 20;
                if (title.Contains("Battle.net", StringComparison.OrdinalIgnoreCase)) score += 35;
                if (className.Contains("Chrome", StringComparison.OrdinalIgnoreCase) ||
                    className.Contains("Qt", StringComparison.OrdinalIgnoreCase))
                {
                    score += 10;
                }

                if (score > bestScore)
                {
                    bestScore = score;
                    bestProcess = candidateProcess;
                    bestHwnd = candidateHwnd;
                }
            }

            if (bestProcess == null || bestHwnd == IntPtr.Zero || bestScore < 35)
                return false;

            process = bestProcess;
            hwnd = bestHwnd;
            return true;
        }

        private bool TryFindGogWindow(string exePath, out Process process, out IntPtr hwnd)
        {
            process = null!;
            hwnd = IntPtr.Zero;
            Process? bestProcess = null;
            IntPtr bestHwnd = IntPtr.Zero;
            int bestScore = 0;

            foreach (var candidateHwnd in EnumerateTopLevelWindows())
            {
                GetWindowThreadProcessId(candidateHwnd, out uint pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId) continue;

                Process candidateProcess;
                try { candidateProcess = Process.GetProcessById((int)pidRaw); }
                catch { continue; }

                string processName = SafeProcessName(candidateProcess);
                if (!IsGogRelatedProcessName(processName)) continue;

                string title = GetWindowTitle(candidateHwnd);
                string className = GetWindowClassNameSafe(candidateHwnd);
                if (!IsGogMainWindowCandidate(candidateHwnd, processName, title, className, allowIconic: _storeLauncherWindowSeen))
                    continue;

                int score = 0;
                if (string.Equals(processName, "GalaxyClient", StringComparison.OrdinalIgnoreCase)) score += 80;
                if (!string.IsNullOrWhiteSpace(title)) score += 20;
                if (title.Contains("GOG GALAXY", StringComparison.OrdinalIgnoreCase)) score += 90;
                if (string.Equals(className, "Chrome_WidgetWin_0", StringComparison.OrdinalIgnoreCase)) score += 25;
                if (!IsIconic(candidateHwnd)) score += 10;

                if (score > bestScore)
                {
                    bestScore = score;
                    bestProcess = candidateProcess;
                    bestHwnd = candidateHwnd;
                }
            }

            if (bestProcess == null || bestHwnd == IntPtr.Zero || bestScore < 100)
                return false;

            process = FindRunningProcessForExe(exePath) ?? bestProcess;
            hwnd = bestHwnd;
            return true;
        }

        private bool TryFindGogInteractiveWindow(out Process process, out IntPtr hwnd)
        {
            process = null!;
            hwnd = IntPtr.Zero;
            Process? bestProcess = null;
            IntPtr bestHwnd = IntPtr.Zero;
            int bestScore = 0;

            foreach (var candidateHwnd in EnumerateTopLevelWindows())
            {
                if (!IsWindowVisible(candidateHwnd) || IsIconic(candidateHwnd))
                    continue;

                GetWindowThreadProcessId(candidateHwnd, out uint pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId) continue;

                Process candidateProcess;
                try { candidateProcess = Process.GetProcessById((int)pidRaw); }
                catch { continue; }

                string processName = SafeProcessName(candidateProcess);
                if (!IsGogRelatedProcessName(processName)) continue;

                string title = GetWindowTitle(candidateHwnd).Trim();
                string className = GetWindowClassNameSafe(candidateHwnd);
                bool mainWindow = IsGogMainWindowCandidate(candidateHwnd, processName, title, className, allowIconic: false);
                int score = 0;

                if (string.Equals(processName, "GalaxyClient", StringComparison.OrdinalIgnoreCase)) score += 50;
                else score += 25;
                if (!string.IsNullOrWhiteSpace(title)) score += 20;
                if (title.Contains("GOG", StringComparison.OrdinalIgnoreCase)) score += 25;
                if (title.Contains("log in", StringComparison.OrdinalIgnoreCase) ||
                    title.Contains("login", StringComparison.OrdinalIgnoreCase) ||
                    title.Contains("sign in", StringComparison.OrdinalIgnoreCase) ||
                    title.Contains("entrar", StringComparison.OrdinalIgnoreCase))
                {
                    score += 40;
                }
                if (mainWindow) score += 20;
                if (string.Equals(className, "Chrome_WidgetWin_0", StringComparison.OrdinalIgnoreCase)) score += 10;

                if (score > bestScore)
                {
                    bestScore = score;
                    bestProcess = candidateProcess;
                    bestHwnd = candidateHwnd;
                }
            }

            if (bestProcess == null || bestHwnd == IntPtr.Zero || bestScore < 35)
                return false;

            process = bestProcess;
            hwnd = bestHwnd;
            return true;
        }

        private static bool IsSteamMainWindowCandidate(IntPtr hwnd, string title, string className, bool allowIconic)
        {
            if (hwnd == IntPtr.Zero)
                return false;

            if (!IsWindowVisible(hwnd) && !IsIconic(hwnd))
                return false;

            if (IsIconic(hwnd) && !allowIconic)
                return false;

            if (string.Equals(className, "BootstrapUpdateUIClass", StringComparison.OrdinalIgnoreCase))
                return false;

            string normalizedTitle = title?.Trim() ?? "";
            if (normalizedTitle.Contains("update", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("updating", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("atualiza", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("iniciar a sessão", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("iniciando sessão", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("sessão no steam", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("sign in", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("signing in", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("login", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            return true;
        }

        private static bool IsBattleNetProcessName(string processName)
        {
            if (string.IsNullOrWhiteSpace(processName)) return false;

            return string.Equals(processName, "Battle.net", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(processName, "Battle.net Launcher", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(processName, "Battle.net Helper", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(processName, "Battle.net Update Agent", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(processName, "Agent", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsBattleNetMainWindowCandidate(IntPtr hwnd, string processName, string title, string className, bool allowIconic)
        {
            if (hwnd == IntPtr.Zero)
                return false;

            if (!IsWindowVisible(hwnd) && !IsIconic(hwnd))
                return false;

            if (IsIconic(hwnd) && !allowIconic)
                return false;

            if (string.Equals(processName, "Agent", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(processName, "Battle.net Update Agent", StringComparison.OrdinalIgnoreCase))
                return false;

            string normalizedTitle = title?.Trim() ?? "";
            if (normalizedTitle.Contains("update", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("updating", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("atualiza", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("instalando", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("installing", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("bootstrap", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (className.Contains("Update", StringComparison.OrdinalIgnoreCase) ||
                className.Contains("Bootstrap", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            return true;
        }

        private static bool IsGogMainWindowCandidate(IntPtr hwnd, string processName, string title, string className, bool allowIconic)
        {
            if (hwnd == IntPtr.Zero)
                return false;

            if (!IsWindowVisible(hwnd) && !IsIconic(hwnd))
                return false;

            if (IsIconic(hwnd) && !allowIconic)
                return false;

            if (!string.Equals(processName, "GalaxyClient", StringComparison.OrdinalIgnoreCase))
                return false;

            if (!string.Equals(className, "Chrome_WidgetWin_0", StringComparison.OrdinalIgnoreCase))
                return false;

            string normalizedTitle = title?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(normalizedTitle))
                return false;

            if (normalizedTitle.Contains("log in", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("login", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("sign in", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("entrar", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("update", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("updating", StringComparison.OrdinalIgnoreCase) ||
                normalizedTitle.Contains("atualiza", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            return normalizedTitle.Contains("GOG GALAXY", StringComparison.OrdinalIgnoreCase);
        }

        private bool IsForegroundOwnedBySteamInteractiveWindow()
        {
            if (!IsSteamStoreWindowLookup(_activeStoreId ?? "", _storeLauncherExe ?? ""))
                return false;

            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero || foreground == GetShellWindow())
                    return false;

                if (_mainWindowHandle != IntPtr.Zero &&
                    (foreground == _mainWindowHandle || IsChild(_mainWindowHandle, foreground)))
                {
                    return false;
                }

                if (!IsWindowVisible(foreground) || IsIconic(foreground))
                    return false;

                GetWindowThreadProcessId(foreground, out var pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId)
                    return false;

                using var process = Process.GetProcessById((int)pidRaw);
                string processName = SafeProcessName(process);
                return string.Equals(processName, "steam", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(processName, "steamwebhelper", StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        private bool IsForegroundOwnedByBattleNetInteractiveWindow()
        {
            if (!IsBattleNetStoreWindowLookup(_activeStoreId ?? "", _storeLauncherExe ?? ""))
                return false;

            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero || foreground == GetShellWindow())
                    return false;

                if (_mainWindowHandle != IntPtr.Zero &&
                    (foreground == _mainWindowHandle || IsChild(_mainWindowHandle, foreground)))
                {
                    return false;
                }

                if (!IsWindowVisible(foreground) || IsIconic(foreground))
                    return false;

                GetWindowThreadProcessId(foreground, out var pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId)
                    return false;

                using var process = Process.GetProcessById((int)pidRaw);
                return IsBattleNetProcessName(SafeProcessName(process));
            }
            catch { return false; }
        }

        private bool IsForegroundOwnedByGogInteractiveWindow()
        {
            if (!IsGogStoreWindowLookup(_activeStoreId ?? "", _storeLauncherExe ?? ""))
                return false;

            try
            {
                var foreground = GetForegroundWindow();
                if (foreground == IntPtr.Zero || foreground == GetShellWindow())
                    return false;

                if (_mainWindowHandle != IntPtr.Zero &&
                    (foreground == _mainWindowHandle || IsChild(_mainWindowHandle, foreground)))
                {
                    return false;
                }

                if (!IsWindowVisible(foreground) || IsIconic(foreground))
                    return false;

                GetWindowThreadProcessId(foreground, out var pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId)
                    return false;

                using var process = Process.GetProcessById((int)pidRaw);
                return IsGogRelatedProcessName(SafeProcessName(process));
            }
            catch { return false; }
        }

        private static string GetWindowClassNameSafe(IntPtr hwnd)
        {
            try
            {
                var buffer = new StringBuilder(256);
                int len = GetClassName(hwnd, buffer, buffer.Capacity);
                return len > 0 ? buffer.ToString() : "";
            }
            catch { return ""; }
        }

        private void EnterStoreExeMode(Process proc, string appName, string heroImg, string gridImg, bool showLaunchOverlay = true)
        {
            string url = _storeLauncherExe ?? appName;
            var store = LoadStoreLaunchers().FirstOrDefault(s =>
                string.Equals(s.Id, _activeStoreId, StringComparison.OrdinalIgnoreCase));
            if (!_storeMouseModeInitialized)
            {
                _storeMouseModeRequested = ShouldStartMouseMode(store);
                _storeMouseModeInitialized = true;
            }
            bool startMouseMode = _storeMouseModeRequested;

            _storeLauncherWatcherCts?.Cancel();
            _storeLauncherWatcherCts = new CancellationTokenSource();
            _storeLauncherProcess = proc;
            InitializeStoreLauncherProcessGroup(proc);
            if (!string.IsNullOrWhiteSpace(_storeLauncherExe))
            {
                try
                {
                    _storeLauncherWindowSeen = _storeLauncherWindowSeen ||
                        TryFindStoreWindow(_activeStoreId ?? "", _storeLauncherExe, out _, out _);
                }
                catch { }
            }
            _storePausedByDoorpi = false;
            _storeMouseModeRequested = startMouseMode;
            _storeGamepadDisabled = !startMouseMode;
            _storeControllerActive = startMouseMode;
            int sessionId = Interlocked.Increment(ref _storeSessionId);
            var watcherCts = _storeLauncherWatcherCts;
            var watcherToken = watcherCts?.Token ?? CancellationToken.None;

            if (showLaunchOverlay)
                SendGameLaunchStatus("gameLaunching", appName, heroImg, gridImg, "store");
            else
                SendGameLaunchStatus("gameLaunchDone");
            _ = Task.Run(async () =>
            {
                await TryMaximizeExternalWindowAsync(
                    proc,
                    url,
                    watcherToken,
                    requireControllerActive: false).ConfigureAwait(false);
                if (!watcherToken.IsCancellationRequested && showLaunchOverlay)
                    SendGameLaunchStatus("gameLaunchDone");
            });

            StartStoreLauncherWatcher(proc, appName, sessionId, watcherToken);
            EnsureStoreShortcutThread(sessionId);

            if (startMouseMode)
            {
                Dispatcher.Invoke(() =>
                {
                    while (ShowCursor(true) < 0) { }
                    _mainScreenMouseVisible = true;
                    CenterCursorOnScreen();
                    UpdateHoverStateInWebView();
                });
                _storeControllerThread = new Thread(() => StoreExeControllerLoop(sessionId)) { IsBackground = true };
                _storeControllerThread.Start();
            }
            SendRuntimeSessionsToUI();
        }

        private void StartStoreLauncherWatcher(Process proc, string appName, int sessionId, CancellationToken token)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    int missingWindowCount = 0;

                    while (!token.IsCancellationRequested &&
                           _isStoreLauncherSession &&
                           _storeSessionId == sessionId)
                    {
                        if (_gameSessionActive &&
                            string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase))
                        {
                            await Task.Delay(250, token).ConfigureAwait(false);
                            continue;
                        }

                        if (_storePausedByDoorpi || IsStoreChildGameBlockingStoreControls())
                        {
                            await Task.Delay(250, token).ConfigureAwait(false);
                            continue;
                        }

                        bool processAlive = IsActiveStoreLauncherProcessAlive();
                        if (!processAlive)
                        {
                            Dispatcher.Invoke(CloseStoreSessionCompletely);
                            return;
                        }

                        bool hasVisibleWindow = false;
                        try
                        {
                            if (!string.IsNullOrWhiteSpace(_storeLauncherExe) &&
                                TryFindStoreWindow(_activeStoreId ?? "", _storeLauncherExe, out var visibleProc, out _))
                            {
                                _storeLauncherProcess = visibleProc;
                                hasVisibleWindow = true;
                                _storeLauncherWindowSeen = true;
                                missingWindowCount = 0;
                            }
                        }
                        catch { }

                        if (!hasVisibleWindow)
                        {
                            bool waitingForLauncherMainWindow =
                                IsStoreMainWindowLookupAwaited(_activeStoreId ?? "", _storeLauncherExe ?? "") &&
                                !_storeLauncherWindowSeen;

                            if (_storeLauncherWindowSeen)
                            {
                                missingWindowCount++;
                                if (missingWindowCount >= 2)
                                {
                                    Dispatcher.Invoke(FinalizeStoreTraySession);
                                    if (!_isStoreLauncherSession || _storeSessionId != sessionId)
                                        return;
                                    missingWindowCount = 0;
                                }
                            }
                            else
                            {
                                missingWindowCount = 0;
                            }

                            if (waitingForLauncherMainWindow)
                            {
                                await Task.Delay(300, token).ConfigureAwait(false);
                                continue;
                            }

                            if (!IsForegroundDoorpi())
                            {
                                await Task.Delay(300, token).ConfigureAwait(false);
                                continue;
                            }

                            Dispatcher.Invoke(() =>
                            {
                                if (!_isStoreLauncherSession ||
                                    _storePausedByDoorpi ||
                                    IsStoreChildGameBlockingStoreControls() ||
                                    !IsActiveStoreLauncherProcessAlive())
                                {
                                    return;
                                }

                                if (_storeLauncherWindowSeen && !HasActiveStoreLauncherWindow())
                                    FinalizeStoreTraySession();
                                else
                                    ShowExecutionLockForStore();
                            });
                        }
                        else if (hasVisibleWindow)
                        {
                            missingWindowCount = 0;
                        }

                        if (!IsForegroundDoorpi() &&
                            (_executionLockActive ||
                             _storeShortcutThread?.IsAlive != true ||
                             (!_storeGamepadDisabled &&
                              (_storeControllerThread?.IsAlive != true || !_storeControllerActive))))
                        {
                            Dispatcher.Invoke(ReactivateStoreControlsForForeground);
                        }

                        await Task.Delay(300, token).ConfigureAwait(false);
                    }
                }
                catch (OperationCanceledException) { }
                catch (Exception ex) { Debug.WriteLine("[Store] Watcher launcher: " + ex.Message); }
            });
        }

        private void MinimizeStoreSessionAndShowMenu()
        {
            if (!_isStoreLauncherSession) return;
            _storePausedByDoorpi = true;
            _storeControllerActive = false;

           
            _mainUiGamepadSuspendedForGame = false;
            Interlocked.Exchange(ref _mainUiGamepadSuppressUntilUtcTicks, 0);

            SuspendExecutionLockWatch();

            if (_storeSessionKind == "web")
            {
                try
                {
                    if (_webAppWindow != null)
                        _webAppWindow.WindowState = System.Windows.WindowState.Minimized;
                }
                catch { }
            }
            else if (_storeLauncherProcess != null && !SafeHasExited(_storeLauncherProcess))
            {
                MinimizeProcessWindows(_storeLauncherProcess);
            }
            else if (!string.IsNullOrEmpty(_storeLauncherExe))
            {
                foreach (var p in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(_storeLauncherExe)))
                {
                    try { MinimizeProcessWindows(p); } catch { }
                }
            }

            SendGameLaunchStatus("gameLaunchDone");

            Dispatcher.Invoke(() =>
            {
                _desktopVkb?.Close();
                _desktopVkb = null;
                FocusDoorpiKeepSession();
                webView?.CoreWebView2?.PostWebMessageAsString("{\"type\":\"hideStoreSessionMenu\"}");
            });
            SendRuntimeSessionsToUI();
        }

        private static void MinimizeProcessWindows(Process proc)
        {
            try
            {
                EnumWindows((hWnd, _) =>
                {
                    GetWindowThreadProcessId(hWnd, out uint pid);
                    if (pid != (uint)proc.Id || !IsWindowVisible(hWnd)) return true;
                    if (GetWindowTextLength(hWnd) <= 0) return true;
                    ShowWindow(hWnd, 6);
                    return true;
                }, IntPtr.Zero);
            }
            catch { }
        }

        private void ResumeStoreSession()
        {
            ResumeExecutionLockWatch();

            if (!_isStoreLauncherSession) return;
            if (_gameSessionActive &&
                string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
            if (_storeChildGameActive && _gameSessionActive && !_gameIsMinimized) return;

            _storePausedByDoorpi = false;
            ClearExecutionLock();

            Dispatcher.Invoke(() =>
                webView?.CoreWebView2?.PostWebMessageAsString("{\"type\":\"hideStoreSessionMenu\"}"));
            SendRuntimeSessionsToUI();

            if (_storeSessionKind == "web")
            {
                Dispatcher.Invoke(() =>
                {
                    if (_webAppWindow != null)
                    {
                        _webAppWindow.WindowState = System.Windows.WindowState.Maximized;
                        _webAppWindow.Activate();
                        _ytWebView?.Focus();
                    }
                    StartMediaControllerMode();
                });
                return;
            }

            Process? proc = _storeLauncherProcess;
            if (proc == null || SafeHasExited(proc))
            {
                if (!string.IsNullOrEmpty(_storeLauncherExe))
                    proc = FindRunningProcessForExe(_storeLauncherExe);
            }

            if (!string.IsNullOrWhiteSpace(_storeLauncherExe) &&
                TryFindStoreWindow(_activeStoreId ?? "", _storeLauncherExe, out var storeWindowProc, out var storeWindowHwnd))
            {
                RestoreStoreWindow(storeWindowProc, storeWindowHwnd);
                return;
            }

            if (proc != null && !SafeHasExited(proc))
            {
                IntPtr hwnd = FindVisibleWindowForProcess(proc.Id);
                if (hwnd == IntPtr.Zero)
                {
                    foreach (var p in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(_storeLauncherExe ?? "")))
                    {
                        hwnd = FindVisibleWindowForProcess(p.Id);
                        if (hwnd != IntPtr.Zero) { proc = p; break; }
                    }
                }

                if (hwnd == IntPtr.Zero &&
                    string.Equals(_activeStoreId, "Xbox", StringComparison.OrdinalIgnoreCase) &&
                    !string.IsNullOrWhiteSpace(_storeLauncherExe))
                {
                    RequestXboxMainWindow();
                    for (int i = 0; i < 20; i++)
                    {
                        if (TryFindStoreWindow(_activeStoreId ?? "", _storeLauncherExe, out var xboxProc, out var xboxHwnd))
                        {
                            proc = xboxProc;
                            hwnd = xboxHwnd;
                            break;
                        }
                        Thread.Sleep(120);
                    }
                }

                if (hwnd != IntPtr.Zero)
                {
                    RestoreStoreWindow(proc, hwnd);
                    return;
                }

                if (IsActiveStoreLauncherProcessAlive())
                {
                    if (string.Equals(_activeStoreId, "Steam", StringComparison.OrdinalIgnoreCase))
                    {
                        _ = ResumeSteamStoreWindowAsync();
                        return;
                    }

                    SendRuntimeSessionsToUI();
                    if (IsForegroundDoorpi())
                        ShowExecutionLockForStore();
                    return;
                }
            }

            CloseStoreSessionCompletely();
        }

        private void RestoreStoreWindow(Process proc, IntPtr hwnd)
        {
            _storeLauncherProcess = proc;
            if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
            ShowWindow(hwnd, 3);
            FocusExternalWindow(hwnd);

            var card = LoadStoreLaunchers().FirstOrDefault(s => s.Id == _activeStoreId);
            EnterStoreExeMode(proc, card?.Name ?? "Loja", card?.HeroImage ?? "", card?.GridImage ?? "", showLaunchOverlay: false);
            ReactivateStoreControlsForForeground();
            ApplyGogRestoreInputFixIfNeeded(hwnd);
        }

        private static bool IsGogStoreId(string? storeId)
            => string.Equals(storeId, "GOG", StringComparison.OrdinalIgnoreCase);

        private void LogGogLauncherDiagnostics(string exePath)
        {
            try
            {
                var processNames = SnapshotProcessNamesById();

                EnumWindows((candidateHwnd, _) =>
                {
                    try
                    {
                        if (candidateHwnd == IntPtr.Zero ||
                            candidateHwnd == _mainWindowHandle ||
                            candidateHwnd == GetShellWindow())
                        {
                            return true;
                        }

                        GetWindowThreadProcessId(candidateHwnd, out uint pidRaw);
                        if (pidRaw == 0 || pidRaw == Environment.ProcessId)
                            return true;

                        if (!processNames.TryGetValue((int)pidRaw, out var exeName) ||
                            !IsGogRelatedProcessName(exeName))
                            return true;

                        string processName = Path.GetFileNameWithoutExtension(exeName);
                        string title = GetWindowTitle(candidateHwnd);
                        string className = GetWindowClassNameSafe(candidateHwnd);
                        bool visible = IsWindowVisible(candidateHwnd);
                        bool iconic = IsIconic(candidateHwnd);
                        bool hasRect = GetWindowRect(candidateHwnd, out var rect);
                        int width = hasRect ? rect.Width : 0;
                        int height = hasRect ? rect.Height : 0;
                        bool hasTitle = !string.IsNullOrWhiteSpace(title);
                        string relation = GetGogProcessRelation(exeName, exePath);

                        bool mainProcess = string.Equals(processName, "GalaxyClient", StringComparison.OrdinalIgnoreCase);
                        bool accepted = IsGogMainWindowCandidate(candidateHwnd, processName, title, className, allowIconic: false);
                        string reason =
                            accepted ? "accepted" :
                            !visible && !iconic ? "hidden" :
                            !mainProcess ? "related-process" :
                            !hasTitle ? "no-title" :
                            !string.Equals(className, "Chrome_WidgetWin_0", StringComparison.OrdinalIgnoreCase) ? "non-main-class" :
                            title.Contains("log in", StringComparison.OrdinalIgnoreCase) ||
                            title.Contains("login", StringComparison.OrdinalIgnoreCase) ||
                            title.Contains("sign in", StringComparison.OrdinalIgnoreCase) ? "login-window" :
                            !title.Contains("GOG GALAXY", StringComparison.OrdinalIgnoreCase) ? "non-main-title" :
                            width < 320 || height < 220 ? "small-window" :
                            "rejected";

                        string rectText = hasRect
                            ? $"{rect.Left},{rect.Top},{rect.Right},{rect.Bottom}"
                            : "unknown";
                        string sizeText = hasRect ? $"{width}x{height}" : "unknown";
                        string hwndText = $"0x{candidateHwnd.ToInt64():X}";
                        string key = $"win|{hwndText}|{pidRaw}|{processName}|{className}|{title}|{visible}|{iconic}|{rectText}|{accepted}|{reason}";

                        if (_gogDiagnosticLogSeen.Add(key))
                        {
                            WriteGogWindowLog(
                                $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] gog accepted={accepted} reason={reason} hwnd={hwndText} pid={pidRaw} process=\"{LogValue(processName)}\" relation=\"{LogValue(relation)}\" class=\"{LogValue(className)}\" title=\"{LogValue(title)}\" visible={visible} iconic={iconic} rect={rectText} size={sizeText}");
                        }
                    }
                    catch { }

                    return true;
                }, IntPtr.Zero);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[GOG] Diagnóstico: " + ex.Message);
            }
        }

        private Dictionary<int, string> SnapshotProcessNamesById()
        {
            var result = new Dictionary<int, string>();
            IntPtr snapshot = IntPtr.Zero;

            try
            {
                snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
                if (snapshot == IntPtr.Zero || snapshot == INVALID_HANDLE_VALUE)
                    return result;

                var entry = new PROCESSENTRY32 { dwSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf<PROCESSENTRY32>() };
                if (!Process32FirstW(snapshot, ref entry))
                    return result;

                do
                {
                    if (entry.th32ProcessID <= int.MaxValue &&
                        !string.IsNullOrWhiteSpace(entry.szExeFile))
                    {
                        result[(int)entry.th32ProcessID] = entry.szExeFile;
                    }
                }
                while (Process32NextW(snapshot, ref entry));
            }
            catch { }
            finally
            {
                if (snapshot != IntPtr.Zero && snapshot != INVALID_HANDLE_VALUE)
                {
                    try { CloseHandle(snapshot); } catch { }
                }
            }

            return result;
        }

        private static bool IsGogRelatedProcessName(string exeName)
        {
            var name = Path.GetFileNameWithoutExtension(exeName);
            return name.Contains("galaxy", StringComparison.OrdinalIgnoreCase) ||
                   name.Contains("gog", StringComparison.OrdinalIgnoreCase);
        }

        private static string GetGogProcessRelation(string exeName, string exePath)
        {
            string launcherExe = "";
            try { launcherExe = Path.GetFileName(exePath); } catch { }

            if (!string.IsNullOrWhiteSpace(launcherExe) &&
                string.Equals(exeName, launcherExe, StringComparison.OrdinalIgnoreCase))
                return "launcher-exe-name";

            return "process-name";
        }

        private void ResetGogWindowLog()
        {
            try
            {
                File.WriteAllText(GetGogWindowLogPath(), "", Encoding.UTF8);
            }
            catch { }
        }

        private string GetGogWindowLogPath()
        {
            var dir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "logs");
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "gog-windows.log");
        }

        private void WriteGogWindowLog(string line)
        {
            try
            {
                Debug.WriteLine("[GogWindow] " + line);
                File.AppendAllText(GetGogWindowLogPath(), line + Environment.NewLine, Encoding.UTF8);
            }
            catch { }
        }

        private static string LogValue(string? value)
            => (value ?? "").Replace("\"", "'");

        private void ApplyGogRestoreInputFixIfNeeded(IntPtr hwnd)
        {
            if (!IsGogStoreId(_activeStoreId) || hwnd == IntPtr.Zero)
                return;

            bool sendBackInput = _gogBackInputPendingOnStoreResume;
            _gogBackInputPendingOnStoreResume = false;

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(260).ConfigureAwait(false);

                    if (!_isStoreLauncherSession ||
                        !IsGogStoreId(_activeStoreId) ||
                        !IsWindow(hwnd))
                    {
                        return;
                    }

                    Dispatcher.Invoke(() =>
                    {
                        if (GetWindowRect(hwnd, out var rect) && rect.Width > 0 && rect.Height > 0)
                        {
                            int clickX = Math.Min(rect.Right - 24, rect.Left + 36);
                            int clickY = Math.Max(rect.Top + 24, rect.Bottom - 96);
                            SetCursorPos(clickX, clickY);
                            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                        }
                    });

                    if (!sendBackInput)
                        return;

                    await Task.Delay(420).ConfigureAwait(false);

                    if (!_isStoreLauncherSession ||
                        !IsGogStoreId(_activeStoreId) ||
                        !IsWindow(hwnd))
                    {
                        return;
                    }

                    mouse_event(MOUSEEVENTF_XDOWN, 0, 0, XBUTTON1, UIntPtr.Zero);
                    mouse_event(MOUSEEVENTF_XUP, 0, 0, XBUTTON1, UIntPtr.Zero);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[GOG] Ajuste de restore: " + ex.Message);
                }
            });
        }

        private async Task ResumeSteamStoreWindowAsync()
        {
            try
            {
                RequestSteamMainWindow();

                for (int i = 0; i < 20; i++)
                {
                    await Task.Delay(100).ConfigureAwait(false);
                    if (!_isStoreLauncherSession ||
                        !string.Equals(_activeStoreId, "Steam", StringComparison.OrdinalIgnoreCase) ||
                        string.IsNullOrWhiteSpace(_storeLauncherExe))
                    {
                        return;
                    }

                    if (TryFindSteamWindow(out var steamProc, out var steamHwnd))
                    {
                        Dispatcher.Invoke(() =>
                        {
                            if (!_isStoreLauncherSession ||
                                !string.Equals(_activeStoreId, "Steam", StringComparison.OrdinalIgnoreCase))
                            {
                                return;
                            }

                            RestoreStoreWindow(steamProc, steamHwnd);
                            SendRuntimeSessionsToUI();
                        });
                        return;
                    }
                }

                Dispatcher.Invoke(() =>
                {
                    SendRuntimeSessionsToUI();
                    if (IsForegroundDoorpi())
                        ShowExecutionLockForStore();
                });
            }
            catch (Exception ex) { Debug.WriteLine("[Store] Retomar Steam: " + ex.Message); }
        }

        private static void RequestSteamMainWindow()
        {
            try
            {
                Process.Start(new ProcessStartInfo("steam://open/main")
                {
                    UseShellExecute = true
                });
            }
            catch { }
        }

        private static void RequestXboxMainWindow()
        {
            try
            {
                Process.Start(new ProcessStartInfo("msxbox://")
                {
                    UseShellExecute = true
                });
            }
            catch { }
        }

        private void ReactivateStoreControlsForForeground()
        {
            if (!_isStoreLauncherSession || _storePausedByDoorpi || IsStoreChildGameBlockingStoreControls())
                return;
            if (_gameSessionActive &&
                string.Equals(_gameSessionParentKind, "doorpi", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var store = LoadStoreLaunchers().FirstOrDefault(s =>
                string.Equals(s.Id, _activeStoreId, StringComparison.OrdinalIgnoreCase));
            if (!_storeMouseModeInitialized)
            {
                _storeMouseModeRequested = ShouldStartMouseMode(store);
                _storeMouseModeInitialized = true;
            }

            _storeGamepadDisabled = !_storeMouseModeRequested;
            _storeControllerActive = _storeMouseModeRequested;
            EnsureStoreShortcutThread(_storeSessionId);

            if (_storeMouseModeRequested)
            {
                EnsureCursorVisible();
                _mainScreenMouseVisible = true;
            }

            int sessionId = _storeSessionId;
            if (_storeMouseModeRequested && _storeControllerThread?.IsAlive != true)
            {
                _storeControllerThread = new Thread(() => StoreExeControllerLoop(sessionId)) { IsBackground = true };
                _storeControllerThread.Start();
            }

            SendRuntimeSessionsToUI();
        }

        public void CloseStoreSessionCompletely()
        {
            if (!_isStoreLauncherSession) return;

            var snapshot = _libraryKeysBeforeStore;
            var storeSnapshot = _storeKeysBeforeStore;
            string? storeId = _activeStoreId;
            string? exe = _storeLauncherExe;
            bool wasWeb = _storeSessionKind == "web";
            bool hadStoreChildGame = _storeChildGameActive;
            var capturedStoreProcessIds = (!wasWeb && !hadStoreChildGame)
                ? GetStoreLauncherProcessIdsForClose()
                : new HashSet<int>();
            StopStoreLibraryMonitor();
            StopStoreChildGameDetector();
            try { _storeLauncherWatcherCts?.Cancel(); } catch { }
            _storeLauncherWatcherCts?.Dispose();
            _storeLauncherWatcherCts = null;
            _storeChildGameActive = false;
            _storeChildGameStoreId = "";
            _storeChildGameId = "";
            _storeControllerActive = false;
            _storeGamepadDisabled = false;
            _storeMouseModeRequested = false;
            _storeMouseModeInitialized = false;
            _storeLauncherWindowSeen = false;
            _storeLauncherProcess = null;
            _storeSessionId++;
            ClearExecutionLock();

            _isStoreLauncherSession = false;
            _storePausedByDoorpi = false;
            _storeLauncherExe = null;
            _storeSessionKind = "";
            _activeStoreId = null;
            _libraryKeysBeforeStore = new(StringComparer.OrdinalIgnoreCase);
            _storeKeysBeforeStore = new(StringComparer.OrdinalIgnoreCase);
            _storeProcessSnapshot = new();
            _storeProcessGroupIds = new();
            _storeProcessGroupRootDirectory = "";
            _storeProcessGroupExeName = "";
            _storeWindowSnapshot = new();

            if (wasWeb)
                Dispatcher.Invoke(() => CloseYouTubeInline(skipStoreCompletion: true));
            else
            {
                if (!string.IsNullOrEmpty(exe))
                    _ = Task.Run(() => KillLauncherProcessTree(exe, capturedStoreProcessIds));

                Dispatcher.Invoke(() =>
                {
                    _desktopVkb?.Close();
                    _desktopVkb = null;
                    webView?.CoreWebView2?.PostWebMessageAsString("{\"type\":\"hideStoreSessionMenu\"}");
                    FocusDoorpiKeepSession();
                });
            }

            SendRuntimeSessionsToUI();
            ValidateStoreChildGameAfterStoreClosed(hadStoreChildGame);
            ScheduleStoreLibraryRevalidation(snapshot, storeId, storeSnapshot);
        }

        private void FinalizeStoreSessionFromWebClose()
        {
            var snapshot = _libraryKeysBeforeStore;
            var storeSnapshot = _storeKeysBeforeStore;
            string? storeId = _activeStoreId;
            bool hadStoreChildGame = _storeChildGameActive;
            StopStoreLibraryMonitor();
            StopStoreChildGameDetector();
            try { _storeLauncherWatcherCts?.Cancel(); } catch { }
            _storeLauncherWatcherCts?.Dispose();
            _storeLauncherWatcherCts = null;
            _storeChildGameActive = false;
            _storeChildGameStoreId = "";
            _storeChildGameId = "";
            _storeControllerActive = false;
            _storeMouseModeRequested = false;
            _storeMouseModeInitialized = false;
            _storeLauncherWindowSeen = false;
            _storeTrayCloseInProgress = false;
            _storeLauncherProcess = null;
            _storeSessionId++;
            _isStoreLauncherSession = false;
            _storePausedByDoorpi = false;
            _storeLauncherExe = null;
            _storeSessionKind = "";
            _activeStoreId = null;
            _libraryKeysBeforeStore = new(StringComparer.OrdinalIgnoreCase);
            _storeKeysBeforeStore = new(StringComparer.OrdinalIgnoreCase);
            _storeProcessSnapshot = new();
            _storeProcessGroupIds = new();
            _storeProcessGroupRootDirectory = "";
            _storeProcessGroupExeName = "";
            _storeWindowSnapshot = new();

            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideStoreSessionMenu\"}"));

            SendRuntimeSessionsToUI();
            ValidateStoreChildGameAfterStoreClosed(hadStoreChildGame);
            ScheduleStoreLibraryRevalidation(snapshot, storeId, storeSnapshot);
        }

        private void ValidateStoreChildGameAfterStoreClosed(bool hadStoreChildGame)
        {
            if (!hadStoreChildGame) return;

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(1200).ConfigureAwait(false);

                    Dispatcher.Invoke(() =>
                    {
                        if (!_gameSessionActive || string.IsNullOrWhiteSpace(_activeSessionGameId))
                            return;

                        bool gameProcessAlive = IsLockedGameProcessAlive() || IsPendingLaunchProcessAlive();
                        if (gameProcessAlive)
                            return;

                        CommitActiveSession();
                        ClearGameWindowSession();
                        ClearExecutionLock();
                        SendGameLaunchStatus("gameLaunchDone");
                        SendRuntimeSessionsToUI();
                    });
                }
                catch { }
            });
        }

        private void ScheduleStoreLibraryRevalidation(HashSet<string> snapshot, string? storeId, HashSet<string> storeSnapshot)
        {
            _ = Task.Run(async () =>
            {
                try { await HandleStoreSessionClosedAsync(snapshot, storeId, storeSnapshot).ConfigureAwait(false); }
                catch (Exception ex) { Debug.WriteLine("[Store] Revalidação: " + ex.Message); }
            });
        }

        private static void KillLauncherProcessTree(string? launcherExe, IEnumerable<int>? capturedProcessIds = null)
        {
            var killed = new HashSet<int>();

            void Kill(Process? proc)
            {
                if (proc == null) return;
                try
                {
                    if (proc.HasExited) return;
                    int pid = proc.Id;
                    if (!killed.Add(pid)) return;
                    proc.Kill(true);
                    proc.WaitForExit(2000);
                }
                catch
                {
                    try
                    {
                        if (!proc.HasExited)
                        {
                            proc.Kill();
                            proc.WaitForExit(1000);
                        }
                    }
                    catch { }
                }
            }

            if (capturedProcessIds != null)
            {
                foreach (int pid in capturedProcessIds)
                {
                    try { Kill(Process.GetProcessById(pid)); }
                    catch { }
                }
            }

            if (string.IsNullOrWhiteSpace(launcherExe)) return;

            string procName;
            try { procName = Path.GetFileNameWithoutExtension(launcherExe); }
            catch { return; }

            if (string.IsNullOrEmpty(procName)) return;

            Process[] processes;
            try { processes = Process.GetProcessesByName(procName); }
            catch { return; }

            foreach (var proc in processes)
            {
                bool matchesPath = false;
                try
                {
                    string processPath = SafeProcessPath(proc);
                    matchesPath = !string.IsNullOrWhiteSpace(processPath) && PathsEqual(processPath, launcherExe);
                }
                catch { }

                if (matchesPath)
                    Kill(proc);
            }

            foreach (var proc in processes)
                Kill(proc);
        }

        private async Task HandleStoreSessionClosedAsync(HashSet<string> librarySnapshot, string? storeId, HashSet<string> storeSnapshot)
        {
            StoreRefreshResult result;
            if (!string.IsNullOrWhiteSpace(storeId))
            {
                result = await RefreshStoreAppsAndFindChangesAsync(
                    storeId,
                    storeSnapshot,
                    CancellationToken.None).ConfigureAwait(false);
            }
            else
            {
                await UpdateAppCacheAsync().ConfigureAwait(false);
                var cache = LoadAppCache() ?? new AppCacheModel();
                result = new StoreRefreshResult
                {
                    NewApps = FindNewAppsComparedToSnapshot(cache, librarySnapshot)
                };
            }

            var settings = GetStoreAutoAddSettings();
            var newApps = result.NewApps;
            var toAutoAdd = newApps.Where(a => IsStoreAutoAddEnabled(settings, a.Source)).ToList();

            if (toAutoAdd.Count > 0) ShowPreparingGameSkeletons(toAutoAdd.Count);
            bool autoAdded = toAutoAdd.Count > 0 && await UpsertAutoAddedPlatformGamesAsync(toAutoAdd).ConfigureAwait(false);
            if (toAutoAdd.Count > 0) StartStoreArtworkRefresh();

            var payload = new
            {
                type = "libraryRevalidated",
                hasNewGames = newApps.Count > 0,
                hasRemovedGames = result.RemovedGames.Count > 0,
                games = newApps.Select(a => new
                {
                    a.Name,
                    a.LaunchUrl,
                    a.Path,
                    a.Source,
                    a.IconBase64,
                    autoAdded = IsStoreAutoAddEnabled(settings, a.Source)
                }).ToList()
            };

            Dispatcher.Invoke(() =>
            {
                if (result.RemovedGames.Count > 0) LoadGamesIntoUI();
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(payload));
                if (newApps.Count > 0)
                {
                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "newGamesDetected",
                        games = payload.games
                    }));
                }
                if (result.RemovedGames.Count > 0)
                {
                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "gamesRemoved",
                        games = result.RemovedGames.Select(g => new
                        {
                            g.Name,
                            g.LaunchUrl,
                            g.Path
                        }).ToList()
                    }));
                }
            });
            SendInstalledAppsToUI();
        }

        private List<MediaAppModel> LoadStoreLaunchers()
        {
            if (string.IsNullOrEmpty(storesFile) || !File.Exists(storesFile)) return new List<MediaAppModel>();
            try
            {
                return JsonSerializer.Deserialize<List<MediaAppModel>>(SafeReadAllText(storesFile)) ?? new();
            }
            catch { return new List<MediaAppModel>(); }
        }

        private void SaveStoreLaunchers(List<MediaAppModel> stores)
        {
            if (string.IsNullOrEmpty(storesFile)) return;
            SafeWriteAllText(storesFile, JsonSerializer.Serialize(stores, new JsonSerializerOptions { WriteIndented = true }));
        }

        private async Task InitializeStoreLaunchersAsync()
        {
            if (string.IsNullOrEmpty(storesFile)) return;

            var existing = LoadStoreLaunchers();
            var byId = existing.ToDictionary(s => s.Id, StringComparer.OrdinalIgnoreCase);
            var stores = new List<MediaAppModel>();
            bool changed = false;

            foreach (var (id, name, sgdbQuery) in StoreLauncherCatalog)
            {
                byId.TryGetValue(id, out var entry);
                entry ??= new MediaAppModel { Id = id, Name = name, Type = "store", Url = id, OwnerUserId = currentUserId, DateAdded = DateTime.Now };

                if (!entry.DisableGamepadControlConfigured && IsStoreMouseModeDisabledByDefault(id))
                {
                    entry.DisableGamepadControl = true;
                    entry.DisableGamepadControlConfigured = true;
                    changed = true;
                }

                if (string.IsNullOrEmpty(entry.GridImage) || string.IsNullOrEmpty(entry.HeroImage))
                {
                    try
                    {
                        var (gridUrl, horizontalUrl, heroUrl, logoUrl) = await FetchMediaAppAssetsAsync(name, sgdbQuery).ConfigureAwait(false);
                        string safeName = "store_" + StableAssetName(id);
                        var tGrid = gridUrl != null ? DownloadImageAsync(gridUrl, gridFolder, safeName) : Task.FromResult<string?>(null);
                        var tHoriz = horizontalUrl != null ? DownloadImageAsync(horizontalUrl, gridHorizontalFolder, safeName + "_h") : Task.FromResult<string?>(null);
                        var tHero = heroUrl != null ? DownloadImageAsync(heroUrl, heroFolder, safeName) : Task.FromResult<string?>(null);
                        var tLogo = logoUrl != null ? DownloadImageAsync(logoUrl, logoFolder, safeName + "_logo") : Task.FromResult<string?>(null);
                        await Task.WhenAll(tGrid, tHoriz, tHero, tLogo).ConfigureAwait(false);

                        if (tGrid.Result != null) { entry.GridImage = $"https://data.local/images/grid/{Path.GetFileName(tGrid.Result)}"; changed = true; }
                        if (tHoriz.Result != null) { entry.GridHorizontalImage = $"https://data.local/images/grid-horizontal/{Path.GetFileName(tHoriz.Result)}"; changed = true; }
                        if (tHero.Result != null) { entry.HeroImage = $"https://data.local/images/hero/{Path.GetFileName(tHero.Result)}"; changed = true; }
                        if (tLogo.Result != null) { entry.LogoImage = $"https://data.local/images/logo/{Path.GetFileName(tLogo.Result)}"; changed = true; }
                    }
                    catch (Exception ex) { Debug.WriteLine($"[Store] Arte {id}: {ex.Message}"); }
                }

                entry.Name = name;
                entry.Type = "store";
                entry.Url = id;
                stores.Add(entry);
            }

            if (changed || existing.Count != stores.Count)
                SaveStoreLaunchers(stores);

            _ = Dispatcher.BeginInvoke(() =>
            {
                SendStoresToUI(stores);
                SendStoreAutoAddSettingsToUI();
            });
        }

        private void SendStoresToUI(List<MediaAppModel> stores)
        {
            var sorted = stores.OrderBy(s => s.Name).ToList();
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(new { type = "storesAppsLoaded", apps = sorted })));
        }

        private void SaveStoreGamepadControlSetting(string storeId, bool disabled)
        {
            var stores = LoadStoreLaunchers();
            var store = stores.FirstOrDefault(s => string.Equals(s.Id, storeId, StringComparison.OrdinalIgnoreCase));
            if (store == null) return;

            store.DisableGamepadControl = disabled;
            store.DisableGamepadControlConfigured = true;
            SaveStoreLaunchers(stores);
            SendStoresToUI(stores);
        }

        private static string? ResolveStoreLauncherExe(string storeId) => storeId switch
        {
            "Steam" => ResolveSteamExe(),
            "Epic" => ResolveEpicExe(),
            "GOG" => ResolveGogExe(),
            "Ubisoft" => ResolveUbisoftExe(),
            "EA" => ResolveEaExe(),
            "BattleNet" => ResolveBattleNetExe(),
            "Amazon" => ResolveAmazonExe(),
            "Xbox" => ResolveXboxExe(),
            _ => null
        };

        private static string? ResolveSteamExe()
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Valve\Steam")
                         ?? Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Valve\Steam");
            if (key?.GetValue("InstallPath") is string path)
            {
                string exe = Path.Combine(path, "steam.exe");
                if (File.Exists(exe)) return exe;
            }
            return null;
        }

        private static string? ResolveEpicExe()
        {
            string[] candidates =
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                    "Epic", "EpicGamesLauncher", "Portal", "Binaries", "Win64", "EpicGamesLauncher.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                    "Epic Games", "Launcher", "Portal", "Binaries", "Win64", "EpicGamesLauncher.exe"),
            };
            return candidates.FirstOrDefault(File.Exists);
        }

        private static string? ResolveGogExe()
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\GOG.com\GalaxyClient\paths");
            if (key?.GetValue("client") is string path)
            {
                string exe = Path.Combine(path, "GalaxyClient.exe");
                if (File.Exists(exe)) return exe;
            }
            string fallback = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                "GOG Galaxy", "GalaxyClient.exe");
            return File.Exists(fallback) ? fallback : null;
        }

        private static string? ResolveUbisoftExe()
        {
            string[] candidates =
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                    "Ubisoft", "Ubisoft Game Launcher", "UbisoftConnect.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Ubisoft Game Launcher", "UbisoftConnect.exe"),
            };
            return candidates.FirstOrDefault(File.Exists);
        }

        private static string? ResolveEaExe()
        {
            string[] candidates =
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                    "Electronic Arts", "EA Desktop", "EA Desktop", "EADesktop.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                    "Origin", "Origin.exe"),
            };
            return candidates.FirstOrDefault(File.Exists);
        }

        private static string? ResolveBattleNetExe()
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Blizzard Entertainment\Battle.net");
            if (key?.GetValue("InstallPath") is string path)
            {
                string exe = Path.Combine(path, "Battle.net Launcher.exe");
                if (File.Exists(exe)) return exe;
            }
            string fallback = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                "Battle.net", "Battle.net Launcher.exe");
            return File.Exists(fallback) ? fallback : null;
        }

        private static string? ResolveAmazonExe()
        {
            string exe = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Amazon Games", "AmazonGamesLauncher.exe");
            return File.Exists(exe) ? exe : null;
        }

        private static string? ResolveXboxExe()
        {
            string exe = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                "WindowsApps", "Microsoft.GamingApp_8wekyb3d8bbwe", "XboxPcApp.exe");
            if (File.Exists(exe)) return exe;
            try
            {
                string? loc = RunPowerShell(
                    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; " +
                    "(Get-AppxPackage -Name Microsoft.GamingApp | Select-Object -First 1 -ExpandProperty InstallLocation)");
                if (!string.IsNullOrWhiteSpace(loc))
                {
                    string candidate = Path.Combine(loc.Trim(), "XboxPcApp.exe");
                    if (File.Exists(candidate)) return candidate;
                }
            }
            catch { }
            return null;
        }

        // ========================= FINGERPRINTS =========================

        private HashSet<string> GetUbisoftFingerprint() => GetRegistryPublisherFingerprint("Ubisoft");

        private HashSet<string> GetEaFingerprint()
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                    "EA", "AC", "Manifests");
                if (!Directory.Exists(dir)) return keys;
                foreach (var file in Directory.GetFiles(dir, "*.json"))
                {
                    var fi = new FileInfo(file);
                    keys.Add($"{fi.Name}|{fi.LastWriteTimeUtc.Ticks}");
                }
            }
            catch (Exception ex) { Debug.WriteLine("EaFingerprint: " + ex.Message); }
            return keys;
        }

        private HashSet<string> GetBattleNetFingerprint() =>
            GetRegistryPublisherFingerprint("Blizzard Entertainment");

        private HashSet<string> GetAmazonFingerprint()
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Amazon Games", "Data", "Games");
                if (!Directory.Exists(dir)) return keys;
                foreach (var file in Directory.GetFiles(dir, "*.json"))
                {
                    var fi = new FileInfo(file);
                    keys.Add($"{fi.Name}|{fi.LastWriteTimeUtc.Ticks}");
                }
            }
            catch (Exception ex) { Debug.WriteLine("AmazonFingerprint: " + ex.Message); }
            return keys;
        }

        private HashSet<string> GetXboxFingerprint()
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                foreach (var pkg in EnumerateXboxPackages())
                {
                    if (!IsLikelyXboxGamePackage(pkg)) continue;
                    keys.Add($"{pkg.Name}|{pkg.Version}");
                }
            }
            catch (Exception ex) { Debug.WriteLine("XboxFingerprint: " + ex.Message); }
            return keys;
        }

        private HashSet<string> GetRegistryPublisherFingerprint(string publisherFragment)
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var paths = new[]
            {
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
            };
            foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
                foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                {
                    using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                    foreach (var rel in paths)
                    {
                        using var key = baseKey.OpenSubKey(rel);
                        if (key == null) continue;
                        foreach (var subName in key.GetSubKeyNames())
                        {
                            using var sub = key.OpenSubKey(subName);
                            if (sub == null) continue;
                            string publisher = sub.GetValue("Publisher") as string ?? "";
                            if (publisher.Contains(publisherFragment, StringComparison.OrdinalIgnoreCase))
                                keys.Add(subName);
                        }
                    }
                }
            return keys;
        }

        // ========================= GAME SCANNERS =========================

        private List<InstalledApp> GetUbisoftGames(bool includeIcons = true)
        {
            var list = new List<InstalledApp>();
            var paths = new[]
            {
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
            };
            try
            {
                foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
                    foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                    {
                        using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                        foreach (var rel in paths)
                        {
                            using var key = baseKey.OpenSubKey(rel);
                            if (key == null) continue;
                            foreach (var subName in key.GetSubKeyNames())
                            {
                                using var sub = key.OpenSubKey(subName);
                                if (sub == null) continue;

                                string publisher = sub.GetValue("Publisher") as string ?? "";
                                if (!publisher.Contains("Ubisoft", StringComparison.OrdinalIgnoreCase)) continue;

                                string displayName = sub.GetValue("DisplayName") as string ?? "";
                                if (string.IsNullOrWhiteSpace(displayName)) continue;
                                if (displayName.Contains("Ubisoft Connect", StringComparison.OrdinalIgnoreCase) ||
                                    displayName.Contains("Ubisoft Game Launcher", StringComparison.OrdinalIgnoreCase))
                                    continue;

                                string uninstall = sub.GetValue("UninstallString") as string ?? "";
                                string? gameId = ExtractUbisoftGameId(uninstall, sub);
                                if (string.IsNullOrEmpty(gameId)) continue;

                                string launchUrl = $"uplay://launch/{gameId}/0";
                                string installLocation = sub.GetValue("InstallLocation") as string ?? "";
                                string iconBase64 = "";
                                if (includeIcons)
                                {
                                    string displayIcon = sub.GetValue("DisplayIcon") as string ?? "";
                                    string iconPath = displayIcon.Split(',')[0].Replace("\"", "").Trim();
                                    if (File.Exists(iconPath)) iconBase64 = GetCachedIcon(iconPath);
                                }

                                list.Add(new InstalledApp
                                {
                                    Name = displayName,
                                    LaunchUrl = launchUrl,
                                    Path = Directory.Exists(installLocation) ? installLocation : gameId,
                                    Source = "Ubisoft",
                                    IconBase64 = iconBase64
                                });
                            }
                        }
                    }
            }
            catch (Exception ex) { Debug.WriteLine("Erro Ubisoft: " + ex.Message); }

            return list.GroupBy(a => a.LaunchUrl, StringComparer.OrdinalIgnoreCase).Select(g => g.First()).ToList();
        }

        private static string? ExtractUbisoftGameId(string uninstallString, RegistryKey sub)
        {
            if (!string.IsNullOrEmpty(uninstallString))
            {
                var m = Regex.Match(uninstallString, @"uplay://launch/(\d+)", RegexOptions.IgnoreCase);
                if (m.Success) return m.Groups[1].Value;
                m = Regex.Match(uninstallString, @"[/-]id\s+(\d+)", RegexOptions.IgnoreCase);
                if (m.Success) return m.Groups[1].Value;
                m = Regex.Match(uninstallString, @"install/(\d+)", RegexOptions.IgnoreCase);
                if (m.Success) return m.Groups[1].Value;
            }

            foreach (var valueName in sub.GetValueNames())
            {
                if (valueName.Contains("uplay", StringComparison.OrdinalIgnoreCase) ||
                    valueName.Contains("game", StringComparison.OrdinalIgnoreCase))
                {
                    var val = sub.GetValue(valueName)?.ToString() ?? "";
                    var m = Regex.Match(val, @"(\d{3,})");
                    if (m.Success) return m.Groups[1].Value;
                }
            }
            return null;
        }

        private List<InstalledApp> GetEaGames(bool includeIcons = true)
        {
            var list = new List<InstalledApp>();
            try
            {
                string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                    "EA", "AC", "Manifests");
                if (!Directory.Exists(dir)) return list;

                foreach (var file in Directory.GetFiles(dir, "*.json"))
                {
                    string json = SafeReadAllText(file);
                    if (string.IsNullOrWhiteSpace(json)) continue;

                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    string name = GetStr(root, "displayName");
                    if (string.IsNullOrWhiteSpace(name))
                        name = GetStr(root, "title");
                    string softwareId = GetStr(root, "softwareId");
                    if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(softwareId)) continue;

                    string installPath = GetStr(root, "installPath");
                    if (string.IsNullOrWhiteSpace(installPath))
                        installPath = GetStr(root, "installDirectory");

                    string iconBase64 = "";
                    if (includeIcons && !string.IsNullOrEmpty(installPath) && Directory.Exists(installPath))
                    {
                        string? exe = FindMainExecutable(installPath, name,
                            new EnumerationOptions { RecurseSubdirectories = true, MaxRecursionDepth = 3 });
                        if (!string.IsNullOrEmpty(exe)) iconBase64 = GetCachedIcon(exe);
                    }

                    list.Add(new InstalledApp
                    {
                        Name = name,
                        LaunchUrl = $"origin2://game/launch?offerIds={Uri.EscapeDataString(softwareId)}",
                        Path = Directory.Exists(installPath) ? installPath : softwareId,
                        Source = "EA",
                        IconBase64 = iconBase64
                    });
                }
            }
            catch (Exception ex) { Debug.WriteLine("Erro EA: " + ex.Message); }
            return list.GroupBy(a => a.LaunchUrl, StringComparer.OrdinalIgnoreCase).Select(g => g.First()).ToList();
        }

        private List<InstalledApp> GetBattleNetGames(bool includeIcons = true)
        {
            var list = new List<InstalledApp>();
            var paths = new[]
            {
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
            };
            try
            {
                foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
                    foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                    {
                        using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                        foreach (var rel in paths)
                        {
                            using var key = baseKey.OpenSubKey(rel);
                            if (key == null) continue;
                            foreach (var subName in key.GetSubKeyNames())
                            {
                                using var sub = key.OpenSubKey(subName);
                                if (sub == null) continue;

                                string publisher = sub.GetValue("Publisher") as string ?? "";
                                if (!publisher.Contains("Blizzard Entertainment", StringComparison.OrdinalIgnoreCase))
                                    continue;

                                string displayName = sub.GetValue("DisplayName") as string ?? "";
                                if (string.IsNullOrWhiteSpace(displayName)) continue;
                                if (displayName.Contains("Battle.net", StringComparison.OrdinalIgnoreCase)) continue;

                                string? productCode = ExtractBattleNetProductCode(sub, subName);
                                if (string.IsNullOrEmpty(productCode)) continue;
                                string installLocation = sub.GetValue("InstallLocation") as string ?? "";

                                string iconBase64 = "";
                                if (includeIcons)
                                {
                                    string displayIcon = sub.GetValue("DisplayIcon") as string ?? "";
                                    string iconPath = displayIcon.Split(',')[0].Replace("\"", "").Trim();
                                    if (File.Exists(iconPath)) iconBase64 = GetCachedIcon(iconPath);
                                }

                                list.Add(new InstalledApp
                                {
                                    Name = displayName,
                                    LaunchUrl = $"battlenet://{productCode}",
                                    Path = Directory.Exists(installLocation) ? installLocation : productCode,
                                    Source = "Battle.net",
                                    IconBase64 = iconBase64
                                });
                            }
                        }
                    }
            }
            catch (Exception ex) { Debug.WriteLine("Erro Battle.net: " + ex.Message); }
            return list.GroupBy(a => a.LaunchUrl, StringComparer.OrdinalIgnoreCase).Select(g => g.First()).ToList();
        }

        private static string? ExtractBattleNetProductCode(RegistryKey sub, string subName)
        {
            string installLocation = sub.GetValue("InstallLocation") as string ?? "";
            if (!string.IsNullOrEmpty(installLocation))
            {
                var dir = new DirectoryInfo(installLocation);
                if (!string.IsNullOrEmpty(dir.Name)) return dir.Name.ToLowerInvariant();
            }

            var m = Regex.Match(subName, @"_([^_]+)$");
            if (m.Success && m.Groups[1].Value.Length >= 3) return m.Groups[1].Value.ToLowerInvariant();

            string displayName = sub.GetValue("DisplayName") as string ?? "";
            if (!string.IsNullOrEmpty(displayName))
                return new string(displayName.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();

            return null;
        }

        private List<InstalledApp> GetAmazonGames(bool includeIcons = true)
        {
            var list = new List<InstalledApp>();
            try
            {
                string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Amazon Games", "Data", "Games");
                if (!Directory.Exists(dir)) return list;

                foreach (var file in Directory.GetFiles(dir, "*.json"))
                {
                    string json = SafeReadAllText(file);
                    if (string.IsNullOrWhiteSpace(json)) continue;

                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    string gameId = GetStr(root, "id");
                    if (string.IsNullOrWhiteSpace(gameId)) gameId = GetStr(root, "productId");
                    string name = GetStr(root, "displayName");
                    if (string.IsNullOrWhiteSpace(name)) name = GetStr(root, "title");
                    if (string.IsNullOrWhiteSpace(gameId) || string.IsNullOrWhiteSpace(name)) continue;

                    string installPath = GetStr(root, "installDirectory");
                    if (string.IsNullOrWhiteSpace(installPath)) installPath = GetStr(root, "installPath");

                    string iconBase64 = "";
                    if (includeIcons && !string.IsNullOrEmpty(installPath) && Directory.Exists(installPath))
                    {
                        string? exe = FindMainExecutable(installPath, name,
                            new EnumerationOptions { RecurseSubdirectories = true, MaxRecursionDepth = 3 });
                        if (!string.IsNullOrEmpty(exe)) iconBase64 = GetCachedIcon(exe);
                    }

                    list.Add(new InstalledApp
                    {
                        Name = name,
                        LaunchUrl = $"amazongames://play/{gameId}",
                        Path = Directory.Exists(installPath) ? installPath : gameId,
                        Source = "Amazon",
                        IconBase64 = iconBase64
                    });
                }
            }
            catch (Exception ex) { Debug.WriteLine("Erro Amazon: " + ex.Message); }
            return list.GroupBy(a => a.LaunchUrl, StringComparer.OrdinalIgnoreCase).Select(g => g.First()).ToList();
        }

        private List<InstalledApp> GetXboxGames(bool includeIcons = true)
        {
            var list = new List<InstalledApp>();
            try
            {
                foreach (var pkg in EnumerateXboxPackages())
                {
                    if (!IsLikelyXboxGamePackage(pkg)) continue;
                    if (!TryParseXboxManifest(pkg, out string appId, out string displayName))
                        continue;

                    string launchUrl = $"explorer.exe shell:AppsFolder\\{pkg.PackageFamilyName}!{appId}";
                    string iconBase64 = "";
                    if (includeIcons)
                    {
                        string? exe = FindMainExecutable(pkg.InstallLocation, displayName,
                            new EnumerationOptions { RecurseSubdirectories = true, MaxRecursionDepth = 4 });
                        if (!string.IsNullOrEmpty(exe)) iconBase64 = GetCachedIcon(exe);
                    }

                    list.Add(new InstalledApp
                    {
                        Name = displayName,
                        LaunchUrl = launchUrl,
                        Path = pkg.InstallLocation,
                        Source = "Xbox",
                        IconBase64 = iconBase64
                    });
                }
            }
            catch (Exception ex) { Debug.WriteLine("Erro Xbox: " + ex.Message); }
            return list.GroupBy(a => a.LaunchUrl, StringComparer.OrdinalIgnoreCase).Select(g => g.First()).ToList();
        }

        private sealed record XboxPackageInfo(string Name, string PackageFamilyName, string InstallLocation, string Version);

        private IEnumerable<XboxPackageInfo> EnumerateXboxPackages()
        {
            string? output = RunPowerShell(
                "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; " +
                "Get-AppxPackage | Where-Object { $_.IsFramework -eq $false -and $_.InstallLocation -and $_.Name -notlike 'Windows.*' } | " +
                "Select-Object Name, PackageFamilyName, InstallLocation, Version | ConvertTo-Json -Compress");

            if (string.IsNullOrWhiteSpace(output)) yield break;

            using var doc = JsonDocument.Parse(output.Trim());
            var root = doc.RootElement;

            if (root.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in root.EnumerateArray())
                {
                    var pkg = ParseXboxPackageElement(item);
                    if (pkg != null && IsLikelyXboxGamePackage(pkg)) yield return pkg;
                }
            }
            else if (root.ValueKind == JsonValueKind.Object)
            {
                var pkg = ParseXboxPackageElement(root);
                if (pkg != null && IsLikelyXboxGamePackage(pkg)) yield return pkg;
            }
        }

        private static XboxPackageInfo? ParseXboxPackageElement(JsonElement item)
        {
            string name = item.TryGetProperty("Name", out var n) ? n.GetString() ?? "" : "";
            string pfn = item.TryGetProperty("PackageFamilyName", out var p) ? p.GetString() ?? "" : "";
            string loc = item.TryGetProperty("InstallLocation", out var l) ? l.GetString() ?? "" : "";
            string ver = item.TryGetProperty("Version", out var v) ? v.GetString() ?? "" : "";
            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(pfn) || string.IsNullOrWhiteSpace(loc))
                return null;
            return new XboxPackageInfo(name, pfn, loc, ver);
        }

        private static bool IsLikelyXboxGamePackage(XboxPackageInfo pkg)
        {
            if (string.IsNullOrWhiteSpace(pkg.Name)) return false;

            foreach (var prefix in XboxDeniedPackagePrefixes)
            {
                if (pkg.Name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    return false;
            }

            foreach (var fragment in XboxDeniedPackageFragments)
            {
                if (pkg.Name.Contains(fragment, StringComparison.OrdinalIgnoreCase))
                    return false;
            }

            // Jogos Game Pass / Xbox costumam ter Publisher.AppName (ex: BethesdaSoftworks.Sku)
            int dot = pkg.Name.IndexOf('.');
            if (dot <= 0 || dot >= pkg.Name.Length - 1) return false;

            string publisher = pkg.Name[..dot];
            if (publisher.Equals("NVIDIA", StringComparison.OrdinalIgnoreCase) ||
                publisher.Equals("NVIDIACorp", StringComparison.OrdinalIgnoreCase))
                return false;

            return true;
        }

        private static bool HasXboxGameConfig(string installLocation)
        {
            try
            {
                if (File.Exists(Path.Combine(installLocation, "MicrosoftGame.config"))) return true;

                var pending = new Queue<(string Path, int Depth)>();
                pending.Enqueue((installLocation, 0));

                while (pending.Count > 0)
                {
                    var (dir, depth) = pending.Dequeue();
                    if (depth >= 3) continue;

                    foreach (var child in Directory.EnumerateDirectories(dir))
                    {
                        try
                        {
                            if (File.Exists(Path.Combine(child, "MicrosoftGame.config"))) return true;
                            pending.Enqueue((child, depth + 1));
                        }
                        catch { }
                    }
                }
            }
            catch { }

            return false;
        }

        private static bool TryParseXboxManifest(XboxPackageInfo pkg, out string appId, out string displayName)
        {
            appId = "";
            displayName = "";
            try
            {
                string manifestPath = Path.Combine(pkg.InstallLocation, "AppxManifest.xml");
                if (!File.Exists(manifestPath)) return false;

                var doc = XDocument.Load(manifestPath);
                XNamespace ns = doc.Root?.Name.Namespace ?? XNamespace.None;
                XNamespace uap = "http://schemas.microsoft.com/appx/manifest/uap/windows10";

                var appEl = doc.Descendants(ns + "Application")
                    .FirstOrDefault(a =>
                    {
                        string? exe = a.Attribute("Executable")?.Value;
                        return !string.IsNullOrWhiteSpace(exe) &&
                               exe.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) &&
                               !exe.Contains("GameBar", StringComparison.OrdinalIgnoreCase);
                    });

                if (appEl == null) return false;

                appId = appEl.Attribute("Id")?.Value ?? "";
                if (string.IsNullOrEmpty(appId)) return false;

                var visual = appEl.Descendants(uap + "VisualElements").FirstOrDefault()
                          ?? appEl.Descendants(ns + "VisualElements").FirstOrDefault();

                string category = visual?.Attribute("AppListEntry")?.Value ?? visual?.Attribute("Category")?.Value ?? "";
                bool isGameCategory = category.Equals("game", StringComparison.OrdinalIgnoreCase);

                displayName = visual?.Attribute("DisplayName")?.Value ?? "";
                if (string.IsNullOrWhiteSpace(displayName) || displayName.StartsWith("ms-resource:", StringComparison.OrdinalIgnoreCase))
                    displayName = doc.Descendants(ns + "DisplayName").FirstOrDefault()?.Value ?? "";

                if (string.IsNullOrWhiteSpace(displayName) || displayName.StartsWith("ms-resource:", StringComparison.OrdinalIgnoreCase))
                {
                    string friendly = pkg.Name[(pkg.Name.IndexOf('.') + 1)..];
                    displayName = friendly.Replace('_', ' ').Trim();
                }
                
                if (!isGameCategory)
                {
                    // Fallback: pasta típica de título Xbox (contém Content ou executável de jogo)
                    bool hasGameLayout = HasXboxGameConfig(pkg.InstallLocation);
                    if (!hasGameLayout) return false;
                }

                return !string.IsNullOrWhiteSpace(displayName);
            }
            catch { return false; }
        }

        private static string? RunPowerShell(string script)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"{script.Replace("\"", "\\\"")}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using var proc = Process.Start(psi);
                if (proc == null) return null;
                string output = proc.StandardOutput.ReadToEnd();
                proc.WaitForExit(15000);
                return string.IsNullOrWhiteSpace(output) ? null : output.Trim();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[PowerShell] " + ex.Message);
                return null;
            }
        }
    }
}
