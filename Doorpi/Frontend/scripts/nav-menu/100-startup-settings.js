    function _renderSettingsSystemStartupV2(body) {
        if (typeof postToHost === 'function') postToHost({ action: 'requestBootMode' });

        body.innerHTML = `
        <div class="nav-settings-subheader">
            <button class="nav-back-btn" id="setBackSystemStartup" tabindex="-1">‹ ${_t('navBack', 'Voltar')}</button>
            <h2>Inicialização</h2>
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
                <button class="nav-radio-btn" id="bootModeRun" data-mode="1" tabindex="-1">
                    <div class="nav-radio-circle"></div>
                    <div class="nav-radio-text">
                        <strong>${_t('sysBootRunTitle', 'Iniciar com Windows (Padrão)')}</strong>
                        <span>${_t('sysBootRunDesc', 'Inicia junto com o sistema operacional, mantendo a Área de Trabalho acessível ao fundo.')}</span>
                    </div>
                </button>
                <button class="nav-radio-btn" id="bootModeShell" data-mode="2" tabindex="-1">
                    <div class="nav-radio-circle"></div>
                    <div class="nav-radio-text">
                        <strong>${_t('sysBootShellTitle', 'Modo Console (Imersivo)')}</strong>
                        <span>${_t('sysBootShellDesc', 'Substitui a Área de Trabalho e silencia o boot do Windows, criando uma experiência contínua e dedicada para a sua sala.')}</span>
                    </div>
                </button>
            </div>

            <div class="nav-suggestions-grid nav-startup-suggestions" id="navSuggestionsGrid">
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
                    <span class="nav-shortcut-row">
                        <span>${_t('sysDoorpiReturnShortcut', 'Retornar ao sistema')}</span>
                        ${_doorpiReturnShortcutHtml()}
                    </span>
                    <span class="nav-shortcut-row">
                        <span>${_t('sysWindowSwitcherShortcut', 'Alternar entre janelas')}</span>
                        ${_doorpiTaskSwitcherShortcutHtml()}
                    </span>
                    <span class="nav-suggestion-card-text">${_t('sysWindowSwitcherHint', 'Use o direcional para escolher, A para abrir e B para cancelar.')}</span>
                    <span class="nav-suggestion-card-text">${_t('sysGameBarNoticeText', 'Desative o atalho do botão Xbox para não abrir a overlay durante o uso do Doorpi.')}</span>
                </button>
            </div>

        </div>`;

        _decorateDoorpiReturnShortcut(body);

        window._updateBootModeUI = () => {
            const currentMode = window._doorpiBootMode || 0;
            body.querySelectorAll('.nav-radio-btn').forEach(r =>
                r.classList.toggle('active', parseInt(r.dataset.mode) === currentMode));
            body.querySelector('#navCardSignIn')?.classList.toggle('visible', currentMode === 2);
            body.querySelector('#navCardTaskbar')?.classList.toggle('visible', currentMode === 1 || currentMode === 2);
            body.querySelector('#navCardGameBar')?.classList.toggle('visible', currentMode === 1 || currentMode === 2);
            _wireSystemItems(body, [
                '#setBackSystemStartup',
                '#bootModeNone',
                '#bootModeRun',
                '#bootModeShell',
                '#navCardSignIn',
                '#navCardTaskbar',
                '#navCardGameBar'
            ]);
        };

        window._updateBootModeUI();

        body.querySelector('#setBackSystemStartup')?.addEventListener('click', () => {
            _returnFromSystemDetail();
        });
        body.querySelectorAll('.nav-radio-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = parseInt(btn.dataset.mode);
                if (typeof postToHost === 'function') postToHost({ action: 'setBootMode', mode });
                window._doorpiBootMode = mode;
                window._updateBootModeUI();
                _contentIdx = Math.max(0, _contentItems.indexOf(btn));
                _updateContentFocus();
            });
        });
        body.querySelector('#navCardSignIn')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => postToHost?.({ action: 'openSignInOptions' }));
        });
        body.querySelector('#navCardTaskbar')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => postToHost?.({ action: 'openTaskbarSettings' }));
        });
        body.querySelector('#navCardGameBar')?.addEventListener('click', () => {
            _showDesktopWarning('settings', () => postToHost?.({ action: 'openXboxGameBarSettings' }));
        });
    }

