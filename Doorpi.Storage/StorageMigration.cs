using System.Text.Json;

namespace Doorpi.Storage;

public sealed record StorageMigrationCheckpoint(string AppDataFolder, string BackupDirectory, bool HadDatabase, int TargetSchemaVersion);
public sealed class StorageMigrationException : IOException
{
    public StorageMigrationException(string message, Exception? inner = null) : base(message, inner) { }
}

/// <summary>Immutable pre-update snapshots remain separate from the application database and survive rollback.</summary>
public static class StorageMigration
{
    public static string GetBackupDirectory(string appDataFolder, string operationId)
    {
        if (string.IsNullOrWhiteSpace(operationId) || operationId.Any(character => !char.IsAsciiLetterOrDigit(character) && character is not '-' and not '_'))
            throw new ArgumentException("Operation ID must contain only ASCII letters, numbers, '-' or '_'.", nameof(operationId));
        return Path.Combine(Path.GetFullPath(appDataFolder), "storage", "checkpoints", operationId);
    }

    public static StorageMigrationCheckpoint? LoadCheckpoint(string appDataFolder, string operationId)
    {
        string directory = GetBackupDirectory(appDataFolder, operationId);
        string path = Path.Combine(directory, ".checkpoint");
        if (!File.Exists(path)) return null;
        var checkpoint = JsonSerializer.Deserialize<StorageMigrationCheckpoint>(File.ReadAllText(path)) ?? throw new InvalidDataException("Invalid storage checkpoint.");
        if (!Path.GetFullPath(checkpoint.AppDataFolder).Equals(Path.GetFullPath(appDataFolder), StringComparison.OrdinalIgnoreCase) ||
            !Path.GetFullPath(checkpoint.BackupDirectory).Equals(directory, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Storage checkpoint does not match its application root.");
        return checkpoint;
    }

    public static StorageMigrationCheckpoint Prepare(string appDataFolder, string operationId)
    {
        var existing = LoadCheckpoint(appDataFolder, operationId);
        if (existing != null) { StateStorage.Register(appDataFolder).EnsureMigrated(); return existing; }
        var database = StateStorage.Register(appDataFolder);
        string directory = GetBackupDirectory(appDataFolder, operationId);
        Directory.CreateDirectory(directory);
        bool hadDatabase = File.Exists(database.DatabasePath);
        if (hadDatabase) database.BackupTo(Path.Combine(directory, "doorpi.db"));
        CopyLegacy(database.Policy, Path.Combine(directory, "legacy"));
        var checkpoint = new StorageMigrationCheckpoint(database.Policy.Root, directory, hadDatabase, StorageDatabase.SchemaVersion);
        string checkpointPath = Path.Combine(directory, ".checkpoint");
        WriteDurable(checkpointPath, JsonSerializer.Serialize(checkpoint));
        database.EnsureMigrated();
        return checkpoint;
    }

    public static void Restore(StorageMigrationCheckpoint checkpoint)
    {
        ArgumentNullException.ThrowIfNull(checkpoint);
        var database = StateStorage.Register(checkpoint.AppDataFolder);
        string expectedParent = Path.Combine(database.Policy.Root, "storage", "checkpoints") + Path.DirectorySeparatorChar;
        if (!Path.GetFullPath(checkpoint.BackupDirectory).StartsWith(expectedParent, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Checkpoint directory is outside the storage checkpoint root.");
        if (checkpoint.HadDatabase) database.RestoreFrom(Path.Combine(checkpoint.BackupDirectory, "doorpi.db"));
        else database.RemoveDatabaseForRollback();
        // SQLite cutover never deletes legacy sources. Restoring their immutable snapshot also
        // covers an explicitly supported downgrade to a JSON-based application version.
        string legacy = Path.Combine(checkpoint.BackupDirectory, "legacy");
        if (!Directory.Exists(legacy)) return;
        foreach (string source in Directory.EnumerateFiles(legacy, "*", SearchOption.AllDirectories))
        {
            string target = Path.Combine(database.Policy.Root, Path.GetRelativePath(legacy, source));
            if (!database.Policy.TryGetKey(target, out _, out _)) throw new InvalidDataException("Checkpoint contains an unmanaged state path.");
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Copy(source, target, overwrite: true);
        }
    }

    internal static void CopyLegacy(StoragePathPolicy policy, string destination)
    {
        foreach (string source in policy.EnumerateLegacyCandidates())
        {
            string target = Path.Combine(destination, Path.GetRelativePath(policy.Root, source));
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            if (File.Exists(target)) continue;
            File.Copy(source, target, overwrite: false);
            using var stream = new FileStream(target, FileMode.Open, FileAccess.ReadWrite, FileShare.Read);
            stream.Flush(flushToDisk: true);
        }
    }

    internal static void WriteDurable(string path, string content)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        string temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
            using (var writer = new StreamWriter(stream)) { writer.Write(content); writer.Flush(); stream.Flush(flushToDisk: true); }
            File.Move(temporary, path, overwrite: true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}
