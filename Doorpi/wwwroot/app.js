let isModalOpen = false;
let allInstalledApps = [];
let currentSourceFilter = "all";

// Memória de foco por grupo (para retorno suave ao sair de um grupo)
let lastFocusedApp = null;
let lastFocusedFilter = null;
let lastFocusedSidebar = null;
let currentInteractiveCard = null;

// ========================= IDLE NAVIGATION =========================
const IDLE_MS = 180;
let navIdleTimeout = null;
let pendingInteractionCard = null;

// Opção A — jogos adicionados nesta sessão
const newGameIdsThisSession = new Set();

function onNavigationIdle() {
    if (pendingInteractionCard) {
        const card = pendingInteractionCard;
        pendingInteractionCard = null;
        if (document.activeElement === card || card.matches(':hover')) {
            card._startInteraction && card._startInteraction();
        }
    }
}

function signalNavigation() {
    if (navIdleTimeout) clearTimeout(navIdleTimeout);
    navIdleTimeout = setTimeout(onNavigationIdle, IDLE_MS);
}

// ========================= SELEÇÃO =========================
function updateSelectionCounter() {
    const count = document.querySelectorAll('.app-item.selected').length;
    const counter = document.getElementById('selectionCounter');
    const counterText = document.getElementById('selectionCounterText');
    if (!counter || !counterText) return;
    counterText.innerText = count === 1 ? '1 jogo selecionado' : `${count} jogos selecionados`;
    counter.classList.toggle('visible', count > 0);
}

function resetSelectionCounter() {
    const counter = document.getElementById('selectionCounter');
    if (counter) counter.classList.remove('visible');
}

// ========================= CLOCK =========================
setInterval(() => {
    const now = new Date();
    document.getElementById('clock').innerText =
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}, 1000);

// ========================= WEBVIEW =========================
if (window.chrome && window.chrome.webview) {
    window.chrome.webview.addEventListener('message', event => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'newGame') createGameCard(data);
            else if (data.type === 'installedAppsList') { allInstalledApps = data.apps; applyFilterAndRender(); }
            else if (data.type === 'staticSaved') updateToLocalFile(data.gameId, data.imageType, data.newUrl);
        } catch (e) { console.error("Erro ao receber dados:", e); }
    });
}

function updateToLocalFile(gameId, imageType, newUrl) {
    const targetCard = document.querySelector(`.card[data-game-id="${gameId.replace(/\\/g, '\\\\')}"]`);
    if (!targetCard) return;

    const keyMap = { GridStatic: 'staticVertical', HorizontalStatic: 'staticHorizontal', HeroStatic: 'staticHero', LogoStatic: 'staticLogo' };
    const datasetKey = keyMap[imageType];
    if (!datasetKey) return;

    targetCard.dataset[datasetKey] = newUrl;

    const img = targetCard.querySelector('img');
    const isFeatured = targetCard.classList.contains('featured');
    if (img && document.activeElement !== targetCard && !targetCard.matches(':hover')) {
        if ((isFeatured && datasetKey === "staticHorizontal") || (!isFeatured && datasetKey === "staticVertical")) {
            img.src = newUrl;
            img.style.opacity = "1";
        }
    }

    if (isFeatured) {
        if (datasetKey === "staticHero") switchHeroBackground(newUrl, targetCard.dataset.staticLogo || targetCard.dataset.logo);
    }
}

// ========================= FILTROS =========================
function applyFilterAndRender() {
    const filtered = currentSourceFilter === "all"
        ? allInstalledApps
        : allInstalledApps.filter(app => (app.Source || app.source) === currentSourceFilter);
    populateAppModal(filtered);
}

function setupFilterEvents() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.replaceWith(newBtn);
        newBtn.classList.toggle('active', newBtn.dataset.source === currentSourceFilter);
        newBtn.addEventListener('click', () => {
            currentSourceFilter = newBtn.dataset.source;
            applyFilterAndRender();
            setTimeout(() => {
                const activeBtn = document.querySelector(`.filter-btn[data-source="${currentSourceFilter}"]`);
                if (activeBtn) activeBtn.focus();
            }, 50);
        });
    });
}

// ========================= MODAL =========================
document.getElementById('btnAdd').addEventListener('click', () => {
    if (window.chrome && window.chrome.webview)
        window.chrome.webview.postMessage(JSON.stringify({ action: 'requestInstalledApps' }));
    showModalLoading();
});

function showModalLoading() {
    isModalOpen = true;
    document.getElementById('modalActions').style.display = "none";
    document.getElementById("gameGrid").style.overflowX = "hidden";
    document.getElementById('addGameContainer').style.display = 'flex';
    document.getElementById('modalTitle').innerText = "Detectando Biblioteca";

    document.getElementById('appList').innerHTML = `
        <div class="vb-wrap">
            <div class="vb-scanline"></div>
            <div class="vb-ghost-grid">
                ${'<div class="vb-ghost-tile"></div>'.repeat(15)}
            </div>
            <div class="vb-center">
                <div class="vb-ring-wrap">
                    <div class="vb-ring outer"></div>
                    <div class="vb-ring inner"></div>
                    <div class="vb-ring core"></div>
                    <div class="vb-ring-dot"></div>
                </div>
                <div class="vb-text">
                    <div class="vb-title">Detectando Biblioteca</div>
                    <div class="vb-subtitle">Lendo aplicativos instalados</div>
                    <div class="vb-dots"><span></span><span></span><span></span></div>
                    <div class="vb-libs" id="vbLibs">
                        <div class="vb-lib scanning">Steam</div>
                        <div class="vb-lib">Epic</div>
                        <div class="vb-lib">GOG</div>
                        <div class="vb-lib">Windows</div>
                        <div class="vb-lib">Pastas</div>
                    </div>
                </div>
            </div>
            <div class="vb-progress"><div class="vb-progress-fill"></div></div>
        </div>
    `;

    const libs = document.querySelectorAll('#vbLibs .vb-lib');
    let current = 0;
    const libInterval = setInterval(() => {
        if (!isModalOpen) { clearInterval(libInterval); return; }
        libs.forEach(l => l.classList.remove('scanning'));
        libs[current].classList.add('scanning');
        current = (current + 1) % libs.length;
    }, 700);
}

function closeModal() {
    document.getElementById('addGameContainer').style.display = 'none';
    document.getElementById("gameGrid").style.overflowX = "auto";
    resetSelectionCounter();
    isModalOpen = false;
    focusItemByIndex(0);
}

function formatBytes(kb) {
    if (!kb) return "";
    const mb = kb / 1024;
    return mb > 1024 ? (mb / 1024).toFixed(2) + " GB" : mb.toFixed(0) + " MB";
}

function populateAppModal(apps) {
    const titleEl = document.getElementById('modalTitle');
    titleEl.innerText = currentSourceFilter === "all"
        ? "Selecione os aplicativos para adicionar"
        : `Mostrando jogos da loja: ${currentSourceFilter}`;

    ['btnSearch', 'btnScanFolder'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const newBtn = btn.cloneNode(true);
        btn.replaceWith(newBtn);
        if (id === 'btnSearch') {
            newBtn.addEventListener('click', () => {
                if (window.chrome && window.chrome.webview)
                    window.chrome.webview.postMessage(JSON.stringify({ action: 'browseManual' }));
            });
        } else {
            newBtn.addEventListener('click', () => {
                titleEl.innerText = "Aguardando seleção de pasta...";
                if (window.chrome && window.chrome.webview)
                    window.chrome.webview.postMessage(JSON.stringify({ action: 'pickFolder' }));
            });
        }
    });

    setupFilterEvents();

    const appList = document.getElementById('appList');
    appList.innerHTML = apps.map(app => {
        const isAdded = app.IsAdded === true || app.isAdded === true;
        const iconData = app.IconBase64 || app.iconBase64;
        const appName = app.Name || app.name;
        const appPath = app.Path || app.path;
        const appSize = app.Size ?? app.size;
        const appLaunch = app.LaunchUrl || app.launchUrl || "";

        return `
            <div class="app-item ${isAdded ? 'already-added' : ''}" ${isAdded ? '' : 'tabindex="0"'}
                 data-path="${appPath.replace(/\\/g, '\\\\')}"
                 data-launch="${appLaunch}"
                 data-name="${appName.replace(/"/g, '&quot;')}">
                ${iconData ? `<img class="app-icon" src="data:image/png;base64,${iconData}" />` : ''}
                ${appName}
                <span class="size">${formatBytes(appSize)}</span>
            </div>`;
    }).join('');

    document.getElementById('modalActions').style.display = "flex";
    resetSelectionCounter();

    document.querySelectorAll('.app-item:not(.already-added)').forEach(item => {
        item.addEventListener('click', function () {
            this.classList.toggle('selected');
            updateSelectionCounter();
        });
    });

    const btnCancel = document.getElementById('btnCancelAdd');
    const btnConfirm = document.getElementById('btnConfirmAdd');
    const newCancel = btnCancel.cloneNode(true);
    const newConfirm = btnConfirm.cloneNode(true);
    btnCancel.replaceWith(newCancel);
    btnConfirm.replaceWith(newConfirm);

    newCancel.addEventListener('click', closeModal);

    newConfirm.addEventListener('click', () => {
        const selected = Array.from(document.querySelectorAll('.app-item.selected')).map(el => ({
            Name: el.dataset.name, Path: el.dataset.path, LaunchUrl: el.dataset.launch
        }));
        if (selected.length > 0) {
            // Marca os IDs como novos nesta sessão (Opção A)
            selected.forEach(g => newGameIdsThisSession.add(g.LaunchUrl || g.Path));

            if (window.chrome && window.chrome.webview)
                window.chrome.webview.postMessage(JSON.stringify({ action: 'addSelectedGames', games: selected }));
            titleEl.innerText = "Baixando capas e adicionando... (Aguarde)";
            appList.innerHTML = "";
            document.getElementById('modalActions').style.display = "none";
            setTimeout(closeModal, 3000);
        } else {
            closeModal();
        }
    });

    setTimeout(() => {
        const first = document.querySelector('.app-item[tabindex="0"]');
        if (first) first.focus();
        else document.getElementById('btnScanFolder')?.focus();
    }, 150);
}

// ========================= NAVEGAÇÃO =========================
function getModalGroups() {
    const sidebar = Array.from(document.querySelectorAll(".sidebar-menu .menu-tab"));
    const filters = Array.from(document.querySelectorAll(".filter-bar .filter-btn"));
    const apps = Array.from(document.querySelectorAll("#appList .app-item:not(.already-added)"));
    const actions = Array.from(document.querySelectorAll("#modalActions button"));
    return { sidebar, filters, apps, actions };
}

function getNavigableItems() {
    if (!isModalOpen) {
        return Array.from(document.getElementById("gameGrid").querySelectorAll("[tabindex='0']"));
    }
    const { sidebar, filters, apps, actions } = getModalGroups();
    return [...sidebar, ...filters, ...apps, ...actions];
}

function findSpatialCandidate(groupItems, current, direction) {
    const cr = current.getBoundingClientRect();
    const currCX = cr.left + cr.width / 2;
    const currCY = cr.top + cr.height / 2;

    let best = null, bestScore = Infinity;

    groupItems.forEach(item => {
        if (item === current) return;
        const r = item.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;

        let isValid = false, dist = 0, overlap = 0;

        switch (direction) {
            case "RIGHT": isValid = cx > currCX; dist = cx - currCX; overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top); break;
            case "LEFT": isValid = cx < currCX; dist = currCX - cx; overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top); break;
            case "DOWN": isValid = cy > currCY; dist = cy - currCY; overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left); break;
            case "UP": isValid = cy < currCY; dist = currCY - cy; overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left); break;
        }

        if (isValid && overlap > 0 && dist < bestScore) {
            bestScore = dist;
            best = item;
        }
    });

    return best;
}

function findWrapCandidate(groupItems, current, direction) {
    const cr = current.getBoundingClientRect();
    const currCX = cr.left + cr.width / 2;
    const currCY = cr.top + cr.height / 2;

    let best = null, maxDist = -1;

    groupItems.forEach(item => {
        if (item === current) return;
        const r = item.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;

        let isValidOpp = false, dist = 0, overlap = 0;

        switch (direction) {
            case "RIGHT": isValidOpp = cx < currCX; dist = currCX - cx; overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top); break;
            case "LEFT": isValidOpp = cx > currCX; dist = cx - currCX; overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top); break;
            case "DOWN": isValidOpp = cy < currCY; dist = currCY - cy; overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left); break;
            case "UP": isValidOpp = cy > currCY; dist = cy - currCY; overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left); break;
        }

        if (isValidOpp && overlap > 0 && dist > maxDist) {
            maxDist = dist;
            best = item;
        }
    });

    return best;
}

function getGroupTransition(direction, groupName, groups) {
    const { sidebar, filters, apps, actions } = groups;

    if (groupName === "app") {
        if (direction === "DOWN" || direction === "RIGHT") return actions[0] || null;
        if (direction === "LEFT") return (lastFocusedSidebar && sidebar.includes(lastFocusedSidebar)) ? lastFocusedSidebar : sidebar.find(el => el.classList.contains('active')) || sidebar[0] || null;
        if (direction === "UP") return (lastFocusedFilter && filters.includes(lastFocusedFilter)) ? lastFocusedFilter : filters.find(el => el.classList.contains('active')) || filters[0] || null;
    }

    if (groupName === "action") {
        if (direction === "LEFT" || direction === "UP") {
            return (lastFocusedApp && apps.includes(lastFocusedApp)) ? lastFocusedApp : apps[apps.length - 1] || null;
        }
    }

    if (groupName === "filter") {
        if (direction === "DOWN") return (lastFocusedApp && apps.includes(lastFocusedApp)) ? lastFocusedApp : apps[0] || null;
        if (direction === "LEFT") return (lastFocusedSidebar && sidebar.includes(lastFocusedSidebar)) ? lastFocusedSidebar : sidebar.find(el => el.classList.contains('active')) || sidebar[0] || null;
        if (direction === "RIGHT") return (lastFocusedApp && apps.includes(lastFocusedApp)) ? lastFocusedApp : apps[0] || null;
    }

    if (groupName === "sidebar") {
        if (direction === "RIGHT") return (lastFocusedApp && apps.includes(lastFocusedApp)) ? lastFocusedApp : filters[0] || apps[0] || null;
    }

    return null;
}

function moveFocus(direction) {
    const items = getNavigableItems();
    if (!items.length) return;

    const current = document.activeElement;

    if (!items.includes(current)) {
        items[0].focus();
        return;
    }

    // ── Tela principal (sem modal) ──
    if (!isModalOpen) {
        let candidate = findSpatialCandidate(items, current, direction);
        if (!candidate) {
            if (direction === "RIGHT") candidate = items[0];
            else if (direction === "LEFT") candidate = items[items.length - 1];
            else candidate = findWrapCandidate(items, current, direction);
        }
        if (candidate) {
            if (current && current._stopInteraction) current._stopInteraction();
            if (heroFadeTimeout) { clearTimeout(heroFadeTimeout); heroFadeTimeout = null; }

            candidate.focus();
            pendingInteractionCard = null;

            smoothHorizontalScroll(candidate, direction, () => {
                if (document.activeElement === candidate || candidate.matches(':hover')) {
                    candidate._startInteraction?.();
                }
            });
        }
        return;
    }

    // ── Modal: navegação por grupos ──
    const groups = getModalGroups();
    const { sidebar, filters, apps, actions } = groups;

    let groupName, groupItems;
    if (current.classList.contains("menu-tab")) { groupName = "sidebar"; groupItems = sidebar; }
    else if (current.classList.contains("filter-btn")) { groupName = "filter"; groupItems = filters; }
    else if (current.classList.contains("app-item")) { groupName = "app"; groupItems = apps; }
    else { groupName = "action"; groupItems = actions; }

    if (groupName === "app") lastFocusedApp = current;
    if (groupName === "filter") lastFocusedFilter = current;
    if (groupName === "sidebar") lastFocusedSidebar = current;

    let candidate = findSpatialCandidate(groupItems, current, direction);
    if (!candidate) candidate = getGroupTransition(direction, groupName, groups);
    if (!candidate) candidate = findWrapCandidate(groupItems, current, direction);

    if (candidate) {
        candidate.focus();
        ensureModalItemVisible(candidate);
        if (isModalOpen) signalNavigation();
    }
}

// ========================= FOCO INICIAL =========================
function focusItemByIndex(index) {
    const items = getNavigableItems();
    if (!items.length) return;
    const el = items[(index + items.length) % items.length];
    el.focus();
    if (isModalOpen) ensureModalItemVisible(el); else smoothHorizontalScroll(el);
}

function ensureModalItemVisible(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

// ========================= SCROLL HORIZONTAL =========================
function smoothHorizontalScroll(element, direction, onDone) {
    if (isModalOpen) { onDone?.(); return; }
    const container = document.getElementById("gameGrid");
    const cRect = container.getBoundingClientRect();
    const eRect = element.getBoundingClientRect();

    const TOLERANCE = 2;
    const visibleLeft = eRect.left >= cRect.left - TOLERANCE;
    const visibleRight = eRect.right <= cRect.right + TOLERANCE;

    if (visibleLeft && visibleRight) { onDone?.(); return; }

    let targetScrollLeft;
    if (!visibleRight) {
        targetScrollLeft = container.scrollLeft + (eRect.left - cRect.left);
    } else {
        targetScrollLeft = container.scrollLeft + (eRect.right - cRect.right);
    }

    targetScrollLeft = Math.max(0, Math.min(container.scrollWidth - container.clientWidth, targetScrollLeft));

    const start = container.scrollLeft;
    const delta = targetScrollLeft - start;
    if (Math.abs(delta) < 1) { onDone?.(); return; }

    const duration = 300;
    const startTime = performance.now();

    (function animate(time) {
        const t = Math.min((time - startTime) / duration, 1);
        container.scrollLeft = start + delta * (1 - Math.pow(1 - t, 3));
        if (t < 1) requestAnimationFrame(animate);
        else onDone?.();
    })(performance.now());
}

document.getElementById("gameGrid").addEventListener("wheel", (e) => {
    if (isModalOpen) return;
    e.preventDefault();
    document.getElementById("gameGrid").scrollLeft += e.deltaY * 1.2;
}, { passive: false });

// ========================= TECLADO =========================
document.addEventListener('keydown', (e) => {
    const map = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' };
    if (map[e.key]) { e.preventDefault(); moveFocus(map[e.key]); return; }
    if (e.key === 'Enter') { e.preventDefault(); document.activeElement?.click(); }
});

// ========================= GAMEPAD =========================
let gamepadIndex = null, buttonCooldown = false;
let lastMoveTime = 0, moveState = 0, currentDirection = null;
const INITIAL_DELAY = 400, REPEAT_DELAY = 80;

window.addEventListener("gamepadconnected", e => { gamepadIndex = e.gamepad.index; });

function handleGamepad() {
    if (gamepadIndex === null) { requestAnimationFrame(handleGamepad); return; }
    const gamepad = navigator.getGamepads()[gamepadIndex];
    if (!gamepad) { requestAnimationFrame(handleGamepad); return; }

    const items = getNavigableItems();
    if (!items.length) { requestAnimationFrame(handleGamepad); return; }

    if (!items.includes(document.activeElement)) { focusItemByIndex(0); requestAnimationFrame(handleGamepad); return; }

    const ax = gamepad.axes[0], ay = gamepad.axes[1];
    const now = performance.now();
    let newDir = null;

    if (ax > 0.6 || gamepad.buttons[15]?.pressed) newDir = 'RIGHT';
    else if (ax < -0.6 || gamepad.buttons[14]?.pressed) newDir = 'LEFT';
    else if (ay > 0.6 || gamepad.buttons[13]?.pressed) newDir = 'DOWN';
    else if (ay < -0.6 || gamepad.buttons[12]?.pressed) newDir = 'UP';

    if (newDir) {
        if (newDir !== currentDirection) {
            moveFocus(newDir); lastMoveTime = now; moveState = 1; currentDirection = newDir;
        } else if (moveState === 1 && now - lastMoveTime > INITIAL_DELAY) {
            moveFocus(newDir); lastMoveTime = now; moveState = 2;
        } else if (moveState === 2 && now - lastMoveTime > REPEAT_DELAY) {
            moveFocus(newDir); lastMoveTime = now;
        }
    } else {
        moveState = 0; currentDirection = null;
    }

    if (gamepad.buttons[0].pressed) {
        if (!buttonCooldown) { document.activeElement?.click(); buttonCooldown = true; }
    } else { buttonCooldown = false; }

    requestAnimationFrame(handleGamepad);
}

requestAnimationFrame(handleGamepad);

// ========================= HERO BACKGROUND =========================
let heroFadeTimeout = null;
let currentBgSrc = "";

function switchHeroBackground(bgSrc, logoSrc, heroSrc) {
    const bgBlur = document.getElementById('bgBlur');
    const heroImg = document.getElementById('heroImage');
    const logoImg = document.getElementById('gameLogo');
    if (!bgBlur || !bgSrc) return;

    const cleanNew = bgSrc.split('?')[0];
    if (currentBgSrc.split('?')[0] === cleanNew) return;
    currentBgSrc = bgSrc;

    bgBlur.style.opacity = "0";
    if (heroImg) heroImg.style.opacity = "0";
    if (logoImg) logoImg.classList.remove('visible');

    if (heroFadeTimeout) clearTimeout(heroFadeTimeout);

    heroFadeTimeout = setTimeout(async () => {
        await setImgSrc(bgBlur, bgSrc);
        bgBlur.style.opacity = "1";

        const gridBgImg = document.getElementById('gridBgImg');
        if (gridBgImg) setImgSrc(gridBgImg, heroSrc);

        if (heroImg) {
            await setImgSrc(heroImg, heroSrc || bgSrc);
            heroImg.style.opacity = "1";
        }

        if (logoImg && logoSrc) {
            await setImgSrc(logoImg, logoSrc);
            logoImg.classList.add('visible');
        }
    }, 150);
}

// ========================= CARDS =========================
async function getAnimatedBlob(url) {
    if (!url) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        const bytes = new Uint8Array(await blob.slice(0, 256).arrayBuffer());
        const APNG = [0x61, 0x63, 0x54, 0x4C], WEBP = [0x41, 0x4E, 0x49, 0x4D];
        let isAnim = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46; // GIF
        for (let i = 0; !isAnim && i < bytes.length - 4; i++) {
            if (bytes.slice(i, i + 4).every((v, j) => v === APNG[j])) isAnim = true;
            if (bytes.slice(i, i + 4).every((v, j) => v === WEBP[j])) isAnim = true;
        }
        return isAnim ? blob : null;
    } catch { return null; }
}

async function setImgSrc(imgEl, src) {
    if (!imgEl) return;

    const currentReq = Symbol();
    imgEl.__pendingReq = currentReq;

    if (!src) { imgEl.removeAttribute('src'); return; }
    if (imgEl.src === src || imgEl.src.endsWith(src)) return;

    const tmp = new Image();
    tmp.src = src;
    try { await tmp.decode(); } catch (_) { }

    if (imgEl.__pendingReq !== currentReq) return;
    imgEl.src = src;
}

function createGameCard(data) {
    const grid = document.getElementById('gameGrid');
    const btnAdd = document.getElementById('btnAdd');
    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;

    const gameId = data.launchUrl || data.path;
    card.dataset.gameId = gameId;
    card.dataset.hero = data.hero || "";
    card.dataset.logo = data.logo || "";
    card.dataset.vertical = data.imageData || "";
    card.dataset.horizontal = data.horizontalImage || "";
    card.dataset.staticVertical = data.staticImageData || "";
    card.dataset.staticHorizontal = data.staticHorizontalImage || "";
    card.dataset.staticHero = data.staticHero || "";
    card.dataset.staticLogo = data.staticLogo || "";

    if (data.isFeatured) card.classList.add('featured');

    // ── Imagem principal ──
    const img = document.createElement('img');
    img.decoding = "async";

    const processImage = async (src, key, imageType) => {
        if (!src || card.dataset[key]) return;
        const blob = await getAnimatedBlob(src);
        if (!blob) { card.dataset[key] = src; return; }

        return new Promise(resolve => {
            const tempImg = new Image();
            const blobUrl = URL.createObjectURL(blob);
            tempImg.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = tempImg.naturalWidth;
                    canvas.height = tempImg.naturalHeight;
                    canvas.getContext('2d').drawImage(tempImg, 0, 0);
                    if (window.chrome && window.chrome.webview)
                        window.chrome.webview.postMessage(JSON.stringify({
                            action: 'saveStaticFrame', gameId, imageType,
                            base64: canvas.toDataURL('image/png')
                        }));
                } catch { card.dataset[key] = src; }
                finally { URL.revokeObjectURL(blobUrl); resolve(); }
            };
            tempImg.onerror = () => { card.dataset[key] = src; URL.revokeObjectURL(blobUrl); resolve(); };
            tempImg.src = blobUrl;
        });
    };

    Promise.all([
        processImage(card.dataset.vertical, 'staticVertical', 'GridStatic'),
        processImage(card.dataset.horizontal, 'staticHorizontal', 'HorizontalStatic'),
        processImage(card.dataset.hero, 'staticHero', 'HeroStatic'),
        processImage(card.dataset.logo, 'staticLogo', 'LogoStatic'),
    ]).then(() => {
        const src = card.classList.contains('featured')
            ? card.dataset.staticHorizontal
            : card.dataset.staticVertical;
        if (src) { img.src = src; img.style.opacity = "1"; }
    });

    // ── Interações ──
    const handleStartInteraction = async () => {
        const bgSrc = card.dataset.staticVertical || card.dataset.vertical;
        const logoSrc = card.dataset.staticLogo || card.dataset.logo;
        const heroSrc = card.dataset.staticHero || card.dataset.hero
            || card.dataset.staticHorizontal || card.dataset.horizontal
            || bgSrc;
        const animGrid = card.classList.contains('featured')
            ? (card.dataset.horizontal || card.dataset.vertical)
            : card.dataset.vertical;

        switchHeroBackground(bgSrc, logoSrc, heroSrc);

        if (card._animationTimeout) clearTimeout(card._animationTimeout);

        card._animationTimeout = setTimeout(async () => {
            if (document.activeElement !== card && !card.matches(':hover')) return;
            const stillActive = () => document.activeElement === card || card.matches(':hover');

            if (animGrid) await setImgSrc(img, animGrid);

            const animHero = card.dataset.hero;
            const staticHero = card.dataset.staticHero || animHero;
            if (animHero && animHero !== staticHero && stillActive()) {
                const heroImg = document.getElementById('heroImage');
                if (heroImg) await setImgSrc(heroImg, animHero);
            }

            const animLogo = card.dataset.logo;
            const staticLogo = card.dataset.staticLogo || animLogo;
            if (animLogo && animLogo !== staticLogo && stillActive()) {
                const logoImg = document.getElementById('gameLogo');
                if (logoImg) { await setImgSrc(logoImg, animLogo); logoImg.classList.add('visible'); }
            }
        }, 200);
    };

    const handleStopInteraction = () => {
        if (card._animationTimeout) clearTimeout(card._animationTimeout);
        if (document.activeElement === card || card.matches(':hover')) return;

        const staticGrid = card.classList.contains('featured')
            ? (card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical)
            : (card.dataset.staticVertical || card.dataset.vertical);

        setImgSrc(img, staticGrid);

        const heroImg = document.getElementById('heroImage');
        const staticHero = card.dataset.staticHero || card.dataset.hero;
        if (heroImg && staticHero) setImgSrc(heroImg, staticHero);

        const logoImg = document.getElementById('gameLogo');
        const staticLogo = card.dataset.staticLogo || card.dataset.logo;
        if (logoImg && staticLogo) setImgSrc(logoImg, staticLogo);
    };

    card._startInteraction = handleStartInteraction;
    card._stopInteraction = handleStopInteraction;

    card.appendChild(img);

    card.addEventListener('mouseenter', handleStartInteraction);
    card.addEventListener('focus', () => {
        pendingInteractionCard = card;
        signalNavigation();
    });
    card.addEventListener('mouseleave', handleStopInteraction);
    card.addEventListener('blur', () => {
        if (pendingInteractionCard === card) pendingInteractionCard = null;
        handleStopInteraction();
    });

    const title = document.createElement('div');
    title.className = 'title';
    title.innerText = data.name;
    card.appendChild(title);

    card.addEventListener('click', () => {
        if (window.chrome && window.chrome.webview)
            window.chrome.webview.postMessage(JSON.stringify({ action: 'launch', path: gameId }));
        moveCardToTop(card);
    });

    
    if (data.isFeatured) {
        grid.insertBefore(card, btnAdd);
        handleStartInteraction();
    } else {
       
        const featured = grid.querySelector('.card.featured');
        const insertAfter = featured ? featured.nextSibling : grid.firstChild;
        grid.insertBefore(card, insertAfter);

        
        if (newGameIdsThisSession.has(gameId)) {
            card.classList.add('new-game');
        }
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
    if (img) img.src = card.dataset.staticHorizontal || card.dataset.horizontal || card.dataset.staticVertical || card.dataset.vertical;
}