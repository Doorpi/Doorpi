using System.Collections.Concurrent;
using System.Buffers.Binary;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Doorpi
{
    public sealed class EmulatorConfigModel
    {
        public string Id { get; set; } = "";
        public string CatalogId { get; set; } = "custom";
        public string Name { get; set; } = "";
        public string ExecutablePath { get; set; } = "";
        public string LaunchTemplate { get; set; } = "";
        public List<string> RomFolders { get; set; } = new();
        public List<string> Extensions { get; set; } = new();
        public string GridImage { get; set; } = "";
        public string GridSourceUrl { get; set; } = "";
        public string ArtworkQuery { get; set; } = "";
        public DateTime DateAdded { get; set; } = DateTime.Now;
    }

    internal sealed class EmulatorCatalogEntry
    {
        public string Id { get; init; } = "";
        public string Name { get; init; } = "";
        public string[] ExecutableNames { get; init; } = Array.Empty<string>();
        public string LaunchTemplate { get; init; } = "{emulator} {rom}";
        public string[] Extensions { get; init; } = Array.Empty<string>();
        public string ScanMode { get; init; } = "files";
        public bool SupportsInternalLibrary { get; init; }
    }

    internal sealed class EmulatorGameSuppressionModel
    {
        public string EmulatorId { get; set; } = "";
        public string RomPath { get; set; } = "";
        public DateTime DeletedAt { get; set; } = DateTime.Now;
    }

    internal sealed class EmulatorRomPreview
    {
        public string Id { get; init; } = "";
        public string Name { get; init; } = "";
        public string DetectedName { get; init; } = "";
        public string RomPath { get; init; } = "";
        public string LaunchValue { get; init; } = "";
        public List<string> DiscPaths { get; init; } = new();
        public string TitleId { get; set; } = "";
        public string GridUrl { get; set; } = "";
        public string HorizontalUrl { get; set; } = "";
        public string HeroUrl { get; set; } = "";
        public string LogoUrl { get; set; } = "";
        public bool IsFromConfiguredRomFolder { get; init; }
        public bool HasResolvedMetadataName { get; init; }
        public int RelativeDepth { get; init; }
    }

    public partial class MainWindow
    {
        private readonly ConcurrentDictionary<string, CancellationTokenSource> _emulatorPreviewRequests = new();
        private int _emulatorReconcileRunning;
        private int _emulatorReconcilePending;
        private int _emulatorCoverDownloadRunning;
        private long _lastEmulatorReconcileUtcTicks;
        private readonly object _emulatorSuppressionLock = new();

        private static readonly IReadOnlyList<EmulatorCatalogEntry> EmulatorCatalog = new[]
        {
            new EmulatorCatalogEntry { Id = "eden", Name = "Eden", ExecutableNames = new[] { "eden.exe", "eden-qt.exe" }, LaunchTemplate = "{emulator} -f {rom}", Extensions = new[] { ".xci", ".nsp", ".nca" } },
            new EmulatorCatalogEntry { Id = "azahar", Name = "Azahar", ExecutableNames = new[] { "azahar.exe", "azahar-qt.exe" }, LaunchTemplate = "{emulator} -f {rom}", Extensions = new[] { ".3ds", ".cci", ".cxi", ".app" }, ScanMode = "azahar", SupportsInternalLibrary = true },
            new EmulatorCatalogEntry { Id = "ppsspp", Name = "PPSSPP", ExecutableNames = new[] { "ppssppwindows64.exe", "ppssppwindows.exe", "ppsspp.exe" }, LaunchTemplate = "{emulator} --fullscreen --pause-menu-exit {rom}", Extensions = new[] { ".iso", ".cso", ".pbp", ".elf" } },
            new EmulatorCatalogEntry { Id = "rpcs3", Name = "RPCS3", ExecutableNames = new[] { "rpcs3.exe" }, LaunchTemplate = "{emulator} --no-gui --fullscreen {rom}", Extensions = new[] { ".elf", ".self" }, ScanMode = "rpcs3", SupportsInternalLibrary = true },
            new EmulatorCatalogEntry { Id = "xenia", Name = "Xenia", ExecutableNames = new[] { "xenia.exe", "xenia_canary.exe" }, LaunchTemplate = "{emulator} {rom} --fullscreen=true", Extensions = new[] { ".iso", ".xex", ".zar" } },
            new EmulatorCatalogEntry { Id = "citra", Name = "Citra", ExecutableNames = new[] { "citra-qt.exe", "citra.exe" }, LaunchTemplate = "{emulator} -f {rom}", Extensions = new[] { ".3ds", ".cci", ".cxi", ".app" }, ScanMode = "citra", SupportsInternalLibrary = true },
            new EmulatorCatalogEntry { Id = "vita3k", Name = "Vita3K", ExecutableNames = new[] { "vita3k.exe" }, LaunchTemplate = "{emulator} -F -r {titleId}", Extensions = new[] { ".vpk", ".zip" }, ScanMode = "vita3k", SupportsInternalLibrary = true },
            new EmulatorCatalogEntry { Id = "ryujinx", Name = "Ryujinx", ExecutableNames = new[] { "ryujinx.exe" }, LaunchTemplate = "{emulator} --fullscreen {rom}", Extensions = new[] { ".xci", ".nsp", ".nca" } },
            new EmulatorCatalogEntry { Id = "project64", Name = "Project64", ExecutableNames = new[] { "project64.exe", "project64k.exe" }, LaunchTemplate = "{emulator} {rom} /fullscreen", Extensions = new[] { ".z64", ".n64", ".v64" } },
            new EmulatorCatalogEntry { Id = "snes9x", Name = "Snes9x", ExecutableNames = new[] { "snes9x.exe", "snes9x-x64.exe" }, LaunchTemplate = "{emulator} -fullscreen {rom}", Extensions = new[] { ".smc", ".sfc", ".fig", ".bs" } },
            new EmulatorCatalogEntry { Id = "dolphin", Name = "Dolphin", ExecutableNames = new[] { "dolphin.exe", "dolphin-emu.exe" }, LaunchTemplate = "{emulator} -b -C Dolphin.Display.Fullscreen=True -e {rom}", Extensions = new[] { ".iso", ".gcm", ".wbfs", ".ciso", ".gcz", ".rvz", ".wia", ".wad", ".dol", ".elf" } },
            new EmulatorCatalogEntry { Id = "cemu", Name = "Cemu", ExecutableNames = new[] { "cemu.exe" }, LaunchTemplate = "{emulator} -g {rom} -f", Extensions = new[] { ".wua", ".wud", ".wux", ".iso", ".rpx" }, ScanMode = "cemu", SupportsInternalLibrary = true },
            new EmulatorCatalogEntry { Id = "duckstation", Name = "DuckStation", ExecutableNames = new[] { "duckstation-qt.exe", "duckstation-qt-x64-release.exe", "duckstation-qt-x64-releaseltcg.exe" }, LaunchTemplate = "{emulator} -batch -fullscreen -- {rom}", Extensions = new[] { ".m3u", ".cue", ".chd", ".iso", ".ecm", ".mds", ".pbp", ".exe", ".psf" } },
            new EmulatorCatalogEntry { Id = "pcsx2", Name = "PCSX2", ExecutableNames = new[] { "pcsx2-qt.exe", "pcsx2.exe" }, LaunchTemplate = "{emulator} -fullscreen -batch -- {rom}", Extensions = new[] { ".iso", ".bin", ".chd", ".cso", ".gz" } },
            new EmulatorCatalogEntry { Id = "shadps4", Name = "shadPS4", ExecutableNames = new[] { "shadps4.exe", "shadps4-qt.exe" }, LaunchTemplate = "{emulator} -g {titleId} --fullscreen true", Extensions = new[] { ".elf", ".bin" }, ScanMode = "shadps4", SupportsInternalLibrary = true },
            new EmulatorCatalogEntry { Id = "yuzu", Name = "Yuzu", ExecutableNames = new[] { "yuzu.exe" }, LaunchTemplate = "{emulator} -f {rom}", Extensions = new[] { ".xci", ".nsp", ".nca" } }
        };

        private string EmulatorConfigFile => Path.Combine(currentUserDataFolder, "emulators.json");
        private string EmulatorSuppressionFile => Path.Combine(currentUserDataFolder, "emulator-game-suppressions.json");

        private static string EmulatorStableId(string value)
        {
            byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(value.Trim().ToLowerInvariant()));
            return Convert.ToHexString(hash)[..16].ToLowerInvariant();
        }

        private static string QuoteEmulatorArgument(string value)
            => "\"" + (value ?? "").Replace("\"", "\\\"") + "\"";

        private static EmulatorCatalogEntry? DetectEmulator(string executablePath)
        {
            string fileName = Path.GetFileName(executablePath).ToLowerInvariant();
            return EmulatorCatalog.FirstOrDefault(entry =>
                entry.ExecutableNames.Any(name => string.Equals(name, fileName, StringComparison.OrdinalIgnoreCase)));
        }

        private List<EmulatorConfigModel> LoadEmulatorConfigs()
        {
            try
            {
                if (!File.Exists(EmulatorConfigFile)) return new List<EmulatorConfigModel>();
                return JsonSerializer.Deserialize<List<EmulatorConfigModel>>(File.ReadAllText(EmulatorConfigFile))
                    ?? new List<EmulatorConfigModel>();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Emulators] Falha ao ler configurações: " + ex.Message);
                return new List<EmulatorConfigModel>();
            }
        }

        private void SaveEmulatorConfigs(List<EmulatorConfigModel> configs)
        {
            Directory.CreateDirectory(currentUserDataFolder);
            SafeWriteAllText(EmulatorConfigFile, JsonSerializer.Serialize(configs, IndentedJsonOptions));
        }

        private EmulatorConfigModel? FindConfiguredEmulatorByExecutablePath(string? executablePath)
        {
            if (string.IsNullOrWhiteSpace(executablePath)) return null;
            return LoadEmulatorConfigs().FirstOrDefault(config =>
            {
                try { return PathsEqual(config.ExecutablePath, executablePath); }
                catch { return string.Equals(config.ExecutablePath, executablePath, StringComparison.OrdinalIgnoreCase); }
            });
        }

        private List<EmulatorGameSuppressionModel> LoadEmulatorGameSuppressions()
        {
            lock (_emulatorSuppressionLock)
            {
                try
                {
                    if (!File.Exists(EmulatorSuppressionFile)) return new List<EmulatorGameSuppressionModel>();
                    return JsonSerializer.Deserialize<List<EmulatorGameSuppressionModel>>(File.ReadAllText(EmulatorSuppressionFile))
                        ?? new List<EmulatorGameSuppressionModel>();
                }
                catch { return new List<EmulatorGameSuppressionModel>(); }
            }
        }

        private void SaveEmulatorGameSuppressions(List<EmulatorGameSuppressionModel> suppressions)
        {
            lock (_emulatorSuppressionLock)
            {
                Directory.CreateDirectory(currentUserDataFolder);
                SafeWriteAllText(EmulatorSuppressionFile, JsonSerializer.Serialize(suppressions, IndentedJsonOptions));
            }
        }

        private static string NormalizeEmulatorRomPath(string path)
        {
            try { return Path.GetFullPath(path ?? "").TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar); }
            catch { return (path ?? "").Trim(); }
        }

        private static bool EmulatorGameMatchesSuppression(
            EmulatorGameSuppressionModel suppression,
            string emulatorId,
            string romPath)
            => suppression.EmulatorId.Equals(emulatorId, StringComparison.OrdinalIgnoreCase) &&
               NormalizeEmulatorRomPath(suppression.RomPath).Equals(
                   NormalizeEmulatorRomPath(romPath),
                   StringComparison.OrdinalIgnoreCase);

        private bool IsEmulatorGameSuppressed(string emulatorId, string romPath)
            => LoadEmulatorGameSuppressions().Any(item => EmulatorGameMatchesSuppression(item, emulatorId, romPath));

        private void SuppressEmulatorGame(GameModel game)
        {
            if (string.IsNullOrWhiteSpace(game.EmulatorId) || string.IsNullOrWhiteSpace(game.RomPath)) return;
            var suppressions = LoadEmulatorGameSuppressions();
            var paths = (game.EmulatorDiscPaths?.Count > 0 ? game.EmulatorDiscPaths : new List<string> { game.RomPath })
                .Where(path => !string.IsNullOrWhiteSpace(path))
                .Distinct(StringComparer.OrdinalIgnoreCase);
            bool changed = false;
            foreach (string path in paths)
            {
                if (suppressions.Any(item => EmulatorGameMatchesSuppression(item, game.EmulatorId, path))) continue;
                suppressions.Add(new EmulatorGameSuppressionModel
                {
                    EmulatorId = game.EmulatorId,
                    RomPath = NormalizeEmulatorRomPath(path),
                    DeletedAt = DateTime.Now
                });
                changed = true;
            }
            if (changed) SaveEmulatorGameSuppressions(suppressions);
        }

        private void UnsuppressEmulatorGame(string emulatorId, string romPath)
        {
            var suppressions = LoadEmulatorGameSuppressions();
            int removed = suppressions.RemoveAll(item => EmulatorGameMatchesSuppression(item, emulatorId, romPath));
            if (removed > 0) SaveEmulatorGameSuppressions(suppressions);
        }

        private void RemoveEmulatorSuppressions(string emulatorId)
        {
            var suppressions = LoadEmulatorGameSuppressions();
            int removed = suppressions.RemoveAll(item => item.EmulatorId.Equals(emulatorId, StringComparison.OrdinalIgnoreCase));
            if (removed > 0) SaveEmulatorGameSuppressions(suppressions);
        }

        private object EmulatorCatalogPayload(EmulatorCatalogEntry entry) => new
        {
            id = entry.Id,
            name = entry.Name,
            executableNames = entry.ExecutableNames,
            launchTemplate = entry.LaunchTemplate,
            extensions = entry.Extensions,
            scanMode = entry.ScanMode,
            supportsInternalLibrary = entry.SupportsInternalLibrary
        };

        private void SendEmulatorsToUi()
        {
            var configs = LoadEmulatorConfigs();
            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
            {
                type = "emulatorsLoaded",
                emulators = configs,
                catalog = EmulatorCatalog.Select(EmulatorCatalogPayload).ToList()
            }));
        }

        private void UpgradeKnownEmulatorTemplates()
        {
            var configs = LoadEmulatorConfigs();
            bool changed = false;
            var changedIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var config in configs)
            {
                var catalog = EmulatorCatalog.FirstOrDefault(item => item.Id.Equals(config.CatalogId, StringComparison.OrdinalIgnoreCase));
                bool obsoleteVitaTemplate = config.CatalogId.Equals("vita3k", StringComparison.OrdinalIgnoreCase) &&
                    (config.LaunchTemplate.Equals("{emulator} --fullscreen {rom}", StringComparison.OrdinalIgnoreCase) ||
                     config.LaunchTemplate.Equals("{emulator} -F {rom}", StringComparison.OrdinalIgnoreCase));
                if (catalog == null || (!obsoleteVitaTemplate && Regex.IsMatch(config.LaunchTemplate, @"(?:fullscreen|(?:^|\s)-f(?:\s|$))", RegexOptions.IgnoreCase))) continue;
                config.LaunchTemplate = catalog.LaunchTemplate;
                changed = true;
                changedIds.Add(config.Id);
            }
            if (!changed) return;
            SaveEmulatorConfigs(configs);
            var games = LoadGames();
            foreach (var game in games.Where(item => changedIds.Contains(item.EmulatorId)))
            {
                var config = configs.First(item => item.Id.Equals(game.EmulatorId, StringComparison.OrdinalIgnoreCase));
                string launchValue = game.RomPath;
                if (config.CatalogId.Equals("shadps4", StringComparison.OrdinalIgnoreCase))
                {
                    var match = Regex.Match(game.RomPath, @"[\\/](CUSA\d+)[\\/]", RegexOptions.IgnoreCase);
                    if (match.Success) launchValue = match.Groups[1].Value.ToUpperInvariant();
                }
                else if (config.CatalogId.Equals("vita3k", StringComparison.OrdinalIgnoreCase))
                {
                    var metadata = ReadEmulatorMetadata(game.RomPath, config.ExecutablePath, config.CatalogId, "vita3k");
                    if (!string.IsNullOrWhiteSpace(metadata.TitleId)) launchValue = metadata.TitleId;
                }
                game.LaunchCommand = ExpandEmulatorLaunchTemplate(config, game.RomPath, launchValue);
            }
            SaveGames(games);
        }

        private static List<string> ReadStringArray(JsonElement root, string property)
        {
            if (!root.TryGetProperty(property, out var element) || element.ValueKind != JsonValueKind.Array)
                return new List<string>();
            return element.EnumerateArray()
                .Where(item => item.ValueKind == JsonValueKind.String)
                .Select(item => item.GetString()?.Trim() ?? "")
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private static IEnumerable<string> EnumerateFilesSafely(string root, int maxFiles = 6000)
        {
            var pending = new Stack<string>();
            pending.Push(root);
            int yielded = 0;
            while (pending.Count > 0 && yielded < maxFiles)
            {
                string folder = pending.Pop();
                try
                {
                    foreach (string child in Directory.EnumerateDirectories(folder)) pending.Push(child);
                }
                catch { }

                IEnumerable<string> files;
                try { files = Directory.EnumerateFiles(folder).ToArray(); }
                catch { continue; }
                foreach (string file in files)
                {
                    yield return file;
                    if (++yielded >= maxFiles) yield break;
                }
            }
        }

        private static string CleanEmulatorGameName(string rawName)
        {
            string name = rawName.Replace('_', ' ').Replace('.', ' ');
            name = Regex.Replace(name, @"^\s*(?:NSP|XCI|ROM)\s*[-_]\s*", "", RegexOptions.IgnoreCase);
            name = Regex.Replace(name, @"^\s*3DS\d+\s*[-_]\s*", "", RegexOptions.IgnoreCase);
            name = Regex.Replace(name, @"\s*[\[(](?:[0-9A-F]{16,32}|v\d+|base|update|dlc|switchrom(?:\.io)?|repack|eshop)[^\])]*[\])]", " ", RegexOptions.IgnoreCase);
            name = Regex.Replace(name, @"\s*[\[(](?:U|E|J|USA|Europe|Japan|World|En(?:,[A-Za-z]+)*|Rev[^\])]*|Disc[^\])]*|Disk[^\])]*|v\d[^\])]*)[\])]\s*", " ", RegexOptions.IgnoreCase);
            name = Regex.Replace(name, @"\s*-\s*(?:decrypted|encrypted)\s*$", "", RegexOptions.IgnoreCase);
            name = Regex.Replace(name, @"\s+", " ").Trim(' ', '-', '_');
            return string.IsNullOrWhiteSpace(name) ? rawName : name;
        }

        private static bool TryGetEmulatorDiscInfo(string file, out string baseName, out int discNumber)
        {
            baseName = "";
            discNumber = 0;
            string rawName = Path.GetFileNameWithoutExtension(file);
            var match = Regex.Match(
                rawName,
                @"(?:^|[\s._\-\[(])(?:disc|disco|disk|cd)\s*[-_. ]*(?<number>\d{1,2}|[ivx]{1,4})(?=$|[\s._\-\])])",
                RegexOptions.IgnoreCase);
            if (!match.Success) return false;

            string number = match.Groups["number"].Value;
            if (!int.TryParse(number, out discNumber))
            {
                discNumber = number.ToUpperInvariant() switch
                {
                    "I" => 1,
                    "II" => 2,
                    "III" => 3,
                    "IV" => 4,
                    "V" => 5,
                    "VI" => 6,
                    "VII" => 7,
                    "VIII" => 8,
                    "IX" => 9,
                    "X" => 10,
                    _ => 0
                };
            }
            if (discNumber <= 0) return false;

            baseName = CleanEmulatorGameName(rawName.Remove(match.Index, match.Length));
            return !string.IsNullOrWhiteSpace(baseName);
        }

        private static List<string> ReadM3uDiscPaths(string playlistPath)
        {
            try
            {
                string folder = Path.GetDirectoryName(playlistPath) ?? "";
                return File.ReadLines(playlistPath)
                    .Select(line => line.Trim().TrimStart('\uFEFF').Trim('"'))
                    .Where(line => !string.IsNullOrWhiteSpace(line) && !line.StartsWith('#'))
                    .Select(line => Path.IsPathRooted(line) ? line : Path.Combine(folder, line))
                    .Select(NormalizeEmulatorRomPath)
                    .Where(File.Exists)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }
            catch { return new List<string>(); }
        }

        private static string ResolveCueDataFile(string cuePath)
        {
            try
            {
                string folder = Path.GetDirectoryName(cuePath) ?? "";
                foreach (string line in File.ReadLines(cuePath).Take(40))
                {
                    var match = Regex.Match(line, @"^\s*FILE\s+(?:""(?<file>[^""]+)""|(?<file>\S+))", RegexOptions.IgnoreCase);
                    if (!match.Success) continue;
                    string candidate = Path.Combine(folder, match.Groups["file"].Value);
                    if (File.Exists(candidate)) return candidate;
                }
                string sibling = Path.ChangeExtension(cuePath, ".bin");
                if (File.Exists(sibling)) return sibling;

                // Renaming a CUE/BIN set often leaves the FILE entry inside the CUE
                // pointing at the old name. Prefer the first data track sharing the
                // current CUE stem instead of silently scanning the text-only CUE.
                string cueStem = Path.GetFileNameWithoutExtension(cuePath);
                string? matchingTrack = Directory.EnumerateFiles(folder, cueStem + "*.bin")
                    .OrderByDescending(path => Regex.IsMatch(Path.GetFileName(path), @"\bTrack\s*1\b", RegexOptions.IgnoreCase))
                    .ThenBy(path => Path.GetFileName(path).Length)
                    .FirstOrDefault();
                return matchingTrack ?? cuePath;
            }
            catch { return cuePath; }
        }

        private static string TryReadPlayStationDiscSerialFast(string file)
        {
            try
            {
                string imagePath = Path.GetExtension(file).Equals(".cue", StringComparison.OrdinalIgnoreCase)
                    ? ResolveCueDataFile(file)
                    : file;
                using var stream = File.OpenRead(imagePath);
                int length = (int)Math.Min(stream.Length, 16L * 1024 * 1024);
                byte[] data = new byte[length];
                stream.ReadExactly(data);
                string text = Encoding.ASCII.GetString(data);
                var match = Regex.Match(text, @"(?<![A-Z0-9])([A-Z]{4})[_-](\d{3})\.(\d{2})(?!\d)", RegexOptions.IgnoreCase);
                return match.Success
                    ? $"{match.Groups[1].Value.ToUpperInvariant()}-{match.Groups[2].Value}{match.Groups[3].Value}"
                    : "";
            }
            catch { return ""; }
        }

        private static string ReadYamlScalar(string line)
        {
            string value = line[(line.IndexOf(':') + 1)..].Trim();
            if (value.Length >= 2 && value[0] == '"' && value[^1] == '"')
            {
                try { return JsonSerializer.Deserialize<string>(value) ?? value.Trim('"'); }
                catch { return value.Trim('"'); }
            }
            return value.Trim('\'', '"');
        }

        private static Dictionary<string, (string SetKey, string Name, int DiscNumber)> LoadDuckStationDiscSets(string executablePath)
        {
            var result = new Dictionary<string, (string SetKey, string Name, int DiscNumber)>(StringComparer.OrdinalIgnoreCase);
            string database = Path.Combine(Path.GetDirectoryName(executablePath) ?? "", "resources", "discsets.yaml");
            if (!File.Exists(database)) return result;

            string name = "";
            var serials = new List<string>();
            void Commit()
            {
                if (string.IsNullOrWhiteSpace(name) || serials.Count < 2)
                {
                    serials.Clear();
                    return;
                }
                string setKey = string.Join("|", serials);
                for (int index = 0; index < serials.Count; index++)
                    result[serials[index]] = (setKey, name, index + 1);
                serials.Clear();
            }

            try
            {
                foreach (string line in File.ReadLines(database))
                {
                    if (line.StartsWith("- name:", StringComparison.Ordinal))
                    {
                        Commit();
                        name = ReadYamlScalar(line);
                        continue;
                    }
                    string trimmed = line.Trim();
                    if (Regex.IsMatch(trimmed, @"^-\s+[A-Z]{4}-\d{5}$", RegexOptions.IgnoreCase))
                        serials.Add(trimmed[1..].Trim().ToUpperInvariant());
                }
                Commit();
            }
            catch { result.Clear(); }
            return result;
        }

        private List<EmulatorRomPreview> GroupMultiDiscEmulatorGames(
            string executablePath,
            string catalogId,
            List<EmulatorRomPreview> games)
        {
            if (catalogId is not ("duckstation" or "pcsx2" or "dolphin" or "ppsspp"))
                return games;

            var playlists = games.Where(game => Path.GetExtension(game.RomPath).Equals(".m3u", StringComparison.OrdinalIgnoreCase) && game.DiscPaths.Count > 1).ToList();
            var playlistMembers = playlists.SelectMany(game => game.DiscPaths)
                .Select(NormalizeEmulatorRomPath)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var candidates = games.Where(game => !playlists.Contains(game) && !playlistMembers.Contains(NormalizeEmulatorRomPath(game.RomPath))).ToList();
            var discDatabase = catalogId.Equals("duckstation", StringComparison.OrdinalIgnoreCase)
                ? LoadDuckStationDiscSets(executablePath)
                : new Dictionary<string, (string SetKey, string Name, int DiscNumber)>(StringComparer.OrdinalIgnoreCase);

            var classified = candidates.Select(game =>
            {
                string serial = catalogId.Equals("duckstation", StringComparison.OrdinalIgnoreCase)
                    ? TryReadPlayStationDiscSerialFast(game.RomPath)
                    : "";
                if (!string.IsNullOrWhiteSpace(serial) && discDatabase.TryGetValue(serial, out var set))
                    return new { Game = game, BaseName = set.Name, DiscNumber = set.DiscNumber, GroupKey = "serials:" + set.SetKey };
                return TryGetEmulatorDiscInfo(game.RomPath, out string baseName, out int discNumber)
                    ? new { Game = game, BaseName = baseName, DiscNumber = discNumber, GroupKey = "name:" + NormalizeGameName(baseName) }
                    : null;
            }).ToList();

            var output = playlists.ToList();
            output.AddRange(candidates.Where(game => classified.All(item => item?.Game != game)));
            var discGroups = classified
                .Where(item => item != null)
                .GroupBy(item => item!.GroupKey, StringComparer.OrdinalIgnoreCase);

            foreach (var group in discGroups)
            {
                var discs = group!
                    .OrderBy(item => item!.DiscNumber)
                    .ThenBy(item => item!.Game.RomPath, StringComparer.OrdinalIgnoreCase)
                    .ToList();
                if (discs.Count == 1)
                {
                    output.Add(discs[0]!.Game);
                    continue;
                }

                var preferred = discs
                    .OrderByDescending(item => item!.Game.IsFromConfiguredRomFolder)
                    .ThenByDescending(item => item!.Game.HasResolvedMetadataName)
                    .ThenBy(item => item!.DiscNumber)
                    .ThenBy(item => item!.Game.RelativeDepth)
                    .First()!;
                var firstDisc = discs[0]!;
                string displayName = preferred.Game.HasResolvedMetadataName
                    ? preferred.Game.Name
                    : firstDisc.BaseName;
                var discPaths = discs.Select(item => item!.Game.RomPath)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                output.Add(new EmulatorRomPreview
                {
                    Id = EmulatorStableId(executablePath + "|multidisc|" + catalogId + "|" + group.Key),
                    Name = displayName,
                    DetectedName = displayName,
                    RomPath = firstDisc.Game.RomPath,
                    LaunchValue = firstDisc.Game.LaunchValue,
                    DiscPaths = discPaths,
                    TitleId = firstDisc.Game.TitleId,
                    GridUrl = preferred.Game.GridUrl,
                    HorizontalUrl = preferred.Game.HorizontalUrl,
                    HeroUrl = preferred.Game.HeroUrl,
                    LogoUrl = preferred.Game.LogoUrl,
                    IsFromConfiguredRomFolder = discs.Any(item => item!.Game.IsFromConfiguredRomFolder),
                    HasResolvedMetadataName = preferred.Game.HasResolvedMetadataName,
                    RelativeDepth = discs.Min(item => item!.Game.RelativeDepth)
                });
            }

            return output.OrderBy(game => game.Name, StringComparer.CurrentCultureIgnoreCase).ToList();
        }

        private static string ReadUtf8Z(ReadOnlySpan<byte> bytes)
        {
            int end = bytes.IndexOf((byte)0);
            if (end >= 0) bytes = bytes[..end];
            return Encoding.UTF8.GetString(bytes).Trim();
        }

        private static string TryReadSfoValue(ReadOnlySpan<byte> data, string requestedKey)
        {
            try
            {
                if (data.Length < 20 || BinaryPrimitives.ReadUInt32LittleEndian(data) != 0x46535000) return "";
                int keyTable = (int)BinaryPrimitives.ReadUInt32LittleEndian(data[8..]);
                int valueTable = (int)BinaryPrimitives.ReadUInt32LittleEndian(data[12..]);
                int count = (int)BinaryPrimitives.ReadUInt32LittleEndian(data[16..]);
                for (int i = 0; i < count; i++)
                {
                    int entry = 20 + (i * 16);
                    if (entry + 16 > data.Length) break;
                    int keyOffset = BinaryPrimitives.ReadUInt16LittleEndian(data[entry..]);
                    int valueLength = (int)BinaryPrimitives.ReadUInt32LittleEndian(data[(entry + 4)..]);
                    int valueOffset = (int)BinaryPrimitives.ReadUInt32LittleEndian(data[(entry + 12)..]);
                    if (keyTable + keyOffset >= data.Length || valueTable + valueOffset >= data.Length) continue;
                    string key = ReadUtf8Z(data[(keyTable + keyOffset)..]);
                    if (!key.Equals(requestedKey, StringComparison.OrdinalIgnoreCase)) continue;
                    int length = Math.Min(valueLength, data.Length - valueTable - valueOffset);
                    return length > 0 ? ReadUtf8Z(data.Slice(valueTable + valueOffset, length)) : "";
                }
            }
            catch { }
            return "";
        }

        private static string TryReadSfoTitle(ReadOnlySpan<byte> data)
            => TryReadSfoValue(data, "TITLE");

        private static string TryReadSfoFile(string path)
        {
            try { return File.Exists(path) ? TryReadSfoTitle(File.ReadAllBytes(path)) : ""; }
            catch { return ""; }
        }

        private static string TryReadSfoFileValue(string path, string key)
        {
            try { return File.Exists(path) ? TryReadSfoValue(File.ReadAllBytes(path), key) : ""; }
            catch { return ""; }
        }

        private static uint? TryReadSfoIntegerValue(ReadOnlySpan<byte> data, string requestedKey)
        {
            try
            {
                if (data.Length < 20 || BinaryPrimitives.ReadUInt32LittleEndian(data) != 0x46535000) return null;
                int keyTable = (int)BinaryPrimitives.ReadUInt32LittleEndian(data[8..]);
                int valueTable = (int)BinaryPrimitives.ReadUInt32LittleEndian(data[12..]);
                int count = (int)BinaryPrimitives.ReadUInt32LittleEndian(data[16..]);
                for (int i = 0; i < count; i++)
                {
                    int entry = 20 + (i * 16);
                    if (entry + 16 > data.Length) break;
                    int keyOffset = BinaryPrimitives.ReadUInt16LittleEndian(data[entry..]);
                    int valueOffset = (int)BinaryPrimitives.ReadUInt32LittleEndian(data[(entry + 12)..]);
                    if (keyTable + keyOffset >= data.Length || valueTable + valueOffset + sizeof(uint) > data.Length) continue;
                    string key = ReadUtf8Z(data[(keyTable + keyOffset)..]);
                    if (key.Equals(requestedKey, StringComparison.OrdinalIgnoreCase))
                        return BinaryPrimitives.ReadUInt32LittleEndian(data[(valueTable + valueOffset)..]);
                }
            }
            catch { }
            return null;
        }

        private static uint? TryReadSfoFileIntegerValue(string path, string key)
        {
            try { return File.Exists(path) ? TryReadSfoIntegerValue(File.ReadAllBytes(path), key) : null; }
            catch { return null; }
        }

        private static bool IsRpcS3InternalInstalledGame(string file, DirectoryInfo gameDirectory)
        {
            string marker = $"{Path.DirectorySeparatorChar}dev_hdd0{Path.DirectorySeparatorChar}game{Path.DirectorySeparatorChar}";
            if (!Path.GetFullPath(file).Contains(marker, StringComparison.OrdinalIgnoreCase)) return true;

            string sfo = Path.Combine(gameDirectory.FullName, "PARAM.SFO");
            string category = TryReadSfoFileValue(sfo, "CATEGORY");
            uint? bootable = TryReadSfoFileIntegerValue(sfo, "BOOTABLE");
            return bootable == 1 && !category.Equals("GD", StringComparison.OrdinalIgnoreCase);
        }

        private static DirectoryInfo? FindParentContainingFile(string path, string fileName, int maxLevels = 8)
        {
            var directory = new DirectoryInfo(Path.GetDirectoryName(path) ?? "");
            for (int level = 0; directory != null && level < maxLevels; level++, directory = directory.Parent)
            {
                if (File.Exists(Path.Combine(directory.FullName, fileName))) return directory;
            }
            return null;
        }

        private static DirectoryInfo? FindVitaAppRoot(string path)
        {
            var directory = new DirectoryInfo(Path.GetDirectoryName(path) ?? "");
            for (int level = 0; directory != null && level < 7; level++, directory = directory.Parent)
            {
                if (Regex.IsMatch(directory.Name, @"^[A-Z]{4}\d{5}$", RegexOptions.IgnoreCase) &&
                    File.Exists(Path.Combine(directory.FullName, "sce_sys", "param.sfo")))
                    return directory;
            }
            return null;
        }

        private static string TryReadArchiveSfoValue(string path, string key)
        {
            try
            {
                using var archive = ZipFile.OpenRead(path);
                var entry = archive.Entries.FirstOrDefault(item =>
                    item.FullName.EndsWith("sce_sys/param.sfo", StringComparison.OrdinalIgnoreCase) ||
                    item.FullName.Equals("PARAM.SFO", StringComparison.OrdinalIgnoreCase));
                if (entry == null || entry.Length > 2 * 1024 * 1024) return "";
                using var stream = entry.Open();
                using var memory = new MemoryStream();
                stream.CopyTo(memory);
                return TryReadSfoValue(memory.ToArray(), key);
            }
            catch { return ""; }
        }

        private static string TryReadArchiveSfo(string path)
            => TryReadArchiveSfoValue(path, "TITLE");

        private static string TryReadCemuTitle(string file)
        {
            try
            {
                var code = Directory.GetParent(file);
                string meta = Path.Combine(code?.Parent?.FullName ?? "", "meta", "meta.xml");
                if (!File.Exists(meta)) return "";
                var root = XDocument.Load(meta).Root;
                return root?.Elements().FirstOrDefault(element =>
                    element.Name.LocalName.StartsWith("longname_", StringComparison.OrdinalIgnoreCase) &&
                    !string.IsNullOrWhiteSpace(element.Value))?.Value.Trim() ?? "";
            }
            catch { return ""; }
        }

        private static string TryReadDiscHeaderTitle(string file, string catalogId)
        {
            try
            {
                string extension = Path.GetExtension(file).ToLowerInvariant();
                using var stream = File.OpenRead(file);
                if ((catalogId == "dolphin") && (extension == ".iso" || extension == ".gcm") && stream.Length >= 0x80)
                {
                    stream.Position = 0x20;
                    byte[] title = new byte[0x60];
                    stream.ReadExactly(title);
                    return ReadUtf8Z(title);
                }
                if (catalogId == "project64" && (extension == ".z64" || extension == ".n64" || extension == ".v64") && stream.Length >= 0x34)
                {
                    byte[] header = new byte[0x34];
                    stream.ReadExactly(header);
                    if (header[0] == 0x37 && header[1] == 0x80)
                        for (int i = 0; i + 1 < header.Length; i += 2) (header[i], header[i + 1]) = (header[i + 1], header[i]);
                    else if (header[0] == 0x40 && header[1] == 0x12)
                        for (int i = 0; i + 3 < header.Length; i += 4)
                            (header[i], header[i + 1], header[i + 2], header[i + 3]) = (header[i + 3], header[i + 2], header[i + 1], header[i]);
                    return Encoding.ASCII.GetString(header, 0x20, 20).Trim('\0', ' ');
                }
                if (catalogId == "snes9x" && stream.Length >= 0x8000)
                {
                    long copierHeader = stream.Length % 0x8000 == 512 ? 512 : 0;
                    foreach (long offset in new[] { copierHeader + 0x7FC0, copierHeader + 0xFFC0 })
                    {
                        if (offset + 21 > stream.Length) continue;
                        stream.Position = offset;
                        byte[] title = new byte[21];
                        stream.ReadExactly(title);
                        string candidate = Encoding.ASCII.GetString(title).Trim('\0', ' ');
                        if (candidate.Count(char.IsLetterOrDigit) >= 4) return candidate;
                    }
                }
            }
            catch { }
            return "";
        }

        private static string TryReadPbpTitle(string file)
        {
            try
            {
                using var stream = File.OpenRead(file);
                byte[] header = new byte[16];
                stream.ReadExactly(header);
                if (header[0] != 0 || header[1] != (byte)'P' || header[2] != (byte)'B' || header[3] != (byte)'P') return "";
                int start = BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(8));
                int end = BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(12));
                if (start < 0 || end <= start || end - start > 2 * 1024 * 1024) return "";
                stream.Position = start;
                byte[] sfo = new byte[end - start];
                stream.ReadExactly(sfo);
                return TryReadSfoTitle(sfo);
            }
            catch { return ""; }
        }

        private static byte[]? TryReadIso9660File(string imagePath, params string[] pathParts)
        {
            try
            {
                using var stream = File.OpenRead(imagePath);
                const int sector = 2048;
                byte[] pvd = new byte[sector];
                stream.Position = 16L * sector;
                stream.ReadExactly(pvd);
                if (pvd[0] != 1 || Encoding.ASCII.GetString(pvd, 1, 5) != "CD001") return null;
                int extent = BinaryPrimitives.ReadInt32LittleEndian(pvd.AsSpan(158));
                int length = BinaryPrimitives.ReadInt32LittleEndian(pvd.AsSpan(166));
                for (int partIndex = 0; partIndex < pathParts.Length; partIndex++)
                {
                    if (length <= 0 || length > 32 * 1024 * 1024) return null;
                    byte[] directory = new byte[length];
                    stream.Position = (long)extent * sector;
                    stream.ReadExactly(directory);
                    bool found = false;
                    for (int offset = 0; offset < directory.Length;)
                    {
                        int recordLength = directory[offset];
                        if (recordLength == 0)
                        {
                            offset = ((offset / sector) + 1) * sector;
                            continue;
                        }
                        if (offset + recordLength > directory.Length || recordLength < 34) break;
                        int nameLength = directory[offset + 32];
                        if (offset + 33 + nameLength > directory.Length) break;
                        string name = Encoding.ASCII.GetString(directory, offset + 33, nameLength).Split(';')[0];
                        if (name.Equals(pathParts[partIndex], StringComparison.OrdinalIgnoreCase))
                        {
                            extent = BinaryPrimitives.ReadInt32LittleEndian(directory.AsSpan(offset + 2));
                            length = BinaryPrimitives.ReadInt32LittleEndian(directory.AsSpan(offset + 10));
                            found = true;
                            break;
                        }
                        offset += recordLength;
                    }
                    if (!found) return null;
                }
                if (length <= 0 || length > 4 * 1024 * 1024) return null;
                byte[] result = new byte[length];
                stream.Position = (long)extent * sector;
                stream.ReadExactly(result);
                return result;
            }
            catch { return null; }
        }

        private static string TryReadPspIsoTitle(string file)
        {
            byte[]? sfo = TryReadIso9660File(file, "PSP_GAME", "PARAM.SFO");
            return sfo == null ? "" : TryReadSfoTitle(sfo);
        }

        private static string TryReadPlayStationSerial(string file)
        {
            byte[]? systemCnf = TryReadIso9660File(file, "SYSTEM.CNF");
            if (systemCnf == null) return "";
            string text = Encoding.ASCII.GetString(systemCnf);
            var match = Regex.Match(text, @"(?<![A-Z0-9])([A-Z]{4})[_-](\d{3})\.(\d{2})(?!\d)", RegexOptions.IgnoreCase);
            return match.Success ? $"{match.Groups[1].Value.ToUpperInvariant()}-{match.Groups[2].Value}{match.Groups[3].Value}" : "";
        }

        private static string TryReadPcsx2DatabaseTitle(string executablePath, string serial)
        {
            if (string.IsNullOrWhiteSpace(serial)) return "";
            string executableFolder = Path.GetDirectoryName(executablePath) ?? "";
            foreach (string database in new[]
            {
                Path.Combine(executableFolder, "resources", "GameIndex.yaml"),
                Path.Combine(executableFolder, "GameIndex.yaml")
            })
            {
                try
                {
                    if (!File.Exists(database)) continue;
                    bool inEntry = false;
                    foreach (string line in File.ReadLines(database))
                    {
                        if (!char.IsWhiteSpace(line.FirstOrDefault()))
                        {
                            inEntry = line.Trim().TrimEnd(':').Equals(serial, StringComparison.OrdinalIgnoreCase);
                            continue;
                        }
                        if (!inEntry) continue;
                        string trimmed = line.Trim();
                        if (!trimmed.StartsWith("name:", StringComparison.OrdinalIgnoreCase)) continue;
                        return trimmed[5..].Trim().Trim('"', '\'');
                    }
                }
                catch { }
            }
            return "";
        }

        private static string TryReadSmdhTitle(string file)
        {
            try
            {
                using var stream = File.OpenRead(file);
                int length = (int)Math.Min(stream.Length, 64L * 1024 * 1024);
                byte[] data = new byte[length];
                stream.ReadExactly(data);
                ReadOnlySpan<byte> magic = "SMDH"u8;
                int offset = data.AsSpan().IndexOf(magic);
                if (offset < 0 || offset + 0x208 > data.Length) return "";
                foreach (int language in new[] { 1, 0, 9, 10 })
                {
                    int titleOffset = offset + 8 + language * 0x200;
                    if (titleOffset + 0x80 > data.Length) continue;
                    string title = Encoding.Unicode.GetString(data, titleOffset, 0x80).Trim('\0', ' ');
                    if (!string.IsNullOrWhiteSpace(title)) return title;
                }
            }
            catch { }
            return "";
        }

        private static string TryReadNintendo3DsTitleId(string file)
        {
            try
            {
                using var stream = File.OpenRead(file);
                if (stream.Length < 0x120) return "";

                static bool HasMagic(ReadOnlySpan<byte> header, string magic)
                    => header.Length >= 0x104 &&
                       header.Slice(0x100, 4).SequenceEqual(Encoding.ASCII.GetBytes(magic));

                byte[] header = new byte[0x130];
                stream.ReadExactly(header);
                long ncchOffset = 0;

                if (HasMagic(header, "NCSD"))
                {
                    uint partitionOffsetMediaUnits = BinaryPrimitives.ReadUInt32LittleEndian(header.AsSpan(0x120, 4));
                    ncchOffset = partitionOffsetMediaUnits * 0x200L;
                    if (ncchOffset <= 0 || ncchOffset + header.Length > stream.Length) return "";
                    stream.Position = ncchOffset;
                    stream.ReadExactly(header);
                }

                if (!HasMagic(header, "NCCH")) return "";
                ulong programId = BinaryPrimitives.ReadUInt64LittleEndian(header.AsSpan(0x118, 8));
                return programId == 0 ? "" : programId.ToString("X16");
            }
            catch { return ""; }
        }

        private static string TryReadSwitchTitleId(string file)
        {
            var fromName = Regex.Match(Path.GetFileName(file), @"(?<![0-9A-F])([0-9A-F]{16})(?![0-9A-F])", RegexOptions.IgnoreCase);
            if (fromName.Success) return fromName.Groups[1].Value.ToUpperInvariant();
            if (!Path.GetExtension(file).Equals(".nsp", StringComparison.OrdinalIgnoreCase)) return "";
            try
            {
                using var stream = File.OpenRead(file);
                byte[] header = new byte[16];
                stream.ReadExactly(header);
                if (!header.AsSpan(0, 4).SequenceEqual("PFS0"u8)) return "";
                int count = BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(4));
                int stringSize = BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(8));
                if (count <= 0 || count > 20000 || stringSize <= 0 || stringSize > 16 * 1024 * 1024) return "";
                byte[] entries = new byte[count * 24];
                stream.ReadExactly(entries);
                byte[] names = new byte[stringSize];
                stream.ReadExactly(names);
                for (int i = 0; i < count; i++)
                {
                    int nameOffset = BinaryPrimitives.ReadInt32LittleEndian(entries.AsSpan(i * 24 + 16));
                    if (nameOffset < 0 || nameOffset >= names.Length) continue;
                    string entryName = ReadUtf8Z(names.AsSpan(nameOffset));
                    var match = Regex.Match(entryName, @"^([0-9A-F]{16})[0-9A-F]{16}\.tik$", RegexOptions.IgnoreCase);
                    if (match.Success) return match.Groups[1].Value.ToUpperInvariant();
                }
            }
            catch { }
            return "";
        }

        private static string TryReadSwitchCachedTitle(string executablePath, string titleId)
        {
            if (string.IsNullOrWhiteSpace(titleId)) return "";
            var roots = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            string roaming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            foreach (string name in new[] { "Eden", "eden", "yuzu", "Ryujinx" }) roots.Add(Path.Combine(roaming, name));
            string executableFolder = Path.GetDirectoryName(executablePath) ?? "";
            if (!string.IsNullOrWhiteSpace(executableFolder)) roots.Add(Path.Combine(executableFolder, "user"));

            foreach (string root in roots.Where(Directory.Exists))
            {
                try
                {
                    string ryujinxMetadata = Path.Combine(root, "games", titleId.ToLowerInvariant(), "gui", "metadata.json");
                    if (File.Exists(ryujinxMetadata))
                    {
                        using var doc = JsonDocument.Parse(File.ReadAllText(ryujinxMetadata));
                        if (doc.RootElement.TryGetProperty("title", out var title) && !string.IsNullOrWhiteSpace(title.GetString()))
                            return title.GetString()!.Trim();
                    }
                    foreach (string cached in new[]
                    {
                        Path.Combine(root, "cache", "game_list", titleId + ".appname.txt"),
                        Path.Combine(root, "cache", "game_list", titleId)
                    })
                    {
                        if (File.Exists(cached))
                        {
                            string title = File.ReadAllText(cached).Trim('\0', ' ', '\r', '\n');
                            if (!string.IsNullOrWhiteSpace(title)) return title;
                        }
                    }
                    string logFolder = Path.Combine(root, "log");
                    if (!Directory.Exists(logFolder)) continue;
                    foreach (string log in Directory.EnumerateFiles(logFolder, "*.txt").OrderByDescending(File.GetLastWriteTimeUtc).Take(4))
                    {
                        string contents = File.ReadAllText(log);
                        var loading = Regex.Match(contents, @"Loading\s+(.+?)\s+\(" + Regex.Escape(titleId) + @"\)", RegexOptions.IgnoreCase);
                        if (loading.Success) return loading.Groups[1].Value.Trim();
                        var booting = Regex.Match(contents, @"Booting game:\s*" + Regex.Escape(titleId) + @"\s*\|\s*(.+?)(?:\s*\(|\s*\|)", RegexOptions.IgnoreCase);
                        if (booting.Success) return booting.Groups[1].Value.Trim();
                    }
                }
                catch { }
            }
            return "";
        }

        private static (string Name, string TitleId, bool HasResolvedName) ReadEmulatorMetadata(string file, string executablePath, string catalogId, string scanMode)
        {
            string title = "";
            string titleId = "";
            if (catalogId is "eden" or "yuzu" or "ryujinx")
            {
                titleId = TryReadSwitchTitleId(file);
                title = TryReadSwitchCachedTitle(executablePath, titleId);
            }
            else if (scanMode == "rpcs3")
            {
                var directory = FindParentContainingFile(file, "PARAM.SFO");
                string sfo = Path.Combine(directory?.FullName ?? "", "PARAM.SFO");
                title = TryReadSfoFile(sfo);
                titleId = TryReadSfoFileValue(sfo, "TITLE_ID");
                if (string.IsNullOrWhiteSpace(titleId) && directory != null &&
                    Regex.IsMatch(directory.Name, @"^[A-Z]{4}\d{5}$", RegexOptions.IgnoreCase))
                    titleId = directory.Name.ToUpperInvariant();
            }
            else if (scanMode == "shadps4")
            {
                var directory = new DirectoryInfo(Path.GetDirectoryName(file) ?? "");
                while (directory != null && !Regex.IsMatch(directory.Name, @"^CUSA\d+$", RegexOptions.IgnoreCase)) directory = directory.Parent;
                titleId = directory?.Name.ToUpperInvariant() ?? "";
                title = TryReadSfoFile(Path.Combine(directory?.FullName ?? "", "sce_sys", "param.sfo"));
            }
            else if (scanMode == "cemu") title = TryReadCemuTitle(file);
            else if (scanMode == "vita3k")
            {
                if (Path.GetExtension(file).ToLowerInvariant() is ".vpk" or ".zip")
                {
                    title = TryReadArchiveSfo(file);
                    titleId = TryReadArchiveSfoValue(file, "TITLE_ID");
                }
                else
                {
                    var appRoot = FindVitaAppRoot(file);
                    string sfo = Path.Combine(appRoot?.FullName ?? "", "sce_sys", "param.sfo");
                    title = TryReadSfoFile(sfo);
                    titleId = TryReadSfoFileValue(sfo, "TITLE_ID");
                    if (string.IsNullOrWhiteSpace(titleId)) titleId = appRoot?.Name.ToUpperInvariant() ?? "";
                }
            }
            else if (catalogId == "ppsspp")
            {
                title = Path.GetExtension(file).Equals(".pbp", StringComparison.OrdinalIgnoreCase)
                    ? TryReadPbpTitle(file)
                    : TryReadPspIsoTitle(file);
            }
            else if (catalogId == "pcsx2")
                title = TryReadPcsx2DatabaseTitle(executablePath, TryReadPlayStationSerial(file));
            else if (catalogId is "azahar" or "citra")
            {
                title = TryReadSmdhTitle(file);
                titleId = TryReadNintendo3DsTitleId(file);
            }
            else title = TryReadDiscHeaderTitle(file, catalogId);

            bool hasResolvedName = !string.IsNullOrWhiteSpace(title);
            if (string.IsNullOrWhiteSpace(title)) title = NameForSpecialRom(file, scanMode);
            return (CleanEmulatorGameName(title), titleId, hasResolvedName);
        }

        private static string NameForSpecialRom(string file, string scanMode)
        {
            if (scanMode == "rpcs3")
            {
                var directory = FindParentContainingFile(file, "PARAM.SFO");
                return CleanEmulatorGameName(directory?.Name ?? Path.GetFileNameWithoutExtension(file));
            }
            if (scanMode == "cemu" && Path.GetExtension(file).Equals(".rpx", StringComparison.OrdinalIgnoreCase))
            {
                var code = Directory.GetParent(file);
                return CleanEmulatorGameName(code?.Parent?.Name ?? Path.GetFileNameWithoutExtension(file));
            }
            if (scanMode == "vita3k")
            {
                var directory = FindVitaAppRoot(file);
                return CleanEmulatorGameName(directory?.Name ?? Path.GetFileNameWithoutExtension(file));
            }
            if (scanMode == "shadps4")
            {
                var directory = new DirectoryInfo(Path.GetDirectoryName(file) ?? "");
                while (directory != null && !Regex.IsMatch(directory.Name, @"^CUSA\d+$", RegexOptions.IgnoreCase))
                    directory = directory.Parent;
                return CleanEmulatorGameName(directory?.Name ?? Path.GetFileNameWithoutExtension(file));
            }
            return CleanEmulatorGameName(Path.GetFileNameWithoutExtension(file));
        }

        private static IEnumerable<string> GetInternalEmulatorLibraryRoots(string executablePath, string catalogId)
        {
            string executableFolder = Path.GetDirectoryName(executablePath) ?? "";
            string roaming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            var candidates = new List<string>();

            switch (catalogId.ToLowerInvariant())
            {
                case "rpcs3":
                    candidates.Add(Path.Combine(executableFolder, "dev_hdd0", "game"));
                    candidates.Add(Path.Combine(executableFolder, "games"));
                    candidates.Add(Path.Combine(roaming, "RPCS3", "dev_hdd0", "game"));
                    break;
                case "vita3k":
                    candidates.Add(Path.Combine(executableFolder, "ux0", "app"));
                    candidates.Add(Path.Combine(executableFolder, "Vita3K", "ux0", "app"));
                    candidates.Add(Path.Combine(roaming, "Vita3K", "ux0", "app"));
                    candidates.Add(Path.Combine(roaming, "Vita3K", "Vita3K", "ux0", "app"));
                    break;
                case "cemu":
                    candidates.Add(Path.Combine(executableFolder, "mlc01", "usr", "title"));
                    candidates.Add(Path.Combine(roaming, "Cemu", "mlc01", "usr", "title"));
                    foreach (string settingsFile in new[]
                    {
                        Path.Combine(executableFolder, "settings.xml"),
                        Path.Combine(roaming, "Cemu", "settings.xml")
                    })
                    {
                        try
                        {
                            if (!File.Exists(settingsFile)) continue;
                            string? mlcPath = XDocument.Load(settingsFile).Descendants()
                                .FirstOrDefault(item => item.Name.LocalName.Equals("mlc_path", StringComparison.OrdinalIgnoreCase))
                                ?.Value.Trim();
                            if (!string.IsNullOrWhiteSpace(mlcPath)) candidates.Add(Path.Combine(mlcPath, "usr", "title"));
                        }
                        catch { }
                    }
                    break;
                case "azahar":
                case "citra":
                    string appName = catalogId.Equals("azahar", StringComparison.OrdinalIgnoreCase) ? "Azahar" : "Citra";
                    candidates.Add(Path.Combine(roaming, appName, "sdmc", "Nintendo 3DS"));
                    candidates.Add(Path.Combine(executableFolder, "user", "sdmc", "Nintendo 3DS"));
                    break;
                case "shadps4":
                    candidates.Add(Path.Combine(executableFolder, "user", "game"));
                    candidates.Add(Path.Combine(roaming, "shadPS4", "user", "game"));
                    break;
            }

            return candidates
                .Where(Directory.Exists)
                .Select(NormalizeEmulatorRomPath)
                .Distinct(StringComparer.OrdinalIgnoreCase);
        }

        private List<EmulatorRomPreview> ScanEmulatorRoms(
            string executablePath,
            string catalogId,
            IReadOnlyCollection<string> romFolders,
            IReadOnlyCollection<string> requestedExtensions)
        {
            var catalog = EmulatorCatalog.FirstOrDefault(entry => entry.Id == catalogId) ?? DetectEmulator(executablePath);
            string scanMode = catalog?.ScanMode ?? "files";
            var extensions = new HashSet<string>(
                (requestedExtensions.Count > 0 ? requestedExtensions : catalog?.Extensions ?? Array.Empty<string>())
                    .Select(ext => ext.StartsWith('.') ? ext.ToLowerInvariant() : "." + ext.ToLowerInvariant()),
                StringComparer.OrdinalIgnoreCase);
            if ((catalog?.Id ?? catalogId).Equals("duckstation", StringComparison.OrdinalIgnoreCase))
                extensions.Add(".m3u");
            var results = new List<EmulatorRomPreview>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var configuredRomFolders = romFolders.Where(Directory.Exists)
                .Select(NormalizeEmulatorRomPath)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var scanFolders = configuredRomFolders
                .Select(path => (Path: path, IsConfigured: true))
                .Concat(GetInternalEmulatorLibraryRoots(executablePath, catalog?.Id ?? catalogId)
                    .Select(path => (Path: NormalizeEmulatorRomPath(path), IsConfigured: false)))
                .GroupBy(item => item.Path, StringComparer.OrdinalIgnoreCase)
                .Select(group => (Path: group.Key, IsConfigured: group.Any(item => item.IsConfigured)))
                .ToList();

            foreach (var scanFolder in scanFolders)
            {
                string folder = scanFolder.Path;
                foreach (string file in EnumerateFilesSafely(folder))
                {
                    string fileName = Path.GetFileName(file);
                    string extension = Path.GetExtension(file);
                    bool include = extensions.Contains(extension);
                    if (scanMode == "rpcs3")
                    {
                        var gameDirectory = FindParentContainingFile(file, "PARAM.SFO");
                        include = fileName.Equals("EBOOT.BIN", StringComparison.OrdinalIgnoreCase) &&
                                  gameDirectory != null &&
                                  IsRpcS3InternalInstalledGame(file, gameDirectory);
                    }
                    else if (scanMode == "vita3k")
                        include = extensions.Contains(extension) ||
                                  (fileName.Equals("eboot.bin", StringComparison.OrdinalIgnoreCase) &&
                                   FindVitaAppRoot(file) != null);
                    else if ((scanMode == "citra" || scanMode == "azahar") &&
                             extension.Equals(".app", StringComparison.OrdinalIgnoreCase) &&
                             file.Contains($"{Path.DirectorySeparatorChar}title{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase))
                        // 00040000 is the Nintendo 3DS base-application category. Exclude updates,
                        // DLC and system titles from an installed SD/NAND library scan.
                        include = file.Contains(
                            $"{Path.DirectorySeparatorChar}title{Path.DirectorySeparatorChar}00040000{Path.DirectorySeparatorChar}",
                            StringComparison.OrdinalIgnoreCase);
                    else if (scanMode == "cemu" && extension.Equals(".rpx", StringComparison.OrdinalIgnoreCase))
                        include = Directory.GetParent(file)?.Name.Equals("code", StringComparison.OrdinalIgnoreCase) == true;
                    else if (scanMode == "shadps4")
                        include = fileName.Equals("eboot.bin", StringComparison.OrdinalIgnoreCase) &&
                                  Regex.IsMatch(file, @"[\\/]CUSA\d+[\\/]", RegexOptions.IgnoreCase);

                    if (!include || !seen.Add(Path.GetFullPath(file))) continue;
                    if (extension.Equals(".bin", StringComparison.OrdinalIgnoreCase) && File.Exists(Path.ChangeExtension(file, ".cue")))
                        continue;

                    string launchValue = file;
                    if (scanMode == "shadps4")
                    {
                        var match = Regex.Match(file, @"[\\/](CUSA\d+)[\\/]", RegexOptions.IgnoreCase);
                        launchValue = match.Success ? match.Groups[1].Value.ToUpperInvariant() : file;
                    }
                    var metadata = ReadEmulatorMetadata(file, executablePath, catalog?.Id ?? catalogId, scanMode);
                    if (scanMode == "vita3k" && !string.IsNullOrWhiteSpace(metadata.TitleId))
                        launchValue = metadata.TitleId;
                    var discPaths = extension.Equals(".m3u", StringComparison.OrdinalIgnoreCase)
                        ? ReadM3uDiscPaths(file)
                        : new List<string> { file };
                    string relativePath = Path.GetRelativePath(folder, file);
                    results.Add(new EmulatorRomPreview
                    {
                        Id = EmulatorStableId(executablePath + "|" + file),
                        Name = metadata.Name,
                        DetectedName = metadata.Name,
                        RomPath = file,
                        LaunchValue = launchValue,
                        DiscPaths = discPaths.Count > 0 ? discPaths : new List<string> { file },
                        TitleId = metadata.TitleId,
                        IsFromConfiguredRomFolder = scanFolder.IsConfigured,
                        HasResolvedMetadataName = metadata.HasResolvedName,
                        RelativeDepth = relativePath.Count(character =>
                            character == Path.DirectorySeparatorChar || character == Path.AltDirectorySeparatorChar)
                    });
                }
            }

            var deduplicated = results
                .GroupBy(item => !string.IsNullOrWhiteSpace(item.TitleId)
                    ? "title:" + item.TitleId
                    : "path:" + NormalizeEmulatorRomPath(item.RomPath), StringComparer.OrdinalIgnoreCase)
                .Select(group => group
                    .OrderByDescending(item => item.IsFromConfiguredRomFolder)
                    .ThenByDescending(item => item.HasResolvedMetadataName)
                    .ThenBy(item => item.RelativeDepth)
                    .ThenBy(item => item.RomPath, StringComparer.OrdinalIgnoreCase)
                    .First())
                .OrderBy(item => item.Name, StringComparer.CurrentCultureIgnoreCase)
                .ToList();
            return GroupMultiDiscEmulatorGames(executablePath, catalog?.Id ?? catalogId, deduplicated);
        }

        private List<InstalledApp> BuildEmulatorInstalledApps()
        {
            var existingGames = LoadGames();
            var result = new List<InstalledApp>();
            foreach (var config in LoadEmulatorConfigs())
            {
                List<EmulatorRomPreview> scanned;
                try
                {
                    scanned = ScanEmulatorRoms(
                        config.ExecutablePath,
                        config.CatalogId,
                        config.RomFolders,
                        config.Extensions);
                }
                catch { continue; }

                foreach (var preview in scanned)
                {
                    var previewPaths = (preview.DiscPaths.Count > 0 ? preview.DiscPaths : new List<string> { preview.RomPath })
                        .Select(NormalizeEmulatorRomPath)
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);
                    bool isAdded = existingGames.Any(game =>
                        game.EmulatorId.Equals(config.Id, StringComparison.OrdinalIgnoreCase) &&
                        (game.EmulatorDiscPaths?.Count > 0 ? game.EmulatorDiscPaths : new List<string> { game.RomPath })
                            .Select(NormalizeEmulatorRomPath)
                            .Any(previewPaths.Contains));
                    result.Add(new InstalledApp
                    {
                        Name = preview.Name,
                        Path = preview.RomPath,
                        Source = "Emulador",
                        IsAdded = isAdded,
                        AddedTo = isAdded ? "game" : "",
                        AddState = isAdded ? "added" : "",
                        EmulatorId = config.Id,
                        RomPath = preview.RomPath,
                        EmulatorDiscPaths = preview.DiscPaths,
                        LaunchCommand = ExpandEmulatorLaunchTemplate(config, preview.RomPath, preview.LaunchValue),
                        EmulatorDetectedName = preview.DetectedName
                    });
                }
            }
            return result
                .GroupBy(item => item.EmulatorId + "|" + NormalizeEmulatorRomPath(item.RomPath), StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .ToList();
        }

        private async Task<string> FetchFirstEmulatorGridUrlAsync(string gameName)
        {
            var ids = await ResolveSteamGridGameIdsAsync(gameName).ConfigureAwait(false);
            if (ids.Count == 0) return "";
            return await GetFirstImageUrl($"grids/game/{ids[0]}?dimensions=600x900,342x482,660x930&types=static&sort=score&nsfw=false")
                .ConfigureAwait(false) ?? "";
        }

        private async Task PopulateEmulatorArtworkUrlsAsync(EmulatorRomPreview game)
        {
            var assets = await FetchSteamGridAssetsAsync(game.Name).ConfigureAwait(false);
            game.GridUrl = assets.Item1 ?? "";
            game.HorizontalUrl = assets.Item2 ?? "";
            game.HeroUrl = assets.Item3 ?? "";
            game.LogoUrl = assets.Item4 ?? "";
        }

        private async Task PreviewEmulatorLibraryAsync(
            string requestId,
            string executablePath,
            string catalogId,
            List<string> romFolders,
            List<string> extensions,
            CancellationToken token)
        {
            try
            {
                var games = await Task.Run(() => ScanEmulatorRoms(executablePath, catalogId, romFolders, extensions), token)
                    .ConfigureAwait(false);
                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "emulatorLibraryDiscovered",
                    requestId,
                    games
                })));

                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "emulatorLibraryScanComplete",
                    requestId,
                    total = games.Count
                })));

                using var gate = new SemaphoreSlim(4);
                int completed = 0;
                var artworkTasks = games.Select(async game =>
                {
                    await gate.WaitAsync(token).ConfigureAwait(false);
                    try
                    {
                        game.GridUrl = await FetchFirstEmulatorGridUrlAsync(game.Name).ConfigureAwait(false);
                    }
                    catch { game.GridUrl = ""; }
                    finally { gate.Release(); }

                    int current = Interlocked.Increment(ref completed);
                    if (!token.IsCancellationRequested)
                    {
                        Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "emulatorGameArtworkFound",
                            requestId,
                            gameId = game.Id,
                            gridUrl = game.GridUrl,
                            completed = current,
                            total = games.Count
                        })));
                    }
                });
                await Task.WhenAll(artworkTasks).ConfigureAwait(false);

                if (!token.IsCancellationRequested)
                {
                    Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "emulatorLibraryArtworkComplete",
                        requestId,
                        total = games.Count
                    })));
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                Debug.WriteLine("[Emulators] Prévia falhou: " + ex.Message);
                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "emulatorLibraryPreviewFailed",
                    requestId,
                    message = ex.Message
                })));
            }
            finally
            {
                if (_emulatorPreviewRequests.TryRemove(requestId, out var source)) source.Dispose();
            }
        }

        private static string ExpandEmulatorLaunchTemplate(EmulatorConfigModel config, string romPath, string launchValue)
        {
            string titleId = Regex.IsMatch(launchValue, @"^(?:CUSA\d+|[A-Z]{4}\d{5}|[0-9A-F]{16})$", RegexOptions.IgnoreCase)
                ? launchValue.ToUpperInvariant()
                : "";
            return config.LaunchTemplate
                .Replace("{emulator}", QuoteEmulatorArgument(config.ExecutablePath), StringComparison.OrdinalIgnoreCase)
                .Replace("{rom}", QuoteEmulatorArgument(romPath), StringComparison.OrdinalIgnoreCase)
                .Replace("{titleId}", QuoteEmulatorArgument(titleId), StringComparison.OrdinalIgnoreCase)
                .Trim();
        }

        private async Task SaveEmulatorAndGamesAsync(JsonElement root)
        {
            if (!root.TryGetProperty("config", out var configEl) || configEl.ValueKind != JsonValueKind.Object)
                return;

            string executablePath = GetStr(configEl, "executablePath").Trim();
            string name = GetStr(configEl, "name").Trim();
            string catalogId = GetStr(configEl, "catalogId", "custom").Trim();
            string launchTemplate = GetStr(configEl, "launchTemplate").Trim();
            var romFolders = ReadStringArray(configEl, "romFolders").Where(Directory.Exists).Select(Path.GetFullPath).ToList();
            var extensions = ReadStringArray(configEl, "extensions");
            bool supportsInternalLibrary = EmulatorCatalog.Any(item =>
                item.Id.Equals(catalogId, StringComparison.OrdinalIgnoreCase) && item.SupportsInternalLibrary);
            if (!File.Exists(executablePath) || string.IsNullOrWhiteSpace(name) ||
                string.IsNullOrWhiteSpace(launchTemplate) || (!supportsInternalLibrary && romFolders.Count == 0) ||
                (!launchTemplate.Contains("{rom}", StringComparison.OrdinalIgnoreCase) &&
                 !launchTemplate.Contains("{titleId}", StringComparison.OrdinalIgnoreCase)))
                return;

            var configs = LoadEmulatorConfigs();
            string requestedId = GetStr(configEl, "id").Trim();
            var previousConfig = !string.IsNullOrWhiteSpace(requestedId)
                ? configs.FirstOrDefault(item => item.Id.Equals(requestedId, StringComparison.OrdinalIgnoreCase))
                : null;
            string configId = previousConfig?.Id ?? EmulatorStableId(executablePath);
            string requestedGridSource = GetStr(configEl, "gridSourceUrl").Trim();
            string requestedGridImage = GetStr(configEl, "gridImage").Trim();
            bool artworkChanged = !string.IsNullOrWhiteSpace(requestedGridSource) &&
                !string.Equals(requestedGridSource, previousConfig?.GridSourceUrl, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(requestedGridSource, previousConfig?.GridImage, StringComparison.OrdinalIgnoreCase);
            string desiredArtworkQuery = catalogId.Equals("eden", StringComparison.OrdinalIgnoreCase)
                ? "Eden emulator"
                : name;
            var config = new EmulatorConfigModel
            {
                Id = configId,
                CatalogId = string.IsNullOrWhiteSpace(catalogId) ? "custom" : catalogId,
                Name = name,
                ExecutablePath = Path.GetFullPath(executablePath),
                LaunchTemplate = launchTemplate,
                RomFolders = romFolders,
                Extensions = extensions,
                GridImage = artworkChanged ? requestedGridImage : previousConfig?.GridImage ?? requestedGridImage,
                GridSourceUrl = !string.IsNullOrWhiteSpace(requestedGridSource) ? requestedGridSource : previousConfig?.GridSourceUrl ?? "",
                ArtworkQuery = artworkChanged ? desiredArtworkQuery : previousConfig?.ArtworkQuery ?? "",
                DateAdded = previousConfig?.DateAdded ?? DateTime.Now
            };

            var previewGames = new List<EmulatorRomPreview>();
            var allowedLibraryRoots = romFolders
                .Concat(GetInternalEmulatorLibraryRoots(executablePath, catalogId))
                .Select(NormalizeEmulatorRomPath)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (root.TryGetProperty("games", out var gamesEl) && gamesEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in gamesEl.EnumerateArray())
                {
                    string romPath = GetStr(item, "romPath").Trim();
                    if (!File.Exists(romPath)) continue;
                    string fullRomPath = Path.GetFullPath(romPath);
                    bool insideConfiguredFolder = allowedLibraryRoots.Any(folder =>
                        fullRomPath.StartsWith(folder.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase));
                    if (!insideConfiguredFolder) continue;
                    var submittedDiscPaths = ReadStringArray(item, "discPaths")
                        .Select(path =>
                        {
                            try { return Path.GetFullPath(path); }
                            catch { return ""; }
                        })
                        .Where(path => File.Exists(path) && allowedLibraryRoots.Any(folder =>
                            path.StartsWith(folder.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();
                    if (submittedDiscPaths.Count == 0)
                        submittedDiscPaths.Add(fullRomPath);

                    previewGames.Add(new EmulatorRomPreview
                    {
                        Id = GetStr(item, "id", EmulatorStableId(executablePath + "|" + fullRomPath)),
                        Name = GetStr(item, "name", Path.GetFileNameWithoutExtension(fullRomPath)).Trim(),
                        DetectedName = GetStr(item, "detectedName", GetStr(item, "name", Path.GetFileNameWithoutExtension(fullRomPath))).Trim(),
                        RomPath = fullRomPath,
                        LaunchValue = GetStr(item, "launchValue", fullRomPath),
                        DiscPaths = submittedDiscPaths,
                        TitleId = GetStr(item, "titleId").Trim(),
                        GridUrl = GetStr(item, "gridUrl").Trim(),
                        HorizontalUrl = GetStr(item, "horizontalUrl").Trim(),
                        HeroUrl = GetStr(item, "heroUrl").Trim(),
                        LogoUrl = GetStr(item, "logoUrl").Trim()
                    });
                }
            }

            int existingConfigIndex = configs.FindIndex(item => item.Id.Equals(configId, StringComparison.OrdinalIgnoreCase));
            if (existingConfigIndex >= 0)
            {
                config.DateAdded = configs[existingConfigIndex].DateAdded;
                configs[existingConfigIndex] = config;
            }
            else configs.Add(config);
            SaveEmulatorConfigs(configs);

            var games = LoadGames();
            var retainedPaths = previewGames.Select(item => item.RomPath).ToHashSet(StringComparer.OrdinalIgnoreCase);
            foreach (var stale in games.Where(game =>
                string.Equals(game.EmulatorId, configId, StringComparison.OrdinalIgnoreCase) &&
                !retainedPaths.Contains(game.RomPath)).ToList())
            {
                DeleteGameImages(stale);
                games.Remove(stale);
            }
            var addedIds = new List<string>();
            foreach (var preview in previewGames)
            {
                string launchCommand = ExpandEmulatorLaunchTemplate(config, preview.RomPath, preview.LaunchValue);
                var existing = games.FirstOrDefault(game =>
                    string.Equals(game.EmulatorId, configId, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(game.RomPath, preview.RomPath, StringComparison.OrdinalIgnoreCase));
                if (existing == null && previousConfig != null &&
                    (preview.DiscPaths.Count > 0 ? preview.DiscPaths : new List<string> { preview.RomPath })
                        .Any(path => IsEmulatorGameSuppressed(configId, path)))
                    continue;
                bool newlyAdded = existing == null;
                if (existing == null)
                {
                    existing = new GameModel
                    {
                        DateAdded = DateTime.Now,
                        LastPlayed = DateTime.MinValue,
                        EmulatorId = configId,
                        RomPath = preview.RomPath,
                        Path = preview.RomPath,
                        Source = "emulator"
                    };
                    games.Add(existing);
                }
                existing.Name = string.IsNullOrWhiteSpace(preview.Name) ? Path.GetFileNameWithoutExtension(preview.RomPath) : preview.Name;
                existing.EmulatorDetectedName = string.IsNullOrWhiteSpace(preview.DetectedName) ? existing.Name : preview.DetectedName;
                existing.EmulatorDiscPaths = preview.DiscPaths.Count > 0
                    ? preview.DiscPaths.Distinct(StringComparer.OrdinalIgnoreCase).ToList()
                    : new List<string> { preview.RomPath };
                existing.LaunchCommand = launchCommand;
                if (!string.IsNullOrWhiteSpace(preview.GridUrl))
                {
                    existing.GridImage = preview.GridUrl;
                    existing.GridStaticImage = "";
                    existing.GridSourceUrl = preview.GridUrl;
                }
                if (!string.IsNullOrWhiteSpace(preview.HorizontalUrl))
                {
                    existing.GridHorizontalImage = preview.HorizontalUrl;
                    existing.GridHorizontalStaticImage = "";
                    existing.GridHorizontalSourceUrl = preview.HorizontalUrl;
                }
                if (!string.IsNullOrWhiteSpace(preview.HeroUrl))
                {
                    existing.HeroImage = preview.HeroUrl;
                    existing.HeroStaticImage = "";
                    existing.HeroSourceUrl = preview.HeroUrl;
                }
                if (!string.IsNullOrWhiteSpace(preview.LogoUrl))
                {
                    existing.LogoImage = preview.LogoUrl;
                    existing.LogoStaticImage = "";
                }
                existing.IsPendingArtwork = true;
                existing.ArtworkSource = "pending";
                if (newlyAdded) addedIds.Add(existing.Path);
            }
            SaveGames(games);

            Dispatcher.Invoke(() =>
            {
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "emulatorConfigurationSaved",
                    emulator = config,
                    gameIds = addedIds,
                    total = addedIds.Count,
                    artworkTotal = previewGames.Count
                }));
                // Os jogos ja estao persistidos e possuem fallback visual. Publique a
                // biblioteca agora para que os patches de arte subsequentes encontrem
                // os cards no AppStore, sem depender de abrir/fechar um jogo.
                LoadGamesIntoUI();
                SendEmulatorsToUi();
            });

            string userAtStart = currentUserId;
            _ = Task.Run(() => DownloadPendingEmulatorCoversAsync(userAtStart));
            _ = Task.Run(() => EnsureEmulatorArtworkAsync(configId, userAtStart));
            await Task.CompletedTask;
        }

        private async Task DownloadPendingEmulatorCoversAsync(string userAtStart)
        {
            if (Interlocked.CompareExchange(ref _emulatorCoverDownloadRunning, 1, 0) != 0) return;
            try
            {
                var pending = LoadGames()
                    .Where(game => !string.IsNullOrWhiteSpace(game.EmulatorId) && game.IsPendingArtwork)
                    .Select(game => new { game.EmulatorId, game.RomPath, game.Name })
                    .ToList();
                int completed = 0;
                foreach (var cover in pending)
                {
                    if (!string.Equals(currentUserId, userAtStart, StringComparison.OrdinalIgnoreCase)) return;
                    try
                    {
                        var currentGames = LoadGames();
                        var game = currentGames.FirstOrDefault(item =>
                            string.Equals(item.EmulatorId, cover.EmulatorId, StringComparison.OrdinalIgnoreCase) &&
                            string.Equals(item.RomPath, cover.RomPath, StringComparison.OrdinalIgnoreCase));
                        if (game != null)
                        {
                            string gridUrl = RemoteArtworkSource(game.GridSourceUrl, game.GridImage);
                            string horizontalUrl = RemoteArtworkSource(game.GridHorizontalSourceUrl, game.GridHorizontalImage);
                            string heroUrl = RemoteArtworkSource(game.HeroSourceUrl, game.HeroImage);
                            string logoUrl = RemoteArtworkSource("", game.LogoImage);
                            if (string.IsNullOrWhiteSpace(gridUrl) || string.IsNullOrWhiteSpace(horizontalUrl) ||
                                string.IsNullOrWhiteSpace(heroUrl) || string.IsNullOrWhiteSpace(logoUrl))
                            {
                                var assets = await FetchSteamGridAssetsAsync(game.Name).ConfigureAwait(false);
                                gridUrl = string.IsNullOrWhiteSpace(gridUrl) ? assets.Item1 ?? "" : gridUrl;
                                horizontalUrl = string.IsNullOrWhiteSpace(horizontalUrl) ? assets.Item2 ?? "" : horizontalUrl;
                                heroUrl = string.IsNullOrWhiteSpace(heroUrl) ? assets.Item3 ?? "" : heroUrl;
                                logoUrl = string.IsNullOrWhiteSpace(logoUrl) ? assets.Item4 ?? "" : logoUrl;
                            }

                            string safeName = "emu_" + EmulatorStableId(cover.EmulatorId + "|" + cover.RomPath);
                            var gridTask = DownloadRemoteEmulatorArtworkAsync(gridUrl, gridFolder, safeName + "_grid", "grid");
                            var horizontalTask = DownloadRemoteEmulatorArtworkAsync(horizontalUrl, gridHorizontalFolder, safeName + "_h", "grid-horizontal");
                            var heroTask = DownloadRemoteEmulatorArtworkAsync(heroUrl, heroFolder, safeName + "_hero", "hero");
                            var logoTask = DownloadRemoteEmulatorArtworkAsync(logoUrl, logoFolder, safeName + "_logo", "logo");
                            await Task.WhenAll(gridTask, horizontalTask, heroTask, logoTask).ConfigureAwait(false);

                            if (!string.IsNullOrWhiteSpace(gridTask.Result))
                            {
                                game.GridImage = gridTask.Result;
                                game.GridStaticImage = "";
                            }
                            if (!string.IsNullOrWhiteSpace(horizontalTask.Result))
                            {
                                game.GridHorizontalImage = horizontalTask.Result;
                                game.GridHorizontalStaticImage = "";
                            }
                            if (!string.IsNullOrWhiteSpace(heroTask.Result))
                            {
                                game.HeroImage = heroTask.Result;
                                game.HeroStaticImage = "";
                            }
                            if (!string.IsNullOrWhiteSpace(logoTask.Result))
                            {
                                game.LogoImage = logoTask.Result;
                                game.LogoStaticImage = "";
                            }
                            game.GridSourceUrl = gridUrl;
                            game.GridHorizontalSourceUrl = horizontalUrl;
                            game.HeroSourceUrl = heroUrl;
                            game.IsPendingArtwork = false;
                            game.ArtworkSource = !string.IsNullOrWhiteSpace(game.GridImage) ? "steamgriddb" : "no-art";
                            SaveGames(currentGames);
                            SendGameUpdateToUI(game);
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine("[Emulators] Download de capa falhou: " + ex.Message);
                        try
                        {
                            var currentGames = LoadGames();
                            var game = currentGames.FirstOrDefault(item =>
                                string.Equals(item.EmulatorId, cover.EmulatorId, StringComparison.OrdinalIgnoreCase) &&
                                string.Equals(item.RomPath, cover.RomPath, StringComparison.OrdinalIgnoreCase));
                            if (game != null)
                            {
                                game.IsPendingArtwork = false;
                                game.ArtworkSource = string.IsNullOrWhiteSpace(game.GridImage) ? "no-art" : game.ArtworkSource;
                                SaveGames(currentGames);
                                SendGameUpdateToUI(game);
                            }
                        }
                        catch { }
                    }
                    int progress = ++completed;
                    Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "emulatorArtworkDownloadProgress",
                        completed = progress,
                        total = pending.Count
                    })));
                }
                if (pending.Count > 0) Dispatcher.Invoke(() =>
                {
                    ClearPreparingGameSkeletons();
                });
            }
            finally
            {
                Interlocked.Exchange(ref _emulatorCoverDownloadRunning, 0);
                if (string.Equals(currentUserId, userAtStart, StringComparison.OrdinalIgnoreCase) &&
                    LoadGames().Any(game => !string.IsNullOrWhiteSpace(game.EmulatorId) && game.IsPendingArtwork))
                    _ = Task.Run(() => DownloadPendingEmulatorCoversAsync(userAtStart));
            }
        }

        private static string RemoteArtworkSource(string preferred, string fallback)
        {
            foreach (string value in new[] { preferred, fallback })
            {
                if (Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
                    (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps) &&
                    !uri.Host.Equals("data.local", StringComparison.OrdinalIgnoreCase)) return value;
            }
            return "";
        }

        private async Task<string> DownloadRemoteEmulatorArtworkAsync(string url, string folder, string name, string urlFolder)
        {
            if (string.IsNullOrWhiteSpace(url)) return "";
            string? local = await DownloadImageAsync(url, folder, name).ConfigureAwait(false);
            return string.IsNullOrWhiteSpace(local) ? "" : $"https://data.local/images/{urlFolder}/{Path.GetFileName(local)}";
        }

        private async Task EnsureEmulatorArtworkAsync(string emulatorId, string userAtStart)
        {
            try
            {
                var config = LoadEmulatorConfigs().FirstOrDefault(item => item.Id.Equals(emulatorId, StringComparison.OrdinalIgnoreCase));
                if (config == null) return;
                string artworkQuery = config.CatalogId.Equals("eden", StringComparison.OrdinalIgnoreCase)
                    ? "Eden emulator"
                    : config.Name;
                bool mustMigrateEdenQuery = config.CatalogId.Equals("eden", StringComparison.OrdinalIgnoreCase) &&
                    !config.ArtworkQuery.Equals(artworkQuery, StringComparison.OrdinalIgnoreCase);
                bool alreadyStoredLocally = !string.IsNullOrWhiteSpace(config.GridImage) &&
                    string.IsNullOrWhiteSpace(RemoteArtworkSource("", config.GridImage));
                if (alreadyStoredLocally && !mustMigrateEdenQuery) return;
                string source = mustMigrateEdenQuery ? "" : RemoteArtworkSource(config.GridSourceUrl, config.GridImage);
                if (string.IsNullOrWhiteSpace(source)) source = await FetchFirstEmulatorGridUrlAsync(artworkQuery).ConfigureAwait(false);
                if (string.IsNullOrWhiteSpace(source) || !string.Equals(currentUserId, userAtStart, StringComparison.OrdinalIgnoreCase)) return;
                string local = await DownloadRemoteEmulatorArtworkAsync(
                    source,
                    gridFolder,
                    "emulator_" + EmulatorStableId(config.Id + "|" + source),
                    "grid").ConfigureAwait(false);
                if (string.IsNullOrWhiteSpace(local)) return;
                var configs = LoadEmulatorConfigs();
                config = configs.FirstOrDefault(item => item.Id.Equals(emulatorId, StringComparison.OrdinalIgnoreCase));
                if (config == null) return;
                config.GridSourceUrl = source;
                config.GridImage = local;
                config.ArtworkQuery = artworkQuery;
                SaveEmulatorConfigs(configs);
                Dispatcher.Invoke(SendEmulatorsToUi);
            }
            catch (Exception ex) { Debug.WriteLine("[Emulators] Arte do emulador falhou: " + ex.Message); }
        }

        private void ScheduleEmulatorLibraryReconcile(bool force = false)
        {
            if (!File.Exists(EmulatorConfigFile)) return;
            UpgradeKnownEmulatorTemplates();
            long now = DateTime.UtcNow.Ticks;
            long last = Interlocked.Read(ref _lastEmulatorReconcileUtcTicks);
            if (!force && last > 0 && now - last < TimeSpan.FromMinutes(2).Ticks) return;
            if (Interlocked.CompareExchange(ref _emulatorReconcileRunning, 1, 0) != 0)
            {
                // Uma checagem solicitada enquanto outra está rodando não pode se
                // perder: o emulador/explorador pode ainda estar terminando de
                // gravar a biblioteca no momento da primeira fotografia.
                Interlocked.Exchange(ref _emulatorReconcilePending, 1);
                return;
            }
            Interlocked.Exchange(ref _lastEmulatorReconcileUtcTicks, now);
            _ = Task.Run(ReconcileEmulatorLibrariesAsync);
        }

        private void ScheduleEmulatorLibraryReconcileAfterExternalMutation(
            int delayMilliseconds = 1200)
        {
            string userAtRequest = currentUserId;
            _ = Task.Run(async () =>
            {
                await Task.Delay(Math.Max(0, delayMilliseconds)).ConfigureAwait(false);
                if (!string.Equals(
                        currentUserId,
                        userAtRequest,
                        StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                ScheduleEmulatorLibraryReconcile(force: true);
            });
        }

        private async Task ReconcileEmulatorLibrariesAsync()
        {
            string userAtStart = currentUserId;
            try
            {
                var configs = LoadEmulatorConfigs();
                if (configs.Count == 0) return;

                var scannedByConfig = new Dictionary<string, List<EmulatorRomPreview>>(StringComparer.OrdinalIgnoreCase);
                foreach (var config in configs)
                {
                    if (!string.Equals(currentUserId, userAtStart, StringComparison.OrdinalIgnoreCase)) return;
                    var scanned = await Task.Run(() => ScanEmulatorRoms(
                        config.ExecutablePath,
                        config.CatalogId,
                        config.RomFolders,
                        config.Extensions)).ConfigureAwait(false);
                    scannedByConfig[config.Id] = scanned;
                }

                if (!string.Equals(currentUserId, userAtStart, StringComparison.OrdinalIgnoreCase)) return;
                var games = LoadGames();
                int removed = 0;
                int updated = 0;
                var added = new List<(EmulatorConfigModel Config, EmulatorRomPreview Preview)>();

                foreach (var config in configs)
                {
                    var scanned = scannedByConfig[config.Id];
                    var currentPaths = scanned.Select(item => Path.GetFullPath(item.RomPath))
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);
                    foreach (var stale in games.Where(game =>
                        string.Equals(game.EmulatorId, config.Id, StringComparison.OrdinalIgnoreCase) &&
                        (string.IsNullOrWhiteSpace(game.RomPath) || !currentPaths.Contains(Path.GetFullPath(game.RomPath)))).ToList())
                    {
                        DeleteGameImages(stale);
                        games.Remove(stale);
                        removed++;
                    }

                    foreach (var preview in scanned)
                    {
                        var existing = games.FirstOrDefault(game =>
                            string.Equals(game.EmulatorId, config.Id, StringComparison.OrdinalIgnoreCase) &&
                            string.Equals(game.RomPath, preview.RomPath, StringComparison.OrdinalIgnoreCase));
                        if (existing != null)
                        {
                            string oldName = existing.Name;
                            string oldDetectedName = existing.EmulatorDetectedName;
                            string oldCommand = existing.LaunchCommand;
                            string oldDiscPaths = string.Join("|", existing.EmulatorDiscPaths ?? new List<string>());
                            bool canRefreshDetectedName = string.IsNullOrWhiteSpace(existing.EmulatorDetectedName) ||
                                existing.Name.Equals(existing.EmulatorDetectedName, StringComparison.Ordinal);
                            if (canRefreshDetectedName) existing.Name = preview.Name;
                            existing.EmulatorDetectedName = preview.Name;
                            existing.EmulatorDiscPaths = preview.DiscPaths.Count > 0
                                ? preview.DiscPaths.Distinct(StringComparer.OrdinalIgnoreCase).ToList()
                                : new List<string> { preview.RomPath };
                            existing.LaunchCommand = ExpandEmulatorLaunchTemplate(config, preview.RomPath, preview.LaunchValue);
                            if (!oldName.Equals(existing.Name, StringComparison.Ordinal) ||
                                !oldDetectedName.Equals(existing.EmulatorDetectedName, StringComparison.Ordinal) ||
                                !oldCommand.Equals(existing.LaunchCommand, StringComparison.Ordinal) ||
                                !oldDiscPaths.Equals(string.Join("|", existing.EmulatorDiscPaths), StringComparison.OrdinalIgnoreCase)) updated++;
                            continue;
                        }
                        if ((preview.DiscPaths.Count > 0 ? preview.DiscPaths : new List<string> { preview.RomPath })
                            .Any(path => IsEmulatorGameSuppressed(config.Id, path))) continue;
                        games.Add(new GameModel
                        {
                            Name = preview.Name,
                            EmulatorDetectedName = preview.Name,
                            Path = preview.RomPath,
                            RomPath = preview.RomPath,
                            EmulatorDiscPaths = preview.DiscPaths.Count > 0
                                ? preview.DiscPaths.Distinct(StringComparer.OrdinalIgnoreCase).ToList()
                                : new List<string> { preview.RomPath },
                            EmulatorId = config.Id,
                            LaunchCommand = ExpandEmulatorLaunchTemplate(config, preview.RomPath, preview.LaunchValue),
                            Source = "emulator",
                            DateAdded = DateTime.Now,
                            LastPlayed = DateTime.MinValue,
                            IsPendingArtwork = true,
                            ArtworkSource = "pending"
                        });
                        added.Add((config, preview));
                    }
                }

                if (removed > 0 || added.Count > 0 || updated > 0)
                {
                    SaveGames(games);
                    Dispatcher.Invoke(() =>
                    {
                        if (!string.Equals(currentUserId, userAtStart, StringComparison.OrdinalIgnoreCase)) return;
                        webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "emulatorLibraryReconciled",
                            added = added.Count,
                            gameIds = added.Select(item => item.Preview.RomPath).ToList(),
                            removed,
                            updated
                        }));
                        // Marque os IDs novos antes do render completo e publique os
                        // cards imediatamente; o download de artes apenas os atualiza.
                        LoadGamesIntoUI();
                    });
                }

                _ = Task.Run(() => DownloadPendingEmulatorCoversAsync(userAtStart));
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Emulators] Reconciliação falhou: " + ex.Message);
            }
            finally
            {
                Interlocked.Exchange(ref _emulatorReconcileRunning, 0);
                if (Interlocked.Exchange(ref _emulatorReconcilePending, 0) == 1)
                    ScheduleEmulatorLibraryReconcile(force: true);
            }
        }

        private async Task<bool> TryHandleEmulatorMessageAsync(string action, JsonElement root)
        {
            if (action == "requestEmulators")
            {
                UpgradeKnownEmulatorTemplates();
                SendEmulatorsToUi();
                string userAtStart = currentUserId;
                foreach (var config in LoadEmulatorConfigs().Where(item =>
                    string.IsNullOrWhiteSpace(item.GridImage) ||
                    !string.IsNullOrWhiteSpace(RemoteArtworkSource("", item.GridImage)) ||
                    (item.CatalogId.Equals("eden", StringComparison.OrdinalIgnoreCase) &&
                     !item.ArtworkQuery.Equals("Eden emulator", StringComparison.OrdinalIgnoreCase))))
                    _ = Task.Run(() => EnsureEmulatorArtworkAsync(config.Id, userAtStart));
                ScheduleEmulatorLibraryReconcile(force: true);
                return true;
            }
            if (action == "browseEmulatorExecutable")
            {
                await Dispatcher.InvokeAsync(async () =>
                {
                    string? selectedFile = await ShowDoorpiFileBrowserAsync(
                        GetStr(root, "dialogTitle", "Selecione o executável do emulador"),
                        false,
                        "Executáveis (*.exe)|*.exe|Todos os arquivos (*.*)|*.*",
                        "emulatorExecutable",
                        GetStr(root, "initialPath"));
                    var detected = !string.IsNullOrWhiteSpace(selectedFile) ? DetectEmulator(selectedFile) : null;
                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "emulatorExecutableSelected",
                        path = selectedFile ?? "",
                        detected = detected != null ? EmulatorCatalogPayload(detected) : null
                    }));
                }).Task.Unwrap();
                return true;
            }
            if (action == "browseEmulatorRomFolder")
            {
                string slotId = GetStr(root, "slotId");
                await Dispatcher.InvokeAsync(async () =>
                {
                    string? selectedFolder = await ShowDoorpiFileBrowserAsync(
                        GetStr(root, "dialogTitle", "Selecione a pasta das ROMs"),
                        true,
                        source: "emulatorRoms",
                        initialPath: GetStr(root, "initialPath"));
                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "emulatorRomFolderSelected",
                        slotId,
                        path = selectedFolder ?? ""
                    }));
                }).Task.Unwrap();
                return true;
            }
            if (action == "previewEmulatorLibrary")
            {
                string requestId = GetStr(root, "requestId", Guid.NewGuid().ToString("N"));
                string executablePath = GetStr(root, "executablePath");
                string catalogId = GetStr(root, "catalogId", "custom");
                var romFolders = ReadStringArray(root, "romFolders");
                var extensions = ReadStringArray(root, "extensions");
                foreach (var existing in _emulatorPreviewRequests.Values) existing.Cancel();
                var source = new CancellationTokenSource();
                _emulatorPreviewRequests[requestId] = source;
                _ = PreviewEmulatorLibraryAsync(requestId, executablePath, catalogId, romFolders, extensions, source.Token);
                return true;
            }
            if (action == "searchEmulatorArtwork")
            {
                string requestId = GetStr(root, "requestId");
                string gameId = GetStr(root, "gameId");
                string query = GetStr(root, "query");
                _ = Task.Run(async () =>
                {
                    string gridUrl = await FetchFirstEmulatorGridUrlAsync(query).ConfigureAwait(false);
                    Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                    {
                        type = "emulatorArtworkSearchResult",
                        requestId,
                        gameId,
                        gridUrl
                    })));
                });
                return true;
            }
            if (action == "saveEmulatorConfiguration")
            {
                await SaveEmulatorAndGamesAsync(root).ConfigureAwait(false);
                return true;
            }
            if (action == "openConfiguredEmulator")
            {
                string emulatorId = GetStr(root, "emulatorId");
                var config = LoadEmulatorConfigs().FirstOrDefault(item => string.Equals(item.Id, emulatorId, StringComparison.OrdinalIgnoreCase));
                if (config != null && File.Exists(config.ExecutablePath))
                {
                    ScheduleEmulatorLibraryReconcile(force: true);
                    try
                    {
                        var baselineProcessIds = SnapshotProcessIds();
                        var process = Process.Start(new ProcessStartInfo
                        {
                            FileName = config.ExecutablePath,
                            WorkingDirectory = Path.GetDirectoryName(config.ExecutablePath) ?? "",
                            UseShellExecute = true
                        });
                        if (process == null)
                            throw new InvalidOperationException("O emulador não pôde ser iniciado.");

                        EnterMediaExeMode(
                            process,
                            config.ExecutablePath,
                            config.Name,
                            config.GridImage,
                            config.GridImage,
                            baselineProcessIds,
                            config.ExecutablePath,
                            closeProcessOnReturn: true,
                            allowControllerInput: false);
                        webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "emulatorOpenResult",
                            emulatorId,
                            success = true
                        }));
                    }
                    catch (Exception ex)
                    {
                        webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "emulatorOpenResult",
                            emulatorId,
                            success = false,
                            message = ex.Message
                        }));
                    }
                }
                return true;
            }
            if (action == "deleteConfiguredEmulator")
            {
                string emulatorId = GetStr(root, "emulatorId");
                var configs = LoadEmulatorConfigs();
                var config = configs.FirstOrDefault(item => item.Id.Equals(emulatorId, StringComparison.OrdinalIgnoreCase));
                if (config == null) return true;
                configs.Remove(config);
                SaveEmulatorConfigs(configs);
                RemoveEmulatorSuppressions(emulatorId);
                var games = LoadGames();
                int removed = 0;
                foreach (var game in games.Where(item => item.EmulatorId.Equals(emulatorId, StringComparison.OrdinalIgnoreCase)).ToList())
                {
                    DeleteGameImages(game);
                    games.Remove(game);
                    removed++;
                }
                SaveGames(games);
                LoadGamesIntoUI();
                SendEmulatorsToUi();
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                {
                    type = "emulatorDeleted",
                    emulatorId,
                    removed
                }));
                return true;
            }
            return false;
        }
    }
}
