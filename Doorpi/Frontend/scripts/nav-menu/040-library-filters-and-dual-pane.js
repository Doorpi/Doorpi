    // ────────────────────────────────────────────────────────────────────────


    // ── Lazy Grid Variables ──
    let _lazyGrid = null;   // grid de jogos (persistente)
    let _lazyGridMedia = null;   // grid de mídia (persistente)
    let _dualPaneContainer = null;
    const _gameLibraryFilters = new Set();
    const _librarySearch = { games: '', media: '' };
    let _libraryInteractionMode = null;

    function _librarySource(item) {
        if (item?.EmulatorId || item?.emulatorId || /^(emulator|emulador)$/i.test(String(item?.Source || item?.source || ''))) {
            return `emulator:${String(item?.EmulatorId || item?.emulatorId || 'unknown').trim().toLowerCase()}`;
        }
        const source = String(item?.Source || item?.source || '').trim().toLowerCase();
        if (source === 'steam') return 'steam';
        if (source === 'epic') return 'epic';
        if (source === 'gog') return 'gog';
        return 'windows';
    }

    function _libraryFilterLabel(filter) {
        const labels = {
            steam: 'Steam',
            epic: 'Epic Games',
            gog: 'GOG',
            windows: _t('filterLabels.Windows', 'Windows e pastas')
        };
        if (labels[filter]) return labels[filter];
        const emulatorId = String(filter || '').replace(/^emulator:/, '');
        const config = (_menuData.emulators || []).find(item =>
            String(item?.Id || item?.id || '').trim().toLowerCase() === emulatorId);
        const configuredName = String(config?.Name || config?.name || '').trim();
        if (configuredName) return configuredName;
        const knownNames = {
            rpcs3: 'RPCS3', pcsx2: 'PCSX2', ppsspp: 'PPSSPP', xenia: 'Xenia',
            dolphin: 'Dolphin', cemu: 'Cemu', ryujinx: 'Ryujinx', eden: 'Eden', lichii: 'Lichii',
            azahar: 'Azahar', citra: 'Citra', vita3k: 'Vita3K', duckstation: 'DuckStation',
            project64: 'Project64', snes9x: 'Snes9x', shadps4: 'shadPS4'
        };
        if (knownNames[emulatorId]) return knownNames[emulatorId];
        return emulatorId.split(/[-_\s]+/).filter(Boolean)
            .map(part => part.length <= 4 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ') || 'Emulador';
    }

    function _libraryPane(catId) {
        return _dualPaneContainer?.querySelector(catId === 'media' ? '#navPaneMedia' : '#navPaneGames');
    }

    function _libraryGrid(catId) {
        return catId === 'media' ? _lazyGridMedia : _lazyGrid;
    }

    function _filteredLibraryItems(catId) {
        const sourceItems = catId === 'media' ? (_menuData.media || []) : (_menuData.games || []);
        const query = String(_librarySearch[catId] || '').trim().toLocaleLowerCase();
        return sourceItems.filter(item => {
            if (catId === 'games' && _gameLibraryFilters.size > 0 &&
                !_gameLibraryFilters.has(_librarySource(item))) return false;
            return !query || String(item?.Name || item?.name || '').toLocaleLowerCase().includes(query);
        });
    }

    function _libraryActionItems(catId) {
        const pane = _libraryPane(catId);
        if (!pane) return [];
        return Array.from(pane.querySelectorAll('.nav-library-action'));
    }

    function _syncLibraryContentItems(catId, focusedCard = null) {
        if (CATS[_catIdx]?.id !== catId) return;
        const pane = _libraryPane(catId);
        if (!pane) return;

        if (_libraryInteractionMode === 'filters' && catId === 'games') {
            _contentItems = Array.from(pane.querySelectorAll('.nav-library-filter-option, .nav-library-filter-footer button'));
        } else {
            const actions = _libraryActionItems(catId);
            const cards = _libraryGrid(catId)?._cards || [];
            _contentItems = [...actions, ...cards];
        }

        if (focusedCard) {
            const nextIndex = _contentItems.indexOf(focusedCard);
            if (nextIndex >= 0) _contentIdx = nextIndex;
        }
        _contentIdx = Math.max(0, Math.min(Math.max(0, _contentItems.length - 1), _contentIdx));
    }

    function _rebuildLibraryGrid(catId, { resetScroll = false } = {}) {
        const pane = _libraryPane(catId);
        if (!pane) return;

        const previousScroll = pane.scrollTop;
        const oldGrid = _libraryGrid(catId);
        oldGrid?.destroy();
        if (catId === 'media') _lazyGridMedia = null;
        else _lazyGrid = null;
        pane.querySelector('.nav-library-empty')?.remove();

        const items = _filteredLibraryItems(catId);
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'nav-library-empty';
            empty.innerHTML = `<strong>${catId === 'media' ? 'Nenhum aplicativo encontrado' : 'Nenhum jogo encontrado'}</strong><span>Tente outro termo${catId === 'games' ? ' ou combinação de filtros' : ''}.</span>`;
            pane.appendChild(empty);
            _syncLibraryContentItems(catId);
            return;
        }

        const nextGrid = new _NavLazyGrid({
            body: pane, scrollRoot: pane,
            items, catId, emptyIcon: catId === 'media' ? '▶' : '⊞',
            onLaunchAction: (idx) => _launchAction(catId, idx, items),
            onFocusUpdate: (cards, idx) => {
                if (CATS[_catIdx]?.id !== catId) return;
                const focusedCard = idx >= 0 ? cards[idx] : null;
                _syncLibraryContentItems(catId, focusedCard);
                if (idx >= 0) {
                    _topbarFocus = false;
                    _updateContentFocus();
                }
            }
        });
        if (catId === 'media') _lazyGridMedia = nextGrid;
        else _lazyGrid = nextGrid;
        pane.scrollTop = resetScroll ? 0 : previousScroll;
        _syncLibraryContentItems(catId);
    }

    function _availableLibraryFilters() {
        const items = _menuData.games || [];
        const counts = new Map();
        items.forEach(item => {
            const source = _librarySource(item);
            counts.set(source, (counts.get(source) || 0) + 1);
        });
        const baseFilters = ['steam', 'epic', 'gog', 'windows'].filter(filter => counts.has(filter));
        const emulatorFilters = [...counts.keys()].filter(key => key.startsWith('emulator:')).sort();
        return [...baseFilters, ...emulatorFilters].map(id => ({
            id,
            label: _libraryFilterLabel(id),
            count: counts.get(id) || 0
        }));
    }

    function _refreshLibraryActionState(catId) {
        const pane = _libraryPane(catId);
        if (!pane) return;
        pane.querySelector('[data-library-action="search"]')?.classList.toggle('has-value', !!_librarySearch[catId]);
        const filterAction = pane.querySelector('[data-library-action="filters"]');
        filterAction?.classList.toggle('has-value', _gameLibraryFilters.size > 0);
        const badge = filterAction?.querySelector('.nav-library-action-badge');
        if (badge) {
            badge.textContent = String(_gameLibraryFilters.size);
            badge.hidden = _gameLibraryFilters.size === 0;
        }
    }

    function _closeLibrarySearch(catId) {
        const pane = _libraryPane(catId);
        const sheet = pane?.querySelector('.nav-library-search-sheet');
        if (!sheet) return;
        sheet.classList.remove('is-open');
        pane.classList.remove('is-search-open');
        _libraryInteractionMode = null;
        _syncLibraryContentItems(catId);
        const action = pane.querySelector('[data-library-action="search"]');
        const idx = _contentItems.indexOf(action);
        if (idx >= 0) _contentIdx = idx;
        _topbarFocus = false;
        _updateContentFocus();
    }

    function _openLibrarySearch(catId) {
        const pane = _libraryPane(catId);
        const sheet = pane?.querySelector('.nav-library-search-sheet');
        const search = sheet?.querySelector('input');
        if (!sheet || !search) return;

        _closeLibraryFilters(false);
        _libraryInteractionMode = 'search';
        sheet.classList.add('is-open');
        pane.classList.add('is-search-open');
        search.value = _librarySearch[catId] || '';
        search._doorpiVkbReturnFocus = pane.querySelector('[data-library-action="search"]');
        search.focus({ preventScroll: true });
        search.setSelectionRange(search.value.length, search.value.length);
        window._vkbOpen?.(search, {
            allowProgrammatic: true,
            placement: 'below',
            align: 'start',
            anchorElement: sheet.querySelector('.nav-library-expanded-search'),
            offsetY: 22,
            onEnter: () => _closeLibrarySearch(catId)
        });
    }

    function _renderLibraryFilterPanel() {
        const pane = _libraryPane('games');
        const panel = pane?.querySelector('.nav-library-filter-panel');
        if (!panel) return;
        const filters = _availableLibraryFilters();
        panel.innerHTML = `
            <div class="nav-library-filter-head">
                <div><span>Biblioteca</span><h3>Filtros</h3></div>
                <span class="nav-library-filter-selected">${_gameLibraryFilters.size} selecionado(s)</span>
            </div>
            <div class="nav-library-filter-list">
                ${filters.map(filter => `
                    <button class="nav-library-filter-option${_gameLibraryFilters.has(filter.id) ? ' selected' : ''}" type="button" tabindex="-1" data-filter-id="${_esc(filter.id)}" aria-pressed="${_gameLibraryFilters.has(filter.id)}">
                        <span class="nav-library-filter-copy"><strong>${_esc(filter.label)}</strong><small>${filter.count} ${filter.count === 1 ? 'jogo' : 'jogos'}</small></span>
                        <span class="nav-library-switch" aria-hidden="true"><i></i></span>
                    </button>`).join('')}
            </div>
            <div class="nav-library-filter-footer">
                <button type="button" tabindex="-1" data-filter-command="reset">Resetar</button>
                <button type="button" tabindex="-1" data-filter-command="done">Concluir</button>
            </div>`;

        panel.querySelectorAll('[data-filter-id]').forEach(button => {
            button.addEventListener('click', () => {
                const id = button.dataset.filterId;
                if (_gameLibraryFilters.has(id)) _gameLibraryFilters.delete(id);
                else _gameLibraryFilters.add(id);
                button.classList.toggle('selected', _gameLibraryFilters.has(id));
                button.setAttribute('aria-pressed', String(_gameLibraryFilters.has(id)));
                panel.querySelector('.nav-library-filter-selected').textContent = `${_gameLibraryFilters.size} selecionado(s)`;
                _refreshLibraryActionState('games');
                _rebuildLibraryGrid('games', { resetScroll: true });
                _syncLibraryContentItems('games');
                _contentIdx = Math.max(0, _contentItems.indexOf(button));
                _updateContentFocus();
            });
        });
        panel.querySelector('[data-filter-command="reset"]')?.addEventListener('click', () => {
            _gameLibraryFilters.clear();
            _refreshLibraryActionState('games');
            _renderLibraryFilterPanel();
            _rebuildLibraryGrid('games', { resetScroll: true });
            _syncLibraryContentItems('games');
            _contentIdx = Math.max(0, _contentItems.findIndex(item => item.dataset?.filterCommand === 'reset'));
            _updateContentFocus();
        });
        panel.querySelector('[data-filter-command="done"]')?.addEventListener('click', () => _closeLibraryFilters());
        panel.querySelectorAll('.nav-library-filter-option, .nav-library-filter-footer button').forEach(item => {
            item.addEventListener('mouseenter', () => {
                if (_libraryInteractionMode !== 'filters') return;
                _syncLibraryContentItems('games');
                const idx = _contentItems.indexOf(item);
                if (idx >= 0) {
                    _contentIdx = idx;
                    _updateContentFocus();
                }
            });
        });
    }

    function _openLibraryFilters() {
        const pane = _libraryPane('games');
        const panel = pane?.querySelector('.nav-library-filter-panel');
        if (!panel) return;
        window._vkbForceClose?.({ restoreFocus: false });
        pane.querySelector('.nav-library-search-sheet')?.classList.remove('is-open');
        _libraryInteractionMode = 'filters';
        _renderLibraryFilterPanel();
        panel.classList.add('is-open');
        _syncLibraryContentItems('games');
        _contentIdx = 0;
        _topbarFocus = false;
        _updateContentFocus();
    }

    function _closeLibraryFilters(restoreFocus = true) {
        const pane = _libraryPane('games');
        const panel = pane?.querySelector('.nav-library-filter-panel');
        if (!panel?.classList.contains('is-open')) return false;
        panel.classList.remove('is-open');
        _libraryInteractionMode = null;
        _syncLibraryContentItems('games');
        if (restoreFocus) {
            const action = pane.querySelector('[data-library-action="filters"]');
            const idx = _contentItems.indexOf(action);
            if (idx >= 0) _contentIdx = idx;
            _topbarFocus = false;
            _updateContentFocus();
        }
        return true;
    }

    function _buildLibraryControls(pane, catId) {
        pane.classList.add('nav-library-pane');
        const controls = document.createElement('div');
        controls.className = 'nav-library-actions';
        controls.innerHTML = `
            <button class="nav-library-action" type="button" tabindex="-1" data-library-action="search" aria-label="Pesquisar">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.2 4.2"/></svg>
                <span>Pesquisar</span>
            </button>
            ${catId === 'games' ? `
            <button class="nav-library-action" type="button" tabindex="-1" data-library-action="filters" aria-label="Filtros">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M8 12h8M10.5 17h3"/><path d="m4 5 1 2-1 2M7 10l1 2-1 2M9.5 15l1 2-1 2"/></svg>
                <span>Filtros</span><b class="nav-library-action-badge" hidden>0</b>
            </button>` : ''}`;
        pane.prepend(controls);

        const searchSheet = document.createElement('div');
        searchSheet.className = 'nav-library-search-sheet';
        searchSheet.innerHTML = `
            <div class="nav-library-expanded-search">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.2 4.2"/></svg>
                <input type="search" autocomplete="off" spellcheck="false" placeholder="${catId === 'games' ? 'Pesquisar jogos' : 'Pesquisar aplicativos'}" value="${_esc(_librarySearch[catId])}" />
            </div>
            <button type="button" class="nav-library-search-cancel" tabindex="-1">Cancelar</button>`;
        pane.prepend(searchSheet);

        if (catId === 'games') {
            const filterPanel = document.createElement('aside');
            filterPanel.className = 'nav-library-filter-panel';
            filterPanel.setAttribute('aria-label', 'Filtros da biblioteca');
            pane.prepend(filterPanel);
        }

        const search = searchSheet.querySelector('input');
        search?.addEventListener('input', () => {
            _librarySearch[catId] = search.value || '';
            _refreshLibraryActionState(catId);
            _rebuildLibraryGrid(catId, { resetScroll: true });
        });
        searchSheet.querySelector('.nav-library-search-cancel')?.addEventListener('click', () => {
            window._vkbForceClose?.({ restoreFocus: false });
            _closeLibrarySearch(catId);
        });
        controls.querySelector('[data-library-action="search"]')?.addEventListener('click', () => _openLibrarySearch(catId));
        controls.querySelector('[data-library-action="filters"]')?.addEventListener('click', () => _openLibraryFilters());

        document.addEventListener('doorpi-vkb-closed', event => {
            if (event.detail?.input === search && _libraryInteractionMode === 'search') {
                _closeLibrarySearch(catId);
            }
        });

        _libraryActionItems(catId).forEach(action => {
            action.addEventListener('mouseenter', () => {
                if (CATS[_catIdx]?.id !== catId || _libraryInteractionMode) return;
                _syncLibraryContentItems(catId);
                const idx = _contentItems.indexOf(action);
                if (idx >= 0) {
                    _topbarFocus = false;
                    _contentIdx = idx;
                    _updateContentFocus();
                }
            });
        });
        _refreshLibraryActionState(catId);
    }

    function _currentLazyGrid() {
        const id = CATS[_catIdx]?.id;
        if (id === 'games') return _lazyGrid;
        if (id === 'media') return _lazyGridMedia;
        return null;
    }

    function _isLazyCat() {
        const id = CATS[_catIdx]?.id;
        return id === 'games' || id === 'media';
    }

    function _destroyLazyGrid() {
        if (_lazyGrid) { _lazyGrid.destroy(); _lazyGrid = null; }
        if (_lazyGridMedia) { _lazyGridMedia.destroy(); _lazyGridMedia = null; }
        if (_dualPaneContainer) {
            try { _dualPaneContainer.remove(); } catch (_) { }
            _dualPaneContainer = null;
        }
        document.getElementById('navContentBody')?.classList.remove('dual-pane-active');
        _contentItems = [];
    }

    function _activeUserIdFromPayload(user, currentUserId) {
        return currentUserId || user?.Id || user?.id || user?.UserId || user?.userId || '';
    }

    async function _reloadMenuForCurrentUser(activeCatId) {
        const token = ++_menuReloadToken;
        await _loadJSONs();
        if (token !== _menuReloadToken || !window.isNavMenuOpen) return;

        const body = document.getElementById('navContentBody');
        if (!body) return;

        const catId = activeCatId || CATS[_catIdx]?.id || 'games';
        if (catId === 'games' || catId === 'media') {
            _attachDualPane(body);
            _switchDualPane(catId);
        } else {
            _renderContent(catId);
        }
        _updateContentFocus();
    }

    async function _reloadMenuAfterLibraryChange(changedCatId = 'games') {
        const token = ++_menuReloadToken;
        const activeCatId = CATS[_catIdx]?.id || 'games';
        await _loadJSONs();
        if (token !== _menuReloadToken) return;
        if (!window.isNavMenuOpen) {
            if (changedCatId === 'games' || changedCatId === 'media') {
                _destroyLazyGrid();
            }
            return;
        }

        if (activeCatId === 'games' || activeCatId === 'media') {
            _destroyLazyGrid();
            const body = document.getElementById('navContentBody');
            if (!body) return;
            _attachDualPane(body);
            _switchDualPane(activeCatId);
            _updateContentFocus();
            return;
        }

        if (changedCatId === activeCatId) {
            _renderContent(activeCatId);
            _updateContentFocus();
        }
    }

    function _setMenuUserContext(user, currentUserId, forceReload = false) {
        const nextUserId = _activeUserIdFromPayload(user, currentUserId);
        const changed = !!nextUserId && !_sameId(nextUserId, _menuDataUserId);
        if (user) _menuData.user = user;
        if (nextUserId) _menuDataUserId = nextUserId;

        if (!changed && !forceReload) return;

        _menuData.games = [];
        _menuData.history = [];
        _menuData.mediaHistory = [];
        _menuData.media = [];
        _menuData.emulators = [];
        _gameLibraryFilters.clear();
        _librarySearch.games = '';
        _librarySearch.media = '';
        _libraryFocusMemory.games = { key: '', index: 0 };
        _libraryFocusMemory.media = { key: '', index: 0 };
        const activeCatId = CATS[_catIdx]?.id || 'games';
        _destroyLazyGrid();

        if (window.isNavMenuOpen) {
            _reloadMenuForCurrentUser(activeCatId);
        }
    }

    function _attachDualPane(body) {
        if (!body) return;
        body.classList.add('dual-pane-active');

        if (!_dualPaneContainer) {
            body.innerHTML = '';
            _ensureDualPane(body);
            return;
        }

        if (_dualPaneContainer.parentNode !== body) {
            body.innerHTML = '';
            body.appendChild(_dualPaneContainer);
        }

        _dualPaneContainer.style.display = 'block';
        _dualPaneContainer.setAttribute('aria-hidden', 'false');
    }

    function _detachDualPane(body) {
        if (_dualPaneContainer?.parentNode) _dualPaneContainer.parentNode.removeChild(_dualPaneContainer);
        if (body) body.classList.remove('dual-pane-active');
    }

    // ── Dual Pane: constrói e gerencia os dois grids persistentes ─────────────
    function _ensureDualPane(body) {
        if (_dualPaneContainer) return; // já existe, só mudar visibilidade

        body.classList.add('dual-pane-active');

        _dualPaneContainer = document.createElement('div');
        _dualPaneContainer.id = 'navDualPane';
        body.appendChild(_dualPaneContainer);

        const gamesPane = document.createElement('div');
        gamesPane.id = 'navPaneGames';
        _dualPaneContainer.appendChild(gamesPane);

        const mediaPane = document.createElement('div');
        mediaPane.id = 'navPaneMedia';
        _dualPaneContainer.appendChild(mediaPane);

        const gamesItems = _menuData.games || [];
        if (gamesItems.length) {
            _buildLibraryControls(gamesPane, 'games');
            _rebuildLibraryGrid('games', { resetScroll: true });
        } else {
            gamesPane.innerHTML = `<div class="nav-placeholder"><div class="nav-placeholder-icon">⊞</div><div class="nav-placeholder-text">${_t('navNoGames', 'Nenhum jogo encontrado')}</div></div>`;
        }

        const mediaItems = _menuData.media || [];
        if (mediaItems.length) {
            _buildLibraryControls(mediaPane, 'media');
            _rebuildLibraryGrid('media', { resetScroll: true });
        } else {
            mediaPane.innerHTML = `<div class="nav-placeholder"><div class="nav-placeholder-icon">▶</div><div class="nav-placeholder-text">${_t('navNoMedia', 'Nenhum aplicativo configurado')}</div></div>`;
        }
    }

    function _applyPaneVisibility(catId) {
        const gamesPane = _dualPaneContainer?.querySelector('#navPaneGames');
        const mediaPane = _dualPaneContainer?.querySelector('#navPaneMedia');
        if (!gamesPane || !mediaPane) return;

        gamesPane.querySelector('.nav-library-filter-panel')?.classList.remove('is-open');
        _dualPaneContainer.querySelectorAll('.nav-library-search-sheet').forEach(sheet => sheet.classList.remove('is-open'));
        _dualPaneContainer.querySelectorAll('.nav-library-pane').forEach(pane => pane.classList.remove('is-search-open'));
        _libraryInteractionMode = null;

        const showGames = catId === 'games';
        const visPane = showGames ? gamesPane : mediaPane;
        const hidPane = showGames ? mediaPane : gamesPane;

        visPane.style.opacity = '1';
        visPane.style.pointerEvents = 'auto';
        visPane.style.zIndex = '1';

        hidPane.style.opacity = '0';
        hidPane.style.pointerEvents = 'none';
        hidPane.style.zIndex = '0';

        const grid = showGames ? _lazyGrid : _lazyGridMedia;
        grid?.hydrateInitialPage?.();
        grid?.hydrateViewportBand?.();
        _libraryInteractionMode = null;
        _syncLibraryContentItems(catId);
    }

    function _switchDualPane(catId) {
        _applyPaneVisibility(catId);
        _contentIdx = 0;
        _updateContentFocus();
    }

    function _warmDualPaneInitialPages() {
        const tasks = [];
        const gamesWarm = _lazyGrid?.warmInitialPage?.();
        const mediaWarm = _lazyGridMedia?.warmInitialPage?.();
        if (gamesWarm) tasks.push(gamesWarm);
        if (mediaWarm) tasks.push(mediaWarm);

        requestAnimationFrame(() => {
            _lazyGrid?.hydrateViewportBand?.();
            _lazyGridMedia?.hydrateViewportBand?.();
        });

        return Promise.allSettled(tasks);
    }
