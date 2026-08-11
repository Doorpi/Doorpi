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

        try
        {
            using var stream = File.OpenRead(_path);
            return JsonSerializer.Deserialize<UpdateManifestState>(stream, JsonOptions);
        }
        catch (JsonException)
        {
            QuarantineCorruptState();
            return null;
        }
        catch (IOException)
        {
            return null;
        }
        catch (UnauthorizedAccessException)
        {
            return null;
        }
    }

    public void Save(UpdateManifestState state)
    {
        ArgumentNullException.ThrowIfNull(state);

        state.UpdatedAt = DateTimeOffset.UtcNow;
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        string tempPath = _path + ".tmp";
        File.WriteAllText(tempPath, JsonSerializer.Serialize(state, JsonOptions));
        File.Move(tempPath, _path, overwrite: true);
    }

    private void QuarantineCorruptState()
    {
        try
        {
            string folder = Path.GetDirectoryName(_path) ?? "";
            string name = Path.GetFileName(_path);
            string stamp = DateTimeOffset.UtcNow.ToString("yyyyMMddHHmmss");
            string targetPath = Path.Combine(folder, $"{name}.corrupt-{stamp}");
            File.Move(_path, targetPath, overwrite: true);
        }
        catch
        {
            // Best effort only. A corrupt update state must not block future update checks.
        }
    }
}
