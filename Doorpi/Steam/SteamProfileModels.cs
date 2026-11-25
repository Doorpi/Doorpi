using System.Text.Json;
using System.IO;

namespace Doorpi.Steam;

public sealed class SteamProfileData
{
    [System.Text.Json.Serialization.JsonIgnore]
    public bool RetryRequired { get; set; }
    public string SteamId { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string AvatarUrl { get; set; } = "";
    public List<SteamGameData> Games { get; set; } = new();
}

public sealed class SteamGameData
{
    public string Id { get; set; } = "";
    public int AppId { get; set; }
    public string Name { get; set; } = "";
    public long PlaytimeMinutes { get; set; }
    public long LastPlayedUnix { get; set; }
    public DateTimeOffset? AchievementsCheckedUtc { get; set; }
    public List<SteamAchievementData> Achievements { get; set; } = new();
}

public sealed class SteamAchievementData
{
    public string Id { get; set; } = "";
    public int AppId { get; set; }
    public string ApiName { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public bool Unlocked { get; set; }
    public long UnlockTimeUnix { get; set; }
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public string? IconFile { get; set; }
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public string? IconUrl { get; set; }
    public static bool IsSteamImage(string? value) => value?.Length <= 2048 &&
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == "https" && uri.IsDefaultPort &&
        uri.UserInfo.Length == 0 && (uri.Host.EndsWith(".steamstatic.com", StringComparison.OrdinalIgnoreCase) ||
        uri.Host is "media.steampowered.com" or "steamcdn-a.akamaihd.net");
    public double? GlobalUnlockPercent { get; set; }
}

public static class SteamProfileMerge
{
    // Portable profile data only. API keys and machine session state never enter this model.
    public static SteamProfileData? Merge(SteamProfileData? left, SteamProfileData? right)
    {
        if (left == null) return Clone(right);
        if (right == null) return Clone(left);
        if (left.SteamId != right.SteamId) throw new InvalidDataException("Perfis Steam diferentes não podem ser combinados automaticamente.");
        var result = Clone(left)!;
        if (right.DisplayName.Length > 0) result.DisplayName = right.DisplayName;
        if (right.AvatarUrl.Length > 0) result.AvatarUrl = right.AvatarUrl;
        var games = result.Games.ToDictionary(game => game.AppId);
        foreach (var incoming in Clone(right)!.Games)
        {
            if (!games.TryGetValue(incoming.AppId, out var game)) { games.Add(incoming.AppId, incoming); continue; }
            game.PlaytimeMinutes = Math.Max(game.PlaytimeMinutes, incoming.PlaytimeMinutes);
            game.LastPlayedUnix = Math.Max(game.LastPlayedUnix, incoming.LastPlayedUnix);
            if (incoming.Name.Length > 0) game.Name = incoming.Name;
            game.AchievementsCheckedUtc = game.AchievementsCheckedUtc >= incoming.AchievementsCheckedUtc ? game.AchievementsCheckedUtc : incoming.AchievementsCheckedUtc ?? game.AchievementsCheckedUtc;
            game.Achievements = game.Achievements.Concat(incoming.Achievements).GroupBy(item => item.ApiName, StringComparer.Ordinal)
                .Select(group =>
                {
                    var item = group.Last();
                    item.Unlocked = group.Any(value => value.Unlocked);
                    item.IconUrl ??= group.Select(value => value.IconUrl).LastOrDefault(value => value != null);
                    item.IconFile ??= group.Select(value => value.IconFile).LastOrDefault(value => value != null);
                    item.GlobalUnlockPercent ??= group.Select(value => value.GlobalUnlockPercent).LastOrDefault(value => value.HasValue);
                    item.UnlockTimeUnix = group.Where(value => value.UnlockTimeUnix > 0).Select(value => value.UnlockTimeUnix).DefaultIfEmpty(0).Min();
                    return item;
                }).OrderBy(item => item.ApiName, StringComparer.Ordinal).ToList();
        }
        result.Games = games.Values.OrderBy(game => game.AppId).ToList();
        return result;
    }

    public static string Fingerprint(SteamProfileData? data)
    {
        var normalized = Clone(data);
        if (normalized != null)
        {
            normalized.Games = normalized.Games.OrderBy(game => game.AppId).ToList();
            foreach (var game in normalized.Games)
            {
                game.AchievementsCheckedUtc = null; // Network freshness is not a profile edit.
                game.Achievements = game.Achievements.OrderBy(item => item.ApiName, StringComparer.Ordinal).ToList();
            }
        }
        return JsonSerializer.Serialize(normalized);
    }

    private static SteamProfileData? Clone(SteamProfileData? value) => value == null ? null : JsonSerializer.Deserialize<SteamProfileData>(JsonSerializer.Serialize(value));
}
