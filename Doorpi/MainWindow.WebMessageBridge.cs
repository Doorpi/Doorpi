using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Xml.Linq;

namespace Doorpi
{
    // Incremental extraction: routing remains on the original window/dispatcher.
    // Keep handler order and lifetime until each feature contract has been reviewed.
    public partial class MainWindow
    {
        private async void WebView_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string jsonMessage;
            try
            {
                jsonMessage = e.TryGetWebMessageAsString();
            }
            catch (ArgumentException)
            {
                // postMessage(objeto) chega como JSON, não como string. Aceitar os
                // dois formatos evita derrubar o handler por uma mensagem válida.
                jsonMessage = e.WebMessageAsJson;
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[WebView] Falha ao ler mensagem: " + ex.Message);
                return;
            }
            if (string.IsNullOrEmpty(jsonMessage)) return;
            if (!IsTrustedMainWebMessageSource(e.Source))
            {
                Debug.WriteLine("[WebView] Mensagem ignorada de origem nÃ£o confiÃ¡vel: " + e.Source);
                return;
            }

            try
            {
                using var doc = JsonDocument.Parse(jsonMessage);
                var root = doc.RootElement;
                if (!root.TryGetProperty("action", out var actionElement)) return;
                string action = actionElement.GetString() ?? "";

                if (await TryHandleWebPermissionSettingsAsync(action, root).ConfigureAwait(true))
                    return;

                if (await TryHandleProfileSyncWebMessageAsync(action, root).ConfigureAwait(true))
                    return;

                if (await TryHandleControlConfigurationWebMessageAsync(action, root).ConfigureAwait(true))
                    return;

                if (await TryHandleDoorpiFileBrowserMessageAsync(action, root).ConfigureAwait(true))
                    return;

                if (action == "requestInstalledApps")
                {
                    bool cachedOnly = root.TryGetProperty("cachedOnly", out var cachedOnlyElement)
                                      && cachedOnlyElement.ValueKind == JsonValueKind.True;
                    bool refreshRiot = root.TryGetProperty("refreshRiot", out var refreshRiotElement)
                                       && refreshRiotElement.ValueKind == JsonValueKind.True;
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            if (refreshRiot)
                                await RefreshRiotAppsForModalAsync().ConfigureAwait(false);

                            SendInstalledAppsToUI();

 
                            if (!cachedOnly && (DateTime.Now - _lastCacheBuilt).TotalSeconds > 60)
                            {
                                await UpdateAppCacheAsync().ConfigureAwait(false);
                                var cache = LoadAppCache() ?? new AppCacheModel();
                                var removedGames = ReconcileDoorpiGamesWithPlatformCache(cache);
                                PublishRemovedGamesToUI(removedGames);

                               
                                SendInstalledAppsToUI();
                            }
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine("[InstalledApps] Falha ao atualizar lista: " + ex.Message);
                        }
                        finally
                        {
                            // requestInstalledApps é uma consulta leve do modal. Ela não
                            // abre o loading global e, portanto, não pode enviar hideLoading.
                            // Notificamos apenas o encerramento do indicador inline.
                            Dispatcher.Invoke(() =>
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"installedAppsRequestCompleted\"}"));
                        }
                    });
                }

                if (action == "exitApp")
                {
                    Dispatcher.Invoke(() =>
                    {
                        CleanupAndExit();
                        Application.Current.Shutdown();
                        Environment.Exit(0);
                    });
                }
                else if (action == "shutdownSystem")
                {
                    ReleaseAllStuckKeys();

                    Process.Start(new ProcessStartInfo("shutdown.exe", "/s /t 0") { UseShellExecute = false, CreateNoWindow = true });
                    Dispatcher.Invoke(() => Application.Current.Shutdown());
                }
                else if (action == "restartSystem")
                {
                    ReleaseAllStuckKeys();

                    Process.Start(new ProcessStartInfo("shutdown.exe", "/r /t 0") { UseShellExecute = false, CreateNoWindow = true });
                    Dispatcher.Invoke(() => Application.Current.Shutdown());
                }
                else if (action == "suspendSystem")
                {
                    ReleaseAllStuckKeys();

                    SetSuspendState(false, true, true);
                }
                else if (action == "updateVkbTranslations")
                {
                    _vkbStrBackspace = GetStr(root, "vkbBackspace", "Apagar");
                    _vkbStrEnter = GetStr(root, "vkbEnter", "Enter");
                    _vkbStrClose = GetStr(root, "vkbClose", "Fechar");
                    _vkbStrShift = GetStr(root, "vkbShift", "MaiÃºsc");
                    _vkbStrSpace = GetStr(root, "vkbSpace", "EspaÃ§o");
                    _vkbStrSym = GetStr(root, "vkbSym", "&123");
                    _vkbStrAbc = GetStr(root, "vkbAbc", "ABC");


                    if (_desktopVkb != null)
                    {
                        Dispatcher.Invoke(() => _desktopVkb.SetLocalization(
                            _vkbStrBackspace, _vkbStrEnter, _vkbStrClose,
                            _vkbStrShift, _vkbStrSpace, _vkbStrSym, _vkbStrAbc));
                    }
                }
                else if (action == "updateExtension")
                {
                    string id = GetStr(root, "id");
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            var ext = LoadBrowserExtensions().FirstOrDefault(e => string.Equals(e.Id, id, StringComparison.OrdinalIgnoreCase));
                            if (ext != null)
                            {
                                // Baixa e sobrescreve
                                await InstallChromeExtensionAsync(ext.SourceUrl);

                                // Refaz a checagem (a bolinha vermelha vai sumir)
                                await CheckAndSendExtensionUpdatesAsync();

                                SendExtensionsToUI("success", "ExtensÃ£o atualizada! TerÃ¡ efeito ao abrir um app.");
                            }
                        }
                        catch (Exception ex)
                        {
                            SendExtensionsToUI("error", "Erro ao atualizar: " + ex.Message);
                        }
                    });
                }
                else if (action == "requestBootMode")
                {
                    SendBootModeToUI();
                }
                else if (action == "requestDisplaySettings")
                {
                    SendDisplaySettingsToUI();
                }
                else if (action == "saveDisplaySettings")
                {
                    var layoutScale = root.TryGetProperty("layoutScale", out var scaleEl) && scaleEl.TryGetDouble(out var scale)
                        ? scale
                        : 1.0;
                    SaveLayoutScale(layoutScale);
                    SendDisplaySettingsToUI();
                }
                else if (action == "introSystemReadyForFocus")
                {
                    RestoreDoorpiFocusAfterIntroHandoff();
                }
                else if (action == "nativeIntroSkip")
                {
                    Dispatcher.Invoke(RequestNativeBootIntroSkip);
                }
                else if (action == "doorpiHomeInteractiveReady")
                {
                    string mode = GetStr(root, "mode");
                    string activeTag = GetStr(root, "activeTag");
                    string activeId = GetStr(root, "activeId");
                    string activeClass = GetStr(root, "activeClass");
                    DoorpiBootDiagnostics.Log(
                        "home-interactive-ready",
                        $"mode={mode} active={activeTag}#{activeId}.{activeClass}");

                    _ = Dispatcher.InvokeAsync(() =>
                    {
                        bool tutorialFinished = string.Equals(
                            mode,
                            "first-run-tutorial-finished",
                            StringComparison.OrdinalIgnoreCase);
                        FocusDoorpiMainWebView(onlyIfFocusLost: !tutorialFinished);
                    });
                }
                else if (action == "requestUpdateStatus")
                {
                    SendCachedUpdateStatusToUI();
                }
                else if (action == "requestStorageStatus")
                {
                    bool forceRefresh = root.TryGetProperty("forceRefresh", out JsonElement refreshElement) &&
                                        refreshElement.ValueKind == JsonValueKind.True;
                    RequestStorageStatus(forceRefresh);
                }
                else if (action == "requestStoragePrograms")
                {
                    RequestStoragePrograms();
                }
                else if (action == "uninstallStorageProgram")
                {
                    UninstallStorageProgram(GetStr(root, "programId"));
                }
                else if (action == "returnToStorageUninstaller")
                {
                    ReturnToStorageUninstaller(GetStr(root, "programId"));
                }
                else if (action == "checkSystemUpdates")
                {
                    _ = Task.Run(() => CheckForUpdatesAsync(userInitiated: true));
                }
                else if (action == "startSystemUpdate")
                {
                    _ = Task.Run(StartSystemUpdateAsync);
                }
                else if (action == "requestWindowsUpdateStatus")
                {
                    SendCachedWindowsUpdateStatusToUI();
                }
                else if (action == "checkWindowsUpdates")
                {
                    _ = Task.Run(() => RefreshWindowsUpdateStatusAsync(scan: true));
                }
                else if (action == "startWindowsUpdateInstall")
                {
                    _ = Task.Run(StartWindowsUpdateInstallAsync);
                }
                else if (action == "requestGpuUpdateStatus")
                {
                    SendCachedGpuUpdateStatusToUI();
                }
                else if (action == "requestBluetoothStatus")
                {
                    RequestBluetoothStatus();
                }
                else if (action == "setBluetoothEnabled")
                {
                    bool enabled = root.TryGetProperty("enabled", out var enabledElement) && enabledElement.GetBoolean();
                    SetBluetoothEnabled(enabled);
                }
                else if (action == "startBluetoothDiscovery")
                {
                    StartBluetoothDiscovery();
                }
                else if (action == "stopBluetoothDiscovery")
                {
                    StopBluetoothDiscovery();
                }
                else if (action == "pairBluetoothDevice")
                {
                    PairBluetoothDevice(GetStr(root, "deviceId"));
                }
                else if (action == "removeBluetoothDevice")
                {
                    RemoveBluetoothDevice(GetStr(root, "deviceId"));
                }
                else if (action == "respondBluetoothPairing")
                {
                    bool accepted = root.TryGetProperty("accepted", out var acceptedElement) && acceptedElement.GetBoolean();
                    GetBluetoothManager().RespondToPairing(accepted, GetStr(root, "pin"));
                }
                else if (action == "requestWifiStatus")
                {
                    RequestWifiStatus();
                }
                else if (action == "setWifiEnabled")
                {
                    bool enabled = root.TryGetProperty("enabled", out var enabledElement) && enabledElement.GetBoolean();
                    SetWifiEnabled(enabled);
                }
                else if (action == "scanWifiNetworks")
                {
                    ScanWifiNetworks();
                }
                else if (action == "connectWifiNetwork")
                {
                    ConnectWifiNetwork(GetStr(root, "networkId"), GetStr(root, "password"));
                }
                else if (action == "disconnectWifi")
                {
                    DisconnectWifi();
                }
                else if (action == "forgetWifiNetwork")
                {
                    ForgetWifiNetwork(GetStr(root, "networkId"));
                }
                else if (action == "requestSoundStatus")
                {
                    RequestSoundStatus();
                }
                else if (action == "setDefaultSoundDevice")
                {
                    SetDefaultSoundDevice(GetStr(root, "deviceId"));
                }
                else if (action == "setSystemVolume")
                {
                    int volume = root.TryGetProperty("volume", out var volumeElement) ? volumeElement.GetInt32() : 0;
                    SetSystemVolume(volume);
                }
                else if (action == "openGpuUpdater")
                {
                    string updaterId = GetStr(root, "updaterId");
                    _ = Task.Run(() => OpenGpuUpdater(updaterId));
                }
                else if (action == "closeAllSessionsForGpuUpdater")
                {
                    string updaterId = GetStr(root, "updaterId");
                    _ = Task.Run(() => CloseSessionsAndOpenGpuUpdaterAsync(updaterId));
                }
                else if (action == "gpuUpdaterRestartNoticeRendered")
                {
                    ConfirmGpuRestartNoticeRendered();
                }
                else if (action == "addGpuUpdater")
                {
                    _ = AddGpuUpdaterFromDialogAsync();
                }
                else if (action == "removeGpuUpdater")
                {
                    string updaterId = GetStr(root, "updaterId");
                    _ = Task.Run(() => RemoveGpuUpdater(updaterId));
                }
                else if (action == "setBootMode" && root.TryGetProperty("mode", out var modeEl))
                {
                    SetBootMode(modeEl.GetInt32());
                    SendBootModeToUI();
                }
                else if (action == "openWindowsUpdateSettings")
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo("ms-settings:windowsupdate") { UseShellExecute = true });
                        Dispatcher.Invoke(EnterDesktopMode);

                        _ = Task.Run(async () =>
                        {
                            for (int i = 0; i < 20; i++)
                            {
                                await Task.Delay(500);
                                if (Process.GetProcessesByName("SystemSettings").Length > 0)
                                {
                                    Dispatcher.Invoke(() =>
                                    {
                                        IntPtr fgHwnd = GetForegroundWindow();
                                        if (fgHwnd != IntPtr.Zero) ShowWindow(fgHwnd, 3);
                                        int safeX = (int)SystemParameters.PrimaryScreenWidth - 20;
                                        int safeY = (int)SystemParameters.PrimaryScreenHeight / 2;
                                        SetCursorPos(safeX, safeY);
                                        SendMouse(0, 0, 0x0002);
                                        SendMouse(0, 0, 0x0004);
                                    });
                                    break;
                                }
                            }

                            while (_systemControllerActive)
                            {
                                await Task.Delay(1000);
                                if (Process.GetProcessesByName("SystemSettings").Length == 0)
                                {
                                    Dispatcher.Invoke(() => { if (_systemControllerActive) ExitDesktopMode(); });
                                    break;
                                }
                            }
                        });
                    }
                    catch (Exception ex) { Debug.WriteLine($"Erro ao abrir Windows Update: {ex.Message}"); }
                }
                else if (action == "openTaskbarSettings")
                {
                    try
                    {
                        // Abre as configuraÃ§Ãµes da Barra de Tarefas
                        Process.Start(new ProcessStartInfo("ms-settings:taskbar") { UseShellExecute = true });

                        // Minimiza o Doorpi e assume o controle como Mouse/Teclado
                        Dispatcher.Invoke(EnterDesktopMode);

                        _ = Task.Run(async () =>
                        {
                            bool appFound = false;

                            // Aguarda atÃ© 10 segundos para a janela de ConfiguraÃ§Ãµes abrir
                            for (int i = 0; i < 20; i++)
                            {
                                await Task.Delay(500);
                                if (Process.GetProcessesByName("SystemSettings").Length > 0)
                                {
                                    appFound = true;
                                    Dispatcher.Invoke(() =>
                                    {
                                        IntPtr fgHwnd = GetForegroundWindow();
                                        if (fgHwnd != IntPtr.Zero) ShowWindow(fgHwnd, 3); // Maximiza a janela de ConfiguraÃ§Ãµes

                                        // Move o mouse para uma Ã¡rea segura
                                        int safeX = (int)SystemParameters.PrimaryScreenWidth - 20;
                                        int safeY = (int)SystemParameters.PrimaryScreenHeight / 2;
                                        SetCursorPos(safeX, safeY);

                                        // Envia Clique Esquerdo para roubar foco UWP
                                        SendMouse(0, 0, 0x0002);
                                        SendMouse(0, 0, 0x0004);
                                    });
                                    break;
                                }
                            }

                            if (!appFound) return;

                            // Monitora a cada segundo atÃ© o usuÃ¡rio fechar a janela
                            while (_systemControllerActive)
                            {
                                await Task.Delay(1000);
                                if (Process.GetProcessesByName("SystemSettings").Length == 0)
                                {
                                    Dispatcher.Invoke(() =>
                                    {
                                        if (_systemControllerActive) ExitDesktopMode();
                                    });
                                    break;
                                }
                            }
                        });
                    }
                    catch (Exception ex) { Debug.WriteLine($"Erro ao abrir config de Barra de Tarefas: {ex.Message}"); }
                }
                else if (action == "openXboxGameBarSettings")
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo("ms-settings:gaming-gamebar") { UseShellExecute = true });
                        Dispatcher.Invoke(EnterDesktopMode);

                        _ = Task.Run(async () =>
                        {
                            for (int i = 0; i < 20; i++)
                            {
                                await Task.Delay(500);
                                if (Process.GetProcessesByName("SystemSettings").Length > 0)
                                {
                                    Dispatcher.Invoke(() =>
                                    {
                                        IntPtr fgHwnd = GetForegroundWindow();
                                        if (fgHwnd != IntPtr.Zero) ShowWindow(fgHwnd, 3);
                                        int safeX = (int)SystemParameters.PrimaryScreenWidth - 20;
                                        int safeY = (int)SystemParameters.PrimaryScreenHeight / 2;
                                        SetCursorPos(safeX, safeY);
                                        SendMouse(0, 0, 0x0002);
                                        SendMouse(0, 0, 0x0004);
                                    });
                                    break;
                                }
                            }

                            while (_systemControllerActive)
                            {
                                await Task.Delay(1000);
                                if (Process.GetProcessesByName("SystemSettings").Length == 0)
                                {
                                    Dispatcher.Invoke(() => { if (_systemControllerActive) ExitDesktopMode(); });
                                    break;
                                }
                            }
                        });
                    }
                    catch (Exception ex) { Debug.WriteLine($"Erro ao abrir Xbox Game Bar settings: {ex.Message}"); }
                }
                else if (action == "openSignInOptions")
                {
                    try
                    {
                        // Abre a janela de OpÃ§Ãµes de Entrada
                        Process.Start(new ProcessStartInfo("ms-settings:signinoptions") { UseShellExecute = true });

                        // Minimiza o Doorpi e assume o controle como Mouse/Teclado
                        Dispatcher.Invoke(EnterDesktopMode);

                        // O "_ =" descarta o aviso do compilador indicando que Ã© um Fire-And-Forget intencional
                        _ = Task.Run(async () =>
                        {
                            bool appFound = false;

                            // Aguarda atÃ© 10 segundos para a janela de ConfiguraÃ§Ãµes abrir
                            for (int i = 0; i < 20; i++)
                            {
                                await Task.Delay(500);
                                if (Process.GetProcessesByName("SystemSettings").Length > 0)
                                {
                                    appFound = true;

                                    Dispatcher.Invoke(() =>
                                    {
                                        // ForÃ§a a janela a maximizar
                                        IntPtr fgHwnd = GetForegroundWindow();
                                        if (fgHwnd != IntPtr.Zero)
                                        {
                                            ShowWindow(fgHwnd, 3);
                                        }

                                        // Joga o mouse pro canto direito (Ã¡rea vazia segura) na metade da tela
                                        int safeX = (int)SystemParameters.PrimaryScreenWidth - 20;
                                        int safeY = (int)SystemParameters.PrimaryScreenHeight / 2;
                                        SetCursorPos(safeX, safeY);

                                        // Envia um Clique Esquerdo RÃ¡pido para roubar o foco do UWP
                                        // (0x0002 = MOUSEEVENTF_LEFTDOWN | 0x0004 = MOUSEEVENTF_LEFTUP)
                                        SendMouse(0, 0, 0x0002);
                                        SendMouse(0, 0, 0x0004);
                                    });
                                    break;
                                }
                            }

                            if (!appFound) return;

                            // Monitora a cada segundo atÃ© o usuÃ¡rio fechar a janela
                            while (_systemControllerActive)
                            {
                                await Task.Delay(1000);
                                if (Process.GetProcessesByName("SystemSettings").Length == 0)
                                {
                                    // A janela fechou! Tira do modo Desktop e volta pro Doorpi
                                    Dispatcher.Invoke(() =>
                                    {
                                        if (_systemControllerActive)
                                        {
                                            ExitDesktopMode();
                                        }
                                    });
                                    break;
                                }
                            }
                        });
                    }
                    catch (Exception ex) { Debug.WriteLine($"Erro ao abrir config de contas: {ex.Message}"); }
                }
                else if (action == "addSelectedGames" && root.TryGetProperty("games", out var gamesElement))
                {
                    var selectedApps = JsonSerializer.Deserialize<List<InstalledApp>>(gamesElement.GetRawText());
                    if (selectedApps != null && selectedApps.Count > 0)
                    {

                        webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new { type = "showLoadingCards", count = selectedApps.Count, tab = "games" }));

                        _ = Task.Run(async () => await AddMultipleGamesAsync(selectedApps));
                    }
                }
                else if (action == "launch" && root.TryGetProperty("path", out var pathElement))
                {
                    string errorMsg = GetStr(root, "errorMsg", "Erro ao iniciar jogo: ");
                    string discPath = GetStr(root, "discPath");
                    LaunchGame(pathElement.GetString(), errorMsg, discPath);
                }
                else if (action == "cancelGameLaunch")
                {
                    _launchCancelled = true;
                    ResetGameMinimizeGrace();
                    _lockedGameProcessName = "";  // ? NOVO
                    _gameIsMinimized = false;
                    _currentGameHwnd = IntPtr.Zero;

                    lock (_gameLaunchMonitorLock)
                    {
                        _gameLaunchMonitorCts?.Cancel();
                    }

                    _gameSessionActive = false;
                    _gameIsRunningAndDoorpiHidden = false;

                    try { _pendingLaunchProcess?.Kill(entireProcessTree: true); } catch { }
                    _pendingLaunchProcess = null;

                    SendGameLaunchStatus("gameLaunchDone");
                    ClearGameFocusFallbackPrompt();
                    Dispatcher.Invoke(ForceFocus);
                }
                else if (action == "startAppPolling")
                {
                    _pollingActive = true;
                    _ = Task.Run(PollInstalledAppsAsync);
                }
                else if (action == "stopAppPolling")
                {
                    _pollingActive = false;
                }
                else if (action == "addWebApp")
                {
                    string name = GetStr(root, "name");
                    string url = GetStr(root, "url");
                    if (!string.IsNullOrEmpty(name) && !string.IsNullOrEmpty(url))
                        _ = Task.Run(async () => await AddWebMediaAppAsync(name, url));
                }
                else if (action == "addSelectedMediaApps" && root.TryGetProperty("apps", out var mediaAppsEl))
                {
                    var selectedApps = JsonSerializer.Deserialize<List<InstalledApp>>(mediaAppsEl.GetRawText());
                    if (selectedApps != null && selectedApps.Count > 0)
                        _ = Task.Run(async () => await AddMultipleMediaAppsAsync(selectedApps));
                }
                else if (action == "browseManualMedia")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Select Executable");
                    string dialogFilter = GetStr(root, "dialogFilter", "Arquivos iniciÃ¡veis (*.exe;*.bat;*.cmd;*.lnk;*.url)|*.exe;*.bat;*.cmd;*.lnk;*.url|Todos os arquivos (*.*)|*.*");
                    string loadTitle = GetStr(root, "loadingTitle", "Adding");
                    string loadSub = GetStr(root, "loadingSub", "Fetching covers...");
                    string errMsg = GetStr(root, "errorMsg", "Error: ");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        try
                        {
                            string? selectedFile = await ShowDoorpiFileBrowserAsync(
                                dialogTitle, false, dialogFilter, "manualMedia");

                            if (!string.IsNullOrWhiteSpace(selectedFile))
                            {
                                string filePath = selectedFile;
                                string filePathJson = JsonSerializer.Serialize(filePath);
                                await webView.CoreWebView2.ExecuteScriptAsync(
                                    $"window.newGameIdsThisSession?.add({filePathJson}); window.AppStore?.mutations?.markNew?.({filePathJson});");
                                string cleanName = GetGameNameFromFile(filePath) ?? Path.GetFileNameWithoutExtension(filePath);
                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                { type = "updateLoadingText", title = loadTitle, subtitle = loadSub }));
                                await webView.CoreWebView2.ExecuteScriptAsync(
                                    "window._doorpiSuppressNativeDialogPointer?.(900); window.resetDoorpiGamepadInputState?.(); window.showLoadingCards?.(1, 'media'); closeModal();");
                                await AddMultipleMediaAppsAsync(new List<InstalledApp>
                                {
                                    new InstalledApp { Name = cleanName, Path = filePath, IconBase64 = GetCachedIcon(filePath) }
                                });
                            }
                            else
                            {
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show(errMsg + ex.Message);
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                        }
                    }).Task.Unwrap();
                }
                else if (action == "browseManual")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Select Executable");
                    string dialogFilter = GetStr(root, "dialogFilter", "Arquivos iniciÃ¡veis (*.exe;*.bat;*.cmd;*.lnk;*.url)|*.exe;*.bat;*.cmd;*.lnk;*.url|Todos os arquivos (*.*)|*.*");
                    string loadTitle = GetStr(root, "loadingTitle", "Adding");
                    string loadSub = GetStr(root, "loadingSub", "Fetching covers...");
                    string errMsg = GetStr(root, "errorMsg", "Error: ");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        try
                        {
                            string? selectedFile = await ShowDoorpiFileBrowserAsync(
                                dialogTitle, false, dialogFilter, "manualGame");

                            if (!string.IsNullOrWhiteSpace(selectedFile))
                            {
                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "updateLoadingText",
                                    title = loadTitle,
                                    subtitle = loadSub
                                }));
                                string filePath = selectedFile;
                                string filePathJson = JsonSerializer.Serialize(filePath);
                                await webView.CoreWebView2.ExecuteScriptAsync(
                                    $"window.newGameIdsThisSession?.add({filePathJson}); window.AppStore?.mutations?.markNew?.({filePathJson});");
                                string cleanName = GetGameNameFromFile(filePath) ?? Path.GetFileNameWithoutExtension(filePath);
                                var manualApp = new List<InstalledApp>
                                {
                                    new InstalledApp { Name = cleanName, Path = filePath, IconBase64 = GetCachedIcon(filePath) }
                                };
                                await webView.CoreWebView2.ExecuteScriptAsync(
                                    "window._doorpiSuppressNativeDialogPointer?.(900); window.resetDoorpiGamepadInputState?.(); window.showLoadingCards?.(1, 'games'); closeModal();");
                                await AddMultipleGamesAsync(manualApp);
                            }
                            else
                            {
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show(errMsg + ex.Message);
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                        }
                    }).Task.Unwrap();
                }
                else if (action == "requestFolders")
                {
                    _ = Task.Run(() =>
                    {
                        try { SendFoldersToUI(); }
                        finally { Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}")); }
                    });
                }
                else if (action == "pickFolder")
                {
                    string dialogTitle = GetStr(root, "dialogTitle");
                    string forbiddenMsg = GetStr(root, "forbiddenMsg");
                    string forbiddenTitle = GetStr(root, "forbiddenTitle");
                    string errMsg = GetStr(root, "errorMsg");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        try
                        {
                            string? selectedFolder = await ShowDoorpiFileBrowserAsync(
                                dialogTitle, true, source: "watchedFolder");

                            if (!string.IsNullOrWhiteSpace(selectedFolder))
                            {
                                string selectedPath = selectedFolder;
                                if (IsFolderForbidden(selectedPath))
                                {
                                    System.Windows.MessageBox.Show(forbiddenMsg, forbiddenTitle, MessageBoxButton.OK, MessageBoxImage.Warning);
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                                    return;
                                }

                                var folders = LoadFoldersData();
                                if (!folders.Any(f => string.Equals(f.Path, selectedPath, StringComparison.OrdinalIgnoreCase)))
                                {
                                    var placeholder = new FolderStats { Path = selectedPath, EstimatedMs = -1 };
                                    folders.Add(placeholder);
                                    SaveFoldersData(folders);
                                    AddFolderWatcher(selectedPath);
                                }

                                SendFoldersToUI();
                                PostScanProgress(selectedPath, 0); // Texto atualiza na hora

                                // Escaneamento em Background
                                _ = Task.Run(async () =>
                                {
                                    try
                                    {
                                        await RecalculateFolderStatsAsync(selectedPath);
                                        await UpdateAppCacheAsync();
                                        SendInstalledAppsToUI();
                                    }
                                    catch (Exception ex) { Debug.WriteLine("[pickFolder] Erro: " + ex.Message); }
                                    finally
                                    {

                                        Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                                    }
                                });
                            }
                            else
                            {
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show(errMsg + ex.Message);
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                        }
                    }).Task.Unwrap();
                }
                else if (action == "editFolder" && root.TryGetProperty("path", out var oldPathEl))
                {
                    string oldPath = oldPathEl.GetString() ?? "";
                    string dialogTitle = GetStr(root, "dialogTitle");
                    string forbiddenMsg = GetStr(root, "forbiddenMsg");
                    string forbiddenTitle = GetStr(root, "forbiddenTitle");
                    string errMsg = GetStr(root, "errorMsg");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        try
                        {
                            string? selectedFolder = await ShowDoorpiFileBrowserAsync(
                                dialogTitle, true, source: "editWatchedFolder", initialPath: oldPath);

                            if (!string.IsNullOrWhiteSpace(selectedFolder))
                            {
                                string newPath = selectedFolder;
                                if (IsFolderForbidden(newPath))
                                {
                                    System.Windows.MessageBox.Show(forbiddenMsg, forbiddenTitle, MessageBoxButton.OK, MessageBoxImage.Warning);
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                                    return;
                                }

                                var folders = LoadFoldersData();
                                int idx = folders.FindIndex(f => string.Equals(f.Path, oldPath, StringComparison.OrdinalIgnoreCase));
                                var placeholder = new FolderStats { Path = newPath, EstimatedMs = -1 };

                                if (idx >= 0) folders[idx] = placeholder;
                                else folders.Add(placeholder);

                                SaveFoldersData(folders);

                                var dead = _folderWatchers.Where(w => string.Equals(w.Path, oldPath, StringComparison.OrdinalIgnoreCase)).ToList();
                                foreach (var w in dead) { w.EnableRaisingEvents = false; w.Dispose(); }
                                foreach (var w in dead) _folderWatchers.Remove(w);
                                AddFolderWatcher(newPath);

                                SendFoldersToUI();
                                PostScanProgress(newPath, 0); // Texto atualiza na hora

                                _ = Task.Run(async () =>
                                {
                                    try
                                    {
                                        await RecalculateFolderStatsAsync(newPath);
                                        await UpdateAppCacheAsync();
                                        SendInstalledAppsToUI();
                                    }
                                    catch (Exception ex) { Debug.WriteLine("[editFolder] Erro: " + ex.Message); }
                                    finally
                                    {
                                       
                                        Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                                    }
                                });
                            }
                            else
                            {
                                webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Windows.MessageBox.Show(errMsg + ex.Message);
                            webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}");
                        }
                    }).Task.Unwrap();
                }
                else if (action == "deleteFolder" && root.TryGetProperty("path", out var delPathEl))
                {
                    string delPath = delPathEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(delPath))
                    {
                        DeleteWatchedFolder(delPath);
                        SendFoldersToUI(); // Atualiza a tela instantaneamente

                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await UpdateAppCacheAsync();
                                SendInstalledAppsToUI();
                            }
                            catch (Exception ex) { Debug.WriteLine("[deleteFolder] Erro: " + ex.Message); }
                            finally
                            {
                              
                                Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideLoading\"}"));
                            }
                        });
                    }
                }

                else if (action == "saveStaticFrame")
                {
                    string gameId = root.GetProperty("gameId").GetString() ?? "";
                    string imageType = root.GetProperty("imageType").GetString() ?? "";
                    string base64 = root.GetProperty("base64").GetString() ?? "";
                    string sourceUrl = GetStr(root, "sourceUrl");

                    if (!string.IsNullOrEmpty(gameId) && !string.IsNullOrEmpty(base64))
                    {
                        string cleanBase64 = base64.Contains(',') ? base64.Split(',')[1] : base64;
                        byte[] imageBytes = Convert.FromBase64String(cleanBase64);

                        var games = LoadGames();

                        var game = games.FirstOrDefault(g => g.Path == gameId || g.LaunchUrl == gameId);

                        if (game != null)
                        {
                            string safeName = string.Concat(game.Name.Where(c => !Path.GetInvalidFileNameChars().Contains(c)));
                            string sourceFingerprint = StableAssetName(
                                !string.IsNullOrWhiteSpace(sourceUrl)
                                    ? sourceUrl
                                    : gameId + imageType + DateTime.UtcNow.Ticks);
                            string fileName = $"{safeName}_{imageType}_{sourceFingerprint}.png";
                            string folder = gridFolder;
                            string folderUrlName = "grid";

                            if (imageType == "HeroStatic") { folder = heroFolder; folderUrlName = "hero"; }
                            else if (imageType == "LogoStatic") { folder = logoFolder; folderUrlName = "logo"; }
                            else if (imageType == "HorizontalStatic") { folder = gridHorizontalFolder; folderUrlName = "grid-horizontal"; }

                            string fullPath = Path.Combine(folder, fileName);
                            File.WriteAllBytes(fullPath, imageBytes);
                            string staticUrl = $"https://data.local/images/{folderUrlName}/{fileName}";

                            if (imageType == "GridStatic") game.GridStaticImage = staticUrl;
                            else if (imageType == "HorizontalStatic") game.GridHorizontalStaticImage = staticUrl;
                            else if (imageType == "HeroStatic") game.HeroStaticImage = staticUrl;
                            else if (imageType == "LogoStatic") game.LogoStaticImage = staticUrl;

                            SaveGames(games);
                            CompletePendingArtworkReplacement(gameId, imageType);
                            var response = new { type = "staticSaved", gameId, imageType, newUrl = staticUrl };
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(response));
                        }
                        else
                        {
                            var mediaApps = LoadMediaApps();
                            var mediaApp = mediaApps.FirstOrDefault(a => a.Id == gameId);

                            if (mediaApp != null)
                            {
                                string sourceFingerprint = StableAssetName(
                                    !string.IsNullOrWhiteSpace(sourceUrl)
                                        ? sourceUrl
                                        : gameId + imageType + DateTime.UtcNow.Ticks);
                                string fileName = $"{mediaApp.Id}_{imageType}_{sourceFingerprint}.png";
                                string folder = gridFolder;
                                string folderUrlName = "grid";

                                if (imageType == "HeroStatic") { folder = heroFolder; folderUrlName = "hero"; }
                                else if (imageType == "LogoStatic") { folder = logoFolder; folderUrlName = "logo"; }
                                else if (imageType == "HorizontalStatic") { folder = gridHorizontalFolder; folderUrlName = "grid-horizontal"; }

                                string fullPath = Path.Combine(folder, fileName);
                                File.WriteAllBytes(fullPath, imageBytes);
                                string staticUrl = $"https://data.local/images/{folderUrlName}/{fileName}";

                                if (imageType == "GridStatic") mediaApp.GridStaticImage = staticUrl;
                                else if (imageType == "HorizontalStatic") mediaApp.GridHorizontalStaticImage = staticUrl;
                                else if (imageType == "HeroStatic") mediaApp.HeroStaticImage = staticUrl;
                                else if (imageType == "LogoStatic") mediaApp.LogoStaticImage = staticUrl;

                                SaveMediaApps(mediaApps);
                                CompletePendingArtworkReplacement(gameId, imageType);
                                var response = new { type = "staticSaved", gameId, imageType, newUrl = staticUrl };
                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(response));
                            }
                            else
                            {
                                var stores = LoadStoreLaunchers();
                                var store = stores.FirstOrDefault(s =>
                                    string.Equals(s.Id, gameId, StringComparison.OrdinalIgnoreCase) ||
                                    string.Equals(s.Url, gameId, StringComparison.OrdinalIgnoreCase));

                                if (store != null)
                                {
                                    string safeStoreId = StableAssetName(store.Id);
                                    string sourceFingerprint = StableAssetName(
                                        !string.IsNullOrWhiteSpace(sourceUrl)
                                            ? sourceUrl
                                            : gameId + imageType + DateTime.UtcNow.Ticks);
                                    string fileName = $"{safeStoreId}_{imageType}_{sourceFingerprint}.png";
                                    string folder = gridFolder;
                                    string folderUrlName = "grid";

                                    if (imageType == "HeroStatic") { folder = heroFolder; folderUrlName = "hero"; }
                                    else if (imageType == "LogoStatic") { folder = logoFolder; folderUrlName = "logo"; }
                                    else if (imageType == "HorizontalStatic") { folder = gridHorizontalFolder; folderUrlName = "grid-horizontal"; }

                                    string fullPath = Path.Combine(folder, fileName);
                                    File.WriteAllBytes(fullPath, imageBytes);
                                    string staticUrl = $"https://data.local/images/{folderUrlName}/{fileName}";

                                    if (imageType == "GridStatic") store.GridStaticImage = staticUrl;
                                    else if (imageType == "HorizontalStatic") store.GridHorizontalStaticImage = staticUrl;
                                    else if (imageType == "HeroStatic") store.HeroStaticImage = staticUrl;
                                    else if (imageType == "LogoStatic") store.LogoStaticImage = staticUrl;

                                    SaveStoreLaunchers(stores);
                                    CompletePendingArtworkReplacement(gameId, imageType);
                                    var response = new { type = "staticSaved", gameId, imageType, newUrl = staticUrl };
                                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(response));
                                }
                            }
                        }
                    }
                }
                else if (action == "deleteGame" && root.TryGetProperty("gameId", out var delGameIdEl))
                {
                    string gameId = delGameIdEl.GetString() ?? "";
                    bool isMedia = root.TryGetProperty("isMedia", out var isMediaEl) && isMediaEl.GetBoolean();

                    if (!string.IsNullOrEmpty(gameId))
                    {
                        if (!isMedia)
                        {
                            var games = LoadGames();
                            var game = games.FirstOrDefault(g =>
                                string.Equals(g.Path, gameId, StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(g.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase));

                            if (game != null)
                            {
                                if (!string.IsNullOrWhiteSpace(game.EmulatorId))
                                    SuppressEmulatorGame(game);
                                DeleteGameImages(game);
                                DeleteManagedTrailer(game.TrailerSource);
                                games.Remove(game);
                                SaveGames(games);
                                Debug.WriteLine($"[deleteGame] Jogo Removido: {gameId}");

                                // Puxa o 13Âº da fila para preencher o buraco, apÃ³s a animaÃ§Ã£o do Front terminar (350ms)
                                _ = Task.Run(async () =>
                                {
                                    await Task.Delay(350);
                                    Dispatcher.Invoke(() => LoadGamesIntoUI());
                                });
                            }
                        }
                        else
                        {
                            // MÃDIAS
                            if (gameId.Equals("youtube", StringComparison.OrdinalIgnoreCase)) return;

                            var medias = LoadMediaAppsForUser(currentUserId);
                            var media = medias.FirstOrDefault(m => string.Equals(m.Id, gameId, StringComparison.OrdinalIgnoreCase) || string.Equals(m.Url, gameId, StringComparison.OrdinalIgnoreCase));

                            if (media != null)
                            {
                                DeleteMediaImages(media);
                                await DeleteMediaWebViewProfileAsync(media);
                                medias.Remove(media);
                                SaveMediaApps(medias);
                                Debug.WriteLine($"[deleteGame] MÃ­dia Removida: {gameId}");

                                // Atualiza a fila de mÃ­dia para preencher o buraco
                                _ = Task.Run(async () =>
                                {
                                    await Task.Delay(350);
                                    Dispatcher.Invoke(() => SendMediaAppsToUI(LoadMediaApps()));
                                });
                            }
                        }
                    }
                }
                else if (action == "searchSteamGridArtwork")
                {
                    string requestId = GetStr(root, "requestId");
                    string query = GetStr(root, "query");
                    string category = GetStr(root, "category");

                    _ = Task.Run(async () =>
                    {
                        var images = await FetchSteamGridImageListAsync(query, category).ConfigureAwait(false);
                        Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new
                            {
                                type = "steamGridArtworkResults",
                                requestId,
                                query,
                                category,
                                images
                            })));
                    });
                }
                else if (action == "searchProfilePhotoGames")
                {
                    string requestId = GetStr(root, "requestId");
                    string query = GetStr(root, "query");
                    string apiKey = GetStr(root, "apiKey");
                    if (string.IsNullOrWhiteSpace(apiKey)) apiKey = GetSteamGridApiKey();

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            var games = await SearchProfilePhotoGameSuggestionsAsync(
                                query,
                                apiKey,
                                CancellationToken.None).ConfigureAwait(false);
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "profilePhotoGameSuggestions",
                                    requestId,
                                    query,
                                    games = games.Select(game => new { id = game.Id, name = game.Name }).ToList()
                                })));
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine("[ProfilePhoto] Autocomplete falhou: " + ex.Message);
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "profilePhotoGameSuggestions",
                                    requestId,
                                    query,
                                    games = Array.Empty<object>()
                                })));
                        }
                    });
                }
                else if (action == "searchProfilePhotoArtwork")
                {
                    string requestId = GetStr(root, "requestId");
                    string query = GetStr(root, "query");
                    string apiKey = GetStr(root, "apiKey");
                    bool suggestions = root.TryGetProperty("suggestions", out var suggestionsEl) && suggestionsEl.GetBoolean();
                    if (string.IsNullOrWhiteSpace(apiKey)) apiKey = GetSteamGridApiKey();

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            var result = await SearchProfilePhotoArtworkAsync(
                                query,
                                apiKey,
                                suggestions,
                                CancellationToken.None).ConfigureAwait(false);
                            var squares = result.Squares.Select(item => new
                            {
                                id = item.Id,
                                url = item.Url,
                                thumb = item.Thumb,
                                score = item.Score,
                                width = item.Width,
                                height = item.Height,
                                shape = item.Shape,
                                gameName = item.GameName
                            }).ToList();
                            var verticals = result.Verticals.Select(item => new
                            {
                                id = item.Id,
                                url = item.Url,
                                thumb = item.Thumb,
                                score = item.Score,
                                width = item.Width,
                                height = item.Height,
                                shape = item.Shape,
                                gameName = item.GameName
                            }).ToList();
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "profilePhotoArtworkResults",
                                    requestId,
                                    query,
                                    suggestions,
                                    squares,
                                    verticals
                                })));
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine("[ProfilePhoto] Pesquisa falhou: " + ex.Message);
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "profilePhotoArtworkResults",
                                    requestId,
                                    query,
                                    suggestions,
                                    squares = Array.Empty<object>(),
                                    verticals = Array.Empty<object>(),
                                    error = "profile-photo-search-failed"
                                })));
                        }
                    });
                }
                else if (action == "loadProfilePhotoSource")
                {
                    string requestId = GetStr(root, "requestId");
                    string url = GetStr(root, "url");
                    string source = GetStr(root, "source", "url");
                    int assetId = root.TryGetProperty("assetId", out var assetIdEl) && assetIdEl.TryGetInt32(out int parsedAssetId)
                        ? parsedAssetId
                        : 0;

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            int lastPercent = -1;
                            long lastProgressAt = 0;
                            void ReportProgress(long receivedBytes, long? totalBytes)
                            {
                                int? percent = totalBytes is > 0
                                    ? Math.Clamp((int)Math.Round(receivedBytes * 100d / totalBytes.Value), 0, 100)
                                    : null;
                                long now = Environment.TickCount64;
                                if (percent.HasValue)
                                {
                                    if (percent.Value != 100 && lastPercent >= 0 &&
                                        percent.Value < lastPercent + 4 && now - lastProgressAt < 180)
                                        return;
                                    lastPercent = percent.Value;
                                }
                                else if (receivedBytes > 0 && now - lastProgressAt < 180)
                                {
                                    return;
                                }

                                lastProgressAt = now;
                                _ = Dispatcher.BeginInvoke(new Action(() =>
                                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                    {
                                        type = "profilePhotoSourceProgress",
                                        requestId,
                                        receivedBytes,
                                        totalBytes,
                                        percent
                                    }))));
                            }

                            var loaded = await DownloadProfilePhotoSourceAsync(
                                url,
                                ReportProgress,
                                CancellationToken.None).ConfigureAwait(false);
                            string dataUrl = $"data:{loaded.Mime};base64,{Convert.ToBase64String(loaded.Bytes)}";
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "profilePhotoSourceLoaded",
                                    requestId,
                                    dataUrl,
                                    source,
                                    sourceUrl = url,
                                    assetId
                                })));
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine("[ProfilePhoto] Fonte rejeitada: " + ex.Message);
                            string error = ex is InvalidDataException ? ex.Message : "profile-photo-download-failed";
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new { type = "profilePhotoSourceFailed", requestId, error })));
                        }
                    });
                }
                else if (action == "pickProfilePhotoSource")
                {
                    string requestId = GetStr(root, "requestId");
                    string dialogTitle = GetStr(root, "dialogTitle", "Select profile photo");
                    await Dispatcher.InvokeAsync(async () =>
                    {
                        string? selectedFile = await ShowDoorpiFileBrowserAsync(
                            dialogTitle,
                            false,
                            "Static images (*.png;*.jpg;*.jpeg;*.webp)|*.png;*.jpg;*.jpeg;*.webp",
                            "profilePhoto");
                        if (string.IsNullOrWhiteSpace(selectedFile))
                        {
                            webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new { type = "profilePhotoSourceCanceled", requestId }));
                            return;
                        }

                        try
                        {
                            var info = new FileInfo(selectedFile);
                            if (info.Length > ProfilePhotoMaxBytes)
                                throw new InvalidDataException("profile-photo-too-large");
                            byte[] bytes = File.ReadAllBytes(selectedFile);
                            if (!TryGetStaticProfilePhotoMime(bytes, out string mime))
                                throw new InvalidDataException("profile-photo-invalid-format");
                            string dataUrl = $"data:{mime};base64,{Convert.ToBase64String(bytes)}";
                            webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "profilePhotoSourceLoaded",
                                    requestId,
                                    dataUrl,
                                    source = "local",
                                    sourceUrl = "",
                                    assetId = 0
                                }));
                        }
                        catch (Exception ex)
                        {
                            string error = ex is InvalidDataException ? ex.Message : "profile-photo-read-failed";
                            webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new { type = "profilePhotoSourceFailed", requestId, error }));
                        }
                    }).Task.Unwrap();
                }
                else if (action == "pickArtworkImage")
                {
                    string requestId = GetStr(root, "requestId");
                    string category = GetStr(root, "category");
                    string dialogTitle = GetStr(root, "dialogTitle", "Select image");
                    string dialogFilter = GetStr(root, "dialogFilter", "Images (*.png;*.jpg;*.jpeg;*.webp;*.gif)|*.png;*.jpg;*.jpeg;*.webp;*.gif");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        string? selectedFile = await ShowDoorpiFileBrowserAsync(
                            dialogTitle, false, dialogFilter, "artworkImage");

                        if (!string.IsNullOrWhiteSpace(selectedFile))
                        {
                            string ext = ExtensionForImagePath(selectedFile);
                            string mime = ext is ".jpg" or ".jpeg" ? "image/jpeg" :
                                ext == ".webp" ? "image/webp" :
                                ext == ".gif" ? "image/gif" : "image/png";
                            string b64 = Convert.ToBase64String(File.ReadAllBytes(selectedFile));
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                            {
                                type = "artworkImagePicked",
                                requestId,
                                category,
                                path = selectedFile,
                                preview = $"data:{mime};base64,{b64}"
                            }));
                        }
                        else
                        {
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                            {
                                type = "artworkImagePickCanceled",
                                requestId,
                                category
                            }));
                        }
                    }).Task.Unwrap();
                }
                else if (action == "applyArtworkSelection" &&
                         root.TryGetProperty("gameId", out var artworkIdEl) &&
                         root.TryGetProperty("images", out var artworkImagesEl))
                {
                    string gameId = artworkIdEl.GetString() ?? "";
                    bool isMedia = root.TryGetProperty("isMedia", out var artworkMediaEl) && artworkMediaEl.GetBoolean();
                    bool isStore = root.TryGetProperty("isStore", out var artworkStoreEl) && artworkStoreEl.GetBoolean();
                    bool localFiles = root.TryGetProperty("localFiles", out var localFilesEl) && localFilesEl.GetBoolean();
                    string requestId = GetStr(root, "requestId");
                    string artworkGameName = GetStr(root, "gameName");
                    var imagesClone = artworkImagesEl.Clone();

                    if (!string.IsNullOrWhiteSpace(gameId))
                    {
                        _ = Task.Run(async () =>
                        {
                            void ReportArtworkProgress(string category, long receivedBytes, long? totalBytes)
                            {
                                Dispatcher.BeginInvoke(() =>
                                    webView.CoreWebView2.PostWebMessageAsString(
                                        JsonSerializer.Serialize(new
                                        {
                                            type = "artworkDownloadProgress",
                                            requestId,
                                            category,
                                            receivedBytes,
                                            totalBytes
                                        })));
                            }

                            var result = isStore
                                ? await SaveSelectedStoreArtworkAsync(
                                    gameId,
                                    imagesClone,
                                    localFiles,
                                    ReportArtworkProgress).ConfigureAwait(false)
                                : await SaveSelectedArtworkAsync(
                                    gameId,
                                    artworkGameName,
                                    isMedia,
                                    imagesClone,
                                    localFiles,
                                    ReportArtworkProgress).ConfigureAwait(false);
                            var pendingStaticTypes = GetPendingArtworkTypes(gameId);
                            Dispatcher.Invoke(() =>
                            {
                                if (isStore) SendStoresToUI(LoadStoreLaunchers());
                                else if (isMedia)
                                {
                                    var updatedMedia = LoadMediaApps().FirstOrDefault(app =>
                                        string.Equals(app.Id, gameId, StringComparison.OrdinalIgnoreCase) ||
                                        string.Equals(app.Url, gameId, StringComparison.OrdinalIgnoreCase));
                                    if (updatedMedia != null) SendMediaAppUpdateToUI(updatedMedia, gameId);
                                }
                                else
                                {
                                    var updatedGame = LoadGames().FirstOrDefault(game =>
                                        string.Equals(game.Path, gameId, StringComparison.OrdinalIgnoreCase) ||
                                        string.Equals(game.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase));
                                    if (updatedGame != null) SendGameUpdateToUI(updatedGame);
                                }

                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "artworkSelectionApplied",
                                    requestId,
                                    gameId,
                                    isMedia,
                                    isStore,
                                    images = result,
                                    pendingStaticTypes
                                }));
                            });
                        });
                    }
                }
                else if (action == "applyHistoryArtworkSelection" &&
                         root.TryGetProperty("images", out var historyArtworkImagesEl))
                {
                    string gameName = GetStr(root, "gameName");
                    string requestId = GetStr(root, "requestId");
                    var imagesClone = historyArtworkImagesEl.Clone();

                    if (!string.IsNullOrWhiteSpace(gameName))
                    {
                        _ = Task.Run(async () =>
                        {
                            var result = await SaveSelectedHistoryArtworkAsync(gameName, imagesClone).ConfigureAwait(false);
                            Dispatcher.Invoke(() => webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new
                                {
                                    type = "artworkSelectionApplied",
                                    requestId,
                                    gameName,
                                    isHistory = true,
                                    images = result
                                })));
                        });
                    }
                }
                else if (action == "deleteGameHistory")
                {
                    string gameName = GetStr(root, "gameName");
                    string profileId = currentUserId;
                    if (!string.IsNullOrWhiteSpace(gameName) && !string.IsNullOrWhiteSpace(profileId))
                    {
                        _ = Task.Run(() =>
                        {
                            bool removed = DeleteGameHistoryEntry(profileId, gameName);
                            Dispatcher.Invoke(() =>
                            {
                                if (removed) LoadGamesIntoUI();
                                webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                {
                                    type = "gameHistoryDeleted",
                                    profileId,
                                    gameName,
                                    removed
                                }));
                            });
                        });
                    }
                }
                else if (await TryHandleEmulatorMessageAsync(action, root))
                {
                }
                else if (action == "browseEditLaunchCommand")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Selecionar programa ou atalho");
                    string initialPath = GetStr(root, "initialPath");
                    await Dispatcher.InvokeAsync(async () =>
                    {
                        string? selectedFile = await ShowDoorpiFileBrowserAsync(
                            dialogTitle,
                            false,
                            "Arquivos iniciaveis (*.exe;*.com;*.bat;*.cmd;*.lnk;*.url)|*.exe;*.com;*.bat;*.cmd;*.lnk;*.url|Todos os arquivos (*.*)|*.*",
                            "editLaunchCommand",
                            initialPath);
                        webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "editLaunchCommandSelected",
                            path = selectedFile ?? ""
                        }));
                    }).Task.Unwrap();
                }
                else if (action == "browseGameTrailer")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Selecionar trailer");
                    string initialPath = GetStr(root, "initialPath");
                    await Dispatcher.InvokeAsync(async () =>
                    {
                        string? selectedFile = await ShowDoorpiFileBrowserAsync(
                            dialogTitle,
                            false,
                            "Vídeos compatíveis (*.mp4;*.webm;*.mov;*.m4v;*.ogv;*.ogg)|*.mp4;*.webm;*.mov;*.m4v;*.ogv;*.ogg|Todos os arquivos (*.*)|*.*",
                            "gameTrailer",
                            initialPath);
                        webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                        {
                            type = "gameTrailerSelected",
                            path = selectedFile ?? ""
                        }));
                    }).Task.Unwrap();
                }
                else if (action == "editGame" && root.TryGetProperty("gameId", out var editIdEl))
                {
                    string gameId = editIdEl.GetString() ?? "";
                    bool hasNewName = root.TryGetProperty("newName", out var editNameEl);
                    string newName = hasNewName ? (editNameEl.GetString() ?? "") : "";
                    bool hasNewLaunchCommand = root.TryGetProperty("newLaunchCommand", out var editCommandEl);
                    string newLaunchCommand = hasNewLaunchCommand ? (editCommandEl.GetString() ?? "").Trim() : "";
                    bool hasNewUrl = root.TryGetProperty("newUrl", out var editUrlEl);
                    string newUrl = hasNewUrl ? (editUrlEl.GetString() ?? "").Trim() : "";
                    bool hasDisableGamepad = root.TryGetProperty("disableGamepadControl", out var dgcEl);
                    bool hasMediaHistoryCategory = root.TryGetProperty("mediaHistoryCategory", out var mediaHistoryCategoryEl);
                    string newMediaHistoryCategory = hasMediaHistoryCategory
                        ? NormalizeMediaHistoryCategory(mediaHistoryCategoryEl.GetString())
                        : "auto";
                    bool hasNewTrailerSource = root.TryGetProperty("newTrailerSource", out var trailerSourceEl);
                    string newTrailerSource = hasNewTrailerSource ? (trailerSourceEl.GetString() ?? "").Trim() : "";
                    string newTrailerType = root.TryGetProperty("newTrailerType", out var trailerTypeEl)
                        ? (trailerTypeEl.GetString() ?? "").Trim().ToLowerInvariant()
                        : "";

                    if (!string.IsNullOrEmpty(gameId))
                    {
                        var games = LoadGames();
                        var game = games.FirstOrDefault(g =>
                            string.Equals(g.Path, gameId, StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(g.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase));

                        if (game != null)
                        {
                            bool changed = false;
                            if (hasNewName && !string.IsNullOrEmpty(newName))
                            {
                                game.Name = newName;
                                changed = true;
                                Debug.WriteLine($"[editGame] '{game.Path}' renomeado para: {newName}");
                            }
                            if (hasNewLaunchCommand && !string.IsNullOrWhiteSpace(newLaunchCommand))
                            {
                                string defaultTarget = !string.IsNullOrWhiteSpace(game.LaunchUrl) ? game.LaunchUrl.Trim() : game.Path.Trim();
                                game.LaunchCommand = string.Equals(newLaunchCommand, defaultTarget, StringComparison.OrdinalIgnoreCase)
                                    ? ""
                                    : newLaunchCommand;
                                changed = true;
                                Debug.WriteLine($"[editGame] Comando atualizado para: {game.Name}");
                            }
                            if (hasNewTrailerSource)
                            {
                                var savedTrailer = await SaveGameTrailerAsync(
                                    gameId,
                                    newTrailerSource,
                                    newTrailerType,
                                    game.TrailerSource).ConfigureAwait(true);
                                if (savedTrailer.Success)
                                {
                                    game.TrailerSource = savedTrailer.Source;
                                    game.TrailerType = savedTrailer.Type;
                                    changed = true;
                                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                    {
                                        type = "gameTrailerUpdated",
                                        gameId,
                                        source = savedTrailer.Source,
                                        trailerType = savedTrailer.Type
                                    }));
                                }
                                else
                                {
                                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                    {
                                        type = "gameTrailerUpdateFailed",
                                        gameId
                                    }));
                                }
                            }
                            if (changed)
                            {
                                SaveGames(games);
                                SendGameUpdateToUI(game);
                            }
                        }
                        else
                        {
                            var medias = LoadMediaAppsForUser(currentUserId);
                            var media = medias.FirstOrDefault(m =>
                                string.Equals(m.Id, gameId, StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(m.Url, gameId, StringComparison.OrdinalIgnoreCase));

                            if (media != null)
                            {
                                bool changed = false;
                                if (hasNewName && !string.IsNullOrEmpty(newName))
                                {
                                    media.Name = newName;
                                    changed = true;
                                    Debug.WriteLine($"[editGame] MÃ­dia renomeada para: {newName}");
                                }
                                if (hasDisableGamepad)
                                {
                                    media.DisableGamepadControl = dgcEl.GetBoolean();
                                    changed = true;
                                    Debug.WriteLine($"[editGame] DisableGamepadControl={media.DisableGamepadControl} para: {gameId}");
                                }
                                if (hasNewLaunchCommand &&
                                    string.Equals(media.Type, "exe", StringComparison.OrdinalIgnoreCase) &&
                                    !string.IsNullOrWhiteSpace(newLaunchCommand))
                                {
                                    media.LaunchCommand = string.Equals(newLaunchCommand, media.Url.Trim(), StringComparison.OrdinalIgnoreCase)
                                        ? ""
                                        : newLaunchCommand;
                                    changed = true;
                                    Debug.WriteLine($"[editGame] Comando atualizado para o app: {media.Name}");
                                }
                                if (hasNewUrl &&
                                    (string.Equals(media.Type, "browser", StringComparison.OrdinalIgnoreCase) ||
                                     string.Equals(media.Type, "webview", StringComparison.OrdinalIgnoreCase)) &&
                                    Uri.TryCreate(newUrl, UriKind.Absolute, out var parsedUrl) &&
                                    (parsedUrl.Scheme == Uri.UriSchemeHttp || parsedUrl.Scheme == Uri.UriSchemeHttps))
                                {
                                    media.Url = newUrl;
                                    changed = true;
                                    Debug.WriteLine($"[editGame] URL atualizada para o Web App: {media.Name}");
                                }
                                if (changed)
                                {
                                    SaveMediaApps(medias);
                                    SendMediaAppUpdateToUI(media, gameId);
                                }
                                if (hasMediaHistoryCategory &&
                                    (string.Equals(media.Type, "browser", StringComparison.OrdinalIgnoreCase) ||
                                     string.Equals(media.Type, "webview", StringComparison.OrdinalIgnoreCase)) &&
                                    !string.Equals(media.Id, DoorpiBrowserAppId, StringComparison.OrdinalIgnoreCase))
                                {
                                    media.MediaHistoryCategory = newMediaHistoryCategory;
                                    changed = true;
                                    ApplyMediaHistoryCategoryPreferenceToExistingHistory(media);
                                    Debug.WriteLine($"[editGame] Categoria do histórico={media.MediaHistoryCategory} para: {gameId}");
                                }
                            }
                        }
                    }
                }
                else if (action == "saveSetupUsers" && root.TryGetProperty("users", out var setupUsersEl))
                {
                    int activeIndex = root.TryGetProperty("activeIndex", out var activeEl) ? activeEl.GetInt32() : 0;
                    var incoming = setupUsersEl.EnumerateArray().ToList();
                    var existingUsers = LoadUserProfiles();
                    bool wasEmpty = existingUsers.Count == 0 || existingUsers.All(u => string.IsNullOrWhiteSpace(u.Name));
                    var savedProfiles = new List<(UserProfile Profile, List<string> Folders, bool SyncConnected, bool ImportCloud)>();

                    foreach (var userEl in incoming)
                    {
                        bool isFirstAdmin = !existingUsers.Any(u => u.IsAdmin) && savedProfiles.Count == 0;
                        string requestedProfileId = NormalizeProfileSyncId(GetStr(userEl, "id"));
                        var profile = new UserProfile
                        {
                            Id = string.IsNullOrWhiteSpace(requestedProfileId)
                                ? MakeUserId(GetStr(userEl, "name"))
                                : requestedProfileId,
                            Name = GetStr(userEl, "name"),
                            PhotoBase64 = GetStr(userEl, "photoBase64"),
                            PhotoSource = GetStr(userEl, "photoSource"),
                            PhotoSourceUrl = GetStr(userEl, "photoSourceUrl"),
                            PhotoSteamGridAssetId = userEl.TryGetProperty("photoSteamGridAssetId", out var setupPhotoAssetEl) && setupPhotoAssetEl.TryGetInt32(out int setupPhotoAssetId) ? setupPhotoAssetId : 0,
                            PhotoCropX = userEl.TryGetProperty("photoCropX", out var setupPhotoCropXEl) && setupPhotoCropXEl.TryGetDouble(out double setupPhotoCropX) ? setupPhotoCropX : 0,
                            PhotoCropY = userEl.TryGetProperty("photoCropY", out var setupPhotoCropYEl) && setupPhotoCropYEl.TryGetDouble(out double setupPhotoCropY) ? setupPhotoCropY : 0,
                            PhotoZoom = userEl.TryGetProperty("photoZoom", out var setupPhotoZoomEl) && setupPhotoZoomEl.TryGetDouble(out double setupPhotoZoom) ? setupPhotoZoom : 1,
                            SteamGridApiKey = GetStr(userEl, "apiKey"),
                            PinCode = NormalizePinCode(GetStr(userEl, "pin")),
                            IsAdmin = isFirstAdmin,
                            DateCreated = DateTime.Now,
                            LastUsed = DateTime.Now,
                        };

                        var folders = userEl.TryGetProperty("folders", out var fEl)
                            ? JsonSerializer.Deserialize<List<string>>(fEl.GetRawText()) ?? new()
                            : new List<string>();

                        existingUsers.Add(profile);
                        string userDir = Path.Combine(dataFolder, "users", profile.Id);
                        Directory.CreateDirectory(userDir);
                        WriteUserProfileFile(Path.Combine(userDir, "user.json"), profile);
                        File.WriteAllText(Path.Combine(userDir, "games.json"), "[]");
                        File.WriteAllText(Path.Combine(userDir, "media.json"), "[]");
                        File.WriteAllText(Path.Combine(userDir, "folders.json"),
                            JsonSerializer.Serialize(folders.Select(p => new FolderStats { Path = p }).ToList(),
                                IndentedJsonOptions));

                        bool syncConnected = userEl.TryGetProperty("syncConnected", out var syncConnectedEl) && syncConnectedEl.GetBoolean();
                        bool importCloud = userEl.TryGetProperty("importCloud", out var importCloudEl) && importCloudEl.GetBoolean();
                        savedProfiles.Add((profile, folders, syncConnected, importCloud));
                    }

                    SaveUserProfiles(existingUsers.Where(u => !string.IsNullOrWhiteSpace(u.Name)).ToList());

                    if (savedProfiles.Count > 0)
                    {
                        activeIndex = Math.Clamp(activeIndex, 0, savedProfiles.Count - 1);
                        var active = savedProfiles[activeIndex].Profile;
                        SetActiveUser(active, migrateLegacyFiles: wasEmpty && File.Exists(Path.Combine(dataFolder, "games.json")));
                        RestartWatchers();
                        PostUserTransitionStart("initial", active);

                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                var activeSync = savedProfiles[activeIndex];
                                if (activeSync.SyncConnected)
                                    await CompletePendingSetupProfileSyncAsync(activeSync.Profile.Id, activeSync.ImportCloud)
                                        .ConfigureAwait(false);

                                // O Segredo 1: Executa a validaÃ§Ã£o das mÃ­dias simultaneamente para TODOS os usuÃ¡rios
                                await Dispatcher.InvokeAsync(LoadCurrentUserIntoUI);
                                await WaitForConsoleShellReadyForUserTransitionAsync().ConfigureAwait(false);
                                _ = Dispatcher.BeginInvoke(() =>
                                {
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideSystemLoading\"}");
                                });
                                PostUserTransitionComplete("initial", showTransition: true, restartAudio: true, waitForHomeReady: true);

                                _ = Task.Run(async () =>
                                {
                                    try
                                    {
                                        var initTasks = new List<Task>();
                                        foreach (var item in savedProfiles)
                                        {
                                            string mediaPath = Path.Combine(dataFolder, "users", item.Profile.Id, "media.json");
                                            bool isActive = string.Equals(item.Profile.Id, currentUserId, StringComparison.OrdinalIgnoreCase);
                                            initTasks.Add(SynchronizeNativeAppsAsync(
                                                item.Profile.Id,
                                                mediaPath,
                                                addMissingApps: true,
                                                silent: !isActive));
                                        }

                                        await Task.WhenAll(initTasks).ConfigureAwait(false);
                                    }
                                    catch (Exception ex)
                                    {
                                        Debug.WriteLine("[SetupBatch] Inicializacao em background falhou: " + ex.Message);
                                    }
                                });
                            }
                            catch (Exception ex)
                            {
                                Debug.WriteLine("[SetupBatch] Erro: " + ex.Message);
                                _ = Dispatcher.BeginInvoke(() =>
                                    webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideSystemLoading\"}"));
                                try { PostUserTransitionComplete("initial", showTransition: true, restartAudio: false, waitForHomeReady: true); } catch { }
                            }
                        });
                    }
                }
                else if (action == "deleteCurrentUser")
                {
                    await HandleDeleteCurrentUserAsync();
                }
                else if (action == "saveUserProfile")
                {
                    bool createNew = root.TryGetProperty("createNew", out var createEl) && createEl.GetBoolean();
                    bool isPrimary = root.TryGetProperty("isPrimary", out var isPrimEl) && isPrimEl.GetBoolean();
                    bool isLast = root.TryGetProperty("isLast", out var isLastEl) && isLastEl.GetBoolean();
                    bool skipTasks = root.TryGetProperty("skipTasks", out var skipEl) && skipEl.GetBoolean();
                    bool hasPin = root.TryGetProperty("pin", out _);
                    bool hasApiKey = root.TryGetProperty("apiKey", out _);
                    bool hasApplicationHistoryEnabled = root.TryGetProperty("applicationHistoryEnabled", out var historyEnabledEl) &&
                                                        (historyEnabledEl.ValueKind == JsonValueKind.True || historyEnabledEl.ValueKind == JsonValueKind.False);
                    bool hasPhotoMetadata = root.TryGetProperty("photoSource", out _) ||
                                            root.TryGetProperty("photoSourceUrl", out _) ||
                                            root.TryGetProperty("photoSteamGridAssetId", out _) ||
                                            root.TryGetProperty("photoCropX", out _) ||
                                            root.TryGetProperty("photoCropY", out _) ||
                                            root.TryGetProperty("photoZoom", out _);
                    string requestedPin = hasPin ? NormalizePinCode(GetStr(root, "pin")) : "";

                    string requestedId = GetStr(root, "userId");
                    var profile = new UserProfile
                    {
                        Id = createNew ? "" : (!string.IsNullOrWhiteSpace(requestedId) ? requestedId : currentUserId),
                        Name = GetStr(root, "name"),
                        PhotoBase64 = GetStr(root, "photoBase64"),
                        PhotoSource = GetStr(root, "photoSource"),
                        PhotoSourceUrl = GetStr(root, "photoSourceUrl"),
                        PhotoSteamGridAssetId = root.TryGetProperty("photoSteamGridAssetId", out var photoAssetEl) && photoAssetEl.TryGetInt32(out int photoAssetId) ? photoAssetId : 0,
                        PhotoCropX = root.TryGetProperty("photoCropX", out var photoCropXEl) && photoCropXEl.TryGetDouble(out double photoCropX) ? photoCropX : 0,
                        PhotoCropY = root.TryGetProperty("photoCropY", out var photoCropYEl) && photoCropYEl.TryGetDouble(out double photoCropY) ? photoCropY : 0,
                        PhotoZoom = root.TryGetProperty("photoZoom", out var photoZoomEl) && photoZoomEl.TryGetDouble(out double photoZoom) ? photoZoom : 1,
                        SteamGridApiKey = hasApiKey ? GetStr(root, "apiKey") : "",
                        PinCode = requestedPin,
                        ApplicationHistoryEnabled = !hasApplicationHistoryEnabled || historyEnabledEl.GetBoolean(),
                        DateCreated = DateTime.Now,
                        LastUsed = DateTime.Now,
                    };

                    var users = LoadUserProfiles();
                    var existingUser = !createNew
                        ? users.FirstOrDefault(u => string.Equals(u.Id, profile.Id, StringComparison.OrdinalIgnoreCase))
                        : null;

                    if (existingUser != null)
                    {
                        existingUser.Name = profile.Name;
                        existingUser.PhotoBase64 = profile.PhotoBase64;
                        if (hasPhotoMetadata)
                        {
                            existingUser.PhotoSource = profile.PhotoSource;
                            existingUser.PhotoSourceUrl = profile.PhotoSourceUrl;
                            existingUser.PhotoSteamGridAssetId = profile.PhotoSteamGridAssetId;
                            existingUser.PhotoCropX = profile.PhotoCropX;
                            existingUser.PhotoCropY = profile.PhotoCropY;
                            existingUser.PhotoZoom = profile.PhotoZoom;
                        }
                        if (hasApiKey) existingUser.SteamGridApiKey = profile.SteamGridApiKey;
                        if (hasPin) existingUser.PinCode = requestedPin;
                        if (hasApplicationHistoryEnabled)
                        {
                            existingUser.ApplicationHistoryEnabled = historyEnabledEl.GetBoolean();
                            if (!existingUser.ApplicationHistoryEnabled) FinalizeMediaHistorySession(saveEligibleActivity: true);
                        }
                        existingUser.LastUsed = DateTime.Now;
                        profile.DateCreated = existingUser.DateCreated;
                        profile = existingUser;
                    }
                    else
                    {
                        profile.Id = MakeUserId(profile.Name);
                        profile.IsAdmin = users.Count == 0 || !users.Any(u => u.IsAdmin);
                        users.Add(profile);
                    }

                    SaveUserProfiles(users);

                    bool isFirstEver = users.Count == 1;
                    bool shouldShowInitialTransition = isFirstEver && isLast && !skipTasks;
                    SetActiveUser(profile, migrateLegacyFiles: isFirstEver && !createNew);
                    RestartWatchers();
                    SaveUserProfile(profile);
                    if (shouldShowInitialTransition)
                        PostUserTransitionStart("initial", profile);

                    if (root.TryGetProperty("folders", out var foldersEl))
                    {
                        var paths = JsonSerializer.Deserialize<List<string>>(foldersEl.GetRawText()) ?? new();
                        var existing = LoadFoldersData();
                        foreach (var path in paths)
                        {
                            if (!existing.Any(f => string.Equals(f.Path, path, StringComparison.OrdinalIgnoreCase)))
                            {
                                existing.Add(new FolderStats { Path = path });
                                AddFolderWatcher(path);
                            }
                        }
                        SaveFoldersData(existing);
                    }

                    if (!skipTasks)
                    {
                        string taskUserId = profile.Id;
                        string taskMediaFile = Path.Combine(dataFolder, "users", taskUserId, "media.json");

                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await SynchronizeNativeAppsAsync(
                                    taskUserId,
                                    taskMediaFile,
                                    addMissingApps: existingUser == null);
                                if (isLast)
                                {
                                    await Dispatcher.InvokeAsync(LoadCurrentUserIntoUI);
                                    await WaitForConsoleShellReadyForUserTransitionAsync().ConfigureAwait(false);
                                    Dispatcher.Invoke(() =>
                                    {
                                        webView.CoreWebView2.PostWebMessageAsString("{\"type\":\"hideSystemLoading\"}");
                                    });
                                    if (shouldShowInitialTransition)
                                        PostUserTransitionComplete("initial", showTransition: true, restartAudio: true);
                                }
                            }
                            catch (Exception ex)
                            {
                                Debug.WriteLine("[Setup] Erro: " + ex.Message);
                                if (shouldShowInitialTransition)
                                {
                                    try { PostUserTransitionComplete("initial", showTransition: true, restartAudio: false, waitForHomeReady: false); } catch { }
                                }
                            }
                        });
                    }
                    else
                    {
                        Dispatcher.Invoke(() =>
                        {
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(BuildCurrentUserPayload(profile)));
                        });
                    }
                }
                else if (action == "requestUsers")
                {
                    SendUsersToUI(requireSelection: false);
                }
                else if (action == "requestUsersData")
                {
                    SendUsersDataToUI();
                }
                else if (action == "selectUser")
                {
                    string userId = GetStr(root, "userId");
                    if (!string.IsNullOrWhiteSpace(userId))
                    {
                        var requestedUser = LoadUserProfiles()
                            .FirstOrDefault(u => string.Equals(u.Id, userId, StringComparison.OrdinalIgnoreCase));
                        if (requestedUser != null && !string.IsNullOrWhiteSpace(requestedUser.PinCode))
                        {
                            string pin = NormalizePinCode(GetStr(root, "pin"));
                            if (!string.Equals(pin, requestedUser.PinCode, StringComparison.Ordinal))
                            {
                                Dispatcher.Invoke(() =>
                                    webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                                    {
                                        type = "userPinRejected",
                                        userId
                                    })));
                                return;
                            }
                        }
                        SwitchToUser(userId);
                    }
                }
                else if (action == "recoverUserPin")
                {
                    string userId = GetStr(root, "userId");
                    string userName = GetStr(root, "userName");
                    string newPin = NormalizePinCode(GetStr(root, "pin"));
                    var users = LoadUserProfiles();
                    var requestedUser = users.FirstOrDefault(u =>
                        string.Equals(u.Id, userId, StringComparison.OrdinalIgnoreCase));

                    string? reason = null;
                    if (requestedUser == null)
                        reason = "pinRecoveryFailed";
                    else if (!string.Equals(userName, requestedUser.Name, StringComparison.Ordinal))
                        reason = "pinRecoveryInvalidName";
                    else if (newPin.Length != 4)
                        reason = "pinRecoveryInvalidPin";

                    if (reason != null)
                    {
                        Dispatcher.Invoke(() =>
                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                            {
                                type = "userPinRecoveryRejected",
                                reason,
                                userId
                            })));
                        return;
                    }

                    requestedUser!.PinCode = newPin;
                    requestedUser.LastUsed = DateTime.Now;
                    SaveUserProfiles(users);
                    SwitchToUser(requestedUser.Id);
                }
                else if (action == "requestExtensions")
                {
                    SendExtensionsToUI();
                }
                else if (action == "requestIntros")
                {
                    SendIntrosToUI();
                }
                else if (action == "setActiveIntro")
                {
                    SetActiveIntro(GetStr(root, "id"));
                    SendIntrosToUI();
                }
                else if (action == "requestExtensionUpdates")
                {
                    _ = Task.Run(CheckAndSendExtensionUpdatesAsync);
                }
                else if (action == "installExtension")
                {
                    string url = GetStr(root, "url");
                    string successMsg = GetStr(root, "successMsg", "ExtensÃ£o instalada com sucesso.");

                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await InstallChromeExtensionAsync(url);
                            SendExtensionsToUI("success", successMsg);
                        }
                        catch (Exception ex)
                        {
                            SendExtensionsToUI("error", ex.Message);
                        }
                    });
                }
                else if (action == "deleteExtension")
                {
                    string id = GetStr(root, "id");
                    _ = Task.Run(() =>
                    {
                        try
                        {
                            DeleteExtension(id);
                            SendExtensionsToUI("success", "ExtensÃ£o removida. As mudanÃ§as terÃ£o efeito na prÃ³xima vez que abrir um app.");
                        }
                        catch (Exception ex)
                        {
                            SendExtensionsToUI("error", "Erro ao remover: " + ex.Message);
                        }
                    });
                }
                else if (action == "openExtensionStore")
                {
                    _extBtnTitle = GetStr(root, "extBtnTitle", "Adicionar extensÃ£o ao Doorpi");
                    _extBtnSub = GetStr(root, "extBtnSub", "Instalar via Doorpi Browser");
                    _extToastTitle = GetStr(root, "toastTitle", "Doorpi");
                    _extToastSub = GetStr(root, "toastSub", "ExtensÃ£o enviada ao Doorpi!");
                    _extInstalledTitle = GetStr(root, "extInstalledTitle", "JÃ¡ instalada no Doorpi");
                    _extInstalledSub = GetStr(root, "extInstalledSub", "Em uso no seu navegador");

                    string hl = System.Globalization.CultureInfo.CurrentUICulture.Name.Replace('_', '-');
                    string cwsUrl = $"https://chromewebstore.google.com/category/extensions?hl={hl}";

                    _ = Dispatcher.InvokeAsync(async () =>
                        await OpenWebViewInlineAsync(cwsUrl, false));
                }
                else if (action == "openWebAppBrowserCapture")
                {
                    _ = Dispatcher.InvokeAsync(async () =>
                    {
                        BeginGenericBrowserWebAppUrlCapture();
                        await OpenWebViewInlineAsync(DoorpiBrowserHomeUrl, false, "Browser", "", "", true);
                    });
                }
                else if (action == "openTrailerBrowserCapture")
                {
                    string searchUrl = GetStr(root, "url", "https://www.youtube.com/");
                    if (!Uri.TryCreate(searchUrl, UriKind.Absolute, out var parsedSearch) ||
                        (parsedSearch.Scheme != Uri.UriSchemeHttp && parsedSearch.Scheme != Uri.UriSchemeHttps))
                        searchUrl = "https://www.youtube.com/";
                    _ = Dispatcher.InvokeAsync(async () =>
                    {
                        BeginGenericBrowserUrlCapture("gameTrailer");
                        await OpenWebViewInlineAsync(searchUrl, false, "Buscar trailer", "", "", true);
                    });
                }
                else if (action == "openImageBrowserCapture")
                {
                    string target = GetStr(root, "target", "profilePhoto");
                    if (target != "profilePhoto" && target != "historyArtwork")
                        target = "profilePhoto";
                    _ = Dispatcher.InvokeAsync(async () =>
                    {
                        BeginGenericBrowserUrlCapture(target);
                        await OpenWebViewInlineAsync(DoorpiBrowserHomeUrl, false, "Browser", "", "", true);
                    });
                }
                else if (action == "updateAppSharing")
                {
                    string appId = GetStr(root, "appId");
                    string shareMode = GetStr(root, "shareMode", "private");
                    var users = LoadUserProfiles();
                    var sharedWithUserIds = new List<string>();
                    if (root.TryGetProperty("sharedWithUserIds", out var sharedIdsEl) && sharedIdsEl.ValueKind == JsonValueKind.Array)
                    {
                        sharedWithUserIds = sharedIdsEl.EnumerateArray()
                            .Select(e => e.GetString() ?? "")
                            .Where(id => !string.IsNullOrWhiteSpace(id) && !string.Equals(id, currentUserId, StringComparison.OrdinalIgnoreCase))
                            .Distinct(StringComparer.OrdinalIgnoreCase)
                            .ToList();
                    }
                    else
                    {
                        string sharedWithUserId = GetStr(root, "sharedWithUserId");
                        if (!string.IsNullOrWhiteSpace(sharedWithUserId) && !string.Equals(sharedWithUserId, currentUserId, StringComparison.OrdinalIgnoreCase))
                            sharedWithUserIds.Add(sharedWithUserId);
                    }

                    var apps = LoadMediaAppsForUser(currentUserId);
                    var app = apps.FirstOrDefault(a => string.Equals(a.Id, appId, StringComparison.OrdinalIgnoreCase) ||
                                                       string.Equals(a.Url, appId, StringComparison.OrdinalIgnoreCase));
                    if (app != null && !app.IsSharedFromOtherUser)
                    {
                        if (!string.Equals(app.Type, "browser", StringComparison.OrdinalIgnoreCase) &&
                            !string.Equals(app.Type, "webview", StringComparison.OrdinalIgnoreCase))
                            return;

                        app.OwnerUserId = currentUserId;
                        app.ShareMode = shareMode is "all" or "user" ? shareMode : "private";
                        if (app.ShareMode == "user" && sharedWithUserIds.Count == 0)
                            app.ShareMode = "private";
                        app.SharedWithUserIds = app.ShareMode == "user" ? sharedWithUserIds : new List<string>();
                        app.SharedWithUserId = app.SharedWithUserIds.FirstOrDefault() ?? "";
                        app.SharedWithUserNames = app.ShareMode == "user"
                            ? app.SharedWithUserIds
                                .Select(id => users.FirstOrDefault(u => string.Equals(u.Id, id, StringComparison.OrdinalIgnoreCase))?.Name ?? "")
                                .Where(name => !string.IsNullOrWhiteSpace(name))
                                .ToList()
                            : new List<string>();
                        app.SharedWithUserName = app.SharedWithUserNames.FirstOrDefault() ?? "";
                        SaveMediaApps(apps);
                        SendUsersDataToUI();
                        SendMediaAppsToUI(LoadMediaApps());
                    }
                }
                else if (action == "pickProfilePhoto")
                {
                    string dialogTitle = GetStr(root, "dialogTitle", "Select profile photo");
                    string dialogFilter = GetStr(root, "dialogFilter", "Images (*.png;*.jpg;*.jpeg;*.webp;*.gif)|*.png;*.jpg;*.jpeg;*.webp;*.gif");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        string? selectedFile = await ShowDoorpiFileBrowserAsync(
                            dialogTitle, false, dialogFilter, "legacyProfilePhoto");

                        if (!string.IsNullOrWhiteSpace(selectedFile))
                        {
                            string b64 = Convert.ToBase64String(File.ReadAllBytes(selectedFile));
                            webView.CoreWebView2.PostWebMessageAsString(
                                JsonSerializer.Serialize(new { type = "profilePhotoSelected", base64 = b64 }));
                        }
                    }).Task.Unwrap();
                }
                else if (action == "openUrl" && root.TryGetProperty("url", out var urlEl))
                {
                    string url = urlEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(url))
                        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                }
                else if (action == "openStoreDownloadSite")
                {
                    string storeId = GetStr(root, "storeId");
                    string url = GetStr(root, "url");
                    string name = GetStr(root, "name");
                    if (HasBlockingSessionForStoreDownload())
                    {
                        PromptStoreDownloadBlockedBySessions(storeId, url, name);
                        return;
                    }
                    _ = Dispatcher.InvokeAsync(async () => await OpenStoreDownloadSiteAsync(storeId, url, name));
                }
                else if (action == "closeAllSessionsForStoreDownload")
                {
                    string storeId = GetStr(root, "storeId");
                    string url = GetStr(root, "url");
                    string name = GetStr(root, "name");
                    _ = Task.Run(async () => await CloseSessionsAndOpenStoreDownloadAsync(storeId, url, name));
                }
                else if (action == "openStore" && root.TryGetProperty("storeId", out var storeIdEl))
                {
                    string storeId = storeIdEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(storeId))
                        _ = Dispatcher.InvokeAsync(async () => await OpenStoreAsync(storeId));
                }
                else if (action == "requestStores")
                {
                    SendStoresToUI(LoadStoreLaunchers());
                }
                else if (action == "closeStore")
                {
                    CloseStoreSessionCompletely();
                }
                else if (action == "resumeStore")
                {
                    if (!TryRestoreStoreChildGameSession())
                        ResumeStoreSession();
                }
                else if (action == "requestStoreAutoAddSettings")
                {
                    SendStoreAutoAddSettingsToUI();
                }
                else if (action == "setStoreGamepadControl"
                         && root.TryGetProperty("storeId", out var storeGamepadStoreIdEl)
                         && root.TryGetProperty("disabled", out var storeGamepadDisabledEl))
                {
                    string storeId = storeGamepadStoreIdEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(storeId))
                    {
                        SaveStoreGamepadControlSetting(storeId, storeGamepadDisabledEl.GetBoolean());
                    }
                }
                else if (action == "setStoreAutoAdd"
                         && root.TryGetProperty("store", out var storeKeyEl)
                         && root.TryGetProperty("enabled", out var storeEnabledEl))
                {
                    string storeKey = storeKeyEl.GetString() ?? "";
                    if (!string.IsNullOrEmpty(storeKey))
                    {
                        SaveStoreAutoAddSetting(storeKey, storeEnabledEl.GetBoolean());
                        SendStoreAutoAddSettingsToUI();
                    }
                }
                else if (action == "setAdminStorePolicy"
                         && root.TryGetProperty("storeId", out var adminStoreIdEl))
                {
                    string storeId = adminStoreIdEl.GetString() ?? "";
                    bool? blocked = root.TryGetProperty("blockedForNonAdmins", out var blockedEl)
                        ? blockedEl.GetBoolean()
                        : null;
                    bool? forceSteam = root.TryGetProperty("steamForceAccountSelection", out var forceSteamEl)
                        ? forceSteamEl.GetBoolean()
                        : null;

                    if (!string.IsNullOrWhiteSpace(storeId) && IsCurrentUserAdmin())
                    {
                        var currentBlocked = GetAdminBlockedStoreIds();
                        SaveAdminStorePolicy(
                            storeId,
                            blocked ?? currentBlocked.Contains(NormalizeStorePolicyKey(storeId)),
                            forceSteam);
                        SendStoresToUI(LoadStoreLaunchers());
                        LoadGamesIntoUI();
                    }
                }
                else if (action == "launchMediaApp" && root.TryGetProperty("url", out var mediaUrlEl))
                {
                    ResumeExecutionLockWatch();

                    _currentToastTitle = GetStr(root, "toastTitle", "Copiado!");
                    _currentToastSub = GetStr(root, "toastSub", "Retornando...");

                    string mediaUrl = mediaUrlEl.GetString() ?? "";
                    string appType = root.TryGetProperty("appType", out var atEl)
                                      ? (atEl.GetString() ?? "browser") : "browser";

                    if (!string.IsNullOrEmpty(mediaUrl))
                    {
                        var medias = LoadMediaAppsForUser(currentUserId);
                        bool isExecutableApp = string.Equals(appType, "exe", StringComparison.OrdinalIgnoreCase);
                        string resolvedRequestedMediaUrl = isExecutableApp
                            ? ResolveCurrentVersionedExecutablePath(mediaUrl)
                            : mediaUrl;
                        var media = medias.FirstOrDefault(m =>
                            string.Equals(m.Url, mediaUrl, StringComparison.OrdinalIgnoreCase) ||
                            string.Equals(m.Id, mediaUrl, StringComparison.OrdinalIgnoreCase) ||
                            (isExecutableApp && string.Equals(m.Url, resolvedRequestedMediaUrl, StringComparison.OrdinalIgnoreCase)));

                        if (isExecutableApp)
                        {
                            string executableUrl = !string.IsNullOrWhiteSpace(media?.Url) ? media!.Url : resolvedRequestedMediaUrl;
                            string resolvedExecutable = ResolveCurrentVersionedExecutablePath(executableUrl);
                            bool hasConfiguredCommand = !string.IsNullOrWhiteSpace(media?.LaunchCommand);

                            if (!hasConfiguredCommand && Path.IsPathRooted(executableUrl) && !File.Exists(resolvedExecutable))
                            {
                                Debug.WriteLine($"[launchMediaApp/exe] ExecutÃ¡vel nÃ£o encontrado: {executableUrl}");
                                return;
                            }

                            if (!hasConfiguredCommand && File.Exists(resolvedExecutable))
                            {
                                mediaUrl = resolvedExecutable;
                                if (media != null && !string.Equals(media.Url, resolvedExecutable, StringComparison.OrdinalIgnoreCase))
                                    media.Url = resolvedExecutable;
                            }
                        }

                        if (media != null)
                        {
                            media.LastPlayed = DateTime.Now;
                            SaveMediaApps(medias);

                            webView.CoreWebView2.PostWebMessageAsString(JsonSerializer.Serialize(new
                            {
                                type = "updateFeaturedCard",
                                tab = "media",
                                id = media.Id
                            }));


                            _ = Dispatcher.InvokeAsync(() => SendMediaAppsToUI(LoadMediaApps()));
                        }


                        SuspendMainUiGamepadForGameLaunch();

                        if (appType == "webview" || appType == "browser")
                        {
                            if (_mediaExeModeActive) _mediaExeModeActive = false;

                            string mediaName = media?.Name ?? "App";
                            string heroImg = media?.HeroImage ?? "";
                            string gridImg = media?.GridImage ?? "";
                            string logoImg = !string.IsNullOrWhiteSpace(media?.LogoStaticImage)
                                ? media!.LogoStaticImage
                                : media?.LogoImage ?? "";

                            DiscordRpcManager.Instance.UpdateState("media", mediaUrl, mediaName);

                            SendGameLaunchStatus("gameLaunching", mediaName, heroImg, gridImg, "app");
                            Dispatcher.Invoke(() =>
                            {
                                EnsureCursorVisible();
                                _mainScreenMouseVisible = true;
                                CenterCursorOnScreen();
                            });
                            bool isGenericBrowser = string.Equals(media?.Id, DoorpiBrowserAppId, StringComparison.OrdinalIgnoreCase);
                            bool isDoorpiYouTubeTv = IsDoorpiYouTubeTvApp(media, mediaUrl);
                            _ = Dispatcher.InvokeAsync(async () => await OpenWebViewInlineAsync(mediaUrl, isDoorpiYouTubeTv, mediaName, heroImg, gridImg, isGenericBrowser, logoImg));
                        }
                        else if (appType == "exe")
                        {
                            Dispatcher.Invoke(() =>
                            {
                                try
                                {
                                    string configuredCommand = ResolveMediaLaunchCommand(media, mediaUrl);
                                    string executablePath = ResolveMediaExecutablePath(media, mediaUrl);
                                    ActivateExecutableAppSession(mediaUrl);
                                    var executableSession = EnsureExecutableAppSession(mediaUrl);

                                    string mediaName = media?.Name ?? "App";
                                    string heroImg = media?.HeroImage ?? "";
                                    string gridImg = media?.GridImage ?? "";

                                    // -- JÃ¡ estÃ¡ rodando? Restaura em vez de relanÃ§ar -------------
                                    Process? existingProc = null;

                                    if (executableSession.Process != null && !SafeHasExited(executableSession.Process))
                                    {
                                        existingProc = executableSession.Process;
                                    }
                                    else if (File.Exists(executablePath))
                                    {
                                        existingProc = FindRunningProcessForExe(executablePath);
                                    }
                                    if (existingProc != null)
                                    {
                                        IntPtr hwnd = IntPtr.Zero;
                                        if (TryFindMediaExeWindowCandidate(
                                                executableSession,
                                                mediaUrl,
                                                mediaName,
                                                allowNewWindowFallback: true,
                                                out var windowProcess,
                                                out var windowHandle) &&
                                            windowProcess != null)
                                        {
                                            existingProc = windowProcess;
                                            hwnd = windowHandle;
                                        }

                                        if (hwnd == IntPtr.Zero)
                                        {
                                            hwnd = FindVisibleWindowForProcess(existingProc.Id);
                                            if (hwnd == IntPtr.Zero)
                                                hwnd = FindAnyWindowForProcess(existingProc.Id);
                                        }

                                        if (hwnd != IntPtr.Zero)
                                        {
                                            executableSession.MouseModeActive = false;

                                            InitializeMediaExeMouseModeForSession(executableSession, media);
                                            executableSession.GamepadDisabled = !executableSession.MouseModeRequested;

                                            // -- MÃGICA: Zera o temporizador de seguranÃ§a para pular os 3 segundos de carregamento artificial --
                                            _launchAnimationStartedUtc = DateTime.MinValue;

                                            // Restaura e foca
                                            if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
                                            ShowWindow(hwnd, 3);
                                            FocusExternalWindow(hwnd);

                                            // SEMPRE cancela e recria o watcher, pois o antigo deu return ao minimizar!
                                            executableSession.WatcherCts?.Cancel();
                                            executableSession.WatcherCts = new CancellationTokenSource();
                                            executableSession.Process = existingProc;
                                            executableSession.Url = mediaUrl;
                                            executableSession.DoorpiSuspended = false;
                                            executableSession.WatcherPaused = false;
                                            InitializeMediaExeProcessGroup(mediaUrl, existingProc, executablePath: executablePath);
                                            StartMediaExeWatcher(existingProc, mediaUrl, mediaName, executableSession.WatcherCts.Token);
                                            int sessionId = NextExecutableAppSessionId(executableSession);
                                            EnsureMediaExeShortcutThread(sessionId);

                                            // Liga o modo controle novamente
                                            if (executableSession.MouseModeRequested)
                                                StartMediaExeMouseModeForSession(sessionId, centerCursor: true);

                                            SendRuntimeSessionsToUI();

                                            return;
                                        }
                                    }

                                    // -- LanÃ§a um processo novo ------------------------------------
                                    executableSession.MouseModeActive = false;
                                    executableSession.WatcherCts?.Cancel();

                                    Process? proc = null;
                                    HashSet<int>? baselineBeforeLaunch = SnapshotProcessIds();
                                    if (!string.IsNullOrWhiteSpace(configuredCommand))
                                        proc = LaunchCommand.Start(configuredCommand, ProcessWindowStyle.Maximized);

                                    if (proc != null || baselineBeforeLaunch != null)
                                    {
                                        executableSession.MouseModeRequested = ShouldStartMouseMode(media);
                                        executableSession.MouseModeInitialized = true;
                                        executableSession.GamepadDisabled = !executableSession.MouseModeRequested;

                                        if (proc != null && executableSession.MouseModeRequested)
                                        {
                                            EnterMediaExeMode(proc, mediaUrl, mediaName, heroImg, gridImg, baselineBeforeLaunch, executablePath);
                                        }
                                        else
                                        {
                                            SendGameLaunchStatus("gameLaunching", mediaName, heroImg, gridImg, "app");
                                            executableSession.WatcherCts = new CancellationTokenSource();
                                            executableSession.Process = proc;
                                            executableSession.Url = mediaUrl;
                                            InitializeMediaExeProcessGroup(mediaUrl, proc, baselineBeforeLaunch, executablePath);
                                            executableSession.WatcherPaused = false;
                                            executableSession.DoorpiSuspended = false;
                                            int sessionId = NextExecutableAppSessionId(executableSession);

                                            StartMediaExeWatcher(proc, mediaUrl, mediaName, executableSession.WatcherCts.Token);
                                            EnsureMediaExeShortcutThread(sessionId);
                                        }
                                    }
                                }
                                catch (Exception ex) { Debug.WriteLine($"[launchMediaApp/exe] {ex.Message}"); }
                            });
                        }
                    }
                }

                else if (action == "closeRunningItem")
                {
                    string id = GetStr(root, "id");
                    string url = GetStr(root, "url");
                    string channel = GetStr(root, "channel");
                    string appType = GetStr(root, "appType");

                    await Dispatcher.InvokeAsync(() => CloseRunningItem(id, url, channel, appType));
                }
                else if (action == "restoreExecutionLock")
                {
                    await Dispatcher.InvokeAsync(RestoreExecutionLockSession);
                }
                else if (action == "manualGameWindowRestore")
                {
                    await Dispatcher.InvokeAsync(BeginManualGameWindowRestore);
                }
                else if (action == "closeExecutionLock")
                {
                    await Dispatcher.InvokeAsync(CloseExecutionLockSession);
                }
                else if (action == "requestExecutionLockFromRuntime")
                {
                    string kind = GetStr(root, "kind");
                    string channel = GetStr(root, "channel");
                    string id = GetStr(root, "id");
                    string url = GetStr(root, "url");
                    await Dispatcher.InvokeAsync(() => RequestExecutionLockFromRuntime(kind, channel, id, url));
                }

                else if (action == "pickFolderForSetup")
                {
                    string dialogTitle = GetStr(root, "dialogTitle");
                    string forbiddenMsg = GetStr(root, "forbiddenMsg");
                    string forbiddenTitle = GetStr(root, "forbiddenTitle");

                    await Dispatcher.InvokeAsync(async () =>
                    {
                        string? selectedFolder = await ShowDoorpiFileBrowserAsync(
                            dialogTitle, true, source: "setupFolder");
                        string selectedPath = "";

                        if (!string.IsNullOrWhiteSpace(selectedFolder))
                        {
                            string path = selectedFolder;
                            if (IsFolderForbidden(path))
                            {
                                System.Windows.MessageBox.Show(forbiddenMsg, forbiddenTitle,
                                    MessageBoxButton.OK, MessageBoxImage.Warning);
                            }
                            else
                            {
                                selectedPath = path;
                            }
                        }
                        webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new { type = "setupFolderDialogClosed", path = selectedPath }));
                    }).Task.Unwrap();
                }
                else if (action == "readClipboard")
                {
                    await Dispatcher.InvokeAsync(() =>
                    {
                        string text = System.Windows.Clipboard.GetText();
                        webView.CoreWebView2.PostWebMessageAsString(
                            JsonSerializer.Serialize(new { type = "clipboardText", text }));
                    });
                }
                else if (action == "systemMouseMove")
                {
                    int dx = root.TryGetProperty("dx", out var dxEl) ? dxEl.GetInt32() : 0;
                    int dy = root.TryGetProperty("dy", out var dyEl) ? dyEl.GetInt32() : 0;
                    Dispatcher.Invoke(() =>
                    {
                        if (GetCursorPos(out var pt))
                            SetCursorPos(pt.X + dx, pt.Y + dy);
                    });
                }
                else if (action == "systemMouseClick")
                {
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                }
                else if (action == "systemMouseRightClick")
                {
                    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
                    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
                    mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                    mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
                }
                else if (action == "enterDesktopMode")
                {
                    Dispatcher.Invoke(EnterDesktopMode);
                }
                else if (action == "detectBrowsers")
                {
                    var candidates = new[]
                    {
                        new { name = "Google Chrome", exe = "chrome.exe",   path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),    "Google", "Chrome", "Application", "chrome.exe") },
                        new { name = "Google Chrome", exe = "chrome.exe",   path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe") },
                        new { name = "Microsoft Edge", exe = "msedge.exe",  path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe") },
                        new { name = "Brave",          exe = "brave.exe",   path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BraveSoftware", "Brave-Browser", "Application", "brave.exe") },
                        new { name = "Firefox",        exe = "firefox.exe", path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),    "Mozilla Firefox", "firefox.exe") },
                        new { name = "Firefox",        exe = "firefox.exe", path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Mozilla Firefox", "firefox.exe") },
                    };

                    var found = candidates
                        .Where(b => File.Exists(b.path))
                        .GroupBy(b => b.exe)
                        .Select(g => g.First())
                        .ToList();

                    var json = JsonSerializer.Serialize(new { type = "browsersDetected", browsers = found });
                    webView.CoreWebView2.PostWebMessageAsString(json);
                }
            }
            catch (Exception ex) { Debug.WriteLine($"Erro no WebView Message: {ex.Message}"); }
        }

        private static bool IsTrustedMainWebMessageSource(string source)
        {
            try
            {
                if (!Uri.TryCreate(source, UriKind.Absolute, out var uri))
                    return false;

                return string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
                       string.Equals(uri.Host, "app.local", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

    }
}
