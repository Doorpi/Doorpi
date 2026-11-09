(function () {
    const DEFAULT_CONFIG = {
        enabled: true,
        entryUrl: 'intros/doorpi-neon/index.html',
        name: 'Doorpi Intro',
        durationMs: 12000,
        exitFadeMs: 520,
        handoff: {
            background: '#0b1232',
            vignette: 'radial-gradient(circle at 50% 50%, transparent 28%, rgba(0, 0, 18, 0.66) 92%)',
            colors: [
                'rgba(42,58,170,0.68)', 'rgba(28,78,185,0.62)',
                'rgba(62,46,150,0.64)', 'rgba(20,96,165,0.58)',
                'rgba(76,58,176,0.56)', 'rgba(28,112,178,0.54)',
                'rgba(92,122,178,0.42)', 'rgba(68,96,194,0.48)'
            ]
        }
    };

    const state = {
        started: false,
        prepared: false,
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
        nativeIntro: window.__doorpiUseNativeIntro === true,
        consoleIntroSkippable: window.__doorpiConsoleShellIntroSkippable === true,
        consoleExplorerReady: window.__doorpiConsoleShellExplorerReady === true,
        systemPrepOverlay: null,
        finishDispatched: false,
        pendingInitialDestination: '',
        skipRequested: false
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

