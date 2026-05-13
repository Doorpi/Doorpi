using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Effects;

namespace Doorpi
{
    // Classe auxiliar para definir o tamanho e tipo de cada tecla
    public class VkbKey
    {
        public string Value { get; set; }
        public string Display { get; set; }
        public double Width { get; set; }
        public bool IsAction { get; set; }
    }

    public class DesktopVkbWindow : Window
    {
        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_NOACTIVATE = 0x08000000;

        [DllImport("user32.dll")]
        private static extern IntPtr SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            var helper = new WindowInteropHelper(this);
            SetWindowLong(helper.Handle, GWL_EXSTYLE, GetWindowLong(helper.Handle, GWL_EXSTYLE) | WS_EX_NOACTIVATE);
        }

        // === NOVO LAYOUT DINÂMICO ===
        private VkbKey[][] _keys;
        private int _currentRow = 1;
        private int _currentCol = 0;
        private bool _isShifted = false;

        private Grid _mainGrid;
        private Border[][] _uiKeys;

        public event Action<string> OnKeyPressed;
        public event Action OnCloseRequested;

        public DesktopVkbWindow()
        {
            InitializeKeyLayout();

            WindowStyle = WindowStyle.None;
            AllowsTransparency = true;
            // Cor baseada no tema Dark/Neon (Azul marinho ultra escuro, quase preto, 90% opaco)
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
                Color = Colors.Black, BlurRadius = 40, ShadowDepth = 15, Opacity = 0.7
            };

            BuildUI();
            UpdateFocusVisuals();
        }

        private void InitializeKeyLayout()
        {
            double regW = 65; // Largura botão normal
            double actW = 160; // Largura botão de ação
            double spcW = 400; // Largura do Espaço

            VkbKey K(string val, string disp = null, double w = 65, bool act = false) => 
                new VkbKey { Value = val, Display = disp ?? val, Width = w, IsAction = act };

            _keys = new VkbKey[][]
            {
                new VkbKey[] { K("1"), K("2"), K("3"), K("4"), K("5"), K("6"), K("7"), K("8"), K("9"), K("0"), K("-"), K("BKSP", "Apagar [ X ]", actW, true) },
                new VkbKey[] { K("Q"), K("W"), K("E"), K("R"), K("T"), K("Y"), K("U"), K("I"), K("O"), K("P"), K("ENTER", "Enter [ Start ]", actW, true) },
                new VkbKey[] { K("A"), K("S"), K("D"), K("F"), K("G"), K("H"), K("J"), K("K"), K("L"), K("Ç"), K("~") },
                new VkbKey[] { K("SHIFT", "Maiúsculo [ L3 ]", actW, true), K("Z"), K("X"), K("C"), K("V"), K("B"), K("N"), K("M"), K(","), K("."), K("?") },
                new VkbKey[] { K("SPACE", "Espaço [ Y ]", spcW, true), K("CANCEL", "Fechar [ B ]", actW, true) }
            };
        }

        private void BuildUI()
        {
            _mainGrid = new Grid { Margin = new Thickness(15, 25, 15, 25) };
            
            for (int i = 0; i < _keys.Length; i++)
                _mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

            _uiKeys = new Border[_keys.Length][];

            for (int r = 0; r < _keys.Length; r++)
            {
                var rowPanel = new StackPanel 
                { 
                    Orientation = Orientation.Horizontal, 
                    HorizontalAlignment = HorizontalAlignment.Center 
                };

                _uiKeys[r] = new Border[_keys[r].Length];

                for (int c = 0; c < _keys[r].Length; c++)
                {
                    var keyDef = _keys[r][c];

                    var textBlock = new TextBlock
                    {
                        Text = keyDef.Display,
                        Foreground = Brushes.White,
                        HorizontalAlignment = HorizontalAlignment.Center,
                        VerticalAlignment = VerticalAlignment.Center,
                        FontSize = keyDef.IsAction ? 15 : 22, // Fonte menor para ações, maior pra letras
                        FontFamily = new FontFamily("Segoe UI"),
                        FontWeight = keyDef.IsAction ? FontWeights.SemiBold : FontWeights.Normal
                    };

                    var border = new Border
                    {
                        Width = keyDef.Width,
                        Margin = new Thickness(4), // Espaçamento entre teclas
                        CornerRadius = new CornerRadius(6), // Borda moderna
                        Background = new SolidColorBrush(Color.FromRgb(30, 33, 43)), // Cor base da tecla
                        Child = textBlock
                    };

                    _uiKeys[r][c] = border;
                    rowPanel.Children.Add(border);
                }

                Grid.SetRow(rowPanel, r);
                _mainGrid.Children.Add(rowPanel);
            }

            Content = _mainGrid;
        }

        private void UpdateFocusVisuals()
        {
            for (int r = 0; r < _keys.Length; r++)
            {
                for (int c = 0; c < _keys[r].Length; c++)
                {
                    bool isFocused = (r == _currentRow && c == _currentCol);
                    var border = _uiKeys[r][c];
                    var txt = (TextBlock)border.Child;
                    var keyDef = _keys[r][c];

                    if (isFocused)
                    {
                        border.Background = Brushes.White; // Foco brancão estilo console
                        txt.Foreground = Brushes.Black;
                        border.RenderTransform = new ScaleTransform(1.05, 1.05);
                        border.RenderTransformOrigin = new Point(0.5, 0.5);
                    }
                    else
                    {
                        // Teclas de ação tem um tom sutilmente diferente das letras
                        border.Background = keyDef.IsAction 
                            ? new SolidColorBrush(Color.FromRgb(40, 44, 55)) 
                            : new SolidColorBrush(Color.FromRgb(25, 28, 38));
                        txt.Foreground = Brushes.White;
                        border.RenderTransform = null;
                    }

                    if (!keyDef.IsAction && keyDef.Value.Length == 1 && char.IsLetter(keyDef.Value[0]))
                    {
                        txt.Text = _isShifted ? keyDef.Value.ToUpper() : keyDef.Value.ToLower();
                    }
                }
            }
        }

        public void MoveSelection(int dr, int dc)
        {
            _currentRow += dr;
            if (_currentRow < 0) _currentRow = _keys.Length - 1;
            if (_currentRow >= _keys.Length) _currentRow = 0;

            _currentCol += dc;
            // Correção de colunas para linhas de tamanhos diferentes
            if (_currentCol < 0) _currentCol = _keys[_currentRow].Length - 1;
            if (_currentCol >= _keys[_currentRow].Length) _currentCol = _keys[_currentRow].Length - 1;

            UpdateFocusVisuals();
        }

        public void ToggleShift()
        {
            _isShifted = !_isShifted;
            UpdateFocusVisuals();
        }

        public void PressCurrentKey()
        {
            string key = _keys[_currentRow][_currentCol].Value;

            if (key == "SHIFT") ToggleShift();
            else if (key == "CANCEL") OnCloseRequested?.Invoke();
            else if (key == "BKSP") OnKeyPressed?.Invoke("BKSP");
            else if (key == "ENTER") OnKeyPressed?.Invoke("ENTER");
            else if (key == "SPACE") OnKeyPressed?.Invoke(" ");
            else
            {
                string valueToSend = _isShifted ? key.ToUpper() : key.ToLower();
                OnKeyPressed?.Invoke(valueToSend);
            }
        }
    }
}