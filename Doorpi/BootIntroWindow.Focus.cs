using System;
using System.Diagnostics;
using System.Windows.Threading;

namespace Doorpi;

public partial class BootIntroWindow
{
    private DispatcherTimer? _preparingFocusTimer;
    private readonly Stopwatch _preparingFocusTime = new();

    private void BeginPreparingFocusProtection()
    {
        if (_preparingFocusTimer != null) return;
        _preparingFocusTime.Restart();
        _preparingFocusTimer = new DispatcherTimer(TimeSpan.FromMilliseconds(150), DispatcherPriority.Background,
            (_, _) => MaintainPreparingFocus(), Dispatcher);
        DoorpiBootDiagnostics.Log("boot-prelude-focus-start");
    }

    private void MaintainPreparingFocus()
    {
        if (DoorpiBootDiagnostics.IsWorkstationLocked()) { _preparingFocusTime.Stop(); return; }
        _preparingFocusTime.Start();
        // Explorer preparation (35 s) and presentation readiness (90 s) have
        // separate budgets. Never keep reclaiming focus indefinitely on failure.
        if (_preparingFocusTime.Elapsed >= TimeSpan.FromSeconds(125))
        {
            StopPreparingFocusProtection("timeout");
            return;
        }
        if (!IsVisible || IsActive) return;
        bool accepted = Activate();
        if (BootStartupTrace.Enabled)
            BootStartupTrace.Record("boot-focus-reclaim", $"accepted={accepted} window=prelude");
    }

    private void StopPreparingFocusProtection(string reason)
    {
        if (_preparingFocusTimer == null) return;
        _preparingFocusTimer.Stop();
        _preparingFocusTimer = null;
        _preparingFocusTime.Stop();
        DoorpiBootDiagnostics.Log("boot-prelude-focus-stop", "reason=" + reason);
    }
}
