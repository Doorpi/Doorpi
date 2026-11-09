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
            this.maxVolume = maxVolume;
            this.volumeScale = 1;
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

        setVolumeScale(scale) {
            const safe = Math.max(0, Math.min(1, Number(scale) || 0));
            this.volumeScale = safe;
            this.volume = this.maxVolume * safe;
            if (!this.gainNode || !this.ctx || !this.isPlaying) return;
            const now = this.ctx.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.linearRampToValueAtTime(this.volume, now + 0.12);
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

    window._setDoorpiHomeInteractionBlocked = function (blocked = false) {
        const roots = [
            document.querySelector('.main-content-wrapper'),
            document.querySelector('.doorpi-top-cluster'),
            document.getElementById('doorpiNotificationCenter')
        ].filter(Boolean);

        roots.forEach(root => {
            try { root.inert = !!blocked; } catch { }
            if (blocked) {
                root.setAttribute('aria-hidden', 'true');
                root.style.pointerEvents = 'none';
            } else {
                root.removeAttribute('aria-hidden');
                root.style.pointerEvents = '';
                try { root.inert = false; } catch { }
            }
        });
    };

    window.isDoorpiSessionTransitionActive = function () {
        const overlay = document.getElementById('doorpiUserSwitchLogout');
        const overlayActive = !!overlay &&
            overlay.style.display !== 'none' &&
            overlay.style.pointerEvents !== 'none' &&
            overlay.classList.contains('visible');
        return !!window._userSwitching || overlayActive;
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

    window._doorpiNativeDialogSuppressUntil = 0;
    window._doorpiSuppressNativeDialogPointer = function (durationMs = 900) {
        window._doorpiNativeDialogSuppressUntil = Date.now() + durationMs;
    };
    window._doorpiPointerSuppressUntil = 0;
    window._doorpiSuppressPointer = function (durationMs = 280) {
        window._doorpiPointerSuppressUntil = Date.now() + durationMs;
    };
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick'].forEach(type => {
        document.addEventListener(type, (e) => {
            const now = Date.now();
            if (now >= (window._doorpiNativeDialogSuppressUntil || 0) &&
                now >= (window._doorpiPointerSuppressUntil || 0)) {
                return;
            }
            e.preventDefault();
            e.stopImmediatePropagation();
        }, true);
    });

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
                gain: 0.18,
                frequency: 300,
                endFrequency: 520,
                attack: 0.012,
            },
            confirm: {
                gain: 0.19,
                frequency: 330,
                endFrequency: 610,
                attack: 0.016,
            },
            back: {
                gain: 0.095,
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
        const baseGains = {
            navigation: uiSound.move.gain,
            confirm: uiSound.confirm.gain,
            back: uiSound.back.gain
        };
        const volumeScales = {
            navigation: 1,
            confirm: 1,
            back: 1
        };

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

        function gainFor(kind) {
            if (kind === 'confirm') return baseGains.confirm * volumeScales.confirm;
            if (kind === 'back') return baseGains.back * volumeScales.back;
            return baseGains.navigation * volumeScales.navigation;
        }

        function setVolumeScales(scales = {}) {
            ['navigation', 'confirm', 'back'].forEach(key => {
                if (scales[key] === undefined) return;
                const safe = Math.max(0, Math.min(1, Number(scales[key]) || 0));
                volumeScales[key] = safe;
            });
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
                playTone(context, now + 0.002, uiSound.confirm.frequency, 0.16, gainFor('confirm'), {
                    endFrequency: uiSound.confirm.endFrequency,
                    attack: uiSound.confirm.attack,
                });
            } else if (kind === 'back') {
                playTone(context, now + 0.002, uiSound.back.frequency, 0.34, gainFor('back'), {
                    endFrequency: uiSound.back.endFrequency,
                    attack: uiSound.back.attack,
                    space: uiSound.back.space,
                });
            } else {
                playTone(context, now + 0.002, uiSound.move.frequency, 0.09, gainFor('navigation'), {
                    endFrequency: uiSound.move.endFrequency,
                    attack: uiSound.move.attack,
                });
            }
        }

        return { play, setVolumeScales };
    })();

    window.DoorpiSoundSettings = (() => {
        const storageKey = 'doorpi.sound.volumes.v1';
        const defaults = {
            ambience: 100,
            navigation: 100,
            confirm: 100,
            back: 100,
            intro: 100,
            trailer: 34
        };

        function clamp(value) {
            const n = Number(value);
            if (!Number.isFinite(n)) return 100;
            return Math.max(0, Math.min(100, Math.round(n)));
        }

        function readVolumes() {
            try {
                const raw = JSON.parse(localStorage.getItem(storageKey) || '{}');
                return Object.fromEntries(Object.keys(defaults).map(key => [key, clamp(raw[key] ?? defaults[key])]));
            } catch {
                return { ...defaults };
            }
        }

        function saveVolumes(volumes) {
            try { localStorage.setItem(storageKey, JSON.stringify(volumes)); } catch { }
        }

        function apply(volumes = readVolumes()) {
            window._audioPlayer?.setVolumeScale?.(volumes.ambience / 100);
            window.DoorpiUiSound?.setVolumeScales?.({
                navigation: volumes.navigation / 100,
                confirm: volumes.confirm / 100,
                back: volumes.back / 100
            });
            window.DoorpiIntro?.setVolume?.(volumes.intro / 100);
            window.setHomeTrailerVolume?.(volumes.trailer);
        }

        function setInternalVolume(key, value) {
            if (!Object.prototype.hasOwnProperty.call(defaults, key)) return readVolumes();
            const volumes = readVolumes();
            volumes[key] = clamp(value);
            saveVolumes(volumes);
            apply(volumes);
            return volumes;
        }

        const api = {
            getInternalVolumes: readVolumes,
            setInternalVolume,
            applyInternalVolumes: () => apply(readVolumes())
        };

        requestAnimationFrame(() => api.applyInternalVolumes());
        return api;
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
            if (window.DoorpiControls?.isOpen?.()) return;
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

