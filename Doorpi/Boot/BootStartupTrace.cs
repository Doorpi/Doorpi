using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace Doorpi;

internal static class BootStartupTrace
{
    private const string EnabledVariable = "DOORPI_BOOT_TRACE";
    private const string RunVariable = "DOORPI_BOOT_TRACE_RUN";
    private static readonly object Sync = new();
    private static readonly Stopwatch Clock = Stopwatch.StartNew();
    private static Task _pending = Task.CompletedTask;
    private static volatile string? _file;
    private static int _sequence;
    private static DateTimeOffset _processStartUtc;
    internal static string RunId { get; } = Guid.TryParseExact(Environment.GetEnvironmentVariable(RunVariable), "N", out var id)
        ? id.ToString("N") : Guid.NewGuid().ToString("N");
    internal static bool Enabled => _file != null;

    internal static void Initialize(string logsFolder, bool enabled)
    {
        if (!enabled && Environment.GetEnvironmentVariable(EnabledVariable) != "1") return;
        try { using var process = Process.GetCurrentProcess(); _processStartUtc = process.StartTime.ToUniversalTime(); }
        catch { _processStartUtc = DateTimeOffset.UtcNow; }
        _file = Path.Combine(logsFolder, $"boot-trace-{RunId}-{Environment.ProcessId}.jsonl");
        Record("startup-build", JsonSerializer.Serialize(new
        {
            moduleId = typeof(BootStartupTrace).Assembly.ManifestModule.ModuleVersionId,
            framework = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription
        }));
    }
    internal static void ConfigureChild(ProcessStartInfo start)
    {
        if (!Enabled) return;
        start.Environment[EnabledVariable] = "1";
        start.Environment[RunVariable] = RunId;
    }
    internal static void Record(string stage, string detail = "")
    {
        try
        {
            lock (Sync)
            {
                if (_file == null) return;
                string file = _file;
                string line = JsonSerializer.Serialize(new
                {
                    schemaVersion = 1, runId = RunId, pid = Environment.ProcessId, sequence = ++_sequence,
                    utc = DateTimeOffset.UtcNow, processStartUtc = _processStartUtc, elapsedMs = Clock.ElapsedMilliseconds, stage,
                    detail = detail.Length <= 8192 ? detail : detail[..8192]
                }) + Environment.NewLine;
                _pending = _pending.ContinueWith(_ =>
                {
                    try
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
                        if (!File.Exists(file) || new FileInfo(file).Length < 512 * 1024) File.AppendAllText(file, line);
                    }
                    catch { } // Trace never prevents a shell from starting.
                }, TaskScheduler.Default);
            }
        }
        catch { }
    }
    internal static Task FlushAsync() { lock (Sync) return _pending; }
    internal static void RecordProcess(int pid, string kind, string stage = "startup-process-metrics")
    {
        if (!Enabled) return;
        try
        {
            using var process = Process.GetProcessById(pid);
            Record(stage, JsonSerializer.Serialize(new
            {
                processId = pid, kind, cpuMs = process.TotalProcessorTime.TotalMilliseconds,
                workingSetBytes = process.WorkingSet64, privateBytes = process.PrivateMemorySize64
            }));
        }
        catch { Record("startup-process-metrics-unavailable", $"pid={pid} kind={kind}"); }
    }
    internal static IDisposable Measure(string phase) => Enabled ? new Phase(phase) : EmptyPhase.Instance;
    private sealed class EmptyPhase : IDisposable
    {
        internal static readonly EmptyPhase Instance = new();
        public void Dispose() { }
    }
    private sealed class Phase : IDisposable
    {
        private readonly string _name;
        private readonly Stopwatch _clock = Stopwatch.StartNew();
        internal Phase(string name) { _name = name; Record("startup-phase-start", "phase=" + name); }
        public void Dispose() => Record("startup-phase-end", $"phase={_name} durationMs={_clock.ElapsedMilliseconds}");
    }
}
