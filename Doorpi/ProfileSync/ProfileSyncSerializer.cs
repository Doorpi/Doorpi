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
        public IReadOnlyList<CloudControlProfileV1> ControlProfiles { get; init; } = Array.Empty<CloudControlProfileV1>();
        public IReadOnlyList<CloudControlAssignmentV1> ControlAssignments { get; init; } = Array.Empty<CloudControlAssignmentV1>();

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
                    .ToList(),
                ControlProfiles = (profile.ControlProfiles ?? new List<CloudControlProfileV1>())
                    .Where(item => !string.IsNullOrWhiteSpace(item.Id))
                    .Select(NormalizeControlProfile)
                    .OrderBy(item => item.Id, StringComparer.Ordinal)
                    .ToList(),
                ControlAssignments = (profile.ControlAssignments ?? new List<CloudControlAssignmentV1>())
                    .Where(item => !string.IsNullOrWhiteSpace(item.ProfileId))
                    .Select(NormalizeControlAssignment)
                    .OrderBy(item => item.TargetFingerprint, StringComparer.Ordinal)
                    .ThenBy(item => item.ProfileId, StringComparer.Ordinal)
                    .ToList()
            };

        private static CloudControlProfileV1 NormalizeControlProfile(CloudControlProfileV1 profile)
            => new()
            {
                Id = profile.Id ?? "",
                Name = profile.Name ?? "",
                Category = profile.Category ?? "web",
                BaseProfileId = profile.BaseProfileId ?? "",
                Enabled = profile.Enabled,
                MouseSensitivity = profile.MouseSensitivity,
                ScrollSensitivity = profile.ScrollSensitivity,
                MouseDeadZone = profile.MouseDeadZone,
                HasConfigurablePointerBindings = profile.HasConfigurablePointerBindings,
                HasSecondaryActivations = profile.HasSecondaryActivations,
                CreatedAtUtc = profile.CreatedAtUtc.ToUniversalTime(),
                UpdatedAtUtc = profile.UpdatedAtUtc.ToUniversalTime(),
                Bindings = (profile.Bindings ?? new List<CloudControlBindingV1>())
                    .OrderBy(binding => binding.Id, StringComparer.Ordinal)
                    .Select(binding => new CloudControlBindingV1
                    {
                        Id = binding.Id ?? "",
                        Name = binding.Name ?? "",
                        Enabled = binding.Enabled,
                        Trigger = binding.Trigger ?? "press",
                        LongPressDurationMs = Math.Clamp(binding.LongPressDurationMs, 500, 5000),
                        ControllerButtons = (binding.ControllerButtons ?? new List<string>())
                            .OrderBy(button => button, StringComparer.Ordinal).ToList(),
                        SecondaryTrigger = binding.SecondaryTrigger ?? "press",
                        SecondaryLongPressDurationMs = Math.Clamp(
                            binding.SecondaryLongPressDurationMs,
                            500,
                            5000),
                        SecondaryControllerButtons = (binding.SecondaryControllerButtons ?? new List<string>())
                            .OrderBy(button => button, StringComparer.Ordinal).ToList(),
                        Action = new CloudControlActionV1
                        {
                            Type = binding.Action?.Type ?? "keyboard",
                            VirtualKeys = binding.Action?.VirtualKeys?.ToList() ?? new List<ushort>(),
                            MouseButton = binding.Action?.MouseButton ?? "left",
                            WheelDelta = binding.Action?.WheelDelta ?? 120,
                            PointerDirection = binding.Action?.PointerDirection ?? "free",
                            PointerDistance = binding.Action?.PointerDistance ?? 24,
                            SystemCommand = binding.Action?.SystemCommand ?? ""
                        }
                    }).ToList()
            };

        private static CloudControlAssignmentV1 NormalizeControlAssignment(CloudControlAssignmentV1 assignment)
            => new()
            {
                ProfileId = assignment.ProfileId ?? "",
                TargetName = assignment.TargetName ?? "",
                TargetCategory = assignment.TargetCategory ?? "web",
                TargetFingerprint = assignment.TargetFingerprint ?? "",
                NativeAppId = assignment.NativeAppId ?? "",
                ExecutablePath = assignment.ExecutablePath ?? "",
                UpdatedAtUtc = assignment.UpdatedAtUtc.ToUniversalTime()
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
