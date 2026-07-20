using System.Collections.Concurrent;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using Google;
using Google.Apis.Auth.OAuth2.Responses;

namespace Doorpi.ProfileSync;

public sealed class GoogleDriveSyncService
{
    public const string RemoteProfileFileName = "doorpi-profile.json";
    public const string RemoteProfilePhotoFileName = "doorpi-profile-photo.jpg";

    private readonly string _dataFolder;
    private readonly string _applicationName;
    private readonly GoogleOAuthClient _oauth;
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _profileGates = new(StringComparer.OrdinalIgnoreCase);

    public GoogleDriveSyncService(
        string credentialsPath,
        string dataFolder,
        string applicationName = "Doorpi")
    {
        _dataFolder = Path.GetFullPath(dataFolder ?? throw new ArgumentNullException(nameof(dataFolder)));
        _applicationName = string.IsNullOrWhiteSpace(applicationName) ? "Doorpi" : applicationName;
        _oauth = new GoogleOAuthClient(
            credentialsPath,
            Path.Combine(_dataFolder, "GoogleTokens"));
    }

    public async Task<ProfileSyncResult> ConnectAsync(
        string profileId,
        Action? onAuthorizationCompleted = null,
        CancellationToken cancellationToken = default)
    {
        SemaphoreSlim gate = Gate(profileId);
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            using GoogleOAuthSession session = await _oauth.ConnectAsync(
                    profileId,
                    onAuthorizationCompleted,
                    cancellationToken)
                .ConfigureAwait(false);
            using var drive = new GoogleDriveAppDataClient(session, _applicationName);
            RemoteAppDataFile? remote = await drive.FindFileAsync(RemoteProfileFileName, cancellationToken)
                .ConfigureAwait(false);

            ProfileSyncLocalStore store = Store(profileId);
            ProfileSyncState state = await store.LoadStateAsync(cancellationToken).ConfigureAwait(false);
            state.ProfileId = profileId;
            state.IsConnected = true;
            state.RemoteProfileFileId = remote?.Id ?? "";
            state.RemoteProfileRevision = remote?.Revision ?? "";
            await store.SaveStateAsync(state, cancellationToken).ConfigureAwait(false);

            return new ProfileSyncResult
            {
                Status = SyncStatus.Synced,
                Action = remote == null ? ProfileSyncAction.RemoteMissing : ProfileSyncAction.None,
                Message = remote == null
                    ? "Conta Google conectada; nenhum perfil Doorpi foi encontrado."
                    : "Google Drive conectado."
            };
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            return Failure(ex);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<ProfileConnectionStatus> GetConnectionStatusAsync(
        string profileId,
        CancellationToken cancellationToken = default)
    {
        SemaphoreSlim gate = Gate(profileId);
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            bool hasToken = await _oauth.HasStoredAuthorizationAsync(profileId).ConfigureAwait(false);
            if (!hasToken)
            {
                return new ProfileConnectionStatus
                {
                    Status = SyncStatus.Disconnected,
                    HasStoredAuthorization = false,
                    Message = "Perfil não conectado ao Google Drive."
                };
            }

            using GoogleOAuthSession? session = await _oauth.LoadExistingAsync(
                profileId,
                refreshIfExpired: true,
                cancellationToken).ConfigureAwait(false);
            if (session == null)
            {
                return new ProfileConnectionStatus
                {
                    Status = SyncStatus.Disconnected,
                    HasStoredAuthorization = false,
                    Message = "Perfil não conectado ao Google Drive."
                };
            }

            using var drive = new GoogleDriveAppDataClient(session, _applicationName);
            await drive.FindFileAsync(RemoteProfileFileName, cancellationToken).ConfigureAwait(false);
            return new ProfileConnectionStatus
            {
                Status = SyncStatus.Synced,
                HasStoredAuthorization = true,
                Message = "Google Drive conectado."
            };
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            SyncStatus status = Classify(ex);
            return new ProfileConnectionStatus
            {
                Status = status,
                HasStoredAuthorization = await SafeHasTokenAsync(profileId).ConfigureAwait(false),
                Message = FailureMessage(status)
            };
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<ProfileSyncResult> DisconnectAsync(
        string profileId,
        bool deleteCloudData,
        CancellationToken cancellationToken = default)
    {
        SemaphoreSlim gate = Gate(profileId);
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (deleteCloudData)
            {
                using GoogleOAuthSession? session = await _oauth.LoadExistingAsync(
                    profileId,
                    refreshIfExpired: true,
                    cancellationToken).ConfigureAwait(false);
                if (session == null)
                    return DisconnectedResult();

                using var drive = new GoogleDriveAppDataClient(session, _applicationName);
                await drive.DeleteFileAsync(RemoteProfileFileName, cancellationToken).ConfigureAwait(false);
                await drive.DeleteFileAsync(RemoteProfilePhotoFileName, cancellationToken).ConfigureAwait(false);
            }

            await _oauth.DisconnectAsync(profileId, revoke: true, cancellationToken).ConfigureAwait(false);
            ProfileSyncLocalStore store = Store(profileId);
            await store.SaveStateAsync(new ProfileSyncState { ProfileId = profileId }, cancellationToken)
                .ConfigureAwait(false);
            await store.ClearPendingRemoteAsync(cancellationToken).ConfigureAwait(false);
            await store.ClearBaseSnapshotAsync(cancellationToken).ConfigureAwait(false);
            return DisconnectedResult();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            return Failure(ex);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task TransferConnectionAsync(
        string sourceProfileId,
        string targetProfileId,
        CancellationToken cancellationToken = default)
    {
        if (string.Equals(sourceProfileId, targetProfileId, StringComparison.OrdinalIgnoreCase)) return;

        await _oauth.TransferAuthorizationAsync(sourceProfileId, targetProfileId).ConfigureAwait(false);
        ProfileSyncLocalStore source = Store(sourceProfileId);
        ProfileSyncLocalStore target = Store(targetProfileId);
        ProfileSyncState state = await source.LoadStateAsync(cancellationToken).ConfigureAwait(false);
        state.ProfileId = targetProfileId;
        await target.SaveStateAsync(state, cancellationToken).ConfigureAwait(false);

        CloudProfileV1? pending = await source.LoadPendingRemoteAsync(cancellationToken).ConfigureAwait(false);
        if (pending != null)
            await target.SavePendingRemoteAsync(pending, cancellationToken).ConfigureAwait(false);
        CloudProfileV1? baseline = await source.LoadBaseSnapshotAsync(cancellationToken).ConfigureAwait(false);
        if (baseline != null)
            await target.SaveBaseSnapshotAsync(baseline, cancellationToken).ConfigureAwait(false);
        await source.ClearPendingRemoteAsync(cancellationToken).ConfigureAwait(false);
        await source.ClearBaseSnapshotAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<ProfileSyncResult> UploadProfileAsync(
        string profileId,
        CloudProfileV1 profileData,
        byte[]? profilePhoto = null,
        string? expectedRemoteRevision = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(profileData);
        SemaphoreSlim gate = Gate(profileId);
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            using GoogleOAuthSession? session = await RequireSessionAsync(profileId, cancellationToken)
                .ConfigureAwait(false);
            if (session == null) return DisconnectedResult();
            using var drive = new GoogleDriveAppDataClient(session, _applicationName);
            return await UploadProfileCoreAsync(
                profileId,
                profileData,
                profilePhoto,
                expectedRemoteRevision,
                drive,
                cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            return Failure(ex);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<ProfileSyncResult> DownloadProfileAsync(
        string profileId,
        CancellationToken cancellationToken = default)
    {
        SemaphoreSlim gate = Gate(profileId);
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            using GoogleOAuthSession? session = await RequireSessionAsync(profileId, cancellationToken)
                .ConfigureAwait(false);
            if (session == null) return DisconnectedResult();
            using var drive = new GoogleDriveAppDataClient(session, _applicationName);
            RemoteProfilePayload? payload = await DownloadRemoteAsync(drive, cancellationToken).ConfigureAwait(false);
            return payload == null
                ? RemoteMissingResult()
                : DownloadResult(payload);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            return Failure(ex);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<ProfileSyncResult> SyncAsync(
        string profileId,
        CloudProfileV1 localProfile,
        byte[]? localProfilePhoto = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(localProfile);
        SemaphoreSlim gate = Gate(profileId);
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            ProfileSyncLocalStore store = Store(profileId);
            ProfileSyncState state = await store.LoadStateAsync(cancellationToken).ConfigureAwait(false);
            if (!state.IsConnected) return DisconnectedResult();

            using GoogleOAuthSession? session = await RequireSessionAsync(profileId, cancellationToken)
                .ConfigureAwait(false);
            if (session == null) return DisconnectedResult();
            using var drive = new GoogleDriveAppDataClient(session, _applicationName);
            RemoteProfilePayload? remote = await DownloadRemoteAsync(drive, cancellationToken).ConfigureAwait(false);
            if (remote == null) return RemoteMissingResult();

            return await EvaluateRemoteAsync(
                profileId,
                localProfile,
                localProfilePhoto,
                store,
                state,
                remote,
                drive,
                cancellationToken).ConfigureAwait(false);
        }
        catch (RemoteFileChangedException)
        {
            // Outra gravação venceu a corrida. Releia uma vez e decida usando
            // os dados atuais; essa condição nunca deve virar conflito vazio.
            try
            {
                ProfileSyncLocalStore store = Store(profileId);
                ProfileSyncState state = await store.LoadStateAsync(cancellationToken).ConfigureAwait(false);
                using GoogleOAuthSession? session = await RequireSessionAsync(profileId, cancellationToken)
                    .ConfigureAwait(false);
                if (session == null) return DisconnectedResult();
                using var drive = new GoogleDriveAppDataClient(session, _applicationName);
                RemoteProfilePayload? remote = await DownloadRemoteAsync(drive, cancellationToken).ConfigureAwait(false);
                if (remote == null) return RemoteMissingResult();
                return await EvaluateRemoteAsync(
                    profileId,
                    localProfile,
                    localProfilePhoto,
                    store,
                    state,
                    remote,
                    drive,
                    cancellationToken).ConfigureAwait(false);
            }
            catch (RemoteFileChangedException ex)
            {
                return Failure(ex);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                return Failure(ex);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            return Failure(ex);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<ProfileSyncResult> EvaluateRemoteAsync(
        string profileId,
        CloudProfileV1 localProfile,
        byte[]? localProfilePhoto,
        ProfileSyncLocalStore store,
        ProfileSyncState state,
        RemoteProfilePayload remote,
        GoogleDriveAppDataClient drive,
        CancellationToken cancellationToken)
    {
        CloudProfileV1? baseline = await LoadOrMigrateBaseSnapshotAsync(
            store,
            state,
            localProfile,
            remote.Profile,
            cancellationToken).ConfigureAwait(false);
        var artworkMerge = ProfileSyncEngine.MergeMissingArtwork(localProfile, remote.Profile);
        ProfileThreeWayMergeResult merge = baseline != null
            ? ProfileSyncEngine.MergeThreeWay(baseline, localProfile, remote.Profile)
            : ProfileSyncEngine.MergeLegacy(localProfile, remote.Profile);

        if (merge.HasConflicts)
        {
            ProfileSyncComparison comparison = ProfileSyncEngine.Compare(localProfile, remote.Profile);
            var decision = new ProfileSyncDecision
            {
                Action = ProfileSyncAction.Conflict,
                LocalContentHash = comparison.LocalContentHash,
                RemoteContentHash = comparison.RemoteContentHash,
                BaseContentHash = baseline == null
                    ? state.LastSyncedContentHash
                    : ProfileSyncSerializer.ComputeContentHash(baseline),
                Differences = merge.Conflicts
            };
            await SaveConflictAsync(store, state, decision, remote, cancellationToken).ConfigureAwait(false);
            return new ProfileSyncResult
            {
                Status = SyncStatus.Conflict,
                Action = ProfileSyncAction.Conflict,
                Message = "Existem alterações diferentes neste dispositivo e na nuvem.",
                RemoteProfile = remote.Profile,
                LocalArtworkEnrichment = artworkMerge.LocalChanged ? localProfile : null,
                RemoteProfilePhoto = remote.Photo,
                RemoteRevision = remote.ProfileFile.Revision,
                Differences = merge.Conflicts,
                ConflictPromptDeferred = state.ConflictPromptDeferred
            };
        }

        if (baseline == null)
        {
            await store.CreateBackupAsync(localProfile, "before-sync-migration-local", cancellationToken)
                .ConfigureAwait(false);
            await store.CreateBackupAsync(remote.Profile, "before-sync-migration-cloud", cancellationToken)
                .ConfigureAwait(false);
        }

        CloudProfileV1 merged = merge.MergedProfile;
        byte[]? mergedPhoto = SelectMergedProfilePhoto(
            merged,
            localProfile,
            localProfilePhoto,
            remote);

        if (merge.RemoteNeedsUpdate)
        {
            ProfileSyncResult upload = await UploadProfileCoreAsync(
                profileId,
                merged,
                mergedPhoto,
                remote.ProfileFile.Revision,
                drive,
                cancellationToken).ConfigureAwait(false);
            if (!merge.LocalNeedsUpdate)
                return WithLocalArtworkEnrichment(
                    upload,
                    artworkMerge.LocalChanged ? localProfile : null);

            return new ProfileSyncResult
            {
                Status = SyncStatus.Downloaded,
                Action = ProfileSyncAction.DownloadRemote,
                Message = "Alterações locais e da nuvem foram combinadas.",
                RemoteProfile = merged,
                LocalArtworkEnrichment = artworkMerge.LocalChanged ? localProfile : null,
                RemoteProfilePhoto = mergedPhoto,
                RemoteRevision = upload.RemoteRevision
            };
        }

        if (merge.LocalNeedsUpdate)
        {
            state.PendingAction = ProfileSyncAction.DownloadRemote;
            state.RemoteProfileFileId = remote.ProfileFile.Id;
            state.RemoteProfileRevision = remote.ProfileFile.Revision;
            state.RemotePhotoFileId = remote.PhotoFile?.Id ?? "";
            state.RemotePhotoRevision = remote.PhotoFile?.Revision ?? "";
            await store.SavePendingRemoteAsync(merged, cancellationToken).ConfigureAwait(false);
            await store.SaveStateAsync(state, cancellationToken).ConfigureAwait(false);
            return new ProfileSyncResult
            {
                Status = SyncStatus.Downloaded,
                Action = ProfileSyncAction.DownloadRemote,
                Message = "Alterações da nuvem foram aplicadas.",
                RemoteProfile = merged,
                LocalArtworkEnrichment = artworkMerge.LocalChanged ? localProfile : null,
                RemoteProfilePhoto = mergedPhoto,
                RemoteRevision = remote.ProfileFile.Revision
            };
        }

        await MarkSynchronizedAsync(
            store,
            state,
            remote,
            merged,
            cancellationToken).ConfigureAwait(false);
        return new ProfileSyncResult
        {
            Status = SyncStatus.Synced,
            Action = ProfileSyncAction.None,
            Message = "Perfil sincronizado.",
            LocalArtworkEnrichment = artworkMerge.LocalChanged ? localProfile : null
        };
    }

    private static async Task<CloudProfileV1?> LoadOrMigrateBaseSnapshotAsync(
        ProfileSyncLocalStore store,
        ProfileSyncState state,
        CloudProfileV1 local,
        CloudProfileV1 remote,
        CancellationToken cancellationToken)
    {
        CloudProfileV1? baseline = await store.LoadBaseSnapshotAsync(cancellationToken).ConfigureAwait(false);
        if (baseline != null) return baseline;

        string hash = state.LastSyncedContentHash ?? "";
        if (string.IsNullOrWhiteSpace(hash)) return null;

        if (string.Equals(ProfileSyncSerializer.ComputeContentHash(local), hash, StringComparison.Ordinal))
            baseline = CloneProfile(local);
        else if (string.Equals(ProfileSyncSerializer.ComputeContentHash(remote), hash, StringComparison.Ordinal))
            baseline = CloneProfile(remote);
        else
            baseline = await store.FindSnapshotByContentHashAsync(hash, cancellationToken).ConfigureAwait(false);

        if (baseline != null)
            await store.SaveBaseSnapshotAsync(baseline, cancellationToken).ConfigureAwait(false);
        return baseline;
    }

    private static byte[]? SelectMergedProfilePhoto(
        CloudProfileV1 merged,
        CloudProfileV1 local,
        byte[]? localPhoto,
        RemoteProfilePayload remote)
    {
        if (!merged.ProfilePhoto.HasPhoto) return null;
        string hash = merged.ProfilePhoto.ContentHash ?? "";
        if (localPhoto is { Length: > 0 } && string.Equals(
                hash,
                local.ProfilePhoto.ContentHash ?? "",
                StringComparison.Ordinal))
            return localPhoto;
        if (remote.Photo is { Length: > 0 } && string.Equals(
                hash,
                remote.Profile.ProfilePhoto.ContentHash ?? "",
                StringComparison.Ordinal))
            return remote.Photo;
        return localPhoto is { Length: > 0 } ? localPhoto : remote.Photo;
    }

    private static CloudProfileV1 CloneProfile(CloudProfileV1 profile)
        => ProfileSyncSerializer.DeserializeProfile(ProfileSyncSerializer.SerializeProfile(profile))
           ?? throw new InvalidOperationException("Não foi possível clonar o perfil sincronizado.");

    private static ProfileSyncResult WithLocalArtworkEnrichment(
        ProfileSyncResult result,
        CloudProfileV1? localArtworkEnrichment)
        => new()
        {
            Status = result.Status,
            Action = result.Action,
            Message = result.Message,
            RemoteProfile = result.RemoteProfile,
            LocalArtworkEnrichment = localArtworkEnrichment,
            RemoteProfilePhoto = result.RemoteProfilePhoto,
            RemoteRevision = result.RemoteRevision,
            Differences = result.Differences,
            ConflictPromptDeferred = result.ConflictPromptDeferred
        };

    public async Task SetConflictPromptDeferredAsync(
        string profileId,
        bool deferred,
        CancellationToken cancellationToken = default)
    {
        SemaphoreSlim gate = Gate(profileId);
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            ProfileSyncLocalStore store = Store(profileId);
            ProfileSyncState state = await store.LoadStateAsync(cancellationToken).ConfigureAwait(false);
            state.ConflictPromptDeferred = deferred;
            await store.SaveStateAsync(state, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task ConfirmRemoteAppliedAsync(
        string profileId,
        CloudProfileV1 appliedProfile,
        string remoteRevision,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(appliedProfile);
        SemaphoreSlim gate = Gate(profileId);
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            ProfileSyncLocalStore store = Store(profileId);
            ProfileSyncState state = await store.LoadStateAsync(cancellationToken).ConfigureAwait(false);
            state.IsConnected = true;
            state.LastSyncedContentHash = ProfileSyncSerializer.ComputeContentHash(appliedProfile);
            state.LastSyncedAtUtc = DateTimeOffset.UtcNow;
            state.RemoteProfileRevision = remoteRevision;
            state.PendingAction = null;
            state.PendingConflict = null;
            state.ConflictPromptDeferred = false;
            await store.SaveBaseSnapshotAsync(appliedProfile, cancellationToken).ConfigureAwait(false);
            await store.SaveStateAsync(state, cancellationToken).ConfigureAwait(false);
            await store.ClearPendingRemoteAsync(cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<ProfileSyncResult> UploadProfileCoreAsync(
        string profileId,
        CloudProfileV1 profile,
        byte[]? photo,
        string? expectedRemoteRevision,
        GoogleDriveAppDataClient drive,
        CancellationToken cancellationToken)
    {
        ProfileSyncLocalStore store = Store(profileId);
        ProfileSyncState state = await store.LoadStateAsync(cancellationToken).ConfigureAwait(false);

        RemoteAppDataFile? photoFile = await drive.FindFileAsync(RemoteProfilePhotoFileName, cancellationToken)
            .ConfigureAwait(false);
        if (profile.ProfilePhoto.HasPhoto)
        {
            if (photo is { Length: > 0 })
            {
                string actualHash = ProfileSyncSerializer.ComputeBinaryHash(photo);
                if (!string.IsNullOrWhiteSpace(profile.ProfilePhoto.ContentHash) &&
                    !string.Equals(actualHash, profile.ProfilePhoto.ContentHash, StringComparison.Ordinal))
                {
                    throw new InvalidDataException("A foto local não corresponde ao hash do perfil.");
                }

                string driveHash = Convert.ToHexString(System.Security.Cryptography.MD5.HashData(photo))
                    .ToLowerInvariant();
                bool photoAlreadyCurrent = photoFile != null &&
                    string.Equals(photoFile.ContentHash, driveHash, StringComparison.OrdinalIgnoreCase);
                if (!photoAlreadyCurrent)
                {
                    // Use a revisão recém-lida. O estado pode estar defasado se a foto
                    // foi enviada, mas o JSON perdeu uma corrida logo em seguida.
                    photoFile = await drive.UploadFileAsync(
                        RemoteProfilePhotoFileName,
                        "image/jpeg",
                        photo,
                        photoFile?.Revision,
                        cancellationToken).ConfigureAwait(false);
                }
            }
            else if (photoFile == null)
            {
                throw new InvalidDataException("A foto do perfil ainda não está disponível para envio.");
            }
        }
        else if (photoFile != null)
        {
            await drive.DeleteFileAsync(RemoteProfilePhotoFileName, cancellationToken).ConfigureAwait(false);
            photoFile = null;
        }

        profile.UpdatedAtUtc = DateTimeOffset.UtcNow;
        byte[] json = Encoding.UTF8.GetBytes(ProfileSyncSerializer.SerializeProfile(profile));
        RemoteAppDataFile profileFile = await drive.UploadFileAsync(
            RemoteProfileFileName,
            "application/json",
            json,
            expectedRemoteRevision,
            cancellationToken).ConfigureAwait(false);

        state.ProfileId = profileId;
        state.IsConnected = true;
        state.RemoteProfileFileId = profileFile.Id;
        state.RemoteProfileRevision = profileFile.Revision;
        state.RemotePhotoFileId = photoFile?.Id ?? "";
        state.RemotePhotoRevision = photoFile?.Revision ?? "";
        state.LastSyncedContentHash = ProfileSyncSerializer.ComputeContentHash(profile);
        state.LastSyncedAtUtc = DateTimeOffset.UtcNow;
        state.PendingAction = null;
        state.PendingConflict = null;
        state.ConflictPromptDeferred = false;
        await store.SaveBaseSnapshotAsync(profile, cancellationToken).ConfigureAwait(false);
        await store.SaveStateAsync(state, cancellationToken).ConfigureAwait(false);
        await store.ClearPendingRemoteAsync(cancellationToken).ConfigureAwait(false);

        return new ProfileSyncResult
        {
            Status = SyncStatus.Uploaded,
            Action = ProfileSyncAction.UploadLocal,
            Message = "Perfil enviado ao Google Drive.",
            RemoteRevision = profileFile.Revision
        };
    }

    private static async Task<RemoteProfilePayload?> DownloadRemoteAsync(
        GoogleDriveAppDataClient drive,
        CancellationToken cancellationToken)
    {
        RemoteFileContent? profileFile = await drive.DownloadFileAsync(RemoteProfileFileName, cancellationToken)
            .ConfigureAwait(false);
        if (profileFile == null) return null;

        CloudProfileV1? profile = ProfileSyncSerializer.DeserializeProfile(Encoding.UTF8.GetString(profileFile.Content));
        if (profile == null || profile.SchemaVersion != 1)
            throw new InvalidDataException("O perfil remoto usa um formato inválido ou incompatível.");

        RemoteFileContent? photo = profile.ProfilePhoto.HasPhoto
            ? await drive.DownloadFileAsync(RemoteProfilePhotoFileName, cancellationToken).ConfigureAwait(false)
            : null;
        return new RemoteProfilePayload(
            profile,
            profileFile.File,
            photo?.Content,
            photo?.File);
    }

    private static async Task MarkSynchronizedAsync(
        ProfileSyncLocalStore store,
        ProfileSyncState state,
        RemoteProfilePayload remote,
        CloudProfileV1 synchronizedProfile,
        CancellationToken cancellationToken)
    {
        state.IsConnected = true;
        state.RemoteProfileFileId = remote.ProfileFile.Id;
        state.RemoteProfileRevision = remote.ProfileFile.Revision;
        state.RemotePhotoFileId = remote.PhotoFile?.Id ?? "";
        state.RemotePhotoRevision = remote.PhotoFile?.Revision ?? "";
        state.LastSyncedContentHash = ProfileSyncSerializer.ComputeContentHash(synchronizedProfile);
        state.LastSyncedAtUtc = DateTimeOffset.UtcNow;
        state.PendingAction = null;
        state.PendingConflict = null;
        state.ConflictPromptDeferred = false;
        await store.SaveBaseSnapshotAsync(synchronizedProfile, cancellationToken).ConfigureAwait(false);
        await store.SaveStateAsync(state, cancellationToken).ConfigureAwait(false);
        await store.ClearPendingRemoteAsync(cancellationToken).ConfigureAwait(false);
    }

    private static async Task SaveConflictAsync(
        ProfileSyncLocalStore store,
        ProfileSyncState state,
        ProfileSyncDecision decision,
        RemoteProfilePayload remote,
        CancellationToken cancellationToken)
    {
        bool sameConflict = state.PendingConflict != null &&
            string.Equals(state.PendingConflict.LocalContentHash, decision.LocalContentHash, StringComparison.Ordinal) &&
            string.Equals(state.PendingConflict.RemoteContentHash, decision.RemoteContentHash, StringComparison.Ordinal) &&
            string.Equals(state.PendingConflict.RemoteRevision, remote.ProfileFile.Revision, StringComparison.Ordinal);
        state.PendingAction = decision.Action;
        if (!sameConflict) state.ConflictPromptDeferred = false;
        state.PendingConflict = new PendingProfileConflict
        {
            LocalContentHash = decision.LocalContentHash,
            RemoteContentHash = decision.RemoteContentHash,
            RemoteRevision = remote.ProfileFile.Revision,
            DetectedAtUtc = DateTimeOffset.UtcNow
        };
        state.RemoteProfileFileId = remote.ProfileFile.Id;
        state.RemoteProfileRevision = remote.ProfileFile.Revision;
        state.RemotePhotoFileId = remote.PhotoFile?.Id ?? "";
        state.RemotePhotoRevision = remote.PhotoFile?.Revision ?? "";
        await store.SavePendingRemoteAsync(remote.Profile, cancellationToken).ConfigureAwait(false);
        await store.SaveStateAsync(state, cancellationToken).ConfigureAwait(false);
    }

    private async Task<GoogleOAuthSession?> RequireSessionAsync(
        string profileId,
        CancellationToken cancellationToken)
        => await _oauth.LoadExistingAsync(profileId, refreshIfExpired: true, cancellationToken)
            .ConfigureAwait(false);

    private ProfileSyncLocalStore Store(string profileId)
        => new(Path.Combine(_dataFolder, "users", GoogleOAuthClient.SafeProfileId(profileId)));

    private SemaphoreSlim Gate(string profileId)
        => _profileGates.GetOrAdd(GoogleOAuthClient.SafeProfileId(profileId), _ => new SemaphoreSlim(1, 1));

    private async Task<bool> SafeHasTokenAsync(string profileId)
    {
        try { return await _oauth.HasStoredAuthorizationAsync(profileId).ConfigureAwait(false); }
        catch { return false; }
    }

    private static ProfileSyncResult DownloadResult(RemoteProfilePayload remote)
        => new()
        {
            Status = SyncStatus.Downloaded,
            Action = ProfileSyncAction.DownloadRemote,
            Message = remote.Profile.ProfilePhoto.HasPhoto && remote.Photo == null
                ? "Perfil baixado, mas a foto remota não foi encontrada."
                : "Perfil baixado do Google Drive.",
            RemoteProfile = remote.Profile,
            RemoteProfilePhoto = remote.Photo,
            RemoteRevision = remote.ProfileFile.Revision
        };

    private static ProfileSyncResult RemoteMissingResult()
        => new()
        {
            Status = SyncStatus.Failed,
            Action = ProfileSyncAction.RemoteMissing,
            Message = "Nenhum perfil Doorpi foi encontrado nesta conta Google."
        };

    private static ProfileSyncResult DisconnectedResult()
        => new()
        {
            Status = SyncStatus.Disconnected,
            Action = ProfileSyncAction.None,
            Message = "Perfil não conectado ao Google Drive."
        };

    private static ProfileSyncResult Failure(Exception exception)
    {
        SyncStatus status = Classify(exception);
        return new ProfileSyncResult
        {
            Status = status,
            Action = ProfileSyncAction.None,
            Message = FailureMessage(status)
        };
    }

    private static SyncStatus Classify(Exception exception)
    {
        if (exception is GoogleOAuthConfigurationException) return SyncStatus.Failed;
        if (exception is TokenResponseException tokenException &&
            string.Equals(tokenException.Error?.Error, "invalid_grant", StringComparison.OrdinalIgnoreCase))
            return SyncStatus.AuthenticationRequired;
        if (exception is GoogleApiException apiException && apiException.HttpStatusCode == HttpStatusCode.Unauthorized)
            return SyncStatus.AuthenticationRequired;
        if (exception is HttpRequestException or TimeoutException or TaskCanceledException)
            return SyncStatus.Offline;
        return SyncStatus.Failed;
    }

    private static string FailureMessage(SyncStatus status)
        => status switch
        {
            SyncStatus.Offline => "Não foi possível acessar o Google Drive. O perfil local continua disponível.",
            SyncStatus.AuthenticationRequired => "A conexão com o Google expirou. Entre novamente para sincronizar.",
            SyncStatus.Disconnected => "Perfil não conectado ao Google Drive.",
            _ => "Não foi possível sincronizar o perfil. O perfil local não foi alterado."
        };

    private sealed record RemoteProfilePayload(
        CloudProfileV1 Profile,
        RemoteAppDataFile ProfileFile,
        byte[]? Photo,
        RemoteAppDataFile? PhotoFile);
}
