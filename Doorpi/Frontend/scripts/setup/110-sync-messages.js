window.addEventListener('doorpi:profile-sync-message', event => {
    const data = event.detail || {};
    if (!window.isSetupOpen) return;
    if (!data.setup && data.type !== 'profileSyncSetupResult') return;
    if (data.type === 'profileSyncBusy') {
        if (data.busy && _setupPhase === 'authenticating') {
            _setupSetAuthenticatingMessage(data.message || '');
            return;
        }
        if (!data.busy && _setupPhase === 'authenticating') {
            setTimeout(() => {
                if (_setupPhase !== 'authenticating') return;
                const failure = typeof t === 'function'
                    ? t('profileSyncFailed', 'Não foi possível conectar.')
                    : 'Não foi possível conectar.';
                if (_setupSyncConnectFromRegistration) _setupShowRegistrationSyncError(failure);
                else _setupShowAuthError(failure);
            }, 180);
            return;
        }
        const authStatus = document.getElementById('setupAuthStatus');
        if (!data.busy && _setupPhase === 'auth' && authStatus?.classList.contains('error')) {
            return;
        }
        _setupSetAuthBusy(!!data.busy, data.message || '');
        return;
    }
    if (data.type === 'profileSyncSetupResult') {
        _setupSetAuthBusy(false);
        _setupCloudProfileId = data.profileId || _setupCloudProfileId;
        if (data.alreadyLocal) {
            _setupCloudProfileId = '';
            const message = typeof t === 'function'
                ? t('profileSyncAlreadyLocal', 'Esta conta Google já está vinculada a um perfil neste dispositivo.')
                : 'Esta conta Google já está vinculada a um perfil neste dispositivo.';
            if (_currUser) {
                _currUser.id = '';
                _currUser.syncConnected = false;
                _currUser.importCloud = false;
            }
            if (_setupSyncConnectFromRegistration) _setupShowRegistrationSyncError(message);
            else _setupShowAuthError(message);
            return;
        }
        if (!data.remoteExists) {
            if (_currUser) {
                _currUser.id = _setupCloudProfileId;
                _currUser.syncConnected = true;
                _currUser.importCloud = false;
            }
            _setupSyncMessage = typeof t === 'function'
                ? t('setupGoogleSyncEnabled', 'Sincronização ativada')
                : 'Sincronização ativada';
            const preferredSection = _setupSyncConnectFromRegistration ? 'setupSectionGoogleSync' : '';
            _setupSyncConnectFromRegistration = false;
            _setupShowRegistration(preferredSection);
            return;
        }

        _setupSyncConnectFromRegistration = false;
        _setupApplyRemoteProfile(data);
        return;
    }
    if (data.type === 'profileSyncResult' && data.status && !['Synced', 'Uploaded', 'Downloaded', 'Disconnected'].includes(data.status)) {
        const failure = data.message || (data.status === 'Offline'
            ? (typeof t === 'function' ? t('profileSyncOffline', 'Sem conexão. Os dados locais foram mantidos.') : 'Sem conexão. Os dados locais foram mantidos.')
            : data.status === 'AuthenticationRequired'
                ? (typeof t === 'function' ? t('profileSyncAuthRequired', 'Entre novamente para sincronizar.') : 'Entre novamente para sincronizar.')
                : (typeof t === 'function' ? t('profileSyncFailed', 'Não foi possível conectar.') : 'Não foi possível conectar.'));
        if (_setupSyncConnectFromRegistration) _setupShowRegistrationSyncError(failure);
        else _setupShowAuthError(failure);
    }
});
