using Microsoft.Web.WebView2.Core;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Doorpi;

public partial class MainWindow
{
    private readonly ConditionalWeakTable<CoreWebView2, object> _stateResourceHosts = new();

    // data.local is an explicit resource API, never a mapping of the private data directory.
    private void AttachStateResourceHost(CoreWebView2 core, bool trustedHome)
    {
        core.ClearVirtualHostNameToFolderMapping("data.local");
        if (_stateResourceHosts.TryGetValue(core, out _)) return;
        _stateResourceHosts.Add(core, new object());
        core.AddWebResourceRequestedFilter("https://data.local/*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += (_, args) =>
        {
            if (!Uri.TryCreate(args.Request.Uri, UriKind.Absolute, out var uri) || uri.Host != "data.local") return;
            try
            {
                if (args.Request.Method != "GET" && args.Request.Method != "HEAD")
                { args.Response = StateResponse(core, null, 405, "Method Not Allowed", ""); return; }
                string relative = Uri.UnescapeDataString(uri.AbsolutePath).TrimStart('/');
                bool localPage = trustedHome && Uri.TryCreate(core.Source, UriKind.Absolute, out var source) &&
                    source.Scheme == "https" && source.Host == "app.local";
                string? origin = args.Request.Headers.Contains("Origin") ? args.Request.Headers.GetHeader("Origin") : null;
                bool homeRequest = localPage && (string.IsNullOrEmpty(origin) || origin == "https://app.local");
                string name = Path.GetFileName(relative);
                if (LocalStateResourcePolicy.IsStateView(relative))
                {
                    string? path = LocalStateResourcePolicy.ResolveStateView(relative, homeRequest, currentUserId, dataFolder);
                    if (path == null)
                    { args.Response = StateResponse(core, null, 403, "Forbidden", ""); return; }
                    string content = File.Exists(path) ? File.ReadAllText(path) : name == "user.json" ? "{}" : "[]";
                    if (name.Equals("user.json", StringComparison.OrdinalIgnoreCase))
                    {
                        var user = JsonNode.Parse(content)?.AsObject() ?? new JsonObject();
                        user["HasPin"] = !string.IsNullOrEmpty(user["PinCode"]?.GetValue<string>());
                        user["HasSteamGridApiKey"] = !string.IsNullOrEmpty(user["SteamGridApiKey"]?.GetValue<string>());
                        user.Remove("PinCode"); user.Remove("SteamGridApiKey");
                        content = user.ToJsonString();
                    }
                    byte[] bytes = Encoding.UTF8.GetBytes(content);
                    args.Response = StateResponse(core, new MemoryStream(bytes), 200, "OK",
                        "Content-Type: application/json; charset=utf-8\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: https://app.local\r\n");
                    return;
                }
                string? fullPath = LocalStateResourcePolicy.ResolveAsset(relative, homeRequest, currentUserId, dataFolder);
                if (fullPath == null)
                { args.Response = StateResponse(core, null, 404, "Not Found", ""); return; }
                string dataRoot = Path.GetFullPath(dataFolder).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
                string? mime = LocalStateResourcePolicy.MimeType(fullPath);
                if (mime == null || !fullPath.StartsWith(dataRoot, StringComparison.OrdinalIgnoreCase) ||
                    !System.IO.File.Exists(fullPath) || ContainsResourceReparsePoint(fullPath, dataRoot))
                { args.Response = StateResponse(core, null, 404, "Not Found", ""); return; }
                // Stream media; do not copy videos into a managed byte array on the UI thread.
                var stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
                long length = stream.Length;
                string headers = $"Content-Type: {mime}\r\nContent-Length: {length}\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: https://app.local\r\n";
                int status = 200;
                if (args.Request.Headers.Contains("Range"))
                {
                    string range = args.Request.Headers.GetHeader("Range");
                    var parts = range.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase) ? range[6..].Split('-') : Array.Empty<string>();
                    if (parts.Length != 2 || !long.TryParse(parts[0], out long start) || start < 0 || start >= length)
                    { stream.Dispose(); args.Response = StateResponse(core, null, 416, "Range Not Satisfiable", $"Content-Range: bytes */{length}\r\n"); return; }
                    long end = string.IsNullOrEmpty(parts[1]) ? length - 1 : long.TryParse(parts[1], out long parsed) ? Math.Min(parsed, length - 1) : -1;
                    if (end < start) { stream.Dispose(); args.Response = StateResponse(core, null, 416, "Range Not Satisfiable", ""); return; }
                    stream.Position = start;
                    long count = end - start + 1;
                    headers = $"Content-Type: {mime}\r\nContent-Length: {count}\r\nContent-Range: bytes {start}-{end}/{length}\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: https://app.local\r\n";
                    args.Response = StateResponse(core, new ResourceRangeStream(stream, count), 206, "Partial Content", headers);
                    return;
                }
                args.Response = StateResponse(core, stream, status, "OK", headers);
            }
            catch (Exception ex)
            {
                DoorpiBootDiagnostics.Log("state-resource-failed", ex.GetType().Name);
                args.Response = StateResponse(core, null, 500, "Internal Server Error", "Cache-Control: no-store\r\n");
            }
        };
    }

    private static CoreWebView2WebResourceResponse StateResponse(CoreWebView2 core, Stream? stream, int status, string reason, string headers)
        => core.Environment.CreateWebResourceResponse(stream, status, reason, headers + "X-Content-Type-Options: nosniff\r\n");

    private static bool ContainsResourceReparsePoint(string fullPath, string root)
    {
        for (string? path = fullPath; path != null && path.Length >= root.TrimEnd(Path.DirectorySeparatorChar).Length; path = Path.GetDirectoryName(path))
            if ((System.IO.File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0) return true;
        return false;
    }

    private sealed class ResourceRangeStream : Stream
    {
        private readonly Stream _inner;
        private readonly long _length;
        private long _remaining;
        public ResourceRangeStream(Stream inner, long length) { _inner = inner; _length = length; _remaining = length; }
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => _length;
        public override long Position { get => _length - _remaining; set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int count)
        { int read = _inner.Read(buffer, offset, (int)Math.Min(count, _remaining)); _remaining -= read; return read; }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override void Flush() { }
        protected override void Dispose(bool disposing) { if (disposing) _inner.Dispose(); base.Dispose(disposing); }
    }
}
