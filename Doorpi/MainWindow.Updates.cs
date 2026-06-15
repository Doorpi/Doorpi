using Doorpi.UpdateCore;
using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;

namespace Doorpi
{
    public partial class MainWindow
    {
        private static readonly HttpClient updateHttpClient = new HttpClient();
        private readonly SemaphoreSlim _updateCheckLock = new(1, 1);
        private UpdateDecision? _lastUpdateDecision;
        private DateTimeOffset _lastUpdateCheckUtc = DateTimeOffset.MinValue;
        private bool _startupUpdateCheckStarted;
        private bool _forceUpdateStarted;
        private UpdateProgressWindow? _updateProgressWindow;

        private string ManifestCachePath => Path.Combine(DoorpiRuntimePaths.UpdatesFolder, "manifest-cache.json");
        private string UpdateStatePath => Path.Combine(DoorpiRuntimePaths.UpdatesFolder, "state.json");
        private string ManifestStatePath => Path.Combine(DoorpiRuntimePaths.UpdatesFolder, "manifest-state.json");

        private string DoorpiVersion =>
            Assembly.GetExecutingAssembly()
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
                .InformationalVersion
                .Split('+')[0]
            ?? Assembly.GetExecutingAssembly().GetName().Version?.ToString(3)
            ?? "0.0.0";

        private string UpdaterVersion
        {
            get
            {
                try
                {
                    string updaterPath = GetUpdaterExecutablePath();
                    if (!File.Exists(updaterPath)) return "0.0.0";

                    var info = FileVersionInfo.GetVersionInfo(updaterPath);
                    return FirstNonEmptyUpdateVersion(info.ProductVersion, info.FileVersion) ?? "0.0.0";
                }
                catch
                {
                    return "0.0.0";
                }
            }
        }

        private static string? FirstNonEmptyUpdateVersion(params string?[] values)
            => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

        private static string GetConfiguredManifestUrl()
        {
            var policy = UpdateSecurityPolicy.Current;
            if (!policy.AllowTrustSettingsOverride)
                return policy.DefaultManifestUrl;

            string envUrl = Environment.GetEnvironmentVariable("DOORPI_UPDATE_MANIFEST_URL") ?? "";
            if (!string.IsNullOrWhiteSpace(envUrl)) return envUrl.Trim();

            foreach (string path in new[]
            {
                Path.Combine(DoorpiRuntimePaths.AppDataFolder, "update-settings.json"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "update-settings.json")
            })
            {
                try
                {
                    if (!File.Exists(path)) continue;
                    using var doc = JsonDocument.Parse(File.ReadAllText(path));
                    if (doc.RootElement.TryGetProperty("manifestUrl", out var urlEl))
                    {
                        string url = urlEl.GetString() ?? "";
                        if (!string.IsNullOrWhiteSpace(url)) return url.Trim();
                    }
                }
                catch
                {
                    // Configuracao invalida apenas cai no default.
                }
            }

            return policy.DefaultManifestUrl;
        }

        private static UpdateTrustSettings GetUpdateTrustSettings(string manifestUrl, bool isLocalManifest)
        {
            var policy = UpdateSecurityPolicy.Current;
            var settings = new UpdateTrustSettings
            {
                RequireManifestSignature = policy.RequireManifestSignature || !isLocalManifest
            };

            if (!policy.AllowTrustSettingsOverride)
                return settings;

            foreach (string path in new[]
            {
                Path.Combine(DoorpiRuntimePaths.AppDataFolder, "update-settings.json"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "update-settings.json")
            })
            {
                try
                {
                    if (!File.Exists(path)) continue;
                    using var doc = JsonDocument.Parse(File.ReadAllText(path));
                    var root = doc.RootElement;

                    if (root.TryGetProperty("requireManifestSignature", out var requireEl)
                        && (requireEl.ValueKind == JsonValueKind.True || requireEl.ValueKind == JsonValueKind.False))
                        settings.RequireManifestSignature = requireEl.GetBoolean();

                    if (root.TryGetProperty("manifestPublicKeyXml", out var keyEl))
                        settings.ManifestPublicKeyXml = keyEl.GetString() ?? settings.ManifestPublicKeyXml;

                    if (root.TryGetProperty("manifestPublicKeyPath", out var pathEl))
                        settings.ManifestPublicKeyPath = pathEl.GetString() ?? settings.ManifestPublicKeyPath;
                }
                catch
                {
                    // Configuracao invalida apenas cai nas regras padrao.
                }
            }

            string envKeyPath = Environment.GetEnvironmentVariable("DOORPI_UPDATE_PUBLIC_KEY_PATH") ?? "";
            if (!string.IsNullOrWhiteSpace(envKeyPath))
                settings.ManifestPublicKeyPath = envKeyPath.Trim();

            if (manifestUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                settings.RequireManifestSignature = true;

            return settings;
        }

        private static string ResolveManifestPublicKey(UpdateManifest manifest, UpdateTrustSettings trust, string baseFolder)
        {
            if (!UpdateSecurityPolicy.Current.AllowTrustSettingsOverride)
                return TrustedUpdateKeys.ResolveProductionKey(manifest.Signature?.KeyId ?? "");

            string configuredKey = trust.ResolvePublicKeyXml(baseFolder);
            if (!string.IsNullOrWhiteSpace(configuredKey))
                return configuredKey;

            return TrustedUpdateKeys.ResolveProductionKey(manifest.Signature?.KeyId ?? "");
        }

        private static bool TryGetManifestFilePath(string manifestUrl, out string path)
        {
            path = "";
            if (Uri.TryCreate(manifestUrl, UriKind.Absolute, out var uri) && uri.IsFile)
            {
                path = uri.LocalPath;
                return File.Exists(path);
            }

            if (!Uri.TryCreate(manifestUrl, UriKind.Absolute, out _)
                && File.Exists(manifestUrl))
            {
                path = manifestUrl;
                return true;
            }

            return false;
        }

        private static string GetUpdaterExecutablePath()
        {
            string nested = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Updater", "Updater.exe");
            if (File.Exists(nested)) return nested;
            return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Updater.exe");
        }

        private async Task CheckForUpdatesAsync(bool userInitiated)
        {
            await _updateCheckLock.WaitAsync().ConfigureAwait(false);
            try
            {
                SendUpdateStatusToUI("checking", "Verificando atualizacoes...", null);

                string manifestUrl = GetConfiguredManifestUrl();
                if (string.IsNullOrWhiteSpace(manifestUrl)
                    || manifestUrl.Contains("example.com", StringComparison.OrdinalIgnoreCase))
                {
                    SendUpdateStatusToUI("not-configured", "Canal de atualizacao ainda nao configurado.", null);
                    return;
                }

                UpdateManifest manifest;
                bool isLocalManifest = TryGetManifestFilePath(manifestUrl, out string manifestFilePath);
                var policy = UpdateSecurityPolicy.Current;
                if (isLocalManifest && !policy.AllowLocalManifest)
                    throw new InvalidDataException("Manifesto local nao permitido em build de producao.");

                if (isLocalManifest)
                {
                    manifest = UpdateManifestClient.LoadFromFile(manifestFilePath);
                }
                else
                {
                    if (!Uri.TryCreate(manifestUrl, UriKind.Absolute, out var manifestUri))
                        throw new InvalidDataException("URL do manifesto invalida.");

                    var client = new UpdateManifestClient(updateHttpClient);
                    manifest = await client.GetManifestAsync(manifestUri).ConfigureAwait(false);
                }

                var trust = GetUpdateTrustSettings(manifestUrl, isLocalManifest);
                if (trust.RequireManifestSignature || manifest.Signature != null)
                {
                    string baseFolder = isLocalManifest
                        ? Path.GetDirectoryName(manifestFilePath) ?? AppDomain.CurrentDomain.BaseDirectory
                        : AppDomain.CurrentDomain.BaseDirectory;
                    ManifestSignatureVerifier.Verify(manifest, ResolveManifestPublicKey(manifest, trust, baseFolder));
                }

                var manifestStateStore = new UpdateManifestStateStore(ManifestStatePath);
                UpdateManifestState? previousManifestState = manifestStateStore.Load();
                UpdateManifestValidator.Validate(
                    manifest,
                    policy,
                    previousManifestState,
                    DateTimeOffset.UtcNow);
                UpdateManifestValidator.ValidateNoUnsignedDowngrade(manifest.Doorpi, DoorpiVersion, "Doorpi");
                UpdateManifestValidator.ValidateNoUnsignedDowngrade(manifest.Updater, UpdaterVersion, "Updater");

                Directory.CreateDirectory(DoorpiRuntimePaths.UpdatesFolder);
                UpdateManifestClient.SaveToFile(manifest, ManifestCachePath);
                manifestStateStore.Save(new UpdateManifestState
                {
                    Channel = manifest.Channel,
                    HighestManifestVersion = Math.Max(
                        manifest.ManifestVersion,
                        previousManifestState?.HighestManifestVersion ?? 0)
                });

                var decision = UpdatePlanner.Decide(manifest, DoorpiVersion, UpdaterVersion);
                _lastUpdateDecision = decision;
                _lastUpdateCheckUtc = DateTimeOffset.UtcNow;

                string status = decision.HasAnyUpdate ? "available" : "up-to-date";
                string message = decision.HasAnyUpdate
                    ? "Atualizacao disponivel."
                    : "Sistema atualizado.";
                SendUpdateStatusToUI(status, message, decision);

                if (decision.ForceUpdate && decision.HasAnyUpdate && !_forceUpdateStarted)
                {
                    _forceUpdateStarted = true;
                    ShowUpdateProgress("Atualizacao obrigatoria",
                        "O Doorpi precisa aplicar uma atualizacao antes de continuar.",
                        0.08);
                    _ = Task.Run(() => StartSystemUpdateAsync());
                }
                else if (!decision.ForceUpdate)
                {
                    CloseUpdateProgress();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Updates] Falha ao verificar atualizacoes: " + ex);
                SendUpdateStatusToUI("error", userInitiated
                    ? "Nao foi possivel verificar atualizacoes."
                    : "Verificacao de atualizacao falhou em segundo plano.", _lastUpdateDecision);
            }
            finally
            {
                _updateCheckLock.Release();
            }
        }

        private void BeginStartupUpdateCheck()
        {
            if (_startupUpdateCheckStarted) return;
            _startupUpdateCheckStarted = true;
            CompletePendingDoorpiHealthCheck();

            _ = Task.Run(() => CheckForUpdatesAsync(userInitiated: false));
        }

        private async Task StartSystemUpdateAsync()
        {
            try
            {
                if (_lastUpdateDecision == null)
                    await CheckForUpdatesAsync(userInitiated: true).ConfigureAwait(false);

                var decision = _lastUpdateDecision;
                if (decision == null || !decision.HasAnyUpdate)
                {
                    SendUpdateStatusToUI("up-to-date", "Sistema atualizado.", decision);
                    return;
                }

                if (decision.UpdaterUpdateAvailable && decision.UpdaterRelease != null)
                {
                    await InstallUpdaterUpdateAsync(decision.UpdaterRelease).ConfigureAwait(false);
                }

                if (decision.DoorpiUpdateAvailable)
                {
                    await LaunchUpdaterForDoorpiAsync(decision).ConfigureAwait(false);
                    return;
                }

                SendUpdateStatusToUI("complete", "Componentes do sistema atualizados.", decision);
                ShowUpdateProgress("Atualizacao concluida", "Componentes do sistema atualizados.", 1);
                await Task.Delay(900).ConfigureAwait(false);
                CloseUpdateProgress();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Updates] Falha ao iniciar atualizacao: " + ex);
                SendUpdateStatusToUI("error", "Falha ao aplicar atualizacao: " + ex.Message, _lastUpdateDecision);
            }
        }

        private async Task InstallUpdaterUpdateAsync(ComponentRelease release)
        {
            SendUpdateStatusToUI("downloading", "Baixando atualizacao do Updater...", _lastUpdateDecision);
            ShowUpdateProgress("Atualizando componentes do sistema...",
                "Baixando atualizacao do Updater...",
                0.16);

            Directory.CreateDirectory(DoorpiRuntimePaths.UpdatesFolder);
            var stateStore = new UpdateStateStore(UpdateStatePath);
            var state = new UpdateOperationState
            {
                Component = "updater",
                TargetVersion = release.Version,
                Phase = "downloading",
                InstallFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Updater")
            };
            stateStore.Save(state);

            var downloader = new PackageDownloader(updateHttpClient);
            string fileName = $"updater-{release.Version}-win-x64.zip";
            string packagePath = await downloader.DownloadAndVerifyAsync(
                release,
                DoorpiRuntimePaths.DownloadsFolder,
                fileName,
                new Progress<double>(p => ShowUpdateProgress("Atualizando componentes do sistema...",
                    "Baixando atualizacao do Updater...",
                    0.16 + (p * 0.34))),
                cancellationToken: CancellationToken.None).ConfigureAwait(false);

            state.PackagePath = packagePath;
            state.StagingFolder = Path.Combine(DoorpiRuntimePaths.StagingFolder, "updater-" + release.Version);
            state.BackupFolder = Path.Combine(DoorpiRuntimePaths.BackupFolder, "updater-" + release.Version);
            state.Phase = "extracting";
            stateStore.Save(state);

            PackageExtractor.ExtractAndValidate(packagePath, state.StagingFolder, "updater", release.Version);
            ShowUpdateProgress("Atualizando componentes do sistema...",
                "Validando e preparando novo Updater...",
                0.62);

            state.Phase = "applying";
            stateStore.Save(state);
            SendUpdateStatusToUI("installing", "Instalando novo Updater...", _lastUpdateDecision);
            ShowUpdateProgress("Atualizando componentes do sistema...",
                "Instalando novo Updater...",
                0.78);

            var installer = new ComponentInstaller();
            installer.ApplyFromStaging(state.StagingFolder, state.InstallFolder, state.BackupFolder);

            state.Phase = "succeeded";
            stateStore.Save(state);
            stateStore.Clear();
            ShowUpdateProgress("Atualizando componentes do sistema...",
                "Updater atualizado com sucesso.",
                0.92);
        }

        private async Task LaunchUpdaterForDoorpiAsync(UpdateDecision decision)
        {
            if (decision.Manifest == null)
                throw new InvalidOperationException("Manifesto nao carregado.");

            UpdateManifestClient.SaveToFile(decision.Manifest, ManifestCachePath);

            string updaterPath = GetUpdaterExecutablePath();
            if (!File.Exists(updaterPath))
                throw new FileNotFoundException("Updater.exe nao encontrado.", updaterPath);

            string readySignal = Path.Combine(DoorpiRuntimePaths.UpdatesFolder, $"updater-ready-{Guid.NewGuid():N}.signal");
            if (File.Exists(readySignal)) File.Delete(readySignal);
            Directory.CreateDirectory(DoorpiRuntimePaths.UpdatesFolder);

            SendUpdateStatusToUI("handoff", "Abrindo atualizador do sistema...", decision);
            ShowUpdateProgress("Atualizando Doorpi...",
                "Abrindo atualizador do sistema...",
                0.10);

            var startInfo = new ProcessStartInfo
            {
                FileName = updaterPath,
                WorkingDirectory = Path.GetDirectoryName(updaterPath) ?? AppDomain.CurrentDomain.BaseDirectory,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            startInfo.ArgumentList.Add("--mode");
            startInfo.ArgumentList.Add("update-doorpi");
            startInfo.ArgumentList.Add("--parent-pid");
            startInfo.ArgumentList.Add(Environment.ProcessId.ToString());
            startInfo.ArgumentList.Add("--manifest-cache");
            startInfo.ArgumentList.Add(ManifestCachePath);
            startInfo.ArgumentList.Add("--install-folder");
            startInfo.ArgumentList.Add(AppDomain.CurrentDomain.BaseDirectory);
            startInfo.ArgumentList.Add("--ready-signal");
            startInfo.ArgumentList.Add(readySignal);

            Process.Start(startInfo);

            var deadline = DateTime.UtcNow.AddSeconds(12);
            while (DateTime.UtcNow < deadline && !File.Exists(readySignal))
                await Task.Delay(100).ConfigureAwait(false);

            if (!File.Exists(readySignal))
                throw new TimeoutException("O Updater nao sinalizou prontidao.");

            Dispatcher.Invoke(() =>
            {
                CleanupAndExit();
                Application.Current.Shutdown();
                Environment.Exit(0);
            });
        }

        private void CompletePendingDoorpiHealthCheck()
        {
            try
            {
                var stateStore = new UpdateStateStore(UpdateStatePath);
                var state = stateStore.Load();
                if (state == null) return;

                if (string.Equals(state.Component, "doorpi", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(state.Phase, "doorpi-applied-pending-health-check", StringComparison.OrdinalIgnoreCase))
                {
                    bool healthyVersion = !UpdateVersionComparer.IsRemoteNewer(state.TargetVersion, DoorpiVersion);
                    if (!healthyVersion)
                    {
                        state.Error = $"Versao iniciada ({DoorpiVersion}) nao corresponde ao alvo ({state.TargetVersion}).";
                        state.Phase = "doorpi-health-check-failed";
                        stateStore.Save(state);
                        return;
                    }

                    string healthSignal = Environment.GetEnvironmentVariable("DOORPI_UPDATE_HEALTH_SIGNAL") ?? "";
                    if (!string.IsNullOrWhiteSpace(healthSignal))
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(healthSignal)!);
                        File.WriteAllText(healthSignal, DateTimeOffset.UtcNow.ToString("O"));
                        return;
                    }

                    state.Phase = "succeeded";
                    stateStore.Save(state);
                    stateStore.Clear();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Updates] Falha ao concluir health check de update: " + ex.Message);
            }
        }

        private void SendUpdateStatusToUI(string status, string message, UpdateDecision? decision, double progress = -1)
        {
            try
            {
                var manifest = decision?.Manifest;
                var payload = new
                {
                    type = "systemUpdateStatus",
                    status,
                    message,
                    localDoorpiVersion = DoorpiVersion,
                    localUpdaterVersion = UpdaterVersion,
                    remoteDoorpiVersion = manifest?.Doorpi.Version ?? "",
                    remoteUpdaterVersion = manifest?.Updater.Version ?? "",
                    doorpiUpdateAvailable = decision?.DoorpiUpdateAvailable ?? false,
                    updaterUpdateAvailable = decision?.UpdaterUpdateAvailable ?? false,
                    forceUpdate = decision?.ForceUpdate ?? false,
                    progress,
                    lastCheckedAt = _lastUpdateCheckUtc == DateTimeOffset.MinValue
                        ? ""
                        : _lastUpdateCheckUtc.ToString("O"),
                    changelog = manifest?.Changelog ?? new List<ChangelogEntry>()
                };

                Dispatcher.Invoke(() =>
                    webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(payload)));
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Updates] Falha ao enviar status para UI: " + ex.Message);
            }
        }

        private void SendCachedUpdateStatusToUI()
        {
            if (_lastUpdateDecision != null)
            {
                SendUpdateStatusToUI(_lastUpdateDecision.HasAnyUpdate ? "available" : "up-to-date",
                    _lastUpdateDecision.HasAnyUpdate ? "Atualizacao disponivel." : "Sistema atualizado.",
                    _lastUpdateDecision);
                return;
            }

            SendUpdateStatusToUI("idle", "Atualizacoes ainda nao verificadas.", null);
        }

        private void ShowUpdateProgress(string title, string message, double progress, string? tip = null)
        {
            try
            {
                Dispatcher.Invoke(() =>
                {
                    _updateProgressWindow ??= new UpdateProgressWindow { Owner = this };
                    _updateProgressWindow.SetStatus(title, message, progress, tip);
                    if (!_updateProgressWindow.IsVisible)
                        _updateProgressWindow.Show();

                    _updateProgressWindow.Activate();
                });
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Updates] Falha ao exibir tela fullscreen: " + ex.Message);
            }
        }

        private void CloseUpdateProgress()
        {
            try
            {
                Dispatcher.Invoke(() =>
                {
                    if (_updateProgressWindow == null) return;
                    _updateProgressWindow.Close();
                    _updateProgressWindow = null;
                });
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[Updates] Falha ao fechar tela fullscreen: " + ex.Message);
            }
        }
    }
}
