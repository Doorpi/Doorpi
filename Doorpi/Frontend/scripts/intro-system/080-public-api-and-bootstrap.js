    window.DoorpiIntro = {
        start, runAfterIntro, finishHandoff, skip: skipIntro,
        isRunning: () => state.started && !state.completed,
        isComplete: () => state.completed,
        isPrepared: () => state.prepared,
        isHandoffActive: () => state.handoffActive,
        startUserPickerAmbient: () => {
            state.pendingInitialDestination = 'user-picker';
            createNativeHandoffAmbient();
            if (state.skipRequested) requestAnimationFrame(skipIntro);
        },
        freezeUserPickerAmbient: freezeAmbient,
        resumeUserPickerAmbient: resumeAmbient,
        setVolume: postIntroVolume,
        getUserPickerClasses: () => {
            const cfg = state.handoffConfig || {};
            const userPicker = cfg.userPicker || {};
            const transparent = userPicker.transparentBackdrop ?? cfg.transparentBackdrop ?? true;
            return [
                transparent ? 'doorpi-intro-handoff' : '',
                ...classListFrom(userPicker.className || userPicker.class || cfg.userPickerClass)
            ].filter(Boolean);
        },
        getSetupClasses: () => {
            const cfg = state.handoffConfig || {};
            const setup = cfg.setup || {};
            const userPicker = cfg.userPicker || {};
            const transparent = setup.transparentBackdrop ?? userPicker.transparentBackdrop ?? cfg.transparentBackdrop ?? true;
            return [
                transparent ? 'doorpi-intro-handoff' : '',
                ...classListFrom(setup.className || setup.class || cfg.setupClass || userPicker.className || userPicker.class || cfg.userPickerClass)
            ].filter(Boolean);
        },
        prepareSetupHandoff: () => {
            state.pendingInitialDestination = 'setup';
            createNativeHandoffAmbient();
            if (state.skipRequested) requestAnimationFrame(skipIntro);
            return true;
        },
        canSkip: () => state.started && !state.completed && isInitialUiReadyForSkip(),
        shouldDeferUserPicker: () => false
    };

    // INJEÇÃO ULTRA-RÁPIDA (Não espera o resto da página carregar)
    injectStyles();
    try {
        window.chrome?.webview?.addEventListener('message', handleHostMessage);
    } catch { }
    if (document.body) {
        start();
    } else {
        const observer = new MutationObserver(() => {
            if (document.body) {
                observer.disconnect();
                start();
            }
        });
        observer.observe(document.documentElement, { childList: true });

        // Fallback de segurança garantida
        document.addEventListener('DOMContentLoaded', () => {
            if (!state.started) {
                observer.disconnect();
                start();
            }
        });
    }
})();
