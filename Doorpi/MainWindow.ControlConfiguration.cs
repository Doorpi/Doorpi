using System.Diagnostics;
using System.IO;
using System.Text.Json;
using Doorpi.ProfileSync;

namespace Doorpi;

public partial class MainWindow
{
    private static readonly JsonSerializerOptions ControlJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    private static readonly HashSet<string> ValidControlButtons = new(StringComparer.OrdinalIgnoreCase)
    {
        "a", "b", "x", "y", "lb", "rb", "lt", "rt", "back", "start",
        "guide", "l3", "r3", "dpad-up", "dpad-down", "dpad-left", "dpad-right",
        "left-stick", "right-stick", "left-stick-up", "left-stick-down",
        "left-stick-left", "left-stick-right", "right-stick-up", "right-stick-down",
        "right-stick-left", "right-stick-right"
    };

    private readonly object _controlConfigurationLock = new();
    private readonly object _controlRuntimeLock = new();
    private readonly Dictionary<BindingRuntimeKey, BindingRuntimeState> _controlBindingRuntime = new();
    private ControlConfigurationDocument? _controlConfigurationCache;
    private string _controlConfigurationCachePath = "";
    private ControlProfile[] _controlRuntimeProfiles = Array.Empty<ControlProfile>();
    private ControlProfileAssignment[] _controlRuntimeAssignments = Array.Empty<ControlProfileAssignment>();
    private ControlProfile[]? _controlRuntimeRoutesSource;
    private ControlBindingRoute[] _controlRuntimeRoutes = Array.Empty<ControlBindingRoute>();
    private string _controlRuntimeRoutesKey = "";
    private string _lastRuntimeControlTargetKey = "";
    private bool _configuredCloseHoldOverlayVisible;
    private long _configuredCloseHoldOverlayLastUpdateMs;
    private string _controlTargetResolutionIdentity = "";
    private string _controlTargetResolutionKey = "";
    private string _controlTargetResolutionCategory = "";
    private readonly object _controlCaptureLock = new();
    private ControlCaptureSession? _controlCaptureSession;
    private bool _controlCaptureSuppressUntilNeutral;

    private sealed class BindingRuntimeState
    {
        public bool Active;
        public bool Suppressed;
        public bool OutputHeld;
        public bool LongPressFired;
        public long PressedAt;
        public long LastContinuousTimestamp;
        public double RemainderX;
        public double RemainderY;
        public double WheelRemainder;
    }

    private readonly record struct BindingRuntimeKey(
        string UserId,
        string ProfileId,
        string BindingId,
        string RouteId,
        int Slot);

    private readonly record struct ControlBindingRoute(
        ControlProfile Profile,
        ControlBinding Binding,
        string RouteId,
        IReadOnlyList<string> ControllerButtons,
        string Trigger,
        int LongPressDurationMs);

    private volatile bool _controlEditorOpen;

    private sealed class ControlCaptureSession
    {
        public string Id { get; init; } = "";
        public int Slot { get; set; } = -1;
        public List<string> Buttons { get; set; } = new();
        public long HoldStartedAt { get; set; }
        public long LastPostedAt { get; set; }
        public bool AwaitingNeutral { get; set; } = true;
    }

    private string ControlConfigurationPath =>
        string.IsNullOrWhiteSpace(currentUserDataFolder)
            ? ""
            : Path.Combine(currentUserDataFolder, "controls.json");

    private static ControlProfile CreateDefaultGlobalControlProfile()
        => new()
        {
            Id = "global-default",
            Name = "Atalhos globais",
            Category = "global",
            TargetKind = "global",
            TargetId = "",
            TargetName = "Global",
            HasSecondaryActivations = true,
            Bindings = new List<ControlBinding>
            {
                new()
                {
                    Id = "global-task-switcher-guide",
                    Name = "Alternar janelas",
                    ControllerButtons = new List<string> { "guide", "back" },
                    Trigger = "press",
                    SecondaryControllerButtons = new List<string> { "lb", "rb", "back" },
                    SecondaryTrigger = "press",
                    Action = new ControlAction { Type = "system", SystemCommand = "task-switcher" }
                },
                new()
                {
                    Id = "global-return-guide",
                    Name = "Minimizar e voltar ao Doorpi",
                    ControllerButtons = new List<string> { "guide" },
                    Trigger = "release",
                    SecondaryControllerButtons = new List<string> { "lb", "rb", "r3" },
                    SecondaryTrigger = "press",
                    Action = new ControlAction { Type = "system", SystemCommand = "doorpi-return" }
                }
            }
        };

    private static IReadOnlyList<ControlProfile> CreateBuiltInControlProfiles()
        => new[]
        {
            CreateBuiltInControlProfile("builtin-web", "web", "Controles essenciais para web apps"),
            CreateYouTubeTvControlProfile(),
            CreateBuiltInControlProfile("builtin-executable", "executable", "Controles essenciais para aplicativos"),
            CreateBuiltInControlProfile("builtin-store", "store", "Controles essenciais para lojas")
        };

    private static ControlProfile CreateYouTubeTvControlProfile()
    {
        static ControlBinding Key(
            string id,
            string name,
            string button,
            ushort virtualKey,
            string trigger = "press",
            string? secondary = null)
            => new()
            {
                Id = "builtin-youtube-" + id,
                Name = name,
                ControllerButtons = new List<string> { button },
                Trigger = trigger,
                SecondaryControllerButtons = string.IsNullOrWhiteSpace(secondary)
                    ? new List<string>()
                    : new List<string> { secondary },
                SecondaryTrigger = trigger,
                Action = new ControlAction
                {
                    Type = "keyboard",
                    VirtualKeys = new List<ushort> { virtualKey }
                }
            };

        return new ControlProfile
        {
            Id = "builtin-youtube",
            Name = "YouTube TV · controle remoto",
            Category = "web",
            BaseProfileId = "builtin-youtube",
            TargetKind = "media",
            Enabled = true,
            HasConfigurablePointerBindings = true,
            HasSecondaryActivations = true,
            IsBuiltIn = true,
            CreatedAtUtc = DateTimeOffset.UnixEpoch,
            UpdatedAtUtc = DateTimeOffset.UnixEpoch,
            Bindings = new List<ControlBinding>
            {
                Key("up", "Navegar para cima", "dpad-up", 0x26, "hold", "left-stick-up"),
                Key("down", "Navegar para baixo", "dpad-down", 0x28, "hold", "left-stick-down"),
                Key("left", "Navegar para esquerda", "dpad-left", 0x25, "hold", "left-stick-left"),
                Key("right", "Navegar para direita", "dpad-right", 0x27, "hold", "left-stick-right"),
                Key("select", "Selecionar", "a", 0x0D),
                Key("back", "Voltar", "b", 0x1B),
                new()
                {
                    Id = "builtin-youtube-play-pause",
                    Name = "Reproduzir ou pausar",
                    ControllerButtons = new List<string> { "x" },
                    Trigger = "press",
                    Action = new ControlAction { Type = "system", SystemCommand = "youtube-play-pause" }
                },
                Key("rewind", "Retroceder", "lt", 0x71, "hold"),
                Key("fast-forward", "Avançar", "rt", 0x72, "hold"),
                Key("previous", "Vídeo anterior", "lb", 0x73),
                Key("next", "Próximo vídeo", "rb", 0x74),
                new()
                {
                    Id = "builtin-youtube-close",
                    Name = "Fechar YouTube TV",
                    ControllerButtons = new List<string> { "b" },
                    Trigger = "long-press",
                    LongPressDurationMs = 1450,
                    Action = new ControlAction { Type = "system", SystemCommand = "close-web-app" }
                }
            }
        };
    }

    private static ControlProfile CreateBuiltInControlProfile(string id, string category, string name)
    {
        var bindings = new List<ControlBinding>
        {
            new()
            {
                Id = id + "-pointer",
                Name = "Mover ponteiro",
                ControllerButtons = new List<string> { "left-stick" },
                Trigger = "hold",
                Action = new ControlAction
                {
                    Type = "pointer",
                    PointerDirection = "free",
                    PointerDistance = 24
                }
            },
            new()
            {
                Id = id + "-scroll",
                Name = "Rolagem",
                ControllerButtons = new List<string> { "right-stick" },
                Trigger = "hold",
                Action = new ControlAction { Type = "wheel", WheelDelta = 120 }
            },
            new()
            {
                Id = id + "-mouse-left",
                Name = "Clique principal",
                ControllerButtons = new List<string> { "a" },
                Trigger = "hold",
                SecondaryControllerButtons = new List<string> { "rt" },
                SecondaryTrigger = "hold",
                Action = new ControlAction { Type = "mouse", MouseButton = "left" }
            },
            new()
            {
                Id = id + "-mouse-right",
                Name = "Clique secundário",
                ControllerButtons = new List<string> { "x" },
                Trigger = "hold",
                Action = new ControlAction { Type = "mouse", MouseButton = "right" }
            },
            new()
            {
                Id = id + "-mouse-back",
                Name = "Voltar",
                ControllerButtons = new List<string> { "b" },
                Trigger = "press",
                Action = new ControlAction { Type = "mouse", MouseButton = "x1" }
            }
        };
        if (category == "web")
        {
            bindings.AddRange(new[]
            {
                new ControlBinding
                {
                    Id = id + "-mouse-side-back",
                    Name = "Voltar (botão lateral)",
                    ControllerButtons = new List<string> { "lb" },
                    Trigger = "press",
                    Action = new ControlAction { Type = "mouse", MouseButton = "x1" }
                },
                new ControlBinding
                {
                    Id = id + "-mouse-side-forward",
                    Name = "Avançar (botão lateral)",
                    ControllerButtons = new List<string> { "rb" },
                    Trigger = "press",
                    Action = new ControlAction { Type = "mouse", MouseButton = "x2" }
                },
                new ControlBinding
                {
                    Id = id + "-fullscreen",
                    Name = "Tela cheia",
                    ControllerButtons = new List<string> { "y" },
                    Trigger = "press",
                    Action = new ControlAction { Type = "keyboard", VirtualKeys = new List<ushort> { 0x46 } }
                },
                new ControlBinding
                {
                    Id = id + "-mute",
                    Name = "Silenciar volume",
                    ControllerButtons = new List<string> { "r3" },
                    Trigger = "press",
                    Action = new ControlAction { Type = "keyboard", VirtualKeys = new List<ushort> { 0xAD } }
                }
            });
            bindings.Add(new ControlBinding
            {
                Id = id + "-close-web-app",
                Name = "Fechar web app",
                ControllerButtons = new List<string> { "b" },
                Trigger = "long-press",
                Action = new ControlAction { Type = "system", SystemCommand = "close-web-app" }
            });
        }
        return new ControlProfile
        {
            Id = id,
            Name = name,
            Category = category,
            BaseProfileId = id,
            TargetKind = category == "store" ? "store" : "media",
            Enabled = true,
            MouseSensitivity = 1,
            ScrollSensitivity = 1,
            MouseDeadZone = 0.14,
            HasConfigurablePointerBindings = true,
            HasSecondaryActivations = true,
            IsBuiltIn = true,
            CreatedAtUtc = DateTimeOffset.UnixEpoch,
            UpdatedAtUtc = DateTimeOffset.UnixEpoch,
            Bindings = bindings
        };
    }

    private static ControlConfigurationDocument CreateDefaultControlConfiguration()
        => new()
        {
            Profiles = new List<ControlProfile> { CreateDefaultGlobalControlProfile() }
        };

    private static void AddDefaultPointerBindings(ControlProfile profile)
    {
        profile.Bindings ??= new List<ControlBinding>();
        if (!profile.Bindings.Any(binding =>
                string.Equals(binding.Action?.Type, "pointer", StringComparison.OrdinalIgnoreCase)))
        {
            profile.Bindings.Insert(0, new ControlBinding
            {
                Id = profile.Id + "-pointer",
                Name = "Mover ponteiro",
                ControllerButtons = new List<string> { "left-stick" },
                Trigger = "hold",
                Action = new ControlAction
                {
                    Type = "pointer",
                    PointerDirection = "free",
                    PointerDistance = 24
                }
            });
        }
        if (!profile.Bindings.Any(binding =>
                string.Equals(binding.Action?.Type, "wheel", StringComparison.OrdinalIgnoreCase) &&
                binding.ControllerButtons.Any(button => button is "left-stick" or "right-stick")))
        {
            profile.Bindings.Insert(Math.Min(1, profile.Bindings.Count), new ControlBinding
            {
                Id = profile.Id + "-scroll",
                Name = "Rolagem",
                ControllerButtons = new List<string> { "right-stick" },
                Trigger = "hold",
                Action = new ControlAction { Type = "wheel", WheelDelta = 120 }
            });
        }
    }

    private void ResetControlConfigurationForActiveUser()
    {
        _controlEditorOpen = false;
        ReleaseConfiguredControlOutputs();
        XInputButtonTracker.ConfigureSystemShortcutCompatibility(false, false, false, false);
        lock (_controlConfigurationLock)
        {
            _controlConfigurationCache = null;
            _controlConfigurationCachePath = "";
            Volatile.Write(ref _controlRuntimeProfiles, Array.Empty<ControlProfile>());
            Volatile.Write(ref _controlRuntimeAssignments, Array.Empty<ControlProfileAssignment>());
        }
        lock (_controlCaptureLock)
        {
            _controlCaptureSession = null;
            _controlCaptureSuppressUntilNeutral = false;
        }
        _lastRuntimeControlTargetKey = "";
        _controlTargetResolutionIdentity = "";
        _controlTargetResolutionKey = "";
        _controlTargetResolutionCategory = "";
    }

    private ControlConfigurationDocument LoadControlConfiguration()
    {
        lock (_controlConfigurationLock)
        {
            string path = ControlConfigurationPath;
            if (_controlConfigurationCache != null &&
                string.Equals(_controlConfigurationCachePath, path, StringComparison.OrdinalIgnoreCase))
            {
                return _controlConfigurationCache;
            }

            ControlConfigurationDocument document = CreateDefaultControlConfiguration();
            if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
            {
                try
                {
                    document = JsonSerializer.Deserialize<ControlConfigurationDocument>(
                                   File.ReadAllText(path),
                                   ControlJsonOptions)
                               ?? CreateDefaultControlConfiguration();
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[Controls] Falha ao carregar configuração: " + ex.Message);
                }
            }

            int loadedSchemaVersion = document.SchemaVersion;
            bool requiresMigration = loadedSchemaVersion < 7;
            document.Profiles ??= new List<ControlProfile>();
            document.Assignments ??= new List<ControlProfileAssignment>();
            if (!document.Profiles.Any(profile =>
                    string.Equals(profile.TargetKind, "global", StringComparison.OrdinalIgnoreCase)))
            {
                document.Profiles.Insert(0, CreateDefaultGlobalControlProfile());
            }

            foreach (ControlProfile profile in document.Profiles.ToList())
            {
                NormalizeControlProfile(profile);
                if (loadedSchemaVersion < 7 &&
                    string.Equals(profile.BaseProfileId, "builtin-youtube", StringComparison.OrdinalIgnoreCase))
                {
                    ControlBinding? playPause = profile.Bindings.FirstOrDefault(binding =>
                        string.Equals(binding.Id, "builtin-youtube-play-pause", StringComparison.OrdinalIgnoreCase));
                    if (playPause != null)
                    {
                        playPause.Action = new ControlAction
                        {
                            Type = "system",
                            SystemCommand = "youtube-play-pause"
                        };
                        NormalizeControlProfile(profile);
                        requiresMigration = true;
                    }
                }
                if (!profile.HasSecondaryActivations)
                {
                    MigrateSecondaryControlActivations(profile);
                    profile.HasSecondaryActivations = true;
                    NormalizeControlProfile(profile);
                    requiresMigration = true;
                }
                if (string.Equals(profile.TargetKind, "global", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(profile.Category, "global", StringComparison.OrdinalIgnoreCase))
                {
                    profile.Category = "global";
                    profile.OwnerUserId = "";
                    requiresMigration = true;
                }
                if (!string.Equals(profile.TargetKind, "global", StringComparison.OrdinalIgnoreCase) &&
                    !profile.IsBuiltIn &&
                    string.IsNullOrWhiteSpace(profile.OwnerUserId))
                {
                    profile.OwnerUserId = currentUserId;
                    requiresMigration = true;
                }
                if (!string.Equals(profile.TargetKind, "global", StringComparison.OrdinalIgnoreCase) &&
                    !string.IsNullOrWhiteSpace(profile.TargetId))
                {
                    profile.Category = ResolveLegacyControlProfileCategory(profile);
                    RemoveCopiedGlobalBindings(profile);
                    if (IsLegacyEmptyGeneratedProfile(profile))
                    {
                        document.Profiles.Remove(profile);
                        document.Assignments.RemoveAll(assignment =>
                            string.Equals(assignment.ProfileId, profile.Id, StringComparison.OrdinalIgnoreCase));
                        requiresMigration = true;
                        continue;
                    }
                    if (string.IsNullOrWhiteSpace(profile.BaseProfileId))
                    {
                        profile.BaseProfileId = GetBuiltInProfileId(profile.Category);
                        requiresMigration = true;
                    }
                    if (!document.Assignments.Any(assignment =>
                            string.Equals(assignment.TargetKey, profile.TargetKey, StringComparison.OrdinalIgnoreCase)))
                    {
                        ControlTarget target = ResolveControlTarget(profile.TargetKind, profile.TargetId, profile.TargetName);
                        document.Assignments.Add(CreateControlAssignment(target, profile.Id));
                        requiresMigration = true;
                    }
                    profile.TargetKind = profile.Category == "store" ? "store" : "media";
                    profile.TargetId = "";
                    profile.TargetName = "";
                    requiresMigration = true;
                }
                else if (!string.Equals(profile.TargetKind, "global", StringComparison.OrdinalIgnoreCase))
                {
                    RemoveCopiedGlobalBindings(profile);
                    if (IsGeneratedEmptyReusableProfile(profile))
                    {
                        document.Profiles.Remove(profile);
                        document.Assignments.RemoveAll(assignment =>
                            string.Equals(assignment.ProfileId, profile.Id, StringComparison.OrdinalIgnoreCase));
                        requiresMigration = true;
                    }
                }
                if (document.Profiles.Contains(profile) &&
                    !string.Equals(profile.TargetKind, "global", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(profile.Category, "global", StringComparison.OrdinalIgnoreCase) &&
                    !profile.HasConfigurablePointerBindings)
                {
                    AddDefaultPointerBindings(profile);
                    profile.HasConfigurablePointerBindings = true;
                    NormalizeControlProfile(profile);
                    requiresMigration = true;
                }
            }

            foreach (ControlProfileAssignment assignment in document.Assignments)
            {
                NormalizeControlAssignment(assignment);
                if (loadedSchemaVersion < 6 &&
                    string.Equals(assignment.ProfileId, "builtin-web", StringComparison.OrdinalIgnoreCase) &&
                    (string.Equals(assignment.TargetId, "youtube", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(assignment.NativeAppId, "youtube", StringComparison.OrdinalIgnoreCase)))
                {
                    assignment.ProfileId = "builtin-youtube";
                    assignment.UpdatedAtUtc = DateTimeOffset.UtcNow;
                    requiresMigration = true;
                }
            }

            document.SchemaVersion = 7;

            _controlConfigurationCachePath = path;
            _controlConfigurationCache = document;
            Volatile.Write(
                ref _controlRuntimeProfiles,
                GetRuntimeControlProfiles(document));
            Volatile.Write(
                ref _controlRuntimeAssignments,
                document.Assignments.Select(CloneControlAssignment).ToArray());
            UpdateSystemShortcutCompatibility(document);
            if (requiresMigration && !string.IsNullOrWhiteSpace(path))
                SaveControlConfiguration(document, scheduleSync: false);
            return document;
        }
    }

    private void SaveControlConfiguration(
        ControlConfigurationDocument document,
        bool scheduleSync = true)
    {
        string path = ControlConfigurationPath;
        if (string.IsNullOrWhiteSpace(path))
            return;

        lock (_controlConfigurationLock)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            document.SchemaVersion = 7;
            document.UpdatedAtUtc = DateTimeOffset.UtcNow;
            string json = JsonSerializer.Serialize(document, ControlJsonOptions);
            string temporaryPath = path + ".tmp";
            File.WriteAllText(temporaryPath, json);
            File.Move(temporaryPath, path, overwrite: true);
            _controlConfigurationCachePath = path;
            _controlConfigurationCache = document;
            Volatile.Write(
                ref _controlRuntimeProfiles,
                GetRuntimeControlProfiles(document));
            Volatile.Write(
                ref _controlRuntimeAssignments,
                document.Assignments.Select(CloneControlAssignment).ToArray());
            UpdateSystemShortcutCompatibility(document);
        }
        if (scheduleSync)
            ScheduleProfileSync();
    }

    private static void NormalizeControlProfile(ControlProfile profile)
    {
        profile.TargetKind = NormalizeControlTargetKind(profile.TargetKind);
        profile.TargetId = profile.TargetKind == "global" ? "" : (profile.TargetId ?? "").Trim();
        profile.TargetName = string.IsNullOrWhiteSpace(profile.TargetName)
            ? (profile.TargetKind == "global" ? "Global" : profile.TargetId)
            : profile.TargetName.Trim();
        profile.Id = string.IsNullOrWhiteSpace(profile.Id)
            ? "controls-" + Guid.NewGuid().ToString("N")
            : profile.Id.Trim();
        profile.Name = string.IsNullOrWhiteSpace(profile.Name)
            ? (profile.TargetKind == "global" ? "Atalhos globais" : profile.TargetName)
            : profile.Name.Trim();
        profile.Category = NormalizeControlCategory(profile.Category, profile.TargetKind);
        profile.BaseProfileId = (profile.BaseProfileId ?? "").Trim();
        if (profile.CreatedAtUtc == default) profile.CreatedAtUtc = DateTimeOffset.UtcNow;
        if (profile.UpdatedAtUtc == default) profile.UpdatedAtUtc = profile.CreatedAtUtc;
        profile.MouseSensitivity = Math.Clamp(profile.MouseSensitivity, 0.25, 3.0);
        profile.ScrollSensitivity = Math.Clamp(profile.ScrollSensitivity, 0.25, 3.0);
        profile.MouseDeadZone = Math.Clamp(profile.MouseDeadZone, 0.05, 0.5);
        profile.Bindings ??= new List<ControlBinding>();

        foreach (ControlBinding binding in profile.Bindings)
        {
            binding.Id = string.IsNullOrWhiteSpace(binding.Id)
                ? "binding-" + Guid.NewGuid().ToString("N")
                : binding.Id.Trim();
            binding.Name = (binding.Name ?? "").Trim();
            binding.ControllerButtons = (binding.ControllerButtons ?? new List<string>())
                .Select(button => (button ?? "").Trim().ToLowerInvariant())
                .Where(ValidControlButtons.Contains)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(8)
                .ToList();
            binding.SecondaryControllerButtons = (binding.SecondaryControllerButtons ?? new List<string>())
                .Select(button => (button ?? "").Trim().ToLowerInvariant())
                .Where(ValidControlButtons.Contains)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(8)
                .ToList();
            binding.Trigger = NormalizeControlTrigger(binding.Trigger);
            binding.SecondaryTrigger = NormalizeControlTrigger(binding.SecondaryTrigger);
            int primaryLongPressLimit = binding.ControllerButtons.Contains("guide", StringComparer.OrdinalIgnoreCase)
                ? 3000
                : 5000;
            int secondaryLongPressLimit = binding.SecondaryControllerButtons.Contains("guide", StringComparer.OrdinalIgnoreCase)
                ? 3000
                : 5000;
            binding.LongPressDurationMs = Math.Clamp(binding.LongPressDurationMs, 500, primaryLongPressLimit);
            binding.SecondaryLongPressDurationMs = Math.Clamp(
                binding.SecondaryLongPressDurationMs,
                500,
                secondaryLongPressLimit);
            binding.Action ??= new ControlAction();
            NormalizeControlAction(binding.Action);
        }
    }

    private static string NormalizeControlTrigger(string? trigger)
        => trigger?.Trim().ToLowerInvariant() switch
        {
            "release" => "release",
            "hold" => "hold",
            "long-press" => "long-press",
            _ => "press"
        };

    private static void UpdateSystemShortcutCompatibility(ControlConfigurationDocument document)
    {
        ControlProfile? global = document.Profiles.FirstOrDefault(profile =>
            profile.Enabled && IsGlobalControlProfile(profile));

        bool HasRoute(string command, string trigger, params string[] expectedButtons)
        {
            if (global == null) return false;
            foreach (ControlBinding binding in global.Bindings.Where(binding =>
                         binding.Enabled &&
                         string.Equals(binding.Action?.Type, "system", StringComparison.OrdinalIgnoreCase) &&
                         string.Equals(binding.Action?.SystemCommand, command, StringComparison.OrdinalIgnoreCase)))
            {
                static bool SameChord(IReadOnlyCollection<string> actual, IReadOnlyCollection<string> expected)
                    => actual.Count == expected.Count &&
                       expected.All(button => actual.Contains(button, StringComparer.OrdinalIgnoreCase));

                if (string.Equals(binding.Trigger, trigger, StringComparison.OrdinalIgnoreCase) &&
                    SameChord(binding.ControllerButtons, expectedButtons))
                    return true;
                if (string.Equals(binding.SecondaryTrigger, trigger, StringComparison.OrdinalIgnoreCase) &&
                    SameChord(binding.SecondaryControllerButtons, expectedButtons))
                    return true;
            }
            return false;
        }

        XInputButtonTracker.ConfigureSystemShortcutCompatibility(
            HasRoute("doorpi-return", "release", "guide"),
            HasRoute("doorpi-return", "press", "lb", "rb", "r3"),
            HasRoute("task-switcher", "press", "guide", "back"),
            HasRoute("task-switcher", "press", "lb", "rb", "back"));
    }

    private static void MigrateSecondaryControlActivations(ControlProfile profile)
    {
        static void MergeKnownAlternative(
            ControlProfile source,
            string primaryId,
            string alternativeId)
        {
            ControlBinding? primary = source.Bindings.FirstOrDefault(binding =>
                string.Equals(binding.Id, primaryId, StringComparison.OrdinalIgnoreCase));
            ControlBinding? alternative = source.Bindings.FirstOrDefault(binding =>
                string.Equals(binding.Id, alternativeId, StringComparison.OrdinalIgnoreCase));
            if (primary == null || alternative == null)
                return;

            if (primary.SecondaryControllerButtons.Count == 0)
            {
                primary.SecondaryControllerButtons = alternative.ControllerButtons.ToList();
                primary.SecondaryTrigger = alternative.Trigger;
                primary.SecondaryLongPressDurationMs = alternative.LongPressDurationMs;
            }
            source.Bindings.Remove(alternative);
        }

        if (IsGlobalControlProfile(profile))
        {
            MergeKnownAlternative(
                profile,
                "global-task-switcher-guide",
                "global-task-switcher-shoulders");
            MergeKnownAlternative(
                profile,
                "global-return-guide",
                "global-return-alternative");
        }

        foreach (ControlBinding binding in profile.Bindings)
        {
            bool isDefaultPrimaryClick =
                string.Equals(binding.Action.Type, "mouse", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(binding.Action.MouseButton, "left", StringComparison.OrdinalIgnoreCase) &&
                binding.ControllerButtons.Count == 1 &&
                string.Equals(binding.ControllerButtons[0], "a", StringComparison.OrdinalIgnoreCase);
            if (!isDefaultPrimaryClick || binding.SecondaryControllerButtons.Count > 0)
                continue;

            binding.SecondaryControllerButtons = new List<string> { "rt" };
            binding.SecondaryTrigger = binding.Trigger;
            binding.SecondaryLongPressDurationMs = binding.LongPressDurationMs;
        }
    }

    private static string NormalizeControlCategory(string? category, string? targetKind = null)
        => category?.Trim().ToLowerInvariant() switch
        {
            "executable" => "executable",
            "store" => "store",
            "global" => "global",
            "web" => "web",
            _ => string.Equals(targetKind, "store", StringComparison.OrdinalIgnoreCase) ? "store" : "web"
        };

    private static bool IsGlobalControlProfile(ControlProfile profile)
        => string.Equals(profile.Id, "global-default", StringComparison.OrdinalIgnoreCase) ||
           string.Equals(profile.Category, "global", StringComparison.OrdinalIgnoreCase) ||
           string.Equals(profile.TargetKind, "global", StringComparison.OrdinalIgnoreCase) ||
           (profile.Bindings.Count > 0 && profile.Bindings.All(binding =>
               string.Equals(binding.Action.Type, "system", StringComparison.OrdinalIgnoreCase) &&
               (string.Equals(binding.Action.SystemCommand, "task-switcher", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(binding.Action.SystemCommand, "doorpi-return", StringComparison.OrdinalIgnoreCase))));

    private static void NormalizeControlAssignment(ControlProfileAssignment assignment)
    {
        assignment.TargetKind = NormalizeControlTargetKind(assignment.TargetKind);
        assignment.TargetId = (assignment.TargetId ?? "").Trim();
        assignment.TargetName = (assignment.TargetName ?? "").Trim();
        assignment.TargetCategory = NormalizeControlCategory(assignment.TargetCategory, assignment.TargetKind);
        assignment.TargetFingerprint = (assignment.TargetFingerprint ?? "").Trim();
        assignment.NativeAppId = (assignment.NativeAppId ?? "").Trim();
        assignment.ExecutablePath = NormalizeExecutablePath(assignment.ExecutablePath);
        assignment.ProfileId = (assignment.ProfileId ?? "").Trim();
        if (assignment.UpdatedAtUtc == default) assignment.UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    private static void NormalizeControlAction(ControlAction action)
    {
        action.Type = action.Type?.Trim().ToLowerInvariant() switch
        {
            "mouse" => "mouse",
            "wheel" => "wheel",
            "pointer" => "pointer",
            "system" => "system",
            _ => "keyboard"
        };
        action.VirtualKeys = (action.VirtualKeys ?? new List<ushort>())
            .Where(key => key is > 0 and < 256)
            .Distinct()
            .Take(6)
            .ToList();
        action.MouseButton = action.MouseButton?.Trim().ToLowerInvariant() switch
        {
            "right" => "right",
            "middle" => "middle",
            "x1" => "x1",
            "x2" => "x2",
            _ => "left"
        };
        action.WheelDelta = Math.Clamp(action.WheelDelta == 0 ? 120 : action.WheelDelta, -1200, 1200);
        action.PointerDirection = action.PointerDirection?.Trim().ToLowerInvariant() switch
        {
            "up" => "up",
            "down" => "down",
            "left" => "left",
            "right" => "right",
            _ => "free"
        };
        action.PointerDistance = Math.Clamp(action.PointerDistance == 0 ? 24 : action.PointerDistance, 4, 128);
        action.SystemCommand = action.SystemCommand?.Trim().ToLowerInvariant() switch
        {
            "task-switcher" => "task-switcher",
            "doorpi-return" => "doorpi-return",
            "close-web-app" => "close-web-app",
            "youtube-play-pause" => "youtube-play-pause",
            _ => ""
        };
    }

    private static string NormalizeControlTargetKind(string? kind)
        => kind?.Trim().ToLowerInvariant() switch
        {
            "game" => "game",
            "media" => "media",
            "store" => "store",
            _ => "global"
        };

    private async Task<bool> TryHandleControlConfigurationWebMessageAsync(
        string action,
        JsonElement root)
    {
        if (action == "requestControlCatalog")
        {
            SendControlCatalogToUi();
            return true;
        }

        if (action == "controlEditorOpened")
        {
            _controlEditorOpen = true;
            return true;
        }

        if (action == "controlEditorClosed")
        {
            _controlEditorOpen = false;
            return true;
        }

        if (action == "requestGlobalControlEditor")
        {
            SendGlobalControlEditorToUi();
            return true;
        }

        if (action == "setControlTargetMouseKeyboard")
        {
            ControlTarget target = DeserializeControlTarget(root);
            bool enabled = !root.TryGetProperty("enabled", out JsonElement enabledElement) ||
                           enabledElement.ValueKind != JsonValueKind.False;
            SetControlTargetMouseKeyboardMode(target, enabled);
            SendControlEditorToUi(ResolveControlTarget(target.Kind, target.Id, target.Name));
            return true;
        }

        if (action is "requestControlEditor" or "requestControlProfile")
        {
            ControlTarget target = ResolveControlTarget(
                GetString(root, "targetKind", "media"),
                GetString(root, "targetId"),
                GetString(root, "targetName"));
            SendControlEditorToUi(target);
            return true;
        }

        if (action == "assignControlProfile")
        {
            ControlTarget target = DeserializeControlTarget(root);
            if (string.IsNullOrWhiteSpace(target.Id)) return true;
            if (!target.MouseKeyboardEnabled)
            {
                SendControlEditorToUi(target);
                return true;
            }
            string profileId = GetString(root, "profileId");
            AssignControlProfile(target, profileId);
            SendControlEditorToUi(target);
            return true;
        }

        if (action == "saveControlProfile")
        {
            if (!root.TryGetProperty("profile", out JsonElement profileElement))
                return true;

            ControlProfile? incoming = profileElement.Deserialize<ControlProfile>(ControlJsonOptions);
            if (incoming == null)
                return true;

            ControlTarget target = DeserializeControlTarget(root);
            bool isGlobal = string.Equals(incoming.Category, "global", StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(incoming.TargetKind, "global", StringComparison.OrdinalIgnoreCase);
            bool hasTarget = !string.IsNullOrWhiteSpace(target.Id);
            if (hasTarget && !isGlobal && !target.MouseKeyboardEnabled)
            {
                SendControlEditorToUi(target);
                return true;
            }
            if (isGlobal)
            {
                incoming.Id = "global-default";
                incoming.Name = "Atalhos globais";
                incoming.Category = "global";
                incoming.TargetKind = "global";
                incoming.TargetId = "";
                incoming.TargetName = "Global";
            }
            incoming.IsBuiltIn = false;
            incoming.OwnerUserId = isGlobal ? "" : currentUserId;
            incoming.Id = !isGlobal && incoming.Id.StartsWith("builtin-", StringComparison.OrdinalIgnoreCase)
                ? "controls-" + Guid.NewGuid().ToString("N")
                : incoming.Id;
            if (string.IsNullOrWhiteSpace(incoming.Category))
                incoming.Category = target.Category;
            if (!isGlobal)
                incoming.TargetKind = incoming.Category == "store" ? "store" : "media";
            incoming.TargetId = "";
            if (!isGlobal) incoming.TargetName = "";
            incoming.UpdatedAtUtc = DateTimeOffset.UtcNow;
            if (incoming.CreatedAtUtc == default) incoming.CreatedAtUtc = incoming.UpdatedAtUtc;
            NormalizeControlProfile(incoming);
            ReleaseConfiguredControlOutputs();
            lock (_controlConfigurationLock)
            {
                ControlConfigurationDocument document = LoadControlConfiguration();
                int index = document.Profiles.FindIndex(candidate =>
                    string.Equals(candidate.Id, incoming.Id, StringComparison.OrdinalIgnoreCase));
                if (index >= 0)
                    document.Profiles[index] = incoming;
                else
                    document.Profiles.Add(incoming);
                if (hasTarget && !isGlobal)
                    UpsertControlAssignment(document, target, incoming.Id);
                SaveControlConfiguration(document);
            }
            PostControlMessage(new
            {
                type = "controlProfileSaved",
                profile = CloneControlProfile(incoming),
                target,
                assignedProfileId = incoming.Id
            });
            return true;
        }

        if (action == "resetControlProfile")
        {
            ControlTarget target = DeserializeControlTarget(root);
            if (string.IsNullOrWhiteSpace(target.Id)) return true;
            if (!target.MouseKeyboardEnabled)
            {
                SendControlEditorToUi(target);
                return true;
            }
            ReleaseConfiguredControlOutputs();
            lock (_controlConfigurationLock)
            {
                ControlConfigurationDocument document = LoadControlConfiguration();
                UpsertControlAssignment(document, target, GetBuiltInProfileId(target));
                SaveControlConfiguration(document);
            }
            SendControlEditorToUi(target);
            return true;
        }

        if (action == "resetGlobalControlProfile")
        {
            ReleaseConfiguredControlOutputs();
            lock (_controlConfigurationLock)
            {
                ControlConfigurationDocument document = LoadControlConfiguration();
                document.Profiles.RemoveAll(profile =>
                    string.Equals(profile.TargetKind, "global", StringComparison.OrdinalIgnoreCase));
                document.Profiles.Insert(0, CreateDefaultGlobalControlProfile());
                SaveControlConfiguration(document);
            }
            SendGlobalControlEditorToUi();
            return true;
        }

        if (action == "startControlCapture")
        {
            StartControlCapture(GetString(root, "captureId"));
            return true;
        }

        if (action == "cancelControlCapture")
        {
            CancelControlCapture(GetString(root, "captureId"));
            return true;
        }

        await Task.CompletedTask;
        return false;
    }

    private static string GetString(JsonElement root, string name, string fallback = "")
        => root.TryGetProperty(name, out JsonElement value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? fallback
            : fallback;

    private void SendControlCatalogToUi()
    {
        List<ControlTarget> targets = GetControlTargets();
        ControlConfigurationDocument document = LoadControlConfiguration();
        List<UserProfile> users = LoadUserProfiles();

        PostControlMessage(new
        {
            type = "controlCatalog",
            targets,
            profiles = GetMachineControlProfilesSnapshot(users),
            profileOwners = users.Select(user => new
            {
                id = user.Id,
                name = user.Name,
                photoBase64 = user.PhotoBase64
            }).ToList(),
            assignments = document.Assignments.Select(CloneControlAssignment).ToList()
        });
    }

    private void SendGlobalControlEditorToUi()
    {
        ControlConfigurationDocument document = LoadControlConfiguration();
        ControlProfile profile = document.Profiles.First(candidate =>
            string.Equals(candidate.TargetKind, "global", StringComparison.OrdinalIgnoreCase));
        PostControlMessage(new
        {
            type = "globalControlEditor",
            profile = CloneControlProfile(profile)
        });
    }

    private List<ControlTarget> GetControlTargets()
    {
        var targets = new List<ControlTarget>();
        try
        {
            List<GameModel> games = LoadGames();
            targets.AddRange(LoadMediaApps()
                .Where(app => !IsMediaAppAlsoRegisteredAsGame(app, games))
                .Select(CreateControlTarget)
                .Where(target => !string.IsNullOrWhiteSpace(target.Id)));
        }
        catch { }

        try
        {
            targets.AddRange(LoadStoreLaunchers()
                .Select(store => new ControlTarget
                {
                    Kind = "store",
                    Id = store.Id,
                    Name = store.Name,
                    Category = "store",
                    Artwork = FirstControlArtwork(store),
                    IconBase64 = store.IconBase64 ?? "",
                    Fingerprint = "store:" + store.Id.Trim().ToLowerInvariant(),
                    MouseKeyboardEnabled = !store.DisableGamepadControl,
                    CanChangeMouseKeyboardMode = true
                })
                .Where(target => !string.IsNullOrWhiteSpace(target.Id)));
        }
        catch { }

        return targets
            .GroupBy(target => ControlTarget.MakeKey(target.Kind, target.Id), StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(target => target.Category == "web" ? 0 : target.Category == "executable" ? 1 : 2)
            .ThenBy(target => target.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    private static bool IsMediaAppAlsoRegisteredAsGame(
        MediaAppModel app,
        IReadOnlyCollection<GameModel> games)
    {
        string appId = (app.Id ?? "").Trim();
        string appUrl = (app.Url ?? "").Trim();
        string appPath = NormalizeExecutablePath(appUrl);
        return games.Any(game =>
            (!string.IsNullOrWhiteSpace(appId) &&
             (string.Equals(game.LaunchUrl, appId, StringComparison.OrdinalIgnoreCase) ||
              string.Equals(game.Path, appId, StringComparison.OrdinalIgnoreCase))) ||
            (!string.IsNullOrWhiteSpace(appUrl) &&
             (string.Equals(game.LaunchUrl, appUrl, StringComparison.OrdinalIgnoreCase) ||
              string.Equals(game.LaunchCommand, appUrl, StringComparison.OrdinalIgnoreCase))) ||
            (!string.IsNullOrWhiteSpace(appPath) &&
             string.Equals(NormalizeExecutablePath(game.Path), appPath, StringComparison.OrdinalIgnoreCase)));
    }

    private ControlTarget CreateControlTarget(MediaAppModel app)
    {
        string id = !string.IsNullOrWhiteSpace(app.Id) ? app.Id : app.Url;
        bool executable = string.Equals(app.Type, "exe", StringComparison.OrdinalIgnoreCase);
        bool isYouTubeTv = IsDoorpiYouTubeTvApp(app, app.Url);
        bool native = !executable && _nativeApps.Any(candidate =>
            string.Equals(candidate.Id, app.Id, StringComparison.OrdinalIgnoreCase));
        string executablePath = executable ? NormalizeExecutablePath(app.Url) : "";
        return new ControlTarget
        {
            Kind = "media",
            Id = id,
            Name = string.IsNullOrWhiteSpace(app.Name) ? id : app.Name,
            Category = executable ? "executable" : "web",
            IsNative = native,
            NativeAppId = native ? app.Id : "",
            ExecutablePath = executablePath,
            Artwork = FirstControlArtwork(app),
            IconBase64 = app.IconBase64 ?? "",
            IsYouTubeTv = isYouTubeTv,
            MouseKeyboardEnabled = !executable || !app.DisableGamepadControl,
            CanChangeMouseKeyboardMode = executable && !app.IsSharedFromOtherUser,
            Fingerprint = native
                ? "native-web:" + app.Id.Trim().ToLowerInvariant()
                : executable && !string.IsNullOrWhiteSpace(executablePath)
                    ? "executable:" + executablePath.ToLowerInvariant()
                    : "web-local:" + id.Trim().ToLowerInvariant()
        };
    }

    private static string FirstControlArtwork(MediaAppModel app)
        => new[]
        {
            app.GridHorizontalStaticImage,
            app.GridHorizontalImage,
            app.GridStaticImage,
            app.GridImage,
            app.LogoStaticImage,
            app.LogoImage
        }.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "";

    private ControlTarget ResolveControlTarget(string? kind, string? id, string? name = null)
    {
        string normalizedKind = NormalizeControlTargetKind(kind);
        string normalizedId = (id ?? "").Trim();
        ControlTarget? match = GetControlTargets().FirstOrDefault(target =>
            string.Equals(target.Kind, normalizedKind, StringComparison.OrdinalIgnoreCase) &&
            (string.Equals(target.Id, normalizedId, StringComparison.OrdinalIgnoreCase) ||
             string.Equals(target.ExecutablePath, NormalizeExecutablePath(normalizedId), StringComparison.OrdinalIgnoreCase)));
        if (match != null) return match;

        string category = normalizedKind == "store" ? "store" : "web";
        bool isYouTubeTv = normalizedKind == "media" &&
            (normalizedId.Equals("youtube", StringComparison.OrdinalIgnoreCase) ||
             normalizedId.Contains("youtube.com/tv", StringComparison.OrdinalIgnoreCase));
        return new ControlTarget
        {
            Kind = normalizedKind,
            Id = normalizedId,
            Name = string.IsNullOrWhiteSpace(name) ? normalizedId : name.Trim(),
            Category = category,
            IsYouTubeTv = isYouTubeTv,
            MouseKeyboardEnabled = true,
            CanChangeMouseKeyboardMode = false,
            Fingerprint = category + "-local:" + normalizedId.ToLowerInvariant()
        };
    }

    private bool SetControlTargetMouseKeyboardMode(ControlTarget target, bool enabled)
    {
        if (!target.CanChangeMouseKeyboardMode)
            return false;

        if (string.Equals(target.Category, "store", StringComparison.OrdinalIgnoreCase))
        {
            SaveStoreGamepadControlSetting(target.Id, disabled: !enabled);
            return true;
        }

        if (!string.Equals(target.Category, "executable", StringComparison.OrdinalIgnoreCase))
            return false;

        List<MediaAppModel> apps = LoadMediaAppsForUser(currentUserId);
        MediaAppModel? app = apps.FirstOrDefault(candidate =>
            string.Equals(candidate.Id, target.Id, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(candidate.Url, target.Id, StringComparison.OrdinalIgnoreCase) ||
            (!string.IsNullOrWhiteSpace(target.ExecutablePath) &&
             string.Equals(
                 NormalizeExecutablePath(candidate.Url),
                 NormalizeExecutablePath(target.ExecutablePath),
                 StringComparison.OrdinalIgnoreCase)));
        if (app == null || !string.Equals(app.Type, "exe", StringComparison.OrdinalIgnoreCase))
            return false;

        app.DisableGamepadControl = !enabled;
        app.DisableGamepadControlConfigured = true;
        SaveMediaApps(apps);
        SendMediaAppsToUI(LoadMediaApps());
        return true;
    }

    private ControlTarget DeserializeControlTarget(JsonElement root)
    {
        if (root.TryGetProperty("target", out JsonElement element))
        {
            ControlTarget? incoming = element.Deserialize<ControlTarget>(ControlJsonOptions);
            if (incoming != null)
            {
                ControlTarget resolved = ResolveControlTarget(incoming.Kind, incoming.Id, incoming.Name);
                if (!string.IsNullOrWhiteSpace(incoming.Category)) resolved.Category = NormalizeControlCategory(incoming.Category, resolved.Kind);
                if (!string.IsNullOrWhiteSpace(incoming.Fingerprint)) resolved.Fingerprint = incoming.Fingerprint.Trim();
                if (!string.IsNullOrWhiteSpace(incoming.NativeAppId)) resolved.NativeAppId = incoming.NativeAppId.Trim();
                if (!string.IsNullOrWhiteSpace(incoming.ExecutablePath)) resolved.ExecutablePath = NormalizeExecutablePath(incoming.ExecutablePath);
                if (!string.IsNullOrWhiteSpace(incoming.Artwork)) resolved.Artwork = incoming.Artwork.Trim();
                if (!string.IsNullOrWhiteSpace(incoming.IconBase64)) resolved.IconBase64 = incoming.IconBase64.Trim();
                resolved.IsNative |= incoming.IsNative;
                return resolved;
            }
        }
        return ResolveControlTarget(
            GetString(root, "targetKind", "media"),
            GetString(root, "targetId"),
            GetString(root, "targetName"));
    }

    private void SendControlEditorToUi(ControlTarget target)
    {
        ControlConfigurationDocument document = LoadControlConfiguration();
        ControlProfileAssignment? assignment = document.Assignments.FirstOrDefault(candidate =>
            string.Equals(candidate.TargetKey, ControlTarget.MakeKey(target.Kind, target.Id), StringComparison.OrdinalIgnoreCase));
        string profileId = assignment?.ProfileId ?? GetBuiltInProfileId(target);
        ControlProfile profile = GetRuntimeControlProfiles(document).FirstOrDefault(candidate =>
            string.Equals(candidate.Id, profileId, StringComparison.OrdinalIgnoreCase))
            ?? CreateBuiltInControlProfiles().First(candidate =>
                string.Equals(candidate.Id, GetBuiltInProfileId(target), StringComparison.OrdinalIgnoreCase));
        PostControlMessage(new
        {
            type = "controlEditor",
            target,
            profile = CloneControlProfile(profile),
            assignedProfileId = profile.Id
        });
    }

    private void AssignControlProfile(ControlTarget target, string profileId)
    {
        ControlProfile? reusableProfile = GetMachineControlProfilesSnapshot()
            .FirstOrDefault(profile =>
                string.Equals(profile.Id, profileId, StringComparison.OrdinalIgnoreCase) &&
                !profile.IsBuiltIn);
        ReleaseConfiguredControlOutputs();
        lock (_controlConfigurationLock)
        {
            ControlConfigurationDocument document = LoadControlConfiguration();
            if (reusableProfile != null && !document.Profiles.Any(profile =>
                    string.Equals(profile.Id, reusableProfile.Id, StringComparison.OrdinalIgnoreCase)))
            {
                ControlProfile localCopy = CloneControlProfile(reusableProfile);
                localCopy.OwnerUserId = currentUserId;
                localCopy.CreatedAtUtc = DateTimeOffset.UtcNow;
                localCopy.UpdatedAtUtc = localCopy.CreatedAtUtc;
                NormalizeControlProfile(localCopy);
                document.Profiles.Add(localCopy);
            }
            bool exists = GetRuntimeControlProfiles(document).Any(profile =>
                string.Equals(profile.Id, profileId, StringComparison.OrdinalIgnoreCase) &&
                (!profile.IsBuiltIn || profile.Category == target.Category));
            UpsertControlAssignment(
                document,
                target,
                exists ? profileId : GetBuiltInProfileId(target));
            SaveControlConfiguration(document);
        }
    }

    private static void UpsertControlAssignment(
        ControlConfigurationDocument document,
        ControlTarget target,
        string profileId)
    {
        string targetKey = ControlTarget.MakeKey(target.Kind, target.Id);
        ControlProfileAssignment? assignment = document.Assignments.FirstOrDefault(candidate =>
            string.Equals(candidate.TargetKey, targetKey, StringComparison.OrdinalIgnoreCase));
        if (assignment == null)
        {
            assignment = CreateControlAssignment(target, profileId);
            document.Assignments.Add(assignment);
        }
        else
        {
            assignment.TargetName = target.Name;
            assignment.TargetCategory = target.Category;
            assignment.TargetFingerprint = target.Fingerprint;
            assignment.NativeAppId = target.NativeAppId;
            assignment.ExecutablePath = NormalizeExecutablePath(target.ExecutablePath);
            assignment.ProfileId = profileId;
            assignment.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }
        NormalizeControlAssignment(assignment);
    }

    private static ControlProfileAssignment CreateControlAssignment(ControlTarget target, string profileId)
        => new()
        {
            TargetKind = target.Kind,
            TargetId = target.Id,
            TargetName = target.Name,
            TargetCategory = target.Category,
            TargetFingerprint = target.Fingerprint,
            NativeAppId = target.NativeAppId,
            ExecutablePath = NormalizeExecutablePath(target.ExecutablePath),
            ProfileId = profileId,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };

    private static string GetBuiltInProfileId(string? category)
        => NormalizeControlCategory(category) switch
        {
            "executable" => "builtin-executable",
            "store" => "builtin-store",
            _ => "builtin-web"
        };

    private static string GetBuiltInProfileId(ControlTarget target)
        => target.IsYouTubeTv ? "builtin-youtube" : GetBuiltInProfileId(target.Category);

    private static void RemoveCopiedGlobalBindings(ControlProfile profile)
    {
        var globalIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "global-task-switcher-guide",
            "global-task-switcher-shoulders",
            "global-return-guide",
            "global-return-alternative"
        };
        profile.Bindings.RemoveAll(binding =>
            globalIds.Contains(binding.Id) &&
            string.Equals(binding.Action?.Type, "system", StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsLegacyEmptyGeneratedProfile(ControlProfile profile)
        => !string.IsNullOrWhiteSpace(profile.TargetId) &&
           Math.Abs(profile.MouseSensitivity - 1) < 0.001 &&
           Math.Abs(profile.ScrollSensitivity - 1) < 0.001 &&
           Math.Abs(profile.MouseDeadZone - 0.14) < 0.001 &&
           profile.Bindings.Count == 0;

    private static bool IsGeneratedEmptyReusableProfile(ControlProfile profile)
        => profile.BaseProfileId.StartsWith("builtin-", StringComparison.OrdinalIgnoreCase) &&
           Math.Abs(profile.MouseSensitivity - 1) < 0.001 &&
           Math.Abs(profile.ScrollSensitivity - 1) < 0.001 &&
           Math.Abs(profile.MouseDeadZone - 0.14) < 0.001 &&
           profile.Bindings.Count == 0;

    private static string NormalizeExecutablePath(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        try { return Path.GetFullPath(value.Trim()).TrimEnd(Path.DirectorySeparatorChar); }
        catch { return value.Trim(); }
    }

    private string ResolveLegacyControlProfileCategory(ControlProfile profile)
    {
        if (string.Equals(profile.TargetKind, "store", StringComparison.OrdinalIgnoreCase)) return "store";
        try
        {
            MediaAppModel? app = LoadMediaApps().FirstOrDefault(candidate =>
                string.Equals(candidate.Id, profile.TargetId, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(candidate.Url, profile.TargetId, StringComparison.OrdinalIgnoreCase));
            if (string.Equals(app?.Type, "exe", StringComparison.OrdinalIgnoreCase)) return "executable";
        }
        catch { }
        return "web";
    }

    private static ControlProfile[] GetRuntimeControlProfiles(ControlConfigurationDocument document)
        => CreateBuiltInControlProfiles()
            .Concat(document.Profiles.Where(profile => !profile.Id.StartsWith("builtin-", StringComparison.OrdinalIgnoreCase)))
            .Select(CloneControlProfile)
            .ToArray();

    private List<ControlProfile> GetControlProfilesSnapshot()
    {
        EnsureControlRuntimeProfilesLoaded();
        return Volatile.Read(ref _controlRuntimeProfiles).Select(CloneControlProfile).ToList();
    }

    private List<ControlProfile> GetMachineControlProfilesSnapshot(List<UserProfile>? users = null)
    {
        List<ControlProfile> profiles = GetControlProfilesSnapshot()
            .Where(profile => !IsGlobalControlProfile(profile))
            .ToList();
        var knownIds = new HashSet<string>(profiles.Select(profile => profile.Id), StringComparer.OrdinalIgnoreCase);
        users ??= LoadUserProfiles();

        foreach (UserProfile user in users.Where(user =>
                     !string.IsNullOrWhiteSpace(user.Id) &&
                     !string.Equals(user.Id, currentUserId, StringComparison.OrdinalIgnoreCase)))
        {
            string path = Path.Combine(dataFolder, "users", user.Id, "controls.json");
            if (!File.Exists(path)) continue;
            try
            {
                ControlConfigurationDocument? document = JsonSerializer.Deserialize<ControlConfigurationDocument>(
                    File.ReadAllText(path),
                    ControlJsonOptions);
                foreach (ControlProfile profile in document?.Profiles ?? new List<ControlProfile>())
                {
                    NormalizeControlProfile(profile);
                    if (profile.IsBuiltIn ||
                        IsGlobalControlProfile(profile) ||
                        profile.Id.StartsWith("builtin-", StringComparison.OrdinalIgnoreCase) ||
                        !knownIds.Add(profile.Id))
                    {
                        continue;
                    }
                    profile.OwnerUserId = user.Id;
                    profiles.Add(CloneControlProfile(profile));
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Controls] Falha ao carregar perfis reutilizaveis de {user.Id}: {ex.Message}");
            }
        }

        return profiles;
    }

    private static ControlProfile CloneControlProfile(ControlProfile source)
        => new()
        {
            Id = source.Id,
            Name = source.Name,
            OwnerUserId = source.OwnerUserId,
            Category = source.Category,
            BaseProfileId = source.BaseProfileId,
            CreatedAtUtc = source.CreatedAtUtc,
            UpdatedAtUtc = source.UpdatedAtUtc,
            TargetKind = source.TargetKind,
            TargetId = source.TargetId,
            TargetName = source.TargetName,
            Enabled = source.Enabled,
            MouseSensitivity = source.MouseSensitivity,
            ScrollSensitivity = source.ScrollSensitivity,
            MouseDeadZone = source.MouseDeadZone,
            HasConfigurablePointerBindings = source.HasConfigurablePointerBindings,
            HasSecondaryActivations = source.HasSecondaryActivations,
            IsBuiltIn = source.IsBuiltIn,
            Bindings = source.Bindings.Select(CloneControlBinding).ToList()
        };

    private static ControlBinding CloneControlBinding(ControlBinding binding)
        => new()
        {
            Id = binding.Id,
            Name = binding.Name,
            Enabled = binding.Enabled,
            Trigger = binding.Trigger,
            LongPressDurationMs = binding.LongPressDurationMs,
            ControllerButtons = binding.ControllerButtons.ToList(),
            SecondaryTrigger = binding.SecondaryTrigger,
            SecondaryLongPressDurationMs = binding.SecondaryLongPressDurationMs,
            SecondaryControllerButtons = binding.SecondaryControllerButtons.ToList(),
            Action = new ControlAction
            {
                Type = binding.Action.Type,
                VirtualKeys = binding.Action.VirtualKeys.ToList(),
                MouseButton = binding.Action.MouseButton,
                WheelDelta = binding.Action.WheelDelta,
                PointerDirection = binding.Action.PointerDirection,
                PointerDistance = binding.Action.PointerDistance,
                SystemCommand = binding.Action.SystemCommand
            }
        };

    private static ControlProfileAssignment CloneControlAssignment(ControlProfileAssignment source)
        => new()
        {
            TargetKind = source.TargetKind,
            TargetId = source.TargetId,
            TargetName = source.TargetName,
            TargetCategory = source.TargetCategory,
            TargetFingerprint = source.TargetFingerprint,
            NativeAppId = source.NativeAppId,
            ExecutablePath = source.ExecutablePath,
            ProfileId = source.ProfileId,
            UpdatedAtUtc = source.UpdatedAtUtc
        };

    private void PostControlMessage(object payload)
    {
        string json = JsonSerializer.Serialize(payload, ControlJsonOptions);
        _ = Dispatcher.BeginInvoke(() =>
        {
            try { webView?.CoreWebView2?.PostWebMessageAsJson(json); }
            catch (Exception ex) { Debug.WriteLine("[Controls] Falha ao enviar mensagem à UI: " + ex.Message); }
        });
    }

    private string GetActiveControlTargetKey()
    {
        try
        {
            if (_gameSessionActive &&
                !_gameIsMinimized &&
                !string.IsNullOrWhiteSpace(_activeSessionGameId) &&
                IsForegroundOwnedByCurrentGame())
            {
                _controlTargetResolutionCategory = "global";
                return ControlTarget.MakeKey("game", _activeSessionGameId);
            }

            ExecutableAppSession? executable = ActiveExecutableAppSession;
            if (executable != null &&
                !executable.DoorpiSuspended &&
                IsForegroundOwnedByActiveMediaExe())
            {
                return ResolveActiveControlTargetKey("media", executable.Url);
            }

            if (IsForegroundOwnedByActiveWebApp())
            {
                return ResolveActiveControlTargetKey("media", _currentWebAppUrl);
            }

            if (_isStoreLauncherSession &&
                !_storePausedByDoorpi &&
                !string.IsNullOrWhiteSpace(_activeStoreId) &&
                IsForegroundOwnedByActiveStore())
            {
                _controlTargetResolutionCategory = "store";
                return ControlTarget.MakeKey("store", _activeStoreId);
            }
        }
        catch { }

        return "";
    }

    private string ResolveActiveControlTargetKey(string kind, string runtimeId)
    {
        string identity = currentUserId + "|" + kind + "|" + runtimeId;
        if (string.Equals(identity, _controlTargetResolutionIdentity, StringComparison.OrdinalIgnoreCase))
            return _controlTargetResolutionKey;

        string resolvedId = runtimeId;
        string resolvedCategory = string.Equals(kind, "store", StringComparison.OrdinalIgnoreCase)
            ? "store"
            : "web";
        if (string.Equals(kind, "media", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                MediaAppModel? media = LoadMediaApps().FirstOrDefault(app =>
                    string.Equals(app.Url, runtimeId, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(app.Id, runtimeId, StringComparison.OrdinalIgnoreCase));
                resolvedId = media?.Id ?? runtimeId;
                resolvedCategory = string.Equals(media?.Type, "exe", StringComparison.OrdinalIgnoreCase)
                    ? "executable"
                    : "web";
            }
            catch { }
        }

        _controlTargetResolutionIdentity = identity;
        _controlTargetResolutionKey = ControlTarget.MakeKey(kind, resolvedId);
        _controlTargetResolutionCategory = resolvedCategory;
        return _controlTargetResolutionKey;
    }

    private ControlProfile? GetAssignedRuntimeControlProfile(string targetKey)
    {
        if (string.IsNullOrWhiteSpace(targetKey) || targetKey.StartsWith("game:", StringComparison.OrdinalIgnoreCase))
            return null;
        if (!IsMouseKeyboardRuntimeEnabled(targetKey))
            return null;

        ControlProfile[] profiles = Volatile.Read(ref _controlRuntimeProfiles);
        ControlProfileAssignment? assignment = Volatile.Read(ref _controlRuntimeAssignments).FirstOrDefault(candidate =>
            string.Equals(candidate.TargetKey, targetKey, StringComparison.OrdinalIgnoreCase));
        string defaultProfileId = (_isCurrentSiteYouTube ||
                                   targetKey.Equals("media:youtube", StringComparison.OrdinalIgnoreCase))
            ? "builtin-youtube"
            : GetBuiltInProfileId(
                targetKey.StartsWith("store:", StringComparison.OrdinalIgnoreCase)
                    ? "store"
                    : _controlTargetResolutionCategory);
        string profileId = assignment?.ProfileId ?? defaultProfileId;
        return profiles.FirstOrDefault(profile =>
            profile.Enabled && string.Equals(profile.Id, profileId, StringComparison.OrdinalIgnoreCase));
    }

    private ControlProfile? GetCustomAssignedRuntimeControlProfile(string targetKey)
    {
        if (string.IsNullOrWhiteSpace(targetKey) || targetKey.StartsWith("game:", StringComparison.OrdinalIgnoreCase))
            return null;
        if (!IsMouseKeyboardRuntimeEnabled(targetKey))
            return null;
        ControlProfileAssignment? assignment = Volatile.Read(ref _controlRuntimeAssignments).FirstOrDefault(candidate =>
            string.Equals(candidate.TargetKey, targetKey, StringComparison.OrdinalIgnoreCase) &&
            !candidate.ProfileId.StartsWith("builtin-", StringComparison.OrdinalIgnoreCase));
        if (assignment == null) return null;
        return Volatile.Read(ref _controlRuntimeProfiles).FirstOrDefault(profile =>
            profile.Enabled && string.Equals(profile.Id, assignment.ProfileId, StringComparison.OrdinalIgnoreCase));
    }

    private bool IsMouseKeyboardRuntimeEnabled(string targetKey)
    {
        if (targetKey.StartsWith("store:", StringComparison.OrdinalIgnoreCase))
            return _storeMouseModeRequested && !_storeGamepadDisabled;

        ExecutableAppSession? executable = ActiveExecutableAppSession;
        if (executable != null &&
            !executable.DoorpiSuspended &&
            string.Equals(
                ResolveActiveControlTargetKey("media", executable.Url),
                targetKey,
                StringComparison.OrdinalIgnoreCase))
        {
            return executable.MouseModeRequested;
        }

        return true;
    }

    private bool ConfiguredControlRuntimeOwnsAnalog(string targetKey)
    {
        if (string.IsNullOrWhiteSpace(targetKey) || targetKey.StartsWith("game:", StringComparison.OrdinalIgnoreCase))
            return false;
        EnsureControlRuntimeProfilesLoaded();
        ControlProfile? profile = GetAssignedRuntimeControlProfile(targetKey);
        if (profile == null)
            return false;

        bool builtIn = profile.IsBuiltIn || profile.Id.StartsWith("builtin-", StringComparison.OrdinalIgnoreCase);
        return !builtIn || profile.Bindings.Any(binding => binding.Enabled && IsContinuousAnalogBinding(binding));
    }

    private double GetActiveControlMouseSensitivity()
    {
        string targetKey = GetActiveControlTargetKey();
        if (string.IsNullOrWhiteSpace(targetKey))
            return 1;

        EnsureControlRuntimeProfilesLoaded();
        ControlProfile? profile = GetAssignedRuntimeControlProfile(targetKey);
        return profile == null ? 1 : Math.Clamp(profile.MouseSensitivity, 0.25, 3.0);
    }

    private double GetActiveControlMouseDeadZone(double fallback)
    {
        string targetKey = GetActiveControlTargetKey();
        if (string.IsNullOrWhiteSpace(targetKey))
            return fallback;

        EnsureControlRuntimeProfilesLoaded();
        ControlProfile? profile = GetAssignedRuntimeControlProfile(targetKey);
        return profile == null ? fallback : Math.Clamp(profile.MouseDeadZone, 0.05, 0.5);
    }

    private double GetActiveControlScrollSensitivity()
    {
        string targetKey = GetActiveControlTargetKey();
        if (string.IsNullOrWhiteSpace(targetKey))
            return 1;

        EnsureControlRuntimeProfilesLoaded();
        ControlProfile? profile = GetAssignedRuntimeControlProfile(targetKey);
        return profile == null ? 1 : Math.Clamp(profile.ScrollSensitivity, 0.25, 3.0);
    }

    private bool ProcessConfiguredControlBindings(XInputSnapshot snapshot)
    {
        if (ProcessControlCapture(snapshot))
            return false;
        lock (_controlRuntimeLock)
            return ProcessConfiguredControlBindingsCore(snapshot);
    }

    private void StartControlCapture(string captureId)
    {
        lock (_controlCaptureLock)
        {
            _controlCaptureSession = new ControlCaptureSession
            {
                Id = string.IsNullOrWhiteSpace(captureId)
                    ? "capture-" + Guid.NewGuid().ToString("N")
                    : captureId.Trim(),
                AwaitingNeutral = true
            };
            _controlCaptureSuppressUntilNeutral = false;
        }
        PostControlMessage(new { type = "controlCaptureStarted", captureId });
    }

    private void CancelControlCapture(string captureId)
    {
        lock (_controlCaptureLock)
        {
            if (_controlCaptureSession == null ||
                (!string.IsNullOrWhiteSpace(captureId) &&
                 !string.Equals(_controlCaptureSession.Id, captureId, StringComparison.OrdinalIgnoreCase)))
            {
                return;
            }
            _controlCaptureSession = null;
            _controlCaptureSuppressUntilNeutral = true;
        }
        PostControlMessage(new { type = "controlCaptureCanceled", captureId });
    }

    private bool IsControlCaptureActive()
    {
        lock (_controlCaptureLock)
            return _controlCaptureSession != null || _controlCaptureSuppressUntilNeutral;
    }

    private bool ProcessControlCapture(XInputSnapshot snapshot)
    {
        lock (_controlCaptureLock)
        {
            ControlCaptureSession? session = _controlCaptureSession;
            if (session == null)
            {
                if (!_controlCaptureSuppressUntilNeutral) return false;
                bool neutral = snapshot.Slots.All(slot => !slot.Connected || GetControlCaptureButtons(slot).Count == 0);
                if (neutral) _controlCaptureSuppressUntilNeutral = false;
                return true;
            }

            long now = Environment.TickCount64;
            bool anyPressed = false;
            for (int slot = 0; slot < XInputControllerHub.SlotCount; slot++)
            {
                if ((snapshot.ConnectedMask & (1 << slot)) == 0) continue;
                if (GetControlCaptureButtons(snapshot.Slots[slot]).Count > 0)
                {
                    anyPressed = true;
                    break;
                }
            }

            if (session.AwaitingNeutral)
            {
                if (!anyPressed)
                {
                    session.AwaitingNeutral = false;
                    PostControlMessage(new
                    {
                        type = "controlCaptureProgress",
                        captureId = session.Id,
                        buttons = Array.Empty<string>(),
                        progress = 0,
                        waitingForRelease = false
                    });
                }
                else if (now - session.LastPostedAt >= 160)
                {
                    session.LastPostedAt = now;
                    PostControlMessage(new
                    {
                        type = "controlCaptureProgress",
                        captureId = session.Id,
                        buttons = Array.Empty<string>(),
                        progress = 0,
                        waitingForRelease = true
                    });
                }
                return true;
            }

            if (session.Slot < 0)
            {
                for (int slot = 0; slot < XInputControllerHub.SlotCount; slot++)
                {
                    if ((snapshot.ConnectedMask & (1 << slot)) == 0) continue;
                    if (GetControlCaptureButtons(snapshot.Slots[slot]).Count > 0)
                    {
                        session.Slot = slot;
                        break;
                    }
                }
            }

            List<string> buttons = session.Slot >= 0 &&
                                   (snapshot.ConnectedMask & (1 << session.Slot)) != 0
                ? GetControlCaptureButtons(snapshot.Slots[session.Slot])
                : new List<string>();

            if (buttons.Count == 0)
            {
                session.Slot = -1;
                session.Buttons.Clear();
                session.HoldStartedAt = 0;
            }
            else if (!buttons.SequenceEqual(session.Buttons, StringComparer.OrdinalIgnoreCase))
            {
                session.Buttons = buttons;
                session.HoldStartedAt = now;
            }

            long holdDurationMs = session.Buttons.Contains("guide", StringComparer.OrdinalIgnoreCase)
                ? 900
                : 1800;
            double progress = session.HoldStartedAt == 0
                ? 0
                : Math.Clamp((now - session.HoldStartedAt) / (double)holdDurationMs, 0, 1);
            if (now - session.LastPostedAt >= 45 || progress >= 1)
            {
                session.LastPostedAt = now;
                PostControlMessage(new
                {
                    type = progress >= 1 ? "controlCaptureCompleted" : "controlCaptureProgress",
                    captureId = session.Id,
                    buttons = session.Buttons.ToArray(),
                    progress,
                    waitingForRelease = false
                });
            }

            if (progress >= 1)
            {
                _controlCaptureSession = null;
                _controlCaptureSuppressUntilNeutral = true;
            }
            return true;
        }
    }

    private static List<string> GetControlCaptureButtons(XInputSlotState state)
    {
        var buttons = new List<string>(8);
        void Add(ushort mask, string id)
        {
            if ((state.NativeButtons & mask) != 0 && buttons.Count < 8) buttons.Add(id);
        }
        Add(0x0100, "lb"); Add(0x0200, "rb");
        if (state.LeftTrigger > 128 && buttons.Count < 8) buttons.Add("lt");
        if (state.RightTrigger > 128 && buttons.Count < 8) buttons.Add("rt");
        Add(0x0020, "back"); Add(0x0400, "guide"); Add(0x0010, "start");
        Add(0x0040, "l3"); Add(0x0080, "r3");
        Add(0x0001, "dpad-up"); Add(0x0004, "dpad-left");
        Add(0x0008, "dpad-right"); Add(0x0002, "dpad-down");
        Add(0x8000, "y"); Add(0x4000, "x"); Add(0x2000, "b"); Add(0x1000, "a");
        if (Math.Sqrt(state.ThumbLX * state.ThumbLX + state.ThumbLY * state.ThumbLY) >= 0.65 && buttons.Count < 8)
            buttons.Add("left-stick");
        if (Math.Sqrt(state.ThumbRX * state.ThumbRX + state.ThumbRY * state.ThumbRY) >= 0.65 && buttons.Count < 8)
            buttons.Add("right-stick");
        return buttons;
    }

    private bool ProcessConfiguredControlBindingsCore(XInputSnapshot snapshot)
    {
        string targetKey = GetActiveControlTargetKey();
        if (!string.Equals(targetKey, _lastRuntimeControlTargetKey, StringComparison.OrdinalIgnoreCase))
        {
            ReleaseConfiguredControlOutputs();
            Debug.WriteLine($"[Controls] Runtime target: {(string.IsNullOrWhiteSpace(targetKey) ? "<none>" : targetKey)}");
            if (!string.IsNullOrWhiteSpace(targetKey) &&
                targetKey.StartsWith("media:", StringComparison.OrdinalIgnoreCase))
            {
                LogMediaControllerDiagnostic("configured-runtime-target", extra: $"target={targetKey}");
            }
            _lastRuntimeControlTargetKey = targetKey;
        }

        EnsureControlRuntimeProfilesLoaded();
        ControlProfile[] profiles = Volatile.Read(ref _controlRuntimeProfiles);
        bool virtualKeyboardOpen = _vkbIsOpen || _desktopVkb != null;
        ControlBindingRoute[] routes = GetCachedControlBindingRoutes(
            targetKey,
            virtualKeyboardOpen,
            profiles);

        bool continuousAnalogActive = false;
        double configuredCloseHoldProgress = 0;

        for (int slot = 0; slot < XInputControllerHub.SlotCount; slot++)
        {
            bool connected = (snapshot.ConnectedMask & (1 << slot)) != 0;
            XInputSlotState slotState = snapshot.Slots[slot];

            foreach (ControlBindingRoute route in routes)
            {
                ControlProfile profile = route.Profile;
                ControlBinding binding = route.Binding;
                var stateKey = new BindingRuntimeKey(
                    currentUserId,
                    profile.Id,
                    binding.Id,
                    route.RouteId,
                    slot);
                if (!_controlBindingRuntime.TryGetValue(stateKey, out BindingRuntimeState? runtime))
                {
                    runtime = new BindingRuntimeState();
                    _controlBindingRuntime[stateKey] = runtime;
                }

                long now = Environment.TickCount64;
                bool active = connected && IsControlChordActive(
                    slotState,
                    route.ControllerButtons,
                    profile.MouseDeadZone);
                bool pressed = active && !runtime.Active;
                bool released = !active && runtime.Active;

                bool continuousAnalogAction = route.ControllerButtons.Any(IsAnalogControlInput) &&
                                              binding.Action.Type is "pointer" or "wheel";
                if (continuousAnalogAction)
                {
                    if (active)
                    {
                        continuousAnalogActive = true;
                        ApplyConfiguredAnalogAction(
                            profile,
                            binding,
                            route.ControllerButtons,
                            slotState,
                            runtime,
                            Stopwatch.GetTimestamp());
                    }
                    else
                        ResetConfiguredContinuousState(runtime);
                    runtime.Active = active;
                    continue;
                }

                if (pressed)
                {
                    runtime.PressedAt = now;
                    runtime.LongPressFired = false;
                }

                if (pressed && route.Trigger == "hold")
                {
                    bool alreadyHeld = _controlBindingRuntime.Any(entry =>
                        entry.Key != stateKey &&
                        string.Equals(entry.Key.UserId, currentUserId, StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(entry.Key.ProfileId, profile.Id, StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(entry.Key.BindingId, binding.Id, StringComparison.OrdinalIgnoreCase) &&
                        entry.Value.OutputHeld);
                    if (!alreadyHeld)
                        BeginConfiguredControlAction(binding.Action);
                    runtime.OutputHeld = true;
                }
                else if (pressed && route.Trigger == "press")
                {
                    TapConfiguredControlAction(binding.Action);
                    SuppressSubsetBindings(routes, route, slot);
                }
                else if (released && route.Trigger == "release" && !runtime.Suppressed)
                {
                    TapConfiguredControlAction(binding.Action);
                }
                else if (active && route.Trigger == "long-press" &&
                         !runtime.LongPressFired &&
                         now - runtime.PressedAt >= route.LongPressDurationMs)
                {
                    runtime.LongPressFired = true;
                    TapConfiguredControlAction(binding.Action);
                }

                if (active &&
                    route.Trigger == "long-press" &&
                    !runtime.LongPressFired &&
                    binding.Action.Type == "system" &&
                    binding.Action.SystemCommand == "close-web-app")
                {
                    int indicatorDelayMs = Math.Min(220, Math.Max(0, route.LongPressDurationMs - 100));
                    double progress = Math.Clamp(
                        (now - runtime.PressedAt - indicatorDelayMs) /
                        (double)Math.Max(1, route.LongPressDurationMs - indicatorDelayMs),
                        0,
                        1);
                    configuredCloseHoldProgress = Math.Max(configuredCloseHoldProgress, progress);
                }

                if (released && runtime.OutputHeld)
                {
                    runtime.OutputHeld = false;
                    bool stillHeld = _controlBindingRuntime.Any(entry =>
                        entry.Key != stateKey &&
                        string.Equals(entry.Key.UserId, currentUserId, StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(entry.Key.ProfileId, profile.Id, StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(entry.Key.BindingId, binding.Id, StringComparison.OrdinalIgnoreCase) &&
                        entry.Value.OutputHeld);
                    if (!stillHeld)
                        EndConfiguredControlAction(binding.Action);
                }

                if (released)
                {
                    runtime.Suppressed = false;
                    runtime.LongPressFired = false;
                    runtime.PressedAt = 0;
                }
                runtime.Active = active;
            }
        }

        long overlayNow = Environment.TickCount64;
        if (configuredCloseHoldProgress > 0)
        {
            if (!_configuredCloseHoldOverlayVisible ||
                overlayNow - _configuredCloseHoldOverlayLastUpdateMs >= 24)
            {
                _configuredCloseHoldOverlayVisible = true;
                _configuredCloseHoldOverlayLastUpdateMs = overlayNow;
                UpdateWebAppCloseHoldOverlay(configuredCloseHoldProgress);
            }
        }
        else if (_configuredCloseHoldOverlayVisible)
        {
            _configuredCloseHoldOverlayVisible = false;
            _configuredCloseHoldOverlayLastUpdateMs = 0;
            HideWebAppCloseHoldOverlay();
        }

        return continuousAnalogActive;
    }

    private ControlBindingRoute[] GetCachedControlBindingRoutes(
        string targetKey,
        bool virtualKeyboardOpen,
        ControlProfile[] profiles)
    {
        string cacheKey = targetKey + (virtualKeyboardOpen ? "|vkb" : "|app");
        if (ReferenceEquals(_controlRuntimeRoutesSource, profiles) &&
            string.Equals(_controlRuntimeRoutesKey, cacheKey, StringComparison.OrdinalIgnoreCase))
        {
            return _controlRuntimeRoutes;
        }

        ControlProfile? appProfile = virtualKeyboardOpen
            ? null
            : GetAssignedRuntimeControlProfile(targetKey);
        ControlProfile? globalProfile = profiles.FirstOrDefault(profile =>
            profile.Enabled &&
            string.Equals(profile.TargetKind, "global", StringComparison.OrdinalIgnoreCase));
        bool builtInAppProfile = appProfile != null &&
            (appProfile.IsBuiltIn || appProfile.Id.StartsWith("builtin-", StringComparison.OrdinalIgnoreCase));

        var bindings = new List<(ControlProfile Profile, ControlBinding Binding)>();
        if (appProfile != null)
        {
            bindings.AddRange(appProfile.Bindings
                .Where(binding => binding.Enabled &&
                    (!builtInAppProfile || IsContinuousAnalogBinding(binding)))
                .Select(binding => (appProfile, binding)));
        }
        if (globalProfile != null)
        {
            bindings.AddRange(globalProfile.Bindings
                .Where(binding => binding.Enabled)
                .Select(binding => (globalProfile, binding)));
        }

        _controlRuntimeRoutes = bindings
            .SelectMany(item => EnumerateControlBindingRoutes(item.Profile, item.Binding))
            .Where(route => !ReferenceEquals(route.Profile, globalProfile) ||
                appProfile == null ||
                !appProfile.Bindings.Any(appBinding =>
                    appBinding.Enabled && BindingHasActivationChord(
                        appBinding,
                        ControlChordKey(route.ControllerButtons))))
            .OrderByDescending(route => route.ControllerButtons.Count)
            .ToArray();
        _controlRuntimeRoutesSource = profiles;
        _controlRuntimeRoutesKey = cacheKey;
        return _controlRuntimeRoutes;
    }

    private static bool IsContinuousAnalogBinding(ControlBinding binding)
        => binding.Action.Type is "pointer" or "wheel" &&
           (binding.ControllerButtons.Any(IsAnalogControlInput) ||
            binding.SecondaryControllerButtons.Any(IsAnalogControlInput));

    private void EnsureControlRuntimeProfilesLoaded()
    {
        if (Volatile.Read(ref _controlRuntimeProfiles).Length > 0)
            return;
        _ = LoadControlConfiguration();
    }

    private void SuppressSubsetBindings(
        IReadOnlyList<ControlBindingRoute> routes,
        ControlBindingRoute source,
        int slot)
    {
        var sourceButtons = source.ControllerButtons.ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (ControlBindingRoute route in routes)
        {
            if ((ReferenceEquals(route.Binding, source.Binding) && route.RouteId == source.RouteId) ||
                route.ControllerButtons.Count >= source.ControllerButtons.Count ||
                !route.ControllerButtons.All(sourceButtons.Contains))
            {
                continue;
            }

            var stateKey = new BindingRuntimeKey(
                currentUserId,
                route.Profile.Id,
                route.Binding.Id,
                route.RouteId,
                slot);
            if (!_controlBindingRuntime.TryGetValue(stateKey, out BindingRuntimeState? runtime))
            {
                runtime = new BindingRuntimeState();
                _controlBindingRuntime[stateKey] = runtime;
            }
            runtime.Suppressed = true;
        }
    }

    private static IEnumerable<ControlBindingRoute> EnumerateControlBindingRoutes(
        ControlProfile profile,
        ControlBinding binding)
    {
        if (binding.ControllerButtons.Count > 0)
        {
            yield return new ControlBindingRoute(
                profile,
                binding,
                "primary",
                binding.ControllerButtons,
                binding.Trigger,
                binding.LongPressDurationMs);
        }
        if (binding.SecondaryControllerButtons.Count > 0)
        {
            yield return new ControlBindingRoute(
                profile,
                binding,
                "secondary",
                binding.SecondaryControllerButtons,
                binding.SecondaryTrigger,
                binding.SecondaryLongPressDurationMs);
        }
    }

    private static IEnumerable<string> BindingActivationChordKeys(ControlBinding binding)
    {
        if (binding.ControllerButtons.Count > 0)
            yield return ControlChordKey(binding.ControllerButtons);
        if (binding.SecondaryControllerButtons.Count > 0)
            yield return ControlChordKey(binding.SecondaryControllerButtons);
    }

    private static bool BindingHasActivationChord(ControlBinding binding, string chord)
        => BindingActivationChordKeys(binding).Contains(chord, StringComparer.OrdinalIgnoreCase);

    private static string ControlChordKey(IEnumerable<string> buttons)
        => string.Join("+", buttons.OrderBy(button => button, StringComparer.OrdinalIgnoreCase));

    private static bool IsControlChordActive(
        XInputSlotState state,
        IReadOnlyCollection<string> buttons,
        double analogDeadZone)
    {
        if (!state.Connected || buttons.Count == 0)
            return false;

        foreach (string button in buttons)
        {
            bool pressed = button switch
            {
                "a" => (state.NativeButtons & 0x1000) != 0,
                "b" => (state.NativeButtons & 0x2000) != 0,
                "x" => (state.NativeButtons & 0x4000) != 0,
                "y" => (state.NativeButtons & 0x8000) != 0,
                "lb" => (state.NativeButtons & 0x0100) != 0,
                "rb" => (state.NativeButtons & 0x0200) != 0,
                "lt" => state.LeftTrigger > 128,
                "rt" => state.RightTrigger > 128,
                "back" => (state.NativeButtons & 0x0020) != 0,
                "start" => (state.NativeButtons & 0x0010) != 0,
                "guide" => (state.NativeButtons & 0x0400) != 0,
                "l3" => (state.NativeButtons & 0x0040) != 0,
                "r3" => (state.NativeButtons & 0x0080) != 0,
                "dpad-up" => (state.NativeButtons & 0x0001) != 0,
                "dpad-down" => (state.NativeButtons & 0x0002) != 0,
                "dpad-left" => (state.NativeButtons & 0x0004) != 0,
                "dpad-right" => (state.NativeButtons & 0x0008) != 0,
                "left-stick" => Math.Sqrt(state.ThumbLX * state.ThumbLX + state.ThumbLY * state.ThumbLY) > analogDeadZone,
                "right-stick" => Math.Sqrt(state.ThumbRX * state.ThumbRX + state.ThumbRY * state.ThumbRY) > analogDeadZone,
                "left-stick-up" => state.ThumbLY > analogDeadZone,
                "left-stick-down" => state.ThumbLY < -analogDeadZone,
                "left-stick-left" => state.ThumbLX < -analogDeadZone,
                "left-stick-right" => state.ThumbLX > analogDeadZone,
                "right-stick-up" => state.ThumbRY > analogDeadZone,
                "right-stick-down" => state.ThumbRY < -analogDeadZone,
                "right-stick-left" => state.ThumbRX < -analogDeadZone,
                "right-stick-right" => state.ThumbRX > analogDeadZone,
                _ => false
            };
            if (!pressed)
                return false;
        }
        return true;
    }

    private static bool IsAnalogControlInput(string button)
        => button is "left-stick" or "right-stick" ||
           button.StartsWith("left-stick-", StringComparison.OrdinalIgnoreCase) ||
           button.StartsWith("right-stick-", StringComparison.OrdinalIgnoreCase);

    private static (double X, double Y) GetConfiguredAnalogVector(
        XInputSlotState state,
        IReadOnlyCollection<string> inputs)
    {
        if (inputs.Any(input =>
                input.Equals("right-stick", StringComparison.OrdinalIgnoreCase) ||
                input.StartsWith("right-stick-", StringComparison.OrdinalIgnoreCase)))
            return (state.ThumbRX, state.ThumbRY);
        return (state.ThumbLX, state.ThumbLY);
    }

    private static bool TryShapeControllerPointerVector(
        double x,
        double y,
        double deadZone,
        out double shapedX,
        out double shapedY)
    {
        double magnitude = Math.Sqrt(x * x + y * y);
        if (magnitude <= deadZone)
        {
            shapedX = 0;
            shapedY = 0;
            return false;
        }

        magnitude = Math.Min(1, magnitude);
        double curvedMagnitude = Math.Pow(magnitude, 2.2);
        double scale = curvedMagnitude / Math.Max(magnitude, double.Epsilon);
        shapedX = x * scale;
        shapedY = y * scale;
        return true;
    }

    private void ApplyConfiguredAnalogAction(
        ControlProfile profile,
        ControlBinding binding,
        IReadOnlyCollection<string> controllerButtons,
        XInputSlotState state,
        BindingRuntimeState runtime,
        long timestamp)
    {
        double dt = runtime.LastContinuousTimestamp == 0
            ? 0
            : Math.Clamp(
                Stopwatch.GetElapsedTime(runtime.LastContinuousTimestamp, timestamp).TotalSeconds,
                0,
                0.05);
        runtime.LastContinuousTimestamp = timestamp;
        if (dt <= 0) return;

        (double x, double y) = GetConfiguredAnalogVector(state, controllerButtons);
        double magnitude = Math.Min(1, Math.Sqrt(x * x + y * y));
        if (magnitude <= profile.MouseDeadZone) return;

        if (binding.Action.Type == "pointer")
        {
            if (binding.Action.PointerDirection != "free")
            {
                (x, y) = binding.Action.PointerDirection switch
                {
                    "up" => (0d, magnitude),
                    "down" => (0d, -magnitude),
                    "left" => (-magnitude, 0d),
                    _ => (magnitude, 0d)
                };
            }

            // Curve the radial magnitude instead of each axis independently. This
            // preserves the stick angle, so circular input remains circular.
            TryShapeControllerPointerVector(
                x,
                y,
                profile.MouseDeadZone,
                out double shapedX,
                out double shapedY);
            double speed = CONTROLLER_NATIVE_MOUSE_BASE_SPEED *
                           CONTROLLER_MOUSE_SENSITIVITY_SCALE *
                           Math.Clamp(profile.MouseSensitivity, 0.25, 3.0);
            double moveX = shapedX * speed * dt + runtime.RemainderX;
            double moveY = -shapedY * speed * dt + runtime.RemainderY;
            int dx = (int)moveX;
            int dy = (int)moveY;
            runtime.RemainderX = moveX - dx;
            runtime.RemainderY = moveY - dy;
            if (dx != 0 || dy != 0)
                SendConfiguredMouseInput(dx, dy, MOUSEEVENTF_MOVE | MOUSEEVENTF_MOVE_NOCOALESCE, 0);
            return;
        }

        if (Math.Abs(y) <= profile.MouseDeadZone)
        {
            runtime.WheelRemainder = 0;
            return;
        }

        double direction = Math.Sign(binding.Action.WheelDelta);
        double amountScale = Math.Abs(binding.Action.WheelDelta) / 120.0;
        double wheel = y * 2800 * direction * amountScale *
                       Math.Clamp(profile.ScrollSensitivity, 0.25, 3.0) * dt +
                       runtime.WheelRemainder;
        int delta = (int)wheel;
        runtime.WheelRemainder = wheel - delta;
        if (delta != 0)
            SendConfiguredMouseInput(0, 0, 0x0800, unchecked((uint)delta));
    }

    private static void ResetConfiguredContinuousState(BindingRuntimeState runtime)
    {
        runtime.LastContinuousTimestamp = 0;
        runtime.RemainderX = 0;
        runtime.RemainderY = 0;
        runtime.WheelRemainder = 0;
    }

    private void TapConfiguredControlAction(ControlAction action)
    {
        if (action.Type == "system")
        {
            if (action.SystemCommand == "task-switcher")
            {
                if (Volatile.Read(ref _nativeTaskSwitcherActive) == 0)
                    BeginNativeTaskSwitcher();
            }
            else if (action.SystemCommand == "doorpi-return")
            {
                if (Volatile.Read(ref _nativeTaskSwitcherActive) == 1)
                    EndNativeTaskSwitcher(cancelSelection: true);
                QueueGlobalDoorpiReturnVerification();
            }
            else if (action.SystemCommand == "close-web-app")
            {
                _ = Dispatcher.BeginInvoke(() =>
                {
                    if (_webAppWindow != null || _isGenericBrowserMode || _ytWebView != null)
                        CloseYouTubeInline();
                });
            }
            else if (action.SystemCommand == "youtube-play-pause")
            {
                DispatchYouTubePlayPauseToRenderer();
            }
            return;
        }

        BeginConfiguredControlAction(action);
        EndConfiguredControlAction(action);
    }

    private void BeginConfiguredControlAction(ControlAction action)
    {
        if (action.Type == "keyboard")
        {
            foreach (ushort key in action.VirtualKeys)
                SendConfiguredKeyEvent(key, keyUp: false);
            return;
        }

        if (action.Type == "mouse")
        {
            SendConfiguredMouseButton(action.MouseButton, keyUp: false);
            return;
        }

        if (action.Type == "wheel")
        {
            SendConfiguredMouseInput(0, 0, 0x0800, unchecked((uint)action.WheelDelta));
            return;
        }

        if (action.Type == "pointer")
        {
            int distance = Math.Clamp(action.PointerDistance, 4, 128);
            (int dx, int dy) = action.PointerDirection switch
            {
                "up" => (0, -distance),
                "down" => (0, distance),
                "left" => (-distance, 0),
                "right" => (distance, 0),
                _ => (0, 0)
            };
            if (dx != 0 || dy != 0)
                SendConfiguredMouseInput(dx, dy, MOUSEEVENTF_MOVE | MOUSEEVENTF_MOVE_NOCOALESCE, 0);
        }
    }

    private void EndConfiguredControlAction(ControlAction action)
    {
        if (action.Type == "keyboard")
        {
            for (int index = action.VirtualKeys.Count - 1; index >= 0; index--)
                SendConfiguredKeyEvent(action.VirtualKeys[index], keyUp: true);
            return;
        }

        if (action.Type == "mouse")
            SendConfiguredMouseButton(action.MouseButton, keyUp: true);
    }

    private void SendConfiguredKeyEvent(ushort key, bool keyUp)
    {
        bool requiresBridge = ShouldUseElevatedInputForForeground();
        if (requiresBridge)
        {
            EnsureElevatedInputBridgeForForeground();
            if (TrySendElevatedKeyEvent(key, keyUp))
                return;
        }

        SendInputs(new[] { KeyboardInput(key, keyUp) });
    }

    private void SendConfiguredMouseButton(string button, bool keyUp)
    {
        (uint down, uint up, uint data) = button switch
        {
            "right" => (0x0008u, 0x0010u, 0u),
            "middle" => (0x0020u, 0x0040u, 0u),
            "x1" => (0x0080u, 0x0100u, 1u),
            "x2" => (0x0080u, 0x0100u, 2u),
            _ => (0x0002u, 0x0004u, 0u)
        };
        SendConfiguredMouseInput(0, 0, keyUp ? up : down, data);
    }

    private void SendConfiguredMouseInput(int dx, int dy, uint flags, uint data)
    {
        bool requiresBridge = ShouldUseElevatedInputForForeground();
        if (requiresBridge)
        {
            EnsureElevatedInputBridgeForForeground();
            if (TrySendElevatedMouse(dx, dy, flags, data))
                return;
        }

        var input = new INPUT { type = INPUT_MOUSE };
        input.U.mi = new MOUSEINPUT { dx = dx, dy = dy, dwFlags = flags, mouseData = data };
        SendInputs(new[] { input });
    }

    private void ReleaseConfiguredControlOutputs()
    {
        lock (_controlRuntimeLock)
            ReleaseConfiguredControlOutputsCore();
    }

    private void ReleaseConfiguredControlOutputsCore()
    {
        ControlProfile[] profiles = Volatile.Read(ref _controlRuntimeProfiles);
        if (profiles.Length > 0)
        {
            foreach (ControlProfile profile in profiles)
            {
                foreach (ControlBinding binding in profile.Bindings)
                {
                    if (_controlBindingRuntime.Any(entry =>
                            string.Equals(entry.Key.ProfileId, profile.Id, StringComparison.OrdinalIgnoreCase) &&
                            string.Equals(entry.Key.BindingId, binding.Id, StringComparison.OrdinalIgnoreCase) &&
                            entry.Value.OutputHeld))
                    {
                        EndConfiguredControlAction(binding.Action);
                    }
                }
            }
        }
        _controlBindingRuntime.Clear();
        if (_configuredCloseHoldOverlayVisible)
        {
            _configuredCloseHoldOverlayVisible = false;
            _configuredCloseHoldOverlayLastUpdateMs = 0;
            HideWebAppCloseHoldOverlay();
        }
    }

    private (List<CloudControlProfileV1> Profiles, List<CloudControlAssignmentV1> Assignments)
        GetCloudControlConfigurationSnapshot()
    {
        ControlConfigurationDocument document = LoadControlConfiguration();
        List<CloudControlProfileV1> profiles = document.Profiles
            .Where(profile => !profile.Id.StartsWith("builtin-", StringComparison.OrdinalIgnoreCase))
            .Select(ToCloudControlProfile)
            .ToList();
        List<CloudControlAssignmentV1> assignments = document.Assignments
            .Where(assignment => !string.IsNullOrWhiteSpace(assignment.ProfileId) &&
                                 !assignment.ProfileId.StartsWith("builtin-", StringComparison.OrdinalIgnoreCase))
            .Select(assignment => new CloudControlAssignmentV1
            {
                ProfileId = assignment.ProfileId,
                TargetName = assignment.TargetName,
                TargetCategory = assignment.TargetCategory,
                TargetFingerprint = assignment.TargetFingerprint,
                NativeAppId = assignment.NativeAppId,
                ExecutablePath = assignment.ExecutablePath,
                UpdatedAtUtc = assignment.UpdatedAtUtc
            })
            .ToList();
        return (profiles, assignments);
    }

    private static CloudControlProfileV1 ToCloudControlProfile(ControlProfile profile)
        => new()
        {
            Id = profile.Id,
            Name = profile.Name,
            Category = profile.Category,
            TargetKind = IsGlobalControlProfile(profile) ? "global" : profile.TargetKind,
            BaseProfileId = profile.BaseProfileId,
            Enabled = profile.Enabled,
            MouseSensitivity = profile.MouseSensitivity,
            ScrollSensitivity = profile.ScrollSensitivity,
            MouseDeadZone = profile.MouseDeadZone,
            HasConfigurablePointerBindings = profile.HasConfigurablePointerBindings,
            HasSecondaryActivations = profile.HasSecondaryActivations,
            CreatedAtUtc = profile.CreatedAtUtc,
            UpdatedAtUtc = profile.UpdatedAtUtc,
            Bindings = profile.Bindings.Select(binding => new CloudControlBindingV1
            {
                Id = binding.Id,
                Name = binding.Name,
                Enabled = binding.Enabled,
                ControllerButtons = binding.ControllerButtons.ToList(),
                Trigger = binding.Trigger,
                LongPressDurationMs = binding.LongPressDurationMs,
                SecondaryControllerButtons = binding.SecondaryControllerButtons.ToList(),
                SecondaryTrigger = binding.SecondaryTrigger,
                SecondaryLongPressDurationMs = binding.SecondaryLongPressDurationMs,
                Action = new CloudControlActionV1
                {
                    Type = binding.Action.Type,
                    VirtualKeys = binding.Action.VirtualKeys.ToList(),
                    MouseButton = binding.Action.MouseButton,
                    WheelDelta = binding.Action.WheelDelta,
                    PointerDirection = binding.Action.PointerDirection,
                    PointerDistance = binding.Action.PointerDistance,
                    SystemCommand = binding.Action.SystemCommand
                }
            }).ToList()
        };

    private static ControlProfile FromCloudControlProfile(CloudControlProfileV1 profile)
    {
        bool isGlobal = string.Equals(profile.TargetKind, "global", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(profile.Category, "global", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(profile.Id, "global-default", StringComparison.OrdinalIgnoreCase);
        var result = new ControlProfile
        {
            Id = profile.Id,
            Name = profile.Name,
            Category = profile.Category,
            BaseProfileId = profile.BaseProfileId,
            TargetKind = isGlobal
                ? "global"
                : string.Equals(profile.TargetKind, "store", StringComparison.OrdinalIgnoreCase) ||
                  string.Equals(profile.Category, "store", StringComparison.OrdinalIgnoreCase)
                    ? "store"
                    : "media",
            Enabled = profile.Enabled,
            MouseSensitivity = profile.MouseSensitivity,
            ScrollSensitivity = profile.ScrollSensitivity,
            MouseDeadZone = profile.MouseDeadZone,
            HasConfigurablePointerBindings = profile.HasConfigurablePointerBindings,
            HasSecondaryActivations = profile.HasSecondaryActivations,
            CreatedAtUtc = profile.CreatedAtUtc,
            UpdatedAtUtc = profile.UpdatedAtUtc,
            Bindings = (profile.Bindings ?? new List<CloudControlBindingV1>()).Select(binding => new ControlBinding
            {
                Id = binding.Id,
                Name = binding.Name,
                Enabled = binding.Enabled,
                ControllerButtons = binding.ControllerButtons?.ToList() ?? new List<string>(),
                Trigger = binding.Trigger,
                LongPressDurationMs = binding.LongPressDurationMs,
                SecondaryControllerButtons = binding.SecondaryControllerButtons?.ToList() ?? new List<string>(),
                SecondaryTrigger = binding.SecondaryTrigger,
                SecondaryLongPressDurationMs = binding.SecondaryLongPressDurationMs,
                Action = new ControlAction
                {
                    Type = binding.Action?.Type ?? "keyboard",
                    VirtualKeys = binding.Action?.VirtualKeys?.ToList() ?? new List<ushort>(),
                    MouseButton = binding.Action?.MouseButton ?? "left",
                    WheelDelta = binding.Action?.WheelDelta ?? 120,
                    PointerDirection = binding.Action?.PointerDirection ?? "free",
                    PointerDistance = binding.Action?.PointerDistance ?? 24,
                    SystemCommand = binding.Action?.SystemCommand ?? ""
                }
            }).ToList()
        };
        if (!result.HasConfigurablePointerBindings)
        {
            AddDefaultPointerBindings(result);
            result.HasConfigurablePointerBindings = true;
        }
        if (!result.HasSecondaryActivations)
        {
            MigrateSecondaryControlActivations(result);
            result.HasSecondaryActivations = true;
        }
        NormalizeControlProfile(result);
        return result;
    }

    private void ApplyCloudControlConfiguration(CloudProfileV1 cloud)
    {
        if ((cloud.ControlProfiles?.Count ?? 0) == 0 &&
            (cloud.ControlAssignments?.Count ?? 0) == 0)
        {
            return;
        }

        ReleaseConfiguredControlOutputs();
        lock (_controlConfigurationLock)
        {
            ControlConfigurationDocument document = LoadControlConfiguration();
            foreach (CloudControlProfileV1 cloudProfile in cloud.ControlProfiles ?? new List<CloudControlProfileV1>())
            {
                if (string.IsNullOrWhiteSpace(cloudProfile.Id) ||
                    cloudProfile.Id.StartsWith("builtin-", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                ControlProfile incoming = FromCloudControlProfile(cloudProfile);
                bool incomingGlobal = IsGlobalControlProfile(incoming);
                incoming.OwnerUserId = incomingGlobal ? "" : currentUserId;
                if (!incomingGlobal)
                    RemoveCopiedGlobalBindings(incoming);
                if (IsGeneratedEmptyReusableProfile(incoming))
                    continue;
                int index = document.Profiles.FindIndex(profile =>
                    string.Equals(profile.Id, incoming.Id, StringComparison.OrdinalIgnoreCase));
                if (index < 0) document.Profiles.Add(incoming);
                else if (incoming.UpdatedAtUtc >= document.Profiles[index].UpdatedAtUtc) document.Profiles[index] = incoming;
            }

            List<ControlTarget> targets = GetControlTargets();
            foreach (CloudControlAssignmentV1 hint in cloud.ControlAssignments ?? new List<CloudControlAssignmentV1>())
            {
                if (!document.Profiles.Any(profile =>
                        string.Equals(profile.Id, hint.ProfileId, StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                ControlTarget? target = null;
                if (!string.IsNullOrWhiteSpace(hint.NativeAppId))
                {
                    target = targets.FirstOrDefault(candidate => candidate.IsNative &&
                        string.Equals(candidate.NativeAppId, hint.NativeAppId, StringComparison.OrdinalIgnoreCase));
                }
                else if (!string.IsNullOrWhiteSpace(hint.ExecutablePath))
                {
                    string cloudPath = NormalizeExecutablePath(hint.ExecutablePath);
                    target = targets.FirstOrDefault(candidate =>
                        candidate.Category == "executable" &&
                        File.Exists(candidate.ExecutablePath) &&
                        string.Equals(NormalizeExecutablePath(candidate.ExecutablePath), cloudPath, StringComparison.OrdinalIgnoreCase));
                }

                if (target != null)
                    UpsertControlAssignment(document, target, hint.ProfileId);
            }
            SaveControlConfiguration(document, scheduleSync: false);
        }
    }
}
