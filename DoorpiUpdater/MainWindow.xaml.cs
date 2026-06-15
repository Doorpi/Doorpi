using Doorpi.UpdateCore;
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

    public MainWindow()
    {
        InitializeComponent();
        _options = UpdaterLaunchOptions.Parse(Environment.GetCommandLineArgs().Skip(1));
        Loaded += OnLoaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        Activate();
        Focus();
        SetStatus("Atualizando componentes do sistema...", "Preparando ambiente seguro de atualizacao.", 0.12);

        if (_options.Mode.Equals("update-doorpi", StringComparison.OrdinalIgnoreCase))
        {
            SetStatus("Atualizando Doorpi...",
                "Aguardando o Doorpi finalizar para aplicar o pacote com seguranca.",
                0.12);
            _ = RunDoorpiUpdateAsync();
        }
        else
        {
            SetStatus("Doorpi Updater", "Nenhuma operacao de update foi informada.", 0);
        }

        SignalReady();
    }

    private async Task RunDoorpiUpdateAsync()
    {
        var stateStore = new UpdateStateStore(Path.Combine(DoorpiRuntimePaths.UpdatesFolder, "state.json"));
        UpdateOperationState? state = null;
        Process? launchedDoorpi = null;

        try
        {
            string installFolder = ResolveInstallFolder();
            string doorpiExe = Path.Combine(installFolder, "Doorpi.exe");

            await WaitForParentExitAsync();

            SetStatus("Lendo manifesto de atualizacao...", 0.12);
            if (string.IsNullOrWhiteSpace(_options.ManifestCachePath) || !File.Exists(_options.ManifestCachePath))
                throw new FileNotFoundException("Manifesto cacheado nao encontrado.", _options.ManifestCachePath);

            var manifest = UpdateManifestClient.LoadFromFile(_options.ManifestCachePath);
            ValidateCachedManifest(manifest, installFolder);

            var release = manifest.Doorpi;
            if (string.IsNullOrWhiteSpace(release.Version))
                throw new InvalidDataException("Manifesto sem versao do Doorpi.");

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
                $"doorpi-{release.Version}-win-x64.zip",
                new Progress<double>(p => SetStatus("Baixando novo pacote do Doorpi...", 0.20 + (p * 0.35))));

            state.PackagePath = packagePath;
            state.StagingFolder = Path.Combine(DoorpiRuntimePaths.StagingFolder, "doorpi-" + release.Version);
            state.BackupFolder = Path.Combine(DoorpiRuntimePaths.BackupFolder, "doorpi-" + release.Version);
            state.Phase = "extracting";
            stateStore.Save(state);

            SetStatus("Validando pacote recebido...", 0.60);
            PackageExtractor.ExtractAndValidate(packagePath, state.StagingFolder, "doorpi", release.Version);

            state.Phase = "applying";
            stateStore.Save(state);
            SetStatus("Aplicando arquivos do Doorpi...", 0.74);

            var installer = new ComponentInstaller(["Data", "updates", "Updater"]);
            installer.ApplyFromStaging(state.StagingFolder, installFolder, state.BackupFolder);

            state.Phase = "doorpi-applied-pending-health-check";
            state.HealthSignalPath = Path.Combine(DoorpiRuntimePaths.UpdatesFolder, $"doorpi-health-{Guid.NewGuid():N}.signal");
            if (File.Exists(state.HealthSignalPath))
                File.Delete(state.HealthSignalPath);
            stateStore.Save(state);
            SetStatus("Concluido. Reiniciando Doorpi para validacao...", 0.92);

            await Task.Delay(900);
            if (!File.Exists(doorpiExe))
                throw new FileNotFoundException("Doorpi.exe nao encontrado apos update.", doorpiExe);

            var startInfo = new ProcessStartInfo
            {
                FileName = doorpiExe,
                WorkingDirectory = installFolder,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            startInfo.Environment["DOORPI_UPDATE_HEALTH_SIGNAL"] = state.HealthSignalPath;
            launchedDoorpi = Process.Start(startInfo);

            SetStatus("Aguardando o Doorpi confirmar inicializacao saudavel...", 0.96);
            bool healthy = await WaitForHealthSignalAsync(state.HealthSignalPath, launchedDoorpi, TimeSpan.FromSeconds(30));
            if (!healthy)
                throw new InvalidDataException("O Doorpi atualizado nao confirmou inicializacao saudavel.");

            state.Phase = "succeeded";
            stateStore.Save(state);
            stateStore.Clear();

            SetStatus("Atualizacao concluida.", 1);
            await Task.Delay(800);
            Dispatcher.Invoke(() => Application.Current.Shutdown());
        }
        catch (Exception ex)
        {
            try
            {
                if (launchedDoorpi is { HasExited: false })
                {
                    SetStatus("Falha no health check. Encerrando Doorpi para rollback...", 0.78);
                    launchedDoorpi.Kill(entireProcessTree: true);
                    await launchedDoorpi.WaitForExitAsync();
                }

                if (state != null)
                {
                    state.Phase = "rollback";
                    state.Error = ex.Message;
                    stateStore.Save(state);

                    if (!string.IsNullOrWhiteSpace(state.BackupFolder) && Directory.Exists(state.BackupFolder))
                    {
                        SetStatus("Falha detectada. Restaurando backup...", 0.80);
                        new ComponentInstaller(["Data", "updates", "Updater"])
                            .Rollback(state.BackupFolder, state.InstallFolder);
                    }

                    string restoredDoorpi = Path.Combine(state.InstallFolder, "Doorpi.exe");
                    if (File.Exists(restoredDoorpi))
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = restoredDoorpi,
                            WorkingDirectory = state.InstallFolder,
                            UseShellExecute = false,
                            CreateNoWindow = true
                        });
                    }
                }
            }
            catch (Exception rollbackEx)
            {
                Debug.WriteLine("[Updater] Falha no rollback: " + rollbackEx);
            }

            SetStatus("Nao foi possivel concluir a atualizacao: " + ex.Message, 1);
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
            SetStatus("Aguardando o Doorpi encerrar com seguranca...", 0.10);
            while (!process.HasExited)
                await Task.Delay(150);
        }
        catch (ArgumentException)
        {
            // Processo ja encerrou.
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
            // A falha do sinal nao deve derrubar a tela de update.
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
