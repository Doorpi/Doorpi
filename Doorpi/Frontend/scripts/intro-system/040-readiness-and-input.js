    function waitForConsoleShellReady() {
        if (!isConsoleShellPending()) return Promise.resolve();
        showSystemPrepOverlay();
        return new Promise(resolve => {
            const done = () => {
                if (isConsoleShellPending()) return;
                window.removeEventListener('doorpi:console-shell-ready', done);
                hideSystemPrepOverlay();
                resolve();
            };
            window.addEventListener('doorpi:console-shell-ready', done);
        });
    }

    function skipIntro() {
        if (!state.started || state.completed) return false;
        if (!isInitialUiReadyForSkip()) {
            // O Start pode chegar antes de o host informar se o destino inicial
            // é o seletor de usuário ou o setup. Memorize a intenção e conclua o
            // salto assim que essa tela estiver preparada.
            state.skipRequested = true;
            return true;
        }
        state.skipRequested = false;
        if (isNativeIntroMode()) {
            try {
                window.chrome?.webview?.postMessage(JSON.stringify({ action: 'nativeIntroSkip' }));
            } catch { }
            return true;
        }
        if (isConsoleShellSkipPending()) return false;
        createAmbient();
        completeIntro('skip', true);
        return true;
    }

    function installInputGuards() {
        if (state.inputHandlersInstalled) return;
        state.inputHandlersInstalled = true;
        const keyGuard = (e) => {
            if (!state.started || state.completed) return;
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        const clickGuard = (e) => {
            if (!state.started || state.completed) return;
            e.preventDefault();
            e.stopPropagation();
        };
        document.addEventListener('keydown', keyGuard, true);
        document.addEventListener('click', clickGuard, true);
    }

