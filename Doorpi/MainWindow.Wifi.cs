using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;

namespace Doorpi;

public partial class MainWindow
{
    private readonly object _wifiManagerLock = new();
    private WifiManager? _wifiManager;
    private static readonly JsonSerializerOptions WifiJsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private WifiManager GetWifiManager()
    {
        lock (_wifiManagerLock)
        {
            if (_wifiManager != null) return _wifiManager;
            _wifiManager = new WifiManager();
            _wifiManager.StatusChanged += SendWifiStatusToUI;
            return _wifiManager;
        }
    }

    private void RequestWifiStatus()
    {
        WifiManager manager = GetWifiManager();
        SendWifiStatusToUI(manager.GetStatus());
        _ = RunWifiActionAsync(manager.InitializeAsync);
    }

    private void SetWifiEnabled(bool enabled) => _ = RunWifiActionAsync(() => GetWifiManager().SetEnabledAsync(enabled));
    private void ScanWifiNetworks() => _ = RunWifiActionAsync(GetWifiManager().ScanAsync);
    private void ConnectWifiNetwork(string id, string password) => _ = RunWifiActionAsync(() => GetWifiManager().ConnectAsync(id, password));
    private void DisconnectWifi() => _ = RunWifiActionAsync(GetWifiManager().DisconnectAsync);
    private void ForgetWifiNetwork(string id) => _ = RunWifiActionAsync(() => GetWifiManager().ForgetAsync(id));

    private static async Task RunWifiActionAsync(Func<Task> action)
    {
        try { await action().ConfigureAwait(false); }
        catch (Exception ex) { Debug.WriteLine("[WiFi] Acao falhou: " + ex.Message); }
    }

    private void SendWifiStatusToUI(WifiStatus status)
    {
        try
        {
            string payload = JsonSerializer.Serialize(new
            {
                type = "wifiStatus",
                status.Available,
                status.Enabled,
                status.AccessDenied,
                status.Operation,
                status.Message,
                status.MessageKey,
                status.MessageArgs,
                status.ConnectedSsid,
                status.Networks
            }, WifiJsonOptions);
            Dispatcher.BeginInvoke(() =>
            {
                try { webView?.CoreWebView2?.PostWebMessageAsString(payload); }
                catch (Exception ex) { Debug.WriteLine("[WiFi] Envio ao WebView falhou: " + ex.Message); }
            });
        }
        catch (Exception ex) { Debug.WriteLine("[WiFi] Serializacao falhou: " + ex.Message); }
    }

    private void DisposeWifiManager()
    {
        WifiManager? manager;
        lock (_wifiManagerLock)
        {
            manager = _wifiManager;
            _wifiManager = null;
        }
        if (manager == null) return;
        manager.StatusChanged -= SendWifiStatusToUI;
        manager.Dispose();
    }
}
