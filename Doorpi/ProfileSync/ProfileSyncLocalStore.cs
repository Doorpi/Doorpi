using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using Doorpi.Storage;

namespace Doorpi.ProfileSync;

public sealed class ProfileSyncLocalStore
{
    private const int BackupRetentionCount = 10;
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates = new(StringComparer.OrdinalIgnoreCase);
    private readonly string _profileDirectory;
    private readonly string _statePath;
    private readonly string _baseSnapshotPath;
    private readonly string _pendingRemotePath;
    private readonly string _backupsDirectory;
    private readonly SemaphoreSlim _gate;

    public ProfileSyncLocalStore(string profileDirectory)
    {
        if (string.IsNullOrWhiteSpace(profileDirectory))
            throw new ArgumentException("Profile directory is required.", nameof(profileDirectory));
        _profileDirectory = Path.GetFullPath(profileDirectory);
        _statePath = Path.Combine(_profileDirectory, "profile-sync-state.json");
        _baseSnapshotPath = Path.Combine(_profileDirectory, "profile-sync-base.json");
        _pendingRemotePath = Path.Combine(_profileDirectory, "profile-sync-pending-remote.json");
        _backupsDirectory = Path.Combine(_profileDirectory, "sync-backups");
        _gate = Gates.GetOrAdd(_profileDirectory, _ => new SemaphoreSlim(1, 1));
    }

    public async Task<ProfileSyncState> LoadStateAsync(CancellationToken cancellationToken = default)
        => await ReadAsync(_statePath, ProfileSyncSerializer.DeserializeState, cancellationToken).ConfigureAwait(false)
           ?? new ProfileSyncState();

    public Task SaveStateAsync(ProfileSyncState state, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(state);
        return WriteAsync(_statePath, ProfileSyncSerializer.SerializeState(state), cancellationToken);
    }

    public Task<CloudProfileV1?> LoadBaseSnapshotAsync(CancellationToken cancellationToken = default)
        => ReadAsync(_baseSnapshotPath, ProfileSyncSerializer.DeserializeProfile, cancellationToken);

    public Task SaveBaseSnapshotAsync(CloudProfileV1 profile, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(profile);
        return WriteAsync(_baseSnapshotPath, ProfileSyncSerializer.SerializeProfile(profile), cancellationToken);
    }

    public Task<CloudProfileV1?> LoadPendingRemoteAsync(CancellationToken cancellationToken = default)
        => ReadAsync(_pendingRemotePath, ProfileSyncSerializer.DeserializeProfile, cancellationToken);

    public Task SavePendingRemoteAsync(CloudProfileV1 profile, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(profile);
        return WriteAsync(_pendingRemotePath, ProfileSyncSerializer.SerializeProfile(profile), cancellationToken);
    }

    public Task ClearBaseSnapshotAsync(CancellationToken cancellationToken = default)
        => WriteAsync(_baseSnapshotPath, null, cancellationToken);

    public Task ClearPendingRemoteAsync(CancellationToken cancellationToken = default)
        => WriteAsync(_pendingRemotePath, null, cancellationToken);

    // The merge base is valid only once the corresponding local data has committed.
    // Commit the acknowledgement and pending deletion together so a crash cannot
    // expose a new baseline beside the previous pending operation.
    public async Task SaveSynchronizedAsync(ProfileSyncState state, CloudProfileV1 profile,
        CancellationToken cancellationToken = default,
        IReadOnlyDictionary<string, string?>? localWrites = null,
        IReadOnlyDictionary<string, long>? expectedRevisions = null)
    {
        ArgumentNullException.ThrowIfNull(state);
        ArgumentNullException.ThrowIfNull(profile);
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            var writes = localWrites == null ? new Dictionary<string, string?>() : new Dictionary<string, string?>(localWrites);
            writes[_statePath] = ProfileSyncSerializer.SerializeState(state);
            writes[_baseSnapshotPath] = ProfileSyncSerializer.SerializeProfile(profile);
            writes[_pendingRemotePath] = null;
            writes[_pendingRemotePath + ".bak"] = null;
            if (expectedRevisions == null) StateStorage.WriteBatch(writes);
            else StateStorage.WriteBatchIfRevision(writes, expectedRevisions);
        }
        finally { _gate.Release(); }
    }

    public async Task SavePendingAsync(ProfileSyncState state, CloudProfileV1 profile,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(state);
        ArgumentNullException.ThrowIfNull(profile);
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            StateStorage.WriteBatch(new Dictionary<string, string?>
            {
                [_statePath] = ProfileSyncSerializer.SerializeState(state),
                [_pendingRemotePath] = ProfileSyncSerializer.SerializeProfile(profile)
            });
        }
        finally { _gate.Release(); }
    }

    public async Task<CloudProfileV1?> FindSnapshotByContentHashAsync(string contentHash,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(contentHash)) return null;
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var candidates = new[] { _baseSnapshotPath, _baseSnapshotPath + ".bak", _pendingRemotePath, _pendingRemotePath + ".bak" }
                .Concat(StateStorage.EnumerateDocuments(_backupsDirectory, "cloud-profile.json")
                    .OrderByDescending(path => path, StringComparer.OrdinalIgnoreCase));
            foreach (string path in candidates)
            {
                cancellationToken.ThrowIfCancellationRequested();
                CloudProfileV1? profile = ReadWithBackup(path, ProfileSyncSerializer.DeserializeProfile);
                if (profile != null && string.Equals(ProfileSyncSerializer.ComputeContentHash(profile), contentHash, StringComparison.Ordinal))
                    return profile;
            }
            return null;
        }
        finally { _gate.Release(); }
    }

    public async Task<string> CreateBackupAsync(CloudProfileV1 snapshot, string reason,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            string suffix = Guid.NewGuid().ToString("N")[..6];
            string backupDirectory = Path.Combine(_backupsDirectory,
                $"{DateTime.UtcNow:yyyyMMddTHHmmssfffZ}-{SanitizePathPart(reason)}-{suffix}");
            var writes = new Dictionary<string, string?>
            {
                [Path.Combine(backupDirectory, "cloud-profile.json")] = ProfileSyncSerializer.SerializeProfile(snapshot)
            };
            foreach (string name in new[] { "user.json", "game-history.json", "media-history.json", "controls.json" })
            {
                string source = Path.Combine(_profileDirectory, name);
                if (StateStorage.Exists(source))
                    writes[Path.Combine(backupDirectory, name)] = StateStorage.ReadAllText(source);
            }
            string[] oldDocuments = StateStorage.EnumerateDocuments(_backupsDirectory, "*").ToArray();
            var expired = oldDocuments.Select(path => Path.GetDirectoryName(path)!)
                .Append(backupDirectory).Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderByDescending(path => path, StringComparer.OrdinalIgnoreCase).Skip(BackupRetentionCount)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            foreach (string document in oldDocuments)
                if (expired.Contains(Path.GetDirectoryName(document)!)) writes[document] = null;
            StateStorage.WriteBatch(writes);
            return backupDirectory;
        }
        finally { _gate.Release(); }
    }

    private async Task<T?> ReadAsync<T>(string path, Func<string, T?> deserialize, CancellationToken cancellationToken)
        where T : class
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try { return ReadWithBackup(path, deserialize); }
        finally { _gate.Release(); }
    }

    private async Task WriteAsync(string path, string? content, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (content == null)
                StateStorage.WriteBatch(new Dictionary<string, string?> { [path] = null, [path + ".bak"] = null });
            else StateStorage.WriteAllText(path, content, keepBackup: true);
        }
        finally { _gate.Release(); }
    }

    private static T? ReadWithBackup<T>(string path, Func<string, T?> deserialize) where T : class
    {
        Exception? failure = null;
        foreach (string candidate in new[] { path, path + ".bak" })
        {
            if (!StateStorage.Exists(candidate)) continue;
            try
            {
                string json = StateStorage.ReadAllText(candidate);
                if (string.IsNullOrWhiteSpace(json) || json.IndexOf('\0') >= 0)
                    throw new InvalidDataException("Documento de sincronização vazio ou truncado.");
                T? value = deserialize(json);
                if (value != null) return value;
                failure = new InvalidDataException("Documento de sincronização sem conteúdo válido.");
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Text.Json.JsonException)
            {
                Debug.WriteLine($"[ProfileSync] Falha ao ler {candidate}: {ex.Message}");
                failure = ex;
            }
        }
        if (failure != null) throw new InvalidDataException("O estado de sincronização e sua revisão de recuperação estão inválidos.", failure);
        return null;
    }

    private static string SanitizePathPart(string value)
    {
        string safe = new((value ?? "backup").Where(character => char.IsLetterOrDigit(character) || character is '-' or '_').Take(32).ToArray());
        return string.IsNullOrWhiteSpace(safe) ? "backup" : safe;
    }
}
