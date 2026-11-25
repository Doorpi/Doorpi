using System.Text.RegularExpressions;

namespace Doorpi.Steam;

public static class SteamHistoryImport
{
    public static int AppIdFromUrl(string url)
    {
        var match = Regex.Match(url ?? "", "\\Asteam://(?:rungameid|run)/(\\d+)(?:/|\\z)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        return match.Success && int.TryParse(match.Groups[1].Value, out int id) ? id : 0;
    }
    private static string Key(string value) => ProfileSync.ProfileSyncSnapshotFactory.NormalizeGameKey(value);

    public static void Apply(SteamProfileData imported, List<GameHistoryEntry> history, List<GameModel> library)
    {
        var names = imported.Games.GroupBy(game => Key(game.Name)).ToDictionary(group => group.Key, group => group.Count());
        foreach (var source in imported.Games)
        {
            var candidates = history.Where(item => item.SteamAppId == source.AppId).ToList();
            if (candidates.Count == 0 && names[Key(source.Name)] == 1)
                candidates = history.Where(item => item.SteamAppId == 0 && Key(item.Name) == Key(source.Name)).ToList();
            GameHistoryEntry? target = candidates.Count == 1 ? candidates[0] : null;
            if (target == null && candidates.Count == 0 && names[Key(source.Name)] == 1 && source.PlaytimeMinutes > 0)
            {
                // Ambiguous names must not overwrite another game's statistics.
                target = new GameHistoryEntry { Id = "steam-" + source.AppId, Name = source.Name, Source = "Steam", SteamAppId = source.AppId };
                history.Add(target);
            }
            if (target != null)
            {
                target.SteamAppId = source.AppId;
                SteamHistoryArtwork.FillMissing(target);
                long libraryMinutes = library.Where(game => AppIdFromUrl(game.LaunchUrl) == source.AppId || (AppIdFromUrl(game.LaunchUrl) == 0 && Key(game.Name) == Key(source.Name)))
                    .Select(game => game.TotalPlaytimeMinutes).DefaultIfEmpty(0).Max();
                target.TotalPlaytimeMinutes = Math.Max(
                    source.PlaytimeMinutes,
                    Math.Max(libraryMinutes, target.TotalPlaytimeMinutes));
                if (source.LastPlayedUnix > 0 && source.LastPlayedUnix <= DateTimeOffset.MaxValue.ToUnixTimeSeconds())
                    target.LastPlayed = new[] { target.LastPlayed, DateTimeOffset.FromUnixTimeSeconds(source.LastPlayedUnix).LocalDateTime }.Max();
            }
            foreach (var game in library.Where(game => AppIdFromUrl(game.LaunchUrl) == source.AppId ||
                (AppIdFromUrl(game.LaunchUrl) == 0 && names[Key(source.Name)] == 1 && Key(game.Name) == Key(source.Name))))
            {
                game.TotalPlaytimeMinutes = Math.Max(
                    game.TotalPlaytimeMinutes,
                    Math.Max(source.PlaytimeMinutes, target?.TotalPlaytimeMinutes ?? 0));
            }
        }
    }
}
