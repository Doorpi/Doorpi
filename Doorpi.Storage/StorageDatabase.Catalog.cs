using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;

namespace Doorpi.Storage;

public sealed record AppCacheSnapshot(long Revision, string MetadataJson,
    IReadOnlyDictionary<string, IReadOnlyList<string>> Collections);

public sealed partial class StorageDatabase
{
    private static readonly HashSet<string> AppCollections = new(StringComparer.Ordinal)
    {
        "WindowsApps", "FolderApps", "SteamApps", "EpicApps", "GogApps", "RiotApps", "XboxApps", "MicrosoftStoreApps"
    };

    private static bool IsAppCache(string key) => Path.GetFileName(key) == "appcache.json";

    private static void UpgradeCatalogSchema(SqliteConnection connection, SqliteTransaction transaction)
    {
        using var create = Command(connection, transaction, """
            CREATE TABLE IF NOT EXISTS installed_apps(
              source_path TEXT NOT NULL, collection_name TEXT NOT NULL, id TEXT NOT NULL,
              owner_id TEXT NOT NULL, ordinal INTEGER NOT NULL, name TEXT NOT NULL,
              search_name TEXT NOT NULL, source TEXT NOT NULL, executable_path TEXT NOT NULL,
              launch_url TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
              payload TEXT NOT NULL CHECK(json_valid(payload)),
              PRIMARY KEY(source_path,collection_name,id),
              FOREIGN KEY(source_path,owner_id) REFERENCES documents(path,owner_id) ON DELETE CASCADE);
            CREATE INDEX IF NOT EXISTS installed_apps_order ON installed_apps(source_path,collection_name,ordinal);
            CREATE INDEX IF NOT EXISTS installed_apps_search ON installed_apps(source_path,search_name);
            CREATE INDEX IF NOT EXISTS installed_apps_path ON installed_apps(source_path,executable_path);
            """);
        create.ExecuteNonQuery();
        var legacy = new List<(string Key, string Content)>();
        using (var select = Command(connection, transaction, "SELECT path,content FROM documents WHERE kind='structured' AND (path='data/appcache.json' OR path LIKE 'data/users/%/appcache.json')"))
        using (var reader = select.ExecuteReader())
            while (reader.Read()) legacy.Add((reader.GetString(0), reader.GetString(1)));
        foreach (var document in legacy)
        {
            // Read schema-1 canonical arrays before removing their old rows. The
            // complete upgrade and user_version change share the same transaction.
            var content = JsonNode.Parse(ReadCollection(connection, transaction, document.Key, "structured", document.Content)) as JsonObject
                ?? throw new InvalidDataException("Invalid legacy application cache.");
            Validate(document.Key, content.ToJsonString());
            ProjectInstalledApps(connection, transaction, document.Key, content);
            using var remove = Command(connection, transaction,
                "DELETE FROM nested_entities WHERE source_path=$path AND collection_name IN (SELECT value FROM json_each($collections))",
                ("$path", document.Key), ("$collections", JsonSerializer.Serialize(AppCollections)));
            remove.ExecuteNonQuery();
        }
        using var version = Command(connection, transaction, "PRAGMA user_version=2");
        version.ExecuteNonQuery();
    }

    private static void ProjectInstalledApps(SqliteConnection connection, SqliteTransaction transaction, string key, JsonObject root)
    {
        var retained = new List<string>();
        foreach (string collection in AppCollections)
        {
            JsonNode? value = root[collection];
            if (value == null) continue; // Older caches omit stores not yet supported.
            if (value is not JsonArray apps) throw new InvalidDataException("Installed application collections must be arrays.");
            var identities = new HashSet<string>(StringComparer.Ordinal);
            int ordinal = 0;
            foreach (JsonNode? app in apps)
            {
                if (app is not JsonObject) throw new InvalidDataException("Installed application must be an object.");
                string path = Text(app, "Path"), url = Text(app, "LaunchUrl"), name = Text(app, "Name");
                // Scope identity to this machine's cache and source. Never use it as
                // the cloud's historical GameKey or as a cross-device library ID.
                string natural = path.Length > 0 ? path.Replace('\\', '/').ToUpperInvariant() : url.Length > 0 ? url : name.ToUpperInvariant();
                string original = Hash(collection + "\n" + natural), id = original;
                int duplicate = 1;
                while (!identities.Add(id)) id = original + "-duplicate-" + duplicate++;
                retained.Add(collection + "/" + id);
                using var upsert = Command(connection, transaction, """
                    INSERT INTO installed_apps(source_path,collection_name,id,owner_id,ordinal,name,search_name,source,executable_path,launch_url,payload)
                    VALUES($path,$collection,$id,$owner,$ordinal,$name,$search,$source,$exe,$url,$payload)
                    ON CONFLICT(source_path,collection_name,id) DO UPDATE SET
                      ordinal=excluded.ordinal,name=excluded.name,search_name=excluded.search_name,
                      source=excluded.source,executable_path=excluded.executable_path,launch_url=excluded.launch_url,
                      payload=excluded.payload,version=installed_apps.version+1
                    WHERE installed_apps.payload IS NOT excluded.payload OR installed_apps.ordinal IS NOT excluded.ordinal
                    """, ("$path", key), ("$collection", collection), ("$id", id), ("$owner", StoragePathPolicy.Owner(key)),
                    ("$ordinal", ordinal++), ("$name", name), ("$search", name.ToUpperInvariant()),
                    ("$source", Text(app, "Source")), ("$exe", path), ("$url", url), ("$payload", app.ToJsonString()));
                upsert.ExecuteNonQuery();
            }
        }
        using var removed = Command(connection, transaction,
            "DELETE FROM installed_apps WHERE source_path=$path AND collection_name || '/' || id NOT IN (SELECT value FROM json_each($ids))",
            ("$path", key), ("$ids", JsonSerializer.Serialize(retained)));
        removed.ExecuteNonQuery();
    }

    public AppCacheSnapshot ReadAppCacheSnapshot(string path)
    {
        var identity = RequirePath(path);
        if (identity.Backup || !IsAppCache(identity.Key)) throw new ArgumentException("Expected an active local application cache.", nameof(path));
        return WithConnection((connection, ambient) =>
        {
            using var owned = ambient == null ? connection.BeginTransaction(deferred: true) : null;
            var transaction = ambient ?? owned!;
            long revision = 0;
            string metadata = "{}";
            using (var document = Command(connection, transaction, "SELECT revision,content FROM documents WHERE path=$path", ("$path", identity.Key)))
            using (var reader = document.ExecuteReader())
                if (reader.Read()) { revision = reader.GetInt64(0); metadata = reader.GetString(1); }
            var collections = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
            var lists = new Dictionary<string, List<string>>(StringComparer.Ordinal);
            using (var rows = Command(connection, transaction, """
                SELECT collection_name,payload,ordinal FROM nested_entities WHERE source_path=$path
                UNION ALL SELECT collection_name,payload,ordinal FROM installed_apps WHERE source_path=$path
                ORDER BY collection_name,ordinal
                """, ("$path", identity.Key)))
            using (var reader = rows.ExecuteReader())
                while (reader.Read())
                {
                    string name = reader.GetString(0);
                    if (!lists.TryGetValue(name, out var items)) lists[name] = items = new();
                    items.Add(reader.GetString(1));
                }
            foreach (var pair in lists) collections[pair.Key] = pair.Value;
            owned?.Commit();
            return new AppCacheSnapshot(revision, metadata, collections);
        });
    }
}
