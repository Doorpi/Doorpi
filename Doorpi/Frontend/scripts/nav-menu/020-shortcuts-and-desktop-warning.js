    function _ensureDoorpiShortcutStyles() {
        if (document.getElementById('doorpiShortcutStyles')) return;
        const s = document.createElement('style');
        s.id = 'doorpiShortcutStyles';
        s.textContent = __doorpiCss("injected-styles/nav-menu/doorpi-shortcut-styles.css");
        document.head.appendChild(s);
    }

    function _xboxButtonSvg() {
        return `<svg viewBox="1 1 30 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M11.9 9.3c-5.1-5.1-6.4-4-6.4-4C2.7 8 1 11.8 1 16c0 3.4 1.1 6.6 3.1 9.1h.1V25C3 21.5 8.9 12.9 11.9 9.3zm14.6-4s-1.3-1.1-6.4 3.9c3 3.6 8.9 12.2 7.7 15.7v.1h.1c1.9-2.5 3.1-5.7 3.1-9.1 0-4.1-1.7-7.9-4.5-10.6zM16 5.4c.5-.2 4.9-2.8 7.8-2.1h.1v-.1C21.5 1.8 19 1 16 1s-5.5.8-7.8 2.2v.1h.1c2.5-.6 6.6 1.5 7.7 2.1zm0 7.7c0-.1 0-.1 0 0C11.4 16.5 3.7 25 6.1 27.3 8.8 29.6 12.2 31 16 31s7.2-1.4 9.9-3.7c2.3-2.4-5.4-10.8-9.9-14.2z"/></svg>`;
    }

    function _doorpiReturnShortcutHtml() {
        _ensureDoorpiShortcutStyles();
        return `<span class="doorpi-shortcut-combo" aria-label="Xbox ou LB + RB + R3">
            <span class="doorpi-xbox-logo-btn">${_xboxButtonSvg()}</span>
            <span class="doorpi-shortcut-plus">/</span>
            <span class="doorpi-keycap">LB</span>
            <span class="doorpi-shortcut-plus">+</span>
            <span class="doorpi-keycap">RB</span>
            <span class="doorpi-shortcut-plus">+</span>
            <span class="doorpi-stickcap">R3</span>
        </span>`;
    }

    function _doorpiTaskSwitcherShortcutHtml() {
        _ensureDoorpiShortcutStyles();
        return `<span class="doorpi-shortcut-combo" aria-label="Xbox + Select ou LB + RB + Select">
            <span class="doorpi-xbox-logo-btn">${_xboxButtonSvg()}</span>
            <span class="doorpi-shortcut-plus">+</span>
            <span class="doorpi-keycap">SELECT</span>
            <span class="doorpi-shortcut-plus">/</span>
            <span class="doorpi-keycap">LB</span>
            <span class="doorpi-shortcut-plus">+</span>
            <span class="doorpi-keycap">RB</span>
            <span class="doorpi-shortcut-plus">+</span>
            <span class="doorpi-keycap">SELECT</span>
        </span>`;
    }

    function _decorateDoorpiReturnShortcut(root) {
        const card = root?.querySelector?.('#navCardGameBar');
        if (!card || card.querySelector('.nav-shortcut-row')) return;
        const title = card.querySelector('.nav-suggestion-card-btn');
        title?.insertAdjacentHTML('afterend', `
            <span class="nav-shortcut-row">
                <span>${_t('sysDoorpiReturnShortcut', 'Retornar ao sistema')}</span>
                ${_doorpiReturnShortcutHtml()}
            </span>
            <span class="nav-shortcut-row">
                <span>${_t('sysWindowSwitcherShortcut', 'Alternar entre janelas')}</span>
                ${_doorpiTaskSwitcherShortcutHtml()}
            </span>
            <span class="nav-suggestion-card-text">${_t('sysWindowSwitcherHint', 'Use o direcional para escolher, A para abrir e B para cancelar.')}</span>
        `);
    }

    function _showDesktopWarning(context, onConfirm) {
        // Verifica se o usuário já marcou para não exibir novamente
        if (localStorage.getItem('doorpi_skip_desktop_warning') === 'true') {
            if (onConfirm) onConfirm();
            return;
        }

        let overlay = document.getElementById('desktopWarningOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'desktopWarningOverlay';
            overlay.className = 'desktop-warning-overlay';

            const s = document.createElement('style');
            s.textContent = __doorpiCss("injected-styles/nav-menu/shortcuts-and-desktop-warning-2.css");
            document.head.appendChild(s);
            document.body.appendChild(overlay);
        }

        // Lógica para diferenciar a mensagem de "Sair" dependendo do Contexto
        const exitContentHtml = context === 'settings'
            ? `<div class="dw-item" style="grid-column: 1 / -1; margin-top: 8px; justify-content: center; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; text-align: center;">
                    <span id="dwSettingsExit" style="font-weight: 500; color:#ffd166;"></span>
               </div>`
            : `<div class="dw-item" style="grid-column: 1 / -1; margin-top: 8px; justify-content: center; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; display: flex; align-items: center; gap: 12px;">
                    ${_doorpiReturnShortcutHtml()}
                    <span id="dwExit" style="font-weight: 500; color:#fff;"></span>
               </div>`;

        overlay.innerHTML = `
            <div class="dw-modal">
                <div class="dw-header">
                    <h2 id="dwTitle"></h2>
                    <p id="dwSubtitle"></p>
                </div>
                
                <div class="dw-grid">
                    <div class="dw-item"><div class="dw-badge rs">R</div> <span id="dwMouse"></span></div>
                    <div class="dw-item">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <div class="dw-badge" style="min-width: auto; padding: 4px 8px;">RB</div>
                            <span style="font-size:1.1rem; font-weight:bold; color:rgba(255,255,255,0.6);">+</span>
                            <div class="dw-badge rs">R</div>
                        </div>
                        <span id="dwScroll"></span>
                    </div>
                    <div class="dw-item"><div class="dw-badge" style="color:#c8c8c8;border-color:rgba(200,200,200,0.3);background:rgba(200,200,200,0.08);">RT</div> <span id="dwLClick"></span></div>
                    <div class="dw-item"><div class="dw-badge x">X</div> <span id="dwRClick"></span></div>
                    <div class="dw-item"><div class="dw-badge y">Y</div> <span id="dwVkb"></span></div>
                    <div class="dw-item"><div class="dw-badge b">B</div> <span id="dwBack"></span></div>
                    ${exitContentHtml}
                </div>

                <div class="dw-footer">
                    <button class="dw-checkbox" id="btnDwCheckbox" tabindex="-1">
                        <div class="dw-box"></div> <span id="dwDontShowAgain"></span>
                    </button>
                    <div class="dw-actions">
                        <button class="dw-btn dw-btn-cancel" id="btnDesktopWarningCancel" tabindex="-1"></button>
                        <button class="dw-btn dw-btn-confirm" id="btnDesktopWarningConfirm" tabindex="-1"></button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('dwTitle').textContent = _t('dwTitle', 'Modo Área de Trabalho');
        document.getElementById('dwSubtitle').textContent = _t('dwSubtitle', 'Seu controle assumirá temporariamente a função de mouse e teclado. Conheça os comandos:');
        document.getElementById('dwMouse').textContent = _t('dwBtnMouse', 'Mover Mouse');
        document.getElementById('dwScroll').textContent = _t('dwBtnScroll', 'Rolar a Tela (Scroll)');
        document.getElementById('dwLClick').textContent = _t('dwBtnLClick', 'Clique Esquerdo');
        document.getElementById('dwRClick').textContent = _t('dwBtnRClick', 'Clique Direito');
        document.getElementById('dwVkb').textContent = _t('dwBtnVkb', 'Teclado Virtual (Avulso)');
        document.getElementById('dwBack').textContent = _t('dwBtnBack', 'Voltar');

        if (context === 'settings') {
            document.getElementById('dwSettingsExit').textContent = _t('dwSettingsExit', 'Feche a janela de configuração ao finalizar para retornar ao Doorpi');
        } else {
            document.getElementById('dwExit').textContent = _t('dwBtnExit', 'Sair e retornar ao Doorpi');
        }

        document.getElementById('btnDesktopWarningCancel').textContent = _t('dwBtnCancel', 'Cancelar');
        document.getElementById('btnDesktopWarningConfirm').textContent = _t('dwBtnConfirm', 'Entendi e Continuar');
        document.getElementById('dwDontShowAgain').textContent = _t('dwDontShowAgain', 'Não mostrar novamente');

        const btnCheckbox = document.getElementById('btnDwCheckbox');
        const btnCancel = document.getElementById('btnDesktopWarningCancel');
        const btnConfirm = document.getElementById('btnDesktopWarningConfirm');

        let focusIdx = 2; // 0 = Checkbox, 1 = Cancelar, 2 = Confirmar
        let dontShowAgain = false;

        btnCheckbox.classList.remove('checked');

        const updateFocus = () => {
            btnCheckbox.classList.toggle('nav-focused-el', focusIdx === 0);
            btnCancel.classList.toggle('nav-focused-el', focusIdx === 1);
            btnConfirm.classList.toggle('nav-focused-el', focusIdx === 2);
        };
        updateFocus();

        const cleanup = () => {
            overlay.classList.remove('visible');
            window.isDesktopWarningOpen = false;
            window._dwMoveFocus = null;
            window._dwAction = null;
        };

        window._dwMoveFocus = (delta) => {
            focusIdx += delta;
            if (focusIdx < 0) focusIdx = 0;
            if (focusIdx > 2) focusIdx = 2;
            updateFocus();
        };

        window._dwAction = (action) => {
            if (action === 'CONFIRM') {
                if (focusIdx === 0) {
                    dontShowAgain = !dontShowAgain;
                    btnCheckbox.classList.toggle('checked', dontShowAgain);
                } else if (focusIdx === 1) {
                    cleanup();
                } else if (focusIdx === 2) {
                    if (dontShowAgain) localStorage.setItem('doorpi_skip_desktop_warning', 'true');
                    cleanup();
                    if (onConfirm) onConfirm();
                }
            } else if (action === 'CANCEL') {
                cleanup();
            }
        };

        btnCheckbox.onclick = () => { focusIdx = 0; updateFocus(); window._dwAction('CONFIRM'); };
        btnCancel.onclick = () => { focusIdx = 1; updateFocus(); window._dwAction('CONFIRM'); };
        btnConfirm.onclick = () => { focusIdx = 2; updateFocus(); window._dwAction('CONFIRM'); };

        btnCheckbox.onmouseenter = () => { focusIdx = 0; updateFocus(); };
        btnCancel.onmouseenter = () => { focusIdx = 1; updateFocus(); };
        btnConfirm.onmouseenter = () => { focusIdx = 2; updateFocus(); };

        window.isDesktopWarningOpen = true;
        requestAnimationFrame(() => overlay.classList.add('visible'));
    }
    window.showDesktopWarning = _showDesktopWarning;
    // ────────────────────────────────────────────────────────────────────────
    // ██████████████████  LAZY GRID LOADER  ██████████████████████████████████
    // ────────────────────────────────────────────────────────────────────────
