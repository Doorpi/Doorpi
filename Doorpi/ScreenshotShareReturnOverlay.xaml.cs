using System;
using System.ComponentModel;
using System.Windows;

namespace Doorpi;

internal partial class ScreenshotShareReturnOverlay : Window
{
    private readonly Action _onReturnRequested;
    private bool _allowClose;
    private bool _returnRequested;

    internal ScreenshotShareReturnOverlay(Action onReturnRequested, bool portuguese)
    {
        _onReturnRequested = onReturnRequested;
        InitializeComponent();

        Heading.Text = portuguese ? "Postando no X" : "Posting to X";
        Hint.Text = portuguese
            ? "As capturas foram copiadas. Use o controle como mouse e teclado; o botão Xbox fecha esta janela e volta ao Doorpi."
            : "The screenshots were copied. Use the controller as mouse and keyboard; the Xbox button closes this window and returns to Doorpi.";
        ReturnLabel.Text = portuguese ? "Fechar e voltar ao Doorpi" : "Close and return to Doorpi";
        Loaded += (_, _) => PositionAtScreenEdge();
    }

    internal void CloseForReturn()
    {
        _allowClose = true;
        Close();
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (!_allowClose && !Dispatcher.HasShutdownStarted)
        {
            e.Cancel = true;
            RequestReturn();
            return;
        }
        base.OnClosing(e);
    }

    private void ReturnClick(object sender, RoutedEventArgs e) => RequestReturn();

    private void RequestReturn()
    {
        if (_returnRequested) return;
        _returnRequested = true;
        _onReturnRequested();
    }

    private void PositionAtScreenEdge()
    {
        Left = Math.Max(SystemParameters.WorkArea.Left + 16,
            SystemParameters.WorkArea.Right - ActualWidth - 24);
        Top = SystemParameters.WorkArea.Top + 22;
    }
}
