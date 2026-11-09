    function _libraryUpdateShouldWait() {
        const phase = window._navMenuPhase || 'closed';
        const allowSessionRender = window._doorpiAllowLibraryRenderDuringSessionTransition === true;
        return phase === 'opening'
            || phase === 'closing'
            || document.body.classList.contains('nav-menu-closing')
            || (!allowSessionRender && window._userSwitching === true)
            || (!allowSessionRender && window.isDoorpiSessionTransitionActive?.() === true);
    }

    function _enqueueNewGameForLibrary(channel, data) {
        _pendingNewGameQueue.push({ channel, data: { ...data } });
        if (_pendingNewGameTimer) clearTimeout(_pendingNewGameTimer);
        _pendingNewGameTimer = setTimeout(_flushNewGameQueue, 110);
    }

    function _flushNewGameQueue() {
        _pendingNewGameTimer = 0;
        if (_pendingNewGameQueue.length === 0) return;

        if (_libraryUpdateShouldWait()) {
            _pendingNewGameTimer = setTimeout(_flushNewGameQueue, 80);
            return;
        }

        const batch = _pendingNewGameQueue.splice(0);
        const byChannel = new Map();
        batch.forEach(entry => {
            if (!byChannel.has(entry.channel)) byChannel.set(entry.channel, []);
            byChannel.get(entry.channel).push(entry.data);
        });

        requestAnimationFrame(() => {
            byChannel.forEach((items, channel) => {
                const silent = items.length > DOORPI_BULK_LIBRARY_THRESHOLD;
                if (silent && typeof window.clearLoadingCards === 'function') {
                    window.clearLoadingCards(channel === 'media' ? 'media' : 'games');
                }
                if (silent && window.AppStore?.mutations?.addItems) {
                    window.AppStore.mutations.addItems(channel, items, { silent: true });
                } else {
                    items.forEach(item => window.AppStore?.mutations?.addItem(channel, item, { silent: false }));
                }
            });
        });
    }

    function _countSessionNewGames(items) {
        if (!Array.isArray(items)) return 0;
        return items.reduce((count, item) => {
            const ids = [item.id, item.Id, item.launchUrl, item.LaunchUrl, item.path, item.Path].filter(Boolean);
            const isNew = ids.some(id => window.newGameIdsThisSession?.has(id)
                || window.newGameIdsThisSession?.has(String(id).replace(/\/$/, '')));
            return count + (isNew ? 1 : 0);
        }, 0);
    }

    function _scheduleRenderGamesBatch(payload) {
        _pendingRenderGamesPayload = payload;
        if (_pendingRenderGamesTimer) clearTimeout(_pendingRenderGamesTimer);

        const flush = () => {
            _pendingRenderGamesTimer = 0;
            if (!_pendingRenderGamesPayload) return;

            if (_libraryUpdateShouldWait()) {
                _pendingRenderGamesTimer = setTimeout(flush, 80);
                return;
            }

            const current = _pendingRenderGamesPayload;
            _pendingRenderGamesPayload = null;

            requestAnimationFrame(() => {
                if (current.silent && typeof window.clearLoadingCards === 'function') {
                    window.clearLoadingCards('games');
                }

                window.AppStore?.mutations?.setBatch('games', current.games || [], { silent: !!current.silent });
                window._navMenuDataChanged?.('games');

                if (current.wasOnMedia && current.heroSnapSrc && !current.silent) {
                    requestAnimationFrame(() =>
                        switchHeroBackground(current.heroSnapSrc, current.heroSnapLogo, current.heroSnapHoriz));
                }
            });
        };

        _pendingRenderGamesTimer = setTimeout(flush, _libraryUpdateShouldWait() ? 80 : 0);
    }


