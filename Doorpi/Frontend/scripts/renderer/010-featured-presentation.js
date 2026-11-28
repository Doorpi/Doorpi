// =============================================================================
// renderer.js — Renderização Blindada contra Stuttering (Off-DOM Preloading)
// =============================================================================

// =============================================================================
// renderer.js — CardInteraction Definitivo (Decode via GPU Off-Thread)
// =============================================================================

function _doorpiFeaturedCardSrc(card) {
    return card?.dataset?.staticVertical
        || card?.dataset?.vertical
        || card?.dataset?.staticHorizontal
        || card?.dataset?.horizontal
        || '';
}

function _doorpiRestingCardSrc(card) {
    const canUseLiveAsStatic = card?.dataset?.isAnimated !== 'true';
    return card?.dataset?.staticVertical
        || (canUseLiveAsStatic ? card?.dataset?.vertical : '')
        || '';
}

let _doorpiFeatureArtRequest = 0;
let _doorpiFeatureBannerRequest = 0;
let _doorpiFeatureLogoRequest = 0;

window.clearHomeFeatureLogo = function () {
    ++_doorpiFeatureLogoRequest;
    const logo = document.getElementById('gameLogo');
    if (logo) {
        logo.classList.remove('visible');
        logo.removeAttribute('src');
        delete logo.dataset.owner;
    }
    document.getElementById('homeFeatureStage')?.classList.remove('has-logo');
};

function _doorpiSetFeatureLogo(logo, stage, card, source) {
    const request = ++_doorpiFeatureLogoRequest;
    const identity = `${card.dataset.channel || 'games'}:${stage.dataset.cardId}`;
    const profile = window._doorpiCurrentUserId;
    const current = () => request === _doorpiFeatureLogoRequest &&
        profile === window._doorpiCurrentUserId && logo.dataset.owner === identity;
    if (logo.dataset.owner !== identity || !source) {
        logo.classList.remove('visible');
        logo.removeAttribute('src');
        stage.classList.remove('has-logo');
    }
    logo.dataset.owner = identity;
    logo.onload = null;
    logo.onerror = null;
    if (!source) return;
    const reveal = src => {
        if (!current()) return;
        if (logo.getAttribute('src') !== src) logo.src = src;
        logo.classList.add('visible');
        stage.classList.add('has-logo');
    };
    if (logo.getAttribute('src') === source && logo.complete && logo.naturalWidth > 0) {
        reveal(source);
        return;
    }
    // Keep the current image while its animated version loads. Never let a failed
    // animated asset (or a response for another selection) erase a working logo.
    const load = (src, fallback) => {
        const image = new Image();
        image.onload = () => reveal(src);
        image.onerror = () => {
            if (!current()) return;
            if (fallback && fallback !== src) { load(fallback, ''); return; }
            if (!logo.getAttribute('src')) stage.classList.remove('has-logo');
        };
        image.src = src;
    };
    load(source, card.dataset.staticLogo || '');
}

function _doorpiHomeChannelLabel(channel) {
    if (channel === 'media') return typeof t === 'function' ? t('homeAppsEyebrow') : 'Aplicativo selecionado';
    if (channel === 'stores') return typeof t === 'function' ? t('homeStoresEyebrow') : 'Loja selecionada';
    return typeof t === 'function' ? t('homeGamesEyebrow') : 'Jogo selecionado';
}

function _doorpiHomeSourceLabel(card) {
    const source = String(card?.dataset?.source || card?.dataset?.appType || '').trim();
    const channel = String(card?.dataset?.channel || '').toLowerCase();
    const appType = String(card?.dataset?.appType || '').toLowerCase();
    const emulatorId = String(card?.dataset?.emulatorId || '').trim();
    const emulatorName = String(card?.dataset?.emulatorName || '').trim();
    const appId = String(card?.dataset?.id || card?.dataset?.appId || '').toLowerCase();
    const streamingAppIds = new Set([
        'youtube', 'netflix', 'twitch', 'kick', 'disneyplus',
        'primevideo', 'appletv', 'max', 'crunchyroll'
    ]);

    if (channel === 'games' && emulatorId) {
        if (emulatorName) return emulatorName;
        return emulatorId.split(/[-_\s]+/).filter(Boolean)
            .map(part => part.length <= 4
                ? part.toUpperCase()
                : part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ') || (typeof t === 'function' ? t('platformLabels.Emulador') : 'Emulador');
    }

    if (channel === 'media') {
        if (streamingAppIds.has(appId))
            return typeof t === 'function' ? t('homeSourceStreaming') : 'Streaming';
        if (appType === 'exe')
            return typeof t === 'function' ? t('homeSourceApplication') : 'Aplicativo';
        if (appType === 'browser' || appType === 'webview')
            return typeof t === 'function' ? t('homeSourceWebApp') : 'Aplicativo web';
    }

    const known = {
        steam: 'Steam',
        epic: 'Epic Games',
        gog: 'GOG',
        windows: 'Windows',
        folder: 'Windows',
        emulator: 'Emulador',
        web: typeof t === 'function' ? t('homeSourceWebApp') : 'Aplicativo web',
        browser: typeof t === 'function' ? t('homeSourceWebApp') : 'Aplicativo web',
        webview: typeof t === 'function' ? t('homeSourceWebApp') : 'Aplicativo web',
        exe: typeof t === 'function' ? t('homeSourceApplication') : 'Aplicativo',
        store: typeof t === 'function' ? t('homeSourceStore') : 'Loja'
    };
    return known[source.toLowerCase()] || source;
}

function _doorpiSetFeatureArt(target, src) {
    const stage = document.getElementById('homeFeatureStage');
    const requestId = ++_doorpiFeatureArtRequest;
    if (!target || !stage) return;

    if (!src) {
        target.removeAttribute('src');
        stage.classList.remove('has-art');
        return;
    }

    const current = target.getAttribute('src') || '';
    if (current === src || target.src?.endsWith(src)) {
        stage.classList.add('has-art');
        return;
    }

    stage.classList.add('is-changing');
    const preload = new Image();
    preload.onload = () => {
        if (requestId !== _doorpiFeatureArtRequest) return;
        target.src = src;
        stage.classList.add('has-art');
        requestAnimationFrame(() => stage.classList.remove('is-changing'));
    };
    preload.onerror = () => {
        if (requestId !== _doorpiFeatureArtRequest) return;
        target.removeAttribute('src');
        stage.classList.remove('has-art', 'is-changing');
    };
    preload.src = src;
}

function _doorpiSetFeatureBanner(target, src) {
    const stage = document.getElementById('homeFeatureStage');
    const requestId = ++_doorpiFeatureBannerRequest;
    if (!target || !stage) return;

    if (!src) {
        target.removeAttribute('src');
        stage.classList.remove('has-scene-art');
        return;
    }

    const current = target.getAttribute('src') || '';
    if (current === src || target.src?.endsWith(src)) {
        stage.classList.add('has-scene-art');
        return;
    }

    stage.classList.remove('has-scene-art');
    const preload = new Image();
    preload.onload = () => {
        if (requestId !== _doorpiFeatureBannerRequest) return;
        target.src = src;
        requestAnimationFrame(() => stage.classList.add('has-scene-art'));
    };
    preload.onerror = () => {
        if (requestId !== _doorpiFeatureBannerRequest) return;
        target.removeAttribute('src');
        stage.classList.remove('has-scene-art');
    };
    preload.src = src;
}

function _doorpiFormatMinutes(value) {
    const minutes = Math.max(0, Math.round(Number(value) || 0));
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return `${rest}min`;
    if (!rest) return `${hours}h`;
    return `${hours}h ${rest}min`;
}

function _doorpiRenderFeatureRuntime(card, stage, meta, action) {
    if (!card || !stage || !meta || !action) return;

    const channel = card.dataset.channel || 'games';
    const isRunning = card.classList.contains('is-running');
    const isNew = card.classList.contains('new-game');
    const isLocked = card.classList.contains('admin-locked');
    const source = _doorpiHomeSourceLabel(card);

    stage.classList.toggle('is-running', isRunning);
    action.textContent = isRunning
        ? (typeof t === 'function' ? t('resumeLabel') : 'Retomar')
        : (typeof t === 'function'
            ? t(channel === 'games' ? 'homePlayAction' : 'homeOpenAction')
            : (channel === 'games' ? 'Jogar' : 'Abrir'));

    meta.replaceChildren();
    [
        { value: source, className: 'is-source' },
        {
            value: isRunning ? (typeof t === 'function' ? t('runningLabel') : 'Em execução') : '',
            className: 'is-runtime'
        },
        { value: isNew ? (typeof t === 'function' ? t('badgeNew') : 'Novo') : '', className: 'is-new' },
        { value: isLocked ? 'Bloqueado' : '', className: 'is-locked' }
    ].filter(entry => entry.value).forEach(entry => {
        const chip = document.createElement('span');
        chip.className = entry.className;
        chip.textContent = entry.value;
        meta.appendChild(chip);
    });
}

window.updateHomeFeatureRuntimeState = function (card) {
    const stage = document.getElementById('homeFeatureStage');
    const meta = document.getElementById('homeFeatureMeta');
    const action = document.getElementById('homeFeatureActionLabel');
    if (!card || !stage || !meta || !action) return;

    const cardId = card.dataset.id || card.dataset.gameId || card.dataset.appId || '';
    if (!cardId || stage.dataset.cardId !== cardId) return;
    _doorpiRenderFeatureRuntime(card, stage, meta, action);
};

window.updateHomeFeatureActionAvailability = function () {
    const stage = document.getElementById('homeFeatureStage');
    if (!stage) return;
    const card = document.activeElement?.closest?.('#gameGrid .card, #mediaGrid .card, #storesGrid .card');
    const id = card?.dataset.id || card?.dataset.gameId || card?.dataset.appId || '';
    stage.classList.toggle('has-card-focus', !!id && id === stage.dataset.cardId &&
        !card.classList.contains('add-card') && !card.classList.contains('loading-card'));
};
document.addEventListener('focusin', () => window.updateHomeFeatureActionAvailability());
document.addEventListener('focusout', () => queueMicrotask(() => window.updateHomeFeatureActionAvailability()));

const homeTrophies = (() => {
    let profileId = '';
    let requestId = 0;
    let refreshTimer;
    let featuredCard = null;
    let byApp = new Map();
    let aliases = new Map();

    function render() {
        const indicator = document.getElementById('homeFeatureTrophies');
        if (!indicator) return;
        const data = featuredCard?.isConnected ? featuredCard.dataset : null;
        const steamId = Number(/^steam:\/\/(?:rungameid|run)\/(\d+)(?:\/|$)/i.exec(data?.launchUrl || '')?.[1]);
        const appId = steamId || aliases.get((data?.id || '').toLowerCase()) ||
            aliases.get((data?.path || '').toLowerCase());
        const progress = data && (data.channel || 'games') === 'games' && profileId ? byApp.get(appId) : null;
        const icon = progress && window.doorpiTrophyIcon?.(progress.earned === progress.total ? 'platinum' : 'cup');
        if (!icon) {
            indicator.hidden = true;
            return;
        }

        indicator.innerHTML = icon;
        indicator.append(`${progress.earned}/${progress.total}`);
        const label = typeof t === 'function'
            ? t('steam.progress', progress.earned, progress.total)
            : `${progress.earned}/${progress.total}`;
        const title = progress.earned === progress.total && typeof t === 'function'
            ? `${t('steam.platinumTitle')} · ${label}` : label;
        indicator.title = title;
        indicator.setAttribute('role', 'img');
        indicator.setAttribute('aria-label', title);
        indicator.hidden = false;
    }

    function refresh() {
        clearTimeout(refreshTimer);
        const id = ++requestId;
        if (!profileId) return;
        refreshTimer = setTimeout(() => postToHost({
            action: 'homeTrophyProgress', profileId, requestId: id
        }), 120);
    }

    return {
        setProfile(id) {
            if ((id || '').toLowerCase() === profileId.toLowerCase()) return;
            profileId = id || '';
            byApp.clear();
            aliases.clear();
            render();
            refresh();
        },
        onProgress(message) {
            if (message.requestId !== requestId || message.profileId.toLowerCase() !== profileId.toLowerCase()) return;
            byApp = new Map(message.progress.map(game => [game.appId, game]));
            aliases = new Map(Object.entries(message.libraryAliases).map(([key, appId]) => [key.toLowerCase(), appId]));
            render();
        },
        onChange(id) {
            if (profileId && id?.toLowerCase() === profileId.toLowerCase()) refresh();
        },
        setCard(card) {
            featuredCard = card;
            render();
        }
    };
})();
window.DoorpiHomeTrophies = homeTrophies;

window.updateHomeFeatureStage = function (card, options = {}) {
    if (!card || card.classList.contains('add-card') || card.classList.contains('loading-card')) return;

    const stage = document.getElementById('homeFeatureStage');
    const art = document.getElementById('homeFeatureArt');
    const banner = document.getElementById('homeFeatureBanner');
    const logo = document.getElementById('gameLogo');
    const title = document.getElementById('homeFeatureTitle');
    const eyebrow = document.getElementById('homeFeatureEyebrow');
    const meta = document.getElementById('homeFeatureMeta');
    const action = document.getElementById('homeFeatureActionLabel');
    const playtime = document.getElementById('homeFeaturePlaytime');
    const playtimeValue = document.getElementById('homeFeaturePlaytimeValue');
    if (!stage || !art || !logo || !title || !eyebrow || !meta || !action) return;

    const channel = card.dataset.channel || 'games';
    const name = card.querySelector('.title')?.textContent?.trim() || card.dataset.name || '';
    // O card vertical é o único gatilho. Depois do pequeno atraso controlado por
    // CardInteraction, todas as artes podem trocar juntas para sua versão animada.
    const animateArtwork = options.animate === true;
    const horizontalArt = animateArtwork
        ? (card.dataset.horizontal || card.dataset.staticHorizontal || '')
        : (card.dataset.staticHorizontal || card.dataset.horizontal || '');
    const heroArt = animateArtwork
        ? (card.dataset.hero || card.dataset.staticHero || '')
        : (card.dataset.staticHero || card.dataset.hero || '');
    const artSrc = horizontalArt
        || card.dataset.staticVertical || card.dataset.vertical
        || heroArt || '';
    const bannerSrc = heroArt || horizontalArt || '';
    const logoSrc = animateArtwork
        ? (card.dataset.logo || card.dataset.staticLogo || '')
        : (card.dataset.staticLogo || card.dataset.logo || '');
    stage.dataset.channel = channel;
    stage.dataset.cardId = card.dataset.id || card.dataset.gameId || card.dataset.appId || '';
    stage.classList.toggle('uses-contained-art', !horizontalArt && !!artSrc);
    _doorpiSetFeatureArt(art, artSrc);
    _doorpiSetFeatureBanner(banner, bannerSrc);

    _doorpiSetFeatureLogo(logo, stage, card, logoSrc);

    title.textContent = name;
    eyebrow.textContent = _doorpiHomeChannelLabel(channel);
    _doorpiRenderFeatureRuntime(card, stage, meta, action);

    const totalPlaytime = _doorpiFormatMinutes(card.dataset.totalPlaytimeMinutes);
    const showPlaytime = channel === 'games';
    if (playtime && playtimeValue) {
        playtime.hidden = !showPlaytime;
        playtimeValue.textContent = totalPlaytime ||
            (typeof t === 'function' ? t('homeNotPlayedYet') : 'Ainda não jogado');
    }
    homeTrophies.setCard(channel === 'games' ? card : null);

    window.updateHomeFeatureActionAvailability();
};

function _doorpiSetCardImage(card, src) {
    const img = card?.querySelector?.('img');
    if (!img || !src) return;

    const currentAttr = img.getAttribute('src') || '';
    const currentSrc = img.src || '';
    if (currentAttr === src || currentSrc.endsWith(src)) return;

    img.style.display = '';
    img.src = src;
}

function _doorpiSyncFeaturedCardArt(root = document) {
    const grids = root?.matches?.('#gameGrid, #mediaGrid')
        ? [root]
        : Array.from(root?.querySelectorAll?.('#gameGrid, #mediaGrid') || []);

    grids.forEach(grid => {
        grid.querySelectorAll('.card:not(.add-card):not(.loading-card)').forEach(card => {
            const src = card.classList.contains('featured')
                ? _doorpiFeaturedCardSrc(card)
                : _doorpiRestingCardSrc(card);
            _doorpiSetCardImage(card, src);
        });
    });
}

window.syncFeaturedCardArt = _doorpiSyncFeaturedCardArt;

