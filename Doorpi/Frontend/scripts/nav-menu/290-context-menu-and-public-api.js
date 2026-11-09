    // ── Context Menu no Nav ───────────────────────────────────────────────────
    window._navMenuTriggerCtxMenu = function () {
        if (!window.isNavMenuOpen) return false;
        const catId = CATS[_catIdx]?.id;
        const focusedProfileItem = _contentItems[_contentIdx];
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
        postToHost?.({ action: 'deleteGameHistory', gameName: item.Name });
    };
    window._navMenuRemoveItem = function (catId, itemKey) {
        if (catId === 'games' && Array.isArray(_menuData.games)) {
            _menuData.games = _menuData.games.filter(item => {
                const key = item.LaunchUrl || item.launchUrl || item.Path || item.path || '';
                return key !== itemKey;
            });
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
