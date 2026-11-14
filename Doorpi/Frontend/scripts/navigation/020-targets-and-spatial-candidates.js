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

        return Array.from(document.querySelectorAll('.edit-modal-input, .edit-category-option, .edit-artwork-btn, .doorpi-choice-trigger, .doorpi-choice-option, #editSharingBtn, #editExtensionsBtn, .edit-toggle-row, .edit-modal-actions button'))
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

