    function runAfterIntro(callback) {
        if (state.completed || state.failed) { callback(); return; }
        state.waiters.push(callback);
    }

    function handleIntroMessage(event) {
        const data = event.data;
        if (!data || (typeof data !== 'object' && typeof data !== 'string')) return;
        const type = typeof data === 'string' ? data : data.type;

        if (type === 'doorpi:intro:handoff') createAmbient(typeof data === 'object' ? data.handoff : {});
        else if (type === 'doorpi:intro:complete') completeIntro('message');
        else if (type === 'doorpi:intro:error') { state.failed = true; completeIntro('error'); }
        else if (type === 'nativeBootIntroComplete') {
            window.__doorpiNativeIntroComplete = true;
            if (isNativeIntroMode()) {
                createNativeHandoffAmbient();
                completeIntro('native', true);
            }
        }
    }

    function handleHostMessage(event) {
        let data = event.data;
        try {
            if (typeof data === 'string') data = JSON.parse(data);
        } catch { return; }
        if (!data || typeof data !== 'object') return;

        if (data.type === 'bootModeState') {
            state.bootMode = Number(data.mode || 0);
            window.__doorpiBootMode = state.bootMode;
            return;
        }

        if (data.type === 'nativeBootIntroComplete') {
            window.__doorpiNativeIntroComplete = true;
            if (isNativeIntroMode()) {
                createNativeHandoffAmbient();
                completeIntro('native', true);
            }
            return;
        }

        if (data.type === 'consoleShellExplorerReady') {
            state.consoleExplorerReady = true;
            window.__doorpiConsoleShellExplorerReady = true;
            window.dispatchEvent(new CustomEvent('doorpi:console-shell-ready'));
            if (state.completed && !state.finishDispatched) {
                finalizeIntroCompletion('system-ready');
            }
            return;
        }

        if (data.type === 'consoleShellIntroSkippable') {
            state.consoleIntroSkippable = true;
            window.__doorpiConsoleShellIntroSkippable = true;
        }
    }

    function postIntroVolume(value) {
        const safe = Math.max(0, Math.min(1, Number(value) || 0));
        try {
            state.iframe?.contentWindow?.postMessage({ type: 'doorpi:intro:set-volume', volume: safe }, '*');
        } catch { }
    }

