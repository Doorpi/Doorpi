using System.IO;
using System.Text.RegularExpressions;

namespace Doorpi;

internal static class StorageUninstallEvidence
{
    internal static string? SteamUninstallAppId(string registryKey, string command)
        => SteamAppId(registryKey, @"^Steam App (\d+)$") ??
           SteamAppId(command, @"(?:^|[\s""])steam://uninstall/(\d+)/?(?=$|[\s""])");

    internal static string? SteamLaunchAppId(string launchUrl)
        => SteamAppId(launchUrl, @"^steam://(?:run|rungameid)/(\d+)/?$");

    internal static bool IsRemovalConfirmed(bool usesSteam, IReadOnlyList<string> installPaths, Func<bool> isUnregistered)
        => (usesSteam ? installPaths.Count > 0 : isUnregistered()) && installPaths.All(HasNoInstallFiles);

    private static string? SteamAppId(string value, string pattern)
    {
        Match match = Regex.Match(value, pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        return match.Success && uint.TryParse(match.Groups[1].Value, out uint id) && id > 0
            ? id.ToString(System.Globalization.CultureInfo.InvariantCulture)
            : null;
    }

    internal static bool HasNoInstallFiles(string path)
    {
        if (!Path.IsPathFullyQualified(path)) return false;
        try
        {
            FileAttributes attributes = System.IO.File.GetAttributes(path);
            return attributes.HasFlag(FileAttributes.Directory) &&
                   !attributes.HasFlag(FileAttributes.ReparsePoint) &&
                   !Directory.EnumerateFileSystemEntries(path).Any();
        }
        catch (Exception missing) when (missing is FileNotFoundException or DirectoryNotFoundException)
        {
            try
            {
                // A disconnected library drive and an inaccessible parent are not evidence of removal.
                for (string? parent = Path.GetDirectoryName(path); parent != null; parent = Path.GetDirectoryName(parent))
                {
                    try
                    {
                        FileAttributes attributes = System.IO.File.GetAttributes(parent);
                        return attributes.HasFlag(FileAttributes.Directory) &&
                               !attributes.HasFlag(FileAttributes.ReparsePoint);
                    }
                    catch (FileNotFoundException) { }
                    catch (DirectoryNotFoundException) { }
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
            return false;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }
}
