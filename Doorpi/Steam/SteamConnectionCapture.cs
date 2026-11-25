using System.Text.Json;

namespace Doorpi.Steam;

public static class SteamConnectionCapture
{
    public const string Prefix = "doorpi_steam_connect:";
    public static bool IsKeyPage(string source) => Uri.TryCreate(source, UriKind.Absolute, out var uri)
        && uri.Scheme == "https" && uri.Host == "steamcommunity.com" && uri.IsDefaultPort
        && uri.AbsolutePath.TrimEnd('/') == "/dev/apikey";

    public static (string Key, string Account)? Parse(string source, string message, string nonce)
    {
        if (!IsKeyPage(source) || !message.StartsWith(Prefix, StringComparison.Ordinal) || message.Length > 4096) return null;
        try
        {
            using var document = JsonDocument.Parse(message[Prefix.Length..]);
            var root = document.RootElement;
            if (root.GetProperty("nonce").GetString() != nonce) return null;
            string key = root.GetProperty("key").GetString() ?? "";
            string account = root.GetProperty("account").GetString() ?? "";
            if (!SteamWebApiClient.IsValidKey(key) || account.Length > 2048) return null;
            return (key, SteamWebApiClient.ParseAccount(account));
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException or System.IO.InvalidDataException) { return null; }
    }
}
