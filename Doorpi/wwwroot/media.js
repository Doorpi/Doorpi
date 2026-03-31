// =============================================================================
// media.js — Apps nativos de mídia · System Loading · Carrossel de mídia
// Toda lógica de card espelha createGameCard do app.js
// =============================================================================

const NATIVE_APPS = [
    { id: 'youtube', name: 'YouTube', sgdbQuery: 'YouTube (Website)', url: 'https://www.youtube.com/tv', type: 'webview', multiUser: true },
    { id: 'netflix', name: 'Netflix', sgdbQuery: 'Netflix (Website)', url: 'https://www.netflix.com', type: 'browser', multiUser: true },
    { id: 'twitch', name: 'Twitch', sgdbQuery: 'Twitch (Website)', url: 'https://www.twitch.tv', type: 'browser', multiUser: false },
    { id: 'kick', name: 'Kick', sgdbQuery: 'Kick (Website)', url: 'https://www.kick.com', type: 'browser', multiUser: false },
    { id: 'disneyplus', name: 'Disney+', sgdbQuery: 'Disney Plus (Website)', url: 'https://www.disneyplus.com', type: 'browser', multiUser: true },
    { id: 'primevideo', name: 'Prime Vídeo', sgdbQuery: 'Prime Video (Website)', url: 'https://www.primevideo.com', type: 'browser', multiUser: true },
    { id: 'appletv', name: 'Apple TV', sgdbQuery: 'Apple TV (Website)', url: 'https://tv.apple.com', type: 'browser', multiUser: true },
    { id: 'max', name: 'Max', sgdbQuery: 'HBO Max (Website)', url: 'https://www.max.com', type: 'browser', multiUser: true },
    { id: 'crunchyroll', name: 'Crunchyroll', sgdbQuery: 'Crunchyroll (Website)', url: 'https://www.crunchyroll.com', type: 'browser', multiUser: true },

];

const MEDIA_GRID_LIMIT = 12;

window.isSystemLoading = false;
let _currentHomeTab = 'games';

// ── Estilos ───────────────────────────────────────────────────────────────────
(function injectMediaStyles() {
    const s = document.createElement('style');
    s.textContent = `

    /* ── System Loading ── */
    /* ── Card em carregamento ── */
.card.media-card.is-loading img {
    opacity: 0;
}
.card.media-card.is-loading::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
        90deg,
        rgba(255,255,255,0.04) 0%,
        rgba(255,255,255,0.10) 40%,
        rgba(255,255,255,0.04) 100%
    );
    background-size: 200% 100%;
    animation: mediaCardShimmer 1.4s ease infinite;
    z-index: 1;
}
.card.media-card.is-loading .title {
    opacity: 0.3;
}
@keyframes mediaCardShimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
    #systemLoadingOverlay {
        position: fixed;
        inset: 0;
        z-index: 8500;
        display: none;
        align-items: center;
        justify-content: center;
        background: #07071a;
        flex-direction: column;
        opacity: 1;
        transition: opacity 0.45s ease;
    }
    #systemLoadingOverlay.hiding {
        opacity: 0;
        pointer-events: none;
    }
    #systemLoadingOverlay .vb-wrap {
        width: min(540px, 88vw);
        text-align: center;
    }
    .sys-apps-progress {
        display: flex;
        flex-direction: column;
        gap: clamp(8px, 0.9vw, 13px);
        margin-top: clamp(20px, 2.4vw, 36px);
        text-align: left;
    }
    .sys-app-row {
        display: flex;
        align-items: center;
        gap: clamp(10px, 1.1vw, 16px);
        font-family: 'Outfit', sans-serif;
        font-size: clamp(0.8rem, 0.9vw, 1.05rem);
        color: rgba(255,255,255,0.25);
        transition: color 0.3s ease;
    }
    .sys-app-row.active { color: rgba(255,255,255,0.82); }
    .sys-app-row.done   { color: rgba(100,220,120,0.75); }
    .sys-app-dot {
        width: 5px; height: 5px;
        border-radius: 50%;
        background: currentColor;
        flex-shrink: 0;
        transition: background 0.3s;
    }
    .sys-app-row.active .sys-app-dot {
        width: 7px; height: 7px;
        box-shadow: 0 0 8px rgba(255,255,255,0.5);
    }

    /* ── Home Tabs ── */
    .home-tabs {
        display: flex;
        align-items: center;
        gap: clamp(4px, 0.5vw, 8px);
        padding: 0 clamp(24px, 3.2vw, 64px);
        position: relative;
        z-index: 2;
            
    -webkit-user-select: none;
    user-select: none;
    }
    .home-tab {
        background: none;
        border: none;
        font-family: 'Outfit', sans-serif;
        font-size: clamp(0.82rem, 1.05vw, 1.3rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.11em;
        color: rgba(255,255,255,0.25);
        cursor: pointer;
        outline: none;
        padding: clamp(5px, 0.6vw, 9px) clamp(7px, 0.9vw, 14px);
        border-radius: 8px;
        transition: color 0.2s, background 0.2s;
        position: relative;
    }
    .home-tab::after {
        content: '';
        position: absolute;
        bottom: -5px; left: 50%;
        transform: translateX(-50%) scaleX(0);
        width: 65%;
        height: 2px;
        background: rgba(255,255,255,0.9);
        border-radius: 2px;
        transition: transform 0.28s cubic-bezier(0.22,1,0.36,1);
    }
    .home-tab.active { color: rgba(255,255,255,0.92); }
    .home-tab.active::after { transform: translateX(-50%) scaleX(1); }
    .home-tab:focus, .home-tab:hover {
        color: rgba(255,255,255,0.65);
        background: rgba(255,255,255,0.06);
    }
    .home-tab.active:focus, .home-tab.active:hover {
        color: #fff;
        background: rgba(255,255,255,0.06);
    }
    .home-tabs-hint {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: 'Outfit', sans-serif;
        font-size: clamp(0.6rem, 1vw, 1.4rem);
        color: rgba(255,255,255,0.16);
        letter-spacing: 0.05em;
        user-select: none;
    }
    .home-tabs-hint b {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 4px;
        padding: 1px 5px;
        font-weight: 600;
        font-size: 0.95em;
    }

    /* ── Visibilidade por aba ── */
    #mediaGrid { display: none; }
    #mediaGrid.active { display: flex; }
    #gameGrid.tab-hidden { display: none; }

    /* ── Media queries ── */
    @media (max-height: 900px), (max-width: 1600px) {
        .home-tab { font-size: clamp(0.7rem, 0.88vw, 1rem); }
    }
    @media (max-height: 768px) {
        .home-tab { font-size: clamp(0.65rem, 0.8vw, 0.88rem); padding: 4px 8px; }
        .home-tabs { margin-bottom: 6px; }
    }
    `;
    document.head.appendChild(s);
})();

// ── System Loading ────────────────────────────────────────────────────────────
function showSystemLoading(title, subtitle) {
    window.isSystemLoading = true;

    let overlay = document.getElementById('systemLoadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'systemLoadingOverlay';
        document.body.appendChild(overlay);
    }

    overlay.classList.remove('hiding');

    const stepRows = NATIVE_APPS.map(app =>
        `<div class="sys-app-row" id="sysRow_${app.id}">
            <div class="sys-app-dot"></div>
            <span>${app.name}</span>
        </div>`
    ).join('');

    overlay.innerHTML = `
        <div class="vb-wrap">
            <div class="vb-center">
                <div class="vb-ring-wrap">
                    <div class="vb-ring outer"></div>
                    <div class="vb-ring inner"></div>
                    <div class="vb-ring core"></div>
                    <div class="vb-ring-dot"></div>
                </div>
                <div class="vb-text">
                    <div class="vb-title">${title}</div>
                    <div class="vb-subtitle">${subtitle}</div>
                    <div class="vb-dots"><span></span><span></span><span></span></div>
                </div>
            </div>
            <div class="sys-apps-progress" id="sysAppsProgress">
                ${stepRows}
            </div>
        </div>`;

    overlay.style.display = 'flex';
}

function hideSystemLoading() {
    window.isSystemLoading = false;
    const overlay = document.getElementById('systemLoadingOverlay');
    if (!overlay || overlay.style.display === 'none') return;
    overlay.classList.add('hiding');
    setTimeout(() => {
        overlay.style.display = 'none';
        overlay.classList.remove('hiding');
    }, 460);
}

function updateSysAppProgress(appId, state) {
    const row = document.getElementById(`sysRow_${appId}`);
    if (!row) return;
    row.classList.remove('active', 'done');
    row.classList.add(state);
}

// ── Home Tabs ─────────────────────────────────────────────────────────────────
function switchHomeTab(tab) {
    if (_currentHomeTab === tab) return;
    _currentHomeTab = tab;

    document.querySelectorAll('.home-tab').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.tab === tab)
    );

    const gameGrid = document.getElementById('gameGrid');
    const mediaGrid = document.getElementById('mediaGrid');

    if (tab === 'games') {
        gameGrid?.classList.remove('tab-hidden');
        mediaGrid?.classList.remove('active');
        const feat = document.querySelector('#gameGrid .card.featured');
        feat?._startInteraction?.();
    } else {
        gameGrid?.classList.add('tab-hidden');
        mediaGrid?.classList.add('active');
        const feat = document.querySelector('#mediaGrid .card.featured');
        feat?._startInteraction?.();
    }
}

function cycleHomeTab(direction) {
    const tabs = ['games', 'media'];
    const idx = tabs.indexOf(_currentHomeTab);
    const next = tabs[(idx + direction + tabs.length) % tabs.length];
    switchHomeTab(next);
    setTimeout(() => {
        const activeGrid = _currentHomeTab === 'games' ? '#gameGrid' : '#mediaGrid';
        const first = document.querySelector(`${activeGrid} .card:not(.add-card)`);
        first?.focus();
    }, 60);
}

window.switchHomeTab = switchHomeTab;
window.cycleHomeTab = cycleHomeTab;
window.getCurrentHomeTab = () => _currentHomeTab;

// ── Criar card de mídia ───────────────────────────────────────────────────────

function _moveMediaCardToTop(card) {
    if (!card) return;
    const grid = document.getElementById('mediaGrid');

    grid.querySelectorAll('.card.featured').forEach(c => {
        c.classList.remove('featured');
        const img = c.querySelector('img');
        if (img) img.src = c.dataset.staticVertical || c.dataset.vertical || '';
    });

    card.classList.add('featured');


    const btnAddMedia = document.getElementById('btnAddMedia');
    grid.insertBefore(card, grid.firstChild);

    grid.appendChild(btnAddMedia);


    const img = card.querySelector('img');
    if (img) {
        const src = card.dataset.staticHorizontal || card.dataset.horizontal
            || card.dataset.staticVertical || card.dataset.vertical || '';
        if (src) img.src = src;
    }


    if (_currentHomeTab === 'media') card._startInteraction?.();
}
function createMediaCard(data) {
    const grid = document.getElementById('mediaGrid');
    if (!grid) return;
    if (grid.querySelectorAll('.card:not(.add-card)').length >= MEDIA_GRID_LIMIT) return;

    // ── Lê campos com fallback PascalCase / camelCase ──────────────────────
    const appId = data.Id || data.id || '';
    const appUrl = data.Url || data.url || '';
    const appType = data.Type || data.type || 'browser';
    const appName = data.Name || data.name || '';

    const card = document.createElement('div');
    card.className = 'card media-card';
    card.tabIndex = 0;

    card.dataset.appId = appId;
    card.dataset.appUrl = appUrl;
    card.dataset.appType = appType;
    card.dataset.hero = data.HeroImage || data.heroImage || '';
    card.dataset.logo = data.LogoImage || data.logoImage || '';
    card.dataset.vertical = data.GridImage || data.gridImage || '';
    card.dataset.horizontal = data.GridHorizontalImage || data.gridHorizontalImage || '';
    card.dataset.staticVertical = data.GridStaticImage || data.gridStaticImage || '';
    card.dataset.staticHorizontal = data.GridHorizontalStaticImage || data.gridHorizontalStaticImage || '';
    card.dataset.staticHero = data.HeroStaticImage || data.heroStaticImage || '';
    card.dataset.staticLogo = data.LogoStaticImage || data.logoStaticImage || '';

    // Primeiro card vira featured desta aba
    if (!grid.querySelector('.card.featured')) card.classList.add('featured');

    const img = document.createElement('img');
    img.decoding = 'async';



    // Se não tem imagem ainda, entra em estado de carregamento
    const hasSrc = card.dataset.vertical || card.dataset.staticVertical;
    if (!hasSrc) card.classList.add('is-loading');

    Promise.all([
        processImage(card, card.dataset.vertical, 'staticVertical', 'GridStatic', appId),
        processImage(card, card.dataset.horizontal, 'staticHorizontal', 'HorizontalStatic', appId),
        processImage(card, card.dataset.hero, 'staticHero', 'HeroStatic', appId),
        processImage(card, card.dataset.logo, 'staticLogo', 'LogoStatic', appId),
    ]).then(() => {
        const src = card.classList.contains('featured')
            ? card.dataset.staticHorizontal
            : card.dataset.staticVertical;
        if (src) {
            img.src = src;
            img.style.opacity = '1';
            card.classList.remove('is-loading'); 
        }
    });

    // ── startInteraction: idêntico ao createGameCard ───────────────────────
    const startInteraction = async () => {
        // Só atualiza o hero se esta for a aba ativa
        if (_currentHomeTab === 'media') {
            const bgSrc = card.dataset.staticVertical || card.dataset.vertical;
            const logoSrc = card.dataset.staticLogo || card.dataset.logo;
            const heroSrc = card.dataset.staticHero || card.dataset.hero
                || card.dataset.staticHorizontal || card.dataset.horizontal
                || bgSrc;
            switchHeroBackground(bgSrc, logoSrc, heroSrc);
        }

        if (card._animTimer) clearTimeout(card._animTimer);
        card._animTimer = setTimeout(async () => {
            const active = () => document.activeElement === card || card.matches(':hover');
            if (!active()) return;

            const animGrid = card.classList.contains('featured')
                ? (card.dataset.horizontal || card.dataset.vertical)
                : card.dataset.vertical;
            if (animGrid) await setImgSrc(img, animGrid);

            const animHero = card.dataset.hero;
            if (animHero && animHero !== (card.dataset.staticHero || animHero) && active() && _currentHomeTab === 'media')
                await setImgSrc(document.getElementById('heroImage'), animHero);

            const animLogo = card.dataset.logo;
            if (animLogo && animLogo !== (card.dataset.staticLogo || animLogo) && active() && _currentHomeTab === 'media') {
                const logoEl = document.getElementById('gameLogo');
                if (logoEl) { await setImgSrc(logoEl, animLogo); logoEl.classList.add('visible'); }
            }
        }, 200);
    };

    // ── stopInteraction: idêntico ao createGameCard ────────────────────────
    const stopInteraction = () => {
        if (card._animTimer) clearTimeout(card._animTimer);
        if (document.activeElement === card || card.matches(':hover')) return;

        const staticGrid = card.classList.contains('featured')
            ? (card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical)
            : (card.dataset.staticVertical || card.dataset.vertical);
        setImgSrc(img, staticGrid);

        if (_currentHomeTab === 'media') {
            const staticHero = card.dataset.staticHero || card.dataset.hero;
            if (staticHero) setImgSrc(document.getElementById('heroImage'), staticHero);

            const staticLogo = card.dataset.staticLogo || card.dataset.logo;
            const logoEl = document.getElementById('gameLogo');
            if (logoEl && staticLogo) setImgSrc(logoEl, staticLogo);
        }
    };

    card._startInteraction = startInteraction;
    card._stopInteraction = stopInteraction;

    // ── Eventos: mouse + gamepad (mesmo padrão do createGameCard) ──────────
    card.addEventListener('mouseenter', startInteraction);
    card.addEventListener('mouseleave', stopInteraction);
    card.addEventListener('focus', () => {
        pendingInteractionCard = card;
        signalNavigation();
    });
    card.addEventListener('blur', () => {
        if (pendingInteractionCard === card) pendingInteractionCard = null;
        stopInteraction();
    });
    card.addEventListener('click', () => {
        _moveMediaCardToTop(card);
        window.isMediaAppActive = true; 
        postToHost({ action: 'launchMediaApp', url: appUrl, appType: appType });
    });
    card.appendChild(img);
    const title = document.createElement('div');
    title.className = 'title';
    title.innerText = appName;
    card.appendChild(title);


    const btnAddMedia = document.getElementById('btnAddMedia');
    grid.insertBefore(card, btnAddMedia);

    if (card.classList.contains('featured') && _currentHomeTab === 'media') {
        startInteraction();
    }
}

// ── Renderizar carrossel ──────────────────────────────────────────────────────
function renderMediaCarousel(apps) {
    const grid = document.getElementById('mediaGrid');
    if (!grid) return;
    // Remove apenas cards existentes, preserva btnAddMedia
    grid.querySelectorAll('.card:not(.add-card)').forEach(c => c.remove());
    apps.slice(0, MEDIA_GRID_LIMIT).forEach(app => createMediaCard(app));
}

// ── Bridge ────────────────────────────────────────────────────────────────────
window._mediaHandleMessage = (data) => {
    switch (data.type) {
        case 'nativeAppsLoaded':
            renderMediaCarousel(data.apps);
            hideSystemLoading();
            break;
        case 'hideSystemLoading':
            hideSystemLoading();
            break;
        case 'nativeAppProgress':
            updateSysAppProgress(data.appId, data.state);
            break;
      
        case 'mediaAppClosed':
            window.isMediaAppActive = false;
          
            setTimeout(() => {
                window.focus?.();
                window.focusFeaturedCard?.();
            }, 150);
            break;
    }
};


document.querySelectorAll('.home-tab').forEach(btn => {
    btn.addEventListener('click', () => switchHomeTab(btn.dataset.tab));
});
