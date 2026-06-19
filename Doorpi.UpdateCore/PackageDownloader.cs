using System.Net.Http;

namespace Doorpi.UpdateCore;

public sealed class PackageDownloader
{
    private readonly HttpClient _httpClient;

    public PackageDownloader(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<string> DownloadAndVerifyAsync(
        ComponentRelease release,
        string destinationFolder,
        string fileName,
        IProgress<double>? progress = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(release);

        if (string.IsNullOrWhiteSpace(release.DownloadUrl))
            throw new InvalidDataException("URL de download vazia.");

        Directory.CreateDirectory(destinationFolder);
        string finalPath = Path.Combine(destinationFolder, fileName);
        string tempPath = finalPath + ".tmp";

        if (File.Exists(tempPath)) File.Delete(tempPath);

        if (TryGetLocalSourcePath(release.DownloadUrl, out string localSourcePath))
        {
            File.Copy(localSourcePath, tempPath, overwrite: true);
            progress?.Report(1);
            await VerifyAndPromoteAsync(tempPath, finalPath, release, cancellationToken).ConfigureAwait(false);
            return finalPath;
        }

        if (!Uri.TryCreate(release.DownloadUrl, UriKind.Absolute, out var downloadUri))
            throw new InvalidDataException("URL de download invalida.");

        using var response = await _httpClient.GetAsync(
            downloadUri,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        long? totalBytes = response.Content.Headers.ContentLength ?? release.SizeBytes;
        await using (var source = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false))
        await using (var destination = File.Create(tempPath))
        {
            var buffer = new byte[1024 * 128];
            long downloaded = 0;
            while (true)
            {
                int read = await source.ReadAsync(buffer, cancellationToken).ConfigureAwait(false);
                if (read == 0) break;

                await destination.WriteAsync(buffer.AsMemory(0, read), cancellationToken).ConfigureAwait(false);
                downloaded += read;
                if (totalBytes is > 0)
                    progress?.Report(Math.Clamp(downloaded / (double)totalBytes.Value, 0, 1));
            }
        }

        await VerifyAndPromoteAsync(tempPath, finalPath, release, cancellationToken).ConfigureAwait(false);
        progress?.Report(1);
        return finalPath;
    }

    private static bool TryGetLocalSourcePath(string downloadUrl, out string path)
    {
        path = "";
        if (Uri.TryCreate(downloadUrl, UriKind.Absolute, out var uri) && uri.IsFile)
        {
            path = uri.LocalPath;
            return File.Exists(path);
        }

        if (!Uri.TryCreate(downloadUrl, UriKind.Absolute, out _)
            && File.Exists(downloadUrl))
        {
            path = downloadUrl;
            return true;
        }

        return false;
    }

    private static async Task VerifyAndPromoteAsync(
        string tempPath,
        string finalPath,
        ComponentRelease release,
        CancellationToken cancellationToken)
    {
        if (release.SizeBytes is > 0)
        {
            long actualSize = new FileInfo(tempPath).Length;
            if (actualSize != release.SizeBytes.Value)
                throw new InvalidDataException($"Tamanho do pacote invalido. Esperado {release.SizeBytes.Value}, recebido {actualSize}.");
        }

        await PackageVerifier.VerifySha256Async(tempPath, release.Sha256, cancellationToken).ConfigureAwait(false);
        File.Move(tempPath, finalPath, overwrite: true);
    }
}
