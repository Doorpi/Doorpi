const CardInteraction = (() => {
    let heroTimer = null;
    let animTimer = null;
    let trailerTimer = null;
    let trailerPrepareTimer = null;
    let trailerExitTimer = null;
    let currentActiveCard = null;
    let preparedTrailerCard = null;
    let trailerPlayRequested = false;
    let youtubePlayer = null;
    let youtubeApiPromise = null;
    let trailerOwnsAudio = false;
    let trailerVolumeTimer = null;
    let youtubeRevealTimer = null;
    let trailerCinemaTimer = null;
    const cinemaConsumedKeys = new Set();
    const cinemaDirectionByKey = Object.freeze({
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
        ArrowUp: 'UP',
        ArrowDown: 'DOWN'
    });
    let youtubePlaybackStartedAt = 0;
    let youtubeCleanerReady = false;

    const DEFAULT_TRAILER_VOLUME = 34;
    const TRAILER_VOLUME_FADE_MS = 1400;
    const TRAILER_START_DELAY_MS = 4500;
    const TRAILER_CINEMA_DELAY_MS = 12000;
    const TRAILER_EXIT_FADE_MS = 580;
    const TRAILER_FULLSCREEN_STORAGE_KEY = 'doorpi.homeTrailerFullscreenEnabled';
    let trailerFullscreenEnabled = true;

    try {
        trailerFullscreenEnabled = localStorage.getItem(TRAILER_FULLSCREEN_STORAGE_KEY) !== 'false';
    } catch { }

    function syncTrailerFullscreenHint() {
        document.body.classList.toggle('home-trailer-fullscreen-disabled', !trailerFullscreenEnabled);
        const hint = document.getElementById('homeTrailerFullscreenHint');
        const label = document.getElementById('homeTrailerFullscreenHintLabel');
        if (!hint || !label) return;
        const key = trailerFullscreenEnabled
            ? 'homeTrailerDisableFullscreen'
            : 'homeTrailerEnableFullscreen';
        label.dataset.i18n = key;
        label.textContent = typeof t === 'function' ? t(key) :
            (trailerFullscreenEnabled ? 'Desativar tela cheia' : 'Ativar tela cheia');
        const visible = document.body.classList.contains('home-trailer-playing') &&
            (!trailerFullscreenEnabled || document.body.classList.contains('home-trailer-cinema'));
        hint.setAttribute('aria-hidden', String(!visible));
    }

    function setTrailerFullscreenEnabled(enabled, options = {}) {
        trailerFullscreenEnabled = enabled !== false;
        try {
            localStorage.setItem(TRAILER_FULLSCREEN_STORAGE_KEY, String(trailerFullscreenEnabled));
        } catch { }

        if (!trailerFullscreenEnabled) {
            leaveTrailerCinemaMode();
        } else if (options.enterNow !== false &&
                   document.body.classList.contains('home-trailer-playing')) {
            if (trailerCinemaTimer) {
                clearTimeout(trailerCinemaTimer);
                trailerCinemaTimer = null;
            }
            document.body.classList.add('home-trailer-cinema');
        }
        syncTrailerFullscreenHint();
    }

    function toggleTrailerFullscreen() {
        if (!document.body.classList.contains('home-trailer-playing')) return false;
        setTrailerFullscreenEnabled(!trailerFullscreenEnabled);
        return true;
    }

    window.toggleHomeTrailerFullscreen = toggleTrailerFullscreen;
    syncTrailerFullscreenHint();

    function trailerTargetVolume() {
        const configured = Number(window.DoorpiSoundSettings?.getInternalVolumes?.().trailer);
        return Number.isFinite(configured)
            ? Math.max(0, Math.min(100, configured))
            : DEFAULT_TRAILER_VOLUME;
    }

    window.addEventListener('message', event => {
        const frame = document.querySelector('#homeFeatureTrailerEmbed iframe');
        if (!frame || event.source !== frame.contentWindow) return;

        if (event.data?.type === 'doorpiTrailerCleanerReady') {
            youtubeCleanerReady = true;
            if (youtubePlayer && trailerPlayRequested &&
                youtubePlayer.getPlayerState?.() === window.YT?.PlayerState?.PLAYING) {
                scheduleYoutubeReveal(currentActiveCard, youtubePlayer);
            }
            return;
        }

    });

    function applyTrailerAspect(value) {
        const ratio = Number(value);
        if (!Number.isFinite(ratio) || ratio <= 0) return;
        const backdrop = document.getElementById('homeTrailerBackdrop');
        if (!backdrop) return;
        const isNarrow = ratio < 1.55;
        backdrop.style.setProperty('--home-trailer-aspect', String(ratio));
        backdrop.classList.toggle('is-narrow-video', isNarrow);
    }

    function resetTrailerAspect() {
        const backdrop = document.getElementById('homeTrailerBackdrop');
        backdrop?.classList.remove('is-narrow-video');
        backdrop?.style.removeProperty('--home-trailer-aspect');
    }

    function clearTrailerMediaTimers() {
        if (trailerVolumeTimer) {
            clearInterval(trailerVolumeTimer);
            trailerVolumeTimer = null;
        }
        if (youtubeRevealTimer) {
            clearTimeout(youtubeRevealTimer);
            youtubeRevealTimer = null;
        }
        if (trailerCinemaTimer) {
            clearTimeout(trailerCinemaTimer);
            trailerCinemaTimer = null;
        }
        youtubePlaybackStartedAt = 0;
    }

    function leaveTrailerCinemaMode() {
        if (trailerCinemaTimer) {
            clearTimeout(trailerCinemaTimer);
            trailerCinemaTimer = null;
        }
        document.body.classList.remove('home-trailer-cinema');
        syncTrailerFullscreenHint();
    }

    function scheduleTrailerCinemaMode() {
        if (trailerCinemaTimer) clearTimeout(trailerCinemaTimer);
        if (!trailerFullscreenEnabled) {
            trailerCinemaTimer = null;
            syncTrailerFullscreenHint();
            return;
        }
        trailerCinemaTimer = setTimeout(() => {
            trailerCinemaTimer = null;
            if (!document.body.classList.contains('home-trailer-playing') ||
                document.body.classList.contains('home-trailer-suspended') ||
                document.hidden || window._isExternalAppRunning ||
                !trailerFullscreenEnabled) return;
            document.body.classList.add('home-trailer-cinema');
            syncTrailerFullscreenHint();
        }, TRAILER_CINEMA_DELAY_MS);
    }

    function consumeCinemaWakeInput(event) {
        if (!event) return;
        if (event.cancelable) event.preventDefault();
        event.stopImmediatePropagation?.();
        event.stopPropagation?.();
    }

    function registerTrailerInteraction(event) {
        if (!document.body.classList.contains('home-trailer-playing')) return;
        const keyId = event?.type === 'keydown' ? (event.code || event.key || '') : '';
        if (event?.type === 'keydown' &&
            (keyId === 'KeyY' || event.key === 'y' || event.key === 'Y') &&
            toggleTrailerFullscreen()) {
            consumeCinemaWakeInput(event);
            return;
        }
        if (keyId && cinemaConsumedKeys.has(keyId)) {
            consumeCinemaWakeInput(event);
            return;
        }

        const wasCinemaActive = document.body.classList.contains('home-trailer-cinema');
        leaveTrailerCinemaMode();
        scheduleTrailerCinemaMode();
        if (!wasCinemaActive) return;

        if (keyId) cinemaConsumedKeys.add(keyId);
        consumeCinemaWakeInput(event);
    }

    function fadeTrailerVolume(setVolume, target = trailerTargetVolume(), duration = TRAILER_VOLUME_FADE_MS) {
        if (trailerVolumeTimer) clearInterval(trailerVolumeTimer);
        const startedAt = performance.now();
        setVolume(0);
        trailerVolumeTimer = setInterval(() => {
            const progress = Math.min(1, (performance.now() - startedAt) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            setVolume(target * eased);
            if (progress >= 1) {
                clearInterval(trailerVolumeTimer);
                trailerVolumeTimer = null;
            }
        }, 50);
    }

    function restoreDoorpiAudio() {
        if (!trailerOwnsAudio) return;
        trailerOwnsAudio = false;
        if (!window._isExternalAppRunning && document.hasFocus()) window._startSystemAudio?.(true);
    }

    function syncTrailerAudioOwnership(volume = trailerTargetVolume()) {
        const trailerIsVisible = document.body.classList.contains('home-trailer-playing');
        if (!trailerIsVisible || volume <= 0) {
            restoreDoorpiAudio();
            return;
        }

        if (trailerOwnsAudio) return;
        trailerOwnsAudio = true;
        if (window._audioPlayer?.pause) window._audioPlayer.pause(180);
        else window._stopSystemAudio?.();
    }

    function resetYoutubeHost() {
        const backdrop = document.getElementById('homeTrailerBackdrop');
        let host = document.getElementById('homeFeatureTrailerEmbed');
        if (host?.tagName === 'DIV') {
            host.replaceChildren();
            host.className = 'home-trailer-media home-trailer-embed';
            return host;
        }
        host?.remove();
        host = document.createElement('div');
        host.id = 'homeFeatureTrailerEmbed';
        host.className = 'home-trailer-media home-trailer-embed';
        backdrop?.appendChild(host);
        return host;
    }

    function disposeTrailerMedia(options = {}) {
        const video = document.getElementById('homeFeatureTrailer');
        const backgroundVideo = document.getElementById('homeFeatureTrailerBackground');

        if (video) {
            try { video.pause(); } catch { }
            video.classList.remove('is-active');
            video.muted = true;
            video.removeAttribute('src');
            video.load();
            video.onplaying = null;
            video.onended = null;
            video.onerror = null;
            video.onloadedmetadata = null;
        }

        if (backgroundVideo) {
            try { backgroundVideo.pause(); } catch { }
            backgroundVideo.removeAttribute('src');
            backgroundVideo.load();
        }

        try { youtubePlayer?.destroy?.(); } catch { }
        youtubePlayer = null;
        youtubeCleanerReady = false;
        resetYoutubeHost();
        resetTrailerAspect();
        if (options.resumeAudio !== false) restoreDoorpiAudio();
    }

    function stopTrailer(options = {}) {
        if (trailerTimer) {
            clearTimeout(trailerTimer);
            trailerTimer = null;
        }
        if (trailerPrepareTimer) {
            clearTimeout(trailerPrepareTimer);
            trailerPrepareTimer = null;
        }

        const stage = document.getElementById('homeFeatureStage');
        const shouldFade = options.fade === true &&
            document.body.classList.contains('home-trailer-playing') &&
            !document.body.classList.contains('home-trailer-suspended');

        clearTrailerMediaTimers();
        stage?.classList.remove('is-trailer-playing');
        document.body.classList.remove('home-trailer-playing');
        document.body.classList.remove('home-trailer-suspended');
        document.body.classList.remove('home-trailer-cinema');
        cinemaConsumedKeys.clear();
        syncTrailerFullscreenHint();
        preparedTrailerCard = null;
        trailerPlayRequested = false;

        if (trailerExitTimer) {
            clearTimeout(trailerExitTimer);
            trailerExitTimer = null;
        }

        if (shouldFade) {
            trailerExitTimer = setTimeout(() => {
                trailerExitTimer = null;
                disposeTrailerMedia(options);
            }, TRAILER_EXIT_FADE_MS);
            return;
        }

        disposeTrailerMedia(options);
    }

    function youtubeEmbedUrl(source) {
        try {
            const url = new URL(source);
            const host = url.hostname.toLowerCase().replace(/^www\./, '');
            let id = '';
            if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
            else if (host.endsWith('youtube.com')) {
                if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
                else if (/^\/(?:shorts|embed)\//.test(url.pathname)) id = url.pathname.split('/')[2] || '';
            }
            if (!/^[a-zA-Z0-9_-]{6,20}$/.test(id)) return '';
            return id;
        } catch { return ''; }
    }

    function activateTrailer(card, media) {
        const stage = document.getElementById('homeFeatureStage');
        const cardId = card.dataset.id || card.dataset.gameId || '';
        if (currentActiveCard !== card || !stage || stage.dataset.cardId !== cardId) return;
        media?.classList.add('is-active');
        stage.classList.add('is-trailer-playing');
        document.body.classList.remove('home-trailer-suspended');
        document.body.classList.add('home-trailer-playing');
        syncTrailerAudioOwnership();
        scheduleTrailerCinemaMode();
        syncTrailerFullscreenHint();
    }

    function suspendYoutubeTrailerSurface(player) {
        clearTrailerMediaTimers();
        leaveTrailerCinemaMode();
        if (!document.body.classList.contains('home-trailer-playing')) return;
        document.body.classList.add('home-trailer-suspended');
        document.body.classList.remove('home-trailer-playing');
        document.getElementById('homeFeatureStage')?.classList.remove('is-trailer-playing');
        syncTrailerFullscreenHint();
        try {
            player?.mute?.();
            player?.setVolume?.(0);
        } catch { }
    }

    function revealYoutubeTrailer(card, player) {
        if (!trailerPlayRequested || preparedTrailerCard !== card || currentActiveCard !== card || !player) return;
        const frame = player.getIframe?.();
        const wasVisible = document.body.classList.contains('home-trailer-playing');
        frame?.classList.add('home-trailer-media', 'home-trailer-embed');
        activateTrailer(card, frame || document.getElementById('homeFeatureTrailerEmbed'));
        try {
            player.unMute();
            if (wasVisible) {
                player.setVolume(trailerTargetVolume());
            } else {
                player.setVolume(0);
                fadeTrailerVolume(value => {
                    if (youtubePlayer === player) player.setVolume(value);
                });
            }
        } catch { }
    }

    window.setHomeTrailerVolume = value => {
        const safeVolume = Math.max(0, Math.min(100, Number(value) || 0));
        try {
            if (youtubePlayer && document.body.classList.contains('home-trailer-playing')) {
                youtubePlayer.setVolume(safeVolume);
            }
        } catch { }

        const video = document.getElementById('homeFeatureTrailer');
        if (video && !video.paused) video.volume = safeVolume / 100;
    };

    function scheduleYoutubeReveal(card, player) {
        if (!trailerPlayRequested || preparedTrailerCard !== card || currentActiveCard !== card) return;
        if (youtubeRevealTimer) clearTimeout(youtubeRevealTimer);
        const stableFor = youtubePlaybackStartedAt ? performance.now() - youtubePlaybackStartedAt : 0;
        const wait = Math.max(0, 180 - stableFor);
        youtubeRevealTimer = setTimeout(() => {
            youtubeRevealTimer = null;
            if (youtubePlayer !== player || player.getPlayerState?.() !== window.YT?.PlayerState?.PLAYING) return;
            revealYoutubeTrailer(card, player);
        }, wait);
    }

    function finishTrailerCycle(card, player = null) {
        if (preparedTrailerCard !== card || currentActiveCard !== card) return;
        clearTrailerMediaTimers();
        trailerPlayRequested = false;
        document.body.classList.remove('home-trailer-playing', 'home-trailer-suspended', 'home-trailer-cinema');
        cinemaConsumedKeys.clear();
        syncTrailerFullscreenHint();
        document.getElementById('homeFeatureStage')?.classList.remove('is-trailer-playing');

        if (player) {
            try {
                player.mute();
                player.setVolume(0);
                player.pauseVideo();
                player.seekTo(0, true);
            } catch { }
        } else {
            const video = document.getElementById('homeFeatureTrailer');
            const backgroundVideo = document.getElementById('homeFeatureTrailerBackground');
            if (video) {
                try { video.pause(); video.currentTime = 0; } catch { }
                video.muted = true;
                video.volume = 0;
            }
            if (backgroundVideo) {
                try { backgroundVideo.pause(); backgroundVideo.currentTime = 0; } catch { }
            }
        }

        restoreDoorpiAudio();
        if (trailerTimer) clearTimeout(trailerTimer);
        trailerTimer = setTimeout(() => {
            trailerTimer = null;
            if (preparedTrailerCard === card && currentActiveCard === card) playPreparedTrailer(card);
        }, 3000);
    }

    function ensureYoutubeApi() {
        if (window.YT?.Player) return Promise.resolve(window.YT);
        if (youtubeApiPromise) return youtubeApiPromise;
        youtubeApiPromise = new Promise((resolve, reject) => {
            const previousReady = window.onYouTubeIframeAPIReady;
            const timeout = setTimeout(() => reject(new Error('YouTube API timeout')), 12000);
            window.onYouTubeIframeAPIReady = () => {
                try { previousReady?.(); } catch { }
                clearTimeout(timeout);
                resolve(window.YT);
            };
            if (!document.querySelector('script[data-doorpi-youtube-api]')) {
                const script = document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                script.dataset.doorpiYoutubeApi = 'true';
                script.onerror = () => {
                    clearTimeout(timeout);
                    youtubeApiPromise = null;
                    reject(new Error('YouTube API unavailable'));
                };
                document.head.appendChild(script);
            }
        }).catch(error => {
            youtubeApiPromise = null;
            throw error;
        });
        return youtubeApiPromise;
    }

    function playPreparedTrailer(card) {
        if (preparedTrailerCard !== card || currentActiveCard !== card) return;
        if (document.hidden || window._isExternalAppRunning || document.querySelector('.edit-modal-overlay, .artwork-wizard-overlay')) return;
        trailerPlayRequested = true;

        if (youtubePlayer) {
            try {
                youtubePlayer.playVideo();
                if (youtubePlayer.getPlayerState?.() === window.YT?.PlayerState?.PLAYING) {
                    scheduleYoutubeReveal(card, youtubePlayer);
                }
            } catch { }
            return;
        }

        const video = document.getElementById('homeFeatureTrailer');
        const backgroundVideo = document.getElementById('homeFeatureTrailerBackground');
        if (!video?.src) return;
        video.volume = 0;
        video.muted = false;
        Promise.resolve(video.play()).catch(() => {
            if (preparedTrailerCard !== card) return;
            video.muted = true;
            return video.play().then(() => {
                setTimeout(() => { if (preparedTrailerCard === card) video.muted = false; }, 80);
            });
        }).catch(() => stopTrailer());
        if (backgroundVideo?.src) {
            try {
                backgroundVideo.currentTime = video.currentTime || 0;
                backgroundVideo.play();
            } catch { }
        }
    }

    function prepareTrailer(card) {
        if (currentActiveCard !== card || card.dataset.channel !== 'games') return;
        const source = (card.dataset.trailerSource || '').trim();
        if (!source) return;
        const isLocal = source.startsWith('https://data.local/');
        if (!isLocal && navigator.onLine === false) return;
        const youtubeId = youtubeEmbedUrl(source);
        if (youtubeId && window.__doorpiHomeTrailerExtensionReady !== true) return;

        const video = document.getElementById('homeFeatureTrailer');
        const embed = document.getElementById('homeFeatureTrailerEmbed');
        const backgroundVideo = document.getElementById('homeFeatureTrailerBackground');
        if (!video || !embed || !backgroundVideo) return;
        preparedTrailerCard = card;
        trailerPlayRequested = false;

        if (youtubeId) {
            youtubeCleanerReady = false;
            ensureYoutubeApi().then(YT => {
                if (preparedTrailerCard !== card || currentActiveCard !== card) return;
                youtubePlayer = new YT.Player(embed, {
                    videoId: youtubeId,
                    width: Math.max(1920, window.innerWidth),
                    height: Math.max(1080, Math.ceil(window.innerWidth * 9 / 16)),
                    playerVars: {
                        autoplay: 0,
                        controls: 0,
                        disablekb: 1,
                        fs: 0,
                        iv_load_policy: 3,
                        modestbranding: 1,
                        playsinline: 1,
                        rel: 0
                    },
                    events: {
                        onReady: event => {
                            if (preparedTrailerCard !== card) return;
                            try {
                                event.target.mute();
                                event.target.setVolume(0);
                                event.target.playVideo();
                            } catch { }
                        },
                        onStateChange: event => {
                            if (preparedTrailerCard !== card || currentActiveCard !== card) return;
                            if (event.data === YT.PlayerState.PLAYING) {
                                if (!youtubePlaybackStartedAt) youtubePlaybackStartedAt = performance.now();
                                scheduleYoutubeReveal(card, event.target);
                            } else if (event.data === YT.PlayerState.ENDED) {
                                finishTrailerCycle(card, event.target);
                            } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
                                suspendYoutubeTrailerSurface(event.target);
                            }
                        },
                        onError: () => stopTrailer()
                    }
                });
            }).catch(() => stopTrailer());
            return;
        }

        video.onplaying = () => {
            if (preparedTrailerCard !== card || currentActiveCard !== card) return;
            activateTrailer(card, video);
            video.muted = false;
            fadeTrailerVolume(value => {
                if (preparedTrailerCard === card) video.volume = Math.max(0, Math.min(1, value / 100));
            });
            try {
                backgroundVideo.currentTime = video.currentTime || 0;
                backgroundVideo.play();
            } catch { }
        };
        video.onended = () => {
            if (preparedTrailerCard === card && currentActiveCard === card) finishTrailerCycle(card);
        };
        video.onerror = () => stopTrailer();
        video.onloadedmetadata = () => {
            if (preparedTrailerCard !== card || !video.videoWidth || !video.videoHeight) return;
            applyTrailerAspect(video.videoWidth / video.videoHeight);
        };
        video.loop = false;
        video.muted = true;
        backgroundVideo.loop = false;
        backgroundVideo.muted = true;
        backgroundVideo.src = source;
        backgroundVideo.load();
        video.src = source;
        video.load();
    }

    function start(card) {
        window._stopBlobBg?.(); // ← NOVO: para blob imediatamente ao focar card

        const channel = card.dataset.channel;
        if (channel === 'media' && window.getCurrentHomeTab?.() !== 'media') return;
        if (channel === 'stores' && window.getCurrentHomeTab?.() !== 'stores') return;
        window.updateHomeFeatureStage?.(card, { animate: false });

        if (currentActiveCard && currentActiveCard !== card) {
            stop(currentActiveCard);
        }
        currentActiveCard = card;

        if (heroTimer) clearTimeout(heroTimer);
        if (animTimer) clearTimeout(animTimer);
        if (trailerTimer) clearTimeout(trailerTimer);
        if (trailerPrepareTimer) {
            clearTimeout(trailerPrepareTimer);
            trailerPrepareTimer = null;
        }

        const bgSrc = card.dataset.staticVertical || card.dataset.vertical;
        const heroSrc = channel === 'stores'
            ? (card.dataset.staticHero || card.dataset.hero || bgSrc)
            : (card.dataset.staticHero || card.dataset.hero
                || card.dataset.staticHorizontal || card.dataset.horizontal
                || bgSrc);

        // ← MUDANÇA: logoSrc removido — triggerAnimations assume controle total do logo
        const heroDelay = window._gpNavigating ? 120 : 60;
        const animDelay = window._gpNavigating ? 380 : 250;

        heroTimer = setTimeout(() => {
            if (currentActiveCard === card && typeof switchHeroBackground === 'function') {
                switchHeroBackground(bgSrc, null, heroSrc); // null = não setar logo aqui
                window.updateHomeFeatureStage?.(card);
            }
        }, heroDelay);

        animTimer = setTimeout(() => {
            if (currentActiveCard === card) {
                triggerAnimations(card);
            }
        }, animDelay);

        if (channel === 'games' && card.dataset.trailerSource) {
            const prepare = () => {
                trailerPrepareTimer = null;
                if (currentActiveCard === card) prepareTrailer(card);
            };
            if (trailerExitTimer)
                trailerPrepareTimer = setTimeout(prepare, TRAILER_EXIT_FADE_MS + 30);
            else
                prepare();
            trailerTimer = setTimeout(() => playPreparedTrailer(card), TRAILER_START_DELAY_MS);
        }
    }

    function stop(card) {
        if (currentActiveCard === card) {
            currentActiveCard = null;
            if (heroTimer) clearTimeout(heroTimer);
            if (animTimer) clearTimeout(animTimer);
            stopTrailer({ fade: true });
        }

        const img = card.querySelector('img');
        if (!img) return;

        const isFeatured = card.classList.contains('featured');
        const staticSrc = isFeatured
            ? _doorpiFeaturedCardSrc(card)
            : _doorpiRestingCardSrc(card);

        // Só reverte se o src atual já é diferente — evita flicker desnecessário
        if (staticSrc && img.src && !img.src.endsWith(staticSrc)) {
            img.src = staticSrc;
        }

        const stage = document.getElementById('homeFeatureStage');
        const cardId = card.dataset.id || card.dataset.gameId || card.dataset.appId || '';
        if (stage?.dataset.cardId === cardId) {
            window.updateHomeFeatureStage?.(card, { animate: false });
            const bgSrc = card.dataset.staticVertical || card.dataset.vertical || '';
            const heroSrc = card.dataset.staticHero || card.dataset.hero
                || card.dataset.staticHorizontal || card.dataset.horizontal
                || bgSrc;
            if (typeof switchHeroBackground === 'function') {
                switchHeroBackground(bgSrc, null, heroSrc);
            }
        }
    }

    window.stopHomeFeatureTrailer = stopTrailer;
    window.releaseHomeTrailerCinemaControllerKeys = direction => {
        const heldDirection = String(direction || '').toUpperCase();
        for (const key of cinemaConsumedKeys) {
            const keyDirection = cinemaDirectionByKey[key];
            if (keyDirection && keyDirection !== heldDirection)
                cinemaConsumedKeys.delete(key);
        }
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopTrailer(); });
    window.addEventListener('offline', stopTrailer);
    document.addEventListener('keydown', registerTrailerInteraction, true);
    document.addEventListener('keyup', event => {
        const key = event.code || event.key || '';
        const direction = cinemaDirectionByKey[key];
        if (direction && window.isDoorpiNativeDirectionHeld?.(direction)) return;
        cinemaConsumedKeys.delete(key);
    }, true);
    document.addEventListener('pointerdown', registerTrailerInteraction, true);
    document.addEventListener('wheel', registerTrailerInteraction, { capture: true, passive: false });
    document.addEventListener('touchstart', registerTrailerInteraction, { capture: true, passive: false });
    document.addEventListener('pointermove', event => {
        if (document.body.classList.contains('home-trailer-cinema')) registerTrailerInteraction(event);
    }, { capture: true, passive: false });

    function triggerAnimations(card) {
        const isFeatured = card.classList.contains('featured');

        const isStore = card.dataset.channel === 'stores';
        const animSrc = card.dataset.vertical;
        const staticSrc = isFeatured
            ? _doorpiFeaturedCardSrc(card)
            : _doorpiRestingCardSrc(card);

        if (animSrc && animSrc !== staticSrc) {
            const img = card.querySelector('img');
            if (img) safeLoadImage(img, animSrc, () => currentActiveCard === card);
        }

        // O foco do card vertical inicia também a arte horizontal da vitrine.
        window.updateHomeFeatureStage?.(card, { animate: true });

        const liveBgSrc = card.dataset.vertical || card.dataset.staticVertical || '';
        const liveHeroSrc = card.dataset.hero || card.dataset.staticHero
            || card.dataset.horizontal || card.dataset.staticHorizontal
            || liveBgSrc;
        if (typeof switchHeroBackground === 'function') {
            switchHeroBackground(liveBgSrc, null, liveHeroSrc);
        }

        // ← MUDANÇA: logo tratado aqui exclusivamente (sem concorrência com setImgSrc)
        // Usa animado se existir, senão usa estático — NUNCA há race condition
        const logoEl = document.getElementById('gameLogo');
        if (logoEl) {
            const logoToSet = card.dataset.logo || card.dataset.staticLogo;
            if (logoToSet) {
                safeLoadImage(logoEl, logoToSet, () => currentActiveCard === card, () => {
                    if (currentActiveCard === card) logoEl.classList.add('visible');
                });
            }
        }
    }

    // Versão estável — sem decode(), sem double rAF, sem off-thread.
    // Usa onload clássico: o browser carrega o arquivo completo antes de
    // aplicar, então GIF/APNG/WebP animado funcionam nativamente e sem piscar.
    function safeLoadImage(targetEl, src, isActiveFn, onComplete) {
        if (!src) return;

        if (targetEl.src && targetEl.src.endsWith(src)) {
            if (isActiveFn() && onComplete) onComplete();
            return;
        }

       
        targetEl.__req = Symbol();

        targetEl.onload = null;
        targetEl.onerror = null;

        targetEl.onload = function () {
            targetEl.onload = null;
            targetEl.onerror = null;
            if (!isActiveFn()) return;
            if (onComplete) onComplete();
        };

        targetEl.onerror = function () {
            targetEl.onload = null;
            targetEl.onerror = null;
            if (!isActiveFn()) return;
            if (onComplete) onComplete();
        };

        targetEl.src = src;
    }

    return { start, stop };
})();

