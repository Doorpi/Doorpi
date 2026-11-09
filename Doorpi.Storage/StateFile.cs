using System.Text;
using IOFile = System.IO.File;

namespace Doorpi.Storage;

/// <summary>
/// Compatibility boundary for callers that still identify state by its legacy path.
/// Owned state is stored in SQLite; external files retain normal System.IO behavior.
/// New domain code should use StateStorage transactions and explicit owner identifiers.
/// </summary>
public static class StateFile
{
    public static bool Exists(string? path) => path != null && StateStorage.Exists(path);
    public static string ReadAllText(string path) => StateStorage.ReadAllText(path);
    public static string ReadAllText(string path, Encoding encoding) => StateStorage.HandlesPath(path) ? StateStorage.ReadAllText(path) : IOFile.ReadAllText(path, encoding);
    public static Task<string> ReadAllTextAsync(string path, CancellationToken cancellationToken = default) => StateStorage.HandlesPath(path) ? Task.FromResult(StateStorage.ReadAllText(path)) : IOFile.ReadAllTextAsync(path, cancellationToken);
    public static Task<string> ReadAllTextAsync(string path, Encoding encoding, CancellationToken cancellationToken = default) => StateStorage.HandlesPath(path) ? Task.FromResult(StateStorage.ReadAllText(path)) : IOFile.ReadAllTextAsync(path, encoding, cancellationToken);
    public static void WriteAllText(string path, string? contents) => StateStorage.WriteAllText(path, contents ?? "");
    public static void WriteAllText(string path, string? contents, Encoding encoding)
    {
        if (StateStorage.HandlesPath(path)) StateStorage.WriteAllText(path, contents ?? "");
        else IOFile.WriteAllText(path, contents, encoding);
    }
    public static Task WriteAllTextAsync(string path, string? contents, CancellationToken cancellationToken = default) => StateStorage.HandlesPath(path) ? StateStorage.WriteAllTextAsync(path, contents ?? "", cancellationToken: cancellationToken) : IOFile.WriteAllTextAsync(path, contents, cancellationToken);
    public static Task WriteAllTextAsync(string path, string? contents, Encoding encoding, CancellationToken cancellationToken = default) => StateStorage.HandlesPath(path) ? StateStorage.WriteAllTextAsync(path, contents ?? "", cancellationToken: cancellationToken) : IOFile.WriteAllTextAsync(path, contents, encoding, cancellationToken);
    public static void Delete(string path) => StateStorage.Delete(path);
    public static byte[] ReadAllBytes(string path) => StateStorage.HandlesPath(path) ? Encoding.UTF8.GetBytes(StateStorage.ReadAllText(path)) : IOFile.ReadAllBytes(path);
    public static Task<byte[]> ReadAllBytesAsync(string path, CancellationToken cancellationToken = default) => StateStorage.HandlesPath(path) ? Task.FromResult(ReadAllBytes(path)) : IOFile.ReadAllBytesAsync(path, cancellationToken);
    public static void WriteAllBytes(string path, byte[] bytes)
    {
        if (StateStorage.HandlesPath(path)) StateStorage.WriteAllText(path, Encoding.UTF8.GetString(bytes));
        else IOFile.WriteAllBytes(path, bytes);
    }
    public static Task WriteAllBytesAsync(string path, byte[] bytes, CancellationToken cancellationToken = default)
    {
        if (!StateStorage.HandlesPath(path)) return IOFile.WriteAllBytesAsync(path, bytes, cancellationToken);
        return StateStorage.WriteAllTextAsync(path, Encoding.UTF8.GetString(bytes), cancellationToken: cancellationToken);
    }
    public static Stream OpenRead(string path) => StateStorage.HandlesPath(path) ? new MemoryStream(ReadAllBytes(path), writable: false) : IOFile.OpenRead(path);
    public static IEnumerable<string> ReadLines(string path) => StateStorage.HandlesPath(path) ? ReadAllText(path).Split(new[] { "\r\n", "\n" }, StringSplitOptions.None) : IOFile.ReadLines(path);
    public static void Copy(string sourceFileName, string destFileName, bool overwrite = false)
    {
        if (!StateStorage.HandlesPath(sourceFileName) && !StateStorage.HandlesPath(destFileName))
        { IOFile.Copy(sourceFileName, destFileName, overwrite); return; }
        if (!overwrite && Exists(destFileName)) throw new IOException("Destination already exists: " + destFileName);
        WriteAllBytes(destFileName, ReadAllBytes(sourceFileName));
    }
    public static void Move(string sourceFileName, string destFileName, bool overwrite = false)
    {
        if (!StateStorage.HandlesPath(sourceFileName) && !StateStorage.HandlesPath(destFileName))
        { IOFile.Move(sourceFileName, destFileName, overwrite); return; }
        if (StateStorage.HandlesPath(sourceFileName) && StateStorage.HandlesPath(destFileName))
        {
            if (!overwrite && Exists(destFileName)) throw new IOException("Destination already exists: " + destFileName);
            StateStorage.WriteBatch(new Dictionary<string, string?> { [destFileName] = ReadAllText(sourceFileName), [sourceFileName] = null });
            return;
        }
        Copy(sourceFileName, destFileName, overwrite);
        Delete(sourceFileName);
    }
    public static DateTime GetLastWriteTimeUtc(string path) => StateStorage.HandlesPath(path) ? StateStorage.GetLastWriteTimeUtc(path) : IOFile.GetLastWriteTimeUtc(path);
    public static DateTime GetLastWriteTime(string path) => GetLastWriteTimeUtc(path).ToLocalTime();
    public static long GetLength(string path) => StateStorage.HandlesPath(path) ? Encoding.UTF8.GetByteCount(ReadAllText(path)) : new FileInfo(path).Length;
    public static void AppendAllText(string path, string? contents) => AppendAllText(path, contents, Encoding.UTF8);
    public static void AppendAllText(string path, string? contents, Encoding encoding)
    {
        if (StateStorage.HandlesPath(path)) throw new NotSupportedException("Append state using a transactional domain operation.");
        IOFile.AppendAllText(path, contents, encoding);
    }
    public static FileStream Create(string path)
    {
        RequireExternal(path);
        return IOFile.Create(path);
    }
    public static void Replace(string sourceFileName, string destinationFileName, string? destinationBackupFileName, bool ignoreMetadataErrors = false)
    {
        RequireExternal(sourceFileName); RequireExternal(destinationFileName);
        if (destinationBackupFileName != null) RequireExternal(destinationBackupFileName);
        IOFile.Replace(sourceFileName, destinationFileName, destinationBackupFileName, ignoreMetadataErrors);
    }
    public static FileAttributes GetAttributes(string path) => StateStorage.HandlesPath(path) ? FileAttributes.Normal : IOFile.GetAttributes(path);
    public static void SetAttributes(string path, FileAttributes attributes) { if (!StateStorage.HandlesPath(path)) IOFile.SetAttributes(path, attributes); }
    public static void SetLastWriteTimeUtc(string path, DateTime lastWriteTimeUtc) { RequireExternal(path); IOFile.SetLastWriteTimeUtc(path, lastWriteTimeUtc); }
    private static void RequireExternal(string path)
    {
        if (StateStorage.HandlesPath(path)) throw new NotSupportedException("Use StateStorage for managed application state.");
    }
}
