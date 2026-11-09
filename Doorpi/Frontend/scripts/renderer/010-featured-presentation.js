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
    const libraryTitle = document.getElementById('homeLibraryTitle');
    const libraryPosition = document.getElementById('homeLibraryPosition');
    const playtime = document.getElementById('homeFeaturePlaytime');
    const playtimeValue = document.getElementById('homeFeaturePlaytimeValue');
    const lastSession = document.getElementById('homeFeatureLastSession');
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
    stage.classList.toggle('has-logo', !!logoSrc);
    stage.classList.toggle('uses-contained-art', !horizontalArt && !!artSrc);
    _doorpiSetFeatureArt(art, artSrc);
    _doorpiSetFeatureBanner(banner, bannerSrc);

    if (logoSrc) {
        logo.onload = () => logo.classList.add('visible');
        logo.src = logoSrc;
        if (logo.complete && logo.naturalWidth > 0) logo.classList.add('visible');
    } else {
        logo.classList.remove('visible');
        logo.removeAttribute('src');
    }

    title.textContent = name;
    eyebrow.textContent = _doorpiHomeChannelLabel(channel);
    _doorpiRenderFeatureRuntime(card, stage, meta, action);

    const totalPlaytime = _doorpiFormatMinutes(card.dataset.totalPlaytimeMinutes);
    const sessionPlaytime = _doorpiFormatMinutes(card.dataset.lastSessionMinutes);
    const showPlaytime = channel === 'games';
    if (playtime && playtimeValue && lastSession) {
        playtime.hidden = !showPlaytime;
        playtimeValue.textContent = totalPlaytime ||
            (typeof t === 'function' ? t('homeNotPlayedYet') : 'Ainda não jogado');
        lastSession.textContent = sessionPlaytime
            ? `${typeof t === 'function' ? t('homeLastSessionLabel') : 'Última sessão'} · ${sessionPlaytime}`
            : '';
    }

    if (libraryTitle) libraryTitle.textContent = typeof t === 'function' ? t('homeLibraryTitle') : 'Sua biblioteca';
    const grid = card.closest('#gameGrid, #mediaGrid, #storesGrid');
    const cards = grid ? Array.from(grid.querySelectorAll('.card:not(.add-card):not(.loading-card)')) : [];
    const index = cards.indexOf(card);
    if (libraryPosition) libraryPosition.textContent = index >= 0 ? `${index + 1} / ${cards.length}` : '';
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

