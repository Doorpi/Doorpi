namespace Doorpi.UpdateCore;

public static class TrustedUpdateKeys
{
    // Replace this value with the official public key before the first public beta release.
    // The private key must never be committed to this repository.
    private static readonly Dictionary<string, string> ProductionKeys = new(StringComparer.OrdinalIgnoreCase)
    {
    };

    public static string ResolveProductionKey(string keyId)
        => ProductionKeys.TryGetValue(keyId, out string? key) ? key : "";

    public static bool HasProductionKeys => ProductionKeys.Count > 0;
}
