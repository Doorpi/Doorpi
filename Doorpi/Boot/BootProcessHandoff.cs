using System;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

namespace Doorpi;

internal static class BootProcessHandoff
{
    internal const string ArgumentPrefix = "--doorpi-wait-parent=";

    internal static async Task<bool> WaitAsync(string[] args)
    {
        var values = args.Where(arg => arg.StartsWith(ArgumentPrefix, StringComparison.OrdinalIgnoreCase)).ToArray();
        if (values.Length == 0) return true;
        if (values.Length != 1 || !int.TryParse(values[0][ArgumentPrefix.Length..], out int pid) || pid <= 0 || pid == Environment.ProcessId)
            return false;
        try
        {
            using var parent = Process.GetProcessById(pid);
            using var current = Process.GetCurrentProcess();
            if (parent.SessionId != current.SessionId ||
                !string.Equals(parent.MainModule?.FileName, current.MainModule?.FileName, StringComparison.OrdinalIgnoreCase)) return false;
            await parent.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10));
            return true;
        }
        catch (ArgumentException) { return true; } // Parent already exited.
        catch (Exception ex) when (ex is TimeoutException or InvalidOperationException or System.ComponentModel.Win32Exception)
        { return false; }
    }
}
