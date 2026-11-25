    // ── Context Menu no Nav ───────────────────────────────────────────────────
    window._navMenuTriggerCtxMenu = function () {
        if (!window.isNavMenuOpen) return false;
        const catId = CATS[_catIdx]?.id;
        let focusedProfileItem = _contentItems[_contentIdx];
        if (catId === 'profile') {
            const activeMediaRow = document.activeElement?.closest?.('[data-media-history="true"]') ||
                (focusedProfileItem?.id === 'btnProfileRecent' ? focusedProfileItem._profileRecentActive?.() : null);
            if (activeMediaRow?.dataset?.mediaHistory === 'true') {
                const rect = activeMediaRow.getBoundingClientRect();
                window._ctxMenuOpen?.(activeMediaRow, rect.right + 2, rect.top);
                return true;
            }
        }
        if (catId === 'profile' && _profileSubView === 'gaming') {
            const activeGameCard = document.activeElement?.closest?.('.nav-achievement-game');
            if (activeGameCard) focusedProfileItem = activeGameCard;
        }
        if (catId === 'profile' && _profileSubView === 'gaming' &&
            focusedProfileItem?.matches?.('.nav-achievement-game')) {
            const rowName = focusedProfileItem.querySelector('.nav-profile-game-title strong')?.textContent?.trim() || '';
            const appId = Number(focusedProfileItem.dataset.steamGame) || 0;
            const matches = (_menuData.history || []).filter(entry => {
                if (appId && Number(entry.SteamAppId) === appId) return true;
                const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
                return rowName && normalize(entry.Name) === normalize(rowName);
            }).sort((a,b) => Number(b.TotalPlaytimeMinutes || 0) - Number(a.TotalPlaytimeMinutes || 0));
            const historyEntry = matches[0];
            focusedProfileItem.dataset.historyGameName = historyEntry?.Name || rowName;
            focusedProfileItem.dataset.historyGameId = historyEntry?.Id || '';
            _setTopbarFocus(false);
            _openHistoryContextMenu(focusedProfileItem);
            return true;
        }
        if (catId === 'profile' && !_topbarFocus && focusedProfileItem?.dataset?.historyGameName) {
            _openHistoryContextMenu(focusedProfileItem);
            return true;
        }
        const allowGpuUpdaterContext =
            catId === 'settings' &&
            _settingsSubView === 'system' &&
            _systemSubView === 'updates' &&
            _systemUpdatesSubView === 'gpu';
        const allowBluetoothContext = catId === 'settings' && _settingsSubView === 'bluetooth';
        const isLibrary = catId === 'games' || catId === 'media';
        if (!isLibrary && !allowGpuUpdaterContext && !allowBluetoothContext) return false;

        // Ao usar Virtual Rendering, a referencia O(1) correta no DOM é essa:
        const focused = _contentItems[_contentIdx];
        if (!focused || _topbarFocus) return false;

        // Pesquisa, filtros e demais acoes da biblioteca compartilham a aba com
        // os cards, mas nao representam jogos/aplicativos. Validar aqui tambem
        // cobre o X disparado diretamente pelo polling do controle.
        if (isLibrary && !focused.classList?.contains('nav-vertical-card')) return false;
        if (allowGpuUpdaterContext && focused.dataset?.gpuUpdaterCard !== 'true') return false;
        if (allowBluetoothContext && focused.dataset?.bluetoothDeviceCard !== 'true') return false;

        const r = focused.getBoundingClientRect();
        window._ctxMenuOpen?.(focused, r.right + 2, r.top);
        return true;
    };

    window._navMenuCaptureGameReturnFocus = function () {
        if (!window.isNavMenuOpen) return null;
        const category = CATS[_catIdx]?.id || '';
        if (category === 'profile' && _profileSubView === 'gaming') {
            const active = document.activeElement?.closest?.('.nav-achievement-game');
            const selected = active || _contentItems[_contentIdx]?.closest?.('.nav-achievement-game');
            return { kind: 'profile-game', key: selected?.dataset?.steamFocus || '' };
        }
        if (category === 'games' || category === 'media') {
            const active = document.activeElement?.closest?.('.nav-vertical-card');
            const selected = active || _contentItems[_contentIdx]?.closest?.('.nav-vertical-card');
            if (selected) return { kind: 'library-card', category, key: selected.dataset.gameId || '' };
        }
        return null;
    };

    window._navMenuFocusGameReturnTarget = function (descriptor = null) {
        if (!window.isNavMenuOpen) return false;
        const category = CATS[_catIdx]?.id || '';
        let cards = [];
        let selected = null;
        if (category === 'profile' && _profileSubView === 'gaming') {
            cards = _contentItems.filter(item => item?.matches?.('.nav-achievement-game') && item.offsetWidth > 0 && item.offsetHeight > 0);
            selected = cards.find(item => descriptor?.key && item.dataset.steamFocus === descriptor.key)
                || _contentItems[_contentIdx]?.closest?.('.nav-achievement-game')
                || cards[0];
        } else if ((category === 'games' || category === 'media') &&
                   (!descriptor?.category || descriptor.category === category)) {
            cards = _contentItems.filter(item => item?.matches?.('.nav-vertical-card') && item.offsetWidth > 0 && item.offsetHeight > 0);
            selected = cards.find(item => descriptor?.key && item.dataset.gameId === descriptor.key)
                || _contentItems[_contentIdx]?.closest?.('.nav-vertical-card')
                || cards[0];
        }
        if (!selected) return false;
        const index = _contentItems.indexOf(selected);
        if (index < 0) return false;
        _topbarFocus = false;
        _contentIdx = index;
        _updateContentFocus();
        selected.focus({ preventScroll: true });
        selected.scrollIntoView?.({ behavior: 'instant', block: 'nearest' });
        return document.activeElement === selected;
    };

    // ── Expose ────────────────────────────────────────────────────────────────
    window.openNavMenu = open;
    window.closeNavMenu = close;
    window._navMenuOpenSettings = async function () {
        _catIdx = 2;
        _settingsSubView = null;
        _systemSubView = null;
        _settingsReturnToRoot = false;
        if (!window.isNavMenuOpen) {
            await open(2);
            requestAnimationFrame(() => _setTopbarFocus(false));
            return;
        }
        document.querySelectorAll('.nav-cat-item').forEach((el, i) => el.classList.toggle('active', i === _catIdx));
        _updateTopbarFocusVisual();
        _contentIdx = 0;
        _renderContent('settings');
        _setTopbarFocus(false);
        _updateContentFocus();
    };
    window._navMenuCurrentUserChanged = function (user, currentUserId, userChanged = false) {
        _setMenuUserContext(user || {}, currentUserId || '', !!userChanged);
    };
    window._navMenuDataChanged = function (catId = 'games') {
        _reloadMenuAfterLibraryChange(catId);
    };
    window._navMenuEditHistoryArtwork = function (element) {
        const item = _findHistoryItem(element);
        if (item) _openHistoryArtworkPicker(item, element);
    };
    window._navMenuDeleteHistory = function (element) {
        const item = _findHistoryItem(element);
        if (!item) return;
        postToHost?.({ action: 'deleteGameHistory', gameId: item.Id || '', gameName: item.Name });
    };
    window._navMenuRemoveItem = function (catId, itemKey) {
        if (catId === 'games' && Array.isArray(_menuData.games)) {
            const previousCount = _menuData.games.length;
            _menuData.games = _menuData.games.filter(item => {
                const key = item.LaunchUrl || item.launchUrl || item.Path || item.path || '';
                return key !== itemKey;
            });
            if (Number.isInteger(_menuData.gamesTotal))
                _menuData.gamesTotal = Math.max(0, _menuData.gamesTotal - (previousCount - _menuData.games.length));
            if (CATS[_catIdx]?.id === 'games') {
                const sub = document.getElementById('navContentSub');
                if (sub) sub.textContent = _subtitle('games');
            }
        }

        const grid = catId === 'games' ? _lazyGrid : _lazyGridMedia;
        if (!grid) return;

        const removedIdx = grid._cards.findIndex(c => c?.dataset?.gameId === itemKey);
        grid.removeItem(itemKey);

        // Só atualiza navegação se a aba visível for a afetada
        if (CATS[_catIdx]?.id !== catId) return;

        _contentItems = grid._cards;

        // Se o item removido estava antes ou no cursor atual, recua 1 para não pular item
        if (removedIdx !== -1 && removedIdx <= _contentIdx) {
            _contentIdx = Math.max(0, _contentIdx - 1);
        }

        _contentIdx = Math.max(0, Math.min(_contentItems.length - 1, _contentIdx));
        _updateContentFocus();
    };
    window._navMenuOpenExtensions = function () {
        _catIdx = 2; // Categoria de Configurações
        _settingsSubView = 'extensions';
        _settingsReturnToRoot = false;
        document.querySelectorAll('.nav-cat-item').forEach((el, i) => el.classList.toggle('active', i === _catIdx));
        _updateTopbarFocusVisual();
        _contentIdx = 0;

        const titleEl = document.getElementById('navContentTitle');
        const subEl = document.getElementById('navContentSub');
        const headerWrap = document.getElementById('navHeaderWrap');
        if (headerWrap) headerWrap.style.display = 'block';
        if (titleEl) titleEl.textContent = CATS[_catIdx].label;
        if (subEl) subEl.textContent = _subtitle(CATS[_catIdx].id);

        _renderContent('settings');
        _setTopbarFocus(false);
    };

    window._navMenuOpenAccountSharing = async function (appId = '') {
        _settingsReturnToRoot = false;
        if (!window.isNavMenuOpen) {
            _catIdx = 2;
            _settingsSubView = 'sharing';
            _sharingFocusAppId = appId || '';
            _preserveSettingsSubViewOnce = true;
            await open();
            requestAnimationFrame(() => _setTopbarFocus(false));
            return;
        }

        _catIdx = 2;
        _settingsSubView = 'sharing';
        _sharingFocusAppId = appId || '';

        document.querySelectorAll('.nav-cat-item').forEach((el, i) => el.classList.toggle('active', i === _catIdx));
        _updateTopbarFocusVisual();
        _contentIdx = 0;

        const titleEl = document.getElementById('navContentTitle');
        const subEl = document.getElementById('navContentSub');
        const headerWrap = document.getElementById('navHeaderWrap');
        if (headerWrap) headerWrap.style.display = 'block';
        if (titleEl) titleEl.textContent = CATS[_catIdx].label;
        if (subEl) subEl.textContent = _subtitle(CATS[_catIdx].id);

        _renderContent('settings');
        _setTopbarFocus(false);
    };

})();
