    function _ensureSessionConflictOverlay() {
        if (_sessionConflictOverlay) return _sessionConflictOverlay;

        const style = document.createElement('style');
        style.textContent = __doorpiCss("injected-styles/app/session-conflicts-1.css");
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'sessionConflictOverlay';
        overlay.innerHTML = `
            <div id="sessionConflictCard" role="dialog" aria-modal="true" aria-label="${typeof t === 'function' ? t('sessionConflictAriaLabel') : 'Conflito de sessão'}">
                <div id="sessionConflictAccent" aria-hidden="true"></div>
                <div id="sessionConflictBody">
                    <div id="sessionConflictKicker">${typeof t === 'function' ? t('sessionConflictActiveKicker') : 'Sessão ativa'}</div>
                    <div id="sessionConflictCopy">
                        <h3 id="sessionConflictTitle">${typeof t === 'function' ? t('sessionConflictTitle') : 'Sessão em andamento'}</h3>
                        <p id="sessionConflictMessage">${typeof t === 'function' ? t('sessionConflictDefaultMessage') : 'Uma sessão já está ativa. Encerre a sessão atual para iniciar outra.'}</p>
                        <p id="sessionConflictHint">${typeof t === 'function' ? t('sessionConflictHint') : 'O Doorpi mantém uma sessão por vez para evitar sobreposição de janelas.'}</p>
                    </div>
                    <div id="sessionConflictActions">
                        <button id="sessionConflictClose" class="conflict-action primary" type="button" tabindex="0">
                            <span class="action-text">${typeof t === 'function' ? t('sessionConflictClose') : 'Encerrar'}</span>
                        </button>
                        <button id="sessionConflictCancel" class="conflict-action secondary" type="button" tabindex="0">
                            <span class="action-text">${typeof t === 'function' ? t('sessionConflictCancel') : 'Cancelar'}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector('#sessionConflictCancel');
        const closeBtn = overlay.querySelector('#sessionConflictClose');

        const movePopupFocus = (direction) => {
            const items = window.getSessionConflictPopupItems?.() || [];
            if (!items.length) return false;

            const currentIndex = items.indexOf(document.activeElement);
            const step = direction === 'RIGHT' || direction === 'DOWN' ? 1 : -1;
            const nextIndex = currentIndex < 0
                ? 0
                : (currentIndex + step + items.length) % items.length;
            items[nextIndex]?.focus();
            return true;
        };

        window.moveSessionConflictPopupFocus = movePopupFocus;
        window.cancelSessionConflictPopup = function () {
            if (!window.isSessionConflictPopupOpen?.()) return false;
            cancelBtn?.click();
            return true;
        };
        window.activateSessionConflictPopup = function () {
            if (!window.isSessionConflictPopupOpen?.()) return false;
            const active = document.activeElement;
            if (active && overlay.contains(active) && typeof active.click === 'function') active.click();
            else closeBtn?.click();
            return true;
        };

        document.addEventListener('focusin', (event) => {
            if (!overlay.classList.contains('visible') || overlay.contains(event.target)) return;
            event.stopImmediatePropagation();
            queueMicrotask(() => closeBtn?.focus());
        }, true);

        cancelBtn?.addEventListener('click', () => {
            window.hideSessionConflictPopup?.(true);
        });
        closeBtn?.addEventListener('click', () => {
            const payload = _sessionConflictClosePayload;
            window.hideSessionConflictPopup?.(true);
            if (payload) {
                if (payload.action === 'closeAllSessionsForStoreDownload') {
                    postToHost({
                        action: 'closeAllSessionsForStoreDownload',
                        storeId: payload.storeId || '',
                        url: payload.url || '',
                        name: payload.name || ''
                    });
                    return;
                }
                if (payload.action === 'closeAllSessionsForGpuUpdater') {
                    postToHost({
                        action: 'closeAllSessionsForGpuUpdater',
                        updaterId: payload.updaterId || ''
                    });
                    return;
                }

                postToHost({
                    action: 'closeRunningItem',
                    id: payload.id || '',
                    url: payload.url || '',
                    channel: payload.channel || '',
                    appType: payload.appType || ''
                });
            }
        });

        _sessionConflictOverlay = overlay;
        return overlay;
    }

    window.isSessionConflictPopupOpen = function () {
        return !!(_sessionConflictOverlay && _sessionConflictOverlay.classList.contains('visible'));
    };

    window.getSessionConflictPopupItems = function () {
        if (!window.isSessionConflictPopupOpen()) return [];
        return Array.from(_sessionConflictOverlay.querySelectorAll('#sessionConflictActions button'))
            .filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);
    };

    window.hideSessionConflictPopup = function (restoreFocus = true) {
        if (!_sessionConflictOverlay) return;
        _sessionConflictOverlay.classList.remove('visible');
        _sessionConflictClosePayload = null;
        if (restoreFocus) {
            const target = _sessionConflictReturnFocusEl;
            _sessionConflictReturnFocusEl = null;
            setTimeout(() => {
                if (target && document.contains(target) && typeof target.focus === 'function') {
                    target.focus();
                } else {
                    recoverGlobalFocus?.();
                }
            }, 0);
        } else {
            _sessionConflictReturnFocusEl = null;
        }
    };

    window.showSessionConflictPopup = function ({
        closePayload,
        runningName,
        title,
        message,
        hint,
        kicker,
        confirmText,
        cancelText
    } = {}) {
        const overlay = _ensureSessionConflictOverlay();
        const wasVisible = overlay.classList.contains('visible');
        _sessionConflictClosePayload = closePayload || null;
        if (!wasVisible) {
            _sessionConflictReturnFocusEl = document.activeElement;
        }

        const kickerEl = overlay.querySelector('#sessionConflictKicker');
        const titleEl = overlay.querySelector('#sessionConflictTitle');
        const messageEl = overlay.querySelector('#sessionConflictMessage');
        const hintEl = overlay.querySelector('#sessionConflictHint');
        const cancelBtn = overlay.querySelector('#sessionConflictCancel');
        const closeBtn = overlay.querySelector('#sessionConflictClose');

        const titleText = title || (typeof t === 'function' ? t('sessionConflictTitle') : 'Processo/Jogo em andamento');
        const fallbackName = typeof t === 'function' ? t('sessionConflictCurrent') : 'atual';
        const baseMessage = message || (typeof t === 'function' ? t('sessionConflictMessage') : 'Deseja encerrar o processo/jogo {name}?');
        const resolvedName = runningName || fallbackName;
        const messageText = baseMessage.replace('{name}', resolvedName);

        if (kickerEl) kickerEl.textContent = typeof t === 'function' ? t('sessionConflictKicker') : 'Sessão ativa';
        if (titleEl) titleEl.textContent = titleText;
        if (messageEl) messageEl.textContent = messageText;
        if (hintEl) hintEl.textContent = typeof t === 'function' ? t('sessionConflictHint') : 'O Doorpi mantém uma sessão por vez para evitar sobreposição de janelas.';
        if (cancelBtn) {
            const textEl = cancelBtn.querySelector('.action-text');
            if (textEl) textEl.textContent = typeof t === 'function' ? t('sessionConflictCancel') : 'Cancelar';
        }
        if (closeBtn) {
            const textEl = closeBtn.querySelector('.action-text');
            if (textEl) textEl.textContent = typeof t === 'function' ? t('sessionConflictClose') : 'Encerrar';
        }

        if (kickerEl && kicker) kickerEl.textContent = kicker;
        if (hintEl && hint) hintEl.textContent = hint;
        if (cancelBtn && cancelText) {
            const textEl = cancelBtn.querySelector('.action-text');
            if (textEl) textEl.textContent = cancelText;
        }
        if (closeBtn && confirmText) {
            const textEl = closeBtn.querySelector('.action-text');
            if (textEl) textEl.textContent = confirmText;
        }

        overlay.classList.add('visible');
        if (!wasVisible) {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                closeBtn?.focus();
                if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
            }));
        }
    };

    window.hasStoreDownloadBlockingRuntime = function () {
        const entries = Array.isArray(window.DoorpiRuntimeState?.running) ? window.DoorpiRuntimeState.running : [];
        return entries.some(entry =>
            entry &&
            entry.kind !== 'storeInstall' &&
            entry.appType !== 'storeInstall'
        );
    };

    window.showStoreDownloadSessionConflict = function ({ storeId, url, name } = {}) {
        window.showSessionConflictPopup?.({
            closePayload: {
                action: 'closeAllSessionsForStoreDownload',
                storeId: storeId || '',
                url: url || '',
                name: name || ''
            },
            kicker: typeof t === 'function' ? t('storeDownloadConflictKicker', 'Loja em uso') : 'Loja em uso',
            title: typeof t === 'function' ? t('storeDownloadConflictTitle', 'Feche as tarefas abertas') : 'Feche as tarefas abertas',
            message: typeof t === 'function'
                ? t('storeDownloadConflictMessage', 'Para instalar uma loja, o Doorpi precisa encerrar jogos, apps e lojas em execução.')
                : 'Para instalar uma loja, o Doorpi precisa encerrar jogos, apps e lojas em execução.',
            hint: typeof t === 'function'
                ? t('storeDownloadConflictHint', 'Escolha encerrar tudo agora ou cancele para voltar.')
                : 'Escolha encerrar tudo agora ou cancele para voltar.',
            confirmText: typeof t === 'function' ? t('storeDownloadConflictCloseAll', 'Encerrar processos') : 'Encerrar processos',
            cancelText: typeof t === 'function' ? t('sessionConflictCancel') : 'Cancelar'
        });
    };

    window.showGpuUpdaterSessionConflict = function ({ updaterId, name } = {}) {
        window.showSessionConflictPopup?.({
            closePayload: {
                action: 'closeAllSessionsForGpuUpdater',
                updaterId: updaterId || ''
            },
            kicker: t('gpuUpdaterConflictKicker'),
            title: t('gpuUpdaterConflictTitle'),
            message: t('gpuUpdaterConflictMessage'),
            hint: t('gpuUpdaterConflictHint'),
            confirmText: t('gpuUpdaterConflictCloseAll'),
            cancelText: t('sessionConflictCancel'),
            runningName: name || ''
        });
    };

    window._handleSessionConflictFromLaunch = function (item, launchId) {
        const entry = _findSessionConflictEntry(item, launchId);
        if (!entry) return false;
        window.showSessionConflictPopup?.({
            closePayload: _buildClosePayloadFromRuntimeEntry(entry),
            runningName: _resolveRuntimeEntryName(entry)
        });
        return true;
    };

    let _gameFocusFallbackOverlay = null;
    let _gameFocusFallbackPayload = null;
    let _gameFocusFallbackReturnFocusEl = null;

