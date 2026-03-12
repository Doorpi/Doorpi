using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;

namespace Doorpi
{
    // ========================= MODELS =========================

    public class InstalledApp
    {
        public string Name { get; set; } = "";
        public string Path { get; set; } = "";
        public string LaunchUrl { get; set; } = "";
        public string Date { get; set; } = "";
        public int Size { get; set; }
        public string IconBase64 { get; set; } = "";
        public bool IsAdded { get; set; }
        public string Source { get; set; } = "";

    }
    public class UserProfile
    {
        public string Name { get; set; } = "";
        public string PhotoBase64 { get; set; } = "";
        public string SteamGridApiKey { get; set; } = "";
    }
    public class AppCacheModel
    {
        public HashSet<string> WindowsFingerprint { get; set; } = new();
        public HashSet<string> FolderFingerprint { get; set; } = new();
        public List<InstalledApp> WindowsApps { get; set; } = new();
        public List<InstalledApp> FolderApps { get; set; } = new();
    }

    public class FolderStats
    {
        public string Path { get; set; } = "";
        public int SubfolderCount { get; set; }
        public int ExeCount { get; set; }
        public long EstimatedMs { get; set; }
    }

    // ========================= MAIN WINDOW =========================

    public partial class MainWindow : Window
    {
       
        private static readonly HttpClient httpClient = new HttpClient();

        // Pastas de dados
        private readonly string dataFolder;
        private readonly string gridFolder;
        private readonly string heroFolder;
        private readonly string gridHorizontalFolder;
        private readonly string logoFolder;
        private readonly string iconCacheFolder;
        private readonly string userFile;
        private string GetStr(JsonElement root, string propName, string fallback = "")
        {
            return root.TryGetProperty(propName, out var prop) ? (prop.GetString() ?? fallback) : fallback;
        }
        // Arquivos de estado
        private readonly string gamesFile;
        private readonly string foldersFile;
        private readonly string appCacheFile;

        // Watchers para invalidação proativa de cache
        private readonly List<FileSystemWatcher> _folderWatchers = new();
        private volatile bool _folderCacheInvalid = false;
        private volatile bool _windowsCacheInvalid = false;

        // ========================= CONSTRUTOR =========================

        public MainWindow()
        {
            InitializeComponent();

            dataFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data");
            gridFolder = Path.Combine(dataFolder, "images", "grid");
            heroFolder = Path.Combine(dataFolder, "images", "hero");
            gridHorizontalFolder = Path.Combine(dataFolder, "images", "grid-horizontal");
            logoFolder = Path.Combine(dataFolder, "images", "logo");
            iconCacheFolder = Path.Combine(dataFolder, "iconcache");

            gamesFile = Path.Combine(dataFolder, "games.json");
            foldersFile = Path.Combine(dataFolder, "folders.json");
            appCacheFile = Path.Combine(dataFolder, "appcache.json");
            userFile = Path.Combine(dataFolder, "user.json");

            Directory.CreateDirectory(dataFolder);
            Directory.CreateDirectory(gridFolder);
            Directory.CreateDirectory(heroFolder);
            Directory.CreateDirectory(gridHorizontalFolder);
            Directory.CreateDirectory(logoFolder);
            Directory.CreateDirectory(iconCacheFolder);

            if (!File.Exists(gamesFile)) File.WriteAllText(gamesFile, "[]");
            if (!File.Exists(foldersFile)) File.WriteAllText(foldersFile, "[]");


            InitializeAsync();
        }

        // ========================= INICIALIZAÇÃO =========================

        async void InitializeAsync()
        {
            await webView.EnsureCoreWebView2Async(null);
            webView.CoreWebView2.OpenDevToolsWindow();

            string folderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");

            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "app.local", folderPath, CoreWebView2HostResourceAccessKind.Allow);
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "data.local", dataFolder, CoreWebView2HostResourceAccessKind.Allow);

            webView.CoreWebView2.Navigate("https://app.local/index.html");
            webView.CoreWebView2.WebMessageReceived += WebView_WebMessageReceived;
            webView.CoreWebView2.NavigationCompleted += (s, e) =>
            {
                LoadGamesIntoUI();

                if (NeedsSetup())
                {
                    Dispatcher.InvokeAsync(() =>
                        webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"showSetup\"}"));
                }

                Dispatcher.InvokeAsync(() =>
                {
                    Topmost = true; Activate(); Topmost = false; webView.Focus();
                });
            };

            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;

            // Inicia watchers em background — sabemos de mudanças antes do usuário abrir o modal
            StartWatchers();
            _ = Task.Run(WatchWindowsRegistry);
        }

        // ========================= WATCHERS =========================
        private UserProfile LoadUserProfile()
        {
            if (!File.Exists(userFile)) return new UserProfile();
            try { return JsonSerializer.Deserialize<UserProfile>(File.ReadAllText(userFile)) ?? new UserProfile(); }
            catch { return new UserProfile(); }
        }

        private void SaveUserProfile(UserProfile profile)
        {
            File.WriteAllText(userFile, JsonSerializer.Serialize(profile,
                new JsonSerializerOptions { WriteIndented = true }));
        }

        private string GetSteamGridApiKey() => LoadUserProfile().SteamGridApiKey;

        private void EnsureSteamGridAuth()
        {
            var key = GetSteamGridApiKey();
            if (!string.IsNullOrEmpty(key))
                httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", key);
        }

        private bool NeedsSetup()
        {
            var profile = LoadUserProfile();
            return string.IsNullOrWhiteSpace(profile.SteamGridApiKey);
        }

        private async Task BuildAppCacheAndLoadUIAsync()
        {
            // ── 1. Scan de todas as fontes ──────────────────────────────────────────
            EnsureSteamGridAuth();

            var steamTask = Task.Run(() => { var r = GetSteamGames(); r.ForEach(a => a.Source = "Steam"); return r; });
            var epicTask = Task.Run(() => { var r = GetEpicGames(); r.ForEach(a => a.Source = "Epic"); return r; });
            var gogTask = Task.Run(() => { var r = GetGOGGames(); r.ForEach(a => a.Source = "GOG"); return r; });
            var winTask = Task.Run(() => { return (ScanWindowsApps(), true); });
            var folderTask = Task.Run(() => {
                var r = GetWatchedFolderGames();
                r.ForEach(a => a.Source = "Folder");
                return (r, true);
            });

            await Task.WhenAll(steamTask, epicTask, gogTask, winTask, folderTask);

            var (windows, _) = winTask.Result;
            var (folders, __) = folderTask.Result;

            // ── 2. Persiste cache ───────────────────────────────────────────────────
            var cache = new AppCacheModel
            {
                WindowsApps = windows,
                FolderApps = folders,
                WindowsFingerprint = GetWindowsRegistryFingerprint(),
                FolderFingerprint = GetFolderFingerprint(),
            };
            await Task.Run(() => SaveAppCache(cache));

            Debug.WriteLine("[Setup] Cache construído. Aguardando hideLoading do JS.");
        }
        private void StartWatchers()
        {
            foreach (var folder in GetWatchedFolderPaths())
            {
                AddFolderWatcher(folder);
            }

    
            ResumePendingAnalyses();
        }

        private void AddFolderWatcher(string path)
        {
            if (!Directory.Exists(path)) return;
            var w = new FileSystemWatcher(path, "*.exe")
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite,
                EnableRaisingEvents = true
            };
            w.Created += (_, _) => _folderCacheInvalid = true;
            w.Deleted += (_, _) => _folderCacheInvalid = true;
            _folderWatchers.Add(w);
        }

        private async Task WatchWindowsRegistry()
        {
            var lastPrint = GetWindowsRegistryFingerprint();
            while (true)
            {
                await Task.Delay(30_000); // checa a cada 30s em background
                var current = GetWindowsRegistryFingerprint();
                if (!current.SetEquals(lastPrint))
                {
                    _windowsCacheInvalid = true;
                    lastPrint = current;
                }
            }
        }

        // ========================= ICON CACHE =========================

        private string GetCachedIcon(string exePath)
        {
            if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath)) return "";
            try
            {
                var info = new FileInfo(exePath);
                string key = $"{exePath}|{info.LastWriteTimeUtc.Ticks}";
                string hash = Convert.ToHexString(
                    System.Security.Cryptography.MD5.HashData(
                        System.Text.Encoding.UTF8.GetBytes(key)))[..12];

                string iconPath = Path.Combine(iconCacheFolder, $"{hash}.b64");

                if (File.Exists(iconPath))
                    return File.ReadAllText(iconPath);

                string b64 = ExtractIcon(exePath);
                if (!string.IsNullOrEmpty(b64))
                    File.WriteAllText(iconPath, b64);

                return b64;
            }
            catch { return ""; }
        }

        // ========================= STEAM =========================

        private List<InstalledApp> GetSteamGames()
        {
            var list = new List<InstalledApp>();
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Valve\Steam")
                             ?? Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Valve\Steam");

                if (key?.GetValue("InstallPath") is string steamPath)
                {
                    string configPath = Path.Combine(steamPath, "steamapps", "libraryfolders.vdf");
                    if (!File.Exists(configPath)) return list;

                    var content = File.ReadAllText(configPath);
                    var matches = Regex.Matches(content, @"""path""\s+""([^""]+)""");

                    foreach (Match match in matches)
                    {
                        string libraryPath = match.Groups[1].Value.Replace(@"\\", @"\");
                        string appsPath = Path.Combine(libraryPath, "steamapps");
                        if (!Directory.Exists(appsPath)) continue;

                        foreach (var acfFile in Directory.GetFiles(appsPath, "appmanifest_*.acf"))
                        {
                            var acfContent = File.ReadAllText(acfFile);
                            string name = Regex.Match(acfContent, @"""name""\s+""([^""]+)""").Groups[1].Value;
                            string appId = Regex.Match(acfContent, @"""appid""\s+""([^""]+)""").Groups[1].Value;
                            string installDir = Regex.Match(acfContent, @"""installdir""\s+""([^""]+)""").Groups[1].Value;

                            if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(appId)) continue;

                            string iconBase64 = "";

                            string iconHash = Regex.Match(acfContent, @"""(?:clienticon|icon)""\s+""([a-fA-F0-9]+)""").Groups[1].Value;
                            if (!string.IsNullOrEmpty(iconHash))
                            {
                                string icoPath = Path.Combine(steamPath, "steam", "games", $"{iconHash}.ico");
                                if (File.Exists(icoPath)) iconBase64 = GetCachedIcon(icoPath);
                            }

                            if (string.IsNullOrEmpty(iconBase64) && !string.IsNullOrEmpty(installDir))
                            {
                                string gameFolder = Path.Combine(libraryPath, "steamapps", "common", installDir);
                                if (Directory.Exists(gameFolder))
                                {
                                    try
                                    {
                                        var exeFiles = new DirectoryInfo(gameFolder)
                                            .GetFiles("*.exe", SearchOption.AllDirectories)
                                            .Where(f => !f.Name.Contains("crash", StringComparison.OrdinalIgnoreCase) &&
                                                        !f.Name.Contains("unins", StringComparison.OrdinalIgnoreCase) &&
                                                        !f.Name.Contains("setup", StringComparison.OrdinalIgnoreCase) &&
                                                        !f.Name.Contains("redist", StringComparison.OrdinalIgnoreCase))
                                            .ToList();

                                        if (exeFiles.Any())
                                        {
                                            string cleanGameName = NormalizeGameName(name);
                                            string cleanFolderName = NormalizeGameName(installDir);

                                            var bestExe =
                                                exeFiles.FirstOrDefault(f => {
                                                    string c = NormalizeGameName(Path.GetFileNameWithoutExtension(f.Name));
                                                    return c == cleanGameName || c == cleanFolderName;
                                                })
                                                ?? exeFiles.FirstOrDefault(f => IsNameSimilar(Path.GetFileNameWithoutExtension(f.Name), name))
                                                ?? exeFiles.OrderByDescending(f => f.Length).FirstOrDefault();

                                            if (bestExe != null) iconBase64 = GetCachedIcon(bestExe.FullName);
                                        }
                                    }
                                    catch { }
                                }
                            }

                            if (string.IsNullOrEmpty(iconBase64))
                            {
                                string libraryCachePath = Path.Combine(steamPath, "appcache", "librarycache", $"{appId}_icon.jpg");
                                if (File.Exists(libraryCachePath))
                                    iconBase64 = Convert.ToBase64String(File.ReadAllBytes(libraryCachePath));
                            }

                            list.Add(new InstalledApp
                            {
                                Name = name,
                                LaunchUrl = $"steam://run/{appId}",
                                Path = appId,
                                IconBase64 = iconBase64,
                                Source = "Steam"
                            });
                        }
                    }
                }
            }
            catch (Exception ex) { Debug.WriteLine("Erro Steam: " + ex.Message); }
            return list;
        }

        // ========================= EPIC =========================

        private List<InstalledApp> GetEpicGames()
        {
            var list = new List<InstalledApp>();
            try
            {
                string manifestPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                    "Epic", "EpicGamesLauncher", "Data", "Manifests");

                if (!Directory.Exists(manifestPath)) return list;

                foreach (var file in Directory.GetFiles(manifestPath, "*.item"))
                {
                    var json = File.ReadAllText(file);
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    string name = root.GetProperty("DisplayName").GetString() ?? "";
                    string appName = root.GetProperty("AppName").GetString() ?? "";
                    string namespaceStr = root.GetProperty("CatalogNamespace").GetString() ?? "";
                    string catalogItemId = root.GetProperty("CatalogItemId").GetString() ?? "";
                    string installLocation = root.GetProperty("InstallLocation").GetString() ?? "";
                    string launchExe = root.TryGetProperty("LaunchExecutable", out var exeProp)
                                                ? exeProp.GetString() ?? "" : "";

                    string iconBase64 = "";
                    if (!string.IsNullOrEmpty(installLocation) && !string.IsNullOrEmpty(launchExe))
                    {
                        string exePath = Path.Combine(installLocation, launchExe);
                        if (File.Exists(exePath)) iconBase64 = GetCachedIcon(exePath);
                    }

                    list.Add(new InstalledApp
                    {
                        Name = name,
                        LaunchUrl = $"com.epicgames.launcher://apps/{namespaceStr}%3A{catalogItemId}%3A{appName}?action=launch&silent=true",
                        Path = appName,
                        IconBase64 = iconBase64,
                        Source = "Epic"
                    });
                }
            }
            catch { }
            return list;
        }

        // ========================= GOG =========================

        private List<InstalledApp> GetGOGGames()
        {
            var list = new List<InstalledApp>();
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\GOG.com\Games");
                if (key == null) return list;

                foreach (var subKeyName in key.GetSubKeyNames())
                {
                    using var gameKey = key.OpenSubKey(subKeyName);
                    if (gameKey == null) continue;

                    string name = gameKey.GetValue("gameName") as string ?? "";
                    string folderPath = (gameKey.GetValue("path") as string ?? "").Replace("\"", "").Trim();
                    string finalPath = "";

                    if (!string.IsNullOrEmpty(folderPath) && Directory.Exists(folderPath))
                    {
                        var shortcuts = Directory.GetFiles(folderPath, "*.lnk", SearchOption.TopDirectoryOnly)
                            .Where(f => {
                                string fn = Path.GetFileName(f).ToLower();
                                return !fn.Contains("galaxy") && !fn.Contains("uninstall") &&
                                       !fn.Contains("manual") && !fn.Contains("support");
                            }).ToList();

                        if (shortcuts.Any())
                        {
                            finalPath = shortcuts.FirstOrDefault(s =>
                                Path.GetFileName(s).StartsWith("Launch", StringComparison.OrdinalIgnoreCase))
                                ?? shortcuts.First();
                        }
                    }

                    if (string.IsNullOrEmpty(finalPath))
                    {
                        string exePath = (gameKey.GetValue("launchCommand") as string ??
                                          gameKey.GetValue("exe") as string ??
                                          gameKey.GetValue("EXE") as string ?? "")
                                          .Replace("\"", "").Trim();

                        if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath) &&
                            !exePath.ToLower().Contains("unins"))
                            finalPath = exePath;
                    }

                    if (string.IsNullOrEmpty(finalPath) && !string.IsNullOrEmpty(folderPath) && Directory.Exists(folderPath))
                    {
                        var bestExe = new DirectoryInfo(folderPath)
                            .GetFiles("*.exe", SearchOption.AllDirectories)
                            .Where(f => {
                                string fn = f.Name.ToLower();
                                return !fn.Contains("unins") && !fn.Contains("setup") &&
                                       !fn.Contains("config") && f.Length > 1024 * 1024 * 2;
                            })
                            .OrderByDescending(f => f.Length)
                            .FirstOrDefault();

                        if (bestExe != null) finalPath = bestExe.FullName;
                    }

                    if (!string.IsNullOrEmpty(finalPath))
                    {
                        list.Add(new InstalledApp
                        {
                            Name = name,
                            Path = finalPath,
                            Source = "GOG",
                            IconBase64 = GetCachedIcon(finalPath)
                        });
                    }
                }
            }
            catch (Exception ex) { Debug.WriteLine("Erro GOG: " + ex.Message); }
            return list;
        }

        // ========================= PASTAS VIGIADAS =========================

        private List<InstalledApp> GetWatchedFolderGames()
        {
            var list = new List<InstalledApp>();
            long minSize = 2 * 1024 * 1024; // 2MB mínimo

            var options = new EnumerationOptions
            {
                IgnoreInaccessible = true,
                RecurseSubdirectories = true
            };

            foreach (var folder in GetWatchedFolderPaths())
            {
                if (!Directory.Exists(folder)) continue;
                try
                {
                    // Agora usamos o EnumerateFiles à prova de falhas de permissão!
                    foreach (var exePath in Directory.EnumerateFiles(folder, "*.exe", options))
                    {
                        var fileInfo = new FileInfo(exePath);
                        string fileName = fileInfo.Name.ToLower();

                        // Pula desinstaladores e arquivos de crash
                        if (fileName.Contains("unins") || fileName.Contains("crash")) continue;

                        string exeNameOnly = Path.GetFileNameWithoutExtension(fileInfo.Name);
                        string parentFolderName = fileInfo.Directory?.Name ?? "";
                        bool isSimilar = IsNameSimilar(exeNameOnly, parentFolderName);

                        // Aplica o filtro: Maior que 2MB ou tem o mesmo nome da pasta
                        if (fileInfo.Length >= minSize || isSimilar)
                        {
                            string name = GetGameNameFromFile(fileInfo.FullName) ?? exeNameOnly;
                            list.Add(new InstalledApp
                            {
                                Name = name,
                                Path = fileInfo.FullName,
                                Source = "Folder",
                                IconBase64 = GetCachedIcon(fileInfo.FullName)
                            });
                        }
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Erro ao escanear pasta {folder}: {ex.Message}");
                }
            }
            return list;
        }

        // ========================= PASTAS VIGIADAS (NOVA LÓGICA) =========================

        private List<FolderStats> LoadFoldersData()
        {
            if (!File.Exists(foldersFile)) return new List<FolderStats>();
            try
            {
                string json = File.ReadAllText(foldersFile);

                // Tenta carregar no formato novo (Lista de objetos)
                try
                {
                    var data = JsonSerializer.Deserialize<List<FolderStats>>(json);
                    if (data != null && data.Count > 0 && !string.IsNullOrEmpty(data[0].Path))
                        return data;
                }
                catch { /* Ignora e tenta fallback */ }

                // Fallback: Se o JSON for uma lista de strings (formato antigo), faz a migração
                var oldPaths = JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
                var migratedData = oldPaths.Select(path => GetFolderStats(path)).ToList();

                // Salva já no formato novo para as próximas vezes
                SaveFoldersData(migratedData);
                return migratedData;
            }
            catch { return new List<FolderStats>(); }
        }

        private void SaveFoldersData(List<FolderStats> folders)
        {
            File.WriteAllText(foldersFile, JsonSerializer.Serialize(folders, new JsonSerializerOptions { WriteIndented = true }));
        }

        // Helper para manter compatibilidade com os scanners que só precisam dos caminhos
        private List<string> GetWatchedFolderPaths()
        {
            return LoadFoldersData().Select(f => f.Path).ToList();
        }

        private bool IsFolderForbidden(string path)
        {
            // =========================================================
            // MODO DE TESTE: Retornando 'false' para ignorar as travas 
            // de segurança e permitir adicionar o C:\ ou D:\
            // Lembre-se de reverter isso depois!
            // =========================================================
            return false;

            /*
            try
            {
                string fullPath = Path.GetFullPath(path);
                string folderPath = fullPath.TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();
                string rootPath = Path.GetPathRoot(fullPath)!.TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();

                if (string.Equals(folderPath, rootPath, StringComparison.OrdinalIgnoreCase)) return true;

                var parentSystemFolders = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                    Path.GetDirectoryName(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)) ?? ""
                };

                foreach (var forbidden in parentSystemFolders)
                {
                    if (string.IsNullOrWhiteSpace(forbidden)) continue;
                    string norm = Path.GetFullPath(forbidden).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();
                    if (folderPath == norm) return true;
                }

                string dirName = new DirectoryInfo(fullPath).Name.ToLowerInvariant();
                if (dirName == "$recycle.bin" || dirName == "system volume information") return true;
            }
            catch (Exception ex) { Debug.WriteLine($"Erro na validação de pasta: {ex.Message}"); return true; }

            return false;
            */
        }

        /// <summary>
        /// Enumera a pasta e mede o tempo real de leitura do sistema de arquivos.
        /// SubfolderCount e ExeCount informam o "peso" estrutural.
        /// EstimatedMs é o tempo medido — é exatamente o que o scan vai custar.
        /// </summary>
        private FolderStats GetFolderStats(string path)
        {
            var stats = new FolderStats { Path = path };
            if (!Directory.Exists(path)) return stats;

            var sw = System.Diagnostics.Stopwatch.StartNew();
            try
            {
                // Esta opção faz o C# pular pastas protegidas sem disparar erro
                var options = new EnumerationOptions
                {
                    IgnoreInaccessible = true,
                    RecurseSubdirectories = true
                };

                // 1. Conta todas as subpastas (ignorando as inacessíveis)
                stats.SubfolderCount = Directory.EnumerateDirectories(path, "*", options).Count();

                // 2. Conta os executáveis e faz a amostragem
                int exeCount = 0;
                int samples = 0;

                foreach (var file in Directory.EnumerateFiles(path, "*.exe", options))
                {
                    exeCount++;
                    if (samples < 5)
                    {
                        // Extrai o ícone para gerar a amostragem de peso
                        ExtractIcon(file);
                        samples++;
                    }
                }
                stats.ExeCount = exeCount;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[FolderStats] Erro ao varrer {path}: {ex.Message}");
            }
            sw.Stop();

            stats.EstimatedMs = sw.ElapsedMilliseconds;
            return stats;
        }

        /// <summary>
        /// Coleta stats de todas as pastas em paralelo e envia foldersList ao UI.
        /// Chamado em background — não bloqueia o Dispatcher.
        /// </summary>
        private void SendFoldersToUI()
        {
            // Apenas carrega os dados já cacheados no JSON, sem acessar o HD!
            var stats = LoadFoldersData();

            var payload = new { type = "foldersList", folders = stats };
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(payload)));
        }

        /// <summary>
        /// Remove uma pasta do JSON e descarta o watcher correspondente.
        /// </summary>
        private void DeleteWatchedFolder(string path)
        {
            var folders = LoadFoldersData();
            folders.RemoveAll(f => string.Equals(f.Path, path, StringComparison.OrdinalIgnoreCase));
            SaveFoldersData(folders);

            var dead = _folderWatchers
                .Where(w => string.Equals(w.Path, path, StringComparison.OrdinalIgnoreCase))
                .ToList();
            foreach (var w in dead) { w.EnableRaisingEvents = false; w.Dispose(); }
            foreach (var w in dead) _folderWatchers.Remove(w);
        }

        // ========================= WINDOWS APPS (scan) =========================

        private List<InstalledApp> ScanWindowsApps()
        {
            var list = new List<InstalledApp>();
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
                        foreach (var name in key.GetSubKeyNames())
                        {
                            try
                            {
                                using var sub = key.OpenSubKey(name);
                                if (sub == null) continue;

                                var displayName = sub.GetValue("DisplayName") as string;
                                if (string.IsNullOrWhiteSpace(displayName) || IsSystemComponent(displayName, sub)) continue;

                                string folder = GetAppFolder(sub);
                                if (string.IsNullOrEmpty(folder)) continue;

                                var exes = new DirectoryInfo(folder).GetFiles("*.exe", SearchOption.TopDirectoryOnly);
                                if (exes.Length == 0) continue;

                                string exePath = Path.GetFullPath(exes.OrderByDescending(f => f.Length).First().FullName);
                                list.Add(new InstalledApp
                                {
                                    Name = displayName,
                                    Path = exePath,
                                    Source = "Windows",
                                    IconBase64 = GetCachedIcon(exePath)
                                });
                            }
                            catch { }
                        }
                    }
                }
            return list;
        }

        // ========================= CACHE DE APPS =========================

        private void SaveAppCache(AppCacheModel cache)
        {
            File.WriteAllText(appCacheFile, JsonSerializer.Serialize(cache,
                new JsonSerializerOptions { WriteIndented = true }));
        }

        private AppCacheModel? LoadAppCache()
        {
            if (!File.Exists(appCacheFile)) return null;
            try { return JsonSerializer.Deserialize<AppCacheModel>(File.ReadAllText(appCacheFile)); }
            catch { return null; }
        }

        private HashSet<string> GetWindowsRegistryFingerprint()
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
                        foreach (var n in key.GetSubKeyNames()) keys.Add(n);
                    }
                }
            return keys;
        }

        private HashSet<string> GetFolderFingerprint()
        {
            var entries = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var folder in GetWatchedFolderPaths())
            {
                if (!Directory.Exists(folder)) continue;
                try
                {
                    foreach (var exe in new DirectoryInfo(folder).GetFiles("*.exe", SearchOption.AllDirectories))
                        entries.Add($"{exe.FullName}|{exe.Length}|{exe.LastWriteTimeUtc.Ticks}");
                }
                catch { }
            }
            return entries;
        }

        // ========================= ENVIO DE APPS PRO UI =========================

        /// <summary>
        /// Fluxo de 3 fases:
        /// 1. Se há cache → mostra imediatamente (percepção instantânea)
        /// 2. Todas as fontes rodam em paralelo — fingerprint decide se rescaneia ou usa cache
        /// 3. Persiste cache atualizado e envia lista final
        /// </summary>
        private async Task SendInstalledAppsToUIAsync()
        {
            var existingGames = BuildExistingGamesSet();
            var cache = LoadAppCache() ?? new AppCacheModel();

            // ── Scan completo paralelo — envia UMA vez, quando tudo estiver pronto ──
            var steamTask = Task.Run(() => { var r = GetSteamGames(); r.ForEach(a => a.Source = "Steam"); return r; });
            var epicTask = Task.Run(() => { var r = GetEpicGames(); r.ForEach(a => a.Source = "Epic"); return r; });
            var gogTask = Task.Run(() => { var r = GetGOGGames(); r.ForEach(a => a.Source = "GOG"); return r; });

            var winTask = Task.Run(() =>
            {
                bool hit = !_windowsCacheInvalid && cache.WindowsApps.Any() &&
                           GetWindowsRegistryFingerprint().SetEquals(cache.WindowsFingerprint);
                if (hit) return (cache.WindowsApps, false);
                _windowsCacheInvalid = false;
                return (ScanWindowsApps(), true);
            });

            var folderTask = Task.Run(() =>
            {
                bool hit = !_folderCacheInvalid && cache.FolderApps.Any() &&
                           GetFolderFingerprint().SetEquals(cache.FolderFingerprint);
                if (hit) return (cache.FolderApps, false);
                _folderCacheInvalid = false;
                var r = GetWatchedFolderGames();
                r.ForEach(a => a.Source = "Folder");
                return (r, true);
            });

            await Task.WhenAll(steamTask, epicTask, gogTask, winTask, folderTask);

            var (windows, winChanged) = winTask.Result;
            var (folders, folderChanged) = folderTask.Result;

            if (winChanged || folderChanged)
            {
                if (winChanged) { cache.WindowsApps = windows; cache.WindowsFingerprint = GetWindowsRegistryFingerprint(); }
                if (folderChanged) { cache.FolderApps = folders; cache.FolderFingerprint = GetFolderFingerprint(); }
                _ = Task.Run(() => SaveAppCache(cache));
            }

            // Um único envio, quando tudo está pronto
            SendAppsToUI(BuildFinalList(steamTask.Result, epicTask.Result, gogTask.Result,
                windows, folders, existingGames));
        }

        private HashSet<string> BuildExistingGamesSet()
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var g in LoadGames())
            {
                if (!string.IsNullOrEmpty(g.LaunchUrl)) set.Add(g.LaunchUrl);
                else if (!string.IsNullOrEmpty(g.Path)) set.Add(Path.GetFullPath(g.Path));
            }
            return set;
        }

        private List<InstalledApp> BuildFinalList(
            List<InstalledApp> steam,
            List<InstalledApp> epic,
            List<InstalledApp> gog,
            List<InstalledApp> windows,
            List<InstalledApp> folders,
            HashSet<string> existingGames)
        {
            var all = new List<InstalledApp>();
            all.AddRange(steam);
            all.AddRange(epic);
            all.AddRange(gog);
            all.AddRange(windows);
            all.AddRange(folders);

            foreach (var app in all)
            {
                if (!string.IsNullOrEmpty(app.LaunchUrl))
                    app.IsAdded = existingGames.Contains(app.LaunchUrl);
                else
                    app.IsAdded = existingGames.Contains(Path.GetFullPath(app.Path));
            }

            return all
                .OrderBy(a => GetSourcePriority(a.Source))
                .GroupBy(a => NormalizeGameName(a.Name))
                .Select(g => g.First())
                .OrderBy(a => a.Name)
                .ToList();
        }

        private void SendAppsToUI(List<InstalledApp> apps)
        {
            var payload = new { type = "installedAppsList", apps };
            Dispatcher.Invoke(() =>
                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(payload)));
        }

        // ========================= WEBVIEW MESSAGES =========================

        private void DeleteGameImages(GameModel game)
        {
            var imageUrls = new[]
            {
        game.GridImage,
        game.GridStaticImage,
        game.GridHorizontalImage,
        game.GridHorizontalStaticImage,
        game.HeroImage,
        game.HeroStaticImage,
        game.LogoImage,
        game.LogoStaticImage,
    };

            foreach (var url in imageUrls)
            {
                if (string.IsNullOrEmpty(url)) continue;

                try
                {
                    // Converte "https://data.local/images/grid/filename.png"
                    // para o caminho físico real em Data/images/grid/filename.png
                    var uri = new Uri(url);
                    string relativePath = uri.AbsolutePath.TrimStart('/'); // "images/grid/filename.png"
                    string fullPath = Path.Combine(dataFolder, relativePath.Replace('/', Path.DirectorySeparatorChar));

                    if (File.Exists(fullPath))
                    {
                        File.Delete(fullPath);
                        Debug.WriteLine($"[deleteGame] Imagem deletada: {fullPath}");
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[deleteGame] Erro ao deletar imagem {url}: {ex.Message}");
                }
            }
        }
        private void PerformBackgroundAnalysis(string path)
        {
            // Realiza o scan pesado
            var stats = GetFolderStats(path);

            // Atualiza o JSON com o resultado real
            var folders = LoadFoldersData();
            int idx = folders.FindIndex(f => string.Equals(f.Path, path, StringComparison.OrdinalIgnoreCase));
            if (idx >= 0)
            {
                folders[idx] = stats;
                SaveFoldersData(folders);
            }

            // Atualiza o front-end com os dados reais
            SendFoldersToUI();
        }
        private async void WebView_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            var jsonMessage = e.TryGetWebMessageAsString();
            if (string.IsNullOrEmpty(jsonMessage)) return;

            try
            {
                using var doc = JsonDocument.Parse(jsonMessage);
                var root = doc.RootElement;
                if (!root.TryGetProperty("action", out var actionElement)) return;
                string action = actionElement.GetString() ?? "";

                if (action == "requestInstalledApps")
                {
                    _ = Task.Run(async () => {
                        try { await SendInstalledAppsToUIAsync(); }
                        finally { Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}")); }
                    });
                }
                else if (action == "addSelectedGames" && root.TryGetProperty("games", out var gamesElement))
                {
                    var selectedApps = JsonSerializer.Deserialize<List<InstalledApp>>(gamesElement.GetRawText());
                    if (selectedApps != null && selectedApps.Any())
                        _ = Task.Run(async () => await AddMultipleGamesAsync(selectedApps));
                }
                else if (action == "launch" && root.TryGetProperty("path", out var pathElement))
                {
                    string errorMsg = GetStr(root, "errorMsg", "Erro ao iniciar jogo: ");
                    LaunchGame(pathElement.GetString(), errorMsg); 
                }
                else if (action == "browseManual")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Select Executable");
                    string dialogFilter = GetStr(root, "dialogFilter", "Executables (*.exe)|*.exe");
                    string loadTitle = GetStr(root, "loadingTitle", "Adding");
                    string loadSub = GetStr(root, "loadingSub", "Fetching covers...");
                    string errMsg = GetStr(root, "errorMsg", "Error: ");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        try
                        {
                            var dlg = new Microsoft.Win32.OpenFileDialog
                            {
                                Filter = dialogFilter,
                                Title = dialogTitle
                            };
                            if (dlg.ShowDialog() == true)
                            {
                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "updateLoadingText",
                                    title = loadTitle,
                                    subtitle = loadSub
                                }));
                                string filePath = dlg.FileName;
                                string cleanName = GetGameNameFromFile(filePath) ?? Path.GetFileNameWithoutExtension(filePath);
                                var manualApp = new List<InstalledApp>
                                {
                                    new InstalledApp { Name = cleanName, Path = filePath, IconBase64 = GetCachedIcon(filePath) }
                                };
                                await AddMultipleGamesAsync(manualApp);
                                await webView.CoreWebView2.ExecuteScriptAsync("closeModal();");
                            }
                            else
                            {
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show(errMsg + ex.Message);
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                        }
                    });
                }
                else if (action == "requestFolders")
                {
                    _ = Task.Run(() => {
                        try { SendFoldersToUI(); }
                        finally { Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}")); }
                    });
                }
                else if (action == "pickFolder")
                {
                    string dialogTitle = GetStr(root, "dialogTitle");
                    string forbiddenMsg = GetStr(root, "forbiddenMsg");
                    string forbiddenTitle = GetStr(root, "forbiddenTitle");
                    string loadTitle = GetStr(root, "loadingTitle");
                    string loadSub = GetStr(root, "loadingSub");
                    string errMsg = GetStr(root, "errorMsg");

                    await Dispatcher.InvokeAsync(() =>
                    {
                        try
                        {
                            var dlg = new Microsoft.Win32.OpenFolderDialog
                            {
                                Title = dialogTitle,
                                Multiselect = false
                            };

                            if (dlg.ShowDialog() == true)
                            {
                                string selectedPath = dlg.FolderName;
                                if (IsFolderForbidden(selectedPath))
                                {
                                    System.Windows.MessageBox.Show(forbiddenMsg, forbiddenTitle, MessageBoxButton.OK, MessageBoxImage.Warning);
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                                    return;
                                }

                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "updateLoadingText",
                                    title = loadTitle,
                                    subtitle = loadSub
                                }));

                                var folders = LoadFoldersData();
                                if (!folders.Any(f => string.Equals(f.Path, selectedPath, StringComparison.OrdinalIgnoreCase)))
                                {
                                    var placeholder = new FolderStats { Path = selectedPath, EstimatedMs = -1 };
                                    folders.Add(placeholder);
                                    SaveFoldersData(folders);
                                    AddFolderWatcher(selectedPath);
                                }

                                _folderCacheInvalid = true;
                                _ = Task.Run(async () => {
                                    try
                                    {
                                        SendFoldersToUI();
                                        await SendInstalledAppsToUIAsync();
                                    }
                                    finally
                                    {
                                        Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                                    }
                                });

                              
                                _ = Task.Run(() => PerformBackgroundAnalysis(selectedPath));
                            }
                            else
                            {
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show(errMsg + ex.Message);
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                        }
                    });
                }
                else if (action == "editFolder" && root.TryGetProperty("path", out var oldPathEl))
                {
                    string oldPath = oldPathEl.GetString() ?? "";
                    string dialogTitle = GetStr(root, "dialogTitle");
                    string forbiddenMsg = GetStr(root, "forbiddenMsg");
                    string forbiddenTitle = GetStr(root, "forbiddenTitle");
                    string loadTitle = GetStr(root, "loadingTitle");
                    string loadSub = GetStr(root, "loadingSub");
                    string errMsg = GetStr(root, "errorMsg");

                    await Dispatcher.InvokeAsync(() =>
                    {
                        try
                        {
                            var dlg = new Microsoft.Win32.OpenFolderDialog
                            {
                                Title = dialogTitle,
                                Multiselect = false
                            };

                            if (dlg.ShowDialog() == true)
                            {
                                string newPath = dlg.FolderName;

                                if (IsFolderForbidden(newPath))
                                {
                                    System.Windows.MessageBox.Show(forbiddenMsg, forbiddenTitle, MessageBoxButton.OK, MessageBoxImage.Warning);
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                                    return;
                                }

                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "updateLoadingText",
                                    title = loadTitle,
                                    subtitle = loadSub
                                }));

                                var folders = LoadFoldersData();
                                int idx = folders.FindIndex(f => string.Equals(f.Path, oldPath, StringComparison.OrdinalIgnoreCase));
                                var placeholder = new FolderStats { Path = newPath, EstimatedMs = -1 };

                                if (idx >= 0) folders[idx] = placeholder;
                                else folders.Add(placeholder);

                                SaveFoldersData(folders);

                                var dead = _folderWatchers.Where(w => string.Equals(w.Path, oldPath, StringComparison.OrdinalIgnoreCase)).ToList();
                                foreach (var w in dead) { w.EnableRaisingEvents = false; w.Dispose(); }
                                foreach (var w in dead) _folderWatchers.Remove(w);
                                AddFolderWatcher(newPath);

                                _folderCacheInvalid = true;

                                _ = Task.Run(async () => {
                                    try
                                    {
                                        SendFoldersToUI();
                                        await SendInstalledAppsToUIAsync();
                                    }
                                    finally
                                    {
                                        Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                                    }
                                });

                                _ = Task.Run(() => PerformBackgroundAnalysis(newPath));
                            }
                            else
                            {
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show(errMsg + ex.Message);
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                        }
                    });
                }
                else if (action == "deleteFolder" && root.TryGetProperty("path", out var delPathEl))
                {
                    string delPath = delPathEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(delPath))
                    {
                        DeleteWatchedFolder(delPath);
                        _folderCacheInvalid = true;

                        _ = Task.Run(async () => {
                            try
                            {
                                await SendInstalledAppsToUIAsync();
                                SendFoldersToUI();
                            }
                            finally
                            {
                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                            }
                        });
                    }
                    else
                    {
                        webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                    }
                }
                else if (action == "saveStaticFrame")
                {
                    string gameId = root.GetProperty("gameId").GetString() ?? "";
                    string imageType = root.GetProperty("imageType").GetString() ?? "";
                    string base64 = root.GetProperty("base64").GetString() ?? "";

                    if (!string.IsNullOrEmpty(gameId) && !string.IsNullOrEmpty(base64))
                    {
                        string cleanBase64 = base64.Contains(",") ? base64.Split(',')[1] : base64;
                        byte[] imageBytes = Convert.FromBase64String(cleanBase64);

                        var games = LoadGames();
                        var game = games.FirstOrDefault(g => g.Path == gameId || g.LaunchUrl == gameId);

                        if (game != null)
                        {
                            string safeName = string.Concat(game.Name.Where(c => !Path.GetInvalidFileNameChars().Contains(c)));
                            string fileName = $"{safeName}_{imageType}.png";
                            string folder = gridFolder;
                            string folderUrlName = "grid";

                            if (imageType == "HeroStatic") { folder = heroFolder; folderUrlName = "hero"; }
                            else if (imageType == "LogoStatic") { folder = logoFolder; folderUrlName = "logo"; }
                            else if (imageType == "HorizontalStatic") { folder = gridHorizontalFolder; folderUrlName = "grid-horizontal"; }

                            string fullPath = Path.Combine(folder, fileName);
                            File.WriteAllBytes(fullPath, imageBytes); // Sincrono para evitar lock de arquivo

                            string staticUrl = $"https://data.local/images/{folderUrlName}/{fileName}";

                            if (imageType == "GridStatic") game.GridStaticImage = staticUrl;
                            else if (imageType == "HorizontalStatic") game.GridHorizontalStaticImage = staticUrl;
                            else if (imageType == "HeroStatic") game.HeroStaticImage = staticUrl;
                            else if (imageType == "LogoStatic") game.LogoStaticImage = staticUrl;

                            SaveGames(games);

                            var response = new { type = "staticSaved", gameId, imageType, newUrl = staticUrl };
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(response));
                        }
                    }
                }


                // ── Deletar jogo ────────────────────────────────────────────────────────────
                else if (action == "deleteGame" && root.TryGetProperty("gameId", out var delGameIdEl))
                {
                    string gameId = delGameIdEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(gameId))
                    {
                        var games = LoadGames();
                        var game = games.FirstOrDefault(g =>
                            string.Equals(g.Path, gameId, StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(g.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase));

                        if (game != null)
                        {
                        
                            DeleteGameImages(game);
                            games.Remove(game);
                            SaveGames(games);
                            Debug.WriteLine($"[deleteGame] Removido: {gameId}");
                        }
                    }
                }

                // ── Editar nome do jogo ─────────────────────────────────────────────────────
                else if (action == "editGame" &&
                         root.TryGetProperty("gameId", out var editIdEl) &&
                         root.TryGetProperty("newName", out var editNameEl))
                {
                    string gameId = editIdEl.GetString() ?? "";
                    string newName = editNameEl.GetString() ?? "";

                    if (!string.IsNullOrEmpty(gameId) && !string.IsNullOrEmpty(newName))
                    {
                        var games = LoadGames();
                        var game = games.FirstOrDefault(g =>
                            string.Equals(g.Path, gameId, StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(g.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase));

                        if (game != null)
                        {
                            game.Name = newName;
                            SaveGames(games);
                            Debug.WriteLine($"[editGame] '{game.Path}' renomeado para: {newName}");
                        }
                    }
                }
                else if (action == "saveUserProfile")
                {
                    var profile = new UserProfile
                    {
                        Name = GetStr(root, "name"),
                        PhotoBase64 = GetStr(root, "photoBase64"),
                        SteamGridApiKey = GetStr(root, "apiKey"),
                    };
                    SaveUserProfile(profile);

                    // Salva as pastas recebidas no setup
                    if (root.TryGetProperty("folders", out var foldersEl))
                    {
                        var paths = JsonSerializer.Deserialize<List<string>>(foldersEl.GetRawText()) ?? new();
                        var existing = LoadFoldersData();
                        foreach (var path in paths)
                        {
                            if (!existing.Any(f => string.Equals(f.Path, path, StringComparison.OrdinalIgnoreCase)))
                            {
                                existing.Add(new FolderStats { Path = path, EstimatedMs = -1 });
                                AddFolderWatcher(path);
                            }
                        }
                        SaveFoldersData(existing);
                    }

                    // Constrói cache silenciosamente, depois avisa o JS
                    _ = Task.Run(async () => {
                        try { await BuildAppCacheAndLoadUIAsync(); }
                        finally
                        {
                            Dispatcher.Invoke(() =>
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                        }
                    });
                }
                else if (action == "pickProfilePhoto")
                {
                    await Dispatcher.InvokeAsync(() =>
                    {
                        var dlg = new Microsoft.Win32.OpenFileDialog
                        {
                            Title = "Selecionar foto de perfil",
                            Filter = "Imagens (*.png;*.jpg;*.jpeg;*.webp;*.gif)|*.png;*.jpg;*.jpeg;*.webp;*.gif"
                        };
                        if (dlg.ShowDialog() == true)
                        {
                            string b64 = Convert.ToBase64String(File.ReadAllBytes(dlg.FileName));
                            webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new { type = "profilePhotoSelected", base64 = b64 }));
                        }
                    });
                }
                else if (action == "openUrl" && root.TryGetProperty("url", out var urlEl))
                {
                    string url = urlEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(url))
                        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                }
                else if (action == "pickFolderForSetup")
                {
                    string dialogTitle = GetStr(root, "dialogTitle");
                    string forbiddenMsg = GetStr(root, "forbiddenMsg");
                    string forbiddenTitle = GetStr(root, "forbiddenTitle");

                    await Dispatcher.InvokeAsync(() =>
                    {
                        var dlg = new Microsoft.Win32.OpenFolderDialog { Title = dialogTitle };
                        if (dlg.ShowDialog() == true)
                        {
                            string path = dlg.FolderName;
                            if (IsFolderForbidden(path))
                            {
                                System.Windows.MessageBox.Show(forbiddenMsg, forbiddenTitle,
                                    MessageBoxButton.OK, MessageBoxImage.Warning);
                                return;
                            }
                            webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new { type = "setupFolderAdded", path }));
                        }
                    });
                }
                else if (action == "readClipboard")
                {
                    await Dispatcher.InvokeAsync(() =>
                    {
                        string text = System.Windows.Clipboard.GetText();
                        webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new { type = "clipboardText", text }));
                    });
                }
            }
            catch (Exception ex) { Debug.WriteLine($"Erro no WebView Message: {ex.Message}"); }
        }

        // ========================= ADICIONAR JOGOS =========================
        private void ResumePendingAnalyses()
        {
            var folders = LoadFoldersData();
            foreach (var folder in folders.Where(f => f.EstimatedMs == -1))
            {
                string pendingPath = folder.Path;
            
                _ = Task.Run(() => PerformBackgroundAnalysis(pendingPath));
            }
        }
private async Task AddMultipleGamesAsync(List<InstalledApp> selectedApps)
{
    var existingGames = LoadGames();
    bool isFirstGame = existingGames.Count == 0;
    bool dbChanged = false;

    foreach (var app in selectedApps)
    {
        if (existingGames.Any(g => g.Path.Equals(app.Path, StringComparison.OrdinalIgnoreCase)))
            continue;

        // ✅ Extrai steamAppId ANTES de chamar o fetch
        string? steamAppId = null;
        if (!string.IsNullOrEmpty(app.LaunchUrl) && app.LaunchUrl.StartsWith("steam://run/"))
            steamAppId = app.LaunchUrl.Replace("steam://run/", "").Trim();

        var (gridUrl, gridHorizontalUrl, heroUrl, logoUrl) = await FetchSteamGridAssetsAsync(app.Name, steamAppId);

        string safeName = app.Path.GetHashCode().ToString();
        string? localGrid = null, localGridHorizontal = null, localHero = null, localLogo = null;

        if (!string.IsNullOrEmpty(gridHorizontalUrl)) localGridHorizontal = await DownloadImageAsync(gridHorizontalUrl, gridHorizontalFolder, safeName + "_h");
        if (!string.IsNullOrEmpty(gridUrl)) localGrid = await DownloadImageAsync(gridUrl, gridFolder, safeName);
        if (!string.IsNullOrEmpty(heroUrl)) localHero = await DownloadImageAsync(heroUrl, heroFolder, safeName);
        if (!string.IsNullOrEmpty(logoUrl)) localLogo = await DownloadImageAsync(logoUrl, logoFolder, safeName + "_logo");

        var game = new GameModel
        {
            Name = app.Name,
            Path = app.Path,
            LaunchUrl = app.LaunchUrl,
            GridImage = localGrid != null ? $"https://data.local/images/grid/{Path.GetFileName(localGrid)}" : "",
            GridHorizontalImage = localGridHorizontal != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(localGridHorizontal)}" : "",
            HeroImage = localHero != null ? $"https://data.local/images/hero/{Path.GetFileName(localHero)}" : "",
            LogoImage = localLogo != null ? $"https://data.local/images/logo/{Path.GetFileName(localLogo)}" : "",
            LastPlayed = DateTime.MinValue,
            DateAdded = DateTime.Now
        };

        existingGames.Add(game);
        dbChanged = true;
        SaveGames(existingGames);

        Dispatcher.Invoke(() => SendGameToUI(game, isFirstGame));
        if (isFirstGame) isFirstGame = false;
    }

    if (dbChanged) SaveGames(existingGames);
}

        // ========================= STEAMGRID =========================

        private string PrepareSearchName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return name;
            if (!name.Contains(' '))
            {
                var split = Regex.Replace(name, @"(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", " ");
                split = Regex.Replace(split, @"(?<=[a-zA-Z])(?=\d)|(?<=\d)(?=[a-zA-Z])", " ");
                name = split.Trim();
            }
            return name;
        }
    
        private async Task<(string?, string?, string?, string?)> FetchSteamGridAssetsAsync(string gameName, string? steamAppId = null)
        {
            EnsureSteamGridAuth();
            // 1. Steam CDN direto — sem API, sem rate limit, perfeito pra jogos Steam
            if (!string.IsNullOrEmpty(steamAppId))
            {
                var steam = await TryFetchFromSteamCDN(steamAppId);
                if (steam.Item1 != null)
                {
                    Debug.WriteLine($"[Steam CDN] Achou assets direto pra AppId {steamAppId}");
                    return steam;
                }
            }

            // 2. SteamGridDB via SGDB id do jogo Steam (busca por appId na API deles)
            if (!string.IsNullOrEmpty(steamAppId))
            {
                var byId = await TryFetchBySteamAppId(steamAppId);
                if (byId.Item1 != null) return byId;
            }

            // 3. SteamGridDB por nome (Epic, GOG, Folder, etc)
            return await TryFetchByName(gameName);
        }

        private async Task<(string?, string?, string?, string?)> TryFetchFromSteamCDN(string appId)
        {
            try
            {
                string grid = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/library_600x900.jpg";
                string horizontal = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/header.jpg";
                string hero = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/library_hero.jpg";
                string logo = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/logo.png";

                // Verifica se o grid existe (basta checar um, se o jogo existe no Steam todos existem)
                var response = await httpClient.SendAsync(new HttpRequestMessage(HttpMethod.Head, grid));
                if (!response.IsSuccessStatusCode) return (null, null, null, null);

                return (grid, horizontal, hero, logo);
            }
            catch { return (null, null, null, null); }
        }

        private async Task<(string?, string?, string?, string?)> TryFetchBySteamAppId(string steamAppId)
        {
            try
            {
                var json = await httpClient.GetStringAsync($"https://www.steamgriddb.com/api/v2/games/steam/{steamAppId}");
                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.GetProperty("success").GetBoolean()) return (null, null, null, null);

                int id = doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();
                return await FetchAssetsByGameId(id);
            }
            catch { return (null, null, null, null); }
        }

        private async Task<(string?, string?, string?, string?)> TryFetchByName(string gameName)
        {
            try
            {
                string safe = Uri.EscapeDataString(gameName);
                var json = await httpClient.GetStringAsync($"https://www.steamgriddb.com/api/v2/search/autocomplete/{safe}");
                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.GetProperty("success").GetBoolean()) return (null, null, null, null);

                var results = doc.RootElement.GetProperty("data");
                if (results.GetArrayLength() == 0) return (null, null, null, null);

                // Tenta os 3 primeiros resultados, usa o primeiro que tiver grid
                foreach (var game in results.EnumerateArray().Take(3))
                {
                    int id = game.GetProperty("id").GetInt32();
                    var assets = await FetchAssetsByGameId(id);
                    if (assets.Item1 != null) return assets;
                }

                return (null, null, null, null);
            }
            catch { return (null, null, null, null); }
        }

        private async Task<(string?, string?, string?, string?)> FetchAssetsByGameId(int id)
        {
            // Tenta dimensões específicas primeiro, depois qualquer uma
            string? grid = await GetFirstImageUrl($"grids/game/{id}?dimensions=600x900,342x482,660x930&types=static,animated&sort=score")
                        ?? await GetFirstImageUrl($"grids/game/{id}?types=static,animated&sort=score");

            if (string.IsNullOrEmpty(grid)) return (null, null, null, null);

            string? horizontal = await GetFirstImageUrl($"grids/game/{id}?dimensions=460x215,920x430&types=static,animated&sort=score");
            string? hero = await GetFirstImageUrl($"heroes/game/{id}?types=static,animated&sort=score");
            string? logo = await GetFirstImageUrl($"logos/game/{id}?types=static,animated&sort=score");

            if (string.IsNullOrEmpty(horizontal)) horizontal = hero;

            return (grid, horizontal, hero, logo);
        }

        private async Task<string?> GetFirstImageUrl(string endpoint)
        {
            try
            {
                string url = $"https://www.steamgriddb.com/api/v2/{endpoint}";
                var json = await httpClient.GetStringAsync(url);

                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.GetProperty("success").GetBoolean()) return null;

                var data = doc.RootElement.GetProperty("data");
                if (data.GetArrayLength() == 0) return null;

                return data[0].GetProperty("url").GetString();
            }
            catch (Exception ex) { Debug.WriteLine("Erro ao buscar imagem: " + ex.Message); return null; }
        }

        private async Task<string?> DownloadImageAsync(string url, string folder, string name)
        {
            try
            {
                var response = await httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode) return null;

                var bytes = await response.Content.ReadAsByteArrayAsync();
                string ext = Path.GetExtension(url).Split('?')[0].ToLower();

                if (string.IsNullOrEmpty(ext))
                {
                    string contentType = response.Content.Headers.ContentType?.MediaType ?? "";
                    ext = contentType switch
                    {
                        "image/png" => ".png",
                        "image/jpeg" => ".jpg",
                        "image/webp" => ".webp",
                        _ => ".png"
                    };
                }

                string fileName = name + ext;
                string fullPath = Path.Combine(folder, fileName);
                await File.WriteAllBytesAsync(fullPath, bytes);
                return fullPath;
            }
            catch (Exception ex) { Debug.WriteLine($"Erro ao baixar imagem {url}: {ex.Message}"); return null; }
        }

        // ========================= LAUNCH =========================


        private void LaunchGame(string? identifier, string errorMsg)
        {
            if (string.IsNullOrEmpty(identifier)) return;
            try
            {
                var games = LoadGames();
                var game = games.FirstOrDefault(g => g.Path == identifier || g.LaunchUrl == identifier);

                if (game != null)
                {
                    game.LastPlayed = DateTime.Now;
                    SaveGames(games);

                    if (!string.IsNullOrWhiteSpace(game.LaunchUrl) &&
                        game.LaunchUrl.StartsWith("goggalaxy://", StringComparison.OrdinalIgnoreCase))
                    {
                        string gogClientPath = "";
                        using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\GOG.com\GalaxyClient\paths"))
                            gogClientPath = (key?.GetValue("client") as string ?? "").Replace("\"", "").Trim();

                        string gameId = game.LaunchUrl.Replace("goggalaxy://launch/", "").Trim();

                        if (File.Exists(gogClientPath))
                        {
                            Process.Start(new ProcessStartInfo
                            {
                                FileName = gogClientPath,
                                Arguments = $"/command=launch /gameId={gameId}",
                                UseShellExecute = true
                            });
                        }
                        else
                        {
                            Process.Start(new ProcessStartInfo(game.LaunchUrl) { UseShellExecute = true });
                        }
                    }
                    else if (!string.IsNullOrWhiteSpace(game.LaunchUrl))
                    {
                        EnsureLauncherRunning(game.LaunchUrl);
                        Process.Start(new ProcessStartInfo(game.LaunchUrl) { UseShellExecute = true });
                    }
                    else if (File.Exists(game.Path))
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = game.Path,
                            UseShellExecute = true,
                            WorkingDirectory = Path.GetDirectoryName(game.Path)
                        });
                    }
                }
            }
            catch (Exception ex) { System.Windows.MessageBox.Show(errorMsg + ex.Message); }
        }

        private void EnsureLauncherRunning(string launchUrl)
        {
            try
            {
                string processName = "";
                string exePath = "";

                if (launchUrl.StartsWith("steam://", StringComparison.OrdinalIgnoreCase))
                {
                    processName = "steam";
                    using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam"))
                        exePath = key?.GetValue("SteamExe") as string ?? "";

                    if (!string.IsNullOrEmpty(exePath) && !exePath.Contains(@"\"))
                    {
                        using var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
                        var installPath = key?.GetValue("SteamPath") as string;
                        if (!string.IsNullOrEmpty(installPath))
                            exePath = Path.Combine(installPath, "steam.exe");
                    }
                }
                else if (launchUrl.StartsWith("com.epicgames.launcher://", StringComparison.OrdinalIgnoreCase))
                {
                    processName = "EpicGamesLauncher";
                    using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\EpicGames\Unreal Engine"))
                    {
                        string? installRoot = key?.GetValue("INSTALLS") as string;
                        if (!string.IsNullOrEmpty(installRoot))
                            exePath = Path.Combine(installRoot, "Launcher", "Portal", "Binaries", "Win64", "EpicGamesLauncher.exe");
                    }

                    if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
                    {
                        using var keyUn = Registry.LocalMachine.OpenSubKey(
                            @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\EpicGamesLauncher");
                        exePath = keyUn?.GetValue("DisplayIcon") as string ?? "";
                    }
                }
                else if (launchUrl.StartsWith("goggalaxy://", StringComparison.OrdinalIgnoreCase))
                {
                    processName = "GalaxyClient";
                    using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\GOG.com\GalaxyClient\paths");
                    if (key != null) exePath = key.GetValue("client") as string ?? "";
                }

                if (string.IsNullOrEmpty(processName)) return;

                if (Process.GetProcessesByName(processName).Length == 0 && !string.IsNullOrEmpty(exePath))
                {
                    exePath = exePath.Split(',')[0].Replace("\"", "").Trim();
                    if (File.Exists(exePath))
                    {
                        Process.Start(new ProcessStartInfo(exePath)
                        {
                            UseShellExecute = true,
                            WindowStyle = ProcessWindowStyle.Minimized
                        });
                        System.Threading.Thread.Sleep(3000);
                    }
                }
            }
            catch (Exception ex) { Debug.WriteLine("Erro ao garantir launcher: " + ex.Message); }
        }

        // ========================= GAMES DB =========================

        private void SaveGames(List<GameModel> games)
        {
            File.WriteAllText(gamesFile, JsonSerializer.Serialize(games,
                new JsonSerializerOptions { WriteIndented = true }));
        }

        private List<GameModel> LoadGames()
        {
            if (!File.Exists(gamesFile)) return new List<GameModel>();
            string json = File.ReadAllText(gamesFile);
            return JsonSerializer.Deserialize<List<GameModel>>(json) ?? new List<GameModel>();
        }

        private void LoadGamesIntoUI()
        {
            var games = LoadGames().OrderByDescending(g => g.LastPlayed).ToList();
            for (int i = 0; i < games.Count; i++) SendGameToUI(games[i], isFeatured: i == 0);
        }

        private void SendGameToUI(GameModel game, bool isFeatured = false)
        {
            var data = new
            {
                type = "newGame",
                name = game.Name,
                path = game.Path,
                launchUrl = game.LaunchUrl,
                imageData = game.GridImage,
                staticImageData = game.GridStaticImage,
                horizontalImage = game.GridHorizontalImage,
                staticHorizontalImage = game.GridHorizontalStaticImage,
                hero = game.HeroImage,
                staticHero = game.HeroStaticImage,
                logo = game.LogoImage,
                staticLogo = game.LogoStaticImage,
                isFeatured = isFeatured,
                isNew = (DateTime.Now - game.DateAdded).TotalHours < 48
            };
            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(data));
        }

        // ========================= HELPERS =========================

        private string? GetGameNameFromFile(string exePath)
        {
            try
            {
                FileVersionInfo fi = FileVersionInfo.GetVersionInfo(exePath);
                if (!string.IsNullOrWhiteSpace(fi.ProductName)) return fi.ProductName;
                if (!string.IsNullOrWhiteSpace(fi.FileDescription)) return fi.FileDescription;
            }
            catch { }
            return null;
        }

        private bool IsSystemComponent(string name, RegistryKey key)
        {
            var nameLower = name.ToLower();
            string[] blacklist =
            {
                "microsoft .net", "visual c++", "windows driver", "update for",
                "redistributable", "sdk", "library", "directx", "web-deploy",
                "security update", "language pack", "kb", "microsoft windows"
            };
            if (blacklist.Any(term => nameLower.Contains(term))) return true;
            if (Convert.ToInt32(key.GetValue("SystemComponent") ?? 0) == 1) return true;
            if (key.GetValue("DisplayIcon") == null && key.GetValue("InstallLocation") == null) return true;
            return false;
        }

        private string GetAppFolder(RegistryKey key)
        {
            var location = key.GetValue("InstallLocation") as string;
            if (!string.IsNullOrWhiteSpace(location) && Directory.Exists(location)) return location;

            var icon = key.GetValue("DisplayIcon") as string;
            if (!string.IsNullOrWhiteSpace(icon))
            {
                var path = icon.Split(',')[0].Replace("\"", "").Trim();
                if (File.Exists(path)) return Path.GetDirectoryName(path) ?? "";
                if (Directory.Exists(path)) return path;
            }
            return "";
        }

        private string ExtractIcon(string filePath)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath)) return "";

                if (filePath.EndsWith(".ico", StringComparison.OrdinalIgnoreCase))
                {
                    using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                    var decoder = new System.Windows.Media.Imaging.IconBitmapDecoder(
                        fs,
                        System.Windows.Media.Imaging.BitmapCreateOptions.PreservePixelFormat,
                        System.Windows.Media.Imaging.BitmapCacheOption.OnLoad);

                    var bestFrame = decoder.Frames.OrderByDescending(f => f.PixelWidth).FirstOrDefault();
                    if (bestFrame != null)
                    {
                        var encoder = new System.Windows.Media.Imaging.PngBitmapEncoder();
                        encoder.Frames.Add(bestFrame);
                        using var ms = new MemoryStream();
                        encoder.Save(ms);
                        return Convert.ToBase64String(ms.ToArray());
                    }
                }

                using var icon = System.Drawing.Icon.ExtractAssociatedIcon(filePath);
                if (icon != null)
                {
                    using var ms = new MemoryStream();
                    using var bitmap = icon.ToBitmap();
                    bitmap.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
                    return Convert.ToBase64String(ms.ToArray());
                }
            }
            catch { }
            return "";
        }

        private int GetSourcePriority(string source) => source switch
        {
            "Steam" => 1,
            "Epic" => 1,
            "GOG" => 1,
            "Folder" => 2,
            "Windows" => 3,
            _ => 4
        };

        private string NormalizeGameName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "";
            return new string(name.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        }

        private bool IsNameSimilar(string exeName, string folderName)
        {
            if (string.IsNullOrEmpty(exeName) || string.IsNullOrEmpty(folderName)) return false;
            string cleanExe = new string(exeName.Where(char.IsLetterOrDigit).ToArray()).ToLower();
            string cleanFolder = new string(folderName.Where(char.IsLetterOrDigit).ToArray()).ToLower();
            if (cleanExe.Length < 3) return cleanExe == cleanFolder;
            return cleanExe.Contains(cleanFolder) || cleanFolder.Contains(cleanExe);
        }
    }
}