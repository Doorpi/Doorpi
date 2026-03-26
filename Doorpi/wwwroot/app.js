// =============================================================================
// app.js — Aplicação
// =============================================================================

let allInstalledApps = [];
let cachedFolders = null;
let currentSourceFilter = ['all'];
let isFolderOperationInProgress = false;
const newGameIdsThisSession = new Set();
window.isGlobalLoading = false;

const PLATFORMS = {
    Steam: { type: 'url', icon: 'https://cdn.simpleicons.org/steam/1b9bd4' },
    Epic: { type: 'url', icon: 'https://cdn.simpleicons.org/epicgames/a0a0a0' },
    GOG: { type: 'url', icon: 'https://cdn.simpleicons.org/gogdotcom/8a4fff' },
    Folder: { type: 'url', icon: 'https://cdn.simpleicons.org/files/f0a500' },
    Windows: { type: 'svg', icon: `<svg viewBox="0 0 88 88" fill="#0078d4" xmlns="http://www.w3.org/2000/svg"><path d="M0 12.4 35.7 7.6V42H0zm40.3-5.5L88 0v42H40.3zM0 46h35.7v34.4L0 75.6zm40.3.1H88V88L40.3 81.4z"/></svg>` },
};

const FILTER_SOURCES = {
    all: null,
    Steam: ['Steam'],
    Epic: ['Epic'],
    GOG: ['GOG'],
    Windows: ['Windows', 'Folder'],
};

const SCAN_LIBS = ['Steam', 'Epic', 'GOG', 'Windows', 'Folder'];

setInterval(() => {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}, 1000);

/* Seção: Ponte com o host */
window.chrome.webview.addEventListener('message', event => {
    try {
        const data = JSON.parse(event.data);
        if (data.type === 'newGame') {
            createGameCard(data);
        }
        else if (data.type === 'installedAppsList') {
            allInstalledApps = data.apps;
            applyFilterAndRender();
        }
        else if (data.type === 'showSetup') {
            if (typeof openSetup === 'function') openSetup();
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
        else if (data.type === 'staticSaved') {
            updateToLocalFile(data.gameId, data.imageType, data.newUrl);
        }
        else if (data.type === 'updateFeaturedCard') {
            const gridId = data.tab === 'games' ? 'gameGrid' : 'mediaGrid';
            const grid = document.getElementById(gridId);
            if (grid) {
                const card = Array.from(grid.querySelectorAll('.card:not(.add-card)')).find(c =>
                    c.dataset.gameId === data.id || c.dataset.appId === data.id
                );
                if (card) moveCardToTop(card);
            }
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
        else if (data.type === 'hideLoading') {
            hideGlobalLoading();
            isFolderOperationInProgress = false;
        }
        else if (data.type === 'clipboardText') {
            const input = document.getElementById('setupApiInput');
            if (input && data.text?.trim()) {
                input.value = data.text.trim();
                _setupData.apiKey = data.text.trim();
                const hint = document.getElementById('setupApiHint');
                if (hint) hint.textContent = t('setupStep3PasteSuccess');
                document.getElementById('btnSetupApiNext')?.focus();
            }
        }

        window._mediaHandleMessage?.(data);
    } catch (e) { console.error('[bridge] Erro:', e); }
});

function postToHost(payload) {
    window.chrome?.webview?.postMessage(JSON.stringify(payload));
}

/* Seção: Overlay de Loading */
function showGlobalLoading(titleText, subtitleText) {
    window.isGlobalLoading = true;
    window.updateNavHint?.(); // Oculta a seta do menu se estiver visível
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

function switchTab(tabId) {
    document.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(v => { v.classList.remove('active'); v.classList.add('hidden'); });
    const isApps = tabId === 'apps';
    document.querySelectorAll('.menu-tab')[isApps ? 0 : 1].classList.add('active');

    const view = document.getElementById(isApps ? 'view-apps' : 'view-folders');
    view.classList.remove('hidden');
    view.classList.add('active');

    if (tabId === 'folders') {
        if (cachedFolders === null) {
            showGlobalLoading(t('foldersTitle'), t('readingApps'));
            requestFolders();
        } else {
            renderFolderList(cachedFolders);
        }
    }
}

/* Seção: Filtros e barra de filtros */
currentSourceFilter = ['all'];

function buildFilterBar(apps) {
    const bar = document.getElementById('filterBar');
    if (!bar) return;

    const present = new Set(apps.map(a => a.Source || a.source));
    const keys = ['all', ...Object.keys(FILTER_SOURCES).filter(k => k !== 'all' && FILTER_SOURCES[k].some(s => present.has(s)))];

    bar.innerHTML = keys.map(k => {
        const isActive = currentSourceFilter.includes(k);
        return `
            <button class="filter-btn ${isActive ? 'active' : ''}" tabindex="0" data-source="${k}">
                ${t('filterLabels.' + k)}
            </button>
        `;
    }).join('');

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

    populateAppModal(filtered);
}

document.getElementById('btnAdd').addEventListener('click', () => {
    isModalOpen = true;
    _modalReady = false;
    if (isSetupOpen) return;
    document.getElementById('modalActions').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'hidden';
    document.getElementById('addGameContainer').style.display = 'flex';
    document.getElementById('modalTitle').innerText = t('detectingLibrary');
    showGlobalLoading(t('detectingLibrary'), t('readingApps'));
    switchTab('apps');
    postToHost({ action: 'requestInstalledApps' });
});

document.getElementById('btnAddMedia')?.addEventListener('click', () => {
    isModalOpen = true;
    _modalReady = false;
    if (isSetupOpen) return;
    document.getElementById('modalActions').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'hidden';
    document.getElementById('addGameContainer').style.display = 'flex';
    document.getElementById('modalTitle').innerText = t('detectingLibrary');

    showGlobalLoading(t('detectingLibrary'), t('readingApps'));
    switchTab('apps');
    postToHost({ action: 'requestInstalledApps' });
});

function closeModal() {
    document.getElementById('addGameContainer').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'auto';
    document.getElementById('selectionCounter')?.classList.remove('visible');
    isModalOpen = false;
    hideGlobalLoading();
    focusItemByIndex(0);
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
        showGlobalLoading(t('detectingLibrary'), t('waitingWindows'));
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
        showGlobalLoading(t('waitingFolder'), t('waitingWindows'));
        isFolderOperationInProgress = true;
        postToHost({
            action: 'pickFolder',
            dialogTitle: t('dlgFolderTitle'),
            forbiddenMsg: t('msgFolderForbidden'),
            forbiddenTitle: t('msgFolderForbiddenTitle'),
            loadingTitle: t('loadingUpdatingLibrary'),
            loadingSub: t('loadingScanningDoNotClose'),
            errorMsg: t('msgErrorOpenFolder')
        });
    });

    buildFilterBar(allInstalledApps);

    const appList = document.getElementById('appList');
    appList.innerHTML = apps.map(app => {
        const isAdded = app.IsAdded === true || app.isAdded === true;
        const icon = app.IconBase64 || app.iconBase64;
        const name = app.Name || app.name;
        const path = app.Path || app.path;
        const size = app.Size ?? app.size;
        const launch = app.LaunchUrl || app.launchUrl || '';
        const source = app.Source || app.source;

        return `
        <div class="app-item ${isAdded ? 'already-added' : ''}" ${isAdded ? '' : 'tabindex="0"'}
             data-path="${path.replace(/\\/g, '\\\\')}" data-launch="${launch}"
             data-name="${name.replace(/"/g, '&quot;')}">
            ${icon ? `<img class="app-icon" src="data:image/png;base64,${icon}" />` : ''}
            <div class="app-item-info">
                <span class="app-name">${name}</span>
                ${size ? `<span class="size">${formatBytes(size)}</span>` : ''}
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

    const rebindAction = (id, fn) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const fresh = btn.cloneNode(true);
        btn.replaceWith(fresh);
        fresh.addEventListener('click', fn);
    };

    rebindAction('btnCancelAdd', closeModal);
    rebindAction('btnConfirmAdd', () => {
        const selected = Array.from(appList.querySelectorAll('.app-item.selected')).map(el => ({
            Name: el.dataset.name, Path: el.dataset.path, LaunchUrl: el.dataset.launch,
        }));
        if (selected.length > 0) {
            selected.forEach(g => newGameIdsThisSession.add(g.LaunchUrl || g.Path));
            postToHost({ action: 'addSelectedGames', games: selected });
            showGlobalLoading(t('downloadingCovers'), t('readingApps'));
            setTimeout(closeModal, 3000);
        } else {
            closeModal();
        }
    });

    if (!isFolderOperationInProgress) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                hideGlobalLoading();
                _modalReady = true;
            });
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

    if (!folders || folders.length === 0) {
        list.innerHTML = `
            <div class="folder-empty">
                <div class="folder-empty-icon">◫</div>
                <div class="folder-empty-text">${t('foldersEmpty')}</div>
                <div class="folder-empty-hint">${t('foldersEmptyHint')}</div>
            </div>`;
        if (totalBar) totalBar.style.display = 'none';
        return;
    }

    const formatTime = (ms) => ms < 1000 ? t('perfMs', ms) : t('perfSec', (ms / 1000).toFixed(1));
    const perfClass = (ms) => ms < 1000 ? 'fast' : ms < 3000 ? 'medium' : 'slow';
    const perfLabel = (ms) => ms < 1000 ? t('perfFast') : ms < 3000 ? t('perfMedium') : t('perfSlow');

    list.innerHTML = folders.map(folder => {
        const ms = folder.EstimatedMs ?? folder.estimatedMs ?? 0;
        const isAnalyzing = ms === -1;

        const tl = isAnalyzing ? t('analysing') : formatTime(ms);
        const pc = isAnalyzing ? 'loading' : perfClass(ms);
        const pl = isAnalyzing ? t('analysing') : perfLabel(ms);

        const subCount = folder.SubfolderCount ?? folder.subfolderCount ?? '—';
        const exeCount = folder.ExeCount ?? folder.exeCount ?? '—';
        const folderPath = folder.Path || folder.path || '';

        const pSafe = folderPath.replace(/\\/g, '\\\\').replace(/"/g, '&quot;');
        const isSlowClass = (!isAnalyzing && pc === 'slow') ? 'is-slow' : '';

        return `
        <div class="folder-item ${isSlowClass}" data-path="${pSafe}">
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
            <div class="folder-stats">
                <div class="folder-stat">
                    <span class="folder-stat-value">${subCount}</span>
                    <span class="folder-stat-label">${t('statSubfolders')}</span>
                </div>
                <div class="folder-stat">
                    <span class="folder-stat-value">${exeCount}</span>
                    <span class="folder-stat-label">${t('statExeFiles')}</span>
                </div>
                <div class="folder-stat">
                    <span class="folder-stat-value">${tl}</span>
                    <span class="folder-stat-label">${t('statScanTime')}</span>
                </div>
                <div class="folder-perf">
                    <span class="folder-perf-dot ${pc}"></span>
                    <span class="folder-perf-label ${pc}">${pl}</span>
                </div>
            </div>
            
            <div class="folder-warning">
                <span style="font-size: 14px;">⚠️</span>
                <span>${t('folderWarningSlow')}</span>
            </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.edit-btn').forEach(btn =>
        btn.addEventListener('click', e => {
            e.stopPropagation();
            showGlobalLoading(t('waitingFolder'), t('waitingWindows'));
            isFolderOperationInProgress = true;
            postToHost({
                action: 'editFolder',
                path: btn.dataset.path.replace(/\\\\/g, '\\'),
                dialogTitle: t('dlgEditFolderTitle'),
                forbiddenMsg: t('msgFolderForbidden'),
                forbiddenTitle: t('msgFolderForbiddenTitle'),
                loadingTitle: t('loadingUpdatingLibrary'),
                loadingSub: t('loadingAnalyzingNewFolder'),
                errorMsg: t('msgErrorEditFolder')
            });
        })
    );

    list.querySelectorAll('.delete-btn').forEach(btn =>
        btn.addEventListener('click', e => {
            e.stopPropagation();
            showGlobalLoading(t('updatingLibrary'), t('readingApps'));
            isFolderOperationInProgress = true;
            postToHost({ action: 'deleteFolder', path: btn.dataset.path.replace(/\\\\/g, '\\') });
        })
    );

    if (totalBar) {
        const totalMs = folders.reduce((sum, f) => {
            const ms = f.EstimatedMs ?? f.estimatedMs ?? 0;
            return sum + (ms === -1 ? 0 : ms);
        }, 0);

        const valEl = totalBar.querySelector('.folder-total-value');
        if (valEl) valEl.textContent = formatTime(totalMs);
        totalBar.style.display = 'flex';
    }
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

/* Seção: Cards e interações */
function createGameCard(data) {
    const grid = document.getElementById('gameGrid');
    const btnAdd = document.getElementById('btnAdd');
    const card = document.createElement('div');

    if (grid.querySelectorAll('.card:not(.add-card)').length >= 12) return;

    card.className = 'card';
    card.tabIndex = 0;

    const gameId = data.launchUrl || data.path;
    card.dataset.gameId = gameId;
    card.dataset.hero = data.hero || '';
    card.dataset.logo = data.logo || '';
    card.dataset.vertical = data.imageData || '';
    card.dataset.horizontal = data.horizontalImage || '';
    card.dataset.staticVertical = data.staticImageData || '';
    card.dataset.staticHorizontal = data.staticHorizontalImage || '';
    card.dataset.staticHero = data.staticHero || '';
    card.dataset.staticLogo = data.staticLogo || '';

    if (data.isFeatured) card.classList.add('featured');
    if (newGameIdsThisSession.has(gameId)) card.classList.add('new-game');

    const img = document.createElement('img');
    img.decoding = 'async';

    Promise.all([
        processImage(card, card.dataset.vertical, 'staticVertical', 'GridStatic', gameId),
        processImage(card, card.dataset.horizontal, 'staticHorizontal', 'HorizontalStatic', gameId),
        processImage(card, card.dataset.hero, 'staticHero', 'HeroStatic', gameId),
        processImage(card, card.dataset.logo, 'staticLogo', 'LogoStatic', gameId),
    ]).then(() => {
        const src = card.classList.contains('featured')
            ? (card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical)
            : (card.dataset.staticVertical || card.dataset.vertical);
        if (src) { img.src = src; img.style.opacity = '1'; }
    });

    const startInteraction = async () => {
        const bgSrc = card.dataset.staticVertical || card.dataset.vertical;
        const logoSrc = card.dataset.staticLogo || card.dataset.logo;
        const heroSrc = card.dataset.staticHero || card.dataset.hero || card.dataset.staticHorizontal || card.dataset.horizontal || bgSrc;

        switchHeroBackground(bgSrc, logoSrc, heroSrc);

        if (card._animTimer) clearTimeout(card._animTimer);
        card._animTimer = setTimeout(async () => {
            const active = () => document.activeElement === card || card.matches(':hover');
            if (!active()) return;
            const animGrid = card.classList.contains('featured') ? (card.dataset.horizontal || card.dataset.vertical) : card.dataset.vertical;
            if (animGrid) await setImgSrc(img, animGrid);

            const animHero = card.dataset.hero;
            if (animHero && animHero !== (card.dataset.staticHero || animHero) && active())
                await setImgSrc(document.getElementById('heroImage'), animHero);

            const animLogo = card.dataset.logo;
            if (animLogo && animLogo !== (card.dataset.staticLogo || animLogo) && active()) {
                const logoEl = document.getElementById('gameLogo');
                if (logoEl) { await setImgSrc(logoEl, animLogo); logoEl.classList.add('visible'); }
            }
        }, 200);
    };

    const stopInteraction = () => {
        if (card._animTimer) clearTimeout(card._animTimer);
        if (document.activeElement === card || card.matches(':hover')) return;

        const staticGrid = card.classList.contains('featured')
            ? (card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical)
            : (card.dataset.staticVertical || card.dataset.vertical);
        setImgSrc(img, staticGrid);

        const bgBlur = document.getElementById('bgBlur');
        const heroImg = document.getElementById('heroImage');
        const logoEl = document.getElementById('gameLogo');
        const gridBgImg = document.getElementById('gridBgImg');

        if (bgBlur) bgBlur.style.opacity = '0';
        if (heroImg) heroImg.style.opacity = '0';
        if (logoEl) logoEl.classList.remove('visible');
        if (gridBgImg) gridBgImg.removeAttribute('src');

        _currentBgSrc = '';
    };

    card._startInteraction = startInteraction;
    card._stopInteraction = stopInteraction;
    card.addEventListener('mouseenter', startInteraction);
    card.addEventListener('mouseleave', stopInteraction);
    card.addEventListener('focus', () => { pendingInteractionCard = card; signalNavigation(); });
    card.addEventListener('blur', () => { if (pendingInteractionCard === card) pendingInteractionCard = null; stopInteraction(); });
    card.addEventListener('click', () => {
        postToHost({
            action: 'launch',
            path: gameId,
            errorMsg: t('msgErrorLaunch')
        });
    });

    card.appendChild(img);
    const title = document.createElement('div');
    title.className = 'title';
    title.innerText = data.name;
    card.appendChild(title);

    if (btnAdd) {
        grid.insertBefore(card, btnAdd);
    } else {
        grid.appendChild(card);
    }

    if (data.isFeatured) {
        startInteraction();
    }
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
function cancelHeroTransition() { if (_heroTimer) { clearTimeout(_heroTimer); _heroTimer = null; } }

function switchHeroBackground(bgSrc, logoSrc, heroSrc) {
    const bgBlur = document.getElementById('bgBlur');
    const heroImg = document.getElementById('heroImage');
    const logoImg = document.getElementById('gameLogo');
    if (!bgBlur || !bgSrc) return;

    if (_currentBgSrc.split('?')[0] === bgSrc.split('?')[0]) return;
    _currentBgSrc = bgSrc;

    bgBlur.style.opacity = '0';
    if (heroImg) heroImg.style.opacity = '0';
    if (logoImg) logoImg.classList.remove('visible');
    cancelHeroTransition();

    _heroTimer = setTimeout(async () => {
        await setImgSrc(bgBlur, bgSrc);
        bgBlur.style.opacity = '1';

        const gridBg = document.getElementById('gridBgImg');
        if (gridBg) setImgSrc(gridBg, heroSrc);

        if (heroImg) { await setImgSrc(heroImg, heroSrc || bgSrc); heroImg.style.opacity = '1'; }
        if (logoImg && logoSrc) { await setImgSrc(logoImg, logoSrc); logoImg.classList.add('visible'); }
    }, 150);
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
    if (!src) { imgEl.removeAttribute('src'); return; }
    if (imgEl.src === src || imgEl.src.endsWith(src)) return;
    const tmp = new Image();
    tmp.src = src;
    try { await tmp.decode(); } catch (_) { }
    if (imgEl.__req !== req) return;
    imgEl.src = src;
}

/* Seção: Injeção de estilos e elementos auxiliares */
(function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
        /* ▼ Efeito de Profundidade ao abrir o NavMenu ▼ */
.main-content-wrapper {
    transition: transform 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.1),
                filter 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.1),
                opacity 0.3s ease;
    will-change: transform, filter;
}
body.nav-menu-active .main-content-wrapper {
    transform: scale(0.96) translateY(8px);
    filter: blur(6px) brightness(0.92);
    opacity: 0.94;
    transition-delay: 0.02s;
}
.nav-menu {
    transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.4, 1), opacity 0.4s ease;
    transform-origin: top right;
}

body.nav-menu-active .nav-menu {
    transform: scale(1) translateX(0) !important;
    opacity: 1;
}
    /* ▼ Novo Indicador Sutil ▼ */
    #navHintDown {
        position: fixed;
        bottom: 1px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 7500;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.4s ease;

        /* Estilo idêntico ao botão de voltar */
        display: flex;
        align-items: center;
        gap: 8px;
        color: rgba(255,255,255,0.4);
        font-size: clamp(0.7rem, 0.8vw, 0.9rem);
        font-weight: 500;
        letter-spacing: 0.06em;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        padding: 2px 90px;
        border-radius: 20px;
        backdrop-filter: blur(5px);
    }
       #navHintDown span {
        font-family: 'Inter', sans-serif;
        font-size: clamp(9px, 1vmin, 11px);
        font-weight: 700;
        letter-spacing: 0.15em;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
    }
    #navHintDown.visible {
        opacity: 1;
    }
#navHintDown.visible {
    opacity: 1;
   
}
    #navHintDown .arrow-icon {
        font-size: 1.2em;
        opacity: 0.8;
        margin-top: 1px;
    }

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
    .ctx-separator { height: 1px; background: rgba(255,255,255,0.07); margin: 4px 2px; }
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

    .card.removing {
        opacity: 0 !important; transform: scale(0.88) !important;
        transition: opacity 0.25s ease, transform 0.25s ease !important;
        pointer-events: none !important;
    }

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
    `;
    document.head.appendChild(s);
})();

/* ── Menu de Contexto & Outros ── */
// ... [O resto do código, como menu de contexto e teclado virtual, permanece o mesmo] ...

// =============================================================================
// Indicador Flutuante (Menu Seta para Baixo)
// =============================================================================
// =============================================================================
// Indicador Flutuante (Menu Seta para Baixo)
// =============================================================================
(function initNavHint() {
    const navHint = document.createElement('div');
    navHint.id = 'navHintDown';

    // Estrutura idêntica ao nav-back-item do menu
    navHint.innerHTML = `
        <span class="arrow-icon">⇣</span>
        <span>Menu</span> 
    `;
    document.body.appendChild(navHint);

    window.updateNavHint = function () {
        const hint = document.getElementById('navHintDown');
        if (!hint) return;

        const focused = document.activeElement;
        const isCard = focused?.classList?.contains('card') && !focused?.classList?.contains('add-card');
        const inGrid = focused?.closest('#gameGrid') || focused?.closest('#mediaGrid');

        // Esconde em modais/menus abertos
        const isOverlayOpen = window.isModalOpen || window.isSetupOpen || window.isNavMenuOpen ||
            window._vkbIsOpen || window.isGlobalLoading ||
            (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) ||
            (typeof isEditModalOpen !== 'undefined' && isEditModalOpen);

        if (isOverlayOpen) {
            hint.classList.remove('visible');
            return;
        }

        // Mostra apenas se estiver no Grid
        if (isCard && inGrid) {
            hint.classList.add('visible');
        } else {
            hint.classList.remove('visible');
        }
    };

    document.addEventListener('focusin', window.updateNavHint);
    document.addEventListener('focusout', window.updateNavHint);
})();
// ── Fundo animado (blobs) — aparece quando não há hero ativo ──────────────────
(function initBlobBackground() {
    const canvas = document.createElement('canvas');
    canvas.id = 'appBlobBg';
    canvas.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;z-index:-1;' +
        'pointer-events:none;opacity:0;transition:opacity 0.6s ease;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    const blobs = [
        { px: 0.0, py: 0.3, sx: 0.00018, sy: 0.00013, r: 0.62, color: [45, 65, 185] },
        { px: 1.2, py: 2.1, sx: 0.00014, sy: 0.00019, r: 0.56, color: [28, 85, 210] },
        { px: 2.5, py: 0.8, sx: 0.00022, sy: 0.00011, r: 0.52, color: [70, 50, 165] },
        { px: 0.7, py: 3.4, sx: 0.00016, sy: 0.00024, r: 0.50, color: [22, 110, 175] },
        { px: 3.1, py: 1.6, sx: 0.00012, sy: 0.00017, r: 0.46, color: [90, 70, 195] },
        { px: 1.8, py: 4.2, sx: 0.00020, sy: 0.00015, r: 0.42, color: [30, 130, 190] },
    ];

    let t = 0, _raf = null;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function frame() {
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#07071a';
        ctx.fillRect(0, 0, W, H);

        blobs.forEach(b => {
            const x = W * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t * b.sx + b.px)));
            const y = H * (0.10 + 0.8 * (0.5 + 0.5 * Math.sin(t * b.sy + b.py)));
            const r = Math.min(W, H) * b.r;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const [cr, cg, cb] = b.color;
            g.addColorStop(0, `rgba(${cr},${cg},${cb},0.55)`);
            g.addColorStop(0.4, `rgba(${cr},${cg},${cb},0.22)`);
            g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.72, t * 0.00004, 0, Math.PI * 2);
            ctx.fill();
        });

        // Vignette
        const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,18,0.62)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);

        t++;
        _raf = requestAnimationFrame(frame);
    }

    frame();

    // ── Observa o bgBlur para mostrar/esconder o blob ─────────────────────────

    let _blobShowTimer = null;

    function checkHeroState() {
        const bgBlur = document.getElementById('bgBlur');
        const heroInactive = !bgBlur?.src || bgBlur.style.opacity === '0' || !bgBlur.src;

        if (heroInactive) {
            // Aguarda 400ms antes de mostrar — evita flicker na troca de banners
            if (!_blobShowTimer) {
                _blobShowTimer = setTimeout(() => {
                    // Confirma que o hero ainda está inativo após o delay
                    const stillInactive = !bgBlur?.src || bgBlur.style.opacity === '0';
                    if (stillInactive) canvas.style.opacity = '1';
                    _blobShowTimer = null;
                }, 400);
            }
        } else {
            // Esconde imediatamente quando hero ativa
            if (_blobShowTimer) { clearTimeout(_blobShowTimer); _blobShowTimer = null; }
            canvas.style.opacity = '0';
        }
    }

    // Observa mudanças no bgBlur (src e style)
    const bgBlur = document.getElementById('bgBlur');
    if (bgBlur) {
        new MutationObserver(checkHeroState).observe(bgBlur, {
            attributes: true,
            attributeFilter: ['src', 'style']
        });
    }

    // Verifica também sempre que switchHeroBackground é chamado
    const _origSwitch = window.switchHeroBackground;
    window.switchHeroBackground = function (...args) {
        _origSwitch?.(...args);
        // Pequeno delay para o bgBlur ter tempo de atualizar o opacity
        setTimeout(checkHeroState, 200);
    };

    // Checagem inicial
    checkHeroState();
})();
document.addEventListener('focusin', () => {
    const focused = document.activeElement;
    const isCard = focused?.classList?.contains('card');
    const isInGrid = focused?.closest('#gameGrid');

    if (!isCard && !isInGrid) {
        const bgBlur = document.getElementById('bgBlur');
        const heroImg = document.getElementById('heroImage');
        const logoEl = document.getElementById('gameLogo');
        const gridBgImg = document.getElementById('gridBgImg');

        if (bgBlur) bgBlur.style.opacity = '0';
        if (heroImg) heroImg.style.opacity = '0';
        if (logoEl) logoEl.classList.remove('visible');
        if (gridBgImg) gridBgImg.removeAttribute('src');

        _currentBgSrc = '';
    }
});

function clearHero() {
    const bgBlur = document.getElementById('bgBlur');
    const heroImg = document.getElementById('heroImage');
    const logoEl = document.getElementById('gameLogo');
    const gridBgImg = document.getElementById('gridBgImg');

    if (bgBlur) bgBlur.style.opacity = '0';
    if (heroImg) heroImg.style.opacity = '0';
    if (logoEl) logoEl.classList.remove('visible');
    if (gridBgImg) gridBgImg.removeAttribute('src');

    _currentBgSrc = '';
}

document.getElementById('btnAdd')?.addEventListener('mouseenter', clearHero);
document.getElementById('btnAdd')?.addEventListener('focus', clearHero);

document.getElementById('btnAddMedia')?.addEventListener('mouseenter', clearHero);
document.getElementById('btnAddMedia')?.addEventListener('focus', clearHero);