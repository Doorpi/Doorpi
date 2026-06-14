using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;

namespace Doorpi.UpdateCore;

public sealed class UpdateManifestClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    private readonly HttpClient _httpClient;

    public UpdateManifestClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<UpdateManifest> GetManifestAsync(Uri manifestUri, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync(manifestUri, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        var manifest = await JsonSerializer.DeserializeAsync<UpdateManifest>(stream, JsonOptions, cancellationToken)
            .ConfigureAwait(false);

        return manifest ?? throw new InvalidDataException("Manifesto de update vazio ou invalido.");
    }

    public static UpdateManifest LoadFromFile(string path)
    {
        using var stream = File.OpenRead(path);
        return JsonSerializer.Deserialize<UpdateManifest>(stream, JsonOptions)
            ?? throw new InvalidDataException("Manifesto de update vazio ou invalido.");
    }

    public static void SaveToFile(UpdateManifest manifest, string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, JsonSerializer.Serialize(manifest, JsonOptions));
    }
}
