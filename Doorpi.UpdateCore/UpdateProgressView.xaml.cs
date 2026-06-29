using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Animation;

namespace Doorpi.UpdateCore;

public partial class UpdateProgressView : UserControl
{
    private double _progress;
    private string _currentTip = "";

    public UpdateProgressView()
    {
        InitializeComponent();
        SizeChanged += (_, _) => ApplyProgressWidth();
    }

    public void SetStatus(string title, string message, double progress, string? tip = null)
    {
        Dispatcher.Invoke(() =>
        {
            if (!string.IsNullOrWhiteSpace(title))
                TitleText.Text = title;

            string status = string.IsNullOrWhiteSpace(message)
                ? "Preparando atualização."
                : message.Trim();

            bool hasSeparateTip = !string.IsNullOrWhiteSpace(tip) &&
                                  !string.Equals(tip.Trim(), status, StringComparison.Ordinal);

            StatusText.Text = status;
            StatusText.Visibility = hasSeparateTip ? Visibility.Visible : Visibility.Collapsed;
            SetTipText(hasSeparateTip ? tip : status);

            _progress = Math.Clamp(progress, 0, 1);
            ApplyProgressWidth();
        });
    }

    private void SetTipText(string? text)
    {
        string next = string.IsNullOrWhiteSpace(text)
            ? "A atualização está preparando os arquivos necessários."
            : text.Trim();

        if (string.Equals(_currentTip, next, StringComparison.Ordinal))
            return;

        _currentTip = next;

        var fadeOut = new DoubleAnimation(0, TimeSpan.FromMilliseconds(260))
        {
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
        };

        fadeOut.Completed += (_, _) =>
        {
            TipText.Text = next;
            var fadeIn = new DoubleAnimation(0.92, TimeSpan.FromMilliseconds(520))
            {
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
            };
            TipText.BeginAnimation(OpacityProperty, fadeIn);
        };

        TipText.BeginAnimation(OpacityProperty, fadeOut);
    }

    private void ApplyProgressWidth()
    {
        double trackWidth = ProgressTrack.ActualWidth;
        if (trackWidth <= 0)
            trackWidth = ActualWidth > 0 ? Math.Min(920, ActualWidth * 0.72) : 920;

        ProgressFill.Width = trackWidth * _progress;
    }
}
