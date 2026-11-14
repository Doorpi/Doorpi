function _setupBeginGoogleConnect(fromRegistration) {
    const randomId = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID().replaceAll('-', '')
        : `${Date.now()}${Math.floor(Math.random() * 100000)}`;
    _setupCloudProfileId = _setupCloudProfileId || `profile-${randomId}`;
    _setupSyncConnectFromRegistration = !!fromRegistration;
    _setupSyncMessage = '';
    _setupShowAuthenticating();
    postToHost({ action: 'profileSyncConnect', setup: true, profileId: _setupCloudProfileId });
}

function _bindSetupEvents() {
    const googleButton = document.getElementById('btnSetupGoogle');
    if (googleButton) {
        googleButton.innerHTML = `${window.DoorpiProfileSync?.googleIcon || ''}<span>${typeof t === 'function' ? t('profileSyncLoginGoogle', 'Entrar com Google') : 'Entrar com Google'}</span>`;
        googleButton.addEventListener('click', () => _setupBeginGoogleConnect(false));
    }
    document.getElementById('btnSetupSyncGoogle')?.addEventListener('click', () => _setupBeginGoogleConnect(true));
    document.getElementById('btnSetupRegister')?.addEventListener('click', () => {
        _setupShowRegistration();
    });

    document.querySelectorAll('.setup-section-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.setup-section');
            _toggleSection(section);
        });
    });

    const layoutRange = document.getElementById('setupLayoutScale');
    layoutRange?.addEventListener('input', e => {
        _setupApplyLayoutScale(e.currentTarget.value, true);
    });
    layoutRange?.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const delta = e.key === 'ArrowRight' ? 5 : -5;
            window._setupAdjustLayoutScale?.(delta, true);
            return;
        }
    }, true);

    ['setupNameInput', 'setupPinInput', 'setupApiInput'].forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('focus', () => {
            if (!window._vkbIsOpen) {
                input.removeAttribute('readonly');
                input.style.caretColor = '';
            }
        });
        input.addEventListener('blur', () => {
            if (!window._vkbIsOpen) {
                input.setAttribute('readonly', true);
                input.style.caretColor = 'transparent';
            }
        });
        input.addEventListener('click', (e) => {
            input.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(e)) return;
            if (!window._vkbIsOpen) window._vkbOpen?.(e.currentTarget);
        });
    });

    // EVENTO DE FECHAR O APP - Removido de dentro do forEach
    document.getElementById('btnSetupExit')?.addEventListener('click', () => {
        postToHost({ action: 'exitApp' });
    });

    document.getElementById('setupPhotoBtn').addEventListener('click', event => {
        if (typeof window.openDoorpiProfilePhotoPicker !== 'function') {
            console.error('[ProfilePhoto] Seletor de foto não foi carregado.');
            return;
        }
        window.openDoorpiProfilePhotoPicker({
            apiKey: _currUser?.apiKey || '',
            returnFocus: event.currentTarget,
            onApply: result => window._setupHandlePhotoSelected?.(result)
        });
    });
    document.getElementById('btnSetupPaste').addEventListener('click', () => { postToHost({ action: 'readClipboard' }); });

    document.getElementById('setupNameInput').addEventListener('input', (e) => {
        if (_currUser) _currUser.name = e.target.value;
        _renderSetupUsers();
        _updateStatus();
    });

    document.getElementById('setupApiInput').addEventListener('input', (e) => {
        if (_currUser) _currUser.apiKey = e.target.value;
        _updateStatus();
    });

    document.getElementById('setupPinInput').addEventListener('input', (e) => {
        const digits = _normalizeSetupPin(e.target.value);
        if (e.target.value !== digits) e.target.value = digits;
        if (_currUser) _currUser.pin = digits;
        _setSetupPinHintError(digits.length > 0 && digits.length < 4);
    });

    document.getElementById('btnSetupApiLink').addEventListener('click', () => {
        postToHost({ action: 'launchMediaApp', url: 'https://www.steamgriddb.com/profile/preferences/api', appType: 'webview' });
    });

    document.getElementById('btnSetupAddFolder').addEventListener('click', () => {
        _setupFolderDialogPending = true;
        postToHost({
            action: 'pickFolderForSetup',
            dialogTitle: typeof t === 'function' ? t('dlgFolderTitle') : 'Selecionar',
            forbiddenMsg: typeof t === 'function' ? t('msgFolderForbidden') : 'Proibido',
            forbiddenTitle: typeof t === 'function' ? t('msgFolderForbiddenTitle') : 'Aviso',
        });
    });

    document.getElementById('btnSetupCancel')?.addEventListener('click', () => {
        if (_isAddingUserMode) {
            _returnFromAddUserToPicker();
            return;
        }
        closeSetup();
    });

    document.getElementById('btnSetupBackAuth')?.addEventListener('click', _setupReturnToAuth);

    document.getElementById('btnSetupFinish').addEventListener('click', _validateAndFinish);

    // CORREÇÕES DE NAVEGAÇÃO PRO RODAPÉ (Forçar botão Concluir primeiro)

    // 1. Ao descer pelo botão de Adicionar Pasta
    document.getElementById('btnSetupAddFolder').addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('btnSetupFinish')?.focus();
        }
    });

    // 2. Ao descer pela barra do Passo 03 (quando fechada)
    const folderHeader = document.querySelector('[data-section="folders"]');
    if (folderHeader) {
        folderHeader.addEventListener('keydown', (e) => {
            const section = document.getElementById('setupSectionFolders');
            if (e.key === 'ArrowDown' && !section.classList.contains('expanded')) {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById('btnSetupFinish')?.focus();
            }
        });
    }

    // 3. Ao subir pelo botão Concluir (para garantir que a volta funcione perfeita)
    document.getElementById('btnSetupFinish').addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            const section = document.getElementById('setupSectionFolders');
            if (section && section.classList.contains('expanded')) {
                document.getElementById('btnSetupAddFolder')?.focus();
            } else {
                folderHeader?.focus();
            }
        }
    });
}


