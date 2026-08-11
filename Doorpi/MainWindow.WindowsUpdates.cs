using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Doorpi
{
    public partial class MainWindow
    {
        private static readonly JsonSerializerOptions WindowsUpdateHelperJsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        private async Task<WindowsUpdateInstallResult> RunElevatedWindowsUpdateInstallAsync(
            IReadOnlyCollection<WindowsUpdateItem> updates,
            IProgress<WindowsUpdateStatus>? progress)
        {
            string helperPath = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                "DoorpiWindowsUpdateHelper.exe");
            if (!File.Exists(helperPath))
            {
                return Failure("helper", unchecked((int)0x80070002),
                    "Auxiliar administrativo do Windows Update não encontrado.");
            }

            string pipeName = "DoorpiWindowsUpdate-" + Guid.NewGuid().ToString("N");
            using var pipe = new NamedPipeServerStream(
                pipeName,
                PipeDirection.InOut,
                1,
                PipeTransmissionMode.Byte,
                PipeOptions.Asynchronous);

            Process? process = null;
            try
            {
                progress?.Report(new WindowsUpdateStatus
                {
                    Status = "downloading",
                    Message = "Aguardando autorização administrativa do Windows...",
                    LastCheckedAt = DateTimeOffset.UtcNow,
                    RebootRequired = WindowsUpdates.IsRebootRequired(),
                    Updates = updates.ToList(),
                    PackageProgress = updates.Select(update => new WindowsUpdatePackageProgress
                    {
                        UpdateId = update.UpdateId,
                        Title = update.Title,
                        Status = update.IsDownloaded ? "downloaded" : "pending",
                        Percent = update.IsDownloaded ? 100 : 0
                    }).ToList()
                });

                process = Process.Start(new ProcessStartInfo(helperPath, pipeName)
                {
                    UseShellExecute = true,
                    Verb = "runas",
                    WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
                });
                if (process == null)
                    return Failure("helper", unchecked((int)0x80004005),
                        "Não foi possível iniciar o auxiliar administrativo.");

                using var connectTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(60));
                await pipe.WaitForConnectionAsync(connectTimeout.Token).ConfigureAwait(false);

                using var reader = new StreamReader(
                    pipe, Encoding.UTF8, false, bufferSize: 4096, leaveOpen: true);
                using var writer = new StreamWriter(
                    pipe, new UTF8Encoding(false), bufferSize: 4096, leaveOpen: true)
                {
                    AutoFlush = true
                };

                await writer.WriteLineAsync(JsonSerializer.Serialize(new
                {
                    updateIds = updates.Select(update => update.UpdateId).ToList()
                }, WindowsUpdateHelperJsonOptions)).ConfigureAwait(false);

                while (true)
                {
                    string? line = await reader.ReadLineAsync().ConfigureAwait(false);
                    if (line == null)
                        return Failure("helper", unchecked((int)0x80004005),
                            "O helper administrativo encerrou sem retornar um resultado.");

                    using JsonDocument document = JsonDocument.Parse(line);
                    JsonElement root = document.RootElement;
                    string type = root.TryGetProperty("type", out JsonElement typeNode)
                        ? typeNode.GetString() ?? ""
                        : "";

                    if (type == "progress")
                    {
                        string helperStatus = root.TryGetProperty("status", out JsonElement statusNode)
                            ? statusNode.GetString() ?? ""
                            : "";
                        var packageProgress = ReadPackageProgress(root);
                        if (packageProgress.Count == 0)
                        {
                            packageProgress = updates.Select(update => new WindowsUpdatePackageProgress
                            {
                                UpdateId = update.UpdateId,
                                Title = update.Title,
                                Status = update.IsDownloaded ? "downloaded" : "pending",
                                Percent = update.IsDownloaded ? 100 : 0
                            }).ToList();
                        }
                        progress?.Report(new WindowsUpdateStatus
                        {
                            Status = helperStatus == "installing" ? "installing" : "downloading",
                            Message = helperStatus == "installing"
                                ? "Instalando atualizações do Windows..."
                                : helperStatus == "preparing"
                                    ? "Preparando instalação com privilégios administrativos..."
                                    : "Baixando atualizações do Windows...",
                            LastCheckedAt = DateTimeOffset.UtcNow,
                            RebootRequired = WindowsUpdates.IsRebootRequired(),
                            Updates = updates.ToList(),
                            OverallPercent = root.TryGetProperty("overallPercent", out JsonElement overallNode)
                                ? overallNode.GetInt32()
                                : 0,
                            PackageProgress = packageProgress
                        });
                        continue;
                    }

                    if (type == "result")
                    {
                        return JsonSerializer.Deserialize<WindowsUpdateInstallResult>(
                                   line,
                                   WindowsUpdateHelperJsonOptions)
                               ?? Failure("helper", unchecked((int)0x80004005),
                                   "Resposta inválida do auxiliar administrativo.");
                    }
                }
            }
            catch (Win32Exception ex) when (ex.NativeErrorCode == 1223)
            {
                return Failure("cancelled", ex.HResult,
                    "O usuário cancelou a solicitação de privilégios administrativos.");
            }
            catch (OperationCanceledException)
            {
                return Failure("helper", unchecked((int)0x800705B4),
                    "O auxiliar administrativo não respondeu a tempo.");
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[WindowsUpdate] Helper elevado falhou: " + ex.Message);
                return Failure("helper", ex.HResult, ex.Message);
            }
            finally
            {
                try
                {
                    if (process is { HasExited: false })
                        process.Kill(entireProcessTree: true);
                }
                catch { }
                try { process?.Dispose(); } catch { }
            }
        }

        private static List<WindowsUpdatePackageProgress> ReadPackageProgress(JsonElement root)
        {
            if (!root.TryGetProperty("packages", out JsonElement packagesNode)
                || packagesNode.ValueKind != JsonValueKind.Array)
                return new List<WindowsUpdatePackageProgress>();

            return packagesNode.EnumerateArray().Select(package => new WindowsUpdatePackageProgress
            {
                UpdateId = package.TryGetProperty("updateId", out JsonElement idNode)
                    ? idNode.GetString() ?? ""
                    : "",
                Title = package.TryGetProperty("title", out JsonElement titleNode)
                    ? titleNode.GetString() ?? ""
                    : "",
                Status = package.TryGetProperty("status", out JsonElement statusNode)
                    ? statusNode.GetString() ?? "pending"
                    : "pending",
                Percent = package.TryGetProperty("percent", out JsonElement percentNode)
                    ? Math.Clamp(percentNode.GetInt32(), 0, 100)
                    : 0,
                RebootRequired = package.TryGetProperty("rebootRequired", out JsonElement rebootNode)
                    && rebootNode.GetBoolean()
            }).ToList();
        }

        private static WindowsUpdateInstallResult Failure(string phase, int hResult, string error) => new()
        {
            Phase = phase,
            ResultCode = 4,
            HResult = hResult,
            Error = error
        };
    }
}
