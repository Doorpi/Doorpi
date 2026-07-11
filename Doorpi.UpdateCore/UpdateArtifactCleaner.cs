namespace Doorpi.UpdateCore;

public static class UpdateArtifactCleaner
{
    private static readonly HashSet<string> ActivePhases = new(StringComparer.OrdinalIgnoreCase)
    {
        "downloading",
        "extracting",
        "applying",
        "doorpi-applied-pending-health-check"
    };

    public static void CleanupInactiveArtifacts(UpdateOperationState? state = null)
    {
        var protectedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (state != null && ActivePhases.Contains(state.Phase))
        {
            AddProtectedPath(protectedPaths, state.PackagePath);
            AddProtectedPath(protectedPaths, state.StagingFolder);
            AddProtectedPath(protectedPaths, state.BackupFolder);
            AddProtectedPath(protectedPaths, state.HealthSignalPath);
        }

        CleanupChildren(DoorpiRuntimePaths.DownloadsFolder, protectedPaths);
        CleanupChildren(DoorpiRuntimePaths.StagingFolder, protectedPaths);
        CleanupChildren(DoorpiRuntimePaths.BackupFolder, protectedPaths);

        if (!Directory.Exists(DoorpiRuntimePaths.UpdatesFolder)) return;
        foreach (string signal in Directory.EnumerateFiles(DoorpiRuntimePaths.UpdatesFolder, "*.signal"))
        {
            if (!protectedPaths.Contains(NormalizePath(signal)))
                DeletePath(signal);
        }
    }

    public static void CleanupCompletedOperation(UpdateOperationState? state)
    {
        if (state == null) return;
        DeleteWithin(state.PackagePath, DoorpiRuntimePaths.DownloadsFolder);
        DeleteWithin(state.StagingFolder, DoorpiRuntimePaths.StagingFolder);
        DeleteWithin(state.BackupFolder, DoorpiRuntimePaths.BackupFolder);
        DeleteWithin(state.HealthSignalPath, DoorpiRuntimePaths.UpdatesFolder);
    }

    private static void CleanupChildren(string root, HashSet<string> protectedPaths)
    {
        if (!Directory.Exists(root)) return;
        foreach (string entry in Directory.EnumerateFileSystemEntries(root))
        {
            if (!protectedPaths.Contains(NormalizePath(entry)))
                DeletePath(entry);
        }
    }

    private static void DeleteWithin(string path, string expectedRoot)
    {
        if (string.IsNullOrWhiteSpace(path) || !IsWithin(path, expectedRoot)) return;
        DeletePath(path);
    }

    private static bool IsWithin(string path, string root)
    {
        try
        {
            string fullPath = NormalizePath(path);
            string fullRoot = NormalizePath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            return fullPath.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static void AddProtectedPath(HashSet<string> paths, string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return;
        try { paths.Add(NormalizePath(path)); } catch { }
    }

    private static string NormalizePath(string path)
        => Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

    private static void DeletePath(string path)
    {
        try
        {
            if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
            else if (File.Exists(path)) File.Delete(path);
        }
        catch
        {
            // Arquivos em uso pertencem a uma operação ainda encerrando e serão tentados no próximo startup.
        }
    }
}
