namespace Doorpi.UpdateCore;

public static class DoorpiRuntimePaths
{
    public static string AppDataFolder =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Doorpi");

    public static string DataFolder => Path.Combine(AppDataFolder, "Data");

    public static string UpdatesFolder => Path.Combine(AppDataFolder, "updates");

    public static string DownloadsFolder => Path.Combine(UpdatesFolder, "downloads");

    public static string StagingFolder => Path.Combine(UpdatesFolder, "staging");

    public static string BackupFolder => Path.Combine(UpdatesFolder, "backup");

    public static string LogsFolder => Path.Combine(DataFolder, "logs");

    public static string BrowserProfilesFolder => Path.Combine(DataFolder, "browser-profiles");

    public static string GetLegacyDataFolder(string installFolder)
        => Path.Combine(installFolder, "Data");
}
