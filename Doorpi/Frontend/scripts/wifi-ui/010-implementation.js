(function () {
    const surfaces = {
        quick: { selectedNetworkId: '' },
        settings: { selectedNetworkId: '' }
    };
    let status = {
        available: false,
        enabled: false,
        accessDenied: false,
        operation: 'loading',
        message: 'Carregando Wi-Fi...',
        messageKey: 'wifiLoading',
        connectedSsid: '',
        networks: []
    };
    let statusFingerprint = '';

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

    function networks() {
        const source = read(status, 'networks', []);
        return Array.isArray(source) ? source : [];
    }

    function statusMessage() {
        const key = read(status, 'messageKey');
        const args = read(status, 'messageArgs', []);
        return key ? tr(key, read(status, 'message', ''), ...(Array.isArray(args) ? args : [])) : read(status, 'message', '');
    }

    function wifiIcon(bars = 3, locked = false) {
        const count = Math.max(0, Math.min(4, Number(bars) || 0));
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
            ${count >= 3 ? '<path d="M3.5 8.5a12 12 0 0 1 17 0"/>' : ''}
            ${count >= 2 ? '<path d="M6.7 11.7a7.5 7.5 0 0 1 10.6 0"/>' : ''}
            ${count >= 1 ? '<path d="M9.8 14.8a3.1 3.1 0 0 1 4.4 0"/>' : ''}
            <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>
            ${locked ? '<rect x="16" y="15" width="6" height="5" rx="1"/><path d="M17.5 15v-1a1.5 1.5 0 0 1 3 0v1"/>' : ''}
        </svg>`;
    }

    function networkCard(network) {
        const id = esc(read(network, 'id'));
        const connected = !!read(network, 'connected', false);
        const locked = !!read(network, 'requiresPassword', false);
        const saved = !!read(network, 'saved', false);
        return `<button class="wifi-network-card wifi-focus ${connected ? 'connected' : ''}" data-wifi-network-id="${id}" tabindex="0">
            <span class="wifi-network-icon">${wifiIcon(read(network, 'signalBars', 0), locked)}</span>
            <span class="wifi-network-copy"><strong>${esc(read(network, 'ssid', tr('wifiUnknownNetwork', 'Rede Wi-Fi')))}</strong>
                <span>${esc(connected ? tr('wifiConnected', 'Conectado') : (saved ? tr('wifiSavedNetwork', 'Rede salva') : (locked ? tr('wifiProtectedNetwork', 'Rede protegida') : tr('wifiOpenNetwork', 'Rede aberta'))))}</span>
            </span>
            ${connected ? `<span class="wifi-connected-mark">${esc(tr('wifiConnected', 'Conectado'))}</span>` : '<span class="wifi-chevron">›</span>'}
        </button>`;
    }

    function networkDetail(surface, network) {
        const connected = !!read(network, 'connected', false);
        const locked = !!read(network, 'requiresPassword', false);
        const saved = !!read(network, 'saved', false);
        const networkId = esc(read(network, 'id'));
        return `<div class="wifi-view wifi-detail-view">
            <button class="wifi-back wifi-focus" data-wifi-action="back" tabindex="0">‹ ${esc(tr('navBack', 'Voltar'))}</button>
            <div class="wifi-detail-hero">
                <span class="wifi-detail-icon">${wifiIcon(read(network, 'signalBars', 0), locked)}</span>
                <div><span class="wifi-eyebrow">Wi-Fi</span><h2>${esc(read(network, 'ssid'))}</h2>
                    <p class="${connected ? 'connected' : ''}">${esc(connected ? tr('wifiConnected', 'Conectado') : tr('wifiEnterPassword', 'Digite a senha para conectar'))}</p>
                </div>
            </div>
            ${connected ? `
                <div class="wifi-detail-actions"><button class="wifi-button wifi-focus" data-wifi-action="disconnect" tabindex="0">${esc(tr('wifiDisconnect', 'Desconectar'))}</button>
                ${saved ? `<button class="wifi-button danger wifi-focus" data-wifi-action="forget" data-network-id="${networkId}" tabindex="0">${esc(tr('wifiForget', 'Esquecer rede'))}</button>` : ''}</div>
            ` : saved ? `
                <div class="wifi-detail-actions"><button class="wifi-button primary wifi-focus" data-wifi-action="connect" data-network-id="${networkId}" tabindex="0">${esc(tr('wifiConnect', 'Conectar'))}</button>
                <button class="wifi-button danger wifi-focus" data-wifi-action="forget" data-network-id="${networkId}" tabindex="0">${esc(tr('wifiForget', 'Esquecer rede'))}</button></div>
            ` : locked ? `
                <label class="wifi-password-label" for="wifiPassword-${surface}">${esc(tr('wifiPassword', 'Senha'))}</label>
                <div class="wifi-password-row">
                    <input id="wifiPassword-${surface}" class="wifi-password wifi-focus" data-wifi-password type="password" readonly tabindex="0" autocomplete="off">
                    <button class="wifi-button primary wifi-focus" data-wifi-action="connect" data-network-id="${networkId}" tabindex="0">${esc(tr('wifiConnect', 'Conectar'))}</button>
                </div>
                <p class="wifi-hint">${esc(tr('wifiPasswordPrivate', 'A senha é enviada diretamente ao Windows e não é armazenada pelo Doorpi.'))}</p>
            ` : `
                <button class="wifi-button primary wifi-focus" data-wifi-action="connect" data-network-id="${networkId}" tabindex="0">${esc(tr('wifiConnect', 'Conectar'))}</button>
            `}
        </div>`;
    }

    function list() {
        const enabled = !!read(status, 'enabled', false);
        const operation = read(status, 'operation', 'idle');
        const busy = ['loading', 'changing-radio', 'scanning', 'connecting'].includes(operation);
        const items = networks();
        return `<div class="wifi-view">
            <div class="wifi-toolbar">
                <button class="wifi-toggle-row wifi-focus" data-wifi-action="toggle" tabindex="0" ${status.available && !status.accessDenied ? '' : 'disabled'}>
                    <span><strong>Wi-Fi</strong><small>${esc(statusMessage())}</small></span>
                    <span class="wifi-toggle ${enabled ? 'on' : ''}" aria-label="${enabled ? tr('wifiOn', 'Ligado') : tr('wifiOff', 'Desligado')}"><i></i></span>
                </button>
                <button class="wifi-button primary wifi-focus" data-wifi-action="scan" tabindex="0" ${enabled && !busy ? '' : 'disabled'}>
                    ${operation === 'scanning' ? '<span class="wifi-spinner"></span>' : '<span class="wifi-scan-icon">⌁</span>'}
                    <span>${esc(operation === 'scanning' ? tr('wifiScanning', 'Procurando redes...') : tr('wifiFindNetworks', 'Procurar redes'))}</span>
                </button>
            </div>
            <section class="wifi-network-section">
                <h3>${esc(tr('wifiNetworks', 'Redes'))} <span>${items.length}</span></h3>
                <div class="wifi-network-list">${items.length
                    ? items.map(networkCard).join('')
                    : `<p class="wifi-empty">${esc(enabled ? tr('wifiScanToFind', 'Procure redes para exibir as conexões disponíveis.') : tr('wifiTurnOnToFind', 'Ligue o Wi-Fi para procurar redes.'))}</p>`}
                </div>
            </section>
        </div>`;
    }

    function render(surface) {
        const state = surfaces[surface] || surfaces.quick;
        const selected = networks().find(network => read(network, 'id') === state.selectedNetworkId);
        if (state.selectedNetworkId && !selected) state.selectedNetworkId = '';
        return selected ? networkDetail(surface, selected) : list();
    }

    function bind(root, surface, onChanged) {
        if (!root) return;
        root.querySelectorAll('[data-wifi-action]').forEach(button => {
            button.addEventListener('click', event => {
                event.stopPropagation();
                const action = button.dataset.wifiAction;
                if (action === 'toggle') postToHost?.({ action: 'setWifiEnabled', enabled: !status.enabled });
                if (action === 'scan') postToHost?.({ action: 'scanWifiNetworks' });
                if (action === 'back') { surfaces[surface].selectedNetworkId = ''; onChanged?.('.wifi-network-card'); }
                if (action === 'disconnect') postToHost?.({ action: 'disconnectWifi' });
                if (action === 'forget') postToHost?.({ action: 'forgetWifiNetwork', networkId: button.dataset.networkId || '' });
                if (action === 'connect') {
                    const password = root.querySelector('[data-wifi-password]')?.value || '';
                    postToHost?.({ action: 'connectWifiNetwork', networkId: button.dataset.networkId || '', password });
                }
            });
        });

        root.querySelectorAll('.wifi-network-card').forEach(card => {
            card.addEventListener('click', () => {
                const network = networks().find(item => read(item, 'id') === card.dataset.wifiNetworkId);
                if (!network) return;
                surfaces[surface].selectedNetworkId = read(network, 'id');
                onChanged?.('.wifi-back');
            });
        });

        const password = root.querySelector('[data-wifi-password]');
        password?.addEventListener('click', event => {
            password.removeAttribute('readonly');
            if (!window._doorpiShouldOpenVkbFromEvent?.(event)) return;
            window._vkbOpen?.(password, {
                onOk: () => password.setAttribute('readonly', ''),
                onCancel: () => password.setAttribute('readonly', '')
            });
        });
    }

    function setStatus(next) {
        const merged = { ...status, ...(next || {}) };
        const fingerprint = JSON.stringify(merged);
        if (fingerprint === statusFingerprint) return false;
        status = merged;
        statusFingerprint = fingerprint;
        return true;
    }

    function back(surface) {
        if (!surfaces[surface]?.selectedNetworkId) return false;
        surfaces[surface].selectedNetworkId = '';
        return true;
    }

    function ensureStyles() {
        if (document.getElementById('doorpiWifiStyles')) return;
        const style = document.createElement('style');
        style.id = 'doorpiWifiStyles';
        style.textContent = __doorpiCss("injected-styles/wifi-ui/doorpi-wifi-styles.css");
        document.head.appendChild(style);
    }

    ensureStyles();
    window.DoorpiWifiUI = { render, bind, setStatus, back, getStatus: () => status };
})();
