using System.Windows;
using System.Windows.Controls;

namespace Doorpi.UpdateCore;

public partial class UpdateProgressView : UserControl
{
    private double _progress;

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

            StatusText.Text = message;
            if (!string.IsNullOrWhiteSpace(tip))
                TipText.Text = tip;

            _progress = Math.Clamp(progress, 0, 1);
            ApplyProgressWidth();
        });
    }

    private void ApplyProgressWidth()
    {
        double trackWidth = ProgressTrack.ActualWidth;
        if (trackWidth <= 0)
            trackWidth = ActualWidth > 0 ? Math.Min(920, ActualWidth * 0.72) : 920;

        ProgressFill.Width = trackWidth * _progress;
    }
}
