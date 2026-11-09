    // ── Novo Hub de Configurações ─────────────────────────────────────────────
    function _renderSettingsLegacy(body) {
        if (_settingsSubView === 'accountHub') { _renderSettingsAccountHub(body); return; }
        if (_settingsSubView === 'account') { _renderSettingsAccount(body); return; }
        if (_settingsSubView === 'extensions') { _renderSettingsExtensions(body); return; }
        if (_settingsSubView === 'sharing') { _renderSettingsSharing(body); return; }
        if (_settingsSubView === 'system') { _renderSettingsSystemV2(body); return; }
        if (_settingsSubView === 'devicesHub' || _settingsSubView === 'connectivityHub') { _renderSettingsDevicesHub(body); return; }
        if (_settingsSubView === 'bluetooth') { _renderSettingsBluetooth(body); return; }
        if (_settingsSubView === 'wifi') { _renderSettingsWifi(body); return; }
        if (_settingsSubView === 'sound') { _renderSettingsSound(body); return; }
        const svgUser = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const svgSys = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
        const svgControls = window.DoorpiControls?.controllerIcon?.('nav-settings-controller-svg') || `<svg viewBox="0 0 24 18" fill="currentColor" fill-opacity=".34" stroke="currentColor" stroke-width="1.4"><path d="M4 5h16c2.3 0 3.8 2.4 3 4.5l-1.5 4a2 2 0 0 1-3.2.8L16 12H8l-2.3 2.3a2 2 0 0 1-3.2-.8l-1.5-4C.2 7.4 1.7 5 4 5Z"/></svg>`;
        const svgExt = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

        body.innerHTML = `
        <div class="nav-settings-grid">
            <button class="nav-settings-card" id="setAccount" tabindex="-1">
                <div class="settings-card-icon">${svgUser}</div>
                <div class="settings-card-info">
                    <h3>${_t('navSetAccount', 'Conta e Perfil')}</h3>
                    <p>${_t('navSetAccountDesc', 'Editar avatar, nome, API Key e usuários')}</p>
                </div>
            </button>
            <button class="nav-settings-card" id="setSystem" tabindex="-1">
                <div class="settings-card-icon">${svgSys}</div>
                <div class="settings-card-info">
                    <h3>${_t('navSetSystem', 'Sistema')}</h3>
                    <p>${_t('navSetSystemDesc', 'Ajustes de inicialização do console e acesso à área de trabalho')}</p>
                </div>
            </button>
            <button class="nav-settings-card" id="setControls" tabindex="-1">
                <div class="settings-card-icon">${svgControls}</div>
                <div class="settings-card-info">
                    <h3>${_t('controlsSettingsTitle', 'Controles')}</h3>
                    <p>${_t('controlsSettingsDesc', 'Perfis reutilizáveis para apps, web apps e lojas')}</p>
                </div>
            </button>
            <button class="nav-settings-card" id="setExt" tabindex="-1">
                <div class="settings-card-icon">${svgExt}</div>
                <div class="settings-card-info">
                    <h3>${_t('navSetExt', 'Extensões')}</h3>
                    <p>${_t('navSetExtDesc', 'Gerenciar plugins e integrações')}</p>
                </div>
            </button>
        </div>
    `;

        _contentItems = [
            body.querySelector('#setAccount'),
            body.querySelector('#setSystem'),
            body.querySelector('#setControls'),
            body.querySelector('#setExt')
        ].filter(Boolean);

        body.querySelector('#setAccount')?.addEventListener('click', () => {
            _settingsSubView = 'accountHub'; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });

        body.querySelector('#setSystem')?.addEventListener('click', () => {
            _settingsSubView = 'system'; _systemSubView = null; _contentIdx = 0; _renderContent('settings'); _updateContentFocus();
        });

        body.querySelector('#setControls')?.addEventListener('click', () => {
            window.DoorpiControls?.open?.();
        });

        body.querySelector('#setExt')?.addEventListener('click', () => {
            window.openExtensionsManager?.();
        });

        _contentItems.forEach((btn, idx) => {
            btn.addEventListener('mouseenter', () => {
                _topbarFocus = false; _contentIdx = idx; _updateContentFocus();
            });
        });
    }

    function _renderSettings(body) {
        body.classList.toggle('settings-home-active', !_settingsSubView);
        if (_settingsSubView === 'webPermissions') { _renderWebPermissions(body); return; }
        if (_settingsSubView) {
            _renderSettingsLegacy(body);
            return;
        }

        const svgUser = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const svgControls = window.DoorpiControls?.controllerIcon?.('nav-settings-controller-svg') || `<svg viewBox="0 0 24 18" fill="currentColor" fill-opacity=".34" stroke="currentColor" stroke-width="1.4"><path d="M4 5h16c2.3 0 3.8 2.4 3 4.5l-1.5 4a2 2 0 0 1-3.2.8L16 12H8l-2.3 2.3a2 2 0 0 1-3.2-.8l-1.5-4C.2 7.4 1.7 5 4 5Z"/></svg>`;
        const svgDevices = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.2" width="9.4" height="13.6" rx="2.1"/><circle cx="7.7" cy="14.1" r="2.15"/><circle cx="7.7" cy="9.1" r=".72" fill="currentColor" stroke="none"/><path d="M16.5 6.2v11.6l3.6-3.6-3.6-2.2 3.6-2.2-3.6-3.6Z"/></svg>`;
        const svgPower = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>`;
        const svgStorage = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5.5" rx="8" ry="3.5"/><path d="M4 5.5v6c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5v-6"/><path d="M4 11.5v6c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5v-6"/></svg>`;
        const svgVideo = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`;
        const svgUpdate = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v6h-6"/></svg>`;
        const svgExt = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

        const entries = [
            {
                id: 'setAccount', group: 'Conta', icon: svgUser,
                title: _t('navSetAccount', 'Conta e perfis'),
                short: 'Usuários, dados pessoais e contas dos apps',
                description: 'Gerencie quem usa o Doorpi, os dados de cada perfil e como as contas dos aplicativos são compartilhadas.',
                scope: ['Perfil e avatar', 'Sincronização', 'Usuários locais', 'Contas dos apps'],
                action: 'account'
            },
            {
                id: 'setControls', group: 'Experiência', icon: svgControls,
                title: _t('controlsSettingsTitle', 'Controles'),
                short: 'Comandos globais e perfis por aplicativo',
                description: 'Personalize comandos, atalhos e comportamento do ponteiro para cada jogo, aplicativo ou serviço web.',
                scope: ['Perfis de controle', 'Atalhos globais', 'Mouse e teclado', 'Comandos primários'],
                action: 'controls'
            },
            {
                id: 'setDevices', group: 'Experiência', icon: svgDevices,
                title: 'Dispositivos e som',
                short: 'Bluetooth, áudio e acessórios conectados',
                description: 'Conecte acessórios e escolha como o Doorpi e o Windows reproduzem áudio na sua configuração.',
                scope: ['Bluetooth', 'Saída de áudio', 'Volume do sistema', 'Sons do Doorpi'],
                action: 'devices'
            },
            {
                id: 'setVideo', group: 'Experiência', icon: svgVideo,
                title: 'Tela e interface',
                short: 'Escala visual para TV ou monitor',
                description: 'Ajuste a escala da interface para preservar legibilidade e espaço útil em diferentes telas e distâncias.',
                scope: ['Escala da interface', 'Área segura', 'Legibilidade', 'Pré-visualização'],
                action: 'video'
            },
            {
                id: 'setStartup', group: 'Sistema', icon: svgPower,
                title: 'Inicialização',
                short: 'Boot, modo console e área de trabalho',
                description: 'Defina como o Doorpi inicia com o Windows e quais caminhos ficam disponíveis ao entrar no sistema.',
                scope: ['Início automático', 'Modo console', 'Game Bar', 'Área de trabalho'],
                action: 'startup'
            },
            {
                id: 'setStorage', group: 'Sistema', icon: svgStorage,
                title: 'Armazenamento',
                short: 'Discos, espaço ocupado e programas',
                description: 'Entenda como o espaço está sendo usado e abra o desinstalador oficial dos programas instalados no Windows.',
                scope: ['Uso por categoria', 'Discos disponíveis', 'Programas instalados', 'Desinstalação assistida'],
                action: 'storage'
            },
            {
                id: 'setUpdates', group: 'Sistema', icon: svgUpdate,
                title: 'Atualizações',
                short: 'Doorpi, Windows e drivers gráficos',
                description: 'Consulte versões e mantenha o Doorpi, o Windows e os componentes gráficos atualizados em um só lugar.',
                scope: ['Doorpi e Updater', 'Windows Update', 'Drivers de vídeo', 'Notas da versão'],
                action: 'updates'
            },
            {
                id: 'setWebPermissions', group: 'Sistema', icon: svgUser,
                title: _t('webPermissionsTitle', 'Permissões dos apps'),
                short: _t('webPermissionsShort', 'Câmera e microfone por aplicativo e site'),
                description: _t('webPermissionsDescription', 'Câmera e microfone autorizados ou bloqueados neste perfil. Streamings integrados, localização e notificações continuam bloqueados.'),
                scope: [_t('webPermissionCamera', 'Câmera'), _t('webPermissionMicrophone', 'Microfone')],
                action: 'webPermissions'
            },
            {
                id: 'setExt', group: 'Sistema', icon: svgExt,
                title: _t('navSetExt', 'Extensões'),
                short: 'Recursos adicionais e integrações',
                description: 'Adicione integrações ao navegador e gerencie recursos opcionais instalados no Doorpi.',
                scope: ['Extensões instaladas', 'Loja de extensões', 'Instalação por link', 'Gerenciamento'],
                action: 'extensions'
            }
        ];

        const groupMarkup = ['Conta', 'Experiência', 'Sistema'].map(group => `
            <section class="nav-settings-home-group" aria-label="${group}">
                <span class="nav-settings-home-group-title">${group}</span>
                <div class="nav-settings-home-list">
                    ${entries.filter(entry => entry.group === group).map(entry => `
                        <button class="nav-settings-home-item" id="${entry.id}" data-settings-action="${entry.action}" tabindex="-1">
                            <span class="nav-settings-home-icon">${entry.icon}</span>
                            <span class="nav-settings-home-copy">
                                <strong>${entry.title}</strong>
                                <small>${entry.short}</small>
                            </span>
                            <span class="nav-settings-home-chevron" aria-hidden="true">›</span>
                        </button>`).join('')}
                </div>
            </section>`).join('');

        body.innerHTML = `
            <div class="nav-settings-home">
                <nav class="nav-settings-home-nav" aria-label="Categorias de configurações">${groupMarkup}</nav>
                <aside class="nav-settings-home-preview" id="navSettingsHomePreview" aria-live="polite"></aside>
            </div>`;

        const preview = body.querySelector('#navSettingsHomePreview');
        const renderPreview = entry => {
            if (!preview || !entry) return;
            preview.innerHTML = `
                <div class="nav-settings-home-preview-main">
                    <div class="nav-settings-home-preview-icon">${entry.icon}</div>
                    <span class="nav-settings-home-kicker">${entry.group}</span>
                    <h3>${entry.title}</h3>
                    <p>${entry.description}</p>
                    <div class="nav-settings-home-scope">
                        ${entry.scope.map(item => `<span>${item}</span>`).join('')}
                    </div>
                </div>
                <div class="nav-settings-home-action"><kbd>A</kbd><span>Abrir configuração</span></div>`;
        };

        _contentItems = entries.map(entry => body.querySelector(`#${entry.id}`)).filter(Boolean);
        renderPreview(entries[Math.max(0, Math.min(entries.length - 1, _contentIdx))]);

        const openSystemDetail = detail => {
            _settingsReturnToRoot = true;
            _settingsSubView = 'system';
            _systemSubView = detail;
            if (detail === 'updates') _systemUpdatesSubView = 'doorpi';
            _contentIdx = 0;
            _renderContent('settings');
            _updateContentFocus();
        };

        _contentItems.forEach((button, index) => {
            const entry = entries[index];
            button.addEventListener('focus', () => renderPreview(entry));
            button.addEventListener('mouseenter', () => {
                _topbarFocus = false;
                _contentIdx = index;
                renderPreview(entry);
                _updateContentFocus();
            });
            button.addEventListener('click', () => {
                switch (entry.action) {
                    case 'account':
                        _settingsReturnToRoot = false;
                        _settingsSubView = 'accountHub';
                        _contentIdx = 0;
                        _renderContent('settings');
                        _updateContentFocus();
                        break;
                    case 'controls':
                        window.DoorpiControls?.open?.();
                        break;
                    case 'webPermissions':
                        _settingsSubView = 'webPermissions';
                        _contentIdx = 0;
                        _renderContent('settings');
                        _updateContentFocus();
                        break;
                    case 'devices':
                        _settingsReturnToRoot = true;
                        _settingsSubView = 'devicesHub';
                        _systemSubView = null;
                        _contentIdx = 0;
                        _renderContent('settings');
                        _updateContentFocus();
                        break;
                    case 'video': openSystemDetail('video'); break;
                    case 'startup': openSystemDetail('startup'); break;
                    case 'storage': openSystemDetail('storage'); break;
                    case 'updates': openSystemDetail('updates'); break;
                    case 'extensions': window.openExtensionsManager?.(); break;
                }
            });
        });
    }

    function _updateAutoStartUI() {
        const toggle = document.getElementById('autoStartToggle');
        const desc = document.getElementById('autoStartDesc');
        if (toggle) toggle.classList.toggle('on', _autoStartEnabled);
        if (desc) desc.textContent = _autoStartEnabled
            ? _t('autoStartOn', 'Ativo — o app inicia automaticamente com o Windows')
            : _t('autoStartOff', 'Desativado — não inicia automaticamente');
    }

    function _updateSystemUpdateUI() {
        const status = _systemUpdateStatus || {};
        const badge = document.getElementById('systemUpdateBadge');
        const title = document.getElementById('systemUpdateTitle');
        const sub = document.getElementById('systemUpdateSub');
        const versions = document.getElementById('systemUpdateVersions');
        const changelog = document.getElementById('systemUpdateChangelog');
        const startBtn = document.getElementById('navCardStartUpdate');

        const hasUpdate = !!(status.doorpiUpdateAvailable || status.updaterUpdateAvailable);
        const isChecking = status.status === 'checking';
        const isError = status.status === 'error';
        const isNotConfigured = status.status === 'not-configured';
        const tabState = document.getElementById('updatesTabDoorpiState');

        if (tabState) {
            tabState.textContent = status.forceUpdate
                ? 'Atualização obrigatória'
                : isChecking
                    ? 'Verificando agora'
                    : hasUpdate
                        ? 'Atualização disponível'
                        : isError
                            ? 'Falha na verificação'
                            : isNotConfigured
                                ? 'Configuração necessária'
                                : 'Sistema atualizado';
        }

        if (badge) {
            badge.textContent = status.forceUpdate
                ? 'OBRIGATORIA'
                : isChecking
                    ? 'VERIFICANDO'
                    : hasUpdate
                        ? 'DISPONÍVEL'
                        : isError
                            ? 'ERRO'
                            : isNotConfigured
                                ? 'CONFIGURAR'
                                : 'ATUALIZADO';
            badge.dataset.state = status.status || 'idle';
        }

        if (title) {
            title.textContent = hasUpdate
                ? _t('sysUpdateAvailableTitle', 'Atualização disponível')
                : _t('sysUpdateTitle', 'Atualizações do sistema');
        }

        if (sub) {
            sub.textContent = status.message || _t('sysUpdateIdle', 'Atualizações ainda não verificadas.');
        }

        if (versions) {
            const remoteDoorpi = status.remoteDoorpiVersion ? ` -> ${status.remoteDoorpiVersion}` : '';
            const remoteUpdater = status.remoteUpdaterVersion ? ` -> ${status.remoteUpdaterVersion}` : '';
            versions.innerHTML = `
                <span>Doorpi ${status.localDoorpiVersion || '--'}${remoteDoorpi}</span>
                <span>Updater ${status.localUpdaterVersion || '--'}${remoteUpdater}</span>
            `;
        }

        if (changelog) {
            const entries = Array.isArray(status.changelog) ? status.changelog : [];
            const renderedEntries = entries
                .filter(entry => entry && (entry.title || entry.version || (entry.items || []).length))
                .map(entry => {
                    const items = Array.isArray(entry.items) ? entry.items : [];
                    const version = entry.version ? `<span class="nav-release-entry-version">${_esc(entry.version)}</span>` : '';
                    return `
                        <article class="nav-release-entry">
                            <div class="nav-release-entry-title">${_esc(entry.title || 'Doorpi')}${version}</div>
                            ${items.length ? `<ul>${items.map(item => `<li>${_esc(item)}</li>`).join('')}</ul>` : ''}
                        </article>`;
                })
                .join('');

            changelog.innerHTML = `
                <div class="nav-release-notes-head">${_t('sysUpdateReleaseNotes', 'Notas da versão')}</div>
                ${renderedEntries || `<div class="nav-release-entry">${_t('sysUpdateNoChangelog', '')}</div>`}`;
        }

        if (startBtn) {
            startBtn.classList.toggle('visible', hasUpdate);
            startBtn.style.display = hasUpdate ? '' : 'none';
        }

        if (window._updateBootModeUI && document.getElementById('systemUpdatePanel')) {
            window._updateBootModeUI();
        }
    }

