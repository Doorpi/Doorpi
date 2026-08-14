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
    ApplicationHistoryEnabled,
    CreatedAt,
    TotalPlaytime,
    TotalMediaPlayback,
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
    GameSteamGridReference,
    MediaAdded,
    MediaRemoved,
    MediaPlayback,
    MediaLastSession,
    MediaDailyPlayback,
    MediaSessionCount,
    MediaFirstPlayed,
    MediaLastPlayed,
    MediaMetadata,
    MediaArtwork,
    ControlProfiles,
    ControlAssignments
}

public sealed class CloudProfileV1
{
    public int SchemaVersion { get; set; } = 1;
    public string ProfileId { get; set; } = "";
    public string ProfileName { get; set; } = "";
    public string PinCode { get; set; } = "";
    public string SteamGridApiKey { get; set; } = "";
    public bool ApplicationHistoryEnabled { get; set; } = true;
    public DateTimeOffset? CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public string LastModifiedDeviceId { get; set; } = "";
    public long TotalPlaytimeSeconds { get; set; }
    public long TotalMediaPlaybackSeconds { get; set; }
    public CloudProfilePhotoV1 ProfilePhoto { get; set; } = new();
    public List<CloudGameHistoryEntryV1> Games { get; set; } = new();
    public List<CloudMediaHistoryEntryV1> MediaHistory { get; set; } = new();
    public List<CloudControlProfileV1> ControlProfiles { get; set; } = new();
    public List<CloudControlAssignmentV1> ControlAssignments { get; set; } = new();
}

public sealed class CloudControlProfileV1
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Category { get; set; } = "web";
    public string TargetKind { get; set; } = "";
    public string BaseProfileId { get; set; } = "";
    public bool Enabled { get; set; } = true;
    public double MouseSensitivity { get; set; } = 1;
    public double ScrollSensitivity { get; set; } = 1;
    public double MouseDeadZone { get; set; } = 0.14;
    public bool HasConfigurablePointerBindings { get; set; }
    public bool HasSecondaryActivations { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public List<CloudControlBindingV1> Bindings { get; set; } = new();
}

public sealed class CloudControlBindingV1
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public bool Enabled { get; set; } = true;
    public List<string> ControllerButtons { get; set; } = new();
    public string Trigger { get; set; } = "press";
    public int LongPressDurationMs { get; set; } = 1200;
    public List<string> SecondaryControllerButtons { get; set; } = new();
    public string SecondaryTrigger { get; set; } = "press";
    public int SecondaryLongPressDurationMs { get; set; } = 1200;
    public CloudControlActionV1 Action { get; set; } = new();
}

public sealed class CloudControlActionV1
{
    public string Type { get; set; } = "keyboard";
    public List<ushort> VirtualKeys { get; set; } = new();
    public string MouseButton { get; set; } = "left";
    public int WheelDelta { get; set; } = 120;
    public string PointerDirection { get; set; } = "free";
    public int PointerDistance { get; set; } = 24;
    public string SystemCommand { get; set; } = "";
}

public sealed class CloudControlAssignmentV1
{
    public string ProfileId { get; set; } = "";
    public string TargetName { get; set; } = "";
    public string TargetCategory { get; set; } = "web";
    public string TargetFingerprint { get; set; } = "";
    public string NativeAppId { get; set; } = "";
    public string ExecutablePath { get; set; } = "";
    public DateTimeOffset UpdatedAtUtc { get; set; }
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

public sealed class CloudMediaHistoryEntryV1
{
    public string MediaKey { get; set; } = "";
    public string AppId { get; set; } = "";
    public string AppName { get; set; } = "";
    public string Category { get; set; } = "";
    public string ContentTitle { get; set; } = "";
    public string CreatorName { get; set; } = "";
    public string AlbumTitle { get; set; } = "";
    public string SeriesTitle { get; set; } = "";
    public string SeasonTitle { get; set; } = "";
    public string EpisodeNumber { get; set; } = "";
    public string ContentType { get; set; } = "";
    public string PageUrl { get; set; } = "";
    public string TitleSource { get; set; } = "";
    public bool MediaSessionAvailable { get; set; }
    public string ArtworkRemoteUrl { get; set; } = "";
    public string ArtworkSource { get; set; } = "";
    public DateTimeOffset? MetadataCapturedUtc { get; set; }
    public long TotalPlaybackSeconds { get; set; }
    public long LastSessionSeconds { get; set; }
    public string DailyPlaybackDate { get; set; } = "";
    public long DailyPlaybackSeconds { get; set; }
    public int SessionCount { get; set; }
    public double LastPositionSeconds { get; set; }
    public double DurationSeconds { get; set; }
    public DateTimeOffset? FirstPlayedUtc { get; set; }
    public DateTimeOffset? LastPlayedUtc { get; set; }
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
    public bool ConflictPromptDeferred { get; set; }
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

public sealed class ProfileThreeWayMergeResult
{
    public required CloudProfileV1 MergedProfile { get; init; }
    public IReadOnlyList<ProfileDifference> Conflicts { get; init; } = Array.Empty<ProfileDifference>();
    public bool HasConflicts => Conflicts.Count > 0;
    public bool LocalNeedsUpdate { get; init; }
    public bool RemoteNeedsUpdate { get; init; }
}

public sealed class ProfileSyncResult
{
    public SyncStatus Status { get; init; }
    public ProfileSyncAction Action { get; init; }
    public string Message { get; init; } = "";
    public CloudProfileV1? RemoteProfile { get; init; }
    public CloudProfileV1? LocalArtworkEnrichment { get; init; }
    public byte[]? RemoteProfilePhoto { get; init; }
    public string RemoteRevision { get; init; } = "";
    public IReadOnlyList<ProfileDifference> Differences { get; init; } = Array.Empty<ProfileDifference>();
    public bool ConflictPromptDeferred { get; init; }
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

public sealed class GoogleOAuthCanceledException : InvalidOperationException
{
    public GoogleOAuthCanceledException(bool timedOut)
        : base(timedOut
            ? "O tempo para concluir o login expirou."
            : "A janela de login foi fechada antes da autorização.")
    {
        TimedOut = timedOut;
    }

    public bool TimedOut { get; }
}
