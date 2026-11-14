    const _TAB_MAP = { 'apps': 0, 'media-apps': 1, 'stores': 2, 'emulators': 3, 'folders': 4 };
    const _VIEW_MAP = { 'apps': 'view-apps', 'media-apps': 'view-media-apps', 'stores': 'view-stores', 'emulators': 'view-emulators', 'folders': 'view-folders' };
    let _pendingAddModalContentFocus = '';
    let _addModalUserInteracted = false;

    function focusAddModalContent(tabId, options = {}) {
        if (!isModalOpen) return false;
        const modal = document.getElementById('addGameContainer');
        // A abertura pode posicionar o foco uma única vez. Depois que o usuário ou
        // a navegação por controle já entrou no modal, uma resposta de cache nunca
        // pode roubar esse foco e mandá-lo para o primeiro card.
        if (modal?.contains(document.activeElement)) {
            _pendingAddModalContentFocus = '';
            return false;
        }
        const activeView = document.querySelector('.view-section.active')?.id;
        const allowFallback = options.allowFallback === true;
        const scrollBehavior = options.behavior || 'instant';
        let target = null;

        if (tabId === 'apps' && activeView === 'view-apps') {
            target = document.querySelector('#appList .app-item:not(.already-added)');
            if (!target && allowFallback) {
                target = document.querySelector('.filter-bar .filter-btn.active')
                    || document.querySelector('.filter-bar .filter-btn')
                    || document.querySelector('#view-apps .action-buttons button');
            }
        } else if (tabId === 'media-apps' && activeView === 'view-media-apps') {
            if (document.getElementById('subview-web')?.classList.contains('active')) {
                target = document.getElementById('webAppNameInput')
                    || document.getElementById('webAppUrlInput')
                    || document.querySelector('#mediaAppSubtabs .subtab.active');
            } else {
                target = document.querySelector('#appListMedia .app-item:not(.already-added)')
                    || document.getElementById('btnSearchMedia')
                    || document.querySelector('#mediaAppSubtabs .subtab.active');
            }
        } else if (tabId === 'stores' && activeView === 'view-stores') {
            target = document.querySelector('#storeInstallList .store-install-card:not(.installed):not([aria-disabled="true"])')
                || document.querySelector('#view-stores .action-buttons button');
        } else if (tabId === 'emulators' && activeView === 'view-emulators') {
            target = document.querySelector('#view-emulators .emulator-nav:not(:disabled)');
        } else if (tabId === 'folders' && activeView === 'view-folders') {
            target = document.querySelector('#folderList .icon-btn')
                || document.getElementById('btnScanFolder')
                || document.querySelector('#view-folders .action-buttons button');
        }

        if (!target) return false;
        target.focus({ preventScroll: true });
        target.scrollIntoView?.({ behavior: scrollBehavior, block: 'nearest', inline: 'nearest' });
        _pendingAddModalContentFocus = '';
        return true;
    }

    function resetAddModalScrollPosition() {
        ['appList', 'appListMedia', 'storeInstallList', 'folderList', 'emulatorViewContent'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.scrollTop = 0;
            el.scrollLeft = 0;
        });
    }

    function queueAddModalContentFocus(tabId) {
        _pendingAddModalContentFocus = tabId;
        requestAnimationFrame(() => {
            if (!_addModalUserInteracted) focusAddModalContent(tabId);
        });
        window.setTimeout(() => {
            if (!_addModalUserInteracted) focusAddModalContent(tabId, { allowFallback: true });
        }, 160);
    }

    function switchTab(tabId) {
        document.querySelectorAll('.menu-tab').forEach((btn, i) => {
            const id = Object.keys(_TAB_MAP)[i];
            btn.classList.toggle('active', id === tabId);
        });
        document.querySelectorAll('.view-section').forEach(v => {
            v.classList.remove('active');
            v.classList.add('hidden');
        });
        const view = document.getElementById(_VIEW_MAP[tabId]);
        view?.classList.remove('hidden');
        view?.classList.add('active');

        // Controle inteligente de exibição dos botões
        const modalActions = document.getElementById('modalActions');
        const mediaAppActions = document.getElementById('mediaAppActions');

        if (tabId === 'apps') {
            if (modalActions) modalActions.style.display = 'flex';
            if (mediaAppActions) mediaAppActions.style.display = 'none';
            refreshInstalledAppsView(); // Força a lista a renderizar novamente
        }
        else if (tabId === 'folders') {
            if (modalActions) modalActions.style.display = 'none';
            if (mediaAppActions) mediaAppActions.style.display = 'none';
            if (cachedFolders === null) {
                showGlobalLoading(t('foldersTitle'), t('readingApps'));
                requestFolders();
            } else {
                renderFolderList(cachedFolders);
            }
        }
        else if (tabId === 'media-apps') {
            if (modalActions) modalActions.style.display = 'none';
            if (mediaAppActions) mediaAppActions.style.display = 'flex';
            _initMediaAppsView();
        }
        else if (tabId === 'stores') {
            if (modalActions) modalActions.style.display = 'none';
            if (mediaAppActions) mediaAppActions.style.display = 'none';
            if (!supportedStores.length && Array.isArray(window._supportedStoresCatalog)) {
                supportedStores = window._supportedStoresCatalog;
            }
            renderStoreInstallList();
            postToHost({ action: 'requestStores' });
        }
        else if (tabId === 'emulators') {
            if (modalActions) modalActions.style.display = 'none';
            if (mediaAppActions) mediaAppActions.style.display = 'none';
            window.openEmulatorsView?.();
        }
        queueAddModalContentFocus(tabId);
    }
    /* Seção: Filtros e barra de filtros */
    currentSourceFilter = ['all'];
window.isBackgroundScanning = false;
window.lastScanText = t('inlineScanIdle'); // Memória para não perder o texto ao trocar de aba

window.setInlineScanStatus = function (isScanning, text) {
    window.isBackgroundScanning = isScanning;
    if (text) window.lastScanText = text; // Salva o texto!

    const statusEl = document.getElementById('inlineScanStatus');
    const textEl = document.getElementById('inlineScanText');

    if (statusEl) {
        if (isScanning) {
            statusEl.classList.add('visible');
            if (text && textEl) textEl.textContent = text;
        } else {
            statusEl.classList.remove('visible');
        }
    }
};

function buildFilterBar(apps) {
    const bar = document.getElementById('filterBar');
    if (!bar) return;

    const appPool = (Array.isArray(apps) ? apps : []).filter(a => (a.AddedTo || a.addedTo) !== 'media');
    const present = new Set(appPool.map(a => a.Source || a.source));
    const keys = ['all', ...Object.keys(FILTER_SOURCES).filter(k => k !== 'all' && FILTER_SOURCES[k].some(s => present.has(s)))];

    const sourceCount = (key) => {
        if (key === 'all') return appPool.length;
        const sources = FILTER_SOURCES[key] || [key];
        return appPool.filter(a => sources.includes(a.Source || a.source)).length;
    };

    let html = keys.map(k => {
        const isActive = currentSourceFilter.includes(k);
        const label = typeof t === 'function' ? t('filterLabels.' + k) : k;
        const count = sourceCount(k);
        return `
                <button class="filter-btn ${isActive ? 'active' : ''}" tabindex="0" data-source="${escapeHtml(k)}" aria-label="${escapeHtml(label)}: ${count}">
                    <span class="filter-label">${escapeHtml(label)}</span>
                    <span class="filter-count">${count}</span>
                </button>
            `;
    }).join('');

    // Puxa o texto salvo na memória para não sumir ao trocar de aba!
    html += `
            <div class="inline-scan-status ${window.isBackgroundScanning ? 'visible' : ''}" id="inlineScanStatus">
                <div class="inline-scan-spinner"></div>
                <span id="inlineScanText">${typeof escapeHtml === 'function' ? escapeHtml(window.lastScanText) : window.lastScanText}</span>
            </div>
        `;

    bar.innerHTML = html;

    bar.querySelectorAll('.filter-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            const clicked = btn.dataset.source;

            if (clicked === 'all') {
                currentSourceFilter = ['all'];
            } else {
                currentSourceFilter = currentSourceFilter.filter(s => s !== 'all');

                if (currentSourceFilter.includes(clicked)) {
                    currentSourceFilter = currentSourceFilter.filter(s => s !== clicked);
                } else {
                    currentSourceFilter.push(clicked);
                }

                if (currentSourceFilter.length === 0) currentSourceFilter = ['all'];
            }

            applyFilterAndRender();

            setTimeout(() => {
                const alvo = document.querySelector(`.filter-bar .filter-btn[data-source="${clicked}"]`);
                if (alvo) alvo.focus();
                else document.querySelector('.filter-bar .filter-btn')?.focus();
            }, 10);
        })
    );
}

    function applyFilterAndRender() {
        let filtered;

        if (currentSourceFilter.includes('all')) {
            filtered = allInstalledApps;
        } else {
            const allowedPlatforms = currentSourceFilter.flatMap(f => FILTER_SOURCES[f]);
            filtered = allInstalledApps.filter(a => allowedPlatforms.includes(a.Source || a.source));
        }

        filtered = filtered.filter(a => (a.AddedTo || a.addedTo) !== 'media');

        populateAppModal(filtered);
    }

    function refreshInstalledAppsView() {
        const focusSnapshot = _captureInstalledAppsModalFocus();
        const activeView = document.querySelector('.view-section.active')?.id;
        const exeActive = activeView === 'view-media-apps' &&
            document.getElementById('subview-exe')?.classList.contains('active');

        if (exeActive) {
            if (document.getElementById('appListMedia')) {
                const availableApps = allInstalledApps.filter(a => (a.AddedTo || a.addedTo) !== 'game');
                _populateExeList(availableApps);
            } else {
                _renderExeAppModal();
            }
            _restoreInstalledAppsModalFocus(focusSnapshot);
            return;
        }

        applyFilterAndRender();
        _restoreInstalledAppsModalFocus(focusSnapshot);
    }

    function _filterBarSignature(apps) {
        const appPool = (Array.isArray(apps) ? apps : [])
            .filter(app => (app.AddedTo || app.addedTo) !== 'media');
        return Object.keys(FILTER_SOURCES)
            .filter(key => key === 'all' || (FILTER_SOURCES[key] || []).some(source =>
                appPool.some(app => (app.Source || app.source) === source)))
            .map(key => {
                const sources = FILTER_SOURCES[key];
                const count = key === 'all'
                    ? appPool.length
                    : appPool.filter(app => sources.includes(app.Source || app.source)).length;
                return `${key}:${count}`;
            })
            .join('|');
    }

    function _renderEmptyInstalledAppsList(appList) {
        appList.innerHTML = `
            <div class="app-scan-empty">
                <div class="app-scan-pulse"></div>
                <div>
                    <strong>Procurando jogos e aplicativos</strong>
                    <span>Os primeiros resultados aparecem aqui assim que forem encontrados.</span>
                </div>
            </div>`;
    }

    // Respostas da checagem leve não são uma troca de tela. Mantemos o DOM, o scroll
    // e o foco atuais; só os cards que realmente mudaram são atualizados.
    function _patchInstalledAppsModalInPlace() {
        const modal = document.getElementById('addGameContainer');
        const appList = document.getElementById('appList');
        if (!modal || modal.style.display === 'none' || !appList) return;

        const focusSnapshot = _captureInstalledAppsModalFocus();
        const nextFilterSignature = _filterBarSignature(allInstalledApps);
        const currentFilterSignature = Array.from(document.querySelectorAll('#filterBar .filter-btn'))
            .map(button => `${button.dataset.source}:${button.querySelector('.filter-count')?.textContent || '0'}`)
            .join('|');

        if (nextFilterSignature !== currentFilterSignature) {
            buildFilterBar(allInstalledApps);
        }

        const filtered = currentSourceFilter.includes('all')
            ? allInstalledApps
            : allInstalledApps.filter(app => currentSourceFilter
                .flatMap(filter => FILTER_SOURCES[filter] || [])
                .includes(app.Source || app.source));
        const visibleApps = filtered.filter(app => (app.AddedTo || app.addedTo) !== 'media');

        if (visibleApps.length === 0) {
            _renderEmptyInstalledAppsList(appList);
        } else {
            _syncModalAppList(appList, visibleApps, {
                counterId: 'selectionCounter',
                textId: 'selectionCounterText'
            });
        }

        document.getElementById('modalActions').style.display = 'flex';
        _modalReady = true;
        _restoreInstalledAppsModalFocus(focusSnapshot);
    }

let _modalTransitionId = 0;

function openAddModal(kind) {
    if (window.DoorpiIntro?.isRunning?.() || isSetupOpen) return;

    isModalOpen = true;
    window.updateDoorpiQuickMenuAvailability?.();
    _modalReady = false;
    _addModalUserInteracted = false;

    const modal = document.getElementById('addGameContainer');
    const modalActions = document.getElementById('modalActions');
    const mediaActions = document.getElementById('mediaAppActions');
    const title = document.getElementById('modalTitle');
    const transitionId = ++_modalTransitionId;

    modalActions.style.display = 'none';
    if (mediaActions) mediaActions.style.display = 'none';
    document.getElementById('gameGrid').style.overflowX = 'hidden';
    modal.classList.remove('is-closing');
    resetAddModalScrollPosition();
    modal.style.display = 'flex';
    if (!modal.dataset.interactionTrackerBound) {
        modal.dataset.interactionTrackerBound = 'true';
        ['pointerdown', 'keydown'].forEach(type => {
            modal.addEventListener(type, () => { _addModalUserInteracted = true; }, true);
        });
    }
    requestAnimationFrame(() => {
        if (transitionId === _modalTransitionId) modal.classList.add('is-open');
    });

    if (kind === 'stores') {
        switchTab('stores');
        return;
    }

    title.innerText = t('detectingLibrary');
    const isMedia = kind === 'media';
    window.setInlineScanStatus(true, t(isMedia ? 'inlineScanSearchingApps' : 'inlineScanSearchingGames'));
    switchTab(isMedia ? 'media-apps' : 'apps');
    postToHost({ action: 'requestInstalledApps', cachedOnly: true, refreshRiot: true });
}

document.getElementById('btnAdd').addEventListener('click', () => openAddModal('games'));

document.getElementById('btnAddMedia')?.addEventListener('click', () => openAddModal('media'));

document.getElementById('btnAddStore')?.addEventListener('click', () => openAddModal('stores'));

