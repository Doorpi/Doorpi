    // The native prelude yields before this package starts its own timeline/audio.
    async function waitForNativePresentationRelease() {
        state.prepared = true;
        if (window.__doorpiBootstrapManaged !== true || window.__doorpiPresentationReleased === true) return;
        await new Promise(resolve => {
            const released = () => {
                window.removeEventListener('doorpi:boot-presentation-released', released);
                resolve();
            };
            window.addEventListener('doorpi:boot-presentation-released', released);
            if (window.__doorpiPresentationReleased === true) released();
        });
    }

    // Adicione 'async' aqui na frente
    async function start() {
        if (state.started) return;
        state.started = true;
        state.bootMode = Number(window.__doorpiBootMode || state.bootMode || 0);
        state.nativeIntro = window.__doorpiUseNativeIntro === true || state.nativeIntro === true;
        state.consoleIntroSkippable = window.__doorpiConsoleShellIntroSkippable === true || state.consoleIntroSkippable === true;
        state.consoleExplorerReady = window.__doorpiConsoleShellExplorerReady === true || state.consoleExplorerReady === true;

        injectStyles();
        installInputGuards();

        await waitForConsoleShellReady();

        if (isNativeIntroMode()) {
            state.config = { ...DEFAULT_CONFIG, enabled: false, exitFadeMs: 0 };
            if (window.__doorpiNativeIntroComplete === true) {
                createNativeHandoffAmbient();
                completeIntro('native-ready', true);
            }
            return;
        }

        // Use o await para esperar a leitura do JSON que criamos acima
        state.config = await fetchIntroConfig();

        // O usuário pode ter pulado durante a leitura assíncrona do manifesto.
        if (state.completed) return;

        await waitForNativePresentationRelease();
        if (state.completed) return;
        if (!state.config.enabled || window.__doorpiSkipBootIntro === true) {
            completeIntro('disabled-or-session-recovery', true);
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

