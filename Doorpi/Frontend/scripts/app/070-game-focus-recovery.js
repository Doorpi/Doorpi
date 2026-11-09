    function _ensureGameFocusFallbackOverlay() {
        if (_gameFocusFallbackOverlay) return _gameFocusFallbackOverlay;

        const style = document.createElement('style');
        style.textContent = __doorpiCss("injected-styles/app/game-focus-recovery-1.css");
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'gameFocusFallbackOverlay';
        overlay.innerHTML = `
            <div id="gameFocusFallbackCard" role="dialog" aria-modal="true" aria-label="Restauracao manual">
                <div id="gameFocusFallbackAccent" aria-hidden="true"></div>
                <div id="gameFocusFallbackBody">
                    <div id="gameFocusFallbackKicker">Foco da janela</div>
                    <div id="gameFocusFallbackCopy">
                        <h3 id="gameFocusFallbackTitle">Janela pronta</h3>
                        <p id="gameFocusFallbackMessage">A janela do jogo foi detectada, mas o Windows manteve o Doorpi em primeiro plano.</p>
                        <p id="gameFocusFallbackHint">Use o alternador do Windows para escolher a janela ativa.</p>
                    </div>
                    <div id="gameFocusFallbackActions">
                        <button id="gameFocusFallbackManual" class="fallback-action primary" type="button" tabindex="0">
                            <span class="action-text">Escolher janela</span>
                        </button>
                        <button id="gameFocusFallbackClose" class="fallback-action secondary" type="button" tabindex="0">
                            <span class="action-text">Encerrar</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#gameFocusFallbackManual')?.addEventListener('click', () => {
            const payload = _gameFocusFallbackPayload;
            if (payload?.mode === 'hung') {
                window.hideGameFocusFallbackPopup?.(false);
                postToHost({
                    action: 'closeRunningItem',
                    id: payload.id || '',
                    url: '',
                    channel: 'games',
                    appType: 'game'
                });
                return;
            }
            window.hideGameFocusFallbackPopup?.(false);
            postToHost({ action: 'manualGameWindowRestore' });
        });
        overlay.querySelector('#gameFocusFallbackClose')?.addEventListener('click', () => {
            const payload = _gameFocusFallbackPayload;
            if (payload?.mode === 'hung') {
                window.hideGameFocusFallbackPopup?.(true);
                return;
            }
            window.hideGameFocusFallbackPopup?.(true);
            postToHost({
                action: 'closeRunningItem',
                id: payload?.id || '',
                url: payload?.url || '',
                channel: payload?.channel || 'games',
                appType: payload?.appType || 'game'
            });
        });

        _gameFocusFallbackOverlay = overlay;
        return overlay;
    }

    window.isGameFocusFallbackPopupOpen = function () {
        return !!(_gameFocusFallbackOverlay && _gameFocusFallbackOverlay.classList.contains('visible'));
    };

    window.getGameFocusFallbackPopupItems = function () {
        if (!window.isGameFocusFallbackPopupOpen()) return [];
        return Array.from(_gameFocusFallbackOverlay.querySelectorAll('#gameFocusFallbackActions button'))
            .filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);
    };

    window.hideGameFocusFallbackPopup = function (restoreFocus = true) {
        if (!_gameFocusFallbackOverlay) return;
        _gameFocusFallbackOverlay.classList.remove('visible');
        _gameFocusFallbackPayload = null;
        if (restoreFocus) {
            const target = _gameFocusFallbackReturnFocusEl;
            _gameFocusFallbackReturnFocusEl = null;
            setTimeout(() => {
                if (target && document.contains(target) && typeof target.focus === 'function') {
                    target.focus();
                } else {
                    recoverGlobalFocus?.();
                }
            }, 0);
        } else {
            _gameFocusFallbackReturnFocusEl = null;
        }
    };

    window.showGameFocusFallbackPopup = function ({ id, name, mode = 'focus' } = {}) {
        const overlay = _ensureGameFocusFallbackOverlay();
        const wasVisible = overlay.classList.contains('visible');
        if (!wasVisible) _gameFocusFallbackReturnFocusEl = document.activeElement;

        const fallbackName = name || (typeof t === 'function' ? t('sessionConflictCurrent') : 'atual');
        const isHung = mode === 'hung';
        _gameFocusFallbackPayload = { id: id || '', channel: 'games', appType: 'game', mode };

        const kickerEl = overlay.querySelector('#gameFocusFallbackKicker');
        const titleEl = overlay.querySelector('#gameFocusFallbackTitle');
        const messageEl = overlay.querySelector('#gameFocusFallbackMessage');
        const hintEl = overlay.querySelector('#gameFocusFallbackHint');
        const manualBtn = overlay.querySelector('#gameFocusFallbackManual');
        const closeBtn = overlay.querySelector('#gameFocusFallbackClose');

        const title = isHung
            ? (typeof t === 'function' ? t('gameHungTitle') : 'O jogo não está respondendo')
            : (typeof t === 'function' ? t('gameFocusFallbackTitle') : 'Janela do jogo detectada');
        const message = (isHung
            ? (typeof t === 'function' ? t('gameHungMessage') : '{name} não está respondendo. Deseja encerrar o processo?')
            : (typeof t === 'function'
                ? t('gameFocusFallbackMessage')
                : 'A janela de {name} foi encontrada, mas o Windows manteve o Doorpi em primeiro plano. Deseja escolher a janela manualmente pelo alternador nativo?'))
            .replace('{name}', fallbackName);

        if (kickerEl) kickerEl.textContent = isHung
            ? (typeof t === 'function' ? t('gameHungKicker') : 'Processo não respondendo')
            : (typeof t === 'function' ? t('gameFocusFallbackKicker') : 'Foco da janela');
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        if (hintEl) hintEl.textContent = isHung
            ? (typeof t === 'function' ? t('gameHungHint') : 'Você pode continuar aguardando e tentar novamente depois.')
            : (typeof t === 'function' ? t('gameFocusFallbackHint') : 'Use o alternador do Windows para escolher a janela ativa.');
        if (manualBtn) {
            const textEl = manualBtn.querySelector('.action-text');
            if (textEl) textEl.textContent = isHung
                ? (typeof t === 'function' ? t('gameHungTerminate') : 'Encerrar jogo')
                : (typeof t === 'function' ? t('gameFocusFallbackManual') : 'Escolher janela');
        }
        if (closeBtn) {
            const textEl = closeBtn.querySelector('.action-text');
            if (textEl) textEl.textContent = isHung
                ? (typeof t === 'function' ? t('gameHungWait') : 'Continuar aguardando')
                : (typeof t === 'function' ? t('gameFocusFallbackClose') : 'Encerrar');
        }

        overlay.classList.add('visible');
        if (!wasVisible) {
            setTimeout(() => {
                manualBtn?.focus();
                if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
            }, 0);
        }
    };

    window._rememberLaunchedWebAppForConflict = function (item, launchId) {
        if (!item) return;
        const appType = (item.appType || '').toLowerCase();
        if (item.channel !== 'media' || (appType !== 'webview' && appType !== 'browser')) return;

        window._currentWebAppConflictEntry = {
            channel: 'media',
            kind: 'web',
            url: launchId || item.url || item.id || '',
            name: item.name || '',
            heroImage: item.hero || item.staticHero || '',
            gridImage: item.staticVertical || item.vertical || item.staticHorizontal || item.horizontal || ''
        };
    };

    function _syncWebAppConflictEntryFromRuntime() {
        const running = Array.isArray(window.DoorpiRuntimeState?.running) ? window.DoorpiRuntimeState.running : [];
        const webEntry = running.find(e => e && e.channel === 'media' && e.kind === 'web');
        if (webEntry) {
            window._currentWebAppConflictEntry = webEntry;
        } else {
            window._currentWebAppConflictEntry = null;
        }
    }

