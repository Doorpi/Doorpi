namespace Doorpi.UpdateCore;

public static class UpdateManifestValidator
{
    public static void Validate(
        UpdateManifest manifest,
        UpdateSecurityPolicy policy,
        UpdateManifestState? previousState,
        DateTimeOffset now)
    {
        if (manifest.SchemaVersion < manifest.MinimumSupportedManifestVersion)
            throw new InvalidDataException("Versao de manifesto nao suportada.");

        if (manifest.ManifestVersion <= 0)
            throw new InvalidDataException("Manifesto sem manifestVersion valido.");

        if (policy.RequireManifestFreshness && manifest.ExpiresAt <= now)
            throw new InvalidDataException("Manifesto de update expirado.");

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
        int comparison = UpdateVersionComparer.Compare(release.Version, localVersion);
        if (comparison < 0 && !release.AllowRollback)
            throw new InvalidDataException($"{componentName} rejeitou downgrade sem allowRollback assinado.");
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
