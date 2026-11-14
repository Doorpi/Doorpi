namespace Doorpi;
partial class MainWindow
{
    private readonly object _controlRuntimeLock = new();
    private readonly Dictionary<BindingRuntimeKey, BindingRuntimeState> _controlBindingRuntime = new();
    private ControlProfile[] _controlRuntimeProfiles = [];
    private ControlProfile[]? _controlRuntimeRoutesSource;
    private ControlBindingRoute[] _controlRuntimeRoutes = [];
    private string _controlRuntimeRoutesKey = "";
    private bool _controlRoutesNeedNeutral;
    private string _lastRuntimeControlTargetKey = "media:test";
    private string currentUserId = "test-user";
    private int _configuredControlButtonsSuppressedUntilRelease;
    private bool _configuredCloseHoldOverlayVisible;
    private long _configuredCloseHoldOverlayLastUpdateMs;
    private bool _vkbIsOpen;
    private object? _desktopVkb;
    private ControlOutputState? _configuredOutputs;
    private ControlOutputState ConfiguredOutputs => _configuredOutputs ??= new(SendConfiguredKeyEvent, SendConfiguredMouseButton);
    private readonly List<string> Events = [];
    private readonly HashSet<ushort> Held = [];
    private const uint MOUSEEVENTF_MOVE = 1;
    private string GetActiveControlTargetKey() => "media:test";
    private void EnsureControlRuntimeProfilesLoaded() { }
    private void LogMediaControllerDiagnostic(string name, string extra) { }
    private static int NativeControllerButtonMask(string button) => 0;
    private static bool IsYouTubeNavigationKeyHold(string target, ControlAction action) => false;
    private static int GetYouTubeNavigationRepeatInterval(ushort key, long held) => 100;
    private void HideWebAppCloseHoldOverlay() { }
    private void UpdateWebAppCloseHoldOverlay(double progress) { }
    private void ApplyConfiguredAnalogAction(ControlProfile profile, ControlBinding binding, IReadOnlyCollection<string> buttons, XInputSlotState state, BindingRuntimeState runtime, long timestamp) { }
    private static void ResetConfiguredContinuousState(BindingRuntimeState runtime) { }
    private static bool CustomYouTubeProfileUsesNativeBackGesture(string target) => false;
    private static bool IsYouTubeBackEscapeBinding(ControlBinding binding) => false;
    private static bool IsYouTubeBackCloseBinding(ControlBinding binding) => false;
    private ControlProfile? GetAssignedRuntimeControlProfile(string target) => _controlRuntimeProfiles[0];
    private void SendConfiguredMouseInput(int dx, int dy, uint flags, uint data) { }
    private void SendConfiguredKeyEvent(ushort key, bool keyUp)
    {
        Events.Add((keyUp ? "up:" : "down:") + key);
        if (keyUp) Held.Remove(key); else Held.Add(key);
    }
    private void SendConfiguredMouseButton(string button, bool keyUp) => Events.Add((keyUp ? "mouse-up:" : "mouse-down:") + button);
    private void TapConfiguredControlAction(ControlAction action) { BeginConfiguredControlAction(action); EndConfiguredControlAction(action); }
    private static XInputSnapshot Snapshot(ushort buttons)
    {
        var slots = new XInputSlotState[4];
        slots[0] = new(true, 1, buttons, buttons, 0, 0, 0, 0, 0, 0);
        return new(0, 1, slots, buttons, false, 0, 0, 0, 0);
    }
    private static ControlBinding Binding(string id, string trigger, ushort key, params string[] buttons)
        => new() { Id = id, Trigger = trigger, ControllerButtons = buttons.ToList(), Action = new() { Type = "keyboard", VirtualKeys = [key] } };
    private static MainWindow Create(params ControlBinding[] bindings)
        => new() { _controlRuntimeProfiles = [new() { Id = "test-profile", TargetKind = "media", Bindings = bindings.ToList() }] };
    private void Step(ushort buttons) => ProcessConfiguredControlBindingsCore(Snapshot(buttons));
    private static void Check(bool condition, string name)
    {
        if (!condition) throw new InvalidOperationException("FAIL: " + name);
        Console.WriteLine("PASS: " + name);
    }
    private static void Main()
    {
        var chord = Create(Binding("single", "press", 65, "a"), Binding("combo", "press", 66, "lb", "a"));
        chord.Step(0x1100);
        Check(chord.Events.SequenceEqual(new[] { "down:66", "up:66" }), "larger chord consumes simple press");
        var heldChord = Create(Binding("single", "hold", 65, "a"), Binding("combo", "press", 66, "lb", "a"));
        heldChord.Step(0x1000); heldChord.Step(0x1100);
        Check(!heldChord.Held.Contains(65) && heldChord.Events.Contains("down:66"), "larger chord releases an already held subset");
        heldChord.Step(0x1000);
        Check(!heldChord.Held.Contains(65), "subset waits for neutral after chord release");
        heldChord.Step(0); heldChord.Step(0x1000);
        Check(heldChord.Held.Contains(65), "subset works again after neutral");
        var shared = Create(Binding("one", "hold", 16, "a"), Binding("two", "hold", 16, "b"));
        shared.Step(0x1000); shared.Step(0x3000); shared.Step(0x2000);
        Check(shared.Held.Contains(16) && !shared.Events.Contains("up:16"), "shared Shift remains held by the second binding");
        shared.Step(0);
        Check(!shared.Held.Contains(16) && shared.Events.Count(item => item == "up:16") == 1, "shared Shift releases once after final owner");
        var alternateBinding = Binding("alternate", "hold", 16, "a");
        alternateBinding.SecondaryControllerButtons = ["b"];
        alternateBinding.SecondaryTrigger = "hold";
        var alternate = Create(alternateBinding);
        alternate.Step(0x1000); alternate.Step(0x3000); alternate.Step(0x2000);
        Check(alternate.Held.Contains(16) && alternate.Events.Count(item => item == "down:16") == 1, "primary and secondary routes share one physical output owner");
        alternate.Step(0);
        Check(!alternate.Held.Contains(16) && alternate.Events.Count(item => item == "up:16") == 1, "alternate routes release once after both return to neutral");
        var vkb = Create(Binding("one", "hold", 16, "a"));
        vkb.Step(0x1000); vkb._vkbIsOpen = true; vkb.Step(0);
        Check(!vkb.Held.Contains(16), "opening VKB releases removed app output");
        vkb._vkbIsOpen = false; vkb.Step(0x1000);
        Check(!vkb.Held.Contains(16), "closing VKB does not replay an already held button");
        vkb.Step(0); vkb.Step(0x1000);
        Check(vkb.Held.Contains(16), "app route resumes after neutral");
        vkb.ReleaseConfiguredControlOutputs();
        Check(vkb.Held.Count == 0, "full release clears all physical outputs");
        var outputEvents = new List<string>();
        var outputs = new ControlOutputState((key, up) => outputEvents.Add($"key:{key}:{up}"), (button, up) => outputEvents.Add($"mouse:{button}:{up}"));
        var click = new ControlAction { Type = "mouse", MouseButton = "left" };
        outputs.Begin(click); outputs.Begin(click); outputs.End(click);
        Check(outputEvents.SequenceEqual(new[] { "mouse:left:False" }), "shared mouse button remains down after one owner ends");
        outputs.ReleaseAll();
        Check(outputEvents.Last() == "mouse:left:True", "full release clears shared mouse button once");
        Console.WriteLine("PASS: 14 control runtime checks; production methods generated at build time, no Win32 input emitted");
    }
}
