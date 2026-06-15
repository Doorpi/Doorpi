using System.Text.Json;

namespace Doorpi.UpdateCore;

public sealed class UpdateStateStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    private readonly string _path;

    public UpdateStateStore(string path)
    {
        _path = path;
    }

    public UpdateOperationState? Load()
    {
        if (!File.Exists(_path)) return null;
        using var stream = File.OpenRead(_path);
        return JsonSerializer.Deserialize<UpdateOperationState>(stream, JsonOptions);
    }

    public void Save(UpdateOperationState state)
    {
        ArgumentNullException.ThrowIfNull(state);

        state.UpdatedAt = DateTimeOffset.UtcNow;
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        string tempPath = _path + ".tmp";
        File.WriteAllText(tempPath, JsonSerializer.Serialize(state, JsonOptions));
        File.Move(tempPath, _path, overwrite: true);
    }

    public void Clear()
    {
        if (File.Exists(_path))
            File.Delete(_path);
    }
}
