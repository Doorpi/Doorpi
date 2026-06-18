using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace Doorpi;

internal sealed class WindowsUpdateManager
{
    private const int OrcSucceeded = 2;
    private const int OrcSucceededWithErrors = 3;

    private readonly string _statePath;
    private readonly SemaphoreSlim _operationLock = new(1, 1);
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public WindowsUpdateManager(string statePath)
    {
        _statePath = statePath;
    }

    public WindowsUpdateStatus LoadStatus()
    {
        try
        {
            if (File.Exists(_statePath))
            {
                var status = JsonSerializer.Deserialize<WindowsUpdateStatus>(
                    File.ReadAllText(_statePath),
                    JsonOptions);
                if (status != null)
                {
                    status.RebootRequired = IsRebootRequired();
                    if (status.RebootRequired && status.Status is "idle" or "up-to-date")
                    {
                        status.Status = "reboot-required";
                        status.Message = "Reinicio necessario para concluir atualizacoes do Windows.";
                    }

                    return status;
                }
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[WindowsUpdate] Falha ao carregar estado: " + ex.Message);
        }

        return CreateIdleStatus();
    }

    public async Task<WindowsUpdateStatus> GetStatusAsync(bool scan, IProgress<WindowsUpdateStatus>? progress = null)
    {
        await _operationLock.WaitAsync().ConfigureAwait(false);
        try
        {
            if (!scan)
            {
                var status = LoadStatus();
                status.RebootRequired = IsRebootRequired();
                SaveStatus(status);
                progress?.Report(status);
                return status;
            }

            var checking = LoadStatus();
            checking.Status = "checking";
            checking.Message = "Verificando atualizacoes do Windows...";
            checking.Error = "";
            progress?.Report(checking);
            SaveStatus(checking);

            var updates = await Task.Run(SearchAvailableUpdates).ConfigureAwait(false);
            var rebootRequired = IsRebootRequired();
            var result = new WindowsUpdateStatus
            {
                Status = rebootRequired
                    ? "reboot-required"
                    : updates.Count > 0 ? "available" : "up-to-date",
                Message = rebootRequired
                    ? "Reinicio necessario para concluir atualizacoes do Windows."
                    : updates.Count > 0
                        ? $"{updates.Count} atualizacao(oes) disponivel(is) pelo Windows Update."
                        : "Windows atualizado.",
                LastCheckedAt = DateTimeOffset.UtcNow,
                RebootRequired = rebootRequired,
                Updates = updates
            };

            SaveStatus(result);
            progress?.Report(result);
            return result;
        }
        catch (Exception ex)
        {
            var error = LoadStatus();
            error.Status = IsAccessDenied(ex) ? "access-denied" : "error";
            error.Message = IsAccessDenied(ex)
                ? "O Windows bloqueou a operacao automatica. Abra o Windows Update para continuar."
                : "Nao foi possivel verificar atualizacoes do Windows.";
            error.Error = ex.Message;
            SaveStatus(error);
            progress?.Report(error);
            return error;
        }
        finally
        {
            _operationLock.Release();
        }
    }

    public async Task<WindowsUpdateStatus> DownloadAndInstallAsync(IProgress<WindowsUpdateStatus>? progress = null)
    {
        await _operationLock.WaitAsync().ConfigureAwait(false);
        try
        {
            var starting = LoadStatus();
            starting.Status = "checking";
            starting.Message = "Preparando atualizacoes do Windows...";
            starting.Error = "";
            progress?.Report(starting);
            SaveStatus(starting);

            var updates = await Task.Run(SearchAvailableUpdates).ConfigureAwait(false);
            if (updates.Count == 0)
            {
                var noUpdates = new WindowsUpdateStatus
                {
                    Status = IsRebootRequired() ? "reboot-required" : "up-to-date",
                    Message = IsRebootRequired()
                        ? "Reinicio necessario para concluir atualizacoes do Windows."
                        : "Windows atualizado.",
                    LastCheckedAt = DateTimeOffset.UtcNow,
                    RebootRequired = IsRebootRequired(),
                    Updates = new List<WindowsUpdateItem>()
                };
                SaveStatus(noUpdates);
                progress?.Report(noUpdates);
                return noUpdates;
            }

            var downloading = new WindowsUpdateStatus
            {
                Status = "downloading",
                Message = "Baixando atualizacoes do Windows...",
                LastCheckedAt = DateTimeOffset.UtcNow,
                Updates = updates,
                RebootRequired = IsRebootRequired()
            };
            progress?.Report(downloading);
            SaveStatus(downloading);

            var installResult = await Task.Run(() => DownloadAndInstallCore(updates)).ConfigureAwait(false);
            if (installResult.ResultCode is not OrcSucceeded and not OrcSucceededWithErrors)
            {
                var failed = LoadStatus();
                failed.Status = "error";
                failed.Message = "O Windows Update nao concluiu a instalacao automaticamente.";
                failed.LastInstallResultCode = installResult.ResultCode;
                failed.LastInstallHResult = installResult.HResult;
                SaveStatus(failed);
                progress?.Report(failed);
                return failed;
            }

            var finalUpdates = SearchAvailableUpdates();
            var rebootRequired = IsRebootRequired() || installResult.RebootRequired;
            var status = new WindowsUpdateStatus
            {
                Status = rebootRequired
                    ? "reboot-required"
                    : finalUpdates.Count > 0 ? "available" : "up-to-date",
                Message = rebootRequired
                    ? "Atualizacoes instaladas. Reinicie para concluir."
                    : finalUpdates.Count > 0
                        ? $"{finalUpdates.Count} atualizacao(oes) ainda pendente(s)."
                        : "Atualizacoes do Windows instaladas.",
                LastCheckedAt = DateTimeOffset.UtcNow,
                RebootRequired = rebootRequired,
                Updates = finalUpdates,
                LastInstallResultCode = installResult.ResultCode,
                LastInstallHResult = installResult.HResult
            };

            SaveStatus(status);
            progress?.Report(status);
            return status;
        }
        catch (Exception ex)
        {
            var error = LoadStatus();
            error.Status = IsAccessDenied(ex) ? "access-denied" : "error";
            error.Message = IsAccessDenied(ex)
                ? "O Windows bloqueou a instalacao automatica. Abra o Windows Update para continuar."
                : "Falha ao instalar atualizacoes do Windows.";
            error.Error = ex.Message;
            SaveStatus(error);
            progress?.Report(error);
            return error;
        }
        finally
        {
            _operationLock.Release();
        }
    }

    public bool IsRebootRequired()
    {
        try
        {
            var type = Type.GetTypeFromProgID("Microsoft.Update.SystemInfo", throwOnError: false);
            if (type != null)
            {
                dynamic info = Activator.CreateInstance(type)!;
                return (bool)info.RebootRequired;
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[WindowsUpdate] WUA reboot check falhou: " + ex.Message);
        }

        bool hasRebootKey = PendingRebootRegistryKeys.Any(path =>
        {
            try
            {
                using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(path);
                return key != null;
            }
            catch
            {
                return false;
            }
        });

        if (hasRebootKey) return true;

        try
        {
            using var sessionManager = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(
                @"SYSTEM\CurrentControlSet\Control\Session Manager");
            return sessionManager?.GetValue("PendingFileRenameOperations") != null;
        }
        catch
        {
            return false;
        }
    }

    private static WindowsUpdateStatus CreateIdleStatus()
    {
        return new WindowsUpdateStatus
        {
            Status = "idle",
            Message = "Atualizacoes do Windows ainda nao verificadas.",
            RebootRequired = false,
            Updates = new List<WindowsUpdateItem>()
        };
    }

    private static List<WindowsUpdateItem> SearchAvailableUpdates()
    {
        dynamic session = CreateUpdateSession();
        dynamic searcher = session.CreateUpdateSearcher();
        dynamic result = searcher.Search("IsInstalled=0 and IsHidden=0 and Type='Software'");
        dynamic updateCollection = result.Updates;

        var updates = new List<WindowsUpdateItem>();
        int count = (int)updateCollection.Count;
        for (int i = 0; i < count; i++)
        {
            dynamic update = updateCollection.Item(i);
            updates.Add(MapUpdate(update));
        }

        return updates
            .OrderByDescending(u => u.IsDownloaded)
            .ThenBy(u => u.Title, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    private static WindowsUpdateInstallResult DownloadAndInstallCore(IReadOnlyCollection<WindowsUpdateItem> expectedUpdates)
    {
        dynamic session = CreateUpdateSession();
        dynamic searcher = session.CreateUpdateSearcher();
        dynamic result = searcher.Search("IsInstalled=0 and IsHidden=0 and Type='Software'");
        dynamic foundUpdates = result.Updates;
        dynamic installCollection = CreateUpdateCollection();

        var expectedIds = expectedUpdates
            .Select(u => u.UpdateId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        int count = (int)foundUpdates.Count;
        for (int i = 0; i < count; i++)
        {
            dynamic update = foundUpdates.Item(i);
            string updateId = SafeString(() => update.Identity.UpdateID);
            if (expectedIds.Count > 0 && !expectedIds.Contains(updateId)) continue;

            TryAcceptEula(update);
            installCollection.Add(update);
        }

        if ((int)installCollection.Count == 0)
        {
            return new WindowsUpdateInstallResult { ResultCode = OrcSucceeded };
        }

        dynamic downloader = session.CreateUpdateDownloader();
        downloader.Updates = installCollection;
        dynamic downloadResult = downloader.Download();
        int downloadCode = (int)downloadResult.ResultCode;
        if (downloadCode is not OrcSucceeded and not OrcSucceededWithErrors)
        {
            return new WindowsUpdateInstallResult
            {
                ResultCode = downloadCode,
                HResult = SafeInt(() => downloadResult.HResult)
            };
        }

        dynamic installer = session.CreateUpdateInstaller();
        installer.Updates = installCollection;
        dynamic installResult = installer.Install();
        return new WindowsUpdateInstallResult
        {
            ResultCode = (int)installResult.ResultCode,
            HResult = SafeInt(() => installResult.HResult),
            RebootRequired = (bool)installResult.RebootRequired
        };
    }

    private static dynamic CreateUpdateSession()
    {
        var type = Type.GetTypeFromProgID("Microsoft.Update.Session", throwOnError: true)!;
        dynamic session = Activator.CreateInstance(type)!;
        session.ClientApplicationID = "Doorpi";
        return session;
    }

    private static dynamic CreateUpdateCollection()
    {
        var type = Type.GetTypeFromProgID("Microsoft.Update.UpdateColl", throwOnError: true)!;
        return Activator.CreateInstance(type)!;
    }

    private static WindowsUpdateItem MapUpdate(dynamic update)
    {
        return new WindowsUpdateItem
        {
            UpdateId = SafeString(() => update.Identity.UpdateID),
            RevisionNumber = SafeInt(() => update.Identity.RevisionNumber),
            Title = SafeString(() => update.Title),
            Description = SafeString(() => update.Description),
            MsrcSeverity = SafeString(() => update.MsrcSeverity),
            IsDownloaded = SafeBool(() => update.IsDownloaded),
            RebootBehavior = SafeInt(() => update.InstallationBehavior.RebootBehavior),
            SizeBytes = SafeLong(() => update.MaxDownloadSize)
        };
    }

    private static void TryAcceptEula(dynamic update)
    {
        try
        {
            if (!SafeBool(() => update.EulaAccepted))
                update.AcceptEula();
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[WindowsUpdate] Nao foi possivel aceitar EULA automaticamente: " + ex.Message);
        }
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

    private static long SafeLong(Func<dynamic> read)
    {
        try { return Convert.ToInt64(read()); }
        catch { return 0; }
    }

    private static bool SafeBool(Func<dynamic> read)
    {
        try { return Convert.ToBoolean(read()); }
        catch { return false; }
    }

    private static bool IsAccessDenied(Exception ex)
    {
        if (ex is UnauthorizedAccessException) return true;
        if (ex is COMException comEx)
        {
            uint code = unchecked((uint)comEx.HResult);
            return code is 0x80070005 or 0x80240044;
        }

        return ex.InnerException != null && IsAccessDenied(ex.InnerException);
    }

    private void SaveStatus(WindowsUpdateStatus status)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_statePath)!);
            File.WriteAllText(_statePath, JsonSerializer.Serialize(status, JsonOptions));
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[WindowsUpdate] Falha ao salvar estado: " + ex.Message);
        }
    }

    private static readonly string[] PendingRebootRegistryKeys =
    {
        @"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending",
        @"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired"
    };

    private sealed class WindowsUpdateInstallResult
    {
        public int ResultCode { get; set; }
        public int HResult { get; set; }
        public bool RebootRequired { get; set; }
    }
}

internal sealed class WindowsUpdateStatus
{
    public string Status { get; set; } = "idle";
    public string Message { get; set; } = "";
    public DateTimeOffset LastCheckedAt { get; set; } = DateTimeOffset.MinValue;
    public bool RebootRequired { get; set; }
    public List<WindowsUpdateItem> Updates { get; set; } = new();
    public string Error { get; set; } = "";
    public int LastInstallResultCode { get; set; }
    public int LastInstallHResult { get; set; }
}

internal sealed class WindowsUpdateItem
{
    public string UpdateId { get; set; } = "";
    public int RevisionNumber { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string MsrcSeverity { get; set; } = "";
    public bool IsDownloaded { get; set; }
    public int RebootBehavior { get; set; }
    public long SizeBytes { get; set; }
}
