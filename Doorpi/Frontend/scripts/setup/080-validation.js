function _shakeField(el) {
    if (!el) return;
    el.classList.remove('shake', 'error');
    el.classList.add('error');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('shake')));
    el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

function _normalizeSetupPin(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 4);
}

function _isValidSetupPin(value) {
    const pin = _normalizeSetupPin(value);
    return pin.length === 0 || pin.length === 4;
}

function _setSetupPinHintError(isError) {
    const hint = document.querySelector('.setup-pin-hint');
    if (!hint) return;
    hint.textContent = typeof t === 'function'
        ? t(isError ? 'setupPinLengthError' : 'setupPinHint')
        : (isError ? 'Use 4 dígitos ou deixe vazio.' : 'Use apenas números. Deixe vazio para entrar sem PIN.');
    hint.classList.toggle('error', !!isError);
}

let _setupSaveRequest = null;
let _setupApiInputRequest = null;
let _steamGridOpenRequestId = '';
let _steamGridReopenAfter = 0;

function _openSteamGridKeyPage() {
    if (_steamGridOpenRequestId || performance.now() < _steamGridReopenAfter) return '';
    const requestId = crypto.randomUUID();
    _steamGridOpenRequestId = requestId;
    postToHost({ action: 'openSteamGridKeyPage', requestId, texts: {
        copy: t('steamGridKeyCopyBack'), back: t('steamGridKeyBack'),
        open: t('steamGridKeyOpen'), clipboardError: t('steamGridKeyClipboardError')
    } });
    return requestId;
}

function _finishSteamGridKeyPage(requestId, keyCopied = false) {
    if (!requestId || requestId !== _steamGridOpenRequestId) return;
    _steamGridOpenRequestId = '';
    if (keyCopied) _steamGridReopenAfter = performance.now() + 400;
}

function _setSetupApiHint(message = 'setupStep3PasteHint', error = false) {
    const hint = document.getElementById('setupApiHint');
    const input = document.getElementById('setupApiInput');
    hint.textContent = t(message);
    hint.classList.toggle('error', error);
    input.classList.toggle('error', error);
    input.setAttribute('aria-invalid', String(error));
}

function _setSetupSaving(saving) {
    if (!saving) _setupSaveRequest = null;
    document.querySelectorAll('#setupContainer .setup-section').forEach(section => section.inert = saving);
    for (const id of ['btnSetupFinish', 'btnSetupCancel', 'btnSetupBackAuth']) {
        document.getElementById(id).disabled = saving;
    }
    const status = document.getElementById('setupSaveError');
    status.classList.remove('error');
    status.textContent = saving ? t('steamGridKeyValidating') : '';
    status.hidden = !saving;
}

function _setSetupApiInput(value) {
    if (!_currUser || _setupSaveRequest) return;
    _currUser.apiKey = value;
    document.getElementById('setupApiInput').value = value;
    _setSetupApiHint(value.trim() ? 'steamGridKeyCheckOnFinish' : 'setupStep3PasteHint');
}

function _handleSetupSteamGridInput(data) {
    if (!isSetupOpen || !_setupApiInputRequest || data.requestId !== _setupApiInputRequest.id ||
        _currUser !== _setupApiInputRequest.user || _setupPhase !== 'registration') return;
    _setupApiInputRequest = null;
    if (data.reason || !data.text) {
        _setSetupApiHint(data.reason || 'steamGridKeyClipboardEmpty', true);
        return;
    }
    _setSetupApiInput(data.text);
    document.getElementById('setupApiInput').focus();
}

function _handleSetupUsersSaved(data) {
    if (!isSetupOpen || !_setupSaveRequest || data.requestId !== _setupSaveRequest) return;
    _setSetupSaving(false);
    if (data.reason) {
        if (_setupUsers[data.userIndex]) {
            _currUser = _setupUsers[data.userIndex];
            _loadCurrentUserIntoForm();
            _renderSetupUsers();
            _expandSection(document.getElementById('setupSectionApiKey'));
            _setSetupApiHint(data.reason, true);
            document.getElementById('setupApiInput').focus();
        } else {
            const status = document.getElementById('setupSaveError');
            status.textContent = t(data.reason);
            status.classList.add('error');
            status.hidden = false;
            document.getElementById('btnSetupFinish').focus();
        }
        return;
    }

    if (!_isAddingUserMode) {
        try {
            localStorage.setItem('doorpi.firstRunTutorial.pending.v1', 'true');
            localStorage.removeItem('doorpi.firstRunTutorial.done.v1');
        } catch { }
        _setupApplyLayoutScale(Math.round(_setupPendingLayoutScale * 100), true);
        window._userSwitching = true;
        window._doorpiAllowLibraryRenderDuringSessionTransition = true;
        window._userSwitchStartedAt = performance.now();
        document.body.classList.add('doorpi-session-transition');
    }
    closeSetup({ force: true });
}

function _validateAndFinish() {
    if (_setupSaveRequest) return;
    if (_setupPhase === 'layout') {
        if (!_setupLayoutConfirmed) {
            _expandSection(document.getElementById('setupSectionLayout'));
            setTimeout(() => document.getElementById('setupLayoutScale')?.focus(), 80);
            return;
        }
        _setupApplyLayoutScale(Math.round(_setupPendingLayoutScale * 100), true);
        _setupShowAuthGate();
        return;
    }
    if (_setupPhase === 'auth') return;

    if (!_isAddingUserMode && !_setupLayoutConfirmed) {
        _expandSection(document.getElementById('setupSectionLayout'));
        setTimeout(() => {
            const target = document.getElementById('setupLayoutScale');
            target?.focus();
        }, 80);
        return;
    }

    for (let i = 0; i < _setupUsers.length; i++) {
        const u = _setupUsers[i];
        if (u.importCloud) continue;
        if (!u.apiKey.trim()) {
            _currUser = u; _loadCurrentUserIntoForm(); _renderSetupUsers();
            _expandSection(document.getElementById('setupSectionApiKey'));
            _setSetupApiHint('steamGridKeyRequired', true);
            setTimeout(() => { _shakeField(document.getElementById('setupApiInput')); document.getElementById('setupApiInput')?.focus(); }, 80);
            return;
        }
        if (!u.name) {
            _currUser = u; _loadCurrentUserIntoForm(); _renderSetupUsers();
            _expandSection(document.getElementById('setupSectionIdentity'));
            setTimeout(() => { _shakeField(document.getElementById('setupNameInput')); document.getElementById('setupNameInput')?.focus(); }, 80);
            return;
        }
        u.pin = _normalizeSetupPin(u.pin);
        if (!_isValidSetupPin(u.pin)) {
            _currUser = u; _loadCurrentUserIntoForm(); _renderSetupUsers();
            _expandSection(document.getElementById('setupSectionIdentity'));
            _setSetupPinHintError(true);
            setTimeout(() => { _shakeField(document.getElementById('setupPinInput')); document.getElementById('setupPinInput')?.focus(); }, 80);
            return;
        }
    }

    _setupSaveRequest = crypto.randomUUID();
    _setSetupSaving(true);
    postToHost({
        action: 'saveSetupUsers',
        requestId: _setupSaveRequest,
        activeIndex: 0,
        createAll: _isAddingUserMode,
        users: _setupUsers.map(u => ({
            id: u.id || '',
            name: u.name,
            pin: u.pin || '',
            photoBase64: u.photoBase64,
            coverBase64: u.coverBase64 || '',
            coverSource: u.coverSource || '',
            coverSourceUrl: u.coverSourceUrl || '',
            coverSteamGridAssetId: u.coverSteamGridAssetId || 0,
            coverUsesMostPlayedGame: u.coverUsesMostPlayedGame ?? (!u.coverBase64 && !u.coverSourceUrl),
            photoSource: u.photoSource || '',
            photoSourceUrl: u.photoSourceUrl || '',
            photoSteamGridAssetId: Number(u.photoSteamGridAssetId || 0),
            photoCropX: Number(u.photoCropX || 0),
            photoCropY: Number(u.photoCropY || 0),
            photoZoom: Number(u.photoZoom || 1),
            apiKey: u.apiKey.trim(),
            folders: u.folders,
            syncConnected: !!u.syncConnected,
            importCloud: !!u.importCloud
        }))
    });
}

