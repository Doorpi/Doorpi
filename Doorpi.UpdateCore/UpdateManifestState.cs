using System.Text.Json.Serialization;

namespace Doorpi.UpdateCore;

public sealed class UpdateManifestState
{
    [JsonPropertyName("channel")]
    public string Channel { get; set; } = "beta";

    [JsonPropertyName("highestManifestVersion")]
    public long HighestManifestVersion { get; set; }

    [JsonPropertyName("updatedAt")]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
