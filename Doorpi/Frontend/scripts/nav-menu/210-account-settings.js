    function _renderSettingsAccountHub(body) {
        const svgProfile = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const svgShare = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-4.2M8.6 13.4l6.8 4.2"/></svg>`;

        const entries = [
            { id:'setProfileData', icon:svgProfile, title:_t('navAccountProfileData', 'Dados do perfil'), description:_t('navAccountProfileDataDesc', 'Avatar, nome, segurança e sincronização da sua conta') },
            { id:'setAccountSharing', icon:svgShare, title:_t('navSetSharing', 'Contas dos apps'), description:_t('navSetSharingDesc', 'Defina com clareza quem pode usar cada conta conectada') }
        ];
        body.innerHTML = _settingsDirectoryMarkup('setBackAccountHub', _t('navSetAccount', 'Conta e Perfil'), entries);
        _wireSettingsDirectory(body, entries);

        _contentItems = [
            body.querySelector('#setBackAccountHub'),
            body.querySelector('#setProfileData'),
            body.querySelector('#setAccountSharing')
        ].filter(Boolean);

        body.querySelector('#setBackAccountHub')?.addEventListener('click', () => {
            _settingsSubView = null;
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setProfileData')?.addEventListener('click', () => {
            _settingsSubView = 'account';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setAccountSharing')?.addEventListener('click', () => {
            _settingsSubView = 'sharing';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });

        _contentItems.forEach((el, idx) => {
            el.addEventListener('mouseenter', () => {
                _topbarFocus = false;
                _contentIdx = idx;
                _updateContentFocus();
            });
        });
    }

    let _initialAccountSection = 'identity';
    function _renderSettingsAccount(body) {
        if (!document.getElementById('nav-account-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-account-styles';
            s.textContent = __doorpiCss("injected-styles/nav-menu/nav-account-styles.css");
            document.head.appendChild(s);
        }

        let pendingName = _menuData.user.Name || '';
        let pendingPin = '';
        let apiConfigured = !!(_menuData.user.HasSteamGridApiKey || _menuData.user.hasSteamGridApiKey);
        let pinConfigured = !!(_menuData.user.HasPin || _menuData.user.hasPin);
        let applicationHistoryEnabled = _menuData.user.ApplicationHistoryEnabled !== false && _menuData.user.applicationHistoryEnabled !== false;
        const user = _menuData.user;
        const photo = user.AvatarFromGame && user.GameAvatarUrl || user.PhotoBase64 || user.PhotoSourceUrl || '';
        const photoMarkup = window._doorpiProfilePhotoMarkup?.(user) ||
            (photo ? `<img src="${window._doorpiUserPhotoSrc?.(photo) || `data:image/png;base64,${photo}`}" />` : '◉');

        const maskApi = () => apiConfigured
            ? _t('navApiConfigured', 'Chave configurada')
            : _t('navApiNotConfigured', 'Nenhuma chave configurada');

        const maskPin = () => pinConfigured
            ? _t('navPinConfigured', 'PIN configurado')
            : _t('setupPinPlaceholder', 'Sem PIN');

        const _saveProfileNow = (patch = {}) => {
            if (Object.prototype.hasOwnProperty.call(patch, 'name')) pendingName = patch.name;
            const hasPinPatch = Object.prototype.hasOwnProperty.call(patch, 'pin');
            const hasHistoryPatch = Object.prototype.hasOwnProperty.call(patch, 'applicationHistoryEnabled');
            if (hasPinPatch) { pendingPin = patch.pin; pinConfigured = !!pendingPin; }
            if (hasHistoryPatch) applicationHistoryEnabled = patch.applicationHistoryEnabled !== false;
            _menuData.user.Name = pendingName;
            _menuData.user.SteamGridApiKey = '';
            _menuData.user.PinCode = '';
            _menuData.user.HasSteamGridApiKey = apiConfigured;
            _menuData.user.HasPin = pinConfigured;
            _menuData.user.ApplicationHistoryEnabled = applicationHistoryEnabled;
            if (window._doorpiProfile) {
                window._doorpiProfile.Name = pendingName;
                window._doorpiProfile.SteamGridApiKey = '';
                window._doorpiProfile.PinCode = '';
                window._doorpiProfile.HasSteamGridApiKey = apiConfigured;
                window._doorpiProfile.HasPin = pinConfigured;
                window._doorpiProfile.ApplicationHistoryEnabled = applicationHistoryEnabled;
            }
            if (typeof postToHost === 'function') {
                const message = {
                    action: 'saveUserProfile',
                    name: pendingName,
                    photoBase64: _menuData.user.PhotoBase64 || '',
                    skipTasks: true
                };
                if (hasPinPatch) message.pin = pendingPin;
                if (hasHistoryPatch) message.applicationHistoryEnabled = applicationHistoryEnabled;
                postToHost(message);
            }
        };

        const _normalizePin = (value) => String(value || '').replace(/\D/g, '').slice(0, 4);
        const _isValidPin = (value) => {
            const pin = _normalizePin(value);
            return pin.length === 0 || pin.length === 4;
        };

        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBack" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('navEditProfileBtn')}</h2>
            </div>
            
            <div class="nav-profile-dashboard">
                <div class="nav-profile-avatar-sec">
                    <h3>${_t('profileAppearance')}</h3>
                    <div class="nav-editor-preview"><img class="nav-editor-cover" alt="" hidden>
                    <div class="nav-profile-photo" id="navProfilePhoto">
                        ${photoMarkup}
                    </div>

                    <strong class="nav-account-identity-name">${_esc(pendingName || _t('navSetAccount', 'Perfil'))}</strong>
                    </div>
                    ${[['avatar','profileAvatar'],['cover','profileCover']].map(([part,key])=>`<fieldset class="nav-artwork-options"><legend>${_t(key)}</legend>
                        <button class="nav-icon-btn" data-art-part="${part}" data-art-mode="image" tabindex="-1">${_t('profileChooseImage')}</button>
                        <button class="nav-icon-btn" data-art-part="${part}" data-art-mode="game" tabindex="-1">${_t('profileUseGame')}</button></fieldset>`).join('')}
                    <section class="nav-account-section" data-account-panel="identity"><h3>${_t("steam.identityAccess")}</h3>
                    <div class="nav-profile-field">
                        <span class="nav-profile-field-label">${_t('navProfileNameLabel', 'Nome de Usuário')}</span>
                        <input class="nav-profile-field-input" id="navProfName" readonly value="${_esc(pendingName)}" tabindex="-1" />
                    </div>

                    <div class="nav-profile-field" style="margin-top: 10px;">
                        <span class="nav-profile-field-label">${_t('navProfilePinLabel', 'PIN de acesso (opcional)')}</span>
                        <input class="nav-profile-field-input" id="navProfPin" type="text" readonly value="${maskPin()}" inputmode="numeric" pattern="[0-9]*" maxlength="4" tabindex="-1" />
                    </div>
                    
                    </section>
                </div>
                <div class="nav-profile-fields">
                    <span id="navSaveStatus" role="status">${_t('toastChangesSaved')}</span>
                    <section class="nav-account-section" data-account-panel="connections"><h3>${_t("profileConnections")}</h3>
                    <div class="nav-profile-sync nav-connected-account" data-provider="google-drive">
                        <div class="nav-provider-heading"><span class="nav-provider-icon" aria-hidden="true">${window.DoorpiProfileSync?.googleIcon || 'G'}</span><span><strong>Google</strong><small>${_t('steam.backup')}</small></span></div>
                        <p class="nav-connected-description">${_t('steam.cloudDescription')}</p>
                        <span class="nav-profile-sync-status" id="navProfileSyncStatus"></span>
                        <div class="nav-profile-sync-actions">
                            <button class="nav-icon-btn" id="navProfileSyncConnect" tabindex="-1" title="${_t('profileSyncLoginGoogle', 'Entrar com Google')}" aria-label="${_t('profileSyncLoginGoogle', 'Entrar com Google')}">${window.DoorpiProfileSync?.googleIcon || 'G'}<span>${_t('profileSyncLoginGoogle', 'Entrar com Google')}</span></button>
                            <button class="nav-icon-btn" id="navProfileSyncNow" tabindex="-1" title="${_t('profileSyncNow', 'Sincronizar agora')}" aria-label="${_t('profileSyncNow', 'Sincronizar agora')}">${window.DoorpiProfileSync?.googleIcon || 'G'}<span>${_t('profileSyncNow', 'Sincronizar agora')}</span></button>
                            <button class="nav-icon-btn" id="navProfileSyncDisconnect" tabindex="-1" title="${_t('profileSyncDisconnect', 'Desconectar')}" aria-label="${_t('profileSyncDisconnect', 'Desconectar')}"><svg viewBox="0 0 24 24"><path d="M9 15l6-6"/><path d="M7.2 11.2 5.4 13a4 4 0 0 0 5.6 5.6l1.8-1.8"/><path d="m16.8 12.8 1.8-1.8A4 4 0 0 0 13 5.4l-1.8 1.8"/><path d="M4 4l16 16"/></svg><span>${_t('profileSyncDisconnect', 'Desconectar')}</span></button>
                        </div>
                    </div>

                    <div class="nav-profile-sync nav-connected-account" data-provider="steam">
                        <div class="nav-provider-heading"><span class="nav-provider-icon" aria-hidden="true">${PLATFORM_ICONS.Steam}</span><span><strong>Steam</strong><small>${_t('steam.features')}</small></span></div>
                        <p class="nav-connected-description"><span id="navSteamIdentity">${_t('steam.publicProfile')}</span></p>
                        <button class="nav-icon-btn nav-provider-manage" id="navSteamManage" tabindex="-1" > ${PLATFORM_ICONS.Steam}<span>${_t('steam.connect')}</span></button>
                        <span class="nav-profile-sync-status" id="navSteamConnectionState" role="status">${_t('steam.disconnected')}</span>
                        <span class="nav-profile-sync-status nav-steam-sync-message" id="navSteamSyncMessage" role="status" aria-live="polite"></span>
                        <progress id="navSteamProgress" max="100" value="0" hidden aria-label="${_t('steam.syncProgress')}"></progress>
                        <small class="nav-steam-first-sync-hint" id="navSteamFirstSyncHint" hidden>${_t('steam.firstSyncHint')}</small>
                        <button class="nav-icon-btn nav-steam-manual" id="navSteamManual" tabindex="-1" aria-expanded="false" aria-controls="navSteamControls">${_t('steam.manual')}</button>
                        <div id="navSteamControls" class="nav-steam-controls" hidden>
                        <label class="nav-profile-field-label" for="navSteamManualKey">${_t('steam.keyLabel')}</label>
                        <input class="nav-profile-field-input" id="navSteamManualKey" type="password" autocomplete="off" spellcheck="false" maxlength="64" tabindex="-1" placeholder="${_t('steam.keyPlaceholder')}" />
                        <button class="nav-icon-btn" id="navSteamSaveManualKey" tabindex="-1">${_t('steam.saveKey')}</button>
                        <p class="nav-connected-notice">${_t('steam.publicRequired')}</p>
                        <label class="nav-profile-field-label" for="navSteamAccount">${_t('steam.accountLabel')}</label>
                        <input class="nav-profile-field-input" id="navSteamAccount" readonly tabindex="-1" placeholder="https://steamcommunity.com/id/seu-perfil" maxlength="2048" />
                        <span class="nav-profile-sync-status" id="navSteamStatus" role="status" aria-live="polite"></span>
                        <span class="nav-connected-description" id="navSteamTotals"></span>
                        <button class="nav-icon-btn" id="navSteamView" tabindex="-1" aria-expanded="false">${_t('steam.importedSummary')}</button>
                        <div id="navSteamData" class="nav-steam-preview" hidden></div>
                        <div class="nav-profile-sync-actions">
                            <button class="nav-icon-btn" data-steam-action="getKey" tabindex="-1">${_t('steam.getKey')}</button>
                            <button class="nav-icon-btn" data-steam-action="pasteKey" tabindex="-1">${_t('steam.pasteKey')}</button>
                            <button class="nav-icon-btn" data-steam-action="pasteAccount" tabindex="-1">${_t('steam.pasteAccount')}</button>
                            <button class="nav-icon-btn" data-steam-action="disconnect" tabindex="-1">${_t('steam.removeKey')}</button>
                        </div>
                        <small class="nav-connected-description">${_t('steam.keyNotice')}</small>
                        </div>
                    </div>

                    <div class="nav-profile-field" style="margin-top: 10px;">
                        <span class="nav-profile-field-label">${_t('navProfileApiLabel', 'Chave API SteamGridDB')}</span>
                        <div class="nav-api-row">
                            <input class="nav-profile-field-input" id="navProfApi" readonly value="${maskApi()}" tabindex="-1" spellcheck="false" autocomplete="off" aria-describedby="navApiStatus" style="flex:1;" />
                            <button class="nav-icon-btn" id="navApiPaste" tabindex="-1">${_t('btnPaste', 'Colar')}</button>
                            <button class="nav-icon-btn" id="navApiLink" tabindex="-1">${_t('setupStep3LinkText')}</button>
                        </div>
                        <small class="nav-connected-description" id="navApiStatus" role="status"></small>
                    </div>
                    </section>
                    <section class="nav-account-section" data-account-panel="privacy"><h3>${_t("navPrivacyActivity")}</h3>
                    <button class="nav-account-toggle" id="navApplicationHistory" aria-pressed="${applicationHistoryEnabled}" tabindex="-1">
                        <span class="nav-account-toggle-copy"><strong>${_t('navApplicationHistory','Histórico de aplicativos')}</strong><small>${_t('navApplicationHistoryHint','Registra apenas mídias realmente reproduzidas nos aplicativos nativos deste perfil.')}</small></span>
                        <span class="nav-account-switch" aria-hidden="true"></span>
                    </button>

                    <span class="nav-account-section-label">${_t('navAccessMaintenance','Acesso e manutenção')}</span>
                    <button class="nav-icon-btn nav-account-route" id="navAccountSharing" tabindex="-1"><span class="nav-account-route-copy"><strong>${_t('navSetSharing', 'Contas dos apps')}</strong><small>${_t('steam.sharingHint')}</small></span><span class="nav-account-route-chevron">›</span></button>
                    <button class="nav-icon-btn nav-btn-danger" id="navDeleteUser" tabindex="-1"><span>${_t('steam.deleteProfile')}</span></button>
                    </section>
                </div>
            </div>`;

        body.querySelector('#setBack')?.addEventListener('click', event => {
            if (event.currentTarget.dataset.returnToProfile) {
                _preserveSettingsSubViewOnce = true;
                _settingsSubView = null;
                _selectCat(CATS.findIndex(cat=>cat.id==='profile'));
                _contentIdx = Math.max(0,_contentItems.findIndex(el=>el.id==='btnEditProfileHub'));
                _setTopbarFocus(false);
                return;
            }
            _settingsSubView = 'accountHub';
            _contentIdx = 0;
            document.activeElement?.blur(); 
            requestAnimationFrame(() => {
                _renderContent('settings');
                _updateContentFocus();
            });
        });

        const photoBtn = body.querySelector('#navProfilePhoto');
        const nameInput = body.querySelector('#navProfName');
        const pinInput = body.querySelector('#navProfPin');
        const apiInput = body.querySelector('#navProfApi');
        const pasteBtn = body.querySelector('#navApiPaste');
        const linkBtn = body.querySelector('#navApiLink');
        const applicationHistoryBtn = body.querySelector('#navApplicationHistory');
        const sharingBtn = body.querySelector('#navAccountSharing');
        const deleteBtn = body.querySelector('#navDeleteUser');

        const refreshSyncUi = () => {
            if (!photoBtn?.isConnected) return;
            const connected = !!_profileSyncUi.connected;
            const busy = !!_profileSyncUi.busy;
            const status = body.querySelector('#navProfileSyncStatus');
            const connect = body.querySelector('#navProfileSyncConnect');
            const syncNow = body.querySelector('#navProfileSyncNow');
            const disconnect = body.querySelector('#navProfileSyncDisconnect');
            if (status) {
                status.textContent = busy
                    ? _t('profileSyncWorking', 'Sincronizando...')
                    : (_profileSyncUi.message || (connected ? _t('profileSyncConnected', 'Sincronizado') : _t('profileSyncDisconnected', _t('steam.disconnected'))));
                status.classList.toggle('connected', connected && !busy);
            }
            if (connect) connect.style.display = connected ? 'none' : 'flex';
            if (syncNow) syncNow.style.display = connected ? 'flex' : 'none';
            if (disconnect) disconnect.style.display = connected ? 'flex' : 'none';
            if (connect) connect.disabled = busy;
            if (syncNow) syncNow.disabled = busy;
            if (disconnect) disconnect.disabled = busy;
            const focused = _contentItems[_contentIdx];
            _contentItems = [...body.querySelectorAll('button,input')].filter(item => !item.disabled && item.offsetWidth && item.offsetHeight);
            if (_contentItems.includes(focused)) _contentIdx = _contentItems.indexOf(focused);
            _contentIdx = Math.min(_contentIdx, Math.max(0, _contentItems.length - 1));
        };
        window._refreshProfileSyncAccountUi = refreshSyncUi;
        refreshSyncUi();
        _contentIdx = Math.max(0,_contentItems.indexOf(body.querySelector('[data-art-part=avatar]')));
        if (_initialAccountSection === 'connections') {
            _contentIdx = Math.max(0,_contentItems.indexOf(body.querySelector('#navSteamManage')));
            _initialAccountSection = 'identity';
        }
        postToHost?.({ action: 'profileSyncStatus' });
        body.querySelector('#navSteamManual')?.addEventListener('click', event => {
            const controls = body.querySelector('#navSteamControls');
            controls.hidden = !controls.hidden;
            event.currentTarget.setAttribute('aria-expanded', String(!controls.hidden));
            refreshSyncUi();
        });
        body.querySelector('#navSteamManage')?.addEventListener('click', () => {
            postToHost?.(_steamConnectPayload());
        });
        const steamAccount = body.querySelector('#navSteamAccount');
        let steamState = { hasKey: false, busy: false };
        const refreshSteam = data => {
            if (body.querySelector('#navSteamAccount') !== steamAccount) return;
            if (data && data.profileId !== String(_menuData.user.Id || _menuData.user.id || '')) return;
            if (data) {
                steamState = { ...steamState, ...data };
                if (Array.isArray(data.achievementIndex)) body.querySelector('.nav-editor-preview')?.refreshArtwork?.();
            }
            if (data?.manualKeyRequired) {
                const controls = body.querySelector('#navSteamControls');
                if (controls) controls.hidden = false;
                body.querySelector('#navSteamManual')?.setAttribute('aria-expanded', 'true');
            }
            if (data?.hasKey && !data.busy) { const field = body.querySelector('#navSteamManualKey'); if (field) field.value = ''; }
            if (steamAccount) steamAccount.disabled = !!steamState.busy;
            const status = body.querySelector('#navSteamStatus');
            if (status) status.textContent = steamState.message || _t('steam.configureHint');
            const progress = body.querySelector('#navSteamProgress');
            if (progress) {
                progress.hidden = !steamState.busy && !steamState.pending;
                progress.max = 100;
                progress.value = Math.max(0, Math.min(100, Number(steamState.progressPercent) || 0));
                progress.classList.toggle('is-pending', !steamState.busy && !!steamState.pending);
            }
            const syncMessage = body.querySelector('#navSteamSyncMessage');
            if (syncMessage) syncMessage.textContent = steamState.busy
                ? `${steamState.message || _t('steam.updating')}${steamState.progressTotal > 0 ? ` · ${steamState.progressCurrent || 0}/${steamState.progressTotal}` : ''}`
                : steamState.pending ? steamState.message || _t('steam.resumeHint') : '';
            const firstSyncHint = body.querySelector('#navSteamFirstSyncHint');
            if (firstSyncHint) {
                firstSyncHint.hidden = !steamState.firstSync || (!steamState.busy && !steamState.pending);
                firstSyncHint.textContent = steamState.pending && !steamState.busy ? _t('steam.resumeHint') : _t('steam.firstSyncHint');
            }
            if (steamAccount && (steamState.account || (!steamAccount.value && steamState.steamId))) steamAccount.value = steamState.account || steamState.steamId;
            const totals = body.querySelector('#navSteamTotals');
            if (totals) totals.textContent = steamState.steamId ? _t('steam.summary','',steamState.displayName || _t('steam.profile'),steamState.gameCount || 0,steamState.achievementCount || 0) : '';
            const preview = body.querySelector('#navSteamData');
            if (preview && Array.isArray(steamState.games)) {
                preview.replaceChildren();
                const heading = document.createElement('p');
                heading.textContent = _t('steam.previewLimit');
                preview.append(heading);
                steamState.games.forEach(game => {
                    const row = document.createElement('div');
                    const name = document.createElement('strong');
                    name.textContent = game.Name || _t('steam.gameFallback');
                    const description = document.createElement('p');
                    const hours = (Math.max(0, Number(game.PlaytimeMinutes) || 0) / 60).toLocaleString(undefined, { maximumFractionDigits: 1 });
                    description.textContent = `${_t('steam.hours','',hours)} · ${game.total ? _t('steam.progress','',game.unlocked,game.total) : _t('steam.achievementsUnavailable')}`;
                    const recent = document.createElement('p');
                    recent.textContent = (game.achievements || []).join(' · ');
                    row.append(name, description, recent);
                    preview.append(row);
                });
            }
            const view = body.querySelector('#navSteamView');
            if (view) view.disabled = !!steamState.busy || !steamState.steamId;
            body.querySelectorAll('[data-steam-action]').forEach(button => {
                const operation = button.dataset.steamAction;
                button.disabled = !!steamState.busy || (operation === 'import' && (!steamState.hasKey || !steamAccount?.value.trim())) || (operation === 'disconnect' && !steamState.hasKey);
            });
            const identity = body.querySelector('#navSteamIdentity');
            if (identity) identity.textContent = steamState.displayName || (steamState.steamId ? _t('steam.importedProfile') : _t('steam.publicProfile'));
            const manage = body.querySelector('#navSteamManage span');
            if (manage) manage.textContent = steamState.hasKey && steamState.account ? _t('steam.anotherAccount') : _t('steam.connect');
            const primary = body.querySelector('#navSteamManage');
            if (primary) primary.disabled = !!steamState.busy;
            const connectionState = body.querySelector('#navSteamConnectionState');
            if (connectionState) connectionState.textContent = steamState.busy ? _t('steam.updating') : steamState.hasKey && (steamState.account || steamState.steamId) ? _t('steam.connected') : _t('steam.disconnected');
            if (connectionState && !steamState.busy && /não foi|não pôde|mudou|cancelad|inválid|restrit|privad|indispon|configure primeiro/i.test(steamState.message || '')) connectionState.textContent = steamState.message;
            refreshSyncUi();
        };
        window._refreshSteamAccountUi = refreshSteam;
        body.querySelector('#navSteamSaveManualKey')?.addEventListener('click', () => {
            const field = body.querySelector('#navSteamManualKey');
            const key = field?.value.trim() || '';
            if (!/^[a-f0-9]{32}$/i.test(key)) {
                const status = body.querySelector('#navSteamStatus');
                if (status) status.textContent = _t('steam.invalidKey');
                return;
            }
            postToHost?.({ action: 'steamSaveManualKey', key });
            field.value = '';
        });
        body.querySelector('#navSteamManualKey')?.addEventListener('click', event => {
            const field = event.currentTarget;
            if (window._doorpiShouldOpenVkbFromEvent?.(event)) window._vkbOpen?.(field, { onOk: () => window._vkbForceClose?.(), onCancel: () => window._vkbForceClose?.() });
        });
        body.querySelector('#navSteamView')?.addEventListener('click', event => {
            const preview = body.querySelector('#navSteamData');
            preview.hidden = !preview.hidden;
            event.currentTarget.setAttribute('aria-expanded', String(!preview.hidden));
        });
        body.querySelectorAll('[data-steam-action]').forEach(button => button.addEventListener('click', () => {
            const operation = button.dataset.steamAction;
            if (operation === 'getKey') {
                postToHost?.(_steamConnectPayload());
                return;
            }
            steamState.busy = true;
            refreshSteam();
            postToHost?.({ action: ({ pasteKey: 'steamPasteKey', pasteAccount: 'steamPasteAccount', import: 'steamImport', disconnect: 'steamDisconnect' })[operation], account: steamAccount?.value.trim() || '' });
        }));
        steamAccount?.addEventListener('input', () => refreshSteam());
        steamAccount?.addEventListener('click', event => {
            steamAccount.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            window._vkbOpen?.(steamAccount, { onOk: () => { steamAccount.setAttribute('readonly', ''); window._vkbForceClose?.(); refreshSteam(); }, onCancel: () => { steamAccount.setAttribute('readonly', ''); window._vkbForceClose?.(); } });
        });
        refreshSteam();
        postToHost?.({ action: 'steamProfileStatus' });

        body.querySelector('#navProfileSyncConnect')?.addEventListener('click', () => {
            _profileSyncUi.busy = true;
            refreshSyncUi();
            postToHost?.({ action: 'profileSyncConnect' });
        });
        body.querySelector('#navProfileSyncNow')?.addEventListener('click', () => {
            _profileSyncUi.busy = true;
            refreshSyncUi();
            postToHost?.({ action: 'profileSyncNow' });
        });
        body.querySelector('#navProfileSyncDisconnect')?.addEventListener('click', () => {
            window.DoorpiProfileSync?.confirmDisconnect?.('', deleteCloud => {
                _profileSyncUi.busy = true;
                refreshSyncUi();
                postToHost?.({ action: 'profileSyncDisconnect', deleteCloud });
            });
        });

        applicationHistoryBtn?.addEventListener('click', () => {
            applicationHistoryEnabled = !applicationHistoryEnabled;
            applicationHistoryBtn.setAttribute('aria-pressed', String(applicationHistoryEnabled));
            _saveProfileNow({ applicationHistoryEnabled });
            _showSavedFeedback();
        });

        const _showSavedFeedback = () => {
            const status = document.getElementById('navSaveStatus');
            if (status) {
                status.style.opacity = '1';
                setTimeout(() => status.style.opacity = '0', 3000);
            }
        };

        const rankedArt = () => {
            const {gameTotals} = _profileLibraryRanking(_menuData.games || []);
            return _profileGameRows(gameTotals,{..._steamView(),gameOrder:'hours'}).find(game=>game.minutes>0);
        };
        const refreshArt = () => {
            const game = rankedArt();
            const preview = body.querySelector('.nav-editor-cover');
            const source = user.CoverBase64 ? 'data:image/jpeg;base64,'+user.CoverBase64 : (user.CoverSourceUrl || _profileBanner(game));
            preview.onerror = () => {
                const fallback = game && _profileGameArt(game);
                preview.onerror = () => { preview.hidden = true; };
                if (fallback && !user.CoverBase64 && !user.CoverSourceUrl && fallback !== source) preview.src = fallback;
                else preview.hidden = true;
            };
            if (source) preview.src = source;
            preview.hidden = !source;
            for (const btn of body.querySelectorAll('[data-art-mode]')) {
                const auto = btn.dataset.artPart === 'avatar' ? user.AvatarFromGame :
                    (user.CoverUsesMostPlayedGame ?? (!user.CoverBase64 && !user.CoverSourceUrl));
                btn.setAttribute('aria-pressed', String((btn.dataset.artMode === 'game') === !!auto));
            }
        };
        body.querySelector('.nav-editor-preview').refreshArtwork = refreshArt;
        refreshArt();
        for (const button of body.querySelectorAll('[data-art-part]')) button.onclick = () => {
            const cover = button.dataset.artPart === 'cover';
            if (button.dataset.artMode === 'image') { pickImage(cover,button); return; }
            const game = rankedArt();
            _setProfileArtwork(cover?'cover':'avatarGame',cover || !game ? '' : _profileGameArt(game),
                cover ? {useMostPlayedGame:true} : undefined);
            if (!cover && game) {
                const image = document.createElement('img');
                image.alt = '';
                image.src = _profileGameArt(game);
                photoBtn.replaceChildren(image);
            }
            refreshArt();
            _showSavedFeedback();
        };
        function pickImage(cover,returnFocus) {
            const target = user.Id;
            const revision = _menuReloadToken;
            if (typeof window.openDoorpiProfilePhotoPicker !== 'function') {
                console.error('[ProfilePhoto] Seletor de foto não foi carregado.');
                return;
            }
            window.openDoorpiProfilePhotoPicker({
                hasApiKey: apiConfigured,
                cover, returnFocus,
                favoriteTitles: cover ? _profileGameRows(_profileLibraryRanking(_menuData.games || []).gameTotals,
                    {..._steamView(),gameOrder:'hours'}).filter(game=>game.minutes>0).slice(0,5).map(game=>game.name) : [],
                onApply: result => {
                    if (!returnFocus.isConnected || target !== window._doorpiCurrentUserId || revision !== _menuReloadToken) return;
                    if (cover) {
                        _setProfileArtwork('cover',result.base64,{useMostPlayedGame:false,source:result.photoSource,sourceUrl:result.photoSourceUrl,steamGridAssetId:result.photoSteamGridAssetId});
                        refreshArt();
                        _showSavedFeedback();
                        return;
                    }
                    _menuData.user.AvatarFromGame = false;
                    _menuData.user.PhotoBase64 = result.base64;
                    _menuData.user.PhotoSource = result.photoSource;
                    _menuData.user.PhotoSourceUrl = result.photoSourceUrl;
                    _menuData.user.PhotoSteamGridAssetId = result.photoSteamGridAssetId;
                    _menuData.user.PhotoCropX = result.photoCropX;
                    _menuData.user.PhotoCropY = result.photoCropY;
                    _menuData.user.PhotoZoom = result.photoZoom;
                    if (window._doorpiProfile) Object.assign(window._doorpiProfile, _menuData.user);
                    window._applyDoorpiTopProfile?.(window._doorpiProfile || _menuData.user);
                    postToHost({
                        action: 'saveUserProfile', userId: target,
                        name: _menuData.user.Name || '',
                        photoBase64: result.base64,
                        photoSource: result.photoSource,
                        photoSourceUrl: result.photoSourceUrl,
                        photoSteamGridAssetId: result.photoSteamGridAssetId,
                        photoCropX: result.photoCropX,
                        photoCropY: result.photoCropY,
                        photoZoom: result.photoZoom,
                        skipTasks: true
                    });
                    const imgTag = `<img src="data:image/jpeg;base64,${result.base64}" />`;
                    if (photoBtn) photoBtn.innerHTML = imgTag;
                    document.querySelectorAll('.nav-profile-avatar-large').forEach(avatar => { avatar.innerHTML = imgTag; });
                    _showSavedFeedback();
                    refreshArt();
                }
            });
        }

        sharingBtn?.addEventListener('click', () => {
            _settingsSubView = 'sharing';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });

        let _deleteConfirmStep = false;
        deleteBtn?.addEventListener('click', () => {
            if (!_deleteConfirmStep) {
                _deleteConfirmStep = true;
                deleteBtn.textContent = _t('btnDeleteProfileConfirm', 'Tem certeza? Pressione novamente para excluir');
                deleteBtn.style.backgroundColor = 'rgba(255,50,50,0.3)';
                deleteBtn.style.borderColor = '#ff4444';

                const revert = () => {
                    _deleteConfirmStep = false;
                    deleteBtn.textContent = _t('btnDeleteProfile', 'Excluir Perfil');
                    deleteBtn.style.backgroundColor = '';
                    deleteBtn.style.borderColor = '';
                    deleteBtn.removeEventListener('blur', revert);
                };
                deleteBtn.addEventListener('blur', revert);
            } else {
                if (typeof postToHost === 'function') postToHost({ action: 'deleteCurrentUser' });
            }
        });

        nameInput?.addEventListener('click', event => {
            nameInput.value = pendingName;
            nameInput.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            window._vkbOpen?.(nameInput, {
                onOk: () => {
                    pendingName = nameInput.value.trim();
                    nameInput.value = pendingName;
                    nameInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();

                    _saveProfileNow({ name: pendingName });
                    const topBtnName = document.querySelector('#btnTopProfile .top-profile-name');
                    if (topBtnName) topBtnName.textContent = pendingName;
                    const identityName = body.querySelector('.nav-account-identity-name');
                    if (identityName) identityName.textContent = pendingName;
                    _showSavedFeedback();
                },
                onCancel: () => {
                    nameInput.value = pendingName;
                    nameInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });

        pinInput?.addEventListener('click', event => {
            pinInput.value = '';
            pinInput.type = 'password';
            pinInput.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            window._vkbOpen?.(pinInput, {
                mode: 'numeric',
                onOk: () => {
                    const newPin = _normalizePin(pinInput.value);
                    pinInput.value = newPin;
                    if (!_isValidPin(newPin)) {
                        window.showDoorpiToast?.(
                            _t('setupPinInvalidTitle', 'PIN inválido'),
                            _t('setupPinLengthError', 'Use 4 dígitos ou deixe vazio.')
                        );
                        pinInput.focus();
                        return;
                    }
                    pendingPin = newPin;
                    pinInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                    _saveProfileNow({ pin: newPin });
                    pinInput.type = 'text';
                    pinInput.value = maskPin();
                    _showSavedFeedback();
                },
                onCancel: () => {
                    pinInput.type = 'text';
                    pinInput.value = maskPin();
                    pinInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });
        pinInput?.addEventListener('input', event => {
            const digits = _normalizePin(event.target.value);
            if (event.target.value !== digits) event.target.value = digits;
        });

        const apiStatus = body.querySelector('#navApiStatus');
        let apiInputRequest = '';
        let apiSaveRequest = '';
        let apiHasDraft = false;
        const apiProfileId = user.Id || window._doorpiCurrentUserId;
        const setApiFeedback = (message = '', error = false) => {
            apiStatus.textContent = message ? _t(message) : '';
            apiInput.setAttribute('aria-invalid', String(error));
        };

        const submitApi = key => {
            if (apiSaveRequest) return;
            if (!key.trim()) { setApiFeedback('steamGridKeyRequired', true); return; }
            apiInputRequest = '';
            apiHasDraft = true;
            apiInput.value = key.trim();
            apiInput.readOnly = true;
            linkBtn.disabled = pasteBtn.disabled = true;
            setApiFeedback('steamGridKeyValidating');
            apiSaveRequest = crypto.randomUUID();
            postToHost({ action: 'saveSteamGridKey', requestId: apiSaveRequest, profileId: apiProfileId, key: key.trim() });
        };

        linkBtn?.addEventListener('click', () => {
            const requestId = _openSteamGridKeyPage();
            if (requestId) apiInputRequest = requestId;
        });
        pasteBtn?.addEventListener('click', () => {
            apiInputRequest = crypto.randomUUID();
            postToHost({ action: 'pasteSteamGridKey', requestId: apiInputRequest });
        });
        apiInput?.addEventListener('click', event => {
            if (apiSaveRequest) return;
            if (!apiHasDraft) apiInput.value = '';
            apiHasDraft = true;
            apiInput.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            window._vkbOpen?.(apiInput, {
                onOk: () => {
                    const newKey = apiInput.value.trim();
                    window._vkbForceClose?.();
                    submitApi(newKey);
                },
                onCancel: () => {
                    apiInput.value = maskApi();
                    apiHasDraft = false;
                    apiInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });
        apiInput?.addEventListener('keydown', event => {
            if (event.key !== 'Enter' || apiInput.readOnly) return;
            event.preventDefault();
            event.stopPropagation();
            submitApi(apiInput.value);
        });
        apiInput?.addEventListener('input', () => setApiFeedback('steamGridKeyPressEnter'));

        window._handleAccountSteamGridMessage = data => {
            if (apiProfileId !== window._doorpiCurrentUserId) return;
            if (data.type === 'steamGridKeyInput' && apiInputRequest && data.requestId === apiInputRequest && apiInput.isConnected) {
                apiInputRequest = '';
                if (data.reason || !data.text) setApiFeedback(data.reason || 'steamGridKeyClipboardEmpty', true);
                else {
                    apiInput.focus();
                    submitApi(data.text);
                }
                return;
            }
            if (data.type !== 'steamGridKeySaved' || !apiSaveRequest || data.requestId !== apiSaveRequest) return;
            apiSaveRequest = '';
            linkBtn.disabled = pasteBtn.disabled = false;
            if (data.reason) { setApiFeedback(data.reason, true); return; }
            apiConfigured = true;
            _menuData.user.HasSteamGridApiKey = true;
            if (window._doorpiProfile) window._doorpiProfile.HasSteamGridApiKey = true;
            apiHasDraft = false;
            apiInput.value = maskApi();
            setApiFeedback();
            _showSavedFeedback();
        };

        body.querySelectorAll('button,input').forEach(el => el.addEventListener('mouseenter', () => {
            const index = _contentItems.indexOf(el);
            if (index < 0) return;
            _contentIdx = index;
            _setTopbarFocus(false);
        }));
    }
