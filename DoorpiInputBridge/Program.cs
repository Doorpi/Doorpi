using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;

namespace DoorpiInputBridge
{
    internal static class Program
    {
        private const uint INPUT_MOUSE = 0;
        private const uint INPUT_KEYBOARD = 1;
        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const uint KEYEVENTF_UNICODE = 0x0004;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT
        {
            public uint type;
            public InputUnion U;
            public static int Size => Marshal.SizeOf(typeof(INPUT));
        }

        [StructLayout(LayoutKind.Explicit)]
        private struct InputUnion
        {
            [FieldOffset(0)] public MOUSEINPUT mi;
            [FieldOffset(0)] public KEYBDINPUT ki;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MOUSEINPUT
        {
            public int dx;
            public int dy;
            public uint mouseData;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [STAThread]
        private static int Main(string[] args)
        {
            if (args.Length == 0 || string.IsNullOrWhiteSpace(args[0]))
                return 2;

            try
            {
                using var pipe = new NamedPipeClientStream(".", args[0], PipeDirection.In);
                pipe.Connect(60000);

                using var reader = new StreamReader(pipe, Encoding.UTF8, detectEncodingFromByteOrderMarks: false);
                string? line;
                while ((line = reader.ReadLine()) != null)
                {
                    if (line == "exit") return 0;
                    HandleCommand(line);
                }

                return 0;
            }
            catch
            {
                return 1;
            }
        }

        private static void HandleCommand(string line)
        {
            string[] parts = line.Split('|');
            if (parts.Length == 0) return;

            if (parts[0] == "mouse" && parts.Length >= 5 &&
                int.TryParse(parts[1], out int dx) &&
                int.TryParse(parts[2], out int dy) &&
                uint.TryParse(parts[3], out uint flags) &&
                uint.TryParse(parts[4], out uint data))
            {
                SendMouse(dx, dy, flags, data);
                return;
            }

            if (parts[0] == "key" && parts.Length >= 2 &&
                ushort.TryParse(parts[1], out ushort vk))
            {
                SendVirtualKey(vk);
                return;
            }

            if (parts[0] == "unicode" && parts.Length >= 2)
            {
                try
                {
                    string text = Encoding.UTF8.GetString(Convert.FromBase64String(parts[1]));
                    SendUnicodeString(text);
                }
                catch { }
            }
        }

        private static void SendMouse(int dx, int dy, uint flags, uint data)
        {
            var input = new INPUT { type = INPUT_MOUSE };
            input.U.mi = new MOUSEINPUT { dx = dx, dy = dy, dwFlags = flags, mouseData = data };
            SendInput(1, new[] { input }, INPUT.Size);
        }

        private static void SendVirtualKey(ushort vk)
        {
            var down = new INPUT { type = INPUT_KEYBOARD };
            down.U.ki = new KEYBDINPUT { wVk = vk };

            var up = new INPUT { type = INPUT_KEYBOARD };
            up.U.ki = new KEYBDINPUT { wVk = vk, dwFlags = KEYEVENTF_KEYUP };

            SendInput(2, new[] { down, up }, INPUT.Size);
        }

        private static void SendUnicodeString(string text)
        {
            var inputs = new List<INPUT>();
            foreach (char c in text)
            {
                var down = new INPUT { type = INPUT_KEYBOARD };
                down.U.ki = new KEYBDINPUT { wScan = c, dwFlags = KEYEVENTF_UNICODE };
                inputs.Add(down);

                var up = new INPUT { type = INPUT_KEYBOARD };
                up.U.ki = new KEYBDINPUT { wScan = c, dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP };
                inputs.Add(up);
            }

            if (inputs.Count > 0)
                SendInput((uint)inputs.Count, inputs.ToArray(), INPUT.Size);
        }
    }
}
