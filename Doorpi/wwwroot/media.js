// =============================================================================
// media.js — Apps nativos de mídia · System Loading · Carrossel de mídia
// Toda lógica de card espelha createGameCard do app.js perfeitamente agora
// =============================================================================

const NATIVE_APPS = [
    { id: 'youtube', name: 'YouTube', sgdbQuery: 'YouTube (Website)', url: '', type: 'webview', multiUser: true },
    { id: 'netflix', name: 'Netflix', sgdbQuery: 'Netflix (Website)', url: 'https://www.netflix.com', type: 'browser', multiUser: true },
    { id: 'twitch', name: 'Twitch', sgdbQuery: 'Twitch (Website)', url: 'https://www.twitch.tv', type: 'browser', multiUser: false },
    { id: 'kick', name: 'Kick', sgdbQuery: 'Kick (Website)', url: 'https://www.kick.com', type: 'browser', multiUser: false },
    { id: 'disneyplus', name: 'Disney+', sgdbQuery: 'Disney Plus (Website)', url: 'https://www.disneyplus.com', type: 'browser', multiUser: true },
    { id: 'primevideo', get name() { return t('appNamePrimeVideo'); }, sgdbQuery: 'Prime Video (Website)', url: 'https://www.primevideo.com', type: 'browser', multiUser: true },
    { id: 'appletv', name: 'Apple TV', sgdbQuery: 'Apple TV (Website)', url: 'https://tv.apple.com', type: 'browser', multiUser: true },
    { id: 'max', name: 'Max', sgdbQuery: 'HBO Max (Website)', url: 'https://www.max.com', type: 'browser', multiUser: true },
    { id: 'crunchyroll', name: 'Crunchyroll', sgdbQuery: 'Crunchyroll (Website)', url: 'https://www.crunchyroll.com', type: 'browser', multiUser: true },
];

const MEDIA_GRID_LIMIT = 12;

window.isSystemLoading = false;
let _currentHomeTab = 'games';

// ── Estilos (Removido estilos de Skeleton duplicados) ──────────────────────────
(function injectMediaStyles() {
    const s = document.createElement('style');
    s.textContent = `

    /* Badge de NOVO fixo e visível */
/* ==========================================================================
   RUNTIME BADGES - CONFIGURAÇÃO GERAL (TVS & RESPONSIVO)
   ========================================================================= */

/* 1. Evita que os cantos arredondados do card principal e nav menu quebrem ao usar overflow: visible */
.card.is-running img,
.card.is-running::after,
.nav-vertical-card.is-running img,
.nav-vertical-card.is-running::after {
    border-radius: inherit !important;
}

/* 2. Permite que os badges flutuem para fora da borda (Inicial e Nav Menu) */
.card.is-running,
.nav-vertical-card.is-running {
    overflow: visible !important;
}

/* ── BADGE TOPO: "Em Execução" ── */
.runtime-badge-top {
    position: absolute;
    top: clamp(-36px, -3.5vh, -26px);
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    width: fit-content;
    z-index: 15;
    pointer-events: none;

    /* Pílula escura de alto contraste para leitura de sofá */
    background: rgba(8, 8, 16, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 4px;
    padding: 4px 10px;

    /* Tipografia para TVs */
    font-size: clamp(11px, 0.75vw, 15px);
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.95);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);

    animation: rt-top 0.22s ease both;
}
.runtime-badge-top::before { display: none !important; }

@keyframes rt-top {
    from { opacity: 0; transform: translateX(-50%) translateY(4px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* Alinhamento para o Card de Destaque (Featured - Horizontal) */
.card.featured .runtime-badge-top {
    left: clamp(10px, 0.94vw, 18px);
    transform: none;
    animation: rt-top-l 0.22s ease both;
}
@keyframes rt-top-l {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
}

/* Evita colisão se houver o badge "NOVO" */
.card:not(.featured).new-game.is-running .runtime-badge-top {
    left: auto;
    right: clamp(7px, 0.6vw, 10px);
    transform: none;
    animation: rt-top-r 0.22s ease both;
}
@keyframes rt-top-r {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
}

/* ── BADGE BOTTOM: "Retomar" ── */
.runtime-badge-bottom {
    position: absolute;
    bottom: clamp(-29px, -3.5vh, -20px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 15;
    pointer-events: none;
    width: fit-content;
    white-space: nowrap;

    display: inline-flex;
    align-items: center;
    gap: 6px;

    font-size: clamp(11px, 0.8vw, 16px);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
    background: transparent !important;

    transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
    animation: rt-bot 0.22s ease 0.06s both;
}
.runtime-badge-bottom::before {
    content: '▶';
    font-size: 0.8em;
    opacity: 0.7;
    line-height: 1;
}
@keyframes rt-bot {
    from { opacity: 0; transform: translateY(3px); }
    to   { opacity: 1; transform: translateY(0); }
}

/* Foco do Retomar (Card Destaque - Horizontal) */
.card.featured.is-running:focus .runtime-badge-bottom {
    color: #fff;
    text-shadow: 0 0 12px rgba(255, 255, 255, 0.35), 0 2px 6px rgba(0, 0, 0, 0.9);
    transform: translateX(4px);
}

/* Ajusta Alinhamento Base do Card Destaque (Featured) */
.card.featured .runtime-badge-bottom {
    left: clamp(10px, 0.94vw, 18px);
    transform: none;
}

/* Foco do Retomar (Card Vertical Grid Normal) - Zoom e acendimento */
.card:not(.featured).is-running:focus .runtime-badge-bottom,
.card:not(.featured).is-running.nav-focused .runtime-badge-bottom {
    color: #fff;
    text-shadow: 0 0 12px rgba(255, 255, 255, 0.35), 0 2px 6px rgba(0, 0, 0, 0.9);
    transform: translateX(-50%) scale(1.1);
}

/* Card Vertical Grid: Centraliza e joga acima do título */
.card:not(.featured) .runtime-badge-bottom {
    left: 50%;
    bottom: clamp(-38px, -3.5vh, -24px);
    transform: translateX(-50%);
    animation: rt-bot-c 0.22s ease 0.06s both;
}
@keyframes rt-bot-c {
    from { opacity: 0; transform: translateX(-50%) translateY(3px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}


/* ==========================================================================
   AJUSTES ESPECÍFICOS PARA O NAV MENU (CARDS MENORES)
   ========================================================================== */

/* Top Badge no Nav Menu: DENTRO do card (2% do topo) e com proporções menores */
.nav-vertical-card .runtime-badge-top {
    top: 2% !important;
    left: 50% !important;
    transform: translateX(-50%) !important;

    font-size: clamp(8px, 0.55vw, 11px) !important;
    padding: 3px 7px !important;
    border-radius: 3px !important;
    background: rgba(8, 8, 16, 0.8) !important;
}

/* Bottom Badge no Nav Menu: FORA do card (embaixo), alinhado à esquerda no 0 */
.nav-vertical-card .runtime-badge-bottom {
    left: 0 !important;
    bottom: clamp(-26px, -3.5vh, -17px) !important;
    transform: none !important;

    font-size: clamp(8px, 0.55vw, 11px) !important;
}

/* Foco do Retomar no Nav Menu: Apenas escala leve para o grid menor, sem deslizar lateralmente */
.nav-vertical-card.is-running.nav-focused .runtime-badge-bottom,
.nav-vertical-card.is-running:focus .runtime-badge-bottom {
    color: #fff !important;
    text-shadow: 0 0 8px rgba(255, 255, 255, 0.35), 0 1px 4px rgba(0, 0, 0, 0.9) !important;
    transform: scale(1.05) !important;
}
    .media-card-fallback {
        position: absolute;
        inset: 0;
        z-index: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Outfit', sans-serif;
        font-size: clamp(2.3rem, 4vw, 5.5rem);
        font-weight: 800;
        color: rgba(255,255,255,0.78);
        background:
            radial-gradient(circle at 28% 18%, rgba(255,255,255,0.18), transparent 32%),
            linear-gradient(135deg, rgba(32,42,76,0.98), rgba(11,13,26,0.98) 58%, rgba(42,35,72,0.98));
        text-transform: uppercase;
    }
    .card.no-art img { display: none; }

    #systemLoadingOverlay {
        position: fixed; inset: 0; z-index: 8500; display: none;
        align-items: center; justify-content: center; background: #07071a;
        flex-direction: column; opacity: 1; transition: opacity 0.45s ease;
    }
    #systemLoadingOverlay.hiding { opacity: 0; pointer-events: none; }
    #systemLoadingOverlay .vb-wrap { width: min(540px, 88vw); text-align: center; }
    .sys-apps-progress {
        display: flex; flex-direction: column; gap: clamp(8px, 0.9vw, 13px);
        margin-top: clamp(20px, 2.4vw, 36px); text-align: left;
    }
    .sys-app-row {
        display: flex; align-items: center; gap: clamp(10px, 1.1vw, 16px);
        font-family: 'Outfit', sans-serif; font-size: clamp(0.8rem, 0.9vw, 1.05rem);
        color: rgba(255,255,255,0.25); transition: color 0.3s ease;
    }
    .sys-app-row.active { color: rgba(255,255,255,0.82); }
    .sys-app-row.done   { color: rgba(100,220,120,0.75); }
    .sys-app-dot {
        width: 5px; height: 5px; border-radius: 50%;
        background: currentColor; flex-shrink: 0; transition: background 0.3s;
    }
    .sys-app-row.active .sys-app-dot { width: 7px; height: 7px; box-shadow: 0 0 8px rgba(255,255,255,0.5); }

    /* ── Home Tabs ── */
    .home-tabs { display: flex; align-items: center; gap: clamp(4px, 0.5vw, 8px); padding: 0 clamp(24px, 3.2vw, 64px); position: relative; z-index: 2; user-select: none;margin-bottom:25px; }
    .home-tab { background: none; border: none; font-family: 'Outfit', sans-serif; font-size: clamp(0.82rem, 1.05vw, 1.3rem); font-weight: 700; text-transform: uppercase; letter-spacing: 0.11em; color: rgba(255,255,255,0.25); cursor: pointer; outline: none; padding: clamp(5px, 0.6vw, 9px) clamp(7px, 0.9vw, 14px); border-radius: 8px; transition: color 0.2s, background 0.2s; position: relative; }
    .home-tab::after { content: ''; position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%) scaleX(0); width: 65%; height: 2px; background: rgba(255,255,255,0.9); border-radius: 2px; transition: transform 0.28s cubic-bezier(0.22,1,0.36,1); }
    .home-tab.active { color: rgba(255,255,255,1); }
    .home-tab.active::after { transform: translateX(-50%) scaleX(1); }
    .home-tab:focus, .home-tab:hover { color: rgba(255,255,255,0.65); background: rgba(255,255,255,0.06); }
    .home-tab.active:focus, .home-tab.active:hover { color: #fff; background: rgba(255,255,255,0.06); }
    
    #mediaGrid, #storesGrid { display: none; }
    #mediaGrid.active, #storesGrid.active { display: flex; }
    #gameGrid.tab-hidden, #mediaGrid.tab-hidden { display: none; }

    @media (max-height: 900px), (max-width: 1600px) { .home-tab { font-size: clamp(0.7rem, 0.88vw, 1rem); } }
    @media (max-height: 768px) { .home-tab { font-size: clamp(0.65rem, 0.8vw, 0.88rem); padding: 4px 8px; } .home-tabs { margin-bottom: 6px; } }
    `;
    document.head.appendChild(s);
})();

// ── System Loading ────────────────────────────────────────────────────────────
function showSystemLoading(title, subtitle, folders = []) {
    window.isSystemLoading = true;
    let overlay = document.getElementById('systemLoadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'systemLoadingOverlay';
        document.body.appendChild(overlay);
    }

    overlay.classList.remove('hiding');
    const stepRows = NATIVE_APPS.map(app => `<div class="sys-app-row" id="sysRow_${app.id}"><div class="sys-app-dot"></div><span>${app.name}</span></div>`).join('');
    const folderRows = folders.length > 0 ? `<div class="sys-section-sep" style="height:10px;margin-left:5%;"></div><div class="sys-section-label" style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 2px;">${t('sysMediaFolders')}</div>${folders.map(f => { const name = f.replace(/\\/g, '/').split('/').filter(Boolean).pop() || f; return `<div class="sys-app-row" id="sysFolderRow_${CSS.escape(f)}" data-folder-path="${f.replace(/"/g, '&quot;')}"><div class="sys-app-dot"></div><span>${name}</span><span class="sys-folder-count">...</span></div>`; }).join('')}` : '';
    const syncRow = `<div class="sys-section-sep" style="height:10px;"></div><div class="sys-app-row active" id="sysRow_artSync"><div class="sys-app-dot"></div><span>${t('sysMediaDownloadingCovers')}</span></div>`;

    overlay.innerHTML = `
        <div class="vb-wrap">
            <div class="vb-center">
                <div class="vb-ring-wrap">
                    <div class="vb-ring outer"></div><div class="vb-ring inner"></div><div class="vb-ring core"></div><div class="vb-ring-dot"></div>
                </div>
                <div class="vb-text">
                    <div class="vb-title">${title}</div><div class="vb-subtitle">${subtitle}</div>
                    <div class="vb-dots"><span></span><span></span><span></span></div>
                </div>
            </div>
            <div class="sys-apps-progress" id="sysAppsProgress">${stepRows}${folderRows}</div>
        </div>`;
    overlay.style.display = 'flex';
}

function hideSystemLoading() {
    window.isSystemLoading = false;
    const overlay = document.getElementById('systemLoadingOverlay');
    if (!overlay || overlay.style.display === 'none') return;
    const syncRow = document.getElementById('sysRow_artSync');
    if (syncRow) { syncRow.classList.remove('active'); syncRow.classList.add('done'); }
    overlay.classList.add('hiding');
    setTimeout(() => { overlay.style.display = 'none'; overlay.classList.remove('hiding'); }, 460);
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

    document.querySelectorAll('.home-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));

    const gameGrid = document.getElementById('gameGrid');
    const mediaGrid = document.getElementById('mediaGrid');
    const storesGrid = document.getElementById('storesGrid');

    gameGrid?.classList.toggle('tab-hidden', tab !== 'games');
    mediaGrid?.classList.toggle('active', tab === 'media');
    mediaGrid?.classList.toggle('tab-hidden', tab !== 'media');
    storesGrid?.classList.toggle('active', tab === 'stores');

    const gridSel = tab === 'games' ? '#gameGrid' : (tab === 'media' ? '#mediaGrid' : '#storesGrid');
    const feat = document.querySelector(`${gridSel} .card.featured`);
    feat?._startInteraction?.();

    if (tab === 'stores') {
        const first = document.querySelector('#storesGrid .store-card');
        first?.focus();
    }
}

function cycleHomeTab(direction) {
    const tabs = ['games', 'media', 'stores'];
    const idx = tabs.indexOf(_currentHomeTab);
    const next = tabs[(idx + direction + tabs.length) % tabs.length];
    switchHomeTab(next);
    setTimeout(() => {
        const activeGrid = _currentHomeTab === 'games' ? '#gameGrid'
            : (_currentHomeTab === 'media' ? '#mediaGrid' : '#storesGrid');
        const first = document.querySelector(
            `${activeGrid} .card:not(.add-card), ${activeGrid} .store-card`);
        first?.focus();
    }, 60);
}

window.switchHomeTab = switchHomeTab;
window.cycleHomeTab = cycleHomeTab;
window.getCurrentHomeTab = () => _currentHomeTab;
window.getHomeGridId = (tab) => {
    const t = tab ?? _currentHomeTab;
    if (t === 'media') return 'mediaGrid';
    if (t === 'stores') return 'storesGrid';
    return 'gameGrid';
};


// ── Bridge Específica (Processos internos da tab de mídia) ────────────────────
window._mediaHandleMessage = (data) => {
    switch (data.type) {
        case 'nativeAppsLoaded':
            if (Array.isArray(data.apps)) {
                data.apps.forEach(a => {
                    if (a.IsNew || a.isNew) AppStore.mutations.markNew(a.Id || a.id);
                });
                AppStore.mutations.setBatch('media', data.apps);
            }
            break;

        case 'hideSystemLoading':
            hideSystemLoading();
            break;

        case 'nativeAppProgress':
            updateSysAppProgress(data.appId, data.state);
            break;

        case 'scanProgress': {
            const rows = document.querySelectorAll('#systemLoadingOverlay .sys-app-row[data-folder-path]');
            let row = null;
            rows.forEach(r => { if (r.dataset.folderPath === data.folder) row = r; });
            if (!row) break;

            row.classList.remove('active', 'done');
            const countEl = row.querySelector('.sys-folder-count');

            if (data.foundCount === -1) {
                row.classList.add('active');
                if (countEl) countEl.textContent = '...';
            } else {
                row.classList.add('done');
                if (countEl) countEl.textContent = data.foundCount > 0 ? `${data.foundCount}` : '✓';
            }
            break;
        }

        case 'mediaAppClosed':
            window.isMediaAppActive = false;
            window._storesHandleMessage?.(data);
            setTimeout(() => {
                window.focus?.();
                if (typeof window.getCurrentHomeTab === 'function' && window.getCurrentHomeTab() === 'stores') {
                    document.querySelector('#storesGrid .store-card')?.focus();
                } else {
                    window.focusFeaturedCard?.();
                }
            }, 150);
            break;
    }
};

document.querySelectorAll('.home-tab').forEach(btn => {
    btn.addEventListener('click', () => switchHomeTab(btn.dataset.tab));
});
