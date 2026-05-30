using Microsoft.Win32;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
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
        private HashSet<string> _libraryKeysBeforeStore = new(StringComparer.OrdinalIgnoreCase);
        private HashSet<string> _storeKeysBeforeStore = new(StringComparer.OrdinalIgnoreCase);
        private HashSet<string> _storeKeysProcessedDuringSession = new(StringComparer.OrdinalIgnoreCase);
        private HashSet<int> _storeProcessSnapshot = new();
        private HashSet<IntPtr> _storeWindowSnapshot = new();
        private CancellationTokenSource? _storeLibraryMonitorCts;
        private CancellationTokenSource? _storeChildGameDetectorCts;
        private bool _storeChildGameActive;
        private string _storeChildGameStoreId = "";
        private string _storeChildGameId = "";
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

        private static bool IsStoreGamepadControlDisabledByDefault(string storeId)
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
                            _storeChildGameActive ||
                            _gameSessionActive)
                        {
                            continue;
                        }

                        var candidate = FindStoreChildGameCandidate(storeId);
                        if (candidate != null)
                        {
                            Dispatcher.Invoke(() => BeginStoreChildGameSession(storeId, candidate));
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

        private StoreChildGameCandidate? FindStoreChildGameCandidate(string storeId)
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
                return null;
            }

            var games = LoadGames();
            var candidates = storeApps
                .Select(app => new
                {
                    App = app,
                    Game = games.FirstOrDefault(g => InstalledAppMatchesGame(app, g))
                })
                .Where(x => x.Game != null)
                .ToList();

            if (candidates.Count == 0) return null;

            StoreChildGameCandidate? best = null;
            foreach (var hWnd in EnumerateTopLevelWindows())
            {
                if (!IsWindowVisible(hWnd) || IsIconic(hWnd)) continue;
                if (!GetWindowRect(hWnd, out RECT rect) || rect.Width < 320 || rect.Height < 240) continue;

                GetWindowThreadProcessId(hWnd, out uint pidRaw);
                if (pidRaw == 0 || pidRaw == Environment.ProcessId) continue;

                Process process;
                try { process = Process.GetProcessById((int)pidRaw); }
                catch { continue; }

                var processName = SafeProcessName(process);
                if (string.IsNullOrWhiteSpace(processName)) continue;
                if (_shellProcessNames.Contains(processName)) continue;
                if (_knownLauncherProcessNames.Contains(processName)) continue;

                var processPath = SafeProcessPath(process);
                if (!string.IsNullOrWhiteSpace(_storeLauncherExe) &&
                    !string.IsNullOrWhiteSpace(processPath) &&
                    PathsEqual(_storeLauncherExe, processPath))
                {
                    continue;
                }

                foreach (var pair in candidates)
                {
                    int score = ScoreStoreChildGameCandidate(pair.Game!, pair.App, process, hWnd, rect);
                    if (!_storeProcessSnapshot.Contains((int)pidRaw)) score += 55;
                    if (!_storeWindowSnapshot.Contains(hWnd)) score += 35;
                    if (!_storeProcessSnapshot.Contains((int)pidRaw) && !_storeWindowSnapshot.Contains(hWnd))
                        score += 35;

                    if (score < 70) continue;

                    if (best == null || score > best.Score)
                    {
                        best = new StoreChildGameCandidate
                        {
                            Game = pair.Game!,
                            Hwnd = hWnd,
                            ProcessId = (int)pidRaw,
                            ProcessName = processName,
                            Score = score
                        };
                    }
                }
            }

            foreach (var process in Process.GetProcesses())
            {
                var processName = SafeProcessName(process);
                if (string.IsNullOrWhiteSpace(processName)) continue;
                if (_shellProcessNames.Contains(processName)) continue;
                if (_knownLauncherProcessNames.Contains(processName)) continue;

                int pid = SafeProcessId(process);
                if (pid <= 0 || pid == Environment.ProcessId) continue;

                var processPath = SafeProcessPath(process);
                if (!string.IsNullOrWhiteSpace(_storeLauncherExe) &&
                    !string.IsNullOrWhiteSpace(processPath) &&
                    PathsEqual(_storeLauncherExe, processPath))
                {
                    continue;
                }

                var hwnd = FindAnyWindowForProcess(pid);
                foreach (var pair in candidates)
                {
                    int score = ScoreStoreChildGameProcessCandidate(pair.Game!, pair.App, process);
                    bool hasIdentityMatch = score >= 75;
                    bool isNewWindowedProcess = !_storeProcessSnapshot.Contains(pid) && hwnd != IntPtr.Zero;
                    if (!hasIdentityMatch && !isNewWindowedProcess) continue;

                    if (!_storeProcessSnapshot.Contains(pid)) score += 80;
                    if (hwnd != IntPtr.Zero && !_storeWindowSnapshot.Contains(hwnd)) score += 35;
                    if (!_storeProcessSnapshot.Contains(pid) && hwnd != IntPtr.Zero) score += 35;

                    if (score < 75) continue;

                    if (best == null || score > best.Score)
                    {
                        best = new StoreChildGameCandidate
                        {
                            Game = pair.Game!,
                            Hwnd = hwnd,
                            ProcessId = pid,
                            ProcessName = processName,
                            Score = score
                        };
                    }
                }
            }

            return best;
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

            MarkStoreChildGameAsPlayed(candidate.Game, gameId);

            bool waitingForWindow = candidate.Hwnd == IntPtr.Zero;

            StopMediaControllerMode();
            try { _mediaExeWatcherCts?.Cancel(); } catch { }
            _mediaExeModeActive = false;
            _mediaExeWatcherPaused = true;
            _launcherMouseActive = false;
            _mediaExeGamepadDisabled = false;
            if (waitingForWindow)
            {
                SendGameLaunchStatus(
                    "gameLaunching",
                    candidate.Game.Name,
                    candidate.Game.HeroImage ?? "",
                    candidate.Game.GridImage ?? "",
                    "restore");
            }
            else
            {
                SendGameLaunchStatus("gameLaunchDone");
            }

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
            _gameIsRunningAndDoorpiHidden = !waitingForWindow;
            _currentGameHwnd = candidate.Hwnd;
            _currentLauncherHwnd = IntPtr.Zero;
            _lastVisibleWindowBeforeMinimize = IntPtr.Zero;
            _lockedGameProcessName = candidate.ProcessName;
            _activeSessionGameId = gameId;
            _sessionStartUtc = DateTime.UtcNow;

            try
            {
                if (this.Topmost) this.Topmost = false;
                SendDoorpiToBackground();
                if (candidate.Hwnd != IntPtr.Zero)
                    RestoreGameCleanly(candidate.Hwnd);
            }
            catch { }

            DiscordRpcManager.Instance.UpdateState("game", candidate.Game.Name);
            SendRuntimeSessionsToUI();
            _ = Task.Run(() => MonitorStoreChildGameAsync(candidate.Game, candidate.ProcessName, cts.Token));
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
                bool launchDoneSent = false;

                while (!token.IsCancellationRequested && _storeChildGameActive)
                {
                    if (_gameIsMinimized)
                    {
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
                                            if (this.Topmost) this.Topmost = false;
                                            SendDoorpiToBackground();
                                            RestoreGameCleanly(hwnd);
                                            if (!launchDoneSent)
                                            {
                                                SendGameLaunchStatus("gameLaunchDone");
                                                launchDoneSent = true;
                                            }
                                        });
                                        break;
                                    }
                                }
                                catch { }
                            }
                        }
                        else if (GetForegroundWindow() != _currentGameHwnd)
                        {
                            Dispatcher.Invoke(() =>
                            {
                                _gameIsRunningAndDoorpiHidden = true;
                                if (this.Topmost) this.Topmost = false;
                                SendDoorpiToBackground();
                                RestoreGameCleanly(_currentGameHwnd);
                                if (!launchDoneSent)
                                {
                                    SendGameLaunchStatus("gameLaunchDone");
                                    launchDoneSent = true;
                                }
                            });
                        }
                    }
                    else if (++missingChecks >= 4)
                    {
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
            if (!_storeChildGameActive) return;

            string storeId = _storeChildGameStoreId;
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
               !string.IsNullOrWhiteSpace(id) &&
               string.Equals(_storeChildGameId, id, StringComparison.OrdinalIgnoreCase);

        private void MarkStorePausedBecauseChildGameReturnedToDoorpi()
        {
            if (_storeChildGameActive && _isStoreLauncherSession)
                _storePausedByDoorpi = true;
        }

        private bool IsActiveStoreLauncherProcessAlive()
        {
            try
            {
                if (_mediaExeProcess != null && !SafeHasExited(_mediaExeProcess))
                    return true;
            }
            catch { }

            if (string.IsNullOrWhiteSpace(_storeLauncherExe)) return false;

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

        private void BeginStoreLauncherSession(string storeId)
        {
            _isStoreLauncherSession = true;
            _storePausedByDoorpi = false;
            _activeStoreId = storeId;
            _storeProcessSnapshot = SnapshotProcessIds();
            _storeWindowSnapshot = SnapshotVisibleWindows();
            _libraryKeysBeforeStore = BuildLibraryKeySet();
            _storeKeysBeforeStore = BuildStoreAppKeySet(storeId);
            lock (_storeLibraryMonitorLock)
                _storeKeysProcessedDuringSession = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            StartStoreLibraryMonitor(storeId);
            StartStoreChildGameDetector(storeId);
        }

        private async Task OpenStoreAsync(string storeId)
        {
            var store = StoreCatalog.FirstOrDefault(s => string.Equals(s.Id, storeId, StringComparison.OrdinalIgnoreCase));
            if (store == null) return;

            var card = LoadStoreLaunchers().FirstOrDefault(s => string.Equals(s.Id, storeId, StringComparison.OrdinalIgnoreCase));
            string heroImg = card?.HeroImage ?? "";
            string gridImg = card?.GridImage ?? "";

            if (_isStoreLauncherSession)
            {
                if (string.Equals(_activeStoreId, store.Id, StringComparison.OrdinalIgnoreCase))
                {
                    SendGameLaunchStatus("gameLaunching", store.Name, heroImg, gridImg, "restore");
                    ResumeStoreSession();
                    return;
                }

                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "storeAlreadyRunning",
                    currentStoreId = _activeStoreId
                }));
                return;
            }

            SendGameLaunchStatus("gameLaunching", store.Name, heroImg, gridImg);
            BeginStoreLauncherSession(store.Id);
            _storeLauncherExe = ResolveStoreLauncherExe(store.Id);

            SuspendMainUiGamepadForGameLaunch();

            if (!string.IsNullOrEmpty(_storeLauncherExe) && File.Exists(_storeLauncherExe))
            {
                _storeSessionKind = "exe";
                try
                {
                    var existing = FindRunningProcessForExe(_storeLauncherExe);
                    if (existing != null && FindVisibleWindowForProcess(existing.Id) != IntPtr.Zero)
                    {
                        EnterStoreExeMode(existing, store.Name, heroImg, gridImg);
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

                    if (proc != null)
                    {
                        EnterStoreExeMode(proc, store.Name, heroImg, gridImg);
                        return;
                    }
                }
                catch (Exception ex) { Debug.WriteLine($"[Store] Falha ao abrir exe {store.Id}: {ex.Message}"); }
            }

            _storeSessionKind = "web";
            _storeLauncherExe = null;
            await OpenWebViewInlineAsync(store.WebUrl, false, store.Name, heroImg, gridImg);
        }

        private Process? FindRunningStoreProcessWithWindow(string exePath)
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

        private void EnterStoreExeMode(Process proc, string appName, string heroImg, string gridImg)
        {
            string url = _storeLauncherExe ?? appName;
            var store = LoadStoreLaunchers().FirstOrDefault(s =>
                string.Equals(s.Id, _activeStoreId, StringComparison.OrdinalIgnoreCase));
            bool disableControllerEmulation = store?.DisableGamepadControl == true;

            _mediaExeGamepadDisabled = disableControllerEmulation;
            if (!disableControllerEmulation)
            {
                EnterMediaExeMode(proc, url, appName, heroImg, gridImg);
                return;
            }

            ActivateExecutableAppSession(url);
            _mediaExeWatcherCts?.Cancel();
            _mediaExeWatcherCts = new CancellationTokenSource();
            _mediaExeProcess = proc;
            _mediaExeCurrentUrl = url;
            _mediaExeModeActive = false;
            _mediaExeWatcherPaused = false;

            int sessionId = NextExecutableAppSessionId();
            SendGameLaunchStatus("gameLaunching", appName, heroImg, gridImg);
            _ = Task.Run(async () =>
            {
                await TryMaximizeExternalWindowAsync(
                    proc,
                    url,
                    _mediaExeWatcherCts.Token,
                    requireControllerActive: false).ConfigureAwait(false);
                if (!_mediaExeWatcherCts.Token.IsCancellationRequested)
                    SendGameLaunchStatus("gameLaunchDone");
            });
            StartMediaExeWatcher(proc, url, appName, _mediaExeWatcherCts.Token);
            _mediaExeThread = new Thread(() => StoreLauncherShortcutLoop(sessionId)) { IsBackground = true };
            _mediaExeThread.Start();
            SendRuntimeSessionsToUI();
        }

        private void MinimizeStoreSessionAndShowMenu()
        {
            if (!_isStoreLauncherSession) return;
            _storePausedByDoorpi = true;
            StopMediaControllerMode();

            if (_storeSessionKind == "web")
            {
                try
                {
                    if (_webAppWindow != null)
                        _webAppWindow.WindowState = System.Windows.WindowState.Minimized;
                }
                catch { }
            }
            else if (_mediaExeProcess != null && !SafeHasExited(_mediaExeProcess))
            {
                MinimizeProcessWindows(_mediaExeProcess);
            }
            else if (!string.IsNullOrEmpty(_storeLauncherExe))
            {
                foreach (var p in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(_storeLauncherExe)))
                {
                    try { MinimizeProcessWindows(p); } catch { }
                }
            }

            _mediaExeModeActive = false;
            _mediaExeGamepadDisabled = false;
            SendGameLaunchStatus("gameLaunchDone");

            Dispatcher.Invoke(() =>
            {
                _desktopVkb?.Close();
                _desktopVkb = null;
                FocusDoorpiKeepSession();
                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideStoreSessionMenu\"}");
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
            if (!_isStoreLauncherSession) return;
            if (_storeChildGameActive && _gameSessionActive && !_gameIsMinimized) return;

            _storePausedByDoorpi = false;

            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideStoreSessionMenu\"}"));
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

            Process? proc = _mediaExeProcess;
            if (proc == null || SafeHasExited(proc))
            {
                if (!string.IsNullOrEmpty(_storeLauncherExe))
                    proc = FindRunningProcessForExe(_storeLauncherExe);
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

                if (hwnd == IntPtr.Zero && !string.IsNullOrEmpty(_storeLauncherExe) && File.Exists(_storeLauncherExe))
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = _storeLauncherExe,
                            UseShellExecute = true,
                            WorkingDirectory = Path.GetDirectoryName(_storeLauncherExe) ?? "",
                            WindowStyle = ProcessWindowStyle.Maximized
                        });

                        Thread.Sleep(800);
                        foreach (var p in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(_storeLauncherExe)))
                        {
                            hwnd = FindVisibleWindowForProcess(p.Id);
                            if (hwnd != IntPtr.Zero) { proc = p; break; }
                        }
                    }
                    catch (Exception ex) { Debug.WriteLine($"[Store] Reabrir janela: {ex.Message}"); }
                }

                if (hwnd != IntPtr.Zero)
                {
                    if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
                    ShowWindow(hwnd, 3);
                    FocusExternalWindow(hwnd);

                    var card = LoadStoreLaunchers().FirstOrDefault(s => s.Id == _activeStoreId);
                    EnterStoreExeMode(proc, card?.Name ?? "Loja", card?.HeroImage ?? "", card?.GridImage ?? "");
                    return;
                }
            }

            if (!string.IsNullOrEmpty(_activeStoreId))
                _ = Dispatcher.InvokeAsync(async () => await OpenStoreAsync(_activeStoreId));
        }

        public void CloseStoreSessionCompletely()
        {
            if (!_isStoreLauncherSession) return;

            var snapshot = _libraryKeysBeforeStore;
            var storeSnapshot = _storeKeysBeforeStore;
            string? storeId = _activeStoreId;
            string? exe = _storeLauncherExe;
            bool wasWeb = _storeSessionKind == "web";
            StopStoreLibraryMonitor();
            StopStoreChildGameDetector();
            _storeChildGameActive = false;
            _storeChildGameStoreId = "";
            _storeChildGameId = "";

            _isStoreLauncherSession = false;
            _storePausedByDoorpi = false;
            _storeLauncherExe = null;
            _storeSessionKind = "";
            _activeStoreId = null;
            _libraryKeysBeforeStore = new(StringComparer.OrdinalIgnoreCase);
            _storeKeysBeforeStore = new(StringComparer.OrdinalIgnoreCase);
            _storeProcessSnapshot = new();
            _storeWindowSnapshot = new();

            _mediaExeWatcherCts?.Cancel();
            _mediaExeModeActive = false;

            if (wasWeb)
                Dispatcher.Invoke(() => CloseYouTubeInline(skipStoreCompletion: true));
            else
            {
                if (!string.IsNullOrEmpty(exe))
                    KillLauncherProcessTree(exe);

                _mediaExeProcess = null;
                _mediaExeCurrentUrl = "";
                ClearExecutableAppSession();

                Dispatcher.Invoke(() =>
                {
                    _desktopVkb?.Close();
                    _desktopVkb = null;
                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideStoreSessionMenu\"}");
                    FocusDoorpiKeepSession();
                });
            }

            SendRuntimeSessionsToUI();
            ScheduleStoreLibraryRevalidation(snapshot, storeId, storeSnapshot);
        }

        private void FinalizeStoreSessionFromWebClose()
        {
            var snapshot = _libraryKeysBeforeStore;
            var storeSnapshot = _storeKeysBeforeStore;
            string? storeId = _activeStoreId;
            StopStoreLibraryMonitor();
            StopStoreChildGameDetector();
            _storeChildGameActive = false;
            _storeChildGameStoreId = "";
            _storeChildGameId = "";
            _isStoreLauncherSession = false;
            _storePausedByDoorpi = false;
            _storeLauncherExe = null;
            _storeSessionKind = "";
            _activeStoreId = null;
            _libraryKeysBeforeStore = new(StringComparer.OrdinalIgnoreCase);
            _storeKeysBeforeStore = new(StringComparer.OrdinalIgnoreCase);
            _storeProcessSnapshot = new();
            _storeWindowSnapshot = new();

            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideStoreSessionMenu\"}"));

            SendRuntimeSessionsToUI();
            ScheduleStoreLibraryRevalidation(snapshot, storeId, storeSnapshot);
        }

        private void ScheduleStoreLibraryRevalidation(HashSet<string> snapshot, string? storeId, HashSet<string> storeSnapshot)
        {
            _ = Task.Run(async () =>
            {
                try { await HandleStoreSessionClosedAsync(snapshot, storeId, storeSnapshot).ConfigureAwait(false); }
                catch (Exception ex) { Debug.WriteLine("[Store] Revalidação: " + ex.Message); }
            });
        }

        private static void KillLauncherProcessTree(string? launcherExe)
        {
            if (string.IsNullOrWhiteSpace(launcherExe)) return;
            string procName = Path.GetFileNameWithoutExtension(launcherExe);
            if (string.IsNullOrEmpty(procName)) return;

            foreach (var proc in Process.GetProcessesByName(procName))
            {
                try
                {
                    if (proc.HasExited) continue;
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "taskkill",
                        Arguments = $"/PID {proc.Id} /T /F",
                        CreateNoWindow = true,
                        UseShellExecute = false
                    })?.WaitForExit(4000);
                }
                catch { }
            }
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

                if (!entry.DisableGamepadControlConfigured && IsStoreGamepadControlDisabledByDefault(id))
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
