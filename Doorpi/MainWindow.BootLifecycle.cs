using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Doorpi;

public partial class MainWindow
{
    private int _bootReadinessObservationStarted;
    private int _bootInteractiveReady;
    private int _startupRecoveryActive;

    internal void SuspendStartupForRecovery()
    {
        Interlocked.Exchange(ref _startupRecoveryActive, 1);
        _homeWebViewHealthProbes.Cancel();
        StopStartupFocusProtection("recovery");
        _mainUiGamepadActive = false;
        StopGlobalControllerShortcutMonitor();
        ReleaseConfiguredControlOutputs();
        ReleaseAllStuckKeys();
        IsEnabled = false;
    }

    private string BootPresentationScript() =>
        $"window.__doorpiBootstrapManaged = {((BootSessionClient.IsPresentationManaged || _useNativeBootIntro) ? "true" : "false")}; " +
        $"window.__doorpiSkipBootIntro = {((BootSessionClient.SkipIntro || Volatile.Read(ref _bootInteractiveReady) == 1) ? "true" : "false")}; " +
        $"window.__doorpiPresentationReleased = {(Volatile.Read(ref _bootInteractiveReady) == 1 ? "true" : "false")};";

    private void ReleasePresentationOnHomeReload()
    {
        if (Volatile.Read(ref _bootInteractiveReady) == 0) return;
        // Document-created scripts may contain the initial boot values. A reload
        // must not wait for an already-finished prelude or replay its package.
        _ = webView?.CoreWebView2?.ExecuteScriptAsync(
            "window.__doorpiSkipBootIntro=true; window.__doorpiPresentationReleased=true; window.dispatchEvent(new Event('doorpi:boot-presentation-released'));");
    }

    private void ObserveBootReadiness()
    {
        if (Interlocked.Exchange(ref _bootReadinessObservationStarted, 1) != 0) return;
        _ = ObserveBootReadinessAsync();
    }

    private async Task ObserveBootReadinessAsync()
    {
        bool presentationReleased = !BootSessionClient.IsPresentationManaged && !_useNativeBootIntro;
        bool preparedLogged = false;
        var elapsed = Stopwatch.StartNew();
        while (elapsed.Elapsed < TimeSpan.FromSeconds(90))
        {
            if (Volatile.Read(ref _startupRecoveryActive) == 1) return;
            if (DoorpiBootDiagnostics.IsWorkstationLocked())
            {
                elapsed.Stop();
                await Task.Delay(500);
                continue;
            }
            elapsed.Start();
            try
            {
                var result = await Dispatcher.InvokeAsync(async () =>
                {
                    if (webView?.CoreWebView2 == null) return "null";
                    return await webView.CoreWebView2.ExecuteScriptAsync(@"
                        (() => {
                            const visible = id => {
                                const el = document.getElementById(id);
                                if (!el) return false;
                                const css = getComputedStyle(el), rect = el.getBoundingClientRect();
                                return css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) > .9 && rect.width > 0 && rect.height > 0;
                            };
                            return {
                                focused: document.hasFocus(),
                                visibility: document.visibilityState,
                                paint: performance.getEntriesByType('paint').map(p => ({name: p.name, startTime: p.startTime})),
                                prepared: document.readyState === 'complete' && window.DoorpiIntro?.isPrepared?.() === true,
                                interactive: window.DoorpiIntro?.isComplete?.() === true && typeof postToHost === 'function' && typeof moveFocus === 'function' &&
                                    (visible('doorpiUserPicker') || visible('setupContainer') ||
                                     (!document.body.classList.contains('doorpi-session-locked') && visible('doorpi-app-ui')))
                            };
                        })()");
                }).Task.Unwrap().WaitAsync(TimeSpan.FromSeconds(4));
                if (Volatile.Read(ref _startupRecoveryActive) == 1) return;
                using var json = JsonDocument.Parse(result);
                if (json.RootElement.ValueKind == JsonValueKind.Object)
                {
                    bool prepared = json.RootElement.GetProperty("prepared").GetBoolean();
                    if (prepared && !preparedLogged)
                    {
                        preparedLogged = true;
                        BootStartupTrace.Record("boot-browser-prepared", result);
                    }
                    if (prepared) BootSessionClient.PresentationPrepared();
                    if (!presentationReleased && prepared && BootSessionClient.IsPresentationReleased())
                    {
                        // The legacy direct-shell entry also uses the same two-phase
                        // handoff, so its native window cannot hide the package's start.
                        if (_nativeBootIntroWindow != null)
                        {
                            Interlocked.Exchange(ref _nativeBootIntroHandoffComplete, 1);
                            try { await _nativeBootIntroWindow.FadeOutAndCloseAsync(); }
                            catch (InvalidOperationException) { } // Already closed by the user.
                            finally { _nativeBootIntroWindow = null; }
                        }
                        await Dispatcher.InvokeAsync(async () =>
                        {
                            BeginStartupFocusProtection();
                            if (webView?.CoreWebView2 != null)
                                await webView.CoreWebView2.ExecuteScriptAsync(
                                    "window.__doorpiPresentationReleased=true; window.dispatchEvent(new Event('doorpi:boot-presentation-released'));");
                        }).Task.Unwrap().WaitAsync(TimeSpan.FromSeconds(4));
                        presentationReleased = true;
                    }
                    if (presentationReleased && json.RootElement.GetProperty("interactive").GetBoolean())
                    {
                        Interlocked.Exchange(ref _bootInteractiveReady, 1);
                        StopStartupFocusProtection("interactive");
                        BootSessionClient.InteractiveReady();
                        CompletePendingDoorpiHealthCheck();
                        DoorpiBootDiagnostics.Log("boot-ui-interactive", $"elapsedMs={elapsed.ElapsedMilliseconds}");
                        if (BootStartupTrace.Enabled)
                        {
                            BootStartupTrace.Record("boot-browser-interactive", result);
                            BootStartupTrace.RecordProcess(Environment.ProcessId, "DoorpiMain");
                            foreach (var process in webView.CoreWebView2.Environment.GetProcessInfos())
                                BootStartupTrace.RecordProcess(process.ProcessId, process.Kind.ToString());
                        }
                        return;
                    }
                }
            }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("boot-readiness-probe-pending", ex.GetType().Name);
            }
            await Task.Delay(250);
        }
        DoorpiBootDiagnostics.Log("boot-ui-readiness-timeout");
    }
}
