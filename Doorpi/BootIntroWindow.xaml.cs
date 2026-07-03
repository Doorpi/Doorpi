using System;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
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
            Loaded += (_, _) => Rotate(SpinnerRotate, 360, 850, repeat: true);
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

        private void ApplyLocalizedText()
        {
            bool portuguese = CultureInfo.CurrentUICulture.Name.StartsWith("pt", StringComparison.OrdinalIgnoreCase);
            TitleText.Text = portuguese ? "Preparando sistema" : "Preparing system";
            SubtitleText.Text = portuguese ? "Aguardando ambiente do Windows" : "Waiting for Windows environment";
        }

        public Task RunIntroAsync()
        {
            return InvokeOnBootstrapDispatcherAsync(() =>
            {
                DoorpiBootDiagnostics.Log("native-bootstrap-start");
                Show();
                Activate();
            });
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
                DoorpiBootDiagnostics.Log("native-bootstrap-close");
                Fade(Root, 0, 220, new SineEase { EasingMode = EasingMode.EaseInOut });
            });
            await Task.Delay(240);
            await InvokeOnBootstrapDispatcherAsync(Close);
        }

        private Task InvokeOnBootstrapDispatcherAsync(Action action)
        {
            if (Dispatcher.CheckAccess())
            {
                action();
                return Task.CompletedTask;
            }

            var tcs = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);
            try
            {
                Dispatcher.BeginInvoke(new Action(() =>
                {
                    try
                    {
                        action();
                        tcs.TrySetResult(null);
                    }
                    catch (Exception ex)
                    {
                        tcs.TrySetException(ex);
                    }
                }));
            }
            catch (Exception ex)
            {
                tcs.TrySetException(ex);
            }

            return tcs.Task;
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
