using Microsoft.Web.WebView2.Core;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net.Http;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;

namespace Doorpi
{
    public partial class YouTubeWindow : Window
    {
        // ── uBlock: lista de domínios bloqueados via DNS ─────────────────────
        private static HashSet<string>? _blockedDomains;
        private static readonly object _blockLock = new();
        private static readonly string[] _blocklistUrls = {
            "https://easylist.to/easylist/easylist.txt",
            "https://easylist.to/easylist/easyprivacy.txt",
        };

        // ── SEGREDO 1: USER-AGENTS DO VACUUMTUBE ─────────────────────────────
        private const string YT_CLIENT_UA =
            "Mozilla/5.0 (PS4; Leanback Shell) Cobalt/19.lts.0-qa; compatible; VacuumTube/1.6.1";

        private const string YT_API_UA =
            "Mozilla/5.0 (PS4; Leanback Shell) Cobalt/26.lts.0-qa; compatible; VacuumTube/1.6.1";

        private const string YT_TV_URL = "https://www.youtube.com/tv";
        private static readonly HttpClient _http = new();

        public YouTubeWindow()
        {
            InitializeComponent();
            Loaded += OnLoaded;
            KeyDown += OnKeyDown;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            await ytWebView.EnsureCoreWebView2Async(null);

            ytWebView.CoreWebView2.Settings.UserAgent = YT_CLIENT_UA;
            ytWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            ytWebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            ytWebView.CoreWebView2.Settings.IsZoomControlEnabled = false;

            await EnsureBlocklistAsync();

            ytWebView.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            ytWebView.CoreWebView2.WebResourceRequested += OnWebResourceRequested;
            ytWebView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

            await InjectAdBlockerAsync();
            await InjectGamepadSupportAsync();
            await InjectZoomHackAsync();

            ytWebView.ZoomFactor = 0.3;
            ytWebView.CoreWebView2.Navigate(YT_TV_URL);
            ytWebView.Focus();
        }

        // ── ADBLOCK: INTERCEPTA JSON DO FETCH E DO XHR ────────────────────────
        private async Task InjectAdBlockerAsync()
        {
            string adblockScript = @"
                (function() {
                    function cleanJson(json, reqUrl) {
                        let modified = false;

                        if (json.adPlacements) { delete json.adPlacements; modified = true; }
                        if (json.adSlots) { delete json.adSlots; modified = true; }
                        if (json.playerAds) { delete json.playerAds; modified = true; }

                        if (json.entries && Array.isArray(json.entries)) {
                            let orig = json.entries.length;
                            json.entries = json.entries.filter(e => !(e?.command?.reelWatchEndpoint?.adClientParams?.isAd));
                            if (json.entries.length !== orig) modified = true;
                        }

                        if (reqUrl.includes('browse') && json.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer) {
                            let homeFeed = json.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer;
                            if (homeFeed.contents) {
                                let orig = homeFeed.contents.length;
                                homeFeed.contents = homeFeed.contents.filter(r => !r.adSlotRenderer && !r.promoShelfRenderer);
                                if (homeFeed.contents.length !== orig) modified = true;
                                
                                for (let feed of homeFeed.contents) {
                                    let horizontal = feed?.shelfRenderer?.content?.horizontalListRenderer;
                                    if (horizontal && horizontal.items) {
                                        let hOrig = horizontal.items.length;
                                        horizontal.items = horizontal.items.filter(i => !i.adSlotRenderer);
                                        if (horizontal.items.length !== hOrig) modified = true;
                                    }
                                }
                            }
                        }

                        if (reqUrl.includes('search') && json.contents?.sectionListRenderer) {
                            let searchFeed = json.contents.sectionListRenderer;
                            if (searchFeed.contents) {
                                for (let feed of searchFeed.contents) {
                                    let horizontal = feed?.shelfRenderer?.content?.horizontalListRenderer;
                                    if (horizontal && horizontal.items) {
                                        let hOrig = horizontal.items.length;
                                        horizontal.items = horizontal.items.filter(i => !i.adSlotRenderer);
                                        if (horizontal.items.length !== hOrig) modified = true;
                                    }
                                }
                            }
                        }

                        return modified ? json : null;
                    }

                    // 1. Intercepta FETCH
                    const origFetch = window.fetch;
                    if (origFetch) {
                        window.fetch = async function(...args) {
                            const reqUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
                            const response = await origFetch.apply(this, args);
                            if (reqUrl.includes('/youtubei/v1/')) {
                                try {
                                    const clone = response.clone();
                                    const text = await clone.text();
                                    let json = JSON.parse(text);
                                    let cleanedJson = cleanJson(json, reqUrl);

                                    if (cleanedJson) {
                                        return new Response(JSON.stringify(cleanedJson), {
                                            status: response.status,
                                            statusText: response.statusText,
                                            headers: response.headers
                                        });
                                    }
                                } catch (e) { }
                            }
                            return response;
                        };
                    }

                    // 2. Intercepta XHR (Usado para dados da TV)
                    const origOpen = XMLHttpRequest.prototype.open;
                    const origSend = XMLHttpRequest.prototype.send;
                    
                    XMLHttpRequest.prototype.open = function() {
                        this._url = arguments[1] || '';
                        return origOpen.apply(this, arguments);
                    };
                    
                    XMLHttpRequest.prototype.send = function() {
                        this.addEventListener('readystatechange', function() {
                            if (this.readyState === 4 && this._url.includes('/youtubei/v1/')) {
                                if (this._intercepted) return;
                                try {
                                    let json = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
                                    let cleanedJson = cleanJson(json, this._url);

                                    if (cleanedJson) {
                                        if (this.responseType === 'json') {
                                            Object.defineProperty(this, 'response', { get: () => cleanedJson });
                                        } else {
                                            const newText = JSON.stringify(cleanedJson);
                                            Object.defineProperty(this, 'responseText', { get: () => newText });
                                            Object.defineProperty(this, 'response', { get: () => newText });
                                        }
                                        this._intercepted = true;
                                    }
                                } catch(e) {}
                            }
                        }, false);
                        return origSend.apply(this, arguments);
                    };
                })();
            ";
            await ytWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(adblockScript);
        }

        private async Task InjectZoomHackAsync()
        {
            string zoomHackScript = @"
                const checkExist = setInterval(function() {
                   if (document.querySelector('.html5-main-video')) {
                      window.chrome.webview.postMessage('player_loaded');
                      clearInterval(checkExist);
                   }
                }, 500);
            ";
            await ytWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(zoomHackScript);
        }

        private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            var msg = e.TryGetWebMessageAsString();
            if (msg == "player_loaded") ytWebView.ZoomFactor = 1.0;
            else if (msg == "close_app") CloseYouTube();
        }

        // ── SEGREDO 3: AVANÇO RÁPIDO (HOLD) + BLOQUEIO DE TELA DE CONTAS ─────────
        private async Task InjectGamepadSupportAsync()
        {
            string gamepadScript = @"
                let buttonStates = {};
                let buttonHoldTimes = {};
                let buttonRepeatCount = {};
                window.isExitModalOpen = false;

                function showCustomExit() {
                    if (document.getElementById('doorpi-exit-modal')) return;
                    let modal = document.createElement('div');
                    modal.id = 'doorpi-exit-modal';
                    modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.9);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:""Roboto"",sans-serif;opacity:0;transition:opacity 0.2s;';
                    modal.innerHTML = `
                        <h1 style=""font-size:3vw;font-weight:400;margin-bottom:2.5vw;"">Sair do YouTube?</h1>
                        <div style=""display:flex;gap:1.5vw;"">
                            <div style=""background:#cc0000;padding:1vw 3vw;border-radius:3px;font-size:1.5vw;font-weight:500;box-shadow:0 4px 6px rgba(0,0,0,0.3);"">Sim (A)</div>
                            <div style=""background:#333;padding:1vw 3vw;border-radius:3px;font-size:1.5vw;font-weight:500;"">Não (B)</div>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    setTimeout(() => modal.style.opacity = '1', 10);
                    window.isExitModalOpen = true;
                }
                
                function closeCustomExit() {
                    let modal = document.getElementById('doorpi-exit-modal');
                    if (modal) {
                        modal.style.opacity = '0';
                        setTimeout(() => modal.remove(), 200);
                    }
                    window.isExitModalOpen = false;
                }

                // VIGIA INVISÍVEL E INTERNACIONAL: Detecta a tag real da tela de contas do YouTube TV
                setInterval(() => {
                    if (window.isExitModalOpen) return;
                    
                    // Tag universal da tela de Seleção de Perfil no Leanback
                    let accountSelector = document.querySelector('yt-lr-account-selector-renderer, .yt-lr-account-selector');
                    if (accountSelector && accountSelector.offsetWidth > 0) {
                        
                        // Joga um Esc Falso na interface para fechar a tela de perfil imediatamente
                        let evDown = new Event('keydown', { bubbles: true }); evDown.keyCode = 27; document.dispatchEvent(evDown);
                        let evUp = new Event('keyup', { bubbles: true }); evUp.keyCode = 27; document.dispatchEvent(evUp);
                        
                        // Abre o nosso modal bonitão
                        showCustomExit();
                    }
                }, 100);

                // NOVA FUNÇÃO QUE IMITA UM TECLADO REAL (PRESSIONAR E SEGURAR)
                function processButton(btnIndex, isPressed, keyCode, keyName) {
                    if (isPressed) {
                        if (!buttonStates[btnIndex]) {
                            // Toque inicial
                            let evDown = new Event('keydown', { bubbles: true, cancelable: true });
                            evDown.keyCode = keyCode; evDown.which = keyCode; evDown.key = keyName; evDown.repeat = false;
                            document.dispatchEvent(evDown);
                            
                            buttonStates[btnIndex] = true;
                            buttonHoldTimes[btnIndex] = Date.now();
                            buttonRepeatCount[btnIndex] = 0;
                        } else {
                            // Se segurou por mais de 400ms, manda vários eventos de 'keydown' (Fast-Forward!)
                            let heldFor = Date.now() - buttonHoldTimes[btnIndex];
                            if (heldFor > 400) {
                                let expectedRepeats = Math.floor((heldFor - 400) / 50); // Metralha a cada 50ms
                                if (expectedRepeats > buttonRepeatCount[btnIndex]) {
                                    let evDown = new Event('keydown', { bubbles: true, cancelable: true });
                                    evDown.keyCode = keyCode; evDown.which = keyCode; evDown.key = keyName; evDown.repeat = true;
                                    document.dispatchEvent(evDown);
                                    buttonRepeatCount[btnIndex] = expectedRepeats;
                                }
                            }
                        }
                    } else {
                        if (buttonStates[btnIndex]) {
                            // Quando solta, manda o 'keyup' pro player confirmar que você parou de avançar o vídeo
                            let evUp = new Event('keyup', { bubbles: true, cancelable: true });
                            evUp.keyCode = keyCode; evUp.which = keyCode; evUp.key = keyName;
                            document.dispatchEvent(evUp);
                            buttonStates[btnIndex] = false;
                        }
                    }
                }

                function pollGamepad() {
                    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
                    const gp = gamepads[0];
                    
                    if (gp && document.hasFocus()) {
                        
                        // Trava input se nosso modal estiver na tela
                        if (window.isExitModalOpen) {
                            let isA = gp.buttons[0] && gp.buttons[0].pressed;
                            let isB = gp.buttons[1] && gp.buttons[1].pressed;
                            
                            if (isA && !buttonStates[0]) window.chrome.webview.postMessage('close_app');
                            else if (isB && !buttonStates[1]) closeCustomExit();
                            
                            buttonStates[0] = isA; buttonStates[1] = isB;
                            requestAnimationFrame(pollGamepad);
                            return;
                        }

                        const map = {
                            0:  { code: 13, key: 'Enter' },      // A
                            1:  { code: 27, key: 'Escape' },     // B
                            2:  { code: 170, key: '*' },         // X
                            4:  { code: 115, key: 'F4' },        // LB
                            5:  { code: 116, key: 'F5' },        // RB
                            6:  { code: 113, key: 'F2' },        // LT
                            7:  { code: 114, key: 'F3' },        // RT
                            12: { code: 38, key: 'ArrowUp' },    // D-Pad Up
                            13: { code: 40, key: 'ArrowDown' },  // D-Pad Down
                            14: { code: 37, key: 'ArrowLeft' },  // D-Pad Left
                            15: { code: 39, key: 'ArrowRight' }  // D-Pad Right
                        };

                        for (const [btnIndex, keyData] of Object.entries(map)) {
                            let isPressed = gp.buttons[btnIndex] && gp.buttons[btnIndex].pressed;
                            processButton(btnIndex, isPressed, keyData.code, keyData.key);
                        }

                        // Analógicos convertidos em direcionais (índices falsos 100 a 103 pra rastrear no processButton)
                        processButton(100, gp.axes[1] < -0.5, 38, 'ArrowUp');
                        processButton(101, gp.axes[1] > 0.5, 40, 'ArrowDown');
                        processButton(102, gp.axes[0] < -0.5, 37, 'ArrowLeft');
                        processButton(103, gp.axes[0] > 0.5, 39, 'ArrowRight');
                    }
                    requestAnimationFrame(pollGamepad);
                }
                pollGamepad();
            ";
            await ytWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(gamepadScript);
        }

        private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
        {
            try
            {
                var uri = new Uri(e.Request.Uri);
                var host = uri.Host.ToLowerInvariant();

                if (host.Contains("youtube.com")) e.Request.Headers.SetHeader("User-Agent", YT_API_UA);
                else e.Request.Headers.SetHeader("User-Agent", "VacuumTube/1.6.1");

                if (host == "csp.withgoogle.com")
                {
                    BlockRequest(e);
                    return;
                }

                if (_blockedDomains != null)
                {
                    bool blocked = false;
                    var parts = host.Split('.');
                    for (int i = 0; i < parts.Length - 1; i++)
                    {
                        var candidate = string.Join('.', parts[i..]);
                        if (_blockedDomains.Contains(candidate)) { blocked = true; break; }
                    }
                    if (blocked) BlockRequest(e);
                }
            }
            catch { }
        }

        private void BlockRequest(CoreWebView2WebResourceRequestedEventArgs e)
        {
            e.Response = ytWebView.CoreWebView2.Environment.CreateWebResourceResponse(null, 204, "No Content", "");
        }

        private static async Task EnsureBlocklistAsync()
        {
            lock (_blockLock)
            {
                if (_blockedDomains != null) return;
                _blockedDomains = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            }

            var domains = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var url in _blocklistUrls)
            {
                try
                {
                    var text = await _http.GetStringAsync(url);
                    foreach (var line in text.Split('\n'))
                    {
                        var t = line.Trim();
                        if (t.StartsWith("||") && t.EndsWith("^"))
                        {
                            var domain = t[2..^1];
                            if (!domain.Contains('/') && domain.Length > 0)
                                domains.Add(domain);
                        }
                    }
                }
                catch { }
            }
            lock (_blockLock) { _blockedDomains = domains; }
        }

        private void OnKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Escape || e.Key == Key.BrowserBack)
            {
                e.Handled = true;
                CloseYouTube();
            }
        }

        public void CloseYouTube()
        {
            try
            {
                ytWebView.CoreWebView2?.ExecuteScriptAsync("document.querySelectorAll('video').forEach(v => v.pause());");
            }
            catch { }

            Hide();
            Application.Current.MainWindow?.Activate();
            Application.Current.MainWindow?.Focus();
        }

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            e.Cancel = true;
            CloseYouTube();
        }
    }
}