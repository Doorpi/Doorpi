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
        style.textContent = `
            .wifi-view{max-width:920px;display:flex;flex-direction:column;gap:18px}.wifi-toolbar{display:grid;grid-template-columns:minmax(320px,1fr) minmax(220px,.55fr);gap:12px}.wifi-toggle-row,.wifi-button,.wifi-network-card,.wifi-back{font:inherit;color:#fff;outline:none;cursor:pointer}.wifi-toggle-row{min-height:68px;padding:0 18px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.045);display:flex;align-items:center;justify-content:space-between;text-align:left}.wifi-toggle-row>span:first-child{display:flex;flex-direction:column;gap:4px}.wifi-toggle-row strong{font-size:1rem}.wifi-toggle-row small{color:rgba(255,255,255,.48);max-width:52ch;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wifi-toggle{width:44px;height:24px;border-radius:12px;background:rgba(255,255,255,.16);padding:3px;box-sizing:border-box;transition:.18s}.wifi-toggle i{display:block;width:18px;height:18px;border-radius:50%;background:#fff;transition:.18s}.wifi-toggle.on{background:#66b9ee}.wifi-toggle.on i{transform:translateX(20px)}.wifi-button{min-height:54px;padding:0 18px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;gap:10px}.wifi-button.primary{background:#fff;color:#080912;font-weight:650}.wifi-button.danger{color:#ff9b9b;border-color:rgba(255,100,100,.26);background:rgba(255,70,70,.08)}.wifi-detail-actions{display:flex;align-items:center;gap:10px}.wifi-button[disabled],.wifi-toggle-row[disabled]{opacity:.4;pointer-events:none}.wifi-spinner{width:16px;height:16px;border:2px solid rgba(9,10,20,.22);border-top-color:#090a14;border-radius:50%;animation:wifiSpin .8s linear infinite}@keyframes wifiSpin{to{transform:rotate(360deg)}}.wifi-network-section h3{margin:0 0 8px;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.48)}.wifi-network-section h3 span{margin-left:7px;color:rgba(255,255,255,.28)}.wifi-network-list{display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:10px}.wifi-network-card{min-height:72px;padding:12px 14px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:rgba(255,255,255,.035);display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:12px;text-align:left}.wifi-network-card.connected{border-color:rgba(102,185,238,.3);background:rgba(102,185,238,.07)}.wifi-network-icon{width:42px;height:42px;border-radius:7px;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center}.wifi-network-icon svg{width:25px;height:25px}.wifi-network-copy{min-width:0;display:flex;flex-direction:column;gap:3px}.wifi-network-copy strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.96rem}.wifi-network-copy span{font-size:.78rem;color:rgba(255,255,255,.45)}.wifi-connected-mark{color:#82d3ff;font-size:.76rem}.wifi-chevron{font-size:1.3rem;color:rgba(255,255,255,.35)}.wifi-empty{grid-column:1/-1;margin:0;padding:16px;border:1px dashed rgba(255,255,255,.08);border-radius:8px;color:rgba(255,255,255,.36)}.wifi-focus.nav-focused-el,.wifi-focus:focus{border-color:rgba(255,255,255,.78);background:rgba(255,255,255,.13);box-shadow:0 0 0 2px rgba(255,255,255,.14),0 14px 34px rgba(0,0,0,.3)}.wifi-button.primary.wifi-focus:focus,.wifi-button.primary.wifi-focus.nav-focused-el{background:#fff;color:#080912;border-color:#fff}.wifi-back{align-self:flex-start;min-height:40px;padding:0 12px;border:1px solid rgba(255,255,255,.08);border-radius:7px;background:rgba(255,255,255,.04)}.wifi-detail-hero{display:flex;align-items:center;gap:20px;padding:24px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:rgba(255,255,255,.035)}.wifi-detail-icon{width:76px;height:76px;border-radius:8px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center}.wifi-detail-icon svg{width:42px;height:42px}.wifi-eyebrow{font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:#89d2ff}.wifi-detail-hero h2{margin:5px 0 4px;font-size:1.7rem;font-weight:450}.wifi-detail-hero p{margin:0;color:rgba(255,255,255,.5)}.wifi-detail-hero p.connected{color:#82d3ff}.wifi-password-label{font-size:.78rem;color:rgba(255,255,255,.55)}.wifi-password-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px}.wifi-password{min-height:54px;padding:0 16px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(255,255,255,.05);color:#fff;font:inherit;outline:none}.wifi-hint{margin:0;color:rgba(255,255,255,.42);font-size:.82rem}@media(min-width:3000px) and (min-height:1600px){.wifi-view{max-width:1100px;gap:24px}.wifi-toggle-row{min-height:84px;padding:0 24px}.wifi-button{min-height:68px;padding:0 24px}.wifi-network-list{grid-template-columns:repeat(2,minmax(330px,1fr));gap:14px}.wifi-network-card{min-height:90px;padding:16px 18px;grid-template-columns:52px minmax(0,1fr) auto}.wifi-network-icon{width:52px;height:52px}}@media(max-width:900px){.wifi-toolbar,.wifi-network-list{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    ensureStyles();
    window.DoorpiWifiUI = { render, bind, setStatus, back, getStatus: () => status };
})();
