using Microsoft.Web.WebView2.Core;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;

namespace Doorpi
{
    public partial class YouTubeWindow : Window
    {
        private static HashSet<string>? _blockedDomains;
        private static readonly object _blockLock = new();
        private static readonly string[] _blocklistUrls = {
            "https://easylist.to/easylist/easylist.txt",
            "https://easylist.to/easylist/easyprivacy.txt",
        };

        private const string YT_API_UA =
            "Mozilla/5.0 (PS4; Leanback Shell) Cobalt/26.lts.0-qa; compatible; Doorpi/1.6.1";

        private const string YT_TV_URL = "https://www.youtube.com/tv";
        private static readonly HttpClient _http = new();
        private bool _profileHackDone = false;
        private bool _profileClearDone = false;

        // Caminho do perfil dedicado do YouTube TV
        private static readonly string _ytProfilePath = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory, "Data", "browser-profiles", "youtube-tv");

        public YouTubeWindow()
        {
            InitializeComponent();
            Loaded += OnLoaded;
            KeyDown += OnKeyDown;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            // Perfil dedicado — necessário para poder deletar a pasta depois
            var options = new CoreWebView2EnvironmentOptions();
            var env = await CoreWebView2Environment.CreateAsync(null, _ytProfilePath, options);
            await ytWebView.EnsureCoreWebView2Async(env);

            this.WindowState = WindowState.Maximized;

            ytWebView.CoreWebView2.Settings.UserAgent = YT_API_UA;
            ytWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            ytWebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            ytWebView.CoreWebView2.Settings.IsZoomControlEnabled = false;

            await EnsureBlocklistAsync();

            ytWebView.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            ytWebView.CoreWebView2.WebResourceRequested += OnWebResourceRequested;
            ytWebView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

            await InjectAdBlockerAndOverridesAsync();
            await InjectGamepadSupportAsync();
            await InjectZoomHackAsync();
            await InjectForceUserSelectionAsync();
            await InjectUltrawideFixAsync();
            await InjectDebugAsync();
            await InjectPlayerBackgroundAsync();
            await InjectAccountWatcherAsync();

            ytWebView.ZoomFactor = 0.3;
            ytWebView.CoreWebView2.Navigate(YT_TV_URL);
            ytWebView.Focus();
        }

        // ── ACCOUNT WATCHER ───────────────────────────────────────────────────
        // Avisa o C# quando o ytcfg estiver pronto para verificar os cookies
        private async Task InjectAccountWatcherAsync()
        {
            string script = @"
(function() {
    if (window.__doorpiAccountWatcher) return;
    window.__doorpiAccountWatcher = true;

    const t = setInterval(() => {
        try {
            if (window.ytcfg?.get?.('LOGGED_IN') !== undefined) {
                clearInterval(t);
                window.chrome.webview.postMessage('check_accounts');
            }
        } catch(e) {}
    }, 500);

    setTimeout(() => clearInterval(t), 15000);
})();";
            await ytWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        // ── VERIFICA COOKIES E LIMPA PERFIL SE NÃO HÁ CONTAS ─────────────────
        private async Task CheckAndClearProfileIfNeededAsync()
        {
            if (_profileClearDone) return;

            try
            {
                var cookieManager = ytWebView?.CoreWebView2?.CookieManager;
                if (cookieManager == null) return;

                var cookies = await cookieManager.GetCookiesAsync("https://youtube.com");
                bool hasAuthCookie = false;

                foreach (var cookie in cookies)
                {
                    // Esses cookies só existem quando há pelo menos uma conta autenticada.
                    // Se existir qualquer um → usuário tem contas e pode estar em modo
                    // convidado intencionalmente (visita) → não limpa nada.
                    if (cookie.Name is "SID" or "HSID" or "SSID" or "SAPISID" or "__Secure-3PSID")
                    {
                        hasAuthCookie = true;
                        break;
                    }
                }

                if (hasAuthCookie)
                {
                    Debug.WriteLine("[Doorpi] Contas cadastradas encontradas — convidado intencional, não limpa.");
                    return;
                }

                // Nenhuma conta cadastrada — perfil bugado, limpa tudo
                Debug.WriteLine("[Doorpi] Nenhuma conta cadastrada — limpando perfil do YouTube TV.");
                _profileClearDone = true;

                // Fecha a janela atual para liberar o lock na pasta do perfil
                _profileHackDone = false;
                this.Close();

                // Aguarda o processo liberar os arquivos
                await Task.Delay(800);

                try
                {
                    if (Directory.Exists(_ytProfilePath))
                        Directory.Delete(_ytProfilePath, recursive: true);

                    Debug.WriteLine("[Doorpi] Pasta do perfil deletada com sucesso.");
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[Doorpi] Erro ao deletar perfil: {ex.Message}");
                }

                // Reabre o YouTube TV com perfil limpo
                if (Application.Current.MainWindow is MainWindow mw)
                {
                    mw.Dispatcher.Invoke(() =>
                    {
                        var newWindow = new YouTubeWindow();
                        newWindow.Show();
                    });
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Doorpi] Erro ao verificar cookies: {ex.Message}");
                // Em caso de erro não faz nada — melhor não agir do que agir errado
            }
        }

        // ── MENSAGENS DO WEBVIEW ──────────────────────────────────────────────
        private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            var msg = e.TryGetWebMessageAsString();
            if (msg == "player_loaded") ytWebView.ZoomFactor = 1.0;
            else if (msg == "close_app") CloseYouTube();
            else if (msg == "doorpi_profile_hacked_done") _profileHackDone = true;
            else if (msg == "check_accounts") _ = CheckAndClearProfileIfNeededAsync();
        }

        // ── PLAYER BACKGROUND ─────────────────────────────────────────────────
        private async Task InjectPlayerBackgroundAsync()
        {
            string script = @"
(function() {
    if (window.__doorpiPlayerBg) return;
    window.__doorpiPlayerBg = true;

    const BLUR_PX  = 24;
    const OPACITY  = 0.55;
    const BG_ID    = 'doorpi-player-bg';
    const STYLE_ID = 'doorpi-player-style';

    let _canvas = null;
    let _ctx    = null;
    let _rafId  = null;
    let _src    = null;

    function injectCSS() {
        if (document.getElementById(STYLE_ID)) return;
        const sn    = document.querySelector('style[nonce]');
        const nonce = sn?.nonce || sn?.getAttribute('nonce') || '';
        const el    = document.createElement('style');
        el.id       = STYLE_ID;
        if (nonce) el.nonce = nonce;
        el.textContent =
            'ytlr-player::before,ytlr-player::after' +
            '{display:none!important;background:transparent!important;}' +
            'ytlr-player{background:transparent!important;' +
            'position:relative!important;z-index:0!important;}';
        (document.head || document.documentElement).appendChild(el);
    }

    function ensureBg() {
        if (document.getElementById(BG_ID)) return;

        const bg = document.createElement('div');
        bg.id = BG_ID;
        bg.style.cssText =
            'position:fixed!important;inset:0!important;'
          + 'z-index:-1!important;'
          + 'pointer-events:none!important;overflow:hidden!important;';

        _canvas = document.createElement('canvas');
        _canvas.width  = window.innerWidth  || 2560;
        _canvas.height = window.innerHeight || 1080;
        _canvas.style.cssText =
            'position:absolute!important;inset:0!important;'
          + 'width:100%!important;height:100%!important;'
          + 'filter:blur(' + BLUR_PX + 'px)!important;'
          + 'opacity:' + OPACITY + '!important;'
          + 'transform:scale(1.08)!important;';

        _ctx = _canvas.getContext('2d');
        _ctx.fillStyle = '#0f0f0f';
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

        bg.appendChild(_canvas);
        document.body.appendChild(bg);

        window.addEventListener('resize', () => {
            if (!_canvas) return;
            _canvas.width  = window.innerWidth;
            _canvas.height = window.innerHeight;
            if (!_src) {
                _ctx.fillStyle = '#0f0f0f';
                _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
            }
        }, { passive: true });
    }

    function drawLoop() {
        _rafId = requestAnimationFrame(drawLoop);
        if (!_src || !_ctx || !_canvas) return;
        if (_src.readyState < 2) return;
        try { _ctx.drawImage(_src, 0, 0, _canvas.width, _canvas.height); }
        catch(e) {}
    }

    let _currentVideo = null;

    function findVideo() {
        let v = document.querySelector('video.html5-main-video');
        if (v) return v;
        for (const host of document.querySelectorAll('*')) {
            if (!host.shadowRoot) continue;
            v = host.shadowRoot.querySelector('video.html5-main-video');
            if (v) return v;
        }
        return null;
    }

    const domObserver = new MutationObserver(() => {
        const found = findVideo();
        if (found && found !== _currentVideo) {
            _currentVideo = found;
            const tryStart = () => { _src = found; };
            if (found.readyState >= 2) {
                tryStart();
            } else {
                found.addEventListener('loadeddata', tryStart, { once: true, passive: true });
                found.addEventListener('playing',    tryStart, { once: true, passive: true });
            }
        } else if (!found && _currentVideo) {
            _currentVideo = null;
            _src = null;
        }
    });

    function start() {
        if (!document.body) { setTimeout(start, 50); return; }
        ensureBg();
        injectCSS();
        drawLoop();
        domObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    start();
})();";
            await ytWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        // ── DEBUG ─────────────────────────────────────────────────────────────
        private async Task InjectDebugAsync()
        {
            string script = @"
(function() {
    setTimeout(() => {
        const videos = document.querySelectorAll('video');
        console.log('[doorpi] videos encontrados:', videos.length);
        videos.forEach((v, i) => {
            console.log(`[doorpi] video[${i}]`,
                'class:', v.className,
                'readyState:', v.readyState,
                'src:', v.src?.slice(0,60),
                'currentSrc:', v.currentSrc?.slice(0,60),
                'captureStream:', typeof v.captureStream
            );
        });
        const player = document.querySelector('ytlr-player');
        console.log('[doorpi] ytlr-player direto:', player);
        let found = null;
        document.querySelectorAll('*').forEach(el => {
            if (!el.shadowRoot) return;
            const p = el.shadowRoot.querySelector('ytlr-player');
            if (p) { found = p; console.log('[doorpi] ytlr-player no shadow de:', el.tagName); }
        });
        console.log('[doorpi] hash:', window.location.hash);
    }, 3000);
})();";
            await ytWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        // ── ULTRAWIDE FIX ─────────────────────────────────────────────────────
        private async Task InjectUltrawideFixAsync()
        {
            string script = @"
(function() {
    if (window.__doorpiUltrawide) return;
    window.__doorpiUltrawide = true;

    const SELECTORS = [
        '#container',
        'ytlr-tv-surface-content-renderer',
        'yt-virtual-list',
        'ytlr-animated-overlay',
        'ytlr-rich-grid-renderer',
        'ytlr-two-column-browse-results-renderer',
        'ytlr-section-list-renderer',
        'ytlr-item-section-renderer',
        'ytlr-horizontal-list-renderer',
    ];

    function isAccountPage() {
        return !!(document.body?.classList?.contains('WEB_PAGE_TYPE_ACCOUNT_SELECTOR') ||
                  document.body?.classList?.contains('WEB_PAGE_TYPE_WELCOME')          ||
                  document.body?.classList?.contains('WEB_PAGE_TYPE_CHANNEL_CREATION'));
    }

    function applyFix(el) {
        if (!el) return;
        el.style.setProperty('width',     '100vw', 'important');
        el.style.setProperty('max-width', '100vw', 'important');
    }

    function applyAccountFix(el) {
        if (!el) return;
        el.style.setProperty('width',          '100vw', 'important');
        el.style.setProperty('max-width',       '100vw', 'important');
        el.style.setProperty('background-size', 'cover', 'important');
    }

    function applyLogoFix(el) {
        if (!el) return;
        el.style.setProperty('left', '86vw', 'important');
    }

    function fakeScrollToForceLoad() {
        document.querySelectorAll('ytlr-horizontal-list-renderer, yt-virtual-list').forEach(el => {
            try {
                el.scrollTop += 1;
                requestAnimationFrame(() => { el.scrollTop -= 1; });
            } catch(_) {}
        });
    }

    function forceVirtualListRecalc() {
        const targets = [
            ...document.querySelectorAll('yt-virtual-list'),
            ...document.querySelectorAll('ytlr-rich-grid-renderer'),
            ...document.querySelectorAll('ytlr-section-list-renderer'),
            ...document.querySelectorAll('ytlr-item-section-renderer'),
            ...document.querySelectorAll('ytlr-horizontal-list-renderer'),
        ];

        targets.forEach(el => {
            try {
                const orig = el.getBoundingClientRect.bind(el);
                el.getBoundingClientRect = function() {
                    const r = orig();
                    return { ...r, width: window.innerWidth, right: window.innerWidth, toJSON: r.toJSON };
                };
            } catch(_) {}
            try {
                const ro = new ResizeObserver(() => {});
                ro.observe(el); ro.unobserve(el); ro.disconnect();
            } catch(_) {}
            try { el.dispatchEvent(new Event('resize',   { bubbles: false })); } catch(_) {}
            try { el.dispatchEvent(new UIEvent('resize', { bubbles: false, view: window })); } catch(_) {}
            try { el.updateLayoutParameters?.(); } catch(_) {}
            try { el.computeLayout?.();           } catch(_) {}
            try { el.onResize?.();                } catch(_) {}
            try { el.requestUpdate?.();           } catch(_) {}
        });

        window.dispatchEvent(new UIEvent('resize', { view: window, bubbles: true }));
        setTimeout(fakeScrollToForceLoad, 50);
    }

    let _recalcScheduled = false;
    function scheduleRecalc() {
        if (_recalcScheduled) return;
        _recalcScheduled = true;
        setTimeout(() => {
            _recalcScheduled = false;
            forceVirtualListRecalc();
            setTimeout(forceVirtualListRecalc, 600);
        }, 200);
    }

    function tryFix() {
        document.querySelectorAll('ytlr-logo-entity').forEach(applyLogoFix);
        document.querySelectorAll('*').forEach(el => {
            if (!el.shadowRoot) return;
            el.shadowRoot.querySelectorAll('ytlr-logo-entity').forEach(applyLogoFix);
        });

        document.querySelectorAll('ytlr-account-selector').forEach(applyAccountFix);
        document.querySelectorAll('*').forEach(el => {
            if (!el.shadowRoot) return;
            el.shadowRoot.querySelectorAll('ytlr-account-selector').forEach(applyAccountFix);
        });

        if (isAccountPage()) return;

        let applied = false;
        SELECTORS.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => { applyFix(el); applied = true; });
        });
        document.querySelectorAll('*').forEach(el => {
            if (!el.shadowRoot) return;
            SELECTORS.forEach(sel => {
                el.shadowRoot.querySelectorAll(sel).forEach(el2 => { applyFix(el2); applied = true; });
            });
        });

        if (applied) scheduleRecalc();
    }

    const observer = new MutationObserver(tryFix);

    function start() {
        tryFix();
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.body) start();
    else {
        const wait = setInterval(() => {
            if (document.body) { clearInterval(wait); start(); }
        }, 16);
    }
})();";
            await ytWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        // ── MOTOR PRINCIPAL: YTCFG OVERRIDE + ADBLOCK ────────────────────────
        private async Task InjectAdBlockerAndOverridesAsync()
        {
            string script = @"
(function() {
    if (window.__doorpiInjected) return;
    window.__doorpiInjected = true;

    let originalYtcfgSet = null;
    let _ytcfg = window.ytcfg;
    Object.defineProperty(window, 'ytcfg', {
        get: function() { return _ytcfg; },
        set: function(newValue) {
            _ytcfg = newValue;
            if (_ytcfg && typeof _ytcfg.set === 'function') {
                if (!originalYtcfgSet) {
                    originalYtcfgSet = _ytcfg.set;
                    _ytcfg.set = function() {
                        let args = Array.prototype.slice.call(arguments);
                        let config = args[0];
                        if (typeof config === 'object' && config !== null) {
                            if (config.INNERTUBE_CONTEXT && config.INNERTUBE_CONTEXT.client) {
                                config.INNERTUBE_CONTEXT.client.platform = 'DESKTOP';
                                config.INNERTUBE_CONTEXT.client.clientFormFactor = 'UNKNOWN_FORM_FACTOR';
                                config.INNERTUBE_CONTEXT.client.osName = 'Windows';
                                config.INNERTUBE_CONTEXT.client.deviceMake = 'Doorpi';
                            }
                        }
                        return originalYtcfgSet.apply(this, args);
                    };
                }
            }
        },
        configurable: true
    });

    function overrideClientPayload(bodyStr) {
        try {
            let json = JSON.parse(bodyStr);
            if (json.context && json.context.client) {
                json.context.client.platform = 'DESKTOP';
                json.context.client.clientFormFactor = 'UNKNOWN_FORM_FACTOR';
                json.context.client.osName = 'Windows';
                json.context.client.deviceMake = 'Doorpi';
                return JSON.stringify(json);
            }
        } catch(e) {}
        return bodyStr;
    }

    function processJSON(obj) {
        if (!obj || typeof obj !== 'object') return false;
        let modified = false;
        if (Array.isArray(obj)) {
            for (let i = obj.length - 1; i >= 0; i--) {
                let item = obj[i];
                if (item && typeof item === 'object') {
                    if (item.tvMastheadAdRenderer || item.adSlotRenderer ||
                        item.promoShelfRenderer   || item.brandVideoSingletonRenderer ||
                        item.statementBannerRenderer) {
                        obj.splice(i, 1); modified = true;
                    } else { if (processJSON(item)) modified = true; }
                }
            }
        } else {
            const adKeys = ['adPlacements','adSlots','playerAds','adBreakHeartbeatParams'];
            for (let key of Object.keys(obj)) {
                if (adKeys.includes(key)) { delete obj[key]; modified = true; }
                else if (obj[key] && typeof obj[key] === 'object') {
                    if (processJSON(obj[key])) modified = true;
                }
            }
        }
        return modified;
    }

    const origParse = JSON.parse;
    JSON.parse = function() {
        let res = origParse.apply(this, arguments);
        try { if (res) processJSON(res); } catch(e) {}
        return res;
    };

    const origFetch = window.fetch;
    if (origFetch) {
        window.fetch = async function(...args) {
            let url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
            if (url.includes('/youtubei/v1/') && args[1] && typeof args[1].body === 'string')
                args[1].body = overrideClientPayload(args[1].body);
            const res = await origFetch.apply(this, args);
            if (url.includes('/youtubei/v1/')) {
                try {
                    const json = await res.clone().json();
                    if (processJSON(json))
                        return new Response(JSON.stringify(json), {
                            status: res.status, statusText: res.statusText, headers: res.headers
                        });
                } catch(e) {}
            }
            return res;
        };
    }

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function() {
        this._reqUrl = arguments[1] || '';
        return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
        if (this._reqUrl && this._reqUrl.includes('/youtubei/v1/') && typeof body === 'string')
            body = overrideClientPayload(body);
        this.addEventListener('readystatechange', function() {
            if (this.readyState === 4 && this._reqUrl.includes('/youtubei/v1/') && !this._doorpiCleaned) {
                try {
                    let isJson = this.responseType === 'json';
                    let data = isJson ? this.response : origParse(this.responseText);
                    if (processJSON(data)) {
                        let str = JSON.stringify(data);
                        Object.defineProperty(this, 'response',     { get: () => isJson ? data : str });
                        Object.defineProperty(this, 'responseText', { get: () => str });
                        this._doorpiCleaned = true;
                    }
                } catch(e) {}
            }
        });
        return origSend.call(this, body);
    };

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
            .then(regs => { for (let r of regs) r.unregister(); })
            .catch(() => {});
    }
})();";
            await ytWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        // ── ZOOM HACK ─────────────────────────────────────────────────────────
        private async Task InjectZoomHackAsync()
        {
            string script = @"
(function() {
    const check = setInterval(() => {
        if (document.querySelector('.html5-main-video')) {
            window.chrome.webview.postMessage('player_loaded');
            clearInterval(check);
        }
    }, 500);
})();";
            await ytWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        // ── FORÇAR SELEÇÃO DE USUÁRIO ─────────────────────────────────────────
        private async Task InjectForceUserSelectionAsync()
        {
            string script = @"
(function() {
    try {
        if (sessionStorage.getItem('doorpi_profile_hacked_once')) return;
        sessionStorage.setItem('doorpi_profile_hacked_once', '1');
    } catch(e) {}

    if (window.__doorpiProfileHacked) return;
    window.__doorpiProfileHacked = true;

    function showOverlay() {
        try {
            if (document.getElementById('doorpi-overlay-solid')) return;
            const ov = document.createElement('div');
            ov.id = 'doorpi-overlay-solid';
            ov.style.cssText = 'position:fixed;inset:0;background:#282828;z-index:2147483647;pointer-events:auto;opacity:1;transition:none';
            (document.documentElement || document.body).appendChild(ov);
        } catch(e) {}
    }

    function hideOverlay() {
        try {
            const ov = document.getElementById('doorpi-overlay-solid');
            if (ov) ov.remove();
        } catch(e) {}
    }

    function isAccountSelector() {
        try { return !!(document.body?.classList?.contains('WEB_PAGE_TYPE_ACCOUNT_SELECTOR')); }
        catch(e) { return false; }
    }
    function isWelcomePage() {
        try {
            return !!(document.body?.classList?.contains('WEB_PAGE_TYPE_WELCOME') ||
                      document.body?.classList?.contains('WEB_PAGE_TYPE_CHANNEL_CREATION'));
        } catch(e) { return false; }
    }
    function isDone() { return isAccountSelector() || isWelcomePage(); }

    function fireEscape() {
        try {
            document.dispatchEvent(new KeyboardEvent('keydown', { bubbles:true, cancelable:true, keyCode:27, which:27, key:'Escape' }));
            setTimeout(() => {
                document.dispatchEvent(new KeyboardEvent('keyup', { bubbles:true, cancelable:true, keyCode:27, which:27, key:'Escape' }));
            }, 10);
        } catch(e) {}
    }

    function finish() {
        hideOverlay();
        try { window.chrome.webview.postMessage('doorpi_profile_hacked_done'); } catch(e) {}
    }

    function startLoop() {
        if (isDone()) { finish(); return; }

        showOverlay();

        const safetyTimer = setTimeout(() => {
            clearInterval(poller);
            hideOverlay();
            try { window.chrome.webview.postMessage('doorpi_profile_hacked_done'); } catch(e) {}
        }, 60000);

        const poller = setInterval(() => {
            try {
                if (isWelcomePage()) {
                    clearInterval(poller);
                    clearTimeout(safetyTimer);
                    hideOverlay();
                    try { window.chrome.webview.postMessage('doorpi_profile_hacked_done'); } catch(e) {}
                    return;
                }
                if (isAccountSelector()) {
                    clearInterval(poller);
                    clearTimeout(safetyTimer);
                    finish();
                    return;
                }
                fireEscape();
                fireEscape();
            } catch(e) {}
        }, 80);
    }

    function waitForApp() {
        const selectors = 'ytlr-app, ytlr-watch, #watch, .ytlr-masthead-renderer, #thumbnail-items';

        if (document.querySelector(selectors)) { startLoop(); return; }

        const observer = new MutationObserver(() => {
            try {
                if (document.querySelector(selectors)) {
                    observer.disconnect();
                    startLoop();
                }
            } catch(e) {}
        });

        const waitBody = setInterval(() => {
            try {
                if (document.body) {
                    clearInterval(waitBody);
                    if (isDone()) { finish(); return; }
                    if (document.querySelector(selectors)) { startLoop(); return; }
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            } catch(e) {}
        }, 16);
    }

    try {
        window.addEventListener('beforeunload', hideOverlay);
        window.addEventListener('unload',       hideOverlay);
    } catch(e) {}

    waitForApp();
})();";
            await ytWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        // ── GAMEPAD ───────────────────────────────────────────────────────────
        private async Task InjectGamepadSupportAsync()
        {
            string script = @"
(function() {
    if (window.__doorpiGamepadInjected) return;
    window.__doorpiGamepadInjected = true;

    let buttonStates = {}, buttonHoldTimes = {}, buttonRepeatCount = {};

    function fireKey(code, key) {
        document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: code, which: code, key: key }));
        setTimeout(() => {
            document.dispatchEvent(new KeyboardEvent('keyup',   { bubbles: true, cancelable: true, keyCode: code, which: code, key: key }));
        }, 20);
    }

    let lastEscapeTime = 0;
    window.handleBackButton = function() {
        let hash = window.location.hash || '';
        if (hash.includes('/watch')) {
            fireKey(27, 'Escape');
        } else {
            let now = Date.now();
            if (now - lastEscapeTime < 1500) {
                window.chrome.webview.postMessage('close_app');
            } else {
                lastEscapeTime = now;
                fireKey(27, 'Escape');
                let existing = document.getElementById('doorpi-toast-exit');
                if (existing) existing.remove();
                let t = document.createElement('div');
                t.id = 'doorpi-toast-exit';
                t.innerText = 'Pressione B novamente para sair';
                t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);background:rgba(20,20,20,0.95);color:#fff;padding:12px 24px;border-radius:30px;z-index:999999;font-family:""Roboto"",sans-serif;font-size:16px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.5);transition:opacity 0.3s;';
                document.body.appendChild(t);
                setTimeout(() => { if(t){ t.style.opacity='0'; setTimeout(()=>t.remove(),300); } }, 1500);
            }
        }
    };

    function processButton(idx, pressed, code, key) {
        if (idx === 1) {
            if (pressed && !buttonStates[idx])  { window.handleBackButton(); buttonStates[idx] = true; }
            else if (!pressed)                    buttonStates[idx] = false;
            return;
        }
        if (pressed) {
            if (!buttonStates[idx]) {
                fireKey(code, key);
                buttonStates[idx] = true; buttonHoldTimes[idx] = Date.now(); buttonRepeatCount[idx] = 0;
            } else {
                let held = Date.now() - buttonHoldTimes[idx];
                if (held > 400) {
                    let expected = Math.floor((held - 400) / 80);
                    if (expected > buttonRepeatCount[idx]) { fireKey(code, key); buttonRepeatCount[idx] = expected; }
                }
            }
        } else { buttonStates[idx] = false; }
    }

    const map = {
        0:[13,'Enter'], 2:[170,'*'],
        4:[115,'F4'],   5:[116,'F5'], 6:[113,'F2'], 7:[114,'F3'],
        12:[38,'ArrowUp'], 13:[40,'ArrowDown'], 14:[37,'ArrowLeft'], 15:[39,'ArrowRight'],
    };

    function pollGamepad() {
        try {
            const gp = (navigator.getGamepads?.() ?? [])[0];
            if (gp && document.hasFocus()) {
                for (const [idx,[code,key]] of Object.entries(map))
                    processButton(Number(idx), !!gp.buttons[idx]?.pressed, code, key);
                const dpadUp = !!gp.buttons[12]?.pressed;
                const dpadDown = !!gp.buttons[13]?.pressed;
                const dpadLeft = !!gp.buttons[14]?.pressed;
                const dpadRight = !!gp.buttons[15]?.pressed;
                const axisX = gp.axes[0] || 0;
                const axisY = gp.axes[1] || 0;
                processButton(100, !dpadUp && !dpadDown && axisY < -0.5, 38, 'ArrowUp');
                processButton(101, !dpadUp && !dpadDown && axisY >  0.5, 40, 'ArrowDown');
                processButton(102, !dpadLeft && !dpadRight && axisX < -0.5, 37, 'ArrowLeft');
                processButton(103, !dpadLeft && !dpadRight && axisX >  0.5, 39, 'ArrowRight');
                processButton(1, !!gp.buttons[1]?.pressed, 27, 'Escape');
            }
        } catch(_) {}
        requestAnimationFrame(pollGamepad);
    }
    pollGamepad();
})();";
            await ytWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        // ── ADBLOCK ──────────────────────────────────────────────────────────
        private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
        {
            try
            {
                var uriString = e.Request.Uri;
                if (string.IsNullOrEmpty(uriString)) return;

                e.Request.Headers.SetHeader("User-Agent", YT_API_UA);

                var uri = new Uri(uriString);
                var host = uri.Host.ToLowerInvariant();
                var pathQuery = uri.PathAndQuery.ToLowerInvariant();

                if (host.Contains("googlevideo.com") && pathQuery.Contains("/videoplayback"))
                {
                    if (pathQuery.Contains("adformat=") || pathQuery.Contains("vmap=") ||
                        pathQuery.Contains("oad=") || pathQuery.Contains("adext=") ||
                        pathQuery.Contains("ad_type="))
                    { BlockRequest(e); return; }
                }

                if (host.Contains("googlesyndication.com") || host.Contains("doubleclick.net") ||
                    host.Contains("googleadservices.com") || host.Contains("csp.withgoogle.com") ||
                    pathQuery.Contains("/pagead/") || pathQuery.Contains("/ptracking") ||
                    pathQuery.Contains("/api/stats/ads") || pathQuery.Contains("/get_midroll_info"))
                { BlockRequest(e); return; }

                if (_blockedDomains is { Count: > 0 })
                {
                    var parts = host.Split('.');
                    for (int i = 0; i < parts.Length - 1; i++)
                        if (_blockedDomains.Contains(string.Join('.', parts[i..])))
                        { BlockRequest(e); return; }
                }
            }
            catch { }
        }

        private void BlockRequest(CoreWebView2WebResourceRequestedEventArgs e)
        {
            e.Response = ytWebView.CoreWebView2.Environment
                .CreateWebResourceResponse(null, 204, "No Content", "");
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
                        if (t.StartsWith("||"))
                        {
                            var endIdx = t.IndexOf('^');
                            if (endIdx > 2)
                            {
                                var d = t.Substring(2, endIdx - 2);
                                if (!d.Contains('/') && d.Length > 0) domains.Add(d);
                            }
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
                ytWebView.CoreWebView2?.ExecuteScriptAsync(
                    "if(window.handleBackButton) window.handleBackButton();");
            }
        }

        private bool _isClosing = false;

        public void CloseYouTube()
        {
            if (_isClosing) return;
            _isClosing = true;
            try
            {
                ytWebView.CoreWebView2?.ExecuteScriptAsync(
                "try{document.querySelectorAll('video').forEach(v=>v.pause());}catch(e){}");
            }
            catch { }
            _profileHackDone = false;
            _profileClearDone = false;
            this.Close();
        }

        protected override void OnClosed(EventArgs e)
        {
            base.OnClosed(e);
            try { if (ytWebView != null) ytWebView.Dispose(); } catch { }
            if (Application.Current.MainWindow is MainWindow mw)
                mw.ForceFocus();
        }
    }
}
