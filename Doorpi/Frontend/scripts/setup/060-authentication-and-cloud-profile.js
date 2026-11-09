function _setupApplyPhaseVisibility() {
    const form = document.querySelector('#setupContainer .setup-form');
    const gate = document.getElementById('setupAuthGate');
    const authLoading = document.getElementById('setupAuthLoading');
    const layout = document.getElementById('setupSectionLayout');
    const cloudProfile = document.getElementById('setupCloudProfile');
    const backToAuth = document.getElementById('btnSetupBackAuth');
    const isAuth = _setupPhase === 'auth';
    const isAuthenticating = _setupPhase === 'authenticating';
    const isRegistration = _setupPhase === 'registration';
    const isCloudProfile = isRegistration && !!_currUser?.importCloud;
    if (gate) gate.classList.toggle('visible', isAuth);
    if (authLoading) authLoading.classList.toggle('visible', isAuthenticating);
    gate?.querySelectorAll('.setup-focusable').forEach(item => { item.tabIndex = isAuth ? 0 : -1; });
    if (form) form.style.display = (isAuth || isAuthenticating) ? 'none' : 'flex';
    if (layout) layout.style.display = _setupPhase === 'layout' ? '' : 'none';
    if (cloudProfile) cloudProfile.classList.toggle('visible', isCloudProfile);
    if (backToAuth) {
        backToAuth.classList.toggle('visible', isRegistration);
        backToAuth.tabIndex = isRegistration ? 0 : -1;
    }
    const apiSection = document.getElementById('setupSectionApiKey');
    const identitySection = document.getElementById('setupSectionIdentity');
    const syncSection = document.getElementById('setupSectionGoogleSync');
    const foldersSection = document.getElementById('setupSectionFolders');
    if (apiSection) apiSection.style.display = isRegistration && !isCloudProfile ? '' : 'none';
    if (identitySection) identitySection.style.display = isRegistration && !isCloudProfile ? '' : 'none';
    if (syncSection) syncSection.style.display = isRegistration && !isCloudProfile ? '' : 'none';
    if (foldersSection) foldersSection.style.display = isRegistration ? '' : 'none';
}

function _renderSetupGoogleSync(isError = false) {
    const connected = !!_currUser?.syncConnected;
    const status = document.getElementById('statusGoogleSync');
    const button = document.getElementById('btnSetupSyncGoogle');
    const message = document.getElementById('setupSyncMessage');
    if (status) {
        status.textContent = connected ? '✓' : '';
        status.className = 'setup-section-status ' + (connected ? 'done' : '');
    }
    if (button) {
        button.innerHTML = `${window.DoorpiProfileSync?.googleIcon || ''}<span>${typeof t === 'function'
            ? t(connected ? 'setupGoogleSyncEnabled' : 'setupGoogleSyncConnect', connected ? 'Sincronização ativada' : 'Sincronizar com Google')
            : (connected ? 'Sincronização ativada' : 'Sincronizar com Google')}</span>`;
        button.disabled = connected;
    }
    if (message) {
        message.textContent = _setupSyncMessage || (connected
            ? (typeof t === 'function' ? t('profileSyncConnected', 'Sincronizado') : 'Sincronizado')
            : '');
        message.classList.toggle('error', !!isError);
    }
}

function _setupShowRegistrationSyncError(message) {
    _setupSyncMessage = message || (typeof t === 'function'
        ? t('profileSyncFailed', 'Falha na sincronização')
        : 'Falha na sincronização');
    _setupShowRegistration('setupSectionGoogleSync');
    _renderSetupGoogleSync(true);
    _setupSyncConnectFromRegistration = false;
}

function _setupSetAuthBusy(busy, message = '', isError = false) {
    const google = document.getElementById('btnSetupGoogle');
    const register = document.getElementById('btnSetupRegister');
    const status = document.getElementById('setupAuthStatus');
    if (google) google.disabled = !!busy;
    if (register) register.disabled = !!busy;
    if (status) {
        status.textContent = message || (busy ? (typeof t === 'function' ? t('profileSyncConnecting', 'Abrindo o Google...') : 'Abrindo o Google...') : '');
        status.classList.toggle('error', !!isError);
    }
}

function _setupShowAuthGate() {
    _setupPhase = 'auth';
    _currentSection = null;
    _setupApplyPhaseVisibility();
    _setupSetAuthBusy(false);
    requestAnimationFrame(() => document.getElementById('btnSetupGoogle')?.focus());
}

function _setupShowAuthError(message) {
    _setupShowAuthGate();
    _setupSetAuthBusy(false, message, true);
}

function _setupShowAuthenticating(message = '') {
    _setupPhase = 'authenticating';
    _currentSection = null;
    _setupApplyPhaseVisibility();
    _setupSetAuthBusy(true);
    const copy = document.getElementById('setupAuthLoadingCopy');
    if (copy) copy.textContent = message || (typeof t === 'function'
        ? t('profileSyncSigningInBrowser', 'Conclua o acesso na janela do navegador.')
        : 'Conclua o acesso na janela do navegador.');
}

function _setupSetAuthenticatingMessage(message) {
    const copy = document.getElementById('setupAuthLoadingCopy');
    if (copy && message) copy.textContent = message;
}

function _setupReturnToAuth() {
    const wasCloudProfile = !!_currUser?.importCloud;
    if (_setupCloudProfileId && _currUser?.syncConnected) {
        postToHost({ action: 'profileSyncDisconnect', profileId: _setupCloudProfileId, deleteCloud: false });
    }
    _setupCloudProfileId = '';
    if (wasCloudProfile) {
        _setupUsers = [{
            id: '', name: '', pin: '', photoBase64: '', apiKey: '', folders: [],
            photoSource: '', photoSourceUrl: '', photoSteamGridAssetId: 0,
            photoCropX: 0, photoCropY: 0, photoZoom: 1, totalPlaytimeSeconds: 0,
            syncConnected: false, importCloud: false
        }];
        _currUser = _setupUsers[0];
    } else if (_currUser) {
        _currUser.id = '';
        _currUser.syncConnected = false;
        _currUser.importCloud = false;
    }
    _setupSyncConnectFromRegistration = false;
    _setupSyncMessage = '';
    _loadCurrentUserIntoForm();
    _renderSetupUsers();
    _renderSetupCloudProfile();
    _setupShowAuthGate();
}

function _setupShowRegistration(preferredSectionId = '') {
    _setupPhase = 'registration';
    _currentSection = null;
    _setupApplyPhaseVisibility();
    _renderSetupGoogleSync();
    const finish = document.getElementById('btnSetupFinish');
    if (finish) finish.textContent = _isAddingUserMode
        ? (typeof t === 'function' ? t('addUsuario', 'Adicionar usuário') : 'Adicionar usuário')
        : (typeof t === 'function' ? t('setupStep4Finish', 'Concluir') : 'Concluir');
    const firstSection = document.getElementById(preferredSectionId || (_currUser?.importCloud ? 'setupSectionFolders' : 'setupSectionApiKey'));
    if (firstSection) _expandSection(firstSection);
    requestAnimationFrame(() => firstSection?.querySelector('.setup-section-header')?.focus());
}

function _setupApplyRemoteProfile(data) {
    const profile = data.profile || {};
    const photo = profile.profilePhoto || profile.ProfilePhoto || {};
    _setupCloudProfileId = data.profileId || _setupCloudProfileId;
    if (!_currUser) return;
    _currUser.id = _setupCloudProfileId;
    _currUser.name = profile.profileName || profile.ProfileName || '';
    _currUser.pin = profile.pinCode || profile.PinCode || '';
    _currUser.apiKey = profile.steamGridApiKey || profile.SteamGridApiKey || '';
    _currUser.photoBase64 = data.photoBase64 || '';
    _currUser.photoSource = photo.source || photo.Source || '';
    _currUser.photoSourceUrl = photo.sourceUrl || photo.SourceUrl || '';
    _currUser.photoSteamGridAssetId = Number(photo.steamGridAssetId || photo.SteamGridAssetId || 0);
    _currUser.photoCropX = Number(photo.cropX ?? photo.CropX ?? 0);
    _currUser.photoCropY = Number(photo.cropY ?? photo.CropY ?? 0);
    _currUser.photoZoom = Number(photo.zoom || photo.Zoom || 1);
    _currUser.totalPlaytimeSeconds = Math.max(0, Number(profile.totalPlaytimeSeconds ?? profile.TotalPlaytimeSeconds ?? 0));
    _currUser.syncConnected = true;
    _currUser.importCloud = true;
    _loadCurrentUserIntoForm();
    _renderSetupUsers();
    _renderSetupCloudProfile();
    _setupShowRegistration();
}

function _renderSetupCloudProfile() {
    const avatar = document.getElementById('setupCloudAvatar');
    const name = document.getElementById('setupCloudProfileName');
    const playtime = document.getElementById('setupCloudPlaytime');
    if (!avatar || !name || !playtime || !_currUser) return;
    name.textContent = _currUser.name || 'Doorpi';
    if (_currUser.photoBase64) {
        const src = window._doorpiUserPhotoSrc?.(_currUser.photoBase64) || `data:image/png;base64,${_currUser.photoBase64}`;
        avatar.innerHTML = `<img src="${src}" alt="" />`;
    } else {
        avatar.textContent = (_currUser.name || 'D').trim().charAt(0).toUpperCase();
    }
    const totalMinutes = Math.floor(Math.max(0, Number(_currUser.totalPlaytimeSeconds) || 0) / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    playtime.textContent = hours === 0
        ? (minutes > 0 ? `${minutes}min` : '0h')
        : (minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`);
    const folderSection = document.getElementById('setupSectionFolders');
    const folderStep = folderSection?.querySelector('.setup-section-step');
    const folderLabel = folderSection?.querySelector('.setup-section-label');
    const folderDesc = folderSection?.querySelector('.setup-section-desc');
    if (folderStep) folderStep.textContent = _currUser.importCloud ? '01' : '05';
    if (folderLabel) folderLabel.textContent = _currUser.importCloud
        ? (typeof t === 'function' ? t('profileSyncFoldersTitle', 'Pastas para monitorar') : 'Pastas para monitorar')
        : (typeof t === 'function' ? t('setupSectionFolders', 'Pastas de jogos locais') : 'Pastas de jogos locais');
    if (folderDesc) folderDesc.textContent = _currUser.importCloud
        ? (typeof t === 'function'
            ? t('profileSyncFoldersCopy', 'Deseja monitorar alguma pasta de jogos locais ou portáteis neste dispositivo? Esta etapa é opcional.')
            : 'Deseja monitorar alguma pasta de jogos locais ou portáteis neste dispositivo? Esta etapa é opcional.')
        : (typeof t === 'function' ? t('setupFoldersDesc', '') : '');
}

