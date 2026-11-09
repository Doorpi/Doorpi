namespace Doorpi.UpdateCore;

public static class UpdateManifestValidator
{
    public static void Validate(
        UpdateManifest manifest,
        UpdateSecurityPolicy policy,
        UpdateManifestState? previousState,
        DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(manifest);
        ArgumentNullException.ThrowIfNull(policy);

        if (!string.IsNullOrWhiteSpace(manifest.Doorpi.MinUpdaterVersion) &&
            !UpdateVersionComparer.IsValidVersion(manifest.Doorpi.MinUpdaterVersion))
            throw new InvalidDataException("A versão mínima do atualizador é inválida.");

        if (manifest.SchemaVersion < manifest.MinimumSupportedManifestVersion)
            throw new InvalidDataException("Versão de manifesto não suportada.");

        if (manifest.ManifestVersion <= 0)
            throw new InvalidDataException("Manifesto sem manifestVersion válido.");

        if (policy.RequireManifestFreshness && manifest.ExpiresAt <= now)
            throw new InvalidDataException("Manifesto de atualização expirado.");

        if (policy.RequireManifestFreshness
            && previousState != null
            && string.Equals(previousState.Channel, manifest.Channel, StringComparison.OrdinalIgnoreCase)
            && manifest.ManifestVersion < previousState.HighestManifestVersion)
        {
            throw new InvalidDataException("Manifesto antigo rejeitado.");
        }

        if (policy.RequireOfficialPackageUrls)
        {
            ValidateOfficialPackageUrl(manifest.Doorpi.DownloadUrl, policy);
            ValidateOfficialPackageUrl(manifest.Updater.DownloadUrl, policy);
        }
    }

    public static void ValidateNoUnsignedDowngrade(
        ComponentRelease release,
        string localVersion,
        string componentName)
    {
        ArgumentNullException.ThrowIfNull(release);

        int comparison = UpdateVersionComparer.Compare(release.Version, localVersion);
        if (comparison < 0 && !release.AllowRollback)
            throw new InvalidDataException($"A reversão de versão do {componentName} não foi autorizada pelo manifesto assinado.");
    }

    public static bool MeetsMinimumUpdaterVersion(ComponentRelease release, string updaterVersion)
    {
        ArgumentNullException.ThrowIfNull(release);
        if (string.IsNullOrWhiteSpace(release.MinUpdaterVersion)) return true;
        if (!UpdateVersionComparer.IsValidVersion(release.MinUpdaterVersion))
            throw new InvalidDataException("A versão mínima do atualizador é inválida.");
        return UpdateVersionComparer.IsValidVersion(updaterVersion) &&
               UpdateVersionComparer.Compare(updaterVersion, release.MinUpdaterVersion) >= 0;
    }

    public static void ValidateMinimumUpdaterVersion(ComponentRelease release, string updaterVersion)
    {
        if (!MeetsMinimumUpdaterVersion(release, updaterVersion))
            throw new InvalidDataException($"Esta atualização exige o atualizador {release.MinUpdaterVersion} ou superior. Atualizador instalado: {updaterVersion}.");
    }

    private static void ValidateOfficialPackageUrl(string downloadUrl, UpdateSecurityPolicy policy)
    {
        if (string.IsNullOrWhiteSpace(downloadUrl))
            throw new InvalidDataException("URL de pacote vazia.");

        bool allowed = policy.AllowedPackageUrlPrefixes.Any(prefix =>
            downloadUrl.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

        if (!allowed)
            throw new InvalidDataException("URL de pacote fora da origem oficial do Doorpi.");
    }
}
