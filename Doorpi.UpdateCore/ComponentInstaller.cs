namespace Doorpi.UpdateCore;

public sealed class ComponentInstaller
{
    private readonly HashSet<string> _preservedNames;

    public ComponentInstaller(IEnumerable<string>? preservedNames = null)
    {
        _preservedNames = new HashSet<string>(
            preservedNames ?? Array.Empty<string>(),
            StringComparer.OrdinalIgnoreCase);
    }

    public void ApplyFromStaging(string stagingFolder, string installFolder, string backupFolder)
    {
        if (!Directory.Exists(stagingFolder))
            throw new DirectoryNotFoundException(stagingFolder);

        Directory.CreateDirectory(installFolder);
        ResetDirectory(backupFolder);

        foreach (string sourceFile in Directory.GetFiles(stagingFolder, "*", SearchOption.AllDirectories))
        {
            string relative = Path.GetRelativePath(stagingFolder, sourceFile);
            if (IsPreserved(relative)) continue;

            string destination = Path.Combine(installFolder, relative);
            BackupExistingFile(destination, backupFolder, relative);

            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(sourceFile, destination, overwrite: true);
        }
    }

    public void Rollback(string backupFolder, string installFolder)
    {
        if (!Directory.Exists(backupFolder))
            throw new DirectoryNotFoundException(backupFolder);

        foreach (string backupFile in Directory.GetFiles(backupFolder, "*", SearchOption.AllDirectories))
        {
            string relative = Path.GetRelativePath(backupFolder, backupFile);
            if (IsPreserved(relative)) continue;

            string destination = Path.Combine(installFolder, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(backupFile, destination, overwrite: true);
        }
    }

    private static void BackupExistingFile(string destination, string backupFolder, string relative)
    {
        if (!File.Exists(destination)) return;

        string backupPath = Path.Combine(backupFolder, relative);
        Directory.CreateDirectory(Path.GetDirectoryName(backupPath)!);
        File.Copy(destination, backupPath, overwrite: true);
    }

    private bool IsPreserved(string relativePath)
    {
        string firstSegment = relativePath
            .Split([Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar], StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault() ?? "";
        return _preservedNames.Contains(firstSegment);
    }

    private static void ResetDirectory(string path)
    {
        if (Directory.Exists(path))
            Directory.Delete(path, recursive: true);
        Directory.CreateDirectory(path);
    }
}
