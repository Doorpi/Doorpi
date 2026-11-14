(function () {
    const SOUND_STEP = 2;
    const SOUND_ITEMS = [
        { key: 'ambience', group: 'space', labelKey: 'soundAmbienceVolume', fallback: 'Ambiência' },
        { key: 'intro', group: 'space', labelKey: 'soundIntroVolume', fallback: 'Introdução' },
        { key: 'trailer', group: 'space', labelKey: 'soundTrailerVolume', fallback: 'Trailers' },
        { key: 'navigation', group: 'control', labelKey: 'soundNavigationVolume', fallback: 'Navegação' },
        { key: 'confirm', group: 'control', labelKey: 'soundConfirmVolume', fallback: 'Confirmar' },
        { key: 'back', group: 'control', labelKey: 'soundBackVolume', fallback: 'Voltar' }
    ];

    const surfaces = {
        quick: createSurfaceState(),
        settings: createSurfaceState()
    };

    let status = {
        available: false,
        operation: 'loading',
        message: 'Carregando som...',
        messageKey: 'soundLoading',
        defaultDeviceId: '',
        masterVolume: null,
        muted: false,
        devices: []
    };
    let statusFingerprint = '';
    let systemVolumeTimer = 0;
    let pollTimer = 0;
    let localMasterVolume = null;
    let localMasterVolumeUntil = 0;

    function createSurfaceState() {
        return {
            drawerOpen: false,
            systemExpanded: false,
            expandedSoundKey: '',
            activeSliderKey: '',
            devicePendingId: '',
            deviceChangingUntil: 0,
            deviceTimer: 0
        };
    }

    function surfaceState(surface) {
        return surfaces[surface] || surfaces.quick;
    }

    function tr(key, fallback, ...args) {
        try {
            if (typeof t !== 'function') return fallback;
            const value = t(key, ...args);
            return value === key ? fallback : value;
        } catch { return fallback; }
    }

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function read(obj, key, fallback = '') {
        if (!obj) return fallback;
        const pascal = key.charAt(0).toUpperCase() + key.slice(1);
        return obj[key] ?? obj[pascal] ?? fallback;
    }

    function clampVolume(value, fallback = 0) {
        if (value === null || value === undefined || value === '') return fallback;
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(0, Math.min(100, Math.round(n)));
    }

    function hasSystemVolume() {
        return Number.isFinite(Number(read(status, 'masterVolume', NaN)));
    }

    function devices() {
        const list = read(status, 'devices', []);
        return Array.isArray(list) ? list : [];
    }

    function internalVolumes() {
        return window.DoorpiSoundSettings?.getInternalVolumes?.() || {
            ambience: 100,
            navigation: 100,
            confirm: 100,
            back: 100,
            intro: 100,
            trailer: 34
        };
    }

    function statusMessage() {
        const key = read(status, 'messageKey');
        return key ? tr(key, read(status, 'message', '')) : read(status, 'message', '');
    }

    function statusCaption() {
        const operation = read(status, 'operation', 'idle');
        if (operation === 'idle' && read(status, 'available', false)) return '';
        return statusMessage();
    }

    function currentDevice() {
        const list = devices();
        if (!list.length) return null;
        return list.find(device =>
            !!read(device, 'isDefault', false) || read(status, 'defaultDeviceId') === read(device, 'id')) || list[0];
    }

    function valueFor(key) {
        if (key === 'master') return clampVolume(read(status, 'masterVolume', 0));
        return clampVolume(internalVolumes()[key]);
    }

    function speakerIcon() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
    }

    function chevronIcon() {
        return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>';
    }

    function arrowIcon(direction) {
        const rotate = direction === 'left' ? '-90' : '90';
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <g transform="rotate(${rotate} 12 12)">
                <path d="M12 4.8 17.2 10H6.8L12 4.8Z" fill="currentColor" opacity=".92"/>
                <path d="M7.4 13.6h9.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".48"/>
                <path d="M9.4 17.2h5.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".32"/>
            </g>
        </svg>`;
    }

    function slider(surface, key, label, value, system = false, enabled = true, active = false) {
        const safe = clampVolume(value);
        const disabled = enabled ? '' : 'disabled';
        return `<div class="sound-slider-shell ${enabled ? '' : 'disabled'} ${active ? 'active' : ''}" data-sound-slider-shell="${esc(key)}">
            <span class="sound-slider-arrow left" aria-hidden="true">${arrowIcon('left')}</span>
            <span class="sound-slider-stage" style="--sound-level:${enabled ? safe : 0}%">
                <span class="sound-slider-rail" aria-hidden="true">
                    <i data-sound-fill="${esc(key)}" style="width:${enabled ? safe : 0}%"></i>
                    <b></b>
                </span>
            <input
                class="sound-volume-slider ${active ? 'sound-focus' : ''}"
                type="range"
                min="0"
                max="100"
                step="${SOUND_STEP}"
                value="${enabled ? safe : 0}"
                data-sound-slider="${esc(key)}"
                data-sound-surface="${esc(surface)}"
                data-sound-system="${system ? 'true' : 'false'}"
                aria-label="${esc(label)}"
                style="--sound-level:${enabled ? safe : 0}%"
                tabindex="${active ? '0' : '-1'}"
                ${disabled}>
            </span>
            <span class="sound-slider-arrow right" aria-hidden="true">${arrowIcon('right')}</span>
        </div>`;
    }

    function volumeIcon(key) {
        const paths = {
            master: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
            ambience: '<path d="M4 15c2.2-4 4.3-4 6.5 0s4.3 4 6.5 0 3-4 3-4"/><path d="M4 9c2.2-4 4.3-4 6.5 0s4.3 4 6.5 0 3-4 3-4"/>',
            intro: '<path d="M8 5v14l11-7Z"/><path d="M4 5v14"/>',
            trailer: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z"/><path d="M7 5v14M17 5v14"/>',
            navigation: '<path d="M8 8v8M4 12h8"/><circle cx="17" cy="9" r="1"/><circle cx="19" cy="13" r="1"/>',
            confirm: '<path d="m5 12 4 4L19 6"/>',
            back: '<path d="m9 7-5 5 5 5"/><path d="M5 12h14"/>'
        };
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key] || paths.master}</svg>`;
    }

    function volumeControl(surface, key, label, value, system, enabled, active, extraClass = '') {
        return `<div class="sound-volume-card sound-volume-${esc(key)} sound-focus ${esc(extraClass)} ${active ? 'editing' : ''} ${enabled ? '' : 'disabled'}"
                role="button"
                data-sound-volume-control="${esc(key)}"
                tabindex="0"
            aria-disabled="${enabled ? 'false' : 'true'}">
            <div class="sound-volume-copy">
                <span class="sound-volume-label"><i>${volumeIcon(key)}</i><span>${esc(label)}</span></span>
                <strong data-sound-value="${esc(key)}">${enabled ? `${clampVolume(value)}%` : '--'}</strong>
            </div>
            ${slider(surface, key, label, value, system, enabled, active)}
        </div>`;
    }

    function soundItem(surface, item, currentValue, expandedKey, activeSliderKey) {
        const expanded = expandedKey === item.key;
        const active = activeSliderKey === item.key;
        return `<div class="sound-system-item ${expanded ? 'expanded' : ''}" data-sound-system-row="${esc(item.key)}">
            <button class="sound-system-toggle sound-focus" data-sound-item="${esc(item.key)}" tabindex="0" aria-expanded="${expanded ? 'true' : 'false'}">
                <span>${esc(tr(item.labelKey, item.fallback))}</span>
                <span class="sound-system-meta">
                    <strong data-sound-value="${esc(item.key)}">${clampVolume(currentValue)}%</strong>
                    <i>${chevronIcon()}</i>
                </span>
            </button>
            ${expanded ? `<div class="sound-system-slider">${volumeControl(surface, item.key, tr(item.labelKey, item.fallback), currentValue, false, true, active)}</div>` : ''}
        </div>`;
    }

    function mixerGroupIcon(group) {
        if (group === 'space') {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 15c2.2-4 4.3-4 6.5 0s4.3 4 6.5 0 3-4 3-4"/><path d="M4 9c2.2-4 4.3-4 6.5 0s4.3 4 6.5 0 3-4 3-4"/></svg>';
        }
        return window.DoorpiControls?.controllerIcon?.('sound-shared-controller') || '';
    }

    function soundCluster(surface, title, description, group, internal, state) {
        const items = SOUND_ITEMS.filter(item => item.group === group);
        return `<section class="sound-mixer-group ${esc(group)}" data-sound-mixer-group="${esc(group)}">
            <header class="sound-mixer-group-head">
                <span class="sound-mixer-group-icon">${mixerGroupIcon(group)}</span>
                <span class="sound-mixer-group-copy"><strong>${esc(title)}</strong><small>${esc(description)}</small></span>
            </header>
            <div class="sound-mixer-controls">
                ${items.map(item => volumeControl(surface, item.key, tr(item.labelKey, item.fallback), internal[item.key], false, true, state.activeSliderKey === item.key, `sound-mixer-volume sound-mixer-${group}`)).join('')}
            </div>
        </section>`;
    }

    function systemList(surface, internal, state) {
        return `<div class="sound-mixer">
            <div class="sound-mixer-heading">
                <span class="sound-eyebrow">${esc(tr('soundDoorpiVolumes', 'Sons do Doorpi'))}</span>
                <p>Ajuste separadamente a atmosfera da interface e as respostas às ações do controle.</p>
            </div>
            <div class="sound-system-list">
                ${soundCluster(surface, tr('soundSystemAmbientGroup', 'Ambiente e mídia'), 'Ambiência, abertura e reprodução de trailers', 'space', internal, state)}
                ${soundCluster(surface, tr('soundSystemControlGroup', 'Resposta do controle'), 'Movimentos, confirmação e retorno', 'control', internal, state)}
            </div>
        </div>`;
    }

    function deviceDrawerItem(device, locked = false, pendingId = '') {
        const id = read(device, 'id');
        const active = !!read(device, 'isDefault', false) || read(status, 'defaultDeviceId') === id;
        const pending = pendingId && pendingId === id;
        const volume = clampVolume(read(device, 'volume', read(status, 'masterVolume', 0)));
        const hasVolume = !!read(device, 'hasVolume', false) || Number.isFinite(Number(read(device, 'volume', NaN)));
        return `<button class="sound-device-option sound-focus ${active ? 'active' : ''} ${pending ? 'pending' : ''} ${locked ? 'locked' : ''}" data-sound-device-option="${esc(id)}" tabindex="0" aria-pressed="${active ? 'true' : 'false'}" aria-disabled="${locked ? 'true' : 'false'}">
            <span class="sound-device-icon">${speakerIcon()}</span>
            <span class="sound-device-copy">
                <strong>${esc(read(device, 'name', tr('soundUnknownDevice', 'Saida de audio')))}</strong>
                <span>${pending ? esc(tr('soundDeviceSwitching', 'Atualizando...')) : (active ? esc(tr('soundDefaultDevice', 'Padrao')) : esc(tr('soundSetDefault', 'Definir padrao')))}</span>
            </span>
            <span class="sound-device-volume">${pending ? '<i class="sound-device-spinner"></i>' : (hasVolume ? `${volume}%` : '--')}</span>
        </button>`;
    }

    function deviceDrawerHtml(state) {
        const deviceLocked = Date.now() < state.deviceChangingUntil;
        return `<div class="sound-device-overlay" data-sound-device-overlay>
            <button class="sound-device-backdrop" type="button" data-sound-action="close-devices" tabindex="-1" aria-label="${esc(tr('close', 'Fechar'))}"></button>
            <aside class="sound-drawer" role="dialog" aria-modal="true" aria-label="${esc(tr('soundOutputDevices', 'Saida de audio'))}">
                <div class="sound-drawer-head">
                    <div class="sound-drawer-title">
                        <span class="sound-eyebrow">${esc(tr('soundOutputDevices', 'Saida de audio'))}</span>
                        <strong>Selecionar dispositivo</strong>
                        <small>Escolha onde o Windows e o Doorpi devem reproduzir o som.</small>
                    </div>
                    <button class="sound-drawer-close sound-focus" type="button" data-sound-action="close-devices" tabindex="0">${esc(tr('close', 'Fechar'))}</button>
                </div>
                <div class="sound-device-scroll" data-sound-device-scroll>
                    ${devices().length
                ? devices().map(device => deviceDrawerItem(device, deviceLocked, state.devicePendingId)).join('')
                : `<p class="sound-empty">${esc(tr('soundNoDevices', 'Nenhum dispositivo de saida encontrado.'))}</p>`}
                </div>
            </aside>
        </div>`;
    }

    function render(surface) {
        const state = surfaceState(surface);
        state.systemExpanded = false;
        state.expandedSoundKey = '';
        const internal = internalVolumes();
        const device = currentDevice();
        const masterKnown = hasSystemVolume();
        const master = clampVolume(read(status, 'masterVolume', null));
        const caption = statusCaption();
        const deviceName = device
            ? read(device, 'name', tr('soundUnknownDevice', 'Saida de audio'))
            : tr('soundNoDevices', 'Nenhum dispositivo de saida encontrado.');
        const deviceVolume = device
            ? clampVolume(read(device, 'volume', read(status, 'masterVolume', 0)))
            : null;

        return `<div class="sound-view sound-view-${esc(surface)} ${state.drawerOpen ? 'drawer-open' : ''}">
            <div class="sound-layout">
                <div class="sound-main">
                    <div class="sound-overview">
                        <section class="sound-panel sound-master-panel">
                            <div class="sound-section-head">
                                <span class="sound-eyebrow">${esc(tr('soundGeneralVolume', 'Volume geral'))}</span>
                                <p>Controla o volume principal do Windows.</p>
                            </div>
                            ${volumeControl(surface, 'master', tr('soundSystemVolume', 'Volume do Windows'), master, true, masterKnown, state.activeSliderKey === 'master')}
                        </section>

                        <section class="sound-panel sound-output-panel">
                            <div class="sound-section-head">
                                <span class="sound-eyebrow">${esc(tr('soundCurrentDevice', 'Saída de áudio'))}</span>
                                ${caption ? `<p>${esc(caption)}</p>` : '<p>Dispositivo usado pelo Windows e pelo Doorpi.</p>'}
                            </div>
                            <div class="sound-current-device ${device ? '' : 'empty'}">
                                <span class="sound-device-icon">${speakerIcon()}</span>
                                <div class="sound-current-copy">
                                    <strong data-sound-current-device-name>${esc(deviceName)}</strong>
                                    <span data-sound-current-device-volume>${deviceVolume === null ? esc(tr('soundNoDevices', 'Nenhum dispositivo de saida encontrado.')) : `${deviceVolume}%`}</span>
                                </div>
                            </div>
                            <button class="sound-inline-action sound-focus" data-sound-action="toggle-devices" tabindex="0" ${devices().length ? '' : 'disabled'}>
                                <span>${esc(tr('soundChangeDevice', 'Alterar dispositivo'))}</span>
                                <i>${chevronIcon()}</i>
                            </button>
                        </section>
                    </div>

                    <section class="sound-panel sound-mixer-panel">
                        ${systemList(surface, internal, state)}
                    </section>
                </div>

                ${state.drawerOpen ? deviceDrawerHtml(state) : ''}
            </div>
        </div>`;
    }

    function updateValueUi(root, key, value) {
        if (!root) return;
        const safe = clampVolume(value);
        root.querySelectorAll(`[data-sound-value="${CSS.escape(key)}"]`).forEach(el => {
            el.textContent = `${safe}%`;
        });
        root.querySelectorAll(`[data-sound-slider="${CSS.escape(key)}"]`).forEach(el => {
            el.value = String(safe);
            el.style.setProperty('--sound-level', `${safe}%`);
            el.closest('.sound-slider-stage')?.style.setProperty('--sound-level', `${safe}%`);
        });
        root.querySelectorAll(`[data-sound-fill="${CSS.escape(key)}"]`).forEach(el => {
            el.style.width = `${safe}%`;
        });
    }

    function setVolume(root, key, value, system) {
        const safe = clampVolume(value);
        if (system) {
            status.masterVolume = safe;
            localMasterVolume = safe;
            localMasterVolumeUntil = Date.now() + 1500;
            updateValueUi(root, key, safe);
            if (systemVolumeTimer) clearTimeout(systemVolumeTimer);
            systemVolumeTimer = setTimeout(() => {
                systemVolumeTimer = 0;
                postToHost?.({ action: 'setSystemVolume', volume: safe });
            }, 60);
            return;
        }

        window.DoorpiSoundSettings?.setInternalVolume?.(key, safe);
        updateValueUi(root, key, safe);
    }

    function scrollDeviceOptionIntoView(button) {
        button?.scrollIntoView?.({ block: 'nearest' });
    }

    function focusDeviceOption(button) {
        if (!button) return;
        button.focus();
        scrollDeviceOptionIntoView(button);
    }

    function moveDeviceDrawerFocus(root, direction) {
        const active = document.activeElement;
        if (!root || !active || !root.contains(active) || !active.closest?.('.sound-drawer')) return false;
        if (direction === 'LEFT' || direction === 'RIGHT') return true;
        if (direction !== 'UP' && direction !== 'DOWN') return true;
        const options = Array.from(root.querySelectorAll('.sound-drawer .sound-focus'))
            .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
        if (!options.length) return true;
        const current = options.indexOf(active);
        const nextIndex = direction === 'DOWN'
            ? (current + 1 + options.length) % options.length
            : (current - 1 + options.length) % options.length;
        focusDeviceOption(options[nextIndex]);
        return true;
    }

    function updateDeviceBusyUi(root, state) {
        if (!root) return;
        const locked = Date.now() < state.deviceChangingUntil;
        root.querySelectorAll('[data-sound-device-option]').forEach(button => {
            const id = button.dataset.soundDeviceOption || '';
            const pending = locked && state.devicePendingId === id;
            button.classList.toggle('locked', locked);
            button.classList.toggle('pending', pending);
            button.setAttribute('aria-disabled', locked ? 'true' : 'false');
            if (pending) {
                const label = button.querySelector('.sound-device-copy span');
                const volume = button.querySelector('.sound-device-volume');
                if (label) label.textContent = tr('soundDeviceSwitching', 'Atualizando...');
                if (volume) volume.innerHTML = '<i class="sound-device-spinner"></i>';
            }
        });
        updateVisibleStatusValues();
    }

    function scheduleDeviceUnlock(state, surface, onChanged) {
        if (state.deviceTimer) clearTimeout(state.deviceTimer);
        const wait = Math.max(180, state.deviceChangingUntil - Date.now());
        state.deviceTimer = setTimeout(() => {
            state.deviceTimer = 0;
            if (Date.now() < state.deviceChangingUntil) {
                scheduleDeviceUnlock(state, surface, onChanged);
                return;
            }
            state.devicePendingId = '';
            state.deviceChangingUntil = 0;
            const root = surfaceRoot(surface);
            if (root) updateDeviceBusyUi(root, state);
        }, wait);
    }

    function setActiveSliderUi(root, state, key) {
        state.activeSliderKey = key || '';
        root.querySelectorAll('[data-sound-volume-control]').forEach(control => {
            const active = !!key && control.dataset.soundVolumeControl === key;
            control.classList.toggle('editing', active);
            control.querySelectorAll('[data-sound-slider]').forEach(input => {
                input.classList.toggle('sound-focus', active);
                input.tabIndex = active ? 0 : -1;
            });
            control.querySelectorAll('.sound-slider-shell').forEach(shell => shell.classList.toggle('active', active));
        });
    }

    function focusVolumeControl(root, key) {
        requestAnimationFrame(() => root.querySelector(`[data-sound-volume-control="${CSS.escape(key)}"]`)?.focus());
    }

    function focusSlider(root, key) {
        requestAnimationFrame(() => root.querySelector(`[data-sound-slider="${CSS.escape(key)}"]`)?.focus());
    }

    function syncActiveSliderWithFocus(root, state, target) {
        if (!state.activeSliderKey || !root || !target || !root.contains(target)) return;
        if (target.dataset?.soundSlider === state.activeSliderKey) return;
        setActiveSliderUi(root, state, '');
    }

    function wireSoundDynamic(root, surface, onChanged) {
        const state = surfaceState(surface);

        if (!root.dataset.soundFocusSyncBound) {
            root.dataset.soundFocusSyncBound = 'true';
            root.addEventListener('focusin', event => syncActiveSliderWithFocus(root, state, event.target));
        }

        root.querySelectorAll('[data-sound-item]:not([data-sound-bound])').forEach(button => {
            button.dataset.soundBound = 'true';
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const key = button.dataset.soundItem || '';
                const opening = state.expandedSoundKey !== key;
                setActiveSliderUi(root, state, '');

                root.querySelectorAll('.sound-system-item.expanded').forEach(row => {
                    row.classList.remove('expanded');
                    row.querySelector('[data-sound-item]')?.setAttribute('aria-expanded', 'false');
                    row.querySelector('.sound-system-slider')?.remove();
                });

                state.expandedSoundKey = opening ? key : '';
                if (!opening) {
                    button.focus();
                    return;
                }

                const row = button.closest('.sound-system-item');
                const item = SOUND_ITEMS.find(entry => entry.key === key);
                if (!row || !item) return;
                row.classList.add('expanded');
                button.setAttribute('aria-expanded', 'true');
                row.insertAdjacentHTML('beforeend', `<div class="sound-system-slider">${volumeControl(surface, item.key, tr(item.labelKey, item.fallback), internalVolumes()[item.key], false, true, false)}</div>`);
                wireSoundDynamic(root, surface, onChanged);
                focusVolumeControl(root, key);
            });
        });

        root.querySelectorAll('[data-sound-volume-control]:not([data-sound-bound])').forEach(control => {
            control.dataset.soundBound = 'true';
            control.addEventListener('click', event => {
                if (event.target?.closest?.('[data-sound-slider]')) return;
                event.preventDefault();
                event.stopPropagation();
                if (control.getAttribute('aria-disabled') === 'true') return;
                const key = control.dataset.soundVolumeControl || '';
                setActiveSliderUi(root, state, key);
                focusSlider(root, key);
            });
        });

        root.querySelectorAll('[data-sound-slider]:not([data-sound-bound])').forEach(input => {
            input.dataset.soundBound = 'true';
            const apply = () => {
                const key = input.dataset.soundSlider || '';
                const system = input.dataset.soundSystem === 'true';
                state.activeSliderKey = key;
                setVolume(root, key, input.value, system);
            };
            input.addEventListener('input', apply);
            input.addEventListener('change', apply);
            input.addEventListener('click', event => {
                event.stopPropagation();
                if (event.detail > 0 && !event.clientX && !event.clientY) return;
                if (event.detail > 0) return;
                const key = input.dataset.soundSlider || '';
                setActiveSliderUi(root, state, '');
                focusVolumeControl(root, key);
            });
            input.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                const key = input.dataset.soundSlider || '';
                setActiveSliderUi(root, state, '');
                focusVolumeControl(root, key);
            });
        });
    }

    function wireDeviceDrawer(root, surface, onChanged) {
        const state = surfaceState(surface);
        root.querySelectorAll('[data-sound-action="close-devices"]:not([data-sound-bound])').forEach(button => {
            button.dataset.soundBound = 'true';
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                state.drawerOpen = false;
                root.querySelector('.sound-view')?.classList.remove('drawer-open');
                root.querySelector('[data-sound-device-overlay]')?.remove();
                requestAnimationFrame(() => root.querySelector('[data-sound-action="toggle-devices"]')?.focus());
            });
        });
        root.querySelectorAll('[data-sound-device-option]:not([data-sound-bound])').forEach(button => {
            button.dataset.soundBound = 'true';
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const id = button.dataset.soundDeviceOption || '';
                if (!id || button.classList.contains('active') || button.getAttribute('aria-disabled') === 'true' || Date.now() < state.deviceChangingUntil) return;
                status.defaultDeviceId = id;
                devices().forEach(device => { device.isDefault = read(device, 'id') === id; });
                state.devicePendingId = id;
                state.deviceChangingUntil = Date.now() + 1300;
                updateDeviceBusyUi(root, state);
                scheduleDeviceUnlock(state, surface, onChanged);
                postToHost?.({ action: 'setDefaultSoundDevice', deviceId: id });
            });
            button.addEventListener('focus', () => scrollDeviceOptionIntoView(button));
            button.addEventListener('mouseenter', () => scrollDeviceOptionIntoView(button));
        });
    }

    function bind(root, surface, onChanged) {
        if (!root) return;
        const state = surfaceState(surface);
        startPolling();

        root.querySelectorAll('[data-sound-action="toggle-devices"]').forEach(button => {
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                state.activeSliderKey = '';
                state.drawerOpen = !state.drawerOpen;
                const view = root.querySelector('.sound-view');
                const layout = root.querySelector('.sound-layout');
                view?.classList.toggle('drawer-open', state.drawerOpen);
                if (state.drawerOpen) {
                    root.querySelector('[data-sound-device-overlay]')?.remove();
                    layout?.insertAdjacentHTML('beforeend', deviceDrawerHtml(state));
                    wireDeviceDrawer(root, surface, onChanged);
                    requestAnimationFrame(() => root.querySelector('.sound-device-option.active, .sound-device-option')?.focus());
                    return;
                }
                root.querySelector('[data-sound-device-overlay]')?.remove();
                button.focus();
            });
        });

        root.querySelectorAll('[data-sound-action="toggle-system-sounds"]').forEach(button => {
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                setActiveSliderUi(root, state, '');
                state.systemExpanded = !state.systemExpanded;
                if (!state.systemExpanded) state.expandedSoundKey = '';
                const existing = root.querySelector('.sound-system-list');
                if (state.systemExpanded) {
                    button.insertAdjacentHTML('afterend', systemList(surface, internalVolumes(), state));
                    button.classList.add('expanded');
                    button.setAttribute('aria-expanded', 'true');
                    wireSoundDynamic(root, surface, onChanged);
                    requestAnimationFrame(() => root.querySelector('[data-sound-item]')?.focus());
                    return;
                }
                existing?.remove();
                button.classList.remove('expanded');
                button.setAttribute('aria-expanded', 'false');
                button.focus();
            });
        });

        wireSoundDynamic(root, surface, onChanged);
        wireDeviceDrawer(root, surface, onChanged);
    }

    function confirm(surface) {
        const state = surfaceState(surface);
        if (!state.activeSliderKey) return false;
        const key = state.activeSliderKey;
        const root = surfaceRoot(surface);
        if (!root) {
            state.activeSliderKey = '';
            return true;
        }
        const active = document.activeElement;
        const focusedSlider = active && root.contains(active) && active.dataset?.soundSlider === key;
        if (!focusedSlider) {
            setActiveSliderUi(root, state, '');
            return false;
        }
        setActiveSliderUi(root, state, '');
        focusVolumeControl(root, key);
        return true;
    }

    function setStatus(next) {
        const previousLayout = soundLayoutFingerprint(status);
        const merged = { ...status, ...(next || {}) };
        if (localMasterVolume !== null && Date.now() < localMasterVolumeUntil) {
            merged.masterVolume = localMasterVolume;
            const list = Array.isArray(read(merged, 'devices', [])) ? read(merged, 'devices', []) : [];
            list.forEach(device => {
                const isCurrent = !!read(device, 'isDefault', false) || read(merged, 'defaultDeviceId') === read(device, 'id');
                if (isCurrent && (read(device, 'hasVolume', false) || Number.isFinite(Number(read(device, 'volume', NaN))))) {
                    device.volume = localMasterVolume;
                    device.Volume = localMasterVolume;
                }
            });
        } else {
            localMasterVolume = null;
        }
        const fingerprint = JSON.stringify(merged);
        if (fingerprint === statusFingerprint) return false;
        status = merged;
        statusFingerprint = fingerprint;
        if (previousLayout === soundLayoutFingerprint(status)) {
            updateVisibleStatusValues();
            return false;
        }
        return true;
    }

    function soundVisible() {
        return !!document.querySelector('#doorpiQuickPanel .sound-view, #navSoundHost .sound-view');
    }

    function startPolling() {
        if (pollTimer) return;
        pollTimer = setInterval(() => {
            if (!soundVisible()) {
                clearInterval(pollTimer);
                pollTimer = 0;
                return;
            }
            postToHost?.({ action: 'requestSoundStatus' });
        }, 1400);
    }

    function refreshInternalVolumes(root) {
        if (!root) return;
        const internal = internalVolumes();
        Object.keys(internal).forEach(key => updateValueUi(root, key, internal[key]));
    }

    function soundLayoutFingerprint(source) {
        const list = Array.isArray(read(source, 'devices', [])) ? read(source, 'devices', []) : [];
        return JSON.stringify({
            available: !!read(source, 'available', false),
            devices: list.map(device => ({
                id: read(device, 'id', ''),
                name: read(device, 'name', '')
            })).sort((a, b) => `${a.id}\u0000${a.name}`.localeCompare(`${b.id}\u0000${b.name}`))
        });
    }

    function updateVisibleStatusValues() {
        document.querySelectorAll('#doorpiQuickPanel .sound-view, #navSoundHost .sound-view').forEach(root => {
            updateValueUi(root, 'master', read(status, 'masterVolume', 0));
            const device = currentDevice();
            const value = device ? clampVolume(read(device, 'volume', read(status, 'masterVolume', 0))) : null;
            root.querySelectorAll('[data-sound-current-device-name]').forEach(el => {
                el.textContent = device
                    ? read(device, 'name', tr('soundUnknownDevice', 'Saida de audio'))
                    : tr('soundNoDevices', 'Nenhum dispositivo de saida encontrado.');
            });
            root.querySelectorAll('[data-sound-current-device-volume]').forEach(el => {
                el.textContent = value === null
                    ? tr('soundNoDevices', 'Nenhum dispositivo de saida encontrado.')
                    : `${value}%`;
            });
            root.querySelectorAll('[data-sound-device-option]').forEach(button => {
                const id = button.dataset.soundDeviceOption || '';
                const option = devices().find(item => read(item, 'id') === id);
                const active = !!option && (!!read(option, 'isDefault', false) || read(status, 'defaultDeviceId') === id);
                const pending = button.classList.contains('pending');
                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
                const state = button.querySelector('.sound-device-copy span');
                if (state && !pending) {
                    state.textContent = active
                        ? tr('soundDefaultDevice', 'Padrao')
                        : tr('soundSetDefault', 'Definir padrao');
                }
                const volume = button.querySelector('.sound-device-volume');
                if (volume && option && !pending) {
                    const hasVolume = !!read(option, 'hasVolume', false) || Number.isFinite(Number(read(option, 'volume', NaN)));
                    volume.textContent = hasVolume ? `${clampVolume(read(option, 'volume', read(status, 'masterVolume', 0)))}%` : '--';
                }
            });
        });
    }

    function surfaceRoot(surface) {
        return document.querySelector(surface === 'settings' ? '#navSoundHost' : '#doorpiQuickPanel .dq-content');
    }

    function getFocusableItems(root) {
        if (!root) return [];
        return Array.from(root.querySelectorAll('.sound-focus'))
            .filter(el => !el.disabled && el.offsetWidth > 0 && el.offsetHeight > 0);
    }

    function findDirectionalTarget(active, items, direction) {
        if (!active || !items.length) return null;
        const activeRect = active.getBoundingClientRect();
        const activeCenterX = activeRect.left + (activeRect.width / 2);
        const activeCenterY = activeRect.top + (activeRect.height / 2);
        let best = null;
        let bestScore = Number.POSITIVE_INFINITY;

        items.forEach(item => {
            if (item === active) return;
            const rect = item.getBoundingClientRect();
            const centerX = rect.left + (rect.width / 2);
            const centerY = rect.top + (rect.height / 2);
            const dx = centerX - activeCenterX;
            const dy = centerY - activeCenterY;
            let primary = 0;
            let cross = 0;

            if (direction === 'LEFT') {
                if (dx >= -8) return;
                primary = Math.abs(dx);
                cross = Math.abs(dy);
            } else if (direction === 'RIGHT') {
                if (dx <= 8) return;
                primary = Math.abs(dx);
                cross = Math.abs(dy);
            } else if (direction === 'UP') {
                if (dy >= -8) return;
                primary = Math.abs(dy);
                cross = Math.abs(dx);
            } else if (direction === 'DOWN') {
                if (dy <= 8) return;
                primary = Math.abs(dy);
                cross = Math.abs(dx);
            } else {
                return;
            }

            const score = primary + (cross * 0.35);
            if (score < bestScore) {
                best = item;
                bestScore = score;
            }
        });

        return best;
    }

    function mixerDirectionalTarget(root, active, direction) {
        const control = active?.closest?.('[data-sound-volume-control]');
        const key = control?.dataset?.soundVolumeControl || '';
        const item = SOUND_ITEMS.find(entry => entry.key === key);
        if (!control || !item) return { handled: false, target: null };

        const groupItems = SOUND_ITEMS.filter(entry => entry.group === item.group);
        const position = groupItems.findIndex(entry => entry.key === key);
        const targetFor = targetKey => root.querySelector(`[data-sound-volume-control="${CSS.escape(targetKey)}"]`);

        if (direction === 'LEFT' || direction === 'RIGHT') {
            const targetGroup = direction === 'RIGHT' && item.group === 'space'
                ? 'control'
                : direction === 'LEFT' && item.group === 'control'
                    ? 'space'
                    : '';
            if (!targetGroup) return { handled: false, target: null };
            const counterpart = SOUND_ITEMS.filter(entry => entry.group === targetGroup)[position];
            return { handled: true, target: counterpart ? targetFor(counterpart.key) : null };
        }

        if (direction === 'UP') {
            if (position > 0) return { handled: true, target: targetFor(groupItems[position - 1].key) };
            return {
                handled: true,
                target: item.group === 'space'
                    ? root.querySelector('[data-sound-volume-control="master"]')
                    : root.querySelector('[data-sound-action="toggle-devices"]')
            };
        }

        if (direction === 'DOWN') {
            if (position < groupItems.length - 1) return { handled: true, target: targetFor(groupItems[position + 1].key) };
            return { handled: true, target: null };
        }

        return { handled: false, target: null };
    }

    function overviewDirectionalTarget(root, active, direction) {
        const master = active?.closest?.('[data-sound-volume-control="master"]');
        const deviceAction = active?.closest?.('[data-sound-action="toggle-devices"]');
        if (direction === 'RIGHT' && master) {
            return { handled: true, target: root.querySelector('[data-sound-action="toggle-devices"]') };
        }
        if (direction === 'LEFT' && deviceAction) {
            return { handled: true, target: root.querySelector('[data-sound-volume-control="master"]') };
        }
        return { handled: false, target: null };
    }

    function adjustFocusedSlider(root, direction) {
        const active = document.activeElement;
        if (!root || !active || !root.contains(active) || !active.dataset?.soundSlider) return false;
        if (direction !== 'LEFT' && direction !== 'RIGHT') return false;
        const key = active.dataset.soundSlider || '';
        const system = active.dataset.soundSystem === 'true';
        const current = clampVolume(active.value, valueFor(key));
        setVolume(root, key, current + (direction === 'RIGHT' ? SOUND_STEP : -SOUND_STEP), system);
        active.focus();
        return true;
    }

    function back(surface) {
        const state = surfaceState(surface);
        const root = surfaceRoot(surface);
        if (state.activeSliderKey) {
            const key = state.activeSliderKey;
            if (root) setActiveSliderUi(root, state, '');
            else state.activeSliderKey = '';
            if (key !== 'master' && state.expandedSoundKey === key) {
                state.expandedSoundKey = '';
                if (root) {
                    const row = root.querySelector(`[data-sound-system-row="${CSS.escape(key)}"]`);
                    row?.classList.remove('expanded');
                    row?.querySelector('[data-sound-item]')?.setAttribute('aria-expanded', 'false');
                    row?.querySelector('.sound-system-slider')?.remove();
                    requestAnimationFrame(() => root.querySelector(`[data-sound-item="${CSS.escape(key)}"]`)?.focus());
                    return true;
                }
                return `[data-sound-item="${CSS.escape(key)}"]`;
            }
            if (root) {
                focusVolumeControl(root, key);
                return true;
            }
            return `[data-sound-volume-control="${CSS.escape(key)}"]`;
        }
        if (state.drawerOpen) {
            state.drawerOpen = false;
            if (root) {
                root.querySelector('.sound-view')?.classList.remove('drawer-open');
                root.querySelector('[data-sound-device-overlay]')?.remove();
                requestAnimationFrame(() => root.querySelector('[data-sound-action="toggle-devices"]')?.focus());
                return true;
            }
            return '[data-sound-action="toggle-devices"]';
        }
        if (state.expandedSoundKey) {
            const key = state.expandedSoundKey;
            state.expandedSoundKey = '';
            if (root) {
                const row = root.querySelector(`[data-sound-system-row="${CSS.escape(key)}"]`);
                row?.classList.remove('expanded');
                row?.querySelector('[data-sound-item]')?.setAttribute('aria-expanded', 'false');
                row?.querySelector('.sound-system-slider')?.remove();
                requestAnimationFrame(() => root.querySelector(`[data-sound-item="${CSS.escape(key)}"]`)?.focus());
                return true;
            }
            return `[data-sound-item="${CSS.escape(key)}"]`;
        }
        if (state.systemExpanded) {
            state.systemExpanded = false;
            if (root) {
                root.querySelector('.sound-system-list')?.remove();
                const button = root.querySelector('[data-sound-action="toggle-system-sounds"]');
                button?.classList.remove('expanded');
                button?.setAttribute('aria-expanded', 'false');
                requestAnimationFrame(() => button?.focus());
                return true;
            }
            return '[data-sound-action="toggle-system-sounds"]';
        }
        return false;
    }

    function closeDrawer(surface) {
        const state = surfaceState(surface);
        state.drawerOpen = false;
        state.activeSliderKey = '';
        const root = surfaceRoot(surface);
        if (!root) return;
        setActiveSliderUi(root, state, '');
        root.querySelector('.sound-view')?.classList.remove('drawer-open');
        root.querySelector('[data-sound-device-overlay]')?.remove();
    }

    function handleDirection(surface, direction) {
        const root = surfaceRoot(surface);
        const active = document.activeElement;
        if (!root || !active || !root.contains(active)) return false;
        if (moveDeviceDrawerFocus(root, direction)) return true;
        if (adjustFocusedSlider(root, direction)) return true;

        const overviewMove = overviewDirectionalTarget(root, active, direction);
        if (overviewMove.handled) {
            overviewMove.target?.focus();
            return true;
        }

        const mixerMove = mixerDirectionalTarget(root, active, direction);
        if (mixerMove.handled) {
            if (active.dataset?.soundSlider) setActiveSliderUi(root, surfaceState(surface), '');
            mixerMove.target?.focus();
            return true;
        }

        const items = getFocusableItems(root);
        const next = findDirectionalTarget(active, items, direction);
        if (next) {
            if (active.dataset?.soundSlider) {
                setActiveSliderUi(root, surfaceState(surface), '');
            }
            next.focus();
            return true;
        }

        if (surface === 'quick' && direction === 'LEFT') return false;
        if (surface === 'settings' && direction === 'UP') return false;
        return true;
    }

    function ensureStyles() {
        if (document.getElementById('doorpiSoundStyles')) return;
        const style = document.createElement('style');
        style.id = 'doorpiSoundStyles';
        style.textContent = __doorpiCss("injected-styles/sound-ui/doorpi-sound-styles.css");
        document.head.appendChild(style);
    }

    ensureStyles();
    window.DoorpiSoundUI = { render, bind, setStatus, refreshInternalVolumes, back, confirm, handleDirection, closeDrawer, getStatus: () => status };
})();
