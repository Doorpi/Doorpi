    function closeModal() {
        window._doorpiSuppressNativeDialogPointer?.(700);
        window.quarantineDoorpiGamepadActions?.(400);
        const modal = document.getElementById('addGameContainer');
        const transitionId = ++_modalTransitionId;
        modal.classList.remove('is-open');
        modal.classList.add('is-closing');
        document.getElementById('gameGrid').style.overflowX = 'auto';
        document.getElementById('selectionCounter')?.classList.remove('visible');
        isModalOpen = false;
        window.updateDoorpiQuickMenuAvailability?.();
        hideGlobalLoading();

        postToHost({ action: 'stopAppPolling' });
        window.setTimeout(() => {
            if (transitionId !== _modalTransitionId) return;
            modal.style.display = 'none';
            modal.classList.remove('is-closing');
            window.focusFeaturedCard?.();
        }, 210);
    }

    function formatBytes(kb) {
        if (!kb) return '';
        const mb = kb / 1024;
        return mb > 1024 ? t('unitGB', (mb / 1024).toFixed(2)) : t('unitMB', mb.toFixed(0));
    }

    function _modalEscapeHtml(value) {
        const text = String(value ?? '');
        if (typeof escapeHtml === 'function') return escapeHtml(text);
        return text.replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }

    function _modalAppKey(app) {
        const emulatorId = app?.EmulatorId || app?.emulatorId || '';
        const romPath = app?.RomPath || app?.romPath || app?.Path || app?.path || '';
        if (emulatorId && romPath) return `emulator:${emulatorId}:${romPath}`.trim().toLowerCase();
        const launch = app?.LaunchUrl || app?.launchUrl || '';
        const path = app?.Path || app?.path || '';
        const name = app?.Name || app?.name || '';
        const source = app?.Source || app?.source || '';
        return String(launch || path || `${source}:${name}`).trim().toLowerCase();
    }

    function _updateModalSelectionCounter(list, counterId, textId) {
        const count = list?.querySelectorAll('.app-item.selected')?.length || 0;
        const counter = document.getElementById(counterId);
        const text = document.getElementById(textId);
        if (text) text.innerText = count === 1 ? t('selectedOne') : t('selectedMany', count);
        counter?.classList.toggle('visible', count > 0);
    }

    function _bindModalAppSelection(item, options = {}) {
        item.onclick = function () {
            if (this.classList.contains('already-added') || this.classList.contains('admin-locked')) return;
            this.classList.toggle('selected');
            _updateModalSelectionCounter(
                this.parentElement,
                options.counterId || 'selectionCounter',
                options.textId || 'selectionCounterText'
            );
        };
    }

    function _updateModalAppItem(item, app, options = {}) {
        const isMedia = options.media === true;
        const isAdded = app.IsAdded === true || app.isAdded === true;
        const icon = app.IconBase64 || app.iconBase64 || '';
        const name = app.Name || app.name || '';
        const path = app.Path || app.path || '';
        const size = app.Size ?? app.size;
        const launch = app.LaunchUrl || app.launchUrl || '';
        const source = app.Source || app.source || '';
        const isAdminLocked = !isMedia && (app.IsAdminLocked === true || app.isAdminLocked === true);
        const addState = app.AddState || app.addState || '';
        const isPreparing = !isMedia && (addState === 'preparing' || (app.AddedTo || app.addedTo) === 'preparing-game');
        const stateLabel = isMedia ? '' : (isPreparing ? 'Preparando capa' : (isAdded ? 'Já adicionado' : ''));
        const disabled = isAdded || isAdminLocked;
        const wasSelected = item.classList.contains('selected') && !disabled;

        item.className = `app-item ${isAdded ? 'already-added' : ''} ${isAdminLocked ? 'already-added admin-locked' : ''} ${isPreparing ? 'preparing-artwork' : ''}`.trim();
        if (disabled) item.removeAttribute('tabindex');
        else item.setAttribute('tabindex', '0');

        item.dataset.appKey = _modalAppKey(app);
        item.dataset.path = path;
        item.dataset.launch = launch;
        item.dataset.name = name;
        item.dataset.source = source || '';
        item.dataset.iconBase64 = icon || '';
        item.dataset.emulatorId = app.EmulatorId || app.emulatorId || '';
        item.dataset.romPath = app.RomPath || app.romPath || '';
        item.dataset.launchCommand = app.LaunchCommand || app.launchCommand || '';
        item.dataset.emulatorDetectedName = app.EmulatorDetectedName || app.emulatorDetectedName || '';
        item.dataset.emulatorDiscPaths = JSON.stringify(app.EmulatorDiscPaths || app.emulatorDiscPaths || []);

        item.innerHTML = `
            ${icon ? `<img class="app-icon" src="data:image/png;base64,${icon}" />` : ''}
            <div class="app-item-info">
                <span class="app-name">${_modalEscapeHtml(name)}</span>
                ${!isMedia && size ? `<span class="size">${formatBytes(size)}</span>` : ''}
                ${stateLabel ? `<span class="app-state">${_modalEscapeHtml(stateLabel)}</span>` : ''}
            </div>
            ${getPlatformBadge(source)}`;

        if (wasSelected) item.classList.add('selected');
        _bindModalAppSelection(item, options);
    }

    function _dedupeModalApps(apps) {
        const uniqueApps = [];
        const seenInputKeys = new Set();
        (apps || []).forEach(app => {
            const key = _modalAppKey(app);
            if (!key || seenInputKeys.has(key)) return;
            seenInputKeys.add(key);
            uniqueApps.push(app);
        });
        return uniqueApps;
    }

    function _modalAppSignature(app) {
        return [
            _modalAppKey(app),
            app?.Name || app?.name || '',
            app?.Source || app?.source || '',
            app?.IconBase64 || app?.iconBase64 || '',
            app?.IsAdded === true || app?.isAdded === true ? '1' : '0',
            app?.AddedTo || app?.addedTo || '',
            app?.AddState || app?.addState || '',
            (app?.EmulatorDiscPaths || app?.emulatorDiscPaths || []).join('|'),
            app?.IsAdminLocked === true || app?.isAdminLocked === true ? '1' : '0',
            app?.AdminLockReason || app?.adminLockReason || ''
        ].join('\u001f');
    }

    function _modalAppListsAreEqual(current, next) {
        if (current.length !== next.length) return false;
        return current.every((app, index) => _modalAppSignature(app) === _modalAppSignature(next[index]));
    }

    function _replaceInstalledAppsIfChanged(apps) {
        const next = _dedupeModalApps(apps);
        if (_modalAppListsAreEqual(allInstalledApps, next)) return false;
        allInstalledApps = next;
        return true;
    }

    function _captureInstalledAppsModalFocus() {
        const modal = document.getElementById('addGameContainer');
        const active = document.activeElement;
        if (!modal || !active || !modal.contains(active)) return null;

        const item = active.closest?.('.app-item[data-app-key]');
        if (item) return { type: 'app', key: item.dataset.appKey || '' };

        if (active.matches?.('.filter-btn[data-source]')) {
            return { type: 'filter', source: active.dataset.source || '' };
        }

        return active.id ? { type: 'id', id: active.id } : null;
    }

    function _restoreInstalledAppsModalFocus(snapshot) {
        if (!snapshot) return;

        let target = null;
        if (snapshot.type === 'app' && snapshot.key) {
            target = document.querySelector(`.app-item[data-app-key="${CSS.escape(snapshot.key)}"]`);
        } else if (snapshot.type === 'filter' && snapshot.source) {
            target = document.querySelector(`.filter-btn[data-source="${CSS.escape(snapshot.source)}"]`);
        } else if (snapshot.type === 'id' && snapshot.id) {
            target = document.getElementById(snapshot.id);
        }

        if (target && !target.disabled && target.offsetWidth > 0 && target.offsetHeight > 0) {
            target.focus({ preventScroll: true });
        }
    }

    function _syncModalAppList(appList, apps, options = {}) {
        if (!appList) return;

        const active = document.activeElement;
        const activeKey = appList.contains(active) ? active?.dataset?.appKey || '' : '';
        const uniqueApps = _dedupeModalApps(apps);
        const selectedKeys = new Set(
            Array.from(appList.querySelectorAll('.app-item.selected[data-app-key]'))
                .map(el => el.dataset.appKey)
                .filter(Boolean)
        );
        const existing = new Map();
        Array.from(appList.querySelectorAll('.app-item[data-app-key]')).forEach(el => {
            const key = el.dataset.appKey || '';
            if (!key) return;
            if (existing.has(key)) {
                el.remove();
                return;
            }
            existing.set(key, el);
        });

        const fragment = document.createDocumentFragment();
        uniqueApps.forEach(app => {
            const key = _modalAppKey(app);
            if (!key) return;
            let item = existing.get(key);
            if (!item) {
                item = document.createElement('div');
                item.dataset.appKey = key;
            }
            _updateModalAppItem(item, app, options);
            if (selectedKeys.has(key) && !item.classList.contains('already-added') && !item.classList.contains('admin-locked')) {
                item.classList.add('selected');
            }
            fragment.appendChild(item);
            existing.delete(key);
        });

        appList.querySelectorAll('.app-scan-empty').forEach(el => el.remove());
        appList.appendChild(fragment);
        existing.forEach(el => el.remove());

        _updateModalSelectionCounter(
            appList,
            options.counterId || 'selectionCounter',
            options.textId || 'selectionCounterText'
        );

        if (activeKey) {
            const stillFocused = document.activeElement?.dataset?.appKey === activeKey;
            if (!stillFocused) {
                appList.querySelector(`.app-item[data-app-key="${CSS.escape(activeKey)}"]`)
                    ?.focus({ preventScroll: true });
            }
        }
    }

    function populateAppModal(apps) {
        const titleEl = document.getElementById('modalTitle');
        titleEl.innerText = currentSourceFilter.includes('all') ? t('selectApps') : t('showingStore', currentSourceFilter);

        const rebind = (id, fn) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const fresh = btn.cloneNode(true);
            btn.replaceWith(fresh);
            fresh.addEventListener('click', fn);
        };

        rebind('btnSearch', () => {

            if (document.getElementById('modalActions').style.display === 'none') {
                const activeView = document.querySelector('.view-section.active')?.id;

    
                if (activeView === 'view-folders') {
                    document.getElementById('btnScanFolder')?.click();
                }
             
                else if (activeView === 'view-media-apps' && document.getElementById('subview-exe')?.classList.contains('active')) {
                    document.getElementById('btnSearchMedia')?.click();
                }
                return; 
            }

           
            window.setInlineScanStatus?.(true, t('inlineScanWaitingWindows'));
            window._doorpiSuppressNativeDialogPointer?.(10 * 60 * 1000);
            postToHost({
                action: 'browseManual',
                dialogTitle: t('dlgBrowseTitle'),
                dialogFilter: t('dlgBrowseFilter'),
                loadingTitle: t('loadingAddingGame'),
                loadingSub: t('loadingFetchingCovers'),
                errorMsg: t('msgErrorOpenFile')
            });
        });

        rebind('btnScanFolder', () => {
            window.setInlineScanStatus?.(true, t('inlineScanWaitingWindows'));
            window._doorpiSuppressNativeDialogPointer?.(10 * 60 * 1000);
            postToHost({
                action: 'pickFolder',
                dialogTitle: t('dlgFolderTitle'),
                forbiddenMsg: t('msgFolderForbidden'),
                forbiddenTitle: t('msgFolderForbiddenTitle'),
                errorMsg: t('msgErrorOpenFolder')
            });
        });
        buildFilterBar(allInstalledApps);

        const appList = document.getElementById('appList');
        if (!apps || apps.length === 0) {
            appList.innerHTML = `
            <div class="app-scan-empty">
                <div class="app-scan-pulse"></div>
                <div>
                    <strong>Procurando jogos e aplicativos</strong>
                    <span>Os primeiros resultados aparecem aqui assim que forem encontrados.</span>
                </div>
            </div>`;
            document.getElementById('modalActions').style.display = 'flex';
            document.getElementById('selectionCounter')?.classList.remove('visible');
            rebindActionButtons();

      
            if (!isFolderOperationInProgress) _modalReady = true;
            return;
        }

        _syncModalAppList(appList, apps, {
            counterId: 'selectionCounter',
            textId: 'selectionCounterText'
        });
        document.getElementById('modalActions').style.display = 'flex';
        if (false) {
        appList.innerHTML = apps.map(app => {
            const isAdded = app.IsAdded === true || app.isAdded === true;
            const icon = app.IconBase64 || app.iconBase64;
            const name = app.Name || app.name;
            const path = app.Path || app.path;
            const size = app.Size ?? app.size;
            const launch = app.LaunchUrl || app.launchUrl || '';
            const source = app.Source || app.source;
            const isAdminLocked = app.IsAdminLocked === true || app.isAdminLocked === true;
            const addState = app.AddState || app.addState || '';
            const isPreparing = addState === 'preparing' || (app.AddedTo || app.addedTo) === 'preparing-game';
            const stateLabel = isPreparing ? 'Preparando capa' : (isAdded ? 'Já adicionado' : '');

            return `
            <div class="app-item ${isAdded ? 'already-added' : ''} ${isAdminLocked ? 'already-added admin-locked' : ''} ${isPreparing ? 'preparing-artwork' : ''}" ${isAdded || isAdminLocked ? '' : 'tabindex="0"'}
                 data-path="${path.replace(/\\/g, '\\\\')}" data-launch="${launch}"
                 data-name="${name.replace(/"/g, '&quot;')}" data-source="${source || ''}" data-icon-base64="${icon || ''}">
                ${icon ? `<img class="app-icon" src="data:image/png;base64,${icon}" />` : ''}
                <div class="app-item-info">
                    <span class="app-name">${name}</span>
                    ${size ? `<span class="size">${formatBytes(size)}</span>` : ''}
                    ${stateLabel ? `<span class="app-state">${stateLabel}</span>` : ''}
                </div>
                ${getPlatformBadge(source)}
            </div>`;
        }).join('');

        document.getElementById('modalActions').style.display = 'flex';
        document.getElementById('selectionCounter')?.classList.remove('visible');

        appList.querySelectorAll('.app-item:not(.already-added)').forEach(item =>
            item.addEventListener('click', function () {
                this.classList.toggle('selected');
                const count = appList.querySelectorAll('.app-item.selected').length;
                const counter = document.getElementById('selectionCounter');
                const text = document.getElementById('selectionCounterText');
                if (text) text.innerText = count === 1 ? t('selectedOne') : t('selectedMany', count);
                counter?.classList.toggle('visible', count > 0);
            })
        );
        }

        function rebindAction(id, fn) {
            const btn = document.getElementById(id);
            if (!btn) return;
            const fresh = btn.cloneNode(true);
            btn.replaceWith(fresh);
            fresh.addEventListener('click', fn);
        }

        function rebindActionButtons() {
        rebindAction('btnCancelAdd', closeModal);
        rebindAction('btnConfirmAdd', () => {
            // Verifica se a ABA PRINCIPAL DE MÍDIA é a que está visível na tela no momento
            const isMediaViewActive = document.getElementById('view-media-apps')?.classList.contains('active');

            // Se a tela de Mídia estiver aberta, repassa a ação para o controle funcionar nela
            if (isMediaViewActive) {
                if (document.getElementById('subview-web')?.classList.contains('active')) {
                    document.getElementById('btnAddWebApp')?.click();
                } else {
                    document.getElementById('btnConfirmAddMedia')?.click();
                }
                return;
            }

            // Lógica normal se estivermos na aba de JOGOS (view-apps)
            const selected = Array.from(appList.querySelectorAll('.app-item.selected')).map(el => {
                let emulatorDiscPaths = [];
                try { emulatorDiscPaths = JSON.parse(el.dataset.emulatorDiscPaths || '[]'); } catch { }
                return {
                    Name: el.dataset.name, Path: el.dataset.path, LaunchUrl: el.dataset.launch, Source: el.dataset.source || '', IconBase64: el.dataset.iconBase64 || '',
                    EmulatorId: el.dataset.emulatorId || '', RomPath: el.dataset.romPath || '', LaunchCommand: el.dataset.launchCommand || '', EmulatorDetectedName: el.dataset.emulatorDetectedName || '',
                    EmulatorDiscPaths: emulatorDiscPaths
                };
            });

            if (selected.length > 0) {
                selected.forEach(g => newGameIdsThisSession.add(g.LaunchUrl || g.Path));
                postToHost({ action: 'addSelectedGames', games: selected });
                showLoadingCards(selected.length, 'games');
                closeModal(); // Fecha instantaneamente e deixa os skeletons na UI
            } else {
                closeModal();
            }
        });
        }
        rebindActionButtons();

        // CORREÇÃO: Removemos o hideGlobalLoading() daqui também!
        if (!isFolderOperationInProgress) _modalReady = true;
    }

    /* Seção: Pastas */
    function renderStoreInstallList() {
        const list = document.getElementById('storeInstallList');
        if (!list) return;

        const stores = supportedStores || [];
        if (!stores.length) {
            list.innerHTML = `
                <div class="folder-empty">
                    <div class="folder-empty-icon">+</div>
                    <div class="folder-empty-text">${t('storesLoading')}</div>
                    <div class="folder-empty-hint">${t('storesLoadingHint')}</div>
                </div>`;
            return;
        }

        list.innerHTML = stores.map(store => {
            const id = store.Id || store.id || '';
            const name = store.Name || store.name || id;
            const installed = store.installed === true || store.Installed === true;
            const downloadUrl = store.downloadUrl || store.DownloadUrl || '';
            const logo = store.LogoStaticImage || store.logoStaticImage || store.LogoImage || store.logoImage || '';
            const grid = store.GridStaticImage || store.gridStaticImage || store.GridImage || store.gridImage || '';
            const image = logo || grid;
            const statusLabel = installed ? t('storeInstalled') : t('storeNotInstalled');
            const actionLabel = installed ? t('storeAlreadyInstalled') : t('storeOpenSite');
            const isRiot = String(id).toLowerCase() === 'riot';
            const riotInstallHint = isRiot && !installed
                ? `<small class="store-install-note">${escapeHtml(t('storeInstallRiotNote'))}</small>
                   <span class="store-install-pair" aria-hidden="true">
                       <span>Riot Client</span>
                       <span>2XKO</span>
                   </span>`
                : '';

            return `
                <button class="store-install-card ${installed ? 'installed' : ''}" type="button" tabindex="${installed || !downloadUrl ? '-1' : '0'}"
                        data-store-id="${escapeHtml(id)}" data-store-name="${escapeHtml(name)}" data-download-url="${escapeHtml(downloadUrl)}"
                        ${installed || !downloadUrl ? 'aria-disabled="true"' : ''}>
                    <span class="store-install-art">
                        ${image ? `<img src="${escapeHtml(image)}" alt="" />` : `<span>${escapeHtml((name || '?').charAt(0).toUpperCase())}</span>`}
                    </span>
                    <span class="store-install-info">
                        <strong>${escapeHtml(name)}</strong>
                        <small>${escapeHtml(statusLabel)}</small>
                        ${riotInstallHint}
                    </span>
                    <span class="store-install-action">${escapeHtml(actionLabel)}</span>
                </button>`;
        }).join('');

        list.querySelectorAll('.store-install-card').forEach(card => {
            card.addEventListener('click', () => {
                if (card.classList.contains('installed')) return;
                const url = card.dataset.downloadUrl || '';
                const storeId = card.dataset.storeId || '';
                const name = card.dataset.storeName || '';
                if (!url) return;
                if (window.hasStoreDownloadBlockingRuntime?.()) {
                    window.showStoreDownloadSessionConflict?.({ storeId, url, name });
                    return;
                }
                postToHost({ action: 'openStoreDownloadSite', storeId, url, name });
            });
        });

        requestAnimationFrame(() => {
            _modalReady = true;
            (list.querySelector('.store-install-card:not(.installed):not([aria-disabled="true"])')
                || document.querySelector('#view-stores .action-buttons button'))?.focus();
        });
    }

    window.setSupportedStoresForModal = function (stores) {
        supportedStores = Array.isArray(stores) ? stores : [];
        const activeView = document.querySelector('.view-section.active')?.id;
        if (activeView === 'view-stores') renderStoreInstallList();
    };

    function requestFolders() {
        postToHost({ action: 'requestFolders' });
    }

