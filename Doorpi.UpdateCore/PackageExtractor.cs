using System.IO.Compression;
using System.Text.Json;

namespace Doorpi.UpdateCore;

public static class PackageExtractor
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static PackageManifest ExtractAndValidate(
        string zipPath,
        string stagingFolder,
        string expectedComponent,
        string expectedVersion)
    {
        if (!File.Exists(zipPath))
            throw new FileNotFoundException("Pacote de update nao encontrado.", zipPath);

        ResetDirectory(stagingFolder);
        ZipFile.ExtractToDirectory(zipPath, stagingFolder, overwriteFiles: true);

        string manifestPath = Path.Combine(stagingFolder, "package-manifest.json");
        if (!File.Exists(manifestPath))
            throw new InvalidDataException("Pacote sem package-manifest.json.");

        var manifest = JsonSerializer.Deserialize<PackageManifest>(File.ReadAllText(manifestPath), JsonOptions)
            ?? throw new InvalidDataException("package-manifest.json invalido.");

        if (!string.Equals(manifest.Component, expectedComponent, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException($"Componente invalido no pacote. Esperado {expectedComponent}, recebido {manifest.Component}.");

        if (!string.Equals(manifest.Version, expectedVersion, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException($"Versao invalida no pacote. Esperada {expectedVersion}, recebida {manifest.Version}.");

        if (!string.IsNullOrWhiteSpace(manifest.EntryPoint)
            && !File.Exists(Path.Combine(stagingFolder, manifest.EntryPoint)))
            throw new InvalidDataException($"Entrada do pacote nao encontrada: {manifest.EntryPoint}.");

        return manifest;
    }

    private static void ResetDirectory(string path)
    {
        if (Directory.Exists(path))
            Directory.Delete(path, recursive: true);
        Directory.CreateDirectory(path);
    }
}
