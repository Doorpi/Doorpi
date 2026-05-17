// =============================================================================
// setup.js — Formulário de primeira configuração (TV-friendly, accordion)
// =============================================================================

let _setupUsers = [];
let _currUser = null;
let _isAddingUserMode = false;

// ── Estilos ───────────────────────────────────────────────────────────────────
(function injectSetupStyles() {
    const s = document.createElement('style');
    s.textContent = `
    #setupContainer {
        position: fixed; inset: 0; z-index: 9000; display: none;
        align-items: flex-start; justify-content: center;
        background: #0a0a20; backdrop-filter: blur(40px);
        overflow-y: auto; padding: clamp(36px, 5vh, 72px) clamp(24px, 5vw, 80px);
        box-sizing: border-box; scroll-behavior: auto; align-items: center;
    }
    #setupContainer.visible { animation: setupFadeIn 0.35s ease forwards; }

    #setupBg { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }

    .setup-form { position: relative; z-index: 1; width: min(760px, 96vw); display: flex; flex-direction: column; gap: clamp(8px, 1vw, 14px); margin: 0 auto; }
    @keyframes setupFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

    .setup-header { text-align: center; margin-bottom: clamp(16px, 2vw, 28px); }
    .setup-header-eyebrow { display: block; font-size: clamp(0.7rem, 0.9vw, 1.05rem); font-weight: 700; text-transform: uppercase; letter-spacing: 0.3em; color: rgba(255,255,255,0.35); margin: 0 0 clamp(10px, 1.2vw, 16px); }
    .setup-header-title { font-size: clamp(2.4rem, 4.2vw, 5.4rem); font-weight: 200; letter-spacing: -0.03em; color: #ffffff; margin: 0 0 clamp(10px, 1.2vw, 16px); line-height: 1.05; text-shadow: 0 2px 40px rgba(80,100,255,0.25); }
    .setup-header-subtitle { font-size: clamp(0.95rem, 1.1vw, 1.4rem); color: rgba(255,255,255,0.55); margin: 0 auto; max-width: 520px; line-height: 1.6; font-weight: 300; }

    .setup-section { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.13); border-radius: clamp(14px, 1.6vw, 20px); overflow: hidden; transition: border-color 0.3s, background 0.3s; }
    .setup-section.expanded { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.22); }
    .setup-section-header { display: flex; align-items: center; gap: clamp(10px, 1.1vw, 16px); padding: clamp(18px, 2vw, 28px) clamp(20px, 2.2vw, 32px); cursor: pointer; outline: none; width: 100%; background: none; border: none; text-align: left; font-family: inherit; transition: background 0.2s; border-radius: clamp(14px, 1.6vw, 20px); filter: drop-shadow(2px 3px 0px black); }
    .setup-section-header:focus { background: rgba(255,255,255,0.06); box-shadow: inset 0 0 0 2px rgba(255,255,255,0.30); }
    .setup-section.expanded .setup-section-header { border-radius: clamp(14px, 1.6vw, 20px) clamp(14px, 1.6vw, 20px) 0 0; }
    .setup-section-step { font-size: clamp(0.72rem, 0.82vw, 0.98rem); font-weight: 700; letter-spacing: 0.08em; color: rgba(255,255,255,0.28); flex-shrink: 0; width: 2em; text-align: center; transition: color 0.3s; }
    .setup-section.expanded .setup-section-step { color: rgba(255,255,255,0.55); }
    .setup-section-label { font-size: clamp(0.85rem, 1vw, 1.2rem); font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.60); flex: 1; }
    .setup-section.expanded .setup-section-label { color: rgba(255,255,255,0.92); }
    
    .setup-section-status { width: clamp(20px, 2vw, 28px); height: clamp(20px, 2vw, 28px); border-radius: 50%; border: 2px solid rgba(255,255,255,0.22); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: clamp(0.6rem, 0.75vw, 0.9rem); color: transparent; transition: all 0.3s; }
    .setup-section-status.done { background: rgba(100,220,120,0.2); border-color: rgba(100,220,120,0.7); color: rgba(100,220,120,1); }
    .setup-section-status.required-empty { border-color: rgba(255,255,255,0.22); }

    .setup-user-bar { padding-top: 20px;display: flex; gap: 10px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 6px; }
    .setup-user-pill { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 4px 14px 4px 4px; cursor: pointer; color: rgba(255,255,255,0.7); font-size: clamp(0.8rem, 0.9vw, 1rem); transition: all 0.2s; white-space: nowrap; outline: none; }
    .setup-user-pill:focus { border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,0.2); }
    .setup-user-pill.active { background: rgba(255,255,255,0.15); border-color: #fff; color: #fff; }
    .setup-user-pill-avatar { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.2); overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .setup-user-pill-avatar img { width: 100%; height: 100%; object-fit: cover; }

    .setup-user-group { display: flex; align-items: center; gap: 6px; }

    .setup-btn-delete {
        display: flex; align-items: center; justify-content: center;
        width: clamp(28px, 3vw, 34px); height: clamp(28px, 3vw, 34px);
        border-radius: 50%; background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12); color: rgba(255, 255, 255, 0.45);
        cursor: pointer; outline: none; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        flex-shrink: 0;
    }
    .setup-btn-delete:focus, .setup-btn-delete:hover {
        background: rgba(235, 60, 60, 0.95); border-color: rgba(255, 120, 120, 1); color: #fff;
        transform: scale(1.15); box-shadow: 0 0 0 4px rgba(235, 60, 60, 0.25), 0 6px 16px rgba(0,0,0,0.4);
    }

    .setup-user-add { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.3); cursor: pointer; color: #fff; transition: all 0.2s; outline: none; }
    .setup-user-add:hover, .setup-user-add:focus { background: rgba(255,255,255,0.15); border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,0.2); }

    .setup-section-chevron { width: clamp(18px, 1.8vw, 24px); height: clamp(18px, 1.8vw, 24px); display: flex; align-items: center; justify-content: center; flex-shrink: 0; opacity: 0.30; transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.2s; }
    .setup-section-chevron svg { width: 100%; height: 100%; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .setup-section.expanded .setup-section-chevron { transform: rotate(90deg); opacity: 0.65; }

    .setup-section-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.4s cubic-bezier(0.22,1,0.36,1); }
    .setup-section.expanded .setup-section-body { grid-template-rows: 1fr; }
    .setup-section-body-inner { overflow: hidden; }
    .setup-section-content { padding: 0 clamp(20px, 2.2vw, 32px) clamp(20px, 2.2vw, 30px); display: flex; flex-direction: column; gap: clamp(14px, 1.5vw, 20px); }
    .setup-section-divider { height: 1px; background: rgba(255,255,255,0.10); margin-bottom: clamp(2px, 0.3vw, 6px); }
    .setup-section-desc { font-size: clamp(0.85rem, 0.95vw, 1.15rem); color: rgba(255,255,255,0.50); margin: 0; line-height: 1.6; font-weight: 300; }
    .setup-identity-row { display: flex; align-items: center; gap: clamp(16px, 1.8vw, 26px); }
    
    .setup-photo-btn { width: clamp(68px, 7.5vw, 100px); height: clamp(68px, 7.5vw, 100px); border-radius: 50%; background: rgba(255,255,255,0.07); border: 2px dashed rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; overflow: hidden; color: rgba(255,255,255,0.30); cursor: pointer; outline: none; flex-shrink: 0; transition: border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s; position: relative; }
    .setup-photo-btn svg { width: 38%; height: 38%; stroke: currentColor; fill: none; stroke-width: 1.5; stroke-linecap: round; overflow: visible; }
    .setup-photo-btn img { width:100%; height:100%; object-fit:cover; position:absolute; inset:0; }
    .setup-photo-btn:focus, .setup-photo-btn:hover { border-color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.1); transform: scale(1.05); box-shadow: 0 0 0 4px rgba(255,255,255,0.15); }
    .setup-photo-btn.has-photo { border-style:solid; border-color:rgba(255,255,255,0.35); }

    .setup-name-wrap { flex: 1; display: flex; flex-direction: column; gap: clamp(6px, 0.7vw, 10px); }
    .setup-field-label { font-size: clamp(0.68rem, 0.76vw, 0.9rem); color: rgba(255,255,255,0.45); font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; }
    
    .setup-input { width: 100%; background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.18); border-radius: clamp(10px, 1vw, 13px); padding: clamp(14px, 1.5vw, 20px) clamp(16px, 1.7vw, 22px); color: #fff; font-size: clamp(1rem, 1.15vw, 1.5rem); font-family: inherit; font-weight: 400; outline: none; box-sizing: border-box; cursor: pointer; caret-color: transparent; transition: border-color 0.18s, background 0.18s, box-shadow 0.18s; }
    .setup-input:focus { border-color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.12); box-shadow: 0 0 0 4px rgba(255,255,255,0.12); }
    .setup-input.vkb-active { border-color: rgba(100,160,255,0.7); box-shadow: 0 0 0 4px rgba(100,160,255,0.15); caret-color: rgba(100,160,255,0.9); }
    .setup-input.error { border-color: rgba(255,80,80,0.8); box-shadow: 0 0 0 4px rgba(255,80,80,0.12); }
    .setup-input::placeholder { color: rgba(255,255,255,0.22); }
    @keyframes setupShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
    .shake { animation: setupShake 0.33s ease; }

    .setup-api-row { display: flex; gap: clamp(8px, 0.9vw, 12px); align-items: stretch; }
    .setup-api-row .setup-input { flex: 1; }
    .setup-icon-btn { background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.18); border-radius: clamp(10px, 1vw, 13px); color: rgba(255,255,255,0.72); font-size: clamp(0.82rem, 0.92vw, 1.12rem); font-weight: 600; padding: 0 clamp(16px, 1.7vw, 24px); cursor: pointer; outline: none; transition: all 0.15s; display: flex; align-items: center; gap: 7px; }
    .setup-icon-btn:focus, .setup-icon-btn:hover { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.9); color: #fff; box-shadow: 0 0 0 4px rgba(255,255,255,0.12); }
    .setup-api-link-btn { background: rgba(100,160,255,0.09); border: 1px solid rgba(100,160,255,0.25); border-radius: clamp(10px, 1vw, 13px); color: rgba(140,190,255,0.9); font-size: clamp(0.8rem, 0.88vw, 1.08rem); font-weight: 600; padding: 0 clamp(16px, 1.7vw, 24px); cursor: pointer; outline: none; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
    .setup-api-link-btn:focus, .setup-api-link-btn:hover { background: rgba(100,160,255,0.20); border-color: rgba(100,160,255,0.9); color: rgba(200,225,255,1); box-shadow: 0 0 0 4px rgba(100,160,255,0.15); }
    .setup-api-hint { font-size: clamp(0.8rem, 0.88vw, 1.05rem); color: rgba(255,255,255,0.38); margin: 0; transition: color 0.2s; }
    .setup-api-hint.error { color: rgba(255,100,100,0.9); }

    .setup-folder-list { display: flex; flex-direction: column; gap: clamp(7px, 0.8vw, 11px); }
    .setup-folder-item { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); border-radius: clamp(8px, 0.9vw, 12px); padding: clamp(11px, 1.2vw, 16px) clamp(14px, 1.5vw, 20px); animation: setupFadeIn 0.2s ease; }
    .setup-folder-path { flex: 1; font-size: clamp(0.82rem, 0.9vw, 1.08rem); color: rgba(255,255,255,0.72); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .setup-folder-remove { background: none; border: none; color: rgba(255,80,80,0.40); cursor: pointer; font-size: clamp(0.8rem, 0.88vw, 1.05rem); padding: 4px 10px; border-radius: 6px; outline: none; transition: color 0.15s, box-shadow 0.15s; flex-shrink: 0; }
    .setup-folder-remove:focus, .setup-folder-remove:hover { color: rgba(255,80,80,1); box-shadow: 0 0 0 3px rgba(255,80,80,0.25); }

    .setup-footer { display: flex; justify-content: center; padding: clamp(8px, 1vw, 14px) 0 clamp(16px, 1.8vw, 28px); }
    .setup-finish-btn { background: rgba(255,255,255,0.92); border: 2px solid transparent; border-radius: clamp(12px, 1.2vw, 16px); color: #06060e; font-size: clamp(1rem, 1.15vw, 1.5rem); font-weight: 700; padding: clamp(15px, 1.6vw, 22px) clamp(52px, 5.2vw, 80px); cursor: pointer; outline: none; letter-spacing: 0.02em; transition: all 0.2s; box-shadow: 0 6px 24px rgba(0,0,0,0.35); }
    .setup-finish-btn:focus, .setup-finish-btn:hover { background: #fff; transform: translateY(-2px) scale(1.03); box-shadow: 0 0 0 5px rgba(255,255,255,0.2), 0 16px 36px rgba(0,0,0,0.5); }
    `;
    document.head.appendChild(s);
})();

// ── HTML ──────────────────────────────────────────────────────────────────────
(function buildSetupHTML() {
    const container = document.getElementById('setupContainer');
    if (!container) return;

    const chevron = `<span class="setup-section-chevron"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg></span>`;
    const personSvg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;

    container.innerHTML = `
    <canvas id="setupBg"></canvas>
    <div class="setup-form">
        <div class="setup-header">
            <span class="setup-header-eyebrow" data-i18n="setupEyebrow"></span>
            <h1 class="setup-header-title" data-i18n="setupStep1Title"></h1>
            <p class="setup-header-subtitle" data-i18n="setupHeaderSubtitle"></p>
        </div>

        <div class="setup-section" id="setupSectionIdentity">
            <button class="setup-section-header setup-focusable" data-section="identity">
                <span class="setup-section-step">01</span>
                <span class="setup-section-label" data-i18n="setupSectionIdentity">Identidade</span>
                <span class="setup-section-status required-empty" id="statusIdentity"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupIdentityDesc"></p>
                        
                        <div class="setup-user-bar" id="setupUserBar"></div>
                        
                        <div class="setup-identity-row">
                            <button class="setup-photo-btn setup-focusable" id="setupPhotoBtn" tabindex="-1">${personSvg}</button>
                            <div class="setup-name-wrap">
                                <span class="setup-field-label" data-i18n="setupNameLabel"></span>
                                <input class="setup-input setup-focusable" id="setupNameInput" type="text" readonly tabindex="-1" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-section" id="setupSectionApiKey">
            <button class="setup-section-header setup-focusable" data-section="apikey">
                <span class="setup-section-step">02</span>
                <span class="setup-section-label" data-i18n="setupSectionApiKey"></span>
                <span class="setup-section-status required-empty" id="statusApiKey"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupApiDesc"></p>
                        <div class="setup-api-row">
                            <input class="setup-input setup-focusable" id="setupApiInput" type="text" readonly tabindex="-1" maxlength="32" />
                            <button class="setup-icon-btn setup-focusable" id="btnSetupPaste" tabindex="-1"><span data-i18n="setupStep3PasteMode"></span></button>
                            <button class="setup-api-link-btn setup-focusable" id="btnSetupApiLink" tabindex="-1"><span data-i18n="setupStep3LinkText"></span></button>
                        </div>
                        <p class="setup-api-hint" id="setupApiHint" data-i18n="setupStep3PasteHint"></p>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-section" id="setupSectionFolders">
            <button class="setup-section-header setup-focusable" data-section="folders">
                <span class="setup-section-step">03</span>
                <span class="setup-section-label" data-i18n="setupSectionFolders"></span>
                <span class="setup-section-status" id="statusFolders"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupFoldersDesc"></p>
                        <div class="setup-folder-list" id="setupFolderList"></div>
                        <button class="setup-icon-btn setup-focusable" id="btnSetupAddFolder" tabindex="-1" style="align-self:flex-start">
                            + <span data-i18n="setupStep4AddFolder"></span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-footer">
            <button class="setup-icon-btn setup-focusable" id="btnSetupCancel" style="display:none; margin-right: 12px;" data-i18n="setupBtnCancel">Cancelar</button>
            <button class="setup-finish-btn setup-focusable" id="btnSetupFinish"></button>
        </div>
    </div>`;

    if (typeof applyI18n === 'function') applyI18n();
    document.getElementById('setupNameInput').placeholder = typeof t === 'function' ? t('setupStep1Placeholder') : 'Seu Nome';
    document.getElementById('setupApiInput').placeholder = typeof t === 'function' ? t('setupStep3Placeholder') : 'Chave API';

    _bindSetupEvents();
})();

// ── Multi-user View & Logic ───────────────────────────────────────────────────

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
                    ${u.photoBase64 ? `<img src="data:image/png;base64,${u.photoBase64}" />` : `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`}
                </div>
                <span>${u.name || (typeof t === 'function' ? t('defaultUserName', i + 1) : `Usuário ${i + 1}`)}</span>
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
        const newUser = { id: Date.now(), name: '', photoBase64: '', apiKey: '', folders: [] };
        _setupUsers.push(newUser);
        _currUser = newUser;
        _loadCurrentUserIntoForm();
        _renderSetupUsers();
        if (_currentSection) {
            _currentSection.querySelectorAll('.setup-focusable').forEach(el => el.tabIndex = 0);
        }
        document.getElementById('setupNameInput')?.focus();
    });

    const identitySec = document.getElementById('setupSectionIdentity');
    if (identitySec && identitySec.classList.contains('expanded')) {
        bar.querySelectorAll('.setup-focusable').forEach(el => el.tabIndex = 0);
    }
}

function _loadCurrentUserIntoForm() {
    if (!_currUser) return;
    document.getElementById('setupNameInput').value = _currUser.name;
    document.getElementById('setupApiInput').value = _currUser.apiKey;
    const btn = document.getElementById('setupPhotoBtn');
    if (_currUser.photoBase64) {
        btn.innerHTML = `<img src="data:image/png;base64,${_currUser.photoBase64}" />`;
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

    const label = document.querySelector('#setupSectionIdentity .setup-section-label');
    if (label) {
        label.innerHTML = _currUser.name ? `Identidade - <span style="color:#aaccff">${_currUser.name}</span>` : (typeof t === 'function' ? t('setupSectionIdentity') : 'Identidade');
    }
}

let _currentSection = null;

function _expandSection(sectionEl) {
    if (_currentSection && _currentSection !== sectionEl) _collapseSection(_currentSection);
    sectionEl.classList.add('expanded');
    _currentSection = sectionEl;

    sectionEl.querySelectorAll('.setup-focusable:not(.setup-section-header)').forEach(el => { el.tabIndex = 0; });
}

function _collapseSection(sectionEl) {
    sectionEl.classList.remove('expanded');
    if (_currentSection === sectionEl) _currentSection = null;

    sectionEl.querySelectorAll('.setup-focusable:not(.setup-section-header)').forEach(el => { el.tabIndex = -1; });
}

function _toggleSection(sectionEl) {
    if (sectionEl.classList.contains('expanded')) {
        _collapseSection(sectionEl);
    } else {
        _expandSection(sectionEl);
        setTimeout(() => {
            const first = sectionEl.querySelector('.setup-focusable:not(.setup-section-header)');
            first?.focus();
        }, 50);
    }
}

// Variável global para armazenar a animação atual
let _setupScrollRafId = null;

function _smoothScrollSetup(container, targetScrollTop, duration = 250) { // <-- Reduzi a duração para não brigar com os 80ms do C#
    const start = container.scrollTop;
    const delta = targetScrollTop - start;
    if (Math.abs(delta) < 2) return;

    // Cancela a animação anterior se o usuário segurar o direcional no controle
    if (_setupScrollRafId) {
        cancelAnimationFrame(_setupScrollRafId);
        _setupScrollRafId = null;
    }

    const t0 = performance.now();
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    (function step(now) {
        const p = Math.min((now - t0) / duration, 1);
        container.scrollTop = start + delta * ease(p);
        if (p < 1) {
            _setupScrollRafId = requestAnimationFrame(step);
        } else {
            _setupScrollRafId = null;
        }
    })(performance.now());
}
window._setupSmoothScroll = (targetScrollTop) => {
    const container = document.getElementById('setupContainer');
    if (container) _smoothScrollSetup(container, targetScrollTop);
};

// ── Lógica Restaurada do Canvas de Fundo (Exclusivo e Isolado do Setup) ────────
let _bgRaf = null;

function _startSetupBg() {
    if (_bgRaf) return; // Evita empilhar o requestAnimationFrame
    const canvas = document.getElementById('setupBg');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const blobs = [
        { px: 0.0, py: 0.3, sx: 0.00018, sy: 0.00013, r: 0.62, color: [45, 65, 185] },
        { px: 1.2, py: 2.1, sx: 0.00014, sy: 0.00019, r: 0.56, color: [28, 85, 210] },
        { px: 2.5, py: 0.8, sx: 0.00022, sy: 0.00011, r: 0.52, color: [70, 50, 165] },
        { px: 0.7, py: 3.4, sx: 0.00016, sy: 0.00024, r: 0.50, color: [22, 110, 175] },
        { px: 3.1, py: 1.6, sx: 0.00012, sy: 0.00017, r: 0.46, color: [90, 70, 195] },
        { px: 1.8, py: 4.2, sx: 0.00020, sy: 0.00015, r: 0.42, color: [30, 130, 190] },
    ];
    let t = 0;

    function resize() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();

    // Anexa evento resize de modo seguro
    if (!canvas._hasResize) {
        window.addEventListener('resize', resize);
        canvas._hasResize = true;
    }

    function frame() {
        if (!isSetupOpen) return;
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = '#07071a';
        ctx.fillRect(0, 0, W, H);

        blobs.forEach(b => {
            const x = W * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t * b.sx + b.px)));
            const y = H * (0.10 + 0.8 * (0.5 + 0.5 * Math.sin(t * b.sy + b.py)));
            const r = Math.min(W, H) * b.r;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const [cr, cg, cb] = b.color;
            g.addColorStop(0, `rgba(${cr},${cg},${cb},0.55)`);
            g.addColorStop(0.4, `rgba(${cr},${cg},${cb},0.22)`);
            g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.72, t * 0.00004, 0, Math.PI * 2);
            ctx.fill();
        });

        const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,18,0.62)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);

        t++;
        _bgRaf = requestAnimationFrame(frame);
    }
    frame();
}

function _stopSetupBg() {
    if (_bgRaf) {
        cancelAnimationFrame(_bgRaf);
        _bgRaf = null;
    }
}

// ──────────────────────────────────────────────────────────────────────────────

function openSetup(isAddingUser = false) {
    if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
    }
    _isAddingUserMode = isAddingUser;
    _setupUsers = [{ id: Date.now(), name: '', photoBase64: '', apiKey: '', folders: [] }];
    _currUser = _setupUsers[0];
    _currentSection = null;
    document.querySelectorAll('.setup-section').forEach(sec => sec.classList.remove('expanded'));
    document.querySelectorAll('.setup-focusable:not(.setup-section-header)').forEach(el => el.tabIndex = -1);

    document.querySelectorAll('.setup-footer .setup-focusable').forEach(el => el.tabIndex = 0);

    _loadCurrentUserIntoForm();
    _renderSetupUsers();
    const btnCancel = document.getElementById('btnSetupCancel');
    if (btnCancel) btnCancel.style.display = isAddingUser ? 'block' : 'none';

    document.getElementById('btnSetupFinish').textContent = isAddingUser ? (typeof t === 'function' ? t('addUsuario', 'Adicionar Usuário') : 'Adicionar Usuário') : (typeof t === 'function' ? t('setupStep4Finish') : 'Concluir');

    isSetupOpen = true;
    const c = document.getElementById('setupContainer');
    c.style.display = 'flex';
    requestAnimationFrame(() => {
        c.classList.add('visible');
        const header = document.querySelector('.setup-section-header');
        if (header && !_currentSection) _toggleSection(header.parentElement);
        header?.focus();
        _startSetupBg(); // Inicia o background animado nativo
    });
}

function closeSetup() {
    isSetupOpen = false;
    const c = document.getElementById('setupContainer');
    c.style.display = 'none';
    c.classList.remove('visible');
    _stopSetupBg(); // Para a animação do Setup ao fechar para poupar recursos
    window.focusFeaturedCard?.();
}

function setupBack() { closeSetup(); }

function getSetupItems() {
    const c = document.getElementById('setupContainer');
    if (!c || c.style.display === 'none') return [];
    return Array.from(c.querySelectorAll('.setup-focusable'))
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && el.tabIndex !== -1);
}

function _shakeField(el) {
    if (!el) return;
    el.classList.remove('shake', 'error');
    el.classList.add('error');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('shake')));
    el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

function _validateAndFinish() {
    for (let i = 0; i < _setupUsers.length; i++) {
        const u = _setupUsers[i];
        if (!u.name) {
            _currUser = u; _loadCurrentUserIntoForm(); _renderSetupUsers();
            _expandSection(document.getElementById('setupSectionIdentity'));
            setTimeout(() => { _shakeField(document.getElementById('setupNameInput')); document.getElementById('setupNameInput')?.focus(); }, 80);
            return;
        }
        if (!u.apiKey) {
            _currUser = u; _loadCurrentUserIntoForm(); _renderSetupUsers();
            _expandSection(document.getElementById('setupSectionApiKey'));
            setTimeout(() => { _shakeField(document.getElementById('setupApiInput')); document.getElementById('setupApiInput')?.focus(); }, 80);
            return;
        }
    }

    // 1. Fecha o Setup e limpa a memória (fundo animado, etc)
    closeSetup();

    // 2. Aciona a interface de Loading
    const title = typeof t === 'function' ? t('preparingSystem', 'Preparando...') : 'Preparando...';
    if (typeof showSystemLoading === 'function') {
        showSystemLoading(title, 'Configurando pastas e baixando mídias...');
    } else if (typeof showGlobalLoading === 'function') {
        showGlobalLoading(title, 'Configurando pastas e baixando mídias...');
    } else {
        window.postMessage({ type: 'showSystemLoading', title: title, subtitle: 'Configurando pastas e baixando mídias...' }, '*');
    }

    setTimeout(() => {
        postToHost({
            action: 'saveSetupUsers',
            activeIndex: 0,
            createAll: _isAddingUserMode,
            users: _setupUsers.map(u => ({
                name: u.name,
                photoBase64: u.photoBase64,
                apiKey: u.apiKey,
                folders: u.folders
            }))
        });
    }, 150);
}

function _bindSetupEvents() {
    document.querySelectorAll('.setup-section-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.setup-section');
            _toggleSection(section);
        });
    });

    ['setupNameInput', 'setupApiInput'].forEach(id => {
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
            if (!window._vkbIsOpen) window._vkbOpen?.(e.currentTarget);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !window._vkbIsOpen) window._vkbOpen?.(e.currentTarget);
        });
    });

    document.getElementById('setupPhotoBtn').addEventListener('click', () => { postToHost({ action: 'pickProfilePhoto' }); });
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

    document.getElementById('btnSetupApiLink').addEventListener('click', () => {
        postToHost({ action: 'launchMediaApp', url: 'https://www.steamgriddb.com/profile/preferences/api', appType: 'webview' });
    });

    document.getElementById('btnSetupAddFolder').addEventListener('click', () => {
        postToHost({
            action: 'pickFolderForSetup',
            dialogTitle: typeof t === 'function' ? t('dlgFolderTitle') : 'Selecionar',
            forbiddenMsg: typeof t === 'function' ? t('msgFolderForbidden') : 'Proibido',
            forbiddenTitle: typeof t === 'function' ? t('msgFolderForbiddenTitle') : 'Aviso',
        });
    });

    document.getElementById('btnSetupCancel')?.addEventListener('click', () => {
        closeSetup();
        if (_isAddingUserMode) {
            postToHost({ action: 'requestUsers' });
        }
    });
    document.getElementById('btnSetupFinish').addEventListener('click', _validateAndFinish);
}

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

    list.querySelectorAll('.setup-btn-delete').forEach(btn =>
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            _currUser.folders.splice(idx, 1);
            _renderSetupFolders();
            _updateStatus();

            // Lógica essencial para GAMEPAD: redireciona o foco para o botão anterior 
            // ou para o botão "Adicionar Pasta", evitando "foco morto".
            setTimeout(() => {
                const newBtns = document.getElementById('setupFolderList').querySelectorAll('.setup-btn-delete');
                if (newBtns.length > 0) {
                    const focusIdx = Math.min(idx, newBtns.length - 1);
                    newBtns[focusIdx]?.focus();
                } else {
                    document.getElementById('btnSetupAddFolder')?.focus();
                }
            }, 50);
        })
    );

    const folderSec = document.getElementById('setupSectionFolders');
    if (folderSec && folderSec.classList.contains('expanded')) {
        list.querySelectorAll('.setup-focusable').forEach(el => el.tabIndex = 0);
    }
}

window._setupHandlePhotoSelected = (base64) => {
    if (_currUser) _currUser.photoBase64 = base64;
    _loadCurrentUserIntoForm();
    _renderSetupUsers();
};

window._setupHandleFolderAdded = (path) => {
    if (_currUser && !_currUser.folders.includes(path)) {
        _currUser.folders.push(path);
        _renderSetupFolders();
        _updateStatus();
    }
};
