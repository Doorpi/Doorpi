using System.IO;

namespace Doorpi;

internal static class LocalStateResourcePolicy
{
    private static readonly HashSet<string> Views = new(StringComparer.OrdinalIgnoreCase)
    {
        "user.json", "games.json", "game-history.json", "media-history.json", "media.json", "emulators.json"
    };

    public static bool IsStateView(string relative) => Views.Contains(Path.GetFileName(relative));

    public static string? ResolveStateView(string relative, bool trustedOrigin, string userId, string dataFolder)
    {
        if (!trustedOrigin || string.IsNullOrWhiteSpace(userId) || userId.IndexOfAny(new[] { '/', '\\', ':', '.' }) >= 0) return null;
        string name = Path.GetFileName(relative);
        if (!Views.Contains(name)) return null;
        string expected = "users/" + userId + "/" + name;
        if (relative != name && !relative.Equals(expected, StringComparison.OrdinalIgnoreCase)) return null;
        return Path.Combine(dataFolder, "users", userId, name);
    }

    public static string? ResolveAsset(string relative, bool trustedOrigin, string userId, string dataFolder)
    {
        bool allowed = relative.StartsWith("images/", StringComparison.OrdinalIgnoreCase) ||
            relative.StartsWith("iconcache/", StringComparison.OrdinalIgnoreCase) ||
            (trustedOrigin && !string.IsNullOrWhiteSpace(userId) && relative.StartsWith("users/" + userId + "/trailers/", StringComparison.OrdinalIgnoreCase));
        if (!allowed || relative.Contains('\\') || relative.Contains(':')) return null;
        string root = Path.GetFullPath(dataFolder).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        string path = Path.GetFullPath(Path.Combine(dataFolder, relative.Replace('/', Path.DirectorySeparatorChar)));
        if (!path.StartsWith(root, StringComparison.OrdinalIgnoreCase)) return null;
        // An asset prefix must not be used as a traversal route into another directory.
        string canonical = Path.GetRelativePath(dataFolder, path).Replace('\\', '/');
        if (!canonical.Equals(relative, StringComparison.OrdinalIgnoreCase)) return null;
        return MimeType(path) == null ? null : path;
    }

    public static string? MimeType(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".webp" => "image/webp",
        ".gif" => "image/gif", ".ico" => "image/x-icon", ".avif" => "image/avif",
        ".mp4" => "video/mp4", ".webm" => "video/webm", _ => null
    };
}
