using Doorpi.UpdateCore;
using Doorpi.Storage;
using System.Security.Cryptography;
using System.Text;
using System.IO.Compression;
using System.Text.Json;

if (args.Length is 3 or 4 && args[0] == "--validate-manifest")
{
    bool updaterBridge = args.Length == 4 && args[3] == "--updater-bridge";
    var releaseManifest = UpdateManifestClient.LoadFromFile(args[1]);
    ManifestSignatureVerifier.Verify(releaseManifest,
        TrustedUpdateKeys.ResolveProductionKey(releaseManifest.Signature?.KeyId ?? ""));
    UpdateManifestValidator.Validate(releaseManifest, UpdateSecurityPolicy.Current, null, DateTimeOffset.UtcNow);
    UpdateManifestValidator.ValidateMinimumUpdaterVersion(releaseManifest.Doorpi, releaseManifest.Updater.Version);
    foreach (var item in new[] { (Name: "doorpi", Release: releaseManifest.Doorpi), (Name: "updater", Release: releaseManifest.Updater) })
    {
        string fileName = Path.GetFileName(new Uri(item.Release.DownloadUrl).AbsolutePath);
        string packagePath = Path.Combine(Path.GetFullPath(args[2]), fileName);
        if (new FileInfo(packagePath).Length != item.Release.SizeBytes)
            throw new InvalidDataException("O tamanho do pacote não corresponde ao manifesto assinado.");
        await PackageVerifier.VerifySha256Async(packagePath, item.Release.Sha256);
        using var archive = ZipFile.OpenRead(packagePath);
        var entry = archive.GetEntry("package-manifest.json") ?? throw new InvalidDataException("Pacote sem manifesto interno.");
        using var stream = entry.Open();
        var package = JsonSerializer.Deserialize<PackageManifest>(stream) ?? throw new InvalidDataException("Manifesto de pacote inválido.");
        if (package.Component != item.Name || package.Version != item.Release.Version || package.Architecture != "win-x64")
            throw new InvalidDataException("Componente, versão ou arquitetura do pacote não corresponde ao release.");
        if (string.IsNullOrWhiteSpace(package.EntryPoint) || archive.GetEntry(package.EntryPoint) == null)
            throw new InvalidDataException("Executável ausente do pacote.");
        if ((item.Name == "updater" || package.StorageSchemaVersion > 0) &&
            !archive.Entries.Any(candidate => candidate.FullName.EndsWith("e_sqlite3.dll", StringComparison.OrdinalIgnoreCase)))
            throw new InvalidDataException("Biblioteca SQLite nativa ausente do pacote.");
        if (item.Name == "doorpi")
        {
            UpdateStorageCompatibility.ValidatePackage(package, releaseManifest.Updater.Version, false);
            bool legacyBridge = updaterBridge && package.StorageSchemaVersion == 0 &&
                UpdateVersionComparer.Compare(package.Version, UpdateStorageCompatibility.FirstSqliteDoorpiVersion) < 0 &&
                !item.Release.AllowRollback;
            if ((!legacyBridge && package.StorageSchemaVersion != UpdateStorageCompatibility.SupportedStorageSchemaVersion) ||
                UpdateVersionComparer.Compare(item.Release.MinUpdaterVersion,
                    UpdateStorageCompatibility.MinimumMigrationUpdaterVersion) < 0)
                throw new InvalidDataException("O manifesto não exige o atualizador que oferece a migração SQLite.");
        }
    }
    Console.WriteLine("Production manifest, trusted signature, package hashes and storage capabilities verified.");
    return;
}

int assertions = 0;
void Assert(bool condition, string message)
{
    assertions++;
    if (!condition) throw new Exception(message);
}
void Reject(Action action, string message)
{
    assertions++;
    try { action(); }
    catch (InvalidDataException) { return; }
    throw new Exception(message);
}

var manifest = new UpdateManifest
{
    Doorpi = new ComponentRelease { Version = "0.4.31", MinUpdaterVersion = "0.1.2" },
    Updater = new ComponentRelease { Version = "0.1.2" }
};
var decision = UpdatePlanner.Decide(manifest, "0.4.30", "0.1.1");
Assert(decision.DoorpiUpdateAvailable && decision.UpdaterUpdateAvailable &&
    decision.UpdaterRequiredBeforeDoorpi, "Old clients must update updater first.");
decision = UpdatePlanner.Decide(manifest, "0.4.30", "0.1.2");
Assert(decision.DoorpiUpdateAvailable && !decision.UpdaterRequiredBeforeDoorpi,
    "A compatible installed updater should apply Doorpi normally.");
Reject(() => UpdateManifestValidator.ValidateMinimumUpdaterVersion(manifest.Doorpi, "0.1.1"),
    "Executing an incompatible updater was accepted.");
manifest.Updater.Version = "0.1.1";
Reject(() => UpdatePlanner.Decide(manifest, "0.4.30", "0.1.0"),
    "An unavailable required updater was accepted.");
manifest.Doorpi.MinUpdaterVersion = "broken";
Reject(() => UpdatePlanner.Decide(manifest, "0.4.30", "0.1.2"),
    "Invalid required updater version was accepted.");
Assert(UpdateVersionComparer.Compare("0.1.2-beta.10", "0.1.2-beta.2") > 0,
    "Numeric prerelease identifiers must compare numerically.");
Assert(!UpdateVersionComparer.IsValidVersion("0.1.2junk"), "Trailing garbage was accepted.");
Assert(!UpdateVersionComparer.IsValidVersion("999999999999999999999.1.2"), "Overflowing version was accepted.");
manifest.Doorpi.MinUpdaterVersion = "0.1.2";
manifest.Updater.Version = "0.1.2";

var sqlitePackage = new PackageManifest { StorageSchemaVersion = 1, MinUpdaterVersion = "0.1.2" };
UpdateStorageCompatibility.ValidatePackage(sqlitePackage, "0.1.2", hasSqliteData: false);
Reject(() => UpdateStorageCompatibility.ValidatePackage(sqlitePackage, "0.1.1", false),
    "Package capability failed to reject an old updater.");
Reject(() => UpdateStorageCompatibility.ValidatePackage(new PackageManifest(), "0.1.2", true),
    "Legacy downgrade over migrated data was accepted.");
Reject(() => UpdateStorageCompatibility.ValidatePackage(new PackageManifest { StorageSchemaVersion = 2 }, "0.1.2", true),
    "Catalog schema was accepted by an older updater.");
UpdateStorageCompatibility.ValidatePackage(new PackageManifest { StorageSchemaVersion = 2, MinUpdaterVersion = "0.1.3" }, "0.1.3", true);
Reject(() => UpdateStorageCompatibility.ValidatePackage(new PackageManifest { StorageSchemaVersion = 2, MinUpdaterVersion = "0.1.2" }, "0.1.3", true),
    "Catalog package declared an insufficient minimum updater.");
Reject(() => UpdateStorageCompatibility.ValidatePackage(new PackageManifest { StorageSchemaVersion = 3 }, "0.1.3", true),
    "A future storage schema was accepted.");

var pendingStartup = new UpdateOperationState
{
    Component = "doorpi", Phase = "doorpi-applied-pending-health-check", HealthSignalPath = "test-health.signal",
    StorageMigrationStarted = true, StorageMigrationCompleted = true, StorageSchemaVersion = 1
};
Assert(!UpdateStartupPolicy.IsRecoveryRequired(pendingStartup, "test-health.signal"),
    "The updater's authorized health-check launch was blocked.");
Assert(UpdateStartupPolicy.IsRecoveryRequired(pendingStartup, null), "Ordinary launch bypassed an unfinished update.");
Assert(UpdateStartupPolicy.IsRecoveryRequired(pendingStartup, "another.signal"), "Another operation's health signal was accepted.");
pendingStartup.StorageMigrationCompleted = false;
Assert(UpdateStartupPolicy.IsRecoveryRequired(pendingStartup, "test-health.signal"), "Incomplete migration was admitted to the health check.");
foreach (string phase in new[] { "storage-migrating", "storage-migrated", "applying", "rollback", "rollback-failed", "doorpi-health-check-failed" })
{
    pendingStartup.Phase = phase;
    Assert(UpdateStartupPolicy.IsRecoveryRequired(pendingStartup, "test-health.signal"), "Unsafe startup phase was accepted: " + phase);
}
pendingStartup.Phase = "rolled-back";
Assert(!UpdateStartupPolicy.IsRecoveryRequired(pendingStartup, null), "A fully restored application was blocked.");

using (RSA rsa = RSA.Create(2048))
{
    byte[] payload = Encoding.UTF8.GetBytes(ManifestSignatureVerifier.BuildSigningPayload(manifest));
    manifest.Signature = new ManifestSignature
    {
        Value = Convert.ToBase64String(rsa.SignData(payload, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1))
    };
    ManifestSignatureVerifier.Verify(manifest, rsa.ToXmlString(false));
    manifest.Doorpi.MinUpdaterVersion = "0.0.0";
    Reject(() => ManifestSignatureVerifier.Verify(manifest, rsa.ToXmlString(false)),
        "The updater prerequisite was not protected by the signature.");
}

string testRoot = Path.Combine(AppContext.BaseDirectory, "test-data", "DoorpiUpdateCoreTests-" + Guid.NewGuid().ToString("N"));
try
{
    string install = Path.Combine(testRoot, "install");
    string staging = Path.Combine(testRoot, "staging");
    string backup = Path.Combine(testRoot, "backup");
    Directory.CreateDirectory(Path.Combine(install, "Data"));
    Directory.CreateDirectory(Path.Combine(staging, "Data"));
    File.WriteAllText(Path.Combine(install, "Doorpi.exe"), "old");
    File.WriteAllText(Path.Combine(install, "Data", "profile.json"), "user-data");
    File.WriteAllText(Path.Combine(staging, "Doorpi.exe"), "new");
    File.WriteAllText(Path.Combine(staging, "new-native.dll"), "native");
    File.WriteAllText(Path.Combine(staging, "Data", "profile.json"), "must-not-overwrite");
    var installer = new ComponentInstaller(["Data"]);
    installer.ApplyFromStaging(staging, install, backup);
    Assert(File.ReadAllText(Path.Combine(install, "Doorpi.exe")) == "new", "Apply failed.");
    Assert(File.ReadAllText(Path.Combine(install, "Data", "profile.json")) == "user-data", "Data was overwritten.");
    installer.Rollback(backup, install);
    Assert(File.ReadAllText(Path.Combine(install, "Doorpi.exe")) == "old", "Previous binary was not restored.");
    Assert(!File.Exists(Path.Combine(install, "new-native.dll")), "Rollback left an introduced native DLL behind.");
    Assert(File.ReadAllText(Path.Combine(install, "Data", "profile.json")) == "user-data", "Rollback altered user data.");
    File.WriteAllText(Path.Combine(backup, ".doorpi-rollback-inventory.json"),
        "{\"Version\":1,\"CreatedFiles\":[\"../outside.txt\"]}");
    Reject(() => installer.Rollback(backup, install), "Rollback allowed a path outside installation.");

    string statePath = Path.Combine(testRoot, "update-state.json");
    var stateStore = new UpdateStateStore(statePath);
    var persisted = new UpdateOperationState
    {
        Component = "doorpi", TargetVersion = "0.4.31", InstallFolder = install, Phase = "storage-migrating"
    };
    stateStore.Save(persisted);
    persisted.Phase = "applying";
    stateStore.Save(persisted);
    File.WriteAllText(statePath, "{corrupt");
    Assert(stateStore.Load()?.Phase == "storage-migrating", "Interrupted state did not recover its previous durable checkpoint.");
    stateStore.Clear();
    Assert(stateStore.Load() == null, "Cleared update state was resurrected from its backup.");
    persisted.Phase = "unknown-phase";
    File.WriteAllText(statePath, JsonSerializer.Serialize(persisted));
    Reject(() => stateStore.Load(), "An unrecognized bootstrap phase was treated as safe or empty state.");
    stateStore.Clear();

    // Execute the same data+binary rollback used by the updater after failed
    // health checks, using real SQLite and an isolated data root.
    string appData = Path.Combine(testRoot, "appdata");
    string gamesPath = Path.Combine(appData, "Data", "users", "alice", "games.json");
    Directory.CreateDirectory(Path.GetDirectoryName(gamesPath)!);
    string legacyGames = "[{\"Name\":\"Original\",\"Path\":\"game.exe\"}]";
    File.WriteAllText(gamesPath, legacyGames);
    string operationId = Guid.NewGuid().ToString("N");
    var firstCheckpoint = StorageMigration.Prepare(appData, operationId);
    Assert(!firstCheckpoint.HadDatabase, "Legacy installation was incorrectly classified as already migrated.");
    string migratedGames = StateStorage.ReadAllText(gamesPath);
    using (var migratedDocument = JsonDocument.Parse(migratedGames))
        Assert(migratedDocument.RootElement.GetArrayLength() == 1 &&
               migratedDocument.RootElement[0].GetProperty("Name").GetString() == "Original" &&
               migratedDocument.RootElement[0].GetProperty("Path").GetString() == "game.exe",
            "Legacy data did not migrate correctly.");
    StateStorage.WriteAllText(gamesPath, "[{\"Name\":\"FailedBoot\",\"Path\":\"game.exe\"}]");
    Assert(StorageMigration.LoadCheckpoint(appData, operationId) == firstCheckpoint,
        "Recovery could not reconstruct a checkpoint after losing the updater process.");
    var failedHealth = new UpdateOperationState
    {
        OperationId = operationId, StorageMigrationStarted = true, StorageMigrationCompleted = true,
        StorageBackupDirectory = firstCheckpoint.BackupDirectory,
        StorageHadDatabase = false, InstallFolder = install
    };
    UpdateRollback.Restore(failedHealth, appData);
    Assert(!File.Exists(Path.Combine(appData, "storage", "doorpi.db")),
        "Failed first boot did not remove its newly migrated database.");
    Assert(File.ReadAllText(gamesPath) == legacyGames, "Legacy originals were not preserved for the previous app.");

    StateStorage.Initialize(appData);
    StateStorage.WriteAllText(gamesPath, "[{\"Name\":\"BeforeUpdate\",\"Path\":\"game.exe\"}]");
    string nextOperation = Guid.NewGuid().ToString("N");
    var nextCheckpoint = StorageMigration.Prepare(appData, nextOperation);
    Assert(nextCheckpoint.HadDatabase, "An existing database was not snapshotted.");
    StateStorage.WriteAllText(gamesPath, "[{\"Name\":\"AfterUpdate\",\"Path\":\"game.exe\"}]");
    var failedNextHealth = new UpdateOperationState
    {
        OperationId = nextOperation, StorageMigrationStarted = true, StorageMigrationCompleted = true,
        StorageBackupDirectory = nextCheckpoint.BackupDirectory,
        StorageHadDatabase = true, InstallFolder = install
    };
    UpdateRollback.Restore(failedNextHealth, appData);
    Assert(StateStorage.ReadAllText(gamesPath).Contains("BeforeUpdate"),
        "Failed health check did not restore the database that matches the old app.");
    UpdateRollback.Restore(failedNextHealth, appData);
    Assert(StateStorage.ReadAllText(gamesPath).Contains("BeforeUpdate"), "Recovery is not idempotent.");
    Reject(() => UpdateRollback.Restore(new UpdateOperationState
    {
        StorageMigrationStarted = true, StorageMigrationCompleted = true,
        OperationId = "missing-checkpoint", InstallFolder = install
    }, appData), "Missing completed checkpoint was treated as successful recovery.");
}
finally
{
    if (Directory.Exists(testRoot)) Directory.Delete(testRoot, recursive: true);
}
Console.WriteLine($"Update core checks passed ({assertions} assertions).");
