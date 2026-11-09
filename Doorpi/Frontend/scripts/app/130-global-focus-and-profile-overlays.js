    function recoverGlobalFocus() {
        const executionOverlay = document.getElementById('gameLaunchOverlay');
        if (executionOverlay?.classList.contains('visible') &&
            executionOverlay.classList.contains('execution-lock-visible')) {
            GameLaunchOverlay.focusExecutionLockActions?.();
            return;
        }
        const userPicker = document.getElementById('doorpiUserPicker');
        if (userPicker?.style.display !== 'none' &&
            document.body.classList.contains('user-picker-open') &&
            typeof userPicker._doorpiFocusInitialCard === 'function') {
            userPicker._doorpiFocusInitialCard('auto');
            return;
        }
        // 1. Prioridade: Se tem um Modal de Adicionar aberto, foca nos botões dele
        if (window.isModalOpen) {
            const btn = document.querySelector('#btnAddWebApp') || document.querySelector('#btnConfirmAdd') || document.querySelector('#btnConfirmAddMedia');
            if (btn && btn.style.display !== 'none') { btn.focus(); return; }
        }

        // 2. Prioridade: Se o usuário estiver na tela principal (jogos, mídia ou lojas)
        const currentTab = (typeof window.getCurrentHomeTab === 'function') ? window.getCurrentHomeTab() : 'games';
        const gridId = typeof window.getHomeGridId === 'function'
            ? window.getHomeGridId(currentTab)
            : (currentTab === 'media' ? 'mediaGrid' : 'gameGrid');
        const grid = document.getElementById(gridId);

        if (grid) {
            window.syncFeaturedCardArt?.(grid);
            const target = grid.querySelector('.card.featured')
                || grid.querySelector('.store-card')
                || grid.querySelector('.card:not(.add-card)')
                || grid.querySelector('.card.add-card');
            if (target) {
                target.focus();
                return;
            }
        }

        // 3. Fallback: Qualquer coisa clicável na tela
        const fallback = document.querySelector('button, [tabindex="0"]');
        if (fallback) fallback.focus();
    }
    function scheduleDoorpiFocusRecovery() {
        const delays = [0, 80, 220, 520];
        delays.forEach(delay => {
            setTimeout(() => {
                if (window._vkbIsOpen) return;
                if (window.isMediaAppActive || window.isGameLaunchActive) return;
                const active = document.activeElement;
                const hasUsefulFocus = active &&
                    active !== document.body &&
                    active !== document.documentElement &&
                    typeof active.focus === 'function' &&
                    active.offsetParent !== null;
                if (!hasUsefulFocus) recoverGlobalFocus();
            }, delay);
        });
    }
    function postToHost(payload) {

        // Lista de ações que cortam o som na hora (excluídos 'launch' e 'launchMediaApp')
        const muteActions = [
            'enterDesktopMode',
            'openTaskbarSettings',
            'openSignInOptions',
            'suspendSystem',
            'shutdownSystem',
            'restartSystem'
        ];

        if (payload && muteActions.includes(payload.action)) {
            window._stopSystemAudio();
        }

        window.chrome?.webview?.postMessage(JSON.stringify(payload));
    }

    requestAnimationFrame(() => postToHost({ action: 'requestDisplaySettings' }));

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[ch]));
    }

    function ensureDoorpiOverlayStyles() {
        if (document.getElementById('doorpiOverlayStyles')) return;
        const s = document.createElement('style');
        s.id = 'doorpiOverlayStyles';
        s.textContent = __doorpiCss("injected-styles/app/doorpi-overlay-styles.css");
        document.head.appendChild(s);

        const isVisible = (el) => !!(el && el.style.display !== 'none' && el.offsetWidth > 0 && el.offsetHeight > 0);
        window.isDoorpiQuickMenuBlocked = function () {
            const body = document.body;
            const quickPanel = document.getElementById('doorpiQuickPanel');
            const quickPanelOpen = quickPanel?.classList.contains('visible') && isVisible(quickPanel);
            if (quickPanelOpen) return false;

            if (window.isDoorpiSessionTransitionActive?.() || window.DoorpiIntro?.isRunning?.()) return true;
            if (window.isNavMenuOpen || body.classList.contains('nav-menu-active')) return true;
            if (window.isModalOpen || window.isSetupOpen || window._vkbIsOpen || window.isGlobalLoading) return true;
            if (typeof isCtxMenuOpen !== 'undefined' && isCtxMenuOpen) return true;
            if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) return true;
            if (window.isStoreSessionMenuOpen?.() || window.isGameFocusFallbackPopupOpen?.()) return true;

            const blockingSelectors = [
                '#addGameContainer',
                '#sessionConflictOverlay.visible',
                '#gameFocusFallbackOverlay.visible',
                '#doorpiUserSwitchLogout.visible',
                '#gameLaunchOverlay.visible',
                '#gameLaunchOverlay.execution-lock-visible',
                '.doorpi-update-prompt.is-visible',
                '.doorpi-pin-panel',
                '.edit-modal-overlay',
                '#globalLoadingOverlay'
            ];
            if (blockingSelectors.some(selector => Array.from(document.querySelectorAll(selector)).some(isVisible))) return true;

            return Array.from(document.querySelectorAll('.doorpi-user-overlay, .doorpi-manager-overlay'))
                .some(el => el.id !== 'doorpiQuickPanel' && isVisible(el));
        };

        let quickMenuVisibilityRaf = 0;
        window.updateDoorpiQuickMenuAvailability = function () {
            if (quickMenuVisibilityRaf) return;
            quickMenuVisibilityRaf = requestAnimationFrame(() => {
                quickMenuVisibilityRaf = 0;
                document.body.classList.toggle('quick-menu-unavailable', !!window.isDoorpiQuickMenuBlocked?.());
            });
        };
        new MutationObserver(() => window.updateDoorpiQuickMenuAvailability?.())
            .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
        document.addEventListener('focusin', () => window.updateDoorpiQuickMenuAvailability?.());
        window.updateDoorpiQuickMenuAvailability();
    }

    function renderDoorpiChoice(id, options, value, disabled = false) {
        const safeOptions = Array.isArray(options) && options.length
            ? options
            : [{ value: '', label: t('noOptionsAvailable') }];
        const selected = safeOptions.find(opt => String(opt.value) === String(value)) || safeOptions[0];
        return `
            <div class="doorpi-choice-wrap${disabled ? ' is-disabled' : ''}" id="${escapeHtml(id)}" data-value="${escapeHtml(selected.value)}" data-disabled="${disabled ? 'true' : 'false'}">
                <button class="doorpi-choice-trigger" type="button" tabindex="0" aria-haspopup="listbox" aria-expanded="false">
                    <span>${escapeHtml(selected.label)}</span>
                </button>
                <div class="doorpi-choice-menu" role="listbox">
                    ${safeOptions.map(opt => `
                        <button class="doorpi-choice-option${String(opt.value) === String(selected.value) ? ' is-selected' : ''}" type="button" tabindex="0" data-value="${escapeHtml(opt.value)}" role="option">
                            ${escapeHtml(opt.label)}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function bindDoorpiChoice(root, onChange) {
        if (!root) return;
        const trigger = root.querySelector('.doorpi-choice-trigger');
        const options = Array.from(root.querySelectorAll('.doorpi-choice-option'));
        const setOpen = (open) => {
            if (root.dataset.disabled === 'true') return;
            root.classList.toggle('is-open', open);
            trigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) {
                const selected = root.querySelector('.doorpi-choice-option.is-selected') || options[0];
                selected?.focus({ preventScroll: true });
            }
        };
        trigger?.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
        options.forEach(option => {
            option.addEventListener('click', () => {
                const value = option.dataset.value || '';
                const label = option.textContent.trim();
                root.dataset.value = value;
                trigger.querySelector('span').textContent = label;
                options.forEach(opt => opt.classList.toggle('is-selected', opt === option));
                setOpen(false);
                trigger.focus({ preventScroll: true });
                onChange?.(value);
            });
        });
    }

    function setDoorpiChoiceDisabled(id, disabled) {
        const root = document.getElementById(id);
        if (!root) return;
        root.dataset.disabled = disabled ? 'true' : 'false';
        root.classList.toggle('is-disabled', disabled);
        root.classList.remove('is-open');
        root.querySelector('.doorpi-choice-trigger')?.setAttribute('aria-expanded', 'false');
    }

    function getDoorpiChoiceValue(id) {
        return document.getElementById(id)?.dataset.value || '';
    }

    function avatarMarkup(user) {
        return `<div class="doorpi-avatar">${user.PhotoBase64 ? `<img src="${_normalizeUserPhotoSrc(user.PhotoBase64)}" />` : `<svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`}</div>`;
    }

    function closeUserPinPrompt(options = {}) {
        window._vkbForceClose?.({
            restoreFocus: options.restoreFocus !== false,
            immediate: options.immediate === true
        });
        const prompt = document.getElementById('doorpiUserPinPrompt');
        prompt?._doorpiCleanup?.();
        prompt?.remove();
    }

    function updateUserPinDots(prompt, value, markError = false) {
        const len = String(value || '').length;
        const focusIdx = Math.min(3, len);
        prompt?.querySelectorAll('.doorpi-pin-dot').forEach((dot, idx) => {
            dot.classList.toggle('filled', idx < len);
            dot.classList.toggle('focused', idx === focusIdx);
            dot.classList.toggle('error', !!markError && idx < Math.max(1, len));
        });
    }

    function setUserPinError(message, countAttempt = false) {
        const prompt = document.getElementById('doorpiUserPinPrompt');
        if (!prompt) return false;
        prompt.dataset.submitting = 'false';
        prompt.classList.remove('pin-error');
        void prompt.offsetWidth;
        prompt.classList.add('pin-error');
        window._pendingUserSwitchId = '';
        let shouldRevealRecovery = false;
        if (countAttempt) {
            const attempts = Number(prompt.dataset.failedAttempts || '0') + 1;
            prompt.dataset.failedAttempts = String(attempts);
            const recoveryBtn = prompt.querySelector('#doorpiUserPinRecovery');
            if (recoveryBtn && attempts >= 3) recoveryBtn.hidden = false;
            shouldRevealRecovery = attempts === 3 && !!recoveryBtn;
        }
        const error = prompt.querySelector('#doorpiUserPinError');
        const input = prompt.querySelector('#doorpiUserPinInput');
        if (error) error.textContent = message || '';
        if (input) {
            const failedPin = String(input.value || '').replace(/\D/g, '').slice(0, 4);
            updateUserPinDots(prompt, failedPin, true);
            input.value = '';
            if (shouldRevealRecovery) {
                window._vkbForceClose?.();
                setTimeout(() => prompt.querySelector('#doorpiUserPinRecovery')?.focus(), 380);
            } else {
                setTimeout(() => {
                    input.focus();
                    window._vkbOpen?.(input, input._doorpiPinCallbacks || { mode: 'numeric' });
                }, window._vkbIsOpen ? 0 : 380);
            }
        }
        setTimeout(() => {
            prompt.classList.remove('pin-error');
            updateUserPinDots(prompt, '');
        }, 360);
        return true;
    }

    function setUserPinRecoveryError(message) {
        const prompt = document.getElementById('doorpiUserPinPrompt');
        if (!prompt) return false;
        prompt.dataset.submitting = 'false';
        window._pendingUserSwitchId = '';
        const error = prompt.querySelector('#doorpiUserPinError');
        if (error) error.textContent = message || t('pinRecoveryFailed');
        const focused = prompt.querySelector('.doorpi-pin-recovery-input:not([hidden]), #doorpiUserPinDots:not([hidden])');
        setTimeout(() => focused?.focus?.(), 80);
        return true;
    }

    function showUserPinPrompt(user) {
        closeUserPinPrompt();
        const prompt = document.createElement('div');
        prompt.id = 'doorpiUserPinPrompt';
        prompt.className = 'doorpi-pin-panel';
        prompt.dataset.mode = 'pin';
        prompt.dataset.failedAttempts = '0';
        const fallbackPinAvatar = `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8.2" r="3.6" stroke="currentColor" stroke-width="1.8"/>
                <path d="M5.8 19.2c1-3.2 3.2-5 6.2-5s5.2 1.8 6.2 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>`;
        const pinAvatar = user.PhotoBase64
            ? `<img src="${_normalizeUserPhotoSrc(user.PhotoBase64)}" />`
            : fallbackPinAvatar;
        prompt.innerHTML = `
            <div class="doorpi-pin-box">
                <div class="doorpi-pin-identity">
                    <div class="doorpi-pin-avatar">${pinAvatar}</div>
                    <h3 class="doorpi-pin-title">${escapeHtml(user.Name || '')}</h3>
                    <p class="doorpi-pin-sub">${t('pinPromptTitle')}</p>
                </div>
                <button class="doorpi-pin-dots" id="doorpiUserPinDots" type="button" tabindex="0" aria-label="${escapeHtml(t('pinPromptTitle'))}">
                    <span class="doorpi-pin-dot"></span>
                    <span class="doorpi-pin-dot"></span>
                    <span class="doorpi-pin-dot"></span>
                    <span class="doorpi-pin-dot"></span>
                </button>
                <input class="doorpi-pin-input" id="doorpiUserPinInput" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" readonly tabindex="0" />
                <input class="doorpi-pin-recovery-input" id="doorpiPinRecoveryNameInput" type="text" readonly tabindex="0" hidden />
                <button class="doorpi-pin-recovery-link" id="doorpiUserPinRecovery" tabindex="0" hidden>${t('pinRecoveryForgot')}</button>
                <div class="doorpi-pin-error" id="doorpiUserPinError"></div>
                <div class="doorpi-pin-actions">
                    <button class="doorpi-manager-btn" id="doorpiUserPinCancel" tabindex="0">${t('vkbCancel')}</button>
                    <button class="doorpi-manager-btn primary" id="doorpiUserPinOk" tabindex="0">${t('vkbOk')}</button>
                </div>
            </div>`;
        document.body.appendChild(prompt);

        const input = prompt.querySelector('#doorpiUserPinInput');
        const dotsBtn = prompt.querySelector('#doorpiUserPinDots');
        const recoveryInput = prompt.querySelector('#doorpiPinRecoveryNameInput');
        const recoveryBtn = prompt.querySelector('#doorpiUserPinRecovery');
        const subtitle = prompt.querySelector('.doorpi-pin-sub');
        const errorEl = prompt.querySelector('#doorpiUserPinError');
        const actions = prompt.querySelector('.doorpi-pin-actions');
        const placeRecoveryHelpAboveInput = () => {
            if (errorEl && recoveryInput?.parentNode) recoveryInput.parentNode.insertBefore(errorEl, recoveryInput);
        };
        const placeRecoveryHelpDefault = () => {
            if (errorEl && actions?.parentNode) actions.parentNode.insertBefore(errorEl, actions);
        };
        let recoveryUserName = '';

        const pinDigits = () => String(input.value || '').replace(/\D/g, '').slice(0, 4);
        const setError = (message) => {
            if (errorEl) errorEl.textContent = message || '';
        };
        const bindActions = (secondaryText, secondaryAction, primaryText, primaryAction) => {
            actions.innerHTML = `
                <button class="doorpi-manager-btn" id="doorpiPinSecondary" tabindex="0">${secondaryText}</button>
                <button class="doorpi-manager-btn primary" id="doorpiPinPrimary" tabindex="0">${primaryText}</button>
            `;
            actions.querySelector('#doorpiPinSecondary')?.addEventListener('click', secondaryAction);
            actions.querySelector('#doorpiPinPrimary')?.addEventListener('click', primaryAction);
        };
        const submit = () => {
            if (prompt.dataset.mode !== 'pin') return;
            if (prompt.dataset.submitting === 'true') return;
            const pin = pinDigits();
            if (pin.length < 4) {
                setUserPinError(t('pinPromptEmpty'));
                return;
            }
            prompt.dataset.submitting = 'true';
            window._pendingUserSwitchId = user.Id;
            input._doorpiVkbReturnFocus = null;
            window._vkbForceClose?.();
            postToHost({ action: 'selectUser', userId: user.Id, pin });
        };
        const cancel = () => {
            closeUserPinPrompt();
            Array.from(document.querySelectorAll('.doorpi-user-card[data-user-id]'))
                .find(card => String(card.dataset.userId) === String(user.Id))
                ?.focus();
        };

        const showPinEntry = () => {
            prompt.dataset.mode = 'pin';
            prompt.dataset.submitting = 'false';
            placeRecoveryHelpDefault();
            subtitle.textContent = t('pinPromptTitle');
            setError('');
            input.value = '';
            recoveryInput.hidden = true;
            recoveryInput.value = '';
            dotsBtn.hidden = false;
            recoveryBtn.hidden = Number(prompt.dataset.failedAttempts || '0') < 3;
            bindActions(t('vkbCancel'), cancel, t('vkbOk'), submit);
            updateUserPinDots(prompt, '');
            dotsBtn.focus();
        };

        const showRecoveryNewPin = () => {
            prompt.dataset.mode = 'recoveryPin';
            prompt.dataset.submitting = 'false';
            placeRecoveryHelpDefault();
            subtitle.textContent = t('pinRecoveryNewPinTitle');
            setError(t('pinRecoveryNewPinHint'));
            input.value = '';
            recoveryInput.hidden = true;
            dotsBtn.hidden = false;
            recoveryBtn.hidden = true;
            bindActions(t('vkbCancel'), cancel, t('pinRecoverySave'), submitRecoveryPin);
            updateUserPinDots(prompt, '');
            setTimeout(() => openPinKeyboard(), 80);
        };

        const submitRecoveryName = () => {
            const typedName = recoveryInput.value || '';
            if (typedName !== (user.Name || '')) {
                setError(t('pinRecoveryNameMismatch'));
                recoveryInput.focus();
                return;
            }
            recoveryUserName = typedName;
            window._vkbForceClose?.();
            showRecoveryNewPin();
        };

        const showRecoveryName = () => {
            prompt.dataset.mode = 'recoveryName';
            prompt.dataset.submitting = 'false';
            placeRecoveryHelpAboveInput();
            subtitle.textContent = t('pinRecoveryNameTitle');
            setError(t('pinRecoveryNameHint'));
            input.value = '';
            recoveryInput.value = '';
            recoveryInput.placeholder = t('pinRecoveryNamePlaceholder');
            recoveryInput.hidden = false;
            recoveryBtn.hidden = true;
            dotsBtn.hidden = true;
            bindActions(t('vkbCancel'), cancel, t('vkbOk'), submitRecoveryName);
            recoveryInput._doorpiVkbReturnFocus = null;
            recoveryInput._doorpiRecoveryCallbacks = {
                placement: 'below',
                keepOpenOnEnter: true,
                onEnter: submitRecoveryName,
                onOk: submitRecoveryName,
                onCancel: cancel
            };
            recoveryInput._doorpiVkbCallbacks = recoveryInput._doorpiRecoveryCallbacks;
            setTimeout(() => {
                recoveryInput.removeAttribute('readonly');
                recoveryInput.focus();
                window._vkbOpen?.(recoveryInput, recoveryInput._doorpiRecoveryCallbacks);
            }, 80);
        };

        function submitRecoveryPin() {
            if (prompt.dataset.mode !== 'recoveryPin') return;
            if (prompt.dataset.submitting === 'true') return;
            const pin = pinDigits();
            if (pin.length < 4) {
                setError(t('pinRecoveryPinTooShort'));
                setTimeout(() => openPinKeyboard(), 120);
                return;
            }
            prompt.dataset.submitting = 'true';
            window._pendingUserSwitchId = user.Id;
            window._vkbForceClose?.();
            postToHost({ action: 'recoverUserPin', userId: user.Id, userName: recoveryUserName, pin });
        }

        const showRecoveryConfirm = () => {
            prompt.dataset.mode = 'recoveryConfirm';
            prompt.dataset.submitting = 'false';
            placeRecoveryHelpDefault();
            window._vkbForceClose?.();
            subtitle.textContent = t('pinRecoveryConfirmTitle');
            setError(t('pinRecoveryConfirmBody'));
            input.value = '';
            recoveryInput.hidden = true;
            recoveryBtn.hidden = true;
            dotsBtn.hidden = true;
            bindActions(t('vkbCancel'), showPinEntry, t('pinRecoveryConfirmYes'), showRecoveryName);
            actions.querySelector('#doorpiPinPrimary')?.focus();
        };

        input._doorpiPinCallbacks = {
            mode: 'numeric',
            allowProgrammatic: true,
            onOk: () => prompt.dataset.mode === 'recoveryPin' ? submitRecoveryPin() : submit(),
            onCancel: cancel
        };
        const openPinKeyboard = (event) => {
            if (event && !window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            if (prompt.dataset.submitting === 'true') return;
            if (prompt.dataset.mode !== 'pin' && prompt.dataset.mode !== 'recoveryPin') return;
            input.focus();
            input._doorpiVkbReturnFocus = dotsBtn;
            window._vkbOpen?.(input, input._doorpiPinCallbacks);
        };
        bindActions(t('vkbCancel'), cancel, t('vkbOk'), submit);
        recoveryBtn?.addEventListener('click', showRecoveryConfirm);
        recoveryInput?.addEventListener('click', event => {
            if (event && !window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            if (prompt.dataset.mode !== 'recoveryName') return;
            recoveryInput.removeAttribute('readonly');
            recoveryInput.focus();
            window._vkbOpen?.(recoveryInput, recoveryInput._doorpiRecoveryCallbacks);
        });
        dotsBtn?.addEventListener('click', openPinKeyboard);
        dotsBtn?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openPinKeyboard();
            }
        });
        input.addEventListener('input', () => {
            const digits = String(input.value || '').replace(/\D/g, '').slice(0, 4);
            if (input.value !== digits) input.value = digits;
            updateUserPinDots(prompt, digits);
            if (digits.length === 4) {
                if (prompt.dataset.mode === 'recoveryPin') submitRecoveryPin();
                else submit();
            }
        });
        recoveryInput.addEventListener('input', () => setError(''));
        recoveryInput.addEventListener('keydown', (e) => {
            if (prompt.dataset.mode !== 'recoveryName') return;
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                submitRecoveryName();
            }
        });
        const recoveryVkbEnterHandler = (event) => {
            const enterKey = event.target?.closest?.('.vkb-key[data-key="ENTER"]');
            if (!enterKey || !prompt.isConnected || prompt.dataset.mode !== 'recoveryName') return;
            event.preventDefault();
            event.stopPropagation();
            submitRecoveryName();
        };
        document.addEventListener('click', recoveryVkbEnterHandler, true);
        const previousVkbEnterConfirm = window._doorpiVkbShouldConfirmEnter;
        const previousVkbConfirmOverride = window._doorpiVkbConfirmOverride;
        const physicalPinKeyHandler = (event) => {
            if (!prompt.isConnected ||
                (prompt.dataset.mode !== 'pin' && prompt.dataset.mode !== 'recoveryPin') ||
                prompt.dataset.submitting === 'true' ||
                event.ctrlKey || event.altKey || event.metaKey)
                return;

            if (/^[0-9]$/.test(event.key)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const digits = pinDigits();
                if (digits.length >= 4) return;
                input.value = digits + event.key;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }

            if (event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault();
                event.stopImmediatePropagation();
                const digits = pinDigits();
                input.value = digits.slice(0, -1);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (prompt.dataset.mode === 'recoveryPin') submitRecoveryPin();
                else submit();
            }
        };
        document.addEventListener('keydown', physicalPinKeyHandler, true);
        window._doorpiVkbShouldConfirmEnter = () => prompt.isConnected && prompt.dataset.mode === 'recoveryName';
        window._doorpiVkbConfirmOverride = () => {
            if (!prompt.isConnected || prompt.dataset.mode !== 'recoveryName') return false;
            submitRecoveryName();
            return true;
        };
        prompt._doorpiCleanup = () => {
            document.removeEventListener('click', recoveryVkbEnterHandler, true);
            document.removeEventListener('keydown', physicalPinKeyHandler, true);
            window._doorpiVkbShouldConfirmEnter = previousVkbEnterConfirm;
            window._doorpiVkbConfirmOverride = previousVkbConfirmOverride;
        };
        updateUserPinDots(prompt, '');
        prompt.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Backspace') {
                e.preventDefault();
                if (prompt.dataset.mode === 'pin') cancel();
                else showPinEntry();
            }
        }, true);

        requestAnimationFrame(() => {
            openPinKeyboard();
        });
    }

