using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;

namespace Doorpi
{
    internal sealed class LaunchCommandSpec
    {
        public required string FileName { get; init; }
        public required IReadOnlyList<string> Arguments { get; init; }
        public string WorkingDirectory { get; init; } = "";
    }

    internal static class LaunchCommand
    {
        private static readonly string[] ExecutableExtensions =
        {
            ".exe", ".com", ".bat", ".cmd", ".lnk", ".url"
        };

        public static bool TryParse(string? commandLine, out LaunchCommandSpec? spec)
        {
            spec = null;
            string raw = Environment.ExpandEnvironmentVariables(commandLine ?? "").Trim();
            if (string.IsNullOrWhiteSpace(raw))
                return false;

            if (TryParseExistingFilePrefix(raw, out string existingFile, out string remainder))
            {
                spec = new LaunchCommandSpec
                {
                    FileName = existingFile,
                    Arguments = ParseArguments(remainder),
                    WorkingDirectory = Path.GetDirectoryName(existingFile) ?? ""
                };
                return true;
            }

            var parts = ParseArguments(raw);
            if (parts.Count == 0 || string.IsNullOrWhiteSpace(parts[0]))
                return false;

            string fileName = Environment.ExpandEnvironmentVariables(parts[0]);
            string workingDirectory = "";
            try
            {
                if (Path.IsPathRooted(fileName))
                    workingDirectory = Path.GetDirectoryName(Path.GetFullPath(fileName)) ?? "";
            }
            catch { }

            spec = new LaunchCommandSpec
            {
                FileName = fileName,
                Arguments = parts.Skip(1).ToArray(),
                WorkingDirectory = workingDirectory
            };
            return true;
        }

        public static Process? Start(string commandLine, ProcessWindowStyle? windowStyle = null)
        {
            if (!TryParse(commandLine, out var spec) || spec == null)
                throw new InvalidOperationException("O comando de execucao esta vazio ou e invalido.");

            var startInfo = new ProcessStartInfo
            {
                FileName = spec.FileName,
                UseShellExecute = true
            };

            if (!string.IsNullOrWhiteSpace(spec.WorkingDirectory) && Directory.Exists(spec.WorkingDirectory))
                startInfo.WorkingDirectory = spec.WorkingDirectory;
            if (windowStyle.HasValue)
                startInfo.WindowStyle = windowStyle.Value;

            foreach (string argument in spec.Arguments)
                startInfo.ArgumentList.Add(argument);

            return Process.Start(startInfo);
        }

        public static string ExecutablePathOrName(string? commandLine)
            => TryParse(commandLine, out var spec) && spec != null ? spec.FileName : "";

        private static bool TryParseExistingFilePrefix(string raw, out string fileName, out string remainder)
        {
            fileName = "";
            remainder = "";

            string exact = TrimMatchingQuotes(raw);
            if (File.Exists(exact))
            {
                fileName = Path.GetFullPath(exact);
                return true;
            }

            if (raw.StartsWith('"'))
            {
                int closingQuote = FindClosingQuote(raw, 1);
                if (closingQuote > 1)
                {
                    string quoted = raw.Substring(1, closingQuote - 1);
                    if (File.Exists(quoted))
                    {
                        fileName = Path.GetFullPath(quoted);
                        remainder = raw[(closingQuote + 1)..].TrimStart();
                        return true;
                    }
                }
            }

            // Convenience for pasted Windows paths with spaces but without quotes.
            // Prefer the longest existing executable-like prefix.
            for (int i = raw.Length - 1; i >= 0; i--)
            {
                foreach (string extension in ExecutableExtensions)
                {
                    int start = i - extension.Length + 1;
                    if (start < 0 || !raw.AsSpan(start, extension.Length).Equals(extension, StringComparison.OrdinalIgnoreCase))
                        continue;

                    int end = start + extension.Length;
                    string candidate = TrimMatchingQuotes(raw[..end].Trim());
                    if (!File.Exists(candidate))
                        continue;

                    fileName = Path.GetFullPath(candidate);
                    remainder = raw[end..].TrimStart();
                    return true;
                }
            }

            return false;
        }

        private static string TrimMatchingQuotes(string value)
        {
            string trimmed = value.Trim();
            return trimmed.Length >= 2 && trimmed[0] == '"' && trimmed[^1] == '"'
                ? trimmed[1..^1]
                : trimmed;
        }

        private static int FindClosingQuote(string value, int start)
        {
            int slashCount = 0;
            for (int i = start; i < value.Length; i++)
            {
                if (value[i] == '\\')
                {
                    slashCount++;
                    continue;
                }

                if (value[i] == '"' && slashCount % 2 == 0)
                    return i;

                slashCount = 0;
            }

            return -1;
        }

        private static IReadOnlyList<string> ParseArguments(string commandLine)
        {
            if (string.IsNullOrWhiteSpace(commandLine))
                return Array.Empty<string>();

            IntPtr argv = CommandLineToArgvW(commandLine, out int argc);
            if (argv == IntPtr.Zero || argc <= 0)
                return Array.Empty<string>();

            try
            {
                var result = new string[argc];
                for (int i = 0; i < argc; i++)
                {
                    IntPtr item = Marshal.ReadIntPtr(argv, i * IntPtr.Size);
                    result[i] = Marshal.PtrToStringUni(item) ?? "";
                }
                return result;
            }
            finally
            {
                LocalFree(argv);
            }
        }

        [DllImport("shell32.dll", SetLastError = true)]
        private static extern IntPtr CommandLineToArgvW(
            [MarshalAs(UnmanagedType.LPWStr)] string lpCmdLine,
            out int pNumArgs);

        [DllImport("kernel32.dll")]
        private static extern IntPtr LocalFree(IntPtr hMem);
    }
}
