using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Doorpi;

/// <summary>
/// Persists small application state without truncating the live file in place.
/// The temporary file is flushed to the physical device before it replaces the
/// previous version, so an interrupted shutdown leaves either version readable.
/// </summary>
internal static class DurableFileStore
{
    private static readonly UTF8Encoding Utf8WithoutBom = new(false);

    public static void WriteAllText(string path, string content, bool keepBackup = false)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        string temporaryPath = path + "." + Guid.NewGuid().ToString("N") + ".tmp";

        try
        {
            using (var stream = new FileStream(
                       temporaryPath,
                       FileMode.CreateNew,
                       FileAccess.Write,
                       FileShare.None,
                       64 * 1024,
                       FileOptions.WriteThrough))
            using (var writer = new StreamWriter(stream, Utf8WithoutBom))
            {
                writer.Write(content);
                writer.Flush();
                stream.Flush(flushToDisk: true);
            }

            Replace(temporaryPath, path, keepBackup);
        }
        finally
        {
            TryDelete(temporaryPath);
        }
    }

    public static async Task WriteAllTextAsync(
        string path,
        string content,
        bool keepBackup,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        string temporaryPath = path + "." + Guid.NewGuid().ToString("N") + ".tmp";

        try
        {
            await using (var stream = new FileStream(
                             temporaryPath,
                             FileMode.CreateNew,
                             FileAccess.Write,
                             FileShare.None,
                             64 * 1024,
                             FileOptions.Asynchronous | FileOptions.WriteThrough))
            await using (var writer = new StreamWriter(stream, Utf8WithoutBom))
            {
                await writer.WriteAsync(content.AsMemory(), cancellationToken).ConfigureAwait(false);
                await writer.FlushAsync(cancellationToken).ConfigureAwait(false);
                stream.Flush(flushToDisk: true);
            }

            Replace(temporaryPath, path, keepBackup);
        }
        finally
        {
            TryDelete(temporaryPath);
        }
    }

    private static void Replace(string temporaryPath, string path, bool keepBackup)
    {
        if (!File.Exists(path))
        {
            File.Move(temporaryPath, path);
            if (keepBackup)
                WriteBackup(path);
            return;
        }

        if (keepBackup)
        {
            string backupPath = path + ".bak";
            try
            {
                File.Replace(temporaryPath, path, backupPath, ignoreMetadataErrors: true);
                // Depois da troca atômica, mantenha também uma segunda cópia da
                // versão nova. Se houver queda entre as duas etapas, o backup
                // anterior continua válido; depois do retorno, ambas são válidas.
                WriteBackup(path);
                return;
            }
            catch (PlatformNotSupportedException) { }
            catch (IOException) { }
        }

        File.Move(temporaryPath, path, overwrite: true);
        if (keepBackup)
            WriteBackup(path);
    }

    private static void WriteBackup(string path)
    {
        string backupPath = path + ".bak";
        string temporaryBackupPath = backupPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            File.Copy(path, temporaryBackupPath, overwrite: false);
            using (var stream = new FileStream(
                       temporaryBackupPath,
                       FileMode.Open,
                       FileAccess.ReadWrite,
                       FileShare.Read,
                       1,
                       FileOptions.WriteThrough))
            {
                stream.Flush(flushToDisk: true);
            }
            File.Move(temporaryBackupPath, backupPath, overwrite: true);
        }
        finally
        {
            TryDelete(temporaryBackupPath);
        }
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch { }
    }
}
