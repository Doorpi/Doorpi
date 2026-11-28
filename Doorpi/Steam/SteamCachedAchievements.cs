using System.IO;
using System.Text;

namespace Doorpi.Steam;

// Steam stores each achievement in a bit of a named stat. Resolve the bit through
// this AppID's schema before attaching an unlock to a profile.
internal static class SteamCachedAchievements
{
    private sealed class Fields : Dictionary<string, object>
    {
        public Fields Child(string name) => this.GetValueOrDefault(name) as Fields ?? new();
        public string Text(string name) => this.GetValueOrDefault(name) as string ?? "";
    }

    private static Fields Read(string path)
    {
        using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        if (file.Length > 16 * 1024 * 1024) throw new InvalidDataException("Cache Steam excede o limite.");
        using var reader = new BinaryReader(file);
        string Text()
        {
            var bytes = new List<byte>();
            byte b;
            while ((b = reader.ReadByte()) != 0)
            {
                if (bytes.Count >= 65536) throw new InvalidDataException("Campo Steam inválido.");
                bytes.Add(b);
            }
            return Encoding.UTF8.GetString(bytes.ToArray());
        }
        Fields Parse(int depth)
        {
            if (depth > 48) throw new InvalidDataException("Cache Steam inválido.");
            var result = new Fields();
            while (true)
            {
                byte type = reader.ReadByte();
                if (type == 8) return result;
                var key = Text();
                result[key] = type switch
                {
                    0 => Parse(depth + 1), 1 => Text(), 2 or 3 or 4 or 6 => reader.ReadInt32(),
                    7 or 10 => reader.ReadInt64(), _ => throw new InvalidDataException("Formato de cache Steam desconhecido.")
                };
            }
        }
        return Parse(0);
    }

    public static List<SteamAchievementData> ReadUnlocked(string playerPath, string schemaPath, int appId)
    {
        return ReadCatalog(schemaPath, appId, Read(playerPath).Child("cache")).Where(a => a.Unlocked).ToList();
    }
    public static List<SteamAchievementData> ReadCatalog(string schemaPath,int appId) => ReadCatalog(schemaPath,appId,new Fields());
    private static List<SteamAchievementData> ReadCatalog(string schemaPath,int appId,Fields player)
    {
        var stats = Read(schemaPath).Child(appId.ToString()).Child("stats");
        var result = new List<SteamAchievementData>();
        foreach (var (stat, value) in stats)
        {
            var stored = player.Child(stat);
            if (value is not Fields definition) continue;
            int flags = stored.GetValueOrDefault("data") is int mask ? mask : 0;
            var times = stored.Child("AchievementTimes");
            foreach (var (index, info) in definition.Child("bits"))
            {
                if (!int.TryParse(index, out var bit) || bit is < 0 or > 31 || info is not Fields achievement) continue;
                var id = achievement.Text("name");
                if (string.IsNullOrWhiteSpace(id)) continue;
                var display = achievement.Child("display");
                string Localize(string field)
                {
                    var texts = display.Child(field);
                    return new[]{texts.Text("brazilian"), texts.Text("portuguese"), texts.Text("english"), display.Text(field)}.FirstOrDefault(s => s.Length > 0) ?? "";
                }
                var name = Localize("name");
                result.Add(new() { AppId = appId, ApiName = id, Name = name.Length > 0 ? name : id,
                    IconUrl = LocalSteamCatalog.Icon(appId,display.Text("icon")),
                    Description = Localize("desc"), Unlocked = (flags & (1 << bit)) != 0, UnlockTimeUnix = times.GetValueOrDefault(index) is int time ? Math.Max(0,time) : 0 });
            }
        }
        return result;
    }
}
