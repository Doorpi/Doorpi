using Microsoft.Win32;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Doorpi;

public partial class MainWindow
{
    private const int StorageCacheVersion = 4;
    private static readonly TimeSpan StorageCacheLifetime = TimeSpan.FromHours(8);
    private readonly SemaphoreSlim _storageRefreshLock = new(1, 1);
    private CancellationTokenSource? _storageScanCts;
    private readonly object _storageUninstallerSync = new();
    private string _activeStorageUninstallerProgramId = "";
    private IntPtr _activeStorageUninstallerWindow = IntPtr.Zero;
    private int _activeStorageUninstallerProcessId;
    private int _activeStorageUninstallerObservedProcessId;
    private string _activeStorageUninstallerObservedProcessName = "";
    private string _activeStorageUninstallerProgramName = "";
    private HashSet<IntPtr> _activeStorageUninstallerWindowSnapshot = new();
    private bool _storageUninstallerInputReady;
    private volatile bool _storageUninstallerInputActive;
    private Thread? _storageUninstallerInputThread;
    private long _storageUninstallerSessionToken;

    private string StorageCacheFile => Path.Combine(DoorpiPaths.DataFolder, "storage-cache.json");

    private sealed class StorageCacheDocument
    {
        public int Version { get; set; } = StorageCacheVersion;
        public DateTime ScannedAtUtc { get; set; }
        public string InventoryFingerprint { get; set; } = "";
        public bool IsComplete { get; set; }
        public int ProgressCurrent { get; set; }
        public int ProgressTotal { get; set; }
        public string ProgressLabel { get; set; } = "";
        public List<StorageVolumeCategories> Volumes { get; set; } = new();
        public List<StorageRootCacheEntry> Roots { get; set; } = new();
    }

    private sealed class StorageRootCacheEntry
    {
        public string Id { get; set; } = "";
        public string Path { get; set; } = "";
        public string Category { get; set; } = "";
        public string Child { get; set; } = "";
        public string Grandchild { get; set; } = "";
        public string ItemLabel { get; set; } = "";
        public long SizeBytes { get; set; }
        public string State { get; set; } = "calculated";
    }

    private sealed class StorageVolumeCategories
    {
        public string Root { get; set; } = "";
        public List<StorageCategoryNode> Categories { get; set; } = new();
    }

    private sealed class StorageCategoryNode
    {
        public string Key { get; set; } = "";
        public string Label { get; set; } = "";
        public long SizeBytes { get; set; }
        public string State { get; set; } = "calculated";
        public List<StorageCategoryNode> Children { get; set; } = new();
    }

    private sealed class StorageDriveSnapshot
    {
        public string Root { get; set; } = "";
        public string Label { get; set; } = "";
        public string Format { get; set; } = "";
        public string Kind { get; set; } = "fixed";
        public long TotalBytes { get; set; }
        public long UsedBytes { get; set; }
        public long AvailableBytes { get; set; }
        public long ReservedBytes { get; set; }
    }

    private sealed class StorageScanRoot
    {
        public string Path { get; init; } = "";
        public string Category { get; init; } = "";
        public string Child { get; init; } = "";
        public string Grandchild { get; init; } = "";
        public string ItemLabel { get; init; } = "";
        public string ProgressLabel { get; init; } = "";
        public string ResultState { get; init; } = "calculated";
        public List<string> ExcludedRoots { get; } = new();
    }

    private readonly struct StorageScanResult
    {
        public StorageScanResult(long bytes, bool complete, int visited)
        {
            Bytes = bytes;
            Complete = complete;
            Visited = visited;
        }

        public long Bytes { get; }
        public bool Complete { get; }
        public int Visited { get; }
    }

    private sealed class InstalledProgramEntry
    {
        public string Id { get; init; } = "";
        public string Name { get; init; } = "";
        public string Version { get; init; } = "";
        public string Publisher { get; init; } = "";
        public string InstallLocation { get; init; } = "";
        public string DisplayIcon { get; init; } = "";
        public string IconBase64 { get; init; } = "";
        public string UninstallString { get; init; } = "";
        public string QuietUninstallString { get; init; } = "";
        public long EstimatedSizeBytes { get; init; }
        public bool CanUninstall { get; init; }
    }

    private sealed class StorageAggregation
    {
        private readonly Dictionary<string, Dictionary<string, Dictionary<string, long>>> _sizes =
            new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, Dictionary<string, Dictionary<string, string>>> _states =
            new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string> _labels = new(StringComparer.OrdinalIgnoreCase);

        public void Add(string category, string child, string grandchild, long bytes, string state, string itemLabel = "")
        {
            bytes = Math.Max(0, bytes);
            child = string.IsNullOrWhiteSpace(child) ? "total" : child;
            grandchild = string.IsNullOrWhiteSpace(grandchild) ? "total" : grandchild;
            if (!_sizes.TryGetValue(category, out var children))
                _sizes[category] = children = new(StringComparer.OrdinalIgnoreCase);
            if (!children.TryGetValue(child, out var grandchildren))
                children[child] = grandchildren = new(StringComparer.OrdinalIgnoreCase);
            grandchildren[grandchild] = grandchildren.GetValueOrDefault(grandchild) + bytes;
            if (!string.IsNullOrWhiteSpace(itemLabel))
                _labels[$"{category}|{child}|{grandchild}"] = itemLabel;

            if (!_states.TryGetValue(category, out var stateChildren))
                _states[category] = stateChildren = new(StringComparer.OrdinalIgnoreCase);
            if (!stateChildren.TryGetValue(child, out var stateGrandchildren))
                stateChildren[child] = stateGrandchildren = new(StringComparer.OrdinalIgnoreCase);
            string previous = stateGrandchildren.GetValueOrDefault(grandchild, state);
            stateGrandchildren[grandchild] = string.Equals(previous, state, StringComparison.OrdinalIgnoreCase)
                ? state
                : "mixed";
        }

        public long Total => _sizes.Values.SelectMany(item => item.Values).SelectMany(item => item.Values).Sum();

        public List<StorageCategoryNode> Build(long usedBytes, bool scanComplete = true)
        {
            var result = new List<StorageCategoryNode>
            {
                BuildCategory("games", "Jogos", new[]
                {
                    ("stores", "Lojas"), ("emulators", "ROMs e emuladores"),
                    ("watched", "Pastas vigiadas"), ("manual", "Adicionados manualmente")
                }),
                BuildCategory("applications", "Aplicativos", new[]
                {
                    ("web", "Web"), ("executables", "Executáveis")
                }),
                BuildCategory("doorpi", "Doorpi", new[]
                {
                    ("users", "Dados dos usuários"), ("core", "Doorpi"), ("artwork", "Artes usadas no sistema")
                })
            };

            StorageCategoryNode windows = BuildCategory("windows", "Windows e sistema", new[] { ("system", "Sistema") });
            if (windows.SizeBytes == 0 && windows.State.Equals("calculated", StringComparison.OrdinalIgnoreCase))
                windows.State = scanComplete ? "unavailable" : "pending";
            result.Add(windows);

            long known = Math.Min(Math.Max(0, usedBytes), result.Sum(item => item.SizeBytes));
            result.Add(new StorageCategoryNode
            {
                Key = "other",
                Label = "Outros arquivos",
                SizeBytes = scanComplete ? Math.Max(0, usedBytes - known) : 0,
                State = scanComplete ? "residual" : "pending"
            });
            return result;
        }

        private StorageCategoryNode BuildCategory(
            string key,
            string label,
            IReadOnlyList<(string Key, string Label)> childDefinitions)
        {
            var node = new StorageCategoryNode { Key = key, Label = label };
            foreach (var definition in childDefinitions)
            {
                var child = new StorageCategoryNode { Key = definition.Key, Label = definition.Label };
                if (_sizes.TryGetValue(key, out var children) && children.TryGetValue(definition.Key, out var values))
                {
                    foreach (var value in values.Where(item => !item.Key.Equals("total", StringComparison.OrdinalIgnoreCase)))
                    {
                        child.Children.Add(new StorageCategoryNode
                        {
                            Key = value.Key,
                            Label = _labels.GetValueOrDefault($"{key}|{definition.Key}|{value.Key}", StorageSourceLabel(value.Key)),
                            SizeBytes = value.Value,
                            State = StateFor(key, definition.Key, value.Key)
                        });
                    }
                    child.SizeBytes = values.Values.Sum();
                    IEnumerable<string> states = child.Children.Select(item => item.State);
                    if (values.ContainsKey("total"))
                        states = states.Append(StateFor(key, definition.Key, "total"));
                    child.State = MergeStates(states);
                }
                if (_sizes.TryGetValue(key, out var availableChildren) && availableChildren.ContainsKey(definition.Key))
                    node.Children.Add(child);
            }
            node.SizeBytes = node.Children.Sum(item => item.SizeBytes);
            node.State = MergeStates(node.Children
                .Where(item => item.SizeBytes > 0 || !item.State.Equals("calculated", StringComparison.OrdinalIgnoreCase))
                .Select(item => item.State));
            return node;
        }

        private string StateFor(string category, string child, string grandchild)
            => _states.TryGetValue(category, out var children) &&
               children.TryGetValue(child, out var grandchildren) &&
               grandchildren.TryGetValue(grandchild, out string? state)
                ? state
                : "calculated";

        private static string MergeStates(IEnumerable<string> states)
        {
            string[] values = states.Where(value => !string.IsNullOrWhiteSpace(value)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            return values.Length switch { 0 => "calculated", 1 => values[0], _ => "mixed" };
        }
    }

    private void RequestStorageStatus(bool forceRefresh)
    {
        List<StorageDriveSnapshot> drives = GetStorageDrives();
        StorageCacheDocument? cache = LoadStorageCache();
        bool refreshRunning = _storageRefreshLock.CurrentCount == 0;
        PostStorageSnapshot(drives, cache, calculating: refreshRunning);
        if (refreshRunning) return;

        bool stale = cache == null || cache.Version != StorageCacheVersion ||
                     !cache.IsComplete ||
                     DateTime.UtcNow - cache.ScannedAtUtc > StorageCacheLifetime ||
                     !string.Equals(cache.InventoryFingerprint, BuildStorageInventoryFingerprint(), StringComparison.Ordinal);
        if (forceRefresh || stale)
            _ = Task.Run(() => RefreshStorageStatusAsync(drives, forceRefresh));
    }

    private async Task RefreshStorageStatusAsync(List<StorageDriveSnapshot> drives, bool forceRefresh)
    {
        if (!await _storageRefreshLock.WaitAsync(0).ConfigureAwait(false)) return;
        var scanCts = new CancellationTokenSource();
        Interlocked.Exchange(ref _storageScanCts, scanCts)?.Dispose();
        try
        {
            StorageCacheDocument? previousCache = LoadStorageCache();
            PostStorageSnapshot(drives, previousCache, calculating: true);
            var roots = BuildStorageScanRoots();
            PrepareStorageRootExclusions(roots);
            var reportedStoreSizes = GetStoreReportedSizes();
            string fingerprint = BuildStorageInventoryFingerprint();
            bool resumeIncomplete = !forceRefresh &&
                                    previousCache?.Version == StorageCacheVersion &&
                                    previousCache.IsComplete == false &&
                                    string.Equals(previousCache.InventoryFingerprint, fingerprint, StringComparison.Ordinal);
            var rootResults = (resumeIncomplete ? previousCache!.Roots : new List<StorageRootCacheEntry>())
                .ToDictionary(item => item.Id, StringComparer.OrdinalIgnoreCase);
            HashSet<string> currentRootIds = roots.Select(StorageRootId).ToHashSet(StringComparer.OrdinalIgnoreCase);
            foreach (string obsoleteId in rootResults.Keys.Where(id => !currentRootIds.Contains(id)).ToArray())
                rootResults.Remove(obsoleteId);

            List<StorageScanRoot> orderedRoots = roots
                .OrderBy(item => Directory.Exists(item.Path) ? 1 : 0)
                .ThenBy(item => StorageScanPriority(item.Category, item.Child))
                .ThenBy(item => item.ItemLabel, StringComparer.CurrentCultureIgnoreCase)
                .ToList();
            int totalRoots = orderedRoots.Count;
            int completedRoots = rootResults.Count;

            foreach (StorageScanRoot root in orderedRoots)
            {
                string rootId = StorageRootId(root);
                if (rootResults.ContainsKey(rootId)) continue;
                scanCts.Token.ThrowIfCancellationRequested();

                long bytes;
                string state;
                if (File.Exists(root.Path))
                {
                    bytes = SafeFileLength(root.Path);
                    state = root.ResultState;
                }
                else if (root.Category.Equals("games", StringComparison.OrdinalIgnoreCase) &&
                         root.Child.Equals("stores", StringComparison.OrdinalIgnoreCase))
                {
                    bytes = FindReportedStoreSize(root.Path, reportedStoreSizes);
                    if (bytes > 0)
                    {
                        state = "informed";
                    }
                    else
                    {
                        StorageScanResult result = await ScanStorageRootWithProgressAsync(
                            root,
                            rootId,
                            rootResults,
                            drives,
                            fingerprint,
                            completedRoots,
                            totalRoots,
                            scanCts.Token).ConfigureAwait(false);
                        bytes = result.Bytes;
                        state = result.Complete ? root.ResultState : "partial";
                    }
                }
                else
                {
                    StorageScanResult result = await ScanStorageRootWithProgressAsync(
                        root,
                        rootId,
                        rootResults,
                        drives,
                        fingerprint,
                        completedRoots,
                        totalRoots,
                        scanCts.Token).ConfigureAwait(false);
                    bytes = result.Bytes;
                    state = result.Complete ? root.ResultState : "partial";
                }

                rootResults[rootId] = StorageRootResult(root, rootId, bytes, state);
                completedRoots++;
                StorageCacheDocument partial = BuildStorageDocument(
                    drives,
                    rootResults.Values,
                    fingerprint,
                    isComplete: false,
                    completedRoots,
                    totalRoots,
                    $"Concluído: {StorageProgressLabel(root)}");
                SaveStorageCache(partial);
                PostStorageSnapshot(drives, partial, calculating: true);
            }

            StorageCacheDocument document = BuildStorageDocument(
                GetStorageDrives(),
                rootResults.Values,
                fingerprint,
                isComplete: true,
                totalRoots,
                totalRoots,
                "Análise concluída");
            SaveStorageCache(document);
            PostStorageSnapshot(GetStorageDrives(), document, calculating: false);
        }
        catch (OperationCanceledException)
        {
            Debug.WriteLine("[Storage] Análise pausada para liberar o disco.");
            PostStorageSnapshot(GetStorageDrives(), LoadStorageCache(), calculating: false);
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Storage] Falha na atualização: " + ex.Message);
            PostStorageSnapshot(GetStorageDrives(), LoadStorageCache(), calculating: false, error: ex.Message);
        }
        finally
        {
            if (ReferenceEquals(Interlocked.CompareExchange(ref _storageScanCts, null, scanCts), scanCts))
                scanCts.Dispose();
            _storageRefreshLock.Release();
        }
    }

    private void CancelStorageRefreshForLaunch()
    {
        try { Volatile.Read(ref _storageScanCts)?.Cancel(); } catch { }
    }

    private List<StorageScanRoot> BuildStorageScanRoots()
    {
        var roots = new List<StorageScanRoot>();
        AddStorageRoot(roots, DoorpiPaths.InstallFolder, "doorpi", "core");

        string usersRoot = Path.Combine(DoorpiPaths.DataFolder, "users");
        AddStorageRoot(roots, usersRoot, "doorpi", "users");
        AddStorageRoot(roots, Path.Combine(DoorpiPaths.DataFolder, "images"), "doorpi", "artwork");
        if (Directory.Exists(usersRoot))
        {
            foreach (string userRoot in SafeEnumerateDirectories(usersRoot, "*", SearchOption.TopDirectoryOnly))
                AddStorageRoot(roots, Path.Combine(userRoot, "trailers"), "doorpi", "artwork");
        }

        List<string> watched = GetWatchedFolderPaths()
            .Select(NormalizeStoragePath)
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .ToList();
        foreach (GameModel game in LoadAllStorageGames())
        {
            if (!string.IsNullOrWhiteSpace(game.EmulatorId))
            {
                foreach (string file in game.EmulatorDiscPaths.Append(game.RomPath)
                             .Where(path => File.Exists(path) || Directory.Exists(path))
                             .Distinct(StringComparer.OrdinalIgnoreCase))
                {
                    AddStorageRoot(
                        roots,
                        file,
                        "games",
                        "emulators",
                        StorageItemKey("rom-" + game.Name, file),
                        $"ROM · {game.Name}");
                }
                continue;
            }

            string path = ResolveGameStoragePath(game);
            if (string.IsNullOrWhiteSpace(path)) continue;
            if (IsStoreSource(game.Source) || IsPlatformManagedLaunchUrl(game.LaunchUrl))
                AddStorageRoot(
                    roots,
                    path,
                    "games",
                    "stores",
                    StorageItemKey(game.Name, path),
                    $"{StorageSourceLabel(NormalizeStorageSource(game.Source, game.LaunchUrl))} · {game.Name}");
            else if (watched.Any(item => string.Equals(path, item, StringComparison.OrdinalIgnoreCase) || IsPathWithin(path, item)))
                continue; // A pasta vigiada inteira já representa esses jogos sem duplicação.
            else
                AddStorageRoot(roots, path, "games", "manual", StorageItemKey(game.Name, path), game.Name);
        }

        foreach (string watchedRoot in watched)
            AddWatchedStorageRoots(roots, watchedRoot);

        foreach (EmulatorConfigModel emulator in LoadAllStorageEmulators())
        {
            string executable = NormalizeStoragePath(emulator.ExecutablePath);
            if (!File.Exists(executable)) continue;
            string emulatorRoot = Path.GetDirectoryName(executable) ?? executable;
            string name = string.IsNullOrWhiteSpace(emulator.Name) ? Path.GetFileNameWithoutExtension(executable) : emulator.Name;
            AddStorageRoot(
                roots,
                emulatorRoot,
                "games",
                "emulators",
                StorageItemKey("emulator-" + name, emulatorRoot),
                $"Emulador · {name}");
        }

        List<MediaAppModel> mediaApps = LoadUserProfiles()
            .SelectMany(profile => LoadMediaAppsForUser(profile.Id))
            .ToList();
        if (mediaApps.Count == 0) mediaApps = LoadMediaAppsForUser(currentUserId);
        AddWebApplicationStorageRoots(roots, mediaApps);
        List<InstalledProgramEntry> installedPrograms = EnumerateInstalledPrograms();
        foreach (MediaAppModel app in mediaApps)
        {
            string executable = LaunchCommand.ExecutablePathOrName(
                !string.IsNullOrWhiteSpace(app.LaunchCommand) ? app.LaunchCommand : app.Url);
            if (File.Exists(executable))
            {
                string installRoot = ResolveApplicationStorageRoot(executable, installedPrograms);
                AddStorageRoot(roots, installRoot, "applications", "executables", StorageItemKey(app.Name, installRoot), app.Name);
            }
        }

        string windowsRoot = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        AddWindowsStorageRoots(roots, windowsRoot);
        foreach ((string Path, string Label) systemFile in GetSystemStorageFiles(windowsRoot))
            AddStorageRoot(
                roots,
                systemFile.Path,
                "windows",
                "system",
                "windows",
                "Windows",
                progressLabel: systemFile.Label);

        return DeduplicateStorageRoots(roots);
    }

    private static void AddWindowsStorageRoots(ICollection<StorageScanRoot> roots, string windowsRoot)
    {
        bool found = false;
        try
        {
            foreach (string directory in Directory.EnumerateDirectories(windowsRoot, "*", SearchOption.TopDirectoryOnly))
            {
                string label = "Windows · " + Path.GetFileName(directory);
                AddStorageRoot(roots, directory, "windows", "system", "windows", "Windows", progressLabel: label);
                found = true;
            }
            foreach (string file in Directory.EnumerateFiles(windowsRoot, "*", SearchOption.TopDirectoryOnly))
            {
                string label = "Windows · " + Path.GetFileName(file);
                AddStorageRoot(roots, file, "windows", "system", "windows", "Windows", progressLabel: label);
                found = true;
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }

        if (!found)
            AddStorageRoot(roots, windowsRoot, "windows", "system", "windows", "Windows");
    }

    private static void AddWatchedStorageRoots(ICollection<StorageScanRoot> roots, string watchedRoot)
    {
        bool found = false;
        try
        {
            foreach (string directory in Directory.EnumerateDirectories(watchedRoot, "*", SearchOption.TopDirectoryOnly))
            {
                string label = Path.GetFileName(directory);
                AddStorageRoot(roots, directory, "games", "watched", StorageItemKey(label, directory), label);
                found = true;
            }
            foreach (string file in Directory.EnumerateFiles(watchedRoot, "*", SearchOption.TopDirectoryOnly))
            {
                string label = Path.GetFileName(file);
                AddStorageRoot(roots, file, "games", "watched", StorageItemKey(label, file), label);
                found = true;
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }

        if (!found)
        {
            string label = Path.GetFileName(watchedRoot);
            if (string.IsNullOrWhiteSpace(label)) label = watchedRoot;
            AddStorageRoot(roots, watchedRoot, "games", "watched", StorageItemKey(label, watchedRoot), label);
        }
    }

    private static string ResolveApplicationStorageRoot(
        string executable,
        IReadOnlyCollection<InstalledProgramEntry> installedPrograms)
    {
        string normalizedExecutable = NormalizeStoragePath(executable);
        string? registeredLocation = installedPrograms
            .Select(ResolveProgramLocation)
            .Where(location => !string.IsNullOrWhiteSpace(location) &&
                               (string.Equals(normalizedExecutable, location, StringComparison.OrdinalIgnoreCase) ||
                                IsPathWithin(normalizedExecutable, location)))
            .OrderByDescending(location => location.Length)
            .FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(registeredLocation)) return registeredLocation;

        string directory = Path.GetDirectoryName(normalizedExecutable) ?? normalizedExecutable;
        DirectoryInfo? info = Directory.GetParent(directory);
        if (Path.GetFileName(directory).StartsWith("app-", StringComparison.OrdinalIgnoreCase) &&
            info != null && File.Exists(Path.Combine(info.FullName, "Update.exe")))
            return info.FullName;
        return directory;
    }

    private List<EmulatorConfigModel> LoadAllStorageEmulators()
    {
        var result = new List<EmulatorConfigModel>();
        foreach (UserProfile profile in LoadUserProfiles())
        {
            string path = Path.Combine(DoorpiPaths.DataFolder, "users", profile.Id, "emulators.json");
            try
            {
                if (File.Exists(path))
                    result.AddRange(JsonSerializer.Deserialize<List<EmulatorConfigModel>>(SafeReadAllText(path)) ?? new());
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { }
        }
        if (result.Count == 0) result.AddRange(LoadEmulatorConfigs());
        return result
            .Where(item => !string.IsNullOrWhiteSpace(item.ExecutablePath))
            .GroupBy(item => NormalizeStoragePath(item.ExecutablePath), StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToList();
    }

    private static void AddWebApplicationStorageRoots(
        ICollection<StorageScanRoot> roots,
        IReadOnlyCollection<MediaAppModel> mediaApps)
    {
        var names = mediaApps
            .Where(app => !string.IsNullOrWhiteSpace(app.Id))
            .GroupBy(app => app.Id, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().Name, StringComparer.OrdinalIgnoreCase);
        string indexPath = Path.Combine(DoorpiPaths.BrowserProfilesFolder, "profiles-v2.json");
        try
        {
            if (File.Exists(indexPath))
            {
                using JsonDocument document = JsonDocument.Parse(File.ReadAllText(indexPath));
                foreach (JsonElement profile in document.RootElement.EnumerateArray())
                {
                    string profileName = profile.TryGetProperty("ProfileName", out JsonElement profileElement)
                        ? profileElement.GetString() ?? ""
                        : "";
                    string appKey = profile.TryGetProperty("AppKey", out JsonElement appElement)
                        ? appElement.GetString() ?? ""
                        : "";
                    string environmentKind = profile.TryGetProperty("EnvironmentKind", out JsonElement environmentElement)
                        ? environmentElement.GetString() ?? "webapps"
                        : "webapps";
                    if (string.IsNullOrWhiteSpace(profileName)) continue;
                    string profilePath = Path.Combine(
                        DoorpiPaths.BrowserProfilesFolder,
                        environmentKind,
                        "EBWebView",
                        "WV2Profile_" + profileName);
                    string label = names.GetValueOrDefault(appKey,
                        appKey.Equals("doorpi-browser", StringComparison.OrdinalIgnoreCase)
                            ? "Navegador Doorpi"
                            : appKey);
                    AddStorageRoot(
                        roots,
                        profilePath,
                        "applications",
                        "web",
                        StorageItemKey(appKey, profilePath),
                        string.IsNullOrWhiteSpace(label) ? "Aplicativo Web" : label);
                }
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { }

        foreach (string environmentRoot in SafeEnumerateDirectories(
                     DoorpiPaths.BrowserProfilesFolder,
                     "*",
                     SearchOption.TopDirectoryOnly))
        {
            string webViewRoot = Path.Combine(environmentRoot, "EBWebView");
            if (!Directory.Exists(webViewRoot)) continue;
            string environmentName = Path.GetFileName(environmentRoot);
            AddStorageRoot(
                roots,
                webViewRoot,
                "applications",
                "web",
                StorageItemKey("shared-" + environmentName, webViewRoot),
                $"Componentes compartilhados · {environmentName}");
        }
    }

    private static IEnumerable<(string Path, string Label)> GetSystemStorageFiles(string windowsRoot)
    {
        string systemDrive = StorageDriveRoot(windowsRoot);
        foreach (string name in new[] { "pagefile.sys", "hiberfil.sys", "swapfile.sys" })
            yield return (Path.Combine(systemDrive, name), name);

        using RegistryKey? memory = Registry.LocalMachine.OpenSubKey(
            @"SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management");
        if (memory?.GetValue("PagingFiles") is string[] pagingFiles)
        {
            foreach (string entry in pagingFiles)
            {
                string path = entry.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "";
                if (!string.IsNullOrWhiteSpace(path)) yield return (path, Path.GetFileName(path));
            }
        }
    }

    private List<GameModel> LoadAllStorageGames()
    {
        var games = new List<GameModel>();
        foreach (UserProfile profile in LoadUserProfiles())
        {
            string path = Path.Combine(DoorpiPaths.DataFolder, "users", profile.Id, "games.json");
            try
            {
                if (!File.Exists(path)) continue;
                games.AddRange(JsonSerializer.Deserialize<List<GameModel>>(SafeReadAllText(path)) ?? new());
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { }
        }
        return games.Count > 0 ? games : LoadGames();
    }

    private string BuildStorageInventoryFingerprint()
    {
        var values = new List<string>();
        foreach (string name in new[] { "games.json", "media.json", "folders.json" })
        {
            string file = Path.Combine(DoorpiPaths.DataFolder, name);
            try
            {
                if (!File.Exists(file)) continue;
                var info = new FileInfo(file);
                values.Add($"{file}|{info.Length}|{info.LastWriteTimeUtc.Ticks}");
            }
            catch { }
        }
        string browserIndex = Path.Combine(DoorpiPaths.BrowserProfilesFolder, "profiles-v2.json");
        try
        {
            if (File.Exists(browserIndex))
            {
                var info = new FileInfo(browserIndex);
                values.Add($"{browserIndex}|{info.Length}|{info.LastWriteTimeUtc.Ticks}");
            }
        }
        catch { }
        string usersRoot = Path.Combine(DoorpiPaths.DataFolder, "users");
        if (Directory.Exists(usersRoot))
        {
            foreach (string file in SafeEnumerateFiles(usersRoot, new[] { "games.json", "media.json", "folders.json", "emulators.json" }))
            {
                try
                {
                    var info = new FileInfo(file);
                    values.Add($"{file}|{info.Length}|{info.LastWriteTimeUtc.Ticks}");
                }
                catch { }
            }
        }
        try { values.AddRange(GetWindowsRegistryFingerprint()); } catch { }
        try { values.AddRange(GetSteamFingerprint().Select(value => "steam|" + value)); } catch { }
        try { values.AddRange(GetEpicFingerprint().Select(value => "epic|" + value)); } catch { }
        try { values.AddRange(GetGogFingerprint().Select(value => "gog|" + value)); } catch { }
        try { values.AddRange(GetRiotFingerprint().Select(value => "riot|" + value)); } catch { }
        try { values.AddRange(GetXboxFingerprint().Select(value => "xbox|" + value)); } catch { }
        values.Sort(StringComparer.OrdinalIgnoreCase);
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(string.Join('\n', values)));
        return Convert.ToHexString(hash);
    }

    private static IEnumerable<string> SafeEnumerateFiles(string root, IReadOnlyCollection<string> names)
    {
        try
        {
            var files = new List<string>();
            foreach (string name in names)
            {
                string rootFile = Path.Combine(root, name);
                if (File.Exists(rootFile)) files.Add(rootFile);
            }
            foreach (string userRoot in Directory.EnumerateDirectories(root, "*", SearchOption.TopDirectoryOnly))
            foreach (string name in names)
            {
                string userFile = Path.Combine(userRoot, name);
                if (File.Exists(userFile)) files.Add(userFile);
            }
            return files;
        }
        catch { return Array.Empty<string>(); }
    }

    private static List<StorageScanRoot> DeduplicateStorageRoots(List<StorageScanRoot> roots)
    {
        var result = new List<StorageScanRoot>();
        foreach (StorageScanRoot root in roots
                     .Where(item => File.Exists(item.Path) || Directory.Exists(item.Path))
                     .OrderBy(item => item.Path.Length))
        {
            StorageScanRoot? exact = result.FirstOrDefault(item =>
                string.Equals(item.Path, root.Path, StringComparison.OrdinalIgnoreCase));
            if (exact != null) continue;

            StorageScanRoot? sameOwnerParent = result.FirstOrDefault(item =>
                string.Equals(item.Category, root.Category, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(item.Child, root.Child, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(item.Grandchild, root.Grandchild, StringComparison.OrdinalIgnoreCase) &&
                IsPathWithin(root.Path, item.Path));
            if (sameOwnerParent != null) continue;
            result.Add(root);
        }
        return result;
    }

    private static void PrepareStorageRootExclusions(List<StorageScanRoot> roots)
    {
        foreach (StorageScanRoot parent in roots.Where(item => Directory.Exists(item.Path)))
        {
            foreach (StorageScanRoot child in roots)
            {
                if (ReferenceEquals(parent, child) || !IsPathWithin(child.Path, parent.Path)) continue;
                if (string.Equals(parent.Category, child.Category, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(parent.Child, child.Child, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(parent.Grandchild, child.Grandchild, StringComparison.OrdinalIgnoreCase)) continue;
                parent.ExcludedRoots.Add(child.Path);
            }
        }
    }

    private static async Task<StorageScanResult> CalculateStoragePathSizeAsync(
        string path,
        IReadOnlyCollection<string> excludedRoots,
        CancellationToken cancellationToken,
        Action<long, int>? progress = null)
    {
        if (File.Exists(path))
        {
            return new StorageScanResult(SafeFileLength(path), complete: true, visited: 1);
        }
        if (!Directory.Exists(path)) return new StorageScanResult(0, complete: true, visited: 0);

        long total = 0;
        int visited = 0;
        bool complete = true;
        long lastProgress = Stopwatch.GetTimestamp();
        string[] normalizedExclusions = excludedRoots
            .Select(NormalizeStoragePath)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToArray();
        var pending = new Stack<string>();
        pending.Push(path);
        while (pending.Count > 0)
        {
            cancellationToken.ThrowIfCancellationRequested();
            string current = pending.Pop();
            if (IsStoragePathExcluded(current, normalizedExclusions)) continue;

            IEnumerable<string> entries;
            try { entries = Directory.EnumerateFileSystemEntries(current); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                complete = false;
                continue;
            }

            try
            {
                foreach (string entry in entries)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    if (IsStoragePathExcluded(entry, normalizedExclusions)) continue;
                    try
                    {
                        var attributes = File.GetAttributes(entry);
                        if ((attributes & FileAttributes.ReparsePoint) != 0) continue;
                        if ((attributes & FileAttributes.Directory) != 0) pending.Push(entry);
                        else total = checked(total + new FileInfo(entry).Length);
                    }
                    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or OverflowException)
                    {
                        complete = false;
                    }

                    if (++visited % 512 == 0)
                    {
                        long now = Stopwatch.GetTimestamp();
                        if (now - lastProgress >= Stopwatch.Frequency / 2)
                        {
                            progress?.Invoke(total, visited);
                            lastProgress = now;
                        }
                        await Task.Yield();
                    }
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                complete = false;
            }
        }
        progress?.Invoke(total, visited);
        return new StorageScanResult(total, complete, visited);
    }

    private static bool IsStoragePathExcluded(string candidate, IReadOnlyCollection<string> exclusions)
    {
        foreach (string excluded in exclusions)
        {
            if (string.Equals(candidate, excluded, StringComparison.OrdinalIgnoreCase) ||
                candidate.StartsWith(excluded + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private async Task<StorageScanResult> ScanStorageRootWithProgressAsync(
        StorageScanRoot root,
        string rootId,
        IDictionary<string, StorageRootCacheEntry> rootResults,
        IReadOnlyCollection<StorageDriveSnapshot> drives,
        string fingerprint,
        int completedRoots,
        int totalRoots,
        CancellationToken cancellationToken)
    {
        string label = StorageProgressLabel(root);
        return await CalculateStoragePathSizeAsync(
            root.Path,
            root.ExcludedRoots,
            cancellationToken,
            (bytes, visited) =>
            {
                rootResults[rootId] = StorageRootResult(root, rootId, bytes, "partial");
                StorageCacheDocument progressDocument = BuildStorageDocument(
                    drives,
                    rootResults.Values,
                    fingerprint,
                    isComplete: false,
                    completedRoots,
                    totalRoots,
                    $"{label} · {visited:N0} itens");
                PostStorageSnapshot(drives, progressDocument, calculating: true);
            }).ConfigureAwait(false);
    }

    private static string StorageProgressLabel(StorageScanRoot root)
        => !string.IsNullOrWhiteSpace(root.ProgressLabel)
            ? root.ProgressLabel
            : !string.IsNullOrWhiteSpace(root.ItemLabel)
            ? root.ItemLabel
            : !string.IsNullOrWhiteSpace(root.Path)
                ? Path.GetFileName(root.Path.TrimEnd(Path.DirectorySeparatorChar))
                : root.Category;

    private static string StorageRootId(StorageScanRoot root)
    {
        string identity = string.Join('|', new[]
        {
            NormalizeStoragePath(root.Path), root.Category, root.Child, root.Grandchild
        });
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity)))[..24];
    }

    private static StorageRootCacheEntry StorageRootResult(
        StorageScanRoot root,
        string rootId,
        long bytes,
        string state)
        => new()
        {
            Id = rootId,
            Path = root.Path,
            Category = root.Category,
            Child = root.Child,
            Grandchild = root.Grandchild,
            ItemLabel = root.ItemLabel,
            SizeBytes = Math.Max(0, bytes),
            State = state
        };

    private static StorageCacheDocument BuildStorageDocument(
        IReadOnlyCollection<StorageDriveSnapshot> drives,
        IEnumerable<StorageRootCacheEntry> rootResults,
        string fingerprint,
        bool isComplete,
        int progressCurrent,
        int progressTotal,
        string progressLabel)
    {
        var aggregations = drives.ToDictionary(
            drive => drive.Root,
            _ => new StorageAggregation(),
            StringComparer.OrdinalIgnoreCase);
        var entries = rootResults.ToList();
        foreach (StorageRootCacheEntry entry in entries)
        {
            string driveRoot = StorageDriveRoot(entry.Path);
            if (aggregations.TryGetValue(driveRoot, out StorageAggregation? aggregation))
                aggregation.Add(entry.Category, entry.Child, entry.Grandchild, entry.SizeBytes, entry.State, entry.ItemLabel);
        }
        foreach (StorageDriveSnapshot drive in drives.Where(item => item.ReservedBytes > 0))
        {
            aggregations[drive.Root].Add(
                "windows",
                "system",
                "reserved",
                drive.ReservedBytes,
                "informed",
                "Reservado pelo sistema");
        }

        var document = new StorageCacheDocument
        {
            ScannedAtUtc = DateTime.UtcNow,
            InventoryFingerprint = fingerprint,
            IsComplete = isComplete,
            ProgressCurrent = progressCurrent,
            ProgressTotal = progressTotal,
            ProgressLabel = progressLabel,
            Roots = entries
        };
        foreach (StorageDriveSnapshot drive in drives)
        {
            document.Volumes.Add(new StorageVolumeCategories
            {
                Root = drive.Root,
                Categories = aggregations[drive.Root].Build(drive.UsedBytes, isComplete)
            });
        }
        return document;
    }

    private static long SafeFileLength(string path)
    {
        try { return Math.Max(0, new FileInfo(path).Length); }
        catch { return 0; }
    }

    private static long FindReportedStoreSize(
        string path,
        IReadOnlyDictionary<string, long> storeSizes)
        => storeSizes
            .Where(item => PathsOverlap(path, item.Key))
            .Select(item => item.Value)
            .DefaultIfEmpty(0)
            .Max();

    private static Dictionary<string, long> GetStoreReportedSizes()
    {
        var result = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        AddSteamReportedSizes(result);
        AddEpicReportedSizes(result);
        return result;
    }

    private static void AddSteamReportedSizes(IDictionary<string, long> result)
    {
        try
        {
            using RegistryKey? key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Valve\Steam")
                                     ?? Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Valve\Steam");
            string steamPath = NormalizeStoragePath(key?.GetValue("InstallPath") as string);
            if (string.IsNullOrWhiteSpace(steamPath)) return;

            var libraries = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { steamPath };
            string configPath = Path.Combine(steamPath, "steamapps", "libraryfolders.vdf");
            if (File.Exists(configPath))
            {
                string config = File.ReadAllText(configPath);
                foreach (Match match in Regex.Matches(config, @"""path""\s+""([^""]+)"""))
                {
                    string library = NormalizeStoragePath(match.Groups[1].Value.Replace(@"\\", @"\"));
                    if (!string.IsNullOrWhiteSpace(library)) libraries.Add(library);
                }
            }

            foreach (string library in libraries)
            {
                string steamApps = Path.Combine(library, "steamapps");
                if (!Directory.Exists(steamApps)) continue;
                foreach (string manifest in Directory.EnumerateFiles(steamApps, "appmanifest_*.acf", SearchOption.TopDirectoryOnly))
                {
                    try
                    {
                        string content = File.ReadAllText(manifest);
                        string installDir = Regex.Match(content, @"""installdir""\s+""([^""]+)""").Groups[1].Value;
                        string sizeText = Regex.Match(content, @"""SizeOnDisk""\s+""(\d+)""", RegexOptions.IgnoreCase).Groups[1].Value;
                        if (!long.TryParse(sizeText, out long bytes) || bytes <= 0 || string.IsNullOrWhiteSpace(installDir)) continue;
                        AddReportedStorageSize(result, Path.Combine(steamApps, "common", installDir), bytes);
                    }
                    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
                }
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Security.SecurityException) { }
    }

    private static void AddEpicReportedSizes(IDictionary<string, long> result)
    {
        try
        {
            string manifestRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "Epic", "EpicGamesLauncher", "Data", "Manifests");
            if (!Directory.Exists(manifestRoot)) return;
            foreach (string manifest in Directory.EnumerateFiles(manifestRoot, "*.item", SearchOption.TopDirectoryOnly))
            {
                try
                {
                    using JsonDocument document = JsonDocument.Parse(File.ReadAllText(manifest));
                    JsonElement root = document.RootElement;
                    string location = root.TryGetProperty("InstallLocation", out JsonElement locationElement)
                        ? locationElement.GetString() ?? ""
                        : "";
                    long bytes = ReadJsonInt64(root, "InstallSize");
                    if (bytes <= 0) bytes = ReadJsonInt64(root, "InstallSizeBytes");
                    if (bytes > 0) AddReportedStorageSize(result, location, bytes);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { }
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }

    private static long ReadJsonInt64(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out JsonElement element)) return 0;
        if (element.ValueKind == JsonValueKind.Number && element.TryGetInt64(out long number)) return Math.Max(0, number);
        return element.ValueKind == JsonValueKind.String && long.TryParse(element.GetString(), out number)
            ? Math.Max(0, number)
            : 0;
    }

    private static void AddReportedStorageSize(IDictionary<string, long> result, string path, long bytes)
    {
        string normalized = NormalizeStoragePath(path);
        if (string.IsNullOrWhiteSpace(normalized) || bytes <= 0) return;
        result[normalized] = Math.Max(result.TryGetValue(normalized, out long current) ? current : 0, bytes);
    }

    private void RequestStoragePrograms()
    {
        _ = Task.Run(() =>
        {
            try { PostStoragePrograms(EnumerateInstalledPrograms()); }
            catch (Exception ex) { PostStoragePrograms(Array.Empty<InstalledProgramEntry>(), ex.Message); }
        });
    }

    private void UninstallStorageProgram(string programId)
    {
        if (string.IsNullOrWhiteSpace(programId)) return;

        long sessionToken;
        lock (_storageUninstallerSync)
        {
            if (!string.IsNullOrWhiteSpace(_activeStorageUninstallerProgramId))
            {
                if (string.Equals(_activeStorageUninstallerProgramId, programId, StringComparison.OrdinalIgnoreCase))
                    ReturnToStorageUninstaller(programId);
                else
                    PostStorageUninstallStatus(programId, "busy", "Conclua o desinstalador que já está aberto antes de remover outro programa.");
                return;
            }

            _activeStorageUninstallerProgramId = programId;
            _activeStorageUninstallerWindow = IntPtr.Zero;
            _activeStorageUninstallerProcessId = 0;
            _activeStorageUninstallerObservedProcessId = 0;
            _activeStorageUninstallerObservedProcessName = "";
            _activeStorageUninstallerProgramName = "";
            _activeStorageUninstallerWindowSnapshot.Clear();
            _storageUninstallerInputReady = false;
            sessionToken = ++_storageUninstallerSessionToken;
        }

        _ = Task.Run(async () =>
        {
            bool externalUninstallerModeEntered = false;
            try
            {
                InstalledProgramEntry? program = EnumerateInstalledPrograms()
                    .FirstOrDefault(item => string.Equals(item.Id, programId, StringComparison.OrdinalIgnoreCase));
                if (program == null) throw new InvalidOperationException("O programa não está mais listado pelo Windows.");
                if (!program.CanUninstall || string.IsNullOrWhiteSpace(program.UninstallString))
                    throw new InvalidOperationException("Este programa não fornece uma ação de desinstalação.");

                string command = NormalizeUninstallCommand(program.UninstallString);
                PostStorageUninstallStatus(program.Id, "preparing", "Solicitando a remoção ao Windows…");
                HashSet<IntPtr> windowSnapshot = SnapshotVisibleWindows();
                lock (_storageUninstallerSync)
                {
                    if (_storageUninstallerSessionToken == sessionToken)
                    {
                        _activeStorageUninstallerProgramName = program.Name;
                        _activeStorageUninstallerWindowSnapshot = new HashSet<IntPtr>(windowSnapshot);
                    }
                }
                Process? process = LaunchCommand.Start(command);
                if (process == null)
                    throw new InvalidOperationException("O Windows não iniciou o desinstalador.");
                lock (_storageUninstallerSync)
                {
                    if (_storageUninstallerSessionToken == sessionToken)
                        _activeStorageUninstallerProcessId = process.Id;
                }

                IntPtr uninstallerWindow = await WaitForStorageUninstallerWindowAsync(
                    windowSnapshot,
                    process,
                    program.Name,
                    sessionToken).ConfigureAwait(false);
                if (uninstallerWindow != IntPtr.Zero)
                {
                    RememberStorageUninstallerWindow(uninstallerWindow, sessionToken);
                    PostStorageUninstallStatus(program.Id, "preparing", "Desinstalador detectado. Preparando o controle…");

                    // Mesma ordem usada pelo fluxo de instalação de lojas: conclua
                    // a conexão elevada antes de iniciar o loop que envia input.
                    // Assim o primeiro movimento não dispara um segundo helper.
                    await StartElevatedInputBridgeAsync().ConfigureAwait(false);
                    await Task.Delay(1200).ConfigureAwait(false);

                    IntPtr focusWindow = uninstallerWindow;
                    bool originalWindowUsable = IsWindow(focusWindow) &&
                                                (IsWindowVisible(focusWindow) || IsIconic(focusWindow));
                    if (!originalWindowUsable)
                    {
                        IntPtr successor = FindStorageUninstallerSuccessorWindow();
                        if (successor != IntPtr.Zero) focusWindow = successor;
                    }
                    RememberStorageUninstallerWindow(focusWindow, sessionToken);
                    Dispatcher.Invoke(() =>
                    {
                        _mainUiOwnsDirectionalNavigation = false;
                        if (WindowState != System.Windows.WindowState.Maximized)
                            WindowState = System.Windows.WindowState.Maximized;
                        Show();
                        ReleaseDoorpiTopmost();
                        StartStorageUninstallerInputMode(centerCursor: false);
                        externalUninstallerModeEntered = true;
                    });
                    lock (_storageUninstallerSync)
                    {
                        if (_storageUninstallerSessionToken == sessionToken)
                            _storageUninstallerInputReady = true;
                    }
                    if (focusWindow != IntPtr.Zero)
                        Dispatcher.Invoke(() => FocusExternalWindow(focusWindow));
                    PostStorageUninstallStatus(program.Id, "started", "Desinstalador em primeiro plano. Se voltar ao Doorpi por engano, use Retornar.");
                }
                else
                {
                    PostStorageUninstallStatus(program.Id, "direct", "A remoção foi solicitada diretamente ao Windows; nenhuma janela de desinstalação foi aberta.");
                }

                await WaitForStorageUninstallerReturnAsync(
                    process,
                    uninstallerWindow,
                    program.Id,
                    sessionToken).ConfigureAwait(false);
                if (externalUninstallerModeEntered)
                    Dispatcher.Invoke(StopStorageUninstallerInputModeForDoorpiReturn);
                externalUninstallerModeEntered = false;
                await Task.Delay(uninstallerWindow == IntPtr.Zero ? 1200 : 450).ConfigureAwait(false);
                PostStoragePrograms(EnumerateInstalledPrograms());
                PostStorageUninstallStatus(program.Id, "returned", uninstallerWindow == IntPtr.Zero
                    ? "Lista atualizada após a solicitação de remoção."
                    : "Lista atualizada após o retorno ao Doorpi.");
            }
            catch (Exception ex)
            {
                if (externalUninstallerModeEntered)
                {
                    try { Dispatcher.Invoke(StopStorageUninstallerInputModeForDoorpiReturn); }
                    catch { }
                }
                PostStorageUninstallStatus(programId, "error", ex.Message);
            }
            finally
            {
                lock (_storageUninstallerSync)
                {
                    if (_storageUninstallerSessionToken == sessionToken)
                    {
                        _activeStorageUninstallerProgramId = "";
                        _activeStorageUninstallerWindow = IntPtr.Zero;
                        _activeStorageUninstallerProcessId = 0;
                        _activeStorageUninstallerObservedProcessId = 0;
                        _activeStorageUninstallerObservedProcessName = "";
                        _activeStorageUninstallerProgramName = "";
                        _activeStorageUninstallerWindowSnapshot.Clear();
                        _storageUninstallerInputReady = false;
                    }
                }
            }
        });
    }

    private void ReturnToStorageUninstaller(string programId)
    {
        IntPtr window;
        int processId;
        lock (_storageUninstallerSync)
        {
            if (!string.Equals(_activeStorageUninstallerProgramId, programId, StringComparison.OrdinalIgnoreCase))
            {
                PostStorageUninstallStatus(programId, "error", "O desinstalador não está mais aberto.");
                return;
            }
            window = _activeStorageUninstallerWindow;
            processId = _activeStorageUninstallerProcessId;
        }

        if ((window == IntPtr.Zero || !IsWindow(window)) && processId > 0)
        {
            try
            {
                using Process process = Process.GetProcessById(processId);
                process.Refresh();
                window = process.MainWindowHandle;
            }
            catch { window = IntPtr.Zero; }
        }

        if (window == IntPtr.Zero || !IsWindow(window))
            window = FindStorageUninstallerSuccessorWindow();

        if (window == IntPtr.Zero || !IsWindow(window))
        {
            PostStorageUninstallStatus(programId, "preparing", "A solicitação de remoção ainda está sendo processada.");
            return;
        }

        RememberStorageUninstallerWindow(window);

        Dispatcher.Invoke(() =>
        {
            if (WindowState != System.Windows.WindowState.Maximized)
                WindowState = System.Windows.WindowState.Maximized;
            Show();
            ReleaseDoorpiTopmost();
            EnsureCursorVisible();
            _mainScreenMouseVisible = true;
            StartStorageUninstallerInputMode(centerCursor: false);
            FocusExternalWindow(window);
        });
        PostStorageUninstallStatus(programId, "started", "Desinstalador trazido novamente para o primeiro plano.");
    }

    private bool TryFocusStorageUninstallerReturnOnDoorpiActivation()
    {
        string programId;
        IntPtr window;
        lock (_storageUninstallerSync)
        {
            programId = _activeStorageUninstallerProgramId;
            window = _activeStorageUninstallerWindow;
            if (!_storageUninstallerInputReady) return false;
        }
        if (string.IsNullOrWhiteSpace(programId) || window == IntPtr.Zero || !IsWindow(window)) return false;

        PauseStorageUninstallerInputModeForDoorpi();
        _mainUiOwnsDirectionalNavigation = true;

        webView?.Focus();
        System.Windows.Input.Keyboard.Focus(webView);
        if (webView?.CoreWebView2 != null)
        {
            string idJson = JsonSerializer.Serialize(programId);
            _ = webView.CoreWebView2.ExecuteScriptAsync(
                $"window.DoorpiQuickPanel?.focusStorageUninstallerReturn?.({idJson});" +
                $"window._navMenuFocusStorageUninstallerReturn?.({idJson});");
        }
        return true;
    }

    private bool IsStorageUninstallerSessionActive()
    {
        lock (_storageUninstallerSync)
            return !string.IsNullOrWhiteSpace(_activeStorageUninstallerProgramId);
    }

    private void StartStorageUninstallerInputMode(bool centerCursor)
    {
        if (_storageUninstallerInputActive && _storageUninstallerInputThread?.IsAlive == true)
        {
            EnsureCursorVisible();
            _mainScreenMouseVisible = true;
            return;
        }

        _storageUninstallerInputActive = true;
        EnsureCursorVisible();
        _mainScreenMouseVisible = true;
        if (centerCursor) CenterCursorOnScreen();
        UpdateHoverStateInWebView();

        _storageUninstallerInputThread = new Thread(() =>
            SharedGamepadControllerLoop(
                () => _storageUninstallerInputActive,
                () => { },
                handleXboxButton: false,
                shouldAcceptInput: () => true))
        {
            IsBackground = true
        };
        _storageUninstallerInputThread.Start();
    }

    private void PauseStorageUninstallerInputModeForDoorpi()
    {
        _storageUninstallerInputActive = false;
        EnsureCursorVisible();
        EnsureCursorHidden();
        _mainScreenMouseVisible = false;
        _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
        try { SetCursorPos(0, 0); } catch { }
    }

    private void StopStorageUninstallerInputModeForDoorpiReturn()
    {
        _storageUninstallerInputActive = false;
        StopElevatedInputBridge();
        _desktopVkb?.Close();
        _desktopVkb = null;
        EnsureCursorVisible();
        EnsureCursorHidden();
        _mainScreenMouseVisible = false;
        _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
        try { SetCursorPos(0, 0); } catch { }
        _mainUiOwnsDirectionalNavigation = true;
        if (WindowState != System.Windows.WindowState.Maximized)
            WindowState = System.Windows.WindowState.Maximized;
        Show();
        ReleaseDoorpiTopmost();
        Activate();
        ForceFocus();
    }

    private async Task<IntPtr> WaitForStorageUninstallerWindowAsync(
        IReadOnlySet<IntPtr> windowSnapshot,
        Process launchedProcess,
        string programName,
        long sessionToken)
    {
        DateTime deadline = DateTime.UtcNow.AddSeconds(12);
        int exitedChecks = 0;
        while (DateTime.UtcNow < deadline)
        {
            lock (_storageUninstallerSync)
            {
                if (_storageUninstallerSessionToken != sessionToken) return IntPtr.Zero;
            }
            IntPtr bestWindow = IntPtr.Zero;
            int bestScore = int.MinValue;
            IntPtr foreground = GetForegroundWindow();
            IntPtr shell = GetShellWindow();

            EnumWindows((hWnd, _) =>
            {
                if (hWnd == IntPtr.Zero || hWnd == shell || hWnd == _mainWindowHandle ||
                    windowSnapshot.Contains(hWnd) || !IsWindowVisible(hWnd) || IsIconic(hWnd))
                    return true;
                if (!GetWindowRect(hWnd, out RECT rect) || rect.Width < 160 || rect.Height < 100)
                    return true;

                try
                {
                    GetWindowProcessId(hWnd, out uint pidRaw);
                    int pid = (int)pidRaw;
                    if (pid <= 0 || pid == Environment.ProcessId) return true;

                    using Process candidate = Process.GetProcessById(pid);
                    string processName = SafeProcessName(candidate);
                    if (_shellProcessNames.Contains(processName)) return true;

                    string title = GetWindowTitle(hWnd);
                    int score = 40;
                    if (pid == launchedProcess.Id) score += 120;
                    if (hWnd == foreground) score += 45;
                    if (!string.IsNullOrWhiteSpace(title)) score += 12;
                    if (TextMatchesAppName($"{title} {processName}", programName)) score += 55;
                    score += Math.Min(25, Math.Max(0, rect.Width * rect.Height / 100_000));

                    if (score > bestScore)
                    {
                        bestScore = score;
                        bestWindow = hWnd;
                    }
                }
                catch { }
                return true;
            }, IntPtr.Zero);

            if (bestWindow != IntPtr.Zero) return bestWindow;
            if (SafeHasExited(launchedProcess))
            {
                if (++exitedChecks >= 8) return IntPtr.Zero;
            }
            else
            {
                exitedChecks = 0;
            }
            await Task.Delay(160).ConfigureAwait(false);
        }
        return IntPtr.Zero;
    }

    private void RememberStorageUninstallerWindow(IntPtr window, long? sessionToken = null)
    {
        if (window == IntPtr.Zero || !IsWindow(window)) return;
        int processId = 0;
        string processName = "";
        try
        {
            GetWindowProcessId(window, out uint pidRaw);
            processId = (int)pidRaw;
            if (processId > 0)
            {
                using Process process = Process.GetProcessById(processId);
                processName = SafeProcessName(process);
            }
        }
        catch { }

        lock (_storageUninstallerSync)
        {
            if (sessionToken.HasValue && _storageUninstallerSessionToken != sessionToken.Value) return;
            _activeStorageUninstallerWindow = window;
            if (processId > 0) _activeStorageUninstallerObservedProcessId = processId;
            if (!string.IsNullOrWhiteSpace(processName))
                _activeStorageUninstallerObservedProcessName = processName;
        }
        if (processId > 0 && IsElevatedInputBridgeConnected())
            MarkElevatedInputBridgeTarget(processId, window);
    }

    private IntPtr FindStorageUninstallerSuccessorWindow(IntPtr excludedWindow = default)
    {
        HashSet<IntPtr> snapshot;
        string programName;
        string observedProcessName;
        int launchedProcessId;
        int observedProcessId;
        lock (_storageUninstallerSync)
        {
            snapshot = new HashSet<IntPtr>(_activeStorageUninstallerWindowSnapshot);
            programName = _activeStorageUninstallerProgramName;
            observedProcessName = _activeStorageUninstallerObservedProcessName;
            launchedProcessId = _activeStorageUninstallerProcessId;
            observedProcessId = _activeStorageUninstallerObservedProcessId;
        }

        IntPtr bestWindow = IntPtr.Zero;
        int bestScore = int.MinValue;
        IntPtr foreground = GetForegroundWindow();
        IntPtr shell = GetShellWindow();
        EnumWindows((hWnd, _) =>
        {
            if (hWnd == IntPtr.Zero || hWnd == excludedWindow || hWnd == shell || hWnd == _mainWindowHandle ||
                snapshot.Contains(hWnd) || (!IsWindowVisible(hWnd) && !IsIconic(hWnd)))
                return true;
            try
            {
                GetWindowProcessId(hWnd, out uint pidRaw);
                int pid = (int)pidRaw;
                if (pid <= 0 || pid == Environment.ProcessId) return true;
                using Process candidate = Process.GetProcessById(pid);
                string processName = SafeProcessName(candidate);
                if (_shellProcessNames.Contains(processName) || IsDoorpiInternalName(processName)) return true;
                string title = GetWindowTitle(hWnd);
                string identity = $"{title} {processName}";
                bool sameProcess = pid == launchedProcessId || pid == observedProcessId;
                bool sameProcessName = !string.IsNullOrWhiteSpace(observedProcessName) &&
                                       string.Equals(processName, observedProcessName, StringComparison.OrdinalIgnoreCase);
                bool matchesProgram = TextMatchesAppName(identity, programName);
                bool looksLikeUninstaller = Regex.IsMatch(identity,
                    @"uninstall|unins|remove|removal|setup|maintenance|desinstal",
                    RegexOptions.IgnoreCase);
                if (!sameProcess && !sameProcessName && !matchesProgram && !(looksLikeUninstaller && hWnd == foreground))
                    return true;

                int score = 30;
                if (sameProcess) score += 150;
                if (sameProcessName) score += 100;
                if (matchesProgram) score += 90;
                if (looksLikeUninstaller) score += 55;
                if (hWnd == foreground) score += 35;
                if (score > bestScore)
                {
                    bestScore = score;
                    bestWindow = hWnd;
                }
            }
            catch { }
            return true;
        }, IntPtr.Zero);
        return bestWindow;
    }

    private async Task WaitForStorageUninstallerReturnAsync(
        Process launchedProcess,
        IntPtr observedWindow,
        string programId,
        long sessionToken)
    {
        int closedChecks = 0;
        while (true)
        {
            lock (_storageUninstallerSync)
            {
                if (_storageUninstallerSessionToken != sessionToken) return;
            }

            bool processAlive = !SafeHasExited(launchedProcess);
            bool windowAlive = observedWindow != IntPtr.Zero && IsWindow(observedWindow) &&
                               (IsWindowVisible(observedWindow) || IsIconic(observedWindow));
            if (!windowAlive && observedWindow != IntPtr.Zero)
            {
                IntPtr successor = FindStorageUninstallerSuccessorWindow(observedWindow);
                if (successor != IntPtr.Zero)
                {
                    observedWindow = successor;
                    RememberStorageUninstallerWindow(successor, sessionToken);
                    windowAlive = true;
                    closedChecks = 0;
                    Dispatcher.Invoke(() =>
                    {
                        StartStorageUninstallerInputMode(centerCursor: false);
                        FocusExternalWindow(successor);
                    });
                    PostStorageUninstallStatus(programId, "started", "A janela seguinte do desinstalador foi localizada e trazida para o primeiro plano.");
                }
            }
            if (!processAlive && !windowAlive)
            {
                bool programStillRegistered = IsStorageProgramRegistered(programId);
                // Instaladores como o Firefox encerram o launcher e recriam a
                // janela em outro processo. Se a entrada ainda existe, dê tempo
                // para esse handoff ocorrer. Se o Registro já foi limpo, bastam
                // algumas leituras para evitar atrasar a atualização da lista.
                int requiredClosedChecks = programStillRegistered ? 24 : 3;
                if (++closedChecks >= requiredClosedChecks) return;
            }
            else
            {
                closedChecks = 0;
            }

            await Task.Delay(350).ConfigureAwait(false);
        }
    }

    private static string NormalizeUninstallCommand(string command)
    {
        if (!LaunchCommand.TryParse(command, out LaunchCommandSpec? spec) || spec == null) return command;
        string name = Path.GetFileName(spec.FileName);
        if (!name.Equals("msiexec.exe", StringComparison.OrdinalIgnoreCase) &&
            !name.Equals("msiexec", StringComparison.OrdinalIgnoreCase)) return command;

        var arguments = spec.Arguments.ToList();
        for (int index = 0; index < arguments.Count; index++)
        {
            if (Regex.IsMatch(arguments[index], @"^/i(?=\{|$)", RegexOptions.IgnoreCase))
                arguments[index] = Regex.Replace(arguments[index], @"^/i", "/x", RegexOptions.IgnoreCase);
        }
        return QuoteCommandPart(spec.FileName) + " " + string.Join(" ", arguments.Select(QuoteCommandPart));
    }

    private static string QuoteCommandPart(string value)
        => value.Any(char.IsWhiteSpace) || value.Contains('"')
            ? "\"" + value.Replace("\"", "\\\"") + "\""
            : value;

    private List<InstalledProgramEntry> EnumerateInstalledPrograms()
    {
        var result = new List<InstalledProgramEntry>();
        string uninstallPath = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";
        foreach (RegistryHive hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
        foreach (RegistryView view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
        {
            try
            {
                using RegistryKey baseKey = RegistryKey.OpenBaseKey(hive, view);
                using RegistryKey? uninstall = baseKey.OpenSubKey(uninstallPath);
                if (uninstall == null) continue;
                foreach (string subKeyName in uninstall.GetSubKeyNames())
                {
                    try
                    {
                        using RegistryKey? key = uninstall.OpenSubKey(subKeyName);
                        if (key == null) continue;
                        string name = ReadRegistryString(key, "DisplayName");
                        string uninstallString = ReadRegistryString(key, "UninstallString");
                        if (string.IsNullOrWhiteSpace(name) || ConvertRegistryInt(key.GetValue("SystemComponent")) == 1) continue;
                        if (!string.IsNullOrWhiteSpace(ReadRegistryString(key, "ParentKeyName"))) continue;
                        string releaseType = ReadRegistryString(key, "ReleaseType");
                        if (releaseType.Contains("Update", StringComparison.OrdinalIgnoreCase) ||
                            releaseType.Contains("Hotfix", StringComparison.OrdinalIgnoreCase)) continue;

                        long estimatedKb = Math.Max(0, ConvertRegistryLong(key.GetValue("EstimatedSize")));
                        string identity = StorageProgramRegistryIdentity(hive, view, uninstallPath, subKeyName);
                        string displayIcon = ReadRegistryString(key, "DisplayIcon");
                        string installLocation = NormalizeStoragePath(ReadRegistryString(key, "InstallLocation"));
                        string iconPath = ResolveProgramIconPath(displayIcon, installLocation, uninstallString);
                        result.Add(new InstalledProgramEntry
                        {
                            Id = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity)))[..24],
                            Name = name.Trim(),
                            Version = ReadRegistryString(key, "DisplayVersion"),
                            Publisher = ReadRegistryString(key, "Publisher"),
                            InstallLocation = installLocation,
                            DisplayIcon = displayIcon,
                            IconBase64 = GetCachedIcon(iconPath),
                            UninstallString = uninstallString,
                            QuietUninstallString = ReadRegistryString(key, "QuietUninstallString"),
                            EstimatedSizeBytes = estimatedKb > long.MaxValue / 1024 ? long.MaxValue : estimatedKb * 1024,
                            CanUninstall = !string.IsNullOrWhiteSpace(uninstallString) && ConvertRegistryInt(key.GetValue("NoRemove")) != 1
                        });
                    }
                    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Security.SecurityException) { }
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Security.SecurityException) { }
        }

        return result
            .GroupBy(item => $"{item.Name}|{item.Version}|{item.Publisher}", StringComparer.OrdinalIgnoreCase)
            .Select(group => group.OrderByDescending(item => item.CanUninstall)
                .ThenByDescending(item => item.EstimatedSizeBytes)
                .First())
            .OrderBy(item => item.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    private static bool IsStorageProgramRegistered(string programId)
    {
        if (string.IsNullOrWhiteSpace(programId)) return false;

        const string uninstallPath = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";
        foreach (RegistryHive hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
        foreach (RegistryView view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
        {
            try
            {
                using RegistryKey baseKey = RegistryKey.OpenBaseKey(hive, view);
                using RegistryKey? uninstall = baseKey.OpenSubKey(uninstallPath);
                if (uninstall == null) continue;
                foreach (string subKeyName in uninstall.GetSubKeyNames())
                {
                    string identity = StorageProgramRegistryIdentity(hive, view, uninstallPath, subKeyName);
                    string candidateId = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity)))[..24];
                    if (string.Equals(candidateId, programId, StringComparison.OrdinalIgnoreCase))
                        return true;
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Security.SecurityException) { }
        }
        return false;
    }

    private static string StorageProgramRegistryIdentity(
        RegistryHive hive,
        RegistryView view,
        string uninstallPath,
        string subKeyName)
        => $"{hive}|{view}|{uninstallPath}|{subKeyName}";

    private static string ResolveProgramIconPath(string displayIcon, string installLocation, string uninstallString)
    {
        string icon = Environment.ExpandEnvironmentVariables(
            (displayIcon ?? "").Split(',')[0].Trim().Trim('"'));
        if (File.Exists(icon)) return icon;

        string executable = LaunchCommand.ExecutablePathOrName(uninstallString);
        if (File.Exists(executable)) return executable;

        if (!Directory.Exists(installLocation)) return "";
        try
        {
            return Directory.EnumerateFiles(installLocation, "*.exe", SearchOption.TopDirectoryOnly)
                .OrderByDescending(path => string.Equals(
                    Path.GetFileNameWithoutExtension(path),
                    new DirectoryInfo(installLocation).Name,
                    StringComparison.OrdinalIgnoreCase))
                .ThenBy(path => path.Length)
                .FirstOrDefault() ?? "";
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { return ""; }
    }

    private static string ResolveProgramLocation(InstalledProgramEntry program)
    {
        if (Directory.Exists(program.InstallLocation)) return program.InstallLocation;
        string icon = Environment.ExpandEnvironmentVariables(program.DisplayIcon.Split(',')[0].Trim().Trim('"'));
        if (File.Exists(icon)) return Path.GetDirectoryName(icon) ?? "";
        string executable = LaunchCommand.ExecutablePathOrName(program.UninstallString);
        return File.Exists(executable) ? Path.GetDirectoryName(executable) ?? "" : "";
    }

    private static string ReadRegistryString(RegistryKey key, string name)
        => key.GetValue(name)?.ToString()?.Trim() ?? "";

    private static int ConvertRegistryInt(object? value)
        => value switch
        {
            int number => number,
            long number when number is >= int.MinValue and <= int.MaxValue => (int)number,
            string text when int.TryParse(text, out int number) => number,
            _ => 0
        };

    private static long ConvertRegistryLong(object? value)
        => value switch
        {
            int number => number,
            long number => number,
            string text when long.TryParse(text, out long number) => number,
            _ => 0
        };

    private static List<StorageDriveSnapshot> GetStorageDrives()
    {
        var result = new List<StorageDriveSnapshot>();
        foreach (DriveInfo drive in DriveInfo.GetDrives()
                     .Where(item => item.DriveType is DriveType.Fixed or DriveType.Removable))
        {
            try
            {
                if (!drive.IsReady) continue;
                long total = drive.TotalSize;
                long available = drive.AvailableFreeSpace;
                long used = Math.Max(0, total - drive.TotalFreeSpace);
                long reserved = 0;
                if (GetDiskSpaceInformationW(drive.RootDirectory.FullName, out DiskSpaceInformation information) >= 0)
                {
                    ulong clusterSize = (ulong)information.SectorsPerAllocationUnit * information.BytesPerSector;
                    used = ToLongSaturated(information.UsedAllocationUnits * clusterSize);
                    reserved = ToLongSaturated(information.TotalReservedAllocationUnits * clusterSize);
                }
                result.Add(new StorageDriveSnapshot
                {
                    Root = drive.RootDirectory.FullName,
                    Label = string.IsNullOrWhiteSpace(drive.VolumeLabel)
                        ? drive.Name.TrimEnd('\\')
                        : $"{drive.VolumeLabel} ({drive.Name.TrimEnd('\\')})",
                    Format = drive.DriveFormat,
                    Kind = drive.DriveType == DriveType.Removable ? "removable" : "fixed",
                    TotalBytes = total,
                    UsedBytes = used,
                    AvailableBytes = available,
                    ReservedBytes = reserved
                });
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
        }
        return result;
    }

    private void PostStorageSnapshot(
        IReadOnlyCollection<StorageDriveSnapshot> drives,
        StorageCacheDocument? cache,
        bool calculating,
        string error = "")
    {
        var payload = new
        {
            type = "storageSnapshot",
            calculating,
            error,
            scannedAt = cache?.ScannedAtUtc,
            complete = cache?.IsComplete ?? false,
            progressCurrent = cache?.ProgressCurrent ?? 0,
            progressTotal = cache?.ProgressTotal ?? 0,
            progressLabel = cache?.ProgressLabel ?? "",
            drives = drives.Select(drive =>
            {
                StorageVolumeCategories? cachedVolume = cache?.Volumes.FirstOrDefault(volume =>
                    string.Equals(volume.Root, drive.Root, StringComparison.OrdinalIgnoreCase));
                return new
                {
                    root = drive.Root,
                    label = drive.Label,
                    format = drive.Format,
                    kind = drive.Kind,
                    totalBytes = drive.TotalBytes,
                    usedBytes = drive.UsedBytes,
                    availableBytes = drive.AvailableBytes,
                    reservedBytes = drive.ReservedBytes,
                    categories = cachedVolume?.Categories ?? EmptyStorageCategories(drive.UsedBytes)
                };
            }).ToList()
        };
        PostStorageMessage(payload);
    }

    private void PostStoragePrograms(IEnumerable<InstalledProgramEntry> programs, string error = "")
    {
        PostStorageMessage(new
        {
            type = "storagePrograms",
            error,
            programs = programs.Select(program =>
            {
                string location = ResolveProgramLocation(program);
                return new
                {
                    id = program.Id,
                    name = program.Name,
                    version = program.Version,
                    publisher = program.Publisher,
                    installLocation = location,
                    installRoot = Path.GetPathRoot(location) ?? "",
                    iconBase64 = program.IconBase64,
                    sizeBytes = program.EstimatedSizeBytes,
                    sizeState = program.EstimatedSizeBytes > 0 ? "informed" : "unavailable",
                    canUninstall = program.CanUninstall
                };
            }).ToList()
        });
    }

    private void PostStorageUninstallStatus(string programId, string status, string message)
        => PostStorageMessage(new { type = "storageUninstallStatus", programId, status, message });

    private void PostStorageMessage(object payload)
    {
        string json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
        _ = Dispatcher.BeginInvoke(() =>
        {
            try { webView?.CoreWebView2?.PostWebMessageAsString(json); }
            catch (Exception ex) { Debug.WriteLine("[Storage] Falha ao enviar mensagem: " + ex.Message); }
        });
    }

    private static List<StorageCategoryNode> EmptyStorageCategories(long usedBytes)
    {
        var aggregation = new StorageAggregation();
        return aggregation.Build(usedBytes, scanComplete: false);
    }

    private StorageCacheDocument? LoadStorageCache()
    {
        try
        {
            if (!File.Exists(StorageCacheFile)) return null;
            StorageCacheDocument? document = JsonSerializer.Deserialize<StorageCacheDocument>(File.ReadAllText(StorageCacheFile));
            return document?.Version == StorageCacheVersion ? document : null;
        }
        catch { return null; }
    }

    private void SaveStorageCache(StorageCacheDocument document)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(StorageCacheFile)!);
            DurableFileStore.WriteAllText(
                StorageCacheFile,
                JsonSerializer.Serialize(document, IndentedJsonOptions),
                keepBackup: true);
        }
        catch (Exception ex) { Debug.WriteLine("[Storage] Falha ao salvar cache: " + ex.Message); }
    }

    private static void AddStorageRoot(
        ICollection<StorageScanRoot> roots,
        string path,
        string category,
        string child,
        string grandchild = "",
        string itemLabel = "",
        string resultState = "calculated",
        string progressLabel = "")
    {
        string normalized = NormalizeStoragePath(path);
        if (string.IsNullOrWhiteSpace(normalized) ||
            (IsUnsafeStorageRoot(normalized) && !category.Equals("windows", StringComparison.OrdinalIgnoreCase))) return;
        if (File.Exists(normalized))
        {
            roots.Add(new StorageScanRoot
            {
                Path = normalized,
                Category = category,
                Child = child,
                Grandchild = grandchild,
                ItemLabel = itemLabel,
                ProgressLabel = progressLabel,
                ResultState = resultState
            });
            return;
        }
        if (!Directory.Exists(normalized)) return;
        roots.Add(new StorageScanRoot
        {
            Path = normalized,
            Category = category,
            Child = child,
            Grandchild = grandchild,
            ItemLabel = itemLabel,
            ProgressLabel = progressLabel,
            ResultState = resultState
        });
    }

    private static string StorageItemKey(string name, string path)
    {
        byte[] data = SHA256.HashData(Encoding.UTF8.GetBytes($"{name}|{NormalizeStoragePath(path)}"));
        return Convert.ToHexString(data)[..16];
    }

    private static string ResolveGameStoragePath(GameModel game)
    {
        string commandExecutable = LaunchCommand.ExecutablePathOrName(game.LaunchCommand);
        foreach (string candidate in new[] { game.Path, commandExecutable })
        {
            string normalized = NormalizeStoragePath(candidate);
            if (File.Exists(normalized)) return Path.GetDirectoryName(normalized) ?? normalized;
            if (Directory.Exists(normalized)) return normalized;
        }
        return "";
    }

    private static bool IsStoreSource(string source)
        => new[] { "steam", "epic", "gog", "riot", "xbox" }
            .Contains(source?.Trim() ?? "", StringComparer.OrdinalIgnoreCase);

    private static string NormalizeStorageSource(string source, string launchUrl)
    {
        if (IsStoreSource(source)) return source.Trim().ToLowerInvariant();
        if (launchUrl.StartsWith("steam:", StringComparison.OrdinalIgnoreCase)) return "steam";
        if (launchUrl.StartsWith("com.epicgames", StringComparison.OrdinalIgnoreCase)) return "epic";
        if (launchUrl.StartsWith("gog", StringComparison.OrdinalIgnoreCase)) return "gog";
        if (launchUrl.StartsWith("riot:", StringComparison.OrdinalIgnoreCase)) return "riot";
        return "lojas";
    }

    private static string StorageSourceLabel(string source)
        => source.ToLowerInvariant() switch
        {
            "steam" => "Steam",
            "epic" => "Epic Games",
            "gog" => "GOG",
            "riot" => "Riot Games",
            "xbox" => "Xbox",
            "lojas" => "Outras lojas",
            _ => source
        };

    private static int StorageScanPriority(string category, string child)
        => (category, child) switch
        {
            ("doorpi", "core") => 0,
            ("doorpi", "users") => 1,
            ("doorpi", "artwork") => 2,
            ("applications", "web") => 3,
            ("games", "emulators") => 4,
            ("windows", _) => 99,
            _ => 5
        };

    private static IEnumerable<string> SafeEnumerateDirectories(string root, string pattern, SearchOption option)
    {
        try { return Directory.EnumerateDirectories(root, pattern, option).ToArray(); }
        catch { return Array.Empty<string>(); }
    }

    private static string NormalizeStoragePath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return "";
        try
        {
            string expanded = Environment.ExpandEnvironmentVariables(path.Trim().Trim('"'));
            return Path.GetFullPath(expanded).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        }
        catch { return ""; }
    }

    private static string StorageDriveRoot(string? path)
    {
        try
        {
            string? root = Path.GetPathRoot(path);
            return string.IsNullOrWhiteSpace(root) ? "" : root;
        }
        catch { return ""; }
    }

    private static bool IsPathWithin(string candidate, string parent)
    {
        string normalizedCandidate = NormalizeStoragePath(candidate);
        string normalizedParent = NormalizeStoragePath(parent);
        return !string.IsNullOrWhiteSpace(normalizedCandidate) && !string.IsNullOrWhiteSpace(normalizedParent) &&
               !string.Equals(normalizedCandidate, normalizedParent, StringComparison.OrdinalIgnoreCase) &&
               normalizedCandidate.StartsWith(normalizedParent + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
    }

    private static bool PathsOverlap(string first, string second)
    {
        string a = NormalizeStoragePath(first);
        string b = NormalizeStoragePath(second);
        if (string.IsNullOrWhiteSpace(a) || string.IsNullOrWhiteSpace(b)) return false;
        return string.Equals(a, b, StringComparison.OrdinalIgnoreCase) || IsPathWithin(a, b) || IsPathWithin(b, a);
    }

    private static bool IsUnsafeStorageRoot(string path)
    {
        string normalized = NormalizeStoragePath(path);
        string driveRoot = StorageDriveRoot(normalized).TrimEnd(Path.DirectorySeparatorChar);
        if (string.Equals(normalized, driveRoot, StringComparison.OrdinalIgnoreCase)) return true;
        string[] broadRoots =
        {
            Environment.GetFolderPath(Environment.SpecialFolder.Windows),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)
        };
        return broadRoots.Any(root => string.Equals(normalized, NormalizeStoragePath(root), StringComparison.OrdinalIgnoreCase));
    }

    private static long ToLongSaturated(ulong value)
        => value > long.MaxValue ? long.MaxValue : (long)value;

    [StructLayout(LayoutKind.Sequential)]
    private struct DiskSpaceInformation
    {
        public ulong ActualTotalAllocationUnits;
        public ulong ActualAvailableAllocationUnits;
        public ulong ActualPoolUnavailableAllocationUnits;
        public ulong CallerTotalAllocationUnits;
        public ulong CallerAvailableAllocationUnits;
        public ulong CallerPoolUnavailableAllocationUnits;
        public ulong UsedAllocationUnits;
        public ulong TotalReservedAllocationUnits;
        public ulong VolumeStorageReserveAllocationUnits;
        public ulong AvailableCommittedAllocationUnits;
        public ulong PoolAvailableAllocationUnits;
        public uint SectorsPerAllocationUnit;
        public uint BytesPerSector;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetDiskSpaceInformationW(
        string rootPath,
        out DiskSpaceInformation diskSpaceInfo);
}
