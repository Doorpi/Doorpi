(function () {
    const DEFAULT_CONFIG = {
        enabled: true,
        entryUrl: 'intros/doorpi-neon/index.html',
        name: 'Doorpi Intro',
        durationMs: 12000,
        exitFadeMs: 520,
        handoff: {
            background: '#07071a',
            vignette: 'radial-gradient(circle at 50% 50%, transparent 25%, rgba(0, 0, 18, 0.85) 95%)',
            colors: [
                'rgba(15,25,85,0.7)', 'rgba(10,30,85,0.7)',
                'rgba(25,15,70,0.7)', 'rgba(5,40,75,0.7)',
                'rgba(20,20,90,0.6)', 'rgba(15,35,70,0.6)',
                'rgba(10,15,60,0.7)', 'rgba(30,20,80,0.6)'
            ]
        }
    };

    const state = {
        started: false,
        completed: false,
        failed: false,
        config: null,
        iframe: null,
        completeTimer: null,
        waiters: [],
        handoffActive: false,
        ambient: null,
        ambientRaf: 0,
        ambientBlobs: [],
        inputHandlersInstalled: false,
        handoffConfig: null,
        handoffStyleEl: null,
        handoffBodyClasses: [],
        bootMode: Number(window.__doorpiBootMode || 0),
        consoleIntroSkippable: window.__doorpiConsoleShellIntroSkippable === true,
        consoleExplorerReady: window.__doorpiConsoleShellExplorerReady === true,
        systemPrepOverlay: null,
        finishDispatched: false
    };

    async function fetchIntroConfig() {
        try {
            // 1. Lê o active.json direto da wwwroot via app.local
            const activeRes = await fetch('https://app.local/intros/active-intro.json', { cache: 'no-store' });
            if (!activeRes.ok) return DEFAULT_CONFIG;

            const activeData = await activeRes.json();

            // 2. Se a intro foi desligada
            if (activeData.enabled === false) {
                return { enabled: false };
            }

            if (!activeData.manifest) return DEFAULT_CONFIG;

            // 3. Monta a URL do manifest.json sempre apontando para app.local
            let manifestUrl = activeData.manifest;
            if (!manifestUrl.startsWith('http')) {
                manifestUrl = `https://app.local/intros/${manifestUrl}`;
            }

            // 4. Lê o manifest da intro escolhida
            const manifestRes = await fetch(manifestUrl, { cache: 'no-store' });
            if (!manifestRes.ok) return DEFAULT_CONFIG;

            const manifest = await manifestRes.json();

            // 5. Calcula o caminho final
            const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/'));
            const entryUrl = `${baseUrl}/${manifest.entry || 'index.html'}`;

            return {
                ...DEFAULT_CONFIG,
                ...manifest,
                entryUrl: entryUrl,
                handoff: {
                    ...DEFAULT_CONFIG.handoff,
                    ...(manifest.handoff || {})
                }
            };
        } catch (e) {
            console.warn("[Doorpi Intro] Falha ao ler active.json. Acionando Fallback (Neon).", e);
            return DEFAULT_CONFIG;
        }
    }

    function classListFrom(value) {
        return String(value || '').split(/\s+/).map(item => item.trim()).filter(item => /^[a-zA-Z0-9_-]+$/.test(item));
    }

    function injectStyles() {
        if (!document.head || document.getElementById('doorpiIntroSystemStyles')) return;
        const style = document.createElement('style');
        style.id = 'doorpiIntroSystemStyles';
        style.textContent = `
            #doorpiIntroFrame {
                position: fixed; inset: 0; width: 100%; height: 100%; border: 0;
                z-index: 99999; background: #020309; color-scheme: dark;
                transition: opacity 520ms cubic-bezier(0.4, 0, 0.2, 1);
            }
            #doorpiIntroSystemPrep {
                position: fixed; inset: 0; z-index: 99998;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                gap: 16px; background: #020309; color: #fff; opacity: 0;
                transition: opacity 220ms ease; pointer-events: all;
            }
            #doorpiIntroSystemPrep.visible { opacity: 1; }
            #doorpiIntroSystemPrep .prep-spinner {
                width: 38px; height: 38px; border-radius: 50%;
                border: 2px solid rgba(255,255,255,.16);
                border-top-color: rgba(255,255,255,.88);
                border-right-color: rgba(255,255,255,.48);
                animation: doorpiIntroPrepSpin .82s linear infinite;
            }
            #doorpiIntroSystemPrep .prep-title {
                font-size: clamp(1.7rem, 3.4vw, 3.8rem);
                font-weight: 300; line-height: 1; letter-spacing: 0;
            }
            #doorpiIntroSystemPrep .prep-sub {
                color: rgba(255,255,255,.58); font-size: clamp(.86rem, 1.15vw, 1.08rem);
                text-transform: uppercase; letter-spacing: .1em; font-weight: 650;
            }
            @keyframes doorpiIntroPrepSpin { to { transform: rotate(360deg); } }
            #doorpiIntroAmbient {
                position: fixed; inset: 0; z-index: 9100; overflow: hidden; pointer-events: none;
                background: var(--doorpi-intro-bg, #07071a); opacity: 0; transition: opacity 900ms ease;
            }
            #doorpiIntroAmbient.is-active { opacity: 1; }
            #doorpiIntroAmbient.is-ending { opacity: 0; }
            .doorpi-intro-ambient-blob { position: absolute; border-radius: 50%; filter: blur(45px); will-change: transform; transform: translate3d(0, 0, 0); }
            .doorpi-intro-ambient-vig { position: absolute; inset: 0; z-index: 2; background: var(--doorpi-intro-vignette, radial-gradient(circle at 50% 50%, transparent 25%, rgba(0, 0, 18, 0.85) 95%)); }
            
            body.doorpi-intro-handoff-active .doorpi-user-overlay.doorpi-intro-handoff,
            body.doorpi-intro-handoff-active #setupContainer.doorpi-intro-handoff { 
                background: transparent; 
                backdrop-filter: none; 
                -webkit-backdrop-filter: none; 
            }

            /* Animação de Surgimento do Fundo Estática */
            body.doorpi-intro-handoff-active .doorpi-user-overlay.doorpi-intro-handoff .doorpi-user-panel,
            body.doorpi-intro-handoff-active #setupContainer.doorpi-intro-handoff .setup-form { 
                /* Garante que a escala parta do centro exato */
                transform-origin: center center !important;
                /* 1.2s para uma entrada suave */
                animation: doorpiIntroUserPanelIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) both; 
            }

            @keyframes doorpiIntroUserPanelIn { 
                from { 
                    opacity: 0; 
                    /* Forçamos o Y em 0 para anular qualquer estilo do sistema base que cause movimento */
           
                    filter: blur(8px) brightness(0.6);
                } 
                to { 
                    opacity: 1; 
                    filter: blur(0) brightness(1);
                } 
            }
        `;
        document.head.appendChild(style);
    }

    function revealMainSystemUI() {
        const ui = document.getElementById('doorpi-app-ui');
        if (ui && ui.style.display === 'none') {
            ui.style.display = 'block';
            void ui.offsetWidth;
            ui.style.opacity = '1';
            document.body.style.background = '#07071a';
        }
    }

    function flushWaiters() {
        const waiters = state.waiters.splice(0);
        for (const waiter of waiters) { try { waiter(); } catch (err) { } }
    }

    function isConsoleShellMode() {
        return Number(state.bootMode || window.__doorpiBootMode || 0) === 2;
    }

    function isConsoleShellPending() {
        return isConsoleShellMode() && state.consoleExplorerReady !== true && window.__doorpiConsoleShellExplorerReady !== true;
    }

    function isConsoleShellSkipPending() {
        return isConsoleShellMode() &&
            state.consoleExplorerReady !== true &&
            window.__doorpiConsoleShellExplorerReady !== true &&
            state.consoleIntroSkippable !== true &&
            window.__doorpiConsoleShellIntroSkippable !== true;
    }

    function needsSystemPrepWait() {
        return isConsoleShellPending();
    }

    function showSystemPrepOverlay() {
        let overlay = state.systemPrepOverlay || document.getElementById('doorpiIntroSystemPrep');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'doorpiIntroSystemPrep';
            overlay.innerHTML = `
                <div class="prep-spinner" aria-hidden="true"></div>
                <div class="prep-title">Preparando sistema</div>
                <div class="prep-sub">Aguardando ambiente do Windows</div>
            `;
            document.body.appendChild(overlay);
        }
        state.systemPrepOverlay = overlay;
        overlay.style.display = 'flex';
        requestAnimationFrame(() => overlay.classList.add('visible'));
    }

    function hideSystemPrepOverlay() {
        const overlay = state.systemPrepOverlay || document.getElementById('doorpiIntroSystemPrep');
        if (!overlay) return;
        overlay.classList.remove('visible');
        setTimeout(() => {
            if (!overlay.classList.contains('visible')) overlay.remove();
        }, 240);
        state.systemPrepOverlay = null;
    }

    function notifyHostIntroReadyForFocus(reason) {
        const send = () => {
            try {
                window.chrome?.webview?.postMessage(JSON.stringify({
                    action: 'introSystemReadyForFocus',
                    reason: String(reason || 'complete')
                }));
            } catch { }
        };

        requestAnimationFrame(() => requestAnimationFrame(send));
    }

    function finalizeIntroCompletion(reason) {
        if (state.finishDispatched) return;
        state.finishDispatched = true;
        hideSystemPrepOverlay();
        if (!state.handoffActive) {
            revealMainSystemUI();
        }
        flushWaiters();
        window.dispatchEvent(new CustomEvent('doorpi:intro-complete', { detail: { reason } }));
        notifyHostIntroReadyForFocus(reason);
    }

    function completeIntro(reason = 'complete', immediate = false) {
        if (state.completed) return;
        state.completed = true;
        window.clearTimeout(state.completeTimer);

        const iframe = state.iframe;
        const fadeMs = immediate ? 0 : Math.max(0, Number(state.config?.exitFadeMs ?? 520));

        const finish = () => {
            iframe?.remove();
            state.iframe = null;
            if (needsSystemPrepWait()) {
                showSystemPrepOverlay();
                return;
            }
            finalizeIntroCompletion(reason);
        };

        if (iframe && fadeMs > 0) {
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';
            window.setTimeout(finish, fadeMs);
        } else { finish(); }
    }

    function clearHandoffAssets() {
        state.handoffStyleEl?.remove();
        state.handoffStyleEl = null;
        if (state.handoffBodyClasses.length) {
            document.body.classList.remove(...state.handoffBodyClasses);
            state.handoffBodyClasses = [];
        }
    }

    function injectHandoffAssets(cfg) {
        clearHandoffAssets();
        const userPicker = cfg.userPicker || {};
        const bodyClasses = [...classListFrom(cfg.bodyClass), ...classListFrom(cfg.bodyClasses), ...classListFrom(userPicker.bodyClass), ...classListFrom(userPicker.bodyClasses)];

        if (bodyClasses.length) {
            document.body.classList.add(...bodyClasses);
            state.handoffBodyClasses = bodyClasses;
        }

        const cssText = userPicker.css || cfg.css || '';
        const cssFile = userPicker.style || userPicker.cssFile || cfg.style || cfg.cssFile || '';

        if (cssText) {
            const style = document.createElement('style');
            style.id = 'doorpiIntroHandoffStyle';
            style.textContent = String(cssText);
            document.head.appendChild(style);
            state.handoffStyleEl = style;
        } else if (cssFile) {
            const link = document.createElement('link');
            link.id = 'doorpiIntroHandoffStyle';
            link.rel = 'stylesheet';
            link.href = cssFile;
            document.head.appendChild(link);
            state.handoffStyleEl = link;
        }
    }

    function createAmbient(handoff = {}) {
        if (state.handoffActive) return;
        const cfg = { ...(state.config?.handoff || {}), ...handoff, userPicker: { ...(state.config?.handoff?.userPicker || {}), ...(handoff.userPicker || {}) } };
        if (cfg.enabled === false) return;

        state.handoffConfig = cfg;
        state.handoffActive = true;
        document.body.classList.add('doorpi-intro-handoff-active');
        injectHandoffAssets(cfg);

        if (cfg.ambient === false || cfg.ambient === 'none') return;
        const colors = Array.isArray(cfg.colors) && cfg.colors.length ? cfg.colors : DEFAULT_CONFIG.handoff.colors;

        const layer = document.createElement('div');
        layer.id = 'doorpiIntroAmbient';
        layer.style.setProperty('--doorpi-intro-bg', cfg.background || '#07071a');
        if (cfg.vignette) layer.style.setProperty('--doorpi-intro-vignette', cfg.vignette);
        layer.innerHTML = '<div class="doorpi-intro-ambient-vig"></div>';
        document.body.appendChild(layer);

        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        const ratio = Math.max(1, window.innerWidth / Math.max(1, window.innerHeight));
        state.ambientBlobs = [];

        for (let i = 0; i < Math.max(4, colors.length); i++) {
            const blob = document.createElement('div');
            blob.className = 'doorpi-intro-ambient-blob';
            const size = Math.min(window.innerWidth, window.innerHeight) * (0.5 + Math.random() * 0.4);
            const color = colors[i % colors.length];
            blob.style.width = `${size}px`; blob.style.height = `${size}px`;
            blob.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
            layer.insertBefore(blob, layer.firstChild);

            const angle = Math.random() * Math.PI * 2, speed = 12 + Math.random() * 12;
            state.ambientBlobs.push({ el: blob, x: cx, y: cy, size, vx: Math.cos(angle) * speed * (ratio * 0.8), vy: Math.sin(angle) * speed, phase: 'burst', wanderAngle: angle });
        }

        state.ambient = layer;
        requestAnimationFrame(() => layer.classList.add('is-active'));
        runAmbientPhysics();
    }

    function skipIntro() {
        if (!state.started || state.completed) return false;
        if (isConsoleShellSkipPending()) return false;
        createAmbient();
        completeIntro('skip', true);
        return true;
    }

    function installInputGuards() {
        if (state.inputHandlersInstalled) return;
        state.inputHandlersInstalled = true;
        const keyGuard = (e) => {
            if (!state.started || state.completed) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'Enter') {
                skipIntro();
            }
        };
        const clickGuard = (e) => {
            if (!state.started || state.completed) return;
            e.preventDefault();
            e.stopPropagation();
        };
        document.addEventListener('keydown', keyGuard, true);
        document.addEventListener('click', clickGuard, true);
    }

    function runAmbientPhysics() {
        if (!state.ambient || !state.handoffActive) return;
        const w = window.innerWidth, h = window.innerHeight;

        for (const blob of state.ambientBlobs) {
            if (blob.phase === 'burst') {
                blob.vx *= 0.985; blob.vy *= 0.985; blob.x += blob.vx; blob.y += blob.vy;
                const margin = blob.size * 0.4;
                if (blob.x < -margin) { blob.x = -margin; blob.vx *= -1; }
                if (blob.x > w + margin) { blob.x = w + margin; blob.vx *= -1; }
                if (blob.y < -margin) { blob.y = -margin; blob.vy *= -1; }
                if (blob.y > h + margin) { blob.y = h + margin; blob.vy *= -1; }
                if (Math.hypot(blob.vx, blob.vy) < 0.8) blob.phase = 'wander';
            } else {
                blob.wanderAngle += (Math.random() - 0.5) * 0.02;
                blob.vx = Math.cos(blob.wanderAngle) * 1.5; blob.vy = Math.sin(blob.wanderAngle) * 1.5;
                blob.x += blob.vx; blob.y += blob.vy;
                if (blob.x > w + blob.size / 2) blob.x = -blob.size / 2;
                if (blob.x < -blob.size / 2) blob.x = w + blob.size / 2;
                if (blob.y > h + blob.size / 2) blob.y = -blob.size / 2;
                if (blob.y < -blob.size / 2) blob.y = h + blob.size / 2;
            }
            blob.el.style.transform = `translate3d(${blob.x - blob.size / 2}px, ${blob.y - blob.size / 2}px, 0)`;
        }
        state.ambientRaf = requestAnimationFrame(runAmbientPhysics);
    }

    function finishHandoff() {
        if (!state.handoffActive) return;
        state.handoffActive = false;
        document.body.classList.remove('doorpi-intro-handoff-active');
        clearHandoffAssets();

        revealMainSystemUI();

        if (state.ambientRaf) cancelAnimationFrame(state.ambientRaf);
        state.ambientRaf = 0;
        const layer = state.ambient;
        state.ambient = null; state.ambientBlobs = [];
        if (!layer) return;
        layer.classList.remove('is-active');
        layer.classList.add('is-ending');
        window.setTimeout(() => layer.remove(), 950);
    }

    function runAfterIntro(callback) {
        if (state.completed || state.failed) { callback(); return; }
        state.waiters.push(callback);
    }

    function handleIntroMessage(event) {
        const data = event.data;
        if (!data || (typeof data !== 'object' && typeof data !== 'string')) return;
        const type = typeof data === 'string' ? data : data.type;

        if (type === 'doorpi:intro:handoff') createAmbient(typeof data === 'object' ? data.handoff : {});
        else if (type === 'doorpi:intro:complete') completeIntro('message');
        else if (type === 'doorpi:intro:error') { state.failed = true; completeIntro('error'); }
    }

    function handleHostMessage(event) {
        let data = event.data;
        try {
            if (typeof data === 'string') data = JSON.parse(data);
        } catch { return; }
        if (!data || typeof data !== 'object') return;

        if (data.type === 'bootModeState') {
            state.bootMode = Number(data.mode || 0);
            window.__doorpiBootMode = state.bootMode;
            return;
        }

        if (data.type === 'consoleShellExplorerReady') {
            state.consoleExplorerReady = true;
            window.__doorpiConsoleShellExplorerReady = true;
            if (state.completed && !state.finishDispatched) {
                finalizeIntroCompletion('system-ready');
            }
            return;
        }

        if (data.type === 'consoleShellIntroSkippable') {
            state.consoleIntroSkippable = true;
            window.__doorpiConsoleShellIntroSkippable = true;
        }
    }

    function postIntroVolume(value) {
        const safe = Math.max(0, Math.min(1, Number(value) || 0));
        try {
            state.iframe?.contentWindow?.postMessage({ type: 'doorpi:intro:set-volume', volume: safe }, '*');
        } catch { }
    }

    // Adicione 'async' aqui na frente
    async function start() {
        if (state.started) return;
        state.started = true;
        state.bootMode = Number(window.__doorpiBootMode || state.bootMode || 0);
        state.consoleIntroSkippable = window.__doorpiConsoleShellIntroSkippable === true || state.consoleIntroSkippable === true;
        state.consoleExplorerReady = window.__doorpiConsoleShellExplorerReady === true || state.consoleExplorerReady === true;

        injectStyles();
        installInputGuards();

        // Use o await para esperar a leitura do JSON que criamos acima
        state.config = await fetchIntroConfig();

        // O usuário pode ter pulado durante a leitura assíncrona do manifesto.
        if (state.completed) return;

        if (!state.config.enabled) {
            state.completed = true;
            revealMainSystemUI();
            return;
        }

        window.addEventListener('message', handleIntroMessage);

        const iframe = document.createElement('iframe');
        iframe.id = 'doorpiIntroFrame';
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        iframe.setAttribute('loading', 'eager'); // Pede máxima prioridade no download ao browser
        iframe.title = state.config.name || 'Doorpi Intro';
        iframe.src = state.config.entryUrl;

        document.body.appendChild(iframe);
        state.iframe = iframe;
        iframe.addEventListener('load', () => {
            const volume = window.DoorpiSoundSettings?.getInternalVolumes?.().intro;
            postIntroVolume(volume === undefined ? 1 : volume / 100);
        }, { once: true });

        const fallbackMs = Math.max(1000, Number(state.config.fallbackTimeoutMs ?? state.config.durationMs ?? 12000));
        state.completeTimer = window.setTimeout(() => {
            createAmbient();
            completeIntro('timeout');
        }, fallbackMs);
    }

    window.DoorpiIntro = {
        start, runAfterIntro, finishHandoff, skip: skipIntro,
        isRunning: () => state.started && !state.completed,
        isComplete: () => state.completed,
        isHandoffActive: () => state.handoffActive,
        setVolume: postIntroVolume,
        getUserPickerClasses: () => {
            const cfg = state.handoffConfig || {};
            const userPicker = cfg.userPicker || {};
            const transparent = userPicker.transparentBackdrop ?? cfg.transparentBackdrop ?? true;
            return [
                transparent ? 'doorpi-intro-handoff' : '',
                ...classListFrom(userPicker.className || userPicker.class || cfg.userPickerClass)
            ].filter(Boolean);
        },
        getSetupClasses: () => {
            const cfg = state.handoffConfig || {};
            const setup = cfg.setup || {};
            const userPicker = cfg.userPicker || {};
            const transparent = setup.transparentBackdrop ?? userPicker.transparentBackdrop ?? cfg.transparentBackdrop ?? true;
            return [
                transparent ? 'doorpi-intro-handoff' : '',
                ...classListFrom(setup.className || setup.class || cfg.setupClass || userPicker.className || userPicker.class || cfg.userPickerClass)
            ].filter(Boolean);
        },
        shouldDeferUserPicker: () => state.started && !state.completed
    };

    // INJEÇÃO ULTRA-RÁPIDA (Não espera o resto da página carregar)
    injectStyles();
    try {
        window.chrome?.webview?.addEventListener('message', handleHostMessage);
    } catch { }
    if (document.body) {
        start();
    } else {
        const observer = new MutationObserver(() => {
            if (document.body) {
                observer.disconnect();
                start();
            }
        });
        observer.observe(document.documentElement, { childList: true });

        // Fallback de segurança garantida
        document.addEventListener('DOMContentLoaded', () => {
            if (!state.started) {
                observer.disconnect();
                start();
            }
        });
    }
})();
