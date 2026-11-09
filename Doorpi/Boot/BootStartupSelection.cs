using System;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace Doorpi;

internal enum BootStartupPath { Supervised, Direct }

internal sealed record BootStartupSelection(BootStartupPath Path, string Source, string Issue = "")
{
    internal const string FileName = "boot-startup-experiment.json";
    internal const string ArgumentPrefix = "--doorpi-boot-path=";

    internal static bool IsShellEntry(string[] args, bool configured, bool explorerAvailable)
        => configured && !args.Any(arg => arg.Equals("--doorpi-main", StringComparison.OrdinalIgnoreCase) ||
            arg.Equals("--doorpi-webview-recovery", StringComparison.OrdinalIgnoreCase)) &&
           (!explorerAvailable || args.Any(arg => arg.Equals("--doorpi-shell-bootstrap", StringComparison.OrdinalIgnoreCase) ||
               arg.StartsWith(ArgumentPrefix, StringComparison.OrdinalIgnoreCase)));

    internal static BootStartupSelection Read(string[] args, string experimentFile)
    {
        var specified = args.Where(arg => arg.StartsWith(ArgumentPrefix, StringComparison.OrdinalIgnoreCase)).ToArray();
        if (specified.Length != 0)
        {
            if (specified.Length == 1 && TryPath(specified[0][ArgumentPrefix.Length..], out var path))
                return new(path, "argument");
            return new(BootStartupPath.Supervised, "default", "invalid-arguments");
        }
        try
        {
            if (!File.Exists(experimentFile)) return new(BootStartupPath.Supervised, "default");
            using var document = JsonDocument.Parse(File.ReadAllText(experimentFile));
            var root = document.RootElement;
            if (root.GetProperty("schemaVersion").GetInt32() == 1 &&
                TryPath(root.GetProperty("path").GetString(), out var path)) return new(path, "experiment");
            return new(BootStartupPath.Supervised, "default", "invalid-experiment");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or
            InvalidOperationException or FormatException or System.Collections.Generic.KeyNotFoundException)
        {
            return new(BootStartupPath.Supervised, "default", "unreadable-experiment");
        }
    }

    private static bool TryPath(string? value, out BootStartupPath path)
    {
        path = BootStartupPath.Supervised;
        if (string.Equals(value, "supervised", StringComparison.OrdinalIgnoreCase)) return true;
        if (!string.Equals(value, "direct", StringComparison.OrdinalIgnoreCase)) return false;
        path = BootStartupPath.Direct;
        return true;
    }
}
