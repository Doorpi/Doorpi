using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Xml.Linq;
using ManagedNativeWifi;

namespace Doorpi;

internal sealed class WifiManager : IDisposable
{
    private readonly object _sync = new();
    private readonly SemaphoreSlim _operationLock = new(1, 1);
    private readonly Timer _statusTimer;
    private readonly Timer _probeTimer;
    private readonly Dictionary<Guid, InterfaceInfo> _interfaces = new();
    private readonly Dictionary<string, WifiNetworkEntry> _networks = new(StringComparer.Ordinal);
    private readonly Dictionary<string, ProfilePack> _profiles = new(StringComparer.Ordinal);
    private bool _initialized;
    private bool _initializing;
    private bool _accessDenied;
    private bool _disposed;
    private int _probeRunning;
    private string _operation = "loading";
    private string _message = "Wi-Fi ainda não carregado.";
    private string _messageKey = "wifiNotLoaded";
    private string[] _messageArgs = Array.Empty<string>();
    private string _lastStatusFingerprint = "";

    public event Action<WifiStatus>? StatusChanged;

    public WifiManager()
    {
        _statusTimer = new Timer(_ => EmitStatus(), null, Timeout.Infinite, Timeout.Infinite);
        _probeTimer = new Timer(_ => _ = ProbeAsync(), null, Timeout.Infinite, Timeout.Infinite);
    }

    public WifiStatus GetStatus() => CreateStatus();

    public async Task InitializeAsync()
    {
        lock (_sync)
        {
            if (_initialized || _initializing || _disposed) return;
            _initializing = true;
            _operation = "loading";
            SetMessageUnsafe("wifiLoading", "Carregando Wi-Fi...");
        }
        ScheduleStatus();

        try
        {
            await Task.Run(() =>
            {
                RefreshHardware();
                RefreshProfiles();
            });
            lock (_sync)
            {
                _initialized = true;
                _operation = "idle";
                UpdateHardwareMessageUnsafe();
            }
        }
        catch (UnauthorizedAccessException)
        {
            lock (_sync)
            {
                _accessDenied = true;
                _operation = "error";
                SetMessageUnsafe("wifiLocationAccessRequired", "O Windows bloqueou o acesso às redes. Ative a Localização nas configurações de privacidade.");
            }
        }
        catch (Exception ex)
        {
            lock (_sync)
            {
                _operation = "error";
                if (IsWlanServiceStopped(ex))
                    SetMessageUnsafe("wifiServiceStopped", "O serviço de configuração automática de Wi-Fi está parado.");
                else
                    SetMessageUnsafe("wifiLoadFailed", "Não foi possível carregar o Wi-Fi.");
            }
        }
        finally
        {
            lock (_sync) _initializing = false;
            if (!_disposed) _probeTimer.Change(TimeSpan.FromSeconds(3), TimeSpan.FromSeconds(3));
            ScheduleStatus();
        }
    }

    public async Task SetEnabledAsync(bool enabled)
    {
        await InitializeAsync();
        Guid[] interfaceIds;
        lock (_sync) interfaceIds = _interfaces.Keys.ToArray();
        if (interfaceIds.Length == 0)
        {
            SetOperation("error", "wifiNoAdapter", "Nenhum adaptador Wi-Fi foi encontrado.");
            return;
        }

        SetOperation("changing-radio", enabled ? "wifiTurningOn" : "wifiTurningOff", enabled ? "Ligando Wi-Fi..." : "Desligando Wi-Fi...");
        try
        {
            bool changed = await Task.Run(() => interfaceIds
                .Select(id => enabled ? NativeWifi.TurnOnRadio(id) : NativeWifi.TurnOffRadio(id))
                .Any(result => result));
            if (!changed && IsEnabled() != enabled)
            {
                SetOperation("error", "wifiRadioChangeDenied", "O Windows não permitiu alterar o Wi-Fi.");
                return;
            }
            if (!enabled) lock (_sync) _networks.Clear();
            SetOperation("idle", enabled ? "wifiRadioOn" : "wifiRadioOff", enabled ? "Wi-Fi ligado." : "Wi-Fi desligado.");
        }
        catch (UnauthorizedAccessException)
        {
            SetOperation("error", "wifiRadioChangeDenied", "O Windows não permitiu alterar o Wi-Fi.");
        }
        catch
        {
            SetOperation("error", "wifiRadioChangeFailed", "Não foi possível alterar o Wi-Fi.");
        }
    }

    public async Task ScanAsync()
    {
        await InitializeAsync();
        await _operationLock.WaitAsync();
        try
        {
            if (!IsEnabled())
            {
                SetOperation("error", "wifiTurnOnBeforeScan", "Ligue o Wi-Fi antes de procurar redes.");
                return;
            }

            SetOperation("scanning", "wifiScanning", "Procurando redes...");
            await NativeWifi.ScanNetworksAsync(TimeSpan.FromSeconds(8));
            await Task.Run(RefreshNetworks);
            SetOperation("idle", "wifiScanComplete", "Redes Wi-Fi atualizadas.");
        }
        catch (UnauthorizedAccessException)
        {
            lock (_sync) _accessDenied = true;
            SetOperation("error", "wifiLocationAccessRequired", "O Windows bloqueou a busca. Ative a Localização nas configurações de privacidade.");
        }
        catch
        {
            SetOperation("error", "wifiScanFailed", "Não foi possível procurar redes Wi-Fi.");
        }
        finally
        {
            _operationLock.Release();
            ScheduleStatus();
        }
    }

    public async Task ConnectAsync(string networkId, string password)
    {
        await InitializeAsync();
        await _operationLock.WaitAsync();
        try
        {
            WifiNetworkEntry? entry;
            ProfilePack? savedProfile;
            lock (_sync)
            {
                _networks.TryGetValue(networkId ?? "", out entry);
                _profiles.TryGetValue(networkId ?? "", out savedProfile);
            }
            if (entry == null && savedProfile == null)
            {
                SetOperation("error", "wifiNetworkUnavailable", "A rede não está mais disponível. Procure novamente.");
                return;
            }

            AvailableNetworkPack? network = entry?.Network;
            string ssid = entry?.Ssid ?? ProfileSsid(savedProfile!);
            Guid interfaceId = network?.InterfaceInfo.Id ?? savedProfile!.InterfaceInfo.Id;
            BssType bssType = network?.BssType ?? savedProfile!.Document.BssType;
            string profileName = savedProfile?.Name ?? network?.ProfileName ?? "";
            if (string.IsNullOrWhiteSpace(profileName))
            {
                if (network == null)
                {
                    SetOperation("error", "wifiNetworkUnavailable", "A rede não está mais disponível. Procure novamente.");
                    return;
                }
                string? profileXml = BuildProfileXml(network, password);
                if (profileXml == null)
                {
                    SetOperation("error", "wifiUnsupportedSecurity", "Este tipo de segurança exige configuração pelo Windows.");
                    return;
                }

                profileName = ssid;
                bool profileCreated = NativeWifi.SetProfile(
                    interfaceId,
                    ProfileType.AllUser,
                    profileXml,
                    null,
                    true);
                if (!profileCreated)
                {
                    SetOperation("error", "wifiProfileFailed", "O Windows não conseguiu preparar esta rede.");
                    return;
                }
            }

            SetOperation("connecting", "wifiConnecting", $"Conectando a {ssid}...", ssid);
            bool connected = await NativeWifi.ConnectNetworkAsync(
                interfaceId,
                profileName,
                bssType,
                TimeSpan.FromSeconds(20));
            if (connected)
            {
                await Task.Run(() =>
                {
                    RefreshNetworks();
                    RefreshProfiles();
                });
                SetOperation("idle", "wifiConnectedTo", $"Conectado a {ssid}.", ssid);
            }
            else
            {
                SetOperation("error", "wifiConnectFailed", "Não foi possível conectar. Verifique a senha e tente novamente.");
            }
        }
        catch (UnauthorizedAccessException)
        {
            SetOperation("error", "wifiLocationAccessRequired", "O Windows bloqueou o acesso. Ative a Localização nas configurações de privacidade.");
        }
        catch
        {
            SetOperation("error", "wifiConnectFailed", "Não foi possível conectar à rede Wi-Fi.");
        }
        finally
        {
            _operationLock.Release();
            ScheduleStatus();
        }
    }

    public async Task DisconnectAsync()
    {
        await InitializeAsync();
        await _operationLock.WaitAsync();
        try
        {
            Guid[] connectedIds = NativeWifi.EnumerateInterfaces()
                .Where(item => item.State == InterfaceState.Connected)
                .Select(item => item.Id)
                .ToArray();
            foreach (Guid id in connectedIds)
                await NativeWifi.DisconnectNetworkAsync(id, TimeSpan.FromSeconds(8));
            await Task.Run(() =>
            {
                RefreshNetworks();
                RefreshProfiles();
            });
            SetOperation("idle", "wifiDisconnected", "Wi-Fi desconectado.");
        }
        catch
        {
            SetOperation("error", "wifiDisconnectFailed", "Não foi possível desconectar o Wi-Fi.");
        }
        finally
        {
            _operationLock.Release();
            ScheduleStatus();
        }
    }

    public async Task ForgetAsync(string networkId)
    {
        await InitializeAsync();
        await _operationLock.WaitAsync();
        try
        {
            WifiNetworkEntry? entry;
            ProfilePack? profile;
            lock (_sync)
            {
                _networks.TryGetValue(networkId ?? "", out entry);
                _profiles.TryGetValue(networkId ?? "", out profile);
            }
            string profileName = profile?.Name ?? entry?.Network.ProfileName ?? "";
            Guid interfaceId = profile?.InterfaceInfo.Id ?? entry?.Network.InterfaceInfo.Id ?? Guid.Empty;
            if (interfaceId == Guid.Empty || string.IsNullOrWhiteSpace(profileName))
            {
                SetOperation("error", "wifiProfileUnavailable", "Esta rede não possui um perfil salvo.");
                return;
            }
            var connected = GetConnectedNetworks();
            if (connected.ContainsKey(interfaceId))
                await NativeWifi.DisconnectNetworkAsync(interfaceId, TimeSpan.FromSeconds(8));
            bool removed = NativeWifi.DeleteProfile(interfaceId, profileName);
            if (!removed)
            {
                SetOperation("error", "wifiForgetFailed", "Não foi possível esquecer esta rede.");
                return;
            }
            await Task.Run(() =>
            {
                RefreshNetworks();
                RefreshProfiles();
            });
            SetOperation("idle", "wifiForgotten", "Rede Wi-Fi removida.");
        }
        catch
        {
            SetOperation("error", "wifiForgetFailed", "Não foi possível esquecer esta rede.");
        }
        finally
        {
            _operationLock.Release();
            ScheduleStatus();
        }
    }

    private async Task ProbeAsync()
    {
        if (_disposed || Interlocked.Exchange(ref _probeRunning, 1) != 0) return;
        try
        {
            await Task.Run(() =>
            {
                RefreshHardware();
                RefreshProfiles();
                RefreshConnectionFlags();
            });
            lock (_sync)
            {
                if (!_initialized)
                {
                    _initialized = true;
                    _operation = "idle";
                }
                UpdateHardwareMessageUnsafe(preserveOperationMessage: true);
            }
            ScheduleStatus();
        }
        catch (UnauthorizedAccessException)
        {
            lock (_sync)
            {
                _accessDenied = true;
                if (_operation == "idle") SetMessageUnsafe("wifiLocationAccessRequired", "Ative a Localização do Windows para gerenciar redes Wi-Fi.");
            }
            ScheduleStatus();
        }
        catch (Exception ex)
        {
            if (!IsWlanServiceStopped(ex)) return;
            lock (_sync)
            {
                if (_operation is "idle" or "loading" or "error")
                {
                    _operation = "error";
                    SetMessageUnsafe("wifiServiceStopped", "O serviço de configuração automática de Wi-Fi está parado.");
                }
            }
            ScheduleStatus();
        }
        finally { Interlocked.Exchange(ref _probeRunning, 0); }
    }

    private void RefreshHardware()
    {
        InterfaceInfo[] current = NativeWifi.EnumerateInterfaces().ToArray();
        lock (_sync)
        {
            _interfaces.Clear();
            foreach (InterfaceInfo item in current) _interfaces[item.Id] = item;
            foreach (string stale in _networks
                         .Where(pair => !_interfaces.ContainsKey(pair.Value.Network.InterfaceInfo.Id))
                         .Select(pair => pair.Key)
                         .ToArray())
                _networks.Remove(stale);
            foreach (string stale in _profiles
                         .Where(pair => !_interfaces.ContainsKey(pair.Value.InterfaceInfo.Id))
                         .Select(pair => pair.Key)
                         .ToArray())
                _profiles.Remove(stale);
            _accessDenied = false;
        }
    }

    private void RefreshProfiles()
    {
        ProfilePack[] profiles = NativeWifi.EnumerateProfiles()
            .Where(profile => profile.Document.IsValid && !string.IsNullOrWhiteSpace(ProfileSsid(profile)))
            .ToArray();
        lock (_sync)
        {
            _profiles.Clear();
            foreach (ProfilePack profile in profiles)
            {
                string id = NetworkId(profile.InterfaceInfo.Id, ProfileSsid(profile));
                if (!_profiles.ContainsKey(id)) _profiles[id] = profile;
            }
        }
    }

    private void RefreshNetworks()
    {
        AvailableNetworkPack[] available = NativeWifi.EnumerateAvailableNetworks()
            .Where(item => !string.IsNullOrWhiteSpace(item.Ssid.ToString()) && item.IsConnectable)
            .OrderByDescending(item => item.SignalQuality)
            .ToArray();
        var next = new Dictionary<string, WifiNetworkEntry>(StringComparer.Ordinal);
        foreach (AvailableNetworkPack network in available)
        {
            string ssid = network.Ssid.ToString();
            string id = NetworkId(network.InterfaceInfo.Id, ssid);
            if (!next.ContainsKey(id)) next[id] = new WifiNetworkEntry(network, ssid);
        }
        lock (_sync)
        {
            _networks.Clear();
            foreach (var pair in next) _networks[pair.Key] = pair.Value;
        }
    }

    private void RefreshConnectionFlags()
    {
        // Connection state is read while creating the immutable status payload.
    }

    private WifiStatus CreateStatus()
    {
        lock (_sync)
        {
            var connected = GetConnectedNetworks();
            var networks = _networks.Select(pair => MapNetwork(pair.Key, pair.Value, connected)).ToList();
            foreach (var pair in _profiles)
            {
                ProfilePack profile = pair.Value;
                string ssid = ProfileSsid(profile);
                if (networks.Any(network => string.Equals(network.Id, pair.Key, StringComparison.Ordinal))) continue;
                bool isConnected = connected.TryGetValue(profile.InterfaceInfo.Id, out WifiConnectionSnapshot? current) &&
                                   string.Equals(current.Ssid, ssid, StringComparison.Ordinal);
                networks.Add(new WifiNetworkInfo
                {
                    Id = pair.Key,
                    Ssid = ssid,
                    Connected = isConnected,
                    Saved = true,
                    SignalBars = isConnected ? SignalBars(current!.SignalQuality) : (byte)0,
                    RequiresPassword = false,
                    Security = profile.Document.Authentication.ToString()
                });
            }
            foreach (var connection in connected.Values)
            {
                if (networks.Any(network => network.Connected && string.Equals(network.Ssid, connection.Ssid, StringComparison.Ordinal))) continue;
                networks.Insert(0, new WifiNetworkInfo
                {
                    Id = NetworkId(connection.InterfaceId, connection.Ssid),
                    Ssid = connection.Ssid,
                    Connected = true,
                    Saved = !string.IsNullOrWhiteSpace(connection.ProfileName),
                    SignalBars = SignalBars(connection.SignalQuality),
                    Security = "unknown"
                });
            }
            return new WifiStatus
            {
                Available = _interfaces.Count > 0,
                Enabled = IsEnabledUnsafe(),
                AccessDenied = _accessDenied,
                Operation = _operation,
                Message = _message,
                MessageKey = _messageKey,
                MessageArgs = _messageArgs,
                ConnectedSsid = connected.Values.FirstOrDefault()?.Ssid ?? "",
                Networks = networks
                    .OrderByDescending(network => network.Connected)
                    .ThenByDescending(network => network.Saved)
                    .ThenBy(network => network.Ssid, StringComparer.CurrentCultureIgnoreCase)
                    .ToList()
            };
        }
    }

    private static WifiNetworkInfo MapNetwork(
        string id,
        WifiNetworkEntry entry,
        IReadOnlyDictionary<Guid, WifiConnectionSnapshot> connected)
    {
        AvailableNetworkPack network = entry.Network;
        bool isConnected = connected.TryGetValue(network.InterfaceInfo.Id, out WifiConnectionSnapshot? current) &&
                           string.Equals(current.Ssid, entry.Ssid, StringComparison.Ordinal);
        return new WifiNetworkInfo
        {
            Id = id,
            Ssid = entry.Ssid,
            Connected = isConnected,
            Saved = !string.IsNullOrWhiteSpace(network.ProfileName),
            SignalBars = SignalBars(network.SignalQuality),
            RequiresPassword = network.IsSecurityEnabled && !IsEnhancedOpen(network.AuthenticationAlgorithm),
            Security = network.AuthenticationAlgorithm.ToString()
        };
    }

    private static Dictionary<Guid, WifiConnectionSnapshot> GetConnectedNetworks()
    {
        var result = new Dictionary<Guid, WifiConnectionSnapshot>();
        foreach (InterfaceInfo item in NativeWifi.EnumerateInterfaces().Where(item => item.State == InterfaceState.Connected))
        {
            try
            {
                var (action, connection) = NativeWifi.GetCurrentConnection(item.Id);
                if (action != ActionResult.Success || connection == null) continue;
                result[item.Id] = new WifiConnectionSnapshot(
                    item.Id,
                    connection.Ssid.ToString(),
                    connection.ProfileName,
                    connection.SignalQuality);
            }
            catch { }
        }
        return result;
    }

    private bool IsEnabled()
    {
        lock (_sync) return IsEnabledUnsafe();
    }

    private bool IsEnabledUnsafe()
    {
        if (_interfaces.Count == 0) return false;
        foreach (Guid id in _interfaces.Keys)
        {
            try
            {
                RadioInfo? radio = NativeWifi.GetRadio(id);
                if (radio?.RadioStates.Any(state => state.IsOn) == true) return true;
            }
            catch { }
        }
        return false;
    }

    private static string? BuildProfileXml(AvailableNetworkPack network, string password)
    {
        string ssid = network.Ssid.ToString();
        string? authentication = ProfileAuthentication(network.AuthenticationAlgorithm);
        string? encryption = ProfileEncryption(network.CipherAlgorithm);
        if (string.IsNullOrWhiteSpace(ssid) || authentication == null || encryption == null) return null;

        bool needsKey = network.IsSecurityEnabled && !IsEnhancedOpen(network.AuthenticationAlgorithm);
        if (needsKey && string.IsNullOrEmpty(password)) return null;

        XNamespace ns = "http://www.microsoft.com/networking/WLAN/profile/v1";
        var security = new XElement(ns + "security",
            new XElement(ns + "authEncryption",
                new XElement(ns + "authentication", authentication),
                new XElement(ns + "encryption", encryption),
                new XElement(ns + "useOneX", "false")));
        if (needsKey)
        {
            security.Add(new XElement(ns + "sharedKey",
                new XElement(ns + "keyType", network.AuthenticationAlgorithm == AuthenticationAlgorithm.Shared ? "networkKey" : "passPhrase"),
                new XElement(ns + "protected", "false"),
                new XElement(ns + "keyMaterial", password)));
        }

        var document = new XDocument(
            new XElement(ns + "WLANProfile",
                new XElement(ns + "name", ssid),
                new XElement(ns + "SSIDConfig",
                    new XElement(ns + "SSID",
                        new XElement(ns + "hex", Convert.ToHexString(Encoding.UTF8.GetBytes(ssid))),
                        new XElement(ns + "name", ssid))),
                new XElement(ns + "connectionType", "ESS"),
                new XElement(ns + "connectionMode", "auto"),
                new XElement(ns + "MSM", security)));
        return document.ToString(SaveOptions.DisableFormatting);
    }

    private static string? ProfileAuthentication(AuthenticationAlgorithm value) => value switch
    {
        AuthenticationAlgorithm.Open => "open",
        AuthenticationAlgorithm.Shared => "shared",
        AuthenticationAlgorithm.WPA_PSK => "WPAPSK",
        AuthenticationAlgorithm.RSNA_PSK => "WPA2PSK",
        AuthenticationAlgorithm.WPA3_SAE => "WPA3SAE",
        AuthenticationAlgorithm.OWE => "OWE",
        _ => null
    };

    private static string? ProfileEncryption(CipherAlgorithm value) => value switch
    {
        CipherAlgorithm.None => "none",
        CipherAlgorithm.WEP or CipherAlgorithm.WEP_40 or CipherAlgorithm.WEP_104 => "WEP",
        CipherAlgorithm.TKIP => "TKIP",
        CipherAlgorithm.CCMP => "AES",
        CipherAlgorithm.GCMP => "GCMP",
        CipherAlgorithm.GCMP_256 => "GCMP256",
        CipherAlgorithm.CCMP_256 => "AES",
        _ => null
    };

    private static bool IsEnhancedOpen(AuthenticationAlgorithm value)
        => value is AuthenticationAlgorithm.Open or AuthenticationAlgorithm.OWE;

    private static byte SignalBars(int quality)
        => (byte)(quality <= 0 ? 0 : Math.Clamp((int)Math.Ceiling(quality / 25d), 1, 4));

    private static string NetworkId(Guid interfaceId, string ssid) => interfaceId.ToString("N") + "|" + ssid;

    private static string ProfileSsid(ProfilePack profile) => profile.Document.Ssid.ToString();

    private static bool IsWlanServiceStopped(Exception exception)
    {
        Exception? current = exception;
        while (current != null)
        {
            if (current is Win32Exception win32 && win32.NativeErrorCode == 1062) return true;
            current = current is TargetInvocationException target ? target.InnerException : current.InnerException;
        }
        return false;
    }

    private void UpdateHardwareMessageUnsafe(bool preserveOperationMessage = false)
    {
        if (preserveOperationMessage && _operation != "idle") return;
        if (_accessDenied) SetMessageUnsafe("wifiLocationAccessRequired", "Ative a Localização do Windows para gerenciar redes Wi-Fi.");
        else if (_interfaces.Count == 0) SetMessageUnsafe("wifiNoAdapter", "Nenhum adaptador Wi-Fi foi encontrado.");
        else if (IsEnabledUnsafe()) SetMessageUnsafe("wifiRadioOn", "Wi-Fi ligado.");
        else SetMessageUnsafe("wifiRadioOff", "Wi-Fi desligado.");
    }

    private void SetMessageUnsafe(string key, string message)
    {
        _messageKey = key;
        _message = message;
        _messageArgs = Array.Empty<string>();
    }

    private void SetOperation(string operation, string key, string message, params string[] args)
    {
        lock (_sync)
        {
            _operation = operation;
            SetMessageUnsafe(key, message);
            _messageArgs = args ?? Array.Empty<string>();
        }
        ScheduleStatus();
    }

    private void ScheduleStatus()
    {
        if (!_disposed) _statusTimer.Change(80, Timeout.Infinite);
    }

    private void EmitStatus()
    {
        if (_disposed) return;
        try
        {
            WifiStatus next = CreateStatus();
            string fingerprint = JsonSerializer.Serialize(next);
            lock (_sync)
            {
                if (string.Equals(_lastStatusFingerprint, fingerprint, StringComparison.Ordinal)) return;
                _lastStatusFingerprint = fingerprint;
            }
            StatusChanged?.Invoke(next);
        }
        catch { }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _statusTimer.Dispose();
        _probeTimer.Dispose();
        _operationLock.Dispose();
    }

    private sealed record WifiNetworkEntry(AvailableNetworkPack Network, string Ssid);
    private sealed record WifiConnectionSnapshot(Guid InterfaceId, string Ssid, string ProfileName, int SignalQuality);
}

internal sealed class WifiStatus
{
    public bool Available { get; set; }
    public bool Enabled { get; set; }
    public bool AccessDenied { get; set; }
    public string Operation { get; set; } = "idle";
    public string Message { get; set; } = "";
    public string MessageKey { get; set; } = "";
    public string[] MessageArgs { get; set; } = Array.Empty<string>();
    public string ConnectedSsid { get; set; } = "";
    public List<WifiNetworkInfo> Networks { get; set; } = new();
}

internal sealed class WifiNetworkInfo
{
    public string Id { get; set; } = "";
    public string Ssid { get; set; } = "";
    public bool Connected { get; set; }
    public bool Saved { get; set; }
    public byte SignalBars { get; set; }
    public bool RequiresPassword { get; set; }
    public string Security { get; set; } = "";
}
