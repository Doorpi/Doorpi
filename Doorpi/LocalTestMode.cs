using System.IO;

namespace Doorpi;

internal static class LocalTestMode
{
    public static bool Enabled
    {
        get
        {
#if DOORPI_LOCAL_TEST
            return true;
#else
            return false;
#endif
        }
    }

    public static void Configure()
    {
        if (!Enabled) return;
        string root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "state"));
        Environment.SetEnvironmentVariable("DOORPI_APPDATA_ROOT", root);
        Environment.SetEnvironmentVariable("DOORPI_UPDATE_HEALTH_SIGNAL", null);
    }
}
