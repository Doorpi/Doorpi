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

