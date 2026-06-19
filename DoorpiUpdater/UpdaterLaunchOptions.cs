namespace DoorpiUpdater;

internal sealed class UpdaterLaunchOptions
{
    public string Mode { get; private init; } = "";
    public int ParentProcessId { get; private init; }
    public string ManifestCachePath { get; private init; } = "";
    public string ReadySignalPath { get; private init; } = "";
    public string InstallFolder { get; private init; } = "";

    public static UpdaterLaunchOptions Parse(IEnumerable<string> args)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        string? pendingKey = null;

        foreach (string arg in args)
        {
            if (arg.StartsWith("--", StringComparison.Ordinal))
            {
                pendingKey = arg[2..];
                values[pendingKey] = "true";
                continue;
            }

            if (pendingKey != null)
            {
                values[pendingKey] = arg;
                pendingKey = null;
            }
        }

        _ = int.TryParse(Get(values, "parent-pid"), out int parentPid);
        return new UpdaterLaunchOptions
        {
            Mode = Get(values, "mode"),
            ParentProcessId = parentPid,
            ManifestCachePath = Get(values, "manifest-cache"),
            ReadySignalPath = Get(values, "ready-signal"),
            InstallFolder = Get(values, "install-folder")
        };
    }

    private static string Get(Dictionary<string, string> values, string key)
        => values.TryGetValue(key, out string? value) ? value : "";
}
