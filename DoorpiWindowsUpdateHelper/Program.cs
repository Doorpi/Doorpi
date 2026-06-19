using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

namespace DoorpiWindowsUpdateHelper;

internal static class Program
{
    private const int OrcSucceeded = 2;
    private const int OrcSucceededWithErrors = 3;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
    private static readonly object WriteLock = new();

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length != 1 || string.IsNullOrWhiteSpace(args[0])) return 2;

        try
        {
            using var pipe = new NamedPipeClientStream(".", args[0], PipeDirection.InOut);
            pipe.Connect(60000);
            using var reader = new StreamReader(
                pipe, Encoding.UTF8, false, bufferSize: 4096, leaveOpen: true);
            using var writer = new StreamWriter(
                pipe, new UTF8Encoding(false), bufferSize: 4096, leaveOpen: true)
            {
                AutoFlush = true
            };

            string? requestJson = reader.ReadLine();
            var request = string.IsNullOrWhiteSpace(requestJson)
                ? null
                : JsonSerializer.Deserialize<InstallRequest>(requestJson, JsonOptions);
            if (request == null)
            {
                Write(writer, InstallResult.Failure("request", unchecked((int)0x80070057), "Invalid request."));
                return 3;
            }

            InstallResult result = DownloadAndInstall(request, writer);
            Write(writer, result);
            return result.ResultCode is OrcSucceeded or OrcSucceededWithErrors ? 0 : 1;
        }
        catch
        {
            return 1;
        }
    }

    private static InstallResult DownloadAndInstall(InstallRequest request, StreamWriter writer)
    {
        try
        {
            Write(writer, new ProgressMessage
            {
                Type = "progress",
                Status = "preparing",
                Message = "Preparing Windows Update packages."
            });

            dynamic session = CreateUpdateSession();
            dynamic searcher = session.CreateUpdateSearcher();
            dynamic searchResult = searcher.Search("IsInstalled=0 and IsHidden=0 and Type='Software'");
            dynamic foundUpdates = searchResult.Updates;
            dynamic installCollection = CreateUpdateCollection();

            var expectedIds = (request.UpdateIds ?? new List<string>())
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (expectedIds.Count == 0)
                return InstallResult.Failure("request", unchecked((int)0x80070057),
                    "No Windows Update package IDs were provided.");

            int foundCount = (int)foundUpdates.Count;
            for (int i = 0; i < foundCount; i++)
            {
                dynamic update = foundUpdates.Item(i);
                string updateId = SafeString(() => update.Identity.UpdateID);
                if (!expectedIds.Contains(updateId)) continue;

                TryAcceptEula(update);
                installCollection.Add(update);
            }

            int selectedCount = (int)installCollection.Count;
            if (selectedCount == 0)
            {
                return new InstallResult
                {
                    Type = "result",
                    Phase = "complete",
                    ResultCode = OrcSucceeded
                };
            }

            Write(writer, new ProgressMessage
            {
                Type = "progress",
                Status = "downloading",
                Message = "Downloading Windows Update packages.",
                Packages = CreateInitialProgress(installCollection)
            });

            dynamic downloader = session.CreateUpdateDownloader();
            downloader.Updates = installCollection;
            dynamic downloadResult = RunDownload(downloader, installCollection, writer);
            int downloadCode = (int)downloadResult.ResultCode;
            List<PackageResult> downloadPackages = ReadPackageResults(installCollection, downloadResult);
            if (downloadCode is not OrcSucceeded and not OrcSucceededWithErrors)
            {
                return new InstallResult
                {
                    Type = "result",
                    Phase = "download",
                    ResultCode = downloadCode,
                    HResult = SafeInt(() => downloadResult.HResult),
                    Packages = downloadPackages
                };
            }

            Write(writer, new ProgressMessage
            {
                Type = "progress",
                Status = "installing",
                Message = "Installing Windows Update packages.",
                Packages = CreateInitialProgress(installCollection, downloaded: true)
            });

            dynamic installer = session.CreateUpdateInstaller();
            installer.Updates = installCollection;
            dynamic installResult = RunInstall(installer, installCollection, writer);
            return new InstallResult
            {
                Type = "result",
                Phase = "install",
                ResultCode = (int)installResult.ResultCode,
                HResult = SafeInt(() => installResult.HResult),
                RebootRequired = SafeBool(() => installResult.RebootRequired),
                Packages = ReadPackageResults(installCollection, installResult)
            };
        }
        catch (COMException ex)
        {
            return InstallResult.Failure("com", ex.HResult, ex.Message);
        }
        catch (Exception ex)
        {
            return InstallResult.Failure("helper", ex.HResult, ex.Message);
        }
    }

    private static dynamic RunDownload(dynamic downloader, dynamic updates, StreamWriter writer)
    {
        using var completed = new ManualResetEventSlim(false);
        var progressCallback = new DownloadProgressCallback(progress =>
            Write(writer, CreateDownloadProgress(updates, progress)));
        var completedCallback = new DownloadCompletedCallback(completed.Set);
        dynamic job = downloader.BeginDownload(progressCallback, completedCallback, null);
        completed.Wait();
        return downloader.EndDownload(job);
    }

    private static dynamic RunInstall(dynamic installer, dynamic updates, StreamWriter writer)
    {
        using var completed = new ManualResetEventSlim(false);
        var progressCallback = new InstallationProgressCallback(progress =>
            Write(writer, CreateInstallationProgress(updates, progress)));
        var completedCallback = new InstallationCompletedCallback(completed.Set);
        dynamic job = installer.BeginInstall(progressCallback, completedCallback, null);
        completed.Wait();
        return installer.EndInstall(job);
    }

    private static ProgressMessage CreateDownloadProgress(dynamic updates, dynamic progress)
    {
        int currentIndex = SafeInt(() => progress.CurrentUpdateIndex);
        int currentPercent = ClampPercent(SafeInt(() => progress.CurrentUpdatePercentComplete));
        int count = SafeInt(() => updates.Count);
        var packages = new List<PackageProgress>(count);

        for (int i = 0; i < count; i++)
        {
            dynamic update = updates.Item(i);
            bool downloaded = SafeBool(() => update.IsDownloaded) || i < currentIndex;
            packages.Add(CreatePackageProgress(
                update,
                downloaded ? "downloaded" : i == currentIndex ? "downloading" : "pending",
                downloaded ? 100 : i == currentIndex ? currentPercent : 0));
        }

        return new ProgressMessage
        {
            Type = "progress",
            Status = "downloading",
            Message = "Downloading Windows Update packages.",
            OverallPercent = ClampPercent(SafeInt(() => progress.PercentComplete)),
            Packages = packages
        };
    }

    private static ProgressMessage CreateInstallationProgress(dynamic updates, dynamic progress)
    {
        int currentIndex = SafeInt(() => progress.CurrentUpdateIndex);
        int currentPercent = ClampPercent(SafeInt(() => progress.CurrentUpdatePercentComplete));
        int count = SafeInt(() => updates.Count);
        var packages = new List<PackageProgress>(count);

        for (int i = 0; i < count; i++)
        {
            dynamic update = updates.Item(i);
            packages.Add(CreatePackageProgress(
                update,
                i < currentIndex ? "installed" : i == currentIndex ? "installing" : "downloaded",
                i <= currentIndex ? (i < currentIndex ? 100 : currentPercent) : 100));
        }

        return new ProgressMessage
        {
            Type = "progress",
            Status = "installing",
            Message = "Installing Windows Update packages.",
            OverallPercent = ClampPercent(SafeInt(() => progress.PercentComplete)),
            Packages = packages
        };
    }

    private static List<PackageProgress> CreateInitialProgress(dynamic updates, bool downloaded = false)
    {
        int count = SafeInt(() => updates.Count);
        var packages = new List<PackageProgress>(count);
        for (int i = 0; i < count; i++)
        {
            dynamic update = updates.Item(i);
            bool isDownloaded = downloaded || SafeBool(() => update.IsDownloaded);
            packages.Add(CreatePackageProgress(
                update,
                isDownloaded ? "downloaded" : "pending",
                isDownloaded ? 100 : 0));
        }

        return packages;
    }

    private static PackageProgress CreatePackageProgress(dynamic update, string status, int percent)
    {
        return new PackageProgress
        {
            UpdateId = SafeString(() => update.Identity.UpdateID),
            Title = SafeString(() => update.Title),
            Status = status,
            Percent = ClampPercent(percent),
            RebootRequired = false
        };
    }

    private static int ClampPercent(int value) => Math.Clamp(value, 0, 100);

    private static List<PackageResult> ReadPackageResults(dynamic updates, dynamic operationResult)
    {
        var packages = new List<PackageResult>();
        int count = (int)updates.Count;
        for (int i = 0; i < count; i++)
        {
            dynamic update = updates.Item(i);
            dynamic? result = null;
            try { result = operationResult.GetUpdateResult(i); } catch { }
            int resultCode = 0;
            int hResult = 0;
            bool rebootRequired = false;
            if (result != null)
            {
                dynamic packageResult = result;
                resultCode = SafeInt(() => packageResult.ResultCode);
                hResult = SafeInt(() => packageResult.HResult);
                rebootRequired = SafeBool(() => packageResult.RebootRequired);
            }

            packages.Add(new PackageResult
            {
                UpdateId = SafeString(() => update.Identity.UpdateID),
                Title = SafeString(() => update.Title),
                ResultCode = resultCode,
                HResult = hResult,
                RebootRequired = rebootRequired
            });
        }

        return packages;
    }

    private static dynamic CreateUpdateSession()
    {
        Type type = Type.GetTypeFromProgID("Microsoft.Update.Session", true)!;
        dynamic session = Activator.CreateInstance(type)!;
        session.ClientApplicationID = "Doorpi";
        return session;
    }

    private static dynamic CreateUpdateCollection()
    {
        Type type = Type.GetTypeFromProgID("Microsoft.Update.UpdateColl", true)!;
        return Activator.CreateInstance(type)!;
    }

    private static void TryAcceptEula(dynamic update)
    {
        try
        {
            if (!SafeBool(() => update.EulaAccepted)) update.AcceptEula();
        }
        catch { }
    }

    private static void Write(StreamWriter writer, object payload)
    {
        lock (WriteLock)
            writer.WriteLine(JsonSerializer.Serialize(payload, JsonOptions));
    }

    private static string SafeString(Func<dynamic> read)
    {
        try { return Convert.ToString(read()) ?? ""; }
        catch { return ""; }
    }

    private static int SafeInt(Func<dynamic> read)
    {
        try { return Convert.ToInt32(read()); }
        catch { return 0; }
    }

    private static bool SafeBool(Func<dynamic> read)
    {
        try { return Convert.ToBoolean(read()); }
        catch { return false; }
    }

    private sealed class InstallRequest
    {
        public List<string>? UpdateIds { get; set; } = new();
    }

    private sealed class ProgressMessage
    {
        public string Type { get; set; } = "progress";
        public string Status { get; set; } = "";
        public string Message { get; set; } = "";
        public int OverallPercent { get; set; }
        public List<PackageProgress> Packages { get; set; } = new();
    }

    private sealed class InstallResult
    {
        public string Type { get; set; } = "result";
        public string Phase { get; set; } = "";
        public int ResultCode { get; set; }
        public int HResult { get; set; }
        public bool RebootRequired { get; set; }
        public string Error { get; set; } = "";
        public List<PackageResult> Packages { get; set; } = new();

        public static InstallResult Failure(string phase, int hResult, string error) => new()
        {
            Phase = phase,
            ResultCode = 4,
            HResult = hResult,
            Error = error
        };
    }

    private sealed class PackageResult
    {
        public string UpdateId { get; set; } = "";
        public string Title { get; set; } = "";
        public int ResultCode { get; set; }
        public int HResult { get; set; }
        public bool RebootRequired { get; set; }
    }

    private sealed class PackageProgress
    {
        public string UpdateId { get; set; } = "";
        public string Title { get; set; } = "";
        public string Status { get; set; } = "pending";
        public int Percent { get; set; }
        public bool RebootRequired { get; set; }
    }
}

[ComVisible(true)]
[Guid("8C3F1CDD-6173-4591-AEBD-A56A53CA77C1")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IDownloadProgressChangedCallback
{
    void Invoke([MarshalAs(UnmanagedType.Interface)] object downloadJob,
        [MarshalAs(UnmanagedType.Interface)] object callbackArgs);
}

[ComVisible(true)]
[Guid("77254866-9F5B-4C8E-B9E2-C77A8530D64B")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IDownloadCompletedCallback
{
    void Invoke([MarshalAs(UnmanagedType.Interface)] object downloadJob,
        [MarshalAs(UnmanagedType.Interface)] object callbackArgs);
}

[ComVisible(true)]
[Guid("E01402D5-F8DA-43BA-A012-38894BD048F1")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IInstallationProgressChangedCallback
{
    void Invoke([MarshalAs(UnmanagedType.Interface)] object installationJob,
        [MarshalAs(UnmanagedType.Interface)] object callbackArgs);
}

[ComVisible(true)]
[Guid("45F4F6F3-D602-4F98-9A8A-3EFA152AD2D3")]
[InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IInstallationCompletedCallback
{
    void Invoke([MarshalAs(UnmanagedType.Interface)] object installationJob,
        [MarshalAs(UnmanagedType.Interface)] object callbackArgs);
}

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.None)]
public sealed class DownloadProgressCallback(Action<dynamic> callback) : IDownloadProgressChangedCallback
{
    public void Invoke(object downloadJob, object callbackArgs)
    {
        try { callback(((dynamic)callbackArgs).Progress); } catch { }
    }
}

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.None)]
public sealed class DownloadCompletedCallback(Action callback) : IDownloadCompletedCallback
{
    public void Invoke(object downloadJob, object callbackArgs) => callback();
}

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.None)]
public sealed class InstallationProgressCallback(Action<dynamic> callback) : IInstallationProgressChangedCallback
{
    public void Invoke(object installationJob, object callbackArgs)
    {
        try { callback(((dynamic)callbackArgs).Progress); } catch { }
    }
}

[ComVisible(true)]
[ClassInterface(ClassInterfaceType.None)]
public sealed class InstallationCompletedCallback(Action callback) : IInstallationCompletedCallback
{
    public void Invoke(object installationJob, object callbackArgs) => callback();
}
