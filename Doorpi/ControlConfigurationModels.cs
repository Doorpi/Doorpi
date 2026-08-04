using System.Text.Json.Serialization;

namespace Doorpi;

public sealed class ControlConfigurationDocument
{
    public int SchemaVersion { get; set; } = 7;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public List<ControlProfile> Profiles { get; set; } = new();
    public List<ControlProfileAssignment> Assignments { get; set; } = new();
}

public sealed class ControlProfile
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string OwnerUserId { get; set; } = "";
    public string Category { get; set; } = "web"; // web | executable | store | global
    public string BaseProfileId { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    // Campos mantidos para migrar o formato v1, no qual o perfil era acoplado
    // diretamente ao alvo. Novos perfis usam Assignments.
    public string TargetKind { get; set; } = "global";
    public string TargetId { get; set; } = "";
    public string TargetName { get; set; } = "";
    public bool Enabled { get; set; } = true;
    public double MouseSensitivity { get; set; } = 1;
    public double ScrollSensitivity { get; set; } = 1;
    public double MouseDeadZone { get; set; } = 0.14;
    public bool HasConfigurablePointerBindings { get; set; }
    public bool HasSecondaryActivations { get; set; }
    public List<ControlBinding> Bindings { get; set; } = new();

    [JsonIgnore]
    public string TargetKey => ControlTarget.MakeKey(TargetKind, TargetId);

    public bool IsBuiltIn { get; set; }
}

public sealed class ControlProfileAssignment
{
    public string TargetKind { get; set; } = "media";
    public string TargetId { get; set; } = "";
    public string TargetName { get; set; } = "";
    public string TargetCategory { get; set; } = "web";
    public string TargetFingerprint { get; set; } = "";
    public string NativeAppId { get; set; } = "";
    public string ExecutablePath { get; set; } = "";
    public string ProfileId { get; set; } = "";
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    [JsonIgnore]
    public string TargetKey => ControlTarget.MakeKey(TargetKind, TargetId);
}

public sealed class ControlBinding
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public bool Enabled { get; set; } = true;
    public List<string> ControllerButtons { get; set; } = new();
    public string Trigger { get; set; } = "press"; // press | release | hold | long-press
    public int LongPressDurationMs { get; set; } = 1200;
    public List<string> SecondaryControllerButtons { get; set; } = new();
    public string SecondaryTrigger { get; set; } = "press";
    public int SecondaryLongPressDurationMs { get; set; } = 1200;
    public ControlAction Action { get; set; } = new();
}

public sealed class ControlAction
{
    public string Type { get; set; } = "keyboard"; // keyboard | mouse | wheel | pointer | system
    public List<ushort> VirtualKeys { get; set; } = new();
    public string MouseButton { get; set; } = "left";
    public int WheelDelta { get; set; } = 120;
    public string PointerDirection { get; set; } = "free"; // free | up | down | left | right
    public int PointerDistance { get; set; } = 24;
    public string SystemCommand { get; set; } = "";
}

public sealed class ControlTarget
{
    public string Kind { get; set; } = "global";
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Category { get; set; } = "web";
    public string Fingerprint { get; set; } = "";
    public string NativeAppId { get; set; } = "";
    public string ExecutablePath { get; set; } = "";
    public string Artwork { get; set; } = "";
    public string IconBase64 { get; set; } = "";
    public bool IsNative { get; set; }
    public bool IsYouTubeTv { get; set; }
    public bool MouseKeyboardEnabled { get; set; } = true;
    public bool CanChangeMouseKeyboardMode { get; set; }

    public static string MakeKey(string? kind, string? id)
    {
        string normalizedKind = string.IsNullOrWhiteSpace(kind)
            ? "global"
            : kind.Trim().ToLowerInvariant();
        string normalizedId = normalizedKind == "global"
            ? ""
            : (id ?? "").Trim();
        return normalizedKind + ":" + normalizedId;
    }
}
