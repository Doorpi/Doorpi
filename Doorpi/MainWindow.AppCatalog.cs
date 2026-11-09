using System.IO;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Doorpi.Storage;

namespace Doorpi;

public partial class MainWindow
{
    private readonly ConditionalWeakTable<AppCacheModel, GameStateRevision> _appCacheRevisions = new();

    private AppCacheModel LoadVersionedAppCache(string path, string owner)
    {
        var snapshot = StateStorage.ReadAppCacheSnapshot(path);
        // Invalid data must surface as an error; rebuilding a missing cache is
        // different from silently replacing corrupt state with an empty object.
        var cache = JsonSerializer.Deserialize<AppCacheModel>(snapshot.MetadataJson)
            ?? throw new InvalidDataException("Cache de aplicativos inválido.");
        List<T> Items<T>(string collection) => snapshot.Collections.TryGetValue(collection, out var rows)
            ? rows.Select(row => JsonSerializer.Deserialize<T>(row) ?? throw new InvalidDataException("Entrada inválida no catálogo local.")).ToList()
            : new List<T>();
        HashSet<string> Fingerprint(string collection) => new(Items<string>(collection), StringComparer.OrdinalIgnoreCase);
        cache.WindowsApps = Items<InstalledApp>("WindowsApps");
        cache.FolderApps = Items<InstalledApp>("FolderApps");
        cache.SteamApps = Items<InstalledApp>("SteamApps");
        cache.EpicApps = Items<InstalledApp>("EpicApps");
        cache.GogApps = Items<InstalledApp>("GogApps");
        cache.RiotApps = Items<InstalledApp>("RiotApps");
        cache.XboxApps = Items<InstalledApp>("XboxApps");
        cache.WindowsFingerprint = Fingerprint("WindowsFingerprint");
        cache.SteamFingerprint = Fingerprint("SteamFingerprint");
        cache.EpicFingerprint = Fingerprint("EpicFingerprint");
        cache.GogFingerprint = Fingerprint("GogFingerprint");
        cache.RiotFingerprint = Fingerprint("RiotFingerprint");
        cache.XboxFingerprint = Fingerprint("XboxFingerprint");
        cache.AutoAddSuppressions = Items<AutoAddSuppression>("AutoAddSuppressions");
        _appCacheRevisions.Add(cache, new GameStateRevision(path, owner, snapshot.Revision));
        return cache;
    }

    private void SaveVersionedAppCache(AppCacheModel cache)
    {
        if (!_appCacheRevisions.TryGetValue(cache, out var captured))
            throw new InvalidOperationException("O catálogo deve ser carregado com sua revisão antes de salvar.");
        if (!string.Equals(captured.Owner, currentUserId, StringComparison.OrdinalIgnoreCase))
            throw new OperationCanceledException("O perfil mudou durante a atualização do catálogo.");
        long expectedRevision = captured.Revision;
        string content = JsonSerializer.Serialize(cache);
        long committedRevision = 0;
        StateStorage.ExecuteTransaction(() =>
        {
            StateStorage.WriteBatchIfRevision(new Dictionary<string, string?> { [captured.Path] = content },
                new Dictionary<string, long> { [captured.Path] = expectedRevision });
            committedRevision = StateStorage.GetRevision(captured.Path);
        });
        captured.Revision = committedRevision;
    }
}
