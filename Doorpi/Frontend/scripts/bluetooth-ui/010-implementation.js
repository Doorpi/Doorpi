(function () {
    const surfaces = {
        quick: { selectedDeviceId: '' },
        settings: { selectedDeviceId: '' }
    };
    let status = {
        available: false,
        enabled: false,
        accessDenied: false,
        discovering: false,
        discoveryEndsAt: '',
        operation: 'loading',
        message: 'Carregando Bluetooth...',
        devices: [],
        pairingPrompt: null
    };
    let countdownTimer = 0;
    let statusFingerprint = '';
    let pendingPairDeviceId = '';

    function tr(key, fallback, ...args) {
        try {
            if (typeof t !== 'function') return fallback;
            const value = t(key, ...args);
            return value === key ? fallback : value;
        }
        catch { return fallback; }
    }

    function statusMessage() {
        const key = read(status, 'messageKey');
        const args = read(status, 'messageArgs', []);
        return key ? tr(key, read(status, 'message', ''), ...(Array.isArray(args) ? args : [])) : read(status, 'message', '');
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

    function devices() {
        return Array.isArray(status.devices) ? status.devices : [];
    }

    function icon(category) {
        const paths = {
            controller: '<path d="M8 8h8a5 5 0 0 1 4.7 3.3l1 3A3 3 0 0 1 17 17.6l-2.2-1.8H9.2L7 17.6a3 3 0 0 1-4.7-3.3l1-3A5 5 0 0 1 8 8Z"/><path d="M7 11v4M5 13h4"/><circle cx="17" cy="12" r=".7" fill="currentColor"/><circle cx="19" cy="14" r=".7" fill="currentColor"/>',
            audio: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M18 19h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v4a3 3 0 0 1-3 3ZM6 19H5a3 3 0 0 1-3-3v-4h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2Z"/>',
            keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h8M16 14h2"/>',
            mouse: '<rect x="7" y="2" width="10" height="20" rx="5"/><path d="M12 2v6"/>',
            phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
            device: '<path d="m10 2 7 7-5 3 5 3-7 7V2Z"/><path d="m5 6 12 12M5 18 17 6"/>'
        };
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[category] || paths.device}</svg>`;
    }

    function stateText(device) {
        if (read(device, 'connected', false)) return tr('bluetoothConnected', 'Conectado');
        if (read(device, 'paired', false)) return tr('bluetoothPaired', 'Pareado');
        return tr('bluetoothReadyToPair', 'Disponível para parear');
    }

    function deviceCard(device) {
        const id = esc(read(device, 'id'));
        const rawId = read(device, 'id');
        const paired = !!read(device, 'paired', false);
        const connected = !!read(device, 'connected', false);
        const prompt = read(status, 'pairingPrompt', null);
        const pairing = read(status, 'operation') === 'pairing' &&
            (pendingPairDeviceId === rawId || read(prompt, 'deviceId') === rawId);
        const busy = ['pairing', 'removing'].includes(status.operation);
        return `<div class="bt-device-card bluetooth-focus ${connected ? 'connected' : ''} ${pairing ? 'pairing' : ''}" role="button"
                    data-bluetooth-device-card="true" data-device-id="${id}"
                    data-paired="${paired}" tabindex="0" aria-disabled="${busy}">
            <span class="bt-device-icon">${icon(read(device, 'category', 'device'))}</span>
            <span class="bt-device-copy">
                <strong>${esc(read(device, 'name', tr('bluetoothUnknownDevice', 'Dispositivo Bluetooth')))}</strong>
                <span>${esc(pairing ? tr('bluetoothPairingShort', 'Pareando...') : stateText(device))}</span>
            </span>
            ${paired
                ? `<button class="bt-device-menu bluetooth-focus" data-bt-menu-id="${id}" tabindex="0" aria-label="${esc(tr('bluetoothDeviceOptions', 'Opções do dispositivo'))}" ${busy ? 'disabled' : ''}>•••</button>`
                : pairing ? '<span class="bt-card-spinner"></span>' : '<span class="bt-device-state">+</span>'}
        </div>`;
    }

    function deviceSection(title, list, emptyText) {
        return `<section class="bt-device-section">
            <h3>${esc(title)} <span>${list.length}</span></h3>
            <div class="bt-device-list">${list.length ? list.map(deviceCard).join('') : `<p class="bt-empty">${esc(emptyText)}</p>`}</div>
        </section>`;
    }

    function remainingSeconds() {
        const end = new Date(status.discoveryEndsAt || 0).getTime();
        if (!status.discovering || !Number.isFinite(end)) return 0;
        return Math.max(0, Math.ceil((end - Date.now()) / 1000));
    }

    function pairingPrompt() {
        const prompt = status.pairingPrompt;
        if (!prompt) return '';
        const kind = read(prompt, 'kind');
        const pin = read(prompt, 'pin');
        const provide = kind === 'provide-pin';
        const confirm = kind === 'confirm-pin';
        return `<div class="bt-pairing-panel">
            <div><span class="bt-eyebrow">${esc(tr('bluetoothPairing', 'Pareamento'))}</span>
                <strong>${esc(read(prompt, 'deviceName'))}</strong>
                <p>${esc(tr(read(prompt, 'messageKey'), read(prompt, 'message')))}</p>
            </div>
            ${pin ? `<div class="bt-pairing-code">${esc(pin)}</div>` : ''}
            ${provide ? `<input class="bt-pin-input bluetooth-focus" data-bt-pin readonly inputmode="numeric" placeholder="PIN" tabindex="0">` : ''}
            ${(provide || confirm) ? `<div class="bt-inline-actions">
                <button class="bt-button bluetooth-focus" data-bt-action="cancel-pairing" tabindex="0">${esc(tr('btnCancel', 'Cancelar'))}</button>
                <button class="bt-button primary bluetooth-focus" data-bt-action="confirm-pairing" tabindex="0">${esc(tr('btnConfirm', 'Confirmar'))}</button>
            </div>` : ''}
        </div>`;
    }

    function detail(surface, device) {
        const connected = !!read(device, 'connected', false);
        return `<div class="bt-view bt-detail-view">
            <button class="bt-back bluetooth-focus" data-bt-action="back" tabindex="0">‹ ${esc(tr('navBack', 'Voltar'))}</button>
            <div class="bt-detail-hero">
                <span class="bt-detail-icon">${icon(read(device, 'category', 'device'))}</span>
                <div><span class="bt-eyebrow">${esc(tr('bluetoothDevice', 'Dispositivo Bluetooth'))}</span>
                    <h2>${esc(read(device, 'name'))}</h2>
                    <p class="${connected ? 'connected' : ''}">${esc(stateText(device))}</p>
                </div>
            </div>
            <div class="bt-detail-data">
                <div><span>${esc(tr('bluetoothConnection', 'Conexão'))}</span><strong>${esc(stateText(device))}</strong></div>
                <div><span>${esc(tr('bluetoothTechnology', 'Tecnologia'))}</span><strong>${esc(String(read(device, 'technology', 'Bluetooth')).toUpperCase())}</strong></div>
            </div>
            <p class="bt-hint">${esc(tr('bluetoothRemoveHint', 'Use o menu de contexto no cartão para remover este dispositivo.'))}</p>
        </div>`;
    }

    function list(surface) {
        const all = devices();
        const known = all.filter(device => read(device, 'paired', false) || read(device, 'connected', false));
        const available = all.filter(device => !read(device, 'paired', false));
        const enabled = !!status.enabled;
        const busy = ['loading', 'changing-radio'].includes(status.operation);
        const discoverLabel = status.discovering
            ? `${tr('bluetoothSearching', 'Procurando')} · <span data-bt-countdown>${remainingSeconds()}s</span>`
            : tr('bluetoothAddDevice', 'Adicionar dispositivo');
        return `<div class="bt-view">
            ${pairingPrompt()}
            <div class="bt-toolbar">
                <button class="bt-toggle-row bluetooth-focus" data-bt-action="toggle" tabindex="0" ${status.available && !status.accessDenied ? '' : 'disabled'}>
                    <span><strong>Bluetooth</strong><small>${esc(statusMessage())}</small></span>
                    <span class="bt-toggle ${enabled ? 'on' : ''}" aria-label="${enabled ? tr('bluetoothOn', 'Ligado') : tr('bluetoothOff', 'Desligado')}"><i></i></span>
                </button>
                <button class="bt-button primary bluetooth-focus" data-bt-action="${status.discovering ? 'stop-discovery' : 'start-discovery'}" tabindex="0" ${enabled && !busy ? '' : 'disabled'}>
                    ${status.discovering ? '<span class="bt-spinner"></span>' : '<span class="bt-plus">+</span>'}
                    <span>${discoverLabel}</span>
                </button>
            </div>
            <div class="bt-sections">
                ${deviceSection(tr('bluetoothKnownDevices', 'Meus dispositivos'), known, tr('bluetoothNoKnownDevices', 'Nenhum dispositivo pareado.'))}
                ${(status.discovering || available.length) ? deviceSection(tr('bluetoothAvailableDevices', 'Dispositivos encontrados'), available, tr('bluetoothSearchingNearby', 'Procurando dispositivos próximos...')) : ''}
            </div>
        </div>`;
    }

    function render(surface) {
        const surfaceState = surfaces[surface] || surfaces.quick;
        const selected = devices().find(device => read(device, 'id') === surfaceState.selectedDeviceId);
        if (surfaceState.selectedDeviceId && !selected) surfaceState.selectedDeviceId = '';
        return selected ? detail(surface, selected) : list(surface);
    }

    function bind(root, surface, onChanged) {
        if (!root) return;
        root.querySelectorAll('[data-bt-action]').forEach(button => {
            button.addEventListener('click', event => {
                event.stopPropagation();
                const action = button.dataset.btAction;
                if (action === 'toggle') postToHost?.({ action: 'setBluetoothEnabled', enabled: !status.enabled });
                if (action === 'start-discovery') postToHost?.({ action: 'startBluetoothDiscovery' });
                if (action === 'stop-discovery') postToHost?.({ action: 'stopBluetoothDiscovery' });
                if (action === 'back') { surfaces[surface].selectedDeviceId = ''; onChanged?.('.bt-device-card'); }
                if (action === 'cancel-pairing') postToHost?.({ action: 'respondBluetoothPairing', accepted: false, pin: '' });
                if (action === 'confirm-pairing') {
                    const pin = root.querySelector('[data-bt-pin]')?.value || '';
                    postToHost?.({ action: 'respondBluetoothPairing', accepted: true, pin });
                }
            });
        });
        root.querySelectorAll('.bt-device-card').forEach(card => {
            card.addEventListener('click', event => {
                if (event.target.closest('.bt-device-menu')) return;
                if (card.getAttribute('aria-disabled') === 'true') return;
                const id = card.dataset.deviceId || '';
                if (card.dataset.paired === 'true') {
                    surfaces[surface].selectedDeviceId = id;
                    onChanged?.('.bt-back');
                } else {
                    pendingPairDeviceId = id;
                    card.classList.add('pairing');
                    card.setAttribute('aria-disabled', 'true');
                    const state = card.querySelector('.bt-device-copy span');
                    if (state) state.textContent = tr('bluetoothPairingShort', 'Pareando...');
                    const marker = card.querySelector('.bt-device-state');
                    if (marker) {
                        marker.className = 'bt-card-spinner';
                        marker.textContent = '';
                    }
                    postToHost?.({ action: 'pairBluetoothDevice', deviceId: id });
                }
            });
        });
        root.querySelectorAll('.bt-device-menu').forEach(button => {
            button.addEventListener('click', event => {
                event.stopPropagation();
                const card = button.closest('.bt-device-card');
                if (!card) return;
                const rect = button.getBoundingClientRect();
                window._ctxMenuOpen?.(card, rect.right + 2, rect.top);
            });
        });
        const pinInput = root.querySelector('[data-bt-pin]');
        pinInput?.addEventListener('click', event => {
            pinInput.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            window._vkbOpen?.(pinInput, {
                onOk: () => pinInput.setAttribute('readonly', ''),
                onCancel: () => pinInput.setAttribute('readonly', '')
            });
        });
        startCountdown();
    }

    function startCountdown() {
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = 0;
        if (!status.discovering) return;
        countdownTimer = setInterval(() => {
            document.querySelectorAll('[data-bt-countdown]').forEach(el => {
                el.textContent = `${remainingSeconds()}s`;
            });
        }, 250);
    }

    function setStatus(next) {
        const merged = { ...status, ...(next || {}) };
        const fingerprint = JSON.stringify(merged);
        if (fingerprint === statusFingerprint) return false;
        status = merged;
        if (read(status, 'operation') !== 'pairing') pendingPairDeviceId = '';
        statusFingerprint = fingerprint;
        startCountdown();
        return true;
    }

    function back(surface) {
        if (!surfaces[surface]?.selectedDeviceId) return false;
        surfaces[surface].selectedDeviceId = '';
        return true;
    }

    function isDetail(surface) {
        return !!surfaces[surface]?.selectedDeviceId;
    }

    function remove(deviceId) {
        if (deviceId) postToHost?.({ action: 'removeBluetoothDevice', deviceId });
    }

    function ensureStyles() {
        if (document.getElementById('doorpiBluetoothStyles')) return;
        const style = document.createElement('style');
        style.id = 'doorpiBluetoothStyles';
        style.textContent = __doorpiCss("injected-styles/bluetooth-ui/doorpi-bluetooth-styles.css");
        document.head.appendChild(style);
    }

    ensureStyles();
    window.DoorpiBluetoothUI = { render, bind, setStatus, back, isDetail, remove, getStatus: () => status };
})();
