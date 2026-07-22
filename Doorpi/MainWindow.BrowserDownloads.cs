using Microsoft.Web.WebView2.Core;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;

namespace Doorpi
{
    public partial class MainWindow
    {
        private sealed class GenericBrowserDownloadItem
        {
            public string Id { get; set; } = Guid.NewGuid().ToString("N");
            public string FilePath { get; set; } = "";
            public string SourceUrl { get; set; } = "";
            public string MimeType { get; set; } = "";
            public string State { get; set; } = "inProgress";
            public string InterruptReason { get; set; } = "";
            public long BytesReceived { get; set; }
            public long TotalBytes { get; set; }
            public DateTime StartedUtc { get; set; } = DateTime.UtcNow;
            public DateTime? CompletedUtc { get; set; }

            [JsonIgnore]
            public CoreWebView2DownloadOperation? Operation { get; set; }
        }

        private sealed class GenericBrowserSettings
        {
            public string DownloadFolder { get; set; } = "";
        }

        private readonly List<GenericBrowserDownloadItem> _genericBrowserDownloads = new();
        private Popup? _genericBrowserDownloadsPopup;
        private Border? _genericBrowserDownloadsPanel;
        private TextBlock? _genericBrowserDownloadsBadge;
        private bool _genericBrowserDownloadsLoaded;
        private bool _genericBrowserSettingsLoaded;
        private bool _genericBrowserDownloadsSettingsOpen;
        private string _genericBrowserConfiguredDownloadFolder = "";
        private long _genericBrowserDownloadLastRenderTicks;

        private static string GenericBrowserDownloadsHistoryPath =>
            Path.Combine(DoorpiPaths.DataFolder, "browser-downloads.json");

        private static string GenericBrowserSettingsPath =>
            Path.Combine(DoorpiPaths.DataFolder, "browser-settings.json");

        private string GetGenericBrowserDownloadFolder()
        {
            LoadGenericBrowserSettings();
            string configured = _genericBrowserConfiguredDownloadFolder;
            string target = string.IsNullOrWhiteSpace(configured)
                ? DefaultUserDownloadsFolder
                : configured;
            try
            {
                target = Path.GetFullPath(Environment.ExpandEnvironmentVariables(target));
                Directory.CreateDirectory(target);
                return target;
            }
            catch
            {
                return DefaultUserDownloadsFolder;
            }
        }

        private void LoadGenericBrowserSettings()
        {
            if (_genericBrowserSettingsLoaded) return;
            _genericBrowserSettingsLoaded = true;
            try
            {
                if (!File.Exists(GenericBrowserSettingsPath)) return;
                var settings = JsonSerializer.Deserialize<GenericBrowserSettings>(
                    File.ReadAllText(GenericBrowserSettingsPath));
                _genericBrowserConfiguredDownloadFolder = settings?.DownloadFolder?.Trim() ?? "";
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DoorpiBrowser] Falha ao carregar configurações: " + ex.Message);
            }
        }

        private void SaveGenericBrowserDownloadFolder(string folder)
        {
            string fullPath = Path.GetFullPath(Environment.ExpandEnvironmentVariables(folder));
            if (!Directory.Exists(fullPath))
                throw new DirectoryNotFoundException("A pasta selecionada não está disponível.");

            _genericBrowserConfiguredDownloadFolder = fullPath;
            _genericBrowserSettingsLoaded = true;
            Directory.CreateDirectory(DoorpiPaths.DataFolder);
            File.WriteAllText(
                GenericBrowserSettingsPath,
                JsonSerializer.Serialize(
                    new GenericBrowserSettings { DownloadFolder = fullPath },
                    new JsonSerializerOptions { WriteIndented = true }));
            try
            {
                if (_ytWebView?.CoreWebView2?.Profile != null)
                    _ytWebView.CoreWebView2.Profile.DefaultDownloadFolderPath = fullPath;
            }
            catch { }
        }

        private object CreateGenericBrowserDownloadsButtonContent()
        {
            LoadGenericBrowserDownloadHistory();

            var content = new Grid { Width = 25, Height = 25 };
            content.Children.Add(CreateBrowserIcon("M12 3 V16 M7 11 L12 16 L17 11 M4 20 H20", 23));

            _genericBrowserDownloadsBadge = new TextBlock
            {
                MinWidth = 15,
                Height = 15,
                Padding = new Thickness(3, 0, 3, 0),
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment = VerticalAlignment.Top,
                TextAlignment = TextAlignment.Center,
                FontSize = 9,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                Background = new SolidColorBrush(Color.FromRgb(67, 121, 190)),
                Visibility = Visibility.Collapsed
            };
            content.Children.Add(_genericBrowserDownloadsBadge);
            UpdateGenericBrowserDownloadsButton();
            return content;
        }

        private void LoadGenericBrowserDownloadHistory()
        {
            if (_genericBrowserDownloadsLoaded) return;
            _genericBrowserDownloadsLoaded = true;

            try
            {
                if (!File.Exists(GenericBrowserDownloadsHistoryPath)) return;
                var saved = JsonSerializer.Deserialize<List<GenericBrowserDownloadItem>>(
                    File.ReadAllText(GenericBrowserDownloadsHistoryPath));
                if (saved == null) return;

                foreach (var item in saved.OrderByDescending(item => item.StartedUtc).Take(100))
                {
                    if (string.Equals(item.State, "inProgress", StringComparison.OrdinalIgnoreCase))
                    {
                        item.State = "interrupted";
                        item.InterruptReason = "O navegador foi fechado antes da conclusão.";
                    }
                    _genericBrowserDownloads.Add(item);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DoorpiBrowser] Falha ao carregar histórico de downloads: " + ex.Message);
            }
        }

        private void SaveGenericBrowserDownloadHistory()
        {
            try
            {
                Directory.CreateDirectory(DoorpiPaths.DataFolder);
                var recent = _genericBrowserDownloads
                    .OrderByDescending(item => item.StartedUtc)
                    .Take(100)
                    .ToList();
                File.WriteAllText(
                    GenericBrowserDownloadsHistoryPath,
                    JsonSerializer.Serialize(recent, new JsonSerializerOptions { WriteIndented = true }));
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DoorpiBrowser] Falha ao salvar histórico de downloads: " + ex.Message);
            }
        }

        private void OnGenericBrowserDownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs e)
        {
            try
            {
                LoadGenericBrowserDownloadHistory();
                string suggestedName = Path.GetFileName(e.ResultFilePath);
                string targetPath = AvailableDownloadPath(UserDownloadsFolder, suggestedName);
                e.ResultFilePath = targetPath;
                e.Handled = true;

                CoreWebView2DownloadOperation operation = e.DownloadOperation;
                var item = new GenericBrowserDownloadItem
                {
                    FilePath = targetPath,
                    SourceUrl = operation.Uri ?? "",
                    MimeType = operation.MimeType ?? "",
                    BytesReceived = operation.BytesReceived,
                    TotalBytes = NormalizeGenericBrowserDownloadTotal(operation.TotalBytesToReceive),
                    Operation = operation
                };

                _genericBrowserDownloads.Insert(0, item);
                if (_genericBrowserDownloads.Count > 100)
                    _genericBrowserDownloads.RemoveRange(100, _genericBrowserDownloads.Count - 100);
                SaveGenericBrowserDownloadHistory();

                operation.BytesReceivedChanged += (_, _) =>
                    Dispatcher.BeginInvoke(() => UpdateGenericBrowserDownloadProgress(item));
                operation.StateChanged += (_, _) =>
                    Dispatcher.BeginInvoke(() => UpdateGenericBrowserDownloadState(item));

                UpdateGenericBrowserDownloadsButton();
                RenderGenericBrowserDownloadsPanel();
                OpenGenericBrowserDownloadsPopup();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DoorpiBrowser] Falha ao preparar download: " + ex.Message);
            }
        }

        private void UpdateGenericBrowserDownloadProgress(GenericBrowserDownloadItem item)
        {
            CoreWebView2DownloadOperation? operation = item.Operation;
            if (operation == null) return;
            item.BytesReceived = operation.BytesReceived;
            item.TotalBytes = NormalizeGenericBrowserDownloadTotal(operation.TotalBytesToReceive);

            long now = Environment.TickCount64;
            if (now - Interlocked.Read(ref _genericBrowserDownloadLastRenderTicks) < 180) return;
            Interlocked.Exchange(ref _genericBrowserDownloadLastRenderTicks, now);
            RenderGenericBrowserDownloadsPanel();
        }

        private void UpdateGenericBrowserDownloadState(GenericBrowserDownloadItem item)
        {
            CoreWebView2DownloadOperation? operation = item.Operation;
            if (operation == null) return;

            item.BytesReceived = operation.BytesReceived;
            item.TotalBytes = NormalizeGenericBrowserDownloadTotal(operation.TotalBytesToReceive);
            item.State = operation.State switch
            {
                CoreWebView2DownloadState.Completed => "completed",
                CoreWebView2DownloadState.Interrupted => "interrupted",
                _ => "inProgress"
            };
            item.InterruptReason = operation.State == CoreWebView2DownloadState.Interrupted
                ? operation.InterruptReason.ToString()
                : "";
            if (operation.State == CoreWebView2DownloadState.Completed)
                item.CompletedUtc = DateTime.UtcNow;

            SaveGenericBrowserDownloadHistory();
            UpdateGenericBrowserDownloadsButton();
            RenderGenericBrowserDownloadsPanel();
            if (operation.State != CoreWebView2DownloadState.InProgress)
                OpenGenericBrowserDownloadsPopup();
        }

        private void ToggleGenericBrowserDownloadsPanel()
        {
            if (_genericBrowserDownloadsPopup?.IsOpen == true)
            {
                CloseGenericBrowserDownloadsPopup();
                return;
            }

            CloseGenericBrowserExtensionsPopup();
            RenderGenericBrowserDownloadsPanel();
            OpenGenericBrowserDownloadsPopup();
        }

        private void OpenGenericBrowserDownloadsPopup()
        {
            Window? browserWindow = _webAppWindow;
            bool browserCanOwnPopup =
                _isGenericBrowserMode &&
                !_ytClosing &&
                browserWindow != null &&
                browserWindow.IsVisible &&
                browserWindow.IsActive &&
                browserWindow.WindowState != WindowState.Minimized;
            if (!browserCanOwnPopup)
            {
                CloseGenericBrowserDownloadsPopup();
                return;
            }

            if (_genericBrowserDownloadsButton == null) return;
            EnsureGenericBrowserDownloadsPopup();
            if (_genericBrowserDownloadsPopup == null || _genericBrowserDownloadsPanel == null) return;
            _genericBrowserDownloadsPanel.Visibility = Visibility.Visible;
            _genericBrowserDownloadsPopup.IsOpen = true;
        }

        private void EnsureGenericBrowserDownloadsPopup()
        {
            if (_genericBrowserDownloadsPopup != null || _genericBrowserDownloadsButton == null) return;

            _genericBrowserDownloadsPanel = new Border
            {
                Width = 520,
                MaxHeight = 650,
                Background = new SolidColorBrush(Color.FromRgb(25, 30, 41)),
                BorderBrush = new SolidColorBrush(Color.FromArgb(60, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(12),
                Padding = new Thickness(16)
            };
            _genericBrowserDownloadsPopup = new Popup
            {
                PlacementTarget = _genericBrowserDownloadsButton,
                Placement = PlacementMode.Bottom,
                HorizontalOffset = -466,
                VerticalOffset = 10,
                StaysOpen = false,
                AllowsTransparency = true,
                Child = _genericBrowserDownloadsPanel
            };
        }

        private void CloseGenericBrowserDownloadsPopup()
        {
            if (_genericBrowserDownloadsPopup != null)
                _genericBrowserDownloadsPopup.IsOpen = false;
            if (_genericBrowserDownloadsPanel != null)
                _genericBrowserDownloadsPanel.Visibility = Visibility.Collapsed;
        }

        private void RenderGenericBrowserDownloadsPanel()
        {
            if (_genericBrowserDownloadsPanel == null)
            {
                if (_genericBrowserDownloadsButton == null) return;
                EnsureGenericBrowserDownloadsPopup();
            }
            if (_genericBrowserDownloadsPanel == null) return;

            LoadGenericBrowserDownloadHistory();
            if (_genericBrowserDownloadsSettingsOpen)
            {
                RenderGenericBrowserDownloadSettings();
                return;
            }

            var root = new DockPanel();
            var header = new Grid { Margin = new Thickness(2, 0, 2, 14) };
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            var heading = new StackPanel();
            heading.Children.Add(new TextBlock
            {
                Text = "Downloads",
                Foreground = Brushes.White,
                FontSize = 22,
                FontWeight = FontWeights.Bold
            });
            heading.Children.Add(new TextBlock
            {
                Text = _genericBrowserDownloads.Count == 1
                    ? "1 arquivo no histórico"
                    : $"{_genericBrowserDownloads.Count} arquivos no histórico",
                Foreground = new SolidColorBrush(Color.FromRgb(164, 173, 189)),
                FontSize = 12,
                Margin = new Thickness(0, 3, 0, 0)
            });
            header.Children.Add(heading);

            var clear = CreateGenericBrowserDownloadActionButton("Limpar", false);
            clear.IsEnabled = _genericBrowserDownloads.Count > 0;
            clear.Click += (_, _) =>
            {
                _genericBrowserDownloads.RemoveAll(item => !string.Equals(item.State, "inProgress", StringComparison.OrdinalIgnoreCase));
                SaveGenericBrowserDownloadHistory();
                UpdateGenericBrowserDownloadsButton();
                RenderGenericBrowserDownloadsPanel();
            };
            Grid.SetColumn(clear, 1);
            header.Children.Add(clear);

            var settings = CreateGenericBrowserDownloadSettingsButton();
            settings.Margin = new Thickness(8, 0, 0, 0);
            settings.Click += (_, _) =>
            {
                _genericBrowserDownloadsSettingsOpen = true;
                RenderGenericBrowserDownloadsPanel();
            };
            Grid.SetColumn(settings, 2);
            header.Children.Add(settings);
            DockPanel.SetDock(header, Dock.Top);
            root.Children.Add(header);

            var footer = new Grid { Margin = new Thickness(0, 14, 0, 0) };
            var openFolder = CreateGenericBrowserDownloadActionButton("Abrir pasta de downloads", true);
            openFolder.HorizontalAlignment = HorizontalAlignment.Stretch;
            openFolder.Click += (_, _) => OpenDoorpiDownloadInExplorer(UserDownloadsFolder);
            footer.Children.Add(openFolder);
            DockPanel.SetDock(footer, Dock.Bottom);
            root.Children.Add(footer);

            var list = new StackPanel();
            if (_genericBrowserDownloads.Count == 0)
            {
                list.Children.Add(new TextBlock
                {
                    Text = "Os arquivos baixados neste navegador aparecerão aqui.",
                    Foreground = new SolidColorBrush(Color.FromRgb(180, 188, 201)),
                    FontSize = 14,
                    TextWrapping = TextWrapping.Wrap,
                    Margin = new Thickness(4, 22, 4, 22)
                });
            }
            else
            {
                foreach (var item in _genericBrowserDownloads.Take(100))
                    list.Children.Add(BuildGenericBrowserDownloadRow(item));
            }

            root.Children.Add(new ScrollViewer
            {
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
                MaxHeight = 500,
                Content = list
            });
            _genericBrowserDownloadsPanel.Child = root;
        }

        private Button CreateGenericBrowserDownloadSettingsButton()
        {
            return new Button
            {
                Content = new TextBlock
                {
                    Text = "\uE713",
                    FontFamily = new FontFamily("Segoe MDL2 Assets"),
                    FontSize = 17,
                    HorizontalAlignment = HorizontalAlignment.Center,
                    VerticalAlignment = VerticalAlignment.Center
                },
                ToolTip = "Configurações de downloads",
                Width = 36,
                Height = 34,
                Padding = new Thickness(0),
                Foreground = Brushes.White,
                Cursor = System.Windows.Input.Cursors.Hand,
                Background = new SolidColorBrush(Color.FromRgb(47, 54, 69)),
                BorderBrush = new SolidColorBrush(Color.FromArgb(50, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                Style = CreateBrowserToolbarButtonStyle()
            };
        }

        private void RenderGenericBrowserDownloadSettings()
        {
            if (_genericBrowserDownloadsPanel == null) return;

            var root = new DockPanel();
            var header = new Grid { Margin = new Thickness(2, 0, 2, 18) };
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            header.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            var back = CreateGenericBrowserDownloadActionButton("Voltar", false);
            back.Margin = new Thickness(0, 0, 12, 0);
            back.Click += (_, _) =>
            {
                _genericBrowserDownloadsSettingsOpen = false;
                RenderGenericBrowserDownloadsPanel();
            };
            header.Children.Add(back);

            var title = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
            title.Children.Add(new TextBlock
            {
                Text = "Configurações de downloads",
                Foreground = Brushes.White,
                FontSize = 19,
                FontWeight = FontWeights.Bold
            });
            title.Children.Add(new TextBlock
            {
                Text = "Escolha onde os novos arquivos serão salvos.",
                Foreground = new SolidColorBrush(Color.FromRgb(164, 173, 189)),
                FontSize = 11,
                Margin = new Thickness(0, 3, 0, 0)
            });
            Grid.SetColumn(title, 1);
            header.Children.Add(title);
            DockPanel.SetDock(header, Dock.Top);
            root.Children.Add(header);

            var content = new StackPanel();
            content.Children.Add(new TextBlock
            {
                Text = "Pasta atual",
                Foreground = new SolidColorBrush(Color.FromRgb(180, 188, 201)),
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(2, 0, 2, 8)
            });
            var pathBorder = new Border
            {
                Padding = new Thickness(13, 11, 13, 11),
                CornerRadius = new CornerRadius(9),
                Background = new SolidColorBrush(Color.FromRgb(34, 40, 53)),
                BorderBrush = new SolidColorBrush(Color.FromArgb(38, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                Child = new TextBlock
                {
                    Text = UserDownloadsFolder,
                    Foreground = Brushes.White,
                    FontSize = 13,
                    TextWrapping = TextWrapping.Wrap
                }
            };
            content.Children.Add(pathBorder);

            var choose = CreateGenericBrowserDownloadActionButton("Escolher outra pasta", true);
            choose.Height = 40;
            choose.HorizontalAlignment = HorizontalAlignment.Stretch;
            choose.Margin = new Thickness(0, 14, 0, 0);
            choose.Click += (_, _) => ChooseGenericBrowserDownloadFolder();
            content.Children.Add(choose);
            root.Children.Add(content);
            _genericBrowserDownloadsPanel.Child = root;
        }

        private FrameworkElement BuildGenericBrowserDownloadRow(GenericBrowserDownloadItem item)
        {
            bool exists = File.Exists(item.FilePath);
            bool completed = string.Equals(item.State, "completed", StringComparison.OrdinalIgnoreCase);
            bool active = string.Equals(item.State, "inProgress", StringComparison.OrdinalIgnoreCase);
            double percent = item.TotalBytes > 0
                ? Math.Clamp(item.BytesReceived * 100d / item.TotalBytes, 0, 100)
                : 0;

            var card = new Border
            {
                Margin = new Thickness(0, 0, 0, 9),
                Padding = new Thickness(13),
                CornerRadius = new CornerRadius(10),
                Background = new SolidColorBrush(Color.FromRgb(34, 40, 53)),
                BorderBrush = new SolidColorBrush(Color.FromArgb(34, 255, 255, 255)),
                BorderThickness = new Thickness(1)
            };
            var grid = new Grid();
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var info = new StackPanel { Margin = new Thickness(0, 0, 12, 0) };
            info.Children.Add(new TextBlock
            {
                Text = Path.GetFileName(item.FilePath),
                Foreground = Brushes.White,
                FontSize = 14,
                FontWeight = FontWeights.SemiBold,
                TextTrimming = TextTrimming.CharacterEllipsis
            });
            string status = active
                ? (item.TotalBytes > 0
                    ? $"Baixando · {Math.Round(percent)}% · {FormatGenericBrowserDownloadBytes(item.BytesReceived)} de {FormatGenericBrowserDownloadBytes(item.TotalBytes)}"
                    : $"Baixando · {FormatGenericBrowserDownloadBytes(item.BytesReceived)}")
                : completed
                    ? (exists ? $"Concluído · {FormatGenericBrowserDownloadBytes(item.BytesReceived)}" : "Arquivo não encontrado")
                    : "Download interrompido";
            info.Children.Add(new TextBlock
            {
                Text = status,
                Foreground = new SolidColorBrush(completed && exists
                    ? Color.FromRgb(146, 211, 176)
                    : active ? Color.FromRgb(163, 191, 229) : Color.FromRgb(229, 157, 165)),
                FontSize = 11,
                Margin = new Thickness(0, 5, 0, 0),
                TextTrimming = TextTrimming.CharacterEllipsis
            });
            if (active)
            {
                info.Children.Add(new ProgressBar
                {
                    Height = 5,
                    Margin = new Thickness(0, 9, 0, 0),
                    Minimum = 0,
                    Maximum = 100,
                    Value = percent,
                    IsIndeterminate = item.TotalBytes <= 0,
                    Foreground = new SolidColorBrush(Color.FromRgb(82, 137, 206)),
                    Background = new SolidColorBrush(Color.FromRgb(19, 23, 31))
                });
            }
            grid.Children.Add(info);

            var actions = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                VerticalAlignment = VerticalAlignment.Center
            };
            if (active && item.Operation != null)
            {
                var cancel = CreateGenericBrowserDownloadActionButton("Cancelar", false);
                cancel.Click += (_, _) => item.Operation?.Cancel();
                actions.Children.Add(cancel);
            }
            else
            {
                var show = CreateGenericBrowserDownloadActionButton("Mostrar na pasta", true);
                show.IsEnabled = exists;
                show.Click += (_, _) => OpenDoorpiDownloadInExplorer(item.FilePath);
                actions.Children.Add(show);
            }
            Grid.SetColumn(actions, 1);
            grid.Children.Add(actions);
            card.Child = grid;
            return card;
        }

        private static Button CreateGenericBrowserDownloadActionButton(string text, bool primary)
        {
            return new Button
            {
                Content = text,
                MinWidth = 72,
                Height = 34,
                Padding = new Thickness(11, 0, 11, 0),
                Foreground = Brushes.White,
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Cursor = System.Windows.Input.Cursors.Hand,
                Background = new SolidColorBrush(primary
                    ? Color.FromRgb(65, 105, 158)
                    : Color.FromRgb(47, 54, 69)),
                BorderBrush = new SolidColorBrush(Color.FromArgb(50, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                Style = CreateBrowserToolbarButtonStyle()
            };
        }

        private void UpdateGenericBrowserDownloadsButton()
        {
            int active = _genericBrowserDownloads.Count(item =>
                string.Equals(item.State, "inProgress", StringComparison.OrdinalIgnoreCase));
            if (_genericBrowserDownloadsBadge != null)
            {
                _genericBrowserDownloadsBadge.Text = active > 9 ? "9+" : active.ToString();
                _genericBrowserDownloadsBadge.Visibility = active > 0
                    ? Visibility.Visible
                    : Visibility.Collapsed;
            }
            if (_genericBrowserDownloadsButton != null)
                _genericBrowserDownloadsButton.ToolTip = _genericBrowserDownloads.Count == 0
                    ? "Downloads"
                    : $"Downloads ({_genericBrowserDownloads.Count})";
        }

        private static string FormatGenericBrowserDownloadBytes(long bytes)
        {
            if (bytes < 1024) return $"{Math.Max(0, bytes)} B";
            if (bytes < 1024L * 1024) return $"{bytes / 1024d:0.0} KB";
            if (bytes < 1024L * 1024 * 1024) return $"{bytes / (1024d * 1024):0.0} MB";
            return $"{bytes / (1024d * 1024 * 1024):0.0} GB";
        }

        private static long NormalizeGenericBrowserDownloadTotal(ulong? total)
            => total.HasValue && total.Value <= long.MaxValue ? (long)total.Value : 0;

        private async void ChooseGenericBrowserDownloadFolder()
        {
            if (!_isGenericBrowserMode || _ytClosing) return;

            string currentFolder = UserDownloadsFolder;
            CloseGenericBrowserDownloadsPopup();

            string? selectedFolder = null;
            try
            {
                selectedFolder = await ShowDoorpiFileBrowserAsync(
                    "Selecionar pasta de downloads",
                    selectFolder: true,
                    source: "browserDownloadFolder",
                    initialPath: currentFolder);
                if (!string.IsNullOrWhiteSpace(selectedFolder))
                    SaveGenericBrowserDownloadFolder(selectedFolder);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DoorpiBrowser] Falha ao alterar pasta de downloads: " + ex.Message);
            }
            finally
            {
                RestoreGenericBrowserAfterDoorpiFileExplorerClose(() =>
                {
                    _genericBrowserDownloadsSettingsOpen = true;
                    RenderGenericBrowserDownloadsPanel();
                    OpenGenericBrowserDownloadsPopup();
                });
            }
        }

        private void OpenDoorpiDownloadInExplorer(string path)
        {
            CloseGenericBrowserDownloadsPopup();
            try
            {
                OpenDoorpiFileExplorer(path, returnToBrowserOnClose: true);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DoorpiBrowser] Falha ao abrir explorador sobre o browser: " + ex.Message);
                RestoreGenericBrowserAfterDoorpiFileExplorerClose();
            }
        }

        private void RestoreGenericBrowserAfterDoorpiFileExplorerClose(Action? afterRestore = null)
        {
            Dispatcher.BeginInvoke(() =>
            {
                Window? browserWindow = _webAppWindow;
                if (!_isGenericBrowserMode || _ytClosing || browserWindow == null)
                    return;

                try
                {
                    // FocusDoorpiKeepSession retoma a Home para hospedar o seletor.
                    // Ao voltar ao browser, devolva a posse exclusiva do controle ao
                    // modo de midia antes de tornar sua janela interativa novamente.
                    SuspendMainUiGamepadForGameLaunch();
                    RequestMediaMouseInputAbort();
                    ReleaseAllStuckKeys();
                    Interlocked.Increment(ref _genericBrowserVkbOpenRequestId);
                    _genericBrowserControllerInputUntilUtc = DateTime.MinValue;
                    try { _desktopVkb?.StopHold(); } catch { }
                    try { _desktopVkb?.Close(); } catch { }
                    _desktopVkb = null;
                    ClearGenericBrowserKeyboardStateForControllerAbort();
                    _ = TrySuspendDoorpiHomeWebViewAsync();

                    if (browserWindow.WindowState == WindowState.Minimized)
                        browserWindow.WindowState = WindowState.Maximized;
                    browserWindow.Show();
                    if (WindowState != WindowState.Minimized)
                        WindowState = WindowState.Minimized;
                    browserWindow.Activate();
                    _ytWebView?.Focus();
                    _ = _ytWebView?.CoreWebView2?.ExecuteScriptAsync("try{window.focus();}catch(e){}");
                    StartMediaControllerMode();
                    EnsureCursorVisible();
                    afterRestore?.Invoke();
                }
                catch { }
            }, System.Windows.Threading.DispatcherPriority.ContextIdle);
        }

    }
}
