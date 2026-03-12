// =============================================================================
// setup.js — Formulário de primeira configuração (TV-friendly, layout único)
// =============================================================================

const _setupData = { name: '', photoBase64: '', apiKey: '', folders: [] };

// ── Estilos ───────────────────────────────────────────────────────────────────
(function injectSetupStyles() {
    const s = document.createElement('style');
    s.textContent = `
    #setupContainer {
        position: fixed;
        inset: 0;
        z-index: 9000;
        display: none;
        align-items: flex-start;
        justify-content: center;
        background: rgba(10,10,22,0.97);
        backdrop-filter: blur(40px);
        overflow-y: auto;
        padding: clamp(36px, 5vh, 80px) clamp(24px, 5vw, 80px);
        box-sizing: border-box;
    }
    #setupContainer.visible { animation: setupFadeIn 0.3s ease forwards; }
    @keyframes setupFadeIn { from { opacity: 0; } to { opacity: 1; } }

    .setup-form {
        width: min(860px, 96vw);
        display: flex;
        flex-direction: column;
        gap: clamp(16px, 1.8vw, 26px);
        margin: 0 auto;
    }

    /* ── Cabeçalho ── */
    .setup-header {
        text-align: center;
        margin-bottom: clamp(8px, 1vw, 14px);
    }
    .setup-header-eyebrow {
        display: block;
        font-size: clamp(0.75rem, 1vw, 1.15rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.28em;
        color: rgba(255,255,255,0.38);
        margin: 0 0 clamp(12px, 1.4vw, 20px);
    }
    .setup-header-title {
        font-size: clamp(2.6rem, 4.5vw, 5.8rem);
        font-weight: 200;
        letter-spacing: -0.03em;
        color: #f0f0ff;
        margin: 0 0 clamp(14px, 1.6vw, 22px);
        line-height: 1.05;
    }
    .setup-header-subtitle {
        font-size: clamp(1rem, 1.25vw, 1.6rem);
        color: rgba(255,255,255,0.55);
        margin: 0 auto;
        max-width: 640px;
        line-height: 1.65;
        font-weight: 300;
    }

    /* ── Divisor ── */
    .setup-divider {
        height: 1px;
        background: rgba(255,255,255,0.12);
        margin: clamp(2px, 0.4vw, 6px) 0;
    }

    /* ── Seções ── */
    .setup-section {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: clamp(14px, 1.6vw, 22px);
        padding: clamp(24px, 2.8vw, 40px);
        display: flex;
        flex-direction: column;
        gap: clamp(14px, 1.6vw, 22px);
        transition: border-color 0.2s;
    }
    .setup-section:focus-within { border-color: rgba(255,255,255,0.16); }

    /* cabeçalho da seção */
    .setup-section-header {
        display: flex;
        align-items: center;
        gap: clamp(10px, 1vw, 16px);
    }
    .setup-section-icon {
        font-size: clamp(1.1rem, 1.35vw, 1.7rem);
        opacity: 0.65;
        flex-shrink: 0;
    }
    .setup-section-label {
        font-size: clamp(0.75rem, 0.88vw, 1.08rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: rgba(255,255,255,0.5);
        margin: 0;
        white-space: nowrap;
    }
    .setup-section-line {
        flex: 1;
        height: 1px;
        background: rgba(255,255,255,0.12);
    }
    .setup-optional-badge {
        font-size: clamp(0.65rem, 0.72vw, 0.88rem);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.055);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 6px;
        padding: clamp(3px,0.3vw,5px) clamp(9px,0.9vw,13px);
        flex-shrink: 0;
    }

    /* descrição da seção */
    .setup-section-desc {
        font-size: clamp(0.88rem, 1vw, 1.25rem);
        color: rgba(255,255,255,0.5);
        margin: 0;
        line-height: 1.7;
        font-weight: 300;
    }
    .setup-section-desc strong {
        color: rgba(255,255,255,0.82);
        font-weight: 500;
    }
    .setup-section-desc a {
        color: rgba(100,160,255,0.75);
        text-decoration: none;
        cursor: pointer;
    }
    .setup-section-desc a:hover { color: rgba(130,185,255,1); }

    /* ── Identidade ── */
    .setup-identity-row {
        display: flex;
        align-items: center;
        gap: clamp(18px, 2vw, 30px);
    }
    .setup-photo-btn {
        width: clamp(78px, 8.5vw, 120px);
        height: clamp(78px, 8.5vw, 120px);
        border-radius: 50%;
        background: rgba(255,255,255,0.06);
        border: 2px dashed rgba(255,255,255,0.18);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        font-size: clamp(1.5rem, 2vw, 2.6rem);
        color: rgba(255,255,255,0.2);
        cursor: pointer;
        outline: none;
        flex-shrink: 0;
        transition: border-color 0.2s, background 0.2s, transform 0.2s;
        position: relative;
    }
    .setup-photo-btn img { width:100%; height:100%; object-fit:cover; position:absolute; inset:0; }
    .setup-photo-btn:focus, .setup-photo-btn:hover {
        border-color: rgba(255,255,255,0.95);
        background: rgba(255,255,255,0.12);
        transform: scale(1.05);
        box-shadow: 0 0 0 4px rgba(255,255,255,0.2);
    }
    .setup-photo-btn.has-photo { border-style:solid; border-color:rgba(255,255,255,0.3); }

    .setup-name-wrap {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: clamp(7px, 0.8vw, 11px);
    }
    .setup-field-label {
        font-size: clamp(0.72rem, 0.8vw, 0.96rem);
        color: rgba(255,255,255,0.45);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.12em;
    }

    /* ── Inputs ── */
    .setup-input {
        width: 100%;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: clamp(10px, 1vw, 14px);
        padding: clamp(15px, 1.6vw, 22px) clamp(18px, 1.8vw, 26px);
        color: #fff;
        font-size: clamp(1.05rem, 1.2vw, 1.6rem);
        font-family: 'Outfit', sans-serif;
        font-weight: 400;
        outline: none;
        box-sizing: border-box;
        cursor: pointer;
        caret-color: transparent;
        transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
    }
    .setup-input:focus {
        border-color: rgba(255,255,255,0.9);
        background: rgba(255,255,255,0.1);
        box-shadow: 0 0 0 4px rgba(255,255,255,0.2);
    }
    .setup-input.vkb-active {
        border-color: rgba(100,160,255,0.6);
        box-shadow: 0 0 0 3px rgba(100,160,255,0.12);
        caret-color: rgba(100,160,255,0.9);
    }
    .setup-input.error {
        border-color: rgba(255,80,80,0.7);
        box-shadow: 0 0 0 3px rgba(255,80,80,0.1);
    }
    .setup-input::placeholder { color: rgba(255,255,255,0.25); }

    @keyframes setupShake {
        0%,100% { transform: translateX(0); }
        20%      { transform: translateX(-9px); }
        40%      { transform: translateX(9px); }
        60%      { transform: translateX(-5px); }
        80%      { transform: translateX(5px); }
    }
    .shake { animation: setupShake 0.33s ease; }

    /* ── API row ── */
    .setup-api-row {
        display: flex;
        gap: clamp(8px, 0.9vw, 13px);
        align-items: stretch;
    }
    .setup-api-row .setup-input { flex: 1; }

    .setup-icon-btn {
        background: rgba(255,255,255,0.11);
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: clamp(10px, 1vw, 14px);
        color: rgba(255,255,255,0.75);
        font-size: clamp(0.85rem, 0.95vw, 1.18rem);
        font-family: 'Outfit', sans-serif;
        font-weight: 600;
        padding: 0 clamp(18px, 1.8vw, 28px);
        cursor: pointer;
        outline: none;
        white-space: nowrap;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 7px;
    }
    .setup-icon-btn:focus, .setup-icon-btn:hover {
        background: rgba(255,255,255,0.2);
        border-color: rgba(255,255,255,0.85);
        color: #fff;
        box-shadow: 0 0 0 4px rgba(255,255,255,0.18);
    }
    .setup-api-link-btn {
        background: rgba(100,160,255,0.07);
        border: 1px solid rgba(100,160,255,0.18);
        border-radius: clamp(10px, 1vw, 14px);
        color: rgba(100,160,255,0.8);
        font-size: clamp(0.82rem, 0.9vw, 1.1rem);
        font-family: 'Outfit', sans-serif;
        font-weight: 600;
        padding: 0 clamp(18px, 1.8vw, 28px);
        cursor: pointer;
        outline: none;
        white-space: nowrap;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .setup-api-link-btn:focus, .setup-api-link-btn:hover {
        background: rgba(100,160,255,0.2);
        border-color: rgba(100,160,255,0.95);
        color: rgba(180,215,255,1);
        box-shadow: 0 0 0 4px rgba(100,160,255,0.2);
    }
    .setup-api-hint {
        font-size: clamp(0.82rem, 0.92vw, 1.1rem);
        color: rgba(255,255,255,0.38);
        margin: 0;
        transition: color 0.2s;
        line-height: 1.55;
    }
    .setup-api-hint.success { color: rgba(100,220,120,0.85); }
    .setup-api-hint.error   { color: rgba(255,100,100,0.85); }

    /* ── Pastas ── */
    .setup-folder-list {
        display: flex;
        flex-direction: column;
        gap: clamp(8px, 0.9vw, 13px);
    }
    .setup-folder-item {
        display: flex;
        align-items: center;
        gap: 12px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: clamp(8px, 0.9vw, 13px);
        padding: clamp(12px, 1.3vw, 18px) clamp(16px, 1.6vw, 22px);
        animation: setupFadeIn 0.2s ease;
    }
    .setup-folder-path {
        flex: 1;
        font-size: clamp(0.85rem, 0.95vw, 1.15rem);
        color: rgba(255,255,255,0.78);
        font-family: 'Cascadia Code', 'SF Mono', monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .setup-folder-remove {
        background: none;
        border: none;
        color: rgba(255,80,80,0.38);
        cursor: pointer;
        font-size: clamp(0.82rem, 0.92vw, 1.1rem);
        padding: 4px 12px;
        border-radius: 6px;
        outline: none;
        transition: color 0.15s;
        flex-shrink: 0;
        font-family: inherit;
    }
    .setup-folder-remove:focus, .setup-folder-remove:hover { color: rgba(255,80,80,1); box-shadow: 0 0 0 3px rgba(255,80,80,0.3); border-radius: 6px; }

    /* ── Rodapé ── */
    .setup-footer {
        display: flex;
        justify-content: center;
        padding: clamp(6px, 0.8vw, 12px) 0 clamp(14px, 1.6vw, 24px);
    }
    .setup-finish-btn {
        background: rgba(255,255,255,0.88);
        border: 2px solid transparent;
        border-radius: clamp(12px, 1.2vw, 18px);
        color: #06060e;
        font-family: 'Outfit', sans-serif;
        font-size: clamp(1.05rem, 1.2vw, 1.6rem);
        font-weight: 700;
        padding: clamp(16px, 1.7vw, 24px) clamp(56px, 5.5vw, 88px);
        cursor: pointer;
        outline: none;
        letter-spacing: 0.03em;
        transition: all 0.2s cubic-bezier(0.22,1,0.36,1);
        box-shadow: 0 6px 24px rgba(0,0,0,0.4);
    }
    .setup-finish-btn:focus, .setup-finish-btn:hover {
        background: #fff;
        border-color: rgba(255,255,255,0.6);
        transform: translateY(-3px) scale(1.03);
        box-shadow: 0 0 0 5px rgba(255,255,255,0.18), 0 18px 40px rgba(0,0,0,0.55);
    }
    `;
    document.head.appendChild(s);
})();

// ── HTML ──────────────────────────────────────────────────────────────────────
(function buildSetupHTML() {
    const container = document.getElementById('setupContainer');
    if (!container) return;

    container.innerHTML = `
    <div class="setup-form">

        <!-- Cabeçalho -->
        <div class="setup-header">
            <span class="setup-header-eyebrow" data-i18n="setupEyebrow"></span>
            <h1 class="setup-header-title" data-i18n="setupStep1Title"></h1>
            <p class="setup-header-subtitle" data-i18n="setupHeaderSubtitle"></p>
        </div>

        <div class="setup-divider"></div>

        <!-- Seção 1: Identidade (opcional) -->
        <div class="setup-section">
            <div class="setup-section-header">
                <span class="setup-section-icon">◎</span>
                <span class="setup-section-label" data-i18n="setupSectionIdentity"></span>
                <span class="setup-section-line"></span>
                <span class="setup-optional-badge" data-i18n="setupOptional"></span>
            </div>
            <p class="setup-section-desc" data-i18n="setupIdentityDesc"></p>
            <div class="setup-identity-row">
                <button class="setup-photo-btn setup-focusable" id="setupPhotoBtn">◎</button>
                <div class="setup-name-wrap">
                    <span class="setup-field-label" data-i18n="setupNameLabel"></span>
                    <input class="setup-input setup-focusable" id="setupNameInput" type="text" readonly />
                </div>
            </div>
        </div>

        <!-- Seção 2: API Key (obrigatório) -->
        <div class="setup-section">
            <div class="setup-section-header">
                <span class="setup-section-icon">🔑</span>
                <span class="setup-section-label" data-i18n="setupSectionApiKey"></span>
                <span class="setup-section-line"></span>
            </div>
            <p class="setup-section-desc" data-i18n="setupApiDesc"></p>
            <div class="setup-api-row">
                <input class="setup-input setup-focusable" id="setupApiInput" type="text" readonly />
                <button class="setup-icon-btn setup-focusable" id="btnSetupPaste">⎘ <span data-i18n="setupStep3PasteMode"></span></button>
                <button class="setup-api-link-btn setup-focusable" id="btnSetupApiLink">↗ <span data-i18n="setupStep3LinkText"></span></button>
            </div>
            <p class="setup-api-hint" id="setupApiHint" data-i18n="setupStep3PasteHint"></p>
        </div>

        <!-- Seção 3: Pastas (opcional) -->
        <div class="setup-section">
            <div class="setup-section-header">
                <span class="setup-section-icon">◫</span>
                <span class="setup-section-label" data-i18n="setupSectionFolders"></span>
                <span class="setup-section-line"></span>
                <span class="setup-optional-badge" data-i18n="setupOptional"></span>
            </div>
            <p class="setup-section-desc" data-i18n="setupFoldersDesc"></p>
            <div class="setup-folder-list" id="setupFolderList"></div>
            <button class="setup-icon-btn setup-focusable" id="btnSetupAddFolder" style="align-self:flex-start">
                + <span data-i18n="setupStep4AddFolder"></span>
            </button>
        </div>

        <!-- Rodapé -->
        <div class="setup-footer">
            <button class="setup-finish-btn setup-focusable" id="btnSetupFinish" data-i18n="setupStep4Finish"></button>
        </div>

    </div>`;

    applyI18n();
    document.getElementById('setupNameInput').placeholder = t('setupStep1Placeholder');
    document.getElementById('setupApiInput').placeholder = t('setupStep3Placeholder');

    _bindSetupEvents();
})();

// ── Abrir / Fechar ────────────────────────────────────────────────────────────
function openSetup() {
    isSetupOpen = true;
    const c = document.getElementById('setupContainer');
    c.style.display = 'flex';
    requestAnimationFrame(() => {
        c.classList.add('visible');
        document.getElementById('setupNameInput')?.focus();
    });
}

function closeSetup() {
    isSetupOpen = false;
    const c = document.getElementById('setupContainer');
    c.style.display = 'none';
    c.classList.remove('visible');
}

function setupBack() { closeSetup(); }

function getSetupItems() {
    const c = document.getElementById('setupContainer');
    if (!c || c.style.display === 'none') return [];
    return Array.from(c.querySelectorAll('.setup-focusable'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
}

// ── Validação & envio ─────────────────────────────────────────────────────────
function _shakeField(el) {
    if (!el) return;
    el.classList.remove('shake', 'error');
    el.classList.add('error');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('shake')));
    el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

function _validateAndFinish() {
    const apiInput = document.getElementById('setupApiInput');
    const apiKey = apiInput.value.trim();

    if (!apiKey) {
        _shakeField(apiInput);
        const hint = document.getElementById('setupApiHint');
        if (hint) { hint.textContent = t('setupStep3PasteHint'); hint.className = 'setup-api-hint error'; }
        apiInput.focus();
        return;
    }

    _setupData.name = document.getElementById('setupNameInput').value.trim();
    _setupData.apiKey = apiKey;

    postToHost({
        action: 'saveUserProfile',
        name: _setupData.name,
        photoBase64: _setupData.photoBase64,
        apiKey: _setupData.apiKey,
        folders: _setupData.folders,
    });
    closeSetup();
    showGlobalLoading(t('setupLoadingTitle'), t('setupLoadingSubtitle'));
}

// ── Eventos ───────────────────────────────────────────────────────────────────
function _bindSetupEvents() {

    document.getElementById('setupPhotoBtn').addEventListener('click', () => {
        postToHost({ action: 'pickProfilePhoto' });
    });

    document.getElementById('setupNameInput').addEventListener('click', () => {
        if (!window._vkbIsOpen) {
            window._vkbOpen?.(document.getElementById('setupNameInput'), {
                onOk: () => {
                    _setupData.name = document.getElementById('setupNameInput').value.trim();
                    window._vkbForceClose?.();
                    document.getElementById('setupApiInput')?.focus();
                },
                onCancel: () => window._vkbForceClose?.(),
            });
        }
    });

    document.getElementById('btnSetupPaste').addEventListener('click', () => {
        postToHost({ action: 'readClipboard' });
    });

    document.getElementById('setupApiInput').addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'v') { e.preventDefault(); postToHost({ action: 'readClipboard' }); }
    });

    document.getElementById('setupApiInput').addEventListener('click', () => {
        if (!window._vkbIsOpen) {
            window._vkbOpen?.(document.getElementById('setupApiInput'), {
                onOk: () => {
                    _setupData.apiKey = document.getElementById('setupApiInput').value.trim();
                    window._vkbForceClose?.();
                    document.getElementById('btnSetupAddFolder')?.focus();
                },
                onCancel: () => window._vkbForceClose?.(),
            });
        }
    });

    document.getElementById('btnSetupApiLink').addEventListener('click', () => {
        postToHost({ action: 'openUrl', url: 'https://www.steamgriddb.com/profile/preferences/api' });
    });

    document.getElementById('btnSetupAddFolder').addEventListener('click', () => {
        postToHost({
            action: 'pickFolderForSetup',
            dialogTitle: t('dlgFolderTitle'),
            forbiddenMsg: t('msgFolderForbidden'),
            forbiddenTitle: t('msgFolderForbiddenTitle'),
        });
    });

    document.getElementById('btnSetupFinish').addEventListener('click', _validateAndFinish);
}

// ── Render de pastas ──────────────────────────────────────────────────────────
function _renderSetupFolders() {
    const list = document.getElementById('setupFolderList');
    if (!list) return;
    list.innerHTML = _setupData.folders.map((f, i) => `
        <div class="setup-folder-item">
            <span class="setup-folder-path" title="${f}">${f}</span>
            <button class="setup-folder-remove" data-idx="${i}">✕</button>
        </div>`).join('');
    list.querySelectorAll('.setup-folder-remove').forEach(btn =>
        btn.addEventListener('click', () => {
            _setupData.folders.splice(parseInt(btn.dataset.idx), 1);
            _renderSetupFolders();
        })
    );
}

// ── Handlers do bridge ────────────────────────────────────────────────────────
window._setupHandlePhotoSelected = (base64) => {
    _setupData.photoBase64 = base64;
    const btn = document.getElementById('setupPhotoBtn');
    if (btn) {
        btn.innerHTML = `<img src="data:image/png;base64,${base64}" />`;
        btn.classList.add('has-photo');
    }
};

window._setupHandleFolderAdded = (path) => {
    if (!_setupData.folders.includes(path)) {
        _setupData.folders.push(path);
        _renderSetupFolders();
    }
};