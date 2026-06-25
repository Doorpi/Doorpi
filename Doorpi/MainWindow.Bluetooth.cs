using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;

namespace Doorpi
{
    public partial class MainWindow
    {
        private readonly object _bluetoothManagerLock = new();
        private BluetoothManager? _bluetoothManager;

        private static readonly JsonSerializerOptions BluetoothJsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        private BluetoothManager GetBluetoothManager()
        {
            lock (_bluetoothManagerLock)
            {
                if (_bluetoothManager != null) return _bluetoothManager;
                _bluetoothManager = new BluetoothManager();
                _bluetoothManager.StatusChanged += SendBluetoothStatusToUI;
                return _bluetoothManager;
            }
        }

        private void RequestBluetoothStatus()
        {
            BluetoothManager manager = GetBluetoothManager();
            SendBluetoothStatusToUI(manager.GetStatus());
            _ = RunBluetoothActionAsync(manager.InitializeAsync);
        }

        private void SetBluetoothEnabled(bool enabled)
            => _ = RunBluetoothActionAsync(() => GetBluetoothManager().SetEnabledAsync(enabled));

        private void StartBluetoothDiscovery()
            => _ = RunBluetoothActionAsync(GetBluetoothManager().StartDiscoveryAsync);

        private void StopBluetoothDiscovery()
            => GetBluetoothManager().StopDiscovery();

        private void PairBluetoothDevice(string deviceId)
            => _ = RunBluetoothActionAsync(() => GetBluetoothManager().PairAsync(deviceId));

        private void RemoveBluetoothDevice(string deviceId)
            => _ = RunBluetoothActionAsync(() => GetBluetoothManager().RemoveAsync(deviceId));

        private static async Task RunBluetoothActionAsync(Func<Task> action)
        {
            try { await action().ConfigureAwait(false); }
            catch (Exception ex) { Debug.WriteLine("[Bluetooth] Acao falhou: " + ex.Message); }
        }

        private void SendBluetoothStatusToUI(BluetoothStatus status)
        {
            try
            {
                string payload = JsonSerializer.Serialize(new
                {
                    type = "bluetoothStatus",
                    status.Available,
                    status.Enabled,
                    status.AccessDenied,
                    status.Discovering,
                    status.DiscoveryEndsAt,
                    status.Operation,
                    status.Message,
                    status.MessageKey,
                    status.MessageArgs,
                    status.Devices,
                    status.PairingPrompt
                }, BluetoothJsonOptions);

                Dispatcher.BeginInvoke(() =>
                {
                    try { webView?.CoreWebView2?.PostWebMessageAsString(payload); }
                    catch (Exception ex) { Debug.WriteLine("[Bluetooth] Envio ao WebView falhou: " + ex.Message); }
                });
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Bluetooth] Serializacao falhou: " + ex.Message);
            }
        }

        private void DisposeBluetoothManager()
        {
            BluetoothManager? manager;
            lock (_bluetoothManagerLock)
            {
                manager = _bluetoothManager;
                _bluetoothManager = null;
            }
            if (manager == null) return;
            manager.StatusChanged -= SendBluetoothStatusToUI;
            manager.Dispose();
        }
    }
}
