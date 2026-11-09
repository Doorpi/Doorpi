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

function _validateAndFinish() {
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
        if (!u.apiKey) {
            _currUser = u; _loadCurrentUserIntoForm(); _renderSetupUsers();
            _expandSection(document.getElementById('setupSectionApiKey'));
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

    if (!_isAddingUserMode) {
        try {
            localStorage.setItem('doorpi.firstRunTutorial.pending.v1', 'true');
            localStorage.removeItem('doorpi.firstRunTutorial.done.v1');
        } catch { }
        _setupApplyLayoutScale(Math.round(_setupPendingLayoutScale * 100), true);
    }

    if (!_isAddingUserMode) {
        window._userSwitching = true;
        window._doorpiAllowLibraryRenderDuringSessionTransition = true;
        window._userSwitchStartedAt = performance.now();
        document.body.classList.add('doorpi-session-transition');
    }

    closeSetup({ force: true });

    setTimeout(() => {
        postToHost({
            action: 'saveSetupUsers',
            activeIndex: 0,
            createAll: _isAddingUserMode,
            users: _setupUsers.map(u => ({
                id: u.id || '',
                name: u.name,
                pin: u.pin || '',
                photoBase64: u.photoBase64,
                photoSource: u.photoSource || '',
                photoSourceUrl: u.photoSourceUrl || '',
                photoSteamGridAssetId: Number(u.photoSteamGridAssetId || 0),
                photoCropX: Number(u.photoCropX || 0),
                photoCropY: Number(u.photoCropY || 0),
                photoZoom: Number(u.photoZoom || 1),
                apiKey: u.apiKey,
                folders: u.folders,
                syncConnected: !!u.syncConnected,
                importCloud: !!u.importCloud
            }))
        });
    }, 150);
}

