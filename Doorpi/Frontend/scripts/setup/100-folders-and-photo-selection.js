function _renderSetupFolders() {
    const list = document.getElementById('setupFolderList');
    if (!list || !_currUser) return;

    const deleteSvg = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    list.innerHTML = _currUser.folders.map((f, i) => `
        <div class="setup-folder-item">
            <span class="setup-folder-path" title="${f}">${f}</span>
            <button class="setup-btn-delete setup-focusable" data-idx="${i}" tabindex="-1" title="${typeof t === 'function' ? t('titleRemoveFolder') : 'Remover Pasta'}">
                ${deleteSvg}
            </button>
        </div>`).join('');

    list.querySelectorAll('.setup-btn-delete').forEach((btn, idx, allBtns) => {
        // CORREÇÃO: Força o foco correto nas pastas e impede que o sistema intercepte
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation(); // Trava a navegação global
                // Se houver mais pastas abaixo, desce pro próximo X, senão vai pro Adicionar
                if (idx < allBtns.length - 1) {
                    allBtns[idx + 1].focus();
                } else {
                    document.getElementById('btnSetupAddFolder')?.focus();
                }
            } else if (e.key === 'ArrowUp' && idx > 0) {
                e.preventDefault();
                e.stopPropagation();
                allBtns[idx - 1].focus(); // Volta pro X da pasta acima
            }
        });

        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            _currUser.folders.splice(idx, 1);
            _renderSetupFolders();
            _updateStatus();

            setTimeout(() => {
                const newBtns = document.getElementById('setupFolderList').querySelectorAll('.setup-btn-delete');
                if (newBtns.length > 0) {
                    const focusIdx = Math.min(idx, newBtns.length - 1);
                    newBtns[focusIdx]?.focus();
                } else {
                    document.getElementById('btnSetupAddFolder')?.focus();
                }
            }, 50);
        });
    });

    const folderSec = document.getElementById('setupSectionFolders');
    if (folderSec && folderSec.classList.contains('expanded')) {
        list.querySelectorAll('.setup-focusable').forEach(el => el.tabIndex = 0);
    }
}
window._setupHandlePhotoSelected = (photo) => {
    if (!_currUser) return;
    if (typeof photo === 'string') {
        _currUser.photoBase64 = photo;
    } else if (photo) {
        _currUser.photoBase64 = photo.base64 || '';
        _currUser.photoSource = photo.photoSource || '';
        _currUser.photoSourceUrl = photo.photoSourceUrl || '';
        _currUser.photoSteamGridAssetId = Number(photo.photoSteamGridAssetId || 0);
        _currUser.photoCropX = Number(photo.photoCropX || 0);
        _currUser.photoCropY = Number(photo.photoCropY || 0);
        _currUser.photoZoom = Number(photo.photoZoom || 1);
    }
    _loadCurrentUserIntoForm();
    _renderSetupUsers();
};

window._setupHandleFolderDialogClosed = (path) => {
    _setupFolderDialogPending = false;
    if (_currUser && !_currUser.folders.includes(path)) {
        if (path) _currUser.folders.push(path);
        _renderSetupFolders();
        _updateStatus();
    }
    requestAnimationFrame(() => {
        const addFolder = document.getElementById('btnSetupAddFolder');
        addFolder?.focus({ preventScroll: true });
        addFolder?.scrollIntoView({ block: 'nearest' });
    });
};

window._setupHandleFolderAdded = path => window._setupHandleFolderDialogClosed?.(path);

