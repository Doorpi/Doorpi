using System.Text.Json;

namespace Doorpi.UpdateCore;

public sealed class ComponentInstaller
{
    private const string InventoryFileName = ".doorpi-rollback-inventory.json";
    private readonly HashSet<string> _preservedNames;

    private sealed class RollbackInventory
    {
        public int Version { get; set; } = 1;
        public List<string> CreatedFiles { get; set; } = new();
    }

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

        string[] sourceFiles = Directory.GetFiles(stagingFolder, "*", SearchOption.AllDirectories);
        var inventory = new RollbackInventory();
        foreach (string sourceFile in sourceFiles)
        {
            string relative = Path.GetRelativePath(stagingFolder, sourceFile);
            if (IsPreserved(relative)) continue;
            if (relative.Equals(InventoryFileName, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("O pacote contém um nome reservado para recuperação.");
            if (!File.Exists(ResolveWithin(installFolder, relative)))
                inventory.CreatedFiles.Add(relative);
        }
        // Record newly introduced files before applying anything. Restoring only
        // overwritten files otherwise leaves new DLLs mixed with the old version.
        string inventoryPath = Path.Combine(backupFolder, InventoryFileName);
        using (var stream = new FileStream(inventoryPath, FileMode.CreateNew, FileAccess.Write,
                   FileShare.None, 4096, FileOptions.WriteThrough))
        {
            JsonSerializer.Serialize(stream, inventory);
            stream.Flush(flushToDisk: true);
        }

        foreach (string sourceFile in sourceFiles)
        {
            string relative = Path.GetRelativePath(stagingFolder, sourceFile);
            if (IsPreserved(relative)) continue;

            string destination = ResolveWithin(installFolder, relative);
            BackupExistingFile(destination, backupFolder, relative);

            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(sourceFile, destination, overwrite: true);
        }
    }

    public void Rollback(string backupFolder, string installFolder)
    {
        if (!Directory.Exists(backupFolder))
            throw new DirectoryNotFoundException(backupFolder);

        string inventoryPath = Path.Combine(backupFolder, InventoryFileName);
        if (File.Exists(inventoryPath))
        {
            var inventory = JsonSerializer.Deserialize<RollbackInventory>(File.ReadAllText(inventoryPath));
            if (inventory == null || inventory.Version != 1 || inventory.CreatedFiles == null)
                throw new InvalidDataException("Inventário de recuperação inválido.");
            foreach (string relative in inventory.CreatedFiles)
            {
                if (IsPreserved(relative)) continue;
                string destination = ResolveWithin(installFolder, relative);
                if (File.Exists(destination)) File.Delete(destination);
            }
        }

        foreach (string backupFile in Directory.GetFiles(backupFolder, "*", SearchOption.AllDirectories))
        {
            string relative = Path.GetRelativePath(backupFolder, backupFile);
            if (relative.Equals(InventoryFileName, StringComparison.OrdinalIgnoreCase)) continue;
            if (IsPreserved(relative)) continue;

            string destination = ResolveWithin(installFolder, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(backupFile, destination, overwrite: true);
        }
    }

    private static string ResolveWithin(string root, string relative)
    {
        string normalizedRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        string destination = Path.GetFullPath(Path.Combine(normalizedRoot, relative));
        if (Path.IsPathRooted(relative) || !destination.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Caminho de recuperação fora da instalação.");
        return destination;
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
