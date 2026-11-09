    function classListFrom(value) {
        return String(value || '').split(/\s+/).map(item => item.trim()).filter(item => /^[a-zA-Z0-9_-]+$/.test(item));
    }

    function injectStyles() {
        if (!document.head || document.getElementById('doorpiIntroSystemStyles')) return;
        const style = document.createElement('style');
        style.id = 'doorpiIntroSystemStyles';
        style.textContent = __doorpiCss("injected-styles/intro-system/doorpi-intro-system-styles.css");
        document.head.appendChild(style);
    }

    function revealMainSystemUI() {
        const ui = document.getElementById('doorpi-app-ui');
        if (ui && ui.style.display === 'none') {
            ui.style.display = 'block';
            void ui.offsetWidth;
            ui.style.opacity = '1';
            document.body.style.background = '#0b1232';
        }
    }

    function flushWaiters() {
        const waiters = state.waiters.splice(0);
        for (const waiter of waiters) { try { waiter(); } catch (err) { } }
    }

    function isElementReady(el) {
        if (!el) return false;
        const style = window.getComputedStyle?.(el);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
        return el.offsetWidth > 0 && el.offsetHeight > 0;
    }

    function isInitialUiReadyForSkip() {
        if (state.pendingInitialDestination) return true;
        if (window.__doorpiInitialUiReady === true) return true;
        if (window._doorpiUserSessionReady === true) return true;
        if (isElementReady(document.getElementById('doorpiUserPicker'))) return true;
        if (isElementReady(document.getElementById('setupContainer'))) return true;
        return false;
    }

    function isConsoleShellMode() {
        return Number(state.bootMode || window.__doorpiBootMode || 0) === 2;
    }

    function isNativeIntroMode() {
        return state.nativeIntro === true || window.__doorpiUseNativeIntro === true;
    }

    function isConsoleShellPending() {
        return isConsoleShellMode() && state.consoleExplorerReady !== true && window.__doorpiConsoleShellExplorerReady !== true;
    }

    function isConsoleShellSkipPending() {
        return isConsoleShellMode() &&
            state.consoleExplorerReady !== true &&
            window.__doorpiConsoleShellExplorerReady !== true &&
            state.consoleIntroSkippable !== true &&
            window.__doorpiConsoleShellIntroSkippable !== true;
    }

    function needsSystemPrepWait() {
        return isConsoleShellPending();
    }

    function getSystemPrepText() {
        const lang = String(navigator.language || navigator.userLanguage || '').toLowerCase();
        if (lang.startsWith('pt')) {
            return {
                title: 'Preparando sistema',
                subtitle: 'Aguardando ambiente do Windows'
            };
        }
        return {
            title: 'Preparing system',
            subtitle: 'Waiting for Windows environment'
        };
    }

    function showSystemPrepOverlay() {
        let overlay = state.systemPrepOverlay || document.getElementById('doorpiIntroSystemPrep');
        if (!overlay) {
            const text = getSystemPrepText();
            overlay = document.createElement('div');
            overlay.id = 'doorpiIntroSystemPrep';
            overlay.innerHTML = `
                <div class="prep-spinner" aria-hidden="true"></div>
                <div class="prep-title">${text.title}</div>
                <div class="prep-sub">${text.subtitle}</div>
            `;
            document.body.appendChild(overlay);
        }
        state.systemPrepOverlay = overlay;
        overlay.style.display = 'flex';
        requestAnimationFrame(() => overlay.classList.add('visible'));
    }

    function hideSystemPrepOverlay() {
        const overlay = state.systemPrepOverlay || document.getElementById('doorpiIntroSystemPrep');
        if (!overlay) return;
        overlay.classList.remove('visible');
        setTimeout(() => {
            if (!overlay.classList.contains('visible')) overlay.remove();
        }, 240);
        state.systemPrepOverlay = null;
    }

    function notifyHostIntroReadyForFocus(reason) {
        const send = () => {
            try {
                window.chrome?.webview?.postMessage(JSON.stringify({
                    action: 'introSystemReadyForFocus',
                    reason: String(reason || 'complete')
                }));
            } catch { }
        };

        requestAnimationFrame(() => requestAnimationFrame(send));
    }

    function finalizeIntroCompletion(reason) {
        if (state.finishDispatched) return;
        state.finishDispatched = true;
        window._doorpiIntroInputBlockUntil = performance.now() + 450;
        window.quarantineDoorpiGamepadActions?.(600);
        hideSystemPrepOverlay();
        if (!state.handoffActive) {
            revealMainSystemUI();
        }
        flushWaiters();
        window.dispatchEvent(new CustomEvent('doorpi:intro-complete', { detail: { reason } }));
        notifyHostIntroReadyForFocus(reason);
    }

    function completeIntro(reason = 'complete', immediate = false) {
        if (state.completed) return;
        state.completed = true;
        window.clearTimeout(state.completeTimer);

        const iframe = state.iframe;
        const fadeMs = immediate ? 0 : Math.max(0, Number(state.config?.exitFadeMs ?? 520));

        const finish = () => {
            iframe?.remove();
            state.iframe = null;
            if (needsSystemPrepWait()) {
                showSystemPrepOverlay();
                return;
            }
            finalizeIntroCompletion(reason);
        };

        if (iframe && fadeMs > 0) {
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';
            window.setTimeout(finish, fadeMs);
        } else { finish(); }
    }

