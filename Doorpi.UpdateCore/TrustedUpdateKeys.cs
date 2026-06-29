namespace Doorpi.UpdateCore;

public static class TrustedUpdateKeys
{
    // The private key must never be committed to this repository.
    private static readonly Dictionary<string, string> ProductionKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        ["6b65ba1c963d49d6"] = "<RSAKeyValue><Modulus>oJXWJNO47Gl6eCcNo9w3hgqfrcblzL/NoTrPy7Wsodq4KHI1TXYI00uCc+P78kf46F/ZL7EhHGBLEjsVfsENJcgrOkH2zAzozYQ8Vf4P8nzHYtkmhisnFPukGZiMzRGcFyczKxCfd62/g/lMkVU+z5m/im9mNrwMVq+BoJhs9vuu1krRseL7qQppnccQ9kwyVxVsi4tC+y2lOfY/Sg8CmHSiXj2huA7Psam+dFOSQXmrPgMpEiXZSCKFudy8GqdWMmToFLJm0RqgLZ2MOg2drubrTvVX+2SebP62/E5ou5Dhxz7zt/rfxCXKNdXAh0o4OKekZI5xZBAJQ8+L7LI4BpvElyHFyzZe8CAgR20n9681hODwxpMWnWub4NqNnbizB+IS3ln/5TIznOLg1zwNIVsGTD4/XUYHoFeU3Ajw7v9RxSViCPsEdLsUPS4a4Cg16gPJr/KIvfq1Ao2hNbTBMkLnslhA7o5Y7sP4D/bJD3yXGnWiUHR2Y+lVGVCrzWYJ</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>"
    };

    public static string ResolveProductionKey(string keyId)
        => ProductionKeys.TryGetValue(keyId, out string? key) ? key : "";

    public static bool HasProductionKeys => ProductionKeys.Count > 0;
}
