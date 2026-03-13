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
        BTN_L1: 4, BTN_R1: 5, BTN_L3: 10,
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
    const plusEl = document.querySelector('#btnAdd .plus');
    if (plusEl) {
        if (connected) { plusEl.innerHTML = icons.start; plusEl.classList.add('is-gamepad'); }
        else { plusEl.innerHTML = '+'; plusEl.classList.remove('is-gamepad'); }
    }
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
    const focused = document.activeElement;
    if (!focused?.classList.contains('card') || focused.classList.contains('add-card')) return;
    const r = focused.getBoundingClientRect();

    window._ctxMenuOpen?.(focused, r.right + 2, r.top);
}

function closeCtxMenu() {
    if (!isCtxMenuOpen) return;
    window._ctxMenuClose?.();
}

function getCtxMenuItems() {
    return Array.from(document.querySelectorAll('.context-menu.visible .ctx-item'));
}

function getModalGroups() {
    const activeTabEl = document.querySelector('.view-section.active');
    const activeTab = activeTabEl ? activeTabEl.id : 'view-apps';
    const sidebar = Array.from(document.querySelectorAll('.sidebar-menu .menu-tab'));
    let filters = [], apps = [], actions = [], folderBtns = [];
    if (activeTab === 'view-apps') {
        filters = Array.from(document.querySelectorAll('.filter-bar .filter-btn'));
        apps = Array.from(document.querySelectorAll('#appList .app-item:not(.already-added)'));
        actions = Array.from(document.querySelectorAll('#view-apps .action-buttons button'));
    } else {
        folderBtns = Array.from(document.querySelectorAll('#folderList .icon-btn'));
        actions = Array.from(document.querySelectorAll('#view-folders .action-buttons button'));
    }
    return { sidebar, filters, apps, actions, folderBtns, activeTab };
}
function getNavigableItems() {
    if (window._vkbIsOpen) return Array.from(document.querySelectorAll('.vkb-key[tabindex="0"]'));
    if (isSetupOpen) return typeof getSetupItems === 'function' ? getSetupItems() : []; 
    if (isCtxMenuOpen) return getCtxMenuItems();
    if (isEditModalOpen) {
        return Array.from(document.querySelectorAll('.edit-modal-input, .edit-modal-actions button'))
            .filter(el => el.offsetWidth > 0);
    }
    if (!isModalOpen) return Array.from(document.getElementById('gameGrid').querySelectorAll("[tabindex='0']"));

    const g = getModalGroups();
    const isVisible = (el) => el.offsetWidth > 0 && el.offsetHeight > 0;

    
    const isNavigable = (el) => !(el.classList.contains('menu-tab') && el.classList.contains('active'));

    
    g.sidebar.forEach(el => el.setAttribute('tabindex', '0'));

    if (g.activeTab === 'view-apps')
        return [...g.sidebar, ...g.filters, ...g.apps, ...g.actions].filter(el => isVisible(el) && isNavigable(el));
    return [...g.sidebar, ...g.folderBtns, ...g.actions].filter(el => isVisible(el) && isNavigable(el));
}

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

function findVkbCandidate(items, current, direction) {
    const curKey = current.dataset?.key;
    if (VKB_BOTTOM_KEYS.includes(curKey) && (direction === 'LEFT' || direction === 'RIGHT')) {
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
        if (VKB_BOTTOM_KEYS.includes(item.dataset?.key) && direction !== 'DOWN') return;
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
    const { sidebar, filters, apps, actions, folderBtns, activeTab } = groups;
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
        const bestApp = () => firstVisible(apps);

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
            if (direction === 'RIGHT') return bestApp();
            if (direction === 'DOWN') return bestApp();
            if (direction === 'UP') return bestFilter();
        }

        if (groupName === 'action' && (direction === 'LEFT' || direction === 'UP')) return bestApp();

    } else { // Regras para a aba view-folders
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
    }
    return null;
}

let _lastFocusedApp = null, _lastFocusedFilter = null, _lastFocusedSidebar = null;

function gamepadCancel() { if (isModalOpen && !window.isGlobalLoading) closeModal?.(); }
function gamepadStart() {
    if (window.isGlobalLoading) return;
    if (isModalOpen) { closeModal?.(); return; }
    document.getElementById('btnAdd')?.click();
}
function gamepadTriangle() { if (isModalOpen && !window.isGlobalLoading) document.getElementById('btnSearch')?.click(); }
function moveFocus(direction) {
    if (window.isGlobalLoading) return;

    if (window._vkbIsOpen) {
        const items = Array.from(document.querySelectorAll('.vkb-key[tabindex="0"]'));
        const current = document.activeElement;
        if (!items.includes(current)) { items[0]?.focus(); return; }
        let target = findVkbCandidate(items, current, direction);
        if (!target) target = current; // Fallback
        if (target && target !== current) target.focus();
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
        if (!target) target = current; // Fallback
        if (target && target !== current) target.focus();
        return;
    }
    if (isSetupOpen) {
        const items = getSetupItems();
        if (!items.length) return;
        const current = document.activeElement;
        const scrollSetup = (el, dir) => {
            const container = document.getElementById('setupContainer');
            if (!container || !el) return;
            const cr = container.getBoundingClientRect();
            const er = el.getBoundingClientRect();
            let targetScrollTop = container.scrollTop;

            if (dir === 'UP' && er.top < cr.top + 600) {
                targetScrollTop = container.scrollTop - (cr.top + 600 - er.top);
            } else if (dir === 'DOWN' && er.bottom > cr.bottom - 40) {
                targetScrollTop = container.scrollTop + (er.bottom - cr.bottom + 40);
            } else {
                return;
            }

            targetScrollTop = Math.max(0, Math.min(container.scrollHeight - container.clientHeight, targetScrollTop));
            window._setupSmoothScroll?.(targetScrollTop);
        };

        if (!items.includes(current)) {
            items[0]?.focus();
            scrollSetup(items[0], 'UP');
            return;
        }

        let target = findSpatialCandidate(items, current, direction);

        if (!target) {
            const idx = items.indexOf(current);
            if (direction === 'DOWN' && idx < items.length - 1) target = items[idx + 1];
            else if (direction === 'UP' && idx > 0) target = items[idx - 1];
        }
        if (target && target !== current) {
            target.focus();
            scrollSetup(target, direction); 
        }
        return;
    }

    const items = getNavigableItems();
    if (!items.length) return;
    const current = document.activeElement;

    if (!items.includes(current)) {
        if (current.classList.contains('filter-btn')) {
            const nf = Array.from(document.querySelectorAll('.filter-bar .filter-btn'))
                .find(f => !f.classList.contains('active') && f.offsetWidth > 0);
            if (nf) { nf.focus(); return; }
        }
        items[0].focus();
        return;
    }

    if (!isModalOpen) {
        let target = findSpatialCandidate(items, current, direction);
        if (!target) {
            if (direction === 'RIGHT') target = items[0];
            else if (direction === 'LEFT') target = items[items.length - 1];
            else target = findWrapCandidate(items, current, direction);
        }

        if (!target) target = current; // Fallback

        if (target && target !== current) {
            current._stopInteraction?.();
            cancelHeroTransition?.();
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
    else if (current.classList.contains('icon-btn')) { groupName = 'folderBtn'; groupItems = groups.folderBtns; }
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
            target = navigableApps.slice(currentIdx + 1)
                .find(a => a.getBoundingClientRect().top > currentTop + 10) || null;
        } else {
            const candidates = navigableApps.slice(0, currentIdx)
                .filter(a => a.getBoundingClientRect().top < currentTop - 10);
            target = candidates[candidates.length - 1] || null;
        }
    }

    if (!target) target = getGroupTransition(direction, groupName, groups, current);

    // Regra de scroll da AppList
    if (!target && groupName === 'app') {
        const appList = document.getElementById('appList');
        if (appList) {
            if (direction === 'UP' && appList.scrollTop > 0) {
                appList.scrollTop = Math.max(0, appList.scrollTop - 150);
                return;
            }
            if (direction === 'DOWN') {
                const maxScroll = appList.scrollHeight - appList.clientHeight;
                if (appList.scrollTop < maxScroll - 2) {
                    appList.scrollTop = Math.min(maxScroll, appList.scrollTop + 150);
                    return;
                }
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
        signalNavigation();
    }
}


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
    const grid = document.getElementById('gameGrid');
    const gr = grid.getBoundingClientRect(), er = element.getBoundingClientRect();
    const visL = er.left >= gr.left - 2, visR = er.right <= gr.right + 2;
    if (visL && visR) { onDone?.(); return; }
    let target = !visR ? grid.scrollLeft + (er.left - gr.left) : grid.scrollLeft + (er.right - gr.right);
    target = Math.max(0, Math.min(grid.scrollWidth - grid.clientWidth, target));
    const delta = target - grid.scrollLeft;
    if (Math.abs(delta) < 1) { onDone?.(); return; }
    const start = grid.scrollLeft, t0 = performance.now();
    (function step(now) {
        const p = Math.min((now - t0) / NAV.SCROLL_DURATION, 1);
        grid.scrollLeft = start + delta * (1 - Math.pow(1 - p, 3));
        if (p < 1) requestAnimationFrame(step); else onDone?.();
    })(performance.now());
}

document.getElementById('gameGrid').addEventListener('wheel', e => {
    if (isModalOpen) return;
    e.preventDefault();
    document.getElementById('gameGrid').scrollLeft += e.deltaY * NAV.WHEEL_MULTIPLIER;
}, { passive: false });

document.addEventListener('keydown', e => {
    if (window.isGlobalLoading) { e.preventDefault(); return; }
    if (window._vkbIsOpen) {
        const dirMap = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' };
        if (dirMap[e.key]) { e.preventDefault(); moveFocus(dirMap[e.key]); return; }
        if (e.key === 'Escape') { e.preventDefault(); window._vkbCancel?.(); return; }
        if (e.key === 'Enter') { e.preventDefault(); document.activeElement?.click(); return; }
        if (e.key === 'Backspace') { e.preventDefault(); window._vkbPhysicalKey?.('Backspace'); return; }
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault(); window._vkbPhysicalKey?.(e.key); return;
        }
        return;
    }
    const dirMap = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' };
    if (dirMap[e.key]) { e.preventDefault(); moveFocus(dirMap[e.key]); return; }
    if (e.key === 'Enter') { e.preventDefault(); document.activeElement?.click(); return; }
    if (e.key === ' ' || e.key === 'Spacebar') {
        if (!isModalOpen && !isCtxMenuOpen && !isEditModalOpen) {
            e.preventDefault(); triggerContextMenu(); return;
        }
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        if (isSetupOpen) return; 
        if (isCtxMenuOpen) { closeCtxMenu(); return; }
        if (isEditModalOpen) { window._editModalClose?.(); return; }
        if (isModalOpen) { gamepadCancel(); return; }
    }
});

let _gamepadIndex = null, _controllerType = 'generic', _btnCooldown = {}, _lastMoveTime = 0, _moveState = 0, _currentDirection = null;
let _cursorHoldState = { l1: 0, r1: 0 }, _cursorLastTime = { l1: 0, r1: 0 };
function buttonJustPressed(btn, index) {
    if (btn?.pressed) { if (!_btnCooldown[index]) { _btnCooldown[index] = true; return true; } return false; }
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
(function gamepadLoop() {
    try {
        const gamepad = _gamepadIndex !== null ? navigator.getGamepads()[_gamepadIndex] : null;
        if (!gamepad) return;
        if (window.isGlobalLoading) return;

        const items = getNavigableItems();
        if (!items.length) return;
        if (!items.includes(document.activeElement)) {
            focusItemByIndex(0);
            return;
        }

        const { GAMEPAD } = NAV, buttons = gamepad.buttons;
        const ax = gamepad.axes[0], ay = gamepad.axes[1], thr = GAMEPAD.AXIS_THRESHOLD, now = performance.now();
        let dir = null;

        if (ax > thr || buttons[GAMEPAD.BTN_RIGHT]?.pressed) dir = 'RIGHT';
        else if (ax < -thr || buttons[GAMEPAD.BTN_LEFT]?.pressed) dir = 'LEFT';
        else if (ay > thr || buttons[GAMEPAD.BTN_DOWN]?.pressed) dir = 'DOWN';
        else if (ay < -thr || buttons[GAMEPAD.BTN_UP]?.pressed) dir = 'UP';

        if (dir) {
            if (dir !== _currentDirection) { moveFocus(dir); _lastMoveTime = now; _moveState = 1; _currentDirection = dir; }
            else if (_moveState === 1 && now - _lastMoveTime > GAMEPAD.INITIAL_DELAY) { moveFocus(dir); _lastMoveTime = now; _moveState = 2; }
            else if (_moveState === 2 && now - _lastMoveTime > GAMEPAD.REPEAT_DELAY) { moveFocus(dir); _lastMoveTime = now; }
        } else { _moveState = 0; _currentDirection = null; }

        if (window._vkbIsOpen) {
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) document.activeElement?.click();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) window._vkbCancel?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_START], GAMEPAD.BTN_START)) window._editModalSave?.();

            [['l1', GAMEPAD.BTN_L1, 'left'], ['r1', GAMEPAD.BTN_R1, 'right']].forEach(([id, idx, dir]) => {
                const pressed = buttons[idx]?.pressed;
                if (pressed) {
                    if (_cursorHoldState[id] === 0) {
                        window._vkbMoveCursor?.(dir);
                        _cursorLastTime[id] = now;
                        _cursorHoldState[id] = 1;
                    } else if (_cursorHoldState[id] === 1 && now - _cursorLastTime[id] > GAMEPAD.INITIAL_DELAY) {
                        window._vkbMoveCursor?.(dir);
                        _cursorLastTime[id] = now;
                        _cursorHoldState[id] = 2;
                    } else if (_cursorHoldState[id] === 2 && now - _cursorLastTime[id] > GAMEPAD.REPEAT_DELAY) {
                        window._vkbMoveCursor?.(dir);
                        _cursorLastTime[id] = now;
                    }
                } else {
                    _cursorHoldState[id] = 0;
                }
            });

            if (buttonJustPressed(buttons[GAMEPAD.BTN_L3], GAMEPAD.BTN_L3)) window._vkbToggleShift?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_TRIANGLE], GAMEPAD.BTN_TRIANGLE)) window._vkbPhysicalKey?.(' ');
            {
                const pressed = buttons[GAMEPAD.BTN_SQUARE]?.pressed;
                if (pressed) {
                    if (_cursorHoldState['sq'] === 0) {
                        window._vkbPhysicalKey?.('Backspace');
                        _cursorLastTime['sq'] = now;
                        _cursorHoldState['sq'] = 1;
                    } else if (_cursorHoldState['sq'] === 1 && now - _cursorLastTime['sq'] > GAMEPAD.INITIAL_DELAY) {
                        window._vkbPhysicalKey?.('Backspace');
                        _cursorLastTime['sq'] = now;
                        _cursorHoldState['sq'] = 2;
                    } else if (_cursorHoldState['sq'] === 2 && now - _cursorLastTime['sq'] > GAMEPAD.REPEAT_DELAY) {
                        window._vkbPhysicalKey?.('Backspace');
                        _cursorLastTime['sq'] = now;
                    }
                } else {
                    _cursorHoldState['sq'] = 0;
                }
            }
        }
        else {
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) document.activeElement?.click();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (isCtxMenuOpen) closeCtxMenu();
                else if (isEditModalOpen) window._editModalClose?.();
                else if (!isSetupOpen) gamepadCancel();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_START], GAMEPAD.BTN_START)) {
                if (isModalOpen) document.getElementById('btnConfirmAdd')?.click();
                else gamepadStart();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_TRIANGLE], GAMEPAD.BTN_TRIANGLE)) {
                if (isModalOpen) gamepadAddFolder();
                gamepadTriangle();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE)) {
                if (isEditModalOpen) window._editModalClose?.();
                else triggerContextMenu();
            }
        }
    } catch (e) {
        console.error('Gamepad protegida interceptou um erro:', e);
    } finally {
      
        requestAnimationFrame(gamepadLoop);
    }
})();

window.addEventListener('load', () => {
    const pads = navigator.getGamepads();
    for (const pad of pads) if (pad) { _gamepadIndex = pad.index; _controllerType = detectControllerType(pad); isGamepadConnected = true; updateGamepadUI(true, _controllerType); break; }
    setTimeout(() => focusItemByIndex(0), 300);
});

const CURSOR_IDLE_MS = 3000;
let _cursorIdleTimeout = null;
function showCursor() {
    document.body.style.cursor = '';
    if (_cursorIdleTimeout) clearTimeout(_cursorIdleTimeout);
    _cursorIdleTimeout = setTimeout(() => { document.body.style.cursor = 'none'; }, CURSOR_IDLE_MS);
}
document.addEventListener('mousemove', showCursor);
showCursor();

// =============================================================================
// Auto-Foco Inteligente Centralizado (Navegação & Modal)
// =============================================================================

// 1. Ao clicar/confirmar em uma aba lateral
document.addEventListener('click', (e) => {
    const tab = e.target.closest('.menu-tab');
    if (tab) {
        setTimeout(() => {
            const groups = getModalGroups();
            const firstVisible = (arr) => arr.find(el => el.offsetWidth > 0 && el.offsetHeight > 0);

            let target = null;
            if (groups.activeTab === 'view-apps') {
             
                target = firstVisible(groups.apps);
            } else {
                target = firstVisible(groups.folderBtns) || groups.actions[0];
            }

            if (target) {
                target.focus();
                if (isModalOpen) target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                signalNavigation();
            }
        }, 100);
    }
});

// 2. Ao abrir o Modal de Adicionar Jogo pela primeira vez (Botão +)
document.getElementById('btnAdd')?.addEventListener('click', () => {
    const checkReady = setInterval(() => {
        if (typeof _modalReady !== 'undefined' && _modalReady) {
            clearInterval(checkReady);
            const firstApp = document.querySelector('#appList .app-item[tabindex="0"]');
            if (firstApp) {
                firstApp.focus();
                signalNavigation();
            }
        }
    }, 50);
});

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