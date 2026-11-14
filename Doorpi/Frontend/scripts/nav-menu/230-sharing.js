    function _renderSettingsSharing(body) {
        if (!document.getElementById('nav-sharing-v2-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-sharing-v2-styles';
            s.textContent = __doorpiCss("injected-styles/nav-menu/nav-sharing-v2-styles.css");
            document.head.appendChild(s);
        }

        if (!Array.isArray(window._doorpiUsers) || window._doorpiUsers.length === 0) {
            if (typeof postToHost === 'function') postToHost({ action: 'requestUsersData' });
        }

        const currentUserId = _userId(_menuData.user) || _userId(window._doorpiProfile) || window._doorpiCurrentUserId || '';
        const users = (window._doorpiUsers || []).filter(u => _userId(u));
        const shareUsers = users.filter(u => !_sameId(_userId(u), currentUserId));
        const apps = (_menuData.media || []).filter(app => _isWebAccountApp(app));
        const isAdmin = !!window._doorpiIsAdmin || !!(window._doorpiProfile?.IsAdmin || window._doorpiProfile?.isAdmin);
        const tabs = isAdmin
            ? [
                { id: 'apps', label: _t('sharingTabApps', 'Streaming e mídia') },
                { id: 'stores', label: _t('sharingTabStores', 'Lojas') }
            ]
            : [{ id: 'apps', label: _t('sharingTabApps', 'Streaming e mídia') }];
        if (!tabs.some(tab => tab.id === _sharingSubView)) _sharingSubView = 'apps';

        const betaStores = [
            { id: 'Steam', name: 'Steam', steam: true },
            { id: 'Epic', name: 'Epic Games' },
            { id: 'GOG', name: 'GOG' },
            { id: 'Riot', name: 'Riot Games' },
            { id: 'Xbox', name: 'Xbox' }
        ];
        const rawBlockedStores = window._adminBlockedStoreIds instanceof Set
            ? Array.from(window._adminBlockedStoreIds)
            : (Array.isArray(window._adminBlockedStoreIds) ? window._adminBlockedStoreIds : []);
        const blockedStoreKeys = new Set(rawBlockedStores.map(id => String(id || '').trim().toLowerCase()).filter(Boolean));
        const isStoreBlocked = (id) => blockedStoreKeys.has(String(id || '').trim().toLowerCase());
        const storeStatus = (store) => {
            const blocked = isStoreBlocked(store.id);
            if (store.steam && window._steamForceAccountSelection) {
                return blocked ? _t('storePolicyStatusPrivateSteam', 'Privada + seletor') : _t('storePolicyStatusSteam', 'Seletor Steam');
            }
            return blocked ? _t('storePolicyStatusPrivate', 'Privada') : _t('storePolicyStatusOpen', 'Liberada');
        };

        let selectedAppId = _sharingFocusAppId || _appId(apps[0]) || '';
        let selectedApp = apps.find(app => _sameId(_appId(app), selectedAppId)) || apps[0] || null;
        if (selectedApp) selectedAppId = _appId(selectedApp);
        let selectedStore = betaStores.find(store => _sameId(store.id, _sharingFocusStoreId)) || betaStores[0];
        _sharingFocusStoreId = selectedStore?.id || 'Steam';

        const sharedIdsOf = (app) => {
            const ids = Array.isArray(app?.SharedWithUserIds || app?.sharedWithUserIds)
                ? (app.SharedWithUserIds || app.sharedWithUserIds)
                : [];
            const legacy = app?.SharedWithUserId || app?.sharedWithUserId || '';
            return [...ids, legacy].filter(Boolean).filter(id => !_sameId(id, currentUserId));
        };
        let draftMode = selectedApp?.ShareMode || selectedApp?.shareMode || 'private';
        let draftUsers = new Set(sharedIdsOf(selectedApp));

        const appStatus = (app) => {
            if (app.IsSharedFromOtherUser || app.isSharedFromOtherUser)
                return app.SharedFromUserName || app.sharedFromName || _t('sharedFromOther', 'Compartilhado');
            const mode = app.ShareMode || app.shareMode || 'private';
            if (mode === 'all') return _t('shareModeAll', 'Publico');
            if (mode === 'user') {
                const names = app.SharedWithUserNames || app.sharedWithUserNames || [];
                return names.length ? names.join(', ') : _t('shareModeUser', 'Usuarios');
            }
            return _t('shareModePrivate', 'Separado');
        };
        const userAvatar = (u) => (u.PhotoBase64 || u.photoBase64)
            ? `<img src="${window._doorpiUserPhotoSrc?.(u.PhotoBase64 || u.photoBase64) || `data:image/png;base64,${u.PhotoBase64 || u.photoBase64}`}" />`
            : _esc((_userName(u) || '?').charAt(0).toUpperCase());

        const listHtml = _sharingSubView === 'stores'
            ? betaStores.map(store => `<button class="nav-sharing-app ${_sameId(store.id, _sharingFocusStoreId) ? 'active' : ''}" data-store-id="${_esc(store.id)}" tabindex="-1">
                    <span>${_esc(store.name)}</span>
                    <small>${_esc(storeStatus(store))}</small>
                </button>`).join('')
            : (apps.length ? apps.map(app => {
                const id = _appId(app);
                return `<button class="nav-sharing-app ${id === selectedAppId ? 'active' : ''}" data-app-id="${_esc(id)}" tabindex="-1">
                    <span>${_esc(_appName(app))}</span>
                    <small>${_esc(appStatus(app))}</small>
                </button>`;
            }).join('') : `<div class="nav-sharing-sub">${_t('navNoMedia', 'Nenhum app configurado')}</div>`);

        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBackSharing" tabindex="-1">< ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('accountSharingLabel', 'Compartilhamento de conta')}</h2>
            </div>
            <div class="nav-sharing-tabs">
                ${tabs.map(tab => `<button class="nav-sharing-tab ${tab.id === _sharingSubView ? 'active' : ''}" data-sharing-tab="${tab.id}" tabindex="-1">${tab.label}</button>`).join('')}
            </div>
            <div class="nav-sharing-layout">
                <div class="nav-sharing-apps" id="navSharingApps">${listHtml}</div>
                <div class="nav-sharing-panel" id="navSharingPanel"></div>
            </div>`;

        const panel = body.querySelector('#navSharingPanel');

        const renderAppsPanel = () => {
            if (!panel) return;
            if (!selectedApp) {
                panel.innerHTML = `<p class="nav-sharing-sub">${_t('navNoMedia', 'Nenhum app configurado')}</p>`;
                return;
            }

            const appName = _appName(selectedApp);
            const sharedFrom = selectedApp.SharedFromUserName || selectedApp.sharedFromName || '';
            const locked = !!(selectedApp.IsSharedFromOtherUser || selectedApp.isSharedFromOtherUser);
            const selectedNames = Array.from(draftUsers)
                .map(id => _userName(users.find(u => _sameId(_userId(u), id))))
                .filter(Boolean);
            const currentText = locked
                ? _t('sharedByInfo', `Compartilhado por ${sharedFrom || _t('defaultOtherUser', 'outro usuário')}.`, sharedFrom || _t('defaultOtherUser', 'outro usuário'))
                : draftMode === 'all'
                    ? _t('shareStatusAll', 'Este app está público para todos os usuários atuais e futuros.')
                    : draftMode === 'user'
                        ? (selectedNames.length ? _t('shareStatusUser', `Compartilhado com ${selectedNames.join(', ')}.`, selectedNames.join(', ')) : _t('shareStatusUserEmpty', 'Escolha um ou mais usuários.'))
                        : _t('shareStatusPrivate', 'Este app usa uma conta separada para cada usuário.');

            panel.innerHTML = `
                <h3 class="nav-sharing-title">${_esc(appName)}</h3>
                <p class="nav-sharing-sub">${_esc(currentText)}</p>
                ${locked ? '' : `
                    <div class="nav-sharing-modes">
                        <button class="nav-sharing-mode ${draftMode === 'private' ? 'active' : ''}" data-mode="private" tabindex="-1">${_t('shareModePrivate', 'Separado por usuário')}</button>
                        <button class="nav-sharing-mode ${draftMode === 'user' ? 'active' : ''}" data-mode="user" tabindex="-1">${_t('shareModeUser', 'Usuarios especificos')}</button>
                        <button class="nav-sharing-mode ${draftMode === 'all' ? 'active' : ''}" data-mode="all" tabindex="-1">${_t('shareModeAll', 'Publico')}</button>
                    </div>
                    <div class="nav-sharing-users" style="${draftMode === 'user' ? '' : 'display:none;'}">
                        ${shareUsers.map(u => {
                            const uid = _userId(u);
                            const selected = Array.from(draftUsers).some(id => _sameId(id, uid));
                            return `<button class="nav-sharing-user ${selected ? 'selected' : ''}" data-user-id="${_esc(uid)}" tabindex="-1">
                                <span class="nav-sharing-avatar">${userAvatar(u)}</span>
                                <span>${_esc(_userName(u))}</span>
                            </button>`;
                        }).join('')}
                    </div>
                    <button class="nav-sharing-save" id="navSharingSave" tabindex="-1" ${draftMode === 'user' && draftUsers.size === 0 ? 'disabled' : ''}>${_t('editModalSave', 'Salvar')}</button>
                    <div class="nav-sharing-note" id="navSharingNote"></div>
                `}
            `;

            panel.querySelectorAll('.nav-sharing-mode').forEach(btn => {
                btn.addEventListener('click', () => {
                    draftMode = btn.dataset.mode || 'private';
                    renderAppsPanel();
                    refreshSharingFocus();
                });
            });
            panel.querySelectorAll('.nav-sharing-user').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.userId || '';
                    const existing = Array.from(draftUsers).find(value => _sameId(value, id));
                    if (existing) draftUsers.delete(existing);
                    else draftUsers.add(id);
                    renderAppsPanel();
                    refreshSharingFocus();
                });
            });
            panel.querySelector('#navSharingSave')?.addEventListener('click', () => {
                if (!selectedApp) return;
                const ids = draftMode === 'user' ? Array.from(draftUsers) : [];
                if (draftMode === 'user' && ids.length === 0) return;
                selectedApp.ShareMode = draftMode;
                selectedApp.shareMode = draftMode;
                selectedApp.SharedWithUserIds = ids;
                selectedApp.sharedWithUserIds = ids;
                selectedApp.SharedWithUserNames = ids.map(id => _userName(users.find(u => _sameId(_userId(u), id)))).filter(Boolean);
                selectedApp.sharedWithUserNames = selectedApp.SharedWithUserNames;
                if (typeof postToHost === 'function') {
                    window._doorpiSuppressSharingRefreshUntil = Date.now() + 1200;
                    postToHost({ action: 'updateAppSharing', appId: selectedAppId, shareMode: draftMode, sharedWithUserIds: ids });
                }
                const activeRow = Array.from(body.querySelectorAll('.nav-sharing-app'))
                    .find(btn => _sameId(btn.dataset.appId, selectedAppId));
                const statusEl = activeRow?.querySelector('small');
                if (statusEl) statusEl.textContent = appStatus(selectedApp);
                const note = panel.querySelector('#navSharingNote');
                if (note) {
                    note.textContent = _t('navSharingSaved', 'Compartilhamento salvo.');
                    clearTimeout(note._clearTimer);
                    note._clearTimer = setTimeout(() => {
                        if (document.contains(note)) note.textContent = '';
                    }, 2200);
                }
                const saveBtn = panel.querySelector('#navSharingSave');
                if (saveBtn) {
                    const idx = _contentItems.indexOf(saveBtn);
                    if (idx >= 0) _contentIdx = idx;
                    _updateContentFocus();
                }
            });
        };

        const renderStoresPanel = () => {
            if (!panel || !selectedStore) return;
            const blocked = isStoreBlocked(selectedStore.id);
            const forceSteam = selectedStore.steam && !!window._steamForceAccountSelection;
            panel.innerHTML = `
                <h3 class="nav-sharing-title">${_esc(selectedStore.name)}</h3>
                <p class="nav-sharing-sub">${_esc(_t('storePolicyDesc', 'Controle quais lojas podem ser usadas por outras contas deste Doorpi.'))}</p>
                <div class="nav-sharing-panel-actions">
                    <button class="nav-sharing-toggle ${blocked ? 'active' : ''}" data-policy="blocked" data-store-id="${_esc(selectedStore.id)}" data-active="${blocked ? 'true' : 'false'}" tabindex="-1">
                        <span class="nav-sharing-switch" aria-hidden="true"></span>
                        <span class="nav-sharing-toggle-copy">
                            <strong>${_t('storeAdminBlockToggle', 'Privar loja para outras contas')}</strong>
                            <span>${_t('storePolicyPrivateDesc', 'Impede abrir a loja e iniciar jogos dela em outros perfis.')}</span>
                        </span>
                    </button>
                    ${selectedStore.steam ? `
                    <button class="nav-sharing-toggle ${forceSteam ? 'active' : ''}" data-policy="steam-account" data-store-id="Steam" data-active="${forceSteam ? 'true' : 'false'}" tabindex="-1">
                        <span class="nav-sharing-switch" aria-hidden="true"></span>
                        <span class="nav-sharing-toggle-copy">
                            <strong>${_t('steamForceAccountSelection', 'Forçar seleção de usuário Steam')}</strong>
                            <span>${_t('steamForceAccountSelectionDesc', 'Fecha e reabre a Steam antes de iniciar jogos para exibir o seletor de usuário.')}</span>
                        </span>
                    </button>` : ''}
                </div>`;

            panel.querySelectorAll('.nav-sharing-toggle').forEach(btn => {
                btn.addEventListener('click', () => {
                    const storeId = btn.dataset.storeId || '';
                    const policy = btn.dataset.policy || '';
                    const next = btn.dataset.active !== 'true';
                    btn.dataset.active = next ? 'true' : 'false';
                    btn.classList.toggle('active', next);

                    if (policy === 'blocked') {
                        window._adminBlockedStoreIds = window._adminBlockedStoreIds instanceof Set
                            ? window._adminBlockedStoreIds
                            : new Set(Array.isArray(window._adminBlockedStoreIds) ? window._adminBlockedStoreIds : []);
                        if (next) window._adminBlockedStoreIds.add(storeId);
                        else window._adminBlockedStoreIds.delete(storeId);
                        window.AppStore?.mutations?.patchItem?.('stores', storeId, { adminStoreBlocked: next });
                        postToHost?.({ action: 'setAdminStorePolicy', storeId, blockedForNonAdmins: next });
                    } else if (policy === 'steam-account') {
                        window._steamForceAccountSelection = next;
                        window.AppStore?.mutations?.patchItem?.('stores', 'Steam', { steamForceAccountSelection: next });
                        postToHost?.({ action: 'setAdminStorePolicy', storeId: 'Steam', steamForceAccountSelection: next });
                    }

                    const row = body.querySelector(`.nav-sharing-app[data-store-id="${CSS.escape(storeId)}"] small`);
                    const updatedStore = betaStores.find(store => _sameId(store.id, storeId));
                    if (row && updatedStore) row.textContent = storeStatus(updatedStore);
                    refreshSharingFocus();
                });
            });
        };

        const renderActivePanel = () => {
            if (_sharingSubView === 'stores') renderStoresPanel();
            else renderAppsPanel();
        };

        const selectApp = (appId) => {
            _sharingFocusAppId = appId;
            selectedApp = apps.find(app => _sameId(_appId(app), appId)) || apps[0] || null;
            selectedAppId = _appId(selectedApp);
            draftMode = selectedApp?.ShareMode || selectedApp?.shareMode || 'private';
            draftUsers = new Set(sharedIdsOf(selectedApp));
            body.querySelectorAll('.nav-sharing-app').forEach(btn => btn.classList.toggle('active', btn.dataset.appId === selectedAppId));
            renderAppsPanel();
            refreshSharingFocus();
        };

        const selectStore = (storeId) => {
            selectedStore = betaStores.find(store => _sameId(store.id, storeId)) || betaStores[0];
            _sharingFocusStoreId = selectedStore.id;
            body.querySelectorAll('.nav-sharing-app').forEach(btn => btn.classList.toggle('active', _sameId(btn.dataset.storeId, _sharingFocusStoreId)));
            renderStoresPanel();
            refreshSharingFocus();
        };

        function refreshSharingFocus() {
            _contentItems = [
                body.querySelector('#setBackSharing'),
                ...Array.from(body.querySelectorAll('.nav-sharing-tab')),
                ...Array.from(body.querySelectorAll('.nav-sharing-app')),
                ...Array.from(body.querySelectorAll('.nav-sharing-mode, .nav-sharing-user, .nav-sharing-save, .nav-sharing-toggle')).filter(el => !el.disabled && el.offsetParent !== null)
            ].filter(Boolean);
            _contentItems.forEach((el, idx) => {
                el.onmouseenter = () => {
                    _topbarFocus = false;
                    _contentIdx = idx;
                    _updateContentFocus();
                };
            });
        }

        body.querySelector('#setBackSharing')?.addEventListener('click', () => {
            _settingsSubView = 'accountHub';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelectorAll('.nav-sharing-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                _sharingSubView = btn.dataset.sharingTab || 'apps';
                _contentIdx = 1;
                _renderSettingsSharing(body);
                _updateContentFocus();
            });
        });
        body.querySelectorAll('.nav-sharing-app').forEach(btn => {
            btn.addEventListener('click', () => {
                if (_sharingSubView === 'stores') selectStore(btn.dataset.storeId || '');
                else selectApp(btn.dataset.appId || '');
            });
        });

        window._doorpiUsersDataReady = () => {
            if (_settingsSubView === 'sharing' && window.isNavMenuOpen) {
                if (Date.now() < (window._doorpiSuppressSharingRefreshUntil || 0)) return;
                _renderSettingsSharing(body);
                _updateContentFocus();
            }
        };

        renderActivePanel();
        refreshSharingFocus();
        const focusedSelector = _sharingSubView === 'stores'
            ? `.nav-sharing-app[data-store-id="${CSS.escape(_sharingFocusStoreId)}"]`
            : (_sharingFocusAppId ? `.nav-sharing-app[data-app-id="${CSS.escape(_sharingFocusAppId)}"]` : '');
        const focused = focusedSelector ? body.querySelector(focusedSelector) : null;
        const idx = focused ? _contentItems.indexOf(focused) : 0;
        _contentIdx = idx >= 0 ? idx : 0;
    }

