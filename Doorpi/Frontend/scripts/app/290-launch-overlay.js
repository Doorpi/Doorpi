    const GameLaunchOverlay = (() => {
        const overlay = document.getElementById('gameLaunchOverlay');
        const bg = document.getElementById('overlayBg');
        const artBox = document.getElementById('gameArtBox');
        const nameEl = document.getElementById('overlayGameName');
        const statusEl = document.getElementById('overlayStatusText');
        const contextEl = document.getElementById('overlayLaunchContext');
        const errTitle = document.getElementById('overlayErrorTitle');
        const errSub = document.getElementById('overlayErrorSub');

        // --- Injeção do Estilo Visual do Botão de Cancelar ---
        (function injectLaunchOverlayStyles() {
            const s = document.createElement('style');
            s.textContent = __doorpiCss("injected-styles/app/launch-overlay-1.css");
            document.head.appendChild(s);
        })();

        // --- Criação Dinâmica do botão de Cancelar ---
        let cancelBtn = document.getElementById('overlayCancelLaunchBtn');
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.id = 'overlayCancelLaunchBtn';
            cancelBtn.className = 'cancel-btn';
            cancelBtn.dataset.gamepadHint = 'confirm'; // Mapeia o ícone "Confirmar (A / Cross)" automaticamente
            cancelBtn.style.opacity = '0';
            cancelBtn.style.transition = 'opacity 0.4s ease';
            cancelBtn.style.display = 'none';
            cancelBtn.tabIndex = 0;

            cancelBtn.addEventListener('click', () => {
                postToHost({ action: 'cancelGameLaunch' });
            });

            const actionContainer = document.getElementById('launchActions') || statusEl?.parentElement;
            if (actionContainer) {
                actionContainer.appendChild(cancelBtn);
            }
        }

        let lockActions = document.getElementById('executionLockActions');
        if (!lockActions) {
            lockActions = document.createElement('div');
            lockActions.id = 'executionLockActions';
            lockActions.innerHTML = `
                <button id="executionLockRestore" class="lock-action" tabindex="0">${t('executionLockRestore')}</button>
                <button id="executionLockClose" class="lock-action danger" tabindex="0">${t('executionLockCloseProcess')}</button>
            `;

            const consumeGpuUpdaterReturnClick = event => {
                const isGpuUpdaterLock = window._lastExecutionLockData?.kind === 'gpuUpdater';
                if (!isGpuUpdaterLock || !event.isTrusted ||
                    Date.now() >= (window._gpuUpdaterPointerGuardUntil || 0)) return false;

                event.preventDefault();
                event.stopImmediatePropagation();
                return true;
            };

            lockActions.querySelector('#executionLockRestore')?.addEventListener('click', event => {
                if (consumeGpuUpdaterReturnClick(event)) return;
                postToHost({ action: 'restoreExecutionLock' });
            });
            lockActions.querySelector('#executionLockClose')?.addEventListener('click', event => {
                if (consumeGpuUpdaterReturnClick(event)) return;
                postToHost({ action: 'closeExecutionLock' });
            });

            const cardContainer = overlay?.querySelector('.overlay-card');
            if (cardContainer) {
                cardContainer.appendChild(lockActions);
            }
        }

        let sessionPair = document.getElementById('executionLockSessionPair');
        if (!sessionPair) {
            sessionPair = document.createElement('div');
            sessionPair.id = 'executionLockSessionPair';
            const insertAnchor = nameEl?.nextElementSibling;
            if (nameEl?.parentElement) {
                if (insertAnchor) {
                    nameEl.parentElement.insertBefore(sessionPair, insertAnchor);
                } else {
                    nameEl.parentElement.appendChild(sessionPair);
                }
            }
        }

        function clearSessionPair() {
            overlay.classList.remove('has-session-pair');
            if (sessionPair) {
                sessionPair.innerHTML = '';
                sessionPair.style.display = 'none';
            }
        }

        function appendSessionChip(container, role, visual) {
            const chip = document.createElement('div');
            chip.className = `pair-chip ${role}`;

            const thumb = document.createElement('div');
            thumb.className = 'pair-thumb';
            if (visual?.image) {
                thumb.style.backgroundImage = `url('${visual.image}')`;
            }

            const meta = document.createElement('div');
            meta.className = 'pair-meta';

            const roleEl = document.createElement('div');
            roleEl.className = 'pair-role';
            roleEl.textContent = role === 'game' ? t('pairRoleGame') : t('pairRoleStore');

            const name = document.createElement('div');
            name.className = 'pair-name';
            name.textContent = visual?.name || (role === 'game' ? t('genericGameName') : t('genericStoreName'));

            meta.appendChild(roleEl);
            meta.appendChild(name);
            chip.appendChild(thumb);
            chip.appendChild(meta);
            container.appendChild(chip);
        }

        function renderSessionPair(data = {}) {
            if (!sessionPair) return;
            const pair = _executionStoreGameVisualPair(data);
            if (!pair) {
                clearSessionPair();
                return;
            }

            sessionPair.innerHTML = '';
            appendSessionChip(sessionPair, 'store', pair.store);
            appendSessionChip(sessionPair, 'game', pair.game);
            sessionPair.style.display = 'flex';
            overlay.classList.add('has-session-pair');
        }

        let executionLockFocusTimerA = 0;
        let executionLockFocusTimerB = 0;
        function clearExecutionLockFocusTimers() {
            if (executionLockFocusTimerA) clearTimeout(executionLockFocusTimerA);
            if (executionLockFocusTimerB) clearTimeout(executionLockFocusTimerB);
            executionLockFocusTimerA = 0;
            executionLockFocusTimerB = 0;
        }

        // Resolvido a partir de strings.js
        const getI18n = () => ({
            opening: t('launchOpening'),
            waiting: t('launchWaiting'),
            waitingGame: t('launchWaitingGame') || t('launchWaiting'),
            waitingStore: t('launchWaitingStore') || t('launchWaiting'),
            waitingApp: t('launchWaitingApp') || t('launchWaiting'),
            running: t('launchRunning'),
            errTitle: t('launchErrTitle'),
            errCrash: t('launchErrCrash'),
            errTimeout: t('launchErrTimeout'),
            errGeneric: t('launchErrGeneric'),
            cancel: t('launchCancelBtn'),
            returningStore: t('launchReturningStore') || t('launchWaitingStore') || t('launchWaiting'),
            closingStore: t('launchClosingStore') || t('launchWaitingStore') || t('launchWaiting'),
            kindGame: t('launchKindGame'),
            kindApp: t('launchKindApp'),
            kindStore: t('launchKindStore'),
        });

        function setLaunchContext(kind = 'game') {
            const text = getI18n();
            const normalizedKind = kind === 'store' ? 'store' : (kind === 'app' ? 'app' : 'game');
            overlay.dataset.launchKind = normalizedKind;
            if (contextEl) {
                contextEl.textContent = normalizedKind === 'store'
                    ? text.kindStore
                    : (normalizedKind === 'app' ? text.kindApp : text.kindGame);
            }
        }

        function getWaitingText(text, launchKind) {
            if (launchKind === 'store') return text.waitingStore;
            if (launchKind === 'app') return text.waitingApp;
            return text.waitingGame || text.waiting;
        }

        function setState(state) {
            overlay.classList.remove('state-loading', 'state-running', 'state-error');
            overlay.classList.add('state-' + state);
        }

        function setArt(gridImage) {
            artBox.innerHTML = '';
            if (gridImage) {
                const img = document.createElement('img');
                img.src = gridImage;
                img.alt = '';
                img.onerror = () => setArtFallback();
                artBox.appendChild(img);
            } else {
                setArtFallback();
            }
        }

        function setArtFallback() {
            artBox.innerHTML = `
          <svg class="game-art-placeholder" viewBox="0 0 24 24" fill="none"
               xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="6" width="20" height="12" rx="3"
                  stroke="white" stroke-width="1.5"/>
            <path d="M7 12h4M9 10v4" stroke="white" stroke-width="1.5"
                  stroke-linecap="round"/>
            <circle cx="15" cy="12" r="0.75" fill="white"/>
            <circle cx="17" cy="10.5" r="0.75" fill="white"/>
            <circle cx="17" cy="13.5" r="0.75" fill="white"/>
          </svg>`;
        }

        function show(gameName, heroImage, gridImage, isRestore = false, launchKind = 'game') {
            const text = getI18n();
            const waitingText = getWaitingText(text, launchKind);
            nameEl.textContent = gameName || '';
            cancelBtn.innerHTML = `<span>${text.cancel}</span>`;

            // Nunca permitir mistura entre "aguardando janela" e "EM EXECUÇÃO".
            // Ao iniciar fluxo de launch/loading, sempre sai do modo execution-lock.
            hideExecutionLock();
            clearSessionPair();
            setLaunchContext(launchKind);

            if (bg) bg.style.backgroundImage = heroImage ? `url('${heroImage}')` : 'none';
            setArt(gridImage);
            setState('loading');

            overlay.style.pointerEvents = 'all';
            overlay.classList.add('visible');
            if (overlay._waitTimer) clearTimeout(overlay._waitTimer);

            if (isRestore) {
                statusEl.textContent = waitingText;
                cancelBtn.style.display = 'inline-flex';
                cancelBtn.style.opacity = '1';

                setTimeout(() => {
                    if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
                    cancelBtn.focus();
                }, 50);
            } else {
                // Fluxo normal (novo lançamento)
                statusEl.textContent = text.opening;
                cancelBtn.style.display = 'none';
                cancelBtn.style.opacity = '0';

                overlay._waitTimer = setTimeout(() => {
                    if (overlay.classList.contains('state-loading')) {
                        statusEl.textContent = waitingText;
                        cancelBtn.style.display = 'inline-flex';
                        setTimeout(() => {
                            cancelBtn.style.opacity = '1';
                            if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
                            cancelBtn.focus();
                        }, 50);
                    }
                }, 3500);
            }
        }

        function showStoreTransition(data = {}) {
            const text = getI18n();
            const mode = data.mode || 'returning';
            nameEl.textContent = data.name || '';

            hideExecutionLock();
            clearSessionPair();
            setLaunchContext('store');
            if (overlay._waitTimer) clearTimeout(overlay._waitTimer);

            if (bg) bg.style.backgroundImage = data.heroImage ? `url('${data.heroImage}')` : 'none';
            setArt(data.gridImage || '');
            setState('loading');

            statusEl.textContent = mode === 'closing' ? text.closingStore : text.returningStore;
            cancelBtn.style.display = 'none';
            cancelBtn.style.opacity = '0';
            overlay.style.pointerEvents = 'all';
            overlay.classList.add('visible', 'store-transition-visible');
        }

        function showGpuRestarting(data = {}) {
            if (overlay._waitTimer) {
                clearTimeout(overlay._waitTimer);
                overlay._waitTimer = 0;
            }
            clearExecutionLockFocusTimers();
            clearSessionPair();
            setLaunchContext('app');
            overlay.classList.remove('execution-lock-visible', 'store-transition-visible', 'store-install-lock');
            overlay.dataset.executionLockKey = '';

            nameEl.textContent = data.name || '';
            statusEl.textContent = t('gpuUpdaterRestarting');
            if (bg) bg.style.backgroundImage = data.imageUrl ? `url('${data.imageUrl}')` : 'none';
            setArt(data.imageUrl || '');
            setState('loading');

            cancelBtn.style.display = 'none';
            cancelBtn.style.opacity = '0';
            overlay.style.pointerEvents = 'all';
            overlay.style.zIndex = '30000';
            overlay.classList.add('visible');
        }

        function setRunning(message = '') {
            const text = getI18n();
            const el = document.getElementById('overlayRunningText');
            if (el) el.textContent = message || text.running;


            const cancelBtn = document.getElementById('overlayCancelLaunchBtn');
            if (cancelBtn) {
                cancelBtn.style.opacity = '0';
                setTimeout(() => { cancelBtn.style.display = 'none'; }, 300);
            }

            setState('running');
        }

        function setLaunchStatus(stage, message) {
            if (!overlay.classList.contains('visible')) return;
            if (overlay._waitTimer) {
                clearTimeout(overlay._waitTimer);
                overlay._waitTimer = 0;
            }

            if (stage === 'running') {
                setRunning(message);
                return;
            }

            setState('loading');
            statusEl.textContent = message || (stage === 'findingWindow' ? 'Procurando janela...' : getI18n().opening);
            cancelBtn.style.display = 'none';
            cancelBtn.style.opacity = '0';
        }

        function setError(gameName, reason) {
            const text = getI18n();
            if (overlay._waitTimer) clearTimeout(overlay._waitTimer);
            cancelBtn.style.display = 'none';
            overlay.classList.remove('execution-lock-visible');
            overlay.style.zIndex = '';
            clearSessionPair();

            errTitle.textContent = text.errTitle + (gameName ? ` "${gameName}"` : '');
            errSub.textContent = reason === 'crash' ? text.errCrash
                : reason === 'timeout' ? text.errTimeout
                    : text.errGeneric;
            setState('error');
            setTimeout(() => document.getElementById('overlayDismissBtn')?.focus(), 50);
        }

        function showExecutionLock(data = {}) {
            if (overlay._waitTimer) clearTimeout(overlay._waitTimer);
            const hasActionableTarget = !!(data.id || data.url);
            if (!hasActionableTarget) {
                return;
            }
            const fallbackName =
                data.kind === 'game' || data.channel === 'games' ? t('runningGameName') :
                    data.kind === 'storeInstall' || data.appType === 'storeInstall' ? t('storeInstallRunning') :
                    data.kind === 'store' || data.channel === 'stores' ? t('runningStoreName') :
                        t('runningSessionName');
            const name = data.name || data.gameName || fallbackName;
            const hasContext = name || data.id || data.url;
            if (!hasContext || Date.now() < (window._doorpiOfficialReturnSuppressUntil || 0)) {
                hide();
                return;
            }

            const isStoreInstallLock = data.kind === 'storeInstall' || data.appType === 'storeInstall';
            const isGpuUpdaterLock = data.kind === 'gpuUpdater' || data.appType === 'gpuUpdater';
            const executionKind = isStoreInstallLock || data.kind === 'store' || data.channel === 'stores'
                ? 'store'
                : (data.kind === 'game' || data.channel === 'games' ? 'game' : 'app');
            setLaunchContext(executionKind);
            const nextContextKey = `${data.kind || ''}|${data.channel || ''}|${data.id || ''}|${data.url || ''}`;
            const currentContextKey = overlay.dataset.executionLockKey || '';
            const isAlreadyVisible =
                overlay.classList.contains('visible') &&
                overlay.classList.contains('execution-lock-visible');
            const isSameContextVisible = isAlreadyVisible && currentContextKey === nextContextKey;
            const shouldPreserveFocus = isSameContextVisible;
            overlay.dataset.executionLockKey = nextContextKey;

            nameEl.textContent = name;
            statusEl.textContent = t('executionLockStatusRunning');
            overlay.classList.toggle('store-install-lock', isStoreInstallLock);
            overlay.classList.toggle('gpu-updater-lock', isGpuUpdaterLock);
            const closeAction = document.getElementById('executionLockClose');
            if (closeAction) {
                closeAction.textContent = isStoreInstallLock
                    ? t('executionLockCancelInstall')
                    : t('executionLockCloseProcess');
            }
            const restoreAction = document.getElementById('executionLockRestore');
            if (restoreAction) {
                restoreAction.textContent = isStoreInstallLock
                    ? t('executionLockReturnInstall')
                    : t('executionLockRestore');
            }
            if (bg && (data.heroImage || !isSameContextVisible)) {
                bg.style.backgroundImage = data.heroImage ? `url('${data.heroImage}')` : 'none';
            }
            if (data.gridImage || !isSameContextVisible) {
                setArt(data.gridImage);
            }
            setState('running');
            renderSessionPair(data);

            cancelBtn.style.display = 'none';
            cancelBtn.style.opacity = '0';
            overlay.style.pointerEvents = 'all';
            overlay.style.zIndex = '30000';
            overlay.classList.add('visible', 'execution-lock-visible');

            const focusPrimary = () => {
                const primary = document.getElementById('executionLockRestore');
                if (primary && primary.offsetWidth > 0 && primary.offsetHeight > 0) primary.focus();
            };
            const lockHasFocus = !!(lockActions && lockActions.contains(document.activeElement));
            clearExecutionLockFocusTimers();
            executionLockFocusTimerA = setTimeout(() => {
                if (typeof updateGamepadUI === 'function') updateGamepadUI(isGamepadConnected, _controllerType);
                if (!shouldPreserveFocus || !lockHasFocus) focusPrimary();
            }, 50);
            executionLockFocusTimerB = setTimeout(() => {
                if (!shouldPreserveFocus || !lockHasFocus) focusPrimary();
            }, 220);
        }

        function focusExecutionLockActions() {
            if (!overlay.classList.contains('visible') ||
                !overlay.classList.contains('execution-lock-visible')) return false;

            clearExecutionLockFocusTimers();
            const primary = document.getElementById('executionLockRestore');
            if (!primary || primary.offsetWidth <= 0 || primary.offsetHeight <= 0) return false;
            requestAnimationFrame(() => requestAnimationFrame(() => primary.focus()));
            return true;
        }

        function hideExecutionLock() {
            clearExecutionLockFocusTimers();
            overlay.classList.remove('execution-lock-visible');
            overlay.style.zIndex = '';
            overlay.classList.remove('store-install-lock');
            overlay.classList.remove('gpu-updater-lock');
            overlay.dataset.executionLockKey = '';
            clearSessionPair();
            lockActions?.querySelectorAll('button').forEach(btn => {
                if (document.activeElement === btn) btn.blur();
            });
        }

        function hide() {
            if (overlay._waitTimer) clearTimeout(overlay._waitTimer);
            clearExecutionLockFocusTimers();
            cancelBtn.style.opacity = '0';
            overlay.classList.remove('execution-lock-visible', 'store-transition-visible');
            overlay.style.zIndex = '';
            overlay.classList.remove('store-install-lock');
            overlay.classList.remove('gpu-updater-lock');
            overlay.dataset.executionLockKey = '';
            clearSessionPair();


            setTimeout(() => {
                cancelBtn.style.display = 'none';
                if (document.activeElement === cancelBtn) {
                    cancelBtn.blur();
                }
            }, 300);

            overlay.style.pointerEvents = 'none';
            overlay.style.backdropFilter = 'none';
            overlay.style.webkitBackdropFilter = 'none';
            overlay.classList.remove('visible');

            setTimeout(() => {
                overlay.style.backdropFilter = '';
                overlay.style.webkitBackdropFilter = '';
                setState('loading');
                nameEl.textContent = '';
                setArtFallback();
                if (bg) bg.style.backgroundImage = 'none';
            }, 400);
        }

        return { show, showStoreTransition, showGpuRestarting, setRunning, setLaunchStatus, setError, hide, showExecutionLock, focusExecutionLockActions, hideExecutionLock };
    })();


    setTimeout(() => {
        postToHost({ action: 'requestExtensionUpdates' });
    }, 1500);
