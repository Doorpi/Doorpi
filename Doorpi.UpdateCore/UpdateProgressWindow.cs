using System.Windows;

namespace Doorpi.UpdateCore;

public sealed class UpdateProgressWindow : Window
{
    private readonly UpdateProgressView _view = new();

    public UpdateProgressWindow()
    {
        Title = "Doorpi Update";
        WindowStyle = WindowStyle.None;
        WindowState = WindowState.Maximized;
        ResizeMode = ResizeMode.NoResize;
        Topmost = true;
        Background = System.Windows.Media.Brushes.Black;
        Content = _view;
        ShowInTaskbar = false;
    }

    public void SetStatus(string title, string message, double progress, string? tip = null)
        => _view.SetStatus(title, message, progress, tip);
}
