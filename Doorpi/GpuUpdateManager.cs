using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Doorpi
{
    public sealed class GpuAdapterInfo
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Vendor { get; set; } = "";
        public string DriverVersion { get; set; } = "";
        public string DriverDate { get; set; } = "";
        public string Provider { get; set; } = "";
        public string DeviceId { get; set; } = "";
    }

    public sealed class GpuUpdaterApp
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Vendor { get; set; } = "";
        public string Path { get; set; } = "";
        public string Source { get; set; } = "manual";
        public DateTime AddedAt { get; set; } = DateTime.Now;
        public DateTime LastSeenAt { get; set; } = DateTime.MinValue;
        public string IconDataUrl { get; set; } = "";
        public string ImageUrl { get; set; } = "";
    }

    public sealed class GpuUpdateConfig
    {
        public List<GpuUpdaterApp> Updaters { get; set; } = new();
        public HashSet<string> SuppressedAutoIds { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    }

    public sealed class GpuUpdateStatus
    {
        public string Status { get; set; } = "idle";
        public string Message { get; set; } = "";
        public DateTimeOffset LastCheckedAt { get; set; } = DateTimeOffset.MinValue;
        public List<GpuAdapterInfo> Adapters { get; set; } = new();
        public List<GpuUpdaterApp> Updaters { get; set; } = new();
    }

    public sealed class GpuUpdateManager
    {
        private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
        private readonly string _configPath;
        private readonly object _lock = new();

        public GpuUpdateManager(string configPath)
        {
            _configPath = configPath;
        }

        public GpuUpdateStatus Refresh()
        {
            lock (_lock)
            {
                var config = LoadConfig();
                var adapters = DetectAdapters();
                var detected = DetectUpdaterApps();
                MergeDetected(config, detected);
                SaveConfig(config);

                return new GpuUpdateStatus
                {
                    Status = "ready",
                    Message = adapters.Count > 0
                        ? "Drivers de vídeo detectados."
                        : "Nenhuma placa de vídeo detectada pelo Windows.",
                    LastCheckedAt = DateTimeOffset.Now,
                    Adapters = adapters,
                    Updaters = config.Updaters
                        .Where(app => !string.IsNullOrWhiteSpace(app.Path))
                        .OrderBy(app => VendorRank(app.Vendor))
                        .ThenBy(app => app.Name)
                        .Select(WithRuntimeIcon)
                        .ToList()
                };
            }
        }

        public List<GpuAdapterInfo> ReadAdaptersOnly()
        {
            lock (_lock)
            {
                return DetectAdapters();
            }
        }

        public GpuUpdaterApp? FindUpdater(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return null;
            lock (_lock)
            {
                var updater = LoadConfig().Updaters.FirstOrDefault(app =>
                    string.Equals(app.Id, id, StringComparison.OrdinalIgnoreCase));
                return updater == null ? null : WithRuntimeIcon(updater);
            }
        }

        public GpuUpdaterApp? AddManualUpdater(string path)
        {
            if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
                return null;

            lock (_lock)
            {
                var config = LoadConfig();
                string fullPath = Path.GetFullPath(path);
                string id = "manual:" + StableHash(fullPath.ToLowerInvariant());
                var existing = config.Updaters.FirstOrDefault(app =>
                    string.Equals(app.Id, id, StringComparison.OrdinalIgnoreCase) ||
                    PathsEqual(app.Path, fullPath));

                string name = DisplayNameFromFile(fullPath);
                if (existing == null)
                {
                    existing = new GpuUpdaterApp
                    {
                        Id = id,
                        Name = name,
                        Vendor = GuessVendor(name + " " + fullPath),
                        Path = fullPath,
                        Source = "manual",
                        AddedAt = DateTime.Now,
                        LastSeenAt = DateTime.Now
                    };
                    config.Updaters.Add(existing);
                }
                else
                {
                    existing.Name = string.IsNullOrWhiteSpace(existing.Name) ? name : existing.Name;
                    existing.Path = fullPath;
                    existing.Source = string.IsNullOrWhiteSpace(existing.Source) ? "manual" : existing.Source;
                    existing.LastSeenAt = DateTime.Now;
                }

                SaveConfig(config);
                return existing;
            }
        }

        public void RemoveUpdater(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return;
            lock (_lock)
            {
                var config = LoadConfig();
                var existing = config.Updaters.FirstOrDefault(app =>
                    string.Equals(app.Id, id, StringComparison.OrdinalIgnoreCase));
                if (existing == null) return;

                config.Updaters.Remove(existing);
                if (string.Equals(existing.Source, "detected", StringComparison.OrdinalIgnoreCase))
                    config.SuppressedAutoIds.Add(existing.Id);

                SaveConfig(config);
            }
        }

        public bool SetUpdaterImage(string id, string imageUrl)
        {
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(imageUrl)) return false;
            lock (_lock)
            {
                var config = LoadConfig();
                var existing = config.Updaters.FirstOrDefault(app =>
                    string.Equals(app.Id, id, StringComparison.OrdinalIgnoreCase));
                if (existing == null) return false;

                if (string.Equals(existing.ImageUrl, imageUrl, StringComparison.OrdinalIgnoreCase))
                    return false;

                existing.ImageUrl = imageUrl;
                SaveConfig(config);
                return true;
            }
        }

        private GpuUpdateConfig LoadConfig()
        {
            try
            {
                if (!File.Exists(_configPath)) return new GpuUpdateConfig();
                return JsonSerializer.Deserialize<GpuUpdateConfig>(File.ReadAllText(_configPath)) ?? new GpuUpdateConfig();
            }
            catch
            {
                return new GpuUpdateConfig();
            }
        }

        private void SaveConfig(GpuUpdateConfig config)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_configPath)!);
            File.WriteAllText(_configPath, JsonSerializer.Serialize(config, JsonOptions));
        }

        private static void MergeDetected(GpuUpdateConfig config, List<GpuUpdaterApp> detected)
        {
            foreach (var app in detected)
            {
                if (config.SuppressedAutoIds.Contains(app.Id)) continue;

                var existing = config.Updaters.FirstOrDefault(current =>
                    string.Equals(current.Id, app.Id, StringComparison.OrdinalIgnoreCase) ||
                    PathsEqual(current.Path, app.Path));

                if (existing == null)
                {
                    app.Source = "detected";
                    app.AddedAt = DateTime.Now;
                    app.LastSeenAt = DateTime.Now;
                    config.Updaters.Add(app);
                    continue;
                }

                existing.Name = app.Name;
                existing.Vendor = app.Vendor;
                existing.Path = app.Path;
                existing.Source = "detected";
                existing.LastSeenAt = DateTime.Now;
                if (string.IsNullOrWhiteSpace(existing.ImageUrl))
                    existing.ImageUrl = app.ImageUrl;
            }
        }

        private static List<GpuAdapterInfo> DetectAdapters()
        {
            var result = new List<GpuAdapterInfo>();
            result.AddRange(DetectAdaptersFromDisplayClass());
            result.AddRange(DetectAdaptersFromEnumPci());

            return result
                .Where(adapter => !string.IsNullOrWhiteSpace(adapter.Name) &&
                                  !string.Equals(adapter.Vendor, "unknown", StringComparison.OrdinalIgnoreCase))
                .GroupBy(adapter => $"{adapter.Vendor}|{NormalizeAdapterKey(adapter.Name)}|{adapter.DriverVersion}", StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .OrderBy(adapter => VendorRank(adapter.Vendor))
                .ThenBy(adapter => adapter.Name)
                .ToList();
        }

        private static List<GpuAdapterInfo> DetectAdaptersFromDisplayClass()
        {
            var result = new List<GpuAdapterInfo>();
            try
            {
                using var baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
                using var classKey = baseKey.OpenSubKey(
                    @"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}");
                if (classKey == null) return result;

                foreach (string subName in classKey.GetSubKeyNames().Where(name => name.All(char.IsDigit)))
                {
                    using var sub = classKey.OpenSubKey(subName);
                    if (sub == null) continue;

                    string name = NormalizeDeviceName(ReadString(sub, "DriverDesc", "HardwareInformation.AdapterString", "Device Description"));
                    string provider = ReadString(sub, "ProviderName", "DriverProvider");
                    string version = ReadString(sub, "DriverVersion");
                    string date = ReadString(sub, "DriverDate");
                    string deviceId = ReadString(sub, "MatchingDeviceId", "HardwareID");
                    string haystack = $"{name} {provider} {deviceId}";
                    string vendor = GuessVendor(haystack);

                    if (string.IsNullOrWhiteSpace(name) ||
                        string.Equals(vendor, "unknown", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    result.Add(new GpuAdapterInfo
                    {
                        Id = StableHash($"{subName}|{name}|{deviceId}"),
                        Name = name,
                        Vendor = vendor,
                        DriverVersion = DisplayDriverVersion(vendor, version),
                        DriverDate = date,
                        Provider = provider,
                        DeviceId = deviceId
                    });
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[GpuUpdate] DetectAdaptersFromDisplayClass: " + ex.Message);
            }

            return result;
        }

        private static List<GpuAdapterInfo> DetectAdaptersFromEnumPci()
        {
            var result = new List<GpuAdapterInfo>();
            try
            {
                using var baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
                using var pciKey = baseKey.OpenSubKey(@"SYSTEM\CurrentControlSet\Enum\PCI");
                if (pciKey == null) return result;

                foreach (string deviceSubName in pciKey.GetSubKeyNames())
                {
                    string vendorFromId = GuessVendor(deviceSubName);
                    if (string.Equals(vendorFromId, "unknown", StringComparison.OrdinalIgnoreCase))
                        continue;

                    using var deviceKey = pciKey.OpenSubKey(deviceSubName);
                    if (deviceKey == null) continue;

                    foreach (string instanceName in deviceKey.GetSubKeyNames())
                    {
                        using var instanceKey = deviceKey.OpenSubKey(instanceName);
                        if (instanceKey == null) continue;

                        string classGuid = ReadString(instanceKey, "ClassGUID");
                        if (!string.Equals(classGuid, "{4d36e968-e325-11ce-bfc1-08002be10318}", StringComparison.OrdinalIgnoreCase))
                            continue;

                        string name = NormalizeDeviceName(ReadString(instanceKey, "FriendlyName", "DeviceDesc"));
                        string provider = "";
                        string version = "";
                        string date = "";
                        string driverRef = ReadString(instanceKey, "Driver");

                        if (!string.IsNullOrWhiteSpace(driverRef))
                        {
                            string normalizedRef = driverRef.TrimStart('\\');
                            using var driverKey = baseKey.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Class\" + normalizedRef);
                            if (driverKey != null)
                            {
                                name = FirstNonEmpty(name, NormalizeDeviceName(ReadString(driverKey, "DriverDesc", "HardwareInformation.AdapterString")));
                                provider = ReadString(driverKey, "ProviderName", "DriverProvider");
                                version = ReadString(driverKey, "DriverVersion");
                                date = ReadString(driverKey, "DriverDate");
                            }
                        }

                        string[] hardwareIds = ReadStringArray(instanceKey, "HardwareID");
                        string deviceId = hardwareIds.FirstOrDefault() ?? deviceSubName;
                        string vendor = GuessVendor($"{name} {provider} {deviceId} {deviceSubName}");
                        if (string.IsNullOrWhiteSpace(name) ||
                            string.Equals(vendor, "unknown", StringComparison.OrdinalIgnoreCase))
                            continue;

                        result.Add(new GpuAdapterInfo
                        {
                            Id = StableHash($"{deviceSubName}|{instanceName}|{deviceId}"),
                            Name = name,
                            Vendor = vendor,
                            DriverVersion = DisplayDriverVersion(vendor, version),
                            DriverDate = date,
                            Provider = provider,
                            DeviceId = deviceId
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[GpuUpdate] DetectAdaptersFromEnumPci: " + ex.Message);
            }

            return result;
        }

        private static List<GpuUpdaterApp> DetectUpdaterApps()
        {
            var candidates = new List<GpuUpdaterApp>();
            foreach (var app in EnumerateInstalledPrograms())
            {
                var match = MatchKnownUpdater(app.Name, app.Path);
                if (match == null) continue;

                string path = ResolveUpdaterPath(match.Value.Vendor, app.Path, app.InstallLocation);
                if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) continue;

                candidates.Add(new GpuUpdaterApp
                {
                    Id = "detected:" + match.Value.Id,
                    Name = match.Value.Name,
                    Vendor = match.Value.Vendor,
                    Path = path,
                    Source = "detected"
                });
            }

            foreach (var known in KnownUpdaterPaths())
            {
                if (!File.Exists(known.Path)) continue;
                candidates.Add(new GpuUpdaterApp
                {
                    Id = "detected:" + known.Id,
                    Name = known.Name,
                    Vendor = known.Vendor,
                    Path = known.Path,
                    Source = "detected"
                });
            }

            return candidates
                .GroupBy(app => app.Id, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .ToList();
        }

        private static IEnumerable<(string Name, string Path, string InstallLocation)> EnumerateInstalledPrograms()
        {
            foreach (var hive in new[] { Registry.LocalMachine, Registry.CurrentUser })
            {
                foreach (string root in new[]
                {
                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                    @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
                })
                {
                    using var key = hive.OpenSubKey(root);
                    if (key == null) continue;
                    foreach (string subName in key.GetSubKeyNames())
                    {
                        using var sub = key.OpenSubKey(subName);
                        if (sub == null) continue;
                        string name = ReadString(sub, "DisplayName");
                        if (string.IsNullOrWhiteSpace(name)) continue;
                        string icon = CleanExecutablePath(ReadString(sub, "DisplayIcon"));
                        string installLocation = ReadString(sub, "InstallLocation");
                        yield return (name, icon, installLocation);
                    }
                }
            }
        }

        private static (string Id, string Name, string Vendor)? MatchKnownUpdater(string displayName, string path)
        {
            string text = $"{displayName} {path}".ToLowerInvariant();
            if (text.Contains("nvidia app"))
                return ("nvidia-app", "NVIDIA App", "nvidia");
            if (text.Contains("geforce experience"))
                return ("nvidia-geforce-experience", "GeForce Experience", "nvidia");
            if (text.Contains("amd software") || text.Contains("adrenalin"))
                return ("amd-software", "AMD Software", "amd");
            if (text.Contains("intel driver") && text.Contains("support assistant"))
                return ("intel-dsa", "Intel Driver & Support Assistant", "intel");
            if (text.Contains("intel arc control"))
                return ("intel-arc-control", "Intel Arc Control", "intel");
            return null;
        }

        private static string ResolveUpdaterPath(string vendor, string registryPath, string installLocation)
        {
            if (!string.IsNullOrWhiteSpace(registryPath) && File.Exists(registryPath))
                return registryPath;

            foreach (var known in KnownUpdaterPaths().Where(path =>
                         string.Equals(path.Vendor, vendor, StringComparison.OrdinalIgnoreCase)))
            {
                if (File.Exists(known.Path)) return known.Path;
            }

            if (!string.IsNullOrWhiteSpace(installLocation) && Directory.Exists(installLocation))
            {
                var exe = Directory.EnumerateFiles(installLocation, "*.exe", SearchOption.AllDirectories)
                    .Where(path => !Path.GetFileName(path).Contains("unins", StringComparison.OrdinalIgnoreCase))
                    .OrderBy(path => path.Length)
                    .FirstOrDefault(path => MatchKnownUpdater(Path.GetFileNameWithoutExtension(path), path) != null);
                if (!string.IsNullOrWhiteSpace(exe)) return exe;
            }

            return "";
        }

        private static IEnumerable<(string Id, string Name, string Vendor, string Path)> KnownUpdaterPaths()
        {
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string pfx86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            yield return ("nvidia-app", "NVIDIA App", "nvidia",
                Path.Combine(pf, "NVIDIA Corporation", "NVIDIA app", "CEF", "NVIDIA app.exe"));
            yield return ("nvidia-geforce-experience", "GeForce Experience", "nvidia",
                Path.Combine(pf, "NVIDIA Corporation", "NVIDIA GeForce Experience", "NVIDIA GeForce Experience.exe"));
            yield return ("amd-software", "AMD Software", "amd",
                Path.Combine(pf, "AMD", "CNext", "CNext", "RadeonSoftware.exe"));
            yield return ("amd-software-local", "AMD Software", "amd",
                Path.Combine(local, "AMD", "CN", "RadeonSoftware.exe"));
            yield return ("intel-dsa", "Intel Driver & Support Assistant", "intel",
                Path.Combine(pfx86, "Intel", "Driver and Support Assistant", "DSATray.exe"));
            yield return ("intel-arc-control", "Intel Arc Control", "intel",
                Path.Combine(pf, "Intel", "Intel Arc Control", "ArcControl.exe"));
        }

        private static string DisplayNameFromFile(string path)
        {
            try
            {
                var info = FileVersionInfo.GetVersionInfo(path);
                return FirstNonEmpty(info.ProductName, info.FileDescription, Path.GetFileNameWithoutExtension(path));
            }
            catch
            {
                return Path.GetFileNameWithoutExtension(path);
            }
        }

        private static GpuUpdaterApp WithRuntimeIcon(GpuUpdaterApp app)
        {
            return new GpuUpdaterApp
            {
                Id = app.Id,
                Name = app.Name,
                Vendor = app.Vendor,
                Path = app.Path,
                Source = app.Source,
                AddedAt = app.AddedAt,
                LastSeenAt = app.LastSeenAt,
                IconDataUrl = BuildIconDataUrl(app.Path),
                ImageUrl = app.ImageUrl
            };
        }

        private static string BuildIconDataUrl(string path)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) return "";
                using Icon? icon = Icon.ExtractAssociatedIcon(path);
                if (icon == null) return "";
                using Bitmap bitmap = icon.ToBitmap();
                using var stream = new MemoryStream();
                bitmap.Save(stream, ImageFormat.Png);
                return "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
            }
            catch
            {
                return "";
            }
        }

        private static string NormalizeDeviceName(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            string text = value.Trim();
            int separator = text.LastIndexOf(';');
            if (separator >= 0 && separator < text.Length - 1)
                text = text[(separator + 1)..];
            return text.Trim().Trim('"');
        }

        private static string DisplayDriverVersion(string vendor, string version)
        {
            if (string.IsNullOrWhiteSpace(version)) return "";
            if (string.Equals(vendor, "nvidia", StringComparison.OrdinalIgnoreCase))
                return FormatNvidiaDriverVersion(version);
            return version;
        }

        private static string FormatNvidiaDriverVersion(string version)
        {
            try
            {
                string[] parts = version.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (parts.Length < 4 ||
                    !int.TryParse(parts[2], out int branch) ||
                    branch < 10)
                {
                    return version;
                }

                string build = new string(parts[3].Where(char.IsDigit).ToArray()).PadLeft(4, '0');
                if (build.Length < 4) return version;

                int publicMajor = ((branch - 10) * 100) + int.Parse(build.Substring(0, 2));
                string publicMinor = build.Substring(build.Length - 2, 2);
                return $"{publicMajor}.{publicMinor}";
            }
            catch
            {
                return version;
            }
        }

        private static string NormalizeAdapterKey(string value)
            => NormalizeDeviceName(value).Replace("(TM)", "", StringComparison.OrdinalIgnoreCase).Trim();

        private static string GuessVendor(string value)
        {
            string text = value.ToLowerInvariant();
            if (text.Contains("nvidia") || text.Contains("ven_10de")) return "nvidia";
            if (text.Contains("amd") || text.Contains("advanced micro devices") || text.Contains("radeon") || text.Contains("ven_1002") || text.Contains("ven_1022")) return "amd";
            if (text.Contains("intel") || text.Contains("ven_8086")) return "intel";
            return "unknown";
        }

        private static int VendorRank(string vendor)
            => vendor.ToLowerInvariant() switch
            {
                "nvidia" => 0,
                "amd" => 1,
                "intel" => 2,
                _ => 9
            };

        private static string ReadString(RegistryKey key, params string[] names)
        {
            foreach (string name in names)
            {
                object? value = key.GetValue(name);
                if (value is string text && !string.IsNullOrWhiteSpace(text))
                    return text.Trim();
                if (value is string[] arr && arr.Length > 0 && !string.IsNullOrWhiteSpace(arr[0]))
                    return arr[0].Trim();
            }
            return "";
        }

        private static string[] ReadStringArray(RegistryKey key, params string[] names)
        {
            foreach (string name in names)
            {
                object? value = key.GetValue(name);
                if (value is string[] arr && arr.Length > 0)
                    return arr.Where(item => !string.IsNullOrWhiteSpace(item)).Select(item => item.Trim()).ToArray();
                if (value is string text && !string.IsNullOrWhiteSpace(text))
                    return new[] { text.Trim() };
            }
            return Array.Empty<string>();
        }

        private static string CleanExecutablePath(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "";
            string value = raw.Trim();
            if (value.StartsWith("\"", StringComparison.Ordinal))
            {
                int end = value.IndexOf('"', 1);
                if (end > 1) return value.Substring(1, end - 1);
            }

            int exeIndex = value.IndexOf(".exe", StringComparison.OrdinalIgnoreCase);
            if (exeIndex >= 0) return value.Substring(0, exeIndex + 4).Trim().Trim('"');
            return value.Split(',')[0].Trim().Trim('"');
        }

        private static string StableHash(string value)
            => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).Substring(0, 16).ToLowerInvariant();

        private static bool PathsEqual(string? a, string? b)
        {
            if (string.IsNullOrWhiteSpace(a) || string.IsNullOrWhiteSpace(b)) return false;
            try
            {
                return string.Equals(Path.GetFullPath(a), Path.GetFullPath(b), StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase);
            }
        }

        private static string FirstNonEmpty(params string?[] values)
            => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "";
    }
}
