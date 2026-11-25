using System.Net;
using System.Net.Http;
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Doorpi.Steam;

public sealed class SteamWebApiClient(HttpClient http)
{
    private sealed class RateLimitedException() : InvalidOperationException("A Steam limitou as consultas. Aguarde antes de sincronizar novamente.");
    public static bool IsValidKey(string key) => Regex.IsMatch(key, "\\A[0-9a-fA-F]{32}\\z", RegexOptions.CultureInvariant);

    public static string ParseAccount(string input)
    {
        input = input.Trim();
        if (Regex.IsMatch(input, "\\A7656119[0-9]{10}\\z")) return input;
        if (Uri.TryCreate(input, UriKind.Absolute, out var uri) && uri.Scheme == "https" && uri.Host == "steamcommunity.com" && uri.Query.Length == 0 && uri.Fragment.Length == 0)
        {
            string[] parts = uri.AbsolutePath.Trim('/').Split('/');
            if (parts.Length == 2 && parts[0] is "id" or "profiles") return ParseAccount(parts[1]);
        }
        if (Regex.IsMatch(input, "\\A[a-zA-Z0-9_-]{2,64}\\z") && !input.All(char.IsDigit)) return input;
        throw new InvalidDataException("Informe o SteamID64 ou o endereço https://steamcommunity.com/id/... do perfil.");
    }

    private async Task<JsonDocument> GetAsync(string method, string arguments, string key, CancellationToken token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "https://api.steampowered.com/" + method + "/?" + arguments);
        request.Headers.Add("x-webapi-key", key);
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token).ConfigureAwait(false);
        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) throw new InvalidOperationException("A chave Steam foi recusada. Confira ou gere uma nova chave na página oficial.");
        if (response.StatusCode == HttpStatusCode.TooManyRequests) throw new RateLimitedException();
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("A Steam está indisponível para esta consulta. Os dados anteriores foram preservados.");
        if (response.Content.Headers.ContentLength > 16 * 1024 * 1024) throw new InvalidDataException("Resposta Steam excede o limite permitido.");
        await using var stream = await response.Content.ReadAsStreamAsync(token).ConfigureAwait(false);
        using var buffer = new MemoryStream();
        byte[] bytes = new byte[8192];
        int read;
        while ((read = await stream.ReadAsync(bytes, token).ConfigureAwait(false)) > 0)
        {
            if (buffer.Length + read > 16 * 1024 * 1024) throw new InvalidDataException("Resposta Steam excede o limite permitido.");
            buffer.Write(bytes, 0, read);
        }
        return JsonDocument.Parse(buffer.ToArray());
    }

    private async Task LoadAchievementIconsAsync(SteamGameData game, string key, CancellationToken token)
    {
        using var schema = await GetAsync("ISteamUserStats/GetSchemaForGame/v2", "appid=" + game.AppId, key, token);
        if (!schema.RootElement.GetProperty("game").TryGetProperty("availableGameStats", out var stats) ||
            !stats.TryGetProperty("achievements", out var entries)) return;
        var achievements = game.Achievements.ToDictionary(item => item.ApiName, StringComparer.Ordinal);
        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("name", out var name) || !achievements.TryGetValue(name.GetString() ?? "", out var item) ||
                !entry.TryGetProperty("icon", out var icon) || !Uri.TryCreate(icon.GetString(), UriKind.Absolute, out var uri)) continue;
            if (uri.Scheme == "http" && uri.IsDefaultPort) uri = new UriBuilder(uri) { Scheme = "https", Port = -1 }.Uri;
            if (SteamAchievementData.IsSteamImage(uri.AbsoluteUri)) item.IconUrl = uri.AbsoluteUri;
            string file = Path.GetFileName(uri.AbsolutePath);
            if (Regex.IsMatch(file, @"\A[0-9a-fA-F]{40}\.(jpg|png)\z")) item.IconFile = file;
        }
    }

    public async Task<SteamProfileData> ImportAsync(string account, string key, SteamProfileData? previous, IProgress<SteamImportProgressUpdate>? progress, CancellationToken token, int? targetAppId = null, bool recentOnly = false, IReadOnlyDictionary<int,string>? localGames = null)
    {
        try { return await ImportCoreAsync(account, key, previous, progress, token, targetAppId, recentOnly, localGames).ConfigureAwait(false); }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or OverflowException or FormatException)
        {
            throw new InvalidDataException("A Steam retornou dados incompletos ou em formato inesperado. Os dados anteriores foram preservados.");
        }
    }

    private async Task<SteamProfileData> ImportCoreAsync(string account, string key, SteamProfileData? previous, IProgress<SteamImportProgressUpdate>? progress, CancellationToken token, int? targetAppId, bool recentOnly, IReadOnlyDictionary<int,string>? localGames)
    {
        if (!IsValidKey(key)) throw new InvalidDataException("Chave Steam inválida. A chave SteamGridDB não serve para esta integração.");
        progress?.Report(new("account", "Identificando o perfil Steam…", Percent: 0));
        string steamId = ParseAccount(account);
        if (!steamId.All(char.IsDigit))
        {
            using var resolve = await GetAsync("ISteamUser/ResolveVanityURL/v1", "vanityurl=" + Uri.EscapeDataString(steamId), key, token);
            if (!resolve.RootElement.TryGetProperty("response", out var resolved) || !resolved.TryGetProperty("success", out var success) || success.GetInt32() != 1)
                throw new InvalidDataException("Perfil Steam não encontrado.");
            steamId = resolved.GetProperty("steamid").GetString() ?? "";
            if (!steamId.All(char.IsDigit) || ParseAccount(steamId) != steamId) throw new InvalidDataException("A Steam retornou uma identidade inválida.");
        }
        var result = new SteamProfileData { SteamId = steamId };
        progress?.Report(new("library", "Consultando biblioteca e horas na Steam…", Percent: 3));
        var known = previous?.SteamId == steamId ? previous.Games.FirstOrDefault(game => game.AppId == targetAppId) : null;
        if (known != null)
            result.Games.Add(new() { AppId = known.AppId, Id = known.Id, Name = known.Name, PlaytimeMinutes = known.PlaytimeMinutes, LastPlayedUnix = known.LastPlayedUnix });
        else
        {
            if (!recentOnly && !targetAppId.HasValue || previous?.SteamId != steamId)
            using (var summary = await GetAsync("ISteamUser/GetPlayerSummaries/v2", "steamids=" + steamId, key, token))
            {
                var players = summary.RootElement.GetProperty("response").GetProperty("players");
                if (players.GetArrayLength() != 1) throw new InvalidDataException("Perfil Steam não encontrado.");
                result.DisplayName = players[0].GetProperty("personaname").GetString() ?? "";
                result.AvatarUrl = players[0].GetProperty("avatarfull").GetString() ?? "";
            }
            string libraryMethod = recentOnly ? "IPlayerService/GetRecentlyPlayedGames/v1" : "IPlayerService/GetOwnedGames/v1";
            string filter = targetAppId.HasValue ? "&appids_filter[0]=" + targetAppId.Value : "";
            using (var library = await GetAsync(libraryMethod, "steamid=" + steamId + "&include_appinfo=true&include_played_free_games=true" + filter, key, token))
            {
                var body = library.RootElement.GetProperty("response");
                if (!body.TryGetProperty(recentOnly ? "total_count" : "game_count", out var count)) throw new InvalidOperationException("A Steam não disponibilizou sua biblioteca. Deixe o perfil e os detalhes dos jogos públicos e desative a opção de ocultar horas jogadas.");
                int expected = count.GetInt32();
                if (expected < 0 || expected > 20000) throw new InvalidDataException("Quantidade de jogos Steam inválida.");
                if (expected > 0 && (!body.TryGetProperty("games", out var games) || games.GetArrayLength() != expected)) throw new InvalidDataException("Biblioteca Steam incompleta; dados anteriores preservados.");
                if (body.TryGetProperty("games", out var entries))
                    foreach (var game in entries.EnumerateArray())
                    {
                        int appId = game.GetProperty("appid").GetInt32();
                        if (targetAppId.HasValue && appId != targetAppId.Value) continue;
                    if (appId <= 0) throw new InvalidDataException("AppID Steam inválido.");
                        if (!game.TryGetProperty("playtime_forever", out var minutes)) throw new InvalidOperationException("A Steam não disponibilizou as horas jogadas. Confira a privacidade das horas no perfil.");
                        result.Games.Add(new() { Id = appId.ToString(), AppId = appId, Name = game.GetProperty("name").GetString() ?? "", PlaytimeMinutes = Math.Max(0, minutes.GetInt64()), LastPlayedUnix = game.TryGetProperty("rtime_last_played", out var last) ? Math.Max(0, last.GetInt64()) : 0 });
                    }
            }
        }
        // Shared and newly added games can have player stats before they appear in the owned list.
        SteamGameData? unlisted = null;
        if (targetAppId is int requested && result.Games.Count == 0)
        {
            unlisted = new SteamGameData { AppId = requested, Id = requested.ToString() };
            result.Games.Add(unlisted);
        }
        var oldGames = previous?.SteamId == steamId ? previous.Games.ToDictionary(game => game.AppId) : new Dictionary<int, SteamGameData>();
        var localCandidates = new HashSet<int>();
        if (!targetAppId.HasValue && localGames != null)
        {
            var listed = result.Games.Select(game => game.AppId).ToHashSet();
            foreach (var (id, title) in localGames)
            {
                if (id <= 0 || listed.Contains(id) || (recentOnly && oldGames.TryGetValue(id, out var prior) && prior.Achievements.Count > 0)) continue;
                result.Games.Add(new SteamGameData { AppId = id, Id = id.ToString(), Name = title });
                localCandidates.Add(id);
            }
        }
        int unavailable = 0;
        bool limited = false;
        // Borrowed games may report lifetime minutes in recent activity only.
        if (!recentOnly && localCandidates.Count > 0)
        {
            try
            {
                using var recent = await GetAsync("IPlayerService/GetRecentlyPlayedGames/v1", "steamid=" + steamId, key, token);
                var borrowed = result.Games.Where(game => localCandidates.Contains(game.AppId)).ToDictionary(game => game.AppId);
                if (recent.RootElement.GetProperty("response").TryGetProperty("games", out var activity))
                    foreach (var entry in activity.EnumerateArray())
                        if (entry.TryGetProperty("appid", out var id) && id.TryGetInt32(out int appId) &&
                            borrowed.TryGetValue(appId, out var game) && entry.TryGetProperty("playtime_forever", out var time) &&
                            time.TryGetInt64(out long minutes) && minutes > 0 && minutes <= long.MaxValue / 60)
                            game.PlaytimeMinutes = minutes;
            }
            catch (RateLimitedException) { limited = true; }
            catch (Exception ex) when (ex is HttpRequestException or InvalidOperationException or KeyNotFoundException or JsonException or InvalidDataException) { }
        }
        var pendingGames = result.Games.Where(game => (game.PlaytimeMinutes > 0 || targetAppId.HasValue || localGames?.ContainsKey(game.AppId) == true) && (!targetAppId.HasValue || game.AppId == targetAppId)
            && (recentOnly || targetAppId.HasValue || !oldGames.TryGetValue(game.AppId, out var cached) || (localCandidates.Contains(game.AppId) && cached.Achievements.Count == 0) || cached.AchievementsCheckedUtc <= DateTimeOffset.UtcNow.AddHours(-24) || cached.AchievementsCheckedUtc == null || cached.PlaytimeMinutes != game.PlaytimeMinutes || cached.Achievements.Any(item => !item.GlobalUnlockPercent.HasValue || item.IconUrl == null))).ToList();
        progress?.Report(new("achievements", pendingGames.Count > 0
            ? $"Importando troféus: 0 de {pendingGames.Count} jogos concluídos…"
            : "Troféus já estão atualizados.", 0, pendingGames.Count, pendingGames.Count == 0 ? 98 : 5));
        int achievementsCompleted = 0;
        foreach (var game in pendingGames)
        {
            if (limited) break;
            progress?.Report(new("achievements", $"Importando troféus de {game.Name} ({achievementsCompleted + 1} de {pendingGames.Count})…",
                achievementsCompleted, pendingGames.Count, 5 + (pendingGames.Count == 0 ? 93 : achievementsCompleted * 93 / pendingGames.Count)));
            try
            {
                using var achievements = await GetAsync("ISteamUserStats/GetPlayerAchievements/v1", "steamid=" + steamId + "&appid=" + game.AppId + "&l=portuguese", key, token);
                var stats = achievements.RootElement.GetProperty("playerstats");
                if (stats.TryGetProperty("success", out var success) && success.GetBoolean() && stats.TryGetProperty("achievements", out var list))
                {
                    if (game == unlisted && stats.TryGetProperty("gameName", out var title)) game.Name = title.GetString() ?? "";
                    foreach (var item in list.EnumerateArray())
                    {
                        string apiName = item.GetProperty("apiname").GetString() ?? throw new InvalidDataException("Conquista sem identidade.");
                        game.Achievements.Add(new() { Id = game.AppId + "/" + apiName, AppId = game.AppId, ApiName = apiName, Name = item.TryGetProperty("name", out var name) ? name.GetString() ?? apiName : apiName, Description = item.TryGetProperty("description", out var desc) ? desc.GetString() ?? "" : "", Unlocked = item.GetProperty("achieved").GetInt32() != 0, UnlockTimeUnix = item.TryGetProperty("unlocktime", out var time) ? Math.Max(0, time.GetInt64()) : 0 });
                    }
                    game.AchievementsCheckedUtc = DateTimeOffset.UtcNow;
                    // Global percentages enrich presentation. Failure must not
                    // discard player unlocks or prevent importing the profile.
                    try
                    {
                        bool reusePercentages = oldGames.TryGetValue(game.AppId, out var prior) &&
                            prior.AchievementsCheckedUtc > DateTimeOffset.UtcNow.AddDays(-1) &&
                            game.Achievements.All(a => prior.Achievements.Any(old => old.ApiName == a.ApiName && old.GlobalUnlockPercent.HasValue));
                        if (!reusePercentages)
                        {
                            using var global = await GetAsync("ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2", "gameid=" + game.AppId, key, token);
                            if (global.RootElement.TryGetProperty("achievementpercentages", out var percentages) && percentages.TryGetProperty("achievements", out var values))
                            {
                                var byName = game.Achievements.ToDictionary(item => item.ApiName, StringComparer.Ordinal);
                                foreach (var value in values.EnumerateArray())
                                    if (value.TryGetProperty("name", out var name) && byName.TryGetValue(name.GetString() ?? "", out var achievement) && value.TryGetProperty("percent", out var raw) && SteamMedals.ParsePercent(raw) is { } percent)
                                        achievement.GlobalUnlockPercent = percent;
                            }
                        }
                    }
                    catch (RateLimitedException) { limited = true; }
                    catch (Exception ex) when (ex is HttpRequestException or JsonException or InvalidOperationException or KeyNotFoundException or FormatException or InvalidDataException) { }
                    try
                    {
                        if (!limited && game.Achievements.Count > 0 && (!oldGames.TryGetValue(game.AppId, out var existing) || existing.Achievements.Count != game.Achievements.Count || existing.Achievements.Any(item => item.IconUrl == null)))
                            await LoadAchievementIconsAsync(game, key, token).ConfigureAwait(false);
                    }
                    catch (RateLimitedException) { limited = true; }
                    catch (Exception ex) when (ex is HttpRequestException or JsonException or InvalidOperationException or KeyNotFoundException or InvalidDataException) { }
                }
                else { if (!localCandidates.Contains(game.AppId)) unavailable++; game.AchievementsCheckedUtc = DateTimeOffset.UtcNow; }
            }
            catch (RateLimitedException) { limited = true; break; }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or InvalidOperationException or KeyNotFoundException or FormatException or OverflowException) { unavailable++; }
            achievementsCompleted++;
            progress?.Report(new("achievements", $"Troféus importados: {achievementsCompleted} de {pendingGames.Count} jogos concluídos.",
                achievementsCompleted, pendingGames.Count, 5 + achievementsCompleted * 93 / Math.Max(1, pendingGames.Count)));
            await Task.Delay(200, token).ConfigureAwait(false);
            if (limited) break;
        }
        result.Games.RemoveAll(game => localCandidates.Contains(game.AppId) && game.Achievements.Count == 0 && game.PlaytimeMinutes == 0);
        if (unlisted != null && (string.IsNullOrWhiteSpace(unlisted.Name) || unlisted.Achievements.Count == 0)) result.Games.Remove(unlisted);
        string completionMessage = limited ? "Horas importadas. A Steam limitou a atualização dos troféus; os dados anteriores foram preservados."
            : unavailable == 0 ? "Dados Steam importados." : $"Dados importados. Troféus indisponíveis em {unavailable} jogo(s); dados anteriores foram preservados.";
        progress?.Report(new("complete", completionMessage, pendingGames.Count, pendingGames.Count, limited || unavailable > 0 ? 98 : 100));
        var merged = SteamProfileMerge.Merge(previous?.SteamId == steamId ? previous : null, result)!;
        merged.RetryRequired = limited || ((recentOnly || targetAppId.HasValue) && (unavailable > 0 || (targetAppId.HasValue && !result.Games.Any(game => game.AppId == targetAppId))));
        return merged;
    }
}
