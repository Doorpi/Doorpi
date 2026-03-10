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
        else if (data.type === 'staticSaved') {
            updateToLocalFile(data.gameId, data.imageType, data.newUrl);
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
    } catch (e) { console.error('[bridge] Erro:', e); }
});

function postToHost(payload) {
    window.chrome?.webview?.postMessage(JSON.stringify(payload));
}

/* Seção: Overlay de Loading */
function showGlobalLoading(titleText, subtitleText) {
    window.isGlobalLoading = true;
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

    if (!isModalOpen) {
        setTimeout(() => focusItemByIndex(0), 50);
    }
}

/* Seção: Utilitários de atualização de imagens */
function updateToLocalFile(gameId, imageType, newUrl) {
    const card = document.querySelector(`.card[data-game-id="${gameId.replace(/\\/g, '\\\\')}"]`);
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

    if (isApps) {
        const firstApp = document.querySelector('#appList .app-item[tabindex="0"]');
        if (firstApp) {
            firstApp.focus();
        }
    }
    // ---------------------------

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
        // Verifica se a chave está no array de filtros ativos
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
                const todosBotoes = Array.from(document.querySelectorAll('.filter-bar .filter-btn'));

               
                const disponiveis = todosBotoes.filter(b => !b.classList.contains('active') && b.offsetWidth > 0);

               
                const indexAtual = disponiveis.indexOf(btn);

                if (indexAtual > -1 && disponiveis[indexAtual + 1]) {
                    disponiveis[indexAtual + 1].focus();
                } else if (disponiveis.length > 0) {
                 
                    disponiveis[0].focus();
                }
            }, 10);
        })
    );
}

function applyFilterAndRender() {
    let filtered;

    if (currentSourceFilter.includes('all')) {
        filtered = allInstalledApps;
    } else {
        // Criamos uma lista de todas as plataformas permitidas (ex: ['Steam', 'Epic'])
        const allowedPlatforms = currentSourceFilter.flatMap(f => FILTER_SOURCES[f]);
        filtered = allInstalledApps.filter(a => allowedPlatforms.includes(a.Source || a.source));
    }

    populateAppModal(filtered);
}

/* Seção: Modal de adição de jogos */
document.getElementById('btnAdd').addEventListener('click', () => {
    isModalOpen = true;

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
    titleEl.innerText = currentSourceFilter === 'all' ? t('selectApps') : t('showingStore', currentSourceFilter);

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

    const first = appList.querySelector('.app-item[tabindex="0"]');
    if (first) {
        first.focus();
    } else {
        document.getElementById('btnScanFolder')?.focus();
    }

 
    if (!isFolderOperationInProgress) {
        hideGlobalLoading();
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

        // ▼ Verifica se é lenta para aplicar o alerta visual na UI
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
            
            <!-- ▼ Aviso que só aparece se a pasta for 'Lenta' (Lidado pelo CSS) -->
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
        // Ignora pastas que estão em "-1" no cálculo do tempo total
        const totalMs = folders.reduce((sum, f) => {
            const ms = f.EstimatedMs ?? f.estimatedMs ?? 0;
            return sum + (ms === -1 ? 0 : ms);
        }, 0);

        const valEl = totalBar.querySelector('.folder-total-value');
        if (valEl) valEl.textContent = formatTime(totalMs);
        totalBar.style.display = 'flex';
    }

    setTimeout(() => list.querySelector('.icon-btn[tabindex="0"]')?.focus(), 80);
}

/* Seção: Cards e interações */
function createGameCard(data) {
    const grid = document.getElementById('gameGrid');
    const btnAdd = document.getElementById('btnAdd');
    const card = document.createElement('div');
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

    const processImage = async (src, dsKey, imageType) => {
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
                    postToHost({ action: 'saveStaticFrame', gameId, imageType, base64: c.toDataURL('image/png') });
                } catch { card.dataset[dsKey] = src; }
                finally { URL.revokeObjectURL(blobUrl); resolve(); }
            };
            tmp.onerror = () => { card.dataset[dsKey] = src; URL.revokeObjectURL(blobUrl); resolve(); };
            tmp.src = blobUrl;
        });
    };

    Promise.all([
        processImage(card.dataset.vertical, 'staticVertical', 'GridStatic'),
        processImage(card.dataset.horizontal, 'staticHorizontal', 'HorizontalStatic'),
        processImage(card.dataset.hero, 'staticHero', 'HeroStatic'),
        processImage(card.dataset.logo, 'staticLogo', 'LogoStatic'),
    ]).then(() => {
        const src = card.classList.contains('featured') ? card.dataset.staticHorizontal : card.dataset.staticVertical;
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

        const staticHero = card.dataset.staticHero || card.dataset.hero;
        if (staticHero) setImgSrc(document.getElementById('heroImage'), staticHero);

        const staticLogo = card.dataset.staticLogo || card.dataset.logo;
        const logoEl = document.getElementById('gameLogo');
        if (logoEl && staticLogo) setImgSrc(logoEl, staticLogo);
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
        moveCardToTop(card);
    });

    card.appendChild(img);
    const title = document.createElement('div');
    title.className = 'title';
    title.innerText = data.name;
    card.appendChild(title);

    if (data.isFeatured) { grid.insertBefore(card, btnAdd); startInteraction(); }
    else { const featured = grid.querySelector('.card.featured'); grid.insertBefore(card, featured ? featured.nextSibling : grid.firstChild); }
}

function moveCardToTop(card) {
    if (!card) return;
    const grid = document.getElementById('gameGrid');
    document.querySelectorAll('.card.featured').forEach(c => {
        c.classList.remove('featured');
        const img = c.querySelector('img');
        if (img) img.src = c.dataset.staticVertical || c.dataset.vertical;
    });
    card.classList.add('featured');
    grid.prepend(card);
    const img = card.querySelector('img');
    if (img) img.src = card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical;
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
    `;
    document.head.appendChild(s);
})();

/* Seção: Menu de contexto */
const _ctxMenu = (() => {
    const el = document.createElement('div');
    el.className = 'context-menu';
    el.setAttribute('role', 'menu');

    el.innerHTML = `
        <div class="ctx-game-name" id="ctxGameName"></div>
        <div class="ctx-separator"></div>
        <button class="ctx-item" id="ctxEdit" role="menuitem"><span class="ctx-icon">✎</span> <span data-i18n="ctxEditName"></span></button>
        <div class="ctx-separator"></div>
        <button class="ctx-item ctx-danger" id="ctxDelete" role="menuitem"><span class="ctx-icon">✕</span> <span data-i18n="ctxRemoveGame"></span></button>
    `;
    document.body.appendChild(el);
    return el;
})();

let _ctxCard = null;

function _openCtxMenu(card, x, y) {
    _ctxCard = card;

    _ctxCard.classList.add('ctx-active');

    _ctxMenu.querySelector('#ctxGameName').textContent = card.querySelector('.title')?.innerText?.trim() || '';
    _ctxMenu.style.display = 'flex';
    requestAnimationFrame(() => {
        const w = _ctxMenu.offsetWidth, h = _ctxMenu.offsetHeight, m = 10;
        _ctxMenu.style.left = Math.min(x, window.innerWidth - w - m) + 'px';
        _ctxMenu.style.top = Math.min(y, window.innerHeight - h - m) + 'px';
        _ctxMenu.classList.add('visible');
        isCtxMenuOpen = true;
        _ctxMenu.querySelector('#ctxEdit')?.focus();
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
document.getElementById('ctxDelete').addEventListener('click', () => {
    const card = _ctxCard; _closeCtxMenu();
    if (card) _executeDelete(card);
});

/* Seção: Deleção */
function _executeDelete(card) {
    const gameId = card.dataset.gameId;
    if (!gameId) return;
    if (card.classList.contains('featured')) {
        const next = Array.from(document.querySelectorAll('#gameGrid .card:not(.add-card)')).find(c => c !== card);
        if (next) {
            next.classList.add('featured');
            const img = next.querySelector('img');
            if (img) img.src = next.dataset.staticHorizontal || next.dataset.horizontal || next.dataset.staticVertical || '';
            next._startInteraction?.();
        } else {
            ['bgBlur', 'heroImage'].forEach(id => document.getElementById(id)?.removeAttribute('src'));
            document.getElementById('gameLogo')?.classList.remove('visible');
        }
    }
    card.classList.add('removing');
    setTimeout(() => card.remove(), 280);
    postToHost({ action: 'deleteGame', gameId });
}

/* Seção: Modal de edição */
let _editCard = null;
let _editOverlay = null;

function openEditGameModal(card) {
    const currentName = card.querySelector('.title')?.innerText?.trim() || '';
    _editCard = card;

    const overlay = document.createElement('div');
    overlay.className = 'edit-modal-overlay';
    _editOverlay = overlay;

    overlay.innerHTML = `
        <div class="edit-modal" role="dialog" aria-modal="true" aria-label="${t('editModalTitle')}">
            <div class="edit-modal-header">
                <div>
                    <h3 class="edit-modal-title">${t('editModalTitle')}</h3>
                    <p class="edit-modal-subtitle">${t('editModalSubtitle')}</p>
                </div>
            </div>
            <div class="edit-modal-body">
                <div class="edit-modal-field">
                    <label class="edit-modal-label" for="editNameInput">${t('editModalFieldName')}</label>
                    <input class="edit-modal-input" id="editNameInput" type="text" autocomplete="off" spellcheck="false" />
                    <span class="edit-modal-input-hint">${t('editModalHint')}</span>
                </div>
            </div>
            <div class="edit-modal-actions">
                <button class="modal-btn cancel" id="editCancelBtn">${t('editModalCancel')}</button>
                <button class="modal-btn primary" id="editSaveBtn">${t('editModalSave')}</button>
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
        _editCard?.focus();
        _editCard = null;
    };

    const doSave = () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            _editCard?.querySelector('.title') && (_editCard.querySelector('.title').innerText = newName);
            postToHost({ action: 'editGame', gameId: card.dataset.gameId, newName });
        }
        doClose();
    };

    overlay.querySelector('#editSaveBtn').addEventListener('click', doSave);
    overlay.querySelector('#editCancelBtn').addEventListener('click', doClose);
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) doClose(); });

    input.addEventListener('keydown', e => {
        if (window._vkbIsOpen) return;
        if (e.key === 'Enter') { e.preventDefault(); doSave(); }
        if (e.key === 'Escape') { e.preventDefault(); doClose(); }
    });

    input.addEventListener('click', () => { if (!window._vkbIsOpen) window._vkbOpen?.(); });

    window._editModalClose = doClose;
    window._editModalSave = doSave;

    isEditModalOpen = true;

    requestAnimationFrame(() => {
        overlay.querySelector('#editSaveBtn')?.focus();
    });
}

/* Seção: Teclado Virtual */
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
    let _shifted = true;
    let _inputEl = null;

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
            btn.addEventListener('click', () => _pressKey(btn.dataset.key));
        });
    }

    function _renderPreview() {
        const el = document.getElementById('vkbPreview');
        if (!el || !_inputEl) return;
        const txt = _inputEl.value || '';
        el.innerHTML = txt
            ? `${_esc(txt)}<span class="vkb-cursor"></span>`
            : `<span class="vkb-cursor"></span>`;
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

    function _pressKey(key) {
        if (!_inputEl) return;
        if (key === '⌫') { _inputEl.value = _inputEl.value.slice(0, -1); }
        else if (key === 'shift') { _setShiftVisual(!_shifted); return; }
        else if (key === 'space') { _inputEl.value += ' '; }
        else if (key === 'ok') { window._editModalSave?.(); return; }
        else if (key === 'cancel') { window._editModalClose?.(); return; }
        else { _inputEl.value += _shifted ? key.toUpperCase() : key; }
        _inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        _renderPreview();
    }

    function _open() {
        _inputEl = document.getElementById('editNameInput');
        if (!_inputEl) return;
        _build();

        if (_el) {
            _el.querySelector('.vkb-preview-label').textContent = t('vkbPreviewLabel');
            _el.querySelector('[data-key="space"]').textContent = t('vkbSpace');
            _el.querySelector('[data-key="cancel"]').textContent = t('vkbCancel');
            _el.querySelector('[data-key="ok"]').textContent = t('vkbOk');
        }

        _setShiftVisual(_shifted);
        _renderPreview();
        _inputEl.addEventListener('input', _renderPreview);
        _inputEl.classList.add('vkb-active');
        _editOverlay?.classList.add('vkb-active');
        _el.style.display = 'block';
        requestAnimationFrame(() => {
            _el.classList.add('visible');
            window._vkbIsOpen = true;
            _el.querySelector('[data-key="q"]')?.focus();
        });
    }

    function _forceClose() {
        if (!_el) return;
        window._vkbIsOpen = false;
        _el.classList.remove('visible');
        if (_inputEl) {
            _inputEl.removeEventListener('input', _renderPreview);
            _inputEl.classList.remove('vkb-active');
            _inputEl = null;
        }
        _editOverlay?.classList.remove('vkb-active');
        setTimeout(() => { if (_el && !_el.classList.contains('visible')) _el.style.display = 'none'; }, 340);
    }

    function _cancel() {
        _forceClose();
        const input = document.getElementById('editNameInput');
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }

    function _physicalKey(key) {
        if (!_inputEl) return;
        if (key === 'Backspace') {
            _inputEl.value = _inputEl.value.slice(0, -1);
        } else if (key.length === 1) {
            _inputEl.value += key;
        }
        _inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        _renderPreview();
    }

    return { open: _open, forceClose: _forceClose, cancel: _cancel, physicalKey: _physicalKey, toggleShift: () => _setShiftVisual(!_shifted) };
})();

window._vkbOpen = () => VKB.open();
window._vkbCancel = () => VKB.cancel();
window._vkbForceClose = () => VKB.forceClose();
window._vkbPhysicalKey = (k) => VKB.physicalKey(k);
window._vkbToggleShift = () => VKB.toggleShift();

function _esc(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}