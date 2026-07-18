using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Doorpi.ProfileSync;

public static class ProfileSyncSerializer
{
    private static readonly JsonSerializerOptions StorageOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    private static readonly JsonSerializerOptions CanonicalOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public static string SerializeProfile(CloudProfileV1 profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        return JsonSerializer.Serialize(profile, StorageOptions);
    }

    public static CloudProfileV1? DeserializeProfile(string json)
        => JsonSerializer.Deserialize<CloudProfileV1>(json, StorageOptions);

    public static string SerializeState(ProfileSyncState state)
    {
        ArgumentNullException.ThrowIfNull(state);
        return JsonSerializer.Serialize(state, StorageOptions);
    }

    public static ProfileSyncState? DeserializeState(string json)
        => JsonSerializer.Deserialize<ProfileSyncState>(json, StorageOptions);

    public static string ComputeContentHash(CloudProfileV1 profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        var content = CanonicalProfileContent.From(profile);
        byte[] json = JsonSerializer.SerializeToUtf8Bytes(content, CanonicalOptions);
        return Convert.ToHexString(SHA256.HashData(json)).ToLowerInvariant();
    }

    public static string ComputeBinaryHash(ReadOnlySpan<byte> content)
        => Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant();

    private sealed class CanonicalProfileContent
    {
        public int SchemaVersion { get; init; }
        public string ProfileName { get; init; } = "";
        public string PinCode { get; init; } = "";
        public string SteamGridApiKey { get; init; } = "";
        public DateTimeOffset? CreatedAtUtc { get; init; }
        public long TotalPlaytimeSeconds { get; init; }
        public CanonicalProfilePhoto ProfilePhoto { get; init; } = new();
        public IReadOnlyList<CloudGameHistoryEntryV1> Games { get; init; } = Array.Empty<CloudGameHistoryEntryV1>();

        public static CanonicalProfileContent From(CloudProfileV1 profile)
            => new()
            {
                SchemaVersion = profile.SchemaVersion,
                ProfileName = profile.ProfileName ?? "",
                PinCode = profile.PinCode ?? "",
                SteamGridApiKey = profile.SteamGridApiKey ?? "",
                CreatedAtUtc = NormalizeUtc(profile.CreatedAtUtc),
                TotalPlaytimeSeconds = Math.Max(0, profile.TotalPlaytimeSeconds),
                ProfilePhoto = NormalizePhoto(profile.ProfilePhoto),
                Games = (profile.Games ?? new List<CloudGameHistoryEntryV1>())
                    .Select(NormalizeGame)
                    .OrderBy(game => game.GameKey, StringComparer.Ordinal)
                    .ThenBy(game => game.Name, StringComparer.Ordinal)
                    .ToList()
            };

        private static CanonicalProfilePhoto NormalizePhoto(CloudProfilePhotoV1? photo)
            => new()
            {
                HasPhoto = photo?.HasPhoto == true,
                Source = photo?.Source ?? "",
                SourceUrl = photo?.SourceUrl ?? "",
                SteamGridAssetId = photo?.SteamGridAssetId ?? 0,
                CropX = photo?.CropX ?? 0,
                CropY = photo?.CropY ?? 0,
                Zoom = photo?.Zoom > 0 ? photo.Zoom : 1,
                ContentHash = photo?.ContentHash ?? ""
            };

        private static CloudGameHistoryEntryV1 NormalizeGame(CloudGameHistoryEntryV1 game)
            => new()
            {
                GameKey = game.GameKey ?? "",
                Name = game.Name ?? "",
                TotalPlaytimeSeconds = Math.Max(0, game.TotalPlaytimeSeconds),
                LastSessionSeconds = Math.Max(0, game.LastSessionSeconds),
                FirstPlayedUtc = NormalizeUtc(game.FirstPlayedUtc),
                LastPlayedUtc = NormalizeUtc(game.LastPlayedUtc),
                ShowcaseVerticalImageUrl = game.ShowcaseVerticalImageUrl ?? "",
                HistoryHorizontalImageUrl = game.HistoryHorizontalImageUrl ?? "",
                ProfileBannerImageUrl = game.ProfileBannerImageUrl ?? "",
                SteamGridGameId = game.SteamGridGameId
            };

        private static DateTimeOffset? NormalizeUtc(DateTimeOffset? value)
            => value?.ToUniversalTime();
    }

    private sealed class CanonicalProfilePhoto
    {
        public bool HasPhoto { get; init; }
        public string Source { get; init; } = "";
        public string SourceUrl { get; init; } = "";
        public int SteamGridAssetId { get; init; }
        public double CropX { get; init; }
        public double CropY { get; init; }
        public double Zoom { get; init; } = 1;
        public string ContentHash { get; init; } = "";
    }
}
