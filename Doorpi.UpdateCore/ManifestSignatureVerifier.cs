using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Doorpi.UpdateCore;

public static class ManifestSignatureVerifier
{
    public const string SupportedAlgorithm = "RSA-SHA256-PKCS1";

    public static string BuildSigningPayload(UpdateManifest manifest)
    {
        var builder = new StringBuilder();
        Append(builder, "schemaVersion", manifest.SchemaVersion.ToString(CultureInfo.InvariantCulture));
        Append(builder, "channel", manifest.Channel);
        Append(builder, "manifestVersion", manifest.ManifestVersion.ToString(CultureInfo.InvariantCulture));
        Append(builder, "publishedAtUnix", manifest.PublishedAt.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture));
        Append(builder, "expiresAtUnix", manifest.ExpiresAt.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture));
        Append(builder, "minimumSupportedManifestVersion", manifest.MinimumSupportedManifestVersion.ToString(CultureInfo.InvariantCulture));
        AppendRelease(builder, "doorpi", manifest.Doorpi);
        AppendRelease(builder, "updater", manifest.Updater);

        for (int i = 0; i < manifest.Changelog.Count; i++)
        {
            ChangelogEntry entry = manifest.Changelog[i];
            Append(builder, $"changelog.{i}.version", entry.Version);
            Append(builder, $"changelog.{i}.title", entry.Title);
            for (int itemIndex = 0; itemIndex < entry.Items.Count; itemIndex++)
                Append(builder, $"changelog.{i}.items.{itemIndex}", entry.Items[itemIndex]);
        }

        return builder.ToString();
    }

    public static void Verify(UpdateManifest manifest, string publicKeyXml)
    {
        if (manifest.Signature == null)
            throw new InvalidDataException("Manifesto sem assinatura.");

        if (!string.Equals(manifest.Signature.Algorithm, SupportedAlgorithm, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Algoritmo de assinatura do manifesto nao suportado.");

        if (string.IsNullOrWhiteSpace(publicKeyXml))
            throw new InvalidDataException("Chave publica do manifesto nao configurada.");

        byte[] signature;
        try
        {
            signature = Convert.FromBase64String(manifest.Signature.Value);
        }
        catch (FormatException ex)
        {
            throw new InvalidDataException("Assinatura do manifesto nao esta em Base64 valido.", ex);
        }

        using RSA rsa = RSA.Create();
        rsa.FromXmlString(publicKeyXml);

        byte[] payload = Encoding.UTF8.GetBytes(BuildSigningPayload(manifest));
        bool valid = rsa.VerifyData(payload, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        if (!valid)
            throw new InvalidDataException("Assinatura do manifesto invalida.");
    }

    private static void AppendRelease(StringBuilder builder, string prefix, ComponentRelease release)
    {
        Append(builder, $"{prefix}.version", release.Version);
        Append(builder, $"{prefix}.downloadUrl", release.DownloadUrl);
        Append(builder, $"{prefix}.sha256", release.Sha256);
        Append(builder, $"{prefix}.sizeBytes", release.SizeBytes?.ToString(CultureInfo.InvariantCulture) ?? "");
        Append(builder, $"{prefix}.minUpdaterVersion", release.MinUpdaterVersion);
        Append(builder, $"{prefix}.forceUpdate", release.ForceUpdate ? "true" : "false");
        Append(builder, $"{prefix}.allowRollback", release.AllowRollback ? "true" : "false");
    }

    private static void Append(StringBuilder builder, string name, string? value)
    {
        builder.Append(name);
        builder.Append('=');
        builder.Append((value ?? "").Replace("\r", "\\r").Replace("\n", "\\n"));
        builder.Append('\n');
    }
}
