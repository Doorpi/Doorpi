namespace Doorpi;

internal static class BootLaunchPolicy
{
    // A saved preference describes the next logon, not every subsequent launch.
    // Capture this once, before shell preparation changes the environment.
    internal static bool RequiresInProcessPreparation(bool immersiveConfigured,
        bool presentationAlreadyManaged, bool explorerAvailable) =>
        immersiveConfigured && !presentationAlreadyManaged && !explorerAvailable;
}
