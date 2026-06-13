using System.Text.Json.Serialization;

namespace Doorpi.UpdateCore;

public sealed class UpdateManifest
{
    [JsonPropertyName("schemaVersion")]
    public int SchemaVersion { get; set; } = 1;

    [JsonPropertyName("channel")]
    public string Channel { get; set; } = "beta";

    [JsonPropertyName("publishedAt")]
    public DateTimeOffset PublishedAt { get; set; } = DateTimeOffset.UtcNow;

    [JsonPropertyName("minimumSupportedManifestVersion")]
    public int MinimumSupportedManifestVersion { get; set; } = 1;

    [JsonPropertyName("doorpi")]
    public ComponentRelease Doorpi { get; set; } = new();

    [JsonPropertyName("updater")]
    public ComponentRelease Updater { get; set; } = new();

    [JsonPropertyName("changelog")]
    public List<ChangelogEntry> Changelog { get; set; } = new();
}

public sealed class ComponentRelease
{
    [JsonPropertyName("version")]
    public string Version { get; set; } = "";

    [JsonPropertyName("downloadUrl")]
    public string DownloadUrl { get; set; } = "";

    [JsonPropertyName("sha256")]
    public string Sha256 { get; set; } = "";

    [JsonPropertyName("sizeBytes")]
    public long? SizeBytes { get; set; }

    [JsonPropertyName("minUpdaterVersion")]
    public string MinUpdaterVersion { get; set; } = "";

    [JsonPropertyName("forceUpdate")]
    public bool ForceUpdate { get; set; }
}

public sealed class ChangelogEntry
{
    [JsonPropertyName("version")]
    public string Version { get; set; } = "";

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("items")]
    public List<string> Items { get; set; } = new();
}
