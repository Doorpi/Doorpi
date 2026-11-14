    function syncOverlayViewport() {
        if (!state.overlay) return;
        // O WebView2 já aplica DoorpiLayoutScale por ZoomFactor e recalcula o
        // viewport CSS. Compensar a escala outra vez aqui aumentava o overlay
        // além do viewport e cortava justamente a tela de Controles.
        state.overlay.style.removeProperty('width');
        state.overlay.style.removeProperty('height');
    }

    function createOverlay() {
        close(); installStyles();
        const overlay = document.createElement('div');
        overlay.className = 'cc-overlay';
        overlay.innerHTML = `<div class="cc-shell">
            <header class="cc-top">
                <div class="cc-brand"><div class="cc-breadcrumb">Doorpi&nbsp;&nbsp;/&nbsp;&nbsp;<span>${tx('settings')}</span></div><h1>${tx('title')}</h1><p>${tx('subtitle')}</p></div>
                <nav class="cc-mode-switch" aria-label="${tx('title')}"><button class="cc-mode-btn ${state.mode === 'apps' ? 'active' : ''}" data-cc-focus data-mode="apps">${tx('appControls')}</button><button class="cc-mode-btn ${state.mode === 'global' ? 'active' : ''}" data-cc-focus data-mode="global">${tx('globalShortcuts')}</button></nav>
                <button class="cc-btn quiet cc-close" data-cc-focus data-close aria-label="${tx('close')}">${iconSvg('close')}</button>
            </header>
            <section class="cc-context" data-context>
                <div class="cc-select-wrap" data-app-wrap><span class="cc-label">${tx('assignedTo')}</span><button class="cc-selector" data-cc-focus data-app-selector>${targetArtHtml(null)}<span><strong>${tx('noApp')}</strong><span>${tx('noAppDesc')}</span></span><em>${tx('change')}</em></button></div>
                <div class="cc-select-wrap" data-profile-wrap><span class="cc-label">${tx('appliedProfile')}</span><button class="cc-selector" data-cc-focus data-profile-selector>${profileArtHtml(null)}<span><strong>—</strong><span>${tx('loading')}</span></span><em>${tx('change')}</em></button></div>
                <section class="cc-input-mode" data-input-mode hidden>
                    <span class="cc-input-mode-icon" aria-hidden="true">${iconSvg('keyboard')}</span>
                    <span class="cc-input-mode-copy"><strong>${tx('inputModeTitle')}</strong><span data-input-mode-desc>${tx('inputModeDesc')}</span></span>
                    <button class="cc-input-mode-toggle" type="button" role="switch" data-cc-focus data-input-mode-toggle aria-checked="false">${tx('inputModeOff')}</button>
                </section>
            </section>
            <div class="cc-tabs"><button class="cc-tab active" data-cc-focus data-tab="keyboard">${tx('keyboard')}</button><button class="cc-tab" data-cc-focus data-tab="mouse">${tx('mouse')}</button><span class="cc-tab-hint"><kbd>LB</kbd>&nbsp; <kbd>RB</kbd>&nbsp;&nbsp;${tx('tabHint').replace('LB / RB ', '')}</span></div>
            <main class="cc-content"><div class="cc-content-inner" data-content><div class="cc-empty">${tx('loading')}</div></div></main>
            <footer class="cc-footer"><span class="cc-dirty" data-dirty>${tx('saved')}</span><div class="cc-footer-hints"><span><span class="cc-dpad-hint">${iconSvg('dpad')}</span>${tx('navigateHint')}</span><span><kbd>A</kbd>${tx('selectHint')}</span><span><kbd>B</kbd>${tx('backHint')}</span></div><button class="cc-btn quiet" data-cc-focus data-reset>${tx('back')}</button><button class="cc-btn primary" data-cc-focus data-save disabled>${tx('save')}</button></footer>
        </div>`;
        document.body.appendChild(overlay); state.overlay = overlay; syncOverlayViewport(); document.body.classList.add('doorpi-controls-open');
        overlay.querySelector('[data-close]').addEventListener('click', requestClose);
        overlay.querySelector('[data-reset]').addEventListener('click', () => {
            if (state.mode === 'global') guardDirty(() => post({action:'resetGlobalControlProfile'}));
            else back();
        });
        overlay.querySelector('[data-app-selector]').addEventListener('click', () => openPicker('apps'));
        overlay.querySelector('[data-profile-selector]').addEventListener('click', () => openPicker('profiles'));
        overlay.querySelector('[data-input-mode-toggle]').addEventListener('click', () => {
            if (!state.target?.canChangeMouseKeyboardMode || state.inputModePending) return;
            const apply = () => {
                state.inputModePending = true;
                renderHeader(); renderContent(); renderFooter();
                post({action:'setControlTargetMouseKeyboard',target:state.target,enabled:!mouseKeyboardEnabled()});
            };
            if (mouseKeyboardEnabled()) guardDirty(apply); else apply();
        });
        overlay.querySelector('[data-save]').addEventListener('click', () => {
            if (state.mode === 'global') {
                state.savePending = true; renderFooter();
                post({action:'saveControlProfile',target:null,profile:state.draft});
            } else openSaveDialog();
        });
        overlay.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));
        overlay.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
        overlay.addEventListener('focusin', event => { overlay.querySelectorAll('.cc-focused').forEach(item => item.classList.remove('cc-focused')); overlay.querySelectorAll('.cc-focused-card').forEach(item => item.classList.remove('cc-focused-card')); event.target?.classList?.add('cc-focused'); event.target?.closest?.('.cc-range-card')?.classList.add('cc-focused-card'); });
    }

