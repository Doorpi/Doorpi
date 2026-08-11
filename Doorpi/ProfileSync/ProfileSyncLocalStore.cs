using System.Diagnostics;
using System.IO;

namespace Doorpi.ProfileSync;

public sealed class ProfileSyncLocalStore
{
    private const int BackupRetentionCount = 10;
    private readonly string _profileDirectory;
    private readonly string _statePath;
    private readonly string _baseSnapshotPath;
    private readonly string _pendingRemotePath;
    private readonly string _backupsDirectory;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public ProfileSyncLocalStore(string profileDirectory)
    {
        if (string.IsNullOrWhiteSpace(profileDirectory))
            throw new ArgumentException("Profile directory is required.", nameof(profileDirectory));

        _profileDirectory = Path.GetFullPath(profileDirectory);
        _statePath = Path.Combine(_profileDirectory, "profile-sync-state.json");
        _baseSnapshotPath = Path.Combine(_profileDirectory, "profile-sync-base.json");
        _pendingRemotePath = Path.Combine(_profileDirectory, "profile-sync-pending-remote.json");
        _backupsDirectory = Path.Combine(_profileDirectory, "sync-backups");
    }

    public async Task<ProfileSyncState> LoadStateAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            return await ReadWithBackupAsync(
                       _statePath,
                       ProfileSyncSerializer.DeserializeState,
                       cancellationToken)
                   .ConfigureAwait(false)
                   ?? new ProfileSyncState();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Text.Json.JsonException)
        {
            Debug.WriteLine("[ProfileSync] Falha ao ler estado local: " + ex.Message);
            return new ProfileSyncState();
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task SaveStateAsync(ProfileSyncState state, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(state);
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await AtomicWriteAsync(_statePath, ProfileSyncSerializer.SerializeState(state), cancellationToken)
                .ConfigureAwait(false);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<CloudProfileV1?> LoadBaseSnapshotAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            return await ReadWithBackupAsync(
                       _baseSnapshotPath,
                       ProfileSyncSerializer.DeserializeProfile,
                       cancellationToken)
                   .ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Text.Json.JsonException)
        {
            Debug.WriteLine("[ProfileSync] Falha ao ler snapshot-base: " + ex.Message);
            return null;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task SaveBaseSnapshotAsync(
        CloudProfileV1 profile,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(profile);
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await AtomicWriteAsync(
                    _baseSnapshotPath,
                    ProfileSyncSerializer.SerializeProfile(profile),
                    cancellationToken)
                .ConfigureAwait(false);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<CloudProfileV1?> FindSnapshotByContentHashAsync(
        string contentHash,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(contentHash)) return null;
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var candidates = new List<string>
            {
                _baseSnapshotPath,
                _baseSnapshotPath + ".bak",
                _pendingRemotePath,
                _pendingRemotePath + ".bak"
            };
            if (Directory.Exists(_backupsDirectory))
            {
                candidates.AddRange(Directory.EnumerateDirectories(_backupsDirectory)
                    .OrderByDescending(path => path, StringComparer.OrdinalIgnoreCase)
                    .Select(path => Path.Combine(path, "cloud-profile.json")));
            }

            foreach (string path in candidates)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (!File.Exists(path)) continue;
                try
                {
                    string json = await File.ReadAllTextAsync(path, cancellationToken).ConfigureAwait(false);
                    CloudProfileV1? profile = ProfileSyncSerializer.DeserializeProfile(json);
                    if (profile != null && string.Equals(
                            ProfileSyncSerializer.ComputeContentHash(profile),
                            contentHash,
                            StringComparison.Ordinal))
                        return profile;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Text.Json.JsonException)
                {
                    Debug.WriteLine("[ProfileSync] Snapshot de migracao ignorado: " + ex.Message);
                }
            }
            return null;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task ClearBaseSnapshotAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (File.Exists(_baseSnapshotPath)) File.Delete(_baseSnapshotPath);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<CloudProfileV1?> LoadPendingRemoteAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            return await ReadWithBackupAsync(
                       _pendingRemotePath,
                       ProfileSyncSerializer.DeserializeProfile,
                       cancellationToken)
                   .ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Text.Json.JsonException)
        {
            Debug.WriteLine("[ProfileSync] Falha ao ler conflito pendente: " + ex.Message);
            return null;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task SavePendingRemoteAsync(CloudProfileV1 profile, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(profile);
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await AtomicWriteAsync(_pendingRemotePath, ProfileSyncSerializer.SerializeProfile(profile), cancellationToken)
                .ConfigureAwait(false);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task ClearPendingRemoteAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (File.Exists(_pendingRemotePath)) File.Delete(_pendingRemotePath);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<string> CreateBackupAsync(
        CloudProfileV1 snapshot,
        string reason,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            string suffix = Convert.ToHexString(Guid.NewGuid().ToByteArray())[..6].ToLowerInvariant();
            string safeReason = SanitizePathPart(reason);
            string backupDirectory = Path.Combine(
                _backupsDirectory,
                $"{DateTime.UtcNow:yyyyMMddTHHmmssfffZ}-{safeReason}-{suffix}");
            Directory.CreateDirectory(backupDirectory);

            await AtomicWriteAsync(
                Path.Combine(backupDirectory, "cloud-profile.json"),
                ProfileSyncSerializer.SerializeProfile(snapshot),
                cancellationToken).ConfigureAwait(false);
            await CopyIfExistsAsync("user.json", backupDirectory, cancellationToken).ConfigureAwait(false);
            await CopyIfExistsAsync("game-history.json", backupDirectory, cancellationToken).ConfigureAwait(false);
            PruneOldBackups();
            return backupDirectory;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task CopyIfExistsAsync(
        string fileName,
        string targetDirectory,
        CancellationToken cancellationToken)
    {
        string source = Path.Combine(_profileDirectory, fileName);
        if (!File.Exists(source)) return;

        string target = Path.Combine(targetDirectory, fileName);
        await using var input = new FileStream(source, FileMode.Open, FileAccess.Read, FileShare.ReadWrite,
            81920, FileOptions.Asynchronous | FileOptions.SequentialScan);
        await using var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None,
            81920, FileOptions.Asynchronous | FileOptions.SequentialScan);
        await input.CopyToAsync(output, cancellationToken).ConfigureAwait(false);
        await output.FlushAsync(cancellationToken).ConfigureAwait(false);
    }

    private void PruneOldBackups()
    {
        try
        {
            if (!Directory.Exists(_backupsDirectory)) return;
            foreach (string directory in Directory.EnumerateDirectories(_backupsDirectory)
                         .OrderByDescending(path => path, StringComparer.OrdinalIgnoreCase)
                         .Skip(BackupRetentionCount))
            {
                Directory.Delete(directory, recursive: true);
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Debug.WriteLine("[ProfileSync] Falha ao limitar backups: " + ex.Message);
        }
    }

    private static async Task AtomicWriteAsync(
        string path,
        string content,
        CancellationToken cancellationToken)
    {
        await DurableFileStore.WriteAllTextAsync(
                path,
                content,
                keepBackup: true,
                cancellationToken)
            .ConfigureAwait(false);
    }

    private static async Task<T?> ReadWithBackupAsync<T>(
        string path,
        Func<string, T?> deserialize,
        CancellationToken cancellationToken)
        where T : class
    {
        foreach (string candidate in new[] { path, path + ".bak" })
        {
            if (!File.Exists(candidate)) continue;
            try
            {
                string json = await File.ReadAllTextAsync(candidate, cancellationToken).ConfigureAwait(false);
                if (string.IsNullOrWhiteSpace(json) || json.IndexOf('\0') >= 0) continue;
                T? value = deserialize(json);
                if (value != null) return value;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Text.Json.JsonException)
            {
                Debug.WriteLine($"[ProfileSync] Falha ao ler {candidate}: {ex.Message}");
            }
        }
        return null;
    }

    private static string SanitizePathPart(string value)
    {
        string safe = new((value ?? "backup")
            .Where(character => char.IsLetterOrDigit(character) || character is '-' or '_')
            .Take(32)
            .ToArray());
        return string.IsNullOrWhiteSpace(safe) ? "backup" : safe;
    }
}
