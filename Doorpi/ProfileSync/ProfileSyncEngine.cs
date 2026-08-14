using System.Globalization;
using System.Text;
using System.Text.Json;

namespace Doorpi.ProfileSync;

public static class ProfileSyncSnapshotFactory
{
    public const int CurrentSchemaVersion = 5;

    public static CloudProfileV1 Create(
        UserProfile profile,
        IEnumerable<GameHistoryEntry> history,
        string deviceId,
        DateTimeOffset updatedAtUtc,
        IEnumerable<CloudControlProfileV1>? controlProfiles = null,
        IEnumerable<CloudControlAssignmentV1>? controlAssignments = null,
        IEnumerable<MediaActivityHistoryEntry>? mediaHistory = null)
    {
        ArgumentNullException.ThrowIfNull(profile);
        ArgumentNullException.ThrowIfNull(history);

        List<CloudGameHistoryEntryV1> games = history
            .Where(entry => !string.IsNullOrWhiteSpace(entry.Name) && entry.TotalPlaytimeMinutes >= 1)
            .GroupBy(entry => NormalizeGameKey(entry.Name), StringComparer.Ordinal)
            .Where(group => !string.IsNullOrWhiteSpace(group.Key))
            .Select(group => CreateGame(group.Key, group))
            .OrderBy(game => game.GameKey, StringComparer.Ordinal)
            .ToList();
        List<CloudMediaHistoryEntryV1> media = (mediaHistory ?? Array.Empty<MediaActivityHistoryEntry>())
            .Where(entry => !string.IsNullOrWhiteSpace(entry.AppId) &&
                            !string.IsNullOrWhiteSpace(entry.ContentTitle) &&
                            entry.TotalPlaybackSeconds > 0)
            .GroupBy(entry => NormalizeMediaKey(entry.AppId, entry.ContentTitle, entry.CreatorName), StringComparer.Ordinal)
            .Where(group => !string.IsNullOrWhiteSpace(group.Key))
            .Select(group => CreateMedia(group.Key, group))
            .OrderBy(entry => entry.MediaKey, StringComparer.Ordinal)
            .ToList();

        return new CloudProfileV1
        {
            SchemaVersion = CurrentSchemaVersion,
            ProfileId = profile.Id ?? "",
            ProfileName = profile.Name ?? "",
            PinCode = profile.PinCode ?? "",
            SteamGridApiKey = profile.SteamGridApiKey ?? "",
            ApplicationHistoryEnabled = profile.ApplicationHistoryEnabled,
            CreatedAtUtc = ToUtc(profile.DateCreated),
            UpdatedAtUtc = updatedAtUtc.ToUniversalTime(),
            LastModifiedDeviceId = deviceId ?? "",
            TotalPlaytimeSeconds = SaturatingSum(games.Select(game => game.TotalPlaytimeSeconds)),
            TotalMediaPlaybackSeconds = SaturatingSum(media.Select(entry => entry.TotalPlaybackSeconds)),
            ProfilePhoto = CreatePhoto(profile),
            Games = games,
            MediaHistory = media,
            ControlProfiles = (controlProfiles ?? Array.Empty<CloudControlProfileV1>()).ToList(),
            ControlAssignments = (controlAssignments ?? Array.Empty<CloudControlAssignmentV1>()).ToList()
        };
    }

    public static string NormalizeGameKey(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        return new string(name.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
    }

    public static string NormalizeMediaKey(string appId, string title, string? creator)
    {
        static string Part(string value) => new(value
            .Normalize(NormalizationForm.FormKC)
            .Where(char.IsLetterOrDigit)
            .Select(char.ToLowerInvariant)
            .ToArray());
        string app = Part(appId ?? "");
        string content = Part(title ?? "");
        string author = Part(creator ?? "");
        return string.IsNullOrWhiteSpace(app) || string.IsNullOrWhiteSpace(content)
            ? ""
            : $"{app}:{content}:{author}";
    }

    private static CloudGameHistoryEntryV1 CreateGame(
        string key,
        IEnumerable<GameHistoryEntry> entries)
    {
        List<GameHistoryEntry> ordered = entries
            .OrderByDescending(entry => entry.LastPlayed)
            .ThenBy(entry => entry.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
        GameHistoryEntry latest = ordered[0];

        DateTime firstPlayed = ordered
            .Where(entry => entry.FirstPlayed > DateTime.MinValue)
            .Select(entry => entry.FirstPlayed)
            .DefaultIfEmpty(DateTime.MinValue)
            .Min();
        DateTime lastPlayed = ordered
            .Select(entry => entry.LastPlayed)
            .DefaultIfEmpty(DateTime.MinValue)
            .Max();

        return new CloudGameHistoryEntryV1
        {
            GameKey = key,
            Name = latest.Name ?? "",
            TotalPlaytimeSeconds = MinutesToSeconds(SaturatingSum(ordered.Select(entry => entry.TotalPlaytimeMinutes))),
            LastSessionSeconds = MinutesToSeconds(latest.LastSessionMinutes, int.MaxValue),
            FirstPlayedUtc = ToUtc(firstPlayed),
            LastPlayedUtc = ToUtc(lastPlayed),
            ShowcaseVerticalImageUrl = FirstNotBlank(ordered.Select(entry => entry.ShowcaseVerticalImageUrl)),
            HistoryHorizontalImageUrl = FirstNotBlank(ordered.Select(entry => entry.HistoryHorizontalImageUrl)),
            ProfileBannerImageUrl = FirstNotBlank(ordered.Select(entry => entry.ProfileBannerImageUrl)),
            SteamGridGameId = ordered.Select(entry => entry.SteamGridGameId).FirstOrDefault(id => id > 0)
        };
    }

    private static CloudMediaHistoryEntryV1 CreateMedia(
        string key,
        IEnumerable<MediaActivityHistoryEntry> entries)
    {
        List<MediaActivityHistoryEntry> ordered = entries
            .OrderByDescending(entry => entry.LastPlayed)
            .ThenBy(entry => entry.ContentTitle, StringComparer.OrdinalIgnoreCase)
            .ToList();
        MediaActivityHistoryEntry latest = ordered[0];
        DateTime firstPlayed = ordered
            .Where(entry => entry.FirstPlayed > DateTime.MinValue)
            .Select(entry => entry.FirstPlayed)
            .DefaultIfEmpty(DateTime.MinValue)
            .Min();
        DateTime lastPlayed = ordered
            .Select(entry => entry.LastPlayed)
            .DefaultIfEmpty(DateTime.MinValue)
            .Max();
        long sessionCount = SaturatingSum(ordered.Select(entry => (long)Math.Max(0, entry.SessionCount)));
        MediaActivityHistoryEntry? artworkEntry = ordered.FirstOrDefault(entry =>
            !string.IsNullOrWhiteSpace(entry.ArtworkRemoteUrl));
        DateTime metadataCaptured = ordered
            .Where(entry => entry.MetadataCapturedUtc.HasValue)
            .Select(entry => entry.MetadataCapturedUtc!.Value)
            .DefaultIfEmpty(DateTime.MinValue)
            .Max();
        string dailyPlaybackDate = ordered
            .Select(entry => entry.DailyPlaybackDate ?? "")
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .OrderByDescending(value => value, StringComparer.Ordinal)
            .FirstOrDefault() ?? "";
        long dailyPlaybackSeconds = SaturatingSum(ordered
            .Where(entry => string.Equals(entry.DailyPlaybackDate, dailyPlaybackDate, StringComparison.Ordinal))
            .Select(entry => Math.Max(0, entry.DailyPlaybackSeconds)));
        return new CloudMediaHistoryEntryV1
        {
            MediaKey = key,
            AppId = latest.AppId ?? "",
            AppName = latest.AppName ?? "",
            Category = latest.Category ?? "",
            ContentTitle = latest.ContentTitle ?? "",
            CreatorName = latest.CreatorName ?? "",
            AlbumTitle = FirstNotBlank(ordered.Select(entry => entry.AlbumTitle)),
            SeriesTitle = FirstNotBlank(ordered.Select(entry => entry.SeriesTitle)),
            SeasonTitle = FirstNotBlank(ordered.Select(entry => entry.SeasonTitle)),
            EpisodeNumber = FirstNotBlank(ordered.Select(entry => entry.EpisodeNumber)),
            ContentType = FirstNotBlank(ordered.Select(entry => entry.ContentType)),
            PageUrl = FirstNotBlank(ordered.Select(entry => entry.PageUrl)),
            TitleSource = FirstNotBlank(ordered.Select(entry => entry.TitleSource)),
            MediaSessionAvailable = ordered.Any(entry => entry.MediaSessionAvailable),
            ArtworkRemoteUrl = artworkEntry?.ArtworkRemoteUrl ?? "",
            ArtworkSource = artworkEntry?.ArtworkSource ?? "",
            MetadataCapturedUtc = ToUtc(metadataCaptured),
            TotalPlaybackSeconds = SaturatingSum(ordered.Select(entry => entry.TotalPlaybackSeconds)),
            LastSessionSeconds = Math.Max(0, latest.LastSessionSeconds),
            DailyPlaybackDate = dailyPlaybackDate,
            DailyPlaybackSeconds = dailyPlaybackSeconds,
            SessionCount = (int)Math.Min(int.MaxValue, sessionCount),
            LastPositionSeconds = Math.Max(0, latest.LastPositionSeconds),
            DurationSeconds = Math.Max(0, latest.DurationSeconds),
            FirstPlayedUtc = ToUtc(firstPlayed),
            LastPlayedUtc = ToUtc(lastPlayed)
        };
    }

    private static CloudProfilePhotoV1 CreatePhoto(UserProfile profile)
    {
        byte[]? photoBytes = TryDecodeBase64(profile.PhotoBase64);
        return new CloudProfilePhotoV1
        {
            HasPhoto = photoBytes is { Length: > 0 },
            Source = profile.PhotoSource ?? "",
            SourceUrl = profile.PhotoSourceUrl ?? "",
            SteamGridAssetId = profile.PhotoSteamGridAssetId,
            CropX = profile.PhotoCropX,
            CropY = profile.PhotoCropY,
            Zoom = profile.PhotoZoom > 0 ? profile.PhotoZoom : 1,
            ContentHash = photoBytes is { Length: > 0 }
                ? ProfileSyncSerializer.ComputeBinaryHash(photoBytes)
                : ""
        };
    }

    private static byte[]? TryDecodeBase64(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        int comma = value.IndexOf(',');
        string payload = value.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && comma >= 0
            ? value[(comma + 1)..]
            : value;
        try { return Convert.FromBase64String(payload); }
        catch (FormatException) { return null; }
    }

    private static DateTimeOffset? ToUtc(DateTime value)
    {
        if (value <= DateTime.MinValue) return null;
        DateTime local = value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Local)
            : value;
        return new DateTimeOffset(local).ToUniversalTime();
    }

    private static long SaturatingSum(IEnumerable<long> values)
    {
        long total = 0;
        foreach (long raw in values)
        {
            long value = Math.Max(0, raw);
            total = total > long.MaxValue - value ? long.MaxValue : total + value;
        }
        return total;
    }

    private static long MinutesToSeconds(long minutes)
    {
        minutes = Math.Max(0, minutes);
        return minutes > long.MaxValue / 60 ? long.MaxValue : minutes * 60;
    }

    private static int MinutesToSeconds(int minutes, int maximum)
    {
        if (minutes <= 0) return 0;
        return minutes > maximum / 60 ? maximum : minutes * 60;
    }

    private static string FirstNotBlank(IEnumerable<string> values)
        => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "";
}

public static class ProfileSyncEngine
{
    public static (bool LocalChanged, bool RemoteChanged) MergeMissingArtwork(
        CloudProfileV1 local,
        CloudProfileV1 remote)
    {
        ArgumentNullException.ThrowIfNull(local);
        ArgumentNullException.ThrowIfNull(remote);

        Dictionary<string, CloudGameHistoryEntryV1> localGames = ToGameDictionary(local.Games);
        Dictionary<string, CloudGameHistoryEntryV1> remoteGames = ToGameDictionary(remote.Games);
        bool localChanged = false;
        bool remoteChanged = false;

        foreach (string key in localGames.Keys.Intersect(remoteGames.Keys, StringComparer.Ordinal))
        {
            CloudGameHistoryEntryV1 localGame = localGames[key];
            CloudGameHistoryEntryV1 remoteGame = remoteGames[key];
            if (string.IsNullOrWhiteSpace(localGame.ShowcaseVerticalImageUrl) &&
                !string.IsNullOrWhiteSpace(remoteGame.ShowcaseVerticalImageUrl))
            {
                localGame.ShowcaseVerticalImageUrl = remoteGame.ShowcaseVerticalImageUrl;
                localChanged = true;
            }
            if (string.IsNullOrWhiteSpace(remoteGame.ShowcaseVerticalImageUrl) &&
                !string.IsNullOrWhiteSpace(localGame.ShowcaseVerticalImageUrl))
            {
                remoteGame.ShowcaseVerticalImageUrl = localGame.ShowcaseVerticalImageUrl;
                remoteChanged = true;
            }
            if (string.IsNullOrWhiteSpace(localGame.HistoryHorizontalImageUrl) &&
                !string.IsNullOrWhiteSpace(remoteGame.HistoryHorizontalImageUrl))
            {
                localGame.HistoryHorizontalImageUrl = remoteGame.HistoryHorizontalImageUrl;
                localChanged = true;
            }
            if (string.IsNullOrWhiteSpace(remoteGame.HistoryHorizontalImageUrl) &&
                !string.IsNullOrWhiteSpace(localGame.HistoryHorizontalImageUrl))
            {
                remoteGame.HistoryHorizontalImageUrl = localGame.HistoryHorizontalImageUrl;
                remoteChanged = true;
            }
            if (string.IsNullOrWhiteSpace(localGame.ProfileBannerImageUrl) &&
                !string.IsNullOrWhiteSpace(remoteGame.ProfileBannerImageUrl))
            {
                localGame.ProfileBannerImageUrl = remoteGame.ProfileBannerImageUrl;
                localChanged = true;
            }
            if (string.IsNullOrWhiteSpace(remoteGame.ProfileBannerImageUrl) &&
                !string.IsNullOrWhiteSpace(localGame.ProfileBannerImageUrl))
            {
                remoteGame.ProfileBannerImageUrl = localGame.ProfileBannerImageUrl;
                remoteChanged = true;
            }
            if (localGame.SteamGridGameId <= 0 && remoteGame.SteamGridGameId > 0)
            {
                localGame.SteamGridGameId = remoteGame.SteamGridGameId;
                localChanged = true;
            }
            if (remoteGame.SteamGridGameId <= 0 && localGame.SteamGridGameId > 0)
            {
                remoteGame.SteamGridGameId = localGame.SteamGridGameId;
                remoteChanged = true;
            }
        }

        return (localChanged, remoteChanged);
    }

    public static ProfileSyncDecision Evaluate(
        CloudProfileV1 local,
        CloudProfileV1? remote,
        string? lastSyncedContentHash)
    {
        ArgumentNullException.ThrowIfNull(local);

        string localHash = ProfileSyncSerializer.ComputeContentHash(local);
        string baseHash = lastSyncedContentHash ?? "";
        if (remote == null)
        {
            return new ProfileSyncDecision
            {
                Action = ProfileSyncAction.RemoteMissing,
                LocalContentHash = localHash,
                BaseContentHash = baseHash
            };
        }

        ProfileSyncComparison comparison = Compare(local, remote);
        if (!comparison.HasDifferences)
        {
            return new ProfileSyncDecision
            {
                Action = ProfileSyncAction.None,
                LocalContentHash = comparison.LocalContentHash,
                RemoteContentHash = comparison.RemoteContentHash,
                BaseContentHash = baseHash
            };
        }

        if (string.IsNullOrWhiteSpace(baseHash))
        {
            return CreateDecision(ProfileSyncAction.InitialChoiceRequired, comparison, baseHash);
        }

        bool localChanged = !string.Equals(comparison.LocalContentHash, baseHash, StringComparison.Ordinal);
        bool remoteChanged = !string.Equals(comparison.RemoteContentHash, baseHash, StringComparison.Ordinal);

        if (localChanged && !remoteChanged)
            return CreateDecision(ProfileSyncAction.UploadLocal, comparison, baseHash);
        if (!localChanged && remoteChanged)
            return CreateDecision(ProfileSyncAction.DownloadRemote, comparison, baseHash);

        if (TryResolveDominatingUpdate(local, remote, comparison, out ProfileSyncAction dominantAction))
            return CreateDecision(dominantAction, comparison, baseHash);

        return CreateDecision(ProfileSyncAction.Conflict, comparison, baseHash);
    }

    public static ProfileThreeWayMergeResult MergeThreeWay(
        CloudProfileV1 baseline,
        CloudProfileV1 local,
        CloudProfileV1 remote)
    {
        ArgumentNullException.ThrowIfNull(baseline);
        ArgumentNullException.ThrowIfNull(local);
        ArgumentNullException.ThrowIfNull(remote);

        var conflictPaths = new HashSet<string>(StringComparer.Ordinal);
        CloudProfileV1 merged = CloneProfile(local);
        // Schema is a format capability, not editable user data. Prefer the newest
        // supported representation and never turn a v1 -> v2 migration into a
        // profile conflict.
        merged.SchemaVersion = Math.Max(local.SchemaVersion, remote.SchemaVersion);
        merged.ProfileId = local.ProfileId ?? "";
        merged.ProfileName = MergeValue(
            baseline.ProfileName ?? "", local.ProfileName ?? "", remote.ProfileName ?? "",
            "profileName", conflictPaths);
        merged.PinCode = MergeValue(
            baseline.PinCode ?? "", local.PinCode ?? "", remote.PinCode ?? "",
            "pinCode", conflictPaths);
        merged.SteamGridApiKey = MergeValue(
            baseline.SteamGridApiKey ?? "", local.SteamGridApiKey ?? "", remote.SteamGridApiKey ?? "",
            "steamGridApiKey", conflictPaths);
        merged.ApplicationHistoryEnabled = MergeValue(
            baseline.ApplicationHistoryEnabled,
            local.ApplicationHistoryEnabled,
            remote.ApplicationHistoryEnabled,
            "applicationHistoryEnabled", conflictPaths);
        merged.CreatedAtUtc = MergeValue(
            baseline.CreatedAtUtc?.ToUniversalTime(),
            local.CreatedAtUtc?.ToUniversalTime(),
            remote.CreatedAtUtc?.ToUniversalTime(),
            "createdAtUtc", conflictPaths);
        merged.ProfilePhoto = MergePhoto(
            baseline.ProfilePhoto,
            local.ProfilePhoto,
            remote.ProfilePhoto,
            conflictPaths);

        Dictionary<string, CloudGameHistoryEntryV1> baseGames = ToGameDictionary(baseline.Games);
        Dictionary<string, CloudGameHistoryEntryV1> localGames = ToGameDictionary(local.Games);
        Dictionary<string, CloudGameHistoryEntryV1> remoteGames = ToGameDictionary(remote.Games);
        var mergedGames = new List<CloudGameHistoryEntryV1>();

        foreach (string key in baseGames.Keys
                     .Union(localGames.Keys, StringComparer.Ordinal)
                     .Union(remoteGames.Keys, StringComparer.Ordinal)
                     .OrderBy(value => value, StringComparer.Ordinal))
        {
            baseGames.TryGetValue(key, out CloudGameHistoryEntryV1? baseGame);
            localGames.TryGetValue(key, out CloudGameHistoryEntryV1? localGame);
            remoteGames.TryGetValue(key, out CloudGameHistoryEntryV1? remoteGame);

            // Com ancestral comum, uma ausência pode representar exclusão explícita.
            if (baseGame == null)
            {
                if (localGame == null && remoteGame == null) continue;
                if (localGame == null) mergedGames.Add(CloneGame(remoteGame!));
                else if (remoteGame == null) mergedGames.Add(CloneGame(localGame));
                else mergedGames.Add(MergeGame(
                    key,
                    new CloudGameHistoryEntryV1 { GameKey = key },
                    localGame,
                    remoteGame,
                    conflictPaths));
                continue;
            }

            if (localGame == null && remoteGame == null) continue;
            if (localGame == null)
            {
                if (GameContentEquals(baseGame, remoteGame!)) continue;
                conflictPaths.Add($"games.{key}");
                continue;
            }
            if (remoteGame == null)
            {
                if (GameContentEquals(baseGame, localGame)) continue;
                conflictPaths.Add($"games.{key}");
                mergedGames.Add(CloneGame(localGame));
                continue;
            }

            mergedGames.Add(MergeGame(key, baseGame, localGame, remoteGame, conflictPaths));
        }

        merged.Games = mergedGames;
        merged.MediaHistory = MergeMediaHistoryThreeWay(
            baseline.MediaHistory,
            local.MediaHistory,
            remote.MediaHistory,
            conflictPaths);
        merged.ControlProfiles = MergeControlProfiles(local.ControlProfiles, remote.ControlProfiles);
        merged.ControlAssignments = MergeControlAssignments(local.ControlAssignments, remote.ControlAssignments);
        merged.TotalPlaytimeSeconds = SaturatingSum(mergedGames.Select(game => game.TotalPlaytimeSeconds));
        merged.TotalMediaPlaybackSeconds = SaturatingSum(merged.MediaHistory.Select(entry => entry.TotalPlaybackSeconds));
        merged.UpdatedAtUtc = DateTimeOffset.UtcNow;
        merged.LastModifiedDeviceId = local.LastModifiedDeviceId ?? "";

        ProfileSyncComparison comparison = Compare(local, remote);
        IReadOnlyList<ProfileDifference> conflicts = comparison.Differences
            .Where(difference => conflictPaths.Contains(difference.Path))
            .ToList();
        string mergedHash = ProfileSyncSerializer.ComputeContentHash(merged);

        return new ProfileThreeWayMergeResult
        {
            MergedProfile = merged,
            Conflicts = conflicts,
            LocalNeedsUpdate = !string.Equals(
                mergedHash, comparison.LocalContentHash, StringComparison.Ordinal),
            RemoteNeedsUpdate = !string.Equals(
                mergedHash, comparison.RemoteContentHash, StringComparison.Ordinal)
        };
    }

    public static ProfileThreeWayMergeResult MergeLegacy(
        CloudProfileV1 local,
        CloudProfileV1 remote)
    {
        ArgumentNullException.ThrowIfNull(local);
        ArgumentNullException.ThrowIfNull(remote);

        // Perfis das versoes anteriores nao possuem o ancestral comum. Nesse caso,
        // preserve a uniao do historico e o maior tempo conhecido, mas ainda exija
        // escolha para edicoes concorrentes que nao podem ser inferidas com seguranca.
        var conflictPaths = new HashSet<string>(StringComparer.Ordinal);
        CloudProfileV1 merged = CloneProfile(local);
        merged.SchemaVersion = Math.Max(local.SchemaVersion, remote.SchemaVersion);
        merged.ProfileId = local.ProfileId ?? "";
        merged.ProfileName = MergeLegacyValue(
            local.ProfileName ?? "", remote.ProfileName ?? "", "profileName", conflictPaths);
        merged.PinCode = MergeLegacyValue(
            local.PinCode ?? "", remote.PinCode ?? "", "pinCode", conflictPaths);
        merged.SteamGridApiKey = MergeLegacyValue(
            local.SteamGridApiKey ?? "", remote.SteamGridApiKey ?? "", "steamGridApiKey", conflictPaths);
        merged.ApplicationHistoryEnabled = MergeLegacyValue(
            local.ApplicationHistoryEnabled,
            remote.SchemaVersion >= 3 ? remote.ApplicationHistoryEnabled : local.ApplicationHistoryEnabled,
            "applicationHistoryEnabled", conflictPaths);
        merged.CreatedAtUtc = Earliest(local.CreatedAtUtc, remote.CreatedAtUtc);
        merged.ProfilePhoto = MergeLegacyPhoto(local.ProfilePhoto, remote.ProfilePhoto, conflictPaths);

        Dictionary<string, CloudGameHistoryEntryV1> localGames = ToGameDictionary(local.Games);
        Dictionary<string, CloudGameHistoryEntryV1> remoteGames = ToGameDictionary(remote.Games);
        var mergedGames = new List<CloudGameHistoryEntryV1>();
        foreach (string key in localGames.Keys
                     .Union(remoteGames.Keys, StringComparer.Ordinal)
                     .OrderBy(value => value, StringComparer.Ordinal))
        {
            localGames.TryGetValue(key, out CloudGameHistoryEntryV1? localGame);
            remoteGames.TryGetValue(key, out CloudGameHistoryEntryV1? remoteGame);
            if (localGame == null) mergedGames.Add(CloneGame(remoteGame!));
            else if (remoteGame == null) mergedGames.Add(CloneGame(localGame));
            else mergedGames.Add(MergeLegacyGame(key, localGame, remoteGame, conflictPaths));
        }

        merged.Games = mergedGames;
        merged.MediaHistory = MergeMediaHistoryLegacy(local.MediaHistory, remote.MediaHistory, conflictPaths);
        merged.ControlProfiles = MergeControlProfiles(local.ControlProfiles, remote.ControlProfiles);
        merged.ControlAssignments = MergeControlAssignments(local.ControlAssignments, remote.ControlAssignments);
        merged.TotalPlaytimeSeconds = SaturatingSum(mergedGames.Select(game => game.TotalPlaytimeSeconds));
        merged.TotalMediaPlaybackSeconds = SaturatingSum(merged.MediaHistory.Select(entry => entry.TotalPlaybackSeconds));
        merged.UpdatedAtUtc = DateTimeOffset.UtcNow;
        merged.LastModifiedDeviceId = local.LastModifiedDeviceId ?? "";

        ProfileSyncComparison comparison = Compare(local, remote);
        string mergedHash = ProfileSyncSerializer.ComputeContentHash(merged);
        return new ProfileThreeWayMergeResult
        {
            MergedProfile = merged,
            Conflicts = comparison.Differences
                .Where(difference => conflictPaths.Contains(difference.Path))
                .ToList(),
            LocalNeedsUpdate = !string.Equals(
                mergedHash, comparison.LocalContentHash, StringComparison.Ordinal),
            RemoteNeedsUpdate = !string.Equals(
                mergedHash, comparison.RemoteContentHash, StringComparison.Ordinal)
        };
    }

    public static bool TryResolveDominatingUpdate(
        CloudProfileV1 local,
        CloudProfileV1 remote,
        ProfileSyncComparison comparison,
        out ProfileSyncAction action)
    {
        action = ProfileSyncAction.Conflict;
        if (comparison.Differences.Any(difference => difference.Kind is not (
                ProfileDifferenceKind.SchemaVersion or
                ProfileDifferenceKind.TotalPlaytime or
                ProfileDifferenceKind.GameAdded or
                ProfileDifferenceKind.GameRemoved or
                ProfileDifferenceKind.GamePlaytime or
                ProfileDifferenceKind.GameLastSession or
                ProfileDifferenceKind.GameFirstPlayed or
                ProfileDifferenceKind.GameLastPlayed or
                ProfileDifferenceKind.TotalMediaPlayback or
                ProfileDifferenceKind.MediaAdded or
                ProfileDifferenceKind.MediaRemoved or
                ProfileDifferenceKind.MediaPlayback or
                ProfileDifferenceKind.MediaLastSession or
                ProfileDifferenceKind.MediaDailyPlayback or
                ProfileDifferenceKind.MediaSessionCount or
                ProfileDifferenceKind.MediaFirstPlayed or
                ProfileDifferenceKind.MediaLastPlayed or
                ProfileDifferenceKind.MediaMetadata or
                ProfileDifferenceKind.MediaArtwork)))
            return false;

        Dictionary<string, CloudGameHistoryEntryV1> localGames = ToGameDictionary(local.Games);
        Dictionary<string, CloudGameHistoryEntryV1> remoteGames = ToGameDictionary(remote.Games);
        bool localDominates = true;
        bool remoteDominates = true;

        foreach (string key in localGames.Keys.Union(remoteGames.Keys, StringComparer.Ordinal))
        {
            bool hasLocal = localGames.TryGetValue(key, out CloudGameHistoryEntryV1? localGame);
            bool hasRemote = remoteGames.TryGetValue(key, out CloudGameHistoryEntryV1? remoteGame);
            if (!hasRemote)
            {
                remoteDominates = false;
                continue;
            }
            if (!hasLocal)
            {
                localDominates = false;
                continue;
            }

            if (localGame!.TotalPlaytimeSeconds < remoteGame!.TotalPlaytimeSeconds) localDominates = false;
            if (remoteGame.TotalPlaytimeSeconds < localGame.TotalPlaytimeSeconds) remoteDominates = false;

            int lastPlayedOrder = CompareNullableDate(localGame.LastPlayedUtc, remoteGame.LastPlayedUtc);
            if (lastPlayedOrder < 0) localDominates = false;
            if (lastPlayedOrder > 0) remoteDominates = false;

            int firstPlayedOrder = CompareNullableDate(localGame.FirstPlayedUtc, remoteGame.FirstPlayedUtc);
            if (firstPlayedOrder > 0) localDominates = false;
            if (firstPlayedOrder < 0) remoteDominates = false;

            if (localGame.LastSessionSeconds != remoteGame.LastSessionSeconds && lastPlayedOrder == 0)
            {
                localDominates = false;
                remoteDominates = false;
            }
        }

        Dictionary<string, CloudMediaHistoryEntryV1> localMedia = ToMediaDictionary(local.MediaHistory);
        Dictionary<string, CloudMediaHistoryEntryV1> remoteMedia = ToMediaDictionary(remote.MediaHistory);
        foreach (string key in localMedia.Keys.Union(remoteMedia.Keys, StringComparer.Ordinal))
        {
            bool hasLocal = localMedia.TryGetValue(key, out CloudMediaHistoryEntryV1? localEntry);
            bool hasRemote = remoteMedia.TryGetValue(key, out CloudMediaHistoryEntryV1? remoteEntry);
            if (!hasRemote) { remoteDominates = false; continue; }
            if (!hasLocal) { localDominates = false; continue; }
            if (localEntry!.TotalPlaybackSeconds < remoteEntry!.TotalPlaybackSeconds) localDominates = false;
            if (remoteEntry.TotalPlaybackSeconds < localEntry.TotalPlaybackSeconds) remoteDominates = false;
            if (localEntry.SessionCount < remoteEntry.SessionCount) localDominates = false;
            if (remoteEntry.SessionCount < localEntry.SessionCount) remoteDominates = false;
            int lastPlayedOrder = CompareNullableDate(localEntry.LastPlayedUtc, remoteEntry.LastPlayedUtc);
            if (lastPlayedOrder < 0) localDominates = false;
            if (lastPlayedOrder > 0) remoteDominates = false;
            int firstPlayedOrder = CompareNullableDate(localEntry.FirstPlayedUtc, remoteEntry.FirstPlayedUtc);
            if (firstPlayedOrder > 0) localDominates = false;
            if (firstPlayedOrder < 0) remoteDominates = false;
        }

        if (localDominates == remoteDominates)
        {
            // Se os dados sÃ£o equivalentes e sÃ³ a capacidade do formato mudou,
            // a versÃ£o mais nova deve migrar a nuvem sem abrir um falso conflito.
            if (localDominates && local.SchemaVersion != remote.SchemaVersion)
            {
                action = local.SchemaVersion > remote.SchemaVersion
                    ? ProfileSyncAction.UploadLocal
                    : ProfileSyncAction.DownloadRemote;
                return true;
            }
            return false;
        }
        action = localDominates ? ProfileSyncAction.UploadLocal : ProfileSyncAction.DownloadRemote;
        return true;
    }

    private static CloudGameHistoryEntryV1 MergeGame(
        string key,
        CloudGameHistoryEntryV1 baseline,
        CloudGameHistoryEntryV1 local,
        CloudGameHistoryEntryV1 remote,
        HashSet<string> conflictPaths)
    {
        string prefix = $"games.{key}.";
        DateTimeOffset? localLastPlayed = NormalizeDate(local.LastPlayedUtc);
        DateTimeOffset? remoteLastPlayed = NormalizeDate(remote.LastPlayedUtc);
        int latestSide = CompareNullableDate(localLastPlayed, remoteLastPlayed);
        return new CloudGameHistoryEntryV1
        {
            GameKey = key,
            Name = MergeValue(baseline.Name ?? "", local.Name ?? "", remote.Name ?? "",
                prefix + "name", conflictPaths),
            TotalPlaytimeSeconds = MergeAccumulatedPlaytime(
                baseline.TotalPlaytimeSeconds,
                local.TotalPlaytimeSeconds,
                remote.TotalPlaytimeSeconds),
            LastSessionSeconds = latestSide > 0
                ? Math.Max(0, local.LastSessionSeconds)
                : latestSide < 0
                    ? Math.Max(0, remote.LastSessionSeconds)
                    : Math.Max(Math.Max(0, local.LastSessionSeconds), Math.Max(0, remote.LastSessionSeconds)),
            FirstPlayedUtc = Earliest(
                baseline.FirstPlayedUtc,
                Earliest(local.FirstPlayedUtc, remote.FirstPlayedUtc)),
            LastPlayedUtc = Latest(
                baseline.LastPlayedUtc,
                Latest(local.LastPlayedUtc, remote.LastPlayedUtc)),
            ShowcaseVerticalImageUrl = MergeValue(
                baseline.ShowcaseVerticalImageUrl ?? "",
                local.ShowcaseVerticalImageUrl ?? "",
                remote.ShowcaseVerticalImageUrl ?? "",
                prefix + "showcaseVerticalImageUrl", conflictPaths),
            HistoryHorizontalImageUrl = MergeValue(
                baseline.HistoryHorizontalImageUrl ?? "",
                local.HistoryHorizontalImageUrl ?? "",
                remote.HistoryHorizontalImageUrl ?? "",
                prefix + "historyHorizontalImageUrl", conflictPaths),
            ProfileBannerImageUrl = MergeValue(
                baseline.ProfileBannerImageUrl ?? "",
                local.ProfileBannerImageUrl ?? "",
                remote.ProfileBannerImageUrl ?? "",
                prefix + "profileBannerImageUrl", conflictPaths),
            SteamGridGameId = MergeValue(
                baseline.SteamGridGameId,
                local.SteamGridGameId,
                remote.SteamGridGameId,
                prefix + "steamGridGameId", conflictPaths)
        };
    }

    private static CloudGameHistoryEntryV1 MergeLegacyGame(
        string key,
        CloudGameHistoryEntryV1 local,
        CloudGameHistoryEntryV1 remote,
        HashSet<string> conflictPaths)
    {
        string prefix = $"games.{key}.";
        int latestSide = CompareNullableDate(local.LastPlayedUtc, remote.LastPlayedUtc);
        return new CloudGameHistoryEntryV1
        {
            GameKey = key,
            Name = MergeLegacyValue(local.Name ?? "", remote.Name ?? "", prefix + "name", conflictPaths),
            TotalPlaytimeSeconds = Math.Max(
                Math.Max(0, local.TotalPlaytimeSeconds),
                Math.Max(0, remote.TotalPlaytimeSeconds)),
            LastSessionSeconds = latestSide > 0
                ? Math.Max(0, local.LastSessionSeconds)
                : latestSide < 0
                    ? Math.Max(0, remote.LastSessionSeconds)
                    : Math.Max(Math.Max(0, local.LastSessionSeconds), Math.Max(0, remote.LastSessionSeconds)),
            FirstPlayedUtc = Earliest(local.FirstPlayedUtc, remote.FirstPlayedUtc),
            LastPlayedUtc = Latest(local.LastPlayedUtc, remote.LastPlayedUtc),
            ShowcaseVerticalImageUrl = MergeLegacyOptionalValue(
                local.ShowcaseVerticalImageUrl, remote.ShowcaseVerticalImageUrl,
                prefix + "showcaseVerticalImageUrl", conflictPaths),
            HistoryHorizontalImageUrl = MergeLegacyOptionalValue(
                local.HistoryHorizontalImageUrl, remote.HistoryHorizontalImageUrl,
                prefix + "historyHorizontalImageUrl", conflictPaths),
            ProfileBannerImageUrl = MergeLegacyOptionalValue(
                local.ProfileBannerImageUrl, remote.ProfileBannerImageUrl,
                prefix + "profileBannerImageUrl", conflictPaths),
            SteamGridGameId = MergeLegacyOptionalValue(
                local.SteamGridGameId, remote.SteamGridGameId,
                prefix + "steamGridGameId", conflictPaths)
        };
    }

    private static List<CloudMediaHistoryEntryV1> MergeMediaHistoryThreeWay(
        IEnumerable<CloudMediaHistoryEntryV1>? baseline,
        IEnumerable<CloudMediaHistoryEntryV1>? local,
        IEnumerable<CloudMediaHistoryEntryV1>? remote,
        HashSet<string> conflictPaths)
    {
        Dictionary<string, CloudMediaHistoryEntryV1> baseEntries = ToMediaDictionary(baseline);
        Dictionary<string, CloudMediaHistoryEntryV1> localEntries = ToMediaDictionary(local);
        Dictionary<string, CloudMediaHistoryEntryV1> remoteEntries = ToMediaDictionary(remote);
        var merged = new List<CloudMediaHistoryEntryV1>();
        foreach (string key in baseEntries.Keys
                     .Union(localEntries.Keys, StringComparer.Ordinal)
                     .Union(remoteEntries.Keys, StringComparer.Ordinal)
                     .OrderBy(value => value, StringComparer.Ordinal))
        {
            baseEntries.TryGetValue(key, out CloudMediaHistoryEntryV1? baseEntry);
            localEntries.TryGetValue(key, out CloudMediaHistoryEntryV1? localEntry);
            remoteEntries.TryGetValue(key, out CloudMediaHistoryEntryV1? remoteEntry);
            if (baseEntry == null)
            {
                if (localEntry == null && remoteEntry == null) continue;
                if (localEntry == null) merged.Add(CloneMedia(remoteEntry!));
                else if (remoteEntry == null) merged.Add(CloneMedia(localEntry));
                else merged.Add(MergeMedia(key, new CloudMediaHistoryEntryV1 { MediaKey = key }, localEntry, remoteEntry));
                continue;
            }
            if (localEntry == null && remoteEntry == null) continue;
            if (localEntry == null)
            {
                if (!MediaContentEquals(baseEntry, remoteEntry!)) conflictPaths.Add($"mediaHistory.{key}");
                continue;
            }
            if (remoteEntry == null)
            {
                if (!MediaContentEquals(baseEntry, localEntry)) conflictPaths.Add($"mediaHistory.{key}");
                merged.Add(CloneMedia(localEntry));
                continue;
            }
            merged.Add(MergeMedia(key, baseEntry, localEntry, remoteEntry));
        }
        return merged;
    }

    private static List<CloudMediaHistoryEntryV1> MergeMediaHistoryLegacy(
        IEnumerable<CloudMediaHistoryEntryV1>? local,
        IEnumerable<CloudMediaHistoryEntryV1>? remote,
        HashSet<string> conflictPaths)
    {
        Dictionary<string, CloudMediaHistoryEntryV1> localEntries = ToMediaDictionary(local);
        Dictionary<string, CloudMediaHistoryEntryV1> remoteEntries = ToMediaDictionary(remote);
        var merged = new List<CloudMediaHistoryEntryV1>();
        foreach (string key in localEntries.Keys.Union(remoteEntries.Keys, StringComparer.Ordinal).OrderBy(value => value, StringComparer.Ordinal))
        {
            localEntries.TryGetValue(key, out CloudMediaHistoryEntryV1? localEntry);
            remoteEntries.TryGetValue(key, out CloudMediaHistoryEntryV1? remoteEntry);
            if (localEntry == null) merged.Add(CloneMedia(remoteEntry!));
            else if (remoteEntry == null) merged.Add(CloneMedia(localEntry));
            else merged.Add(MergeLegacyMedia(key, localEntry, remoteEntry));
        }
        return merged;
    }

    private static CloudMediaHistoryEntryV1 MergeMedia(
        string key,
        CloudMediaHistoryEntryV1 baseline,
        CloudMediaHistoryEntryV1 local,
        CloudMediaHistoryEntryV1 remote)
    {
        int latestSide = CompareNullableDate(local.LastPlayedUtc, remote.LastPlayedUtc);
        CloudMediaHistoryEntryV1 latest = latestSide < 0 ? remote : local;
        (string DailyDate, long DailySeconds) daily = MergeDailyPlayback(baseline, local, remote);
        return new CloudMediaHistoryEntryV1
        {
            MediaKey = key,
            AppId = FirstNotBlank(latest.AppId, local.AppId, remote.AppId),
            AppName = FirstNotBlank(latest.AppName, local.AppName, remote.AppName),
            Category = FirstNotBlank(latest.Category, local.Category, remote.Category),
            ContentTitle = FirstNotBlank(latest.ContentTitle, local.ContentTitle, remote.ContentTitle),
            CreatorName = FirstNotBlank(latest.CreatorName, local.CreatorName, remote.CreatorName),
            AlbumTitle = FirstNotBlank(latest.AlbumTitle, local.AlbumTitle, remote.AlbumTitle),
            SeriesTitle = FirstNotBlank(latest.SeriesTitle, local.SeriesTitle, remote.SeriesTitle),
            SeasonTitle = FirstNotBlank(latest.SeasonTitle, local.SeasonTitle, remote.SeasonTitle),
            EpisodeNumber = FirstNotBlank(latest.EpisodeNumber, local.EpisodeNumber, remote.EpisodeNumber),
            ContentType = FirstNotBlank(latest.ContentType, local.ContentType, remote.ContentType),
            PageUrl = FirstNotBlank(latest.PageUrl, local.PageUrl, remote.PageUrl),
            TitleSource = FirstNotBlank(latest.TitleSource, local.TitleSource, remote.TitleSource),
            MediaSessionAvailable = baseline.MediaSessionAvailable || local.MediaSessionAvailable || remote.MediaSessionAvailable,
            ArtworkRemoteUrl = FirstNotBlank(latest.ArtworkRemoteUrl, local.ArtworkRemoteUrl, remote.ArtworkRemoteUrl),
            ArtworkSource = FirstNotBlank(latest.ArtworkSource, local.ArtworkSource, remote.ArtworkSource),
            MetadataCapturedUtc = Latest(baseline.MetadataCapturedUtc, Latest(local.MetadataCapturedUtc, remote.MetadataCapturedUtc)),
            TotalPlaybackSeconds = MergeAccumulatedPlaytime(
                baseline.TotalPlaybackSeconds,
                local.TotalPlaybackSeconds,
                remote.TotalPlaybackSeconds),
            LastSessionSeconds = Math.Max(0, latest.LastSessionSeconds),
            DailyPlaybackDate = daily.DailyDate,
            DailyPlaybackSeconds = daily.DailySeconds,
            SessionCount = MergeAccumulatedCount(baseline.SessionCount, local.SessionCount, remote.SessionCount),
            LastPositionSeconds = Math.Max(0, latest.LastPositionSeconds),
            DurationSeconds = Math.Max(0, latest.DurationSeconds),
            FirstPlayedUtc = Earliest(baseline.FirstPlayedUtc, Earliest(local.FirstPlayedUtc, remote.FirstPlayedUtc)),
            LastPlayedUtc = Latest(baseline.LastPlayedUtc, Latest(local.LastPlayedUtc, remote.LastPlayedUtc))
        };
    }

    private static CloudMediaHistoryEntryV1 MergeLegacyMedia(
        string key,
        CloudMediaHistoryEntryV1 local,
        CloudMediaHistoryEntryV1 remote)
    {
        int latestSide = CompareNullableDate(local.LastPlayedUtc, remote.LastPlayedUtc);
        CloudMediaHistoryEntryV1 latest = latestSide < 0 ? remote : local;
        (string DailyDate, long DailySeconds) daily = MergeDailyPlayback(
            new CloudMediaHistoryEntryV1(), local, remote);
        return new CloudMediaHistoryEntryV1
        {
            MediaKey = key,
            AppId = FirstNotBlank(latest.AppId, local.AppId, remote.AppId),
            AppName = FirstNotBlank(latest.AppName, local.AppName, remote.AppName),
            Category = FirstNotBlank(latest.Category, local.Category, remote.Category),
            ContentTitle = FirstNotBlank(latest.ContentTitle, local.ContentTitle, remote.ContentTitle),
            CreatorName = FirstNotBlank(latest.CreatorName, local.CreatorName, remote.CreatorName),
            AlbumTitle = FirstNotBlank(latest.AlbumTitle, local.AlbumTitle, remote.AlbumTitle),
            SeriesTitle = FirstNotBlank(latest.SeriesTitle, local.SeriesTitle, remote.SeriesTitle),
            SeasonTitle = FirstNotBlank(latest.SeasonTitle, local.SeasonTitle, remote.SeasonTitle),
            EpisodeNumber = FirstNotBlank(latest.EpisodeNumber, local.EpisodeNumber, remote.EpisodeNumber),
            ContentType = FirstNotBlank(latest.ContentType, local.ContentType, remote.ContentType),
            PageUrl = FirstNotBlank(latest.PageUrl, local.PageUrl, remote.PageUrl),
            TitleSource = FirstNotBlank(latest.TitleSource, local.TitleSource, remote.TitleSource),
            MediaSessionAvailable = local.MediaSessionAvailable || remote.MediaSessionAvailable,
            ArtworkRemoteUrl = FirstNotBlank(latest.ArtworkRemoteUrl, local.ArtworkRemoteUrl, remote.ArtworkRemoteUrl),
            ArtworkSource = FirstNotBlank(latest.ArtworkSource, local.ArtworkSource, remote.ArtworkSource),
            MetadataCapturedUtc = Latest(local.MetadataCapturedUtc, remote.MetadataCapturedUtc),
            TotalPlaybackSeconds = Math.Max(Math.Max(0, local.TotalPlaybackSeconds), Math.Max(0, remote.TotalPlaybackSeconds)),
            LastSessionSeconds = Math.Max(0, latest.LastSessionSeconds),
            DailyPlaybackDate = daily.DailyDate,
            DailyPlaybackSeconds = daily.DailySeconds,
            SessionCount = Math.Max(Math.Max(0, local.SessionCount), Math.Max(0, remote.SessionCount)),
            LastPositionSeconds = Math.Max(0, latest.LastPositionSeconds),
            DurationSeconds = Math.Max(0, latest.DurationSeconds),
            FirstPlayedUtc = Earliest(local.FirstPlayedUtc, remote.FirstPlayedUtc),
            LastPlayedUtc = Latest(local.LastPlayedUtc, remote.LastPlayedUtc)
        };
    }

    private static int MergeAccumulatedCount(int baseline, int local, int remote)
    {
        long merged = MergeAccumulatedPlaytime(baseline, local, remote);
        return (int)Math.Min(int.MaxValue, merged);
    }

    private static (string DailyDate, long DailySeconds) MergeDailyPlayback(
        CloudMediaHistoryEntryV1 baseline,
        CloudMediaHistoryEntryV1 local,
        CloudMediaHistoryEntryV1 remote)
    {
        string baseDate = baseline.DailyPlaybackDate ?? "";
        string localDate = local.DailyPlaybackDate ?? "";
        string remoteDate = remote.DailyPlaybackDate ?? "";
        string newestDate = new[] { baseDate, localDate, remoteDate }
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .OrderByDescending(value => value, StringComparer.Ordinal)
            .FirstOrDefault() ?? "";
        if (string.IsNullOrWhiteSpace(newestDate)) return ("", 0);

        long baseSeconds = string.Equals(baseDate, newestDate, StringComparison.Ordinal)
            ? Math.Max(0, baseline.DailyPlaybackSeconds)
            : 0;
        long localSeconds = string.Equals(localDate, newestDate, StringComparison.Ordinal)
            ? Math.Max(0, local.DailyPlaybackSeconds)
            : 0;
        long remoteSeconds = string.Equals(remoteDate, newestDate, StringComparison.Ordinal)
            ? Math.Max(0, remote.DailyPlaybackSeconds)
            : 0;
        return (newestDate, MergeAccumulatedPlaytime(baseSeconds, localSeconds, remoteSeconds));
    }

    private static string FirstNotBlank(params string?[] values)
        => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "";

    private static long MergeAccumulatedPlaytime(long baseline, long local, long remote)
    {
        baseline = Math.Max(0, baseline);
        local = Math.Max(0, local);
        remote = Math.Max(0, remote);
        if (local == remote) return Math.Max(baseline, local);
        long localIncrement = Math.Max(0, local - baseline);
        long remoteIncrement = Math.Max(0, remote - baseline);
        return SaturatingAdd(baseline, SaturatingAdd(localIncrement, remoteIncrement));
    }

    private static CloudProfilePhotoV1 MergePhoto(
        CloudProfilePhotoV1? baseline,
        CloudProfilePhotoV1? local,
        CloudProfilePhotoV1? remote,
        HashSet<string> conflictPaths)
    {
        baseline ??= new CloudProfilePhotoV1();
        local ??= new CloudProfilePhotoV1();
        remote ??= new CloudProfilePhotoV1();
        string baseFingerprint = PhotoFingerprint(baseline);
        string localFingerprint = PhotoFingerprint(local);
        string remoteFingerprint = PhotoFingerprint(remote);
        string selected = MergeValue(
            baseFingerprint, localFingerprint, remoteFingerprint,
            "profilePhoto", conflictPaths);
        return ClonePhoto(string.Equals(selected, remoteFingerprint, StringComparison.Ordinal) ? remote : local);
    }

    private static CloudProfilePhotoV1 MergeLegacyPhoto(
        CloudProfilePhotoV1? local,
        CloudProfilePhotoV1? remote,
        HashSet<string> conflictPaths)
    {
        local ??= new CloudProfilePhotoV1();
        remote ??= new CloudProfilePhotoV1();
        string localFingerprint = PhotoFingerprint(local);
        string remoteFingerprint = PhotoFingerprint(remote);
        if (string.Equals(localFingerprint, remoteFingerprint, StringComparison.Ordinal))
            return ClonePhoto(local);
        if (!local.HasPhoto) return ClonePhoto(remote);
        if (!remote.HasPhoto) return ClonePhoto(local);
        conflictPaths.Add("profilePhoto");
        return ClonePhoto(local);
    }

    private static T MergeValue<T>(
        T baseline,
        T local,
        T remote,
        string path,
        HashSet<string> conflictPaths)
    {
        var comparer = EqualityComparer<T>.Default;
        if (comparer.Equals(local, remote)) return local;
        if (comparer.Equals(local, baseline)) return remote;
        if (comparer.Equals(remote, baseline)) return local;
        conflictPaths.Add(path);
        return local;
    }

    private static T MergeLegacyValue<T>(
        T local,
        T remote,
        string path,
        HashSet<string> conflictPaths)
    {
        if (EqualityComparer<T>.Default.Equals(local, remote)) return local;
        conflictPaths.Add(path);
        return local;
    }

    private static string MergeLegacyOptionalValue(
        string? local,
        string? remote,
        string path,
        HashSet<string> conflictPaths)
    {
        local ??= "";
        remote ??= "";
        if (string.Equals(local, remote, StringComparison.Ordinal)) return local;
        if (string.IsNullOrWhiteSpace(local)) return remote;
        if (string.IsNullOrWhiteSpace(remote)) return local;
        conflictPaths.Add(path);
        return local;
    }

    private static int MergeLegacyOptionalValue(
        int local,
        int remote,
        string path,
        HashSet<string> conflictPaths)
    {
        if (local == remote) return local;
        if (local <= 0) return remote;
        if (remote <= 0) return local;
        conflictPaths.Add(path);
        return local;
    }

    private static int CompareNullableDate(DateTimeOffset? left, DateTimeOffset? right)
    {
        if (!left.HasValue) return right.HasValue ? -1 : 0;
        if (!right.HasValue) return 1;
        return left.Value.ToUniversalTime().CompareTo(right.Value.ToUniversalTime());
    }

    private static DateTimeOffset? Earliest(DateTimeOffset? left, DateTimeOffset? right)
    {
        left = NormalizeDate(left);
        right = NormalizeDate(right);
        if (!left.HasValue) return right;
        if (!right.HasValue) return left;
        return left.Value <= right.Value ? left : right;
    }

    private static DateTimeOffset? Latest(DateTimeOffset? left, DateTimeOffset? right)
    {
        left = NormalizeDate(left);
        right = NormalizeDate(right);
        if (!left.HasValue) return right;
        if (!right.HasValue) return left;
        return left.Value >= right.Value ? left : right;
    }

    private static DateTimeOffset? NormalizeDate(DateTimeOffset? value)
        => value?.ToUniversalTime();

    private static CloudProfileV1 CloneProfile(CloudProfileV1 profile)
        => ProfileSyncSerializer.DeserializeProfile(ProfileSyncSerializer.SerializeProfile(profile))
           ?? throw new InvalidOperationException("Não foi possível clonar o perfil sincronizado.");

    private static CloudGameHistoryEntryV1 CloneGame(CloudGameHistoryEntryV1 game)
        => new()
        {
            GameKey = game.GameKey ?? "",
            Name = game.Name ?? "",
            TotalPlaytimeSeconds = Math.Max(0, game.TotalPlaytimeSeconds),
            LastSessionSeconds = Math.Max(0, game.LastSessionSeconds),
            FirstPlayedUtc = game.FirstPlayedUtc?.ToUniversalTime(),
            LastPlayedUtc = game.LastPlayedUtc?.ToUniversalTime(),
            ShowcaseVerticalImageUrl = game.ShowcaseVerticalImageUrl ?? "",
            HistoryHorizontalImageUrl = game.HistoryHorizontalImageUrl ?? "",
            ProfileBannerImageUrl = game.ProfileBannerImageUrl ?? "",
            SteamGridGameId = game.SteamGridGameId
        };

    private static CloudMediaHistoryEntryV1 CloneMedia(CloudMediaHistoryEntryV1 entry)
        => new()
        {
            MediaKey = entry.MediaKey ?? "",
            AppId = entry.AppId ?? "",
            AppName = entry.AppName ?? "",
            Category = entry.Category ?? "",
            ContentTitle = entry.ContentTitle ?? "",
            CreatorName = entry.CreatorName ?? "",
            AlbumTitle = entry.AlbumTitle ?? "",
            SeriesTitle = entry.SeriesTitle ?? "",
            SeasonTitle = entry.SeasonTitle ?? "",
            EpisodeNumber = entry.EpisodeNumber ?? "",
            ContentType = entry.ContentType ?? "",
            PageUrl = entry.PageUrl ?? "",
            TitleSource = entry.TitleSource ?? "",
            MediaSessionAvailable = entry.MediaSessionAvailable,
            ArtworkRemoteUrl = entry.ArtworkRemoteUrl ?? "",
            ArtworkSource = entry.ArtworkSource ?? "",
            MetadataCapturedUtc = entry.MetadataCapturedUtc?.ToUniversalTime(),
            TotalPlaybackSeconds = Math.Max(0, entry.TotalPlaybackSeconds),
            LastSessionSeconds = Math.Max(0, entry.LastSessionSeconds),
            DailyPlaybackDate = entry.DailyPlaybackDate ?? "",
            DailyPlaybackSeconds = Math.Max(0, entry.DailyPlaybackSeconds),
            SessionCount = Math.Max(0, entry.SessionCount),
            LastPositionSeconds = Math.Max(0, entry.LastPositionSeconds),
            DurationSeconds = Math.Max(0, entry.DurationSeconds),
            FirstPlayedUtc = entry.FirstPlayedUtc?.ToUniversalTime(),
            LastPlayedUtc = entry.LastPlayedUtc?.ToUniversalTime()
        };

    private static bool GameContentEquals(
        CloudGameHistoryEntryV1 left,
        CloudGameHistoryEntryV1 right)
        => string.Equals(left.GameKey ?? "", right.GameKey ?? "", StringComparison.Ordinal) &&
           string.Equals(left.Name ?? "", right.Name ?? "", StringComparison.Ordinal) &&
           left.TotalPlaytimeSeconds == right.TotalPlaytimeSeconds &&
           left.LastSessionSeconds == right.LastSessionSeconds &&
           NormalizeDate(left.FirstPlayedUtc) == NormalizeDate(right.FirstPlayedUtc) &&
           NormalizeDate(left.LastPlayedUtc) == NormalizeDate(right.LastPlayedUtc) &&
           string.Equals(left.ShowcaseVerticalImageUrl ?? "", right.ShowcaseVerticalImageUrl ?? "", StringComparison.Ordinal) &&
           string.Equals(left.HistoryHorizontalImageUrl ?? "", right.HistoryHorizontalImageUrl ?? "", StringComparison.Ordinal) &&
           string.Equals(left.ProfileBannerImageUrl ?? "", right.ProfileBannerImageUrl ?? "", StringComparison.Ordinal) &&
           left.SteamGridGameId == right.SteamGridGameId;

    private static bool MediaContentEquals(
        CloudMediaHistoryEntryV1 left,
        CloudMediaHistoryEntryV1 right)
        => string.Equals(left.MediaKey ?? "", right.MediaKey ?? "", StringComparison.Ordinal) &&
           string.Equals(left.AppId ?? "", right.AppId ?? "", StringComparison.Ordinal) &&
           string.Equals(left.AppName ?? "", right.AppName ?? "", StringComparison.Ordinal) &&
           string.Equals(left.Category ?? "", right.Category ?? "", StringComparison.Ordinal) &&
           string.Equals(left.ContentTitle ?? "", right.ContentTitle ?? "", StringComparison.Ordinal) &&
           string.Equals(left.CreatorName ?? "", right.CreatorName ?? "", StringComparison.Ordinal) &&
           string.Equals(left.AlbumTitle ?? "", right.AlbumTitle ?? "", StringComparison.Ordinal) &&
           string.Equals(left.SeriesTitle ?? "", right.SeriesTitle ?? "", StringComparison.Ordinal) &&
           string.Equals(left.SeasonTitle ?? "", right.SeasonTitle ?? "", StringComparison.Ordinal) &&
           string.Equals(left.EpisodeNumber ?? "", right.EpisodeNumber ?? "", StringComparison.Ordinal) &&
           string.Equals(left.ContentType ?? "", right.ContentType ?? "", StringComparison.Ordinal) &&
           string.Equals(left.PageUrl ?? "", right.PageUrl ?? "", StringComparison.Ordinal) &&
           string.Equals(left.TitleSource ?? "", right.TitleSource ?? "", StringComparison.Ordinal) &&
           left.MediaSessionAvailable == right.MediaSessionAvailable &&
           string.Equals(left.ArtworkRemoteUrl ?? "", right.ArtworkRemoteUrl ?? "", StringComparison.Ordinal) &&
           string.Equals(left.ArtworkSource ?? "", right.ArtworkSource ?? "", StringComparison.Ordinal) &&
           NormalizeDate(left.MetadataCapturedUtc) == NormalizeDate(right.MetadataCapturedUtc) &&
           left.TotalPlaybackSeconds == right.TotalPlaybackSeconds &&
           left.LastSessionSeconds == right.LastSessionSeconds &&
           string.Equals(left.DailyPlaybackDate ?? "", right.DailyPlaybackDate ?? "", StringComparison.Ordinal) &&
           left.DailyPlaybackSeconds == right.DailyPlaybackSeconds &&
           left.SessionCount == right.SessionCount &&
           left.LastPositionSeconds.Equals(right.LastPositionSeconds) &&
           left.DurationSeconds.Equals(right.DurationSeconds) &&
           NormalizeDate(left.FirstPlayedUtc) == NormalizeDate(right.FirstPlayedUtc) &&
           NormalizeDate(left.LastPlayedUtc) == NormalizeDate(right.LastPlayedUtc);

    private static CloudProfilePhotoV1 ClonePhoto(CloudProfilePhotoV1 photo)
        => new()
        {
            HasPhoto = photo.HasPhoto,
            Source = photo.Source ?? "",
            SourceUrl = photo.SourceUrl ?? "",
            SteamGridAssetId = photo.SteamGridAssetId,
            CropX = photo.CropX,
            CropY = photo.CropY,
            Zoom = photo.Zoom,
            ContentHash = photo.ContentHash ?? "",
            CloudFileName = photo.CloudFileName ?? "profile-photo.jpg"
        };

    private static List<CloudControlProfileV1> MergeControlProfiles(
        IEnumerable<CloudControlProfileV1>? local,
        IEnumerable<CloudControlProfileV1>? remote)
        => (local ?? Array.Empty<CloudControlProfileV1>())
            .Concat(remote ?? Array.Empty<CloudControlProfileV1>())
            .Where(profile => !string.IsNullOrWhiteSpace(profile.Id))
            .GroupBy(profile => profile.Id, StringComparer.OrdinalIgnoreCase)
            .Select(group => CloneJson(group
                .OrderByDescending(profile => profile.UpdatedAtUtc)
                .ThenByDescending(profile => ControlProfileFingerprint(profile), StringComparer.Ordinal)
                .First()))
            .OrderBy(profile => profile.Id, StringComparer.Ordinal)
            .ToList();

    private static List<CloudControlAssignmentV1> MergeControlAssignments(
        IEnumerable<CloudControlAssignmentV1>? local,
        IEnumerable<CloudControlAssignmentV1>? remote)
        => (local ?? Array.Empty<CloudControlAssignmentV1>())
            .Concat(remote ?? Array.Empty<CloudControlAssignmentV1>())
            .Where(assignment => !string.IsNullOrWhiteSpace(assignment.ProfileId))
            .GroupBy(ControlAssignmentKey, StringComparer.OrdinalIgnoreCase)
            .Select(group => CloneJson(group
                .OrderByDescending(assignment => assignment.UpdatedAtUtc)
                .ThenByDescending(assignment => assignment.ProfileId, StringComparer.Ordinal)
                .First()))
            .OrderBy(ControlAssignmentKey, StringComparer.Ordinal)
            .ToList();

    private static string ControlAssignmentKey(CloudControlAssignmentV1 assignment)
    {
        if (!string.IsNullOrWhiteSpace(assignment.NativeAppId))
            return "native:" + assignment.NativeAppId.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(assignment.ExecutablePath))
            return "exe:" + assignment.ExecutablePath.Trim().ToLowerInvariant();
        return "local:" + (assignment.TargetFingerprint ?? "").Trim().ToLowerInvariant();
    }

    private static string ControlProfilesFingerprint(IEnumerable<CloudControlProfileV1>? profiles)
    {
        string json = JsonSerializer.Serialize((profiles ?? Array.Empty<CloudControlProfileV1>())
            .OrderBy(profile => profile.Id, StringComparer.Ordinal));
        return ProfileSyncSerializer.ComputeBinaryHash(Encoding.UTF8.GetBytes(json));
    }

    private static string ControlAssignmentsFingerprint(IEnumerable<CloudControlAssignmentV1>? assignments)
    {
        string json = JsonSerializer.Serialize((assignments ?? Array.Empty<CloudControlAssignmentV1>())
            .OrderBy(ControlAssignmentKey, StringComparer.Ordinal));
        return ProfileSyncSerializer.ComputeBinaryHash(Encoding.UTF8.GetBytes(json));
    }

    private static string ControlProfileFingerprint(CloudControlProfileV1 profile)
        => ProfileSyncSerializer.ComputeBinaryHash(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(profile)));

    private static T CloneJson<T>(T value)
        => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value))
           ?? throw new InvalidOperationException("NÃ£o foi possÃ­vel clonar os controles sincronizados.");

    private static long SaturatingSum(IEnumerable<long> values)
    {
        long total = 0;
        foreach (long raw in values)
        {
            long value = Math.Max(0, raw);
            total = total > long.MaxValue - value ? long.MaxValue : total + value;
        }
        return total;
    }

    private static long SaturatingAdd(long left, long right)
    {
        left = Math.Max(0, left);
        right = Math.Max(0, right);
        return left > long.MaxValue - right ? long.MaxValue : left + right;
    }

    public static ProfileSyncComparison Compare(CloudProfileV1 local, CloudProfileV1 remote)
    {
        ArgumentNullException.ThrowIfNull(local);
        ArgumentNullException.ThrowIfNull(remote);

        var differences = new List<ProfileDifference>();
        AddValueDifference(differences, ProfileDifferenceKind.SchemaVersion, "schemaVersion",
            local.SchemaVersion, remote.SchemaVersion);
        AddValueDifference(differences, ProfileDifferenceKind.ProfileName, "profileName",
            local.ProfileName, remote.ProfileName);
        AddSensitiveDifference(differences, ProfileDifferenceKind.PinCode, "pinCode",
            local.PinCode, remote.PinCode);
        AddSensitiveDifference(differences, ProfileDifferenceKind.SteamGridApiKey, "steamGridApiKey",
            local.SteamGridApiKey, remote.SteamGridApiKey);
        AddValueDifference(differences, ProfileDifferenceKind.ApplicationHistoryEnabled, "applicationHistoryEnabled",
            local.ApplicationHistoryEnabled, remote.ApplicationHistoryEnabled);
        AddValueDifference(differences, ProfileDifferenceKind.CreatedAt, "createdAtUtc",
            local.CreatedAtUtc, remote.CreatedAtUtc, FormatDate);

        string localPhoto = PhotoFingerprint(local.ProfilePhoto);
        string remotePhoto = PhotoFingerprint(remote.ProfilePhoto);
        if (!string.Equals(localPhoto, remotePhoto, StringComparison.Ordinal))
        {
            differences.Add(new ProfileDifference
            {
                Kind = ProfileDifferenceKind.ProfilePhoto,
                Path = "profilePhoto",
                LocalSummary = local.ProfilePhoto?.HasPhoto == true ? "Configurada" : "Sem foto",
                RemoteSummary = remote.ProfilePhoto?.HasPhoto == true ? "Configurada" : "Sem foto"
            });
        }

        AddValueDifference(differences, ProfileDifferenceKind.TotalPlaytime, "totalPlaytimeSeconds",
            local.TotalPlaytimeSeconds, remote.TotalPlaytimeSeconds, FormatDuration);
        AddValueDifference(differences, ProfileDifferenceKind.TotalMediaPlayback, "totalMediaPlaybackSeconds",
            local.TotalMediaPlaybackSeconds, remote.TotalMediaPlaybackSeconds, FormatDuration);

        string localControls = ControlProfilesFingerprint(local.ControlProfiles);
        string remoteControls = ControlProfilesFingerprint(remote.ControlProfiles);
        if (!string.Equals(localControls, remoteControls, StringComparison.Ordinal))
        {
            differences.Add(new ProfileDifference
            {
                Kind = ProfileDifferenceKind.ControlProfiles,
                Path = "controlProfiles",
                LocalSummary = $"{local.ControlProfiles?.Count ?? 0} perfil(is)",
                RemoteSummary = $"{remote.ControlProfiles?.Count ?? 0} perfil(is)"
            });
        }

        string localAssignments = ControlAssignmentsFingerprint(local.ControlAssignments);
        string remoteAssignments = ControlAssignmentsFingerprint(remote.ControlAssignments);
        if (!string.Equals(localAssignments, remoteAssignments, StringComparison.Ordinal))
        {
            differences.Add(new ProfileDifference
            {
                Kind = ProfileDifferenceKind.ControlAssignments,
                Path = "controlAssignments",
                LocalSummary = $"{local.ControlAssignments?.Count ?? 0} atribuição(ões)",
                RemoteSummary = $"{remote.ControlAssignments?.Count ?? 0} atribuição(ões)"
            });
        }

        var localGames = ToGameDictionary(local.Games);
        var remoteGames = ToGameDictionary(remote.Games);
        foreach (string key in localGames.Keys.Union(remoteGames.Keys, StringComparer.Ordinal).OrderBy(key => key, StringComparer.Ordinal))
        {
            bool hasLocal = localGames.TryGetValue(key, out CloudGameHistoryEntryV1? localGame);
            bool hasRemote = remoteGames.TryGetValue(key, out CloudGameHistoryEntryV1? remoteGame);
            if (!hasRemote)
            {
                differences.Add(GameDifference(ProfileDifferenceKind.GameAdded, key, localGame?.Name,
                    localGame?.Name ?? "", "Ausente"));
                continue;
            }
            if (!hasLocal)
            {
                differences.Add(GameDifference(ProfileDifferenceKind.GameRemoved, key, remoteGame?.Name,
                    "Ausente", remoteGame?.Name ?? ""));
                continue;
            }

            CompareGame(differences, key, localGame!, remoteGame!);
        }

        var localMedia = ToMediaDictionary(local.MediaHistory);
        var remoteMedia = ToMediaDictionary(remote.MediaHistory);
        foreach (string key in localMedia.Keys.Union(remoteMedia.Keys, StringComparer.Ordinal).OrderBy(key => key, StringComparer.Ordinal))
        {
            bool hasLocal = localMedia.TryGetValue(key, out CloudMediaHistoryEntryV1? localEntry);
            bool hasRemote = remoteMedia.TryGetValue(key, out CloudMediaHistoryEntryV1? remoteEntry);
            if (!hasRemote)
            {
                differences.Add(MediaDifference(ProfileDifferenceKind.MediaAdded, key, localEntry?.ContentTitle,
                    localEntry?.ContentTitle ?? "", "Ausente"));
                continue;
            }
            if (!hasLocal)
            {
                differences.Add(MediaDifference(ProfileDifferenceKind.MediaRemoved, key, remoteEntry?.ContentTitle,
                    "Ausente", remoteEntry?.ContentTitle ?? ""));
                continue;
            }
            CompareMedia(differences, key, localEntry!, remoteEntry!);
        }

        return new ProfileSyncComparison
        {
            LocalContentHash = ProfileSyncSerializer.ComputeContentHash(local),
            RemoteContentHash = ProfileSyncSerializer.ComputeContentHash(remote),
            Differences = differences
        };
    }

    private static void CompareGame(
        List<ProfileDifference> differences,
        string key,
        CloudGameHistoryEntryV1 local,
        CloudGameHistoryEntryV1 remote)
    {
        string gameName = !string.IsNullOrWhiteSpace(local.Name) ? local.Name : remote.Name;
        AddGameValueDifference(differences, ProfileDifferenceKind.GameName, key, gameName, "name",
            local.Name, remote.Name);
        AddGameValueDifference(differences, ProfileDifferenceKind.GamePlaytime, key, gameName, "totalPlaytimeSeconds",
            local.TotalPlaytimeSeconds, remote.TotalPlaytimeSeconds, FormatDuration);
        AddGameValueDifference(differences, ProfileDifferenceKind.GameLastSession, key, gameName, "lastSessionSeconds",
            local.LastSessionSeconds, remote.LastSessionSeconds, FormatDuration);
        AddGameValueDifference(differences, ProfileDifferenceKind.GameFirstPlayed, key, gameName, "firstPlayedUtc",
            local.FirstPlayedUtc, remote.FirstPlayedUtc, FormatDate);
        AddGameValueDifference(differences, ProfileDifferenceKind.GameLastPlayed, key, gameName, "lastPlayedUtc",
            local.LastPlayedUtc, remote.LastPlayedUtc, FormatDate);
        AddGameValueDifference(differences, ProfileDifferenceKind.GameVerticalArtwork, key, gameName, "showcaseVerticalImageUrl",
            local.ShowcaseVerticalImageUrl, remote.ShowcaseVerticalImageUrl, FormatArtwork);
        AddGameValueDifference(differences, ProfileDifferenceKind.GameHorizontalArtwork, key, gameName, "historyHorizontalImageUrl",
            local.HistoryHorizontalImageUrl, remote.HistoryHorizontalImageUrl, FormatArtwork);
        AddGameValueDifference(differences, ProfileDifferenceKind.GameProfileBannerArtwork, key, gameName, "profileBannerImageUrl",
            local.ProfileBannerImageUrl, remote.ProfileBannerImageUrl, FormatArtwork);
        AddGameValueDifference(differences, ProfileDifferenceKind.GameSteamGridReference, key, gameName, "steamGridGameId",
            local.SteamGridGameId, remote.SteamGridGameId, FormatArtworkReference);
    }

    private static void CompareMedia(
        List<ProfileDifference> differences,
        string key,
        CloudMediaHistoryEntryV1 local,
        CloudMediaHistoryEntryV1 remote)
    {
        string title = !string.IsNullOrWhiteSpace(local.ContentTitle) ? local.ContentTitle : remote.ContentTitle;
        AddMediaValueDifference(differences, ProfileDifferenceKind.MediaPlayback, key, title, "totalPlaybackSeconds",
            local.TotalPlaybackSeconds, remote.TotalPlaybackSeconds, FormatDuration);
        AddMediaValueDifference(differences, ProfileDifferenceKind.MediaLastSession, key, title, "lastSessionSeconds",
            local.LastSessionSeconds, remote.LastSessionSeconds, FormatDuration);
        AddMediaValueDifference(differences, ProfileDifferenceKind.MediaDailyPlayback, key, title, "dailyPlaybackDate",
            local.DailyPlaybackDate ?? "", remote.DailyPlaybackDate ?? "");
        AddMediaValueDifference(differences, ProfileDifferenceKind.MediaDailyPlayback, key, title, "dailyPlaybackSeconds",
            local.DailyPlaybackSeconds, remote.DailyPlaybackSeconds, FormatDuration);
        AddMediaValueDifference(differences, ProfileDifferenceKind.MediaSessionCount, key, title, "sessionCount",
            local.SessionCount, remote.SessionCount);
        AddMediaValueDifference(differences, ProfileDifferenceKind.MediaFirstPlayed, key, title, "firstPlayedUtc",
            local.FirstPlayedUtc, remote.FirstPlayedUtc, FormatDate);
        AddMediaValueDifference(differences, ProfileDifferenceKind.MediaLastPlayed, key, title, "lastPlayedUtc",
            local.LastPlayedUtc, remote.LastPlayedUtc, FormatDate);
        AddMediaValueDifference(differences, ProfileDifferenceKind.MediaMetadata, key, title, "metadata",
            MediaMetadataFingerprint(local), MediaMetadataFingerprint(remote));
        AddMediaValueDifference(differences, ProfileDifferenceKind.MediaArtwork, key, title, "artworkRemoteUrl",
            local.ArtworkRemoteUrl ?? "", remote.ArtworkRemoteUrl ?? "", FormatArtwork);
    }

    private static string MediaMetadataFingerprint(CloudMediaHistoryEntryV1 entry)
        => string.Join(" | ", new[]
        {
            entry.AlbumTitle ?? "",
            entry.SeriesTitle ?? "",
            entry.SeasonTitle ?? "",
            entry.EpisodeNumber ?? "",
            entry.ContentType ?? "",
            entry.PageUrl ?? "",
            entry.TitleSource ?? "",
            entry.MediaSessionAvailable ? "media-session" : "fallback",
            entry.ArtworkSource ?? "",
            FormatDate(entry.MetadataCapturedUtc)
        });

    private static Dictionary<string, CloudGameHistoryEntryV1> ToGameDictionary(
        IEnumerable<CloudGameHistoryEntryV1>? games)
        => (games ?? Array.Empty<CloudGameHistoryEntryV1>())
            .Where(game => !string.IsNullOrWhiteSpace(game.GameKey) && game.TotalPlaytimeSeconds >= 60)
            .GroupBy(game => game.GameKey, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal);

    private static Dictionary<string, CloudMediaHistoryEntryV1> ToMediaDictionary(
        IEnumerable<CloudMediaHistoryEntryV1>? entries)
        => (entries ?? Array.Empty<CloudMediaHistoryEntryV1>())
            .Where(entry => !string.IsNullOrWhiteSpace(entry.MediaKey) && entry.TotalPlaybackSeconds > 0)
            .GroupBy(entry => entry.MediaKey, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal);

    private static string PhotoFingerprint(CloudProfilePhotoV1? photo)
    {
        if (photo == null) return "";
        return string.Join("|",
            photo.HasPhoto,
            photo.Source ?? "",
            photo.SourceUrl ?? "",
            photo.SteamGridAssetId,
            photo.CropX.ToString("R", CultureInfo.InvariantCulture),
            photo.CropY.ToString("R", CultureInfo.InvariantCulture),
            photo.Zoom.ToString("R", CultureInfo.InvariantCulture),
            photo.ContentHash ?? "");
    }

    private static ProfileSyncDecision CreateDecision(
        ProfileSyncAction action,
        ProfileSyncComparison comparison,
        string baseHash)
        => new()
        {
            Action = action,
            LocalContentHash = comparison.LocalContentHash,
            RemoteContentHash = comparison.RemoteContentHash,
            BaseContentHash = baseHash,
            Differences = comparison.Differences
        };

    private static void AddSensitiveDifference(
        List<ProfileDifference> differences,
        ProfileDifferenceKind kind,
        string path,
        string? local,
        string? remote)
    {
        if (string.Equals(local ?? "", remote ?? "", StringComparison.Ordinal)) return;
        differences.Add(new ProfileDifference
        {
            Kind = kind,
            Path = path,
            LocalSummary = string.IsNullOrEmpty(local) ? "Não configurado" : "Configurado",
            RemoteSummary = string.IsNullOrEmpty(remote) ? "Não configurado" : "Configurado",
            IsSensitive = true
        });
    }

    private static void AddValueDifference<T>(
        List<ProfileDifference> differences,
        ProfileDifferenceKind kind,
        string path,
        T local,
        T remote,
        Func<T, string>? formatter = null)
    {
        if (EqualityComparer<T>.Default.Equals(local, remote)) return;
        formatter ??= value => value?.ToString() ?? "";
        differences.Add(new ProfileDifference
        {
            Kind = kind,
            Path = path,
            LocalSummary = formatter(local),
            RemoteSummary = formatter(remote)
        });
    }

    private static void AddGameValueDifference<T>(
        List<ProfileDifference> differences,
        ProfileDifferenceKind kind,
        string gameKey,
        string gameName,
        string field,
        T local,
        T remote,
        Func<T, string>? formatter = null)
    {
        if (EqualityComparer<T>.Default.Equals(local, remote)) return;
        formatter ??= value => value?.ToString() ?? "";
        differences.Add(GameDifference(kind, gameKey, gameName,
            formatter(local), formatter(remote), $"games.{gameKey}.{field}"));
    }

    private static ProfileDifference GameDifference(
        ProfileDifferenceKind kind,
        string gameKey,
        string? gameName,
        string local,
        string remote,
        string? path = null)
        => new()
        {
            Kind = kind,
            Path = path ?? $"games.{gameKey}",
            GameKey = gameKey,
            GameName = gameName ?? "",
            LocalSummary = local,
            RemoteSummary = remote
        };

    private static void AddMediaValueDifference<T>(
        List<ProfileDifference> differences,
        ProfileDifferenceKind kind,
        string mediaKey,
        string title,
        string field,
        T local,
        T remote,
        Func<T, string>? formatter = null)
    {
        if (EqualityComparer<T>.Default.Equals(local, remote)) return;
        formatter ??= value => value?.ToString() ?? "";
        differences.Add(MediaDifference(kind, mediaKey, title,
            formatter(local), formatter(remote), $"mediaHistory.{mediaKey}.{field}"));
    }

    private static ProfileDifference MediaDifference(
        ProfileDifferenceKind kind,
        string mediaKey,
        string? title,
        string local,
        string remote,
        string? path = null)
        => new()
        {
            Kind = kind,
            Path = path ?? $"mediaHistory.{mediaKey}",
            GameKey = mediaKey,
            GameName = title ?? "",
            LocalSummary = local,
            RemoteSummary = remote
        };

    private static string FormatDate(DateTimeOffset? value)
        => value?.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture) ?? "Sem registro";

    private static string FormatDuration(long seconds)
    {
        seconds = Math.Max(0, seconds);
        long days = seconds / 86_400;
        long remainder = seconds % 86_400;
        long hours = remainder / 3_600;
        long minutes = (remainder % 3_600) / 60;
        long remainingSeconds = remainder % 60;
        return $"{days}.{hours:00}:{minutes:00}:{remainingSeconds:00}";
    }

    private static string FormatDuration(int seconds) => FormatDuration((long)seconds);

    private static string FormatArtwork(string value)
        => string.IsNullOrWhiteSpace(value) ? "Sem arte" : "Configurada";

    private static string FormatArtworkReference(int value)
        => value > 0 ? "Configurada" : "Sem referência";
}
