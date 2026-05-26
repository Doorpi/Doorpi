
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using Windows.Media;
using Windows.Storage.Streams;

namespace Doorpi
{
    public partial class MainWindow : Window
    {


        private static string? _cachedBrandedUA = null;


        private async Task<string> BuildBrandedUserAgentAsync(CoreWebView2 cw)
        {
            if (_cachedBrandedUA != null) return _cachedBrandedUA;
            try
            {
                // ExecuteScriptAsync retorna JSON; deserializamos para obter a string limpa.
                string raw = await cw.ExecuteScriptAsync("navigator.userAgent");
                string ua = JsonSerializer.Deserialize<string>(raw) ?? "";

                if (!string.IsNullOrWhiteSpace(ua))
                {
                    _cachedBrandedUA = ua.TrimEnd() + " Doorpi/1.6.1";
                    Debug.WriteLine($"[UA] Branded UA gerado: {_cachedBrandedUA}");
                    return _cachedBrandedUA;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[UA] Falha ao ler UA nativo do Chromium: {ex.Message}");
            }

            // Fallback estático seguro para o caso de falha na leitura do UA.
            const string fallback = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Doorpi/1.6.1";
            _cachedBrandedUA = fallback;
            return fallback;
        }


        // =====================================================================
        // MÓDULO 2 — PERMISSÕES DE IMERSÃO E DRM
        // =====================================================================
        // Anexar ao PermissionRequested de _ytWebView E _popupWebView.
        // Aprovação silenciosa para DRM (Netflix/Prime/Max em HD).
        // Negação silenciosa para permissões invasivas (quebram imersão de console).
        // =====================================================================
        private void OnWebViewPermissionRequested(
            object? sender,
            CoreWebView2PermissionRequestedEventArgs e)
        {
            switch (e.PermissionKind)
            {
                case CoreWebView2PermissionKind.Notifications:
                case CoreWebView2PermissionKind.Geolocation:
                case CoreWebView2PermissionKind.Camera:
                case CoreWebView2PermissionKind.Microphone:
                default:
                    e.State = CoreWebView2PermissionState.Deny;
                    break;
            }
        }


        // =====================================================================
        // MÓDULO 3 — SMTC (SYSTEM MEDIA TRANSPORT CONTROLS)
        // =====================================================================
        // Integra a barra de mídia nativa do Windows com o player do WebView2.
        // Suporta: teclas de mídia do teclado, headsets Bluetooth, Xbox Controller
        // overlay de mídia na Central de Ações e bloqueio de tela do Windows.
        // =====================================================================

        private SystemMediaTransportControls? _smtc;
        private string _smtcCurrentThumb = "";

        /// <summary>
        /// Inicializa o SMTC para a janela principal do Doorpi.
        /// CHAMAR: Dentro do handler SourceInitialized, após _mainWindowHandle ser definido.
        /// </summary>
        private void InitializeSmtc()
        {
            if (_mainWindowHandle == IntPtr.Zero)
            {
                Debug.WriteLine("[SMTC] Handle da janela ainda não disponível; inicialização adiada.");
                return;
            }
            try
            {
                // GetForWindow requer Windows 10 build 19041+ e TargetFramework windows10.x
                _smtc = SystemMediaTransportControlsInterop.GetForWindow(_mainWindowHandle);

                _smtc.IsEnabled = true;
                _smtc.IsPlayEnabled = true;
                _smtc.IsPauseEnabled = true;
                _smtc.IsStopEnabled = false;
                _smtc.IsNextEnabled = false;
                _smtc.IsPreviousEnabled = false;

                _smtc.DisplayUpdater.Type = MediaPlaybackType.Video;
                _smtc.PlaybackStatus = MediaPlaybackStatus.Closed;

                _smtc.ButtonPressed += OnSmtcButtonPressed;

                Debug.WriteLine("[SMTC] Inicializado com sucesso.");
            }
            catch (Exception ex)
            {
                // SMTC falhar não é crítico; o app continua funcionando normalmente.
                Debug.WriteLine($"[SMTC] Falha (requer Windows 10 build 19041+): {ex.Message}");
            }
        }

        /// <summary>
        /// Responde a teclas de mídia, headsets, overlay do Xbox e Central de Ações.
        /// Envia play/pause de volta ao WebView2 ativo via JavaScript.
        /// </summary>
        private void OnSmtcButtonPressed(
            SystemMediaTransportControls sender,
            SystemMediaTransportControlsButtonPressedEventArgs args)
        {
            // Envia para o popup de login (se aberto) ou para o WebView de mídia principal.
            var target = _popupWebView ?? _ytWebView;
            if (target?.CoreWebView2 == null) return;

            string js = args.Button switch
            {
                SystemMediaTransportControlsButton.Play =>
                    "document.querySelectorAll('video').forEach(v => { try { v.play(); } catch(_) {} });",
                SystemMediaTransportControlsButton.Pause =>
                    "document.querySelectorAll('video').forEach(v => { try { v.pause(); } catch(_) {} });",
                _ => ""
            };

            if (!string.IsNullOrEmpty(js))
                Dispatcher.InvokeAsync(() =>
                {
                    try { target.CoreWebView2?.ExecuteScriptAsync(js); }
                    catch { /* WebView pode ter sido destruído */ }
                });
        }

        /// <summary>
        /// Atualiza a UI de mídia nativa do Windows (status, título, thumbnail).
        /// Thread-safe: usa Dispatcher.InvokeAsync internamente.
        /// </summary>
        private void UpdateSmtcStatus(
            MediaPlaybackStatus status,
            string title,
            string thumbUrl = "")
        {
            if (_smtc == null) return;

            Dispatcher.InvokeAsync(() =>
            {
                try
                {
                    _smtc.PlaybackStatus = status;

                    var upd = _smtc.DisplayUpdater;
                    upd.Type = MediaPlaybackType.Video;
                    upd.VideoProperties.Title = title;
                    upd.VideoProperties.Subtitle = "Doorpi";

                    // Atualiza thumbnail apenas se mudou, para evitar downloads redundantes.
                    if (!string.IsNullOrWhiteSpace(thumbUrl) && thumbUrl != _smtcCurrentThumb)
                    {
                        _smtcCurrentThumb = thumbUrl;
                        try
                        {
                            upd.Thumbnail = RandomAccessStreamReference.CreateFromUri(new Uri(thumbUrl));
                        }
                        catch
                        {
                            // Thumbnail é sempre opcional; falha não deve bloquear o status.
                        }
                    }

                    // Limpa thumbnail ao parar/fechar
                    if (status == MediaPlaybackStatus.Closed || status == MediaPlaybackStatus.Stopped)
                    {
                        upd.ClearAll();
                        _smtcCurrentThumb = "";
                    }

                    upd.Update();
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[SMTC] Erro ao atualizar display: {ex.Message}");
                }
            });
        }

        /// <summary>
        /// Script injetado em todos os apps de mídia (exceto YouTube e utilitários).
        /// Detecta tags &lt;video&gt; via MutationObserver — suporta SPAs e Shadow DOM
        /// (Netflix, Prime Video, Disney+, Max usam shadow DOM extensivamente).
        /// Envia mensagens postMessage para o handler C# YtOnWebMessageReceived.
        /// Formato da mensagem: "smtc:EVENTO:TÍTULO_URLENCODE:THUMB_URLENCODE"
        /// </summary>
        internal static async Task YtInjectSmtcBridgeAsync(CoreWebView2 cw)
        {
            const string script = @"
(function() {
    if (window.__doorpiSmtcInjected) return;
    window.__doorpiSmtcInjected = true;

    // ── Helpers de extração de metadados ─────────────────────────────────────
    function getPageTitle() {
        return (document.title || '').trim()
            || document.querySelector('h1')?.textContent?.trim()
            || 'Doorpi Media';
    }

    function getThumbnail(video) {
        if (video.poster) return video.poster;
        return document.querySelector('meta[property=""og:image""]')?.content
            || document.querySelector('meta[name=""twitter:image""]')?.content
            || '';
    }

    // ── Anexa listeners a um elemento de vídeo ainda não rastreado ──────────
    function attachSmtcToVideo(video) {
        if (video._doorpiSmtcAttached) return;
        video._doorpiSmtcAttached = true;

        const post = (event) => {
            try {
                const title = getPageTitle();
                const thumb = getThumbnail(video);
                window.chrome.webview.postMessage(
                    'smtc:' + event + ':' +
                    encodeURIComponent(title) + ':' +
                    encodeURIComponent(thumb)
                );
            } catch(_) { /* postMessage pode falhar em navegação */ }
        };

        video.addEventListener('play',    () => post('playing'), { passive: true });
        video.addEventListener('pause',   () => post('paused'),  { passive: true });
        video.addEventListener('ended',   () => post('stopped'), { passive: true });
        video.addEventListener('playing', () => post('playing'), { passive: true });
        // 'waiting' = buffering: reporta pause para SMTC não ficar preso em Playing
        video.addEventListener('waiting', () => post('paused'),  { passive: true });
    }

    // ── Varre DOM e Shadow DOMs por elementos de vídeo ───────────────────────
    function scanForVideos() {
        document.querySelectorAll('video').forEach(attachSmtcToVideo);
        // Netflix, Disney+, Prime usam Shadow DOM extensivamente
        document.querySelectorAll('*').forEach(host => {
            try {
                if (host.shadowRoot)
                    host.shadowRoot.querySelectorAll('video').forEach(attachSmtcToVideo);
            } catch(_) {}
        });
    }

    // ── MutationObserver para SPAs que inserem vídeo async ───────────────────
    const observer = new MutationObserver(() => {
        // Debounce para não sobrecarregar em mutações em cascata
        clearTimeout(window.__doorpiSmtcScanTimer);
        window.__doorpiSmtcScanTimer = setTimeout(scanForVideos, 150);
    });

    // Aguarda o body estar disponível antes de observar
    const waitBody = setInterval(() => {
        if (!document.body) return;
        clearInterval(waitBody);
        scanForVideos();
        observer.observe(document.body, { childList: true, subtree: true });
    }, 50);
})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }


        // =====================================================================
        // MÓDULO 4 — PROTOCOLO CUSTOMIZADO E APPUSERMODELID
        // =====================================================================
        // SetCurrentProcessExplicitAppUserModelID: garante que TODAS as janelas
        // do Doorpi (principal, WebApp, popup) sejam agrupadas como um único
        // item na barra de tarefas do Windows.
        //
        // Protocolo doorpi://: permite lançar o Doorpi de outros apps via URL,
        // ex: doorpi://launch?game=steam://run/12345
        // =====================================================================

        [DllImport("shell32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern int SetCurrentProcessExplicitAppUserModelID(string AppID);

        /// <summary>
        /// Define o AppUserModelId e registra o protocolo doorpi:// no Registro.
        /// CHAMAR: No construtor do MainWindow(), antes de InitializeAsync().
        /// </summary>
        private void RegisterProtocolAndAppId()
        {
            // ── 1. AppUserModelId ─────────────────────────────────────────────
            // Agrupa todas as janelas filhas (WebApp, popup, VKB) sob o mesmo
            // ícone na barra de tarefas. Sem isso, cada janela aparece separada.
            try
            {
                int hr = SetCurrentProcessExplicitAppUserModelID("Doorpi.MediaLauncher.1");
                if (hr == 0)
                    Debug.WriteLine("[AppId] AppUserModelId 'Doorpi.MediaLauncher.1' definido com sucesso.");
                else
                    Debug.WriteLine($"[AppId] Aviso — HRESULT: 0x{hr:X8}");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AppId] Falha ao definir AppUserModelId: {ex.Message}");
            }


            try
            {
                string exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName
                              ?? System.Reflection.Assembly.GetExecutingAssembly().Location;

                // Chave raiz do protocolo
                using var rootKey = Registry.CurrentUser.CreateSubKey(@"Software\Classes\doorpi");
                rootKey.SetValue("", "URL:Doorpi Protocol");
                rootKey.SetValue("URL Protocol", "");

                // Ícone exibido ao usuário em prompts do Windows
                using var iconKey = rootKey.CreateSubKey("DefaultIcon");
                iconKey.SetValue("", $"\"{exePath}\",0");

                // Comando de abertura: passa a URL completa como %1
                using var cmdKey = rootKey.CreateSubKey(@"shell\open\command");
                cmdKey.SetValue("", $"\"{exePath}\" \"%1\"");

                Debug.WriteLine("[Protocol] Protocolo doorpi:// registrado com sucesso em HKCU.");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Protocol] Falha ao registrar protocolo no Registro: {ex.Message}");
            }
        }
    }
}