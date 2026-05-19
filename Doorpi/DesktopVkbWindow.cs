using System;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Threading;

namespace Doorpi
{
    public enum VkbLayer { Alpha, Special }

    public class VkbKey
    {
        public string Value { get; set; }
        public string Display { get; set; }
        public double Width { get; set; }
        public bool IsAction { get; set; }
        public string ControllerIcon { get; set; }
    }

    public enum VkbHoldAction
    {
        MoveUp,
        MoveDown,
        MoveLeft,
        MoveRight,
        Press,
        CursorLeft,
        CursorRight,
        ToggleLayer
    }

    public class DesktopVkbWindow : Window
    {
        // ── Strings de Localização ──
        public string StrBackspace { get; private set; } = "Apagar";
        public string StrEnter { get; private set; } = "Enter";
        public string StrClose { get; private set; } = "Fechar";
        public string StrShift { get; private set; } = "Maiúsc";
        public string StrSpace { get; private set; } = "Espaço";
        public string StrSym { get; private set; } = "&123";
        public string StrAbc { get; private set; } = "ABC";

        // ── Win32 & Ocultação do Teclado Nativo ──
        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_NOACTIVATE = 0x08000000;
        private const int WS_EX_TOOLWINDOW = 0x00000080;

        [DllImport("user32.dll")]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOMOVE = 0x0002;
        private const uint SWP_NOACTIVATE = 0x0010;

        [DllImport("user32.dll")]
        private static extern IntPtr SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        private DispatcherTimer _topmostTimer;

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            var helper = new WindowInteropHelper(this);
            SetWindowLong(helper.Handle, GWL_EXSTYLE, GetWindowLong(helper.Handle, GWL_EXSTYLE) | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW);

            Task.Run(() => {
                try { foreach (var p in System.Diagnostics.Process.GetProcessesByName("TabTip")) p.Kill(); }
                catch { }
            });

            _topmostTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(500) };
            _topmostTimer.Tick += (s, ev) => SetWindowPos(helper.Handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
            _topmostTimer.Start();
        }

        protected override void OnClosed(EventArgs e)
        {
            _topmostTimer?.Stop();
            StopHold();
            base.OnClosed(e);
        }

        public void AutoPosition(int targetY)
        {
            double desiredTop = targetY - Height - 40;
            if (desiredTop < 0)
            {
                desiredTop = targetY + 40;
                if (desiredTop + Height > SystemParameters.PrimaryScreenHeight)
                    desiredTop = SystemParameters.PrimaryScreenHeight - Height - 50;
            }
            this.Top = desiredTop;
        }

        public void SetFixedPosition() => this.Top = SystemParameters.PrimaryScreenHeight - Height - 50;
        public void TogglePosition() => this.Top = this.Top < 100 ? SystemParameters.PrimaryScreenHeight - Height - 50 : 50;

        private VkbKey[][] _alphaKeys;
        private VkbKey[][] _specialKeys;
        private VkbKey[][] CurrentKeys => _layer == VkbLayer.Alpha ? _alphaKeys : _specialKeys;

        private VkbLayer _layer = VkbLayer.Alpha;
        private int _row = 0;
        private int _col = 0;
        private bool _shifted = false;

        // ── Variável de estado para a Acentuação (Dead Keys) ──
        private string _pendingAccent = null;

        private Grid _grid;
        private Border[][] _uiKeys;

        private readonly DispatcherTimer _holdTimer = new DispatcherTimer();
        private Action _pendingRepeat;
        private bool _initialFired;

        private const int HOLD_INITIAL_MS = 380;
        private const int HOLD_REPEAT_MS = 75;

        public event Action<string> OnKeyPressed;
        public event Action OnCloseRequested;

        public DesktopVkbWindow()
        {
            BuildKeyLayouts();
            WireHoldTimer();

            WindowStyle = WindowStyle.None;
            AllowsTransparency = true;
            Background = new SolidColorBrush(Color.FromArgb(230, 10, 12, 18));
            Topmost = true;
            ShowActivated = false;
            Width = 1050;
            Height = 400;
            WindowStartupLocation = WindowStartupLocation.Manual;
            Left = (SystemParameters.PrimaryScreenWidth - Width) / 2;
            Top = SystemParameters.PrimaryScreenHeight - Height - 50;

            Effect = new DropShadowEffect { Color = Colors.Black, BlurRadius = 40, ShadowDepth = 15, Opacity = 0.7 };

            BuildUI();
            RefreshVisuals();
        }

        public void SetLocalization(string bksp, string enter, string close, string shift, string space, string sym, string abc)
        {
            StrBackspace = bksp ?? StrBackspace;
            StrEnter = enter ?? StrEnter;
            StrClose = close ?? StrClose;
            StrShift = shift ?? StrShift;
            StrSpace = space ?? StrSpace;
            StrSym = sym ?? StrSym;
            StrAbc = abc ?? StrAbc;

            BuildKeyLayouts();
            if (_grid != null) RebuildUI();
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  LAYOUT: Acentos inseridos mantendo o cálculo de matriz/distância
        // ─────────────────────────────────────────────────────────────────────────
        private void BuildKeyLayouts()
        {
            const double U1 = 65;
            const double U2 = 138;
            const double U7 = 503;

            VkbKey K(string val, string disp = null, double w = U1, bool act = false, string icon = null) =>
                new VkbKey { Value = val, Display = disp ?? val, Width = w, IsAction = act, ControllerIcon = icon };

            _alphaKeys = new[]
            {
                new[] { K("1"), K("2"), K("3"), K("4"), K("5"), K("6"), K("7"), K("8"), K("9"), K("0"), K("-"), K("BKSP", StrBackspace, U2, true, "X") },
                // Adicionado ´ (Agudo)
                new[] { K("Q"), K("W"), K("E"), K("R"), K("T"), K("Y"), K("U"), K("I"), K("O"), K("P"), K("´"), K("ENTER", StrEnter, U2, true, "START") },
                // Adicionado ~ (Til)
                new[] { K("A"), K("S"), K("D"), K("F"), K("G"), K("H"), K("J"), K("K"), K("L"), K("Ç"), K("~"), K("CANCEL", StrClose, U2, true, "B") },
                // Adicionado ^ (Circunflexo)
                new[] { K("SHIFT", StrShift, U2, true, "L3"), K("Z"), K("X"), K("C"), K("V"), K("B"), K("N"), K("M"), K(","), K("."), K("^"), K("?") },
                new[] { K("SYM", StrSym, U2, true, "LT"), K("CURSOR_LEFT", "←", U1, true, "LB"), K("SPACE", StrSpace, U7, true, "Y"), K("CURSOR_RIGHT", "→", U1, true, "RB"), K(".com", ".com", U2, true) }
            };

            _specialKeys = new[]
            {
                new[] { K("!"), K("@"), K("#"), K("$"), K("%"), K("&"), K("*"), K("("), K(")"), K("_"), K("+"), K("BKSP", StrBackspace, U2, true, "X") },
                // Adicionado ` (Crase)
                new[] { K("/"), K("\\"), K("|"), K("="), K("÷"), K("×"), K("{"), K("}"), K("["), K("]"), K("`"), K("ENTER", StrEnter, U2, true, "START") },
                // Adicionado ¨ (Trema)
                new[] { K(":"), K(";"), K("\""), K("'"), K("€"), K("£"), K("¥"), K("©"), K("®"), K("°"), K("¨"), K("CANCEL", StrClose, U2, true, "B") },
                new[] { K("SHIFT", StrShift, U2, true, "L3"), K("<"), K(">"), K("¿"), K("¡"), K("~"), K("´"), K("^"), K(","), K("."), K("?"), K("-") },
                new[] { K("ABC", StrAbc, U2, true, "LT"), K("CURSOR_LEFT", "←", U1, true, "LB"), K("SPACE", StrSpace, U7, true, "Y"), K("CURSOR_RIGHT", "→", U1, true, "RB"), K(".com", ".com", U2, true) }
            };
        }

        private UIElement CreateControllerIcon(string iconType)
        {
            if (string.IsNullOrEmpty(iconType)) return null;

            var container = new Border { Margin = new Thickness(0, 4, 6, 0), HorizontalAlignment = HorizontalAlignment.Right, VerticalAlignment = VerticalAlignment.Top };
            var text = new TextBlock { Foreground = Brushes.White, FontWeight = FontWeights.Bold, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center };

            if (iconType == "X" || iconType == "Y" || iconType == "B" || iconType == "L3")
            {
                container.Width = 18; container.Height = 18;
                container.CornerRadius = new CornerRadius(9);
                text.FontSize = 10;
                text.Text = iconType;

                if (iconType == "X") container.Background = new SolidColorBrush(Color.FromRgb(45, 156, 219));
                if (iconType == "Y") container.Background = new SolidColorBrush(Color.FromRgb(242, 201, 76));
                if (iconType == "B") container.Background = new SolidColorBrush(Color.FromRgb(235, 87, 87));
                if (iconType == "L3") { container.Background = new SolidColorBrush(Color.FromRgb(80, 80, 80)); text.Text = "L"; text.FontSize = 9; }

                container.Child = text;
            }
            else if (iconType == "START")
            {
                var stack = new StackPanel { VerticalAlignment = VerticalAlignment.Center, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 2, 0, 0) };
                for (int i = 0; i < 3; i++) stack.Children.Add(new Border { Width = 12, Height = 2, Background = Brushes.White, Margin = new Thickness(0, 0, 0, 2), CornerRadius = new CornerRadius(1) });
                container.Child = stack;
            }
            else
            {
                container.Background = new SolidColorBrush(Color.FromRgb(80, 80, 80));
                container.CornerRadius = new CornerRadius(4);
                container.Padding = new Thickness(4, 1, 4, 1);
                text.FontSize = 9;
                text.Text = iconType;
                container.Child = text;
            }

            return container;
        }

        private void WireHoldTimer()
        {
            _holdTimer.Tick += (_, __) => {
                if (!_initialFired) { _initialFired = true; _holdTimer.Interval = TimeSpan.FromMilliseconds(HOLD_REPEAT_MS); }
                _pendingRepeat?.Invoke();
            };
        }

        public void BeginHold(VkbHoldAction action)
        {
            StopHold();
            Action act = BuildAction(action);
            _pendingRepeat = act;
            _initialFired = false;
            _holdTimer.Interval = TimeSpan.FromMilliseconds(HOLD_INITIAL_MS);
            _holdTimer.Start();
            act?.Invoke();
        }

        public void EndHold(VkbHoldAction action) => StopHold();
        public void StopHold() { _holdTimer.Stop(); _pendingRepeat = null; }

        private Action BuildAction(VkbHoldAction action)
        {
            switch (action)
            {
                case VkbHoldAction.MoveUp: return () => MoveSelection(-1, 0);
                case VkbHoldAction.MoveDown: return () => MoveSelection(1, 0);
                case VkbHoldAction.MoveLeft: return () => MoveSelection(0, -1);
                case VkbHoldAction.MoveRight: return () => MoveSelection(0, 1);
                case VkbHoldAction.Press: return PressCurrentKey;
                case VkbHoldAction.CursorLeft: return () => { FlushPendingAccent(); OnKeyPressed?.Invoke("CURSOR_LEFT"); };
                case VkbHoldAction.CursorRight: return () => { FlushPendingAccent(); OnKeyPressed?.Invoke("CURSOR_RIGHT"); };
                case VkbHoldAction.ToggleLayer: return ToggleAlphaSpecialLayer;
                default: return null;
            }
        }

        public bool ConsumeCancelPress()
        {
            if (!IsVisible) return false;
            OnCloseRequested?.Invoke();
            return true;
        }

        private double GetKeyCenterX(int r, int c)
        {
            double x = 0;
            for (int i = 0; i < c; i++) x += CurrentKeys[r][i].Width + 8;
            x += (CurrentKeys[r][c].Width) / 2.0;
            return x;
        }

        public void MoveSelection(int dr, int dc)
        {
            int newRow = _row;
            int newCol = _col;

            if (dr != 0)
            {
                double currentX = GetKeyCenterX(_row, _col);
                newRow = (_row + dr + CurrentKeys.Length) % CurrentKeys.Length;

                double minDistance = double.MaxValue;
                int bestCol = 0;

                for (int c = 0; c < CurrentKeys[newRow].Length; c++)
                {
                    double testX = GetKeyCenterX(newRow, c);
                    double dist = Math.Abs(testX - currentX);
                    if (dist < minDistance)
                    {
                        minDistance = dist;
                        bestCol = c;
                    }
                }
                newCol = bestCol;
            }

            if (dc != 0)
            {
                newCol += dc;
                int rowLen = CurrentKeys[newRow].Length;
                if (newCol < 0) newCol = rowLen - 1;
                if (newCol >= rowLen) newCol = 0;
            }

            _row = newRow;
            _col = newCol;
            RefreshVisuals();
        }

        public void ToggleShift() { _shifted = !_shifted; RefreshVisuals(); }

        public void ToggleAlphaSpecialLayer()
        {
            StopHold();
            SwitchLayer(_layer == VkbLayer.Alpha ? VkbLayer.Special : VkbLayer.Alpha);
        }

        private void SwitchLayer(VkbLayer layer)
        {
            _layer = layer;
            _shifted = false;
            RebuildUI();
        }

        // ─────────────────────────────────────────────────────────────────────────
        // LÓGICA DE PROCESSAMENTO DO ACENTO (Dead Keys)
        // ─────────────────────────────────────────────────────────────────────────
        private string GetAccentedCharacter(string accent, string letter)
        {
            bool isUpper = char.IsUpper(letter[0]);
            letter = letter.ToLower();
            string result = letter;

            switch (accent)
            {
                case "´":
                    if (letter == "a") result = "á";
                    else if (letter == "e") result = "é";
                    else if (letter == "i") result = "í";
                    else if (letter == "o") result = "ó";
                    else if (letter == "u") result = "ú";
                    else if (letter == "c") result = "ç";
                    break;
                case "~":
                    if (letter == "a") result = "ã";
                    else if (letter == "o") result = "õ";
                    else if (letter == "n") result = "ñ";
                    break;
                case "^":
                    if (letter == "a") result = "â";
                    else if (letter == "e") result = "ê";
                    else if (letter == "i") result = "î";
                    else if (letter == "o") result = "ô";
                    else if (letter == "u") result = "û";
                    break;
                case "`":
                    if (letter == "a") result = "à";
                    else if (letter == "e") result = "è";
                    else if (letter == "i") result = "ì";
                    else if (letter == "o") result = "ò";
                    else if (letter == "u") result = "ù";
                    break;
                case "¨":
                    if (letter == "a") result = "ä";
                    else if (letter == "e") result = "ë";
                    else if (letter == "i") result = "ï";
                    else if (letter == "o") result = "ö";
                    else if (letter == "u") result = "ü";
                    else if (letter == "y") result = "ÿ";
                    break;
            }

            return (result != letter) ? (isUpper ? result.ToUpper() : result) : null;
        }

        private void FlushPendingAccent()
        {
            if (_pendingAccent != null)
            {
                OnKeyPressed?.Invoke(_pendingAccent);
                _pendingAccent = null;
                RefreshVisuals();
            }
        }

        public void PressCurrentKey()
        {
            var key = CurrentKeys[_row][_col].Value;

            switch (key)
            {
                case "SHIFT":
                    StopHold();
                    ToggleShift();
                    break;
                case "SYM":
                case "ABC":
                    ToggleAlphaSpecialLayer();
                    break;
                case "CANCEL":
                    StopHold();
                    _pendingAccent = null;
                    OnCloseRequested?.Invoke();
                    break;
                case "BKSP":
                    if (_pendingAccent != null)
                    {
                        // Se tinha um acento pendente, apenas cancela o acento.
                        _pendingAccent = null;
                        RefreshVisuals();
                    }
                    else
                    {
                        OnKeyPressed?.Invoke("BKSP");
                    }
                    break;
                case "ENTER":
                    FlushPendingAccent();
                    OnKeyPressed?.Invoke("ENTER");
                    break;
                case "SPACE":
                    if (_pendingAccent != null)
                    {
                        // Se apertar espaço depois do acento, digita o acento sozinho
                        OnKeyPressed?.Invoke(_pendingAccent);
                        _pendingAccent = null;
                        RefreshVisuals();
                    }
                    else
                    {
                        OnKeyPressed?.Invoke(" ");
                    }
                    break;
                case "CURSOR_LEFT":
                    FlushPendingAccent();
                    OnKeyPressed?.Invoke("CURSOR_LEFT");
                    break;
                case "CURSOR_RIGHT":
                    FlushPendingAccent();
                    OnKeyPressed?.Invoke("CURSOR_RIGHT");
                    break;

                // Se for um acento (Agudo, Til, Circunflexo, Crase, Trema)
                case "´":
                case "~":
                case "^":
                case "`":
                case "¨":
                    if (_pendingAccent == key)
                    {
                        // Apertou o mesmo acento 2x, digita o acento na tela.
                        OnKeyPressed?.Invoke(key);
                        _pendingAccent = null;
                    }
                    else
                    {
                        // Entra em modo de espera aguardando a vogal.
                        _pendingAccent = key;
                    }
                    RefreshVisuals();
                    break;

                default:
                    string toSend = key;

                    // Tratamento de maiúsculas e minúsculas
                    if (_layer == VkbLayer.Alpha && key.Length == 1 && char.IsLetter(key[0]))
                        toSend = _shifted ? key.ToUpper() : key.ToLower();

                    // Se temos um acento aguardando
                    if (_pendingAccent != null)
                    {
                        if (toSend.Length == 1 && char.IsLetter(toSend[0]))
                        {
                            string accented = GetAccentedCharacter(_pendingAccent, toSend);
                            if (accented != null)
                            {
                                // Combinação funcionou (ex: ´ + A = Á)
                                OnKeyPressed?.Invoke(accented);
                            }
                            else
                            {
                                // Combinação inválida (ex: ´ + Z), digita os dois separados.
                                OnKeyPressed?.Invoke(_pendingAccent);
                                OnKeyPressed?.Invoke(toSend);
                            }
                        }
                        else
                        {
                            // Apertou um símbolo junto com o acento.
                            OnKeyPressed?.Invoke(_pendingAccent);
                            OnKeyPressed?.Invoke(toSend);
                        }

                        _pendingAccent = null; // Reseta após o uso
                        RefreshVisuals();
                    }
                    else
                    {
                        // Teclagem normal
                        OnKeyPressed?.Invoke(toSend);
                    }
                    break;
            }
        }

        private void BuildUI() { _grid = new Grid { Margin = new Thickness(15, 25, 15, 25) }; Content = _grid; PopulateGrid(); }
        private void RebuildUI() { _grid.Children.Clear(); _grid.RowDefinitions.Clear(); PopulateGrid(); }

        private void PopulateGrid()
        {
            var keys = CurrentKeys;
            for (int i = 0; i < keys.Length; i++) _grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

            _uiKeys = new Border[keys.Length][];

            for (int r = 0; r < keys.Length; r++)
            {
                var row = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center };
                _uiKeys[r] = new Border[keys[r].Length];

                for (int c = 0; c < keys[r].Length; c++)
                {
                    var def = keys[r][c];
                    var innerGrid = new Grid();

                    var tb = new TextBlock
                    {
                        Text = def.Display,
                        Foreground = Brushes.White,
                        HorizontalAlignment = HorizontalAlignment.Center,
                        VerticalAlignment = VerticalAlignment.Center,
                        FontSize = def.IsAction ? 14 : 22,
                        FontFamily = new FontFamily("Segoe UI"),
                        FontWeight = def.IsAction ? FontWeights.SemiBold : FontWeights.Normal
                    };
                    innerGrid.Children.Add(tb);

                    var icon = CreateControllerIcon(def.ControllerIcon);
                    if (icon != null) innerGrid.Children.Add(icon);

                    var border = new Border
                    {
                        Width = def.Width,
                        Margin = new Thickness(4),
                        CornerRadius = new CornerRadius(6),
                        Background = new SolidColorBrush(Color.FromRgb(30, 33, 43)),
                        Child = innerGrid
                    };

                    _uiKeys[r][c] = border;
                    row.Children.Add(border);
                }
                Grid.SetRow(row, r);
                _grid.Children.Add(row);
            }
            RefreshVisuals();
        }

        private static readonly SolidColorBrush BrushKeyNormal = new SolidColorBrush(Color.FromRgb(25, 28, 38));
        private static readonly SolidColorBrush BrushKeyAction = new SolidColorBrush(Color.FromRgb(40, 44, 55));
        private static readonly SolidColorBrush BrushKeySpecial = new SolidColorBrush(Color.FromRgb(28, 38, 55));
        private static readonly SolidColorBrush BrushAccentPending = new SolidColorBrush(Color.FromRgb(220, 100, 0)); // Laranja Escuro

        private void RefreshVisuals()
        {
            var keys = CurrentKeys;
            for (int r = 0; r < keys.Length; r++)
            {
                for (int c = 0; c < keys[r].Length; c++)
                {
                    var def = keys[r][c];
                    var border = _uiKeys[r][c];

                    var innerGrid = (Grid)border.Child;
                    var tb = (TextBlock)innerGrid.Children[0];

                    bool focus = (r == _row && c == _col);
                    bool isPendingAccentKey = (def.Value == _pendingAccent); // Tecla de acento em modo espera

                    if (focus)
                    {
                        // Foco (Realçado Laranja se for acento, ou Branco)
                        border.Background = isPendingAccentKey ? Brushes.Orange : Brushes.White;
                        tb.Foreground = Brushes.Black;
                    }
                    else
                    {
                        // Sem Foco
                        if (isPendingAccentKey)
                        {
                            // Fica laranja escuro pra indicar que acento está ativo, mesmo se o usuário mover o cursor
                            border.Background = BrushAccentPending;
                            tb.Foreground = Brushes.White;
                        }
                        else
                        {
                            border.Background = def.IsAction ? BrushKeyAction : (_layer == VkbLayer.Special ? BrushKeySpecial : BrushKeyNormal);
                            tb.Foreground = Brushes.White;
                        }
                    }

                    if (_layer == VkbLayer.Alpha && !def.IsAction && def.Value.Length == 1 && char.IsLetter(def.Value[0]))
                    {
                        tb.Text = _shifted ? def.Value.ToUpper() : def.Value.ToLower();
                    }
                }
            }
        }
    }
}