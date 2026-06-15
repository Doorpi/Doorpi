namespace Doorpi.UpdateCore;

public sealed class UpdateSecurityPolicy
{
    public const string ProductionManifestUrl =
        "https://raw.githubusercontent.com/Doorpi/Doorpi/main/manifests/beta.json";

    public static readonly string[] ProductionPackageUrlPrefixes =
    [
        "https://github.com/Doorpi/Doorpi/releases/download/"
    ];

    private UpdateSecurityPolicy(
        bool isDevelopment,
        bool allowLocalManifest,
        bool allowTrustSettingsOverride,
        bool requireOfficialPackageUrls,
        bool requireManifestFreshness,
        bool requireManifestSignature)
    {
        IsDevelopment = isDevelopment;
        AllowLocalManifest = allowLocalManifest;
        AllowTrustSettingsOverride = allowTrustSettingsOverride;
        RequireOfficialPackageUrls = requireOfficialPackageUrls;
        RequireManifestFreshness = requireManifestFreshness;
        RequireManifestSignature = requireManifestSignature;
    }

    public bool IsDevelopment { get; }
    public bool AllowLocalManifest { get; }
    public bool AllowTrustSettingsOverride { get; }
    public bool RequireOfficialPackageUrls { get; }
    public bool RequireManifestFreshness { get; }
    public bool RequireManifestSignature { get; }

    public string DefaultManifestUrl => ProductionManifestUrl;
    public IReadOnlyList<string> AllowedPackageUrlPrefixes => ProductionPackageUrlPrefixes;

    public static UpdateSecurityPolicy Current { get; } = CreateCurrent();

    private static UpdateSecurityPolicy CreateCurrent()
    {
#if DEBUG || DOORPI_DEV_UPDATE_POLICY
        return new UpdateSecurityPolicy(
            isDevelopment: true,
            allowLocalManifest: true,
            allowTrustSettingsOverride: true,
            requireOfficialPackageUrls: false,
            requireManifestFreshness: false,
            requireManifestSignature: false);
#else
        return new UpdateSecurityPolicy(
            isDevelopment: false,
            allowLocalManifest: false,
            allowTrustSettingsOverride: false,
            requireOfficialPackageUrls: true,
            requireManifestFreshness: true,
            requireManifestSignature: true);
#endif
    }
}
