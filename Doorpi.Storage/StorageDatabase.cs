using System.IO.Enumeration;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;

namespace Doorpi.Storage;

public sealed record MigrationResult(bool AlreadyMigrated, int ImportedDocuments, int RecoveredFromBackup, string BackupDirectory);
public sealed record StorageEntity(string Id, string OwnerId, int Ordinal, string Payload);
public sealed record StorageEntitySnapshot(long Revision, IReadOnlyList<StorageEntity> Entities);
public sealed record StorageDocumentInfo(string Path, long Revision, long Length, DateTime UpdatedUtc, string Sha256);

/// <summary>A single database per application-data root. Collections are normalized into indexed entity rows.</summary>
public sealed partial class StorageDatabase
{
    public const int SchemaVersion = 2;
    private readonly object _sync = new();
    private bool _migrationReady;
    [ThreadStatic] private static TransactionScope? _transaction;
    private sealed record TransactionScope(StorageDatabase Database, SqliteConnection Connection, SqliteTransaction Transaction);

    public StorageDatabase(string appDataFolder)
    {
        Policy = new StoragePathPolicy(appDataFolder);
        DatabasePath = Path.Combine(Policy.Root, "storage", "doorpi.db");
    }

    public StoragePathPolicy Policy { get; }
    public string DatabasePath { get; }

    private SqliteConnection Open(bool initialize = true)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(DatabasePath)!);
        var connection = new SqliteConnection(new SqliteConnectionStringBuilder
        {
            DataSource = DatabasePath, Mode = SqliteOpenMode.ReadWriteCreate, Pooling = false, DefaultTimeout = 15
        }.ToString());
        connection.Open();
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=15000; PRAGMA synchronous=FULL;";
            command.ExecuteNonQuery();
        }
        if (initialize) EnsureSchema(connection);
        return connection;
    }

    private static void EnsureSchema(SqliteConnection connection)
    {
        using var versionCommand = connection.CreateCommand();
        versionCommand.CommandText = "PRAGMA user_version";
        long version = (long)versionCommand.ExecuteScalar()!;
        if (version > SchemaVersion) throw new InvalidDataException($"Storage schema {version} is newer than supported schema {SchemaVersion}.");
        if (version == SchemaVersion) return;
        if (version > 0)
        {
            string directory = Path.Combine(Path.GetDirectoryName(connection.DataSource)!, "schema-backups");
            Directory.CreateDirectory(directory);
            string backup = Path.Combine(directory, $"schema-{version}-{Guid.NewGuid():N}.db");
            using var target = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = backup, Pooling = false }.ToString());
            target.Open();
            connection.BackupDatabase(target);
            using var integrity = target.CreateCommand();
            integrity.CommandText = "PRAGMA integrity_check";
            if (!Equals(integrity.ExecuteScalar(), "ok")) throw new InvalidDataException("Pre-upgrade SQLite backup failed integrity validation.");
        }
        using var transaction = connection.BeginTransaction();
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS metadata(name TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS documents(
              path TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL,
              content TEXT NOT NULL, backup_content TEXT, revision INTEGER NOT NULL CHECK(revision>0),
              updated_utc TEXT NOT NULL, sha256 TEXT NOT NULL, UNIQUE(path,owner_id));
            CREATE TABLE IF NOT EXISTS migration_provenance(
              document_path TEXT PRIMARY KEY REFERENCES documents(path) ON DELETE CASCADE,
              source_path TEXT NOT NULL, source_sha256 TEXT NOT NULL, recovered INTEGER NOT NULL CHECK(recovered IN(0,1)),
              imported_utc TEXT NOT NULL, backup_directory TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS users(
              source_path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE, id TEXT NOT NULL,
              owner_id TEXT NOT NULL, ordinal INTEGER NOT NULL, name TEXT NOT NULL, last_used TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(source_path,id),
              FOREIGN KEY(source_path,owner_id) REFERENCES documents(path,owner_id));
            CREATE INDEX IF NOT EXISTS users_owner_name ON users(owner_id,name);
            CREATE TABLE IF NOT EXISTS games(
              source_path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE, id TEXT NOT NULL,
              owner_id TEXT NOT NULL, ordinal INTEGER NOT NULL, name TEXT NOT NULL, executable_path TEXT NOT NULL,
              launch_url TEXT NOT NULL, emulator_id TEXT NOT NULL, rom_path TEXT NOT NULL,
              playtime_minutes INTEGER NOT NULL, last_played TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(source_path,id),
              FOREIGN KEY(source_path,owner_id) REFERENCES documents(path,owner_id));
            CREATE INDEX IF NOT EXISTS games_owner_path ON games(owner_id,executable_path);
            CREATE INDEX IF NOT EXISTS games_emulator_rom ON games(owner_id,emulator_id,rom_path);
            CREATE TABLE IF NOT EXISTS game_history(
              source_path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE, id TEXT NOT NULL,
              owner_id TEXT NOT NULL, ordinal INTEGER NOT NULL, name TEXT NOT NULL,
              playtime_minutes INTEGER NOT NULL, last_played TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(source_path,id),
              FOREIGN KEY(source_path,owner_id) REFERENCES documents(path,owner_id));
            CREATE INDEX IF NOT EXISTS history_owner_recent ON game_history(owner_id,last_played);
            CREATE TABLE IF NOT EXISTS media_history(
              source_path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE, id TEXT NOT NULL,
              owner_id TEXT NOT NULL, ordinal INTEGER NOT NULL, app_id TEXT NOT NULL, title TEXT NOT NULL,
              creator TEXT NOT NULL, playback_seconds INTEGER NOT NULL, last_played TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(source_path,id),
              FOREIGN KEY(source_path,owner_id) REFERENCES documents(path,owner_id));
            CREATE INDEX IF NOT EXISTS media_history_identity ON media_history(owner_id,app_id,title,creator);
            CREATE TABLE IF NOT EXISTS control_profiles(
              source_path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE, id TEXT NOT NULL,
              owner_id TEXT NOT NULL, ordinal INTEGER NOT NULL, name TEXT NOT NULL, base_profile_id TEXT NOT NULL,
              enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), version INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL CHECK(json_valid(payload)),
              PRIMARY KEY(source_path,id), FOREIGN KEY(source_path,owner_id) REFERENCES documents(path,owner_id));
            CREATE TABLE IF NOT EXISTS control_bindings(
              source_path TEXT NOT NULL, profile_id TEXT NOT NULL, id TEXT NOT NULL, ordinal INTEGER NOT NULL,
              trigger_kind TEXT NOT NULL, action_kind TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),
              version INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(source_path,profile_id,id),
              FOREIGN KEY(source_path,profile_id) REFERENCES control_profiles(source_path,id) ON DELETE CASCADE);
            CREATE TABLE IF NOT EXISTS control_assignments(
              source_path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE, id TEXT NOT NULL,
              owner_id TEXT NOT NULL, ordinal INTEGER NOT NULL, profile_id TEXT NOT NULL, target_kind TEXT NOT NULL,
              target_id TEXT NOT NULL, target_fingerprint TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(source_path,id),
              FOREIGN KEY(source_path,owner_id) REFERENCES documents(path,owner_id));
            CREATE INDEX IF NOT EXISTS controls_target ON control_assignments(owner_id,target_kind,target_id);
            CREATE INDEX IF NOT EXISTS controls_profile ON control_assignments(source_path,profile_id);
            CREATE TABLE IF NOT EXISTS entities(
              source_path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE, id TEXT NOT NULL,
              owner_id TEXT NOT NULL, ordinal INTEGER NOT NULL, name TEXT NOT NULL, entity_kind TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL CHECK(json_valid(payload)),
              PRIMARY KEY(source_path,id), FOREIGN KEY(source_path,owner_id) REFERENCES documents(path,owner_id));
            CREATE INDEX IF NOT EXISTS entities_owner_kind ON entities(owner_id,entity_kind,name);
            CREATE TABLE IF NOT EXISTS nested_entities(
              source_path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE, collection_name TEXT NOT NULL,
              id TEXT NOT NULL, owner_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
              version INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL CHECK(json_valid(payload)),
              PRIMARY KEY(source_path,collection_name,id), FOREIGN KEY(source_path,owner_id) REFERENCES documents(path,owner_id));
            CREATE TABLE IF NOT EXISTS identity_conflicts(
              source_path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE,
              entity_id TEXT NOT NULL, ordinal INTEGER NOT NULL, reason TEXT NOT NULL,
              PRIMARY KEY(source_path,entity_id));
            PRAGMA user_version=1;
            """;
        command.ExecuteNonQuery();
        UpgradeCatalogSchema(connection, transaction);
        transaction.Commit();
    }

    internal T WithConnection<T>(Func<SqliteConnection, SqliteTransaction?, T> operation)
    {
        lock (_sync)
        {
            if (_transaction is { } current)
            {
                if (!ReferenceEquals(current.Database, this)) throw new InvalidOperationException("A storage transaction cannot span application roots.");
                return operation(current.Connection, current.Transaction);
            }
            using var connection = Open();
            return operation(connection, null);
        }
    }

    public void ExecuteTransaction(Action action)
    {
        ArgumentNullException.ThrowIfNull(action);
        lock (_sync)
        {
            if (_transaction is { } existing)
            {
                if (!ReferenceEquals(existing.Database, this)) throw new InvalidOperationException("A transaction cannot span roots.");
                action();
                return;
            }
            using var connection = Open();
            using var transaction = connection.BeginTransaction();
            _transaction = new(this, connection, transaction);
            try { action(); transaction.Commit(); }
            finally { _transaction = null; }
        }
    }

    internal static SqliteCommand Command(SqliteConnection connection, SqliteTransaction? transaction, string sql, params (string Name, object? Value)[] parameters)
    {
        var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        foreach (var parameter in parameters) command.Parameters.AddWithValue(parameter.Name, parameter.Value ?? DBNull.Value);
        return command;
    }

    private (string Key, bool Backup) RequirePath(string path)
    {
        if (!Policy.TryGetKey(path, out string key, out bool backup)) throw new ArgumentException("Path is outside Doorpi-owned storage.", nameof(path));
        return (key, backup);
    }

    public bool Exists(string path)
    {
        var identity = RequirePath(path);
        return WithConnection((connection, transaction) =>
        {
            using var command = Command(connection, transaction,
                "SELECT 1 FROM documents WHERE path=$path" + (identity.Backup ? " AND backup_content IS NOT NULL" : ""), ("$path", identity.Key));
            return command.ExecuteScalar() != null;
        });
    }

    public string ReadAllText(string path)
    {
        var identity = RequirePath(path);
        return WithConnection((connection, transaction) =>
        {
            using var command = Command(connection, transaction, "SELECT " + (identity.Backup ? "backup_content" : "content") + ",kind FROM documents WHERE path=$path", ("$path", identity.Key));
            string content, kind;
            using (var reader = command.ExecuteReader())
            {
                if (!reader.Read() || reader.IsDBNull(0)) throw new FileNotFoundException("Stored state does not exist.", path);
                content = reader.GetString(0); kind = reader.GetString(1);
            }
            if (identity.Backup || kind == "document") return content;
            return ReadCollection(connection, transaction, identity.Key, kind, content);
        });
    }

    public void WriteAllText(string path, string content, bool keepBackup = true)
    {
        var identity = RequirePath(path);
        if (identity.Backup) throw new ArgumentException("Backup versions are managed transactionally, not written separately.", nameof(path));
        Validate(identity.Key, content);
        ExecuteTransaction(() => WriteCore(identity.Key, content, keepBackup));
    }

    internal void WriteCore(string key, string content, bool keepBackup)
    {
        var scope = _transaction ?? throw new InvalidOperationException("A write requires a transaction.");
        string kind = CollectionKind(key);
        string? previous = keepBackup && Exists(Policy.AbsolutePath(key)) ? ReadAllText(Policy.AbsolutePath(key)) : keepBackup ? content : null;
        // Entity rows are the authority. Keep only the document envelope here; previous versions
        // remain an explicit recovery snapshot, never a second live collection.
        string envelope = kind == "document" ? content : kind == "controls" ? ControlEnvelope(content) : kind == "structured" ? StructuredEnvelope(content) : "{}";
        using var command = Command(scope.Connection, scope.Transaction, """
            INSERT INTO documents(path,owner_id,kind,content,backup_content,revision,updated_utc,sha256)
            VALUES($path,$owner,$kind,$content,$backup,1,$now,$hash)
            ON CONFLICT(path) DO UPDATE SET owner_id=excluded.owner_id,kind=excluded.kind,
              backup_content=excluded.backup_content,
              content=excluded.content, revision=documents.revision+1,updated_utc=excluded.updated_utc,sha256=excluded.sha256
            """, ("$path", key), ("$owner", StoragePathPolicy.Owner(key)), ("$kind", kind), ("$content", envelope),
            ("$backup", previous), ("$now", DateTime.UtcNow.ToString("O")), ("$hash", Hash(content)));
        command.ExecuteNonQuery();
        ProjectCollections(scope.Connection, scope.Transaction, key, kind, content);
    }

    public void Delete(string path)
    {
        var identity = RequirePath(path);
        ExecuteTransaction(() =>
        {
            var scope = _transaction!;
            using var command = Command(scope.Connection, scope.Transaction,
                identity.Backup ? "UPDATE documents SET backup_content=NULL WHERE path=$path" : "DELETE FROM documents WHERE path=$path", ("$path", identity.Key));
            command.ExecuteNonQuery();
        });
    }

    public IReadOnlyList<string> EnumeratePaths(string directory, string searchPattern = "*.json", bool recursive = true)
    {
        string prefix = GetDirectoryPrefix(directory);
        return WithConnection((connection, transaction) =>
        {
            using var command = Command(connection, transaction, "SELECT path FROM documents WHERE substr(path,1,$length)=$prefix ORDER BY path", ("$length", prefix.Length), ("$prefix", prefix));
            using var reader = command.ExecuteReader();
            var paths = new List<string>();
            while (reader.Read())
            {
                string key = reader.GetString(0), relative = key[prefix.Length..];
                if ((!recursive && relative.Contains('/')) || !FileSystemName.MatchesSimpleExpression(searchPattern, Path.GetFileName(key), ignoreCase: true)) continue;
                paths.Add(Policy.AbsolutePath(key));
            }
            return (IReadOnlyList<string>)paths;
        });
    }

    public void DeletePrefix(string directory)
    {
        string prefix = GetDirectoryPrefix(directory);
        ExecuteTransaction(() =>
        {
            var scope = _transaction!;
            using var command = Command(scope.Connection, scope.Transaction, "DELETE FROM documents WHERE substr(path,1,$length)=$prefix", ("$length", prefix.Length), ("$prefix", prefix));
            command.ExecuteNonQuery();
        });
    }

    private string GetDirectoryPrefix(string directory)
    {
        string full = Path.GetFullPath(directory).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        string relative = Path.GetRelativePath(Policy.Root, full).Replace('\\', '/').ToLowerInvariant();
        if (relative == ".") return "";
        if (relative == ".." || relative.StartsWith("../", StringComparison.Ordinal) || Path.IsPathRooted(relative)) throw new ArgumentException("Directory is outside the application data root.", nameof(directory));
        return relative + "/";
    }

    public StorageDocumentInfo GetInfo(string path)
    {
        var identity = RequirePath(path);
        return WithConnection((connection, transaction) =>
        {
            using var command = Command(connection, transaction, "SELECT revision,length(CAST(content AS BLOB)),updated_utc,sha256 FROM documents WHERE path=$path", ("$path", identity.Key));
            using var reader = command.ExecuteReader();
            if (!reader.Read()) throw new FileNotFoundException("Stored state does not exist.", path);
            long revision = reader.GetInt64(0);
            DateTime updated = DateTime.Parse(reader.GetString(2), null, System.Globalization.DateTimeStyles.RoundtripKind);
            string hash = reader.GetString(3);
            reader.Close();
            string canonical = ReadAllText(path);
            return new StorageDocumentInfo(path, revision, Encoding.UTF8.GetByteCount(canonical), updated, Hash(canonical));
        });
    }

    public long GetRevision(string path)
    {
        var identity = RequirePath(path);
        return WithConnection((connection, transaction) =>
        {
            using var command = Command(connection, transaction, "SELECT revision FROM documents WHERE path=$path", ("$path", identity.Key));
            return command.ExecuteScalar() is long revision ? revision : 0;
        });
    }

    public StorageSnapshot ReadSnapshot(IEnumerable<string> paths)
    {
        var contents = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        var revisions = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        ExecuteTransaction(() =>
        {
            foreach (string path in paths)
            {
                revisions[path] = GetRevision(path);
                contents[path] = Exists(path) ? ReadAllText(path) : null;
            }
        });
        return new(contents, revisions);
    }

    public void WriteBatchIfRevision(IReadOnlyDictionary<string, string?> writes, IReadOnlyDictionary<string, long> expectedRevisions)
    {
        foreach (var item in writes)
        {
            var identity = RequirePath(item.Key);
            if (identity.Backup && item.Value != null) throw new ArgumentException("Cannot write backup state directly.");
            if (item.Value != null) Validate(identity.Key, item.Value);
        }
        ExecuteTransaction(() =>
        {
            foreach (var expected in expectedRevisions)
            {
                long actual = GetRevision(expected.Key);
                if (actual != expected.Value) throw new StorageConflictException(expected.Key, expected.Value, actual);
            }
            foreach (var item in writes)
                if (item.Value == null) Delete(item.Key); else WriteCore(RequirePath(item.Key).Key, item.Value, keepBackup: true);
        });
    }

    /// <summary>Updates one entity and its indexed columns, with a document revision precondition.</summary>
    public void UpdateCollectionItem(string path, string entityId, string patchJson, long expectedRevision)
    {
        var identity = RequirePath(path);
        string kind = CollectionKind(identity.Key), table = TableForKind(kind);
        if (table == "" || kind == "controls") throw new ArgumentException("Use an atomic control configuration transaction for profiles/bindings/assignments.");
        var patch = JsonNode.Parse(patchJson) as JsonObject ?? throw new ArgumentException("Entity patch must be a JSON object.");
        ExecuteTransaction(() =>
        {
            long actual = GetRevision(path);
            if (actual != expectedRevision) throw new StorageConflictException(path, expectedRevision, actual);
            var scope = _transaction!;
            using var select = Command(scope.Connection, scope.Transaction, $"SELECT payload FROM {table} WHERE source_path=$path AND id=$id", ("$path", identity.Key), ("$id", entityId));
            string payload = select.ExecuteScalar() as string ?? throw new KeyNotFoundException("Entity does not exist.");
            var entity = JsonNode.Parse(payload) as JsonObject ?? throw new InvalidDataException("Invalid entity payload.");
            foreach (var field in patch)
            {
                if (field.Key.Equals("Id", StringComparison.OrdinalIgnoreCase) || field.Key.Equals("OwnerUserId", StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Entity identity and owner cannot be patched.");
                string fieldName = entity.Select(item => item.Key).FirstOrDefault(name => name.Equals(field.Key, StringComparison.OrdinalIgnoreCase)) ?? field.Key;
                entity[fieldName] = field.Value?.DeepClone();
            }
            string typedColumns = kind switch
            {
                "users" or "user" => "name=$name,last_used=$last",
                "games" => "name=$name,executable_path=$executable,launch_url=$url,emulator_id=$emulator,rom_path=$rom,playtime_minutes=$playtime,last_played=$last",
                "game-history" => "name=$name,playtime_minutes=$playtime,last_played=$last",
                "media-history" => "app_id=$app,title=$title,creator=$creator,playback_seconds=$playtime,last_played=$last",
                "entities" => "name=$name",
                _ => throw new InvalidOperationException()
            };
            using var update = Command(scope.Connection, scope.Transaction, $"UPDATE {table} SET payload=$payload,version=version+1,{typedColumns} WHERE source_path=$path AND id=$id",
                ("$path", identity.Key), ("$id", entityId), ("$payload", entity.ToJsonString()), ("$name", Text(entity, "Name")), ("$last", Text(entity, kind is "users" or "user" ? "LastUsed" : "LastPlayed")),
                ("$executable", Text(entity, "Path")), ("$url", Text(entity, "LaunchUrl")), ("$emulator", Text(entity, "EmulatorId")), ("$rom", Text(entity, "RomPath")), ("$playtime", Integer(entity, kind == "media-history" ? "TotalPlaybackSeconds" : "TotalPlaytimeMinutes")),
                ("$app", Text(entity, "AppId")), ("$title", Text(entity, "ContentTitle")), ("$creator", Text(entity, "CreatorName")));
            update.ExecuteNonQuery();
            using var metadata = Command(scope.Connection, scope.Transaction, "UPDATE documents SET revision=revision+1,updated_utc=$now,sha256='' WHERE path=$path", ("$path", identity.Key), ("$now", DateTime.UtcNow.ToString("O")));
            metadata.ExecuteNonQuery();
        });
    }

    public MigrationResult EnsureMigrated()
    {
        lock (_sync)
        {
            if (_migrationReady) return new(true, 0, 0, "");
            using var mutex = new Mutex(false, "DoorpiStorageMigration-" + Hash(Policy.Root.ToLowerInvariant())[..32]);
            bool acquired;
            try { acquired = mutex.WaitOne(TimeSpan.FromSeconds(30)); }
            catch (AbandonedMutexException) { acquired = true; }
            if (!acquired) throw new TimeoutException("Another process is migrating Doorpi storage.");
            try
            {
                bool migrated = WithConnection((connection, transaction) =>
                {
                    using var command = Command(connection, transaction, "SELECT value FROM metadata WHERE name='legacy-import-complete'");
                    return command.ExecuteScalar() != null;
                });
                if (migrated) { _migrationReady = true; return new(true, 0, 0, ""); }
                string directory = Path.Combine(Policy.Root, "storage", "legacy-backups", DateTime.UtcNow.ToString("yyyyMMddTHHmmssfff") + "-" + Guid.NewGuid().ToString("N"));
                StorageMigration.CopyLegacy(Policy, directory);
                var candidates = Policy.EnumerateLegacyCandidates().GroupBy(path => { Policy.TryGetKey(path, out string key, out _); return key; }, StringComparer.OrdinalIgnoreCase).ToList();
                int imported = 0, recovered = 0;
                ExecuteTransaction(() =>
                {
                    foreach (var group in candidates)
                    {
                        string primary = group.FirstOrDefault(path => !path.EndsWith(".bak", StringComparison.OrdinalIgnoreCase)) ?? Policy.AbsolutePath(group.Key);
                        string? chosen = null, content = null;
                        Exception? failure = null;
                        foreach (string candidate in new[] { primary, primary + ".bak" })
                        {
                            if (!File.Exists(candidate)) continue;
                            try { string text = File.ReadAllText(candidate); Validate(group.Key, text); content = text; chosen = candidate; break; }
                            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException or InvalidDataException) { failure = exception; }
                        }
                        if (chosen == null || content == null) throw new StorageMigrationException($"Cannot migrate '{group.Key}': primary and backup are invalid. Original files were retained in '{directory}'.", failure);
                        WriteCore(group.Key, content, keepBackup: true);
                        bool fromBackup = chosen.EndsWith(".bak", StringComparison.OrdinalIgnoreCase);
                        var scope = _transaction!;
                        using var provenance = Command(scope.Connection, scope.Transaction, "INSERT INTO migration_provenance(document_path,source_path,source_sha256,recovered,imported_utc,backup_directory) VALUES($key,$source,$hash,$recovered,$now,$directory)",
                            ("$key", group.Key), ("$source", chosen), ("$hash", Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(chosen))).ToLowerInvariant()), ("$recovered", fromBackup ? 1 : 0), ("$now", DateTime.UtcNow.ToString("O")), ("$directory", directory));
                        provenance.ExecuteNonQuery(); imported++; if (fromBackup) recovered++;
                    }
                    var current = _transaction!;
                    using var marker = Command(current.Connection, current.Transaction, "INSERT INTO metadata(name,value) VALUES('legacy-import-complete',$now)", ("$now", DateTime.UtcNow.ToString("O")));
                    marker.ExecuteNonQuery();
                });
                if (CheckIntegrity() != "ok") throw new StorageMigrationException("Storage failed integrity verification after import.");
                _migrationReady = true;
                return new(false, imported, recovered, directory);
            }
            finally { mutex.ReleaseMutex(); }
        }
    }

    internal void RemoveDatabaseForRollback()
    {
        lock (_sync)
        {
            if (_transaction != null) throw new InvalidOperationException("Cannot remove an active transaction database.");
            foreach (string suffix in new[] { "", "-wal", "-shm", "-journal" })
                if (File.Exists(DatabasePath + suffix)) File.Delete(DatabasePath + suffix);
            _migrationReady = false;
        }
    }

    public IReadOnlyList<StorageEntity> ReadEntities(string path)
    {
        var identity = RequirePath(path);
        string kind = CollectionKind(identity.Key), table = TableForKind(kind);
        if (table == "") throw new ArgumentException("Path does not contain a normalized entity collection.", nameof(path));
        return WithConnection((connection, transaction) =>
        {
            using var command = Command(connection, transaction, $"SELECT id,owner_id,ordinal,payload FROM {table} WHERE source_path=$path ORDER BY ordinal", ("$path", identity.Key));
            using var reader = command.ExecuteReader();
            var entities = new List<StorageEntity>();
            while (reader.Read()) entities.Add(new(reader.GetString(0), reader.GetString(1), reader.GetInt32(2), reader.GetString(3)));
            return (IReadOnlyList<StorageEntity>)entities;
        });
    }

    /// <summary>Reads canonical rows and their concurrency token without rebuilding a JSON collection.</summary>
    public StorageEntitySnapshot ReadEntitySnapshot(string path)
    {
        var identity = RequirePath(path);
        string table = TableForKind(CollectionKind(identity.Key));
        if (table == "" || table == "control_profiles")
            throw new ArgumentException("Path must contain a flat normalized entity collection.", nameof(path));
        return WithConnection((connection, ambient) =>
        {
            // A deferred read transaction keeps revision and rows consistent without
            // reserving the database's writer slot merely to load a library.
            using var owned = ambient == null ? connection.BeginTransaction(deferred: true) : null;
            var transaction = ambient ?? owned!;
            using var revisionCommand = Command(connection, transaction, "SELECT revision FROM documents WHERE path=$path", ("$path", identity.Key));
            long revision = revisionCommand.ExecuteScalar() is long value ? value : 0;
            using var command = Command(connection, transaction, $"SELECT id,owner_id,ordinal,payload FROM {table} WHERE source_path=$path ORDER BY ordinal", ("$path", identity.Key));
            var entities = new List<StorageEntity>();
            using (var reader = command.ExecuteReader())
                while (reader.Read()) entities.Add(new(reader.GetString(0), reader.GetString(1), reader.GetInt32(2), reader.GetString(3)));
            owned?.Commit();
            return new StorageEntitySnapshot(revision, entities);
        });
    }

    public void BackupTo(string destination)
    {
        if (Path.GetFullPath(destination).Equals(DatabasePath, StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Backup path must differ from the active database.", nameof(destination));
        lock (_sync)
        {
            if (_transaction != null) throw new InvalidOperationException("Cannot back up during a write transaction.");
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(destination))!);
            // A pre-update checkpoint must preserve the old schema, not upgrade it.
            using var source = Open(initialize: false);
            using var target = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = destination, Mode = SqliteOpenMode.ReadWriteCreate, Pooling = false }.ToString());
            target.Open();
            source.BackupDatabase(target);
            using var command = target.CreateCommand();
            command.CommandText = "PRAGMA integrity_check";
            if (!string.Equals(command.ExecuteScalar() as string, "ok", StringComparison.Ordinal)) throw new InvalidDataException("SQLite backup integrity check failed.");
        }
    }

    public void RestoreFrom(string source)
    {
        lock (_sync)
        {
            if (_transaction != null) throw new InvalidOperationException("Cannot restore during a write transaction.");
            using var backup = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = source, Mode = SqliteOpenMode.ReadOnly, Pooling = false }.ToString());
            backup.Open();
            using (var command = backup.CreateCommand())
            {
                command.CommandText = "PRAGMA integrity_check";
                if (!string.Equals(command.ExecuteScalar() as string, "ok", StringComparison.Ordinal)) throw new InvalidDataException("Cannot restore a corrupt SQLite backup.");
            }
            using var target = Open(initialize: false);
            backup.BackupDatabase(target);
            _migrationReady = false;
        }
    }

    public string CheckIntegrity() => WithConnection((connection, transaction) =>
    {
        using var command = Command(connection, transaction, "PRAGMA integrity_check");
        string result = command.ExecuteScalar() as string ?? "unknown";
        using var foreignKeys = Command(connection, transaction, "PRAGMA foreign_key_check");
        using var reader = foreignKeys.ExecuteReader();
        return reader.Read() ? "foreign key violation" : result;
    });

    internal static string Hash(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text))).ToLowerInvariant();
    internal static void Validate(string key, string content)
    {
        ArgumentNullException.ThrowIfNull(content);
        if (content.IndexOf('\0') >= 0) throw new InvalidDataException("State contains NUL bytes.");
        if (!StoragePathPolicy.IsJsonKey(key)) return;
        using var json = JsonDocument.Parse(content);
        string kind = CollectionKind(key);
        JsonValueKind expected = kind is "users" or "games" or "game-history" or "media-history" or "entities" ? JsonValueKind.Array : JsonValueKind.Undefined;
        if (expected != JsonValueKind.Undefined && json.RootElement.ValueKind != expected) throw new InvalidDataException($"State '{key}' must be an array.");
        if (kind is "user" or "controls" or "structured" && json.RootElement.ValueKind != JsonValueKind.Object) throw new InvalidDataException($"State '{key}' must be an object.");
        if (IsAppCache(key))
            foreach (var collection in json.RootElement.EnumerateObject().Where(property => AppCollections.Contains(property.Name)))
            {
                if (collection.Value.ValueKind == JsonValueKind.Null) continue;
                if (collection.Value.ValueKind != JsonValueKind.Array || collection.Value.EnumerateArray().Any(item => item.ValueKind != JsonValueKind.Object))
                    throw new InvalidDataException("Installed application collections must contain objects.");
                foreach (var item in collection.Value.EnumerateArray())
                    foreach (string field in new[] { "Name", "Path", "LaunchUrl", "Source", "IconBase64" })
                        if (item.TryGetProperty(field, out var value) && value.ValueKind is not (JsonValueKind.String or JsonValueKind.Null))
                            throw new InvalidDataException("Invalid application cache field: " + field);
            }
        if (expected == JsonValueKind.Array && kind != "entities" && json.RootElement.EnumerateArray().Any(item => item.ValueKind != JsonValueKind.Object)) throw new InvalidDataException($"State '{key}' contains a non-object entity.");
        if (expected == JsonValueKind.Array) ValidateExplicitIds(json.RootElement, key);
        string owner = StoragePathPolicy.Owner(key);
        if (owner.Length > 0)
        {
            if (kind == "user")
                foreach (var property in json.RootElement.EnumerateObject().Where(property => property.Name.Equals("Id", StringComparison.OrdinalIgnoreCase)))
                    if (property.Value.ValueKind == JsonValueKind.String && property.Value.GetString() is { Length: > 0 } userId && !userId.Equals(owner, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("Profile entity ID does not match the target profile path.");
            IEnumerable<JsonElement> records = expected == JsonValueKind.Array ? json.RootElement.EnumerateArray().ToArray() : new[] { json.RootElement };
            foreach (var record in records.Where(record => record.ValueKind == JsonValueKind.Object))
                foreach (var property in record.EnumerateObject().Where(property => property.Name.Equals("OwnerUserId", StringComparison.OrdinalIgnoreCase)))
                    if (property.Value.ValueKind == JsonValueKind.String && property.Value.GetString() is { Length: > 0 } recordOwner && !recordOwner.Equals(owner, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("Entity owner does not match the target profile path.");
        }
        if (kind == "controls")
        {
            foreach (var property in json.RootElement.EnumerateObject())
            {
                if (!property.Name.Equals("Profiles", StringComparison.OrdinalIgnoreCase) && !property.Name.Equals("Assignments", StringComparison.OrdinalIgnoreCase)) continue;
                if (property.Value.ValueKind == JsonValueKind.Null) continue; // Optional in older schemas.
                if (property.Value.ValueKind != JsonValueKind.Array) throw new InvalidDataException("Control collections must be arrays.");
                ValidateExplicitIds(property.Value, key);
                foreach (var profile in property.Value.EnumerateArray())
                {
                    if (profile.ValueKind != JsonValueKind.Object) throw new InvalidDataException("Control entities must be objects.");
                    if (owner.Length > 0)
                        foreach (var identity in profile.EnumerateObject().Where(field => field.Name.Equals("OwnerUserId", StringComparison.OrdinalIgnoreCase)))
                            if (identity.Value.ValueKind == JsonValueKind.String && identity.Value.GetString() is { Length: > 0 } profileOwner && !profileOwner.Equals(owner, StringComparison.OrdinalIgnoreCase))
                                throw new InvalidDataException("Control profile owner does not match the target profile path.");
                    foreach (var field in profile.EnumerateObject().Where(field => field.Name.Equals("Bindings", StringComparison.OrdinalIgnoreCase)))
                    {
                        if (field.Value.ValueKind == JsonValueKind.Null) continue;
                        if (field.Value.ValueKind != JsonValueKind.Array) throw new InvalidDataException("Control bindings must be an array.");
                        ValidateExplicitIds(field.Value, key);
                    }
                }
            }
        }
    }

    private static void ValidateExplicitIds(JsonElement array, string key)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in array.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object) continue;
            foreach (var property in item.EnumerateObject().Where(property => property.Name.Equals("Id", StringComparison.OrdinalIgnoreCase)))
            {
                if (property.Value.ValueKind != JsonValueKind.String) continue;
                string? id = property.Value.GetString();
                if (!string.IsNullOrEmpty(id) && !seen.Add(id)) throw new InvalidDataException($"Duplicate explicit entity ID in '{key}'.");
            }
        }
    }

    private static string CollectionKind(string key)
    {
        string filename = Path.GetFileName(key);
        if (key.Contains("/sync-backups/", StringComparison.Ordinal)) return "document";
        return filename switch
        {
            "users.json" => "users", "user.json" => "user", "games.json" => "games",
            "game-history.json" => "game-history", "media-history.json" => "media-history", "controls.json" => "controls",
            "media.json" or "folders.json" or "stores.json" or "emulators.json" or "emulator-game-suppressions.json" or
            "browser-downloads.json" or "profiles-v2.json" or "extensions.json" => "entities",
            "appcache.json" or "web-permissions.json" or "browser-settings.json" or "library-bootstrap.json" => "structured", _ => "document"
        };
    }
    private static string TableForKind(string kind) => kind switch { "users" or "user" => "users", "games" => "games", "game-history" => "game_history", "media-history" => "media_history", "controls" => "control_profiles", "entities" => "entities", _ => "" };

    private static string ControlEnvelope(string content)
    {
        var envelope = JsonNode.Parse(content) as JsonObject ?? throw new InvalidDataException("Invalid control document.");
        foreach (string key in envelope.Select(item => item.Key).Where(name => name.Equals("Profiles", StringComparison.OrdinalIgnoreCase) || name.Equals("Assignments", StringComparison.OrdinalIgnoreCase)).ToArray()) envelope.Remove(key);
        return envelope.ToJsonString();
    }

    private static string StructuredEnvelope(string content)
    {
        var envelope = JsonNode.Parse(content) as JsonObject ?? throw new InvalidDataException("Invalid structured state document.");
        foreach (string key in envelope.Where(item => item.Value is JsonArray).Select(item => item.Key).ToArray()) envelope[key] = new JsonArray();
        return envelope.ToJsonString();
    }

    private static JsonNode? Property(JsonNode? node, string name) => node is JsonObject obj ? obj.FirstOrDefault(property => property.Key.Equals(name, StringComparison.OrdinalIgnoreCase)).Value : null;
    private static string Text(JsonNode? node, string name) => Property(node, name)?.ToString() ?? "";
    private static long Integer(JsonNode? node, string name) => long.TryParse(Text(node, name), out long number) ? Math.Max(0, number) : 0;
    private static string Identity(JsonNode? node, string kind, string sourceKey)
    {
        string candidate = Text(node, "Id");
        if (candidate.Length > 0) return candidate;
        string identity = kind switch
        {
            "games" => string.Join('\u001f', Text(node, "Path"), Text(node, "LaunchUrl"), Text(node, "EmulatorId"), Text(node, "RomPath")),
            "game-history" => Text(node, "Name"),
            "media-history" => string.Join('\u001f', Text(node, "AppId"), Text(node, "ContentTitle"), Text(node, "CreatorName")),
            "assignment" => string.Join('\u001f', Text(node, "TargetKind"), Text(node, "TargetId"), Text(node, "TargetFingerprint"), Text(node, "ProfileId")),
            _ => node?.ToJsonString() ?? "null"
        };
        string id = "entity-" + Hash(sourceKey + "\u001f" + identity.ToLowerInvariant())[..32];
        if (node is JsonObject entity)
        {
            string idKey = entity.Select(item => item.Key).FirstOrDefault(name => name.Equals("Id", StringComparison.OrdinalIgnoreCase)) ?? "Id";
            entity[idKey] = id;
        }
        return id;
    }

    private static void ProjectCollections(SqliteConnection connection, SqliteTransaction transaction, string key, string kind, string content)
    {
        if (kind == "structured")
        {
            using var clear = Command(connection, transaction, "DELETE FROM nested_entities WHERE source_path=$path", ("$path", key)); clear.ExecuteNonQuery();
            var rootObject = JsonNode.Parse(content) as JsonObject ?? throw new InvalidDataException("Invalid structured state.");
            foreach (var property in rootObject.Where(item => item.Value is JsonArray))
            {
                if (IsAppCache(key) && AppCollections.Contains(property.Key)) continue;
                int itemOrdinal = 0;
                var keys = new HashSet<string>(StringComparer.Ordinal);
                foreach (JsonNode? item in (JsonArray)property.Value!)
                {
                    string id = Identity(item, "nested", key + "/" + property.Key), original = id;
                    int duplicate = 1;
                    while (!keys.Add(id)) id = original + "-duplicate-" + duplicate++;
                    using var insert = Command(connection, transaction, "INSERT INTO nested_entities(source_path,collection_name,id,owner_id,ordinal,payload) VALUES($path,$collection,$id,$owner,$ordinal,$payload)",
                        ("$path", key), ("$collection", property.Key), ("$id", id), ("$owner", StoragePathPolicy.Owner(key)), ("$ordinal", itemOrdinal++), ("$payload", item?.ToJsonString() ?? "null"));
                    insert.ExecuteNonQuery();
                }
            }
            if (IsAppCache(key)) ProjectInstalledApps(connection, transaction, key, rootObject);
            return;
        }
        string table = TableForKind(kind);
        if (table == "") return;
        // Controls still use the validated aggregate replacement path. Other collections
        // retain existing rows: a full import must not rewrite every unchanged entity.
        foreach (string clearTable in kind == "controls" ? new[] { "control_profiles", "control_assignments" } : Array.Empty<string>())
        {
            using var clear = Command(connection, transaction, $"DELETE FROM {clearTable} WHERE source_path=$path", ("$path", key)); clear.ExecuteNonQuery();
        }
        JsonNode root = JsonNode.Parse(content)!;
        IEnumerable<JsonNode?> entities = kind == "user" ? new[] { root } : kind == "controls" ? (IEnumerable<JsonNode?>)(Property(root, "Profiles") as JsonArray ?? new JsonArray()) : (JsonArray)root;
        int ordinal = 0;
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (JsonNode? entity in entities)
        {
            if (entity is not JsonObject && kind != "entities") throw new InvalidDataException("Normalized collection contains an invalid entity.");
            bool explicitId = Text(entity, "Id").Length > 0;
            string id = Identity(entity, kind, key), owner = StoragePathPolicy.Owner(key);
            if (!ids.Add(id))
            {
                if (explicitId) throw new InvalidDataException($"Duplicate explicit entity ID in '{key}'.");
                // Preserve ambiguous legacy duplicates with persisted IDs and record the decision.
                string original = id; int duplicate = 1;
                while (!ids.Add(id = original + "-duplicate-" + duplicate++)) { }
                if (entity is JsonObject duplicateObject) duplicateObject["Id"] = id;
                using var conflict = Command(connection, transaction, "INSERT OR REPLACE INTO identity_conflicts(source_path,entity_id,ordinal,reason) VALUES($path,$id,$ordinal,'Duplicate natural identity preserved with persistent disambiguator')", ("$path", key), ("$id", id), ("$ordinal", ordinal));
                conflict.ExecuteNonQuery();
            }
            JsonNode? payloadEntity = entity;
            if (kind == "controls" && entity is JsonObject profile)
            {
                var metadata = (JsonObject)profile.DeepClone();
                foreach (string name in metadata.Select(item => item.Key).Where(name => name.Equals("Bindings", StringComparison.OrdinalIgnoreCase)).ToArray()) metadata[name] = new JsonArray();
                payloadEntity = metadata;
            }
            string payload = payloadEntity?.ToJsonString() ?? "null";
            var parameters = new List<(string, object?)> { ("$path", key), ("$id", id), ("$owner", owner), ("$ordinal", ordinal++), ("$payload", payload) };
            string columns, values;
            switch (kind)
            {
                case "users": case "user":
                    columns = "name,last_used"; values = "$name,$last";
                    parameters.Add(("$name", Text(entity, "Name"))); parameters.Add(("$last", Text(entity, "LastUsed"))); break;
                case "games":
                    columns = "name,executable_path,launch_url,emulator_id,rom_path,playtime_minutes,last_played"; values = "$name,$executable,$url,$emulator,$rom,$playtime,$last";
                    parameters.AddRange(new (string, object?)[] { ("$name", Text(entity, "Name")), ("$executable", Text(entity, "Path")), ("$url", Text(entity, "LaunchUrl")), ("$emulator", Text(entity, "EmulatorId")), ("$rom", Text(entity, "RomPath")), ("$playtime", Integer(entity, "TotalPlaytimeMinutes")), ("$last", Text(entity, "LastPlayed")) }); break;
                case "game-history":
                    columns = "name,playtime_minutes,last_played"; values = "$name,$playtime,$last";
                    parameters.AddRange(new (string, object?)[] { ("$name", Text(entity, "Name")), ("$playtime", Integer(entity, "TotalPlaytimeMinutes")), ("$last", Text(entity, "LastPlayed")) }); break;
                case "media-history":
                    columns = "app_id,title,creator,playback_seconds,last_played"; values = "$app,$title,$creator,$playtime,$last";
                    parameters.AddRange(new (string, object?)[] { ("$app", Text(entity, "AppId")), ("$title", Text(entity, "ContentTitle")), ("$creator", Text(entity, "CreatorName")), ("$playtime", Integer(entity, "TotalPlaybackSeconds")), ("$last", Text(entity, "LastPlayed")) }); break;
                case "controls":
                    columns = "name,base_profile_id,enabled"; values = "$name,$base,$enabled";
                    parameters.AddRange(new (string, object?)[] { ("$name", Text(entity, "Name")), ("$base", Text(entity, "BaseProfileId")), ("$enabled", Text(entity, "Enabled").Equals("false", StringComparison.OrdinalIgnoreCase) ? 0 : 1) }); break;
                case "entities":
                    columns = "name,entity_kind"; values = "$name,$entitykind";
                    parameters.AddRange(new (string, object?)[] { ("$name", Text(entity, "Name")), ("$entitykind", Path.GetFileName(key)) }); break;
                default: throw new InvalidOperationException();
            }
            string updateColumns = "owner_id,ordinal," + columns + ",payload";
            string updates = string.Join(",", updateColumns.Split(',').Select(column => $"{column}=excluded.{column}"));
            string onConflict = kind == "controls" ? "" :
                $" ON CONFLICT(source_path,id) DO UPDATE SET {updates},version={table}.version+1 WHERE {table}.payload IS NOT excluded.payload OR {table}.ordinal IS NOT excluded.ordinal";
            using var command = Command(connection, transaction, $"INSERT INTO {table}(source_path,id,owner_id,ordinal,{columns},payload) VALUES($path,$id,$owner,$ordinal,{values},$payload){onConflict}", parameters.ToArray());
            command.ExecuteNonQuery();
            if (kind != "controls") continue;
            int bindingOrdinal = 0;
            foreach (JsonNode? binding in Property(entity, "Bindings") as JsonArray ?? new JsonArray())
            {
                if (binding is not JsonObject) throw new InvalidDataException("Control binding must be an object.");
                string bindingId = Identity(binding, "binding", key + "/" + id);
                using var insert = Command(connection, transaction, "INSERT INTO control_bindings(source_path,profile_id,id,ordinal,trigger_kind,action_kind,enabled,payload) VALUES($path,$profile,$id,$ordinal,$trigger,$action,$enabled,$payload)",
                    ("$path", key), ("$profile", id), ("$id", bindingId), ("$ordinal", bindingOrdinal++), ("$trigger", Text(binding, "Trigger")), ("$action", Text(Property(binding, "Action"), "Type")), ("$enabled", Text(binding, "Enabled").Equals("false", StringComparison.OrdinalIgnoreCase) ? 0 : 1), ("$payload", binding.ToJsonString()));
                insert.ExecuteNonQuery();
            }
        }
        if (kind != "controls")
        {
            // One bounded JSON parameter avoids SQLite's parameter-count limit for large libraries.
            using var removed = Command(connection, transaction,
                $"DELETE FROM {table} WHERE source_path=$path AND id NOT IN (SELECT value FROM json_each($ids))",
                ("$path", key), ("$ids", JsonSerializer.Serialize(ids)));
            removed.ExecuteNonQuery();
            return;
        }
        ordinal = 0;
        foreach (JsonNode? assignment in Property(root, "Assignments") as JsonArray ?? new JsonArray())
        {
            if (assignment is not JsonObject) throw new InvalidDataException("Control assignment must be an object.");
            using var insert = Command(connection, transaction, "INSERT INTO control_assignments(source_path,id,owner_id,ordinal,profile_id,target_kind,target_id,target_fingerprint,payload) VALUES($path,$id,$owner,$ordinal,$profile,$kind,$target,$fingerprint,$payload)",
                ("$path", key), ("$id", Identity(assignment, "assignment", key)), ("$owner", StoragePathPolicy.Owner(key)), ("$ordinal", ordinal++), ("$profile", Text(assignment, "ProfileId")), ("$kind", Text(assignment, "TargetKind")), ("$target", Text(assignment, "TargetId")), ("$fingerprint", Text(assignment, "TargetFingerprint")), ("$payload", assignment.ToJsonString()));
            insert.ExecuteNonQuery();
        }
    }

    private static string ReadCollection(SqliteConnection connection, SqliteTransaction? transaction, string key, string kind, string document)
    {
        if (kind == "structured")
        {
            var result = JsonNode.Parse(document) as JsonObject ?? throw new InvalidDataException("Invalid structured state envelope.");
            using var nested = Command(connection, transaction, "SELECT collection_name,payload FROM nested_entities WHERE source_path=$path ORDER BY collection_name,ordinal", ("$path", key));
            using var rows = nested.ExecuteReader();
            while (rows.Read())
            {
                string name = rows.GetString(0);
                if (result[name] is not JsonArray) result[name] = new JsonArray();
                ((JsonArray)result[name]!).Add(JsonNode.Parse(rows.GetString(1)));
            }
            rows.Close();
            if (IsAppCache(key))
            {
                using var apps = Command(connection, transaction, "SELECT collection_name,payload FROM installed_apps WHERE source_path=$path ORDER BY collection_name,ordinal", ("$path", key));
                using var appRows = apps.ExecuteReader();
                while (appRows.Read())
                {
                    string name = appRows.GetString(0);
                    if (result[name] is not JsonArray) result[name] = new JsonArray();
                    ((JsonArray)result[name]!).Add(JsonNode.Parse(appRows.GetString(1)));
                }
            }
            return result.ToJsonString();
        }
        string table = TableForKind(kind);
        using var command = Command(connection, transaction, $"SELECT payload FROM {table} WHERE source_path=$path ORDER BY ordinal", ("$path", key));
        var entities = new JsonArray();
        using (var reader = command.ExecuteReader()) while (reader.Read()) entities.Add(JsonNode.Parse(reader.GetString(0)));
        if (kind == "user") return entities.Count == 1 ? entities[0]!.ToJsonString() : throw new InvalidDataException("Profile entity is missing.");
        if (kind != "controls") return entities.ToJsonString();
        var bindingsByProfile = new Dictionary<string, JsonArray>(StringComparer.Ordinal);
        using (var bindings = Command(connection, transaction, "SELECT profile_id,payload FROM control_bindings WHERE source_path=$path ORDER BY profile_id,ordinal", ("$path", key)))
        using (var reader = bindings.ExecuteReader())
            while (reader.Read())
            {
                string id = reader.GetString(0);
                if (!bindingsByProfile.TryGetValue(id, out var items)) bindingsByProfile[id] = items = new JsonArray();
                items.Add(JsonNode.Parse(reader.GetString(1)));
            }
        foreach (JsonNode? profile in entities)
        {
            if (profile is not JsonObject profileObject) throw new InvalidDataException("Invalid stored control profile.");
            string bindingKey = profileObject.Select(pair => pair.Key).FirstOrDefault(name => name.Equals("Bindings", StringComparison.OrdinalIgnoreCase)) ?? "Bindings";
            profileObject[bindingKey] = bindingsByProfile.GetValueOrDefault(Text(profile, "Id")) ?? new JsonArray();
        }
        JsonObject root = JsonNode.Parse(document) as JsonObject ?? throw new InvalidDataException("Control configuration root is invalid.");
        string profilesKey = root.Select(pair => pair.Key).FirstOrDefault(name => name.Equals("Profiles", StringComparison.OrdinalIgnoreCase)) ?? "Profiles";
        string assignmentsKey = root.Select(pair => pair.Key).FirstOrDefault(name => name.Equals("Assignments", StringComparison.OrdinalIgnoreCase)) ?? "Assignments";
        root[profilesKey] = entities;
        using var assignments = Command(connection, transaction, "SELECT payload FROM control_assignments WHERE source_path=$path ORDER BY ordinal", ("$path", key));
        var assignmentArray = new JsonArray();
        using (var reader = assignments.ExecuteReader()) while (reader.Read()) assignmentArray.Add(JsonNode.Parse(reader.GetString(0)));
        root[assignmentsKey] = assignmentArray;
        return root.ToJsonString();
    }
}
