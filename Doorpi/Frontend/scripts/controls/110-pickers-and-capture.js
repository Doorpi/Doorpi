    function openPicker(kind) {
        if (kind === 'profiles' && state.target && !mouseKeyboardEnabled()) return;
        const profiles = state.profiles.filter(profile => !isGlobalProfile(profile) && (!isBuiltIn(profile) || !state.target || (state.target.isYouTubeTv ? ['builtin-youtube','builtin-web'].includes(profile.id) : profile.id === `builtin-${state.target.category}`)));
        const items = kind === 'apps' ? state.targets : profiles;
        const searchKey = kind === 'apps' ? 'searchApps' : 'searchProfiles'; const titleKey = kind === 'apps' ? 'selectApp' : 'selectProfile';
        openPopup(`<div class="cc-dialog cc-picker-dialog"><div class="cc-dialog-head"><div><h2>${tx(titleKey)}</h2></div><button class="cc-btn" data-cc-focus data-popup-close>${tx('close')}</button></div><input class="cc-search" data-cc-focus data-picker-search placeholder="${tx(searchKey)}"><div class="cc-picker-list" data-picker-list></div></div>`, kind);
        const render = () => {
            const query = state.overlay.querySelector('[data-picker-search]').value.trim().toLowerCase();
            const filtered = items.filter(item => (kind === 'apps' ? item.name : profileDisplayName(item)).toLowerCase().includes(query));
            state.overlay.querySelector('[data-picker-list]').innerHTML = filtered.length ? filtered.map(item => {
                const active = kind === 'apps' ? targetKey(item) === targetKey(state.target) : item.id === state.draft?.id;
                const name = kind === 'apps' ? item.name : profileDisplayName(item); const sub = kind === 'apps' ? item.category : (isBuiltIn(item) ? tx('systemProfile') : tx('customProfile'));
                const key = kind === 'apps' ? targetKey(item) : item.id;
                const art = kind === 'apps' ? targetArtHtml(item, 'cc-picker-icon') : profileArtHtml(item, 'cc-picker-icon cc-profile-art');
                const trailing = kind === 'profiles' ? `<span class="cc-profile-row-trailing">${profileAuthorChipHtml(item)}${active ? `<span class="cc-profile-saved-label">${tx('saved')}</span>` : ''}</span>` : `<span>${active ? tx('saved') : ''}</span>`;
                return `<button class="cc-picker-item ${active ? 'active' : ''}" data-cc-focus data-pick="${esc(key)}">${art}<span><strong>${esc(name)}</strong><span>${esc(sub)}</span></span>${trailing}</button>`;
            }).join('') : `<div class="cc-empty">${tx('noResults')}</div>`;
            state.overlay.querySelectorAll('[data-pick]').forEach(button => button.addEventListener('click', () => {
                if (kind === 'apps') { const target = state.targets.find(item => targetKey(item) === button.dataset.pick); closePopup(); guardDirty(() => selectTarget(target)); }
                else { const profile = state.profiles.find(item => item.id === button.dataset.pick); if (!profile) return; closePopup(); guardDirty(() => state.target ? post({ action:'assignControlProfile', target:state.target, profileId:profile.id }) : selectTemplate(profile)); }
            }));
        };
        state.overlay.querySelector('[data-picker-search]').addEventListener('input', render); render(); focusDefault('[data-picker-search]');
    }

    function openKeyboard(index) {
        const current = index >= 0 ? state.draft.bindings[index]?.action?.virtualKeys || [] : []; const selected = [...current];
        openPopup(`<div class="cc-dialog wide"><div class="cc-dialog-head"><div><h2>${tx('chooseKeys')}</h2><p>${tx('chooseKeysDesc')}</p></div><button class="cc-btn" data-cc-focus data-popup-close>${tx('close')}</button></div><div class="cc-key-summary" data-key-summary></div><div class="cc-keyboard-scroll"><div class="cc-keyboard">${KEY_ROWS.map((row,rowIndex) => `<div class="cc-key-row" data-key-row="${rowIndex}">${row.map(([code,label,size],colIndex) => `<button class="cc-key ${size || ''}" data-cc-focus data-key="${code}" data-key-row="${rowIndex}" data-key-col="${colIndex}">${esc(keyboardKeyLabel(code,label))}</button>`).join('')}</div>`).join('')}</div></div><div class="cc-dialog-actions"><button class="cc-btn" data-cc-focus data-clear-keys>${tx('clear')}</button><button class="cc-btn primary" data-cc-focus data-apply-keys>${tx('apply')}</button></div></div>`, 'keyboard');
        const update = () => { state.overlay.querySelector('[data-key-summary]').innerHTML = selected.length ? chordHtml(selected.map(keyLabel)) : `<span class="cc-unassigned">${tx('chooseKeys')}</span>`; state.overlay.querySelectorAll('[data-key]').forEach(button => button.classList.toggle('selected', selected.includes(Number(button.dataset.key)))); };
        state.overlay.querySelectorAll('[data-key]').forEach(button => button.addEventListener('click', () => { const code = Number(button.dataset.key); const at = selected.indexOf(code); if (at >= 0) selected.splice(at,1); else if (selected.length < 6) selected.push(code); update(); }));
        state.overlay.querySelector('[data-clear-keys]').addEventListener('click', () => { selected.splice(0); update(); });
        state.overlay.querySelector('[data-apply-keys]').addEventListener('click', () => { if (!selected.length) return; ensureFork(); if (index >= 0) { state.draft.bindings[index].action.virtualKeys = selected; state.selectedBindingIndex=index; } else { state.draft.bindings.push(newBinding({type:'keyboard',virtualKeys:selected,mouseButton:'left',wheelDelta:120,systemCommand:''})); state.selectedBindingIndex=state.draft.bindings.length-1; } markDirty(); closePopup(); renderContent(); });
        update(); focusDefault('[data-key]');
    }

    function openMousePicker() {
        const choices = [['pointer','free','pointerFree'],['pointer','up','pointerUp'],['pointer','down','pointerDown'],['pointer','left','pointerLeft'],['pointer','right','pointerRight'],['mouse','left','left'],['mouse','right','right'],['mouse','middle','middle'],['mouse','x1','backMouse'],['mouse','x2','forwardMouse'],['wheel',120,'wheelUp'],['wheel',-120,'wheelDown']];
        openPopup(`<div class="cc-dialog"><div class="cc-dialog-head"><div><h2>${tx('chooseMouse')}</h2><p>${tx('pointerChoiceDesc')}</p></div><button class="cc-btn" data-cc-focus data-popup-close>${tx('close')}</button></div><div class="cc-picker-list">${choices.map(([type,value,label]) => { const action={type,mouseButton:type === 'mouse' ? value : 'left',wheelDelta:type === 'wheel' ? Number(value) : 120,pointerDirection:type === 'pointer' ? value : 'free',pointerDistance:24}; const icon=type === 'pointer' ? stickSvg(value !== 'free') : mouseActionSvg(action); return `<button class="cc-picker-item" data-cc-focus data-mouse-choice="${type}:${value}"><span class="cc-picker-icon">${icon}</span><span><strong>${tx(label)}</strong></span></button>`; }).join('')}</div></div>`, 'mouse');
        state.overlay.querySelectorAll('[data-mouse-choice]').forEach(button => button.addEventListener('click', () => { const [type,value] = button.dataset.mouseChoice.split(':'); ensureFork(); state.draft.bindings.push(newBinding({type,virtualKeys:[],mouseButton:type === 'mouse' ? value : 'left',wheelDelta:type === 'wheel' ? Number(value) : 120,pointerDirection:type === 'pointer' ? value : 'free',pointerDistance:24,systemCommand:''})); state.selectedBindingIndex=state.draft.bindings.length-1; markDirty(); closePopup(); renderContent(); }));
        focusDefault('[data-mouse-choice]');
    }
    function openGlobalPicker() {
        const choices = [
            ['doorpi-return', lang() === 'pt' ? 'Voltar ao Doorpi' : 'Return to Doorpi'],
            ['task-switcher', lang() === 'pt' ? 'Alternar entre janelas' : 'Switch windows']
        ];
        openPopup(`<div class="cc-dialog"><div class="cc-dialog-head"><div><h2>${tx('chooseGlobal')}</h2><p>${tx('chooseGlobalDesc')}</p></div><button class="cc-btn" data-cc-focus data-popup-close>${tx('close')}</button></div><div class="cc-picker-list">${choices.map(([command,label]) => `<button class="cc-picker-item" data-cc-focus data-global-choice="${command}"><span class="cc-picker-icon">${iconSvg('system')}</span><span><strong>${label}</strong><span>${tx('systemAction')}</span></span>${iconSvg('chevron')}</button>`).join('')}</div></div>`, 'global');
        state.overlay.querySelectorAll('[data-global-choice]').forEach(button => button.addEventListener('click', () => {
            const command = button.dataset.globalChoice;
            const binding = newBinding({type:'system',virtualKeys:[],mouseButton:'left',wheelDelta:120,systemCommand:command});
            binding.name = actionLabel(binding.action); state.draft.bindings.push(binding); state.selectedBindingIndex=state.draft.bindings.length-1;
            markDirty(); closePopup(); renderContent();
        }));
        focusDefault('[data-global-choice]');
    }
    function newBinding(action) { return { id:`binding-${Date.now()}-${Math.random().toString(16).slice(2)}`, name:actionLabel(action), enabled:true, controllerButtons:[], trigger:'press', longPressDurationMs:1200, secondaryControllerButtons:[], secondaryTrigger:'press', secondaryLongPressDurationMs:1200, action }; }

    function openCapture(index,slot='primary') {
        const id = `capture-${Date.now()}-${Math.random().toString(16).slice(2)}`; state.capture = { id, index, slot, progress:0, buttons:[], lastBPressAt:0 };
        openPopup(`<div class="cc-dialog"><div class="cc-dialog-head"><div><h2>${tx('captureTitle')}</h2><p>${tx(slot === 'secondary' ? 'secondaryShortcut' : 'primaryShortcut')} · ${esc(actionLabel(state.draft.bindings[index].action))}</p></div></div><div class="cc-capture"><div class="cc-capture-ring" data-capture-ring style="--progress:0"><div class="cc-capture-chord" data-capture-chord>${controllerChordHtml([],'capture')}</div></div><div class="cc-progress" style="--progress:0" data-capture-progress><span></span></div><p class="cc-capture-status" data-capture-status>${tx('captureIdle')}</p><p class="cc-range-help" data-capture-cancel-hint>${tx('cancelDoubleB')}</p><button class="cc-btn" data-cc-focus data-cancel-capture>${tx('cancel')}</button></div></div>`, 'capture');
        state.overlay.querySelector('[data-cancel-capture]').addEventListener('click', cancelCapture);
        post({ action:'startControlCapture', captureId:id }); focusDefault('[data-cancel-capture]');
    }
    function cancelCapture() {
        if (!state.capture) return;
        post({action:'cancelControlCapture',captureId:state.capture.id}); state.capture=null; state.captureSuppressed=true; closePopup();
    }
    function handleCaptureCancelPress() {
        if (!state.capture) return;
        const now = performance.now();
        if (state.capture.lastBPressAt && now - state.capture.lastBPressAt <= 700) { cancelCapture(); return; }
        state.capture.lastBPressAt = now;
        const hint = state.overlay?.querySelector('[data-capture-cancel-hint]');
        if (hint) hint.textContent = tx('cancelDoubleBArmed');
    }
    function updateCapture(data) {
        if (!state.capture || data.captureId !== state.capture.id) return; const progress = Math.max(0,Math.min(1,Number(data.progress)||0)); const buttons = data.buttons || [];
        state.capture.progress = progress; state.capture.buttons = buttons;
        const ring = state.overlay.querySelector('[data-capture-ring]'); const bar = state.overlay.querySelector('[data-capture-progress]'); if (ring) ring.style.setProperty('--progress',progress); if (bar) bar.style.setProperty('--progress',progress);
        const chord = state.overlay.querySelector('[data-capture-chord]'); if (chord) chord.innerHTML = controllerChordHtml(buttons,'capture');
        const status = state.overlay.querySelector('[data-capture-status]'); if (status) status.textContent = data.waitingForRelease ? tx('captureRelease') : progress >= 1 ? tx('captureDone') : buttons.length ? tx('captureHolding') : tx('captureIdle');
        if (data.type === 'controlCaptureCompleted' && buttons.length) {
            ensureFork(); const binding=state.draft.bindings[state.capture.index],slot=state.capture.slot || 'primary',buttonsProp=slot === 'secondary' ? 'secondaryControllerButtons' : 'controllerButtons',triggerProp=slot === 'secondary' ? 'secondaryTrigger' : 'trigger',durationProp=slot === 'secondary' ? 'secondaryLongPressDurationMs' : 'longPressDurationMs'; binding[buttonsProp] = buttons; binding[durationProp]=longPressDuration(binding,slot);
            const analog=buttons.some(input => input === 'left-stick' || input === 'right-stick');
            if (binding.action?.type === 'pointer' || binding.action?.type === 'wheel') binding[triggerProp]=analog?'hold':'press';
            if (!analog && binding.action?.type === 'pointer' && binding.action.pointerDirection === 'free') {
                const direction=buttons.find(input => input.startsWith('dpad-'))?.slice(5);
                if (direction) binding.action.pointerDirection=direction;
            }
            markDirty(); state.capture = null; state.captureSuppressed = true;
            setTimeout(() => { closePopup(); renderContent(); }, 280);
        }
    }

    function openSaveDialog() {
        if (!state.dirty || !state.draft) return; const suggested = state.draft.name || (state.target ? `${state.target.name} — ${tx('customSuffix')}` : '');
        openPopup(`<div class="cc-dialog"><div class="cc-dialog-head"><div><h2>${tx('saveTitle')}</h2><p>${tx('saveDesc')}</p></div><button class="cc-btn" data-cc-focus data-popup-close>${tx('close')}</button></div><label class="cc-label" for="ccProfileName">${tx('profileName')}</label><input id="ccProfileName" class="cc-name-input" data-cc-focus value="${esc(suggested)}"><p style="margin-top:12px">${tx('syncOn')}</p><div class="cc-dialog-actions"><button class="cc-btn" data-cc-focus data-popup-close>${tx('cancel')}</button><button class="cc-btn primary" data-cc-focus data-confirm-save>${tx('confirmSave')}</button></div></div>`, 'save');
        const input = state.overlay.querySelector('#ccProfileName'); state.overlay.querySelector('[data-confirm-save]').addEventListener('click', () => { const name = input.value.trim(); if (!name) { input.focus(); return; } state.draft.name = name; state.draft.updatedAtUtc = new Date().toISOString(); state.savePending = true; renderFooter(); closePopup(); post({action:'saveControlProfile',target:state.target,profile:state.draft}); }); focusDefault('#ccProfileName');
    }

    function guardDirty(action) {
        if (!state.dirty) { action(); return; }
        openPopup(`<div class="cc-dialog"><div class="cc-dialog-head"><div><h2>${tx('discardTitle')}</h2><p>${tx('discardDesc')}</p></div></div><div class="cc-dialog-actions"><button class="cc-btn" data-cc-focus data-keep-editing>${tx('keepEditing')}</button><button class="cc-btn danger" data-cc-focus data-discard>${tx('discard')}</button></div></div>`, 'discard');
        state.overlay.querySelector('[data-keep-editing]').addEventListener('click', closePopup);
        state.overlay.querySelector('[data-discard]').addEventListener('click', () => { state.dirty=false; closePopup(); action(); });
        focusDefault('[data-keep-editing]');
    }
