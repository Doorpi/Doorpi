using System.Security.Cryptography;

namespace Doorpi.UpdateCore;

public static class PackageVerifier
{
    public static async Task<string> ComputeSha256Async(string filePath, CancellationToken cancellationToken = default)
    {
        await using var stream = File.OpenRead(filePath);
        byte[] hash = await SHA256.HashDataAsync(stream, cancellationToken).ConfigureAwait(false);
        return Convert.ToHexString(hash).ToUpperInvariant();
    }

    public static async Task VerifySha256Async(string filePath, string expectedSha256, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(expectedSha256))
            throw new InvalidDataException("O pacote nao informa SHA-256 esperado.");

        string actual = await ComputeSha256Async(filePath, cancellationToken).ConfigureAwait(false);
        if (!string.Equals(actual, expectedSha256.Trim(), StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException($"SHA-256 invalido. Esperado {expectedSha256}, recebido {actual}.");
    }
}
