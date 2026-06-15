namespace Doorpi.UpdateCore;

public static class UpdatePlanner
{
    public static UpdateDecision Decide(UpdateManifest manifest, string localDoorpiVersion, string localUpdaterVersion)
    {
        ArgumentNullException.ThrowIfNull(manifest);

        bool doorpiAvailable = IsApplicable(manifest.Doorpi, localDoorpiVersion);
        bool updaterAvailable = IsApplicable(manifest.Updater, localUpdaterVersion);

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

    private static bool IsApplicable(ComponentRelease release, string localVersion)
    {
        int comparison = UpdateVersionComparer.Compare(release.Version, localVersion);
        return comparison > 0 || (comparison < 0 && release.AllowRollback);
    }
}
