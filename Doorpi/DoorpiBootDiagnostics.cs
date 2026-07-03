using Microsoft.Win32;
using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;

namespace Doorpi
{
    internal static class DoorpiBootDiagnostics
    {
        private const string WinlogonKey = @"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon";
        private const string RunKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";

        public static bool ShouldAbortCurrentSession(out string reason)
        {
            reason = "";

            int sessionId = GetCurrentSessionId();
            if (sessionId == 0)
            {
                reason = "session-0";
                return true;
            }

            if (!Environment.UserInteractive)
            {
                reason = "non-interactive-session";
                return true;
            }

            return false;
        }

        public static void CleanupReleaseLogs()
        {
#if DEBUG
            return;
#else
            try
            {
                string dir = DoorpiPaths.LogsFolder;
                if (!Directory.Exists(dir))
                    return;

                foreach (string file in Directory.EnumerateFiles(dir, "*.log", SearchOption.TopDirectoryOnly))
                {
                    try { File.Delete(file); } catch { }
                }
            }
            catch { }
#endif
        }

        public static void Log(string stage, string extra = "")
        {
#if !DEBUG
            return;
#else
            try
            {
                string dir = DoorpiPaths.LogsFolder;
                Directory.CreateDirectory(dir);
                string path = Path.Combine(dir, "boot-diagnostics.log");
                RotateIfNeeded(path);

                File.AppendAllText(path, BuildLine(stage, extra), Encoding.UTF8);
            }
            catch { }
#endif
        }

        private static string BuildLine(string stage, string extra)
        {
            var process = Process.GetCurrentProcess();
            string identityName = Safe(() => WindowsIdentity.GetCurrent()?.Name ?? "", "");
            string processPath = Safe(() => process.MainModule?.FileName ?? "", "");
            string commandLine = Safe(() => Environment.CommandLine, "");
            string baseDir = Safe(() => AppDomain.CurrentDomain.BaseDirectory, "");

            string hkcuShell = ReadRegistryValue(RegistryHive.CurrentUser, RegistryView.Default, WinlogonKey, "Shell");
            string hkcuRun = ReadRegistryValue(RegistryHive.CurrentUser, RegistryView.Default, RunKey, "Doorpi");
            string hklmShell64 = ReadRegistryValue(RegistryHive.LocalMachine, RegistryView.Registry64, WinlogonKey, "Shell");
            string hklmShell32 = ReadRegistryValue(RegistryHive.LocalMachine, RegistryView.Registry32, WinlogonKey, "Shell");
            string hklmRun64 = ReadRegistryValue(RegistryHive.LocalMachine, RegistryView.Registry64, RunKey, "Doorpi");
            string hklmRun32 = ReadRegistryValue(RegistryHive.LocalMachine, RegistryView.Registry32, RunKey, "Doorpi");

            return
                $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {stage} " +
                $"pid={process.Id} session={GetCurrentSessionId()} interactive={Environment.UserInteractive} " +
                $"locked={IsWorkstationLocked()} " +
                $"user={Environment.UserDomainName}\\{Environment.UserName} identity={identityName} " +
                $"is64proc={Environment.Is64BitProcess} is64os={Environment.Is64BitOperatingSystem} " +
                $"exe={Quote(processPath)} base={Quote(baseDir)} cwd={Quote(Environment.CurrentDirectory)} " +
                $"cmd={Quote(commandLine)} " +
                $"explorer={Quote(DescribeProcesses("explorer"))} doorpi={Quote(DescribeProcesses("Doorpi"))} " +
                $"webview2={Quote(DescribeProcesses("msedgewebview2"))} edge={Quote(DescribeProcesses("msedge"))} edgeUpdate={Quote(DescribeProcesses("MicrosoftEdgeUpdate"))} " +
                $"webview2Runtime={Quote(DescribeWebView2Runtime())} edgeServices={Quote(DescribeEdgeServices())} " +
                $"hkcuShell={Quote(hkcuShell)} hkcuRun={Quote(hkcuRun)} " +
                $"hklmShell64={Quote(hklmShell64)} hklmShell32={Quote(hklmShell32)} " +
                $"hklmRun64={Quote(hklmRun64)} hklmRun32={Quote(hklmRun32)} " +
                $"startup={Quote(DescribeStartupFolder(Environment.SpecialFolder.Startup))} " +
                $"commonStartup={Quote(DescribeStartupFolder(Environment.SpecialFolder.CommonStartup))} " +
                $"extra={Quote(extra)}{Environment.NewLine}";
        }

        private static int GetCurrentSessionId()
        {
            try { return Process.GetCurrentProcess().SessionId; }
            catch { return -1; }
        }

        private static string ReadRegistryValue(RegistryHive hive, RegistryView view, string subKey, string name)
        {
            try
            {
                using var root = RegistryKey.OpenBaseKey(hive, view);
                using var key = root.OpenSubKey(subKey);
                return key?.GetValue(name)?.ToString() ?? "";
            }
            catch
            {
                return "";
            }
        }

        private static string DescribeProcesses(string processName)
        {
            try
            {
                return string.Join(",",
                    Process.GetProcessesByName(processName)
                        .OrderBy(p => Safe(() => p.SessionId, -1))
                        .ThenBy(p => Safe(() => p.Id, 0))
                        .Select(p => $"{Safe(() => p.Id, 0)}:s{Safe(() => p.SessionId, -1)}"));
            }
            catch
            {
                return "";
            }
        }

        private static string DescribeStartupFolder(Environment.SpecialFolder folder)
        {
            try
            {
                string path = Environment.GetFolderPath(folder);
                if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
                    return "";

                var entries = Directory.GetFiles(path)
                    .Select(Path.GetFileName)
                    .Where(name => name?.IndexOf("Doorpi", StringComparison.OrdinalIgnoreCase) >= 0)
                    .ToArray();
                return string.Join(",", entries);
            }
            catch
            {
                return "";
            }
        }

        private static string DescribeWebView2Runtime()
        {
            const string runtimeKey = @"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
            var parts = new[]
            {
                "hklm64=" + ReadRegistryValue(RegistryHive.LocalMachine, RegistryView.Registry64, runtimeKey, "pv"),
                "hklm32=" + ReadRegistryValue(RegistryHive.LocalMachine, RegistryView.Registry32, runtimeKey, "pv"),
                "hkcu=" + ReadRegistryValue(RegistryHive.CurrentUser, RegistryView.Default, runtimeKey, "pv")
            };
            return string.Join(";", parts);
        }

        private static string DescribeEdgeServices()
        {
            string[] serviceNames =
            {
                "edgeupdate",
                "edgeupdatem",
                "MicrosoftEdgeElevationService"
            };

            return string.Join(";",
                serviceNames.Select(name =>
                    name + "=" + ReadRegistryValue(
                        RegistryHive.LocalMachine,
                        RegistryView.Registry64,
                        $@"SYSTEM\CurrentControlSet\Services\{name}",
                        "Start")));
        }

        private static void RotateIfNeeded(string path)
        {
            try
            {
                if (!File.Exists(path) || new FileInfo(path).Length <= 512 * 1024)
                    return;

                string oldPath = Path.Combine(Path.GetDirectoryName(path) ?? "", "boot-diagnostics.old.log");
                try { if (File.Exists(oldPath)) File.Delete(oldPath); } catch { }
                try { File.Move(path, oldPath); } catch { File.WriteAllText(path, ""); }
            }
            catch { }
        }

        private static string Quote(string value)
        {
            if (string.IsNullOrEmpty(value)) return "\"\"";
            return "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", " ").Replace("\n", " ") + "\"";
        }

        public static bool IsWorkstationLocked()
        {
            IntPtr desktop = IntPtr.Zero;
            try
            {
                desktop = OpenInputDesktop(0, false, DESKTOP_SWITCHDESKTOP);
                if (desktop == IntPtr.Zero)
                    return false;

                return !SwitchDesktop(desktop);
            }
            catch
            {
                return false;
            }
            finally
            {
                if (desktop != IntPtr.Zero)
                    CloseDesktop(desktop);
            }
        }

        private static T Safe<T>(Func<T> action, T fallback)
        {
            try { return action(); }
            catch { return fallback; }
        }

        private const uint DESKTOP_SWITCHDESKTOP = 0x0100;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SwitchDesktop(IntPtr hDesktop);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool CloseDesktop(IntPtr hDesktop);
    }
}
