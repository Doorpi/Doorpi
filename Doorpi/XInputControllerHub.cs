using System;
using System.Runtime.InteropServices;

namespace Doorpi
{
    /// <summary>
    /// Single XInput reader shared by every controller mode. Slots are kept only so
    /// button edges and chords from different physical controllers never mix.
    /// </summary>
    internal static class XInputControllerHub
    {
        internal const int SlotCount = 4;
        private const int PollIntervalMs = 8;
        private const ushort DpadUp = 0x0001;
        private const ushort DpadDown = 0x0002;
        private const ushort DpadLeft = 0x0004;
        private const ushort DpadRight = 0x0008;
        private const ushort LeftTriggerButton = 0x0800;
        private const ushort ConfirmButton = 0x1000;

        private static readonly object Sync = new();
        private static XInputSnapshot _cached = XInputSnapshot.Empty;
        private static long _lastPollAt = long.MinValue;
        private static bool _extendedStateAvailable = true;

        [DllImport("xinput1_4.dll", EntryPoint = "XInputGetState")]
        private static extern int XInputGetState(int userIndex, out NativeState state);

        // Ordinal 100 exposes the Guide button while retaining the normal XInput layout.
        [DllImport("xinput1_4.dll", EntryPoint = "#100")]
        private static extern int XInputGetStateExtended(int userIndex, out NativeState state);

        [StructLayout(LayoutKind.Sequential)]
        private struct NativeState
        {
            public uint PacketNumber;
            public NativeGamepad Gamepad;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct NativeGamepad
        {
            public ushort Buttons;
            public byte LeftTrigger;
            public byte RightTrigger;
            public short ThumbLX;
            public short ThumbLY;
            public short ThumbRX;
            public short ThumbRY;
        }

        internal static XInputSnapshot Read()
        {
            long now = Environment.TickCount64;
            lock (Sync)
            {
                if (_lastPollAt != long.MinValue && now - _lastPollAt < PollIntervalMs)
                    return _cached;

                _cached = Poll(now);
                _lastPollAt = now;
                return _cached;
            }
        }

        private static XInputSnapshot Poll(long timestamp)
        {
            var slots = new XInputSlotState[SlotCount];
            byte connectedMask = 0;
            ushort heldButtons = 0;
            bool leftTrigger = false;
            double leftX = 0, leftY = 0, rightX = 0, rightY = 0;
            double strongestLeft = 0, strongestRight = 0;

            for (int slot = 0; slot < SlotCount; slot++)
            {
                if (!TryGetState(slot, out var native))
                    continue;

                connectedMask |= (byte)(1 << slot);
                var gamepad = native.Gamepad;
                ushort buttons = gamepad.Buttons;
                if (gamepad.LeftTrigger > 128)
                    buttons |= LeftTriggerButton;
                if (gamepad.RightTrigger > 128)
                    buttons |= ConfirmButton;

                double lx = NormalizeThumb(gamepad.ThumbLX);
                double ly = NormalizeThumb(gamepad.ThumbLY);
                double rx = NormalizeThumb(gamepad.ThumbRX);
                double ry = NormalizeThumb(gamepad.ThumbRY);

                slots[slot] = new XInputSlotState(
                    connected: true,
                    packetNumber: native.PacketNumber,
                    nativeButtons: gamepad.Buttons,
                    buttons: buttons,
                    leftTrigger: gamepad.LeftTrigger,
                    rightTrigger: gamepad.RightTrigger,
                    thumbLX: lx,
                    thumbLY: ly,
                    thumbRX: rx,
                    thumbRY: ry);

                heldButtons |= buttons;
                leftTrigger |= gamepad.LeftTrigger > 128;

                // Keep each stick vector intact. Selecting X and Y independently can
                // manufacture a diagonal from two different controllers.
                double leftMagnitude = (lx * lx) + (ly * ly);
                if (leftMagnitude > strongestLeft)
                {
                    strongestLeft = leftMagnitude;
                    leftX = lx;
                    leftY = ly;
                }

                double rightMagnitude = (rx * rx) + (ry * ry);
                if (rightMagnitude > strongestRight)
                {
                    strongestRight = rightMagnitude;
                    rightX = rx;
                    rightY = ry;
                }
            }

            heldButtons = NeutralizeOppositeDpadDirections(heldButtons);
            return new XInputSnapshot(
                timestamp,
                connectedMask,
                slots,
                heldButtons,
                leftTrigger,
                leftX,
                leftY,
                rightX,
                rightY);
        }

        private static bool TryGetState(int slot, out NativeState state)
        {
            try
            {
                if (_extendedStateAvailable)
                    return XInputGetStateExtended(slot, out state) == 0;
            }
            catch (EntryPointNotFoundException)
            {
                _extendedStateAvailable = false;
            }
            catch (DllNotFoundException)
            {
                _extendedStateAvailable = false;
            }

            try
            {
                return XInputGetState(slot, out state) == 0;
            }
            catch
            {
                state = default;
                return false;
            }
        }

        private static double NormalizeThumb(short value)
        {
            if (value < 0)
                return value / 32768.0;
            return value / 32767.0;
        }

        private static ushort NeutralizeOppositeDpadDirections(ushort buttons)
        {
            if ((buttons & (DpadLeft | DpadRight)) == (DpadLeft | DpadRight))
                buttons &= unchecked((ushort)~(DpadLeft | DpadRight));
            if ((buttons & (DpadUp | DpadDown)) == (DpadUp | DpadDown))
                buttons &= unchecked((ushort)~(DpadUp | DpadDown));
            return buttons;
        }
    }

    internal readonly struct XInputSlotState
    {
        internal XInputSlotState(
            bool connected,
            uint packetNumber,
            ushort nativeButtons,
            ushort buttons,
            byte leftTrigger,
            byte rightTrigger,
            double thumbLX,
            double thumbLY,
            double thumbRX,
            double thumbRY)
        {
            Connected = connected;
            PacketNumber = packetNumber;
            NativeButtons = nativeButtons;
            Buttons = buttons;
            LeftTrigger = leftTrigger;
            RightTrigger = rightTrigger;
            ThumbLX = thumbLX;
            ThumbLY = thumbLY;
            ThumbRX = thumbRX;
            ThumbRY = thumbRY;
        }

        internal bool Connected { get; }
        internal uint PacketNumber { get; }
        // Physical XInput buttons before Doorpi's trigger aliases are applied.
        internal ushort NativeButtons { get; }
        internal ushort Buttons { get; }
        internal byte LeftTrigger { get; }
        internal byte RightTrigger { get; }
        internal double ThumbLX { get; }
        internal double ThumbLY { get; }
        internal double ThumbRX { get; }
        internal double ThumbRY { get; }
    }

    internal sealed class XInputSnapshot
    {
        internal static readonly XInputSnapshot Empty = new(
            0, 0, new XInputSlotState[XInputControllerHub.SlotCount], 0, false, 0, 0, 0, 0);

        internal XInputSnapshot(
            long timestamp,
            byte connectedMask,
            XInputSlotState[] slots,
            ushort buttons,
            bool leftTrigger,
            double thumbLX,
            double thumbLY,
            double thumbRX,
            double thumbRY)
        {
            Timestamp = timestamp;
            ConnectedMask = connectedMask;
            Slots = slots;
            Buttons = buttons;
            LeftTrigger = leftTrigger;
            ThumbLX = thumbLX;
            ThumbLY = thumbLY;
            ThumbRX = thumbRX;
            ThumbRY = thumbRY;
        }

        internal long Timestamp { get; }
        internal byte ConnectedMask { get; }
        internal XInputSlotState[] Slots { get; }
        internal bool Connected => ConnectedMask != 0;
        internal ushort Buttons { get; }
        internal bool LeftTrigger { get; }
        internal double ThumbLX { get; }
        internal double ThumbLY { get; }
        internal double ThumbRX { get; }
        internal double ThumbRY { get; }
    }

    /// <summary>
    /// Per-consumer edge tracker. It never combines chords across slots and a
    /// connection change resets only the affected slot.
    /// </summary>
    internal sealed class XInputButtonTracker
    {
        private const ushort Guide = 0x0400;
        private const ushort Back = 0x0020;
        private const ushort Shoulders = 0x0300;
        private const ushort ReturnAlternative = 0x0380; // L1 + R1 + R3
        private const ushort L3 = 0x0040;
        private const ushort R3 = 0x0080;
        private const long MouseChordWindowMs = 450;
        private const long GuideHoldReturnDelayMs = 300;

        private readonly ushort[] _previous = new ushort[XInputControllerHub.SlotCount];
        private readonly ushort[] _previousNative = new ushort[XInputControllerHub.SlotCount];
        private readonly byte[] _previousLeftTrigger = new byte[XInputControllerHub.SlotCount];
        private readonly byte[] _previousRightTrigger = new byte[XInputControllerHub.SlotCount];
        private readonly ushort[] _framePrevious = new ushort[XInputControllerHub.SlotCount];
        private readonly ushort[] _frameCurrent = new ushort[XInputControllerHub.SlotCount];
        private readonly long[] _lastL3PressedAt = new long[XInputControllerHub.SlotCount];
        private readonly long[] _lastR3PressedAt = new long[XInputControllerHub.SlotCount];
        private readonly bool[] _mouseChordLatched = new bool[XInputControllerHub.SlotCount];
        private readonly bool[] _taskSwitcherChordLatched = new bool[XInputControllerHub.SlotCount];
        private readonly bool[] _guideReturnArmed = new bool[XInputControllerHub.SlotCount];
        private readonly bool[] _guideConsumedByTaskSwitcher = new bool[XInputControllerHub.SlotCount];
        private readonly bool[] _guideReturnDispatched = new bool[XInputControllerHub.SlotCount];
        private readonly long[] _guidePressedAt = new long[XInputControllerHub.SlotCount];
        private byte _connectedMask;
        private bool _initialized;

        internal ushort HeldButtons { get; private set; }
        internal ushort PreviousHeldButtons { get; private set; }
        internal ushort PressedButtons { get; private set; }
        internal ushort ReleasedButtons { get; private set; }
        internal ushort PhysicalPressedButtons { get; private set; }
        internal bool LeftTriggerJustPressed { get; private set; }
        internal bool RightTriggerJustPressed { get; private set; }
        internal bool ReturnShortcutJustPressed { get; private set; }
        internal byte ReturnShortcutSlotMask { get; private set; }
        internal bool TaskSwitcherShortcutJustPressed { get; private set; }
        internal byte TaskSwitcherShortcutSlotMask { get; private set; }
        internal bool MouseModeShortcutJustPressed { get; private set; }

        internal void Update(XInputSnapshot snapshot)
        {
            PreviousHeldButtons = HeldButtons;
            HeldButtons = snapshot.Buttons;
            PressedButtons = 0;
            ReleasedButtons = 0;
            PhysicalPressedButtons = 0;
            LeftTriggerJustPressed = false;
            RightTriggerJustPressed = false;
            ReturnShortcutJustPressed = false;
            ReturnShortcutSlotMask = 0;
            TaskSwitcherShortcutJustPressed = false;
            TaskSwitcherShortcutSlotMask = 0;
            MouseModeShortcutJustPressed = false;
            long now = Environment.TickCount64;

            for (int slot = 0; slot < XInputControllerHub.SlotCount; slot++)
            {
                byte bit = (byte)(1 << slot);
                bool connected = (snapshot.ConnectedMask & bit) != 0;
                bool wasConnected = (_connectedMask & bit) != 0;
                ushort current = connected ? snapshot.Slots[slot].Buttons : (ushort)0;
                ushort previous = wasConnected ? _previous[slot] : (ushort)0;
                ushort currentNative = connected ? snapshot.Slots[slot].NativeButtons : (ushort)0;
                ushort previousNative = wasConnected ? _previousNative[slot] : (ushort)0;
                byte currentLeftTrigger = connected ? snapshot.Slots[slot].LeftTrigger : (byte)0;
                byte previousLeftTrigger = wasConnected ? _previousLeftTrigger[slot] : (byte)0;
                byte currentRightTrigger = connected ? snapshot.Slots[slot].RightTrigger : (byte)0;
                byte previousRightTrigger = wasConnected ? _previousRightTrigger[slot] : (byte)0;
                bool seeded = !_initialized || (connected && !wasConnected);

                _framePrevious[slot] = previous;
                _frameCurrent[slot] = current;

                if (seeded)
                {
                    // Seed a new controller so a held button at connection time does
                    // not become an accidental shortcut.
                    previous = current;
                    previousNative = currentNative;
                    previousLeftTrigger = currentLeftTrigger;
                    previousRightTrigger = currentRightTrigger;
                    _framePrevious[slot] = current;
                }

                ushort pressed = (ushort)(current & ~previous);
                ushort released = (ushort)(previous & ~current);
                PressedButtons |= pressed;
                ReleasedButtons |= released;
                PhysicalPressedButtons |= (ushort)(currentNative & ~previousNative);
                LeftTriggerJustPressed |= currentLeftTrigger > 128 && previousLeftTrigger <= 128;
                RightTriggerJustPressed |= currentRightTrigger > 128 && previousRightTrigger <= 128;

                bool guidePressed = (pressed & Guide) != 0;
                bool guideReleased = connected && (released & Guide) != 0;
                if (guidePressed)
                {
                    _guideReturnArmed[slot] = true;
                    _guideConsumedByTaskSwitcher[slot] = false;
                    _guideReturnDispatched[slot] = false;
                    _guidePressedAt[slot] = now;
                }

                bool taskSwitcherChord =
                    (current & (Guide | Back)) == (Guide | Back) ||
                    (current & (Shoulders | Back)) == (Shoulders | Back);
                if (!taskSwitcherChord)
                    _taskSwitcherChordLatched[slot] = false;
                else if (!_taskSwitcherChordLatched[slot])
                {
                    _taskSwitcherChordLatched[slot] = true;
                    TaskSwitcherShortcutJustPressed = true;
                    TaskSwitcherShortcutSlotMask |= bit;
                    if ((current & Guide) != 0)
                        _guideConsumedByTaskSwitcher[slot] = true;
                }

                bool guideHeldLongEnough =
                    connected &&
                    (current & Guide) != 0 &&
                    _guideReturnArmed[slot] &&
                    !_guideConsumedByTaskSwitcher[slot] &&
                    !_guideReturnDispatched[slot] &&
                    now - _guidePressedAt[slot] >= GuideHoldReturnDelayMs;
                if (guideHeldLongEnough)
                {
                    ReturnShortcutJustPressed = true;
                    ReturnShortcutSlotMask |= bit;
                    _guideReturnDispatched[slot] = true;
                }

                if (guideReleased)
                {
                    if (_guideReturnArmed[slot] &&
                        !_guideConsumedByTaskSwitcher[slot] &&
                        !_guideReturnDispatched[slot])
                    {
                        ReturnShortcutJustPressed = true;
                        ReturnShortcutSlotMask |= bit;
                    }
                    _guideReturnArmed[slot] = false;
                    _guideConsumedByTaskSwitcher[slot] = false;
                    _guideReturnDispatched[slot] = false;
                    _guidePressedAt[slot] = 0;
                }

                bool alternativePressed =
                    (current & ReturnAlternative) == ReturnAlternative &&
                    (previous & ReturnAlternative) != ReturnAlternative;
                if (alternativePressed)
                {
                    ReturnShortcutJustPressed = true;
                    ReturnShortcutSlotMask |= bit;
                }

                if ((pressed & L3) != 0) _lastL3PressedAt[slot] = now;
                if ((pressed & R3) != 0) _lastR3PressedAt[slot] = now;

                bool bothSticksDown = (current & (L3 | R3)) == (L3 | R3);
                if (!bothSticksDown)
                    _mouseChordLatched[slot] = false;

                bool chordInWindow = !seeded && bothSticksDown &&
                    Math.Abs(_lastL3PressedAt[slot] - _lastR3PressedAt[slot]) <= MouseChordWindowMs;
                if (chordInWindow && !_mouseChordLatched[slot])
                {
                    _mouseChordLatched[slot] = true;
                    MouseModeShortcutJustPressed = true;
                }

                if (!connected)
                {
                    _lastL3PressedAt[slot] = 0;
                    _lastR3PressedAt[slot] = 0;
                    _mouseChordLatched[slot] = false;
                    _taskSwitcherChordLatched[slot] = false;
                    _guideReturnArmed[slot] = false;
                    _guideConsumedByTaskSwitcher[slot] = false;
                    _guideReturnDispatched[slot] = false;
                    _guidePressedAt[slot] = 0;
                }

                _previous[slot] = current;
                _previousNative[slot] = currentNative;
                _previousLeftTrigger[slot] = currentLeftTrigger;
                _previousRightTrigger[slot] = currentRightTrigger;
            }

            _connectedMask = snapshot.ConnectedMask;
            _initialized = true;
        }

        internal bool AnyPressed(ushort mask) => (PressedButtons & mask) != 0;

        internal bool AnyPhysicalPressed(ushort mask) => (PhysicalPressedButtons & mask) != 0;

        internal bool ReleasedGlobally(ushort mask) =>
            (PreviousHeldButtons & mask) != 0 && (HeldButtons & mask) == 0;

        internal bool AnyPredicateJustPressed(Func<ushort, bool> predicate)
        {
            for (int slot = 0; slot < XInputControllerHub.SlotCount; slot++)
            {
                if (predicate(_frameCurrent[slot]) && !predicate(_framePrevious[slot]))
                    return true;
            }
            return false;
        }
    }
}
