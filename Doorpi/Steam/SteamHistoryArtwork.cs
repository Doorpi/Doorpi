namespace Doorpi.Steam;

public static class SteamHistoryArtwork
{
    public static bool FillMissing(GameHistoryEntry entry)
    {
        if (entry.SteamAppId <= 0) return false;
        string root = $"https://cdn.cloudflare.steamstatic.com/steam/apps/{entry.SteamAppId}/";
        bool changed = false;
        if (Empty(entry.ShowcaseVerticalImageUrl, entry.ShowcaseVerticalLocalImage, entry.GridImage, entry.GridStaticImage))
        { entry.ShowcaseVerticalImageUrl = root + "library_600x900.jpg"; changed = true; }
        if (Empty(entry.HistoryHorizontalImageUrl, entry.HistoryHorizontalLocalImage, entry.GridHorizontalImage, entry.GridHorizontalStaticImage))
        { entry.HistoryHorizontalImageUrl = root + "header.jpg"; changed = true; }
        if (Empty(entry.ProfileBannerImageUrl, entry.ProfileBannerLocalImage))
        { entry.ProfileBannerImageUrl = root + "library_hero.jpg"; changed = true; }
        return changed;
    }
    private static bool Empty(params string[] values) => values.All(string.IsNullOrWhiteSpace);
    public static string? Fallback(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.Host != "cdn.cloudflare.steamstatic.com") return null;
        var parts = uri.AbsolutePath.Trim('/').Split('/');
        if (parts.Length != 4 || parts[0] != "steam" || parts[1] != "apps" || !int.TryParse(parts[2], out int id) || id <= 0 || parts[3] is not ("library_hero.jpg" or "library_600x900.jpg")) return null;
        return $"https://cdn.cloudflare.steamstatic.com/steam/apps/{id}/header.jpg";
    }
}
