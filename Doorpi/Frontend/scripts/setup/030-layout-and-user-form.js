// ── Multi-user View & Logic ───────────────────────────────────────────────────

function _setupClampLayoutScale(raw) {
    const min = window.DoorpiLayoutScale?.min ?? 0.25;
    const max = window.DoorpiLayoutScale?.max ?? 1.80;
    const n = Number(raw);
    if (!Number.isFinite(n)) return window.DoorpiLayoutScale?.defaultValue ?? 1;
    return Math.max(min, Math.min(max, n));
}

function _setupGetReferenceLayoutScale() {
    const dpiScale = Math.max(0.5, Number(window.DoorpiDisplayMetrics?.dpiScale) || 1);
    return _setupClampLayoutScale(1 / dpiScale);
}

function _setupLayoutScaleMatchesReference(scale = _setupPendingLayoutScale) {
    return Math.abs(Number(scale) - _setupGetReferenceLayoutScale()) <= 0.026;
}

function _setupApplyLayoutScale(raw, commit = false) {
    const api = window.DoorpiLayoutScale;
    const scale = _setupClampLayoutScale(Number(raw) / 100);
    const next = commit ? api?.save?.(scale) : scale;
    _setupPendingLayoutScale = Number(next || scale || 1);
    const normalized = _setupPendingLayoutScale;
    const pct = Math.round(normalized * 100);
    const input = document.getElementById('setupLayoutScale');
    const value = document.getElementById('setupLayoutScaleValue');
    const stage = document.getElementById('setupLayoutPreviewStage');
    const reference = document.getElementById('setupLayoutReference');
    const guide = document.getElementById('setupLayoutGuide');
    const referenceScale = _setupGetReferenceLayoutScale();
    const relativeScale = normalized / referenceScale;
    if (input) input.value = String(pct);
    if (value) value.textContent = typeof t === 'function' ? t('setupLayoutScaleValue', pct) : `Escala da interface: ${pct}%`;
    if (stage) {
        stage.style.setProperty('--setup-preview-target-inverse-scale', (1 / referenceScale).toFixed(4));
        stage.classList.toggle('is-too-small', relativeScale < 0.974);
        stage.classList.toggle('is-too-large', relativeScale > 1.026);
    }
    if (reference) reference.style.setProperty('--setup-reference-inverse-scale', (1 / normalized).toFixed(4));
    const isCalibrated = _setupLayoutScaleMatchesReference(normalized);
    guide?.classList.toggle('is-calibrated', isCalibrated);
    if (!_isAddingUserMode) _setSetupLayoutConfirmed(isCalibrated);
    return normalized;
}

window._setupAdjustLayoutScale = function (deltaPct = 0, commit = false) {
    const input = document.getElementById('setupLayoutScale');
    if (!input) return false;
    const min = Number(input.min || 25);
    const max = Number(input.max || 180);
    const current = Number(input.value || Math.round(_setupPendingLayoutScale * 100) || 100);
    input.value = String(Math.max(min, Math.min(max, current + Number(deltaPct || 0))));
    _setupApplyLayoutScale(input.value, commit);
    input.focus({ preventScroll: true });
    return true;
};

window._setupRefreshLayoutReference = function () {
    if (!isSetupOpen) return false;
    _setupApplyLayoutScale(Math.round(_setupPendingLayoutScale * 100), false);
    return true;
};

function _setSetupLayoutConfirmed(confirmed) {
    _setupLayoutConfirmed = !!confirmed && _setupLayoutScaleMatchesReference();
    const status = document.getElementById('statusLayout');
    if (!status) return;
    status.className = 'setup-section-status ' + (_setupLayoutConfirmed ? 'done' : 'required-empty');
    status.textContent = _setupLayoutConfirmed ? '✓' : '';
}

function _renderSetupUsers() {
    const bar = document.getElementById('setupUserBar');
    if (!bar) return;
    if (_isAddingUserMode) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'flex';

    // Ícone X em SVG bem clean para o botão de deletar
    const deleteSvg = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    let html = _setupUsers.map((u, i) => `
        <div class="setup-user-group">
            <button class="setup-user-pill ${u === _currUser ? 'active' : ''} setup-focusable" data-idx="${i}" tabindex="-1">
                <div class="setup-user-pill-avatar">
                    ${u.photoBase64 ? `<img src="${window._doorpiUserPhotoSrc?.(u.photoBase64) || `data:image/png;base64,${u.photoBase64}`}" />` : `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`}
                </div>
                <span>${u.name || (typeof t === 'function' ? t('defaultUserName', i + 1) : `Usuário ${i + 1}`)}</span>
                ${i === 0 ? `<span class="setup-admin-badge">${typeof t === 'function' ? t('adminBadge', 'Admin') : 'Admin'}</span>` : ''}
            </button>
            ${_setupUsers.length > 1 ? `
            <button class="setup-btn-delete setup-focusable" data-idx="${i}" tabindex="-1" title="${typeof t === 'function' ? t('titleRemoveUser') : 'Remover Usuário'}">
                ${deleteSvg}
            </button>` : ''}
        </div>
    `).join('');
    html += `<button class="setup-user-add setup-focusable" id="btnSetupAddUser" tabindex="-1" title="${typeof t === 'function' ? t('titleAddUser') : 'Adicionar Usuário'}">+</button>`;
    bar.innerHTML = html;

    // Ação ao selecionar a pílula do usuário
    bar.querySelectorAll('.setup-user-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            _currUser = _setupUsers[parseInt(btn.dataset.idx)];
            _loadCurrentUserIntoForm();
            _renderSetupUsers();
            if (_currentSection) {
                _currentSection.querySelectorAll('.setup-focusable').forEach(el => el.tabIndex = 0);
            }
        });
    });

    // Nova Ação exclusiva para DELETAR o usuário (Agora foca via controle!)
    bar.querySelectorAll('.setup-btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            _setupUsers.splice(idx, 1);
            if (!_setupUsers.includes(_currUser)) {
                _currUser = _setupUsers[0];
            }
            _loadCurrentUserIntoForm();
            _renderSetupUsers();
            if (_currentSection) {
                _currentSection.querySelectorAll('.setup-focusable').forEach(el => el.tabIndex = 0);
            }

            // Retorna o foco pro botão mais próximo para não quebrar a navegação do controle
            const newPills = bar.querySelectorAll('.setup-user-pill');
            if (newPills.length > 0) {
                const focusIdx = Math.min(idx, newPills.length - 1);
                newPills[focusIdx]?.focus();
            }
        });
    });

    // Adicionar Novo Usuário
    bar.querySelector('#btnSetupAddUser').addEventListener('click', () => {
        const newUser = {
            id: Date.now(), name: '', pin: '', photoBase64: '', apiKey: '', folders: [],
            photoSource: '', photoSourceUrl: '', photoSteamGridAssetId: 0,
            photoCropX: 0, photoCropY: 0, photoZoom: 1, totalPlaytimeSeconds: 0
        };
        _setupUsers.push(newUser);
        _currUser = newUser;
        _loadCurrentUserIntoForm();
        _renderSetupUsers();
        const apiSection = document.getElementById('setupSectionApiKey');
        if (apiSection) _expandSection(apiSection);
        document.getElementById('setupApiInput')?.focus();
    });

    const identitySec = document.getElementById('setupSectionIdentity');
    if (identitySec && identitySec.classList.contains('expanded')) {
        bar.querySelectorAll('.setup-focusable').forEach(el => el.tabIndex = 0);
    }
}

function _loadCurrentUserIntoForm() {
    if (!_currUser) return;
    document.getElementById('setupNameInput').value = _currUser.name;
    document.getElementById('setupPinInput').value = _currUser.pin || '';
    _setSetupPinHintError(!_isValidSetupPin(_currUser.pin));
    document.getElementById('setupApiInput').value = _currUser.apiKey;
    const btn = document.getElementById('setupPhotoBtn');
    if (_currUser.photoBase64) {
        btn.innerHTML = `<img src="${window._doorpiUserPhotoSrc?.(_currUser.photoBase64) || `data:image/png;base64,${_currUser.photoBase64}`}" />`;
        btn.classList.add('has-photo');
    } else {
        btn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
        btn.classList.remove('has-photo');
    }
    _renderSetupFolders();
    _updateStatus();
}

function _updateStatus() {
    if (!_currUser) return;
    _setSetupLayoutConfirmed(_setupLayoutConfirmed);

    const nameDone = !!_currUser.name.trim();
    const statusId = document.getElementById('statusIdentity');
    if (statusId) {
        statusId.textContent = nameDone ? '✓' : '';
        statusId.className = 'setup-section-status ' + (nameDone ? 'done' : 'required-empty');
    }

    const apiDone = !!_currUser.apiKey.trim();
    const statusApi = document.getElementById('statusApiKey');
    if (statusApi) {
        statusApi.textContent = apiDone ? '✓' : '';
        statusApi.className = 'setup-section-status ' + (apiDone ? 'done' : 'required-empty');
    }

    const folderCount = _currUser.folders.length;
    const statusFolders = document.getElementById('statusFolders');
    if (statusFolders) {
        statusFolders.textContent = folderCount > 0 ? '✓' : '';
        statusFolders.className = 'setup-section-status ' + (folderCount > 0 ? 'done' : '');
    }

    _renderSetupGoogleSync();

    const label = document.querySelector('#setupSectionIdentity .setup-section-label');
    if (label) {
        label.innerHTML = _currUser.name ? `Identidade - <span style="color:#aaccff">${_currUser.name}</span>` : (typeof t === 'function' ? t('setupSectionIdentity') : 'Identidade');
    }
}

