namespace Doorpi.ProfileSync;

internal enum PendingProfileRecovery { None, ApplyRemote, Conflict }

internal static class ProfileSyncRecovery
{
    internal static PendingProfileRecovery Evaluate(ProfileSyncState state, CloudProfileV1? pending,
        CloudProfileV1 local, CloudProfileV1 remote)
    {
        if (state.PendingAction != ProfileSyncAction.DownloadRemote || pending == null ||
            string.IsNullOrWhiteSpace(state.PendingLocalContentHash) ||
            ProfileSyncSerializer.ComputeContentHash(pending) != ProfileSyncSerializer.ComputeContentHash(remote))
            return PendingProfileRecovery.None;
        return ProfileSyncSerializer.ComputeContentHash(local) == state.PendingLocalContentHash
            ? PendingProfileRecovery.ApplyRemote : PendingProfileRecovery.Conflict;
    }
}
