using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Windows.Devices.Bluetooth;
using Windows.Devices.Enumeration;
using Windows.Devices.Radios;
using Windows.Foundation;

namespace Doorpi;

internal sealed class BluetoothManager : IDisposable
{
    private static readonly TimeSpan DiscoveryDuration = TimeSpan.FromSeconds(30);

    private static readonly string[] RequestedProperties =
    {
        "System.Devices.Aep.IsConnected",
        "System.Devices.Aep.ContainerId",
        "System.Devices.Aep.Category",
        "System.Devices.Aep.DeviceAddress",
        "System.Devices.Aep.SignalStrength",
        "System.Devices.FriendlyName",
        "System.ItemNameDisplay"
    };

    private readonly object _sync = new();
    private readonly SemaphoreSlim _operationLock = new(1, 1);
    private readonly Dictionary<string, TrackedDevice> _devices = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<DeviceWatcher> _pairedWatchers = new();
    private readonly List<DeviceWatcher> _discoveryWatchers = new();
    private readonly Timer _statusTimer;
    private readonly Timer _discoveryTimer;
    private readonly Timer _discoveryProbeTimer;
    private readonly Timer _radioProbeTimer;
    private Radio? _radio;
    private int _radioProbeRunning;
    private int _discoveryProbeRunning;
    private bool _initialized;
    private bool _initializing;
    private bool _discovering;
    private bool _accessDenied;
    private bool _disposed;
    private DateTimeOffset? _discoveryEndsAt;
    private string _operation = "idle";
    private string _message = "Bluetooth ainda não carregado.";
    private string _messageKey = "bluetoothNotLoaded";
    private string[] _messageArgs = Array.Empty<string>();
    private BluetoothPairingPrompt? _pairingPrompt;
    private TaskCompletionSource<BluetoothPairingResponse>? _pairingResponse;
    private string _lastStatusFingerprint = "";

    public event Action<BluetoothStatus>? StatusChanged;

    public BluetoothManager()
    {
        _statusTimer = new Timer(_ => EmitStatus(), null, Timeout.Infinite, Timeout.Infinite);
        _discoveryTimer = new Timer(_ => StopDiscovery(), null, Timeout.Infinite, Timeout.Infinite);
        _discoveryProbeTimer = new Timer(_ => _ = ProbeDiscoveryAsync(), null, Timeout.Infinite, Timeout.Infinite);
        _radioProbeTimer = new Timer(_ => _ = ProbeRadioAsync(), null, Timeout.Infinite, Timeout.Infinite);
    }

    public BluetoothStatus GetStatus() => CreateStatus();

    public async Task InitializeAsync()
    {
        lock (_sync)
        {
            if (_initialized || _initializing || _disposed) return;
            _initializing = true;
            _operation = "loading";
            _message = "Carregando Bluetooth...";
            _messageKey = "bluetoothLoading";
            _messageArgs = Array.Empty<string>();
        }
        ScheduleStatus();

        try
        {
            RadioAccessStatus access = await Radio.RequestAccessAsync();
            _accessDenied = access != RadioAccessStatus.Allowed;
            if (!_accessDenied)
            {
                var radios = await Radio.GetRadiosAsync();
                _radio = radios.FirstOrDefault(radio => radio.Kind == RadioKind.Bluetooth);
                if (_radio != null) _radio.StateChanged += OnRadioStateChanged;
                _radioProbeTimer.Change(TimeSpan.FromSeconds(3), TimeSpan.FromSeconds(3));
            }

            StartPairedWatchers();
            lock (_sync)
            {
                _initialized = true;
                _operation = "idle";
                if (_accessDenied) SetMessageUnsafe("bluetoothAccessDenied", "O Windows negou acesso ao Bluetooth.");
                else if (_radio == null) SetMessageUnsafe("bluetoothNoAdapter", "Nenhum adaptador Bluetooth foi encontrado.");
                else if (_radio.State == RadioState.On) SetMessageUnsafe("bluetoothRadioOn", "Bluetooth ligado.");
                else SetMessageUnsafe("bluetoothRadioOff", "Bluetooth desligado.");
            }
        }
        catch (Exception)
        {
            lock (_sync)
            {
                _operation = "error";
                SetMessageUnsafe("bluetoothLoadFailed", "Não foi possível carregar o Bluetooth.");
            }
        }
        finally
        {
            lock (_sync) _initializing = false;
            ScheduleStatus();
        }
    }

    public async Task SetEnabledAsync(bool enabled)
    {
        await InitializeAsync();
        Radio? radio = _radio;
        if (radio == null)
        {
            SetOperation("error", "bluetoothNoAdapter", "Nenhum adaptador Bluetooth foi encontrado.");
            return;
        }

        SetOperation("changing-radio", enabled ? "bluetoothTurningOn" : "bluetoothTurningOff", enabled ? "Ligando Bluetooth..." : "Desligando Bluetooth...");
        try
        {
            RadioAccessStatus result = await radio.SetStateAsync(enabled ? RadioState.On : RadioState.Off);
            if (result != RadioAccessStatus.Allowed)
            {
                _accessDenied = true;
                SetOperation("error", "bluetoothRadioChangeDenied", "O Windows não permitiu alterar o estado do Bluetooth.");
                return;
            }

            if (!enabled) StopDiscovery();
            SetOperation("idle", enabled ? "bluetoothRadioOn" : "bluetoothRadioOff", enabled ? "Bluetooth ligado." : "Bluetooth desligado.");
        }
        catch (Exception)
        {
            SetOperation("error", "bluetoothRadioChangeFailed", "Não foi possível alterar o Bluetooth.");
        }
    }

    public async Task StartDiscoveryAsync()
    {
        await InitializeAsync();
        if (_radio?.State != RadioState.On)
        {
            SetOperation("error", "bluetoothTurnOnBeforeDiscovery", "Ligue o Bluetooth antes de procurar dispositivos.");
            return;
        }

        lock (_sync)
        {
            if (_discovering) return;
            _discovering = true;
            _discoveryEndsAt = DateTimeOffset.UtcNow.Add(DiscoveryDuration);
            _operation = "discovering";
            SetMessageUnsafe("bluetoothSearchingNearby", "Procurando dispositivos próximos...");
        }

        StartDiscoveryWatcher(BluetoothDevice.GetDeviceSelectorFromPairingState(false), "classic");
        StartDiscoveryWatcher(BluetoothLEDevice.GetDeviceSelectorFromPairingState(false), "le");
        _discoveryProbeTimer.Change(TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(3));
        _discoveryTimer.Change(DiscoveryDuration, Timeout.InfiniteTimeSpan);
        ScheduleStatus();
    }

    public void StopDiscovery(bool updateMessage = true)
    {
        List<DeviceWatcher> watchers;
        lock (_sync)
        {
            watchers = _discoveryWatchers.ToList();
            _discoveryWatchers.Clear();
            foreach (string id in _devices
                         .Where(pair => pair.Value.Discovery && !pair.Value.IsKnown)
                         .Select(pair => pair.Key)
                         .ToList())
                _devices.Remove(id);
            _discovering = false;
            _discoveryEndsAt = null;
            if (updateMessage && _operation == "discovering")
            {
                _operation = "idle";
                SetMessageUnsafe("bluetoothSearchEnded", "Busca por dispositivos encerrada.");
            }
        }

        foreach (DeviceWatcher watcher in watchers) StopWatcher(watcher);
        _discoveryProbeTimer.Change(Timeout.Infinite, Timeout.Infinite);
        _discoveryTimer.Change(Timeout.Infinite, Timeout.Infinite);
        ScheduleStatus();
    }

    public async Task PairAsync(string deviceId)
    {
        await InitializeAsync();
        await _operationLock.WaitAsync();
        try
        {
            DeviceInformation? device = FindDevice(deviceId);
            if (device == null)
            {
                SetOperation("error", "bluetoothDeviceUnavailable", "O dispositivo não está mais disponível.");
                return;
            }
            if (device.Pairing.IsPaired)
            {
                SetOperation("idle", "bluetoothAlreadyPaired", "O dispositivo já está pareado.");
                return;
            }

            SetOperation("pairing", "bluetoothPairingDevice", $"Pareando {DisplayName(device)}...", DisplayName(device));
            DeviceInformationCustomPairing custom = device.Pairing.Custom;
            TypedEventHandler<DeviceInformationCustomPairing, DevicePairingRequestedEventArgs> handler =
                async (_, args) => await HandlePairingRequestAsync(device, args);
            custom.PairingRequested += handler;
            DevicePairingResult result;
            try
            {
                DevicePairingKinds kinds = DevicePairingKinds.ConfirmOnly |
                                           DevicePairingKinds.DisplayPin |
                                           DevicePairingKinds.ProvidePin |
                                           DevicePairingKinds.ConfirmPinMatch;
                result = await custom.PairAsync(kinds, DevicePairingProtectionLevel.Default);
            }
            finally
            {
                custom.PairingRequested -= handler;
                ClearPairingPrompt();
            }

            if (result.Status is DevicePairingResultStatus.Paired or DevicePairingResultStatus.AlreadyPaired)
            {
                MarkDevicePaired(device.Id);
                await RefreshPairedDevicesAsync();
                StopDiscovery();
                SetOperation("idle", "bluetoothPairedDevice", $"{DisplayName(device)} foi pareado.", DisplayName(device));
            }
            else
            {
                var failure = PairingFailureMessage(result.Status);
                SetOperation("error", failure.Key, failure.Message);
            }
        }
        catch (Exception)
        {
            ClearPairingPrompt();
            SetOperation("error", "bluetoothPairFailed", "Não foi possível parear o dispositivo.");
        }
        finally
        {
            _operationLock.Release();
            ScheduleStatus();
        }
    }

    public async Task RemoveAsync(string deviceId)
    {
        await InitializeAsync();
        await _operationLock.WaitAsync();
        try
        {
            BluetoothDeviceInfo? target = FindDeviceInfo(deviceId);
            string displayName = target?.Name ?? "";
            List<DeviceInformation> candidates = await FindRemovalCandidatesAsync(deviceId);
            if (target == null && candidates.Count == 0)
            {
                SetOperation("error", "bluetoothDeviceUnavailable", "O dispositivo não está mais disponível.");
                return;
            }

            if (string.IsNullOrWhiteSpace(displayName) && candidates.Count > 0)
                displayName = DisplayName(candidates[0]);

            SetOperation("removing", "bluetoothRemovingDevice", $"Removendo {displayName}...", displayName);
            bool removedFromWindows = false;
            bool hadPairedCandidate = false;
            foreach (DeviceInformation candidate in candidates)
            {
                if (!candidate.Pairing.IsPaired) continue;
                hadPairedCandidate = true;
                try
                {
                    DeviceUnpairingResult result = await candidate.Pairing.UnpairAsync();
                    removedFromWindows |= result.Status == DeviceUnpairingResultStatus.Unpaired;
                }
                catch { }
            }

            if (removedFromWindows || !hadPairedCandidate)
                RemoveEquivalentDevices(deviceId, target);
            await RefreshPairedDevicesAsync();
            bool stillPaired = HasKnownDevice(deviceId, target);
            if ((removedFromWindows || !hadPairedCandidate) && !stillPaired)
            {
                SetOperation("idle", "bluetoothRemovedDevice", $"{displayName} foi removido.", displayName);
            }
            else
            {
                SetOperation("error", "bluetoothRemoveFailed", "O Windows não conseguiu remover o dispositivo.");
            }
        }
        catch (Exception)
        {
            SetOperation("error", "bluetoothRemoveFailed", "Não foi possível remover o dispositivo.");
        }
        finally
        {
            _operationLock.Release();
            ScheduleStatus();
        }
    }

    public void RespondToPairing(bool accepted, string pin)
    {
        TaskCompletionSource<BluetoothPairingResponse>? response;
        lock (_sync) response = _pairingResponse;
        response?.TrySetResult(new BluetoothPairingResponse(accepted, pin ?? ""));
    }

    private async Task HandlePairingRequestAsync(
        DeviceInformation device,
        DevicePairingRequestedEventArgs args)
    {
        Deferral deferral = args.GetDeferral();
        try
        {
            switch (args.PairingKind)
            {
                case DevicePairingKinds.ConfirmOnly:
                    args.Accept();
                    break;
                case DevicePairingKinds.DisplayPin:
                    SetPairingPrompt(new BluetoothPairingPrompt
                    {
                        DeviceId = device.Id,
                        DeviceName = DisplayName(device),
                        Kind = "display-pin",
                        Pin = args.Pin,
                        Message = "Digite este código no dispositivo.",
                        MessageKey = "bluetoothPairingDisplayPin"
                    });
                    args.Accept();
                    break;
                case DevicePairingKinds.ConfirmPinMatch:
                {
                    BluetoothPairingResponse response = await WaitForPairingResponseAsync(new BluetoothPairingPrompt
                    {
                        DeviceId = device.Id,
                        DeviceName = DisplayName(device),
                        Kind = "confirm-pin",
                        Pin = args.Pin,
                        Message = "Confirme se o código exibido é o mesmo nos dois dispositivos.",
                        MessageKey = "bluetoothPairingConfirmPin"
                    });
                    if (response.Accepted) args.Accept();
                    break;
                }
                case DevicePairingKinds.ProvidePin:
                {
                    BluetoothPairingResponse response = await WaitForPairingResponseAsync(new BluetoothPairingPrompt
                    {
                        DeviceId = device.Id,
                        DeviceName = DisplayName(device),
                        Kind = "provide-pin",
                        Message = "Digite o PIN do dispositivo.",
                        MessageKey = "bluetoothPairingProvidePin"
                    });
                    if (response.Accepted && !string.IsNullOrWhiteSpace(response.Pin)) args.Accept(response.Pin);
                    break;
                }
            }
        }
        finally
        {
            deferral.Complete();
        }
    }

    private async Task<BluetoothPairingResponse> WaitForPairingResponseAsync(BluetoothPairingPrompt prompt)
    {
        var source = new TaskCompletionSource<BluetoothPairingResponse>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        lock (_sync)
        {
            _pairingPrompt = prompt;
            _pairingResponse = source;
        }
        ScheduleStatus();
        Task completed = await Task.WhenAny(source.Task, Task.Delay(TimeSpan.FromSeconds(60)));
        if (completed != source.Task)
            source.TrySetResult(new BluetoothPairingResponse(false, ""));
        return await source.Task;
    }

    private void SetPairingPrompt(BluetoothPairingPrompt prompt)
    {
        lock (_sync) _pairingPrompt = prompt;
        ScheduleStatus();
    }

    private void ClearPairingPrompt()
    {
        lock (_sync)
        {
            _pairingPrompt = null;
            _pairingResponse = null;
        }
        ScheduleStatus();
    }

    private void StartPairedWatchers()
    {
        lock (_sync)
        {
            if (_pairedWatchers.Count > 0 || _disposed) return;
        }
        StartPairedWatcher(BluetoothDevice.GetDeviceSelectorFromPairingState(true), "classic");
        StartPairedWatcher(BluetoothLEDevice.GetDeviceSelectorFromPairingState(true), "le");
        _ = RefreshPairedDevicesAsync();
    }

    private void RestartPairedWatchers()
    {
        StopPairedWatchers();
        StartPairedWatchers();
    }

    private void StopPairedWatchers()
    {
        List<DeviceWatcher> watchers;
        lock (_sync)
        {
            watchers = _pairedWatchers.ToList();
            _pairedWatchers.Clear();
        }
        foreach (DeviceWatcher watcher in watchers) StopWatcher(watcher);
    }

    private async Task RefreshPairedDevicesAsync()
    {
        if (_disposed) return;
        try
        {
            await RefreshPairedDevicesAsync(BluetoothDevice.GetDeviceSelectorFromPairingState(true), "classic");
            await RefreshPairedDevicesAsync(BluetoothLEDevice.GetDeviceSelectorFromPairingState(true), "le");
        }
        catch
        {
            // Device watchers will keep reconciling paired devices if this eager refresh fails.
        }
        ScheduleStatus();
    }

    private static async Task<DeviceInformationCollection> FindDevicesAsync(string selector)
        => await DeviceInformation.FindAllAsync(
            selector,
            RequestedProperties,
            DeviceInformationKind.AssociationEndpoint);

    private async Task RefreshPairedDevicesAsync(string selector, string technology)
    {
        DeviceInformationCollection devices = await FindDevicesAsync(selector);
        lock (_sync)
        {
            foreach (DeviceInformation device in devices)
                TrackDeviceUnsafe(device, technology, discovery: false, pairedOverride: true);
        }
    }

    private async Task ProbeDiscoveryAsync()
    {
        if (_disposed || Interlocked.Exchange(ref _discoveryProbeRunning, 1) != 0) return;
        try
        {
            lock (_sync)
            {
                if (!_discovering) return;
            }

            await ProbeDiscoveryAsync(BluetoothDevice.GetDeviceSelectorFromPairingState(false), "classic");
            await ProbeDiscoveryAsync(BluetoothLEDevice.GetDeviceSelectorFromPairingState(false), "le");
            ScheduleStatus();
        }
        catch
        {
            // Watchers remain the primary source; polling is only a discovery assist.
        }
        finally
        {
            Interlocked.Exchange(ref _discoveryProbeRunning, 0);
        }
    }

    private async Task ProbeDiscoveryAsync(string selector, string technology)
    {
        DeviceInformationCollection devices = await FindDevicesAsync(selector);
        lock (_sync)
        {
            if (!_discovering) return;
            foreach (DeviceInformation device in devices)
                TrackDeviceUnsafe(device, technology, discovery: true, pairedOverride: false);
        }
    }

    private void StartPairedWatcher(string selector, string technology)
    {
        DeviceWatcher watcher = CreateWatcher(selector, technology, discovery: false);
        lock (_sync) _pairedWatchers.Add(watcher);
        watcher.Start();
    }

    private void StartDiscoveryWatcher(string selector, string technology)
    {
        DeviceWatcher watcher = CreateWatcher(selector, technology, discovery: true);
        lock (_sync) _discoveryWatchers.Add(watcher);
        watcher.Start();
    }

    private DeviceWatcher CreateWatcher(string selector, string technology, bool discovery)
    {
        DeviceWatcher watcher = DeviceInformation.CreateWatcher(
            selector,
            RequestedProperties,
            DeviceInformationKind.AssociationEndpoint);
        watcher.Added += (_, device) => TrackDevice(device, technology, discovery);
        watcher.Updated += (_, update) => UpdateDevice(update);
        watcher.Removed += (_, update) => RemoveDevice(update.Id, discovery);
        watcher.EnumerationCompleted += (_, _) => ScheduleStatus();
        watcher.Stopped += (_, _) => ScheduleStatus();
        return watcher;
    }

    private void TrackDevice(DeviceInformation device, string technology, bool discovery)
    {
        lock (_sync)
        {
            TrackDeviceUnsafe(device, technology, discovery, pairedOverride: device.Pairing.IsPaired);
        }
        ScheduleStatus();
    }

    private void TrackDeviceUnsafe(DeviceInformation device, string technology, bool discovery, bool pairedOverride = false)
    {
        if (_devices.TryGetValue(device.Id, out TrackedDevice? existing))
        {
            existing.Information = device;
            existing.Technology = string.IsNullOrWhiteSpace(existing.Technology) ? technology : existing.Technology;
            existing.Discovery = discovery && !existing.IsKnown;
            existing.PairedOverride = existing.PairedOverride || pairedOverride || device.Pairing.IsPaired;
            return;
        }

        _devices[device.Id] = new TrackedDevice
        {
            Information = device,
            Technology = technology,
            Discovery = discovery && !pairedOverride && !device.Pairing.IsPaired,
            PairedOverride = pairedOverride || device.Pairing.IsPaired
        };
    }

    private void UpdateDevice(DeviceInformationUpdate update)
    {
        lock (_sync)
        {
            if (_devices.TryGetValue(update.Id, out TrackedDevice? tracked))
                tracked.Information.Update(update);
        }
        ScheduleStatus();
    }

    private void RemoveDevice(string id, bool discovery)
    {
        lock (_sync)
        {
            if (!_devices.TryGetValue(id, out TrackedDevice? tracked)) return;
            if (discovery)
            {
                if (!tracked.Discovery || tracked.IsKnown) return;
            }
            _devices.Remove(id);
        }
        ScheduleStatus();
    }

    private void RemoveEquivalentDevices(string id, BluetoothDeviceInfo? target)
    {
        lock (_sync)
        {
            foreach (string key in _devices
                         .Where(pair => IsSameBluetoothDevice(id, target, pair.Key, MapDevice(pair.Value)))
                         .Select(pair => pair.Key)
                         .ToList())
                _devices.Remove(key);
        }
        ScheduleStatus();
    }

    private void MarkDevicePaired(string id)
    {
        lock (_sync)
        {
            if (!_devices.TryGetValue(id, out TrackedDevice? tracked)) return;
            tracked.PairedOverride = true;
            tracked.Discovery = false;
        }
        ScheduleStatus();
    }

    private void OnRadioStateChanged(Radio sender, object args)
    {
        if (sender.State != RadioState.On) StopDiscovery();
        lock (_sync)
        {
            if (sender.State == RadioState.On) SetMessageUnsafe("bluetoothRadioOn", "Bluetooth ligado.");
            else SetMessageUnsafe("bluetoothRadioOff", "Bluetooth desligado.");
        }
        ScheduleStatus();
    }

    private async Task ProbeRadioAsync()
    {
        if (_disposed || _accessDenied || Interlocked.Exchange(ref _radioProbeRunning, 1) != 0) return;
        try
        {
            var radios = await Radio.GetRadiosAsync();
            Radio? detected = radios.FirstOrDefault(radio => radio.Kind == RadioKind.Bluetooth);
            bool changed = false;
            bool adapterAdded = false;
            bool adapterRemoved = false;

            lock (_sync)
            {
                if (_radio == null && detected != null)
                {
                    _radio = detected;
                    _radio.StateChanged += OnRadioStateChanged;
                    SetMessageUnsafe(
                        _radio.State == RadioState.On ? "bluetoothRadioOn" : "bluetoothRadioOff",
                        _radio.State == RadioState.On ? "Bluetooth ligado." : "Bluetooth desligado.");
                    adapterAdded = true;
                    changed = true;
                }
                else if (_radio != null && detected == null)
                {
                    _radio.StateChanged -= OnRadioStateChanged;
                    _radio = null;
                    SetMessageUnsafe("bluetoothNoAdapter", "Nenhum adaptador Bluetooth foi encontrado.");
                    adapterRemoved = true;
                    changed = true;
                }
            }

            if (adapterRemoved)
            {
                StopDiscovery(updateMessage: false);
                StopPairedWatchers();
            }
            if (adapterAdded)
                RestartPairedWatchers();
            if (changed) ScheduleStatus();
        }
        catch
        {
            // A probe is best-effort; watcher state remains authoritative between attempts.
        }
        finally
        {
            Interlocked.Exchange(ref _radioProbeRunning, 0);
        }
    }

    private DeviceInformation? FindDevice(string id)
    {
        lock (_sync)
            return _devices.TryGetValue(id ?? "", out TrackedDevice? tracked)
                ? tracked.Information
                : null;
    }

    private BluetoothDeviceInfo? FindDeviceInfo(string id)
    {
        lock (_sync)
            return _devices.TryGetValue(id ?? "", out TrackedDevice? tracked)
                ? MapDevice(tracked)
                : null;
    }

    private bool HasKnownDevice(string id, BluetoothDeviceInfo? target)
    {
        lock (_sync)
        {
            return _devices.Any(pair =>
            {
                BluetoothDeviceInfo device = MapDevice(pair.Value);
                if (!device.Paired) return false;
                return IsSameBluetoothDevice(id, target, pair.Key, device);
            });
        }
    }

    private async Task<List<DeviceInformation>> FindRemovalCandidatesAsync(string id)
    {
        BluetoothDeviceInfo? target = FindDeviceInfo(id);
        var candidates = new List<DeviceInformation>();
        DeviceInformation? local = FindDevice(id);
        if (local != null) candidates.Add(local);

        var paired = new List<DeviceInformation>();
        try { paired.AddRange(await FindDevicesAsync(BluetoothDevice.GetDeviceSelectorFromPairingState(true))); } catch { }
        try { paired.AddRange(await FindDevicesAsync(BluetoothLEDevice.GetDeviceSelectorFromPairingState(true))); } catch { }

        foreach (DeviceInformation device in paired)
        {
            BluetoothDeviceInfo mapped = MapDevice(new TrackedDevice
            {
                Information = device,
                Technology = "",
                PairedOverride = device.Pairing.IsPaired
            });
            if (IsSameBluetoothDevice(id, target, device.Id, mapped))
                candidates.Add(device);
        }

        return candidates
            .GroupBy(device => device.Id, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToList();
    }

    private static bool IsSameBluetoothDevice(
        string requestedId,
        BluetoothDeviceInfo? target,
        string candidateId,
        BluetoothDeviceInfo candidate)
    {
        if (string.Equals(candidateId, requestedId, StringComparison.OrdinalIgnoreCase)) return true;
        if (target == null) return false;
        if (!string.IsNullOrWhiteSpace(target.ContainerId) &&
            string.Equals(target.ContainerId, candidate.ContainerId, StringComparison.OrdinalIgnoreCase))
            return true;
        if (!string.IsNullOrWhiteSpace(target.Address) &&
            string.Equals(target.Address, candidate.Address, StringComparison.OrdinalIgnoreCase))
            return true;
        return !string.IsNullOrWhiteSpace(target.Name) &&
               string.Equals(target.Name, candidate.Name, StringComparison.CurrentCultureIgnoreCase) &&
               (string.Equals(target.Category, candidate.Category, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(target.Technology, candidate.Technology, StringComparison.OrdinalIgnoreCase));
    }

    private BluetoothStatus CreateStatus()
    {
        lock (_sync)
        {
            var devices = _devices.Values
                .Select(MapDevice)
                .Where(device => !string.IsNullOrWhiteSpace(device.Name))
                .GroupBy(device => DeviceGroupKey(device), StringComparer.OrdinalIgnoreCase)
                .Select(group => group
                    .OrderByDescending(device => device.Paired)
                    .ThenByDescending(device => device.Connected)
                    .First())
                .OrderByDescending(device => device.Paired)
                .ThenByDescending(device => device.Connected)
                .ThenBy(device => device.Name, StringComparer.CurrentCultureIgnoreCase)
                .ToList();

            return new BluetoothStatus
            {
                Available = _radio != null,
                Enabled = _radio?.State == RadioState.On,
                AccessDenied = _accessDenied,
                Discovering = _discovering,
                DiscoveryEndsAt = _discoveryEndsAt,
                Operation = _operation,
                Message = _message,
                MessageKey = _messageKey,
                MessageArgs = _messageArgs.ToArray(),
                Devices = devices,
                PairingPrompt = _pairingPrompt == null ? null : _pairingPrompt with { }
            };
        }
    }

    private static BluetoothDeviceInfo MapDevice(TrackedDevice tracked)
    {
        DeviceInformation info = tracked.Information;
        return new BluetoothDeviceInfo
        {
            Id = info.Id,
            Name = DisplayName(info, allowFallback: tracked.IsKnown),
            Technology = tracked.Technology,
            Paired = tracked.IsKnown,
            Connected = ReadBool(info, "System.Devices.Aep.IsConnected"),
            CanPair = info.Pairing.CanPair,
            Address = ReadString(info, "System.Devices.Aep.DeviceAddress"),
            ContainerId = ReadString(info, "System.Devices.Aep.ContainerId"),
            Category = ClassifyDevice(info)
        };
    }

    private static string DeviceGroupKey(BluetoothDeviceInfo device)
    {
        if (!string.IsNullOrWhiteSpace(device.ContainerId)) return "container:" + device.ContainerId;
        if (!string.IsNullOrWhiteSpace(device.Address)) return "address:" + device.Address;
        return "id:" + device.Id;
    }

    private static string ClassifyDevice(DeviceInformation info)
    {
        string category = ReadString(info, "System.Devices.Aep.Category").ToLowerInvariant();
        string name = DisplayName(info).ToLowerInvariant();
        string source = category + " " + name;
        if (source.Contains("game") || source.Contains("controller") || source.Contains("xbox") || source.Contains("dualsense") || source.Contains("dualshock")) return "controller";
        if (source.Contains("head") || source.Contains("audio") || source.Contains("speaker") || source.Contains("fone")) return "audio";
        if (source.Contains("keyboard") || source.Contains("teclado")) return "keyboard";
        if (source.Contains("mouse")) return "mouse";
        if (source.Contains("phone") || source.Contains("telefone")) return "phone";
        return "device";
    }

    private static string DisplayName(DeviceInformation info, bool allowFallback = true)
    {
        if (!string.IsNullOrWhiteSpace(info.Name)) return info.Name.Trim();
        string friendly = ReadString(info, "System.Devices.FriendlyName");
        if (!string.IsNullOrWhiteSpace(friendly)) return friendly.Trim();
        string itemName = ReadString(info, "System.ItemNameDisplay");
        if (!string.IsNullOrWhiteSpace(itemName)) return itemName.Trim();
        return allowFallback ? "Dispositivo Bluetooth" : "";
    }

    private static bool ReadBool(DeviceInformation info, string key)
    {
        try
        {
            return info.Properties.TryGetValue(key, out object? value) && Convert.ToBoolean(value);
        }
        catch { return false; }
    }

    private static string ReadString(DeviceInformation info, string key)
    {
        try
        {
            if (!info.Properties.TryGetValue(key, out object? value) || value == null) return "";
            if (value is string[] values) return string.Join(",", values);
            return Convert.ToString(value) ?? "";
        }
        catch { return ""; }
    }

    private static (string Key, string Message) PairingFailureMessage(DevicePairingResultStatus status) => status switch
    {
        DevicePairingResultStatus.NotReadyToPair => ("bluetoothNotReadyToPair", "O dispositivo não está pronto para parear."),
        DevicePairingResultStatus.NotPaired => ("bluetoothPairingCancelled", "O pareamento foi cancelado."),
        DevicePairingResultStatus.AuthenticationFailure => ("bluetoothAuthenticationFailed", "O PIN ou a confirmação do pareamento falhou."),
        DevicePairingResultStatus.AuthenticationTimeout => ("bluetoothAuthenticationTimeout", "O dispositivo demorou demais para responder."),
        DevicePairingResultStatus.ConnectionRejected => ("bluetoothConnectionRejected", "O dispositivo recusou a conexão."),
        DevicePairingResultStatus.AccessDenied => ("bluetoothPairingAccessDenied", "O Windows negou acesso ao pareamento."),
        _ => ("bluetoothPairFailed", "O Windows não conseguiu parear o dispositivo.")
    };

    private void SetMessageUnsafe(string key, string message, params string[] args)
    {
        _messageKey = key;
        _message = message;
        _messageArgs = args ?? Array.Empty<string>();
    }

    private void SetOperation(string operation, string key, string message, params string[] args)
    {
        lock (_sync)
        {
            _operation = operation;
            SetMessageUnsafe(key, message, args);
        }
        ScheduleStatus();
    }

    private void ScheduleStatus()
    {
        if (_disposed) return;
        _statusTimer.Change(80, Timeout.Infinite);
    }

    private void EmitStatus()
    {
        if (_disposed) return;
        try
        {
            BluetoothStatus next = CreateStatus();
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

    private static void StopWatcher(DeviceWatcher watcher)
    {
        try
        {
            if (watcher.Status is DeviceWatcherStatus.Started or DeviceWatcherStatus.EnumerationCompleted)
                watcher.Stop();
        }
        catch { }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        RespondToPairing(false, "");
        StopDiscovery();
        StopPairedWatchers();
        if (_radio != null) _radio.StateChanged -= OnRadioStateChanged;
        _statusTimer.Dispose();
        _discoveryTimer.Dispose();
        _discoveryProbeTimer.Dispose();
        _radioProbeTimer.Dispose();
        _operationLock.Dispose();
    }

    private sealed class TrackedDevice
    {
        public required DeviceInformation Information { get; set; }
        public string Technology { get; set; } = "";
        public bool Discovery { get; set; }
        public bool PairedOverride { get; set; }
        public bool IsKnown => PairedOverride || Information.Pairing.IsPaired;
    }
    private sealed record BluetoothPairingResponse(bool Accepted, string Pin);
}

internal sealed class BluetoothStatus
{
    public bool Available { get; set; }
    public bool Enabled { get; set; }
    public bool AccessDenied { get; set; }
    public bool Discovering { get; set; }
    public DateTimeOffset? DiscoveryEndsAt { get; set; }
    public string Operation { get; set; } = "idle";
    public string Message { get; set; } = "";
    public string MessageKey { get; set; } = "";
    public string[] MessageArgs { get; set; } = Array.Empty<string>();
    public List<BluetoothDeviceInfo> Devices { get; set; } = new();
    public BluetoothPairingPrompt? PairingPrompt { get; set; }
}

internal sealed class BluetoothDeviceInfo
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Technology { get; set; } = "";
    public string Category { get; set; } = "device";
    public string Address { get; set; } = "";
    public string ContainerId { get; set; } = "";
    public bool Paired { get; set; }
    public bool Connected { get; set; }
    public bool CanPair { get; set; }
}

internal sealed record BluetoothPairingPrompt
{
    public string DeviceId { get; init; } = "";
    public string DeviceName { get; init; } = "";
    public string Kind { get; init; } = "";
    public string Pin { get; init; } = "";
    public string Message { get; init; } = "";
    public string MessageKey { get; init; } = "";
}
