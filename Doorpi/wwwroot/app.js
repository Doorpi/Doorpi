// =============================================================================
// app.js — Aplicação
// =============================================================================

let allInstalledApps = [];
let cachedFolders = null;
let currentSourceFilter = ['all'];
let isFolderOperationInProgress = false;
window.newGameIdsThisSession = new Set();
window.recentlyOpenedIds = [];
window.isGlobalLoading = false;
window._doorpiUsers = [];
window._doorpiCurrentUserId = '';

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

// 🔹 INJEÇÃO DA FOTO DE PERFIL NO CANTO SUPERIOR ESQUERDO
(function injectTopProfile() {
    const btn = document.createElement('button');
    btn.id = 'btnTopProfile';
    btn.className = 'top-profile-btn';
    btn.tabIndex = 0;
    btn.innerHTML = `<div class="doorpi-avatar"></div>`;
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
        postToHost({ action: 'requestUsers' });
    });

    const s = document.createElement('style');
    s.textContent = `
        .top-profile-btn {
            position: fixed;
            top: clamp(20px, 3vh, 40px);
            left: clamp(24px, 4vw, 60px);
            width: clamp(48px, 4.5vw, 64px);
            height: clamp(48px, 4.5vw, 64px);
            border-radius: 50%;
            background: rgba(255,255,255,0.05);
            border: 2px solid rgba(255,255,255,0.15);
            cursor: pointer;
            outline: none;
            z-index: 8000;
            transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
            padding: 0;
            overflow: hidden;
        }
        .top-profile-btn:focus, .top-profile-btn:hover {
            transform: scale(1.1);
            border-color: #fff;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.2);
        }
        .top-profile-btn .doorpi-avatar { width: 100%; height: 100%; display:flex; align-items:center; justify-content:center; }
        .top-profile-btn img { width: 100%; height: 100%; object-fit: cover; }
    `;
    document.head.appendChild(s);
})();

function reorderGameGrid() {
    const grid = document.getElementById('gameGrid');
    if (!grid) return;
    const btnAdd = document.getElementById('btnAdd');

    const cards = Array.from(grid.querySelectorAll('.card:not(.add-card):not(.loading-card)'));

    const featured = cards.find(c => c.classList.contains('featured'));
    const rest = cards.filter(c => !c.classList.contains('featured'));

    rest.sort((a, b) => {
        const aId = a.dataset.gameId;
        const bId = b.dataset.gameId;
        const aNew = window.newGameIdsThisSession.has(aId) ? 1 : 0;
        const bNew = window.newGameIdsThisSession.has(bId) ? 1 : 0;
        const aOIdx = window.recentlyOpenedIds.indexOf(aId);
        const bOIdx = window.recentlyOpenedIds.indexOf(bId);

        if (bNew !== aNew) return bNew - aNew;
        if (!aNew && !bNew) {
            if (aOIdx !== -1 && bOIdx === -1) return -1;
            if (aOIdx === -1 && bOIdx !== -1) return 1;
            if (aOIdx !== -1 && bOIdx !== -1) return aOIdx - bOIdx;
        }
        return 0;
    });

    if (featured) grid.prepend(featured);
    rest.forEach(card => {
        if (btnAdd) grid.insertBefore(card, btnAdd);
        else grid.appendChild(card);
    });
    const loadingCards = Array.from(grid.querySelectorAll('.card.loading-card'));
    loadingCards.forEach(c => {
        if (btnAdd) grid.insertBefore(c, btnAdd);
        else grid.appendChild(c);
    });
}

window.trackGameOpened = function (gameId) {
    window.recentlyOpenedIds = [
        gameId,
        ...window.recentlyOpenedIds.filter(id => id !== gameId)
    ];
    reorderGameGrid();
};
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
            refreshInstalledAppsView();
        }
        else if (data.type === 'installedAppsUpdated') {
            const modal = document.getElementById('addGameContainer');
            if (!modal || modal.style.display === 'none') return;
            allInstalledApps = data.apps;
            refreshInstalledAppsView();
        }
        else if (data.type === 'showLoadingCards') {
            showLoadingCards(data.count, data.tab || 'games');
        }
        else if (data.type === 'clearLoadingCards') {
            clearLoadingCards('games');
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
        else if (data.type === 'clearGamesGrid') {
            const grid = document.getElementById('gameGrid');
            if (grid) {
                const btnAdd = document.getElementById('btnAdd');
                grid.innerHTML = '';
                if (btnAdd) grid.appendChild(btnAdd);
            }
        }
        else if (data.type === 'clearMediaGrid') {
            const grid = document.getElementById('mediaGrid');
            if (grid) {
                const btnAdd = document.getElementById('btnAddMedia');
                grid.innerHTML = '';
                if (btnAdd) grid.appendChild(btnAdd);
            }
        }
        else if (data.type === 'currentUserUpdated') {
            const btn = document.getElementById('btnTopProfile');
            if (btn) {
                const u = data.user;
                if (u && u.PhotoBase64) {
                    btn.innerHTML = `<img src="data:image/png;base64,${u.PhotoBase64}" />`;
                } else {
                    btn.innerHTML = `<div class="doorpi-avatar" style="font-size: 20px;">${u && u.Name ? u.Name.charAt(0).toUpperCase() : '•'}</div>`;
                }
            }
            if (typeof clearHero === 'function') clearHero();
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
        else if (data.type === 'usersList') {
            window._doorpiUsers = data.users || [];
            window._doorpiCurrentUserId = data.currentUserId || '';
            showUserPicker(data.users || [], !!data.requireSelection);
        }
        else if (data.type === 'extensionsList') {
            renderExtensionsManager(data.extensions || [], data.status || '', data.message || '');
        }
        else if (data.type === 'clipboardText') {
            if (data.text?.trim()) {
                if (typeof isSetupOpen !== 'undefined' && isSetupOpen) {
                    const input = document.getElementById('setupApiInput');
                    if (input) {
                        input.value = data.text.trim();
                        if (typeof _currUser !== 'undefined' && _currUser) _currUser.apiKey = data.text.trim();
                        const hint = document.getElementById('setupApiHint');
                        if (hint) hint.textContent = typeof t === 'function' ? t('setupStep3PasteSuccess') : 'Copiado com sucesso!';
                        if (typeof _updateStatus === 'function') _updateStatus();
                        document.getElementById('btnSetupFinish')?.focus();
                    }
                }
                else if (document.getElementById('doorpiExtensionsManager')?.style.display !== 'none' && document.getElementById('extensionUrlInput')) {
                    const input = document.getElementById('extensionUrlInput');
                    input.value = data.text.trim();
                    input.focus();
                }
                else {
                    const input = document.getElementById('webAppUrlInput');
                    if (input) {
                        input.value = data.text.trim();
                        input.focus();
                    }
                }
            }
        }

        window._mediaHandleMessage?.(data);
    } catch (e) { console.error('[bridge] Erro:', e); }
});

function postToHost(payload) {
    window.chrome?.webview?.postMessage(JSON.stringify(payload));
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[ch]));
}

function ensureDoorpiOverlayStyles() {
    if (document.getElementById('doorpiOverlayStyles')) return;
    const s = document.createElement('style');
    s.id = 'doorpiOverlayStyles';
    s.textContent = `
    .doorpi-user-overlay,.doorpi-manager-overlay{position:fixed;inset:0;z-index:9200;background:#07071a;display:flex;align-items:center;justify-content:center;padding:48px;box-sizing:border-box}
    .doorpi-user-panel,.doorpi-manager-panel{width:min(980px,94vw);max-height:86vh;display:flex;flex-direction:column;gap:22px}
    .doorpi-panel-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
    .doorpi-panel-title{font-size:clamp(2rem,3vw,4rem);font-weight:220;color:#fff;margin:0;letter-spacing:0}
    .doorpi-panel-sub{color:rgba(255,255,255,.52);font-size:1rem;margin:6px 0 0;line-height:1.45}
    .doorpi-user-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
    .doorpi-user-card,.doorpi-manager-row{background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.13);border-radius:8px;color:#fff}
    .doorpi-user-card{height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer;outline:none}
    .doorpi-user-card:focus,.doorpi-user-card:hover,.doorpi-manager-btn:focus,.doorpi-manager-btn:hover,.doorpi-manager-input:focus{border-color:rgba(255,255,255,.85);box-shadow:0 0 0 4px rgba(255,255,255,.12)}
    .doorpi-avatar{width:78px;height:78px;border-radius:50%;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;overflow:hidden;color:rgba(255,255,255,.45);font-size:30px}
    .doorpi-avatar img{width:100%;height:100%;object-fit:cover}
    .doorpi-user-name{font-size:1.08rem;font-weight:700;text-align:center}
    .doorpi-user-badge{font-size:.72rem;color:rgba(120,220,150,.9);text-transform:uppercase;letter-spacing:.1em}
    .doorpi-manager-row{padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:14px}
    .doorpi-manager-form{display:grid;grid-template-columns:1fr auto auto auto;gap:10px}
    .doorpi-manager-input,.doorpi-choice-trigger{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);border-radius:8px;color:#fff;font:inherit;padding:13px 14px;outline:none;box-sizing:border-box}
    .doorpi-choice-wrap{position:relative}
    .doorpi-choice-trigger{width:100%;min-height:50px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;cursor:pointer}
    .doorpi-choice-trigger::after{content:'v';font-size:.8rem;color:rgba(255,255,255,.58)}
    .doorpi-choice-wrap.is-disabled{opacity:.48;pointer-events:none}
    .doorpi-choice-wrap.is-open .doorpi-choice-trigger,.doorpi-choice-trigger:focus,.doorpi-choice-option:focus{border-color:rgba(255,255,255,.85);box-shadow:0 0 0 4px rgba(255,255,255,.12)}
    .doorpi-choice-menu{display:none;position:absolute;z-index:4;left:0;right:0;top:calc(100% + 6px);background:#101020;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px;box-shadow:0 18px 40px rgba(0,0,0,.42)}
    .doorpi-choice-wrap.is-open .doorpi-choice-menu{display:flex;flex-direction:column;gap:4px}
    .doorpi-choice-option{background:transparent;border:1px solid transparent;border-radius:6px;color:#fff;font:inherit;text-align:left;padding:11px 12px;cursor:pointer;outline:none}
    .doorpi-choice-option:hover,.doorpi-choice-option.is-selected{background:rgba(255,255,255,.11)}
    .doorpi-share-select{display:none}
    .doorpi-manager-btn{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.16);border-radius:8px;color:#fff;font:inherit;font-weight:700;padding:12px 16px;cursor:pointer;outline:none}
    .doorpi-manager-btn.primary{background:rgba(255,255,255,.92);color:#07071a}
    .doorpi-manager-list{display:flex;flex-direction:column;gap:10px;overflow:auto;padding-right:4px}
    .doorpi-status{min-height:20px;color:rgba(255,255,255,.62)}
    .doorpi-status.error{color:rgba(255,110,110,.95)}
    .doorpi-status.success{color:rgba(110,230,150,.95)}
    .doorpi-share-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
    .doorpi-shared-note{font-size:.82rem;color:rgba(120,190,255,.9);margin-top:8px}
    @media(max-width:760px){.doorpi-manager-form,.doorpi-share-grid{grid-template-columns:1fr}.doorpi-user-overlay,.doorpi-manager-overlay{padding:24px}}
    `;
    document.head.appendChild(s);
}

function renderDoorpiChoice(id, options, value, disabled = false) {
    const safeOptions = Array.isArray(options) && options.length
        ? options
        : [{ value: '', label: 'Nenhuma opcao disponivel' }];
    const selected = safeOptions.find(opt => String(opt.value) === String(value)) || safeOptions[0];
    return `
        <div class="doorpi-choice-wrap${disabled ? ' is-disabled' : ''}" id="${escapeHtml(id)}" data-value="${escapeHtml(selected.value)}" data-disabled="${disabled ? 'true' : 'false'}">
            <button class="doorpi-choice-trigger" type="button" tabindex="0" aria-haspopup="listbox" aria-expanded="false">
                <span>${escapeHtml(selected.label)}</span>
            </button>
            <div class="doorpi-choice-menu" role="listbox">
                ${safeOptions.map(opt => `
                    <button class="doorpi-choice-option${String(opt.value) === String(selected.value) ? ' is-selected' : ''}" type="button" tabindex="0" data-value="${escapeHtml(opt.value)}" role="option">
                        ${escapeHtml(opt.label)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function bindDoorpiChoice(root, onChange) {
    if (!root) return;
    const trigger = root.querySelector('.doorpi-choice-trigger');
    const options = Array.from(root.querySelectorAll('.doorpi-choice-option'));
    const setOpen = (open) => {
        if (root.dataset.disabled === 'true') return;
        root.classList.toggle('is-open', open);
        trigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
            const selected = root.querySelector('.doorpi-choice-option.is-selected') || options[0];
            selected?.focus({ preventScroll: true });
        }
    };
    trigger?.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
    options.forEach(option => {
        option.addEventListener('click', () => {
            const value = option.dataset.value || '';
            const label = option.textContent.trim();
            root.dataset.value = value;
            trigger.querySelector('span').textContent = label;
            options.forEach(opt => opt.classList.toggle('is-selected', opt === option));
            setOpen(false);
            trigger.focus({ preventScroll: true });
            onChange?.(value);
        });
    });
}

function setDoorpiChoiceDisabled(id, disabled) {
    const root = document.getElementById(id);
    if (!root) return;
    root.dataset.disabled = disabled ? 'true' : 'false';
    root.classList.toggle('is-disabled', disabled);
    root.classList.remove('is-open');
    root.querySelector('.doorpi-choice-trigger')?.setAttribute('aria-expanded', 'false');
}

function getDoorpiChoiceValue(id) {
    return document.getElementById(id)?.dataset.value || '';
}

function avatarMarkup(user) {
    return `<div class="doorpi-avatar">${user.PhotoBase64 ? `<img src="data:image/png;base64,${user.PhotoBase64}" />` : '•'}</div>`;
}

function showUserPicker(users, requireSelection = false) {
    ensureDoorpiOverlayStyles();
    let overlay = document.getElementById('doorpiUserPicker');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'doorpiUserPicker';
        overlay.className = 'doorpi-user-overlay';
        document.body.appendChild(overlay);
    }
    overlay.dataset.required = requireSelection ? 'true' : 'false';

    const cards = users.map(user => `
        <button class="doorpi-user-card" data-user-id="${escapeHtml(user.Id)}" tabindex="0">
            ${avatarMarkup(user)}
            <span class="doorpi-user-name">${escapeHtml(user.Name)}</span>
            ${user.Id === window._doorpiCurrentUserId ? '<span class="doorpi-user-badge">Atual</span>' : ''}
        </button>`).join('');

    overlay.innerHTML = `
        <div class="doorpi-user-panel">
            <div class="doorpi-panel-head">
                <div>
                    <h2 class="doorpi-panel-title">Quem está jogando?</h2>
                    <p class="doorpi-panel-sub">Bem vindo de volta</p>
                </div>
                ${requireSelection ? '' : '<button class="doorpi-manager-btn" id="doorpiCloseUsers">Voltar</button>'}
            </div>
            <div class="doorpi-user-grid">
                ${cards}
                <button class="doorpi-user-card" id="doorpiCreateUserCard" tabindex="0">
                    <div class="doorpi-avatar">+</div>
                    <span class="doorpi-user-name">Novo usuário</span>
                </button>
            </div>
        </div>`;

    overlay.style.display = 'flex';
    overlay.querySelectorAll('[data-user-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            postToHost({ action: 'selectUser', userId: btn.dataset.userId });
            overlay.style.display = 'none';
        });
    });
    overlay.querySelector('#doorpiCreateUserCard')?.addEventListener('click', openCreateUserDialog);
    overlay.querySelector('#doorpiCloseUsers')?.addEventListener('click', () => overlay.style.display = 'none');
    setTimeout(() => overlay.querySelector('.doorpi-user-card')?.focus(), 50);
}

function openCreateUserDialog() {
    window.closeDoorpiTopOverlay?.();
    if (typeof openSetup === 'function') {
        openSetup(true);
    }
}

function openExtensionsManager() {
    ensureDoorpiOverlayStyles();
    let overlay = document.getElementById('doorpiExtensionsManager');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'doorpiExtensionsManager';
        overlay.className = 'doorpi-manager-overlay';
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
        <div class="doorpi-manager-panel">
            <div class="doorpi-panel-head">
                <div>
                    <h2 class="doorpi-panel-title">Extensões</h2>
                    <p class="doorpi-panel-sub">Cole um link da Chrome Web Store para instalar no navegador interno.</p>
                </div>
                <button class="doorpi-manager-btn" id="btnCloseExtMgr">Voltar</button>
            </div>
            <div class="doorpi-manager-form">
                <input class="doorpi-manager-input" id="extensionUrlInput" placeholder="Link da Chrome Web Store" tabindex="0" />
                <button class="doorpi-manager-btn" id="btnExtPaste" tabindex="0" title="Colar">📋</button>
                <button class="doorpi-manager-btn" id="btnOpenChromeStore" tabindex="0">Loja</button>
                <button class="doorpi-manager-btn primary" id="btnInstallExtension" tabindex="0">Instalar</button>
            </div>
            <div class="doorpi-status" id="extensionStatus">Carregando...</div>
            <div class="doorpi-manager-list" id="extensionsList"></div>
        </div>`;

    overlay.style.display = 'flex';
    overlay.querySelector('#btnCloseExtMgr')?.addEventListener('click', () => overlay.style.display = 'none');
    overlay.querySelector('#btnExtPaste')?.addEventListener('click', () => postToHost({ action: 'readClipboard' }));
    overlay.querySelector('#btnOpenChromeStore')?.addEventListener('click', () => postToHost({ action: 'openExtensionStore' }));
    overlay.querySelector('#btnInstallExtension')?.addEventListener('click', () => {
        const url = document.getElementById('extensionUrlInput')?.value.trim();
        const status = document.getElementById('extensionStatus');
        if (!url) { if (status) { status.textContent = 'Cole o link da extensão.'; status.className = 'doorpi-status error'; } return; }
        if (status) { status.textContent = 'Baixando e instalando...'; status.className = 'doorpi-status'; }
        postToHost({ action: 'installExtension', url });
    });
    postToHost({ action: 'requestExtensions' });

    setTimeout(() => {
        const input = overlay.querySelector('#extensionUrlInput');
        if (input) {
            input.focus();
            input.addEventListener('click', () => { if (!window._vkbIsOpen) window._vkbOpen?.(input); });
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!window._vkbIsOpen) window._vkbOpen?.(input);
                }
            });
        }
    }, 50);
}

function renderExtensionsManager(extensions, status, message) {
    const overlay = document.getElementById('doorpiExtensionsManager');
    if (!overlay || overlay.style.display === 'none') return;
    const list = overlay.querySelector('#extensionsList');
    const statusEl = overlay.querySelector('#extensionStatus');
    if (statusEl) {
        statusEl.textContent = message || (extensions.length ? `${extensions.length} extensão(ões) instalada(s)` : 'Nenhuma extensão instalada.');
        statusEl.className = `doorpi-status ${status || ''}`.trim();
    }
    if (list) {
        list.innerHTML = extensions.map(ext => `
            <div class="doorpi-manager-row">
                <div>
                    <strong>${escapeHtml(ext.Name || ext.Id)}</strong>
                    <div style="color:rgba(255,255,255,.42);font-size:.82rem">${escapeHtml(ext.Id)}</div>
                </div>
                <span style="color:rgba(255,255,255,.45);font-size:.82rem">Instalada</span>
            </div>`).join('');
    }
}

window.openExtensionsManager = openExtensionsManager;
window.openCreateUserDialog = openCreateUserDialog;

window.isDoorpiOverlayOpen = function () {
    return Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
        .some(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
};

window.getDoorpiOverlayItems = function () {
    const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
        .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
    const top = overlays.at(-1);
    if (!top) return [];
    return Array.from(top.querySelectorAll('button, input, select, [tabindex="0"]'))
        .filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);
};

window.closeDoorpiTopOverlay = function () {
    const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
        .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
    const top = overlays.at(-1);
    if (top?.dataset.required === 'true') return;
    if (top) top.style.display = 'none';
};

document.addEventListener('click', (e) => {
    const input = e.target.closest?.('input[type="text"], input:not([type]), textarea');
    if (!input) return;
    if (window._vkbIsOpen) return;
    if (input.closest('.doorpi-manager-overlay, .doorpi-user-overlay, .edit-modal-overlay, #addGameContainer, #setupContainer, .nav-profile-dashboard')) {
        input.removeAttribute('readonly');
        window._vkbOpen?.(input);
    }
}, true);

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || window._vkbIsOpen) return;
    const input = e.target.closest?.('input[type="text"], input:not([type]), textarea');
    if (!input) return;
    if (input.closest('.doorpi-manager-overlay, .doorpi-user-overlay, .edit-modal-overlay, #addGameContainer, #setupContainer, .nav-profile-dashboard')) {
        e.preventDefault();
        input.removeAttribute('readonly');
        window._vkbOpen?.(input);
    }
}, true);

/* Seção: Overlay de Loading */
function showGlobalLoading(titleText, subtitleText) {
    window.isGlobalLoading = true;
    window.updateNavHint?.();
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

const _TAB_MAP = { 'apps': 0, 'media-apps': 1, 'folders': 2 };
const _VIEW_MAP = { 'apps': 'view-apps', 'media-apps': 'view-media-apps', 'folders': 'view-folders' };

function switchTab(tabId) {
    document.querySelectorAll('.menu-tab').forEach((btn, i) => {
        const id = Object.keys(_TAB_MAP)[i];
        btn.classList.toggle('active', id === tabId);
    });
    document.querySelectorAll('.view-section').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });
    const view = document.getElementById(_VIEW_MAP[tabId]);
    view?.classList.remove('hidden');
    view?.classList.add('active');

    if (tabId === 'folders') {
        if (cachedFolders === null) {
            showGlobalLoading(t('foldersTitle'), t('readingApps'));
            requestFolders();
        } else {
            renderFolderList(cachedFolders);
        }
    } else if (tabId === 'media-apps') {
        _initMediaAppsView();
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

    filtered = filtered.filter(a => (a.AddedTo || a.addedTo) !== 'media');

    populateAppModal(filtered);
}

function refreshInstalledAppsView() {
    const activeView = document.querySelector('.view-section.active')?.id;
    const exeActive = activeView === 'view-media-apps' &&
        document.getElementById('subview-exe')?.classList.contains('active');

    if (exeActive) {
        _renderExeAppModal();
        return;
    }

    applyFilterAndRender();
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
    postToHost({ action: 'startAppPolling' });
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
    switchTab('media-apps');
    postToHost({ action: 'requestInstalledApps' });
    postToHost({ action: 'startAppPolling' });
});

function closeModal() {
    document.getElementById('addGameContainer').style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'auto';
    document.getElementById('selectionCounter')?.classList.remove('visible');
    isModalOpen = false;
    hideGlobalLoading();

    postToHost({ action: 'stopAppPolling' });
    window.focusFeaturedCard?.();
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
            showLoadingCards(selected.length, 'games');
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
    const pendingLoading = grid.querySelector('.card.loading-card');
    if (pendingLoading) {
        if (pendingLoading.classList.contains('featured')) {
            card.classList.add('featured');
        }
        pendingLoading.remove();
    }
    card.className = 'card';
    card.tabIndex = 0;
    card.dataset.badgeNew = t('badgeNew');
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

        window._heroCleanupTimer = setTimeout(() => {
            const bgBlur = document.getElementById('bgBlur');
            const heroImg = document.getElementById('heroImage');
            const logoEl = document.getElementById('gameLogo');
            const gridBgImg = document.getElementById('gridBgImg');

            if (bgBlur) bgBlur.style.opacity = '0';
            if (heroImg) heroImg.style.opacity = '0';
            if (logoEl) { logoEl.classList.remove('visible'); logoEl.style.opacity = ''; }
            if (gridBgImg) gridBgImg.removeAttribute('src');

            _currentBgSrc = '';
            if (typeof _heroReqId !== 'undefined') _heroReqId++;
        }, 80);
    };

    card._startInteraction = startInteraction;
    card._stopInteraction = stopInteraction;
    card.addEventListener('mouseenter', startInteraction);
    card.addEventListener('mouseleave', stopInteraction);
    card.addEventListener('focus', () => { pendingInteractionCard = card; signalNavigation(); });
    card.addEventListener('blur', () => { if (pendingInteractionCard === card) pendingInteractionCard = null; stopInteraction(); });
    card.addEventListener('click', () => {
        window.trackGameOpened?.(gameId);
        postToHost({ action: 'launch', path: gameId, errorMsg: t('msgErrorLaunch') });
    });

    card.appendChild(img);
    const title = document.createElement('div');
    title.className = 'title';
    title.innerText = data.name;
    card.appendChild(title);

    if (btnAdd) grid.insertBefore(card, btnAdd);
    else grid.appendChild(card);
    reorderGameGrid();

    if (data.isFeatured) {
        setTimeout(() => {
            startInteraction();
            window.focusFeaturedCard?.();
        }, 100);
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
let _heroReqId = 0;

function cancelHeroTransition() {
    if (_heroTimer) { clearTimeout(_heroTimer); _heroTimer = null; }
    document.querySelectorAll('.crossfade-clone-heroImage, .crossfade-clone-gridBgImg').forEach(c => c.remove());
}

function preloadImage(src) {
    return new Promise(resolve => {
        if (!src) return resolve();
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = src;
    });
}

async function crossfadeBanner(el, newSrc) {
    if (!el || !newSrc) return;
    if (el.src === newSrc || el.src.endsWith(newSrc)) {
        el.style.opacity = '1';
        return;
    }

    const tempImg = new Image();
    tempImg.src = newSrc;
    try { await tempImg.decode(); } catch (e) { }

    const comp = window.getComputedStyle(el);
    const cloneClass = `crossfade-clone-${el.id}`;

    document.querySelectorAll(`.${cloneClass}`).forEach(c => c.remove());

    const clone = el.cloneNode(true);
    clone.classList.add(cloneClass);
    clone.style.position = 'absolute';
    clone.style.zIndex = parseInt(comp.zIndex) + 1;
    clone.style.pointerEvents = 'none';
    clone.style.opacity = comp.opacity;
    clone.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)';

    clone.style.webkitMaskImage = comp.webkitMaskImage;
    clone.style.maskImage = comp.maskImage;
    clone.style.webkitMaskComposite = comp.webkitMaskComposite;
    clone.style.maskComposite = comp.maskComposite;

    el.parentNode.insertBefore(clone, el.nextSibling);

    el.style.transition = 'none';
    el.style.opacity = '1';
    el.src = newSrc;

    void el.offsetWidth;

    requestAnimationFrame(() => {
        clone.style.opacity = '0';
        setTimeout(() => { if (clone.parentNode) clone.remove(); }, 900);
    });
}

function switchHeroBackground(bgSrc, logoSrc, heroSrc) {
    if (window._heroCleanupTimer) {
        clearTimeout(window._heroCleanupTimer);
        window._heroCleanupTimer = null;
    }
    const heroImg = document.getElementById('heroImage');
    const logoImg = document.getElementById('gameLogo');
    const gridBg = document.getElementById('gridBgImg');
    const bgBlur = document.getElementById('bgBlur');

    if (!bgSrc) return;

    if (_currentBgSrc.split('?')[0] === bgSrc.split('?')[0]) {
        if (heroImg) heroImg.style.opacity = '1';
        if (gridBg) gridBg.style.opacity = '1';
        if (bgBlur) bgBlur.style.opacity = '1';
        if (logoImg && logoImg.src) logoImg.classList.add('visible');
        return;
    }

    _currentBgSrc = bgSrc;

    cancelHeroTransition();
    const reqId = ++_heroReqId;

    if (logoImg) logoImg.classList.remove('visible');

    const loadPromise = Promise.all([
        preloadImage(heroSrc || bgSrc),
        preloadImage(bgSrc),
        logoSrc ? preloadImage(logoSrc) : Promise.resolve()
    ]);
    const minTimePromise = new Promise(resolve => setTimeout(resolve, 0));

    Promise.all([loadPromise, minTimePromise]).then(() => {
        if (reqId !== _heroReqId) return;

        if (heroImg) crossfadeBanner(heroImg, heroSrc || bgSrc);

        if (gridBg) {
            gridBg.style.transition = 'none';
            gridBg.style.opacity = '1';
            gridBg.src = heroSrc || bgSrc;
        }

        if (bgBlur) {
            bgBlur.style.transition = 'none';
            bgBlur.style.opacity = '1';
            if (bgBlur.tagName === 'IMG') bgBlur.src = heroSrc || bgSrc;
        }

        if (logoImg) {
            if (logoSrc) {
                setTimeout(() => {
                    if (reqId !== _heroReqId) return;
                    setImgSrc(logoImg, logoSrc).then(() => {
                        requestAnimationFrame(() => logoImg.classList.add('visible'));
                    });
                }, 200);
            }
        }
    });
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

    if (!src) {
        imgEl.removeAttribute('src');
        return;
    }

    if (imgEl.src === src || imgEl.src.endsWith(src)) {
        imgEl.style.opacity = '1';
        return;
    }

    const tmp = new Image();
    tmp.loading = "eager";
    tmp.decoding = "async";
    tmp.src = src;

    try {
        await tmp.decode();

        if (imgEl.__req === req) {
            imgEl.src = src;
            imgEl.style.transition = 'none';
            imgEl.style.opacity = '1';
        }
    } catch (e) {
        if (imgEl.__req === req) {
            imgEl.src = src;
            imgEl.style.opacity = '1';
        }
    }
}
function toggleNavMenu(isOpen) {
    const hint = document.getElementById('navHintDown');
    if (isOpen) {
        if (typeof _stopBlobBg === 'function') _stopBlobBg();
        document.body.classList.add('nav-menu-active');
        hint?.classList.add('visible', 'nav-open');
    } else {
        document.body.classList.remove('nav-menu-active');
        hint?.classList.remove('nav-open');
        setTimeout(() => {
            if (typeof _startBlobBg === 'function') _startBlobBg();
        }, 800);
        window.updateNavHint?.();
    }
}

/* Seção: Injeção de estilos e elementos auxiliares */
(function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
        /* Camadas de Renderização Otimizadas */
        .main-content-wrapper,
        #heroImage,
        #gridBgImg,
        #bgBlur,
        #gameLogo,
        [class*="crossfade-clone-"] {
            will-change: transform;
            backface-visibility: hidden;
            transform: translateZ(0); /* Força aceleração 2D simples */
        }

        /* 1. Transição com curva Sharp (Melhor para 60Hz) */
        .main-content-wrapper,
        #heroImage,
        #gridBgImg,
        #bgBlur,
        #gameLogo,[class*="crossfade-clone-"] {
            /* Curva 'Quintic Out': Começa muito rápido, termina muito lento */
            transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), 
                        opacity 0.25s ease-out !important;
        }

        /* 2. Movimento Consistente */
        body.nav-menu-active .main-content-wrapper,
        body.nav-menu-active #heroImage,
        body.nav-menu-active #gridBgImg,
        body.nav-menu-active #bgBlur,
        body.nav-menu-active #gameLogo,
        body.nav-menu-active[class*="crossfade-clone-"] {
            transform: translateY(-100vh) !important;
            opacity: 0 !important;
        }

        /* 3. Desligar o Blur IMEDIATAMENTE (O maior peso no 60Hz) */
        body.nav-menu-active #bgBlur,
        body.nav-menu-active[class*="crossfade-clone-bgBlur"] {
            filter: none !important;
        }

        /* 4. Blob Background (Aparece sem competir com o scroll) */
        #appBlobBg {
            z-index: -1;
            pointer-events: none;
        }
        
        body.nav-menu-active #appBlobBg {
            opacity: 1 !important;
            transition: opacity 0.4s ease-in 0.2s !important; 
        }

        .nav-menu {
            transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.4, 1), opacity 0.4s ease;
            transform-origin: top right;
        }
.card.new-game {
        position: relative;
    }
    .card.new-game::before {
content: attr(data-badge-new);
    position: absolute;
    top: clamp(8px, 0.63vw, 12px);
    left: clamp(8px, 0.63vw, 12px);
    z-index: 10;
    background: #fff;
    color: #06060e;
    font-size: clamp(0.48rem, 0.50vw, 0.60rem);
    font-weight: 800;
    letter-spacing: 0.2em;
    width: 5.4em;
    padding: 3px 7px 4px;
    border-radius: 3px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
    animation: badge-enter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    background-image: none;
    }

body.nav-menu-active .nav-menu {
    transform: scale(1) translateX(0) !important;
    opacity: 1;
}
    /* ▼ Novo Indicador Sutil ▼ */
#navHintDown {
    position: fixed;
    bottom: 0.2rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
}
#navHintDown.visible { opacity: 1; }
#navHintDown.nav-open { bottom: auto; top: 2rem; }
#navHintDown.nav-open svg { transform: rotate(180deg); }
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
// ══════════════════════════════════════════════════════════════════════════
// Context Menu
// ══════════════════════════════════════════════════════════════════════════

const _ctxMenu = (() => {
    const el = document.createElement('div');
    el.className = 'context-menu';
    el.setAttribute('role', 'menu');
    el.innerHTML = `
        <div class="ctx-game-name" id="ctxGameName"></div>
        <button class="ctx-item" id="ctxExtensions" role="menuitem">
            <span class="ctx-icon">+</span> <span>Gerenciar extensões</span>
        </button>
        <div class="ctx-separator"></div>
        <button class="ctx-item" id="ctxEdit" role="menuitem">
            <span class="ctx-icon">✎</span> <span data-i18n="ctxEditName"></span>
        </button>
        <div class="ctx-separator"></div>
        <button class="ctx-item ctx-danger" id="ctxDelete" role="menuitem">
            <span class="ctx-icon">✕</span> <span data-i18n="ctxRemoveGame"></span>
        </button>
    `;
    document.body.appendChild(el);
    return el;
})();

let _ctxCard = null;

function _openCtxMenu(card, x, y) {
    _ctxCard = card;
    _ctxCard.classList.add('ctx-active');

    if (typeof applyI18n === 'function') applyI18n();

    const gameId = card.dataset.gameId || card.dataset.appId || card.dataset.appUrl;
    const isYoutube = (gameId && gameId.toLowerCase().includes('youtube'));

    const ctxEditBtn = _ctxMenu.querySelector('#ctxEdit');
    const ctxExtensionsBtn = _ctxMenu.querySelector('#ctxExtensions');
    const ctxDeleteBtn = _ctxMenu.querySelector('#ctxDelete');
    const isBrowserMedia = (card.hasAttribute('data-app-id') || card.closest('#mediaGrid')) &&
        (card.dataset.appType || 'browser') !== 'exe';

    let ctxCloseBtn = _ctxMenu.querySelector('#ctxClose');
    if (!ctxCloseBtn) {
        ctxCloseBtn = document.createElement('button');
        ctxCloseBtn.className = 'ctx-item';
        ctxCloseBtn.id = 'ctxClose';
        ctxCloseBtn.innerHTML = `<span class="ctx-icon">↩</span> <span>Voltar</span>`;
        ctxCloseBtn.addEventListener('click', _closeCtxMenu);
        _ctxMenu.appendChild(ctxCloseBtn);
    }

    if (isYoutube) {
        if (ctxEditBtn) ctxEditBtn.style.display = 'none';
        if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = isBrowserMedia ? 'flex' : 'none';
        if (ctxDeleteBtn) ctxDeleteBtn.style.display = 'none';
        ctxCloseBtn.style.display = 'flex';
        _ctxMenu.querySelector('#ctxGameName').textContent = "APP DO SISTEMA";
    } else {
        if (ctxEditBtn) ctxEditBtn.style.display = 'flex';
        if (ctxExtensionsBtn) ctxExtensionsBtn.style.display = isBrowserMedia ? 'flex' : 'none';
        if (ctxDeleteBtn) ctxDeleteBtn.style.display = 'flex';
        ctxCloseBtn.style.display = 'none';
        _ctxMenu.querySelector('#ctxGameName').textContent = card.querySelector('.title, .nav-vertical-card-title')?.innerText?.trim() || '';
    }

    _ctxMenu.style.display = 'flex';
    requestAnimationFrame(() => {
        const w = _ctxMenu.offsetWidth, h = _ctxMenu.offsetHeight, m = 10;
        _ctxMenu.style.left = Math.min(x, window.innerWidth - w - m) + 'px';
        _ctxMenu.style.top = Math.min(y, window.innerHeight - h - m) + 'px';
        _ctxMenu.classList.add('visible');
        isCtxMenuOpen = true;

        if (isYoutube) ctxCloseBtn.focus();
        else ctxEditBtn?.focus();
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

document.getElementById('ctxExtensions').addEventListener('click', () => {
    _closeCtxMenu();
    openExtensionsManager();
});

document.getElementById('ctxDelete').addEventListener('click', () => {
    const card = _ctxCard; _closeCtxMenu();
    if (card) _executeDelete(card);
});

// ══════════════════════════════════════════════════════════════════════════
// Deleção
// ══════════════════════════════════════════════════════════════════════════
function _executeDelete(card) {
    const id1 = card.dataset.gameId;
    const id2 = card.dataset.appId;
    const id3 = card.dataset.appUrl;

    const searchKeys = [id1, id2, id3].filter(Boolean);
    if (searchKeys.length === 0) return;

    if (searchKeys.some(k => k.toLowerCase().includes('youtube'))) return;

    const isMedia = card.hasAttribute('data-app-id') || card.closest('#mediaGrid') !== null;

    const allCards = Array.from(document.querySelectorAll('.card, .nav-vertical-card')).filter(c => {
        const cId1 = c.dataset.gameId;
        const cId2 = c.dataset.appId;
        const cId3 = c.dataset.appUrl;
        return searchKeys.some(k => k === cId1 || k === cId2 || k === cId3);
    });

    allCards.forEach(c => {
        if (c.classList.contains('featured')) {
            const grid = c.closest('#gameGrid') || c.closest('#mediaGrid');
            const next = Array.from(grid.querySelectorAll('.card:not(.add-card)')).find(sib => sib !== c);
            if (next) {
                next.classList.add('featured');
                const img = next.querySelector('img');
                if (img) img.src = next.dataset.staticHorizontal || next.dataset.horizontal || next.dataset.staticVertical || '';
                next._startInteraction?.();
            } else {
                if (typeof clearHero === 'function') clearHero();
            }
        }

        c.classList.add('removing');
        setTimeout(() => c.remove(), 280);
    });

    if (typeof _menuData !== 'undefined') {
        ['games', 'media'].forEach(cat => {
            if (!_menuData[cat]) return;
            const idx = _menuData[cat].findIndex(i => {
                const key = i.LaunchUrl || i.Path || i.Url;
                return searchKeys.includes(key) || searchKeys.includes(i.Id);
            });
            if (idx >= 0) _menuData[cat].splice(idx, 1);
        });
    }

    postToHost({
        action: 'deleteGame',
        gameId: id1 || id2,
        isMedia: isMedia
    });
}
// ══════════════════════════════════════════════════════════════════════════
// Edit Modal
// ══════════════════════════════════════════════════════════════════════════

let _editCard = null;
let _editOverlay = null;
function openEditGameModal(card) {
    ensureDoorpiOverlayStyles();
    const currentName = card.querySelector('.title')?.innerText?.trim() ||
        card.querySelector('.nav-vertical-card-title')?.innerText?.trim() || '';
    _editCard = card;

    const gameId = card.dataset.gameId || card.dataset.appId || card.dataset.appUrl;

    // 🔹 DETECÇÃO INFALÍVEL DE MÍDIA PARA O MENU CONTEXTO DA BIBLIOTECA 🔹
    const isMediaTabActive = typeof window.getCurrentHomeTab === 'function' && window.getCurrentHomeTab() === 'media';
    const isMediaCard = card.hasAttribute('data-app-id') ||
        card.closest('#mediaGrid') !== null ||
        isMediaTabActive;

    const appType = card.dataset.appType || 'browser';
    const canManageBrowser = isMediaCard && appType !== 'exe';
    const shareMode = card.dataset.shareMode || 'private';
    const sharedWithUserId = card.dataset.sharedWithUserId || '';
    const isSharedFromOther = card.dataset.sharedFromOther === 'true';
    const shareUsers = (window._doorpiUsers || []).filter(u => u.Id !== window._doorpiCurrentUserId);
    const shareModeOptions = [
        { value: 'private', label: 'Separado por usuario' },
        { value: 'all', label: 'Compartilhar com todos' },
        { value: 'user', label: 'Compartilhar com usuario' }
    ];
    const shareUserOptions = [
        { value: '', label: 'Escolha o usuario' },
        ...shareUsers.map(u => ({ value: u.Id, label: u.Name || 'Usuario' }))
    ];

    // 🔹 INJETADO O TABINDEX NO SELECT PRA SER FOCÁVEL
    const shareOptions = '';
    const mediaExtras = isMediaCard ? `
                <div class="edit-modal-field">
                    <label class="edit-modal-label">Compartilhamento de conta</label>
                    ${isSharedFromOther
            ? `<div class="doorpi-shared-note">Compartilhado por ${escapeHtml(card.dataset.sharedFromName || 'outro usuário')}.</div>`
            : `<div class="doorpi-share-grid">
                            ${renderDoorpiChoice('editShareModeChoice', shareModeOptions, shareMode)}
                            ${renderDoorpiChoice('editShareUserChoice', shareUserOptions, sharedWithUserId, shareMode !== 'user')}
                            <select class="doorpi-share-select" id="editShareMode" tabindex="0">
                                <option value="private" ${shareMode === 'private' ? 'selected' : ''}>Separado por usuário</option>
                                <option value="all" ${shareMode === 'all' ? 'selected' : ''}>Compartilhar com todos</option>
                                <option value="user" ${shareMode === 'user' ? 'selected' : ''}>Compartilhar com usuário</option>
                            </select>
                            <select class="doorpi-share-select" id="editShareUser" tabindex="0" ${shareMode === 'user' ? '' : 'disabled'}>
                                <option value="">Escolha o usuário</option>
                                ${shareOptions}
                            </select>
                        </div>`}
                </div>
                ${canManageBrowser ? `<button class="modal-btn secondary" id="editExtensionsBtn" type="button" tabindex="0">Gerenciar Extensões</button>` : ''}` : '';

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
                ${mediaExtras}
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
    bindDoorpiChoice(overlay.querySelector('#editShareModeChoice'), value => {
        setDoorpiChoiceDisabled('editShareUserChoice', value !== 'user');
    });
    bindDoorpiChoice(overlay.querySelector('#editShareUserChoice'));
    overlay.querySelector('#editShareMode')?.addEventListener('change', e => {
        const userSelect = overlay.querySelector('#editShareUser');
        if (userSelect) userSelect.disabled = e.target.value !== 'user';
    });

    const doClose = () => {
        isEditModalOpen = false;
        window._vkbForceClose();
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.12s';
        setTimeout(() => { overlay.remove(); _editOverlay = null; }, 130);
        window.focusFeaturedCard?.();
    };

    overlay.querySelector('#editExtensionsBtn')?.addEventListener('click', () => {
        doClose(); // 🔹 Fecha o modal de Editar antes de abrir Extensões
        openExtensionsManager();
    });

    const doSave = () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            const gameId = card.dataset.gameId || card.dataset.appId;
            const allCards = Array.from(document.querySelectorAll('.card, .nav-vertical-card')).filter(c =>
                c.dataset.gameId === gameId || c.dataset.appId === gameId
            );
            allCards.forEach(c => {
                const titleEl = c.querySelector('.title, .nav-vertical-card-title');
                if (titleEl) titleEl.innerText = newName;
            });
            if (typeof _menuData !== 'undefined') {
                ['games', 'media'].forEach(cat => {
                    if (!_menuData[cat]) return;
                    const item = _menuData[cat].find(i => (i.LaunchUrl || i.Path || i.Url) === gameId);
                    if (item) item.Name = newName;
                });
            }
            postToHost({ action: 'editGame', gameId: gameId, newName });
        }
        if (isMediaCard && !isSharedFromOther) {
            const mode = getDoorpiChoiceValue('editShareModeChoice') || 'private';
            const targetUser = getDoorpiChoiceValue('editShareUserChoice') || '';
            const appId = card.dataset.appId || card.dataset.gameId;
            card.dataset.shareMode = mode;
            card.dataset.sharedWithUserId = mode === 'user' ? targetUser : '';
            postToHost({ action: 'updateAppSharing', appId, shareMode: mode, sharedWithUserId: targetUser });
        }
        doClose();
    };

    overlay.querySelector('#editSaveBtn').addEventListener('click', doSave);
    overlay.querySelector('#editCancelBtn').addEventListener('click', doClose);
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) doClose(); });

    input.addEventListener('keydown', e => {
        if (window._vkbIsOpen) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            window._vkbOpen?.(input);
        }
        if (e.key === 'Escape') { e.preventDefault(); doClose(); }
    });

    input.addEventListener('click', () => { if (!window._vkbIsOpen) window._vkbOpen?.(); });

    window._editModalClose = doClose;
    window._editModalSave = doSave;
    isEditModalOpen = true;

    requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    });
}

// ══════════════════════════════════════════════════════════════════════════
// Teclado Virtual
// ══════════════════════════════════════════════════════════════════════════

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
    let _callbacks = {};
    let _returnFocusEl = null;
    let _shifted = true;
    let _inputEl = null;
    let _cursorPos = 0;

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
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                _pressKey(btn.dataset.key);
            });
        });
    }

    function _syncCursorToInput() {
        if (!_inputEl) return;
        _inputEl.setSelectionRange(_cursorPos, _cursorPos);
    }

    function _insertText(text) {
        if (!_inputEl) return;
        let val = _inputEl.value;
        _inputEl.value = val.substring(0, _cursorPos) + text + val.substring(_cursorPos);
        _cursorPos += text.length;
        _syncCursorToInput();
    }

    function _deleteText() {
        if (!_inputEl || _cursorPos <= 0) return;
        let val = _inputEl.value;
        _inputEl.value = val.substring(0, _cursorPos - 1) + val.substring(_cursorPos);
        _cursorPos--;
        _syncCursorToInput();
    }

    function _pressKey(key) {
        if (!_inputEl) return;

        if (key === '⌫') { _deleteText(); }
        else if (key === 'shift') { _setShiftVisual(!_shifted); return; }
        else if (key === 'space') { _insertText(' '); }
        else if (key === 'ok') {
            const fn = _callbacks.onOk ?? window._editModalSave;
            _forceClose();
            fn?.();
            return;
        }
        else if (key === 'cancel') {
            const fn = _callbacks.onCancel ?? window._editModalClose;
            _forceClose();
            fn?.();
            return;
        }
        else { _insertText(_shifted ? key.toUpperCase() : key); }

        _inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        _renderPreview();
    }

    function _renderPreview() {
        const el = document.getElementById('vkbPreview');
        if (!el || !_inputEl) return;
        const val = _inputEl.value || '';
        const formatHtml = (text) => _esc(text).replace(/ /g, '&nbsp;');
        const left = val.substring(0, _cursorPos);
        const right = val.substring(_cursorPos);
        el.innerHTML = `${formatHtml(left)}<span class="vkb-cursor"></span>${formatHtml(right)}`;
    }

    function _moveCursor(dir) {
        if (!_inputEl) return;
        let newPos = _cursorPos + dir;
        if (newPos >= 0 && newPos <= _inputEl.value.length) _cursorPos = newPos;
        _syncCursorToInput();
        _renderPreview();
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

    function _open(targetInput, callbacks = {}) {
        _callbacks = callbacks;
        _returnFocusEl = targetInput ?? document.activeElement;
        _inputEl = targetInput || document.getElementById('editNameInput');

        if (!_inputEl) return;
        _build();

        if (_el) {
            _el.querySelector('.vkb-preview-label').textContent = t('vkbPreviewLabel');
            _el.querySelector('[data-key="space"]').textContent = t('vkbSpace');
            _el.querySelector('[data-key="cancel"]').textContent = t('vkbCancel');
            _el.querySelector('[data-key="ok"]').textContent = t('vkbOk');
        }

        _setShiftVisual(_shifted);
        _cursorPos = _inputEl.value.length;
        _inputEl.classList.add('vkb-active');
        if (typeof _editOverlay !== 'undefined' && _editOverlay) _editOverlay.classList.add('vkb-active');

        _el.style.display = 'block';
        _renderPreview();
        _syncCursorToInput();

        requestAnimationFrame(() => {
            _el.classList.add('visible');
            window._vkbIsOpen = true;
            _el.querySelector('[data-key="q"]')?.focus();
        });
    }

    function _forceClose() {
        if (!_el) return;
        _callbacks = {};
        window._vkbIsOpen = false;
        _el.classList.remove('visible');

        if (_inputEl) { _inputEl.classList.remove('vkb-active'); _inputEl = null; }
        if (typeof _editOverlay !== 'undefined' && _editOverlay) _editOverlay.classList.remove('vkb-active');

        const returnTo = _returnFocusEl;
        _returnFocusEl = null;
        setTimeout(() => { returnTo?.focus(); window.updateNavHint?.(); }, 350);
        setTimeout(() => { if (_el && !_el.classList.contains('visible')) _el.style.display = 'none'; }, 340);
    }

    function _physicalKey(key) {
        if (!_inputEl) return;
        if (key === 'Backspace') { _deleteText(); }
        else if (key.length === 1) { _insertText(key); }
        _inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        _renderPreview();
    }

    return {
        open: _open, forceClose: _forceClose, cancel: _forceClose, physicalKey: _physicalKey,
        toggleShift: () => _setShiftVisual(!_shifted), moveCursor: _moveCursor
    };
})();

const _TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'password', 'url', 'tel', '']);
window._vkbOpen = (el) => {
    // Agora o VKB abre em todos os inputs se for o tipo texto
    if (el && el.tagName === 'INPUT' && !_TEXT_INPUT_TYPES.has((el.type || '').toLowerCase())) return;
    VKB.open(el);
};
window._vkbCancel = () => VKB.cancel();
window._vkbForceClose = () => VKB.forceClose();
window._vkbPhysicalKey = (k) => VKB.physicalKey(k);
window._vkbToggleShift = () => VKB.toggleShift();
window._vkbMoveCursor = (dir) => VKB.moveCursor(dir);

function _esc(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// =============================================================================
// Indicador Flutuante (Menu Seta para Baixo)
// =============================================================================

(function initNavHint() {
    const navHint = document.createElement('div');
    navHint.id = 'navHintDown';
    navHint.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polyline points="6 9 12 15 18 9" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
    document.body.appendChild(navHint);

    window.updateNavHint = function () {
        const hint = document.getElementById('navHintDown');
        if (!hint) return;

        if (window.isNavMenuOpen) {
            hint.classList.add('visible', 'nav-open');
            return;
        }

        hint.classList.remove('nav-open');

        const focused = document.activeElement;
        const isCard = focused?.classList?.contains('card') && !focused?.classList?.contains('add-card');
        const inGrid = focused?.closest('#gameGrid') || focused?.closest('#mediaGrid');

        const isOverlayOpen = window.isModalOpen || window.isSetupOpen ||
            window._vkbIsOpen || window.isGlobalLoading ||
            (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) ||
            (typeof isEditModalOpen !== 'undefined' && isEditModalOpen);

        if (isOverlayOpen) { hint.classList.remove('visible'); return; }
        hint.classList.toggle('visible', !!(isCard && inGrid));
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

        const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,18,0.62)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);

        t++;
        _raf = requestAnimationFrame(frame);
    }

    frame();

    let _blobShowTimer = null;

    function checkHeroState() {
        const bgBlur = document.getElementById('bgBlur');
        const heroInactive = !bgBlur?.src || bgBlur.style.opacity === '0' || !bgBlur.src;

        if (heroInactive) {
            if (!_blobShowTimer) {
                _blobShowTimer = setTimeout(() => {
                    const stillInactive = !bgBlur?.src || bgBlur.style.opacity === '0';
                    if (stillInactive) canvas.style.opacity = '1';
                    _blobShowTimer = null;
                }, 400);
            }
        } else {
            if (_blobShowTimer) { clearTimeout(_blobShowTimer); _blobShowTimer = null; }
            canvas.style.opacity = '0';
        }
    }

    const bgBlur = document.getElementById('bgBlur');
    if (bgBlur) {
        new MutationObserver(checkHeroState).observe(bgBlur, {
            attributes: true,
            attributeFilter: ['src', 'style']
        });
    }

    const _origSwitch = window.switchHeroBackground;
    window.switchHeroBackground = function (...args) {
        _origSwitch?.(...args);
        setTimeout(checkHeroState, 0);
    };

    checkHeroState();
    window._startBlobBg = () => { if (!_raf) frame(); };
    window._stopBlobBg = () => { if (_raf) { cancelAnimationFrame(_raf); _raf = null; } };
})();
document.addEventListener('focusin', () => {
    const focused = document.activeElement;
    const isCard = focused?.classList?.contains('card');
    const isInGrid = focused?.closest('#gameGrid');

    const isNavMenuActive = document.body.classList.contains('nav-menu-active') || window.isNavMenuOpen;

    if (!isCard && !isInGrid && !isNavMenuActive) {
        window._heroCleanupTimer = setTimeout(() => {
            const bgBlur = document.getElementById('bgBlur');
            const heroImg = document.getElementById('heroImage');
            const logoEl = document.getElementById('gameLogo');
            const gridBgImg = document.getElementById('gridBgImg');

            if (bgBlur) bgBlur.style.opacity = '0';
            if (heroImg) heroImg.style.opacity = '0';
            if (logoEl) { logoEl.classList.remove('visible'); logoEl.style.opacity = ''; }
            if (gridBgImg) gridBgImg.removeAttribute('src');

            _currentBgSrc = '';
            if (typeof _heroReqId !== 'undefined') _heroReqId++;
        }, 80);
    }
});
function showLoadingCards(count, tab = 'games') {
    const gridId = tab === 'games' ? 'gameGrid' : 'mediaGrid';
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const btnRef = tab === 'games'
        ? document.getElementById('btnAdd')
        : document.getElementById('btnAddMedia');

    const existing = grid.querySelectorAll('.card:not(.add-card):not(.loading-card)').length;
    const toShow = Math.min(count, Math.max(0, 12 - existing));

    for (let i = 0; i < toShow; i++) {
        const card = document.createElement('div');
        card.className = 'card loading-card';
        if (i === 0 && !grid.querySelector('.card.featured:not(.loading-card)')) {
            card.classList.add('featured');
        }
        if (btnRef) grid.insertBefore(card, btnRef);
        else grid.appendChild(card);
    }
}

function clearLoadingCards(tab = 'games') {
    const gridId = tab === 'games' ? 'gameGrid' : 'mediaGrid';
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.querySelectorAll('.card.loading-card').forEach(c => c.remove());
}
function clearHero() {
    const isNavMenuActive = document.body.classList.contains('nav-menu-active') || window.isNavMenuOpen;
    if (isNavMenuActive) return;

    window._heroCleanupTimer = setTimeout(() => {
        const bgBlur = document.getElementById('bgBlur');
        const heroImg = document.getElementById('heroImage');
        const logoEl = document.getElementById('gameLogo');
        const gridBgImg = document.getElementById('gridBgImg');

        if (bgBlur) bgBlur.style.opacity = '0';
        if (heroImg) heroImg.style.opacity = '0';
        if (logoEl) { logoEl.classList.remove('visible'); logoEl.style.opacity = ''; }
        if (gridBgImg) gridBgImg.removeAttribute('src');

        _currentBgSrc = '';
        if (typeof _heroReqId !== 'undefined') _heroReqId++;
    }, 80);
}
document.getElementById('btnAdd')?.addEventListener('mouseenter', clearHero);
document.getElementById('btnAdd')?.addEventListener('focus', clearHero);

document.getElementById('btnAddMedia')?.addEventListener('mouseenter', clearHero);
document.getElementById('btnAddMedia')?.addEventListener('focus', clearHero);


// ══════════════════════════════════════════════════════════════════════════
// View: Aplicativos (App Web + Executável)
// ══════════════════════════════════════════════════════════════════════════

let _activeMediaSubtab = 'web';

function _initMediaAppsView() {
    _switchMediaSubtab(_activeMediaSubtab);

    document.getElementById('mediaAppSubtabs')
        ?.querySelectorAll('.subtab')
        .forEach(btn => {
            const fresh = btn.cloneNode(true);
            btn.replaceWith(fresh);
            fresh.addEventListener('click', () => _switchMediaSubtab(fresh.dataset.subtab));
        });
}

function _switchMediaSubtab(subtab) {
    _activeMediaSubtab = subtab;

    document.querySelectorAll('#mediaAppSubtabs .subtab').forEach(b =>
        b.classList.toggle('active', b.dataset.subtab === subtab));

    document.getElementById('subview-web')?.classList.toggle('hidden', subtab !== 'web');
    document.getElementById('subview-web')?.classList.toggle('active', subtab === 'web');
    document.getElementById('subview-exe')?.classList.toggle('hidden', subtab !== 'exe');
    document.getElementById('subview-exe')?.classList.toggle('active', subtab === 'exe');

    if (subtab === 'web') {
        _renderWebAppActions();
        _modalReady = true;
        setTimeout(() => document.getElementById('webAppNameInput')?.focus(), 150);
    } else {
        _renderExeAppModal();

        setTimeout(() => {
            const firstApp = document.querySelector('#appListMedia .app-item');
            if (firstApp) firstApp.focus();
            else document.getElementById('btnSearchMedia')?.focus();
        }, 150);
    }
}

function _renderWebAppActions() {
    const bar = document.getElementById('mediaAppActions');
    bar.innerHTML = `
        <div class="action-buttons">
            <button class="modal-btn primary" id="btnAddWebApp" tabindex="0" data-gamepad-hint="start">
                <span data-i18n="btnAddWebApp">Adicionar App</span>
            </button>
            <button class="modal-btn cancel" id="btnCancelWebApp" tabindex="0" data-gamepad-hint="cancel">
                <span data-i18n="btnCancelLabel">Voltar</span>
            </button>
        </div>`;

    document.getElementById('btnAddWebApp').addEventListener('click', _submitWebApp);
    document.getElementById('btnCancelWebApp').addEventListener('click', closeModal);

    const btnPaste = document.getElementById('btnWebAppPaste');
    if (btnPaste) {
        const freshBtn = btnPaste.cloneNode(true);
        btnPaste.replaceWith(freshBtn);
        freshBtn.addEventListener('click', () => {
            postToHost({ action: 'readClipboard' });
        });
    }

    ['webAppNameInput', 'webAppUrlInput'].forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;

        input.removeAttribute('readonly');
        input.setAttribute('tabindex', '0');

        const fresh = input.cloneNode(true);
        input.replaceWith(fresh);

        fresh.addEventListener('focus', () => { if (!window._vkbIsOpen) fresh.style.caretColor = ''; });
        fresh.addEventListener('blur', () => { if (!window._vkbIsOpen) fresh.style.caretColor = 'transparent'; });
        fresh.addEventListener('click', () => { if (!window._vkbIsOpen) window._vkbOpen?.(fresh); });

        fresh.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!window._vkbIsOpen) window._vkbOpen?.(fresh);
            }
        });
    });

    if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
}

function _submitWebApp() {
    const nameInput = document.getElementById('webAppNameInput');
    const urlInput = document.getElementById('webAppUrlInput');
    const hint = document.getElementById('webAppHint');

    const name = nameInput?.value.trim() || '';
    let url = urlInput?.value.trim() || '';

    nameInput?.classList.remove('error');
    urlInput?.classList.remove('error');
    if (hint) { hint.textContent = ''; hint.classList.remove('error'); }

    if (!name) {
        nameInput?.classList.add('error');
        nameInput?.focus();
        if (hint) {
            hint.textContent = (typeof t === 'function' ? t('webAppErrorName') : 'O nome é obrigatório');
            hint.classList.add('error');
        }
        return;
    }

    if (!url || url === 'https://' || url === 'http://') {
        urlInput?.classList.add('error');
        urlInput?.focus();
        if (hint) {
            hint.textContent = (typeof t === 'function' ? t('webAppErrorUrl') : 'O link é obrigatório');
            hint.classList.add('error');
        }
        return;
    }

    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    showGlobalLoading(t('downloadingCovers'), t('readingApps'));
    postToHost({ action: 'addWebApp', name, url });
}

function _shakeWebField(inputId, hintEl, msg) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.classList.add('error');
    input.addEventListener('input', () => input.classList.remove('error'), { once: true });
    if (hintEl) { hintEl.textContent = msg; hintEl.classList.add('error'); }
}

function _renderExeAppModal() {
    const bar = document.getElementById('mediaAppActions');
    bar.innerHTML = `
        <div class="selection-counter" id="selectionCounterMedia">
            <span class="counter-dot"></span>
            <span id="selectionCounterMediaText"></span>
        </div>
        <div class="action-buttons">
            <button class="modal-btn primary" id="btnConfirmAddMedia" tabindex="0" data-gamepad-hint="start">
                <span data-i18n="btnConfirmLabel">Adicionar Selecionados</span>
            </button>
            <button class="modal-btn secondary" id="btnSearchMedia" tabindex="0" data-gamepad-hint="triangle">
                <span data-i18n="btnSearchLabel">Procurar Manualmente</span>
            </button>
            <button class="modal-btn cancel" id="btnCancelAddMedia" tabindex="0" data-gamepad-hint="cancel">
                <span data-i18n="btnCancelLabel">Voltar</span>
            </button>
        </div>`;

    document.getElementById('btnCancelAddMedia').addEventListener('click', closeModal);
    document.getElementById('btnSearchMedia').addEventListener('click', () => {
        showGlobalLoading(t('detectingLibrary'), t('waitingWindows'));
        postToHost({
            action: 'browseManualMedia',
            dialogTitle: t('dlgBrowseTitle'),
            dialogFilter: t('dlgBrowseFilter'),
            loadingTitle: t('loadingAddingGame'),
            loadingSub: t('loadingFetchingCovers'),
            errorMsg: t('msgErrorOpenFile')
        });
    });
    document.getElementById('btnConfirmAddMedia').addEventListener('click', () => {
        const selected = Array.from(
            document.querySelectorAll('#appListMedia .app-item.selected')
        ).map(el => ({ Name: el.dataset.name, Path: el.dataset.path, LaunchUrl: el.dataset.launch }));

        if (selected.length > 0) {
            selected.forEach(app => newGameIdsThisSession.add(app.LaunchUrl || app.Path));
            showLoadingCards(selected.length, 'media');
            postToHost({ action: 'addSelectedMediaApps', apps: selected });
            showGlobalLoading(t('downloadingCovers'), t('readingApps'));
            setTimeout(closeModal, 3000);
        } else {
            closeModal();
        }
    });

    const availableApps = allInstalledApps.filter(a => (a.AddedTo || a.addedTo) !== 'game');
    _populateExeList(availableApps);
    _modalReady = true;

    if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
}

function _populateExeList(apps) {
    const appList = document.getElementById('appListMedia');
    if (!appList) return;

    appList.innerHTML = apps.map(app => {
        const icon = app.IconBase64 || app.iconBase64;
        const name = app.Name || app.name;
        const path = app.Path || app.path;
        const launch = app.LaunchUrl || app.launchUrl || '';
        const source = app.Source || app.source;
        const isAdded = app.IsAdded === true || app.isAdded === true;

        return `
        <div class="app-item ${isAdded ? 'already-added' : ''}" ${isAdded ? '' : 'tabindex="0"'}
             data-path="${path.replace(/\\/g, '\\\\')}"
             data-launch="${launch}"
             data-name="${name.replace(/"/g, '&quot;')}">
            ${icon ? `<img class="app-icon" src="data:image/png;base64,${icon}" />` : ''}
            <div class="app-item-info">
                <span class="app-name">${name}</span>
            </div>
            ${getPlatformBadge(source)}
        </div>`;
    }).join('');

    appList.querySelectorAll('.app-item:not(.already-added)').forEach(item =>
        item.addEventListener('click', function () {
            this.classList.toggle('selected');
            const count = appList.querySelectorAll('.app-item.selected').length;
            const counter = document.getElementById('selectionCounterMedia');
            const text = document.getElementById('selectionCounterMediaText');
            if (text) text.innerText = count === 1 ? t('selectedOne') : t('selectedMany', count);
            counter?.classList.toggle('visible', count > 0);
        })
    );
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !window._vkbIsOpen) {
        // Se o modal de edição ou setup estiver aberto, o Enter abre o VKB em vez de submeter
        if (isEditModalOpen || isSetupOpen || isModalOpen) {
            e.preventDefault();
            window._vkbOpen?.(e.target);
        }
    }
});
