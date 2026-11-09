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

