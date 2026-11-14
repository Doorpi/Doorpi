using Doorpi.UpdateCore;
using Doorpi.Storage;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Windows;

namespace DoorpiUpdater;

public partial class MainWindow : Window
{
    private static readonly HttpClient HttpClient = new();
    private readonly UpdaterLaunchOptions _options;
    private Mutex? _operationMutex;
    private bool _ownsOperationMutex;
    private readonly List<Mutex> _maintenanceLeases = new();

    public MainWindow()
    {
        InitializeComponent();
        _options = UpdaterLaunchOptions.Parse(Environment.GetCommandLineArgs().Skip(1));
        Loaded += OnLoaded;
        Closed += (_, _) =>
        {
            ReleaseMaintenanceLease();
            if (_ownsOperationMutex) _operationMutex?.ReleaseMutex();
            _operationMutex?.Dispose();
        };
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _operationMutex = new Mutex(false, $@"Local\Doorpi.Updater.{Process.GetCurrentProcess().SessionId}");
        try { _ownsOperationMutex = _operationMutex.WaitOne(0); }
        catch (AbandonedMutexException) { _ownsOperationMutex = true; }
        if (!_ownsOperationMutex)
        {
            SetStatus("Atualização já em andamento", "Aguarde o atualizador que já está aberto.", 0);
            return;
        }
        Activate();
        Focus();
        SetStatus("Atualizando componentes do sistema...", "Preparando ambiente seguro de atualização.", 0.12);

        if (_options.Mode.Equals("update-doorpi", StringComparison.OrdinalIgnoreCase))
        {
            SetStatus("Atualizando Doorpi...",
                "Aguardando o Doorpi finalizar para aplicar o pacote com segurança.",
                0.12);
            _ = RunDoorpiUpdateAsync();
        }
        else
        {
            SetStatus("Atualizador do Doorpi", "Nenhuma operação de atualização foi informada.", 0);
        }

        SignalReady();
    }

    private async Task RunDoorpiUpdateAsync()
    {
        var stateStore = new UpdateStateStore(Path.Combine(DoorpiRuntimePaths.UpdatesFolder, "state.json"));
        UpdateOperationState? state = null;
        Process? launchedDoorpi = null;
        string installFolder = "";
        string doorpiExe = "";
        bool mayRestartDoorpi = false;
        bool rollbackSucceeded = false;

        try
        {
            installFolder = ResolveInstallFolder();
            doorpiExe = Path.Combine(installFolder, "Doorpi.exe");

            await WaitForParentExitAsync();
            AcquireMaintenanceLease();

            // A killed updater can leave a migration or file replacement halfway
            // through. Recover its checkpoint before accepting another operation.
            var interrupted = stateStore.Load();
            mayRestartDoorpi = true;
            if (interrupted is { Component: "doorpi" } &&
                interrupted.Phase is "storage-migrating" or "storage-migrated" or "applying" or
                    "doorpi-applied-pending-health-check" or "rollback" or "rollback-failed" or "doorpi-health-check-failed")
            {
                state = interrupted;
                installFolder = state.InstallFolder;
                doorpiExe = Path.Combine(installFolder, "Doorpi.exe");
                throw new InvalidDataException("Recuperando uma atualização interrompida antes de continuar.");
            }

            SetStatus("Lendo manifesto de atualização...", 0.12);
            if (string.IsNullOrWhiteSpace(_options.ManifestCachePath) || !File.Exists(_options.ManifestCachePath))
                throw new FileNotFoundException("Manifesto cacheado não encontrado.", _options.ManifestCachePath);

            var manifest = UpdateManifestClient.LoadFromFile(_options.ManifestCachePath);
            ValidateCachedManifest(manifest, installFolder);

            var release = manifest.Doorpi;
            if (string.IsNullOrWhiteSpace(release.Version))
                throw new InvalidDataException("Manifesto sem versão do Doorpi.");

            state = new UpdateOperationState
            {
                Component = "doorpi",
                TargetVersion = release.Version,
                Phase = "downloading",
                InstallFolder = installFolder
            };
            stateStore.Save(state);

            SetStatus("Baixando novo pacote do Doorpi...", 0.20);
            var downloader = new PackageDownloader(HttpClient);
            string packagePath = await downloader.DownloadAndVerifyAsync(
                release,
                DoorpiRuntimePaths.DownloadsFolder,
                $"doorpi-{release.Version}.doorpiupdate.zip",
                new Progress<double>(p => SetStatus("Baixando novo pacote do Doorpi...", 0.20 + (p * 0.35))));

            state.PackagePath = packagePath;
            state.StagingFolder = Path.Combine(DoorpiRuntimePaths.StagingFolder, "doorpi-" + release.Version);
            state.BackupFolder = Path.Combine(DoorpiRuntimePaths.BackupFolder, "doorpi-" + release.Version + "-" + state.OperationId);
            state.Phase = "extracting";
            stateStore.Save(state);

            SetStatus("Validando pacote recebido...", 0.60);
            var package = PackageExtractor.ExtractAndValidate(packagePath, state.StagingFolder, "doorpi", release.Version);
            string updaterVersion = GetExecutableVersion(Environment.ProcessPath ?? Path.Combine(AppContext.BaseDirectory, "Updater.exe"));
            UpdateStorageCompatibility.ValidatePackage(package, updaterVersion,
                File.Exists(Path.Combine(DoorpiRuntimePaths.AppDataFolder, "storage", "doorpi.db")));

            if (package.StorageSchemaVersion > 0)
            {
                state.StorageMigrationStarted = true;
                state.Phase = "storage-migrating";
                stateStore.Save(state);
                SetStatus("Preservando e preparando os dados locais...", 0.66);
                var checkpoint = await Task.Run(() => StorageMigration.Prepare(
                    DoorpiRuntimePaths.AppDataFolder, state.OperationId));
                state.StorageBackupDirectory = checkpoint.BackupDirectory;
                state.StorageHadDatabase = checkpoint.HadDatabase;
                state.StorageSchemaVersion = checkpoint.TargetSchemaVersion;
                state.StorageMigrationCompleted = true;
                if (checkpoint.TargetSchemaVersion != package.StorageSchemaVersion)
                    throw new InvalidDataException("O armazenamento preparado não corresponde ao schema exigido pelo pacote.");
                state.Phase = "storage-migrated";
                stateStore.Save(state);
            }

            state.Phase = "applying";
            state.BinaryApplyStarted = true;
            stateStore.Save(state);
            SetStatus("Aplicando arquivos do Doorpi...", 0.74);

            var installer = new ComponentInstaller(["Data", "updates", "Updater"]);
            installer.ApplyFromStaging(state.StagingFolder, installFolder, state.BackupFolder);

            state.Phase = "doorpi-applied-pending-health-check";
            state.HealthSignalPath = Path.Combine(DoorpiRuntimePaths.UpdatesFolder, $"doorpi-health-{Guid.NewGuid():N}.signal");
            if (File.Exists(state.HealthSignalPath))
                File.Delete(state.HealthSignalPath);
            stateStore.Save(state);
            SetStatus("Concluído. Reiniciando Doorpi para validação...", 0.92);

            await Task.Delay(900);
            if (!File.Exists(doorpiExe))
                throw new FileNotFoundException("Doorpi.exe não encontrado após a atualização.", doorpiExe);

            var startInfo = new ProcessStartInfo
            {
                FileName = doorpiExe,
                WorkingDirectory = installFolder,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            // The app validates its configured boot mode. In immersive mode this
            // re-establishes supervision after the old supervisor released its files.
            startInfo.ArgumentList.Add("--doorpi-shell-bootstrap");
            startInfo.ArgumentList.Add("--doorpi-resume-session");
            startInfo.Environment["DOORPI_UPDATE_HEALTH_SIGNAL"] = state.HealthSignalPath;
            ReleaseMaintenanceLease();
            launchedDoorpi = Process.Start(startInfo);

            SetStatus("Aguardando o Doorpi confirmar inicialização saudável...", 0.96);
            // A primeira criação do ambiente WebView2 pode ser mais lenta em PCs
            // modestos. O processo ainda precisa emitir o sinal real; apenas damos
            // tempo suficiente para a verificação do bootstrap concluir.
            bool healthy = await WaitForHealthSignalAsync(state.HealthSignalPath, launchedDoorpi, TimeSpan.FromSeconds(120));
            if (!healthy)
                throw new InvalidDataException("O Doorpi atualizado não confirmou inicialização saudável.");

            state.Phase = "succeeded";
            stateStore.Save(state);
            UpdateArtifactCleaner.CleanupCompletedOperation(state);
            stateStore.Clear();
            UpdateArtifactCleaner.CleanupInactiveArtifacts();

            SetStatus("Atualização concluída.", 1);
            await Task.Delay(800);
            Dispatcher.Invoke(() => Application.Current.Shutdown());
        }
        catch (Exception ex)
        {
            try
            {
                if (launchedDoorpi is { HasExited: false } || state?.Phase is
                    "doorpi-applied-pending-health-check" or "rollback" or "rollback-failed")
                {
                    SetStatus("Falha na verificação de inicialização. Encerrando o Doorpi para restaurar a versão anterior...", 0.78);
                    await StopUpdatedDoorpiProcessesAsync(doorpiExe);
                    AcquireMaintenanceLease();
                }

                if (state != null)
                {
                    state.Phase = "rollback";
                    state.Error = ex.Message;
                    stateStore.Save(state);

                    SetStatus("Falha detectada. Restaurando dados e arquivos compatíveis...", 0.80);
                    await Task.Run(() => UpdateRollback.Restore(state, DoorpiRuntimePaths.AppDataFolder));
                    state.Phase = "rolled-back";
                    stateStore.Save(state);
                }
                rollbackSucceeded = mayRestartDoorpi;
            }
            catch (Exception rollbackEx)
            {
                Debug.WriteLine("[Updater] Falha no rollback: " + rollbackEx);
                mayRestartDoorpi = false;
                if (state != null)
                {
                    state.Phase = "rollback-failed";
                    state.Error = ex.Message + " | Recuperação: " + rollbackEx.Message;
                    try { stateStore.Save(state); } catch { }
                }
            }

            try
            {
                string restartFolder = !string.IsNullOrWhiteSpace(state?.InstallFolder)
                    ? state.InstallFolder
                    : installFolder;
                string restoredDoorpi = !string.IsNullOrWhiteSpace(restartFolder)
                    ? Path.Combine(restartFolder, "Doorpi.exe")
                    : doorpiExe;

                if (mayRestartDoorpi && !string.IsNullOrWhiteSpace(restoredDoorpi) && File.Exists(restoredDoorpi))
                {
                    ReleaseMaintenanceLease();
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = restoredDoorpi,
                        Arguments = "--doorpi-shell-bootstrap --doorpi-resume-session",
                        WorkingDirectory = Path.GetDirectoryName(restoredDoorpi)!,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    });
                }
            }
            catch (Exception restartEx)
            {
                Debug.WriteLine("[Updater] Falha ao reabrir o Doorpi após a restauração: " + restartEx);
            }

            try
            {
                SetStatus(rollbackSucceeded
                    ? "Não foi possível concluir a atualização. A versão anterior foi preservada ou restaurada."
                    : "A recuperação não foi concluída. Os backups foram preservados; o Doorpi não será iniciado com dados incompatíveis.", ex.Message, 1);
                await Task.Delay(1200);
            }
            finally
            {
                await Dispatcher.InvokeAsync(() => Application.Current.Shutdown());
            }
        }
    }

    private static void ValidateCachedManifest(UpdateManifest manifest, string installFolder)
    {
        var trust = GetUpdaterTrustSettings(installFolder);
        if (trust.RequireManifestSignature || manifest.Signature != null)
        {
            string key = ResolveManifestPublicKey(manifest, trust, installFolder);
            ManifestSignatureVerifier.Verify(manifest, key);
        }

        var manifestStateStore = new UpdateManifestStateStore(Path.Combine(DoorpiRuntimePaths.UpdatesFolder, "manifest-state.json"));
        UpdateManifestValidator.Validate(
            manifest,
            UpdateSecurityPolicy.Current,
            manifestStateStore.Load(),
            DateTimeOffset.UtcNow);

        string localDoorpiVersion = GetExecutableVersion(Path.Combine(installFolder, "Doorpi.exe"));
        UpdateManifestValidator.ValidateNoUnsignedDowngrade(manifest.Doorpi, localDoorpiVersion, "Doorpi");
        // Validate the updater that is actually executing, not the offered package.
        UpdateManifestValidator.ValidateMinimumUpdaterVersion(
            manifest.Doorpi,
            GetExecutableVersion(Environment.ProcessPath ?? Path.Combine(AppContext.BaseDirectory, "Updater.exe")));
    }

    private static UpdateTrustSettings GetUpdaterTrustSettings(string installFolder)
    {
        var policy = UpdateSecurityPolicy.Current;
        var settings = new UpdateTrustSettings
        {
            RequireManifestSignature = policy.RequireManifestSignature
        };

        if (!policy.AllowTrustSettingsOverride)
            return settings;

        string settingsPath = Path.Combine(installFolder, "update-settings.json");
        if (!File.Exists(settingsPath))
            return settings;

        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(settingsPath));
            var root = doc.RootElement;

            if (root.TryGetProperty("requireManifestSignature", out var requireEl)
                && (requireEl.ValueKind == JsonValueKind.True || requireEl.ValueKind == JsonValueKind.False))
                settings.RequireManifestSignature = requireEl.GetBoolean();

            if (root.TryGetProperty("manifestPublicKeyXml", out var keyEl))
                settings.ManifestPublicKeyXml = keyEl.GetString() ?? "";

            if (root.TryGetProperty("manifestPublicKeyPath", out var pathEl))
                settings.ManifestPublicKeyPath = pathEl.GetString() ?? "";
        }
        catch
        {
            // Invalid test settings are treated as missing settings.
        }

        return settings;
    }

    private static string ResolveManifestPublicKey(UpdateManifest manifest, UpdateTrustSettings trust, string installFolder)
    {
        if (!UpdateSecurityPolicy.Current.AllowTrustSettingsOverride)
            return TrustedUpdateKeys.ResolveProductionKey(manifest.Signature?.KeyId ?? "");

        string configuredKey = trust.ResolvePublicKeyXml(installFolder);
        if (!string.IsNullOrWhiteSpace(configuredKey))
            return configuredKey;

        return TrustedUpdateKeys.ResolveProductionKey(manifest.Signature?.KeyId ?? "");
    }

    private static string GetExecutableVersion(string path)
    {
        if (!File.Exists(path)) return "0.0.0";

        var info = FileVersionInfo.GetVersionInfo(path);
        return (info.ProductVersion ?? info.FileVersion ?? "0.0.0").Split('+')[0];
    }

    private void AcquireMaintenanceLease()
    {
        if (_maintenanceLeases.Count > 0) return;
        try
        {
            int sessionId = Process.GetCurrentProcess().SessionId;
            foreach (string role in new[] { "Supervisor", "Main" })
            {
                var mutex = new Mutex(false, $@"Local\Doorpi.{role}.{sessionId}");
                bool acquired;
                try { acquired = mutex.WaitOne(0); }
                catch (AbandonedMutexException) { acquired = true; }
                if (!acquired)
                {
                    mutex.Dispose();
                    throw new IOException("O Doorpi ainda está aberto. Feche a interface antes de migrar ou restaurar os dados.");
                }
                _maintenanceLeases.Add(mutex);
            }
        }
        catch
        {
            ReleaseMaintenanceLease();
            throw;
        }
    }

    private void ReleaseMaintenanceLease()
    {
        foreach (var mutex in _maintenanceLeases)
        {
            mutex.ReleaseMutex();
            mutex.Dispose();
        }
        _maintenanceLeases.Clear();
    }

    private static async Task StopUpdatedDoorpiProcessesAsync(string executablePath)
    {
        string expected = Path.GetFullPath(executablePath);
        int windowsSession = Process.GetCurrentProcess().SessionId;
        for (int attempt = 0; attempt < 4; attempt++)
        {
            var owned = new List<Process>();
            foreach (var process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(expected)))
            {
                try
                {
                    if (process.Id != Environment.ProcessId && process.SessionId == windowsSession &&
                        string.Equals(process.MainModule?.FileName, expected, StringComparison.OrdinalIgnoreCase))
                        owned.Add(process);
                    else process.Dispose();
                }
                catch { process.Dispose(); }
            }
            if (owned.Count == 0) return;
            if (attempt == 3)
            {
                foreach (var process in owned) process.Dispose();
                throw new IOException("Não foi possível encerrar a versão nova do Doorpi antes da recuperação dos dados.");
            }
            try
            {
                // Supervisor and UI are both owned Doorpi executables. Games and
                // unrelated descendants must survive a failed UI health check.
                foreach (var process in owned)
                    if (!process.HasExited) process.Kill(entireProcessTree: false);
                foreach (var process in owned)
                    await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(15));
            }
            finally
            {
                foreach (var process in owned) process.Dispose();
            }
            await Task.Delay(200);
        }
        throw new IOException("Não foi possível encerrar a versão nova do Doorpi antes da recuperação dos dados.");
    }

    private static async Task<bool> WaitForHealthSignalAsync(string healthSignalPath, Process? process, TimeSpan timeout)
    {
        var deadline = DateTimeOffset.UtcNow.Add(timeout);
        while (DateTimeOffset.UtcNow < deadline)
        {
            if (File.Exists(healthSignalPath))
                return true;

            if (process != null && process.HasExited)
                return false;

            await Task.Delay(250);
        }

        return File.Exists(healthSignalPath);
    }

    private string ResolveInstallFolder()
    {
        if (!string.IsNullOrWhiteSpace(_options.InstallFolder))
            return Path.GetFullPath(_options.InstallFolder);

        var updaterFolder = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar);
        return Path.GetFullPath(Path.Combine(updaterFolder, ".."));
    }

    private async Task WaitForParentExitAsync()
    {
        if (_options.ParentProcessId <= 0)
            return;

        try
        {
            using var process = Process.GetProcessById(_options.ParentProcessId);
            SetStatus("Aguardando o Doorpi encerrar com segurança...", 0.10);
            await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(45));
        }
        catch (ArgumentException)
        {
            // Processo já encerrou.
        }
    }

    private void SignalReady()
    {
        if (string.IsNullOrWhiteSpace(_options.ReadySignalPath))
            return;

        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_options.ReadySignalPath)!);
            File.WriteAllText(_options.ReadySignalPath, DateTimeOffset.UtcNow.ToString("O"));
        }
        catch
        {
            // A falha do sinal não deve derrubar a tela de atualização.
        }
    }

    private void SetStatus(string message, double progress)
        => SetStatus("Atualizando Doorpi...", message, progress);

    private void SetStatus(string title, string message, double progress)
    {
        Dispatcher.Invoke(() =>
        {
            UpdateView.SetStatus(title, message, progress);
        });
    }
}
