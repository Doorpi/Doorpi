namespace Doorpi.UpdateCore;

public sealed class UpdateTrustSettings
{
    public bool RequireManifestSignature { get; set; }
    public string ManifestPublicKeyXml { get; set; } = "";
    public string ManifestPublicKeyPath { get; set; } = "";

    public string ResolvePublicKeyXml(string baseFolder)
    {
        if (!string.IsNullOrWhiteSpace(ManifestPublicKeyXml))
            return ManifestPublicKeyXml;

        if (string.IsNullOrWhiteSpace(ManifestPublicKeyPath))
            return "";

        string path = ManifestPublicKeyPath;
        if (!Path.IsPathRooted(path))
            path = Path.Combine(baseFolder, path);

        return File.Exists(path) ? File.ReadAllText(path) : "";
    }
}
