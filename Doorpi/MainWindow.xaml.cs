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

    public partial class MainWindow : Window
    {
        private const string SteamGridApiKey = "5b36e29336a851ae1c85656b2bfc5cf7";
        private static readonly HttpClient httpClient = new HttpClient();

        private readonly string dataFolder;
        private readonly string gridFolder;
        private readonly string heroFolder;
        private readonly string gridHorizontalFolder;
        private readonly string logoFolder;
        private readonly string gamesFile;
        private readonly string foldersFile;

        public MainWindow()
        {
            InitializeComponent();

            dataFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data");

            if (!Directory.Exists(dataFolder)) Directory.CreateDirectory(dataFolder);

            gridFolder = Path.Combine(dataFolder, "images", "grid");
            heroFolder = Path.Combine(dataFolder, "images", "hero");
            gridHorizontalFolder = Path.Combine(dataFolder, "images", "grid-horizontal");
            logoFolder = Path.Combine(dataFolder, "images", "logo");

            gamesFile = Path.Combine(dataFolder, "games.json");
            foldersFile = Path.Combine(dataFolder, "folders.json");


            if (!File.Exists(gamesFile))
            {
                File.WriteAllText(gamesFile, "[]"); 
            }

            if (!File.Exists(foldersFile))
            {
                File.WriteAllText(foldersFile, "[]");
            }

            Directory.CreateDirectory(gridHorizontalFolder);
            Directory.CreateDirectory(gridFolder);
            Directory.CreateDirectory(heroFolder);
            Directory.CreateDirectory(logoFolder);

            httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", SteamGridApiKey);

            InitializeAsync();
        }

        async void InitializeAsync()
        {
            await webView.EnsureCoreWebView2Async(null);
            webView.CoreWebView2.OpenDevToolsWindow();
            string folderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");

            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "app.local",
                folderPath,
                CoreWebView2HostResourceAccessKind.Allow);

            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "data.local",
                dataFolder,
                CoreWebView2HostResourceAccessKind.Allow);

            webView.CoreWebView2.Navigate("https://app.local/index.html");

            webView.CoreWebView2.WebMessageReceived += WebView_WebMessageReceived;

            webView.CoreWebView2.NavigationCompleted += (s, e) =>
            {
                LoadGamesIntoUI();
            };

            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
        }



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

                    if (File.Exists(configPath))
                    {
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
                                    if (File.Exists(icoPath)) iconBase64 = ExtractIcon(icoPath);
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

                                               
                                                var bestExe = exeFiles.FirstOrDefault(f => {
                                                    string cleanExe = NormalizeGameName(Path.GetFileNameWithoutExtension(f.Name));
                                                    return cleanExe == cleanGameName || cleanExe == cleanFolderName;
                                                })
                                                
                                                ?? exeFiles.FirstOrDefault(f => IsNameSimilar(Path.GetFileNameWithoutExtension(f.Name), name))
                                               
                                                ?? exeFiles.OrderByDescending(f => f.Length).FirstOrDefault();

                                                if (bestExe != null) iconBase64 = ExtractIcon(bestExe.FullName);
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
            }
            catch (Exception ex) { Debug.WriteLine("Erro Steam: " + ex.Message); }

            return list;
        }


        private List<InstalledApp> GetEpicGames()
        {
            var list = new List<InstalledApp>();

            try
            {
                string manifestPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                    "Epic",
                    "EpicGamesLauncher",
                    "Data",
                    "Manifests"
                );

                if (!Directory.Exists(manifestPath))
                    return list;

                foreach (var file in Directory.GetFiles(manifestPath, "*.item"))
                {
                    var json = File.ReadAllText(file);
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    string name = root.GetProperty("DisplayName").GetString();
                    string appName = root.GetProperty("AppName").GetString();
                    string namespaceStr = root.GetProperty("CatalogNamespace").GetString();
                    string catalogItemId = root.GetProperty("CatalogItemId").GetString();

                    string installLocation = root.GetProperty("InstallLocation").GetString();
                    string launchExe = root.TryGetProperty("LaunchExecutable", out var exeProp)
                        ? exeProp.GetString()
                        : "";

                    string iconBase64 = "";

                    if (!string.IsNullOrEmpty(installLocation) && !string.IsNullOrEmpty(launchExe))
                    {
                        string exePath = Path.Combine(installLocation, launchExe);

                        if (File.Exists(exePath))
                        {
                            iconBase64 = ExtractIcon(exePath);
                        }
                    }

                    list.Add(new InstalledApp
                    {
                        Name = name,
                        LaunchUrl = $"com.epicgames.launcher://apps/{namespaceStr}%3A{catalogItemId}%3A{appName}?action=launch&silent=true",
                        Path = appName,
                        IconBase64 = iconBase64
                    });
                }
            }
            catch { }

            return list;
        }
        private void SaveWatchedFolder(string path)
        {
            var folders = LoadWatchedFolders();
            if (!folders.Contains(path, StringComparer.OrdinalIgnoreCase))
            {
                folders.Add(path);
                try
                {
                    File.WriteAllText(foldersFile, JsonSerializer.Serialize(folders));
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("Erro ao salvar pasta: " + ex.Message);
                }
            }
        }

        private List<string> LoadWatchedFolders()
        {
            if (!File.Exists(foldersFile)) return new List<string>();
            try
            {
                return JsonSerializer.Deserialize<List<string>>(File.ReadAllText(foldersFile)) ?? new List<string>();
            }
            catch
            {
                return new List<string>();
            }
        }
        private bool IsFolderForbidden(string path)
        {
            try
            {
                
                string fullPath = Path.GetFullPath(path);
                string folderPath = fullPath.TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();

               
                string rootPath = Path.GetPathRoot(fullPath).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();

    
                if (string.Equals(folderPath, rootPath, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                
                var parentSystemFolders = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            Environment.GetFolderPath(Environment.SpecialFolder.Windows),           
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),     
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),   
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),       
            Path.GetDirectoryName(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)) 
        };

               
                foreach (var forbidden in parentSystemFolders)
                {
                    if (string.IsNullOrWhiteSpace(forbidden)) continue;

                    string normalizedForbidden = Path.GetFullPath(forbidden).TrimEnd(Path.DirectorySeparatorChar).ToLowerInvariant();

                    if (folderPath == normalizedForbidden)
                    {
                        
                        return true;
                    }
                }

               
                var dirInfo = new DirectoryInfo(fullPath);
                string folderName = dirInfo.Name.ToLowerInvariant();
                if (folderName == "$recycle.bin" || folderName == "system volume information") return true;

            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro na validação de pasta: {ex.Message}");
                return true;
            }

            return false; 
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
                    _ = SendInstalledAppsToUIAsync();
                }
                else if (action == "addSelectedGames" && root.TryGetProperty("games", out var gamesElement))
                {
                    var selectedApps = JsonSerializer.Deserialize<List<InstalledApp>>(gamesElement.GetRawText());
                    if (selectedApps != null && selectedApps.Any())
                    {
                        _ = Task.Run(async () => await AddMultipleGamesAsync(selectedApps));
                    }
                }
                else if (action == "launch" && root.TryGetProperty("path", out var pathElement))
                {
                    LaunchGame(pathElement.GetString());
                }
                else if (action == "browseManual")
                {
                    Dispatcher.InvokeAsync(() =>
                    {
                        try
                        {
                            var openFileDialog = new Microsoft.Win32.OpenFileDialog
                            {
                                Filter = "Executáveis (*.exe)|*.exe",
                                Title = "Selecione o executável do jogo"
                            };

                            if (openFileDialog.ShowDialog() == true)
                            {
                                string filePath = openFileDialog.FileName;
                                string cleanName = GetGameNameFromFile(filePath) ?? Path.GetFileNameWithoutExtension(filePath);

                                var manualApp = new List<InstalledApp> {
                                    new InstalledApp {
                                        Name = cleanName,
                                        Path = filePath,
                                        IconBase64 = ExtractIcon(filePath)
                                    }
                                };

                                _ = Task.Run(async () => await AddMultipleGamesAsync(manualApp));
                                webView.CoreWebView2.ExecuteScriptAsync("closeModal();");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show("Erro ao abrir arquivo: " + ex.Message);
                        }
                    });
                }
                else if (action == "pickFolder")
                {
                    Dispatcher.InvokeAsync(() =>
                    {
                        try
                        {
                            var dialog = new Microsoft.Win32.OpenFolderDialog
                            {
                                Title = "Selecione a pasta da biblioteca de jogos",
                                Multiselect = false
                            };

                            if (dialog.ShowDialog() == true)
                            {
                                string selectedPath = dialog.FolderName;

                                if (IsFolderForbidden(selectedPath))
                                {
                                    System.Windows.MessageBox.Show(
                                        "Esta pasta ou unidade é protegida pelo sistema e não pode ser adicionada como biblioteca.\n\n" +
                                        "Por favor, selecione uma pasta específica onde seus jogos estão instalados (ex: C:\\Jogos ou D:\\SteamLibrary).",
                                        "Pasta Não Permitida",
                                        MessageBoxButton.OK,
                                        MessageBoxImage.Warning);
                                    return;
                                }

                                SaveWatchedFolder(selectedPath);
                                _ = SendInstalledAppsToUIAsync();
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show("Erro ao abrir seletor de pasta: " + ex.Message);
                        }
                    });
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
            await File.WriteAllBytesAsync(fullPath, imageBytes); // Async para não travar

            string staticUrl = $"https://data.local/images/{folderUrlName}/{fileName}";

            // Atualiza o modelo na memória e salva
            if (imageType == "GridStatic") game.GridStaticImage = staticUrl;
            else if (imageType == "HorizontalStatic") game.GridHorizontalStaticImage = staticUrl;
            else if (imageType == "HeroStatic") game.HeroStaticImage = staticUrl;
            else if (imageType == "LogoStatic") game.LogoStaticImage = staticUrl;

            SaveGames(games);

            // --- O PULO DO GATO: AVISA O JS PARA LIBERAR A MEMÓRIA ---
            var response = new
            {
                type = "staticSaved",
                gameId = gameId,
                imageType = imageType,
                newUrl = staticUrl
            };
            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(response));
        }
    }
}
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro no WebView Message: {ex.Message}");
            }
        }

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

        private async Task SendInstalledAppsToUIAsync()
        {
            var existingGames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var g in LoadGames())
            {
                if (!string.IsNullOrEmpty(g.LaunchUrl)) existingGames.Add(g.LaunchUrl);
                else if (!string.IsNullOrEmpty(g.Path)) existingGames.Add(Path.GetFullPath(g.Path));
            }

            var apps = await Task.Run(() =>
            {
                var list = new List<InstalledApp>();

               
                var steam = GetSteamGames(); steam.ForEach(a => a.Source = "Steam");
                var epic = GetEpicGames(); epic.ForEach(a => a.Source = "Epic");
                var gog = GetGOGGames(); gog.ForEach(a => a.Source = "GOG");
                var folders = GetWatchedFolderGames(); folders.ForEach(a => a.Source = "Folder");

                list.AddRange(steam);
                list.AddRange(epic);
                list.AddRange(gog);
                list.AddRange(folders);

               
                var registryPaths = new[] { @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" };
                foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
                {
                    foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                    {
                        using var baseKey = RegistryKey.OpenBaseKey(hive, view);
                        foreach (var relPath in registryPaths)
                        {
                            using var key = baseKey.OpenSubKey(relPath);
                            if (key == null) continue;
                            foreach (var subKeyName in key.GetSubKeyNames())
                            {
                                try
                                {
                                    using var subKey = key.OpenSubKey(subKeyName);
                                    if (subKey == null) continue;
                                    var displayName = subKey.GetValue("DisplayName") as string;
                                    if (string.IsNullOrWhiteSpace(displayName) || IsSystemComponent(displayName, subKey)) continue;

                                    string folderPath = GetAppFolder(subKey);
                                    if (string.IsNullOrEmpty(folderPath)) continue;

                                    var exeFiles = new DirectoryInfo(folderPath).GetFiles("*.exe", SearchOption.TopDirectoryOnly);
                                    if (exeFiles.Length > 0)
                                    {

                                        var largestExe = exeFiles.OrderByDescending(f => f.Length).First();
                                        string fullPath = Path.GetFullPath(largestExe.FullName);

                                        list.Add(new InstalledApp
                                        {
                                            Name = displayName,
                                            Path = fullPath,
                                            Source = "Windows",
                                            IconBase64 = ExtractIcon(fullPath)
                                        });
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                }

                
                foreach (var app in list)
                {
                    if (!string.IsNullOrEmpty(app.LaunchUrl)) app.IsAdded = existingGames.Contains(app.LaunchUrl);
                    else app.IsAdded = existingGames.Contains(Path.GetFullPath(app.Path));
                }

               
                return list
                    .OrderBy(a => GetSourcePriority(a.Source)) 
                    .GroupBy(a => NormalizeGameName(a.Name))  
                    .Select(g => g.First())                    
                    .OrderBy(a => a.Name)                     
                    .ToList();
            });

            var payload = new { type = "installedAppsList", apps = apps };
            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(payload)));
        }
        private bool IsSystemComponent(string name, RegistryKey key)
        {
            var nameLower = name.ToLower();
            string[] blacklist = {
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
                if (File.Exists(path)) return Path.GetDirectoryName(path);
                if (Directory.Exists(path)) return path;
            }
            return null;
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

               
                using (var icon = System.Drawing.Icon.ExtractAssociatedIcon(filePath))
                {
                    if (icon != null)
                    {
                        using (var ms = new MemoryStream())
                        {
                            using (var bitmap = icon.ToBitmap())
                            {
                                bitmap.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
                                return Convert.ToBase64String(ms.ToArray());
                            }
                        }
                    }
                }
            }
            catch { }

            return "";
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

                var (gridUrl, gridHorizontalUrl, heroUrl, logoUrl) = await FetchSteamGridAssetsAsync(app.Name);
                string safeName = app.Path.GetHashCode().ToString();

                string? localGrid = null, localGridHorizontal = null, localHero = null, localLogo = null;

                if (!string.IsNullOrEmpty(gridHorizontalUrl)) localGridHorizontal = await DownloadImageAsync(gridHorizontalUrl, gridHorizontalFolder, safeName + "_h");
                if (!string.IsNullOrEmpty(gridUrl)) localGrid = await DownloadImageAsync(gridUrl, gridFolder, safeName);
                if (!string.IsNullOrEmpty(heroUrl)) localHero = await DownloadImageAsync(heroUrl, heroFolder, safeName);
                if (!string.IsNullOrEmpty(logoUrl)) localLogo = await DownloadImageAsync(logoUrl, logoFolder, safeName + "_logo");

                string finalGridImage = localGrid != null ? $"https://data.local/images/grid/{Path.GetFileName(localGrid)}" : "";

                var game = new GameModel
                {
                    Name = app.Name,
                    Path = app.Path,
                    LaunchUrl = app.LaunchUrl,
                    GridImage = finalGridImage,
                    GridHorizontalImage = localGridHorizontal != null ? $"https://data.local/images/grid-horizontal/{Path.GetFileName(localGridHorizontal)}" : "",
                    HeroImage = localHero != null ? $"https://data.local/images/hero/{Path.GetFileName(localHero)}" : "",
                    LogoImage = localLogo != null ? $"https://data.local/images/logo/{Path.GetFileName(localLogo)}" : "",
                    LastPlayed = DateTime.MinValue
                };

                existingGames.Add(game);
                dbChanged = true;

                SaveGames(existingGames); 

                Dispatcher.Invoke(() => SendGameToUI(game, isFirstGame));
                if (isFirstGame) isFirstGame = false;
            }

            if (dbChanged) SaveGames(existingGames);
        }

        private async Task<(string?, string?, string?, string?)> FetchSteamGridAssetsAsync(string gameName)
        {
            try
            {
                Debug.WriteLine("======================================");
                Debug.WriteLine("SteamGridDB FETCH INICIADO");
                Debug.WriteLine($"GameName recebido: {gameName}");

                string searchUrl = $"https://www.steamgriddb.com/api/v2/search/autocomplete/{Uri.EscapeDataString(gameName)}";

                Debug.WriteLine($"URL de busca: {searchUrl}");

                var searchJson = await httpClient.GetStringAsync(searchUrl);

                Debug.WriteLine("JSON retornado da busca:");
                Debug.WriteLine(searchJson);

                using var searchDoc = JsonDocument.Parse(searchJson);

                if (!searchDoc.RootElement.GetProperty("success").GetBoolean())
                {
                    Debug.WriteLine("SteamGridDB retornou success=false");
                    return (null, null, null, null);
                }

                var results = searchDoc.RootElement.GetProperty("data");

                Debug.WriteLine($"Quantidade de resultados encontrados: {results.GetArrayLength()}");

                if (results.GetArrayLength() == 0)
                {
                    Debug.WriteLine("Nenhum resultado encontrado.");
                    return (null, null, null, null);
                }

                for (int i = 0; i < Math.Min(results.GetArrayLength(), 5); i++)
                {
                    var result = results[i];

                    int id = result.GetProperty("id").GetInt32();
                    string name = result.GetProperty("name").GetString() ?? "";

                    Debug.WriteLine("--------------------------------------");
                    Debug.WriteLine($"Testando resultado {i + 1}");
                    Debug.WriteLine($"Nome: {name}");
                    Debug.WriteLine($"ID: {id}");

                    string gridEndpoint = $"grids/game/{id}?dimensions=600x900,342x482,660x930&types=static,animated&sort=score";

                    Debug.WriteLine($"Buscando GRID: {gridEndpoint}");

                    string? grid = await GetFirstImageUrl(gridEndpoint);

                    if (string.IsNullOrEmpty(grid))
                    {
                        Debug.WriteLine("Nenhuma GRID encontrada. Pulando para próximo resultado.");
                        continue;
                    }

                    Debug.WriteLine($"GRID encontrada: {grid}");

                    string horizontalEndpoint = $"grids/game/{id}?dimensions=460x215,920x430&types=static,animated&sort=score";
                    string heroEndpoint = $"heroes/game/{id}?types=static,animated&sort=score";
                    string logoEndpoint = $"logos/game/{id}?types=static,animated&sort=score";

                    Debug.WriteLine($"Buscando GRID Horizontal: {horizontalEndpoint}");
                    string? gridHorizontal = await GetFirstImageUrl(horizontalEndpoint);
                    Debug.WriteLine($"GRID Horizontal resultado: {gridHorizontal}");

                    Debug.WriteLine($"Buscando HERO: {heroEndpoint}");
                    string? hero = await GetFirstImageUrl(heroEndpoint);
                    Debug.WriteLine($"HERO resultado: {hero}");

                    Debug.WriteLine($"Buscando LOGO: {logoEndpoint}");
                    string? logo = await GetFirstImageUrl(logoEndpoint);
                    Debug.WriteLine($"LOGO resultado: {logo}");

                    if (string.IsNullOrEmpty(gridHorizontal))
                    {
                        Debug.WriteLine("GRID Horizontal vazio. Usando HERO como fallback.");
                        gridHorizontal = hero;
                    }

                    Debug.WriteLine("Resultado final selecionado.");
                    Debug.WriteLine("======================================");

                    return (grid, gridHorizontal, hero, logo);
                }

                Debug.WriteLine("Nenhum resultado válido com GRID encontrado.");
                Debug.WriteLine("======================================");

                return (null, null, null, null);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("ERRO SteamGridDB:");
                Debug.WriteLine(ex.ToString());
                return (null, null, null, null);
            }
        }

        private async Task<string?> GetFirstImageUrl(string endpoint)
        {
            try
            {
                string url = $"https://www.steamgriddb.com/api/v2/{endpoint}";

                Debug.WriteLine($"Request imagens: {url}");

                var json = await httpClient.GetStringAsync(url);

                Debug.WriteLine("JSON imagens recebido:");
                Debug.WriteLine(json);

                using var doc = JsonDocument.Parse(json);

                if (!doc.RootElement.GetProperty("success").GetBoolean())
                {
                    Debug.WriteLine("API imagens retornou success=false");
                    return null;
                }

                var data = doc.RootElement.GetProperty("data");

                Debug.WriteLine($"Quantidade de imagens retornadas: {data.GetArrayLength()}");

                if (data.GetArrayLength() == 0)
                {
                    Debug.WriteLine("Nenhuma imagem encontrada.");
                    return null;
                }

                var urlImage = data[0].GetProperty("url").GetString();

                Debug.WriteLine($"Imagem escolhida: {urlImage}");

                return urlImage;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Erro ao buscar imagem:");
                Debug.WriteLine(ex.ToString());
                return null;
            }
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
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro ao baixar imagem {url}: {ex.Message}");
                return null;
            }
        }

        private int GetSourcePriority(string source)
        {
            return source switch
            {
                "Steam" => 1,
                "Epic" => 1,
                "GOG" => 1,
                "Folder" => 2,    
                "Windows" => 3,   
                _ => 4
            };
        }

        private List<InstalledApp> GetWatchedFolderGames()
        {
            var list = new List<InstalledApp>();
            long minSize = 2 * 1024 * 1024; 

            foreach (var folder in LoadWatchedFolders())
            {
                if (!Directory.Exists(folder)) continue;

                try
                {
                    var dirInfo = new DirectoryInfo(folder);
                    var exeFiles = dirInfo.GetFiles("*.exe", SearchOption.AllDirectories);

                    foreach (var exe in exeFiles)
                    {
                        string fileName = exe.Name.ToLower();

                        
                        if (fileName.Contains("unins") || fileName.Contains("crash")) continue;


                        string exeNameOnly = Path.GetFileNameWithoutExtension(exe.Name);
                        string parentFolderName = exe.Directory?.Name ?? "";

                        bool isSimilar = IsNameSimilar(exeNameOnly, parentFolderName);

    
                        if (exe.Length >= minSize || isSimilar)
                        {
                            string name = GetGameNameFromFile(exe.FullName) ?? exeNameOnly;

                            list.Add(new InstalledApp
                            {
                                Name = name,
                                Path = exe.FullName,
                                Source = "Folder",
                                IconBase64 = ExtractIcon(exe.FullName)
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

       
        private bool IsNameSimilar(string exeName, string folderName)
        {
            if (string.IsNullOrEmpty(exeName) || string.IsNullOrEmpty(folderName)) return false;

            
            string cleanExe = new string(exeName.Where(char.IsLetterOrDigit).ToArray()).ToLower();
            string cleanFolder = new string(folderName.Where(char.IsLetterOrDigit).ToArray()).ToLower();

            
            if (cleanExe.Length < 3) return cleanExe == cleanFolder;

           
            return cleanExe.Contains(cleanFolder) || cleanFolder.Contains(cleanExe);
        }
        private string NormalizeGameName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "";
            return new string(name.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        }

        private List<InstalledApp> GetGOGGames()
        {
            var list = new List<InstalledApp>();
            try
            {
                using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\GOG.com\Games"))
                {
                    if (key == null) return list;

                    foreach (var subKeyName in key.GetSubKeyNames())
                    {
                        using (var gameKey = key.OpenSubKey(subKeyName))
                        {
                            if (gameKey == null) continue;

                            string name = gameKey.GetValue("gameName") as string ?? "";
                            string folderPath = (gameKey.GetValue("path") as string ?? "").Replace("\"", "").Trim();
                            string finalPath = "";

                            if (!string.IsNullOrEmpty(folderPath) && Directory.Exists(folderPath))
                            {
            
                                var shortcuts = Directory.GetFiles(folderPath, "*.lnk", SearchOption.TopDirectoryOnly)
                                    .Where(f => {
                                        string fn = Path.GetFileName(f).ToLower();
                                   
                                        return !fn.Contains("galaxy") &&
                                               !fn.Contains("uninstall") &&
                                               !fn.Contains("manual") &&
                                               !fn.Contains("support");
                                    }).ToList();

                                if (shortcuts.Any())
                                {
                                    
                                    finalPath = shortcuts.FirstOrDefault(s => Path.GetFileName(s).StartsWith("Launch", StringComparison.OrdinalIgnoreCase))
                                                ?? shortcuts.First();
                                }
                            }

                            
                            if (string.IsNullOrEmpty(finalPath))
                            {
                                string exePath = (gameKey.GetValue("launchCommand") as string ??
                                                  gameKey.GetValue("exe") as string ??
                                                  gameKey.GetValue("EXE") as string ?? "").Replace("\"", "").Trim();

                                if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath) && !exePath.ToLower().Contains("unins"))
                                {
                                    finalPath = exePath;
                                }
                            }

                       
                            if (string.IsNullOrEmpty(finalPath) && !string.IsNullOrEmpty(folderPath) && Directory.Exists(folderPath))
                            {
                                var dirInfo = new DirectoryInfo(folderPath);
                            
                                var bestExe = dirInfo.GetFiles("*.exe", SearchOption.AllDirectories)
                                    .Where(f => {
                                        string fn = f.Name.ToLower();
                                        return !fn.Contains("unins") && !fn.Contains("setup") && !fn.Contains("config") && f.Length > 1024 * 1024 * 2;
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
                                    IconBase64 = ExtractIcon(finalPath) 
                                });
                            }
                        }
                    }
                }
            }
            catch (Exception ex) { Debug.WriteLine("Erro GOG: " + ex.Message); }
            return list;
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
                    {
                        if (key != null)
                        {
                            exePath = key.GetValue("SteamExe") as string ?? "";
                        }
                        else
                        {
                            
                            using (var keyLM = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Valve\Steam"))
                            {
                                if (keyLM != null) exePath = keyLM.GetValue("InstallPath") as string ?? "";
                            }
                        }
                    }

                   
                    if (!string.IsNullOrEmpty(exePath) && !exePath.Contains(@"\"))
                    {
                        using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam"))
                        {
                            var installPath = key?.GetValue("SteamPath") as string;
                            if (!string.IsNullOrEmpty(installPath)) exePath = Path.Combine(installPath, "steam.exe");
                        }
                    }
                }
        
                else if (launchUrl.StartsWith("com.epicgames.launcher://", StringComparison.OrdinalIgnoreCase))
                {
                    processName = "EpicGamesLauncher";
                    using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\EpicGames\Unreal Engine"))
                    {
                        string? installRoot = key?.GetValue("INSTALLS") as string;
                        if (!string.IsNullOrEmpty(installRoot))
                        {
                            exePath = Path.Combine(installRoot, "Launcher", "Portal", "Binaries", "Win64", "EpicGamesLauncher.exe");
                        }
                    }

                    if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
                    {
                        using (var keyUn = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\EpicGamesLauncher"))
                        {
                            exePath = keyUn?.GetValue("DisplayIcon") as string ?? "";
                        }
                    }
                }
             
                else if (launchUrl.StartsWith("goggalaxy://", StringComparison.OrdinalIgnoreCase))
                {
                    processName = "GalaxyClient";
                    using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\GOG.com\GalaxyClient\paths"))
                    {
                        if (key != null) exePath = key.GetValue("client") as string ?? "";
                    }
                }

                if (string.IsNullOrEmpty(processName)) return;

                var processes = Process.GetProcessesByName(processName);
                if (processes.Length == 0)
                {
                    if (!string.IsNullOrEmpty(exePath))
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
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Erro ao garantir launcher: " + ex.Message);
            }
        }
        private void SaveGames(List<GameModel> games)
        {
            File.WriteAllText(gamesFile, JsonSerializer.Serialize(games, new JsonSerializerOptions { WriteIndented = true }));
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

                isFeatured = isFeatured
            };

            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(data));
        }

        private void LaunchGame(string? identifier)
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

                    
                    if (!string.IsNullOrWhiteSpace(game.LaunchUrl) && game.LaunchUrl.StartsWith("goggalaxy://", StringComparison.OrdinalIgnoreCase))
                    {
                        string gogClientPath = "";
                       
                        using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\GOG.com\GalaxyClient\paths"))
                        {
                            gogClientPath = key?.GetValue("client") as string ?? "";
                            gogClientPath = gogClientPath.Replace("\"", "").Trim();
                        }

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
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show("Erro ao iniciar jogo: " + ex.Message);
            }
        }
    }
}