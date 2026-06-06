    let allInstalledApps = [];
    let cachedFolders = null;
    let currentSourceFilter = ['all'];
    let isFolderOperationInProgress = false;
    window.newGameIdsThisSession = new Set();
    window.recentlyOpenedIds = [];
    window.isGlobalLoading = false;
    window._doorpiUsers = [];
    window._doorpiCurrentUserId = '';
    window._pendingExtensionUpdates = {};


    // ── SEAMLESS WEB AUDIO PLAYER (WAKE + LOOP COMBINADOS) ────────────────
    class SeamlessPlayer {
        constructor(maxVolume) {
            this.ctx = null;
            this.wakeBuffer = null;
            this.ambienceBuffer = null;
            this.wakeNode = null;
            this.ambienceNode = null;
            this.ambienceNodes = [];
            this.ambienceScheduler = null;
            this.nextAmbienceStart = 0;
            this.scheduleAheadTime = 5.0;
            this.ambienceCrossfadeTime = 0.12;
            this.gainNode = null;
            this.isLoaded = false;
            this.isPlaying = false;
            this.volume = maxVolume;
            this.suspendTimeout = null;
        }

        async init() {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.gainNode = this.ctx.createGain();
                this.gainNode.gain.value = 0; // Começa totalmente mutado
                this.gainNode.connect(this.ctx.destination);

                const [wakeRes, ambienceRes] = await Promise.all([
                    fetch('./wake.wav'),
                    fetch('./ambience.wav')
                ]);
                const [wakeArray, ambienceArray] = await Promise.all([
                    wakeRes.arrayBuffer(),
                    ambienceRes.arrayBuffer()
                ]);

                this.wakeBuffer = await this.ctx.decodeAudioData(wakeArray);
                this.ambienceBuffer = await this.ctx.decodeAudioData(ambienceArray);

                // Cria e conecta as fontes de áudio uma única vez
                this.wakeNode = this.ctx.createBufferSource();
                this.wakeNode.buffer = this.wakeBuffer;
                this.wakeNode.connect(this.gainNode);

                // Inicia a execução imediatamente em background
                const now = this.ctx.currentTime;
                this.wakeNode.start(now);
                const ambienceStart = now + this.wakeBuffer.duration;
                this.ambienceNode = this.scheduleAmbienceNode(ambienceStart, { fadeIn: false });
                this.nextAmbienceStart = ambienceStart + this.ambienceBuffer.duration - this.ambienceCrossfadeTime;
                this.startAmbienceScheduler();

                // Suspende o contexto inicialmente para não consumir recursos
                await this.ctx.suspend();

                this.isLoaded = true;
                window._startSystemAudio();

            } catch (e) {
                console.warn("Falha ao inicializar buffers da Web Audio API:", e);
            }
        }

        trackAmbienceNode(node, nodeGain) {
            const entry = { node, nodeGain };
            this.ambienceNodes.push(entry);
            node.onended = () => {
                this.ambienceNodes = this.ambienceNodes.filter(item => item !== entry);
                try { node.disconnect(); } catch { }
                try { nodeGain.disconnect(); } catch { }
            };
        }

        scheduleAmbienceNode(startAt, options = {}) {
            if (!this.ctx || !this.gainNode || !this.ambienceBuffer) return;

            const node = this.ctx.createBufferSource();
            const nodeGain = this.ctx.createGain();
            const fade = Math.min(this.ambienceCrossfadeTime, this.ambienceBuffer.duration / 4);
            const endAt = startAt + this.ambienceBuffer.duration;
            const fadeIn = options.fadeIn !== false;

            node.buffer = this.ambienceBuffer;
            node.loop = false;
            node.connect(nodeGain);
            nodeGain.connect(this.gainNode);

            if (fadeIn) {
                nodeGain.gain.setValueAtTime(0.0001, startAt);
                nodeGain.gain.linearRampToValueAtTime(1, startAt + fade);
            } else {
                nodeGain.gain.setValueAtTime(1, startAt);
            }
            nodeGain.gain.setValueAtTime(1, Math.max(startAt + fade, endAt - fade));
            nodeGain.gain.linearRampToValueAtTime(0.0001, endAt);

            node.start(startAt);
            this.trackAmbienceNode(node, nodeGain);
            return node;
        }

        startAmbienceScheduler() {
            if (this.ambienceScheduler) {
                clearInterval(this.ambienceScheduler);
            }

            const schedule = () => {
                if (!this.ctx || !this.ambienceBuffer || !this.isPlaying) return;

                const horizon = this.ctx.currentTime + this.scheduleAheadTime;
                if (this.nextAmbienceStart > 0 && this.nextAmbienceStart < this.ctx.currentTime) {
                    this.nextAmbienceStart = this.ctx.currentTime + 0.02;
                }
                while (this.nextAmbienceStart > 0 && this.nextAmbienceStart < horizon) {
                    this.scheduleAmbienceNode(this.nextAmbienceStart);
                    this.nextAmbienceStart += this.ambienceBuffer.duration - this.ambienceCrossfadeTime;
                }
            };

            schedule();
            this.ambienceScheduler = setInterval(schedule, 500);
        }

        stopSources() {
            if (this.ambienceScheduler) {
                clearInterval(this.ambienceScheduler);
                this.ambienceScheduler = null;
            }

            [this.wakeNode, this.ambienceNode].forEach(node => {
                try { node?.stop(); } catch { }
                try { node?.disconnect(); } catch { }
            });
            this.ambienceNodes.forEach(entry => {
                try { entry.node?.stop(); } catch { }
                try { entry.node?.disconnect(); } catch { }
                try { entry.nodeGain?.disconnect(); } catch { }
            });
            this.wakeNode = null;
            this.ambienceNode = null;
            this.ambienceNodes = [];
            this.nextAmbienceStart = 0;
        }

        startSources(startAt) {
            if (!this.ctx || !this.gainNode || !this.wakeBuffer || !this.ambienceBuffer) return;

            this.wakeNode = this.ctx.createBufferSource();
            this.wakeNode.buffer = this.wakeBuffer;
            this.wakeNode.connect(this.gainNode);

            this.wakeNode.start(startAt);
            const ambienceStart = startAt + this.wakeBuffer.duration;
            this.ambienceNode = this.scheduleAmbienceNode(ambienceStart, { fadeIn: false });
            this.nextAmbienceStart = ambienceStart + this.ambienceBuffer.duration - this.ambienceCrossfadeTime;
            this.startAmbienceScheduler();
        }

        async restartFromBeginning() {
            if (!this.isLoaded) return;
            this.isPlaying = true;

            if (this.suspendTimeout) {
                clearTimeout(this.suspendTimeout);
                this.suspendTimeout = null;
            }

            if (this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }

            this.stopSources();
            const now = this.ctx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(0, now);
            this.startSources(now);
            this.gainNode.gain.linearRampToValueAtTime(this.volume, now + 1.2);
        }

        async play() {
            if (!this.isLoaded) return;
            this.isPlaying = true;

            if (this.suspendTimeout) {
                clearTimeout(this.suspendTimeout);
                this.suspendTimeout = null;
            }

            // Retoma o contexto de áudio nativo do navegador
            if (this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }

            const now = this.ctx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            // Fade-in de 1.2 segundos para entrada suave
            this.gainNode.gain.linearRampToValueAtTime(this.volume, now + 1.2);
        }

        pause(durationMs = 800) {
            if (!this.isLoaded) return;
            this.isPlaying = false;

            if (this.suspendTimeout) {
                clearTimeout(this.suspendTimeout);
            }

            const now = this.ctx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            // Fade-out suave
            this.gainNode.gain.linearRampToValueAtTime(0, now + (durationMs / 1000));

            // Suspende a execução de hardware após terminar o fade-out
            this.suspendTimeout = setTimeout(async () => {
                if (!this.isPlaying && this.ctx.state === 'running') {
                    await this.ctx.suspend();
                }
            }, durationMs + 50);
        }
    }

    const MAX_AMBIENCE_VOLUME = 0.4;
    window._audioPlayer = new SeamlessPlayer(MAX_AMBIENCE_VOLUME);
    window._audioPlayer.init();

    window._isIntroComplete = false;
    window._doorpiOfficialReturnSuppressUntil = 0;
    window._isDoorpiFocused = document.hasFocus(); // Lê o estado inicial

    // ── SISTEMA DE DISPARO POR ESTADO ───────────────────────────────────
    window._isExternalAppRunning = false; // Flag global de estado do App

    window._startSystemAudio = function (force = false) {
        if (!window._isIntroComplete) return;
        if (window._isExternalAppRunning) return; // Impede que toque se o app estiver aberto em 2º plano
        if (window._isDoorpiFocused || force) {
            window._audioPlayer.play();
        }
    };

    window._stopSystemAudio = function () {
        window._audioPlayer.pause(800);
    };

    window._pauseAmbience = window._stopSystemAudio;

    window._restartSystemAudioForNewSession = function () {
        if (!window._isIntroComplete) return;
        window._isExternalAppRunning = false;
        window._isDoorpiFocused = true;
        window._audioPlayer.restartFromBeginning();
    };

    window.isDoorpiSessionTransitionActive = function () {
        return !!window._userSwitching || Date.now() < (window._doorpiSessionTransitionBlockUntil || 0);
    };

    document.addEventListener('keydown', (e) => {
        if (!window.isDoorpiSessionTransitionActive?.()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);

    document.addEventListener('click', (e) => {
        if (!window.isDoorpiSessionTransitionActive?.()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);

    document.addEventListener('pointerdown', (e) => {
        if (!window.isDoorpiSessionTransitionActive?.()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);

    window.DoorpiUiSound = (() => {
        // Ajustes centrais dos sons de UI.
        const uiSound = {
            masterGain: 0.65,
            space: {
                delay: 0.055,
                feedback: 0.10,
                lowpass: 2200,
                wet: 0.09,
            },
            move: {
                gain: 0.16,
                frequency: 300,
                endFrequency: 520,
                attack: 0.012,
            },
            confirm: {
                gain: 0.17,
                frequency: 330,
                endFrequency: 610,
                attack: 0.016,
            },
            back: {
                gain: 0.08,
                frequency: 320,
                endFrequency: 200,
                attack: 0.03,
                space: 0.16,
            },
        };

        let masterGain = null;
        let spaceInput = null;
        let spaceContext = null;
        let lastMoveAt = 0;
        let noiseBuffer = null;

        window.DoorpiUiSoundConfig = uiSound;

        function ctx() {
            return window._audioPlayer?.ctx || null;
        }

        function ensureMaster(context) {
            if (!masterGain) {
                masterGain = context.createGain();
                masterGain.gain.value = uiSound.masterGain;
                masterGain.connect(context.destination);
            }
            return masterGain;
        }

        function ensureSpace(context) {
            if (spaceInput && spaceContext === context) return spaceInput;

            spaceContext = context;
            spaceInput = context.createGain();
            const delay = context.createDelay(0.25);
            const feedback = context.createGain();
            const filter = context.createBiquadFilter();
            const wet = context.createGain();

            delay.delayTime.value = uiSound.space.delay;
            feedback.gain.value = uiSound.space.feedback;
            filter.type = 'lowpass';
            filter.frequency.value = uiSound.space.lowpass;
            filter.Q.value = 0.45;
            wet.gain.value = uiSound.space.wet;

            spaceInput.connect(delay);
            delay.connect(filter);
            filter.connect(wet);
            filter.connect(feedback);
            feedback.connect(delay);
            wet.connect(ensureMaster(context));

            return spaceInput;
        }

        function getNoiseBuffer(context) {
            if (noiseBuffer && noiseBuffer.sampleRate === context.sampleRate) return noiseBuffer;

            const length = Math.max(1, Math.floor(context.sampleRate * 0.18));
            noiseBuffer = context.createBuffer(1, length, context.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.28;
            }
            return noiseBuffer;
        }

        function playTone(context, at, frequency, duration, gainValue, options = {}) {
            const osc = context.createOscillator();
            const gain = context.createGain();
            const endFrequency = options.endFrequency ?? frequency;
            const attack = options.attack ?? 0.012;
            const type = options.type ?? 'sine';

            osc.type = type;
            osc.frequency.setValueAtTime(frequency, at);
            if (endFrequency !== frequency) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), at + duration);
            }
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime(gainValue, at + attack);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

            osc.connect(gain);
            gain.connect(ensureMaster(context));
            let send = null;
            if (options.space) {
                send = context.createGain();
                send.gain.value = options.space;
                gain.connect(send);
                send.connect(ensureSpace(context));
            }
            osc.start(at);
            osc.stop(at + duration + 0.05);
            osc.onended = () => {
                try { osc.disconnect(); } catch { }
                try { gain.disconnect(); } catch { }
                try { send?.disconnect(); } catch { }
            };
        }

        function playNoise(context, at, duration, gainValue, options = {}) {
            const source = context.createBufferSource();
            const filter = context.createBiquadFilter();
            const gain = context.createGain();
            const attack = options.attack ?? 0.004;

            source.buffer = getNoiseBuffer(context);
            filter.type = options.filterType ?? 'highpass';
            filter.frequency.setValueAtTime(options.frequency ?? 2600, at);
            filter.Q.value = options.q ?? 0.7;

            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime(gainValue, at + attack);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

            source.connect(filter);
            filter.connect(gain);
            gain.connect(ensureMaster(context));
            let send = null;
            if (options.space) {
                send = context.createGain();
                send.gain.value = options.space;
                gain.connect(send);
                send.connect(ensureSpace(context));
            }
            source.start(at);
            source.stop(at + duration + 0.05);
            source.onended = () => {
                try { source.disconnect(); } catch { }
                try { filter.disconnect(); } catch { }
                try { gain.disconnect(); } catch { }
                try { send?.disconnect(); } catch { }
            };
        }

        async function play(kind) {
            if (!window._isIntroComplete || window._isExternalAppRunning) return;
            const context = ctx();
            if (!context) return;

            if (kind === 'move') {
                const nowMs = performance.now();
                if (nowMs - lastMoveAt < 45) return;
                lastMoveAt = nowMs;
            }

            if (context.state === 'suspended') {
                try { await context.resume(); } catch { return; }
            }

            const now = context.currentTime;
            if (kind === 'confirm') {
                playTone(context, now + 0.002, uiSound.confirm.frequency, 0.16, uiSound.confirm.gain, {
                    endFrequency: uiSound.confirm.endFrequency,
                    attack: uiSound.confirm.attack,
                });
            } else if (kind === 'back') {
                playTone(context, now + 0.002, uiSound.back.frequency, 0.34, uiSound.back.gain, {
                    endFrequency: uiSound.back.endFrequency,
                    attack: uiSound.back.attack,
                    space: uiSound.back.space,
                });
            } else {
                playTone(context, now + 0.002, uiSound.move.frequency, 0.09, uiSound.move.gain, {
                    endFrequency: uiSound.move.endFrequency,
                    attack: uiSound.move.attack,
                });
            }
        }

        return { play };
    })();

    function _readDoorpiAudioMuteFlag(data, fallback = false) {
        if (!data) return !!fallback;
        if (data.shouldMuteDoorpiAudio !== undefined) return !!data.shouldMuteDoorpiAudio;
        if (data.hasLiveExternalSession !== undefined) return !!data.hasLiveExternalSession;
        if (data.hasPendingSession !== undefined) return !!data.hasPendingSession;
        if (data.hasBlockingSession !== undefined) return !!data.hasBlockingSession;
        if (data.appAlive !== undefined) return !!data.appAlive;
        return !!fallback;
    }

    window._syncSystemAudioFromRuntime = function (shouldMuteDoorpiAudio) {
        window._isExternalAppRunning = !!shouldMuteDoorpiAudio;
        if (!window._isDoorpiFocused) return;

        if (window._isExternalAppRunning) {
            window._stopSystemAudio();
        } else {
            window._startSystemAudio(true);
        }
    };

    // ── GATILHOS DE RETORNO DO ÁUDIO (Navegador) ────────────────────────
        document.addEventListener('keydown', (e) => {
        if (e.repeat && ['Enter', 'Escape', 'Backspace'].includes(e.key)) return;
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (window.isGlobalLoading) return;

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            window.DoorpiUiSound?.play('move');
        } else if (e.key === 'Enter') {
            window.DoorpiUiSound?.play('confirm');
        }
    }, true);

    window.addEventListener('focus', () => {
        window._isDoorpiFocused = true;
        window._startSystemAudio();

        const launchOverlay = document.getElementById('gameLaunchOverlay');
        if (launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('state-loading')) {
            const btn = document.getElementById('overlayCancelLaunchBtn');
            if (btn && btn.style.display !== 'none') {
                btn.focus();
            }
        }
    });

    window.addEventListener('blur', () => {
        window._isDoorpiFocused = false;
        const btn = document.getElementById('overlayCancelLaunchBtn');
        if (btn && document.activeElement === btn) {
            btn.blur();
        }

        window._stopSystemAudio();
    });

    // Trava da Intro
    function setupIntroCompleteHook() {
        const onIntroComplete = () => {
            if (!window._isIntroComplete) {
                window._isIntroComplete = true;
                window._startSystemAudio();
            }
        };

        if (window.DoorpiIntro && typeof window.DoorpiIntro.runAfterIntro === 'function') {
            window.DoorpiIntro.runAfterIntro(onIntroComplete);
        } else {
            let _intro = window.DoorpiIntro;
            Object.defineProperty(window, 'DoorpiIntro', {
                get: () => _intro,
                set: (val) => {
                    _intro = val;
                    if (val && typeof val.runAfterIntro === 'function') {
                        val.runAfterIntro(onIntroComplete);
                    }
                },
                configurable: true
            });
        }
    }
    setupIntroCompleteHook();

    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'doorpi:intro:complete') {
            if (!window._isIntroComplete) {
                window._isIntroComplete = true;
                window._startSystemAudio();
            }
        }
    });


    window._stopSystemAudio = function () {
        window._audioPlayer.pause(800);
    };

    window._pauseAmbience = window._stopSystemAudio;

    // ── OUVINTES DE FOCO DO NAVEGADOR ─────────────────────────────────────
    window.addEventListener('focus', () => {
        window.isDoorpiFocused = true;
        window._startSystemAudio();

        // Devolve o foco para o botão de cancelar se estiver na tela de loading do overlay
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        if (launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('state-loading')) {
            const btn = document.getElementById('overlayCancelLaunchBtn');
            if (btn && btn.style.display !== 'none') {
                btn.focus();
            }
        }
    });

    window.addEventListener('blur', () => {
        window.isDoorpiFocused = false;
        const btn = document.getElementById('overlayCancelLaunchBtn');
        if (btn) {
            btn.blur();
        }
        window._stopSystemAudio();
    });

    // Remove as propriedades complexas antigas (isMediaAppActive anterior)
    window.isMediaAppActive = false;

    window.DoorpiRuntimeState = {
        running: []
    };
    window._currentWebAppConflictEntry = null;
    window._lastExecutionLockData = null;
    window._executionLockRequestUntil = 0;
    window._executionOverlayCloseTimer = 0;
    window._executionOverlayRefreshTimer = 0;
    window._executionOverlayVisualKey = '';

    function _clearExecutionOverlayCloseTimer() {
        if (window._executionOverlayCloseTimer) {
            clearTimeout(window._executionOverlayCloseTimer);
            window._executionOverlayCloseTimer = 0;
        }
    }

    function _stopExecutionOverlayRefreshLoop() {
        if (window._executionOverlayRefreshTimer) {
            clearInterval(window._executionOverlayRefreshTimer);
            window._executionOverlayRefreshTimer = 0;
        }
    }

    function _bestExecutionLockDataFromRuntime() {
        const candidates = _nonMinimizedRuntimeEntries();
        if (!candidates.length) return null;
        const candidate = candidates
            .slice()
            .sort((a, b) => _runtimeEntryPriority(b) - _runtimeEntryPriority(a))[0];
        return _buildExecutionLockDataFromRuntimeEntry(candidate);
    }

    function _executionStoreGameVisualPair(lockData) {
        if (!lockData) return null;
        const lockIsGame = lockData.channel === 'games' || lockData.kind === 'game';
        if (!lockIsGame) return null;

        const entries = Array.isArray(window.DoorpiRuntimeState?.running) ? window.DoorpiRuntimeState.running : [];
        const gameEntries = entries.filter(e => e && (e.channel === 'games' || e.kind === 'game'));
        const storeEntries = entries.filter(e => e && (e.channel === 'stores' || e.kind === 'store'));
        if (!gameEntries.length || !storeEntries.length) return null;

        const bestGame = gameEntries.slice().sort((a, b) => _runtimeEntryPriority(b) - _runtimeEntryPriority(a))[0];
        const bestStore = storeEntries.slice().sort((a, b) => _runtimeEntryPriority(b) - _runtimeEntryPriority(a))[0];
        const gameVisual = _buildExecutionLockDataFromRuntimeEntry(bestGame) || {};
        const storeVisual = _buildExecutionLockDataFromRuntimeEntry(bestStore) || {};

        const game = {
            name: gameVisual.name || lockData.name || 'Jogo',
            image: gameVisual.gridImage || gameVisual.heroImage || lockData.gridImage || lockData.heroImage || ''
        };
        const store = {
            name: storeVisual.name || 'Loja',
            image: storeVisual.gridImage || storeVisual.heroImage || ''
        };
        return { game, store };
    }

    function _executionOverlayVisualKeyFor(lockData) {
        const base = [
            lockData?.kind || '',
            lockData?.channel || '',
            lockData?.id || '',
            lockData?.url || '',
            lockData?.appType || '',
            lockData?.name || '',
            lockData?.heroImage || '',
            lockData?.gridImage || ''
        ].join('|');
        const pair = _executionStoreGameVisualPair(lockData);
        if (!pair) return `${base}|pair:none`;
        const pairSig = [
            pair.store?.name || '',
            pair.store?.image || '',
            pair.game?.name || '',
            pair.game?.image || ''
        ].join('|');
        return `${base}|pair:${pairSig}`;
    }

    function _executionTargetKey(data) {
        if (!data) return '';
        if (data.url) return `url:${data.url}`;
        if (data.id) return `id:${data.id}`;
        return '';
    }

    function _refreshExecutionOverlayFromRuntime() {
        if (!_isExecutionOverlayVisible()) return false;
        if (!_hasAnyRuntimeSession()) return false;

        const current = window._lastExecutionLockData || {};
        const best = _bestExecutionLockDataFromRuntime();
        let hydrated = null;

        if (best && (best.id || best.url)) {
            hydrated = _hydrateExecutionLockPayload(best);
        } else {
            hydrated = _hydrateExecutionLockPayload(current);
        }

        if (!(hydrated.id || hydrated.url)) return false;

        const prev = window._lastExecutionLockData || {};
        const prevTargetKey = _executionTargetKey(prev);
        const hydratedTargetKey = _executionTargetKey(hydrated);
        const isSameTarget = !!prevTargetKey && !!hydratedTargetKey && prevTargetKey === hydratedTargetKey;

        const next = {
            kind: hydrated.kind || '',
            channel: hydrated.channel || '',
            id: hydrated.id || '',
            url: hydrated.url || '',
            appType: hydrated.appType || '',
            name: hydrated.name || (isSameTarget ? (prev.name || '') : ''),
            heroImage: hydrated.heroImage || (isSameTarget ? (prev.heroImage || '') : ''),
            gridImage: hydrated.gridImage || (isSameTarget ? (prev.gridImage || '') : '')
        };
        const changed =
            (prev.kind || '') !== next.kind ||
            (prev.channel || '') !== next.channel ||
            (prev.id || '') !== next.id ||
            (prev.url || '') !== next.url ||
            (prev.appType || '') !== next.appType ||
            (prev.name || '') !== next.name ||
            (prev.heroImage || '') !== next.heroImage ||
            (prev.gridImage || '') !== next.gridImage;

        const nextVisualKey = _executionOverlayVisualKeyFor(next);
        if (!changed && nextVisualKey === (window._executionOverlayVisualKey || '')) return false;

        window._lastExecutionLockData = next;
        window._executionOverlayVisualKey = nextVisualKey;
        GameLaunchOverlay.showExecutionLock(next);
        return true;
    }

    function _ensureExecutionOverlayRefreshLoop() {
        if (window._executionOverlayRefreshTimer) return;
        window._executionOverlayRefreshTimer = setInterval(() => {
            if (!_hasAnyRuntimeSession()) return;
            if (!_isExecutionOverlayVisible()) return;
            _refreshExecutionOverlayFromRuntime();
        }, 260);
    }

    function _runtimeCardKey(card) {
        if (!card) return '';
        return card.dataset.gameId || card.dataset.appUrl || card.dataset.appId || card.dataset.id || '';
    }

    function _runtimeEntryMatchesCard(entry, card) {
        if (!entry || !card) return false;
        const gameId = card.dataset.gameId || '';
        const appId = card.dataset.appId || '';
        const appUrl = card.dataset.appUrl || '';
        return (!!entry.id && (entry.id === gameId || entry.id === appId || entry.id === card.dataset.id)) ||
            (!!entry.url && entry.url === appUrl);
    }

    function _runtimeEntryForCard(card) {
        return (window.DoorpiRuntimeState?.running || []).find(entry => _runtimeEntryMatchesCard(entry, card));
    }

    window.isCardRuntimeRunning = function isCardRuntimeRunning(card) {
        return !!_runtimeEntryForCard(card);
    };

    window.applyRuntimeStateToCard = function applyRuntimeStateToCard(card) {
        if (!card || card.classList.contains('add-card')) return;

        const entry = _runtimeEntryForCard(card);
        const isRunning = !!entry;
        card.classList.toggle('is-running', isRunning);
        card.dataset.runtimeStatus = isRunning ? (entry.status || 'running') : '';

        let top = card.querySelector('.runtime-badge-top');
        let bottom = card.querySelector('.runtime-badge-bottom');

        if (isRunning) {
            if (!top) {
                top = document.createElement('div');
                top.className = 'runtime-badge-top';
                card.appendChild(top);
            }
            if (!bottom) {
                bottom = document.createElement('div');
                bottom.className = 'runtime-badge-bottom';
                card.appendChild(bottom);
            }

            top.textContent = typeof t === 'function' ? t('runningLabel') : 'Em execução';
            bottom.textContent = typeof t === 'function' ? t('resumeLabel') : 'Retomar';
        } else {
            top?.remove();
            bottom?.remove();
        }
    };

    function refreshRuntimeCards() {

        document.querySelectorAll('.card:not(.add-card), .nav-vertical-card').forEach(card => window.applyRuntimeStateToCard(card));
    }

    function _escapeForSelector(value) {
        const raw = String(value ?? '');
        if (!raw) return '';
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(raw);
        return raw.replace(/["\\]/g, '\\$&');
    }

    function _runtimeCardFromEntry(entry) {
        if (!entry) return null;
        const selectors = [];
        if (entry.id) {
            const sid = _escapeForSelector(entry.id);
            selectors.push(`.card[data-game-id="${sid}"]`, `.card[data-app-id="${sid}"]`, `.nav-vertical-card[data-game-id="${sid}"]`, `.nav-vertical-card[data-app-id="${sid}"]`);
        }
        if (entry.url) {
            const surl = _escapeForSelector(entry.url);
            selectors.push(`.card[data-app-url="${surl}"]`, `.nav-vertical-card[data-app-url="${surl}"]`);
        }
        for (const selector of selectors) {
            const card = document.querySelector(selector);
            if (card) return card;
        }
        return null;
    }

    function _runtimeEntryPriority(entry) {
        if (!entry) return -9999;
        let score = 0;
        if (entry.status === 'active') score += 120;
        else if (entry.status === 'running') score += 80;
        else if (entry.status === 'minimized') score -= 40;

        if (entry.channel === 'games') score += 300;
        else if (entry.channel === 'stores') score += 180;
        else if (entry.channel === 'media') score += 120;

        if (entry.kind === 'game') score += 120;
        else if (entry.kind === 'store') score += 80;
        else if (entry.kind === 'exe') score += 60;
        else if (entry.kind === 'web') score += 40;
        return score;
    }

    function _buildExecutionLockDataFromRuntimeEntry(entry) {
        if (!entry) return null;
        const card = _runtimeCardFromEntry(entry);
        const nameFromCard = card?.querySelector('.title, .nav-vertical-card-title')?.textContent?.trim() || '';
        const cardImg = card?.querySelector('img')?.getAttribute('src') || '';
        const isExecutableMedia = entry.channel === 'media' && entry.kind === 'exe';
        const resolvedId = entry.id || (isExecutableMedia ? '' : (card?.dataset?.gameId || card?.dataset?.appId || ''));
        const resolvedUrl = entry.url || card?.dataset?.appUrl || '';
        const name =
            nameFromCard ||
            entry.name ||
            (entry.channel === 'games' ? 'Jogo em execução'
                : entry.channel === 'stores' ? 'Loja em execução'
                    : 'Sessão em execução');

        // Sem alvo acionável (id/url), não promovemos para evitar overlay "órfão".
        if (!resolvedId && !resolvedUrl) return null;

        return {
            kind: entry.kind || '',
            channel: entry.channel || '',
            id: resolvedId,
            url: resolvedUrl,
            appType: entry.channel === 'games' ? 'game' : (entry.kind || ''),
            name,
            heroImage: card?.dataset?.staticHero || card?.dataset?.hero || entry.heroImage || '',
            gridImage: card?.dataset?.staticVertical || card?.dataset?.vertical || card?.dataset?.staticHorizontal || card?.dataset?.horizontal || entry.gridImage || cardImg || ''
        };
    }

    function _nonMinimizedRuntimeEntries() {
        return (Array.isArray(window.DoorpiRuntimeState?.running) ? window.DoorpiRuntimeState.running : [])
            .filter(entry => entry && entry.status !== 'minimized' && entry.status !== 'launching');
    }

    function _findRuntimeEntryForLockTarget(target) {
        const entries = _nonMinimizedRuntimeEntries();
        if (!entries.length) return null;

        const byId = entries.find(entry => target.id && entry.id && entry.id === target.id);
        if (byId) return byId;

        const byUrl = entries.find(entry => target.url && entry.url && entry.url === target.url);
        if (byUrl) return byUrl;

        const byKindAndChannel = entries.find(entry =>
            (!target.kind || entry.kind === target.kind) &&
            (!target.channel || entry.channel === target.channel));
        if (byKindAndChannel) return byKindAndChannel;

        return entries
            .slice()
            .sort((a, b) => _runtimeEntryPriority(b) - _runtimeEntryPriority(a))[0] || null;
    }

    function _hydrateExecutionLockPayload(raw) {
        const payload = {
            kind: raw.kind || '',
            channel: raw.channel || '',
            id: raw.id || '',
            url: raw.url || '',
            appType: raw.appType || '',
            name: raw.name || raw.gameName || '',
            heroImage: raw.heroImage || '',
            gridImage: raw.gridImage || ''
        };
        const fallbackName =
            payload.kind === 'game' || payload.channel === 'games' ? 'Jogo em execução' :
                payload.kind === 'store' || payload.channel === 'stores' ? 'Loja em execução' :
                    'Sessão em execução';

        const needsVisualContext = !payload.name || (!payload.heroImage && !payload.gridImage);
        if (!needsVisualContext) return payload;

        const matchedEntry = _findRuntimeEntryForLockTarget(payload);
        const fromRuntime = _buildExecutionLockDataFromRuntimeEntry(matchedEntry);
        if (!fromRuntime) {
            if (!payload.name) payload.name = fallbackName;
            return payload;
        }

        return {
            kind: payload.kind || fromRuntime.kind || '',
            channel: payload.channel || fromRuntime.channel || '',
            id: payload.id || fromRuntime.id || '',
            url: payload.url || fromRuntime.url || '',
            appType: payload.appType || fromRuntime.appType || '',
            name: payload.name || fromRuntime.name || fallbackName,
            heroImage: payload.heroImage || fromRuntime.heroImage || '',
            gridImage: payload.gridImage || fromRuntime.gridImage || ''
        };
    }

    function _tryPromoteRuntimeToExecutionLock(force = false) {
        if (typeof postToHost !== 'function') return false;
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        if (!launchOverlay) return false;
        if (!force && launchOverlay.classList.contains('execution-lock-visible')) return false;
        if (Date.now() < (window._executionLockRequestUntil || 0)) return false;

        const candidates = _nonMinimizedRuntimeEntries();
        if (!candidates.length) return false;

        const candidate = candidates
            .slice()
            .sort((a, b) => _runtimeEntryPriority(b) - _runtimeEntryPriority(a))[0];
        let data = _buildExecutionLockDataFromRuntimeEntry(candidate);
        if (!data || (!data.name && !data.id && !data.url)) return false;

        window._executionLockRequestUntil = Date.now() + 220;
        postToHost({
            action: 'requestExecutionLockFromRuntime',
            kind: data.kind || '',
            channel: data.channel || '',
            id: data.id || '',
            url: data.url || ''
        });
        return true;
    }

    function _hasAnyRuntimeSession() {
        return _nonMinimizedRuntimeEntries().length > 0;
    }

    function _hasActiveGameRuntimeSession() {
        return _nonMinimizedRuntimeEntries().some(entry =>
            entry &&
            (entry.channel === 'games' || entry.kind === 'game') &&
            (entry.status === 'running' || entry.status === 'active'));
    }

    function _shouldKeepExecutionOverlay() {
        if (Date.now() < (window._doorpiOfficialReturnSuppressUntil || 0)) return false;
        return _hasAnyRuntimeSession();
    }

    function _ensureExecutionOverlayForActiveSession() {
        if (typeof GameLaunchOverlay === 'undefined') return false;
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        const isVisibleExecution = !!(launchOverlay &&
            launchOverlay.classList.contains('visible') &&
            launchOverlay.classList.contains('execution-lock-visible'));
        if (isVisibleExecution) {
            if (!_hasAnyRuntimeSession()) {
                GameLaunchOverlay.hide();
                return false;
            }
            return _tryPromoteRuntimeToExecutionLock(true);
        }
        return _tryPromoteRuntimeToExecutionLock();
    }

    function _isExecutionOverlayVisible() {
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        return !!(launchOverlay &&
            launchOverlay.classList.contains('visible') &&
            launchOverlay.classList.contains('execution-lock-visible'));
    }

    function _isWaitingForValidGameWindowOverlayVisible() {
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        if (!launchOverlay) return false;
        if (!launchOverlay.classList.contains('visible')) return false;
        if (!launchOverlay.classList.contains('state-loading')) return false;
        // A tela "aguardando janela do jogo" só aparece quando o botão de cancelar já foi liberado.
        const cancelBtn = document.getElementById('overlayCancelLaunchBtn');
        return !!(cancelBtn && cancelBtn.style.display !== 'none');
    }

    function _isAnyLaunchLoadingOverlayVisible() {
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        if (!launchOverlay) return false;
        if (!launchOverlay.classList.contains('visible')) return false;
        if (launchOverlay.classList.contains('execution-lock-visible')) return false;
        return launchOverlay.classList.contains('state-loading');
    }

    function _resolveRuntimeEntryName(entry) {
        if (!entry) return '';
        if (entry.name) return entry.name;
        const card = _runtimeCardFromEntry(entry);
        return card?.querySelector('.title, .nav-vertical-card-title')?.textContent?.trim() || '';
    }

    function _buildClosePayloadFromRuntimeEntry(entry) {
        if (!entry) return null;
        const kind = (entry.kind || '').toLowerCase();
        const appType = kind === 'web' ? 'webview'
            : kind === 'store' ? 'store'
                : kind === 'game' ? 'game'
                    : 'exe';
        return {
            id: entry.id || '',
            url: entry.url || '',
            channel: entry.channel || '',
            appType
        };
    }

    function _findSessionConflictEntry(item, launchId) {
        const entries = Array.isArray(window.DoorpiRuntimeState?.running) ? window.DoorpiRuntimeState.running : [];
        const channel = (item?.channel || '').toLowerCase();
        const appType = (item?.appType || '').toLowerCase();

        if (channel === 'games') {
            return entries.find(e =>
                (e.channel === 'games' || e.kind === 'game') &&
                !!e.id &&
                e.id !== item.id
            ) || null;
        }

        if (channel === 'stores') {
            return entries.find(e =>
                (e.channel === 'stores' || e.kind === 'store') &&
                !!e.id &&
                e.id !== item.id
            ) || null;
        }

        if (channel === 'media') {
            if (appType === 'webview' || appType === 'browser') {
                const runningWeb = entries.find(e =>
                    e.channel === 'media' &&
                    e.kind === 'web' &&
                    ((!!e.url && e.url !== launchId) || !e.url)
                );
                if (runningWeb) return runningWeb;

                const rememberedWeb = window._currentWebAppConflictEntry;
                if (rememberedWeb &&
                    rememberedWeb.channel === 'media' &&
                    rememberedWeb.kind === 'web' &&
                    rememberedWeb.url !== launchId) {
                    return rememberedWeb;
                }

                return null;
            }

            if (appType === 'exe') {
                return entries.find(e =>
                    e.channel === 'media' &&
                    e.kind === 'exe' &&
                    !!e.url &&
                    e.url !== launchId
                ) || null;
            }
        }

        return null;
    }

    let _sessionConflictOverlay = null;
    let _sessionConflictClosePayload = null;
    let _sessionConflictReturnFocusEl = null;

    function _ensureSessionConflictOverlay() {
        if (_sessionConflictOverlay) return _sessionConflictOverlay;

        const style = document.createElement('style');
        style.textContent = `
            #sessionConflictOverlay {
                position: fixed;
                inset: 0;
                z-index: 13500;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 48px;
                background:
                    radial-gradient(circle at 50% 48%, rgba(255,255,255,0.07), transparent 28%),
                    rgba(2, 3, 9, 0.82);
                backdrop-filter: blur(18px) saturate(1.2);
                -webkit-backdrop-filter: blur(18px) saturate(1.2);
            }
            #sessionConflictOverlay.visible { display: flex; }
            #sessionConflictCard {
                width: min(720px, 92vw);
                min-height: 228px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,.14);
                background:
                    linear-gradient(180deg, rgba(18,20,34,.92), rgba(7,8,16,.96)),
                    rgba(8,9,18,.96);
                box-shadow: 0 34px 90px rgba(0,0,0,.68), inset 0 1px 0 rgba(255,255,255,.08);
                padding: 0;
                display: flex;
                overflow: hidden;
                color: #fff;
                transform: translateY(8px) scale(.985);
                opacity: 0;
                transition: transform .22s cubic-bezier(.22,1,.36,1), opacity .18s ease;
            }
            #sessionConflictOverlay.visible #sessionConflictCard {
                transform: translateY(0) scale(1);
                opacity: 1;
            }
            #sessionConflictAccent {
                width: 4px;
                flex: 0 0 4px;
                background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.16));
                box-shadow: 0 0 24px rgba(255,255,255,.22);
            }
            #sessionConflictBody {
                min-width: 0;
                flex: 1;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                grid-template-rows: auto 1fr auto;
                column-gap: 28px;
                row-gap: 14px;
                padding: 28px 30px 24px 32px;
            }
            #sessionConflictKicker {
                grid-column: 1 / -1;
                display: inline-flex;
                align-items: center;
                width: fit-content;
                color: rgba(255,255,255,.48);
                font-family: 'Outfit', sans-serif;
                font-size: .72rem;
                font-weight: 800;
                letter-spacing: .14em;
                line-height: 1;
                text-transform: uppercase;
            }
            #sessionConflictCopy {
                min-width: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 10px;
            }
            #sessionConflictTitle {
                margin: 0;
                color: #fff;
                font-family: 'Outfit', sans-serif;
                font-size: 1.42rem;
                font-weight: 700;
                line-height: 1.08;
                letter-spacing: 0;
            }
            #sessionConflictMessage {
                margin: 0;
                max-width: 46ch;
                color: rgba(255,255,255,.64);
                font-family: 'Outfit', sans-serif;
                font-size: .98rem;
                font-weight: 500;
                line-height: 1.46;
                letter-spacing: 0;
            }
            #sessionConflictHint {
                margin: 2px 0 0;
                color: rgba(255,255,255,.36);
                font-family: 'Outfit', sans-serif;
                font-size: .8rem;
                font-weight: 600;
                line-height: 1.35;
                letter-spacing: 0;
            }
            #sessionConflictActions {
                grid-row: 2 / 4;
                grid-column: 2;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: stretch;
                gap: 10px;
                width: 212px;
                pointer-events: all;
            }
            #sessionConflictActions .conflict-action {
                position: relative;
                min-width: 0;
                width: 100%;
                min-height: 54px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,.14);
                border-bottom-color: rgba(0,0,0,.38);
                background: rgba(255,255,255,.055);
                color: rgba(255,255,255,.76);
                font-family: 'Outfit', sans-serif;
                font-size: .95rem;
                font-weight: 800;
                line-height: 1;
                letter-spacing: 0;
                padding: 0 16px;
                outline: none;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: flex-start;
                gap: 10px;
                white-space: nowrap;
                overflow: hidden;
                transition: transform .16s ease, background .16s ease, color .16s ease, border-color .16s ease, box-shadow .16s ease;
            }
            #sessionConflictActions .conflict-action .action-text {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #sessionConflictActions .conflict-action.primary {
                background: #fff;
                color: #060714;
                border-color: #fff;
                box-shadow: 0 14px 34px rgba(255,255,255,.17);
            }
            #sessionConflictActions .conflict-action.secondary {
                color: rgba(255,255,255,.58);
                border-color: rgba(255,255,255,.10);
                background: rgba(255,255,255,.035);
            }
            #sessionConflictActions .conflict-action:focus,
            #sessionConflictActions .conflict-action:hover {
                transform: translateY(-2px);
                box-shadow: 0 18px 42px rgba(255,255,255,.20), 0 0 0 2px rgba(255,255,255,.12);
            }
            #sessionConflictActions .conflict-action.secondary:focus,
            #sessionConflictActions .conflict-action.secondary:hover {
                background: rgba(255,255,255,.08);
                border-color: rgba(255,255,255,.22);
                color: #fff;
            }
            @media (max-width: 760px) {
                #sessionConflictOverlay {
                    padding: 20px;
                    align-items: flex-end;
                }
                #sessionConflictCard {
                    width: 100%;
                    min-height: 0;
                }
                #sessionConflictBody {
                    grid-template-columns: 1fr;
                    row-gap: 18px;
                    padding: 24px 22px 22px;
                }
                #sessionConflictActions {
                    grid-row: auto;
                    grid-column: 1;
                    width: 100%;
                    flex-direction: row;
                }
                #sessionConflictActions .conflict-action {
                    justify-content: center;
                    flex: 1 1 0;
                    min-height: 50px;
                }
            }
            @media (max-width: 440px) {
                #sessionConflictActions {
                    flex-direction: column;
                }
            }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'sessionConflictOverlay';
        overlay.innerHTML = `
            <div id="sessionConflictCard" role="dialog" aria-modal="true" aria-label="Conflito de sessão">
                <div id="sessionConflictAccent" aria-hidden="true"></div>
                <div id="sessionConflictBody">
                    <div id="sessionConflictKicker">Sessão ativa</div>
                    <div id="sessionConflictCopy">
                        <h3 id="sessionConflictTitle">Sessão em andamento</h3>
                        <p id="sessionConflictMessage">Uma sessão já está ativa. Encerre a sessão atual para iniciar outra.</p>
                        <p id="sessionConflictHint">O Doorpi mantém uma sessão por vez para evitar sobreposição de janelas.</p>
                    </div>
                    <div id="sessionConflictActions">
                        <button id="sessionConflictClose" class="conflict-action primary" type="button" tabindex="0">
                            <span class="action-text">Encerrar</span>
                        </button>
                        <button id="sessionConflictCancel" class="conflict-action secondary" type="button" tabindex="0">
                            <span class="action-text">Cancelar</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector('#sessionConflictCancel');
        const closeBtn = overlay.querySelector('#sessionConflictClose');

        cancelBtn?.addEventListener('click', () => {
            window.hideSessionConflictPopup?.(true);
        });
        closeBtn?.addEventListener('click', () => {
            const payload = _sessionConflictClosePayload;
            window.hideSessionConflictPopup?.(true);
            if (payload) {
                postToHost({
                    action: 'closeRunningItem',
                    id: payload.id || '',
                    url: payload.url || '',
                    channel: payload.channel || '',
                    appType: payload.appType || ''
                });
            }
        });

        _sessionConflictOverlay = overlay;
        return overlay;
    }

    window.isSessionConflictPopupOpen = function () {
        return !!(_sessionConflictOverlay && _sessionConflictOverlay.classList.contains('visible'));
    };

    window.getSessionConflictPopupItems = function () {
        if (!window.isSessionConflictPopupOpen()) return [];
        return Array.from(_sessionConflictOverlay.querySelectorAll('#sessionConflictActions button'))
            .filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);
    };

    window.hideSessionConflictPopup = function (restoreFocus = true) {
        if (!_sessionConflictOverlay) return;
        _sessionConflictOverlay.classList.remove('visible');
        _sessionConflictClosePayload = null;
        if (restoreFocus) {
            const target = _sessionConflictReturnFocusEl;
            _sessionConflictReturnFocusEl = null;
            setTimeout(() => {
                if (target && document.contains(target) && typeof target.focus === 'function') {
                    target.focus();
                } else {
                    recoverGlobalFocus?.();
                }
            }, 0);
        } else {
            _sessionConflictReturnFocusEl = null;
        }
    };

    window.showSessionConflictPopup = function ({ closePayload, runningName } = {}) {
        const overlay = _ensureSessionConflictOverlay();
        const wasVisible = overlay.classList.contains('visible');
        _sessionConflictClosePayload = closePayload || null;
        if (!wasVisible) {
            _sessionConflictReturnFocusEl = document.activeElement;
        }

        const kickerEl = overlay.querySelector('#sessionConflictKicker');
        const titleEl = overlay.querySelector('#sessionConflictTitle');
        const messageEl = overlay.querySelector('#sessionConflictMessage');
        const hintEl = overlay.querySelector('#sessionConflictHint');
        const cancelBtn = overlay.querySelector('#sessionConflictCancel');
        const closeBtn = overlay.querySelector('#sessionConflictClose');

        const titleText = typeof t === 'function' ? t('sessionConflictTitle') : 'Processo/Jogo em andamento';
        const fallbackName = typeof t === 'function' ? t('sessionConflictCurrent') : 'atual';
        const baseMessage = typeof t === 'function' ? t('sessionConflictMessage') : 'Deseja encerrar o processo/jogo {name}?';
        const resolvedName = runningName || fallbackName;
        const messageText = baseMessage.replace('{name}', resolvedName);

        if (kickerEl) kickerEl.textContent = typeof t === 'function' ? t('sessionConflictKicker') : 'Sessão ativa';
        if (titleEl) titleEl.textContent = titleText;
        if (messageEl) messageEl.textContent = messageText;
        if (hintEl) hintEl.textContent = typeof t === 'function' ? t('sessionConflictHint') : 'O Doorpi mantém uma sessão por vez para evitar sobreposição de janelas.';
        if (cancelBtn) {
            const textEl = cancelBtn.querySelector('.action-text');
            if (textEl) textEl.textContent = typeof t === 'function' ? t('sessionConflictCancel') : 'Cancelar';
        }
        if (closeBtn) {
            const textEl = closeBtn.querySelector('.action-text');
            if (textEl) textEl.textContent = typeof t === 'function' ? t('sessionConflictClose') : 'Encerrar';
        }

        overlay.classList.add('visible');
        if (!wasVisible) {
            setTimeout(() => {
                closeBtn?.focus();
                if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
            }, 0);
        }
    };

    window._handleSessionConflictFromLaunch = function (item, launchId) {
        const entry = _findSessionConflictEntry(item, launchId);
        if (!entry) return false;
        window.showSessionConflictPopup?.({
            closePayload: _buildClosePayloadFromRuntimeEntry(entry),
            runningName: _resolveRuntimeEntryName(entry)
        });
        return true;
    };

    let _gameFocusFallbackOverlay = null;
    let _gameFocusFallbackPayload = null;
    let _gameFocusFallbackReturnFocusEl = null;

    function _ensureGameFocusFallbackOverlay() {
        if (_gameFocusFallbackOverlay) return _gameFocusFallbackOverlay;

        const style = document.createElement('style');
        style.textContent = `
            #gameFocusFallbackOverlay {
                position: fixed;
                inset: 0;
                z-index: 13600;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 48px;
                background:
                    radial-gradient(circle at 50% 48%, rgba(255,255,255,0.08), transparent 28%),
                    rgba(2, 3, 9, 0.82);
                backdrop-filter: blur(18px) saturate(1.2);
                -webkit-backdrop-filter: blur(18px) saturate(1.2);
            }
            #gameFocusFallbackOverlay.visible { display: flex; }
            #gameFocusFallbackCard {
                width: min(720px, 92vw);
                min-height: 228px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,.14);
                background:
                    linear-gradient(180deg, rgba(18,20,34,.92), rgba(7,8,16,.96)),
                    rgba(8,9,18,.96);
                box-shadow: 0 34px 90px rgba(0,0,0,.68), inset 0 1px 0 rgba(255,255,255,.08);
                padding: 0;
                display: flex;
                overflow: hidden;
                color: #fff;
                transform: translateY(8px) scale(.985);
                opacity: 0;
                transition: transform .22s cubic-bezier(.22,1,.36,1), opacity .18s ease;
            }
            #gameFocusFallbackOverlay.visible #gameFocusFallbackCard {
                transform: translateY(0) scale(1);
                opacity: 1;
            }
            #gameFocusFallbackAccent {
                width: 4px;
                flex: 0 0 4px;
                background: linear-gradient(180deg, #ffffff, rgba(255,255,255,.18));
                box-shadow: 0 0 24px rgba(255,255,255,.28);
            }
            #gameFocusFallbackBody {
                min-width: 0;
                flex: 1;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                grid-template-rows: auto 1fr auto;
                column-gap: 28px;
                row-gap: 14px;
                padding: 28px 30px 24px 32px;
            }
            #gameFocusFallbackKicker {
                grid-column: 1 / -1;
                display: inline-flex;
                align-items: center;
                width: fit-content;
                color: rgba(255,255,255,.48);
                font-family: 'Outfit', sans-serif;
                font-size: .72rem;
                font-weight: 800;
                letter-spacing: .14em;
                line-height: 1;
                text-transform: uppercase;
            }
            #gameFocusFallbackCopy {
                min-width: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 10px;
            }
            #gameFocusFallbackTitle {
                margin: 0;
                color: #fff;
                font-family: 'Outfit', sans-serif;
                font-size: 1.42rem;
                font-weight: 700;
                line-height: 1.08;
                letter-spacing: 0;
            }
            #gameFocusFallbackMessage {
                margin: 0;
                max-width: 46ch;
                color: rgba(255,255,255,.64);
                font-family: 'Outfit', sans-serif;
                font-size: .98rem;
                font-weight: 500;
                line-height: 1.46;
                letter-spacing: 0;
            }
            #gameFocusFallbackHint {
                margin: 2px 0 0;
                color: rgba(255,255,255,.36);
                font-family: 'Outfit', sans-serif;
                font-size: .8rem;
                font-weight: 600;
                line-height: 1.35;
                letter-spacing: 0;
            }
            #gameFocusFallbackActions {
                grid-row: 2 / 4;
                grid-column: 2;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: stretch;
                gap: 10px;
                width: 212px;
                pointer-events: all;
            }
            #gameFocusFallbackActions .fallback-action {
                position: relative;
                min-width: 0;
                width: 100%;
                min-height: 54px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,.14);
                border-bottom-color: rgba(0,0,0,.38);
                background: rgba(255,255,255,.055);
                color: rgba(255,255,255,.76);
                font-family: 'Outfit', sans-serif;
                font-size: .95rem;
                font-weight: 800;
                line-height: 1;
                letter-spacing: 0;
                padding: 0 16px;
                outline: none;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: flex-start;
                gap: 10px;
                white-space: nowrap;
                overflow: hidden;
                transition: transform .16s ease, background .16s ease, color .16s ease, border-color .16s ease, box-shadow .16s ease;
            }
            #gameFocusFallbackActions .fallback-action .action-text {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #gameFocusFallbackActions .fallback-action.primary {
                background: #fff;
                color: #060714;
                border-color: #fff;
                box-shadow: 0 14px 34px rgba(255,255,255,.17);
            }
            #gameFocusFallbackActions .fallback-action.secondary {
                color: rgba(255,255,255,.58);
                border-color: rgba(255,255,255,.10);
                background: rgba(255,255,255,.035);
            }
            #gameFocusFallbackActions .fallback-action:focus,
            #gameFocusFallbackActions .fallback-action:hover {
                transform: translateY(-2px);
                box-shadow: 0 18px 42px rgba(255,255,255,.20), 0 0 0 2px rgba(255,255,255,.12);
            }
            #gameFocusFallbackActions .fallback-action.secondary:focus,
            #gameFocusFallbackActions .fallback-action.secondary:hover {
                background: rgba(255,255,255,.08);
                border-color: rgba(255,255,255,.22);
                color: #fff;
            }
            @media (max-width: 760px) {
                #gameFocusFallbackOverlay {
                    padding: 20px;
                    align-items: flex-end;
                }
                #gameFocusFallbackCard {
                    width: 100%;
                    min-height: 0;
                }
                #gameFocusFallbackBody {
                    grid-template-columns: 1fr;
                    row-gap: 18px;
                    padding: 24px 22px 22px;
                }
                #gameFocusFallbackActions {
                    grid-row: auto;
                    grid-column: 1;
                    width: 100%;
                    flex-direction: row;
                }
                #gameFocusFallbackActions .fallback-action {
                    justify-content: center;
                    flex: 1 1 0;
                    min-height: 50px;
                }
            }
            @media (max-width: 440px) {
                #gameFocusFallbackActions {
                    flex-direction: column;
                }
            }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'gameFocusFallbackOverlay';
        overlay.innerHTML = `
            <div id="gameFocusFallbackCard" role="dialog" aria-modal="true" aria-label="Restauracao manual">
                <div id="gameFocusFallbackAccent" aria-hidden="true"></div>
                <div id="gameFocusFallbackBody">
                    <div id="gameFocusFallbackKicker">Foco da janela</div>
                    <div id="gameFocusFallbackCopy">
                        <h3 id="gameFocusFallbackTitle">Janela pronta</h3>
                        <p id="gameFocusFallbackMessage">A janela do jogo foi detectada, mas o Windows manteve o Doorpi em primeiro plano.</p>
                        <p id="gameFocusFallbackHint">Use o alternador do Windows para escolher a janela ativa.</p>
                    </div>
                    <div id="gameFocusFallbackActions">
                        <button id="gameFocusFallbackManual" class="fallback-action primary" type="button" tabindex="0">
                            <span class="action-text">Escolher janela</span>
                        </button>
                        <button id="gameFocusFallbackClose" class="fallback-action secondary" type="button" tabindex="0">
                            <span class="action-text">Encerrar</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#gameFocusFallbackManual')?.addEventListener('click', () => {
            window.hideGameFocusFallbackPopup?.(false);
            postToHost({ action: 'manualGameWindowRestore' });
        });
        overlay.querySelector('#gameFocusFallbackClose')?.addEventListener('click', () => {
            const payload = _gameFocusFallbackPayload;
            window.hideGameFocusFallbackPopup?.(true);
            postToHost({
                action: 'closeRunningItem',
                id: payload?.id || '',
                url: payload?.url || '',
                channel: payload?.channel || 'games',
                appType: payload?.appType || 'game'
            });
        });

        _gameFocusFallbackOverlay = overlay;
        return overlay;
    }

    window.isGameFocusFallbackPopupOpen = function () {
        return !!(_gameFocusFallbackOverlay && _gameFocusFallbackOverlay.classList.contains('visible'));
    };

    window.getGameFocusFallbackPopupItems = function () {
        if (!window.isGameFocusFallbackPopupOpen()) return [];
        return Array.from(_gameFocusFallbackOverlay.querySelectorAll('#gameFocusFallbackActions button'))
            .filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);
    };

    window.hideGameFocusFallbackPopup = function (restoreFocus = true) {
        if (!_gameFocusFallbackOverlay) return;
        _gameFocusFallbackOverlay.classList.remove('visible');
        _gameFocusFallbackPayload = null;
        if (restoreFocus) {
            const target = _gameFocusFallbackReturnFocusEl;
            _gameFocusFallbackReturnFocusEl = null;
            setTimeout(() => {
                if (target && document.contains(target) && typeof target.focus === 'function') {
                    target.focus();
                } else {
                    recoverGlobalFocus?.();
                }
            }, 0);
        } else {
            _gameFocusFallbackReturnFocusEl = null;
        }
    };

    window.showGameFocusFallbackPopup = function ({ id, name } = {}) {
        const overlay = _ensureGameFocusFallbackOverlay();
        const wasVisible = overlay.classList.contains('visible');
        if (!wasVisible) _gameFocusFallbackReturnFocusEl = document.activeElement;

        const fallbackName = name || (typeof t === 'function' ? t('sessionConflictCurrent') : 'atual');
        _gameFocusFallbackPayload = { id: id || '', channel: 'games', appType: 'game' };

        const kickerEl = overlay.querySelector('#gameFocusFallbackKicker');
        const titleEl = overlay.querySelector('#gameFocusFallbackTitle');
        const messageEl = overlay.querySelector('#gameFocusFallbackMessage');
        const hintEl = overlay.querySelector('#gameFocusFallbackHint');
        const manualBtn = overlay.querySelector('#gameFocusFallbackManual');
        const closeBtn = overlay.querySelector('#gameFocusFallbackClose');

        const title = typeof t === 'function' ? t('gameFocusFallbackTitle') : 'Janela do jogo detectada';
        const message = (typeof t === 'function'
            ? t('gameFocusFallbackMessage')
            : 'A janela de {name} foi encontrada, mas o Windows manteve o Doorpi em primeiro plano. Deseja escolher a janela manualmente pelo alternador nativo?')
            .replace('{name}', fallbackName);

        if (kickerEl) kickerEl.textContent = typeof t === 'function' ? t('gameFocusFallbackKicker') : 'Foco da janela';
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        if (hintEl) hintEl.textContent = typeof t === 'function' ? t('gameFocusFallbackHint') : 'Use o alternador do Windows para escolher a janela ativa.';
        if (manualBtn) {
            const textEl = manualBtn.querySelector('.action-text');
            if (textEl) textEl.textContent = typeof t === 'function' ? t('gameFocusFallbackManual') : 'Escolher janela';
        }
        if (closeBtn) {
            const textEl = closeBtn.querySelector('.action-text');
            if (textEl) textEl.textContent = typeof t === 'function' ? t('gameFocusFallbackClose') : 'Encerrar';
        }

        overlay.classList.add('visible');
        if (!wasVisible) {
            setTimeout(() => {
                manualBtn?.focus();
                if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
            }, 0);
        }
    };

    window._rememberLaunchedWebAppForConflict = function (item, launchId) {
        if (!item) return;
        const appType = (item.appType || '').toLowerCase();
        if (item.channel !== 'media' || (appType !== 'webview' && appType !== 'browser')) return;

        window._currentWebAppConflictEntry = {
            channel: 'media',
            kind: 'web',
            url: launchId || item.url || item.id || '',
            name: item.name || '',
            heroImage: item.hero || item.staticHero || '',
            gridImage: item.staticVertical || item.vertical || item.staticHorizontal || item.horizontal || ''
        };
    };

    function _syncWebAppConflictEntryFromRuntime() {
        const running = Array.isArray(window.DoorpiRuntimeState?.running) ? window.DoorpiRuntimeState.running : [];
        const webEntry = running.find(e => e && e.channel === 'media' && e.kind === 'web');
        if (webEntry) {
            window._currentWebAppConflictEntry = webEntry;
        } else {
            window._currentWebAppConflictEntry = null;
        }
    }

    // ── TRAVA DE SEGURANÇA DA INTRO ────────────────────────────────────────
    function setupIntroCompleteHook() {
        const onIntroComplete = () => {
            if (!window._isIntroComplete) {
                window._isIntroComplete = true;
                window._startSystemAudio();
            }
        };

        if (window.DoorpiIntro && typeof window.DoorpiIntro.runAfterIntro === 'function') {
            window.DoorpiIntro.runAfterIntro(onIntroComplete);
        } else {
            let _intro = window.DoorpiIntro;
            Object.defineProperty(window, 'DoorpiIntro', {
                get: () => _intro,
                set: (val) => {
                    _intro = val;
                    if (val && typeof val.runAfterIntro === 'function') {
                        val.runAfterIntro(onIntroComplete);
                    }
                },
                configurable: true
            });
        }
    }
    setupIntroCompleteHook();

    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'doorpi:intro:complete') {
            if (!window._isIntroComplete) {
                window._isIntroComplete = true;
                window._startSystemAudio();
            }
        }
    });
    // ──────────────────────────────────────────────────────────────────────
    const PLATFORMS = {
        Steam: {
            type: 'svg',
            icon: `<svg viewBox="0 0 24 24" fill="#1b9bd4" xmlns="http://www.w3.org/2000/svg"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.265 2.265-1.253 0-2.265-1.014-2.265-2.265z"/></svg>`
        },
        Epic: {
            type: 'svg',
            icon: `<svg viewBox="0 0 24 24" fill="#a0a0a0" xmlns="http://www.w3.org/2000/svg"><path d="M3.537 0C2.165 0 1.66.506 1.66 1.879V18.44a4.262 4.262 0 00.02.433c.031.3.037.59.316.92.027.033.311.245.311.245.153.075.258.13.43.2l8.335 3.491c.433.199.614.276.928.27h.002c.314.006.495-.071.928-.27l8.335-3.492c.172-.07.277-.124.43-.2 0 0 .284-.211.311-.243.28-.33.285-.621.316-.92a4.261 4.261 0 00.02-.434V1.879c0-1.373-.506-1.88-1.878-1.88zm13.366 3.11h.68c1.138 0 1.688.553 1.688 1.696v1.88h-1.374v-1.8c0-.369-.17-.54-.523-.54h-.235c-.367 0-.537.17-.537.539v5.81c0 .369.17.54.537.54h.262c.353 0 .523-.171.523-.54V8.619h1.373v2.143c0 1.144-.562 1.71-1.7 1.71h-.694c-1.138 0-1.7-.566-1.7-1.71V4.82c0-1.144.562-1.709 1.7-1.709zm-12.186.08h3.114v1.274H6.117v2.603h1.648v1.275H6.117v2.774h1.74v1.275h-3.14zm3.816 0h2.198c1.138 0 1.7.564 1.7 1.708v2.445c0 1.144-.562 1.71-1.7 1.71h-.799v3.338h-1.4zm4.53 0h1.4v9.201h-1.4zm-3.13 1.235v3.392h.575c.354 0 .523-.171.523-.54V4.965c0-.368-.17-.54-.523-.54zm-3.74 10.147a1.708 1.708 0 01.591.108 1.745 1.745 0 01.49.299l-.452.546a1.247 1.247 0 00-.308-.195.91.91 0 00-.363-.068.658.658 0 00-.28.06.703.703 0 00-.224.163.783.783 0 00-.151.243.799.799 0 00-.056.299v.008a.852.852 0 00.056.31.7.7 0 00.157.245.736.736 0 00.238.16.774.774 0 00.303.058.79.79 0 00.445-.116v-.339h-.548v-.565H7.37v1.255a2.019 2.019 0 01-.524.307 1.789 1.789 0 01-.683.123 1.642 1.642 0 01-.602-.107 1.46 1.46 0 01-.478-.3 1.371 1.371 0 01-.318-.455 1.438 1.438 0 01-.115-.58v-.008a1.426 1.426 0 01.113-.57 1.449 1.449 0 01.312-.46 1.418 1.418 0 01.474-.309 1.58 1.58 0 01.598-.111 1.708 1.708 0 01.045 0zm11.963.008a2.006 2.006 0 01.612.094 1.61 1.61 0 01.507.277l-.386.546a1.562 1.562 0 00-.39-.205 1.178 1.178 0 00-.388-.07.347.347 0 00-.208.052.154.154 0 00-.07.127v.008a.158.158 0 00.022.084.198.198 0 00.076.066.831.831 0 00.147.06c.062.02.14.04.236.061a3.389 3.389 0 01.43.122 1.292 1.292 0 01.328.17.678.678 0 01.207.24.739.739 0 01.071.337v.008a.865.865 0 01-.081.382.82.82 0 01-.229.285 1.032 1.032 0 01-.353.18 1.606 1.606 0 01-.46.061 2.16 2.16 0 01-.71-.116 1.718 1.718 0 01-.593-.346l.43-.514c.277.223.578.335.9.335a.457.457 0 00.236-.05.157.157 0 00.082-.142v-.008a.15.15 0 00-.02-.077.204.204 0 00-.073-.066.753.753 0 00-.143-.062 2.45 2.45 0 00-.233-.062 5.036 5.036 0 01-.413-.113 1.26 1.26 0 01-.331-.16.72.72 0 01-.222-.243.73.73 0 01-.082-.36v-.008a.863.863 0 01.074-.359.794.794 0 01.214-.283 1.007 1.007 0 01.34-.185 1.423 1.423 0 01.448-.066 2.006 2.006 0 01.025 0zm-9.358.025h.742l1.183 2.81h-.825l-.203-.499H8.623l-.198.498h-.81zm2.197.02h.814l.663 1.08.663-1.08h.814v2.79h-.766v-1.602l-.711 1.091h-.016l-.707-1.083v1.593h-.754zm3.469 0h2.235v.658h-1.473v.422h1.334v.61h-1.334v.442h1.493v.658h-2.255zm-5.3.897l-.315.793h.624zm-1.145 5.19h8.014l-4.09 1.348z"/></svg>`
        },
        GOG: {
            type: 'svg',
            icon: `<svg viewBox="0 0 24 24" fill="#8a4fff" xmlns="http://www.w3.org/2000/svg"><path d="M7.15 15.24H4.36a.4.4 0 0 0-.4.4v2c0 .21.18.4.4.4h2.8v1.32h-3.5c-.56 0-1.02-.46-1.02-1.03v-3.39c0-.56.46-1.02 1.03-1.02h3.48v1.32zM8.16 11.54c0 .58-.47 1.05-1.05 1.05H2.63v-1.35h3.78a.4.4 0 0 0 .4-.4V6.39a.4.4 0 0 0-.4-.4H4.39a.4.4 0 0 0-.41.4v2.02c0 .23.18.4.4.4H6v1.35H3.68c-.58 0-1.05-.46-1.05-1.04V5.68c0-.57.47-1.04 1.05-1.04H7.1c.58 0 1.05.47 1.05 1.04v5.86zM21.36 19.36h-1.32v-4.12h-.93a.4.4 0 0 0-.4.4v3.72h-1.33v-4.12h-.93a.4.4 0 0 0-.4.4v3.72h-1.33v-4.42c0-.56.46-1.02 1.03-1.02h5.61v5.44zM21.37 11.54c0 .58-.47 1.05-1.05 1.05h-4.48v-1.35h3.78a.4.4 0 0 0 .4-.4V6.39a.4.4 0 0 0-.4-.4h-2.03a.4.4 0 0 0-.4.4v2.02c0 .23.18.4.4.4h1.62v1.35H16.9c-.58 0-1.05-.46-1.05-1.04V5.68c0-.57.47-1.04 1.05-1.04h3.43c.58 0 1.05.47 1.05 1.04v5.86zM13.72 4.64h-3.44c-.58 0-1.04.47-1.04 1.04v3.44c0 .58.46 1.04 1.04 1.04h3.44c.57 0 1.04-.46 1.04-1.04V5.68c0-.57-.47-1.04-1.04-1.04m-.3 1.75v2.02a.4.4 0 0 1-.4.4h-2.03a.4.4 0 0 1-.4-.4V6.4c0-.22.17-.4.4-.4H13c.23 0 .4.18.4.4zM12.63 13.92H9.24c-.57 0-1.03.46-1.03 1.02v3.39c0 .57.46 1.03 1.03 1.03h3.39c.57 0 1.03-.46 1.03-1.03v-3.39c0-.56-.46-1.02-1.03-1.02m-.3 1.72v2a.4.4 0 0 1-.4.4v-.01H9.94a.4.4 0 0 1-.4-.4v-1.99c0-.22.18-.4.4-.4h2c.22 0 .4.18.4.4zM23.49 1.1a1.74 1.74 0 0 0-1.24-.52H1.75A1.74 1.74 0 0 0 0 2.33v19.34a1.74 1.74 0 0 0 1.75 1.75h20.5A1.74 1.74 0 0 0 24 21.67V2.33c0-.48-.2-.92-.51-1.24m0 20.58a1.23 1.23 0 0 1-1.24 1.24H1.75A1.23 1.23 0 0 1 .5 21.67V2.33a1.23 1.23 0 0 1 1.24-1.24h20.5a1.24 1.24 0 0 1 1.24 1.24v19.34z"/></svg>`
        },
        Riot: {
            type: 'svg',
            icon: `<svg viewBox="0 0 24 24" fill="#eb0029" xmlns="http://www.w3.org/2000/svg"><path d="M13.458.86 0 7.093l3.353 12.761 2.552-.313-.701-8.024.838-.373 1.447 8.202 4.361-.535-.775-8.857.83-.37 1.591 9.025 4.412-.542-.849-9.708.84-.374 1.74 9.87L24 17.318V3.5Zm.316 19.356.222 1.256L24 23.14v-4.18l-10.22 1.256Z"/></svg>`
        },
        Ubisoft: {
            type: 'svg',
            icon: `<svg viewBox="0 0 24 24" fill="#36a8ff" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5" fill="#06131f"/><circle cx="14" cy="10" r="2" fill="#36a8ff"/></svg>`
        },
        EA: {
            type: 'svg',
            icon: `<svg viewBox="0 0 24 24" fill="#ff4747" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h9l-1.4 3H6.8l-.6 1.2h4l-1.3 2.7h-4L4.3 14H9l-1.5 3H0zm10.2 0H17l7 11h-3.9l-1-1.7h-5.3l-1 1.7H9zm2 6.6h2.3l-1.1-2z"/></svg>`
        },
        'Battle.net': {
            type: 'svg',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#62b6ff" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg"><ellipse cx="12" cy="12" rx="9" ry="3.8"/><ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.7" fill="#62b6ff" stroke="none"/></svg>`
        },
        Amazon: {
            type: 'svg',
            icon: `<svg viewBox="0 0 24 24" fill="#ff9900" xmlns="http://www.w3.org/2000/svg"><path d="M6 7.5c1.4-1.2 3.2-1.9 5.4-1.9 3.2 0 5.2 1.7 5.2 4.8v5.4c0 .7.2 1.3.6 1.8l-3.1.7-.6-1.2c-1.2 1-2.6 1.4-4.2 1.4-2.5 0-4.2-1.5-4.2-3.7 0-2.6 2.2-4 6.4-4h1.8v-.5c0-1.1-.7-1.8-2.1-1.8-1.3 0-2.5.4-3.6 1.3zm7.3 5.6h-1.5c-2 0-3 .5-3 1.5 0 .8.7 1.3 1.7 1.3 1.1 0 2.1-.4 2.8-1.2z"/></svg>`
        },
        Xbox: {
            type: 'svg',
            icon: `<svg viewBox="0 0 24 24" fill="#107c10" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 0 0-7 17.1c1.3-3 3.3-5.8 5.5-7.9C8.7 9.5 6.5 8 4.2 7.1A10 10 0 0 1 12 2zm7.8 5.1c-2.3.9-4.5 2.4-6.3 4.1 2.2 2.1 4.2 4.9 5.5 7.9a10 10 0 0 0 .8-12zM6.6 20.3a10 10 0 0 0 10.8 0c-1.1-2.4-3-5.1-5.4-7.3-2.4 2.2-4.3 4.9-5.4 7.3z"/></svg>`
        },
        Folder: {
            type: 'svg',
            icon: `<svg viewBox="0 0 24 24" fill="#f0a500" xmlns="http://www.w3.org/2000/svg"><path d="M10.4 4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h5.4z"/></svg>`
        },
        Windows: {
            type: 'svg',
            icon: `<svg viewBox="0 0 88 88" fill="#0078d4" xmlns="http://www.w3.org/2000/svg"><path d="M0 12.4 35.7 7.6V42H0zm40.3-5.5L88 0v42H40.3zM0 46h35.7v34.4L0 75.6zm40.3.1H88V88L40.3 81.4z"/></svg>`
        },
    };

    const FILTER_SOURCES = {
        all: null,
        Steam: ['Steam'],
        Epic: ['Epic'],
        GOG: ['GOG'],
        Riot: ['Riot'],
        Ubisoft: ['Ubisoft'],
        EA: ['EA'],
        BattleNet: ['Battle.net'],
        Amazon: ['Amazon'],
        Xbox: ['Xbox'],
        Windows: ['Windows', 'Folder'],
    };

    const SCAN_LIBS = ['Steam', 'Epic', 'GOG', 'Riot', 'Ubisoft', 'EA', 'BattleNet', 'Amazon', 'Xbox', 'Windows', 'Folder'];
    // ── ANTI-WEB FIXES (Impede bordas brancas e força Loading na GPU corretamente) ───────────
    (function applyAntiWebFixes() {
        const s = document.createElement('style');
        s.textContent = `
            /* 1. Elimina as bordas nativas do navegador em imagens vazias/carregando */
            img { 
                border: none !important; 
                outline: none !important; 
                color: transparent !important; 
                -webkit-user-drag: none; 
            }
            img:not([src]), img[src=""] { 
                visibility: hidden !important; 
            }

            /* 2. Joga a tela de Loading para a GPU (Placa de vídeo) SEM quebrar os giros */
            #systemLoadingOverlay, 
            #globalLoadingOverlay {
                will-change: opacity;
            }
        
            /* Apenas avisa o navegador para processar o giro separadamente, sem travar o eixo */
            .vb-ring, 
            .vb-ring-wrap {
                will-change: transform;
            }
        `;
        document.head.appendChild(s);
    })();
    // 🔹 INJEÇÃO DA FOTO DE PERFIL NO CANTO SUPERIOR ESQUERDO
    (function injectTopProfile() {
        const btn = document.createElement('button');
        btn.id = 'btnTopProfile';
        btn.className = 'top-profile-btn';
        btn.tabIndex = 0;
        btn.innerHTML = `<div class="doorpi-avatar"></div><span class="top-profile-name"></span>`;
        document.body.appendChild(btn);

        btn.addEventListener('click', () => {
            postToHost({ action: 'requestUsers' });
        });

        const s = document.createElement('style');
        s.textContent = `
            .top-profile-btn {
                position: fixed;
                top: clamp(20px, 3vh, 40px);
                left: clamp(24px, 4vw, 60px);
                display: flex;
                align-items: center;
                gap: 18px;
                background: none;
                border: none;
                cursor: pointer;
                outline: none;
                z-index: 8000;
                padding: 0;
            }

            .top-profile-btn .doorpi-avatar {
                width: clamp(58px, 4.5vw, 74px);
                height: clamp(58px, 4.5vw, 74px);
                border-radius: 50%;
                background: rgb(255 255 255 / 0%);
                border: 2px solid rgba(255,255,255,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                flex-shrink: 0;
                transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
            }
            .top-profile-btn:focus .doorpi-avatar, .top-profile-btn:hover .doorpi-avatar {
                transform: scale(1.1);
                border-color: #fff;
            }
            .top-profile-btn img { width: 100%; height: 100%; object-fit: cover; }
            .top-profile-name {
                font-size: clamp(17px, 1vw, 19px);
                font-weight: 500;
                color: rgba(255,255,255,0.7);
                white-space: nowrap;
                filter: drop-shadow(1px 2px 1px black);
            }
            .top-profile-btn:focus .top-profile-name, .top-profile-btn:hover .top-profile-name {
                color: #fff;
            }
        `;
        document.head.appendChild(s);
    })();
    

    setInterval(() => {
        document.getElementById('clock').innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 1000);

    /* Seção: Ponte com o host */
    // ── GERADOR DE FALLBACKS SVG ──────────────────────────────────────────
    window.generateFallbackSvg = function (name, type) {
        const initial = (name || "App").charAt(0).toUpperCase();
        const safeName = (name || "App").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const makeSvg = (svg) => "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));

        if (type === 'grid') {
            // GRID VERTICAL: Fundo Escuro + Inicial
            return makeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900"><rect width="600" height="900" fill="#1a1a2e"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="350" font-weight="bold">${initial}</text></svg>`);

        } else if (type === 'horizontal') {
            // GRID HORIZONTAL: Fundo Escuro + Inicial
            return makeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 430"><rect width="920" height="430" fill="#1a1a2e"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="200" font-weight="bold">${initial}</text></svg>`);

        } else if (type === 'logo') {
            // LOGO: Alinhado à esquerda (x="0") e mais para baixo (y="80%") para casar com a posição real
            return makeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 150"><text x="0%" y="80%" fill="#ffffff" font-family="sans-serif" font-size="75" font-weight="bold">${safeName}</text></svg>`);

        } else if (type === 'banner') {
            // BANNER: 100% TRANSPARENTE (Deixa o Blob brilhar!)
            return makeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="transparent"/></svg>`);
        }

        return '';
    };

    /* Seção: Ponte com o host */
    window.chrome.webview.addEventListener('message', event => {
        try {
            const data = JSON.parse(event.data);
            console.log("Mensagem recebida no JS:", data);

            // ── INJEÇÃO DE FALLBACKS (SEM ARTE) ──────────────────────────────────
            const applyFallbacks = (item) => {
                const name = item.name || item.Name || "App";

                // 1. Grid Vertical (Inicial)
                const gridKey = item.imageData !== undefined ? 'imageData' : (item.GridImage !== undefined ? 'GridImage' : null);
                if (gridKey && !item[gridKey]) item[gridKey] = window.generateFallbackSvg(name, 'grid');

                // 2. Grid Horizontal (Inicial)
                const horizKey = item.horizontalImage !== undefined ? 'horizontalImage' : (item.GridHorizontalImage !== undefined ? 'GridHorizontalImage' : null);
                if (horizKey && !item[horizKey]) item[horizKey] = window.generateFallbackSvg(name, 'horizontal');

                // 3. Logo (Nome)
                const logoKey = item.logo !== undefined ? 'logo' : (item.LogoImage !== undefined ? 'LogoImage' : null);
                if (logoKey && !item[logoKey]) item[logoKey] = window.generateFallbackSvg(name, 'logo');

                // 4. Banner (Transparente para o Blob)
                const bannerKey = item.hero !== undefined ? 'hero' : (item.HeroImage !== undefined ? 'HeroImage' : null);
                if (bannerKey && !item[bannerKey]) item[bannerKey] = window.generateFallbackSvg(name, 'banner');
            };

            // Substitui o bloco renderGames existente
            if (data.type === 'renderGames' && data.games) {
                data.games.forEach(applyFallbacks);

                const wasOnMedia = typeof window.getCurrentHomeTab === 'function'
                    && window.getCurrentHomeTab() === 'media';

                // Snapshot do hero atual antes do setBatch trocar tudo
                const heroSnapSrc = document.getElementById('bgBlur')?.src || '';
                const heroSnapLogo = document.getElementById('gameLogo')?.src || '';
                const heroSnapHoriz = document.getElementById('heroImage')?.src || '';

                if (window.AppStore) window.AppStore.mutations.setBatch('games', data.games || []);

                // Se estava na mídia, devolve o hero que estava ativo
                if (wasOnMedia && heroSnapSrc) {
                    requestAnimationFrame(() =>
                        switchHeroBackground(heroSnapSrc, heroSnapLogo, heroSnapHoriz));
                }
            }
            else if (data.type === 'newGame') applyFallbacks(data);
            else if (data.type === 'nativeAppsLoaded' && data.apps) data.apps.forEach(applyFallbacks);
            // ─────────────────────────────────────────────────────────────────────
            // ─────────────────────────────────────────────────────────────────────

            if (data.updates) {
                window._pendingExtensionUpdates = data.updates;
            }

            // 1. Quando o C# envia um ÚNICO jogo novo
            if (data.type === 'newGame') {
                const channel = (data.isMedia || data.tab === 'media' || data.appUrl !== undefined || data.appType !== undefined) ? 'media' : 'games';
                if (window.AppStore) window.AppStore.mutations.addItem(channel, data);
            }
            // 2. Quando o C# envia A LISTA COMPLETA de uma vez (Início do App)
            else if (data.type === 'renderGames') {
                if (window.AppStore) window.AppStore.mutations.setBatch('games', data.games || []);
            }
            else if (data.type === 'gamesRemoved' && Array.isArray(data.games)) {
                data.games.forEach(game => {
                    const id = game.id || game.launchUrl || game.LaunchUrl || game.path || game.Path;
                    if (!id) return;
                    window.newGameIdsThisSession?.delete(id);
                    window.AppStore?.mutations?.removeItem('games', id);
                    window._navMenuRemoveItem?.('games', id);
                });
            }
            // app.js — handler de mensagens do C#
            else if (data.type === 'windowFocused') {
                window.isGameLaunchActive = false;
                window._doorpiGameInputSuppressedUntil = 0;
                window.isMediaAppActive = false;
                window.isStoreSessionActive = false;
                const launchOverlay = document.getElementById('gameLaunchOverlay');
                const isExecutionLockVisible = !!(launchOverlay &&
                    launchOverlay.classList.contains('visible') &&
                    launchOverlay.classList.contains('execution-lock-visible'));
                const isTransientLaunchOverlayVisible = !!(launchOverlay &&
                    launchOverlay.classList.contains('visible') &&
                    !isExecutionLockVisible);
                const isWaitingForValidGameWindowVisible = _isWaitingForValidGameWindowOverlayVisible();
                const isAnyLaunchLoadingVisible = _isAnyLaunchLoadingOverlayVisible();

                const shouldMuteDoorpiAudio = _readDoorpiAudioMuteFlag(data);

                if (data.appAlive !== undefined ||
                    data.hasBlockingSession !== undefined ||
                    data.hasLiveExternalSession !== undefined ||
                    data.shouldMuteDoorpiAudio !== undefined) {
                    window._isExternalAppRunning = shouldMuteDoorpiAudio;
                }

                if (isExecutionLockVisible) {
                    window._isExternalAppRunning = true;
                    window.isMediaAppActive = true;
                    _ensureExecutionOverlayRefreshLoop();
                    _refreshExecutionOverlayFromRuntime();
                }
                if (isWaitingForValidGameWindowVisible) {
                    window._isExternalAppRunning = true;
                }

                window._isDoorpiFocused = true;
                window.isDoorpiFocused = true;

                if (!window._vkbIsOpen) {
                    recoverGlobalFocus();
                }

                if (window._isExternalAppRunning) {
                    window._stopSystemAudio();

                } else {
                    // Gap de transição: se houver sessão ativa, sobe direto para EM EXECUÇÃO
                    // em vez de esconder o overlay no retorno de foco.

                    window._startSystemAudio(true);
                }
            }
            else if (data.type === 'appProcessDied') {
                if (Array.isArray(data.running)) {
                    window.DoorpiRuntimeState.running = data.running;
                    _syncWebAppConflictEntryFromRuntime();
                    refreshRuntimeCards();
                }
                const shouldMuteDoorpiAudio = _readDoorpiAudioMuteFlag(
                    data,
                    window.DoorpiRuntimeState.running.length > 0
                );
                window._syncSystemAudioFromRuntime(shouldMuteDoorpiAudio);
            }
            else if (data.type === 'scanProgress') {
                window.setInlineScanStatus?.(true, `Lendo: ${data.folderName}...`);
            }
            else if (data.type === 'runtimeSessionsChanged') {
                window.DoorpiRuntimeState.running = Array.isArray(data.running) ? data.running : [];
                _syncWebAppConflictEntryFromRuntime();
                refreshRuntimeCards();
                const shouldMuteDoorpiAudio = _readDoorpiAudioMuteFlag(
                    data,
                    window.DoorpiRuntimeState.running.length > 0
                );
                window._syncSystemAudioFromRuntime(shouldMuteDoorpiAudio);
                if (_hasAnyRuntimeSession()) {
                    _clearExecutionOverlayCloseTimer();
                    _ensureExecutionOverlayRefreshLoop();
                    _refreshExecutionOverlayFromRuntime();
                } else if (_isExecutionOverlayVisible()) {
                    _clearExecutionOverlayCloseTimer();
                    window._executionOverlayCloseTimer = setTimeout(() => {
                        window._executionOverlayCloseTimer = 0;
                        if (_hasAnyRuntimeSession()) return;
                        if (!_isExecutionOverlayVisible()) return;
                        window.isMediaAppActive = false;
                        window._lastExecutionLockData = null;
                        window._executionOverlayVisualKey = '';
                        GameLaunchOverlay.hide();
                        _stopExecutionOverlayRefreshLoop();
                    }, 450);
                } else {
                    _stopExecutionOverlayRefreshLoop();
                }
            }
            else if (data.type === 'windowLostFocus') {
                window._isDoorpiFocused = false;
                window._stopSystemAudio();
            }
            else if (data.type === 'openUserPicker') {
                const picker = document.getElementById('doorpiUserPicker');
                const isPickerOpen = picker && picker.style.display !== 'none';


                if (window.isSetupOpen) return;

                if (!window.isNavMenuOpen && !window.isModalOpen && !window._vkbIsOpen && !isPickerOpen) {
                    postToHost({ action: 'requestUsers' });
                }
            }
            else if (data.type === 'extensionsList' || data.type === 'extensionUpdatesList') {
                if (data.type === 'extensionUpdatesList') {
                    window._pendingExtensionUpdates = data.updates || {};
                }
                // Atualiza a lista na nova interface do Nav Menu se estiver aberta
                if (document.getElementById('navExtensionsList')) {
                    window._renderNavExtensionsList?.(data.extensions || [], data.status || '', data.message || '', window._pendingExtensionUpdates);
                }
            }
            else if (data.type === 'installedAppsList') {
                allInstalledApps = data.apps;
                refreshInstalledAppsView();
            }
            else if (data.type === 'installedAppsUpdated') {
                const modal = document.getElementById('addGameContainer');
                if (!modal || modal.style.display === 'none') return;
                allInstalledApps = data.apps;
                refreshInstalledAppsView();
            }
            else if (data.type === 'nativeAppsLoaded') {
                if (data.apps) {
                    window._mediaGamepadConfig = window._mediaGamepadConfig || {};
                    data.apps.forEach(app => {
                        window._mediaGamepadConfig[app.Id] = !!app.DisableGamepadControl;
                    });

                    // Aplica aos cards que já possam estar ativos no DOM
                    document.querySelectorAll('.card[data-app-id]').forEach(card => {
                        const id = card.dataset.appId;
                        if (window._mediaGamepadConfig[id] !== undefined) {
                            card.dataset.disableGamepadControl = window._mediaGamepadConfig[id] ? 'true' : 'false';
                        }
                    });
                }
            }
            else if (data.type === 'clearLoadingCards') {
                clearLoadingCards(data.tab || 'games');
                if (!data.tab) clearLoadingCards('media');
            }
            else if (data.type === 'showSetup') {
                const open = () => {
                    window.DoorpiIntro?.finishHandoff?.();
                    if (typeof openSetup === 'function') openSetup();
                };
                if (window.DoorpiIntro?.isRunning?.()) window.DoorpiIntro.runAfterIntro(open);
                else open();
            }
            else if (data.type === 'profilePhotoSelected') {
                window._setupHandlePhotoSelected?.(data.base64);
            }
            else if (data.type === 'setupFolderAdded') {
                window._setupHandleFolderAdded?.(data.path);
            }
            else if (data.type === 'browsersDetected') {
                window._setupRenderBrowsers?.(data.browsers);
            }
            // 1. Quando o C# manda limpar a grade (Ao iniciar ou resetar)
            else if (data.type === 'clearGamesGrid') {
                if (window.AppStore) window.AppStore.mutations.setBatch('games', []);
            }
            else if (data.type === 'bootstrapStarted') {
                // showLoadingCards já existe no codebase (usada ao adicionar jogos manualmente)
                if (typeof showLoadingCards === 'function') {
                    showLoadingCards(data.count || 6, 'games');
                }
            }
            // 2. Quando o C# avisa que salvou a imagem estática localmente
            else if (data.type === 'staticSaved') {
                const patch = {};
                if (data.imageType === 'GridStatic') patch.staticVertical = data.newUrl;
                if (data.imageType === 'HorizontalStatic') patch.staticHorizontal = data.newUrl;
                if (data.imageType === 'HeroStatic') patch.staticHero = data.newUrl;
                if (data.imageType === 'LogoStatic') patch.staticLogo = data.newUrl;

                // Avisamos o Store da mudança. O Store avisa o Grid, e a imagem é atualizada sem piscar.
                if (window.AppStore.queries.hasItem('games', data.gameId)) {
                    window.AppStore.mutations.patchItem('games', data.gameId, patch);
                } else if (window.AppStore.queries.hasItem('media', data.gameId)) {
                    window.AppStore.mutations.patchItem('media', data.gameId, patch);
                }
            }
            else if (data.type === 'clearMediaGrid') {
                const grid = document.getElementById('mediaGrid');
                if (grid) {
                    const btnAdd = document.getElementById('btnAddMedia');
                    grid.innerHTML = '';
                    if (btnAdd) grid.appendChild(btnAdd);
                }
            }
            else if (data.type === 'currentUserUpdated') {
                window._doorpiProfile = data.user;
                const btn = document.getElementById('btnTopProfile');
                if (btn) {
                    const u = data.user;
                    const avatar = btn.querySelector('.doorpi-avatar');
                    const name = btn.querySelector('.top-profile-name');
                    if (avatar) {
                        avatar.innerHTML = u?.PhotoBase64
                            ? `<img src="data:image/png;base64,${u.PhotoBase64}" />`
                            : (u?.Name ? u.Name.charAt(0).toUpperCase() : '•');
                    }
                    if (name) name.textContent = u?.Name ?? '';
                }
                if (typeof clearHero === 'function') clearHero();
            }
            else if (data.type === 'updateFeaturedCard') {
                // 🔹 Avisa o Store: ele reordena o carrossel E atualiza o hero automaticamente
                if (window.AppStore) window.AppStore.mutations.trackOpened(data.id);
            }
            else if (data.type === 'gameAlreadyRunning') {
                const running = _nonMinimizedRuntimeEntries().find(e =>
                    (e.channel === 'games' || e.kind === 'game') &&
                    (!data.currentGameId || !e.id || e.id === data.currentGameId)
                );
                const payload = running
                    ? _buildClosePayloadFromRuntimeEntry(running)
                    : { id: data.currentGameId || '', url: '', channel: 'games', appType: 'game' };
                window.showSessionConflictPopup?.({
                    closePayload: payload,
                    runningName: running ? _resolveRuntimeEntryName(running) : ''
                });
            }
            else if (data.type === 'storeAlreadyRunning') {
                const running = _nonMinimizedRuntimeEntries().find(e =>
                    (e.channel === 'stores' || e.kind === 'store') &&
                    (!data.currentStoreId || !e.id || e.id === data.currentStoreId)
                );
                const payload = running
                    ? _buildClosePayloadFromRuntimeEntry(running)
                    : { id: data.currentStoreId || '', url: data.currentStoreId || '', channel: 'stores', appType: 'store' };
                window.showSessionConflictPopup?.({
                    closePayload: payload,
                    runningName: running ? _resolveRuntimeEntryName(running) : ''
                });
            }
            else if (data.type === 'sessionConflictPrompt') {
                const payload = {
                    id: data.id || '',
                    url: data.url || '',
                    channel: data.channel || '',
                    appType: data.appType || ''
                };
                window.showSessionConflictPopup?.({
                    closePayload: payload,
                    runningName: data.name || ''
                });
            }
            else if (data.type === 'gameFocusFallbackPrompt') {
                window.showGameFocusFallbackPopup?.({
                    id: data.id || '',
                    name: data.name || data.gameName || ''
                });
            }
            else if (data.type === 'hideGameFocusFallbackPrompt') {
                window.hideGameFocusFallbackPopup?.(false);
            }
            else if (data.type === 'updateLoadingText') {
                if (window.isGlobalLoading) {
                    showGlobalLoading(data.title, data.subtitle);
                }
            }
            else if (data.type === 'foldersList') {
                cachedFolders = data.folders;
                renderFolderList(cachedFolders);
            }
            else if (data.type === 'hideLoading' || data.type === 'hideSystemLoading') {
                hideGlobalLoading();
                isFolderOperationInProgress = false;

               
                window.setInlineScanStatus?.(false);
            }
            else if (data.type === 'usersList') {
                window._doorpiUsers = data.users || [];
                window._doorpiCurrentUserId = data.currentUserId || '';
                showUserPicker(data.users || [], !!data.requireSelection);
            }
            else if (data.type === 'closeNavMenu') {
                window.closeNavMenu?.();
            }
            else if (data.type === 'usersData') {
                window._doorpiUsers = data.users || [];
                window._doorpiCurrentUserId = data.currentUserId || '';
                window._doorpiUsersDataReady?.(window._doorpiUsers, window._doorpiCurrentUserId);
            }
            else if (data.type === 'clipboardText') {
                if (data.text?.trim()) {
                    // Intercepta a colagem no Nav Menu de Conta/Perfil
                    if (window._isPastingApiKey) {
                        window._isPastingApiKey = false;
                        if (typeof window._updatePendingApiKey === 'function') {
                            window._updatePendingApiKey(data.text.trim());
                        }
                    }
                    // Intercepta a colagem no Nav Menu de Extensões
                    else if (window._isPastingWebAppUrl) {
                        window._isPastingWebAppUrl = false;
                        const input = document.getElementById('webAppUrlInput');
                        if (input) {
                            input.value = data.text.trim();
                            setTimeout(() => document.getElementById('btnAddWebApp')?.focus(), 80);
                        }
                    }
                    else if (window._isPastingExtensionUrl || (document.getElementById('navExtUrlInput') && data.text.includes('chromewebstore'))) {
                        window._isPastingExtensionUrl = false;
                        const input = document.getElementById('navExtUrlInput');
                        if (input) {
                            input.value = data.text.trim();
                            const btnInstall = document.getElementById('navExtInstallBtn');
                            if (btnInstall) {
                                btnInstall.focus();
                                // Força o foco devido ao delay do navegador que fecha após ler o clipboard
                                setTimeout(() => { if (document.getElementById('navExtUrlInput')) btnInstall.focus(); }, 1900);
                                setTimeout(() => { if (document.getElementById('navExtUrlInput')) btnInstall.focus(); }, 2300);
                            }
                        }
                    }
                    // Configuração Inicial (Setup)
                    else if (typeof isSetupOpen !== 'undefined' && isSetupOpen) {
                        const input = document.getElementById('setupApiInput');
                        if (input) {
                            input.value = data.text.trim();
                            if (typeof _currUser !== 'undefined' && _currUser) _currUser.apiKey = data.text.trim();
                            const hint = document.getElementById('setupApiHint');
                            if (hint) hint.textContent = typeof t === 'function' ? t('setupStep3PasteSuccess') : 'Copiado com sucesso!';
                            if (typeof _updateStatus === 'function') _updateStatus();
                            document.getElementById('btnSetupFinish')?.focus();
                        }
                    }
                }
            }
            else if (data.type === 'gameLaunching') {
                window._isExternalAppRunning = true;
                window._stopSystemAudio();
                window.isMediaAppActive = true;

                const reason = data.reason || '';
                const launchKind = reason.startsWith('store') ? 'store' : (reason === 'app' ? 'app' : 'game');
                const isRestore = reason === 'restore' || reason === 'storeRestore';
                GameLaunchOverlay.show(data.gameName, data.heroImage, data.gridImage, isRestore, launchKind);
            }
            else if (data.type === 'storeTransition') {
                window._isExternalAppRunning = true;
                window._stopSystemAudio();
                window.isMediaAppActive = true;
                GameLaunchOverlay.showStoreTransition(data);
            }
            else if (data.type === 'storeTransitionDone') {
                const launchOverlay = document.getElementById('gameLaunchOverlay');
                if (launchOverlay?.classList.contains('store-transition-visible')) {
                    GameLaunchOverlay.hide();
                }
            }
            else if (data.type === 'executionLock') {
                if (Date.now() < (window._doorpiOfficialReturnSuppressUntil || 0)) {
                    GameLaunchOverlay.hide();
                    return;
                }
                const hydrated = _hydrateExecutionLockPayload(data);
                const launchOverlay = document.getElementById('gameLaunchOverlay');
                const isVisibleExecution = !!(launchOverlay &&
                    launchOverlay.classList.contains('visible') &&
                    launchOverlay.classList.contains('execution-lock-visible'));
                const hasActionableIdentity = !!(hydrated?.id || hydrated?.url);
                if (!hasActionableIdentity) {
                    return;
                }
                const hasVisualContext = !!(hydrated.heroImage || hydrated.gridImage);
                const hasIdentity = !!(hydrated.id || hydrated.url || hydrated.kind || hydrated.channel);
                const currentLock = window._lastExecutionLockData || {};
                const currentTargetKey = _executionTargetKey(currentLock);
                const incomingTargetKey = _executionTargetKey(hydrated);
                const isSameTargetVisible =
                    isVisibleExecution &&
                    !!currentTargetKey &&
                    !!incomingTargetKey &&
                    currentTargetKey === incomingTargetKey;
                if (isVisibleExecution &&
                    currentTargetKey &&
                    incomingTargetKey &&
                    currentTargetKey !== incomingTargetKey) {
                    // Overlay já está estável para uma sessão; ignoramos troca tardia
                    // para evitar flicker/alternância de contexto em Alt+Tab repetido.
                    return;
                }
                if (isVisibleExecution && !hasVisualContext && hasIdentity && window._lastExecutionLockData) {
                    return;
                }
                if (isVisibleExecution &&
                    currentTargetKey &&
                    incomingTargetKey &&
                    currentTargetKey === incomingTargetKey) {
                    if (!hydrated.heroImage && currentLock.heroImage) hydrated.heroImage = currentLock.heroImage;
                    if (!hydrated.gridImage && currentLock.gridImage) hydrated.gridImage = currentLock.gridImage;
                    if (!hydrated.name && currentLock.name) hydrated.name = currentLock.name;
                }
                if (isSameTargetVisible &&
                    (hydrated.kind || '') === (currentLock.kind || '') &&
                    (hydrated.channel || '') === (currentLock.channel || '') &&
                    (hydrated.appType || '') === (currentLock.appType || '') &&
                    (hydrated.name || '') === (currentLock.name || '') &&
                    (hydrated.heroImage || '') === (currentLock.heroImage || '') &&
                    (hydrated.gridImage || '') === (currentLock.gridImage || '')) {
                    return;
                }
                const currentIsGame = currentLock.channel === 'games' || currentLock.kind === 'game';
                const incomingIsGame = hydrated.channel === 'games' || hydrated.kind === 'game';
                if (isVisibleExecution && currentIsGame && !incomingIsGame && _hasActiveGameRuntimeSession()) {
                    return;
                }
                window._isExternalAppRunning = true;
                window._stopSystemAudio();
                window.isMediaAppActive = true;
                _clearExecutionOverlayCloseTimer();
                _ensureExecutionOverlayRefreshLoop();
                window._lastExecutionLockData = {
                    kind: hydrated.kind || '',
                    channel: hydrated.channel || '',
                    id: hydrated.id || '',
                    url: hydrated.url || '',
                    appType: hydrated.appType || '',
                    name: hydrated.name || '',
                    heroImage: hydrated.heroImage || '',
                    gridImage: hydrated.gridImage || ''
                };
                window._executionOverlayVisualKey = _executionOverlayVisualKeyFor(window._lastExecutionLockData);
                GameLaunchOverlay.showExecutionLock(hydrated);
            }
            else if (data.type === 'executionLockCleared') {
                _clearExecutionOverlayCloseTimer();
                if (_hasAnyRuntimeSession()) {
                    _ensureExecutionOverlayRefreshLoop();
                    _refreshExecutionOverlayFromRuntime();
                    return;
                }
                // Nunca manter overlay "órfão": limpa a UI atual e só volta
                // para EM EXECUÇÃO quando houver nova confirmação oficial do host.
                window.isMediaAppActive = false;
                GameLaunchOverlay.hide();

                window._lastExecutionLockData = null;
                window._executionOverlayVisualKey = '';
                _stopExecutionOverlayRefreshLoop();
            }
            else if (data.type === 'officialReturnToDoorpi') {
                _clearExecutionOverlayCloseTimer();
                window._doorpiOfficialReturnSuppressUntil = Date.now() + 2000;
                window.isMediaAppActive = false;
                window.isGameLaunchActive = false;
                window._doorpiGameInputSuppressedUntil = 0;
                window._lastExecutionLockData = null;
                window._executionOverlayVisualKey = '';
                GameLaunchOverlay.hide();
                _stopExecutionOverlayRefreshLoop();
            }
            else if (data.type === 'userSwitchStart') {
                _userSwitchFadeOut(data);
            }
            else if (data.type === 'userSwitchComplete') {
                _userSwitchFadeIn(data);
            }

            else if (data.type === 'gameLaunchFailed') {
                const shouldMuteDoorpiAudio = _readDoorpiAudioMuteFlag(
                    data,
                    window.DoorpiRuntimeState.running.length > 0
                );
                window.isGameLaunchActive = false;
                window._doorpiGameInputSuppressedUntil = 0;
                window.isMediaAppActive = false;
                GameLaunchOverlay.setError(data.gameName, data.reason);
                window._syncSystemAudioFromRuntime(shouldMuteDoorpiAudio);
            }
            else if (data.type === 'gameLaunchDone') {
                window.isGameLaunchActive = false;
                window._doorpiGameInputSuppressedUntil = 0;
                const shouldMuteDoorpiAudio = _readDoorpiAudioMuteFlag(
                    data,
                    window.DoorpiRuntimeState.running.length > 0
                );
                window._syncSystemAudioFromRuntime(shouldMuteDoorpiAudio);
                const launchOverlay = document.getElementById('gameLaunchOverlay');
                if (!launchOverlay?.classList.contains('execution-lock-visible') &&
                    !launchOverlay?.classList.contains('store-transition-visible')) {
                    GameLaunchOverlay.hide();
                }
                if (!window._vkbIsOpen && !isExecutionLockVisible) {
                    recoverGlobalFocus();
                }
            }
            else if (document.getElementById('doorpiExtensionsManager')?.style.display !== 'none' && document.getElementById('extensionUrlInput')) {
                const input = document.getElementById('extensionUrlInput');
                input.value = data.text.trim();

                const btnInstall = document.getElementById('btnInstallExtension');
                if (btnInstall) {
                    // Tenta focar imediatamente
                    btnInstall.focus();

                    // Força o foco exatamente após o fechamento da janela da loja (que leva 1800ms)
                    setTimeout(() => {
                        if (document.getElementById('doorpiExtensionsManager')?.style.display !== 'none') {
                            btnInstall.focus();
                        }
                    }, 1900);

                    // Margem de segurança extra para casos onde o PC demore a renderizar o retorno
                    setTimeout(() => {
                        if (document.getElementById('doorpiExtensionsManager')?.style.display !== 'none') {
                            btnInstall.focus();
                        }
                    }, 2300);
                } else {
                    input.focus();
                }
            }



            window._mediaHandleMessage?.(data);
            window._storesHandleMessage?.(data);

            if ((data.type === 'libraryRevalidated' || data.type === 'newGamesDetected') && Array.isArray(data.games)) {
                data.games.filter(g => g.autoAdded).forEach(game => {
                    const id = game.LaunchUrl || game.launchUrl || game.Path || game.path;
                    if (id) window.newGameIdsThisSession?.add(id);
                });
            }
            else if (data.type === 'storeAutoAddSettings' && data.storeAutoAdd) {
                window._storeAutoAddSettings = data.storeAutoAdd;
            }
        } catch (e) { console.error('[bridge] Erro:', e); }
    });
    function recoverGlobalFocus() {
        // 1. Prioridade: Se tem um Modal de Adicionar aberto, foca nos botões dele
        if (window.isModalOpen) {
            const btn = document.querySelector('#btnAddWebApp') || document.querySelector('#btnConfirmAdd') || document.querySelector('#btnConfirmAddMedia');
            if (btn && btn.style.display !== 'none') { btn.focus(); return; }
        }

        // 2. Prioridade: Se o usuário estiver na tela principal (jogos, mídia ou lojas)
        const currentTab = (typeof window.getCurrentHomeTab === 'function') ? window.getCurrentHomeTab() : 'games';
        const gridId = typeof window.getHomeGridId === 'function'
            ? window.getHomeGridId(currentTab)
            : (currentTab === 'media' ? 'mediaGrid' : 'gameGrid');
        const grid = document.getElementById(gridId);

        if (grid) {
            const target = grid.querySelector('.card.featured')
                || grid.querySelector('.store-card')
                || grid.querySelector('.card:not(.add-card)')
                || grid.querySelector('.card.add-card');
            if (target) {
                target.focus();
                return;
            }
        }

        // 3. Fallback: Qualquer coisa clicável na tela
        const fallback = document.querySelector('button, [tabindex="0"]');
        if (fallback) fallback.focus();
    }
    function postToHost(payload) {

        // Lista de ações que cortam o som na hora (excluídos 'launch' e 'launchMediaApp')
        const muteActions = [
            'enterDesktopMode',
            'openTaskbarSettings',
            'openSignInOptions',
            'suspendSystem',
            'shutdownSystem',
            'restartSystem'
        ];

        if (payload && muteActions.includes(payload.action)) {
            window._stopSystemAudio();
        }

        window.chrome?.webview?.postMessage(JSON.stringify(payload));
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[ch]));
    }

    function ensureDoorpiOverlayStyles() {
        if (document.getElementById('doorpiOverlayStyles')) return;
        const s = document.createElement('style');
        s.id = 'doorpiOverlayStyles';
        s.textContent = `

        .doorpi-power-row {
        display: flex; align-items: center; justify-content: center;
        gap: 6px; flex-wrap: wrap;
        margin-top: clamp(20px, 3vh, 36px);
        padding: clamp(8px, 1.2vh, 12px) clamp(12px, 1.5vw, 20px);
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 14px;
    }
    .doorpi-power-sep {
        width: 1px; height: 22px;
        background: rgba(255,255,255,0.1);
        margin: 0 2px; flex-shrink: 0;
    }
    .doorpi-power-btn {
        background: none; border: 1px solid transparent; border-radius: 9px;
        color: rgba(255,255,255,0.38); padding: 7px 13px;
        display: flex; align-items: center; gap: 7px;
        cursor: pointer; outline: none; font: inherit;
        font-size: clamp(0.68rem, 0.8vw, 0.88rem); font-weight: 500;
        letter-spacing: 0.02em;
        transition: all 0.16s cubic-bezier(0.25, 1, 0.5, 1);
    }
    .doorpi-power-btn svg { width: 15px; height: 15px; flex-shrink: 0; stroke-width: 1.6; }
    .doorpi-power-btn:hover, .doorpi-power-btn:focus {
        background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.16);
        color: rgba(255,255,255,0.82); transform: translateY(-1px);
    }
    .doorpi-power-btn.p-danger:hover, .doorpi-power-btn.p-danger:focus {
        background: rgba(255,65,65,0.12); border-color: rgba(255,95,95,0.28);
        color: #ff8585;
    }
        .doorpi-user-overlay, .doorpi-manager-overlay {
            position: fixed; inset: 0; z-index: 9200;
            background: rgba(6, 6, 14, 0.75);
            backdrop-filter: blur(40px) saturate(1.5);
            -webkit-backdrop-filter: blur(40px) saturate(1.5);
            display: flex; align-items: center; justify-content: center;
            padding: clamp(24px, 5vw, 60px); box-sizing: border-box;
            animation: doorpiOverlayFadeIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes doorpiOverlayFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .doorpi-user-panel {
            width: 100%;
            display: flex; flex-direction: column; align-items: center; gap: clamp(30px, 4vw, 50px);
        }
        .doorpi-manager-panel {
            width: min(980px, 94vw); max-height: 86vh;
            display: flex; flex-direction: column; gap: 22px;
            background: rgba(16, 16, 28, 0.6);
            padding: clamp(24px, 3vw, 40px);
            border-radius: clamp(16px, 2vw, 24px);
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        }

        .doorpi-panel-head { width: 100%; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
        .doorpi-user-panel .doorpi-panel-head { flex-direction: column; align-items: center; text-align: center; justify-content: center; }
    
        .doorpi-panel-title {
            font-size: clamp(2.4rem, 4.2vw, 5.4rem);
            font-weight: 200;
            letter-spacing: -0.03em;
            color: #ffffff;
            margin: 0;
            line-height: 1.05;
            text-shadow: 0 2px 40px rgba(80,100,255,0.25);
        }
        .doorpi-panel-sub {
            font-size: clamp(0.95rem, 1.1vw, 1.4rem);
            color: rgba(255,255,255,0.55);
            margin: clamp(10px, 1.2vw, 16px) 0 0;
            line-height: 1.6;
            font-weight: 300;
        }

        /* MANAGER STYLES */
        .doorpi-manager-panel .doorpi-panel-title { font-size: clamp(2rem, 3vw, 3rem); text-align: left; }
        .doorpi-manager-panel .doorpi-panel-sub { text-align: left; }
        .doorpi-manager-row { background: rgba(255,255,255,.075); border: 1px solid rgba(255,255,255,.13); border-radius: 12px; color: #fff; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .doorpi-manager-form { display: grid; grid-template-columns: 1fr auto auto auto; gap: 10px; }
        .doorpi-manager-input, .doorpi-choice-trigger { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16); border-radius: 12px; color: #fff; font: inherit; padding: 13px 16px; outline: none; box-sizing: border-box; transition: all 0.2s; }
        .doorpi-manager-input:focus, .doorpi-choice-trigger:focus, .doorpi-manager-btn:focus, .doorpi-manager-btn:hover { border-color: #fff; box-shadow: 0 0 0 4px rgba(255,255,255,1); background: rgba(255,255,255,0.1); }
        .doorpi-choice-wrap { position: relative; }
        .doorpi-choice-trigger { width: 100%; min-height: 50px; display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: left; cursor: pointer; }
        .doorpi-choice-trigger::after { content: 'v'; font-size: .8rem; color: rgba(255,255,255,.58); }
        .doorpi-choice-wrap.is-disabled { opacity: .48; pointer-events: none; }
        .doorpi-choice-wrap.is-open .doorpi-choice-trigger, .doorpi-choice-option:focus { border-color: #fff; box-shadow: 0 0 0 4px rgba(255,255,255,.15); }
        .doorpi-choice-menu { display: none; position: absolute; z-index: 4; left: 0; right: 0; top: calc(100% + 6px); background: #1a1a2e; border: 1px solid rgba(255,255,255,.18); border-radius: 12px; padding: 6px; box-shadow: 0 18px 40px rgba(0,0,0,.42); }
        .doorpi-choice-wrap.is-open .doorpi-choice-menu { display: flex; flex-direction: column; gap: 4px; }
        .doorpi-choice-option { background: transparent; border: 1px solid transparent; border-radius: 8px; color: #fff; font: inherit; text-align: left; padding: 11px 12px; cursor: pointer; outline: none; transition: background 0.15s; }
        .doorpi-choice-option:hover, .doorpi-choice-option.is-selected { background: rgba(255,255,255,.11); }
        .doorpi-share-select { display: none; }

        .doorpi-manager-btn { background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.16); border-radius: 12px; color: #fff; font: inherit; font-weight: 600; padding: 12px 20px; cursor: pointer; outline: none; transition: all 0.2s; }
        .doorpi-manager-btn.primary { background: #fff; color: #07071a; border-color: transparent; transition: background 0.1s, color 0.1s; }
        .doorpi-manager-btn.primary:hover { background: #e8e8e8; color: #07071a; border-color: transparent; box-shadow: none; }
        .doorpi-manager-btn.primary:focus { background: #fff; outline: 3px solid #fff; outline-offset: 3px; box-shadow: none; transition: none !important; }
        .doorpi-manager-list { display: flex; flex-direction: column; gap: 10px; overflow: auto; padding-right: 4px; }

        .doorpi-status { min-height: 20px; color: rgba(255,255,255,.62); }
        .doorpi-status.error { color: rgba(255,110,110,.95); }
        .doorpi-status.success { color: rgba(110,230,150,.95); }
        .doorpi-share-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
        .doorpi-shared-note { font-size: .85rem; color: rgba(120,190,255,.9); margin-top: 8px; }

    /* USER CARDS STYLES */
    .doorpi-user-grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: clamp(32px, 4vw, 64px);
        width: 100%;
    }

    .doorpi-user-card {
        background: none;
        border: none;
        color: #fff;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: clamp(14px, 1.6vw, 20px);
        cursor: pointer;
        outline: none;
        padding: 0;
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        position: relative;
        animation: doorpiCardRise 0.3s cubic-bezier(0.16, 1, 0.3, 1) backwards;
        will-change: transform;
    }

    @keyframes doorpiCardRise {
        from { opacity: 0; translate: 0 24px; }
        to { opacity: 1; translate: 0 0; }
    }

    .doorpi-user-card:focus,
    .doorpi-user-card:hover {
        transform: translateY(-8px) scale(1.06);
    }

    .doorpi-avatar {
        width: clamp(170px, 12vw, 220px);
        height: clamp(170px, 12vw, 220px);
        border-radius: 50%;
        background: rgba(255,255,255,0.08);
        border: 3px solid rgba(255,255,255,0.15);
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        color: rgba(255,255,255,0.45);
        font-size: clamp(38px, 5vw, 58px);
        transition: border-color 0.25s, box-shadow 0.25s;
        position: relative;
        z-index: 2;
    }

    .doorpi-user-card:focus .doorpi-avatar,
    .doorpi-user-card:hover .doorpi-avatar {
        border-color: #fff;

    }

    .doorpi-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .doorpi-user-name {
        font-size: clamp(1rem, 1.2vw, 1.3rem);
        font-weight: 500;
        text-align: center;
        letter-spacing: 0.02em;
        color: rgba(255,255,255,0.65);
        transition: color 0.2s;
        z-index: 2;
    }

    .doorpi-user-card:focus .doorpi-user-name,
    .doorpi-user-card:hover .doorpi-user-name {
        color: #fff;
    }

    .doorpi-user-badge {
        font-size: 0.65rem;
        font-weight: 800;
        color: rgba(16, 25, 20, 0.95);
        background: rgba(120, 220, 150, 0.95);
        padding: 3px 9px;
        border-radius: 12px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        margin-top: -6px;
    }

    .doorpi-create-user-icon {
        font-size: clamp(40px, 5vw, 58px);
        font-weight: 200;
        color: rgba(255,255,255,0.35);
        transition: color 0.3s, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        line-height: 1;
    }

    .doorpi-user-card.create-card .doorpi-avatar {
        border-style: dashed;
        border-color: rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.03);
    }

    .doorpi-user-card.create-card:focus .doorpi-avatar,
    .doorpi-user-card.create-card:hover .doorpi-avatar {
        border-color: rgba(255,255,255,0.6);
    }

    .doorpi-user-card.create-card:focus .doorpi-create-user-icon,
    .doorpi-user-card.create-card:hover .doorpi-create-user-icon {
        color: #fff;
        transform: rotate(90deg) scale(1.1);
    }



        @media(max-width: 760px) {
            .doorpi-manager-form, .doorpi-share-grid { grid-template-columns: 1fr; }
            .doorpi-user-overlay, .doorpi-manager-overlay { padding: 24px; }
            .doorpi-user-panel .doorpi-panel-title { font-size: 2.5rem; }
        }
        `;
        document.head.appendChild(s);
    }

    function renderDoorpiChoice(id, options, value, disabled = false) {
        const safeOptions = Array.isArray(options) && options.length
            ? options
            : [{ value: '', label: t('noOptionsAvailable') }];
        const selected = safeOptions.find(opt => String(opt.value) === String(value)) || safeOptions[0];
        return `
            <div class="doorpi-choice-wrap${disabled ? ' is-disabled' : ''}" id="${escapeHtml(id)}" data-value="${escapeHtml(selected.value)}" data-disabled="${disabled ? 'true' : 'false'}">
                <button class="doorpi-choice-trigger" type="button" tabindex="0" aria-haspopup="listbox" aria-expanded="false">
                    <span>${escapeHtml(selected.label)}</span>
                </button>
                <div class="doorpi-choice-menu" role="listbox">
                    ${safeOptions.map(opt => `
                        <button class="doorpi-choice-option${String(opt.value) === String(selected.value) ? ' is-selected' : ''}" type="button" tabindex="0" data-value="${escapeHtml(opt.value)}" role="option">
                            ${escapeHtml(opt.label)}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function bindDoorpiChoice(root, onChange) {
        if (!root) return;
        const trigger = root.querySelector('.doorpi-choice-trigger');
        const options = Array.from(root.querySelectorAll('.doorpi-choice-option'));
        const setOpen = (open) => {
            if (root.dataset.disabled === 'true') return;
            root.classList.toggle('is-open', open);
            trigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) {
                const selected = root.querySelector('.doorpi-choice-option.is-selected') || options[0];
                selected?.focus({ preventScroll: true });
            }
        };
        trigger?.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
        options.forEach(option => {
            option.addEventListener('click', () => {
                const value = option.dataset.value || '';
                const label = option.textContent.trim();
                root.dataset.value = value;
                trigger.querySelector('span').textContent = label;
                options.forEach(opt => opt.classList.toggle('is-selected', opt === option));
                setOpen(false);
                trigger.focus({ preventScroll: true });
                onChange?.(value);
            });
        });
    }

    function setDoorpiChoiceDisabled(id, disabled) {
        const root = document.getElementById(id);
        if (!root) return;
        root.dataset.disabled = disabled ? 'true' : 'false';
        root.classList.toggle('is-disabled', disabled);
        root.classList.remove('is-open');
        root.querySelector('.doorpi-choice-trigger')?.setAttribute('aria-expanded', 'false');
    }

    function getDoorpiChoiceValue(id) {
        return document.getElementById(id)?.dataset.value || '';
    }

    function avatarMarkup(user) {
        return `<div class="doorpi-avatar">${user.PhotoBase64 ? `<img src="data:image/png;base64,${user.PhotoBase64}" />` : `<svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`}</div>`;
    }

    function showUserPicker(users, requireSelection = false) {
        if (window.DoorpiIntro?.shouldDeferUserPicker?.()) {
            window.DoorpiIntro.runAfterIntro(() => showUserPicker(users, requireSelection));
            return;
        }

        ensureDoorpiOverlayStyles();
        let overlay = document.getElementById('doorpiUserPicker');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'doorpiUserPicker';
            overlay.className = 'doorpi-user-overlay';

            // Controle de navegação forçado (Fase de Captura para bloquear a navegação nativa)
            overlay.addEventListener('keydown', (e) => {
                const active = document.activeElement || document.body;

                if (e.key === 'ArrowDown') {
                    const isUserCard = active.closest('.doorpi-user-card');
                    const isBackBtn = active.closest('#doorpiCloseUsers');

                    if (isUserCard) {
                        e.preventDefault();
                        e.stopPropagation();
                        const backBtn = overlay.querySelector('#doorpiCloseUsers');
                        if (backBtn) {
                            backBtn.focus();
                        } else {
                            overlay.querySelector('.doorpi-power-btn')?.focus();
                        }
                    } else if (isBackBtn) {
                        e.preventDefault();
                        e.stopPropagation();
                        overlay.querySelector('.doorpi-power-btn')?.focus();
                    }
                } else if (e.key === 'ArrowUp') {
                    const isPowerBtn = active.closest('.doorpi-power-btn');
                    const isBackBtn = active.closest('#doorpiCloseUsers');

                    if (isPowerBtn || isBackBtn) {
                        e.preventDefault();
                        e.stopPropagation();
                        const backBtn = overlay.querySelector('#doorpiCloseUsers');

                        // Se estivermos na energia, subir obrigatoriamente para o Back
                        if (isPowerBtn && backBtn) {
                            backBtn.focus();
                            return;
                        }

                        // Se estivermos no Back ou na energia (sem botão Back disponível), subir pros Usuários
                        const userCards = Array.from(overlay.querySelectorAll('.doorpi-user-card'));
                        if (userCards.length) {
                            const activeRect = active.getBoundingClientRect();
                            let bestCard = userCards[0];
                            let minDiff = Infinity;
                            userCards.forEach(c => {
                                const cRect = c.getBoundingClientRect();
                                const diff = Math.abs((cRect.left + cRect.width / 2) - (activeRect.left + activeRect.width / 2));
                                if (diff < minDiff) {
                                    minDiff = diff;
                                    bestCard = c;
                                }
                            });
                            bestCard.focus();
                        }
                    }
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    const isUserCard = active.closest('.doorpi-user-card');
                    if (isUserCard) {
                        e.preventDefault();
                        e.stopPropagation();
                        const userCards = Array.from(overlay.querySelectorAll('.doorpi-user-card'));
                        const currentIndex = userCards.indexOf(isUserCard);

                        if (currentIndex !== -1) {
                            if (e.key === 'ArrowLeft') {
                                const prevIndex = currentIndex > 0 ? currentIndex - 1 : userCards.length - 1;
                                userCards[prevIndex].focus();
                            } else {
                                const nextIndex = currentIndex < userCards.length - 1 ? currentIndex + 1 : 0;
                                userCards[nextIndex].focus();
                            }
                        }
                    }
                }
            }, true); // Ativa o Capture Phase

            document.body.appendChild(overlay);
        }
        overlay.dataset.required = requireSelection ? 'true' : 'false';
        if (overlay.dataset.introPickerClasses) {
            overlay.classList.remove(...overlay.dataset.introPickerClasses.split(/\s+/).filter(Boolean));
        }
        const introPickerClasses = window.DoorpiIntro?.isHandoffActive?.()
            ? (window.DoorpiIntro.getUserPickerClasses?.() || [])
            : [];
        if (introPickerClasses.length) overlay.classList.add(...introPickerClasses);
        overlay.dataset.introPickerClasses = introPickerClasses.join(' ');

        const cards = users.map((user, idx) => `
        <button class="doorpi-user-card" data-user-id="${escapeHtml(user.Id)}" tabindex="0" style="animation-delay: ${idx * 0.03}s">
            ${avatarMarkup(user)}
            <span class="doorpi-user-name">${escapeHtml(user.Name)}</span>
            ${user.Id === window._doorpiCurrentUserId ? `<span class="doorpi-user-badge">${t('badgeCurrent')}</span>` : ''}
        </button>`).join('');

        const createUserDelay = users.length * 0.03;

        const svgExit = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
        const svgSleep = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
        const svgRestart = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.84"/></svg>`;
        const svgShutdown = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`;

        overlay.innerHTML = `
            <div class="doorpi-user-panel">
                <div class="doorpi-panel-head">
                    <h2 class="doorpi-panel-title">${t('whoIsPlaying')}</h2>
                    <p class="doorpi-panel-sub">${t('welcomeBack')}</p>
                </div>
                <div class="doorpi-user-grid">
                    ${cards}
                    <button class="doorpi-user-card create-card" id="doorpiCreateUserCard" tabindex="0" style="animation-delay: ${createUserDelay}s">
                        <div class="doorpi-avatar"><div class="doorpi-create-user-icon">+</div></div>
                        <span class="doorpi-user-name">${t('newUser')}</span>
                    </button>
                </div>
                            ${requireSelection ? '' : `<button class="doorpi-manager-btn" id="doorpiCloseUsers" tabindex="0" style="margin-top: 24px; animation: doorpiCardRise 0.5s backwards; animation-delay: ${(createUserDelay + 0.1)}s">${t('btnBackLabel')}</button>`}

                <div class="doorpi-power-row" style="animation: doorpiCardRise 0.5s backwards; animation-delay: ${(createUserDelay + 0.15)}s">
                    <button class="doorpi-power-btn" id="doorpiExitApp" tabindex="0">${svgExit}${t('powerExit', 'Sair')}</button>
                    <div class="doorpi-power-sep"></div>
                    <button class="doorpi-power-btn" id="doorpiSuspend" tabindex="0">${svgSleep}${t('powerSuspend', 'Suspender')}</button>
                    <button class="doorpi-power-btn" id="doorpiRestart" tabindex="0">${svgRestart}${t('powerRestart', 'Reiniciar')}</button>
                    <button class="doorpi-power-btn p-danger" id="doorpiShutdown" tabindex="0">${svgShutdown}${t('powerShutdown', 'Desligar')}</button>
                </div>
            </div>`;

        if (typeof applyI18n === 'function') applyI18n();
        overlay.style.display = 'flex';

        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();

        const hidePicker = () => {
            overlay.style.display = 'none';
            window.DoorpiIntro?.finishHandoff?.();
        };

        overlay.querySelectorAll('[data-user-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                postToHost({ action: 'selectUser', userId: btn.dataset.userId });
                hidePicker();
            });
        });
        overlay.querySelector('#doorpiCreateUserCard')?.addEventListener('click', () => {
            hidePicker();
            openCreateUserDialog();
        });
        overlay.querySelector('#doorpiCloseUsers')?.addEventListener('click', hidePicker);

        overlay.querySelector('#doorpiExitApp')?.addEventListener('click', () => postToHost({ action: 'exitApp' }));
        overlay.querySelector('#doorpiSuspend')?.addEventListener('click', () => postToHost({ action: 'suspendSystem' }));
        overlay.querySelector('#doorpiRestart')?.addEventListener('click', () => postToHost({ action: 'restartSystem' }));
        overlay.querySelector('#doorpiShutdown')?.addEventListener('click', () => postToHost({ action: 'shutdownSystem' }));

        requestAnimationFrame(() => requestAnimationFrame(() => overlay.querySelector('.doorpi-user-card')?.focus()));
    }

    function openCreateUserDialog() {
        window.closeDoorpiTopOverlay?.(true);
        if (typeof openSetup === 'function') {
            openSetup(true);
        }
    }
    window.openExtensionsManager = function () {
        if (window.isDoorpiSessionTransitionActive?.()) return;
        // Se o Nav Menu estiver fechado, manda abrir
        if (!window.isNavMenuOpen) {
            if (typeof window.openNavMenu === 'function') {
                window.openNavMenu();
            }
        }
        setTimeout(() => {
            if (typeof window._navMenuOpenExtensions === 'function') {
                window._navMenuOpenExtensions();
            }
        }, 120);
    };

    window.openCreateUserDialog = openCreateUserDialog;

    // Handler global para atualizar extensões
    window._doorpiUpdateExtension = function (extId) {
        // 1. Altera o texto de Status global
        const statusEl = document.getElementById('navExtensionStatus');
        if (statusEl) {
            statusEl.textContent = typeof t === 'function' ? t('extDownloadingUpdate') : "Baixando atualização...";
            statusEl.className = 'nav-ext-status';
        }

        // 2. Altera visualmente o botão específico que foi clicado
        const btn = document.querySelector(`.nav-ext-btn.primary[data-id="${extId}"]`);
        if (btn) {
            btn.textContent = typeof t === 'function' ? t('extUpdatingBtn') : "Atualizando...";
            btn.style.opacity = "0.5";
            btn.style.pointerEvents = "none";
        }

        // 3. Pede pro C# fazer a atualização
        postToHost({ action: 'updateExtension', id: extId });
    };
    // Handler global para remover extensões
    window._doorpiDeleteExtension = function (extId) {
        postToHost({ action: 'deleteExtension', id: extId });
        setTimeout(() => { postToHost({ action: 'requestExtensions' }); }, 500);
    };


    window.openExtensionsManager = openExtensionsManager;
    window.openCreateUserDialog = openCreateUserDialog;

    window.isDoorpiOverlayOpen = function () {
        return Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
            .some(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
    };

    document.addEventListener('focusin', (e) => {
        if (window.isDoorpiOverlayOpen && window.isDoorpiOverlayOpen()) {
            const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
                .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
            const topOverlay = overlays.at(-1);

            if (topOverlay && !topOverlay.contains(e.target)) {
                const focusable = topOverlay.querySelector('button, input, select,[tabindex="0"]');
                if (focusable) {
                    focusable.focus();
                }
            }
        }
    });

    window.getDoorpiOverlayItems = function () {
        const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
            .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
        const top = overlays.at(-1);
        if (!top) return [];
        return Array.from(top.querySelectorAll('button, input, select, [tabindex="0"]'))
            .filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);
    };

    window.closeDoorpiTopOverlay = function (force = false) {
        const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
            .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
        const top = overlays.at(-1);
        if (!force && top?.dataset.required === 'true') return;
        if (top) {
            top.style.display = 'none';
            if (top.id === 'doorpiUserPicker') window.DoorpiIntro?.finishHandoff?.();
        }
    };

    document.addEventListener('click', (e) => {
        const input = e.target.closest?.('input[type="text"], input:not([type]), textarea');
        if (!input) return;
        if (window._vkbIsOpen) return;
        if (input.closest('.doorpi-manager-overlay, .doorpi-user-overlay, .edit-modal-overlay, #addGameContainer, #setupContainer, .nav-profile-dashboard')) {
            input.removeAttribute('readonly');
            window._vkbOpen?.(input);
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || window._vkbIsOpen) return;
        const input = e.target.closest?.('input[type="text"], input:not([type]), textarea');
        if (!input) return;
        if (input.closest('.doorpi-manager-overlay, .doorpi-user-overlay, .edit-modal-overlay, #addGameContainer, #setupContainer, .nav-profile-dashboard')) {
            e.preventDefault();
            input.removeAttribute('readonly');
            window._vkbOpen?.(input);
        }
    }, true);

    /* Seção: Overlay de Loading */
    function showGlobalLoading(titleText, subtitleText) {
        window.isGlobalLoading = true;
        window.updateNavHint?.();
        let overlay = document.getElementById('globalLoadingOverlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'globalLoadingOverlay';
            overlay.className = 'global-loading-overlay';
            document.querySelector('.modal-content-area').appendChild(overlay);
        }

        const libs = SCAN_LIBS.map((k, i) => `<div class="vb-lib ${i === 0 ? 'scanning' : ''}">${t('scanLibLabels.' + k)}</div>`).join('');

        overlay.innerHTML = `
            <div class="vb-wrap">
                <div class="vb-scanline"></div>
                <div class="vb-ghost-grid">${'<div class="vb-ghost-tile"></div>'.repeat(15)}</div>
                <div class="vb-center">
                    <div class="vb-ring-wrap">
                        <div class="vb-ring outer"></div>
                        <div class="vb-ring inner"></div>
                        <div class="vb-ring core"></div>
                        <div class="vb-ring-dot"></div>
                    </div>
                    <div class="vb-text">
                        <div class="vb-title">${titleText || t('detectingLibrary')}</div>
                        <div class="vb-subtitle">${subtitleText || t('readingApps')}</div>
                        <div class="vb-dots"><span></span><span></span><span></span></div>
                        <div class="vb-libs" id="vbLibsGlobal">${libs}</div>
                    </div>
                </div>
                <div class="vb-progress"><div class="vb-progress-fill"></div></div>
            </div>`;

        overlay.style.display = 'flex';

        if (overlay._iv) clearInterval(overlay._iv);
        let cur = 0;
        const libEls = overlay.querySelectorAll('#vbLibsGlobal .vb-lib');
        overlay._iv = setInterval(() => {
            if (overlay.style.display === 'none') { clearInterval(overlay._iv); return; }
            libEls.forEach(l => l.classList.remove('scanning'));
            if (libEls[cur]) libEls[cur].classList.add('scanning');
            cur = (cur + 1) % libEls.length;
        }, 700);
    }

    function hideGlobalLoading() {
        window.isGlobalLoading = false;
        const overlay = document.getElementById('globalLoadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            if (overlay._iv) clearInterval(overlay._iv);
        }
        window.updateNavHint?.();

        setTimeout(() => {
            if (!window.isModalOpen && !window.isSetupOpen && !window._vkbIsOpen && !window.isDoorpiOverlayOpen?.()) {
                const currentTab = (typeof window.getCurrentHomeTab === 'function') ? window.getCurrentHomeTab() : 'games';
                const grid = document.getElementById(currentTab === 'media' ? 'mediaGrid' : 'gameGrid');
                if (grid) {

                    const target = grid.querySelector('.card.featured') || grid.querySelector('.card:not(.add-card)') || grid.querySelector('.card.add-card');
                    if (target) target.focus();
                }
            }
        }, 80);
    }

    /* Seção: Utilitários de atualização de imagens */
    function updateToLocalFile(gameId, imageType, newUrl) {
        const safeId = gameId.replace(/\\/g, '\\\\');
        const card = document.querySelector(`.card[data-game-id="${safeId}"]`)
            ?? document.querySelector(`.card[data-app-id="${safeId}"]`);
        if (!card) return;
        const keyMap = { GridStatic: 'staticVertical', HorizontalStatic: 'staticHorizontal', HeroStatic: 'staticHero', LogoStatic: 'staticLogo' };
        const key = keyMap[imageType];
        if (!key) return;

        card.dataset[key] = newUrl;
        const img = card.querySelector('img');
        const isFeatured = card.classList.contains('featured');

        if (img && document.activeElement !== card && !card.matches(':hover')) {
            if ((isFeatured && key === 'staticHorizontal') || (!isFeatured && key === 'staticVertical')) {
                img.src = newUrl;
                img.style.opacity = '1';
            }
        }
        if (isFeatured && key === 'staticHero') switchHeroBackground(newUrl, card.dataset.staticLogo || card.dataset.logo);
    }

    const _TAB_MAP = { 'apps': 0, 'media-apps': 1, 'folders': 2 };
    const _VIEW_MAP = { 'apps': 'view-apps', 'media-apps': 'view-media-apps', 'folders': 'view-folders' };

    function switchTab(tabId) {
        document.querySelectorAll('.menu-tab').forEach((btn, i) => {
            const id = Object.keys(_TAB_MAP)[i];
            btn.classList.toggle('active', id === tabId);
        });
        document.querySelectorAll('.view-section').forEach(v => {
            v.classList.remove('active');
            v.classList.add('hidden');
        });
        const view = document.getElementById(_VIEW_MAP[tabId]);
        view?.classList.remove('hidden');
        view?.classList.add('active');

        // Controle inteligente de exibição dos botões
        const modalActions = document.getElementById('modalActions');
        const mediaAppActions = document.getElementById('mediaAppActions');

        if (tabId === 'apps') {
            if (modalActions) modalActions.style.display = 'flex';
            if (mediaAppActions) mediaAppActions.style.display = 'none';
            refreshInstalledAppsView(); // Força a lista a renderizar novamente
        }
        else if (tabId === 'folders') {
            if (modalActions) modalActions.style.display = 'none';
            if (mediaAppActions) mediaAppActions.style.display = 'none';
            if (cachedFolders === null) {
                showGlobalLoading(t('foldersTitle'), t('readingApps'));
                requestFolders();
            } else {
                renderFolderList(cachedFolders);
            }
        }
        else if (tabId === 'media-apps') {
            if (modalActions) modalActions.style.display = 'none';
            if (mediaAppActions) mediaAppActions.style.display = 'flex';
            _initMediaAppsView();
        }
    }
    /* Seção: Filtros e barra de filtros */
    currentSourceFilter = ['all'];
window.isBackgroundScanning = false;
window.lastScanText = "Buscando..."; // Memória para não perder o texto ao trocar de aba

window.setInlineScanStatus = function (isScanning, text) {
    window.isBackgroundScanning = isScanning;
    if (text) window.lastScanText = text; // Salva o texto!

    const statusEl = document.getElementById('inlineScanStatus');
    const textEl = document.getElementById('inlineScanText');

    if (statusEl) {
        if (isScanning) {
            statusEl.classList.add('visible');
            if (text && textEl) textEl.textContent = text;
        } else {
            statusEl.classList.remove('visible');
        }
    }
};

function buildFilterBar(apps) {
    const bar = document.getElementById('filterBar');
    if (!bar) return;

    const present = new Set(apps.map(a => a.Source || a.source));
    const keys = ['all', ...Object.keys(FILTER_SOURCES).filter(k => k !== 'all' && FILTER_SOURCES[k].some(s => present.has(s)))];

    let html = keys.map(k => {
        const isActive = currentSourceFilter.includes(k);
        return `
                <button class="filter-btn ${isActive ? 'active' : ''}" tabindex="0" data-source="${k}">
                    ${typeof t === 'function' ? t('filterLabels.' + k) : k}
                </button>
            `;
    }).join('');

    // Puxa o texto salvo na memória para não sumir ao trocar de aba!
    html += `
            <div class="inline-scan-status ${window.isBackgroundScanning ? 'visible' : ''}" id="inlineScanStatus">
                <div class="inline-scan-spinner"></div>
                <span id="inlineScanText">${window.lastScanText}</span>
            </div>
        `;

    bar.innerHTML = html;

    bar.querySelectorAll('.filter-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            const clicked = btn.dataset.source;

            if (clicked === 'all') {
                currentSourceFilter = ['all'];
            } else {
                currentSourceFilter = currentSourceFilter.filter(s => s !== 'all');

                if (currentSourceFilter.includes(clicked)) {
                    currentSourceFilter = currentSourceFilter.filter(s => s !== clicked);
                } else {
                    currentSourceFilter.push(clicked);
                }

                if (currentSourceFilter.length === 0) currentSourceFilter = ['all'];
            }

            applyFilterAndRender();

            setTimeout(() => {
                const alvo = document.querySelector(`.filter-bar .filter-btn[data-source="${clicked}"]`);
                if (alvo) alvo.focus();
                else document.querySelector('.filter-bar .filter-btn')?.focus();
            }, 10);
        })
    );
}

    function applyFilterAndRender() {
        let filtered;

        if (currentSourceFilter.includes('all')) {
            filtered = allInstalledApps;
        } else {
            const allowedPlatforms = currentSourceFilter.flatMap(f => FILTER_SOURCES[f]);
            filtered = allInstalledApps.filter(a => allowedPlatforms.includes(a.Source || a.source));
        }

        filtered = filtered.filter(a => (a.AddedTo || a.addedTo) !== 'media');

        populateAppModal(filtered);
    }

    function refreshInstalledAppsView() {
        const activeView = document.querySelector('.view-section.active')?.id;
        const exeActive = activeView === 'view-media-apps' &&
            document.getElementById('subview-exe')?.classList.contains('active');

        if (exeActive) {
            _renderExeAppModal();
            return;
        }

        applyFilterAndRender();
    }

document.getElementById('btnAdd').addEventListener('click', () => {
    if (window.DoorpiIntro?.isRunning?.()) {
        window.DoorpiIntro.skip?.();
        return;
    }
    isModalOpen = true;
    _modalReady = false;
    if (isSetupOpen) return;
    document.getElementById('modalActions').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'hidden';
    document.getElementById('addGameContainer').style.display = 'flex';
    document.getElementById('modalTitle').innerText = typeof t === 'function' ? t('detectingLibrary') : 'Buscando...';


    window.setInlineScanStatus(true, "Buscando jogos...");

    switchTab('apps');
    postToHost({ action: 'requestInstalledApps' });
    postToHost({ action: 'startAppPolling' });
});

document.getElementById('btnAddMedia')?.addEventListener('click', () => {
    if (window.DoorpiIntro?.isRunning?.()) {
        window.DoorpiIntro.skip?.();
        return;
    }
    isModalOpen = true;
    _modalReady = false;
    if (isSetupOpen) return;
    document.getElementById('modalActions').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'hidden';
    document.getElementById('addGameContainer').style.display = 'flex';
    document.getElementById('modalTitle').innerText = typeof t === 'function' ? t('detectingLibrary') : 'Buscando...';

    // SUBSTITUIÇÃO: Aciona o loading no canto superior da tela!
    window.setInlineScanStatus(true, "Buscando apps...");

    switchTab('media-apps');
    postToHost({ action: 'requestInstalledApps' });
    postToHost({ action: 'startAppPolling' });
});

    function closeModal() {
        document.getElementById('addGameContainer').style.display = 'none';
        document.getElementById('gameGrid').style.overflowX = 'auto';
        document.getElementById('selectionCounter')?.classList.remove('visible');
        isModalOpen = false;
        hideGlobalLoading();

        postToHost({ action: 'stopAppPolling' });
        window.focusFeaturedCard?.();
    }

    function formatBytes(kb) {
        if (!kb) return '';
        const mb = kb / 1024;
        return mb > 1024 ? t('unitGB', (mb / 1024).toFixed(2)) : t('unitMB', mb.toFixed(0));
    }

    function populateAppModal(apps) {
        const titleEl = document.getElementById('modalTitle');
        titleEl.innerText = currentSourceFilter.includes('all') ? t('selectApps') : t('showingStore', currentSourceFilter);

        const rebind = (id, fn) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const fresh = btn.cloneNode(true);
            btn.replaceWith(fresh);
            fresh.addEventListener('click', fn);
        };

        rebind('btnSearch', () => {

            if (document.getElementById('modalActions').style.display === 'none') {
                const activeView = document.querySelector('.view-section.active')?.id;

    
                if (activeView === 'view-folders') {
                    document.getElementById('btnScanFolder')?.click();
                }
             
                else if (activeView === 'view-media-apps' && document.getElementById('subview-exe')?.classList.contains('active')) {
                    document.getElementById('btnSearchMedia')?.click();
                }
                return; 
            }

           
            window.setInlineScanStatus?.(true, "Aguardando o Windows...");
            postToHost({
                action: 'browseManual',
                dialogTitle: t('dlgBrowseTitle'),
                dialogFilter: t('dlgBrowseFilter'),
                loadingTitle: t('loadingAddingGame'),
                loadingSub: t('loadingFetchingCovers'),
                errorMsg: t('msgErrorOpenFile')
            });
        });

        rebind('btnScanFolder', () => {
            window.setInlineScanStatus?.(true, "Aguardando o Windows...");
            postToHost({
                action: 'pickFolder',
                dialogTitle: t('dlgFolderTitle'),
                forbiddenMsg: t('msgFolderForbidden'),
                forbiddenTitle: t('msgFolderForbiddenTitle'),
                errorMsg: t('msgErrorOpenFolder')
            });
        });
        buildFilterBar(allInstalledApps);

        const appList = document.getElementById('appList');
        if (!apps || apps.length === 0) {
            appList.innerHTML = `
            <div class="app-scan-empty">
                <div class="app-scan-pulse"></div>
                <div>
                    <strong>Procurando jogos e aplicativos</strong>
                    <span>Os primeiros resultados aparecem aqui assim que forem encontrados.</span>
                </div>
            </div>`;
            document.getElementById('modalActions').style.display = 'flex';
            document.getElementById('selectionCounter')?.classList.remove('visible');
            rebindActionButtons();

      
            if (!isFolderOperationInProgress) {
                requestAnimationFrame(() => {
                    _modalReady = true;
                });
            }
            return;
        }

        appList.innerHTML = apps.map(app => {
            const isAdded = app.IsAdded === true || app.isAdded === true;
            const icon = app.IconBase64 || app.iconBase64;
            const name = app.Name || app.name;
            const path = app.Path || app.path;
            const size = app.Size ?? app.size;
            const launch = app.LaunchUrl || app.launchUrl || '';
            const source = app.Source || app.source;
            const addState = app.AddState || app.addState || '';
            const isPreparing = addState === 'preparing' || (app.AddedTo || app.addedTo) === 'preparing-game';
            const stateLabel = isPreparing ? 'Preparando capa' : (isAdded ? 'Já adicionado' : '');

            return `
            <div class="app-item ${isAdded ? 'already-added' : ''} ${isPreparing ? 'preparing-artwork' : ''}" ${isAdded ? '' : 'tabindex="0"'}
                 data-path="${path.replace(/\\/g, '\\\\')}" data-launch="${launch}"
                 data-name="${name.replace(/"/g, '&quot;')}">
                ${icon ? `<img class="app-icon" src="data:image/png;base64,${icon}" />` : ''}
                <div class="app-item-info">
                    <span class="app-name">${name}</span>
                    ${size ? `<span class="size">${formatBytes(size)}</span>` : ''}
                    ${stateLabel ? `<span class="app-state">${stateLabel}</span>` : ''}
                </div>
                ${getPlatformBadge(source)}
            </div>`;
        }).join('');

        document.getElementById('modalActions').style.display = 'flex';
        document.getElementById('selectionCounter')?.classList.remove('visible');

        appList.querySelectorAll('.app-item:not(.already-added)').forEach(item =>
            item.addEventListener('click', function () {
                this.classList.toggle('selected');
                const count = appList.querySelectorAll('.app-item.selected').length;
                const counter = document.getElementById('selectionCounter');
                const text = document.getElementById('selectionCounterText');
                if (text) text.innerText = count === 1 ? t('selectedOne') : t('selectedMany', count);
                counter?.classList.toggle('visible', count > 0);
            })
        );

        function rebindAction(id, fn) {
            const btn = document.getElementById(id);
            if (!btn) return;
            const fresh = btn.cloneNode(true);
            btn.replaceWith(fresh);
            fresh.addEventListener('click', fn);
        }

        function rebindActionButtons() {
        rebindAction('btnCancelAdd', closeModal);
        rebindAction('btnConfirmAdd', () => {
            // Verifica se a ABA PRINCIPAL DE MÍDIA é a que está visível na tela no momento
            const isMediaViewActive = document.getElementById('view-media-apps')?.classList.contains('active');

            // Se a tela de Mídia estiver aberta, repassa a ação para o controle funcionar nela
            if (isMediaViewActive) {
                if (document.getElementById('subview-web')?.classList.contains('active')) {
                    document.getElementById('btnAddWebApp')?.click();
                } else {
                    document.getElementById('btnConfirmAddMedia')?.click();
                }
                return;
            }

            // Lógica normal se estivermos na aba de JOGOS (view-apps)
            const selected = Array.from(appList.querySelectorAll('.app-item.selected')).map(el => ({
                Name: el.dataset.name, Path: el.dataset.path, LaunchUrl: el.dataset.launch,
            }));

            if (selected.length > 0) {
                selected.forEach(g => newGameIdsThisSession.add(g.LaunchUrl || g.Path));
                postToHost({ action: 'addSelectedGames', games: selected });
                showLoadingCards(selected.length, 'games');
                closeModal(); // Fecha instantaneamente e deixa os skeletons na UI
            } else {
                closeModal();
            }
        });
        }
        rebindActionButtons();

        // CORREÇÃO: Removemos o hideGlobalLoading() daqui também!
        if (!isFolderOperationInProgress) {
            requestAnimationFrame(() => {
                _modalReady = true;
            });
        }
    }

    /* Seção: Pastas */
    function requestFolders() {
        postToHost({ action: 'requestFolders' });
    }

function renderFolderList(folders) {
    const list = document.getElementById('folderList');
    const totalBar = document.getElementById('folderTotalTime');
    if (!list) return;

    // Oculta a barra de tempo total que existia no design antigo
    if (totalBar) totalBar.style.display = 'none';

    if (!folders || folders.length === 0) {
        list.innerHTML = `
                <div class="folder-empty">
                    <div class="folder-empty-icon">◫</div>
                    <div class="folder-empty-text">${t('foldersEmpty')}</div>
                    <div class="folder-empty-hint">${t('foldersEmptyHint')}</div>
                </div>`;
        return;
    }

    list.innerHTML = folders.map(folder => {
        const isAnalyzing = folder.EstimatedMs === -1;
        const folderPath = folder.Path || folder.path || '';
        const pSafe = folderPath.replace(/\\/g, '\\\\').replace(/"/g, '&quot;');

        // Se ainda estiver na fase de engate, mostra uma opacidade leve para indicar que está sendo lido
        const analyzingClass = isAnalyzing ? 'is-analyzing' : '';

        return `
            <div class="folder-item ${analyzingClass}" data-path="${pSafe}">
                <div class="folder-item-header">
                    <div class="folder-info">
                        <span class="folder-icon">◫</span>
                        <span class="folder-path" title="${folderPath}">${folderPath}</span>
                    </div>
                    <div class="folder-actions">
                        <button class="icon-btn edit-btn" tabindex="0" data-path="${pSafe}">${t('btnEditLabel')}</button>
                        <button class="icon-btn delete-btn" tabindex="0" data-path="${pSafe}">${t('btnDeleteLabel')}</button>
                    </div>
                </div>
            </div>`;
    }).join('');

    list.querySelectorAll('.edit-btn').forEach(btn =>
        btn.addEventListener('click', e => {
            e.stopPropagation();
            window.setInlineScanStatus?.(true, "Aguardando o Windows...");
            postToHost({
                action: 'editFolder',
                path: btn.dataset.path.replace(/\\\\/g, '\\'),
                dialogTitle: t('dlgEditFolderTitle'),
                forbiddenMsg: t('msgFolderForbidden'),
                forbiddenTitle: t('msgFolderForbiddenTitle'),
                errorMsg: t('msgErrorEditFolder')
            });
        })
    );

    list.querySelectorAll('.delete-btn').forEach(btn =>
        btn.addEventListener('click', e => {
            e.stopPropagation();
            window.setInlineScanStatus?.(true, "Atualizando lista...");
            postToHost({ action: 'deleteFolder', path: btn.dataset.path.replace(/\\\\/g, '\\') });
        })
    );
}

    // ── Utilitário compartilhado — detecta animação e salva frame estático ────────
    async function processImage(card, src, dsKey, imageType, entityId) {
        if (!src || card.dataset[dsKey]) return;
        const blob = await getAnimatedBlob(src);
        if (!blob) { card.dataset[dsKey] = src; return; }
        return new Promise(resolve => {
            const tmp = new Image(), blobUrl = URL.createObjectURL(blob);
            tmp.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = tmp.naturalWidth; c.height = tmp.naturalHeight;
                    c.getContext('2d').drawImage(tmp, 0, 0);
                    postToHost({ action: 'saveStaticFrame', gameId: entityId, imageType, base64: c.toDataURL('image/png') });
                } catch { card.dataset[dsKey] = src; }
                finally { URL.revokeObjectURL(blobUrl); resolve(); }
            };
            tmp.onerror = () => { card.dataset[dsKey] = src; URL.revokeObjectURL(blobUrl); resolve(); };
            tmp.src = blobUrl;
        });
    }


    function moveCardToTop(card) {
        if (!card) return;
        const grid = card.closest('#gameGrid') || card.closest('#mediaGrid') || document.getElementById('gameGrid');

        grid.querySelectorAll('.card.featured').forEach(c => {
            if (c === card) return;
            c.classList.remove('featured');
            const img = c.querySelector('img');
            if (img) img.src = c.dataset.staticVertical || c.dataset.vertical || '';
        });

        card.classList.add('featured');
        grid.prepend(card);

        const img = card.querySelector('img');
        if (img) {
            img.src = card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical || '';
        }

        grid.scrollTo({ left: 0, behavior: 'smooth' });
    }

    /* Seção: Hero background */
    let _heroTimer = null;
    let _currentBgSrc = '';
    let _heroReqId = 0;

    function cancelHeroTransition() {
        if (_heroTimer) { clearTimeout(_heroTimer); _heroTimer = null; }

        document.querySelectorAll('.crossfade-clone-heroImage, .crossfade-clone-gridBgImg').forEach(c => {
            c.style.setProperty('transition', 'opacity 0.2s ease-out', 'important');
            c.style.opacity = '0';
            setTimeout(() => { if (c.parentNode) c.remove(); }, 200);
        });
    }
    function preloadImage(src) {
        return new Promise(resolve => {
            if (!src) return resolve();
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve;
            img.src = src;
        });
    }

    async function crossfadeBanner(el, newSrc) {
        if (!el || !newSrc) return;
        if (el.src === newSrc || el.src.endsWith(newSrc)) {
            el.style.opacity = '1';
            return;
        }

        const tempImg = new Image();
        tempImg.src = newSrc;
        try { await tempImg.decode(); } catch (e) { }

        const comp = window.getComputedStyle(el);
        const cloneClass = `crossfade-clone-${el.id}`;

        document.querySelectorAll(`.${cloneClass}`).forEach(c => c.remove());

        const clone = el.cloneNode(true);
        clone.classList.add(cloneClass);
        clone.style.position = 'absolute';
        clone.style.zIndex = parseInt(comp.zIndex) + 1;
        clone.style.pointerEvents = 'none';
        clone.style.opacity = comp.opacity;
        clone.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)';

        clone.style.webkitMaskImage = comp.webkitMaskImage;
        clone.style.maskImage = comp.maskImage;
        clone.style.webkitMaskComposite = comp.webkitMaskComposite;
        clone.style.maskComposite = comp.maskComposite;

        el.parentNode.insertBefore(clone, el.nextSibling);

        el.style.transition = 'none';
        el.style.opacity = '1';
        el.src = newSrc;

        void el.offsetWidth;

        requestAnimationFrame(() => {
            clone.style.opacity = '0';
            setTimeout(() => { if (clone.parentNode) clone.remove(); }, 900);
        });
    }

    function switchHeroBackground(bgSrc, logoSrc, heroSrc) {
        if (window._userSwitching) return;


        const currentTab = (typeof window.getCurrentHomeTab === 'function') ? window.getCurrentHomeTab() : 'games';
        const gridId = currentTab === 'media' ? 'mediaGrid' : 'gameGrid';
        const grid = document.getElementById(gridId);

        if (grid && !grid.querySelector('.card:not(.add-card)')) {
            if (typeof clearHero === 'function') clearHero(true);
            return;
        }

        // ── CORREÇÃO: SE NÃO TEM HERO, LIMPA O FUNDO PRO BLOB ASSUMIR ──
        if (!bgSrc) {
            if (typeof clearHero === 'function') clearHero();
            return;
        }
        // ───────────────────────────────────────────────────────────────

        if (window._heroCleanupTimer) {
            clearTimeout(window._heroCleanupTimer);
            window._heroCleanupTimer = null;
        }
        const heroImg = document.getElementById('heroImage');
        const logoImg = document.getElementById('gameLogo');
        const gridBg = document.getElementById('gridBgImg');
        const bgBlur = document.getElementById('bgBlur');

        if (!bgSrc) return;

        if (_currentBgSrc.split('?')[0] === bgSrc.split('?')[0]) {
            if (heroImg) heroImg.style.opacity = '1';
            if (gridBg) gridBg.style.opacity = '1';
            if (bgBlur) bgBlur.style.opacity = '1';
            if (logoImg && logoImg.src) logoImg.classList.add('visible');
            return;
        }

        _currentBgSrc = bgSrc;

        cancelHeroTransition();
        const reqId = ++_heroReqId;

        if (logoImg) logoImg.classList.remove('visible');

        const loadPromise = Promise.all([
            preloadImage(heroSrc || bgSrc),
            preloadImage(bgSrc),
            logoSrc ? preloadImage(logoSrc) : Promise.resolve()
        ]);
        const minTimePromise = new Promise(resolve => setTimeout(resolve, 0));

        Promise.all([loadPromise, minTimePromise]).then(() => {
            if (reqId !== _heroReqId) return;

            if (heroImg) crossfadeBanner(heroImg, heroSrc || bgSrc);

            if (gridBg) {
                gridBg.style.transition = 'none';
                gridBg.style.opacity = '1';
                gridBg.src = heroSrc || bgSrc;
            }

            if (bgBlur) {
                bgBlur.style.transition = 'none';
                bgBlur.style.opacity = '1';
                if (bgBlur.tagName === 'IMG') bgBlur.src = heroSrc || bgSrc;
            }

            if (logoImg) {
                if (logoSrc) {
                    setTimeout(() => {
                        if (reqId !== _heroReqId) return;
                        setImgSrc(logoImg, logoSrc).then(() => {
                            requestAnimationFrame(() => logoImg.classList.add('visible'));
                        });
                    }, 200);
                }
            }
        });
    }

    /* Seção: Badges e verificação de animações */
    function getPlatformBadge(source) {
        const p = PLATFORMS[source];
        if (!p) return '';
        const labelKey = source === 'Battle.net' ? 'BattleNet' : source;
        const label = t('platformLabels.' + labelKey);
        const inner = p.type === 'url' ? `<img src="${p.icon}" alt="${label}" />` : p.icon;
        return `<span class="platform-badge" title="${label}">${inner}</span>`;
    }

    async function getAnimatedBlob(url) {
        if (!url) return null;
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const blob = await res.blob();
            const bytes = new Uint8Array(await blob.slice(0, 256).arrayBuffer());
            const APNG = [0x61, 0x63, 0x54, 0x4C], WEBP = [0x41, 0x4E, 0x49, 0x4D];
            let isAnim = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
            for (let i = 0; !isAnim && i < bytes.length - 4; i++) {
                if (bytes.slice(i, i + 4).every((v, j) => v === APNG[j])) isAnim = true;
                if (bytes.slice(i, i + 4).every((v, j) => v === WEBP[j])) isAnim = true;
            }
            return isAnim ? blob : null;
        } catch { return null; }
    }

    async function setImgSrc(imgEl, src) {
        if (!imgEl) return;

        const req = Symbol();
        imgEl.__req = req;

        if (!src) {
            imgEl.removeAttribute('src');
            return;
        }

        if (imgEl.src === src || imgEl.src.endsWith(src)) {
            imgEl.style.opacity = '1';
            return;
        }

        const tmp = new Image();
        tmp.loading = "eager";
        tmp.decoding = "async";
        tmp.src = src;

        try {
            await tmp.decode();

            if (imgEl.__req === req) {
                imgEl.src = src;
                imgEl.style.transition = 'none';
                imgEl.style.opacity = '1';
            }
        } catch (e) {
            if (imgEl.__req === req) {
                imgEl.src = src;
                imgEl.style.opacity = '1';
            }
        }
    }

    function toggleNavMenu(isOpen) {
        const hint = document.getElementById('navHintDown');
        if (isOpen) {
            if (typeof _stopBlobBg === 'function') _stopBlobBg();
            document.body.classList.add('nav-menu-active');
            hint?.classList.add('visible', 'nav-open');
        } else {
            document.body.classList.remove('nav-menu-active');
            hint?.classList.remove('nav-open');
            setTimeout(() => {
                if (typeof _startBlobBg === 'function') _startBlobBg();
            }, 800);
            window.updateNavHint?.();
        }
    }


    // Para aplicar, você pode inserir dinamicamente:
    const s = document.createElement('style');

    document.head.appendChild(s);
    /* Seção: Injeção de estilos e elementos auxiliares */
    (function injectStyles() {
        const s = document.createElement('style');
        s.textContent = `
        .inline-scan-status {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto; /* Empurra para o canto direito */
        font-size: 0.75rem;
        color: rgba(120, 190, 255, 0.9);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 600;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
    }
    .inline-scan-status.visible {
        opacity: 1;
    }
    .inline-scan-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(120, 190, 255, 0.3);
        border-top-color: rgba(120, 190, 255, 1);
        border-radius: 50%;
        animation: inlineSpin 0.8s linear infinite;
    }
    @keyframes inlineSpin { to { transform: rotate(360deg); } }
    .home-tabs-hint {
        /* margin-left: auto;  ← remover esta linha */
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: 'Outfit', sans-serif;
        font-size: clamp(0.6rem, 1vw, 1.4rem);
        color: rgba(255, 255, 255, 1);
        letter-spacing: 0.05em;
        user-select: none;
    }
        .home-tabs-hint b {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            padding: 1px 5px;
            font-weight: 600;
            font-size: 0.95em;
            color: #fff;
        }
        /* ── Skeletons de Loading (Tamanho e Shimmer perfeitos) ── */
        .card.loading-card {
            pointer-events: none;
            position: relative;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.02);
        }
        .card.loading-card img {
            display: none !important;
        }
        .card.loading-card::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: linear-gradient(
                90deg,
                rgba(255,255,255,0.02) 0%,
                rgba(255,255,255,0.08) 40%,
                rgba(255,255,255,0.02) 100%
            );
            background-size: 200% 100%;
            animation: cardShimmer 1.4s ease infinite;
            z-index: 1;
        }
        @keyframes cardShimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
            /* Camadas de Renderização Otimizadas */
            .main-content-wrapper,
            #heroImage,
            #gridBgImg,
            #bgBlur,
            #gameLogo,
            [class*="crossfade-clone-"] {
                backface-visibility: hidden;
                transform: translateZ(0); /* Força aceleração 2D simples */
            }

            body.nav-menu-active .main-content-wrapper,
            body.nav-menu-active #heroImage,
            body.nav-menu-active #gridBgImg,
            body.nav-menu-active #bgBlur,
            body.nav-menu-active #gameLogo,
            body.nav-menu-active [class*="crossfade-clone-"],
            body.nav-menu-closing .main-content-wrapper,
            body.nav-menu-closing #heroImage,
            body.nav-menu-closing #gridBgImg,
            body.nav-menu-closing #bgBlur,
            body.nav-menu-closing #gameLogo,
            body.nav-menu-closing [class*="crossfade-clone-"] {
                will-change: transform, opacity;
            }

            /* 1. Transição com curva Sharp (Melhor para 60Hz) */
            .main-content-wrapper,
            #heroImage,
            #gridBgImg,
            #bgBlur,
            #gameLogo,[class*="crossfade-clone-"] {
                /* Curva 'Quintic Out': Começa muito rápido, termina muito lento */
                transition: transform 0.60s cubic-bezier(0.23, 1, 0.32, 1), 
                            opacity 0.25s ease-out !important;
            }

            /* 2. Movimento Consistente */
            body.nav-menu-active .main-content-wrapper,
            body.nav-menu-active #heroImage,
            body.nav-menu-active #gridBgImg,
            body.nav-menu-active #bgBlur,
            body.nav-menu-active #gameLogo,
            body.nav-menu-active [class*="crossfade-clone-"] {
                transform: translateY(-100vh) !important;
                opacity: 0 !important;
            }

            /* 3. Desligar o Blur IMEDIATAMENTE (O maior peso no 60Hz) */
            body.nav-menu-active #bgBlur,
            body.nav-menu-active [class*="crossfade-clone-bgBlur"] {
                filter: none !important;
            }

            /* 4. Blob Background (Aparece sem competir com o scroll) */
            #appBlobBg {
                z-index: -1;
                pointer-events: none;
            }
        
            body.nav-menu-active #appBlobBg {
                opacity: 1 !important;
                transition: opacity 0.4s ease-in 0.2s !important; 
            }

            .nav-menu {
                transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.4, 1), opacity 0.4s ease;
                transform-origin: top right;
            }
    .card.new-game {
            position: relative;
        }
        .card.new-game::before {
    content: attr(data-badge-new);
        position: absolute;
        top: clamp(8px, 0.63vw, 12px);
        left: clamp(8px, 0.63vw, 12px);
        z-index: 10;
        background: #fff;
        color: #06060e;
        font-size: clamp(0.48rem, 0.50vw, 0.60rem);
        font-weight: 800;
        letter-spacing: 0.2em;
        width: 5.4em;
        padding: 3px 7px 4px;
        border-radius: 3px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
        animation: badge-enter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        background-image: none;
        }

    body.nav-menu-active .nav-menu {
        transform: scale(1) translateX(0) !important;
        opacity: 1;
    }
        /* ▼ Novo Indicador Sutil ▼ */
    #navHintDown {
        position: fixed;
        bottom: 0.2rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
    }
    #navHintDown.visible { opacity: 1; }
    #navHintDown.nav-open { bottom: auto; top: 2rem; }
    #navHintDown.nav-open svg { transform: rotate(180deg); }
        .context-menu {
            position: fixed;
            z-index: 9999;
            display: none;
            flex-direction: column;
            background: rgb(13 13 43 / 95%);
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 12px;
            padding: 6px;
            min-width: 210px;
            box-shadow: 0 16px 48px rgba(0,0,0,0.75);
            backdrop-filter: blur(28px);
            opacity: 0;
            transform: scale(0.93) translateY(-5px);
            transition: opacity 0.13s ease, transform 0.13s ease;
            pointer-events: none;
        }
        .context-menu.visible {
            opacity: 1; transform: scale(1) translateY(0); pointer-events: all;
        }
        .ctx-game-name {
            padding: 8px 14px 4px;
            font-size: 10.5px;
            color: rgba(255,255,255,0.32);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.09em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 230px;
        }
        .ctx-separator { height: 1px; background: rgba(255,255,255,0.07); margin: 6px 2px; }
        .ctx-item {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 14px;
            border: none; background: none;
            color: rgba(255,255,255,0.82);
            font-size: 13.5px; font-family: inherit; font-weight: 450;
            border-radius: 8px; cursor: pointer;
            text-align: left; width: 100%;
            transition: background 0.1s, color 0.1s;
        }
        .ctx-item:hover, .ctx-item:focus { background: rgba(255,255,255,0.09); color: #fff; outline: none; }
        .ctx-item.ctx-danger:hover, .ctx-item.ctx-danger:focus { background: rgba(220,50,50,0.18); color: #ff6e6e; }
        .ctx-item .ctx-icon { width: 16px; text-align: center; opacity: 0.6; font-size: 15px; flex-shrink: 0; }
        .ctx-item.ctx-toggle-item { justify-content: space-between; gap: 14px; }
        .ctx-item.ctx-toggle-item .ctx-icon {
            width: 20px;
            height: 20px;
            min-width: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.24);
            background: rgba(255,255,255,0.04);
            color: transparent;
            opacity: 1;
            font-size: 12px;
            font-weight: 700;
            transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, transform 0.12s ease;
        }
        .ctx-item.ctx-toggle-item.on {
            background: rgba(90,150,255,0.12);
            color: #fff;
        }
        .ctx-item.ctx-toggle-item.on .ctx-icon {
            border-color: rgba(120,190,255,0.92);
            background: rgba(120,190,255,0.95);
            color: #06111f;
            transform: scale(1.04);
        }
        .ctx-item.ctx-toggle-item:not(.on) .ctx-icon {
            color: transparent;
        }

        .edit-modal-overlay {
            position: fixed; inset: 0; z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.55); backdrop-filter: blur(14px);
            animation: editOverlayIn 0.15s ease;
            transition: align-items 0.3s ease, padding-top 0.3s ease;
        }
        .edit-modal-overlay.vkb-active { align-items: flex-start; padding-top: 36px; }
        .edit-modal {
            background: rgba(14,14,20,0.99);
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 20px;
            padding: 0;
            width: min(560px, 90vw);
            box-shadow: 0 24px 64px rgba(0,0,0,0.8);
            display: flex; flex-direction: column;
            overflow: hidden;
            animation: editModalIn 0.16s ease;
        }
        .edit-modal-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 20px 24px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .edit-modal-title {
            font-size: 15px; font-weight: 650; color: #fff; margin: 0;
            letter-spacing: 0.01em;
        }
        .edit-modal-subtitle {
            font-size: 11px; color: rgba(255,255,255,0.3);
            margin: 2px 0 0; font-weight: 400;
        }
        .edit-modal-body {
            padding: 20px 24px;
            display: flex; flex-direction: column; gap: 18px;
            max-height: 60vh; overflow-y: auto;
        }
        .edit-modal-field { display: flex; flex-direction: column; gap: 6px; }
        .edit-modal-label {
            font-size: 10px; text-transform: uppercase; letter-spacing: 0.10em;
            color: rgba(255,255,255,0.32); font-weight: 600;
        }
        .edit-modal-input {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 9px; padding: 11px 14px;
            color: #fff; font-size: 15px; font-family: inherit;
            outline: none; width: 100%; box-sizing: border-box;
            transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
            cursor: pointer;
            caret-color: rgba(100,160,255,0.9);
        }
        .edit-modal-input:hover {
            background: rgba(255,255,255,0.08);
            border-color: rgba(255,255,255,0.18);
        }
        .edit-modal-input:focus {
            background: rgba(255,255,255,0.07);
            border-color: rgba(100,160,255,0.5);
            box-shadow: 0 0 0 3px rgba(100,160,255,0.09);
        }
        .edit-modal-input.vkb-active {
            border-color: rgba(100,160,255,0.6);
            box-shadow: 0 0 0 3px rgba(100,160,255,0.12);
        }
        .edit-modal-input-hint {
            font-size: 10px; color: rgba(255,255,255,0.22);
            display: flex; align-items: center; gap: 4px;
        }
        .edit-modal-actions {
            display: flex; gap: 8px; justify-content: flex-end;
            padding: 14px 24px 18px;
            border-top: 1px solid rgba(255,255,255,0.07);
        }

        .vkb-overlay {
            position: fixed;
            bottom: 0; left: 0; right: 0;
            z-index: 10001;
            padding: 0 clamp(24px, 4vw, 80px) clamp(24px, 3vh, 48px);
            background: linear-gradient(to top, rgba(5,5,10,1) 65%, rgba(5,5,10,0.96) 85%, transparent 100%);
            transform: translateY(100%);
            transition: transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94);
            user-select: none;
        }
        .vkb-overlay.visible { transform: translateY(0); }

        .vkb-preview-wrap {
            display: flex; align-items: center; gap: 12px;
            margin-bottom: clamp(12px, 2vh, 22px);
            padding: 0 2px;
        }
        .vkb-preview-label {
            font-size: clamp(10px, 1.1vw, 14px);
            font-weight: 600; text-transform: uppercase;
            letter-spacing: 0.09em; color: rgba(255,255,255,0.3);
            white-space: nowrap; flex-shrink: 0;
        }
        .vkb-preview-text {
            flex: 1;
            font-size: clamp(16px, 1.8vw, 26px);
            font-weight: 500; color: #fff;
            padding: clamp(7px, 1vh, 12px) clamp(12px, 1.4vw, 18px);
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 10px;
            min-height: clamp(38px, 5vh, 56px);
            display: flex; align-items: center;
            white-space: nowrap; overflow: hidden;
        }
        .vkb-cursor {
            display: inline-block; width: 2px;
            height: 1.1em; background: rgba(255,255,255,0.9);
            margin-left: 2px; vertical-align: middle;
            animation: vkbBlink 1s step-end infinite;
        }
        @keyframes vkbBlink { 0%,100%{opacity:1} 50%{opacity:0} }

        .vkb-grid {
            display: grid;
            grid-template-columns: repeat(10, clamp(42px, 3.8vw, 95px));
            gap: clamp(4px, 0.5vh, 7px) clamp(4px, 0.38vw, 6px);
            width: fit-content;
            margin: 0 auto;
        }

        .vkb-key {
            width: clamp(42px, 3.8vw, 90px);
            height: clamp(42px, 3.8vw, 75px);
            padding: 0;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.11);
            border-bottom: 3px solid rgba(0,0,0,0.45);
            border-radius: clamp(7px, 0.6vw, 10px);
            color: rgba(255,255,255,0.88);
            font-size: clamp(13px, 1.2vw, 18px);
            font-weight: 500; font-family: inherit;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            transition: background 0.07s, transform 0.07s, border-color 0.07s, color 0.07s, box-shadow 0.07s;
            outline: none;
            min-width: 0;
            box-sizing: border-box;
        }
        .vkb-key:hover { background: rgba(255,255,255,0.13); color: #fff; }
        .vkb-key:focus {
            background: rgba(255,255,255,0.97);
            color: #080810;
            border-color: transparent;
            border-bottom-color: rgba(0,0,0,0.25);
            transform: scale(1.1) translateY(-3px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.35);
            z-index: 1;
            position: relative;
        }
        .vkb-key:active { transform: scale(0.96) translateY(0); box-shadow: none; }

        .vkb-key[data-key="space"] {
            grid-column: span 6;
            height: clamp(52px, 4.8vw, 70px);
            font-size: clamp(12px, 1.2vw, 16px);
            letter-spacing: 0.08em;
            color: rgba(255,255,255,0.45);
            width: 100%;
        }
        .vkb-key[data-key="space"]:focus { color: rgba(0,0,0,0.65); }
        .vkb-key[data-key="cancel"] {
            grid-column: span 2;
            height: clamp(52px, 4.8vw, 70px);
            color: rgba(255,255,255,0.6);
            font-size: clamp(12px, 1.2vw, 16px);
            font-weight: 500;
            width: 100%;
        }
        .vkb-key[data-key="ok"] {
            grid-column: span 2;
            height: clamp(52px, 4.8vw, 70px);
            background: rgba(50,110,255,0.32);
            border-color: rgba(50,110,255,0.55);
            color: rgba(170,205,255,0.95);
            font-weight: 650;
            font-size: clamp(12px, 1.2vw, 16px);
            width: 100%;
        }
        .vkb-key[data-key="ok"]:focus {
            background: rgb(50,110,255); color: #fff;
            border-color: transparent;
            box-shadow: 0 8px 28px rgba(50,110,255,0.55), 0 0 0 2px rgba(50,110,255,0.4);
        }
        .vkb-key[data-key="⌫"]     { color: rgba(255,110,110,0.85); font-size: clamp(16px,1.7vw,23px); }
        .vkb-key[data-key="⌫"]:focus { color: #b00; }
        .vkb-key[data-key="shift"]  { font-size: clamp(15px,1.6vw,22px); }
        .vkb-key[data-key="shift"].shifted {
            background: rgba(255,255,255,0.2);
            border-color: rgba(255,255,255,0.3);
            color: #fff;
        }
        .vkb-key[data-key="shift"].shifted:focus { background: rgba(255,255,255,0.97); color: #080810; }

        @keyframes editOverlayIn { from{opacity:0} to{opacity:1} }
        @keyframes editModalIn   { from{opacity:0;transform:scale(0.93) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
    
    /* ── Novo Indicador de Menu (Seta) Robustez Total ── */

            @media (min-height: 1080px) {
            #navHintDown { bottom: 3px; padding:6px 90px; }
            #navHintDown svg { width: 28px; height: 28px; }
        }

    /* Texto opcional abaixo da seta se quiser (ou deixe vazio) */
    .nav-hint-text {
        font-size: clamp(10px, 1.2vmin, 14px);
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-weight: 600;
    }

    @keyframes navHintBounce {
        0%, 100% { transform: translate(-50%, 0); }
        50% { transform: translate(-50%, 8px); }
    }
    .nav-hint-icon {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: clamp(4px, 0.8vw, 8px);
        padding: clamp(3px, 0.5vw, 6px) clamp(6px, 1vw, 12px);
        font-size: clamp(11px, 1.2vw, 14px);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .edit-toggle-row {
        display: flex;
        align-items: center;
        gap: 14px;
        cursor: pointer;
        padding: 11px 14px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 9px;
        transition: background 0.15s;
        user-select: none;
    }
    .edit-toggle-row:hover {
        background: rgba(255,255,255,0.07);
        border-color: rgba(255,255,255,0.14);
    }
    .edit-toggle-switch {
        position: relative;
        width: 36px;
        height: 20px;
        flex-shrink: 0;
    }
    .edit-toggle-switch input {
        position: absolute;
        opacity: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        cursor: pointer;
    }
    .edit-toggle-slider {
        position: absolute;
        inset: 0;
        background: rgba(255,255,255,0.15);
        border-radius: 20px;
        transition: background 0.2s;
        pointer-events: none;
    }
    .edit-toggle-slider::before {
        content: '';
        position: absolute;
        width: 14px;
        height: 14px;
        left: 3px;
        top: 3px;
        background: #fff;
        border-radius: 50%;
        transition: transform 0.2s;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    }
    .edit-toggle-switch input:checked ~ .edit-toggle-slider {
        background: rgba(80,140,255,0.65);
    }
    .edit-toggle-switch input:checked ~ .edit-toggle-slider::before {
        transform: translateX(16px);
    }
    .edit-toggle-label {
        font-size: 14px;
        color: rgba(255,255,255,0.8);
        flex: 1;
        line-height: 1.4;
    }
    .edit-toggle-row:focus {
        outline: none;
        border-color: rgba(255,255,255,0.3);
        background: rgba(255,255,255,0.09);
        box-shadow: 0 0 0 2px rgba(255,255,255,0.15);
    }
        `;
        document.head.appendChild(s);
    })();

    /* ── Menu de Contexto & Outros ── */
    // ══════════════════════════════════════════════════════════════════════════
    // Context Menu
    // ══════════════════════════════════════════════════════════════════════════

    const _ctxMenu = (() => {
        const el = document.createElement('div');
        el.className = 'context-menu';
        el.setAttribute('role', 'menu');
        el.innerHTML = `
            <div class="ctx-game-name" id="ctxGameName"></div>
            <button class="ctx-item ctx-primary-action" id="ctxRuntimeAction" role="menuitem">
                <span class="ctx-icon">▶</span> <span id="ctxRuntimeActionText">Iniciar</span>
            </button>
            <button class="ctx-item ctx-toggle-item" id="ctxStoreGamepadControl" role="menuitem">
                <span class="ctx-icon"></span> <span id="ctxStoreGamepadControlText">Iniciar com modo mouse habilitado</span>
            </button>
            <button class="ctx-item ctx-toggle-item" id="ctxStoreAutoAdd" role="menuitem">
                <span class="ctx-icon"></span> <span id="ctxStoreAutoAddText">Adicionar jogos automaticamente</span>
            </button>
            <div class="ctx-separator"></div>
            <button class="ctx-item" id="ctxExtensions" role="menuitem">
                <span class="ctx-icon">+</span> <span data-i18n="manageExtensions">${t('manageExtensions')}</span>
            </button>
            <button class="ctx-item" id="ctxSharing" role="menuitem">
                <span class="ctx-icon">=</span> <span data-i18n="accountSharingLabel">${t('accountSharingLabel')}</span>
            </button>
            <div class="ctx-separator"></div>
            <button class="ctx-item" id="ctxEdit" role="menuitem">
                <span class="ctx-icon">✎</span> <span data-i18n="ctxEditName">${t('ctxEditName')}</span>
            </button>
            <div class="ctx-separator"></div>
            <button class="ctx-item ctx-danger" id="ctxDelete" role="menuitem">
                <span class="ctx-icon">✕</span> <span data-i18n="ctxRemoveGame">${t('ctxRemoveGame')}</span>
            </button>
        `;
        document.body.appendChild(el);
        return el;
    })();

    let _ctxCard = null;

    function _isCtxItemVisible(el) {
        return !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
    }

    function _syncCtxMenuSeparators() {
        const children = Array.from(_ctxMenu.children);
        for (let i = 0; i < children.length; i++) {
            const el = children[i];
            if (!el.classList?.contains('ctx-separator')) continue;

            let prevVisible = false;
            let nextVisible = false;

            for (let p = i - 1; p >= 0; p--) {
                const prev = children[p];
                if (prev.classList?.contains('ctx-separator')) continue;
                prevVisible = _isCtxItemVisible(prev);
                if (prevVisible) break;
            }

            for (let n = i + 1; n < children.length; n++) {
                const next = children[n];
                if (next.classList?.contains('ctx-separator')) continue;
                nextVisible = _isCtxItemVisible(next);
                if (nextVisible) break;
            }

            el.style.display = prevVisible && nextVisible ? 'block' : 'none';
        }
    }

    function _openCtxMenu(card, x, y) {
        _ctxCard = card;
        _ctxCard.classList.add('ctx-active');


        if (typeof applyI18n === 'function') applyI18n();
        const updateCount = Object.keys(window._pendingExtensionUpdates || {}).length;

        const gameId = card.dataset.gameId || card.dataset.appId || card.dataset.appUrl;
        const isYoutube = (gameId && gameId.toLowerCase().includes('youtube'));

        const ctxEditBtn = _ctxMenu.querySelector('#ctxEdit');
        const ctxDeleteBtn = _ctxMenu.querySelector('#ctxDelete');
        const ctxSharingBtn = _ctxMenu.querySelector('#ctxSharing');
        const ctxRuntimeBtn = _ctxMenu.querySelector('#ctxRuntimeAction');
        const ctxRuntimeText = _ctxMenu.querySelector('#ctxRuntimeActionText');
        const ctxStoreGamepadBtn = _ctxMenu.querySelector('#ctxStoreGamepadControl');
        const ctxStoreGamepadText = _ctxMenu.querySelector('#ctxStoreGamepadControlText');
        const ctxStoreAutoAddBtn = _ctxMenu.querySelector('#ctxStoreAutoAdd');
        const ctxStoreAutoAddText = _ctxMenu.querySelector('#ctxStoreAutoAddText');
        const isStoreCard = card.dataset.channel === 'stores' || card.closest('#storesGrid') !== null;
        const storeId = card.dataset.appId || card.dataset.id || card.dataset.appUrl || '';
        const isRunning = window.isCardRuntimeRunning?.(card) === true;
        if (ctxRuntimeBtn && ctxRuntimeText) {
            ctxRuntimeBtn.classList.toggle('ctx-danger', isRunning);
            ctxRuntimeText.textContent = isStoreCard && !isRunning
                ? (typeof t === 'function' ? t('storeOpenBtn') : 'Abrir')
                : (isRunning
                    ? (typeof t === 'function' ? t('ctxCloseRunning') : 'Fechar')
                    : (typeof t === 'function' ? t('ctxStart') : 'Iniciar'));
            ctxRuntimeBtn.querySelector('.ctx-icon').textContent = isRunning ? '×' : '▶';
        }
        if (ctxStoreGamepadBtn && ctxStoreGamepadText) {
            const disabled = card.dataset.disableGamepadControl === 'true';
            ctxStoreGamepadBtn.style.display = isStoreCard ? 'flex' : 'none';
            ctxStoreGamepadBtn.classList.toggle('on', !disabled);
            ctxStoreGamepadBtn.querySelector('.ctx-icon').textContent = !disabled ? '\u2713' : '';
            ctxStoreGamepadText.textContent = typeof t === 'function'
                ? t('storeDisableGamepadControl', 'Iniciar com modo mouse habilitado')
                : 'Iniciar com modo mouse habilitado';
        }
        if (ctxStoreAutoAddBtn && ctxStoreAutoAddText) {
            if (isStoreCard && typeof postToHost === 'function' && !window._storeAutoAddSettings) {
                postToHost({ action: 'requestStoreAutoAddSettings' });
            }
            const settings = window._storeAutoAddSettings || {};
            const autoAdd = Object.prototype.hasOwnProperty.call(settings, storeId) ? !!settings[storeId] : true;
            ctxStoreAutoAddBtn.style.display = isStoreCard ? 'flex' : 'none';
            ctxStoreAutoAddBtn.classList.toggle('on', autoAdd);
            ctxStoreAutoAddBtn.querySelector('.ctx-icon').textContent = autoAdd ? '\u2713' : '';
            ctxStoreAutoAddText.textContent = typeof t === 'function'
                ? t('storeAutoAddQuickToggle', 'Adicionar jogos automaticamente')
                : 'Adicionar jogos automaticamente';
        }
        const isBrowserMedia = (card.hasAttribute('data-app-id') || card.closest('#mediaGrid')) &&
            ['browser', 'webview'].includes((card.dataset.appType || 'browser').toLowerCase());

        const dotHtml = updateCount > 0
            ? `<span class="update-dot" style="display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 6px 0px 5px; background:#ff4444; color:#fff; font-size:11px; font-weight:800; line-height:0; letter-spacing:0; border-radius:10px; margin-left:8px; box-shadow: 0 0 10px rgba(255,68,68,0.4); flex-shrink:0; box-sizing:border-box;">${updateCount}</span>`
            : '';

        const ctxExtensionsBtn = _ctxMenu.querySelector('#ctxExtensions');

        if (ctxExtensionsBtn) {
            // Recria o conteúdo completo para garantir que o span será inserido
            const btnText = t('manageExtensions');
            ctxExtensionsBtn.innerHTML = `
                <span class="ctx-icon">+</span> 
                <span>${escapeHtml(btnText)}</span>
                ${dotHtml}
            `;
            console.log("DEBUG: innerHTML do botão:", ctxExtensionsBtn.innerHTML);
        }
        let ctxCloseBtn = _ctxMenu.querySelector('#ctxClose');
        if (!ctxCloseBtn) {
            ctxCloseBtn = document.createElement('button');
            ctxCloseBtn.className = 'ctx-item';
            ctxCloseBtn.id = 'ctxClose';
            ctxCloseBtn.innerHTML = `<span class="ctx-icon">↩</span> <span>${t('btnBackLabel')}</span>`;
            ctxCloseBtn.addEventListener('click', _closeCtxMenu);
            _ctxMenu.appendChild(ctxCloseBtn);
        }

        if (isStoreCard) {
            if (ctxEditBtn) ctxEditBtn.style.display = 'none';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = 'none';
            if (ctxDeleteBtn) ctxDeleteBtn.style.display = 'none';
            ctxCloseBtn.style.display = 'none';
            _ctxMenu.querySelector('#ctxGameName').textContent = card.querySelector('.title, .nav-vertical-card-title')?.innerText?.trim() || '';
        } else if (isYoutube) {
            if (ctxEditBtn) ctxEditBtn.style.display = 'none';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = isBrowserMedia ? 'flex' : 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = isBrowserMedia ? 'flex' : 'none';
            if (ctxDeleteBtn) ctxDeleteBtn.style.display = 'none';
            ctxCloseBtn.style.display = 'flex';
            _ctxMenu.querySelector('#ctxGameName').textContent = t('systemAppLabel');
        } else {
            if (ctxEditBtn) ctxEditBtn.style.display = 'flex';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = isBrowserMedia ? 'flex' : 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = isBrowserMedia ? 'flex' : 'none';
            if (ctxDeleteBtn) ctxDeleteBtn.style.display = 'flex';
            ctxCloseBtn.style.display = 'none';
            _ctxMenu.querySelector('#ctxGameName').textContent = card.querySelector('.title, .nav-vertical-card-title')?.innerText?.trim() || '';
        }

        _syncCtxMenuSeparators();
        _ctxMenu.style.display = 'flex';
        requestAnimationFrame(() => {
            const w = _ctxMenu.offsetWidth, h = _ctxMenu.offsetHeight, m = 10;
            _ctxMenu.style.left = Math.min(x, window.innerWidth - w - m) + 'px';
            _ctxMenu.style.top = Math.min(y, window.innerHeight - h - m) + 'px';
            _ctxMenu.classList.add('visible');
            isCtxMenuOpen = true;

            ctxRuntimeBtn?.focus();
        });
    }
    function _closeCtxMenu() {
        isCtxMenuOpen = false;
        _ctxMenu.classList.remove('visible');

        if (_ctxCard) _ctxCard.classList.remove('ctx-active');

        setTimeout(() => { if (!_ctxMenu.classList.contains('visible')) _ctxMenu.style.display = 'none'; }, 160);
        const card = _ctxCard; _ctxCard = null; card?.focus();
    }

    window._ctxMenuOpen = _openCtxMenu;
    window._ctxMenuClose = _closeCtxMenu;

    document.addEventListener('mousedown', e => {
        if (isCtxMenuOpen && !_ctxMenu.contains(e.target)) _closeCtxMenu();
    }, true);

    document.getElementById('ctxEdit').addEventListener('click', () => {
        const card = _ctxCard; _closeCtxMenu();
        if (card) openEditGameModal(card);
    });

    document.getElementById('ctxExtensions').addEventListener('click', () => {
        _closeCtxMenu();
        openExtensionsManager();
    });

    document.getElementById('ctxSharing').addEventListener('click', () => {
        const card = _ctxCard;
        const appId = card?.dataset.appId || card?.dataset.gameId || '';
        _closeCtxMenu();
        if (appId) window._navMenuOpenAccountSharing?.(appId);
    });

    document.getElementById('ctxStoreGamepadControl').addEventListener('click', () => {
        const card = _ctxCard;
        if (!card) return;

        const storeId = card.dataset.appId || card.dataset.id || card.dataset.appUrl || '';
        const nextStartMouseMode = card.dataset.disableGamepadControl === 'true';
        const nextDisabled = !nextStartMouseMode;
        card.dataset.disableGamepadControl = String(nextDisabled);
        if (window.AppStore?.mutations?.patchItem && storeId) {
            window.AppStore.mutations.patchItem('stores', storeId, { disableGamepadControl: nextDisabled });
        }
        if (typeof postToHost === 'function' && storeId) {
            postToHost({ action: 'setStoreGamepadControl', storeId, disabled: nextDisabled });
        }

        const btn = document.getElementById('ctxStoreGamepadControl');
        if (btn) {
            btn.classList.toggle('on', nextStartMouseMode);
            const icon = btn.querySelector('.ctx-icon');
            if (icon) icon.textContent = nextStartMouseMode ? '\u2713' : '';
        }
    });

    document.getElementById('ctxStoreAutoAdd')?.addEventListener('click', () => {
        const card = _ctxCard;
        if (!card) return;

        const storeId = card.dataset.appId || card.dataset.id || card.dataset.appUrl || '';
        if (!storeId) return;

        const settings = window._storeAutoAddSettings || {};
        const current = Object.prototype.hasOwnProperty.call(settings, storeId) ? !!settings[storeId] : true;
        const next = !current;

        window._storeAutoAddSettings = window._storeAutoAddSettings || {};
        window._storeAutoAddSettings[storeId] = next;

        if (typeof postToHost === 'function') {
            postToHost({ action: 'setStoreAutoAdd', store: storeId, enabled: next });
        }

        const btn = document.getElementById('ctxStoreAutoAdd');
        if (btn) {
            btn.classList.toggle('on', next);
            const icon = btn.querySelector('.ctx-icon');
            if (icon) icon.textContent = next ? '\u2713' : '';
        }

        document.querySelector('#ctxStoreAutoAdd .ctx-icon').textContent = next ? '\u2713' : '';
    });

    document.getElementById('ctxRuntimeAction').addEventListener('click', () => {
        const card = _ctxCard;
        const isRunning = window.isCardRuntimeRunning?.(card) === true;
        _closeCtxMenu();
        if (!card) return;

        if (isRunning) {
            postToHost({
                action: 'closeRunningItem',
                id: card.dataset.gameId || card.dataset.appId || card.dataset.id || '',
                url: card.dataset.appUrl || '',
                channel: card.dataset.channel || '',
                appType: card.dataset.appType || ''
            });
        } else {
            card.click();
        }
    });

    document.getElementById('ctxDelete').addEventListener('click', () => {
        const card = _ctxCard; _closeCtxMenu();
        if (card) _executeDelete(card);
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Deleção
    // ══════════════════════════════════════════════════════════════════════════
    function _executeDelete(card) {
        const id1 = card.dataset.gameId;
        const id2 = card.dataset.appId;
        const id3 = card.dataset.appUrl;

        const searchKeys = [id1, id2, id3].filter(Boolean);
        if (searchKeys.length === 0) return;

        if (searchKeys.some(k => k.toLowerCase().includes('youtube'))) return;

        const isMedia = card.hasAttribute('data-app-id') || card.closest('#mediaGrid') !== null;

        const allCards = Array.from(document.querySelectorAll('.card, .nav-vertical-card')).filter(c => {
            const cId1 = c.dataset.gameId;
            const cId2 = c.dataset.appId;
            const cId3 = c.dataset.appUrl;
            return searchKeys.some(k => k === cId1 || k === cId2 || k === cId3);
        });

        allCards.forEach(c => {
            if (c.classList.contains('featured')) {
                const grid = c.closest('#gameGrid') || c.closest('#mediaGrid');
                const next = Array.from(grid.querySelectorAll('.card:not(.add-card)')).find(sib => sib !== c);
                if (next) {
                    next.classList.add('featured');
                    const img = next.querySelector('img');
                    if (img) img.src = next.dataset.staticHorizontal || next.dataset.horizontal || next.dataset.staticVertical || '';
                    next._startInteraction?.();
                } else {
                    if (typeof clearHero === 'function') clearHero();
                }
            }

            c.classList.add('removing');
            setTimeout(() => c.remove(), 280);
        });

        const _navCatId = isMedia ? 'media' : 'games';
        [id1, id2, id3].filter(Boolean).forEach(key => {
            window._navMenuRemoveItem?.(_navCatId, key);
        });

        postToHost({
            action: 'deleteGame',
            gameId: id1 || id2,
            isMedia: isMedia
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Edit Modal
    // ══════════════════════════════════════════════════════════════════════════

    let _editCard = null;
    let _editOverlay = null;

    function openEditGameModal(card) {
        ensureDoorpiOverlayStyles();

        const currentName = card.querySelector('.title')?.innerText?.trim() ||
            card.querySelector('.nav-vertical-card-title')?.innerText?.trim() || '';
        _editCard = card;

        const gameId = card.dataset.gameId || card.dataset.appId || card.dataset.appUrl;

        // 🔹 DETECÇÃO INFALÍVEL DE MÍDIA PARA TÍTULOS DINÂMICOS 🔹
        const isMediaTabActive = typeof window.getCurrentHomeTab === 'function' && window.getCurrentHomeTab() === 'media';
        const isMediaCard = card.hasAttribute('data-app-id') ||
            card.closest('#mediaGrid') !== null ||
            isMediaTabActive;

        // Textos Dinâmicos Baseados no Tipo
        const modalTitle = isMediaCard
            ? (typeof t === 'function' ? t('editAppTitle', 'Editar App') : 'Editar App')
            : (typeof t === 'function' ? t('editGameTitle', 'Editar Jogo') : 'Editar Jogo');

        const modalSubtitle = isMediaCard
            ? (typeof t === 'function' ? t('editAppSubtitle', 'Ajuste os detalhes deste aplicativo.') : 'Ajuste os detalhes deste aplicativo.')
            : (typeof t === 'function' ? t('editGameSubtitle', 'Ajuste os detalhes deste jogo.') : 'Ajuste os detalhes deste jogo.');


        const appType = card.dataset.appType || 'browser';
        const canManageBrowser = isMediaCard && appType !== 'browser' ? false : (isMediaCard && appType !== 'exe');
        const canManageSharing = isMediaCard && ['browser', 'webview'].includes(appType.toLowerCase());
        const isSharedFromOther = card.dataset.sharedFromOther === 'true';

        const isExeApp = isMediaCard && appType === 'exe';
        const disableGamepadControl = card.dataset.disableGamepadControl === 'true';

        const sharedWithNames = (() => {
            try { return JSON.parse(card.dataset.sharedWithUserNames || '[]'); } catch { return []; }
        })();
        const shareSummary = isSharedFromOther
            ? (typeof t === 'function' ? t('sharedByInfo', escapeHtml(card.dataset.sharedFromName || 'outro')) : `Compartilhado por ${escapeHtml(card.dataset.sharedFromName || 'outro')}`)
            : (card.dataset.shareMode === 'all'
                ? (typeof t === 'function' ? t('shareModeAll') : 'Público')
                : (card.dataset.shareMode === 'user' && sharedWithNames.length ? sharedWithNames.join(', ') : (typeof t === 'function' ? t('shareModePrivate') : 'Separado por usuário')));

        // ── Geração dos novos Botões em Grid ──
        const svgShare = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-4.2M8.6 13.4l6.8 4.2"/></svg>`;
        const svgExt = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

        const sharingBtnHtml = canManageSharing ? `
            <button class="edit-shortcut-card" id="editSharingBtn" type="button" tabindex="0">
                <div class="edit-shortcut-icon">${svgShare}</div>
                <div class="edit-shortcut-info">
                    <h4>${typeof t === 'function' ? t('accountSharingLabel', 'Contas e Acesso') : 'Contas e Acesso'}</h4>
                    <p>${escapeHtml(shareSummary)}</p>
                </div>
            </button>
        ` : '';

        const extensionsBtnHtml = canManageBrowser ? `
            <button class="edit-shortcut-card" id="editExtensionsBtn" type="button" tabindex="0">
                <div class="edit-shortcut-icon">${svgExt}</div>
                <div class="edit-shortcut-info">
                    <h4>${typeof t === 'function' ? t('manageExtensions', 'Extensões') : 'Extensões'}</h4>
                    <p>${typeof t === 'function' ? t('manageExtensionsDesc', 'Gerenciar plugins nativos') : 'Gerenciar plugins nativos'}</p>
                </div>
            </button>
        ` : '';

        const mediaExtras = (canManageSharing || canManageBrowser) ? `
            <div class="edit-modal-field" style="margin-top: 8px;">
                <label class="edit-modal-label">${typeof t === 'function' ? t('editShortcutsLabel', 'Atalhos do Sistema') : 'Atalhos do Sistema'}</label>
                <div class="edit-shortcuts-grid">
                    ${sharingBtnHtml}
                    ${extensionsBtnHtml}
                </div>
            </div>
        ` : '';

        const overlay = document.createElement('div');
        overlay.className = 'edit-modal-overlay';
        _editOverlay = overlay;

        overlay.innerHTML = `
            <div class="edit-modal" role="dialog" aria-modal="true" aria-label="${modalTitle}">
                <div class="edit-modal-header">
                    <div>
                        <h3 class="edit-modal-title">${modalTitle}</h3>
                        <p class="edit-modal-subtitle">${modalSubtitle}</p>
                    </div>
                </div>
                <div class="edit-modal-body">
                    <div class="edit-modal-field">
                        <label class="edit-modal-label" for="editNameInput">
                            ${typeof t === 'function' ? t('editModalFieldName', 'NOME NA BIBLIOTECA') : 'NOME NA BIBLIOTECA'}
                        </label>
                        <input class="edit-modal-input" id="editNameInput" type="text" autocomplete="off" spellcheck="false" />
                        <span class="edit-modal-input-hint">
                            ${typeof t === 'function' ? t('editModalHint', 'Pressione enter para alterar') : 'Pressione enter para alterar'}
                        </span>
                    </div>
                    ${mediaExtras}
                    ${isExeApp ? `
                    <div class="edit-modal-field" style="margin-top: 8px;">
                        <label class="edit-modal-label">${typeof t === 'function' ? t('gamepadControlLabel', 'CONTROLE XINPUT') : 'CONTROLE XINPUT'}</label>
                        <label class="edit-toggle-row" tabindex="0">
                            <span class="edit-toggle-switch">
                                <input type="checkbox" id="editDisableGamepadControl" tabindex="-1" ${!disableGamepadControl ? 'checked' : ''} />
                                <span class="edit-toggle-slider"></span>
                            </span>
                            <span class="edit-toggle-label">${typeof t === 'function' ? t('disableGamepadControlLabel', 'Iniciar com modo mouse habilitado') : 'Iniciar com modo mouse habilitado'}</span>
                        </label>
                        <span class="edit-modal-input-hint">${typeof t === 'function' ? t('disableGamepadControlHint', 'Quando desligado, use L3 + R3 + L1 + R1 durante a sessão para ativar temporariamente.') : 'Quando desligado, use L3 + R3 + L1 + R1 durante a sessão para ativar temporariamente.'}</span>
                    </div>` : ''}
                </div>
                <div class="edit-modal-actions">
                    <button class="modal-btn cancel" id="editCancelBtn">${typeof t === 'function' ? t('editModalCancel', 'Cancelar') : 'Cancelar'}</button>
                    <button class="modal-btn primary" id="editSaveBtn">${typeof t === 'function' ? t('editModalSave', 'Salvar') : 'Salvar'}</button>
                </div>  
            </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('#editNameInput');
        input.value = currentName;

        const doClose = () => {
            isEditModalOpen = false;
            window._vkbForceClose();
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.12s';
            setTimeout(() => { overlay.remove(); _editOverlay = null; }, 130);
            window.focusFeaturedCard?.();
        };

        overlay.querySelector('#editExtensionsBtn')?.addEventListener('click', () => {
            doClose();
            window.openExtensionsManager?.();
        });

        overlay.querySelector('#editSharingBtn')?.addEventListener('click', () => {
            const appId = card.dataset.appId || card.dataset.gameId || '';
            doClose();
            window._navMenuOpenAccountSharing?.(appId);
        });

        const doSave = () => {
            const newName = input.value.trim();
            const nameChanged = newName && newName !== currentName;

            const disableCheckbox = overlay.querySelector('#editDisableGamepadControl');
            const newDisable = disableCheckbox ? !disableCheckbox.checked : disableGamepadControl;
            const disableChanged = isExeApp && newDisable !== disableGamepadControl;
            if (nameChanged) {
                const gameId = card.dataset.gameId || card.dataset.appId;
                const allCards = Array.from(document.querySelectorAll('.card, .nav-vertical-card')).filter(c =>
                    c.dataset.gameId === gameId || c.dataset.appId === gameId
                );

                // Gera as novas artes com o nome atualizado
                const newLogoSvg = window.generateFallbackSvg(newName, 'logo');
                const newGridSvg = window.generateFallbackSvg(newName, 'grid');
                const newHorizSvg = window.generateFallbackSvg(newName, 'horizontal');

                allCards.forEach(c => {
                    // Atualiza o texto normal da UI
                    const titleEl = c.querySelector('.title, .nav-vertical-card-title');
                    if (titleEl) titleEl.innerText = newName;

                    // 1. Atualiza a LOGO
                    if (c.dataset.logo && c.dataset.logo.startsWith('data:image/svg+xml')) {
                        c.dataset.logo = newLogoSvg;
                        if (c.dataset.staticLogo) c.dataset.staticLogo = newLogoSvg;

                        if (c.classList.contains('featured')) {
                            const gameLogoEl = document.getElementById('gameLogo');
                            if (gameLogoEl) gameLogoEl.src = newLogoSvg;
                        }
                    }

                    // 2. Atualiza a Capa Vertical (Grid em pé)
                    if (c.dataset.vertical && c.dataset.vertical.startsWith('data:image/svg+xml')) {
                        c.dataset.vertical = newGridSvg;
                        if (c.dataset.staticVertical) c.dataset.staticVertical = newGridSvg;

                        if (!c.classList.contains('featured')) {
                            const img = c.querySelector('img');
                            if (img) img.src = newGridSvg;
                        }
                    }

                    // 3. Atualiza a Capa Horizontal (Grid deitado, do Featured)
                    if (c.dataset.horizontal && c.dataset.horizontal.startsWith('data:image/svg+xml')) {
                        c.dataset.horizontal = newHorizSvg;
                        if (c.dataset.staticHorizontal) c.dataset.staticHorizontal = newHorizSvg;

                        // Se estiver em destaque, a imagem visível no src do <img> é a horizontal
                        if (c.classList.contains('featured')) {
                            const img = c.querySelector('img');
                            if (img) img.src = newHorizSvg;
                        }
                    }
                });

                if (typeof _menuData !== 'undefined') {
                    ['games', 'media'].forEach(cat => {
                        if (!_menuData[cat]) return;
                        const item = _menuData[cat].find(i => (i.LaunchUrl || i.Path || i.Url) === gameId);
                        if (item) item.Name = newName;
                    });
                }
            }

            if (nameChanged || disableChanged) {
                const gameId = card.dataset.gameId || card.dataset.appId;
                const payload = { action: 'editGame', gameId };
                if (nameChanged) payload.newName = newName;
                if (isExeApp) payload.disableGamepadControl = newDisable;
                postToHost(payload);

                if (disableChanged) {
                    card.dataset.disableGamepadControl = String(newDisable);
                    window._mediaGamepadConfig = window._mediaGamepadConfig || {};
                    window._mediaGamepadConfig[gameId] = newDisable;
                }
            }

            doClose();
        };

        overlay.querySelector('#editSaveBtn').addEventListener('click', doSave);
        overlay.querySelector('#editCancelBtn').addEventListener('click', doClose);
        overlay.addEventListener('mousedown', e => { if (e.target === overlay) doClose(); });

        // ── GESTÃO CENTRAL DE TECLADO E CONTROLE (Foco Perfeito) ──
        overlay.addEventListener('keydown', e => {
            if (window._vkbIsOpen) return;

            // 1. Enter no Input -> Abre o teclado virtual
            if (e.target.id === 'editNameInput' && e.key === 'Enter') {
                e.preventDefault();
                window._vkbOpen?.(e.target);
                return;
            }

            // 2. Enter no Checkbox -> Marca/Desmarca
            if (e.target.classList.contains('edit-toggle-row') && e.key === 'Enter') {
                e.preventDefault();
                const chk = overlay.querySelector('#editDisableGamepadControl');
                if (chk) chk.checked = !chk.checked;
                return;
            }

            // 3. Voltar / Cancelar (Botão B no controle ou Esc)
            if (e.key === 'Escape') {
                e.preventDefault();
                doClose();
                return;
            }

            // 4. "DESENTUPIDOR DE FOCO": Se o motor do navegador travar nas bordas do modal
            if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                const activeBefore = document.activeElement;

                // Espera meio milissegundo pra ver se o navegador moveu sozinho
                setTimeout(() => {
                    const activeAfter = document.activeElement;

                    // Se o foco não andou nada (bateu na barreira invisível)
                    if (activeBefore === activeAfter) {
                        // Mapeia tudo que é clicável no modal
                        const focusables = Array.from(overlay.querySelectorAll('input, button, .edit-toggle-row'))
                            .filter(el => el.offsetParent !== null && !el.disabled);

                        const currentIndex = focusables.indexOf(activeBefore);
                        if (currentIndex === -1) return;

                        // Força a descida
                        if (e.key === 'ArrowDown' && currentIndex < focusables.length - 1) {
                            focusables[currentIndex + 1].focus();
                        }
                        // Força a subida
                        else if (e.key === 'ArrowUp' && currentIndex > 0) {
                            focusables[currentIndex - 1].focus();
                        }
                        // Alterna entre Cancelar <-> Salvar no rodapé
                        else if (e.key === 'ArrowRight' && activeBefore.id === 'editCancelBtn') {
                            overlay.querySelector('#editSaveBtn')?.focus();
                        }
                        else if (e.key === 'ArrowLeft' && activeBefore.id === 'editSaveBtn') {
                            overlay.querySelector('#editCancelBtn')?.focus();
                        }
                    }
                }, 10);
            }
        });

        // Mantém as declarações finais que já existiam
        window._editModalClose = doClose;
        window._editModalSave = doSave;
        isEditModalOpen = true;

        requestAnimationFrame(() => {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        });
    } 

    // ══════════════════════════════════════════════════════════════════════════
    // Teclado Virtual
    // ══════════════════════════════════════════════════════════════════════════

    window._vkbIsOpen = false;

    const VKB = (() => {
        const FLAT_KEYS = [
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
            'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p',
            'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '⌫',
            'shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.',
            'space', 'cancel', 'ok',
        ];

        let _el = null;
        let _callbacks = {};
        let _returnFocusEl = null;
        let _shifted = true;
        let _inputEl = null;
        let _cursorPos = 0;

        function _build() {
            if (_el) return;
            _el = document.createElement('div');
            _el.className = 'vkb-overlay';

            const dynamicLabels = { '⌫': '⌫', shift: '⇧', space: t('vkbSpace'), cancel: t('vkbCancel'), ok: t('vkbOk') };

            const keysHtml = FLAT_KEYS.map(k => {
                const lbl = dynamicLabels[k] ?? k;
                return `<button class="vkb-key" data-key="${k}" tabindex="0">${lbl}</button>`;
            }).join('');

            _el.innerHTML = `
                <div class="vkb-preview-wrap">
                    <span class="vkb-preview-label">${t('vkbPreviewLabel')}</span>
                    <div class="vkb-preview-text" id="vkbPreview"></div>
                </div>
                <div class="vkb-grid">${keysHtml}</div>
            `;
            document.body.appendChild(_el);

            _el.querySelectorAll('.vkb-key').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    _pressKey(btn.dataset.key);
                });
            });
        }

        function _syncCursorToInput() {
            if (!_inputEl) return;
            _inputEl.setSelectionRange(_cursorPos, _cursorPos);
        }

        function _insertText(text) {
            if (!_inputEl) return;
            let val = _inputEl.value;
            _inputEl.value = val.substring(0, _cursorPos) + text + val.substring(_cursorPos);
            _cursorPos += text.length;
            _syncCursorToInput();
        }

        function _deleteText() {
            if (!_inputEl || _cursorPos <= 0) return;
            let val = _inputEl.value;
            _inputEl.value = val.substring(0, _cursorPos - 1) + val.substring(_cursorPos);
            _cursorPos--;
            _syncCursorToInput();
        }

        function _pressKey(key) {
            if (!_inputEl) return;

            if (key === '⌫') { _deleteText(); }
            else if (key === 'shift') { _setShiftVisual(!_shifted); return; }
            else if (key === 'space') { _insertText(' '); }
            else if (key === 'ok') {
                const fn = _callbacks.onOk ?? window._editModalSave;
                _forceClose();
                fn?.();
                return;
            }
            else if (key === 'cancel') {
                const fn = _callbacks.onCancel ?? window._editModalClose;
                _forceClose();
                fn?.();
                return;
            }
            else { _insertText(_shifted ? key.toUpperCase() : key); }

            _inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            _renderPreview();
        }

        function _renderPreview() {
            const el = document.getElementById('vkbPreview');
            if (!el || !_inputEl) return;
            const val = _inputEl.value || '';
            const formatHtml = (text) => _esc(text).replace(/ /g, '&nbsp;');
            const left = val.substring(0, _cursorPos);
            const right = val.substring(_cursorPos);
            el.innerHTML = `${formatHtml(left)}<span class="vkb-cursor"></span>${formatHtml(right)}`;
        }

        function _moveCursor(dir) {
            if (!_inputEl) return;
            let newPos = _cursorPos + dir;
            if (newPos >= 0 && newPos <= _inputEl.value.length) _cursorPos = newPos;
            _syncCursorToInput();
            _renderPreview();
        }

        function _setShiftVisual(on) {
            _shifted = on;
            const btn = _el?.querySelector('[data-key="shift"]');
            btn?.classList.toggle('shifted', on);
            _el?.querySelectorAll('.vkb-key').forEach(k => {
                const key = k.dataset.key;
                if (key && key.length === 1 && key >= 'a' && key <= 'z')
                    k.textContent = on ? key.toUpperCase() : key;
            });
        }

        function _open(targetInput, callbacks = {}) {
            _callbacks = callbacks;
            _returnFocusEl = targetInput ?? document.activeElement;
            _inputEl = targetInput || document.getElementById('editNameInput');

            if (!_inputEl) return;
            _build();

            if (_el) {
                _el.querySelector('.vkb-preview-label').textContent = t('vkbPreviewLabel');
                _el.querySelector('[data-key="space"]').textContent = t('vkbSpace');
                _el.querySelector('[data-key="cancel"]').textContent = t('vkbCancel');
                _el.querySelector('[data-key="ok"]').textContent = t('vkbOk');
            }

            _setShiftVisual(_shifted);
            _cursorPos = _inputEl.value.length;
            _inputEl.classList.add('vkb-active');
            if (typeof _editOverlay !== 'undefined' && _editOverlay) _editOverlay.classList.add('vkb-active');

            _el.style.display = 'block';
            _renderPreview();
            _syncCursorToInput();

            requestAnimationFrame(() => {
                _el.classList.add('visible');
                window._vkbIsOpen = true;
                _el.querySelector('[data-key="q"]')?.focus();
            });
        }

        function _forceClose() {
            if (!_el) return;
            _callbacks = {};
            window._vkbIsOpen = false;
            _el.classList.remove('visible');

            if (_inputEl) { _inputEl.classList.remove('vkb-active'); _inputEl = null; }
            if (typeof _editOverlay !== 'undefined' && _editOverlay) _editOverlay.classList.remove('vkb-active');

            const returnTo = _returnFocusEl;
            _returnFocusEl = null;
            setTimeout(() => { returnTo?.focus(); window.updateNavHint?.(); }, 350);
            setTimeout(() => { if (_el && !_el.classList.contains('visible')) _el.style.display = 'none'; }, 340);
        }

        function _physicalKey(key) {
            if (!_inputEl) return;
            if (key === 'Backspace') { _deleteText(); }
            else if (key.length === 1) { _insertText(key); }
            _inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            _renderPreview();
        }

        return {
            open: _open, forceClose: _forceClose, cancel: _forceClose, physicalKey: _physicalKey,
            toggleShift: () => _setShiftVisual(!_shifted), moveCursor: _moveCursor
        };
    })();

    const _TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'password', 'url', 'tel', '']);
    window._vkbOpen = (el, callbacks) => {
        if (el && el.tagName === 'INPUT' && !_TEXT_INPUT_TYPES.has((el.type || '').toLowerCase())) return;
        VKB.open(el, callbacks);
    };
    window._vkbCancel = () => VKB.cancel();
    window._vkbForceClose = () => VKB.forceClose();
    window._vkbPhysicalKey = (k) => VKB.physicalKey(k);
    window._vkbToggleShift = () => VKB.toggleShift();
    window._vkbMoveCursor = (dir) => VKB.moveCursor(dir);
    window._vkbClearFocus = () => {
        const el = document.activeElement;
        if (el && el.classList.contains('vkb-key')) el.blur();
    };
    window._vkbHasFocus = () => {
        const el = document.activeElement;
        return el && el.classList.contains('vkb-key');
    };

    function _esc(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // =============================================================================
    // Indicador Flutuante (Menu Seta para Baixo)
    // =============================================================================

    (function initNavHint() {
        const navHint = document.createElement('div');
        navHint.id = 'navHintDown';
        navHint.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polyline points="6 9 12 15 18 9" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        document.body.appendChild(navHint);

        window.updateNavHint = function () {
            const hint = document.getElementById('navHintDown');
            if (!hint) return;

            if (window.isNavMenuOpen) {
                hint.classList.add('visible', 'nav-open');
                return;
            }

            hint.classList.remove('nav-open');

            const focused = document.activeElement;
            const isCard = focused?.classList?.contains('card') && !focused?.classList?.contains('add-card');
            const inGrid = focused?.closest('#gameGrid') || focused?.closest('#mediaGrid');

            const isOverlayOpen = window.isModalOpen || window.isSetupOpen ||
                window._vkbIsOpen || window.isGlobalLoading ||
                (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) ||
                (typeof isEditModalOpen !== 'undefined' && isEditModalOpen);

            if (isOverlayOpen) { hint.classList.remove('visible'); return; }
            hint.classList.toggle('visible', !!(isCard && inGrid));
        };

        document.addEventListener('focusin', window.updateNavHint);
        document.addEventListener('focusout', window.updateNavHint);
    })();

    // ── Fundo animado (blobs) — aparece quando não há hero ativo ──────────────────
    // ── Fundo animado (blobs) — Renderizado via GPU (Zero Stutter/Sem Pausas) ────
    (function initBlobBackground() {
        // 1. Remove qualquer canvas antigo para evitar lixo
        const oldCanvas = document.getElementById('appBlobBg');
        if (oldCanvas) oldCanvas.remove();

        // 2. Injeta as Animações CSS (Roda direto na Compositor Thread)
        const s = document.createElement('style');
        s.textContent = `
            #appBlobBg {
                position: fixed; inset: 0; width: 100%; height: 100%; z-index: -1;
                pointer-events: none; opacity: 0; transition: opacity 0.6s ease;
                background: #07071a; overflow: hidden;
            }
            .app-blob {
                position: absolute; border-radius: 50%;
                will-change: transform;
                animation-timing-function: ease-in-out;
                animation-iteration-count: infinite;
                animation-direction: alternate;
            }
            #appBlobVig {
                position: absolute; inset: 0;
                background: radial-gradient(circle at 50% 50%, transparent 25%, rgba(0,0,18,0.62) 85%);
            }
        
            /* Movimentos contidos: cruzam a tela mas não escapam das bordas */
        
            /* ab1: Topo-Esquerdo. Vai pro centro e um pouco pra direita/baixo */
            @keyframes ab1 { 0% { transform: translate(0, 0); } 34% { transform: translate(30vw, 15vh); } 68% { transform: translate(50vw, 45vh); } 100% { transform: translate(20vw, 55vh); } }
        
            /* ab2: Topo-Direito. Vem pro centro/esquerda e desce */
            @keyframes ab2 { 0% { transform: translate(0, 0); } 30% { transform: translate(-25vw, 35vh); } 65% { transform: translate(-55vw, 20vh); } 100% { transform: translate(-20vw, 60vh); } }
        
            /* ab3: Fundo-Esquerdo. Sobe pro centro e direita */
            @keyframes ab3 { 0% { transform: translate(0, 0); } 37% { transform: translate(35vw, -25vh); } 70% { transform: translate(60vw, -15vh); } 100% { transform: translate(25vw, -50vh); } }
        
            /* ab4: Fundo-Direito. Sobe pro centro e esquerda */
            @keyframes ab4 { 0% { transform: translate(0, 0); } 32% { transform: translate(-30vw, -20vh); } 66% { transform: translate(-55vw, -45vh); } 100% { transform: translate(-35vw, -55vh); } }
        
            /* ab5: Lateral-Esquerda. Flutua pro meio e circula */
            @keyframes ab5 { 0% { transform: translate(0, 0); } 35% { transform: translate(40vw, -20vh); } 72% { transform: translate(55vw, 25vh); } 100% { transform: translate(25vw, 35vh); } }
        
            /* ab6: Lateral-Direita. Flutua pro meio e circula oposto */
            @keyframes ab6 { 0% { transform: translate(0, 0); } 38% { transform: translate(-35vw, 30vh); } 68% { transform: translate(-55vw, -15vh); } 100% { transform: translate(-25vw, -30vh); } }
        `;
        document.head.appendChild(s);

        // 3. Monta o HTML dos Blobs (Bolas puxadas mais pra dentro da tela)
        const container = document.createElement('div');
        container.id = 'appBlobBg';

        const blobDefs = [
            // Canto Superior Esquerdo
            { kf: 'ab1', dur: '63s', delay: '0s', top: '-5%', left: '-5%', w: '135vmin', h: '105vmin', color: '45,65,185' },
            // Canto Superior Direito
            { kf: 'ab2', dur: '74s', delay: '-12s', top: '-5%', left: '55%', w: '125vmin', h: '95vmin', color: '28,85,210' },
            // Canto Inferior Esquerdo
            { kf: 'ab3', dur: '86s', delay: '-7s', top: '55%', left: '-5%', w: '120vmin', h: '90vmin', color: '70,50,165' },
            // Canto Inferior Direito
            { kf: 'ab4', dur: '68s', delay: '-20s', top: '55%', left: '55%', w: '115vmin', h: '88vmin', color: '22,110,175' },
            // Lateral Esquerda (Meio)
            { kf: 'ab5', dur: '79s', delay: '-25s', top: '25%', left: '-5%', w: '110vmin', h: '85vmin', color: '90,70,195' },
            // Lateral Direita (Meio)
            { kf: 'ab6', dur: '58s', delay: '-15s', top: '30%', left: '60%', w: '105vmin', h: '80vmin', color: '30,130,190' },
        ];

        container.innerHTML = blobDefs.map(b => `
            <div class="app-blob" style="
                width:${b.w}; height:${b.h}; top:${b.top}; left:${b.left};
                background:radial-gradient(circle, rgba(${b.color},0.55) 0%, rgba(${b.color},0.22) 40%, transparent 70%);
                animation-name:${b.kf}; animation-duration:${b.dur}; animation-delay:${b.delay};
            "></div>`).join('') + `<div id="appBlobVig"></div>`;

        document.body.appendChild(container);

        // 4. Controle puramente por Opacidade
        let _blobShowTimer = null;
        let _blobHideTimer = null;

        function checkHeroState() {
            const bgBlur = document.getElementById('bgBlur');
            const heroInactive = !bgBlur?.src || bgBlur.style.opacity === '0';

            if (heroInactive) {
                if (_blobHideTimer) { clearTimeout(_blobHideTimer); _blobHideTimer = null; }
                if (!_blobShowTimer) {
                    _blobShowTimer = setTimeout(() => {
                        _blobShowTimer = null;
                        const bg = document.getElementById('bgBlur');
                        if (!bg?.src || bg?.style.opacity === '0') {
                            container.style.opacity = '1';
                        }
                    }, 400);
                }
            } else {
                if (_blobShowTimer) { clearTimeout(_blobShowTimer); _blobShowTimer = null; }
                container.style.opacity = '0';
            }
        }

        window._startBlobBg = () => {
            if (_blobHideTimer) { clearTimeout(_blobHideTimer); _blobHideTimer = null; }
            container.style.opacity = '1';
        };

        window._stopBlobBg = () => {
            if (_blobShowTimer) { clearTimeout(_blobShowTimer); _blobShowTimer = null; }
            container.style.opacity = '0';
        };

        const bgBlur = document.getElementById('bgBlur');
        if (bgBlur) {
            new MutationObserver(checkHeroState).observe(bgBlur, {
                attributes: true,
                attributeFilter: ['src', 'style']
            });
        }

        const _origSwitch = window.switchHeroBackground;
        window.switchHeroBackground = function (...args) {
            _origSwitch?.(...args);
            setTimeout(checkHeroState, 0);
        };

        checkHeroState();
    })();

    document.addEventListener('focusin', () => {
        const focused = document.activeElement;
        const isCard = focused?.classList?.contains('card');
        const isInGrid = focused?.closest('#gameGrid');

        const isNavMenuActive =
            document.body.classList.contains('nav-menu-active') ||
            document.body.classList.contains('nav-menu-closing') ||
            window.isNavMenuOpen;

        if (!isCard && !isInGrid && !isNavMenuActive) {
            window._heroCleanupTimer = setTimeout(() => {
                const bgBlur = document.getElementById('bgBlur');
                const heroImg = document.getElementById('heroImage');
                const logoEl = document.getElementById('gameLogo');
                const gridBgImg = document.getElementById('gridBgImg');

                if (bgBlur) bgBlur.style.opacity = '0';
                if (heroImg) heroImg.style.opacity = '0';
                if (logoEl) { logoEl.classList.remove('visible'); logoEl.style.opacity = ''; }
                if (gridBgImg) gridBgImg.removeAttribute('src');

                _currentBgSrc = '';
                if (typeof _heroReqId !== 'undefined') _heroReqId++;
            }, 80);
        }
    });
    function _getUserSwitchOverlayCopy(mode = 'switch') {
        if (mode === 'delete') {
            return {
                mark: typeof t === 'function' ? t('sessionDeleteMark') : 'Conta',
                title: typeof t === 'function' ? t('sessionDeleteTitle') : 'Encerrando sessão para excluir',
                sub: typeof t === 'function' ? t('sessionDeleteSubtitle') : 'Fechando processos e preparando a exclusão desta conta',
            };
        }

        return {
            mark: typeof t === 'function' ? t('sessionTransitionMark') : 'Sessao',
            title: typeof t === 'function' ? t('sessionSwitchTitle') : 'Trocando sessao',
            sub: typeof t === 'function' ? t('logoutSubtitle') : 'Encerrando sessão atual',
        };
    }

    function _ensureUserSwitchLogoutOverlay(mode = 'switch') {
        const copy = _getUserSwitchOverlayCopy(mode);
        let overlay = document.getElementById('doorpiUserSwitchLogout');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'doorpiUserSwitchLogout';
            overlay.innerHTML = `
                <div class="logout-mark">${copy.mark}</div>
                <div class="logout-title">${copy.title}</div>
                <div class="logout-sub">${copy.sub}</div>
                <div class="logout-dots"><span></span><span></span><span></span></div>
            `;
            document.body.appendChild(overlay);
        } else {
            const mark = overlay.querySelector('.logout-mark');
            const title = overlay.querySelector('.logout-title');
            const sub = overlay.querySelector('.logout-sub');
            if (mark) mark.textContent = copy.mark;
            if (title) title.textContent = copy.title;
            if (sub) sub.textContent = copy.sub;
        }
        return overlay;
    }

    function _userSwitchFadeOut(data = {}) {
        if (data.showTransition === false) return;
        // Limpa o hero na hora, sem delay, e bloqueia novos switches
        window._userSwitching = true;
        window._userSwitchStartedAt = performance.now();
        window._stopSystemAudio?.();
        _currentBgSrc = '';
        if (typeof _heroReqId !== 'undefined') _heroReqId++;

        const heroImg = document.getElementById('heroImage');
        const bgBlur = document.getElementById('bgBlur');
        const logoEl = document.getElementById('gameLogo');
        const gridBg = document.getElementById('gridBgImg');

        if (heroImg) heroImg.style.opacity = '0';
        if (bgBlur) { bgBlur.style.opacity = '0'; bgBlur.removeAttribute('src'); }
        if (logoEl) logoEl.classList.remove('visible');
        if (gridBg) gridBg.removeAttribute('src');

        const logoutOverlay = _ensureUserSwitchLogoutOverlay(data.mode || 'switch');
        logoutOverlay.style.display = 'flex';
        requestAnimationFrame(() => logoutOverlay.classList.add('visible'));

        const wrap = document.querySelector('.main-content-wrapper');
        if (!wrap) return;
        wrap.style.opacity = '0';
        wrap.style.transform = 'scale(0.97) translateY(-10px)';
        wrap.style.pointerEvents = 'none';
    }

    function _userSwitchFadeIn(data = {}) {
        const shouldShowTransition = data.showTransition !== false && window._userSwitching;
        const shouldRestartAudio = !!data.restartAudio;

        if (!shouldShowTransition) {
            const wrap = document.querySelector('.main-content-wrapper');
            if (wrap) {
                wrap.style.opacity = '1';
                wrap.style.transform = '';
                wrap.style.pointerEvents = '';
                wrap.style.removeProperty('transition');
            }
            const logoutOverlay = document.getElementById('doorpiUserSwitchLogout');
            if (logoutOverlay) {
                logoutOverlay.classList.remove('visible');
                setTimeout(() => {
                    if (!logoutOverlay.classList.contains('visible')) {
                        logoutOverlay.style.display = 'none';
                    }
                }, 300);
            }
            if (shouldRestartAudio) window._restartSystemAudioForNewSession?.();
            window._doorpiSessionTransitionBlockUntil = Date.now() + 450;
            window._userSwitching = false;
            return;
        }

        const minVisibleMs = Number.isFinite(data.minVisibleMs)
            ? data.minVisibleMs
            : (data.mode === 'delete' ? 900 : 550);
        const elapsed = performance.now() - (window._userSwitchStartedAt || performance.now());
        if (!data._delayed && elapsed < minVisibleMs) {
            setTimeout(() => _userSwitchFadeIn({ ...data, _delayed: true }), minVisibleMs - elapsed);
            return;
        }

        const wrap = document.querySelector('.main-content-wrapper');
        if (!wrap) {
            const logoutOverlay = document.getElementById('doorpiUserSwitchLogout');
            if (logoutOverlay) {
                logoutOverlay.classList.remove('visible');
                logoutOverlay.style.display = 'none';
            }
            if (shouldRestartAudio) window._restartSystemAudioForNewSession?.();
            window._doorpiSessionTransitionBlockUntil = Date.now() + 450;
            window._userSwitching = false;
            return;
        }

        wrap.style.setProperty('transition', 'none', 'important');
        wrap.style.opacity = '0';
        wrap.style.transform = 'scale(0.98) translateY(10px)'; 

        void wrap.offsetWidth;

        wrap.style.setProperty(
            'transition',
            'opacity 0.25s ease, transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
            'important'
        );
        wrap.style.opacity = '1';
        wrap.style.transform = 'none';
        wrap.style.pointerEvents = '';

        const logoutOverlay = document.getElementById('doorpiUserSwitchLogout');
        if (logoutOverlay) {
            logoutOverlay.classList.remove('visible');
            setTimeout(() => {
                if (!logoutOverlay.classList.contains('visible')) {
                    logoutOverlay.style.display = 'none';
                }
            }, 300);
        }

        if (shouldRestartAudio) {
            window._restartSystemAudioForNewSession?.();
        }

        setTimeout(() => {
            wrap.style.removeProperty('transition');
            wrap.style.transform = '';
            window._doorpiSessionTransitionBlockUntil = Date.now() + 450;
            window._userSwitching = false;
        }, 320);
    }

    function clearLoadingCards(tab = 'games') {
        const gridId = tab === 'games' ? 'gameGrid' : 'mediaGrid';
        const grid = document.getElementById(gridId);
        if (!grid) return;
        grid.querySelectorAll('.card.loading-card').forEach(c => c.remove());
    }
    function clearHero(instant = false) {
        const isNavMenuActive =
            document.body.classList.contains('nav-menu-active') ||
            document.body.classList.contains('nav-menu-closing') ||
            window.isNavMenuOpen;
 
        if (isNavMenuActive && !instant) return;

        if (window._heroCleanupTimer) {
            clearTimeout(window._heroCleanupTimer);
            window._heroCleanupTimer = null;
        }

        const doClear = () => {
            const bgBlur = document.getElementById('bgBlur');
            const heroImg = document.getElementById('heroImage');
            const logoEl = document.getElementById('gameLogo');
            const gridBgImg = document.getElementById('gridBgImg');

            if (bgBlur) { bgBlur.style.opacity = '0'; bgBlur.removeAttribute('src'); }
            if (heroImg) { heroImg.style.opacity = '0'; }
            if (logoEl) { logoEl.classList.remove('visible'); logoEl.style.opacity = ''; }
            if (gridBgImg) { gridBgImg.style.opacity = '0'; gridBgImg.removeAttribute('src'); }

            cancelHeroTransition(); 

            _currentBgSrc = '';
            if (typeof _heroReqId !== 'undefined') _heroReqId++;
        };

        if (instant === true) {
            doClear();
        } else {
            window._heroCleanupTimer = setTimeout(doClear, 80);
        }
    }
    document.getElementById('btnAdd')?.addEventListener('mouseenter', clearHero);
    document.getElementById('btnAdd')?.addEventListener('focus', clearHero);

    document.getElementById('btnAddMedia')?.addEventListener('mouseenter', clearHero);
    document.getElementById('btnAddMedia')?.addEventListener('focus', clearHero);


    // ══════════════════════════════════════════════════════════════════════════
    // View: Aplicativos (App Web + Executável)
    // ══════════════════════════════════════════════════════════════════════════

    let _activeMediaSubtab = 'web';

    function _initMediaAppsView() {
        _switchMediaSubtab(_activeMediaSubtab);

        document.getElementById('mediaAppSubtabs')
            ?.querySelectorAll('.subtab')
            .forEach(btn => {
                const fresh = btn.cloneNode(true);
                btn.replaceWith(fresh);
                fresh.addEventListener('click', () => _switchMediaSubtab(fresh.dataset.subtab));
            });
    }

    function _switchMediaSubtab(subtab) {
        _activeMediaSubtab = subtab;

        document.querySelectorAll('#mediaAppSubtabs .subtab').forEach(b =>
            b.classList.toggle('active', b.dataset.subtab === subtab));

        document.getElementById('subview-web')?.classList.toggle('hidden', subtab !== 'web');
        document.getElementById('subview-web')?.classList.toggle('active', subtab === 'web');
        document.getElementById('subview-exe')?.classList.toggle('hidden', subtab !== 'exe');
        document.getElementById('subview-exe')?.classList.toggle('active', subtab === 'exe');

        if (subtab === 'web') {
            _renderWebAppActions();
            _modalReady = true;
            setTimeout(() => document.getElementById('webAppNameInput')?.focus(), 150);
        } else {
            _renderExeAppModal();

            setTimeout(() => {
                const firstApp = document.querySelector('#appListMedia .app-item');
                if (firstApp) firstApp.focus();
                else document.getElementById('btnSearchMedia')?.focus();
            }, 150);
        }
    }

    // ← ADICIONAR AQUI, logo após o } acima
    window._cycleMediaSubtab = function (delta) {
        const tabs = ['web', 'exe'];
        const currentIdx = tabs.indexOf(_activeMediaSubtab || 'web');
        const nextIdx = (currentIdx + delta + tabs.length) % tabs.length;
        _switchMediaSubtab(tabs[nextIdx]);
    };

    function _renderWebAppActions() {
        const bar = document.getElementById('mediaAppActions');
        bar.innerHTML = `
            <div class="action-buttons">
                <button class="modal-btn primary" id="btnAddWebApp" tabindex="0" data-gamepad-hint="start">
                    <span data-i18n="btnAddWebApp">${t('btnAddWebApp')}</span>
                </button>
                <button class="modal-btn cancel" id="btnCancelWebApp" tabindex="0" data-gamepad-hint="cancel">
                    <span data-i18n="btnCancelLabel">${t('btnCancelLabel')}</span>
                </button>
            </div>`;

        document.getElementById('btnAddWebApp').addEventListener('click', _submitWebApp);
        document.getElementById('btnCancelWebApp').addEventListener('click', closeModal);

        const btnPaste = document.getElementById('btnWebAppPaste');
        if (btnPaste) {
            const freshBtn = btnPaste.cloneNode(true);
            btnPaste.replaceWith(freshBtn);

            freshBtn.addEventListener('click', () => {
                window._isPastingWebAppUrl = true;
                postToHost({ action: 'readClipboard' });
            });
        }

        ['webAppNameInput', 'webAppUrlInput'].forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;

            input.removeAttribute('readonly');
            input.setAttribute('tabindex', '0');

            const fresh = input.cloneNode(true);
            input.replaceWith(fresh);

            fresh.addEventListener('focus', () => { if (!window._vkbIsOpen) fresh.style.caretColor = ''; });
            fresh.addEventListener('blur', () => { if (!window._vkbIsOpen) fresh.style.caretColor = 'transparent'; });
            fresh.addEventListener('click', () => { if (!window._vkbIsOpen) window._vkbOpen?.(fresh); });

            fresh.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!window._vkbIsOpen) window._vkbOpen?.(fresh);
                }
            });
        });

        if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
    }

    function _submitWebApp() {
        const nameInput = document.getElementById('webAppNameInput');
        const urlInput = document.getElementById('webAppUrlInput');
        const hint = document.getElementById('webAppHint');

        const name = nameInput?.value.trim() || '';
        let url = urlInput?.value.trim() || '';

        nameInput?.classList.remove('error');
        urlInput?.classList.remove('error');
        if (hint) { hint.textContent = ''; hint.classList.remove('error'); }

        if (!name) {
            nameInput?.classList.add('error');
            nameInput?.focus();
            if (hint) {
                hint.textContent = t('webAppErrorName');
                hint.classList.add('error');
            }
            return;
        }

        if (!url || url === 'https://' || url === 'http://') {
            urlInput?.classList.add('error');
            urlInput?.focus();
            if (hint) {
                hint.textContent = t('webAppErrorUrl');
                hint.classList.add('error');
            }
            return;
        }

        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        // Adiciona ao set de IDs para marcar como "novo"
        window.newGameIdsThisSession.add(url);
        // Mostra 1 skeleton para o webapp que será adicionado
        showLoadingCards(1, 'media');
        postToHost({ action: 'addWebApp', name, url });
        closeModal(); // Fecha o modal imediatamente
    }

    function _shakeWebField(inputId, hintEl, msg) {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.classList.add('error');
        input.addEventListener('input', () => input.classList.remove('error'), { once: true });
        if (hintEl) { hintEl.textContent = msg; hintEl.classList.add('error'); }
    }

    function _renderExeAppModal() {
        const bar = document.getElementById('mediaAppActions');
        bar.innerHTML = `
            <div class="selection-counter" id="selectionCounterMedia">
                <span class="counter-dot"></span>
                <span id="selectionCounterMediaText"></span>
            </div>
            <div class="action-buttons">
                <button class="modal-btn primary" id="btnConfirmAddMedia" tabindex="0" data-gamepad-hint="start">
                    <span data-i18n="btnConfirmLabel">${t('btnConfirmLabel')}</span>
                </button>
                <button class="modal-btn secondary" id="btnSearchMedia" tabindex="0" data-gamepad-hint="triangle">
                    <span data-i18n="btnSearchLabel">${t('btnSearchLabel')}</span>
                </button>
                <button class="modal-btn cancel" id="btnCancelAddMedia" tabindex="0" data-gamepad-hint="cancel">
                    <span data-i18n="btnCancelLabel">${t('btnCancelLabel')}</span>
                </button>
            </div>`;

        document.getElementById('btnCancelAddMedia').addEventListener('click', closeModal);
        document.getElementById('btnSearchMedia').addEventListener('click', () => {
            window.setInlineScanStatus?.(true, "Aguardando o Windows...");
            postToHost({
                action: 'browseManualMedia',
                dialogTitle: t('dlgBrowseTitle'),
                dialogFilter: t('dlgBrowseFilter'),
                loadingTitle: t('loadingAddingGame'),
                loadingSub: t('loadingFetchingCovers'),
                errorMsg: t('msgErrorOpenFile')
            });
        });
        document.getElementById('btnConfirmAddMedia').addEventListener('click', () => {
            const selected = Array.from(
                document.querySelectorAll('#appListMedia .app-item.selected')
            ).map(el => ({ Name: el.dataset.name, Path: el.dataset.path, LaunchUrl: el.dataset.launch }));

            if (selected.length > 0) {
                selected.forEach(app => newGameIdsThisSession.add(app.LaunchUrl || app.Path));
                postToHost({ action: 'addSelectedMediaApps', apps: selected });
                showLoadingCards(selected.length, 'media');
                closeModal(); // Fecha instantaneamente
            } else {
                closeModal();
            }
        });

        const availableApps = allInstalledApps.filter(a => (a.AddedTo || a.addedTo) !== 'game');
        _populateExeList(availableApps);
        _modalReady = true;

        if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
    }

    function _populateExeList(apps) {
        const appList = document.getElementById('appListMedia');
        if (!appList) return;

        if (!apps || apps.length === 0) {
            appList.innerHTML = `
            <div class="app-scan-empty">
                <div class="app-scan-pulse"></div>
                <div>
                    <strong>Procurando aplicativos executáveis</strong>
                    <span>Os resultados aparecem aqui assim que a leitura terminar.</span>
                </div>
            </div>`;
            return;
        }

        appList.innerHTML = apps.map(app => {
            const icon = app.IconBase64 || app.iconBase64;
            const name = app.Name || app.name;
            const path = app.Path || app.path;
            const launch = app.LaunchUrl || app.launchUrl || '';
            const source = app.Source || app.source;
            const isAdded = app.IsAdded === true || app.isAdded === true;

            return `
            <div class="app-item ${isAdded ? 'already-added' : ''}" ${isAdded ? '' : 'tabindex="0"'}
                 data-path="${path.replace(/\\/g, '\\\\')}"
                 data-launch="${launch}"
                 data-name="${name.replace(/"/g, '&quot;')}">
                ${icon ? `<img class="app-icon" src="data:image/png;base64,${icon}" />` : ''}
                <div class="app-item-info">
                    <span class="app-name">${name}</span>
                </div>
                ${getPlatformBadge(source)}
            </div>`;
        }).join('');

        appList.querySelectorAll('.app-item:not(.already-added)').forEach(item =>
            item.addEventListener('click', function () {
                this.classList.toggle('selected');
                const count = appList.querySelectorAll('.app-item.selected').length;
                const counter = document.getElementById('selectionCounterMedia');
                const text = document.getElementById('selectionCounterMediaText');
                if (text) text.innerText = count === 1 ? t('selectedOne') : t('selectedMany', count);
                counter?.classList.toggle('visible', count > 0);
            })
        );
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !window._vkbIsOpen) {
            if (isEditModalOpen || isSetupOpen || isModalOpen) {
                e.preventDefault();
                window._vkbOpen?.(e.target);
            }
        }
    });
    // Solicita o status de atualizações de extensões após o carregamento inicial da UI
    const GameLaunchOverlay = (() => {
        const overlay = document.getElementById('gameLaunchOverlay');
        const bg = document.getElementById('overlayBg');
        const artBox = document.getElementById('gameArtBox');
        const nameEl = document.getElementById('overlayGameName');
        const statusEl = document.getElementById('overlayStatusText');
        const errTitle = document.getElementById('overlayErrorTitle');
        const errSub = document.getElementById('overlayErrorSub');

        // --- Injeção do Estilo Visual do Botão de Cancelar ---
        (function injectLaunchOverlayStyles() {
            const s = document.createElement('style');
            s.textContent = `
                #overlayCancelLaunchBtn {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-bottom: 3px solid rgba(0,0,0,0.3);
                    border-radius: 12px;
                    color: rgba(255, 255, 255, 0.65);
                    font-family: inherit;
                    font-size: clamp(0.85rem, 1vw, 1.05rem);
                    font-weight: 600;
                    padding: 12px 28px;
                    cursor: pointer;
                    outline: none;
                    transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-top: 28px;
                    pointer-events: all;
                }
                #overlayCancelLaunchBtn:focus,
                #overlayCancelLaunchBtn:hover {
                    background: #ffffff;
                    color: #07071a;
                    border-color: #ffffff;
                    transform: scale(1.05) translateY(-2px);
                    box-shadow: 0 10px 24px rgba(255, 255, 255, 0.2), 0 0 0 2px rgba(255, 255, 255, 0.1);
                }
                #overlayCancelLaunchBtn:active {
                    transform: scale(0.98) translateY(0);
                    box-shadow: none;
                }
                #gameLaunchOverlay.execution-lock-visible #overlayCancelLaunchBtn,
                #gameLaunchOverlay.execution-lock-visible #overlayDismissBtn {
                    display: none !important;
                }
                #executionLockActions {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    width: 100%;
                    margin-top: 18px;
                    pointer-events: all;
                }
                #gameLaunchOverlay.execution-lock-visible #executionLockActions {
                    display: flex;
                }
                #gameLaunchOverlay.execution-lock-visible .status-running {
                    justify-content: center;
                    min-height: 0;
                    gap: 0;
                }
                #executionLockActions .lock-action {
                    min-width: 196px;
                    border: 1px solid #ffffff;
                    border-bottom: 3px solid rgba(0,0,0,0.32);
                    border-radius: 12px;
                    background: #ffffff;
                    color: #080817;
                    font-family: inherit;
                    font-size: clamp(0.88rem, 0.95vw, 1rem);
                    font-weight: 700;
                    padding: 12px 22px;
                    outline: none;
                    cursor: pointer;
                    transition: transform .18s ease, background .18s ease, color .18s ease, box-shadow .18s ease;
                }
                #executionLockActions .lock-action:focus,
                #executionLockActions .lock-action:hover {
                    background: #fff;
                    color: #080817;
                    border-color: #fff;
                    transform: translateY(-2px) scale(1.04);
                    box-shadow: 0 12px 30px rgba(255,255,255,.22), 0 0 0 2px rgba(255,255,255,.16);
                }
                #executionLockActions .lock-action.danger {
                    background: rgba(255, 77, 94, 0.14);
                    color: #ff7f8d;
                    border-color: #ff4d5e;
                    box-shadow: 0 10px 24px rgba(255,77,94,.12), 0 0 0 1px rgba(255,77,94,.14);
                }
                #executionLockActions .lock-action.danger:focus,
                #executionLockActions .lock-action.danger:hover {
                    background: rgba(255, 77, 94, 0.22);
                    color: #fff;
                    border-color: #ff4d5e;
                    box-shadow: 0 12px 30px rgba(255,77,94,.26), 0 0 0 2px rgba(255,77,94,.16);
                }
                #executionLockSessionPair {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    width: 100%;
                    margin-top: 10px;
                    margin-bottom: 2px;
                    pointer-events: none;
                }
                #gameLaunchOverlay.execution-lock-visible.has-session-pair #executionLockSessionPair {
                    display: flex;
                }
                #executionLockSessionPair .pair-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 138px;
                    max-width: 214px;
                    padding: 6px 9px;
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,.16);
                    background: rgba(10,10,20,.50);
                }
                #executionLockSessionPair .pair-chip.store {
                    border-color: rgba(122, 184, 255, 0.42);
                    background: rgba(26, 56, 98, 0.28);
                }
                #executionLockSessionPair .pair-chip.game {
                    border-color: rgba(80, 255, 195, 0.34);
                    background: rgba(17, 64, 53, 0.24);
                }
                #executionLockSessionPair .pair-thumb {
                    width: 30px;
                    height: 42px;
                    border-radius: 7px;
                    background: #1b1f36;
                    background-size: cover;
                    background-position: center;
                    border: 1px solid rgba(255,255,255,.14);
                    flex: 0 0 auto;
                }
                #executionLockSessionPair .pair-meta {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                #executionLockSessionPair .pair-role {
                    font-size: .66rem;
                    font-weight: 600;
                    letter-spacing: .04em;
                    text-transform: uppercase;
                    color: rgba(255,255,255,.58);
                }
                #executionLockSessionPair .pair-name {
                    font-size: .78rem;
                    font-weight: 600;
                    color: rgba(255,255,255,.92);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 142px;
                }
            `;
            document.head.appendChild(s);
        })();

        // --- Criação Dinâmica do botão de Cancelar ---
        let cancelBtn = document.getElementById('overlayCancelLaunchBtn');
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.id = 'overlayCancelLaunchBtn';
            cancelBtn.className = 'cancel-btn';
            cancelBtn.dataset.gamepadHint = 'confirm'; // Mapeia o ícone "Confirmar (A / Cross)" automaticamente
            cancelBtn.style.opacity = '0';
            cancelBtn.style.transition = 'opacity 0.4s ease';
            cancelBtn.style.display = 'none';
            cancelBtn.tabIndex = 0;

            cancelBtn.addEventListener('click', () => {
                postToHost({ action: 'cancelGameLaunch' });
            });

            const statusContainer = statusEl?.parentElement;
            if (statusContainer) {
                statusContainer.appendChild(cancelBtn);
            }
        }

        let lockActions = document.getElementById('executionLockActions');
        if (!lockActions) {
            lockActions = document.createElement('div');
            lockActions.id = 'executionLockActions';
            lockActions.innerHTML = `
                <button id="executionLockRestore" class="lock-action" tabindex="0">Retomar</button>
                <button id="executionLockClose" class="lock-action danger" tabindex="0">Fechar processo</button>
            `;

            lockActions.querySelector('#executionLockRestore')?.addEventListener('click', () => {
                postToHost({ action: 'restoreExecutionLock' });
            });
            lockActions.querySelector('#executionLockClose')?.addEventListener('click', () => {
                postToHost({ action: 'closeExecutionLock' });
            });

            const cardContainer = overlay?.querySelector('.overlay-card');
            if (cardContainer) {
                cardContainer.appendChild(lockActions);
            }
        }

        let sessionPair = document.getElementById('executionLockSessionPair');
        if (!sessionPair) {
            sessionPair = document.createElement('div');
            sessionPair.id = 'executionLockSessionPair';
            const insertAnchor = nameEl?.nextElementSibling;
            if (nameEl?.parentElement) {
                if (insertAnchor) {
                    nameEl.parentElement.insertBefore(sessionPair, insertAnchor);
                } else {
                    nameEl.parentElement.appendChild(sessionPair);
                }
            }
        }

        function clearSessionPair() {
            overlay.classList.remove('has-session-pair');
            if (sessionPair) {
                sessionPair.innerHTML = '';
                sessionPair.style.display = 'none';
            }
        }

        function appendSessionChip(container, role, visual) {
            const chip = document.createElement('div');
            chip.className = `pair-chip ${role}`;

            const thumb = document.createElement('div');
            thumb.className = 'pair-thumb';
            if (visual?.image) {
                thumb.style.backgroundImage = `url('${visual.image}')`;
            }

            const meta = document.createElement('div');
            meta.className = 'pair-meta';

            const roleEl = document.createElement('div');
            roleEl.className = 'pair-role';
            roleEl.textContent = role === 'game' ? 'Jogo' : 'Loja';

            const name = document.createElement('div');
            name.className = 'pair-name';
            name.textContent = visual?.name || (role === 'game' ? 'Jogo' : 'Loja');

            meta.appendChild(roleEl);
            meta.appendChild(name);
            chip.appendChild(thumb);
            chip.appendChild(meta);
            container.appendChild(chip);
        }

        function renderSessionPair(data = {}) {
            if (!sessionPair) return;
            const pair = _executionStoreGameVisualPair(data);
            if (!pair) {
                clearSessionPair();
                return;
            }

            sessionPair.innerHTML = '';
            appendSessionChip(sessionPair, 'store', pair.store);
            appendSessionChip(sessionPair, 'game', pair.game);
            sessionPair.style.display = 'flex';
            overlay.classList.add('has-session-pair');
        }

        let executionLockFocusTimerA = 0;
        let executionLockFocusTimerB = 0;
        function clearExecutionLockFocusTimers() {
            if (executionLockFocusTimerA) clearTimeout(executionLockFocusTimerA);
            if (executionLockFocusTimerB) clearTimeout(executionLockFocusTimerB);
            executionLockFocusTimerA = 0;
            executionLockFocusTimerB = 0;
        }

        // Resolvido a partir de strings.js
        const getI18n = () => ({
            opening: t('launchOpening'),
            waiting: t('launchWaiting'),
            waitingGame: t('launchWaitingGame') || t('launchWaiting'),
            waitingStore: t('launchWaitingStore') || t('launchWaiting'),
            waitingApp: t('launchWaitingApp') || t('launchWaiting'),
            running: t('launchRunning'),
            errTitle: t('launchErrTitle'),
            errCrash: t('launchErrCrash'),
            errTimeout: t('launchErrTimeout'),
            errGeneric: t('launchErrGeneric'),
            cancel: t('launchCancelBtn'),
            returningStore: t('launchReturningStore') || t('launchWaitingStore') || t('launchWaiting'),
            closingStore: t('launchClosingStore') || t('launchWaitingStore') || t('launchWaiting'),
        });

        function getWaitingText(text, launchKind) {
            if (launchKind === 'store') return text.waitingStore;
            if (launchKind === 'app') return text.waitingApp;
            return text.waitingGame || text.waiting;
        }

        function setState(state) {
            overlay.classList.remove('state-loading', 'state-running', 'state-error');
            overlay.classList.add('state-' + state);
        }

        function setArt(gridImage) {
            artBox.innerHTML = '';
            if (gridImage) {
                const img = document.createElement('img');
                img.src = gridImage;
                img.alt = '';
                img.onerror = () => setArtFallback();
                artBox.appendChild(img);
            } else {
                setArtFallback();
            }
        }

        function setArtFallback() {
            artBox.innerHTML = `
          <svg class="game-art-placeholder" viewBox="0 0 24 24" fill="none"
               xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="6" width="20" height="12" rx="3"
                  stroke="white" stroke-width="1.5"/>
            <path d="M7 12h4M9 10v4" stroke="white" stroke-width="1.5"
                  stroke-linecap="round"/>
            <circle cx="15" cy="12" r="0.75" fill="white"/>
            <circle cx="17" cy="10.5" r="0.75" fill="white"/>
            <circle cx="17" cy="13.5" r="0.75" fill="white"/>
          </svg>`;
        }

        function show(gameName, heroImage, gridImage, isRestore = false, launchKind = 'game') {
            const text = getI18n();
            const waitingText = getWaitingText(text, launchKind);
            nameEl.textContent = gameName || '';
            cancelBtn.innerHTML = `<span>${text.cancel}</span>`;

            // Nunca permitir mistura entre "aguardando janela" e "EM EXECUÇÃO".
            // Ao iniciar fluxo de launch/loading, sempre sai do modo execution-lock.
            hideExecutionLock();
            clearSessionPair();

            if (bg) bg.style.backgroundImage = heroImage ? `url('${heroImage}')` : 'none';
            setArt(gridImage);
            setState('loading');

            overlay.style.pointerEvents = 'all';
            overlay.classList.add('visible');
            if (overlay._waitTimer) clearTimeout(overlay._waitTimer);

            if (isRestore) {
                statusEl.textContent = waitingText;
                cancelBtn.style.display = 'inline-flex';
                cancelBtn.style.opacity = '1';

                setTimeout(() => {
                    if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
                    cancelBtn.focus();
                }, 50);
            } else {
                // Fluxo normal (novo lançamento)
                statusEl.textContent = text.opening;
                cancelBtn.style.display = 'none';
                cancelBtn.style.opacity = '0';

                overlay._waitTimer = setTimeout(() => {
                    if (overlay.classList.contains('state-loading')) {
                        statusEl.textContent = waitingText;
                        cancelBtn.style.display = 'inline-flex';
                        setTimeout(() => {
                            cancelBtn.style.opacity = '1';
                            if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
                            cancelBtn.focus();
                        }, 50);
                    }
                }, 3500);
            }
        }

        function showStoreTransition(data = {}) {
            const text = getI18n();
            const mode = data.mode || 'returning';
            nameEl.textContent = data.name || '';

            hideExecutionLock();
            clearSessionPair();
            if (overlay._waitTimer) clearTimeout(overlay._waitTimer);

            if (bg) bg.style.backgroundImage = data.heroImage ? `url('${data.heroImage}')` : 'none';
            setArt(data.gridImage || '');
            setState('loading');

            statusEl.textContent = mode === 'closing' ? text.closingStore : text.returningStore;
            cancelBtn.style.display = 'none';
            cancelBtn.style.opacity = '0';
            overlay.style.pointerEvents = 'all';
            overlay.classList.add('visible', 'store-transition-visible');
        }

        function setRunning() {
            const text = getI18n();
            const el = document.getElementById('overlayRunningText');
            if (el) el.textContent = text.running;


            const cancelBtn = document.getElementById('overlayCancelLaunchBtn');
            if (cancelBtn) {
                cancelBtn.style.opacity = '0';
                setTimeout(() => { cancelBtn.style.display = 'none'; }, 300);
            }

            setState('running');
        }

        function setError(gameName, reason) {
            const text = getI18n();
            if (overlay._waitTimer) clearTimeout(overlay._waitTimer);
            cancelBtn.style.display = 'none';
            overlay.classList.remove('execution-lock-visible');
            clearSessionPair();

            errTitle.textContent = text.errTitle + (gameName ? ` "${gameName}"` : '');
            errSub.textContent = reason === 'crash' ? text.errCrash
                : reason === 'timeout' ? text.errTimeout
                    : text.errGeneric;
            setState('error');
            setTimeout(() => document.getElementById('overlayDismissBtn')?.focus(), 50);
        }

        function showExecutionLock(data = {}) {
            if (overlay._waitTimer) clearTimeout(overlay._waitTimer);
            const hasActionableTarget = !!(data.id || data.url);
            if (!hasActionableTarget) {
                return;
            }
            const fallbackName =
                data.kind === 'game' || data.channel === 'games' ? 'Jogo em execução' :
                    data.kind === 'store' || data.channel === 'stores' ? 'Loja em execução' :
                        'Sessão em execução';
            const name = data.name || data.gameName || fallbackName;
            const hasContext = name || data.id || data.url;
            if (!hasContext || Date.now() < (window._doorpiOfficialReturnSuppressUntil || 0)) {
                hide();
                return;
            }

            const nextContextKey = `${data.kind || ''}|${data.channel || ''}|${data.id || ''}|${data.url || ''}`;
            const currentContextKey = overlay.dataset.executionLockKey || '';
            const isAlreadyVisible =
                overlay.classList.contains('visible') &&
                overlay.classList.contains('execution-lock-visible');
            const isSameContextVisible = isAlreadyVisible && currentContextKey === nextContextKey;
            const shouldPreserveFocus = isSameContextVisible;
            overlay.dataset.executionLockKey = nextContextKey;

            nameEl.textContent = name;
            statusEl.textContent = 'EM EXECUÇÃO';
            if (bg && (data.heroImage || !isSameContextVisible)) {
                bg.style.backgroundImage = data.heroImage ? `url('${data.heroImage}')` : 'none';
            }
            if (data.gridImage || !isSameContextVisible) {
                setArt(data.gridImage);
            }
            setState('running');
            renderSessionPair(data);

            cancelBtn.style.display = 'none';
            cancelBtn.style.opacity = '0';
            overlay.style.pointerEvents = 'all';
            overlay.classList.add('visible', 'execution-lock-visible');

            const focusPrimary = () => {
                const primary = document.getElementById('executionLockRestore');
                if (primary && primary.offsetWidth > 0 && primary.offsetHeight > 0) primary.focus();
            };
            const lockHasFocus = !!(lockActions && lockActions.contains(document.activeElement));
            clearExecutionLockFocusTimers();
            executionLockFocusTimerA = setTimeout(() => {
                if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
                if (!shouldPreserveFocus || !lockHasFocus) focusPrimary();
            }, 50);
            executionLockFocusTimerB = setTimeout(() => {
                if (!shouldPreserveFocus || !lockHasFocus) focusPrimary();
            }, 220);
        }

        function hideExecutionLock() {
            clearExecutionLockFocusTimers();
            overlay.classList.remove('execution-lock-visible');
            overlay.dataset.executionLockKey = '';
            clearSessionPair();
            lockActions?.querySelectorAll('button').forEach(btn => {
                if (document.activeElement === btn) btn.blur();
            });
        }

        function hide() {
            if (overlay._waitTimer) clearTimeout(overlay._waitTimer);
            clearExecutionLockFocusTimers();
            cancelBtn.style.opacity = '0';
            overlay.classList.remove('execution-lock-visible', 'store-transition-visible');
            overlay.dataset.executionLockKey = '';
            clearSessionPair();


            setTimeout(() => {
                cancelBtn.style.display = 'none';
                if (document.activeElement === cancelBtn) {
                    cancelBtn.blur();
                }
            }, 300);

            overlay.style.pointerEvents = 'none';
            overlay.style.backdropFilter = 'none';
            overlay.style.webkitBackdropFilter = 'none';
            overlay.classList.remove('visible');

            setTimeout(() => {
                overlay.style.backdropFilter = '';
                overlay.style.webkitBackdropFilter = '';
                setState('loading');
                nameEl.textContent = '';
                setArtFallback();
                if (bg) bg.style.backgroundImage = 'none';
            }, 400);
        }

        return { show, showStoreTransition, setRunning, setError, hide, showExecutionLock, hideExecutionLock };
    })();


    setTimeout(() => {
        postToHost({ action: 'requestExtensionUpdates' });
    }, 1500);
