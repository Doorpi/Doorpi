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

    function _renderSettingsAccount(body) {
        if (!document.getElementById('nav-account-styles')) {
            const s = document.createElement('style');
            s.id = 'nav-account-styles';
            s.textContent = __doorpiCss("injected-styles/nav-menu/nav-account-styles.css");
            document.head.appendChild(s);
        }

        let pendingName = _menuData.user.Name || '';
        let pendingApi = '';
        let pendingPin = '';
        let apiConfigured = !!(_menuData.user.HasSteamGridApiKey || _menuData.user.hasSteamGridApiKey);
        let pinConfigured = !!(_menuData.user.HasPin || _menuData.user.hasPin);
        let applicationHistoryEnabled = _menuData.user.ApplicationHistoryEnabled !== false && _menuData.user.applicationHistoryEnabled !== false;
        const photo = _menuData.user.PhotoBase64 || '';

        const maskApi = () => apiConfigured
            ? _t('navApiConfigured', 'Chave configurada')
            : _t('navApiNotConfigured', 'Nenhuma chave configurada');

        const maskPin = () => pinConfigured
            ? _t('navPinConfigured', 'PIN configurado')
            : _t('setupPinPlaceholder', 'Sem PIN');

        const _saveProfileNow = (patch = {}) => {
            if (Object.prototype.hasOwnProperty.call(patch, 'name')) pendingName = patch.name;
            const hasApiPatch = Object.prototype.hasOwnProperty.call(patch, 'apiKey');
            const hasPinPatch = Object.prototype.hasOwnProperty.call(patch, 'pin');
            const hasHistoryPatch = Object.prototype.hasOwnProperty.call(patch, 'applicationHistoryEnabled');
            if (hasApiPatch) { pendingApi = patch.apiKey; apiConfigured = !!pendingApi; }
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
                if (hasApiPatch) message.apiKey = pendingApi;
                if (hasPinPatch) message.pin = pendingPin;
                if (hasHistoryPatch) message.applicationHistoryEnabled = applicationHistoryEnabled;
                postToHost(message);
            }
        };

        const _saveApiNow = (apiKey) => {
            _saveProfileNow({ apiKey });
            pendingApi = '';
        };

        const _normalizePin = (value) => String(value || '').replace(/\D/g, '').slice(0, 4);
        const _isValidPin = (value) => {
            const pin = _normalizePin(value);
            return pin.length === 0 || pin.length === 4;
        };

        body.innerHTML = `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="setBack" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>${_t('navSetAccount', 'Conta e Perfil')}</h2>
            </div>
            
            <div class="nav-profile-dashboard">
                <div class="nav-profile-avatar-sec">
                    <button class="nav-profile-photo" id="navProfilePhoto" tabindex="-1">
                        ${photo ? `<img src="${window._doorpiUserPhotoSrc?.(photo) || `data:image/png;base64,${photo}`}" />` : '◉'}
                    </button>
                    <span class="nav-account-identity-kicker">${_t('navAvatarChange', 'Alterar avatar')}</span>
                    <strong class="nav-account-identity-name">${_esc(pendingName || _t('navSetAccount', 'Perfil'))}</strong>
                    <span class="nav-account-identity-help">Sua identidade no Doorpi, preferências de segurança e sincronização ficam reunidas aqui.</span>
                </div>
                
                <div class="nav-profile-fields">
                    <span class="nav-account-section-label">Identidade e acesso</span>
                    <div class="nav-profile-field">
                        <span class="nav-profile-field-label">${_t('navProfileNameLabel', 'Nome de Usuário')}</span>
                        <input class="nav-profile-field-input" id="navProfName" readonly value="${pendingName}" tabindex="-1" />
                    </div>

                    <div class="nav-profile-field" style="margin-top: 10px;">
                        <span class="nav-profile-field-label">${_t('navProfilePinLabel', 'PIN de acesso (opcional)')}</span>
                        <input class="nav-profile-field-input" id="navProfPin" type="text" readonly value="${maskPin()}" inputmode="numeric" pattern="[0-9]*" maxlength="4" tabindex="-1" />
                    </div>
                    
                    <div class="nav-profile-field" style="margin-top: 10px;">
                        <span class="nav-profile-field-label">${_t('navProfileApiLabel', 'Chave API SteamGridDB')}</span>
                        <div class="nav-api-row">
                            <input class="nav-profile-field-input" id="navProfApi" readonly value="${maskApi()}" tabindex="-1" style="flex:1;" />
                            <button class="nav-icon-btn" id="navApiPaste" tabindex="-1">${_t('btnPaste', 'Colar')}</button>
                            <button class="nav-icon-btn" id="navApiLink" tabindex="-1">${_t('btnViewKey', 'Ver Chave')}</button>
                        </div>
                    </div>
                    
                    <div style="display:flex; justify-content:flex-start; align-items:center; min-height:18px;">
                        <span id="navSaveStatus" style="color:#6ee696; font-size:0.95rem; font-weight:500; opacity:0; transition:opacity 0.3s;">${_t('toastChangesSaved', '✓ Alterações Salvas')}</span>
                    </div>

                    <span class="nav-account-section-label">Conta na nuvem</span>
                    <div class="nav-profile-sync">
                        <span class="nav-profile-sync-status" id="navProfileSyncStatus"></span>
                        <div class="nav-profile-sync-actions">
                            <button class="nav-icon-btn" id="navProfileSyncConnect" tabindex="-1" title="${_t('profileSyncLoginGoogle', 'Entrar com Google')}" aria-label="${_t('profileSyncLoginGoogle', 'Entrar com Google')}">${window.DoorpiProfileSync?.googleIcon || 'G'}<span>${_t('profileSyncLoginGoogle', 'Entrar com Google')}</span></button>
                            <button class="nav-icon-btn" id="navProfileSyncNow" tabindex="-1" title="${_t('profileSyncNow', 'Sincronizar agora')}" aria-label="${_t('profileSyncNow', 'Sincronizar agora')}">${window.DoorpiProfileSync?.googleIcon || 'G'}<span>${_t('profileSyncNow', 'Sincronizar agora')}</span></button>
                            <button class="nav-icon-btn" id="navProfileSyncDisconnect" tabindex="-1" title="${_t('profileSyncDisconnect', 'Desconectar')}" aria-label="${_t('profileSyncDisconnect', 'Desconectar')}"><svg viewBox="0 0 24 24"><path d="M9 15l6-6"/><path d="M7.2 11.2 5.4 13a4 4 0 0 0 5.6 5.6l1.8-1.8"/><path d="m16.8 12.8 1.8-1.8A4 4 0 0 0 13 5.4l-1.8 1.8"/><path d="M4 4l16 16"/></svg><span>${_t('profileSyncDisconnect', 'Desconectar')}</span></button>
                        </div>
                    </div>

                    <span class="nav-account-section-label">${_t('navPrivacyActivity','Privacidade e atividade')}</span>
                    <button class="nav-account-toggle" id="navApplicationHistory" aria-pressed="${applicationHistoryEnabled}" tabindex="-1">
                        <span class="nav-account-toggle-copy"><strong>${_t('navApplicationHistory','Histórico de aplicativos')}</strong><small>${_t('navApplicationHistoryHint','Registra apenas mídias realmente reproduzidas nos aplicativos nativos deste perfil.')}</small></span>
                        <span class="nav-account-switch" aria-hidden="true"></span>
                    </button>

                    <span class="nav-account-section-label">${_t('navAccessMaintenance','Acesso e manutenção')}</span>
                    <button class="nav-icon-btn nav-account-route" id="navAccountSharing" tabindex="-1"><span class="nav-account-route-copy"><strong>${_t('navSetSharing', 'Contas dos apps')}</strong><small>Escolha quem pode usar cada conta conectada.</small></span><span class="nav-account-route-chevron">›</span></button>
                    <button class="nav-icon-btn nav-btn-danger" id="navDeleteUser" tabindex="-1"><span>Excluir perfil</span></button>
                </div>
            </div>`;

        _contentItems = [
            body.querySelector('#setBack'),
            body.querySelector('#navProfilePhoto'),
            body.querySelector('#navProfName'),
            body.querySelector('#navProfPin'),
            body.querySelector('#navProfApi'),
            body.querySelector('#navApiPaste'),
            body.querySelector('#navApiLink'),
            body.querySelector('#navProfileSyncConnect'),
            body.querySelector('#navProfileSyncNow'),
            body.querySelector('#navProfileSyncDisconnect'),
            body.querySelector('#navApplicationHistory'),
            body.querySelector('#navAccountSharing'),
            body.querySelector('#navDeleteUser')
        ].filter(Boolean);

        body.querySelector('#setBack')?.addEventListener('click', () => {
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
            const connected = !!_profileSyncUi.connected;
            const busy = !!_profileSyncUi.busy;
            const status = body.querySelector('#navProfileSyncStatus');
            const connect = body.querySelector('#navProfileSyncConnect');
            const syncNow = body.querySelector('#navProfileSyncNow');
            const disconnect = body.querySelector('#navProfileSyncDisconnect');
            if (status) {
                status.textContent = busy
                    ? _t('profileSyncWorking', 'Sincronizando...')
                    : (_profileSyncUi.message || (connected ? _t('profileSyncConnected', 'Sincronizado') : _t('profileSyncDisconnected', 'Não conectado')));
                status.classList.toggle('connected', connected && !busy);
            }
            if (connect) connect.style.display = connected ? 'none' : 'flex';
            if (syncNow) syncNow.style.display = connected ? 'flex' : 'none';
            if (disconnect) disconnect.style.display = connected ? 'flex' : 'none';
            if (connect) connect.disabled = busy;
            if (syncNow) syncNow.disabled = busy;
            if (disconnect) disconnect.disabled = busy;
            _contentItems = [
                body.querySelector('#setBack'), body.querySelector('#navProfilePhoto'),
                body.querySelector('#navProfName'), body.querySelector('#navProfPin'),
                body.querySelector('#navProfApi'), body.querySelector('#navApiPaste'),
                body.querySelector('#navApiLink'), body.querySelector('#navProfileSyncConnect'),
                body.querySelector('#navProfileSyncNow'), body.querySelector('#navProfileSyncDisconnect'),
                body.querySelector('#navApplicationHistory'),
                body.querySelector('#navAccountSharing'), body.querySelector('#navDeleteUser')
            ].filter(item => item && item.offsetWidth > 0 && item.offsetHeight > 0);
            _contentIdx = Math.min(_contentIdx, Math.max(0, _contentItems.length - 1));
        };
        window._refreshProfileSyncAccountUi = refreshSyncUi;
        refreshSyncUi();
        postToHost?.({ action: 'profileSyncStatus' });

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

        photoBtn?.addEventListener('click', () => {
            if (typeof window.openDoorpiProfilePhotoPicker !== 'function') {
                console.error('[ProfilePhoto] Seletor de foto não foi carregado.');
                return;
            }
            window.openDoorpiProfilePhotoPicker({
                hasApiKey: apiConfigured,
                returnFocus: photoBtn,
                onApply: result => {
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
                        action: 'saveUserProfile',
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
                }
            });
        });

        linkBtn?.addEventListener('click', () => {
            if (typeof postToHost === 'function') postToHost({ action: 'launchMediaApp', url: 'https://www.steamgriddb.com/profile/preferences/api', appType: 'webview' });
        });

        sharingBtn?.addEventListener('click', () => {
            _settingsSubView = 'sharing';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });

        pasteBtn?.addEventListener('click', () => {
            window._isPastingApiKey = true;
            if (typeof postToHost === 'function') postToHost({ action: 'readClipboard' });
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

        apiInput?.addEventListener('click', event => {
            apiInput.value = '';
            apiInput.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            window._vkbOpen?.(apiInput, {
                onOk: () => {
                    const newKey = apiInput.value.trim();
                    apiInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                    _saveApiNow(newKey);
                    apiInput.value = maskApi();
                    _showSavedFeedback();
                },
                onCancel: () => {
                    apiInput.value = maskApi();
                    apiInput.setAttribute('readonly', '');
                    window._vkbForceClose?.();
                }
            });
        });

        window._updatePendingApiKey = (keyText) => {
            const trimmed = keyText.trim();
            _saveApiNow(trimmed);
            if (apiInput) apiInput.value = maskApi();
            _showSavedFeedback();
        };

        _contentItems.forEach((el, idx) => {
            el.addEventListener('mouseenter', () => {
                _topbarFocus = false;
                _contentIdx = idx;
                _updateContentFocus();
            });
        });
    }

