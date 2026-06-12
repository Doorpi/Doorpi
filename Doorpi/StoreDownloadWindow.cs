using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;

namespace Doorpi
{
    public sealed class StoreDownloadWindow : Window
    {
        private readonly string _storeName;
        private readonly string _downloadFolder;
        private readonly WebView2 _webView;
        private readonly Grid _statusPanel;
        private readonly TextBlock _title;
        private readonly TextBlock _subtitle;
        private readonly ProgressBar _progress;
        private readonly TextBlock _progressText;
        private readonly TextBlock _stepLabel;
        private readonly TextBlock _detailLabel;
        private readonly StackPanel _actions;
        private readonly Button _retryButton;
        private readonly Button _cancelButton;
        private CoreWebView2DownloadOperation? _activeDownload;
        private bool _downloadStarted;
        private bool _completedOrHandedOff;
        private bool _cancelPromptVisible;
        private StatusSnapshot? _statusBeforeCancelPrompt;
        private ActionMode _actionMode = ActionMode.Retry;
        private DateTime _lastProgressAtUtc = DateTime.MinValue;
        private long _lastProgressBytes;
        private double _lastSpeedBytesPerSecond;
        private volatile bool _controllerNavActive;
        private Thread? _controllerNavThread;
        private int _focusedActionIndex;

        private enum ActionMode
        {
            Retry,
            CancelConfirmation
        }

        private sealed record StatusSnapshot(
            string Title,
            string Subtitle,
            string Step,
            string Detail,
            bool ProgressIndeterminate,
            double ProgressValue,
            string ProgressText,
            bool WebVisible);

        [DllImport("xinput1_4.dll", EntryPoint = "XInputGetState")]
        private static extern int XInputGetState(int dwUserIndex, out XINPUT_STATE pState);

        [StructLayout(LayoutKind.Sequential)]
        private struct XINPUT_STATE
        {
            public uint dwPacketNumber;
            public XINPUT_GAMEPAD Gamepad;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct XINPUT_GAMEPAD
        {
            public ushort wButtons;
            public byte bLeftTrigger;
            public byte bRightTrigger;
            public short sThumbLX;
            public short sThumbLY;
            public short sThumbRX;
            public short sThumbRY;
        }

        public event Action<string, double?>? DownloadProgress;
        public event Action<string>? DownloadCompleted;
        public event Action<string>? DownloadFailed;
        public event Action? DownloadIntent;
        public event Action? RetryRequested;
        public event Action? ContinueRequested;
        public event Action? CancelRequested;
        public event Action? BrowserClosedBeforeDownload;

        public StoreDownloadWindow(string storeName, string downloadFolder)
        {
            _storeName = string.IsNullOrWhiteSpace(storeName) ? "Loja" : storeName;
            _downloadFolder = downloadFolder;

            Title = $"Doorpi - {_storeName}";
            WindowStyle = WindowStyle.None;
            WindowState = WindowState.Maximized;
            ResizeMode = ResizeMode.NoResize;
            Background = Brushes.Black;
            ShowInTaskbar = false;

            var root = new Grid();
            _webView = new WebView2
            {
                HorizontalAlignment = HorizontalAlignment.Stretch,
                VerticalAlignment = VerticalAlignment.Stretch
            };
            root.Children.Add(_webView);

            _statusPanel = BuildStatusPanel(
                out _title,
                out _subtitle,
                out _progress,
                out _progressText,
                out _stepLabel,
                out _detailLabel,
                out _actions,
                out _retryButton,
                out _cancelButton);
            _statusPanel.Visibility = Visibility.Collapsed;
            root.Children.Add(_statusPanel);

            _retryButton.Click += (_, _) =>
            {
                if (_actionMode == ActionMode.CancelConfirmation)
                    ContinueRequested?.Invoke();
                else
                    RetryRequested?.Invoke();
            };
            _cancelButton.Click += (_, _) => CancelRequested?.Invoke();
            _retryButton.GotFocus += (_, _) => _focusedActionIndex = 0;
            _cancelButton.GotFocus += (_, _) => _focusedActionIndex = 1;
            PreviewKeyDown += OnPreviewKeyDown;

            Content = root;

            Closed += (_, _) =>
            {
                StopControllerNavigation();
                try { _webView.Dispose(); } catch { }
                if (!_downloadStarted && !_completedOrHandedOff)
                    BrowserClosedBeforeDownload?.Invoke();
            };
        }

        public async System.Threading.Tasks.Task InitializeAsync(CoreWebView2Environment environment, string url)
        {
            await _webView.EnsureCoreWebView2Async(environment);
            _webView.CoreWebView2.Settings.AreHostObjectsAllowed = false;
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            try { _webView.CoreWebView2.Profile.DefaultDownloadFolderPath = _downloadFolder; } catch { }
            _webView.CoreWebView2.NewWindowRequested += (_, e) =>
            {
                e.Handled = true;
                if (!string.IsNullOrWhiteSpace(e.Uri))
                    _webView.CoreWebView2.Navigate(e.Uri);
            };
            _webView.CoreWebView2.NavigationStarting += (_, e) =>
            {
                if (LooksLikeInstallerUrl(e.Uri))
                {
                    DownloadIntent?.Invoke();
                }
            };
            _webView.CoreWebView2.WindowCloseRequested += (_, _) => Close();
            _webView.CoreWebView2.WebMessageReceived += (_, e) =>
            {
                try
                {
                    string msg = e.TryGetWebMessageAsString();
                    if (string.Equals(msg, "doorpi-store-download-intent", StringComparison.Ordinal))
                    {
                        DownloadIntent?.Invoke();
                    }
                }
                catch { }
            };
            await _webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
(function() {
    if (window.__doorpiStoreDownloadIntent) return;
    window.__doorpiStoreDownloadIntent = true;

    function textOf(el) {
        if (!el) return '';
        return [
            el.innerText || '',
            el.textContent || '',
            el.getAttribute('aria-label') || '',
            el.getAttribute('title') || '',
            el.getAttribute('href') || '',
            el.getAttribute('download') || ''
        ].join(' ').toLowerCase();
    }

    function findCandidate(ev) {
        if (!ev) return null;
        if (ev.target && ev.target.closest) {
            var direct = ev.target.closest('a,button,[role=""button""],[download],input[type=""button""],input[type=""submit""]');
            if (direct) return direct;
        }
        var path = ev.composedPath ? ev.composedPath() : [];
        for (var i = 0; i < path.length; i++) {
            var node = path[i];
            if (node && node.matches && node.matches('a,button,[role=""button""],[download],input[type=""button""],input[type=""submit""]')) return node;
        }
        return null;
    }

    function notifyIfDownload(ev) {
        var el = findCandidate(ev);
        var txt = textOf(el);
        if (!txt) return;
        if (/download|baixar|installer|instalador|setup|windows|pc|galaxy|steam|epic|riot|xbox|gog/.test(txt)) {
            try { window.chrome.webview.postMessage('doorpi-store-download-intent'); } catch(_) {}
        }
    }

    document.addEventListener('pointerdown', notifyIfDownload, true);
    document.addEventListener('mousedown', notifyIfDownload, true);
    document.addEventListener('click', notifyIfDownload, true);
    document.addEventListener('submit', function() {
        try { window.chrome.webview.postMessage('doorpi-store-download-intent'); } catch(_) {}
    }, true);
})();");
            _webView.CoreWebView2.DownloadStarting += OnDownloadStarting;
            _webView.CoreWebView2.Navigate(url);
        }

        public void MarkHandedOff()
        {
            _completedOrHandedOff = true;
        }

        public void ShowInstalling()
        {
            Dispatcher.Invoke(() =>
            {
                _cancelPromptVisible = false;
                ShowStatusPanel();
                _title.Text = $"Instalando {_storeName}";
                _subtitle.Text = "O instalador foi aberto. Conclua o setup e mantenha esta janela aberta.";
                _stepLabel.Text = "Permissao temporaria";
                _detailLabel.Text = "Se o Windows pedir permissao, autorize o assistente do Doorpi. Se o setup for cancelado ou travar, use Cancelar processo para voltar imediatamente.";
                _progress.IsIndeterminate = true;
                _progress.Value = 100;
                _progressText.Text = "";
                SetActionsVisible(true, false, "", "Cancelar processo", ActionMode.Retry);
                _cancelButton.Focus();
            });
        }

        public void ShowPreparingDownload()
        {
            Dispatcher.Invoke(() =>
            {
                if (_downloadStarted) return;
                _cancelPromptVisible = false;
                ShowStatusPanel();
                _title.Text = $"Preparando download";
                _subtitle.Text = $"Aguardando o download da {_storeName} iniciar...";
                _stepLabel.Text = "Aguardando navegador";
                _detailLabel.Text = "Se nada acontecer, tente clicar novamente no botao de download da loja.";
                _progress.IsIndeterminate = true;
                _progress.Value = 0;
                _progressText.Text = "";
                SetActionsVisible(false);
            });
        }

        public void ShowInstallError(string message, bool canRetry)
        {
            Dispatcher.Invoke(() =>
            {
                _cancelPromptVisible = false;
                ShowStatusPanel();
                _title.Text = "Nao foi possivel instalar";
                _subtitle.Text = string.IsNullOrWhiteSpace(message)
                    ? "O download ou instalacao nao foi concluido."
                    : message;
                _stepLabel.Text = "Acao necessaria";
                _detailLabel.Text = canRetry
                    ? "Use A para tentar novamente ou B para cancelar e voltar ao Doorpi."
                    : "Use A ou B para voltar ao Doorpi.";
                _progress.IsIndeterminate = false;
                _progress.Value = 0;
                _progressText.Text = "";
                SetActionsVisible(true, canRetry, "Tentar novamente", "Cancelar", ActionMode.Retry);
                (canRetry ? _retryButton : _cancelButton).Focus();
            });
        }

        public void ShowInstallSuccess()
        {
            Dispatcher.Invoke(() =>
            {
                _cancelPromptVisible = false;
                ShowStatusPanel();
                _title.Text = "Loja instalada";
                _subtitle.Text = $"{_storeName} ja esta disponivel no Doorpi.";
                _stepLabel.Text = "Concluido";
                _detailLabel.Text = "Voltando para o Doorpi com a loja atualizada.";
                _progress.IsIndeterminate = false;
                _progress.Value = 100;
                _progressText.Text = "100%";
                SetActionsVisible(false);
            });
        }

        public void HideOverlayAndFocusSite()
        {
            Dispatcher.Invoke(() =>
            {
                _cancelPromptVisible = false;
                StopControllerNavigation();
                _statusPanel.Visibility = Visibility.Collapsed;
                _webView.Visibility = Visibility.Visible;
                _webView.IsHitTestVisible = true;
                _webView.Focus();
            });
        }

        public void ShowCancelConfirmation()
        {
            Dispatcher.Invoke(() =>
            {
                if (!_cancelPromptVisible)
                {
                    _statusBeforeCancelPrompt = new StatusSnapshot(
                        _title.Text,
                        _subtitle.Text,
                        _stepLabel.Text,
                        _detailLabel.Text,
                        _progress.IsIndeterminate,
                        _progress.Value,
                        _progressText.Text,
                        _webView.Visibility == Visibility.Visible);
                }

                _cancelPromptVisible = true;
                ShowStatusPanel();
                _title.Text = "Cancelar instalacao?";
                _subtitle.Text = $"O download ou instalacao da {_storeName} sera interrompido e voce voltara ao Doorpi.";
                _stepLabel.Text = "Processo em andamento";
                _detailLabel.Text = "Use Continuar para voltar ao instalador/site. Use Cancelar processo apenas se quiser desistir desta instalacao.";
                _progress.IsIndeterminate = false;
                _progress.Value = 0;
                _progressText.Text = "";
                SetActionsVisible(true, true, "Continuar", "Cancelar processo", ActionMode.CancelConfirmation);
                _retryButton.Focus();
            });
        }

        public void RestoreAfterCancelConfirmation()
        {
            Dispatcher.Invoke(() =>
            {
                _cancelPromptVisible = false;
                var snapshot = _statusBeforeCancelPrompt;
                _statusBeforeCancelPrompt = null;
                if (snapshot == null)
                    return;

                _title.Text = snapshot.Title;
                _subtitle.Text = snapshot.Subtitle;
                _stepLabel.Text = snapshot.Step;
                _detailLabel.Text = snapshot.Detail;
                _progress.IsIndeterminate = snapshot.ProgressIndeterminate;
                _progress.Value = snapshot.ProgressValue;
                _progressText.Text = snapshot.ProgressText;
                SetActionsVisible(false);

                if (snapshot.WebVisible)
                {
                    _statusPanel.Visibility = Visibility.Collapsed;
                    _webView.Visibility = Visibility.Visible;
                    _webView.IsHitTestVisible = true;
                    _webView.Focus();
                }
                else
                {
                    ShowStatusPanel();
                }
            });
        }

        public void CancelActiveDownload()
        {
            try { _activeDownload?.Cancel(); } catch { }
        }

        private void OnDownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs e)
        {
            try
            {
                Directory.CreateDirectory(_downloadFolder);
                string suggestedName = Path.GetFileName(e.ResultFilePath);
                if (string.IsNullOrWhiteSpace(suggestedName))
                    suggestedName = $"{SafeFileName(_storeName)}Setup.exe";

                string targetPath = GetAvailablePath(Path.Combine(_downloadFolder, suggestedName));
                e.ResultFilePath = targetPath;
                e.Handled = true;
                _downloadStarted = true;
                _activeDownload = e.DownloadOperation;
                _lastProgressAtUtc = DateTime.UtcNow;
                _lastProgressBytes = 0;
                _lastSpeedBytesPerSecond = 0;

                Dispatcher.Invoke(() =>
                {
                    _cancelPromptVisible = false;
                    ShowStatusPanel();
                    _title.Text = $"Baixando {_storeName}";
                    _subtitle.Text = "Mantenha esta janela aberta enquanto o download termina.";
                    _stepLabel.Text = "Download em andamento";
                    _detailLabel.Text = "O Doorpi vai abrir o instalador automaticamente quando o arquivo terminar de baixar.";
                    _progress.IsIndeterminate = true;
                    _progress.Value = 0;
                    _progressText.Text = "";
                    SetActionsVisible(false);
                });

                var op = e.DownloadOperation;
                op.BytesReceivedChanged += (_, _) => UpdateProgress(op, targetPath);
                op.StateChanged += (_, _) =>
                {
                    if (op.State == CoreWebView2DownloadState.Completed)
                    {
                        _completedOrHandedOff = true;
                        Dispatcher.Invoke(() =>
                        {
                            if (_cancelPromptVisible)
                                return;

                            _cancelPromptVisible = false;
                            _title.Text = $"Download concluido";
                            _subtitle.Text = "Abrindo instalador...";
                            _stepLabel.Text = "Preparando instalador";
                            _detailLabel.Text = "O arquivo baixado sera removido automaticamente quando o processo terminar ou for cancelado.";
                            _progress.IsIndeterminate = false;
                            _progress.Value = 100;
                            _progressText.Text = "100%";
                            SetActionsVisible(false);
                        });
                        DownloadCompleted?.Invoke(targetPath);
                    }
                    else if (op.State == CoreWebView2DownloadState.Interrupted)
                    {
                        _completedOrHandedOff = true;
                        DownloadFailed?.Invoke("O download foi interrompido.");
                    }
                };

                UpdateProgress(op, targetPath);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[StoreDownloadWindow] Falha ao iniciar download: " + ex.Message);
                _completedOrHandedOff = true;
                DownloadFailed?.Invoke("Nao foi possivel iniciar o download.");
            }
        }

        private void UpdateProgress(CoreWebView2DownloadOperation op, string targetPath)
        {
            try
            {
                double? percent = null;
                ulong? total = op.TotalBytesToReceive;
                long received = op.BytesReceived;
                double speedBytesPerSecond = CalculateSpeed(received);
                if (total.HasValue && total.Value > 0)
                    percent = Math.Clamp(received * 100.0 / (double)total.Value, 0, 100);

                Dispatcher.Invoke(() =>
                {
                    if (_cancelPromptVisible)
                        return;

                    if (percent.HasValue)
                    {
                        double totalBytes = total.HasValue ? Convert.ToDouble(total.Value) : 0;
                        _progress.IsIndeterminate = false;
                        _progress.Value = percent.Value;
                        _progressText.Text = totalBytes > 0
                            ? $"{percent.Value:0}% - {FormatBytes(received)} / {FormatBytes(totalBytes)}{FormatSpeedAndEta(speedBytesPerSecond, Math.Max(0, totalBytes - received))}"
                            : $"{percent.Value:0}%";
                    }
                    else
                    {
                        _progress.IsIndeterminate = true;
                        _progressText.Text = $"{FormatBytes(received)} baixados{FormatSpeedAndEta(speedBytesPerSecond, null)}";
                    }
                });

                DownloadProgress?.Invoke(targetPath, percent);
            }
            catch { }
        }

        private void ShowStatusPanel()
        {
            _webView.Visibility = Visibility.Collapsed;
            _webView.IsHitTestVisible = false;
            _statusPanel.Visibility = Visibility.Visible;
            Activate();
        }

        private static Grid BuildStatusPanel(
            out TextBlock title,
            out TextBlock subtitle,
            out ProgressBar progress,
            out TextBlock progressText,
            out TextBlock stepLabel,
            out TextBlock detailLabel,
            out StackPanel actions,
            out Button retryButton,
            out Button cancelButton)
        {
            var overlay = new Grid
            {
                Background = new LinearGradientBrush(
                    Color.FromRgb(4, 7, 13),
                    Color.FromRgb(10, 16, 26),
                    26),
                HorizontalAlignment = HorizontalAlignment.Stretch,
                VerticalAlignment = VerticalAlignment.Stretch
            };

            overlay.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            overlay.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            overlay.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

            var shell = new Grid
            {
                MaxWidth = 1160,
                Margin = new Thickness(72, 0, 72, 0),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            shell.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            shell.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(320) });

            var main = new StackPanel
            {
                Orientation = Orientation.Vertical,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(0, 0, 56, 0)
            };

            var eyebrow = new TextBlock
            {
                Text = "Doorpi",
                Foreground = new SolidColorBrush(Color.FromArgb(160, 150, 198, 255)),
                FontSize = 15,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(0, 0, 0, 14)
            };

            title = new TextBlock
            {
                Foreground = Brushes.White,
                FontSize = 42,
                FontWeight = FontWeights.SemiBold,
                TextWrapping = TextWrapping.Wrap,
                LineHeight = 48
            };
            subtitle = new TextBlock
            {
                Foreground = new SolidColorBrush(Color.FromArgb(188, 255, 255, 255)),
                FontSize = 18,
                Margin = new Thickness(0, 12, 0, 34),
                TextWrapping = TextWrapping.Wrap,
                MaxWidth = 720,
                LineHeight = 26
            };
            progress = new ProgressBar
            {
                Minimum = 0,
                Maximum = 100,
                Height = 8,
                IsIndeterminate = true
            };
            progressText = new TextBlock
            {
                Foreground = new SolidColorBrush(Color.FromArgb(205, 255, 255, 255)),
                FontSize = 14,
                Margin = new Thickness(0, 12, 0, 0),
                HorizontalAlignment = HorizontalAlignment.Right
            };

            actions = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Left,
                Margin = new Thickness(0, 34, 0, 0),
                Visibility = Visibility.Collapsed
            };
            retryButton = BuildActionButton("Tentar novamente", true);
            cancelButton = BuildActionButton("Cancelar", false);
            actions.Children.Add(retryButton);
            actions.Children.Add(cancelButton);

            main.Children.Add(eyebrow);
            main.Children.Add(title);
            main.Children.Add(subtitle);
            main.Children.Add(progress);
            main.Children.Add(progressText);
            main.Children.Add(actions);
            shell.Children.Add(main);

            var side = new Border
            {
                Padding = new Thickness(24, 22, 24, 22),
                CornerRadius = new CornerRadius(8),
                Background = new SolidColorBrush(Color.FromArgb(86, 255, 255, 255)),
                BorderBrush = new SolidColorBrush(Color.FromArgb(42, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(side, 1);

            var sideStack = new StackPanel { Orientation = Orientation.Vertical };
            stepLabel = new TextBlock
            {
                Foreground = Brushes.White,
                FontSize = 18,
                FontWeight = FontWeights.SemiBold,
                TextWrapping = TextWrapping.Wrap
            };
            detailLabel = new TextBlock
            {
                Foreground = new SolidColorBrush(Color.FromArgb(178, 255, 255, 255)),
                FontSize = 14,
                Margin = new Thickness(0, 12, 0, 0),
                LineHeight = 21,
                TextWrapping = TextWrapping.Wrap
            };
            sideStack.Children.Add(stepLabel);
            sideStack.Children.Add(detailLabel);
            side.Child = sideStack;
            shell.Children.Add(side);

            Grid.SetRow(shell, 1);
            overlay.Children.Add(shell);
            return overlay;
        }

        private void SetActionsVisible(
            bool visible,
            bool canRetry = true,
            string retryText = "Tentar novamente",
            string cancelText = "Cancelar",
            ActionMode actionMode = ActionMode.Retry)
        {
            _actionMode = actionMode;
            _retryButton.Content = retryText;
            _cancelButton.Content = cancelText;
            _actions.Visibility = visible ? Visibility.Visible : Visibility.Collapsed;
            _retryButton.Visibility = canRetry ? Visibility.Visible : Visibility.Collapsed;
            _cancelButton.Visibility = Visibility.Visible;

            if (visible)
            {
                _focusedActionIndex = canRetry ? 0 : 1;
                FocusCurrentAction();
                StartControllerNavigation();
            }
            else
            {
                StopControllerNavigation();
            }
        }

        private static Button BuildActionButton(string text, bool primary)
        {
            return new Button
            {
                Content = text,
                MinWidth = primary ? 160 : 110,
                Height = 42,
                Margin = new Thickness(10, 0, 0, 0),
                Padding = new Thickness(18, 0, 18, 0),
                Background = primary
                    ? new SolidColorBrush(Color.FromRgb(245, 245, 247))
                    : new SolidColorBrush(Color.FromArgb(30, 255, 255, 255)),
                Foreground = primary ? Brushes.Black : Brushes.White,
                BorderBrush = new SolidColorBrush(Color.FromArgb(64, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                FontSize = 14,
                FontWeight = FontWeights.SemiBold,
                Focusable = true,
                OverridesDefaultStyle = true,
                Template = BuildActionButtonTemplate()
            };
        }

        private static ControlTemplate BuildActionButtonTemplate()
        {
            var template = new ControlTemplate(typeof(Button));
            var border = new FrameworkElementFactory(typeof(Border));
            border.Name = "ButtonChrome";
            border.SetValue(Border.CornerRadiusProperty, new CornerRadius(6));
            border.SetBinding(Border.BackgroundProperty, new Binding(nameof(Button.Background)) { RelativeSource = RelativeSource.TemplatedParent });
            border.SetBinding(Border.BorderBrushProperty, new Binding(nameof(Button.BorderBrush)) { RelativeSource = RelativeSource.TemplatedParent });
            border.SetBinding(Border.BorderThicknessProperty, new Binding(nameof(Button.BorderThickness)) { RelativeSource = RelativeSource.TemplatedParent });

            var content = new FrameworkElementFactory(typeof(ContentPresenter));
            content.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            content.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            content.SetValue(ContentPresenter.MarginProperty, new Thickness(10, 0, 10, 0));
            border.AppendChild(content);

            template.VisualTree = border;

            var focusTrigger = new Trigger { Property = Button.IsFocusedProperty, Value = true };
            focusTrigger.Setters.Add(new Setter(Border.BorderBrushProperty, new SolidColorBrush(Color.FromRgb(132, 202, 255)), "ButtonChrome"));
            focusTrigger.Setters.Add(new Setter(Border.BorderThicknessProperty, new Thickness(2), "ButtonChrome"));
            template.Triggers.Add(focusTrigger);

            var hoverTrigger = new Trigger { Property = Button.IsMouseOverProperty, Value = true };
            hoverTrigger.Setters.Add(new Setter(Border.BorderBrushProperty, new SolidColorBrush(Color.FromArgb(190, 255, 255, 255)), "ButtonChrome"));
            template.Triggers.Add(hoverTrigger);

            return template;
        }

        private void StartControllerNavigation()
        {
            if (_controllerNavActive && _controllerNavThread?.IsAlive == true)
                return;

            _controllerNavActive = true;
            _controllerNavThread = new Thread(ControllerNavigationLoop)
            {
                IsBackground = true,
                Name = "StoreDownloadActionsController"
            };
            _controllerNavThread.Start();
        }

        private void StopControllerNavigation()
        {
            _controllerNavActive = false;
        }

        private void OnPreviewKeyDown(object sender, KeyEventArgs e)
        {
            if (_actions.Visibility != Visibility.Visible)
                return;

            Key key = e.Key == Key.System ? e.SystemKey : e.Key;
            if (key == Key.Left || key == Key.Up)
            {
                SetFocusedAction(0);
                e.Handled = true;
            }
            else if (key == Key.Right || key == Key.Down)
            {
                SetFocusedAction(1);
                e.Handled = true;
            }
            else if (key == Key.Tab)
            {
                SetFocusedAction((Keyboard.Modifiers & ModifierKeys.Shift) != 0 ? 0 : 1);
                e.Handled = true;
            }
        }

        private void ControllerNavigationLoop()
        {
            const ushort dpadLeft = 0x0004;
            const ushort dpadRight = 0x0008;
            const ushort leftShoulder = 0x0100;
            const ushort rightShoulder = 0x0200;
            const ushort aButton = 0x1000;
            const ushort bButton = 0x2000;
            ushort previousButtons = 0;
            DateTime lastDirectionalAtUtc = DateTime.MinValue;
            DateTime lastActionAtUtc = DateTime.MinValue;

            while (_controllerNavActive)
            {
                ushort buttons = 0;
                try
                {
                    for (int i = 0; i < 4; i++)
                    {
                        if (XInputGetState(i, out var state) == 0)
                        {
                            buttons = state.Gamepad.wButtons;
                            break;
                        }
                    }
                }
                catch
                {
                    return;
                }

                ushort pressed = (ushort)(buttons & ~previousButtons);
                previousButtons = buttons;

                bool leftPressed = (pressed & (dpadLeft | leftShoulder)) != 0;
                bool rightPressed = (pressed & (dpadRight | rightShoulder)) != 0;
                if ((leftPressed || rightPressed) &&
                    (DateTime.UtcNow - lastDirectionalAtUtc).TotalMilliseconds >= 140)
                {
                    lastDirectionalAtUtc = DateTime.UtcNow;
                    Dispatcher.Invoke(() =>
                    {
                        if (!IsActive) return;
                        SetFocusedAction(leftPressed ? 0 : 1);
                    });
                }

                if ((pressed & aButton) != 0 &&
                    (DateTime.UtcNow - lastActionAtUtc).TotalMilliseconds >= 180)
                {
                    lastActionAtUtc = DateTime.UtcNow;
                    Dispatcher.Invoke(() =>
                    {
                        if (!IsActive) return;
                        if (ReferenceEquals(FocusManager.GetFocusedElement(this), _cancelButton) ||
                            Keyboard.FocusedElement == _cancelButton)
                        {
                            _cancelButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                        }
                        else if (_focusedActionIndex == 0 && _retryButton.Visibility == Visibility.Visible)
                        {
                            _retryButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                        }
                        else
                        {
                            _cancelButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                        }
                    });
                }
                else if ((pressed & bButton) != 0 &&
                    (DateTime.UtcNow - lastActionAtUtc).TotalMilliseconds >= 180)
                {
                    lastActionAtUtc = DateTime.UtcNow;
                    Dispatcher.Invoke(() =>
                    {
                        if (!IsActive) return;
                        if (_actionMode == ActionMode.CancelConfirmation)
                            _retryButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                        else
                            _cancelButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                    });
                }

                Thread.Sleep(35);
            }
        }

        private void FocusCurrentAction()
        {
            if (_focusedActionIndex == 0 && _retryButton.Visibility == Visibility.Visible)
                _retryButton.Focus();
            else
                _cancelButton.Focus();
        }

        private void SetFocusedAction(int index)
        {
            _focusedActionIndex = index == 0 && _retryButton.Visibility == Visibility.Visible ? 0 : 1;
            FocusCurrentAction();
        }

        private double CalculateSpeed(long receivedBytes)
        {
            DateTime now = DateTime.UtcNow;
            if (_lastProgressAtUtc == DateTime.MinValue)
            {
                _lastProgressAtUtc = now;
                _lastProgressBytes = receivedBytes;
                return 0;
            }

            double elapsed = (now - _lastProgressAtUtc).TotalSeconds;
            if (elapsed < 0.3)
                return _lastSpeedBytesPerSecond;

            long delta = receivedBytes - _lastProgressBytes;
            _lastProgressAtUtc = now;
            _lastProgressBytes = receivedBytes;
            _lastSpeedBytesPerSecond = delta > 0 ? delta / elapsed : _lastSpeedBytesPerSecond;
            return _lastSpeedBytesPerSecond;
        }

        private static string FormatSpeedAndEta(double speedBytesPerSecond, double? remainingBytes)
        {
            if (speedBytesPerSecond <= 1)
                return "";

            string speed = $" - {FormatBytes(speedBytesPerSecond)}/s";
            if (!remainingBytes.HasValue || remainingBytes.Value <= 0)
                return speed;

            double seconds = remainingBytes.Value / speedBytesPerSecond;
            if (double.IsNaN(seconds) || double.IsInfinity(seconds) || seconds <= 0)
                return speed;

            return $"{speed} - {FormatDuration(seconds)} restantes";
        }

        private static string FormatDuration(double seconds)
        {
            if (seconds < 60)
                return $"{Math.Max(1, seconds):0}s";

            double minutes = seconds / 60.0;
            if (minutes < 60)
                return $"{minutes:0}min";

            return $"{minutes / 60.0:0.0}h";
        }

        private static string GetAvailablePath(string path)
        {
            if (!File.Exists(path)) return path;
            string dir = Path.GetDirectoryName(path) ?? "";
            string name = Path.GetFileNameWithoutExtension(path);
            string ext = Path.GetExtension(path);
            return Path.Combine(dir, $"{name}-{DateTime.Now:yyyyMMdd-HHmmss}{ext}");
        }

        private static string SafeFileName(string value)
        {
            foreach (char c in Path.GetInvalidFileNameChars())
                value = value.Replace(c, '_');
            return string.IsNullOrWhiteSpace(value) ? "Store" : value.Trim();
        }

        private static bool LooksLikeInstallerUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return false;
            string lower = url.ToLowerInvariant();
            return lower.Contains(".exe") ||
                   lower.Contains(".msi") ||
                   lower.Contains("setup") ||
                   lower.Contains("installer") ||
                   lower.Contains("instalador");
        }

        private static string FormatBytes(double bytes)
        {
            if (bytes < 1024) return $"{bytes} B";
            double kb = bytes / 1024.0;
            if (kb < 1024) return $"{kb:0.0} KB";
            double mb = kb / 1024.0;
            if (mb < 1024) return $"{mb:0.0} MB";
            return $"{mb / 1024.0:0.0} GB";
        }
    }
}
