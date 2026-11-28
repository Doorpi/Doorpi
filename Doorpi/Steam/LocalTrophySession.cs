using System.IO;
using System.Text.Json;

namespace Doorpi.Steam;

// Compare each installation's progress with its own baseline for this play session.
// A first observation cannot establish ownership of an older unlock.
internal sealed class LocalTrophySession(DateTimeOffset started)
{
    private readonly Dictionary<string,Dictionary<string,long>> previous = new(StringComparer.OrdinalIgnoreCase);

    private readonly Dictionary<string,long> pending=new(StringComparer.Ordinal);
    public void Acknowledge(IEnumerable<string> ids) { foreach(var id in ids)pending.Remove(id); }
    internal bool HasSessionTimestamp(long stamp) =>
        stamp > 0 && stamp >= started.ToUnixTimeSeconds() && stamp <= DateTimeOffset.UtcNow.AddSeconds(2).ToUnixTimeSeconds();

    public Dictionary<string,long> Observe(string source, Dictionary<string,long> earned)
    {
        previous.TryGetValue(source,out var baseline);

        foreach(var (id,stamp) in earned)
        {
            if(baseline!=null && baseline.TryGetValue(id,out var old) && old==stamp) continue;
            bool duringSession=HasSessionTimestamp(stamp);
            if(duringSession || (stamp==0 && baseline!=null && !baseline.ContainsKey(id))) pending[id]=stamp;
        }
        previous[source]=earned;
        return new(pending,StringComparer.Ordinal);
    }

    internal static IEnumerable<string> Sources(int app)
    {
        foreach(var folder in new[]{"GSE Saves","Goldberg SteamEmu Saves"})
            yield return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),folder,app.ToString(),"achievements.json");
        foreach(var folder in new[]{"CODEX","RUNE"})
            yield return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonDocuments),"Steam",folder,app.ToString(),"achievements.ini");
    }

    public static Dictionary<string,long> Read(string path)
    {
        var earned=new Dictionary<string,long>(StringComparer.Ordinal);
        if(!File.Exists(path)) return earned;
        using var stream=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete);
        if(stream.Length>8*1024*1024) throw new InvalidDataException("Registro de conquistas muito grande.");
        if(Path.GetExtension(path).Equals(".ini",StringComparison.OrdinalIgnoreCase))
        {
            using var reader=new StreamReader(stream);
            string section="";
            while(reader.ReadLine() is string raw)
            {
                string line=raw.Trim();
                if(line.StartsWith('[') && line.EndsWith(']')) { section=line[1..^1]; continue; }
                int split=line.IndexOf('=');
                if(split<1 || section.Length==0)continue;
                string field=line[..split].Trim(),value=line[(split+1)..].Trim();
                if(section.Equals("Achievements",StringComparison.OrdinalIgnoreCase))
                {
                    if(value=="1") earned[field]=0;
                }
                else if(field.Equals("Achieved",StringComparison.OrdinalIgnoreCase) && value=="1")
                    earned.TryAdd(section,0);
                else if(field.Equals("UnlockTime",StringComparison.OrdinalIgnoreCase) && earned.ContainsKey(section) && long.TryParse(value,out long seconds))
                    earned[section]=seconds;
            }
            return earned;
        }
        using var json=JsonDocument.Parse(stream);
        foreach(var row in json.RootElement.EnumerateObject())
            if(row.Value.TryGetProperty("earned",out var flag) && flag.ValueKind==JsonValueKind.True)
                earned[row.Name]=row.Value.TryGetProperty("earned_time",out var time) && time.TryGetInt64(out long stamp) ? stamp : 0;
        return earned;
    }
}
