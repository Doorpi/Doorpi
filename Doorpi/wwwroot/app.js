// =============================================================================
// app.js — Aplicação
// Bridge com C#, modal, cards, hero, badges e loading.
// Depende de: strings.js (t()), navigation.js (isModalOpen, pendingInteractionCard,
//             signalNavigation(), focusItemByIndex())
// =============================================================================

// ── Estado da aplicação ────────────────────────────────────────────────────────
let allInstalledApps    = [];
let currentSourceFilter = 'all';
const newGameIdsThisSession = new Set();

// ── Plataformas ────────────────────────────────────────────────────────────────

const PLATFORMS = {
    Steam:   { type: 'url', icon: 'https://cdn.simpleicons.org/steam/1b9bd4' },
    Epic:    { type: 'url', icon: 'https://cdn.simpleicons.org/epicgames/a0a0a0' },
    GOG:     { type: 'url', icon: 'https://cdn.simpleicons.org/gogdotcom/8a4fff' },
    Folder:  { type: 'url', icon: 'https://cdn.simpleicons.org/files/f0a500' },
    Windows: { type: 'svg', icon: `<svg viewBox="0 0 88 88" fill="#0078d4" xmlns="http://www.w3.org/2000/svg"><path d="M0 12.4 35.7 7.6V42H0zm40.3-5.5L88 0v42H40.3zM0 46h35.7v34.4L0 75.6zm40.3.1H88V88L40.3 81.4z"/></svg>` },
};

// Chave do filtro → Sources do C# que representa
const FILTER_SOURCES = {
    all:     null,
    Steam:   ['Steam'],
    Epic:    ['Epic'],
    GOG:     ['GOG'],
    Windows: ['Windows', 'Folder'],
};

// Plataformas na ordem da animação de loading
const SCAN_LIBS = ['Steam', 'Epic', 'GOG', 'Windows', 'Folder'];

// ── Relógio ────────────────────────────────────────────────────────────────────
setInterval(() => {
    document.getElementById('clock').innerText =
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}, 1000);

// ── WebView Bridge ─────────────────────────────────────────────────────────────
if (window.chrome?.webview) {
    window.chrome.webview.addEventListener('message', event => {
        try {
            const data = JSON.parse(event.data);
            if      (data.type === 'newGame')           createGameCard(data);
            else if (data.type === 'installedAppsList') { allInstalledApps = data.apps; applyFilterAndRender(); }
            else if (data.type === 'staticSaved')       updateToLocalFile(data.gameId, data.imageType, data.newUrl);
        } catch (e) { console.error('[bridge] Erro:', e); }
    });
}

function postToHost(payload) {
    window.chrome?.webview?.postMessage(JSON.stringify(payload));
}

// Atualiza o dataset e a imagem do card quando o C# persiste um frame estático
function updateToLocalFile(gameId, imageType, newUrl) {
    const card = document.querySelector(`.card[data-game-id="${gameId.replace(/\\/g, '\\\\')}"]`);
    if (!card) return;

    const keyMap = { GridStatic: 'staticVertical', HorizontalStatic: 'staticHorizontal', HeroStatic: 'staticHero', LogoStatic: 'staticLogo' };
    const key    = keyMap[imageType];
    if (!key) return;

    card.dataset[key] = newUrl;

    const img        = card.querySelector('img');
    const isFeatured = card.classList.contains('featured');
    if (img && document.activeElement !== card && !card.matches(':hover')) {
        if ((isFeatured && key === 'staticHorizontal') || (!isFeatured && key === 'staticVertical')) {
            img.src = newUrl;
            img.style.opacity = '1';
        }
    }
    if (isFeatured && key === 'staticHero')
        switchHeroBackground(newUrl, card.dataset.staticLogo || card.dataset.logo);
}

// ── Filtros ────────────────────────────────────────────────────────────────────
function buildFilterBar(apps) {
    const bar = document.getElementById('filterBar');
    if (!bar) return;

    const present = new Set(apps.map(a => a.Source || a.source));
    const keys    = ['all', ...Object.keys(FILTER_SOURCES).filter(k =>
        k !== 'all' && FILTER_SOURCES[k].some(s => present.has(s))
    )];

    bar.innerHTML = keys.map(k => `
        <button class="filter-btn ${currentSourceFilter === k ? 'active' : ''}" tabindex="0" data-source="${k}">
            ${t('filterLabels.' + k)}
        </button>
    `).join('');

    bar.querySelectorAll('.filter-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            currentSourceFilter = btn.dataset.source;
            applyFilterAndRender();
            setTimeout(() => document.querySelector(`.filter-btn[data-source="${currentSourceFilter}"]`)?.focus(), 50);
        })
    );
}

function applyFilterAndRender() {
    const sources  = FILTER_SOURCES[currentSourceFilter];
    const filtered = !sources
        ? allInstalledApps
        : allInstalledApps.filter(a => sources.includes(a.Source || a.source));
    populateAppModal(filtered);
}

// ── Modal ──────────────────────────────────────────────────────────────────────
document.getElementById('btnAdd').addEventListener('click', () => {
    postToHost({ action: 'requestInstalledApps' });
    isModalOpen = true;
    document.getElementById('modalActions').style.display     = 'none';
    document.getElementById('gameGrid').style.overflowX       = 'hidden';
    document.getElementById('addGameContainer').style.display = 'flex';
    document.getElementById('modalTitle').innerText           = t('detectingLibrary');
    renderModalLoading();
});

function closeModal() {
    document.getElementById('addGameContainer').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX       = 'auto';
    document.getElementById('selectionCounter')?.classList.remove('visible');
    isModalOpen = false;
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

    // Rebind dos botões do header (evita listeners duplicados)
    const rebind = (id, fn) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const fresh = btn.cloneNode(true);
        btn.replaceWith(fresh);
        fresh.addEventListener('click', fn);
    };
    rebind('btnSearch',    () => postToHost({ action: 'browseManual' }));
    rebind('btnScanFolder', () => { titleEl.innerText = t('waitingFolder'); postToHost({ action: 'pickFolder' }); });

    buildFilterBar(allInstalledApps);

    const appList = document.getElementById('appList');
    appList.innerHTML = apps.map(app => {
        const isAdded  = app.IsAdded  === true || app.isAdded === true;
        const icon     = app.IconBase64 || app.iconBase64;
        const name     = app.Name     || app.name;
        const path     = app.Path     || app.path;
        const size     = app.Size     ?? app.size;
        const launch   = app.LaunchUrl || app.launchUrl || '';
        const source   = app.Source   || app.source;

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
            const text    = document.getElementById('selectionCounterText');
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
            titleEl.innerText = t('downloadingCovers');
            appList.innerHTML = '';
            document.getElementById('modalActions').style.display = 'none';
            setTimeout(closeModal, 3000);
        } else {
            closeModal();
        }
    });

    setTimeout(() => {
        const first = appList.querySelector('.app-item[tabindex="0"]');
        if (first) first.focus();
        else document.getElementById('btnScanFolder')?.focus();
    }, 150);
}

// ── Cards ──────────────────────────────────────────────────────────────────────
function createGameCard(data) {
    const grid   = document.getElementById('gameGrid');
    const btnAdd = document.getElementById('btnAdd');
    const card   = document.createElement('div');

    card.className = 'card';
    card.tabIndex  = 0;

    const gameId = data.launchUrl || data.path;
    card.dataset.gameId            = gameId;
    card.dataset.hero              = data.hero                  || '';
    card.dataset.logo              = data.logo                  || '';
    card.dataset.vertical          = data.imageData             || '';
    card.dataset.horizontal        = data.horizontalImage       || '';
    card.dataset.staticVertical    = data.staticImageData       || '';
    card.dataset.staticHorizontal  = data.staticHorizontalImage || '';
    card.dataset.staticHero        = data.staticHero            || '';
    card.dataset.staticLogo        = data.staticLogo            || '';

    if (data.isFeatured) card.classList.add('featured');
    if (newGameIdsThisSession.has(gameId)) card.classList.add('new-game');

    const img    = document.createElement('img');
    img.decoding = 'async';

    // Extrai frame estático de imagens animadas e manda o C# persistir
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
        processImage(card.dataset.vertical,   'staticVertical',   'GridStatic'),
        processImage(card.dataset.horizontal,  'staticHorizontal', 'HorizontalStatic'),
        processImage(card.dataset.hero,        'staticHero',       'HeroStatic'),
        processImage(card.dataset.logo,        'staticLogo',       'LogoStatic'),
    ]).then(() => {
        const src = card.classList.contains('featured') ? card.dataset.staticHorizontal : card.dataset.staticVertical;
        if (src) { img.src = src; img.style.opacity = '1'; }
    });

    // Interações de hover / foco
    const startInteraction = async () => {
        const bgSrc   = card.dataset.staticVertical   || card.dataset.vertical;
        const logoSrc = card.dataset.staticLogo       || card.dataset.logo;
        const heroSrc = card.dataset.staticHero       || card.dataset.hero
                     || card.dataset.staticHorizontal  || card.dataset.horizontal || bgSrc;

        switchHeroBackground(bgSrc, logoSrc, heroSrc);

        if (card._animTimer) clearTimeout(card._animTimer);
        card._animTimer = setTimeout(async () => {
            const active = () => document.activeElement === card || card.matches(':hover');
            if (!active()) return;

            const animGrid = card.classList.contains('featured')
                ? (card.dataset.horizontal || card.dataset.vertical)
                : card.dataset.vertical;
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
            : (card.dataset.staticVertical   || card.dataset.vertical);
        setImgSrc(img, staticGrid);

        const staticHero = card.dataset.staticHero || card.dataset.hero;
        if (staticHero) setImgSrc(document.getElementById('heroImage'), staticHero);

        const staticLogo = card.dataset.staticLogo || card.dataset.logo;
        const logoEl     = document.getElementById('gameLogo');
        if (logoEl && staticLogo) setImgSrc(logoEl, staticLogo);
    };

    // Expõe para navigation.js
    card._startInteraction = startInteraction;
    card._stopInteraction  = stopInteraction;

    card.addEventListener('mouseenter', startInteraction);
    card.addEventListener('mouseleave', stopInteraction);
    card.addEventListener('focus', () => { pendingInteractionCard = card; signalNavigation(); });
    card.addEventListener('blur',  () => { if (pendingInteractionCard === card) pendingInteractionCard = null; stopInteraction(); });
    card.addEventListener('click', () => { postToHost({ action: 'launch', path: gameId }); moveCardToTop(card); });

    card.appendChild(img);
    const title = document.createElement('div');
    title.className = 'title';
    title.innerText = data.name;
    card.appendChild(title);

    if (data.isFeatured) {
        grid.insertBefore(card, btnAdd);
        startInteraction();
    } else {
        const featured = grid.querySelector('.card.featured');
        grid.insertBefore(card, featured ? featured.nextSibling : grid.firstChild);
    }
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
    if (img) img.src = card.dataset.staticHorizontal || card.dataset.horizontal
                    || card.dataset.staticVertical   || card.dataset.vertical;
}

// ── Hero background ────────────────────────────────────────────────────────────
let _heroTimer   = null;
let _currentBgSrc = '';

function cancelHeroTransition() {
    if (_heroTimer) { clearTimeout(_heroTimer); _heroTimer = null; }
}

function switchHeroBackground(bgSrc, logoSrc, heroSrc) {
    const bgBlur  = document.getElementById('bgBlur');
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

// ── Badge de plataforma ────────────────────────────────────────────────────────
function getPlatformBadge(source) {
    const p = PLATFORMS[source];
    if (!p) return '';
    const label = t('platformLabels.' + source);
    const inner = p.type === 'url' ? `<img src="${p.icon}" alt="${label}" />` : p.icon;
    return `<span class="platform-badge" title="${label}">${inner}</span>`;
}

// ── Modal loading ──────────────────────────────────────────────────────────────
function renderModalLoading() {
    const libs = SCAN_LIBS
        .map((k, i) => `<div class="vb-lib ${i === 0 ? 'scanning' : ''}">${t('scanLibLabels.' + k)}</div>`)
        .join('');

    document.getElementById('appList').innerHTML = `
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
                    <div class="vb-title">${t('detectingLibrary')}</div>
                    <div class="vb-subtitle">${t('readingApps')}</div>
                    <div class="vb-dots"><span></span><span></span><span></span></div>
                    <div class="vb-libs" id="vbLibs">${libs}</div>
                </div>
            </div>
            <div class="vb-progress"><div class="vb-progress-fill"></div></div>
        </div>`;

    let cur = 0;
    const libEls = document.querySelectorAll('#vbLibs .vb-lib');
    const iv = setInterval(() => {
        if (!isModalOpen) { clearInterval(iv); return; }
        libEls.forEach(l => l.classList.remove('scanning'));
        libEls[cur].classList.add('scanning');
        cur = (cur + 1) % libEls.length;
    }, 700);
}

// ── Utilitários de imagem ──────────────────────────────────────────────────────
async function getAnimatedBlob(url) {
    if (!url) return null;
    try {
        const res   = await fetch(url);
        if (!res.ok) return null;
        const blob  = await res.blob();
        const bytes = new Uint8Array(await blob.slice(0, 256).arrayBuffer());
        const APNG  = [0x61, 0x63, 0x54, 0x4C], WEBP = [0x41, 0x4E, 0x49, 0x4D];
        let isAnim  = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
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
    try { await tmp.decode(); } catch (_) {}
    if (imgEl.__req !== req) return;
    imgEl.src = src;
}
