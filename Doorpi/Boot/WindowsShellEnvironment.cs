using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

namespace Doorpi;

internal static class WindowsShellEnvironment
{
    internal static bool IsExplorerRunning()
    {
        int session = Process.GetCurrentProcess().SessionId;
        foreach (var process in Process.GetProcessesByName("explorer"))
        {
            using (process)
            {
                try { if (process.SessionId == session && !process.HasExited) return true; }
                catch (InvalidOperationException) { }
                catch (System.ComponentModel.Win32Exception) { }
            }
        }
        return false;
    }

    internal static void EnsureExplorerStarted()
    {
        if (IsExplorerRunning()) return;
        Process.Start(new ProcessStartInfo
        {
            FileName = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "explorer.exe"),
            UseShellExecute = true
        })?.Dispose();
    }

    internal static async Task<bool> WaitUntilReadyAsync(TimeSpan timeout)
    {
        var elapsed = Stopwatch.StartNew();
        long readySince = -1;
        while (elapsed.Elapsed < timeout)
        {
            bool ready = IsExplorerRunning() && (FindWindow("Shell_TrayWnd", null) != IntPtr.Zero || GetShellWindow() != IntPtr.Zero);
            if (ready)
            {
                if (readySince < 0) readySince = elapsed.ElapsedMilliseconds;
                if (elapsed.ElapsedMilliseconds - readySince >= 700) return true;
            }
            else readySince = -1;
            await Task.Delay(100);
        }
        return false;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr FindWindow(string className, string? windowName);
    [DllImport("user32.dll")] private static extern IntPtr GetShellWindow();
}
