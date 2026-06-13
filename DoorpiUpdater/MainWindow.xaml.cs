using Doorpi.UpdateCore;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
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
        SizeChanged += (_, _) => UpdateProgress(0.12);
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        Activate();
        Focus();
        UpdateProgress(0.12);

        if (_options.Mode.Equals("update-doorpi", StringComparison.OrdinalIgnoreCase))
        {
            TitleText.Text = "Atualizando Doorpi...";
            StatusText.Text = "Aguardando o Doorpi finalizar para aplicar o pacote com seguranca.";
            _ = RunDoorpiUpdateAsync();
        }
        else
        {
            StatusText.Text = "Nenhuma operacao de update foi informada.";
        }

        SignalReady();
    }

    private async Task RunDoorpiUpdateAsync()
    {
        var stateStore = new UpdateStateStore(Path.Combine(DoorpiRuntimePaths.UpdatesFolder, "state.json"));
        UpdateOperationState? state = null;

        try
        {
            string installFolder = ResolveInstallFolder();
            string doorpiExe = Path.Combine(installFolder, "Doorpi.exe");

            await WaitForParentExitAsync();

            SetStatus("Lendo manifesto de atualizacao...", 0.12);
            if (string.IsNullOrWhiteSpace(_options.ManifestCachePath) || !File.Exists(_options.ManifestCachePath))
                throw new FileNotFoundException("Manifesto cacheado nao encontrado.", _options.ManifestCachePath);

            var manifest = UpdateManifestClient.LoadFromFile(_options.ManifestCachePath);
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
            stateStore.Save(state);
            SetStatus("Concluido. Reiniciando Doorpi...", 0.96);

            await Task.Delay(900);
            if (!File.Exists(doorpiExe))
                throw new FileNotFoundException("Doorpi.exe nao encontrado apos update.", doorpiExe);

            Process.Start(new ProcessStartInfo
            {
                FileName = doorpiExe,
                WorkingDirectory = installFolder,
                UseShellExecute = false,
                CreateNoWindow = true
            });

            await Task.Delay(800);
            Dispatcher.Invoke(() => Application.Current.Shutdown());
        }
        catch (Exception ex)
        {
            try
            {
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
                }
            }
            catch (Exception rollbackEx)
            {
                Debug.WriteLine("[Updater] Falha no rollback: " + rollbackEx);
            }

            SetStatus("Nao foi possivel concluir a atualizacao: " + ex.Message, 1);
        }
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

    private void UpdateProgress(double value)
    {
        value = Math.Clamp(value, 0, 1);
        double width = ActualWidth > 0 ? Math.Min(920, ActualWidth * 0.72) : 920;
        ProgressFill.Width = width * value;
    }

    private void SetStatus(string message, double progress)
    {
        Dispatcher.Invoke(() =>
        {
            StatusText.Text = message;
            UpdateProgress(progress);
        });
    }
}
