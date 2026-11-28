using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Doorpi.Storage;

namespace Doorpi;

public partial class MainWindow
{
    private readonly object _soundManagerLock = new();
    private SoundManager? _soundManager;
    private const int DefaultAchievementVolume = 50;
    private readonly object _achievementVolumeLock = new();
    private int? _achievementVolume;
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

    private int GetAchievementVolume()
    {
        lock (_achievementVolumeLock)
        {
            if (_achievementVolume is int cached) return cached;
            string settings = Path.Combine(dataFolder, "sound-settings.json");
            try
            {
                if (StateStorage.Exists(settings))
                {
                    using var document = JsonDocument.Parse(StateStorage.ReadAllText(settings));
                    if (document.RootElement.ValueKind == JsonValueKind.Object &&
                        document.RootElement.TryGetProperty("achievementVolume", out var value) &&
                        value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out int volume))
                        return (_achievementVolume = Math.Clamp(volume, 0, 100)).Value;
                }
            }
            catch (Exception ex) { Debug.WriteLine("[Sound] Volume das conquistas: " + ex.Message); }
            _achievementVolume = DefaultAchievementVolume;
            return DefaultAchievementVolume;
        }
    }

    private void SetAchievementVolume(int volume)
    {
        volume = Math.Clamp(volume, 0, 100);
        lock (_achievementVolumeLock)
        {
            if (GetAchievementVolume() == volume) return;
            StateStorage.WriteAllText(Path.Combine(dataFolder, "sound-settings.json"),
                JsonSerializer.Serialize(new { achievementVolume = volume }));
            _achievementVolume = volume;
        }
        if (_achievementSoundPlayer != null) _achievementSoundPlayer.Volume = volume / 100.0;
    }

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
                achievementVolume = GetAchievementVolume(),
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
        StopAchievementSound();
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
