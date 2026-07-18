using System.Text.Json.Serialization;

namespace Doorpi.ProfileSync;

public enum SyncStatus
{
    Synced,
    Uploaded,
    Downloaded,
    Conflict,
    Disconnected,
    Offline,
    AuthenticationRequired,
    Failed
}

public enum ProfileSyncAction
{
    None,
    UploadLocal,
    DownloadRemote,
    Conflict,
    RemoteMissing,
    InitialChoiceRequired
}

public enum ProfileDifferenceKind
{
    SchemaVersion,
    ProfileIdentity,
    ProfileName,
    PinCode,
    SteamGridApiKey,
    ProfilePhoto,
    CreatedAt,
    TotalPlaytime,
    GameAdded,
    GameRemoved,
    GameName,
    GamePlaytime,
    GameLastSession,
    GameFirstPlayed,
    GameLastPlayed,
    GameVerticalArtwork,
    GameHorizontalArtwork,
    GameProfileBannerArtwork,
    GameSteamGridReference
}

public sealed class CloudProfileV1
{
    public int SchemaVersion { get; set; } = 1;
    public string ProfileId { get; set; } = "";
    public string ProfileName { get; set; } = "";
    public string PinCode { get; set; } = "";
    public string SteamGridApiKey { get; set; } = "";
    public DateTimeOffset? CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public string LastModifiedDeviceId { get; set; } = "";
    public long TotalPlaytimeSeconds { get; set; }
    public CloudProfilePhotoV1 ProfilePhoto { get; set; } = new();
    public List<CloudGameHistoryEntryV1> Games { get; set; } = new();
}

public sealed class CloudProfilePhotoV1
{
    public bool HasPhoto { get; set; }
    public string Source { get; set; } = "";
    public string SourceUrl { get; set; } = "";
    public int SteamGridAssetId { get; set; }
    public double CropX { get; set; }
    public double CropY { get; set; }
    public double Zoom { get; set; } = 1;
    public string ContentHash { get; set; } = "";
    public string CloudFileName { get; set; } = "profile-photo.jpg";
}

public sealed class CloudGameHistoryEntryV1
{
    public string GameKey { get; set; } = "";
    public string Name { get; set; } = "";
    public long TotalPlaytimeSeconds { get; set; }
    public int LastSessionSeconds { get; set; }
    public DateTimeOffset? FirstPlayedUtc { get; set; }
    public DateTimeOffset? LastPlayedUtc { get; set; }
    public string ShowcaseVerticalImageUrl { get; set; } = "";
    public string HistoryHorizontalImageUrl { get; set; } = "";
    public string ProfileBannerImageUrl { get; set; } = "";
    public int SteamGridGameId { get; set; }
}

public sealed class ProfileSyncState
{
    public int SchemaVersion { get; set; } = 1;
    public string ProfileId { get; set; } = "";
    public bool IsConnected { get; set; }
    public string GoogleAccountId { get; set; } = "";
    public string RemoteProfileFileId { get; set; } = "";
    public string RemoteProfileRevision { get; set; } = "";
    public string RemotePhotoFileId { get; set; } = "";
    public string RemotePhotoRevision { get; set; } = "";
    public string LastSyncedContentHash { get; set; } = "";
    public DateTimeOffset? LastSyncedAtUtc { get; set; }
    public ProfileSyncAction? PendingAction { get; set; }
    public PendingProfileConflict? PendingConflict { get; set; }
}

public sealed class PendingProfileConflict
{
    public string LocalContentHash { get; set; } = "";
    public string RemoteContentHash { get; set; } = "";
    public string RemoteRevision { get; set; } = "";
    public DateTimeOffset DetectedAtUtc { get; set; }
}

public sealed class ProfileDifference
{
    public ProfileDifferenceKind Kind { get; init; }
    public string Path { get; init; } = "";
    public string GameKey { get; init; } = "";
    public string GameName { get; init; } = "";
    public string LocalSummary { get; init; } = "";
    public string RemoteSummary { get; init; } = "";
    public bool IsSensitive { get; init; }
}

public sealed class ProfileSyncComparison
{
    public string LocalContentHash { get; init; } = "";
    public string RemoteContentHash { get; init; } = "";
    public IReadOnlyList<ProfileDifference> Differences { get; init; } = Array.Empty<ProfileDifference>();
    public bool HasDifferences => Differences.Count > 0;
}

public sealed class ProfileSyncDecision
{
    public ProfileSyncAction Action { get; init; }
    public string LocalContentHash { get; init; } = "";
    public string RemoteContentHash { get; init; } = "";
    public string BaseContentHash { get; init; } = "";
    public IReadOnlyList<ProfileDifference> Differences { get; init; } = Array.Empty<ProfileDifference>();
}

public sealed class ProfileSyncResult
{
    public SyncStatus Status { get; init; }
    public ProfileSyncAction Action { get; init; }
    public string Message { get; init; } = "";
    public CloudProfileV1? RemoteProfile { get; init; }
    public byte[]? RemoteProfilePhoto { get; init; }
    public string RemoteRevision { get; init; } = "";
    public IReadOnlyList<ProfileDifference> Differences { get; init; } = Array.Empty<ProfileDifference>();
}

public sealed class ProfileConnectionStatus
{
    public SyncStatus Status { get; init; }
    public bool HasStoredAuthorization { get; init; }
    public string Message { get; init; } = "";
}

public sealed class RemoteAppDataFile
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string MimeType { get; init; } = "";
    public string Revision { get; init; } = "";
    public string ContentHash { get; init; } = "";
    public DateTimeOffset? ModifiedAtUtc { get; init; }
}

public sealed class RemoteFileContent
{
    public required RemoteAppDataFile File { get; init; }
    public required byte[] Content { get; init; }
}

public sealed class RemoteFileChangedException : InvalidOperationException
{
    public RemoteFileChangedException(string message) : base(message) { }
}

public sealed class GoogleOAuthConfigurationException : InvalidOperationException
{
    public GoogleOAuthConfigurationException(string message) : base(message) { }
}
