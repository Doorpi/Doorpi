namespace Doorpi.UpdateCore;

public static class UpdatePlanner
{
    public static UpdateDecision Decide(UpdateManifest manifest, string localDoorpiVersion, string localUpdaterVersion)
    {
        bool doorpiAvailable = UpdateVersionComparer.IsRemoteNewer(manifest.Doorpi.Version, localDoorpiVersion);
        bool updaterAvailable = UpdateVersionComparer.IsRemoteNewer(manifest.Updater.Version, localUpdaterVersion);

        return new UpdateDecision
        {
            DoorpiUpdateAvailable = doorpiAvailable,
            UpdaterUpdateAvailable = updaterAvailable,
            DoorpiRelease = doorpiAvailable ? manifest.Doorpi : null,
            UpdaterRelease = updaterAvailable ? manifest.Updater : null,
            ForceUpdate = (doorpiAvailable && manifest.Doorpi.ForceUpdate)
                || (updaterAvailable && manifest.Updater.ForceUpdate),
            Manifest = manifest
        };
    }
}
