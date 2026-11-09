namespace Doorpi.Storage;

/// <summary>Only Doorpi-owned state is eligible. Chromium, ROMs and package manifests are never imported.</summary>
public sealed class StoragePathPolicy
{
    private static readonly HashSet<string> DataDocuments = new(StringComparer.OrdinalIgnoreCase)
    {
        "users.json", "user.json", "current-user.json", "games.json", "game-history.json",
        "media-history.json", "folders.json", "appcache.json", "media.json", "stores.json",
        "messages.json", "library-bootstrap.json", "display-settings.json", "controls.json",
        "emulators.json", "emulator-game-suppressions.json", "browser-downloads.json",
        "browser-settings.json", "web-permissions.json", "gpu-updaters.json", "storage-cache.json",
        "windows-update-state.json", "active-gameplay-session.json",
        "media-metadata-probe.json", "media-network-probe.json", "device-id.txt"
    };
    private static readonly HashSet<string> UserDocuments = new(DataDocuments, StringComparer.OrdinalIgnoreCase)
    {
        "profile-sync-state.json", "profile-sync-base.json", "profile-sync-pending-remote.json",
        "profile-sync-operation.json"
    };
    private static readonly HashSet<string> UpdateDocuments = new(StringComparer.OrdinalIgnoreCase)
    {
        // state/manifest-state/manifest-cache are physical bootstrap contracts shared with old updaters.
        "windows-update-state.json"
    };

    public StoragePathPolicy(string appDataFolder)
    {
        Root = Path.GetFullPath(appDataFolder).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        RootPrefix = Root + Path.DirectorySeparatorChar;
    }

    public string Root { get; }
    private string RootPrefix { get; }

    public bool TryGetKey(string path, out string key, out bool backup)
    {
        key = "";
        backup = false;
        if (string.IsNullOrWhiteSpace(path)) return false;
        string full;
        try { full = Path.GetFullPath(path); }
        catch (Exception exception) when (exception is ArgumentException or NotSupportedException or PathTooLongException) { return false; }
        if (!full.StartsWith(RootPrefix, StringComparison.OrdinalIgnoreCase)) return false;
        string relative = full[RootPrefix.Length..].Replace('\\', '/');
        if (relative.EndsWith(".bak", StringComparison.OrdinalIgnoreCase))
        {
            relative = relative[..^4];
            backup = true;
        }
        string[] parts = relative.Split('/');
        bool allowed = parts.Length == 1 && parts[0].Equals("update-settings.json", StringComparison.OrdinalIgnoreCase);
        allowed |= parts.Length == 2 && parts[0].Equals("updates", StringComparison.OrdinalIgnoreCase) && UpdateDocuments.Contains(parts[1]);
        if (parts.Length > 1 && parts[0].Equals("Data", StringComparison.OrdinalIgnoreCase))
        {
            string[] data = parts[1..];
            allowed |= data.Length == 1 && DataDocuments.Contains(data[0]);
            allowed |= data.Length == 3 && data[0].Equals("users", StringComparison.OrdinalIgnoreCase) &&
                UserDocuments.Contains(data[2]);
            allowed |= data.Length == 5 && data[0].Equals("users", StringComparison.OrdinalIgnoreCase) &&
                data[2].Equals("sync-backups", StringComparison.OrdinalIgnoreCase) &&
                new[] { "cloud-profile.json", "user.json", "game-history.json", "media-history.json", "controls.json" }.Contains(data[4], StringComparer.OrdinalIgnoreCase);
            allowed |= data.Length == 2 && data[0].Equals("browser-profiles", StringComparison.OrdinalIgnoreCase) &&
                new[] { "profiles-v2.json", ".profile-schema-v2" }.Contains(data[1], StringComparer.OrdinalIgnoreCase);
            allowed |= data.Length == 2 && data[0].Equals("extensions", StringComparison.OrdinalIgnoreCase) && data[1].Equals("extensions.json", StringComparison.OrdinalIgnoreCase);
            allowed |= data.Length == 2 && data[0].Equals("intros", StringComparison.OrdinalIgnoreCase) && data[1].Equals("active.json", StringComparison.OrdinalIgnoreCase);
            // Legacy .dpapi files are binary. The OAuth adapter imports them into encrypted JSON envelopes.
            allowed |= data.Length == 3 && data[0].Equals("GoogleTokens", StringComparison.OrdinalIgnoreCase) &&
                data[2].EndsWith(".json", StringComparison.OrdinalIgnoreCase);
            allowed |= data.Length == 2 && data[0].Equals("logs", StringComparison.OrdinalIgnoreCase) &&
                new[] { "media-metadata-probe.json", "media-network-probe.json" }.Contains(data[1], StringComparer.OrdinalIgnoreCase);
        }
        if (!allowed) return false;
        key = relative.ToLowerInvariant();
        return true;
    }

    public string AbsolutePath(string key) => Path.Combine(Root, key.Replace('/', Path.DirectorySeparatorChar));
    internal static bool IsJsonKey(string key) => key.EndsWith(".json", StringComparison.OrdinalIgnoreCase) &&
        !key.EndsWith("/current-user.json", StringComparison.OrdinalIgnoreCase);
    internal static string Owner(string key)
    {
        string[] parts = key.Split('/');
        return parts.Length >= 4 && parts[0] == "data" && parts[1] == "users" ? parts[2] : "";
    }

    internal IEnumerable<string> EnumerateLegacyCandidates()
    {
        // Walk only known ownership boundaries; never traverse browser or third-party assets.
        var roots = new[] { Root, Path.Combine(Root, "Data"), Path.Combine(Root, "updates") };
        foreach (string directory in roots)
        {
            if (!Directory.Exists(directory)) continue;
            foreach (string file in Directory.EnumerateFiles(directory))
                if (TryGetKey(file, out _, out _)) yield return file;
        }
        foreach (string relative in new[] { "Data/users", "Data/GoogleTokens" })
        {
            string directory = Path.Combine(Root, relative.Replace('/', Path.DirectorySeparatorChar));
            if (!Directory.Exists(directory)) continue;
            var options = new EnumerationOptions { RecurseSubdirectories = true, AttributesToSkip = FileAttributes.ReparsePoint, IgnoreInaccessible = false };
            foreach (string file in Directory.EnumerateFiles(directory, "*", options))
                if (TryGetKey(file, out _, out _)) yield return file;
        }
        foreach (string relative in new[] { "Data/browser-profiles", "Data/extensions", "Data/intros", "Data/logs" })
        {
            string directory = Path.Combine(Root, relative.Replace('/', Path.DirectorySeparatorChar));
            if (!Directory.Exists(directory)) continue;
            foreach (string file in Directory.EnumerateFiles(directory))
                if (TryGetKey(file, out _, out _)) yield return file;
        }
    }
}
