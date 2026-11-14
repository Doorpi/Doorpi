using System.Text.RegularExpressions;

namespace Doorpi.UpdateCore;

public static partial class UpdateVersionComparer
{
    public static bool IsRemoteNewer(string remoteVersion, string localVersion)
        => Compare(remoteVersion, localVersion) > 0;

    public static bool IsValidVersion(string? version)
    {
        if (string.IsNullOrWhiteSpace(version) || !StrictVersionRegex().IsMatch(version.Trim())) return false;
        string numeric = version.Trim().TrimStart('v', 'V').Split('-', '+')[0];
        return numeric.Split('.').All(part => int.TryParse(part, out _));
    }

    public static int Compare(string? left, string? right)
    {
        var a = Parse(left);
        var b = Parse(right);

        for (int i = 0; i < 3; i++)
        {
            int cmp = a.Numbers[i].CompareTo(b.Numbers[i]);
            if (cmp != 0) return cmp;
        }

        if (a.Prerelease.Length == 0 && b.Prerelease.Length > 0) return 1;
        if (a.Prerelease.Length > 0 && b.Prerelease.Length == 0) return -1;
        return ComparePrerelease(a.Prerelease, b.Prerelease);
    }

    private static int ComparePrerelease(string left, string right)
    {
        string[] a = left.Split('.');
        string[] b = right.Split('.');
        for (int i = 0; i < Math.Min(a.Length, b.Length); i++)
        {
            bool aNumeric = long.TryParse(a[i], out long aNumber);
            bool bNumeric = long.TryParse(b[i], out long bNumber);
            int comparison = aNumeric && bNumeric
                ? aNumber.CompareTo(bNumber)
                : aNumeric != bNumeric ? (aNumeric ? -1 : 1)
                : string.Compare(a[i], b[i], StringComparison.OrdinalIgnoreCase);
            if (comparison != 0) return comparison;
        }
        return a.Length.CompareTo(b.Length);
    }

    private static ParsedVersion Parse(string? version)
    {
        version = (version ?? "").Trim();
        if (version.StartsWith('v') || version.StartsWith('V'))
            version = version[1..];

        var match = VersionRegex().Match(version);
        if (!match.Success)
            return new ParsedVersion([0, 0, 0], version);

        int major = ToInt(match.Groups["major"].Value);
        int minor = ToInt(match.Groups["minor"].Value);
        int patch = ToInt(match.Groups["patch"].Value);
        string prerelease = match.Groups["pre"].Success ? match.Groups["pre"].Value : "";
        return new ParsedVersion([major, minor, patch], prerelease);
    }

    private static int ToInt(string value)
        => int.TryParse(value, out int parsed) ? parsed : 0;

    [GeneratedRegex(@"^(?<major>\d+)(?:\.(?<minor>\d+))?(?:\.(?<patch>\d+))?(?:-(?<pre>[0-9A-Za-z.-]+))?")]
    private static partial Regex VersionRegex();

    [GeneratedRegex(@"^[vV]?\d+(?:\.\d+){0,3}(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$")]
    private static partial Regex StrictVersionRegex();

    private readonly record struct ParsedVersion(int[] Numbers, string Prerelease);
}
