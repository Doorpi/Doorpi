// ──────────────────────────────────────────────────────────────────────────────

function openSetup(isAddingUser = false) {
    if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
    }
    _isAddingUserMode = isAddingUser;
    _setupPhase = isAddingUser ? 'auth' : 'layout';
    _setupCloudProfileId = '';
    _setupSyncConnectFromRegistration = false;
    _setupSyncMessage = '';
    _setupLayoutConfirmed = !!isAddingUser;
    _setupUsers = [{
        id: '', name: '', pin: '', photoBase64: '', apiKey: '', folders: [],
        photoSource: '', photoSourceUrl: '', photoSteamGridAssetId: 0,
        photoCropX: 0, photoCropY: 0, photoZoom: 1, totalPlaytimeSeconds: 0,
        syncConnected: false, importCloud: false
    }];
    _currUser = _setupUsers[0];
    _currentSection = null;
    document.querySelectorAll('.setup-section').forEach(sec => sec.classList.remove('expanded'));
    document.querySelectorAll('.setup-focusable:not(.setup-section-header)').forEach(el => el.tabIndex = -1);
    _setupApplyPhaseVisibility();
    _setupApplyLayoutScale(Math.round((window.DoorpiLayoutScale?.get?.() || 1) * 100), false);
    _setSetupLayoutConfirmed(_setupLayoutConfirmed);

    document.querySelectorAll('.setup-footer .setup-focusable').forEach(el => el.tabIndex = 0);

    _loadCurrentUserIntoForm();
    _renderSetupUsers();
    _renderSetupCloudProfile();

    const btnCancel = document.getElementById('btnSetupCancel');
    if (btnCancel) btnCancel.style.display = isAddingUser ? 'block' : 'none';

    // MOSTRA O BOTÃO "SAIR" SE FOR O PRIMEIRO SETUP
    const btnExit = document.getElementById('btnSetupExit');
    if (btnExit) btnExit.style.display = isAddingUser ? 'none' : 'flex';

    document.getElementById('btnSetupFinish').textContent = _setupPhase === 'layout'
        ? (typeof t === 'function' ? t('btnContinue', 'Continuar') : 'Continuar')
        : (isAddingUser ? (typeof t === 'function' ? t('addUsuario', 'Adicionar Usuário') : 'Adicionar Usuário') : (typeof t === 'function' ? t('setupStep4Finish') : 'Concluir'));
    window.isSetupOpen = true;
    isSetupOpen = true;
    document.body.classList.add('setup-active');
    window.updateDoorpiQuickMenuAvailability?.();
    const c = document.getElementById('setupContainer');
    // O setup inicial e uma etapa obrigatoria: voltar pode navegar dentro dele,
    // mas nunca deve revelar a Home antes de existir um usuario valido.
    c.dataset.required = isAddingUser ? 'false' : 'true';
    if (c.dataset.introSetupClasses) {
        c.classList.remove(...c.dataset.introSetupClasses.split(/\s+/).filter(Boolean));
    }
    const introSetupClasses = window.DoorpiIntro?.isHandoffActive?.()
        ? (window.DoorpiIntro.getSetupClasses?.() || [])
        : [];
    if (introSetupClasses.length) c.classList.add(...introSetupClasses);
    c.dataset.introSetupClasses = introSetupClasses.join(' ');

    c.style.display = 'flex';
    requestAnimationFrame(() => {
        c.classList.add('visible');
        const header = document.querySelector('#setupSectionLayout .setup-section-header');
        if (_setupPhase === 'layout') {
            if (header && !_currentSection) _toggleSection(header.parentElement);
            header?.focus();
        } else {
            document.getElementById('btnSetupGoogle')?.focus();
        }
        _startSetupBg(); // Inicia o background animado nativo
        requestAnimationFrame(() => window.DoorpiIntro?.finishHandoff?.());
    });
}

function closeSetup(options = {}) {
    const c = document.getElementById('setupContainer');
    const force = options === true || options?.force === true;
    const skipHomeFocus = options?.skipHomeFocus === true;
    if (!force && c?.dataset.required === 'true') return false;

    isSetupOpen = false;
    c.style.display = 'none';
    c.classList.remove('visible');
    if (c.dataset.introSetupClasses) {
        c.classList.remove(...c.dataset.introSetupClasses.split(/\s+/).filter(Boolean));
        delete c.dataset.introSetupClasses;
    }
    _stopSetupBg(); // Para a animação do Setup ao fechar para poupar recursos
    if (!skipHomeFocus) window.focusFeaturedCard?.();
    window.isSetupOpen = false;
    document.body.classList.remove('setup-active');
    window.updateDoorpiQuickMenuAvailability?.();
    return true;
}

function setupBack() {
    if (_setupPhase === 'registration') {
        _setupReturnToAuth();
        return true;
    }
    if (_isAddingUserMode) {
        return _returnFromAddUserToPicker();
    }
    const c = document.getElementById('setupContainer');
    if (c?.dataset.required === 'true') return true;
    return closeSetup();
}

function _returnFromAddUserToPicker() {
    if (window._doorpiSetupReturningToUserPicker === true) return true;
    // Mantem o setup opaco ate o seletor estar pronto. Fecha-lo antes da
    // resposta do host exporia e focaria a Home por um frame.
    window._doorpiSetupReturningToUserPicker = true;
    postToHost({ action: 'requestUsers' });
    return true;
}

function getSetupItems() {
    const c = document.getElementById('setupContainer');
    if (!c || c.style.display === 'none') return [];
    return Array.from(c.querySelectorAll('.setup-focusable'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && el.tabIndex !== -1);
}

window._resolveSetupNavigationTarget = function (current, direction, items) {
    if (_setupPhase !== 'registration') return null;
    const back = document.getElementById('btnSetupBackAuth');
    if (!back?.classList.contains('visible')) return null;
    const registrationEntry = items.find(item => item !== back && item.closest('.setup-form'));
    if (current === back && direction === 'DOWN') return registrationEntry || null;
    if (current === registrationEntry && direction === 'UP') return back;
    return null;
};

window.addEventListener('doorpi:native-focus-restored', () => {
    if (!window.isSetupOpen) return;
    requestAnimationFrame(() => {
        if (_setupFolderDialogPending) {
            document.getElementById('btnSetupAddFolder')?.focus({ preventScroll: true });
            return;
        }
        const items = getSetupItems().filter(item => !item.disabled);
        if (!items.length || items.includes(document.activeElement)) return;

        const preferred = _setupPhase === 'auth'
            ? document.getElementById('btnSetupGoogle')
            : document.querySelector('#setupContainer .setup-section.expanded .setup-section-header');
        const target = preferred && !preferred.disabled && items.includes(preferred)
            ? preferred
            : items[0];
        target?.focus({ preventScroll: true });
    });
});

