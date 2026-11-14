using System.Collections.Concurrent;

namespace Doorpi.Storage;

public sealed class StorageConflictException : IOException
{
    public StorageConflictException(string path, long expected, long actual)
        : base($"State changed concurrently: '{path}' (expected revision {expected}, actual {actual}).") { }
}

public sealed record StorageSnapshot(IReadOnlyDictionary<string, string?> Documents, IReadOnlyDictionary<string, long> Revisions);

/// <summary>Compatibility boundary: app-owned logical paths use SQLite; external file contracts remain physical.</summary>
public static class StateStorage
{
    private static readonly ConcurrentDictionary<string, StorageDatabase> Databases = new(StringComparer.OrdinalIgnoreCase);
    private static StorageDatabase? _configuredDatabase;
    public static string DefaultAppDataFolder => Path.Combine(
        Environment.GetEnvironmentVariable("DOORPI_APPDATA_ROOT") is { Length: > 0 } root
            ? root : Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Doorpi");

    public static MigrationResult Initialize(string appDataFolder)
    {
        var database = Register(appDataFolder);
        var result = database.EnsureMigrated();
        Volatile.Write(ref _configuredDatabase, database);
        return result;
    }
    private static StorageDatabase ConfiguredDatabase()
    {
        var configured = Volatile.Read(ref _configuredDatabase);
        if (configured != null) return configured;
        if (Databases.Count == 1) return Databases.Values.Single();
        if (Databases.Count > 1) throw new InvalidOperationException("Initialize the target root explicitly before using a storage operation without a path.");
        return Register(DefaultAppDataFolder);
    }
    internal static StorageDatabase Register(string root)
    {
        string full = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return Databases.GetOrAdd(full, static path => new StorageDatabase(path));
    }

    private static StorageDatabase? Resolve(string path, bool initialize)
    {
        var database = Databases.Values.OrderByDescending(item => item.Policy.Root.Length).FirstOrDefault(item => item.Policy.TryGetKey(path, out _, out _));
        if (database == null)
        {
            var policy = new StoragePathPolicy(DefaultAppDataFolder);
            if (!policy.TryGetKey(path, out _, out _)) return null;
            database = Register(policy.Root);
        }
        if (initialize) database.EnsureMigrated();
        return database;
    }

    public static bool HandlesPath(string path) => Resolve(path, initialize: false) != null;
    public static bool Exists(string path) => Resolve(path, initialize: true)?.Exists(path) ?? File.Exists(path);
    public static string ReadAllText(string path) => Resolve(path, initialize: true)?.ReadAllText(path) ?? File.ReadAllText(path);
    public static void WriteAllText(string path, string content, bool keepBackup = true)
    {
        var database = Resolve(path, initialize: true);
        if (database != null) { database.WriteAllText(path, content, keepBackup); return; }
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        File.WriteAllText(path, content);
    }

    public static Task WriteAllTextAsync(string path, string content, bool keepBackup = true, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.Run(() => { cancellationToken.ThrowIfCancellationRequested(); WriteAllText(path, content, keepBackup); }, cancellationToken);
    }
    public static Task<string> ReadAllTextAsync(string path, CancellationToken cancellationToken = default) =>
        Task.Run(() => { cancellationToken.ThrowIfCancellationRequested(); return ReadAllText(path); }, cancellationToken);

    public static void Delete(string path)
    {
        var database = Resolve(path, initialize: true);
        if (database != null) database.Delete(path); else File.Delete(path);
    }

    public static IReadOnlyList<string> EnumerateDocuments(string directory, string searchPattern = "*.json", bool recursive = true)
    {
        string full = Path.GetFullPath(directory).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var database = Databases.Values.OrderByDescending(item => item.Policy.Root.Length)
            .FirstOrDefault(item => full.Equals(item.Policy.Root, StringComparison.OrdinalIgnoreCase) || full.StartsWith(item.Policy.Root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase));
        if (database == null)
        {
            string defaultRoot = Path.GetFullPath(DefaultAppDataFolder);
            if (full.Equals(defaultRoot, StringComparison.OrdinalIgnoreCase) || full.StartsWith(defaultRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) database = Register(defaultRoot);
        }
        if (database == null) return Directory.Exists(directory) ? Directory.GetFiles(directory, searchPattern, recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly) : Array.Empty<string>();
        database.EnsureMigrated();
        return database.EnumeratePaths(directory, searchPattern, recursive);
    }

    public static void DeletePrefix(string directory)
    {
        foreach (var database in Databases.Values)
        {
            string full = Path.GetFullPath(directory);
            if (!full.StartsWith(database.Policy.Root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) continue;
            database.EnsureMigrated(); database.DeletePrefix(directory); return;
        }
        throw new ArgumentException("No application database owns this directory.", nameof(directory));
    }

    public static long GetRevision(string path) => Resolve(path, initialize: true)?.GetRevision(path) ?? 0;
    public static DateTime GetLastWriteTimeUtc(string path)
    {
        var database = Resolve(path, initialize: true);
        return database == null ? File.GetLastWriteTimeUtc(path) : database.Exists(path) ? database.GetInfo(path).UpdatedUtc : DateTime.FromFileTimeUtc(0);
    }
    public static long GetLength(string path) => Resolve(path, initialize: true)?.GetInfo(path).Length ?? new FileInfo(path).Length;

    public static StorageSnapshot ReadSnapshot(IEnumerable<string> paths)
    {
        string[] requested = paths.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var database = RequireSameDatabase(requested);
        return database.ReadSnapshot(requested);
    }
    public static void WriteBatch(IReadOnlyDictionary<string, string?> writes) => WriteBatchIfRevision(writes, new Dictionary<string, long>());
    public static void WriteBatchIfRevision(IReadOnlyDictionary<string, string?> writes, IReadOnlyDictionary<string, long> expectedRevisions)
    {
        if (writes.Count == 0 && expectedRevisions.Count == 0) return;
        var database = RequireSameDatabase(writes.Keys.Concat(expectedRevisions.Keys));
        database.WriteBatchIfRevision(writes, expectedRevisions);
    }
    public static void ExecuteTransaction(Action action)
    {
        var database = ConfiguredDatabase();
        database.EnsureMigrated(); database.ExecuteTransaction(action);
    }
    public static void ExecuteTransaction(string appDataFolder, Action action)
    {
        var database = Register(appDataFolder); database.EnsureMigrated(); database.ExecuteTransaction(action);
    }
    public static IReadOnlyList<StorageEntity> ReadEntities(string path) => (Resolve(path, true) ?? throw new ArgumentException("Unmanaged path.")).ReadEntities(path);
    public static StorageEntitySnapshot ReadEntitySnapshot(string path) => (Resolve(path, true) ?? throw new ArgumentException("Unmanaged path.")).ReadEntitySnapshot(path);
    public static AppCacheSnapshot ReadAppCacheSnapshot(string path) => (Resolve(path, true) ?? throw new ArgumentException("Unmanaged path.")).ReadAppCacheSnapshot(path);
    public static void UpdateCollectionItem(string path, string entityId, string patchJson, long expectedRevision) =>
        (Resolve(path, true) ?? throw new ArgumentException("Unmanaged path.")).UpdateCollectionItem(path, entityId, patchJson, expectedRevision);

    public static void CreateBackup(string destination)
    {
        var database = ConfiguredDatabase();
        database.EnsureMigrated(); database.BackupTo(destination);
    }
    public static void RestoreBackup(string source)
    {
        var database = ConfiguredDatabase();
        database.RestoreFrom(source);
    }
    public static string CheckIntegrity()
    {
        var database = ConfiguredDatabase();
        database.EnsureMigrated(); return database.CheckIntegrity();
    }
    private static StorageDatabase RequireSameDatabase(IEnumerable<string> paths)
    {
        StorageDatabase? result = null;
        foreach (string path in paths)
        {
            var database = Resolve(path, true) ?? throw new ArgumentException($"Unmanaged path cannot participate in a storage transaction: '{path}'.");
            if (result != null && !ReferenceEquals(result, database)) throw new ArgumentException("A storage transaction cannot span application roots.");
            result = database;
        }
        return result ?? throw new ArgumentException("At least one managed path is required.");
    }
}
