// =============================================================================
// navigation.js — Input & Navegação
// Teclado, gamepad, scroll, foco espacial e idle.
// Não conhece cards, hero nem modal — só pergunta "quem está focado, pra onde vai".
//
// Estado compartilhado com app.js (declarado aqui por ser carregado primeiro):
//   isModalOpen            — app.js escreve ao abrir/fechar modal
//   pendingInteractionCard — app.js escreve quando um card recebe foco
//   isGamepadConnected     — leitura pública para qualquer módulo
// =============================================================================

// ── Estado compartilhado ───────────────────────────────────────────────────────
let isModalOpen = false;
let pendingInteractionCard = null;
let isGamepadConnected = false;

// ── Constantes de input ────────────────────────────────────────────────────────
const NAV = {
    IDLE_MS: 180,
    SCROLL_DURATION: 300,
    WHEEL_MULTIPLIER: 1.2,

    GAMEPAD: {
        AXIS_THRESHOLD: 0.6,
        INITIAL_DELAY: 400,
        REPEAT_DELAY: 80,

        // Índices padrão Gamepad API
        BTN_CONFIRM: 0,   // ✕ Cross  / A
        BTN_CANCEL: 1,   // ◯ Circle / B  → fecha modal
        BTN_SQUARE: 2,   // □ Square / X  (reservado)
        BTN_TRIANGLE: 3,   // △ Triangle / Y → busca manual
        BTN_START: 9,   // OPTIONS / Menu → confirma adição (ou abre modal)

        BTN_UP: 12,
        BTN_DOWN: 13,
        BTN_LEFT: 14,
        BTN_RIGHT: 15,
    },

    KEYS: {
        UP: 'ArrowUp',
        DOWN: 'ArrowDown',
        LEFT: 'ArrowLeft',
        RIGHT: 'ArrowRight',
        CONFIRM: 'Enter',
        CANCEL: 'Escape',
    },
};

// ── Ícones de controle ─────────────────────────────────────────────────────────
// Cada chave corresponde a um data-gamepad-hint no HTML.
// O HTML gerado usa classes CSS definidas no index.html (<style>).
const GAMEPAD_ICONS = {
    ps: {
        confirm: `<span class="gp-btn gp-cross">✕</span>`,
        cancel: `<span class="gp-btn gp-circle">◯</span>`,
        triangle: `<span class="gp-btn gp-triangle">△</span>`,
        start: `<span class="gp-btn gp-options">≡</span>`,
    },
    xbox: {
        confirm: `<span class="gp-btn gp-a">A</span>`,
        cancel: `<span class="gp-btn gp-b">B</span>`,
        triangle: `<span class="gp-btn gp-y">Y</span>`,
        start: `<span class="gp-btn gp-menu">☰</span>`,
    },
};
GAMEPAD_ICONS.generic = GAMEPAD_ICONS.ps; // fallback para controles desconhecidos

// Detecta se o controle é PlayStation ou Xbox pelo id reportado pelo navegador
function detectControllerType(gamepad) {
    if (!gamepad) return 'generic';
    const id = gamepad.id.toLowerCase();
    if (id.includes('playstation') || id.includes('dualshock') ||
        id.includes('dualsense') || id.includes('054c')) return 'ps';
    if (id.includes('xbox') || id.includes('xinput') ||
        id.includes('045e')) return 'xbox';
    return 'generic';
}

// Atualiza TODA a UI relacionada ao controle:
//   • Botões com data-gamepad-hint recebem/perdem o ícone do botão
//   • O card btnAdd troca o "+" pelo ícone de START/OPTIONS
function updateGamepadUI(connected, type = 'generic') {
    const icons = GAMEPAD_ICONS[type] ?? GAMEPAD_ICONS.generic;

    // ── Botões com data-gamepad-hint ──────────────────────────────────────────
    // O atributo no HTML indica qual ação mapeia aquele botão.
    // Exemplos: data-gamepad-hint="start"  data-gamepad-hint="cancel"
    document.querySelectorAll('[data-gamepad-hint]').forEach(el => {
        el.querySelector('.gp-hint')?.remove(); // limpa ícone anterior
        if (connected) {
            const action = el.dataset.gamepadHint;
            const iconHtml = icons[action];
            if (iconHtml) {
                const hint = document.createElement('span');
                hint.className = 'gp-hint';
                hint.innerHTML = iconHtml;
                hint.setAttribute('aria-hidden', 'true');
                el.prepend(hint);
            }
        }
    });

    // ── Card btnAdd — troca "+" por ícone de START ────────────────────────────
    const plusEl = document.querySelector('#btnAdd .plus');
    if (plusEl) {
        if (connected) {
            // Exibe o ícone do botão que dispara a ação (START/OPTIONS/Menu)
            plusEl.innerHTML = icons.start;
            plusEl.classList.add('is-gamepad');
        } else {
            plusEl.innerHTML = '+';
            plusEl.classList.remove('is-gamepad');
        }
    }
}

// ── Idle navigation ────────────────────────────────────────────────────────────
let _navIdleTimeout = null;

function signalNavigation() {
    if (_navIdleTimeout) clearTimeout(_navIdleTimeout);
    _navIdleTimeout = setTimeout(() => {
        if (pendingInteractionCard) {
            const card = pendingInteractionCard;
            pendingInteractionCard = null;
            if (document.activeElement === card || card.matches(':hover'))
                card._startInteraction?.();
        }
    }, NAV.IDLE_MS);
}

// ── Grupos navegáveis ──────────────────────────────────────────────────────────
function getModalGroups() {
    return {
        sidebar: Array.from(document.querySelectorAll('.sidebar-menu .menu-tab')),
        filters: Array.from(document.querySelectorAll('.filter-bar .filter-btn')),
        apps: Array.from(document.querySelectorAll('#appList .app-item:not(.already-added)')),
        actions: Array.from(document.querySelectorAll('#modalActions button')),
    };
}

function getNavigableItems() {
    if (!isModalOpen)
        return Array.from(document.getElementById('gameGrid').querySelectorAll("[tabindex='0']"));
    const { sidebar, filters, apps, actions } = getModalGroups();
    return [...sidebar, ...filters, ...apps, ...actions];
}

// ── Navegação espacial ─────────────────────────────────────────────────────────
function findSpatialCandidate(items, current, direction) {
    const cr = current.getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    let best = null, bestDist = Infinity;

    items.forEach(item => {
        if (item === current) return;
        const r = item.getBoundingClientRect();
        const icx = r.left + r.width / 2;
        const icy = r.top + r.height / 2;
        let valid = false, dist = 0, overlap = 0;

        switch (direction) {
            case 'RIGHT': valid = icx > cx; dist = icx - cx; overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top); break;
            case 'LEFT': valid = icx < cx; dist = cx - icx; overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top); break;
            case 'DOWN': valid = icy > cy; dist = icy - cy; overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left); break;
            case 'UP': valid = icy < cy; dist = cy - icy; overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left); break;
        }
        if (valid && overlap > 0 && dist < bestDist) { bestDist = dist; best = item; }
    });
    return best;
}

function findWrapCandidate(items, current, direction) {
    const cr = current.getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    let best = null, maxDist = -1;

    items.forEach(item => {
        if (item === current) return;
        const r = item.getBoundingClientRect();
        const icx = r.left + r.width / 2;
        const icy = r.top + r.height / 2;
        let opp = false, dist = 0, overlap = 0;

        switch (direction) {
            case 'RIGHT': opp = icx < cx; dist = cx - icx; overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top); break;
            case 'LEFT': opp = icx > cx; dist = icx - cx; overlap = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top); break;
            case 'DOWN': opp = icy < cy; dist = cy - icy; overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left); break;
            case 'UP': opp = icy > cy; dist = icy - cy; overlap = Math.min(cr.right, r.right) - Math.max(cr.left, r.left); break;
        }
        if (opp && overlap > 0 && dist > maxDist) { maxDist = dist; best = item; }
    });
    return best;
}

// ── Transições entre grupos do modal ──────────────────────────────────────────
let _lastFocusedApp = null;
let _lastFocusedFilter = null;
let _lastFocusedSidebar = null;

function getGroupTransition(direction, groupName, { sidebar, filters, apps, actions }) {
    const bestApp = () => (_lastFocusedApp && apps.includes(_lastFocusedApp)) ? _lastFocusedApp : apps[0] || null;
    const bestFilter = () => (_lastFocusedFilter && filters.includes(_lastFocusedFilter)) ? _lastFocusedFilter : filters.find(el => el.classList.contains('active')) || filters[0] || null;
    const bestSidebar = () => (_lastFocusedSidebar && sidebar.includes(_lastFocusedSidebar)) ? _lastFocusedSidebar : sidebar.find(el => el.classList.contains('active')) || sidebar[0] || null;

    if (groupName === 'app') {
        if (direction === 'DOWN' || direction === 'RIGHT') return actions[0] ?? null;
        if (direction === 'LEFT') return bestSidebar();
        if (direction === 'UP') return bestFilter();
    }
    if (groupName === 'action') {
        if (direction === 'LEFT' || direction === 'UP') return _lastFocusedApp && apps.includes(_lastFocusedApp) ? _lastFocusedApp : apps[apps.length - 1] || null;
    }
    if (groupName === 'filter') {
        if (direction === 'DOWN') return bestApp();
        if (direction === 'LEFT') return bestSidebar();
        if (direction === 'RIGHT') return bestApp();
    }
    if (groupName === 'sidebar') {
        if (direction === 'RIGHT') return bestFilter() || bestApp();
    }
    return null;
}

// ── Ações especiais do controle ────────────────────────────────────────────────

/** ◯ Circle / B — fecha o modal se estiver aberto */
function gamepadCancel() {
    if (isModalOpen) closeModal?.();
}

/**
 * START / OPTIONS — dentro do modal confirma a adição dos selecionados;
 * fora do modal abre o próprio modal (mesmo comportamento do btnAdd).
 */
function gamepadStart() {
    if (isModalOpen) document.getElementById('btnConfirmAdd')?.click();
    else document.getElementById('btnAdd')?.click();
}

/** △ Triangle / Y — busca manual de executável (apenas com modal aberto) */
function gamepadTriangle() {
    if (isModalOpen) document.getElementById('btnSearch')?.click();
}

// ── moveFocus ──────────────────────────────────────────────────────────────────
function moveFocus(direction) {
    const items = getNavigableItems();
    if (!items.length) return;

    const current = document.activeElement;
    if (!items.includes(current)) { items[0].focus(); return; }

    if (!isModalOpen) {
        let target = findSpatialCandidate(items, current, direction);
        if (!target) {
            if (direction === 'RIGHT') target = items[0];
            else if (direction === 'LEFT') target = items[items.length - 1];
            else target = findWrapCandidate(items, current, direction);
        }
        if (target) {
            current._stopInteraction?.();
            cancelHeroTransition?.();
            pendingInteractionCard = null;
            target.focus();
            smoothHorizontalScroll(target, () => {
                if (document.activeElement === target || target.matches(':hover'))
                    target._startInteraction?.();
            });
        }
        return;
    }

    const groups = getModalGroups();
    const { sidebar, filters, apps } = groups;

    let groupName, groupItems;
    if (current.classList.contains('menu-tab')) { groupName = 'sidebar'; groupItems = sidebar; }
    else if (current.classList.contains('filter-btn')) { groupName = 'filter'; groupItems = filters; }
    else if (current.classList.contains('app-item')) { groupName = 'app'; groupItems = apps; }
    else { groupName = 'action'; groupItems = groups.actions; }

    if (groupName === 'app') _lastFocusedApp = current;
    if (groupName === 'filter') _lastFocusedFilter = current;
    if (groupName === 'sidebar') _lastFocusedSidebar = current;

    let target = findSpatialCandidate(groupItems, current, direction);
    if (!target) target = getGroupTransition(direction, groupName, groups);
    if (!target) target = findWrapCandidate(groupItems, current, direction);

    if (target) {
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

// ── Scroll suave horizontal ────────────────────────────────────────────────────
function smoothHorizontalScroll(element, onDone) {
    if (isModalOpen) { onDone?.(); return; }
    const grid = document.getElementById('gameGrid');
    const gr = grid.getBoundingClientRect();
    const er = element.getBoundingClientRect();
    const TOL = 2;

    const visL = er.left >= gr.left - TOL;
    const visR = er.right <= gr.right + TOL;
    if (visL && visR) { onDone?.(); return; }

    let target = !visR
        ? grid.scrollLeft + (er.left - gr.left)
        : grid.scrollLeft + (er.right - gr.right);
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

// ── Scroll de mouse ────────────────────────────────────────────────────────────
document.getElementById('gameGrid').addEventListener('wheel', e => {
    if (isModalOpen) return;
    e.preventDefault();
    document.getElementById('gameGrid').scrollLeft += e.deltaY * NAV.WHEEL_MULTIPLIER;
}, { passive: false });

// ── Teclado ────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    const dirMap = {
        [NAV.KEYS.RIGHT]: 'RIGHT',
        [NAV.KEYS.LEFT]: 'LEFT',
        [NAV.KEYS.DOWN]: 'DOWN',
        [NAV.KEYS.UP]: 'UP',
    };
    if (dirMap[e.key]) { e.preventDefault(); moveFocus(dirMap[e.key]); return; }
    if (e.key === NAV.KEYS.CONFIRM) { e.preventDefault(); document.activeElement?.click(); return; }
    if (e.key === NAV.KEYS.CANCEL) { e.preventDefault(); gamepadCancel(); }
});

// ── Gamepad ────────────────────────────────────────────────────────────────────
let _gamepadIndex = null;
let _controllerType = 'generic';
let _btnCooldown = {}; 
let _lastMoveTime = 0;
let _moveState = 0;
let _currentDirection = null;


function buttonJustPressed(btn, index) {
    if (btn?.pressed) {
        if (!_btnCooldown[index]) { _btnCooldown[index] = true; return true; }
        return false;
    }
    _btnCooldown[index] = false;
    return false;
}

window.addEventListener('gamepadconnected', e => {
    _gamepadIndex = e.gamepad.index;
    _controllerType = detectControllerType(e.gamepad);
    isGamepadConnected = true;
    updateGamepadUI(true, _controllerType);
});

window.addEventListener('gamepaddisconnected', e => {
    if (e.gamepad.index !== _gamepadIndex) return;
    _gamepadIndex = null;
    isGamepadConnected = false;
    updateGamepadUI(false, _controllerType);

    const pads = navigator.getGamepads();
    for (const pad of pads) {
        if (pad) {
            _gamepadIndex = pad.index;
            _controllerType = detectControllerType(pad);
            isGamepadConnected = true;
            updateGamepadUI(true, _controllerType);
            break;
        }
    }
});

(function gamepadLoop() {
    const gamepad = _gamepadIndex !== null ? navigator.getGamepads()[_gamepadIndex] : null;
    if (!gamepad) { requestAnimationFrame(gamepadLoop); return; }

    const items = getNavigableItems();
    if (!items.length) { requestAnimationFrame(gamepadLoop); return; }
    if (!items.includes(document.activeElement)) { focusItemByIndex(0); requestAnimationFrame(gamepadLoop); return; }

    const { GAMEPAD } = NAV;
    const buttons = gamepad.buttons;
    const ax = gamepad.axes[0];
    const ay = gamepad.axes[1];
    const thr = GAMEPAD.AXIS_THRESHOLD;
    const now = performance.now();

    // ── Direcionais (movimento contínuo com repetição) ────────────────────────
    let dir = null;
    if (ax > thr || buttons[GAMEPAD.BTN_RIGHT]?.pressed) dir = 'RIGHT';
    else if (ax < -thr || buttons[GAMEPAD.BTN_LEFT]?.pressed) dir = 'LEFT';
    else if (ay > thr || buttons[GAMEPAD.BTN_DOWN]?.pressed) dir = 'DOWN';
    else if (ay < -thr || buttons[GAMEPAD.BTN_UP]?.pressed) dir = 'UP';

    if (dir) {
        if (dir !== _currentDirection) { moveFocus(dir); _lastMoveTime = now; _moveState = 1; _currentDirection = dir; }
        else if (_moveState === 1 && now - _lastMoveTime > GAMEPAD.INITIAL_DELAY) { moveFocus(dir); _lastMoveTime = now; _moveState = 2; }
        else if (_moveState === 2 && now - _lastMoveTime > GAMEPAD.REPEAT_DELAY) { moveFocus(dir); _lastMoveTime = now; }
    } else {
        _moveState = 0; _currentDirection = null;
    }

    // ── Botões de ação (disparo único por pressão) ────────────────────────────
    if (buttonJustPressed(buttons[GAMEPAD.BTN_CONFIRM], GAMEPAD.BTN_CONFIRM)) document.activeElement?.click();
    if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) gamepadCancel();
    if (buttonJustPressed(buttons[GAMEPAD.BTN_START], GAMEPAD.BTN_START)) gamepadStart();
    if (buttonJustPressed(buttons[GAMEPAD.BTN_TRIANGLE], GAMEPAD.BTN_TRIANGLE)) gamepadTriangle();

    requestAnimationFrame(gamepadLoop);
})();

window.addEventListener('load', () => {
    // Detecta controles já conectados antes do primeiro evento 'gamepadconnected'
    const pads = navigator.getGamepads();
    for (const pad of pads) {
        if (pad) {
            _gamepadIndex = pad.index;
            _controllerType = detectControllerType(pad);
            isGamepadConnected = true;
            updateGamepadUI(true, _controllerType);
            break;
        }
    }
    setTimeout(() => focusItemByIndex(0), 300);
});
// ── Cursor automático ──────────────────────────────────────────────────────────

const CURSOR_IDLE_MS = 3000;
let _cursorIdleTimeout = null;

function showCursor() {
    document.body.style.cursor = '';
    if (_cursorIdleTimeout) clearTimeout(_cursorIdleTimeout);
    _cursorIdleTimeout = setTimeout(hideCursor, CURSOR_IDLE_MS);
}

function hideCursor() {
    document.body.style.cursor = 'none';
}

document.addEventListener('mousemove', showCursor);


hideCursor();