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
const VKB_BOTTOM_KEYS = ['SYM', 'ABC', 'CURSOR_LEFT', 'SPACE', 'CURSOR_RIGHT', '.com'];

const GAMEPAD_ICONS = {
    ps: {
        confirm: `<span class="gp-btn gp-cross">✕</span>`,
        cancel: `<span class="gp-btn gp-circle">◯</span>`,
        triangle: `<span class="gp-btn gp-triangle">△</span>`,
        start: `<span class="gp-btn gp-options">≡</span>`,
        select: `<span class="gp-btn gp-options">▣</span>`,
        square: `<span class="gp-btn gp-square">□</span>`,
    },
    xbox: {
        confirm: `<span class="gp-btn gp-a">A</span>`,
        cancel: `<span class="gp-btn gp-b">B</span>`,
        triangle: `<span class="gp-btn gp-y">Y</span>`,
        start: `<span class="gp-btn gp-menu">☰</span>`,
        select: `<span class="gp-btn gp-menu">☷</span>`,
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
        if (connected) { plusEl.textContent = '+'; plusEl.classList.add('is-gamepad'); }
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
    if (isModalOpen || isCtxMenuOpen || isEditModalOpen || isVkbOpenForNavigation() || window.isGlobalLoading) return;
    if (window.isNavMenuOpen) { window._navMenuTriggerCtxMenu?.(); return; }

    const focused = document.activeElement;
    if (focused?.dataset?.gpuUpdaterCard === 'true' || focused?.dataset?.bluetoothDeviceCard === 'true') {
        const r = focused.getBoundingClientRect();
        window._ctxMenuOpen?.(focused, r.right + 2, r.top);
        return;
    }
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
    let filters = [], apps = [], actions = [], folderBtns = [], subtabs = [], inputs = [], storeBtns = [], emulatorItems = [], emulatorMenus = [];

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
            inputs = Array.from(document.querySelectorAll('#subview-web input, #btnWebAppPaste, #btnWebAppBrowser')).filter(Boolean);
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
    } else if (activeTab === 'view-emulators') {
        emulatorItems = Array.from(document.querySelectorAll('#emulatorViewContent .emulator-nav:not(.emulator-card-menu), #view-emulators .emulator-editor-overlay .emulator-nav:not(.emulator-card-menu)'))
            .filter(item => !item.disabled && item.offsetWidth > 0 && item.offsetHeight > 0);
        emulatorMenus = Array.from(document.querySelectorAll('#emulatorViewContent .emulator-card-menu'))
            .filter(item => !item.disabled && item.offsetWidth > 0 && item.offsetHeight > 0);
        actions = Array.from(document.querySelectorAll('#emulatorActions .emulator-nav'))
            .filter(item => !item.disabled && item.offsetWidth > 0 && item.offsetHeight > 0);
    }
    return { sidebar, filters, apps, actions, folderBtns, subtabs, inputs, storeBtns, emulatorItems, emulatorMenus, activeTab };
}

function getNavigableItems() {
    if (isVkbOpenForNavigation()) return Array.from(document.querySelectorAll('.vkb-key[tabindex="0"]'));
    if (window.DoorpiProfileSync?.isOpen?.()) return window.DoorpiProfileSync.getItems?.() || [];
    const transientPicker = document.querySelector('.profile-photo-picker-overlay, .artwork-wizard-overlay');
    if (transientPicker) {
        return Array.from(transientPicker.querySelectorAll('input, button'))
            .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);
    }
    const emulatorEditor = document.querySelector('#view-emulators .emulator-editor-overlay');
    if (emulatorEditor) {
        return Array.from(emulatorEditor.querySelectorAll('input, button'))
            .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);
    }
    if (window.isDoorpiOverlayOpen?.()) return window.getDoorpiOverlayItems?.() || [];
    if (isSetupOpen) return typeof getSetupItems === 'function' ? getSetupItems() : [];
    if (isCtxMenuOpen) return getCtxMenuItems();
    if (isEditModalOpen) {
        const artworkWizard = document.querySelector('.artwork-wizard-overlay');
        if (artworkWizard) {
            return Array.from(artworkWizard.querySelectorAll('input, button'))
                .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);
        }

        return Array.from(document.querySelectorAll('.edit-modal-input, .edit-artwork-btn, .doorpi-choice-trigger, .doorpi-choice-option, #editSharingBtn, #editExtensionsBtn, .edit-toggle-row, .edit-modal-actions button'))
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
    if (window.isDoorpiNotificationCenterOpen?.()) {
        return Array.from(document.querySelectorAll('#doorpiNotificationPanel [tabindex="0"]'))
            .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);
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
        const notificationBtn = document.getElementById('doorpiNotificationButton');
        const items = [...tabs, ...cards];
        if (notificationBtn) items.unshift(notificationBtn);
        if (profileBtn) items.unshift(profileBtn);
        return items;
    }

    const g = getModalGroups();
    const isVisible = (el) => el.offsetWidth > 0 && el.offsetHeight > 0;
    const isNavigable = () => true;

    g.sidebar.forEach(el => el.setAttribute('tabindex', '0'));

    if (g.activeTab === 'view-apps') return [...g.sidebar, ...g.filters, ...g.apps, ...g.actions].filter(el => isVisible(el) && isNavigable(el));
    if (g.activeTab === 'view-folders') return [...g.sidebar, ...g.folderBtns, ...g.actions].filter(el => isVisible(el) && isNavigable(el));
    if (g.activeTab === 'view-media-apps') return [...g.sidebar, ...g.subtabs, ...g.inputs, ...g.apps, ...g.actions].filter(el => isVisible(el) && isNavigable(el));
    if (g.activeTab === 'view-stores') return [...g.sidebar, ...g.storeBtns, ...g.actions].filter(el => isVisible(el) && isNavigable(el));
    if (g.activeTab === 'view-emulators') return [...g.sidebar, ...g.emulatorItems, ...g.emulatorMenus, ...g.actions].filter(el => isVisible(el) && isNavigable(el));

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

function findArtworkWizardGridCandidate(items, current, direction) {
    const visual = items
        .map(el => ({ el, rect: el.getBoundingClientRect() }))
        .sort((a, b) => Math.abs(a.rect.top - b.rect.top) > 8
            ? a.rect.top - b.rect.top
            : a.rect.left - b.rect.left);
    const rows = [];
    visual.forEach(item => {
        const row = rows.find(candidate => Math.abs(candidate.top - item.rect.top) <= 8);
        if (row) row.items.push(item);
        else rows.push({ top: item.rect.top, items: [item] });
    });
    rows.forEach(row => row.items.sort((a, b) => a.rect.left - b.rect.left));

    const rowIndex = rows.findIndex(row => row.items.some(item => item.el === current));
    if (rowIndex < 0) return null;
    if (direction === 'LEFT' || direction === 'RIGHT') {
        const row = rows[rowIndex];
        const itemIndex = row.items.findIndex(item => item.el === current);
        const targetIndex = itemIndex + (direction === 'RIGHT' ? 1 : -1);
        return row.items[targetIndex]?.el || null;
    }

    const targetRowIndex = direction === 'DOWN' ? rowIndex + 1 : rowIndex - 1;
    if (targetRowIndex < 0 || targetRowIndex >= rows.length) return null;

    const currentRect = current.getBoundingClientRect();
    const currentX = currentRect.left + currentRect.width / 2;
    return rows[targetRowIndex].items.reduce((best, item) => {
        const itemX = item.rect.left + item.rect.width / 2;
        const distance = Math.abs(itemX - currentX);
        return !best || distance < best.distance ? { el: item.el, distance } : best;
    }, null)?.el || null;
}

function revealArtworkWizardChoice(choice) {
    if (!choice?.classList?.contains('artwork-choice')) return;
    const grid = choice.closest('.artwork-results');
    if (!grid) return;
    const gridRect = grid.getBoundingClientRect();
    const choiceRect = choice.getBoundingClientRect();
    const centeredTop = grid.scrollTop
        + (choiceRect.top - gridRect.top)
        - ((grid.clientHeight - choiceRect.height) / 2);
    grid.scrollTo({ top: Math.max(0, centeredTop), behavior: 'smooth' });
}

function revealProfilePhotoChoice(choice) {
    if (!choice?.classList?.contains('profile-photo-choice')) return;
    const body = choice.closest('.profile-photo-picker-body');
    if (!body) return;
    const bodyRect = body.getBoundingClientRect();
    const choiceRect = choice.getBoundingClientRect();
    const centeredTop = body.scrollTop
        + (choiceRect.top - bodyRect.top)
        - ((body.clientHeight - choiceRect.height) / 2);
    const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
    body.scrollTo({ top: Math.max(0, Math.min(maxScroll, centeredTop)), behavior: 'smooth' });
}

function handleArtworkWizardGridDirection(direction, current) {
    if (!['DOWN', 'UP', 'LEFT', 'RIGHT'].includes(direction)) return false;
    const isArtworkChoice = current?.classList?.contains('artwork-choice');
    const isProfileChoice = current?.classList?.contains('profile-photo-choice');
    if (!isArtworkChoice && !isProfileChoice) return false;

    const grid = isProfileChoice
        ? current.closest('.profile-photo-picker-body')
        : current.closest('.artwork-results');
    if (!grid) return false;

    const selector = isProfileChoice ? '.profile-photo-choice' : '.artwork-choice';
    const choices = Array.from(grid.querySelectorAll(selector))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);

    if (isProfileChoice && direction === 'UP' && choices.length) {
        const currentRect = current.getBoundingClientRect();
        const firstRowTop = Math.min(...choices.map(choice => choice.getBoundingClientRect().top));
        const rowTolerance = Math.max(12, currentRect.height * 0.12);
        if (Math.abs(currentRect.top - firstRowTop) <= rowTolerance) {
            const searchInput = grid.querySelector('#profilePhotoSearchInput');
            if (searchInput) {
                grid.scrollTo({ top: 0, behavior: 'smooth' });
                searchInput.focus({ preventScroll: true });
                return true;
            }
        }
    }

    const target = findArtworkWizardGridCandidate(choices, current, direction);
    if (target && target !== current) {
        target.focus({ preventScroll: true });
        if (isProfileChoice) {
            revealProfilePhotoChoice(target);
        } else if (direction === 'UP' || direction === 'DOWN') {
            revealArtworkWizardChoice(target);
        } else {
            target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        return true;
    }

    if (direction === 'LEFT' || direction === 'RIGHT') return true;

    if (isProfileChoice) {
        if (direction === 'DOWN' && choices.length) {
            choices[0].focus({ preventScroll: true });
            revealProfilePhotoChoice(choices[0]);
        }
        return true;
    }

    const scrollAmount = Math.max(140, Math.floor(grid.clientHeight * 0.72));
    const canScrollDown = grid.scrollTop + grid.clientHeight < grid.scrollHeight - 2;
    const canScrollUp = grid.scrollTop > 2;

    if (direction === 'DOWN' && canScrollDown) {
        grid.scrollBy({ top: scrollAmount, behavior: 'smooth' });
        return true;
    }
    if (direction === 'UP' && canScrollUp) {
        grid.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
        return true;
    }
    return false;
}

function resolveExplicitNavTarget(current, direction) {
    const key = {
        LEFT: 'navLeft',
        RIGHT: 'navRight',
        UP: 'navUp',
        DOWN: 'navDown'
    }[direction];
    const selector = key ? current?.dataset?.[key] : '';
    if (!selector) return null;

    try {
        const root = current.closest('.artwork-wizard-overlay') || document;
        const target = root.querySelector(selector);
        if (target && target.offsetWidth > 0 && target.offsetHeight > 0 && !target.disabled) return target;
    } catch { }

    return null;
}

function handleProfilePhotoSearchDirection(direction, current) {
    const overlay = current?.closest?.('.profile-photo-picker-overlay');
    if (!overlay) return false;

    const input = overlay.querySelector('#profilePhotoSearchInput');
    const searchButton = overlay.querySelector('#profilePhotoSearchButton');
    const suggestions = Array.from(overlay.querySelectorAll('.profile-photo-game-suggestion'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);
    const firstArtwork = overlay.querySelector('.profile-photo-choice:not(:disabled)');

    if (current === input) {
        if (direction === 'RIGHT') searchButton?.focus({ preventScroll: true });
        else if (direction === 'DOWN') (suggestions[0] || firstArtwork)?.focus({ preventScroll: true });
        return true;
    }

    if (current === searchButton) {
        if (direction === 'LEFT' || direction === 'UP') input?.focus({ preventScroll: true });
        else if (direction === 'DOWN') (suggestions[0] || firstArtwork)?.focus({ preventScroll: true });
        return true;
    }

    const suggestionIndex = suggestions.indexOf(current);
    if (suggestionIndex >= 0) {
        if (direction === 'UP') (suggestions[suggestionIndex - 1] || input)?.focus({ preventScroll: true });
        else if (direction === 'DOWN') (suggestions[suggestionIndex + 1] || firstArtwork)?.focus({ preventScroll: true });
        else if (direction === 'LEFT') input?.focus({ preventScroll: true });
        return true;
    }

    return false;
}

function findVkbCandidate(items, current, direction) {
    const rowItems = items
        .map(el => ({ el, row: Number(el.dataset?.row), col: Number(el.dataset?.col) }))
        .filter(item => Number.isFinite(item.row) && Number.isFinite(item.col));

    if (rowItems.length === items.length && rowItems.length > 0) {
        const cur = rowItems.find(item => item.el === current);
        if (cur) {
            const rows = new Map();
            rowItems.forEach(item => {
                if (!rows.has(item.row)) rows.set(item.row, []);
                rows.get(item.row).push(item);
            });
            rows.forEach(row => row.sort((a, b) => a.col - b.col));
            const rowNumbers = Array.from(rows.keys()).sort((a, b) => a - b);
            const currentRow = rows.get(cur.row) || [];
            if (direction === 'LEFT' || direction === 'RIGHT') {
                const idx = currentRow.findIndex(item => item.el === current);
                if (idx >= 0) {
                    const nextIdx = direction === 'RIGHT'
                        ? (idx + 1) % currentRow.length
                        : (idx - 1 + currentRow.length) % currentRow.length;
                    return currentRow[nextIdx]?.el || null;
                }
            }

            if (direction === 'UP' || direction === 'DOWN') {
                const rowIdx = rowNumbers.indexOf(cur.row);
                if (rowIdx >= 0) {
                    const nextRowNumber = direction === 'DOWN'
                        ? rowNumbers[(rowIdx + 1) % rowNumbers.length]
                        : rowNumbers[(rowIdx - 1 + rowNumbers.length) % rowNumbers.length];
                    const nextRow = rows.get(nextRowNumber) || [];
                    const cr = current.getBoundingClientRect();
                    const cx = cr.left + cr.width / 2;
                    return nextRow
                        .map(item => {
                            const r = item.el.getBoundingClientRect();
                            return { item, dist: Math.abs((r.left + r.width / 2) - cx) };
                        })
                        .sort((a, b) => a.dist - b.dist)[0]?.item.el || null;
                }
            }
        }
    }

    const curKey = current.dataset?.key;
    const hasTextBottomRow = items.some(el => el.dataset?.key === 'SPACE');
    if (hasTextBottomRow && VKB_BOTTOM_KEYS.includes(curKey) && (direction === 'LEFT' || direction === 'RIGHT')) {
        const order = VKB_BOTTOM_KEYS.filter(key => items.some(el => el.dataset?.key === key));
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
    const { sidebar, filters, apps, actions, folderBtns, subtabs, inputs, storeBtns, emulatorItems, emulatorMenus, activeTab } = groups;
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
            const isBrowserBtn = current.id === 'btnWebAppBrowser';

            if (direction === 'LEFT') {
                if ((isPasteBtn || isBrowserBtn) && idx > 0) return inputs[idx - 1];
                return bestSidebar();
            }
            if (direction === 'RIGHT') {
                if (inputs[idx + 1]) return inputs[idx + 1];
                return null;
            }
            if (direction === 'UP') {
                if (isPasteBtn || isBrowserBtn) return inputs[0];
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
    } else if (activeTab === 'view-emulators') {
        const emulatorEditor = document.querySelector('#view-emulators .emulator-editor-overlay');
        if (emulatorEditor?.contains(current)) return current;
        if (groupName === 'emulator') {
            if (direction === 'LEFT') return bestSidebar();
            if (direction === 'DOWN') return firstVisible(actions);
        }
        if (groupName === 'emulatorMenu') {
            if (direction === 'DOWN')
                return current.closest('.emulator-library-card')?.querySelector('.emulator-card-launch') || current;
            return current;
        }
        if (groupName === 'action') {
            if (direction === 'UP') return emulatorItems[emulatorItems.length - 1] ?? null;
            if (direction === 'LEFT' && actions.indexOf(current) === 0) return bestSidebar();
        }
        if (groupName === 'sidebar' && (direction === 'RIGHT' || direction === 'DOWN'))
            return firstVisible(emulatorItems || []) || firstVisible(actions);
    }
    return null;
}

let _lastFocusedApp = null, _lastFocusedFilter = null, _lastFocusedSidebar = null, _lastSetupFocused = null;
let _sessionConflictSuppressKeyNavUntil = 0;
let _sessionConflictLastKeyNavAt = 0;

function moveSessionConflictFocus(direction) {
    if (window.moveSessionConflictPopupFocus?.(direction)) return;

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

function moveExecutionLockFocus(direction) {
    const items = Array.from(document.querySelectorAll('#executionLockActions .lock-action'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);
    if (!items.length) return;

    const current = document.activeElement;
    if (!items.includes(current)) {
        items[0]?.focus();
        return;
    }

    const index = items.indexOf(current);
    const step = direction === 'RIGHT' || direction === 'DOWN' ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(items.length - 1, index + step));
    items[nextIndex]?.focus();
}

function moveNotificationCenterFocus(direction) {
    const rows = Array.from(document.querySelectorAll('#doorpiNotificationList .doorpi-notification-item'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);
    if (!rows.length) return;

    const current = document.activeElement;
    const currentRow = current?.closest?.('.doorpi-notification-item');
    let rowIndex = rows.indexOf(currentRow);
    if (rowIndex < 0) {
        rows[0].focus();
        return;
    }

    if (direction === 'RIGHT') {
        if (!current?.matches?.('[data-notification-close]')) {
            const closeButton = currentRow.querySelector('[data-notification-close]');
            if (closeButton) {
                closeButton.focus();
                if (window._gpNavigating) window.DoorpiUiSound?.play('move');
                signalNavigation();
            }
        }
        return;
    }

    if (direction === 'LEFT') {
        if (current?.matches?.('[data-notification-close]')) {
            currentRow.focus();
            if (window._gpNavigating) window.DoorpiUiSound?.play('move');
            signalNavigation();
        }
        return;
    }

    if (direction === 'DOWN') rowIndex = Math.min(rows.length - 1, rowIndex + 1);
    else if (direction === 'UP') rowIndex = Math.max(0, rowIndex - 1);
    else return;

    const target = rows[rowIndex];
    if (target !== current) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        if (window._gpNavigating) window.DoorpiUiSound?.play('move');
        signalNavigation();
    }
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

function gamepadTriangle() {
    if (!isModalOpen || window.isGlobalLoading) return;

    const mediaAppsView = document.querySelector('.view-section.active')?.id === 'view-media-apps';

    // Y always means "add an executable app" anywhere inside Applications,
    // including the Web Apps subtab before the executable controls are rendered.
    if (mediaAppsView) {
        window.openManualMediaAppDialog?.();
        return;
    }

    document.getElementById('btnSearch')?.click();
}

function moveFocus(direction) {
    if (window.isGlobalLoading) return;

    if (window.DoorpiProfileSync?.isOpen?.()) {
        window.DoorpiProfileSync.moveFocus?.(direction);
        return;
    }

    if (isVkbOpenForNavigation()) {
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

    const transientPicker = document.querySelector('.profile-photo-picker-overlay, .artwork-wizard-overlay');
    if (transientPicker) {
        const items = getNavigableItems();
        if (!items.length) return;
        const current = document.activeElement;
        if (handleProfilePhotoSearchDirection(direction, current)) return;
        if (handleArtworkWizardGridDirection(direction, current)) return;
        if (!items.includes(current)) { items[0]?.focus(); return; }
        const target = resolveExplicitNavTarget(current, direction) ||
            findSpatialCandidate(items, current, direction) ||
            findWrapCandidate(items, current, direction);
        if (target && target !== current) {
            target.focus({ preventScroll: true });
            revealArtworkWizardChoice(target);
            if (target.classList?.contains('profile-photo-choice')) revealProfilePhotoChoice(target);
            else if (target.id === 'profilePhotoSearchInput')
                target.closest('.profile-photo-picker-body')?.scrollTo({ top: 0, behavior: 'smooth' });
        }
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

        if (handleArtworkWizardGridDirection(direction, current)) return;

        if (!items.includes(current)) { items[0]?.focus(); return; }
        let target = resolveExplicitNavTarget(current, direction) ||
            findSpatialCandidate(items, current, direction) ||
            findWrapCandidate(items, current, direction);

        if (!target) {
            const idx = items.indexOf(current);
            if (direction === 'DOWN' && idx < items.length - 1) target = items[idx + 1];
            if (direction === 'UP' && idx > 0) target = items[idx - 1];
        }

        if (target && target !== current) {
            target.focus();
            revealArtworkWizardChoice(target);
        }
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

        let target = window._resolveSetupNavigationTarget?.(current, direction, items) ||
            findSpatialCandidate(items, current, direction);

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

    if (window.isDoorpiNotificationCenterOpen?.()) {
        moveNotificationCenterFocus(direction);
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
        if (current?.id === 'btnTopProfile' && direction === 'LEFT' && window.DoorpiQuickPanel?.open) {
            window.DoorpiQuickPanel.open();
            return;
        }

        if (current?.classList?.contains('home-tab') && direction === 'LEFT' && window.DoorpiQuickPanel?.open) {
            const tabs = items.filter(el => el.classList.contains('home-tab'));
            if (tabs[0] === current) {
                window.DoorpiQuickPanel.open();
                return;
            }
        }

        let explicitHomeTarget = null;
        const homeGrid = current.closest('#mediaGrid, #gameGrid, #storesGrid');
        if (homeGrid) {
            const gridItems = items.filter(el => homeGrid.contains(el));
            if (direction === 'LEFT') {
                if (gridItems[0] === current && window.DoorpiQuickPanel?.open) {
                    window.DoorpiQuickPanel.open();
                    return;
                }
            }
            if (direction === 'RIGHT' && gridItems[gridItems.length - 1] === current) {
                explicitHomeTarget = gridItems[0] || null;
            }
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

        let target = explicitHomeTarget || findSpatialCandidate(items, current, direction);
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
            target.focus({ preventScroll: true });
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
    else if (current.closest?.('#emulatorActions')) { groupName = 'action'; groupItems = groups.actions; }
    else if (current.classList.contains('emulator-card-menu')) { groupName = 'emulatorMenu'; groupItems = groups.emulatorMenus; }
    else if (current.classList.contains('emulator-nav')) { groupName = 'emulator'; groupItems = groups.emulatorItems; }
    else if (current.classList.contains('icon-btn')) { groupName = 'folderBtn'; groupItems = groups.folderBtns; }
    else if (current.classList.contains('subtab')) { groupName = 'subtab'; groupItems = groups.subtabs; }
    else if (current.tagName === 'INPUT' || current.id === 'btnWebAppPaste' || current.id === 'btnWebAppBrowser') { groupName = 'input'; groupItems = groups.inputs; }
    else { groupName = 'action'; groupItems = groups.actions; }

    if (groupName === 'app') _lastFocusedApp = current;
    if (groupName === 'filter') _lastFocusedFilter = current;
    if (groupName === 'sidebar') _lastFocusedSidebar = current;

    let target = null;
    if (groups.activeTab === 'view-emulators' &&
        groupName === 'emulator' &&
        current.classList.contains('emulator-card-launch') &&
        direction === 'UP') {
        target = current.closest('.emulator-library-card')?.querySelector('.emulator-card-menu') || null;
    } else if (groups.activeTab === 'view-emulators' &&
        groupName === 'emulatorMenu' &&
        direction === 'DOWN') {
        target = current.closest('.emulator-library-card')?.querySelector('.emulator-card-launch') || null;
    } else if (!(groupName === 'sidebar' && direction === 'RIGHT')) {
        target = findSpatialCandidate(groupItems.filter(i => items.includes(i)), current, direction);
    }

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
    if (isModalOpen || isEditModalOpen || isVkbOpenForNavigation() || isSetupOpen) return;
    const ht = window.getCurrentHomeTab?.() || 'games';
    const activeGridId = ht === 'media' ? 'mediaGrid' : (ht === 'stores' ? 'storesGrid' : 'gameGrid');
    const grid = document.getElementById(activeGridId);
    if (!grid) return false;
    const featured = grid.querySelector('.card.featured');
    if (featured) {
        featured.focus({ preventScroll: true });
        grid.scrollLeft = 0;
        featured._startInteraction?.();
        return document.activeElement === featured;
    }

    const first = grid.querySelector('.card');
    first?.focus({ preventScroll: true });
    return !!first && document.activeElement === first;
};

function focusItemByIndex(index) {
    const items = getNavigableItems();
    if (!items.length) return;
    const el = items[(index + items.length) % items.length];
    el.focus({ preventScroll: !isModalOpen });
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
    if (window.isDoorpiFileBrowserOpen?.() && !isVkbOpenForNavigation()) {
        const direction = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' }[e.key];
        if (direction) {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.DoorpiFileBrowser?.moveFocus?.(direction);
            return;
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.DoorpiFileBrowser?.activate?.();
            return;
        }
        if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'BrowserBack') {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.DoorpiFileBrowser?.back?.();
            return;
        }
        const fileBrowserInputFocused = document.activeElement?.matches?.('input, textarea');
        if ((e.key || '').toLowerCase() === 'x' && !fileBrowserInputFocused) {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.DoorpiFileBrowser?.context?.();
            return;
        }
        if ((e.key || '').toLowerCase() === 'y' && !fileBrowserInputFocused) {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.DoorpiFileBrowser?.createFolder?.();
            return;
        }
    }
    if (window.DoorpiProfileSync?.isOpen?.()) {
        const direction = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' }[e.key];
        if (direction) {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.DoorpiProfileSync.moveFocus?.(direction);
            return;
        }
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.DoorpiProfileSync.confirm?.();
            return;
        }
        if (e.key === 'Escape' || e.key === 'Backspace') {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.DoorpiProfileSync.back?.();
            return;
        }
    }
    // ── NOVO: Cancelar launch via teclado (Esc ou Backspace) ──
    const launchOverlay = document.getElementById('gameLaunchOverlay');
    const isSessionConflict = window.isSessionConflictPopupOpen?.() === true;
    const isExecutionLock = !isSessionConflict && launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('execution-lock-visible');
        if (isExecutionLock) {
            const dirMapLock = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' };
            if (dirMapLock[e.key]) {
                e.preventDefault();
                e.stopImmediatePropagation();
                moveExecutionLockFocus(dirMapLock[e.key]);
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

    if (window._doorpiNativeDialogActive) {
        const blocked = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Enter', ' ', 'Spacebar', 'Escape', 'Backspace'];
        if (blocked.includes(e.key)) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
        return;
    }

    if (isDoorpiActionQuarantineActive()) {
        const blocked = ['Enter', ' ', 'Spacebar', 'Escape', 'Backspace'];
        if (blocked.includes(e.key)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }
    }

    if (window.isGlobalLoading) { e.preventDefault(); return; }
    if (window.isDoorpiOverlayOpen?.() && !isVkbOpenForNavigation()) {
        const dirMapOverlay = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' };
        if (dirMapOverlay[e.key]) {
            e.preventDefault();
            const dir = dirMapOverlay[e.key];
            if (window.DoorpiQuickPanel?.handleDirection?.(dir)) return;
            moveFocus(dir);
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (window.DoorpiQuickPanel?.confirm?.()) return;
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
    if (window.isNavMenuOpen && !isCtxMenuOpen && !isEditModalOpen &&
        !document.querySelector('.profile-photo-picker-overlay, .artwork-wizard-overlay')) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (window.requestDoorpiBackAction?.()) return;
            return;
        }
        return;
    }

    if (isVkbOpenForNavigation()) {
        const dirMap = { ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowDown: 'DOWN', ArrowUp: 'UP' };
        if (dirMap[e.key]) { e.preventDefault(); moveFocus(dirMap[e.key]); return; }
        if (e.key === 'Escape') { e.preventDefault(); window.requestDoorpiBackAction?.(); return; }
        if (e.key === 'Enter') { e.preventDefault(); window._vkbConfirm?.(); return; }
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
        if (!isModalOpen && !isCtxMenuOpen && !isEditModalOpen &&
            !document.querySelector('.profile-photo-picker-overlay, .artwork-wizard-overlay')) {
            e.preventDefault(); triggerContextMenu(); return;
        }
    }

    if (e.key === 'Escape') {
        e.preventDefault();

        if (document.querySelector('.profile-photo-picker-overlay')) {
            window._profilePhotoPickerShortcut?.('cancel');
            return;
        }
        if (document.querySelector('.artwork-wizard-overlay')) {
            window._artworkWizardShortcut?.('cancel');
            return;
        }
        if (window.handleEmulatorBack?.()) return;

        // 1. Se for o Overlay de Perfil, aplica a trava de segurança
        if (window.isDoorpiOverlayOpen?.()) {
            if (!canCloseProfileSelection()) return;
            window.closeDoorpiTopOverlay?.();
            return;
        }

        // 2. Se for Setup, Contexto, Edição ou Modal, fecha normalmente
        if (isSetupOpen) {
            const backToAuth = document.getElementById('btnSetupBackAuth');
            const cancelBtn = document.getElementById('btnSetupCancel');
            if (backToAuth?.classList.contains('visible') && typeof setupBack === 'function') setupBack();
            else if (cancelBtn && cancelBtn.style.display !== 'none') cancelBtn.click();
            else if (typeof setupBack === 'function') setupBack(); // setup obrigatorio consome o retorno sem fechar
            return;
        }
        if (isCtxMenuOpen) { closeCtxMenu(); return; }
        if (isEditModalOpen) { window._editModalClose?.(); return; }
        if (isModalOpen) { closeModal?.(); return; } // Aqui volta a fechar Add Jogo/App
    }
});

let _controllerType = 'generic', _btnCooldown = {}, _lastMoveTime = 0, _moveState = 0, _currentDirection = null, _sessionConflictHeldDir = null, _gameFocusFallbackHeldDir = null;
let _cursorHoldState = { l1: 0, r1: 0 }, _cursorLastTime = { l1: 0, r1: 0 };
let _doorpiActionQuarantineUntil = 0;
let _doorpiActionReleaseGate = false;
let _doorpiActionReleaseGateStartedAt = 0;
let _doorpiControllerActivationToken = 0;
let _doorpiControllerActivationActive = false;
let _doorpiNativeController = {
    connected: false, buttons: 0, pendingPressed: 0, dpad: 0,
    leftX: 0, leftY: 0, rightX: 0, rightY: 0
};
let _controlsDirectionStartedAt = 0;
let _controlsDirectionLastMoveAt = 0;

function markDoorpiControllerActivation() {
    const token = ++_doorpiControllerActivationToken;
    _doorpiControllerActivationActive = true;
    queueMicrotask(() => {
        if (_doorpiControllerActivationToken === token)
            _doorpiControllerActivationActive = false;
    });
}

window._doorpiIsControllerActivation = () => _doorpiControllerActivationActive;

window._gpNavigating = false;
let _gpNavigatingTimeout = null;
window._doorpiGameInputSuppressedUntil = 0;
let _lastDoorpiInputBlockReason = '';
let _lastDoorpiInputBlockLogAt = 0;

function logDoorpiInputBlock(reason) {
    const now = performance.now();
    if (reason === _lastDoorpiInputBlockReason && now - _lastDoorpiInputBlockLogAt < 900) return;
    _lastDoorpiInputBlockReason = reason;
    _lastDoorpiInputBlockLogAt = now;
    console.debug(`[DoorpiInput] blocked: ${reason}`, {
        isGlobalLoading: !!window.isGlobalLoading,
        mediaActive: !!window.isMediaAppActive,
        gameLaunchActive: !!window.isGameLaunchActive,
        suppressedUntil: window._doorpiGameInputSuppressedUntil || 0,
        sessionTransition: window.isDoorpiSessionTransitionActive?.() === true,
        focused: document.hasFocus()
    });
}

function seedDoorpiHeldButtonState() {
    _btnCooldown = {};
    _doorpiNativeController.pendingPressed = 0;
}

window.resetDoorpiGamepadInputState = function () {
    seedDoorpiHeldButtonState();
    _moveState = 0;
    _currentDirection = null;
    _controlsDirectionStartedAt = 0;
    _controlsDirectionLastMoveAt = 0;
    _sessionConflictHeldDir = null;
    _gameFocusFallbackHeldDir = null;
    _cursorHoldState = { l1: 0, r1: 0, sq: 0 };
    _cursorLastTime = { l1: 0, r1: 0, sq: 0 };
    window._gpNavigating = false;
    if (_gpNavigatingTimeout) {
        clearTimeout(_gpNavigatingTimeout);
        _gpNavigatingTimeout = null;
    }
};

function isDoorpiActionQuarantineActive() {
    if (performance.now() < _doorpiActionQuarantineUntil) return true;
    _doorpiActionQuarantineUntil = 0;
    return false;
}

window.quarantineDoorpiGamepadActions = function (durationMs = 450) {
    const boundedDuration = Math.max(0, Math.min(1500, Number(durationMs) || 0));
    _doorpiActionQuarantineUntil = Math.max(
        _doorpiActionQuarantineUntil,
        performance.now() + boundedDuration
    );
    window.resetDoorpiGamepadInputState?.();
};

window.clearDoorpiInputQuarantine = function (options = {}) {
    _doorpiActionQuarantineUntil = 0;
    window._doorpiGameInputSuppressedUntil = 0;
    window._doorpiIntroInputBlockUntil = 0;
    if (options?.dropPending === true) {
        _doorpiActionReleaseGate = false;
        _doorpiActionReleaseGateStartedAt = 0;
        _doorpiNativeController.pendingPressed = 0;
        window.resetDoorpiGamepadInputState?.();
    } else if (options?.releaseGate === true) {
        window.armDoorpiGamepadReleaseGate?.();
    } else {
        _doorpiActionReleaseGate = false;
        _doorpiActionReleaseGateStartedAt = 0;
        window.resetDoorpiGamepadInputState?.();
    }
};

window.armDoorpiGamepadReleaseGate = function () {
    _doorpiActionReleaseGate = true;
    _doorpiActionReleaseGateStartedAt = performance.now();
    seedDoorpiHeldButtonState();
};

function isVkbOpenForNavigation() {
    if (!window._vkbIsOpen) return false;
    const overlay = document.querySelector('.vkb-overlay.visible');
    if (overlay && overlay.offsetWidth > 0 && overlay.offsetHeight > 0) return true;

    window._vkbIsOpen = false;
    window.resetDoorpiGamepadInputState?.();
    return false;
}

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
    if (window.isEmulatorDiscSelectorOpen?.()) {
        window.closeEmulatorDiscSelector?.(true);
        window.DoorpiUiSound?.play('back');
        return true;
    }

    const launchOverlay = document.getElementById('gameLaunchOverlay');
    const isSessionConflict = window.isSessionConflictPopupOpen?.() === true;
    const isExecutionLock = !isSessionConflict && launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('execution-lock-visible');
    const isWaitingLaunch = !isSessionConflict && launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('state-loading');

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

    if (window.isDoorpiNotificationCenterOpen?.()) {
        window.DoorpiNotifications?.close?.();
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) {
        closeCtxMenu();
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (window.DoorpiQuickPanel?.isOpen?.()) {
        window.DoorpiQuickPanel.back?.();
        window.DoorpiUiSound?.play('back');
        return true;
    }

    const userPicker = document.getElementById('doorpiUserPicker');
    const userPickerOpen = userPicker && userPicker.style.display !== 'none' && userPicker.offsetWidth > 0 && userPicker.offsetHeight > 0;
    if (userPickerOpen && userPicker.dataset.returnToQuickPanel === 'true') {
        if (window._doorpiCloseUserPicker?.()) {
            window.DoorpiUiSound?.play('back');
            return true;
        }
        return false;
    }

    if (window.isDoorpiOverlayOpen?.()) {
        if (!canCloseProfileSelection()) return false;
        window.closeDoorpiTopOverlay?.();
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (isVkbOpenForNavigation()) {
        window._vkbCancel?.();
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (window.handleEmulatorBack?.()) {
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) {
        if (window._artworkWizardClose?.()) {
            window.DoorpiUiSound?.play('back');
            return true;
        }
        window._editModalClose?.();
        window.DoorpiUiSound?.play('back');
        return true;
    }

    if (typeof isSetupOpen !== 'undefined' && isSetupOpen) {
        const backToAuth = document.getElementById('btnSetupBackAuth');
        if (backToAuth?.classList.contains('visible') && typeof setupBack === 'function') {
            setupBack();
            window.DoorpiUiSound?.play('back');
            return true;
        }
        const cancelBtn = document.getElementById('btnSetupCancel');
        if (cancelBtn && cancelBtn.style.display !== 'none') {
            cancelBtn.click();
            window.DoorpiUiSound?.play('back');
            return true;
        }
        if (typeof setupBack === 'function') {
            const handled = setupBack() !== false;
            if (handled) window.DoorpiUiSound?.play('back');
            return handled;
        }
        return false;
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
    if (btn && Object.prototype.hasOwnProperty.call(btn, 'justPressed')) {
        if (btn.justPressed && !btn._consumed) {
            btn._consumed = true;
            return true;
        }
        return false;
    }

    if (btn?.pressed) {
        if (!_btnCooldown[index]) {
            _btnCooldown[index] = true;
            return true;
        }
        return false;
    }
    _btnCooldown[index] = false; return false;
}

function primaryJustPressed(buttons, gamepad = NAV.GAMEPAD) {
    const confirmPressed = buttonJustPressed(buttons[gamepad.BTN_CONFIRM], gamepad.BTN_CONFIRM);
    const r2Pressed = buttonJustPressed(buttons[gamepad.BTN_R2], gamepad.BTN_R2);
    const pressed = confirmPressed || r2Pressed;
    if (pressed) {
        markDoorpiControllerActivation();
        window.DoorpiUiSound?.play('confirm');
    }
    return pressed;
}

function axisDirection(gamepad, threshold = NAV.GAMEPAD.AXIS_THRESHOLD) {
    const axes = Array.from(gamepad?.axes || []);
    let bestDir = null;
    let bestMag = 0;
    const pairs = [[0, 1], [2, 3], [4, 5]];

    for (const [xIndex, yIndex] of pairs) {
        const x = Number(axes[xIndex] || 0);
        const y = Number(axes[yIndex] || 0);
        const absX = Math.abs(x);
        const absY = Math.abs(y);
        const mag = Math.max(absX, absY);
        if (mag < threshold || mag <= bestMag) continue;

        bestMag = mag;
        bestDir = absX >= absY ? (x > 0 ? 'RIGHT' : 'LEFT') : (y > 0 ? 'DOWN' : 'UP');
    }

    const hatDirections = [
        'UP', 'UP_RIGHT', 'RIGHT', 'DOWN_RIGHT',
        'DOWN', 'DOWN_LEFT', 'LEFT', 'UP_LEFT'
    ];
    const hatValues = [-1, -5 / 7, -3 / 7, -1 / 7, 1 / 7, 3 / 7, 5 / 7, 1];

    for (const value of axes) {
        if (typeof value !== 'number') continue;
        if (Math.abs(value) < 0.08) continue;

        let bestHat = -1;
        let bestHatDistance = Number.POSITIVE_INFINITY;
        for (let i = 0; i < hatValues.length; i++) {
            const distance = Math.abs(value - hatValues[i]);
            if (distance < bestHatDistance) {
                bestHatDistance = distance;
                bestHat = i;
            }
        }

        if (bestHat < 0 || bestHatDistance > 0.08) continue;

        const mapped = hatDirections[bestHat];
        if (!mapped) continue;
        if (mapped.includes('UP')) return 'UP';
        if (mapped.includes('DOWN')) return 'DOWN';
        if (mapped.includes('LEFT')) return 'LEFT';
        if (mapped.includes('RIGHT')) return 'RIGHT';
    }

    return bestDir;
}

function gamepadDirection(gamepad, buttons, threshold = NAV.GAMEPAD.AXIS_THRESHOLD) {
    const { GAMEPAD } = NAV;
    if (buttons[GAMEPAD.BTN_RIGHT]?.pressed) return 'RIGHT';
    if (buttons[GAMEPAD.BTN_LEFT]?.pressed) return 'LEFT';
    if (buttons[GAMEPAD.BTN_DOWN]?.pressed) return 'DOWN';
    if (buttons[GAMEPAD.BTN_UP]?.pressed) return 'UP';
    return axisDirection(gamepad, threshold);
}

function nativeControllerDirection(threshold = NAV.GAMEPAD.AXIS_THRESHOLD) {
    const dpad = _doorpiNativeController.dpad >>> 0;
    if ((dpad & 0x0008) !== 0) return 'RIGHT';
    if ((dpad & 0x0004) !== 0) return 'LEFT';
    if ((dpad & 0x0002) !== 0) return 'DOWN';
    if ((dpad & 0x0001) !== 0) return 'UP';

    const x = Number(_doorpiNativeController.leftX || 0);
    const y = Number(_doorpiNativeController.leftY || 0);
    if (Math.abs(x) >= Math.abs(y) && Math.abs(x) > threshold)
        return x > 0 ? 'RIGHT' : 'LEFT';
    if (Math.abs(y) > threshold)
        return y > 0 ? 'UP' : 'DOWN';
    return null;
}

window.isDoorpiNativeDirectionHeld = direction =>
    nativeControllerDirection() === String(direction || '').toUpperCase();

function handleArtworkWizardGamepadShortcuts(buttons) {
    if (isVkbOpenForNavigation() || !window._artworkWizardIsOpen?.()) return false;

    if (buttonJustPressed(buttons[NAV.GAMEPAD.BTN_TRIANGLE], NAV.GAMEPAD.BTN_TRIANGLE)) {
        return window._artworkWizardShortcut?.('search') === true;
    }
    if (buttonJustPressed(buttons[NAV.GAMEPAD.BTN_SQUARE], NAV.GAMEPAD.BTN_SQUARE)) {
        return window._artworkWizardShortcut?.('skip') === true;
    }
    if (buttonJustPressed(buttons[NAV.GAMEPAD.BTN_CANCEL], NAV.GAMEPAD.BTN_CANCEL)) {
        return window._artworkWizardShortcut?.('cancel') === true;
    }
    return false;
}

function refreshGamepadPresence() {
    isGamepadConnected = !!_doorpiNativeController.connected;
    _controllerType = 'xbox';
    updateGamepadUI(isGamepadConnected, _controllerType);
}
window.refreshDoorpiGamepadHints = refreshGamepadPresence;

function readAllGamepadInput() {
    if (!_doorpiNativeController.connected) return null;

    const held = _doorpiNativeController.buttons >>> 0;
    let pressedThisFrame = _doorpiNativeController.pendingPressed >>> 0;
    _doorpiNativeController.pendingPressed = 0;
    if (_doorpiActionReleaseGate) {
        pressedThisFrame = 0;
        const releaseGateTimedOut = performance.now() - _doorpiActionReleaseGateStartedAt > 900;
        if ((held & 0xFFF0) === 0 || releaseGateTimedOut) {
            _doorpiActionReleaseGate = false;
            _doorpiActionReleaseGateStartedAt = 0;
        }
    }

    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, justPressed: false }));
    const mapping = [
        [0, 0x1000], // A / gatilho direito
        [1, 0x2000], // B
        [2, 0x4000], // X
        [3, 0x8000], // Y
        [4, 0x0100], // L1
        [5, 0x0200], // R1
        [6, 0x0800], // L2
        [8, 0x0020], // View
        [9, 0x0010], // Menu
        [10, 0x0040], // L3
        [11, 0x0080], // R3
        [16, 0x0400] // Guide
    ];

    for (const [index, mask] of mapping) {
        buttons[index] = {
            pressed: (held & mask) !== 0,
            justPressed: (pressedThisFrame & mask) !== 0
        };
    }

    const dpad = _doorpiNativeController.dpad >>> 0;
    buttons[NAV.GAMEPAD.BTN_UP] = { pressed: (dpad & 0x0001) !== 0, justPressed: false };
    buttons[NAV.GAMEPAD.BTN_DOWN] = { pressed: (dpad & 0x0002) !== 0, justPressed: false };
    buttons[NAV.GAMEPAD.BTN_LEFT] = { pressed: (dpad & 0x0004) !== 0, justPressed: false };
    buttons[NAV.GAMEPAD.BTN_RIGHT] = { pressed: (dpad & 0x0008) !== 0, justPressed: false };

    const controlsOpen = window.DoorpiControls?.isOpen?.() === true;

    return {
        id: 'Doorpi XInput',
        index: -1,
        buttons,
        // O editor usa o XInput diretamente; as demais telas continuam usando o
        // loop direcional nativo para preservar o comportamento já existente.
        axes: controlsOpen
            ? [_doorpiNativeController.leftX, -_doorpiNativeController.leftY, 0, 0]
            : [0, 0, 0, 0],
        connectedGamepads: []
    };
}

if (window.chrome?.webview) {
    window.chrome.webview.addEventListener('message', event => {
        let data = event.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch { return; }
        }
        if (!data || data.type !== 'nativeControllerSnapshot') return;

        const wasConnected = _doorpiNativeController.connected;
        _doorpiNativeController.connected = !!data.connected;
        _doorpiNativeController.buttons = Number(data.buttons || 0) >>> 0;
        _doorpiNativeController.dpad = Number(data.dpad || 0) >>> 0;
        // Durante "Aguardando a janela", a sessÃ£o ainda Ã© marcada como mÃ­dia
        // ativa, mas o Doorpi estÃ¡ na frente e precisa receber o A de Retornar.
        // Antes disso o bridge descartava esse pressionamento e sÃ³ o mouse
        // conseguia acionar o botÃ£o.
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        const isWaitingLaunch = !!(launchOverlay &&
            launchOverlay.classList.contains('visible') &&
            launchOverlay.classList.contains('state-loading'));
        const isExecutionLock = !!(launchOverlay &&
            launchOverlay.classList.contains('visible') &&
            launchOverlay.classList.contains('execution-lock-visible'));
        const isControlEditor = window.DoorpiControls?.isOpen?.() === true;
        if (document.hasFocus() && window.isDoorpiFocused &&
            (!window.isMediaAppActive || isWaitingLaunch || isExecutionLock || isControlEditor))
            _doorpiNativeController.pendingPressed |= Number(data.pressed || 0) >>> 0;
        else
            _doorpiNativeController.pendingPressed = 0;
        _doorpiNativeController.rightX = Number(data.rightX || 0);
        _doorpiNativeController.rightY = Number(data.rightY || 0);
        _doorpiNativeController.leftX = Number(data.leftX || 0);
        _doorpiNativeController.leftY = Number(data.leftY || 0);
        if (window._profilePhotoPickerIsOpen?.())
            window._profilePhotoPickerAdjustZoom?.(_doorpiNativeController.rightY);
        if (window.DoorpiProfileSync?.isOpen?.())
            window.DoorpiProfileSync.scrollDifferences?.(_doorpiNativeController.rightY);
        if (!_doorpiNativeController.connected) {
            _doorpiNativeController.buttons = 0;
            _doorpiNativeController.pendingPressed = 0;
            _doorpiNativeController.dpad = 0;
            _doorpiNativeController.leftX = 0;
            _doorpiNativeController.leftY = 0;
            _doorpiNativeController.rightX = 0;
            _doorpiNativeController.rightY = 0;
        }
        window.releaseHomeTrailerCinemaControllerKeys?.(nativeControllerDirection());
        if (wasConnected !== _doorpiNativeController.connected)
            refreshGamepadPresence();
    });
}

window.addEventListener('gamepadconnected', e => {
    refreshGamepadPresence();
});
window.addEventListener('gamepaddisconnected', e => {
    refreshGamepadPresence();
});


window.isDoorpiFocused = document.hasFocus();


window.addEventListener('focus', () => {
    window.isDoorpiFocused = true;
    window.clearDoorpiInputQuarantine?.({ dropPending: true });
});
window.addEventListener('blur', () => { window.isDoorpiFocused = false; });
(function gamepadLoop() {
    try {
        // ── NOVO: Se o Doorpi não for a janela ativa no Windows, ignora o controle 100% ──
        if (!window.isDoorpiFocused) return;

        let gamepad = readAllGamepadInput();
        if (!gamepad) return;

        if (window.DoorpiControls?.isOpen?.() && !isVkbOpenForNavigation()) {
            const { GAMEPAD } = NAV, buttons = gamepad.buttons;
            if (window.DoorpiControls.isCapturing?.()) {
                _currentDirection = null;
                return;
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_L1], GAMEPAD.BTN_L1))
                window.DoorpiControls.switchTab('left');
            if (buttonJustPressed(buttons[GAMEPAD.BTN_R1], GAMEPAD.BTN_R1))
                window.DoorpiControls.switchTab('right');
            // Directions are emitted as discrete arrow-key pulses by the same
            // native C# navigator used everywhere else in Doorpi. This branch owns
            // only action buttons, avoiding a second analog/D-pad repeat loop.
            _currentDirection = null;
            _controlsDirectionStartedAt = 0;
            _controlsDirectionLastMoveAt = 0;
            if (primaryJustPressed(buttons, GAMEPAD))
                window.DoorpiControls.activate();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL))
                window.DoorpiControls.back();
            return;
        }

        if (window._doorpiNativeDialogActive) return;

        if (isDoorpiActionQuarantineActive()) {
            gamepad.buttons.forEach(button => {
                if (!button) return;
                button.justPressed = false;
                button._consumed = true;
            });
        }

        if (window.DoorpiIntro?.isRunning?.()) {
            const introButtons = gamepad.buttons;
            buttonJustPressed(introButtons[NAV.GAMEPAD.BTN_CONFIRM], NAV.GAMEPAD.BTN_CONFIRM);
            buttonJustPressed(introButtons[NAV.GAMEPAD.BTN_R2], NAV.GAMEPAD.BTN_R2);
            const startPressed = buttonJustPressed(introButtons[NAV.GAMEPAD.BTN_START], NAV.GAMEPAD.BTN_START);
            if (startPressed) {
                window.DoorpiIntro.skip?.();
            }
            return;
        }

        if (performance.now() < (window._doorpiIntroInputBlockUntil || 0)) {
            return;
        }

        const isSessionConflict = window.isSessionConflictPopupOpen?.() === true;
        const isEmulatorDiscSelector = window.isEmulatorDiscSelectorOpen?.() === true;
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        const isExecutionLock = !isSessionConflict && launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('execution-lock-visible');
        const isWaitingLaunch = !isSessionConflict && launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('state-loading');
        const isGameFocusFallback = window.isGameFocusFallbackPopupOpen?.() === true;

        if (window.isDoorpiSessionTransitionActive?.()) {
            logDoorpiInputBlock('session-transition');
            return;
        }
        if (window.isGlobalLoading) {
            logDoorpiInputBlock('global-loading');
            return;
        }
        if (!isWaitingLaunch && !isExecutionLock && !isSessionConflict && !isGameFocusFallback && window.isMediaAppActive) {
            logDoorpiInputBlock('media-active');
            return;
        }
        if (!isWaitingLaunch && !isExecutionLock && !isSessionConflict && !isGameFocusFallback && isDoorpiGameInputSuppressed()) {
            logDoorpiInputBlock('game-input-suppressed');
            return;
        }
        if (!document.hasFocus()) {
            logDoorpiInputBlock('document-blur');
            return;
        }

        const { GAMEPAD } = NAV, buttons = gamepad.buttons;
        const thr = GAMEPAD.AXIS_THRESHOLD, now = performance.now();

        if (window.isDoorpiFileBrowserOpen?.() && !isVkbOpenForNavigation()) {
            _currentDirection = null;
            _moveState = 0;
            if (primaryJustPressed(buttons, GAMEPAD))
                window.DoorpiFileBrowser?.activate?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL))
                window.DoorpiFileBrowser?.back?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_START], GAMEPAD.BTN_START))
                window.DoorpiFileBrowser?.confirm?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE))
                window.DoorpiFileBrowser?.context?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_TRIANGLE], GAMEPAD.BTN_TRIANGLE))
                window.DoorpiFileBrowser?.createFolder?.();
            return;
        }

        if (isEmulatorDiscSelector) {
            _currentDirection = null;
            _moveState = 0;
            if (primaryJustPressed(buttons, GAMEPAD)) document.activeElement?.click();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                window.closeEmulatorDiscSelector?.(true);
                window.DoorpiUiSound?.play('back');
            }
            return;
        }

        // As direcoes chegam pelo loop nativo C# como teclas. A/R2 e B, porem,
        // chegam por este snapshot e precisam ignorar completamente o nav-menu.
        if (window.DoorpiProfileSync?.isOpen?.()) {
            _currentDirection = null;
            _moveState = 0;
            if (primaryJustPressed(buttons, GAMEPAD))
                window.DoorpiProfileSync.confirm?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL))
                window.DoorpiProfileSync.back?.();
            return;
        }

        if (window._profilePhotoPickerIsOpen?.() && !isVkbOpenForNavigation()) {
            _currentDirection = null;
            _moveState = 0;
            if (primaryJustPressed(buttons, GAMEPAD))
                window._profilePhotoPickerShortcut?.('confirm');
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL))
                window._profilePhotoPickerShortcut?.('cancel');
            return;
        }

        if (window._artworkWizardIsOpen?.() && !isVkbOpenForNavigation()) {
            _currentDirection = null;
            _moveState = 0;
            if (handleArtworkWizardGamepadShortcuts(buttons)) return;
            if (primaryJustPressed(buttons, GAMEPAD))
                window._artworkWizardShortcut?.('confirm');
            return;
        }

        if (isWaitingLaunch) {
            if (primaryJustPressed(buttons, GAMEPAD)) {
                const btn = document.getElementById('overlayCancelLaunchBtn');
                // O overlay Ã© uma aÃ§Ã£o Ãºnica: o A deve confirmar "Retornar"
                // mesmo se algum foco residual da Home ainda estiver ativo.
                if (btn && btn.style.display !== 'none' && !btn.disabled) {
                    btn.click();
                }
            }
            return;
        }

        if (isExecutionLock) {
            _currentDirection = null;
            _moveState = 0;

            if (primaryJustPressed(buttons, GAMEPAD)) {
                const active = document.activeElement;
                if (active && active.closest?.('#executionLockActions')) active.click();
                else document.getElementById('executionLockRestore')?.click();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE)) document.getElementById('executionLockClose')?.click();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
                document.getElementById('executionLockRestore')?.focus();
            }
            return;
        }

        if (isSessionConflict) {
            let conflictDir = gamepadDirection(gamepad, buttons, Math.max(thr, 0.72));

            if (conflictDir) {
                if (_sessionConflictHeldDir !== conflictDir) {
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

            if (primaryJustPressed(buttons, GAMEPAD)) {
                window.activateSessionConflictPopup?.();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                window.cancelSessionConflictPopup?.();
            }
            return;
        }

        _sessionConflictHeldDir = null;

        if (isGameFocusFallback) {
            let fallbackDir = gamepadDirection(gamepad, buttons, Math.max(thr, 0.72));

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

            if (primaryJustPressed(buttons, GAMEPAD)) {
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

        let dir = gamepadDirection(gamepad, buttons, thr);

        if (dir) {
            window._gpNavigating = true;
            if (_gpNavigatingTimeout) clearTimeout(_gpNavigatingTimeout);
            _gpNavigatingTimeout = setTimeout(() => {
                window._gpNavigating = false;
            }, NAV.GAMEPAD.REPEAT_DELAY + 50);
        }
        if (isCtxMenuOpen) {
            _currentDirection = null;
            _moveState = 0;
            if (primaryJustPressed(buttons, GAMEPAD)) {
                document.activeElement?.click();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                closeCtxMenu();
                window.DoorpiUiSound?.play('back');
            }
            return;
        }

        if (window.isDesktopWarningOpen) {
            if (primaryJustPressed(buttons, GAMEPAD)) window._dwAction?.('CONFIRM');
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
                window._dwAction?.('CANCEL');
            }
            return;
        }
        // -------------------------------

        if (window.isDoorpiOverlayOpen?.() && !isVkbOpenForNavigation()) {
            if (primaryJustPressed(buttons, GAMEPAD)) {
                if (window.DoorpiQuickPanel?.confirm?.()) return;
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
            if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE)) {
                triggerContextMenu();
            }
            return;
        }

        if (window.isNavMenuOpen) {
            if (!isVkbOpenForNavigation()) {
                if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) {
                    if (handleArtworkWizardGamepadShortcuts(buttons)) return;
                    if (primaryJustPressed(buttons, GAMEPAD)) {
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
                        if (window._artworkWizardClose?.()) return;
                        window._editModalClose?.();
                    }
                    return;
                }
                else if (isCtxMenuOpen) {
                    if (primaryJustPressed(buttons, GAMEPAD)) document.activeElement?.click();
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                        if (window.requestDoorpiBackAction?.()) return;
                        closeCtxMenu();
                    }
                    return;
                }
                else {
                    if (primaryJustPressed(buttons, GAMEPAD)) window._navMenuHandleKey?.('Enter');
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

        if (isVkbOpenForNavigation()) {
            // O D-pad já chega como pulsos Arrow* pelo navegador nativo. Ler os
            // mesmos botões novamente pelo Gamepad API fazia cada direção andar
            // duas vezes. Este loop fica responsável somente pelo analógico.
            const vkbAnalogDir = axisDirection(gamepad, thr);
            if (vkbAnalogDir && vkbAnalogDir !== _currentDirection) {
                _currentDirection = vkbAnalogDir;
                _controlsDirectionStartedAt = now;
                _controlsDirectionLastMoveAt = now;
                moveFocus(vkbAnalogDir);
            } else if (vkbAnalogDir &&
                       now - _controlsDirectionStartedAt >= GAMEPAD.INITIAL_DELAY &&
                       now - _controlsDirectionLastMoveAt >= GAMEPAD.REPEAT_DELAY) {
                _controlsDirectionLastMoveAt = now;
                moveFocus(vkbAnalogDir);
            } else if (!vkbAnalogDir) {
                _currentDirection = null;
                _controlsDirectionStartedAt = 0;
                _controlsDirectionLastMoveAt = 0;
            }
            if (primaryJustPressed(buttons, GAMEPAD)) document.activeElement?.click();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
                window._vkbCancel?.();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_START], GAMEPAD.BTN_START)) window._vkbConfirm?.();

            [['l1', GAMEPAD.BTN_L1, -1], ['r1', GAMEPAD.BTN_R1, 1]].forEach(([id, idx, val]) => {
                const pressed = buttons[idx]?.pressed;
                if (pressed) {
                    if (_cursorHoldState[id] === 0) { window._vkbMoveCursor?.(val); _cursorLastTime[id] = now; _cursorHoldState[id] = 1; }
                    else if (_cursorHoldState[id] === 1 && now - _cursorLastTime[id] > GAMEPAD.INITIAL_DELAY) { window._vkbMoveCursor?.(val); _cursorLastTime[id] = now; _cursorHoldState[id] = 2; }
                    else if (_cursorHoldState[id] === 2 && now - _cursorLastTime[id] > GAMEPAD.REPEAT_DELAY) { window._vkbMoveCursor?.(val); _cursorLastTime[id] = now; }
                } else { _cursorHoldState[id] = 0; }
            });

            if (buttonJustPressed(buttons[GAMEPAD.BTN_L3], GAMEPAD.BTN_L3)) window._vkbToggleShift?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_L2], GAMEPAD.BTN_L2)) window._vkbToggleLayer?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_TRIANGLE], GAMEPAD.BTN_TRIANGLE)) window._vkbPhysicalKey?.(' ');

            const sqPressed = buttons[GAMEPAD.BTN_SQUARE]?.pressed;
            if (sqPressed) {
                if (_cursorHoldState['sq'] === 0) { window._vkbPhysicalKey?.('Backspace'); _cursorLastTime['sq'] = now; _cursorHoldState['sq'] = 1; }
                else if (_cursorHoldState['sq'] === 1 && now - _cursorLastTime['sq'] > GAMEPAD.INITIAL_DELAY) { window._vkbPhysicalKey?.('Backspace'); _cursorLastTime['sq'] = now; _cursorHoldState['sq'] = 2; }
                else if (_cursorHoldState['sq'] === 2 && now - _cursorLastTime['sq'] > GAMEPAD.REPEAT_DELAY) { window._vkbPhysicalKey?.('Backspace'); _cursorLastTime['sq'] = now; }
            } else { _cursorHoldState['sq'] = 0; }
            return;
        }

        if (handleArtworkWizardGamepadShortcuts(buttons)) return;

        // Botões de ação globais
        if (primaryJustPressed(buttons, GAMEPAD)) {
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
            if (window.closeEmulatorContextMenu?.()) return;
            if (window.isDoorpiOverlayOpen?.()) {
                if (!canCloseProfileSelection()) return;
                window.closeDoorpiTopOverlay?.();
                return;
            }

            // 2. Senão, trata os outros menus normalmente
            if (isCtxMenuOpen) closeCtxMenu();
            else if (isEditModalOpen) window._editModalClose?.();
            else if (isSetupOpen) {
                const backToAuth = document.getElementById('btnSetupBackAuth');
                const cancelBtn = document.getElementById('btnSetupCancel');
                if (backToAuth?.classList.contains('visible') && typeof setupBack === 'function') setupBack();
                else if (cancelBtn && cancelBtn.style.display !== 'none') cancelBtn.click();
            }
            else if (isModalOpen) closeModal?.(); // Fecha Add Jogo/App
            else gamepadCancel();
        }
        if (buttonJustPressed(buttons[GAMEPAD.BTN_START], GAMEPAD.BTN_START)) {
            if (isModalOpen) {
                const activeView = document.querySelector('#addGameContainer .view-section.active');
                if (activeView?.id === 'view-media-apps') {
                    if (document.getElementById('subview-web')?.classList.contains('active')) document.getElementById('btnAddWebApp')?.click();
                    else document.getElementById('btnConfirmAddMedia')?.click();
                } else if (activeView?.id === 'view-folders') {
                    document.getElementById('btnScanFolder')?.click();
                } else if (activeView?.id === 'view-emulators') {
                    window.advanceEmulatorSetup?.();
                } else {
                    document.getElementById('btnConfirmAdd')?.click();
                }
            }
            else gamepadStart();
        }
        if (buttonJustPressed(buttons[GAMEPAD.BTN_TRIANGLE], GAMEPAD.BTN_TRIANGLE)) {
            if (window.toggleHomeTrailerFullscreen?.() !== true)
                gamepadTriangle();
        }
        if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE)) {
            if (window.isStoreSessionMenuOpen?.()) {
                window.hideStoreSessionMenu?.();
                if (typeof postToHost === 'function') postToHost({ action: 'closeStore' });
            }
            else if (window.openFocusedEmulatorContextMenu?.()) { }
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
    refreshGamepadPresence();
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


