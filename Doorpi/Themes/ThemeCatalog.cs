using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Doorpi.Themes;

internal sealed record ThemeDescriptor(string Id, string Name, string Description, string? Manifest, string[]? Parts = null);
internal static class ThemeCatalog
{
    internal static readonly ThemeDescriptor Default = new("default", "Doorpi padrão", "O visual original do Doorpi.", null);
    private sealed record CatalogDocument(int SchemaVersion, ThemeDescriptor[] Themes);
    internal static ThemeDescriptor[] Load(string webRoot)
    {
        var document = JsonSerializer.Deserialize<CatalogDocument>(System.IO.File.ReadAllText(Path.Combine(webRoot, "themes", "catalog.json")),
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        if (document?.SchemaVersion != 1 || document.Themes is not { Length: > 0 and <= 32 } themes ||
            themes.Any(theme => theme == null || string.IsNullOrWhiteSpace(theme.Id)) ||
            themes.Select(theme => theme.Id).Distinct(StringComparer.Ordinal).Count() != themes.Length ||
            themes.Count(theme => theme.Id == "default" && theme.Manifest == null) != 1)
            throw new InvalidDataException("Invalid installed theme catalog.");
        foreach (var theme in themes)
        {
            if (!Regex.IsMatch(theme.Id, "^[a-z0-9][a-z0-9-]{0,63}$") || string.IsNullOrWhiteSpace(theme.Name) || theme.Name.Length > 100 ||
                string.IsNullOrWhiteSpace(theme.Description) || theme.Description.Length > 400 ||
                (theme.Id != "default" && (theme.Manifest == null || !Regex.IsMatch(theme.Manifest, "^themes/builtin/[a-z0-9-]+\\.json$") ||
                    !System.IO.File.Exists(Path.Combine(webRoot, theme.Manifest.Replace('/', Path.DirectorySeparatorChar))))))
                throw new InvalidDataException("Invalid installed theme descriptor.");
        }
        return themes;
    }
}
