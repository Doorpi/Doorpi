    function keyLabel(code) { return keyboardKeyLabel(code) || `VK ${code}`; }
    function actionLabel(action) {
        if (action?.type === 'keyboard') return (action.virtualKeys || []).map(keyLabel).join(' + ') || tx('chooseKeys');
        if (action?.type === 'mouse') return ({left:tx('left'),right:tx('right'),middle:tx('middle'),x1:tx('backMouse'),x2:tx('forwardMouse')})[action.mouseButton] || tx('left');
        if (action?.type === 'wheel') return Number(action.wheelDelta) < 0 ? tx('wheelDown') : tx('wheelUp');
        if (action?.type === 'pointer') return ({free:tx('pointerFree'),up:tx('pointerUp'),down:tx('pointerDown'),left:tx('pointerLeft'),right:tx('pointerRight')})[action.pointerDirection] || tx('pointerFree');
        if (action?.systemCommand === 'task-switcher') return 'Alt + Tab';
        if (action?.systemCommand === 'doorpi-return') return lang() === 'pt' ? 'Voltar ao Doorpi' : 'Return to Doorpi';
        if (action?.systemCommand === 'close-web-app') return tx('closeWebApp');
        if (action?.systemCommand === 'youtube-play-pause') return tx('ytPlayPause');
        return action?.systemCommand || 'System';
    }
    function triggerLabel(value) { return value === 'hold' ? tx('hold') : value === 'release' ? tx('release') : value === 'long-press' ? tx('longPress') : tx('press'); }
    function longPressLimit(binding, slot = 'primary') {
        const buttons = slot === 'secondary' ? binding?.secondaryControllerButtons : binding?.controllerButtons;
        return (buttons || []).some(button => String(button).toLowerCase() === 'guide') ? 3000 : 5000;
    }
    function longPressDuration(binding, slot = 'primary') { const value=slot === 'secondary' ? binding?.secondaryLongPressDurationMs : binding?.longPressDurationMs; return Math.max(500, Math.min(longPressLimit(binding,slot), Number(value) || 1200)); }
    function formatDuration(milliseconds) {
        const seconds = milliseconds / 1000;
        return `${seconds.toLocaleString(lang() === 'pt' ? 'pt-BR' : 'en-US', {minimumFractionDigits:seconds % 1 ? 1 : 0, maximumFractionDigits:1})} s`;
    }
    function activationTrigger(binding, slot = 'primary') { return slot === 'secondary' ? (binding?.secondaryTrigger || 'press') : (binding?.trigger || 'press'); }
    function triggerSummary(binding, slot = 'primary') { const trigger=activationTrigger(binding,slot); return trigger === 'long-press' ? `${triggerLabel(trigger)} · ${formatDuration(longPressDuration(binding,slot))}` : triggerLabel(trigger); }
    function chordHtml(buttons) {
        if (!buttons?.length) return `<span class="cc-unassigned">${tx('notAssigned')}</span>`;
        return `<span class="cc-chord">${buttons.map(button => `<kbd>${esc(PAD_LABELS[button] || button)}</kbd>`).join('<b>+</b>')}</span>`;
    }

    function controllerInputVisualHtml(buttons) {
        const active = new Set((buttons || []).map(button => String(button).toLowerCase()));
        const marker = (id,x,y,label,kind='') => active.has(id)
            ? `<span class="cc-control-marker ${kind}" style="--cc-x:${x}%;--cc-y:${y}%">${label}</span>`
            : '';
        const stickMarker = side => {
            const prefix = `${side}-stick`;
            const click = side === 'left' ? 'l3' : 'r3';
            const value = [...active].find(input => input === prefix || input.startsWith(`${prefix}-`) || input === click);
            if (!value) return '';
            const labels = { [`${prefix}-up`]:'↑', [`${prefix}-down`]:'↓', [`${prefix}-left`]:'←', [`${prefix}-right`]:'→' };
            const text = value === click ? (side === 'left' ? 'L3' : 'R3') : (labels[value] || (side === 'left' ? 'L' : 'R'));
            return `<span class="cc-control-marker stick" style="--cc-x:${side === 'left' ? 24.5 : 63}%;--cc-y:${side === 'left' ? 32.9 : 54.3}%">${text}</span>`;
        };
        const shoulder = (id,side,level) => active.has(id)
            ? `<span class="cc-control-outer ${side} ${level}">${id.toUpperCase()}</span>`
            : '';
        return `<span class="cc-controller-visual">
            ${shoulder('lt','left','trigger')}${shoulder('lb','left','bumper')}${shoulder('rt','right','trigger')}${shoulder('rb','right','bumper')}
            <span class="cc-controller-frame">${controllerSvg('cc-controller-map')}
            ${marker('y',75.5,24.1,'','face')}${marker('x',69,33.2,'','face')}${marker('b',82.6,33.2,'','face')}${marker('a',75.5,42.7,'','face')}
            ${marker('back',42.9,33.2,'','center')}${marker('guide',50,18,'','guide')}${marker('start',57.3,33.2,'','center')}
            ${marker('dpad-up',37.2,48,'↑','dpad')}${marker('dpad-down',37.2,63,'↓','dpad')}${marker('dpad-left',31.5,55.5,'←','dpad')}${marker('dpad-right',42.9,55.5,'→','dpad')}
            ${stickMarker('left')}${stickMarker('right')}
            </span>
        </span>`;
    }

    function controllerChordHtml(buttons, variant = '') {
        if (!buttons?.length) return `<span class="cc-unassigned">${tx('notAssigned')}</span>`;
        const text = buttons.map(button => PAD_LABELS[button] || button).join(' + ');
        return `<span class="cc-control-chord ${variant}">${controllerInputVisualHtml(buttons)}<span class="cc-control-chord-label">${esc(text)}</span></span>`;
    }

    function iconSvg(kind, className = '') {
        const icons = {
            keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 9h1m3 0h1m3 0h1m3 0h0M6 12h1m3 0h1m3 0h1m3 0h0M7 15h10"/>',
            mouse: '<path d="M12 3a6 6 0 0 0-6 6v6a6 6 0 0 0 12 0V9a6 6 0 0 0-6-6Z"/><path d="M12 3v6m-6 1h12"/>',
            system: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8m-4-4h8"/>',
            dpad: '<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z"/>',
            plus: '<path d="M12 5v14M5 12h14"/>',
            close: '<path d="m7 7 10 10M17 7 7 17"/>',
            chevron: '<path d="m9 6 6 6-6 6"/>',
            arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
            edit: '<path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13 7 4 4"/>',
            trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
            profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-5 3.5-7 8-7s7.2 2 8 7"/>',
            lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
        };
        return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[kind] || icons.system}</svg>`;
    }
    function mouseActionSvg(action, className = 'cc-mouse-action') {
        const type = action?.type;
        const key = type === 'wheel' ? (Number(action?.wheelDelta) < 0 ? 'wheel-down' : 'wheel-up') : (action?.mouseButton || 'left');
        const leftFill = key === 'left' ? '<path class="cc-mouse-fill" d="M15 4.1C9.8 4.5 7 8.3 6.6 13H15Z"/>' : '';
        const rightFill = key === 'right' ? '<path class="cc-mouse-fill" d="M17 4.1c5.2.4 8 4.2 8.4 8.9H17Z"/>' : '';
        const wheelFill = key === 'middle' || key.startsWith('wheel-') ? '<rect class="cc-mouse-fill" x="14" y="5.2" width="4" height="6.8" rx="2"/>' : '';
        const side = key === 'x1' ? '<rect class="cc-mouse-fill" x="2.2" y="14" width="5" height="5" rx="1.4"/><path d="m5.8 15.5-1.8 1 1.8 1"/>' : key === 'x2' ? '<rect class="cc-mouse-fill" x="2.2" y="20.2" width="5" height="5" rx="1.4"/><path d="m3.6 21.7 1.8 1-1.8 1"/>' : '';
        const wheelArrow = key === 'wheel-up' ? '<path d="m16 8.5-2.2 2.3M16 8.5l2.2 2.3M16 8.5v7"/>' : key === 'wheel-down' ? '<path d="m16 15.5-2.2-2.3M16 15.5l2.2-2.3M16 15.5v-7"/>' : '';
        return `<svg class="${className}" viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${leftFill}${rightFill}${wheelFill}<path d="M16 2.8C9.2 2.8 5.3 7.9 5.3 15v3c0 7 4.2 11.2 10.7 11.2S26.7 25 26.7 18v-3C26.7 7.9 22.8 2.8 16 2.8Z"/><path d="M5.8 13.5h20.4M16 3v10.5"/>${side}${wheelArrow}</svg>`;
    }
    function bindingKind(binding) {
        const type = binding?.action?.type;
        return type === 'keyboard' ? 'keyboard' : (type === 'mouse' || type === 'wheel' || type === 'pointer') ? 'mouse' : 'system';
    }
    function bindingIcon(binding) { return binding?.action?.type === 'pointer' ? stickSvg(binding.action.pointerDirection !== 'free') : bindingKind(binding) === 'mouse' ? mouseActionSvg(binding.action) : iconSvg(bindingKind(binding)); }
    function stickSvg(verticalOnly = false) {
        const arrows = verticalOnly ? '<path d="M16 5v22m0-22-3 3m3-3 3 3m-3 19-3-3m3 3 3-3"/>' : '<path d="M16 4v24M4 16h24m-12-12-2.8 2.8M16 4l2.8 2.8M28 16l-2.8-2.8M28 16l-2.8 2.8M16 28l-2.8-2.8M16 28l2.8-2.8M4 16l2.8-2.8M4 16l2.8 2.8"/>';
        return `<svg class="cc-stick-svg" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="8" fill="currentColor" fill-opacity=".12"/>${arrows}</svg>`;
    }
    function bindingTypeLabel(binding) {
        if (isYouTubeProfile()) return tx('remoteControl');
        return tx(`${bindingKind(binding)}Action`);
    }
    function youtubeBindingTitle(binding) {
        const id = String(binding?.id || '').toLowerCase();
        const labels = {
            'builtin-youtube-up':'ytNavigateUp', 'builtin-youtube-down':'ytNavigateDown',
            'builtin-youtube-left':'ytNavigateLeft', 'builtin-youtube-right':'ytNavigateRight',
            'builtin-youtube-select':'ytSelect', 'builtin-youtube-back':'ytBack',
            'builtin-youtube-play-pause':'ytPlayPause', 'builtin-youtube-rewind':'ytRewind',
            'builtin-youtube-fast-forward':'ytFastForward', 'builtin-youtube-previous':'ytPrevious',
            'builtin-youtube-next':'ytNext', 'builtin-youtube-close':'ytClose'
        };
        return labels[id] ? tx(labels[id]) : (binding?.name || actionLabel(binding?.action));
    }
    function bindingTitle(binding) {
        if (isYouTubeProfile()) return youtubeBindingTitle(binding);
        if (binding?.action?.type === 'system' && lang() === 'pt' && binding?.name) return binding.name;
        if (binding?.action?.type === 'wheel' && [...(binding.controllerButtons || []),...(binding.secondaryControllerButtons || [])].some(input => input === 'left-stick' || input === 'right-stick')) return tx('scrollSpeed');
        return actionLabel(binding?.action);
    }
    function visibleBindings() {
        if (!state.draft?.bindings) return [];
        if (state.mode === 'global') return state.draft.bindings.filter(binding => binding.action?.type === 'system');
        if (isYouTubeProfile()) return state.tab === 'keyboard' ? state.draft.bindings : [];
        if (state.tab === 'mouse') return state.draft.bindings.filter(binding => binding.action?.type === 'mouse' || binding.action?.type === 'wheel' || binding.action?.type === 'pointer' || binding.action?.systemCommand === 'close-web-app');
        return state.draft.bindings.filter(binding => binding.action?.type === 'keyboard');
    }
    function normalizeSelectedBinding() {
        const bindings = visibleBindings();
        if (!bindings.length) { state.selectedBindingIndex = -1; return; }
        if (!bindings.some(binding => state.draft.bindings.indexOf(binding) === state.selectedBindingIndex))
            state.selectedBindingIndex = state.draft.bindings.indexOf(bindings[0]);
    }

