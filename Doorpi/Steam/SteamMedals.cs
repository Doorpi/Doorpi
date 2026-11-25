namespace Doorpi.Steam;

public static class SteamMedals
{
    public static double? ParsePercent(System.Text.Json.JsonElement value)
    {
        double percent;
        bool valid = value.ValueKind == System.Text.Json.JsonValueKind.Number ? value.TryGetDouble(out percent)
            : double.TryParse(value.ValueKind == System.Text.Json.JsonValueKind.String ? value.GetString() : null, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out percent);
        return valid && double.IsFinite(percent) && percent >= 0 && percent <= 100 ? percent : null;
    }
    public static string? Classify(double? percent) => percent is null || !double.IsFinite(percent.Value) || percent < 0 || percent > 100
        ? null : percent <= 5 ? "gold" : percent <= 15 ? "silver" : percent <= 30 ? "bronze" : "iron";

    public static IOrderedEnumerable<SteamAchievementData> InDisplayOrder(IEnumerable<SteamAchievementData> achievements)
        => achievements.OrderByDescending(item => item.Unlocked)
            .ThenBy(item => item.GlobalUnlockPercent ?? double.MaxValue)
            .ThenBy(item => item.Name)
            .ThenBy(item => item.ApiName, StringComparer.Ordinal);

    public static Dictionary<string, int> Count(IEnumerable<SteamAchievementData> achievements)
    {
        var result = new Dictionary<string, int> { ["gold"] = 0, ["silver"] = 0, ["bronze"] = 0, ["iron"] = 0, ["unclassified"] = 0 };
        foreach (var achievement in achievements.Where(item => item.Unlocked))
            result[Classify(achievement.GlobalUnlockPercent) ?? "unclassified"]++;
        return result;
    }
}
