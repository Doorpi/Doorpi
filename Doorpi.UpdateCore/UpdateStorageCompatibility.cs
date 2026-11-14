namespace Doorpi.UpdateCore;

/// <summary>Capabilities of the first updater that migrates local JSON state.</summary>
public static class UpdateStorageCompatibility
{
    public const string MinimumMigrationUpdaterVersion = "0.1.2";
    public const string FirstSqliteDoorpiVersion = "0.4.31";
    public const int SupportedStorageSchemaVersion = 2;
    public const string CatalogMigrationUpdaterVersion = "0.1.3";

    public static void ValidatePackage(PackageManifest package, string updaterVersion, bool hasSqliteData)
    {
        ArgumentNullException.ThrowIfNull(package);
        UpdateManifestValidator.ValidateMinimumUpdaterVersion(
            new ComponentRelease { MinUpdaterVersion = package.MinUpdaterVersion }, updaterVersion);
        if (package.StorageSchemaVersion < 0 ||
            package.StorageSchemaVersion > SupportedStorageSchemaVersion)
            throw new InvalidDataException("O pacote exige uma versão de armazenamento não suportada por este atualizador.");
        if (UpdateVersionComparer.Compare(package.Version, FirstSqliteDoorpiVersion) >= 0 &&
            package.StorageSchemaVersion == 0)
            throw new InvalidDataException("O pacote desta versão não declara a migração de armazenamento exigida.");
        if (package.StorageSchemaVersion > 0)
            UpdateManifestValidator.ValidateMinimumUpdaterVersion(
                new ComponentRelease { MinUpdaterVersion = MinimumMigrationUpdaterVersion }, updaterVersion);
        if (package.StorageSchemaVersion >= 2)
        {
            if (!UpdateVersionComparer.IsValidVersion(package.MinUpdaterVersion) ||
                UpdateVersionComparer.Compare(package.MinUpdaterVersion, CatalogMigrationUpdaterVersion) < 0)
                throw new InvalidDataException("O pacote do catálogo SQLite deve exigir o atualizador 0.1.3 ou posterior.");
            UpdateManifestValidator.ValidateMinimumUpdaterVersion(
                new ComponentRelease { MinUpdaterVersion = CatalogMigrationUpdaterVersion }, updaterVersion);
        }
        if (hasSqliteData && package.StorageSchemaVersion == 0)
            throw new InvalidDataException("Esta versão antiga do Doorpi não suporta os dados SQLite existentes. A reversão exige um pacote compatível com o armazenamento.");
    }
}
