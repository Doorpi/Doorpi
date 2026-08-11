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
        style.textContent = `
            .sound-view{width:100%;max-width:min(1420px,100%);display:flex;flex-direction:column;position:relative;container-type:inline-size}
            .sound-view-quick{max-width:100%}
            .sound-view-settings{max-width:100%}
            .sound-view.drawer-open{max-width:min(1420px,100%)}
            .sound-view-quick.drawer-open{max-width:100%}
            .sound-view-settings.drawer-open{max-width:100%}
            .sound-layout{width:100%;min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:18px;align-items:start}
            .sound-view-quick .sound-layout,.sound-view-settings .sound-layout{grid-template-columns:minmax(0,1fr)}
            .sound-view.drawer-open .sound-layout{grid-template-columns:minmax(0,1fr)}
            .sound-main{min-width:0;display:grid;gap:16px}
            .sound-overview{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:14px;align-items:stretch}
            .sound-panel,.sound-drawer{border:1px solid rgba(255,255,255,.09);border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,.052),rgba(255,255,255,.026));backdrop-filter:blur(14px)}
            .sound-panel{padding:16px;display:grid;gap:12px}
            .sound-master-panel,.sound-output-panel{align-content:start}
            .sound-output-panel{grid-template-columns:1fr}
            .sound-output-panel .sound-section-head{grid-column:1}
            .sound-output-panel .sound-current-device{min-width:0}
            .sound-output-panel .sound-inline-action{align-self:stretch;min-width:0;width:100%}
            .sound-mixer-panel{padding:clamp(18px,2vw,28px)}
            .sound-device-overlay{position:fixed;inset:0;z-index:1000040;display:grid;place-items:center;padding:clamp(24px,5vh,70px)}
            .sound-device-backdrop{position:absolute;inset:0;border:0;background:rgba(3,6,13,.72);backdrop-filter:blur(5px);cursor:default}
            .sound-drawer{position:relative;z-index:1;width:min(680px,calc(100vw - 48px));min-width:0;max-height:min(76vh,820px);padding:clamp(20px,2vw,28px);display:grid;grid-template-rows:auto minmax(0,1fr);gap:18px;overflow:hidden;border-color:rgba(255,255,255,.16);background:linear-gradient(155deg,rgba(28,34,47,.985),rgba(14,18,28,.985));box-shadow:0 32px 90px rgba(0,0,0,.55)}
            .sound-section-head{display:grid;gap:4px}
            .sound-section-head p{margin:0;color:rgba(255,255,255,.5);font-size:.84rem;line-height:1.4}
            .sound-eyebrow{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);font-weight:800}
            .sound-current-device,.sound-inline-action,.sound-system-group,.sound-system-toggle,.sound-volume-card,.sound-device-option{font:inherit;color:#fff;outline:none}
            .sound-current-device{min-height:76px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.035);display:grid;grid-template-columns:46px minmax(0,1fr);gap:13px;align-items:center;padding:12px 14px}
            .sound-current-device.empty{opacity:.72}
            .sound-device-icon{width:46px;height:46px;border-radius:8px;background:rgba(255,255,255,.065);display:flex;align-items:center;justify-content:center;color:#eef3f8}
            .sound-device-icon svg{width:26px;height:26px}
            .sound-current-copy,.sound-device-copy{min-width:0;display:grid;gap:4px}
            .sound-current-copy strong,.sound-device-copy strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:1rem;font-weight:620}
            .sound-current-copy span,.sound-device-copy span{font-size:.82rem;color:rgba(255,255,255,.5)}
            .sound-inline-action,.sound-system-group{min-height:50px;border:1px solid rgba(255,255,255,.085);border-radius:8px;background:rgba(255,255,255,.04);padding:0 14px;display:flex;align-items:center;justify-content:space-between;gap:14px;cursor:pointer;text-align:left}
            .sound-inline-action i,.sound-system-group i,.sound-system-toggle i{display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.62);transition:transform .16s ease}
            .sound-inline-action svg,.sound-system-group svg,.sound-system-toggle svg{width:16px;height:16px}
            .sound-system-group.expanded i{transform:rotate(90deg)}
            .sound-inline-action[disabled]{opacity:.42;cursor:default}
            .sound-volume-card{border:1px solid rgba(255,255,255,.075);border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,.042),rgba(255,255,255,.026));padding:12px 14px;display:grid;gap:10px;cursor:pointer}
            .sound-volume-master{border-color:transparent;background:transparent;padding:clamp(10px,.85vw,14px) clamp(12px,1vw,16px)}
            .sound-volume-card.disabled{opacity:.42;cursor:default}
            .sound-volume-card.editing{border-color:rgba(255,255,255,.075);background:linear-gradient(180deg,rgba(255,255,255,.042),rgba(255,255,255,.026));box-shadow:none}
            .sound-volume-copy{display:flex;align-items:center;justify-content:space-between;gap:16px;color:rgba(255,255,255,.72);font-size:.92rem}
            .sound-volume-label{min-width:0;display:flex;align-items:center;gap:10px}
            .sound-volume-label>i{width:24px;height:24px;display:grid;place-items:center;color:rgba(255,255,255,.5);font-style:normal;flex:0 0 auto}
            .sound-volume-label>i svg{width:20px;height:20px}
            .sound-volume-label>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
            .sound-volume-copy strong{color:#fff;font-weight:650}
            .sound-slider-shell{position:relative;display:grid;grid-template-columns:26px minmax(0,1fr) 26px;gap:10px;align-items:center;padding:0 2px}
            .sound-slider-shell.disabled{opacity:.42}
            .sound-slider-arrow{width:26px;height:26px;display:flex;align-items:center;justify-content:center;color:rgba(214,229,240,.76);opacity:0;transform:scale(.96);transition:opacity .14s ease,transform .14s ease}
            .sound-slider-arrow svg{width:20px;height:20px}
            .sound-slider-shell.active:focus-within .sound-slider-arrow,.sound-volume-card.editing .sound-slider-arrow{opacity:1;transform:scale(1)}
            .sound-slider-stage{position:relative;min-height:32px;display:flex;align-items:center}
            .sound-slider-rail{position:absolute;left:0;right:0;top:50%;height:10px;transform:translateY(-50%);border-radius:999px;background:rgba(255,255,255,.13);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -1px 0 rgba(0,0,0,.42);overflow:hidden}
            
            /* Preenchimento padrão */
            .sound-slider-rail i{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:inherit;background:linear-gradient(90deg,#70c2ff 0%,#3f91d0 60%,#28699e 100%);box-shadow:0 0 18px rgba(91,174,237,.28),inset 0 1px 0 rgba(255,255,255,.28);transition:width .13s cubic-bezier(.2,.75,.2,1);will-change:width}
            .sound-slider-rail b{position:absolute;inset:1px;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.16),transparent 62%);opacity:.75;pointer-events:none}
            
            /* Fundo do Trilho quando em foco (Sem glow externo vazando) */
            .sound-slider-shell.active:focus-within .sound-slider-rail,.sound-volume-card.editing .sound-slider-rail{background:rgba(185,222,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -1px 0 rgba(0,0,0,.46)}
            
            /* Preenchimento quando em foco: Glow Sutil e Elegante Apenas Aqui */
            .sound-slider-shell.active:focus-within .sound-slider-rail i,.sound-volume-card.editing .sound-slider-rail i{background:linear-gradient(90deg,#a6e8ff 0%,#58b9ff 44%,#2d7fca 100%);box-shadow:0 0 14px rgba(88,185,255,.5),0 0 28px rgba(45,127,202,.3),inset 0 1px 0 rgba(255,255,255,.52)}

            .sound-slider-shell:not(.active) .sound-volume-slider{pointer-events:none}
            .sound-volume-slider{-webkit-appearance:none;appearance:none;position:relative;width:100%;height:32px;margin:0;border:0;background:transparent;cursor:pointer;z-index:1}
            .sound-volume-slider::-webkit-slider-runnable-track{-webkit-appearance:none;height:32px;background:transparent}
            
            /* Botão (Thumb) com glow sutil combinando */
            .sound-volume-slider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:22px;margin-top:5px;border-radius:6px;border:1px solid rgba(255,255,255,.28);background:linear-gradient(180deg,#f5fbff,#9fb3c3);box-shadow:0 1px 5px rgba(0,0,0,.42);opacity:0;transform:scale(.96);transition:opacity .12s ease,transform .12s ease, box-shadow .15s ease}
            .sound-volume-card.editing .sound-volume-slider::-webkit-slider-thumb{opacity:1;transform:scale(1);background:#fff;border-color:#fff;box-shadow:0 0 8px rgba(88,185,255,.6),0 1px 5px rgba(0,0,0,.42)}
            
            .sound-volume-slider::-moz-range-track{height:32px;background:transparent}
            .sound-volume-slider::-moz-range-thumb{width:12px;height:22px;border:1px solid rgba(255,255,255,.28);border-radius:6px;background:linear-gradient(180deg,#f5fbff,#9fb3c3);box-shadow:0 1px 5px rgba(0,0,0,.42);opacity:0;transition:opacity .12s ease, box-shadow .15s ease}
            .sound-volume-card.editing .sound-volume-slider::-moz-range-thumb{opacity:1;background:#fff;border-color:#fff;box-shadow:0 0 8px rgba(88,185,255,.6),0 1px 5px rgba(0,0,0,.42)}

            .sound-mixer{display:grid;gap:18px}
            .sound-mixer-heading{display:grid;gap:5px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.1)}
            .sound-mixer-heading p{max-width:760px;margin:0;color:rgba(255,255,255,.48);font-size:.82rem;line-height:1.42}
            .sound-system-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(18px,2.4vw,38px)}
            .sound-mixer-group{min-width:0;display:grid;align-content:start;gap:12px}
            .sound-mixer-group.control{padding-left:clamp(18px,2.2vw,34px);border-left:1px solid rgba(255,255,255,.11)}
            .sound-mixer-group-head{min-height:48px;display:grid;grid-template-columns:38px minmax(0,1fr);align-items:center;gap:11px}
            .sound-mixer-group-icon{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.1);border-radius:7px;color:rgba(255,255,255,.64);background:rgba(255,255,255,.035)}
            .sound-mixer-group-icon svg{width:23px;height:23px}
            .sound-mixer-group.control .sound-mixer-group-icon svg{width:29px;height:24px}
            .sound-mixer-group-copy{min-width:0;display:grid;gap:3px}
            .sound-mixer-group-copy strong{color:rgba(255,255,255,.92);font-size:.96rem;font-weight:600}
            .sound-mixer-group-copy small{color:rgba(255,255,255,.42);font-size:.72rem;line-height:1.3}
            .sound-mixer-controls{display:grid;gap:6px}
            .sound-mixer-volume{min-height:78px;padding:10px 12px;background:rgba(255,255,255,.025);border-color:rgba(255,255,255,.065)}
            .sound-mixer-volume .sound-slider-shell{grid-template-columns:22px minmax(0,1fr) 22px;gap:7px}
            .sound-system-item{display:grid;gap:8px}
            .sound-system-toggle{min-height:46px;padding:0 13px;border:1px solid rgba(255,255,255,.075);border-radius:8px;background:rgba(255,255,255,.032);display:flex;align-items:center;justify-content:space-between;gap:14px;cursor:pointer;text-align:left}
            .sound-system-meta{display:flex;align-items:center;gap:12px}
            .sound-system-meta strong{font-size:.9rem;color:rgba(255,255,255,.86)}
            .sound-system-item.expanded .sound-system-toggle i{transform:rotate(90deg)}
            .sound-system-slider{padding:0 0 0 0}
            .sound-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.1)}
            .sound-drawer-title{min-width:0;display:grid;gap:5px}
            .sound-drawer-title strong{color:#fff;font-size:clamp(1.15rem,1.5vw,1.45rem);font-weight:480}
            .sound-drawer-title small{color:rgba(255,255,255,.48);font-size:.78rem;line-height:1.4}
            .sound-drawer-close{min-height:40px;padding:0 14px;border:1px solid rgba(255,255,255,.12);border-radius:7px;background:rgba(255,255,255,.05);color:#fff;font:inherit;font-size:.78rem;font-weight:620;cursor:pointer;outline:0}
            .sound-device-scroll{display:grid;gap:10px;overflow-y:auto;overflow-x:hidden;min-height:0;padding-right:4px}
            .sound-device-scroll::-webkit-scrollbar{width:8px}
            .sound-device-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:999px}
            .sound-device-option{min-height:74px;border:1px solid rgba(255,255,255,.075);border-radius:8px;background:rgba(255,255,255,.034);display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:13px;align-items:center;padding:12px 14px;cursor:pointer;text-align:left}
            .sound-device-option.active{border-color:rgba(76,126,166,.5);background:rgba(50,94,134,.16)}
            .sound-device-option.locked{opacity:.58}
            .sound-device-option.pending{opacity:1;border-color:rgba(255,255,255,.34)}
            .sound-device-option.active .sound-device-copy span,.sound-device-option.pending .sound-device-copy span{color:#c7d9e7}
            .sound-device-volume{font-size:.86rem;color:rgba(255,255,255,.62)}
            .sound-device-spinner{width:15px;height:15px;border:2px solid rgba(255,255,255,.18);border-top-color:rgba(255,255,255,.8);border-radius:50%;display:block;animation:soundSpin .75s linear infinite}
            @keyframes soundSpin{to{transform:rotate(360deg)}}
            .sound-empty{margin:0;padding:16px;border:1px dashed rgba(255,255,255,.08);border-radius:12px;color:rgba(255,255,255,.36)}
            .sound-focus.nav-focused-el,.sound-focus:focus{border-color:rgba(255,255,255,.78);box-shadow:0 0 0 2px rgba(255,255,255,.12),0 12px 26px rgba(0,0,0,.24)}
            .sound-volume-master.sound-focus.nav-focused-el,.sound-volume-master.sound-focus:focus{border-color:rgba(255,255,255,.18);background:transparent;box-shadow:0 0 0 2px rgba(255,255,255,.055)}
            .sound-volume-slider.sound-focus.nav-focused-el,.sound-volume-slider.sound-focus:focus,.sound-volume-slider:focus{border-color:transparent;box-shadow:none;outline:none}
            .sound-volume-card.editing.nav-focused-el,.sound-volume-card.editing:focus{border-color:rgba(255,255,255,.075);box-shadow:none}
            .sound-volume-slider.sound-focus.nav-focused-el,.sound-volume-slider.sound-focus:focus{outline:none}
            .sound-volume-slider.sound-focus.nav-focused-el + *, .sound-volume-slider.sound-focus:focus + *{outline:none}
            @media(min-width:3000px) and (min-height:1600px){
                .sound-view{max-width:1440px}.sound-view.drawer-open{max-width:1440px}.sound-view-settings,.sound-view-settings.drawer-open{max-width:100%}
                .sound-view.drawer-open .sound-layout{grid-template-columns:minmax(0,1fr)}
                .sound-panel,.sound-drawer{padding:24px}
                .sound-current-device,.sound-device-option{min-height:92px}
                .sound-inline-action,.sound-system-group,.sound-system-toggle,.sound-volume-slider{min-height:58px}
            }
            @media(max-width:1280px){
                .sound-view.drawer-open .sound-layout{grid-template-columns:minmax(0,1fr)}
            }
            @media(max-width:1100px){
                .sound-view-quick .sound-layout{grid-template-columns:1fr}
                .sound-view-settings .sound-layout{grid-template-columns:1fr}
                .sound-view.drawer-open .sound-layout{grid-template-columns:1fr}
                .sound-view.drawer-open .sound-drawer{position:relative;width:min(680px,calc(100vw - 40px))}
                .sound-drawer{max-height:min(78vh,760px)}
                .sound-volume-master{padding:10px 8px}
                .sound-overview{grid-template-columns:1fr}
                .sound-output-panel{grid-template-columns:1fr}
                .sound-output-panel .sound-inline-action{min-width:0}
                .sound-system-list{grid-template-columns:1fr}
                .sound-mixer-group.control{padding-left:0;padding-top:16px;border-left:0;border-top:1px solid rgba(255,255,255,.1)}
            }
            @container (max-width:1180px){
                .sound-view.drawer-open .sound-layout{grid-template-columns:1fr}
                .sound-view.drawer-open .sound-drawer{max-height:min(78vh,760px)}
            }
            @container (max-width:880px){
                .sound-system-list{grid-template-columns:1fr}
                .sound-mixer-group.control{padding-left:0;padding-top:16px;border-left:0;border-top:1px solid rgba(255,255,255,.1)}
            }
        `;
        document.head.appendChild(style);
    }

    ensureStyles();
    window.DoorpiSoundUI = { render, bind, setStatus, refreshInternalVolumes, back, confirm, handleDirection, closeDrawer, getStatus: () => status };
})();
