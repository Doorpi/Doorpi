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

