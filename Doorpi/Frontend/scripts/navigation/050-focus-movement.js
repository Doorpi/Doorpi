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

