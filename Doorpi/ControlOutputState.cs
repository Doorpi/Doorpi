namespace Doorpi;

// Own the physical output rather than a profile/binding identity. Different
// bindings may share modifiers, mouse buttons or an entire key combination.
internal sealed class ControlOutputState(Action<ushort, bool> keyboard, Action<string, bool> mouse)
{
    private readonly Dictionary<ushort, int> _keys = new();
    private readonly Dictionary<string, int> _buttons = new(StringComparer.OrdinalIgnoreCase);

    internal void Begin(ControlAction action)
    {
        if (action.Type == "keyboard")
        {
            foreach (ushort key in action.VirtualKeys)
            {
                _keys.TryGetValue(key, out int owners);
                if (owners == 0) keyboard(key, false);
                _keys[key] = owners + 1;
            }
        }
        else if (action.Type == "mouse")
        {
            string button = string.IsNullOrWhiteSpace(action.MouseButton) ? "left" : action.MouseButton;
            _buttons.TryGetValue(button, out int owners);
            if (owners == 0) mouse(button, false);
            _buttons[button] = owners + 1;
        }
    }

    internal void End(ControlAction action)
    {
        if (action.Type == "keyboard")
        {
            for (int index = action.VirtualKeys.Count - 1; index >= 0; index--)
            {
                ushort key = action.VirtualKeys[index];
                if (!_keys.TryGetValue(key, out int owners)) continue;
                if (owners > 1) _keys[key] = owners - 1;
                else { keyboard(key, true); _keys.Remove(key); }
            }
        }
        else if (action.Type == "mouse")
        {
            string button = string.IsNullOrWhiteSpace(action.MouseButton) ? "left" : action.MouseButton;
            if (!_buttons.TryGetValue(button, out int owners)) return;
            if (owners > 1) _buttons[button] = owners - 1;
            else { mouse(button, true); _buttons.Remove(button); }
        }
    }

    internal void ReleaseAll()
    {
        foreach (ushort key in _keys.Keys.ToArray()) { keyboard(key, true); _keys.Remove(key); }
        foreach (string button in _buttons.Keys.ToArray()) { mouse(button, true); _buttons.Remove(button); }
    }
}
