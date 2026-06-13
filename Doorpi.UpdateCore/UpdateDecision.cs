namespace Doorpi.UpdateCore;

public sealed class UpdateDecision
{
    public bool DoorpiUpdateAvailable { get; init; }
    public bool UpdaterUpdateAvailable { get; init; }
    public bool ForceUpdate { get; init; }
    public ComponentRelease? DoorpiRelease { get; init; }
    public ComponentRelease? UpdaterRelease { get; init; }
    public UpdateManifest? Manifest { get; init; }

    public bool HasAnyUpdate => DoorpiUpdateAvailable || UpdaterUpdateAvailable;
}
