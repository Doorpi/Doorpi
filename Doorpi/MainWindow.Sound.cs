using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;

namespace Doorpi;

public partial class MainWindow
{
    private readonly object _soundManagerLock = new();
    private SoundManager? _soundManager;
    private static readonly JsonSerializerOptions SoundJsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private SoundManager GetSoundManager()
    {
        lock (_soundManagerLock)
        {
            if (_soundManager != null) return _soundManager;
            _soundManager = new SoundManager();
            _soundManager.StatusChanged += SendSoundStatusToUI;
            return _soundManager;
        }
    }

    private void RequestSoundStatus()
        => _ = RunSoundActionAsync(() =>
        {
            SendSoundStatusToUI(GetSoundManager().GetStatus());
            return Task.CompletedTask;
        });

    private void SetDefaultSoundDevice(string deviceId)
        => _ = RunSoundActionAsync(() =>
        {
            GetSoundManager().SetDefaultDevice(deviceId);
            return Task.CompletedTask;
        });

    private void SetSystemVolume(int volume)
        => _ = RunSoundActionAsync(() =>
        {
            GetSoundManager().SetMasterVolume(volume);
            return Task.CompletedTask;
        });

    private static async Task RunSoundActionAsync(Func<Task> action)
    {
        try { await action().ConfigureAwait(false); }
        catch (Exception ex) { Debug.WriteLine("[Sound] Acao falhou: " + ex.Message); }
    }

    private void SendSoundStatusToUI(SoundStatus status)
    {
        try
        {
            string payload = JsonSerializer.Serialize(new
            {
                type = "soundStatus",
                status.Available,
                status.Operation,
                status.Message,
                status.MessageKey,
                status.DefaultDeviceId,
                status.MasterVolume,
                status.Muted,
                status.Devices
            }, SoundJsonOptions);

            Dispatcher.BeginInvoke(() =>
            {
                try { webView?.CoreWebView2?.PostWebMessageAsString(payload); }
                catch (Exception ex) { Debug.WriteLine("[Sound] Envio ao WebView falhou: " + ex.Message); }
            });
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Sound] Serializacao falhou: " + ex.Message);
        }
    }

    private void DisposeSoundManager()
    {
        SoundManager? manager;
        lock (_soundManagerLock)
        {
            manager = _soundManager;
            _soundManager = null;
        }
        if (manager == null) return;
        manager.StatusChanged -= SendSoundStatusToUI;
        manager.Dispose();
    }
}
