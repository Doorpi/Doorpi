// =============================================================================
// MainWindow.WebApps.cs — Apps de mídia integrados na janela principal
// =============================================================================

using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace Doorpi
{
    public partial class MainWindow : Window
    {
        // ── Win32: cursor real via gamepad ────────────────────────────────────
        [DllImport("user32.dll")] private static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);
        [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private bool _sgdbRedirected = false;

        // ── Campos ────────────────────────────────────────────────────────────
        private WebView2? _ytWebView;
        private bool _ytClosing = false;
        private bool _isCurrentSiteYouTube = false;
        private Window? _popupWindow;
        private WebView2? _popupWebView;

        private static HashSet<string>? _ytBlockedDomains;
        private static readonly object _ytBlockLock = new();
        private static readonly string[] _ytBlocklistUrls =
        {
            "https://easylist.to/easylist/easylist.txt",
            "https://easylist.to/easylist/easyprivacy.txt",
        };

        private const string YT_UA = "Mozilla/5.0 (PS4; Leanback Shell) Cobalt/26.lts.0-qa; compatible; Doorpi/1.6.1";
        private const string YT_TV_URL = "https://www.youtube.com/tv";
        private static readonly HttpClient _ytHttp = new();
        private Grid RootGrid => (Grid)this.Content;

        // ── Abrir app de mídia ────────────────────────────────────────────────
        private async void LaunchMediaApp(string url, string appType)
        {
            try
            {
                if (appType == "webview" || appType == "browser")
                {
                    bool isYouTube = url.Contains("youtube.com");
                    await OpenWebViewInlineAsync(url, isYouTube);
                }
                else
                {
                    OpenInBrowser(url);
                }
            }
            catch (Exception ex) { Debug.WriteLine($"[LaunchMediaApp] Erro: {ex.Message}"); }
        }
        private void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;
            var deferral = e.GetDeferral();

            Dispatcher.Invoke(async () =>
            {
                if (_popupWindow != null) { try { _popupWindow.Close(); } catch { } }

                _popupWindow = new Window
                {
                    Title = "Login",
                    Width = 600,
                    Height = 800,
                    WindowStartupLocation = WindowStartupLocation.CenterScreen,
                    Topmost = true
                };

                _popupWebView = new WebView2();
                _popupWindow.Content = _popupWebView;

                _popupWindow.Show();
                _popupWindow.Activate();

                var env = _ytWebView!.CoreWebView2.Environment;
                await _popupWebView.EnsureCoreWebView2Async(env);

             
                await _popupWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("window.name = 'doorpi_popup';");

                _popupWebView.CoreWebView2.Settings.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

                _popupWebView.CoreWebView2.DocumentTitleChanged += (s, args) => {
                    if (_popupWindow != null) _popupWindow.Title = _popupWebView.CoreWebView2.DocumentTitle;
                };

                _popupWebView.CoreWebView2.WebMessageReceived += YtOnWebMessageReceived;
                _popupWebView.CoreWebView2.WindowCloseRequested += (s, args) => _popupWindow?.Close();

                _popupWebView.CoreWebView2.NavigationCompleted += async (s, args) =>
                {
                    
                    _popupWebView.Focus();
                    _popupWebView.CoreWebView2.ExecuteScriptAsync("window.focus();");

                    try
                    {
                        string currentUrl = _popupWebView.CoreWebView2.Source;
                        var mainUri = new Uri(_ytWebView.CoreWebView2.Source);
                        var popupUri = new Uri(currentUrl);

                        if (popupUri.Host.Contains(mainUri.Host.Replace("www.", "")) && !currentUrl.Contains("google.com"))
                        {
                            await Task.Delay(2000);
                            if (_popupWindow != null)
                            {
                                _popupWindow.Close();
                                _ytWebView.CoreWebView2.Reload();
                            }
                        }
                    }
                    catch { }
                };

                await YtInjectGenericSiteAsync(_popupWebView.CoreWebView2);

              
                e.NewWindow = _popupWebView.CoreWebView2;
                deferral.Complete();

                
                await Task.Delay(200);
                _popupWebView.Focus();
            });
        }
        // ── Extensões Chrome ──────────────────────────────────────────────────
        private static async Task LoadExtensionsAsync(CoreWebView2 cw)
        {
            string extBase = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory, "Data", "extensions");

            if (!Directory.Exists(extBase)) return;

            foreach (var extFolder in Directory.GetDirectories(extBase))
            {
                try
                {
                    string manifestPath = Path.Combine(extFolder, "manifest.json");
                    string loadPath = extFolder;

                    if (!File.Exists(manifestPath))
                    {
                        var versionFolder = Directory.GetDirectories(extFolder)
                            .FirstOrDefault(d => File.Exists(Path.Combine(d, "manifest.json")));

                        if (versionFolder == null)
                        {
                            Debug.WriteLine($"[Extension] manifest.json não encontrado em: {extFolder}");
                            continue;
                        }

                        loadPath = versionFolder;
                    }

                    await cw.Profile.AddBrowserExtensionAsync(loadPath);
                    Debug.WriteLine($"[Extension] Carregada: {Path.GetFileName(extFolder)}");
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[Extension] Falha: {Path.GetFileName(extFolder)} — {ex.Message}");
                }
            }
        }

        // ── Script para sites genéricos ───────────────────────────────────────
        // Abordagem: o gamepad move o cursor REAL do Windows via postMessage → C# SetCursorPos.
        // Cliques são reais (mouse_event Win32). Sem cursor virtual no DOM, sem dispatchEvent.
        // Sites React (Twitch, Kick) recebem eventos de mouse genuínos → foco funciona corretamente.
        private async Task YtInjectGenericSiteAsync(CoreWebView2 cw)
        {
            string script = $@"
(function() {{
    if (window.__doorpiGenericInjected) return;
    window.__doorpiGenericInjected = true;

    // ── 1. RASTREADOR DE NAVEGAÇÃO (Redirecionamento SteamGridDB) ──

let _redirectDebounce = null;
function checkRedirect() {{
    const isRoot = location.href === 'https://www.steamgriddb.com/' || 
                   location.href === 'https://www.steamgriddb.com';
    if (!isRoot) return;
    location.href = 'https://www.steamgriddb.com/profile/preferences/api';
}}
checkRedirect();
window.addEventListener('popstate', checkRedirect);

    // ── 2. AUTO-COPY NO CLIQUE DUPLO (Para Chave API) ──
document.addEventListener('click', function(e) {{
    const el = e.target.closest('code') || (e.target.tagName === 'CODE' ? e.target : null);
    if (el) {{
        const apiText = el.innerText.trim();
        if (apiText.length > 10) {{
            // Seleciona o texto visualmente
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            window.chrome.webview.postMessage('copy_api_key:' + apiText);
            showConsoleToast('{_currentToastTitle}', '{_currentToastSub}');
            setTimeout(() => {{
                window.chrome.webview.postMessage('close_app');
            }}, 2200);
        }}
    }}
}});

    // ── 3. NOTIFICAÇÃO ESTILO CONSOLE (Toast) ──
    function showConsoleToast(title, sub) {{
        const styleId = 'doorpi-toast-style';
        if (!document.getElementById(styleId)) {{
            const s = document.createElement('style');
            s.id = styleId;
            s.textContent = `
                .console-toast {{
                    position: fixed; top: 40px; left: 50%;
                    transform: translateX(-50%) translateY(-20px);
                    background: rgba(7, 7, 26, 0.96);
                    backdrop-filter: blur(25px);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 14px; padding: 14px 28px;
                    display: flex; align-items: center; gap: 18px;
                    box-shadow: 0 15px 45px rgba(0,0,0,0.7);
                    z-index: 2147483647; opacity: 0;
                    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                    font-family: 'Outfit', sans-serif; min-width: 320px;
                }}
                .console-toast.visible {{ transform: translateX(-50%) translateY(0); opacity: 1; }}
                .toast-icon {{
                    width: 40px; height: 40px; background: #0078d4;
                    border-radius: 50%; display: flex; align-items: center;
                    justify-content: center; font-size: 20px; color: white;
                    box-shadow: 0 0 15px rgba(0, 120, 212, 0.4);
                }}
                .toast-content {{ display: flex; flex-direction: column; gap: 2px; }}
                .toast-title {{ color: white; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; }}
                .toast-sub {{ color: rgba(255,255,255,0.45); font-size: 13px; }}
            `;
            document.head.appendChild(s);
        }}
        const toast = document.createElement('div');
        toast.className = 'console-toast';
        toast.innerHTML = `<div class='toast-icon'>✓</div><div class='toast-content'><span class='toast-title'>${{title}}</span><span class='toast-sub'>${{sub}}</span></div>`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
    }}

    // ── 4. FECHAR COM ESC ──
    window.addEventListener('keydown', function(e) {{
        if (e.key === 'Escape') {{
            try {{ e.preventDefault(); e.stopImmediatePropagation(); }} catch(_) {{}}
            if (_vkbIsOpen) {{ _vkbClose(); return; }}
            try {{ window.chrome.webview.postMessage('close_app'); }} catch(_) {{}}
        }}
    }}, true);

    function isInput(el) {{
        if (!el) return false;
        if (el.tagName === 'INPUT') {{
            const t = (el.type || '').toLowerCase();
            return t === 'text' || t === 'search' || t === 'email' ||
                   t === 'password' || t === 'url' || t === 'tel' || t === '';
        }}
        return el.tagName === 'TEXTAREA' ||
               el.isContentEditable ||
               (el.tagName === 'DIV' && el.getAttribute('role') === 'textbox');
    }}

    function init() {{
        if (!document.body) {{ setTimeout(init, 16); return; }}
        injectVkbStyles();
        startGamepad();
        bindInputFocus();
        patchHistory();
    }}

    let _navDepth = 0;
    function patchHistory() {{
        const origPush = history.pushState.bind(history);
        history.pushState = function(...args) {{ origPush(...args); _navDepth++; }};
        window.addEventListener('popstate', () => {{ _navDepth = Math.max(0, _navDepth - 1); }});
    }}

    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let _speedMult = 1;
    const SPEED_BASE = 1;
    const SPEED_MAX = 3;
    let _sentX = -1, _sentY = -1;

    function moveCursor(dx, dy) {{
        cursorX = Math.max(0, Math.min(window.innerWidth - 1, cursorX + dx));
        cursorY = Math.max(0, Math.min(window.innerHeight - 1, cursorY + dy));
        const ix = Math.round(cursorX), iy = Math.round(cursorY);
        if (ix !== _sentX || iy !== _sentY) {{
            _sentX = ix; _sentY = iy;
            try {{ window.chrome.webview.postMessage('gp_move:' + ix + ':' + iy); }} catch(_) {{}}
        }}
    }}

    function doClick() {{ try {{ window.chrome.webview.postMessage('gp_click'); }} catch(_) {{}} }}

    function goBack() {{
        if (_navDepth > 0) window.history.back();
        else try {{ window.chrome.webview.postMessage('close_app'); }} catch(_) {{}}
    }}

    function injectVkbStyles() {{
        if (window.__doorpiVkbStylesInjected) return;
        window.__doorpiVkbStylesInjected = true;

        const cssText = [
            '.doorpi-vkb-overlay{{position:fixed;bottom:0;left:0;right:0;z-index:2147483647;',
            'padding:0 clamp(24px,4vw,80px) clamp(24px,3vh,48px);',
            'background:linear-gradient(to top, rgb(5 5 10 / 80%) 65%, rgb(5 5 10 / 80%) 85%, transparent 100%);',
            'transform:translateY(100%);transition:transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94);user-select:none;}}',
            '.doorpi-vkb-overlay.visible{{transform:translateY(0);}}',
            '.doorpi-vkb-preview-wrap{{display:flex;align-items:center;gap:12px;margin-bottom:clamp(12px,2vh,22px);padding:0 2px;}}',
            '.doorpi-vkb-preview-label{{font-size:clamp(10px,1.1vw,14px);font-weight:600;text-transform:uppercase;letter-spacing:0.09em;color:rgba(255,255,255,0.3);white-space:nowrap;flex-shrink:0;}}',
            '.doorpi-vkb-preview-text{{flex:1;font-size:clamp(16px,1.8vw,26px);font-weight:500;color:#fff;',
            'padding:clamp(7px,1vh,12px) clamp(12px,1.4vw,18px);background:rgba(255,255,255,0.06);',
            'border:1px solid rgba(255,255,255,0.12);border-radius:10px;min-height:clamp(38px,5vh,56px);',
            'display:flex;align-items:center;white-space:nowrap;overflow:hidden;}}',
            '.doorpi-vkb-cursor{{display:inline-block;width:2px;height:1.1em;background:rgba(255,255,255,0.9);',
            'margin-left:2px;vertical-align:middle;animation:doorpiVkbBlink 1s step-end infinite;}}',
            '@keyframes doorpiVkbBlink{{0%,100%{{opacity:1}}50%{{opacity:0}}}}',
            '.doorpi-vkb-grid{{display:grid;grid-template-columns:repeat(10,clamp(42px,3.8vw,95px));',
            'gap:clamp(4px,0.5vh,7px) clamp(4px,0.38vw,6px);width:fit-content;margin:0 auto;}}',
            '.doorpi-vkb-key{{width:clamp(42px,3.8vw,90px);height:clamp(42px,3.8vw,75px);padding:0;',
            'background:rgb(20 20 20);border:1px solid rgba(255,255,255,0.11);',
            'border-bottom:3px solid rgba(0,0,0,0.45);border-radius:clamp(7px,0.6vw,10px);',
            'color:rgba(255,255,255,0.88);font-size:clamp(13px,1.2vw,18px);font-weight:500;font-family:inherit;',
            'display:flex;align-items:center;justify-content:center;cursor:pointer;outline:none;',
            'min-width:0;box-sizing:border-box;',
            'transition:background 0.07s,transform 0.07s,border-color 0.07s,color 0.07s,box-shadow 0.07s;}}',
            '.doorpi-vkb-key:hover{{background:rgba(255,255,255,0.13);color:#fff;}}',
            '.doorpi-vkb-key.focused{{background:rgba(255,255,255,0.97);color:#080810;border-color:transparent;',
            'border-bottom-color:rgba(0,0,0,0.25);transform:scale(1.1) translateY(-3px);',
            'box-shadow:0 8px 24px rgba(0,0,0,0.55),0 0 0 2px rgba(255,255,255,0.35);z-index:1;position:relative;}}',
            '.doorpi-vkb-key:active{{transform:scale(0.96) translateY(0);box-shadow:none;}}',
            '.doorpi-vkb-key[data-key=space]{{grid-column:span 6;height:clamp(52px,4.8vw,70px);',
            'font-size:clamp(12px,1.2vw,16px);letter-spacing:0.08em;color:rgba(255,255,255,0.45);width:100%;}}',
            '.doorpi-vkb-key[data-key=space].focused{{color:rgba(0,0,0,0.65);}}',
            '.doorpi-vkb-key[data-key=cancel]{{grid-column:span 2;height:clamp(52px,4.8vw,70px);',
            'color:rgba(255,255,255,0.6);font-size:clamp(12px,1.2vw,16px);font-weight:500;width:100%;}}',
            '.doorpi-vkb-key[data-key=ok]{{grid-column:span 2;height:clamp(52px,4.8vw,70px);',
            'background:rgba(50,110,255,0.32);border-color:rgba(50,110,255,0.55);',
            'color:rgba(170,205,255,0.95);font-weight:650;font-size:clamp(12px,1.2vw,16px);width:100%;}}',
            '.doorpi-vkb-key[data-key=ok].focused{{background:rgb(50,110,255);color:#fff;border-color:transparent;',
            'box-shadow:0 8px 28px rgba(50,110,255,0.55),0 0 0 2px rgba(50,110,255,0.4);}}',
            '.doorpi-vkb-key[data-key=shift]{{font-size:clamp(15px,1.6vw,22px);}}',
            '.doorpi-vkb-key[data-key=shift].shifted{{background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.3);color:#fff;}}',
            '.doorpi-vkb-key[data-key=shift].shifted.focused{{background:rgba(255,255,255,0.97);color:#080810;}}',
            '.doorpi-vkb-hint{{display:flex;align-items:center;gap:4px;flex-shrink:0;',
            'font-size:clamp(11px,1vw,14px);color:rgba(255,255,255,0.35);letter-spacing:0.04em;white-space:nowrap;}}',
            '.doorpi-vkb-badge{{display:inline-flex;align-items:center;justify-content:center;',
            'padding:2px 6px;border-radius:5px;background:rgba(255,255,255,0.1);',
            'border:1px solid rgba(255,255,255,0.18);font-size:clamp(9px,0.85vw,12px);',
            'font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:0.05em;}}'
        ].join('');

        try {{
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(cssText);
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        }} catch (e) {{
            const s = document.createElement('style');
            s.id = 'doorpi-vkb-style';
            s.textContent = cssText;
            document.head.appendChild(s);
        }}
    }}

    const FLAT_KEYS = [
        '1','2','3','4','5','6','7','8','9','0',
        'q','w','e','r','t','y','u','i','o','p',
        'a','s','d','f','g','h','j','k','l','\u232b',
        'shift','z','x','c','v','b','n','m',',','.',
        '@','_','-','/','?','!','+','*','.com','.br',
        'space','cancel','ok',
    ];
    const KEY_ROWS = [
        ['1','2','3','4','5','6','7','8','9','0'],
        ['q','w','e','r','t','y','u','i','o','p'],
        ['a','s','d','f','g','h','j','k','l','\u232b'],
        ['shift','z','x','c','v','b','n','m',',','.'],
        ['@','_','-','/','?','!','+','*','.com','.br'],
        ['space','cancel','ok'],
    ];
    const LABELS = {{ '\u232b':'\u232b', shift:'\u21e7', space:'Espaço', cancel:'Cancelar', ok:'OK' }};

    let _vkbEl = null;
    let _vkbShifted = true;
    let _vkbInputEl = null;
    let _vkbCursorPos = 0;
    let _vkbFocusKey = 'q';
    let _vkbIsOpen = false;
    let _vkbClosing = false;

    function _vkbBuild() {{
        if (_vkbEl) return;
        _vkbEl = document.createElement('div');
        _vkbEl.className = 'doorpi-vkb-overlay';
        _vkbEl.style.display = 'none';

        const wrap = document.createElement('div');
        wrap.className = 'doorpi-vkb-preview-wrap';

        const label = document.createElement('span');
        label.className = 'doorpi-vkb-preview-label';
        label.textContent = 'Digitando';

        const preview = document.createElement('div');
        preview.className = 'doorpi-vkb-preview-text';
        preview.id = 'doorpi-vkb-preview';

        const hint = document.createElement('span');
        hint.className = 'doorpi-vkb-hint';

        const b1 = document.createElement('span'); b1.className = 'doorpi-vkb-badge'; b1.textContent = 'L1';
        const b2 = document.createElement('span'); b2.className = 'doorpi-vkb-badge'; b2.textContent = 'R1';
        hint.appendChild(b1);
        hint.appendChild(document.createTextNode(' ◄ ► '));
        hint.appendChild(b2);

        wrap.appendChild(label);
        wrap.appendChild(preview);
        wrap.appendChild(hint);

        const grid = document.createElement('div');
        grid.className = 'doorpi-vkb-grid';

        FLAT_KEYS.forEach(k => {{
            const btn = document.createElement('button');
            btn.className = 'doorpi-vkb-key';
            btn.dataset.key = k;
            btn.tabIndex = -1;
            btn.textContent = LABELS[k] || k;

            if(k.length > 1 && k !== 'shift' && k !== 'space' && k !== 'cancel' && k !== 'ok') {{
                btn.style.fontSize = 'clamp(11px, 1vw, 15px)';
            }}

            btn.addEventListener('pointerdown', e => {{ e.preventDefault(); _vkbPressKey(k); }});
            grid.appendChild(btn);
        }});

        _vkbEl.appendChild(wrap);
        _vkbEl.appendChild(grid);
        document.body.appendChild(_vkbEl);
    }}

    function _setNativeValue(element, value) {{
        const proto = element.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) {{ nativeSetter.call(element, value); }}
        else {{ element.value = value; }}
    }}

    function _vkbRenderPreview() {{
        const el = document.getElementById('doorpi-vkb-preview');
        if (!el || !_vkbInputEl) return;

        const isPassword = _vkbInputEl.type === 'password';
        const isEditable = _vkbInputEl.isContentEditable || _vkbInputEl.tagName === 'DIV';
        let txt = isEditable ? (_vkbInputEl.textContent || '') : (_vkbInputEl.value || '');

        if (isPassword) {{
            txt = '•'.repeat(txt.length);
        }}

        const pos = Math.min(_vkbCursorPos, txt.length);
        el.textContent = '';
        const cursor = document.createElement('span');
        cursor.className = 'doorpi-vkb-cursor';
        el.appendChild(document.createTextNode(txt.slice(0, pos).replace(/ /g, '\u00A0')));
        el.appendChild(cursor);
        el.appendChild(document.createTextNode(txt.slice(pos).replace(/ /g, '\u00A0')));
    }}

    function _vkbSetShift(on) {{
        _vkbShifted = on;
        const btn = _vkbEl ? _vkbEl.querySelector('[data-key=shift]') : null;
        if (btn) btn.classList.toggle('shifted', on);
        if (_vkbEl) _vkbEl.querySelectorAll('.doorpi-vkb-key').forEach(k => {{
            const key = k.dataset.key;
            if (key && key.length === 1 && key >= 'a' && key <= 'z') k.textContent = on ? key.toUpperCase() : key;
        }});
    }}

    function _vkbSetFocus(key) {{
        _vkbFocusKey = key;
        if (_vkbEl) _vkbEl.querySelectorAll('.doorpi-vkb-key').forEach(k =>
            k.classList.toggle('focused', k.dataset.key === key));
    }}

    function _vkbMoveFocus(dir) {{
        let rIdx = 0, cIdx = 0, found = false;
        for (let r = 0; r < KEY_ROWS.length && !found; r++) {{
            for (let c = 0; c < KEY_ROWS[r].length && !found; c++) {{
                if (KEY_ROWS[r][c] === _vkbFocusKey) {{ rIdx = r; cIdx = c; found = true; }}
            }}
        }}
        if (dir === 'up') rIdx = Math.max(0, rIdx - 1);
        if (dir === 'down') rIdx = Math.min(KEY_ROWS.length - 1, rIdx + 1);
        if (dir === 'left') cIdx = Math.max(0, cIdx - 1);
        if (dir === 'right') cIdx = Math.min(KEY_ROWS[rIdx].length - 1, cIdx + 1);
        cIdx = Math.min(cIdx, KEY_ROWS[rIdx].length - 1);
        _vkbSetFocus(KEY_ROWS[rIdx][cIdx]);
    }}

    function _vkbMoveCursor(dir) {{
        if (!_vkbInputEl) return;
        const isEditable = _vkbInputEl.isContentEditable || _vkbInputEl.tagName === 'DIV';
        if (isEditable) {{
            _vkbInputEl.focus();
            const key = dir === 'left' ? 'ArrowLeft' : 'ArrowRight';
            const code = dir === 'left' ? 37 : 39;
            _vkbInputEl.dispatchEvent(new KeyboardEvent('keydown', {{ bubbles:true, cancelable:true, key, keyCode:code, which:code, composed:true }}));
            setTimeout(() => {{ if (_vkbInputEl) _vkbInputEl.dispatchEvent(new KeyboardEvent('keyup', {{ bubbles:true, key, keyCode:code, composed:true }})); }}, 20);
        }} else {{
            const txt = _vkbInputEl.value || '';
            if (dir === 'left') _vkbCursorPos = Math.max(0, _vkbCursorPos - 1);
            if (dir === 'right') _vkbCursorPos = Math.min(txt.length, _vkbCursorPos + 1);
            try {{ _vkbInputEl.setSelectionRange(_vkbCursorPos, _vkbCursorPos); }} catch(e) {{}}
        }}
        _vkbRenderPreview();
    }}

    function _vkbInsert(char) {{
        if (!_vkbInputEl) return;
        const isEditable = _vkbInputEl.isContentEditable || _vkbInputEl.tagName === 'DIV';
        _vkbInputEl.focus();
        if (isEditable) {{
            const dt = new DataTransfer();
            dt.setData('text/plain', char);
            const pasteEvt = new ClipboardEvent('paste', {{ clipboardData: dt, bubbles: true, cancelable: true, composed: true }});
            if (!_vkbInputEl.dispatchEvent(pasteEvt)) document.execCommand('insertText', false, char);
            _vkbInputEl.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
            _vkbCursorPos += char.length;
        }} else {{
            const val = _vkbInputEl.value || '';
            const newText = val.slice(0, _vkbCursorPos) + char + val.slice(_vkbCursorPos);
            _setNativeValue(_vkbInputEl, newText);
            _vkbCursorPos += char.length;
            _vkbInputEl.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
            _vkbInputEl.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
        }}
    }}

    function _vkbDelete() {{
        if (!_vkbInputEl) return;
        const isEditable = _vkbInputEl.isContentEditable || _vkbInputEl.tagName === 'DIV';
        _vkbInputEl.focus();
        if (isEditable) {{
            document.execCommand('delete', false, null);
            _vkbInputEl.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
            _vkbCursorPos = Math.max(0, (_vkbInputEl.textContent || '').length);
        }} else {{
            if (_vkbCursorPos > 0) {{
                const val = _vkbInputEl.value || '';
                const newText = val.slice(0, _vkbCursorPos - 1) + val.slice(_vkbCursorPos);
                _setNativeValue(_vkbInputEl, newText);
                _vkbCursorPos--;
                _vkbInputEl.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
                _vkbInputEl.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
            }}
        }}
    }}

    function _vkbPressKey(key) {{
        if (!_vkbInputEl) return;
        if (key === '\u232b') _vkbDelete();
        else if (key === 'shift') _vkbSetShift(!_vkbShifted);
        else if (key === 'space') _vkbInsert(' ');
        else if (key === 'ok' || key === 'cancel') _vkbClose();
        else {{
            if (key.length === 1 && key >= 'a' && key <= 'z') {{
                _vkbInsert(_vkbShifted ? key.toUpperCase() : key);
                if (_vkbShifted) _vkbSetShift(false);
            }} else {{
                _vkbInsert(key);
            }}
        }}
        _vkbRenderPreview();
    }}

    function _vkbOpen(targetEl) {{
        if (_vkbClosing) return;
        if (_vkbIsOpen && _vkbInputEl === targetEl) return;

        if (_vkbIsOpen && _vkbInputEl && _vkbInputEl !== targetEl) {{
            _vkbInputEl.removeEventListener('input', _vkbRenderPreview);
            _vkbInputEl = targetEl;
            const isEditable = targetEl.isContentEditable || targetEl.tagName === 'DIV';
            _vkbCursorPos = isEditable ? (targetEl.textContent || '').length : (targetEl.selectionStart !== undefined ? targetEl.selectionStart : (targetEl.value || '').length);
            _vkbInputEl.addEventListener('input', _vkbRenderPreview);
            _vkbRenderPreview();
            return;
        }}

        _vkbInputEl = targetEl;
        const isEditable = targetEl.isContentEditable || targetEl.tagName === 'DIV';
        _vkbCursorPos = isEditable ? (targetEl.textContent || '').length : (targetEl.selectionStart !== undefined ? targetEl.selectionStart : (targetEl.value || '').length);

        _vkbBuild();
        _vkbEl.style.display = 'block';
        _vkbSetShift(_vkbShifted);
        _vkbRenderPreview();
        _vkbInputEl.addEventListener('input', _vkbRenderPreview);

        requestAnimationFrame(() => {{
            _vkbEl.classList.add('visible');
            _vkbIsOpen = true;
            _vkbSetFocus('q');
        }});
    }}

    function _vkbClose() {{
        if (!_vkbEl || !_vkbIsOpen) return;
        _vkbClosing = true;
        _vkbIsOpen = false;
        _vkbEl.classList.remove('visible');

        if (_vkbInputEl) {{
            _vkbInputEl.removeEventListener('input', _vkbRenderPreview);
            const elToBlur = _vkbInputEl;
            _vkbInputEl = null;
            requestAnimationFrame(() => {{ try {{ elToBlur.blur(); }} catch(e) {{}} }});
        }}

        setTimeout(() => {{
            if (_vkbEl && !_vkbEl.classList.contains('visible')) _vkbEl.style.display = 'none';
            _vkbClosing = false;
        }}, 400);
    }}

    function bindInputFocus() {{
        document.addEventListener('focusin', e => {{
            if (_vkbClosing) return;
            const el = e.target;
            if (isInput(el) && !_vkbIsOpen) {{
                setTimeout(() => {{ if (!_vkbClosing && document.activeElement === el) _vkbOpen(el); }}, 50);
            }}
        }}, true);

        document.addEventListener('mousedown', e => {{
            if (e.target.closest && e.target.closest('.doorpi-vkb-overlay')) {{ e.preventDefault(); return; }}
            if (isInput(e.target) && !_vkbIsOpen && !_vkbClosing) _vkbOpen(e.target);
        }}, true);

        document.addEventListener('click', e => {{
            const tgt = e.target;
            if (_vkbIsOpen && !isInput(tgt) && !(tgt.closest && tgt.closest('.doorpi-vkb-overlay'))) {{ _vkbClose(); }}
        }}, true);
    }}

    let buttonStates = {{}}, buttonHoldTimes = {{}}, buttonRepeatCount = {{}};

    function fireArrow(left) {{
        const key = left ? 'ArrowLeft' : 'ArrowRight';
        const kc = left ? 37 : 39;
        const el = document.activeElement || document.body;
        el.dispatchEvent(new KeyboardEvent('keydown', {{ bubbles: true, cancelable: true, key, code:key, keyCode: kc, which: kc, composed: true }}));
        setTimeout(() => {{ el.dispatchEvent(new KeyboardEvent('keyup', {{ bubbles: true, key, code:key, keyCode: kc, which: kc, composed: true }})); }}, 20);
    }}

    function processButton(idx, pressed, action, canRepeat) {{
        if (pressed) {{
            if (!buttonStates[idx]) {{
                action(); buttonStates[idx] = true; buttonHoldTimes[idx] = Date.now(); buttonRepeatCount[idx] = 0;
            }} else if (canRepeat !== false) {{
                const held = Date.now() - buttonHoldTimes[idx];
                const expected = Math.floor((held - 350) / 70);
                if (held > 350 && expected > buttonRepeatCount[idx]) {{ action(); buttonRepeatCount[idx] = expected; }}
            }}
        }} else {{ buttonStates[idx] = false; }}
    }}

    function _findScrollable(cx, cy, down) {{
        let el = document.elementFromPoint(cx, cy);
        while (el && el !== document.documentElement) {{
            const st = window.getComputedStyle(el);
            const ov = st.overflowY;
            const canScroll = ov === 'auto' || ov === 'scroll' || ov === 'overlay';
            if (canScroll) {{
                if (down && el.scrollTop < el.scrollHeight - el.clientHeight - 1) return el;
                if (!down && el.scrollTop > 0) return el;
            }}
            el = el.parentElement;
        }}
        return document.documentElement;
    }}

    function startGamepad() {{
        let _lastTs = performance.now();

        function poll(now) {{
            try {{
                const dt = (now - _lastTs) / 16.666;
                _lastTs = now;

                const gp = (navigator.getGamepads ? navigator.getGamepads() : [])[0];
                const isFocusedOrPopup = document.hasFocus() || window.name === 'doorpi_popup';

                if (gp && isFocusedOrPopup) {{
                    if (_vkbIsOpen) {{
                        processButton(12,  !!gp.buttons[12]?.pressed, () => _vkbMoveFocus('up'));
                        processButton(13,  !!gp.buttons[13]?.pressed, () => _vkbMoveFocus('down'));
                        processButton(14,  !!gp.buttons[14]?.pressed, () => _vkbMoveFocus('left'));
                        processButton(15,  !!gp.buttons[15]?.pressed, () => _vkbMoveFocus('right'));

                        const dx = gp.axes[0], dy = gp.axes[1];
                        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {{
                            _speedMult = Math.min(_speedMult + 0.12 * dt, SPEED_MAX / SPEED_BASE);
                            const SENSE = 8;
                            moveCursor(dx * SENSE * _speedMult * dt, dy * SENSE * _speedMult * dt);
                        }} else {{
                            _speedMult = 1;
                        }}

                        processButton(0,  !!gp.buttons[0]?.pressed,  () => _vkbPressKey(_vkbFocusKey), false);
                        processButton(1,  !!gp.buttons[1]?.pressed,  _vkbClose, false);
                        processButton(2,  !!gp.buttons[2]?.pressed,  () => _vkbDelete(), true);
                        processButton(3,  !!gp.buttons[3]?.pressed,  () => _vkbInsert(' '), true);
                        processButton(4,  !!gp.buttons[4]?.pressed,  () => _vkbMoveCursor('left'), true);
                        processButton(5,  !!gp.buttons[5]?.pressed,  () => _vkbMoveCursor('right'), true);
                        processButton(7,  !!gp.buttons[7]?.pressed,  doClick, false);
                        processButton(9,  !!gp.buttons[9]?.pressed,  _vkbClose, false);
                        processButton(10, !!gp.buttons[10]?.pressed, () => _vkbSetShift(!_vkbShifted), false);
                    }} else {{
                        const dx = gp.axes[0], dy = gp.axes[1];
                        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {{
                            _speedMult = Math.min(_speedMult + 0.12 * dt, SPEED_MAX / SPEED_BASE);
                            const SENSE = 8;
                            const moveX = dx * SENSE * _speedMult * dt;
                            const moveY = dy * SENSE * _speedMult * dt;
                            moveCursor(moveX, moveY);
                        }} else {{
                            _speedMult = 1;
                        }}

                        const rsY = Math.abs(gp.axes[3] ?? 0) > Math.abs(gp.axes[2] ?? 0) ? (gp.axes[3] ?? 0) : 0;
                        if (Math.abs(rsY) > 0.1) {{
                            const sign = rsY > 0 ? 1 : -1;
                            const amount = (rsY * rsY) * sign * 40 * dt;
                            const target = _findScrollable(cursorX, cursorY, sign > 0);
                            if (target === document.documentElement || target === document.body) {{
                                window.scrollBy({{ top: amount, behavior: 'auto' }});
                            }} else if (target) {{
                                target.scrollTop += amount;
                            }}
                        }}

                        processButton(0, !!gp.buttons[0]?.pressed, doClick, false);
                        processButton(1, !!gp.buttons[1]?.pressed, goBack, false);
                        processButton(2, !!gp.buttons[2]?.pressed, () => {{
                            try {{ window.chrome.webview.postMessage('gp_right_click'); }} catch(_) {{}}
                        }}, false);
                        processButton(4, !!gp.buttons[4]?.pressed, () => fireArrow(true),  false);
                        processButton(5, !!gp.buttons[5]?.pressed, () => fireArrow(false), false);

                        processButton(12, !!gp.buttons[12]?.pressed, () => window.scrollBy(0,  -120));
                        processButton(13, !!gp.buttons[13]?.pressed, () => window.scrollBy(0,   120));
                        processButton(14, !!gp.buttons[14]?.pressed, () => window.scrollBy(-120, 0));
                        processButton(15, !!gp.buttons[15]?.pressed, () => window.scrollBy( 120, 0));
                    }}
                }}
            }} catch(e) {{}}
            requestAnimationFrame(poll);
        }}
        requestAnimationFrame(poll);
    }}

    init();
}})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }
        private async Task OpenWebViewInlineAsync(string url, bool isYouTube = false)
        {
            bool isUtilityPopup = url.Contains("steamgriddb.com");
            if (isUtilityPopup)
            {
                // Opcional: Você pode definir um tamanho menor aqui se quiser
                // Mas como o seu código já usa RootGrid.Children.Add(_ytWebView), 
                // ele vai ocupar a tela toda com foco total, o que é melhor para TVs.
            }
            if (_ytWebView != null)
            {
                Panel.SetZIndex(_ytWebView, 1000);
                _ytWebView.Visibility = Visibility.Visible;
                _ytWebView.Focus();
                return;
            }

            _ytClosing = false;
            _isCurrentSiteYouTube = isYouTube;
            webView.Visibility = Visibility.Collapsed;

            await YtEnsureBlocklistAsync();

            _ytWebView = new WebView2
            {
                HorizontalAlignment = HorizontalAlignment.Stretch,
                VerticalAlignment = VerticalAlignment.Stretch,
            };
            Panel.SetZIndex(_ytWebView, 1000);
            RootGrid.Children.Add(_ytWebView);

            string profileName = GetBrowserProfileNameForUrl(url, isYouTube);


            string userDataPath = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory, "Data", "browser-profiles", profileName);

            var options = new CoreWebView2EnvironmentOptions { AreBrowserExtensionsEnabled = true };
            var env = await CoreWebView2Environment.CreateAsync(null, userDataPath, options);
            await _ytWebView.EnsureCoreWebView2Async(env);

            await LoadExtensionsAsync(_ytWebView.CoreWebView2);

            if (isYouTube)
                _ytWebView.CoreWebView2.Settings.UserAgent = YT_UA;
            else
                _ytWebView.CoreWebView2.Settings.UserAgent = "";

            _ytWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _ytWebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            _ytWebView.CoreWebView2.Settings.IsZoomControlEnabled = false;

            _ytWebView.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            _ytWebView.CoreWebView2.WebResourceRequested += YtOnWebResourceRequested;
            _ytWebView.CoreWebView2.WebMessageReceived += YtOnWebMessageReceived;
            _ytWebView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;

            await YtInjectAdBlockerAsync(_ytWebView.CoreWebView2);

            if (isYouTube)
            {
                await YtInjectGamepadAsync(_ytWebView.CoreWebView2);
                await YtInjectZoomHackAsync(_ytWebView.CoreWebView2);
                await YtInjectForceUserSelectionAsync(_ytWebView.CoreWebView2);
                await YtInjectUltrawideFixAsync(_ytWebView.CoreWebView2);
                await YtInjectPlayerBackgroundAsync(_ytWebView.CoreWebView2);
                _ytWebView.ZoomFactor = 0.3;
            }
            else
            {
                await YtInjectGenericSiteAsync(_ytWebView.CoreWebView2);
            }

            _ytWebView.CoreWebView2.Navigate(url);
            _ytWebView.Focus();
            _ytWebView.KeyDown += YtOnKeyDown;
            _ytWebView.CoreWebView2.SourceChanged += (s, args) =>
            {
                string newUrl = _ytWebView.CoreWebView2.Source;
                var trimmed = newUrl.TrimEnd('/');
                if (trimmed == "https://www.steamgriddb.com")
                {
                    _ytWebView.CoreWebView2.Navigate("https://www.steamgriddb.com/profile/preferences/api");
                }
            };
        }

        private string GetBrowserProfileNameForUrl(string url, bool isYouTube)
        {
            string appKey = isYouTube ? "youtube" : "";
            MediaAppModel? media = null;
            try
            {
                media = LoadMediaApps().FirstOrDefault(m =>
                    string.Equals(m.Url, url, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(m.Id, url, StringComparison.OrdinalIgnoreCase));
            }
            catch { }

            if (media != null)
            {
                appKey = string.IsNullOrWhiteSpace(media.Id)
                    ? Convert.ToHexString(System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(media.Url)))[..10].ToLowerInvariant()
                    : media.Id;

                if (media.ShareMode == "all" || media.ShareMode == "user" || media.IsSharedFromOtherUser)
                {
                    string owner = string.IsNullOrWhiteSpace(media.OwnerUserId) ? currentUserId : media.OwnerUserId;
                    return SafePathSegment($"shared-{owner}-{appKey}");
                }
            }

            if (string.IsNullOrWhiteSpace(appKey))
            {
                var nativeApp = _nativeApps.FirstOrDefault(a => url.Contains(a.Id, StringComparison.OrdinalIgnoreCase));
                appKey = nativeApp != default
                    ? nativeApp.Id
                    : Convert.ToHexString(System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(url)))[..10].ToLowerInvariant();
            }

            string user = string.IsNullOrWhiteSpace(currentUserId) ? "default" : currentUserId;
            return SafePathSegment($"{user}-{appKey}");
        }

        // ── Fechar app ────────────────────────────────────────────────────────
        public void CloseYouTubeInline()
        {
            if (_ytClosing || _ytWebView == null) return;
            _ytClosing = true;

            try { _popupWindow?.Close(); } catch { } 

            try
            {
                _ytWebView.CoreWebView2?.ExecuteScriptAsync(
                    "try{document.querySelectorAll('video').forEach(v=>v.pause());}catch(e){}");
            }
            catch { }

            _ytWebView.KeyDown -= YtOnKeyDown;
            _ytWebView.CoreWebView2.WebResourceRequested -= YtOnWebResourceRequested;
            _ytWebView.CoreWebView2.WebMessageReceived -= YtOnWebMessageReceived;
            _ytWebView.CoreWebView2.NewWindowRequested -= OnNewWindowRequested; 

            RootGrid.Children.Remove(_ytWebView);
            try { _ytWebView.Dispose(); } catch { }
            _ytWebView = null;
            _ytClosing = false;

            webView.Visibility = Visibility.Visible;
            ForceFocus();
            webView.CoreWebView2?.PostWebMessageAsString("{\"type\":\"mediaAppClosed\"}");
        }

        // ── Handlers ──────────────────────────────────────────────────────────
        private void YtOnKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Escape || e.Key == Key.BrowserBack)
            {
                e.Handled = true;
                if (_isCurrentSiteYouTube)
                {
                    // YouTube TV tem lógica própria de navegação (handleBackButton)
                    _ytWebView?.CoreWebView2?.ExecuteScriptAsync(
                        "if(window.handleBackButton) window.handleBackButton();");
                }
                else
                {
                    // Sites genéricos: ESC fecha o app diretamente via Dispatcher
                
                    Dispatcher.Invoke(CloseYouTubeInline);
                }
            }
        }

        private void YtOnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            var msg = e.TryGetWebMessageAsString();
            if (msg == null) return;

            // Identifica de qual tela veio o controle (Principal ou Popup)
            bool isPopup = (_popupWebView != null && sender == _popupWebView.CoreWebView2);
            WebView2 activeView = isPopup ? _popupWebView! : _ytWebView!;

            if (msg == "player_loaded")
            {
                Dispatcher.Invoke(() => { if (_ytWebView != null) _ytWebView.ZoomFactor = 1.0; });
            }
            else if (msg == "close_app")
            {
                Dispatcher.Invoke(() =>
                {
                    if (isPopup)
                        _popupWindow?.Close(); 
                    else
                        CloseYouTubeInline(); 
                });
            }
            else if (msg == "gp_right_click")
            {
                // Simula o clique do botão direito do mouse na posição atual do cursor
                const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
                const uint MOUSEEVENTF_RIGHTUP = 0x0010;
                mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
            }
            else if (msg.StartsWith("copy_api_key:"))
            {
                string key = msg.Substring("copy_api_key:".Length);
                Dispatcher.Invoke(() =>
                {
                    try
                    {
                        // Define a chave no Clipboard do Windows
                        System.Windows.Clipboard.SetText(key);
                        Debug.WriteLine($"[Doorpi] API Key capturada automaticamente: {key}");
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[Doorpi] Erro ao copiar chave: {ex.Message}");
                    }
                });
            }
            else if (msg == "doorpi_profile_hacked_done") { /* ack */ }
            else if (msg.StartsWith("gp_move:"))
            {
                var span = msg.AsSpan(8);
                int sep = span.IndexOf(':');
                if (sep > 0 &&
                    int.TryParse(span[..sep], out int vx) &&
                    int.TryParse(span[(sep + 1)..], out int vy) &&
                    activeView != null)
                {
                    Dispatcher.Invoke(() =>
                    {
                        try
                        {
                            // Calcula as coordenadas físicas exatas com base na janela atual
                            var pt = activeView.PointToScreen(new System.Windows.Point(vx, vy));
                            SetCursorPos((int)pt.X, (int)pt.Y);
                        }
                        catch { }
                    });
                }
            }
            else if (msg == "gp_click")
            {
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
            }
        }

        private void YtOnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
        {
            try
            {
                var uriStr = e.Request.Uri;
                if (string.IsNullOrEmpty(uriStr)) return;

                if (uriStr.Contains("youtube.com") || uriStr.Contains("ytimg.com") ||
                    uriStr.Contains("googlevideo.com") || uriStr.Contains("yt3.ggpht.com"))
                {
                    e.Request.Headers.SetHeader("User-Agent", YT_UA);
                }

                var uri = new Uri(uriStr);
                var host = uri.Host.ToLowerInvariant();
                var pathQuery = uri.PathAndQuery.ToLowerInvariant();

                if (host.Contains("googlevideo.com") && pathQuery.Contains("/videoplayback"))
                {
                    if (pathQuery.Contains("adformat=") || pathQuery.Contains("vmap=") ||
                        pathQuery.Contains("oad=") || pathQuery.Contains("adext=") ||
                        pathQuery.Contains("ad_type="))
                    { YtBlockRequest(e); return; }
                }

                if (host.Contains("googlesyndication.com") || host.Contains("doubleclick.net") ||
                    host.Contains("googleadservices.com") || host.Contains("csp.withgoogle.com") ||
                    pathQuery.Contains("/pagead/") || pathQuery.Contains("/ptracking") ||
                    pathQuery.Contains("/api/stats/ads") || pathQuery.Contains("/get_midroll_info"))
                { YtBlockRequest(e); return; }

                if (_ytBlockedDomains is { Count: > 0 })
                {
                    var parts = host.Split('.');
                    for (int i = 0; i < parts.Length - 1; i++)
                        if (_ytBlockedDomains.Contains(string.Join('.', parts[i..])))
                        { YtBlockRequest(e); return; }
                }
            }
            catch { }
        }

        private void YtBlockRequest(CoreWebView2WebResourceRequestedEventArgs e)
        {
            if (_ytWebView?.CoreWebView2?.Environment == null) return;
            e.Response = _ytWebView.CoreWebView2.Environment
                .CreateWebResourceResponse(null, 204, "No Content", "");
        }

        // ── Blocklist ─────────────────────────────────────────────────────────
        private static async Task YtEnsureBlocklistAsync()
        {
            lock (_ytBlockLock)
            {
                if (_ytBlockedDomains != null) return;
                _ytBlockedDomains = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            }
            var domains = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var url in _ytBlocklistUrls)
            {
                try
                {
                    var text = await _ytHttp.GetStringAsync(url);
                    foreach (var line in text.Split('\n'))
                    {
                        var t = line.Trim();
                        if (t.StartsWith("||"))
                        {
                            var end = t.IndexOf('^');
                            if (end > 2)
                            {
                                var d = t.Substring(2, end - 2);
                                if (!d.Contains('/') && d.Length > 0) domains.Add(d);
                            }
                        }
                    }
                }
                catch { }
            }
            lock (_ytBlockLock) { _ytBlockedDomains = domains; }
        }

        // ══════════════════════════════════════════════════════════════════════
        // SCRIPTS DE INJEÇÃO
        // ══════════════════════════════════════════════════════════════════════

        private static async Task YtInjectAdBlockerAsync(CoreWebView2 cw)
        {
            const string script = @"
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
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private static async Task YtInjectZoomHackAsync(CoreWebView2 cw)
        {
            const string script = @"
(function() {
    const check = setInterval(() => {
        if (document.querySelector('.html5-main-video')) {
            window.chrome.webview.postMessage('player_loaded');
            clearInterval(check);
        }
    }, 500);
})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private static async Task YtInjectGamepadAsync(CoreWebView2 cw)
        {
            const string script = @"
(function() {
    if (window.__doorpiGamepadInjected) return;
    window.__doorpiGamepadInjected = true;

    let buttonStates = {}, buttonHoldTimes = {}, buttonRepeatCount = {};

    function fireKey(code, key) {
        document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: code, which: code, key: key }));
        setTimeout(() => {
            document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, keyCode: code, which: code, key: key }));
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
                processButton(100, gp.axes[1] < -0.5, 38, 'ArrowUp');
                processButton(101, gp.axes[1] >  0.5, 40, 'ArrowDown');
                processButton(102, gp.axes[0] < -0.5, 37, 'ArrowLeft');
                processButton(103, gp.axes[0] >  0.5, 39, 'ArrowRight');
                processButton(1, !!gp.buttons[1]?.pressed, 27, 'Escape');
            }
        } catch(_) {}
        requestAnimationFrame(pollGamepad);
    }
    pollGamepad();
})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private static async Task YtInjectForceUserSelectionAsync(CoreWebView2 cw)
        {
            const string script = @"
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
                    clearInterval(poller); clearTimeout(safetyTimer);
                    hideOverlay();
                    try { window.chrome.webview.postMessage('doorpi_profile_hacked_done'); } catch(e) {}
                    return;
                }
                if (isAccountSelector()) {
                    clearInterval(poller); clearTimeout(safetyTimer);
                    finish(); return;
                }
                fireEscape(); fireEscape();
            } catch(e) {}
        }, 80);
    }

    function waitForApp() {
        const selectors = 'ytlr-app, ytlr-watch, #watch, .ytlr-masthead-renderer, #thumbnail-items';
        if (document.querySelector(selectors)) { startLoop(); return; }

        const observer = new MutationObserver(() => {
            try {
                if (document.querySelector(selectors)) { observer.disconnect(); startLoop(); }
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
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private static async Task YtInjectUltrawideFixAsync(CoreWebView2 cw)
        {
            const string script = @"
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
            try { el.scrollTop += 1; requestAnimationFrame(() => { el.scrollTop -= 1; }); } catch(_) {}
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
            try { const ro = new ResizeObserver(()=>{}); ro.observe(el); ro.unobserve(el); ro.disconnect(); } catch(_) {}
            try { el.dispatchEvent(new Event('resize', { bubbles: false })); } catch(_) {}
            try { el.updateLayoutParameters?.(); } catch(_) {}
            try { el.requestUpdate?.(); } catch(_) {}
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
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }

        private static async Task YtInjectPlayerBackgroundAsync(CoreWebView2 cw)
        {
            const string script = @"
(function() {
    if (window.__doorpiPlayerBg) return;
    window.__doorpiPlayerBg = true;

    const BLUR_PX  = 24;
    const OPACITY  = 0.55;
    const BG_ID    = 'doorpi-player-bg';
    const STYLE_ID = 'doorpi-player-style';

    let _canvas = null;
    let _ctx    = null;
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
        _canvas.width  = window.innerWidth  || 1920;
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
            if (!_src) { _ctx.fillStyle = '#0f0f0f'; _ctx.fillRect(0, 0, _canvas.width, _canvas.height); }
        }, { passive: true });
    }

    function drawLoop() {
        requestAnimationFrame(drawLoop);
        if (!_src || !_ctx || !_canvas || _src.readyState < 2) return;
        try { _ctx.drawImage(_src, 0, 0, _canvas.width, _canvas.height); } catch(e) {}
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
            if (found.readyState >= 2) tryStart();
            else {
                found.addEventListener('loadeddata', tryStart, { once: true, passive: true });
                found.addEventListener('playing',    tryStart, { once: true, passive: true });
            }
        } else if (!found && _currentVideo) {
            _currentVideo = null; _src = null;
        }
    });

    function start() {
        if (!document.body) { setTimeout(start, 50); return; }
        ensureBg(); injectCSS(); drawLoop();
        domObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    start();
})();";
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(script);
        }
    }
}
