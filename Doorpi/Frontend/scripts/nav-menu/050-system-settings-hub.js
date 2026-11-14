    // ─────────────────────────────────────────────────────────────────────────
    // ── Funções de Inicialização / Componentes Settings ───────────────────────
    function _renderSettingsSystem(body) {
        if (typeof postToHost === 'function') postToHost({ action: 'requestBootMode' });

        const svgDesktop = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:20px;height:20px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;

        body.innerHTML = `
        <div class="nav-settings-subheader">
            <button class="nav-back-btn" id="setBackSystem" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
            <h2>${_t('navSetSystem', 'Sistema')}</h2>
        </div>

        <div class="nav-system-startup-panel nav-system-startup-panel-compact">
            <h3 style="font-size:1.1rem;font-weight:500;color:#fff;margin-bottom:12px;">${_t('sysBootBehavior', 'Comportamento de Inicialização')}</h3>

            <div class="nav-radio-group">
                <button class="nav-radio-btn" id="bootModeNone" data-mode="0" tabindex="-1">
                    <div class="nav-radio-circle"></div>
                    <div class="nav-radio-text">
                        <strong>${_t('sysBootNoneTitle', 'Não Iniciar Automaticamente')}</strong>
                        <span>${_t('sysBootNoneDesc', 'O aplicativo deve ser aberto manualmente pelo usuário.')}</span>
                    </div>
                </button>
                <button class="nav-radio-btn" data-mode="1" tabindex="-1">
                    <div class="nav-radio-circle"></div>
                    <div class="nav-radio-text">
                        <strong>${_t('sysBootRunTitle', 'Iniciar com Windows (Padrão)')}</strong>
                        <span>${_t('sysBootRunDesc', 'Inicia junto com o sistema operacional, mantendo a Área de Trabalho acessível ao fundo.')}</span>
                    </div>
                </button>
                <button class="nav-radio-btn" data-mode="2" tabindex="-1">
                    <div class="nav-radio-circle"></div>
                    <div class="nav-radio-text">
                        <strong>${_t('sysBootShellTitle', 'Modo Console (Imersivo)')}</strong>
                        <span>${_t('sysBootShellDesc', 'Substitui a Área de Trabalho e silencia o boot do Windows, criando uma experiência contínua e dedicada para a sua sala.')}</span>
                    </div>
                </button>
            </div>

            <div class="nav-update-panel" id="systemUpdatePanel" style="margin:22px 0 18px;padding:16px 18px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);border-radius:10px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;">
                    <div style="min-width:0;">
                        <div id="systemUpdateBadge" style="display:inline-flex;margin-bottom:8px;padding:3px 8px;border-radius:999px;background:rgba(125,203,255,.14);color:#7dcbff;font-size:.68rem;font-weight:800;letter-spacing:.12em;">${_t('sysUpdateBadgeUpdated', 'ATUALIZADO')}</div>
                        <h3 id="systemUpdateTitle" style="font-size:1.1rem;font-weight:600;color:#fff;margin:0 0 5px;">${_t('sysUpdateTitle', 'Atualizações do sistema')}</h3>
                        <p id="systemUpdateSub" style="margin:0;color:rgba(255,255,255,.56);line-height:1.35;">${_t('sysUpdateIdle', 'Atualizações ainda não verificadas.')}</p>
                    </div>
                    <div id="systemUpdateVersions" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;color:rgba(255,255,255,.62);font-size:.84rem;white-space:nowrap;"></div>
                </div>
                <section id="systemUpdateChangelog" class="nav-release-notes" tabindex="-1" role="button"></section>
            </div>

            <div class="nav-suggestions-grid" id="navUpdateActionsGrid" style="margin-bottom:18px;">
                <button class="nav-suggestion-card visible" id="navCardCheckUpdates" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('sysUpdateCheckNow', 'Verificar agora')}</div>
                    <span class="nav-suggestion-card-text">${_t('sysUpdateCheckNowDesc', 'Consulta o manifesto remoto e mostra versoes, changelog e obrigatoriedade.')}</span>
                </button>
                <button class="nav-suggestion-card" id="navCardStartUpdate" tabindex="-1" style="display:none;">
                    <div class="nav-suggestion-card-btn">${_t('sysUpdateStart', 'Atualizar')}</div>
                    <span class="nav-suggestion-card-text">${_t('sysUpdateStartDesc', 'Baixa o pacote validado, atualiza componentes e reinicia o Doorpi se necessario.')}</span>
                </button>
            </div>

            <div class="nav-update-panel" id="windowsUpdatePanel" style="margin:22px 0 18px;padding:16px 18px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);border-radius:10px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;">
                    <div style="min-width:0;">
                        <div id="windowsUpdateBadge" style="display:inline-flex;margin-bottom:8px;padding:3px 8px;border-radius:999px;background:rgba(125,203,255,.14);color:#7dcbff;font-size:.68rem;font-weight:800;letter-spacing:.12em;">WINDOWS</div>
                        <h3 id="windowsUpdateTitle" style="font-size:1.1rem;font-weight:600;color:#fff;margin:0 0 5px;">Windows Update</h3>
                        <p id="windowsUpdateSub" style="margin:0;color:rgba(255,255,255,.56);line-height:1.35;">${_t('windowsUpdateIdle', 'Atualizações do Windows ainda não verificadas.')}</p>
                    </div>
                    <div id="windowsUpdateMeta" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;color:rgba(255,255,255,.62);font-size:.84rem;white-space:nowrap;"></div>
                </div>
                <div id="windowsUpdateList" style="display:grid;gap:7px;margin:12px 0 0;color:rgba(255,255,255,.62);font-size:.86rem;line-height:1.35;"></div>
            </div>

            <div style="display:grid;gap:7px;margin:0 0 18px;padding-left:14px;border-left:2px solid rgba(125,203,255,.48);">
                <p style="margin:0;color:rgba(255,255,255,.56);font-size:.84rem;line-height:1.42;"><strong style="color:rgba(255,255,255,.84);font-weight:650;">${_t('windowsUpdateAdminNoticeTitle', 'Permiss\u00e3o administrativa necess\u00e1ria.')}</strong> ${_t('windowsUpdateAdminNoticeText', 'O Windows solicitar\u00e1 autoriza\u00e7\u00e3o antes de baixar e instalar os pacotes selecionados.')}</p>
            </div>

            <div class="nav-suggestions-grid" id="windowsUpdateActionsGrid" style="margin-bottom:18px;">
                <button class="nav-suggestion-card visible" id="navCardCheckWindowsUpdates" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('checkWindows', 'Verificar Windows')}</div>
                    <span class="nav-suggestion-card-text">${_t('checkWindowsDesc', 'Consulta o Windows Update e lista os pacotes encontrados.')}</span>
                </button>
                <button class="nav-suggestion-card" id="navCardStartWindowsUpdate" tabindex="-1" style="display:none;">
                    <div class="nav-suggestion-card-btn">${_t('windowsUpdateInstall', 'Baixar e instalar')}</div>
                    <span class="nav-suggestion-card-text">${_t('windowsUpdateInstallDesc', 'Usa a API do Windows Update para baixar e instalar em segundo plano.')}</span>
                </button>
                <button class="nav-suggestion-card" id="navCardRestartWindows" tabindex="-1" style="display:none;">
                    <div class="nav-suggestion-card-btn">${_t('restartNow', 'Reiniciar agora')}</div>
                    <span class="nav-suggestion-card-text">${_t('windowsRestartDesc', 'Reinicia o computador para concluir atualizações pendentes.')}</span>
                </button>
                <button class="nav-suggestion-card visible" id="navCardOpenWindowsUpdate" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('quickOpenWindowsUpdate', 'Abrir Windows Update')}</div>
                    <span class="nav-suggestion-card-text">${_t('windowsOpenNativeDesc', 'Abre a tela nativa do Windows com mouse e teclado pelo controle.')}</span>
                </button>
            </div>

            <div class="nav-suggestions-grid" id="navSuggestionsGrid">
                <button class="nav-suggestion-card" id="navCardSignIn" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('sysBootNoticeBtn', 'Opções de Entrada')}</div>
                    <span class="nav-suggestion-card-text">${_t('sysBootNoticeText', 'Desative a senha de login para iniciar direto no Doorpi sem teclado.')}</span>
                </button>
                <button class="nav-suggestion-card" id="navCardTaskbar" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('sysTaskbarNoticeBtn', 'Barra de Tarefas')}</div>
                    <span class="nav-suggestion-card-text">${_t('sysTaskbarNoticeText', 'Configure a Barra de Tarefas para ocultar automaticamente — sem distrações visuais no Modo Console.')}</span>
                </button>
                <button class="nav-suggestion-card" id="navCardGameBar" tabindex="-1">
                    <div class="nav-suggestion-card-btn">${_t('sysGameBarNoticeBtn', 'Xbox Game Bar')}</div>
                    <span class="nav-suggestion-card-text">${_t('sysGameBarNoticeText', 'Desative o atalho do botão Xbox para não abrir a overlay durante o uso do Doorpi.')}</span>
                </button>
            </div>

            <h3 style="font-size:1.1rem;font-weight:500;color:#fff;margin-bottom:12px;">${_t('sysActionsHeader', 'Ações do Sistema')}</h3>

            <button class="nav-settings-card" id="btnEnterDesktop" tabindex="-1" style="width:100%;">
                <div class="settings-card-icon" style="width:36px;height:36px;">${svgDesktop}</div>
                <div class="settings-card-info">
                    <h3>${_t('sysActionDesktopTitle', 'Acessar Área de Trabalho')}</h3>
                    <p>${_t('sysActionDesktopDesc', 'O controle assume a função de mouse e teclado com uma disposição de botões específica para este modo. Acesse a interface padrão do Windows para gerenciamento do sistema.')}</p>
                </div>
            </button>
        </div>
    `;

        _decorateDoorpiReturnShortcut(body);

        window._updateBootModeUI = () => {
            const currentMode = window._doorpiBootMode || 0;

            body.querySelectorAll('.nav-radio-btn').forEach(r =>
                r.classList.toggle('active', parseInt(r.dataset.mode) === currentMode));

            body.querySelector('#navCardSignIn')?.classList.toggle('visible', currentMode === 2);
            body.querySelector('#navCardTaskbar')?.classList.toggle('visible', currentMode === 1 || currentMode === 2);
            body.querySelector('#navCardGameBar')?.classList.toggle('visible', currentMode === 1 || currentMode === 2);

            _contentItems = [
                body.querySelector('#setBackSystem'),
                ...Array.from(body.querySelectorAll('.nav-radio-btn')),
                body.querySelector('#navCardCheckUpdates'),
                body.querySelector('#navCardStartUpdate'),
                body.querySelector('#navCardCheckWindowsUpdates'),
                body.querySelector('#navCardStartWindowsUpdate'),
                body.querySelector('#navCardRestartWindows'),
                body.querySelector('#navCardOpenWindowsUpdate'),
                body.querySelector('#navCardSignIn'),
                body.querySelector('#navCardTaskbar'),
                body.querySelector('#navCardGameBar'),
                body.querySelector('#btnEnterDesktop')
            ].filter(el => el && el.offsetParent !== null);

            _contentItems.forEach((el, idx) => {
                el.onmouseenter = () => {
                    _topbarFocus = false;
                    _contentIdx = idx;
                    _updateContentFocus();
                };
            });
        };

        window._updateBootModeUI();
        _updateSystemUpdateUI();
        _updateWindowsUpdateUI();
        if (typeof postToHost === 'function') postToHost({ action: 'requestUpdateStatus' });
        if (typeof postToHost === 'function') postToHost({ action: 'requestWindowsUpdateStatus' });

        body.querySelector('#setBackSystem')?.addEventListener('click', () => {
            _settingsSubView = null;
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });

        body.querySelectorAll('.nav-radio-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = parseInt(btn.dataset.mode);
                if (typeof postToHost === 'function') postToHost({ action: 'setBootMode', mode });
                window._doorpiBootMode = mode;
                window._updateBootModeUI();

                const newIdx = _contentItems.indexOf(btn);
                if (newIdx !== -1) {
                    _contentIdx = newIdx;
                }

                _updateContentFocus();
            });
        });

        body.querySelector('#navCardSignIn')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => {
                if (typeof postToHost === 'function') postToHost({ action: 'openSignInOptions' });
            });
        });

        body.querySelector('#navCardTaskbar')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => {
                if (typeof postToHost === 'function') postToHost({ action: 'openTaskbarSettings' });
            });
        });

        body.querySelector('#navCardGameBar')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => {
                if (typeof postToHost === 'function') postToHost({ action: 'openXboxGameBarSettings' });
            });
        });

        body.querySelector('#navCardCheckUpdates')?.addEventListener('click', () => {
            _systemUpdateStatus = { ..._systemUpdateStatus, status: 'checking', message: _t('quickCheckingDoorpi', 'Verificando atualizações do Doorpi...') };
            _updateSystemUpdateUI();
            if (typeof postToHost === 'function') postToHost({ action: 'checkSystemUpdates' });
        });

        body.querySelector('#navCardStartUpdate')?.addEventListener('click', () => {
            _systemUpdateStatus = { ..._systemUpdateStatus, status: 'installing', message: _t('sysUpdatePreparing', 'Preparando atualização...') };
            _updateSystemUpdateUI();
            if (typeof postToHost === 'function') postToHost({ action: 'startSystemUpdate' });
        });

        body.querySelector('#navCardCheckWindowsUpdates')?.addEventListener('click', () => {
            if (['checking', 'downloading', 'installing'].includes(_windowsUpdateStatus.status)) return;
            _windowsUpdateStatus = { ..._windowsUpdateStatus, status: 'checking', message: _t('quickCheckingWindows', 'Verificando atualizações do Windows...') };
            _updateWindowsUpdateUI();
            if (typeof postToHost === 'function') postToHost({ action: 'checkWindowsUpdates' });
        });

        body.querySelector('#navCardStartWindowsUpdate')?.addEventListener('click', () => {
            _windowsUpdateStatus = { ..._windowsUpdateStatus, status: 'downloading', message: _t('windowsUpdateDownloadingInstalling', 'Baixando e instalando atualizações do Windows...') };
            _updateWindowsUpdateUI();
            if (typeof postToHost === 'function') postToHost({ action: 'startWindowsUpdateInstall' });
        });

        body.querySelector('#navCardRestartWindows')?.addEventListener('click', () => {
            if (typeof postToHost === 'function') postToHost({ action: 'restartSystem' });
        });

        body.querySelector('#navCardOpenWindowsUpdate')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => {
                if (typeof postToHost === 'function') postToHost({ action: 'openWindowsUpdateSettings' });
            });
        });

        body.querySelector('#btnEnterDesktop')?.addEventListener('click', () => {
            _showDesktopWarning('desktop', () => {
                if (typeof postToHost === 'function') postToHost({ action: 'enterDesktopMode' });
            });
        });
    }

    function _wireSystemItems(body, selectors) {
        const activeElement = document.activeElement;
        _contentItems = selectors
            .flatMap(selector => Array.from(body.querySelectorAll(selector)))
            .filter(el => el && el.offsetParent !== null);

        const activeIndex = _contentItems.indexOf(activeElement);
        _contentIdx = activeIndex >= 0
            ? activeIndex
            : Math.max(0, Math.min(_contentIdx, Math.max(0, _contentItems.length - 1)));

        _contentItems.forEach((el, idx) => {
            el.onmouseenter = () => {
                _topbarFocus = false;
                _contentIdx = idx;
                _updateContentFocus();
            };
        });
    }

    function _returnFromSystemDetail() {
        _systemSubView = null;
        if (_settingsReturnToRoot) {
            _settingsReturnToRoot = false;
            _settingsSubView = null;
        }
        _contentIdx = 0;
        _renderContent('settings');
        _updateContentFocus();
    }

    function _settingsDirectoryMarkup(backId, title, entries) {
        const rows = entries.map(entry => `
            <button class="nav-settings-directory-item" id="${entry.id}" tabindex="-1">
                <span class="settings-card-icon">${entry.icon}</span>
                <span class="nav-settings-directory-copy"><strong>${entry.title}</strong><small>${entry.description}</small></span>
                <span class="nav-settings-directory-chevron" aria-hidden="true">›</span>
            </button>`).join('');
        const first = entries[0] || {};
        return `
            <div class="nav-settings-subheader">
                <button class="nav-back-btn" id="${backId}" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
                <h2>${title}</h2>
            </div>
            <div class="nav-settings-directory">
                <div class="nav-settings-directory-list">${rows}</div>
                <aside class="nav-settings-directory-preview" aria-live="polite">
                    <span class="settings-card-icon">${first.icon || ''}</span>
                    <h3>${first.title || ''}</h3><p>${first.description || ''}</p>
                    <div class="nav-settings-home-action"><kbd>A</kbd><span>Abrir configuração</span></div>
                </aside>
            </div>`;
    }

    function _wireSettingsDirectory(body, entries) {
        const preview = body.querySelector('.nav-settings-directory-preview');
        const show = entry => {
            if (!preview || !entry) return;
            preview.querySelector('.settings-card-icon').innerHTML = entry.icon;
            preview.querySelector('h3').textContent = entry.title;
            preview.querySelector('p').textContent = entry.description;
        };
        entries.forEach(entry => {
            const button = body.querySelector(`#${entry.id}`);
            button?.addEventListener('focus', () => show(entry));
            button?.addEventListener('mouseenter', () => show(entry));
        });
    }

    function _renderSettingsSystemV2(body) {
        if (_systemSubView === 'startup') { _renderSettingsSystemStartupV2(body); return; }
        if (_systemSubView === 'updates') { _renderSettingsSystemUpdatesV2(body); return; }
        if (_systemSubView === 'video') { _renderSettingsSystemVideo(body); return; }
        if (_systemSubView === 'storage') { _renderSettingsSystemStorage(body); return; }

        const svgPower = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>`;
        const svgStorage = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5.5" rx="8" ry="3.5"/><path d="M4 5.5v6c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5v-6"/><path d="M4 11.5v6c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5v-6"/></svg>`;
        const svgUpdate = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v6h-6"/></svg>`;
        const svgDevices = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.2" width="9.4" height="13.6" rx="2.1"/><circle cx="7.7" cy="14.1" r="2.15"/><circle cx="7.7" cy="9.1" r=".72" fill="currentColor" stroke="none"/><path d="M16.5 6.2v11.6l3.6-3.6-3.6-2.2 3.6-2.2-3.6-3.6Z"/></svg>`;
        const svgVideo = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`;

        const entries = [
            { id:'setSystemStorage', icon:svgStorage, title:'Armazenamento', description:'Espaço dos discos, conteúdo do Doorpi e programas instalados.' },
            { id:'setSystemStartup', icon:svgPower, title:'Inicialização', description:'Comportamento de boot, modo console e atalhos para ajustes essenciais.' },
            { id:'setSystemUpdates', icon:svgUpdate, title:'Atualizações', description:'Doorpi, Updater e Windows Update reunidos em uma área dedicada.' },
            { id:'setSystemDevices', icon:svgDevices, title:_t('navSetDevices', 'Dispositivos'), description:_t('navSetDevicesDesc', 'Bluetooth, som e acessórios conectados') },
            { id:'setSystemVideo', icon:svgVideo, title:_t('navSetVideo', 'Vídeo'), description:_t('navSetVideoDesc', 'Ajuste a escala visual do Doorpi') }
        ];
        body.innerHTML = _settingsDirectoryMarkup('setBackSystemHub', _t('navSetSystem', 'Sistema'), entries);
        _wireSettingsDirectory(body, entries);

        _wireSystemItems(body, ['#setBackSystemHub', '#setSystemStorage', '#setSystemStartup', '#setSystemUpdates', '#setSystemDevices', '#setSystemVideo']);

        body.querySelector('#setBackSystemHub')?.addEventListener('click', () => {
            _settingsReturnToRoot = false;
            _settingsSubView = null;
            _systemSubView = null;
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setSystemStorage')?.addEventListener('click', () => {
            _systemSubView = 'storage';
            _storageView = 'overview';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setSystemStartup')?.addEventListener('click', () => {
            _systemSubView = 'startup';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setSystemUpdates')?.addEventListener('click', () => {
            _systemSubView = 'updates';
            _systemUpdatesSubView = 'doorpi';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setSystemDevices')?.addEventListener('click', () => {
            _settingsSubView = 'devicesHub';
            _systemSubView = 'devices';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
        body.querySelector('#setSystemVideo')?.addEventListener('click', () => {
            _systemSubView = 'video';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        });
    }

