using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Doorpi.Themes;

internal sealed record ThemePackagePart(string Css, string? Appearance);
internal sealed record ThemePackageManifest(int SchemaVersion, int ApiVersion, string Id, string Name, string Version, string Author, Dictionary<string, ThemePackagePart> Parts);
internal sealed record StagedThemePackage(string Hash, ThemePackageManifest Manifest, Dictionary<string, byte[]> Files);

// Immutable external visual packages. No internal preference/index JSON is written here.
internal static class ThemePackage
{
    internal static readonly string[] Parts = { "home", "nav-menu", "side-panels", "popups", "profile", "login" };
    internal static readonly Dictionary<string, string> AssetTypes = new(StringComparer.OrdinalIgnoreCase)
    { [".png"] = "image/png", [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".webp"] = "image/webp", [".avif"] = "image/avif", [".woff"] = "font/woff", [".woff2"] = "font/woff2" };
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow };
    private static byte[] ReadBytes(string path, int maximum, bool allowSourceLink = false)
    {
        if (!allowSourceLink && (System.IO.File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0) throw new InvalidDataException("Links não são aceitos em pacotes visuais.");
        using var stream = System.IO.File.OpenRead(path);
        if (stream.Length > maximum) throw new InvalidDataException("Arquivo visual excede o limite.");
        using var content = new MemoryStream(); var buffer = new byte[8192]; int read;
        while ((read = stream.Read(buffer, 0, buffer.Length)) > 0) { if (content.Length + read > maximum) throw new InvalidDataException("Arquivo visual excede o limite."); content.Write(buffer, 0, read); }
        return content.ToArray();
    }
    private static string ReadText(string path) => new System.Text.UTF8Encoding(false, true).GetString(ReadBytes(path, 131072));
    internal static bool SafePath(string value) => !string.IsNullOrEmpty(value) && value.Length <= 160 && Regex.IsMatch(value, "^[A-Za-z0-9_./-]+$") &&
        !value.Split('/').Any(segment => segment is "" or "." or ".." || segment.EndsWith('.') || Regex.IsMatch(segment, "^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\\.|$)",RegexOptions.IgnoreCase));
    internal static ThemePackageManifest ParseManifest(string text)
    {
        var manifest = JsonSerializer.Deserialize<ThemePackageManifest>(text, Json) ?? throw new InvalidDataException("Manifesto de tema ausente.");
        if (manifest.SchemaVersion != 1 || manifest.ApiVersion != 1 || manifest.Id == null || !Regex.IsMatch(manifest.Id, "^[a-z0-9][a-z0-9-]{0,63}$") ||
            string.IsNullOrWhiteSpace(manifest.Name) || manifest.Name.Length > 100 || string.IsNullOrWhiteSpace(manifest.Author) || manifest.Author.Length > 100 ||
            manifest.Version == null || !Regex.IsMatch(manifest.Version, "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$") || manifest.Parts is not { Count: > 0 and <= 5 })
            throw new InvalidDataException("Identidade/versão de pacote visual inválida.");
        foreach (var (part, value) in manifest.Parts)
            if (!Parts.Contains(part) || value == null || !SafePath(value.Css) || !value.Css.EndsWith(".css", StringComparison.Ordinal) ||
                (value.Appearance != null && (part != "home" || !SafePath(value.Appearance) || !value.Appearance.EndsWith(".json", StringComparison.Ordinal))))
                throw new InvalidDataException("Componente visual inválido: " + part);
        return manifest;
    }
    internal static StagedThemePackage Stage(string archivePath)
    {
        byte[] archive = ReadBytes(archivePath, 24 * 1024 * 1024, allowSourceLink: true);
        string hash = Convert.ToHexString(SHA256.HashData(archive)).ToLowerInvariant();
        using var stream = new MemoryStream(archive, false);
        using var zip = new ZipArchive(stream, ZipArchiveMode.Read);
        if (zip.Entries.Count is < 1 or > 128) throw new InvalidDataException("Quantidade de arquivos inválida.");
        var files = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
        long total = 0;
        foreach (var entry in zip.Entries)
        {
            string file = entry.FullName;
            if (!SafePath(file) || files.ContainsKey(file) || (entry.ExternalAttributes >> 16 & 0xF000) == 0xA000 ||
                entry.Length > 4 * 1024 * 1024 || (total += entry.Length) > 20 * 1024 * 1024)
                throw new InvalidDataException("Entrada inválida no pacote: " + file);
            string extension = Path.GetExtension(file);
            if (file != "theme.json" && !(file.StartsWith("parts/", StringComparison.Ordinal) && extension is ".css" or ".json") &&
                !(file.StartsWith("assets/", StringComparison.Ordinal) && AssetTypes.ContainsKey(extension)))
                throw new InvalidDataException("Tipo de arquivo não permitido: " + file);
            using var input = entry.Open(); using var content = new MemoryStream();
            var buffer = new byte[8192]; int read;
            while ((read = input.Read(buffer, 0, buffer.Length)) > 0) { if (content.Length + read > entry.Length) throw new InvalidDataException("Tamanho ZIP divergente."); content.Write(buffer, 0, read); }
            if (content.Length != entry.Length) throw new InvalidDataException("Arquivo incompleto no pacote.");
            files.Add(file, content.ToArray());
        }
        if (!files.TryGetValue("theme.json", out var json)) throw new InvalidDataException("theme.json não encontrado.");
        if (json.Length > 131072) throw new InvalidDataException("Manifesto visual excede 128 KiB.");
        var manifest = ParseManifest(new System.Text.UTF8Encoding(false, true).GetString(json));
        foreach (var part in manifest.Parts.Values)
        {
            if (!files.TryGetValue(part.Css, out var css) || css.Length > 131072 || (part.Appearance != null && (!files.TryGetValue(part.Appearance, out var appearance) || appearance.Length > 131072)))
                throw new InvalidDataException("Arquivo de componente ausente ou muito grande.");
        }
        return new(hash, manifest, files);
    }
    internal static string Commit(string packagesRoot, StagedThemePackage package)
    {
        Directory.CreateDirectory(packagesRoot);
        string target = Path.Combine(packagesRoot, package.Hash);
        if (Directory.Exists(target))
        {
            foreach (var (relative, bytes) in package.Files)
            {
                string file = Path.Combine(target, relative.Replace('/', Path.DirectorySeparatorChar));
                if (!System.IO.File.Exists(file) || !ReadBytes(file, 4 * 1024 * 1024).AsSpan().SequenceEqual(bytes))
                    throw new InvalidDataException("A versão instalada está danificada; a origem foi preservada.");
            }
            return "pkg-" + package.Hash[..24];
        }
        string staging = Path.Combine(packagesRoot, ".staging-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(staging);
        // Never overwrite/delete an installed version. An interrupted staging folder is ignored.
        foreach (var (relative, bytes) in package.Files)
        {
            string file = Path.Combine(staging, relative.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(file)!); System.IO.File.WriteAllBytes(file, bytes);
        }
        Directory.Move(staging, target);
        return "pkg-" + package.Hash[..24];
    }
    internal static string Find(string root, string id)
    {
        if (!Regex.IsMatch(id, "^pkg-[a-f0-9]{24}$")) throw new InvalidDataException("Identidade instalada inválida.");
        string[] matches = Directory.Exists(root) ? Directory.GetDirectories(root).Where(folder => Regex.IsMatch(Path.GetFileName(folder), "^[a-f0-9]{64}$") && Path.GetFileName(folder).StartsWith(id[4..], StringComparison.Ordinal)).ToArray() : Array.Empty<string>();
        if (matches.Length != 1 || (System.IO.File.GetAttributes(matches[0]) & FileAttributes.ReparsePoint) != 0) throw new InvalidDataException("Pacote instalado não encontrado, ambíguo ou vinculado.");
        return matches[0];
    }
    internal static object Read(string root, string id)
    {
        string folder = Find(root, id);
        var manifest = ParseManifest(ReadText(Path.Combine(folder, "theme.json")));
        var parts = manifest.Parts.ToDictionary(item => item.Key, item => new
        {
            css = ReadText(Path.Combine(folder, item.Value.Css.Replace('/', Path.DirectorySeparatorChar))),
            appearance = item.Value.Appearance == null ? (JsonElement?)null : JsonSerializer.Deserialize<JsonElement>(ReadText(Path.Combine(folder, item.Value.Appearance.Replace('/', Path.DirectorySeparatorChar))))
        });
        var assets = new Dictionary<string, string>();
        string assetsRoot = Path.Combine(folder, "assets");
        long assetBytes = 0;
        if (Directory.Exists(assetsRoot)) foreach (string file in Directory.EnumerateFiles(assetsRoot, "*", new EnumerationOptions { RecurseSubdirectories = true, AttributesToSkip = FileAttributes.ReparsePoint }))
        {
            if (!AssetTypes.TryGetValue(Path.GetExtension(file), out var mime)) throw new InvalidDataException("Recurso visual não suportado.");
            byte[] bytes = ReadBytes(file, 4 * 1024 * 1024); if ((assetBytes += bytes.Length) > 20 * 1024 * 1024) throw new InvalidDataException("Recursos instalados excedem o limite.");
            assets.Add(Path.GetRelativePath(folder, file).Replace('\\', '/'), "data:" + mime + ";base64," + Convert.ToBase64String(bytes));
        }
        return new { id, manifest, parts, assets };
    }
    internal static IEnumerable<ThemeDescriptor> Catalog(string root)
    {
        if (!Directory.Exists(root)) yield break;
        foreach (string folder in Directory.GetDirectories(root).Where(path => Regex.IsMatch(Path.GetFileName(path), "^[a-f0-9]{64}$")))
        {
            ThemeDescriptor? descriptor = null;
            try { if ((System.IO.File.GetAttributes(folder) & FileAttributes.ReparsePoint) != 0) continue; var m = ParseManifest(ReadText(Path.Combine(folder, "theme.json"))); descriptor = new("pkg-" + Path.GetFileName(folder)[..24], m.Name + " · " + m.Version, m.Author, null, m.Parts.Keys.ToArray()); }
            catch (Exception) { /* One damaged external package must not hide Default or other packages. */ }
            if (descriptor != null) yield return descriptor;
        }
    }
}
