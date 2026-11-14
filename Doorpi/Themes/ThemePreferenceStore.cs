using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using Doorpi.Storage;

namespace Doorpi.Themes;

internal sealed record ThemePreference(string ThemeId, long Revision, long ProfileRevision, Dictionary<string, string>? Parts = null);
internal sealed record DeviceThemePreference(string ThemeId, long Revision);

// Uses an existing SQLite-owned profile document; never creates a physical preference JSON.
internal sealed class ThemePreferenceStore(string dataFolder)
{
    private (string Settings, string User) Paths(string profileId)
    {
        if (string.IsNullOrWhiteSpace(profileId) || profileId is "." or ".." ||
            profileId.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
            throw new ArgumentException("Invalid profile identity.");
        string folder = Path.Combine(dataFolder, "users", profileId);
        string settings = Path.GetFullPath(Path.Combine(folder, "display-settings.json"));
        string user = Path.GetFullPath(Path.Combine(folder, "user.json"));
        if (!StateStorage.HandlesPath(settings) || !StateStorage.HandlesPath(user))
            throw new InvalidOperationException("Theme preferences must belong to Doorpi.Storage.");
        return (settings, user);
    }

    private static JsonObject Parse(string? text)
    {
        if (text == null) return new JsonObject();
        try
        {
            var value = JsonNode.Parse(text) as JsonObject ?? throw new InvalidDataException("Invalid profile display settings.");
            if ((value.ContainsKey("themePreferenceVersion") && value["themePreferenceVersion"] == null) ||
                (value.ContainsKey("themeId") && value["themeId"] == null))
                throw new InvalidDataException("Invalid null theme preference.");
            if (value["themePreferenceVersion"] is { } version && version.GetValue<int>() != 1)
                throw new InvalidDataException("Unsupported theme preference version.");
            if (value["themeId"] is { } id && (string.IsNullOrWhiteSpace(id.GetValue<string>()) || id.GetValue<string>().Length > 64))
                throw new InvalidDataException("Invalid saved theme identity.");
            return value;
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or FormatException)
        { throw new InvalidDataException("The theme preference could not be read; the original was preserved.", ex); }
    }

    internal ThemePreference Read(string profileId)
    {
        var paths = Paths(profileId);
        var snapshot = StateStorage.ReadSnapshot(new[] { paths.Settings, paths.User });
        if (snapshot.Documents[paths.User] == null) throw new InvalidDataException("The target profile is no longer available.");
        var settings = Parse(snapshot.Documents[paths.Settings]);
        string id = settings["themeId"]?.GetValue<string>() ?? "default";
        return new(id, snapshot.Revisions[paths.Settings], snapshot.Revisions[paths.User], ReadParts(settings, id));
    }

    private static Dictionary<string, string> ReadParts(JsonObject settings, string legacy)
    {
        var parts = new Dictionary<string, string>();
        foreach (string part in ThemePackage.Parts) if (part != "login") parts[part] = "default";
        if (!settings.ContainsKey("themeParts")) { parts["home"] = legacy; parts["side-panels"] = legacy; return parts; }
        if (settings["themeParts"] is not JsonObject source) throw new InvalidDataException("Invalid theme components.");
        foreach (var item in source)
        {
            if (!parts.ContainsKey(item.Key) || item.Value is not JsonValue value || !value.TryGetValue<string>(out string? id) || string.IsNullOrWhiteSpace(id) || id.Length > 64)
                throw new InvalidDataException("Invalid theme component preference.");
            parts[item.Key] = id;
        }
        return parts;
    }

    internal ThemePreference Save(string profileId, string themeId, long revision, long profileRevision, string? part = null)
    {
        var paths = Paths(profileId);
        var snapshot = StateStorage.ReadSnapshot(new[] { paths.Settings, paths.User });
        if (snapshot.Documents[paths.User] == null) throw new InvalidDataException("The target profile is no longer available.");
        // Parse before any write: semantic corruption must not be replaced with an empty object.
        var settings = Parse(snapshot.Documents[paths.Settings]);
        if (string.IsNullOrWhiteSpace(themeId) || themeId.Length > 64) throw new ArgumentException("Invalid theme identity.");
        settings["themePreferenceVersion"] = 1;
        if (part != null)
        {
            var parts = ReadParts(settings, settings["themeId"]?.GetValue<string>() ?? "default");
            if (part == "system")
                foreach (string key in parts.Keys.ToArray()) parts[key] = themeId;
            else
            {
                if (!parts.ContainsKey(part)) throw new InvalidDataException("Invalid profile theme component.");
                parts[part] = themeId;
            }
            settings["themeParts"] = JsonSerializer.SerializeToNode(parts);
            settings["themeId"] = parts["home"];
        }
        else settings["themeId"] = themeId;
        StateStorage.WriteBatchIfRevision(new Dictionary<string, string?> { [paths.Settings] = settings.ToJsonString() },
            new Dictionary<string, long> { [paths.Settings] = revision, [paths.User] = profileRevision });
        return Read(profileId);
    }

    internal DeviceThemePreference ReadDevice()
    {
        string path = Path.Combine(dataFolder, "theme-settings.json");
        if (!StateStorage.HandlesPath(path)) throw new InvalidOperationException("Theme state must use SQLite.");
        var snapshot = StateStorage.ReadSnapshot(new[] { path });
        string? text = snapshot.Documents[path];
        var value = ParseDevice(text);
        return new(value["login"]?.GetValue<string>() ?? "default", snapshot.Revisions[path]);
    }
    private static JsonObject ParseDevice(string? text)
    {
        if (text == null) return new JsonObject();
        var value = JsonNode.Parse(text) as JsonObject ?? throw new InvalidDataException("Invalid device theme state.");
        if (value["version"]?.GetValue<int>() != 1 || value["login"] is not JsonValue login || !login.TryGetValue<string>(out string? id) || string.IsNullOrWhiteSpace(id) || id.Length > 64)
            throw new InvalidDataException("Invalid login theme preference.");
        return value;
    }
    internal void SaveDevice(string profileId, string themeId, long deviceRevision, long profileRevision)
    {
        ReadDevice(); // Do not overwrite semantic corruption.
        var user = Paths(profileId).User;
        var path = Path.Combine(dataFolder, "theme-settings.json");
        var snapshot = StateStorage.ReadSnapshot(new[] { path });
        var value = ParseDevice(snapshot.Documents[path]);
        value["version"] = 1;
        value["login"] = themeId;
        StateStorage.WriteBatchIfRevision(new Dictionary<string, string?> { [path] = value.ToJsonString() },
            new Dictionary<string, long> { [path] = deviceRevision, [user] = profileRevision });
    }

    internal void ResetAll(string profileId, long revision, long profileRevision, long deviceRevision)
    {
        var paths = Paths(profileId);
        string devicePath = Path.Combine(dataFolder, "theme-settings.json");
        if (!StateStorage.HandlesPath(devicePath)) throw new InvalidOperationException("Theme state must use SQLite.");
        var snapshot = StateStorage.ReadSnapshot(new[] { paths.Settings, paths.User, devicePath });
        if (snapshot.Documents[paths.User] == null) throw new InvalidDataException("The target profile is no longer available.");
        var settings = Parse(snapshot.Documents[paths.Settings]);
        var parts = ReadParts(settings, settings["themeId"]?.GetValue<string>() ?? "default");
        var device = ParseDevice(snapshot.Documents[devicePath]);
        foreach (string part in parts.Keys.ToArray()) parts[part] = "default";
        settings["themePreferenceVersion"] = 1;
        settings["themeId"] = "default";
        settings["themeParts"] = JsonSerializer.SerializeToNode(parts);
        device["version"] = 1;
        device["login"] = "default";
        StateStorage.WriteBatchIfRevision(
            new Dictionary<string, string?> { [paths.Settings] = settings.ToJsonString(), [devicePath] = device.ToJsonString() },
            new Dictionary<string, long> { [paths.Settings] = revision, [paths.User] = profileRevision, [devicePath] = deviceRevision });
    }
}
