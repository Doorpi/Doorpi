using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using ShapePath = System.Windows.Shapes.Path;

namespace Doorpi
{
    public partial class MainWindow : Window
    {
        [DllImport("user32.dll")]
        private static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        private static extern bool SetCursorPos(int x, int y);

        [DllImport("user32.dll")]
        private static extern int ShowCursor(bool bShow);

        [DllImport("xinput1_4.dll", EntryPoint = "#100")]
        private static extern int XInputGetStateEx(int dwUserIndex, out XINPUT_STATE pState);


        // ── Constantes mouse ──────────────────────────────────────────────────
        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        private const uint MOUSEEVENTF_WHEEL = 0x0800;
        private const uint MOUSEEVENTF_MOVE = 0x0001;
        private const uint MOUSEEVENTF_XDOWN = 0x0080;
        private const uint MOUSEEVENTF_XUP = 0x0100;
        private const uint XBUTTON2 = 0x0002;
        private const uint XBUTTON1 = 0x0001; // Simula o botão "Voltar" (Mouse Button 4)

        // ── Constantes botões XInput ──────────────────────────────────────────
        private const ushort XI_DPAD_UP = 0x0001;
        private const ushort XI_DPAD_DOWN = 0x0002;
        private const ushort XI_DPAD_LEFT = 0x0004;
        private const ushort XI_DPAD_RIGHT = 0x0008;
        private const ushort XI_START = 0x0010;
        private const ushort XI_BACK = 0x0020;
        private const ushort XI_L3 = 0x0040;
        private const ushort XI_R3 = 0x0080;
        private const ushort XI_L1 = 0x0100;
        private const ushort XI_R1 = 0x0200;
        private const ushort XI_GUIDE = 0x0400;  // só via XInputGetStateEx
        private const ushort XI_A = 0x1000;
        private const ushort XI_B = 0x2000;
        private const ushort XI_X = 0x4000;
        private const ushort XI_Y = 0x8000;

        // ── Campos ────────────────────────────────────────────────────────────


        // Estado VKB — sincronizado entre thread do controller e mensagens web

        private const string YT_UA = "Mozilla/5.0 (PS4; Leanback Shell) Cobalt/26.lts.0-qa; compatible; Doorpi/1.6.1";
        private const string YT_TV_URL = "https://www.youtube.com/tv";
        private const string DoorpiBrowserAppId = "doorpi-browser";
        private const string DoorpiBrowserHomeUrl = "https://www.google.com";
        private static readonly HttpClient _ytHttp = new();
        // ── EasyList ──────────────────────────────────────────────────────────────
        private static readonly HashSet<string> _easyListDomains = new(StringComparer.OrdinalIgnoreCase);
        private static readonly string EasyListCachePath = Path.Combine(DoorpiPaths.DataFolder, "easylist.txt");
        private static readonly Dictionary<string, string> _loadedExtensionIdsByPath = new(StringComparer.OrdinalIgnoreCase);
        private Grid RootGrid => (Grid)this.Content;
        private Grid? _genericBrowserShell;
        private RowDefinition? _genericBrowserToolbarRow;
        private Border? _genericBrowserToolbar;
        private TextBox? _genericBrowserAddressBox;
        private Button? _genericBrowserBackButton;
        private Button? _genericBrowserForwardButton;
        private Border? _genericBrowserWidgetsPanel;
        private Popup? _genericBrowserWidgetsPopup;
        private WebView2? _genericBrowserExtensionPopupView;
        private CoreWebView2Environment? _genericBrowserEnvironment;
        private bool _genericBrowserExtensionOutsideCloseHooked;
        private DateTime _genericBrowserIgnoreOutsideClickUntilUtc = DateTime.MinValue;
        private bool _isGenericBrowserMode;
        private bool _genericBrowserCaptureWebAppUrl;
        private string _genericBrowserCaptureInitialClipboard = "";
        private System.Windows.Threading.DispatcherTimer? _genericBrowserCaptureClipboardTimer;
        private DateTime _genericBrowserControllerInputUntilUtc = DateTime.MinValue;
        private DateTime _genericBrowserVkbSuppressUntilUtc = DateTime.MinValue;
        private bool _genericBrowserVkbSuppressAUntilRelease;
        private long _lastWebAppDeactivatedUtcTicks;
        private Grid? _webAppLoadingOverlay;
        private bool _webAppLoadingActive;
        private bool _webAppLoadingReleaseStarted;
        private DateTime _webAppLoadingStartedAtUtc = DateTime.MinValue;
        private Grid? _webAppCloseHoldOverlay;
        private ShapePath? _webAppCloseHoldProgressArc;
        private Popup? _webAppCloseHoldPopup;
        private FrameworkElement? _webAppCloseHoldPlacementTarget;
        private Grid? _webAppTutorialOverlay;
        private Window? _webAppTutorialWindow;
        private FrameworkElement? _webAppTutorialPlacementTarget;
        private volatile bool _webAppTutorialOpen;
        private TextBlock? _genericBrowserAddressPlaceholder;
        private GenericBrowserKeyboardTarget _genericBrowserKeyboardTarget = GenericBrowserKeyboardTarget.None;
        private readonly GenericBrowserTabState _genericBrowserActiveTab = new()
        {
            Id = 1,
            WindowId = 1,
            Url = DoorpiBrowserHomeUrl,
            PendingUrl = DoorpiBrowserHomeUrl,
            Title = "",
            FavIconUrl = ""
        };

        private enum GenericBrowserKeyboardTarget
        {
            None,
            AddressBar,
            WebInput
        }

        private enum GenericBrowserExtensionSurface
        {
            None,
            Popup,
            Options
        }

        private sealed record GenericBrowserExtensionTarget(string Url, GenericBrowserExtensionSurface Surface);

        private sealed class GenericBrowserTabState
        {
            public int Id { get; init; }
            public int WindowId { get; init; }
            public string Url { get; set; } = "";
            public string PendingUrl { get; set; } = "";
            public string Title { get; set; } = "";
            public string FavIconUrl { get; set; } = "";
            public bool IsLoading { get; set; }
        }

        private static string UserDownloadsFolder
        {
            get
            {
                string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                string downloads = Path.Combine(userProfile, "Downloads");
                return string.IsNullOrWhiteSpace(userProfile)
                    ? Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory)
                    : downloads;
            }
        }

        private static string NormalizeGenericBrowserInput(string input)
        {
            string value = (input ?? "").Trim();
            if (string.IsNullOrWhiteSpace(value)) return DoorpiBrowserHomeUrl;

            if (Uri.TryCreate(value, UriKind.Absolute, out var absolute) &&
                (absolute.Scheme == Uri.UriSchemeHttp || absolute.Scheme == Uri.UriSchemeHttps))
            {
                return absolute.ToString();
            }

            bool looksLikeHost = value.Contains('.') && !value.Contains(' ');
            if (looksLikeHost &&
                Uri.TryCreate("https://" + value, UriKind.Absolute, out var hostUri))
            {
                return hostUri.ToString();
            }

            return "https://www.google.com/search?q=" + Uri.EscapeDataString(value);
        }

        private static string AvailableDownloadPath(string folder, string fileName)
        {
            Directory.CreateDirectory(folder);
            string safeName = Path.GetFileName(fileName);
            if (string.IsNullOrWhiteSpace(safeName)) safeName = "download";

            string candidate = Path.Combine(folder, safeName);
            if (!File.Exists(candidate)) return candidate;

            string stem = Path.GetFileNameWithoutExtension(safeName);
            string ext = Path.GetExtension(safeName);
            for (int i = 1; i < 1000; i++)
            {
                candidate = Path.Combine(folder, $"{stem} ({i}){ext}");
                if (!File.Exists(candidate)) return candidate;
            }

            return Path.Combine(folder, $"{stem}-{DateTime.Now:yyyyMMddHHmmss}{ext}");
        }

        private static string NormalizeExtensionPath(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return "";
            return Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        }

        private static void RememberLoadedExtensionId(string path, string id)
        {
            if (string.IsNullOrWhiteSpace(path) || string.IsNullOrWhiteSpace(id)) return;
            _loadedExtensionIdsByPath[NormalizeExtensionPath(path)] = id;
        }

        private static string GetLoadedExtensionId(BrowserExtensionModel ext, string manifestPath)
        {
            string installedPath = NormalizeExtensionPath(ext.InstalledPath);
            if (_loadedExtensionIdsByPath.TryGetValue(installedPath, out string? idFromRoot))
                return idFromRoot;

            string manifestFolder = NormalizeExtensionPath(Path.GetDirectoryName(manifestPath) ?? "");
            if (_loadedExtensionIdsByPath.TryGetValue(manifestFolder, out string? idFromManifest))
                return idFromManifest;

            return ext.Id;
        }

        private static ShapePath CreateBrowserIcon(string data, double size = 20)
        {
            return new ShapePath
            {
                Data = Geometry.Parse(data),
                Width = size,
                Height = size,
                Stretch = Stretch.Uniform,
                Stroke = Brushes.White,
                StrokeThickness = 1.8,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round,
                StrokeLineJoin = PenLineJoin.Round,
                Fill = Brushes.Transparent,
                Opacity = 0.92
            };
        }

        private static ShapePath CreateBrowserFilledIcon(string data, double size = 20)
        {
            return new ShapePath
            {
                Data = Geometry.Parse(data),
                Width = size,
                Height = size,
                Stretch = Stretch.Uniform,
                Fill = Brushes.White,
                Stroke = Brushes.Transparent,
                Opacity = 0.92
            };
        }

        private static ShapePath CreateExtensionPuzzleIcon(double size = 24, Brush? fill = null)
        {
            return new ShapePath
            {
                Data = Geometry.Parse("M345.14,480H274a18,18,0,0,1-18-18V434.29a31.32,31.32,0,0,0-9.71-22.77c-7.78-7.59-19.08-11.8-30.89-11.51-21.36.5-39.4,19.3-39.4,41.06V462a18,18,0,0,1-18,18H87.62A55.62,55.62,0,0,1,32,424.38V354a18,18,0,0,1,18-18H77.71c9.16,0,18.07-3.92,25.09-11A42.06,42.06,0,0,0,115,295.08C114.7,273.89,97.26,256,76.91,256H50a18,18,0,0,1-18-18V167.62A55.62,55.62,0,0,1,87.62,112h55.24a8,8,0,0,0,8-8V97.52A65.53,65.53,0,0,1,217.54,32c35.49.62,64.36,30.38,64.36,66.33V104a8,8,0,0,0,8,8h55.24A54.86,54.86,0,0,1,400,166.86V222.1a8,8,0,0,0,8,8h5.66c36.58,0,66.34,29,66.34,64.64,0,36.61-29.39,66.4-65.52,66.4H408a8,8,0,0,0-8,8v56A54.86,54.86,0,0,1,345.14,480Z"),
                Width = size,
                Height = size,
                Stretch = Stretch.Uniform,
                Fill = fill ?? Brushes.White,
                Stroke = Brushes.Transparent,
                Opacity = 0.92
            };
        }

        private static Style CreateBrowserToolbarButtonStyle()
        {
            var template = new ControlTemplate(typeof(Button));

            var chrome = new FrameworkElementFactory(typeof(Border));
            chrome.SetValue(Border.CornerRadiusProperty, new CornerRadius(10));
            chrome.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Control.BackgroundProperty));
            chrome.SetValue(Border.BorderBrushProperty, new TemplateBindingExtension(Control.BorderBrushProperty));
            chrome.SetValue(Border.BorderThicknessProperty, new TemplateBindingExtension(Control.BorderThicknessProperty));

            var presenter = new FrameworkElementFactory(typeof(ContentPresenter));
            presenter.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            presenter.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            presenter.SetValue(ContentPresenter.RecognizesAccessKeyProperty, true);
            chrome.AppendChild(presenter);

            template.VisualTree = chrome;

            var style = new Style(typeof(Button));
            style.Setters.Add(new Setter(Control.TemplateProperty, template));
            style.Setters.Add(new Setter(Control.BackgroundProperty, new SolidColorBrush(Color.FromArgb(18, 255, 255, 255))));
            style.Setters.Add(new Setter(Control.BorderBrushProperty, new SolidColorBrush(Color.FromArgb(34, 255, 255, 255))));
            style.Setters.Add(new Setter(Control.BorderThicknessProperty, new Thickness(1)));
            style.Setters.Add(new Setter(Control.ForegroundProperty, Brushes.White));
            style.Setters.Add(new Setter(Control.FontSizeProperty, 15.0));
            style.Setters.Add(new Setter(Control.FontWeightProperty, FontWeights.SemiBold));
            style.Setters.Add(new Setter(FrameworkElement.CursorProperty, Cursors.Hand));
            style.Setters.Add(new Setter(FrameworkElement.FocusVisualStyleProperty, null));

            var hover = new Trigger { Property = UIElement.IsMouseOverProperty, Value = true };
            hover.Setters.Add(new Setter(Control.BackgroundProperty, new SolidColorBrush(Color.FromArgb(32, 255, 255, 255))));
            hover.Setters.Add(new Setter(Control.BorderBrushProperty, new SolidColorBrush(Color.FromArgb(58, 255, 255, 255))));
            style.Triggers.Add(hover);

            var pressed = new Trigger { Property = ButtonBase.IsPressedProperty, Value = true };
            pressed.Setters.Add(new Setter(Control.BackgroundProperty, new SolidColorBrush(Color.FromArgb(48, 255, 255, 255))));
            style.Triggers.Add(pressed);

            var disabled = new Trigger { Property = UIElement.IsEnabledProperty, Value = false };
            disabled.Setters.Add(new Setter(UIElement.OpacityProperty, 0.38));
            disabled.Setters.Add(new Setter(Control.BackgroundProperty, new SolidColorBrush(Color.FromArgb(10, 255, 255, 255))));
            style.Triggers.Add(disabled);

            return style;
        }

        private void OpenGenericBrowserKeyboard(GenericBrowserKeyboardTarget target, int? targetScreenY = null)
        {
            if (target == GenericBrowserKeyboardTarget.AddressBar && _genericBrowserAddressBox == null) return;
            if (target == GenericBrowserKeyboardTarget.WebInput &&
                DateTime.UtcNow < _genericBrowserVkbSuppressUntilUtc)
            {
                return;
            }

            Dispatcher.Invoke(() =>
            {
                _genericBrowserKeyboardTarget = target;
                _vkbIsOpen = true;
                _vkbOwnerView = _ytWebView;
                _vkbHasFocus = true;
                _genericBrowserVkbSuppressAUntilRelease = true;

                if (_desktopVkb == null)
                {
                    _desktopVkb = new DesktopVkbWindow();
                    _desktopVkb.SetLocalization(_vkbStrBackspace, _vkbStrEnter, _vkbStrClose,
                                                _vkbStrShift, _vkbStrSpace, _vkbStrSym, _vkbStrAbc);
                    _desktopVkb.OnKeyPressed += HandleGenericBrowserKeyboardKey;
                    _desktopVkb.OnCloseRequested += () =>
                    {
                        bool notifyWeb = _genericBrowserKeyboardTarget == GenericBrowserKeyboardTarget.WebInput;
                        CloseGenericBrowserKeyboard(notifyWeb);
                    };
                }

                if (targetScreenY.HasValue) _desktopVkb.AutoPosition(targetScreenY.Value);
                else if (GetCursorPos(out var pt)) _desktopVkb.AutoPosition(pt.Y);
                else _desktopVkb.SetFixedPosition();

                if (!_desktopVkb.IsVisible)
                    _desktopVkb.Show();

                if (target == GenericBrowserKeyboardTarget.AddressBar && _genericBrowserAddressBox != null)
                {
                    _genericBrowserAddressBox.Focus();
                    Keyboard.Focus(_genericBrowserAddressBox);
                }
                else
                {
                    _ytWebView?.Focus();
                    _ = _ytWebView?.CoreWebView2?.ExecuteScriptAsync("try{window.focus();}catch(e){}");
                }
            });
        }

        private void CloseGenericBrowserKeyboard(bool notifyWeb)
        {
            Dispatcher.Invoke(() =>
            {
                if (notifyWeb)
                    _ = _ytWebView?.CoreWebView2?.ExecuteScriptAsync("try{window.__doorpiNativeVkbClose?.();}catch(e){}");

                _genericBrowserVkbSuppressUntilUtc = DateTime.UtcNow.AddMilliseconds(650);
                try { _desktopVkb?.Close(); } catch { }
                _desktopVkb = null;
                _genericBrowserKeyboardTarget = GenericBrowserKeyboardTarget.None;
                _vkbIsOpen = false;
                _vkbOwnerView = null;
                _vkbHasFocus = false;
                _genericBrowserVkbSuppressAUntilRelease = false;
            });
        }

        private void OpenGenericBrowserAddressKeyboard() =>
            OpenGenericBrowserKeyboard(GenericBrowserKeyboardTarget.AddressBar);

        private void OpenGenericBrowserWebKeyboard(int targetScreenY) =>
            OpenGenericBrowserKeyboard(GenericBrowserKeyboardTarget.WebInput, targetScreenY);

        private void MarkGenericBrowserControllerInputIntent()
        {
            _genericBrowserControllerInputUntilUtc = DateTime.UtcNow.AddMilliseconds(520);
            var view = _ytWebView;
            if (view == null) return;

            Dispatcher.InvokeAsync(() =>
            {
                try
                {
                    view.CoreWebView2?.ExecuteScriptAsync(
                        "try{window.__doorpiVkbControllerIntentAt=Date.now();}catch(e){}");
                }
                catch { }
            });
        }

        private bool HasRecentGenericBrowserControllerInputIntent() =>
            DateTime.UtcNow <= _genericBrowserControllerInputUntilUtc;

        private int GenericBrowserWebYToScreen(double webY)
        {
            if (_ytWebView == null)
            {
                return GetCursorPos(out var pt) ? pt.Y : (int)(SystemParameters.PrimaryScreenHeight * 0.55);
            }

            try
            {
                var screenPoint = _ytWebView.PointToScreen(new Point(0, Math.Max(0, webY)));
                return (int)Math.Round(screenPoint.Y);
            }
            catch
            {
                return GetCursorPos(out var pt) ? pt.Y : (int)(SystemParameters.PrimaryScreenHeight * 0.55);
            }
        }

        private void HandleGenericBrowserKeyboardKey(string key)
        {
            if (_genericBrowserKeyboardTarget == GenericBrowserKeyboardTarget.WebInput)
            {
                HandleGenericBrowserWebKeyboardKey(key);
                return;
            }

            HandleGenericBrowserAddressKeyboardKey(key);
        }

        private void HandleGenericBrowserWebKeyboardKey(string key)
        {
            Dispatcher.Invoke(() =>
            {
                if (key == "CANCEL")
                {
                    CloseGenericBrowserKeyboard(true);
                    _ytWebView?.Focus();
                    return;
                }

                string json = System.Text.Json.JsonSerializer.Serialize(key);
                _ = _ytWebView?.CoreWebView2?.ExecuteScriptAsync($"try{{window.__doorpiNativeVkbKey?.({json});}}catch(e){{}}");
                _ytWebView?.Focus();
            });
        }

        private void HandleGenericBrowserAddressKeyboardKey(string key)
        {
            Dispatcher.Invoke(() =>
            {
                if (_genericBrowserAddressBox == null) return;

                if (key == "CANCEL")
                {
                    CloseGenericBrowserKeyboard(false);
                    _ytWebView?.Focus();
                    return;
                }

                if (key == "ENTER")
                {
                    string target = NormalizeGenericBrowserInput(_genericBrowserAddressBox.Text);
                    _ytWebView?.CoreWebView2?.Navigate(target);
                    CloseGenericBrowserKeyboard(false);
                    _ytWebView?.Focus();
                    return;
                }

                if (key == "CURSOR_LEFT")
                {
                    if (_genericBrowserAddressBox.SelectionLength > 0)
                    {
                        _genericBrowserAddressBox.SelectionLength = 0;
                    }
                    else if (_genericBrowserAddressBox.CaretIndex > 0)
                    {
                        _genericBrowserAddressBox.CaretIndex--;
                    }
                    return;
                }

                if (key == "CURSOR_RIGHT")
                {
                    if (_genericBrowserAddressBox.SelectionLength > 0)
                    {
                        _genericBrowserAddressBox.CaretIndex += _genericBrowserAddressBox.SelectionLength;
                        _genericBrowserAddressBox.SelectionLength = 0;
                    }
                    else if (_genericBrowserAddressBox.CaretIndex < _genericBrowserAddressBox.Text.Length)
                    {
                        _genericBrowserAddressBox.CaretIndex++;
                    }
                    return;
                }

                if (key == "BKSP")
                {
                    int start = _genericBrowserAddressBox.SelectionStart;
                    if (_genericBrowserAddressBox.SelectionLength > 0)
                    {
                        _genericBrowserAddressBox.Text = _genericBrowserAddressBox.Text.Remove(start, _genericBrowserAddressBox.SelectionLength);
                        _genericBrowserAddressBox.CaretIndex = start;
                    }
                    else if (start > 0)
                    {
                        _genericBrowserAddressBox.Text = _genericBrowserAddressBox.Text.Remove(start - 1, 1);
                        _genericBrowserAddressBox.CaretIndex = start - 1;
                    }
                    return;
                }

                string text = key == "SPACE" ? " " : key;
                int caret = _genericBrowserAddressBox.SelectionStart;
                if (_genericBrowserAddressBox.SelectionLength > 0)
                {
                    _genericBrowserAddressBox.Text = _genericBrowserAddressBox.Text.Remove(caret, _genericBrowserAddressBox.SelectionLength);
                }

                _genericBrowserAddressBox.Text = _genericBrowserAddressBox.Text.Insert(caret, text);
                _genericBrowserAddressBox.CaretIndex = caret + text.Length;
            });
        }
        private void OnApplicationDeactivated(object? sender, EventArgs e)
        {
          
            Dispatcher.Invoke(() => CloseGenericBrowserExtensionsPopup());
        }
        private Grid BuildGenericBrowserShell(WebView2 browser)
        {
            browser.PreviewMouseDown += (_, _) =>
            {
                if (_genericBrowserKeyboardTarget == GenericBrowserKeyboardTarget.AddressBar)
                    CloseGenericBrowserKeyboard(false);
            };

            var shell = new Grid
            {
                Background = new SolidColorBrush(Color.FromRgb(4, 7, 14))
            };
            shell.PreviewMouseDown += (_, _) =>
            {
                if (_genericBrowserKeyboardTarget == GenericBrowserKeyboardTarget.AddressBar &&
                    _genericBrowserAddressBox?.IsMouseOver != true)
                {
                    CloseGenericBrowserKeyboard(false);
                }
            };
            _genericBrowserToolbarRow = new RowDefinition { Height = new GridLength(64) };
            shell.RowDefinitions.Add(_genericBrowserToolbarRow);
            shell.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

            var toolbar = new Border
            {
                Background = new SolidColorBrush(Color.FromRgb(10, 14, 24)),
                BorderBrush = new SolidColorBrush(Color.FromArgb(34, 255, 255, 255)),
                BorderThickness = new Thickness(0, 0, 0, 1),
                Padding = new Thickness(14, 10, 14, 10)
            };
            _genericBrowserToolbar = toolbar;

            var row = new Grid();
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            Button MakeButton(object content, string tooltip, double minWidth = 44)
            {
                return new Button
                {
                    Content = content,
                    ToolTip = tooltip,
                    MinWidth = minWidth,
                    Height = 42,
                    Margin = new Thickness(0, 0, 8, 0),
                    Padding = new Thickness(10, 0, 10, 0),
                    Style = CreateBrowserToolbarButtonStyle()
                };
            }

            _genericBrowserBackButton = MakeButton(CreateBrowserIcon("M15 6 L9 12 L15 18"), "Voltar");
            _genericBrowserBackButton.Click += (_, _) =>
            {
                if (browser.CoreWebView2?.CanGoBack == true) browser.CoreWebView2.GoBack();
            };
            Grid.SetColumn(_genericBrowserBackButton, 0);
            row.Children.Add(_genericBrowserBackButton);

            _genericBrowserForwardButton = MakeButton(CreateBrowserIcon("M9 6 L15 12 L9 18"), "Avancar");
            _genericBrowserForwardButton.Click += (_, _) =>
            {
                if (browser.CoreWebView2?.CanGoForward == true) browser.CoreWebView2.GoForward();
            };
            Grid.SetColumn(_genericBrowserForwardButton, 1);
            row.Children.Add(_genericBrowserForwardButton);

            var reloadButton = MakeButton(CreateBrowserIcon("M20 11 A8 8 0 1 1 17.7 5.4 M20 5 V11 H14"), "Recarregar");
            reloadButton.Click += (_, _) => browser.CoreWebView2?.Reload();
            Grid.SetColumn(reloadButton, 2);
            row.Children.Add(reloadButton);

            var homeButton = MakeButton(CreateBrowserIcon("M4 11 L12 4 L20 11 M6 10 V20 H18 V10 M10 20 V14 H14 V20"), "Google");
            homeButton.Click += (_, _) => browser.CoreWebView2?.Navigate(DoorpiBrowserHomeUrl);
            Grid.SetColumn(homeButton, 3);
            row.Children.Add(homeButton);

            _genericBrowserAddressBox = new TextBox
            {
                Height = 44,
                Margin = new Thickness(6, 0, 12, 0),
                Padding = new Thickness(16, 10, 16, 8),
                Background = new SolidColorBrush(Color.FromRgb(18, 23, 35)),
                BorderBrush = new SolidColorBrush(Color.FromArgb(46, 255, 255, 255)),
                Foreground = Brushes.White,
                FontSize = 16,
                Text = DoorpiBrowserHomeUrl
            };
            _genericBrowserAddressPlaceholder = new TextBlock
            {
                Text = "pesquisar no google",
                Margin = new Thickness(22, 0, 12, 0),
                VerticalAlignment = VerticalAlignment.Center,
                Foreground = new SolidColorBrush(Color.FromArgb(118, 255, 255, 255)),
                FontSize = 16,
                IsHitTestVisible = false,
                Visibility = Visibility.Collapsed
            };
            void UpdateAddressPlaceholder()
            {
                if (_genericBrowserAddressPlaceholder != null)
                {
                    _genericBrowserAddressPlaceholder.Visibility =
                        string.IsNullOrWhiteSpace(_genericBrowserAddressBox.Text)
                            ? Visibility.Visible
                            : Visibility.Collapsed;
                }
            }
            _genericBrowserAddressBox.PreviewMouseDown += (_, e) =>
            {
                if (!_genericBrowserAddressBox.IsKeyboardFocusWithin)
                {
                    e.Handled = true;
                    _genericBrowserAddressBox.Focus();
                    _genericBrowserAddressBox.SelectAll();
                }

                if (HasRecentGenericBrowserControllerInputIntent())
                    OpenGenericBrowserAddressKeyboard();
            };
            _genericBrowserAddressBox.GotKeyboardFocus += (_, _) =>
            {
                _genericBrowserAddressBox.SelectAll();
                if (HasRecentGenericBrowserControllerInputIntent())
                    OpenGenericBrowserAddressKeyboard();
            };
            _genericBrowserAddressBox.LostKeyboardFocus += (_, _) =>
            {
                if (_genericBrowserKeyboardTarget == GenericBrowserKeyboardTarget.AddressBar)
                    CloseGenericBrowserKeyboard(false);
            };
            _genericBrowserAddressBox.TextChanged += (_, _) => UpdateAddressPlaceholder();
            _genericBrowserAddressBox.KeyDown += (_, e) =>
            {
                if (e.Key != Key.Enter) return;
                e.Handled = true;
                string target = NormalizeGenericBrowserInput(_genericBrowserAddressBox.Text);
                NavigateGenericBrowserActiveTab(target, closeExtensionPopup: false);
            };
            var addressHost = new Grid();
            addressHost.Children.Add(_genericBrowserAddressBox);
            addressHost.Children.Add(_genericBrowserAddressPlaceholder);
            UpdateAddressPlaceholder();
            Grid.SetColumn(addressHost, 4);
            row.Children.Add(addressHost);

            var widgetsButton = MakeButton(
                CreateExtensionPuzzleIcon(25),
                "Ver extensoes instaladas",
                46);
            widgetsButton.Click += (_, _) => ToggleGenericBrowserWidgetsPanel();
            Grid.SetColumn(widgetsButton, 5);
            row.Children.Add(widgetsButton);

            var copyButton = MakeButton(CreateBrowserIcon("M9 9 H20 V20 H9 Z M4 4 H15 V15 H4 Z"), "Copiar link", 42);
            copyButton.Margin = new Thickness(0);
            copyButton.Click += (_, _) =>
            {
                try
                {
                    string source = browser.CoreWebView2?.Source ?? "";
                    if (!string.IsNullOrWhiteSpace(source))
                    {
                        Clipboard.SetText(source);
                        if (TryCompleteGenericBrowserWebAppUrlCapture(source))
                            return;
                        ShowGenericBrowserCopyFeedback(source);
                    }
                }
                catch { }
            };
            Grid.SetColumn(copyButton, 6);
            row.Children.Add(copyButton);

            toolbar.Child = row;
            Grid.SetRow(toolbar, 0);
            shell.Children.Add(toolbar);

            Grid.SetRow(browser, 1);
            shell.Children.Add(browser);

            _genericBrowserWidgetsPanel = new Border
            {
                Width = 430,
                MaxHeight = 620,
                // Margem removida (substituída por Thickness(0))
                Margin = new Thickness(0),
                Background = new SolidColorBrush(Color.FromArgb(246, 12, 16, 28)),
                BorderBrush = new SolidColorBrush(Color.FromArgb(46, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                // Cantos zerados para não vazar a caixa preta do Win32
                CornerRadius = new CornerRadius(0),
                Padding = new Thickness(16),
                Visibility = Visibility.Collapsed
            };
            _genericBrowserWidgetsPopup = new Popup
            {
                PlacementTarget = widgetsButton,
                Placement = PlacementMode.Bottom,
                // -318 (antigo) - 16 (margem direita removida) = -334
                HorizontalOffset = -334,
                // 10 (antigo) + 12 (margem superior removida) = 22
                VerticalOffset = 22,
                StaysOpen = true,
                AllowsTransparency = false,
                Child = _genericBrowserWidgetsPanel
            };

            _genericBrowserShell = shell;
            // COLOQUE ESTAS:
            Application.Current.Deactivated -= OnApplicationDeactivated;
            Application.Current.Deactivated += OnApplicationDeactivated;

            _genericBrowserShell = shell;
            return shell;

        }

        private void ToggleGenericBrowserWidgetsPanel()
        {
            if (_genericBrowserWidgetsPanel == null || _genericBrowserWidgetsPopup == null) return;

            if (_genericBrowserWidgetsPopup.IsOpen)
            {
                CloseGenericBrowserExtensionsPopup();
                return;
            }

            RenderGenericBrowserExtensionList();
            _ = RefreshGenericBrowserExtensionUpdatesForPopupAsync();
            SuppressGenericBrowserOutsideCloseBriefly();
            _genericBrowserWidgetsPanel.Visibility = Visibility.Visible;
            _genericBrowserWidgetsPopup.IsOpen = true;
            HookGenericBrowserExtensionsOutsideClose();
        }

        private void SetGenericBrowserWidgetsPanelWidth(double width)
        {
            if (_genericBrowserWidgetsPanel == null) return;

            _genericBrowserWidgetsPanel.Width = width;

            if (_genericBrowserWidgetsPopup?.PlacementTarget is FrameworkElement target)
            {
                double targetWidth = target.ActualWidth > 0 ? target.ActualWidth : 46;
                // O "- 16" aqui compensa a margem que tiramos, mantendo alinhado com o ícone
                _genericBrowserWidgetsPopup.HorizontalOffset = targetWidth - width - 16;
            }
        }

        private void CloseGenericBrowserExtensionsPopup()
        {
            if (_genericBrowserWidgetsPopup != null)
                _genericBrowserWidgetsPopup.IsOpen = false;
            if (_genericBrowserWidgetsPanel != null)
                _genericBrowserWidgetsPanel.Visibility = Visibility.Collapsed;
            try
            {
                if (_genericBrowserExtensionPopupView?.CoreWebView2 != null)
                {
                    _genericBrowserExtensionPopupView.CoreWebView2.NavigationCompleted -= OnGenericBrowserExtensionPopupNavigationCompleted;
                    _genericBrowserExtensionPopupView.CoreWebView2.NewWindowRequested -= OnGenericBrowserExtensionPopupNewWindowRequested;
                    _genericBrowserExtensionPopupView.CoreWebView2.WebMessageReceived -= OnGenericBrowserExtensionPopupMessageReceived;
                }
                _genericBrowserExtensionPopupView?.Dispose();
            }
            catch { }
            _genericBrowserExtensionPopupView = null;
            UnhookGenericBrowserExtensionsOutsideClose();
        }

        private bool HandleGenericBrowserExtensionsBack()
        {
            if (_genericBrowserWidgetsPopup?.IsOpen != true) return false;
            if (_genericBrowserExtensionPopupView != null)
            {
                RenderGenericBrowserExtensionList();
                return true;
            }

            CloseGenericBrowserExtensionsPopup();
            return true;
        }

        private void HookGenericBrowserExtensionsOutsideClose()
        {
            if (_genericBrowserExtensionOutsideCloseHooked) return;
            PreviewMouseDown += OnGenericBrowserExtensionsOutsideMouseDown;
            _genericBrowserExtensionOutsideCloseHooked = true;
        }

        private void UnhookGenericBrowserExtensionsOutsideClose()
        {
            if (!_genericBrowserExtensionOutsideCloseHooked) return;
            PreviewMouseDown -= OnGenericBrowserExtensionsOutsideMouseDown;
            _genericBrowserExtensionOutsideCloseHooked = false;
        }

        private void SuppressGenericBrowserOutsideCloseBriefly(int milliseconds = 260)
        {
            _genericBrowserIgnoreOutsideClickUntilUtc = DateTime.UtcNow.AddMilliseconds(milliseconds);
        }

        private bool IsPointerInsideGenericBrowserWidgetsPanel()
        {
            if (_genericBrowserWidgetsPopup?.IsOpen != true || _genericBrowserWidgetsPanel == null)
                return false;

            try
            {
                var topLeft = _genericBrowserWidgetsPanel.PointToScreen(new Point(0, 0));
                double width = _genericBrowserWidgetsPanel.ActualWidth;
                double height = _genericBrowserWidgetsPanel.ActualHeight;
                if (width <= 0 || height <= 0) return false;
                if (!GetCursorPos(out var cursor)) return false;

                return cursor.X >= topLeft.X &&
                       cursor.X <= topLeft.X + width &&
                       cursor.Y >= topLeft.Y &&
                       cursor.Y <= topLeft.Y + height;
            }
            catch
            {
                return false;
            }
        }

        private void OnGenericBrowserExtensionsOutsideMouseDown(object sender, MouseButtonEventArgs e)
        {
            if (DateTime.UtcNow < _genericBrowserIgnoreOutsideClickUntilUtc)
                return;

            if (IsPointerInsideGenericBrowserWidgetsPanel())
                return;

            if (_genericBrowserWidgetsPopup?.PlacementTarget is DependencyObject target &&
                e.OriginalSource is DependencyObject source &&
                IsVisualDescendantOf(source, target))
            {
                return;
            }

            if (_genericBrowserWidgetsPopup?.IsOpen == true)
                CloseGenericBrowserExtensionsPopup();
        }

        private void OnGenericBrowserMainWebViewGotFocus(object sender, RoutedEventArgs e)
        {
            if (_genericBrowserWidgetsPopup?.IsOpen == true)
                CloseGenericBrowserExtensionsPopup();
        }

        private static bool IsVisualDescendantOf(DependencyObject child, DependencyObject parent)
        {
            DependencyObject? current = child;
            while (current != null)
            {
                if (ReferenceEquals(current, parent)) return true;
                try
                {
                    current = VisualTreeHelper.GetParent(current) ?? LogicalTreeHelper.GetParent(current);
                }
                catch
                {
                    current = LogicalTreeHelper.GetParent(current);
                }
            }
            return false;
        }

        private async Task RefreshGenericBrowserExtensionUpdatesForPopupAsync()
        {
            try
            {
                await CheckAndSendExtensionUpdatesAsync();
                await Dispatcher.InvokeAsync(() =>
                {
                    if (_genericBrowserWidgetsPopup?.IsOpen == true &&
                        _genericBrowserWidgetsPanel != null &&
                        _genericBrowserExtensionPopupView == null)
                    {
                        RenderGenericBrowserExtensionList();
                    }
                });
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DoorpiBrowser] Falha ao atualizar estado de extensões: " + ex.Message);
            }
        }

        private void RenderGenericBrowserExtensionList()
        {
            if (_genericBrowserWidgetsPanel == null) return;
            try
            {
                if (_genericBrowserExtensionPopupView?.CoreWebView2 != null)
                {
                    _genericBrowserExtensionPopupView.CoreWebView2.NavigationCompleted -= OnGenericBrowserExtensionPopupNavigationCompleted;
                    _genericBrowserExtensionPopupView.CoreWebView2.NewWindowRequested -= OnGenericBrowserExtensionPopupNewWindowRequested;
                    _genericBrowserExtensionPopupView.CoreWebView2.WebMessageReceived -= OnGenericBrowserExtensionPopupMessageReceived;
                }
                _genericBrowserExtensionPopupView?.Dispose();
            }
            catch { }
            _genericBrowserExtensionPopupView = null;

            _genericBrowserWidgetsPanel.Height = double.NaN;
            _genericBrowserWidgetsPanel.MaxHeight = 620;
            SetGenericBrowserWidgetsPanelWidth(430);
            _genericBrowserWidgetsPanel.Background = new SolidColorBrush(Color.FromArgb(246, 12, 16, 28));
            _genericBrowserWidgetsPanel.BorderBrush = new SolidColorBrush(Color.FromArgb(46, 255, 255, 255));
            _genericBrowserWidgetsPanel.Padding = new Thickness(16);

            var root = new Grid();
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            root.Children.Add(BuildGenericBrowserExtensionHeader("Extensões", "Plugins carregados neste navegador."));

            var stack = new StackPanel { Orientation = Orientation.Vertical };

            var extensions = LoadBrowserExtensions();
            if (extensions.Count == 0)
            {
                stack.Children.Add(new TextBlock
                {
                    Text = "Nenhuma extensão instalada ainda.",
                    Foreground = new SolidColorBrush(Color.FromArgb(166, 255, 255, 255)),
                    FontSize = 14,
                    TextWrapping = TextWrapping.Wrap
                });
            }
            else
            {
                foreach (var ext in extensions.OrderBy(e => e.Name, StringComparer.OrdinalIgnoreCase))
                    stack.Children.Add(BuildGenericBrowserExtensionItem(ext));
            }

            var scroll = new ScrollViewer
            {
                Content = stack,
                MaxHeight = 430,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto
            };
            Grid.SetRow(scroll, 1);
            root.Children.Add(scroll);

            _genericBrowserWidgetsPanel.Child = root;
        }

        private FrameworkElement BuildGenericBrowserExtensionHeader(string title, string subtitle)
        {
            var header = new StackPanel
            {
                Orientation = Orientation.Vertical,
                Margin = new Thickness(0, 0, 0, 14)
            };
            header.Children.Add(new TextBlock
            {
                Text = title,
                Foreground = Brushes.White,
                FontSize = 20,
                FontWeight = FontWeights.SemiBold,
                TextTrimming = TextTrimming.CharacterEllipsis
            });
            header.Children.Add(new TextBlock
            {
                Text = subtitle,
                Foreground = new SolidColorBrush(Color.FromArgb(132, 255, 255, 255)),
                FontSize = 12.5,
                Margin = new Thickness(0, 2, 0, 0),
                TextTrimming = TextTrimming.CharacterEllipsis
            });
            return header;
        }

        private FrameworkElement BuildGenericBrowserExtensionItem(BrowserExtensionModel ext)
        {
            string name = string.IsNullOrWhiteSpace(ext.Name) ? ext.Id : ext.Name;
            string version = GetExtensionVersion(ext);
            var target = ResolveExtensionFrontendTarget(ext);
            bool hasPanel = !string.IsNullOrWhiteSpace(target.Url);
            bool hasUpdate = _latestUpdatesCache.TryGetValue(ext.Id, out string? updateVersion) &&
                             !string.IsNullOrWhiteSpace(updateVersion);

            var item = new Border
            {
                Margin = new Thickness(0, 0, 0, 9),
                Padding = new Thickness(12),
                CornerRadius = new CornerRadius(8),
                Background = new SolidColorBrush(Color.FromArgb(22, 255, 255, 255)),
                BorderBrush = hasUpdate
                    ? new SolidColorBrush(Color.FromArgb(70, 255, 190, 90))
                    : new SolidColorBrush(Color.FromArgb(26, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                Cursor = hasPanel ? Cursors.Hand : Cursors.Arrow,
                ToolTip = hasPanel
                    ? (target.Surface == GenericBrowserExtensionSurface.Popup ? "Abrir popup da extensão" : "Abrir opções da extensão")
                    : "Esta extensão não informou painel ou opções."
            };

            var row = new Grid();
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var icon = BuildGenericBrowserExtensionIcon(ext, 42);
            icon.Margin = new Thickness(0, 0, 12, 0);
            Grid.SetColumn(icon, 0);
            row.Children.Add(icon);

            var text = new StackPanel { Orientation = Orientation.Vertical, VerticalAlignment = VerticalAlignment.Center };
            text.Children.Add(new TextBlock
            {
                Text = name,
                Foreground = Brushes.White,
                FontSize = 14.5,
                FontWeight = FontWeights.SemiBold,
                TextTrimming = TextTrimming.CharacterEllipsis
            });

            string meta = string.IsNullOrWhiteSpace(version) ? "Versão desconhecida" : $"v{version}";
            if (!hasPanel) meta += " - sem painel";
            text.Children.Add(new TextBlock
            {
                Text = meta,
                Foreground = new SolidColorBrush(Color.FromArgb(145, 255, 255, 255)),
                FontSize = 12,
                Margin = new Thickness(0, 2, 0, 0),
                TextTrimming = TextTrimming.CharacterEllipsis
            });
            if (hasUpdate)
            {
                text.Children.Add(new TextBlock
                {
                    Text = $"Atualização disponível: v{updateVersion}",
                    Foreground = new SolidColorBrush(Color.FromRgb(255, 198, 92)),
                    FontSize = 12,
                    FontWeight = FontWeights.SemiBold,
                    Margin = new Thickness(0, 4, 0, 0),
                    TextTrimming = TextTrimming.CharacterEllipsis
                });
            }
            Grid.SetColumn(text, 1);
            row.Children.Add(text);

            var chevron = new TextBlock
            {
                Text = hasPanel ? "›" : "",
                Foreground = new SolidColorBrush(Color.FromArgb(150, 255, 255, 255)),
                FontSize = 24,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(10, 0, 0, 0)
            };
            Grid.SetColumn(chevron, 2);
            row.Children.Add(chevron);

            item.Child = row;
            if (hasPanel)
                item.MouseLeftButtonUp += (_, _) => OpenGenericBrowserExtensionTarget(ext, target);

            return item;
        }

        private FrameworkElement BuildGenericBrowserExtensionIcon(BrowserExtensionModel ext, double size)
        {
            string iconPath = ResolveExtensionIconPath(ext);
            if (!string.IsNullOrWhiteSpace(iconPath) && File.Exists(iconPath))
            {
                try
                {
                    return new Border
                    {
                        Width = size,
                        Height = size,
                        CornerRadius = new CornerRadius(10),
                        Background = new SolidColorBrush(Color.FromArgb(24, 255, 255, 255)),
                        Child = new Image
                        {
                            Source = new System.Windows.Media.Imaging.BitmapImage(new Uri(iconPath, UriKind.Absolute)),
                            Stretch = Stretch.Uniform,
                            Margin = new Thickness(5)
                        }
                    };
                }
                catch { }
            }

            return new Border
            {
                Width = size,
                Height = size,
                CornerRadius = new CornerRadius(10),
                Background = new SolidColorBrush(Color.FromArgb(36, 255, 255, 255)),
                Child = CreateExtensionPuzzleIcon(size * 0.58, new SolidColorBrush(Color.FromArgb(220, 255, 255, 255)))
            };
        }

        private void OpenGenericBrowserExtensionTarget(BrowserExtensionModel ext, GenericBrowserExtensionTarget target)
        {
            if (string.IsNullOrWhiteSpace(target.Url)) return;

            if (target.Surface == GenericBrowserExtensionSurface.Popup)
            {
                OpenGenericBrowserExtensionPopupCompact(target.Url);
                return;
            }

            NavigateGenericBrowserActiveTab(target.Url, closeExtensionPopup: true);
        }

        private void UpdateGenericBrowserActiveTab(string? url = null, string? pendingUrl = null, string? title = null, bool? isLoading = null)
        {
            if (!_isGenericBrowserMode) return;

            if (!string.IsNullOrWhiteSpace(url))
                _genericBrowserActiveTab.Url = url;

            if (pendingUrl != null)
                _genericBrowserActiveTab.PendingUrl = pendingUrl;
            else if (!string.IsNullOrWhiteSpace(url))
                _genericBrowserActiveTab.PendingUrl = url;

            if (title != null)
                _genericBrowserActiveTab.Title = title;

            if (isLoading.HasValue)
                _genericBrowserActiveTab.IsLoading = isLoading.Value;
        }

        private void RefreshGenericBrowserActiveTabFromWebView()
        {
            if (!_isGenericBrowserMode || _ytWebView?.CoreWebView2 == null) return;

            UpdateGenericBrowserActiveTab(
                _ytWebView.CoreWebView2.Source ?? _genericBrowserActiveTab.Url,
                title: _ytWebView.CoreWebView2.DocumentTitle ?? _genericBrowserActiveTab.Title);
        }

        private string BuildGenericBrowserActiveTabJson()
        {
            RefreshGenericBrowserActiveTabFromWebView();

            var tab = new
            {
                id = _genericBrowserActiveTab.Id,
                index = 0,
                windowId = _genericBrowserActiveTab.WindowId,
                active = true,
                highlighted = true,
                selected = true,
                currentWindow = true,
                status = _genericBrowserActiveTab.IsLoading ? "loading" : "complete",
                url = _genericBrowserActiveTab.Url,
                pendingUrl = string.IsNullOrWhiteSpace(_genericBrowserActiveTab.PendingUrl)
                    ? _genericBrowserActiveTab.Url
                    : _genericBrowserActiveTab.PendingUrl,
                title = _genericBrowserActiveTab.Title,
                favIconUrl = _genericBrowserActiveTab.FavIconUrl,
                incognito = false,
                pinned = false,
                audible = false,
                discarded = false,
                autoDiscardable = true,
                mutedInfo = new { muted = false }
            };

            return System.Text.Json.JsonSerializer.Serialize(tab);
        }

        private void NavigateGenericBrowserActiveTab(string uri, bool closeExtensionPopup)
        {
            if (string.IsNullOrWhiteSpace(uri) || _ytWebView?.CoreWebView2 == null) return;

            Dispatcher.Invoke(() =>
            {
                try
                {
                    UpdateGenericBrowserActiveTab(pendingUrl: uri, isLoading: true);
                    _ytWebView.CoreWebView2.Navigate(uri);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[DoorpiBrowser] Falha ao navegar aba ativa: " + ex.Message);
                }

                if (closeExtensionPopup)
                    CloseGenericBrowserExtensionsPopup();

                _ytWebView.Focus();
            });
        }

        private void ReloadGenericBrowserActiveTab()
        {
            Dispatcher.Invoke(() =>
            {
                try { _ytWebView?.CoreWebView2?.Reload(); }
                catch (Exception ex) { Debug.WriteLine("[DoorpiBrowser] Falha ao recarregar aba ativa: " + ex.Message); }
            });
        }

        private static bool IsBrowserNavigableUri(string uri)
        {
            if (string.IsNullOrWhiteSpace(uri)) return false;
            if (!Uri.TryCreate(uri, UriKind.Absolute, out var parsed)) return false;
            return parsed.Scheme == Uri.UriSchemeHttp ||
                   parsed.Scheme == Uri.UriSchemeHttps ||
                   parsed.Scheme == "chrome-extension";
        }

        private async void OpenGenericBrowserExtensionPopupCompact(string popupUrl)
        {
            if (_genericBrowserWidgetsPanel == null || _ytWebView?.CoreWebView2 == null) return;

            SuppressGenericBrowserOutsideCloseBriefly(420);
            try { _genericBrowserExtensionPopupView?.Dispose(); } catch { }
            _genericBrowserExtensionPopupView = null;

            SetGenericBrowserWidgetsPanelWidth(360);
            _genericBrowserWidgetsPanel.Height = double.NaN;
            _genericBrowserWidgetsPanel.MaxHeight = SystemParameters.WorkArea.Height * 0.82;
            _genericBrowserWidgetsPanel.Background = Brushes.White;
            _genericBrowserWidgetsPanel.BorderBrush = new SolidColorBrush(Color.FromArgb(58, 255, 255, 255));
            _genericBrowserWidgetsPanel.Padding = new Thickness(0);

            var popupView = new WebView2
            {
                MinWidth = 240,
                MinHeight = 220,
                MaxWidth = SystemParameters.WorkArea.Width * 0.52,
                MaxHeight = SystemParameters.WorkArea.Height * 0.82,
                HorizontalAlignment = HorizontalAlignment.Stretch,
                VerticalAlignment = VerticalAlignment.Stretch
            };
            try { popupView.DefaultBackgroundColor = System.Drawing.Color.White; } catch { }
            _genericBrowserExtensionPopupView = popupView;
            _genericBrowserWidgetsPanel.Child = popupView;

            try
            {
                if (_genericBrowserEnvironment != null)
                    await popupView.EnsureCoreWebView2Async(_genericBrowserEnvironment);
                else
                    await popupView.EnsureCoreWebView2Async();

                ApplyProductionWebViewSettings(popupView.CoreWebView2, allowDefaultContextMenus: true);
                popupView.CoreWebView2.NavigationCompleted += OnGenericBrowserExtensionPopupNavigationCompleted;
                popupView.CoreWebView2.NewWindowRequested += OnGenericBrowserExtensionPopupNewWindowRequested;
                popupView.CoreWebView2.WebMessageReceived += OnGenericBrowserExtensionPopupMessageReceived;
                await InjectGenericBrowserExtensionPopupBridgeAsync(popupView.CoreWebView2, BuildGenericBrowserActiveTabJson());
                popupView.CoreWebView2.Navigate(popupUrl);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DoorpiBrowser] Falha ao abrir popup da extensão: " + ex.Message);
            }
        }

        private void OnGenericBrowserExtensionPopupNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;
            string uri = e.Uri ?? "";
            if (string.IsNullOrWhiteSpace(uri)) return;

            OpenGenericBrowserExtensionPopupUrlInMainBrowser(uri, closeExtensionPopup: true);
        }

        private async void OnGenericBrowserExtensionPopupNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (sender is not CoreWebView2 core) return;

            const string script = @"
(function() {
    if (window.__doorpiExtensionPopupSizer) return;
    window.__doorpiExtensionPopupSizer = true;

    function measure() {
        const doc = document.documentElement;
        const body = document.body;
        let contentRight = 0;
        let contentBottom = 0;
        try {
            const nodes = Array.from(document.body?.querySelectorAll('*') || []);
            for (const node of nodes) {
                const style = getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
                const rect = node.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) continue;
                contentRight = Math.max(contentRight, rect.right);
                contentBottom = Math.max(contentBottom, rect.bottom);
            }
        } catch (_) {}
        const width = Math.ceil(Math.max(
            Math.min(
                Math.max(doc?.scrollWidth || 0, body?.scrollWidth || 0),
                contentRight > 0 ? contentRight : Number.MAX_SAFE_INTEGER
            ),
            contentRight || 0,
            240
        ));
        const height = Math.ceil(Math.max(
            Math.min(
                Math.max(doc?.scrollHeight || 0, body?.scrollHeight || 0),
                contentBottom > 0 ? contentBottom : Number.MAX_SAFE_INTEGER
            ),
            contentBottom || 0,
            220
        ));
        try {
            window.chrome.webview.postMessage('extension_popup_size:' + JSON.stringify({ width, height }));
        } catch (_) {}
    }

    let resizeTimer = 0;
    function scheduleMeasure() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(measure, 35);
    }

    try { new ResizeObserver(scheduleMeasure).observe(document.documentElement); } catch (_) {}
    try { if (document.body) new ResizeObserver(scheduleMeasure).observe(document.body); } catch (_) {}
    window.addEventListener('load', scheduleMeasure, { once: true });
    requestAnimationFrame(measure);
    setTimeout(measure, 120);
    setTimeout(measure, 420);
})();";

            try { await core.ExecuteScriptAsync(script); }
            catch (Exception ex) { Debug.WriteLine("[DoorpiBrowser] Falha ao medir popup da extensão: " + ex.Message); }
        }

        private void OnGenericBrowserExtensionPopupMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string msg = e.TryGetWebMessageAsString() ?? "";
            if (msg.StartsWith("extension_popup_size:", StringComparison.Ordinal))
            {
                ApplyGenericBrowserExtensionPopupSize(msg["extension_popup_size:".Length..]);
                return;
            }

            if (msg.StartsWith("extension_popup_reload", StringComparison.Ordinal))
            {
                ReloadGenericBrowserActiveTab();
                return;
            }

            if (!msg.StartsWith("extension_popup_open:", StringComparison.Ordinal)) return;

            string uri = "";
            try { uri = Uri.UnescapeDataString(msg["extension_popup_open:".Length..]); }
            catch { uri = msg["extension_popup_open:".Length..]; }

            if (!string.IsNullOrWhiteSpace(uri))
                OpenGenericBrowserExtensionPopupUrlInMainBrowser(uri, closeExtensionPopup: true);
        }

        private void ApplyGenericBrowserExtensionPopupSize(string payload)
        {
            try
            {
                var node = JsonNode.Parse(payload);
                double requestedWidth = node?["width"]?.GetValue<double>() ?? 360;
                double requestedHeight = node?["height"]?.GetValue<double>() ?? 360;

                double maxWidth = Math.Max(280, SystemParameters.WorkArea.Width * 0.52);
                double maxHeight = Math.Max(320, SystemParameters.WorkArea.Height * 0.82);
                double width = Math.Clamp(requestedWidth, 240, maxWidth);
                double height = Math.Clamp(requestedHeight, 220, maxHeight);

                Dispatcher.Invoke(() =>
                {
                    if (_genericBrowserWidgetsPanel == null || _genericBrowserExtensionPopupView == null)
                        return;

                    SetGenericBrowserWidgetsPanelWidth(width);
                    _genericBrowserWidgetsPanel.MaxHeight = maxHeight;
                    _genericBrowserExtensionPopupView.Width = width;
                    _genericBrowserExtensionPopupView.Height = height;
                    _genericBrowserExtensionPopupView.MaxWidth = maxWidth;
                    _genericBrowserExtensionPopupView.MaxHeight = maxHeight;
                });
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DoorpiBrowser] Tamanho inválido do popup da extensão: " + ex.Message);
            }
        }

        private void OpenGenericBrowserExtensionPopupUrlInMainBrowser(string uri, bool closeExtensionPopup)
        {
            if (!IsBrowserNavigableUri(uri)) return;
            NavigateGenericBrowserActiveTab(uri, closeExtensionPopup);
        }

        private static async Task InjectGenericBrowserExtensionPopupBridgeAsync(CoreWebView2 core, string activeTabJson)
        {
            string script = @"
(function() {
    if (window.__doorpiExtensionPopupBridge) return;
    window.__doorpiExtensionPopupBridge = true;
    const __doorpiActiveTab = " + activeTabJson + @";
    const __doorpiWindow = {
        id: 1,
        focused: true,
        incognito: false,
        type: 'normal',
        state: 'normal',
        alwaysOnTop: false,
        tabs: [__doorpiActiveTab]
    };

    function asyncResult(value, callback) {
        if (typeof callback === 'function') {
            setTimeout(() => callback(value), 0);
            return;
        }
        return Promise.resolve(value);
    }

    function asyncVoid(callback) {
        if (typeof callback === 'function') {
            setTimeout(() => callback(), 0);
            return;
        }
        return Promise.resolve();
    }

    function clone(value) {
        try { return JSON.parse(JSON.stringify(value)); }
        catch (_) { return value; }
    }

    function activeTab(url) {
        const tab = clone(__doorpiActiveTab);
        if (url) {
            tab.url = url;
            tab.pendingUrl = url;
        }
        return tab;
    }

    function absoluteUrl(url) {
        if (!url) return '';
        try { return new URL(String(url), location.href).href; }
        catch (_) { return String(url || ''); }
    }

    function openInMain(url) {
        const target = absoluteUrl(url);
        if (!target) return false;
        try { window.chrome.webview.postMessage('extension_popup_open:' + encodeURIComponent(target)); } catch (_) {}
        return true;
    }

    function reloadMain() {
        try { window.chrome.webview.postMessage('extension_popup_reload'); } catch (_) {}
    }

    const nativeOpen = window.open;
    window.open = function(url) {
        if (openInMain(url)) return null;
        return nativeOpen ? nativeOpen.apply(window, arguments) : null;
    };

    function patchChromeApi() {
        try {
            if (window.chrome && chrome.tabs && !chrome.tabs.__doorpiPatched) {
                const nativeCreate = chrome.tabs.create?.bind(chrome.tabs);
                const nativeUpdate = chrome.tabs.update?.bind(chrome.tabs);
                const nativeQuery = chrome.tabs.query?.bind(chrome.tabs);
                const nativeGet = chrome.tabs.get?.bind(chrome.tabs);
                chrome.tabs.query = function(queryInfo, callback) {
                    queryInfo = queryInfo || {};
                    const wantsDoorpiTab = queryInfo.active === true ||
                        queryInfo.currentWindow === true ||
                        queryInfo.windowId === 1 ||
                        Object.keys(queryInfo).length === 0;
                    if (wantsDoorpiTab) {
                        return asyncResult([activeTab()], callback);
                    }
                    return nativeQuery ? nativeQuery.apply(chrome.tabs, arguments) : asyncResult([], callback);
                };
                chrome.tabs.get = function(tabId, callback) {
                    if (tabId === 1 || tabId === undefined || tabId === null)
                        return asyncResult(activeTab(), callback);
                    return nativeGet ? nativeGet.apply(chrome.tabs, arguments) : asyncResult(undefined, callback);
                };
                chrome.tabs.getCurrent = function(callback) {
                    return asyncResult(activeTab(), callback);
                };
                chrome.tabs.create = function(props, callback) {
                    const url = typeof props === 'string' ? props : props && props.url;
                    if (openInMain(url)) {
                        return asyncResult(activeTab(absoluteUrl(url)), callback);
                    }
                    return nativeCreate ? nativeCreate.apply(chrome.tabs, arguments) : undefined;
                };
                chrome.tabs.update = function(tabId, props, callback) {
                    if (typeof tabId === 'object') { callback = props; props = tabId; }
                    const url = props && props.url;
                    if (openInMain(url)) {
                        return asyncResult(activeTab(absoluteUrl(url)), callback);
                    }
                    if (props && (props.active || props.highlighted || props.selected))
                        return asyncResult(activeTab(), callback);
                    return nativeUpdate ? nativeUpdate.apply(chrome.tabs, arguments) : asyncResult(activeTab(), callback);
                };
                chrome.tabs.reload = function(tabId, reloadProperties, callback) {
                    if (typeof tabId === 'function') { callback = tabId; }
                    else if (typeof reloadProperties === 'function') { callback = reloadProperties; }
                    reloadMain();
                    return asyncVoid(callback);
                };
                chrome.tabs.__doorpiPatched = true;
            }

            if (window.chrome && chrome.windows && !chrome.windows.__doorpiPatched) {
                const nativeGet = chrome.windows.get?.bind(chrome.windows);
                const nativeGetCurrent = chrome.windows.getCurrent?.bind(chrome.windows);
                const nativeGetAll = chrome.windows.getAll?.bind(chrome.windows);
                chrome.windows.get = function(windowId, getInfo, callback) {
                    if (typeof getInfo === 'function') { callback = getInfo; getInfo = {}; }
                    if (windowId === 1 || windowId === undefined || windowId === null)
                        return asyncResult(clone(__doorpiWindow), callback);
                    return nativeGet ? nativeGet.apply(chrome.windows, arguments) : asyncResult(undefined, callback);
                };
                chrome.windows.getCurrent = function(getInfo, callback) {
                    if (typeof getInfo === 'function') { callback = getInfo; }
                    return asyncResult(clone(__doorpiWindow), callback);
                };
                chrome.windows.getAll = function(getInfo, callback) {
                    if (typeof getInfo === 'function') { callback = getInfo; }
                    return asyncResult([clone(__doorpiWindow)], callback);
                };
                chrome.windows.__doorpiPatched = true;
            }

            if (window.chrome && chrome.runtime && !chrome.runtime.__doorpiPatched) {
                const nativeOpenOptions = chrome.runtime.openOptionsPage?.bind(chrome.runtime);
                chrome.runtime.openOptionsPage = function(callback) {
                    let optionsUrl = '';
                    try {
                        const manifest = chrome.runtime.getManifest && chrome.runtime.getManifest();
                        const page = manifest?.options_ui?.page || manifest?.options_page || '';
                        if (page && chrome.runtime.getURL) optionsUrl = chrome.runtime.getURL(page);
                    } catch (_) {}
                    if (openInMain(optionsUrl)) {
                        try { callback && callback(); } catch (_) {}
                        return;
                    }
                    return nativeOpenOptions ? nativeOpenOptions.apply(chrome.runtime, arguments) : undefined;
                };
                chrome.runtime.__doorpiPatched = true;
            }
        } catch (_) {}
    }

    patchChromeApi();
    setTimeout(patchChromeApi, 50);
    setTimeout(patchChromeApi, 250);

    document.addEventListener('click', function(event) {
        const path = event.composedPath ? event.composedPath() : [];
        const anchor = path.find(el => el && el.tagName === 'A' && el.href) || event.target?.closest?.('a[href]');
        if (!anchor) return;
        const href = anchor.href || anchor.getAttribute('href');
        if (!href) return;
        if (anchor.target && anchor.target !== '_self') {
            event.preventDefault();
            event.stopPropagation();
            openInMain(href);
        }
    }, true);
})();";
            await core.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private async void OpenGenericBrowserExtensionPopup(BrowserExtensionModel ext, string popupUrl)
        {
            if (_genericBrowserWidgetsPanel == null || _ytWebView?.CoreWebView2 == null) return;

            string name = string.IsNullOrWhiteSpace(ext.Name) ? ext.Id : ext.Name;
            string version = GetExtensionVersion(ext);
            bool hasUpdate = _latestUpdatesCache.TryGetValue(ext.Id, out string? updateVersion) &&
                             !string.IsNullOrWhiteSpace(updateVersion);

            var root = new Grid();
            try { _genericBrowserExtensionPopupView?.Dispose(); } catch { }
            _genericBrowserExtensionPopupView = null;
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

            var header = new Border
            {
                Margin = new Thickness(0, 0, 0, 12),
                Padding = new Thickness(0, 0, 0, 12),
                BorderBrush = new SolidColorBrush(Color.FromArgb(28, 255, 255, 255)),
                BorderThickness = new Thickness(0, 0, 0, 1)
            };
            var headerGrid = new Grid();
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            var back = new Button
            {
                Content = CreateExtensionPuzzleIcon(22),
                ToolTip = "Voltar para extensões",
                Width = 42,
                Height = 38,
                Padding = new Thickness(0),
                Margin = new Thickness(0, 0, 12, 0),
                Style = CreateBrowserToolbarButtonStyle(),
                Cursor = Cursors.Hand
            };
            back.Click += (_, _) => RenderGenericBrowserExtensionList();
            Grid.SetColumn(back, 0);
            headerGrid.Children.Add(back);

            var icon = BuildGenericBrowserExtensionIcon(ext, 42);
            icon.Margin = new Thickness(0, 0, 10, 0);
            Grid.SetColumn(icon, 1);
            headerGrid.Children.Add(icon);

            var title = new StackPanel { Orientation = Orientation.Vertical, VerticalAlignment = VerticalAlignment.Center };
            title.Children.Add(new TextBlock
            {
                Text = name,
                Foreground = Brushes.White,
                FontSize = 14.5,
                FontWeight = FontWeights.SemiBold,
                TextTrimming = TextTrimming.CharacterEllipsis
            });
            title.Children.Add(new TextBlock
            {
                Text = hasUpdate
                    ? $"v{version} - atualização disponível: v{updateVersion}"
                    : (string.IsNullOrWhiteSpace(version) ? "Versão desconhecida" : $"v{version}"),
                Foreground = hasUpdate
                    ? new SolidColorBrush(Color.FromRgb(255, 198, 92))
                    : new SolidColorBrush(Color.FromArgb(145, 255, 255, 255)),
                FontSize = 12,
                TextTrimming = TextTrimming.CharacterEllipsis
            });
            Grid.SetColumn(title, 2);
            headerGrid.Children.Add(title);
            header.Child = headerGrid;
            Grid.SetRow(header, 0);
            root.Children.Add(header);

            var popupView = new WebView2
            {
                Height = 360,
                HorizontalAlignment = HorizontalAlignment.Stretch,
                VerticalAlignment = VerticalAlignment.Stretch
            };
            try { popupView.DefaultBackgroundColor = System.Drawing.Color.White; } catch { }
            _genericBrowserExtensionPopupView = popupView;
            Grid.SetRow(popupView, 1);
            root.Children.Add(popupView);
            _genericBrowserWidgetsPanel.Child = root;

            try
            {
                if (_genericBrowserEnvironment != null)
                    await popupView.EnsureCoreWebView2Async(_genericBrowserEnvironment);
                else
                    await popupView.EnsureCoreWebView2Async();

                ApplyProductionWebViewSettings(popupView.CoreWebView2, allowDefaultContextMenus: true);
                popupView.CoreWebView2.Navigate(popupUrl);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DoorpiBrowser] Falha ao abrir painel da extensão: " + ex.Message);
            }
        }

        private static string ResolveExtensionManifestPath(BrowserExtensionModel ext)
        {
            try
            {
                string manifestPath = Path.Combine(ext.InstalledPath, "manifest.json");
                if (File.Exists(manifestPath)) return manifestPath;

                var versionFolder = Directory.GetDirectories(ext.InstalledPath)
                    .FirstOrDefault(d => File.Exists(Path.Combine(d, "manifest.json")));
                return versionFolder == null ? "" : Path.Combine(versionFolder, "manifest.json");
            }
            catch
            {
                return "";
            }
        }

        private static string ResolveExtensionIconPath(BrowserExtensionModel ext)
        {
            try
            {
                string manifestPath = ResolveExtensionManifestPath(ext);
                if (string.IsNullOrWhiteSpace(manifestPath) || !File.Exists(manifestPath)) return "";

                var manifest = JsonNode.Parse(File.ReadAllText(manifestPath));
                var iconNode =
                    manifest?["action"]?["default_icon"] ??
                    manifest?["browser_action"]?["default_icon"] ??
                    manifest?["icons"];
                string icon = PickBestExtensionIcon(iconNode);

                if (string.IsNullOrWhiteSpace(icon))
                    icon = PickBestExtensionIcon(manifest?["icons"]);

                icon = icon.Trim().TrimStart('/');
                if (string.IsNullOrWhiteSpace(icon) || icon.StartsWith("__MSG_", StringComparison.OrdinalIgnoreCase))
                    return "";

                string path = Path.Combine(Path.GetDirectoryName(manifestPath) ?? ext.InstalledPath, icon.Replace('/', Path.DirectorySeparatorChar));
                return File.Exists(path) ? path : "";
            }
            catch
            {
                return "";
            }
        }

        private static string PickBestExtensionIcon(JsonNode? node)
        {
            if (node == null) return "";
            if (node is JsonValue value) return value.ToString();
            if (node is not JsonObject obj) return "";

            return obj
                .Select(kvp =>
                {
                    int size = int.TryParse(kvp.Key, out int parsed) ? parsed : 0;
                    return new { Size = size, Path = kvp.Value?.ToString() ?? "" };
                })
                .Where(item => !string.IsNullOrWhiteSpace(item.Path))
                .OrderByDescending(item => item.Size)
                .FirstOrDefault()?.Path ?? "";
        }

        private static GenericBrowserExtensionTarget ResolveExtensionFrontendTarget(BrowserExtensionModel ext)
        {
            try
            {
                string manifestPath = ResolveExtensionManifestPath(ext);

                if (!File.Exists(manifestPath))
                    return new GenericBrowserExtensionTarget("", GenericBrowserExtensionSurface.None);

                var manifest = JsonNode.Parse(File.ReadAllText(manifestPath));
                string popupPage =
                    manifest?["action"]?["default_popup"]?.ToString() ??
                    manifest?["browser_action"]?["default_popup"]?.ToString() ??
                    "";

                string extensionId = GetLoadedExtensionId(ext, manifestPath);
                if (string.IsNullOrWhiteSpace(extensionId))
                    return new GenericBrowserExtensionTarget("", GenericBrowserExtensionSurface.None);

                popupPage = popupPage.Trim().TrimStart('/');
                if (!string.IsNullOrWhiteSpace(popupPage))
                {
                    return new GenericBrowserExtensionTarget(
                        $"chrome-extension://{extensionId}/{popupPage}",
                        GenericBrowserExtensionSurface.Popup);
                }

                string optionsPage =
                    manifest?["options_ui"]?["page"]?.ToString() ??
                    manifest?["options_page"]?.ToString() ??
                    "";
                optionsPage = optionsPage.Trim().TrimStart('/');
                if (!string.IsNullOrWhiteSpace(optionsPage))
                {
                    return new GenericBrowserExtensionTarget(
                        $"chrome-extension://{extensionId}/{optionsPage}",
                        GenericBrowserExtensionSurface.Options);
                }

                return new GenericBrowserExtensionTarget("", GenericBrowserExtensionSurface.None);
            }
            catch
            {
                return new GenericBrowserExtensionTarget("", GenericBrowserExtensionSurface.None);
            }
        }

        private void UpdateGenericBrowserChrome()
        {
            if (!_isGenericBrowserMode || _ytWebView?.CoreWebView2 == null) return;

            RefreshGenericBrowserActiveTabFromWebView();
            string source = _ytWebView.CoreWebView2.Source ?? "";
            if (_genericBrowserAddressBox != null && !_genericBrowserAddressBox.IsKeyboardFocusWithin)
                _genericBrowserAddressBox.Text = source;

            if (_genericBrowserBackButton != null)
                _genericBrowserBackButton.IsEnabled = _ytWebView.CoreWebView2.CanGoBack;

            if (_genericBrowserForwardButton != null)
                _genericBrowserForwardButton.IsEnabled = _ytWebView.CoreWebView2.CanGoForward;
        }

        private void OnGenericBrowserDownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs e)
        {
            try
            {
                string suggestedName = Path.GetFileName(e.ResultFilePath);
                string targetPath = AvailableDownloadPath(UserDownloadsFolder, suggestedName);
                e.ResultFilePath = targetPath;
                e.Handled = false;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[DoorpiBrowser] Falha ao preparar download: " + ex.Message);
            }
        }

        private static bool IsCapturableWebUrl(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            value = value.Trim();
            return Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
                   (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
        }

        private void BeginGenericBrowserWebAppUrlCapture()
        {
            _genericBrowserCaptureWebAppUrl = true;
            try { _genericBrowserCaptureInitialClipboard = Clipboard.ContainsText() ? Clipboard.GetText().Trim() : ""; }
            catch { _genericBrowserCaptureInitialClipboard = ""; }

            _genericBrowserCaptureClipboardTimer?.Stop();
            _genericBrowserCaptureClipboardTimer = new System.Windows.Threading.DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(450)
            };
            _genericBrowserCaptureClipboardTimer.Tick += (_, _) =>
            {
                if (!_genericBrowserCaptureWebAppUrl) return;
                string text = "";
                try { text = Clipboard.ContainsText() ? Clipboard.GetText().Trim() : ""; }
                catch { return; }
                if (string.IsNullOrWhiteSpace(text) ||
                    string.Equals(text, _genericBrowserCaptureInitialClipboard, StringComparison.Ordinal))
                    return;
                TryCompleteGenericBrowserWebAppUrlCapture(text);
            };
            _genericBrowserCaptureClipboardTimer.Start();
        }

        private void StopGenericBrowserWebAppUrlCapture()
        {
            _genericBrowserCaptureWebAppUrl = false;
            _genericBrowserCaptureInitialClipboard = "";
            try { _genericBrowserCaptureClipboardTimer?.Stop(); } catch { }
            _genericBrowserCaptureClipboardTimer = null;
        }

        private bool TryCompleteGenericBrowserWebAppUrlCapture(string url)
        {
            if (!_genericBrowserCaptureWebAppUrl || !IsCapturableWebUrl(url)) return false;
            StopGenericBrowserWebAppUrlCapture();

            try
            {
                webView.CoreWebView2?.PostWebMessageAsString(
                    System.Text.Json.JsonSerializer.Serialize(new
                    {
                        type = "webAppBrowserUrlCaptured",
                        url = url.Trim()
                    }));
            }
            catch { }

            Dispatcher.InvokeAsync(() => CloseYouTubeInline(skipStoreCompletion: true));
            return true;
        }

        // ── Controller thread ─────────────────────────────────────────────────

        private void OnGenericBrowserContainsFullScreenElementChanged(object? sender, object e)
        {
            if (!_isGenericBrowserMode || _ytWebView?.CoreWebView2 == null) return;
            bool isFullScreen = _ytWebView.CoreWebView2.ContainsFullScreenElement;
            Dispatcher.Invoke(() => SetGenericBrowserToolbarVisible(!isFullScreen));
        }

        private void SetGenericBrowserToolbarVisible(bool visible)
        {
            if (_genericBrowserToolbar == null || _genericBrowserToolbarRow == null) return;

            if (visible)
            {
                _genericBrowserToolbar.Visibility = Visibility.Visible;
                _genericBrowserToolbarRow.Height = new GridLength(64);
                _genericBrowserToolbar.BeginAnimation(OpacityProperty,
                    new DoubleAnimation(1, TimeSpan.FromMilliseconds(140)));
                return;
            }

            CloseGenericBrowserExtensionsPopup();
            if (_genericBrowserKeyboardTarget != GenericBrowserKeyboardTarget.None)
                CloseGenericBrowserKeyboard(_genericBrowserKeyboardTarget == GenericBrowserKeyboardTarget.WebInput);

            _genericBrowserToolbar.BeginAnimation(OpacityProperty,
                new DoubleAnimation(0, TimeSpan.FromMilliseconds(120)));
            _genericBrowserToolbar.Visibility = Visibility.Collapsed;
            _genericBrowserToolbarRow.Height = new GridLength(0);
        }

        private async void ShowGenericBrowserCopyFeedback(string copiedSource)
        {
            if (_genericBrowserAddressBox == null) return;

            var originalForeground = _genericBrowserAddressBox.Foreground;
            var background = _genericBrowserAddressBox.Background as SolidColorBrush;
            Color? originalBackground = background?.Color;

            if (background != null)
            {
                background.BeginAnimation(SolidColorBrush.ColorProperty,
                    new ColorAnimation(Color.FromRgb(23, 80, 70), TimeSpan.FromMilliseconds(130)));
            }

            _genericBrowserAddressBox.Foreground = new SolidColorBrush(Color.FromRgb(170, 255, 226));
            _genericBrowserAddressBox.Text = "copiado";
            _genericBrowserAddressBox.CaretIndex = _genericBrowserAddressBox.Text.Length;

            await Task.Delay(850);

            if (_genericBrowserAddressBox == null) return;

            if (string.Equals(_genericBrowserAddressBox.Text, "copiado", StringComparison.OrdinalIgnoreCase))
            {
                _genericBrowserAddressBox.Text = copiedSource;
            }

            _genericBrowserAddressBox.Foreground = originalForeground;
            if (background != null && originalBackground.HasValue)
            {
                background.BeginAnimation(SolidColorBrush.ColorProperty,
                    new ColorAnimation(originalBackground.Value, TimeSpan.FromMilliseconds(180)));
            }
        }

        private void StartMediaControllerMode()
        {
            if (_mediaControllerThread?.IsAlive == true) return;
            _mediaMouseActive = true;
            _mediaControllerThread = new Thread(MediaControllerLoop) { IsBackground = true };
            _mediaControllerThread.Start();
        }

        private void StopMediaControllerMode()
        {
            _mediaMouseActive = false;
        }

        // ─────────────────────────────────────────────────────────────────────
        // LOOP DO CONTROLLER
        // ─────────────────────────────────────────────────────────────────────
        private void MediaControllerLoop()
        {
            var sw = Stopwatch.StartNew();
            ushort prevButtons = 0;
            double speedMult = 1.0;
            double exactX = -1, exactY = -1;

            // Repetição de direção no VKB
            ushort vkbLastDir = 0;
            long vkbDirStartMs = 0;
            long vkbDirLastRepeat = 0;
            const int VKB_INITIAL_MS = 380;
            const int VKB_REPEAT_MS = 75;

            // Repetição de backspace (botão X)
            bool xWasHeld = false;
            bool ltWasHeld = false;
            bool leftMouseDown = false;
            bool bHoldActive = false;
            bool bCloseFired = false;
            long bHoldStartMs = 0;
            ushort webNavLastDir = 0;
            long webNavDirStartMs = 0;
            long webNavDirLastRepeat = 0;
            long xHoldStartMs = 0;
            long xLastRepeat = 0;
            const int WEB_NAV_INITIAL_MS = 330;
            const int WEB_NAV_REPEAT_MS = 82;
            const int WEB_CLOSE_HOLD_MS = 1450;
            const int WEB_CLOSE_INDICATOR_MS = 220;
            var nativeVkbHoldActive = new Dictionary<VkbHoldAction, bool>
            {
                { VkbHoldAction.MoveUp, false },
                { VkbHoldAction.MoveDown, false },
                { VkbHoldAction.MoveLeft, false },
                { VkbHoldAction.MoveRight, false },
                { VkbHoldAction.CursorLeft, false },
                { VkbHoldAction.CursorRight, false },
                { VkbHoldAction.ToggleLayer, false },
                { VkbHoldAction.Press, false }
            };

            while (_mediaMouseActive)
            {
                double dt = sw.Elapsed.TotalSeconds;
                sw.Restart();
                if (dt > 0.08) dt = 0.016;

                XINPUT_STATE state = default;
                int result;
                if (_canUseXInputEx)
                {
                    try { result = XInputGetStateEx(0, out state); }
                    catch { _canUseXInputEx = false; result = XInputGetState(0, out state); }
                }
                else { result = XInputGetState(0, out state); }

                if (result == 0)
                {
                    var gp = state.Gamepad;
                    ushort btn = gp.wButtons;
                    long nowMs = Environment.TickCount64;

                    // Nunca manter emulação de mouse/teclado ativa quando nenhuma janela
                    // do Doorpi está em foco (ex.: jogo em primeiro plano).
                    // Isso evita input duplicado ao alternar WebApp -> Jogo.
                    if (!IsForegroundOwnedByProcess(Environment.ProcessId))
                    {
                        if (leftMouseDown)
                        {
                            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                            leftMouseDown = false;
                        }
                        prevButtons = btn;
                        Thread.Sleep(25);
                        continue;
                    }

                    bool Pressed(ushort m) => (btn & m) != 0 && (prevButtons & m) == 0;
                    bool Held(ushort m) => (btn & m) != 0;
                    bool Released(ushort m) => (btn & m) == 0 && (prevButtons & m) != 0;

                    if (_webAppTutorialOpen)
                    {
                        if (leftMouseDown)
                        {
                            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                            leftMouseDown = false;
                        }

                        if (Pressed(XI_A) || Pressed(XI_B) || Pressed(XI_START))
                            Dispatcher.Invoke(DismissWebAppTutorial);

                        prevButtons = btn;
                        Thread.Sleep(20);
                        continue;
                    }

                    // ════════════════════════════════════════════════════════
                    if (IsDoorpiReturnShortcutJustPressed(btn, prevButtons))
                    {
                        Interlocked.Exchange(ref _returnFromExternalModeSuppressUntil,
                            DateTime.UtcNow.AddMilliseconds(350).Ticks);

                        Dispatcher.Invoke(() =>
                        {
                            if (_genericBrowserKeyboardTarget != GenericBrowserKeyboardTarget.None)
                                CloseGenericBrowserKeyboard(_genericBrowserKeyboardTarget == GenericBrowserKeyboardTarget.WebInput);

                            if (_isGenericBrowserMode && _genericBrowserCaptureWebAppUrl)
                            {
                                CloseYouTubeInline(skipStoreCompletion: true);
                                return;
                            }

                            if (_isStoreLauncherSession)
                            {
                                MinimizeStoreSessionAndShowMenu();
                                return;
                            }

                            try { _popupWindow?.Close(); } catch { }
                            _popupWindow = null;
                            _popupWebView = null;

                            if (_webAppWindow != null)
                                _webAppWindow.WindowState = WindowState.Minimized;
                            FocusDoorpiKeepSession();
                        });
                        prevButtons = btn;
                        Thread.Sleep(100);
                        continue;
                    }

                    bool useNativeMouse = !_isCurrentSiteYouTube || _popupWindow != null;

                    if (!_vkbIsOpen)
                    {
                        if (Pressed(XI_B))
                        {
                            bHoldActive = true;
                            bCloseFired = false;
                            bHoldStartMs = nowMs;
                            HideWebAppCloseHoldOverlay();
                        }

                        if (bHoldActive && Held(XI_B))
                        {
                            double progress = Math.Clamp((nowMs - bHoldStartMs - WEB_CLOSE_INDICATOR_MS) /
                                                         (double)(WEB_CLOSE_HOLD_MS - WEB_CLOSE_INDICATOR_MS), 0, 1);
                            if (progress > 0)
                                UpdateWebAppCloseHoldOverlay(progress);

                            if (!bCloseFired && nowMs - bHoldStartMs >= WEB_CLOSE_HOLD_MS)
                            {
                                bCloseFired = true;
                                if (leftMouseDown)
                                {
                                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                                    leftMouseDown = false;
                                }
                                HideWebAppCloseHoldOverlay();
                                Dispatcher.Invoke(() => CloseYouTubeInline());
                                prevButtons = btn;
                                Thread.Sleep(120);
                                continue;
                            }
                        }

                        if (bHoldActive && Released(XI_B))
                        {
                            bool wasClose = bCloseFired;
                            bHoldActive = false;
                            bCloseFired = false;
                            HideWebAppCloseHoldOverlay();
                            if (!wasClose)
                            {
                                bool handled = false;
                                if (_isGenericBrowserMode)
                                    Dispatcher.Invoke(() => handled = HandleGenericBrowserExtensionsBack());
                                if (!handled)
                                {
                                    Dispatcher.Invoke(() =>
                                    {
                                        try
                                        {
                                            if (_ytWebView?.CoreWebView2?.CanGoBack == true)
                                                _ytWebView.CoreWebView2.GoBack();
                                        }
                                        catch { }
                                    });
                                }
                            }
                            prevButtons = btn;
                            Thread.Sleep(40);
                            continue;
                        }
                    }

                    // ════════════════════════════════════════════════════════
                    if (!_vkbIsOpen)
                    {
                        if (Pressed(XI_R3))
                            SendVirtualKey(0xAD);

                        if (Pressed(XI_Y))
                            SendVirtualKey(0x46);

                        if (Pressed(XI_X))
                        {
                            mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                            mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
                        }

                        if (Pressed(XI_L1))
                        {
                            mouse_event(MOUSEEVENTF_XDOWN, 0, 0, XBUTTON1, UIntPtr.Zero);
                            mouse_event(MOUSEEVENTF_XUP, 0, 0, XBUTTON1, UIntPtr.Zero);
                        }

                        if (Pressed(XI_R1))
                        {
                            mouse_event(MOUSEEVENTF_XDOWN, 0, 0, XBUTTON2, UIntPtr.Zero);
                            mouse_event(MOUSEEVENTF_XUP, 0, 0, XBUTTON2, UIntPtr.Zero);
                        }

                        ushort navDirBtn = 0;
                        byte navVk = 0;
                        if (Held(XI_DPAD_LEFT)) { navDirBtn = XI_DPAD_LEFT; navVk = 0x25; }
                        else if (Held(XI_DPAD_UP)) { navDirBtn = XI_DPAD_UP; navVk = 0x26; }
                        else if (Held(XI_DPAD_RIGHT)) { navDirBtn = XI_DPAD_RIGHT; navVk = 0x27; }
                        else if (Held(XI_DPAD_DOWN)) { navDirBtn = XI_DPAD_DOWN; navVk = 0x28; }

                        if (navDirBtn != 0)
                        {
                            if (navDirBtn != webNavLastDir)
                            {
                                webNavLastDir = navDirBtn;
                                webNavDirStartMs = nowMs;
                                webNavDirLastRepeat = nowMs;
                                SendVirtualKey(navVk);
                            }
                            else if ((nowMs - webNavDirStartMs) > WEB_NAV_INITIAL_MS &&
                                     (nowMs - webNavDirLastRepeat) > WEB_NAV_REPEAT_MS)
                            {
                                webNavDirLastRepeat = nowMs;
                                SendVirtualKey(navVk);
                            }
                        }
                        else
                        {
                            webNavLastDir = 0;
                        }
                    }

                    if (useNativeMouse && !_vkbIsOpen)
                    {
                        double lx = gp.sThumbLX / 32767.0;
                        double ly = gp.sThumbLY / 32767.0;
                        const double DEAD = 0.14;
                        if (Math.Abs(lx) < DEAD) lx = 0;
                        if (Math.Abs(ly) < DEAD) ly = 0;

                        if (lx != 0 || ly != 0)
                        {
                            speedMult = Math.Min(speedMult + (0.8 * dt), 2.5);
                            const double SENSE = CONTROLLER_MOUSE_BASE_SPEED * CONTROLLER_MOUSE_SENSITIVITY_SCALE;

                            if (exactX < 0)
                                Dispatcher.Invoke(() => { if (GetCursorPos(out var pt)) { exactX = pt.X; exactY = pt.Y; } });

                            exactX += lx * SENSE * speedMult * dt;
                            exactY += ly * -SENSE * speedMult * dt;

                            Dispatcher.Invoke(() => SetCursorPos((int)Math.Round(exactX), (int)Math.Round(exactY)));
                        }
                        else { speedMult = 1.0; exactX = -1; }

                        // Scroll pelo analógico direito
                        double ry = gp.sThumbRY / 32767.0;
                        if (Math.Abs(ry) > 0.18)
                        {
                            int scroll = (int)(ry * 2800 * dt);
                            if (scroll != 0) mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)scroll, UIntPtr.Zero);
                        }
                    }

                    // ════════════════════════════════════════════════════════
                    // BOTÕES E VKB
                    // ════════════════════════════════════════════════════════
                    if (_vkbIsOpen)
                    {
                        if (leftMouseDown)
                        {
                            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                            leftMouseDown = false;
                        }

                        if (_isGenericBrowserMode && _desktopVkb != null)
                        {
                            double nativeAlx = gp.sThumbLX / 32767.0;
                            double nativeAly = gp.sThumbLY / 32767.0;
                            const double NativeAnaDead = 0.5;

                            void HandleNativeVkbHold(VkbHoldAction action, bool isDown)
                            {
                                bool wasDown = nativeVkbHoldActive[action];
                                if (isDown && !wasDown)
                                {
                                    nativeVkbHoldActive[action] = true;
                                    Dispatcher.Invoke(() => _desktopVkb?.BeginHold(action));
                                }
                                else if (!isDown && wasDown)
                                {
                                    nativeVkbHoldActive[action] = false;
                                    Dispatcher.Invoke(() => _desktopVkb?.EndHold(action));
                                }
                            }

                            HandleNativeVkbHold(VkbHoldAction.MoveUp, Held(XI_DPAD_UP) || nativeAly > NativeAnaDead);
                            HandleNativeVkbHold(VkbHoldAction.MoveDown, Held(XI_DPAD_DOWN) || nativeAly < -NativeAnaDead);
                            HandleNativeVkbHold(VkbHoldAction.MoveLeft, Held(XI_DPAD_LEFT) || nativeAlx < -NativeAnaDead);
                            HandleNativeVkbHold(VkbHoldAction.MoveRight, Held(XI_DPAD_RIGHT) || nativeAlx > NativeAnaDead);
                            HandleNativeVkbHold(VkbHoldAction.CursorLeft, Held(XI_L1));
                            HandleNativeVkbHold(VkbHoldAction.CursorRight, Held(XI_R1));
                            HandleNativeVkbHold(VkbHoldAction.ToggleLayer, false);

                            if (_genericBrowserVkbSuppressAUntilRelease && !Held(XI_A))
                                _genericBrowserVkbSuppressAUntilRelease = false;

                            HandleNativeVkbHold(
                                VkbHoldAction.Press,
                                Held(XI_A) && !_genericBrowserVkbSuppressAUntilRelease);

                            if (Pressed(XI_B))
                            {
                                bool notifyWeb = _genericBrowserKeyboardTarget == GenericBrowserKeyboardTarget.WebInput;
                                Dispatcher.Invoke(() => CloseGenericBrowserKeyboard(notifyWeb));
                            }

                            if (Pressed(XI_Y))
                                Dispatcher.Invoke(() => HandleGenericBrowserKeyboardKey("SPACE"));

                            if (Pressed(XI_START))
                                Dispatcher.Invoke(() => HandleGenericBrowserKeyboardKey("ENTER"));

                            bool nativeLtNow = gp.bLeftTrigger > 128;
                            if (nativeLtNow && !ltWasHeld)
                                Dispatcher.Invoke(() => _desktopVkb?.ToggleAlphaSpecialLayer());
                            ltWasHeld = nativeLtNow;

                            if (Pressed(XI_L3))
                                Dispatcher.Invoke(() => _desktopVkb?.ToggleShift());

                            bool xNow = Held(XI_X);
                            if (xNow)
                            {
                                if (!xWasHeld)
                                {
                                    xWasHeld = true;
                                    xHoldStartMs = nowMs;
                                    xLastRepeat = nowMs;
                                    Dispatcher.Invoke(() => HandleGenericBrowserKeyboardKey("BKSP"));
                                }
                                else if ((nowMs - xHoldStartMs) > VKB_INITIAL_MS &&
                                         (nowMs - xLastRepeat) > VKB_REPEAT_MS)
                                {
                                    xLastRepeat = nowMs;
                                    Dispatcher.Invoke(() => HandleGenericBrowserKeyboardKey("BKSP"));
                                }
                            }
                            else
                            {
                                xWasHeld = false;
                            }

                            prevButtons = btn;
                            Thread.Sleep(12);
                            continue;
                        }

                        ushort dirBtn = 0;
                        string dirName = "";

                        double alx = gp.sThumbLX / 32767.0;
                        double aly = gp.sThumbLY / 32767.0;
                        const double ANA_DEAD = 0.5;

                        if (Held(XI_DPAD_UP) || aly > ANA_DEAD) { dirBtn = XI_DPAD_UP; dirName = "UP"; }
                        else if (Held(XI_DPAD_DOWN) || aly < -ANA_DEAD) { dirBtn = XI_DPAD_DOWN; dirName = "DOWN"; }
                        else if (Held(XI_DPAD_LEFT) || alx < -ANA_DEAD) { dirBtn = XI_DPAD_LEFT; dirName = "LEFT"; }
                        else if (Held(XI_DPAD_RIGHT) || alx > ANA_DEAD) { dirBtn = XI_DPAD_RIGHT; dirName = "RIGHT"; }

                        if (dirBtn != 0)
                        {
                            _vkbHasFocus = true;

                            if (dirBtn != vkbLastDir)
                            {
                                vkbLastDir = dirBtn; vkbDirStartMs = nowMs; vkbDirLastRepeat = nowMs;
                                SendVkbCommand($"window.__doorpiVkbMove?.('{dirName}')");
                            }
                            else if ((nowMs - vkbDirStartMs) > VKB_INITIAL_MS &&
                                     (nowMs - vkbDirLastRepeat) > VKB_REPEAT_MS)
                            {
                                vkbDirLastRepeat = nowMs;
                                SendVkbCommand($"window.__doorpiVkbMove?.('{dirName}')");
                            }
                        }
                        else { vkbLastDir = 0; }

                        // A: foco nas teclas → confirma; senão → clique normal
                        if (Pressed(XI_A))
                        {
                            if (_vkbHasFocus)
                                SendVkbCommand("window.__doorpiVkbConfirm?.()");
                            else
                            {
                                if (_isGenericBrowserMode) MarkGenericBrowserControllerInputIntent();
                                else MarkCurrentWebViewControllerInputIntent();
                                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                            }
                        }

                        // B fecha o VKB
                        if (Pressed(XI_B)) SendVkbCommand("window.__doorpiVkbClose?.()");

                        if (Pressed(XI_START)) SendVkbCommand("window.__doorpiVkbEnter?.()");

                        if (_vkbHasFocus)
                        {
                            if (Pressed(XI_Y)) SendVkbCommand("window.__doorpiVkbSpace?.()");
                            if (Pressed(XI_L3)) SendVkbCommand("window.__doorpiVkbToggleShift?.()");
                            if (Pressed(XI_L1)) SendVkbCommand("window.__doorpiVkbCursorLeft?.()");
                            if (Pressed(XI_R1)) SendVkbCommand("window.__doorpiVkbCursorRight?.()");
                            bool jsLtNow = gp.bLeftTrigger > 128;
                            if (jsLtNow && !ltWasHeld) SendVkbCommand("window.__doorpiVkbToggleLayer?.()");
                            ltWasHeld = jsLtNow;

                            bool xNow = Held(XI_X);
                            if (xNow)
                            {
                                if (!xWasHeld) { xWasHeld = true; xHoldStartMs = nowMs; xLastRepeat = nowMs; SendVkbCommand("window.__doorpiVkbBackspace?.()"); }
                                else if ((nowMs - xHoldStartMs) > VKB_INITIAL_MS && (nowMs - xLastRepeat) > VKB_REPEAT_MS)
                                { xLastRepeat = nowMs; SendVkbCommand("window.__doorpiVkbBackspace?.()"); }
                            }
                            else { xWasHeld = false; }
                        }
                    }
                    else
                    {
                        // Sem VKB: só age se usar mouse nativo
                        if (useNativeMouse)
                        {
                            if (Pressed(XI_A))
                            {
                                if (_isGenericBrowserMode) MarkGenericBrowserControllerInputIntent();
                                else MarkCurrentWebViewControllerInputIntent();
                                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                                leftMouseDown = true;
                            }
                            if (leftMouseDown && Released(XI_A))
                            {
                                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                                leftMouseDown = false;
                            }
                        }
                    }

                    prevButtons = btn;
                }

                Thread.Sleep(10);
            }

            if (leftMouseDown)
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
            HideWebAppCloseHoldOverlay();
        }

        private void SendVkbCommand(string script)
        {
            var view = _vkbOwnerView;
            if (view == null) return;
            Dispatcher.InvokeAsync(() =>
            {
                try { view.CoreWebView2?.ExecuteScriptAsync(script); }
                catch { /* view pode ter sido destruído */ }
            });
        }

        // ── Abrir app de mídia ────────────────────────────────────────────────

        private void MarkCurrentWebViewControllerInputIntent()
        {
            var view = _ytWebView;
            if (view == null) return;
            Dispatcher.Invoke(() =>
            {
                try { view.CoreWebView2?.ExecuteScriptAsync("try{window.__doorpiVkbControllerIntentAt=Date.now();}catch(e){}"); }
                catch { }
            });
        }

        private async void LaunchMediaApp(string url, string appType)
        {
            try
            {
                if (appType == "webview" || appType == "browser")
                {
                    bool isYouTube = url.Contains("youtube.com");
                    await OpenWebViewInlineAsync(url, isYouTube);
                }
                else { OpenInBrowser(url); }
            }
            catch (Exception ex) { Debug.WriteLine($"[LaunchMediaApp] Erro: {ex.Message}"); }
        }

        private void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;

            if (_isGenericBrowserMode)
            {
                if (!string.IsNullOrWhiteSpace(e.Uri))
                    NavigateGenericBrowserActiveTab(e.Uri, closeExtensionPopup: false);
                return;
            }

            if (_webAppLoadingActive)
            {
                Debug.WriteLine("[WebAppLoading] Janela nova bloqueada durante carregamento inicial: " + (e.Uri ?? "-"));
                return;
            }

            var deferral = e.GetDeferral();

            Dispatcher.Invoke(async () =>
            {
                bool keepPopupBehindLoading = _webAppLoadingActive;
                try { _popupWindow?.Close(); } catch { }
                _popupWindow = null;
                _popupWebView = null;

                // Definimos o Owner para que o Windows saiba para quem deve devolver o foco após fecharmos.
                _popupWindow = new Window
                {
                    Title = "Login",
                    Width = 600,
                    Height = 800,
                    WindowStartupLocation = WindowStartupLocation.CenterScreen,
                    Topmost = true,
                    Owner = _webAppWindow ?? this,
                    ShowInTaskbar = false
                };

                if (keepPopupBehindLoading)
                {
                    _popupWindow.Width = 1;
                    _popupWindow.Height = 1;
                    _popupWindow.Left = -32000;
                    _popupWindow.Top = -32000;
                    _popupWindow.Opacity = 0;
                    _popupWindow.ShowActivated = false;
                    _popupWindow.Topmost = false;
                }

                _popupWebView = new WebView2();
                _popupWindow.Content = _popupWebView;

                _popupWindow.Closed += (s, _) =>
                {
                    if (_vkbOwnerView == _popupWebView)
                    {
                        _vkbIsOpen = false;
                        _vkbOwnerView = null;
                        _vkbHasFocus = false;
                    }
                    _popupWebView = null;
                    _popupWindow = null;

                    // Restaura o foco explicitamente sem matar a sessão ativa
                    Dispatcher.InvokeAsync(() => {
                        if (_webAppWindow != null && _webAppWindow.WindowState != WindowState.Minimized)
                        {
                            // Cenário 1: App de mídia em janela própria
                            _webAppWindow.Activate();
                            _ytWebView?.Focus();
                        }
                        else if (_ytWebView != null && _ytWebView.Visibility == Visibility.Visible)
                        {
                            // Cenário 2: Utilitário Inline (SteamGridDB, Chrome Store, etc) ainda aberto.
                            // Apenas focamos nele. NÃO chamamos o ForceFocus() para não esconder o mouse nem voltar a música.
                            this.Activate();
                            _ytWebView.Focus();
                        }
                        else
                        {
                            // Cenário 3: Nenhum WebApp ativo
                            this.Activate();
                            this.ForceFocus();
                        }
                    });
                };

                _popupWindow.Show();
                if (!keepPopupBehindLoading)
                    _popupWindow.Activate();

                var env = _ytWebView!.CoreWebView2.Environment;
                await _popupWebView.EnsureCoreWebView2Async(env);

                await _popupWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("window.name = 'doorpi_popup';");
                _popupWebView.CoreWebView2.Settings.UserAgent = await BuildBrandedUserAgentAsync(_popupWebView.CoreWebView2);
                ApplyProductionWebViewSettings(_popupWebView.CoreWebView2, allowDefaultContextMenus: true);
                _popupWebView.CoreWebView2.PermissionRequested += OnWebViewPermissionRequested;


                _popupWebView.CoreWebView2.DocumentTitleChanged += (s, _) =>
                { if (_popupWindow != null) _popupWindow.Title = _popupWebView.CoreWebView2.DocumentTitle; };

                _popupWebView.CoreWebView2.WebMessageReceived += YtOnWebMessageReceived;
                _popupWebView.CoreWebView2.WindowCloseRequested += (s, _) => _popupWindow?.Close();

                _popupWebView.CoreWebView2.NavigationCompleted += async (s, args) =>
                {
                    // Mesma proteção para o popup: reseta VKB se a página navegou com ele aberto
                    if (_vkbOwnerView == _popupWebView)
                    {
                        _vkbIsOpen = false;
                        _vkbOwnerView = null;
                        _vkbHasFocus = false;
                    }

                    var popup = _popupWebView;
                    var yt = _ytWebView;
                    if (popup == null) return;

                    if (!keepPopupBehindLoading)
                    {
                        popup.Focus();
                        _ = popup.CoreWebView2.ExecuteScriptAsync("window.focus();");
                    }
                    try
                    {
                        string currentUrl = popup.CoreWebView2.Source;
                        if (yt == null) return;
                        var mainUri = new Uri(yt.CoreWebView2.Source);
                        var popupUri = new Uri(currentUrl);
                        if (popupUri.Host.Contains(mainUri.Host.Replace("www.", "")) && !currentUrl.Contains("google.com"))
                        {
                            await Task.Delay(2000);
                            if (_popupWindow != null) { _popupWindow.Close(); yt.CoreWebView2.Reload(); }
                        }
                    }
                    catch { }
                };

                await YtInjectGenericSiteAsync(_popupWebView.CoreWebView2);

                e.NewWindow = _popupWebView.CoreWebView2;
                deferral.Complete();

                if (!keepPopupBehindLoading)
                {
                    await Task.Delay(200);
                    _popupWebView.Focus();
                }
            });
        }

        // ── Extensões Chrome ──────────────────────────────────────────────────
        private static async Task LoadExtensionsAsync(CoreWebView2 cw)
        {
            string extBase = Path.Combine(DoorpiPaths.DataFolder, "extensions");
            if (!Directory.Exists(extBase)) return;
            foreach (var extFolder in Directory.GetDirectories(extBase))
            {
                try
                {
                    string manifestPath = Path.Combine(extFolder, "manifest.json");
                    string loadPath = extFolder;
                    if (!File.Exists(manifestPath))
                    {
                        var versionFolder = Directory.GetDirectories(extFolder)
                            .FirstOrDefault(d => File.Exists(Path.Combine(d, "manifest.json")));
                        if (versionFolder == null) { Debug.WriteLine($"[Extension] manifest.json não encontrado em: {extFolder}"); continue; }
                        loadPath = versionFolder;
                    }
                    var loadedExtension = await cw.Profile.AddBrowserExtensionAsync(loadPath);
                    RememberLoadedExtensionId(extFolder, loadedExtension.Id);
                    RememberLoadedExtensionId(loadPath, loadedExtension.Id);
                    Debug.WriteLine($"[Extension] Carregada: {Path.GetFileName(extFolder)} ({loadedExtension.Id})");
                }
                catch (Exception ex) { Debug.WriteLine($"[Extension] Falha: {Path.GetFileName(extFolder)} — {ex.Message}"); }
            }
        }
        private static async Task LoadEasyListAsync()
        {
            try
            {
                bool needsFetch = !File.Exists(EasyListCachePath) ||
                                  (DateTime.Now - File.GetLastWriteTime(EasyListCachePath)).TotalHours > 24;

                string content;
                if (needsFetch)
                {
                    using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
                    content = await http.GetStringAsync(
                        "https://raw.githubusercontent.com/easylist/easylist/master/easylist.txt");
                    Directory.CreateDirectory(Path.GetDirectoryName(EasyListCachePath)!);
                    await File.WriteAllTextAsync(EasyListCachePath, content);
                    Debug.WriteLine("[EasyList] Lista atualizada do GitHub.");
                }
                else
                {
                    content = await File.ReadAllTextAsync(EasyListCachePath);
                    Debug.WriteLine("[EasyList] Carregada do cache local.");
                }

                ParseEasyList(content);
                Debug.WriteLine($"[EasyList] {_easyListDomains.Count} domínios carregados.");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[EasyList] Falha ao carregar: {ex.Message}");
                // Tenta o cache mesmo que esteja velho
                if (File.Exists(EasyListCachePath))
                {
                    ParseEasyList(await File.ReadAllTextAsync(EasyListCachePath));
                    Debug.WriteLine("[EasyList] Usando cache antigo como fallback.");
                }
            }
        }

        private static void ParseEasyList(string content)
        {
            _easyListDomains.Clear();
            foreach (var rawLine in content.Split('\n'))
            {
                var line = rawLine.Trim();

                // Ignora comentários, cabeçalhos, filtros cosméticos e exceções
                if (line.Length == 0 || line[0] == '!' || line[0] == '[') continue;
                if (line.Contains("##") || line.Contains("#@#") || line.Contains("#?#")) continue;
                if (line.StartsWith("@@")) continue;

                // Só regras de domínio simples: ||exemplo.com^
                if (!line.StartsWith("||")) continue;

                var domain = line[2..];

                // Remove opções ($third-party, etc.)
                int dollar = domain.IndexOf('$');
                if (dollar >= 0) domain = domain[..dollar];

                domain = domain.TrimEnd('^', '/', ' ');

                // Só aceita domínios puros (sem wildcards ou caminhos)
                if (domain.Length > 0 && !domain.Contains('/') && !domain.Contains('*'))
                    _easyListDomains.Add(domain);
            }
        }

        private static bool IsBlockedByEasyList(string url)
        {
            if (_easyListDomains.Count == 0) return false;
            try
            {
                var host = new Uri(url).Host;
                if (_easyListDomains.Contains(host)) return true;

                // Checa domínios pai (sub.exemplo.com → exemplo.com)
                var parts = host.Split('.');
                for (int i = 1; i < parts.Length - 1; i++)
                {
                    if (_easyListDomains.Contains(string.Join('.', parts[i..]))) return true;
                }
                return false;
            }
            catch { return false; }
        }
        private async Task YtInjectGenericSiteAsync(CoreWebView2 cw, bool useNativeDoorpiKeyboard = false)
        {
            string script = $@"
(function() {{
    if (window.__doorpiGenericInjected) return;
    window.__doorpiGenericInjected = true;

    // ── FIX: ANTI-CRASH PARA PRIME VIDEO ─────────────────────────────────────
    try {{
        if (window.chrome && window.chrome.webview) {{
            delete window.chrome.webview.hostObjects;
            Object.defineProperty(window.chrome.webview, 'hostObjects', {{
                value: {{ 
                    sync: new Proxy({{}}, {{ get: () => undefined }}), 
                    async: new Proxy({{}}, {{ get: () => undefined }})
                }},
                configurable: true, writable: true
            }});
        }}
    }} catch(e) {{}}
    try {{
        const _safeQue = [];
        _safeQue.push = function(fn) {{
            try {{ if (typeof fn === 'function') fn(); }} catch(_) {{}}
        }};
        if (!window.ramp) {{
            window.ramp = {{ que: _safeQue, addTag: function(){{}} }};
        }} else {{
            window.ramp.que = _safeQue;
        }}
    }} catch(e) {{}}
    // ── 1. REDIRECIONAMENTO STEAMGRIDDB ──────────────────────────────────────
    // Removido do JavaScript para evitar conflito/crash com o React do SteamGridDB.
    // Agora o redirecionamento é controlado 100% pelo C# via NavigationStarting.

    // ── 2. AUTO-COPY NO CLIQUE (Chave API) ───────────────────────────────────
    document.addEventListener('click', function(e) {{
        if (location.hostname !== 'www.steamgriddb.com') return;
        
        const el = e.target.closest('code') || (e.target.tagName === 'CODE' ? e.target : null);
        if (!el) return;
        
        const apiText = el.innerText.trim();
        if (apiText.length > 20) {{ // Chave da API tem 32 chars
            const range = document.createRange();
            range.selectNodeContents(el);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            window.chrome.webview.postMessage('copy_api_key:' + apiText);
            showConsoleToast(
                '{_currentToastTitle}' || 'Doorpi',
                '{_currentToastSub}'   || 'Chave copiada!'
            );
            setTimeout(() => window.chrome.webview.postMessage('close_app'), 2200);
        }}
    }});

    // ── 3. TOAST ──────────────────────────────────────────────────────────────
    function showConsoleToast(title, sub) {{
        if (!document.getElementById('doorpi-toast-style')) {{
            const s = document.createElement('style');
            s.id = 'doorpi-toast-style';
            s.textContent = `
                .console-toast{{position:fixed;top:40px;left:50%;
                    transform:translateX(-50%) translateY(-20px);
                    background:rgba(7,7,26,0.96);backdrop-filter:blur(25px);
                    border:1px solid rgba(255,255,255,0.12);border-radius:14px;
                    padding:14px 28px;display:flex;align-items:center;gap:18px;
                    box-shadow:0 15px 45px rgba(0,0,0,0.7);z-index:2147483647;
                    opacity:0;transition:all 0.5s cubic-bezier(0.16,1,0.3,1);
                    font-family:'Outfit',sans-serif;min-width:320px;}}
                .console-toast.visible{{transform:translateX(-50%) translateY(0);opacity:1;}}
                .toast-icon{{width:40px;height:40px;background:#0078d4;border-radius:50%;
                    display:flex;align-items:center;justify-content:center;font-size:20px;color:white;
                    box-shadow:0 0 15px rgba(0,120,212,0.4);}}
                .toast-content{{display:flex;flex-direction:column;gap:2px;}}
                .toast-title{{color:white;font-weight:700;font-size:16px;letter-spacing:0.5px;}}
                .toast-sub{{color:rgba(255,255,255,0.45);font-size:13px;}}`;
            document.head.appendChild(s);
        }}
        const toast = document.createElement('div');
        toast.className = 'console-toast';
        const icon = Object.assign(document.createElement('div'), {{ className:'toast-icon', textContent:'✓' }});
        const cDiv = document.createElement('div'); cDiv.className = 'toast-content';
        cDiv.append(
            Object.assign(document.createElement('span'), {{ className:'toast-title', textContent:title }}),
            Object.assign(document.createElement('span'), {{ className:'toast-sub',   textContent:sub }})
        );
        toast.append(icon, cDiv);
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
    }}

    // ── 4. FECHAR COM ESC ────────────────────────────────────────────────────
    window.addEventListener('keydown', function(e) {{
        if (e.key !== 'Escape') return;
        try {{ e.preventDefault(); e.stopImmediatePropagation(); }} catch(_) {{}}
        if (window._vkbIsOpen) {{ _vkbClose(); return; }}
        try {{ window.chrome.webview.postMessage('close_app'); }} catch(_) {{}}
    }}, true);

    // ── 5. BOTÃO CHROME WEB STORE ────────────────────────────────────────────
    function injectChromeWebStoreBtn() {{
        let btn = document.getElementById('doorpi-ext-btn');
        let positionAnchored = false;
        let lastRenderedState = null;
        let detailPageEnteredAt = 0;

        function isDetailPage() {{ return location.href.includes('chromewebstore.google.com/detail/'); }}
        function getExtId() {{ return (location.href.match(/\/detail\/[^/]+\/([a-z]{{32}})/) || [])[1] || null; }}

        function findInstallButton() {{
            const installLabels = [
                'add to chrome', 'remove from chrome', 'use in chrome',
                'adicionar ao chrome', 'remover do chrome', 'usar no chrome',
                'añadir a chrome', 'eliminar de chrome', 'usar en chrome'
            ];
            const isInstallButton = (b) => {{
                const text = (b.textContent || b.getAttribute('aria-label') || '').trim().toLowerCase();
                const rect = b.getBoundingClientRect();
                return installLabels.some(label => text.includes(label)) && rect.width > 80 && rect.height > 24;
            }};
            for (const b of document.querySelectorAll('button')) {{
                if (b.id === 'doorpi-ext-btn') continue;
                if (isInstallButton(b)) return b;
            }}
            for (const host of document.querySelectorAll('*')) {{
                if (!host.shadowRoot) continue;
                for (const b of host.shadowRoot.querySelectorAll('button')) {{
                    if (b.id === 'doorpi-ext-btn') continue;
                    if (isInstallButton(b)) return b;
                }}
            }}
            return null;
        }}

        function dismissChromePromos() {{
            const promoTerms = ['download chrome', 'get chrome', 'use chrome', 'baixe o chrome', 'usar o chrome', 'use o chrome'];
            const roots = [document];
            for (let i = 0; i < roots.length; i++) {{
                for (const host of roots[i].querySelectorAll('*')) {{
                    if (host.shadowRoot && !roots.includes(host.shadowRoot)) roots.push(host.shadowRoot);
                }}
            }}

            const hide = (element) => {{
                if (!element || element.id === 'doorpi-ext-btn') return;
                element.style.setProperty('display', 'none', 'important');
                element.setAttribute('aria-hidden', 'true');
            }};

            for (const root of roots) {{
                for (const promo of root.querySelectorAll('[aria-labelledby~=promo-header]'))
                    hide(promo.closest('[role=dialog], [aria-modal=true], [popover], dialog') || promo);
                const promoHeader = root.querySelector('#promo-header');
                if (promoHeader) hide(promoHeader.closest('[role=dialog], [aria-modal=true], [popover], dialog') || promoHeader.parentElement);

                for (const dialog of root.querySelectorAll('[role=dialog], [aria-modal=true]')) {{
                    if (dialog.id === 'doorpi-ext-btn') continue;
                    const text = (dialog.textContent || '').trim().toLowerCase();
                    if (text.includes('chrome') && promoTerms.some(term => text.includes(term))) hide(dialog);
                }}
            }}
        }}

        function applyButtonBase() {{
            if (btn.dataset.doorpiStyled === 'true') return;
            btn.style.cssText = 'align-items:center;gap:11px;padding:11px 18px 11px 14px;' +
                'backdrop-filter:blur(20px);border-radius:12px;' +
                'color:rgba(255,255,255,0.88);font-family:Outfit,sans-serif;font-size:13px;' +
                'transition:background .15s,border-color .15s;outline:none;box-sizing:border-box;' +
                'z-index:2147483646;position:fixed;';
            btn.dataset.doorpiStyled = 'true';
        }}

        function anchorTo(target) {{
            const rect = target.getBoundingClientRect();
            if (rect.width <= 80 || rect.height <= 24) return false;
            applyButtonBase();
            btn.style.top = rect.top + 'px';
            btn.style.left = rect.left + 'px';
            btn.style.right = 'auto';
            btn.style.width = rect.width + 'px';
            btn.style.minHeight = rect.height + 'px';
            return true;
        }}

        function buildInitialBtn() {{
            if (btn) return;
            btn = document.createElement('button');
            btn.id = 'doorpi-ext-btn';
            btn.style.display = 'none';
            document.body.appendChild(btn);
        }}

        function ensureStoreCloseButton() {{
            let closeBtn = document.getElementById('doorpi-cws-close');
            closeBtn?.remove();
        }}

        function updateBtnContent(forceUpdate = false) {{
            if (!btn) return;
            const extId = getExtId();
            const isInstalled = extId !== null && _installedExtIds.has(extId);
            
            const currentState = extId + '_' + isInstalled;
            if (!forceUpdate && lastRenderedState === currentState) return; 
            lastRenderedState = currentState;

            btn.style.background = isInstalled ? 'rgba(15,60,35,0.88)' : 'rgba(8,8,24,0.88)';
            btn.style.border = isInstalled ? '1px solid rgba(60,200,100,0.35)' : '1px solid rgba(255,255,255,0.15)';
            btn.style.cursor = isInstalled ? 'default' : 'pointer';

            while (btn.firstChild) {{
                btn.removeChild(btn.firstChild);
            }}

            const titleSpan = Object.assign(document.createElement('span'), {{
                style: 'display:block;font-weight:700;font-size:13px;' +
                       (isInstalled ? 'color:rgba(120,230,160,0.92)' : 'color:rgba(255,255,255,0.92)'),
                textContent: isInstalled ? '{_extInstalledTitle}' : '{_extBtnTitle}'
            }});
            const subSpan = Object.assign(document.createElement('span'), {{
                style: 'display:block;font-size:11px;color:rgba(255,255,255,0.38);margin-top:2px',
                textContent: isInstalled ? '{_extInstalledSub}' : '{_extBtnSub}'
            }});

            const textWrap = document.createElement('span');
            textWrap.style.cssText = 'flex:1;text-align:left;line-height:1.35;pointer-events:none';
            textWrap.append(titleSpan, subSpan);
            btn.appendChild(textWrap);

            if (!isInstalled) {{
                btn.onclick = () => {{
                    window.chrome.webview.postMessage('auto_install_extension:' + location.href);
                    showConsoleToast('{_extToastTitle}', '{_extToastSub}');
                    setTimeout(() => window.chrome.webview.postMessage('close_app'), 1800);
                }};
            }} else {{
                btn.onclick = null;
            }}
        }}

        function checkState(forceUpdate = false) {{
            dismissChromePromos();
            ensureStoreCloseButton();
            if (!isDetailPage()) {{
                if (btn && btn.style.display !== 'none') btn.style.display = 'none';
                detailPageEnteredAt = 0;
                return;
            }}

            if (!detailPageEnteredAt) detailPageEnteredAt = Date.now();
            const target = findInstallButton();
            if (target) {{
                positionAnchored = anchorTo(target);
            }} else if (!positionAnchored && Date.now() - detailPageEnteredAt > 5000) {{
                applyButtonBase();
                btn.style.top = '50px';
                btn.style.right = '5vw';
                btn.style.left = 'auto';
                btn.style.width = '280px';
                positionAnchored = true;
            }}

            if (positionAnchored) {{
                if (btn.style.display !== 'flex') btn.style.display = 'flex';
                updateBtnContent(forceUpdate);
            }}
        }}

        buildInitialBtn();
        const obs = new MutationObserver(() => {{ checkState(false); }});
        obs.observe(document.body, {{ childList:true, subtree:true }});
        window.addEventListener('scroll', () => checkState(false), {{ passive:true }});
        window.addEventListener('resize', () => checkState(false));
        window.setInterval(() => {{
            if (location.hostname === 'chromewebstore.google.com') checkState(false);
        }}, 750);

        const origPush = history.pushState.bind(history);
        history.pushState = function() {{
            origPush.apply(this, arguments);
            positionAnchored = false;
            detailPageEnteredAt = 0;
            lastRenderedState = null;
            setTimeout(() => checkState(false), 150);
        }};
        window.addEventListener('popstate', () => {{
            positionAnchored = false;
            detailPageEnteredAt = 0;
            lastRenderedState = null;
            setTimeout(() => checkState(false), 150);
        }});

        window.__doorpiUpdateExtBtn = (force) => checkState(force);
    }}

    // ─────────────────────────────────────────────────────────────────────────
    // 6. VKB — VIRTUAL KEYBOARD
    // ─────────────────────────────────────────────────────────────────────────
    window._vkbIsOpen = false;
    const __doorpiUseNativeKeyboard = {(useNativeDoorpiKeyboard ? "true" : "false")};
    let _installedExtIds = new Set();
    function isInput(el) {{
        if (!el) return false;
        if (el.tagName === 'INPUT') {{
            const t = (el.type||'').toLowerCase();
            return['text','search','email','password','url','tel',''].includes(t) || isNumericInput(el);
        }}
        return el.tagName === 'TEXTAREA' || el.isContentEditable ||
               (el.tagName === 'DIV' && el.getAttribute('role') === 'textbox');
    }}
    function isNumericInput(el) {{
        if (!el || el.tagName !== 'INPUT') return false;
        const t = (el.type||'').toLowerCase();
        const mode = (el.getAttribute('inputmode')||'').toLowerCase();
        return t === 'number' || mode === 'numeric' || mode === 'decimal' || el.dataset?.vkbMode === 'numeric';
    }}
    function deepActiveElement(root = document) {{
        let active = root.activeElement;
        while (active && active.shadowRoot && active.shadowRoot.activeElement)
            active = active.shadowRoot.activeElement;
        return active;
    }}
    function inputFromEvent(e) {{
        const path = e.composedPath?.() || [];
        for (const item of path) {{
            if (isInput(item)) return item;
        }}
        return isInput(e.target) ? e.target : null;
    }}
    function eventPathHasClass(e, className) {{
        const path = e.composedPath?.() || [];
        return path.some(item => item?.classList?.contains?.(className));
    }}
    function _doorpiVkbOpenedByController() {{
        return Date.now() - (window.__doorpiVkbControllerIntentAt || 0) < 520;
    }}

    if (__doorpiUseNativeKeyboard) {{
        let _nativeVkbInputEl = null;
        let _nativeVkbSuppressUntil = 0;

        function _nativeSetCaretHidden(el, hidden) {{
            return;
        }}

        function _setNativeValue(el, val) {{
            const proto  = el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) setter.call(el, val); else el.value = val;
        }}

        function _nativeVkbPostOpen(el) {{
            if (Date.now() < _nativeVkbSuppressUntil) return;
            if (!isInput(el)) return;
            if (window._vkbIsOpen && _nativeVkbInputEl === el) return;
            if (_nativeVkbInputEl && _nativeVkbInputEl !== el) _nativeSetCaretHidden(_nativeVkbInputEl, false);
            _nativeVkbInputEl = el;
            _nativeSetCaretHidden(el, true);
            window._vkbIsOpen = true;
            const rect = el.getBoundingClientRect();
            const payload = {{
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                viewportHeight: window.innerHeight,
                numeric: isNumericInput(el)
            }};
            try {{ window.chrome.webview.postMessage('native_vkb_open:' + encodeURIComponent(JSON.stringify(payload))); }} catch(_) {{}}
        }}

        function _nativeVkbClose(notify = true, blurInput = true) {{
            _nativeVkbSuppressUntil = Date.now() + 650;
            const active = deepActiveElement();
            const currentInput = _nativeVkbInputEl || (isInput(active) ? active : null);
            window._vkbIsOpen = false;
            _nativeVkbInputEl = null;
            _nativeSetCaretHidden(currentInput, false);
            if (blurInput && currentInput) {{
                try {{ currentInput.blur(); }} catch(_) {{}}
                try {{ document.body?.focus?.({{ preventScroll: true }}); }} catch(_) {{}}
            }}
            if (notify) {{
                try {{ window.chrome.webview.postMessage('native_vkb_closed'); }} catch(_) {{}}
            }}
        }}

        function _nativeActiveInput() {{
            if (_nativeVkbInputEl && document.contains(_nativeVkbInputEl) && isInput(_nativeVkbInputEl))
                return _nativeVkbInputEl;
            const active = deepActiveElement();
            if (isInput(active)) {{
                _nativeVkbInputEl = active;
                return active;
            }}
            return null;
        }}

        function _nativeCursorPos(el) {{
            if (el.isContentEditable || el.tagName === 'DIV') return (el.textContent || '').length;
            let pos = null;
            try {{ pos = el.selectionStart; }} catch(_) {{}}
            return pos ?? (el.value || '').length;
        }}

        function _nativeInsert(text) {{
            const el = _nativeActiveInput();
            if (!el) return;
            el.focus({{ preventScroll: true }});
            const isEditable = el.isContentEditable || el.tagName === 'DIV';
            if (isEditable) {{
                const dt = new DataTransfer(); dt.setData('text/plain', text);
                const ev = new ClipboardEvent('paste', {{ clipboardData: dt, bubbles: true, cancelable: true, composed: true }});
                if (!el.dispatchEvent(ev)) document.execCommand('insertText', false, text);
                el.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
                return;
            }}

            const val = el.value || '';
            const start = _nativeCursorPos(el);
            let end = start;
            try {{ end = el.selectionEnd ?? start; }} catch(_) {{}}
            const maxLen = parseInt(el.getAttribute('maxlength') || '', 10);
            if (Number.isFinite(maxLen) && maxLen > 0 && val.length - (end - start) + text.length > maxLen) return;
            _setNativeValue(el, val.slice(0, start) + text + val.slice(end));
            try {{ el.setSelectionRange(start + text.length, start + text.length); }} catch(_) {{}}
            el.dispatchEvent(new Event('input',  {{ bubbles: true, composed: true }}));
            el.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
        }}

        function _nativeBackspace() {{
            const el = _nativeActiveInput();
            if (!el) return;
            el.focus({{ preventScroll: true }});
            const isEditable = el.isContentEditable || el.tagName === 'DIV';
            if (isEditable) {{
                document.execCommand('delete', false, null);
                el.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
                return;
            }}

            const val = el.value || '';
            const start = _nativeCursorPos(el);
            let end = start;
            try {{ end = el.selectionEnd ?? start; }} catch(_) {{}}
            if (start === 0 && end === 0) return;

            const removeStart = start === end ? Math.max(0, start - 1) : start;
            _setNativeValue(el, val.slice(0, removeStart) + val.slice(end));
            try {{ el.setSelectionRange(removeStart, removeStart); }} catch(_) {{}}
            el.dispatchEvent(new Event('input',  {{ bubbles: true, composed: true }}));
            el.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
        }}

        function _nativeMoveCursor(delta) {{
            const el = _nativeActiveInput();
            if (!el) return;
            el.focus({{ preventScroll: true }});
            if (el.isContentEditable || el.tagName === 'DIV') {{
                const key = delta < 0 ? 'ArrowLeft' : 'ArrowRight';
                const kc = delta < 0 ? 37 : 39;
                el.dispatchEvent(new KeyboardEvent('keydown', {{ bubbles: true, cancelable: true, key, keyCode: kc, which: kc, composed: true }}));
                el.dispatchEvent(new KeyboardEvent('keyup', {{ bubbles: true, key, keyCode: kc, which: kc, composed: true }}));
                return;
            }}

            const pos = Math.max(0, Math.min((el.value || '').length, _nativeCursorPos(el) + delta));
            try {{ el.setSelectionRange(pos, pos); }} catch(_) {{}}
        }}

        function _nativeEnter() {{
            const el = _nativeActiveInput();
            if (!el) return;
            el.focus({{ preventScroll: true }});
            const down = new KeyboardEvent('keydown', {{ bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13, composed: true }});
            const allowed = el.dispatchEvent(down);
            el.dispatchEvent(new KeyboardEvent('keypress', {{ bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13, composed: true }}));
            el.dispatchEvent(new KeyboardEvent('keyup', {{ bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13, composed: true }}));
            if (el.tagName === 'TEXTAREA' || el.isContentEditable) {{
                if (allowed) _nativeInsert('\n');
                return;
            }}
            const form = el.form || el.closest?.('form');
            if (allowed && form) {{
                if (typeof form.requestSubmit === 'function') form.requestSubmit();
                else form.submit?.();
            }}
        }}

        window.__doorpiNativeVkbKey = (key) => {{
            if (key === 'BKSP') _nativeBackspace();
            else if (key === 'ENTER') _nativeEnter();
            else if (key === 'CURSOR_LEFT') _nativeMoveCursor(-1);
            else if (key === 'CURSOR_RIGHT') _nativeMoveCursor(1);
            else if (key === 'SPACE') _nativeInsert(' ');
            else _nativeInsert(key);
        }};

        window.__doorpiNativeVkbClose = () => _nativeVkbClose(false, true);
        window.__doorpiVkbMove        = () => {{}};
        window.__doorpiVkbConfirm     = () => {{}};
        window.__doorpiVkbClose       = () => _nativeVkbClose(true, true);
        window.__doorpiVkbBackspace   = () => _nativeBackspace();
        window.__doorpiVkbSpace       = () => _nativeInsert(' ');
        window.__doorpiVkbCursorLeft  = () => _nativeMoveCursor(-1);
        window.__doorpiVkbCursorRight = () => _nativeMoveCursor(1);
        window.__doorpiVkbToggleShift = () => {{}};
        window.__doorpiSetInstalledExtensions = (exts) => {{
            _installedExtIds = new Set((exts || []).map(e => e.id));
            window.__doorpiUpdateExtBtn?.(true);
        }};

        document.addEventListener('focusin', e => {{
            if (Date.now() < _nativeVkbSuppressUntil) return;
            const el = inputFromEvent(e) || deepActiveElement();
            if (!isInput(el)) return;
            if (!_doorpiVkbOpenedByController()) {{
                setTimeout(() => {{
                    if (Date.now() >= _nativeVkbSuppressUntil &&
                        _doorpiVkbOpenedByController() &&
                        deepActiveElement() === el &&
                        !window._vkbIsOpen)
                        _nativeVkbPostOpen(el);
                }}, 80);
                return;
            }}
            setTimeout(() => {{ if (deepActiveElement() === el) _nativeVkbPostOpen(el); }}, 30);
        }}, true);

        document.addEventListener('mousedown', e => {{
            if (Date.now() < _nativeVkbSuppressUntil) return;
            const el = inputFromEvent(e);
            if (!_doorpiVkbOpenedByController()) {{
                if (el) setTimeout(() => {{
                    if (Date.now() >= _nativeVkbSuppressUntil &&
                        _doorpiVkbOpenedByController() &&
                        !window._vkbIsOpen)
                        _nativeVkbPostOpen(el);
                }}, 80);
                return;
            }}
            if (el) setTimeout(() => _nativeVkbPostOpen(el), 30);
        }}, true);

        document.addEventListener('click', e => {{
            if (window._vkbIsOpen && !inputFromEvent(e)) _nativeVkbClose(true, true);
        }}, true);

        (function init() {{
            if (!document.body) {{ setTimeout(init, 16); return; }}
            injectChromeWebStoreBtn();
        }})();

        return;
    }}

    // ── Estilos ───────────────────────────────────────────────────────────────
    (function injectVkbStyles() {{
        if (window.__doorpiVkbStylesInjected) return;
        window.__doorpiVkbStylesInjected = true;
        const css =[
            '.doorpi-vkb-overlay{{position:fixed;bottom:0;left:0;right:0;z-index:2147483647;',
            'padding:0 clamp(24px,4vw,80px) clamp(24px,3vh,48px);',
            'background:linear-gradient(to top,rgb(5 5 10/80%) 65%,rgb(5 5 10/80%) 85%,transparent 100%);',
            'transform:translateY(100%);transition:transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94);user-select:none;}}',
            '.doorpi-vkb-overlay.visible{{transform:translateY(0);}}',
            '.doorpi-vkb-preview-wrap{{display:flex;align-items:center;gap:12px;margin-bottom:clamp(12px,2vh,22px);padding:0 2px;}}',
            '.doorpi-vkb-preview-label{{font-size:clamp(10px,1.1vw,14px);font-weight:600;text-transform:uppercase;letter-spacing:0.09em;color:rgba(255,255,255,0.3);white-space:nowrap;flex-shrink:0;}}',
            '.doorpi-vkb-preview-text{{flex:1;font-size:clamp(16px,1.8vw,26px);font-weight:500;color:#fff;',
            'padding:clamp(7px,1vh,12px) clamp(12px,1.4vw,18px);background:rgba(255,255,255,0.06);',
            'border:1px solid rgba(255,255,255,0.12);border-radius:10px;min-height:clamp(38px,5vh,56px);',
            'display:flex;align-items:center;white-space:nowrap;overflow:hidden;}}',
            '.doorpi-vkb-cursor{{display:inline-block;width:2px;height:1.1em;background:rgba(255,255,255,0.9);',
            'margin-left:2px;vertical-align:middle;animation:doorpiVkbBlink 1s step-end infinite;}}',
            '@keyframes doorpiVkbBlink{{0%,100%{{opacity:1}}50%{{opacity:0}}}}',
            '.doorpi-vkb-grid{{display:grid;grid-template-columns:repeat(13,clamp(38px,3.25vw,74px));',
            'gap:clamp(4px,0.5vh,7px) clamp(4px,0.38vw,6px);width:fit-content;margin:0 auto;}}',
            '.doorpi-vkb-overlay.numeric .doorpi-vkb-grid{{grid-template-columns:repeat(3,clamp(64px,5.6vw,120px));}}',
            '.doorpi-vkb-overlay.numeric .doorpi-vkb-key{{width:clamp(64px,5.6vw,120px);height:clamp(54px,5.2vw,86px);font-size:clamp(18px,1.8vw,28px);font-weight:650;}}',
            '.doorpi-vkb-key{{width:100%;height:clamp(42px,3.8vw,75px);padding:0;position:relative;',
            'background:rgb(20 20 20);border:1px solid rgba(255,255,255,0.11);',
            'border-bottom:3px solid rgba(0,0,0,0.45);border-radius:clamp(7px,0.6vw,10px);',
            'color:rgba(255,255,255,0.88);font-size:clamp(13px,1.2vw,18px);font-weight:500;font-family:inherit;',
            'display:flex;align-items:center;justify-content:center;cursor:pointer;outline:none;',
            'min-width:0;box-sizing:border-box;',
            'transition:background 0.07s,transform 0.07s,border-color 0.07s,color 0.07s,box-shadow 0.07s;}}',
            '.doorpi-vkb-key:hover{{background:rgba(255,255,255,0.13);color:#fff;}}',
            '.doorpi-vkb-key.focused{{background:rgba(255,255,255,0.97);color:#080810;border-color:transparent;',
            'border-bottom-color:rgba(0,0,0,0.25);transform:scale(1.1) translateY(-3px);',
            'box-shadow:0 8px 24px rgba(0,0,0,0.55),0 0 0 2px rgba(255,255,255,0.35);z-index:1;position:relative;}}',
            '.doorpi-vkb-key:active{{transform:scale(0.96) translateY(0);box-shadow:none;}}',
            '.doorpi-vkb-key[data-controller-hint]::after{{content:attr(data-controller-hint);position:absolute;right:5px;top:4px;font-size:9px;font-weight:800;opacity:.55;}}',
            '.doorpi-vkb-key.accent-pending{{background:rgba(255,145,45,.4);border-color:rgba(255,175,85,.82);color:#fff;}}',
            '.doorpi-vkb-key[data-key=BKSP],.doorpi-vkb-key[data-key=ENTER],.doorpi-vkb-key[data-key=CANCEL],.doorpi-vkb-key[data-key=SHIFT],.doorpi-vkb-key[data-key=SYM],.doorpi-vkb-key[data-key=ABC],.doorpi-vkb-key[data-key$=com]{{grid-column:span 2;width:100%;}}',
            '.doorpi-vkb-key[data-key=SPACE]{{grid-column:span 7;height:clamp(52px,4.8vw,70px);',
            'font-size:clamp(12px,1.2vw,16px);letter-spacing:0.08em;color:rgba(255,255,255,0.45);width:100%;}}',
            '.doorpi-vkb-key[data-key=SPACE].focused{{color:rgba(0,0,0,0.65);}}',
            '.doorpi-vkb-key[data-key=CANCEL]{{height:clamp(52px,4.8vw,70px);',
            'color:rgba(255,255,255,0.6);font-size:clamp(12px,1.2vw,16px);font-weight:500;width:100%;}}',
            '.doorpi-vkb-key[data-key=ENTER]{{height:clamp(52px,4.8vw,70px);',
            'background:rgba(50,110,255,0.32);border-color:rgba(50,110,255,0.55);',
            'color:rgba(170,205,255,0.95);font-weight:650;font-size:clamp(12px,1.2vw,16px);width:100%;}}',
            '.doorpi-vkb-key[data-key=ENTER].focused{{background:rgb(50,110,255);color:#fff;border-color:transparent;',
            'box-shadow:0 8px 28px rgba(50,110,255,0.55),0 0 0 2px rgba(50,110,255,0.4);}}',
            '.doorpi-vkb-overlay.numeric .doorpi-vkb-key[data-key=ENTER],.doorpi-vkb-overlay.numeric .doorpi-vkb-key[data-key=BKSP]{{grid-column:span 1!important;width:clamp(64px,5.6vw,120px)!important;height:clamp(54px,5.2vw,86px)!important;}}',
            '.doorpi-vkb-overlay.numeric .doorpi-vkb-key[data-key=CANCEL]{{grid-column:span 3!important;width:100%!important;height:clamp(54px,5.2vw,86px)!important;}}',
            '.doorpi-vkb-key[data-key=SHIFT]{{font-size:clamp(15px,1.6vw,22px);}}',
            '.doorpi-vkb-key[data-key=SHIFT].shifted{{background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.3);color:#fff;}}',
            '.doorpi-vkb-overlay{{top:50%;left:50%;right:auto;bottom:auto;width:min(1080px,calc(100vw - 32px));',
            'padding:clamp(10px,1.2vh,16px);background:rgba(8,9,15,.96);border:1px solid rgba(255,255,255,.13);',
            'border-radius:clamp(14px,1.1vw,20px);box-shadow:0 28px 90px rgba(0,0,0,.72),0 0 0 1px rgba(255,255,255,.04) inset;',
            'backdrop-filter:blur(22px) saturate(1.25);opacity:0;transform:translate(-50%,10px) scale(.985);transition:opacity .16s ease,transform .16s ease;}}',
            '.doorpi-vkb-overlay.visible{{opacity:1;transform:translate(-50%,0) scale(1);}}',
            '.doorpi-vkb-preview-wrap{{gap:clamp(8px,.8vw,14px);margin-bottom:clamp(8px,1vh,14px);}}',
            '.doorpi-vkb-preview-label{{font-size:clamp(9px,.72vw,12px);}}',
            '.doorpi-vkb-preview-text{{font-size:clamp(14px,1.05vw,20px);padding:clamp(7px,.8vh,10px) clamp(10px,1vw,16px);min-height:clamp(34px,4vh,48px);}}',
            '.doorpi-vkb-grid{{display:grid;grid-template-columns:repeat(13,minmax(0,1fr));gap:clamp(5px,.55vh,8px) clamp(5px,.45vw,8px);width:auto;margin:0;}}',
            '.doorpi-vkb-key{{height:clamp(36px,3.2vw,58px);border-bottom-width:2px;font-size:clamp(12px,.95vw,17px);}}',
            '.doorpi-vkb-key.focused{{transform:scale(1.06) translateY(-2px);}}',
            '.doorpi-vkb-key[data-controller-hint]::after{{top:4px;right:5px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:rgba(255,255,255,.12);font-size:8px;display:flex;align-items:center;justify-content:center;}}',
            '.doorpi-vkb-key[data-key=SPACE]{{height:clamp(42px,3.6vw,62px);font-size:clamp(11px,.82vw,14px);}}',
            '.doorpi-vkb-key[data-key=CANCEL],.doorpi-vkb-key[data-key=ENTER],.doorpi-vkb-key[data-key=BKSP],.doorpi-vkb-key[data-key=SHIFT]{{font-size:clamp(11px,.85vw,15px);}}',
            '.doorpi-vkb-overlay.numeric{{width:min(360px,calc(100vw - 32px))!important;}}',
            '.doorpi-vkb-overlay.numeric .doorpi-vkb-grid{{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;}}',
            '.doorpi-vkb-overlay.numeric .doorpi-vkb-key{{min-width:0;height:clamp(44px,4.2vw,68px);font-size:clamp(16px,1.3vw,24px);font-weight:650;}}'
        ].join('');
        try {{ const sh = new CSSStyleSheet(); sh.replaceSync(css); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh]; }}
        catch(e) {{ const s = document.createElement('style'); s.id = 'doorpi-vkb-style'; s.textContent = css; document.head.appendChild(s); }}
    }})();

    // ── Layout das teclas ─────────────────────────────────────────────────────
    const KEY_ROWS = [
        ['1','2','3','4','5','6','7','8','9','0','-','BKSP'],
        ['q','w','e','r','t','y','u','i','o','p','´','ENTER'],
        ['a','s','d','f','g','h','j','k','l','ç','~','CANCEL'],
        ['SHIFT','z','x','c','v','b','n','m',',','.','^','?'],
        ['SYM','CURSOR_LEFT','SPACE','CURSOR_RIGHT','.com']
    ];
    const SPECIAL_KEY_ROWS = [
        ['!','@','#','$','%','&','*','(',')','_','+','BKSP'],
        ['/','\\','|','=','÷','×','{{','}}','[',']','`','ENTER'],
        [':',';','QUOTE','APOSTROPHE','€','£','¥','©','®','°','¨','CANCEL'],
        ['SHIFT','<','>','¿','¡','~','´','^',',','.','?','-'],
        ['ABC','CURSOR_LEFT','SPACE','CURSOR_RIGHT','.com']
    ];
    const NUMERIC_KEY_ROWS = [['1','2','3'],['4','5','6'],['7','8','9'],['BKSP','0','ENTER'],['CANCEL']];
    const FLAT_KEYS  = KEY_ROWS.flat();
    const BOTTOM_KEYS = ['SYM','ABC','CURSOR_LEFT','SPACE','CURSOR_RIGHT','.com'];
    const LABELS = {{ BKSP:'Apagar', ENTER:'Enter', CANCEL:'Fechar', SHIFT:'Maiúsc', SYM:'&123', ABC:'ABC', CURSOR_LEFT:'←', CURSOR_RIGHT:'→', SPACE:'Espaço', QUOTE:String.fromCharCode(34), APOSTROPHE:String.fromCharCode(39) }};
    const CONTROLLER_HINTS = {{ BKSP:'X', ENTER:'START', CANCEL:'B', SHIFT:'L3', SYM:'LT', ABC:'LT', CURSOR_LEFT:'LB', CURSOR_RIGHT:'RB', SPACE:'Y' }};

    // ── Estado ────────────────────────────────────────────────────────────────
    let _vkbEl        = null;
    let _vkbShifted   = true;
    let _vkbInputEl   = null;
    let _vkbCursorPos = 0;
    let _vkbFocusKey  = 'q';
    let _vkbClosing   = false;
    let _vkbMode      = 'text';
    let _vkbPendingAccent = null;

    // ── Construção do DOM ─────────────────────────────────────────────────────
    function _vkbBuild() {{
        if (_vkbEl) return;
        _vkbEl = document.createElement('div');
        _vkbEl.className = 'doorpi-vkb-overlay';
        _vkbEl.style.display = 'none';

        const wrap = document.createElement('div'); wrap.className = 'doorpi-vkb-preview-wrap';
        wrap.append(
            Object.assign(document.createElement('span'), {{ className:'doorpi-vkb-preview-label', textContent:'Digitando' }}),
            Object.assign(document.createElement('div'),  {{ className:'doorpi-vkb-preview-text', id:'doorpi-vkb-preview' }})
        );

        const grid = document.createElement('div'); grid.className = 'doorpi-vkb-grid';
        FLAT_KEYS.forEach(k => {{
            const btn = document.createElement('button');
            btn.className = 'doorpi-vkb-key';
            btn.dataset.key = k; btn.tabIndex = -1;
            btn.textContent = LABELS[k] || k;
            if (CONTROLLER_HINTS[k]) btn.dataset.controllerHint = CONTROLLER_HINTS[k];
            if (k.length > 1 && !Object.prototype.hasOwnProperty.call(LABELS, k))
                btn.style.fontSize = 'clamp(11px,1vw,15px)';
            btn.addEventListener('pointerdown', e => {{ e.preventDefault(); if (_vkbFocusKey === null) return; _vkbPressKey(k); }});
            grid.appendChild(btn);
        }});

        _vkbEl.append(wrap, grid);
        document.body.appendChild(_vkbEl);
    }}

    function _vkbRenderKeys(mode) {{
        _vkbMode = mode === 'numeric' ? 'numeric' : mode === 'special' ? 'special' : 'text';
        if (!_vkbEl) return;
        _vkbEl.classList.toggle('numeric', _vkbMode === 'numeric');
        const grid = _vkbEl.querySelector('.doorpi-vkb-grid');
        if (!grid) return;
        const rows = _vkbMode === 'numeric' ? NUMERIC_KEY_ROWS : _vkbMode === 'special' ? SPECIAL_KEY_ROWS : KEY_ROWS;
        while (grid.firstChild) grid.removeChild(grid.firstChild);
        rows.flat().forEach(k => {{
            const btn = document.createElement('button');
            btn.className = 'doorpi-vkb-key';
            btn.dataset.key = k; btn.tabIndex = -1;
            btn.textContent = LABELS[k] || k;
            if (CONTROLLER_HINTS[k]) btn.dataset.controllerHint = CONTROLLER_HINTS[k];
            if (k.length > 1 && !Object.prototype.hasOwnProperty.call(LABELS, k))
                btn.style.fontSize = 'clamp(11px,1vw,15px)';
            btn.addEventListener('pointerdown', e => {{ e.preventDefault(); if (_vkbFocusKey === null) return; _vkbPressKey(k); }});
            grid.appendChild(btn);
        }});
    }}

    // ── Helpers ───────────────────────────────────────────────────────────────
    function _setNativeValue(el, val) {{
        const proto  = el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, val); else el.value = val;
    }}

    function _vkbRenderPreview() {{
        const el = document.getElementById('doorpi-vkb-preview');
        if (!el || !_vkbInputEl) return;
        const isPassword = _vkbInputEl.type === 'password';
        const isEditable = _vkbInputEl.isContentEditable || _vkbInputEl.tagName === 'DIV';
        let txt = isEditable ? (_vkbInputEl.textContent||'') : (_vkbInputEl.value||'');
        if (isPassword) txt = '•'.repeat(txt.length);
        const pos = Math.min(_vkbCursorPos, txt.length);
        el.textContent = '';
        const cur = document.createElement('span'); cur.className = 'doorpi-vkb-cursor';
        el.append(
            document.createTextNode(txt.slice(0, pos).replace(/ /g,'\u00A0')),
            cur,
            document.createTextNode(txt.slice(pos).replace(/ /g,'\u00A0'))
        );
    }}

    function _vkbPosition() {{
        if (!_vkbEl || !_vkbInputEl || _vkbEl.style.display === 'none') return;
        let rect;
        try {{ rect = _vkbInputEl.getBoundingClientRect(); }} catch(e) {{ rect = null; }}
        if (!rect) return;
        const margin = 14;
        const numeric = _vkbMode === 'numeric';
        const width = numeric
            ? Math.min(360, Math.max(280, window.innerWidth - 32))
            : Math.min(window.innerWidth - 32, Math.max(620, Math.min(1080, window.innerWidth * 0.72)));
        _vkbEl.style.width = Math.round(width) + 'px';
        const measured = _vkbEl.getBoundingClientRect();
        const height = measured.height || 300;
        const center = Math.max(16 + width / 2, Math.min(window.innerWidth - 16 - width / 2, rect.left + rect.width / 2));
        const above = rect.top - height - margin;
        const below = rect.bottom + margin;
        const top = above >= 12 ? above : Math.min(Math.max(12, below), Math.max(12, window.innerHeight - height - 12));
        _vkbEl.style.left = Math.round(center) + 'px';
        _vkbEl.style.top = Math.round(top) + 'px';
    }}

    function _vkbSetShift(on) {{
        _vkbShifted = on;
        _vkbEl?.querySelector('[data-key=SHIFT]')?.classList.toggle('shifted', on);
        _vkbEl?.querySelectorAll('.doorpi-vkb-key').forEach(k => {{
            const key = k.dataset.key;
            if (key?.length === 1 && /[a-zç]/i.test(key)) k.textContent = on ? key.toUpperCase() : key.toLowerCase();
        }});
    }}

    function _vkbSetFocus(key) {{
        _vkbFocusKey = key;
        _vkbEl?.querySelectorAll('.doorpi-vkb-key').forEach(k =>
            k.classList.toggle('focused', k.dataset.key === key));
    }}

    function _vkbMoveFocusInternal(dir) {{
        if (!_vkbFocusKey) {{ _vkbSetFocus(_vkbMode === 'numeric' ? '1' : 'q'); return; }}
        const rows = _vkbMode === 'numeric' ? NUMERIC_KEY_ROWS : _vkbMode === 'special' ? SPECIAL_KEY_ROWS : KEY_ROWS;
        const bottomKeys = _vkbMode === 'numeric' ? ['CANCEL'] : BOTTOM_KEYS;
        const keySpan = (key) => {{
            if (_vkbMode === 'numeric') return 1;
            if (key === 'SPACE') return 7;
            if (['BKSP','ENTER','CANCEL','SHIFT','SYM','ABC','CURSOR_LEFT','CURSOR_RIGHT','.com'].includes(key)) return 2;
            return 1;
        }};
        const rowLayout = (row) => {{
            let col = 0;
            return row.map(key => {{
                const span = keySpan(key);
                const item = {{ key, start: col, center: col + span / 2, span }};
                col += span;
                return item;
            }});
        }};
        const nearestByCenter = (row, center) => {{
            const layout = rowLayout(row);
            let best = layout[0];
            for (const item of layout) {{
                if (Math.abs(item.center - center) < Math.abs(best.center - center))
                    best = item;
            }}
            return best.key;
        }};
        let rIdx = 0, cIdx = 0, found = false;
        for (let r = 0; r < rows.length && !found; r++)
            for (let c = 0; c < rows[r].length && !found; c++)
                if (rows[r][c] === _vkbFocusKey) {{ rIdx = r; cIdx = c; found = true; }}

        if (bottomKeys.includes(_vkbFocusKey) && (dir === 'LEFT' || dir === 'RIGHT')) {{
            const order = _vkbMode === 'numeric' ? ['CANCEL'] : BOTTOM_KEYS;
            const next  = order.indexOf(_vkbFocusKey) + (dir === 'RIGHT' ? 1 : -1);
            if (next >= 0 && next < order.length) _vkbSetFocus(order[next]);
            return;
        }}
        if (dir === 'UP' || dir === 'DOWN') {{
            const current = rowLayout(rows[rIdx]).find(item => item.key === _vkbFocusKey);
            rIdx = dir === 'UP' ? (rIdx - 1 + rows.length) % rows.length : (rIdx + 1) % rows.length;
            _vkbSetFocus(nearestByCenter(rows[rIdx], current?.center ?? cIdx + 0.5));
            return;
        }}
        if (dir === 'LEFT')  cIdx = (cIdx - 1 + rows[rIdx].length) % rows[rIdx].length;
        if (dir === 'RIGHT') cIdx = (cIdx + 1) % rows[rIdx].length;
        cIdx = Math.min(cIdx, rows[rIdx].length - 1);
        _vkbSetFocus(rows[rIdx][cIdx]);
    }}

    function _vkbInsert(char) {{
        if (!_vkbInputEl) return;
        const isEditable = _vkbInputEl.isContentEditable || _vkbInputEl.tagName === 'DIV';
        _vkbInputEl.focus();
        if (isEditable) {{
            const dt = new DataTransfer(); dt.setData('text/plain', char);
            const ev = new ClipboardEvent('paste', {{ clipboardData:dt, bubbles:true, cancelable:true, composed:true }});
            if (!_vkbInputEl.dispatchEvent(ev)) document.execCommand('insertText', false, char);
            _vkbInputEl.dispatchEvent(new Event('input', {{ bubbles:true, composed:true }}));
            _vkbCursorPos += char.length;
        }} else {{
            const val = _vkbInputEl.value || '';
            const maxLen = parseInt(_vkbInputEl.getAttribute('maxlength') || '', 10);
            if (Number.isFinite(maxLen) && maxLen > 0 && val.length + char.length > maxLen) return;
            _setNativeValue(_vkbInputEl, val.slice(0, _vkbCursorPos) + char + val.slice(_vkbCursorPos));
            _vkbCursorPos += char.length;
            _vkbInputEl.dispatchEvent(new Event('input',  {{ bubbles:true, composed:true }}));
            _vkbInputEl.dispatchEvent(new Event('change', {{ bubbles:true, composed:true }}));
        }}
    }}

    function _vkbDeleteChar() {{
        if (!_vkbInputEl) return;
        const isEditable = _vkbInputEl.isContentEditable || _vkbInputEl.tagName === 'DIV';
        _vkbInputEl.focus();
        if (isEditable) {{
            document.execCommand('delete', false, null);
            _vkbInputEl.dispatchEvent(new Event('input', {{ bubbles:true, composed:true }}));
            _vkbCursorPos = Math.max(0, (_vkbInputEl.textContent||'').length);
        }} else if (_vkbCursorPos > 0) {{
            const val = _vkbInputEl.value || '';
            _setNativeValue(_vkbInputEl, val.slice(0, _vkbCursorPos - 1) + val.slice(_vkbCursorPos));
            _vkbCursorPos--;
            _vkbInputEl.dispatchEvent(new Event('input',  {{ bubbles:true, composed:true }}));
            _vkbInputEl.dispatchEvent(new Event('change', {{ bubbles:true, composed:true }}));
        }}
    }}

    function _vkbMoveCursorInField(delta) {{
        if (!_vkbInputEl) return;
        const isEditable = _vkbInputEl.isContentEditable || _vkbInputEl.tagName === 'DIV';
        _vkbInputEl.focus();
        if (isEditable) {{
            const key = delta < 0 ? 'ArrowLeft' : 'ArrowRight', kc = delta < 0 ? 37 : 39;
            _vkbInputEl.dispatchEvent(new KeyboardEvent('keydown', {{ bubbles:true, cancelable:true, key, keyCode:kc, which:kc, composed:true }}));
            setTimeout(() => _vkbInputEl?.dispatchEvent(new KeyboardEvent('keyup', {{ bubbles:true, key, keyCode:kc, composed:true }})), 20);
        }} else {{
            _vkbCursorPos = Math.max(0, Math.min((_vkbInputEl.value||'').length, _vkbCursorPos + delta));
            try {{ _vkbInputEl.setSelectionRange(_vkbCursorPos, _vkbCursorPos); }} catch(e) {{}}
        }}
        _vkbRenderPreview();
    }}

    function _vkbPressKey(key) {{
        if (!_vkbInputEl) return;
        if (_vkbMode === 'numeric' && !/^\d$/.test(key) && !['BKSP','ENTER','CANCEL'].includes(key)) return;
        if (key === 'QUOTE') key = String.fromCharCode(34);
        else if (key === 'APOSTROPHE') key = String.fromCharCode(39);
        const accents = {{ '´':'\u0301', '~':'\u0303', '^':'\u0302', '`':'\u0300', '¨':'\u0308' }};
        const flushAccent = () => {{ if (_vkbPendingAccent) _vkbInsert(_vkbPendingAccent); _vkbPendingAccent = null; }};
        if (Object.prototype.hasOwnProperty.call(accents, key)) {{
            if (_vkbPendingAccent === key) {{ _vkbInsert(key); _vkbPendingAccent = null; }}
            else {{ flushAccent(); _vkbPendingAccent = key; }}
            _vkbEl?.querySelectorAll('.doorpi-vkb-key').forEach(el => el.classList.toggle('accent-pending', el.dataset.key === _vkbPendingAccent));
            _vkbRenderPreview();
            return;
        }}
        if (key === 'BKSP') {{ if (_vkbPendingAccent) _vkbPendingAccent = null; else _vkbDeleteChar(); }}
        else if (key === 'SHIFT') _vkbSetShift(!_vkbShifted);
        else if (key === 'SYM') {{ _vkbRenderKeys('special'); _vkbSetFocus('!'); _vkbRenderPreview(); return; }}
        else if (key === 'ABC') {{ _vkbRenderKeys('text'); _vkbSetShift(_vkbShifted); _vkbSetFocus('q'); _vkbRenderPreview(); return; }}
        else if (key === 'CURSOR_LEFT') {{ flushAccent(); _vkbMoveCursorInField(-1); return; }}
        else if (key === 'CURSOR_RIGHT') {{ flushAccent(); _vkbMoveCursorInField(1); return; }}
        else if (key === 'SPACE') {{ if (_vkbPendingAccent) flushAccent(); else _vkbInsert(' '); }}
        else if (key === 'ENTER') {{ flushAccent(); _vkbSubmit(); return; }}
        else if (key === 'CANCEL') {{ _vkbPendingAccent = null; _vkbClose(); return; }}
        else {{
            let value = key;
            if (key.length === 1 && /[a-zç]/i.test(key)) {{
                value = _vkbShifted ? key.toUpperCase() : key.toLowerCase();
                if (_vkbPendingAccent) {{
                    const composed = (value + accents[_vkbPendingAccent]).normalize('NFC');
                    if (composed.length === 1) value = composed;
                    else {{ _vkbInsert(_vkbPendingAccent); }}
                    _vkbPendingAccent = null;
                }}
                _vkbInsert(value);
                if (_vkbShifted) _vkbSetShift(false);
            }} else {{ flushAccent(); _vkbInsert(value); }}
        }}
        _vkbEl?.querySelectorAll('.doorpi-vkb-key').forEach(el => el.classList.remove('accent-pending'));
        _vkbRenderPreview();
    }}

    function _vkbSubmit() {{
        const el = _vkbInputEl;
        if (!el) return;
        el.focus();
        const down = new KeyboardEvent('keydown', {{ bubbles:true, cancelable:true, key:'Enter', code:'Enter', keyCode:13, which:13, composed:true }});
        const allowed = el.dispatchEvent(down);
        el.dispatchEvent(new KeyboardEvent('keypress', {{ bubbles:true, cancelable:true, key:'Enter', code:'Enter', keyCode:13, which:13, composed:true }}));
        el.dispatchEvent(new KeyboardEvent('keyup', {{ bubbles:true, key:'Enter', code:'Enter', keyCode:13, which:13, composed:true }}));
        if (allowed && (el.tagName === 'TEXTAREA' || el.isContentEditable)) _vkbInsert('\n');
        else if (allowed) {{
            const form = el.form || el.closest?.('form');
            if (form) typeof form.requestSubmit === 'function' ? form.requestSubmit() : form.submit?.();
        }}
        _vkbRenderPreview();
    }}

    function _vkbOpen(targetEl) {{
        if (_vkbClosing) return;
        if (window._vkbIsOpen && _vkbInputEl === targetEl) return;
        _vkbPendingAccent = null;

        if (window._vkbIsOpen && _vkbInputEl && _vkbInputEl !== targetEl) {{
            _vkbInputEl.removeEventListener('input', _vkbRenderPreview);
            _vkbInputEl = targetEl;
            _vkbRenderKeys(isNumericInput(targetEl) ? 'numeric' : 'text');
            _vkbSetFocus(_vkbMode === 'numeric' ? '1' : 'q');
            const isEditable = targetEl.isContentEditable || targetEl.tagName === 'DIV';
            let sel = null; try {{ sel = targetEl.selectionStart; }} catch(e) {{}}
            _vkbCursorPos = isEditable ? (targetEl.textContent||'').length : (sel ?? (targetEl.value||'').length);
            _vkbInputEl.addEventListener('input', _vkbRenderPreview);
            _vkbRenderPreview();
            _vkbPosition();
            return;
        }}

        _vkbInputEl   = targetEl;
        const isEditable = targetEl.isContentEditable || targetEl.tagName === 'DIV';
        let sel = null; try {{ sel = targetEl.selectionStart; }} catch(e) {{}}
        _vkbCursorPos = isEditable ? (targetEl.textContent||'').length : (sel ?? (targetEl.value||'').length);

        _vkbBuild();
        _vkbRenderKeys(isNumericInput(targetEl) ? 'numeric' : 'text');
        _vkbEl.style.display = 'block';
        if (_vkbMode === 'text') _vkbSetShift(_vkbShifted);
        _vkbRenderPreview();
        _vkbInputEl.addEventListener('input', _vkbRenderPreview);
        _vkbPosition();

        requestAnimationFrame(() => {{
            _vkbPosition();
            _vkbEl.classList.add('visible');
            window._vkbIsOpen = true;
            _vkbSetFocus(_vkbMode === 'numeric' ? '1' : 'q');
            try {{ window.chrome.webview.postMessage('vkb_opened'); }} catch(_) {{}}
        }});
    }}

    function _vkbClose() {{
        if (!_vkbEl || !window._vkbIsOpen) return;
        _vkbPendingAccent = null;
        _vkbClosing = true;
        window._vkbIsOpen = false;
        _vkbEl.classList.remove('visible');
        try {{ window.chrome.webview.postMessage('vkb_closed'); }} catch(_) {{}}

        if (_vkbInputEl) {{
            _vkbInputEl.removeEventListener('input', _vkbRenderPreview);
            _vkbInputEl = null; 
        }}
        setTimeout(() => {{
            if (_vkbEl && !_vkbEl.classList.contains('visible')) _vkbEl.style.display = 'none';
            _vkbClosing = false;
        }}, 400);
    }}

    window.__doorpiSetInstalledExtensions = (exts) => {{
        _installedExtIds = new Set((exts || []).map(e => e.id));
        window.__doorpiUpdateExtBtn?.(true);
    }};
    window.__doorpiVkbMove        = (dir) => _vkbMoveFocusInternal(dir);
    window.__doorpiVkbConfirm     = ()    => {{ if (_vkbFocusKey) _vkbPressKey(_vkbFocusKey); }};
    window.__doorpiVkbClose       = ()    => _vkbClose();
    window.__doorpiVkbBackspace   = ()    => {{ _vkbDeleteChar(); _vkbRenderPreview(); }};
    window.__doorpiVkbSpace       = ()    => {{ _vkbInsert(' '); _vkbRenderPreview(); }};
    window.__doorpiVkbCursorLeft  = ()    => _vkbMoveCursorInField(-1);
    window.__doorpiVkbCursorRight = ()    => _vkbMoveCursorInField(1);
    window.__doorpiVkbToggleShift = ()    => _vkbSetShift(!_vkbShifted);
    window.__doorpiVkbToggleLayer = ()    => _vkbPressKey(_vkbMode === 'special' ? 'ABC' : 'SYM');
    window.__doorpiVkbEnter       = ()    => _vkbPressKey('ENTER');
    window.addEventListener('resize', () => {{ if (window._vkbIsOpen) _vkbPosition(); }});

// DEPOIS
    document.addEventListener('focusin', e => {{
        if (_vkbClosing) return;
        const el = inputFromEvent(e) || deepActiveElement();
        if (!isInput(el)) return;
        if (!_doorpiVkbOpenedByController()) {{
            setTimeout(() => {{
                if (!_vkbClosing && _doorpiVkbOpenedByController() && deepActiveElement() === el && !window._vkbIsOpen)
                    _vkbOpen(el);
            }}, 80);
            return;
        }}
        if (!window._vkbIsOpen) {{
            setTimeout(() => {{ if (!_vkbClosing && deepActiveElement() === el) _vkbOpen(el); }}, 50);
        }} else if (el !== _vkbInputEl) {{
            // Segue o foco quando pula entre inputs (ex: campos OTP que avançam sozinhos)
            _vkbOpen(el);
        }}
    }}, true);

    document.addEventListener('mousedown', e => {{
        if (eventPathHasClass(e, 'doorpi-vkb-overlay')) {{ e.preventDefault(); return; }}
        if (!_doorpiVkbOpenedByController()) return;
        const el = inputFromEvent(e);
        if (el && !window._vkbIsOpen && !_vkbClosing) _vkbOpen(el);
    }}, true);

    document.addEventListener('click', e => {{
        if (window._vkbIsOpen && !inputFromEvent(e) && !eventPathHasClass(e, 'doorpi-vkb-overlay'))
            _vkbClose();
    }}, true);

    (function init() {{
        if (!document.body) {{ setTimeout(init, 16); return; }}
        injectChromeWebStoreBtn();
    }})();

}})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private Grid BuildWebAppLoadingHost(WebView2 browser, string appName, string logoImg)
        {
            var host = new Grid
            {
                Background = Brushes.Black,
                ClipToBounds = true
            };

            host.Children.Add(browser);

            _webAppLoadingOverlay = BuildWebAppLoadingOverlay(appName, logoImg);
            Panel.SetZIndex(_webAppLoadingOverlay, 10);
            host.Children.Add(_webAppLoadingOverlay);
            AttachWebAppCloseHoldOverlay(host);
            _webAppLoadingActive = true;
            _webAppLoadingReleaseStarted = false;
            _webAppLoadingStartedAtUtc = DateTime.UtcNow;

            return host;
        }

        private void AttachWebAppCloseHoldOverlay(Panel host)
        {
            try
            {
                if (_webAppCloseHoldPopup != null)
                    _webAppCloseHoldPopup.IsOpen = false;
            }
            catch { }

            _webAppCloseHoldPlacementTarget = host;
            _webAppCloseHoldOverlay = BuildWebAppCloseHoldOverlay();
            _webAppCloseHoldOverlay.Margin = new Thickness(0);
            _webAppCloseHoldPopup = new Popup
            {
                PlacementTarget = host,
                Placement = PlacementMode.Relative,
                StaysOpen = true,
                AllowsTransparency = true,
                IsHitTestVisible = false,
                Child = _webAppCloseHoldOverlay
            };
        }

        private Grid BuildWebAppCloseHoldOverlay()
        {
            var root = new Grid
            {
                Width = 132,
                Height = 132,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Bottom,
                Margin = new Thickness(0, 0, 0, 54),
                Visibility = Visibility.Collapsed,
                Opacity = 0,
                IsHitTestVisible = false
            };

            var back = BuildProgressArcPath(108, 5, 1.0, new SolidColorBrush(Color.FromArgb(45, 255, 255, 255)));
            root.Children.Add(back);

            _webAppCloseHoldProgressArc = BuildProgressArcPath(108, 5, 0.001, new SolidColorBrush(Color.FromRgb(44, 174, 255)));
            root.Children.Add(_webAppCloseHoldProgressArc);

            root.Children.Add(new TextBlock
            {
                Text = GetWebAppCloseHoldLabel(),
                Foreground = new SolidColorBrush(Color.FromArgb(235, 255, 255, 255)),
                FontSize = 17,
                FontWeight = FontWeights.SemiBold,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                TextAlignment = TextAlignment.Center
            });

            return root;
        }

        private static string GetWebAppCloseHoldLabel()
        {
            var lang = System.Globalization.CultureInfo.CurrentUICulture.Name;
            return lang.StartsWith("pt", StringComparison.OrdinalIgnoreCase) ? "Encerrar" : "Close";
        }

        private string WebAppTutorialDoneFile
        {
            get
            {
                string root = !string.IsNullOrWhiteSpace(currentUserDataFolder)
                    ? currentUserDataFolder
                    : dataFolder;
                return Path.Combine(root, "webapp-tutorial.done");
            }
        }

        private static bool IsPortugueseUi()
            => System.Globalization.CultureInfo.CurrentUICulture.Name.StartsWith("pt", StringComparison.OrdinalIgnoreCase);

        private bool ShouldShowWebAppTutorial()
        {
            try { return !File.Exists(WebAppTutorialDoneFile); }
            catch { return true; }
        }

        private void MarkWebAppTutorialDone()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(WebAppTutorialDoneFile) ?? dataFolder);
                File.WriteAllText(WebAppTutorialDoneFile, DateTime.UtcNow.ToString("O"));
            }
            catch { }
        }

        private void TryShowWebAppTutorial()
        {
            if (_webAppTutorialOpen || !ShouldShowWebAppTutorial()) return;

            FrameworkElement? host = _webAppWindow?.Content as FrameworkElement;
            if (host == null && _ytWebView?.Parent is FrameworkElement parent)
                host = parent;
            if (host == null) return;

            try
            {
                _webAppTutorialWindow?.Close();
            }
            catch { }

            _webAppTutorialOverlay = BuildWebAppTutorialOverlay();
            _webAppTutorialPlacementTarget = host;
            host.SizeChanged += OnWebAppTutorialPlacementTargetSizeChanged;
            if (_webAppWindow != null)
            {
                _webAppWindow.LocationChanged += OnWebAppTutorialHostChanged;
                _webAppWindow.SizeChanged += OnWebAppTutorialPlacementTargetSizeChanged;
                _webAppWindow.StateChanged += OnWebAppTutorialHostChanged;
            }

            _webAppTutorialWindow = new Window
            {
                WindowStyle = WindowStyle.None,
                ResizeMode = ResizeMode.NoResize,
                ShowInTaskbar = false,
                AllowsTransparency = true,
                Background = Brushes.Transparent,
                WindowStartupLocation = WindowStartupLocation.Manual,
                ShowActivated = true,
                Topmost = _webAppWindow?.Topmost ?? false,
                Owner = _webAppWindow ?? this,
                Content = _webAppTutorialOverlay
            };
            SyncWebAppTutorialOverlaySize();
            _webAppTutorialWindow.Show();
            _webAppTutorialOpen = true;
            _webAppTutorialOverlay.Focus();
            Dispatcher.InvokeAsync(SyncWebAppTutorialOverlaySize);
        }

        private void OnWebAppTutorialHostChanged(object? sender, EventArgs e)
            => SyncWebAppTutorialOverlaySize();

        private void OnWebAppTutorialPlacementTargetSizeChanged(object sender, SizeChangedEventArgs e)
            => SyncWebAppTutorialOverlaySize();

        private void SyncWebAppTutorialOverlaySize()
        {
            if (_webAppTutorialOverlay == null) return;
            double width = Math.Max(_webAppTutorialPlacementTarget?.ActualWidth ?? 0, _webAppWindow?.ActualWidth ?? 0);
            double height = Math.Max(_webAppTutorialPlacementTarget?.ActualHeight ?? 0, _webAppWindow?.ActualHeight ?? 0);
            if (_webAppWindow?.WindowState == WindowState.Maximized)
            {
                width = Math.Max(width, SystemParameters.PrimaryScreenWidth);
                height = Math.Max(height, SystemParameters.PrimaryScreenHeight);
            }
            if (width <= 0) width = SystemParameters.PrimaryScreenWidth;
            if (height <= 0) height = SystemParameters.PrimaryScreenHeight;
            if (width > 0) _webAppTutorialOverlay.Width = width;
            if (height > 0) _webAppTutorialOverlay.Height = height;
            if (_webAppTutorialWindow != null)
            {
                _webAppTutorialWindow.WindowState = WindowState.Normal;
                _webAppTutorialWindow.Left = _webAppWindow?.Left ?? 0;
                _webAppTutorialWindow.Top = _webAppWindow?.Top ?? 0;
                _webAppTutorialWindow.Width = width;
                _webAppTutorialWindow.Height = height;
            }
        }

        private void DismissWebAppTutorial()
        {
            var overlay = _webAppTutorialOverlay;
            if (overlay == null)
            {
                _webAppTutorialOpen = false;
                return;
            }

            MarkWebAppTutorialDone();
            _webAppTutorialOpen = false;

            var fade = new DoubleAnimation
            {
                To = 0,
                Duration = TimeSpan.FromMilliseconds(180),
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
            };
            fade.Completed += (_, _) =>
            {
                if (_webAppTutorialPlacementTarget != null)
                    _webAppTutorialPlacementTarget.SizeChanged -= OnWebAppTutorialPlacementTargetSizeChanged;
                if (_webAppWindow != null)
                {
                    _webAppWindow.LocationChanged -= OnWebAppTutorialHostChanged;
                    _webAppWindow.SizeChanged -= OnWebAppTutorialPlacementTargetSizeChanged;
                    _webAppWindow.StateChanged -= OnWebAppTutorialHostChanged;
                }
                try { _webAppTutorialWindow?.Close(); } catch { }
                _webAppTutorialWindow = null;
                _webAppTutorialPlacementTarget = null;
                if (_webAppTutorialOverlay == overlay)
                    _webAppTutorialOverlay = null;
                try { _ytWebView?.Focus(); } catch { }
            };
            overlay.BeginAnimation(OpacityProperty, fade);
        }

        private Grid BuildWebAppTutorialOverlay()
        {
            bool pt = IsPortugueseUi();
            var root = new Grid
            {
                Focusable = true,
                Background = new SolidColorBrush(Color.FromArgb(206, 0, 2, 10)),
                Opacity = 0,
                IsHitTestVisible = true
            };
            root.PreviewMouseDown += (_, e) =>
            {
                if (ReferenceEquals(e.OriginalSource, root))
                    e.Handled = true;
            };
            root.PreviewKeyDown += (_, e) =>
            {
                if (e.Key == Key.Enter || e.Key == Key.Space || e.Key == Key.Escape)
                {
                    e.Handled = true;
                    DismissWebAppTutorial();
                }
            };

            var bottomShade = new Border
            {
                Background = new LinearGradientBrush
                {
                    StartPoint = new Point(0, 0),
                    EndPoint = new Point(0, 1),
                    GradientStops = new GradientStopCollection
                    {
                        new GradientStop(Color.FromArgb(0, 0, 2, 10), 0.0),
                        new GradientStop(Color.FromArgb(142, 0, 2, 10), 0.42),
                        new GradientStop(Color.FromArgb(232, 0, 2, 10), 1.0)
                    }
                },
                VerticalAlignment = VerticalAlignment.Stretch,
                IsHitTestVisible = false
            };
            root.Children.Add(bottomShade);

            var glow = new System.Windows.Shapes.Ellipse
            {
                Width = 820,
                Height = 520,
                Fill = new RadialGradientBrush(
                    Color.FromArgb(82, 36, 135, 210),
                    Color.FromArgb(0, 36, 135, 210)),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                IsHitTestVisible = false
            };
            root.Children.Add(glow);

            var panel = new Grid
            {
                Width = 1180,
                MaxWidth = 1180,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(44)
            };
            panel.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            panel.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            panel.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            panel.Children.Add(new TextBlock
            {
                Text = pt ? "COMANDOS DO MODO WEB APP" : "WEB APP CONTROLS",
                Foreground = Brushes.White,
                    FontSize = 42,
                    FontWeight = FontWeights.Light,
                    TextAlignment = TextAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 0, 0, 10)
            });

            var subtitle = new TextBlock
            {
                Text = pt ? "Esses sao os comandos para navegar aplicativos web usando o controle." : "Use these commands to control web apps with your controller.",
                Foreground = new SolidColorBrush(Color.FromArgb(190, 255, 255, 255)),
                FontSize = 20,
                FontWeight = FontWeights.Normal,
                TextAlignment = TextAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 58, 0, 0)
            };
            panel.Children.Add(subtitle);

            var diagram = BuildWebAppControllerDiagramSvg(pt);
            Grid.SetRow(diagram, 1);
            panel.Children.Add(diagram);

            var action = new Button
            {
                Content = pt ? "Entendi" : "Got it",
                MinWidth = 188,
                Height = 54,
                Padding = new Thickness(28, 0, 28, 0),
                FontSize = 17,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromRgb(5, 7, 13)),
                Background = Brushes.White,
                BorderBrush = new SolidColorBrush(Color.FromArgb(55, 255, 255, 255)),
                BorderThickness = new Thickness(1),
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 8, 0, 0)
            };
            action.Click += (_, _) => DismissWebAppTutorial();
            Grid.SetRow(action, 2);
            panel.Children.Add(action);

            var hint = new TextBlock
            {
                Text = pt ? "Pressione A, B ou Start para continuar" : "Press A, B, or Start to continue",
                Foreground = new SolidColorBrush(Color.FromArgb(112, 255, 255, 255)),
                FontSize = 13,
                FontWeight = FontWeights.SemiBold,
                TextAlignment = TextAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 76, 0, 0),
                TextWrapping = TextWrapping.Wrap
            };
            Grid.SetRow(hint, 2);
            panel.Children.Add(hint);

            root.Children.Add(panel);

            root.BeginAnimation(OpacityProperty, new DoubleAnimation
            {
                To = 1,
                Duration = TimeSpan.FromMilliseconds(260),
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
            });

            return root;
        }

        private FrameworkElement BuildWebAppControllerDiagramSvg(bool pt)
        {
            var viewbox = new Viewbox
            {
                Stretch = Stretch.Uniform,
                MaxHeight = 560,
                Margin = new Thickness(0, 14, 0, 2)
            };

            var canvas = new Canvas { Width = 1120, Height = 540 };
            viewbox.Child = canvas;

            Brush textBrush = new SolidColorBrush(Color.FromArgb(235, 255, 255, 255));
            Brush dimBrush = new SolidColorBrush(Color.FromArgb(150, 255, 255, 255));
            Brush lineBrush = new SolidColorBrush(Color.FromArgb(190, 132, 211, 255));

            var controller = new Canvas { Width = 580.03, Height = 486 };
            controller.RenderTransform = new TransformGroup
            {
                Children = new TransformCollection
                {
                    new ScaleTransform(0.88, 0.88),
                    new TranslateTransform(0, 0)
                }
            };
            Canvas.SetLeft(controller, 310);
            Canvas.SetTop(controller, 46);
            canvas.Children.Add(controller);

            Brush shellFill = new LinearGradientBrush(
                Color.FromArgb(96, 238, 243, 252),
                Color.FromArgb(58, 142, 154, 180),
                90);
            Brush shellStroke = new SolidColorBrush(Color.FromArgb(230, 225, 236, 255));
            Brush detailFill = new SolidColorBrush(Color.FromArgb(92, 31, 38, 53));
            Brush detailStroke = new SolidColorBrush(Color.FromArgb(185, 225, 236, 255));

            AddSvgPath(controller, "M505.765,150.961c-16.255-10.392-4.528-16.328-21.353-29.192s-85.104-34.639-96.983-24.743s-25.233,11.873-25.233,11.873 h-72.112h-0.122h-72.118c0,0-13.36-1.977-25.233-11.873c-11.873-9.896-80.16,11.873-96.983,24.743 c-16.824,12.864-5.098,18.801-21.353,29.192C58.02,161.353,15.467,304.843,15.467,304.843s-55.417,159.823,43.544,179.12 c0,0,24.241-15.337,45.025-40.08c7.778-9.26,18.33-19.97,29.627-29.78v-3.794c0-20.569,16.738-37.308,37.308-37.308h233.967 c18.514,0,33.923,13.556,36.818,31.261c8.213,3.825,14.309,11.42,16.188,20.453c6.812,6.573,13.017,13.177,18.054,19.168 c20.783,24.743,45.024,40.08,45.024,40.08c98.961-19.297,43.544-179.12,43.544-179.12S522.02,161.347,505.765,150.961z M438.047,148.335c13.728,0,24.89,11.169,24.89,24.89c0,13.721-11.162,24.89-24.89,24.89s-24.89-11.163-24.89-24.89 S424.319,148.335,438.047,148.335z M399.932,186.433c13.721,0,24.89,11.163,24.89,24.89s-11.162,24.89-24.89,24.89 s-24.891-11.169-24.891-24.89S386.204,186.433,399.932,186.433z M332.146,195.398c8.782,0,15.924,7.148,15.924,15.93 s-7.142,15.924-15.924,15.924s-15.925-7.142-15.925-15.924S323.364,195.398,332.146,195.398z M142.139,259.414 c-27.062,0-49.083-22.02-49.083-49.083c0-27.062,22.02-49.076,49.083-49.076c27.063,0,49.076,22.014,49.076,49.076 C191.215,237.394,169.201,259.414,142.139,259.414z M256.399,316.807c0,1.689-1.371,3.061-3.06,3.061h-22.448v22.454 c0,1.689-1.371,3.06-3.06,3.06h-24.235c-1.689,0-3.06-1.37-3.06-3.06v-22.454h-22.448c-1.689,0-3.06-1.371-3.06-3.061v-24.235 c0-1.688,1.371-3.06,3.06-3.06h22.448v-22.454c0-1.689,1.371-3.06,3.06-3.06h24.235c1.689,0,3.06,1.371,3.06,3.06v22.454h22.448 c1.689,0,3.06,1.371,3.06,3.06V316.807z M249.019,227.247c-8.782,0-15.924-7.142-15.924-15.924s7.142-15.931,15.924-15.931 s15.924,7.148,15.924,15.931S257.794,227.247,249.019,227.247z M290.022,177.271c-16.457,0-29.841-13.391-29.841-29.841 c0-16.45,13.391-29.841,29.841-29.841c16.45,0,29.841,13.391,29.841,29.841C319.863,163.88,306.479,177.271,290.022,177.271z M365.299,348.974c-27.063,0-49.077-22.02-49.077-49.082c0-27.063,22.014-49.077,49.077-49.077 c27.062,0,49.076,22.014,49.076,49.077C414.375,326.954,392.361,348.974,365.299,348.974z M438.047,276.311 c-13.728,0-24.89-11.169-24.89-24.89s11.162-24.89,24.89-24.89s24.89,11.163,24.89,24.89S451.774,276.311,438.047,276.311z M479.106,236.213c-13.728,0-24.891-11.169-24.891-24.89c0-13.721,11.163-24.89,24.891-24.89c13.721,0,24.89,11.163,24.89,24.89 S492.827,236.213,479.106,236.213z", shellFill, shellStroke, 2.1);

            AddSvgPath(controller, "M142.139,167.381c-23.69,0-42.962,19.266-42.962,42.957s19.272,42.962,42.962,42.962 c23.685,0,42.957-19.272,42.957-42.962S165.829,167.381,142.139,167.381z M142.139,243.575c-18.329,0-33.244-14.915-33.244-33.244 c0-18.329,14.915-33.244,33.244-33.244c18.33,0,33.244,14.915,33.244,33.244C175.383,228.661,160.474,243.575,142.139,243.575z", detailFill, detailStroke, 1.2);
            AddSvgPath(controller, "M142.139,183.213c-14.957,0-27.124,12.167-27.124,27.124c0,14.957,12.167,27.124,27.124,27.124 c14.958,0,27.124-12.167,27.124-27.124C169.263,195.38,157.096,183.213,142.139,183.213z", detailFill, detailStroke, 1.1);
            AddSvgPath(controller, "M365.299,256.941c-23.685,0-42.957,19.266-42.957,42.957s19.272,42.962,42.957,42.962 c23.684,0,42.956-19.271,42.956-42.962S388.982,256.941,365.299,256.941z M365.299,333.142c-18.33,0-33.244-14.921-33.244-33.25 c0-18.33,14.914-33.244,33.244-33.244c18.329,0,33.243,14.915,33.243,33.244C398.542,318.221,383.628,333.142,365.299,333.142z", detailFill, detailStroke, 1.2);
            AddSvgPath(controller, "M365.299,272.773c-14.958,0-27.124,12.167-27.124,27.124c0,14.957,12.166,27.13,27.124,27.13 c14.957,0,27.123-12.167,27.123-27.13C392.416,284.94,380.256,272.773,365.299,272.773z", detailFill, detailStroke, 1.1);
            AddSvgPath(controller, "M224.771,292.571v-22.454h-18.115v22.454c0,1.689-1.371,3.061-3.06,3.061h-22.448v18.115h22.448 c1.689,0,3.06,1.371,3.06,3.06v22.454h18.115v-22.454c0-1.688,1.371-3.06,3.06-3.06h22.448v-18.115h-22.448 C226.142,295.632,224.771,294.261,224.771,292.571z", detailFill, detailStroke, 1.1);
            AddSvgCircle(controller, 249.019, 211.323, 9.804, detailFill);
            AddSvgCircle(controller, 332.146, 211.323, 9.804, detailFill);
            AddSvgCircle(controller, 399.932, 211.323, 18.77, detailFill);
            AddSvgCircle(controller, 438.047, 173.226, 18.77, detailFill);
            AddSvgCircle(controller, 438.047, 251.421, 18.77, detailFill);
            AddSvgCircle(controller, 479.106, 211.323, 18.77, detailFill);

            AddFaceButton(canvas, 695, 267, "A", Color.FromRgb(82, 203, 116));
            AddFaceButton(canvas, 732, 232, "B", Color.FromRgb(234, 88, 92));
            AddFaceButton(canvas, 662, 232, "X", Color.FromRgb(82, 151, 232));
            AddFaceButton(canvas, 695, 198, "Y", Color.FromRgb(238, 205, 82));
            AddStick(canvas, 435, 231, "L");
            AddStick(canvas, 631, 310, "R");
            AddShoulder(canvas, 390, 128, "L1");
            AddShoulder(canvas, 662, 128, "R1");
            AddXboxGuideButton(canvas, 565, 176);

            AddCallout(canvas, 436, 130, 120, 92,
                "L1", pt ? "Voltar no historico" : "Browser back", lineBrush, textBrush, dimBrush, true);
            AddCallout(canvas, 708, 130, 902, 92,
                "R1", pt ? "Avancar no historico" : "Browser forward", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 565, 176, 472, 18,
                pt ? "Botao Xbox" : "Xbox button", pt ? "Minimiza para o Doorpi" : "Minimizes to Doorpi", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 435, 231, 96, 220,
                pt ? "Analogico esquerdo" : "Left stick", pt ? "Controla o mouse" : "Moves the mouse", lineBrush, textBrush, dimBrush, true);
            AddCallout(canvas, 631, 310, 584, 424,
                pt ? "Analogico direito" : "Right stick", pt ? "Controla o scroll" : "Controls scroll", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 695, 198, 858, 164,
                "Y", pt ? "Espaco / play quando disponivel" : "Space / play when available", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 732, 232, 858, 238,
                "B", pt ? "Pressionar: volta pagina\nSegurar: fecha o app" : "Press: page back\nHold: close app", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 662, 232, 858, 304,
                "X", pt ? "Clique direito" : "Right click", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 695, 267, 858, 430,
                "A", pt ? "Clique do mouse" : "Mouse click", lineBrush, textBrush, dimBrush);

            return viewbox;
        }

        private static void AddSvgPath(Canvas canvas, string data, Brush fill, Brush? stroke, double thickness)
        {
            canvas.Children.Add(new ShapePath
            {
                Data = Geometry.Parse(data),
                Fill = fill,
                Stroke = stroke,
                StrokeThickness = thickness,
                Stretch = Stretch.None
            });
        }

        private static void AddSvgCircle(Canvas canvas, double cx, double cy, double r, Brush fill)
        {
            var circle = new System.Windows.Shapes.Ellipse
            {
                Width = r * 2,
                Height = r * 2,
                Fill = fill
            };
            Canvas.SetLeft(circle, cx - r);
            Canvas.SetTop(circle, cy - r);
            canvas.Children.Add(circle);
        }

        private static void AddXboxGuideButton(Canvas canvas, double cx, double cy)
        {
            var outer = new System.Windows.Shapes.Ellipse
            {
                Width = 44,
                Height = 44,
                Fill = new SolidColorBrush(Color.FromRgb(238, 243, 252)),
                Stroke = new SolidColorBrush(Color.FromArgb(170, 255, 255, 255)),
                StrokeThickness = 1.5
            };
            Canvas.SetLeft(outer, cx - 22);
            Canvas.SetTop(outer, cy - 22);
            canvas.Children.Add(outer);

            var logo = new ShapePath
            {
                Data = Geometry.Parse("M11.9 9.3c-5.1-5.1-6.4-4-6.4-4C2.7 8 1 11.8 1 16c0 3.4 1.1 6.6 3.1 9.1h.1V25C3 21.5 8.9 12.9 11.9 9.3zm14.6-4s-1.3-1.1-6.4 3.9c3 3.6 8.9 12.2 7.7 15.7v.1h.1c1.9-2.5 3.1-5.7 3.1-9.1 0-4.1-1.7-7.9-4.5-10.6zM16 5.4c.5-.2 4.9-2.8 7.8-2.1h.1v-.1C21.5 1.8 19 1 16 1s-5.5.8-7.8 2.2v.1h.1c2.5-.6 6.6 1.5 7.7 2.1zm0 7.7c0-.1 0-.1 0 0C11.4 16.5 3.7 25 6.1 27.3 8.8 29.6 12.2 31 16 31s7.2-1.4 9.9-3.7c2.3-2.4-5.4-10.8-9.9-14.2z"),
                Fill = new SolidColorBrush(Color.FromRgb(22, 28, 40)),
                Stretch = Stretch.None,
                RenderTransform = new TransformGroup
                {
                    Children = new TransformCollection
                    {
                        new ScaleTransform(0.86, 0.86),
                        new TranslateTransform(cx - 14, cy - 14)
                    }
                }
            };
            canvas.Children.Add(logo);
        }

        private FrameworkElement BuildWebAppControllerDiagram(bool pt)
        {
            var viewbox = new Viewbox
            {
                Stretch = Stretch.Uniform,
                MaxHeight = 560,
                Margin = new Thickness(0, 14, 0, 2)
            };

            var canvas = new Canvas { Width = 1120, Height = 540 };
            viewbox.Child = canvas;

            Brush bodyFill = new LinearGradientBrush(
                Color.FromRgb(238, 242, 250),
                Color.FromRgb(148, 158, 178),
                90);
            Brush bodyStroke = new SolidColorBrush(Color.FromArgb(185, 255, 255, 255));
            Brush textBrush = new SolidColorBrush(Color.FromArgb(235, 255, 255, 255));
            Brush dimBrush = new SolidColorBrush(Color.FromArgb(150, 255, 255, 255));
            Brush lineBrush = new SolidColorBrush(Color.FromArgb(190, 132, 211, 255));

            var body = new ShapePath
            {
                Data = Geometry.Parse("M358,178 C407,118 484,132 520,166 C548,191 572,191 600,166 C636,132 713,118 762,178 C809,236 845,368 797,412 C754,452 714,391 679,346 C654,314 632,308 560,308 C488,308 466,314 441,346 C406,391 366,452 323,412 C275,368 311,236 358,178 Z"),
                Fill = bodyFill,
                Stroke = bodyStroke,
                StrokeThickness = 2
            };
            canvas.Children.Add(body);

            AddShoulder(canvas, 375, 126, "L1");
            AddShoulder(canvas, 665, 126, "R1");
            AddStick(canvas, 425, 258, "L");
            AddStick(canvas, 645, 258, "R");
            AddDpad(canvas, 482, 325);
            AddFaceButton(canvas, 726, 247, "Y", Color.FromRgb(238, 205, 82));
            AddFaceButton(canvas, 684, 289, "X", Color.FromRgb(82, 151, 232));
            AddFaceButton(canvas, 768, 289, "B", Color.FromRgb(234, 88, 92));
            AddFaceButton(canvas, 726, 331, "A", Color.FromRgb(82, 203, 116));
            AddSmallButton(canvas, 531, 242, "≡");
            AddSmallButton(canvas, 589, 242, "⋯");

            AddCallout(canvas, 724, 331, 880, 392,
                "A", pt ? "Clique do mouse" : "Mouse click", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 768, 289, 870, 224,
                "B", pt ? "Pressionar: volta pagina\nSegurar: fecha o app" : "Press: page back\nHold: close app", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 425, 258, 148, 220,
                pt ? "Analogico esquerdo" : "Left stick", pt ? "Controla o mouse" : "Moves the mouse", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 645, 258, 836, 122,
                pt ? "Analogico direito" : "Right stick", pt ? "Controla o scroll" : "Controls scroll", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 684, 289, 146, 360,
                "X", pt ? "Clique direito" : "Right click", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 375, 126, 148, 108,
                "L1", pt ? "Voltar no historico" : "Browser back", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 665, 126, 838, 52,
                "R1", pt ? "Avancar no historico" : "Browser forward", lineBrush, textBrush, dimBrush);
            AddCallout(canvas, 726, 247, 884, 306,
                "Y", pt ? "Espaco / play quando disponivel" : "Space / play when available", lineBrush, textBrush, dimBrush);

            return viewbox;
        }

        private static void AddShoulder(Canvas canvas, double x, double y, string text)
        {
            var rect = new System.Windows.Shapes.Rectangle
            {
                Width = 92,
                Height = 36,
                RadiusX = 18,
                RadiusY = 18,
                Fill = new SolidColorBrush(Color.FromArgb(92, 225, 232, 245)),
                Stroke = new SolidColorBrush(Color.FromArgb(210, 255, 255, 255)),
                StrokeThickness = 2
            };
            Canvas.SetLeft(rect, x);
            Canvas.SetTop(rect, y);
            canvas.Children.Add(rect);
            AddCanvasText(canvas, text, x, y + 7, 92, 18, Brushes.Black, 14, FontWeights.Bold);
        }

        private static void AddStick(Canvas canvas, double cx, double cy, string text)
        {
            var outer = new System.Windows.Shapes.Ellipse
            {
                Width = 74,
                Height = 74,
                Fill = new SolidColorBrush(Color.FromArgb(82, 48, 55, 70)),
                Stroke = new SolidColorBrush(Color.FromArgb(205, 225, 236, 255)),
                StrokeThickness = 2.4
            };
            Canvas.SetLeft(outer, cx - 37);
            Canvas.SetTop(outer, cy - 37);
            canvas.Children.Add(outer);

            var inner = new System.Windows.Shapes.Ellipse
            {
                Width = 42,
                Height = 42,
                Fill = new SolidColorBrush(Color.FromArgb(88, 23, 27, 38)),
                Stroke = new SolidColorBrush(Color.FromArgb(145, 255, 255, 255)),
                StrokeThickness = 1.4
            };
            Canvas.SetLeft(inner, cx - 21);
            Canvas.SetTop(inner, cy - 21);
            canvas.Children.Add(inner);
            AddCanvasText(canvas, text, cx - 18, cy - 10, 36, 20, new SolidColorBrush(Color.FromArgb(210, 255, 255, 255)), 12, FontWeights.Bold);
        }

        private static void AddDpad(Canvas canvas, double x, double y)
        {
            var v = new System.Windows.Shapes.Rectangle { Width = 26, Height = 78, RadiusX = 7, RadiusY = 7, Fill = new SolidColorBrush(Color.FromRgb(38, 44, 58)) };
            var h = new System.Windows.Shapes.Rectangle { Width = 78, Height = 26, RadiusX = 7, RadiusY = 7, Fill = new SolidColorBrush(Color.FromRgb(38, 44, 58)) };
            Canvas.SetLeft(v, x + 26);
            Canvas.SetTop(v, y);
            Canvas.SetLeft(h, x);
            Canvas.SetTop(h, y + 26);
            canvas.Children.Add(v);
            canvas.Children.Add(h);
        }

        private static void AddFaceButton(Canvas canvas, double cx, double cy, string text, Color color)
        {
            var circle = new System.Windows.Shapes.Ellipse
            {
                Width = 42,
                Height = 42,
                Fill = new SolidColorBrush(Color.FromArgb(108, 232, 238, 248)),
                Stroke = new SolidColorBrush(Color.FromArgb(205, 255, 255, 255)),
                StrokeThickness = 1.7
            };
            Canvas.SetLeft(circle, cx - 21);
            Canvas.SetTop(circle, cy - 21);
            canvas.Children.Add(circle);
            AddCanvasText(canvas, text, cx - 16, cy - 10, 32, 20, new SolidColorBrush(color), 15, FontWeights.Black);
        }

        private static void AddSmallButton(Canvas canvas, double cx, double cy, string text)
        {
            var pill = new System.Windows.Shapes.Ellipse
            {
                Width = 34,
                Height = 22,
                Fill = new SolidColorBrush(Color.FromRgb(70, 78, 96)),
                Stroke = new SolidColorBrush(Color.FromArgb(90, 255, 255, 255)),
                StrokeThickness = 1
            };
            Canvas.SetLeft(pill, cx - 17);
            Canvas.SetTop(pill, cy - 11);
            canvas.Children.Add(pill);
            AddCanvasText(canvas, text, cx - 17, cy - 10, 34, 18, Brushes.White, 12, FontWeights.Bold);
        }

        private static void AddCallout(Canvas canvas, double sx, double sy, double tx, double ty, string title, string desc, Brush lineBrush, Brush titleBrush, Brush descBrush, bool lineToTextEnd = false)
        {
            const double textWidth = 210;
            var textAlignment = lineToTextEnd ? TextAlignment.Right : TextAlignment.Left;
            var line = new System.Windows.Shapes.Line
            {
                X1 = sx,
                Y1 = sy,
                X2 = lineToTextEnd ? tx + textWidth : tx,
                Y2 = ty + 12,
                Stroke = lineBrush,
                StrokeThickness = 1.7,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round
            };
            canvas.Children.Add(line);

            var dot = new System.Windows.Shapes.Ellipse
            {
                Width = 8,
                Height = 8,
                Fill = lineBrush
            };
            Canvas.SetLeft(dot, sx - 4);
            Canvas.SetTop(dot, sy - 4);
            canvas.Children.Add(dot);

            var stack = new StackPanel { Width = textWidth };
            stack.Children.Add(new TextBlock
            {
                Text = title,
                Width = textWidth,
                Foreground = titleBrush,
                FontSize = 18,
                FontWeight = FontWeights.Black,
                TextAlignment = textAlignment,
                TextWrapping = TextWrapping.Wrap
            });
            stack.Children.Add(new TextBlock
            {
                Text = desc,
                Width = textWidth,
                Foreground = descBrush,
                FontSize = 14,
                FontWeight = FontWeights.SemiBold,
                LineHeight = 17,
                TextAlignment = textAlignment,
                TextWrapping = TextWrapping.Wrap
            });
            Canvas.SetLeft(stack, tx);
            Canvas.SetTop(stack, ty);
            canvas.Children.Add(stack);
        }

        private static void AddCanvasText(Canvas canvas, string text, double x, double y, double width, double height, Brush foreground, double fontSize, FontWeight weight)
        {
            var tb = new TextBlock
            {
                Text = text,
                Width = width,
                Height = height,
                Foreground = foreground,
                FontSize = fontSize,
                FontWeight = weight,
                TextAlignment = TextAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            Canvas.SetLeft(tb, x);
            Canvas.SetTop(tb, y);
            canvas.Children.Add(tb);
        }

        private ShapePath BuildProgressArcPath(double size, double thickness, double progress, Brush stroke)
        {
            return new ShapePath
            {
                Data = BuildArcGeometry(size, thickness, -90, Math.Max(0.1, Math.Min(359.9, 360 * progress))),
                Width = size,
                Height = size,
                StrokeThickness = thickness,
                Stroke = stroke,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
        }

        private Geometry BuildArcGeometry(double size, double thickness, double startAngle, double sweepAngle)
        {
            var geometry = new PathGeometry();
            double radius = (size - thickness) / 2.0;
            var center = new Point(size / 2.0, size / 2.0);
            var start = PointOnCircle(center, radius, startAngle);
            var end = PointOnCircle(center, radius, startAngle + sweepAngle);

            var figure = new PathFigure
            {
                StartPoint = start,
                IsClosed = false,
                IsFilled = false
            };
            figure.Segments.Add(new ArcSegment
            {
                Point = end,
                Size = new Size(radius, radius),
                RotationAngle = 0,
                IsLargeArc = Math.Abs(sweepAngle) > 180,
                SweepDirection = sweepAngle >= 0 ? SweepDirection.Clockwise : SweepDirection.Counterclockwise,
                IsStroked = true
            });
            geometry.Figures.Add(figure);
            return geometry;
        }

        private void UpdateWebAppCloseHoldOverlay(double progress)
        {
            Dispatcher.InvokeAsync(() =>
            {
                EnsureWebAppCloseHoldPopup();
                if (_webAppCloseHoldOverlay == null || _webAppCloseHoldProgressArc == null)
                    return;

                progress = Math.Clamp(progress, 0, 1);
                _webAppCloseHoldProgressArc.Data = BuildArcGeometry(108, 5, -90, Math.Max(0.1, Math.Min(359.9, 360 * progress)));
                if (progress > 0)
                {
                    PositionWebAppCloseHoldPopup();
                    if (_webAppCloseHoldOverlay.Visibility != Visibility.Visible)
                        _webAppCloseHoldOverlay.Visibility = Visibility.Visible;
                    _webAppCloseHoldOverlay.Opacity = Math.Min(1, Math.Max(0.18, progress));
                    if (_webAppCloseHoldPopup != null && !_webAppCloseHoldPopup.IsOpen)
                        _webAppCloseHoldPopup.IsOpen = true;
                }
                else
                {
                    _webAppCloseHoldOverlay.Opacity = 0;
                    _webAppCloseHoldOverlay.Visibility = Visibility.Collapsed;
                    if (_webAppCloseHoldPopup != null)
                        _webAppCloseHoldPopup.IsOpen = false;
                }
            });
        }

        private void HideWebAppCloseHoldOverlay() => UpdateWebAppCloseHoldOverlay(0);

        private void EnsureWebAppCloseHoldPopup()
        {
            if (_webAppCloseHoldPopup != null && _webAppCloseHoldOverlay != null && _webAppCloseHoldProgressArc != null)
                return;

            var target = _webAppCloseHoldPlacementTarget ?? (_webAppWindow?.Content as FrameworkElement) ?? RootGrid;
            _webAppCloseHoldPlacementTarget = target;
            _webAppCloseHoldOverlay = BuildWebAppCloseHoldOverlay();
            _webAppCloseHoldOverlay.Margin = new Thickness(0);
            _webAppCloseHoldPopup = new Popup
            {
                PlacementTarget = target,
                Placement = PlacementMode.Relative,
                StaysOpen = true,
                AllowsTransparency = true,
                IsHitTestVisible = false,
                Child = _webAppCloseHoldOverlay
            };
        }

        private void PositionWebAppCloseHoldPopup()
        {
            if (_webAppCloseHoldPopup == null) return;
            var target = _webAppCloseHoldPlacementTarget ?? _webAppCloseHoldPopup.PlacementTarget as FrameworkElement;
            double width = target?.ActualWidth > 0 ? target.ActualWidth : SystemParameters.PrimaryScreenWidth;
            double height = target?.ActualHeight > 0 ? target.ActualHeight : SystemParameters.PrimaryScreenHeight;
            _webAppCloseHoldPopup.HorizontalOffset = Math.Max(0, (width - 132) / 2);
            _webAppCloseHoldPopup.VerticalOffset = Math.Max(0, height - 132 - 54);
        }

        private Grid BuildWebAppLoadingOverlay(string appName, string logoImg)
        {
            var overlay = new Grid
            {
                Background = new SolidColorBrush(Color.FromRgb(3, 5, 13)),
                Opacity = 1,
                IsHitTestVisible = true
            };

            var stack = new StackPanel
            {
                Orientation = Orientation.Vertical,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                MinWidth = 360
            };

            var logoSource = TryCreateWebAppLoadingLogoSource(logoImg);
            if (logoSource == null)
                logoSource = TryCreateWebAppLoadingLogoSource(ResolveNativeWebAppLogoFallback(appName));
            if (logoSource != null)
            {
                stack.Children.Add(new Image
                {
                    Source = logoSource,
                    Width = 360,
                    MaxHeight = 180,
                    Stretch = Stretch.Uniform,
                    HorizontalAlignment = HorizontalAlignment.Center,
                    Margin = new Thickness(0, 0, 0, 58)
                });
            }
            else
            {
                stack.Children.Add(new TextBlock
                {
                    Text = string.IsNullOrWhiteSpace(appName) ? "Doorpi" : appName,
                    Foreground = Brushes.White,
                    FontSize = 46,
                    FontWeight = FontWeights.SemiBold,
                    TextAlignment = TextAlignment.Center,
                    HorizontalAlignment = HorizontalAlignment.Center,
                    Margin = new Thickness(0, 0, 0, 58)
                });
            }

            stack.Children.Add(BuildWebAppLoadingSpinner(appName));

            overlay.Children.Add(stack);
            return overlay;
        }

        private ImageSource? TryCreateWebAppLoadingLogoSource(string logoImg)
        {
            try
            {
                string resolved = ResolveDoorpiImageForWpf(logoImg);
                if (string.IsNullOrWhiteSpace(resolved)) return null;

                var bitmap = new System.Windows.Media.Imaging.BitmapImage();
                bitmap.BeginInit();
                bitmap.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
                bitmap.UriSource = new Uri(resolved, UriKind.Absolute);
                bitmap.EndInit();
                bitmap.Freeze();
                return bitmap;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[WebAppLoading] Falha ao carregar logo: " + ex.Message);
                return null;
            }
        }

        private string ResolveDoorpiImageForWpf(string image)
        {
            if (string.IsNullOrWhiteSpace(image)) return "";
            if (image.StartsWith("https://app.local/", StringComparison.OrdinalIgnoreCase))
            {
                string relative = image["https://app.local/".Length..].Replace('/', Path.DirectorySeparatorChar);
                string wwwroot = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot"));
                string local = Path.GetFullPath(Path.Combine(wwwroot, relative));
                if (local.StartsWith(wwwroot, StringComparison.OrdinalIgnoreCase) && File.Exists(local))
                    return local;
                return "";
            }
            if (image.StartsWith("https://data.local/", StringComparison.OrdinalIgnoreCase))
            {
                string relative = image["https://data.local/".Length..].Replace('/', Path.DirectorySeparatorChar);
                string local = Path.GetFullPath(Path.Combine(dataFolder, relative));
                string root = Path.GetFullPath(dataFolder);
                if (local.StartsWith(root, StringComparison.OrdinalIgnoreCase) && File.Exists(local))
                    return local;
                return "";
            }
            if (File.Exists(image)) return Path.GetFullPath(image);
            if (Uri.TryCreate(image, UriKind.Absolute, out var uri))
                return uri.ToString();
            return "";
        }

        private string ResolveNativeWebAppLogoFallback(string appName)
        {
            string key = (appName ?? "").Trim().ToLowerInvariant();
            string folder = key switch
            {
                var value when value.Contains("youtube") => "youtube",
                var value when value.Contains("netflix") => "netflix",
                var value when value.Contains("twitch") => "twitch",
                var value when value.Contains("kick") => "kick",
                var value when value.Contains("disney") => "disneyplus",
                var value when value.Contains("prime") => "primevideo",
                var value when value.Contains("apple") => "appletv",
                var value when value.Contains("max") => "max",
                var value when value.Contains("crunchy") => "crunchyroll",
                _ => ""
            };
            return string.IsNullOrWhiteSpace(folder)
                ? ""
                : $"https://app.local/native-assets/{folder}/logo.png";
        }

        private FrameworkElement BuildWebAppLoadingSpinner(string appName)
        {
            var accent = GetWebAppLoadingAccent(appName);
            var bright = Color.FromRgb(
                (byte)Math.Min(255, accent.R + 28),
                (byte)Math.Min(255, accent.G + 28),
                (byte)Math.Min(255, accent.B + 28));
            var deep = Color.FromRgb(
                (byte)Math.Max(0, accent.R - 42),
                (byte)Math.Max(0, accent.G - 42),
                (byte)Math.Max(0, accent.B - 42));

            var spinner = new Grid
            {
                Width = 154,
                Height = 154,
                HorizontalAlignment = HorizontalAlignment.Center,
                RenderTransformOrigin = new Point(0.5, 0.5),
                RenderTransform = new RotateTransform(0),
                Effect = new System.Windows.Media.Effects.DropShadowEffect
                {
                    Color = accent,
                    BlurRadius = 16,
                    ShadowDepth = 0,
                    Opacity = 0.46
                }
            };

            spinner.Children.Add(BuildSpinnerArcPath(
                150,
                18,
                -128,
                286,
                new SolidColorBrush(Color.FromArgb(34, deep.R, deep.G, deep.B))));

            var arcBrush = new LinearGradientBrush
            {
                StartPoint = new Point(0.18, 0.16),
                EndPoint = new Point(0.88, 0.92)
            };
            arcBrush.GradientStops.Add(new GradientStop(Color.FromArgb(255, bright.R, bright.G, bright.B), 0.00));
            arcBrush.GradientStops.Add(new GradientStop(Color.FromArgb(255, accent.R, accent.G, accent.B), 0.54));
            arcBrush.GradientStops.Add(new GradientStop(Color.FromArgb(214, deep.R, deep.G, deep.B), 1.00));

            spinner.Children.Add(BuildSpinnerArcPath(150, 16, -128, 286, arcBrush));

            var rotate = new DoubleAnimation
            {
                From = 0,
                To = 360,
                Duration = TimeSpan.FromSeconds(1.18),
                RepeatBehavior = RepeatBehavior.Forever,
                EasingFunction = null
            };
            ((RotateTransform)spinner.RenderTransform).BeginAnimation(RotateTransform.AngleProperty, rotate);

            return spinner;
        }

        private FrameworkElement BuildSpinnerArcPath(double size, double thickness, double startAngle, double sweepAngle, Brush stroke)
        {
            var geometry = new PathGeometry();
            double radius = (size - thickness) / 2.0;
            var center = new Point(size / 2.0, size / 2.0);
            var start = PointOnCircle(center, radius, startAngle);
            var end = PointOnCircle(center, radius, startAngle + sweepAngle);

            var figure = new PathFigure
            {
                StartPoint = start,
                IsClosed = false,
                IsFilled = false
            };
            figure.Segments.Add(new ArcSegment
            {
                Point = end,
                Size = new Size(radius, radius),
                RotationAngle = 0,
                IsLargeArc = Math.Abs(sweepAngle) > 180,
                SweepDirection = sweepAngle >= 0 ? SweepDirection.Clockwise : SweepDirection.Counterclockwise,
                IsStroked = true
            });
            geometry.Figures.Add(figure);

            return new ShapePath
            {
                Data = geometry,
                Width = size,
                Height = size,
                StrokeThickness = thickness,
                Stroke = stroke,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
        }

        private static Point PointOnCircle(Point center, double radius, double angleDegrees)
        {
            double radians = angleDegrees * Math.PI / 180.0;
            return new Point(
                center.X + radius * Math.Cos(radians),
                center.Y + radius * Math.Sin(radians));
        }

        private static Color GetWebAppLoadingAccent(string appName)
        {
            string key = (appName ?? "").Trim().ToLowerInvariant();
            if (key.Contains("netflix")) return Color.FromRgb(229, 9, 20);
            if (key.Contains("youtube")) return Color.FromRgb(255, 0, 0);
            if (key.Contains("prime")) return Color.FromRgb(0, 168, 225);
            if (key.Contains("disney")) return Color.FromRgb(68, 156, 255);
            if (key.Contains("twitch")) return Color.FromRgb(145, 70, 255);
            if (key.Contains("kick")) return Color.FromRgb(83, 252, 24);
            if (key.Contains("crunchy")) return Color.FromRgb(244, 117, 33);
            if (key.Contains("max")) return Color.FromRgb(82, 112, 255);
            if (key.Contains("apple")) return Color.FromRgb(230, 236, 255);
            return Color.FromRgb(0, 153, 255);
        }

        private async Task ReleaseWebAppLoadingOverlayAsync()
        {
            if (!_webAppLoadingActive || _webAppLoadingReleaseStarted)
                return;

            _webAppLoadingReleaseStarted = true;

            var elapsed = DateTime.UtcNow - _webAppLoadingStartedAtUtc;
            var minDuration = TimeSpan.FromMilliseconds(1400);
            if (elapsed < minDuration)
                await Task.Delay(minDuration - elapsed);

            try { _popupWindow?.Close(); } catch { }
            _popupWindow = null;
            _popupWebView = null;

            var overlay = _webAppLoadingOverlay;
            if (overlay == null)
            {
                _webAppLoadingActive = false;
                return;
            }

            await Dispatcher.InvokeAsync(() =>
            {
                var fade = new DoubleAnimation
                {
                    To = 0,
                    Duration = TimeSpan.FromMilliseconds(280),
                    EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
                };
                fade.Completed += (_, _) =>
                {
                    overlay.Visibility = Visibility.Collapsed;
                    overlay.IsHitTestVisible = false;
                    _webAppLoadingActive = false;
                };
                overlay.BeginAnimation(OpacityProperty, fade);
            });
        }

        private async Task OpenWebViewInlineAsync(string url, bool isYouTube = false, string appName = "", string heroImg = "", string gridImg = "", bool isGenericBrowser = false, string logoImg = "")
        {
            // Corrige a URL logo de cara se a abertura já for apontando para a home
            if (url.TrimEnd('/') == "https://www.steamgriddb.com")
                url = "https://www.steamgriddb.com/profile/preferences/api";

            bool isUtility = url.Contains("steamgriddb.com") || url.Contains("chromewebstore.google.com");

            if (_ytWebView != null)
            {
                if (isUtility && _webAppWindow == null)
                {
                    Panel.SetZIndex(_ytWebView, 1000);
                    _ytWebView.Visibility = Visibility.Visible;
                    _ytWebView.Focus();
                    return;
                }
                else if (_webAppWindow != null)
                {
                    if (_currentWebAppUrl == url)
                    {
                        SendGameLaunchStatus("gameLaunching", appName, heroImg, gridImg, "app");

                        _webAppWindow.WindowState = WindowState.Maximized;
                        _webAppWindow.Activate();
                        _ytWebView.Focus();
                        _ytWebView.CoreWebView2?.ExecuteScriptAsync("window.focus();");

                        SendGameLaunchStatus("gameLaunchReady");
                        await Task.Delay(800);

                        this.WindowState = WindowState.Minimized;
                        StartMediaControllerMode();

                        if (!isYouTube)
                            EnsureCursorVisible();

                        SendGameLaunchStatus("gameLaunchDone");
                        return;
                    }
                    else
                    {
                        CloseYouTubeInline();
                        await Task.Delay(300);
                    }
                }
                else
                {
                    CloseYouTubeInline();
                    await Task.Delay(300);
                }
            }

            _currentWebAppUrl = url;

            if (!isUtility) SendGameLaunchStatus("gameLaunching", appName, heroImg, gridImg, "app");

            _ytClosing = false;
            _isCurrentSiteYouTube = isYouTube;
            _isGenericBrowserMode = isGenericBrowser;
            _vkbIsOpen = false;
            _vkbOwnerView = null;
            _webAppLoadingActive = false;
            _webAppLoadingReleaseStarted = false;
            _webAppLoadingOverlay = null;


            _ytWebView = new WebView2
            {
                HorizontalAlignment = HorizontalAlignment.Stretch,
                VerticalAlignment = VerticalAlignment.Stretch,
            };

            if (isUtility)
            {
                webView.Visibility = Visibility.Collapsed;
                Panel.SetZIndex(_ytWebView, 1000);
                RootGrid.Children.Add(_ytWebView);
                AttachWebAppCloseHoldOverlay(RootGrid);
            }
            else
            {
                _webAppWindow = new Window
                {
                    Title = string.IsNullOrEmpty(appName) ? "Doorpi Web App" : appName,
                    WindowStyle = WindowStyle.None,
                    WindowState = WindowState.Maximized,
                    Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Black),
                    ShowInTaskbar = false
                };

                if (isGenericBrowser)
                {
                    var browserShell = BuildGenericBrowserShell(_ytWebView);
                    AttachWebAppCloseHoldOverlay(browserShell);
                    _webAppWindow.Content = browserShell;
                }
                else
                {
                    _webAppWindow.Content = BuildWebAppLoadingHost(_ytWebView, appName, logoImg);
                }

                _webAppWindow.Closed += (s, e) =>
                {
                    if (!_ytClosing) Dispatcher.Invoke(() => CloseYouTubeInline());
                };
                _webAppWindow.Deactivated += (s, e) =>
                {
                    Interlocked.Exchange(ref _lastWebAppDeactivatedUtcTicks, DateTime.UtcNow.Ticks);
                };
                _webAppWindow.StateChanged += (s, e) =>
                {
                    // Se a janela de Web App foi minimizada, devolvemos o foco pro Doorpi!
                    if (_webAppWindow.WindowState == WindowState.Minimized && !_ytClosing)
                    {
                        StopMediaControllerMode();
                        Dispatcher.Invoke(() => FocusDoorpiKeepSession());
                    }
                };

                _webAppWindow.Show();
            }

            string profileName = GetBrowserProfileNameForUrl(url, isYouTube);
            string userDataPath = Path.Combine(DoorpiPaths.BrowserProfilesFolder, profileName);

            var options = new CoreWebView2EnvironmentOptions { AreBrowserExtensionsEnabled = !isUtility };


            var env = await CoreWebView2Environment.CreateAsync(null, userDataPath, options);
            if (isGenericBrowser)
                _genericBrowserEnvironment = env;
            await _ytWebView.EnsureCoreWebView2Async(env);
            try
            {
                string folderPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
                _ytWebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "app.local", folderPath, CoreWebView2HostResourceAccessKind.Allow);
                _ytWebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "data.local", dataFolder, CoreWebView2HostResourceAccessKind.Allow);
            }
            catch { }

            _ytWebView.CoreWebView2.Profile.PreferredTrackingPreventionLevel = CoreWebView2TrackingPreventionLevel.Balanced;

            _ytWebView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
            if (!isUtility)
                await LoadExtensionsAsync(_ytWebView.CoreWebView2);

            if (isYouTube)
                _ytWebView.CoreWebView2.Settings.UserAgent = YT_UA;
            else
                _ytWebView.CoreWebView2.Settings.UserAgent = await BuildBrandedUserAgentAsync(_ytWebView.CoreWebView2);
            ApplyProductionWebViewSettings(_ytWebView.CoreWebView2, allowDefaultContextMenus: true);

            if (isGenericBrowser)
            {
                try
                {
                    Directory.CreateDirectory(UserDownloadsFolder);
                    _ytWebView.CoreWebView2.Profile.DefaultDownloadFolderPath = UserDownloadsFolder;
                }
                catch { }

                _ytWebView.CoreWebView2.DownloadStarting += OnGenericBrowserDownloadStarting;
                _ytWebView.CoreWebView2.ContainsFullScreenElementChanged += OnGenericBrowserContainsFullScreenElementChanged;
            }

            _ytWebView.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            _ytWebView.CoreWebView2.WebResourceRequested += YtOnWebResourceRequested;
            _ytWebView.CoreWebView2.WebMessageReceived += YtOnWebMessageReceived;
            _ytWebView.CoreWebView2.PermissionRequested += OnWebViewPermissionRequested;

            if (!isUtility)
            {
                _ytWebView.CoreWebView2.DocumentTitleChanged += (s, _) =>
                {
                    string title = _ytWebView?.CoreWebView2?.DocumentTitle ?? "";
                    if (isGenericBrowser)
                    {
                        UpdateGenericBrowserActiveTab(title: title);
                        Dispatcher.Invoke(UpdateGenericBrowserChrome);
                    }
                    if (!string.IsNullOrWhiteSpace(title) && !string.IsNullOrWhiteSpace(_currentWebAppUrl))
                        DiscordRpcManager.Instance.UpdateState("media", _currentWebAppUrl, title);
                };
            }
            // =========================================================================
            // INTERCEPTAÇÃO LIMPA: Previne carregar o React e a tela do SteamGridDB,
            // forçando a navegação de forma segura antes da rede processar a página.
            // =========================================================================
            _ytWebView.CoreWebView2.NavigationStarting += (s, e) =>
            {

                if (_vkbOwnerView == _ytWebView)
                {
                    _vkbIsOpen = false;
                    _vkbOwnerView = null;
                    _vkbHasFocus = false;
                }

                string? currentUri = e.Uri?.TrimEnd('/');
                if (isGenericBrowser && !string.IsNullOrWhiteSpace(e.Uri))
                    UpdateGenericBrowserActiveTab(pendingUrl: e.Uri, isLoading: true);

                if (currentUri == "https://www.steamgriddb.com")
                {
                    e.Cancel = true;
                    _ytWebView.CoreWebView2.Navigate("https://www.steamgriddb.com/profile/preferences/api");
                }
            };

            if (isYouTube)
            {
                await YtInjectAdBlockerAsync(_ytWebView.CoreWebView2);
                await YtInjectStateLoggerAsync(_ytWebView.CoreWebView2);
                await YtInjectGamepadAsync(_ytWebView.CoreWebView2);
                await YtInjectZoomHackAsync(_ytWebView.CoreWebView2);
                await YtInjectForceUserSelectionAsync(_ytWebView.CoreWebView2);
                await YtInjectUltrawideFixAsync(_ytWebView.CoreWebView2);
                await YtInjectPlayerBackgroundAsync(_ytWebView.CoreWebView2);
                await YtInjectTitleTrackerAsync(_ytWebView.CoreWebView2);
                _ytWebView.ZoomFactor = 0.3;
            }
            else
            {
                await YtInjectGenericSiteAsync(_ytWebView.CoreWebView2, isGenericBrowser);
            }

            _ytWebView.CoreWebView2.NavigationCompleted += async (s, e) =>
            {
                if (isGenericBrowser)
                {
                    string currentSource = _ytWebView.CoreWebView2.Source ?? _genericBrowserActiveTab.Url;
                    UpdateGenericBrowserActiveTab(
                        currentSource,
                        currentSource,
                        _ytWebView.CoreWebView2.DocumentTitle ?? _genericBrowserActiveTab.Title,
                        isLoading: false);
                    Dispatcher.Invoke(UpdateGenericBrowserChrome);
                }
                // Utilitários (SteamGridDB, Chrome Web Store): garante cursor visível após qualquer navegação
                if (isUtility)
                {
                    Dispatcher.Invoke(EnsureCursorVisible);
                    return;
                }

                if (!_ytClosing && this.WindowState != WindowState.Minimized)
                {
                    await ReleaseWebAppLoadingOverlayAsync();
                    if (!isYouTube)
                        Dispatcher.Invoke(TryShowWebAppTutorial);
                    SendGameLaunchStatus("gameLaunchReady");
                    await Task.Delay(800);

                    if (_mediaMouseActive && _webAppWindow != null && _webAppWindow.WindowState != WindowState.Minimized)
                    {
                        this.WindowState = WindowState.Minimized;
                    }
                    SendGameLaunchStatus("gameLaunchDone");
                }
            };

            if (isGenericBrowser)
                UpdateGenericBrowserActiveTab(url, url, "", isLoading: true);
            _ytWebView.CoreWebView2.Navigate(url);
            _ytWebView.Focus();
            _ytWebView.KeyDown += YtOnKeyDown;
            if (isGenericBrowser)
                _ytWebView.GotFocus += OnGenericBrowserMainWebViewGotFocus;

            _ytWebView.CoreWebView2.SourceChanged += async (s, args) =>
            {
                string newUrl = _ytWebView.CoreWebView2.Source;
                if (isGenericBrowser)
                {
                    UpdateGenericBrowserActiveTab(newUrl, newUrl);
                    Dispatcher.Invoke(UpdateGenericBrowserChrome);
                }

                if (newUrl.Contains("chromewebstore.google.com/detail/"))
                    await InjectInstalledExtensionsAsync(_ytWebView.CoreWebView2);
            };

            if (_mainScreenMouseVisible)
            {
                EnsureCursorHidden();
                _mainScreenMouseVisible = false;
            }
            if (!isYouTube)
                EnsureCursorVisible();

            if (isGenericBrowser)
                _ytWebView.Focus();

            StartMediaControllerMode();
            SendRuntimeSessionsToUI();
        }
        private static async Task YtInjectTitleTrackerAsync(CoreWebView2 cw)
        {
            const string script = @"
(function() {
    if (window.__doorpiYtTitle) return;
    window.__doorpiYtTitle = true;

    let _lastTitle = '';
    let _lastArtist = '';

    function postTitle(title, artist) {
        if (!title || (title === _lastTitle && artist === _lastArtist)) return;
        _lastTitle = title;
        _lastArtist = artist || '';
        try {
            window.chrome.webview.postMessage(
                'smtc:playing:' + encodeURIComponent(title) + ':' + encodeURIComponent(artist || '')
            );
        } catch(_) {}
    }

    setInterval(() => {
        const metadata = navigator.mediaSession?.metadata;
        const title  = metadata?.title  || '';
        const artist = metadata?.artist || '';
        if (title) postTitle(title, artist);
    }, 1500);
})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }
        private string GetBrowserProfileNameForUrl(string url, bool isYouTube)
        {
            string appKey = isYouTube ? "youtube" : "";
            MediaAppModel? media = null;
            try
            {
                media = LoadMediaApps().FirstOrDefault(m =>
                    string.Equals(m.Url, url, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(m.Id, url, StringComparison.OrdinalIgnoreCase));
            }
            catch { }

            if (media != null)
            {
                appKey = GetMediaAppKey(media);

                if (media.ShareMode == "all" || media.ShareMode == "user" || media.IsSharedFromOtherUser)
                {
                    return GetBrowserProfileNameForMediaApp(media);
                }
            }

            if (string.IsNullOrWhiteSpace(appKey))
            {
                var nativeApp = _nativeApps.FirstOrDefault(a => url.Contains(a.Id, StringComparison.OrdinalIgnoreCase));
                appKey = nativeApp != default
                    ? nativeApp.Id
                    : Convert.ToHexString(System.Security.Cryptography.MD5.HashData(
                        System.Text.Encoding.UTF8.GetBytes(url)))[..10].ToLowerInvariant();
            }

            string user = string.IsNullOrWhiteSpace(currentUserId) ? "default" : currentUserId;
            return SafePathSegment($"{user}-{SafeBrowserProfileToken(appKey)}");
        }

        // ── Fechar app ────────────────────────────────────────────────────────
        public void CloseYouTubeInline(bool skipStoreCompletion = false)
        {
            var ytWebView = _ytWebView;
            if (_ytClosing || ytWebView == null) return;
            _ytClosing = true;
            Application.Current.Deactivated -= OnApplicationDeactivated;
            bool shouldFinalizeStoreFromThisWebClose =
                !skipStoreCompletion &&
                _isStoreLauncherSession &&
                string.Equals(_storeSessionKind, "web", StringComparison.OrdinalIgnoreCase);
            bool shouldReturnToWebAppForm = _isGenericBrowserMode && _genericBrowserCaptureWebAppUrl;

            StopMediaControllerMode();
            _vkbIsOpen = false;
            _vkbOwnerView = null;
            EnsureCursorHidden();
            _mainScreenMouseVisible = false;

            try { _popupWindow?.Close(); } catch { }
            _popupWindow = null;
            _popupWebView = null;

            var coreWebView = ytWebView.CoreWebView2;

            try
            {
                if (coreWebView != null)
                {
                    _ = coreWebView.ExecuteScriptAsync(
                        "try{document.querySelectorAll('video').forEach(v=>v.pause());}catch(e){}");
                }
            }
            catch { }

            ytWebView.KeyDown -= YtOnKeyDown;
            ytWebView.GotFocus -= OnGenericBrowserMainWebViewGotFocus;
            if (coreWebView != null)
            {
                coreWebView.WebResourceRequested -= YtOnWebResourceRequested;
                coreWebView.WebMessageReceived -= YtOnWebMessageReceived;
                coreWebView.NewWindowRequested -= OnNewWindowRequested;
                coreWebView.DownloadStarting -= OnGenericBrowserDownloadStarting;
                coreWebView.ContainsFullScreenElementChanged -= OnGenericBrowserContainsFullScreenElementChanged;
            }

            if (_genericBrowserKeyboardTarget != GenericBrowserKeyboardTarget.None)
                CloseGenericBrowserKeyboard(false);

            try { _webAppWindow?.Close(); } catch { }
            _webAppWindow = null;
            CloseGenericBrowserExtensionsPopup();
            if (_webAppTutorialPlacementTarget != null)
                _webAppTutorialPlacementTarget.SizeChanged -= OnWebAppTutorialPlacementTargetSizeChanged;
            if (_webAppWindow != null)
            {
                _webAppWindow.LocationChanged -= OnWebAppTutorialHostChanged;
                _webAppWindow.SizeChanged -= OnWebAppTutorialPlacementTargetSizeChanged;
                _webAppWindow.StateChanged -= OnWebAppTutorialHostChanged;
            }
            try { _webAppTutorialWindow?.Close(); } catch { }
            _webAppTutorialWindow = null;
            _webAppTutorialPlacementTarget = null;
            _webAppTutorialOverlay = null;
            _webAppTutorialOpen = false;

            RootGrid.Children.Remove(ytWebView);

            try { ytWebView.Dispose(); } catch { }
            _ytWebView = null;
            _genericBrowserShell = null;
            _genericBrowserToolbarRow = null;
            _genericBrowserToolbar = null;
            _genericBrowserAddressBox = null;
            _genericBrowserAddressPlaceholder = null;
            _genericBrowserBackButton = null;
            _genericBrowserForwardButton = null;
            _genericBrowserWidgetsPanel = null;
            _genericBrowserWidgetsPopup = null;
            _webAppLoadingOverlay = null;
            _webAppLoadingActive = false;
            _webAppLoadingReleaseStarted = false;
            try
            {
                if (_webAppCloseHoldOverlay?.Parent is Panel closeHoldParent)
                    closeHoldParent.Children.Remove(_webAppCloseHoldOverlay);
            }
            catch { }
            try
            {
                if (_webAppCloseHoldPopup != null)
                    _webAppCloseHoldPopup.IsOpen = false;
            }
            catch { }
            _webAppCloseHoldPopup = null;
            _webAppCloseHoldPlacementTarget = null;
            _webAppCloseHoldOverlay = null;
            _webAppCloseHoldProgressArc = null;
            try { _genericBrowserExtensionPopupView?.Dispose(); } catch { }
            _genericBrowserExtensionPopupView = null;
            _genericBrowserEnvironment = null;
            _isGenericBrowserMode = false;
            StopGenericBrowserWebAppUrlCapture();
            ClearWebAppSession();

            webView.Visibility = Visibility.Visible;
            this.WindowState = WindowState.Maximized;
            ForceFocus();
            if (shouldReturnToWebAppForm)
            {
                try
                {
                    webView.CoreWebView2?.PostWebMessageAsString(
                        "{\"type\":\"webAppBrowserCaptureCanceled\"}");
                }
                catch { }
            }
            webView.CoreWebView2?.PostWebMessageAsString("{\"type\":\"mediaAppClosed\"}");
            SendRuntimeSessionsToUI();

            // Só fecha sessão de loja quando a própria loja está rodando em modo web.
            if (shouldFinalizeStoreFromThisWebClose)
                FinalizeStoreSessionFromWebClose();
        }

        // ── Handlers ─────────────────────────────────────────────────────────
        private void YtOnKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Escape || e.Key == Key.BrowserBack)
            {
                if (HandleGenericBrowserExtensionsBack())
                {
                    e.Handled = true;
                    return;
                }

                e.Handled = true;
                if (_ytWebView?.CoreWebView2 != null)
                {
                    if (_ytWebView.CoreWebView2.CanGoBack)
                    {
                        _ytWebView.CoreWebView2.GoBack();
                    }
                }
            }
        }

        private void YtOnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            var msg = e.TryGetWebMessageAsString();
            if (msg == null) return;

            bool isPopup = (_popupWebView != null && sender == _popupWebView.CoreWebView2);
            WebView2 senderView = isPopup ? _popupWebView! : _ytWebView!;

            if (_isGenericBrowserMode && !isPopup && msg.StartsWith("native_vkb_open:"))
            {
                if (DateTime.UtcNow < _genericBrowserVkbSuppressUntilUtc)
                    return;

                try
                {
                    string payload = Uri.UnescapeDataString(msg["native_vkb_open:".Length..]);
                    var node = JsonNode.Parse(payload);
                    double bottom = node?["bottom"]?.GetValue<double>() ?? 0;
                    double top = node?["top"]?.GetValue<double>() ?? bottom;
                    int screenY = GenericBrowserWebYToScreen(bottom > 0 ? bottom : top);
                    Dispatcher.Invoke(() => OpenGenericBrowserWebKeyboard(screenY));
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[DoorpiBrowser] Falha ao abrir VKB nativo: " + ex.Message);
                }
                return;
            }

            if (_isGenericBrowserMode && !isPopup && msg == "native_vkb_closed")
            {
                Dispatcher.Invoke(() =>
                {
                    if (_genericBrowserKeyboardTarget == GenericBrowserKeyboardTarget.WebInput)
                        CloseGenericBrowserKeyboard(false);
                });
                return;
            }

            if (msg == "vkb_opened")
            {
                _vkbIsOpen = true;
                _vkbOwnerView = senderView;
                _vkbHasFocus = true;
                return;
            }
            if (msg == "vkb_closed")
            {
                _vkbIsOpen = false;
                _vkbOwnerView = null;
                _vkbHasFocus = false;
                return;
            }
            else if (msg.StartsWith("smtc:"))
            {
                var parts = msg.Split(':', 4);
                if (parts.Length < 2) return;

                string smtcTitle = parts.Length > 2 ? Uri.UnescapeDataString(parts[2]) : "";
                string smtcArtist = parts.Length > 3 ? Uri.UnescapeDataString(parts[3]) : "";

                if (parts[1] == "playing" && !string.IsNullOrWhiteSpace(smtcTitle))
                    DiscordRpcManager.Instance.UpdateState("media", _currentWebAppUrl ?? "", smtcTitle, smtcArtist);
            }
            if (msg == "player_loaded")
            {
                Dispatcher.Invoke(() => { if (_ytWebView != null) _ytWebView.ZoomFactor = 1.0; });
            }
            else if (msg == "close_app")
            {
                Dispatcher.Invoke(() => { if (isPopup) _popupWindow?.Close(); else CloseYouTubeInline(); });
            }
            else if (msg == "gp_right_click")
            {
                mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
            }
            else if (msg.StartsWith("copy_api_key:"))
            {
                if (!IsWebMessageFromHost(e, "www.steamgriddb.com")) return;
                string key = msg["copy_api_key:".Length..];
                Dispatcher.Invoke(() =>
                {
                    try { System.Windows.Clipboard.SetText(key); }
                    catch (Exception ex) { Debug.WriteLine($"[Doorpi] Erro ao copiar: {ex.Message}"); }
                });
            }
            else if (msg.StartsWith("auto_install_extension:"))
            {
                if (!IsWebMessageFromHost(e, "chromewebstore.google.com")) return;
                string extUrl = msg["auto_install_extension:".Length..];
                Dispatcher.Invoke(() =>
                {
                    try
                    {
                        System.Windows.Clipboard.SetText(extUrl);
                        webView.CoreWebView2.PostWebMessageAsString(
                            System.Text.Json.JsonSerializer.Serialize(new { type = "clipboardText", text = extUrl }));
                    }
                    catch { }
                });
            }
            else if (msg.StartsWith("yt_state:"))
            {
                LogYouTubeTvState(msg["yt_state:".Length..]);
            }
            else if (msg == "doorpi_profile_hacked_done") { /* ack */ }
        }

        private static void LogYouTubeTvState(string payload)
        {
            try
            {
                string dir = DoorpiPaths.LogsFolder;
                Directory.CreateDirectory(dir);

                string line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {payload}{Environment.NewLine}";
                File.AppendAllText(Path.Combine(dir, "youtube-tv-state.log"), line);
                Debug.WriteLine("[YouTubeTV] " + payload);
            }
            catch { }
        }

        private static bool IsWebMessageFromHost(CoreWebView2WebMessageReceivedEventArgs e, string expectedHost)
        {
            try
            {
                if (!Uri.TryCreate(e.Source, UriKind.Absolute, out var source))
                    return false;

                return string.Equals(source.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
                       string.Equals(source.Host, expectedHost, StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        private void YtOnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
        {
            try
            {
                var uriStr = e.Request.Uri;
                if (string.IsNullOrEmpty(uriStr)) return;

                // ── Bloqueia trackers/ads que crasham o React do SteamGridDB ──────────
                if (uriStr.Contains("crwdcntrl.net") ||
                    uriStr.Contains("eyeota.") ||
                    uriStr.Contains("freestar.") ||
                    uriStr.Contains("ramp.js") ||
                    uriStr.Contains("playwire.com") ||
                    uriStr.Contains("confiant.") ||
                    uriStr.Contains("adsafeprotected"))
                {
                    YtBlockRequest(e);
                    return;
                }
                // ── EasyList — só bloqueia no YouTube TV ─────────────────────────────
                if (_isCurrentSiteYouTube && IsBlockedByEasyList(uriStr))
                {
                    YtBlockRequest(e);
                    return;
                }

                if (!_isCurrentSiteYouTube) return;


                // Apenas injeta o User-Agent do PS4 para manter a interface de TV ...
                if (uriStr.Contains("youtube.com") || uriStr.Contains("ytimg.com") ||
                    uriStr.Contains("googlevideo.com") || uriStr.Contains("yt3.ggpht.com"))
                {
                    e.Request.Headers.SetHeader("User-Agent", YT_UA);
                }
            }
            catch { }
        }

        private void YtBlockRequest(CoreWebView2WebResourceRequestedEventArgs e)
        {
            if (_ytWebView?.CoreWebView2?.Environment == null) return;
            string headers = "Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\nAccess-Control-Allow-Headers: *";
            e.Response = _ytWebView.CoreWebView2.Environment.CreateWebResourceResponse(null, 204, "No Content", headers);
        }

        private static async Task YtInjectAdBlockerAsync(CoreWebView2 cw)
        {
            const string script = @"
(function() {
    if (window.__doorpiInjected) return;
    window.__doorpiInjected = true;

    let originalYtcfgSet = null;
    let _ytcfg = window.ytcfg;
    Object.defineProperty(window, 'ytcfg', {
        get: function() { return _ytcfg; },
        set: function(newValue) {
            _ytcfg = newValue;
            if (_ytcfg && typeof _ytcfg.set === 'function') {
                if (!originalYtcfgSet) {
                    originalYtcfgSet = _ytcfg.set;
                    _ytcfg.set = function() {
                        let args = Array.prototype.slice.call(arguments);
                        let config = args[0];
                        if (typeof config === 'object' && config !== null) {
                            if (config.INNERTUBE_CONTEXT && config.INNERTUBE_CONTEXT.client) {
                                config.INNERTUBE_CONTEXT.client.platform = 'DESKTOP';
                                config.INNERTUBE_CONTEXT.client.clientFormFactor = 'UNKNOWN_FORM_FACTOR';
                                config.INNERTUBE_CONTEXT.client.osName = 'Windows';
                                config.INNERTUBE_CONTEXT.client.deviceMake = 'Doorpi';
                            }
                        }
                        return originalYtcfgSet.apply(this, args);
                    };
                }
            }
        },
        configurable: true
    });

    function overrideClientPayload(bodyStr) {
        try {
            let json = JSON.parse(bodyStr);
            if (json.context && json.context.client) {
                json.context.client.platform = 'DESKTOP';
                json.context.client.clientFormFactor = 'UNKNOWN_FORM_FACTOR';
                json.context.client.osName = 'Windows';
                json.context.client.deviceMake = 'Doorpi';
                return JSON.stringify(json);
            }
        } catch(e) {}
        return bodyStr;
    }

    function processJSON(obj) {
        if (!obj || typeof obj !== 'object') return false;
        let modified = false;
        if (Array.isArray(obj)) {
            for (let i = obj.length - 1; i >= 0; i--) {
                let item = obj[i];
                if (item && typeof item === 'object') {
                    if (item.tvMastheadAdRenderer || item.adSlotRenderer ||
                        item.promoShelfRenderer   || item.brandVideoSingletonRenderer ||
                        item.statementBannerRenderer) {
                        obj.splice(i, 1); modified = true;
                    } else { if (processJSON(item)) modified = true; }
                }
            }
        } else {
            const adKeys =['adPlacements','adSlots','playerAds','adBreakHeartbeatParams'];
            for (let key of Object.keys(obj)) {
                if (adKeys.includes(key)) { delete obj[key]; modified = true; }
                else if (obj[key] && typeof obj[key] === 'object') {
                    if (processJSON(obj[key])) modified = true;
                }
            }
        }
        return modified;
    }

    const origParse = JSON.parse;
    JSON.parse = function() {
        let res = origParse.apply(this, arguments);
        try { if (res) processJSON(res); } catch(e) {}
        return res;
    };

    const origFetch = window.fetch;
    if (origFetch) {
        window.fetch = async function(...args) {
            let url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
            if (url.includes('/youtubei/v1/') && args[1] && typeof args[1].body === 'string')
                args[1].body = overrideClientPayload(args[1].body);
            const res = await origFetch.apply(this, args);
            if (url.includes('/youtubei/v1/')) {
                try {
                    const json = await res.clone().json();
                    if (processJSON(json))
                        return new Response(JSON.stringify(json), {
                            status: res.status, statusText: res.statusText, headers: res.headers
                        });
                } catch(e) {}
            }
            return res;
        };
    }

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function() {
        this._reqUrl = arguments[1] || '';
        return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
        if (this._reqUrl && this._reqUrl.includes('/youtubei/v1/') && typeof body === 'string')
            body = overrideClientPayload(body);
        this.addEventListener('readystatechange', function() {
            if (this.readyState === 4 && this._reqUrl.includes('/youtubei/v1/') && !this._doorpiCleaned) {
                try {
                    let isJson = this.responseType === 'json';
                    let data = isJson ? this.response : origParse(this.responseText);
                    if (processJSON(data)) {
                        let str = JSON.stringify(data);
                        Object.defineProperty(this, 'response',     { get: () => isJson ? data : str });
                        Object.defineProperty(this, 'responseText', { get: () => str });
                        this._doorpiCleaned = true;
                    }
                } catch(e) {}
            }
        });
        return origSend.call(this, body);
    };

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
            .then(regs => { for (let r of regs) r.unregister(); })
            .catch(() => {});
    }
})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private static async Task YtInjectZoomHackAsync(CoreWebView2 cw)
        {
            const string script = @"
(function() {
    const check = setInterval(() => {
        if (document.querySelector('.html5-main-video')) {
            window.chrome.webview.postMessage('player_loaded');
            clearInterval(check);
        }
    }, 500);
})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private static async Task YtInjectGamepadAsync(CoreWebView2 cw)
        {
            const string script = @"
(function() {
    if (window.__doorpiGamepadInjected) return;
    window.__doorpiGamepadInjected = true;

    const doorpiGetGamepads = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : null;
    try {
        Object.defineProperty(navigator, 'getGamepads', {
            value: function() { return []; },
            configurable: true
        });
    } catch(_) {}
    try {
        Object.defineProperty(Navigator.prototype, 'getGamepads', {
            value: function() { return []; },
            configurable: true
        });
    } catch(_) {}
    try {
        window.addEventListener('gamepadconnected', e => e.stopImmediatePropagation(), true);
        window.addEventListener('gamepaddisconnected', e => e.stopImmediatePropagation(), true);
    } catch(_) {}

    if (window.top !== window) return;

    let buttonStates = {}, buttonHoldTimes = {}, buttonRepeatCount = {};
    let lastFireByKey = {};
    const YT_INITIAL_REPEAT_MS = 700;
    const YT_REPEAT_MS = 130;

    function fireKey(code, key) {
        const now = Date.now();
        if (key !== 'Escape' && lastFireByKey[key] && now - lastFireByKey[key] < 160) return;
        lastFireByKey[key] = now;

        document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: code, which: code, key: key }));
        setTimeout(() => {
            document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, keyCode: code, which: code, key: key }));
        }, 20);
    }

    window.handleBackButton = function() {
        fireKey(27, 'Escape');
    };

    function processButton(idx, pressed, code, key) {
        if (idx === 1) {
            if (pressed && !buttonStates[idx])  { window.handleBackButton(); buttonStates[idx] = true; }
            else if (!pressed)                    buttonStates[idx] = false;
            return;
        }
        if (pressed) {
            if (!buttonStates[idx]) {
                fireKey(code, key);
                buttonStates[idx] = true; buttonHoldTimes[idx] = Date.now(); buttonRepeatCount[idx] = 0;
            } else {
                let held = Date.now() - buttonHoldTimes[idx];
                if (held > YT_INITIAL_REPEAT_MS) {
                    let expected = Math.floor((held - YT_INITIAL_REPEAT_MS) / YT_REPEAT_MS);
                    if (expected > buttonRepeatCount[idx]) { fireKey(code, key); buttonRepeatCount[idx] = expected; }
                }
            }
        } else { buttonStates[idx] = false; }
    }

    const map = {
        0:[13,'Enter'], 2:[170,'*'],
        4:[115,'F4'],   5:[116,'F5'], 6:[113,'F2'], 7:[114,'F3'],
        12:[38,'ArrowUp'], 13:[40,'ArrowDown'], 14:[37,'ArrowLeft'], 15:[39,'ArrowRight'],
    };

    function pollGamepad() {
        try {
            const gp = (doorpiGetGamepads?.() ?? [])[0];
            if (gp && document.hasFocus()) {
                for (const [idx,[code,key]] of Object.entries(map))
                    processButton(Number(idx), !!gp.buttons[idx]?.pressed, code, key);
                const dpadUp = !!gp.buttons[12]?.pressed;
                const dpadDown = !!gp.buttons[13]?.pressed;
                const dpadLeft = !!gp.buttons[14]?.pressed;
                const dpadRight = !!gp.buttons[15]?.pressed;
                const axisX = gp.axes[0] || 0;
                const axisY = gp.axes[1] || 0;
                processButton(100, !dpadUp && !dpadDown && axisY < -0.5, 38, 'ArrowUp');
                processButton(101, !dpadUp && !dpadDown && axisY >  0.5, 40, 'ArrowDown');
                processButton(102, !dpadLeft && !dpadRight && axisX < -0.5, 37, 'ArrowLeft');
                processButton(103, !dpadLeft && !dpadRight && axisX >  0.5, 39, 'ArrowRight');
                processButton(1, !!gp.buttons[1]?.pressed, 27, 'Escape');
            }
        } catch(_) {}
        requestAnimationFrame(pollGamepad);
    }
    pollGamepad();
})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private static async Task YtInjectStateLoggerAsync(CoreWebView2 cw)
        {
            const string script = @"
(function() {
    if (window.__doorpiYtStateLogger) return;
    window.__doorpiYtStateLogger = true;

    let _last = '';
    let _ticks = 0;

    function has(sel) {
        try {
            if (document.querySelector(sel)) return true;
            for (const el of document.querySelectorAll('*')) {
                if (el.shadowRoot && el.shadowRoot.querySelector(sel)) return true;
            }
        } catch(_) {}
        return false;
    }

    function count(sel) {
        try {
            let total = document.querySelectorAll(sel).length;
            for (const el of document.querySelectorAll('*')) {
                if (el.shadowRoot) total += el.shadowRoot.querySelectorAll(sel).length;
            }
            return total;
        } catch(_) { return -1; }
    }

    function pageTypeFromBody() {
        try {
            const classes = Array.from(document.body?.classList || []);
            return classes.filter(c => c.indexOf('WEB_PAGE_TYPE_') === 0).join('|');
        } catch(_) { return ''; }
    }

    function post(reason) {
        try {
            const payload = {
                reason,
                href: location.href,
                pathname: location.pathname,
                hash: location.hash,
                title: document.title || '',
                readyState: document.readyState,
                bodyClasses: Array.from(document.body?.classList || []).slice(0, 40).join(' '),
                pageType: pageTypeFromBody(),
                ytcfgPageType: (window.ytcfg?.get?.('PAGE_TYPE') || window.ytcfg?.get?.('WEB_PAGE_TYPE') || ''),
                loggedIn: window.ytcfg?.get?.('LOGGED_IN'),
                hasApp: has('ytlr-app'),
                hasAccountSelector: has('ytlr-account-selector'),
                hasWelcome: has('ytlr-welcome'),
                hasWatch: has('ytlr-watch,#watch'),
                hasPlayer: has('ytlr-player,video'),
                accountSelectorCount: count('ytlr-account-selector'),
                hostCount: count('ytlr-app,ytlr-watch,ytlr-browse,ytlr-guide')
            };
            const key = JSON.stringify(payload);
            if (key === _last && reason !== 'heartbeat') return;
            _last = key;
            window.chrome.webview.postMessage('yt_state:' + key);
        } catch(_) {}
    }

    post('document-created');
    document.addEventListener('DOMContentLoaded', () => post('dom-content-loaded'), true);
    window.addEventListener('load', () => post('window-load'), true);
    window.addEventListener('hashchange', () => post('hashchange'), true);
    window.addEventListener('popstate', () => post('popstate'), true);

    const observer = new MutationObserver(() => post('mutation'));
    const waitBody = setInterval(() => {
        try {
            if (!document.body) return;
            clearInterval(waitBody);
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
            post('observer-start');
        } catch(_) {}
    }, 50);

    const heartbeat = setInterval(() => {
        _ticks++;
        post(_ticks % 5 === 0 ? 'heartbeat' : 'poll');
        if (_ticks >= 60) clearInterval(heartbeat);
    }, 500);
})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private static async Task YtInjectForceUserSelectionAsync(CoreWebView2 cw)
        {
            const string script = @"
(function() {
    try {
        if (sessionStorage.getItem('doorpi_profile_hacked_once')) return;
        sessionStorage.setItem('doorpi_profile_hacked_once', '1');
    } catch(e) {}

    if (window.__doorpiProfileHacked) return;
    window.__doorpiProfileHacked = true;

    function showOverlay() {
        try {
            if (document.getElementById('doorpi-overlay-solid')) return;
            const ov = document.createElement('div');
            ov.id = 'doorpi-overlay-solid';
            ov.style.cssText = 'position:fixed;inset:0;background:#282828;z-index:2147483647;pointer-events:auto;opacity:1;transition:none';
            (document.documentElement || document.body).appendChild(ov);
        } catch(e) {}
    }

    function hideOverlay() {
        try {
            const ov = document.getElementById('doorpi-overlay-solid');
            if (ov) ov.remove();
        } catch(e) {}
    }

    function isAccountSelector() {
        try { return !!(document.body?.classList?.contains('WEB_PAGE_TYPE_ACCOUNT_SELECTOR')); }
        catch(e) { return false; }
    }
    function isWelcomePage() {
        try {
            return !!(document.body?.classList?.contains('WEB_PAGE_TYPE_WELCOME') ||
                      document.body?.classList?.contains('WEB_PAGE_TYPE_CHANNEL_CREATION'));
        } catch(e) { return false; }
    }
    function isBrowsePage() {
        try {
            return !!(document.body?.classList?.contains('WEB_PAGE_TYPE_BROWSE') ||
                      document.body?.classList?.contains('WEB_PAGE_TYPE_WATCH'));
        } catch(e) { return false; }
    }
    function isDone() { return isAccountSelector() || isWelcomePage(); }

    function logHack(action) {
        try {
            window.chrome.webview.postMessage('yt_state:' + JSON.stringify({
                reason: 'profile-hack-' + action,
                href: location.href,
                pathname: location.pathname,
                hash: location.hash,
                title: document.title || '',
                bodyClasses: Array.from(document.body?.classList || []).slice(0, 40).join(' '),
                isAccountSelector: isAccountSelector(),
                isWelcomePage: isWelcomePage()
            }));
        } catch(e) {}
    }

    function fireEscape() {
        logHack('escape');
        try {
            document.dispatchEvent(new KeyboardEvent('keydown', { bubbles:true, cancelable:true, keyCode:27, which:27, key:'Escape' }));
            setTimeout(() => {
                document.dispatchEvent(new KeyboardEvent('keyup', { bubbles:true, cancelable:true, keyCode:27, which:27, key:'Escape' }));
            }, 10);
        } catch(e) {}
    }

    function finish() {
        logHack('done');
        hideOverlay();
        try { window.chrome.webview.postMessage('doorpi_profile_hacked_done'); } catch(e) {}
    }

    function startLoop() {
        if (isDone()) { finish(); return; }
        logHack('start');
        showOverlay();

        const safetyTimer = setTimeout(() => {
            clearInterval(poller);
            logHack('timeout');
            hideOverlay();
            try { window.chrome.webview.postMessage('doorpi_profile_hacked_done'); } catch(e) {}
        }, 60000);

        const poller = setInterval(() => {
            try {
                if (isWelcomePage()) {
                    clearInterval(poller); clearTimeout(safetyTimer);
                    hideOverlay();
                    try { window.chrome.webview.postMessage('doorpi_profile_hacked_done'); } catch(e) {}
                    return;
                }
                if (isAccountSelector()) {
                    clearInterval(poller); clearTimeout(safetyTimer);
                    finish(); return;
                }
                fireEscape(); fireEscape();
            } catch(e) {}
        }, 80);
    }

    function waitForApp() {
        const selectors = 'ytlr-app, ytlr-watch, #watch, .ytlr-masthead-renderer, #thumbnail-items';
        if (isBrowsePage() || document.querySelector(selectors)) { startLoop(); return; }

        const observer = new MutationObserver(() => {
            try {
                if (isBrowsePage() || document.querySelector(selectors)) { observer.disconnect(); startLoop(); }
            } catch(e) {}
        });

        const waitBody = setInterval(() => {
            try {
                if (document.body) {
                    clearInterval(waitBody);
                    if (isDone()) { finish(); return; }
                    if (isBrowsePage() || document.querySelector(selectors)) { startLoop(); return; }
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            } catch(e) {}
        }, 16);
    }

    try {
        window.addEventListener('beforeunload', hideOverlay);
        window.addEventListener('unload',       hideOverlay);
    } catch(e) {}

    waitForApp();
})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private static async Task YtInjectUltrawideFixAsync(CoreWebView2 cw)
        {
            const string script = @"
(function() {
    if (window.__doorpiUltrawide) return;
    window.__doorpiUltrawide = true;

    const SELECTORS =[
        '#container', 'ytlr-tv-surface-content-renderer', 'yt-virtual-list',
        'ytlr-animated-overlay', 'ytlr-rich-grid-renderer',
        'ytlr-two-column-browse-results-renderer', 'ytlr-section-list-renderer',
        'ytlr-item-section-renderer', 'ytlr-horizontal-list-renderer',
    ];

    function isAccountPage() {
        return !!(document.body?.classList?.contains('WEB_PAGE_TYPE_ACCOUNT_SELECTOR') ||
                  document.body?.classList?.contains('WEB_PAGE_TYPE_WELCOME')          ||
                  document.body?.classList?.contains('WEB_PAGE_TYPE_CHANNEL_CREATION'));
    }

    function applyFix(el)        { if (!el) return; el.style.setProperty('width','100vw','important'); el.style.setProperty('max-width','100vw','important'); }
    function applyAccountFix(el) { if (!el) return; applyFix(el); el.style.setProperty('background-size','cover','important'); }
    function applyLogoFix(el)    { if (!el) return; el.style.setProperty('left','86vw','important'); }

    function fakeScrollToForceLoad() {
        document.querySelectorAll('ytlr-horizontal-list-renderer, yt-virtual-list').forEach(el => {
            try { el.scrollTop += 1; requestAnimationFrame(() => { el.scrollTop -= 1; }); } catch(_) {}
        });
    }

    function forceVirtualListRecalc() {
        const targets =[
            ...document.querySelectorAll('yt-virtual-list'),
            ...document.querySelectorAll('ytlr-rich-grid-renderer'),
            ...document.querySelectorAll('ytlr-section-list-renderer'),
            ...document.querySelectorAll('ytlr-item-section-renderer'),
            ...document.querySelectorAll('ytlr-horizontal-list-renderer'),
        ];
        targets.forEach(el => {
            try {
                const orig = el.getBoundingClientRect.bind(el);
                el.getBoundingClientRect = function() {
                    const r = orig();
                    return { ...r, width: window.innerWidth, right: window.innerWidth, toJSON: r.toJSON };
                };
            } catch(_) {}
            try { const ro = new ResizeObserver(()=>{}); ro.observe(el); ro.unobserve(el); ro.disconnect(); } catch(_) {}
            try { el.dispatchEvent(new Event('resize', { bubbles: false })); } catch(_) {}
            try { el.updateLayoutParameters?.(); } catch(_) {}
            try { el.requestUpdate?.(); } catch(_) {}
        });
        window.dispatchEvent(new UIEvent('resize', { view: window, bubbles: true }));
        setTimeout(fakeScrollToForceLoad, 50);
    }

    let _recalcScheduled = false;
    function scheduleRecalc() {
        if (_recalcScheduled) return;
        _recalcScheduled = true;
        setTimeout(() => {
            _recalcScheduled = false;
            forceVirtualListRecalc();
            setTimeout(forceVirtualListRecalc, 600);
        }, 200);
    }

    function tryFix() {
        document.querySelectorAll('ytlr-logo-entity').forEach(applyLogoFix);
        document.querySelectorAll('*').forEach(el => {
            if (!el.shadowRoot) return;
            el.shadowRoot.querySelectorAll('ytlr-logo-entity').forEach(applyLogoFix);
        });
        document.querySelectorAll('ytlr-account-selector').forEach(applyAccountFix);
        document.querySelectorAll('*').forEach(el => {
            if (!el.shadowRoot) return;
            el.shadowRoot.querySelectorAll('ytlr-account-selector').forEach(applyAccountFix);
        });
        if (isAccountPage()) return;
        let applied = false;
        SELECTORS.forEach(sel => { document.querySelectorAll(sel).forEach(el => { applyFix(el); applied = true; }); });
        document.querySelectorAll('*').forEach(el => {
            if (!el.shadowRoot) return;
            SELECTORS.forEach(sel => { el.shadowRoot.querySelectorAll(sel).forEach(el2 => { applyFix(el2); applied = true; }); });
        });
        if (applied) scheduleRecalc();
    }

    const observer = new MutationObserver(tryFix);
    function start() { tryFix(); observer.observe(document.body, { childList: true, subtree: true }); }
    if (document.body) start();
    else { const wait = setInterval(() => { if (document.body) { clearInterval(wait); start(); } }, 16); }
})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private static async Task YtInjectPlayerBackgroundAsync(CoreWebView2 cw)
        {
            const string script = @"
(function() {
    if (window.__doorpiPlayerBg) return;
    window.__doorpiPlayerBg = true;

    const BLUR_PX = 24, OPACITY = 0.55, BG_ID = 'doorpi-player-bg', STYLE_ID = 'doorpi-player-style';
    let _canvas = null, _ctx = null, _src = null;

    function injectCSS() {
        if (document.getElementById(STYLE_ID)) return;
        const sn = document.querySelector('style[nonce]');
        const nonce = sn?.nonce || sn?.getAttribute('nonce') || '';
        const el = document.createElement('style'); el.id = STYLE_ID;
        if (nonce) el.nonce = nonce;
        el.textContent =
            'ytlr-player::before,ytlr-player::after{display:none!important;background:transparent!important;}' +
            'ytlr-player{background:transparent!important;position:relative!important;z-index:0!important;}';
        (document.head || document.documentElement).appendChild(el);
    }

    function ensureBg() {
        if (document.getElementById(BG_ID)) return;
        const bg = document.createElement('div');
        bg.id = BG_ID;
        bg.style.cssText = 'position:fixed!important;inset:0!important;z-index:-1!important;pointer-events:none!important;overflow:hidden!important;';
        _canvas = document.createElement('canvas');
        _canvas.width = window.innerWidth || 1920;
        _canvas.height = window.innerHeight || 1080;
        _canvas.style.cssText =
            'position:absolute!important;inset:0!important;width:100%!important;height:100%!important;' +
            'filter:blur(' + BLUR_PX + 'px)!important;opacity:' + OPACITY + '!important;transform:scale(1.08)!important;';
        _ctx = _canvas.getContext('2d');
        _ctx.fillStyle = '#0f0f0f';
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        bg.appendChild(_canvas);
        document.body.appendChild(bg);
        window.addEventListener('resize', () => {
            if (!_canvas) return;
            _canvas.width = window.innerWidth; _canvas.height = window.innerHeight;
            if (!_src) { _ctx.fillStyle = '#0f0f0f'; _ctx.fillRect(0, 0, _canvas.width, _canvas.height); }
        }, { passive: true });
    }

    function drawLoop() {
        requestAnimationFrame(drawLoop);
        if (!_src || !_ctx || !_canvas || _src.readyState < 2) return;
        try { _ctx.drawImage(_src, 0, 0, _canvas.width, _canvas.height); } catch(e) {}
    }

    let _currentVideo = null;
    function findVideo() {
        let v = document.querySelector('video.html5-main-video');
        if (v) return v;
        for (const host of document.querySelectorAll('*')) {
            if (!host.shadowRoot) continue;
            v = host.shadowRoot.querySelector('video.html5-main-video');
            if (v) return v;
        }
        return null;
    }

    const domObserver = new MutationObserver(() => {
        const found = findVideo();
        if (found && found !== _currentVideo) {
            _currentVideo = found;
            const tryStart = () => { _src = found; };
            if (found.readyState >= 2) tryStart();
            else {
                found.addEventListener('loadeddata', tryStart, { once: true, passive: true });
                found.addEventListener('playing',    tryStart, { once: true, passive: true });
            }
        } else if (!found && _currentVideo) { _currentVideo = null; _src = null; }
    });

    function start() {
        if (!document.body) { setTimeout(start, 50); return; }
        ensureBg(); injectCSS(); drawLoop();
        domObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    start();
})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }
    }
}
