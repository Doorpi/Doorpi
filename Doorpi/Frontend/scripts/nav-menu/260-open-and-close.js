    // Prepare only the initial games viewport, behind Entrando. No focus,
    // history/settings reads, inactive app grid or remaining card batches.
    window.prepareDoorpiNavMenuEntry = async function (sessionValid = () => true) {
        if (!window._userSwitching || _navMenuPhase !== 'closed') return;
        const profile = String(window._doorpiCurrentUserId || '');
        const revision = _menuReloadToken;
        const valid = () => sessionValid() && window._userSwitching &&
            profile === String(window._doorpiCurrentUserId || '') && revision === _menuReloadToken &&
            _navMenuPhase === 'closed';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 900);
        try {
            const response = await fetch(`https://data.local/games.json?t=${Date.now()}`, { signal: controller.signal });
            if (!response.ok || !valid()) return;
            const games = await response.json();
            if (!valid() || !Array.isArray(games)) return;
            _menuData.gamesTotal = games.length;
            _menuData.games = games.filter(g => !(g.IsPendingArtwork || g.isPendingArtwork) && !_isArtworkPending(g, 'games'));
            _buildOverlay();
            _overlay.inert = true;
            _overlay.style.display = 'flex';
            _attachDualPane(document.getElementById('navContentBody'));
            _applyPaneVisibility('games');
            await Promise.race([
                _lazyGrid?.warmInitialPage?.() || Promise.resolve(),
                new Promise(resolve => setTimeout(resolve, 400))
            ]);
        } catch (error) {
            // Optional preparation: normal opening retains its loading fallback.
            if (error.name !== 'AbortError') console.warn('Nav-menu preparation deferred', error);
        } finally {
            clearTimeout(timeout);
            if (_navMenuPhase === 'closed' && _overlay) {
                _overlay.style.display = 'none';
                _overlay.inert = false;
            }
        }
    };

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

        document.body.classList.remove('nav-menu-closing');

        const topProf = document.getElementById('btnTopProfile');

        _lastFocus = document.activeElement;
        window.pauseDoorpiArtworkForTransition?.(_lastFocus);

        _buildOverlay();
        _overlay.classList.remove('nav-menu-input-released');
        _overlay.style.display = 'flex';
        window.updateNavHint?.();
        const loading = _loadJSONs();
        if (!_dualPaneContainer) await loading;
        if (lifecycleToken !== _navMenuLifecycleToken || !window.isNavMenuOpen || _navMenuPhase !== 'opening') return;

        const body = document.getElementById('navContentBody');
        if (body) {
            const initialPane = CATS[_catIdx]?.id === 'media' ? 'media' : 'games';
            _attachDualPane(body);
            _applyPaneVisibility(initialPane);
            const initialGrid = initialPane === 'media' ? _lazyGridMedia : _lazyGrid;
            initialGrid?.warmInitialPage?.();
        }
        if (lifecycleToken !== _navMenuLifecycleToken || !window.isNavMenuOpen || _navMenuPhase !== 'opening') return;

        // Compose/layout in a separate frame; don't start transform animation
        // in the same task that inserts cards and synchronously measures them.
        _selectCat(_catIdx);
        void _overlay.offsetWidth;
        await new Promise((resolve, reject) => requestAnimationFrame(() => {
            if (lifecycleToken !== _navMenuLifecycleToken || !window.isNavMenuOpen || _navMenuPhase !== 'opening') { resolve(); return; }
            try {
                // Compose before revealing: the Home remains on screen during cold reads.
                document.body.classList.add('nav-menu-active');
                if (topProf) topProf.classList.add('nav-menu-hidden');
                _runNavMenuTransition(() => {
                    if (lifecycleToken === _navMenuLifecycleToken && window.isNavMenuOpen && _navMenuPhase === 'opening') {
                        _navMenuPhase = 'open';
                        window._navMenuPhase = _navMenuPhase;
                        (_catIdx === 1 ? _lazyGridMedia : _lazyGrid)?.resumeBuild?.();
                    }
                });
                _overlay.classList.add('visible');
                resolve();
            } catch (error) { reject(error); }
        }));
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

