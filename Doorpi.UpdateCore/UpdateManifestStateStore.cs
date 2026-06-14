using System.Text.Json;

namespace Doorpi.UpdateCore;

public sealed class UpdateManifestStateStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    private readonly string _path;

    public UpdateManifestStateStore(string path)
    {
        _path = path;
    }

    public UpdateManifestState? Load()
    {
        if (!File.Exists(_path)) return null;
        using var stream = File.OpenRead(_path);
        return JsonSerializer.Deserialize<UpdateManifestState>(stream, JsonOptions);
    }

    public void Save(UpdateManifestState state)
    {
        state.UpdatedAt = DateTimeOffset.UtcNow;
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        string tempPath = _path + ".tmp";
        File.WriteAllText(tempPath, JsonSerializer.Serialize(state, JsonOptions));
        File.Move(tempPath, _path, overwrite: true);
    }
}
