using System.Text.Json;

namespace Doorpi.UpdateCore;

public sealed class UpdateStateStore
{
    private static readonly HashSet<string> KnownPhases = new(StringComparer.OrdinalIgnoreCase)
    {
        "idle", "downloading", "extracting", "storage-migrating", "storage-migrated", "applying",
        "doorpi-applied-pending-health-check", "doorpi-health-check-failed", "rollback", "rollback-failed",
        "rolled-back", "succeeded"
    };
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
        if (!File.Exists(_path) && !File.Exists(_path + ".bak")) return null;
        Exception? primaryFailure = null;
        foreach (string candidate in new[] { _path, _path + ".bak" })
        {
            if (!File.Exists(candidate)) continue;
            try
            {
                using var stream = File.OpenRead(candidate);
                var state = JsonSerializer.Deserialize<UpdateOperationState>(stream, JsonOptions)
                    ?? throw new InvalidDataException("Estado de atualização vazio ou inválido.");
                if (string.IsNullOrWhiteSpace(state.OperationId) ||
                    state.OperationId.Any(character => !char.IsAsciiLetterOrDigit(character) && character is not '-' and not '_') ||
                    (state.Component is not "doorpi" and not "updater") ||
                    string.IsNullOrWhiteSpace(state.Phase) || !KnownPhases.Contains(state.Phase) ||
                    string.IsNullOrWhiteSpace(state.InstallFolder) ||
                    !Path.IsPathFullyQualified(state.InstallFolder) ||
                    !UpdateVersionComparer.IsValidVersion(state.TargetVersion))
                    throw new InvalidDataException("O estado da atualização não contém uma identidade e destino válidos.");
                return state;
            }
            catch (Exception exception) when (exception is JsonException or IOException)
            {
                primaryFailure ??= exception;
            }
        }
        throw new InvalidDataException("Não foi possível recuperar o estado da atualização. Os backups foram preservados.", primaryFailure);
    }

    public void Save(UpdateOperationState state)
    {
        ArgumentNullException.ThrowIfNull(state);

        state.UpdatedAt = DateTimeOffset.UtcNow;
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        string tempPath = _path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var stream = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write,
                       FileShare.None, 4096, FileOptions.WriteThrough))
            {
                JsonSerializer.Serialize(stream, state, JsonOptions);
                stream.Flush(flushToDisk: true);
            }
            if (File.Exists(_path))
                File.Replace(tempPath, _path, _path + ".bak", ignoreMetadataErrors: true);
            else
                File.Move(tempPath, _path);
        }
        finally
        {
            if (File.Exists(tempPath)) File.Delete(tempPath);
        }
    }

    public void Clear()
    {
        // Remove the previous phase first. A crash during cleanup must not
        // resurrect a pending migration from .bak after the commit was removed.
        if (File.Exists(_path + ".bak"))
            File.Delete(_path + ".bak");
        if (File.Exists(_path))
            File.Delete(_path);
    }
}
