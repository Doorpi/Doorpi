using System;
using System.Diagnostics;
using System.Windows.Threading;

namespace Doorpi;

public partial class MainWindow
{
    private DispatcherTimer? _startupFocusTimer;
    private readonly Stopwatch _startupFocusTime = new();
    private bool _startupFocusOriginalTopmost;
    private IntPtr _startupLastForeground;

    private bool StartupExternalSessionActive => _gameSessionActive || _mediaExeModeActive ||
        _isStoreLauncherSession || _ytWebView != null || _webAppWindow != null ||
        _systemControllerActive || _dialogModeActive || _nativeTaskSwitcherActive != 0;

    private void BeginStartupFocusProtection()
    {
        if (_startupFocusTimer != null || (!BootSessionClient.IsPresentationManaged && !_useNativeBootIntro)) return;
        _startupFocusOriginalTopmost = Topmost;
        _startupFocusTime.Restart();
        _startupFocusTimer = new DispatcherTimer(TimeSpan.FromMilliseconds(150), DispatcherPriority.Background,
            (_, _) => MaintainStartupFocus(), Dispatcher);
        Closed += (_, _) => StopStartupFocusProtection("closed");
        DoorpiBootDiagnostics.Log("boot-focus-protection-start");
        MaintainStartupFocus();
    }

    private void MaintainStartupFocus()
    {
        if (StartupExternalSessionActive) { StopStartupFocusProtection("external-session"); return; }
        if (DoorpiBootDiagnostics.IsWorkstationLocked()) { _startupFocusTime.Stop(); return; }
        _startupFocusTime.Start();
        if (_startupFocusTime.Elapsed >= TimeSpan.FromSeconds(90)) { StopStartupFocusProtection("timeout"); return; }
        if (!IsVisible || _mainWindowHandle == IntPtr.Zero) return;
        if (!Topmost) Topmost = true;
        IntPtr foreground = GetForegroundWindow();
        if (foreground != _startupLastForeground)
        {
            _startupLastForeground = foreground;
            if (BootStartupTrace.Enabled)
            {
                GetWindowThreadProcessId(foreground, out uint pid);
                string name = "unknown";
                try { using var process = Process.GetProcessById((int)pid); name = process.ProcessName; } catch { }
                DoorpiBootDiagnostics.Log("boot-focus-observed", $"pid={pid} process={name} doorpi={foreground == _mainWindowHandle}");
            }
        }
        if (foreground == _mainWindowHandle) return;
        SetWindowPos(_mainWindowHandle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        bool foregroundAccepted = SetForegroundWindow(_mainWindowHandle);
        Activate();
        webView?.Focus();
        if (BootStartupTrace.Enabled) DoorpiBootDiagnostics.Log("boot-focus-reclaim", $"accepted={foregroundAccepted}");
    }

    private void StopStartupFocusProtection(string reason)
    {
        if (_startupFocusTimer == null) return;
        if (reason == "interactive" && !StartupExternalSessionActive) MaintainStartupFocus();
        if (_startupFocusTimer == null) return;
        _startupFocusTimer?.Stop();
        _startupFocusTimer = null;
        _startupFocusTime.Stop();
        if (!_startupFocusOriginalTopmost) ReleaseDoorpiTopmost();
        DoorpiBootDiagnostics.Log("boot-focus-protection-stop", "reason=" + reason);
    }
}
