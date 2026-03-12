// =============================================================================
// setup.js — Wizard de primeira configuração
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
        align-items: center;
        justify-content: center;
        background: rgba(6,6,14,0.98);
        backdrop-filter: blur(40px);
        animation: setupFadeIn 0.35s ease;
    }
    @keyframes setupFadeIn { from { opacity: 0; } to { opacity: 1; } }

    .setup-layout {
        width: min(580px, 88vw);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: clamp(24px, 2.8vw, 44px);
    }

    .setup-indicators {
        display: flex;
        gap: 10px;
        align-items: center;
    }
    .setup-indicator-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: rgba(255,255,255,0.18);
        transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
        flex-shrink: 0;
    }
    .setup-indicator-dot.active {
        background: rgba(255,255,255,0.9);
        width: 26px;
        border-radius: 4px;
    }
    .setup-indicator-dot.done {
        background: rgba(255,255,255,0.45);
    }

    .setup-step {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: clamp(14px, 1.8vw, 24px);
        text-align: center;
        animation: setupStepIn 0.28s cubic-bezier(0.22,1,0.36,1);
    }
    .setup-step.hidden { display: none; }
    @keyframes setupStepIn {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
    }

    .setup-eyebrow {
        font-size: clamp(0.6rem, 0.68vw, 0.82rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: rgba(255,255,255,0.28);
        margin: 0;
    }
    .setup-title {
        font-size: clamp(1.7rem, 2.4vw, 2.9rem);
        font-weight: 200;
        letter-spacing: -0.02em;
        color: #f5f5ff;
        margin: 0;
        line-height: 1.2;
    }
    .setup-subtitle {
        font-size: clamp(0.85rem, 0.92vw, 1.08rem);
        color: rgba(255,255,255,0.42);
        margin: 0;
        max-width: 420px;
        line-height: 1.65;
    }

    .setup-field { width: 100%; max-width: 420px; }
    .setup-input {
        width: 100%;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        padding: clamp(13px, 1.2vw, 18px) clamp(16px, 1.5vw, 22px);
        color: #fff;
        font-size: clamp(0.95rem, 1.05vw, 1.25rem);
        font-family: 'Outfit', sans-serif;
        font-weight: 400;
        outline: none;
        box-sizing: border-box;
        cursor: pointer;
        caret-color: transparent;
        transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        text-align: center;
    }
    .setup-input:focus {
        border-color: rgba(255,255,255,0.32);
        background: rgba(255,255,255,0.08);
        box-shadow: 0 0 0 3px rgba(255,255,255,0.05);
    }
    .setup-input.vkb-active {
        border-color: rgba(100,160,255,0.6);
        box-shadow: 0 0 0 3px rgba(100,160,255,0.12);
    }
    .setup-input::placeholder { color: rgba(255,255,255,0.18); }
    @keyframes setupShake {
        0%,100% { transform: translateX(0); }
        20%      { transform: translateX(-8px); }
        40%      { transform: translateX(8px); }
        60%      { transform: translateX(-5px); }
        80%      { transform: translateX(5px); }
    }

    .setup-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
        flex-wrap: wrap;
    }
    .setup-btn {
        background: rgba(255,255,255,0.10);
        border: 1px solid rgba(255,255,255,0.14);
        color: rgba(255,255,255,0.85);
        padding: clamp(11px, 0.98vw, 15px) clamp(26px, 2.4vw, 40px);
        border-radius: 10px;
        font-family: 'Outfit', sans-serif;
        font-size: clamp(0.82rem, 0.88vw, 1.05rem);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.22,1,0.36,1);
        outline: none;
    }
    .setup-btn.primary {
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.24);
    }
    .setup-btn:focus, .setup-btn:hover {
        background: rgba(255,255,255,0.96);
        color: #06060e;
        border-color: transparent;
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    }
    .setup-btn.ghost {
        background: transparent;
        border-color: rgba(255,255,255,0.07);
        color: rgba(255,255,255,0.35);
    }
    .setup-btn.ghost:focus, .setup-btn.ghost:hover {
        background: rgba(255,255,255,0.07);
        color: rgba(255,255,255,0.8);
        transform: none;
        box-shadow: none;
    }

    .setup-photo-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
    }
    .setup-photo-preview {
        width: clamp(80px, 7.5vw, 112px);
        height: clamp(80px, 7.5vw, 112px);
        border-radius: 50%;
        background: rgba(255,255,255,0.06);
        border: 2px dashed rgba(255,255,255,0.16);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        font-size: 1.8rem;
        color: rgba(255,255,255,0.18);
        transition: border-color 0.2s;
        flex-shrink: 0;
    }
    .setup-photo-preview img {
        width: 100%; height: 100%; object-fit: cover;
    }
    .setup-photo-preview.has-photo {
        border-style: solid;
        border-color: rgba(255,255,255,0.32);
    }
    .setup-photo-label {
        font-size: clamp(0.72rem, 0.75vw, 0.88rem);
        color: rgba(255,255,255,0.28);
    }

    .setup-api-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: rgba(100,160,255,0.85);
        font-size: clamp(0.8rem, 0.86vw, 0.98rem);
        font-weight: 500;
        background: rgba(100,160,255,0.07);
        border: 1px solid rgba(100,160,255,0.18);
        border-radius: 8px;
        padding: 10px 18px;
        cursor: pointer;
        outline: none;
        font-family: 'Outfit', sans-serif;
        transition: all 0.2s;
    }
    .setup-api-link:focus, .setup-api-link:hover {
        background: rgba(100,160,255,0.14);
        border-color: rgba(100,160,255,0.38);
        color: rgba(150,200,255,1);
        transform: translateY(-1px);
    }

    .setup-folder-list {
        width: 100%;
        max-width: 420px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 180px;
        overflow-y: auto;
    }
    .setup-folder-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 8px;
        padding: 10px 14px;
        gap: 12px;
    }
    .setup-folder-path {
        font-size: clamp(0.75rem, 0.8vw, 0.92rem);
        color: rgba(255,255,255,0.7);
        font-family: 'SF Mono', 'Cascadia Code', monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
        flex: 1;
    }
    .setup-folder-remove {
        background: none;
        border: none;
        color: rgba(255,80,80,0.55);
        cursor: pointer;
        font-size: 13px;
        padding: 3px 7px;
        border-radius: 4px;
        outline: none;
        transition: color 0.15s;
        flex-shrink: 0;
        font-family: inherit;
    }
    .setup-folder-remove:focus, .setup-folder-remove:hover { color: rgba(255,80,80,1); }

    .setup-hint {
        font-size: clamp(0.7rem, 0.73vw, 0.85rem);
        color: rgba(255,255,255,0.22);
        margin: 0;
    }
    `;
    document.head.appendChild(s);
})();

// ── HTML ──────────────────────────────────────────────────────────────────────
(function buildSetupHTML() {
    const container = document.getElementById('setupContainer');
    if (!container) return;

    container.style.cssText = 'position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;';

    container.innerHTML = `
    <div class="setup-layout">
        <div class="setup-indicators">
            <div class="setup-indicator-dot"></div>
            <div class="setup-indicator-dot"></div>
            <div class="setup-indicator-dot"></div>
            <div class="setup-indicator-dot"></div>
        </div>

        <!-- Step 0: Nome -->
        <div class="setup-step hidden" data-step="0">
            <p class="setup-eyebrow" data-i18n="setupEyebrow"></p>
            <h1 class="setup-title" data-i18n="setupStep1Title"></h1>
            <p class="setup-subtitle" data-i18n="setupStep1Subtitle"></p>
            <div class="setup-field">
                <input class="setup-input setup-focusable" id="setupNameInput" type="text" readonly />
            </div>
            <div class="setup-actions">
                <button class="setup-btn primary setup-focusable" id="btnSetupNameNext"
                        data-i18n="setupStep1Next"></button>
            </div>
        </div>

        <!-- Step 1: Foto -->
        <div class="setup-step hidden" data-step="1">
            <p class="setup-eyebrow" data-i18n="setupEyebrow"></p>
            <h1 class="setup-title" data-i18n="setupStep2Title"></h1>
            <p class="setup-subtitle" data-i18n="setupStep2Subtitle"></p>
            <div class="setup-photo-wrap">
                <div class="setup-photo-preview" id="setupPhotoPreview">◎</div>
                <span class="setup-photo-label" id="setupPhotoLabel" data-i18n="setupStep2NoPhoto"></span>
            </div>
            <div class="setup-actions">
                <button class="setup-btn primary setup-focusable" id="btnSetupChoosePhoto"
                        data-i18n="setupStep2Choose"></button>
                <button class="setup-btn ghost setup-focusable" id="btnSetupSkipPhoto"
                        data-i18n="setupStep2Skip"></button>
            </div>
        </div>

        <!-- Step 2: API Key -->
<div class="setup-step hidden" data-step="2">
    <p class="setup-eyebrow" data-i18n="setupEyebrow"></p>
    <h1 class="setup-title" data-i18n="setupStep3Title"></h1>
    <p class="setup-subtitle" data-i18n="setupStep3Subtitle"></p>
    <button class="setup-api-link setup-focusable" id="btnSetupApiLink">
        <span>↗</span><span data-i18n="setupStep3LinkText"></span>
    </button>
    <div class="setup-field">
        <input class="setup-input setup-focusable" id="setupApiInput" type="text" readonly />
        <p class="setup-hint" id="setupApiHint" style="margin-top:8px" data-i18n="setupStep3PasteHint"></p>
    </div>
    <div class="setup-actions">
        <button class="setup-btn primary setup-focusable" id="btnSetupPaste"
                data-i18n="setupStep3PasteMode"></button>
        <button class="setup-btn primary setup-focusable" id="btnSetupApiNext"
                data-i18n="setupStep3Next"></button>
        <button class="setup-btn ghost setup-focusable" id="btnSetupApiBack"
                data-i18n="setupStep3Back"></button>
    </div>
</div>

        <!-- Step 3: Pastas -->
        <div class="setup-step hidden" data-step="3">
            <p class="setup-eyebrow" data-i18n="setupEyebrow"></p>
            <h1 class="setup-title" data-i18n="setupStep4Title"></h1>
            <p class="setup-subtitle" data-i18n="setupStep4Subtitle"></p>
            <div class="setup-folder-list" id="setupFolderList"></div>
            <p class="setup-hint" data-i18n="setupStep4FoldersHint"></p>
            <div class="setup-actions">
                <button class="setup-btn primary setup-focusable" id="btnSetupAddFolder"
                        data-i18n="setupStep4AddFolder"></button>
                <button class="setup-btn primary setup-focusable" id="btnSetupFinish"
                        data-i18n="setupStep4Finish"></button>
                <button class="setup-btn ghost setup-focusable" id="btnSetupFoldersBack"
                        data-i18n="setupStep4Back"></button>
            </div>
        </div>
    </div>`;

    // Aplica i18n e placeholders
    applyI18n();
    document.getElementById('setupNameInput').placeholder = t('setupStep1Placeholder');
    document.getElementById('setupApiInput').placeholder = t('setupStep3Placeholder');

    _bindSetupEvents();
})();

// ── Estado ────────────────────────────────────────────────────────────────────
function openSetup() {
    isSetupOpen = true;
    document.getElementById('setupContainer').style.display = 'flex';
    _goToStep(0);
}

function closeSetup() {
    isSetupOpen = false;
    document.getElementById('setupContainer').style.display = 'none';
}

function setupBack() {
    if (_setupStep > 0) _goToStep(_setupStep - 1);
}

function _goToStep(step) {
    _setupStep = step;

    document.querySelectorAll('.setup-step').forEach((el, i) => {
        el.classList.toggle('hidden', i !== step);
    });
    document.querySelectorAll('.setup-indicator-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === step);
        dot.classList.toggle('done', i < step);
    });

    requestAnimationFrame(() => {
        const stepEl = document.querySelector(`.setup-step[data-step="${step}"]`);
        stepEl?.querySelector('.setup-focusable')?.focus();
    });
}

// Exposto para navigation.js
function getSetupItems() {
    const stepEl = document.querySelector(`.setup-step[data-step="${_setupStep}"]`);
    if (!stepEl) return [];
    return Array.from(stepEl.querySelectorAll('.setup-focusable'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
}

// ── Eventos ───────────────────────────────────────────────────────────────────
function _bindSetupEvents() {

    // Step 0 — Nome
    document.getElementById('setupNameInput').addEventListener('click', () => {
        if (!window._vkbIsOpen) {
            window._vkbOpen?.(document.getElementById('setupNameInput'), {
                onOk: () => {
                    _setupData.name = document.getElementById('setupNameInput').value.trim();
                    window._vkbForceClose?.();
                    document.getElementById('btnSetupNameNext')?.focus();
                },
                onCancel: () => window._vkbForceClose?.(),
            });
        }
    });

    document.getElementById('btnSetupNameNext').addEventListener('click', () => {
        _setupData.name = document.getElementById('setupNameInput').value.trim();
        if (!_setupData.name) {
            const input = document.getElementById('setupNameInput');
            input.focus();
            input.style.animation = 'none';
            requestAnimationFrame(() => { input.style.animation = 'setupShake 0.35s ease'; });
            return;
        }
        _goToStep(1);
    });

    // Step 1 — Foto
    document.getElementById('btnSetupChoosePhoto').addEventListener('click', () => {
        postToHost({ action: 'pickProfilePhoto' });
    });

    document.getElementById('btnSetupSkipPhoto').addEventListener('click', () => _goToStep(2));

    // Step 2 — API Key
    document.getElementById('btnSetupApiLink').addEventListener('click', () => {
        postToHost({ action: 'openUrl', url: 'https://www.steamgriddb.com/profile/preferences/api' });
    });


    document.getElementById('btnSetupPaste').addEventListener('click', () => {
        postToHost({ action: 'readClipboard' });
    });

  
    document.getElementById('setupApiInput').addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'v') {
            e.preventDefault();
            postToHost({ action: 'readClipboard' });
        }
    });

    // Digitar via VKB ao clicar no input
    document.getElementById('setupApiInput').addEventListener('click', () => {
        if (!window._vkbIsOpen) {
            window._vkbOpen?.(document.getElementById('setupApiInput'), {
                onOk: () => {
                    _setupData.apiKey = document.getElementById('setupApiInput').value.trim();
                    window._vkbForceClose?.();
                    document.getElementById('btnSetupApiNext')?.focus();
                },
                onCancel: () => window._vkbForceClose?.(),
            });
        }
    });

    document.getElementById('btnSetupApiNext').addEventListener('click', () => {
        _setupData.apiKey = document.getElementById('setupApiInput').value.trim();
        if (!_setupData.apiKey) {
            document.getElementById('setupApiInput').focus();
            const hint = document.getElementById('setupApiHint');
            if (hint) { hint.style.color = 'rgba(255,100,100,0.9)'; }
            return;
        }
        _goToStep(3);
    });

    document.getElementById('btnSetupApiBack').addEventListener('click', () => _goToStep(1));

    // Step 3 — Pastas
    document.getElementById('btnSetupAddFolder').addEventListener('click', () => {
        postToHost({
            action: 'pickFolderForSetup',
            dialogTitle: t('dlgFolderTitle'),
            forbiddenMsg: t('msgFolderForbidden'),
            forbiddenTitle: t('msgFolderForbiddenTitle'),
        });
    });

    document.getElementById('btnSetupFoldersBack').addEventListener('click', () => _goToStep(2));

    document.getElementById('btnSetupFinish').addEventListener('click', () => {
        postToHost({
            action: 'saveUserProfile',
            name: _setupData.name,
            photoBase64: _setupData.photoBase64,
            apiKey: _setupData.apiKey,
            folders: _setupData.folders,
        });
        closeSetup();
        showGlobalLoading(t('setupLoadingTitle'), t('setupLoadingSubtitle'));
        // C# responde com hideLoading após BuildCacheAsync concluir
    });
}

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

// ── Handlers chamados pelo bridge (app.js) ────────────────────────────────────
window._setupHandlePhotoSelected = (base64) => {
    _setupData.photoBase64 = base64;
    const preview = document.getElementById('setupPhotoPreview');
    const label = document.getElementById('setupPhotoLabel');
    if (preview) {
        preview.innerHTML = `<img src="data:image/png;base64,${base64}" />`;
        preview.classList.add('has-photo');
    }
    if (label) label.textContent = '✓';
    setTimeout(() => _goToStep(2), 600); 
};

window._setupHandleFolderAdded = (path) => {
    if (!_setupData.folders.includes(path)) {
        _setupData.folders.push(path);
        _renderSetupFolders();
    }
};