using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Doorpi.Storage;

namespace Doorpi.Steam;

public static class SteamProfileStore
{
    public static string[] DataNames => ["steam-account.json", "steam-games.json", "steam-achievements.json"];
    private sealed class Account
    {
        public string SteamId { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string AvatarUrl { get; set; } = "";
    }

    public static SteamProfileData? Read(string directory)
    {
        string[] paths = DataNames.Select(name => Path.Combine(directory, name)).ToArray();
        var snapshot = StateStorage.ReadSnapshot(paths);
        if (snapshot.Documents[paths[0]] is not { } accountJson) return null;
        var account = JsonSerializer.Deserialize<Account>(accountJson) ?? throw new InvalidDataException("Perfil Steam inválido.");
        var games = snapshot.Documents[paths[1]] is { } gameJson ? JsonSerializer.Deserialize<List<SteamGameData>>(gameJson) ?? throw new InvalidDataException("Biblioteca Steam inválida.") : new();
        var achievements = snapshot.Documents[paths[2]] is { } achievementJson ? JsonSerializer.Deserialize<List<SteamAchievementData>>(achievementJson) ?? throw new InvalidDataException("Conquistas Steam inválidas.") : new();
        var byGame = achievements.GroupBy(item => item.AppId).ToDictionary(group => group.Key, group => group.ToList());
        foreach (var game in games) game.Achievements = byGame.GetValueOrDefault(game.AppId) ?? new();
        var result = new SteamProfileData { SteamId = account.SteamId, DisplayName = account.DisplayName, AvatarUrl = account.AvatarUrl, Games = games };
        Validate(result);
        return result;
    }

    public static void Validate(SteamProfileData data)
    {
        if (string.IsNullOrWhiteSpace(data.SteamId) || SteamWebApiClient.ParseAccount(data.SteamId) != data.SteamId || !data.SteamId.All(char.IsDigit)) throw new InvalidDataException("Identidade Steam inválida.");
        if (data.DisplayName == null || data.DisplayName.Length > 1024 || data.AvatarUrl == null || data.AvatarUrl.Length > 2048) throw new InvalidDataException("Dados de perfil Steam inválidos.");
        if (data.Games == null || data.Games.Count > 20000 || data.Games.Any(game => game == null) || data.Games.Select(game => game.AppId).Distinct().Count() != data.Games.Count) throw new InvalidDataException("Biblioteca Steam inválida.");
        foreach (var game in data.Games)
        {
            if (game.AppId <= 0 || game.PlaytimeMinutes < 0 || game.PlaytimeMinutes > long.MaxValue / 60 || game.Name == null || game.Name.Length > 1024 || game.Achievements == null || game.Achievements.Count > 20000)
                throw new InvalidDataException("Dados de jogo Steam inválidos.");
            if (game.Achievements.Any(item => item == null) || game.Achievements.Select(item => item.ApiName).Distinct(StringComparer.Ordinal).Count() != game.Achievements.Count) throw new InvalidDataException("Conquistas Steam duplicadas.");
            foreach (var item in game.Achievements)
            {
                if (item.IconUrl != null && !SteamAchievementData.IsSteamImage(item.IconUrl)) throw new InvalidDataException("Endereço de imagem Steam inválido.");
                if (item.IconFile != null && !System.Text.RegularExpressions.Regex.IsMatch(item.IconFile, @"\A[0-9a-fA-F]{40}\.(jpg|png)\z"))
                    throw new InvalidDataException("Identificador de imagem Steam inválido.");
                if (item.GlobalUnlockPercent is { } percent && (!double.IsFinite(percent) || percent < 0 || percent > 100))
                    throw new InvalidDataException("Porcentagem de conquista Steam inválida.");
                if (item.AppId != game.AppId || string.IsNullOrWhiteSpace(item.ApiName) || item.ApiName.Length > 1024 || item.UnlockTimeUnix < 0 || item.Name == null || item.Name.Length > 4096 || item.Description == null || item.Description.Length > 32768)
                    throw new InvalidDataException("Identidade de conquista Steam inválida.");
            }
        }
    }

    public static Dictionary<string, string?> BuildWrites(string directory, SteamProfileData data)
    {
        Validate(data);
        var games = new List<SteamGameData>();
        var achievements = new List<SteamAchievementData>();
        foreach (var source in data.Games.Where(g=>!SteamProfileMerge.IsLegacyPlaceholder(g)))
        {
            games.Add(new() { Id = source.AppId.ToString(), AppId = source.AppId, Name = source.Name, PlaytimeMinutes = source.PlaytimeMinutes, LastPlayedUnix = source.LastPlayedUnix, AchievementsCheckedUtc = source.AchievementsCheckedUtc });
            foreach (var item in source.Achievements)
                achievements.Add(new() { Id = source.AppId + "/" + item.ApiName, AppId = source.AppId, ApiName = item.ApiName, Name = item.Name, Description = item.Description, Unlocked = item.Unlocked, UnlockTimeUnix = item.UnlockTimeUnix, IconFile = item.IconFile, IconUrl = item.IconUrl, GlobalUnlockPercent = item.GlobalUnlockPercent });
        }
        return new()
        {
            [Path.Combine(directory, DataNames[0])] = JsonSerializer.Serialize(new Account { SteamId = data.SteamId, DisplayName = data.DisplayName, AvatarUrl = data.AvatarUrl }),
            [Path.Combine(directory, DataNames[1])] = JsonSerializer.Serialize(games),
            [Path.Combine(directory, DataNames[2])] = JsonSerializer.Serialize(achievements)
        };
    }

    internal static bool ArchiveUnverifiedCacheRows(string directory)
    {
        bool repaired=false;
        StateStorage.ExecuteTransaction(() =>
        {
            var profile=Read(directory);
            if(profile==null) return;
            var invalid=profile.Games.Where(SteamProfileMerge.IsLegacyPlaceholder).ToList();
            if(invalid.Count==0)return;
            string archive=Path.Combine(directory,"steam-cache-recovery.json");
            var rows=StateStorage.Exists(archive) ? JsonSerializer.Deserialize<Dictionary<string,SteamGameData>>(StateStorage.ReadAllText(archive)) ?? throw new InvalidDataException() : new();
            foreach(var game in invalid)
            {
                rows.TryAdd(profile.SteamId+"/"+game.AppId,game);
                profile.Games.Remove(game);
            }
            var writes=BuildWrites(directory,profile);
            var batch=new Dictionary<string,string?>(writes){[archive]=JsonSerializer.Serialize(rows)};
            StateStorage.WriteBatch(batch);
            repaired=true;
        });
        return repaired;
    }

    public static bool HasKey(string directory) => StateStorage.Exists(Path.Combine(directory, "steam-credentials.json"));
    public static void SaveKey(string directory, string key)
    {
        if (!SteamWebApiClient.IsValidKey(key)) throw new InvalidDataException("A chave Steam deve ter 32 caracteres hexadecimais. Ela é diferente da chave SteamGridDB.");
        byte[] encrypted = ProtectedData.Protect(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(Path.GetFullPath(directory).ToUpperInvariant()), DataProtectionScope.CurrentUser);
        StateStorage.WriteAllText(Path.Combine(directory, "steam-credentials.json"), JsonSerializer.Serialize(Convert.ToBase64String(encrypted)), keepBackup: false);
    }
    public static void SaveConnection(string directory, string key, string account)
    {
        account = SteamWebApiClient.ParseAccount(account);
        StateStorage.ExecuteTransaction(() => {
            SaveKey(directory, key);
            StateStorage.WriteAllText(Path.Combine(directory, "steam-connection.json"), JsonSerializer.Serialize(account), keepBackup: false);
        });
    }
    public static string ReadConnectedAccount(string directory)
    {
        string path = Path.Combine(directory, "steam-connection.json");
        if (!StateStorage.Exists(path)) return "";
        string account = JsonSerializer.Deserialize<string>(StateStorage.ReadAllText(path)) ?? throw new InvalidDataException("Conexão Steam inválida.");
        return SteamWebApiClient.ParseAccount(account);
    }
    public static string ReadKey(string directory)
    {
        string encrypted = JsonSerializer.Deserialize<string>(StateStorage.ReadAllText(Path.Combine(directory, "steam-credentials.json"))) ?? throw new InvalidDataException("Credencial Steam inválida.");
        return Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(encrypted), Encoding.UTF8.GetBytes(Path.GetFullPath(directory).ToUpperInvariant()), DataProtectionScope.CurrentUser));
    }
    public static void DeleteKey(string directory) => StateStorage.WriteBatch(new Dictionary<string, string?> {
        [Path.Combine(directory, "steam-credentials.json")] = null, [Path.Combine(directory, "steam-credentials.json.bak")] = null,
        [Path.Combine(directory, "steam-connection.json")] = null, [Path.Combine(directory, "steam-connection.json.bak")] = null });
}
