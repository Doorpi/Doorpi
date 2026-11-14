using System;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;

namespace Doorpi
{
    public partial class BootIntroWindow : Window
    {
        public BootIntroWindow()
        {
            InitializeComponent();
            ApplyLocalizedText();
            Loaded += (_, _) => StartAmbientMotion();
            PreviewKeyDown += OnRecoveryKey;
            Closed += (_, _) => { StopPreparingFocusProtection("closed"); _controllerTimer?.Stop(); _recovery?.TrySetResult(BootRecoveryChoice.Desktop); };
        }

        public static BootIntroWindow CreateOnDedicatedThread()
        {
            var ready = new ManualResetEventSlim(false);
            BootIntroWindow? window = null;
            Exception? startupError = null;

            var thread = new Thread(() =>
            {
                try
                {
                    var dispatcher = Dispatcher.CurrentDispatcher;
                    window = new BootIntroWindow();
                    window.Closed += (_, _) => dispatcher.BeginInvokeShutdown(DispatcherPriority.Background);
                    ready.Set();
                    Dispatcher.Run();
                }
                catch (Exception ex)
                {
                    startupError = ex;
                    ready.Set();
                }
            })
            {
                IsBackground = true,
                Name = "DoorpiBootstrapUi"
            };

            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();

            if (!ready.Wait(TimeSpan.FromSeconds(4)))
                throw new TimeoutException("Bootstrap UI thread did not initialize.");

            if (startupError != null)
                throw startupError;

            return window ?? throw new InvalidOperationException("Bootstrap window was not created.");
        }

        private TaskCompletionSource<BootRecoveryChoice>? _recovery;
        private DispatcherTimer? _controllerTimer;
        private ushort _lastButtons;
        private bool Portuguese => CultureInfo.CurrentUICulture.Name.StartsWith("pt", StringComparison.OrdinalIgnoreCase);

        private void ApplyLocalizedText()
        {
            TitleText.Text = Portuguese ? "Iniciando" : "Starting";
            RecoveryTitle.Text = Portuguese ? "Não conseguimos continuar." : "We couldn't continue.";
            RecoveryCopy.Text = Portuguese ? "Tente novamente ou abra a área de trabalho." : "Try again or open the desktop.";
            RetryButton.Content = Portuguese ? "Tentar novamente" : "Try again";
            DesktopButton.Content = Portuguese ? "Área de trabalho" : "Desktop";
            RecoveryHint.Text = Portuguese ? "A / Enter · confirmar     B / Esc · área de trabalho" : "A / Enter · confirm     B / Esc · desktop";
        }

        private void StartAmbientMotion()
        {
            if (!SystemParameters.ClientAreaAnimation) return;
            var pulse = new DoubleAnimation(.24, .65, TimeSpan.FromSeconds(2.8))
            { AutoReverse = true, RepeatBehavior = RepeatBehavior.Forever };
            AmbientLight.BeginAnimation(OpacityProperty, pulse);
            BreathingLine.BeginAnimation(OpacityProperty, pulse);
        }

        public Task RunIntroAsync() => ShowPreparingAsync(false);

        public Task ShowPreparingAsync(bool recovering) => InvokeOnBootstrapDispatcherAsync(() =>
        {
            RecoveryPanel.Visibility = Visibility.Collapsed;
            StatusPanel.Visibility = Visibility.Visible;
            TitleText.Text = Portuguese ? (recovering ? "Retomando seu espaço" : "Iniciando") : (recovering ? "Returning to your space" : "Starting");
            SubtitleText.Text = "";
            Show();
            Activate();
            BeginPreparingFocusProtection();
        });

        internal async Task<BootRecoveryChoice> ShowRecoveryAsync()
        {
            Task<BootRecoveryChoice>? choice = null;
            await InvokeOnBootstrapDispatcherAsync(() =>
            {
                StopPreparingFocusProtection("recovery");
                _recovery = new(TaskCreationOptions.RunContinuationsAsynchronously);
                choice = _recovery.Task;
                StatusPanel.Visibility = Visibility.Collapsed;
                RecoveryPanel.Visibility = Visibility.Visible;
                Show(); Activate(); RetryButton.Focus();
                _lastButtons = XInputControllerHub.Read().Buttons;
                _controllerTimer ??= new DispatcherTimer(TimeSpan.FromMilliseconds(80), DispatcherPriority.Input,
                    (_, _) => PollRecoveryController(), Dispatcher);
                _controllerTimer.Start();
            });
            var result = await choice!;
            await InvokeOnBootstrapDispatcherAsync(() => _controllerTimer?.Stop());
            return result;
        }

        private void PollRecoveryController()
        {
            if (!IsActive || _recovery == null || _recovery.Task.IsCompleted) return;
            ushort buttons = XInputControllerHub.Read().Buttons;
            int pressed = buttons & ~_lastButtons;
            _lastButtons = buttons;
            if ((pressed & 0x2000) != 0) _recovery.TrySetResult(BootRecoveryChoice.Desktop);
            else if ((pressed & 0x1000) != 0) _recovery.TrySetResult(DesktopButton.IsKeyboardFocused ? BootRecoveryChoice.Desktop : BootRecoveryChoice.Retry);
            else if ((pressed & 0x000C) != 0) { if (RetryButton.IsKeyboardFocused) DesktopButton.Focus(); else RetryButton.Focus(); }
        }
        private void RetryClick(object sender, RoutedEventArgs e) => _recovery?.TrySetResult(BootRecoveryChoice.Retry);
        private void DesktopClick(object sender, RoutedEventArgs e) => _recovery?.TrySetResult(BootRecoveryChoice.Desktop);
        private void OnRecoveryKey(object sender, KeyEventArgs e)
        {
            if (RecoveryPanel.Visibility != Visibility.Visible)
            {
                return;
            }
            if (e.Key == Key.Escape) { _recovery?.TrySetResult(BootRecoveryChoice.Desktop); e.Handled = true; }
            else if (e.Key == Key.Enter) { _recovery?.TrySetResult(DesktopButton.IsKeyboardFocused ? BootRecoveryChoice.Desktop : BootRecoveryChoice.Retry); e.Handled = true; }
            else if (e.Key is Key.Left or Key.Right) { if (RetryButton.IsKeyboardFocused) DesktopButton.Focus(); else RetryButton.Focus(); e.Handled = true; }
        }

        public Task PlayReleaseAsync()
        {
            return InvokeOnBootstrapDispatcherAsync(() =>
            {
                DoorpiBootDiagnostics.Log("native-bootstrap-release");
            });
        }

        public void ShowPreparingSystem()
        {
            _ = InvokeOnBootstrapDispatcherAsync(() =>
            {
                DoorpiBootDiagnostics.Log("native-bootstrap-preparing-system");
            });
        }

        public void RequestSkip()
        {
            _ = InvokeOnBootstrapDispatcherAsync(() =>
            {
                DoorpiBootDiagnostics.Log("native-bootstrap-skip-ignored");
            });
        }

        public async Task FadeOutAndCloseAsync()
        {
            await InvokeOnBootstrapDispatcherAsync(() =>
            {
                StopPreparingFocusProtection("handoff");
                DoorpiBootDiagnostics.Log("native-bootstrap-close");
                if (SystemParameters.ClientAreaAnimation) Fade(Root, 0, 220, new SineEase { EasingMode = EasingMode.EaseInOut });
            });
            if (SystemParameters.ClientAreaAnimation) await Task.Delay(240);
            await InvokeOnBootstrapDispatcherAsync(Close);
        }

        private Task InvokeOnBootstrapDispatcherAsync(Action action)
        {
            if (Dispatcher.HasShutdownStarted || Dispatcher.HasShutdownFinished)
                return Task.FromException(new InvalidOperationException("The native prelude has closed."));
            if (Dispatcher.CheckAccess())
            {
                action();
                return Task.CompletedTask;
            }
            return Dispatcher.InvokeAsync(action, DispatcherPriority.Send).Task;
        }

        private static void Fade(UIElement element, double to, int ms, IEasingFunction? easing = null)
        {
            element.BeginAnimation(OpacityProperty, new DoubleAnimation(to, TimeSpan.FromMilliseconds(ms))
            {
                EasingFunction = easing ?? new CubicEase { EasingMode = EasingMode.EaseOut }
            });
        }

        private static void Rotate(RotateTransform transform, double to, int ms, bool repeat)
        {
            transform.BeginAnimation(RotateTransform.AngleProperty, new DoubleAnimation(to, TimeSpan.FromMilliseconds(ms))
            {
                RepeatBehavior = repeat ? RepeatBehavior.Forever : new RepeatBehavior(1)
            });
        }
    }
}
