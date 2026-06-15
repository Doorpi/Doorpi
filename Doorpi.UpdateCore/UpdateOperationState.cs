using System.Text.Json.Serialization;

namespace Doorpi.UpdateCore;

public sealed class UpdateOperationState
{
    [JsonPropertyName("operationId")]
    public string OperationId { get; set; } = Guid.NewGuid().ToString("N");

    [JsonPropertyName("component")]
    public string Component { get; set; } = "";

    [JsonPropertyName("targetVersion")]
    public string TargetVersion { get; set; } = "";

    [JsonPropertyName("phase")]
    public string Phase { get; set; } = "idle";

    [JsonPropertyName("installFolder")]
    public string InstallFolder { get; set; } = "";

    [JsonPropertyName("packagePath")]
    public string PackagePath { get; set; } = "";

    [JsonPropertyName("stagingFolder")]
    public string StagingFolder { get; set; } = "";

    [JsonPropertyName("backupFolder")]
    public string BackupFolder { get; set; } = "";

    [JsonPropertyName("healthSignalPath")]
    public string HealthSignalPath { get; set; } = "";

    [JsonPropertyName("error")]
    public string Error { get; set; } = "";

    [JsonPropertyName("startedAt")]
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;

    [JsonPropertyName("updatedAt")]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
