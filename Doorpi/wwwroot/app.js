    let allInstalledApps = [];
    let cachedFolders = null;
    let supportedStores = [];
    let currentSourceFilter = ['all'];
    let isFolderOperationInProgress = false;
    window.newGameIdsThisSession = new Set();
    window.recentlyOpenedIds = [];
    window.isGlobalLoading = false;
    window._doorpiUsers = [];
    window._doorpiCurrentUserId = '';
    window._pendingExtensionUpdates = {};

    document.addEventListener('contextmenu', event => event.preventDefault(), true);
    document.addEventListener('keydown', event => {
        const key = (event.key || '').toLowerCase();
        const blocked =
            event.key === 'F12' ||
            (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
            (event.ctrlKey && key === 'u');
        if (!blocked) return;
        event.preventDefault();
        event.stopPropagation();
    }, true);

    const DOORPI_BULK_LIBRARY_THRESHOLD = 3;
    let _pendingNewGameQueue = [];
    let _pendingNewGameTimer = 0;
    let _pendingRenderGamesPayload = null;
    let _pendingRenderGamesTimer = 0;
    const FIRST_RUN_TUTORIAL_PENDING_KEY = 'doorpi.firstRunTutorial.pending.v1';
    const FIRST_RUN_TUTORIAL_DONE_KEY = 'doorpi.firstRunTutorial.done.v1';

    window.DoorpiFirstRunTutorial = (() => {
        let page = 0;

        function storageGet(key) {
            try { return localStorage.getItem(key); }
            catch { return null; }
        }

        function storageSet(key, value) {
            try { localStorage.setItem(key, value); }
            catch { }
        }

        function storageRemove(key) {
            try { localStorage.removeItem(key); }
            catch { }
        }

        function shouldShow() {
            return storageGet(FIRST_RUN_TUTORIAL_PENDING_KEY) === 'true' &&
                storageGet(FIRST_RUN_TUTORIAL_DONE_KEY) !== 'true';
        }

        function ensureStyles() {
            if (document.getElementById('doorpiFirstRunTutorialStyles')) return;
            const s = document.createElement('style');
            s.id = 'doorpiFirstRunTutorialStyles';
            s.textContent = `
                .doorpi-first-run-tutorial {
                    position: fixed;
                    inset: 0;
                    z-index: 18500;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    padding: clamp(28px, 6vw, 92px);
                    background: radial-gradient(circle at 50% 45%, rgba(32,52,92,.26), transparent 42%), rgba(0,0,8,.74);
                    backdrop-filter: blur(14px) brightness(.72);
                    -webkit-backdrop-filter: blur(14px) brightness(.72);
                    color: #fff;
                    text-align: center;
                }
                .doorpi-first-run-tutorial.visible { display: flex; }
                .first-run-panel {
                    width: min(920px, 90vw);
                    display: grid;
                    gap: clamp(16px, 2.1vh, 30px);
                    animation: firstRunIn .36s cubic-bezier(.2,.9,.2,1) both;
                }
                @keyframes firstRunIn {
                    from { opacity: 0; transform: translateY(18px) scale(.985); }
                    to { opacity: 1; transform: none; }
                }
                .first-run-title {
                    margin: 0;
                    font-size: clamp(1.8rem, 3.8vw, 4.8rem);
                    line-height: .95;
                    font-weight: 300;
                    letter-spacing: -.035em;
                    text-shadow: 0 0 42px rgba(125,203,255,.22), 0 18px 80px rgba(0,0,0,.72);
                }
                .first-run-copy {
                    display: grid;
                    gap: clamp(10px, 1.35vh, 17px);
                    margin: 0 auto;
                    max-width: 780px;
                    color: rgba(255,255,255,.82);
                    font-size: clamp(1rem, 1.28vw, 1.58rem);
                    line-height: 1.34;
                    font-weight: 340;
                }
                .first-run-copy p {
                    margin: 0;
                }
                .first-run-action {
                    justify-self: center;
                    min-width: clamp(170px, 14vw, 260px);
                    min-height: clamp(46px, 5vh, 62px);
                    border: 1px solid rgba(255,255,255,.18);
                    border-radius: 10px;
                    background: rgba(255,255,255,.88);
                    color: #050711;
                    font: inherit;
                    font-size: clamp(.9rem, 1.02vw, 1.18rem);
                    font-weight: 760;
                    letter-spacing: .02em;
                    outline: none;
                    cursor: pointer;
                    box-shadow: 0 20px 60px rgba(0,0,0,.42), 0 0 34px rgba(125,203,255,.16);
                    transition: transform .16s ease, box-shadow .16s ease, background .16s ease;
                }
                .first-run-action:focus,
                .first-run-action:hover {
                    transform: translateY(-2px) scale(1.03);
                    background: #fff;
                    box-shadow: 0 24px 70px rgba(0,0,0,.52), 0 0 0 5px rgba(255,255,255,.16), 0 0 44px rgba(125,203,255,.26);
                }
                .first-run-hint {
                    color: rgba(255,255,255,.48);
                    font-size: clamp(.84rem, 1vw, 1.12rem);
                    letter-spacing: .12em;
                    text-transform: uppercase;
                }
                .doorpi-shortcut-combo {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: .34em;
                    white-space: nowrap;
                    vertical-align: middle;
                    transform: translateY(-.04em);
                }
                .doorpi-shortcut-plus {
                    color: rgba(255,255,255,.42);
                    font-size: .72em;
                    font-weight: 760;
                }
                .doorpi-keycap {
                    min-width: 2.45em;
                    height: 1.62em;
                    padding: 0 .62em;
                    border-radius: .5em;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.055));
                    border: 1px solid rgba(255,255,255,.30);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,.20), 0 .32em .9em rgba(0,0,0,.30);
                    color: rgba(255,255,255,.94);
                    font-size: .58em;
                    font-weight: 860;
                    letter-spacing: .08em;
                }
                .doorpi-xbox-logo-btn {
                    width: 2.08em;
                    height: 2.08em;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(180deg, #f6f6f7, #c9ccd2);
                    border: 1px solid rgba(255,255,255,.48);
                    box-shadow: inset 0 .12em .22em rgba(255,255,255,.58), inset 0 -.18em .34em rgba(0,0,0,.22), 0 .34em .82em rgba(0,0,0,.34);
                    color: #151820;
                }
                .doorpi-xbox-logo-btn svg {
                    width: 1.18em;
                    height: 1.18em;
                    display: block;
                    fill: currentColor;
                }
                .doorpi-face-x {
                    width: 1.45em;
                    height: 1.45em;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: #003e92;
                    color: #fff;
                    font-size: .72em;
                    font-weight: 900;
                    line-height: 1;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 .24em .6em rgba(0,0,0,.28);
                    vertical-align: middle;
                    transform: translateY(-.07em);
                }
                .first-run-em {
                    color: rgba(255,255,255,.96);
                    font-weight: 620;
                    text-shadow: 0 0 26px rgba(125,203,255,.20);
                }
                .doorpi-stickcap {
                    width: 2.08em;
                    height: 2.08em;
                    border-radius: 50%;
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background:
                        radial-gradient(circle at 38% 30%, rgba(255,255,255,.26), transparent 18%),
                        radial-gradient(circle at 50% 55%, rgba(255,255,255,.08), transparent 46%),
                        linear-gradient(180deg, #303340, #11131b);
                    border: 1px solid rgba(255,255,255,.22);
                    box-shadow: inset 0 .18em .32em rgba(255,255,255,.08), inset 0 -.24em .42em rgba(0,0,0,.42), 0 .38em .9em rgba(0,0,0,.36);
                    color: rgba(255,255,255,.95);
                    font-size: .58em;
                    font-weight: 900;
                    letter-spacing: .04em;
                }
                .doorpi-stickcap::after {
                    content: '';
                    position: absolute;
                    inset: 28%;
                    border-radius: 50%;
                    border: 1px solid rgba(255,255,255,.28);
                    box-shadow: 0 0 0 .18em rgba(0,0,0,.14);
                }
            `;
            document.head.appendChild(s);
        }

        function xboxLogoSvg() {
            return `<svg viewBox="1 1 30 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M11.9 9.3c-5.1-5.1-6.4-4-6.4-4C2.7 8 1 11.8 1 16c0 3.4 1.1 6.6 3.1 9.1h.1V25C3 21.5 8.9 12.9 11.9 9.3zm14.6-4s-1.3-1.1-6.4 3.9c3 3.6 8.9 12.2 7.7 15.7v.1h.1c1.9-2.5 3.1-5.7 3.1-9.1 0-4.1-1.7-7.9-4.5-10.6zM16 5.4c.5-.2 4.9-2.8 7.8-2.1h.1v-.1C21.5 1.8 19 1 16 1s-5.5.8-7.8 2.2v.1h.1c2.5-.6 6.6 1.5 7.7 2.1zm0 7.7c0-.1 0-.1 0 0C11.4 16.5 3.7 25 6.1 27.3 8.8 29.6 12.2 31 16 31s7.2-1.4 9.9-3.7c2.3-2.4-5.4-10.8-9.9-14.2z"/></svg>`;
        }

        function shortcutHtml() {
            return `<span class="doorpi-shortcut-combo" aria-label="Xbox ou L1 + R1 + R3">
                <span class="doorpi-xbox-logo-btn">${xboxLogoSvg()}</span>
                <span class="doorpi-shortcut-plus">/</span>
                <span class="doorpi-keycap">L1</span>
                <span class="doorpi-shortcut-plus">+</span>
                <span class="doorpi-keycap">R1</span>
                <span class="doorpi-shortcut-plus">+</span>
                <span class="doorpi-stickcap">R3</span>
            </span>`;
        }

        function closeButtonHtml() {
            return `<span class="doorpi-face-x">X</span>`;
        }

        function formatTutorialText(text) {
            return escapeHtml(text)
                .replaceAll('__DOORPI_RETURN_SHORTCUT__', shortcutHtml())
                .replaceAll('__DOORPI_CLOSE_BUTTON__', closeButtonHtml())
                .replace(/\b(YouTube|Discord|GitHub|Doorpi|multitarefas|beta)\b/g, '<span class="first-run-em">$1</span>');
        }

        function pages() {
            const shortcutToken = '__DOORPI_RETURN_SHORTCUT__';
            const closeToken = '__DOORPI_CLOSE_BUTTON__';
            return [
                [
                    typeof t === 'function' ? t('firstRunPage1', shortcutToken, closeToken) : `Para sair de qualquer jogo ou aplicativo, pressione ${shortcutToken} a qualquer momento para retornar ao Doorpi. Você pode fechar qualquer aplicativo pelas opções pressionando ${closeToken}.`
                ],
                [
                    typeof t === 'function' ? t('firstRunPage2a') : 'O Doorpi permite multitarefas, você é livre para ouvir YouTube, usar Discord e jogar tudo ao mesmo tempo!',
                    typeof t === 'function' ? t('firstRunPage2b', shortcutToken) : `Pressione ${shortcutToken} para minimizar e abrir outra aplicação quando quiser.`,
                    typeof t === 'function' ? t('firstRunPage2c') : 'Esta é uma versão beta. Caso encontre algum problema, reporte no GitHub do projeto.',
                    typeof t === 'function' ? t('firstRunPage2d') : 'Divirta-se!'
                ]
            ];
        }

        function render() {
            const overlay = document.getElementById('doorpiFirstRunTutorial');
            if (!overlay) return;
            const tr = (key, ...args) => typeof t === 'function' ? t(key, ...args) : key;
            const allPages = pages();
            const copy = allPages[Math.min(page, allPages.length - 1)] || [];
            const isLast = page >= allPages.length - 1;
            overlay.innerHTML = `
                <section class="first-run-panel" aria-live="polite">
                    <h1 class="first-run-title">${tr('firstRunTitle')}</h1>
                    <div class="first-run-copy">
                        ${copy.map(text => `<p>${formatTutorialText(text)}</p>`).join('')}
                    </div>
                    <button class="first-run-action" type="button" tabindex="0">
                        ${isLast ? tr('firstRunFinish') : tr('firstRunNext')}
                    </button>
                    <div class="first-run-hint">${tr('firstRunHint')}</div>
                </section>
            `;
            overlay.querySelector('.first-run-action')?.addEventListener('click', confirm);
            requestAnimationFrame(() => overlay.querySelector('.first-run-action')?.focus());
        }

        function show() {
            if (!shouldShow()) return false;
            if (isOpen()) return true;
            ensureStyles();
            let overlay = document.getElementById('doorpiFirstRunTutorial');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'doorpiFirstRunTutorial';
                overlay.className = 'doorpi-first-run-tutorial doorpi-manager-overlay';
                overlay.dataset.required = 'true';
                document.body.appendChild(overlay);
            }
            page = 0;
            render();
            overlay.classList.add('visible');
            overlay.style.display = 'flex';
            window.updateDoorpiQuickMenuAvailability?.();
            return true;
        }

        function finish() {
            const overlay = document.getElementById('doorpiFirstRunTutorial');
            storageSet(FIRST_RUN_TUTORIAL_DONE_KEY, 'true');
            storageRemove(FIRST_RUN_TUTORIAL_PENDING_KEY);
            if (overlay) {
                overlay.classList.remove('visible');
                overlay.style.display = 'none';
            }
            window.updateDoorpiQuickMenuAvailability?.();
            window.focusFeaturedCard?.();
            return true;
        }

        function confirm() {
            if (!isOpen()) return false;
            const allPages = pages();
            if (page < allPages.length - 1) {
                page += 1;
                render();
                return true;
            }
            return finish();
        }

        function isOpen() {
            const overlay = document.getElementById('doorpiFirstRunTutorial');
            return !!(overlay && overlay.style.display !== 'none' && overlay.classList.contains('visible'));
        }

        return { maybeShow: show, confirm, isOpen };
    })();

    function _libraryUpdateShouldWait() {
        const phase = window._navMenuPhase || 'closed';
        return phase === 'opening'
            || phase === 'closing'
            || document.body.classList.contains('nav-menu-closing')
            || window._userSwitching === true
            || (window._doorpiSessionTransitionBlockUntil && Date.now() < window._doorpiSessionTransitionBlockUntil)
            || window.isDoorpiSessionTransitionActive?.() === true;
    }

    function _enqueueNewGameForLibrary(channel, data) {
        _pendingNewGameQueue.push({ channel, data: { ...data } });
        if (_pendingNewGameTimer) clearTimeout(_pendingNewGameTimer);
        _pendingNewGameTimer = setTimeout(_flushNewGameQueue, 110);
    }

    function _flushNewGameQueue() {
        _pendingNewGameTimer = 0;
        if (_pendingNewGameQueue.length === 0) return;

        if (_libraryUpdateShouldWait()) {
            _pendingNewGameTimer = setTimeout(_flushNewGameQueue, 80);
            return;
        }

        const batch = _pendingNewGameQueue.splice(0);
        const byChannel = new Map();
        batch.forEach(entry => {
            if (!byChannel.has(entry.channel)) byChannel.set(entry.channel, []);
            byChannel.get(entry.channel).push(entry.data);
        });

        requestAnimationFrame(() => {
            byChannel.forEach((items, channel) => {
                const silent = items.length > DOORPI_BULK_LIBRARY_THRESHOLD;
                if (silent && typeof window.clearLoadingCards === 'function') {
                    window.clearLoadingCards(channel === 'media' ? 'media' : 'games');
                }
                if (silent && window.AppStore?.mutations?.addItems) {
                    window.AppStore.mutations.addItems(channel, items, { silent: true });
                } else {
                    items.forEach(item => window.AppStore?.mutations?.addItem(channel, item, { silent: false }));
                }
            });
        });
    }

    function _countSessionNewGames(items) {
        if (!Array.isArray(items)) return 0;
        return items.reduce((count, item) => {
            const ids = [item.id, item.Id, item.launchUrl, item.LaunchUrl, item.path, item.Path].filter(Boolean);
            const isNew = ids.some(id => window.newGameIdsThisSession?.has(id)
                || window.newGameIdsThisSession?.has(String(id).replace(/\/$/, '')));
            return count + (isNew ? 1 : 0);
        }, 0);
    }

    function _scheduleRenderGamesBatch(payload) {
        _pendingRenderGamesPayload = payload;
        if (_pendingRenderGamesTimer) clearTimeout(_pendingRenderGamesTimer);

        const flush = () => {
            _pendingRenderGamesTimer = 0;
            if (!_pendingRenderGamesPayload) return;

            if (_libraryUpdateShouldWait()) {
                _pendingRenderGamesTimer = setTimeout(flush, 80);
                return;
            }

            const current = _pendingRenderGamesPayload;
            _pendingRenderGamesPayload = null;

            requestAnimationFrame(() => {
                if (current.silent && typeof window.clearLoadingCards === 'function') {
                    window.clearLoadingCards('games');
                }

                window.AppStore?.mutations?.setBatch('games', current.games || [], { silent: !!current.silent });
                window._navMenuDataChanged?.('games');

                if (current.wasOnMedia && current.heroSnapSrc && !current.silent) {
                    requestAnimationFrame(() =>
                        switchHeroBackground(current.heroSnapSrc, current.heroSnapLogo, current.heroSnapHoriz));
                }
            });
        };

        _pendingRenderGamesTimer = setTimeout(flush, _libraryUpdateShouldWait() ? 80 : 0);
    }


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
            intro: 100
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
            name: gameVisual.name || lockData.name || t('genericGameName'),
            image: gameVisual.gridImage || gameVisual.heroImage || lockData.gridImage || lockData.heroImage || ''
        };
        const store = {
            name: storeVisual.name || t('genericStoreName'),
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

        if (entry.kind === 'storeInstall' || entry.appType === 'storeInstall') score += 260;
        if (entry.channel === 'games') score += 300;
        else if (entry.channel === 'stores') score += 180;
        else if (entry.channel === 'media') score += 120;

        if (entry.kind === 'game') score += 120;
        else if (entry.kind === 'storeInstall') score += 100;
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
        const installFallbackName = (entry.kind === 'storeInstall' || entry.appType === 'storeInstall')
            ? t('storeInstallRunning')
            : '';
        const name =
            nameFromCard ||
            entry.name ||
            installFallbackName ||
            (entry.channel === 'games' ? t('runningGameName')
                : entry.channel === 'stores' ? t('runningStoreName')
                    : t('runningSessionName'));

        // Sem alvo acionável (id/url), não promovemos para evitar overlay "órfão".
        if (!resolvedId && !resolvedUrl) return null;

        return {
            kind: entry.kind || '',
            channel: entry.channel || '',
            id: resolvedId,
            url: resolvedUrl,
            appType: entry.appType || (entry.channel === 'games' ? 'game' : (entry.kind || '')),
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
            payload.kind === 'game' || payload.channel === 'games' ? t('runningGameName') :
                payload.kind === 'storeInstall' || payload.appType === 'storeInstall' ? t('storeInstallRunning') :
                payload.kind === 'store' || payload.channel === 'stores' ? t('runningStoreName') :
                    t('runningSessionName');

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
        return _hasAnyRuntimeSession() || _isGpuUpdaterExecutionLockOwned();
    }

    function _ensureExecutionOverlayForActiveSession() {
        if (typeof GameLaunchOverlay === 'undefined') return false;
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        const isVisibleExecution = !!(launchOverlay &&
            launchOverlay.classList.contains('visible') &&
            launchOverlay.classList.contains('execution-lock-visible'));
        if (isVisibleExecution) {
            if (!_hasAnyRuntimeSession()) {
                if (_isGpuUpdaterExecutionLockOwned()) return true;
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

    function _isGpuUpdaterExecutionLockOwned() {
        if (!_isExecutionOverlayVisible()) return false;
        const lock = window._lastExecutionLockData || {};
        return lock.kind === 'gpuUpdater' ||
            lock.appType === 'gpuUpdater' ||
            lock.channel === 'gpu';
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
                z-index: 40000;
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
            <div id="sessionConflictCard" role="dialog" aria-modal="true" aria-label="${typeof t === 'function' ? t('sessionConflictAriaLabel') : 'Conflito de sessão'}">
                <div id="sessionConflictAccent" aria-hidden="true"></div>
                <div id="sessionConflictBody">
                    <div id="sessionConflictKicker">${typeof t === 'function' ? t('sessionConflictActiveKicker') : 'Sessão ativa'}</div>
                    <div id="sessionConflictCopy">
                        <h3 id="sessionConflictTitle">${typeof t === 'function' ? t('sessionConflictTitle') : 'Sessão em andamento'}</h3>
                        <p id="sessionConflictMessage">${typeof t === 'function' ? t('sessionConflictDefaultMessage') : 'Uma sessão já está ativa. Encerre a sessão atual para iniciar outra.'}</p>
                        <p id="sessionConflictHint">${typeof t === 'function' ? t('sessionConflictHint') : 'O Doorpi mantém uma sessão por vez para evitar sobreposição de janelas.'}</p>
                    </div>
                    <div id="sessionConflictActions">
                        <button id="sessionConflictClose" class="conflict-action primary" type="button" tabindex="0">
                            <span class="action-text">${typeof t === 'function' ? t('sessionConflictClose') : 'Encerrar'}</span>
                        </button>
                        <button id="sessionConflictCancel" class="conflict-action secondary" type="button" tabindex="0">
                            <span class="action-text">${typeof t === 'function' ? t('sessionConflictCancel') : 'Cancelar'}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector('#sessionConflictCancel');
        const closeBtn = overlay.querySelector('#sessionConflictClose');

        const movePopupFocus = (direction) => {
            const items = window.getSessionConflictPopupItems?.() || [];
            if (!items.length) return false;

            const currentIndex = items.indexOf(document.activeElement);
            const step = direction === 'RIGHT' || direction === 'DOWN' ? 1 : -1;
            const nextIndex = currentIndex < 0
                ? 0
                : (currentIndex + step + items.length) % items.length;
            items[nextIndex]?.focus();
            return true;
        };

        window.moveSessionConflictPopupFocus = movePopupFocus;
        window.cancelSessionConflictPopup = function () {
            if (!window.isSessionConflictPopupOpen?.()) return false;
            cancelBtn?.click();
            return true;
        };
        window.activateSessionConflictPopup = function () {
            if (!window.isSessionConflictPopupOpen?.()) return false;
            const active = document.activeElement;
            if (active && overlay.contains(active) && typeof active.click === 'function') active.click();
            else closeBtn?.click();
            return true;
        };

        document.addEventListener('focusin', (event) => {
            if (!overlay.classList.contains('visible') || overlay.contains(event.target)) return;
            event.stopImmediatePropagation();
            queueMicrotask(() => closeBtn?.focus());
        }, true);

        cancelBtn?.addEventListener('click', () => {
            window.hideSessionConflictPopup?.(true);
        });
        closeBtn?.addEventListener('click', () => {
            const payload = _sessionConflictClosePayload;
            window.hideSessionConflictPopup?.(true);
            if (payload) {
                if (payload.action === 'closeAllSessionsForStoreDownload') {
                    postToHost({
                        action: 'closeAllSessionsForStoreDownload',
                        storeId: payload.storeId || '',
                        url: payload.url || '',
                        name: payload.name || ''
                    });
                    return;
                }
                if (payload.action === 'closeAllSessionsForGpuUpdater') {
                    postToHost({
                        action: 'closeAllSessionsForGpuUpdater',
                        updaterId: payload.updaterId || ''
                    });
                    return;
                }

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

    window.showSessionConflictPopup = function ({
        closePayload,
        runningName,
        title,
        message,
        hint,
        kicker,
        confirmText,
        cancelText
    } = {}) {
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

        const titleText = title || (typeof t === 'function' ? t('sessionConflictTitle') : 'Processo/Jogo em andamento');
        const fallbackName = typeof t === 'function' ? t('sessionConflictCurrent') : 'atual';
        const baseMessage = message || (typeof t === 'function' ? t('sessionConflictMessage') : 'Deseja encerrar o processo/jogo {name}?');
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

        if (kickerEl && kicker) kickerEl.textContent = kicker;
        if (hintEl && hint) hintEl.textContent = hint;
        if (cancelBtn && cancelText) {
            const textEl = cancelBtn.querySelector('.action-text');
            if (textEl) textEl.textContent = cancelText;
        }
        if (closeBtn && confirmText) {
            const textEl = closeBtn.querySelector('.action-text');
            if (textEl) textEl.textContent = confirmText;
        }

        overlay.classList.add('visible');
        if (!wasVisible) {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                closeBtn?.focus();
                if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
            }));
        }
    };

    window.hasStoreDownloadBlockingRuntime = function () {
        const entries = Array.isArray(window.DoorpiRuntimeState?.running) ? window.DoorpiRuntimeState.running : [];
        return entries.some(entry =>
            entry &&
            entry.kind !== 'storeInstall' &&
            entry.appType !== 'storeInstall'
        );
    };

    window.showStoreDownloadSessionConflict = function ({ storeId, url, name } = {}) {
        window.showSessionConflictPopup?.({
            closePayload: {
                action: 'closeAllSessionsForStoreDownload',
                storeId: storeId || '',
                url: url || '',
                name: name || ''
            },
            kicker: typeof t === 'function' ? t('storeDownloadConflictKicker', 'Loja em uso') : 'Loja em uso',
            title: typeof t === 'function' ? t('storeDownloadConflictTitle', 'Feche as tarefas abertas') : 'Feche as tarefas abertas',
            message: typeof t === 'function'
                ? t('storeDownloadConflictMessage', 'Para instalar uma loja, o Doorpi precisa encerrar jogos, apps e lojas em execução.')
                : 'Para instalar uma loja, o Doorpi precisa encerrar jogos, apps e lojas em execução.',
            hint: typeof t === 'function'
                ? t('storeDownloadConflictHint', 'Escolha encerrar tudo agora ou cancele para voltar.')
                : 'Escolha encerrar tudo agora ou cancele para voltar.',
            confirmText: typeof t === 'function' ? t('storeDownloadConflictCloseAll', 'Encerrar processos') : 'Encerrar processos',
            cancelText: typeof t === 'function' ? t('sessionConflictCancel') : 'Cancelar'
        });
    };

    window.showGpuUpdaterSessionConflict = function ({ updaterId, name } = {}) {
        window.showSessionConflictPopup?.({
            closePayload: {
                action: 'closeAllSessionsForGpuUpdater',
                updaterId: updaterId || ''
            },
            kicker: t('gpuUpdaterConflictKicker'),
            title: t('gpuUpdaterConflictTitle'),
            message: t('gpuUpdaterConflictMessage'),
            hint: t('gpuUpdaterConflictHint'),
            confirmText: t('gpuUpdaterConflictCloseAll'),
            cancelText: t('sessionConflictCancel'),
            runningName: name || ''
        });
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
        Xbox: {
            type: 'svg',
            icon: `<svg viewBox="0 0 24 24" fill="#107C10" xmlns="http://www.w3.org/2000/svg"><path d="M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912C23.002 17.48 24 14.861 24 12.004c0-3.34-1.365-6.362-3.57-8.536 0 0-.027-.022-.082-.042-.063-.022-.152-.045-.281-.045-.592 0-1.985.434-4.805 3.246zM3.654 3.426c-.057.02-.082.041-.086.042C1.365 5.642 0 8.664 0 12.004c0 2.854.998 5.473 2.661 7.533-1.401-2.605 3.579-9.951 6.08-12.91-2.82-2.813-4.216-3.245-4.806-3.245-.131 0-.223.021-.281.046v-.002zM12 3.551S9.055 1.828 6.755 1.746c-.903-.033-1.454.295-1.521.339C7.379.646 9.659 0 11.984 0H12c2.334 0 4.605.646 6.766 2.085-.068-.046-.615-.372-1.52-.339C14.946 1.828 12 3.545 12 3.545v.006z"/></svg>`
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
        Xbox: ['Xbox'],
        Windows: ['Windows', 'Folder'],
    };

    const SCAN_LIBS = ['Steam', 'Epic', 'GOG', 'Riot', 'Xbox', 'Windows', 'Folder'];
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
        btn.innerHTML = `
            <span class="top-quick-menu-cue" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M5 7h14" stroke-linecap="round"/>
                    <path d="M5 12h14" stroke-linecap="round"/>
                    <path d="M5 17h14" stroke-linecap="round"/>
                </svg>
                <span class="top-quick-menu-label">MENU</span>
            </span>
            <div class="doorpi-avatar"></div>
            <span class="top-profile-name"></span>`;
        document.body.appendChild(btn);

        btn.addEventListener('click', () => {
            postToHost({ action: 'requestUsers' });
        });

        const fallbackUserIcon = `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8.2" r="3.6" stroke="currentColor" stroke-width="1.8"/>
                <path d="M5.8 19.2c1-3.2 3.2-5 6.2-5s5.2 1.8 6.2 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>`;

        function applyTopProfileUser(user) {
            const u = user || window._doorpiProfile || {};
            const avatar = btn.querySelector('.doorpi-avatar');
            const name = btn.querySelector('.top-profile-name');
            if (avatar) {
                avatar.innerHTML = u?.PhotoBase64
                    ? `<img src="data:image/png;base64,${u.PhotoBase64}" />`
                    : (u?.Name ? u.Name.charAt(0).toUpperCase() : '•');
            }
            if (avatar && !u?.PhotoBase64) avatar.innerHTML = fallbackUserIcon;
            if (name) name.textContent = u?.Name ?? '';
            btn.classList.add('is-loaded');
        }

        window._applyDoorpiTopProfile = applyTopProfileUser;
        requestAnimationFrame(() => applyTopProfileUser(window._doorpiProfile));

        const s = document.createElement('style');
        s.textContent = `
            .top-profile-btn {
                position: fixed;
                top: clamp(20px, 3vh, 40px);
                left: clamp(12px, 1.3vw, 22px);
                display: flex;
                align-items: center;
                gap: 14px;
                background: none;
                border: none;
                cursor: pointer;
                outline: none;
                z-index: 17000;
                padding: 0;
                opacity: 0;
                transform: translateX(-15px) scale(0.95);
                transition: opacity 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
            }
            .top-profile-btn.is-loaded {
                opacity: 1;
                transform: translateX(0) scale(1);
            }
            .top-quick-menu-cue {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 42px;
                height: 42px;
                padding: 0;
                border-radius: 0 10px 10px 0;
                border: 0;
                border-left: 2px solid rgba(255,255,255,.42);
                background: linear-gradient(90deg, rgba(255,255,255,.11), rgba(255,255,255,.025));
                color: rgba(255,255,255,.76);
                filter: drop-shadow(0 2px 8px rgba(0,0,0,.45));
                transition: width .18s ease, padding .18s ease, background .18s ease, border-color .18s ease;
            }
            .top-quick-menu-cue svg {
                width: 22px;
                height: 22px;
                stroke-width: 2.1;
            }
            .top-quick-menu-label {
                display: none;
                font-size: 15px;
                font-weight: 600;
                letter-spacing: 0;
                color: rgba(255,255,255,.88);
                white-space: nowrap;
            }
            body.quick-panel-open .top-profile-btn {
                pointer-events: none;
            }
            body.user-picker-open .top-profile-btn,
            body.setup-active .top-profile-btn,
            body.quick-menu-unavailable .top-profile-btn,
            .top-profile-btn.nav-menu-hidden {
                opacity: 0 !important;
                pointer-events: none;
                transition: opacity 0.12s ease !important;
            }
            body.quick-panel-open .top-quick-menu-cue {
                width: auto;
                padding: 0 14px 0 10px;
                gap: 10px;
                background: transparent;
                border-left-color: rgba(255,255,255,.72);
                filter: none;
            }
            body.quick-panel-open .top-quick-menu-label {
                display: inline;
            }
            body.quick-panel-open .top-profile-btn .doorpi-avatar,
            body.quick-panel-open .top-profile-name {
                opacity: 0;
            }
            .top-profile-btn .doorpi-avatar {
                width: clamp(58px, 4.5vw, 74px);
                height: clamp(58px, 4.5vw, 74px);
                margin-left: clamp(10px, 1.7vw, 34px);
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
            .top-profile-btn .doorpi-avatar svg { width: 54%; height: 54%; color: rgba(255,255,255,.76); }
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

    (function initSystemUpdatePrompt() {
        const DISMISSED_KEY = 'doorpi.updatePrompt.dismissedTarget';
        let latestStatus = null;
        let retryTimer = 0;
        let isVisible = false;

        function esc(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function hasUpdate(status) {
            return !!(status && (status.doorpiUpdateAvailable || status.updaterUpdateAvailable));
        }

        function targetKey(status) {
            if (!hasUpdate(status)) return '';
            const doorpi = status.remoteDoorpiVersion || status.localDoorpiVersion || '';
            const updater = status.remoteUpdaterVersion || status.localUpdaterVersion || '';
            return `${doorpi}|${updater}|${status.doorpiUpdateAvailable ? 'doorpi' : ''}|${status.updaterUpdateAvailable ? 'updater' : ''}`;
        }

        function dismissedTarget() {
            try { return localStorage.getItem(DISMISSED_KEY) || ''; }
            catch { return ''; }
        }

        function dismissCurrentTarget() {
            const key = targetKey(latestStatus);
            if (!key) return;
            try { localStorage.setItem(DISMISSED_KEY, key); }
            catch { }
        }

        function clearDismissalIfResolved(status) {
            if (hasUpdate(status)) return;
            if (status?.status !== 'up-to-date') return;
            try { localStorage.removeItem(DISMISSED_KEY); }
            catch { }
        }

        function isLaunchOverlayVisible() {
            const overlay = document.getElementById('gameLaunchOverlay');
            return !!(overlay && overlay.classList.contains('visible'));
        }

        function hasRuntimeSession() {
            try {
                if (typeof _hasAnyRuntimeSession === 'function' && _hasAnyRuntimeSession()) return true;
            } catch { }

            const running = window.DoorpiRuntimeState?.running;
            return Array.isArray(running) && running.length > 0;
        }

        function shouldDeferAutoPrompt(status = latestStatus) {
            const force = !!status?.forceUpdate;
            if (isVisible) return false;
            if (!window._isIntroComplete) return true;
            if (window._isExternalAppRunning) return true;
            if (hasRuntimeSession()) return true;
            if (window.isDoorpiSessionTransitionActive?.()) return true;
            if (window.isGlobalLoading) return true;

            if (force) return false;

            if (window.isNavMenuOpen || ['opening', 'closing'].includes(window._navMenuPhase || 'closed')) return true;
            if (window.isModalOpen || window.isSetupOpen || window._vkbIsOpen) return true;
            if (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) return true;
            if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) return true;
            if (window.isDoorpiOverlayOpen?.()) return true;
            if (isLaunchOverlayVisible()) return true;
            return false;
        }

        function scheduleEvaluate(delay = 1200) {
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
                retryTimer = 0;
                evaluate();
            }, delay);
        }

        function ensureBadge() {
            let badge = document.getElementById('doorpiUpdateBadge');
            if (badge) return badge;

            badge = document.createElement('button');
            badge.id = 'doorpiUpdateBadge';
            badge.className = 'doorpi-update-badge';
            badge.type = 'button';
            badge.tabIndex = 0;
            badge.innerHTML = `
                <span class="doorpi-update-badge-dot"></span>
                <span class="doorpi-update-badge-text">${t('updateBadgeText')}</span>
            `;
            badge.addEventListener('click', () => show(true));
            badge.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                show(true);
            });

            const profile = document.getElementById('btnTopProfile');
            if (profile && profile.parentNode) {
                profile.insertAdjacentElement('afterend', badge);
            } else {
                document.body.appendChild(badge);
            }
            return badge;
        }

        function updateBadge() {
            const badge = ensureBadge();
            const available = hasUpdate(latestStatus);
            badge.classList.toggle('is-visible', available);
            badge.classList.toggle('is-force', !!latestStatus?.forceUpdate);
            badge.title = available
                ? t('updateBadgeAvailableTitle')
                : t('updateBadgeIdleTitle');
        }

        function ensurePrompt() {
            let prompt = document.getElementById('doorpiUpdatePrompt');
            if (prompt) return prompt;

            prompt = document.createElement('div');
            prompt.id = 'doorpiUpdatePrompt';
            prompt.className = 'doorpi-update-prompt';
            prompt.setAttribute('role', 'dialog');
            prompt.setAttribute('aria-modal', 'true');
            prompt.setAttribute('aria-labelledby', 'doorpiUpdatePromptTitle');
            prompt.innerHTML = `
                <div class="doorpi-update-shell">
                    <div class="doorpi-update-header">
                        <div>
                            <div class="doorpi-update-kicker">${t('updatePromptKicker')}</div>
                            <h2 id="doorpiUpdatePromptTitle">${t('updatePromptInitialTitle')}</h2>
                        </div>
                    </div>
                    <div class="doorpi-update-version-row" id="doorpiUpdateVersionRow"></div>
                    <p id="doorpiUpdatePromptSubtitle" class="doorpi-update-subtitle"></p>
                    <div class="doorpi-update-warning">${t('updatePromptWarning')}</div>
                    <div class="doorpi-update-actions">
                        <button id="doorpiUpdateStartBtn" class="doorpi-update-primary" type="button">${t('updatePromptStart')}</button>
                        <button id="doorpiUpdateLaterBtn" class="doorpi-update-secondary" type="button">${t('updatePromptLater')}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(prompt);

            prompt.querySelector('#doorpiUpdateStartBtn')?.addEventListener('click', () => {
                hide(false);
                if (typeof postToHost === 'function') {
                    postToHost({ action: 'startSystemUpdate' });
                }
            });

            prompt.querySelector('#doorpiUpdateLaterBtn')?.addEventListener('click', () => {
                if (latestStatus?.forceUpdate) return;
                dismissCurrentTarget();
                hide(true);
            });

            prompt.addEventListener('keydown', (e) => {
                if (!isVisible) return;
                const buttons = Array.from(prompt.querySelectorAll('button'))
                    .filter(btn => !btn.hidden && !btn.disabled);
                const current = buttons.indexOf(document.activeElement);
                if (e.key === 'Escape' || e.key === 'Backspace') {
                    e.preventDefault();
                    if (latestStatus?.forceUpdate) return;
                    dismissCurrentTarget();
                    hide(true);
                    return;
                }
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                    e.preventDefault();
                    const dir = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1;
                    const next = buttons[(Math.max(0, current) + dir + buttons.length) % buttons.length];
                    next?.focus();
                }
            });

            return prompt;
        }

        function promptIsOpen() {
            const prompt = document.getElementById('doorpiUpdatePrompt');
            return !!(isVisible || prompt?.classList.contains('is-visible'));
        }

        function focusPromptPrimary() {
            const prompt = ensurePrompt();
            const active = document.activeElement;
            if (prompt.contains(active)) return;
            prompt.querySelector('#doorpiUpdateStartBtn')?.focus({ preventScroll: true });
        }

        function handlePromptKey(e) {
            if (!promptIsOpen()) return false;

            const prompt = ensurePrompt();
            const buttons = Array.from(prompt.querySelectorAll('button'))
                .filter(btn => !btn.hidden && !btn.disabled);
            const current = buttons.indexOf(document.activeElement);

            e.preventDefault();
            e.stopImmediatePropagation();

            if (e.key === 'Escape' || e.key === 'Backspace') {
                if (latestStatus?.forceUpdate) {
                    focusPromptPrimary();
                    return true;
                }
                dismissCurrentTarget();
                hide(true);
                return true;
            }

            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                const dir = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1;
                const idx = current >= 0 ? current : 0;
                buttons[(idx + dir + buttons.length) % buttons.length]?.focus({ preventScroll: true });
                return true;
            }

            if (e.key === 'Enter' || e.key === ' ') {
                const activeButton = buttons.includes(document.activeElement)
                    ? document.activeElement
                    : prompt.querySelector('#doorpiUpdateStartBtn');
                activeButton?.click();
                return true;
            }

            focusPromptPrimary();
            return true;
        }

        function handlePromptPointer(e) {
            if (!promptIsOpen()) return false;

            const prompt = ensurePrompt();
            const button = e.target?.closest?.('#doorpiUpdatePrompt button');
            if (button && prompt.contains(button)) return false;

            e.preventDefault();
            e.stopImmediatePropagation();
            focusPromptPrimary();
            return true;
        }

        function renderPrompt() {
            const prompt = ensurePrompt();
            const title = prompt.querySelector('#doorpiUpdatePromptTitle');
            const sub = prompt.querySelector('#doorpiUpdatePromptSubtitle');
            const versions = prompt.querySelector('#doorpiUpdateVersionRow');
            const kicker = prompt.querySelector('.doorpi-update-kicker');
            const startBtn = prompt.querySelector('#doorpiUpdateStartBtn');
            const laterBtn = prompt.querySelector('#doorpiUpdateLaterBtn');

            const status = latestStatus || {};
            const force = !!status.forceUpdate;
            const parts = [];
            if (status.doorpiUpdateAvailable) parts.push('Doorpi');
            if (status.updaterUpdateAvailable) parts.push(t('updatePromptSystemComponents'));
            const scope = parts.length ? parts.join(' + ') : 'Doorpi';

            prompt.classList.toggle('is-force', force);
            if (kicker) kicker.textContent = force ? t('updatePromptForceKicker') : t('updatePromptKicker');
            if (title) title.textContent = force ? t('updatePromptForceTitle') : t('updatePromptTitle', scope);
            if (sub) {
                sub.textContent = force ? t('updatePromptForceSubtitle') : t('updatePromptSubtitle');
            }
            if (startBtn) startBtn.textContent = force ? t('updatePromptForceContinue') : t('updatePromptStart');
            if (laterBtn) {
                laterBtn.hidden = force;
                laterBtn.disabled = force;
            }

            if (versions) {
                const doorpi = status.doorpiUpdateAvailable
                    ? `<span>Doorpi ${esc(status.localDoorpiVersion || '--')} -> ${esc(status.remoteDoorpiVersion || '--')}</span>`
                    : '';
                const updater = status.updaterUpdateAvailable
                    ? `<span>Updater ${esc(status.localUpdaterVersion || '--')} -> ${esc(status.remoteUpdaterVersion || '--')}</span>`
                    : '';
                versions.innerHTML = [doorpi, updater].filter(Boolean).join('');
            }
        }

        function show(manual = false) {
            if (!hasUpdate(latestStatus)) return;

            if (!manual) {
                if (!latestStatus?.forceUpdate && targetKey(latestStatus) === dismissedTarget()) return;
                if (shouldDeferAutoPrompt()) {
                    scheduleEvaluate(1500);
                    return;
                }
            }

            renderPrompt();
            const prompt = ensurePrompt();
            isVisible = true;
            prompt.classList.add('is-visible');
            document.body.classList.add('doorpi-update-modal-open');
            window.updateDoorpiQuickMenuAvailability?.();
            window.DoorpiUiSound?.play('confirm');
            requestAnimationFrame(() => {
                prompt.querySelector('#doorpiUpdateStartBtn')?.focus();
            });
        }

        function hide(refocus = false) {
            const prompt = document.getElementById('doorpiUpdatePrompt');
            isVisible = false;
            prompt?.classList.remove('is-visible');
            document.body.classList.remove('doorpi-update-modal-open');
            window.updateDoorpiQuickMenuAvailability?.();
            if (refocus) setTimeout(() => recoverGlobalFocus?.(), 60);
        }

        function evaluate() {
            if (!hasUpdate(latestStatus)) {
                hide(false);
                return;
            }
            updateBadge();
            show(false);
        }

        function setStatus(status) {
            latestStatus = { ...(latestStatus || {}), ...(status || {}) };
            clearDismissalIfResolved(latestStatus);
            updateBadge();
            evaluate();
        }

        function injectStyles() {
            if (document.getElementById('doorpi-update-prompt-styles')) return;
            const style = document.createElement('style');
            style.id = 'doorpi-update-prompt-styles';
            style.textContent = `
                .doorpi-update-badge {
                    position: fixed;
                    top: clamp(82px, 9.6vh, 112px);
                    left: clamp(96px, 8.2vw, 150px);
                    z-index: 8001;
                    display: inline-flex;
                    align-items: center;
                    gap: 9px;
                    height: 34px;
                    padding: 0 14px;
                    border: 1px solid rgba(255,255,255,0.18);
                    border-radius: 999px;
                    background: rgba(12, 22, 38, 0.72);
                    color: rgba(255,255,255,0.88);
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    box-shadow: 0 14px 35px rgba(0,0,0,0.28);
                    backdrop-filter: blur(16px);
                    cursor: pointer;
                    opacity: 0;
                    transform: translateY(-8px);
                    pointer-events: none;
                    transition: opacity .25s ease, transform .25s ease, border-color .2s ease;
                }
                .doorpi-update-badge.is-visible {
                    opacity: 1;
                    transform: translateY(0);
                    pointer-events: auto;
                }
                .doorpi-update-badge:focus,
                .doorpi-update-badge:hover {
                    border-color: rgba(255,255,255,0.65);
                    outline: none;
                }
                .doorpi-update-badge-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #58d9ff;
                    box-shadow: 0 0 16px rgba(88,217,255,0.95);
                }
                .doorpi-update-badge.is-force .doorpi-update-badge-dot {
                    background: #ff6d6d;
                    box-shadow: 0 0 16px rgba(255,109,109,0.95);
                }
                .doorpi-update-prompt {
                    position: fixed;
                    inset: 0;
                    z-index: 30000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 42px;
                    background: rgba(1, 5, 15, 0.55);
                    backdrop-filter: blur(24px);
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity .22s ease;
                }
                .doorpi-update-prompt.is-visible {
                    opacity: 1;
                    pointer-events: auto;
                }
                .doorpi-update-shell {
                    position: relative;
                    width: min(700px, 92vw);
                    overflow: hidden;
                    padding: 34px 36px 32px;
                    border: 1px solid rgba(255,255,255,0.16);
                    border-radius: 8px;
                    background:
                        linear-gradient(90deg, rgba(255,255,255,0.30), transparent 52%) 0 0 / 100% 3px no-repeat,
                        linear-gradient(180deg, rgba(13,17,31,0.97), rgba(5,7,16,0.96));
                    box-shadow: 0 34px 90px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.07);
                    color: #fff;
                    transform: translateY(16px) scale(.985);
                    transition: transform .22s ease;
                }
                .doorpi-update-shell::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(ellipse at 80% -18%, rgba(255,255,255,0.075), transparent 38%),
                        radial-gradient(ellipse at -14% 112%, rgba(110,140,190,0.08), transparent 42%);
                    pointer-events: none;
                }
                .doorpi-update-prompt.is-visible .doorpi-update-shell {
                    transform: translateY(0) scale(1);
                }
                .doorpi-update-prompt.is-force .doorpi-update-shell {
                    border-color: rgba(255,255,255,0.24);
                    background:
                        linear-gradient(90deg, rgba(255,255,255,0.40), transparent 54%) 0 0 / 100% 3px no-repeat,
                        linear-gradient(180deg, rgba(15,19,34,0.98), rgba(5,7,16,0.97));
                }
                .doorpi-update-header {
                    position: relative;
                }
                .doorpi-update-kicker {
                    position: relative;
                    margin: 0 0 10px;
                    color: rgba(255,255,255,0.58);
                    font-size: 12px;
                    font-weight: 800;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .doorpi-update-shell h2 {
                    position: relative;
                    margin: 0;
                    font-size: clamp(28px, 3.2vw, 42px);
                    line-height: 1.05;
                    font-weight: 700;
                }
                .doorpi-update-subtitle {
                    position: relative;
                    margin: 16px 0 0;
                    max-width: 560px;
                    color: rgba(255,255,255,0.68);
                    font-size: 15px;
                    line-height: 1.42;
                }
                .doorpi-update-version-row {
                    position: relative;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin: 20px 0 0;
                }
                .doorpi-update-version-row span {
                    padding: 8px 11px;
                    border-radius: 6px;
                    border: 1px solid rgba(255,255,255,0.14);
                    background: rgba(255,255,255,0.055);
                    color: rgba(255,255,255,0.86);
                    font-size: 13px;
                }
                .doorpi-update-warning {
                    position: relative;
                    margin: 22px 0 0;
                    padding-top: 14px;
                    border-top: 1px solid rgba(255,255,255,0.12);
                    color: rgba(255,255,255,0.72);
                    font-size: 13px;
                }
                .doorpi-update-actions {
                    position: relative;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 26px;
                }
                .doorpi-update-actions button {
                    min-width: 158px;
                    height: 48px;
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.18);
                    color: #fff;
                    font-size: 15px;
                    font-weight: 800;
                    cursor: pointer;
                    outline: none;
                    transition: transform .16s ease, border-color .16s ease, background .16s ease;
                }
                .doorpi-update-primary {
                    background: rgba(255,255,255,0.92);
                    color: #090d18;
                    box-shadow: 0 14px 32px rgba(0,0,0,0.22);
                }
                .doorpi-update-secondary {
                    background: rgba(255,255,255,0.08);
                }
                .doorpi-update-actions button:focus,
                .doorpi-update-actions button:hover {
                    transform: translateY(-1px);
                    border-color: rgba(255,255,255,0.8);
                }
                .doorpi-update-actions .doorpi-update-primary,
                .doorpi-update-actions .doorpi-update-primary:focus,
                .doorpi-update-actions .doorpi-update-primary:hover,
                .doorpi-update-actions .doorpi-update-primary.nav-focused-el {
                    background: #fff;
                    color: #060914;
                    border-color: rgba(255,255,255,0.92);
                }
                .doorpi-update-actions .doorpi-update-secondary:focus,
                .doorpi-update-actions .doorpi-update-secondary:hover,
                .doorpi-update-actions .doorpi-update-secondary.nav-focused-el {
                    background: rgba(255,255,255,0.14);
                    color: #fff;
                }
                @media (max-width: 720px) {
                    .doorpi-update-prompt { padding: 18px; }
                    .doorpi-update-shell { padding: 28px; }
                    .doorpi-update-actions { flex-direction: column; }
                    .doorpi-update-actions button { width: 100%; }
                    .doorpi-update-badge {
                        top: clamp(76px, 9vh, 98px);
                        left: clamp(24px, 4vw, 60px);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        injectStyles();
        ensureBadge();

        window.isDoorpiUpdatePromptOpen = promptIsOpen;
        document.addEventListener('keydown', handlePromptKey, true);
        document.addEventListener('keyup', (e) => {
            if (!promptIsOpen()) return;
            e.preventDefault();
            e.stopImmediatePropagation();
        }, true);
        ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend'].forEach(type => {
            document.addEventListener(type, handlePromptPointer, true);
        });

        window.DoorpiUpdatePrompt = {
            setStatus,
            evaluate,
            show: () => show(true),
            hide: () => hide(true),
            refreshBadge: updateBadge
        };

        window.addEventListener('message', (event) => {
            const data = event.data;
            const type = typeof data === 'string' ? data : data?.type;
            if (type === 'doorpi:intro:complete') scheduleEvaluate(120);
        });

        window.addEventListener('focus', () => scheduleEvaluate(220));
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) scheduleEvaluate(220);
        });
    })();
    

    setInterval(() => {
        document.getElementById('clock').innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 1000);

    /* Seção: Ponte com o host */
    // ── GERADOR DE FALLBACKS SVG ──────────────────────────────────────────
    window.generateFallbackSvg = function (name, type, iconBase64 = '', forceLetter = false) {
        const initial = (name || "App").charAt(0).toUpperCase();
        const safeName = (name || "App").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const makeSvg = (svg) => "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
        const safeIcon = String(iconBase64 || '').replace(/"/g, '&quot;').trim();
        const hasIcon = safeIcon && !forceLetter;
        const genericIcon = `<g fill="none" stroke="#eef4ff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
            <rect x="150" y="210" width="300" height="300" rx="72"/>
            <path d="M210 330h180M300 270v180"/>
            <path d="M210 600h180M300 540v120"/>
        </g>`;
        const iconSvg = (w, h, mainSize, blurSize) => {
            const xMain = (w - mainSize) / 2;
            const yMain = (h - mainSize) / 2;
            const xBlur = (w - blurSize) / 2;
            const yBlur = (h - blurSize) / 2;
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
                <defs>
                    <filter id="doorpiIconBlur"><feGaussianBlur stdDeviation="${Math.round(Math.min(w, h) * 0.08)}"/></filter>
                    <radialGradient id="doorpiShade" cx="50%" cy="45%" r="75%">
                        <stop offset="0%" stop-color="#30365f"/>
                        <stop offset="100%" stop-color="#070812"/>
                    </radialGradient>
                </defs>
                <rect width="${w}" height="${h}" fill="url(#doorpiShade)"/>
                <image href="data:image/png;base64,${safeIcon}" x="${xBlur}" y="${yBlur}" width="${blurSize}" height="${blurSize}" preserveAspectRatio="xMidYMid meet" opacity="0.7" filter="url(#doorpiIconBlur)"/>
                <rect width="${w}" height="${h}" fill="#03040c" opacity="0.35"/>
                <image href="data:image/png;base64,${safeIcon}" x="${xMain}" y="${yMain}" width="${mainSize}" height="${mainSize}" preserveAspectRatio="xMidYMid meet"/>
            </svg>`;
        };
        const genericSvg = (w, h, scale = 1) => {
            const iconW = 600 * scale;
            const iconH = 900 * scale;
            const tx = (w - iconW) / 2;
            const ty = (h - iconH) / 2;
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
                <defs>
                    <radialGradient id="doorpiGenericShade" cx="50%" cy="35%" r="78%">
                        <stop offset="0%" stop-color="#30365f"/>
                        <stop offset="55%" stop-color="#11162c"/>
                        <stop offset="100%" stop-color="#070812"/>
                    </radialGradient>
                    <filter id="doorpiGenericGlow"><feGaussianBlur stdDeviation="${Math.round(Math.min(w, h) * 0.045)}"/></filter>
                </defs>
                <rect width="${w}" height="${h}" fill="url(#doorpiGenericShade)"/>
                <g transform="translate(${tx} ${ty}) scale(${scale})" opacity="0.16" filter="url(#doorpiGenericGlow)">${genericIcon}</g>
                <g transform="translate(${tx} ${ty}) scale(${scale})" opacity="0.78">${genericIcon}</g>
            </svg>`;
        };

        if (type === 'grid') {
            if (hasIcon) return makeSvg(iconSvg(600, 900, 190, 760));
            if (!forceLetter) return makeSvg(genericSvg(600, 900, 1));
            // GRID VERTICAL: Fundo Escuro + Inicial
            return makeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900"><rect width="600" height="900" fill="#1a1a2e"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="350" font-weight="bold">${initial}</text></svg>`);

        } else if (type === 'horizontal') {
            if (hasIcon) return makeSvg(iconSvg(920, 430, 150, 560));
            if (!forceLetter) return makeSvg(genericSvg(920, 430, 0.42));
            // GRID HORIZONTAL: Fundo Escuro + Inicial
            return makeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 430"><rect width="920" height="430" fill="#1a1a2e"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="200" font-weight="bold">${initial}</text></svg>`);

        } else if (type === 'logo') {
            if (hasIcon) return makeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 150"><image href="data:image/png;base64,${safeIcon}" x="0" y="18" width="112" height="112" preserveAspectRatio="xMidYMid meet"/></svg>`);
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
                const iconBase64 = item.iconBase64 || item.IconBase64 || '';

                // 1. Grid Vertical (Inicial)
                const gridKey = item.imageData !== undefined ? 'imageData' : (item.GridImage !== undefined ? 'GridImage' : null);
                if (gridKey && !item[gridKey]) item[gridKey] = window.generateFallbackSvg(name, 'grid', iconBase64);

                // 2. Grid Horizontal (Inicial)
                const horizKey = item.horizontalImage !== undefined ? 'horizontalImage' : (item.GridHorizontalImage !== undefined ? 'GridHorizontalImage' : null);
                if (horizKey && !item[horizKey]) item[horizKey] = window.generateFallbackSvg(name, 'horizontal', iconBase64);

                // 3. Logo (Nome)
                const logoKey = item.logo !== undefined ? 'logo' : (item.LogoImage !== undefined ? 'LogoImage' : null);
                if (logoKey && !item[logoKey]) item[logoKey] = window.generateFallbackSvg(name, 'logo', iconBase64);

                // 4. Banner (Transparente para o Blob)
                const bannerKey = item.hero !== undefined ? 'hero' : (item.HeroImage !== undefined ? 'HeroImage' : null);
                if (bannerKey && !item[bannerKey]) item[bannerKey] = window.generateFallbackSvg(name, 'banner');
            };

            // Substitui o bloco renderGames existente
            if (data.type === 'renderGames' && data.games) {
                window.DoorpiFirstRunTutorial?.maybeShow?.();
                data.games.forEach(applyFallbacks);

                const wasOnMedia = typeof window.getCurrentHomeTab === 'function'
                    && window.getCurrentHomeTab() === 'media';

                // Snapshot do hero atual antes do setBatch trocar tudo
                const heroSnapSrc = document.getElementById('bgBlur')?.src || '';
                const heroSnapLogo = document.getElementById('gameLogo')?.src || '';
                const heroSnapHoriz = document.getElementById('heroImage')?.src || '';

                const sessionNewCount = _countSessionNewGames(data.games || []);
                data._doorpiRenderHandled = true;
                _scheduleRenderGamesBatch({
                    games: data.games || [],
                    silent: sessionNewCount > DOORPI_BULK_LIBRARY_THRESHOLD || _libraryUpdateShouldWait(),
                    wasOnMedia,
                    heroSnapSrc,
                    heroSnapLogo,
                    heroSnapHoriz
                });

                // Se estava na mídia, devolve o hero que estava ativo
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
                _enqueueNewGameForLibrary(channel, data);
            }
            // 2. Quando o C# envia A LISTA COMPLETA de uma vez (Início do App)
            else if (data.type === 'renderGames' && !data._doorpiRenderHandled) {
                _scheduleRenderGamesBatch({
                    games: data.games || [],
                    silent: _countSessionNewGames(data.games || []) > DOORPI_BULK_LIBRARY_THRESHOLD || _libraryUpdateShouldWait()
                });
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
                const folderName = data.folderName || '';
                window.setInlineScanStatus?.(true, t('inlineScanReadingFolder', folderName));
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
                    if (_isGpuUpdaterExecutionLockOwned()) {
                        _clearExecutionOverlayCloseTimer();
                        return;
                    }
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
            else if (data.type === 'openQuickPanel') {
                if (window.isDoorpiUpdatePromptOpen?.()) return;
                window.DoorpiQuickPanel?.toggle?.();
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
                    if (typeof openSetup === 'function') openSetup();
                };
                if (window.DoorpiIntro?.isRunning?.()) window.DoorpiIntro.runAfterIntro(open);
                else open();
            }
            else if (data.type === 'profilePhotoSelected') {
                window._setupHandlePhotoSelected?.(data.base64);
            }
            else if (data.type === 'steamGridArtworkResults') {
                window._artworkWizardHandleResults?.(data);
            }
            else if (data.type === 'artworkImagePicked') {
                window._artworkWizardHandlePicked?.(data);
            }
            else if (data.type === 'artworkSelectionApplied') {
                window._artworkWizardHandleApplied?.(data);
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
                window.DoorpiFirstRunTutorial?.maybeShow?.();
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
                const hasGame = window.AppStore.queries.hasItem('games', data.gameId)
                    || window.AppStore.queries.isArtworkPending?.('games', data.gameId);
                const hasMedia = window.AppStore.queries.hasItem('media', data.gameId)
                    || window.AppStore.queries.isArtworkPending?.('media', data.gameId);

                if (hasGame) {
                    window.AppStore.mutations.patchItem('games', data.gameId, patch);
                    if (data.imageType === 'GridStatic') window._navMenuDataChanged?.('games');
                } else if (hasMedia) {
                    window.AppStore.mutations.patchItem('media', data.gameId, patch);
                    if (data.imageType === 'GridStatic') window._navMenuDataChanged?.('media');
                }
            }
            else if (data.type === 'clearMediaGrid') {
                if (window.AppStore) window.AppStore.mutations.setBatch('media', []);
                const grid = document.getElementById('mediaGrid');
                if (grid) {
                    const btnAdd = document.getElementById('btnAddMedia');
                    grid.innerHTML = '';
                    if (btnAdd) grid.appendChild(btnAdd);
                }
            }
            else if (data.type === 'currentUserUpdated') {
                const nextUserId = data.currentUserId || data.user?.Id || data.user?.id || '';
                const userChanged = !!nextUserId && String(nextUserId).toLowerCase() !== String(window._doorpiCurrentUserId || '').toLowerCase();
                if (userChanged) {
                    window.newGameIdsThisSession?.clear?.();
                    window.AppStore?.mutations?.clearNewIds?.();
                    document.querySelectorAll('.new-game').forEach(el => el.classList.remove('new-game'));
                }
                window._doorpiProfile = data.user;
                if (nextUserId) window._doorpiCurrentUserId = nextUserId;
                window._doorpiIsAdmin = !!data.isAdmin || !!(data.user?.IsAdmin || data.user?.isAdmin);
                window._adminBlockedStoreIds = new Set(data.blockedStoreIds || []);
                window._steamForceAccountSelection = !!data.steamForceAccountSelection;
                window._navMenuCurrentUserChanged?.(data.user, nextUserId, userChanged);
                if (window._pendingUserSwitchId && String(window._pendingUserSwitchId).toLowerCase() === String(nextUserId || '').toLowerCase()) {
                    closeUserPinPrompt();
                    const picker = document.getElementById('doorpiUserPicker');
                    if (picker) picker.style.display = 'none';
                    document.body.classList.remove('user-picker-open');
                    window._pendingUserSwitchId = '';
                    window.DoorpiIntro?.finishHandoff?.();
                }
                window._applyDoorpiTopProfile?.(data.user);
                window.DoorpiFirstRunTutorial?.maybeShow?.();
                if (typeof clearHero === 'function') clearHero();
            }
            else if (data.type === 'systemUpdateStatus') {
                window.DoorpiUpdatePrompt?.setStatus(data);
                window.DoorpiQuickPanel?.setDoorpiUpdateStatus?.(data);
            }
            else if (data.type === 'windowsUpdateStatus') {
                window.DoorpiQuickPanel?.setWindowsUpdateStatus?.(data);
            }
            else if (data.type === 'gpuUpdateStatus') {
                window.DoorpiQuickPanel?.setGpuUpdateStatus?.(data);
                window._navMenuSetGpuUpdateStatus?.(data);
            }
            else if (data.type === 'bluetoothStatus') {
                const changed = window.DoorpiBluetoothUI?.setStatus?.(data) !== false;
                if (changed) {
                    window.DoorpiQuickPanel?.setBluetoothStatus?.(data);
                    window._navMenuSetBluetoothStatus?.(data);
                }
            }
            else if (data.type === 'wifiStatus') {
                const changed = window.DoorpiWifiUI?.setStatus?.(data) !== false;
                if (changed) {
                    window.DoorpiQuickPanel?.setWifiStatus?.(data);
                    window._navMenuSetWifiStatus?.(data);
                }
            }
            else if (data.type === 'soundStatus') {
                const changed = window.DoorpiSoundUI?.setStatus?.(data) !== false;
                if (changed) {
                    window.DoorpiQuickPanel?.setSoundStatus?.(data);
                    window._navMenuSetSoundStatus?.(data);
                }
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
            else if (data.type === 'storeDownloadBlockedBySessions') {
                window.showStoreDownloadSessionConflict?.({
                    storeId: data.storeId || '',
                    url: data.url || '',
                    name: data.name || ''
                });
            }
            else if (data.type === 'gpuUpdaterBlockedBySessions') {
                window.showGpuUpdaterSessionConflict?.({
                    updaterId: data.updaterId || '',
                    name: data.name || ''
                });
            }
            else if (data.type === 'adminPolicyBlocked') {
                const title = data.kind === 'admin-delete'
                    ? (typeof t === 'function' ? t('adminDeleteBlockedTitle', 'Conta administradora') : 'Conta administradora')
                    : (typeof t === 'function' ? t('adminBlockedTitle', 'Bloqueado pelo administrador') : 'Bloqueado pelo administrador');
                const subtitle = data.kind === 'admin-delete'
                    ? (typeof t === 'function' ? t('adminDeleteBlockedSubtitle', 'A conta administradora não pode ser removida.') : 'A conta administradora não pode ser removida.')
                    : (typeof t === 'function' ? t('adminBlockedSubtitle', 'Esta loja foi privada para esta conta.') : 'Esta loja foi privada para esta conta.');
                window.showDoorpiToast?.(title, subtitle);
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
            else if (data.type === 'userPinRejected') {
                const shown = setUserPinError(t('pinPromptInvalid'), true);
                if (!shown) {
                    window._pendingUserSwitchId = '';
                    window.showDoorpiToast?.(t('pinPromptInvalid'), '');
                }
            }
            else if (data.type === 'userPinRecoveryRejected') {
                const shown = setUserPinRecoveryError(t(data.reason || 'pinRecoveryFailed'));
                if (!shown) {
                    window._pendingUserSwitchId = '';
                    window.showDoorpiToast?.(t(data.reason || 'pinRecoveryFailed'), '');
                }
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
            else if (data.type === 'webAppBrowserUrlCaptured') {
                const url = (data.url || '').trim();
                if (url) {
                    window._suppressNextMediaAppClosedFocus = true;
                    const input = document.getElementById('webAppUrlInput');
                    if (input) {
                        input.value = url;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(() => document.getElementById('btnAddWebApp')?.focus(), 120);
                    }
                }
            }
            else if (data.type === 'webAppBrowserCaptureCanceled') {
                window._suppressNextMediaAppClosedFocus = true;
                setTimeout(() => {
                    const target =
                        document.getElementById('btnWebAppBrowser') ||
                        document.getElementById('webAppUrlInput') ||
                        document.getElementById('btnAddWebApp');
                    target?.focus?.();
                }, 180);
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
            else if (data.type === 'gpuUpdaterRestarting') {
                window._isExternalAppRunning = true;
                window._stopSystemAudio();
                window.isMediaAppActive = true;
                GameLaunchOverlay.showGpuRestarting?.(data);
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    postToHost({ action: 'gpuUpdaterRestartNoticeRendered' });
                }));
            }
            else if (data.type === 'gpuUpdaterSessionEnded') {
                window._isExternalAppRunning = false;
                window._isDoorpiFocused = true;
                window.isMediaAppActive = false;
                window.isGameLaunchActive = false;
                GameLaunchOverlay.hide();
                window._startSystemAudio(true);
            }
            else if (data.type === 'gpuUpdaterDoorpiActivated') {
                // O clique que trouxe o Doorpi para frente deve apenas restaurar o foco.
                // Confirmacoes disparadas pela navegacao usam HTMLElement.click() e nao
                // sao eventos confiaveis, portanto continuam liberadas durante a guarda.
                window._gpuUpdaterPointerGuardUntil = Date.now() + 350;
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
                    if (data.focusActions === true) {
                        GameLaunchOverlay.focusExecutionLockActions?.();
                    }
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
                // O monitor de GPU possui o ciclo de vida deste lock. Um clear
                // generico pode chegar durante trocas de janela, mas somente o
                // evento gpuUpdaterSessionEnded deve desmontar sua interface.
                if (_isGpuUpdaterExecutionLockOwned()) return;
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
            else if (data.type === 'storeSessionReturnedToDoorpi') {
                const addModal = document.getElementById('addGameContainer');
                const modalVisible = !!(addModal && addModal.style.display !== 'none');
                if (window.isModalOpen || modalVisible) {
                    closeModal();
                }
                window.hideStoreSessionMenu?.();
                requestAnimationFrame(() => window.focusFeaturedCard?.());
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
                const hasGpuUpdaterSession = (window.DoorpiRuntimeState?.running || []).some(entry =>
                    entry?.kind === 'gpuUpdater' ||
                    entry?.appType === 'gpuUpdater' ||
                    entry?.channel === 'gpu') || _isGpuUpdaterExecutionLockOwned();
                const shouldMuteDoorpiAudio = _readDoorpiAudioMuteFlag(
                    data,
                    window.DoorpiRuntimeState.running.length > 0
                );
                window._syncSystemAudioFromRuntime(shouldMuteDoorpiAudio);
                const launchOverlay = document.getElementById('gameLaunchOverlay');
                const isExecutionLockVisible = !!(launchOverlay &&
                    launchOverlay.classList.contains('visible') &&
                    launchOverlay.classList.contains('execution-lock-visible'));
                if (!hasGpuUpdaterSession &&
                    !isExecutionLockVisible &&
                    !launchOverlay?.classList.contains('store-transition-visible')) {
                    GameLaunchOverlay.hide();
                }
                if (!hasGpuUpdaterSession && !window._vkbIsOpen && !isExecutionLockVisible) {
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
                const autoAddedGames = data.games.filter(g => g.autoAdded);
                autoAddedGames.forEach(game => {
                    const id = game.LaunchUrl || game.launchUrl || game.Path || game.path;
                    if (id) window.newGameIdsThisSession?.add(id);
                });
                if (autoAddedGames.length > 0) window._navMenuDataChanged?.('games');
            }
            else if (data.type === 'storeAutoAddSettings' && data.storeAutoAdd) {
                window._storeAutoAddSettings = data.storeAutoAdd;
            }
        } catch (e) { console.error('[bridge] Erro:', e); }
    });
    function recoverGlobalFocus() {
        const executionOverlay = document.getElementById('gameLaunchOverlay');
        if (executionOverlay?.classList.contains('visible') &&
            executionOverlay.classList.contains('execution-lock-visible')) {
            GameLaunchOverlay.focusExecutionLockActions?.();
            return;
        }
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
            window.syncFeaturedCardArt?.(grid);
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
        .doorpi-pin-panel { position: fixed; inset: 0; z-index: 10002; display: flex; align-items: center; justify-content: center; padding: clamp(40px, 6vh, 76px) clamp(24px, 5vw, 64px) clamp(260px, 34vh, 380px); box-sizing: border-box; background: rgba(5,6,12,.72); backdrop-filter: blur(34px) saturate(1.35); -webkit-backdrop-filter: blur(34px) saturate(1.35); }
        .doorpi-pin-box { width: min(520px, 92vw); display: flex; flex-direction: column; align-items: center; gap: clamp(14px, 1.8vh, 24px); color: #fff; text-align: center; animation: doorpiCardRise .26s cubic-bezier(.16,1,.3,1) backwards; }
        .doorpi-pin-identity { display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .doorpi-pin-avatar { width: clamp(92px, 8vw, 128px); height: clamp(92px, 8vw, 128px); border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.075); border: 2px solid rgba(255,255,255,.18); color: rgba(255,255,255,.72); font-size: clamp(28px, 3vw, 44px); box-shadow: 0 18px 46px rgba(0,0,0,.34); }
        .doorpi-pin-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .doorpi-pin-title { margin: 0; color: #fff; font-size: clamp(1.55rem, 2.2vw, 2.7rem); font-weight: 520; letter-spacing: 0; }
        .doorpi-pin-sub { margin: -8px 0 0; color: rgba(255,255,255,.48); font-size: clamp(.92rem, 1vw, 1.15rem); line-height: 1.35; }
        .doorpi-pin-dots { display: flex; justify-content: center; gap: clamp(16px, 2vw, 28px); margin: clamp(2px, 1vh, 12px) 0 0; min-height: clamp(48px, 4.8vw, 70px); padding: 8px 18px; border: 0; background: transparent; outline: none; }
        .doorpi-pin-dot { width: clamp(17px, 1.55vw, 27px); height: clamp(17px, 1.55vw, 27px); border-radius: 50%; border: 2px solid rgba(255,255,255,.45); background: transparent; box-shadow: 0 0 0 0 rgba(255,255,255,0); transition: background .12s, border-color .12s, transform .12s, box-shadow .12s; }
        .doorpi-pin-dot.filled { background: #fff; border-color: #fff; transform: scale(1.06); box-shadow: 0 0 24px rgba(255,255,255,.28); }
        .doorpi-pin-dots:focus .doorpi-pin-dot.focused, .doorpi-pin-dots.nav-focused-el .doorpi-pin-dot.focused { border-color: #fff; box-shadow: 0 0 0 6px rgba(255,255,255,.14), 0 0 22px rgba(255,255,255,.22); transform: scale(1.14); }
        .doorpi-pin-panel.pin-error .doorpi-pin-dot.error { animation: doorpiPinShake .28s cubic-bezier(.36,.07,.19,.97); background: rgba(255,95,95,.95); border-color: rgba(255,135,135,.98); box-shadow: 0 0 24px rgba(255,75,75,.36); }
        @keyframes doorpiPinShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-10px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(4px); } }
        .doorpi-pin-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
        .doorpi-pin-recovery-input { width: min(420px, 82vw); min-height: 52px; padding: 0 16px; border: 1px solid rgba(255,255,255,.16); border-radius: 12px; background: rgba(255,255,255,.07); color: #fff; font: inherit; text-align: center; outline: none; box-sizing: border-box; }
        .doorpi-pin-recovery-input:focus { border-color: #fff; box-shadow: 0 0 0 4px rgba(255,255,255,.14); background: rgba(255,255,255,.11); }
        .doorpi-pin-recovery-link { margin-top: -8px; border: 0; background: transparent; color: rgba(255,255,255,.54); font: inherit; font-size: clamp(.86rem, .92vw, 1rem); cursor: pointer; outline: none; text-decoration: none; }
        .doorpi-pin-recovery-link:focus, .doorpi-pin-recovery-link:hover { color: #fff; text-decoration: underline; text-underline-offset: 4px; }
        .doorpi-pin-recovery-link[hidden], .doorpi-pin-recovery-input[hidden], .doorpi-pin-dots[hidden] { display: none; }
        .doorpi-pin-error { min-height: 22px; color: rgba(255,120,120,.95); font-size: clamp(.9rem, .95vw, 1.05rem); }
        .doorpi-pin-actions { display: flex; gap: 12px; justify-content: center; margin-top: 2px; }
        .doorpi-pin-actions .doorpi-manager-btn { min-width: 104px; min-height: 42px; border-radius: 999px; background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.14); color: rgba(255,255,255,.72); padding: 10px 18px; }
        .doorpi-pin-actions .doorpi-manager-btn.primary { background: rgba(255,255,255,.92); color: #080812; }
        .doorpi-pin-actions .doorpi-manager-btn:focus, .doorpi-pin-actions .doorpi-manager-btn:hover { border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,.18); color: #fff; }
        .doorpi-pin-actions .doorpi-manager-btn.primary:focus, .doorpi-pin-actions .doorpi-manager-btn.primary:hover { color: #080812; box-shadow: 0 0 0 3px rgba(255,255,255,.22), 0 12px 30px rgba(0,0,0,.28); }

/* USER CARDS STYLES */
    .doorpi-user-picker-layout {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: clamp(24px, 3vw, 48px);
        width: 100%;
        max-width: 100vw;
    }

    .doorpi-user-scroll-area {
        /* Largura Exata: 4 cards + 3 espaços + 30px de folga (15px cada lado) */
        max-width: calc((clamp(170px, 12vw, 220px) * 4) + (clamp(24px, 3vw, 48px) * 3) + 30px);
        overflow-x: auto;
        overflow-y: hidden;
        scroll-behavior: smooth;

        /* Padding protege a animação (scale). Margin puxa o layout de volta pro lugar. */
        padding: 30px 15px;
        margin: -30px -15px;

        /* ── MÁGICA DO ALINHAMENTO PERFEITO ── */
        scroll-snap-type: x mandatory;
        /* Diz ao navegador para descontar o padding de 15px na hora de "travar" o card */
        scroll-padding-inline: 15px;

        scrollbar-width: none;
        -ms-overflow-style: none;
    }
    .doorpi-user-scroll-area::-webkit-scrollbar { display: none; }

    .doorpi-user-track {
        display: flex;
        align-items: center;
        gap: clamp(24px, 3vw, 48px);
        width: max-content;
    }

    /* Fantasma sutil para garantir que o último elemento trave corretamente sem bater na parede */
    .doorpi-user-track::after {
        content: '';
        display: block;
        padding-right: 1px;
    }

    .doorpi-user-fixed-add {
        display: flex;
        align-items: center;
        border-left: 2px solid rgba(255, 255, 255, 0.08);
        padding-left: clamp(24px, 3vw, 48px);
        z-index: 10;
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
        flex-shrink: 0;

        /* Força a lista a sempre parar alinhada no início deste card */
        scroll-snap-align: start;
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
    .doorpi-avatar img{
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .doorpi-user-card:focus .doorpi-avatar,
    .doorpi-user-card:hover .doorpi-avatar {
        border-color: #fff;
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

        const isVisible = (el) => !!(el && el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
        window.isDoorpiQuickMenuBlocked = function () {
            const body = document.body;
            const quickPanel = document.getElementById('doorpiQuickPanel');
            const quickPanelOpen = quickPanel?.classList.contains('visible') && isVisible(quickPanel);
            if (quickPanelOpen) return false;

            if (window.isDoorpiSessionTransitionActive?.() || window.DoorpiIntro?.isRunning?.()) return true;
            if (window.isNavMenuOpen || body.classList.contains('nav-menu-active')) return true;
            if (window.isModalOpen || window.isSetupOpen || window._vkbIsOpen || window.isGlobalLoading) return true;
            if (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) return true;
            if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) return true;
            if (window.isStoreSessionMenuOpen?.() || window.isGameFocusFallbackPopupOpen?.()) return true;

            const blockingSelectors = [
                '#addGameContainer',
                '#sessionConflictOverlay.visible',
                '#gameFocusFallbackOverlay.visible',
                '#doorpiUserSwitchLogout.visible',
                '#gameLaunchOverlay.visible',
                '#gameLaunchOverlay.execution-lock-visible',
                '.doorpi-update-prompt.is-visible',
                '.doorpi-pin-panel',
                '.edit-modal-overlay',
                '#globalLoadingOverlay'
            ];
            if (blockingSelectors.some(selector => Array.from(document.querySelectorAll(selector)).some(isVisible))) return true;

            return Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
                .some(el => el.id !== 'doorpiQuickPanel' && isVisible(el));
        };

        let quickMenuVisibilityRaf = 0;
        window.updateDoorpiQuickMenuAvailability = function () {
            if (quickMenuVisibilityRaf) return;
            quickMenuVisibilityRaf = requestAnimationFrame(() => {
                quickMenuVisibilityRaf = 0;
                document.body.classList.toggle('quick-menu-unavailable', !!window.isDoorpiQuickMenuBlocked?.());
            });
        };
        new MutationObserver(() => window.updateDoorpiQuickMenuAvailability?.())
            .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
        document.addEventListener('focusin', () => window.updateDoorpiQuickMenuAvailability?.());
        window.updateDoorpiQuickMenuAvailability();
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

    function closeUserPinPrompt() {
        window._vkbForceClose?.();
        const prompt = document.getElementById('doorpiUserPinPrompt');
        prompt?._doorpiCleanup?.();
        prompt?.remove();
    }

    function updateUserPinDots(prompt, value, markError = false) {
        const len = String(value || '').length;
        const focusIdx = Math.min(3, len);
        prompt?.querySelectorAll('.doorpi-pin-dot').forEach((dot, idx) => {
            dot.classList.toggle('filled', idx < len);
            dot.classList.toggle('focused', idx === focusIdx);
            dot.classList.toggle('error', !!markError && idx < Math.max(1, len));
        });
    }

    function setUserPinError(message, countAttempt = false) {
        const prompt = document.getElementById('doorpiUserPinPrompt');
        if (!prompt) return false;
        prompt.dataset.submitting = 'false';
        prompt.classList.remove('pin-error');
        void prompt.offsetWidth;
        prompt.classList.add('pin-error');
        window._pendingUserSwitchId = '';
        let shouldRevealRecovery = false;
        if (countAttempt) {
            const attempts = Number(prompt.dataset.failedAttempts || '0') + 1;
            prompt.dataset.failedAttempts = String(attempts);
            const recoveryBtn = prompt.querySelector('#doorpiUserPinRecovery');
            if (recoveryBtn && attempts >= 3) recoveryBtn.hidden = false;
            shouldRevealRecovery = attempts === 3 && !!recoveryBtn;
        }
        const error = prompt.querySelector('#doorpiUserPinError');
        const input = prompt.querySelector('#doorpiUserPinInput');
        if (error) error.textContent = message || '';
        if (input) {
            const failedPin = String(input.value || '').replace(/\D/g, '').slice(0, 4);
            updateUserPinDots(prompt, failedPin, true);
            input.value = '';
            if (shouldRevealRecovery) {
                window._vkbForceClose?.();
                setTimeout(() => prompt.querySelector('#doorpiUserPinRecovery')?.focus(), 380);
            } else {
                setTimeout(() => {
                    input.focus();
                    window._vkbOpen?.(input, input._doorpiPinCallbacks || { mode: 'numeric' });
                }, window._vkbIsOpen ? 0 : 380);
            }
        }
        setTimeout(() => {
            prompt.classList.remove('pin-error');
            updateUserPinDots(prompt, '');
        }, 360);
        return true;
    }

    function setUserPinRecoveryError(message) {
        const prompt = document.getElementById('doorpiUserPinPrompt');
        if (!prompt) return false;
        prompt.dataset.submitting = 'false';
        window._pendingUserSwitchId = '';
        const error = prompt.querySelector('#doorpiUserPinError');
        if (error) error.textContent = message || t('pinRecoveryFailed');
        const focused = prompt.querySelector('.doorpi-pin-recovery-input:not([hidden]), #doorpiUserPinDots:not([hidden])');
        setTimeout(() => focused?.focus?.(), 80);
        return true;
    }

    function showUserPinPrompt(user) {
        closeUserPinPrompt();
        const prompt = document.createElement('div');
        prompt.id = 'doorpiUserPinPrompt';
        prompt.className = 'doorpi-pin-panel';
        prompt.dataset.mode = 'pin';
        prompt.dataset.failedAttempts = '0';
        const fallbackPinAvatar = `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8.2" r="3.6" stroke="currentColor" stroke-width="1.8"/>
                <path d="M5.8 19.2c1-3.2 3.2-5 6.2-5s5.2 1.8 6.2 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>`;
        const pinAvatar = user.PhotoBase64
            ? `<img src="data:image/png;base64,${user.PhotoBase64}" />`
            : fallbackPinAvatar;
        prompt.innerHTML = `
            <div class="doorpi-pin-box">
                <div class="doorpi-pin-identity">
                    <div class="doorpi-pin-avatar">${pinAvatar}</div>
                    <h3 class="doorpi-pin-title">${escapeHtml(user.Name || '')}</h3>
                    <p class="doorpi-pin-sub">${t('pinPromptTitle')}</p>
                </div>
                <button class="doorpi-pin-dots" id="doorpiUserPinDots" type="button" tabindex="0" aria-label="${escapeHtml(t('pinPromptTitle'))}">
                    <span class="doorpi-pin-dot"></span>
                    <span class="doorpi-pin-dot"></span>
                    <span class="doorpi-pin-dot"></span>
                    <span class="doorpi-pin-dot"></span>
                </button>
                <input class="doorpi-pin-input" id="doorpiUserPinInput" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" readonly tabindex="0" />
                <input class="doorpi-pin-recovery-input" id="doorpiPinRecoveryNameInput" type="text" readonly tabindex="0" hidden />
                <button class="doorpi-pin-recovery-link" id="doorpiUserPinRecovery" tabindex="0" hidden>${t('pinRecoveryForgot')}</button>
                <div class="doorpi-pin-error" id="doorpiUserPinError"></div>
                <div class="doorpi-pin-actions">
                    <button class="doorpi-manager-btn" id="doorpiUserPinCancel" tabindex="0">${t('vkbCancel')}</button>
                    <button class="doorpi-manager-btn primary" id="doorpiUserPinOk" tabindex="0">${t('vkbOk')}</button>
                </div>
            </div>`;
        document.body.appendChild(prompt);

        const input = prompt.querySelector('#doorpiUserPinInput');
        const dotsBtn = prompt.querySelector('#doorpiUserPinDots');
        const recoveryInput = prompt.querySelector('#doorpiPinRecoveryNameInput');
        const recoveryBtn = prompt.querySelector('#doorpiUserPinRecovery');
        const subtitle = prompt.querySelector('.doorpi-pin-sub');
        const errorEl = prompt.querySelector('#doorpiUserPinError');
        const actions = prompt.querySelector('.doorpi-pin-actions');
        const placeRecoveryHelpAboveInput = () => {
            if (errorEl && recoveryInput?.parentNode) recoveryInput.parentNode.insertBefore(errorEl, recoveryInput);
        };
        const placeRecoveryHelpDefault = () => {
            if (errorEl && actions?.parentNode) actions.parentNode.insertBefore(errorEl, actions);
        };
        let recoveryUserName = '';

        const pinDigits = () => String(input.value || '').replace(/\D/g, '').slice(0, 4);
        const setError = (message) => {
            if (errorEl) errorEl.textContent = message || '';
        };
        const bindActions = (secondaryText, secondaryAction, primaryText, primaryAction) => {
            actions.innerHTML = `
                <button class="doorpi-manager-btn" id="doorpiPinSecondary" tabindex="0">${secondaryText}</button>
                <button class="doorpi-manager-btn primary" id="doorpiPinPrimary" tabindex="0">${primaryText}</button>
            `;
            actions.querySelector('#doorpiPinSecondary')?.addEventListener('click', secondaryAction);
            actions.querySelector('#doorpiPinPrimary')?.addEventListener('click', primaryAction);
        };
        const submit = () => {
            if (prompt.dataset.mode !== 'pin') return;
            if (prompt.dataset.submitting === 'true') return;
            const pin = pinDigits();
            if (pin.length < 4) {
                setUserPinError(t('pinPromptEmpty'));
                return;
            }
            prompt.dataset.submitting = 'true';
            window._pendingUserSwitchId = user.Id;
            input._doorpiVkbReturnFocus = null;
            window._vkbForceClose?.();
            postToHost({ action: 'selectUser', userId: user.Id, pin });
        };
        const cancel = () => {
            closeUserPinPrompt();
            Array.from(document.querySelectorAll('.doorpi-user-card[data-user-id]'))
                .find(card => String(card.dataset.userId) === String(user.Id))
                ?.focus();
        };

        const showPinEntry = () => {
            prompt.dataset.mode = 'pin';
            prompt.dataset.submitting = 'false';
            placeRecoveryHelpDefault();
            subtitle.textContent = t('pinPromptTitle');
            setError('');
            input.value = '';
            recoveryInput.hidden = true;
            recoveryInput.value = '';
            dotsBtn.hidden = false;
            recoveryBtn.hidden = Number(prompt.dataset.failedAttempts || '0') < 3;
            bindActions(t('vkbCancel'), cancel, t('vkbOk'), submit);
            updateUserPinDots(prompt, '');
            dotsBtn.focus();
        };

        const showRecoveryNewPin = () => {
            prompt.dataset.mode = 'recoveryPin';
            prompt.dataset.submitting = 'false';
            placeRecoveryHelpDefault();
            subtitle.textContent = t('pinRecoveryNewPinTitle');
            setError(t('pinRecoveryNewPinHint'));
            input.value = '';
            recoveryInput.hidden = true;
            dotsBtn.hidden = false;
            recoveryBtn.hidden = true;
            bindActions(t('vkbCancel'), cancel, t('pinRecoverySave'), submitRecoveryPin);
            updateUserPinDots(prompt, '');
            setTimeout(() => openPinKeyboard(), 80);
        };

        const submitRecoveryName = () => {
            const typedName = recoveryInput.value || '';
            if (typedName !== (user.Name || '')) {
                setError(t('pinRecoveryNameMismatch'));
                recoveryInput.focus();
                return;
            }
            recoveryUserName = typedName;
            window._vkbForceClose?.();
            showRecoveryNewPin();
        };

        const showRecoveryName = () => {
            prompt.dataset.mode = 'recoveryName';
            prompt.dataset.submitting = 'false';
            placeRecoveryHelpAboveInput();
            subtitle.textContent = t('pinRecoveryNameTitle');
            setError(t('pinRecoveryNameHint'));
            input.value = '';
            recoveryInput.value = '';
            recoveryInput.placeholder = t('pinRecoveryNamePlaceholder');
            recoveryInput.hidden = false;
            recoveryBtn.hidden = true;
            dotsBtn.hidden = true;
            bindActions(t('vkbCancel'), cancel, t('vkbOk'), submitRecoveryName);
            recoveryInput._doorpiVkbReturnFocus = null;
            recoveryInput._doorpiRecoveryCallbacks = {
                placement: 'below',
                keepOpenOnEnter: true,
                onEnter: submitRecoveryName,
                onOk: submitRecoveryName,
                onCancel: cancel
            };
            recoveryInput._doorpiVkbCallbacks = recoveryInput._doorpiRecoveryCallbacks;
            setTimeout(() => {
                recoveryInput.removeAttribute('readonly');
                recoveryInput.focus();
                window._vkbOpen?.(recoveryInput, recoveryInput._doorpiRecoveryCallbacks);
            }, 80);
        };

        function submitRecoveryPin() {
            if (prompt.dataset.mode !== 'recoveryPin') return;
            if (prompt.dataset.submitting === 'true') return;
            const pin = pinDigits();
            if (pin.length < 4) {
                setError(t('pinRecoveryPinTooShort'));
                setTimeout(() => openPinKeyboard(), 120);
                return;
            }
            prompt.dataset.submitting = 'true';
            window._pendingUserSwitchId = user.Id;
            window._vkbForceClose?.();
            postToHost({ action: 'recoverUserPin', userId: user.Id, userName: recoveryUserName, pin });
        }

        const showRecoveryConfirm = () => {
            prompt.dataset.mode = 'recoveryConfirm';
            prompt.dataset.submitting = 'false';
            placeRecoveryHelpDefault();
            window._vkbForceClose?.();
            subtitle.textContent = t('pinRecoveryConfirmTitle');
            setError(t('pinRecoveryConfirmBody'));
            input.value = '';
            recoveryInput.hidden = true;
            recoveryBtn.hidden = true;
            dotsBtn.hidden = true;
            bindActions(t('vkbCancel'), showPinEntry, t('pinRecoveryConfirmYes'), showRecoveryName);
            actions.querySelector('#doorpiPinPrimary')?.focus();
        };

        input._doorpiPinCallbacks = {
            mode: 'numeric',
            onOk: () => prompt.dataset.mode === 'recoveryPin' ? submitRecoveryPin() : submit(),
            onCancel: cancel
        };
        const openPinKeyboard = (event) => {
            if (event && !window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            if (prompt.dataset.submitting === 'true') return;
            if (prompt.dataset.mode !== 'pin' && prompt.dataset.mode !== 'recoveryPin') return;
            input.focus();
            input._doorpiVkbReturnFocus = dotsBtn;
            window._vkbOpen?.(input, input._doorpiPinCallbacks);
        };
        bindActions(t('vkbCancel'), cancel, t('vkbOk'), submit);
        recoveryBtn?.addEventListener('click', showRecoveryConfirm);
        recoveryInput?.addEventListener('click', event => {
            if (event && !window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            if (prompt.dataset.mode !== 'recoveryName') return;
            recoveryInput.removeAttribute('readonly');
            recoveryInput.focus();
            window._vkbOpen?.(recoveryInput, recoveryInput._doorpiRecoveryCallbacks);
        });
        dotsBtn?.addEventListener('click', openPinKeyboard);
        dotsBtn?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openPinKeyboard();
            }
        });
        input.addEventListener('input', () => {
            const digits = String(input.value || '').replace(/\D/g, '').slice(0, 4);
            if (input.value !== digits) input.value = digits;
            updateUserPinDots(prompt, digits);
            if (digits.length === 4) {
                if (prompt.dataset.mode === 'recoveryPin') submitRecoveryPin();
                else submit();
            }
        });
        recoveryInput.addEventListener('input', () => setError(''));
        recoveryInput.addEventListener('keydown', (e) => {
            if (prompt.dataset.mode !== 'recoveryName') return;
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                submitRecoveryName();
            }
        });
        const recoveryVkbEnterHandler = (event) => {
            const enterKey = event.target?.closest?.('.vkb-key[data-key="ENTER"]');
            if (!enterKey || !prompt.isConnected || prompt.dataset.mode !== 'recoveryName') return;
            event.preventDefault();
            event.stopPropagation();
            submitRecoveryName();
        };
        document.addEventListener('click', recoveryVkbEnterHandler, true);
        const previousVkbEnterConfirm = window._doorpiVkbShouldConfirmEnter;
        const previousVkbConfirmOverride = window._doorpiVkbConfirmOverride;
        window._doorpiVkbShouldConfirmEnter = () => prompt.isConnected && prompt.dataset.mode === 'recoveryName';
        window._doorpiVkbConfirmOverride = () => {
            if (!prompt.isConnected || prompt.dataset.mode !== 'recoveryName') return false;
            submitRecoveryName();
            return true;
        };
        prompt._doorpiCleanup = () => {
            document.removeEventListener('click', recoveryVkbEnterHandler, true);
            window._doorpiVkbShouldConfirmEnter = previousVkbEnterConfirm;
            window._doorpiVkbConfirmOverride = previousVkbConfirmOverride;
        };
        updateUserPinDots(prompt, '');
        prompt.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Backspace') {
                e.preventDefault();
                if (prompt.dataset.mode === 'pin') cancel();
                else showPinEntry();
            }
        }, true);

        requestAnimationFrame(() => {
            openPinKeyboard();
        });
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

        // Controle de navegação forçado (Fase de Captura)
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

                    if (isPowerBtn && backBtn) {
                        backBtn.focus();
                        return;
                    }

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
                        // nearest faz rolar apenas o necessário para mostrar o card
                        bestCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
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
                            userCards[prevIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                        } else {
                            const nextIndex = currentIndex < userCards.length - 1 ? currentIndex + 1 : 0;
                            userCards[nextIndex].focus();
                            userCards[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                        }
                    }
                }
            }
        }, true);

        document.body.appendChild(overlay);
    }

    overlay.dataset.required = requireSelection ? 'true' : 'false';
    overlay.dataset.returnToQuickPanel = (window._doorpiUserPickerReturnToQuickPanel && !requireSelection) ? 'true' : 'false';
    window._doorpiUserPickerReturnToQuickPanel = false;

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
                
                <div class="doorpi-user-picker-layout">
                    <div class="doorpi-user-scroll-area">
                        <div class="doorpi-user-track">
                            ${cards}
                        </div>
                    </div>
                    <div class="doorpi-user-fixed-add">
                        <button class="doorpi-user-card create-card" id="doorpiCreateUserCard" tabindex="0" style="animation-delay: ${createUserDelay}s">
                            <div class="doorpi-avatar"><div class="doorpi-create-user-icon">+</div></div>
                            <span class="doorpi-user-name">${t('newUser')}</span>
                        </button>
                    </div>
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
    document.body.classList.add('user-picker-open');

    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();

    const hidePicker = () => {
        overlay.style.display = 'none';
        document.body.classList.remove('user-picker-open');
        window.DoorpiIntro?.finishHandoff?.();
        if (overlay.dataset.returnToQuickPanel === 'true' && overlay.dataset.required !== 'true') {
            overlay.dataset.returnToQuickPanel = 'false';
            window.DoorpiQuickPanel?.openMenu?.();
        }
    };

    overlay.querySelectorAll('[data-user-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const user = users.find(u => String(u.Id) === String(btn.dataset.userId));
            if (user?.HasPin || user?.hasPin) {
                showUserPinPrompt(user);
                return;
            }
            window._pendingUserSwitchId = btn.dataset.userId;
            postToHost({ action: 'selectUser', userId: btn.dataset.userId });
        });
        // Quando a navegação for feita pelo ponteiro (mouse/toque)
        btn.addEventListener('focus', () => {
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        });
    });

    overlay.querySelector('#doorpiCreateUserCard')?.addEventListener('click', () => {
        hidePicker();
        openCreateUserDialog();
    });

    overlay.querySelector('#doorpiCloseUsers')?.addEventListener('click', hidePicker);
    window._doorpiCloseUserPicker = function () {
        if (overlay.dataset.required === 'true') return false;
        hidePicker();
        return true;
    };

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

    window.DoorpiQuickPanel = (() => {
        let doorpiStatus = null;
        let windowsStatus = null;
        let gpuStatus = null;
        let bluetoothStatus = null;
        let wifiStatus = null;
        let soundStatus = null;
        let section = null;
        let updateView = 'hub';
        let connectivityView = 'hub';
        let depth = 'menu';
        let bluetoothPatchTimer = 0;

        function ensureStyles() {
            if (document.getElementById('doorpiQuickPanelStyles')) return;
            const s = document.createElement('style');
            s.id = 'doorpiQuickPanelStyles';
            s.textContent = `
                .doorpi-quick-panel {
                    position: fixed;
                    inset: 0;
                    z-index: 16000;
                    display: none;
                    align-items: stretch;
                    justify-content: flex-start;
                    background: linear-gradient(90deg, rgba(2,3,9,.96) 0%, rgba(2,3,9,.88) 36%, rgba(2,3,9,.62) 100%);
                    backdrop-filter: blur(22px) brightness(.78);
                    -webkit-backdrop-filter: blur(22px) brightness(.78);
                    color: #fff;
                    font-family: inherit;
                    padding: 0;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                .doorpi-quick-panel *, .doorpi-quick-panel *::before, .doorpi-quick-panel *::after { box-sizing: border-box; }
                .doorpi-quick-panel.visible { display: flex; }
                .doorpi-quick-panel.has-opened .dq-sidebar {
                    animation: none;
                }
                .doorpi-quick-panel.is-menu-only {
                    background: transparent;
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                    pointer-events: none;
                }
                .dq-sidebar {
                    width: clamp(300px, 24vw, 380px);
                    flex: 0 0 clamp(300px, 24vw, 380px);
                    max-width: 42vw;
                    min-width: 0;
                    padding: clamp(34px, 4.5vh, 58px) clamp(24px, 2vw, 34px);
                    border-right: 1px solid rgba(255,255,255,.09);
                background: #060710;
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
                    box-shadow: 24px 0 80px rgba(0,0,0,.28);
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                    transform-origin: left center;
                    animation: dqSidebarIn .22s cubic-bezier(.2, .9, .2, 1) both;
                    pointer-events: auto;
                }
                @keyframes dqSidebarIn {
                    from { opacity: 0; transform: translateX(-24px) scaleX(.92); }
                    to { opacity: 1; transform: translateX(0) scaleX(1); }
                }
                .dq-brand { min-height:42px; margin-bottom:10px; }
                .dq-title { font-size: clamp(1.18rem, 1.45vw, 1.65rem); font-weight: 500; letter-spacing: 0; }
                .dq-menu { display:flex; flex-direction:column; gap:10px; margin-top:10px; }
                .dq-sidebar-bottom { margin-top: auto; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.06); }
                .dq-menu-btn {
                    min-height: 64px;
                    border: 1px solid transparent;
                    border-radius: 8px;
                    background: transparent;
                    color: rgba(255,255,255,.72);
                    font: inherit;
                    text-align: left;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 14px;
                    padding: 0 16px;
                    outline: none;
                    cursor: pointer;
                }
                .dq-menu-btn.active { background: rgba(255,255,255,.08); color:#fff; border-color: rgba(255,255,255,.12); }
                .dq-menu-btn.nav-focused-el, .dq-menu-btn:focus {
                    background: rgba(255,255,255,.16);
                    border-color: rgba(255,255,255,.7);
                    box-shadow: 0 0 0 2px rgba(255,255,255,.14), 0 12px 28px rgba(0,0,0,.32);
                }
                .dq-menu-label { display:flex; align-items:center; gap:14px; min-width:0; font-size:1.02rem; font-weight:560; }
                .dq-menu-ico { width:28px; height:28px; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,.84); flex:0 0 auto; }
                .dq-menu-ico svg { width:26px; height:26px; stroke-width:1.85; }
                .dq-dot { width:8px; height:8px; border-radius:50%; background:#7dcbff; box-shadow:0 0 16px rgba(125,203,255,.75); }
                .dq-content {
                    flex: 1;
                    min-width: 0;
                    max-width: calc(100vw - clamp(300px, 24vw, 380px));
                    padding: clamp(42px, 5vh, 72px) clamp(38px, 4.5vw, 86px);
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                    overflow-x: hidden;
                    overflow-y: auto;
                    scrollbar-width: none;
                    animation: dqContentIn .22s ease both;
                }
                .dq-content::-webkit-scrollbar { display:none; }
                @keyframes dqContentIn { from { opacity:.35; transform:translateX(-10px); } to { opacity:1; transform:none; } }
                .dq-kicker { color:rgba(255,255,255,.42); font-size:.78rem; font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
                .dq-heading { margin:0; font-size:clamp(2.2rem, 3.25vw, 4rem); line-height:1.02; font-weight:340; letter-spacing:0; }
                .dq-sub { margin:0; max-width:720px; color:rgba(255,255,255,.60); line-height:1.48; font-size:clamp(.96rem, 1vw, 1.12rem); }
                .dq-grid { display:grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap:16px; width:100%; max-width:980px; margin-top:12px; }
                .dq-grid.connectivity-grid {
                    grid-template-columns: minmax(0, 360px);
                    width: min(100%, 380px);
                    max-width: 380px;
                    justify-content: start;
                }
                .dq-card, .dq-action {
                    border:1px solid rgba(255,255,255,.10);
                    border-radius:8px;
                    background:rgba(255,255,255,.045);
                    color:#fff;
                    font:inherit;
                    text-align:left;
                    outline:none;
                    cursor:pointer;
                    transition:transform .18s, background .18s, border-color .18s, box-shadow .18s;
                }
                .dq-card { min-height:178px; padding:22px; display:flex; flex-direction:column-reverse; justify-content:space-between; gap:22px; }
                .dq-grid.connectivity-grid .dq-card {
                    flex-direction: column;
                    justify-content: flex-start;
                    min-height: 150px;
                }
                .dq-action { min-height:60px; padding:0 18px; display:flex; align-items:center; justify-content:space-between; gap:14px; }
                .dq-card.nav-focused-el, .dq-action.nav-focused-el, .dq-card:focus, .dq-action:focus {
                    transform:translateY(-2px);
                    background:rgba(255,255,255,.12);
                    border-color:rgba(255,255,255,.72);
                    box-shadow:0 0 0 2px rgba(255,255,255,.15), 0 18px 42px rgba(0,0,0,.38);
                }
                .dq-card h3 { margin:0; font-size:1.22rem; font-weight:650; line-height:1.2; }
                .dq-card p { margin:7px 0 0; color:rgba(255,255,255,.58); line-height:1.38; max-width:32ch; }
                .dq-pill { display:inline-flex; align-self:flex-start; padding:4px 9px; border-radius:999px; background:rgba(125,203,255,.12); color:#9dd8ff; font-size:.68rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
                .dq-pill.warn { background:rgba(255,205,90,.13); color:#ffd872; }
                .dq-pill.err { background:rgba(255,90,90,.13); color:#ff9696; }
                .dq-panel { width:100%; max-width:880px; border:1px solid rgba(255,255,255,.10); border-radius:8px; background:rgba(255,255,255,.04); padding:20px; }
                .dq-tabs { display:flex; gap:8px; margin:4px 0 2px; }
                .dq-tab { min-width:132px; min-height:42px; border-radius:8px; border:1px solid rgba(255,255,255,.10); background:rgba(255,255,255,.035); color:rgba(255,255,255,.74); font:inherit; outline:none; cursor:pointer; }
                .dq-tab.active { color:#fff; background:rgba(125,203,255,.10); border-color:rgba(125,203,255,.36); }
                .dq-tab.nav-focused-el, .dq-tab:focus { border-color:#fff; background:rgba(255,255,255,.15); box-shadow:0 0 0 2px rgba(255,255,255,.16); }
                .dq-meta { display:flex; flex-wrap:wrap; gap:10px 18px; color:rgba(255,255,255,.55); font-size:.9rem; margin-top:10px; }
                .dq-list { display:grid; gap:8px; margin-top:12px; }
                .dq-update-row { display:flex; justify-content:space-between; gap:14px; padding:9px 0; border-top:1px solid rgba(255,255,255,.07); color:rgba(255,255,255,.72); }
                .dq-update-progress { display:grid; gap:7px; padding:10px 0; border-top:1px solid rgba(255,255,255,.07); }
                .dq-update-progress-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; color:rgba(255,255,255,.74); }
                .dq-update-progress-title { min-width:0; line-height:1.35; }
                .dq-update-progress-state { flex:0 0 auto; color:rgba(255,255,255,.52); font-size:.82rem; }
                .dq-update-progress-state.restart { color:#ffd872; }
                .dq-progress-track { height:4px; overflow:hidden; border-radius:2px; background:rgba(255,255,255,.10); }
                .dq-progress-fill { height:100%; width:var(--progress); background:#7dcbff; transition:width .18s linear; }
                .dq-actions { display:grid; grid-template-columns: repeat(2, minmax(210px, 1fr)); gap:12px; width:100%; max-width:740px; margin-top:6px; }
                .dq-power-list { display: flex; flex-direction: column; gap: 12px; width:100%; max-width: 540px; margin-top: 12px; }
                .dq-power-list .dq-action { width: 100%; justify-content: flex-start; gap: 18px; min-height: 64px; font-size: 1.05rem; }
                .dq-power-list .dq-action-ico { color: rgba(255,255,255,0.4); transition: color 0.18s; }
                .dq-power-list .dq-action:focus .dq-action-ico, .dq-power-list .dq-action:hover .dq-action-ico { color: #fff; }
                .dq-power-list .dq-action.danger .dq-action-ico { color: #ff9696; }
                .dq-actions.windows-update-actions {
                    grid-template-areas:
                        "verify install"
                        "manual restart";
                    align-items: stretch;
                }
                .dq-action.verify { grid-area: verify; }
                .dq-action.manual { grid-area: manual; }
                .dq-action.install { grid-area: install; }
                .dq-action.restart { grid-area: restart; }
                .dq-action-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .dq-action-ico { width:22px; height:22px; flex:0 0 auto; display:flex; align-items:center; justify-content:center; }
                .dq-action-ico svg { width:22px; height:22px; stroke-width:1.9; }
                .dq-spin { animation: dqSpin .9s linear infinite; }
                @keyframes dqSpin { to { transform: rotate(360deg); } }
                .dq-action.primary { background:rgba(255,255,255,.88); color:#090914; }
                .dq-action.danger { border-color:rgba(255,120,120,.28); color:#ffc4c4; }
                .dq-action.compact { min-height:48px; font-size:.92rem; }
                .dq-action[disabled] { opacity:.38; cursor:default; pointer-events:none; }
                .dq-action[data-busy="true"] { opacity:.72; cursor:default; }
                .dq-app-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; width:100%; max-width:980px; margin-top:4px; }
                .dq-app-card {
                    min-height:248px;
                    border:1px solid rgba(255,255,255,.10);
                    border-radius:12px;
                    background:
                        radial-gradient(circle at 50% 0%, rgba(255,255,255,.12), transparent 42%),
                        linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.035));
                    color:#fff;
                    outline:none;
                    cursor:pointer;
                    padding:16px 16px 18px;
                    display:flex;
                    flex-direction:column;
                    justify-content:flex-start;
                    gap:16px;
                    text-align:left;
                    transition:transform .18s, background .18s, border-color .18s, box-shadow .18s;
                    overflow:hidden;
                }
                .dq-app-card.nav-focused-el, .dq-app-card:focus {
                    transform:translateY(-2px);
                    background:rgba(255,255,255,.12);
                    border-color:rgba(255,255,255,.72);
                    box-shadow:0 0 0 2px rgba(255,255,255,.15), 0 18px 42px rgba(0,0,0,.38);
                }
                .dq-app-art {
                    min-height:132px;
                    border-radius:10px;
                    background:
                        radial-gradient(circle at 50% 18%, rgba(255,255,255,.24), transparent 32%),
                        radial-gradient(circle at 20% 10%, rgba(125,203,255,.28), transparent 36%),
                        linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03));
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    overflow:hidden;
                    box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 18px 28px rgba(0,0,0,.16);
                }
                .dq-app-art img { width:min(72%, 108px); height:min(72%, 108px); object-fit:contain; filter:drop-shadow(0 14px 28px rgba(0,0,0,.34)); }
                .dq-app-cover { width:100%; height:100%; background-size:contain; background-repeat:no-repeat; background-position:center; filter:drop-shadow(0 14px 24px rgba(90,180,255,.18)); transform:scale(1.03); }
                .dq-app-fallback { width:58px; height:58px; border-radius:16px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.14); font-weight:800; letter-spacing:.04em; }
                .dq-app-copy { display:grid; gap:6px; align-content:start; }
                .dq-app-name { font-size:1rem; font-weight:650; line-height:1.24; overflow:hidden; }
                .dq-app-meta { color:rgba(255,255,255,.58); font-size:.78rem; line-height:1.38; }
                .dq-app-add { border-style:dashed; }
                .dq-app-add .dq-app-art { background:none; box-shadow:none; min-height:132px; }
                .dq-app-add .dq-app-fallback { width:62px; height:62px; background:#fff; color:#0d1018; box-shadow:0 12px 28px rgba(255,255,255,.18); }
                .dq-gpu-guidance { max-width:880px; display:grid; gap:8px; padding-left:14px; border-left:2px solid rgba(125,203,255,.48); }
                .dq-gpu-guidance p { margin:0; color:rgba(255,255,255,.56); font-size:.86rem; line-height:1.42; }
                .dq-gpu-guidance strong { color:rgba(255,255,255,.84); font-weight:650; }
                .dq-windows-guidance { max-width:880px; padding-left:14px; border-left:2px solid rgba(125,203,255,.48); }
                .dq-windows-guidance p { margin:0; color:rgba(255,255,255,.58); font-size:.86rem; line-height:1.42; }
                .dq-windows-guidance strong { color:rgba(255,255,255,.86); font-weight:650; }
                @media (min-width: 3000px) and (min-height: 1600px) {
                    .dq-sidebar { width:480px; padding:64px 44px; gap:24px; }
                    .dq-brand { min-height:52px; margin-bottom:14px; }
                    .dq-menu { gap:14px; margin-top:14px; }
                    .dq-menu-btn { min-height:80px; padding:0 22px; }
                    .dq-menu-label { gap:18px; }
                    .dq-menu-ico { width:34px; height:34px; }
                    .dq-menu-ico svg { width:32px; height:32px; }
                    .dq-content { padding:90px 120px; gap:24px; }
                    .dq-sub { max-width:900px; }
                    .dq-grid { grid-template-columns:repeat(3,minmax(320px,1fr)); gap:22px; max-width:1240px; }
                    .dq-card { min-height:224px; padding:28px; gap:28px; }
                    .dq-action, .dq-power-list .dq-action { min-height:80px; padding:0 24px; font-size:1.2rem; }
                    .dq-panel, .dq-app-grid, .dq-gpu-guidance, .dq-windows-guidance { max-width:1100px; }
                    .dq-actions { max-width:920px; gap:16px; }
                    .dq-app-grid { grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:18px; }
                    .dq-app-card { min-height:288px; padding:22px; }
                    .dq-app-art { min-height:156px; }
                    .dq-tab { min-width:165px; min-height:52px; }
                }
                @media (max-width: 900px) {
                    .dq-sidebar { width: 230px; flex-basis:230px; padding-inline:18px; }
                    .dq-content { max-width:calc(100vw - 230px); padding-inline:26px; }
                    .dq-grid, .dq-actions { grid-template-columns:1fr; }
                    .dq-actions.windows-update-actions { grid-template-areas: none; }
                    .dq-action.verify, .dq-action.manual, .dq-action.install, .dq-action.restart { grid-area: auto; }
                }
                @media (max-width: 1366px), (max-height: 780px) {
                    .dq-sidebar { width:260px; flex-basis:260px; padding:28px 18px; gap:12px; }
                    .dq-brand { min-height:34px; margin-bottom:4px; }
                    .dq-title { font-size:1.08rem; }
                    .dq-menu { gap:7px; margin-top:4px; }
                    .dq-menu-btn { min-height:52px; padding:0 12px; }
                    .dq-menu-label { gap:10px; font-size:.9rem; }
                    .dq-menu-ico, .dq-menu-ico svg { width:22px; height:22px; }
                    .dq-content { max-width:calc(100vw - 260px); padding:28px; gap:12px; }
                    .dq-heading { font-size:clamp(1.65rem, 3.2vw, 2.35rem); }
                    .dq-sub { font-size:.88rem; line-height:1.38; }
                    .dq-grid { grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; }
                    .dq-card { min-height:132px; padding:16px; gap:14px; }
                    .dq-card h3 { font-size:1rem; }
                    .dq-card p { font-size:.78rem; line-height:1.3; }
                    .dq-panel { padding:14px; }
                    .dq-actions { grid-template-columns:repeat(2,minmax(170px,1fr)); gap:10px; }
                    .dq-action, .dq-power-list .dq-action { min-height:50px; font-size:.9rem; }
                    .dq-app-grid { grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; }
                    .dq-app-card { min-height:198px; padding:12px; gap:12px; }
                    .dq-app-art { min-height:96px; }
                }
            `;
            document.head.appendChild(s);
        }

        function esc(value) {
            return typeof escapeHtml === 'function'
                ? escapeHtml(String(value ?? ''))
                : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        }

        function canOpen() {
            if (window.isDoorpiUpdatePromptOpen?.()) return false;
            if (window.isDoorpiQuickMenuBlocked?.()) return false;
            if (window.isDoorpiSessionTransitionActive?.()) return false;
            if (window.isNavMenuOpen || window.isModalOpen || window.isSetupOpen || window._vkbIsOpen) return false;
            if (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) return false;
            if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) return false;
            const launchOverlay = document.getElementById('gameLaunchOverlay');
            if (launchOverlay?.classList.contains('visible')) return false;
            return true;
        }

        function ensure() {
            ensureStyles();
            let overlay = document.getElementById('doorpiQuickPanel');
            if (overlay) return overlay;
            overlay = document.createElement('div');
            overlay.id = 'doorpiQuickPanel';
            overlay.className = 'doorpi-quick-panel doorpi-manager-overlay';
            overlay.dataset.required = 'false';
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close();
            });
            document.body.appendChild(overlay);
            return overlay;
        }

        function statusPill(kind, status) {
            if (kind === 'gpu') {
                const adapters = Array.isArray(status?.adapters) ? status.adapters : [];
                const updaters = Array.isArray(status?.updaters) ? status.updaters : [];
                if (status?.status === 'error') return `<span class="dq-pill err">${t('quickError')}</span>`;
                if (!adapters.length) return `<span class="dq-pill warn">${t('quickNoGpu')}</span>`;
                if (!updaters.length) return `<span class="dq-pill warn">${t('quickNoApp')}</span>`;
                return `<span class="dq-pill">${t('quickDetected')}</span>`;
            }
            if (kind === 'doorpi') {
                const available = !!(status?.doorpiUpdateAvailable || status?.updaterUpdateAvailable);
                if (available) return `<span class="dq-pill warn">${t('quickAvailable')}</span>`;
                if (status?.status === 'error') return `<span class="dq-pill err">${t('quickError')}</span>`;
                if (status?.status === 'checking') return `<span class="dq-pill">${t('quickChecking')}</span>`;
                return `<span class="dq-pill">${t('quickUpdated')}</span>`;
            }
            const updates = Array.isArray(status?.updates) ? status.updates : [];
            if (status?.rebootRequired) return `<span class="dq-pill warn">${t('quickRestart')}</span>`;
            if (status?.status === 'error') return `<span class="dq-pill err">${t('quickError')}</span>`;
            if (status?.status === 'checking' || status?.status === 'downloading' || status?.status === 'installing') return `<span class="dq-pill">${t('quickProcessing')}</span>`;
            if (updates.length) return `<span class="dq-pill warn">${t('quickAvailable')}</span>`;
            return `<span class="dq-pill">${t('quickUpdated')}</span>`;
        }

        function dateText(value) {
            if (!value) return t('never');
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return t('never');
            return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }) + ' ' +
                d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        }

        function sizeText(bytes) {
            const value = Number(bytes || 0);
            if (!Number.isFinite(value) || value <= 0) return '';
            if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
            if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(0)} MB`;
            return `${Math.max(1, Math.round(value / 1024))} KB`;
        }

        function windowsActionLabel(status) {
            if (status === 'installing') return t('windowsUpdateInstalling');
            if (status === 'downloading') return t('windowsUpdateDownloading');
            if (status === 'checking') return t('windowsUpdateChecking');
            return t('checkWindows');
        }

        function windowsPackageState(item) {
            if (item?.rebootRequired || item?.status === 'reboot-required')
                return { text: t('windowsUpdateRebootPending'), cls: 'restart' };
            const keys = {
                pending: 'windowsUpdatePending',
                downloading: 'windowsUpdateDownloading',
                downloaded: 'windowsUpdateDownloaded',
                installing: 'windowsUpdateInstalling',
                installed: 'windowsUpdateInstalled',
                error: 'windowsUpdatePackageError'
            };
            return { text: t(keys[item?.status] || 'windowsUpdatePending'), cls: '' };
        }

        function windowsUpdateRows(status, updates) {
            const progress = Array.isArray(status?.packageProgress) ? status.packageProgress : [];
            if (!progress.length) {
                return updates.length
                    ? updates.map(update => `<div class="dq-update-row"><span>${esc(update.title || t('quickWindowsUpdateName'))}</span><span>${esc(sizeText(update.sizeBytes))}</span></div>`).join('')
                    : `<div class="dq-update-row"><span>${t('windowsUpdateNoneListed')}</span></div>`;
            }

            const updatesById = new Map(updates.map(update => [String(update.updateId || '').toLowerCase(), update]));
            return progress.map(item => {
                const update = updatesById.get(String(item.updateId || '').toLowerCase());
                const state = windowsPackageState(item);
                const percent = Math.max(0, Math.min(100, Number(item.percent) || 0));
                const detail = [state.text, `${Math.round(percent)}%`, sizeText(update?.sizeBytes)].filter(Boolean).join(' - ');
                return `<div class="dq-update-progress">
                    <div class="dq-update-progress-head"><span class="dq-update-progress-title">${esc(item.title || update?.title || t('quickWindowsUpdateName'))}</span><span class="dq-update-progress-state ${state.cls}">${esc(detail)}</span></div>
                    <div class="dq-progress-track"><div class="dq-progress-fill" style="--progress:${percent}%"></div></div>
                </div>`;
            }).join('');
        }

        function iconSvg(id, cls = '') {
            const icons = {
                updates: '<path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18.5 2.8v3h-3"/><path d="M5.5 21.2v-3h3"/>',
                connectivity: '<path d="M12 2v20l6-6-6-4 6-4-6-6Z"/><path d="M6.5 6.5 12 12l-5.5 5.5"/>',
                sound: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>',
                users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.85"/><path d="M16 3.15a4 4 0 0 1 0 7.7"/>',
                power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
                settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
                arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
                refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18.5 2.8v3h-3"/>',
                external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
                sleep: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5 7 7 0 0 0 20.5 14.5Z"/>',
                shutdown: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
                close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
                desktop: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'
            };
            return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id] || icons.arrowRight}</svg>`;
        }

        function sidebar() {
            const hasDoorpiUpdate = !!(doorpiStatus?.doorpiUpdateAvailable || doorpiStatus?.updaterUpdateAvailable);
            const hasWindowsUpdate = !!windowsStatus?.rebootRequired || ((windowsStatus?.updates || []).length > 0);
            const updateDot = hasDoorpiUpdate || hasWindowsUpdate ? '<span class="dq-dot"></span>' : '';
            const items = [
                ['updates', t('updatesTitle'), updateDot],
                ['sound', t('soundTitle'), ''],
                ['connectivity', t('navSetConnectivity'), ''],
                ['settings', t('navSettings'), '']
            ];
            return `
                <aside class="dq-sidebar">
                    <div class="dq-brand" aria-hidden="true"></div>
                    <div class="dq-menu">
                        ${items.map(([id, label, badge]) => `
                            <button class="dq-menu-btn ${section === id ? 'active' : ''}" data-section="${id}" tabindex="0">
                                <span class="dq-menu-label">
                                    <span class="dq-menu-ico">${iconSvg(id)}</span>
                                    <span>${label}</span>
                                </span>
                                ${badge}
                            </button>
                        `).join('')}
                    </div>
                    <div class="dq-menu dq-sidebar-bottom">
                        <button class="dq-menu-btn ${section === 'power' ? 'active' : ''}" data-section="power" tabindex="0">
                            <span class="dq-menu-label">
                                <span class="dq-menu-ico">${iconSvg('power')}</span>
                                <span>${t('quickPower', 'Energia')}</span>
                            </span>
                        </button>
                    </div>
                </aside>
            `;
        }

        function updatesHub() {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('quickPanel')}</div>
                    <h1 class="dq-heading">${t('updatesTitle')}</h1>
                    <p class="dq-sub">${t('quickUpdatesDesc')}</p>
                    <div class="dq-grid">
                        <button class="dq-card" data-update-view="doorpi" tabindex="0">
                            ${statusPill('doorpi', doorpiStatus)}
                            <div><h3>Doorpi</h3><p>${t('quickDoorpiDesc')}</p></div>
                        </button>
                        <button class="dq-card" data-update-view="windows" tabindex="0">
                            ${statusPill('windows', windowsStatus)}
                            <div><h3>Windows</h3><p>${t('quickWindowsDesc')}</p></div>
                        </button>
                        <button class="dq-card" data-update-view="gpu" tabindex="0">
                            ${statusPill('gpu', gpuStatus)}
                            <div><h3>${t('videoCardTitle')}</h3><p>${t('quickGpuDesc')}</p></div>
                        </button>
                    </div>
                </section>
            `;
        }

        function doorpiDetail() {
            const s = doorpiStatus || {};
            const hasUpdate = !!(s.doorpiUpdateAvailable || s.updaterUpdateAvailable);
            const active = s.status === 'checking' || s.status === 'downloading' || s.status === 'installing';
            const changelog = Array.isArray(s.changelog) && s.changelog[0]?.items
                ? s.changelog[0].items.slice(0, 4)
                : [];
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('updatesTitle')}</div>
                    <h1 class="dq-heading">Doorpi</h1>
                    <p class="dq-sub">${esc(s.message || t('sysUpdateIdle'))}</p>
                    <div class="dq-tabs">
                        <button class="dq-tab active" data-update-view="doorpi" tabindex="0">Doorpi</button>
                        <button class="dq-tab" data-update-view="windows" tabindex="0">Windows</button>
                        <button class="dq-tab" data-update-view="gpu" tabindex="0">${t('videoCardTitle')}</button>
                    </div>
                    <div class="dq-panel">
                        ${statusPill('doorpi', s)}
                        <div class="dq-meta">
                            <span>Doorpi ${esc(s.localDoorpiVersion || '--')}${s.remoteDoorpiVersion ? ' -> ' + esc(s.remoteDoorpiVersion) : ''}</span>
                            <span>Updater ${esc(s.localUpdaterVersion || '--')}${s.remoteUpdaterVersion ? ' -> ' + esc(s.remoteUpdaterVersion) : ''}</span>
                            <span>${t('windowsUpdateLastCheck', dateText(s.lastCheckedAt))}</span>
                        </div>
                        <div class="dq-list">
                            ${changelog.length ? changelog.map(item => `<div class="dq-update-row"><span>${esc(item)}</span></div>`).join('') : `<div class="dq-update-row"><span>${t('quickNoReleaseNotes')}</span></div>`}
                        </div>
                    </div>
                    <div class="dq-actions">
                        <button class="dq-action" data-action="check-doorpi" tabindex="0" ${active ? 'data-busy="true"' : ''}><span class="dq-action-label">${active ? t('quickChecking') : t('checkDoorpi')}</span><span class="dq-action-ico">${iconSvg('refresh', active ? 'dq-spin' : '')}</span></button>
                        <button class="dq-action primary" data-action="install-doorpi" tabindex="0" ${(hasUpdate && !active) ? '' : 'disabled'}><span class="dq-action-label">${t('updateDoorpi')}</span><span class="dq-action-ico">${iconSvg('arrowRight')}</span></button>
                    </div>
                </section>
            `;
        }

        function windowsDetail() {
            const s = windowsStatus || {};
            const updates = Array.isArray(s.updates) ? s.updates : [];
            const packageProgress = Array.isArray(s.packageProgress) ? s.packageProgress : [];
            const active = s.status === 'checking' || s.status === 'downloading' || s.status === 'installing';
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('updatesTitle')}</div>
                    <h1 class="dq-heading">Windows</h1>
                    <p class="dq-sub">${esc(s.message || t('windowsUpdateIdle'))}</p>
                    <div class="dq-tabs">
                        <button class="dq-tab" data-update-view="doorpi" tabindex="0">Doorpi</button>
                        <button class="dq-tab active" data-update-view="windows" tabindex="0">Windows</button>
                        <button class="dq-tab" data-update-view="gpu" tabindex="0">${t('videoCardTitle')}</button>
                    </div>
                    <div class="dq-panel">
                        ${statusPill('windows', s)}
                        <div class="dq-meta">
                            <span>${t('windowsUpdatePackages', packageProgress.length || updates.length)}</span>
                            ${active ? `<span>${t('windowsUpdateOverall', Math.max(0, Math.min(100, Number(s.overallPercent) || 0)))}</span>` : ''}
                            <span>${t('windowsUpdateLastCheck', dateText(s.lastCheckedAt))}</span>
                        </div>
                        <div class="dq-list">
                            ${windowsUpdateRows(s, updates)}
                        </div>
                    </div>
                    <div class="dq-windows-guidance">
                        <p><strong>${esc(t('windowsUpdateAdminNoticeTitle'))}</strong> ${esc(t('windowsUpdateAdminNoticeText'))}</p>
                    </div>
                    <div class="dq-actions windows-update-actions">
                        <button class="dq-action verify" data-action="check-windows" tabindex="0" ${active ? 'data-busy="true"' : ''}><span class="dq-action-label">${esc(windowsActionLabel(s.status))}</span><span class="dq-action-ico">${iconSvg('refresh', active ? 'dq-spin' : '')}</span></button>
                        <button class="dq-action manual" data-action="open-windows-update" tabindex="0"><span class="dq-action-label">${t('quickOpenWindowsUpdate')}</span><span class="dq-action-ico">${iconSvg('external')}</span></button>
                        <button class="dq-action primary install" data-action="install-windows" tabindex="0" ${(updates.length && !s.rebootRequired && !active) ? '' : 'disabled'}><span class="dq-action-label">${t('windowsUpdateInstall')}</span><span class="dq-action-ico">${iconSvg('arrowRight')}</span></button>
                        <button class="dq-action primary restart" data-action="restart" tabindex="0" ${s.rebootRequired ? '' : 'disabled'}><span class="dq-action-label">${t('restartNow')}</span><span class="dq-action-ico">${iconSvg('shutdown')}</span></button>
                    </div>
                </section>
            `;
        }

        function vendorName(vendor) {
            const v = String(vendor || '').toLowerCase();
            if (v === 'nvidia') return 'NVIDIA';
            if (v === 'amd') return 'AMD';
            if (v === 'intel') return 'Intel';
            return vendor || 'GPU';
        }

        function updaterInitials(app) {
            const base = vendorName(readGpuProp(app, 'vendor')) || readGpuProp(app, 'name') || 'APP';
            return String(base).replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'APP';
        }

        function readGpuProp(obj, key) {
            if (!obj) return '';
            const pascal = key.charAt(0).toUpperCase() + key.slice(1);
            return obj[key] ?? obj[pascal] ?? '';
        }

        function gpuDetail() {
            const s = gpuStatus || {};
            const adapters = Array.isArray(s.adapters) ? s.adapters : [];
            const updaters = Array.isArray(s.updaters) ? s.updaters : [];
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('updatesTitle')}</div>
                    <h1 class="dq-heading">${t('videoCardTitle')}</h1>
                    <p class="dq-sub">${esc(s.message || t('quickGpuIdle'))}</p>
                    <div class="dq-tabs">
                        <button class="dq-tab" data-update-view="doorpi" tabindex="0">Doorpi</button>
                        <button class="dq-tab" data-update-view="windows" tabindex="0">Windows</button>
                        <button class="dq-tab active" data-update-view="gpu" tabindex="0">${t('videoCardTitle')}</button>
                    </div>
                    <div class="dq-panel">
                        ${statusPill('gpu', s)}
                        <div class="dq-meta">
                            <span>${t('quickGpuAdapters', adapters.length)}</span>
                            <span>${t('quickGpuApps', updaters.length)}</span>
                            <span>${t('quickLastReading', dateText(s.lastCheckedAt))}</span>
                        </div>
                        <div class="dq-list">
                            ${adapters.length ? adapters.map(adapter => `
                                <div class="dq-update-row">
                                    <span>${esc(readGpuProp(adapter, 'name') || vendorName(readGpuProp(adapter, 'vendor')))}</span>
                                    <span>${esc([vendorName(readGpuProp(adapter, 'vendor')), readGpuProp(adapter, 'driverVersion') || '--'].filter(Boolean).join(' - '))}</span>
                                </div>
                            `).join('') : `<div class="dq-update-row"><span>${t('quickNoVideoDriver')}</span></div>`}
                        </div>
                    </div>
                    <div class="dq-gpu-guidance">
                        <p><strong>${esc(t('gpuUpdaterAdminNoticeTitle'))}</strong> ${esc(t('gpuUpdaterAdminNoticeText'))}</p>
                        <p><strong>${esc(t('gpuUpdaterSessionNoticeTitle'))}</strong> ${esc(t('gpuUpdaterSessionNoticeText'))}</p>
                    </div>
                    <div class="dq-app-grid">
                        ${updaters.map(app => {
                            const id = readGpuProp(app, 'id');
                            const name = readGpuProp(app, 'name') || t('quickUpdater');
                            const vendor = readGpuProp(app, 'vendor');
                            const source = readGpuProp(app, 'source');
                            const imageUrl = readGpuProp(app, 'imageUrl');
                            const iconDataUrl = readGpuProp(app, 'iconDataUrl');
                            return `
                            <div class="dq-app-card" data-action="open-gpu-updater" data-updater-id="${esc(id)}" data-gpu-updater-card="true" tabindex="0" role="button">
                                <div class="dq-app-art">
                                    ${imageUrl ? `<div class="dq-app-cover" style="background-image:url('${esc(imageUrl)}')"></div>` : (iconDataUrl ? `<img src="${esc(iconDataUrl)}" alt="">` : `<div class="dq-app-fallback">${esc(updaterInitials(app))}</div>`)}
                                </div>
                                <div class="dq-app-copy">
                                    <div class="dq-app-name">${esc(name)}</div>
                                    <div class="dq-app-meta">${esc(vendorName(vendor))} · ${esc(source === 'manual' ? t('quickAddedManually') : t('quickDetectedAutomatically'))}</div>
                                </div>
                            </div>
                        `}).join('')}
                        <div class="dq-app-card dq-app-add" data-action="add-gpu-updater" tabindex="0" role="button">
                            <div class="dq-app-art"><div class="dq-app-fallback">+</div></div>
                            <div class="dq-app-copy">
                                <div class="dq-app-name">${t('quickAddApp')}</div>
                                <div class="dq-app-meta">${t('quickAddUpdaterDesc')}</div>
                            </div>
                        </div>
                    </div>
                </section>
            `;
        }

        function powerContent() {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('quickSystem')}</div>
                    <h1 class="dq-heading">${t('quickPower', 'Energia')}</h1>
                    <p class="dq-sub">${t('quickPowerExpandedDesc', 'Opções de energia, perfis e sistema.')}</p>
                    <div class="dq-power-list">
                        <button class="dq-action" data-action="open-users" tabindex="0">
                            <span class="dq-action-ico">${iconSvg('users')}</span>
                            <span class="dq-action-label">${t('navChangeUser', 'Trocar Usuário')}</span>
                        </button>
                        <button class="dq-action" data-action="enter-desktop" tabindex="0">
                            <span class="dq-action-ico">${iconSvg('desktop')}</span>
                            <span class="dq-action-label">${t('sysActionDesktopTitle', 'Acessar Área de Trabalho')}</span>
                        </button>
                        <button class="dq-action" data-action="exit" tabindex="0">
                            <span class="dq-action-ico">${iconSvg('close')}</span>
                            <span class="dq-action-label">${t('quickExitDoorpi', 'Sair do Doorpi')}</span>
                        </button>
                        <button class="dq-action" data-action="suspend" tabindex="0">
                            <span class="dq-action-ico">${iconSvg('sleep')}</span>
                            <span class="dq-action-label">${t('powerSuspend', 'Suspender Sistema')}</span>
                        </button>
                        <button class="dq-action" data-action="restart" tabindex="0">
                            <span class="dq-action-ico">${iconSvg('refresh')}</span>
                            <span class="dq-action-label">${t('powerRestart', 'Reiniciar Sistema')}</span>
                        </button>
                        <button class="dq-action danger" data-action="shutdown" tabindex="0">
                            <span class="dq-action-ico">${iconSvg('shutdown')}</span>
                            <span class="dq-action-label">${t('powerShutdown', 'Desligar Sistema')}</span>
                        </button>
                    </div>
                </section>
            `;
        }

        function bluetoothContent() {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('bluetoothQuickKicker')}</div>
                    <h1 class="dq-heading">Bluetooth</h1>
                    <p class="dq-sub">${t('bluetoothQuickDesc')}</p>
                    ${window.DoorpiBluetoothUI?.render?.('quick') || ''}
                </section>
            `;
        }

        function wifiContent() {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('connectivityQuickKicker')}</div>
                    <h1 class="dq-heading">Wi-Fi</h1>
                    <p class="dq-sub">${t('wifiQuickDesc')}</p>
                    ${window.DoorpiWifiUI?.render?.('quick') || ''}
                </section>
            `;
        }

        function soundContent() {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('quickPanel')}</div>
                    <h1 class="dq-heading">${t('soundTitle')}</h1>
                    <p class="dq-sub">${t('soundQuickDesc')}</p>
                    ${window.DoorpiSoundUI?.render?.('quick') || ''}
                </section>
            `;
        }

        function connectivityHub() {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('quickPanel')}</div>
                    <h1 class="dq-heading">${t('navSetConnectivity')}</h1>
                    <p class="dq-sub">${t('quickConnectivityDesc')}</p>
                    <div class="dq-grid connectivity-grid">
                        <button class="dq-card" data-connectivity-view="bluetooth" tabindex="0"><div><h3>Bluetooth</h3><p>${t('bluetoothSettingsDesc')}</p></div></button>
                    </div>
                </section>`;
        }

        function simpleContent(title, sub, actionLabel, action) {
            return `
                <section class="dq-content">
                    <div class="dq-kicker">${t('quickPanel')}</div>
                    <h1 class="dq-heading">${title}</h1>
                    <p class="dq-sub">${sub}</p>
                    <div class="dq-actions">
                        <button class="dq-action primary" data-action="${action}" tabindex="0"><span class="dq-action-label">${actionLabel}</span><span class="dq-action-ico">${iconSvg('arrowRight')}</span></button>
                    </div>
                </section>
            `;
        }

        function content() {
            if (!section) return '';
            if (section === 'updates') {
                if (updateView === 'doorpi') return doorpiDetail();
                if (updateView === 'windows') return windowsDetail();
                if (updateView === 'gpu') return gpuDetail();
                return updatesHub();
            }
            if (section === 'users') return simpleContent(t('navChangeUser'), t('quickSwitchUserDesc'), t('navChangeUser'), 'open-users');
            if (section === 'sound') return soundContent();
            if (section === 'connectivity') {
                if (connectivityView === 'bluetooth') return bluetoothContent();
                if (connectivityView === 'wifi') return wifiContent();
                return connectivityHub();
            }
            if (section === 'power') return powerContent();
            return simpleContent(t('navSettings'), t('quickSettingsDesc'), t('quickOpenSettings'), 'open-settings');
        }

        function contentFocusFor(sectionId) {
            if (!sectionId) return '.dq-menu-btn';
            if (sectionId === 'updates') {
                if (updateView === 'doorpi' || updateView === 'windows' || updateView === 'gpu') return `[data-update-view="${updateView}"]`;
                return '.dq-card';
            }
            if (sectionId === 'power') return '.dq-action';
            if (sectionId === 'sound') return '.sound-focus';
            if (sectionId === 'connectivity') {
                if (connectivityView === 'bluetooth') return '.bluetooth-focus';
                if (connectivityView === 'wifi') return '.wifi-focus';
                return '.dq-card';
            }
            return `.dq-menu-btn[data-section="${sectionId}"]`;
        }

        function currentFocusSelector() {
            const el = document.activeElement;
            if (!el?.closest?.('#doorpiQuickPanel')) return null;
            if (el.dataset?.action) return `[data-action="${el.dataset.action}"]`;
            if (el.dataset?.updateView) return `[data-update-view="${el.dataset.updateView}"]`;
            if (el.dataset?.section) return `.dq-menu-btn[data-section="${el.dataset.section}"]`;
            if (el.dataset?.connectivityView) return `[data-connectivity-view="${el.dataset.connectivityView}"]`;
            if (el.dataset?.wifiNetworkId) return `[data-wifi-network-id="${CSS.escape(el.dataset.wifiNetworkId)}"]`;
            if (el.dataset?.wifiAction) return `[data-wifi-action="${el.dataset.wifiAction}"]`;
            if (el.dataset?.soundAction) return `[data-sound-action="${CSS.escape(el.dataset.soundAction)}"]`;
            if (el.dataset?.soundVolumeControl) return `[data-sound-volume-control="${CSS.escape(el.dataset.soundVolumeControl)}"]`;
            if (el.dataset?.soundDeviceOption) return `[data-sound-device-option="${CSS.escape(el.dataset.soundDeviceOption)}"]`;
            if (el.dataset?.soundItem) return `[data-sound-item="${CSS.escape(el.dataset.soundItem)}"]`;
            if (el.dataset?.soundSlider) return `[data-sound-slider="${CSS.escape(el.dataset.soundSlider)}"]`;
            if (el.dataset?.btMenuId) return `[data-bt-menu-id="${CSS.escape(el.dataset.btMenuId)}"]`;
            if (el.dataset?.deviceId) return `[data-device-id="${CSS.escape(el.dataset.deviceId)}"]`;
            if (el.dataset?.btAction) return `[data-bt-action="${el.dataset.btAction}"]`;
            if (el.classList.contains('dq-card')) return '.dq-card';
            if (el.classList.contains('dq-action')) return '.dq-action';
            if (el.classList.contains('dq-app-card')) return '.dq-app-card';
            return null;
        }

        function openNavSettings() {
            close();
            if (typeof window._navMenuOpenSettings === 'function') window._navMenuOpenSettings();
            else window.openNavMenu?.(2);
        }

        function enterSection(sectionId = section) {
            const sameSection = section === sectionId;
            if (section === 'connectivity' && sectionId !== 'connectivity' && bluetoothStatus?.discovering)
                postToHost?.({ action: 'stopBluetoothDiscovery' });
            if (section === 'sound' && sectionId !== 'sound') window.DoorpiSoundUI?.closeDrawer?.('quick');
            section = sectionId || 'updates';
            if (section === 'users') {
                window._doorpiUserPickerReturnToQuickPanel = true;
                close();
                postToHost?.({ action: 'requestUsers' });
                return;
            }
            if (section === 'settings') {
                openNavSettings();
                return;
            }
            if (section === 'connectivity' && !sameSection) connectivityView = 'hub';
            if (section === 'updates' && !sameSection) updateView = 'hub';
            if (section === 'sound') postToHost?.({ action: 'requestSoundStatus' });
            depth = 'content';
            if (sameSection && depth === 'content') {
                const target = document.getElementById('doorpiQuickPanel')?.querySelector(contentFocusFor(section));
                if (target) {
                    target.focus();
                    return;
                }
            }
            render(contentFocusFor(section));
        }

        function render(focusSelector) {
            const overlay = ensure();
            overlay.classList.toggle('is-menu-only', !section);
            overlay.innerHTML = `${sidebar()}${content()}`;
            wire(overlay);
            const sidebarEl = overlay.querySelector('.dq-sidebar');
            if (sidebarEl && overlay.style.display !== 'none' && overlay.classList.contains('visible') && !overlay.classList.contains('has-opened')) {
                sidebarEl.addEventListener('animationend', () => overlay.classList.add('has-opened'), { once: true });
            }
            const target = focusSelector ? overlay.querySelector(focusSelector) : overlay.querySelector('.dq-menu-btn.active, button');
            requestAnimationFrame(() => {
                const executionLockOpen = document.getElementById('gameLaunchOverlay')
                    ?.classList.contains('execution-lock-visible');
                if (!window.isSessionConflictPopupOpen?.() && !executionLockOpen) target?.focus();
            });
        }

        function wireBluetooth(root) {
            if (section !== 'connectivity' || connectivityView !== 'bluetooth') return;
            window.DoorpiBluetoothUI?.bind?.(root, 'quick', focusSelector => render(focusSelector));
        }

        function wireWifi(root) {
            if (section !== 'connectivity' || connectivityView !== 'wifi') return;
            window.DoorpiWifiUI?.bind?.(root, 'quick', focusSelector => render(focusSelector));
        }

        function wireSound(root) {
            if (section !== 'sound') return;
            window.DoorpiSoundUI?.bind?.(root, 'quick', focusSelector => render(focusSelector));
        }

        function patchBluetoothContent() {
            const overlay = document.getElementById('doorpiQuickPanel');
            const current = overlay?.querySelector('.dq-content');
            if (!current || section !== 'connectivity' || connectivityView !== 'bluetooth') return;
            const focusSelector = currentFocusSelector();
            const template = document.createElement('template');
            template.innerHTML = bluetoothContent().trim();
            const next = template.content.firstElementChild;
            current.replaceWith(next);
            wireBluetooth(next);
            requestAnimationFrame(() => {
                const target = (focusSelector && next.querySelector(focusSelector)) || next.querySelector('.bluetooth-focus');
                target?.focus();
            });
        }

        function scheduleBluetoothContentPatch(immediate = false) {
            if (bluetoothPatchTimer) {
                clearTimeout(bluetoothPatchTimer);
                bluetoothPatchTimer = 0;
            }
            if (immediate) {
                patchBluetoothContent();
                return;
            }
            bluetoothPatchTimer = setTimeout(() => {
                bluetoothPatchTimer = 0;
                patchBluetoothContent();
            }, 120);
        }

        function patchWifiContent() {
            const overlay = document.getElementById('doorpiQuickPanel');
            const current = overlay?.querySelector('.dq-content');
            if (!current || section !== 'connectivity' || connectivityView !== 'wifi') return;
            const focusSelector = currentFocusSelector();
            const template = document.createElement('template');
            template.innerHTML = wifiContent().trim();
            const next = template.content.firstElementChild;
            current.replaceWith(next);
            wireWifi(next);
            requestAnimationFrame(() => {
                const target = (focusSelector && next.querySelector(focusSelector)) || next.querySelector('.wifi-focus');
                target?.focus();
            });
        }

        function patchSoundContent() {
            const overlay = document.getElementById('doorpiQuickPanel');
            const current = overlay?.querySelector('.dq-content');
            if (!current || section !== 'sound') return;
            const focusSelector = currentFocusSelector();
            const template = document.createElement('template');
            template.innerHTML = soundContent().trim();
            const next = template.content.firstElementChild;
            current.replaceWith(next);
            wireSound(next);
            requestAnimationFrame(() => {
                const target = (focusSelector && next.querySelector(focusSelector)) || next.querySelector('.sound-focus');
                target?.focus();
            });
        }

        function setBusyAction(btn, message) {
            btn.dataset.busy = 'true';
            const label = btn.querySelector('.dq-action-label');
            const icon = btn.querySelector('.dq-action-ico');
            if (label) label.textContent = t('quickChecking');
            if (icon) icon.innerHTML = iconSvg('refresh', 'dq-spin');
            const sub = document.getElementById('doorpiQuickPanel')?.querySelector('.dq-sub');
            if (sub && message) sub.textContent = message;
            btn.focus();
        }

        function patchCheckingStatus(kind, status) {
            if (status?.status !== 'checking') return false;
            if (section !== 'updates' || updateView !== kind) return false;
            const action = kind === 'windows' ? 'check-windows' : 'check-doorpi';
            const btn = document.getElementById('doorpiQuickPanel')?.querySelector(`[data-action="${action}"]`);
            if (!btn) return false;
            const fallback = kind === 'windows'
                ? t('quickCheckingWindows')
                : t('quickCheckingDoorpi');
            setBusyAction(btn, status.message || fallback);
            return true;
        }

        function hasContentTargetToLeft(active) {
            const contentEl = active?.closest?.('#doorpiQuickPanel .dq-content');
            if (!contentEl) return false;
            const ar = active.getBoundingClientRect();
            const activeCenterY = ar.top + ar.height / 2;
            return Array.from(contentEl.querySelectorAll('button, input, select, [tabindex="0"]'))
                .filter(el => el !== active && !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0)
                .some(el => {
                    const r = el.getBoundingClientRect();
                    const centerX = r.left + r.width / 2;
                    const centerY = r.top + r.height / 2;
                    const verticalOverlap = Math.abs(centerY - activeCenterY) <= Math.max(ar.height, r.height) * 0.9;
                    return centerX < ar.left && verticalOverlap;
                });
        }

        function getQuickPanelContentItems() {
            const contentEl = document.querySelector('#doorpiQuickPanel .dq-content');
            if (!contentEl) return [];
            return Array.from(contentEl.querySelectorAll('button, input, select, [tabindex="0"]'))
                .filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);
        }

        function findContentTargetToRight(active, items) {
            if (!active || !items.length) return null;
            const activeRect = active.getBoundingClientRect();
            const activeCenterX = activeRect.left + activeRect.width / 2;
            const activeCenterY = activeRect.top + activeRect.height / 2;
            let best = null;
            let bestScore = Number.POSITIVE_INFINITY;

            items.forEach(item => {
                if (item === active) return;
                const rect = item.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                if (centerX <= activeCenterX) return;
                const verticalOverlap = Math.min(activeRect.bottom, rect.bottom) - Math.max(activeRect.top, rect.top);
                if (verticalOverlap <= -10) return;
                const score = (centerX - activeCenterX) + Math.abs(centerY - activeCenterY) * 0.25;
                if (score < bestScore) {
                    best = item;
                    bestScore = score;
                }
            });

            return best;
        }

        function wire(overlay) {
            wireBluetooth(overlay.querySelector('.dq-content'));
            wireWifi(overlay.querySelector('.dq-content'));
            wireSound(overlay.querySelector('.dq-content'));
            overlay.querySelectorAll('[data-section]').forEach(btn => {
                btn.addEventListener('click', () => {
                    enterSection(btn.dataset.section || 'updates');
                });
            });
            overlay.querySelectorAll('[data-update-view]').forEach(btn => {
                btn.addEventListener('click', () => {
                    section = 'updates';
                    depth = 'content';
                    const nextView = btn.dataset.updateView || 'hub';
                    if (updateView === nextView) {
                        btn.focus();
                        return;
                    }
                    updateView = nextView;
                    render(`[data-update-view="${updateView}"]`);
                });
            });
            overlay.querySelectorAll('[data-connectivity-view]').forEach(btn => {
                btn.addEventListener('click', () => {
                    connectivityView = btn.dataset.connectivityView || 'hub';
                    depth = 'content';
                    if (connectivityView === 'bluetooth') postToHost?.({ action: 'requestBluetoothStatus' });
                    if (connectivityView === 'wifi') postToHost?.({ action: 'requestWifiStatus' });
                    render(contentFocusFor('connectivity'));
                });
            });
            overlay.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const action = btn.dataset.action;
                    if (action === 'check-doorpi') {
                        if (btn.dataset.busy === 'true') return;
                        const message = t('quickCheckingDoorpi');
                        doorpiStatus = { ...(doorpiStatus || {}), status: 'checking', message };
                        setBusyAction(btn, message);
                        postToHost?.({ action: 'checkSystemUpdates' });
                    }
                    else if (action === 'install-doorpi') postToHost?.({ action: 'startSystemUpdate' });
                    else if (action === 'check-windows') {
                        if (btn.dataset.busy === 'true') return;
                        const message = t('quickCheckingWindows');
                        windowsStatus = { ...(windowsStatus || {}), status: 'checking', message };
                        setBusyAction(btn, message);
                        postToHost?.({ action: 'checkWindowsUpdates' });
                    }
                    else if (action === 'install-windows') postToHost?.({ action: 'startWindowsUpdateInstall' });
                    else if (action === 'open-windows-update') { close(); postToHost?.({ action: 'openWindowsUpdateSettings' }); }
                    else if (action === 'open-gpu-updater') { postToHost?.({ action: 'openGpuUpdater', updaterId: btn.dataset.updaterId || '' }); }
                    else if (action === 'add-gpu-updater') postToHost?.({ action: 'addGpuUpdater' });
                    else if (action === 'remove-gpu-updater') postToHost?.({ action: 'removeGpuUpdater', updaterId: btn.dataset.updaterId || '' });
                    else if (action === 'restart') postToHost?.({ action: 'restartSystem' });
                    else if (action === 'suspend') postToHost?.({ action: 'suspendSystem' });
                    else if (action === 'shutdown') postToHost?.({ action: 'shutdownSystem' });
                    else if (action === 'exit') postToHost?.({ action: 'exitApp' });
                    else if (action === 'open-users') {
                        window._doorpiUserPickerReturnToQuickPanel = true;
                        close();
                        postToHost?.({ action: 'requestUsers' });
                    }
                    else if (action === 'enter-desktop') {
                        close();
                        if (typeof window.showDesktopWarning === 'function') {
                            window.showDesktopWarning('desktop', () => postToHost?.({ action: 'enterDesktopMode' }));
                        } else {
                            postToHost?.({ action: 'enterDesktopMode' });
                        }
                    }
                    else if (action === 'open-settings') openNavSettings();
                });
            });
        }

        function open() {
            if (!canOpen()) return;
            section = null;
            updateView = 'hub';
            connectivityView = 'hub';
            depth = 'menu';
            const overlay = ensure();
            overlay.classList.remove('has-opened');
            overlay.classList.add('visible');
            overlay.style.display = 'flex';
            document.body.classList.remove('quick-menu-unavailable');
            document.body.classList.add('quick-panel-open');
            postToHost?.({ action: 'requestUpdateStatus' });
            postToHost?.({ action: 'requestWindowsUpdateStatus' });
            postToHost?.({ action: 'requestGpuUpdateStatus' });
            postToHost?.({ action: 'requestSoundStatus' });
            render('.dq-menu-btn');
        }

        function openMenu() {
            if (!canOpen()) return;
            section = null;
            updateView = 'hub';
            connectivityView = 'hub';
            depth = 'menu';
            const overlay = ensure();
            overlay.classList.add('visible', 'has-opened');
            overlay.style.display = 'flex';
            document.body.classList.remove('quick-menu-unavailable');
            document.body.classList.add('quick-panel-open');
            postToHost?.({ action: 'requestUpdateStatus' });
            postToHost?.({ action: 'requestWindowsUpdateStatus' });
            postToHost?.({ action: 'requestGpuUpdateStatus' });
            postToHost?.({ action: 'requestSoundStatus' });
            render('.dq-menu-btn');
        }

        function toggle() {
            if (api.isOpen()) close();
            else open();
        }

        function close() {
            if (section === 'connectivity' && bluetoothStatus?.discovering)
                postToHost?.({ action: 'stopBluetoothDiscovery' });
            if (section === 'sound') window.DoorpiSoundUI?.closeDrawer?.('quick');
            if (document.querySelector('.context-menu.visible')) window._ctxMenuClose?.();
            const overlay = document.getElementById('doorpiQuickPanel');
            if (overlay) {
                overlay.classList.remove('visible');
                overlay.style.display = 'none';
            }
            document.body.classList.remove('quick-panel-open');
            window.updateDoorpiQuickMenuAvailability?.();
            window.focusFeaturedCard?.();
        }

        function back() {
            if (section === 'sound') {
                const soundFocusSelector = window.DoorpiSoundUI?.back?.('quick');
                if (soundFocusSelector) {
                    if (typeof soundFocusSelector === 'string') render(soundFocusSelector);
                    return true;
                }
            }
            if (section === 'connectivity' && connectivityView === 'bluetooth' && bluetoothStatus?.pairingPrompt) {
                postToHost?.({ action: 'respondBluetoothPairing', accepted: false, pin: '' });
                return true;
            }
            if (section === 'connectivity' && connectivityView === 'bluetooth' && window.DoorpiBluetoothUI?.back?.('quick')) {
                render('.bt-device-card');
                return true;
            }
            if (section === 'connectivity' && connectivityView === 'wifi' && window.DoorpiWifiUI?.back?.('quick')) {
                render('.wifi-network-card');
                return true;
            }
            if (section === 'connectivity' && connectivityView !== 'hub') {
                connectivityView = 'hub';
                depth = 'content';
                render('.dq-card');
                return true;
            }
            if (section === 'updates' && updateView !== 'hub') {
                updateView = 'hub';
                depth = 'content';
                render('.dq-card');
                return true;
            }
            if (depth === 'content') {
                depth = 'menu';
                const focusSelector = section ? `.dq-menu-btn[data-section="${section}"]` : '.dq-menu-btn';
                if (section === 'sound') window.DoorpiSoundUI?.closeDrawer?.('quick');
                section = null;
                updateView = 'hub';
                render(focusSelector);
                return true;
            }
            close();
            return true;
        }

        function handleDirection(direction) {
            if (!api.isOpen()) return false;
            if (section === 'sound' && window.DoorpiSoundUI?.handleDirection?.('quick', direction)) return true;
            const active = document.activeElement;
            if (active?.closest?.('#doorpiQuickPanel .dq-content')) {
                if (direction === 'LEFT') {
                    if (hasContentTargetToLeft(active)) return false;
                    depth = 'menu';
                    const sidebarTarget = document.querySelector(
                        `#doorpiQuickPanel .dq-menu-btn[data-section="${section}"]`);
                    sidebarTarget?.focus();
                    return true;
                }
                if (direction === 'RIGHT') {
                    const contentItems = getQuickPanelContentItems();
                    const target = findContentTargetToRight(active, contentItems) || contentItems[0];
                    target?.focus();
                    return true;
                }
            }
            if (active?.closest?.('#doorpiQuickPanel .dq-sidebar') && direction === 'RIGHT') {
                const contentItems = getQuickPanelContentItems();
                if (section && contentItems.length) {
                    depth = 'content';
                    const preferred = document.querySelector(
                        `#doorpiQuickPanel ${contentFocusFor(section)}`);
                    (preferred && contentItems.includes(preferred) ? preferred : contentItems[0])?.focus();
                    return true;
                }
                close();
                return true;
            }
            return false;
        }

        const api = {
            open,
            openMenu,
            close,
            toggle,
            back,
            confirm() {
                if (!this.isOpen() || section !== 'sound') return false;
                return !!window.DoorpiSoundUI?.confirm?.('quick');
            },
            handleDirection,
            isOpen: () => {
                const overlay = document.getElementById('doorpiQuickPanel');
                return !!(overlay && overlay.style.display !== 'none' && overlay.offsetWidth > 0);
            },
            setDoorpiUpdateStatus(status) {
                const focusSelector = currentFocusSelector();
                doorpiStatus = status;
                if (this.isOpen() && patchCheckingStatus('doorpi', status)) return;
                if (this.isOpen()) render(focusSelector || contentFocusFor(section));
            },
            setWindowsUpdateStatus(status) {
                const focusSelector = currentFocusSelector();
                windowsStatus = status;
                if (this.isOpen() && patchCheckingStatus('windows', status)) return;
                if (this.isOpen()) render(focusSelector || contentFocusFor(section));
            },
            setGpuUpdateStatus(status) {
                const focusSelector = currentFocusSelector();
                gpuStatus = status;
                if (this.isOpen()) render(focusSelector || contentFocusFor(section));
            },
            setBluetoothStatus(status) {
                bluetoothStatus = { ...(bluetoothStatus || {}), ...(status || {}) };
                if (this.isOpen() && section === 'connectivity') {
                    const op = bluetoothStatus.operation || '';
                    scheduleBluetoothContentPatch(op === 'pairing' || op === 'removing' || !!bluetoothStatus.pairingPrompt);
                }
            },
            setWifiStatus(status) {
                wifiStatus = { ...(wifiStatus || {}), ...(status || {}) };
                if (this.isOpen() && section === 'connectivity' && connectivityView === 'wifi') {
                    patchWifiContent();
                }
            },
            setSoundStatus(status) {
                soundStatus = { ...(soundStatus || {}), ...(status || {}) };
                if (this.isOpen() && section === 'sound') {
                    patchSoundContent();
                }
            }
        };
        return api;
    })();

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
        return Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay, .doorpi-pin-panel, .doorpi-update-prompt.is-visible'))
            .some(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
    };

    document.addEventListener('focusin', (e) => {
        if (window.isSessionConflictPopupOpen?.()) {
            const conflictOverlay = document.getElementById('sessionConflictOverlay');
            if (conflictOverlay && !conflictOverlay.contains(e.target)) {
                e.stopImmediatePropagation();
                queueMicrotask(() => document.getElementById('sessionConflictClose')?.focus());
            }
            return;
        }
        const executionOverlay = document.getElementById('gameLaunchOverlay');
        if (executionOverlay?.classList.contains('visible') &&
            executionOverlay.classList.contains('execution-lock-visible')) {
            if (!executionOverlay.contains(e.target)) {
                e.stopImmediatePropagation();
                queueMicrotask(() => GameLaunchOverlay.focusExecutionLockActions?.());
            }
            return;
        }
        if (e.target?.closest?.('.vkb-overlay, .doorpi-vkb-overlay, .context-menu.visible')) return;
        if (window.isDoorpiOverlayOpen && window.isDoorpiOverlayOpen()) {
            const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay, .doorpi-pin-panel, .doorpi-update-prompt.is-visible'))
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
        const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay, .doorpi-pin-panel'))
            .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
        const top = overlays.at(-1);
        if (!top) return [];
        return Array.from(top.querySelectorAll('button, input, select, [tabindex="0"]'))
            .filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);
    };

    window.closeDoorpiTopOverlay = function (force = false) {
        const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay, .doorpi-pin-panel'))
            .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
        const top = overlays.at(-1);
        if (!force && top?.dataset.required === 'true') return;
        if (top) {
            if (top.id === 'doorpiQuickPanel' && window.DoorpiQuickPanel?.back && !force) {
                window.DoorpiQuickPanel.back();
                return;
            }
            if (top.id === 'doorpiQuickPanel' && window.DoorpiQuickPanel?.close) {
                window.DoorpiQuickPanel.close();
                return;
            }
            top.style.display = 'none';
            if (top.id === 'doorpiUserPicker') {
                document.body.classList.remove('user-picker-open');
                window.DoorpiIntro?.finishHandoff?.();
            }
        }
    };

    document.addEventListener('click', (e) => {
        const input = e.target.closest?.('input[type="text"], input:not([type]), textarea');
        if (!input) return;
        if (window._vkbIsOpen) return;
        if (input.closest('.doorpi-manager-overlay, .doorpi-user-overlay, .edit-modal-overlay, .artwork-wizard-overlay, #addGameContainer, #setupContainer, .nav-profile-dashboard')) {
            input.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(e)) return;
            window._vkbOpen?.(input);
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || window._vkbIsOpen) return;
        const input = e.target.closest?.('input[type="text"], input:not([type]), textarea');
        if (!input) return;
        if (input.closest('.doorpi-manager-overlay, .doorpi-user-overlay, .edit-modal-overlay, .artwork-wizard-overlay, #addGameContainer, #setupContainer, .nav-profile-dashboard')) {
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
                    window.syncFeaturedCardArt?.(grid);
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
        if ((key === 'staticHorizontal' || key === 'staticVertical') && document.activeElement !== card && !card.matches(':hover')) {
            window.syncFeaturedCardArt?.(card.closest('#gameGrid, #mediaGrid') || document);
        }
        if (isFeatured && key === 'staticHero') switchHeroBackground(newUrl, card.dataset.staticLogo || card.dataset.logo);
    }

    const _TAB_MAP = { 'apps': 0, 'media-apps': 1, 'stores': 2, 'folders': 3 };
    const _VIEW_MAP = { 'apps': 'view-apps', 'media-apps': 'view-media-apps', 'stores': 'view-stores', 'folders': 'view-folders' };

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
        else if (tabId === 'stores') {
            if (modalActions) modalActions.style.display = 'none';
            if (mediaAppActions) mediaAppActions.style.display = 'none';
            if (!supportedStores.length && Array.isArray(window._supportedStoresCatalog)) {
                supportedStores = window._supportedStoresCatalog;
            }
            renderStoreInstallList();
            postToHost({ action: 'requestStores' });
        }
    }
    /* Seção: Filtros e barra de filtros */
    currentSourceFilter = ['all'];
window.isBackgroundScanning = false;
window.lastScanText = t('inlineScanIdle'); // Memória para não perder o texto ao trocar de aba

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
                <span id="inlineScanText">${typeof escapeHtml === 'function' ? escapeHtml(window.lastScanText) : window.lastScanText}</span>
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
    window.updateDoorpiQuickMenuAvailability?.();
    _modalReady = false;
    if (isSetupOpen) return;
    document.getElementById('modalActions').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'hidden';
    document.getElementById('addGameContainer').style.display = 'flex';
    document.getElementById('modalTitle').innerText = t('detectingLibrary');


    window.setInlineScanStatus(true, t('inlineScanSearchingGames'));

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
    window.updateDoorpiQuickMenuAvailability?.();
    _modalReady = false;
    if (isSetupOpen) return;
    document.getElementById('modalActions').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'hidden';
    document.getElementById('addGameContainer').style.display = 'flex';
    document.getElementById('modalTitle').innerText = t('detectingLibrary');

    // SUBSTITUIÇÃO: Aciona o loading no canto superior da tela!
    window.setInlineScanStatus(true, t('inlineScanSearchingApps'));

    switchTab('media-apps');
    postToHost({ action: 'requestInstalledApps' });
    postToHost({ action: 'startAppPolling' });
});

document.getElementById('btnAddStore')?.addEventListener('click', () => {
    if (window.DoorpiIntro?.isRunning?.()) {
        window.DoorpiIntro.skip?.();
        return;
    }
    isModalOpen = true;
    window.updateDoorpiQuickMenuAvailability?.();
    _modalReady = false;
    if (isSetupOpen) return;
    document.getElementById('modalActions').style.display = 'none';
    document.getElementById('mediaAppActions').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'hidden';
    document.getElementById('addGameContainer').style.display = 'flex';
    switchTab('stores');
});

    function closeModal() {
        document.getElementById('addGameContainer').style.display = 'none';
        document.getElementById('gameGrid').style.overflowX = 'auto';
        document.getElementById('selectionCounter')?.classList.remove('visible');
        isModalOpen = false;
        window.updateDoorpiQuickMenuAvailability?.();
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

           
            window.setInlineScanStatus?.(true, t('inlineScanWaitingWindows'));
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
            window.setInlineScanStatus?.(true, t('inlineScanWaitingWindows'));
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
            const isAdminLocked = app.IsAdminLocked === true || app.isAdminLocked === true;
            const addState = app.AddState || app.addState || '';
            const isPreparing = addState === 'preparing' || (app.AddedTo || app.addedTo) === 'preparing-game';
            const stateLabel = isPreparing ? 'Preparando capa' : (isAdded ? 'Já adicionado' : '');

            return `
            <div class="app-item ${isAdded ? 'already-added' : ''} ${isAdminLocked ? 'already-added admin-locked' : ''} ${isPreparing ? 'preparing-artwork' : ''}" ${isAdded || isAdminLocked ? '' : 'tabindex="0"'}
                 data-path="${path.replace(/\\/g, '\\\\')}" data-launch="${launch}"
                 data-name="${name.replace(/"/g, '&quot;')}" data-source="${source || ''}" data-icon-base64="${icon || ''}">
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
                Name: el.dataset.name, Path: el.dataset.path, LaunchUrl: el.dataset.launch, Source: el.dataset.source || '', IconBase64: el.dataset.iconBase64 || '',
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
    function renderStoreInstallList() {
        const list = document.getElementById('storeInstallList');
        if (!list) return;

        const stores = supportedStores || [];
        if (!stores.length) {
            list.innerHTML = `
                <div class="folder-empty">
                    <div class="folder-empty-icon">+</div>
                    <div class="folder-empty-text">${t('storesLoading')}</div>
                    <div class="folder-empty-hint">${t('storesLoadingHint')}</div>
                </div>`;
            return;
        }

        list.innerHTML = stores.map(store => {
            const id = store.Id || store.id || '';
            const name = store.Name || store.name || id;
            const installed = store.installed === true || store.Installed === true;
            const downloadUrl = store.downloadUrl || store.DownloadUrl || '';
            const logo = store.LogoStaticImage || store.logoStaticImage || store.LogoImage || store.logoImage || '';
            const grid = store.GridStaticImage || store.gridStaticImage || store.GridImage || store.gridImage || '';
            const image = logo || grid;
            const statusLabel = installed ? t('storeInstalled') : t('storeNotInstalled');
            const actionLabel = installed ? t('storeAlreadyInstalled') : t('storeOpenSite');
            const isRiot = String(id).toLowerCase() === 'riot';
            const riotInstallHint = isRiot && !installed
                ? `<small class="store-install-note">${escapeHtml(t('storeInstallRiotNote'))}</small>
                   <span class="store-install-pair" aria-hidden="true">
                       <span>Riot Client</span>
                       <span>2XKO</span>
                   </span>`
                : '';

            return `
                <button class="store-install-card ${installed ? 'installed' : ''}" type="button" tabindex="${installed || !downloadUrl ? '-1' : '0'}"
                        data-store-id="${escapeHtml(id)}" data-store-name="${escapeHtml(name)}" data-download-url="${escapeHtml(downloadUrl)}"
                        ${installed || !downloadUrl ? 'aria-disabled="true"' : ''}>
                    <span class="store-install-art">
                        ${image ? `<img src="${escapeHtml(image)}" alt="" />` : `<span>${escapeHtml((name || '?').charAt(0).toUpperCase())}</span>`}
                    </span>
                    <span class="store-install-info">
                        <strong>${escapeHtml(name)}</strong>
                        <small>${escapeHtml(statusLabel)}</small>
                        ${riotInstallHint}
                    </span>
                    <span class="store-install-action">${escapeHtml(actionLabel)}</span>
                </button>`;
        }).join('');

        list.querySelectorAll('.store-install-card').forEach(card => {
            card.addEventListener('click', () => {
                if (card.classList.contains('installed')) return;
                const url = card.dataset.downloadUrl || '';
                const storeId = card.dataset.storeId || '';
                const name = card.dataset.storeName || '';
                if (!url) return;
                if (window.hasStoreDownloadBlockingRuntime?.()) {
                    window.showStoreDownloadSessionConflict?.({ storeId, url, name });
                    return;
                }
                postToHost({ action: 'openStoreDownloadSite', storeId, url, name });
            });
        });

        requestAnimationFrame(() => {
            _modalReady = true;
            (list.querySelector('.store-install-card:not(.installed):not([aria-disabled="true"])')
                || document.querySelector('#view-stores .action-buttons button'))?.focus();
        });
    }

    window.setSupportedStoresForModal = function (stores) {
        supportedStores = Array.isArray(stores) ? stores : [];
        const activeView = document.querySelector('.view-section.active')?.id;
        if (activeView === 'view-stores') renderStoreInstallList();
    };

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
            window.setInlineScanStatus?.(true, t('inlineScanWaitingWindows'));
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
            window.setInlineScanStatus?.(true, t('inlineScanUpdatingList'));
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

    window.requestStaticFrameExtraction = async function ({ gameId, entityId, src, imageType }) {
        const id = entityId || gameId;
        if (!id || !src || !imageType) return false;

        const blob = await getAnimatedBlob(src);
        if (!blob) return false;

        return new Promise(resolve => {
            const tmp = new Image();
            const blobUrl = URL.createObjectURL(blob);
            let settled = false;

            const finish = (ok) => {
                if (settled) return;
                settled = true;
                URL.revokeObjectURL(blobUrl);
                resolve(!!ok);
            };

            tmp.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = tmp.naturalWidth;
                    c.height = tmp.naturalHeight;
                    c.getContext('2d').drawImage(tmp, 0, 0);
                    postToHost({
                        action: 'saveStaticFrame',
                        gameId: id,
                        imageType,
                        base64: c.toDataURL('image/png')
                    });
                    finish(true);
                } catch (_) {
                    finish(false);
                }
            };
            tmp.onerror = () => finish(false);
            tmp.src = blobUrl;
        });
    };


    function moveCardToTop(card) {
        if (!card) return;
        const grid = card.closest('#gameGrid') || card.closest('#mediaGrid') || document.getElementById('gameGrid');

        grid.querySelectorAll('.card.featured').forEach(c => {
            if (c === card) return;
            c.classList.remove('featured');
            const img = c.querySelector('img');
            if (img) {
                const src = c.dataset.staticVertical || (c.dataset.isAnimated !== 'true' ? c.dataset.vertical : '');
                if (src) img.src = src;
            }
        });

        card.classList.add('featured');
        grid.prepend(card);

        const img = card.querySelector('img');
        if (img) {
            img.src = card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical || '';
        }
        window.syncFeaturedCardArt?.(grid);

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
        const label = t('platformLabels.' + source);
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
        font-size: clamp(0.68rem, 1.05vw, 1.5rem);
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
        display: flex;
        align-items: center;
        gap: clamp(12px, 1.1vw, 18px);
        color: rgba(255,255,255,.58);
        font-size: clamp(13px, .82vw, 18px);
        font-weight: 800;
        letter-spacing: .05em;
        text-transform: uppercase;
    }
    #navHintDown.visible { opacity: 1; }
    #navHintDown.nav-open { bottom: auto; top: 2rem; }
    #navHintDown.nav-open svg { transform: rotate(180deg); }
    .nav-hint-chip {
        display: inline-flex;
        align-items: center;
        gap: clamp(7px, .6vw, 10px);
        min-height: clamp(32px, 2vw, 40px);
        padding: 0 clamp(12px, .9vw, 18px);
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(8,9,18,.34);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    }
    .nav-hint-chip svg {
        width: clamp(20px, 1.1vw, 28px);
        height: clamp(20px, 1.1vw, 28px);
        flex: 0 0 auto;
    }
        .context-menu {
            position: fixed;
            z-index: 26000;
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
        .context-menu.gpu-updater-context,
        .context-menu.bluetooth-device-context {
            min-width: 280px;
            padding: 8px;
            background: rgba(8,9,18,.98);
            border-color: rgba(255,255,255,.15);
        }
        .context-menu.gpu-updater-context .ctx-game-name,
        .context-menu.bluetooth-device-context .ctx-game-name {
            padding: 9px 12px 8px;
            max-width: 260px;
            color: rgba(255,255,255,.48);
        }
        .context-menu.gpu-updater-context .ctx-item,
        .context-menu.bluetooth-device-context .ctx-item {
            min-height: 46px;
            padding: 0 12px;
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
            min-height: 42px;
            border: 1px solid transparent; background: none;
            color: rgba(255,255,255,0.82);
            font-size: 13.5px; font-family: inherit; font-weight: 450;
            border-radius: 8px; cursor: pointer;
            text-align: left; width: 100%;
            transition: background 0.1s, color 0.1s, border-color 0.1s, box-shadow 0.1s;
        }
        .ctx-item:hover, .ctx-item:focus {
            background: rgba(255,255,255,0.10);
            color: #fff;
            border-color: rgba(255,255,255,0.28);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
            outline: none;
        }
        .ctx-item.ctx-danger:hover, .ctx-item.ctx-danger:focus { background: rgba(220,50,50,0.18); color: #ff6e6e; }
        .ctx-item .ctx-icon { width: 16px; text-align: center; opacity: 0.6; font-size: 15px; flex-shrink: 0; }
        .ctx-item.ctx-toggle-item { justify-content: space-between; gap: 16px; min-height: 50px; }
        .ctx-item.ctx-toggle-item span:not(.ctx-icon) {
            flex: 1;
            min-width: 0;
            line-height: 1.25;
        }
        .ctx-item.ctx-toggle-item .ctx-icon {
            width: 24px;
            height: 24px;
            min-width: 24px;
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
        .ctx-item.ctx-toggle-item:focus .ctx-icon,
        .ctx-item.ctx-toggle-item:hover .ctx-icon {
            border-color: rgba(255,255,255,0.75);
            box-shadow: 0 0 0 3px rgba(255,255,255,0.14);
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
        .edit-modal-overlay.vkb-active { align-items: center; padding-top: 0; }
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
        .edit-artwork-actions { display: flex; flex-direction: column; gap: 10px; }
        .edit-artwork-btn {
            border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.055);
            color: #fff; border-radius: 12px; min-height: 58px; padding: 0 16px;
            font: inherit; cursor: pointer; outline: none; text-align: left; width: 100%;
            display: flex; align-items: center; justify-content: space-between;
        }
        .edit-artwork-btn:focus, .edit-artwork-btn:hover, .edit-artwork-btn.nav-focused-el { border-color: rgba(255,255,255,0.72); background: rgba(255,255,255,0.12); box-shadow: 0 0 0 2px rgba(255,255,255,.14); }
        .artwork-wizard-overlay { position: fixed; inset: 0; z-index: 10020; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.62); backdrop-filter: blur(18px); }
        .artwork-wizard { width: min(1280px, 96vw); height: min(880px, 92vh); background: rgba(12,12,18,0.99); border: 1px solid rgba(255,255,255,0.11); border-radius: 22px; box-shadow: 0 30px 80px rgba(0,0,0,.82); display: flex; flex-direction: column; overflow: hidden; }
        .artwork-wizard-head { padding: 20px 24px 14px; border-bottom: 1px solid rgba(255,255,255,.07); }
        .artwork-wizard-title { margin: 0 0 12px; font-size: 18px; color: #fff; }
        .artwork-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .artwork-step { border: 1px solid rgba(255,255,255,.08); border-radius: 999px; padding: 8px 10px; color: rgba(255,255,255,.35); text-align: center; font-size: 12px; }
        .artwork-step.active { color: #07101d; background: rgba(255,255,255,.94); border-color: #fff; }
        .artwork-step.done { color: rgba(130,210,255,.95); border-color: rgba(130,210,255,.28); }
        .artwork-wizard-body { flex: 1; min-height: 0; padding: 18px 24px; display: flex; flex-direction: column; gap: 14px; }
        .artwork-results { flex: 1; min-height: 0; overflow: auto; display: grid; gap: 18px; align-content: start; align-items: start; justify-content: stretch; justify-items: stretch; grid-auto-flow: row; grid-auto-rows: max-content; padding: 12px 16px 18px 12px; }
        .artwork-results.is-vertical { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
        .artwork-results.is-horizontal { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
        .artwork-results.is-banner { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
        .artwork-results.is-logo { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
        .artwork-results.is-local { grid-template-columns: minmax(0, 1fr); }
        .artwork-choice { width: 100%; box-sizing: border-box; border: 0; border-radius: 0; background: transparent; padding: 0; overflow: visible; cursor: pointer; outline: none; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; scroll-margin: 28px 18px; }
        .artwork-choice:focus, .artwork-choice:hover, .artwork-choice.nav-focused-el { transform: none; box-shadow: none; }
        .artwork-choice img { width: 100%; height: auto; object-fit: contain; display: block; border-radius: 0; border: 2px solid transparent; box-sizing: border-box; }
        .artwork-choice.vertical img { aspect-ratio: 2 / 3; object-fit: cover; }
        .artwork-choice.horizontal img { aspect-ratio: 460 / 215; object-fit: cover; }
        .artwork-choice.banner img { aspect-ratio: 1920 / 620; object-fit: cover; }
        .artwork-choice.logo img { aspect-ratio: 4 / 1; object-fit: contain; min-height: 76px; }
        .artwork-choice:focus img, .artwork-choice:hover img, .artwork-choice.nav-focused-el img { border-color: #fff; box-shadow: 0 0 0 3px #fff, 0 0 0 7px rgba(255,255,255,.20), 0 18px 42px rgba(0,0,0,.55); }
        .artwork-status { color: rgba(255,255,255,.46); font-size: 13px; }
        .artwork-search-row, .artwork-actions { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; }
        .artwork-actions { grid-template-columns: auto auto minmax(0, 1fr); }
        .artwork-search-box { position: relative; min-width: 0; display: flex; align-items: center; }
        .artwork-search-box .edit-modal-input { padding-left: 48px; }
        .artwork-search-badge { position: absolute; left: 12px; z-index: 1; pointer-events: none; transform: scale(.86); }
        .artwork-action-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; }
        .artwork-local-panel { width: 100%; min-height: 360px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; border: 1px dashed rgba(255,255,255,.14); border-radius: 18px; background: rgba(255,255,255,.035); padding: 28px; box-sizing: border-box; text-align: center; }
        .artwork-local-title { color: rgba(255,255,255,.9); font-size: 16px; font-weight: 650; }
        .artwork-local-hint { color: rgba(255,255,255,.42); font-size: 13px; max-width: 460px; line-height: 1.45; }
        .artwork-local-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; max-width: 100%; }
        .artwork-pick-btn { max-width: min(340px, 72vw); min-height: 48px; white-space: normal; line-height: 1.25; text-align: center; }
        .artwork-local-preview { max-width: min(420px, 68vw); max-height: 250px; border-radius: 14px; object-fit: contain; background: rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.08); }
        .artwork-clear-btn { width: 46px; min-width: 46px; height: 46px; padding: 0; color: #ff7777; border-color: rgba(255,90,90,.38); font-size: 18px; font-weight: 800; }
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
            z-index: 10040;
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
        .vkb-overlay.numeric .vkb-grid {
            grid-template-columns: repeat(3, clamp(64px, 5.6vw, 120px));
        }
        .vkb-overlay.numeric .vkb-key {
            width: clamp(64px, 5.6vw, 120px);
            height: clamp(54px, 5.2vw, 86px);
            font-size: clamp(18px, 1.8vw, 28px);
            font-weight: 650;
        }
        .vkb-overlay.numeric .vkb-key[data-key="cancel"],
        .vkb-overlay.numeric .vkb-key[data-key="ok"] {
            grid-column: span 1;
            width: clamp(64px, 5.6vw, 120px);
            height: clamp(54px, 5.2vw, 86px);
            font-size: clamp(12px, 1.1vw, 16px);
        }

        .vkb-key {
            width: clamp(42px, 3.8vw, 90px);
            height: clamp(42px, 3.8vw, 75px);
            padding: 0;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.11);
            border-bottom: 0;
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
            grid-column: span 5;
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
        .vkb-overlay.numeric .vkb-key[data-key="cancel"],
        .vkb-overlay.numeric .vkb-key[data-key="ok"] {
            grid-column: span 1 !important;
            width: clamp(64px, 5.6vw, 120px) !important;
            height: clamp(54px, 5.2vw, 86px) !important;
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

        .vkb-overlay {
            top: 50%; left: 50%; right: auto; bottom: auto;
            z-index: 10040;
            display: none;
            padding: clamp(10px, 1.2vh, 16px);
            background: rgba(8, 9, 15, 0.96);
            border: 1px solid rgba(255,255,255,0.13);
            border-radius: clamp(14px, 1.1vw, 20px);
            box-shadow: 0 28px 90px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.04) inset;
            backdrop-filter: blur(22px) saturate(1.25);
            opacity: 0;
            transform: translate(-50%, 10px) scale(0.985);
            transition: opacity 0.16s ease, transform 0.16s ease;
        }
        .vkb-overlay.visible { opacity: 1; transform: translate(-50%, 0) scale(1); }
        .vkb-preview-wrap { gap: clamp(8px, 0.8vw, 14px); margin-bottom: clamp(8px, 1vh, 14px); }
        .vkb-preview-label { font-size: clamp(9px, 0.72vw, 12px); }
        .vkb-preview-text {
            font-size: clamp(14px, 1.05vw, 20px);
            padding: clamp(7px, 0.8vh, 10px) clamp(10px, 1vw, 16px);
            min-height: clamp(34px, 4vh, 48px);
        }
        .vkb-pending-accent { margin-left: 8px; color: rgba(255,185,90,0.96); font-weight: 800; }
        .vkb-grid { display: flex; flex-direction: column; gap: clamp(5px, 0.55vh, 8px); width: auto; margin: 0; }
        .vkb-row { display: flex; justify-content: center; gap: clamp(5px, 0.45vw, 8px); }
        .vkb-key {
            position: relative;
            width: auto;
            flex: var(--vkb-unit, 1) 1 0;
            min-width: clamp(34px, 2.4vw, 58px);
            height: clamp(36px, 3.2vw, 58px);
            border-bottom-width: 0;
            font-size: clamp(12px, 0.95vw, 17px);
        }
        .vkb-key:focus { transform: scale(1.06) translateY(-2px); }
        .vkb-key-label { pointer-events: none; white-space: nowrap; }
        .vkb-pad-icon {
            position: absolute; top: 4px; right: 5px;
            min-width: 16px; height: 16px; padding: 0 4px;
            border-radius: 8px; background: rgba(255,255,255,0.12);
            color: rgba(255,255,255,0.75);
            display: flex; align-items: center; justify-content: center;
            font-size: 8px; line-height: 1; font-weight: 850; letter-spacing: 0;
        }
        .vkb-pad-icon.start { min-width: 20px; border-radius: 5px; }
        .vkb-key.space-key {
            height: clamp(42px, 3.6vw, 62px);
            font-size: clamp(11px, 0.82vw, 14px);
            letter-spacing: 0.08em;
            color: rgba(255,255,255,0.45);
        }
        .vkb-key.space-key:focus { color: rgba(0,0,0,0.65); }
        .vkb-key[data-key="CANCEL"] { color: rgba(255,255,255,0.6); font-size: clamp(11px, 0.85vw, 15px); font-weight: 500; }
        .vkb-key[data-key="ENTER"] {
            background: rgba(50,110,255,0.32);
            border-color: rgba(50,110,255,0.55);
            color: rgba(170,205,255,0.95);
            font-weight: 650;
            font-size: clamp(11px, 0.85vw, 15px);
        }
        .vkb-key[data-key="ENTER"]:focus {
            background: rgb(50,110,255); color: #fff; border-color: transparent;
            box-shadow: 0 8px 28px rgba(50,110,255,0.55), 0 0 0 2px rgba(50,110,255,0.4);
        }
        .vkb-key[data-key="BKSP"] { color: rgba(255,110,110,0.85); font-size: clamp(11px, 0.85vw, 15px); }
        .vkb-key[data-key="BKSP"]:focus { color: #b00; }
        .vkb-key[data-key="SHIFT"] { font-size: clamp(11px, 0.85vw, 15px); }
        .vkb-key[data-key="SHIFT"].shifted {
            background: rgba(255,255,255,0.2);
            border-color: rgba(255,255,255,0.3);
            color: #fff;
        }
        .vkb-key[data-key="SHIFT"].shifted:focus { background: rgba(255,255,255,0.97); color: #080810; }
        .vkb-key.accent-pending {
            background: rgba(255,145,45,0.34);
            border-color: rgba(255,180,90,0.78);
            color: #fff;
        }
        .vkb-overlay.numeric { width: min(360px, calc(100vw - 32px)) !important; }
        .vkb-overlay.numeric .vkb-row { gap: 7px; }
        .vkb-overlay.numeric .vkb-key {
            min-width: 0;
            height: clamp(44px, 4.2vw, 68px);
            font-size: clamp(16px, 1.3vw, 24px);
            font-weight: 650;
        }

        @keyframes editOverlayIn { from{opacity:0} to{opacity:1} }
        @keyframes editModalIn   { from{opacity:0;transform:scale(0.93) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
    
    /* ── Novo Indicador de Menu (Seta) Robustez Total ── */

            @media (min-height: 1080px) {
            #navHintDown { bottom: 3px; padding:6px 90px; }
            #navHintDown svg { width: clamp(28px, 1.5vw, 34px); height: clamp(28px, 1.5vw, 34px); }
        }

    /* Texto opcional abaixo da seta se quiser (ou deixe vazio) */
    .nav-hint-text {
        font-size: clamp(11px, 1.3vmin, 16px);
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
        font-size: clamp(12px, 1.25vw, 16px);
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
                <span class="ctx-icon">▶</span> <span id="ctxRuntimeActionText">${t('ctxStart')}</span>
            </button>
            <button class="ctx-item ctx-toggle-item" id="ctxStoreGamepadControl" role="menuitem">
                <span id="ctxStoreGamepadControlText">${t('storeDisableGamepadControl')}</span> <span class="ctx-icon"></span>
            </button>
            <button class="ctx-item ctx-toggle-item" id="ctxStoreAutoAdd" role="menuitem">
                <span id="ctxStoreAutoAddText">${t('storeAutoAddQuickToggle')}</span> <span class="ctx-icon"></span>
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
        const separators = children.filter(child => child.classList?.contains('ctx-separator'));
        separators.forEach(separator => { separator.style.display = 'none'; });

        const visibleItems = children.filter(child =>
            child.classList?.contains('ctx-item') && _isCtxItemVisible(child));
        for (let i = 1; i < visibleItems.length; i++) {
            const previousIndex = children.indexOf(visibleItems[i - 1]);
            const currentIndex = children.indexOf(visibleItems[i]);
            const separator = children
                .slice(previousIndex + 1, currentIndex)
                .filter(child => child.classList?.contains('ctx-separator'))
                .at(-1);
            if (separator) separator.style.display = 'block';
        }
    }

    function _openCtxMenu(card, x, y) {
        _ctxCard = card;
        _ctxCard.classList.add('ctx-active');


        if (typeof applyI18n === 'function') applyI18n();
        const updateCount = Object.keys(window._pendingExtensionUpdates || {}).length;

        const gameId = card.dataset.gameId || card.dataset.appId || card.dataset.appUrl;
        const isYoutube = (gameId && gameId.toLowerCase().includes('youtube'));
        const isGpuUpdaterCard = card.dataset.gpuUpdaterCard === 'true';
        const isBluetoothDeviceCard = card.dataset.bluetoothDeviceCard === 'true';
        _ctxMenu.classList.toggle('gpu-updater-context', isGpuUpdaterCard);
        _ctxMenu.classList.toggle('bluetooth-device-context', isBluetoothDeviceCard);

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
            ctxRuntimeText.textContent = isGpuUpdaterCard
                ? 'Abrir'
                : isBluetoothDeviceCard
                ? (card.dataset.paired === 'true' ? t('bluetoothDetails') : t('bluetoothPair'))
                : isStoreCard && !isRunning
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
            ctxStoreGamepadText.textContent = t('storeDisableGamepadControl');
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
            ctxStoreAutoAddText.textContent = t('storeAutoAddQuickToggle');
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

        if (isBluetoothDeviceCard) {
            if (ctxRuntimeBtn) ctxRuntimeBtn.style.display = 'flex';
            if (ctxStoreGamepadBtn) ctxStoreGamepadBtn.style.display = 'none';
            if (ctxStoreAutoAddBtn) ctxStoreAutoAddBtn.style.display = 'none';
            if (ctxEditBtn) ctxEditBtn.style.display = 'none';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = 'none';
            if (ctxDeleteBtn) {
                ctxDeleteBtn.style.display = card.dataset.paired === 'true' ? 'flex' : 'none';
                const text = ctxDeleteBtn.querySelector('[data-i18n], span:last-child');
                if (text) text.textContent = t('bluetoothRemoveDevice');
            }
            ctxCloseBtn.style.display = 'none';
            _ctxMenu.querySelector('#ctxGameName').textContent =
                card.querySelector('.bt-device-copy strong')?.innerText?.trim() || 'Bluetooth';
        } else if (isGpuUpdaterCard) {
            if (ctxRuntimeBtn) ctxRuntimeBtn.style.display = 'flex';
            if (ctxStoreGamepadBtn) ctxStoreGamepadBtn.style.display = 'none';
            if (ctxStoreAutoAddBtn) ctxStoreAutoAddBtn.style.display = 'none';
            if (ctxEditBtn) ctxEditBtn.style.display = 'none';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = 'none';
            if (ctxDeleteBtn) {
                ctxDeleteBtn.style.display = 'flex';
                const text = ctxDeleteBtn.querySelector('[data-i18n], span:last-child');
                if (text) text.textContent = 'Remover atualizador';
            }
            ctxCloseBtn.style.display = 'none';
            _ctxMenu.querySelector('#ctxGameName').textContent =
                card.querySelector('.dq-app-name, .nav-gpu-app-name')?.innerText?.trim() || 'Atualizador';
        } else if (isStoreCard) {
            if (ctxRuntimeBtn) ctxRuntimeBtn.style.display = 'flex';
            if (ctxEditBtn) ctxEditBtn.style.display = 'none';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = 'none';
            if (ctxDeleteBtn) ctxDeleteBtn.style.display = 'none';
            ctxCloseBtn.style.display = 'none';
            _ctxMenu.querySelector('#ctxGameName').textContent = card.querySelector('.title, .nav-vertical-card-title')?.innerText?.trim() || '';
        } else if (isYoutube) {
            if (ctxRuntimeBtn) ctxRuntimeBtn.style.display = 'flex';
            if (ctxEditBtn) ctxEditBtn.style.display = 'none';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = isBrowserMedia ? 'flex' : 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = isBrowserMedia ? 'flex' : 'none';
            if (ctxDeleteBtn) ctxDeleteBtn.style.display = 'none';
            ctxCloseBtn.style.display = 'flex';
            _ctxMenu.querySelector('#ctxGameName').textContent = t('systemAppLabel');
        } else {
            if (ctxRuntimeBtn) ctxRuntimeBtn.style.display = 'flex';
            if (ctxEditBtn) ctxEditBtn.style.display = 'flex';
            if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = isBrowserMedia ? 'flex' : 'none';
            if (ctxSharingBtn) ctxSharingBtn.style.display = isBrowserMedia ? 'flex' : 'none';
            if (ctxDeleteBtn) {
                ctxDeleteBtn.style.display = 'flex';
                const text = ctxDeleteBtn.querySelector('[data-i18n], span:last-child');
                if (text) text.textContent = t('ctxRemoveGame');
            }
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

        if (card.dataset.gpuUpdaterCard === 'true' || card.dataset.bluetoothDeviceCard === 'true') {
            card.click();
        } else if (isRunning) {
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
        if (!card) return;
        if (card.dataset.gpuUpdaterCard === 'true') {
            const updaterId = card.dataset.updaterId || '';
            if (updaterId) postToHost?.({ action: 'removeGpuUpdater', updaterId });
            return;
        }
        if (card.dataset.bluetoothDeviceCard === 'true') {
            window.DoorpiBluetoothUI?.remove?.(card.dataset.deviceId || '');
            return;
        }
        _executeDelete(card);
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
                    window.syncFeaturedCardArt?.(grid);
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
    const ARTWORK_CATEGORIES = [
        { key: 'vertical', labelKey: 'artworkCategoryVertical' },
        { key: 'horizontal', labelKey: 'artworkCategoryHorizontal' },
        { key: 'banner', labelKey: 'artworkCategoryBanner' },
        { key: 'logo', labelKey: 'artworkCategoryLogo' }
    ];
    let _artworkWizard = null;

    function artworkLabel(cat) {
        return typeof t === 'function' ? t(cat.labelKey) : cat.key;
    }

    function _artworkPatchFromCategories(images) {
        const patch = {};
        if (images.vertical) patch.vertical = images.vertical;
        if (images.horizontal) patch.horizontal = images.horizontal;
        if (images.banner) patch.hero = images.banner;
        if (images.logo) patch.logo = images.logo;
        return patch;
    }

    function openArtworkWizard(card, mode, defaultQuery) {
        const requestId = `art_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const isMedia = card.hasAttribute('data-app-id') || card.closest('#mediaGrid') !== null;
        const gameId = card.dataset.gameId || card.dataset.appId || card.dataset.appUrl || '';
        const state = {
            requestId,
            mode,
            card,
            gameId,
            isMedia,
            index: 0,
            query: defaultQuery || card.querySelector('.title')?.innerText?.trim() || '',
            selected: {},
            localPreview: {},
            focusResultsOnLoad: mode === 'steamgrid'
        };

        const overlay = document.createElement('div');
        overlay.className = 'artwork-wizard-overlay';
        overlay.innerHTML = `
            <div class="artwork-wizard" role="dialog" aria-modal="true">
                <div class="artwork-wizard-head">
                    <h3 class="artwork-wizard-title">${t('artworkWizardTitle')}</h3>
                    <div class="artwork-steps"></div>
                </div>
                <div class="artwork-wizard-body">
                    <div class="artwork-status"></div>
                    <div class="artwork-results"></div>
                    <div class="artwork-search-row">
                        <div class="artwork-search-box">
                            <span class="gp-face-btn gp-y artwork-search-badge">Y</span>
                            <input class="edit-modal-input" id="artworkSearchInput" type="text" autocomplete="off" spellcheck="false" />
                        </div>
                        <button class="modal-btn secondary" id="artworkSearchBtn">${t('artworkSearch')}</button>
                    </div>
                    <div class="artwork-actions">
                        <button class="modal-btn secondary artwork-action-btn" id="artworkSkipBtn"><span class="gp-face-btn gp-x">X</span><span class="artwork-skip-label">${t('artworkSkip')}</span></button>
                        <button class="modal-btn cancel artwork-action-btn" id="artworkCancelBtn"><span class="gp-face-btn gp-b">B</span><span>${t('btnCancel')}</span></button>
                        <span></span>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        state.overlay = overlay;
        _artworkWizard = state;

        const searchInput = overlay.querySelector('#artworkSearchInput');
        if (searchInput) {
            searchInput._doorpiVkbReturnFocus = searchInput;
            searchInput._doorpiVkbCallbacks = {
                onCancel: () => requestAnimationFrame(() => searchInput.focus({ preventScroll: true })),
                onEnter: () => {
                    overlay.querySelector('#artworkSearchBtn')?.click();
                    requestAnimationFrame(() => searchInput.focus({ preventScroll: true }));
                }
            };
        }

        const renderSteps = () => {
            overlay.querySelector('.artwork-steps').innerHTML = ARTWORK_CATEGORIES.map((cat, i) =>
                `<div class="artwork-step ${i === state.index ? 'active' : ''} ${i < state.index ? 'done' : ''}">${artworkLabel(cat)}</div>`
            ).join('');
        };

        const finish = () => {
            const images = {};
            for (const cat of ARTWORK_CATEGORIES) {
                if (state.selected[cat.key]) images[cat.key] = state.selected[cat.key];
            }
            if (Object.keys(images).length === 0) {
                close();
                return;
            }
            postToHost({
                action: 'applyArtworkSelection',
                requestId,
                gameId,
                isMedia,
                localFiles: mode === 'local',
                images
            });
            overlay.querySelector('.artwork-status').textContent = t('artworkApplying');
        };

        const next = () => {
            state.index += 1;
            if (state.index >= ARTWORK_CATEGORIES.length) {
                finish();
                return;
            }
            render();
        };

        const close = () => {
            overlay.remove();
            if (_artworkWizard === state) _artworkWizard = null;
        };

        const renderLocal = (cat) => {
            const preview = state.localPreview[cat.key] || '';
            overlay.querySelector('.artwork-results').innerHTML = `
                <div class="artwork-local-panel">
                    <div class="artwork-local-title">${artworkLabel(cat)}</div>
                    <div class="artwork-local-hint">${t('artworkLocalHint')}</div>
                    ${preview ? `<img class="artwork-local-preview" src="${preview}" />` : ''}
                    <div class="artwork-local-controls">
                        <button class="modal-btn secondary artwork-pick-btn" id="artworkPickLocalBtn" data-nav-right="#artworkClearLocalBtn" data-nav-down="#artworkSkipBtn">${t('artworkSelectImage')}</button>
                        ${preview ? `<button class="modal-btn artwork-clear-btn" id="artworkClearLocalBtn" aria-label="${t('artworkClearImage')}" data-nav-left="#artworkPickLocalBtn" data-nav-down="#artworkCancelBtn">X</button>` : ''}
                    </div>
                </div>`;
            overlay.querySelector('#artworkPickLocalBtn')?.addEventListener('click', () => {
                postToHost({
                    action: 'pickArtworkImage',
                    requestId,
                    category: cat.key,
                    dialogTitle: t('artworkSelectImage'),
                    dialogFilter: t('artworkImageFilter')
                });
            });
            overlay.querySelector('#artworkClearLocalBtn')?.addEventListener('click', () => {
                delete state.selected[cat.key];
                delete state.localPreview[cat.key];
                render();
            });
        };

        const renderSteamGrid = (cat) => {
            overlay.querySelector('.artwork-results').innerHTML = '';
            overlay.querySelector('.artwork-status').textContent = t('artworkSearching', state.query, artworkLabel(cat));
            state.focusResultsOnLoad = true;
            postToHost({ action: 'searchSteamGridArtwork', requestId, query: state.query, category: cat.key });
        };

        const render = () => {
            const cat = ARTWORK_CATEGORIES[state.index];
            renderSteps();
            const results = overlay.querySelector('.artwork-results');
            results.className = mode === 'local' ? 'artwork-results is-local' : `artwork-results is-${cat.key}`;
            overlay.querySelector('#artworkSearchInput').value = state.query;
            overlay.querySelector('.artwork-search-row').style.display = mode === 'steamgrid' ? 'grid' : 'none';
            overlay.querySelector('#artworkSkipBtn .artwork-skip-label').textContent = mode === 'local'
                ? t('artworkNext')
                : t('artworkSkip');
            overlay.querySelector('.artwork-status').textContent = `${artworkLabel(cat)}`;
            if (mode === 'local') renderLocal(cat);
            else renderSteamGrid(cat);
            if (mode === 'local') {
                const clearBtn = overlay.querySelector('#artworkClearLocalBtn');
                overlay.querySelector('#artworkSkipBtn')?.setAttribute('data-nav-up', '#artworkPickLocalBtn');
                overlay.querySelector('#artworkCancelBtn')?.setAttribute('data-nav-up', clearBtn ? '#artworkClearLocalBtn' : '#artworkPickLocalBtn');
            } else {
                overlay.querySelector('#artworkSkipBtn')?.removeAttribute('data-nav-up');
                overlay.querySelector('#artworkCancelBtn')?.removeAttribute('data-nav-up');
            }
        };

        overlay.querySelector('#artworkSearchBtn').addEventListener('click', () => {
            state.query = overlay.querySelector('#artworkSearchInput').value.trim() || state.query;
            render();
        });
        overlay.querySelector('#artworkSearchInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                overlay.querySelector('#artworkSearchBtn')?.click();
            }
        });
        overlay.querySelector('#artworkSkipBtn').addEventListener('click', next);
        overlay.querySelector('#artworkCancelBtn').addEventListener('click', close);
        overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
        overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

        state.renderResults = (category, images) => {
            if (!_artworkWizard || _artworkWizard.requestId !== requestId) return;
            const cat = ARTWORK_CATEGORIES[state.index];
            if (!cat || cat.key !== category) return;
            overlay.querySelector('.artwork-status').textContent = images.length
                ? t('artworkFound', images.length, state.query)
                : t('artworkNoneFound', state.query);
            overlay.querySelector('.artwork-results').innerHTML = images.map(url =>
                `<button class="artwork-choice ${cat.key}" type="button" data-url="${escapeHtml(url)}"><img src="${escapeHtml(url)}" loading="lazy" /></button>`
            ).join('');
            overlay.querySelectorAll('.artwork-choice').forEach(btn => {
                btn.addEventListener('click', () => {
                    state.selected[cat.key] = btn.dataset.url;
                    next();
                });
            });
            if (state.focusResultsOnLoad) {
                state.focusResultsOnLoad = false;
                requestAnimationFrame(() => {
                    const firstChoice = overlay.querySelector('.artwork-choice');
                    if (!firstChoice) {
                        overlay.querySelector('#artworkSearchInput')?.focus({ preventScroll: true });
                        return;
                    }
                    firstChoice.focus({ preventScroll: true });
                    firstChoice.scrollIntoView({
                        block: 'center',
                        inline: 'nearest'
                    });
                });
            }
        };

        state.pickLocal = (category, path, preview) => {
            if (!_artworkWizard || _artworkWizard.requestId !== requestId) return;
            state.selected[category] = path;
            state.localPreview[category] = preview;
            render();
        };

        state.applied = (images) => {
            const patch = _artworkPatchFromCategories(images || {});
            const channel = isMedia ? 'media' : 'games';
            window.AppStore?.mutations?.patchItem(channel, gameId, patch);
            close();
        };

        render();
        requestAnimationFrame(() => {
            const first = mode === 'steamgrid'
                ? overlay.querySelector('.artwork-results')
                : overlay.querySelector('#artworkPickLocalBtn');
            first?.focus?.();
        });
    }

    window._artworkWizardHandleResults = data => _artworkWizard?.renderResults?.(data.category, data.images || []);
    window._artworkWizardHandlePicked = data => _artworkWizard?.pickLocal?.(data.category, data.path, data.preview);
    window._artworkWizardHandleApplied = data => _artworkWizard?.applied?.(data.images || {});
    window._artworkWizardIsOpen = () => !!_artworkWizard?.overlay;
    window._artworkWizardShortcut = action => {
        if (!_artworkWizard?.overlay) return false;
        const overlay = _artworkWizard.overlay;
        if (action === 'search') {
            const input = overlay.querySelector('#artworkSearchInput');
            if (!input || input.offsetParent === null) return false;
            input.focus({ preventScroll: true });
            requestAnimationFrame(() => window._vkbOpen?.(input));
            return true;
        }
        if (action === 'skip') {
            overlay.querySelector('#artworkSkipBtn')?.click();
            return true;
        }
        if (action === 'cancel') {
            overlay.querySelector('#artworkCancelBtn')?.click();
            return true;
        }
        return false;
    };
    window._artworkWizardClose = () => {
        if (!_artworkWizard?.overlay) return false;
        _artworkWizard.overlay.remove();
        _artworkWizard = null;
        return true;
    };

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
                    <div class="edit-modal-field">
                        <label class="edit-modal-label">${t('artworkWizardTitle')}</label>
                        <div class="edit-artwork-actions">
                            <button class="edit-artwork-btn" id="editArtworkSteamGridBtn" type="button" tabindex="0">SteamGrid</button>
                            <button class="edit-artwork-btn" id="editArtworkLocalBtn" type="button" tabindex="0">${t('artworkChooseComputer')}</button>
                        </div>
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
                        <span class="edit-modal-input-hint">${typeof t === 'function' ? t('disableGamepadControlHint', 'Quando desligado, use L3 + R3 durante a sessão para ativar temporariamente.') : 'Quando desligado, use L3 + R3 durante a sessão para ativar temporariamente.'}</span>
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

        overlay.querySelector('#editArtworkSteamGridBtn')?.addEventListener('click', () => {
            openArtworkWizard(card, 'steamgrid', input.value.trim() || card.dataset.assetQuery || currentName);
        });

        overlay.querySelector('#editArtworkLocalBtn')?.addEventListener('click', () => {
            openArtworkWizard(card, 'local', input.value.trim() || card.dataset.assetQuery || currentName);
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
                const iconBase64 = card.dataset.iconBase64 || '';
                const newLogoSvg = window.generateFallbackSvg(newName, 'logo', iconBase64);
                const newGridSvg = window.generateFallbackSvg(newName, 'grid', iconBase64);
                const newHorizSvg = window.generateFallbackSvg(newName, 'horizontal', iconBase64);

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
    window._doorpiShouldOpenVkbFromEvent = (event) => {
        if (!event) return true;
        return Number(event.detail || 0) === 0;
    };

    const VKB = (() => {
        const ALPHA_ROWS = [
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', 'BKSP'],
            ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '´', 'ENTER'],
            ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç', '~', 'CANCEL'],
            ['SHIFT', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '^', '?'],
            ['SYM', 'CURSOR_LEFT', 'SPACE', 'CURSOR_RIGHT', '.com']
        ];
        const SPECIAL_ROWS = [
            ['!', '@', '#', '$', '%', '&', '*', '(', ')', '_', '+', 'BKSP'],
            ['/', '\\', '|', '=', '÷', '×', '{', '}', '[', ']', '`', 'ENTER'],
            [':', ';', '"', "'", '€', '£', '¥', '©', '®', '°', '¨', 'CANCEL'],
            ['SHIFT', '<', '>', '¿', '¡', '~', '´', '^', ',', '.', '?', '-'],
            ['ABC', 'CURSOR_LEFT', 'SPACE', 'CURSOR_RIGHT', '.com']
        ];
        const NUMERIC_ROWS = [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['BKSP', '0', 'ENTER'],
            ['CANCEL']
        ];
        const ACCENT_KEYS = new Set(['´', '~', '^', '`', '¨']);
        const CONTROLLER_HINTS = {
            BKSP: 'X',
            ENTER: 'START',
            CANCEL: 'B',
            SHIFT: 'L3',
            SYM: 'LT',
            ABC: 'LT',
            SPACE: 'Y',
            CURSOR_LEFT: 'LB',
            CURSOR_RIGHT: 'RB'
        };
        const KEY_UNITS = {
            BKSP: 2,
            ENTER: 2,
            CANCEL: 2,
            SHIFT: 2,
            SYM: 2,
            ABC: 2,
            SPACE: 7,
            CURSOR_LEFT: 1,
            CURSOR_RIGHT: 1,
            '.com': 2
        };

        let _el = null;
        let _callbacks = {};
        let _returnFocusEl = null;
        let _shifted = false;
        let _inputEl = null;
        let _cursorPos = 0;
        let _mode = 'text';
        let _pendingAccent = null;

        function _rowsForMode() {
            if (_mode === 'numeric') return NUMERIC_ROWS;
            return _mode === 'special' ? SPECIAL_ROWS : ALPHA_ROWS;
        }

        function _labelForKey(key) {
            switch (key) {
                case 'BKSP': return t('vkbBackspace');
                case 'ENTER': return t('vkbEnter');
                case 'CANCEL': return t('vkbClose');
                case 'SHIFT': return t('vkbShift');
                case 'SYM': return t('vkbSym');
                case 'ABC': return t('vkbAbc');
                case 'SPACE': return t('vkbSpace');
                case 'CURSOR_LEFT': return '←';
                case 'CURSOR_RIGHT': return '→';
                default:
                    if (_mode === 'text' && key.length === 1 && /[a-zç]/i.test(key)) {
                        return _shifted ? key.toLocaleUpperCase() : key.toLocaleLowerCase();
                    }
                    return key;
            }
        }

        function _buttonHtml(key, row, col) {
            const label = _labelForKey(key);
            const hint = CONTROLLER_HINTS[key] || '';
            const isAction = !!hint || ['BKSP', 'ENTER', 'CANCEL', 'SHIFT', 'SYM', 'ABC', 'SPACE', 'CURSOR_LEFT', 'CURSOR_RIGHT'].includes(key);
            const classes = ['vkb-key'];
            if (isAction) classes.push('action');
            if (key === 'SPACE') classes.push('space-key');
            if (key === _pendingAccent) classes.push('accent-pending');
            if (key === 'SHIFT' && _shifted) classes.push('shifted');
            return `<button class="${classes.join(' ')}" data-key="${_esc(key)}" data-row="${row}" data-col="${col}" style="--vkb-unit:${KEY_UNITS[key] || 1}" tabindex="0">
                <span class="vkb-key-label">${_esc(label)}</span>
                ${hint ? `<span class="vkb-pad-icon ${hint === 'START' ? 'start' : ''}">${_esc(hint)}</span>` : ''}
            </button>`;
        }

        function _build() {
            if (_el) return;
            _el = document.createElement('div');
            _el.className = 'vkb-overlay';
            _el.innerHTML = `
                <div class="vkb-preview-wrap">
                    <span class="vkb-preview-label">${t('vkbPreviewLabel')}</span>
                    <div class="vkb-preview-text" id="vkbPreview"></div>
                </div>
                <div class="vkb-grid"></div>
            `;
            document.body.appendChild(_el);
        }

        function _wireKeys() {
            _el?.querySelectorAll('.vkb-key').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    _pressKey(btn.dataset.key);
                });
            });
        }

        function _renderKeys(mode, preferredFocusKey = '') {
            if (!_el) return;
            _mode = mode === 'numeric' ? 'numeric' : mode === 'special' ? 'special' : 'text';
            _el.classList.toggle('numeric', _mode === 'numeric');
            _el.classList.toggle('special', _mode === 'special');
            const grid = _el.querySelector('.vkb-grid');
            if (!grid) return;

            const rows = _rowsForMode();
            grid.innerHTML = rows.map((row, r) =>
                `<div class="vkb-row">${row.map((key, c) => _buttonHtml(key, r, c)).join('')}</div>`
            ).join('');
            _wireKeys();
            _setShiftVisual(_shifted, false);
            _syncAccentVisual();

            const focusKey = preferredFocusKey || (_mode === 'numeric' ? '1' : rows[0][0]);
            requestAnimationFrame(() => {
                _el?.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.focus();
                _positionOverlay();
            });
        }

        function _syncCursorToInput() {
            if (!_inputEl) return;
            try { _inputEl.setSelectionRange(_cursorPos, _cursorPos); } catch (_) { }
        }

        function _dispatchInputChange() {
            if (!_inputEl) return;
            _inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            _inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function _insertText(text) {
            if (!_inputEl || text == null) return;
            const val = _inputEl.value || '';
            const maxLen = Number.parseInt(_inputEl.getAttribute('maxlength') || '', 10);
            if (Number.isFinite(maxLen) && maxLen > 0 && val.length + text.length > maxLen) return;
            _inputEl.value = val.substring(0, _cursorPos) + text + val.substring(_cursorPos);
            _cursorPos += text.length;
            _syncCursorToInput();
            _dispatchInputChange();
        }

        function _deleteText() {
            if (!_inputEl) return;
            if (_pendingAccent) {
                _pendingAccent = null;
                _syncAccentVisual();
                _renderPreview();
                return;
            }
            if (_cursorPos <= 0) return;
            const val = _inputEl.value || '';
            _inputEl.value = val.substring(0, _cursorPos - 1) + val.substring(_cursorPos);
            _cursorPos--;
            _syncCursorToInput();
            _dispatchInputChange();
        }

        function _getAccentedCharacter(accent, letter) {
            if (!letter || letter.length !== 1) return null;
            const upper = letter === letter.toLocaleUpperCase() && letter !== letter.toLocaleLowerCase();
            const base = letter.toLocaleLowerCase();
            const map = {
                '´': { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', c: 'ç' },
                '~': { a: 'ã', o: 'õ', n: 'ñ' },
                '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û' },
                '`': { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' },
                '¨': { a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü', y: 'ÿ' }
            };
            const result = map[accent]?.[base];
            return result ? (upper ? result.toLocaleUpperCase() : result) : null;
        }

        function _flushPendingAccent() {
            if (!_pendingAccent) return;
            const accent = _pendingAccent;
            _pendingAccent = null;
            _insertText(accent);
            _syncAccentVisual();
        }

        function _syncAccentVisual() {
            _el?.querySelectorAll('.vkb-key').forEach(btn => {
                btn.classList.toggle('accent-pending', !!_pendingAccent && btn.dataset.key === _pendingAccent);
            });
        }

        function _inputCharacter(raw) {
            if (!_inputEl || raw == null) return;
            let value = raw;
            if (_mode === 'numeric' && !/^\d$/.test(value)) return;
            if (_mode === 'text' && value.length === 1 && /[a-zç]/i.test(value)) {
                value = _shifted ? value.toLocaleUpperCase() : value.toLocaleLowerCase();
            }

            if (_pendingAccent) {
                const composed = value.length === 1 ? _getAccentedCharacter(_pendingAccent, value) : null;
                if (composed) _insertText(composed);
                else {
                    const accent = _pendingAccent;
                    _pendingAccent = null;
                    _insertText(accent);
                    _insertText(value);
                }
                _pendingAccent = null;
                _syncAccentVisual();
            } else {
                _insertText(value);
            }
        }

        function _pressKey(key) {
            if (!_inputEl || !key) return;
            if (_mode === 'numeric' && !/^\d$/.test(key) && !['BKSP', 'ENTER', 'CANCEL'].includes(key)) return;

            if (ACCENT_KEYS.has(key)) {
                if (_pendingAccent === key) {
                    _insertText(key);
                    _pendingAccent = null;
                } else {
                    _pendingAccent = key;
                }
                _syncAccentVisual();
                _renderPreview();
                return;
            }

            if (key === 'BKSP') _deleteText();
            else if (key === 'SHIFT') { _setShiftVisual(!_shifted); return; }
            else if (key === 'SYM') { _renderKeys('special', '!'); _renderPreview(); return; }
            else if (key === 'ABC') { _renderKeys('text', 'q'); _renderPreview(); return; }
            else if (key === 'CURSOR_LEFT') { _flushPendingAccent(); _moveCursor(-1); return; }
            else if (key === 'CURSOR_RIGHT') { _flushPendingAccent(); _moveCursor(1); return; }
            else if (key === 'SPACE') {
                if (_pendingAccent) _flushPendingAccent();
                else _insertText(' ');
            }
            else if (key === 'ENTER') { _submitEnter(); return; }
            else if (key === 'CANCEL') { _pendingAccent = null; _cancelWithCallback(); return; }
            else _inputCharacter(key);

            _renderPreview();
        }

        function _renderPreview() {
            const el = document.getElementById('vkbPreview');
            if (!el || !_inputEl) return;
            const val = _inputEl.value || '';
            const previewVal = _inputEl.type === 'password' ? '*'.repeat(val.length) : val;
            const formatHtml = (text) => _esc(text).replace(/ /g, '&nbsp;');
            const left = previewVal.substring(0, _cursorPos);
            const right = previewVal.substring(_cursorPos);
            const accent = _pendingAccent ? `<span class="vkb-pending-accent">${_esc(_pendingAccent)}</span>` : '';
            el.innerHTML = `${formatHtml(left)}<span class="vkb-cursor"></span>${formatHtml(right)}${accent}`;
        }

        function _moveCursor(dir) {
            if (!_inputEl) return;
            _flushPendingAccent();
            const newPos = _cursorPos + dir;
            if (newPos >= 0 && newPos <= (_inputEl.value || '').length) _cursorPos = newPos;
            _syncCursorToInput();
            _renderPreview();
        }

        function _setShiftVisual(on, rerender = true) {
            _shifted = !!on;
            _el?.querySelector('[data-key="SHIFT"]')?.classList.toggle('shifted', _shifted);
            _el?.querySelectorAll('.vkb-key').forEach(k => {
                const key = k.dataset.key;
                const label = k.querySelector('.vkb-key-label');
                if (label && key && _mode === 'text' && key.length === 1 && /[a-zç]/i.test(key)) {
                    label.textContent = _shifted ? key.toLocaleUpperCase() : key.toLocaleLowerCase();
                }
            });
            if (rerender) _renderPreview();
        }

        function _positionOverlay() {
            if (!_el || !_inputEl || _el.style.display === 'none') return;
            const rect = _inputEl.getBoundingClientRect();
            const margin = 14;
            const numeric = _mode === 'numeric';
            const width = numeric
                ? Math.min(360, Math.max(280, window.innerWidth - 32))
                : Math.min(window.innerWidth - 32, Math.max(620, Math.min(1080, window.innerWidth * 0.72)));
            _el.style.width = `${Math.round(width)}px`;
            const measured = _el.getBoundingClientRect();
            const height = measured.height || 300;
            const center = Math.max(16 + width / 2, Math.min(window.innerWidth - 16 - width / 2, rect.left + rect.width / 2));
            const above = rect.top - height - margin;
            const below = rect.bottom + margin;
            const forceBelow = _callbacks.placement === 'below';
            const top = forceBelow
                ? Math.min(Math.max(12, below), Math.max(12, window.innerHeight - height - 12))
                : (above >= 12 ? above : Math.min(Math.max(12, below), Math.max(12, window.innerHeight - height - 12)));
            _el.style.left = `${Math.round(center)}px`;
            _el.style.top = `${Math.round(top)}px`;
        }

        function _open(targetInput, callbacks = {}) {
            if (_inputEl && _inputEl !== targetInput) _inputEl.classList.remove('vkb-active');
            _callbacks = callbacks || {};
            _returnFocusEl = targetInput?._doorpiVkbReturnFocus || targetInput || document.activeElement;
            _inputEl = targetInput || document.getElementById('editNameInput');
            if (!_inputEl) return;

            _pendingAccent = null;
            _build();
            _renderKeys(_callbacks.mode || (window._vkbIsNumericInput?.(_inputEl) ? 'numeric' : 'text'));
            _el.querySelector('.vkb-preview-label').textContent = t('vkbPreviewLabel');

            _cursorPos = _inputEl.selectionStart ?? (_inputEl.value || '').length;
            _cursorPos = Math.max(0, Math.min((_inputEl.value || '').length, _cursorPos));
            _inputEl.classList.add('vkb-active');
            if (typeof _editOverlay !== 'undefined' && _editOverlay) _editOverlay.classList.add('vkb-active');

            _el.style.display = 'block';
            _renderPreview();
            _syncCursorToInput();
            _positionOverlay();

            requestAnimationFrame(() => {
                _positionOverlay();
                _el.classList.add('visible');
                window._vkbIsOpen = true;
                _el.querySelector(`[data-key="${_mode === 'numeric' ? '1' : 'q'}"]`)?.focus();
            });
        }

        function _forceClose() {
            if (!_el) return;
            _callbacks = {};
            _pendingAccent = null;
            window._vkbIsOpen = false;
            _el.classList.remove('visible');

            if (_inputEl) { _inputEl.classList.remove('vkb-active'); _inputEl = null; }
            if (typeof _editOverlay !== 'undefined' && _editOverlay) _editOverlay.classList.remove('vkb-active');

            const returnTo = _returnFocusEl;
            _returnFocusEl = null;
            setTimeout(() => { returnTo?.focus?.(); window.updateNavHint?.(); }, 180);
            setTimeout(() => { if (_el && !_el.classList.contains('visible')) _el.style.display = 'none'; }, 180);
        }

        function _cancelWithCallback() {
            const fn = _callbacks.onCancel ?? window._editModalClose;
            _forceClose();
            fn?.();
        }

        function _submitEnter() {
            _flushPendingAccent();
            if (window._doorpiVkbConfirmOverride?.()) {
                _renderPreview();
                return;
            }
            const fn = _callbacks.onEnter ?? _callbacks.onOk ?? window._editModalSave;
            if (fn) {
                if (!_callbacks.keepOpenOnEnter) _forceClose();
                fn();
                if (_callbacks.keepOpenOnEnter) _renderPreview();
                return;
            }
            if (!_inputEl) return;
            const down = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' });
            _inputEl.dispatchEvent(down);
            _inputEl.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter' }));
            _forceClose();
        }

        function _physicalKey(key) {
            if (!_inputEl) return;
            if (key === 'Backspace') _pressKey('BKSP');
            else if (key === 'Enter') _pressKey('ENTER');
            else if (key === ' ') _pressKey('SPACE');
            else if (key?.length === 1) _inputCharacter(key);
            _renderPreview();
        }

        function _toggleLayer() {
            _pressKey(_mode === 'special' ? 'ABC' : 'SYM');
        }

        window.addEventListener('resize', () => {
            if (window._vkbIsOpen) _positionOverlay();
        });

        return {
            open: _open,
            forceClose: _forceClose,
            cancel: _forceClose,
            physicalKey: _physicalKey,
            confirm: () => _pressKey('ENTER'),
            toggleShift: () => _setShiftVisual(!_shifted),
            toggleLayer: _toggleLayer,
            moveCursor: _moveCursor
        };
    })();

    const _TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'password', 'url', 'tel', '']);
    const _NUMERIC_INPUT_TYPES = new Set(['number']);
    window._vkbIsNumericInput = (el) => {
        if (!el || el.tagName !== 'INPUT') return false;
        const type = (el.type || '').toLowerCase();
        const inputMode = (el.getAttribute('inputmode') || '').toLowerCase();
        return _NUMERIC_INPUT_TYPES.has(type)
            || inputMode === 'numeric'
            || inputMode === 'decimal'
            || el.dataset?.vkbMode === 'numeric';
    };
    window._vkbOpen = (el, callbacks) => {
        if (el && el.tagName === 'INPUT') {
            const type = (el.type || '').toLowerCase();
            if (!_TEXT_INPUT_TYPES.has(type) && !window._vkbIsNumericInput(el)) return;
        }
        const opts = { ...((callbacks || el?._doorpiVkbCallbacks) || {}) };
        if (!opts.mode && window._vkbIsNumericInput(el)) opts.mode = 'numeric';
        VKB.open(el, opts);
    };
    window._vkbCancel = () => VKB.cancel();
    window._vkbConfirm = () => {
        if (window._doorpiVkbConfirmOverride?.()) return;
        VKB.confirm();
    };
    window._vkbForceClose = () => VKB.forceClose();
    window._vkbPhysicalKey = (k) => VKB.physicalKey(k);
    window._vkbToggleShift = () => VKB.toggleShift();
    window._vkbToggleLayer = () => VKB.toggleLayer();
    window._vkbMoveCursor = (dir) => VKB.moveCursor(dir);
    window._vkbClearFocus = () => {
        const el = document.activeElement;
        if (el && el.classList.contains('vkb-key')) el.blur();
    };
    window._vkbHasFocus = () => {
        const el = document.activeElement;
        return el && el.classList.contains('vkb-key');
    };

    const _tryOpenNumericVkb = (target, event = null) => {
        if (event && !window._doorpiShouldOpenVkbFromEvent?.(event)) return;
        const input = target?.closest?.('input');
        if (!input || !window._vkbIsNumericInput?.(input)) return;
        if (input.closest?.('.vkb-overlay')) return;
        if (window._vkbIsOpen) return;
        input.removeAttribute('readonly');
        window._vkbOpen?.(input, { mode: 'numeric' });
    };
    document.addEventListener('click', (e) => _tryOpenNumericVkb(e.target, e), true);

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

            if (isOverlayOpen) {
                hint.classList.remove('visible');
                return;
            }
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
            mark: typeof t === 'function' ? t('sessionTransitionMark') : 'Sessão',
            title: typeof t === 'function' ? t('sessionSwitchTitle') : 'Trocando sessão',
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

        const btnBrowser = document.getElementById('btnWebAppBrowser');
        if (btnBrowser) {
            const freshBtn = btnBrowser.cloneNode(true);
            btnBrowser.replaceWith(freshBtn);

            freshBtn.addEventListener('click', () => {
                postToHost({ action: 'openWebAppBrowserCapture' });
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
            fresh.addEventListener('click', (event) => {
                if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
                if (!window._vkbIsOpen) window._vkbOpen?.(fresh);
            });

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
            window.setInlineScanStatus?.(true, t('inlineScanWaitingWindows'));
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
            ).map(el => ({ Name: el.dataset.name, Path: el.dataset.path, LaunchUrl: el.dataset.launch, IconBase64: el.dataset.iconBase64 || '' }));

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
                 data-name="${name.replace(/"/g, '&quot;')}" data-icon-base64="${icon || ''}">
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
                <button id="executionLockRestore" class="lock-action" tabindex="0">${t('executionLockRestore')}</button>
                <button id="executionLockClose" class="lock-action danger" tabindex="0">${t('executionLockCloseProcess')}</button>
            `;

            const consumeGpuUpdaterReturnClick = event => {
                const isGpuUpdaterLock = window._lastExecutionLockData?.kind === 'gpuUpdater';
                if (!isGpuUpdaterLock || !event.isTrusted ||
                    Date.now() >= (window._gpuUpdaterPointerGuardUntil || 0)) return false;

                event.preventDefault();
                event.stopImmediatePropagation();
                return true;
            };

            lockActions.querySelector('#executionLockRestore')?.addEventListener('click', event => {
                if (consumeGpuUpdaterReturnClick(event)) return;
                postToHost({ action: 'restoreExecutionLock' });
            });
            lockActions.querySelector('#executionLockClose')?.addEventListener('click', event => {
                if (consumeGpuUpdaterReturnClick(event)) return;
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
            roleEl.textContent = role === 'game' ? t('pairRoleGame') : t('pairRoleStore');

            const name = document.createElement('div');
            name.className = 'pair-name';
            name.textContent = visual?.name || (role === 'game' ? t('genericGameName') : t('genericStoreName'));

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

        function showGpuRestarting(data = {}) {
            if (overlay._waitTimer) {
                clearTimeout(overlay._waitTimer);
                overlay._waitTimer = 0;
            }
            clearExecutionLockFocusTimers();
            clearSessionPair();
            overlay.classList.remove('execution-lock-visible', 'store-transition-visible', 'store-install-lock');
            overlay.dataset.executionLockKey = '';

            nameEl.textContent = data.name || '';
            statusEl.textContent = t('gpuUpdaterRestarting');
            if (bg) bg.style.backgroundImage = data.imageUrl ? `url('${data.imageUrl}')` : 'none';
            setArt(data.imageUrl || '');
            setState('loading');

            cancelBtn.style.display = 'none';
            cancelBtn.style.opacity = '0';
            overlay.style.pointerEvents = 'all';
            overlay.style.zIndex = '30000';
            overlay.classList.add('visible');
        }

        function setRunning(message = '') {
            const text = getI18n();
            const el = document.getElementById('overlayRunningText');
            if (el) el.textContent = message || text.running;


            const cancelBtn = document.getElementById('overlayCancelLaunchBtn');
            if (cancelBtn) {
                cancelBtn.style.opacity = '0';
                setTimeout(() => { cancelBtn.style.display = 'none'; }, 300);
            }

            setState('running');
        }

        function setLaunchStatus(stage, message) {
            if (!overlay.classList.contains('visible')) return;
            if (overlay._waitTimer) {
                clearTimeout(overlay._waitTimer);
                overlay._waitTimer = 0;
            }

            if (stage === 'running') {
                setRunning(message);
                return;
            }

            setState('loading');
            statusEl.textContent = message || (stage === 'findingWindow' ? 'Procurando janela...' : getI18n().opening);
            cancelBtn.style.display = 'none';
            cancelBtn.style.opacity = '0';
        }

        function setError(gameName, reason) {
            const text = getI18n();
            if (overlay._waitTimer) clearTimeout(overlay._waitTimer);
            cancelBtn.style.display = 'none';
            overlay.classList.remove('execution-lock-visible');
            overlay.style.zIndex = '';
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
                data.kind === 'game' || data.channel === 'games' ? t('runningGameName') :
                    data.kind === 'storeInstall' || data.appType === 'storeInstall' ? t('storeInstallRunning') :
                    data.kind === 'store' || data.channel === 'stores' ? t('runningStoreName') :
                        t('runningSessionName');
            const name = data.name || data.gameName || fallbackName;
            const hasContext = name || data.id || data.url;
            if (!hasContext || Date.now() < (window._doorpiOfficialReturnSuppressUntil || 0)) {
                hide();
                return;
            }

            const isStoreInstallLock = data.kind === 'storeInstall' || data.appType === 'storeInstall';
            const isGpuUpdaterLock = data.kind === 'gpuUpdater' || data.appType === 'gpuUpdater';
            const nextContextKey = `${data.kind || ''}|${data.channel || ''}|${data.id || ''}|${data.url || ''}`;
            const currentContextKey = overlay.dataset.executionLockKey || '';
            const isAlreadyVisible =
                overlay.classList.contains('visible') &&
                overlay.classList.contains('execution-lock-visible');
            const isSameContextVisible = isAlreadyVisible && currentContextKey === nextContextKey;
            const shouldPreserveFocus = isSameContextVisible;
            overlay.dataset.executionLockKey = nextContextKey;

            nameEl.textContent = name;
            statusEl.textContent = t('executionLockStatusRunning');
            overlay.classList.toggle('store-install-lock', isStoreInstallLock);
            overlay.classList.toggle('gpu-updater-lock', isGpuUpdaterLock);
            const closeAction = document.getElementById('executionLockClose');
            if (closeAction) {
                closeAction.textContent = isStoreInstallLock
                    ? t('executionLockCancelInstall')
                    : t('executionLockCloseProcess');
            }
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
            overlay.style.zIndex = '30000';
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

        function focusExecutionLockActions() {
            if (!overlay.classList.contains('visible') ||
                !overlay.classList.contains('execution-lock-visible')) return false;

            clearExecutionLockFocusTimers();
            const primary = document.getElementById('executionLockRestore');
            if (!primary || primary.offsetWidth <= 0 || primary.offsetHeight <= 0) return false;
            requestAnimationFrame(() => requestAnimationFrame(() => primary.focus()));
            return true;
        }

        function hideExecutionLock() {
            clearExecutionLockFocusTimers();
            overlay.classList.remove('execution-lock-visible');
            overlay.style.zIndex = '';
            overlay.classList.remove('store-install-lock');
            overlay.classList.remove('gpu-updater-lock');
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
            overlay.style.zIndex = '';
            overlay.classList.remove('store-install-lock');
            overlay.classList.remove('gpu-updater-lock');
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

        return { show, showStoreTransition, showGpuRestarting, setRunning, setLaunchStatus, setError, hide, showExecutionLock, focusExecutionLockActions, hideExecutionLock };
    })();


    setTimeout(() => {
        postToHost({ action: 'requestExtensionUpdates' });
    }, 1500);
