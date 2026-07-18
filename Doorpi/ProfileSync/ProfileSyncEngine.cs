using System.Globalization;

namespace Doorpi.ProfileSync;

public static class ProfileSyncSnapshotFactory
{
    public static CloudProfileV1 Create(
        UserProfile profile,
        IEnumerable<GameHistoryEntry> history,
        string deviceId,
        DateTimeOffset updatedAtUtc)
    {
        ArgumentNullException.ThrowIfNull(profile);
        ArgumentNullException.ThrowIfNull(history);

        List<CloudGameHistoryEntryV1> games = history
            .Where(entry => !string.IsNullOrWhiteSpace(entry.Name))
            .GroupBy(entry => NormalizeGameKey(entry.Name), StringComparer.Ordinal)
            .Where(group => !string.IsNullOrWhiteSpace(group.Key))
            .Select(group => CreateGame(group.Key, group))
            .OrderBy(game => game.GameKey, StringComparer.Ordinal)
            .ToList();

        return new CloudProfileV1
        {
            ProfileId = profile.Id ?? "",
            ProfileName = profile.Name ?? "",
            PinCode = profile.PinCode ?? "",
            SteamGridApiKey = profile.SteamGridApiKey ?? "",
            CreatedAtUtc = ToUtc(profile.DateCreated),
            UpdatedAtUtc = updatedAtUtc.ToUniversalTime(),
            LastModifiedDeviceId = deviceId ?? "",
            TotalPlaytimeSeconds = SaturatingSum(games.Select(game => game.TotalPlaytimeSeconds)),
            ProfilePhoto = CreatePhoto(profile),
            Games = games
        };
    }

    public static string NormalizeGameKey(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        return new string(name.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
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

        return CreateDecision(ProfileSyncAction.Conflict, comparison, baseHash);
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

    private static Dictionary<string, CloudGameHistoryEntryV1> ToGameDictionary(
        IEnumerable<CloudGameHistoryEntryV1>? games)
        => (games ?? Array.Empty<CloudGameHistoryEntryV1>())
            .Where(game => !string.IsNullOrWhiteSpace(game.GameKey))
            .GroupBy(game => game.GameKey, StringComparer.Ordinal)
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
