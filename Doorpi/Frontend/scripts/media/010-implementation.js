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
    s.textContent = __doorpiCss("injected-styles/media/implementation-1.css");
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
            `${activeGrid} .card:not(.add-card), ${activeGrid} .card.add-card`);
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
            window.clearDoorpiInputQuarantine?.({ dropPending: true });
            window._currentWebAppConflictEntry = null;
            window._storesHandleMessage?.(data);
            if (window._suppressNextMediaAppClosedFocus) {
                window._suppressNextMediaAppClosedFocus = false;
                break;
            }
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
