// =============================================================================
// navigation.js — Input & Navegação
// =============================================================================
let isSetupOpen = false;
let isModalOpen = false;
let isCtxMenuOpen = false;
let isEditModalOpen = false;

let pendingInteractionCard = null;
let isGamepadConnected = false;

function gamepadAddFolder() {
    const viewFolders = document.getElementById('view-folders');
    if (viewFolders && viewFolders.classList.contains('active')) {
        document.getElementById('btnScanFolder')?.click();
    }
}

const NAV = {
    IDLE_MS: 180, SCROLL_DURATION: 300, WHEEL_MULTIPLIER: 1.2,
    GAMEPAD: {
        AXIS_THRESHOLD: 0.6, INITIAL_DELAY: 400, REPEAT_DELAY: 80,
        BTN_CONFIRM: 0, BTN_CANCEL: 1, BTN_SQUARE: 2, BTN_TRIANGLE: 3,
        BTN_L1: 4, BTN_R1: 5, BTN_L2: 6, BTN_R2: 7, BTN_L3: 10, BTN_R3: 11,
        BTN_START: 9, BTN_UP: 12, BTN_DOWN: 13, BTN_LEFT: 14, BTN_RIGHT: 15,
    },
    KEYS: { UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight', CONFIRM: 'Enter', CANCEL: 'Escape' },
};
const VKB_BOTTOM_KEYS = ['space', 'cancel', 'ok'];

const GAMEPAD_ICONS = {
    ps: {
        confirm: `<span class="gp-btn gp-cross">✕</span>`,
        cancel: `<span class="gp-btn gp-circle">◯</span>`,
        triangle: `<span class="gp-btn gp-triangle">△</span>`,
        start: `<span class="gp-btn gp-options">≡</span>`,
        square: `<span class="gp-btn gp-square">□</span>`,
    },
    xbox: {
        confirm: `<span class="gp-btn gp-a">A</span>`,
        cancel: `<span class="gp-btn gp-b">B</span>`,
        triangle: `<span class="gp-btn gp-y">Y</span>`,
        start: `<span class="gp-btn gp-menu">☰</span>`,
        square: `<span class="gp-btn gp-x">X</span>`,
    },
};
GAMEPAD_ICONS.generic = GAMEPAD_ICONS.ps;

function detectControllerType(gamepad) {
    if (!gamepad) return 'generic';
    const id = gamepad.id.toLowerCase();
    if (id.includes('playstation') || id.includes('dualshock') || id.includes('dualsense') || id.includes('054c')) return 'ps';
    if (id.includes('xbox') || id.includes('xinput') || id.includes('045e')) return 'xbox';
    return 'generic';
}

function updateGamepadUI(connected, type = 'generic') {
    const icons = GAMEPAD_ICONS[type] ?? GAMEPAD_ICONS.generic;
    document.querySelectorAll('[data-gamepad-hint]').forEach(el => {
        el.querySelector('.gp-hint')?.remove();
        if (connected) {
            const action = el.dataset.gamepadHint;
            if (icons[action]) {
                const hint = document.createElement('span');
                hint.className = 'gp-hint'; hint.innerHTML = icons[action]; hint.setAttribute('aria-hidden', 'true');
                el.prepend(hint);
            }
        }
    });
    document.querySelectorAll('#btnAdd .plus, #btnAddMedia .plus, #btnAddStore .plus').forEach(plusEl => {
        if (connected) { plusEl.innerHTML = icons.start; plusEl.classList.add('is-gamepad'); }
        else { plusEl.innerHTML = '+'; plusEl.classList.remove('is-gamepad'); }
    });
}

function canCloseProfileSelection() {
    if (window.requireProfileSelection || window._isMandatoryLogin) return false;

    const profileBtn = document.getElementById('btnTopProfile');
    // Só bloqueia se o botão existir na tela E não tiver nenhum dado de usuário atrelado a ele/sistema
    if (profileBtn && (!profileBtn.dataset.userId && !profileBtn.dataset.username) && !window.currentUserId) {
        return false;
    }

    return true; // Libera o B / Esc para o resto do sistema!
}

let _navIdleTimeout = null;
function signalNavigation() {
    if (_navIdleTimeout) clearTimeout(_navIdleTimeout);
    _navIdleTimeout = setTimeout(() => {
        if (pendingInteractionCard) {
            const card = pendingInteractionCard;
            pendingInteractionCard = null;
            if (document.activeElement === card || card.matches(':hover')) card._startInteraction?.();
        }
    }, NAV.IDLE_MS);
}

function triggerContextMenu() {
    if (isModalOpen || isCtxMenuOpen || isEditModalOpen || window._vkbIsOpen || window.isGlobalLoading) return;
    if (window.isNavMenuOpen) { window._navMenuTriggerCtxMenu?.(); return; }

    const focused = document.activeElement;
    if (!focused?.classList.contains('card') || focused.classList.contains('add-card')) return;
    const r = focused.getBoundingClientRect();
    window._ctxMenuOpen?.(focused, r.right + 2, r.top);
}
function closeCtxMenu() { if (!isCtxMenuOpen) return; window._ctxMenuClose?.(); }
function getCtxMenuItems() {
    if (window.isStoreSessionMenuOpen?.()) {
        return Array.from(document.querySelectorAll('#storeSessionMenu .ctx-item'))
            .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
    }
    return Array.from(document.querySelectorAll('.context-menu.visible .ctx-item'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
}

function getModalGroups() {
    const activeTabEl = document.querySelector('.view-section.active');
    const activeTab = activeTabEl ? activeTabEl.id : 'view-apps';
    const sidebar = Array.from(document.querySelectorAll('.sidebar-menu .menu-tab'));
    let filters = [], apps = [], actions = [], folderBtns = [], subtabs = [], inputs = [], storeBtns = [];

    if (activeTab === 'view-apps') {
        filters = Array.from(document.querySelectorAll('.filter-bar .filter-btn'));
        apps = Array.from(document.querySelectorAll('#appList .app-item:not(.already-added)'));
        actions = Array.from(document.querySelectorAll('#view-apps .action-buttons button'));
    } else if (activeTab === 'view-folders') {
        folderBtns = Array.from(document.querySelectorAll('#folderList .icon-btn'));
        actions = Array.from(document.querySelectorAll('#view-folders .action-buttons button'));
    } else if (activeTab === 'view-media-apps') {
        subtabs = Array.from(document.querySelectorAll('#mediaAppSubtabs .subtab'));
        if (document.getElementById('subview-web')?.classList.contains('active')) {
            inputs = Array.from(document.querySelectorAll('#subview-web input, #btnWebAppPaste')).filter(Boolean);
        } else {
            apps = Array.from(document.querySelectorAll('#appListMedia .app-item:not(.already-added)'));
        }
        actions = Array.from(document.querySelectorAll('#mediaAppActions button'));
    } else if (activeTab === 'view-stores') {
        storeBtns = Array.from(document.querySelectorAll('#storeInstallList .store-install-card'))
            .filter(btn =>
                !btn.classList.contains('installed') &&
                btn.getAttribute('aria-disabled') !== 'true' &&
                !!btn.dataset.downloadUrl);
        actions = Array.from(document.querySelectorAll('#view-stores .action-buttons button'));
    }
    return { sidebar, filters, apps, actions, folderBtns, subtabs, inputs, storeBtns, activeTab };
}

function getNavigableItems() {
    if (window._vkbIsOpen) return Array.from(document.querySelectorAll('.vkb-key[tabindex="0"]'));
    if (window.isDoorpiOverlayOpen?.()) return window.getDoorpiOverlayItems?.() || [];
    if (isSetupOpen) return typeof getSetupItems === 'function' ? getSetupItems() : [];
    if (isCtxMenuOpen) return getCtxMenuItems();
    if (isEditModalOpen) {
        return Array.from(document.querySelectorAll('.edit-modal-input, .doorpi-choice-trigger, .doorpi-choice-option, #editSharingBtn, #editExtensionsBtn, .edit-toggle-row, .edit-modal-actions button'))
            .filter(el => el.offsetWidth > 0 && !el.disabled && !el.closest('.doorpi-choice-wrap.is-disabled'));
    }
    if (window.isSessionConflictPopupOpen?.()) {
        return window.getSessionConflictPopupItems?.() || [];
    }
    if (window.isGameFocusFallbackPopupOpen?.()) {
        return window.getGameFocusFallbackPopupItems?.() || [];
    }

    const launchOverlay = document.getElementById('gameLaunchOverlay');
    if (launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('execution-lock-visible')) {
        return Array.from(document.querySelectorAll('#executionLockActions .lock-action'))
            .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);
    }
    if (launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('state-loading')) {
        const btn = document.getElementById('overlayCancelLaunchBtn');
        return btn && btn.style.display !== 'none' ? [btn] : [];
    }
    if (!isModalOpen) {
        const tabs = Array.from(document.querySelectorAll('.home-tab'));
        const homeTab = window.getCurrentHomeTab?.() || 'games';
        const activeGridId = homeTab === 'media' ? 'mediaGrid' : (homeTab === 'stores' ? 'storesGrid' : 'gameGrid');
        if (window.isStoreSessionMenuOpen?.()) {
            return getCtxMenuItems();
        }

        const activeGrid = document.getElementById(activeGridId);
        const cards = Array.from(activeGrid?.querySelectorAll("[tabindex='0']") ?? []);
        const profileBtn = document.getElementById('btnTopProfile');
        const items = [...tabs, ...cards];
        if (profileBtn) items.unshift(profileBtn);
        return items;
    }

    const g = getModalGroups();
    const isVisible = (el) => el.offsetWidth > 0 && el.offsetHeight > 0;
    const isNavigable = (el) => !(el.classList.contains('menu-tab') && el.classList.contains('active'));

    g.sidebar.forEach(el => el.setAttribute('tabindex', '0'));

    if (g.activeTab === 'view-apps') return [...g.sidebar, ...g.filters, ...g.apps, ...g.actions].filter(el => isVisible(el) && isNavigable(el));
    if (g.activeTab === 'view-folders') return [...g.sidebar, ...g.folderBtns, ...g.actions].filter(el => isVisible(el) && isNavigable(el));
    if (g.activeTab === 'view-media-apps') return [...g.sidebar, ...g.subtabs, ...g.inputs, ...g.apps, ...g.actions].filter(el => isVisible(el) && isNavigable(el));
    if (g.activeTab === 'view-stores') return [...g.sidebar, ...g.storeBtns, ...g.actions].filter(el => isVisible(el) && isNavigable(el));

    return [];
}

// ALGORITMO DE NAVEGAÇÃO ESPACIAL ORIGINAL RESTAURADO
function findSpatialCandidate(items, current, direction) {
    const cr = current.getBoundingClientRect();
    const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    let best = null, bestDist = Infinity;
    items.forEach(item => {
        if (item === current) return;
        const r = item.getBoundingClientRect();
        const icx = r.left + r.width / 2, icy = r.top + r.height / 2;
        let valid = false, dist = 0, overlap = 0;
        switch (direction) {
            case 'RIGHT': valid = icx > cx; dist = icx - cx; overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top); break;
            case 'LEFT': valid = icx < cx; dist = cx - icx; overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top); break;
            case 'DOWN': valid = icy > cy; dist = icy - cy; overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left); break;
            case 'UP': valid = icy < cy; dist = cy - icy; overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left); break;
        }
        if (valid && overlap > -10 && dist < bestDist) { bestDist = dist; best = item; }
    });
    return best;
}

function findWrapCandidate(items, current, direction) {
    const cr = current.getBoundingClientRect();
    const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    let best = null, maxDist = -1;
    items.forEach(item => {
        if (item === current) return;
        const r = item.getBoundingClientRect();
        const icx = r.left + r.width / 2, icy = r.top + r.height / 2;
        let opp = false, dist = 0, overlap = 0;
        switch (direction) {
            case 'RIGHT': opp = icx < cx; dist = cx - icx; overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top); break;
            case 'LEFT': opp = icx > cx; dist = cx - icx; overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top); break;
            case 'DOWN': opp = icy < cy; dist = cy - icy; overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left); break;
            case 'UP': opp = icy > cy; dist = icy - cy; overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left); break;
        }
        if (opp && overlap > -10 && dist > maxDist) { maxDist = dist; best = item; }
    });
    return best;
}

function findVkbCandidate(items, current, direction) {
    const curKey = current.dataset?.key;
    const hasTextBottomRow = items.some(el => el.dataset?.key === 'space');
    if (hasTextBottomRow && VKB_BOTTOM_KEYS.includes(curKey) && (direction === 'LEFT' || direction === 'RIGHT')) {
        const order = ['space', 'cancel', 'ok'];
        const idx = order.indexOf(curKey);
        const nextIdx = direction === 'RIGHT' ? idx + 1 : idx - 1;
        if (nextIdx >= 0 && nextIdx < order.length) {
            const target = items.find(el => el.dataset?.key === order[nextIdx]);
            if (target) return target;
        }
        return null;
    }
    const cr = current.getBoundingClientRect();
    const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    let best = null, bestScore = Infinity;
    items.forEach(item => {
        if (item === current) return;
        if (hasTextBottomRow && VKB_BOTTOM_KEYS.includes(item.dataset?.key) && direction !== 'DOWN') return;
        const r = item.getBoundingClientRect();
        const icx = r.left + r.width / 2, icy = r.top + r.height / 2;
        let primary = 0, lateral = 0, valid = false;
        switch (direction) {
            case 'RIGHT': valid = icx > cx + 4; primary = icx - cx; lateral = Math.abs(icy - cy); break;
            case 'LEFT': valid = icx < cx - 4; primary = cx - icx; lateral = Math.abs(icy - cy); break;
            case 'DOWN': valid = icy > cy + 4; primary = icy - cy; lateral = Math.abs(icx - cx); break;
            case 'UP': valid = icy < cy - 4; primary = cy - icy; lateral = Math.abs(icx - cx); break;
        }
        if (!valid) return;
        const score = primary + lateral * 2.5;
        if (score < bestScore) { bestScore = score; best = item; }
    });
    return best;
}

function getGroupTransition(direction, groupName, groups, current) {
    const { sidebar, filters, apps, actions, folderBtns, subtabs, inputs, storeBtns, activeTab } = groups;
    const firstVisible = (arr) => arr.find(el => el.offsetWidth > 0 && el.offsetHeight > 0);

    const bestSidebar = () => {
        const navigable = sidebar.filter(el => !el.classList.contains('active'));
        if (_lastFocusedSidebar && navigable.includes(_lastFocusedSidebar)) return _lastFocusedSidebar;
        return navigable[0] || null;
    };

    const bestFilter = () => {
        const navigableFilters = filters.filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
        if (_lastFocusedFilter && navigableFilters.includes(_lastFocusedFilter)) return _lastFocusedFilter;
        return navigableFilters[0] || null;
    };

    if (activeTab === 'view-apps') {
        const bestApp = () => {
            const navigableApps = apps.filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            if (_lastFocusedApp && navigableApps.includes(_lastFocusedApp)) return _lastFocusedApp;
            return navigableApps[0] || null;
        };

        if (groupName === 'filter') {
            if (direction === 'UP') return current;
            if (direction === 'DOWN') return bestApp();
            if (direction === 'LEFT' || direction === 'RIGHT') {
                const target = findSpatialCandidate(filters, current, direction);
                if (target) return target;
                if (direction === 'LEFT') return bestSidebar();
                return current;
            }
        }
        if (groupName === 'app') {
            if (direction === 'DOWN' || direction === 'RIGHT') return actions[0] ?? null;
            if (direction === 'LEFT') return bestSidebar();
            if (direction === 'UP') return bestFilter();
        }
        if (groupName === 'sidebar') {
            if (direction === 'RIGHT') return bestApp() || bestFilter() || actions[0];
            if (direction === 'DOWN') return bestApp();
            if (direction === 'UP') return bestFilter();
        }
        if (groupName === 'action' && (direction === 'LEFT' || direction === 'UP')) return bestApp();

    } else if (activeTab === 'view-folders') {
        const bestFolderBtn = () => firstVisible(folderBtns);
        if (groupName === 'folderBtn') {
            if (direction === 'LEFT') return bestSidebar();
            if (direction === 'DOWN') return actions[0] ?? null;
        }
        if (groupName === 'action') {
            if (direction === 'UP') return folderBtns[folderBtns.length - 1] ?? null;
            if (direction === 'LEFT') return bestSidebar();
        }
        if (groupName === 'sidebar') {
            if (direction === 'RIGHT') return bestFolderBtn() || actions[0];
            if (direction === 'DOWN') return bestFolderBtn() || actions[0];
        }
    } else if (activeTab === 'view-media-apps') {
        const bestApp = () => {
            const navigableApps = apps.filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            if (_lastFocusedApp && navigableApps.includes(_lastFocusedApp)) return _lastFocusedApp;
            return navigableApps[0] || null;
        };

        const bestInput = () => firstVisible(inputs);
        const bestSubtab = () => {
            const active = subtabs.find(s => s.classList.contains('active'));
            return active || subtabs[0];
        };

        if (groupName === 'subtab') {
            if (direction === 'DOWN') return bestInput() || bestApp();
            if (direction === 'LEFT') return bestSidebar();
        }
        if (groupName === 'input') {
            const idx = inputs.indexOf(current);
            const isPasteBtn = current.id === 'btnWebAppPaste';

            if (direction === 'LEFT') {
                if (isPasteBtn && idx > 0) return inputs[idx - 1];
                return bestSidebar();
            }
            if (direction === 'RIGHT') {
                if (!isPasteBtn && inputs[idx + 1]?.id === 'btnWebAppPaste') return inputs[idx + 1];
                return null;
            }
            if (direction === 'UP') {
                if (isPasteBtn) return inputs[0];
                return idx > 0 ? inputs[idx - 1] : bestSubtab();
            }
            if (direction === 'DOWN') {
                if (idx === 0) return inputs[1];
                return actions[0];
            }
        }
        if (groupName === 'app') {
            if (direction === 'DOWN' || direction === 'RIGHT') return actions[0] ?? null;
            if (direction === 'LEFT') return bestSidebar();
            if (direction === 'UP') return bestSubtab();
        }
        if (groupName === 'action') {
            if (direction === 'UP') return inputs[inputs.length - 1] || bestApp() || bestSubtab();
            if (direction === 'LEFT') return bestSidebar();
        }
        if (groupName === 'sidebar') {
            if (direction === 'RIGHT' || direction === 'DOWN') return bestSubtab() || bestInput() || bestApp() || actions[0];
        }
    } else if (activeTab === 'view-stores') {
        const bestStoreBtn = () => firstVisible(storeBtns);
        if (groupName === 'storeBtn') {
            if (direction === 'LEFT') return bestSidebar();
            if (direction === 'DOWN' || direction === 'RIGHT') return actions[0] ?? null;
        }
        if (groupName === 'action') {
            if (direction === 'UP') return storeBtns[storeBtns.length - 1] ?? null;
            if (direction === 'LEFT') return bestSidebar();
        }
        if (groupName === 'sidebar') {
            if (direction === 'RIGHT' || direction === 'DOWN') return bestStoreBtn() || actions[0];
        }
    }
    return null;
}

let _lastFocusedApp = null, _lastFocusedFilter = null, _lastFocusedSidebar = null, _lastSetupFocused = null;
let _sessionConflictSuppressKeyNavUntil = 0;
let _sessionConflictLastKeyNavAt = 0;

function moveSessionConflictFocus(direction) {
    const items = window.getSessionConflictPopupItems?.() || [];
    if (!items.length) return;

    const current = document.activeElement;
    if (!items.includes(current)) {
        items[0]?.focus();
        return;
    }

    const idx = items.indexOf(current);
    let next = current;
    if ((direction === 'RIGHT' || direction === 'DOWN') && idx < items.length - 1) {
        next = items[idx + 1];
    } else if ((direction === 'LEFT' || direction === 'UP') && idx > 0) {
        next = items[idx - 1];
    }

    if (next && next !== current) next.focus();
}

document.addEventListener('focusin', () => {
    if (!window.isSetupOpen) return;

    const items = typeof getSetupItems === 'function' ? getSetupItems() : [];
    if (items.includes(document.activeElement)) _lastSetupFocused = document.activeElement;
});

function gamepadCancel() {
    if (isModalOpen && !window.isGlobalLoading) closeModal?.();
}

function gamepadStart() {
    if (window.DoorpiIntro?.isRunning?.()) {
        window.DoorpiIntro.skip?.();
        return;
    }
    if (window.isGlobalLoading) return;
    if (isModalOpen) { closeModal?.(); return; }

    const homeTab = window.getCurrentHomeTab?.() || 'games';
    if (homeTab === 'media') document.getElementById('btnAddMedia')?.click();
    else if (homeTab === 'stores') document.getElementById('btnAddStore')?.click();
    else document.getElementById('btnAdd')?.click();
}

function gamepadTriangle() { if (isModalOpen && !window.isGlobalLoading) document.getElementById('btnSearch')?.click(); }

function moveFocus(direction) {
    if (window.isGlobalLoading) return;

    if (window._vkbIsOpen) {
        const items = Array.from(document.querySelectorAll('.vkb-key'));
        const current = document.activeElement;

        if (!current || !current.classList.contains('vkb-key')) {
            items[0]?.focus();
            return;
        }

        let target = findVkbCandidate(items, current, direction);
        if (target) target.focus();
        return;
    }

    if (isCtxMenuOpen) {
        if (direction === 'LEFT' || direction === 'RIGHT') { closeCtxMenu(); return; }
        const items = getCtxMenuItems();
        const idx = items.indexOf(document.activeElement);
        if (direction === 'DOWN') items[(idx + 1) % items.length]?.focus();
        if (direction === 'UP') items[(idx - 1 + items.length) % items.length]?.focus();
        return;
    }

    if (isEditModalOpen) {
        const items = getNavigableItems();
        if (!items.length) return;
        const current = document.activeElement;

        if (!items.includes(current)) { items[0]?.focus(); return; }
        let target = findSpatialCandidate(items, current, direction) || findWrapCandidate(items, current, direction);

        if (!target) {
            const idx = items.indexOf(current);
            if (direction === 'DOWN' && idx < items.length - 1) target = items[idx + 1];
            if (direction === 'UP' && idx > 0) target = items[idx - 1];
        }

        if (target && target !== current) target.focus();
        return;
    }

    // 🟢 SETUP: ALGORITMO ORIGINAL RESTAURADO NA ÍNTEGRA
    if (isSetupOpen) {
        const items = getSetupItems();
        if (!items.length) return;
        const current = document.activeElement;

        if (!items.includes(current)) {
            items[0]?.focus();
            return;
        }

        let target = findSpatialCandidate(items, current, direction);

        if (target && target !== current) {
            target.focus();

            // Scroll suave automático para não sumir da tela
            const container = document.getElementById('setupContainer');
            if (container) {
                const cr = container.getBoundingClientRect();
                const tr = target.getBoundingClientRect();
                if (tr.bottom > cr.bottom) container.scrollTop += (tr.bottom - cr.bottom) + 40;
                else if (tr.top < cr.top) container.scrollTop -= (cr.top - tr.top) + 40;
            }
        }
        return;
    }

    if (window.isSessionConflictPopupOpen?.()) {
        moveSessionConflictFocus(direction);
        return;
    }

    const items = getNavigableItems();
    if (!items.length) return;
    const current = document.activeElement;

    const executionOverlay = document.getElementById('gameLaunchOverlay');
    if (executionOverlay?.classList.contains('execution-lock-visible')) {
        if (!items.includes(current)) {
            items[0]?.focus();
            return;
        }

        if (direction === 'LEFT' || direction === 'RIGHT') {
            const idx = items.indexOf(current);
            const next = direction === 'RIGHT'
                ? items[(idx + 1) % items.length]
                : items[(idx - 1 + items.length) % items.length];
            next?.focus();
        }
        return;
    }

    if (!items.includes(current)) {
        if (current.classList.contains('filter-btn')) {
            const nf = Array.from(document.querySelectorAll('.filter-bar .filter-btn')).find(f => !f.classList.contains('active') && f.offsetWidth > 0);
            if (nf) { nf.focus(); return; }
        }
        items[0].focus();
        return;
    }

    if (!isModalOpen) {
        if (current.closest('#mediaGrid, #gameGrid, #storesGrid')) {
            if (direction === 'UP') {
                const activeTab = document.querySelector('.home-tab.active');
                if (activeTab) { activeTab.focus(); return; }
            }
            if (direction === 'DOWN') {
                if (typeof window.openNavMenu === 'function' && !window.isNavMenuOpen) { window.openNavMenu(0); return; }
            }
        }

        if (current.classList.contains('home-tab') && direction === 'UP') {
            const profileBtn = document.getElementById('btnTopProfile');
            if (profileBtn) { profileBtn.focus(); return; }
        }

        let target = findSpatialCandidate(items, current, direction);
        if (!target) {
            const tabs = items.filter(el => el.classList.contains('home-tab'));
            const cards = items.filter(el => !el.classList.contains('home-tab') && !el.classList.contains('top-profile-btn'));
            const group = current.classList.contains('home-tab') ? tabs : cards;

            if (direction === 'RIGHT' && group.length) target = group[0];
            else if (direction === 'LEFT' && group.length) target = group[group.length - 1];
        }
        if (!target) target = current;

        if (target && target !== current) {
            current._stopInteraction?.();
            if (typeof cancelHeroTransition === 'function') cancelHeroTransition();
            pendingInteractionCard = null;
            target.focus();
            smoothHorizontalScroll(target, () => {
                if (document.activeElement === target || target.matches(':hover')) target._startInteraction?.();
            });
        }
        return;
    }

    const groups = getModalGroups();
    let groupName, groupItems;
    if (current.classList.contains('menu-tab')) { groupName = 'sidebar'; groupItems = groups.sidebar; }
    else if (current.classList.contains('filter-btn')) { groupName = 'filter'; groupItems = groups.filters; }
    else if (current.classList.contains('app-item')) { groupName = 'app'; groupItems = groups.apps; }
    else if (current.classList.contains('store-install-card')) { groupName = 'storeBtn'; groupItems = groups.storeBtns; }
    else if (current.classList.contains('icon-btn')) { groupName = 'folderBtn'; groupItems = groups.folderBtns; }
    else if (current.classList.contains('subtab')) { groupName = 'subtab'; groupItems = groups.subtabs; }
    else if (current.tagName === 'INPUT' || current.id === 'btnWebAppPaste') { groupName = 'input'; groupItems = groups.inputs; }
    else { groupName = 'action'; groupItems = groups.actions; }

    if (groupName === 'app') _lastFocusedApp = current;
    if (groupName === 'filter') _lastFocusedFilter = current;
    if (groupName === 'sidebar') _lastFocusedSidebar = current;

    let target = findSpatialCandidate(groupItems.filter(i => items.includes(i)), current, direction);

    if (!target && groupName === 'app' && (direction === 'DOWN' || direction === 'UP')) {
        const navigableApps = groups.apps.filter(i => items.includes(i));
        const currentIdx = navigableApps.indexOf(current);
        const currentTop = current.getBoundingClientRect().top;
        if (direction === 'DOWN') {
            target = navigableApps.slice(currentIdx + 1).find(a => a.getBoundingClientRect().top > currentTop + 10) || null;
        } else {
            const candidates = navigableApps.slice(0, currentIdx).filter(a => a.getBoundingClientRect().top < currentTop - 10);
            target = candidates[candidates.length - 1] || null;
        }
    }

    if (!target) target = getGroupTransition(direction, groupName, groups, current);

    if (!target && groupName === 'app') {
        const appList = document.getElementById(groups.activeTab === 'view-media-apps' ? 'appListMedia' : 'appList');
        if (appList) {
            if (direction === 'UP' && appList.scrollTop > 0) { appList.scrollTop = Math.max(0, appList.scrollTop - 150); return; }
            if (direction === 'DOWN') {
                const maxScroll = appList.scrollHeight - appList.clientHeight;
                if (appList.scrollTop < maxScroll - 2) { appList.scrollTop = Math.min(maxScroll, appList.scrollTop + 150); return; }
            }
        }
    }

    if (!target) {
        const skipWrap = groupName === 'app' && (direction === 'UP' || direction === 'DOWN');
        if (!skipWrap) target = findWrapCandidate(groupItems.filter(i => items.includes(i)), current, direction);
    }

    if (!target) target = current;

    if (target && target !== current) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        if (window._gpNavigating) window.DoorpiUiSound?.play('move');
        signalNavigation();
    }
}

window.focusFeaturedCard = function () {
    if (isModalOpen || isEditModalOpen || window._vkbIsOpen || isSetupOpen) return;
    const ht = window.getCurrentHomeTab?.() || 'games';
    const activeGridId = ht === 'media' ? 'mediaGrid' : (ht === 'stores' ? 'storesGrid' : 'gameGrid');
    const grid = document.getElementById(activeGridId);
    if (!grid) return;
    const featured = grid.querySelector('.card.featured');
    if (featured) { featured.focus(); grid.scrollLeft = 0; featured._startInteraction?.(); }
    else { const first = grid.querySelector('.card'); first?.focus(); }
};

function focusItemByIndex(index) {
    const items = getNavigableItems();
    if (!items.length) return;
    const el = items[(index + items.length) % items.length];
    el.focus();
    if (isModalOpen) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    else smoothHorizontalScroll(el);
}

function smoothHorizontalScroll(element, onDone) {
    if (isModalOpen) { onDone?.(); return; }
    const grid = element.closest('#mediaGrid, #gameGrid, #storesGrid') ?? document.getElementById('gameGrid');
    if (!grid || !grid.getBoundingClientRect) { onDone?.(); return; }

    if (grid._scrollRafId) { cancelAnimationFrame(grid._scrollRafId); grid._scrollRafId = null; }

    const gr = grid.getBoundingClientRect(), er = element.getBoundingClientRect();
    const MARGIN = Math.max(30, grid.clientWidth * 0.04);
    const visL = er.left >= gr.left + MARGIN - 2;
    const visR = er.right <= gr.right - MARGIN + 2;
    if (visL && visR) { onDone?.(); return; }

    let target;
    if (!visR) target = grid.scrollLeft + (er.left - gr.left) - MARGIN;
    else target = grid.scrollLeft + (er.right - gr.right) + MARGIN;
    target = Math.max(0, Math.min(grid.scrollWidth - grid.clientWidth, target));

    const delta = target - grid.scrollLeft;
    if (Math.abs(delta) < 1) { onDone?.(); return; }

    const duration = Math.min(220, Math.max(80, Math.abs(delta) * 0.18));
    const start = grid.scrollLeft;
    const t0 = performance.now();
    const ease = (t) => 1 - (1 - t) * (1 - t);

    (function step(now) {
        const p = Math.min((now - t0) / duration, 1);
        grid.scrollLeft = start + delta * ease(p);
        if (p < 1) { grid._scrollRafId = requestAnimationFrame(step); }
        else { grid._scrollRafId = null; onDone?.(); }
    })(performance.now());
}

['gameGrid', 'mediaGrid'].forEach(id => {
    document.getElementById(id)?.addEventListener('wheel', e => {
        if (isModalOpen) return;
        e.preventDefault();
        document.getElementById(id).scrollLeft += e.deltaY * NAV.WHEEL_MULTIPLIER;
    }, { passive: false });
});

document.addEventListener('keydown', e => {
    // ── NOVO: Cancelar launch via teclado (Esc ou Backspace) ──
    const launchOverlay = document.getElementById('gameLaunchOverlay');
    const isExecutionLock = launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('execution-lock-visible');
        if (isExecutionLock) {
            const dirMapLock = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' };
            if (dirMapLock[e.key]) {
                e.preventDefault();
                e.stopImmediatePropagation();
                moveFocus(dirMapLock[e.key]);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                document.activeElement?.click();
                return;
            }
            if (e.key === 'Escape' || e.key === 'Backspace') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (window.requestDoorpiBackAction?.()) return;
                return;
            }
        }
        if (window.isSessionConflictPopupOpen?.()) {
            const dirMapConflict = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' };
            if (dirMapConflict[e.key]) {
                e.preventDefault();
                e.stopImmediatePropagation();
            const now = performance.now();
            if (now < _sessionConflictSuppressKeyNavUntil) return;
            _sessionConflictLastKeyNavAt = now;
            moveSessionConflictFocus(dirMapConflict[e.key]);
            return;
        }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                document.activeElement?.click();
                return;
            }
            if (e.key === 'Escape' || e.key === 'Backspace') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (window.requestDoorpiBackAction?.()) return;
                return;
            }
        }
        if (window.isGameFocusFallbackPopupOpen?.()) {
            const dirMapFallback = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' };
            if (dirMapFallback[e.key]) {
                e.preventDefault();
                e.stopImmediatePropagation();
            moveFocus(dirMapFallback[e.key]);
            return;
        }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                document.activeElement?.click();
                return;
            }
            if (e.key === 'Escape' || e.key === 'Backspace') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (window.requestDoorpiBackAction?.()) return;
                return;
            }
        }
    const isWaitingLaunch = launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('state-loading');
    if (isWaitingLaunch) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.requestDoorpiBackAction?.();
            return;
        }
    }

  
    if (window.isDesktopWarningOpen) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') window._dwMoveFocus?.(-1);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') window._dwMoveFocus?.(1);
        if (e.key === 'Enter') window._dwAction?.('CONFIRM');
        if (e.key === 'Escape' || e.key === 'Backspace') window.requestDoorpiBackAction?.();
        return;
    }
    if (window.DoorpiIntro?.isRunning?.()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.DoorpiIntro.skip?.();
        return;
    }

    if (isDoorpiGameInputSuppressed()) {
        const blocked = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Enter', ' ', 'Spacebar', 'Escape'];
        if (blocked.includes(e.key)) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }

        return;
    }

    if (window.isGlobalLoading) { e.preventDefault(); return; }
    if (window.isDoorpiOverlayOpen?.() && !window._vkbIsOpen) {
        const dirMapOverlay = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' };
        if (dirMapOverlay[e.key]) { e.preventDefault(); moveFocus(dirMapOverlay[e.key]); return; }

        if (e.key === 'Enter') {
            e.preventDefault();
            const el = document.activeElement;

            if (el && el.tagName === 'INPUT') {
                window._vkbOpen(el);
            }
            // ---------------------

            else if (el && el.tagName === 'SELECT') {
                if (typeof el.showPicker === 'function') el.showPicker();
                else {
                    el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
                    el.dispatchEvent(new Event('change'));
                }
            }
            else {
                el?.click();
            }
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            if (!window.requestDoorpiBackAction?.()) return;
            return;
        }
    }

    // O NavMenu bloqueia o teclado, a menos que as popups que abriram dele estejam no topo
    if (window.isNavMenuOpen && !isCtxMenuOpen && !isEditModalOpen) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (window.requestDoorpiBackAction?.()) return;
            return;
        }
        return;
    }

    if (window._vkbIsOpen) {
        const dirMap = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' };
        if (dirMap[e.key]) { e.preventDefault(); moveFocus(dirMap[e.key]); return; }
        if (e.key === 'Escape') { e.preventDefault(); window.requestDoorpiBackAction?.(); return; }
        if (e.key === 'Enter') { e.preventDefault(); document.activeElement?.click(); return; }
        if (e.key === 'Backspace') { e.preventDefault(); window._vkbPhysicalKey?.('Backspace'); return; }
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault(); window._vkbPhysicalKey?.(e.key); return;
        }
        return;
    }

    // TODAS as setas do teclado / C# batem aqui
    const dirMap = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' };
    if (dirMap[e.key]) {
        e.preventDefault();
        moveFocus(dirMap[e.key]);
        return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        const el = document.activeElement;
        if (el && el.tagName === 'SELECT') {
            if (typeof el.showPicker === 'function') el.showPicker();
            else {
                el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
                el.dispatchEvent(new Event('change'));
            }
        } else {
            el?.click();
        }
        return;
    }

    if (e.key === ' ' || e.key === 'Spacebar') {
        if (!isModalOpen && !isCtxMenuOpen && !isEditModalOpen) {
            e.preventDefault(); triggerContextMenu(); return;
        }
    }

    if (e.key === 'Escape') {
        e.preventDefault();

        // 1. Se for o Overlay de Perfil, aplica a trava de segurança
        if (window.isDoorpiOverlayOpen?.()) {
            if (!canCloseProfileSelection()) return;
            window.closeDoorpiTopOverlay?.();
            return;
        }

        // 2. Se for Setup, Contexto, Edição ou Modal, fecha normalmente
        if (isSetupOpen) {
            const cancelBtn = document.getElementById('btnSetupCancel');
            if (cancelBtn && cancelBtn.style.display !== 'none') cancelBtn.click();
            return;
        }
        if (isCtxMenuOpen) { closeCtxMenu(); return; }
        if (isEditModalOpen) { window._editModalClose?.(); return; }
        if (isModalOpen) { closeModal?.(); return; } // Aqui volta a fechar Add Jogo/App
    }
});

let _gamepadIndex = null, _controllerType = 'generic', _btnCooldown = {}, _lastMoveTime = 0, _moveState = 0, _currentDirection = null, _executionLockHeldDir = null, _sessionConflictHeldDir = null, _gameFocusFallbackHeldDir = null;
let _cursorHoldState = { l1: 0, r1: 0 }, _cursorLastTime = { l1: 0, r1: 0 };

window._gpNavigating = false;
let _gpNavigatingTimeout = null;
window._doorpiGameInputSuppressedUntil = 0;

window.suspendDoorpiGameInput = function (durationMs = 15000) {
    window._doorpiGameInputSuppressedUntil = performance.now() + durationMs;
    window.isGameLaunchActive = true;
};

function isDoorpiGameInputSuppressed() {
    if (!window.isGameLaunchActive && !window._doorpiGameInputSuppressedUntil) return false;
    if (performance.now() < (window._doorpiGameInputSuppressedUntil || 0)) return true;
    window.isGameLaunchActive = false;
    window._doorpiGameInputSuppressedUntil = 0;
    return false;
}

window.requestDoorpiBackAction = function () {
    const launchOverlay = document.getElementById('gameLaunchOverlay');
    const isExecutionLock = launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('execution-lock-visible');
    const isWaitingLaunch = launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('state-loading');

    if (window.isDesktopWarningOpen) {
        window._dwAction?.('CANCEL');
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (isExecutionLock) {
        const restoreBtn = document.getElementById('executionLockRestore');
        if (restoreBtn && restoreBtn.style.display !== 'none') {
            restoreBtn.click();
            window.DoorpiUiSound?.play('back');
            return true;
        }
        return false;
    }

    if (isWaitingLaunch) {
        const btn = document.getElementById('overlayCancelLaunchBtn');
        if (btn && btn.style.display !== 'none') {
            btn.click();
            window.DoorpiUiSound?.play('back');
            return true;
        }
        return false;
    }

    if (window.isSessionConflictPopupOpen?.()) {
        const cancelBtn = document.getElementById('sessionConflictCancel');
        if (cancelBtn && cancelBtn.style.display !== 'none') {
            cancelBtn.click();
            window.DoorpiUiSound?.play('back');
            return true;
        }
        window.hideSessionConflictPopup?.(true);
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (window.isGameFocusFallbackPopupOpen?.()) {
        window.hideGameFocusFallbackPopup?.(true);
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (window.isDoorpiOverlayOpen?.()) {
        if (!canCloseProfileSelection()) return false;
        window.closeDoorpiTopOverlay?.();
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) {
        closeCtxMenu();
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) {
        window._editModalClose?.();
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (typeof isSetupOpen !== 'undefined' && isSetupOpen) {
        const cancelBtn = document.getElementById('btnSetupCancel');
        if (cancelBtn && cancelBtn.style.display !== 'none') {
            cancelBtn.click();
            window.DoorpiUiSound?.play('back');
            return true;
        }
        return false;
    }

    if (window._vkbIsOpen) {
        window._vkbCancel?.();
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (window.isNavMenuOpen) {
        const handled = window._navMenuHandleKey?.('Backspace') === true;
        if (handled) window.DoorpiUiSound?.play('back');
        return handled;
    }

    if (typeof isModalOpen !== 'undefined' && isModalOpen) {
        closeModal?.();
        window.DoorpiUiSound?.play('back');
        return true;
    }

    return false;
};

function buttonJustPressed(btn, index) {
    if (btn?.pressed) {
        if (!_btnCooldown[index]) {
            _btnCooldown[index] = true;
            if (index === NAV.GAMEPAD.BTN_CONFIRM) window.DoorpiUiSound?.play('confirm');
            return true;
        }
        return false;
    }
    _btnCooldown[index] = false; return false;
}

window.addEventListener('gamepadconnected', e => {
    _gamepadIndex = e.gamepad.index; _controllerType = detectControllerType(e.gamepad);
    isGamepadConnected = true; updateGamepadUI(true, _controllerType);
});
window.addEventListener('gamepaddisconnected', e => {
    if (e.gamepad.index !== _gamepadIndex) return;
    _gamepadIndex = null; isGamepadConnected = false; updateGamepadUI(false, _controllerType);
    const pads = navigator.getGamepads();
    for (const pad of pads) if (pad) { _gamepadIndex = pad.index; _controllerType = detectControllerType(pad); isGamepadConnected = true; updateGamepadUI(true, _controllerType); break; }
});


window.isDoorpiFocused = document.hasFocus();


window.addEventListener('focus', () => { window.isDoorpiFocused = true; });
window.addEventListener('blur', () => { window.isDoorpiFocused = false; });
(function gamepadLoop() {
    try {
        // ── NOVO: Se o Doorpi não for a janela ativa no Windows, ignora o controle 100% ──
        if (!window.isDoorpiFocused) return;

        const gamepad = _gamepadIndex !== null ? navigator.getGamepads()[_gamepadIndex] : null;
        if (!gamepad) return;

        const launchOverlay = document.getElementById('gameLaunchOverlay');
        const isExecutionLock = launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('execution-lock-visible');
        const isWaitingLaunch = launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('state-loading');
        const isSessionConflict = window.isSessionConflictPopupOpen?.() === true;
        const isGameFocusFallback = window.isGameFocusFallbackPopupOpen?.() === true;

        if (window.isDoorpiSessionTransitionActive?.()) return;
        if (window.isGlobalLoading || (!isWaitingLaunch && !isExecutionLock && !isSessionConflict && !isGameFocusFallback && (window.isMediaAppActive || isDoorpiGameInputSuppressed())) || !document.hasFocus()) return;

        const { GAMEPAD } = NAV, buttons = gamepad.buttons;
        const ax = gamepad.axes[0], ay = gamepad.axes[1], thr = GAMEPAD.AXIS_THRESHOLD, now = performance.now();

        if (isWaitingLaunch) {
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) {
                const btn = document.getElementById('overlayCancelLaunchBtn');
                if (btn && document.activeElement === btn) {
                    btn.click();
                }
            }
            return;
        }

        if (isExecutionLock) {
            let lockDir = null;
            if (buttons[GAMEPAD.BTN_RIGHT]?.pressed) lockDir = 'RIGHT';
            else if (buttons[GAMEPAD.BTN_LEFT]?.pressed) lockDir = 'LEFT';
            else if (buttons[GAMEPAD.BTN_DOWN]?.pressed) lockDir = 'DOWN';
            else if (buttons[GAMEPAD.BTN_UP]?.pressed) lockDir = 'UP';
            else {
                const lockAxisThreshold = Math.max(thr, 0.72);
                const absX = Math.abs(ax);
                const absY = Math.abs(ay);
                if (absX >= lockAxisThreshold || absY >= lockAxisThreshold) {
                    if (absX >= absY) lockDir = ax > 0 ? 'RIGHT' : 'LEFT';
                    else lockDir = ay > 0 ? 'DOWN' : 'UP';
                }
            }

            if (lockDir) {
                if (_executionLockHeldDir === null) {
                    moveFocus(lockDir);
                    _executionLockHeldDir = lockDir;
                }
            } else {
                _executionLockHeldDir = null;
            }

            _currentDirection = null;
            _moveState = 0;

            if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) document.activeElement?.click();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE)) document.getElementById('executionLockClose')?.click();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
                document.getElementById('executionLockRestore')?.focus();
            }
            return;
        }

        _executionLockHeldDir = null;

        if (isSessionConflict) {
            let conflictDir = null;
            if (buttons[GAMEPAD.BTN_RIGHT]?.pressed) conflictDir = 'RIGHT';
            else if (buttons[GAMEPAD.BTN_LEFT]?.pressed) conflictDir = 'LEFT';
            else if (buttons[GAMEPAD.BTN_DOWN]?.pressed) conflictDir = 'DOWN';
            else if (buttons[GAMEPAD.BTN_UP]?.pressed) conflictDir = 'UP';
            else {
                const conflictAxisThreshold = Math.max(thr, 0.72);
                const absX = Math.abs(ax);
                const absY = Math.abs(ay);
                if (absX >= conflictAxisThreshold || absY >= conflictAxisThreshold) {
                    if (absX >= absY) conflictDir = ax > 0 ? 'RIGHT' : 'LEFT';
                    else conflictDir = ay > 0 ? 'DOWN' : 'UP';
                }
            }

            if (conflictDir) {
                if (_sessionConflictHeldDir === null) {
                    const nowNav = performance.now();
                    if (nowNav - _sessionConflictLastKeyNavAt > 90) {
                        _sessionConflictSuppressKeyNavUntil = nowNav + 90;
                        moveSessionConflictFocus(conflictDir);
                    }
                    _sessionConflictHeldDir = conflictDir;
                }
            } else {
                _sessionConflictHeldDir = null;
            }

            _currentDirection = null;
            _moveState = 0;

            if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) {
                const active = document.activeElement;
                if (active && active.closest?.('#sessionConflictActions')) active.click();
                else document.getElementById('sessionConflictClose')?.focus();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
            }
            return;
        }

        _sessionConflictHeldDir = null;

        if (isGameFocusFallback) {
            let fallbackDir = null;
            if (buttons[GAMEPAD.BTN_RIGHT]?.pressed) fallbackDir = 'RIGHT';
            else if (buttons[GAMEPAD.BTN_LEFT]?.pressed) fallbackDir = 'LEFT';
            else if (buttons[GAMEPAD.BTN_DOWN]?.pressed) fallbackDir = 'DOWN';
            else if (buttons[GAMEPAD.BTN_UP]?.pressed) fallbackDir = 'UP';
            else {
                const fallbackAxisThreshold = Math.max(thr, 0.72);
                const absX = Math.abs(ax);
                const absY = Math.abs(ay);
                if (absX >= fallbackAxisThreshold || absY >= fallbackAxisThreshold) {
                    if (absX >= absY) fallbackDir = ax > 0 ? 'RIGHT' : 'LEFT';
                    else fallbackDir = ay > 0 ? 'DOWN' : 'UP';
                }
            }

            if (fallbackDir) {
                if (_gameFocusFallbackHeldDir === null) {
                    moveFocus(fallbackDir);
                    _gameFocusFallbackHeldDir = fallbackDir;
                }
            } else {
                _gameFocusFallbackHeldDir = null;
            }

            _currentDirection = null;
            _moveState = 0;

            if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) {
                const active = document.activeElement;
                if (active && active.closest?.('#gameFocusFallbackActions')) active.click();
                else document.getElementById('gameFocusFallbackManual')?.focus();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
            }
            return;
        }

        _gameFocusFallbackHeldDir = null;

        if (window.DoorpiIntro?.isRunning?.()) {
            for (let i = 0; i < buttons.length; i++) {
                if (buttonJustPressed(buttons[i], i)) {
                    window.DoorpiIntro.skip?.();
                    break;
                }
            }
            return;
        }

        let dir = null;

        if (ax > thr || buttons[GAMEPAD.BTN_RIGHT]?.pressed) dir = 'RIGHT';
        else if (ax < -thr || buttons[GAMEPAD.BTN_LEFT]?.pressed) dir = 'LEFT';
        else if (ay > thr || buttons[GAMEPAD.BTN_DOWN]?.pressed) dir = 'DOWN';
        else if (ay < -thr || buttons[GAMEPAD.BTN_UP]?.pressed) dir = 'UP';

        if (dir) {
            window._gpNavigating = true;
            if (_gpNavigatingTimeout) clearTimeout(_gpNavigatingTimeout);
            _gpNavigatingTimeout = setTimeout(() => {
                window._gpNavigating = false;
            }, NAV.GAMEPAD.REPEAT_DELAY + 50);
        }
        if (window.isDesktopWarningOpen) {
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) window._dwAction?.('CONFIRM');
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
                window._dwAction?.('CANCEL');
            }
            return;
        }
        // -------------------------------

        if (window.isDoorpiOverlayOpen?.() && !window._vkbIsOpen) {
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) {
                const el = document.activeElement;
                if (el && el.tagName === 'INPUT') window._vkbOpen?.(el);
                else if (el && el.tagName === 'SELECT') {
                    if (typeof el.showPicker === 'function') el.showPicker();
                    else {
                        el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
                        el.dispatchEvent(new Event('change'));
                    }
                }
                else el?.click();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
                if (!canCloseProfileSelection()) return;
                window.closeDoorpiTopOverlay?.();
            }
            return;
        }

        if (window.isNavMenuOpen) {
            if (!window._vkbIsOpen) {
                if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) {
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) {
                        const el = document.activeElement;
                        if (el && el.tagName === 'INPUT') window._vkbOpen?.(el);
                        else if (el && el.tagName === 'SELECT') {
                            if (typeof el.showPicker === 'function') el.showPicker();
                            else {
                                el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
                                el.dispatchEvent(new Event('change'));
                            }
                        }
                        else el?.click();
                    }
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                        if (window.requestDoorpiBackAction?.()) return;
                        window._editModalClose?.();
                    }
                    return;
                }
                else if (isCtxMenuOpen) {
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) document.activeElement?.click();
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                        if (window.requestDoorpiBackAction?.()) return;
                        closeCtxMenu();
                    }
                    return;
                }
                else {
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) window._navMenuHandleKey?.('Enter');
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                        if (window.requestDoorpiBackAction?.()) return;
                        window._navMenuHandleKey?.('Escape');
                    }
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE)) window._navMenuTriggerCtxMenu?.();
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_L1], GAMEPAD.BTN_L1)) window._navMenuCycleTab?.(-1);
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_R1], GAMEPAD.BTN_R1)) window._navMenuCycleTab?.(1);
                    return;
                }
            }
        }

        if (window._vkbIsOpen) {
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) document.activeElement?.click();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
                window._vkbCancel?.();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_START], GAMEPAD.BTN_START)) window._editModalSave?.();

            [['l1', GAMEPAD.BTN_L1, -1], ['r1', GAMEPAD.BTN_R1, 1]].forEach(([id, idx, val]) => {
                const pressed = buttons[idx]?.pressed;
                if (pressed) {
                    if (_cursorHoldState[id] === 0) { window._vkbMoveCursor?.(val); _cursorLastTime[id] = now; _cursorHoldState[id] = 1; }
                    else if (_cursorHoldState[id] === 1 && now - _cursorLastTime[id] > GAMEPAD.INITIAL_DELAY) { window._vkbMoveCursor?.(val); _cursorLastTime[id] = now; _cursorHoldState[id] = 2; }
                    else if (_cursorHoldState[id] === 2 && now - _cursorLastTime[id] > GAMEPAD.REPEAT_DELAY) { window._vkbMoveCursor?.(val); _cursorLastTime[id] = now; }
                } else { _cursorHoldState[id] = 0; }
            });

            if (buttonJustPressed(buttons[GAMEPAD.BTN_L3], GAMEPAD.BTN_L3)) window._vkbToggleShift?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_TRIANGLE], GAMEPAD.BTN_TRIANGLE)) window._vkbPhysicalKey?.(' ');

            const sqPressed = buttons[GAMEPAD.BTN_SQUARE]?.pressed;
            if (sqPressed) {
                if (_cursorHoldState['sq'] === 0) { window._vkbPhysicalKey?.('Backspace'); _cursorLastTime['sq'] = now; _cursorHoldState['sq'] = 1; }
                else if (_cursorHoldState['sq'] === 1 && now - _cursorLastTime['sq'] > GAMEPAD.INITIAL_DELAY) { window._vkbPhysicalKey?.('Backspace'); _cursorLastTime['sq'] = now; _cursorHoldState['sq'] = 2; }
                else if (_cursorHoldState['sq'] === 2 && now - _cursorLastTime['sq'] > GAMEPAD.REPEAT_DELAY) { window._vkbPhysicalKey?.('Backspace'); _cursorLastTime['sq'] = now; }
            } else { _cursorHoldState['sq'] = 0; }
            return;
        }

        // Botões de ação globais
        if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) {
            const el = document.activeElement;
            if (el && el.tagName === 'INPUT')window._vkbOpen(el); 

            else if (el && el.tagName === 'SELECT') {
                if (typeof el.showPicker === 'function') el.showPicker();
                else {
                    el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
                    el.dispatchEvent(new Event('change'));
                }
            }
            else el?.click();
        }
        if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
            // 1. Se estiver na seleção de perfil, checa a trava
            if (window.requestDoorpiBackAction?.()) return;
            if (window.isDoorpiOverlayOpen?.()) {
                if (!canCloseProfileSelection()) return;
                window.closeDoorpiTopOverlay?.();
                return;
            }

            // 2. Senão, trata os outros menus normalmente
            if (isCtxMenuOpen) closeCtxMenu();
            else if (isEditModalOpen) window._editModalClose?.();
            else if (isSetupOpen) {
                const cancelBtn = document.getElementById('btnSetupCancel');
                if (cancelBtn && cancelBtn.style.display !== 'none') cancelBtn.click();
            }
            else if (isModalOpen) closeModal?.(); // Fecha Add Jogo/App
            else gamepadCancel();
        }
        if (buttonJustPressed(buttons[GAMEPAD.BTN_START], GAMEPAD.BTN_START)) {
            if (isModalOpen) (document.getElementById('btnConfirmAdd') || document.getElementById('btnConfirmAddMedia'))?.click();
            else gamepadStart();
        }
        if (buttonJustPressed(buttons[GAMEPAD.BTN_TRIANGLE], GAMEPAD.BTN_TRIANGLE)) {
            gamepadTriangle();
        }
        if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE)) {
            if (window.isStoreSessionMenuOpen?.()) {
                window.hideStoreSessionMenu?.();
                if (typeof postToHost === 'function') postToHost({ action: 'closeStore' });
            }
            else if (isEditModalOpen) window._editModalClose?.();
            else triggerContextMenu();
        }
        // DEPOIS
        if (!isSetupOpen && !isCtxMenuOpen && !isEditModalOpen) {
            if (isModalOpen) {
                // L1/R1 troca aba Web App ↔ Executável quando o modal de adicionar está aberto
                const mediaView = document.getElementById('view-media-apps');
                if (mediaView?.classList.contains('active')) {
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_R1], GAMEPAD.BTN_R1)) window._cycleMediaSubtab?.(1);
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_L1], GAMEPAD.BTN_L1)) window._cycleMediaSubtab?.(-1);
                }
            } else {
                if (buttonJustPressed(buttons[GAMEPAD.BTN_R1], GAMEPAD.BTN_R1)) window.cycleHomeTab?.(1);
                if (buttonJustPressed(buttons[GAMEPAD.BTN_L1], GAMEPAD.BTN_L1)) window.cycleHomeTab?.(-1);
            }
        }
    } catch (e) {
        console.error('Gamepad Error:', e);
    } finally {
        requestAnimationFrame(gamepadLoop);
    }
})();

window.addEventListener('load', () => {
    const pads = navigator.getGamepads();
    for (const pad of pads) if (pad) {
        _gamepadIndex = pad.index;
        _controllerType = detectControllerType(pad);
        isGamepadConnected = true;
        updateGamepadUI(true, _controllerType);
        break;
    }
    setTimeout(() => window.focusFeaturedCard(), 600);
});

const CURSOR_IDLE_MS = 3000;
let _cursorIdleTimeout = null;
function showCursor() {
    document.body.style.cursor = '';
    if (_cursorIdleTimeout) clearTimeout(_cursorIdleTimeout);
    _cursorIdleTimeout = setTimeout(() => { document.body.style.cursor = 'none'; }, CURSOR_IDLE_MS);
}
document.body.style.cursor = 'none';
document.addEventListener('mousemove', showCursor);


