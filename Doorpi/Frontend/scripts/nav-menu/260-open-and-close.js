    // ── Abrir / Fechar ────────────────────────────────────────────────────────
    async function open(startIdx = 0) {
        if (window.isDoorpiUpdatePromptOpen?.() || document.querySelector('.doorpi-update-prompt.is-visible')) return;
        if (window.isDoorpiOverlayOpen?.() || window.isModalOpen || window.isSetupOpen || window._vkbIsOpen) return;
        if (window.isNavMenuOpen || _navMenuPhase !== 'closed' || window.isDoorpiSessionTransitionActive?.()) return;
        const requestedIdx = Number(startIdx);
        if (arguments.length > 0 && Number.isFinite(requestedIdx)) {
            _catIdx = Math.max(0, Math.min(CATS.length - 1, requestedIdx));
        }
        const lifecycleToken = ++_navMenuLifecycleToken;
        window.isNavMenuOpen = true;
        _navMenuPhase = 'opening';
        window._navMenuPhase = _navMenuPhase;

        document.body.classList.add('nav-menu-active');
        document.body.classList.remove('nav-menu-closing');

        const topProf = document.getElementById('btnTopProfile');
        if (topProf) topProf.classList.add('nav-menu-hidden');

        _lastFocus = document.activeElement;
        window.pauseDoorpiArtworkForTransition?.(_lastFocus);

        _buildOverlay();
        _overlay.classList.remove('nav-menu-input-released');
        _overlay.style.display = 'flex';
        window.updateNavHint?.();
        await _loadJSONs();
        if (lifecycleToken !== _navMenuLifecycleToken || !window.isNavMenuOpen || _navMenuPhase !== 'opening') return;

        const body = document.getElementById('navContentBody');
        if (body) {
            const initialPane = CATS[_catIdx]?.id === 'media' ? 'media' : 'games';
            _attachDualPane(body);
            _applyPaneVisibility(initialPane);
            await Promise.race([
                _warmDualPaneInitialPages(),
                new Promise(resolve => setTimeout(resolve, 90))
            ]);
        }
        if (lifecycleToken !== _navMenuLifecycleToken || !window.isNavMenuOpen || _navMenuPhase !== 'opening') return;

        requestAnimationFrame(() => {
            if (lifecycleToken !== _navMenuLifecycleToken || !window.isNavMenuOpen || _navMenuPhase !== 'opening') return;
            _runNavMenuTransition(() => {
                if (lifecycleToken === _navMenuLifecycleToken && window.isNavMenuOpen && _navMenuPhase === 'opening') {
                    _navMenuPhase = 'open';
                    window._navMenuPhase = _navMenuPhase;
                }
            });
            _overlay.classList.add('visible');
            _selectCat(_catIdx);
        });
    }

    function close() {
        if (!window.isNavMenuOpen || _navMenuPhase === 'closing') return;
        _clearProfileOverviewCarousel();
        _stopLibraryDirectionHold({ settle: false });
        if (_settingsSubView === 'bluetooth' && _bluetoothUpdateStatus?.discovering)
            postToHost?.({ action: 'stopBluetoothDiscovery' });
        if (_settingsSubView === 'sound') window.DoorpiSoundUI?.closeDrawer?.('settings');
        if (document.querySelector('.context-menu.visible')) window._ctxMenuClose?.();
        const lifecycleToken = ++_navMenuLifecycleToken;
        _navMenuPhase = 'closing';
        window._navMenuPhase = _navMenuPhase;

        document.body.classList.remove('nav-menu-active');
        document.body.classList.add('nav-menu-closing');
        
        const topProf = document.getElementById('btnTopProfile');
        if (topProf) topProf.classList.remove('nav-menu-hidden');

        _overlay?.classList.add('nav-menu-input-released');

        _runNavMenuTransition(() => {
            if (lifecycleToken !== _navMenuLifecycleToken || _navMenuPhase !== 'closing') return;
            if (_overlay) _overlay.style.display = 'none';
            document.body.classList.remove('nav-menu-closing');
            _overlay?.classList.remove('nav-menu-input-released');
            _releaseNavMenuInput(lifecycleToken);
            _navMenuPhase = 'closed';
            window._navMenuPhase = _navMenuPhase;
            window.resumeDoorpiArtworkAfterTransition?.(_lastFocus);
        });
        _overlay?.classList.remove('visible');
    }

