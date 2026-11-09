using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;

namespace Doorpi;

// Per-attempt, session-local handles: stale signals from an earlier process cannot
// release a later startup. No files, global environment edits or elevated service.
internal sealed class BootSessionSignals : IDisposable
{
    internal const string TokenVariable = "DOORPI_BOOT_TOKEN";
    internal const string ParentVariable = "DOORPI_BOOT_PARENT";
    internal const string SkipIntroVariable = "DOORPI_BOOT_SKIP_INTRO";
    internal string Token { get; }
    internal EventWaitHandle Presentation { get; }
    internal EventWaitHandle Released { get; }
    internal EventWaitHandle Ready { get; }
    internal EventWaitHandle Restart { get; }
    internal EventWaitHandle Detach { get; }

    internal BootSessionSignals()
    {
        Token = Guid.NewGuid().ToString("N");
        Presentation = Create("Presentation");
        Released = Create("Released");
        Ready = Create("Ready");
        Restart = Create("Restart");
        Detach = Create("Detach");
    }

    private EventWaitHandle Create(string suffix) => new(false, EventResetMode.ManualReset, Name(Token, suffix));
    internal static string Name(string token, string suffix) => $@"Local\Doorpi.Boot.{token}.{suffix}";
    internal void Configure(ProcessStartInfo start, bool skipIntro)
    {
        BootStartupTrace.ConfigureChild(start);
        start.Environment[TokenVariable] = Token;
        start.Environment[ParentVariable] = Environment.ProcessId.ToString();
        start.Environment[SkipIntroVariable] = skipIntro ? "1" : "0";
    }
    public void Dispose()
    {
        Presentation.Dispose(); Released.Dispose(); Ready.Dispose(); Restart.Dispose(); Detach.Dispose();
    }
}

internal static class BootSessionClient
{
    private static readonly string? Token = ReadToken();
    internal static InProcessBootSession? InProcess { get; set; }
    internal static bool IsManaged => Token != null;
    internal static bool IsPresentationManaged => IsManaged || InProcess != null;
    internal static bool SkipIntro => Array.Exists(Environment.GetCommandLineArgs(), a => a == "--doorpi-resume-session" || a == "--doorpi-webview-recovery") ||
        (IsManaged && Environment.GetEnvironmentVariable(BootSessionSignals.SkipIntroVariable) == "1") || InProcess?.SkipIntro == true;

    private static string? ReadToken()
    {
        try
        {
            if (!Array.Exists(Environment.GetCommandLineArgs(), a => a == "--doorpi-main")) return null;
            string? token = Environment.GetEnvironmentVariable(BootSessionSignals.TokenVariable);
            if (!Guid.TryParseExact(token, "N", out _)) return null;
            if (!int.TryParse(Environment.GetEnvironmentVariable(BootSessionSignals.ParentVariable), out int pid)) return null;
            using var parent = Process.GetProcessById(pid);
            using var current = Process.GetCurrentProcess();
            if (parent.HasExited || parent.SessionId != current.SessionId ||
                !string.Equals(parent.MainModule?.FileName, current.MainModule?.FileName, StringComparison.OrdinalIgnoreCase)) return null;
            return token;
        }
        catch { return null; }
    }

    private static bool Signal(string suffix)
    {
        if (Token == null) return false;
        try { using var signal = EventWaitHandle.OpenExisting(BootSessionSignals.Name(Token, suffix)); return signal.Set(); }
        catch (WaitHandleCannotBeOpenedException) { return false; }
        catch (UnauthorizedAccessException) { return false; }
    }
    internal static void PresentationPrepared() { if (InProcess != null) InProcess.MarkPrepared(); else Signal("Presentation"); }
    internal static void InteractiveReady() { if (InProcess != null) InProcess.MarkReady(); else Signal("Ready"); }
    internal static bool RequestRestart() => Signal("Restart");
    internal static bool IsPresentationReleased()
    {
        if (InProcess != null) return InProcess.Released;
        if (Token == null) return true;
        try { using var signal = EventWaitHandle.OpenExisting(BootSessionSignals.Name(Token, "Released")); return signal.WaitOne(0); }
        catch (WaitHandleCannotBeOpenedException) { return true; } // Parent is gone; never strand the intro.
        catch (UnauthorizedAccessException) { return true; }
    }

    internal static async Task DetachForUpdateAsync()
    {
        if (!IsManaged || !Signal("Detach")) return;
        if (!int.TryParse(Environment.GetEnvironmentVariable(BootSessionSignals.ParentVariable), out int pid)) return;
        try
        {
            using var parent = Process.GetProcessById(pid);
            await parent.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10));
        }
        catch (ArgumentException) { } // Already exited.
    }
}
