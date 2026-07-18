using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Requests;
using Google.Apis.Auth.OAuth2.Responses;
using Microsoft.Win32;

namespace Doorpi.ProfileSync;

public sealed class DoorpiGoogleCodeReceiver : ICodeReceiver, IDisposable
{
    private readonly TcpListener _listener;
    private readonly Action? _onAuthorizationCompleted;
    private BrowserWindowSession? _browserWindow;
    private int _disposed;

    public DoorpiGoogleCodeReceiver(Action? onAuthorizationCompleted = null)
    {
        _onAuthorizationCompleted = onAuthorizationCompleted;
        _listener = new TcpListener(IPAddress.Loopback, 0);
        _listener.Start(1);
        int port = ((IPEndPoint)_listener.LocalEndpoint).Port;
        RedirectUri = $"http://127.0.0.1:{port}/authorize/";
    }

    public string RedirectUri { get; }

    public async Task<AuthorizationCodeResponseUrl> ReceiveCodeAsync(
        AuthorizationCodeRequestUrl url,
        CancellationToken taskCancellationToken)
    {
        ObjectDisposedException.ThrowIf(Volatile.Read(ref _disposed) != 0, this);
        Uri authorizationUri = url.Build();
        _browserWindow = await BrowserWindowSession.OpenAsync(
            authorizationUri.AbsoluteUri,
            taskCancellationToken).ConfigureAwait(false);

        try
        {
            using TcpClient client = await _listener.AcceptTcpClientAsync(taskCancellationToken)
                .ConfigureAwait(false);
            await using NetworkStream stream = client.GetStream();
            string requestTarget = await ReadRequestTargetAsync(stream, taskCancellationToken).ConfigureAwait(false);
            Uri redirect = new(RedirectUri);
            Uri callback = new(redirect, requestTarget);
            if (!string.Equals(callback.Scheme, redirect.Scheme, StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(callback.Host, redirect.Host, StringComparison.OrdinalIgnoreCase) ||
                callback.Port != redirect.Port ||
                !string.Equals(callback.AbsolutePath, redirect.AbsolutePath, StringComparison.Ordinal))
                throw new InvalidDataException("Callback OAuth inválido.");

            string expectedState = QueryValue(authorizationUri.Query, "state");
            string returnedState = QueryValue(callback.Query, "state");
            if (!string.IsNullOrWhiteSpace(expectedState) &&
                !string.Equals(expectedState, returnedState, StringComparison.Ordinal))
                throw new InvalidDataException("O estado do callback OAuth não corresponde à solicitação.");

            await WriteCompletionPageAsync(stream, taskCancellationToken).ConfigureAwait(false);
            await Task.Delay(250, taskCancellationToken).ConfigureAwait(false);
            await _browserWindow.CloseAsync().ConfigureAwait(false);
            try { _onAuthorizationCompleted?.Invoke(); } catch { }
            return new AuthorizationCodeResponseUrl(callback.Query.TrimStart('?'));
        }
        finally
        {
            _listener.Stop();
            await _browserWindow.CloseAsync().ConfigureAwait(false);
        }
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        try { _listener.Stop(); } catch { }
        _browserWindow?.Dispose();
    }

    private static async Task<string> ReadRequestTargetAsync(
        NetworkStream stream,
        CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(
            stream,
            Encoding.ASCII,
            detectEncodingFromByteOrderMarks: false,
            bufferSize: 4096,
            leaveOpen: true);
        string? requestLine = await reader.ReadLineAsync(cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(requestLine))
            throw new InvalidDataException("Callback OAuth vazio.");

        string[] parts = requestLine.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2 || !string.Equals(parts[0], "GET", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Método de callback OAuth inválido.");

        string? line;
        do
        {
            line = await reader.ReadLineAsync(cancellationToken).ConfigureAwait(false);
        } while (!string.IsNullOrEmpty(line));
        return parts[1];
    }

    private static async Task WriteCompletionPageAsync(
        NetworkStream stream,
        CancellationToken cancellationToken)
    {
        bool portuguese = CultureInfo.CurrentUICulture.Name.StartsWith("pt", StringComparison.OrdinalIgnoreCase);
        string title = portuguese ? "Autorização concluída" : "Authorization complete";
        string message = portuguese ? "Retornando ao Doorpi..." : "Returning to Doorpi...";
        string html = $$"""
            <!doctype html><html><head><meta charset="utf-8"><title>{{title}}</title>
            <style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#090d16;color:#f4f7fb;font:18px Segoe UI,sans-serif}main{text-align:center}p{opacity:.7}</style>
            </head><body><main><strong>{{title}}</strong><p>{{message}}</p></main><script>setTimeout(()=>window.close(),50);</script></body></html>
            """;
        byte[] body = Encoding.UTF8.GetBytes(html);
        string headers = "HTTP/1.1 200 OK\r\n" +
                         "Content-Type: text/html; charset=utf-8\r\n" +
                         $"Content-Length: {body.Length}\r\n" +
                         "Cache-Control: no-store\r\n" +
                         "Connection: close\r\n\r\n";
        byte[] headerBytes = Encoding.ASCII.GetBytes(headers);
        await stream.WriteAsync(headerBytes, cancellationToken).ConfigureAwait(false);
        await stream.WriteAsync(body, cancellationToken).ConfigureAwait(false);
        await stream.FlushAsync(cancellationToken).ConfigureAwait(false);
    }

    private static string QueryValue(string query, string key)
    {
        foreach (string pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            int separator = pair.IndexOf('=');
            string name = separator >= 0 ? pair[..separator] : pair;
            if (!string.Equals(WebUtility.UrlDecode(name), key, StringComparison.Ordinal)) continue;
            string value = separator >= 0 ? pair[(separator + 1)..] : "";
            return WebUtility.UrlDecode(value);
        }
        return "";
    }
}

internal sealed class BrowserWindowSession : IDisposable
{
    private readonly string _processName;
    private readonly HashSet<nint> _windowsBeforeLaunch;
    private readonly Task<nint> _windowHandleTask;
    private readonly bool _canClose;
    private int _closed;

    private BrowserWindowSession(
        string processName,
        HashSet<nint> windowsBeforeLaunch,
        Task<nint> windowHandleTask,
        bool canClose)
    {
        _processName = processName;
        _windowsBeforeLaunch = windowsBeforeLaunch;
        _windowHandleTask = windowHandleTask;
        _canClose = canClose;
    }

    public static Task<BrowserWindowSession> OpenAsync(string url, CancellationToken cancellationToken)
    {
        BrowserLaunchInfo browser = BrowserLaunchInfo.Resolve();
        if (browser.UseShellFallback)
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true })?.Dispose();
            return Task.FromResult(new BrowserWindowSession(
                "",
                new HashSet<nint>(),
                Task.FromResult<nint>(0),
                canClose: false));
        }

        HashSet<nint> existingWindows = CaptureWindows(browser.ProcessName);
        var startInfo = new ProcessStartInfo(browser.ExecutablePath)
        {
            UseShellExecute = false
        };
        startInfo.ArgumentList.Add(browser.NewWindowArgument);
        startInfo.ArgumentList.Add(url);
        Process.Start(startInfo)?.Dispose();

        Task<nint> handleTask = FindNewWindowAsync(
            browser.ProcessName,
            existingWindows,
            cancellationToken);
        return Task.FromResult(new BrowserWindowSession(
            browser.ProcessName,
            existingWindows,
            handleTask,
            canClose: true));
    }

    public async Task CloseAsync()
    {
        if (Interlocked.Exchange(ref _closed, 1) != 0) return;
        if (!_canClose) return;
        nint handle;
        try { handle = await _windowHandleTask.WaitAsync(TimeSpan.FromSeconds(2)).ConfigureAwait(false); }
        catch { handle = FindLargestNewWindow(_processName, _windowsBeforeLaunch); }
        if (handle != 0 && IsWindow(handle))
        {
            PostMessage(handle, WmClose, 0, 0);
            for (int attempt = 0; attempt < 25 && IsWindow(handle); attempt++)
                await Task.Delay(40).ConfigureAwait(false);
        }
    }

    public void Dispose() => _ = CloseAsync();

    private static async Task<nint> FindNewWindowAsync(
        string processName,
        HashSet<nint> existingWindows,
        CancellationToken cancellationToken)
    {
        for (int attempt = 0; attempt < 150; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            nint handle = FindLargestNewWindow(processName, existingWindows);
            if (handle != 0) return handle;
            await Task.Delay(100, cancellationToken).ConfigureAwait(false);
        }
        return 0;
    }

    private static nint FindLargestNewWindow(string processName, HashSet<nint> existingWindows)
        => CaptureWindowAreas(processName)
            .Where(item => !existingWindows.Contains(item.Handle))
            .OrderByDescending(item => item.Area)
            .Select(item => item.Handle)
            .FirstOrDefault();

    private static HashSet<nint> CaptureWindows(string processName)
        => CaptureWindowAreas(processName).Select(item => item.Handle).ToHashSet();

    private static List<(nint Handle, long Area)> CaptureWindowAreas(string processName)
    {
        var windows = new List<(nint, long)>();
        EnumWindows((handle, _) =>
        {
            if (!IsWindowVisible(handle)) return true;
            GetWindowThreadProcessId(handle, out uint processId);
            try
            {
                using Process process = Process.GetProcessById((int)processId);
                if (!string.Equals(process.ProcessName, processName, StringComparison.OrdinalIgnoreCase)) return true;
                if (!GetWindowRect(handle, out Rect rect)) return true;
                long width = Math.Max(0, rect.Right - rect.Left);
                long height = Math.Max(0, rect.Bottom - rect.Top);
                if (width >= 320 && height >= 240) windows.Add((handle, width * height));
            }
            catch { }
            return true;
        }, 0);
        return windows;
    }

    private const uint WmClose = 0x0010;
    private delegate bool EnumWindowsProc(nint hwnd, nint lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, nint lParam);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(nint hwnd);

    [DllImport("user32.dll")]
    private static extern bool IsWindow(nint hwnd);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(nint hwnd, out uint processId);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(nint hwnd, out Rect rect);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(nint hwnd, uint message, nint wParam, nint lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}

internal sealed record BrowserLaunchInfo(
    string ExecutablePath,
    string ProcessName,
    string NewWindowArgument,
    bool UseShellFallback = false)
{
    public static BrowserLaunchInfo Resolve()
    {
        string? executable = TryGetDefaultBrowserExecutable();
        BrowserLaunchInfo? supported = FromExecutable(executable);
        if (supported != null) return supported;

        foreach (string edge in EdgeCandidates())
        {
            supported = FromExecutable(edge);
            if (supported != null && File.Exists(supported.ExecutablePath)) return supported;
        }

        return new BrowserLaunchInfo("", "", "", UseShellFallback: true);
    }

    private static BrowserLaunchInfo? FromExecutable(string? executable)
    {
        if (string.IsNullOrWhiteSpace(executable) || !File.Exists(executable)) return null;
        string browserPath = executable;
        string processName = Path.GetFileNameWithoutExtension(browserPath);
        string argument = processName.Equals("firefox", StringComparison.OrdinalIgnoreCase)
            ? "-new-window"
            : "--new-window";
        string[] supported = { "msedge", "chrome", "brave", "vivaldi", "opera", "firefox" };
        return supported.Contains(processName, StringComparer.OrdinalIgnoreCase)
            ? new BrowserLaunchInfo(browserPath, processName, argument)
            : null;
    }

    private static string? TryGetDefaultBrowserExecutable()
    {
        try
        {
            using RegistryKey? choice = Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice");
            string? progId = choice?.GetValue("ProgId") as string;
            if (string.IsNullOrWhiteSpace(progId)) return null;
            using RegistryKey? commandKey = Registry.ClassesRoot.OpenSubKey($@"{progId}\shell\open\command");
            string? command = commandKey?.GetValue(null) as string;
            return ExtractExecutable(command);
        }
        catch { return null; }
    }

    private static string? ExtractExecutable(string? command)
    {
        if (string.IsNullOrWhiteSpace(command)) return null;
        command = Environment.ExpandEnvironmentVariables(command.Trim());
        if (command.StartsWith('"'))
        {
            int closingQuote = command.IndexOf('"', 1);
            return closingQuote > 1 ? command[1..closingQuote] : null;
        }
        int exeEnd = command.IndexOf(".exe", StringComparison.OrdinalIgnoreCase);
        return exeEnd >= 0 ? command[..(exeEnd + 4)].Trim() : null;
    }

    private static IEnumerable<string> EdgeCandidates()
    {
        string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        yield return Path.Combine(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe");
        yield return Path.Combine(programFiles, "Microsoft", "Edge", "Application", "msedge.exe");
    }
}
