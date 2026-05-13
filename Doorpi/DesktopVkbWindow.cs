using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Threading;

namespace Doorpi
{
    // ─────────────────────────────────────────────────────────────
    //  Camada do teclado (Letras  /  Símbolos)
    // ─────────────────────────────────────────────────────────────
    public enum VkbLayer { Alpha, Special }

    // ─────────────────────────────────────────────────────────────
    //  Definição de uma tecla
    // ─────────────────────────────────────────────────────────────
    public class VkbKey
    {
        public string Value { get; set; }
        public string Display { get; set; }
        public double Width { get; set; }
        public bool IsAction { get; set; }
    }

    // ─────────────────────────────────────────────────────────────
    //  Ações que o host pode segurar (hold-to-repeat)
    //  Passe para BeginHold() no evento de "botão pressionado"
    //  e EndHold() no evento de "botão solto".
    // ─────────────────────────────────────────────────────────────
    public enum VkbHoldAction
    {
        MoveUp,
        MoveDown,
        MoveLeft,
        MoveRight,
        Press,          // Confirmar tecla atual (pode repetir caractere)
        CursorLeft,     // Mover cursor no campo de texto (← no analógico/D-pad)
        CursorRight     // Mover cursor no campo de texto (→ no analógico/D-pad)
    }

    public class DesktopVkbWindow : Window
    {
        // ── Win32 & Ocultação do Teclado Nativo ────────────────────────
        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_NOACTIVATE = 0x08000000;
        private const int WS_EX_TOOLWINDOW = 0x00000080;

        [DllImport("user32.dll")]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOMOVE = 0x0002;
        private const uint SWP_SHOWWINDOW = 0x0040;
        private const uint SWP_NOACTIVATE = 0x0010;

        [DllImport("user32.dll")]
        private static extern IntPtr SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [ComImport, Guid("4ce576fa-83dc-4F88-951c-9d0782b4e376")]
        private class UIHostNoLaunch { }

        [ComImport, Guid("37c994e7-432b-4834-a2f7-dce1f13b834b")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface ITipInvocationAware { void Toggle(bool bEnable); }

        private DispatcherTimer _topmostTimer;

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            var helper = new WindowInteropHelper(this);
            SetWindowLong(helper.Handle, GWL_EXSTYLE, GetWindowLong(helper.Handle, GWL_EXSTYLE) | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW);

            // Supressão Agressiva: O Windows tenta abrir o processo TabTip.exe
            // Nós simplesmente matamos ele imediatamente no momento em que o nosso teclado abre.
            Task.Run(() => {
                try
                {
                    foreach (var p in System.Diagnostics.Process.GetProcessesByName("TabTip"))
                    {
                        p.Kill();
                    }
                }
                catch { }
            });

            // Loop mantido APENAS para forçar a janela por cima do Menu Iniciar
            _topmostTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(500) };
            _topmostTimer.Tick += (s, ev) =>
            {
                SetWindowPos(helper.Handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
            };
            _topmostTimer.Start();
        }

        protected override void OnClosed(EventArgs e)
        {
            _topmostTimer?.Stop();
            base.OnClosed(e);
        }

        // ── Auto-Posicionamento ───────────────────────────────────────
        public void AutoPosition(int targetY)
        {
            // Tenta colocar ACIMA do clique (com 40px de respiro pra não tampar o input)
            double desiredTop = targetY - Height - 40;

            // Se colocar pra cima for cortar o teclado na tela, joga pra baixo
            if (desiredTop < 0)
            {
                desiredTop = targetY + 40;
                // Proteção para não vazar pela barra de tarefas
                if (desiredTop + Height > SystemParameters.PrimaryScreenHeight)
                    desiredTop = SystemParameters.PrimaryScreenHeight - Height - 50;
            }

            this.Top = desiredTop;
        }

        public void SetFixedPosition()
        {
            // Fallback genérico para o botão Y
            this.Top = SystemParameters.PrimaryScreenHeight - Height - 50;
        }

        // ── Movimentação Inteligente (Fuga do Menu Iniciar) ───────────
        private bool _isAtTop = false;
        public void TogglePosition()
        {
            _isAtTop = !_isAtTop;
            // Alterna entre o topo da tela e a parte inferior
            this.Top = _isAtTop ? 50 : SystemParameters.PrimaryScreenHeight - Height - 50;
        }

        // ── Estado ─────────────────────────────────────────────────
        private VkbKey[][] _alphaKeys;
        private VkbKey[][] _specialKeys;
        private VkbKey[][] CurrentKeys => _layer == VkbLayer.Alpha ? _alphaKeys : _specialKeys;

        private VkbLayer _layer = VkbLayer.Alpha;
        private int _row = 1;
        private int _col = 0;
        private bool _shifted = false;

        private Grid _grid;
        private Border[][] _uiKeys;

        // ── Hold-to-repeat ─────────────────────────────────────────
        private readonly DispatcherTimer _holdTimer = new DispatcherTimer();
        private Action _pendingRepeat;
        private bool _initialFired;

        // Tempo até o primeiro repeat (ms) e intervalo subsequente (ms)
        private const int HOLD_INITIAL_MS = 380;
        private const int HOLD_REPEAT_MS = 75;

        // ── Eventos públicos ───────────────────────────────────────
        /// <summary>Tecla de caractere ou comando (BKSP, ENTER, CURSOR_LEFT, CURSOR_RIGHT, " ").</summary>
        public event Action<string> OnKeyPressed;

        /// <summary>Usuário solicitou fechar o teclado.</summary>
        public event Action OnCloseRequested;

        // ─────────────────────────────────────────────────────────────────────────
        //  CONSTRUTOR
        // ─────────────────────────────────────────────────────────────────────────
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

            Effect = new DropShadowEffect
            {
                Color = Colors.Black,
                BlurRadius = 40,
                ShadowDepth = 15,
                Opacity = 0.7
            };

            BuildUI();
            RefreshVisuals();
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  LAYOUTS DE TECLAS
        // ─────────────────────────────────────────────────────────────────────────
        private void BuildKeyLayouts()
        {
            const double REG = 65;
            const double ACT = 165;
            const double SPC = 390;

            VkbKey K(string val, string disp = null, double w = REG, bool act = false) =>
                new VkbKey { Value = val, Display = disp ?? val, Width = w, IsAction = act };

            // ── Letras ─────────────────────────────────────────────
            _alphaKeys = new[]
            {
                new[] { K("1"), K("2"), K("3"), K("4"), K("5"), K("6"), K("7"), K("8"), K("9"), K("0"), K("-"), K("BKSP",  "Apagar  [ X ]",   ACT, true) },
                new[] { K("Q"), K("W"), K("E"), K("R"), K("T"), K("Y"), K("U"), K("I"), K("O"), K("P"), K("ENTER", "Enter  [ Start ]", ACT, true) },
                new[] { K("A"), K("S"), K("D"), K("F"), K("G"), K("H"), K("J"), K("K"), K("L"), K("Ç"), K("~") },
                new[] { K("SHIFT", "Maiúsc  [ L3 ]", ACT, true), K("Z"), K("X"), K("C"), K("V"), K("B"), K("N"), K("M"), K(","), K("."), K("?") },
                new[] { K("SYM", "#@!", ACT, true), K("SPACE", "Espaço  [ Y ]", SPC, true), K("CANCEL", "Fechar  [ B ]", ACT, true) }
            };

            // ── Símbolos / Caracteres especiais ────────────────────
            _specialKeys = new[]
            {
                new[] { K("!"), K("@"), K("#"), K("$"), K("%"), K("^"), K("&"), K("*"), K("("), K(")"), K("_"), K("BKSP",  "Apagar  [ X ]",   ACT, true) },
                new[] { K("~"), K("`"), K("|"), K("\\"), K("{"), K("}"), K("["), K("]"), K("<"), K(">"), K("ENTER", "Enter  [ Start ]", ACT, true) },
                new[] { K(":"), K(";"), K("\""), K("'"), K(","), K("."), K("/"), K("?"), K("="), K("+"), K("-") },
                new[] { K("€"), K("£"), K("¥"), K("©"), K("®"), K("°"), K("±"), K("×"), K("÷"), K("¿"), K("¡") },
                new[] { K("ABC", "Letras", ACT, true), K("SPACE", "Espaço  [ Y ]", SPC, true), K("CANCEL", "Fechar  [ B ]", ACT, true) }

            };
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  HOLD-TO-REPEAT
        // ─────────────────────────────────────────────────────────────────────────
        private void WireHoldTimer()
        {
            _holdTimer.Tick += (_, __) =>
            {
                if (!_initialFired)
                {
                    // Troca para o intervalo rápido após o delay inicial
                    _initialFired = true;
                    _holdTimer.Interval = TimeSpan.FromMilliseconds(HOLD_REPEAT_MS);
                }
                _pendingRepeat?.Invoke();
            };
        }

        /// <summary>
        /// Chame quando o botão for PRESSIONADO.
        /// Dispara a ação imediatamente e inicia o repeat automático.
        /// </summary>
        public void BeginHold(VkbHoldAction action)
        {
            StopHold();                         // garante que não haja timer duplo
            Action act = BuildAction(action);
            act?.Invoke();                       // disparo imediato
            _pendingRepeat = act;
            _initialFired = false;
            _holdTimer.Interval = TimeSpan.FromMilliseconds(HOLD_INITIAL_MS);
            _holdTimer.Start();
        }

        /// <summary>Chame quando o botão for SOLTO.</summary>
        public void EndHold(VkbHoldAction action)
        {
            // Só para se for a mesma ação que está rodando
            StopHold();
        }

        /// <summary>Para qualquer repeat em andamento (útil em limpezas gerais).</summary>
        public void StopHold()
        {
            _holdTimer.Stop();
            _pendingRepeat = null;
        }

        private Action BuildAction(VkbHoldAction action)
        {
            switch (action)
            {
                case VkbHoldAction.MoveUp: return () => MoveSelection(-1, 0);
                case VkbHoldAction.MoveDown: return () => MoveSelection(1, 0);
                case VkbHoldAction.MoveLeft: return () => MoveSelection(0, -1);
                case VkbHoldAction.MoveRight: return () => MoveSelection(0, 1);
                case VkbHoldAction.Press: return PressCurrentKey;
                case VkbHoldAction.CursorLeft: return () => OnKeyPressed?.Invoke("CURSOR_LEFT");
                case VkbHoldAction.CursorRight: return () => OnKeyPressed?.Invoke("CURSOR_RIGHT");
                default: return null;
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  BLOQUEIO DO BOTÃO B  ← NOVO
        //
        //  Como o WS_EX_NOACTIVATE mantém o foco no WebView2/browser, o botão B
        //  do controle pode acionar "voltar página" antes de fechar o teclado.
        //
        //  PADRÃO DE USO NO HOST:
        //
        //      // No loop de polling do controle:
        //      if (ButtonBPressed())
        //      {
        //          if (!_vkb.ConsumeCancelPress())   // ← teclado estava aberto → apenas fecha
        //              NavigateBack();               // ← só volta a página se teclado fechado
        //      }
        //
        //  ConsumeCancelPress() retorna true e dispara OnCloseRequested quando o
        //  teclado está visível, interceptando o B antes que chegue ao browser.
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Intercepta o botão B/Cancelar quando o teclado está aberto.
        /// Retorna <c>true</c> se o evento foi consumido pelo teclado (não propague ao browser).
        /// Retorna <c>false</c> se o teclado estava fechado (propague normalmente).
        /// </summary>
        public bool ConsumeCancelPress()
        {
            if (!IsVisible) return false;

            OnCloseRequested?.Invoke();
            return true;
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  NAVEGAÇÃO E TECLAS
        // ─────────────────────────────────────────────────────────────────────────
        public void MoveSelection(int dr, int dc)
        {
            int newRow = (_row + dr + CurrentKeys.Length) % CurrentKeys.Length;
            _row = newRow;

            int newCol = _col + dc;
            int rowLen = CurrentKeys[_row].Length;
            if (newCol < 0) newCol = rowLen - 1;
            if (newCol >= rowLen) newCol = rowLen - 1;
            _col = newCol;

            RefreshVisuals();
        }

        public void ToggleShift()
        {
            _shifted = !_shifted;
            RefreshVisuals();
        }

        private void SwitchLayer(VkbLayer layer)
        {
            _layer = layer;
            _shifted = false;
            _row = 1;
            _col = 0;
            RebuildUI();
        }

        public void PressCurrentKey()
        {
            var key = CurrentKeys[_row][_col].Value;

            switch (key)
            {
                case "SHIFT": ToggleShift(); break;
                case "SYM": SwitchLayer(VkbLayer.Special); break;
                case "ABC": SwitchLayer(VkbLayer.Alpha); break;
                case "CANCEL": OnCloseRequested?.Invoke(); break;
                case "BKSP": OnKeyPressed?.Invoke("BKSP"); break;
                case "ENTER": OnKeyPressed?.Invoke("ENTER"); break;
                case "SPACE": OnKeyPressed?.Invoke(" "); break;
                default:
                    // Verifica se estamos na aba de Letras (Alpha) e se é um caractere válido.
                    // Se o Shift estiver ativo, envia Maiúsculo. Se não, envia Minúsculo.
                    string toSend = key;
                    if (_layer == VkbLayer.Alpha && key.Length == 1 && char.IsLetter(key[0]))
                    {
                        toSend = _shifted ? key.ToUpper() : key.ToLower();
                    }

                    OnKeyPressed?.Invoke(toSend);
                    break;
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        //  CONSTRUÇÃO E ATUALIZAÇÃO DA UI
        // ─────────────────────────────────────────────────────────────────────────
        private void BuildUI()
        {
            _grid = new Grid { Margin = new Thickness(15, 25, 15, 25) };
            Content = _grid;
            PopulateGrid();
        }

        private void RebuildUI()
        {
            _grid.Children.Clear();
            _grid.RowDefinitions.Clear();
            PopulateGrid();
        }

        private void PopulateGrid()
        {
            var keys = CurrentKeys;
            for (int i = 0; i < keys.Length; i++)
                _grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

            _uiKeys = new Border[keys.Length][];

            for (int r = 0; r < keys.Length; r++)
            {
                var row = new StackPanel
                {
                    Orientation = Orientation.Horizontal,
                    HorizontalAlignment = HorizontalAlignment.Center
                };
                _uiKeys[r] = new Border[keys[r].Length];

                for (int c = 0; c < keys[r].Length; c++)
                {
                    var def = keys[r][c];
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
                    var border = new Border
                    {
                        Width = def.Width,
                        Margin = new Thickness(4),
                        CornerRadius = new CornerRadius(6),
                        Background = new SolidColorBrush(Color.FromRgb(30, 33, 43)),
                        Child = tb
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
        private static readonly SolidColorBrush BrushKeySpecial = new SolidColorBrush(Color.FromRgb(28, 38, 55)); // azul leve para camada especial

        private void RefreshVisuals()
        {
            var keys = CurrentKeys;
            for (int r = 0; r < keys.Length; r++)
            {
                for (int c = 0; c < keys[r].Length; c++)
                {
                    var def = keys[r][c];
                    var border = _uiKeys[r][c];
                    var tb = (TextBlock)border.Child;
                    bool focus = (r == _row && c == _col);

                    if (focus)
                    {
                        border.Background = Brushes.White;
                        tb.Foreground = Brushes.Black;
                        border.RenderTransform = new ScaleTransform(1.06, 1.06);
                        border.RenderTransformOrigin = new Point(0.5, 0.5);
                    }
                    else
                    {
                        border.Background = def.IsAction
                            ? BrushKeyAction
                            : (_layer == VkbLayer.Special ? BrushKeySpecial : BrushKeyNormal);
                        tb.Foreground = Brushes.White;
                        border.RenderTransform = null;
                    }

                    // Atualiza label de letras conforme Shift na camada Alpha
                    if (_layer == VkbLayer.Alpha && !def.IsAction
                        && def.Value.Length == 1 && char.IsLetter(def.Value[0]))
                    {
                        tb.Text = _shifted ? def.Value.ToUpper() : def.Value.ToLower();
                    }
                }
            }
        }
    }
}