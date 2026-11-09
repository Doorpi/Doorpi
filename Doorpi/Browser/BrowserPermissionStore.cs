using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using Doorpi.Storage;

namespace Doorpi;

internal enum BrowserPermissionResource { Camera, Microphone }

internal sealed record BrowserPermissionDecision
{
    public string Id { get; init; } = "";
    public string UserId { get; init; } = "";
    public string AppKey { get; init; } = "";
    public string AppName { get; init; } = "";
    public string Origin { get; init; } = "";
    [JsonRequired] public BrowserPermissionResource Resource { get; init; }
    [JsonRequired] public bool Allowed { get; init; }
}

// Doorpi owns decisions rather than persisting grants in a potentially shared
// Chromium profile. Every request must still pass the current app/user policy.
internal sealed class BrowserPermissionStore
{
    private sealed class Document
    {
        [JsonRequired] public int SchemaVersion { get; set; } = 1;
        [JsonRequired] public List<BrowserPermissionDecision> Decisions { get; set; } = new();
    }

    private readonly object _sync = new();
    private readonly string _path;
    private List<BrowserPermissionDecision>? _decisions;
    private long _revision;
    internal BrowserPermissionStore(string path) => _path = path;

    internal static string? NormalizeOrigin(string? value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            (uri.Scheme != Uri.UriSchemeHttps && !(uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback)))
            return null;
        return new UriBuilder(uri.Scheme, uri.IdnHost, uri.IsDefaultPort ? -1 : uri.Port)
            .Uri.GetLeftPart(UriPartial.Authority);
    }

    internal BrowserPermissionDecision? Find(string userId, string appKey, string origin, BrowserPermissionResource resource)
    {
        lock (_sync)
            return Load().FirstOrDefault(item => Matches(item, userId, appKey, origin, resource));
    }

    internal BrowserPermissionDecision[] List(string userId)
    {
        lock (_sync)
            return Load().Where(item => item.UserId == userId).OrderBy(item => item.AppName)
                .ThenBy(item => item.Origin).ThenBy(item => item.Resource).ToArray();
    }

    internal void Save(string userId, string appKey, string appName, string origin, BrowserPermissionResource resource, bool allowed)
    {
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(appKey) ||
            string.IsNullOrEmpty(origin) || NormalizeOrigin(origin) != origin || !Enum.IsDefined(resource))
            throw new ArgumentException("Invalid browser permission identity.");
        lock (_sync)
        {
            var next = Load().Where(item => !Matches(item, userId, appKey, origin, resource)).ToList();
            next.Add(new BrowserPermissionDecision
            {
                Id = Guid.NewGuid().ToString("N"), UserId = userId, AppKey = appKey,
                AppName = appName, Origin = origin, Resource = resource, Allowed = allowed
            });
            Persist(next);
        }
    }

    internal BrowserPermissionDecision? Revoke(string userId, string id)
    {
        lock (_sync)
        {
            var found = Load().FirstOrDefault(item => item.UserId == userId && item.Id == id);
            if (found == null) return null;
            Persist(Load().Where(item => item != found).ToList());
            return found;
        }
    }

    private List<BrowserPermissionDecision> Load()
    {
        bool managed = StateStorage.HandlesPath(_path);
        StorageSnapshot? snapshot = managed ? StateStorage.ReadSnapshot(new[] { _path }) : null;
        long revision = snapshot?.Revisions[_path] ?? 0;
        if (_decisions != null && (!managed || revision == _revision)) return _decisions;
        _revision = revision;
        string? content = managed ? snapshot!.Documents[_path] : StateStorage.Exists(_path) ? StateStorage.ReadAllText(_path) : null;
        if (content == null) return _decisions = new();
        var document = JsonSerializer.Deserialize<Document>(content);
        if (document?.SchemaVersion != 1 || document.Decisions == null)
            throw new InvalidDataException("Unsupported browser permission store.");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var keys = new HashSet<(string, string, string, BrowserPermissionResource)>();
        foreach (var item in document.Decisions)
        {
            if (item == null || !Guid.TryParseExact(item.Id, "N", out _) ||
                string.IsNullOrWhiteSpace(item.UserId) || string.IsNullOrWhiteSpace(item.AppKey) ||
                string.IsNullOrEmpty(item.Origin) || NormalizeOrigin(item.Origin) != item.Origin || !Enum.IsDefined(item.Resource) ||
                !ids.Add(item.Id) || !keys.Add((item.UserId, item.AppKey, item.Origin, item.Resource)))
                throw new InvalidDataException("Invalid browser permission store.");
        }
        return _decisions = document.Decisions;
    }

    private void Persist(List<BrowserPermissionDecision> next)
    {
        string content = JsonSerializer.Serialize(new Document { Decisions = next });
        if (StateStorage.HandlesPath(_path))
        {
            StateStorage.WriteBatchIfRevision(new Dictionary<string, string?> { [_path] = content },
                new Dictionary<string, long> { [_path] = _revision });
            _decisions = null;
            return;
        }
        else DurableFileStore.WriteAllText(_path, content, keepBackup: true);
        _decisions = next;
    }

    private static bool Matches(BrowserPermissionDecision item, string userId, string appKey, string origin, BrowserPermissionResource resource)
        => item.UserId == userId && item.AppKey == appKey && item.Origin == origin && item.Resource == resource;
}
