// ── HTML ──────────────────────────────────────────────────────────────────────
(function buildSetupHTML() {
    const container = document.getElementById('setupContainer');
    if (!container) return;

    const chevron = `<span class="setup-section-chevron"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg></span>`;
    const personSvg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
    const svgExit = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

    container.innerHTML = `
    <canvas id="setupBg"></canvas>
    <button class="setup-back-auth setup-focusable" id="btnSetupBackAuth" tabindex="-1"><span class="setup-back-auth-arrow">‹</span><span data-i18n="profileSyncBack">Voltar</span></button>
    <section class="setup-auth-gate" id="setupAuthGate">
        <h1 class="setup-auth-title" data-i18n="profileSyncSetupTitle">Entre no Doorpi</h1>
        <p class="setup-auth-copy" id="setupAuthCopy" data-i18n="profileSyncSetupCopy">Entre no seu perfil ou cadastre-se.</p>
        <div class="setup-auth-actions">
            <button class="setup-auth-btn google setup-focusable" id="btnSetupGoogle" tabindex="-1"></button>
            <button class="setup-auth-btn setup-focusable" id="btnSetupRegister" tabindex="-1" data-i18n="profileSyncRegister">Cadastrar</button>
        </div>
        <div class="setup-auth-status" id="setupAuthStatus"></div>
    </section>
    <section class="setup-auth-loading" id="setupAuthLoading" aria-live="polite">
        <div class="setup-auth-spinner" aria-hidden="true"></div>
        <h2 data-i18n="profileSyncSigningInTitle">Entrando</h2>
        <p id="setupAuthLoadingCopy" data-i18n="profileSyncSigningInBrowser">Conclua o acesso na janela do navegador.</p>
    </section>
    <div class="setup-form">
        <div class="setup-header">
            <span class="setup-header-eyebrow" data-i18n="setupEyebrow"></span>
            <h1 class="setup-header-title" data-i18n="setupStep1Title"></h1>
            <p class="setup-header-subtitle" data-i18n="setupHeaderSubtitle"></p>
        </div>

        <div class="setup-cloud-profile" id="setupCloudProfile">
            <div class="setup-cloud-identity">
                <div class="setup-cloud-avatar" id="setupCloudAvatar"></div>
                <div class="setup-cloud-profile-copy">
                    <span class="setup-cloud-profile-label" data-i18n="profileSyncSignedInProfile">Seu perfil</span>
                    <strong class="setup-cloud-profile-name" id="setupCloudProfileName"></strong>
                </div>
            </div>
            <div class="setup-cloud-playtime">
                <span class="setup-cloud-playtime-label" data-i18n="profileSyncFieldHours">Horas jogadas</span>
                <strong class="setup-cloud-playtime-value" id="setupCloudPlaytime">0h</strong>
            </div>
        </div>

        <div class="setup-section" id="setupSectionLayout">
            <button class="setup-section-header setup-focusable" data-section="layout">
                <span class="setup-section-step">01</span>
                <span class="setup-section-label" data-i18n="setupSectionLayout">Layout da tela</span>
                <span class="setup-section-status required-empty" id="statusLayout"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupLayoutDesc"></p>
                        <div class="setup-layout-panel">
                            <div class="setup-layout-preview" aria-hidden="true">
                                <div class="setup-layout-guide" id="setupLayoutGuide"></div>
                                <div class="setup-layout-reference" id="setupLayoutReference">
                                    <div class="setup-layout-size-sample"></div>
                                </div>
                                <div class="setup-layout-stage" id="setupLayoutPreviewStage">
                                    <div class="setup-layout-size-sample"></div>
                                </div>
                            </div>
                            <div class="setup-layout-controls">
                                <div class="setup-layout-value" id="setupLayoutScaleValue"></div>
                                <input class="setup-range setup-focusable" id="setupLayoutScale" type="range" min="25" max="180" step="5" tabindex="-1" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-section" id="setupSectionIdentity">
            <button class="setup-section-header setup-focusable" data-section="identity">
                <span class="setup-section-step">02</span>
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
                                <span class="setup-field-label" data-i18n="setupPinLabel"></span>
                                <input class="setup-input setup-focusable" id="setupPinInput" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" readonly tabindex="-1" />
                                <p class="setup-pin-hint" data-i18n="setupPinHint"></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-section" id="setupSectionApiKey">
            <button class="setup-section-header setup-focusable" data-section="apikey">
                <span class="setup-section-step">03</span>
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

        <div class="setup-section" id="setupSectionGoogleSync">
            <button class="setup-section-header setup-focusable" data-section="google-sync">
                <span class="setup-section-step">04</span>
                <span class="setup-section-label" data-i18n="setupSectionGoogleSync"></span>
                <span class="setup-section-status" id="statusGoogleSync"></span>
                ${chevron}
            </button>
            <div class="setup-section-body">
                <div class="setup-section-body-inner">
                    <div class="setup-section-content">
                        <div class="setup-section-divider"></div>
                        <p class="setup-section-desc" data-i18n="setupGoogleSyncDesc"></p>
                        <div class="setup-sync-actions">
                            <button class="setup-auth-btn google setup-focusable" id="btnSetupSyncGoogle" tabindex="-1"></button>
                        </div>
                        <p class="setup-sync-message" id="setupSyncMessage" aria-live="polite"></p>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-section" id="setupSectionFolders">
            <button class="setup-section-header setup-focusable" data-section="folders">
                <span class="setup-section-step">05</span>
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
                        <button class="setup-icon-btn setup-focusable" id="btnSetupAddFolder" tabindex="-1" style="width: 100%; justify-content: center; padding-top: clamp(12px, 1.2vw, 16px); padding-bottom: clamp(12px, 1.2vw, 16px); margin-top: 4px;">
                            + <span data-i18n="setupStep4AddFolder"></span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="setup-footer">
            <button class="setup-power-btn setup-focusable" id="btnSetupExit" style="display:none;" tabindex="-1">
                ${svgExit} <span data-i18n="powerExit">Sair</span>
            </button>
            <button class="setup-icon-btn setup-focusable" id="btnSetupCancel" style="display:none;" data-i18n="setupBtnCancel">Cancelar</button>
            <button class="setup-finish-btn setup-focusable" id="btnSetupFinish"></button>
        </div>
    </div>`;

    const apiSection = container.querySelector('#setupSectionApiKey');
    const identitySection = container.querySelector('#setupSectionIdentity');
    const layoutSection = container.querySelector('#setupSectionLayout');
    const syncSection = container.querySelector('#setupSectionGoogleSync');
    if (apiSection && identitySection && layoutSection && syncSection) {
        layoutSection.after(apiSection);
        apiSection.after(identitySection);
        identitySection.after(syncSection);
        apiSection.querySelector('.setup-section-step').textContent = '02';
        identitySection.querySelector('.setup-section-step').textContent = '03';
    }

    if (typeof applyI18n === 'function') applyI18n();
    document.getElementById('setupNameInput').placeholder = typeof t === 'function' ? t('setupStep1Placeholder') : 'Seu Nome';
    document.getElementById('setupPinInput').placeholder = typeof t === 'function' ? t('setupPinPlaceholder') : 'Opcional';
    document.getElementById('setupApiInput').placeholder = typeof t === 'function' ? t('setupStep3Placeholder') : 'Chave API';

    _bindSetupEvents();
})();

