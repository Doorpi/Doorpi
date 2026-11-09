namespace Doorpi.Storage;

public sealed record FileInventoryResult(IReadOnlyList<string> Files, bool Complete, IReadOnlyList<string> UnavailableDirectories);

/// <summary>A bounded scan reports uncertainty explicitly; absence is authoritative only when Complete is true.</summary>
public static class FileInventory
{
    public static FileInventoryResult Scan(string root, int maxFiles = 6000, CancellationToken cancellationToken = default)
    {
        if (maxFiles < 1) throw new ArgumentOutOfRangeException(nameof(maxFiles));
        var files = new List<string>();
        var errors = new List<string>();
        if (!Directory.Exists(root)) return new(files, false, new[] { root });
        var pending = new Stack<string>();
        pending.Push(root);
        while (pending.Count > 0)
        {
            cancellationToken.ThrowIfCancellationRequested();
            string directory = pending.Pop();
            try
            {
                if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0) { errors.Add(directory); continue; }
                foreach (string child in Directory.EnumerateDirectories(directory)) pending.Push(child);
                foreach (string file in Directory.EnumerateFiles(directory))
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    if (files.Count >= maxFiles) return new(files, false, errors);
                    files.Add(file);
                }
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            { errors.Add(directory); }
        }
        return new(files, errors.Count == 0, errors);
    }
}
