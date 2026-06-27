using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

namespace Doorpi;

public sealed class SoundDeviceInfo
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public bool IsDefault { get; set; }
    public int? Volume { get; set; }
    public bool Muted { get; set; }
    public bool HasVolume { get; set; }
}

public sealed class SoundStatus
{
    public bool Available { get; set; }
    public string Operation { get; set; } = "idle";
    public string Message { get; set; } = "";
    public string MessageKey { get; set; } = "";
    public string DefaultDeviceId { get; set; } = "";
    public int? MasterVolume { get; set; }
    public bool Muted { get; set; }
    public List<SoundDeviceInfo> Devices { get; set; } = [];
}

public sealed class SoundManager : IDisposable
{
    public event Action<SoundStatus>? StatusChanged;

    public SoundStatus GetStatus() => CreateStatus("idle", "soundReady", "Dispositivos de som detectados.");

    public void SetDefaultDevice(string deviceId)
    {
        if (string.IsNullOrWhiteSpace(deviceId)) return;

        try
        {
            SetDefaultEndpoint(deviceId);
            SoundStatus status = WaitForDeviceSelection(deviceId);
            bool applied = IsSelectionApplied(status, deviceId);
            status.Operation = applied ? "idle" : "error";
            status.MessageKey = applied ? "soundDefaultChanged" : "soundSetDefaultFailed";
            status.Message = applied ? "Dispositivo padrão alterado." : "Não foi possível alterar o dispositivo de som.";
            Publish(status);
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Sound] Falha ao alterar dispositivo padrao: " + ex.Message);
            Publish(CreateStatus("error", "soundSetDefaultFailed", "Não foi possível alterar o dispositivo de som."));
        }
    }

    public void SetMasterVolume(int volume)
    {
        volume = Math.Clamp(volume, 0, 100);
        IMMDeviceEnumerator? enumerator = null;
        IMMDevice? device = null;
        IAudioEndpointVolume? endpoint = null;
        try
        {
            enumerator = CreateEnumerator();
            HResult(enumerator.GetDefaultAudioEndpoint(EDataFlow.Render, ERole.Console, out device));
            endpoint = ActivateEndpointVolume(device);
            Guid context = Guid.Empty;
            HResult(endpoint.SetMasterVolumeLevelScalar(volume / 100f, ref context));
            if (volume > 0) HResult(endpoint.SetMute(false, ref context));
            Publish(CreateStatus("idle", "soundVolumeChanged", "Volume alterado."));
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Sound] Falha ao alterar volume: " + ex.Message);
            Publish(CreateStatus("error", "soundVolumeFailed", "Não foi possível alterar o volume."));
        }
        finally
        {
            Release(endpoint);
            Release(device);
            Release(enumerator);
        }
    }

    public void Dispose()
    {
    }

    private void Publish(SoundStatus status) => StatusChanged?.Invoke(status);

    private static SoundStatus WaitForDeviceSelection(string deviceId)
    {
        SoundStatus status = CreateStatus("idle", "soundReady", "Dispositivos de som detectados.");
        for (int i = 0; i < 6 && !IsSelectionApplied(status, deviceId); i++)
        {
            Thread.Sleep(250);
            status = CreateStatus("idle", "soundReady", "Dispositivos de som detectados.");
        }

        return status;
    }

    private static bool IsSelectionApplied(SoundStatus status, string deviceId)
    {
        if (string.IsNullOrWhiteSpace(deviceId)) return false;
        if (string.Equals(status.DefaultDeviceId, deviceId, StringComparison.OrdinalIgnoreCase)) return true;
        return status.Devices.Exists(device =>
            device.IsDefault &&
            string.Equals(device.Id, deviceId, StringComparison.OrdinalIgnoreCase));
    }

    private static void SetDefaultEndpoint(string deviceId)
    {
        Exception? firstFailure = null;

        try
        {
            SetDefaultEndpointWithPolicyConfig(deviceId);
            return;
        }
        catch (Exception ex)
        {
            firstFailure = ex;
            Debug.WriteLine("[Sound] PolicyConfig falhou: " + ex.Message);
        }

        try
        {
            SetDefaultEndpointWithPolicyConfigVista(deviceId);
            return;
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Sound] PolicyConfigVista falhou: " + ex.Message);
            throw firstFailure ?? ex;
        }
    }

    private static void SetDefaultEndpointWithPolicyConfig(string deviceId)
    {
        object? policyObject = null;
        try
        {
            policyObject = Activator.CreateInstance(Type.GetTypeFromCLSID(PolicyConfigClientClsid, throwOnError: true)!)
                ?? throw new InvalidOperationException("PolicyConfig COM object was not created.");
            var policy = (IPolicyConfig)policyObject;
            SetDefaultRoles(
                role => policy.SetDefaultEndpoint(deviceId, role),
                "PolicyConfig");
        }
        finally
        {
            Release(policyObject);
        }
    }

    private static void SetDefaultEndpointWithPolicyConfigVista(string deviceId)
    {
        object? policyObject = null;
        try
        {
            policyObject = Activator.CreateInstance(Type.GetTypeFromCLSID(PolicyConfigVistaClientClsid, throwOnError: true)!)
                ?? throw new InvalidOperationException("PolicyConfigVista COM object was not created.");
            var policy = (IPolicyConfigVista)policyObject;
            SetDefaultRoles(
                role => policy.SetDefaultEndpoint(deviceId, role),
                "PolicyConfigVista");
        }
        finally
        {
            Release(policyObject);
        }
    }

    private static void SetDefaultRoles(Func<ERole, int> setter, string source)
    {
        int consoleHr = setter(ERole.Console);
        int multimediaHr = setter(ERole.Multimedia);
        int communicationsHr = setter(ERole.Communications);

        if (consoleHr >= 0 || multimediaHr >= 0)
        {
            if (communicationsHr < 0)
                Debug.WriteLine($"[Sound] {source} nao alterou communications: 0x{communicationsHr:X8}");
            return;
        }

        Debug.WriteLine($"[Sound] {source} falhou console=0x{consoleHr:X8}, multimedia=0x{multimediaHr:X8}, communications=0x{communicationsHr:X8}");
        HResult(consoleHr);
        HResult(multimediaHr);
    }

    private static SoundStatus CreateStatus(string operation, string messageKey, string message)
    {
        var status = new SoundStatus
        {
            Operation = operation,
            MessageKey = messageKey,
            Message = message
        };

        string defaultId = "";

        try
        {
            FillCoreAudioDetails(status, ref defaultId);

            status.Available = status.Devices.Count > 0;
            status.DefaultDeviceId = defaultId;
            SoundDeviceInfo? selected = status.Devices.Find(device => device.IsDefault);
            selected ??= status.Devices.Count > 0 ? status.Devices[0] : null;
            if (selected != null)
            {
                status.MasterVolume ??= selected.Volume;
                if (!status.Muted) status.Muted = selected.Muted;
            }

            if (!status.Available)
            {
                status.MessageKey = "soundNoOutputDevice";
                status.Message = "Nenhuma saída de áudio encontrada.";
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Sound] Falha ao consultar dispositivos: " + ex.Message);
            status.Available = false;
            status.Operation = "error";
            status.MessageKey = "soundQueryFailed";
            status.Message = "Não foi possível consultar o som do Windows: " + ex.GetType().Name;
        }

        return status;
    }

    private static void FillCoreAudioDetails(SoundStatus status, ref string defaultId)
    {
        IMMDeviceEnumerator? enumerator = null;
        IMMDevice? defaultDevice = null;
        IntPtr collectionPtr = IntPtr.Zero;
        try
        {
            enumerator = CreateEnumerator();
            try
            {
                HResult(enumerator.GetDefaultAudioEndpoint(EDataFlow.Render, ERole.Console, out defaultDevice));
                HResult(defaultDevice.GetId(out defaultId));
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Sound] CoreAudio nao retornou device padrao: " + ex.Message);
            }

            HResult(enumerator.EnumAudioEndpoints(EDataFlow.Render, DeviceState.Active, out collectionPtr));
            if (collectionPtr == IntPtr.Zero) throw new InvalidOperationException("Audio endpoint collection pointer was null.");
            HResult(CollectionGetCount(collectionPtr, out int count));
            var coreDevices = new List<SoundDeviceInfo>();

            for (int i = 0; i < count; i++)
            {
                IMMDevice? device = null;
                IntPtr devicePtr = IntPtr.Zero;
                try
                {
                    HResult(CollectionItem(collectionPtr, i, out devicePtr));
                    if (devicePtr == IntPtr.Zero) continue;
                    device = (IMMDevice)Marshal.GetObjectForIUnknown(devicePtr);
                    HResult(device.GetId(out string id));
                    var info = new SoundDeviceInfo
                    {
                        Id = id,
                        Name = GetFriendlyName(device),
                        IsDefault = string.Equals(id, defaultId, StringComparison.OrdinalIgnoreCase)
                    };
                    info.IsDefault = info.IsDefault || string.Equals(info.Id, defaultId, StringComparison.OrdinalIgnoreCase);
                    FillDeviceVolume(device, info);
                    coreDevices.Add(info);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[Sound] Falha ao ler endpoint CoreAudio: " + ex.Message);
                }
                finally
                {
                    if (devicePtr != IntPtr.Zero) Marshal.Release(devicePtr);
                    Release(device);
                }
            }

            if (coreDevices.Count > 0)
            {
                foreach (SoundDeviceInfo winRtOnly in status.Devices)
                {
                    bool exists = coreDevices.Exists(core =>
                        string.Equals(core.Id, winRtOnly.Id, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(core.Name, winRtOnly.Name, StringComparison.OrdinalIgnoreCase));
                    if (!exists) coreDevices.Add(winRtOnly);
                }

                status.Devices = coreDevices
                    .OrderByDescending(device => device.IsDefault)
                    .ThenBy(device => device.Name, StringComparer.CurrentCultureIgnoreCase)
                    .ToList();
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Sound] Fallback CoreAudio indisponivel: " + ex.Message);
        }
        finally
        {
            Release(defaultDevice);
            if (collectionPtr != IntPtr.Zero) Marshal.Release(collectionPtr);
            Release(enumerator);
        }
    }

    private static IMMDeviceEnumerator CreateEnumerator()
        => (IMMDeviceEnumerator)Activator.CreateInstance(Type.GetTypeFromCLSID(MMDeviceEnumeratorClsid, throwOnError: true)!)!;

    private static string GetFriendlyName(IMMDevice device)
    {
        IPropertyStore? store = null;
        try
        {
            HResult(device.OpenPropertyStore(StgmRead, out store));
            PROPERTYKEY key = PropertyKeys.PKEY_Device_FriendlyName;
            HResult(store.GetValue(ref key, out PROPVARIANT value));
            try
            {
                if (value.vt == (ushort)VarEnum.VT_LPWSTR && value.p != IntPtr.Zero)
                    return Marshal.PtrToStringUni(value.p) ?? "Dispositivo de som";
            }
            finally
            {
                PropVariantClear(ref value);
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Sound] Falha ao ler nome do dispositivo: " + ex.Message);
        }
        finally
        {
            Release(store);
        }
        return "Dispositivo de som";
    }

    private static void FillDeviceVolume(IMMDevice device, SoundDeviceInfo info)
    {
        IAudioEndpointVolume? endpoint = null;
        try
        {
            endpoint = ActivateEndpointVolume(device);
            HResult(endpoint.GetMasterVolumeLevelScalar(out float scalar));
            info.Volume = Math.Clamp((int)Math.Round(scalar * 100), 0, 100);
            info.HasVolume = true;
            try
            {
                HResult(endpoint.GetMute(out bool muted));
                info.Muted = muted;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Sound] Falha ao ler mute: " + ex.Message);
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[Sound] Falha ao ler volume: " + ex.Message);
        }
        finally
        {
            Release(endpoint);
        }
    }

    private static IAudioEndpointVolume ActivateEndpointVolume(IMMDevice device)
    {
        IntPtr endpointPtr = IntPtr.Zero;
        Guid endpointVolumeGuid = typeof(IAudioEndpointVolume).GUID;
        HResult(device.Activate(ref endpointVolumeGuid, ClsctxAll, IntPtr.Zero, out endpointPtr));
        if (endpointPtr == IntPtr.Zero) throw new InvalidOperationException("Audio endpoint volume pointer was null.");
        try
        {
            return (IAudioEndpointVolume)Marshal.GetObjectForIUnknown(endpointPtr);
        }
        finally
        {
            Marshal.Release(endpointPtr);
        }
    }

    private static int CollectionGetCount(IntPtr collectionPtr, out int count)
    {
        IntPtr methodPtr = GetComMethod(collectionPtr, 3);
        var method = Marshal.GetDelegateForFunctionPointer<CollectionGetCountDelegate>(methodPtr);
        return method(collectionPtr, out count);
    }

    private static int CollectionItem(IntPtr collectionPtr, int index, out IntPtr devicePtr)
    {
        IntPtr methodPtr = GetComMethod(collectionPtr, 4);
        var method = Marshal.GetDelegateForFunctionPointer<CollectionItemDelegate>(methodPtr);
        return method(collectionPtr, index, out devicePtr);
    }

    private static IntPtr GetComMethod(IntPtr comObject, int slot)
    {
        IntPtr vtable = Marshal.ReadIntPtr(comObject);
        return Marshal.ReadIntPtr(vtable, slot * IntPtr.Size);
    }

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int CollectionGetCountDelegate(IntPtr self, out int count);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    private delegate int CollectionItemDelegate(IntPtr self, int index, out IntPtr device);

    private static void HResult(int hr)
    {
        if (hr < 0) Marshal.ThrowExceptionForHR(hr);
    }

    private static void Release(object? comObject)
    {
        if (comObject == null) return;
        try
        {
            if (Marshal.IsComObject(comObject)) Marshal.ReleaseComObject(comObject);
        }
        catch { }
    }

    private const int ClsctxAll = 23;
    private const int StgmRead = 0;
    private static readonly Guid MMDeviceEnumeratorClsid = new("BCDE0395-E52F-467C-8E3D-C4579291692E");
    private static readonly Guid PolicyConfigClientClsid = new("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9");
    private static readonly Guid PolicyConfigVistaClientClsid = new("294935CE-F637-4E7C-A41B-AB255460B862");

    [DllImport("ole32.dll")]
    private static extern int PropVariantClear(ref PROPVARIANT pvar);
}

internal enum EDataFlow
{
    Render = 0,
    Capture = 1,
    All = 2
}

internal enum ERole
{
    Console = 0,
    Multimedia = 1,
    Communications = 2
}

[Flags]
internal enum DeviceState
{
    Active = 0x00000001
}

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceEnumerator
{
    [PreserveSig]
    int EnumAudioEndpoints(EDataFlow dataFlow, DeviceState dwStateMask, out IntPtr ppDevices);
    [PreserveSig]
    int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppEndpoint);
    [PreserveSig]
    int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string pwstrId, out IMMDevice ppDevice);
    [PreserveSig]
    int RegisterEndpointNotificationCallback(IntPtr pClient);
    [PreserveSig]
    int UnregisterEndpointNotificationCallback(IntPtr pClient);
}

[ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-C0FBAECED5E9"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceCollection
{
    [PreserveSig]
    int GetCount(out int pcDevices);
    [PreserveSig]
    int Item(int nDevice, out IMMDevice ppDevice);
}

[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDevice
{
    [PreserveSig]
    int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, out IntPtr ppInterface);
    [PreserveSig]
    int OpenPropertyStore(int stgmAccess, out IPropertyStore ppProperties);
    [PreserveSig]
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
    [PreserveSig]
    int GetState(out DeviceState pdwState);
}

[ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IPropertyStore
{
    [PreserveSig]
    int GetCount(out int cProps);
    [PreserveSig]
    int GetAt(int iProp, out PROPERTYKEY pkey);
    [PreserveSig]
    int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
    [PreserveSig]
    int SetValue(ref PROPERTYKEY key, ref PROPVARIANT propvar);
    [PreserveSig]
    int Commit();
}

[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioEndpointVolume
{
    [PreserveSig]
    int RegisterControlChangeNotify(IntPtr pNotify);
    [PreserveSig]
    int UnregisterControlChangeNotify(IntPtr pNotify);
    [PreserveSig]
    int GetChannelCount(out uint pnChannelCount);
    [PreserveSig]
    int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
    [PreserveSig]
    int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
    [PreserveSig]
    int GetMasterVolumeLevel(out float pfLevelDB);
    [PreserveSig]
    int GetMasterVolumeLevelScalar(out float pfLevel);
    [PreserveSig]
    int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
    [PreserveSig]
    int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
    [PreserveSig]
    int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
    [PreserveSig]
    int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
    [PreserveSig]
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
    [PreserveSig]
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    [PreserveSig]
    int GetVolumeStepInfo(out uint pnStep, out uint pnStepCount);
    [PreserveSig]
    int VolumeStepUp(ref Guid pguidEventContext);
    [PreserveSig]
    int VolumeStepDown(ref Guid pguidEventContext);
    [PreserveSig]
    int QueryHardwareSupport(out uint pdwHardwareSupportMask);
    [PreserveSig]
    int GetVolumeRange(out float pflVolumeMindB, out float pflVolumeMaxdB, out float pflVolumeIncrementdB);
}

[ComImport, Guid("F8679F50-850A-41CF-9C72-430F290290C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IPolicyConfig
{
    [PreserveSig]
    int GetMixFormat([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr ppFormat);
    [PreserveSig]
    int GetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, [MarshalAs(UnmanagedType.Bool)] bool bDefault, IntPtr ppFormat);
    [PreserveSig]
    int ResetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName);
    [PreserveSig]
    int SetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr pEndpointFormat, IntPtr mixFormat);
    [PreserveSig]
    int GetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, [MarshalAs(UnmanagedType.Bool)] bool bDefault, IntPtr pmftDefaultPeriod, IntPtr pmftMinimumPeriod);
    [PreserveSig]
    int SetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr pmftPeriod);
    [PreserveSig]
    int GetShareMode([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr pMode);
    [PreserveSig]
    int SetShareMode([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr mode);
    [PreserveSig]
    int GetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, ref PROPERTYKEY key, out PROPVARIANT pv);
    [PreserveSig]
    int SetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, ref PROPERTYKEY key, ref PROPVARIANT pv);
    [PreserveSig]
    int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, ERole role);
    [PreserveSig]
    int SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, [MarshalAs(UnmanagedType.Bool)] bool bVisible);
}

[ComImport, Guid("568B9108-44BF-40B4-9006-86AFE5B5A620"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IPolicyConfigVista
{
    [PreserveSig]
    int GetMixFormat([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr ppFormat);
    [PreserveSig]
    int GetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, [MarshalAs(UnmanagedType.Bool)] bool bDefault, IntPtr ppFormat);
    [PreserveSig]
    int SetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr pEndpointFormat, IntPtr mixFormat);
    [PreserveSig]
    int GetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, [MarshalAs(UnmanagedType.Bool)] bool bDefault, IntPtr pmftDefaultPeriod, IntPtr pmftMinimumPeriod);
    [PreserveSig]
    int SetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr pmftPeriod);
    [PreserveSig]
    int GetShareMode([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr pMode);
    [PreserveSig]
    int SetShareMode([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, IntPtr mode);
    [PreserveSig]
    int GetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, ref PROPERTYKEY key, out PROPVARIANT pv);
    [PreserveSig]
    int SetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, ref PROPERTYKEY key, ref PROPVARIANT pv);
    [PreserveSig]
    int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, ERole role);
    [PreserveSig]
    int SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)] string pszDeviceName, [MarshalAs(UnmanagedType.Bool)] bool bVisible);
}

[StructLayout(LayoutKind.Sequential)]
internal struct PROPERTYKEY
{
    public Guid fmtid;
    public int pid;
}

[StructLayout(LayoutKind.Sequential)]
internal struct PROPVARIANT
{
    public ushort vt;
    public ushort wReserved1;
    public ushort wReserved2;
    public ushort wReserved3;
    public IntPtr p;
}

internal static class PropertyKeys
{
    public static PROPERTYKEY PKEY_Device_FriendlyName => new()
    {
        fmtid = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"),
        pid = 14
    };
}
