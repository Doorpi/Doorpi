    function renderLoading() { const host = state.overlay?.querySelector('[data-content]'); if (host) host.innerHTML = `<div class="cc-empty">${tx('loading')}</div>`; }
    function renderAll() { normalizeSelectedBinding(); renderHeader(); renderTabs(); renderContent(); renderFooter(); focusDefault(); }
    function renderHeader() {
        if (!state.overlay) return;
        state.overlay.classList.toggle('cc-global-mode', state.mode === 'global');
        state.overlay.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === state.mode));
        state.overlay.querySelector('[data-context]').style.display = state.mode === 'global' ? 'none' : '';
        state.overlay.querySelector('.cc-tabs').style.display = state.mode === 'global' ? 'none' : '';
        const subtitle = state.overlay.querySelector('.cc-brand p');
        if (subtitle) subtitle.textContent = state.mode === 'global' ? tx('globalDesc') : tx('subtitle');
        const app = state.overlay.querySelector('[data-app-selector]');
        const profile = state.overlay.querySelector('[data-profile-selector]');
        if (app) app.innerHTML = `${targetArtHtml(state.target)}<span><strong>${esc(state.target?.name || tx('noApp'))}</strong><span>${esc(state.target ? (state.target.category === 'store' ? tx('storesGroup') : state.target.category === 'executable' ? 'Executable' : 'Web app') : tx('noAppDesc'))}</span></span><em>${tx('change')}</em>`;
        if (profile) profile.innerHTML = `${profileArtHtml(state.draft)}<span><strong>${esc(profileDisplayName(state.draft) || '—')}</strong><span>${esc(profileAuthorSummary(state.draft))}</span></span><em>${tx('change')}</em>`;
        if (profile) profile.disabled = !!state.target && (!mouseKeyboardEnabled() || state.inputModePending);
        renderInputMode();
    }
    function renderInputMode() {
        const section = state.overlay?.querySelector('[data-input-mode]');
        const button = section?.querySelector('[data-input-mode-toggle]');
        const description = section?.querySelector('[data-input-mode-desc]');
        const visible = state.mode === 'apps' && !!state.target;
        if (!section || !button) return;
        section.hidden = !visible;
        if (!visible) {
            state.overlay?.classList.remove('cc-input-disabled');
            return;
        }
        const enabled = mouseKeyboardEnabled();
        const canChange = state.target.canChangeMouseKeyboardMode === true;
        button.classList.toggle('on', enabled);
        button.textContent = tx(enabled ? 'inputModeOn' : 'inputModeOff');
        button.setAttribute('aria-checked', String(enabled));
        button.disabled = !canChange || state.inputModePending;
        if (description) description.textContent = canChange
            ? tx('inputModeDesc')
            : state.target.category === 'web' ? tx('inputModeRequired') : tx('inputModeShared');
        state.overlay?.classList.toggle('cc-input-disabled', !enabled);
    }
    function renderTabs() {
        const youtube = state.mode !== 'global' && isYouTubeProfile();
        if (youtube) state.tab = 'keyboard';
        state.overlay?.querySelectorAll('[data-tab]').forEach(button => {
            const mouse = button.dataset.tab === 'mouse';
            button.hidden = youtube && mouse;
            button.classList.toggle('active', button.dataset.tab === state.tab);
            if (button.dataset.tab === 'keyboard') button.textContent = tx(youtube ? 'remoteControl' : 'keyboard');
        });
        const hint = state.overlay?.querySelector('.cc-tab-hint');
        if (hint) hint.hidden = youtube;
    }
    function renderFooter() {
        const dirty = state.overlay?.querySelector('[data-dirty]'); const save = state.overlay?.querySelector('[data-save]');
        dirty?.classList.toggle('active', state.dirty); if (dirty) dirty.textContent = state.dirty ? tx('unsaved') : tx('saved'); if (save) { save.disabled = !state.dirty || state.savePending || state.inputModePending || (state.mode !== 'global' && !mouseKeyboardEnabled()); save.textContent = state.mode === 'global' ? tx('saveGlobals') : tx('save'); }
        const reset = state.overlay?.querySelector('[data-reset]'); if (reset) reset.textContent = state.mode === 'global' ? tx('resetDefaults') : tx('back');
    }
    function renderContent() {
        const host = state.overlay?.querySelector('[data-content]'); if (!host || !state.draft) return;
        if (state.inputModePending) {
            host.innerHTML = `<div class="cc-empty">${tx('loading')}</div>`;
            return;
        }
        if (state.mode !== 'global' && state.target && !mouseKeyboardEnabled()) {
            state.selectedBindingIndex = -1;
            host.innerHTML = `<div class="cc-input-lock">${iconSvg('lock')}<strong>${tx('inputModeLocked')}</strong><span>${tx('inputModeLockedDesc')}</span></div>`;
            return;
        }
        normalizeSelectedBinding();
        const bindings = visibleBindings();
        const heading = state.mode === 'global' ? tx('globalShortcuts') : isYouTubeProfile() ? tx('youtubeCommands') : state.tab === 'mouse' ? tx('mouseCommands') : tx('customCommands');
        const description = state.mode === 'global' ? tx('systemDesc') : isYouTubeProfile() ? tx('youtubeDesc') : state.tab === 'mouse' ? tx('mouseDesc') : tx('customDesc');
        const addLabel = state.mode === 'global' ? tx('addGlobal') : state.tab === 'mouse' ? tx('addMouse') : tx(isYouTubeProfile() ? 'addRemoteCommand' : 'addKeyboard');
        const addAttribute = state.mode === 'global' ? 'data-add-global' : state.tab === 'mouse' ? 'data-add-mouse' : 'data-add-keyboard';
        const addAction = `<button class="cc-row cc-add-row" data-cc-focus ${addAttribute}><span class="cc-row-icon">${iconSvg('plus')}</span><span class="cc-row-copy"><span class="cc-row-title">${addLabel}</span></span><span class="cc-row-chevron">${iconSvg('chevron')}</span></button>`;
        host.innerHTML = `<div class="cc-workspace">
            <section class="cc-command-panel"><div class="cc-section-head"><div><h2>${heading}</h2><p>${description}</p>${isBuiltIn() && state.mode !== 'global' ? `<p class="cc-fork-inline">${tx('profileFork')}</p>` : ''}</div></div><div class="cc-list">${addAction}${bindings.length ? bindings.map(bindingRow).join('') : `<div class="cc-empty">${state.tab === 'mouse' ? tx('emptyMouse') : tx('emptyKeyboard')}</div>`}</div></section>
            ${detailPanelHtml()}
        </div>`;
        wireContent();
    }
    function bindingRow(binding) {
        const index = state.draft.bindings.indexOf(binding); const selected = index === state.selectedBindingIndex;
        const secondary=(binding.secondaryControllerButtons || []);
        const primarySummary=triggerSummary(binding),secondarySummary=triggerSummary(binding,'secondary'),activationSummary=secondary.length && secondarySummary !== primarySummary ? `${primarySummary} / ${secondarySummary}` : primarySummary;
        const primaryNumber = secondary.length ? '<small>1</small>' : '';
        const secondaryRow = secondary.length ? `<span class="cc-row-shortcut-line secondary"><small>2</small>${controllerChordHtml(secondary,'compact')}</span>` : '';
        return `<button class="cc-row ${selected ? 'selected' : ''}" data-cc-focus data-binding-select="${index}" aria-pressed="${selected}"><span class="cc-row-icon">${bindingIcon(binding)}</span><span class="cc-row-copy"><span class="cc-row-title">${esc(bindingTitle(binding))}</span><span class="cc-row-sub"><span>${bindingTypeLabel(binding)}</span><span>·</span><span data-trigger-summary>${activationSummary}</span></span></span><span class="cc-row-shortcuts"><span class="cc-row-shortcut-line">${primaryNumber}${controllerChordHtml(binding.controllerButtons,'compact')}</span>${secondaryRow}</span><span class="cc-row-chevron">${iconSvg('chevron')}</span></button>`;
    }

    function activationCardHtml(binding,index,slot) {
        const secondary=slot === 'secondary';
        const buttons=secondary ? (binding.secondaryControllerButtons || []) : (binding.controllerButtons || []);
        const trigger=activationTrigger(binding,slot);
        const duration=longPressDuration(binding,slot);
        const analog=buttons.some(input => input === 'left-stick' || input === 'right-stick') && (binding.action?.type === 'pointer' || binding.action?.type === 'wheel');
        const triggerConfig=!buttons.length ? '' : analog
            ? `<div class="cc-fork-note">${tx('analogContinuous')}</div>`
            : `<div class="cc-trigger-grid">${['press','hold','long-press','release'].map(mode => `<button class="cc-trigger-option ${trigger === mode ? 'active' : ''}" data-cc-focus data-trigger-value="${mode}" data-trigger-slot="${slot}" data-binding-index="${index}">${triggerLabel(mode)}</button>`).join('')}</div>${trigger === 'long-press' ? `<div class="cc-range-card cc-long-press-config"><div class="cc-long-press-head"><span class="cc-long-press-copy"><strong>${tx('holdDuration')}</strong><small>${tx('holdDurationDesc')}</small></span><output data-long-press-duration-out>${formatDuration(duration)}</output></div><input class="cc-range" data-cc-focus data-long-press-duration data-duration-slot="${slot}" data-binding-index="${index}" type="range" min="500" max="${longPressLimit(binding,slot)}" step="100" value="${duration}"><span class="cc-range-help" data-range-help>${tx('adjustRange')}</span></div>` : ''}`;
        return `<section class="cc-activation-card"><div class="cc-activation-head"><strong>${tx(secondary ? 'secondaryShortcut' : 'primaryShortcut')}</strong><small>${buttons.length ? triggerSummary(binding,slot) : tx('secondaryEmpty')}</small></div><button class="cc-capture-btn" data-cc-focus data-capture="${index}" data-capture-slot="${slot}"><span class="cc-capture-btn-copy"><small>${tx('currentShortcut')}</small>${buttons.length ? controllerChordHtml(buttons,'detail') : `<span class="cc-unassigned">${tx('secondaryEmpty')}</span>`}</span><span class="cc-capture-btn-action">${tx('configureShortcut')}${iconSvg('chevron')}</span></button>${triggerConfig}${secondary && buttons.length ? `<div class="cc-activation-actions"><button class="cc-btn quiet compact" data-cc-focus data-clear-secondary="${index}">${tx('clearSecondary')}</button></div>` : ''}</section>`;
    }

    function detailPanelHtml() {
        const binding = state.draft?.bindings?.[state.selectedBindingIndex];
        if (!binding) return `<aside class="cc-detail-panel"><div class="cc-detail-empty">${iconSvg('system')}<strong>${tx('noSelection')}</strong><span>${tx('noSelectionDesc')}</span></div></aside>`;
        const index = state.selectedBindingIndex;
        const canRemove = state.mode === 'global' || binding.action?.type !== 'system';
        const analogInput = [...(binding.controllerButtons || []),...(binding.secondaryControllerButtons || [])].some(input => input === 'left-stick' || input === 'right-stick');
        const continuousAnalog = analogInput && (binding.action?.type === 'pointer' || binding.action?.type === 'wheel');
        const pointerDistance = Math.max(4, Math.min(128, Number(binding.action?.pointerDistance) || 24));
        const wheelDelta = Math.max(120, Math.min(1200, Math.abs(Number(binding.action?.wheelDelta) || 120)));
        const amountConfig = binding.action?.type === 'pointer' && binding.action?.pointerDirection !== 'free'
            ? `<div class="cc-detail-block"><span class="cc-detail-label">${tx('pointerDistance')}</span><div class="cc-range-card"><div class="cc-range-head"><strong>${tx('pointerDistance')}</strong><output data-pointer-distance-out>${pointerDistance} ${tx('pixels')}</output></div><input class="cc-range" data-cc-focus data-pointer-distance data-binding-index="${index}" type="range" min="4" max="128" step="4" value="${pointerDistance}"><span class="cc-range-help">${tx('pointerDistanceDesc')}</span></div></div>`
            : binding.action?.type === 'wheel'
                ? `<div class="cc-detail-block"><span class="cc-detail-label">${tx('wheelAmount')}</span><div class="cc-range-card"><div class="cc-range-head"><strong>${tx('wheelAmount')}</strong><output data-wheel-amount-out>${wheelDelta / 120} ${tx(wheelDelta === 120 ? 'wheelNotch' : 'wheelNotches')} · ${wheelDelta}</output></div><input class="cc-range" data-cc-focus data-wheel-amount data-binding-index="${index}" type="range" min="120" max="1200" step="120" value="${wheelDelta}"><span class="cc-range-help">${tx('wheelAmountDesc')}</span></div></div>`
                : '';
        const analogConfig = continuousAnalog ? `<div class="cc-detail-block"><span class="cc-detail-label">${tx('analogContinuous')}</span><div class="cc-pointer"><div class="cc-range-card"><div class="cc-range-head"><strong>${binding.action?.type === 'wheel' ? tx('scrollSpeed') : tx('analogSensitivity')}</strong><output data-action-sensitivity-out>${Math.round(((binding.action?.type === 'wheel' ? state.draft.scrollSensitivity : state.draft.mouseSensitivity) || 1) * 100)}%</output></div><input class="cc-range" data-cc-focus data-action-sensitivity="${binding.action?.type}" type="range" min="25" max="300" step="5" value="${Math.round(((binding.action?.type === 'wheel' ? state.draft.scrollSensitivity : state.draft.mouseSensitivity) || 1) * 100)}"><span class="cc-range-help" data-range-help>${tx('adjustRange')}</span></div><div class="cc-range-card"><div class="cc-range-head"><strong>${tx('analogDeadzone')}</strong><output data-action-deadzone-out>${Math.round((state.draft.mouseDeadZone || .14) * 100)}%</output></div><input class="cc-range" data-cc-focus data-action-deadzone type="range" min="5" max="50" step="1" value="${Math.round((state.draft.mouseDeadZone || .14) * 100)}"><span class="cc-range-help" data-range-help>${tx('adjustRange')}</span></div></div></div>` : '';
        return `<aside class="cc-detail-panel"><span class="cc-eyebrow">${tx('selectedCommand')}</span><div class="cc-detail-title-row"><span class="cc-row-icon">${bindingIcon(binding)}</span><div><h2>${esc(bindingTitle(binding))}</h2><p>${bindingTypeLabel(binding)} · ${esc(bindingTitle(binding))}</p></div></div>
            <div class="cc-detail-block"><span class="cc-detail-label">${tx('controllerActivations')}</span><div class="cc-activation-stack">${activationCardHtml(binding,index,'primary')}${activationCardHtml(binding,index,'secondary')}</div></div>${amountConfig}${analogConfig}
            <div class="cc-detail-actions">${binding.action?.type === 'keyboard' ? `<button class="cc-btn" data-cc-focus data-edit-keys="${index}">${iconSvg('edit')}${tx('editOutput')}</button>` : ''}${canRemove ? `<button class="cc-btn danger" data-cc-focus data-remove="${index}">${iconSvg('trash')}${tx('remove')}</button>` : ''}</div>
        </aside>`;
    }

    function wireContent() {
        const host = state.overlay?.querySelector('[data-content]'); if (!host) return;
        host.querySelector('[data-add-keyboard]')?.addEventListener('click', () => openKeyboard(-1));
        host.querySelector('[data-add-mouse]')?.addEventListener('click', openMousePicker);
        host.querySelector('[data-add-global]')?.addEventListener('click', openGlobalPicker);
        host.querySelectorAll('[data-binding-select]').forEach(button => button.addEventListener('click', () => {
            state.selectedBindingIndex = Number(button.dataset.bindingSelect); renderContent(); focusDefault(`[data-binding-select="${state.selectedBindingIndex}"]`);
        }));
        host.querySelectorAll('[data-edit-keys]').forEach(button => button.addEventListener('click', () => openKeyboard(Number(button.dataset.editKeys))));
        host.querySelectorAll('[data-capture]').forEach(button => button.addEventListener('click', () => openCapture(Number(button.dataset.capture),button.dataset.captureSlot || 'primary')));
        host.querySelectorAll('[data-clear-secondary]').forEach(button => button.addEventListener('click', () => { ensureFork(); const index=Number(button.dataset.clearSecondary),binding=state.draft.bindings[index]; if (!binding) return; binding.secondaryControllerButtons=[]; binding.secondaryTrigger='press'; binding.secondaryLongPressDurationMs=1200; state.selectedBindingIndex=index; markDirty(); renderContent(); focusDefault(`[data-capture="${index}"][data-capture-slot="secondary"]`); }));
        host.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => { ensureFork(); const index=Number(button.dataset.remove); state.draft.bindings.splice(index, 1); state.selectedBindingIndex = -1; normalizeSelectedBinding(); markDirty(); renderContent(); }));
        host.querySelectorAll('[data-trigger-value]').forEach(button => button.addEventListener('click', () => { ensureFork(); const index=Number(button.dataset.bindingIndex),binding=state.draft.bindings[index],slot=button.dataset.triggerSlot || 'primary',triggerProp=slot === 'secondary' ? 'secondaryTrigger' : 'trigger',durationProp=slot === 'secondary' ? 'secondaryLongPressDurationMs' : 'longPressDurationMs'; if (!binding || binding[triggerProp] === button.dataset.triggerValue) return; binding[triggerProp]=button.dataset.triggerValue; if (binding[triggerProp] === 'long-press') binding[durationProp]=longPressDuration(binding,slot); state.selectedBindingIndex=index; markDirty(); renderContent(); focusDefault(`[data-trigger-value="${binding[triggerProp]}"][data-trigger-slot="${slot}"]`); }));
        const sensitivity = host.querySelector('[data-sensitivity]'); const scrollSensitivity = host.querySelector('[data-scroll-sensitivity]'); const deadzone = host.querySelector('[data-deadzone]');
        sensitivity?.addEventListener('input', () => { ensureFork(); state.draft.mouseSensitivity = Number(sensitivity.value)/100; host.querySelector('[data-sensitivity-out]').textContent = `${sensitivity.value}%`; markDirty(); });
        scrollSensitivity?.addEventListener('input', () => { ensureFork(); state.draft.scrollSensitivity = Number(scrollSensitivity.value)/100; host.querySelector('[data-scroll-sensitivity-out]').textContent = `${scrollSensitivity.value}%`; markDirty(); });
        deadzone?.addEventListener('input', () => { ensureFork(); state.draft.mouseDeadZone = Number(deadzone.value)/100; host.querySelector('[data-deadzone-out]').textContent = `${deadzone.value}%`; markDirty(); });
        host.querySelectorAll('[data-pointer-distance]').forEach(range => range.addEventListener('input', () => { ensureFork(); const binding=state.draft.bindings[Number(range.dataset.bindingIndex)]; if (!binding) return; binding.action.pointerDistance=Number(range.value); host.querySelector('[data-pointer-distance-out]').textContent=`${range.value} ${tx('pixels')}`; markDirty(); }));
        host.querySelectorAll('[data-wheel-amount]').forEach(range => range.addEventListener('input', () => { ensureFork(); const binding=state.draft.bindings[Number(range.dataset.bindingIndex)]; if (!binding) return; const sign=Number(binding.action.wheelDelta)<0?-1:1; binding.action.wheelDelta=sign*Number(range.value); const notches=Number(range.value)/120; host.querySelector('[data-wheel-amount-out]').textContent=`${notches} ${tx(notches === 1 ? 'wheelNotch' : 'wheelNotches')} · ${range.value}`; markDirty(); }));
        host.querySelectorAll('[data-action-sensitivity]').forEach(range => range.addEventListener('input', () => { ensureFork(); if (range.dataset.actionSensitivity === 'wheel') state.draft.scrollSensitivity=Number(range.value)/100; else state.draft.mouseSensitivity=Number(range.value)/100; host.querySelector('[data-action-sensitivity-out]').textContent=`${range.value}%`; markDirty(); }));
        host.querySelectorAll('[data-action-deadzone]').forEach(range => range.addEventListener('input', () => { ensureFork(); state.draft.mouseDeadZone=Number(range.value)/100; host.querySelector('[data-action-deadzone-out]').textContent=`${range.value}%`; markDirty(); }));
        host.querySelectorAll('[data-long-press-duration]').forEach(range => range.addEventListener('input', () => { ensureFork(); const index=Number(range.dataset.bindingIndex),binding=state.draft.bindings[index],slot=range.dataset.durationSlot || 'primary',durationProp=slot === 'secondary' ? 'secondaryLongPressDurationMs' : 'longPressDurationMs'; if (!binding) return; binding[durationProp]=Number(range.value); const output=range.parentElement?.querySelector('[data-long-press-duration-out]'); if (output) output.textContent=formatDuration(binding[durationProp]); const summary=host.querySelector(`[data-binding-select="${index}"] [data-trigger-summary]`); if (summary) { const primary=triggerSummary(binding),secondary=triggerSummary(binding,'secondary'); summary.textContent=(binding.secondaryControllerButtons || []).length && secondary !== primary ? `${primary} / ${secondary}` : primary; } markDirty(); }));
    }

    function ensureFork() {
        if (!isBuiltIn()) return;
        const baseId = state.draft.id; state.draft.id = `controls-${Date.now()}-${Math.random().toString(16).slice(2)}`; state.draft.baseProfileId = baseId;
        state.draft.isBuiltIn = false; state.draft.createdAtUtc = new Date().toISOString(); state.draft.updatedAtUtc = state.draft.createdAtUtc;
        state.draft.name = state.target ? `${state.target.name} — ${tx('customSuffix')}` : ''; renderHeader();
    }
    function markDirty() { state.dirty = true; state.draft.updatedAtUtc = new Date().toISOString(); renderFooter(); }
    function setTab(tab) { if (!['keyboard','mouse'].includes(tab) || state.mode === 'global' || (isYouTubeProfile() && tab === 'mouse')) return; finishRangeAdjustment(); state.tab = tab; state.selectedBindingIndex = -1; normalizeSelectedBinding(); renderTabs(); renderContent(); focusDefault(); }
    function switchTab(direction) {
        if (state.popup || state.adjustingRange) return;
        const previousTab = state.tab;
        setTab(direction === 'left' ? 'keyboard' : 'mouse');
        if (state.tab !== previousTab) window.DoorpiUiSound?.play('move');
    }

