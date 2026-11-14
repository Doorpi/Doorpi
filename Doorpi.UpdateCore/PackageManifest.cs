using System.Text.Json.Serialization;

namespace Doorpi.UpdateCore;

public sealed class PackageManifest
{
    [JsonPropertyName("component")]
    public string Component { get; set; } = "";

    [JsonPropertyName("version")]
    public string Version { get; set; } = "";

    [JsonPropertyName("architecture")]
    public string Architecture { get; set; } = "win-x64";

    [JsonPropertyName("entryPoint")]
    public string EntryPoint { get; set; } = "";

    [JsonPropertyName("minUpdaterVersion")]
    public string MinUpdaterVersion { get; set; } = "";

    [JsonPropertyName("storageSchemaVersion")]
    public int StorageSchemaVersion { get; set; }

    [JsonPropertyName("createdAt")]
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
