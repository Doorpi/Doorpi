(function gamepadLoop() {
    try {
        // ── NOVO: Se o Doorpi não for a janela ativa no Windows, ignora o controle 100% ──
        if (!window.isDoorpiFocused) return;

        let gamepad = readAllGamepadInput();
        if (!gamepad) return;

        if (window.DoorpiControls?.isOpen?.() && !isVkbOpenForNavigation()) {
            const { GAMEPAD } = NAV, buttons = gamepad.buttons;
            if (window.DoorpiControls.isCapturing?.()) {
                _currentDirection = null;
                return;
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_L1], GAMEPAD.BTN_L1))
                window.DoorpiControls.switchTab('left');
            if (buttonJustPressed(buttons[GAMEPAD.BTN_R1], GAMEPAD.BTN_R1))
                window.DoorpiControls.switchTab('right');
            // Directions are emitted as discrete arrow-key pulses by the same
            // native C# navigator used everywhere else in Doorpi. This branch owns
            // only action buttons, avoiding a second analog/D-pad repeat loop.
            _currentDirection = null;
            _controlsDirectionStartedAt = 0;
            _controlsDirectionLastMoveAt = 0;
            if (primaryJustPressed(buttons, GAMEPAD))
                window.DoorpiControls.activate();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL))
                window.DoorpiControls.back();
            return;
        }

        if (window._doorpiNativeDialogActive) return;

        if (isDoorpiActionQuarantineActive()) {
            gamepad.buttons.forEach(button => {
                if (!button) return;
                button.justPressed = false;
                button._consumed = true;
            });
        }

        if (window.DoorpiIntro?.isRunning?.()) {
            const introButtons = gamepad.buttons;
            buttonJustPressed(introButtons[NAV.GAMEPAD.BTN_CONFIRM], NAV.GAMEPAD.BTN_CONFIRM);
            buttonJustPressed(introButtons[NAV.GAMEPAD.BTN_R2], NAV.GAMEPAD.BTN_R2);
            const startPressed = buttonJustPressed(introButtons[NAV.GAMEPAD.BTN_START], NAV.GAMEPAD.BTN_START);
            if (startPressed) {
                window.DoorpiIntro.skip?.();
            }
            return;
        }

        if (performance.now() < (window._doorpiIntroInputBlockUntil || 0)) {
            return;
        }

        const isSessionConflict = window.isSessionConflictPopupOpen?.() === true;
        const isEmulatorDiscSelector = window.isEmulatorDiscSelectorOpen?.() === true;
        const launchOverlay = document.getElementById('gameLaunchOverlay');
        const isExecutionLock = !isSessionConflict && launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('execution-lock-visible');
        const isWaitingLaunch = !isSessionConflict && launchOverlay && launchOverlay.classList.contains('visible') && launchOverlay.classList.contains('state-loading');
        const isGameFocusFallback = window.isGameFocusFallbackPopupOpen?.() === true;

        if (window.isDoorpiSessionTransitionActive?.()) {
            logDoorpiInputBlock('session-transition');
            return;
        }
        if (window.isGlobalLoading) {
            logDoorpiInputBlock('global-loading');
            return;
        }
        if (!isWaitingLaunch && !isExecutionLock && !isSessionConflict && !isGameFocusFallback && window.isMediaAppActive) {
            logDoorpiInputBlock('media-active');
            return;
        }
        if (!isWaitingLaunch && !isExecutionLock && !isSessionConflict && !isGameFocusFallback && isDoorpiGameInputSuppressed()) {
            logDoorpiInputBlock('game-input-suppressed');
            return;
        }
        if (!document.hasFocus()) {
            logDoorpiInputBlock('document-blur');
            return;
        }

        const { GAMEPAD } = NAV, buttons = gamepad.buttons;
        const thr = GAMEPAD.AXIS_THRESHOLD, now = performance.now();

        if (window.isDoorpiFileBrowserOpen?.() && !isVkbOpenForNavigation()) {
            _currentDirection = null;
            _moveState = 0;
            if (primaryJustPressed(buttons, GAMEPAD))
                window.DoorpiFileBrowser?.activate?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL))
                window.DoorpiFileBrowser?.back?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_START], GAMEPAD.BTN_START))
                window.DoorpiFileBrowser?.confirm?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE))
                window.DoorpiFileBrowser?.context?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_TRIANGLE], GAMEPAD.BTN_TRIANGLE))
                window.DoorpiFileBrowser?.createFolder?.();
            return;
        }

        if (isEmulatorDiscSelector) {
            _currentDirection = null;
            _moveState = 0;
            if (primaryJustPressed(buttons, GAMEPAD)) document.activeElement?.click();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                window.closeEmulatorDiscSelector?.(true);
                window.DoorpiUiSound?.play('back');
            }
            return;
        }

        // As direcoes chegam pelo loop nativo C# como teclas. A/R2 e B, porem,
        // chegam por este snapshot e precisam ignorar completamente o nav-menu.
        if (window.DoorpiProfileSync?.isOpen?.()) {
            _currentDirection = null;
            _moveState = 0;
            if (primaryJustPressed(buttons, GAMEPAD))
                window.DoorpiProfileSync.confirm?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL))
                window.DoorpiProfileSync.back?.();
            return;
        }

        if (window._profilePhotoPickerIsOpen?.() && !isVkbOpenForNavigation()) {
            _currentDirection = null;
            _moveState = 0;
            if (primaryJustPressed(buttons, GAMEPAD))
                window._profilePhotoPickerShortcut?.('confirm');
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL))
                window._profilePhotoPickerShortcut?.('cancel');
            return;
        }

        if (window._artworkWizardIsOpen?.() && !isVkbOpenForNavigation()) {
            _currentDirection = null;
            _moveState = 0;
            if (handleArtworkWizardGamepadShortcuts(buttons)) return;
            if (primaryJustPressed(buttons, GAMEPAD))
                window._artworkWizardShortcut?.('confirm');
            return;
        }

        if (isWaitingLaunch) {
            if (primaryJustPressed(buttons, GAMEPAD)) {
                const btn = document.getElementById('overlayCancelLaunchBtn');
                // O overlay Ã© uma aÃ§Ã£o Ãºnica: o A deve confirmar "Retornar"
                // mesmo se algum foco residual da Home ainda estiver ativo.
                if (btn && btn.style.display !== 'none' && !btn.disabled) {
                    btn.click();
                }
            }
            return;
        }

        if (isExecutionLock) {
            _currentDirection = null;
            _moveState = 0;

            if (primaryJustPressed(buttons, GAMEPAD)) {
                const active = document.activeElement;
                if (active && active.closest?.('#executionLockActions')) active.click();
                else document.getElementById('executionLockRestore')?.click();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE)) document.getElementById('executionLockClose')?.click();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
                document.getElementById('executionLockRestore')?.focus();
            }
            return;
        }

        if (isSessionConflict) {
            let conflictDir = gamepadDirection(gamepad, buttons, Math.max(thr, 0.72));

            if (conflictDir) {
                if (_sessionConflictHeldDir !== conflictDir) {
                    const nowNav = performance.now();
                    if (nowNav - _sessionConflictLastKeyNavAt > 90) {
                        _sessionConflictSuppressKeyNavUntil = nowNav + 90;
                        moveSessionConflictFocus(conflictDir);
                    }
                    _sessionConflictHeldDir = conflictDir;
                }
            } else {
                _sessionConflictHeldDir = null;
            }

            _currentDirection = null;
            _moveState = 0;

            if (primaryJustPressed(buttons, GAMEPAD)) {
                window.activateSessionConflictPopup?.();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                window.cancelSessionConflictPopup?.();
            }
            return;
        }

        _sessionConflictHeldDir = null;

        if (isGameFocusFallback) {
            let fallbackDir = gamepadDirection(gamepad, buttons, Math.max(thr, 0.72));

            if (fallbackDir) {
                if (_gameFocusFallbackHeldDir === null) {
                    moveFocus(fallbackDir);
                    _gameFocusFallbackHeldDir = fallbackDir;
                }
            } else {
                _gameFocusFallbackHeldDir = null;
            }

            _currentDirection = null;
            _moveState = 0;

            if (primaryJustPressed(buttons, GAMEPAD)) {
                const active = document.activeElement;
                if (active && active.closest?.('#gameFocusFallbackActions')) active.click();
                else document.getElementById('gameFocusFallbackManual')?.focus();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
            }
            return;
        }

        _gameFocusFallbackHeldDir = null;

        let dir = gamepadDirection(gamepad, buttons, thr);

        if (dir) {
            window._gpNavigating = true;
            if (_gpNavigatingTimeout) clearTimeout(_gpNavigatingTimeout);
            _gpNavigatingTimeout = setTimeout(() => {
                window._gpNavigating = false;
            }, NAV.GAMEPAD.REPEAT_DELAY + 50);
        }
        if (isCtxMenuOpen) {
            _currentDirection = null;
            _moveState = 0;
            if (primaryJustPressed(buttons, GAMEPAD)) {
                document.activeElement?.click();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                closeCtxMenu();
                window.DoorpiUiSound?.play('back');
            }
            return;
        }

        if (window.isDesktopWarningOpen) {
            if (primaryJustPressed(buttons, GAMEPAD)) window._dwAction?.('CONFIRM');
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
                window._dwAction?.('CANCEL');
            }
            return;
        }
        // -------------------------------

        if (window.isDoorpiOverlayOpen?.() && !isVkbOpenForNavigation()) {
            if (primaryJustPressed(buttons, GAMEPAD)) {
                if (window.DoorpiQuickPanel?.confirm?.()) return;
                const el = document.activeElement;
                if (el && el.tagName === 'INPUT') window._vkbOpen?.(el);
                else if (el && el.tagName === 'SELECT') {
                    if (typeof el.showPicker === 'function') el.showPicker();
                    else {
                        el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
                        el.dispatchEvent(new Event('change'));
                    }
                }
                else el?.click();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
                if (!canCloseProfileSelection()) return;
                window.closeDoorpiTopOverlay?.();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE)) {
                triggerContextMenu();
            }
            return;
        }

        if (window.isNavMenuOpen) {
            if (!isVkbOpenForNavigation()) {
                if (typeof isEditModalOpen !== 'undefined' && isEditModalOpen) {
                    if (handleArtworkWizardGamepadShortcuts(buttons)) return;
                    if (primaryJustPressed(buttons, GAMEPAD)) {
                        const el = document.activeElement;
                        if (el && el.tagName === 'INPUT') window._vkbOpen?.(el);
                        else if (el && el.tagName === 'SELECT') {
                            if (typeof el.showPicker === 'function') el.showPicker();
                            else {
                                el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
                                el.dispatchEvent(new Event('change'));
                            }
                        }
                        else el?.click();
                    }
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                        if (window.requestDoorpiBackAction?.()) return;
                        if (window._artworkWizardClose?.()) return;
                        window._editModalClose?.();
                    }
                    return;
                }
                else if (isCtxMenuOpen) {
                    if (primaryJustPressed(buttons, GAMEPAD)) document.activeElement?.click();
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                        if (window.requestDoorpiBackAction?.()) return;
                        closeCtxMenu();
                    }
                    return;
                }
                else {
                    if (primaryJustPressed(buttons, GAMEPAD)) window._navMenuHandleKey?.('Enter');
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                        if (window.requestDoorpiBackAction?.()) return;
                        window._navMenuHandleKey?.('Escape');
                    }
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE)) window._navMenuTriggerCtxMenu?.();
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_L1], GAMEPAD.BTN_L1)) window._navMenuCycleTab?.(-1);
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_R1], GAMEPAD.BTN_R1)) window._navMenuCycleTab?.(1);
                    return;
                }
            }
        }

        if (isVkbOpenForNavigation()) {
            // O D-pad já chega como pulsos Arrow* pelo navegador nativo. Ler os
            // mesmos botões novamente pelo Gamepad API fazia cada direção andar
            // duas vezes. Este loop fica responsável somente pelo analógico.
            const vkbAnalogDir = axisDirection(gamepad, thr);
            if (vkbAnalogDir && vkbAnalogDir !== _currentDirection) {
                _currentDirection = vkbAnalogDir;
                _controlsDirectionStartedAt = now;
                _controlsDirectionLastMoveAt = now;
                moveFocus(vkbAnalogDir);
            } else if (vkbAnalogDir &&
                       now - _controlsDirectionStartedAt >= GAMEPAD.INITIAL_DELAY &&
                       now - _controlsDirectionLastMoveAt >= GAMEPAD.REPEAT_DELAY) {
                _controlsDirectionLastMoveAt = now;
                moveFocus(vkbAnalogDir);
            } else if (!vkbAnalogDir) {
                _currentDirection = null;
                _controlsDirectionStartedAt = 0;
                _controlsDirectionLastMoveAt = 0;
            }
            if (primaryJustPressed(buttons, GAMEPAD)) document.activeElement?.click();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
                if (window.requestDoorpiBackAction?.()) return;
                window._vkbCancel?.();
            }
            if (buttonJustPressed(buttons[GAMEPAD.BTN_START], GAMEPAD.BTN_START)) window._vkbConfirm?.();

            [['l1', GAMEPAD.BTN_L1, -1], ['r1', GAMEPAD.BTN_R1, 1]].forEach(([id, idx, val]) => {
                const pressed = buttons[idx]?.pressed;
                if (pressed) {
                    if (_cursorHoldState[id] === 0) { window._vkbMoveCursor?.(val); _cursorLastTime[id] = now; _cursorHoldState[id] = 1; }
                    else if (_cursorHoldState[id] === 1 && now - _cursorLastTime[id] > GAMEPAD.INITIAL_DELAY) { window._vkbMoveCursor?.(val); _cursorLastTime[id] = now; _cursorHoldState[id] = 2; }
                    else if (_cursorHoldState[id] === 2 && now - _cursorLastTime[id] > GAMEPAD.REPEAT_DELAY) { window._vkbMoveCursor?.(val); _cursorLastTime[id] = now; }
                } else { _cursorHoldState[id] = 0; }
            });

            if (buttonJustPressed(buttons[GAMEPAD.BTN_L3], GAMEPAD.BTN_L3)) window._vkbToggleShift?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_L2], GAMEPAD.BTN_L2)) window._vkbToggleLayer?.();
            if (buttonJustPressed(buttons[GAMEPAD.BTN_TRIANGLE], GAMEPAD.BTN_TRIANGLE)) window._vkbPhysicalKey?.(' ');

            const sqPressed = buttons[GAMEPAD.BTN_SQUARE]?.pressed;
            if (sqPressed) {
                if (_cursorHoldState['sq'] === 0) { window._vkbPhysicalKey?.('Backspace'); _cursorLastTime['sq'] = now; _cursorHoldState['sq'] = 1; }
                else if (_cursorHoldState['sq'] === 1 && now - _cursorLastTime['sq'] > GAMEPAD.INITIAL_DELAY) { window._vkbPhysicalKey?.('Backspace'); _cursorLastTime['sq'] = now; _cursorHoldState['sq'] = 2; }
                else if (_cursorHoldState['sq'] === 2 && now - _cursorLastTime['sq'] > GAMEPAD.REPEAT_DELAY) { window._vkbPhysicalKey?.('Backspace'); _cursorLastTime['sq'] = now; }
            } else { _cursorHoldState['sq'] = 0; }
            return;
        }

        if (handleArtworkWizardGamepadShortcuts(buttons)) return;

        // Botões de ação globais
        if (primaryJustPressed(buttons, GAMEPAD)) {
            const el = document.activeElement;
            if (el && el.tagName === 'INPUT')window._vkbOpen(el); 

            else if (el && el.tagName === 'SELECT') {
                if (typeof el.showPicker === 'function') el.showPicker();
                else {
                    el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
                    el.dispatchEvent(new Event('change'));
                }
            }
            else el?.click();
        }
        if (buttonJustPressed(buttons[GAMEPAD.BTN_CANCEL], GAMEPAD.BTN_CANCEL)) {
            // 1. Se estiver na seleção de perfil, checa a trava
            if (window.requestDoorpiBackAction?.()) return;
            if (window.closeEmulatorContextMenu?.()) return;
            if (window.isDoorpiOverlayOpen?.()) {
                if (!canCloseProfileSelection()) return;
                window.closeDoorpiTopOverlay?.();
                return;
            }

            // 2. Senão, trata os outros menus normalmente
            if (isCtxMenuOpen) closeCtxMenu();
            else if (isEditModalOpen) window._editModalClose?.();
            else if (isSetupOpen) {
                const backToAuth = document.getElementById('btnSetupBackAuth');
                const cancelBtn = document.getElementById('btnSetupCancel');
                if (backToAuth?.classList.contains('visible') && typeof setupBack === 'function') setupBack();
                else if (cancelBtn && cancelBtn.style.display !== 'none') cancelBtn.click();
            }
            else if (isModalOpen) closeModal?.(); // Fecha Add Jogo/App
            else gamepadCancel();
        }
        if (buttonJustPressed(buttons[GAMEPAD.BTN_START], GAMEPAD.BTN_START)) {
            if (isModalOpen) {
                const activeView = document.querySelector('#addGameContainer .view-section.active');
                if (activeView?.id === 'view-media-apps') {
                    if (document.getElementById('subview-web')?.classList.contains('active')) document.getElementById('btnAddWebApp')?.click();
                    else document.getElementById('btnConfirmAddMedia')?.click();
                } else if (activeView?.id === 'view-folders') {
                    document.getElementById('btnScanFolder')?.click();
                } else if (activeView?.id === 'view-emulators') {
                    window.advanceEmulatorSetup?.();
                } else {
                    document.getElementById('btnConfirmAdd')?.click();
                }
            }
            else gamepadStart();
        }
        if (buttonJustPressed(buttons[GAMEPAD.BTN_TRIANGLE], GAMEPAD.BTN_TRIANGLE)) {
            if (window.toggleHomeTrailerFullscreen?.() !== true)
                gamepadTriangle();
        }
        if (buttonJustPressed(buttons[GAMEPAD.BTN_SQUARE], GAMEPAD.BTN_SQUARE)) {
            if (window.isStoreSessionMenuOpen?.()) {
                window.hideStoreSessionMenu?.();
                if (typeof postToHost === 'function') postToHost({ action: 'closeStore' });
            }
            else if (window.openFocusedEmulatorContextMenu?.()) { }
            else if (isEditModalOpen) window._editModalClose?.();
            else triggerContextMenu();
        }
        // DEPOIS
        if (!isSetupOpen && !isCtxMenuOpen && !isEditModalOpen) {
            if (isModalOpen) {
                // L1/R1 troca aba Web App ↔ Executável quando o modal de adicionar está aberto
                const mediaView = document.getElementById('view-media-apps');
                if (mediaView?.classList.contains('active')) {
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_R1], GAMEPAD.BTN_R1)) window._cycleMediaSubtab?.(1);
                    if (buttonJustPressed(buttons[GAMEPAD.BTN_L1], GAMEPAD.BTN_L1)) window._cycleMediaSubtab?.(-1);
                }
            } else {
                if (buttonJustPressed(buttons[GAMEPAD.BTN_R1], GAMEPAD.BTN_R1)) window.cycleHomeTab?.(1);
                if (buttonJustPressed(buttons[GAMEPAD.BTN_L1], GAMEPAD.BTN_L1)) window.cycleHomeTab?.(-1);
            }
        }
    } catch (e) {
        console.error('Gamepad Error:', e);
    } finally {
        requestAnimationFrame(gamepadLoop);
    }
})();

