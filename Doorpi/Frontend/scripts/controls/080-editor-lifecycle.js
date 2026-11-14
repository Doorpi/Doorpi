    function open(target = null) {
        window.DoorpiQuickPanel?.close?.();
        const quickPanel = document.getElementById('doorpiQuickPanel');
        quickPanel?.classList.remove('visible');
        if (quickPanel) quickPanel.style.display = 'none';
        document.body.classList.remove('quick-panel-open');
        state.requestedTarget = target; state.targets = []; state.profiles = []; state.profileOwners = []; state.assignments = [];
        state.target = null; state.lastTarget = target || null; state.profile = null; state.draft = null; state.tab = 'keyboard'; state.mode = target ? 'apps' : 'global'; state.adjustingRange = null; state.selectedBindingIndex = -1; state.dirty = false; state.popup = null; state.capture = null; state.captureSuppressed = false; state.inputModePending = false;
        createOverlay(); window.resetDoorpiGamepadInputState?.(); window.armDoorpiGamepadReleaseGate?.();
        renderHeader(); post({ action: 'controlEditorOpened' }); post({ action: 'requestControlCatalog' });
        if (!target) post({action:'requestGlobalControlEditor'});
        focusDefault();
    }
    function close() {
        if (state.capture) post({ action: 'cancelControlCapture', captureId: state.capture.id });
        if (state.overlay) post({ action: 'controlEditorClosed' });
        state.overlay?.remove(); state.overlay = null; state.popup = null; state.capture = null; document.body.classList.remove('doorpi-controls-open');
    }

    function selectTarget(target) {
        if (!target) return; state.target = target; state.lastTarget = target; state.dirty = false; state.popup = null; state.capture = null; state.selectedBindingIndex = -1;
        post({ action: 'requestControlEditor', targetKind: target.kind, targetId: target.id, targetName: target.name });
        renderHeader(); renderLoading();
    }
    function selectTemplate(profile) {
        if (!profile) return; state.target = null; state.profile = profile; state.draft = clone(profile);
        state.dirty = false; state.savePending = false; state.selectedBindingIndex = -1; renderAll();
    }
    function setMode(mode) {
        if (!['apps','global'].includes(mode) || state.mode === mode) return;
        guardDirty(() => {
            state.mode = mode; state.tab = 'keyboard'; state.adjustingRange = null; state.selectedBindingIndex = -1;
            state.overlay?.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
            if (mode === 'global') { if (state.target) state.lastTarget = state.target; renderLoading(); post({action:'requestGlobalControlEditor'}); }
            else {
                if (state.lastTarget) selectTarget(state.lastTarget);
                else {
                    const template = state.profiles.find(profile => profile.id === 'builtin-web');
                    selectTemplate(template);
                }
            }
            renderHeader();
        });
    }
