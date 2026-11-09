    function receive(event) {
        let data = event?.data; if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
        if (!data || !state.overlay) return;
        if (data.type === 'nativeControllerSnapshot') {
            state.captureSuppressed = !!data.controlCaptureSuppressed;
            if (state.capture && (Number(data.pressed || 0) & 0x2000) !== 0)
                handleCaptureCancelPress();
            return;
        }
        if (data.type === 'controlCatalog') {
            state.targets = (data.targets || []).filter(target => target.kind === 'media' || target.kind === 'store');
            state.profiles = (data.profiles || []).filter(profile => !isGlobalProfile(profile)); state.profileOwners = data.profileOwners || []; state.assignments = data.assignments || [];
            let target = state.requestedTarget && state.targets.find(item => targetKey(item) === targetKey(state.requestedTarget));
            if (!target && state.requestedTarget) {
                target = state.targets.find(item => item.id === state.requestedTarget.id) || state.requestedTarget;
                if (!state.targets.some(item => targetKey(item) === targetKey(target))) state.targets.push(target);
            }
            if (target) selectTarget(target);
            else if (state.mode !== 'global') selectTemplate(state.profiles.find(profile => profile.id === 'builtin-web'));
            else renderHeader();
        } else if (data.type === 'controlEditor') {
            const restoreInputModeFocus = state.inputModePending;
            state.mode = 'apps';
            state.target = data.target; state.profile = data.profile; state.draft = clone(data.profile); state.dirty = false; state.savePending = false; state.inputModePending = false; state.selectedBindingIndex = -1;
            const index = state.profiles.findIndex(profile => profile.id === data.profile.id); if (index >= 0) state.profiles[index] = data.profile;
            else state.profiles.push(data.profile);
            renderAll();
            if (restoreInputModeFocus) focusDefault('[data-input-mode-toggle]');
        } else if (data.type === 'globalControlEditor') {
            state.mode = 'global'; state.target = null; state.profile = data.profile; state.draft = clone(data.profile);
            state.dirty = false; state.savePending = false; state.selectedBindingIndex = -1; renderAll();
        } else if (data.type === 'controlProfileSaved') {
            state.profile = data.profile; state.draft = clone(data.profile); state.dirty = false; state.savePending = false;
            const index = state.profiles.findIndex(profile => profile.id === data.profile.id); if (index >= 0) state.profiles[index] = data.profile; else state.profiles.push(data.profile);
            renderAll(); toast(tx('saved'));
        } else if (data.type === 'controlCaptureProgress' || data.type === 'controlCaptureCompleted') {
            updateCapture(data);
        } else if (data.type === 'controlCaptureCanceled') {
            if (state.capture?.id === data.captureId) { state.capture = null; closePopup(); }
        }
    }

