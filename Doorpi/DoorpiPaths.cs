using System;
using System.IO;
using Doorpi.UpdateCore;

namespace Doorpi
{
    internal static class DoorpiPaths
    {
        public static string InstallFolder => AppDomain.CurrentDomain.BaseDirectory;

        public static string AppDataFolder => DoorpiRuntimePaths.AppDataFolder;

        public static string DataFolder => DoorpiRuntimePaths.DataFolder;

        public static string LegacyDataFolder => DoorpiRuntimePaths.GetLegacyDataFolder(InstallFolder);

        public static string BrowserProfilesFolder => DoorpiRuntimePaths.BrowserProfilesFolder;

        public static string LogsFolder => DoorpiRuntimePaths.LogsFolder;
    }
}
