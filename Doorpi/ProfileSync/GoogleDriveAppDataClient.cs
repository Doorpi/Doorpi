using System.IO;
using Google.Apis.Download;
using Google.Apis.Drive.v3;
using Google.Apis.Services;
using Google.Apis.Upload;
using GoogleFile = Google.Apis.Drive.v3.Data.File;

namespace Doorpi.ProfileSync;

public sealed class GoogleDriveAppDataClient : IDisposable
{
    private const string FileFields = "id,name,mimeType,size,modifiedTime,version,md5Checksum";
    private readonly DriveService _drive;

    public GoogleDriveAppDataClient(GoogleOAuthSession session, string applicationName)
    {
        ArgumentNullException.ThrowIfNull(session);
        _drive = new DriveService(new BaseClientService.Initializer
        {
            HttpClientInitializer = session.Credential,
            ApplicationName = string.IsNullOrWhiteSpace(applicationName) ? "Doorpi" : applicationName
        });
    }

    public async Task<RemoteAppDataFile?> FindFileAsync(
        string name,
        CancellationToken cancellationToken = default)
    {
        var request = _drive.Files.List();
        request.Spaces = "appDataFolder";
        request.Q = $"name = '{EscapeQueryValue(name)}' and trashed = false";
        request.Fields = $"files({FileFields})";
        request.PageSize = 20;
        var response = await request.ExecuteAsync(cancellationToken).ConfigureAwait(false);
        return (response.Files ?? Array.Empty<GoogleFile>())
            .OrderByDescending(file => file.ModifiedTimeDateTimeOffset)
            .ThenByDescending(file => file.Version)
            .Select(ToRemoteFile)
            .FirstOrDefault();
    }

    public async Task<RemoteFileContent?> DownloadFileAsync(
        string name,
        CancellationToken cancellationToken = default)
    {
        RemoteAppDataFile? file = await FindFileAsync(name, cancellationToken).ConfigureAwait(false);
        return file == null ? null : await DownloadFileAsync(file, cancellationToken).ConfigureAwait(false);
    }

    public async Task<RemoteFileContent> DownloadFileAsync(
        RemoteAppDataFile file,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(file);
        using var stream = new MemoryStream();
        IDownloadProgress progress = await _drive.Files.Get(file.Id)
            .DownloadAsync(stream, cancellationToken).ConfigureAwait(false);
        if (progress.Status != DownloadStatus.Completed)
            throw progress.Exception ?? new IOException($"Falha ao baixar '{file.Name}' do Google Drive.");
        return new RemoteFileContent { File = file, Content = stream.ToArray() };
    }

    public async Task<RemoteAppDataFile> UploadFileAsync(
        string name,
        string mimeType,
        ReadOnlyMemory<byte> content,
        string? expectedRevision = null,
        CancellationToken cancellationToken = default)
    {
        RemoteAppDataFile? existing = await FindFileAsync(name, cancellationToken).ConfigureAwait(false);
        if (!string.IsNullOrWhiteSpace(expectedRevision) &&
            !string.Equals(existing?.Revision, expectedRevision, StringComparison.Ordinal))
        {
            throw new RemoteFileChangedException(
                $"O arquivo remoto '{name}' mudou antes da gravação.");
        }

        await using var stream = new MemoryStream(content.ToArray(), writable: false);
        GoogleFile response;
        if (existing == null)
        {
            var metadata = new GoogleFile
            {
                Name = name,
                MimeType = mimeType,
                Parents = new[] { "appDataFolder" }
            };
            var upload = _drive.Files.Create(metadata, stream, mimeType);
            upload.Fields = FileFields;
            IUploadProgress progress = await upload.UploadAsync(cancellationToken).ConfigureAwait(false);
            EnsureUploadCompleted(progress, name);
            response = upload.ResponseBody;
        }
        else
        {
            var metadata = new GoogleFile { Name = name, MimeType = mimeType };
            var upload = _drive.Files.Update(metadata, existing.Id, stream, mimeType);
            upload.Fields = FileFields;
            IUploadProgress progress = await upload.UploadAsync(cancellationToken).ConfigureAwait(false);
            EnsureUploadCompleted(progress, name);
            response = upload.ResponseBody;
        }

        return ToRemoteFile(response ?? throw new IOException($"O Google Drive não confirmou o upload de '{name}'."));
    }

    public async Task DeleteFileAsync(string name, CancellationToken cancellationToken = default)
    {
        RemoteAppDataFile? file = await FindFileAsync(name, cancellationToken).ConfigureAwait(false);
        if (file != null)
            await _drive.Files.Delete(file.Id).ExecuteAsync(cancellationToken).ConfigureAwait(false);
    }

    public void Dispose() => _drive.Dispose();

    private static RemoteAppDataFile ToRemoteFile(GoogleFile file)
        => new()
        {
            Id = file.Id ?? "",
            Name = file.Name ?? "",
            MimeType = file.MimeType ?? "",
            Revision = file.Version?.ToString() ?? "",
            ContentHash = file.Md5Checksum ?? "",
            ModifiedAtUtc = file.ModifiedTimeDateTimeOffset?.ToUniversalTime()
        };

    private static void EnsureUploadCompleted(IUploadProgress progress, string name)
    {
        if (progress.Status != UploadStatus.Completed)
            throw progress.Exception ?? new IOException($"Falha ao enviar '{name}' ao Google Drive.");
    }

    private static string EscapeQueryValue(string value)
        => (value ?? "").Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("'", "\\'", StringComparison.Ordinal);
}
