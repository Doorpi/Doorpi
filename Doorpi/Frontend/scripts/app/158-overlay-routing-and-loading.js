    window.isDoorpiOverlayOpen = function () {
        return Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay, .doorpi-pin-panel, .doorpi-update-prompt.is-visible, .profile-sync-overlay'))
            .some(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
    };

    document.addEventListener('focusin', (e) => {
        if (window.isSessionConflictPopupOpen?.()) {
            const conflictOverlay = document.getElementById('sessionConflictOverlay');
            if (conflictOverlay && !conflictOverlay.contains(e.target)) {
                e.stopImmediatePropagation();
                queueMicrotask(() => document.getElementById('sessionConflictClose')?.focus());
            }
            return;
        }
        const executionOverlay = document.getElementById('gameLaunchOverlay');
        if (executionOverlay?.classList.contains('visible') &&
            executionOverlay.classList.contains('execution-lock-visible')) {
            if (!executionOverlay.contains(e.target)) {
                e.stopImmediatePropagation();
                queueMicrotask(() => GameLaunchOverlay.focusExecutionLockActions?.());
            }
            return;
        }
        if (e.target?.closest?.('.vkb-overlay, .doorpi-vkb-overlay, .context-menu.visible')) return;
        if (window.isDoorpiOverlayOpen && window.isDoorpiOverlayOpen()) {
            const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay, .doorpi-pin-panel, .doorpi-update-prompt.is-visible, .profile-sync-overlay'))
                .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
            const topOverlay = overlays.at(-1);

            if (topOverlay && !topOverlay.contains(e.target)) {
                const focusable = topOverlay.querySelector('button, input, select,[tabindex="0"]');
                if (focusable) {
                    focusable.focus();
                }
            }
        }
    });

    window.getDoorpiOverlayItems = function () {
        const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay, .doorpi-pin-panel, .profile-sync-overlay'))
            .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
        const top = overlays.at(-1);
        if (!top) return [];
        return Array.from(top.querySelectorAll('button, input, select, [tabindex="0"]'))
            .filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);
    };

    window.closeDoorpiTopOverlay = function (force = false) {
        const overlays = Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay, .doorpi-pin-panel, .profile-sync-overlay'))
            .filter(el => el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
        const top = overlays.at(-1);
        if (top?.id === 'emulatorDiscSelector') {
            window.closeEmulatorDiscSelector(true);
            return;
        }
        if (!force && top?.dataset.required === 'true') return;
        if (top) {
            if (top.classList.contains('profile-sync-overlay')) {
                window.DoorpiProfileSync?.close?.();
                return;
            }
            if (top.id === 'doorpiQuickPanel' && window.DoorpiQuickPanel?.back && !force) {
                window.DoorpiQuickPanel.back();
                return;
            }
            if (top.id === 'doorpiQuickPanel' && window.DoorpiQuickPanel?.close) {
                window.DoorpiQuickPanel.close();
                return;
            }
            top.style.display = 'none';
            if (top.id === 'doorpiUserPicker') {
                document.body.classList.remove('user-picker-open');
                window.DoorpiIntro?.finishHandoff?.();
            }
        }
    };

    document.addEventListener('click', (e) => {
        const input = e.target.closest?.('input[type="text"], input:not([type]), textarea');
        if (!input) return;
        if (window._vkbIsOpen) return;
        if (input.closest('.doorpi-manager-overlay, .doorpi-user-overlay, .edit-modal-overlay, .artwork-wizard-overlay, #addGameContainer, #setupContainer, .nav-profile-dashboard')) {
            input.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(e)) return;
            window._vkbOpen?.(input);
        }
    }, true);

    /* Seção: Overlay de Loading */
    function showGlobalLoading(titleText, subtitleText) {
        window.isGlobalLoading = true;
        window.updateNavHint?.();
        let overlay = document.getElementById('globalLoadingOverlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'globalLoadingOverlay';
            overlay.className = 'global-loading-overlay';
            document.querySelector('.modal-content-area').appendChild(overlay);
        }

        const libs = SCAN_LIBS.map((k, i) => `<div class="vb-lib ${i === 0 ? 'scanning' : ''}">${t('scanLibLabels.' + k)}</div>`).join('');

        overlay.innerHTML = `
            <div class="vb-wrap">
                <div class="vb-scanline"></div>
                <div class="vb-ghost-grid">${'<div class="vb-ghost-tile"></div>'.repeat(15)}</div>
                <div class="vb-center">
                    <div class="vb-ring-wrap">
                        <div class="vb-ring outer"></div>
                        <div class="vb-ring inner"></div>
                        <div class="vb-ring core"></div>
                        <div class="vb-ring-dot"></div>
                    </div>
                    <div class="vb-text">
                        <div class="vb-title">${titleText || t('detectingLibrary')}</div>
                        <div class="vb-subtitle">${subtitleText || t('readingApps')}</div>
                        <div class="vb-dots"><span></span><span></span><span></span></div>
                        <div class="vb-libs" id="vbLibsGlobal">${libs}</div>
                    </div>
                </div>
                <div class="vb-progress"><div class="vb-progress-fill"></div></div>
            </div>`;

        overlay.style.display = 'flex';

        if (overlay._iv) clearInterval(overlay._iv);
        let cur = 0;
        const libEls = overlay.querySelectorAll('#vbLibsGlobal .vb-lib');
        overlay._iv = setInterval(() => {
            if (overlay.style.display === 'none') { clearInterval(overlay._iv); return; }
            libEls.forEach(l => l.classList.remove('scanning'));
            if (libEls[cur]) libEls[cur].classList.add('scanning');
            cur = (cur + 1) % libEls.length;
        }, 700);
    }

    function hideGlobalLoading() {
        window.isGlobalLoading = false;
        const overlay = document.getElementById('globalLoadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            if (overlay._iv) clearInterval(overlay._iv);
        }
        window.updateNavHint?.();

        setTimeout(() => {
            if (!window.isModalOpen && !window.isSetupOpen && !window._vkbIsOpen && !window.isDoorpiOverlayOpen?.()) {
                const currentTab = (typeof window.getCurrentHomeTab === 'function') ? window.getCurrentHomeTab() : 'games';
                const grid = document.getElementById(currentTab === 'media' ? 'mediaGrid' : 'gameGrid');
                if (grid) {
                    window.syncFeaturedCardArt?.(grid);
                    const target = grid.querySelector('.card.featured') || grid.querySelector('.card:not(.add-card)') || grid.querySelector('.card.add-card');
                    if (target) target.focus();
                }
            }
        }, 80);
    }

    /* Seção: Utilitários de atualização de imagens */
    function updateToLocalFile(gameId, imageType, newUrl) {
        const safeId = gameId.replace(/\\/g, '\\\\');
        const card = document.querySelector(`.card[data-game-id="${safeId}"]`)
            ?? document.querySelector(`.card[data-app-id="${safeId}"]`);
        if (!card) return;
        const keyMap = { GridStatic: 'staticVertical', HorizontalStatic: 'staticHorizontal', HeroStatic: 'staticHero', LogoStatic: 'staticLogo' };
        const key = keyMap[imageType];
        if (!key) return;

        card.dataset[key] = newUrl;
        const img = card.querySelector('img');
        const isFeatured = card.classList.contains('featured');

        if (img && document.activeElement !== card && !card.matches(':hover')) {
            if ((isFeatured && key === 'staticHorizontal') || (!isFeatured && key === 'staticVertical')) {
                img.src = newUrl;
                img.style.opacity = '1';
            }
        }
        if ((key === 'staticHorizontal' || key === 'staticVertical') && document.activeElement !== card && !card.matches(':hover')) {
            window.syncFeaturedCardArt?.(card.closest('#gameGrid, #mediaGrid') || document);
        }
        if (isFeatured && key === 'staticHero') switchHeroBackground(newUrl, card.dataset.staticLogo || card.dataset.logo);
    }

