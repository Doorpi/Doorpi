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

