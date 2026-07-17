using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace Doorpi
{
    public partial class MainWindow
    {
        private const int ProfilePhotoMaxBytes = 8 * 1024 * 1024;
        private static readonly string[] ProfilePhotoSuggestionTitles =
        {
            "Super Mario Galaxy 2 (2010)",
            "God of War (2018)",
            "Metal Gear Rising: Revengeance (2014)",
            "Dark Souls III (2016)",
            "Resident Evil 4 (2023)",
            "Devil May Cry 4: Special Edition (2015)",
            "Bayonetta (2009)",
            "Metal Gear Solid Delta: Snake Eater (2025)",
            "Sackboy: A Big Adventure (2020)",
            "Marvel's Spider-Man: Miles Morales (2020)",
            "Marvel's Spider-Man Remastered (2020)",
            "Diablo II: Resurrected (2021)",
            "Diablo Immortal",
            "Call of Duty (2023)",
            "Battlefield 3 (2011)",
            "Naruto: Ultimate Ninja STORM (2008)",
            "Naruto Shippūden: Ultimate Ninja 4 (2007)",
            "Dragon Ball Z: Ultimate Tenkaichi (2011)"
        };

        private sealed class ProfilePhotoArtworkResult
        {
            public int Id { get; init; }
            public string Url { get; init; } = "";
            public string Thumb { get; init; } = "";
            public int Score { get; init; }
            public int Width { get; init; }
            public int Height { get; init; }
            public string Shape { get; init; } = "";
            public string GameName { get; init; } = "";
        }

        private sealed class ProfilePhotoGameSuggestion
        {
            public int Id { get; init; }
            public string Name { get; init; } = "";
        }

        private async Task<string> SgdbGetStringWithKeyAsync(string url, string apiKey, CancellationToken token)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey.Trim());

            using var linked = CancellationTokenSource.CreateLinkedTokenSource(token);
            linked.CancelAfter(TimeSpan.FromSeconds(6));
            using var response = await httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                linked.Token).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync(linked.Token).ConfigureAwait(false);
        }

        private static string ProfilePhotoGameKey(string value)
            => new(value.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());

        private async Task<List<ProfilePhotoGameSuggestion>> SearchProfilePhotoGameSuggestionsAsync(
            string query,
            string apiKey,
            CancellationToken token)
        {
            if (string.IsNullOrWhiteSpace(query) || string.IsNullOrWhiteSpace(apiKey)) return new();
            string safe = Uri.EscapeDataString(query.Trim());
            string json = await SgdbGetStringWithKeyAsync(
                $"https://www.steamgriddb.com/api/v2/search/autocomplete/{safe}",
                apiKey,
                token).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("success", out var success) || !success.GetBoolean() ||
                !doc.RootElement.TryGetProperty("data", out var data))
                return new();

            return data.EnumerateArray()
                .Select(item => new ProfilePhotoGameSuggestion
                {
                    Id = item.TryGetProperty("id", out var idEl) && idEl.TryGetInt32(out int id) ? id : 0,
                    Name = item.TryGetProperty("name", out var nameEl) ? nameEl.GetString() ?? "" : ""
                })
                .Where(item => item.Id != 0 && !string.IsNullOrWhiteSpace(item.Name))
                .GroupBy(item => item.Id)
                .Select(group => group.First())
                .Take(8)
                .ToList();
        }

        private async Task<(int Id, string Name)> ResolveProfilePhotoGameAsync(
            string query,
            string apiKey,
            CancellationToken token)
        {
            async Task<(int, string)> Search(string term)
            {
                string safe = Uri.EscapeDataString(term.Trim());
                string json = await SgdbGetStringWithKeyAsync(
                    $"https://www.steamgriddb.com/api/v2/search/autocomplete/{safe}",
                    apiKey,
                    token).ConfigureAwait(false);
                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.TryGetProperty("success", out var success) || !success.GetBoolean() ||
                    !doc.RootElement.TryGetProperty("data", out var data))
                    return (0, "");

                var results = data.EnumerateArray().ToList();
                if (results.Count == 0) return (0, "");

                string wanted = ProfilePhotoGameKey(Regex.Replace(term, @"\s*\(\d{4}\)\s*$", ""));
                var match = results.FirstOrDefault(item =>
                    item.TryGetProperty("name", out var nameEl) &&
                    ProfilePhotoGameKey(nameEl.GetString() ?? "") == wanted);
                if (match.ValueKind == JsonValueKind.Undefined) match = results[0];
                return (
                    match.TryGetProperty("id", out var idEl) ? idEl.GetInt32() : 0,
                    match.TryGetProperty("name", out var resultNameEl) ? resultNameEl.GetString() ?? term : term);
            }

            var result = await Search(query).ConfigureAwait(false);
            if (result.Item1 != 0) return result;

            string withoutYear = Regex.Replace(query, @"\s*\(\d{4}\)\s*$", "").Trim();
            return withoutYear.Equals(query.Trim(), StringComparison.OrdinalIgnoreCase)
                ? result
                : await Search(withoutYear).ConfigureAwait(false);
        }

        private async Task<List<ProfilePhotoArtworkResult>> FetchProfilePhotoShapeAsync(
            int gameId,
            string gameName,
            string shape,
            string apiKey,
            int take,
            CancellationToken token)
        {
            string dimensions = shape == "square"
                ? "512x512,1024x1024"
                : "600x900,342x482,660x930";
            int requestLimit = take > 0 ? Math.Clamp(take, 1, 50) : 50;
            string endpoint = $"grids/game/{gameId}?styles=no_logo&dimensions={dimensions}&types=static&sort=score&limit={requestLimit}&nsfw=false";
            string json = await SgdbGetStringWithKeyAsync(
                $"https://www.steamgriddb.com/api/v2/{endpoint}",
                apiKey,
                token).ConfigureAwait(false);
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("success", out var success) || !success.GetBoolean() ||
                !doc.RootElement.TryGetProperty("data", out var data))
                return new List<ProfilePhotoArtworkResult>();

            var results = data.EnumerateArray()
                .Where(item => !SteamGridArtworkIsNsfw(item))
                .Select(item => new ProfilePhotoArtworkResult
                {
                    Id = item.TryGetProperty("id", out var idEl) && idEl.TryGetInt32(out int id) ? id : 0,
                    Url = item.TryGetProperty("url", out var urlEl) ? urlEl.GetString() ?? "" : "",
                    Thumb = item.TryGetProperty("thumb", out var thumbEl) ? thumbEl.GetString() ?? "" : "",
                    Score = item.TryGetProperty("score", out var scoreEl) && scoreEl.TryGetInt32(out int score) ? score : 0,
                    Width = item.TryGetProperty("width", out var widthEl) && widthEl.TryGetInt32(out int width) ? width : 0,
                    Height = item.TryGetProperty("height", out var heightEl) && heightEl.TryGetInt32(out int height) ? height : 0,
                    Shape = shape,
                    GameName = gameName
                })
                .Where(item => !string.IsNullOrWhiteSpace(item.Url))
                .OrderByDescending(item => item.Score)
                .ThenByDescending(item => item.Id);
            return take > 0 ? results.Take(take).ToList() : results.ToList();
        }

        private static void ShuffleProfilePhotoResults(List<ProfilePhotoArtworkResult> items)
        {
            for (int i = items.Count - 1; i > 0; i--)
            {
                int j = Random.Shared.Next(i + 1);
                (items[i], items[j]) = (items[j], items[i]);
            }
        }

        private async Task<(List<ProfilePhotoArtworkResult> Squares, List<ProfilePhotoArtworkResult> Verticals)>
            SearchProfilePhotoArtworkAsync(string query, string apiKey, bool suggestions, CancellationToken token)
        {
            if (string.IsNullOrWhiteSpace(apiKey))
                return (new(), new());

            string[] titles = suggestions
                ? ProfilePhotoSuggestionTitles
                : new[] { query.Trim() };
            int squareTake = suggestions ? 0 : 36;
            int verticalTake = suggestions ? 1 : 36;
            using var gate = new SemaphoreSlim(3, 3);

            var tasks = titles.Select(async title =>
            {
                await gate.WaitAsync(token).ConfigureAwait(false);
                try
                {
                    var game = await ResolveProfilePhotoGameAsync(title, apiKey, token).ConfigureAwait(false);
                    if (game.Id == 0)
                        return (Squares: new List<ProfilePhotoArtworkResult>(), Verticals: new List<ProfilePhotoArtworkResult>());

                    var squaresTask = FetchProfilePhotoShapeAsync(game.Id, game.Name, "square", apiKey, squareTake, token);
                    var verticalsTask = FetchProfilePhotoShapeAsync(game.Id, game.Name, "vertical", apiKey, verticalTake, token);
                    await Task.WhenAll(squaresTask, verticalsTask).ConfigureAwait(false);
                    return (Squares: squaresTask.Result, Verticals: verticalsTask.Result);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[ProfilePhoto] Busca falhou para {title}: {ex.Message}");
                    return (Squares: new List<ProfilePhotoArtworkResult>(), Verticals: new List<ProfilePhotoArtworkResult>());
                }
                finally
                {
                    gate.Release();
                }
            }).ToList();

            var groups = await Task.WhenAll(tasks).ConfigureAwait(false);
            var squares = groups.SelectMany(group => group.Squares)
                .GroupBy(item => item.Id != 0 ? $"id:{item.Id}" : item.Url, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .ToList();
            var verticals = groups.SelectMany(group => group.Verticals)
                .GroupBy(item => item.Id != 0 ? $"id:{item.Id}" : item.Url, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .ToList();

            if (suggestions)
            {
                ShuffleProfilePhotoResults(squares);
                ShuffleProfilePhotoResults(verticals);
            }
            else
            {
                squares = squares.OrderByDescending(item => item.Score).ToList();
                verticals = verticals.OrderByDescending(item => item.Score).ToList();
            }

            return (squares, verticals);
        }

        private static bool ContainsAsciiSequence(byte[] bytes, string value)
        {
            if (bytes.Length < value.Length) return false;
            for (int i = 0; i <= bytes.Length - value.Length; i++)
            {
                bool match = true;
                for (int j = 0; j < value.Length; j++)
                {
                    if (bytes[i + j] == (byte)value[j]) continue;
                    match = false;
                    break;
                }
                if (match) return true;
            }
            return false;
        }

        private static bool TryGetStaticProfilePhotoMime(byte[] bytes, out string mime)
        {
            mime = "";
            if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
            {
                mime = "image/jpeg";
                return true;
            }
            if (bytes.Length >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)
            {
                if (ContainsAsciiSequence(bytes, "acTL")) return false;
                mime = "image/png";
                return true;
            }
            if (bytes.Length >= 12 && ContainsAsciiSequence(bytes[..12], "RIFF") && ContainsAsciiSequence(bytes[..12], "WEBP"))
            {
                if (ContainsAsciiSequence(bytes, "ANIM") || ContainsAsciiSequence(bytes, "ANMF")) return false;
                mime = "image/webp";
                return true;
            }
            return false;
        }

        private static async Task<byte[]> ReadProfilePhotoBytesAsync(
            Stream stream,
            long? totalBytes,
            Action<long, long?>? reportProgress,
            CancellationToken token)
        {
            using var output = new MemoryStream();
            byte[] buffer = new byte[64 * 1024];
            reportProgress?.Invoke(0, totalBytes);
            while (true)
            {
                int read = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length), token).ConfigureAwait(false);
                if (read == 0) break;
                if (output.Length + read > ProfilePhotoMaxBytes)
                    throw new InvalidDataException("profile-photo-too-large");
                output.Write(buffer, 0, read);
                reportProgress?.Invoke(output.Length, totalBytes);
            }
            return output.ToArray();
        }

        private async Task<(byte[] Bytes, string Mime)> DownloadProfilePhotoSourceAsync(
            string url,
            Action<long, long?>? reportProgress,
            CancellationToken token)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
                throw new InvalidDataException("profile-photo-invalid-url");

            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(token);
            linked.CancelAfter(TimeSpan.FromSeconds(12));
            using var response = await httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                linked.Token).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
            if (response.Content.Headers.ContentLength > ProfilePhotoMaxBytes)
                throw new InvalidDataException("profile-photo-too-large");
            await using var stream = await response.Content.ReadAsStreamAsync(linked.Token).ConfigureAwait(false);
            byte[] bytes = await ReadProfilePhotoBytesAsync(
                stream,
                response.Content.Headers.ContentLength,
                reportProgress,
                linked.Token).ConfigureAwait(false);
            if (!TryGetStaticProfilePhotoMime(bytes, out string mime))
                throw new InvalidDataException("profile-photo-invalid-format");
            return (bytes, mime);
        }
    }
}
