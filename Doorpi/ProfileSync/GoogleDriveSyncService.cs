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
        await source.ClearPendingRemoteAsync(cancellationToken).ConfigureAwait(false);
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

            if (state.PendingAction is ProfileSyncAction.Conflict or ProfileSyncAction.InitialChoiceRequired)
            {
                CloudProfileV1? pending = await store.LoadPendingRemoteAsync(cancellationToken).ConfigureAwait(false);
                if (pending != null)
                {
                    ProfileSyncComparison comparison = ProfileSyncEngine.Compare(localProfile, pending);
                    return new ProfileSyncResult
                    {
                        Status = SyncStatus.Conflict,
                        Action = state.PendingAction.Value,
                        Message = "Existem alterações locais e na nuvem aguardando sua escolha.",
                        RemoteProfile = pending,
                        RemoteRevision = state.PendingConflict?.RemoteRevision ?? state.RemoteProfileRevision,
                        Differences = comparison.Differences
                    };
                }
            }

            using GoogleOAuthSession? session = await RequireSessionAsync(profileId, cancellationToken)
                .ConfigureAwait(false);
            if (session == null) return DisconnectedResult();
            using var drive = new GoogleDriveAppDataClient(session, _applicationName);
            RemoteProfilePayload? remote = await DownloadRemoteAsync(drive, cancellationToken).ConfigureAwait(false);
            if (remote == null) return RemoteMissingResult();

            ProfileSyncDecision decision = ProfileSyncEngine.Evaluate(
                localProfile,
                remote.Profile,
                state.LastSyncedContentHash);

            switch (decision.Action)
            {
                case ProfileSyncAction.None:
                    await MarkSynchronizedAsync(store, state, remote, decision.LocalContentHash, cancellationToken)
                        .ConfigureAwait(false);
                    return new ProfileSyncResult
                    {
                        Status = SyncStatus.Synced,
                        Action = ProfileSyncAction.None,
                        Message = "Perfil sincronizado."
                    };

                case ProfileSyncAction.UploadLocal:
                    return await UploadProfileCoreAsync(
                        profileId,
                        localProfile,
                        localProfilePhoto,
                        remote.ProfileFile.Revision,
                        drive,
                        cancellationToken).ConfigureAwait(false);

                case ProfileSyncAction.DownloadRemote:
                    state.PendingAction = ProfileSyncAction.DownloadRemote;
                    state.RemoteProfileFileId = remote.ProfileFile.Id;
                    state.RemoteProfileRevision = remote.ProfileFile.Revision;
                    state.RemotePhotoFileId = remote.PhotoFile?.Id ?? "";
                    state.RemotePhotoRevision = remote.PhotoFile?.Revision ?? "";
                    await store.SavePendingRemoteAsync(remote.Profile, cancellationToken).ConfigureAwait(false);
                    await store.SaveStateAsync(state, cancellationToken).ConfigureAwait(false);
                    return DownloadResult(remote);

                case ProfileSyncAction.Conflict:
                case ProfileSyncAction.InitialChoiceRequired:
                    await SaveConflictAsync(store, state, decision, remote, cancellationToken).ConfigureAwait(false);
                    return new ProfileSyncResult
                    {
                        Status = SyncStatus.Conflict,
                        Action = decision.Action,
                        Message = "Existem alterações diferentes neste dispositivo e na nuvem.",
                        RemoteProfile = remote.Profile,
                        RemoteProfilePhoto = remote.Photo,
                        RemoteRevision = remote.ProfileFile.Revision,
                        Differences = decision.Differences
                    };

                default:
                    return RemoteMissingResult();
            }
        }
        catch (RemoteFileChangedException)
        {
            return new ProfileSyncResult
            {
                Status = SyncStatus.Conflict,
                Action = ProfileSyncAction.Conflict,
                Message = "O perfil remoto mudou durante a sincronização. Tente novamente para comparar as versões."
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

                string? expectedPhotoRevision = !string.IsNullOrWhiteSpace(state.RemotePhotoFileId)
                    ? state.RemotePhotoRevision
                    : null;
                photoFile = await drive.UploadFileAsync(
                    RemoteProfilePhotoFileName,
                    "image/jpeg",
                    photo,
                    expectedPhotoRevision,
                    cancellationToken).ConfigureAwait(false);
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
        string contentHash,
        CancellationToken cancellationToken)
    {
        state.IsConnected = true;
        state.RemoteProfileFileId = remote.ProfileFile.Id;
        state.RemoteProfileRevision = remote.ProfileFile.Revision;
        state.RemotePhotoFileId = remote.PhotoFile?.Id ?? "";
        state.RemotePhotoRevision = remote.PhotoFile?.Revision ?? "";
        state.LastSyncedContentHash = contentHash;
        state.LastSyncedAtUtc = DateTimeOffset.UtcNow;
        state.PendingAction = null;
        state.PendingConflict = null;
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
        state.PendingAction = decision.Action;
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
