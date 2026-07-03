using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Effects;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;

namespace Doorpi
{
    public partial class BootIntroWindow : Window
    {
        private static readonly List<MediaPlayer> ReleasedIntroPlayers = new();
        private MediaPlayer? _introPlayer;
        private bool _preparingShown;
        private bool _releaseStarted;
        private double _traceDashLength = 1200;
        private double _logoTraceDash = 1200;
        private readonly TaskCompletionSource _skipRequested = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly Random _dropletRandom = new();
        private const int LogoFirstHalfMs = 2300;
        private const int LogoSecondHalfMs = 3200;
        private const double LogoFirstPhaseProgress = 0.58;
        private const double LogoPreReleaseProgress = 0.965;
        private const int LogoFinalTouchMs = 70;

        public BootIntroWindow()
        {
            InitializeComponent();
            Loaded += (_, _) =>
            {
                StartAmbientAnimation();
                PrepareLogoTraceDash();
            };
        }

        public async Task RunIntroAsync()
        {
            DoorpiBootDiagnostics.Log("native-intro-start");
            Show();
            Activate();

            Fade(UniverseLayer, 1, 1300);
            Fade(LogoStage, 1, 900);
            MoveY(StageTranslate, 0, 1300);
            Scale(StageScale, 1, 1, 1500);

            if (!await DelayOrSkipAsync(500))
                return;
            PlayIntroSound();

            if (!await DelayOrSkipAsync(450))
                return;
            BeginLogoDraw();

            if (!await DelayOrSkipAsync(LogoFirstHalfMs))
                return;
            BeginLogoCharge();

            if (!await DelayOrSkipAsync(LogoSecondHalfMs))
                return;
            HoldChargedLogo();
            DoorpiBootDiagnostics.Log("native-intro-release-ready");
        }

        public async Task PlayReleaseAsync()
        {
            DoorpiBootDiagnostics.Log("native-intro-release");
            await CompleteLogoDrawForReleaseAsync();
            _releaseStarted = true;
            ReleaseToHandoff();
            await Task.Delay(140);
        }

        public void ShowPreparingSystem()
        {
            if (_preparingShown) return;
            _preparingShown = true;
            DoorpiBootDiagnostics.Log("native-intro-preparing-system");
            Fade(PreparingPanel, 1, 360);
        }

        public void RequestSkip()
        {
            DoorpiBootDiagnostics.Log("native-intro-skip-requested");
            StopIntroSound();
            ShowSkippedPreReleaseState();
            _skipRequested.TrySetResult();
        }

        public async Task FadeOutAndCloseAsync()
        {
            DoorpiBootDiagnostics.Log("native-intro-close");
            Fade(Root, 0, 760, new SineEase { EasingMode = EasingMode.EaseInOut });
            await Task.Delay(800);
            Close();
        }

        protected override void OnClosed(EventArgs e)
        {
            try
            {
                if (_releaseStarted && _introPlayer != null)
                {
                    var player = _introPlayer;
                    _introPlayer = null;
                    lock (ReleasedIntroPlayers)
                        ReleasedIntroPlayers.Add(player);

                    _ = Task.Run(async () =>
                    {
                        await Task.Delay(2600).ConfigureAwait(false);
                        await Dispatcher.InvokeAsync(() =>
                        {
                            try
                            {
                                player.Stop();
                                player.Close();
                            }
                            catch { }
                            lock (ReleasedIntroPlayers)
                                ReleasedIntroPlayers.Remove(player);
                        });
                    });
                }
                else
                {
                    _introPlayer?.Stop();
                    _introPlayer?.Close();
                }
            }
            catch { }
            base.OnClosed(e);
        }

        private void BeginLogoDraw()
        {
            Fade(BackHalo, 0.34, 1500);
            Fade(GroundLight, 0.34, 1500);
            Fade(OrbitArcLayer, 0.46, 1800);
            Fade(LogoTrace, 1, 180);

            LogoTrace.BeginAnimation(Shape.StrokeDashOffsetProperty, new DoubleAnimation(_logoTraceDash * (1 - LogoFirstPhaseProgress), TimeSpan.FromMilliseconds(LogoFirstHalfMs))
            {
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
            });
        }

        private void BeginLogoCharge()
        {
            LogoTrace.BeginAnimation(Shape.StrokeDashOffsetProperty, new DoubleAnimation(_logoTraceDash * (1 - LogoPreReleaseProgress), TimeSpan.FromMilliseconds(LogoSecondHalfMs))
            {
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut }
            });

            AnimateStroke("#AFC3DD", 2.45, 3200);
            Fade(CoreBloom, 0.34, 3200, new SineEase { EasingMode = EasingMode.EaseInOut });
            Fade(BackHalo, 0.54, 3200, new SineEase { EasingMode = EasingMode.EaseInOut });
            Fade(GroundLight, 0.5, 3200, new SineEase { EasingMode = EasingMode.EaseInOut });
            Fade(OrbitArcLayer, 0.62, 2600, new SineEase { EasingMode = EasingMode.EaseInOut });
            Fade(BrandStack, 0.62, 1500, new SineEase { EasingMode = EasingMode.EaseInOut });
            Scale(CoreBloomScale, 0.86, 0.86, 3400, new ExponentialEase { EasingMode = EasingMode.EaseIn, Exponent = 2.8 });
            Scale(StageScale, 1.014, 1.014, 3400, new SineEase { EasingMode = EasingMode.EaseInOut });
        }

        private void HoldChargedLogo()
        {
            Fade(CoreBloom, 0.38, 900);
            Fade(BackHalo, 0.58, 900);
            Scale(CoreBloomScale, 0.92, 0.92, 900);
        }

        private void ReleaseToHandoff()
        {
            Fade(PreparingPanel, 0, 160);
            BurstDroplets();
            Fade(BrandStack, 0, 220);
            LogoTrace.Opacity = 0;
            LogoTrace.BeginAnimation(OpacityProperty, null);
            Fade(BackHalo, 0, 980);
            Fade(GroundLight, 0, 760);
            Fade(OrbitArcLayer, 0, 520);
            Fade(UniverseLayer, 0, 1200, new SineEase { EasingMode = EasingMode.EaseInOut });
            Fade(CoreBloom, 0.14, 760);
            Scale(CoreBloomScale, 1.24, 1.24, 760, new ExponentialEase { EasingMode = EasingMode.EaseOut, Exponent = 3.4 });
            Scale(StageScale, 1.05, 1.05, 1000);
        }

        private void PrepareLogoTraceDash()
        {
            try
            {
                _traceDashLength = Math.Max(1, MeasureGeometryLength(LogoTrace.Data.GetFlattenedPathGeometry()));
                _logoTraceDash = _traceDashLength / Math.Max(0.1, LogoTrace.StrokeThickness);
                LogoTrace.StrokeDashArray = new DoubleCollection { _logoTraceDash, _logoTraceDash };
                LogoTrace.StrokeDashOffset = _logoTraceDash;
            }
            catch
            {
                _logoTraceDash = 1200;
                LogoTrace.StrokeDashArray = new DoubleCollection { 1200, 1200 };
                LogoTrace.StrokeDashOffset = 1200;
            }
        }

        private static double MeasureGeometryLength(PathGeometry geometry)
        {
            double length = 0;
            foreach (var figure in geometry.Figures)
            {
                Point? previous = figure.StartPoint;
                foreach (var segment in figure.Segments)
                {
                    if (segment is not PolyLineSegment polyline) continue;
                    foreach (var point in polyline.Points)
                    {
                        if (previous is Point p)
                        {
                            double dx = point.X - p.X;
                            double dy = point.Y - p.Y;
                            length += Math.Sqrt((dx * dx) + (dy * dy));
                        }
                        previous = point;
                    }
                }
            }
            return length;
        }

        private void PlayIntroSound()
        {
            try
            {
                string path = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "intros", "doorpi-neon", "intro.wav");
                if (!File.Exists(path)) return;

                _introPlayer = new MediaPlayer { Volume = 0.8 };
                _introPlayer.Open(new Uri(path, UriKind.Absolute));
                _introPlayer.Play();
            }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("native-intro-audio-error", ex.Message);
            }
        }

        private void StopIntroSound()
        {
            try
            {
                _introPlayer?.Stop();
                _introPlayer?.Close();
                _introPlayer = null;
            }
            catch { }
        }

        private void ShowSkippedPreReleaseState()
        {
            Fade(UniverseLayer, 1, 120);
            Fade(LogoStage, 1, 120);
            Fade(LogoTrace, 1, 120);
            Fade(BackHalo, 0.58, 160);
            Fade(GroundLight, 0.5, 160);
            Fade(OrbitArcLayer, 0.62, 160);
            Fade(CoreBloom, 0.38, 160);
            Fade(BrandStack, 0.62, 160);
            ShowPreparingSystem();

            LogoTrace.BeginAnimation(Shape.StrokeDashOffsetProperty, null);
            LogoTrace.StrokeDashOffset = _logoTraceDash * (1 - LogoPreReleaseProgress);

            if (LogoTrace.Stroke is SolidColorBrush brush)
            {
                brush.BeginAnimation(SolidColorBrush.ColorProperty, null);
                brush.Color = (Color)ColorConverter.ConvertFromString("#AFC3DD");
            }

            LogoTrace.BeginAnimation(Shape.StrokeThicknessProperty, null);
            LogoTrace.StrokeThickness = 2.45;
        }

        private void AnimateStroke(string color, double thickness, int ms)
        {
            try
            {
                if (LogoTrace.Stroke is SolidColorBrush brush)
                {
                    brush.BeginAnimation(SolidColorBrush.ColorProperty, new ColorAnimation(
                        (Color)ColorConverter.ConvertFromString(color),
                        TimeSpan.FromMilliseconds(ms))
                    {
                        EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut }
                    });
                }
            }
            catch { }

            LogoTrace.BeginAnimation(Shape.StrokeThicknessProperty, new DoubleAnimation(thickness, TimeSpan.FromMilliseconds(ms))
            {
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut }
            });
        }

        private async Task<bool> DelayOrSkipAsync(int milliseconds)
        {
            var delay = Task.Delay(milliseconds);
            var completed = await Task.WhenAny(delay, _skipRequested.Task);
            return completed == delay;
        }

        private async Task CompleteLogoDrawForReleaseAsync()
        {
            Fade(LogoTrace, 1, 60);
            LogoTrace.BeginAnimation(Shape.StrokeDashOffsetProperty, new DoubleAnimation(0, TimeSpan.FromMilliseconds(LogoFinalTouchMs))
            {
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
            });
            await Task.Delay(LogoFinalTouchMs);
        }

        private void StartAmbientAnimation()
        {
            Rotate(SpinnerRotate, 360, 850, repeat: true);
            Rotate(ConstellationOuterRotate, 360, 26000, repeat: true);
            Rotate(ConstellationInnerRotate, -360, 21000, repeat: true);
            Rotate(ConstellationOuterDotsRotate, 360, 14000, repeat: true);
            Rotate(ConstellationInnerDotsRotate, -360, 11500, repeat: true);
            Rotate(OrbitArcRotate, 352, 36000, repeat: true);
            PulseOpacity(ConstellationStarA, 0.34, 0.78, 3600);
            PulseOpacity(ConstellationStarB, 0.26, 0.62, 4300);
        }

        private void BurstDroplets()
        {
            DropletCanvas.Children.Clear();
            double cx = Math.Max(1, Root.ActualWidth) / 2.0;
            double cy = Math.Max(1, Root.ActualHeight) / 2.0 - 42;
            Fade(DropletCanvas, 1, 80);

            for (int i = 0; i < 18; i++)
            {
                double width = 3 + (_dropletRandom.NextDouble() * 5);
                double height = width * (0.45 + (_dropletRandom.NextDouble() * 0.55));
                var droplet = new Ellipse
                {
                    Width = width,
                    Height = height,
                    Fill = new SolidColorBrush(Color.FromArgb((byte)(155 + _dropletRandom.Next(70)), 210, 232, 255)),
                    Opacity = 0.92,
                    Effect = new DropShadowEffect { Color = Color.FromRgb(108, 165, 255), BlurRadius = 9, ShadowDepth = 0, Opacity = 0.55 },
                    RenderTransform = new ScaleTransform(1, 1, width / 2, height / 2)
                };
                Canvas.SetLeft(droplet, cx - width / 2);
                Canvas.SetTop(droplet, cy - height / 2);
                DropletCanvas.Children.Add(droplet);

                double angle = (Math.PI * 2 * i / 18.0) + ((_dropletRandom.NextDouble() - 0.5) * 0.52);
                double distance = 46 + (_dropletRandom.NextDouble() * 72);
                int duration = 720 + _dropletRandom.Next(520);
                double targetX = cx + Math.Cos(angle) * distance - width / 2;
                double targetY = cy + Math.Sin(angle) * distance - height / 2;

                var ease = new QuarticEase { EasingMode = EasingMode.EaseOut };
                droplet.BeginAnimation(Canvas.LeftProperty, new DoubleAnimation(targetX, TimeSpan.FromMilliseconds(duration)) { EasingFunction = ease });
                droplet.BeginAnimation(Canvas.TopProperty, new DoubleAnimation(targetY, TimeSpan.FromMilliseconds(duration)) { EasingFunction = ease });
                droplet.BeginAnimation(OpacityProperty, new DoubleAnimation(0, TimeSpan.FromMilliseconds(duration + 120))
                {
                    EasingFunction = new CubicEase { EasingMode = EasingMode.EaseIn }
                });
            }
        }

        private static void Fade(UIElement element, double to, int ms, IEasingFunction? easing = null)
        {
            element.BeginAnimation(OpacityProperty, new DoubleAnimation(to, TimeSpan.FromMilliseconds(ms))
            {
                EasingFunction = easing ?? new CubicEase { EasingMode = EasingMode.EaseOut }
            });
        }

        private static void Scale(ScaleTransform transform, double x, double y, int ms, IEasingFunction? easing = null)
        {
            var ease = easing ?? new CubicEase { EasingMode = EasingMode.EaseOut };
            transform.BeginAnimation(ScaleTransform.ScaleXProperty, new DoubleAnimation(x, TimeSpan.FromMilliseconds(ms)) { EasingFunction = ease });
            transform.BeginAnimation(ScaleTransform.ScaleYProperty, new DoubleAnimation(y, TimeSpan.FromMilliseconds(ms)) { EasingFunction = ease });
        }

        private static void MoveY(TranslateTransform transform, double y, int ms, IEasingFunction? easing = null)
        {
            transform.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(y, TimeSpan.FromMilliseconds(ms))
            {
                EasingFunction = easing ?? new CubicEase { EasingMode = EasingMode.EaseOut }
            });
        }

        private static void Rotate(RotateTransform transform, double to, int ms, bool repeat)
        {
            transform.BeginAnimation(RotateTransform.AngleProperty, new DoubleAnimation(to, TimeSpan.FromMilliseconds(ms))
            {
                RepeatBehavior = repeat ? RepeatBehavior.Forever : new RepeatBehavior(1),
                EasingFunction = repeat ? null : new CubicEase { EasingMode = EasingMode.EaseOut }
            });
        }

        private static void PulseOpacity(UIElement element, double from, double to, int ms)
        {
            element.BeginAnimation(OpacityProperty, new DoubleAnimation(from, to, TimeSpan.FromMilliseconds(ms))
            {
                AutoReverse = true,
                RepeatBehavior = RepeatBehavior.Forever,
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut }
            });
        }
    }
}
