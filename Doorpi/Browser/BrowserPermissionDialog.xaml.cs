using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;

namespace Doorpi;

internal partial class BrowserPermissionDialog : Window
{
    private static int _captured;
    private static int _awaitingNeutral;
    private readonly TaskCompletionSource<bool?> _completion = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly DispatcherTimer _timer;
    private readonly XInputButtonTracker _buttons = new();
    private bool _neutralSeen;
    private int _axisDirection;
    internal bool ReturnFocusToOwner { get; private set; }

    internal static bool InputCaptured
    {
        get
        {
            if (Volatile.Read(ref _captured) != 0) return true;
            if (Volatile.Read(ref _awaitingNeutral) == 0) return false;
            if (!IsNeutral(XInputControllerHub.Read())) return true;
            Interlocked.Exchange(ref _awaitingNeutral, 0);
            return false;
        }
    }

    internal BrowserPermissionDialog(string appName, string origin, BrowserPermissionResource resource, bool portuguese)
    {
        InitializeComponent();
        MaxWidth = Math.Max(300, SystemParameters.WorkArea.Width - 40);
        MaxHeight = Math.Max(300, SystemParameters.WorkArea.Height - 40);
        Heading.Text = resource == BrowserPermissionResource.Camera
            ? (portuguese ? "Permitir acesso à câmera?" : "Allow camera access?")
            : (portuguese ? "Permitir acesso ao microfone?" : "Allow microphone access?");
        ApplicationLabel.Text = appName;
        OriginLabel.Text = origin;
        Explanation.Text = portuguese
            ? "Sua decisão será salva para este perfil, aplicativo e site. Você pode removê-la nas configurações de permissões."
            : "Your decision will be saved for this profile, app and site. You can remove it in permission settings.";
        BlockButton.Content = portuguese ? "Não permitir" : "Block";
        AllowButton.Content = portuguese ? "Permitir" : "Allow";
        Hints.Text = portuguese ? "← → Escolher   A / Enter Confirmar   B / Esc Cancelar" : "← → Choose   A / Enter Confirm   B / Esc Cancel";
        _timer = new DispatcherTimer(TimeSpan.FromMilliseconds(40), DispatcherPriority.Input, (_, _) => PollController(), Dispatcher);
        _timer.Stop();
        Loaded += (_, _) => { _buttons.Update(XInputControllerHub.Read()); BlockButton.Focus(); _timer.Start(); };
        Closing += (_, _) => ReturnFocusToOwner = IsActive;
        Closed += (_, _) => { _timer.Stop(); _completion.TrySetResult(null); };
    }

    internal Task<bool?> AskAsync()
    {
        CaptureInput();
        Show();
        Activate();
        return _completion.Task;
    }

    internal static void CaptureInput() => Interlocked.Exchange(ref _captured, 1);

    internal static void ReleaseInput()
    {
        Interlocked.Exchange(ref _awaitingNeutral, 1);
        Interlocked.Exchange(ref _captured, 0);
    }

    internal void Cancel() => Finish(null);
    private void Finish(bool? allowed)
    {
        if (_completion.Task.IsCompleted) return;
        _completion.TrySetResult(allowed);
        Close();
    }
    private void BlockClick(object sender, RoutedEventArgs e) => Finish(false);
    private void AllowClick(object sender, RoutedEventArgs e) => Finish(true);
    private void MoveChoice() { if (AllowButton.IsKeyboardFocused) BlockButton.Focus(); else AllowButton.Focus(); }
    private void HandleKey(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape) { Finish(null); e.Handled = true; }
        else if (e.Key == Key.Enter) { Finish(AllowButton.IsKeyboardFocused); e.Handled = true; }
        else if (e.Key is Key.Left or Key.Right or Key.Up or Key.Down) { MoveChoice(); e.Handled = true; }
    }
    private void PollController()
    {
        var snapshot = XInputControllerHub.Read();
        _buttons.Update(snapshot);
        if (!IsActive || DoorpiBootDiagnostics.IsWorkstationLocked()) return;
        if (!_neutralSeen) { _neutralSeen = IsNeutral(snapshot); return; }
        int direction = snapshot.ThumbLX > .55 ? 1 : snapshot.ThumbLX < -.55 ? -1 : 0;
        if (_buttons.AnyPressed(0x2000)) Finish(null);
        else if (_buttons.AnyPressed(0x1000)) Finish(AllowButton.IsKeyboardFocused);
        else if (_buttons.AnyPressed(0x000F) || (direction != 0 && direction != _axisDirection)) MoveChoice();
        _axisDirection = direction;
    }
    private static bool IsNeutral(XInputSnapshot snapshot)
        => snapshot.Buttons == 0 && !snapshot.LeftTrigger && Math.Abs(snapshot.ThumbLX) < .3 && Math.Abs(snapshot.ThumbLY) < .3
           && Math.Abs(snapshot.ThumbRX) < .3 && Math.Abs(snapshot.ThumbRY) < .3;
}
