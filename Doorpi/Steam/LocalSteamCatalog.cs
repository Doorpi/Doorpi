using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Doorpi.Steam;

internal static class LocalSteamCatalog
{
    internal static string? Icon(int app,string filename) =>
        Regex.IsMatch(filename,@"\A[\w .-]{1,200}\.(jpg|jpeg|png)\z",RegexOptions.IgnoreCase)
            ? $"https://shared.fastly.steamstatic.com/community_assets/images/apps/{app}/{Uri.EscapeDataString(filename)}" : null;

    internal static bool IsStoreGame(GameModel game)
    {
        if (!string.IsNullOrWhiteSpace(game.EmulatorId)) return true;
        if (Uri.TryCreate(game.LaunchUrl,UriKind.Absolute,out var uri) && !uri.IsFile) return true;
        return game.Source.Trim().ToLowerInvariant() is "steam" or "epic" or "epic games" or "gog" or "gog galaxy" or "xbox" or "microsoft store" or "riot" or "riot games" or "ubisoft" or "ea" or "battle.net";
    }

    public static int Identify(GameModel game)
    {
        int official = SteamHistoryImport.AppIdFromUrl(game.LaunchUrl);
        if (official > 0) return official;
        if (IsStoreGame(game) || !Path.IsPathFullyQualified(game.Path) || !File.Exists(game.Path)) return 0;
        var folder = Directory.GetParent(game.Path);
        for (int i = 0; i < 4 && folder?.Parent != null; i++, folder = folder.Parent)
        {
            foreach (var relative in new[] { "steam_appid.txt", @"steam_settings\steam_appid.txt", @"platform\steam\steam_settings\steam_appid.txt" })
            {
                var file = new FileInfo(Path.Combine(folder.FullName,relative));
                if (file.Exists && file.Length <= 64 && int.TryParse(File.ReadAllText(file.FullName).Trim(), out var id) && id > 0) return id;
            }
            foreach(var filename in new[]{"steam_emu.ini","steam_api.ini","tenoke.ini","steam_settings/configs.app.ini"})
            {
                var metadata=new FileInfo(Path.Combine(folder.FullName,filename));
                if(!metadata.Exists || metadata.Length>256*1024) continue;
                var m=Regex.Match(File.ReadAllText(metadata.FullName),@"(?im)^\s*app_?id\s*=\s*(\d+)\s*(?:[;#].*)?$");
                if(m.Success && int.TryParse(m.Groups[1].Value,out var id) && id>0) return id;
            }
            if (folder.Parent.Name.Equals("common",StringComparison.OrdinalIgnoreCase) && folder.Parent.Parent?.Name.Equals("steamapps",StringComparison.OrdinalIgnoreCase) == true)
            {
                foreach (var manifest in folder.Parent.Parent.EnumerateFiles("appmanifest_*.acf"))
                {
                    if (manifest.Length > 1024*1024) continue;
                    var dir = Regex.Match(File.ReadAllText(manifest.FullName), "\"" + "installdir" + "\"\\s+\"([^\"]+)\"",RegexOptions.IgnoreCase).Groups[1].Value;
                    if (folder.Name.Equals(dir,StringComparison.OrdinalIgnoreCase) && int.TryParse(Path.GetFileNameWithoutExtension(manifest.Name)[12..],out int id)) return id;
                }
                break;
            }
        }
        return 0;
    }

    public static async Task<SteamGameData> FetchAsync(HttpClient http,int app,string name)
    {
        using var response = await http.GetAsync($"https://steamcommunity.com/achievements/{app}/?l=brazilian",HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        await response.Content.LoadIntoBufferAsync(8*1024*1024);
        string html = await response.Content.ReadAsStringAsync();
        var match = Regex.Match(html,"<script[^>]*id=\"valve-ssr-data\"[^>]*>(.*?)</script>",RegexOptions.Singleline,TimeSpan.FromSeconds(1));
        if (!match.Success) throw new InvalidDataException("Catálogo Steam indisponível.");
        var rows = new Dictionary<string,SteamAchievementData>();
        var keys = new Dictionary<int,string>();
        var percentages = new Dictionary<int,double>();
        bool found = false;
        void Walk(JsonElement node,int depth)
        {
            if (depth > 50) return;
            if (node.ValueKind == JsonValueKind.Object)
            {
                if(node.TryGetProperty("percentages",out var pct) && pct.ValueKind==JsonValueKind.Object)
                    foreach(var v in pct.EnumerateObject())
                        if(int.TryParse(v.Name,out var k) && SteamMedals.ParsePercent(v.Value) is double n) percentages[k]=n;
                if(node.TryGetProperty("achievements",out var list) && list.ValueKind == JsonValueKind.Array && list.GetArrayLength()>0 &&
                    list[0].TryGetProperty("api_name",out _))
                {
                    foreach(var row in list.EnumerateArray())
                    {
                        var id = row.GetProperty("api_name").GetString()!;
                        if (row.TryGetProperty("archived",out var archived) && archived.ValueKind == JsonValueKind.True) continue;
                        if (row.TryGetProperty("internal_key",out var k) && k.TryGetInt32(out int key)) keys[key]=id;
                        string icon = row.GetProperty("icon_achieved").GetString() ?? "";
                        rows[id] = new() { AppId=app,ApiName=id,Name=row.GetProperty("name").GetString() ?? id,
                            Description=row.TryGetProperty("description",out var d) ? d.GetString() ?? "" : "",
                            IconUrl=Icon(app,icon) };
                    }
                    found=true;
                }
                foreach(var property in node.EnumerateObject()) Walk(property.Value,depth+1);
            }
            else if(node.ValueKind == JsonValueKind.Array) foreach(var item in node.EnumerateArray()) Walk(item,depth+1);
            else if(node.ValueKind == JsonValueKind.String && node.GetString() is string text && (text.StartsWith('{') || text.StartsWith('[')))
            {
                JsonDocument nested;
                try { nested=JsonDocument.Parse(text); } catch(JsonException){return;}
                using(nested) Walk(nested.RootElement,depth+1);
            }
        }
        using var document=JsonDocument.Parse(match.Groups[1].Value);
        Walk(document.RootElement,0);
        if(!found || rows.Count==0) throw new InvalidDataException("Steam não forneceu o catálogo.");
        foreach(var (key,percent) in percentages) if(keys.TryGetValue(key,out var id) && rows.TryGetValue(id,out var item)) item.GlobalUnlockPercent=percent;
        return new(){AppId=app,Name=name,AchievementsCheckedUtc=DateTimeOffset.UtcNow,Achievements=rows.Values.ToList()};
    }
}
