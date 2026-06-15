using System.Text.Json.Serialization;

namespace Doorpi.UpdateCore;

public sealed class UpdateManifest
{
    [JsonPropertyName("schemaVersion")]
    public int SchemaVersion { get; set; } = 1;

    [JsonPropertyName("channel")]
    public string Channel { get; set; } = "beta";

    [JsonPropertyName("manifestVersion")]
    public long ManifestVersion { get; set; } = 1;

    [JsonPropertyName("publishedAt")]
    public DateTimeOffset PublishedAt { get; set; } = DateTimeOffset.UtcNow;

    [JsonPropertyName("expiresAt")]
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddDays(14);

    [JsonPropertyName("minimumSupportedManifestVersion")]
    public int MinimumSupportedManifestVersion { get; set; } = 1;

    [JsonPropertyName("doorpi")]
    public ComponentRelease Doorpi { get; set; } = new();

    [JsonPropertyName("updater")]
    public ComponentRelease Updater { get; set; } = new();

    [JsonPropertyName("changelog")]
    public List<ChangelogEntry> Changelog { get; set; } = new();

    [JsonPropertyName("signature")]
    public ManifestSignature? Signature { get; set; }
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

    [JsonPropertyName("allowRollback")]
    public bool AllowRollback { get; set; }
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

public sealed class ManifestSignature
{
    [JsonPropertyName("algorithm")]
    public string Algorithm { get; set; } = "RSA-SHA256-PKCS1";

    [JsonPropertyName("keyId")]
    public string KeyId { get; set; } = "";

    [JsonPropertyName("value")]
    public string Value { get; set; } = "";
}
